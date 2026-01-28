import React, { useMemo, useState, useEffect } from 'react';
import { InventoryItem, Transaction } from '../types';
import { Package, Timer } from './Icons';

interface ItemManagerProps {
  items: InventoryItem[];
  transactions: Transaction[];
  stockLevels: Record<string, { stock: number; wip: number }>;
}

const SEARCH_DEBOUNCE_MS = 300;

const ItemManager: React.FC<ItemManagerProps> = ({ items, transactions, stockLevels }) => {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState(''); // Debounced value

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchQuery(searchInput);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

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

  // Calculate last location for each item - optimized with Map for O(n) instead of O(n*m)
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

  // Use pre-calculated stock levels from database view
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

  // Filter items - search everything
  const filteredStats = useMemo(() => {
    if (!searchQuery) return itemStats;
    
    const q = searchQuery.toLowerCase();
    return itemStats.filter(item => 
      item.name.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      item.unit.toLowerCase().includes(q) ||
      (item.description?.toLowerCase().includes(q)) ||
      (item.location?.toLowerCase().includes(q))
    );
  }, [itemStats, searchQuery]);

  // Group filtered items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, typeof filteredStats> = {};
    filteredStats.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    // Sort items within each category
    Object.values(groups).forEach(items => {
      items.sort((a, b) => a.name.localeCompare(b.name));
    });
    return groups;
  }, [filteredStats]);

  // Category stats
  const categoryStats = useMemo(() => {
    const stats: Record<string, { count: number; totalStock: number; lowStock: number }> = {};
    Object.entries(groupedItems).forEach(([cat, items]) => {
      stats[cat] = {
        count: items.length,
        totalStock: items.reduce((sum, i) => sum + i.stock, 0),
        lowStock: items.filter(i => i.stock <= i.minStock).length
      };
    });
    return stats;
  }, [groupedItems]);

  const sortedCategories = Object.keys(groupedItems).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

  // Auto-expand categories when searching
  useEffect(() => {
    if (searchQuery) {
      setExpandedCategories(new Set(sortedCategories));
    }
  }, [searchQuery, sortedCategories]);

  const handleSearch = (value: string) => {
    setSearchInput(value);
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search items, categories, locations..."
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

      {/* Stats Bar */}
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
                      <h3 className="font-black text-xl text-slate-900">{cat}</h3>
                      <p className="text-sm text-slate-400 font-bold">
                        {categoryItems.length} item{categoryItems.length !== 1 ? 's' : ''}
                        {categoryStats[cat]?.lowStock > 0 && (
                          <span className="text-red-500 ml-2">• {categoryStats[cat].lowStock} low</span>
                        )}
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
                  <div className="border-t border-slate-100 divide-y divide-slate-50">
                    {categoryItems.map(item => (
                      <div 
                        key={item.id} 
                        className={`flex items-center gap-4 p-3 hover:bg-slate-50 transition-colors ${
                          item.wip > 0 ? 'bg-amber-50/50' : ''
                        }`}
                      >
                        {/* Item Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-black text-base text-slate-900 truncate">{item.name}</p>
                            {item.wip > 0 && (
                              <span className="shrink-0 inline-flex items-center gap-1 text-xs font-black text-amber-600 bg-amber-100 px-2 py-0.5 rounded">
                                <Timer size={12} /> WIP:{item.wip}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400 font-bold uppercase tracking-wider">
                            <span>{item.unit}</span>
                            {item.location && (
                              <>
                                <span>•</span>
                                <span className="text-indigo-500 normal-case">📍 {item.location}</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Stock */}
                        <div className="text-right shrink-0">
                          <span className={`text-2xl font-black tabular-nums ${
                            item.stock <= 0 ? 'text-red-500' : 
                            item.stock <= item.minStock ? 'text-amber-500' : 
                            'text-emerald-600'
                          }`}>
                            {item.stock}
                          </span>
                          <p className="text-xs text-slate-400 font-bold uppercase">stock</p>
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
