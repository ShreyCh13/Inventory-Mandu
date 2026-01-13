
import React, { useState, useEffect, useCallback } from 'react';
import { InventoryItem, Transaction, TransactionType, AppSettings } from './types';
import Dashboard from './components/Dashboard';
import TransactionForm from './components/TransactionForm';
import ItemManager from './components/ItemManager';
import HistoryLog from './components/HistoryLog';
import SyncSettings from './components/SyncSettings';
import { Plus, Minus, Package, History, LayoutDashboard, Cloud, Settings } from './components/Icons';

export const PROJECT_CATEGORIES = [
  "Paint", "Polish", "POP", "Electrical", "Lighting", 
  "Civil Consumables", "Plumbing", "Fire", "HVAC", 
  "Wood", "Carpenter", "Landscaping", "Water bodies", 
  "Pathhar", "Wire Outdoor Electrical", "Sanitary", 
  "Kitchen", "Lift", "Civil (fawda, tasla etc)", "Miscellaneous"
];

const App: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>(() => {
    const saved = localStorage.getItem('qs_items_v3');
    return saved ? JSON.parse(saved) : [];
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('qs_transactions_v3');
    return saved ? JSON.parse(saved) : [];
  });

  const [settings, setSettings] = useState<AppSettings>(() => {
    const saved = localStorage.getItem('qs_settings');
    return saved ? JSON.parse(saved) : { googleSheetUrl: '' };
  });

  const [activeTab, setActiveTab] = useState<'dashboard' | 'items' | 'history'>('dashboard');
  const [showTransactionModal, setShowTransactionModal] = useState<{type: TransactionType, item?: InventoryItem} | null>(null);
  const [showSyncSettings, setShowSyncSettings] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    localStorage.setItem('qs_items_v3', JSON.stringify(items));
    localStorage.setItem('qs_transactions_v3', JSON.stringify(transactions));
    localStorage.setItem('qs_settings', JSON.stringify(settings));
  }, [items, transactions, settings]);

  const syncToSheets = useCallback(async (txList: Transaction[]) => {
    if (!settings.googleSheetUrl) return;
    
    setIsSyncing(true);
    const unsynced = txList.filter(t => !t.synced);
    
    for (const tx of unsynced) {
      const item = items.find(i => i.id === tx.itemId);
      try {
        const payload = {
          date: new Date(tx.timestamp).toLocaleString(),
          item: item?.name || 'Deleted',
          folder: item?.category || 'General',
          type: tx.type,
          qty: tx.quantity,
          unit: item?.unit || '',
          user: tx.user,
          reason: tx.reason
        };

        const response = await fetch(settings.googleSheetUrl, {
          method: 'POST',
          mode: 'no-cors', // Standard for Google Apps Script Web Apps
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        // Mark as synced locally
        setTransactions(prev => prev.map(p => p.id === tx.id ? { ...p, synced: true } : p));
      } catch (err) {
        console.error("Sync error", err);
      }
    }
    setIsSyncing(false);
  }, [settings.googleSheetUrl, items]);

  const addTransaction = (t: Omit<Transaction, 'id' | 'timestamp' | 'synced'>, newItem?: Omit<InventoryItem, 'id'>) => {
    let finalItemId = t.itemId;

    if (newItem) {
      const createdItem: InventoryItem = { ...newItem, id: Math.random().toString(36).substr(2, 9) };
      setItems(prev => [...prev, createdItem]);
      finalItemId = createdItem.id;
    }

    const newTransaction: Transaction = {
      ...t,
      itemId: finalItemId,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      synced: false
    };
    
    const updatedTransactions = [newTransaction, ...transactions];
    setTransactions(updatedTransactions);
    setShowTransactionModal(null);

    // Immediate Sync Attempt
    if (settings.googleSheetUrl) {
      syncToSheets(updatedTransactions);
    }
  };

  const deleteItem = (id: string) => {
    setItems(prev => prev.filter(i => i.id !== id));
    setTransactions(prev => prev.filter(t => t.itemId !== id));
  };

  const pendingSyncCount = transactions.filter(t => !t.synced).length;

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
        <button onClick={() => setShowSyncSettings(true)} className="p-4 rounded-2xl text-slate-400 hover:bg-slate-100 md:mt-auto md:mb-10 relative">
          <Settings size={28} />
          {pendingSyncCount > 0 && <span className="absolute top-3 right-3 w-3 h-3 bg-amber-500 rounded-full border-2 border-white"></span>}
        </button>
      </nav>

      <main className="max-w-5xl mx-auto p-4 sm:p-6 md:p-12">
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8 sm:mb-12">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className={`w-3 h-3 rounded-full ${isSyncing ? 'bg-indigo-500 animate-pulse' : pendingSyncCount > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`}></div>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2">
                Live Cloud Sync {isSyncing ? '(Pushing...)' : pendingSyncCount > 0 ? `(${pendingSyncCount} Pending)` : '(Secure)'}
              </p>
            </div>
            <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight">
              {activeTab === 'dashboard' && 'Folders'}
              {activeTab === 'items' && 'Catalog'}
              {activeTab === 'history' && 'Logs'}
            </h1>
          </div>
          <div className="flex gap-3">
             {pendingSyncCount > 0 && (
               <button onClick={() => syncToSheets(transactions)} className="bg-amber-100 text-amber-700 px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-amber-200 transition-all flex items-center gap-2">
                 <Cloud size={18} /> Sync Now
               </button>
             )}
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
            onAction={(type, item) => setShowTransactionModal({ type, item })}
            onAddNewItem={() => setShowTransactionModal({ type: 'IN' })}
          />
        )}
        {activeTab === 'items' && <ItemManager items={items} onAdd={() => {}} onDelete={deleteItem} />}
        {activeTab === 'history' && <HistoryLog transactions={transactions} items={items} onExport={() => {}} />}
      </main>

      {showTransactionModal && (
        <TransactionForm 
          type={showTransactionModal.type}
          initialItem={showTransactionModal.item}
          items={items}
          onClose={() => setShowTransactionModal(null)}
          onSubmit={addTransaction}
        />
      )}

      {showSyncSettings && (
        <SyncSettings 
          settings={settings} 
          onSave={(s) => { setSettings(s); setShowSyncSettings(false); }} 
          onClose={() => setShowSyncSettings(false)} 
        />
      )}
    </div>
  );
};

export default App;
