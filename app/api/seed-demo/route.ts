import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

const PREISE = [3.50, 4.20, 5.50, 6.50, 6.90, 7.90, 9.90, 12.90, 13.50, 14.90, 16.50];
const ZAHLARTEN = ["cash", "card", "card", "card", "online"];

function rnd(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function POST(req: NextRequest) {
  const { restaurant_id } = await req.json();
  if (!restaurant_id) {
    return NextResponse.json({ error: "restaurant_id fehlt" }, { status: 400 });
  }

  const admin = getAdmin();
  const sales: any[] = [];
  const now = new Date();

  for (let dayOffset = 13; dayOffset >= 0; dayOffset--) {
    const date = new Date(now);
    date.setDate(date.getDate() - dayOffset);

    // Mittagszeit
    const lunchCount = Math.floor(rnd(8, 18));
    for (let i = 0; i < lunchCount; i++) {
      const t = new Date(date);
      t.setHours(Math.floor(rnd(11, 14)), Math.floor(rnd(0, 59)), 0, 0);
      const items = Math.floor(rnd(1, 4));
      let amount = 0;
      for (let j = 0; j < items; j++) amount += pick(PREISE);
      sales.push({
        restaurant_id,
        amount:         Math.round(amount * 100) / 100,
        tip:            Math.random() > 0.5 ? Math.round(rnd(0.5, 3) * 2) / 2 : 0,
        payment_method: pick(ZAHLARTEN),
        table_number:   Math.floor(rnd(1, 20)),
        recorded_at:    t.toISOString(),
      });
    }

    // Abendzeit
    const dinnerCount = Math.floor(rnd(12, 25));
    for (let i = 0; i < dinnerCount; i++) {
      const t = new Date(date);
      t.setHours(Math.floor(rnd(18, 22)), Math.floor(rnd(0, 59)), 0, 0);
      const items = Math.floor(rnd(2, 5));
      let amount = 0;
      for (let j = 0; j < items; j++) amount += pick(PREISE);
      sales.push({
        restaurant_id,
        amount:         Math.round(amount * 100) / 100,
        tip:            Math.random() > 0.4 ? Math.round(rnd(1, 5) * 2) / 2 : 0,
        payment_method: pick(ZAHLARTEN),
        table_number:   Math.floor(rnd(1, 20)),
        recorded_at:    t.toISOString(),
      });
    }
  }

  const { error } = await admin.from("sales").insert(sales);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true, count: sales.length });
}

export async function DELETE(req: NextRequest) {
  const { restaurant_id } = await req.json();
  if (!restaurant_id) {
    return NextResponse.json({ error: "restaurant_id fehlt" }, { status: 400 });
  }
  const admin = getAdmin();
  const twoWeeksAgo = new Date(Date.now() - 15 * 86400000).toISOString();
  await admin.from("sales").delete().eq("restaurant_id", restaurant_id).gte("recorded_at", twoWeeksAgo);
  return NextResponse.json({ success: true });
}
