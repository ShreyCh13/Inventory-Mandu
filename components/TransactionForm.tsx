import React, { useState, useMemo } from 'react';
import { InventoryItem, Transaction, TransactionType, AuthSession, Contractor, User } from '../types';
import { ArrowDown, ArrowUp, Timer } from './Icons';
import { createContractor } from '../lib/db';
import SearchableSelect from './SearchableSelect';

interface TransactionFormProps {
  type: TransactionType;
  initialItem?: InventoryItem;
  items: InventoryItem[];
  transactions: Transaction[];
  categories: string[];
  contractors: Contractor[];
  users: User[];
  session: AuthSession;
  stockLevels?: Record<string, { stock: number; wip: number }>;
  stockError?: { message: string; available: number } | null;
  onClose: () => void;
  onSubmit: (t: Omit<Transaction, 'id' | 'timestamp'>, newItem?: Omit<InventoryItem, 'id'>) => void;
  onRefreshContractors?: () => void;
}

const TransactionForm: React.FC<TransactionFormProps> = ({ 
  type, 
  initialItem, 
  items, 
  transactions, 
  categories,
  contractors,
  users,
  stockLevels,
  stockError,
  session, 
  onClose, 
  onSubmit,
  onRefreshContractors
}) => {
  const [isNewItem, setIsNewItem] = useState(false);
  
  // Form State
  const [selectedCategory, setSelectedCategory] = useState(initialItem?.category || '');
  const [selectedItemId, setSelectedItemId] = useState(initialItem?.id || '');
  
  // Contractor State
  const [selectedContractorId, setSelectedContractorId] = useState('');
  const [isAddingContractor, setIsAddingContractor] = useState(false);
  const [newContractorName, setNewContractorName] = useState('');
  const [contractorLoading, setContractorLoading] = useState(false);
  
  // Get stock and WIP from the pre-calculated stockLevels (from database view)
  const selectedItemStock = selectedItemId && stockLevels ? (stockLevels[selectedItemId]?.stock || 0) : 0;
  const selectedItemWIP = selectedItemId && stockLevels ? (stockLevels[selectedItemId]?.wip || 0) : 0;
  
  // For OUT transactions, check if we should reduce WIP first
  const hasWIP = selectedItemWIP > 0 && type === 'OUT';
  
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [isCustomUnit, setIsCustomUnit] = useState(false);
  
  const [quantity, setQuantity] = useState<number>(1);
  // Auto-fill user from session
  const user = session.user.displayName;
  const [reason, setReason] = useState('');
  const [isSigned, setIsSigned] = useState(false);
  
  // Optional fields
  const [location, setLocation] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [billNumber, setBillNumber] = useState('');
  const [selectedApprovedBy, setSelectedApprovedBy] = useState('');
  
  // Double-submit protection
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // This must be after quantity is declared
  // For OUT transactions, WIP will be auto-reduced first, so account for that
  const effectiveStockNeeded = type === 'OUT' ? Math.max(0, quantity - selectedItemWIP) : quantity;
  const wouldGoNegative = type !== 'IN' && !isNewItem && selectedItemId && (selectedItemStock - effectiveStockNeeded) < 0;

  // Combine fixed categories with any custom ones already in use
  const allCategories = useMemo(() => {
    const existingInItems = items.map(i => i.category);
    return Array.from(new Set([...categories, ...existingInItems])).sort();
  }, [items, categories]);

  // Categories that have items (for OUT/WIP selection)
  const categoriesWithItems = useMemo(() => {
    const cats = new Set(items.map(i => i.category));
    return Array.from(cats).sort();
  }, [items]);

  // Items filtered by selected category
  const filteredItems = useMemo(() => {
    if (!selectedCategory) return [];
    return items.filter(i => i.category === selectedCategory);
  }, [items, selectedCategory]);

  // All available units
  const UNITS = [
    'Pcs', 'Kg', 'M', 'Ft', 'Ltr', 'Bags', 'Box', 'Bundle', 
    'Roll', 'Set', 'Pair', 'Sqft', 'Sqm', 'Cubic M', 'Ton', 'Dozen'
  ];

  const handleCreateContractor = async () => {
    if (!newContractorName.trim()) return;
    setContractorLoading(true);
    const created = await createContractor(newContractorName.trim());
    if (created) {
      setSelectedContractorId(created.id);
      setIsAddingContractor(false);
      setNewContractorName('');
      onRefreshContractors?.();
    }
    setContractorLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Prevent double submission
    if (isSubmitting) return;
    
    // Validate: Reason is only required for existing items (OUT/WIP), optional for IN
    if (!isSigned || !user || quantity <= 0) return;
    if (!isNewItem && type !== 'IN' && !reason) return;
    if (wouldGoNegative) return; // Prevent negative stock

    setIsSubmitting(true);
    
    try {
      if (isNewItem) {
        if (!newItemName || !newItemCategory || !newItemUnit) return;
        
        await onSubmit({
          itemId: '', // Will be replaced with created item ID
          type,
          quantity,
          user,
          reason: 'Initial Stocking',
          signature: `Signed by ${user}`,
          location: location || undefined,
          amount: amount ? parseFloat(amount) : undefined,
          billNumber: billNumber || undefined,
          contractorId: selectedContractorId || undefined,
          approvedBy: selectedApprovedBy || undefined,
          createdBy: session.user.id
        }, {
          name: newItemName,
          category: newItemCategory,
          categoryId: '',
          unit: newItemUnit,
          minStock: 0,
          createdBy: session.user.id
        });
      } else {
        if (!selectedItemId) return;
        await onSubmit({
          itemId: selectedItemId,
          type,
          quantity,
          user,
          reason: reason,
          signature: `Signed by ${user}`,
          location: location || undefined,
          amount: amount ? parseFloat(amount) : undefined,
          billNumber: billNumber || undefined,
          contractorId: selectedContractorId || undefined,
          approvedBy: selectedApprovedBy || undefined,
          createdBy: session.user.id
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const theme = {
    'IN': { bg: 'bg-indigo-600', label: 'RECEIVE STOCK (IN)' },
    'OUT': { bg: 'bg-slate-900', label: 'TAKE OUT (OUT)' },
    'WIP': { bg: 'bg-amber-500', label: 'IN PROGRESS (WIP)' }
  }[type];

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-lg rounded-t-[40px] sm:rounded-[40px] shadow-2xl overflow-hidden my-auto animate-in slide-in-from-bottom duration-300">
        <div className={`p-6 sm:p-8 border-b border-slate-100 flex justify-between items-center ${theme.bg} text-white`}>
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm">
              {type === 'IN' && <ArrowDown size={28} />}
              {type === 'OUT' && <ArrowUp size={28} />}
              {type === 'WIP' && <Timer size={28} />}
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight">{theme.label}</h2>
              <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">Sign-Off Required</p>
            </div>
          </div>
          <button onClick={onClose} className="bg-white/10 p-2 sm:p-3 rounded-full">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
          {type === 'IN' && !initialItem && (
            <div className="flex p-1 bg-slate-100 rounded-2xl">
              <button
                type="button"
                onClick={() => setIsNewItem(false)}
                className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${!isNewItem ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}
              >
                PICK EXISTING
              </button>
              <button
                type="button"
                onClick={() => setIsNewItem(true)}
                className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${isNewItem ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400'}`}
              >
                + ADD NEW ITEM
              </button>
            </div>
          )}

          {isNewItem ? (
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Item Name</label>
                <input 
                  placeholder="e.g. 50mm Copper Pipe"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-indigo-500 outline-none font-bold text-lg"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Folder / Category</label>
                  {isCustomCategory ? (
                    <input 
                      placeholder="Type folder name..."
                      className="w-full bg-slate-50 border-2 border-indigo-500 rounded-2xl px-5 py-4 outline-none font-bold text-lg"
                      value={newItemCategory}
                      onChange={(e) => setNewItemCategory(e.target.value)}
                      required
                    />
                  ) : (
                    <select 
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-indigo-500 outline-none font-bold text-lg appearance-none"
                      value={newItemCategory}
                      onChange={(e) => {
                        if (e.target.value === "ADD_NEW") {
                          setIsCustomCategory(true);
                          setNewItemCategory("");
                        } else {
                          setNewItemCategory(e.target.value);
                        }
                      }}
                      required
                    >
                      <option value="">Choose Folder...</option>
                      {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                      <option value="ADD_NEW">+ Create New Folder...</option>
                    </select>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Units</label>
                  {isCustomUnit ? (
                    <input 
                      placeholder="Type unit name..."
                      className="w-full bg-slate-50 border-2 border-indigo-500 rounded-2xl px-5 py-4 outline-none font-bold text-lg"
                      value={newItemUnit}
                      onChange={(e) => setNewItemUnit(e.target.value)}
                      required
                    />
                  ) : (
                    <select 
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-indigo-500 outline-none font-bold text-lg appearance-none"
                      value={newItemUnit}
                      onChange={(e) => {
                        if (e.target.value === "ADD_NEW") {
                          setIsCustomUnit(true);
                          setNewItemUnit("");
                        } else {
                          setNewItemUnit(e.target.value);
                        }
                      }}
                      required
                    >
                      <option value="">Select Unit...</option>
                      {UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                      <option value="ADD_NEW">+ New Unit...</option>
                    </select>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Step 1: Select Folder */}
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  <span className="inline-flex items-center justify-center w-5 h-5 bg-slate-200 text-slate-600 rounded-full text-[10px] mr-2">1</span>
                  Select Folder
                </label>
                <select 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-indigo-500 outline-none appearance-none font-bold text-lg"
                  value={selectedCategory}
                  onChange={(e) => {
                    setSelectedCategory(e.target.value);
                    setSelectedItemId(''); // Reset item when folder changes
                  }}
                  required
                  disabled={!!initialItem}
                >
                  <option value="">Choose folder first...</option>
                  {categoriesWithItems.map(cat => (
                    <option key={cat} value={cat}>{cat} ({items.filter(i => i.category === cat).length} items)</option>
                  ))}
                </select>
              </div>

              {/* Step 2: Select Item (only shown after folder is selected) */}
              <div className={selectedCategory ? '' : 'opacity-50 pointer-events-none'}>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  <span className="inline-flex items-center justify-center w-5 h-5 bg-slate-200 text-slate-600 rounded-full text-[10px] mr-2">2</span>
                  Select Item
                </label>
                <SearchableSelect
                  items={filteredItems}
                  value={selectedItemId}
                  onChange={setSelectedItemId}
                  getLabel={(item) => `${item.name} — ${stockLevels?.[item.id]?.stock || 0} ${item.unit}`}
                  getValue={(item) => item.id}
                  placeholder={selectedCategory ? 'Search items...' : 'Select folder first...'}
                  disabled={!!initialItem || !selectedCategory}
                  emptyMessage="No items in this folder"
                />
              </div>

              {selectedItemId && type !== 'IN' && (
                <div className="mt-2 space-y-1">
                  <p className="text-sm font-bold text-slate-500">
                    Current Stock: <span className="text-indigo-600">{selectedItemStock}</span> {items.find(i => i.id === selectedItemId)?.unit}
                  </p>
                  {hasWIP && (
                    <p className="text-sm font-bold text-amber-600">
                      ⏳ Work In Progress: <span className="text-amber-700">{selectedItemWIP}</span> {items.find(i => i.id === selectedItemId)?.unit}
                      <span className="text-xs text-amber-500 block mt-0.5">WIP will be reduced first when removing items</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Quantity</label>
              <input 
                type="number" step="any"
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-indigo-500 outline-none font-black text-xl tabular-nums"
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                Logged In As
              </label>
              <div className="w-full bg-indigo-50 border-2 border-indigo-100 rounded-2xl px-5 py-4 font-bold text-lg text-indigo-700 flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-200 rounded-full flex items-center justify-center text-indigo-600 text-sm font-black">
                  {user.charAt(0).toUpperCase()}
                </div>
                {user}
              </div>
            </div>
          </div>

          {/* Contractor Field */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
              Contractor <span className="text-slate-300">(Optional)</span>
            </label>
            {isAddingContractor ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter contractor name..."
                  className="flex-1 bg-slate-50 border-2 border-indigo-500 rounded-2xl px-5 py-4 outline-none font-bold"
                  value={newContractorName}
                  onChange={(e) => setNewContractorName(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleCreateContractor}
                  disabled={contractorLoading}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50"
                >
                  {contractorLoading ? '...' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={() => { setIsAddingContractor(false); setNewContractorName(''); }}
                  className="bg-slate-100 text-slate-500 px-4 py-2 rounded-xl font-bold"
                >
                  ✕
                </button>
              </div>
            ) : (
              <select
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-indigo-500 outline-none font-medium text-base appearance-none"
                value={selectedContractorId}
                onChange={(e) => {
                  if (e.target.value === 'ADD_NEW') {
                    setIsAddingContractor(true);
                  } else {
                    setSelectedContractorId(e.target.value);
                  }
                }}
              >
                <option value="">No Contractor assigned</option>
                {contractors.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
                <option value="ADD_NEW" className="text-indigo-600 font-bold">+ Add New Contractor...</option>
              </select>
            )}
          </div>

          {/* Optional Fields Section - Hidden for OUT transactions */}
          {type !== 'OUT' && (
            <div className="pt-2">
              <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest mb-3">Optional Details</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    Location <span className="text-slate-300">(Optional)</span>
                  </label>
                  <input 
                    type="text" placeholder="e.g. Site A, Block 2"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-indigo-500 outline-none font-medium text-base"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    Amount ₹ <span className="text-slate-300">(Optional)</span>
                  </label>
                  <input 
                    type="number" step="0.01" placeholder="0.00"
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-indigo-500 outline-none font-bold text-lg tabular-nums"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  Bill / Invoice No. <span className="text-slate-300">(Optional)</span>
                </label>
                <input 
                  type="text" placeholder="e.g. INV-2024-001"
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-indigo-500 outline-none font-medium text-base"
                  value={billNumber}
                  onChange={(e) => setBillNumber(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Approved By - Visible for ALL transaction types */}
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
              Approved By <span className="text-slate-300">(Optional)</span>
            </label>
            <select
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-indigo-500 outline-none font-medium text-base appearance-none"
              value={selectedApprovedBy}
              onChange={(e) => setSelectedApprovedBy(e.target.value)}
            >
              <option value="">No approval selected</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.displayName}</option>
              ))}
            </select>
          </div>

          {!isNewItem && (
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                Remarks {type === 'IN' && <span className="text-slate-300">(Optional)</span>}
              </label>
              <textarea 
                rows={2} placeholder="e.g. Master Bedroom Ceiling"
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-indigo-500 outline-none font-medium text-lg resize-none"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required={type !== 'IN'}
              />
            </div>
          )}

          <div className="bg-slate-50 border-2 border-dashed border-slate-200 p-6 rounded-3xl flex items-center gap-4">
             <input 
               type="checkbox" checked={isSigned}
               onChange={(e) => setIsSigned(e.target.checked)}
               className="w-8 h-8 rounded-xl border-slate-300 text-indigo-600 cursor-pointer"
               id="sign"
             />
             <label htmlFor="sign" className="text-sm font-black text-slate-700 leading-tight">
               I CONFIRM THIS ENTRY <br/>
               <span className="text-indigo-600 font-bold text-[10px] uppercase">Signed by {user}</span>
             </label>
          </div>

          {wouldGoNegative && (
            <div className="bg-red-50 border-2 border-red-200 text-red-600 px-5 py-4 rounded-2xl font-bold text-sm">
              ⚠️ Cannot use {quantity} - only {selectedItemStock} in stock!
            </div>
          )}

          {stockError && (
            <div className="bg-amber-50 border-2 border-amber-300 text-amber-700 px-5 py-4 rounded-2xl font-bold text-sm animate-in slide-in-from-top duration-300">
              <div className="flex items-center gap-2">
                <span className="text-lg">⚠️</span>
                <div>
                  <p>{stockError.message}</p>
                  {stockError.available > 0 && (
                    <p className="text-xs text-amber-600 mt-1">Try requesting {stockError.available} or less.</p>
                  )}
                </div>
              </div>
            </div>
          )}

          <button 
            type="submit"
            disabled={isSubmitting || !isSigned || (!isNewItem && type !== 'IN' && !reason) || !!wouldGoNegative}
            className={`w-full py-5 rounded-[24px] font-black text-xl text-white shadow-xl transition-all ${
              (isSubmitting || !isSigned || (!isNewItem && type !== 'IN' && !reason) || wouldGoNegative) ? 'bg-slate-200 cursor-not-allowed' : `${theme.bg} hover:scale-[1.02] active:scale-95`
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-3">
                <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                SUBMITTING...
              </span>
            ) : (
              'SUBMIT SIGN-OFF'
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default TransactionForm;
