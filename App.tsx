import React, { useState, useEffect, useCallback, useRef } from 'react';
import { InventoryItem, Transaction, TransactionType, AppSettings, AuthSession, Category } from './types';
import { supabase, isSupabaseConfigured, subscribeToTable } from './lib/supabase';
import * as db from './lib/db';
import Dashboard from './components/Dashboard';
import TransactionForm from './components/TransactionForm';
import ItemManager from './components/ItemManager';
import HistoryLog from './components/HistoryLog';
import SyncSettings from './components/SyncSettings';
import LoginPage from './components/LoginPage';
import UserManager from './components/UserManager';
import CategoryManager from './components/CategoryManager';
import { Plus, Minus, Package, History, LayoutDashboard, Cloud, Settings, User, LogOut, Users, Folder } from './components/Icons';

// Default categories - will be loaded from database
export const DEFAULT_CATEGORIES = [
  "Paint", "Polish", "POP", "Electrical", "Lighting", 
  "Civil Consumables", "Plumbing", "Fire", "HVAC", 
  "Wood", "Carpenter", "Landscaping", "Water bodies", 
  "Pathhar", "Wire Outdoor Electrical", "Sanitary", 
  "Kitchen", "Lift", "Civil (fawda, tasla etc)", "Miscellaneous"
];

