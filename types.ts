
export type TransactionType = 'IN' | 'OUT' | 'WIP';

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  minStock: number;
  description?: string;
}

export interface Transaction {
  id: string;
  itemId: string;
  type: TransactionType;
  quantity: number;
  user: string;
  reason: string;
  timestamp: number;
  signature?: string;
  synced?: boolean; // New sync state
}

export interface AppSettings {
  googleSheetUrl: string;
}
