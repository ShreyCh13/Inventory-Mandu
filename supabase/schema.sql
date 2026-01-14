-- ============================================
-- INVENTORY MANDU - Supabase Database Schema
-- ============================================
-- Run this SQL in your Supabase SQL Editor to set up the database
-- Go to: Supabase Dashboard > SQL Editor > New Query

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    role VARCHAR(10) DEFAULT 'user' CHECK (role IN ('admin', 'user')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster login lookups
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- ============================================
-- CATEGORIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for sorting
CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order);

-- ============================================
-- ITEMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(200) NOT NULL,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    unit VARCHAR(50) NOT NULL,
    min_stock INTEGER DEFAULT 0,
    description TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category_id);
CREATE INDEX IF NOT EXISTS idx_items_name ON items(name);

-- ============================================
-- TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    type VARCHAR(3) NOT NULL CHECK (type IN ('IN', 'OUT', 'WIP')),
    quantity DECIMAL(12, 3) NOT NULL CHECK (
        (type IN ('IN', 'OUT') AND quantity > 0) OR 
        (type = 'WIP' AND quantity != 0)
    ),
    user_name VARCHAR(100) NOT NULL,
    reason TEXT NOT NULL,
    signature TEXT,
    location VARCHAR(200),
    amount DECIMAL(12, 2),
    bill_number VARCHAR(100),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance on large datasets
CREATE INDEX IF NOT EXISTS idx_transactions_item ON transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON transactions(created_by);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_transactions_item_date ON transactions(item_id, created_at DESC);

-- ============================================
-- APP SETTINGS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS app_settings (
    id VARCHAR(100) PRIMARY KEY,
    key VARCHAR(100) NOT NULL,
    value TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SEED DEFAULT DATA
-- ============================================

-- Insert default admin user
INSERT INTO users (id, username, password, display_name, role)
VALUES 
    ('00000000-0000-0000-0000-000000000001', 'admin', 'admin123', 'Administrator', 'admin'),
    ('00000000-0000-0000-0000-000000000002', 'mandu', 'mandu123', 'Mandu User', 'user')
ON CONFLICT (username) DO NOTHING;

-- Insert default categories
INSERT INTO categories (name, sort_order)
VALUES 
    ('Paint', 1),
    ('Polish', 2),
    ('POP', 3),
    ('Electrical', 4),
    ('Lighting', 5),
    ('Civil Consumables', 6),
    ('Plumbing', 7),
    ('Fire', 8),
    ('HVAC', 9),
    ('Wood', 10),
    ('Carpenter', 11),
    ('Landscaping', 12),
    ('Water bodies', 13),
    ('Pathhar', 14),
    ('Wire Outdoor Electrical', 15),
    ('Sanitary', 16),
    ('Kitchen', 17),
    ('Lift', 18),
    ('Civil (fawda, tasla etc)', 19),
    ('Miscellaneous', 20)
ON CONFLICT (name) DO NOTHING;

-- ============================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================
-- Note: For this app, we're using a simple auth model
-- If you want per-user data isolation, uncomment and customize these

-- ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- For now, allow all authenticated access (using anon key)
-- This is fine for internal business apps

-- ============================================
-- ENABLE REALTIME
-- ============================================
-- Enable real-time updates for all tables

ALTER PUBLICATION supabase_realtime ADD TABLE users;
ALTER PUBLICATION supabase_realtime ADD TABLE categories;
ALTER PUBLICATION supabase_realtime ADD TABLE items;
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE app_settings;

-- ============================================
-- USEFUL VIEWS (Optional)
-- ============================================

-- View: Current stock levels for all items
-- Note: WIP does NOT subtract from stock - items are still in inventory
CREATE OR REPLACE VIEW current_stock AS
SELECT 
    i.id,
    i.name,
    c.name as category,
    i.unit,
    i.min_stock,
    COALESCE(
        SUM(CASE WHEN t.type = 'IN' THEN t.quantity ELSE 0 END) -
        SUM(CASE WHEN t.type = 'OUT' THEN t.quantity ELSE 0 END),
        0
    ) as current_quantity,
    COALESCE(
        SUM(CASE WHEN t.type = 'WIP' THEN t.quantity ELSE 0 END),
        0
    ) as wip_quantity
FROM items i
LEFT JOIN categories c ON i.category_id = c.id
LEFT JOIN transactions t ON i.id = t.item_id
GROUP BY i.id, i.name, c.name, i.unit, i.min_stock;

-- View: Daily transaction summary
CREATE OR REPLACE VIEW daily_summary AS
SELECT 
    DATE(created_at) as date,
    type,
    COUNT(*) as transaction_count,
    SUM(quantity) as total_quantity,
    SUM(COALESCE(amount, 0)) as total_amount
FROM transactions
GROUP BY DATE(created_at), type
ORDER BY date DESC;

-- ============================================
-- MAINTENANCE FUNCTIONS (Optional)
-- ============================================

-- Function to archive old transactions (call periodically)
CREATE OR REPLACE FUNCTION archive_old_transactions(days_to_keep INTEGER DEFAULT 365)
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    -- In a real scenario, you'd move to an archive table
    -- For now, this just counts what would be archived
    SELECT COUNT(*) INTO archived_count
    FROM transactions
    WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL;
    
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- MIGRATION NOTE: Allow negative WIP quantities
-- ============================================
-- If you already have the transactions table, run this to update the constraint:
-- ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_quantity_check;
-- ALTER TABLE transactions ADD CONSTRAINT transactions_quantity_check 
--   CHECK ((type IN ('IN', 'OUT') AND quantity > 0) OR (type = 'WIP' AND quantity != 0));

-- ============================================
-- DONE!
-- ============================================
-- Your database is ready. Now:
-- 1. Copy your Supabase URL and anon key
-- 2. Add them to your .env.local file
-- 3. Deploy to Vercel
-- 4. If updating existing database, run the migration SQL above
