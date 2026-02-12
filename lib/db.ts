// Database operations layer with Supabase
import { supabase, generateId, isSupabaseConfigured } from './supabase';
import { 
  User, Category, Contractor, InventoryItem, Transaction,
  dbToUser, dbToCategory, dbToContractor, dbToItem, dbToTransaction
} from './database.types';

// Generate idempotency key for create operations
// Uses timestamp + random to ensure uniqueness across clients
const generateIdempotencyKey = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
};

export type PendingEntity = 'users' | 'categories' | 'contractors' | 'items' | 'transactions' | 'settings';
export type PendingAction = 'create' | 'update' | 'delete' | 'upsert';

export interface PendingOperation {
  id: string;
  entity: PendingEntity;
  action: PendingAction;
  payload: Record<string, unknown>;
  createdAt: number;
  expectedUpdatedAt?: number;
  status?: 'pending' | 'conflict' | 'error';
  error?: string;
  retryCount?: number;
}

const CACHE_KEYS = {
  users: 'qs_cache_users',
  categories: 'qs_cache_categories',
  contractors: 'qs_cache_contractors',
  items: 'qs_cache_items',
  transactions: 'qs_cache_transactions',
  settings: 'qs_cache_settings',
  stock: 'qs_cache_stock',
  lastSync: 'qs_cache_last_sync',
  pendingOps: 'qs_pending_ops',
  guardOverride: 'qs_guard_override'
} as const;

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

// Check if an error is transient (should be retried)
const isTransientError = (error: unknown): boolean => {
  const errorStr = String(error).toLowerCase();
  return (
    errorStr.includes('network') ||
    errorStr.includes('timeout') ||
    errorStr.includes('fetch') ||
    errorStr.includes('econnrefused') ||
    errorStr.includes('enotfound') ||
    errorStr.includes('socket') ||
    errorStr.includes('aborted') ||
    errorStr.includes('502') ||
    errorStr.includes('503') ||
    errorStr.includes('504')
  );
};

// Exponential backoff with jitter
const getBackoffDelay = (attempt: number): number => {
  const delay = Math.min(
    RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt),
    RETRY_CONFIG.maxDelayMs
  );
  // Add jitter (0-25% of delay) to prevent thundering herd
  const jitter = Math.random() * 0.25 * delay;
  return delay + jitter;
};

// Sleep helper
const sleep = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));

// Retry wrapper for async operations
async function withRetry<T>(
  operation: () => Promise<T>,
  operationName: string = 'operation'
): Promise<T> {
  let lastError: unknown;
  
  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      // Don't retry non-transient errors
      if (!isTransientError(error)) {
        throw error;
      }
      
      // Don't retry after max attempts
      if (attempt >= RETRY_CONFIG.maxRetries) {
        console.error(`${operationName} failed after ${RETRY_CONFIG.maxRetries + 1} attempts:`, error);
        throw error;
      }
      
      const delay = getBackoffDelay(attempt);
      console.warn(`${operationName} failed (attempt ${attempt + 1}), retrying in ${Math.round(delay)}ms...`, error);
      await sleep(delay);
    }
  }
  
  throw lastError;
}

const readCache = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
};

const writeCache = <T>(key: string, value: T): boolean => {
  try {
    // Proactive cleanup if storage is getting full
    const usage = getStorageUsage();
    if (usage.percentUsed > 80) {
      console.warn(`Storage at ${usage.percentUsed}%, running proactive cleanup...`);
      cleanupOldCacheData();
    }
    
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    // Handle QuotaExceededError
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('Storage quota exceeded, attempting cleanup...');
      cleanupOldCacheData();
      // Try once more after cleanup
      try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch {
        console.error('Storage still full after cleanup - DATA MAY BE LOST');
        // Return false to indicate failure - caller should handle this
        return false;
      }
    }
    return false;
  }
};

// ============ STORAGE MANAGEMENT ============

interface StorageInfo {
  used: number;
  total: number;
  percentUsed: number;
  isNearLimit: boolean;
}

// Estimate localStorage usage
export const getStorageUsage = (): StorageInfo => {
  let totalBytes = 0;
  
  try {
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        totalBytes += localStorage.getItem(key)?.length || 0;
      }
    }
  } catch {
    // Ignore errors during measurement
  }
  
  // localStorage limit is typically 5-10MB, assume 5MB to be safe
  const estimatedLimit = 5 * 1024 * 1024; // 5MB in bytes
  const percentUsed = (totalBytes / estimatedLimit) * 100;
  
  return {
    used: totalBytes,
    total: estimatedLimit,
    percentUsed: Math.round(percentUsed * 10) / 10,
    isNearLimit: percentUsed > 80
  };
};

// Check if we're in development mode
const isDev = typeof import.meta !== 'undefined' && import.meta.env?.DEV;

// Clean up old cached data to free space - more aggressive cleanup
export const cleanupOldCacheData = (): void => {
  if (isDev) console.log('Running cache cleanup...');
  const usage = getStorageUsage();
  if (isDev) console.log(`Current storage: ${(usage.used / 1024 / 1024).toFixed(2)}MB (${usage.percentUsed}%)`);
  
  // Aggressive cleanup based on storage usage
  const daysToKeep = usage.percentUsed > 90 ? 7 : usage.percentUsed > 70 ? 14 : 30;
  const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);
  
  // Clean up transactions - keep only recent ones
  const transactions = readCache<Transaction[]>(CACHE_KEYS.transactions, []);
  const recentTransactions = transactions.filter(t => t.timestamp > cutoffTime);
  
  if (recentTransactions.length < transactions.length) {
    const removed = transactions.length - recentTransactions.length;
    if (isDev) console.log(`Removing ${removed} transactions older than ${daysToKeep} days`);
    // Use localStorage directly to avoid recursive cleanup check
    try {
      localStorage.setItem(CACHE_KEYS.transactions, JSON.stringify(recentTransactions));
    } catch {
      // If still failing, keep only last 500 transactions
      console.warn('Still full, keeping only last 500 transactions');
      const last500 = transactions
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 500);
      localStorage.setItem(CACHE_KEYS.transactions, JSON.stringify(last500));
    }
  }
  
  // Clear any temporary or debug data
  try {
    // Remove any keys that aren't our known cache keys
    const knownKeys = new Set<string>(Object.values(CACHE_KEYS));
    const keysToRemove: string[] = [];
    
    for (const key in localStorage) {
      if (key.startsWith('qs_') && !knownKeys.has(key)) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      if (isDev) console.log(`Removing unknown cache key: ${key}`);
      localStorage.removeItem(key);
    });
  } catch {
    // Ignore cleanup errors
  }
  
  const newUsage = getStorageUsage();
  if (isDev) console.log(`After cleanup: ${(newUsage.used / 1024 / 1024).toFixed(2)}MB (${newUsage.percentUsed}%)`);
};

// Check storage and warn if near limit
export const checkStorageHealth = (): { healthy: boolean; message?: string; usage: StorageInfo } => {
  const usage = getStorageUsage();
  
  if (usage.percentUsed > 95) {
    return {
      healthy: false,
      message: 'Storage is critically full. Some data may not be saved.',
      usage
    };
  }
  
  if (usage.percentUsed > 80) {
    return {
      healthy: true,
      message: 'Storage is getting full. Old data will be cleaned up automatically.',
      usage
    };
  }
  
  return { healthy: true, usage };
};

const isOnline = (): boolean => {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
};

const getPendingOps = (): PendingOperation[] => {
  return readCache<PendingOperation[]>(CACHE_KEYS.pendingOps, []);
};

const setPendingOps = (ops: PendingOperation[]): boolean => {
  const success = writeCache(CACHE_KEYS.pendingOps, ops);
  if (!success) {
    notifyStorageWarning('Warning: Could not save pending operations. Storage may be full.');
  }
  return success;
};

