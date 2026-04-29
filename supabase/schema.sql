-- ============================================================
-- RESTAURANT SYSTEM - COMPLETE DATABASE SCHEMA
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────
-- LICENSE KEYS (Developer creates these)
-- ─────────────────────────────────────────────
CREATE TABLE license_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'basic', -- basic, pro, enterprise
  max_employees INT NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  restaurant_id UUID,
  is_active BOOLEAN DEFAULT true,
  notes TEXT
);

-- ─────────────────────────────────────────────
-- RESTAURANTS (Rooms - Chef creates with key)
-- ─────────────────────────────────────────────
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  license_key TEXT REFERENCES license_keys(key),
  owner_id UUID NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  logo_url TEXT,
  currency TEXT DEFAULT 'EUR',
  timezone TEXT DEFAULT 'Europe/Berlin',
  invite_code TEXT UNIQUE DEFAULT substr(md5(random()::text), 1, 8),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- ─────────────────────────────────────────────
-- USER PROFILES (linked to Supabase Auth)
-- ─────────────────────────────────────────────
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'employee', -- developer, chef, employee
  avatar_url TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- RESTAURANT MEMBERS
-- ─────────────────────────────────────────────
CREATE TABLE restaurant_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'employee', -- chef, manager, employee
  hourly_wage DECIMAL(10,2) DEFAULT 13.00,
  position TEXT, -- Koch, Kellner, Barkeeper etc.
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  UNIQUE(restaurant_id, user_id)
);

-- ─────────────────────────────────────────────
-- SALES (Real-time Umsatz)
-- ─────────────────────────────────────────────
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  tip DECIMAL(10,2) DEFAULT 0,
  payment_method TEXT DEFAULT 'cash', -- cash, card, online
  table_number INT,
  recorded_by UUID REFERENCES profiles(id),
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- ─────────────────────────────────────────────
-- DISHES / MENU ITEMS
-- ─────────────────────────────────────────────
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT, -- Vorspeise, Hauptgang, Dessert, Getränk
  price DECIMAL(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- DISH ORDERS (counts per dish)
-- ─────────────────────────────────────────────
CREATE TABLE dish_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  quantity INT NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  ordered_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- SHIFTS (Schichten - wer arbeitet gerade)
-- ─────────────────────────────────────────────
CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  actual_start TIMESTAMPTZ, -- when they clock in
  actual_end TIMESTAMPTZ,   -- when they clock out
  is_clocked_in BOOLEAN DEFAULT false,
  hourly_wage DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- AVAILABILITY (Mitarbeiter Verfügbarkeit)
-- ─────────────────────────────────────────────
CREATE TABLE availability (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  week_start DATE NOT NULL, -- Monday of the week
  monday BOOLEAN DEFAULT false,
  tuesday BOOLEAN DEFAULT false,
  wednesday BOOLEAN DEFAULT false,
  thursday BOOLEAN DEFAULT false,
  friday BOOLEAN DEFAULT false,
  saturday BOOLEAN DEFAULT false,
  sunday BOOLEAN DEFAULT false,
  monday_note TEXT,
  tuesday_note TEXT,
  wednesday_note TEXT,
  thursday_note TEXT,
  friday_note TEXT,
  saturday_note TEXT,
  sunday_note TEXT,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(restaurant_id, user_id, week_start)
);

-- ─────────────────────────────────────────────
-- EXPENSES (Ausgaben / Buchhaltung)
-- ─────────────────────────────────────────────
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- Wareneinkauf, Personal, Miete, Energie, Sonstiges
  amount_net DECIMAL(10,2) NOT NULL,
  amount_gross DECIMAL(10,2) NOT NULL,
  vat_rate DECIMAL(5,2) DEFAULT 19,
  vat_amount DECIMAL(10,2),
  supplier TEXT,
  description TEXT,
  invoice_number TEXT,
  invoice_date DATE,
  receipt_url TEXT,
  recorded_by UUID REFERENCES profiles(id),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- BOOKKEEPING ENTRIES (Automatische Buchführung)
-- ─────────────────────────────────────────────
CREATE TABLE bookkeeping_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- income, expense, wage, tax
  amount DECIMAL(10,2) NOT NULL,
  description TEXT NOT NULL,
  reference_id UUID, -- sale_id, expense_id, etc.
  reference_type TEXT, -- sale, expense, wage, manual
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- INVENTORY (Lagerbestand)
-- ─────────────────────────────────────────────
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT DEFAULT 'kg',
  current_quantity DECIMAL(10,3) DEFAULT 0,
  minimum_quantity DECIMAL(10,3) DEFAULT 0,
  price_per_unit DECIMAL(10,2),
  supplier TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- REALTIME ENABLE
-- ─────────────────────────────────────────────
ALTER TABLE sales REPLICA IDENTITY FULL;
ALTER TABLE shifts REPLICA IDENTITY FULL;
ALTER TABLE dish_orders REPLICA IDENTITY FULL;

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────
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
ALTER TABLE license_keys ENABLE ROW LEVEL SECURITY;

-- Profiles: users see own profile
CREATE POLICY "Users see own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Restaurants: members can see their restaurant
CREATE POLICY "Members see restaurant" ON restaurants FOR SELECT
  USING (id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));
