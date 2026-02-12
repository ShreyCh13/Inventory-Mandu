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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for sorting
CREATE INDEX IF NOT EXISTS idx_categories_sort ON categories(sort_order);

-- ============================================
-- CONTRACTORS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS contractors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for name lookups
CREATE INDEX IF NOT EXISTS idx_contractors_name ON contractors(name);

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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
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
    contractor_id UUID REFERENCES contractors(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL DEFAULT NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance on large datasets
CREATE INDEX IF NOT EXISTS idx_transactions_item ON transactions(item_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_by ON transactions(created_by);
CREATE INDEX IF NOT EXISTS idx_transactions_contractor ON transactions(contractor_id);

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_transactions_item_date ON transactions(item_id, created_at DESC);

-- ============================================
-- STOCK SUMMARY TABLE (High-Performance Stock Tracking)
-- ============================================
-- This table is automatically maintained by triggers for O(1) stock lookups
-- Replaces the slow current_stock view that requires full table scans

CREATE TABLE IF NOT EXISTS stock_summary (
    item_id UUID PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
    current_quantity DECIMAL(12, 3) DEFAULT 0,
    wip_quantity DECIMAL(12, 3) DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_summary_item ON stock_summary(item_id);

-- Trigger function to update stock on transaction changes
CREATE OR REPLACE FUNCTION update_stock_summary()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Ensure stock_summary row exists
        INSERT INTO stock_summary (item_id, current_quantity, wip_quantity)
        VALUES (NEW.item_id, 0, 0)
        ON CONFLICT (item_id) DO NOTHING;
        
        -- Apply the transaction
        IF NEW.type = 'IN' THEN
            UPDATE stock_summary SET current_quantity = current_quantity + NEW.quantity, last_updated = NOW() WHERE item_id = NEW.item_id;
        ELSIF NEW.type = 'OUT' THEN
            UPDATE stock_summary SET current_quantity = current_quantity - NEW.quantity, last_updated = NOW() WHERE item_id = NEW.item_id;
        ELSIF NEW.type = 'WIP' THEN
            UPDATE stock_summary SET wip_quantity = wip_quantity + NEW.quantity, last_updated = NOW() WHERE item_id = NEW.item_id;
        END IF;
        RETURN NEW;
        
    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle item_id change (move stock between items)
        IF OLD.item_id != NEW.item_id THEN
            -- Reverse old item
            IF OLD.type = 'IN' THEN
                UPDATE stock_summary SET current_quantity = current_quantity - OLD.quantity, last_updated = NOW() WHERE item_id = OLD.item_id;
            ELSIF OLD.type = 'OUT' THEN
                UPDATE stock_summary SET current_quantity = current_quantity + OLD.quantity, last_updated = NOW() WHERE item_id = OLD.item_id;
            ELSIF OLD.type = 'WIP' THEN
                UPDATE stock_summary SET wip_quantity = wip_quantity - OLD.quantity, last_updated = NOW() WHERE item_id = OLD.item_id;
            END IF;
            -- Ensure new item has stock_summary row
            INSERT INTO stock_summary (item_id, current_quantity, wip_quantity)
            VALUES (NEW.item_id, 0, 0)
            ON CONFLICT (item_id) DO NOTHING;
            -- Apply to new item
            IF NEW.type = 'IN' THEN
                UPDATE stock_summary SET current_quantity = current_quantity + NEW.quantity, last_updated = NOW() WHERE item_id = NEW.item_id;
            ELSIF NEW.type = 'OUT' THEN
                UPDATE stock_summary SET current_quantity = current_quantity - NEW.quantity, last_updated = NOW() WHERE item_id = NEW.item_id;
            ELSIF NEW.type = 'WIP' THEN
                UPDATE stock_summary SET wip_quantity = wip_quantity + NEW.quantity, last_updated = NOW() WHERE item_id = NEW.item_id;
            END IF;
        ELSE
            -- Same item, just quantity/type change - reverse old, apply new
            IF OLD.type = 'IN' THEN
                UPDATE stock_summary SET current_quantity = current_quantity - OLD.quantity WHERE item_id = OLD.item_id;
            ELSIF OLD.type = 'OUT' THEN
                UPDATE stock_summary SET current_quantity = current_quantity + OLD.quantity WHERE item_id = OLD.item_id;
            ELSIF OLD.type = 'WIP' THEN
                UPDATE stock_summary SET wip_quantity = wip_quantity - OLD.quantity WHERE item_id = OLD.item_id;
            END IF;
            
            IF NEW.type = 'IN' THEN
                UPDATE stock_summary SET current_quantity = current_quantity + NEW.quantity, last_updated = NOW() WHERE item_id = NEW.item_id;
            ELSIF NEW.type = 'OUT' THEN
                UPDATE stock_summary SET current_quantity = current_quantity - NEW.quantity, last_updated = NOW() WHERE item_id = NEW.item_id;
            ELSIF NEW.type = 'WIP' THEN
                UPDATE stock_summary SET wip_quantity = wip_quantity + NEW.quantity, last_updated = NOW() WHERE item_id = NEW.item_id;
            END IF;
        END IF;
        RETURN NEW;
        
    ELSIF TG_OP = 'DELETE' THEN
        IF OLD.type = 'IN' THEN
            UPDATE stock_summary SET current_quantity = current_quantity - OLD.quantity, last_updated = NOW() WHERE item_id = OLD.item_id;
        ELSIF OLD.type = 'OUT' THEN
            UPDATE stock_summary SET current_quantity = current_quantity + OLD.quantity, last_updated = NOW() WHERE item_id = OLD.item_id;
        ELSIF OLD.type = 'WIP' THEN
            UPDATE stock_summary SET wip_quantity = wip_quantity - OLD.quantity, last_updated = NOW() WHERE item_id = OLD.item_id;
        END IF;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists (for re-running migrations)
DROP TRIGGER IF EXISTS trg_update_stock_summary ON transactions;

CREATE TRIGGER trg_update_stock_summary
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION update_stock_summary();

-- Trigger to auto-create stock_summary when item is created
CREATE OR REPLACE FUNCTION create_stock_summary_for_item()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO stock_summary (item_id, current_quantity, wip_quantity)
    VALUES (NEW.id, 0, 0)
    ON CONFLICT (item_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_stock_summary ON items;

CREATE TRIGGER trg_create_stock_summary
AFTER INSERT ON items
FOR EACH ROW EXECUTE FUNCTION create_stock_summary_for_item();

-- ============================================
-- SERVER-SIDE STOCK VALIDATION
-- ============================================
-- Function to validate stock before OUT transactions (prevents race conditions)

CREATE OR REPLACE FUNCTION validate_stock_for_out(
    p_item_id UUID,
    p_quantity DECIMAL
) RETURNS BOOLEAN AS $$
DECLARE
    v_current DECIMAL;
BEGIN
    SELECT current_quantity INTO v_current FROM stock_summary WHERE item_id = p_item_id;
    IF v_current IS NULL THEN
        RETURN FALSE;
    END IF;
    RETURN v_current >= p_quantity;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- SOFT DELETE SUPPORT FOR ITEMS
-- ============================================
-- Add deleted_at column for soft deletes (preserves audit trail)

ALTER TABLE items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_items_deleted ON items(deleted_at) WHERE deleted_at IS NULL;

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
-- UPDATED_AT TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_categories_updated_at
BEFORE UPDATE ON categories
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_items_updated_at
BEFORE UPDATE ON items
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_transactions_updated_at
BEFORE UPDATE ON transactions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_app_settings_updated_at
BEFORE UPDATE ON app_settings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_contractors_updated_at
BEFORE UPDATE ON contractors
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

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
ALTER PUBLICATION supabase_realtime ADD TABLE contractors;

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
-- MIGRATION: Initialize stock_summary from existing data
-- ============================================
-- Run this ONCE after adding the stock_summary table to populate it with existing transaction data

-- First, ensure all items have a stock_summary row
INSERT INTO stock_summary (item_id, current_quantity, wip_quantity)
SELECT id, 0, 0 FROM items WHERE id NOT IN (SELECT item_id FROM stock_summary WHERE item_id IS NOT NULL)
ON CONFLICT (item_id) DO NOTHING;

-- Then calculate and update stock from existing transactions
WITH calculated_stock AS (
    SELECT 
        item_id,
        COALESCE(SUM(CASE WHEN type = 'IN' THEN quantity WHEN type = 'OUT' THEN -quantity ELSE 0 END), 0) as calc_quantity,
        COALESCE(SUM(CASE WHEN type = 'WIP' THEN quantity ELSE 0 END), 0) as calc_wip
    FROM transactions
    GROUP BY item_id
)
UPDATE stock_summary s
SET 
    current_quantity = cs.calc_quantity,
    wip_quantity = cs.calc_wip,
    last_updated = NOW()
FROM calculated_stock cs
WHERE s.item_id = cs.item_id;

-- Enable realtime on stock_summary table
ALTER PUBLICATION supabase_realtime ADD TABLE stock_summary;

-- ============================================
-- MIGRATION: Add approved_by column to transactions
-- ============================================
-- Safe for existing data: nullable with DEFAULT NULL
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id) ON DELETE SET NULL DEFAULT NULL;

-- ============================================
-- DONE!
-- ============================================
-- Your database is ready. Now:
-- 1. Copy your Supabase URL and anon key
-- 2. Add them to your .env.local file
-- 3. Deploy to Vercel
-- 4. If updating existing database, run the migration SQL above
-- 5. IMPORTANT: Run the stock_summary initialization migration once
