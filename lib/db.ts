// Database operations layer with Supabase
import { supabase, generateId, isSupabaseConfigured } from './supabase';
import { 
  User, Category, Contractor, InventoryItem, Transaction, AppSettings,
  dbToUser, dbToCategory, dbToContractor, dbToItem, dbToTransaction
} from './database.types';

type PendingEntity = 'users' | 'categories' | 'contractors' | 'items' | 'transactions' | 'settings';
type PendingAction = 'create' | 'update' | 'delete' | 'upsert';

interface PendingOperation {
  id: string;
  entity: PendingEntity;
  action: PendingAction;
  payload: Record<string, unknown>;
  createdAt: number;
  expectedUpdatedAt?: number;
  status?: 'pending' | 'conflict' | 'error';
  error?: string;
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

const readCache = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
};

const writeCache = <T>(key: string, value: T) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore cache write errors
  }
};

const isOnline = (): boolean => {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
};

const getPendingOps = (): PendingOperation[] => {
  return readCache<PendingOperation[]>(CACHE_KEYS.pendingOps, []);
};

const setPendingOps = (ops: PendingOperation[]) => {
  writeCache(CACHE_KEYS.pendingOps, ops);
};

const updatePendingOp = (id: string, updates: Partial<PendingOperation>) => {
  const ops = getPendingOps();
  const updated = ops.map(op => op.id === id ? { ...op, ...updates } : op);
  setPendingOps(updated);
};

