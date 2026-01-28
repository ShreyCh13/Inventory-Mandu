// Re-export types from the new database types for backwards compatibility
export type { 
  User, 
  Category,
  Contractor,
  InventoryItem, 
  Transaction, 
  AuthSession, 
  AppSettings 
} from './lib/database.types';

export type TransactionType = 'IN' | 'OUT' | 'WIP';

// Legacy interface for backwards compatibility
export interface InventoryItemWithOwner {
  id: string;
  name: string;
  category: string;
  categoryId?: string;
  unit: string;
  minStock: number;
  description?: string;
  createdBy: string;
}
