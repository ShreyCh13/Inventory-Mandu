import React, { useState, useMemo } from 'react';
import { Contractor, Transaction, InventoryItem } from '../types';
import { HardHat, Trash, Edit, History, Package } from './Icons';

interface ContractorManagerProps {
  contractors: Contractor[];
  transactions: Transaction[];
  items: InventoryItem[];
  onCreate: (name: string) => Promise<Contractor | null>;
  onUpdate: (id: string, name: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

const TX_PER_PAGE = 50;

const ContractorManager: React.FC<ContractorManagerProps> = ({ 
  contractors, 
  transactions,
  items,
  onCreate,
  onUpdate,
  onDelete
}) => {
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedContractorId, setSelectedContractorId] = useState<string | null>(null);
  const [view, setView] = useState<'balance' | 'history'>('balance');
  const [searchQuery, setSearchQuery] = useState('');
  const [historyPage, setHistoryPage] = useState(0);

  const resetForm = () => {
    setName('');
    setError('');
    setShowAdd(false);
    setEditingId(null);
  };

  const handleAdd = async () => {
    setError('');
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Contractor name is required');
      return;
    }

    if (contractors.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())) {
      setError('Contractor already exists');
      return;
    }

    setIsProcessing(true);
    const result = await onCreate(trimmedName);
    if (result) {
      resetForm();
    } else {
      setError('Failed to create contractor');
    }
    setIsProcessing(false);
  };

  const handleEdit = async () => {
    if (!editingId) return;
    setError('');
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Contractor name is required');
      return;
    }

    const current = contractors.find(c => c.id === editingId);
    if (trimmedName !== current?.name && 
        contractors.some(c => c.name.toLowerCase() === trimmedName.toLowerCase())) {
      setError('Contractor already exists');
      return;
    }

    setIsProcessing(true);
    const success = await onUpdate(editingId, trimmedName);
    if (success) {
      resetForm();
    } else {
      setError('Failed to update contractor');
    }
    setIsProcessing(false);
  };

  const handleDelete = async (contractor: Contractor) => {
    const hasTransactions = transactions.some(t => t.contractorId === contractor.id);
    if (hasTransactions) {
      alert(`Cannot delete "${contractor.name}" - they have transaction history.`);
      return;
    }

    if (confirm(`Delete contractor "${contractor.name}"?`)) {
      await onDelete(contractor.id);
    }
  };

  const startEdit = (contractor: Contractor) => {
    setEditingId(contractor.id);
    setName(contractor.name);
    setShowAdd(false);
    setError('');
  };

  const selectContractor = (id: string) => {
    setSelectedContractorId(id);
    setHistoryPage(0);
    setView('balance');
  };

  // Filtered contractors
  const filteredContractors = useMemo(() => {
    if (!searchQuery) return contractors;
    const q = searchQuery.toLowerCase();
    return contractors.filter(c => c.name.toLowerCase().includes(q));
  }, [contractors, searchQuery]);

  // Contractor stats
  const contractorStats = useMemo(() => {
    const stats: Record<string, { txCount: number; balance: number }> = {};
    contractors.forEach(c => {
      const txs = transactions.filter(t => t.contractorId === c.id);
      let balance = 0;
      txs.forEach(t => {
        if (t.type === 'OUT') balance += t.quantity;
        else if (t.type === 'IN') balance -= t.quantity;
      });
      stats[c.id] = { txCount: txs.length, balance };
    });
    return stats;
  }, [contractors, transactions]);

  // Calculate ledger for a contractor
  const getContractorLedger = (contractorId: string) => {
    const contractorTx = transactions.filter(t => t.contractorId === contractorId);
    const itemBalances: Record<string, number> = {};
    
    contractorTx.forEach(t => {
      if (!itemBalances[t.itemId]) itemBalances[t.itemId] = 0;
      if (t.type === 'OUT') {
        itemBalances[t.itemId] += t.quantity;
      } else if (t.type === 'IN') {
        itemBalances[t.itemId] -= t.quantity;
      }
    });

    return Object.entries(itemBalances)
      .filter(([_, balance]) => Math.abs(balance) > 0.001)
      .map(([itemId, balance]) => {
        const item = items.find(i => i.id === itemId);
        return {
          id: itemId,
          name: item?.name || 'Unknown Item',
          unit: item?.unit || '',
          balance
        };
      });
  };

  const selectedLedger = useMemo(() => {
    if (!selectedContractorId) return [];
    return getContractorLedger(selectedContractorId);
  }, [selectedContractorId, transactions, items]);

  // Paginated history
  const contractorHistory = useMemo(() => {
    if (!selectedContractorId) return [];
    return transactions
      .filter(t => t.contractorId === selectedContractorId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [selectedContractorId, transactions]);

  const historyTotalPages = Math.ceil(contractorHistory.length / TX_PER_PAGE);
  const paginatedHistory = contractorHistory.slice(
    historyPage * TX_PER_PAGE,
    (historyPage + 1) * TX_PER_PAGE
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-black text-slate-900">Contractors</h2>
          <p className="text-xs text-slate-500">{contractors.length} registered</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowAdd(true); }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
        >
          <HardHat size={18} />
          Add
        </button>
      </div>

      {/* Add/Edit Form */}
      {(showAdd || editingId) && (
        <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
          {error && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-red-600 text-xs font-medium">
              {error}
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contractor name..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:border-indigo-500 outline-none"
              autoFocus
              disabled={isProcessing}
            />
            <button
              onClick={editingId ? handleEdit : handleAdd}
              disabled={isProcessing}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-bold text-sm disabled:opacity-50"
            >
              {isProcessing ? '...' : editingId ? 'Save' : 'Add'}
            </button>
            <button
              onClick={resetForm}
              className="px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg font-bold text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Contractors List */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          {/* Search */}
          <div className="p-3 border-b border-slate-100">
            <div className="relative">
              <input
                type="text"
                placeholder="Search contractors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
              />
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </div>
          </div>

          {/* List */}
          <div className="divide-y divide-slate-50 max-h-[500px] overflow-y-auto">
            {filteredContractors.map(contractor => {
              const stats = contractorStats[contractor.id];
              const isSelected = selectedContractorId === contractor.id;
              return (
                <div 
                  key={contractor.id} 
                  className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                    isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'
                  }`}
                  onClick={() => selectContractor(contractor.id)}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'
                    }`}>
                      <HardHat size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-900 truncate">{contractor.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold">
                        {stats?.txCount || 0} transactions
                        {stats?.balance > 0 && (
                          <span className="ml-1.5 text-red-500">• {stats.balance} pending</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); startEdit(contractor); }}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(contractor); }}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredContractors.length === 0 && (
              <div className="p-8 text-center">
                <p className="text-slate-400 text-sm">{searchQuery ? 'No matches' : 'No contractors yet'}</p>
              </div>
            )}
          </div>
        </div>

        {/* Contractor Details */}
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden flex flex-col">
          {!selectedContractorId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 opacity-40">
              <History size={32} className="text-slate-300 mb-2" />
              <p className="font-bold text-slate-600">Select a contractor</p>
              <p className="text-xs text-slate-400">to view their details</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {contractors.find(c => c.id === selectedContractorId)?.name}
                  </p>
                </div>
                <div className="flex bg-slate-100 p-0.5 rounded-lg">
                  <button
                    onClick={() => { setView('balance'); setHistoryPage(0); }}
                    className={`px-3 py-1.5 rounded text-[10px] font-black uppercase ${
                      view === 'balance' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'
                    }`}
                  >
                    Pending
                  </button>
                  <button
                    onClick={() => { setView('history'); setHistoryPage(0); }}
                    className={`px-3 py-1.5 rounded text-[10px] font-black uppercase ${
                      view === 'history' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'
                    }`}
                  >
                    History
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 p-4 overflow-y-auto max-h-[450px]">
                {view === 'balance' ? (
                  <div className="space-y-2">
                    {selectedLedger.length === 0 ? (
                      <div className="py-8 text-center">
                        <Package size={24} className="mx-auto text-slate-300 mb-2" />
                        <p className="text-sm text-slate-400">No materials held</p>
                      </div>
                    ) : (
                      selectedLedger.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                          <div className="min-w-0">
                            <p className="font-bold text-sm text-slate-900 truncate">{item.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase">{item.unit}</p>
                          </div>
                          <div className={`text-lg font-black tabular-nums ${item.balance > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                            {Math.abs(item.balance)}
                            <span className="text-[10px] ml-1 font-bold">
                              {item.balance > 0 ? 'pending' : 'clear'}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {paginatedHistory.map(tx => {
                      const item = items.find(i => i.id === tx.itemId);
                      // OUT = Given to contractor (red), IN = Taken back (green)
                      const isGiven = tx.type === 'OUT';
                      return (
                        <div key={tx.id} className="p-2.5 bg-slate-50 rounded-lg">
                          <div className="flex justify-between items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-800 truncate">{item?.name || 'Deleted'}</p>
                              <p className="text-[10px] text-slate-400 truncate">"{tx.reason}"</p>
                            </div>
                            <div className="text-right shrink-0">
                              <span className={`text-sm font-black ${isGiven ? 'text-red-500' : 'text-emerald-600'}`}>
                                {isGiven ? 'Given' : 'Taken'} {tx.quantity}
                              </span>
                              <p className="text-[9px] text-slate-400">
                                {new Date(tx.timestamp).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {contractorHistory.length === 0 && (
                      <p className="text-center py-8 text-slate-400 text-sm">No transactions</p>
                    )}

                    {/* Pagination */}
                    {historyTotalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 pt-3">
                        <button
                          onClick={() => setHistoryPage(Math.max(0, historyPage - 1))}
                          disabled={historyPage === 0}
                          className="px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-bold disabled:opacity-50"
                        >
                          Prev
                        </button>
                        <span className="text-xs text-slate-500">{historyPage + 1}/{historyTotalPages}</span>
                        <button
                          onClick={() => setHistoryPage(Math.min(historyTotalPages - 1, historyPage + 1))}
                          disabled={historyPage >= historyTotalPages - 1}
                          className="px-3 py-1.5 bg-white border border-slate-200 rounded text-xs font-bold disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer note */}
              {view === 'balance' && selectedLedger.length > 0 && (
                <div className="p-3 border-t border-slate-100 text-[10px] text-slate-400">
                  <span className="text-red-500 font-bold">Red</span> = given to contractor, <span className="text-emerald-600 font-bold">Green</span> = taken back
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContractorManager;
