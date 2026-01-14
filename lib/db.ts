// Database operations layer with Supabase
import { supabase, generateId, isSupabaseConfigured } from './supabase';
import { 
  User, Category, InventoryItem, Transaction, AppSettings,
  dbToUser, dbToCategory, dbToItem, dbToTransaction
} from './database.types';

// ============ USERS ============

export const getUsers = async (): Promise<User[]> => {
  if (!isSupabaseConfigured()) {
    const saved = localStorage.getItem('qs_users');
    return saved ? JSON.parse(saved) : [];
  }

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }

  return (data || []).map(dbToUser);
};

export const createUser = async (user: Omit<User, 'id' | 'createdAt'>): Promise<User | null> => {
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

  const { data, error } = await supabase
    .from('users')
    .insert(newUser as never)
    .select()
    .single();

  if (error) {
    console.error('Error creating user:', error);
    return null;
  }

  return dbToUser(data);
};

export const updateUser = async (id: string, updates: Partial<User>): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    const users = await getUsers();
    const updated = users.map(u => u.id === id ? { ...u, ...updates } : u);
    localStorage.setItem('qs_users', JSON.stringify(updated));
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

  return true;
};

export const deleteUser = async (id: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    const users = await getUsers();
    localStorage.setItem('qs_users', JSON.stringify(users.filter(u => u.id !== id)));
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

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }

  return (data || []).map(dbToCategory);
};

export const createCategory = async (name: string): Promise<Category | null> => {
  const categories = await getCategories();
  const sortOrder = categories.length;

  if (!isSupabaseConfigured()) {
    const names = categories.map(c => c.name);
    names.push(name);
    localStorage.setItem('qs_categories', JSON.stringify(names.sort()));
    return { id: name, name, sortOrder };
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

  return dbToCategory(data);
};

export const updateCategory = async (id: string, newName: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    const categories = await getCategories();
    const names = categories.map(c => c.id === id ? newName : c.name);
    localStorage.setItem('qs_categories', JSON.stringify(names.sort()));
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

  return true;
};

export const deleteCategory = async (id: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    const categories = await getCategories();
    const names = categories.filter(c => c.id !== id).map(c => c.name);
    localStorage.setItem('qs_categories', JSON.stringify(names));
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

  return true;
};

// ============ ITEMS ============

export const getItems = async (): Promise<InventoryItem[]> => {
  if (!isSupabaseConfigured()) {
    const saved = localStorage.getItem('qs_items_v3');
    return saved ? JSON.parse(saved) : [];
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

  return (data || []).map((row: Record<string, unknown>) => 
    dbToItem(row as never, ((row.categories as Record<string, unknown>)?.name as string) || 'General')
  );
};

export const createItem = async (item: Omit<InventoryItem, 'id'>): Promise<InventoryItem | null> => {
  const id = generateId();

  if (!isSupabaseConfigured()) {
    const items = await getItems();
    const newItem: InventoryItem = { ...item, id };
    localStorage.setItem('qs_items_v3', JSON.stringify([...items, newItem]));
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

  return dbToItem(data as never, ((data as Record<string, unknown>).categories as Record<string, unknown>)?.name as string || 'General');
};

export const updateItem = async (id: string, updates: Partial<InventoryItem>): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    const items = await getItems();
    const updated = items.map(i => i.id === id ? { ...i, ...updates } : i);
    localStorage.setItem('qs_items_v3', JSON.stringify(updated));
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

  return true;
};

export const deleteItem = async (id: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    const items = await getItems();
    const transactions = await getTransactions();
    localStorage.setItem('qs_items_v3', JSON.stringify(items.filter(i => i.id !== id)));
    localStorage.setItem('qs_transactions_v3', JSON.stringify(transactions.filter(t => t.itemId !== id)));
    return true;
  }

  // Delete transactions first (cascade)
  await supabase.from('transactions').delete().eq('item_id', id);

  const { error } = await supabase
    .from('items')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting item:', error);
    return false;
  }

  return true;
};

// ============ TRANSACTIONS ============

export interface TransactionQuery {
  itemId?: string;
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
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

  return (data || []).map(dbToTransaction);
};

export const getTransactionCount = async (itemId?: string): Promise<number> => {
  if (!isSupabaseConfigured()) {
    const transactions = await getTransactions({ itemId });
    return transactions.length;
  }

  let queryBuilder = supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true });

  if (itemId) {
    queryBuilder = queryBuilder.eq('item_id', itemId);
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
  const id = generateId();
  const timestamp = Date.now();

  if (!isSupabaseConfigured()) {
    const transactions = await getTransactions();
    const newTx: Transaction = { ...tx, id, timestamp };
    localStorage.setItem('qs_transactions_v3', JSON.stringify([newTx, ...transactions]));
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
    created_by: tx.createdBy
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

  return dbToTransaction(data);
};

export const updateTransaction = async (id: string, updates: Partial<Transaction>): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    const transactions = await getTransactions();
    const updated = transactions.map(t => t.id === id ? { ...t, ...updates } : t);
    localStorage.setItem('qs_transactions_v3', JSON.stringify(updated));
    return true;
  }

  const dbUpdates: Record<string, unknown> = {};
  if (updates.quantity !== undefined) dbUpdates.quantity = updates.quantity;
  if (updates.reason !== undefined) dbUpdates.reason = updates.reason;
  if (updates.location !== undefined) dbUpdates.location = updates.location;
  if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
  if (updates.billNumber !== undefined) dbUpdates.bill_number = updates.billNumber;

  const { error } = await supabase
    .from('transactions')
    .update(dbUpdates as never)
    .eq('id', id);

  if (error) {
    console.error('Error updating transaction:', error);
    return false;
  }

  return true;
};

export const deleteTransaction = async (id: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    const transactions = await getTransactions();
    localStorage.setItem('qs_transactions_v3', JSON.stringify(transactions.filter(t => t.id !== id)));
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

  return true;
};

// ============ SETTINGS ============

export const getSettings = async (): Promise<AppSettings> => {
  const defaultSettings: AppSettings = { googleSheetUrl: '' };

  if (!isSupabaseConfigured()) {
    const saved = localStorage.getItem('qs_settings');
    return saved ? JSON.parse(saved) : defaultSettings;
  }

  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .eq('key', 'google_sheet_url')
    .single();

  if (error || !data) {
    return defaultSettings;
  }

  return { googleSheetUrl: (data as Record<string, unknown>).value as string || '' };
};

export const saveSettings = async (settings: AppSettings): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    localStorage.setItem('qs_settings', JSON.stringify(settings));
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

  return true;
};

// ============ STOCK CALCULATIONS ============

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
