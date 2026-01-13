
import React, { useState } from 'react';
import { AppSettings } from '../types';
import { isSupabaseConfigured } from '../lib/supabase';
import { Database, ExternalLink } from './Icons';

interface SyncSettingsProps {
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
  onClose: () => void;
}

// Extract project ID from Supabase URL
const getSupabaseProjectId = (): string | null => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) return null;
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match ? match[1] : null;
};

const SyncSettings: React.FC<SyncSettingsProps> = ({ settings, onSave, onClose }) => {
  const [url, setUrl] = useState(settings.googleSheetUrl);
  const projectId = getSupabaseProjectId();

  const googleScriptCode = `function doPost(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheets()[0];
  var data = JSON.parse(e.postData.contents);
  sheet.appendRow([data.date, data.item, data.folder, data.type, data.qty, data.unit, data.user, data.reason]);
  return ContentService.createTextOutput("OK");
}`;

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[150] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-xl rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-black">Sheets Integration</h2>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Live Database Setup</p>
          </div>
          <button onClick={onClose} className="bg-white/10 p-2 rounded-full">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="p-8 overflow-y-auto space-y-6">
          {/* Database Link Section */}
          {isSupabaseConfigured() && projectId && (
            <section className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-5 border border-emerald-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
                    <Database size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="font-black text-emerald-900">Supabase Database</h3>
                    <p className="text-xs text-emerald-600">View and manage your data directly</p>
                  </div>
                </div>
                <a
                  href={`https://supabase.com/dashboard/project/${projectId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-emerald-700 transition-all"
                >
                  Open Dashboard
                  <ExternalLink size={16} />
                </a>
              </div>
              <div className="mt-3 pt-3 border-t border-emerald-200 grid grid-cols-2 gap-2 text-xs">
                <a 
                  href={`https://supabase.com/dashboard/project/${projectId}/editor`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-emerald-700 hover:text-emerald-900 font-medium"
                >
                  📊 Table Editor
                </a>
                <a 
                  href={`https://supabase.com/dashboard/project/${projectId}/sql`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-emerald-700 hover:text-emerald-900 font-medium"
                >
                  💻 SQL Editor
                </a>
                <a 
                  href={`https://supabase.com/dashboard/project/${projectId}/auth/users`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-emerald-700 hover:text-emerald-900 font-medium"
                >
                  👥 Auth Users
                </a>
                <a 
                  href={`https://supabase.com/dashboard/project/${projectId}/settings/api`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-emerald-700 hover:text-emerald-900 font-medium"
                >
                  🔑 API Keys
                </a>
              </div>
            </section>
          )}

          <section className="space-y-4">
            <h3 className="font-black text-slate-800 flex items-center gap-2">
              <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs">1</span>
              Setup your Google Sheet
            </h3>
            <ol className="text-sm font-medium text-slate-500 space-y-2 list-decimal pl-8">
              <li>Open a new Google Sheet.</li>
              <li>Go to <b>Extensions {'>'} App Script</b>.</li>
              <li>Paste the code below and click <b>Deploy {'>'} New Deployment</b>.</li>
              <li>Select <b>Web App</b>, set access to <b>"Anyone"</b>.</li>
            </ol>
            <div className="relative">
              <textarea 
                readOnly 
                className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-mono text-xs text-slate-600 h-32"
                value={googleScriptCode}
              />
              <button 
                onClick={() => navigator.clipboard.writeText(googleScriptCode)}
                className="absolute top-3 right-3 bg-white px-3 py-1.5 rounded-lg border-2 border-slate-100 text-[10px] font-black hover:bg-indigo-50 hover:text-indigo-600 transition-all"
              >
                COPY CODE
              </button>
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="font-black text-slate-800 flex items-center gap-2">
              <span className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center text-xs">2</span>
              Paste Web App URL
            </h3>
            <input 
              placeholder="https://script.google.com/macros/s/..."
              className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 focus:border-indigo-500 outline-none font-bold text-sm"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </section>

          <button 
            onClick={() => onSave({ googleSheetUrl: url })}
            className="w-full py-5 bg-indigo-600 text-white rounded-[24px] font-black text-xl shadow-xl shadow-indigo-100"
          >
            SAVE & CONNECT
          </button>
        </div>
      </div>
    </div>
  );
};

export default SyncSettings;
