import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

// Normalize sale data from different POS providers
function parseSale(provider: string, body: any): { amount: number; tip: number; payment_method: string; table_number?: number } | null {
  try {
    switch (provider) {
      case "sumup":
        if (body.event_type !== "PAYMENT" && body.event_type !== "transaction.completed") return null;
        const sp = body.payload || body;
        return {
          amount: Number(sp.amount || sp.local_amount || 0),
          tip: Number(sp.tip_amount || 0),
          payment_method: sp.payment_type || "card",
        };

      case "square":
        const sqPay = body.data?.object?.payment || body.payment;
        if (!sqPay || sqPay.status !== "COMPLETED") return null;
        return {
          amount: Number(sqPay.amount_money?.amount || 0) / 100,
          tip: Number(sqPay.tip_money?.amount || 0) / 100,
          payment_method: sqPay.source_type?.toLowerCase() || "card",
        };

      case "lightspeed":
        const ls = body.sale || body;
        return {
          amount: Number(ls.total || ls.totalIncl || 0),
          tip: Number(ls.tip || 0),
          payment_method: ls.paymentType || "card",
          table_number: ls.tableId ? Number(ls.tableId) : undefined,
        };

      case "orderbird":
        const ob = body.order || body;
        return {
          amount: Number(ob.total_gross || ob.amount || 0),
          tip: Number(ob.tip || 0),
          payment_method: ob.payment_method || "card",
          table_number: ob.table_number ? Number(ob.table_number) : undefined,
        };

      case "gastrofix":
        return {
          amount: Number(body.total || body.amount || 0),
          tip: Number(body.gratuity || 0),
          payment_method: body.paymentType || "card",
          table_number: body.tableNo ? Number(body.tableNo) : undefined,
        };

      case "zettle":
        const zt = body.payload || body;
        return {
          amount: Number(zt.amount || 0) / 100,
          tip: 0,
          payment_method: zt.paymentType?.toLowerCase() || "card",
        };

      case "generic":
      default:
        return {
          amount: Number(body.amount || body.total || body.price || 0),
          tip: Number(body.tip || body.gratuity || 0),
          payment_method: body.payment_method || body.paymentType || "card",
          table_number: body.table_number || body.table || undefined,
        };
    }
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ restaurant_id: string }> }) {
  const { restaurant_id } = await params;
  const apiKey = req.headers.get("x-api-key") || req.nextUrl.searchParams.get("key");

  const admin = getAdmin();

  // Validate API key
  const { data: conn } = await admin
    .from("pos_connections")
    .select("*")
    .eq("restaurant_id", restaurant_id)
    .eq("api_key", apiKey)
    .eq("is_active", true)
    .single();

  if (!conn) return NextResponse.json({ error: "Ungültiger API Key" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const sale = parseSale(conn.provider, body);

  if (!sale || sale.amount <= 0) {
    return NextResponse.json({ received: true, skipped: true });
  }

  // Save sale
  await admin.from("sales").insert({
    restaurant_id,
    amount: sale.amount,
    tip: sale.tip,
    payment_method: sale.payment_method,
    table_number: sale.table_number || null,
    recorded_at: new Date().toISOString(),
  });

  // Update last_sync
  await admin.from("pos_connections").update({ last_sync: new Date().toISOString() }).eq("id", conn.id);

  return NextResponse.json({ success: true, amount: sale.amount });
}