const enqueueOp = (op: PendingOperation) => {
  const ops = getPendingOps();
  setPendingOps([...ops, { ...op, status: 'pending' }]);
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

export const processPendingOps = async (): Promise<void> => {
  if (!isSupabaseConfigured() || !isOnline()) return;

  const ops = getPendingOps();
  if (ops.length === 0) return;

  for (const op of ops) {
    if (op.status === 'conflict') {
      console.warn('Pending conflict detected. Manual review required.');
      break;
    }

    if (op.action === 'update' || op.action === 'delete') {
      const currentUpdatedAt = await fetchUpdatedAt(op.entity, op.payload.id as string);
      if (!currentUpdatedAt || (op.expectedUpdatedAt && new Date(currentUpdatedAt).getTime() !== op.expectedUpdatedAt)) {
        updatePendingOp(op.id, { status: 'conflict', error: 'Conflict detected. Record has changed or is missing.' });
        break;
      }
    }

    try {
      if (op.entity === 'items') {
        if (op.action === 'create') {
          const { error } = await supabase.from('items').insert(op.payload as never);
          if (error) throw error;
        } else if (op.action === 'update') {
          const { error } = await supabase.from('items').update(op.payload as never).eq('id', op.payload.id as string);
          if (error) throw error;
        } else if (op.action === 'delete') {
          const { error } = await supabase.from('items').delete().eq('id', op.payload.id as string);
          if (error) throw error;
        }
      }

      if (op.entity === 'categories') {
        if (op.action === 'create') {
          const { error } = await supabase.from('categories').insert(op.payload as never);
          if (error) throw error;
        } else if (op.action === 'update') {
          const { error } = await supabase.from('categories').update(op.payload as never).eq('id', op.payload.id as string);
          if (error) throw error;
        } else if (op.action === 'delete') {
          const { error } = await supabase.from('categories').delete().eq('id', op.payload.id as string);
          if (error) throw error;
        }
      }

      if (op.entity === 'contractors') {
        if (op.action === 'create') {
          const { error } = await supabase.from('contractors').insert(op.payload as never);
          if (error) throw error;
        } else if (op.action === 'update') {
          const { error } = await supabase.from('contractors').update(op.payload as never).eq('id', op.payload.id as string);
          if (error) throw error;
        } else if (op.action === 'delete') {
          const { error } = await supabase.from('contractors').delete().eq('id', op.payload.id as string);
          if (error) throw error;
        }
      }

      if (op.entity === 'transactions') {
        if (op.action === 'create') {
          const { error } = await supabase.from('transactions').insert(op.payload as never);
          if (error) throw error;
        } else if (op.action === 'update') {
          const { error } = await supabase.from('transactions').update(op.payload as never).eq('id', op.payload.id as string);
          if (error) throw error;
        } else if (op.action === 'delete') {
          const { error } = await supabase.from('transactions').delete().eq('id', op.payload.id as string);
          if (error) throw error;
        }
      }

      if (op.entity === 'users') {
        if (op.action === 'create') {
          const { error } = await supabase.from('users').insert(op.payload as never);
          if (error) throw error;
        } else if (op.action === 'update') {
          const { error } = await supabase.from('users').update(op.payload as never).eq('id', op.payload.id as string);
          if (error) throw error;
        } else if (op.action === 'delete') {
          const { error } = await supabase.from('users').delete().eq('id', op.payload.id as string);
          if (error) throw error;
        }
      }

      if (op.entity === 'settings' && op.action === 'upsert') {
        const { error } = await supabase.from('app_settings').upsert(op.payload as never);
        if (error) throw error;
      }

      setPendingOps(getPendingOps().filter(item => item.id !== op.id));
    } catch (err) {
      updatePendingOp(op.id, { status: 'error', error: String(err) });
      break;
    }
  }
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
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching users:', error);
    return [];
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
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching categories:', error);
    return [];
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
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching contractors:', error);
    return [];
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

  const { data, error } = await supabase
    .from('items')
    .select(`
      *,
      categories!inner (name)
    `)
    .order('name', { ascending: true });

  if (error) {
    console.error('Error fetching items:', error);
    return [];
  }

  const items = (data || []).map((row: Record<string, unknown>) => 
    dbToItem(row as never, ((row.categories as Record<string, unknown>)?.name as string) || 'General')
  );
  writeCache(CACHE_KEYS.items, items);
  return items;
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
    const cachedTx = readCache<Transaction[]>(CACHE_KEYS.transactions, []);
    writeCache(CACHE_KEYS.transactions, cachedTx.filter(t => t.itemId !== id));
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
      transactions = transactions.filter(t => t.timestamp >= query.startDate!.getTime());
    }
    if (query?.endDate) {
      transactions = transactions.filter(t => t.timestamp <= query.endDate!.getTime());
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
      transactions = transactions.filter(t => t.timestamp >= query.startDate.getTime());
    }
    if (query?.endDate) {
      transactions = transactions.filter(t => t.timestamp <= query.endDate.getTime());
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
  if (query?.limit) {
    queryBuilder = queryBuilder.limit(query.limit);
  }
  if (query?.offset) {
    queryBuilder = queryBuilder.range(query.offset, query.offset + (query?.limit || 50) - 1);
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

export const createTransaction = async (
  tx: Omit<Transaction, 'id' | 'timestamp'>
): Promise<Transaction | null> => {
  if (isSupabaseConfigured() && hasPendingConflicts()) {
    console.error('Sync conflicts detected. Resolve conflicts before creating transactions.');
    return null;
  }

  const id = generateId();
  const timestamp = Date.now();

  if (!isSupabaseConfigured()) {
    const transactions = await getTransactions();
    const newTx: Transaction = { ...tx, id, timestamp };
    localStorage.setItem('qs_transactions_v3', JSON.stringify([newTx, ...transactions]));
    return newTx;
  }

  if (!isOnline()) {
    const newTx: Transaction = { ...tx, id, timestamp, updatedAt: Date.now() };
    const cached = readCache<Transaction[]>(CACHE_KEYS.transactions, []);
    writeCache(CACHE_KEYS.transactions, [newTx, ...cached]);
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
        created_by: tx.createdBy || null
      },
      createdAt: Date.now()
    });
    return newTx;
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
    created_by: tx.createdBy || null
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

export const getSettings = async (): Promise<AppSettings> => {
  const defaultSettings: AppSettings = { googleSheetUrl: '' };

  if (!isSupabaseConfigured()) {
    const saved = localStorage.getItem('qs_settings');
    return saved ? JSON.parse(saved) : defaultSettings;
  }

  if (!isOnline()) {
    return readCache<AppSettings>(CACHE_KEYS.settings, defaultSettings);
  }

  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .eq('key', 'google_sheet_url')
    .single();

  if (error || !data) {
    return defaultSettings;
  }

  const settings = { googleSheetUrl: (data as Record<string, unknown>).value as string || '' };
  writeCache(CACHE_KEYS.settings, settings);
  return settings;
};

export const saveSettings = async (settings: AppSettings): Promise<boolean> => {
  if (isSupabaseConfigured() && hasPendingConflicts()) {
    console.error('Sync conflicts detected. Resolve conflicts before saving settings.');
    return false;
  }

  if (!isSupabaseConfigured()) {
    localStorage.setItem('qs_settings', JSON.stringify(settings));
    return true;
  }

  if (!isOnline()) {
    writeCache(CACHE_KEYS.settings, settings);
    enqueueOp({
      id: generateId(),
      entity: 'settings',
      action: 'upsert',
      payload: {
        id: 'google_sheet_url',
        key: 'google_sheet_url',
        value: settings.googleSheetUrl
      },
      createdAt: Date.now()
    });
    return true;
  }

  const { error } = await supabase
    .from('app_settings')
    .upsert({
      id: 'google_sheet_url',
      key: 'google_sheet_url',
      value: settings.googleSheetUrl
    } as never);

  if (error) {
    console.error('Error saving settings:', error);
    return false;
  }

  writeCache(CACHE_KEYS.settings, settings);
  return true;
};

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

  // Use database aggregation for accurate stock calculation
  const { data: stockData, error: stockError } = await supabase
    .from('current_stock')
    .select('id, current_quantity, wip_quantity');

  if (stockError || !stockData) {
    console.error('Error fetching stock levels:', stockError);
    return {};
  }

  const levels: Record<string, { stock: number; wip: number }> = {};
  
  stockData.forEach((row: { id: string; current_quantity: number; wip_quantity: number }) => {
    levels[row.id] = {
      stock: row.current_quantity || 0,
      wip: row.wip_quantity || 0
    };
  });

  writeCache(CACHE_KEYS.stock, levels);
  return levels;
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

// ============ SYNC TO GOOGLE SHEETS ============

export const syncToGoogleSheets = async (
  tx: Transaction,
  item: InventoryItem | undefined,
  sheetUrl: string
): Promise<boolean> => {
  if (!sheetUrl) return false;

  try {
    const payload = {
      date: new Date(tx.timestamp).toLocaleString(),
      item: item?.name || 'Deleted',
      folder: item?.category || 'General',
      type: tx.type,
      qty: tx.quantity,
      unit: item?.unit || '',
      user: tx.user,
      reason: tx.reason,
      location: tx.location || '',
      amount: tx.amount || '',
      billNumber: tx.billNumber || ''
    };

    await fetch(sheetUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    return true;
  } catch (err) {
    console.error('Sync error:', err);
    return false;
  }
};
