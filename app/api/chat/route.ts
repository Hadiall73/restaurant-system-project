import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// Nachrichten laden
export async function GET(req: NextRequest) {
  const restaurant_id = req.nextUrl.searchParams.get("restaurant_id");
  if (!restaurant_id) return NextResponse.json({ error: "restaurant_id fehlt" }, { status: 400 });

  const admin = getAdmin();
  const { data, error } = await admin
    .from("messages")
    .select("*, profiles(name, role)")
    .eq("restaurant_id", restaurant_id)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) {
    // Tabelle existiert noch nicht
    if (error.code === "42P01") return NextResponse.json({ messages: [], missing_table: true });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ messages: data || [] });
}

// Nachricht senden
export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 }); }

  const { restaurant_id, sender_id, content, type, file_url, file_name, file_size } = body as Record<string, any>;
  if (!restaurant_id || !sender_id) return NextResponse.json({ error: "Pflichtfelder fehlen" }, { status: 400 });
  if (type === "text" && !content?.trim()) return NextResponse.json({ error: "Kein Inhalt" }, { status: 400 });

  const admin = getAdmin();
  const { data, error } = await admin.from("messages").insert({
    restaurant_id,
    sender_id,
    content: content?.trim() || null,
    type: type || "text",
    file_url: file_url || null,
    file_name: file_name || null,
    file_size: file_size || null,
  }).select("*, profiles(name, role)").single();

  if (error) {
    if (error.code === "42P01") return NextResponse.json({ error: "MISSING_TABLE" }, { status: 503 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ message: data });
}

// Nachricht löschen
export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const sender_id = req.nextUrl.searchParams.get("sender_id");
  const is_chef = req.nextUrl.searchParams.get("is_chef") === "true";

  if (!id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  const admin = getAdmin();

  // Prüfen ob erlaubt (eigene Nachricht oder Chef)
  if (!is_chef) {
    const { data: msg } = await admin.from("messages").select("sender_id").eq("id", id).single();
    if (!msg || msg.sender_id !== sender_id) {
      return NextResponse.json({ error: "Nicht erlaubt" }, { status: 403 });
    }
  }

  const { error } = await admin.from("messages").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