const App: React.FC = () => {
  // Authentication state
  const [session, setSession] = useState<AuthSession | null>(() => {
    const saved = localStorage.getItem('qs_session');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Check if session is expired (24 hours)
      if (Date.now() - parsed.loginAt > 24 * 60 * 60 * 1000) {
        localStorage.removeItem('qs_session');
        return null;
      }
      return parsed;
    }
    return null;
  });

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ googleSheetUrl: '' });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'items' | 'history' | 'users' | 'categories'>('dashboard');
  const [showTransactionModal, setShowTransactionModal] = useState<{type: TransactionType, item?: InventoryItem} | null>(null);
  const [showSyncSettings, setShowSyncSettings] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const subscriptionsRef = useRef<(() => void)[]>([]);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const [loadedItems, loadedTransactions, loadedCategories, loadedSettings] = await Promise.all([
          db.getItems(),
          db.getTransactions({ limit: 500 }), // Load recent 500 for performance
          db.getCategories(),
          db.getSettings()
        ]);

        setItems(loadedItems);
        setTransactions(loadedTransactions);
        setCategories(loadedCategories.length > 0 ? loadedCategories.map(c => c.name) : DEFAULT_CATEGORIES);
        setSettings(loadedSettings);
        setLastSync(new Date());
      } catch (error) {
        console.error('Error loading data:', error);
        setIsOnline(false);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  // Set up real-time subscriptions
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    // Subscribe to items changes
    const itemsChannel = subscribeToTable<InventoryItem>('items', async (payload) => {
      console.log('Items changed:', payload.eventType);
      // Reload items to get fresh data with category names
      const freshItems = await db.getItems();
      setItems(freshItems);
      setLastSync(new Date());
    });

    // Subscribe to transactions changes
    const transactionsChannel = subscribeToTable<Transaction>('transactions', async (payload) => {
      console.log('Transactions changed:', payload.eventType);
      // Reload recent transactions
      const freshTransactions = await db.getTransactions({ limit: 500 });
      setTransactions(freshTransactions);
      setLastSync(new Date());
    });

    // Subscribe to categories changes
    const categoriesChannel = subscribeToTable<Category>('categories', async () => {
      console.log('Categories changed');
      const freshCategories = await db.getCategories();
      setCategories(freshCategories.map(c => c.name));
      setLastSync(new Date());
    });

    // Store cleanup functions
    subscriptionsRef.current = [
      () => supabase.removeChannel(itemsChannel),
      () => supabase.removeChannel(transactionsChannel),
      () => supabase.removeChannel(categoriesChannel)
    ];

    return () => {
      subscriptionsRef.current.forEach(cleanup => cleanup());
    };
  }, []);

  // Connection status monitoring
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleLogin = (newSession: AuthSession) => {
    setSession(newSession);
    localStorage.setItem('qs_session', JSON.stringify(newSession));
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem('qs_session');
    setShowUserMenu(false);
  };

  const syncToSheets = useCallback(async (tx: Transaction) => {
    if (!settings.googleSheetUrl) return;
    
    setIsSyncing(true);
    const item = items.find(i => i.id === tx.itemId);
    await db.syncToGoogleSheets(tx, item, settings.googleSheetUrl);
    setIsSyncing(false);
  }, [settings.googleSheetUrl, items]);

  const addTransaction = async (
    t: Omit<Transaction, 'id' | 'timestamp'>, 
    newItem?: Omit<InventoryItem, 'id'>
  ) => {
    let finalItemId = t.itemId;

    // Create new item if provided
    if (newItem) {
      const createdItem = await db.createItem({
        ...newItem,
        categoryId: '',
        createdBy: session?.user.id || ''
      });
      if (createdItem) {
        setItems(prev => [...prev, createdItem]);
        finalItemId = createdItem.id;
      }
    }

    // Create transaction
    const newTransaction = await db.createTransaction({
      ...t,
      itemId: finalItemId
    });

    if (newTransaction) {
      setTransactions(prev => [newTransaction, ...prev]);
      setShowTransactionModal(null);

      // Sync to Google Sheets
      if (settings.googleSheetUrl) {
        syncToSheets(newTransaction);
      }
    }
  };

  const deleteItem = async (id: string) => {
    const success = await db.deleteItem(id);
    if (success) {
      setItems(prev => prev.filter(i => i.id !== id));
      setTransactions(prev => prev.filter(t => t.itemId !== id));
    }
  };

  const handleUpdateTransaction = async (id: string, updates: Partial<Transaction>) => {
    const success = await db.updateTransaction(id, updates);
    if (success) {
      setTransactions(prev => prev.map(t => 
        t.id === id ? { ...t, ...updates } : t
      ));
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    const success = await db.deleteTransaction(id);
    if (success) {
      setTransactions(prev => prev.filter(t => t.id !== id));
    }
  };

  const updateItemCategory = async (itemId: string, newCategory: string) => {
    // Find or create category ID
    const allCategories = await db.getCategories();
    let categoryId = allCategories.find(c => c.name === newCategory)?.id;
    
    if (!categoryId) {
      const newCat = await db.createCategory(newCategory);
      if (newCat) categoryId = newCat.id;
    }

    if (categoryId) {
      const success = await db.updateItem(itemId, { categoryId, category: newCategory });
      if (success) {
        setItems(prev => prev.map(item => 
          item.id === itemId ? { ...item, category: newCategory, categoryId } : item
        ));
      }
    }
  };

  const handleUpdateCategories = async (newCategories: string[]) => {
    // Sync categories with database
    const existingCategories = await db.getCategories();
    const existingNames = existingCategories.map(c => c.name);
    
    // Add new categories
    for (const name of newCategories) {
      if (!existingNames.includes(name)) {
        await db.createCategory(name);
      }
    }
    
    // Delete removed categories
    for (const cat of existingCategories) {
      if (!newCategories.includes(cat.name)) {
        await db.deleteCategory(cat.id);
      }
    }
    
    setCategories(newCategories);
  };

  const handleSaveSettings = async (newSettings: AppSettings) => {
    await db.saveSettings(newSettings);
    setSettings(newSettings);
    setShowSyncSettings(false);
  };

  // Show login page if not authenticated
  if (!session) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Package size={32} className="text-white" />
          </div>
          <p className="text-slate-400 font-bold">Loading inventory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28 md:pb-0 md:pl-24">
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white border-t border-slate-200 flex items-center justify-around z-50 md:top-0 md:left-0 md:h-full md:w-24 md:flex-col md:justify-start md:pt-10 md:border-r md:border-t-0 shadow-2xl md:shadow-none">
        <button onClick={() => setActiveTab('dashboard')} className={`p-4 rounded-2xl transition-all ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-xl scale-110' : 'text-slate-400 hover:bg-slate-100'}`}>
          <LayoutDashboard size={28} />
        </button>
        <button onClick={() => setActiveTab('items')} className={`p-4 rounded-2xl transition-all md:mt-6 ${activeTab === 'items' ? 'bg-indigo-600 text-white shadow-xl scale-110' : 'text-slate-400 hover:bg-slate-100'}`}>
          <Package size={28} />
        </button>
        <button onClick={() => setActiveTab('history')} className={`p-4 rounded-2xl transition-all md:mt-6 ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-xl scale-110' : 'text-slate-400 hover:bg-slate-100'}`}>
          <History size={28} />
        </button>
        {/* Admin-only Tabs */}
        {session.user.role === 'admin' && (
          <>
            <button onClick={() => setActiveTab('users')} className={`p-4 rounded-2xl transition-all md:mt-6 ${activeTab === 'users' ? 'bg-purple-600 text-white shadow-xl scale-110' : 'text-slate-400 hover:bg-slate-100'}`}>
              <Users size={28} />
            </button>
            <button onClick={() => setActiveTab('categories')} className={`p-4 rounded-2xl transition-all md:mt-2 ${activeTab === 'categories' ? 'bg-purple-600 text-white shadow-xl scale-110' : 'text-slate-400 hover:bg-slate-100'}`}>
              <Folder size={28} />
            </button>
          </>
        )}
        <button onClick={() => setShowSyncSettings(true)} className="p-4 rounded-2xl text-slate-400 hover:bg-slate-100 md:mt-auto relative">
          <Settings size={28} />
        </button>
        {/* User Menu */}
        <div className="relative md:mb-6">
          <button 
            onClick={() => setShowUserMenu(!showUserMenu)} 
            className="p-4 rounded-2xl text-slate-400 hover:bg-slate-100 transition-all"
          >
            <User size={28} />
          </button>
          {showUserMenu && (
            <div className="absolute bottom-full left-0 mb-2 md:left-full md:bottom-0 md:top-auto md:mb-0 md:ml-2 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 min-w-[200px] z-[100]">
              <div className="pb-3 mb-3 border-b border-slate-100">
                <p className="font-bold text-slate-900">{session.user.displayName}</p>
                <p className="text-xs text-slate-500">@{session.user.username}</p>
                <span className={`inline-block mt-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${session.user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                  {session.user.role}
                </span>
              </div>
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors text-sm font-semibold"
              >
                <LogOut size={18} />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </nav>

      <main className="max-w-5xl mx-auto p-4 sm:p-6 md:p-12">
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8 sm:mb-12">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className={`w-3 h-3 rounded-full ${
                !isOnline ? 'bg-red-500' :
                isSyncing ? 'bg-indigo-500 animate-pulse' : 
                'bg-emerald-500'
              }`}></div>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                {!isOnline ? 'Offline Mode' :
                 isSyncing ? 'Syncing...' : 
                 isSupabaseConfigured() ? 'Real-Time Sync Active' : 'Local Mode'}
                {lastSync && isOnline && (
                  <span className="text-slate-300">
                    • Updated {lastSync.toLocaleTimeString()}
                  </span>
                )}
              </p>
            </div>
            <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight">
              {activeTab === 'dashboard' && 'Folders'}
              {activeTab === 'items' && 'Catalog'}
              {activeTab === 'history' && 'Logs'}
              {activeTab === 'users' && 'Users'}
              {activeTab === 'categories' && 'Categories'}
            </h1>
          </div>
          <div className="flex gap-3">
            {activeTab === 'dashboard' && (
              <>
                <button onClick={() => setShowTransactionModal({ type: 'OUT' })} className="flex-1 sm:flex-none flex items-center justify-center gap-3 bg-red-500 text-white px-8 py-5 rounded-3xl font-black shadow-xl shadow-red-100 hover:bg-red-600 active:scale-95 transition-all text-xl">
                  <Minus size={24} />
                  Use Stock
                </button>
                <button onClick={() => setShowTransactionModal({ type: 'IN' })} className="flex-1 sm:flex-none flex items-center justify-center gap-3 bg-emerald-500 text-white px-8 py-5 rounded-3xl font-black shadow-xl shadow-emerald-100 hover:bg-emerald-600 active:scale-95 transition-all text-xl">
                  <Plus size={24} />
                  Receive Stock
                </button>
              </>
            )}
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <Dashboard 
            items={items} 
            transactions={transactions}
            session={session}
            categories={categories}
            onAction={(type, item) => setShowTransactionModal({ type, item })}
            onAddNewItem={() => setShowTransactionModal({ type: 'IN' })}
            onUpdateTransaction={handleUpdateTransaction}
            onDeleteTransaction={handleDeleteTransaction}
          />
        )}
        {activeTab === 'items' && <ItemManager items={items} transactions={transactions} />}
        {activeTab === 'history' && (
          <HistoryLog 
            transactions={transactions} 
            items={items} 
            session={session} 
            onExport={() => {}} 
            onUpdateTransaction={handleUpdateTransaction} 
            onDeleteTransaction={handleDeleteTransaction} 
          />
        )}
        {activeTab === 'users' && session.user.role === 'admin' && (
          <UserManager currentUserId={session.user.id} />
        )}
        {activeTab === 'categories' && session.user.role === 'admin' && (
          <CategoryManager 
            categories={categories} 
            items={items}
            onUpdate={handleUpdateCategories}
            onUpdateItemCategory={updateItemCategory}
          />
        )}
      </main>

      {showTransactionModal && (
        <TransactionForm 
          type={showTransactionModal.type}
          initialItem={showTransactionModal.item}
          items={items}
          transactions={transactions}
          categories={categories}
          session={session}
          onClose={() => setShowTransactionModal(null)}
          onSubmit={addTransaction}
        />
      )}

      {showSyncSettings && (
        <SyncSettings 
          settings={settings} 
          onSave={handleSaveSettings} 
          onClose={() => setShowSyncSettings(false)} 
        />
      )}
    </div>
  );
};

export default App;
