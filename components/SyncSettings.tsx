
import React, { useState } from 'react';
import { isSupabaseConfigured } from '../lib/supabase';
import { Database, ExternalLink } from './Icons';
import { AuthSession } from '../types';

interface SyncSettingsProps {
  onClose: () => void;
  session: AuthSession;
}

// Extract project ID from Supabase URL
const getSupabaseProjectId = (): string | null => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  if (!url) return null;
  const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
  return match ? match[1] : null;
};

const getSupabaseUrl = (): string => import.meta.env.VITE_SUPABASE_URL || '';
const getSupabaseAnonKey = (): string => import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const generateAppsScript = (): string => {
  const supabaseUrl = getSupabaseUrl();
  const supabaseKey = getSupabaseAnonKey();

  return `// ============================================
// INVENTORY MANDU — Live Google Sheet Sync
// ============================================
// This script pulls data from your Supabase database
// and writes it to this Google Sheet every 5 minutes.
//
// Setup: Run onOpen() once, then use the custom menu.
// ============================================

var SUPABASE_URL = '${supabaseUrl}';
var SUPABASE_KEY = '${supabaseKey}';

// ---- Custom Menu ----
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Inventory Mandu')
    .addItem('Refresh Now', 'refreshAll')
    .addSeparator()
    .addItem('Setup Auto-Refresh (every 5 min)', 'setupAutoRefresh')
    .addItem('Stop Auto-Refresh', 'stopAutoRefresh')
    .addToUi();
}

function refreshAll() {
  refreshCurrentStock();
  refreshRecentTransactions();
  SpreadsheetApp.getActiveSpreadsheet().toast('Data refreshed!', 'Inventory Mandu', 3);
}

// ---- Current Stock Sheet ----
function refreshCurrentStock() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Current Stock');
  if (!sheet) {
    sheet = ss.insertSheet('Current Stock');
  }

  var data = fetchFromSupabase('/rest/v1/current_stock?select=*&order=category,name');
  if (!data || data.length === 0) {
    sheet.clear();
    sheet.getRange(1, 1).setValue('No stock data found. Make sure the current_stock view exists in Supabase.');
    return;
  }

  // Headers
  var headers = ['Category', 'Item Name', 'Unit', 'Current Stock', 'WIP (In Progress)', 'Min Stock', 'Status'];
  var rows = [headers];

  data.forEach(function(row) {
    var currentQty = Number(row.current_quantity) || 0;
    var wipQty = Number(row.wip_quantity) || 0;
    var minStock = Number(row.min_stock) || 0;
    var status = currentQty <= 0 ? 'OUT OF STOCK' : currentQty <= minStock ? 'LOW STOCK' : 'OK';

    rows.push([
      row.category || '',
      row.name || '',
      row.unit || '',
      currentQty,
      wipQty,
      minStock,
      status
    ]);
  });

  sheet.clear();
  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);

  // Style headers
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4338ca');
  headerRange.setFontColor('#ffffff');

  // Color-code status column
  for (var i = 1; i < rows.length; i++) {
    var statusCell = sheet.getRange(i + 1, 7);
    var statusVal = rows[i][6];
    if (statusVal === 'OK') {
      statusCell.setBackground('#dcfce7').setFontColor('#166534');
    } else if (statusVal === 'LOW STOCK') {
      statusCell.setBackground('#fef9c3').setFontColor('#854d0e');
    } else if (statusVal === 'OUT OF STOCK') {
      statusCell.setBackground('#fee2e2').setFontColor('#991b1b');
    }
  }

  // Auto-resize columns
  for (var c = 1; c <= headers.length; c++) {
    sheet.autoResizeColumn(c);
  }

  // Timestamp
  sheet.getRange(rows.length + 2, 1).setValue('Last Updated: ' + new Date().toLocaleString());
  sheet.getRange(rows.length + 2, 1).setFontColor('#9ca3af').setFontStyle('italic');
}

// ---- Recent Transactions Sheet ----
function refreshRecentTransactions() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Recent Transactions');
  if (!sheet) {
    sheet = ss.insertSheet('Recent Transactions');
  }

  // Fetch transactions with item join
  var txData = fetchFromSupabase('/rest/v1/transactions?select=*,items!inner(name,category_id,unit,categories!inner(name))&order=created_at.desc&limit=200');
  
  // Fetch users for approved_by name lookup
  var usersData = fetchFromSupabase('/rest/v1/users?select=id,display_name');
  var userMap = {};
  if (usersData) {
    usersData.forEach(function(u) { userMap[u.id] = u.display_name; });
  }

  if (!txData || txData.length === 0) {
    sheet.clear();
    sheet.getRange(1, 1).setValue('No transactions found.');
    return;
  }

  var headers = ['Date & Time', 'Category', 'Item', 'Type', 'Quantity', 'Unit', 'User', 'Approved By', 'Reason', 'Location', 'Amount', 'Bill No.'];
  var rows = [headers];

  txData.forEach(function(tx) {
    var itemName = (tx.items && tx.items.name) ? tx.items.name : 'Unknown';
    var category = (tx.items && tx.items.categories && tx.items.categories.name) ? tx.items.categories.name : '';
    var unit = (tx.items && tx.items.unit) ? tx.items.unit : '';
    var approvedByName = tx.approved_by ? (userMap[tx.approved_by] || '') : '';

    rows.push([
      new Date(tx.created_at),
      category,
      itemName,
      tx.type,
      Number(tx.quantity) || 0,
      unit,
      tx.user_name || '',
      approvedByName,
      tx.reason || '',
      tx.location || '',
      tx.amount ? Number(tx.amount) : '',
      tx.bill_number || ''
    ]);
  });

  sheet.clear();
  sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);

  // Style headers
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#4338ca');
  headerRange.setFontColor('#ffffff');

  // Color-code Type column (column 4)
  for (var i = 1; i < rows.length; i++) {
    var typeCell = sheet.getRange(i + 1, 4);
    var typeVal = rows[i][3];
    if (typeVal === 'IN') {
      typeCell.setBackground('#dbeafe').setFontColor('#1e40af');
    } else if (typeVal === 'OUT') {
      typeCell.setBackground('#f1f5f9').setFontColor('#0f172a');
    } else if (typeVal === 'WIP') {
      typeCell.setBackground('#fef3c7').setFontColor('#92400e');
    }
  }

  // Format date column
  sheet.getRange(2, 1, rows.length - 1, 1).setNumberFormat('dd-MMM-yyyy hh:mm');

  // Auto-resize columns
  for (var c = 1; c <= headers.length; c++) {
    sheet.autoResizeColumn(c);
  }

  // Timestamp
  sheet.getRange(rows.length + 2, 1).setValue('Last Updated: ' + new Date().toLocaleString());
  sheet.getRange(rows.length + 2, 1).setFontColor('#9ca3af').setFontStyle('italic');
}

// ---- Auto-Refresh Trigger ----
function setupAutoRefresh() {
  // Remove any existing triggers first
  stopAutoRefresh();

  ScriptApp.newTrigger('refreshAll')
    .timeBased()
    .everyMinutes(5)
    .create();

  SpreadsheetApp.getActiveSpreadsheet().toast('Auto-refresh enabled! Data will update every 5 minutes.', 'Inventory Mandu', 5);
}

function stopAutoRefresh() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'refreshAll') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  SpreadsheetApp.getActiveSpreadsheet().toast('Auto-refresh stopped.', 'Inventory Mandu', 3);
}

// ---- Supabase Fetch Helper ----
function fetchFromSupabase(endpoint) {
  var url = SUPABASE_URL + endpoint;
  var options = {
    method: 'GET',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_KEY,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  };

  try {
    var response = UrlFetchApp.fetch(url, options);
    var code = response.getResponseCode();
    if (code === 200) {
      return JSON.parse(response.getContentText());
    } else {
      Logger.log('Supabase error (' + code + '): ' + response.getContentText());
      return null;
    }
  } catch (e) {
    Logger.log('Fetch error: ' + e.toString());
    return null;
  }
}
`;
};

