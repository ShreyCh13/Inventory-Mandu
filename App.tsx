import React, { useState, useEffect, useCallback, useRef } from 'react';
import { InventoryItem, Transaction, TransactionType, AppSettings, AuthSession, Category, User, Contractor } from './types';
import { supabase, isSupabaseConfigured, subscribeToTableThrottled, RealtimePayload, ConnectionQuality, subscribeToConnectionState, startConnectionMonitoring, getConnectionState } from './lib/supabase';
import * as db from './lib/db';
import { InsufficientStockError, PendingOperation, setStorageWarningCallback, checkStorageHealth } from './lib/db';
import { dbToItem, dbToTransaction, dbToCategory, dbToContractor } from './lib/database.types';
import Dashboard from './components/Dashboard';
import TransactionForm from './components/TransactionForm';
import ItemManager from './components/ItemManager';
import HistoryLog from './components/HistoryLog';
import LoginPage from './components/LoginPage';
import AdminPanel from './components/AdminPanel';
import SyncConflictDialog from './components/SyncConflictDialog';
import { Plus, Minus, Package, History, LayoutDashboard, Settings, User as UserIcon, LogOut } from './components/Icons';

// Default categories - will be loaded from database
export const DEFAULT_CATEGORIES = [
  "Paint", "Polish", "POP", "Electrical", "Lighting", 
  "Civil Consumables", "Plumbing", "Fire", "HVAC", 
  "Wood", "Carpenter", "Landscaping", "Water bodies", 
  "Pathhar", "Wire Outdoor Electrical", "Sanitary", 
  "Kitchen", "Lift", "Civil (fawda, tasla etc)", "Miscellaneous"
];

const ZOOM_LEVELS = [0.8, 0.9, 1, 1.1, 1.25, 1.5];
const DEFAULT_ZOOM_INDEX = 2; // 100%

