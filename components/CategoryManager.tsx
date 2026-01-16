import React, { useState } from 'react';
import { InventoryItem } from '../types';
import { Folder, FolderPlus, Trash, Edit, Package } from './Icons';

interface CategoryManagerProps {
  categories: string[];
  items: InventoryItem[];
  onUpdate: (categories: string[]) => void;
  onUpdateItemCategory: (itemId: string, newCategory: string) => void;
  onUpdateItem: (itemId: string, updates: Partial<InventoryItem>) => void;
  onCreateItem: (item: Omit<InventoryItem, 'id'>) => void | Promise<void>;
}

const CategoryManager: React.FC<CategoryManagerProps> = ({ 
  categories, 
  items, 
  onUpdate,
  onUpdateItemCategory,
  onUpdateItem,
  onCreateItem
}) => {
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemUnit, setEditItemUnit] = useState('');
  const [editItemMinStock, setEditItemMinStock] = useState('');
  const [editItemCategory, setEditItemCategory] = useState('');
  const [itemError, setItemError] = useState('');
  const [isItemProcessing, setIsItemProcessing] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [addItemName, setAddItemName] = useState('');
  const [addItemUnit, setAddItemUnit] = useState('');
  const [addItemMinStock, setAddItemMinStock] = useState('0');
  const [addItemCategory, setAddItemCategory] = useState('');
  const [addItemError, setAddItemError] = useState('');

  // Get item count for each category
  const getCategoryItemCount = (category: string) => {
    return items.filter(item => item.category === category).length;
  };

  const resetForm = () => {
    setNewCategoryName('');
    setError('');
    setShowAddCategory(false);
    setEditingCategory(null);
  };

  const resetItemForm = () => {
    setEditingItem(null);
    setEditItemName('');
    setEditItemUnit('');
    setEditItemMinStock('');
    setEditItemCategory('');
    setItemError('');
    setIsItemProcessing(false);
  };

  const resetAddItemForm = () => {
    setShowAddItem(false);
    setAddItemName('');
    setAddItemUnit('');
    setAddItemMinStock('0');
    setAddItemCategory('');
    setAddItemError('');
  };

  const handleAddCategory = async () => {
    setError('');
    const trimmedName = newCategoryName.trim();
    
    if (!trimmedName) {
      setError('Category name is required');
      return;
    }

    if (categories.some(c => c.toLowerCase() === trimmedName.toLowerCase())) {
      setError('Category already exists');
      return;
    }

    setIsProcessing(true);
    onUpdate([...categories, trimmedName].sort());
    resetForm();
    setIsProcessing(false);
  };

  const handleEditCategory = async () => {
    setError('');
    const trimmedName = newCategoryName.trim();
    
    if (!trimmedName) {
      setError('Category name is required');
      return;
    }

    if (trimmedName !== editingCategory && 
        categories.some(c => c.toLowerCase() === trimmedName.toLowerCase())) {
      setError('Category already exists');
      return;
    }

    setIsProcessing(true);

    // Update category name
    const newCategories = categories.map(c => 
      c === editingCategory ? trimmedName : c
    ).sort();
    
    // Update all items in this category
    const itemsToUpdate = items.filter(item => item.category === editingCategory);
    for (const item of itemsToUpdate) {
      await onUpdateItemCategory(item.id, trimmedName);
    }

    onUpdate(newCategories);
    resetForm();
    setIsProcessing(false);
  };

  const handleDeleteCategory = async (category: string) => {
    const itemCount = getCategoryItemCount(category);
    
    if (itemCount > 0) {
      alert(`Cannot delete "${category}" - it has ${itemCount} item(s). Move or delete the items first.`);
      return;
    }

    if (confirm(`Delete category "${category}"? This action cannot be undone.`)) {
      onUpdate(categories.filter(c => c !== category));
    }
  };

  const startEdit = (category: string) => {
    setEditingCategory(category);
    setNewCategoryName(category);
    setShowAddCategory(false);
    setError('');
  };

  const toggleExpanded = (category: string) => {
    setExpandedCategory(prev => prev === category ? null : category);
  };

  const startEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setEditItemName(item.name);
    setEditItemUnit(item.unit);
    setEditItemMinStock(item.minStock.toString());
    setEditItemCategory(item.category);
    setItemError('');
  };

  const handleSaveItemEdit = async () => {
    if (!editingItem) return;
    setItemError('');

    const trimmedName = editItemName.trim();
    const trimmedUnit = editItemUnit.trim();
    const parsedMinStock = Number(editItemMinStock);

    if (!trimmedName) {
      setItemError('Item name is required');
      return;
    }
    if (!trimmedUnit) {
      setItemError('Unit is required');
      return;
    }
    if (Number.isNaN(parsedMinStock) || parsedMinStock < 0) {
      setItemError('Min stock must be 0 or greater');
      return;
    }

    setIsItemProcessing(true);

    if (editItemCategory && editItemCategory !== editingItem.category) {
      await onUpdateItemCategory(editingItem.id, editItemCategory);
    }

    const updates: Partial<InventoryItem> = {};
    if (trimmedName !== editingItem.name) updates.name = trimmedName;
    if (trimmedUnit !== editingItem.unit) updates.unit = trimmedUnit;
    if (parsedMinStock !== editingItem.minStock) updates.minStock = parsedMinStock;

    if (Object.keys(updates).length > 0) {
      await onUpdateItem(editingItem.id, updates);
    }

    resetItemForm();
  };

  const openAddItem = (category: string) => {
    setAddItemCategory(category);
    setAddItemName('');
    setAddItemUnit('');
    setAddItemMinStock('0');
    setAddItemError('');
    setShowAddItem(true);
  };

  const handleAddItem = async () => {
    setAddItemError('');
    const trimmedName = addItemName.trim();
    const trimmedUnit = addItemUnit.trim();
    const parsedMinStock = Number(addItemMinStock);

    if (!trimmedName) {
      setAddItemError('Item name is required');
      return;
    }
    if (!trimmedUnit) {
      setAddItemError('Unit is required');
      return;
    }
    if (Number.isNaN(parsedMinStock) || parsedMinStock < 0) {
      setAddItemError('Min stock must be 0 or greater');
      return;
    }
    if (!addItemCategory) {
      setAddItemError('Category is required');
      return;
    }

    setIsItemProcessing(true);
    await onCreateItem({
      name: trimmedName,
      category: addItemCategory,
      categoryId: '',
      unit: trimmedUnit,
      minStock: parsedMinStock,
      description: '',
      createdBy: ''
    });
    setIsItemProcessing(false);
    resetAddItemForm();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-900">Category Management</h2>
          <p className="text-slate-500 text-sm mt-1">Add, edit, or remove inventory categories/folders</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowAddCategory(true); }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
        >
          <FolderPlus size={20} />
          Add Category
        </button>
      </div>

      {/* Add/Edit Category Form */}
      {(showAddCategory || editingCategory) && (
        <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-100">
          <h3 className="text-lg font-black text-slate-900 mb-4">
            {editingCategory ? `Edit "${editingCategory}"` : 'Add New Category'}
          </h3>
          
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <input
              type="text"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              placeholder="e.g. Flooring Materials"
              className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-3 focus:border-indigo-500 outline-none font-medium"
              autoFocus
              disabled={isProcessing}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  editingCategory ? handleEditCategory() : handleAddCategory();
                }
                if (e.key === 'Escape') {
                  resetForm();
                }
              }}
            />
            <button
              onClick={editingCategory ? handleEditCategory : handleAddCategory}
              disabled={isProcessing}
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50"
            >
              {isProcessing ? 'Saving...' : editingCategory ? 'Save' : 'Add'}
            </button>
            <button
              onClick={resetForm}
              disabled={isProcessing}
              className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Categories Grid */}
      <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="p-4 bg-slate-50 border-b border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {categories.length} Categories
          </p>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {categories.map(category => {
            const itemCount = getCategoryItemCount(category);
            const categoryItems = items.filter(item => item.category === category);
            return (
              <div key={category} className="space-y-3">
                <div 
                  className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between hover:bg-slate-100 transition-colors group cursor-pointer"
                  onClick={() => toggleExpanded(category)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                      <Folder size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 leading-tight break-words">{category}</p>
                      <p className="text-xs text-slate-500">
                        {itemCount} {itemCount === 1 ? 'item' : 'items'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 opacity-100 transition-opacity shrink-0 ml-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(category);
                      }}
                      className="px-3 py-1.5 text-[11px] font-bold text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors whitespace-nowrap"
                    >
                      {expandedCategory === category ? 'Hide Items' : 'Manage Items'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(category);
                      }}
                      className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                      title="Edit Category"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCategory(category);
                      }}
                      className={`p-2 rounded-lg transition-all ${
                        itemCount > 0 
                          ? 'text-slate-300 cursor-not-allowed' 
                          : 'text-slate-400 hover:text-red-500 hover:bg-white'
                      }`}
                      title={itemCount > 0 ? 'Cannot delete - has items' : 'Delete Category'}
                      disabled={itemCount > 0}
                    >
                      <Trash size={16} />
                    </button>
                  </div>
                </div>

                {expandedCategory === category && (
                  <div className="bg-white border border-slate-100 rounded-2xl p-4 space-y-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openAddItem(category);
                      }}
                      className="w-full py-2.5 bg-indigo-50 text-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-100 transition-colors"
                    >
                      + Add Item to {category}
                    </button>
                    {categoryItems.length > 0 ? (
                      categoryItems.map(item => (
                        <div key={item.id} className="flex items-center justify-between gap-3 p-3 bg-slate-50 rounded-xl">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 truncate">{item.name}</p>
                            <p className="text-xs text-slate-500">
                              {item.unit} • Min {item.minStock}
                            </p>
                          </div>
                          <button
                            onClick={() => startEditItem(item)}
                            className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                          >
                            Edit
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 text-center py-3">No items in this category</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-3xl p-6 border border-amber-100">
        <h3 className="font-black text-amber-900 mb-2">💡 Tips</h3>
        <ul className="text-sm text-amber-800 space-y-1">
          <li>• Renaming a category will update all items in that category</li>
          <li>• Categories with items cannot be deleted - move or delete items first</li>
          <li>• New categories are sorted alphabetically</li>
          <li>• Use the package button to edit items within a category</li>
          <li>• Changes sync in real-time across all devices</li>
        </ul>
      </div>

      {/* Add Item Modal */}
      {showAddItem && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[120] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-emerald-500 to-teal-500 text-white">
              <div>
                <h2 className="text-xl font-black">Add Item</h2>
                <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">
                  {addItemCategory}
                </p>
              </div>
              <button onClick={resetAddItemForm} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {addItemError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">
                  {addItemError}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  Item Name
                </label>
                <input
                  type="text"
                  value={addItemName}
                  onChange={(e) => setAddItemName(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 focus:border-emerald-500 outline-none font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={addItemUnit}
                    onChange={(e) => setAddItemUnit(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 focus:border-emerald-500 outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    Min Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={addItemMinStock}
                    onChange={(e) => setAddItemMinStock(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 focus:border-emerald-500 outline-none font-medium tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  Category
                </label>
                <select
                  value={addItemCategory}
                  onChange={(e) => setAddItemCategory(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 focus:border-emerald-500 outline-none font-medium"
                >
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={resetAddItemForm}
                  className="flex-1 py-4 rounded-2xl font-black text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all"
                  disabled={isItemProcessing}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddItem}
                  className="flex-1 py-4 rounded-2xl font-black text-white bg-emerald-600 hover:bg-emerald-700 shadow-xl shadow-emerald-200 transition-all disabled:opacity-50"
                  disabled={isItemProcessing}
                >
                  {isItemProcessing ? 'Adding...' : 'Add Item'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[120] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-indigo-500 to-purple-500 text-white">
              <div>
                <h2 className="text-xl font-black">Edit Item</h2>
                <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest">
                  {editingItem.name}
                </p>
              </div>
              <button onClick={resetItemForm} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-colors">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {itemError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm font-medium">
                  {itemError}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  Item Name
                </label>
                <input
                  type="text"
                  value={editItemName}
                  onChange={(e) => setEditItemName(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 focus:border-indigo-500 outline-none font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    Unit
                  </label>
                  <input
                    type="text"
                    value={editItemUnit}
                    onChange={(e) => setEditItemUnit(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 focus:border-indigo-500 outline-none font-medium"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                    Min Stock
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editItemMinStock}
                    onChange={(e) => setEditItemMinStock(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 focus:border-indigo-500 outline-none font-medium tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                  Category
                </label>
                <select
                  value={editItemCategory}
                  onChange={(e) => setEditItemCategory(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-3 focus:border-indigo-500 outline-none font-medium"
                >
                  {categories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={resetItemForm}
                  className="flex-1 py-4 rounded-2xl font-black text-slate-500 bg-slate-100 hover:bg-slate-200 transition-all"
                  disabled={isItemProcessing}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSaveItemEdit}
                  className="flex-1 py-4 rounded-2xl font-black text-white bg-indigo-600 hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all disabled:opacity-50"
                  disabled={isItemProcessing}
                >
                  {isItemProcessing ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CategoryManager;