const updatePendingOp = (id: string, updates: Partial<PendingOperation>) => {
  const ops = getPendingOps();
  const updated = ops.map(op => op.id === id ? { ...op, ...updates } : op);
  setPendingOps(updated);
};

// Maximum pending operations - increased for extended offline periods
// With 20 users, each needs ~100 ops/day for extended offline
const MAX_PENDING_OPS = 2000;

// Default query limits to prevent memory exhaustion
const DEFAULT_LIMITS = {
  transactions: 1000,  // Default limit when no limit specified
  items: 5000,         // Reasonable item limit
  users: 500,          // Max users
  categories: 200,     // Max categories
  contractors: 500     // Max contractors
} as const;

// Storage warning callback - set from App.tsx to show UI warnings
let storageWarningCallback: ((message: string) => void) | null = null;

export const setStorageWarningCallback = (callback: ((message: string) => void) | null) => {
  storageWarningCallback = callback;
};

const notifyStorageWarning = (message: string) => {
  console.warn(message);
  if (storageWarningCallback) {
    storageWarningCallback(message);
  }
};

const enqueueOp = (op: PendingOperation) => {
  const ops = getPendingOps();
  if (ops.length >= MAX_PENDING_OPS) {
    console.error('Too many pending operations. Please sync when online.');
    throw new Error(`Pending operations limit reached (${MAX_PENDING_OPS}). Please connect to the internet to sync your changes.`);
  }
  const success = writeCache(CACHE_KEYS.pendingOps, [...ops, { ...op, status: 'pending' }]);
  if (!success) {
    notifyStorageWarning('Storage is full! Your operation may not be saved. Please sync when online.');
    throw new Error('Storage full - operation could not be queued. Please connect to the internet to sync.');
  }
};

const mergeById = <T extends { id: string }>(existing: T[], incoming: T[]): T[] => {
  const map = new Map<string, T>();
  existing.forEach(item => map.set(item.id, item));
  incoming.forEach(item => map.set(item.id, item));
  return Array.from(map.values());
};

export const hasPendingConflicts = (): boolean => {
  return getPendingOps().some(op => op.status === 'conflict');
};

export const getPendingOpsSummary = (): { pending: number; conflicts: number } => {
  const ops = getPendingOps();
  return {
    pending: ops.filter(op => op.status === 'pending').length,
    conflicts: ops.filter(op => op.status === 'conflict').length
  };
};

export const hasCachedCloudData = (): boolean => {
  const users = readCache<User[]>(CACHE_KEYS.users, []);
  const items = readCache<InventoryItem[]>(CACHE_KEYS.items, []);
  const transactions = readCache<Transaction[]>(CACHE_KEYS.transactions, []);
  const categories = readCache<Category[]>(CACHE_KEYS.categories, []);
  return users.length > 0 || items.length > 0 || transactions.length > 0 || categories.length > 0;
};

const fetchUpdatedAt = async (entity: PendingEntity, id: string): Promise<string | null> => {
  const tableMap: Record<PendingEntity, string> = {
    users: 'users',
    categories: 'categories',
    contractors: 'contractors',
    items: 'items',
    transactions: 'transactions',
    settings: 'app_settings'
  };
  const table = tableMap[entity];
  const { data, error } = await supabase
    .from(table)
    .select('updated_at')
    .eq('id', id)
    .maybeSingle();

  if (error) return null;
  return (data as { updated_at?: string } | null)?.updated_at || null;
};

// Process a single operation - returns true if successful
const processOperation = async (op: PendingOperation): Promise<boolean> => {
  const tableMap: Record<PendingEntity, string> = {
    users: 'users',
    categories: 'categories',
    contractors: 'contractors',
    items: 'items',
    transactions: 'transactions',
    settings: 'app_settings'
  };

  const table = tableMap[op.entity];
  if (!table) return false;

  if (op.entity === 'settings' && op.action === 'upsert') {
    const { error } = await supabase.from('app_settings').upsert(op.payload as never);
    if (error) throw error;
    return true;
  }

  if (op.action === 'create') {
    const { error } = await supabase.from(table).insert(op.payload as never);
    if (error) throw error;
  } else if (op.action === 'update') {
    const { error } = await supabase.from(table).update(op.payload as never).eq('id', op.payload.id as string);
    if (error) throw error;
  } else if (op.action === 'delete') {
    const { error } = await supabase.from(table).delete().eq('id', op.payload.id as string);
    if (error) throw error;
  }

  return true;
};

// Maximum retries for transient errors
const MAX_RETRIES = 3;

export const processPendingOps = async (): Promise<{ processed: number; failed: number; conflicts: number }> => {
  const result = { processed: 0, failed: 0, conflicts: 0 };
  
  if (!isSupabaseConfigured() || !isOnline()) return result;

  const ops = getPendingOps();
  if (ops.length === 0) return result;

  const successfulIds: string[] = [];

  for (const op of ops) {
    // Skip already conflicted operations (require manual resolution)
    if (op.status === 'conflict') {
      result.conflicts++;
      continue;
    }

    // Check for conflicts on update/delete operations
    if (op.action === 'update' || op.action === 'delete') {
      try {
        const currentUpdatedAt = await fetchUpdatedAt(op.entity, op.payload.id as string);
        if (!currentUpdatedAt) {
          // Record doesn't exist - mark for deletion if it was a delete, otherwise conflict
          if (op.action === 'delete') {
            // Already deleted, just remove from queue
            successfulIds.push(op.id);
            result.processed++;
            continue;
          } else {
            updatePendingOp(op.id, { status: 'conflict', error: 'Record no longer exists.' });
            result.conflicts++;
            continue;
          }
        }
        if (op.expectedUpdatedAt && new Date(currentUpdatedAt).getTime() !== op.expectedUpdatedAt) {
          updatePendingOp(op.id, { status: 'conflict', error: 'Record has been modified by another user.' });
          result.conflicts++;
          continue;
        }
      } catch (fetchErr) {
        // Network error checking conflict - skip for now, will retry later
        console.warn('Error checking conflict for op:', op.id, fetchErr);
        continue;
      }
    }

    // Try to process the operation with retries for transient errors
    const retryCount = (op as PendingOperation & { retryCount?: number }).retryCount || 0;
    
    try {
      await processOperation(op);
      successfulIds.push(op.id);
      result.processed++;
    } catch (err) {
      const errorStr = String(err);
      
      // Check if this is a transient error that should be retried
      const isTransient = errorStr.includes('network') || 
                          errorStr.includes('timeout') || 
                          errorStr.includes('fetch') ||
                          errorStr.includes('ECONNREFUSED');
      
      if (isTransient && retryCount < MAX_RETRIES) {
        // Increment retry count, will try again next time
        updatePendingOp(op.id, { 
          status: 'pending', 
          error: `Retry ${retryCount + 1}/${MAX_RETRIES}: ${errorStr}` 
        } as Partial<PendingOperation>);
        // Store retry count (extends the type temporarily)
        const ops = getPendingOps();
        const updatedOps = ops.map(o => 
          o.id === op.id ? { ...o, retryCount: retryCount + 1 } : o
        );
        setPendingOps(updatedOps as PendingOperation[]);
      } else {
        // Permanent error or max retries reached
        updatePendingOp(op.id, { status: 'error', error: errorStr });
        result.failed++;
      }
      
      // Continue processing other operations (don't break!)
      continue;
    }
  }

  // Remove all successful operations
  if (successfulIds.length > 0) {
    const currentOps = getPendingOps();
    setPendingOps(currentOps.filter(op => !successfulIds.includes(op.id)));
  }

  return result;
};

