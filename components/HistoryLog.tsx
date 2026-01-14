import React, { useState, useEffect, useCallback } from 'react';
import { Transaction, InventoryItem, AuthSession, User, TransactionType } from '../types';
import { ArrowDown, ArrowUp, Timer, Download, Plus } from './Icons';
import * as db from '../lib/db';

interface HistoryLogProps {
  transactions: Transaction[];
  items: InventoryItem[];
  session: AuthSession;
  categories: string[];
  onExport: () => void;
  onAddTransaction?: (tx: Transaction) => void;
  onUpdateTransaction?: (id: string, updates: Partial<Transaction>) => void;
  onDeleteTransaction?: (id: string) => void;
}

const ITEMS_PER_PAGE = 50;

const HistoryLog: React.FC<HistoryLogProps> = ({ 
  transactions, 
  items, 
  session, 
  categories,
  onExport, 
  onAddTransaction,
  onUpdateTransaction, 
  onDeleteTransaction 
}) => {
  const getItem = (id: string) => items.find(i => i.id === id);
  const isAdmin = session.user.role === 'admin';
  
  // Pagination state
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  
  // Filter state
  const [filterType, setFilterType] = useState<'ALL' | 'IN' | 'OUT' | 'WIP'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterUser, setFilterUser] = useState<string>('ALL');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Get users for displaying creator names
  const [users, setUsers] = useState<User[]>([]);
  
  useEffect(() => {
    const loadUsers = async () => {
      const loadedUsers = await db.getUsers();
      setUsers(loadedUsers);
    };
    loadUsers();
  }, []);

  useEffect(() => {
    const loadCount = async () => {
      const count = await db.getTransactionCount();
      setTotalCount(count);
    };
    loadCount();
  }, [transactions]);

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId);
    return user?.displayName || 'Unknown User';
  };

  // Check if current user can edit this transaction
  const canEdit = (tx: Transaction) => {
    if (session.user.role === 'admin') return true;
    return tx.createdBy === session.user.id;
  };
  
  // Edit modal state
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editItemId, setEditItemId] = useState('');
  const [editType, setEditType] = useState<TransactionType>('IN');
  const [editQuantity, setEditQuantity] = useState('');
  const [editUser, setEditUser] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editBillNumber, setEditBillNumber] = useState('');
  
  // Add transaction modal state (admin only)
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemId, setNewItemId] = useState('');
  const [newType, setNewType] = useState<TransactionType>('IN');
  const [newQuantity, setNewQuantity] = useState('');
  const [newUser, setNewUser] = useState('');
  const [newReason, setNewReason] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newBillNumber, setNewBillNumber] = useState('');

  const openEditModal = (tx: Transaction) => {
    setEditingTx(tx);
    setEditItemId(tx.itemId);
    setEditType(tx.type);
    setEditQuantity(tx.quantity.toString());
    setEditUser(tx.user);
    setEditReason(tx.reason);
    setEditLocation(tx.location || '');
    setEditAmount(tx.amount?.toString() || '');
    setEditBillNumber(tx.billNumber || '');
  };

  const saveEdit = () => {
    if (editingTx && onUpdateTransaction) {
      const updates: Partial<Transaction> = {
        location: editLocation || undefined,
        amount: editAmount ? parseFloat(editAmount) : undefined,
        billNumber: editBillNumber || undefined
      };
      
      // Admin can edit all fields
      if (isAdmin) {
        updates.itemId = editItemId;
        updates.type = editType;
        updates.quantity = parseInt(editQuantity) || 1;
        updates.user = editUser;
        updates.reason = editReason;
      }
      
      onUpdateTransaction(editingTx.id, updates);
    }
    setEditingTx(null);
  };

  const openAddModal = () => {
    setNewItemId(items[0]?.id || '');
    setNewType('IN');
    setNewQuantity('1');
    setNewUser(session.user.displayName);
    setNewReason('');
    setNewLocation('');
    setNewAmount('');
    setNewBillNumber('');
    setShowAddModal(true);
  };

  const saveNewTransaction = () => {
    if (!onAddTransaction || !newItemId || !newReason || !newQuantity) return;
    
    const newTx: Transaction = {
      id: crypto.randomUUID(),
      itemId: newItemId,
      type: newType,
      quantity: parseInt(newQuantity) || 1,
      user: newUser || session.user.displayName,
      reason: newReason,
      timestamp: Date.now(),
      location: newLocation || undefined,
      amount: newAmount ? parseFloat(newAmount) : undefined,
      billNumber: newBillNumber || undefined,
      createdBy: session.user.id
    };
    
    onAddTransaction(newTx);
    setShowAddModal(false);
  };

  const formatTime = (ts: number) => {
    return new Intl.DateTimeFormat('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    }).format(new Date(ts));
  };

  const formatDate = (ts: number) => {
    return new Intl.DateTimeFormat('en-GB', { 
      weekday: 'short',
      day: '2-digit', 
      month: 'short',
      year: 'numeric'
    }).format(new Date(ts));
  };

  // Get unique users from transactions for filter dropdown
  const uniqueUsers = Array.from(new Set(transactions.map(tx => tx.user))).sort();

  // Filter transactions
  const filteredTransactions = transactions.filter(tx => {
    // Type filter
    if (filterType !== 'ALL' && tx.type !== filterType) return false;
    
    // User filter
    if (filterUser !== 'ALL' && tx.user !== filterUser) return false;
    
    // Date range filter
    if (filterDateFrom) {
      const fromDate = new Date(filterDateFrom);
      fromDate.setHours(0, 0, 0, 0);
      if (tx.timestamp < fromDate.getTime()) return false;
    }
    if (filterDateTo) {
      const toDate = new Date(filterDateTo);
      toDate.setHours(23, 59, 59, 999);
      if (tx.timestamp > toDate.getTime()) return false;
    }
    
    // Search query filter
    if (searchQuery) {
      const item = getItem(tx.itemId);
      const query = searchQuery.toLowerCase();
      return (
        item?.name.toLowerCase().includes(query) ||
        item?.category.toLowerCase().includes(query) ||
        tx.user.toLowerCase().includes(query) ||
        tx.reason.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Check if any filters are active
  const hasActiveFilters = filterType !== 'ALL' || filterUser !== 'ALL' || filterDateFrom || filterDateTo || searchQuery;

  // Clear all filters
  const clearFilters = () => {
    setFilterType('ALL');
    setFilterUser('ALL');
    setFilterDateFrom('');
    setFilterDateTo('');
    setSearchQuery('');
  };

  // Get displayed transactions with pagination
  const displayedTransactions = filteredTransactions.slice(0, displayCount);
  const hasMore = displayCount < filteredTransactions.length;

  const loadMore = useCallback(() => {
    setIsLoadingMore(true);
    setTimeout(() => {
      setDisplayCount(prev => prev + ITEMS_PER_PAGE);
      setIsLoadingMore(false);
    }, 300);
  }, []);

  // Group transactions by date
  const groupedByDate = displayedTransactions.reduce((acc, tx) => {
    const date = formatDate(tx.timestamp);
    if (!acc[date]) acc[date] = [];
    acc[date].push(tx);
    return acc;
  }, {} as Record<string, Transaction[]>);

  // Export to CSV
  const handleExport = () => {
    const headers = ['Date', 'Item', 'Category', 'Type', 'Quantity', 'Unit', 'User', 'Reason', 'Location', 'Amount', 'Bill No.'];
    const rows = filteredTransactions.map(tx => {
      const item = getItem(tx.itemId);
      return [
        new Date(tx.timestamp).toLocaleString(),
        item?.name || 'Deleted',
        item?.category || '',
        tx.type,
        tx.quantity,
        item?.unit || '',
        tx.user,
        tx.reason,
        tx.location || '',
        tx.amount || '',
        tx.billNumber || ''
      ].join(',');
    });
    
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory-log-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <div>
          <h2 className="text-xl font-black text-slate-800">Recent Activity</h2>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            {filteredTransactions.length} of {totalCount || transactions.length} entries
            {isAdmin && <span className="text-indigo-500 ml-2">• ADMIN MODE</span>}
          </p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto flex-wrap">
          {/* Admin: Add Transaction Button */}
          {isAdmin && onAddTransaction && (
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-200"
            >
              <Plus size={18} />
              Add Entry
            </button>
          )}
          
          {/* Search */}
          <div className="relative flex-1 sm:flex-none sm:w-48">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-slate-100 rounded-xl focus:border-indigo-500 outline-none text-sm font-medium"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </div>
          
          {/* Filter buttons */}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {(['ALL', 'IN', 'OUT', 'WIP'] as const).map(type => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                  filterType === type 
                    ? 'bg-white shadow-sm text-indigo-600' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          
          {/* More Filters Button */}
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all ${
              showFilters || hasActiveFilters
                ? 'bg-indigo-100 text-indigo-600 border-2 border-indigo-200'
                : 'bg-white border-2 border-slate-100 text-slate-500 hover:border-indigo-100 hover:text-indigo-600'
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>
            </svg>
            Filters
            {hasActiveFilters && (
              <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
            )}
          </button>
          
          <button 
            onClick={handleExport}
            className="p-2.5 bg-white border-2 border-slate-100 rounded-xl text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all"
            title="Export to CSV"
          >
            <Download size={20} />
          </button>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="bg-white border-2 border-slate-100 rounded-2xl p-5 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-slate-700 text-sm uppercase tracking-wider">Advanced Filters</h3>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs font-bold text-red-500 hover:text-red-600 uppercase tracking-wider"
              >
                Clear All
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* User Filter */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                Filter by User
              </label>
              <select
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2.5 focus:border-indigo-500 outline-none text-sm font-medium"
              >
                <option value="ALL">All Users</option>
                {uniqueUsers.map(user => (
                  <option key={user} value={user}>{user}</option>
                ))}
              </select>
            </div>
            
            {/* Date From */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                From Date
              </label>
              <input
                type="date"
                value={filterDateFrom}
                onChange={(e) => setFilterDateFrom(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2.5 focus:border-indigo-500 outline-none text-sm font-medium"
              />
            </div>
            
            {/* Date To */}
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                To Date
              </label>
              <input
                type="date"
                value={filterDateTo}
                onChange={(e) => setFilterDateTo(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2.5 focus:border-indigo-500 outline-none text-sm font-medium"
              />
            </div>
          </div>
          
          {/* Quick date presets */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Quick Filters</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => {
                  const today = new Date();
                  setFilterDateFrom(today.toISOString().split('T')[0]);
                  setFilterDateTo(today.toISOString().split('T')[0]);
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-600 rounded-lg text-xs font-bold transition-colors"
              >
                Today
              </button>
              <button
                onClick={() => {
                  const today = new Date();
                  const yesterday = new Date(today);
                  yesterday.setDate(yesterday.getDate() - 1);
                  setFilterDateFrom(yesterday.toISOString().split('T')[0]);
                  setFilterDateTo(yesterday.toISOString().split('T')[0]);
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-600 rounded-lg text-xs font-bold transition-colors"
              >
                Yesterday
              </button>
              <button
                onClick={() => {
                  const today = new Date();
                  const weekAgo = new Date(today);
                  weekAgo.setDate(weekAgo.getDate() - 7);
                  setFilterDateFrom(weekAgo.toISOString().split('T')[0]);
                  setFilterDateTo(today.toISOString().split('T')[0]);
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-600 rounded-lg text-xs font-bold transition-colors"
              >
                Last 7 Days
              </button>
              <button
                onClick={() => {
                  const today = new Date();
                  const monthAgo = new Date(today);
                  monthAgo.setDate(monthAgo.getDate() - 30);
                  setFilterDateFrom(monthAgo.toISOString().split('T')[0]);
                  setFilterDateTo(today.toISOString().split('T')[0]);
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-600 rounded-lg text-xs font-bold transition-colors"
              >
                Last 30 Days
              </button>
              <button
                onClick={() => {
                  const today = new Date();
                  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                  setFilterDateFrom(firstDay.toISOString().split('T')[0]);
                  setFilterDateTo(today.toISOString().split('T')[0]);
                }}
                className="px-3 py-1.5 bg-slate-100 hover:bg-indigo-100 text-slate-600 hover:text-indigo-600 rounded-lg text-xs font-bold transition-colors"
              >
                This Month
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Summary */}
      {hasActiveFilters && !showFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active:</span>
          {filterType !== 'ALL' && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-600 rounded-lg text-xs font-bold">
              Type: {filterType}
              <button onClick={() => setFilterType('ALL')} className="hover:text-indigo-800">×</button>
            </span>
          )}
          {filterUser !== 'ALL' && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-600 rounded-lg text-xs font-bold">
              User: {filterUser}
              <button onClick={() => setFilterUser('ALL')} className="hover:text-indigo-800">×</button>
            </span>
          )}
          {filterDateFrom && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-600 rounded-lg text-xs font-bold">
              From: {filterDateFrom}
              <button onClick={() => setFilterDateFrom('')} className="hover:text-indigo-800">×</button>
            </span>
          )}
          {filterDateTo && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-600 rounded-lg text-xs font-bold">
              To: {filterDateTo}
              <button onClick={() => setFilterDateTo('')} className="hover:text-indigo-800">×</button>
            </span>
          )}
          {searchQuery && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-600 rounded-lg text-xs font-bold">
              Search: "{searchQuery}"
              <button onClick={() => setSearchQuery('')} className="hover:text-indigo-800">×</button>
            </span>
          )}
          <button
            onClick={clearFilters}
            className="text-xs font-bold text-red-500 hover:text-red-600 ml-2"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Transactions grouped by date */}
      <div className="space-y-6">
        {Object.entries(groupedByDate).length > 0 ? (
          Object.entries(groupedByDate).map(([date, txs]) => (
            <div key={date}>
              <div className="sticky top-0 bg-slate-50 py-2 z-10">
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{date}</p>
              </div>
              <div className="space-y-3">
                {txs.map(tx => {
                  const item = getItem(tx.itemId);
                  const isWIP = tx.type === 'WIP';
                  return (
                    <div key={tx.id} className={`p-5 sm:p-6 rounded-[24px] sm:rounded-[32px] flex flex-col sm:flex-row gap-4 sm:gap-6 items-start sm:items-center shadow-sm hover:shadow-md transition-shadow ${
                      isWIP 
                        ? 'bg-amber-50 border-2 border-amber-200' 
                        : 'bg-white border-2 border-slate-50'
                    }`}>
                      <div className={`p-4 rounded-2xl shrink-0 self-start sm:self-center ${
                        tx.type === 'IN' ? 'bg-indigo-50 text-indigo-600' : 
                        tx.type === 'OUT' ? 'bg-slate-900 text-white' : 
                        'bg-amber-200 text-amber-700 border-2 border-amber-300'
                      }`}>
                        {tx.type === 'IN' && <ArrowDown size={28} />}
                        {tx.type === 'OUT' && <ArrowUp size={28} />}
                        {tx.type === 'WIP' && <Timer size={28} />}
                      </div>
                      
                      <div className="flex-1 min-w-0 w-full">
                        <div className="flex justify-between items-start mb-1">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">{item?.category || 'General'}</span>
                              {isWIP && (
                                <span className="text-[9px] font-black text-amber-700 bg-amber-200 px-2 py-0.5 rounded uppercase">Work In Progress</span>
                              )}
                            </div>
                            <h4 className="font-black text-lg sm:text-xl text-slate-800 truncate leading-tight">{item?.name || 'Deleted Item'}</h4>
                          </div>
                          <div className="text-right shrink-0">
                            <div className={`text-2xl font-black tabular-nums tracking-tighter ${
                              tx.type === 'IN' ? 'text-indigo-600' : tx.type === 'WIP' ? 'text-amber-600' : 'text-slate-900'
                            }`}>
                              {tx.type === 'IN' ? '+' : tx.type === 'WIP' ? '⏳' : '-'}{tx.quantity}
                            </div>
                            <div className="text-[10px] font-bold text-slate-400 uppercase">{item?.unit}</div>
                          </div>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 pt-4 border-t border-slate-50">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-500 uppercase">
                              {tx.user.charAt(0)}
                            </div>
                            <span className="text-sm font-black text-slate-800">{tx.user}</span>
                            {tx.createdBy && tx.createdBy === session.user.id && (
                              <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded uppercase">You</span>
                            )}
                          </div>
                          <div className="flex-1 min-w-[150px]">
                            <span className="text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg inline-block w-full truncate">
                              "{tx.reason}"
                            </span>
                          </div>
                          <span className="text-[10px] font-bold text-slate-300 ml-auto tabular-nums">{formatTime(tx.timestamp)}</span>
                        </div>

                        {/* Optional fields display */}
                        {(tx.location || tx.amount || tx.billNumber) && (
                          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-50">
                            {tx.location && (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 bg-blue-50 px-3 py-1.5 rounded-lg">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-blue-500">
                                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                                </svg>
                                {tx.location}
                              </span>
                            )}
                            {tx.amount && (
                              <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg tabular-nums">
                                ₹{tx.amount.toLocaleString('en-IN')}
                              </span>
                            )}
                            {tx.billNumber && (
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-purple-600 bg-purple-50 px-3 py-1.5 rounded-lg">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-purple-400">
                                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
                                </svg>
                                {tx.billNumber}
                              </span>
                            )}
                          </div>
                        )}

                        {/* Edit/Delete buttons */}
                        {canEdit(tx) && (
                          <div className="mt-3 flex items-center gap-3">
                            {onUpdateTransaction && (
                              <button 
                                onClick={() => openEditModal(tx)}
                                className="text-[10px] font-bold text-indigo-500 hover:text-indigo-700 uppercase tracking-wider transition-colors"
                              >
                                ✏️ Edit Details
                              </button>
                            )}
                            {onDeleteTransaction && (
                              <button 
                                onClick={() => {
                                  if (confirm('Delete this entry? This will reverse the stock change.')) {
                                    onDeleteTransaction(tx.id);
                                  }
                                }}
                                className="text-[10px] font-bold text-red-400 hover:text-red-600 uppercase tracking-wider transition-colors"
                              >
                                🗑️ Delete
                              </button>
                            )}
                          </div>
                        )}
                        {!canEdit(tx) && tx.createdBy && (
                          <p className="mt-3 text-[10px] font-medium text-slate-300 uppercase tracking-wider">
                            Created by {getUserName(tx.createdBy)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        ) : (
          <div className="py-32 text-center bg-white border-2 border-dashed border-slate-100 rounded-[40px]">
            <p className="text-slate-300 font-black text-lg">
              {searchQuery || filterType !== 'ALL' ? 'NO MATCHING ENTRIES' : 'LOGBOOK IS EMPTY'}
            </p>
          </div>
        )}
      </div>

      {/* Load more button */}
      {hasMore && (
        <div className="text-center py-6">
          <button
            onClick={loadMore}
            disabled={isLoadingMore}
            className="px-8 py-4 bg-white border-2 border-slate-200 rounded-2xl font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition-all disabled:opacity-50"
          >
            {isLoadingMore ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading...
              </span>
            ) : (
              `Load More (${filteredTransactions.length - displayCount} remaining)`
            )}
          </button>
        </div>
      )}

      {/* Edit Modal */}
      {editingTx && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-indigo-500 to-purple-500 text-white shrink-0">
              <div>
                <h2 className="text-xl font-black">Edit Entry {isAdmin && '(Admin)'}</h2>
                <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">
                  {getItem(editingTx.itemId)?.name || 'Item'} • {formatTime(editingTx.timestamp)}
                </p>
              </div>
              <button onClick={() => setEditingTx(null)} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              {/* Admin-only fields */}
              {isAdmin && (
                <>
                  <div>
                    <label className="block text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1.5">
                      Item <span className="text-indigo-300">(Admin)</span>
                    </label>
                    <select
                      value={editItemId}
                      onChange={(e) => setEditItemId(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-indigo-100 rounded-2xl px-5 py-3 focus:border-indigo-500 outline-none font-medium"
                    >
                      {items.map(item => (
                        <option key={item.id} value={item.id}>{item.name} ({item.category})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1.5">
                        Type <span className="text-indigo-300">(Admin)</span>
                      </label>
                      <select
                        value={editType}
                        onChange={(e) => setEditType(e.target.value as TransactionType)}
                        className={`w-full border-2 rounded-2xl px-5 py-3 focus:border-indigo-500 outline-none font-black ${
                          editType === 'IN' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                          editType === 'WIP' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                          'bg-slate-100 border-slate-200 text-slate-700'
                        }`}
                      >
                        <option value="IN">IN (Receive)</option>
                        <option value="OUT">OUT (Issue)</option>
                        <option value="WIP">WIP (In Progress)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1.5">
                        Quantity <span className="text-indigo-300">(Admin)</span>
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={editQuantity}
                        onChange={(e) => setEditQuantity(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-indigo-100 rounded-2xl px-5 py-3 focus:border-indigo-500 outline-none font-black text-xl tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1.5">
                        User <span className="text-indigo-300">(Admin)</span>
                      </label>
                      <input
                        type="text"
                        value={editUser}
                        onChange={(e) => setEditUser(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-indigo-100 rounded-2xl px-5 py-3 focus:border-indigo-500 outline-none font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1.5">
                        Reason <span className="text-indigo-300">(Admin)</span>
                      </label>
                      <input
                        type="text"
                        value={editReason}
                        onChange={(e) => setEditReason(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-indigo-100 rounded-2xl px-5 py-3 focus:border-indigo-500 outline-none font-medium"
                      />
                    </div>
                  </div>

                  <hr className="border-slate-200 my-2" />
                </>
              )}

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  Location <span className="text-slate-300">(Optional)</span>
                </label>
                <input 
                  type="text" placeholder="e.g. Site A, Block 2"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 focus:border-indigo-500 outline-none font-medium"
                  value={editLocation}
                  onChange={(e) => setEditLocation(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    Amount ₹ <span className="text-slate-300">(Optional)</span>
                  </label>
                  <input 
                    type="number" step="0.01" placeholder="0.00"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 focus:border-indigo-500 outline-none font-bold tabular-nums"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    Bill / Invoice No.
                  </label>
                  <input 
                    type="text" placeholder="e.g. INV-001"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 focus:border-indigo-500 outline-none font-medium"
                    value={editBillNumber}
                    onChange={(e) => setEditBillNumber(e.target.value)}
                  />
                </div>
              </div>

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

      {/* Add Transaction Modal (Admin Only) */}
      {showAddModal && isAdmin && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-emerald-500 to-teal-500 text-white shrink-0">
              <div>
                <h2 className="text-xl font-black">Add New Entry</h2>
                <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">Admin Manual Entry</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  Select Item *
                </label>
                <select
                  value={newItemId}
                  onChange={(e) => setNewItemId(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 focus:border-indigo-500 outline-none font-medium"
                  required
                >
                  <option value="">-- Select an item --</option>
                  {items.map(item => (
                    <option key={item.id} value={item.id}>{item.name} ({item.category})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    Transaction Type *
                  </label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as TransactionType)}
                    className={`w-full border-2 rounded-2xl px-5 py-3 focus:border-indigo-500 outline-none font-black ${
                      newType === 'IN' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                      newType === 'WIP' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                      'bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    <option value="IN">IN (Receive)</option>
                    <option value="OUT">OUT (Issue)</option>
                    <option value="WIP">WIP (In Progress)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={newQuantity}
                    onChange={(e) => setNewQuantity(e.target.value)}
                    placeholder="1"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 focus:border-indigo-500 outline-none font-black text-xl tabular-nums"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    User Name
                  </label>
                  <input
                    type="text"
                    value={newUser}
                    onChange={(e) => setNewUser(e.target.value)}
                    placeholder={session.user.displayName}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 focus:border-indigo-500 outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    Reason *
                  </label>
                  <input
                    type="text"
                    value={newReason}
                    onChange={(e) => setNewReason(e.target.value)}
                    placeholder="e.g. Site delivery"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 focus:border-indigo-500 outline-none font-medium"
                    required
                  />
                </div>
              </div>

              <hr className="border-slate-200 my-2" />

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  Location <span className="text-slate-300">(Optional)</span>
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. Site A, Block 2"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 focus:border-indigo-500 outline-none font-medium"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    Amount ₹
                  </label>
                  <input 
                    type="number" step="0.01" placeholder="0.00"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 focus:border-indigo-500 outline-none font-bold tabular-nums"
                    value={newAmount}
                    onChange={(e) => setNewAmount(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    Bill / Invoice No.
                  </label>
                  <input 
                    type="text" placeholder="e.g. INV-001"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 focus:border-indigo-500 outline-none font-medium"
                    value={newBillNumber}
                    onChange={(e) => setNewBillNumber(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-4 rounded-2xl font-black text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={saveNewTransaction}
                  disabled={!newItemId || !newReason || !newQuantity}
                  className="flex-1 py-4 rounded-2xl font-black text-white bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add Entry
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HistoryLog;
