import React, { useState } from 'react';
import { InventoryItem } from '../types';
import { Folder, FolderPlus, Trash, Edit } from './Icons';

interface CategoryManagerProps {
  categories: string[];
  items: InventoryItem[];
  onUpdate: (categories: string[]) => void;
  onUpdateItemCategory: (itemId: string, newCategory: string) => void;
}

const CategoryManager: React.FC<CategoryManagerProps> = ({ 
  categories, 
  items, 
  onUpdate,
  onUpdateItemCategory 
}) => {
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

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
            return (
              <div 
                key={category} 
                className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between hover:bg-slate-100 transition-colors group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                    <Folder size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900 truncate">{category}</p>
                    <p className="text-xs text-slate-500">
                      {itemCount} {itemCount === 1 ? 'item' : 'items'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => startEdit(category)}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-lg transition-all"
                    title="Edit Category"
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteCategory(category)}
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
          <li>• Changes sync in real-time across all devices</li>
        </ul>
      </div>
    </div>
  );
};

export default CategoryManager;
