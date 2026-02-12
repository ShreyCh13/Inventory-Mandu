
import React, { useState } from 'react';
import { InventoryItem, Transaction, Category, Contractor, User, AuthSession } from '../types';
import UserManager from './UserManager';
import CategoryManager from './CategoryManager';
import { isSupabaseConfigured } from '../lib/supabase';
import { Database as DatabaseIcon, ExternalLink, Users, Folder, Settings } from './Icons';
import { generateAppsScript } from './SyncSettings';

interface AdminPanelProps {
  session: AuthSession;
  items: InventoryItem[];
  transactions: Transaction[];
  categories: string[];
  users: User[];
  onUpdateCategories: (newCategories: string[]) => Promise<void>;
  onUpdateItemCategory: (itemId: string, newCategory: string) => Promise<void>;
  onUpdateItem: (itemId: string, updates: Partial<InventoryItem>) => Promise<void>;
  onCreateItem: (item: Omit<InventoryItem, 'id'>) => Promise<void>;
  onDeleteItem: (itemId: string) => Promise<void>;
}

const getSupabaseProjectId = (): string | null => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) return null;
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match ? match[1] : null;
};

const AdminPanel: React.FC<AdminPanelProps> = ({
  session,
  items,
  transactions,
  categories,
  users,
  onUpdateCategories,
  onUpdateItemCategory,
  onUpdateItem,
  onCreateItem,
  onDeleteItem
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'categories' | 'sync'>('categories');
  const projectId = getSupabaseProjectId();
  const [scriptCopied, setScriptCopied] = useState(false);
  const [showScriptPreview, setShowScriptPreview] = useState(false);

  const handleCopyScript = () => {
    const script = generateAppsScript();
    navigator.clipboard.writeText(script).then(() => {
      setScriptCopied(true);
      setTimeout(() => setScriptCopied(false), 3000);
    });
  };

  const subTabs = [
    { id: 'categories', label: 'Categories', icon: Folder, color: 'text-purple-600', bg: 'bg-purple-50' },
    { id: 'users', label: 'Users', icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { id: 'sync', label: 'Database', icon: DatabaseIcon, color: 'text-amber-600', bg: 'bg-amber-50' }
  ] as const;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Sub-navigation */}
      <div className="flex overflow-x-auto no-scrollbar gap-2 p-1 bg-white border-2 border-slate-100 rounded-[28px] shadow-sm">
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center gap-3 px-6 py-4 rounded-[22px] font-black text-sm whitespace-nowrap transition-all ${
                isActive 
                  ? `${tab.bg} ${tab.color} shadow-sm ring-1 ring-inset ring-slate-200/50` 
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Icon size={20} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="min-h-[500px]">
        {activeSubTab === 'users' && (
          <div className="animate-in slide-in-from-bottom duration-300">
            <UserManager currentUserId={session.user.id} />
          </div>
        )}

        {activeSubTab === 'categories' && (
          <div className="animate-in slide-in-from-bottom duration-300">
            <CategoryManager 
              categories={categories} 
              items={items}
              onUpdate={onUpdateCategories}
              onUpdateItemCategory={onUpdateItemCategory}
              onUpdateItem={onUpdateItem}
              onCreateItem={onCreateItem}
              onDeleteItem={onDeleteItem}
            />
          </div>
        )}

        {activeSubTab === 'sync' && (
          <div className="animate-in slide-in-from-bottom duration-300 max-w-2xl mx-auto">
            <div className="bg-white rounded-[40px] shadow-xl border-2 border-slate-100 overflow-hidden">
              <div className="p-8 bg-gradient-to-r from-slate-800 to-slate-900 text-white">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/10 rounded-2xl">
                    <DatabaseIcon size={32} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black">Database Settings</h2>
                    <p className="text-xs font-bold text-white/50 uppercase tracking-widest mt-1">
                      {isSupabaseConfigured() ? 'Cloud Connection Active' : 'Offline Mode'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-8 space-y-8">
                {isSupabaseConfigured() && projectId ? (
                  <>
                    <div className="flex items-center gap-4 p-5 bg-emerald-50 rounded-[24px] border-2 border-emerald-100">
                      <div className="w-4 h-4 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.5)]"></div>
                      <div className="flex-1">
                        <p className="font-black text-emerald-900 text-lg leading-tight">Supabase Connected</p>
                        <p className="text-emerald-600 font-bold text-xs uppercase tracking-widest mt-0.5">Real-time sync enabled</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Direct Management</p>
                      <a
                        href={`https://supabase.com/dashboard/project/${projectId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between w-full p-6 bg-slate-900 text-white rounded-[24px] font-black hover:bg-slate-800 transition-all group shadow-xl shadow-slate-200"
                      >
                        <div className="flex items-center gap-4">
                          <Settings size={28} />
                          <span className="text-xl">Supabase Console</span>
                        </div>
                        <ExternalLink size={24} className="group-hover:translate-x-2 transition-transform opacity-50" />
                      </a>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <a 
                        href={`https://supabase.com/dashboard/project/${projectId}/editor`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-6 bg-slate-50 hover:bg-white border-2 border-transparent hover:border-indigo-100 rounded-[24px] transition-all group"
                      >
                        <p className="text-2xl mb-2">📊</p>
                        <p className="font-black text-slate-900">Table Editor</p>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Raw Data</p>
                      </a>
                      <a 
                        href={`https://supabase.com/dashboard/project/${projectId}/auth/users`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-6 bg-slate-50 hover:bg-white border-2 border-transparent hover:border-indigo-100 rounded-[24px] transition-all group"
                      >
                        <p className="text-2xl mb-2">👥</p>
                        <p className="font-black text-slate-900">System Auth</p>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Security</p>
                      </a>
                    </div>

                    {/* Google Sheet Setup Instructions */}
                    <div className="pt-6 mt-6 border-t-2 border-slate-100">
                      <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4">Live Google Sheet Setup</p>
                      
                      <div className="p-5 bg-emerald-50 rounded-[20px] border border-emerald-100 mb-4">
                        <p className="text-sm font-bold text-emerald-800 mb-1">Auto-Refreshing Sheet</p>
                        <p className="text-xs text-emerald-600">
                          The Live Sheet pulls data from Supabase every 5 minutes via a Google Apps Script. 
                          If you need to re-setup or update the script, follow these steps.
                        </p>
                      </div>

                      <div className="space-y-2 mb-5">
                        <div className="flex gap-3 items-start">
                          <span className="w-5 h-5 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">1</span>
                          <p className="text-sm text-slate-600">Open the Google Sheet → <strong>Extensions → Apps Script</strong></p>
                        </div>
                        <div className="flex gap-3 items-start">
                          <span className="w-5 h-5 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">2</span>
                          <p className="text-sm text-slate-600">Delete all existing code, paste the copied script, and <strong>Save</strong></p>
                        </div>
                        <div className="flex gap-3 items-start">
                          <span className="w-5 h-5 bg-slate-200 text-slate-600 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">3</span>
                          <p className="text-sm text-slate-600">Run <strong>onOpen</strong>, authorize, then use <strong>Inventory Mandu → Setup Auto-Refresh</strong></p>
                        </div>
                      </div>

                      <button
                        onClick={handleCopyScript}
                        className={`w-full py-4 rounded-2xl font-black text-base transition-all flex items-center justify-center gap-3 ${
                          scriptCopied 
                            ? 'bg-emerald-500 text-white' 
                            : 'bg-slate-900 text-white hover:bg-slate-800'
                        }`}
                      >
                        {scriptCopied ? (
                          <>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                            Copied!
                          </>
                        ) : (
                          <>
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                            Copy Apps Script
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => setShowScriptPreview(!showScriptPreview)}
                        className="w-full text-left px-4 py-3 mt-3 bg-slate-50 rounded-xl text-xs font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-all flex items-center justify-between"
                      >
                        <span>{showScriptPreview ? 'Hide' : 'Preview'} Script Code</span>
                        <svg 
                          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" 
                          className={`transition-transform ${showScriptPreview ? 'rotate-180' : ''}`}
                        >
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </button>

                      {showScriptPreview && (
                        <div className="bg-slate-900 text-slate-300 rounded-2xl p-4 mt-3 overflow-auto max-h-48">
                          <pre className="text-[10px] font-mono whitespace-pre-wrap leading-relaxed">
                            {generateAppsScript()}
                          </pre>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-slate-100 rounded-[32px] flex items-center justify-center mx-auto mb-6 text-slate-300">
                      <DatabaseIcon size={40} />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 mb-2">Local Storage Only</h3>
                    <p className="text-slate-500 font-medium max-w-xs mx-auto">
                      Supabase is not configured. Data is being stored locally on this device.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPanel;
