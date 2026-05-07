-- ============================================================
-- RESTAURANT SYSTEM - SECURITY HARDENING & RLS
-- Execute this in: Supabase -> SQL Editor
-- ============================================================

-- 1. ENABLE RLS ON ALL TABLES (Double Check)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookkeeping_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE dish_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- 2. REFINED SECURITY POLICIES

-- Profiles: Users see own profile, Chef sees all
CREATE POLICY "Profiles: View own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Profiles: Chef view all" ON profiles FOR SELECT 
  USING (EXISTS (SELECT 1 FROM restaurant_members WHERE user_id = auth.uid() AND role = 'chef'));

-- Restaurants: Members see their own restaurant
CREATE POLICY "Restaurants: Member view" ON restaurants FOR SELECT
  USING (id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));
CREATE POLICY "Restaurants: Owner manage" ON restaurants FOR ALL
  USING (owner_id = auth.uid());

-- Restaurant Members: Members see fellow staff, Chef manages
CREATE POLICY "Members: View fellow staff" ON restaurant_members FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));
CREATE POLICY "Members: Chef manage" ON restaurant_members FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

-- Sales & Dish Orders: Members view/insert, Chef manages
CREATE POLICY "Sales: Member view" ON sales FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));
CREATE POLICY "Sales: Member insert" ON sales FOR INSERT
  WITH CHECK (restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));
CREATE POLICY "Sales: Chef manage" ON sales FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

CREATE POLICY "DishOrders: Member view" ON dish_orders FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));
CREATE POLICY "DishOrders: Member insert" ON dish_orders FOR INSERT
  WITH CHECK (restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));

-- Inventory & Suppliers: Member view, Chef manage
CREATE POLICY "Inventory: Member view" ON inventory FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));
CREATE POLICY "Inventory: Chef manage" ON inventory FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

-- License Keys: Only owner
CREATE POLICY "License: Owner only" ON license_keys FOR SELECT
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

-- 3. AUDIT LOGGING SYSTEM
CREATE TABLE IF NOT EXISTS restaurant_system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id),
  event_type TEXT NOT NULL, -- 'AUTH', 'FINANCE', 'SENSITIVE_CHANGE'
  severity TEXT DEFAULT 'INFO',
  message TEXT,
  user_id UUID REFERENCES profiles(id),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE restaurant_system_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Logs: Owner view" ON restaurant_system_logs FOR SELECT 
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));
CREATE POLICY "Logs: System insert" ON restaurant_system_logs FOR INSERT WITH CHECK (true);

-- 4. AUTO-LOGGING TRIGGER FOR SENSITIVE DATA (Expenses)
CREATE OR REPLACE FUNCTION log_expense_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO restaurant_system_logs (restaurant_id, event_type, severity, message, details)
  VALUES (NEW.restaurant_id, 'FINANCE', 'WARN', 'Expense added/updated: ' || NEW.id, jsonb_build_object('amount', NEW.amount_gross));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_log_expense
AFTER INSERT OR UPDATE ON expenses
FOR EACH ROW EXECUTE FUNCTION log_expense_L();