// Dismiss/clear a failed or conflicted operation
export const dismissPendingOp = (opId: string): void => {
  const ops = getPendingOps();
  setPendingOps(ops.filter(op => op.id !== opId));
};

// Force retry a failed operation
export const retryPendingOp = (opId: string): void => {
  const ops = getPendingOps();
  const updated = ops.map(op => 
    op.id === opId ? { ...op, status: 'pending' as const, error: undefined, retryCount: 0 } : op
  );
  setPendingOps(updated as PendingOperation[]);
};

// Get detailed info about pending ops for admin view
export const getPendingOpsDetailed = (): PendingOperation[] => {
  return getPendingOps();
};

// ============ USERS ============

export const getUsers = async (): Promise<User[]> => {
  if (!isSupabaseConfigured()) {
    const saved = localStorage.getItem('qs_users');
    return saved ? JSON.parse(saved) : [];
  }

  if (!isOnline()) {
    return readCache<User[]>(CACHE_KEYS.users, []);
  }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(DEFAULT_LIMITS.users);

  if (error) {
    console.error('Error fetching users:', error);
    return readCache<User[]>(CACHE_KEYS.users, []);
  }

  const users = (data || []).map(dbToUser);
  writeCache(CACHE_KEYS.users, users);
  return users;
};

export const createUser = async (user: Omit<User, 'id' | 'createdAt'>): Promise<User | null> => {
  if (isSupabaseConfigured() && hasPendingConflicts()) {
    console.error('Sync conflicts detected. Resolve conflicts before creating users.');
    return null;
  }

  const newUser = {
    id: generateId(),
    username: user.username,
    password: user.password,
    display_name: user.displayName,
    role: user.role
  };

  if (!isSupabaseConfigured()) {
    const users = await getUsers();
    const localUser: User = {
      ...user,
      id: newUser.id,
      createdAt: Date.now()
    };
    localStorage.setItem('qs_users', JSON.stringify([...users, localUser]));
    return localUser;
  }

  if (!isOnline()) {
    const localUser: User = {
      ...user,
      id: newUser.id,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const cachedUsers = readCache<User[]>(CACHE_KEYS.users, []);
    writeCache(CACHE_KEYS.users, [...cachedUsers, localUser]);
    enqueueOp({
      id: generateId(),
      entity: 'users',
      action: 'create',
      payload: { ...newUser },
      createdAt: Date.now()
    });
    return localUser;
  }

  const { data, error } = await supabase
    .from('users')
    .insert(newUser as never)
    .select()
    .single();

  if (error) {
    console.error('Error creating user:', error);
    return null;
  }

  const created = dbToUser(data);
  const cachedUsers = readCache<User[]>(CACHE_KEYS.users, []);
  writeCache(CACHE_KEYS.users, [...cachedUsers, created]);
  return created;
};

export const updateUser = async (id: string, updates: Partial<User>): Promise<boolean> => {
  if (isSupabaseConfigured() && hasPendingConflicts()) {
    console.error('Sync conflicts detected. Resolve conflicts before updating users.');
    return false;
  }

  if (!isSupabaseConfigured()) {
    const users = await getUsers();
    const updated = users.map(u => u.id === id ? { ...u, ...updates } : u);
    localStorage.setItem('qs_users', JSON.stringify(updated));
    return true;
  }

  if (!isOnline()) {
    const cachedUsers = readCache<User[]>(CACHE_KEYS.users, []);
    const current = cachedUsers.find(u => u.id === id);
    const updatedUsers = cachedUsers.map(u => u.id === id ? { ...u, ...updates, updatedAt: Date.now() } : u);
    writeCache(CACHE_KEYS.users, updatedUsers);
    enqueueOp({
      id: generateId(),
      entity: 'users',
      action: 'update',
      payload: { id, ...updates },
      createdAt: Date.now(),
      expectedUpdatedAt: current?.updatedAt
    });
    return true;
  }

  const dbUpdates: Record<string, unknown> = {};
  if (updates.username) dbUpdates.username = updates.username;
  if (updates.password) dbUpdates.password = updates.password;
  if (updates.displayName) dbUpdates.display_name = updates.displayName;
  if (updates.role) dbUpdates.role = updates.role;

  const { error } = await supabase
    .from('users')
    .update(dbUpdates as never)
    .eq('id', id);

  if (error) {
    console.error('Error updating user:', error);
    return false;
  }

  const cachedUsers = readCache<User[]>(CACHE_KEYS.users, []);
  const updatedUsers = cachedUsers.map(u => u.id === id ? { ...u, ...updates, updatedAt: Date.now() } : u);
  writeCache(CACHE_KEYS.users, updatedUsers);
  return true;
};

export const deleteUser = async (id: string): Promise<boolean> => {
  if (isSupabaseConfigured() && hasPendingConflicts()) {
    console.error('Sync conflicts detected. Resolve conflicts before deleting users.');
    return false;
  }

  if (!isSupabaseConfigured()) {
    const users = await getUsers();
    localStorage.setItem('qs_users', JSON.stringify(users.filter(u => u.id !== id)));
    return true;
  }

  if (!isOnline()) {
    const cachedUsers = readCache<User[]>(CACHE_KEYS.users, []);
    const current = cachedUsers.find(u => u.id === id);
    writeCache(CACHE_KEYS.users, cachedUsers.filter(u => u.id !== id));
    enqueueOp({
      id: generateId(),
      entity: 'users',
      action: 'delete',
      payload: { id },
      createdAt: Date.now(),
      expectedUpdatedAt: current?.updatedAt
    });
    return true;
  }

  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting user:', error);
    return false;
  }

  const cachedUsers = readCache<User[]>(CACHE_KEYS.users, []);
  writeCache(CACHE_KEYS.users, cachedUsers.filter(u => u.id !== id));
  return true;
};

export const authenticateUser = async (username: string, password: string): Promise<User | null> => {
  const users = await getUsers();
  return users.find(
    u => u.username.toLowerCase() === username.toLowerCase() && u.password === password
  ) || null;
};

// ============ CATEGORIES ============

export const getCategories = async (): Promise<Category[]> => {
  if (!isSupabaseConfigured()) {
    const saved = localStorage.getItem('qs_categories');
    if (saved) {
      const names: string[] = JSON.parse(saved);
      return names.map((name, i) => ({ id: name, name, sortOrder: i }));
    }
    return [];
  }

  if (!isOnline()) {
    return readCache<Category[]>(CACHE_KEYS.categories, []);
  }

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true })
    .limit(DEFAULT_LIMITS.categories);

  if (error) {
    console.error('Error fetching categories:', error);
    return readCache<Category[]>(CACHE_KEYS.categories, []);
  }

  const categories = (data || []).map(dbToCategory);
  writeCache(CACHE_KEYS.categories, categories);
  return categories;
};

export const createCategory = async (name: string): Promise<Category | null> => {
  if (isSupabaseConfigured() && hasPendingConflicts()) {
    console.error('Sync conflicts detected. Resolve conflicts before creating categories.');
    return null;
  }

  const categories = await getCategories();
  const sortOrder = categories.length;

  if (!isSupabaseConfigured()) {
    const names = categories.map(c => c.name);
    names.push(name);
    localStorage.setItem('qs_categories', JSON.stringify(names.sort()));
    return { id: name, name, sortOrder };
  }

  if (!isOnline()) {
    const localCategory: Category = {
      id: generateId(),
      name,
      sortOrder,
      updatedAt: Date.now()
    };
    writeCache(CACHE_KEYS.categories, [...categories, localCategory]);
    enqueueOp({
      id: generateId(),
      entity: 'categories',
      action: 'create',
      payload: { id: localCategory.id, name, sort_order: sortOrder },
      createdAt: Date.now()
    });
    return localCategory;
  }

  const { data, error } = await supabase
    .from('categories')
    .insert({ id: generateId(), name, sort_order: sortOrder } as never)
    .select()
    .single();

  if (error) {
    console.error('Error creating category:', error);
    return null;
  }

  const created = dbToCategory(data);
  writeCache(CACHE_KEYS.categories, [...categories, created]);
  return created;
};

