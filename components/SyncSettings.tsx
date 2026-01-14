
import React from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { Database, ExternalLink } from './Icons';

interface SyncSettingsProps {
  onClose: () => void;
}

// Extract project ID from Supabase URL
const getSupabaseProjectId = (): string | null => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) return null;
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match ? match[1] : null;
};

const SyncSettings: React.FC<SyncSettingsProps> = ({ onClose }) => {
  const projectId = getSupabaseProjectId();

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[150] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden flex flex-col">
        <div className="p-8 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black">Database Settings</h2>
            <p className="text-xs font-bold text-white/70 uppercase tracking-widest mt-1">Supabase Cloud</p>
          </div>
          <button onClick={onClose} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="p-8 space-y-6">
          {isSupabaseConfigured() && projectId ? (
            <>
              {/* Status Badge */}
              <div className="flex items-center gap-3 p-4 bg-emerald-50 rounded-2xl border-2 border-emerald-100">
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse"></div>
                <span className="font-black text-emerald-700">Connected to Supabase</span>
              </div>

              {/* Main Dashboard Link */}
              <a
                href={`https://supabase.com/dashboard/project/${projectId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between w-full p-5 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Database size={24} />
                  <span className="text-lg">Open Supabase Dashboard</span>
                </div>
                <ExternalLink size={20} className="group-hover:translate-x-1 transition-transform" />
              </a>

              {/* Quick Links */}
              <div className="grid grid-cols-2 gap-3">
                <a 
                  href={`https://supabase.com/dashboard/project/${projectId}/editor`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-4 bg-slate-50 hover:bg-indigo-50 rounded-xl text-slate-700 hover:text-indigo-600 font-bold text-sm transition-all"
                >
                  📊 Table Editor
                </a>
                <a 
                  href={`https://supabase.com/dashboard/project/${projectId}/sql`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-4 bg-slate-50 hover:bg-indigo-50 rounded-xl text-slate-700 hover:text-indigo-600 font-bold text-sm transition-all"
                >
                  💻 SQL Editor
                </a>
                <a 
                  href={`https://supabase.com/dashboard/project/${projectId}/auth/users`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-4 bg-slate-50 hover:bg-indigo-50 rounded-xl text-slate-700 hover:text-indigo-600 font-bold text-sm transition-all"
                >
                  👥 Auth Users
                </a>
                <a 
                  href={`https://supabase.com/dashboard/project/${projectId}/settings/api`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-4 bg-slate-50 hover:bg-indigo-50 rounded-xl text-slate-700 hover:text-indigo-600 font-bold text-sm transition-all"
                >
                  🔑 API Keys
                </a>
              </div>

              {/* Info */}
              <p className="text-xs text-slate-400 text-center">
                Your data syncs in real-time across all devices
              </p>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Database size={32} className="text-slate-400" />
              </div>
              <h3 className="font-black text-slate-700 mb-2">Not Connected</h3>
              <p className="text-sm text-slate-500">
                Supabase environment variables are not configured.
              </p>
            </div>
          )}

          <button 
            onClick={onClose}
            className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black hover:bg-slate-200 transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default SyncSettings;
