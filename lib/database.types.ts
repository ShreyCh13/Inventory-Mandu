// Supabase Database Types - Auto-generated structure
// These match the SQL schema we'll create in Supabase

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          username: string;
          password: string;
          display_name: string;
          role: 'admin' | 'user';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          username: string;
          password: string;
          display_name: string;
          role?: 'admin' | 'user';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          username?: string;
          password?: string;
          display_name?: string;
          role?: 'admin' | 'user';
          created_at?: string;
          updated_at?: string;
        };
      };
      categories: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          sort_order?: number;
          updated_at?: string;
        };
      };
      items: {
        Row: {
          id: string;
          name: string;
          category_id: string;
          unit: string;
          min_stock: number;
          description: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          category_id: string;
          unit: string;
          min_stock?: number;
          description?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          category_id?: string;
          unit?: string;
          min_stock?: number;
          description?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          item_id: string;
          type: 'IN' | 'OUT' | 'WIP';
          quantity: number;
          user_name: string;
          reason: string;
          signature: string | null;
          location: string | null;
          amount: number | null;
          bill_number: string | null;
          contractor_id: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          item_id: string;
          type: 'IN' | 'OUT' | 'WIP';
          quantity: number;
          user_name: string;
          reason: string;
          signature?: string | null;
          location?: string | null;
          amount?: number | null;
          bill_number?: string | null;
          contractor_id?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          item_id?: string;
          type?: 'IN' | 'OUT' | 'WIP';
          quantity?: number;
          user_name?: string;
          reason?: string;
          signature?: string | null;
          location?: string | null;
          amount?: number | null;
          bill_number?: string | null;
          contractor_id?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      contractors: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      app_settings: {
        Row: {
          id: string;
          key: string;
          value: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          value: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          value?: string;
          updated_at?: string;
        };
      };
    };
  };
}

// Transformed types for the frontend (camelCase, computed fields)
export interface User {
  id: string;
  username: string;
  password: string;
  displayName: string;
  role: 'admin' | 'user';
  createdAt: number;
  updatedAt?: number;
}

export interface Category {
  id: string;
  name: string;
  sortOrder: number;
  updatedAt?: number;
}

export interface Contractor {
  id: string;
  name: string;
  updatedAt?: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string; // category name for backwards compatibility
  categoryId: string;
  unit: string;
  minStock: number;
  description?: string;
  createdBy: string;
  updatedAt?: number;
}

export interface Transaction {
  id: string;
  itemId: string;
  type: 'IN' | 'OUT' | 'WIP';
  quantity: number;
  user: string;
  reason: string;
  timestamp: number;
  signature?: string;
  location?: string;
  amount?: number;
  billNumber?: string;
  contractorId?: string;
  createdBy: string;
  updatedAt?: number;
}

export interface AuthSession {
  user: Omit<User, 'password'>;
  loginAt: number;
}

export interface AppSettings {
  googleSheetUrl: string;
}

// Type converters - DB row to frontend model
export const dbToUser = (row: Database['public']['Tables']['users']['Row']): User => ({
  id: row.id,
  username: row.username,
  password: row.password,
  displayName: row.display_name,
  role: row.role,
  createdAt: new Date(row.created_at).getTime(),
  updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : undefined
});

export const dbToCategory = (row: Database['public']['Tables']['categories']['Row']): Category => ({
  id: row.id,
  name: row.name,
  sortOrder: row.sort_order,
  updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : undefined
});

export const dbToContractor = (row: Database['public']['Tables']['contractors']['Row']): Contractor => ({
  id: row.id,
  name: row.name,
  updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : undefined
});

export const dbToItem = (
  row: Database['public']['Tables']['items']['Row'],
  categoryName: string
): InventoryItem => ({
  id: row.id,
  name: row.name,
  category: categoryName,
  categoryId: row.category_id,
  unit: row.unit,
  minStock: row.min_stock,
  description: row.description || undefined,
  createdBy: row.created_by,
  updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : undefined
});

export const dbToTransaction = (row: Database['public']['Tables']['transactions']['Row']): Transaction => ({
  id: row.id,
  itemId: row.item_id,
  type: row.type,
  quantity: row.quantity,
  user: row.user_name,
  reason: row.reason,
  timestamp: new Date(row.created_at).getTime(),
  signature: row.signature || undefined,
  location: row.location || undefined,
  amount: row.amount || undefined,
  billNumber: row.bill_number || undefined,
  contractorId: row.contractor_id || undefined,
  createdBy: row.created_by,
  updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : undefined
});