const App: React.FC = () => {
  // Zoom state - persisted to localStorage
  const [zoomIndex, setZoomIndex] = useState<number>(() => {
    const saved = localStorage.getItem('qs_zoom_level');
    if (saved) {
      const idx = parseInt(saved, 10);
      if (idx >= 0 && idx < ZOOM_LEVELS.length) return idx;
    }
    return DEFAULT_ZOOM_INDEX;
  });

  const zoomLevel = ZOOM_LEVELS[zoomIndex];

  const handleZoomIn = () => {
    if (zoomIndex < ZOOM_LEVELS.length - 1) {
      const newIndex = zoomIndex + 1;
      setZoomIndex(newIndex);
      localStorage.setItem('qs_zoom_level', String(newIndex));
    }
  };

  const handleZoomOut = () => {
    if (zoomIndex > 0) {
      const newIndex = zoomIndex - 1;
      setZoomIndex(newIndex);
      localStorage.setItem('qs_zoom_level', String(newIndex));
    }
  };

  const handleZoomReset = () => {
    setZoomIndex(DEFAULT_ZOOM_INDEX);
    localStorage.setItem('qs_zoom_level', String(DEFAULT_ZOOM_INDEX));
  };

  // Authentication state
  const [session, setSession] = useState<AuthSession | null>(() => {
    const saved = localStorage.getItem('qs_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Check if session is expired (30 days for better mobile persistence)
        const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days
        if (Date.now() - parsed.loginAt > SESSION_DURATION) {
          localStorage.removeItem('qs_session');
          return null;
        }
        return parsed;
      } catch (e) {
        // Invalid session data, clear it
        localStorage.removeItem('qs_session');
        return null;
      }
    }
    return null;
  });

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [settings, setSettings] = useState<AppSettings>({ googleSheetUrl: '' });
  const [users, setUsers] = useState<User[]>([]);
  const [stockLevels, setStockLevels] = useState<Record<string, { stock: number; wip: number }>>({});
  
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [connectionQuality, setConnectionQuality] = useState<ConnectionQuality>('good');
  const [connectionLatency, setConnectionLatency] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [pendingSummary, setPendingSummary] = useState({ pending: 0, conflicts: 0 });
  const [isDataGuarded, setIsDataGuarded] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'dashboard' | 'items' | 'history' | 'admin'>('dashboard');
  const [showTransactionModal, setShowTransactionModal] = useState<{type: TransactionType, item?: InventoryItem} | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [stockError, setStockError] = useState<{ message: string; available: number } | null>(null);
  
  // Conflict resolution dialog state
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictedOps, setConflictedOps] = useState<PendingOperation[]>([]);
  
  // Session expiry warning state
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  
  // Storage warning state
  const [storageWarning, setStorageWarning] = useState<string | null>(null);

  const subscriptionsRef = useRef<(() => void)[]>([]);
  const refreshPendingSummary = () => setPendingSummary(db.getPendingOpsSummary());

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured() && isOnline) {
        await db.processPendingOps();
      }
      const [loadedItems, loadedTransactions, loadedCategories, loadedContractors, loadedSettings, loadedUsers, loadedStockLevels] = await Promise.all([
        db.getItems(),
        db.getTransactions({ limit: 1000 }), // Load recent 1000 for display (paginated in components)
        db.getCategories(),
        db.getContractors(),
        db.getSettings(),
        db.getUsers(),
        db.getStockLevels() // Get accurate stock from stock_summary table
      ]);

      setItems(loadedItems);
      setTransactions(loadedTransactions);
      setCategories(loadedCategories.length > 0 ? loadedCategories.map(c => c.name) : DEFAULT_CATEGORIES);
      setContractors(loadedContractors);
      setSettings(loadedSettings);
      setUsers(loadedUsers);
      setStockLevels(loadedStockLevels);
      setLastSync(new Date());
      setPendingSummary(db.getPendingOpsSummary());

      const guardOverride = localStorage.getItem('qs_guard_override') === 'true';
      if (!guardOverride && isSupabaseConfigured() && isOnline) {
        const isCloudEmpty = loadedItems.length === 0 && loadedTransactions.length === 0 && loadedUsers.length === 0;
        if (isCloudEmpty && db.hasCachedCloudData()) {
          setIsDataGuarded(true);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
      setIsOnline(false);
    } finally {
      setIsLoading(false);
    }
  }, [isOnline]);

  // Load initial data
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Set up real-time subscriptions with throttling
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    // Subscribe to items changes - incremental updates to avoid full reloads
    const itemsChannel = subscribeToTableThrottled<Record<string, unknown>>('items', async (payloads) => {
      if (import.meta.env.DEV) console.log('Items batch update:', payloads.length, 'changes');
      
      // Check if we need to reload (only for inserts that need category lookup)
      const hasInserts = payloads.some(p => p.eventType === 'INSERT');
      
      if (hasInserts) {
        // For inserts, we need the category name which requires a join
        // So reload items, but this is rare compared to updates
        const freshItems = await db.getItems();
        setItems(freshItems);
      } else {
        // For updates and deletes, do incremental changes
        setItems(prev => {
          const updated = [...prev];
          payloads.forEach(p => {
            if (p.eventType === 'UPDATE' && p.new) {
              const newData = p.new as Record<string, unknown>;
              const idx = updated.findIndex(i => i.id === newData.id);
              if (idx >= 0) {
                // Preserve category name since payload doesn't include it
                updated[idx] = {
                  ...updated[idx],
                  name: (newData.name as string) || updated[idx].name,
                  unit: (newData.unit as string) || updated[idx].unit,
                  minStock: (newData.min_stock as number) ?? updated[idx].minStock,
                  description: newData.description as string | undefined,
                  categoryId: (newData.category_id as string) || updated[idx].categoryId
                };
              }
            } else if (p.eventType === 'DELETE' && p.old) {
              const oldData = p.old as Record<string, unknown>;
              const idx = updated.findIndex(i => i.id === oldData.id);
              if (idx >= 0) updated.splice(idx, 1);
            }
          });
          return updated;
        });
      }
      
      // Always refresh stock levels (fast O(1) from stock_summary table)
      const freshStockLevels = await db.getStockLevels();
      setStockLevels(freshStockLevels);
      setLastSync(new Date());
    }, 2000); // 2 second throttle

    // Subscribe to transactions changes - throttled with smart reload
    const transactionsChannel = subscribeToTableThrottled<Record<string, unknown>>('transactions', async (payloads) => {
      if (import.meta.env.DEV) console.log('Transactions batch update:', payloads.length, 'changes');
      
      // Always reload stock levels first (instant from stock_summary table)
      const freshStockLevels = await db.getStockLevels();
      setStockLevels(freshStockLevels);
      
      // For transactions, do incremental updates when possible
      const hasInserts = payloads.some(p => p.eventType === 'INSERT');
      const hasDeletes = payloads.some(p => p.eventType === 'DELETE');
      
      if (hasInserts) {
        // For inserts, prepend new transactions to the list
        const newTxs: Transaction[] = [];
        payloads.forEach(p => {
          if (p.eventType === 'INSERT' && p.new) {
            try {
              newTxs.push(dbToTransaction(p.new as never));
            } catch {
              // Skip if conversion fails
            }
          }
        });
        if (newTxs.length > 0) {
          setTransactions(prev => {
            // Add new transactions at the beginning, avoid duplicates
            const existingIds = new Set(prev.map(t => t.id));
            const uniqueNew = newTxs.filter(t => !existingIds.has(t.id));
            // Sort by timestamp descending and keep recent 1000 (pagination handles display)
            return [...uniqueNew, ...prev]
              .sort((a, b) => b.timestamp - a.timestamp)
              .slice(0, 1000);
          });
        }
      }
      
      if (hasDeletes) {
        // For deletes, remove from the list
        const deletedIds = new Set<string>();
        payloads.forEach(p => {
          if (p.eventType === 'DELETE' && p.old) {
            const oldData = p.old as { id?: string };
            if (oldData.id) deletedIds.add(oldData.id);
          }
        });
        if (deletedIds.size > 0) {
          setTransactions(prev => prev.filter(t => !deletedIds.has(t.id)));
        }
      }
      
      // For updates, apply them in place
      const updates = payloads.filter(p => p.eventType === 'UPDATE' && p.new);
      if (updates.length > 0) {
        setTransactions(prev => {
          const updated = [...prev];
          updates.forEach(p => {
            const idx = updated.findIndex(t => t.id === (p.new as { id?: string })?.id);
            if (idx >= 0) {
              try {
                updated[idx] = dbToTransaction(p.new as never);
              } catch {
                // If conversion fails, leave as is
              }
            }
          });
          return updated;
        });
      }
      
      setLastSync(new Date());
    }, 2000); // 2 second throttle

    // Subscribe to categories changes - throttled (rare changes)
    const categoriesChannel = subscribeToTableThrottled<Record<string, unknown>>('categories', async (payloads) => {
      if (import.meta.env.DEV) console.log('Categories batch update:', payloads.length, 'changes');
      // Categories change rarely, full reload is acceptable
      const freshCategories = await db.getCategories();
      setCategories(freshCategories.map(c => c.name));
      setLastSync(new Date());
    }, 3000); // 3 second throttle

    // Subscribe to contractors changes - throttled (rare changes)
    const contractorsChannel = subscribeToTableThrottled<Record<string, unknown>>('contractors', async (payloads) => {
      if (import.meta.env.DEV) console.log('Contractors batch update:', payloads.length, 'changes');
      // Contractors change rarely, full reload is acceptable
      const freshContractors = await db.getContractors();
      setContractors(freshContractors);
      setLastSync(new Date());
    }, 3000); // 3 second throttle

    // Store cleanup functions
    subscriptionsRef.current = [
      () => supabase.removeChannel(itemsChannel),
      () => supabase.removeChannel(transactionsChannel),
      () => supabase.removeChannel(categoriesChannel),
      () => supabase.removeChannel(contractorsChannel)
    ];

    return () => {
      subscriptionsRef.current.forEach(cleanup => cleanup());
    };
  }, []);

  // Connection status and quality monitoring
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      await db.processPendingOps();
      setPendingSummary(db.getPendingOpsSummary());
      loadData();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Start connection quality monitoring
    startConnectionMonitoring(30000); // Check every 30 seconds
    
    // Subscribe to connection state changes
    const unsubscribe = subscribeToConnectionState((state) => {
      setIsOnline(state.isOnline);
      setConnectionQuality(state.quality);
      setConnectionLatency(state.latencyMs);
    });

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

  // Storage warning callback and periodic sync
  useEffect(() => {
    // Set up storage warning callback
    setStorageWarningCallback((message) => {
      setStorageWarning(message);
      // Auto-dismiss after 10 seconds
      setTimeout(() => setStorageWarning(null), 10000);
    });

    // Check storage health on mount
    const health = checkStorageHealth();
    if (!health.healthy || health.message) {
      setStorageWarning(health.message || null);
    }

    // Periodic sync check every 5 minutes when online
    const syncInterval = setInterval(async () => {
      if (isOnline && isSupabaseConfigured()) {
        const result = await db.processPendingOps();
        if (result.processed > 0 || result.conflicts > 0) {
          setPendingSummary(db.getPendingOpsSummary());
        }
        // Check storage health periodically
        const health = checkStorageHealth();
        if (!health.healthy) {
          setStorageWarning(health.message || 'Storage is getting full');
        }
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      setStorageWarningCallback(null);
      clearInterval(syncInterval);
    };
  }, [isOnline]);

  const handleLogin = (newSession: AuthSession) => {
    setSession(newSession);
    localStorage.setItem('qs_session', JSON.stringify(newSession));
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem('qs_session');
    setShowUserMenu(false);
  };

  // Session expiry monitoring
  useEffect(() => {
    if (!session) {
      setShowSessionWarning(false);
      return;
    }
    
    const SESSION_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days
    const WARNING_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours before expiry
    
    const checkSession = () => {
      const timeLeft = (session.loginAt + SESSION_DURATION) - Date.now();
      
      if (timeLeft <= 0) {
        // Session expired
        handleLogout();
      } else if (timeLeft < WARNING_THRESHOLD) {
        setShowSessionWarning(true);
      }
    };
    
    // Check immediately
    checkSession();
    
    // Check every minute
    const checkInterval = setInterval(checkSession, 60000);
    
    return () => clearInterval(checkInterval);
  }, [session]);

  const renewSession = () => {
    if (session) {
      const renewedSession = { ...session, loginAt: Date.now() };
      setSession(renewedSession);
      localStorage.setItem('qs_session', JSON.stringify(renewedSession));
      setShowSessionWarning(false);
    }
  };

  const syncToSheets = useCallback(async (tx: Transaction) => {
    if (!settings.googleSheetUrl) return;
    
    setIsSyncing(true);
    const item = items.find(i => i.id === tx.itemId);
    await db.syncToGoogleSheets(tx, item, settings.googleSheetUrl);
    setIsSyncing(false);
  }, [settings.googleSheetUrl, items]);

  const addTransaction = async (
    t: Omit<Transaction, 'id' | 'timestamp'>, 
    newItem?: Omit<InventoryItem, 'id'>
  ) => {
    // Clear any previous stock error
    setStockError(null);
    
    let finalItemId = t.itemId;
    // Track WIP reduction for potential rollback
    let wipReductionTxId: string | null = null;
    let wipReductionTx: Transaction | null = null;

    try {
      // Create new item if provided
      if (newItem) {
        const createdItem = await db.createItem({
          ...newItem,
          categoryId: '',
          createdBy: session?.user.id || ''
        });
        if (createdItem) {
          setItems(prev => [...prev, createdItem]);
          finalItemId = createdItem.id;
        }
      }

      // Smart WIP handling: When removing items (OUT), automatically reduce WIP first
      if (t.type === 'OUT' && finalItemId) {
        const itemWIP = stockLevels[finalItemId]?.wip || 0;
        if (itemWIP > 0) {
          // Calculate how much WIP to reduce (up to the quantity being removed)
          const wipToReduce = Math.min(itemWIP, t.quantity);
          
          // Create a WIP reduction transaction (negative WIP) - skip stock check for WIP
          wipReductionTx = await db.createTransaction({
            itemId: finalItemId,
            type: 'WIP',
            quantity: -wipToReduce, // Negative quantity reduces WIP
            user: t.user,
            reason: `Auto-reduced WIP: ${t.reason}`,
            signature: t.signature,
            location: t.location,
            amount: t.amount ? (t.amount * (wipToReduce / t.quantity)) : undefined, // Proportional amount
            billNumber: t.billNumber,
            createdBy: t.createdBy
          }, true); // skipStockCheck = true for WIP

          if (wipReductionTx) {
            wipReductionTxId = wipReductionTx.id; // Track for potential rollback
            setTransactions(prev => [wipReductionTx!, ...prev]);
            
            // If we reduced all WIP and there's still quantity left, continue with OUT
            // Otherwise, we're done (all removal came from WIP)
            if (wipToReduce < t.quantity) {
              // Still need to remove the remaining quantity as OUT
              // Create a new transaction object with reduced quantity
              t = { ...t, quantity: t.quantity - wipToReduce };
            } else {
              // All quantity was from WIP, no need for OUT transaction
              const updatedStockLevels = await db.getStockLevels();
              setStockLevels(updatedStockLevels);
              setShowTransactionModal(null);
              
              if (settings.googleSheetUrl) {
                syncToSheets(wipReductionTx);
              }
              refreshPendingSummary();
              return;
            }
          }
        }
      }

      // Create the main transaction
      const newTransaction = await db.createTransaction({
        ...t,
        itemId: finalItemId
      });

      if (newTransaction) {
        setTransactions(prev => [newTransaction, ...prev]);
        // Update stock levels after new transaction
        const updatedStockLevels = await db.getStockLevels();
        setStockLevels(updatedStockLevels);
        setShowTransactionModal(null);

        // Sync to Google Sheets
        if (settings.googleSheetUrl) {
          syncToSheets(newTransaction);
          // Also sync WIP reduction if it was created
          if (wipReductionTx) {
            syncToSheets(wipReductionTx);
          }
        }
        refreshPendingSummary();
      }
    } catch (error) {
      // ROLLBACK: If we created a WIP reduction but the main transaction failed, roll it back
      if (wipReductionTxId) {
        console.warn('Rolling back WIP reduction due to transaction failure');
        try {
          await db.deleteTransaction(wipReductionTxId);
          // Remove from UI state
          setTransactions(prev => prev.filter(tx => tx.id !== wipReductionTxId));
        } catch (rollbackError) {
          console.error('Failed to rollback WIP reduction:', rollbackError);
        }
      }
      
      // Handle insufficient stock error
      if (error instanceof InsufficientStockError) {
        setStockError({
          message: `Stock has changed! Only ${error.availableStock} units available now.`,
          available: error.availableStock
        });
        // Refresh stock levels to show current state
        const updatedStockLevels = await db.getStockLevels();
        setStockLevels(updatedStockLevels);
      } else {
        console.error('Transaction error:', error);
        setStockError({
          message: 'Failed to create transaction. Please try again.',
          available: 0
        });
      }
    }
  };

  const deleteItem = async (id: string) => {
    const success = await db.deleteItem(id);
    if (success) {
      setItems(prev => prev.filter(i => i.id !== id));
      setTransactions(prev => prev.filter(t => t.itemId !== id));
      refreshPendingSummary();
    }
  };

  const handleUpdateTransaction = async (id: string, updates: Partial<Transaction>) => {
    const success = await db.updateTransaction(id, updates);
    if (success) {
      setTransactions(prev => prev.map(t => 
        t.id === id ? { ...t, ...updates } : t
      ));
      // Update stock levels if quantity or type changed
      if (updates.quantity !== undefined || updates.type !== undefined) {
        const updatedStockLevels = await db.getStockLevels();
        setStockLevels(updatedStockLevels);
      }
      refreshPendingSummary();
    }
  };

  const handleDeleteTransaction = async (id: string) => {
    const success = await db.deleteTransaction(id);
    if (success) {
      setTransactions(prev => prev.filter(t => t.id !== id));
      // Update stock levels after deletion
      const updatedStockLevels = await db.getStockLevels();
      setStockLevels(updatedStockLevels);
      refreshPendingSummary();
    }
  };

  const updateItemCategory = async (itemId: string, newCategory: string) => {
    // Find or create category ID
    const allCategories = await db.getCategories();
    let categoryId = allCategories.find(c => c.name === newCategory)?.id;
    
    if (!categoryId) {
      const newCat = await db.createCategory(newCategory);
      if (newCat) categoryId = newCat.id;
    }

    if (categoryId) {
      const success = await db.updateItem(itemId, { categoryId, category: newCategory });
      if (success) {
        setItems(prev => prev.map(item => 
          item.id === itemId ? { ...item, category: newCategory, categoryId } : item
        ));
      }
    }
  };

  const handleUpdateItem = async (itemId: string, updates: Partial<InventoryItem>) => {
    const success = await db.updateItem(itemId, updates);
    if (success) {
      setItems(prev => prev.map(item =>
        item.id === itemId ? { ...item, ...updates } : item
      ));
      refreshPendingSummary();
    }
  };

  const handleCreateItem = async (item: Omit<InventoryItem, 'id'>) => {
    const created = await db.createItem(item);
    if (created) {
      setItems(prev => [...prev, created]);
      refreshPendingSummary();
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    const success = await db.deleteItem(itemId);
    if (success) {
      setItems(prev => prev.filter(item => item.id !== itemId));
      setTransactions(prev => prev.filter(t => t.itemId !== itemId));
      refreshPendingSummary();
    }
  };

  const handleUpdateCategories = async (newCategories: string[]) => {
    // Sync categories with database
    const existingCategories = await db.getCategories();
    const existingNames = existingCategories.map(c => c.name);
    
    // Add new categories
    for (const name of newCategories) {
      if (!existingNames.includes(name)) {
        await db.createCategory(name);
      }
    }
    
    // Delete removed categories
    for (const cat of existingCategories) {
      if (!newCategories.includes(cat.name)) {
        await db.deleteCategory(cat.id);
      }
    }
    
    setCategories(newCategories);
    refreshPendingSummary();
  };

  const acknowledgeDataGuard = () => {
    localStorage.setItem('qs_guard_override', 'true');
    setIsDataGuarded(false);
  };

  // Conflict resolution handlers
  const openConflictDialog = () => {
    const conflicts = db.getPendingOpsDetailed().filter(op => op.status === 'conflict');
    setConflictedOps(conflicts);
    setShowConflictDialog(true);
  };

  const handleDismissConflict = async (opId: string) => {
    await db.dismissPendingOp(opId);
    setConflictedOps(prev => prev.filter(op => op.id !== opId));
    refreshPendingSummary();
    if (conflictedOps.length <= 1) {
      setShowConflictDialog(false);
    }
  };

  const handleRetryConflict = async (opId: string) => {
    await db.retryPendingOp(opId);
    refreshPendingSummary();
    // Refresh the conflicts list
    const updatedConflicts = db.getPendingOpsDetailed().filter(op => op.status === 'conflict');
    setConflictedOps(updatedConflicts);
    if (updatedConflicts.length === 0) {
      setShowConflictDialog(false);
    }
  };

  const handleDismissAllConflicts = async () => {
    for (const op of conflictedOps) {
      await db.dismissPendingOp(op.id);
    }
    setConflictedOps([]);
    setShowConflictDialog(false);
    refreshPendingSummary();
  };

  // Show login page if not authenticated
  if (!session) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Package size={32} className="text-white" />
          </div>
          <p className="text-slate-400 font-bold">Loading inventory...</p>
        </div>
      </div>
    );
  }

  if (isDataGuarded) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-white rounded-3xl shadow-2xl border border-slate-100 p-8 text-center">
          <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">⚠️</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">Data Safety Check</h2>
          <p className="text-slate-500 text-sm mb-6">
            The cloud database looks empty, but cached data exists on this device. This can happen after a deploy or when pointing to a new database.
          </p>
          <button
            onClick={acknowledgeDataGuard}
            className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black hover:bg-slate-800 transition-all"
          >
            I Understand — Continue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28 md:pb-0 md:pl-24">
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-white border-t border-slate-200 flex items-center z-50 overflow-x-auto no-scrollbar md:top-0 md:left-0 md:h-full md:w-24 md:flex-col md:justify-start md:pt-10 md:border-r md:border-t-0 shadow-2xl md:shadow-none px-4 sm:px-6 md:px-0 gap-2 md:gap-0">
        <button onClick={() => setActiveTab('dashboard')} className={`p-4 rounded-2xl transition-all shrink-0 ${activeTab === 'dashboard' ? 'bg-indigo-600 text-white shadow-xl scale-110' : 'text-slate-400 hover:bg-slate-100'}`}>
          <LayoutDashboard size={28} />
        </button>
        <button onClick={() => setActiveTab('items')} className={`p-4 rounded-2xl transition-all shrink-0 md:mt-6 ${activeTab === 'items' ? 'bg-indigo-600 text-white shadow-xl scale-110' : 'text-slate-400 hover:bg-slate-100'}`}>
          <Package size={28} />
        </button>
        <button onClick={() => setActiveTab('history')} className={`p-4 rounded-2xl transition-all shrink-0 md:mt-6 ${activeTab === 'history' ? 'bg-indigo-600 text-white shadow-xl scale-110' : 'text-slate-400 hover:bg-slate-100'}`}>
          <History size={28} />
        </button>
        {/* Admin-only Tab */}
        {session.user.role === 'admin' && (
          <button onClick={() => setActiveTab('admin')} className={`p-4 rounded-2xl transition-all shrink-0 md:mt-6 ${activeTab === 'admin' ? 'bg-purple-600 text-white shadow-xl scale-110' : 'text-slate-400 hover:bg-slate-100'}`}>
            <Settings size={28} />
          </button>
        )}
        {/* User Menu */}
        <div className="relative md:mb-6 shrink-0">
          <button 
            onClick={() => setShowUserMenu(!showUserMenu)} 
            className="p-4 rounded-2xl text-slate-400 hover:bg-slate-100 transition-all"
          >
            <UserIcon size={28} />
          </button>
        </div>
      </nav>

      {/* User Menu Popup - Outside nav for better positioning */}
      {showUserMenu && (
        <>
          {/* Backdrop to close menu */}
          <div 
            className="fixed inset-0 z-[90]" 
            onClick={() => setShowUserMenu(false)}
          />
          <div className="fixed bottom-24 right-4 md:bottom-auto md:top-4 md:left-28 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 min-w-[200px] z-[100]">
            <div className="pb-3 mb-3 border-b border-slate-100">
              <p className="font-bold text-slate-900">{session.user.displayName}</p>
              <p className="text-xs text-slate-500">@{session.user.username}</p>
              <span className={`inline-block mt-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full ${session.user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}>
                {session.user.role}
              </span>
            </div>
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors text-sm font-semibold"
            >
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </>
      )}

      <main className="max-w-5xl mx-auto p-4 sm:p-6 md:p-12" style={{ zoom: zoomLevel }}>
        {/* Session Expiry Warning Banner */}
        {showSessionWarning && (
          <div className="mb-6 p-4 bg-amber-50 border-2 border-amber-200 rounded-2xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center shrink-0">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-600">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </div>
              <div>
                <p className="font-bold text-amber-800">Session Expiring Soon</p>
                <p className="text-sm text-amber-600">Your session will expire within 24 hours. Click Renew to stay logged in.</p>
              </div>
            </div>
            <button
              onClick={renewSession}
              className="px-4 py-2 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 transition-colors shrink-0"
            >
              Renew
            </button>
          </div>
        )}

        {/* Storage Warning Banner */}
        {storageWarning && (
          <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-2xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-600">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div>
                <p className="font-bold text-red-800">Storage Warning</p>
                <p className="text-sm text-red-600">{storageWarning}</p>
              </div>
            </div>
            <button
              onClick={() => setStorageWarning(null)}
              className="px-4 py-2 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-colors shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}
        
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8 sm:mb-12">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className={`w-3 h-3 rounded-full ${
                !isOnline ? 'bg-red-500' :
                connectionQuality === 'poor' ? 'bg-red-400' :
                connectionQuality === 'slow' ? 'bg-amber-500' :
                isSyncing ? 'bg-indigo-500 animate-pulse' : 
                'bg-emerald-500'
              }`}></div>
              <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-2 flex-wrap">
                {!isOnline ? 'Offline Mode' :
                 connectionQuality === 'poor' ? 'Poor Connection' :
                 connectionQuality === 'slow' ? 'Slow Connection' :
                 isSyncing ? 'Syncing...' : 
                 isSupabaseConfigured() ? 'Real-Time Sync Active' : 'Local Mode'}
                {isOnline && connectionLatency > 0 && connectionQuality !== 'excellent' && (
                  <span className={`${connectionQuality === 'poor' ? 'text-red-400' : connectionQuality === 'slow' ? 'text-amber-500' : 'text-slate-300'}`}>
                    • {connectionLatency}ms
                  </span>
                )}
                {lastSync && isOnline && (
                  <span className="text-slate-300">
                    • Updated {lastSync.toLocaleTimeString()}
                  </span>
                )}
                {pendingSummary.pending > 0 && (
                  <span className="text-amber-500">
                    • {pendingSummary.pending} Pending Sync
                  </span>
                )}
                {pendingSummary.conflicts > 0 && (
                  <button 
                    onClick={openConflictDialog}
                    className="text-red-500 hover:text-red-600 hover:underline transition-colors"
                  >
                    • {pendingSummary.conflicts} Conflict{pendingSummary.conflicts !== 1 ? 's' : ''} - Click to Resolve
                  </button>
                )}
              </p>
            </div>
            <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight">
              {activeTab === 'dashboard' && 'Folders'}
              {activeTab === 'items' && 'Catalog'}
              {activeTab === 'history' && 'Logs'}
              {activeTab === 'admin' && 'Admin'}
            </h1>
          </div>
          <div className="flex gap-3">
            {activeTab === 'dashboard' && (
              <>
                <button onClick={() => setShowTransactionModal({ type: 'OUT' })} className="flex-1 sm:flex-none flex items-center justify-center gap-3 bg-red-500 text-white px-8 py-5 rounded-3xl font-black shadow-xl shadow-red-100 hover:bg-red-600 active:scale-95 transition-all text-xl">
                  <Minus size={24} />
                  Use Stock
                </button>
                <button onClick={() => setShowTransactionModal({ type: 'IN' })} className="flex-1 sm:flex-none flex items-center justify-center gap-3 bg-emerald-500 text-white px-8 py-5 rounded-3xl font-black shadow-xl shadow-emerald-100 hover:bg-emerald-600 active:scale-95 transition-all text-xl">
                  <Plus size={24} />
                  Receive Stock
                </button>
              </>
            )}
          </div>
        </header>

        {activeTab === 'dashboard' && (
          <Dashboard 
            items={items} 
            transactions={transactions}
            session={session}
            categories={categories}
            contractors={contractors}
            users={users}
            stockLevels={stockLevels}
            onAction={(type, item) => setShowTransactionModal({ type, item })}
            onAddNewItem={() => setShowTransactionModal({ type: 'IN' })}
            onUpdateTransaction={handleUpdateTransaction}
            onDeleteTransaction={handleDeleteTransaction}
          />
        )}
        {activeTab === 'items' && <ItemManager items={items} transactions={transactions} stockLevels={stockLevels} />}
        {activeTab === 'history' && (
          <HistoryLog 
            transactions={transactions} 
            items={items} 
            session={session}
            categories={categories}
            contractors={contractors}
            users={users}
            onAddTransaction={addTransaction}
            onUpdateTransaction={handleUpdateTransaction} 
            onDeleteTransaction={handleDeleteTransaction} 
          />
        )}
        {activeTab === 'admin' && session.user.role === 'admin' && (
          <AdminPanel
            session={session}
            items={items}
            transactions={transactions}
            categories={categories}
            contractors={contractors}
            users={users}
            onUpdateCategories={handleUpdateCategories}
            onUpdateItemCategory={updateItemCategory}
            onUpdateItem={handleUpdateItem}
            onCreateItem={handleCreateItem}
            onDeleteItem={handleDeleteItem}
            onRefreshContractors={async () => {
              const fresh = await db.getContractors();
              setContractors(fresh);
            }}
          />
        )}
      </main>

      {showTransactionModal && (
        <TransactionForm 
          type={showTransactionModal.type}
          initialItem={showTransactionModal.item}
          items={items}
          transactions={transactions}
          categories={categories}
          contractors={contractors}
          session={session}
          stockLevels={stockLevels}
          stockError={stockError}
          onClose={() => { setShowTransactionModal(null); setStockError(null); }}
          onSubmit={addTransaction}
          onRefreshContractors={async () => {
            const fresh = await db.getContractors();
            setContractors(fresh);
          }}
        />
      )}

      {/* Sync Conflict Resolution Dialog */}
      <SyncConflictDialog
        isOpen={showConflictDialog}
        conflicts={conflictedOps}
        onDismiss={handleDismissConflict}
        onRetry={handleRetryConflict}
        onDismissAll={handleDismissAllConflicts}
        onClose={() => setShowConflictDialog(false)}
      />

      {/* Floating Zoom Controls */}
      <div className="fixed bottom-24 right-4 md:bottom-4 md:right-4 z-[80] flex flex-col items-center gap-1 bg-white rounded-2xl shadow-xl border border-slate-200 p-2">
        <button
          onClick={handleZoomIn}
          disabled={zoomIndex >= ZOOM_LEVELS.length - 1}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 font-black text-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Zoom In"
        >
          +
        </button>
        <button
          onClick={handleZoomReset}
          className="w-10 h-8 flex items-center justify-center text-[10px] font-black text-slate-500 hover:text-indigo-600 transition-colors"
          title="Reset Zoom"
        >
          {Math.round(zoomLevel * 100)}%
        </button>
        <button
          onClick={handleZoomOut}
          disabled={zoomIndex <= 0}
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700 font-black text-xl disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Zoom Out"
        >
          −
        </button>
      </div>
    </div>
  );
};

export default App;
