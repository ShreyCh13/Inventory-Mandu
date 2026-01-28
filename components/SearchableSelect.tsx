import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';

interface SearchableSelectProps<T> {
  items: T[];
  value: string;
  onChange: (value: string) => void;
  getLabel: (item: T) => string;
  getValue: (item: T) => string;
  getGroup?: (item: T) => string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  emptyMessage?: string;
}

function SearchableSelect<T>({
  items,
  value,
  onChange,
  getLabel,
  getValue,
  getGroup,
  placeholder = 'Select...',
  disabled = false,
  className = '',
  emptyMessage = 'No items found'
}: SearchableSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Debounce search input (300ms)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [search]);

  // Get selected item label
  const selectedLabel = useMemo(() => {
    const selected = items.find(item => getValue(item) === value);
    return selected ? getLabel(selected) : '';
  }, [items, value, getLabel, getValue]);

  // Filter items based on debounced search
  const filteredItems = useMemo(() => {
    if (!debouncedSearch) return items;
    const searchLower = debouncedSearch.toLowerCase();
    return items.filter(item => 
      getLabel(item).toLowerCase().includes(searchLower) ||
      (getGroup && getGroup(item).toLowerCase().includes(searchLower))
    );
  }, [items, debouncedSearch, getLabel, getGroup]);

  // Group items if getGroup is provided
  const groupedItems = useMemo(() => {
    if (!getGroup) return { '': filteredItems };
    
    const groups: Record<string, T[]> = {};
    filteredItems.forEach(item => {
      const group = getGroup(item);
      if (!groups[group]) groups[group] = [];
      groups[group].push(item);
    });
    
    // Sort groups alphabetically
    const sortedGroups: Record<string, T[]> = {};
    Object.keys(groups).sort().forEach(key => {
      sortedGroups[key] = groups[key];
    });
    
    return sortedGroups;
  }, [filteredItems, getGroup]);

  // Flatten for keyboard navigation
  const flatItems = useMemo(() => {
    const flat: T[] = [];
    Object.values(groupedItems).forEach(group => {
      flat.push(...group);
    });
    return flat;
  }, [groupedItems]);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch('');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const highlighted = listRef.current.querySelector('[data-highlighted="true"]');
      if (highlighted) {
        highlighted.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex(prev => 
            prev < flatItems.length - 1 ? prev + 1 : 0
          );
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) {
          setHighlightedIndex(prev => 
            prev > 0 ? prev - 1 : flatItems.length - 1
          );
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (isOpen && flatItems[highlightedIndex]) {
          onChange(getValue(flatItems[highlightedIndex]));
          setIsOpen(false);
          setSearch('');
        } else if (!isOpen) {
          setIsOpen(true);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearch('');
        break;
      case 'Tab':
        if (isOpen) {
          setIsOpen(false);
          setSearch('');
        }
        break;
    }
  };

  const handleSelect = (item: T) => {
    onChange(getValue(item));
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`w-full text-left px-4 py-3 border-2 rounded-xl bg-white flex items-center justify-between gap-2 transition-all ${
          isOpen ? 'border-indigo-500 ring-2 ring-indigo-100' : 'border-slate-200'
        } ${disabled ? 'bg-slate-50 cursor-not-allowed opacity-60' : 'hover:border-slate-300 cursor-pointer'}`}
      >
        <span className={selectedLabel ? 'text-slate-900' : 'text-slate-400'}>
          {selectedLabel || placeholder}
        </span>
        <svg 
          width="20" 
          height="20" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2"
          className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        >
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border-2 border-slate-200 rounded-xl shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Search Input */}
          <div className="p-2 border-b border-slate-100">
            <div className="relative">
              <svg 
                width="18" 
                height="18" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              >
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search..."
                className="w-full pl-10 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Items List */}
          <div ref={listRef} className="max-h-60 overflow-y-auto">
            {flatItems.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-400 text-sm">
                {emptyMessage}
              </div>
            ) : (
              Object.entries(groupedItems).map(([group, groupItems]) => (
                <div key={group}>
                  {/* Group Header */}
                  {getGroup && group && (
                    <div className="px-4 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0">
                      {group}
                    </div>
                  )}
                  
                  {/* Group Items */}
                  {groupItems.map((item) => {
                    const itemValue = getValue(item);
                    const itemIndex = flatItems.indexOf(item);
                    const isHighlighted = itemIndex === highlightedIndex;
                    const isSelected = itemValue === value;
                    
                    return (
                      <button
                        key={itemValue}
                        type="button"
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setHighlightedIndex(itemIndex)}
                        data-highlighted={isHighlighted}
                        className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                          isHighlighted ? 'bg-indigo-50' : ''
                        } ${isSelected ? 'text-indigo-600 font-medium' : 'text-slate-700'}`}
                      >
                        {isSelected && (
                          <svg 
                            width="16" 
                            height="16" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="3"
                            className="text-indigo-600 shrink-0"
                          >
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                        <span className={`truncate ${isSelected ? '' : 'ml-7'}`}>
                          {getLabel(item)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SearchableSelect;
