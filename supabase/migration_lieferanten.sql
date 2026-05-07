-- ============================================================
-- MIGRATION: Lieferanten & Auto-Bestellung
-- In Supabase SQL Editor ausführen
-- ============================================================

-- Suppliers Tabelle
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  category TEXT,
  delivery_time TEXT DEFAULT '1 Tag',
  min_order_value DECIMAL(10,2) DEFAULT 0,
  payment_days INT DEFAULT 14,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory erweitern
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id);
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS order_quantity DECIMAL(10,3) DEFAULT 0;
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS auto_order BOOLEAN DEFAULT false;

-- Supplier Orders Tabelle
CREATE TABLE IF NOT EXISTS supplier_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  supplier_id UUID REFERENCES suppliers(id),
  inventory_id UUID REFERENCES inventory(id),
  article_name TEXT NOT NULL,
  quantity DECIMAL(10,3) NOT NULL,
  unit TEXT,
  total_price DECIMAL(10,2),
  order_type TEXT DEFAULT 'manual',
  status TEXT DEFAULT 'bestellt',
  ordered_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  notes TEXT
);

-- Soll-Stunden für Mitarbeiter
ALTER TABLE restaurant_members ADD COLUMN IF NOT EXISTS soll_stunden_woche INT DEFAULT 40;

-- RLS aktivieren
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Members see suppliers" ON suppliers;
DROP POLICY IF EXISTS "Chef manages suppliers" ON suppliers;
DROP POLICY IF EXISTS "Members see supplier orders" ON supplier_orders;
DROP POLICY IF EXISTS "Chef manages supplier orders" ON supplier_orders;

CREATE POLICY "Members see suppliers" ON suppliers FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));
CREATE POLICY "Chef manages suppliers" ON suppliers FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

CREATE POLICY "Members see supplier orders" ON supplier_orders FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));
CREATE POLICY "Chef manages supplier orders" ON supplier_orders FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));