export const updateCategory = async (id: string, newName: string): Promise<boolean> => {
  if (isSupabaseConfigured() && hasPendingConflicts()) {
    console.error('Sync conflicts detected. Resolve conflicts before updating categories.');
    return false;
  }

  if (!isSupabaseConfigured()) {
    const categories = await getCategories();
    const names = categories.map(c => c.id === id ? newName : c.name);
    localStorage.setItem('qs_categories', JSON.stringify(names.sort()));
    return true;
  }

  if (!isOnline()) {
    const cached = readCache<Category[]>(CACHE_KEYS.categories, []);
    const current = cached.find(c => c.id === id);
    const updated = cached.map(c => c.id === id ? { ...c, name: newName, updatedAt: Date.now() } : c);
    writeCache(CACHE_KEYS.categories, updated);
    enqueueOp({
      id: generateId(),
      entity: 'categories',
      action: 'update',
      payload: { id, name: newName },
      createdAt: Date.now(),
      expectedUpdatedAt: current?.updatedAt
    });
    return true;
  }

  const { error } = await supabase
    .from('categories')
    .update({ name: newName } as never)
    .eq('id', id);

  if (error) {
    console.error('Error updating category:', error);
    return false;
  }

  const cached = readCache<Category[]>(CACHE_KEYS.categories, []);
  const updated = cached.map(c => c.id === id ? { ...c, name: newName, updatedAt: Date.now() } : c);
  writeCache(CACHE_KEYS.categories, updated);
  return true;
};

export const deleteCategory = async (id: string): Promise<boolean> => {
  if (isSupabaseConfigured() && hasPendingConflicts()) {
    console.error('Sync conflicts detected. Resolve conflicts before deleting categories.');
    return false;
  }

  if (!isSupabaseConfigured()) {
    const categories = await getCategories();
    const names = categories.filter(c => c.id !== id).map(c => c.name);
    localStorage.setItem('qs_categories', JSON.stringify(names));
    return true;
  }

  if (!isOnline()) {
    const cached = readCache<Category[]>(CACHE_KEYS.categories, []);
    const current = cached.find(c => c.id === id);
    writeCache(CACHE_KEYS.categories, cached.filter(c => c.id !== id));
    enqueueOp({
      id: generateId(),
      entity: 'categories',
      action: 'delete',
      payload: { id },
      createdAt: Date.now(),
      expectedUpdatedAt: current?.updatedAt
    });
    return true;
  }

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting category:', error);
    return false;
  }

  const cached = readCache<Category[]>(CACHE_KEYS.categories, []);
  writeCache(CACHE_KEYS.categories, cached.filter(c => c.id !== id));
  return true;
};

// ============ CONTRACTORS ============

export const getContractors = async (): Promise<Contractor[]> => {
  if (!isSupabaseConfigured()) {
    const saved = localStorage.getItem('qs_contractors');
    return saved ? JSON.parse(saved) : [];
  }

  if (!isOnline()) {
    return readCache<Contractor[]>(CACHE_KEYS.contractors, []);
  }

  const { data, error } = await supabase
    .from('contractors')
    .select('*')
    .order('name', { ascending: true })
    .limit(DEFAULT_LIMITS.contractors);

  if (error) {
    console.error('Error fetching contractors:', error);
    return readCache<Contractor[]>(CACHE_KEYS.contractors, []);
  }

  const contractors = (data || []).map(dbToContractor);
  writeCache(CACHE_KEYS.contractors, contractors);
  return contractors;
};

export const createContractor = async (name: string): Promise<Contractor | null> => {
  if (isSupabaseConfigured() && hasPendingConflicts()) {
    console.error('Sync conflicts detected. Resolve conflicts before creating contractors.');
    return null;
  }

  const id = generateId();

  if (!isSupabaseConfigured()) {
    const contractors = await getContractors();
    const newContractor: Contractor = { id, name };
    localStorage.setItem('qs_contractors', JSON.stringify([...contractors, newContractor]));
    return newContractor;
  }

  if (!isOnline()) {
    const localContractor: Contractor = {
      id,
      name,
      updatedAt: Date.now()
    };
    const contractors = readCache<Contractor[]>(CACHE_KEYS.contractors, []);
    writeCache(CACHE_KEYS.contractors, [...contractors, localContractor]);
    enqueueOp({
      id: generateId(),
      entity: 'contractors',
      action: 'create',
      payload: { id, name },
      createdAt: Date.now()
    });
    return localContractor;
  }

  const { data, error } = await supabase
    .from('contractors')
    .insert({ id, name } as never)
    .select()
    .single();

  if (error) {
    console.error('Error creating contractor:', error);
    return null;
  }

  const created = dbToContractor(data);
  const contractors = readCache<Contractor[]>(CACHE_KEYS.contractors, []);
  writeCache(CACHE_KEYS.contractors, [...contractors, created]);
  return created;
};

export const updateContractor = async (id: string, name: string): Promise<boolean> => {
  if (isSupabaseConfigured() && hasPendingConflicts()) {
    console.error('Sync conflicts detected. Resolve conflicts before updating contractors.');
    return false;
  }

  if (!isSupabaseConfigured()) {
    const contractors = await getContractors();
    const updated = contractors.map(c => c.id === id ? { ...c, name } : c);
    localStorage.setItem('qs_contractors', JSON.stringify(updated));
    return true;
  }

  if (!isOnline()) {
    const cached = readCache<Contractor[]>(CACHE_KEYS.contractors, []);
    const current = cached.find(c => c.id === id);
    const updated = cached.map(c => c.id === id ? { ...c, name, updatedAt: Date.now() } : c);
    writeCache(CACHE_KEYS.contractors, updated);
    enqueueOp({
      id: generateId(),
      entity: 'contractors',
      action: 'update',
      payload: { id, name },
      createdAt: Date.now(),
      expectedUpdatedAt: current?.updatedAt
    });
    return true;
  }

  const { error } = await supabase
    .from('contractors')
    .update({ name } as never)
    .eq('id', id);

  if (error) {
    console.error('Error updating contractor:', error);
    return false;
  }

  const cached = readCache<Contractor[]>(CACHE_KEYS.contractors, []);
  const updated = cached.map(c => c.id === id ? { ...c, name, updatedAt: Date.now() } : c);
  writeCache(CACHE_KEYS.contractors, updated);
  return true;
};

export const deleteContractor = async (id: string): Promise<boolean> => {
  if (isSupabaseConfigured() && hasPendingConflicts()) {
    console.error('Sync conflicts detected. Resolve conflicts before deleting contractors.');
    return false;
  }

  if (!isSupabaseConfigured()) {
    const contractors = await getContractors();
    localStorage.setItem('qs_contractors', JSON.stringify(contractors.filter(c => c.id !== id)));
    return true;
  }

  if (!isOnline()) {
    const cached = readCache<Contractor[]>(CACHE_KEYS.contractors, []);
    const current = cached.find(c => c.id === id);
    writeCache(CACHE_KEYS.contractors, cached.filter(c => c.id !== id));
    enqueueOp({
      id: generateId(),
      entity: 'contractors',
      action: 'delete',
      payload: { id },
      createdAt: Date.now(),
      expectedUpdatedAt: current?.updatedAt
    });
    return true;
  }

  const { error } = await supabase
    .from('contractors')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting contractor:', error);
    return false;
  }

  const cached = readCache<Contractor[]>(CACHE_KEYS.contractors, []);
  writeCache(CACHE_KEYS.contractors, cached.filter(c => c.id !== id));
  return true;
};

