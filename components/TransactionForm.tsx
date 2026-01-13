
import React, { useState, useMemo } from 'react';
import { InventoryItem, Transaction, TransactionType } from '../types';
import { ArrowDown, ArrowUp, Timer, Plus } from './Icons';
import { PROJECT_CATEGORIES } from '../App';

interface TransactionFormProps {
  type: TransactionType;
  initialItem?: InventoryItem;
  items: InventoryItem[];
  transactions: Transaction[];
  onClose: () => void;
  onSubmit: (t: Omit<Transaction, 'id' | 'timestamp'>, newItem?: Omit<InventoryItem, 'id'>) => void;
}

const TransactionForm: React.FC<TransactionFormProps> = ({ type, initialItem, items, transactions, onClose, onSubmit }) => {
  const [isNewItem, setIsNewItem] = useState(false);
  
  // Form State
  const [selectedCategory, setSelectedCategory] = useState(initialItem?.category || '');
  const [selectedItemId, setSelectedItemId] = useState(initialItem?.id || '');
  
  // Calculate current stock for selected item
  const getCurrentStock = (itemId: string) => {
    return transactions
      .filter(t => t.itemId === itemId)
      .reduce((sum, t) => {
        if (t.type === 'IN') return sum + t.quantity;
        if (t.type === 'OUT' || t.type === 'WIP') return sum - t.quantity;
        return sum;
      }, 0);
  };
  
  const selectedItemStock = selectedItemId ? getCurrentStock(selectedItemId) : 0;
  const wouldGoNegative = type !== 'IN' && !isNewItem && selectedItemId && (selectedItemStock - quantity) < 0;
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  
  const [quantity, setQuantity] = useState<number>(1);
  const [user, setUser] = useState('');
  const [reason, setReason] = useState('');
  const [isSigned, setIsSigned] = useState(false);

  // Combine fixed categories with any custom ones already in use
  const allCategories = useMemo(() => {
    const existingInItems = items.map(i => i.category);
    return Array.from(new Set([...PROJECT_CATEGORIES, ...existingInItems])).sort();
  }, [items]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Validate: Reason is only required for existing items (OUT/WIP/Restock)
    if (!isSigned || !user || quantity <= 0) return;
    if (!isNewItem && !reason) return;
    if (wouldGoNegative) return; // Prevent negative stock

    if (isNewItem) {
      if (!newItemName || !newItemCategory || !newItemUnit) return;
      
      const tempId = Math.random().toString(36).substr(2, 9);
      onSubmit({
        itemId: tempId,
        type,
        quantity,
        user,
        reason: 'Initial Stocking',
        signature: `Signed by ${user}`
      }, {
        name: newItemName,
        category: newItemCategory,
        unit: newItemUnit,
        minStock: 0
      });
    } else {
      if (!selectedItemId) return;
      onSubmit({
        itemId: selectedItemId,
        type,
        quantity,
        user,
        reason: reason,
        signature: `Signed by ${user}`
      });
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
                  <select 
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-indigo-500 outline-none font-bold text-lg appearance-none"
                    value={newItemUnit}
                    onChange={(e) => setNewItemUnit(e.target.value)}
                    required
                  >
                    <option value="">Select Unit...</option>
                    {UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                  </select>
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
                <select 
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-indigo-500 outline-none appearance-none font-bold text-lg"
                  value={selectedItemId}
                  onChange={(e) => setSelectedItemId(e.target.value)}
                  required
                  disabled={!!initialItem || !selectedCategory}
                >
                  <option value="">{selectedCategory ? 'Select item...' : 'Select folder first...'}</option>
                  {filteredItems.map(i => (
                    <option key={i.id} value={i.id}>{i.name} — {getCurrentStock(i.id)} {i.unit}</option>
                  ))}
                </select>
              </div>

              {selectedItemId && type !== 'IN' && (
                <p className="mt-2 text-sm font-bold text-slate-500">
                  Current Stock: <span className="text-indigo-600">{selectedItemStock}</span> {items.find(i => i.id === selectedItemId)?.unit}
                </p>
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
                onChange={(e) => setQuantity(parseFloat(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">User Name</label>
              <input 
                type="text" placeholder="Worker name"
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-indigo-500 outline-none font-bold text-lg"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                required
              />
            </div>
          </div>

          {!isNewItem && (
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Short Reason</label>
              <textarea 
                rows={2} placeholder="e.g. Master Bedroom Ceiling"
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-indigo-500 outline-none font-medium text-lg resize-none"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                required
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
               <span className="text-slate-400 font-bold text-[10px] uppercase">{user || 'Awaiting Name...'}</span>
             </label>
          </div>

          {wouldGoNegative && (
            <div className="bg-red-50 border-2 border-red-200 text-red-600 px-5 py-4 rounded-2xl font-bold text-sm">
              ⚠️ Cannot use {quantity} - only {selectedItemStock} in stock!
            </div>
          )}

          <button 
            type="submit"
            disabled={!isSigned || !user || (!isNewItem && !reason) || wouldGoNegative}
            className={`w-full py-5 rounded-[24px] font-black text-xl text-white shadow-xl transition-all ${
              (!isSigned || !user || (!isNewItem && !reason) || wouldGoNegative) ? 'bg-slate-200 cursor-not-allowed' : `${theme.bg} hover:scale-[1.02] active:scale-95`
            }`}
          >
            SUBMIT SIGN-OFF
          </button>
        </form>
      </div>
    </div>
  );
};

export default TransactionForm;
