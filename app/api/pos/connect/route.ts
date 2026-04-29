import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest) {
  const { restaurant_id, provider } = await req.json();
  if (!restaurant_id || !provider) return NextResponse.json({ error: "Fehlende Daten" }, { status: 400 });

  const admin = getAdmin();

  // Check if connection for this provider already exists
  const { data: existing } = await admin
    .from("pos_connections")
    .select("*")
    .eq("restaurant_id", restaurant_id)
    .eq("provider", provider)
    .single();

  if (existing) {
    // Reactivate if deactivated
    if (!existing.is_active) {
      const { data, error } = await admin
        .from("pos_connections")
        .update({ is_active: true })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ connection: data });
    }
    return NextResponse.json({ connection: existing });
  }

  const { data, error } = await admin
    .from("pos_connections")
    .insert({ restaurant_id, provider })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ connection: data });
}

export async function GET(req: NextRequest) {
  const restaurant_id = req.nextUrl.searchParams.get("restaurant_id");
  if (!restaurant_id) return NextResponse.json({ error: "Fehlt" }, { status: 400 });

  const admin = getAdmin();
  const { data } = await admin.from("pos_connections").select("*").eq("restaurant_id", restaurant_id);
  return NextResponse.json({ connections: data || [] });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  const admin = getAdmin();
  await admin.from("pos_connections").update({ is_active: false }).eq("id", id);
  return NextResponse.json({ success: true });
}
