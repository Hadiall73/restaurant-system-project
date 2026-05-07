import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/support — Chef erstellt Ticket
export async function POST(req: NextRequest) {
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 }); }

  const { user_id, restaurant_id, subject, message, category } = body;
  if (!user_id || !restaurant_id || !subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Alle Felder ausfüllen" }, { status: 400 });
  }

  const admin = getAdmin();
  const { data, error } = await admin.from("support_tickets").insert({
    user_id,
    restaurant_id,
    subject:  subject.trim().slice(0, 200),
    message:  message.trim().slice(0, 2000),
    category: category || "general",
    status:   "open",
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ticket: data });
}

// GET /api/support?user_id=...&restaurant_id=... — Tickets für dieses Restaurant
// GET /api/support?developer_email=... — alle Tickets (Developer)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const devEmail     = searchParams.get("developer_email");
  const restaurantId = searchParams.get("restaurant_id");

  const admin = getAdmin();

  if (devEmail) {
    if (devEmail !== process.env.DEVELOPER_EMAIL) {
      return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
    }
    const { data, error } = await admin
      .from("support_tickets")
      .select("*, restaurants(name), profiles(name, email)")
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ tickets: data });
  }

  if (!restaurantId) {
    return NextResponse.json({ error: "restaurant_id fehlt" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("support_tickets")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tickets: data });
}

// PATCH /api/support — Developer antwortet / ändert Status
export async function PATCH(req: NextRequest) {
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 }); }

  const { developer_email, ticket_id, status, developer_reply } = body;
  if (developer_email !== process.env.DEVELOPER_EMAIL) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }
  if (!ticket_id) {
    return NextResponse.json({ error: "ticket_id fehlt" }, { status: 400 });
  }

  const admin = getAdmin();
  const updates: any = { updated_at: new Date().toISOString() };
  if (status)           updates.status           = status;
  if (developer_reply !== undefined) {
    updates.developer_reply = developer_reply;
    updates.replied_at      = new Date().toISOString();
    updates.status          = "answered";
  }

  const { error } = await admin.from("support_tickets").update(updates).eq("id", ticket_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
