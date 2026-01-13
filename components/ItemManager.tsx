import React, { useMemo, useState } from 'react';
import { InventoryItem, Transaction } from '../types';
import { Package } from './Icons';
import { calculateStock } from '../lib/db';

interface ItemManagerProps {
  items: InventoryItem[];
  transactions: Transaction[];
}

const ItemManager: React.FC<ItemManagerProps> = ({ items, transactions }) => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Get the most recent location for an item
  const getLastLocation = (itemId: string) => {
    const itemTx = transactions
      .filter(t => t.itemId === itemId && t.location)
      .sort((a, b) => b.timestamp - a.timestamp);
    return itemTx.length > 0 ? itemTx[0].location : '—';
  };

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!searchQuery) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(item => 
      item.name.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query)
    );
  }, [items, searchQuery]);

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, InventoryItem[]> = {};
    filteredItems.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, [filteredItems]);

  const categories = Object.keys(groupedItems).sort();

  // Summary stats
  const totalItems = items.length;
  const totalCategories = new Set(items.map(i => i.category)).size;
  const lowStockItems = items.filter(item => {
    const stock = calculateStock(transactions, item.id);
    return stock <= item.minStock && stock > 0;
  }).length;
  const outOfStock = items.filter(item => calculateStock(transactions, item.id) <= 0).length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-5 border-2 border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Items</p>
          <p className="text-3xl font-black text-slate-900 tabular-nums">{totalItems}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border-2 border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Categories</p>
          <p className="text-3xl font-black text-indigo-600 tabular-nums">{totalCategories}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border-2 border-amber-100">
          <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Low Stock</p>
          <p className="text-3xl font-black text-amber-600 tabular-nums">{lowStockItems}</p>
        </div>
        <div className="bg-white rounded-2xl p-5 border-2 border-red-100">
          <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Out of Stock</p>
          <p className="text-3xl font-black text-red-500 tabular-nums">{outOfStock}</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search items or categories..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-6 py-4 bg-white border-2 border-slate-100 rounded-2xl focus:border-indigo-500 outline-none text-lg font-medium placeholder:text-slate-300"
        />
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
      </div>

      {categories.length > 0 ? (
        categories.map(category => (
          <div key={category} className="bg-white rounded-[32px] border-2 border-slate-100 overflow-hidden shadow-sm">
            {/* Category Header */}
            <button
              onClick={() => setExpandedCategory(expandedCategory === category ? null : category)}
              className="w-full flex items-center justify-between p-6 hover:bg-slate-50/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                  expandedCategory === category ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-600'
                }`}>
                  <Package size={24} />
                </div>
                <div className="text-left">
                  <h3 className="font-black text-xl text-slate-900 uppercase tracking-tight">{category}</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {groupedItems[category].length} ITEMS
                  </p>
                </div>
              </div>
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform ${
                expandedCategory === category ? 'rotate-180 bg-indigo-100' : 'bg-slate-100'
              }`}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6"/>
                </svg>
              </div>
            </button>

            {/* Items Table */}
            {expandedCategory === category && (
              <div className="border-t-2 border-slate-100 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50/80">
                      <tr>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Item Name</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Current Qty</th>
                        <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Last Location</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {groupedItems[category].map(item => {
                        const currentStock = calculateStock(transactions, item.id);
                        const location = getLastLocation(item.id);
                        return (
                          <tr key={item.id} className="group hover:bg-slate-50/50 transition-colors">
                            <td className="px-6 py-5">
                              <div className="font-bold text-slate-900 text-lg leading-tight">{item.name}</div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">
                                {item.unit}
                              </div>
                            </td>
                            <td className="px-6 py-5 text-center">
                              <span className={`inline-block text-2xl font-black tabular-nums ${
                                currentStock <= 0 ? 'text-red-500' : currentStock <= item.minStock ? 'text-amber-500' : 'text-emerald-600'
                              }`}>
                                {currentStock}
                              </span>
                            </td>
                            <td className="px-6 py-5">
                              <span className="text-sm font-medium text-slate-600">{location}</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ))
      ) : (
        <div className="py-24 text-center bg-white rounded-[40px] border-4 border-dashed border-slate-100">
          <div className="bg-slate-50 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-200">
            <Package size={48} />
          </div>
          <h3 className="text-3xl font-black text-slate-900 mb-2">
            {searchQuery ? 'No Items Found' : 'No Items Yet'}
          </h3>
          <p className="text-slate-400 text-lg font-medium italic">
            {searchQuery ? 'Try a different search term' : 'Use "Receive Stock" on the Dashboard to add items.'}
          </p>
        </div>
      )}
      
      <div className="bg-amber-50 border-2 border-amber-100 p-6 rounded-3xl text-amber-800">
        <p className="text-sm font-bold leading-relaxed">
          <span className="font-black underline">Note:</span> To add new items, use the 
          <span className="font-black"> "Receive Stock"</span> button on the main Dashboard. 
          This keeps your records and catalog updated at the same time.
        </p>
      </div>
    </div>
  );
};

export default ItemManager;
