
import React, { useState } from 'react';
import { AppSettings } from '../types';

interface SyncSettingsProps {
  settings: AppSettings;
  onSave: (s: AppSettings) => void;
  onClose: () => void;
}

const SyncSettings: React.FC<SyncSettingsProps> = ({ settings, onSave, onClose }) => {
  const [url, setUrl] = useState(settings.googleSheetUrl);

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
