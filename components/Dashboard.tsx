import React, { useMemo, useState, useEffect } from 'react';
import { InventoryItem, Transaction, TransactionType, AuthSession, User, Contractor } from '../types';
import { ArrowDown, ArrowUp, Timer, Package, History, HardHat, Plus } from './Icons';
import { useConfirm } from './ConfirmDialog';

interface DashboardProps {
  items: InventoryItem[];
  transactions: Transaction[];
  session: AuthSession;
  categories: string[];
  contractors: Contractor[];
  users: User[];
  stockLevels: Record<string, { stock: number; wip: number }>;
  onAction: (type: TransactionType, item: InventoryItem) => void;
  onAddNewItem: () => void;
  onUpdateTransaction?: (id: string, updates: Partial<Transaction>) => void;
  onDeleteTransaction?: (id: string) => void;
}

const SEARCH_DEBOUNCE_MS = 300;

const Dashboard: React.FC<DashboardProps> = ({ 
  items, 
  transactions, 
  session, 
  categories,
  contractors,
  users,
  stockLevels,
  onAction, 
  onAddNewItem, 
  onUpdateTransaction, 
  onDeleteTransaction 
}) => {
  const confirm = useConfirm();
  const [filterInput, setFilterInput] = useState('');
  const [filter, setFilter] = useState(''); // Debounced value
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [historyItemId, setHistoryItemId] = useState<string | null>(null);
  const [historyPage, setHistoryPage] = useState(0);
  const HISTORY_PER_PAGE = 50;

  const [isFiltering, setIsFiltering] = useState(false);

  // Debounce the filter value with loading indicator
  useEffect(() => {
    if (filterInput !== filter) {
      setIsFiltering(true);
    }
    const timer = setTimeout(() => {
      setFilter(filterInput);
      setIsFiltering(false);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [filterInput, filter]);
  
  // Edit modal state
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editLocation, setEditLocation] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editBillNumber, setEditBillNumber] = useState('');
  const [editContractorId, setEditContractorId] = useState('');

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.displayName || 'Unknown User';
  };

  const getContractor = (id?: string) => contractors.find(c => c.id === id);

  const canEdit = () => session.user.role === 'admin';

  // Calculate last location for each item
  const itemLocations = useMemo(() => {
    const locationData: Record<string, { location: string; timestamp: number }> = {};
    
    transactions.forEach(t => {
      if (!t.location) return;
      const existing = locationData[t.itemId];
      if (!existing || t.timestamp > existing.timestamp) {
        locationData[t.itemId] = { location: t.location, timestamp: t.timestamp };
      }
    });
    
    const locations: Record<string, string | null> = {};
    items.forEach(item => {
      locations[item.id] = locationData[item.id]?.location || null;
    });
    
    return locations;
  }, [items, transactions]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const openEditModal = (tx: Transaction) => {
    setEditingTx(tx);
    setEditLocation(tx.location || '');
    setEditAmount(tx.amount?.toString() || '');
    setEditBillNumber(tx.billNumber || '');
    setEditContractorId(tx.contractorId || '');
  };

  const saveEdit = () => {
    if (editingTx && onUpdateTransaction) {
      onUpdateTransaction(editingTx.id, {
        location: editLocation || undefined,
        amount: editAmount ? parseFloat(editAmount) : undefined,
        billNumber: editBillNumber || undefined,
        contractorId: editContractorId || undefined
      });
    }
    setEditingTx(null);
  };

  const itemHistory = useMemo(() => {
    if (!historyItemId) return { items: [], total: 0, totalPages: 0 };
    const filtered = transactions
      .filter(t => t.itemId === historyItemId)
      .sort((a, b) => b.timestamp - a.timestamp);
    
    const total = filtered.length;
    const totalPages = Math.ceil(total / HISTORY_PER_PAGE);
    const start = historyPage * HISTORY_PER_PAGE;
    const items = filtered.slice(start, start + HISTORY_PER_PAGE);
    
    return { items, total, totalPages };
  }, [transactions, historyItemId, historyPage]);

  const historyItem = historyItemId ? items.find(i => i.id === historyItemId) : null;
  
  // Reset history page when item changes
  const openHistory = (itemId: string) => {
    setHistoryItemId(itemId);
    setHistoryPage(0);
  };

  const formatTime = (ts: number) => {
    return new Intl.DateTimeFormat('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    }).format(new Date(ts));
  };

  // Calculated Inventory with location
  const inventoryStats = useMemo(() => {
    return items.map(item => {
      const levels = stockLevels[item.id] || { stock: 0, wip: 0 };
      return { ...item, net: levels.stock, wip: levels.wip, location: itemLocations[item.id] };
    });
  }, [items, stockLevels, itemLocations]);

  // Pre-calculate contractors for search
  const itemContractors = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    transactions.forEach(t => {
      if (t.contractorId) {
        if (!map[t.itemId]) map[t.itemId] = new Set();
        const contractor = contractors.find(c => c.id === t.contractorId);
        if (contractor) map[t.itemId].add(contractor.name.toLowerCase());
      }
    });
    return map;
  }, [transactions, contractors]);

  // Filter items based on search - search everything
  const filteredStats = useMemo(() => {
    if (!filter) return inventoryStats;
    
    const q = filter.toLowerCase();
    return inventoryStats.filter(i => 
      i.name.toLowerCase().includes(q) || 
      i.category.toLowerCase().includes(q) ||
      i.unit.toLowerCase().includes(q) ||
      (i.description?.toLowerCase().includes(q)) ||
      (i.location?.toLowerCase().includes(q)) ||
      (itemContractors[i.id] && Array.from(itemContractors[i.id]).some(c => c.includes(q)))
    );
  }, [inventoryStats, filter, itemContractors]);

  // Grouping filtered items by Category
  const groupedItems = useMemo(() => {
    const groups: Record<string, typeof filteredStats> = {};
    filteredStats.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, [filteredStats]);

  // Category stats
  const categoryStats = useMemo(() => {
    const stats: Record<string, { count: number; totalStock: number }> = {};
    Object.entries(groupedItems).forEach(([cat, items]) => {
      stats[cat] = {
        count: items.length,
        totalStock: items.reduce((sum, i) => sum + i.net, 0)
      };
    });
    return stats;
  }, [groupedItems]);

  const sortedCategories = Object.keys(groupedItems).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  // Auto-expand categories when searching
  useEffect(() => {
    if (filter) {
      setExpandedCategories(new Set(sortedCategories));
    }
  }, [filter, sortedCategories]);

  const handleFilterChange = (value: string) => {
    setFilterInput(value);
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Search Bar */}
      <div className="relative">
        <input 
          type="text"
          placeholder="Search items, categories, locations..."
          className="w-full pl-10 pr-4 py-3 bg-white border-2 border-slate-100 rounded-xl focus:border-indigo-500 focus:outline-none shadow-sm text-sm font-bold placeholder:text-slate-300"
          value={filterInput}
          onChange={(e) => handleFilterChange(e.target.value)}
        />
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        </div>
        {isFiltering ? (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="animate-spin text-indigo-500" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25"/>
              <path d="M12 2a10 10 0 0 1 10 10" strokeOpacity="0.75"/>
            </svg>
          </div>
        ) : filterInput && (
          <button 
            onClick={() => handleFilterChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {/* Items Count */}
      <div className="flex items-center justify-between text-xs">
        <p className="text-slate-400 font-bold">
          {filteredStats.length} items in {sortedCategories.length} categories
        </p>
      </div>

      {/* Vertical Category List with Dropdowns */}
      {sortedCategories.length > 0 ? (
        <div className="space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto">
          {sortedCategories.map(cat => {
            const isExpanded = expandedCategories.has(cat);
            const categoryItems = groupedItems[cat] || [];
            
            return (
              <div key={cat} className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(cat)}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-black text-xl ${
                      isExpanded ? 'bg-indigo-600' : 'bg-slate-400'
                    }`}>
                      {cat.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-left">
                      <h3 className="font-black text-2xl text-indigo-700">{cat}</h3>
                      <p className="text-sm text-slate-400 font-bold">
                        {categoryItems.length} item{categoryItems.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-black text-slate-500 tabular-nums">
                      {categoryStats[cat]?.totalStock || 0} total
                    </span>
                    <svg 
                      className={`w-5 h-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none" 
                      viewBox="0 0 24 24" 
                      stroke="currentColor" 
                      strokeWidth="2.5"
                    >
                      <path d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Category Items Dropdown */}
                {isExpanded && (
                  <div className="border-t border-slate-100 divide-y divide-slate-100">
                    {categoryItems.map(item => (
                      <div 
                        key={item.id} 
                        className={`p-4 hover:bg-slate-50 transition-colors ${
                          item.wip > 0 ? 'bg-amber-50/50' : ''
                        }`}
                      >
                        {/* Item Name - Full Width, VERY Prominent */}
                        <div className="mb-4">
                          <h4 className="font-black text-lg text-slate-900 leading-tight bg-gradient-to-r from-emerald-50 to-transparent px-3 py-2 -mx-1 rounded-xl border-l-4 border-emerald-500">{item.name}</h4>
                          <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-slate-500 font-bold pl-3">
                            <span className="uppercase bg-slate-100 px-2 py-0.5 rounded">{item.unit}</span>
                            {item.location && (
                              <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full text-xs">📍 {item.location}</span>
                            )}
                            {item.wip > 0 && (
                              <span className="text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full text-xs font-black">
                                ⏳ WIP: {item.wip}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Stock + Actions Row */}
                        <div className="flex items-center justify-between">
                          {/* Stock Display */}
                          <div className="flex items-center gap-2">
                            <div className={`text-3xl font-black tabular-nums ${
                              item.net <= 0 ? 'text-red-500' : item.net < 10 ? 'text-amber-500' : 'text-slate-900'
                            }`}>
                              {item.net}
                            </div>
                            <div className="text-sm text-slate-400 font-bold uppercase">in stock</div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex gap-2">
                            <button 
                              onClick={() => onAction('OUT', item)}
                              className="w-11 h-11 bg-red-500 text-white rounded-xl flex items-center justify-center active:scale-95 transition-all shadow-md"
                              title="Take Out"
                            >
                              <ArrowUp size={20} />
                            </button>
                            <button 
                              onClick={() => onAction('IN', item)}
                              className="w-11 h-11 bg-emerald-500 text-white rounded-xl flex items-center justify-center active:scale-95 transition-all shadow-md"
                              title="Receive"
                            >
                              <Plus size={20} />
                            </button>
                            <button 
                              onClick={() => onAction('WIP', item)}
                              className="w-11 h-11 bg-amber-400 text-white rounded-xl flex items-center justify-center active:scale-95 transition-all shadow-md"
                              title="WIP"
                            >
                              <Timer size={20} />
                            </button>
                            <button 
                              onClick={() => openHistory(item.id)}
                              className="w-11 h-11 bg-slate-200 text-slate-600 rounded-xl flex items-center justify-center active:scale-95 transition-all"
                              title="History"
                            >
                              <History size={20} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-16 text-center bg-white rounded-2xl border-2 border-dashed border-slate-100">
          <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-200">
            <Package size={32} />
          </div>
          <h3 className="text-xl font-black text-slate-900 mb-1">
            {filter ? 'No matches' : 'Inventory Empty'}
          </h3>
          <p className="text-slate-400 text-sm font-medium mb-6">
            {filter ? 'Try a different search term' : 'Add your first item to get started'}
          </p>
          {!filter && (
            <button 
              onClick={onAddNewItem}
              className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-black text-sm shadow-lg shadow-indigo-100 active:scale-95 transition-all"
            >
              + Add Stock
            </button>
          )}
        </div>
      )}

      {/* History Full Page */}
      {historyItemId && historyItem && (
        <div className="fixed inset-0 bg-slate-50 z-[100] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-slate-200 px-4 py-4 flex items-center justify-between shadow-sm z-10">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">{historyItem.category}</p>
              <h1 className="text-lg font-black text-slate-900 truncate">{historyItem.name}</h1>
            </div>
            <button 
              onClick={() => setHistoryItemId(null)}
              className="shrink-0 ml-4 px-4 py-2 bg-slate-900 text-white rounded-xl font-black text-xs"
            >
              ← Back
            </button>
          </div>

          <div className="p-4 max-w-4xl mx-auto">
            {/* Stock Summary - Compact */}
            {(() => {
              const stats = inventoryStats.find(i => i.id === historyItemId);
              return (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-900 text-white rounded-xl p-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase">Total Stock</p>
                    <p className="text-3xl font-black tabular-nums">{stats?.net || 0}</p>
                    <p className="text-xs text-slate-400">{historyItem.unit}</p>
                  </div>
                  {(stats?.wip || 0) > 0 && (
                    <div className="bg-amber-100 text-amber-800 rounded-xl p-4 border border-amber-200">
                      <p className="text-[10px] font-black text-amber-600 uppercase">In Progress</p>
                      <p className="text-3xl font-black tabular-nums">{stats?.wip}</p>
                      <p className="text-xs text-amber-600">WIP Items</p>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Transaction History - Compact List with Pagination */}
            {itemHistory.total > 0 ? (
              <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {itemHistory.total} Transactions
                  </p>
                  {itemHistory.totalPages > 1 && (
                    <p className="text-[10px] text-slate-400">
                      Page {historyPage + 1} of {itemHistory.totalPages}
                    </p>
                  )}
                </div>
                <div className="divide-y divide-slate-100 max-h-[50vh] overflow-y-auto">
                  {itemHistory.items.map(tx => (
                    <div key={tx.id} className={`p-3 ${tx.type === 'WIP' ? 'bg-amber-50/50' : ''}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-sm font-black ${
                            tx.type === 'IN' ? 'bg-emerald-100 text-emerald-600' : 
                            tx.type === 'WIP' ? 'bg-amber-100 text-amber-600' : 
                            'bg-red-100 text-red-600'
                          }`}>
                            {tx.type === 'IN' ? '+' : tx.type === 'WIP' ? '⏳' : '−'}{tx.quantity}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-700 truncate">{tx.reason}</p>
                            <p className="text-[10px] text-slate-400">
                              {tx.user} • {formatTime(tx.timestamp)}
                            </p>
                            {/* Tags */}
                            <div className="flex flex-wrap gap-1 mt-1">
                              {tx.contractorId && (
                                <span className="text-[9px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                  👷 {getContractor(tx.contractorId)?.name}
                                </span>
                              )}
                              {tx.amount && (
                                <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                  ₹{tx.amount.toLocaleString('en-IN')}
                                </span>
                              )}
                              {tx.billNumber && (
                                <span className="text-[9px] font-bold text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">
                                  #{tx.billNumber}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {canEdit() && (
                          <div className="flex gap-1 shrink-0">
                            <button 
                              onClick={() => openEditModal(tx)}
                              className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button 
                              onClick={async () => {
                                const confirmed = await confirm({
                                  title: 'Delete Entry',
                                  message: 'Are you sure you want to delete this entry? This will reverse the stock change.',
                                  confirmText: 'Delete',
                                  variant: 'danger'
                                });
                                if (confirmed) onDeleteTransaction?.(tx.id);
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Pagination Controls */}
                {itemHistory.totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 p-3 bg-slate-50 border-t border-slate-100">
                    <button
                      onClick={() => setHistoryPage(Math.max(0, historyPage - 1))}
                      disabled={historyPage === 0}
                      className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <span className="text-xs font-bold text-slate-500 px-4">
                      {historyPage + 1} / {itemHistory.totalPages}
                    </span>
                    <button
                      onClick={() => setHistoryPage(Math.min(itemHistory.totalPages - 1, historyPage + 1))}
                      disabled={historyPage >= itemHistory.totalPages - 1}
                      className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center bg-white rounded-xl border border-slate-100">
                <History size={32} className="mx-auto text-slate-200 mb-2" />
                <p className="text-slate-400 font-bold text-sm">No history yet</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal - Compact */}
      {editingTx && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white flex justify-between items-center">
              <div>
                <h2 className="text-lg font-black">Edit Entry</h2>
                <p className="text-[10px] text-white/70">{formatTime(editingTx.timestamp)}</p>
              </div>
              <button onClick={() => setEditingTx(null)} className="p-1.5 bg-white/10 rounded-full">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase">Contractor</label>
                <select
                  value={editContractorId}
                  onChange={(e) => setEditContractorId(e.target.value)}
                  className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm"
                >
                  <option value="">None</option>
                  {contractors.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {editingTx.type !== 'OUT' && (
                <>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase">Location</label>
                    <input 
                      type="text" placeholder="Site A"
                      className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm"
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase">Amount ₹</label>
                      <input 
                        type="number" step="0.01" placeholder="0"
                        className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm"
                        value={editAmount}
                        onChange={(e) => setEditAmount(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase">Bill No.</label>
                      <input 
                        type="text" placeholder="INV-001"
                        className="w-full mt-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm"
                        value={editBillNumber}
                        onChange={(e) => setEditBillNumber(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              <div className="flex gap-2 pt-2">
                <button 
                  onClick={() => setEditingTx(null)}
                  className="flex-1 py-3 rounded-xl font-bold text-slate-500 bg-slate-100"
                >
                  Cancel
                </button>
                <button 
                  onClick={saveEdit}
                  className="flex-1 py-3 rounded-xl font-bold text-white bg-indigo-600"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
