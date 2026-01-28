-- ============================================
-- INVENTORY MANDU v4.0 MIGRATION
-- ============================================
-- Run this SQL in Supabase SQL Editor to upgrade your existing database
-- This adds the high-performance stock_summary table and triggers
-- 
-- IMPORTANT: Run this ONCE on your existing database
-- ============================================

-- Step 1: Create stock_summary table for O(1) stock lookups
CREATE TABLE IF NOT EXISTS stock_summary (
    item_id UUID PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
    current_quantity DECIMAL(12, 3) DEFAULT 0,
    wip_quantity DECIMAL(12, 3) DEFAULT 0,
    last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stock_summary_item ON stock_summary(item_id);

-- Step 2: Create trigger function to auto-update stock on transaction changes
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

-- Step 3: Create trigger on transactions table
DROP TRIGGER IF EXISTS trg_update_stock_summary ON transactions;

CREATE TRIGGER trg_update_stock_summary
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION update_stock_summary();

-- Step 4: Create trigger to auto-create stock_summary when item is created
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

-- Step 5: Create stock validation function (optional - for server-side validation)
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

-- Step 6: Add soft delete column to items (for audit trail)
ALTER TABLE items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_items_deleted ON items(deleted_at) WHERE deleted_at IS NULL;

-- Step 7: Initialize stock_summary from existing data
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

-- Step 8: Enable realtime on stock_summary table
ALTER PUBLICATION supabase_realtime ADD TABLE stock_summary;

-- ============================================
-- VERIFICATION
-- ============================================
-- Run this query to verify the migration worked:
-- SELECT i.name, s.current_quantity, s.wip_quantity 
-- FROM stock_summary s 
-- JOIN items i ON s.item_id = i.id 
-- LIMIT 10;

-- ============================================
-- DONE!
-- ============================================
-- Your database is now upgraded to v4.0
-- Stock lookups are now O(1) instead of O(n) for large transaction tables