// ============ ITEMS ============

export const getItems = async (): Promise<InventoryItem[]> => {
  if (!isSupabaseConfigured()) {
    const saved = localStorage.getItem('qs_items_v3');
    return saved ? JSON.parse(saved) : [];
  }

  if (!isOnline()) {
    return readCache<InventoryItem[]>(CACHE_KEYS.items, []);
  }

  try {
    const { data, error } = await withRetry(
      async () => {
        const result = await supabase
          .from('items')
          .select(`
            *,
            categories!inner (name)
          `)
          .is('deleted_at', null)  // Filter out soft-deleted items
          .order('name', { ascending: true })
          .limit(DEFAULT_LIMITS.items);
        if (result.error) throw result.error;
        return result;
      },
      'getItems'
    );

    const items = (data || []).map((row: Record<string, unknown>) => 
      dbToItem(row as never, ((row.categories as Record<string, unknown>)?.name as string) || 'General')
    );
    writeCache(CACHE_KEYS.items, items);
    return items;
  } catch (error) {
    console.error('Error fetching items:', error);
    // Return cached data on failure
    return readCache<InventoryItem[]>(CACHE_KEYS.items, []);
  }
};

export const createItem = async (item: Omit<InventoryItem, 'id'>): Promise<InventoryItem | null> => {
  if (isSupabaseConfigured() && hasPendingConflicts()) {
    console.error('Sync conflicts detected. Resolve conflicts before creating items.');
    return null;
  }

  const id = generateId();

  if (!isSupabaseConfigured()) {
    const items = await getItems();
    const newItem: InventoryItem = { ...item, id };
    localStorage.setItem('qs_items_v3', JSON.stringify([...items, newItem]));
    return newItem;
  }

  if (!isOnline()) {
    let categoryId = item.categoryId;
    const cachedCategories = readCache<Category[]>(CACHE_KEYS.categories, []);
    if (!categoryId) {
      const existing = cachedCategories.find(c => c.name === item.category);
      if (existing) {
        categoryId = existing.id;
      } else {
        const newCatId = generateId();
        const newCategory: Category = {
          id: newCatId,
          name: item.category,
          sortOrder: cachedCategories.length,
          updatedAt: Date.now()
        };
        writeCache(CACHE_KEYS.categories, [...cachedCategories, newCategory]);
        enqueueOp({
          id: generateId(),
          entity: 'categories',
          action: 'create',
          payload: { id: newCatId, name: item.category, sort_order: newCategory.sortOrder },
          createdAt: Date.now()
        });
        categoryId = newCatId;
      }
    }

    const newItem: InventoryItem = {
      ...item,
      id,
      categoryId,
      updatedAt: Date.now()
    };
    const cachedItems = readCache<InventoryItem[]>(CACHE_KEYS.items, []);
    writeCache(CACHE_KEYS.items, [...cachedItems, newItem]);
    enqueueOp({
      id: generateId(),
      entity: 'items',
      action: 'create',
      payload: {
        id,
        name: item.name,
        category_id: categoryId,
        unit: item.unit,
        min_stock: item.minStock,
        description: item.description || null,
        created_by: item.createdBy
      },
      createdAt: Date.now()
    });
    return newItem;
  }

  // First, ensure category exists or create it
  let categoryId = item.categoryId;
  if (!categoryId) {
    const categories = await getCategories();
    const existing = categories.find(c => c.name === item.category);
    if (existing) {
      categoryId = existing.id;
    } else {
      const newCat = await createCategory(item.category);
      if (newCat) categoryId = newCat.id;
    }
  }

  const insertData = {
    id,
    name: item.name,
    category_id: categoryId,
    unit: item.unit,
    min_stock: item.minStock,
    description: item.description || null,
    created_by: item.createdBy
  };

  const { data, error } = await supabase
    .from('items')
    .insert(insertData as never)
    .select(`
      *,
      categories!inner (name)
    `)
    .single();

  if (error) {
    console.error('Error creating item:', error);
    return null;
  }

  const created = dbToItem(data as never, ((data as Record<string, unknown>).categories as Record<string, unknown>)?.name as string || 'General');
  const cachedItems = readCache<InventoryItem[]>(CACHE_KEYS.items, []);
  writeCache(CACHE_KEYS.items, [...cachedItems, created]);
  return created;
};

export const updateItem = async (id: string, updates: Partial<InventoryItem>): Promise<boolean> => {
  if (isSupabaseConfigured() && hasPendingConflicts()) {
    console.error('Sync conflicts detected. Resolve conflicts before updating items.');
    return false;
  }

  if (!isSupabaseConfigured()) {
    const items = await getItems();
    const updated = items.map(i => i.id === id ? { ...i, ...updates } : i);
    localStorage.setItem('qs_items_v3', JSON.stringify(updated));
    return true;
  }

  if (!isOnline()) {
    const cached = readCache<InventoryItem[]>(CACHE_KEYS.items, []);
    const current = cached.find(i => i.id === id);
    const updated = cached.map(i => i.id === id ? { ...i, ...updates, updatedAt: Date.now() } : i);
    writeCache(CACHE_KEYS.items, updated);
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.categoryId) dbUpdates.category_id = updates.categoryId;
    if (updates.unit) dbUpdates.unit = updates.unit;
    if (updates.minStock !== undefined) dbUpdates.min_stock = updates.minStock;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    enqueueOp({
      id: generateId(),
      entity: 'items',
      action: 'update',
      payload: { id, ...dbUpdates },
      createdAt: Date.now(),
      expectedUpdatedAt: current?.updatedAt
    });
    return true;
  }

  const dbUpdates: Record<string, unknown> = {};
  if (updates.name) dbUpdates.name = updates.name;
  if (updates.categoryId) dbUpdates.category_id = updates.categoryId;
  if (updates.unit) dbUpdates.unit = updates.unit;
  if (updates.minStock !== undefined) dbUpdates.min_stock = updates.minStock;
  if (updates.description !== undefined) dbUpdates.description = updates.description;

  const { error } = await supabase
    .from('items')
    .update(dbUpdates as never)
    .eq('id', id);

  if (error) {
    console.error('Error updating item:', error);
    return false;
  }

  const cached = readCache<InventoryItem[]>(CACHE_KEYS.items, []);
  const updated = cached.map(i => i.id === id ? { ...i, ...updates, updatedAt: Date.now() } : i);
  writeCache(CACHE_KEYS.items, updated);
  return true;
};

export const deleteItem = async (id: string): Promise<boolean> => {
  if (isSupabaseConfigured() && hasPendingConflicts()) {
    console.error('Sync conflicts detected. Resolve conflicts before deleting items.');
    return false;
  }

  if (!isSupabaseConfigured()) {
    const items = await getItems();
    const transactions = await getTransactions();
    localStorage.setItem('qs_items_v3', JSON.stringify(items.filter(i => i.id !== id)));
    localStorage.setItem('qs_transactions_v3', JSON.stringify(transactions.filter(t => t.itemId !== id)));
    return true;
  }

  if (!isOnline()) {
    const cachedItems = readCache<InventoryItem[]>(CACHE_KEYS.items, []);
    const current = cachedItems.find(i => i.id === id);
    writeCache(CACHE_KEYS.items, cachedItems.filter(i => i.id !== id));
    // DON'T delete transactions from cache here - they might have pending sync operations
    // The server's cascade delete will handle them when the item delete syncs
    // Transactions will be cleaned up from cache after successful sync or on next full reload
    enqueueOp({
      id: generateId(),
      entity: 'items',
      action: 'delete',
      payload: { id },
      createdAt: Date.now(),
      expectedUpdatedAt: current?.updatedAt
    });
    return true;
  }

  // Schema handles cascade delete automatically, no need to delete transactions manually

  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting item:', error);
    return false;
  }

  const cachedItems = readCache<InventoryItem[]>(CACHE_KEYS.items, []);
  writeCache(CACHE_KEYS.items, cachedItems.filter(i => i.id !== id));
  const cachedTx = readCache<Transaction[]>(CACHE_KEYS.transactions, []);
  writeCache(CACHE_KEYS.transactions, cachedTx.filter(t => t.itemId !== id));
  return true;
};

