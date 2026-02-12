// Google Apps Script generator for Live Google Sheet integration

const getSupabaseUrl = (): string => import.meta.env.VITE_SUPABASE_URL || '';
const getSupabaseAnonKey = (): string => import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const generateAppsScript = (): string => {
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
