CREATE TABLE IF NOT EXISTS pos_connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  provider TEXT NOT NULL, -- sumup, square, lightspeed, orderbird, generic
  api_key TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  is_active BOOLEAN DEFAULT true,
  last_sync TIMESTAMPTZ,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pos_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Chef can manage own pos" ON pos_connections
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE owner_id = auth.uid()));