// ============ TRANSACTIONS ============

export interface TransactionQuery {
  itemId?: string;
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
  type?: Transaction['type'];
  user?: string;
  contractorId?: string;
  search?: string;
  searchItemIds?: string[];
}

export const getTransactions = async (query?: TransactionQuery): Promise<Transaction[]> => {
  if (!isSupabaseConfigured()) {
    const saved = localStorage.getItem('qs_transactions_v3');
    let transactions: Transaction[] = saved ? JSON.parse(saved) : [];
    
    if (query?.itemId) {
      transactions = transactions.filter(t => t.itemId === query.itemId);
    }
    if (query?.startDate) {
      const start = query.startDate.getTime();
      transactions = transactions.filter(t => t.timestamp >= start);
    }
    if (query?.endDate) {
      const end = query.endDate.getTime();
      transactions = transactions.filter(t => t.timestamp <= end);
    }
    if (query?.type) {
      transactions = transactions.filter(t => t.type === query.type);
    }
    if (query?.user) {
      transactions = transactions.filter(t => t.user === query.user);
    }
    if (query?.contractorId) {
      transactions = transactions.filter(t => t.contractorId === query.contractorId);
    }
    if (query?.search) {
      const q = query.search.toLowerCase();
      const searchIds = new Set(query.searchItemIds || []);
      transactions = transactions.filter(t =>
        t.reason.toLowerCase().includes(q) ||
        t.user.toLowerCase().includes(q) ||
        searchIds.has(t.itemId)
      );
    }
    
    transactions.sort((a, b) => b.timestamp - a.timestamp);
    
    if (query?.offset) {
      transactions = transactions.slice(query.offset);
    }
    if (query?.limit) {
      transactions = transactions.slice(0, query.limit);
    }
    
    return transactions;
  }

  if (!isOnline()) {
    let transactions = readCache<Transaction[]>(CACHE_KEYS.transactions, []);
    if (query?.itemId) {
      transactions = transactions.filter(t => t.itemId === query.itemId);
    }
    if (query?.startDate) {
      const start = query.startDate.getTime();
      transactions = transactions.filter(t => t.timestamp >= start);
    }
    if (query?.endDate) {
      const end = query.endDate.getTime();
      transactions = transactions.filter(t => t.timestamp <= end);
    }
    if (query?.type) {
      transactions = transactions.filter(t => t.type === query.type);
    }
    if (query?.user) {
      transactions = transactions.filter(t => t.user === query.user);
    }
    if (query?.contractorId) {
      transactions = transactions.filter(t => t.contractorId === query.contractorId);
    }
    if (query?.search) {
      const q = query.search.toLowerCase();
      const searchIds = new Set(query.searchItemIds || []);
      transactions = transactions.filter(t =>
        t.reason.toLowerCase().includes(q) ||
        t.user.toLowerCase().includes(q) ||
        searchIds.has(t.itemId)
      );
    }
    transactions.sort((a, b) => b.timestamp - a.timestamp);
    if (query?.offset) {
      transactions = transactions.slice(query.offset);
    }
    if (query?.limit) {
      transactions = transactions.slice(0, query.limit);
    }
    return transactions;
  }

  // Apply default limit to prevent unbounded queries that crash browsers
  const effectiveLimit = query?.limit || DEFAULT_LIMITS.transactions;
  
  let queryBuilder = supabase
    .from('transactions')
    .select('*')
    .order('created_at', { ascending: false });

  if (query?.itemId) {
    queryBuilder = queryBuilder.eq('item_id', query.itemId);
  }
  if (query?.startDate) {
    queryBuilder = queryBuilder.gte('created_at', query.startDate.toISOString());
  }
  if (query?.endDate) {
    queryBuilder = queryBuilder.lte('created_at', query.endDate.toISOString());
  }
  if (query?.type) {
    queryBuilder = queryBuilder.eq('type', query.type);
  }
  if (query?.user) {
    queryBuilder = queryBuilder.eq('user_name', query.user);
  }
  if (query?.contractorId) {
    queryBuilder = queryBuilder.eq('contractor_id', query.contractorId);
  }
  if (query?.search) {
    const term = `%${query.search}%`;
    const orParts = [
      `reason.ilike.${term}`,
      `user_name.ilike.${term}`
    ];
    if (query.searchItemIds && query.searchItemIds.length > 0) {
      orParts.push(`item_id.in.(${query.searchItemIds.join(',')})`);
    }
    queryBuilder = queryBuilder.or(orParts.join(','));
  }
  
  // Always apply a limit to prevent memory issues
  if (query?.offset) {
    queryBuilder = queryBuilder.range(query.offset, query.offset + effectiveLimit - 1);
  } else {
    queryBuilder = queryBuilder.limit(effectiveLimit);
  }

  const { data, error } = await queryBuilder;

  if (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }

  const results = (data || []).map(dbToTransaction);
  const cached = readCache<Transaction[]>(CACHE_KEYS.transactions, []);
  writeCache(CACHE_KEYS.transactions, mergeById(cached, results));
  return results;
};

export const getTransactionCount = async (query?: TransactionQuery): Promise<number> => {
  if (!isSupabaseConfigured()) {
    const transactions = await getTransactions(query);
    return transactions.length;
  }

  if (!isOnline()) {
    const transactions = await getTransactions(query);
    return transactions.length;
  }

  let queryBuilder = supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true });

  if (query?.itemId) {
    queryBuilder = queryBuilder.eq('item_id', query.itemId);
  }
  if (query?.startDate) {
    queryBuilder = queryBuilder.gte('created_at', query.startDate.toISOString());
  }
  if (query?.endDate) {
    queryBuilder = queryBuilder.lte('created_at', query.endDate.toISOString());
  }
  if (query?.type) {
    queryBuilder = queryBuilder.eq('type', query.type);
  }
  if (query?.user) {
    queryBuilder = queryBuilder.eq('user_name', query.user);
  }
  if (query?.contractorId) {
    queryBuilder = queryBuilder.eq('contractor_id', query.contractorId);
  }
  if (query?.search) {
    const term = `%${query.search}%`;
    const orParts = [
      `reason.ilike.${term}`,
      `user_name.ilike.${term}`
    ];
    if (query.searchItemIds && query.searchItemIds.length > 0) {
      orParts.push(`item_id.in.(${query.searchItemIds.join(',')})`);
    }
    queryBuilder = queryBuilder.or(orParts.join(','));
  }

  const { count, error } = await queryBuilder;

  if (error) {
    console.error('Error counting transactions:', error);
    return 0;
  }

  return count || 0;
};

// Get real-time stock for a single item (for verification before transactions)
export const getItemStockRealtime = async (itemId: string): Promise<{ stock: number; wip: number } | null> => {
  if (!isSupabaseConfigured() || !isOnline()) {
    // Fall back to cached stock levels
    const cached = readCache<Record<string, { stock: number; wip: number }>>(CACHE_KEYS.stock, {});
    return cached[itemId] || null;
  }

  const { data, error } = await supabase
    .from('stock_summary')
    .select('current_quantity, wip_quantity')
    .eq('item_id', itemId)
    .single();

  if (error || !data) {
    return null;
  }

  return {
    stock: (data as { current_quantity: number }).current_quantity || 0,
    wip: (data as { wip_quantity: number }).wip_quantity || 0
  };
};

