-- Secure one-time term access checkout.
-- Apply after the demo schema in SUPABASE-SETUP.md.

ALTER TABLE orders ADD COLUMN IF NOT EXISTS source_funnel VARCHAR(20);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS access_months INTEGER;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS activation_status VARCHAR(30) DEFAULT 'pending';

CREATE TABLE IF NOT EXISTS order_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    sku VARCHAR(100) NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    item_kind VARCHAR(30) NOT NULL CHECK (item_kind IN ('access', 'addon')),
    amount_bdt DECIMAL(10,2) NOT NULL,
    amount_usd DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(order_id, sku)
);

CREATE TABLE IF NOT EXISTS access_entitlements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID REFERENCES orders(id) ON DELETE RESTRICT UNIQUE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    customer_email VARCHAR(255) NOT NULL,
    status VARCHAR(30) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert orders" ON orders;
DROP POLICY IF EXISTS "Users can update own orders" ON orders;
CREATE POLICY "Users view own access" ON access_entitlements
    FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users view own order items" ON order_items
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM orders
            WHERE orders.id = order_items.order_id
              AND orders.user_id = auth.uid()
        )
    );

CREATE INDEX IF NOT EXISTS idx_entitlements_user_status
    ON access_entitlements(user_id, status, ends_at);
CREATE INDEX IF NOT EXISTS idx_order_items_order
    ON order_items(order_id);
