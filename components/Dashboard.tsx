import React, { useMemo, useState } from 'react';
import { InventoryItem, Transaction, TransactionType, AuthSession, User, Contractor } from '../types';
import { ArrowDown, ArrowUp, Timer, Package, History, HardHat } from './Icons';

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
  const [filter, setFilter] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [historyItemId, setHistoryItemId] = useState<string | null>(null);
  
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

  // Check if current user can edit this transaction
  const canEdit = (tx: Transaction) => {
    // Only admins can edit
    return session.user.role === 'admin';
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

  // Get transactions for the selected item
  const itemHistory = useMemo(() => {
    if (!historyItemId) return [];
    return transactions
      .filter(t => t.itemId === historyItemId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [transactions, historyItemId]);

  const historyItem = historyItemId ? items.find(i => i.id === historyItemId) : null;

  const formatTime = (ts: number) => {
    return new Intl.DateTimeFormat('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    }).format(new Date(ts));
  };

  // Calculated Inventory - use accurate stock levels from database
  const inventoryStats = useMemo(() => {
    return items.map(item => {
      const levels = stockLevels[item.id] || { stock: 0, wip: 0 };
      const net = levels.stock;
      const wip = levels.wip;
      const available = net - wip; // Available = Total - WIP
      return { ...item, net, wip, available };
    });
  }, [items, stockLevels]);

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
                className={`w-full text-left p-4 sm:p-6 rounded-[28px] sm:rounded-[32px] border-2 transition-all flex flex-col justify-between min-h-[100px] sm:min-h-[140px] ${
                  expandedCategory === cat 
                  ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xl shadow-indigo-200' 
                  : 'bg-white border-slate-100 text-slate-800 hover:border-indigo-200 shadow-sm active:scale-[0.98]'
                }`}
              >
                <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center mb-3 sm:mb-4 ${expandedCategory === cat ? 'bg-white/20' : 'bg-indigo-50 text-indigo-600'}`}>
                  <Package size={20} className="sm:w-6 sm:h-6" />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg leading-tight uppercase tracking-tight break-words">{cat}</h3>
                  <p className={`text-[10px] font-bold mt-1 uppercase tracking-widest ${expandedCategory === cat ? 'text-white/60' : 'text-slate-400'}`}>
                    {groupedItems[cat].length} ITEMS
                  </p>
                </div>
              </button>

              {expandedCategory === cat && (
                <div className="mt-3 sm:mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
                  {groupedItems[cat].map(item => (
                    <div key={item.id} className={`p-4 sm:p-6 rounded-[28px] sm:rounded-[32px] border-2 shadow-md ${
                      item.wip > 0 
                        ? 'bg-amber-50 border-amber-200' 
                        : 'bg-white border-slate-50'
                    }`}>
                      <div className="flex justify-between items-start mb-3 sm:mb-4">
                        <div className="flex-1 pr-3 sm:pr-4 min-w-0">
                          <h4 className="font-black text-lg sm:text-xl text-slate-900 leading-none mb-1 truncate">{item.name}</h4>
                          <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{item.unit}</span>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-3xl sm:text-4xl font-black tabular-nums tracking-tighter text-slate-900 leading-none">
                            {item.net}
                          </div>
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">STOCK</div>
                        </div>
                      </div>
                      
                      {/* WIP Indicator - Yellow Badge */}
                      {item.wip > 0 && (
                        <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-amber-100 border-2 border-amber-300 rounded-xl sm:rounded-2xl flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <Timer size={16} className="text-amber-600 shrink-0" />
                            <span className="text-[10px] sm:text-xs font-black text-amber-700 uppercase tracking-wide truncate">WIP</span>
                          </div>
                          <span className="text-xl sm:text-2xl font-black text-amber-600 tabular-nums shrink-0 ml-2">{item.wip}</span>
                        </div>
                      )}
                      
                      <div className="flex gap-2">
                        <button 
                          onClick={() => onAction('OUT', item)}
                          className="flex-[2] py-3 sm:py-4 bg-slate-900 text-white rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-xs active:scale-95 transition-all uppercase tracking-widest"
                        >
                          TAKE OUT
                        </button>
                        <button 
                          onClick={() => onAction('IN', item)}
                          className="flex-1 py-3 sm:py-4 bg-indigo-50 text-indigo-600 rounded-xl sm:rounded-2xl flex items-center justify-center active:scale-95 transition-all"
                        >
                          <ArrowDown size={18} className="sm:w-5 sm:h-5" />
                        </button>
                        <button 
                          onClick={() => onAction('WIP', item)}
                          className="flex-1 py-3 sm:py-4 bg-amber-50 text-amber-600 rounded-xl sm:rounded-2xl flex items-center justify-center active:scale-95 transition-all border-2 border-amber-200"
                          title="Mark as Work In Progress"
                        >
                          <Timer size={18} className="sm:w-5 sm:h-5" />
                        </button>
                        <button 
                          onClick={() => setHistoryItemId(item.id)}
                          className="flex-1 py-3 sm:py-4 bg-emerald-50 text-emerald-600 rounded-xl sm:rounded-2xl flex items-center justify-center active:scale-95 transition-all"
                          title="View History"
                        >
                          <History size={18} className="sm:w-5 sm:h-5" />
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

      {/* History Full Page */}
      {historyItemId && historyItem && (
        <div className="fixed inset-0 bg-slate-50 z-[100] overflow-y-auto">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b-2 border-slate-100 px-4 sm:px-8 py-6 flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{historyItem.category}</span>
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900">{historyItem.name}</h1>
            </div>
            <button 
              onClick={() => setHistoryItemId(null)}
              className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm hover:bg-slate-800 transition-all flex items-center gap-2"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
              BACK
            </button>
          </div>

          {/* Content */}
          <div className="max-w-4xl mx-auto p-4 sm:p-8">
            {itemHistory.length > 0 ? (
              <>
                <div className="bg-white rounded-2xl border-2 border-slate-100 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="bg-slate-50 border-b-2 border-slate-200">
                        <th className="text-left py-4 px-4 text-[11px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Qty</th>
                        <th className="text-left py-4 px-4 text-[11px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Date & Time</th>
                        <th className="text-left py-4 px-4 text-[11px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">User</th>
                        <th className="text-left py-4 px-4 text-[11px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Reason</th>
                        <th className="text-left py-4 px-4 text-[11px] font-black text-slate-500 uppercase tracking-widest border-r border-slate-200">Details</th>
                        <th className="text-center py-4 px-4 text-[11px] font-black text-slate-500 uppercase tracking-widest w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {itemHistory.map((tx, idx) => (
                        <tr key={tx.id} className={`border-b border-slate-100 ${
                          tx.type === 'WIP' 
                            ? 'bg-amber-50' 
                            : idx % 2 === 1 ? 'bg-slate-50/50' : ''
                        }`}>
                          <td className={`py-4 px-4 font-black text-xl tabular-nums border-r border-slate-100 ${
                            tx.type === 'IN' ? 'text-emerald-600' : tx.type === 'WIP' ? 'text-amber-600' : 'text-red-500'
                          }`}>
                            {tx.type === 'IN' ? '+' : tx.type === 'WIP' ? '⏳' : '−'}{tx.quantity}
                          </td>
                          <td className="py-4 px-4 border-r border-slate-100">
                            <span className="text-sm font-bold text-slate-600 tabular-nums">
                              {formatTime(tx.timestamp)}
                            </span>
                          </td>
                          <td className="py-4 px-4 border-r border-slate-100">
                            <span className="text-sm font-black text-slate-700 uppercase">{tx.user}</span>
                          </td>
                          <td className="py-4 px-4 border-r border-slate-100">
                            <span className="text-sm text-slate-600">{tx.reason}</span>
                          </td>
                          <td className="py-4 px-4 border-r border-slate-100">
                            <div className="flex flex-wrap gap-1">
                              {tx.contractorId && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                                  👷 {getContractor(tx.contractorId)?.name || 'Unknown'}
                                </span>
                              )}
                              {tx.location && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded">
                                  📍 {tx.location}
                                </span>
                              )}
                              {tx.amount && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded tabular-nums">
                                  ₹{tx.amount.toLocaleString('en-IN')}
                                </span>
                              )}
                              {tx.billNumber && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-purple-600 bg-purple-50 px-2 py-1 rounded">
                                  #{tx.billNumber}
                                </span>
                              )}
                              {!tx.location && !tx.amount && !tx.billNumber && (
                                <span className="text-[10px] text-slate-300">—</span>
                              )}
                            </div>
                          </td>
                          <td className="py-4 px-2 text-center">
                            {canEdit(tx) ? (
                              <div className="flex items-center justify-center gap-1">
                                {onUpdateTransaction && (
                                  <button 
                                    onClick={() => openEditModal(tx)}
                                    className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="Edit Details"
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                                    </svg>
                                  </button>
                                )}
                                {onDeleteTransaction && (
                                  <button 
                                    onClick={() => {
                                      if (confirm('Delete this entry? This will reverse the stock change.')) {
                                        onDeleteTransaction(tx.id);
                                      }
                                    }}
                                    className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Delete Entry"
                                  >
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                                    </svg>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-[9px] text-slate-300">{tx.createdBy ? getUserName(tx.createdBy).split(' ')[0] : '—'}</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    </table>
                  </div>
                </div>

                {/* Total Stock with WIP breakdown */}
                {(() => {
                  const stats = inventoryStats.find(i => i.id === historyItemId);
                  return (
                    <div className="mt-6 space-y-3">
                      {stats?.wip && stats.wip > 0 && (
                        <div className="bg-amber-100 border-2 border-amber-300 text-amber-800 rounded-2xl p-6 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Timer size={24} className="text-amber-600" />
                            <div>
                              <p className="text-[11px] font-black text-amber-600 uppercase tracking-widest">Work In Progress</p>
                              <p className="text-sm text-amber-600/70 mt-0.5">Items being used but still in inventory</p>
                            </div>
                          </div>
                          <div className="text-4xl font-black tabular-nums text-amber-600">
                            {stats.wip}
                          </div>
                        </div>
                      )}
                      <div className="bg-slate-900 text-white rounded-2xl p-6 flex items-center justify-between">
                        <div>
                          <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Total Stock</p>
                          <p className="text-sm text-slate-400 mt-1">{historyItem.unit}</p>
                        </div>
                        <div className="text-5xl font-black tabular-nums">
                          {stats?.net || 0}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="py-24 text-center bg-white rounded-2xl border-2 border-slate-100">
                <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-300">
                  <History size={40} />
                </div>
                <p className="text-slate-400 font-bold text-lg">No history for this item yet</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingTx && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[200] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
              <div>
                <h2 className="text-xl font-black">Edit Entry Details</h2>
                <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">
                  {historyItem?.name || 'Item'} • {formatTime(editingTx.timestamp)}
                </p>
              </div>
              <button onClick={() => setEditingTx(null)} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  Contractor <span className="text-slate-300">(Optional)</span>
                </label>
                <select
                  value={editContractorId}
                  onChange={(e) => setEditContractorId(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 focus:border-indigo-500 outline-none font-medium"
                >
                  <option value="">No Contractor</option>
                  {contractors.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              {editingTx.type !== 'OUT' && (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                      Location <span className="text-slate-300">(Optional)</span>
                    </label>
                    <input 
                      type="text" placeholder="e.g. Site A, Block 2"
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-indigo-500 outline-none font-medium text-base"
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                      Amount ₹ <span className="text-slate-300">(Optional)</span>
                    </label>
                    <input 
                      type="number" step="0.01" placeholder="0.00"
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-indigo-500 outline-none font-bold text-lg tabular-nums"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                      Bill / Invoice No. <span className="text-slate-300">(Optional)</span>
                    </label>
                    <input 
                      type="text" placeholder="e.g. INV-2024-001"
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-indigo-500 outline-none font-medium text-base"
                      value={editBillNumber}
                      onChange={(e) => setEditBillNumber(e.target.value)}
                    />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setEditingTx(null)}
                  className="flex-1 py-4 rounded-2xl font-black text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={saveEdit}
                  className="flex-1 py-4 rounded-2xl font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all"
                >
                  Save Changes
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
