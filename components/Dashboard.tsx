
import React, { useMemo, useState } from 'react';
import { InventoryItem, Transaction, TransactionType } from '../types';
import { ArrowDown, Timer, Package } from './Icons';
import { PROJECT_CATEGORIES } from '../App';

interface DashboardProps {
  items: InventoryItem[];
  transactions: Transaction[];
  onAction: (type: TransactionType, item: InventoryItem) => void;
  onAddNewItem: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ items, transactions, onAction, onAddNewItem }) => {
  const [filter, setFilter] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Calculated Inventory
  const inventoryStats = useMemo(() => {
    return items.map(item => {
      const itemTx = transactions.filter(t => t.itemId === item.id);
      const totalIn = itemTx.filter(t => t.type === 'IN').reduce((acc, t) => acc + t.quantity, 0);
      const totalOut = itemTx.filter(t => t.type === 'OUT').reduce((acc, t) => acc + t.quantity, 0);
      const totalWip = itemTx.filter(t => t.type === 'WIP').reduce((acc, t) => acc + t.quantity, 0);
      const net = totalIn - totalOut - totalWip;
      return { ...item, net };
    });
  }, [items, transactions]);

  // Grouping by Folder (Category)
  const groupedItems = useMemo(() => {
    const data = inventoryStats.filter(i => 
      i.name.toLowerCase().includes(filter.toLowerCase()) || 
      i.category.toLowerCase().includes(filter.toLowerCase())
    );
    
    // Ensure all requested categories appear in dashboard if they have items
    const groups: Record<string, typeof inventoryStats> = {};
    data.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, [inventoryStats, filter]);

  // All categories that currently have items
  const activeCategories = Object.keys(groupedItems).sort();

  return (
    <div className="space-y-6 pb-20">
      {/* Search Bar */}
      <div className="relative">
        <input 
          type="text"
          placeholder="Search items or folder..."
          className="w-full pl-12 pr-6 py-5 bg-white border-2 border-slate-100 rounded-[28px] focus:border-indigo-500 focus:outline-none shadow-xl shadow-slate-200/50 text-xl font-bold placeholder:text-slate-300"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </div>
      </div>

      {activeCategories.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          {activeCategories.map(cat => (
            <div key={cat} className={`col-span-1 ${expandedCategory === cat ? 'col-span-2 sm:col-span-3' : ''}`}>
              <button 
                onClick={() => setExpandedCategory(expandedCategory === cat ? null : cat)}
                className={`w-full text-left p-5 sm:p-6 rounded-[32px] border-2 transition-all flex flex-col justify-between aspect-square sm:aspect-auto sm:min-h-[140px] ${
                  expandedCategory === cat 
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xl shadow-indigo-200' 
                  : 'bg-white border-slate-100 text-slate-800 hover:border-indigo-200 shadow-sm'
                }`}
              >
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center mb-4 ${expandedCategory === cat ? 'bg-white/20' : 'bg-indigo-50 text-indigo-600'}`}>
                  <Package size={24} />
                </div>
                <div>
                  <h3 className="font-black text-sm sm:text-lg leading-tight uppercase tracking-tight break-words">{cat}</h3>
                  <p className={`text-[10px] font-bold mt-1 uppercase tracking-widest ${expandedCategory === cat ? 'text-white/60' : 'text-slate-400'}`}>
                    {groupedItems[cat].length} ITEMS
                  </p>
                </div>
              </button>

              {expandedCategory === cat && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
                  {groupedItems[cat].map(item => (
                    <div key={item.id} className="bg-white p-6 rounded-[32px] border-2 border-slate-50 shadow-md">
                      <div className="flex justify-between items-start mb-6">
                        <div className="flex-1 pr-4">
                          <h4 className="font-black text-xl text-slate-900 leading-none mb-1">{item.name}</h4>
                          <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{item.unit}</span>
                        </div>
                        <div className="text-right">
                          <div className="text-4xl font-black tabular-nums tracking-tighter text-slate-900 leading-none">
                            {item.net}
                          </div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">NET STOCK</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => onAction('OUT', item)}
                          className="flex-[2] py-4 bg-slate-900 text-white rounded-2xl font-black text-xs active:scale-95 transition-all uppercase tracking-widest"
                        >
                          TAKE OUT
                        </button>
                        <button 
                          onClick={() => onAction('IN', item)}
                          className="flex-1 py-4 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center active:scale-95 transition-all"
                        >
                          <ArrowDown size={22} />
                        </button>
                        <button 
                          onClick={() => onAction('WIP', item)}
                          className="flex-1 py-4 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center active:scale-95 transition-all"
                        >
                          <Timer size={22} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="py-24 text-center bg-white rounded-[40px] border-4 border-dashed border-slate-100">
          <div className="bg-slate-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200">
            <Package size={48} />
          </div>
          <h3 className="text-3xl font-black text-slate-900 mb-2">Inventory Empty</h3>
          <p className="text-slate-400 mb-10 text-lg font-medium italic">Receive your first delivery to start folders.</p>
          <button 
            onClick={onAddNewItem}
            className="bg-indigo-600 text-white px-12 py-6 rounded-3xl font-black text-xl shadow-2xl shadow-indigo-100 active:scale-95 transition-all"
          >
            + RECEIVE NEW STOCK
          </button>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
