import React, { useMemo, useState, useEffect } from 'react';
import { InventoryItem, Transaction } from '../types';
import { Package, Timer } from './Icons';

interface ItemManagerProps {
  items: InventoryItem[];
  transactions: Transaction[];
  stockLevels: Record<string, { stock: number; wip: number }>;
}

const ITEMS_PER_PAGE = 50;
const SEARCH_DEBOUNCE_MS = 300;

const ItemManager: React.FC<ItemManagerProps> = ({ items, transactions, stockLevels }) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState(''); // Debounced value
  const [currentPage, setCurrentPage] = useState(0);
  const [sortBy, setSortBy] = useState<'name' | 'stock' | 'wip'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Calculate last location for each item - optimized with Map for O(n) instead of O(n*m)
  const itemLocations = useMemo(() => {
    // Track latest transaction timestamp and location for each item
    const locationData: Record<string, { location: string; timestamp: number }> = {};
    
    // Single pass through transactions
    transactions.forEach(t => {
      if (!t.location) return;
      
      const existing = locationData[t.itemId];
      if (!existing || t.timestamp > existing.timestamp) {
        locationData[t.itemId] = { location: t.location, timestamp: t.timestamp };
      }
    });
    
    // Convert to simple location map
    const locations: Record<string, string | null> = {};
    items.forEach(item => {
      locations[item.id] = locationData[item.id]?.location || null;
    });
    
    return locations;
  }, [items, transactions]);

  // Use pre-calculated stock levels from database view (much more efficient)
  const itemStats = useMemo(() => {
    return items.map(item => {
      const levels = stockLevels[item.id] || { stock: 0, wip: 0 };
      return {
        ...item,
        stock: levels.stock,
        wip: levels.wip,
        location: itemLocations[item.id]
      };
    });
  }, [items, stockLevels, itemLocations]);

  // Group by category for sidebar
  const categoryStats = useMemo(() => {
    const stats: Record<string, { count: number; lowStock: number }> = {};
    itemStats.forEach(item => {
      if (!stats[item.category]) stats[item.category] = { count: 0, lowStock: 0 };
      stats[item.category].count++;
      if (item.stock <= item.minStock) stats[item.category].lowStock++;
    });
    return stats;
  }, [itemStats]);

  const sortedCategories = Object.keys(categoryStats).sort();

  // Filter items
  const filteredItems = useMemo(() => {
    let result = itemStats;
    
    if (selectedCategory) {
      result = result.filter(item => item.category === selectedCategory);
    }
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'stock') cmp = a.stock - b.stock;
      else if (sortBy === 'wip') cmp = a.wip - b.wip;
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [itemStats, selectedCategory, searchQuery, sortBy, sortDir]);

  // Paginate
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = filteredItems.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE
  );

  const handleSort = (field: 'name' | 'stock' | 'wip') => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
  };

  const handleCategorySelect = (cat: string | null) => {
    setSelectedCategory(cat);
    setCurrentPage(0);
  };

  const handleSearch = (value: string) => {
    setSearchInput(value);
    setCurrentPage(0);
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search items..."
          value={searchInput}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 bg-white border-2 border-slate-100 rounded-xl focus:border-indigo-500 outline-none text-sm font-bold placeholder:text-slate-300"
        />
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        {searchInput && (
          <button onClick={() => handleSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {/* Category Pills - Multi-line Grid */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => handleCategorySelect(null)}
          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            !selectedCategory 
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
              : 'bg-white text-slate-500 border border-slate-200 hover:border-indigo-300'
          }`}
        >
          All ({items.length})
        </button>
        {sortedCategories.map(cat => (
          <button
            key={cat}
            onClick={() => handleCategorySelect(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              selectedCategory === cat 
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' 
                : 'bg-white text-slate-500 border border-slate-200 hover:border-indigo-300'
            }`}
          >
            {cat}
            <span className={`${selectedCategory === cat ? 'bg-white/20' : 'bg-slate-100'} px-1.5 py-0.5 rounded text-[10px]`}>
              {categoryStats[cat]?.count}
            </span>
            {categoryStats[cat]?.lowStock > 0 && (
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
            )}
          </button>
        ))}
      </div>

      {/* Stats Bar */}
      <div className="flex items-center justify-between text-xs">
        <p className="text-slate-400 font-bold">
          {filteredItems.length} items {selectedCategory && `in ${selectedCategory}`}
        </p>
        {totalPages > 1 && (
          <p className="text-slate-400 font-bold">Page {currentPage + 1} / {totalPages}</p>
        )}
      </div>

      {/* Items Table */}
      {filteredItems.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-100 overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <button 
              onClick={() => handleSort('name')} 
              className="col-span-5 text-left flex items-center gap-1 hover:text-slate-600"
            >
              Item {sortBy === 'name' && (sortDir === 'asc' ? '↑' : '↓')}
            </button>
            <button 
              onClick={() => handleSort('stock')} 
              className="col-span-2 text-center flex items-center justify-center gap-1 hover:text-slate-600"
            >
              Stock {sortBy === 'stock' && (sortDir === 'asc' ? '↑' : '↓')}
            </button>
            <button 
              onClick={() => handleSort('wip')} 
              className="col-span-2 text-center flex items-center justify-center gap-1 hover:text-amber-600 text-amber-500"
            >
              WIP {sortBy === 'wip' && (sortDir === 'asc' ? '↑' : '↓')}
            </button>
            <div className="col-span-3 text-left">Location</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-slate-50 max-h-[65vh] overflow-y-auto">
            {paginatedItems.map(item => (
              <div 
                key={item.id} 
                className={`grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-slate-50 transition-colors ${
                  item.wip > 0 ? 'bg-amber-50/50' : ''
                }`}
              >
                {/* Item Name */}
                <div className="col-span-5 min-w-0">
                  <p className="font-bold text-sm text-slate-900 truncate">{item.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase">
                    {item.category} • {item.unit}
                  </p>
                </div>

                {/* Stock */}
                <div className="col-span-2 text-center">
                  <span className={`text-lg font-black tabular-nums ${
                    item.stock <= 0 ? 'text-red-500' : 
                    item.stock <= item.minStock ? 'text-amber-500' : 
                    'text-emerald-600'
                  }`}>
                    {item.stock}
                  </span>
                </div>

                {/* WIP */}
                <div className="col-span-2 text-center">
                  {item.wip > 0 ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-black tabular-nums">
                      <Timer size={12} />
                      {item.wip}
                    </span>
                  ) : (
                    <span className="text-slate-300 text-sm">—</span>
                  )}
                </div>

                {/* Location */}
                <div className="col-span-3 min-w-0">
                  {item.location ? (
                    <span className="text-xs text-slate-600 font-medium truncate block">{item.location}</span>
                  ) : (
                    <span className="text-slate-300 text-xs">—</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 p-3 bg-slate-50 border-t border-slate-100">
              <button
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-xs font-bold text-slate-500 px-4">
                {currentPage + 1} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages - 1, currentPage + 1))}
                disabled={currentPage >= totalPages - 1}
                className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="py-16 text-center bg-white rounded-2xl border-2 border-dashed border-slate-100">
          <Package size={32} className="mx-auto text-slate-200 mb-2" />
          <h3 className="text-lg font-black text-slate-900 mb-1">
            {searchQuery ? 'No matches' : 'No Items'}
          </h3>
          <p className="text-slate-400 text-sm">
            {searchQuery ? 'Try different terms' : 'Add items via Dashboard'}
          </p>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-emerald-500 rounded-full"></span> In Stock
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-amber-500 rounded-full"></span> Low Stock
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 bg-red-500 rounded-full"></span> Out of Stock
        </div>
        <div className="flex items-center gap-1.5">
          <Timer size={12} className="text-amber-600" /> Work in Progress
        </div>
      </div>
    </div>
  );
};

export default ItemManager;
