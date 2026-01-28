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
      alert(`Cannot delete "${contractor.name}" - they have transaction history. Delete or reassign their transactions first.`);
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

  // Calculate ledger/stock for a contractor
  const getContractorLedger = (contractorId: string) => {
    const contractorTx = transactions.filter(t => t.contractorId === contractorId);
    const itemBalances: Record<string, number> = {};
    
    contractorTx.forEach(t => {
      if (!itemBalances[t.itemId]) itemBalances[t.itemId] = 0;
      // When OUT to contractor, balance increases
      // When IN from contractor, balance decreases
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Contractor Management</h2>
          <p className="text-slate-500 text-sm mt-1">Manage contractors and track their material balances</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowAdd(true); }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
        >
          <HardHat size={20} />
          Add Contractor
        </button>
      </div>

      {(showAdd || editingId) && (
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100">
          <h3 className="text-lg font-black text-slate-900 mb-4">
            {editingId ? 'Edit Contractor' : 'Add New Contractor'}
          </h3>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe Construction"
              className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 focus:border-indigo-500 outline-none font-medium"
              autoFocus
              disabled={isProcessing}
            />
            <button
              onClick={editingId ? handleEdit : handleAdd}
              disabled={isProcessing}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {isProcessing ? 'Saving...' : editingId ? 'Save' : 'Add'}
            </button>
            <button
              onClick={resetForm}
              className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Contractors List */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-100">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {contractors.length} Registered Contractors
            </p>
          </div>
          <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
            {contractors.map(contractor => (
              <div 
                key={contractor.id} 
                className={`p-4 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer ${selectedContractorId === contractor.id ? 'bg-indigo-50/50' : ''}`}
                onClick={() => setSelectedContractorId(contractor.id)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${selectedContractorId === contractor.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-400'}`}>
                    <HardHat size={20} />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{contractor.name}</p>
                    <p className="text-xs text-slate-500">
                      {transactions.filter(t => t.contractorId === contractor.id).length} Transactions
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); startEdit(contractor); }}
                    className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(contractor); }}
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash size={18} />
                  </button>
                </div>
              </div>
            ))}
            {contractors.length === 0 && (
              <div className="p-12 text-center">
                <p className="text-slate-400 font-medium italic">No contractors added yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Contractor Details / Ledger */}
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden flex flex-col">
          <div className="p-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Contractor Ledger
            </p>
            {selectedContractorId && (
              <span className="text-xs font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">
                Active View
              </span>
            )}
          </div>
          
          <div className="flex-1 p-6">
            {!selectedContractorId ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-3 opacity-40">
                <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-400">
                  <History size={32} />
                </div>
                <div>
                  <p className="font-black text-slate-900">No Contractor Selected</p>
                  <p className="text-sm text-slate-500 max-w-[200px]">Select a contractor from the list to view their material balance</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-black text-slate-900">
                    {contractors.find(c => c.id === selectedContractorId)?.name}
                  </h3>
                  <div className="flex bg-slate-100 p-1 rounded-xl">
                    <button
                      onClick={() => setView('balance')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                        view === 'balance' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'
                      }`}
                    >
                      Balance
                    </button>
                    <button
                      onClick={() => setView('history')}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                        view === 'history' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'
                      }`}
                    >
                      History
                    </button>
                  </div>
                </div>

                {view === 'balance' ? (
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Material Balance (Currently Held)</p>
                    
                    {selectedLedger.length === 0 ? (
                      <div className="bg-slate-50 rounded-2xl p-8 text-center border-2 border-dashed border-slate-100">
                        <p className="text-slate-400 font-bold">No materials currently held</p>
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {selectedLedger.map(item => (
                          <div key={item.id} className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between border border-slate-100/50">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-indigo-600 shadow-sm">
                                <Package size={16} />
                              </div>
                              <div>
                                <p className="font-bold text-slate-900">{item.name}</p>
                                <p className="text-[10px] font-bold text-slate-400 uppercase">{item.unit}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-lg font-black tabular-nums ${item.balance > 0 ? 'text-indigo-600' : 'text-emerald-600'}`}>
                                {item.balance > 0 ? '+' : ''}{item.balance}
                              </p>
                              <p className="text-[10px] font-bold text-slate-400 uppercase">Outstanding</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Recent Contractor Transactions</p>
                    <div className="grid gap-2 max-h-[400px] overflow-y-auto pr-2">
                      {transactions
                        .filter(t => t.contractorId === selectedContractorId)
                        .sort((a, b) => b.timestamp - a.timestamp)
                        .map(tx => {
                          const item = items.find(i => i.id === tx.itemId);
                          return (
                            <div key={tx.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                              <div className="flex justify-between items-start mb-1">
                                <p className="font-bold text-slate-900 text-sm">{item?.name || 'Deleted Item'}</p>
                                <span className={`text-xs font-black tabular-nums ${tx.type === 'IN' ? 'text-emerald-600' : 'text-indigo-600'}`}>
                                  {tx.type === 'IN' ? '← Received' : '→ Issued'} {tx.quantity}
                                </span>
                              </div>
                              <div className="flex justify-between items-end">
                                <p className="text-[10px] text-slate-500 italic">"{tx.reason}"</p>
                                <p className="text-[9px] font-bold text-slate-400">
                                  {new Date(tx.timestamp).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      {transactions.filter(t => t.contractorId === selectedContractorId).length === 0 && (
                        <p className="text-center py-8 text-slate-400 italic">No transactions found</p>
                      )}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-500 italic">
                    * Positive (+) balance means the contractor has taken these items from inventory.
                    Returning them will bring the balance to zero.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContractorManager;