// Error type for insufficient stock
export class InsufficientStockError extends Error {
  availableStock: number;
  requestedQuantity: number;
  
  constructor(available: number, requested: number) {
    super(`Insufficient stock: ${available} available, ${requested} requested`);
    this.name = 'InsufficientStockError';
    this.availableStock = available;
    this.requestedQuantity = requested;
  }
}

export const createTransaction = async (
  tx: Omit<Transaction, 'id' | 'timestamp'>,
  skipStockCheck: boolean = false
): Promise<Transaction | null> => {
  if (isSupabaseConfigured() && hasPendingConflicts()) {
    console.error('Sync conflicts detected. Resolve conflicts before creating transactions.');
    return null;
  }

  // Validate transaction data
  if (typeof tx.quantity !== 'number' || isNaN(tx.quantity)) {
    throw new Error('Invalid quantity: must be a number');
  }
  if (tx.type !== 'WIP' && tx.quantity <= 0) {
    throw new Error('Invalid quantity: must be positive for IN/OUT transactions');
  }

  const id = generateId();
  const timestamp = Date.now();
  const idempotencyKey = generateIdempotencyKey();

  // For OUT transactions online, use server-side atomic validation
  if (!skipStockCheck && tx.type === 'OUT' && isSupabaseConfigured() && isOnline()) {
    try {
      // Use server-side RPC for atomic stock validation and transaction creation
      const { data, error } = await supabase.rpc('create_out_transaction_safe', {
        p_id: id,
        p_item_id: tx.itemId,
        p_quantity: tx.quantity,
        p_user_name: tx.user,
        p_reason: tx.reason,
        p_signature: tx.signature || null,
        p_location: tx.location || null,
        p_amount: tx.amount || null,
        p_bill_number: tx.billNumber || null,
        p_contractor_id: tx.contractorId || null,
        p_created_by: tx.createdBy || null,
        p_idempotency_key: idempotencyKey  // Pass idempotency key for duplicate prevention
      });

      if (error) {
        console.error('Server RPC error:', error);
        // Fall back to client-side check if RPC not available
      } else if (data && data.length > 0) {
        const result = data[0];
        if (!result.success) {
          // Check if it's a duplicate (idempotent response)
          if (result.error_message?.includes('Duplicate request') && result.transaction_id) {
            if (isDev) console.log('RPC returned existing transaction (idempotent)');
            // Return existing transaction
            const { data: existingData } = await supabase
              .from('transactions')
              .select('*')
              .eq('id', result.transaction_id)
              .single();
            if (existingData) {
              return dbToTransaction(existingData);
            }
          }
          console.error(`Stock validation failed: ${result.available_stock} available`);
          throw new InsufficientStockError(result.available_stock, tx.quantity);
        }
        // Transaction was created by RPC, return it
        const txId = result.transaction_id || id;
        
        // RPC doesn't pass approved_by — set it via update if provided
        if (tx.approvedBy && txId) {
          await supabase.from('transactions').update({ approved_by: tx.approvedBy } as never).eq('id', txId);
        }
        
        const created: Transaction = {
          id: txId,
          itemId: tx.itemId,
          type: tx.type,
          quantity: tx.quantity,
          user: tx.user,
          reason: tx.reason,
          timestamp,
          signature: tx.signature,
          location: tx.location,
          amount: tx.amount,
          billNumber: tx.billNumber,
          contractorId: tx.contractorId,
          approvedBy: tx.approvedBy,
          createdBy: tx.createdBy,
          updatedAt: timestamp
        };
        const cached = readCache<Transaction[]>(CACHE_KEYS.transactions, []);
        writeCache(CACHE_KEYS.transactions, [created, ...cached]);
        return created;
      }
    } catch (rpcError) {
      // If it's an InsufficientStockError, rethrow it
      if (rpcError instanceof InsufficientStockError) {
        throw rpcError;
      }
      // Otherwise fall back to client-side validation
      console.warn('RPC not available, falling back to client-side check');
    }
    
    // Fallback: client-side verification
    const currentStock = await getItemStockRealtime(tx.itemId);
    if (currentStock) {
      const availableStock = currentStock.stock;
      if (availableStock < tx.quantity) {
        console.error(`Stock verification failed: ${availableStock} available, ${tx.quantity} requested`);
        throw new InsufficientStockError(availableStock, tx.quantity);
      }
    }
  }

  if (!isSupabaseConfigured()) {
    const transactions = await getTransactions();
    const newTx: Transaction = { ...tx, id, timestamp };
    localStorage.setItem('qs_transactions_v3', JSON.stringify([newTx, ...transactions]));
    return newTx;
  }

  if (!isOnline()) {
    // Validate stock for offline OUT transactions using cached stock levels
    if (!skipStockCheck && tx.type === 'OUT') {
      const cachedStock = readCache<Record<string, { stock: number; wip: number }>>(CACHE_KEYS.stock, {});
      const itemStock = cachedStock[tx.itemId];
      if (itemStock) {
        const availableStock = itemStock.stock;
        if (availableStock < tx.quantity) {
          console.error(`Offline stock validation failed: ${availableStock} available, ${tx.quantity} requested`);
          throw new InsufficientStockError(availableStock, tx.quantity);
        }
      }
    }
    
    const newTx: Transaction = { ...tx, id, timestamp, updatedAt: Date.now() };
    const cached = readCache<Transaction[]>(CACHE_KEYS.transactions, []);
    writeCache(CACHE_KEYS.transactions, [newTx, ...cached]);
    
    // Update cached stock levels optimistically
    if (tx.type !== 'WIP' || !skipStockCheck) {
      const cachedStock = readCache<Record<string, { stock: number; wip: number }>>(CACHE_KEYS.stock, {});
      if (cachedStock[tx.itemId]) {
        if (tx.type === 'IN') {
          cachedStock[tx.itemId].stock += tx.quantity;
        } else if (tx.type === 'OUT') {
          cachedStock[tx.itemId].stock -= tx.quantity;
        } else if (tx.type === 'WIP') {
          cachedStock[tx.itemId].wip += tx.quantity;
        }
        writeCache(CACHE_KEYS.stock, cachedStock);
      }
    }
    
    enqueueOp({
      id: generateId(),
      entity: 'transactions',
      action: 'create',
      payload: {
        id,
        item_id: tx.itemId,
        type: tx.type,
        quantity: tx.quantity,
        user_name: tx.user,
        reason: tx.reason,
        signature: tx.signature || null,
        location: tx.location || null,
        amount: tx.amount || null,
        bill_number: tx.billNumber || null,
        contractor_id: tx.contractorId || null,
        approved_by: tx.approvedBy || null,
        created_by: tx.createdBy || null,
        idempotency_key: idempotencyKey  // Prevent duplicates on retry
      },
      createdAt: Date.now()
    });
    return newTx;
  }

  // Check idempotency key before insert to prevent duplicates on network retry
  const { data: existingTx } = await supabase
    .from('transactions')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  
  if (existingTx) {
    // Transaction already exists with this idempotency key - return it (idempotent behavior)
    if (isDev) console.log('Duplicate transaction detected via idempotency key, returning existing');
    const existing = dbToTransaction(existingTx);
    return existing;
  }

  const insertData = {
    id,
    item_id: tx.itemId,
    type: tx.type,
    quantity: tx.quantity,
    user_name: tx.user,
    reason: tx.reason,
    signature: tx.signature || null,
    location: tx.location || null,
    amount: tx.amount || null,
    bill_number: tx.billNumber || null,
    contractor_id: tx.contractorId || null,
    approved_by: tx.approvedBy || null,
    created_by: tx.createdBy || null,
    idempotency_key: idempotencyKey  // Prevent duplicates on retry
  };

  const { data, error } = await supabase
    .from('transactions')
    .insert(insertData as never)
    .select()
    .single();

  if (error) {
    console.error('Error creating transaction:', error);
    return null;
  }

  const created = dbToTransaction(data);
  const cached = readCache<Transaction[]>(CACHE_KEYS.transactions, []);
  writeCache(CACHE_KEYS.transactions, [created, ...cached]);
  return created;
};