const SyncSettings: React.FC<SyncSettingsProps> = ({ onClose, session }) => {
  const projectId = getSupabaseProjectId();
  const [activeTab, setActiveTab] = useState<'sheet' | 'database'>('sheet');
  const [copied, setCopied] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Only allow admins to access settings
  if (session.user.role !== 'admin') {
    return (
      <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[150] flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden flex flex-col">
          <div className="p-8 bg-gradient-to-r from-red-600 to-pink-600 text-white flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-black">Access Denied</h2>
              <p className="text-xs font-bold text-white/70 uppercase tracking-widest mt-1">Admin Only</p>
            </div>
            <button onClick={onClose} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-red-600">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </div>
            <h3 className="font-black text-slate-700 mb-2 text-lg">Settings Restricted</h3>
            <p className="text-sm text-slate-500 mb-6">
              Only administrators can access sync settings.
            </p>
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
  }

  const handleCopyScript = () => {
    const script = generateAppsScript();
    navigator.clipboard.writeText(script).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-xl z-[150] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-8 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-2xl font-black">Sync Settings</h2>
            <p className="text-xs font-bold text-white/70 uppercase tracking-widest mt-1">Data Export & Database</p>
          </div>
          <button onClick={onClose} className="bg-white/10 p-2 rounded-full hover:bg-white/20 transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex p-2 bg-slate-100 mx-6 mt-6 rounded-2xl shrink-0">
          <button
            onClick={() => setActiveTab('sheet')}
            className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${
              activeTab === 'sheet' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400'
            }`}
          >
            📊 Live Google Sheet
          </button>
          <button
            onClick={() => setActiveTab('database')}
            className={`flex-1 py-3 rounded-xl text-xs font-black transition-all ${
              activeTab === 'database' ? 'bg-white shadow-sm text-emerald-600' : 'text-slate-400'
            }`}
          >
            🗄️ Database
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {activeTab === 'sheet' && (
            <>
              {/* Explanation */}
              <div className="p-4 bg-emerald-50 rounded-2xl border-2 border-emerald-100">
                <p className="text-sm font-bold text-emerald-800 mb-1">Live Google Sheet Integration</p>
                <p className="text-xs text-emerald-600">
                  This creates a Google Sheet that auto-refreshes every 5 minutes with your latest stock data. 
                  The sheet pulls data directly from your database — no push sync needed.
                </p>
              </div>

              {/* Setup Steps */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Setup Steps</h3>
                
                <div className="flex gap-3 items-start">
                  <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5">1</span>
                  <p className="text-sm text-slate-600">Create a new <strong>Google Sheet</strong> (or open an existing one)</p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5">2</span>
                  <p className="text-sm text-slate-600">Go to <strong>Extensions → Apps Script</strong></p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5">3</span>
                  <p className="text-sm text-slate-600">Delete all existing code, paste the copied script, and <strong>Save</strong> (Ctrl+S)</p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5">4</span>
                  <p className="text-sm text-slate-600">Run the <strong>onOpen</strong> function once (click ▶ Run). Authorize when prompted.</p>
                </div>
                <div className="flex gap-3 items-start">
                  <span className="w-6 h-6 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-black shrink-0 mt-0.5">5</span>
                  <p className="text-sm text-slate-600">Go back to the sheet — use the <strong>Inventory Mandu</strong> menu → <strong>Setup Auto-Refresh</strong></p>
                </div>
              </div>

              {/* Copy Button */}
              <button
                onClick={handleCopyScript}
                className={`w-full py-4 rounded-2xl font-black text-lg transition-all flex items-center justify-center gap-3 ${
                  copied 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-slate-900 text-white hover:bg-slate-800'
                }`}
              >
                {copied ? (
                  <>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                    Copied to Clipboard!
                  </>
                ) : (
                  <>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                    Copy Script to Clipboard
                  </>
                )}
              </button>

              {/* Preview Toggle */}
              <button
                onClick={() => setShowPreview(!showPreview)}
                className="w-full text-left px-4 py-3 bg-slate-50 rounded-xl text-sm font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-all flex items-center justify-between"
              >
                <span>{showPreview ? 'Hide' : 'Preview'} Script Code</span>
                <svg 
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" 
                  className={`transition-transform ${showPreview ? 'rotate-180' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </button>

              {showPreview && (
                <div className="bg-slate-900 text-slate-300 rounded-2xl p-4 overflow-auto max-h-60">
                  <pre className="text-[10px] font-mono whitespace-pre-wrap leading-relaxed">
                    {generateAppsScript()}
                  </pre>
                </div>
              )}

              {/* Summary */}
              <div className="p-4 bg-slate-50 rounded-2xl">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Sheets Created</h4>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                    <span className="text-sm font-bold text-slate-700">Current Stock</span>
                    <span className="text-xs text-slate-400">— Category, Item, Unit, Stock, WIP, Min, Status</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-indigo-500 rounded-full"></span>
                    <span className="text-sm font-bold text-slate-700">Recent Transactions</span>
                    <span className="text-xs text-slate-400">— Last 200 entries with all details</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'database' && (
            <>
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
            </>
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
