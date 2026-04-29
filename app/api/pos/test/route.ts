import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest) {
  const { connection_id, restaurant_id } = await req.json();
  if (!connection_id || !restaurant_id) return NextResponse.json({ error: "Fehlende Daten" }, { status: 400 });

  const admin = getAdmin();

  const { data: conn } = await admin
    .from("pos_connections")
    .select("*")
    .eq("id", connection_id)
    .eq("restaurant_id", restaurant_id)
    .single();

  if (!conn) return NextResponse.json({ error: "Verbindung nicht gefunden" }, { status: 404 });

  const testAmount = parseFloat((Math.random() * 40 + 5).toFixed(2));
  const methods = ["cash", "card", "card", "card"];
  const method = methods[Math.floor(Math.random() * methods.length)];

  await admin.from("sales").insert({
    restaurant_id,
    amount: testAmount,
    tip: 0,
    payment_method: method,
    table_number: Math.floor(Math.random() * 10) + 1,
    recorded_at: new Date().toISOString(),
  });

  await admin
    .from("pos_connections")
    .update({ last_sync: new Date().toISOString() })
    .eq("id", connection_id);

  return NextResponse.json({ success: true, amount: testAmount, method });
}