export const updateTransaction = async (id: string, updates: Partial<Transaction>): Promise<boolean> => {
  if (isSupabaseConfigured() && hasPendingConflicts()) {
    console.error('Sync conflicts detected. Resolve conflicts before updating transactions.');
    return false;
  }

  if (!isSupabaseConfigured()) {
    const transactions = await getTransactions();
    const updated = transactions.map(t => t.id === id ? { ...t, ...updates } : t);
    localStorage.setItem('qs_transactions_v3', JSON.stringify(updated));
    return true;
  }

  if (!isOnline()) {
    const cached = readCache<Transaction[]>(CACHE_KEYS.transactions, []);
    const current = cached.find(t => t.id === id);
    const updated = cached.map(t => t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t);
    writeCache(CACHE_KEYS.transactions, updated);
    const dbUpdates: Record<string, unknown> = {};
    if (updates.quantity !== undefined) dbUpdates.quantity = updates.quantity;
    if (updates.reason !== undefined) dbUpdates.reason = updates.reason;
    if (updates.location !== undefined) dbUpdates.location = updates.location;
    if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
    if (updates.billNumber !== undefined) dbUpdates.bill_number = updates.billNumber;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.itemId !== undefined) dbUpdates.item_id = updates.itemId;
    if (updates.user !== undefined) dbUpdates.user_name = updates.user;
    if (updates.contractorId !== undefined) dbUpdates.contractor_id = updates.contractorId;
    if (updates.approvedBy !== undefined) dbUpdates.approved_by = updates.approvedBy || null;
    enqueueOp({
      id: generateId(),
      entity: 'transactions',
      action: 'update',
      payload: { id, ...dbUpdates },
      createdAt: Date.now(),
      expectedUpdatedAt: current?.updatedAt
    });
    return true;
  }

  const dbUpdates: Record<string, unknown> = {};
  if (updates.quantity !== undefined) dbUpdates.quantity = updates.quantity;
  if (updates.reason !== undefined) dbUpdates.reason = updates.reason;
  if (updates.location !== undefined) dbUpdates.location = updates.location;
  if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
  if (updates.billNumber !== undefined) dbUpdates.bill_number = updates.billNumber;
  if (updates.type !== undefined) dbUpdates.type = updates.type;
  if (updates.itemId !== undefined) dbUpdates.item_id = updates.itemId;
  if (updates.user !== undefined) dbUpdates.user_name = updates.user;
  if (updates.contractorId !== undefined) dbUpdates.contractor_id = updates.contractorId;
  if (updates.approvedBy !== undefined) dbUpdates.approved_by = updates.approvedBy || null;

  const { error } = await supabase
    .from('transactions')
    .update(dbUpdates as never)
    .eq('id', id);

  if (error) {
    console.error('Error updating transaction:', error);
    return false;
  }

  const cached = readCache<Transaction[]>(CACHE_KEYS.transactions, []);
  const updated = cached.map(t => t.id === id ? { ...t, ...updates, updatedAt: Date.now() } : t);
  writeCache(CACHE_KEYS.transactions, updated);
  return true;
};

export const deleteTransaction = async (id: string): Promise<boolean> => {
  if (isSupabaseConfigured() && hasPendingConflicts()) {
    console.error('Sync conflicts detected. Resolve conflicts before deleting transactions.');
    return false;
  }

  if (!isSupabaseConfigured()) {
    const transactions = await getTransactions();
    localStorage.setItem('qs_transactions_v3', JSON.stringify(transactions.filter(t => t.id !== id)));
    return true;
  }

  if (!isOnline()) {
    const cached = readCache<Transaction[]>(CACHE_KEYS.transactions, []);
    const current = cached.find(t => t.id === id);
    writeCache(CACHE_KEYS.transactions, cached.filter(t => t.id !== id));
    enqueueOp({
      id: generateId(),
      entity: 'transactions',
      action: 'delete',
      payload: { id },
      createdAt: Date.now(),
      expectedUpdatedAt: current?.updatedAt
    });
    return true;
  }

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting transaction:', error);
    return false;
  }

  const cached = readCache<Transaction[]>(CACHE_KEYS.transactions, []);
  writeCache(CACHE_KEYS.transactions, cached.filter(t => t.id !== id));
  return true;
};

// ============ SETTINGS ============
// Settings functions removed - Google Sheets sync replaced with pull-based Apps Script approach

// ============ STOCK CALCULATIONS ============

// Get stock levels from database (accurate - uses ALL transactions, not limited array)
export const getStockLevels = async (): Promise<Record<string, { stock: number; wip: number }>> => {
  if (!isSupabaseConfigured()) {
    // Fallback to client-side calculation with all transactions
    const allTransactions = await getTransactions();
    const levels: Record<string, { stock: number; wip: number }> = {};
    
    allTransactions.forEach(t => {
      if (!levels[t.itemId]) {
        levels[t.itemId] = { stock: 0, wip: 0 };
      }
      if (t.type === 'IN') {
        levels[t.itemId].stock += t.quantity;
      } else if (t.type === 'OUT') {
        levels[t.itemId].stock -= t.quantity;
      } else if (t.type === 'WIP') {
        // Handle both positive (add WIP) and negative (reduce WIP) quantities
        levels[t.itemId].wip += t.quantity;
      }
    });
    
    return levels;
  }

  if (!isOnline()) {
    return readCache<Record<string, { stock: number; wip: number }>>(CACHE_KEYS.stock, {});
  }

  try {
    // Use stock_summary table for O(1) stock lookups (maintained by triggers)
    const { data: stockData } = await withRetry(
      async () => {
        const result = await supabase
          .from('stock_summary')
          .select('item_id, current_quantity, wip_quantity');
        if (result.error) throw result.error;
        return result;
      },
      'getStockLevels'
    );

    const levels: Record<string, { stock: number; wip: number }> = {};
    
    (stockData || []).forEach((row: { item_id: string; current_quantity: number; wip_quantity: number }) => {
      levels[row.item_id] = {
        stock: row.current_quantity || 0,
        wip: row.wip_quantity || 0
      };
    });

    writeCache(CACHE_KEYS.stock, levels);
    return levels;
  } catch (error) {
    console.error('Error fetching stock levels:', error);
    // Return cached data on failure
    return readCache<Record<string, { stock: number; wip: number }>>(CACHE_KEYS.stock, {});
  }
};

// Client-side calculation (for backward compatibility and offline mode)
export const calculateStock = (transactions: Transaction[], itemId: string): number => {
  return transactions
    .filter(t => t.itemId === itemId)
    .reduce((sum, t) => {
      if (t.type === 'IN') return sum + t.quantity;
      if (t.type === 'OUT') return sum - t.quantity;
      // WIP does NOT subtract from stock - items are still in inventory but marked as "in progress"
      return sum;
    }, 0);
};

// Calculate Work In Progress quantity for an item
export const calculateWIP = (transactions: Transaction[], itemId: string): number => {
  return transactions
    .filter(t => t.itemId === itemId && t.type === 'WIP')
    .reduce((sum, t) => sum + t.quantity, 0);
};

// Get available stock (total stock minus WIP)
export const calculateAvailableStock = (transactions: Transaction[], itemId: string): number => {
  const totalStock = calculateStock(transactions, itemId);
  const wipQuantity = calculateWIP(transactions, itemId);
  return totalStock - wipQuantity;
};

// Google Sheets push-sync removed — replaced with pull-based Google Apps Script approach
