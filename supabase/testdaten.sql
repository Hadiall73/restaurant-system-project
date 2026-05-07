-- ============================================================
-- TESTDATEN – Restaurant Management System (kein Kassensystem)
-- Ausführen in: Supabase SQL Editor
-- https://supabase.com/dashboard/project/xxtagxsckryszgwknlzu/sql/new
-- ============================================================

-- Reservierungen-Tabelle anlegen (falls noch nicht vorhanden)
CREATE TABLE IF NOT EXISTS reservations (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  name          TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  date          DATE NOT NULL,
  time          TEXT NOT NULL DEFAULT '18:00',
  guests        INT  NOT NULL DEFAULT 2,
  notes         TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Chef manages reservations" ON reservations;
CREATE POLICY "Chef manages reservations" ON reservations FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));
DROP POLICY IF EXISTS "Members see reservations" ON reservations;
CREATE POLICY "Members see reservations" ON reservations FOR SELECT
  USING (restaurant_id IN (SELECT restaurant_id FROM restaurant_members WHERE user_id = auth.uid()));

-- Messages-Tabelle anlegen (falls noch nicht vorhanden)
CREATE TABLE IF NOT EXISTS messages (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE NOT NULL,
  sender_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content       TEXT,
  type          TEXT NOT NULL DEFAULT 'text',
  file_url      TEXT,
  file_name     TEXT,
  file_size     BIGINT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Testdaten einfügen
DO $$
DECLARE
  v_rest_id  UUID;
  v_emp_ids  UUID[];
  v_sup1     UUID;
  v_sup2     UUID;
  v_sup3     UUID;
  i          INT;
BEGIN

  -- Restaurant holen
  SELECT id INTO v_rest_id FROM restaurants ORDER BY created_at DESC LIMIT 1;
  IF v_rest_id IS NULL THEN
    RAISE EXCEPTION 'Kein Restaurant gefunden! Bitte zuerst auf https://restaurant-system-murex.vercel.app/auth registrieren.';
  END IF;
  RAISE NOTICE 'Restaurant: %', v_rest_id;

  -- Mitarbeiter holen
  SELECT ARRAY_AGG(user_id) INTO v_emp_ids
  FROM restaurant_members WHERE restaurant_id = v_rest_id AND role = 'employee';

  -- ── LIEFERANTEN ──────────────────────────────────────────────────────────
  INSERT INTO suppliers (restaurant_id, name, contact_person, phone, email, category, delivery_time, min_order_value, payment_days)
  VALUES (v_rest_id, 'Metzgerei Koch GmbH', 'Hans Koch', '+49 89 1234567', 'bestellung@metzgerei-koch.de', 'Fleisch & Fisch', '1 Tag', 200.00, 14)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sup1 FROM suppliers WHERE restaurant_id = v_rest_id AND name = 'Metzgerei Koch GmbH';

  INSERT INTO suppliers (restaurant_id, name, contact_person, phone, email, category, delivery_time, min_order_value, payment_days)
  VALUES (v_rest_id, 'Großmarkt Frisch GmbH', 'Maria Bauer', '+49 89 2345678', 'info@grossmarkt-frisch.de', 'Gemüse & Obst', '2 Tage', 100.00, 7)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sup2 FROM suppliers WHERE restaurant_id = v_rest_id AND name = 'Großmarkt Frisch GmbH';

  INSERT INTO suppliers (restaurant_id, name, contact_person, phone, email, category, delivery_time, min_order_value, payment_days)
  VALUES (v_rest_id, 'Getränke Wagner KG', 'Stefan Wagner', '+49 89 3456789', 'order@getraenke-wagner.de', 'Getränke', '3 Tage', 300.00, 30)
  ON CONFLICT DO NOTHING;
  SELECT id INTO v_sup3 FROM suppliers WHERE restaurant_id = v_rest_id AND name = 'Getränke Wagner KG';

  -- ── LAGERBESTAND (Zutaten & Verbrauchsmaterial) ──────────────────────────
  INSERT INTO inventory (restaurant_id, supplier_id, name, unit, current_quantity, minimum_quantity, order_quantity, price_per_unit, auto_order) VALUES
    (v_rest_id, v_sup1, 'Rinderfilet',           'kg',      6.5,  3.0, 10.0, 45.00, true),
    (v_rest_id, v_sup1, 'Schweineschnitzel',      'kg',     14.0,  5.0, 15.0, 12.50, true),
    (v_rest_id, v_sup1, 'Lachsfilet',             'kg',      4.0,  2.0,  8.0, 28.00, true),
    (v_rest_id, v_sup1, 'Hähnchenbrust',          'kg',      9.0,  4.0, 12.0,  8.90, true),
    (v_rest_id, v_sup2, 'Tomaten',                'kg',     22.0,  8.0, 20.0,  2.80, false),
    (v_rest_id, v_sup2, 'Salat Römisch',          'Stk',    35.0, 10.0, 30.0,  1.50, false),
    (v_rest_id, v_sup2, 'Spinat frisch',          'kg',      5.0,  2.0,  8.0,  4.20, false),
    (v_rest_id, v_sup2, 'Kartoffeln',             'kg',     30.0, 10.0, 25.0,  0.90, false),
    (v_rest_id, v_sup2, 'Zwiebeln',               'kg',     12.0,  5.0, 15.0,  0.80, false),
    (v_rest_id, NULL,   'Mehl Type 405',          'kg',     28.0, 10.0, 25.0,  1.20, false),
    (v_rest_id, NULL,   'Pasta Spaghetti',        'kg',     18.0,  5.0, 20.0,  2.30, false),
    (v_rest_id, NULL,   'Olivenöl',               'L',       9.0,  3.0, 10.0,  8.50, false),
    (v_rest_id, NULL,   'Butter',                 'kg',      6.0,  2.0,  8.0,  9.80, false),
    (v_rest_id, NULL,   'Sahne 30%',              'L',      12.0,  4.0, 10.0,  3.20, false),
    (v_rest_id, NULL,   'Salz',                   'kg',      8.0,  2.0, 10.0,  0.60, false),
    (v_rest_id, v_sup3, 'Hausbier Fass 30L',      'Fass',    3.0,  2.0,  4.0, 95.00, true),
    (v_rest_id, v_sup3, 'Cola 1L',                'Flasche', 52.0, 24.0, 48.0,  1.20, true),
    (v_rest_id, v_sup3, 'Weißwein Chardonnay',    'Flasche', 18.0, 12.0, 24.0,  8.50, false),
    (v_rest_id, v_sup3, 'Rotwein Cabernet',       'Flasche',  1.5, 12.0, 24.0,  9.20, true),  -- ⚠️ kritisch!
    (v_rest_id, NULL,   'Servietten 500er Pack',  'Pack',   10.0,  3.0,  5.0,  4.50, false),
    (v_rest_id, NULL,   'Reinigungsmittel',       'L',       6.0,  2.0,  5.0,  3.80, false)
  ON CONFLICT DO NOTHING;

  -- ── RESERVIERUNGEN ───────────────────────────────────────────────────────
  INSERT INTO reservations (restaurant_id, name, phone, email, date, time, guests, notes, status) VALUES
    (v_rest_id, 'Familie Müller',      '+49 170 1234567', 'mueller@gmail.com', CURRENT_DATE + 1,  '18:30', 4,  'Fensterplatz gewünscht',                'confirmed'),
    (v_rest_id, 'Thomas Schmidt',      '+49 171 2345678', null,                CURRENT_DATE + 1,  '19:00', 2,  null,                                    'confirmed'),
    (v_rest_id, 'Firma Bauer GmbH',    '+49 172 3456789', 'bauer@firma.de',    CURRENT_DATE + 2,  '12:00', 8,  'Geschäftsessen – ruhige Ecke bitte',    'confirmed'),
    (v_rest_id, 'Geburtstag Weber',    '+49 173 4567890', 'weber@web.de',      CURRENT_DATE + 3,  '19:30', 6,  'Geburtstagstorte wird mitgebracht',     'pending'),
    (v_rest_id, 'Anna Fischer',        '+49 174 5678901', 'anna.f@mail.de',    CURRENT_DATE + 4,  '13:00', 2,  null,                                    'confirmed'),
    (v_rest_id, 'Klaus Wagner',        '+49 175 6789012', null,                CURRENT_DATE + 5,  '20:00', 3,  'Vegetarisch bitte',                     'pending'),
    (v_rest_id, 'Familie Schulz',      '+49 176 7890123', null,                CURRENT_DATE + 6,  '18:00', 5,  'Kinderstuhl benötigt',                  'confirmed'),
    (v_rest_id, 'Hochzeitsfeier Klein','+49 178 9012345', 'klein@web.de',      CURRENT_DATE + 10, '17:00', 20, 'Komplette Reservierung, Menü besprochen','confirmed'),
    (v_rest_id, 'Sabine Hoffmann',     '+49 170 9876543', 'hoffmann@web.de',   CURRENT_DATE - 1,  '18:00', 4,  null,                                    'confirmed'),
    (v_rest_id, 'Peter Becker',        '+49 179 1234567', null,                CURRENT_DATE - 2,  '19:30', 2,  null,                                    'confirmed')
  ON CONFLICT DO NOTHING;

  -- ── TAGESUMSÄTZE (letzte 30 Tage, Montag Ruhetag) ───────────────────────
  FOR i IN 1..30 LOOP
    CONTINUE WHEN EXTRACT(DOW FROM (CURRENT_DATE - i)) = 1;
    -- Abend
    INSERT INTO sales (restaurant_id, amount, tip, payment_method, table_number, recorded_at)
    VALUES (v_rest_id, ROUND((800+random()*1000)::numeric,2), ROUND((30+random()*80)::numeric,2),
      (ARRAY['cash','card','card','card'])[floor(random()*4+1)::int],
      floor(random()*15+1)::int, CURRENT_DATE - i + interval '19 hours');
    -- Mittag
    INSERT INTO sales (restaurant_id, amount, tip, payment_method, table_number, recorded_at)
    VALUES (v_rest_id, ROUND((250+random()*350)::numeric,2), ROUND((10+random()*25)::numeric,2),
      (ARRAY['cash','card'])[floor(random()*2+1)::int],
      floor(random()*8+1)::int, CURRENT_DATE - i + interval '12 hours 30 minutes');
  END LOOP;

  -- ── AUSGABEN ─────────────────────────────────────────────────────────────
  INSERT INTO expenses (restaurant_id, category, amount_net, amount_gross, vat_rate, vat_amount, supplier, description, invoice_date) VALUES
    (v_rest_id, 'Wareneinkauf', 1042.02, 1240.00, 19, 197.98, 'Metzgerei Koch GmbH',   'Fleisch & Geflügel Wochenlieferung',   CURRENT_DATE - 3),
    (v_rest_id, 'Wareneinkauf',  355.14,  380.50,  7,  25.36, 'Großmarkt Frisch GmbH', 'Gemüse & Salat Lieferung',             CURRENT_DATE - 3),
    (v_rest_id, 'Wareneinkauf',  436.97,  520.00, 19,  83.03, 'Getränke Wagner KG',    'Getränke & Bier Lieferung',            CURRENT_DATE - 5),
    (v_rest_id, 'Energie',       747.90,  890.00, 19, 142.10, 'Stadtwerke München',    'Stromrechnung Mai 2026',               CURRENT_DATE - 7),
    (v_rest_id, 'Energie',       210.08,  250.00, 19,  39.92, 'Stadtwerke München',    'Gasrechnung Mai 2026',                 CURRENT_DATE - 7),
    (v_rest_id, 'Betriebsmittel',122.10,  145.30, 19,  23.20, 'Metro Cash & Carry',    'Reinigungsmittel & Verbrauchsmaterial',CURRENT_DATE - 8),
    (v_rest_id, 'Reparaturen',   268.91,  320.00, 19,  51.09, 'Kältetechnik Meier',    'Reparatur Kühlschrank',                CURRENT_DATE - 10),
    (v_rest_id, 'Marketing',     168.07,  200.00, 19,  31.93, 'Meta Ads',              'Instagram & Facebook Werbung',         CURRENT_DATE - 14),
    (v_rest_id, 'Buchhaltung',   546.22,  650.00, 19, 103.78, 'Steuerberater Schulz',  'Buchhaltung & Beratung Q1 2026',       CURRENT_DATE - 15),
    (v_rest_id, 'Wareneinkauf', 1100.00, 1309.00, 19, 209.00, 'Metzgerei Koch GmbH',   'Fleisch Sonderlieferung',              CURRENT_DATE - 17),
    (v_rest_id, 'Miete',        2100.00, 2499.00, 19, 399.00, 'Hausverwaltung GmbH',   'Monatsmiete Mai 2026',                 CURRENT_DATE - 1),
    (v_rest_id, 'Versicherung',  420.17,  500.00, 19,  79.83, 'Allianz',               'Betriebshaftpflicht Quartal',          CURRENT_DATE - 20)
  ON CONFLICT DO NOTHING;

  -- ── SCHICHTEN ────────────────────────────────────────────────────────────
  IF v_emp_ids IS NOT NULL AND array_length(v_emp_ids, 1) > 0 THEN
    -- Vergangene Schichten (abgestempelt)
    FOR i IN 1..7 LOOP
      CONTINUE WHEN EXTRACT(DOW FROM (CURRENT_DATE - i)) = 1;
      INSERT INTO shifts (restaurant_id, user_id, start_time, end_time, actual_start, actual_end, is_clocked_in, hourly_wage)
      VALUES (v_rest_id, v_emp_ids[1],
        CURRENT_DATE - i + interval '8 hours',  CURRENT_DATE - i + interval '16 hours',
        CURRENT_DATE - i + interval '8 hours 4 minutes', CURRENT_DATE - i + interval '16 hours 6 minutes',
        false, 13.50);
    END LOOP;
    -- Zukünftige Schichten
    FOR i IN 1..7 LOOP
      CONTINUE WHEN EXTRACT(DOW FROM (CURRENT_DATE + i)) = 1;
      INSERT INTO shifts (restaurant_id, user_id, start_time, end_time, is_clocked_in, hourly_wage)
      VALUES (v_rest_id, v_emp_ids[1], CURRENT_DATE + i + interval '9 hours', CURRENT_DATE + i + interval '17 hours', false, 13.50);
    END LOOP;
    -- 2. Mitarbeiter
    IF array_length(v_emp_ids, 1) >= 2 THEN
      FOR i IN 1..7 LOOP
        CONTINUE WHEN EXTRACT(DOW FROM (CURRENT_DATE + i)) = 1;
        INSERT INTO shifts (restaurant_id, user_id, start_time, end_time, is_clocked_in, hourly_wage)
        VALUES (v_rest_id, v_emp_ids[2], CURRENT_DATE + i + interval '14 hours', CURRENT_DATE + i + interval '22 hours', false, 13.50);
      END LOOP;
    END IF;
  ELSE
    RAISE NOTICE 'Keine Mitarbeiter – Schichten übersprungen.';
  END IF;

  RAISE NOTICE '✅ Fertig! Lieferanten: 3 | Lager: 21 | Reservierungen: 10 | Umsätze: ~50 | Ausgaben: 12';
END $$;