CREATE POLICY "Chef can update restaurant" ON restaurants FOR UPDATE
  USING (owner_id = auth.uid());
CREATE POLICY "Authenticated can create restaurant" ON restaurants FOR INSERT
  WITH CHECK (auth.uid() = owner_id);

-- Restaurant members
CREATE POLICY "Members see fellow members" ON restaurant_members FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));
CREATE POLICY "Chef manages members" ON restaurant_members FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

-- Sales: members of restaurant
CREATE POLICY "Members see sales" ON sales FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));
CREATE POLICY "Members insert sales" ON sales FOR INSERT
  WITH CHECK (restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));

-- Shifts: members see shifts
CREATE POLICY "Members see shifts" ON shifts FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));
CREATE POLICY "Chef manages shifts" ON shifts FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));
CREATE POLICY "Employee update own shift" ON shifts FOR UPDATE
  USING (user_id = auth.uid());

-- Availability
CREATE POLICY "Members see availability" ON availability FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));
CREATE POLICY "Employee manage own availability" ON availability FOR ALL
  USING (user_id = auth.uid());

-- Expenses
CREATE POLICY "Members see expenses" ON expenses FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));
CREATE POLICY "Chef manages expenses" ON expenses FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

-- Bookkeeping
CREATE POLICY "Chef sees bookkeeping" ON bookkeeping_entries FOR SELECT
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

-- Menu items
CREATE POLICY "Members see menu" ON menu_items FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));
CREATE POLICY "Chef manages menu" ON menu_items FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

-- Dish orders
CREATE POLICY "Members see dish orders" ON dish_orders FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));
CREATE POLICY "Members insert dish orders" ON dish_orders FOR INSERT
  WITH CHECK (restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));

-- Inventory
CREATE POLICY "Members see inventory" ON inventory FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));
CREATE POLICY "Chef manages inventory" ON inventory FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));

-- License keys: developer only (managed via service role)
CREATE POLICY "Only authenticated see own license" ON license_keys FOR SELECT
  USING (true);

-- ─────────────────────────────────────────────
-- AUTO-BOOKKEEPING TRIGGER
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auto_bookkeeping_sale()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO bookkeeping_entries (restaurant_id, type, amount, description, reference_id, reference_type, entry_date)
  VALUES (NEW.restaurant_id, 'income', NEW.amount, 'Umsatz Tisch ' || COALESCE(NEW.table_number::text, '-'), NEW.id, 'sale', CURRENT_DATE);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_bookkeeping_sale
AFTER INSERT ON sales
FOR EACH ROW EXECUTE FUNCTION auto_bookkeeping_sale();

CREATE OR REPLACE FUNCTION auto_bookkeeping_expense()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO bookkeeping_entries (restaurant_id, type, amount, description, reference_id, reference_type, entry_date)
  VALUES (NEW.restaurant_id, 'expense', NEW.amount_gross, NEW.category || ': ' || COALESCE(NEW.description, NEW.supplier, ''), NEW.id, 'expense', COALESCE(NEW.invoice_date, CURRENT_DATE));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_bookkeeping_expense
AFTER INSERT ON expenses
FOR EACH ROW EXECUTE FUNCTION auto_bookkeeping_expense();

-- ─────────────────────────────────────────────
-- DEMO DATA FOR DEVELOPER
-- ─────────────────────────────────────────────
INSERT INTO license_keys (key, plan, max_employees, notes)
VALUES
  ('RESTO-DEMO-0001', 'basic', 5, 'Demo Key'),
  ('RESTO-PRO-0001', 'pro', 20, 'Pro Demo Key'),
  ('RESTO-ENT-0001', 'enterprise', 100, 'Enterprise Demo Key');
