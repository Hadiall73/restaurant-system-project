import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function generateKey() {
  const a = randomBytes(4).toString("hex").toUpperCase();
  const b = randomBytes(4).toString("hex").toUpperCase();
  const c = randomBytes(4).toString("hex").toUpperCase();
  return `RESTO-${a}-${b}-${c}`;
}

// POST /api/keys — create a new license key (developer only)
export async function POST(req: NextRequest) {
  const { notes, expires_days, developer_email } = await req.json();

  if (developer_email !== process.env.DEVELOPER_EMAIL) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const supabaseAdmin = getAdmin();
  const key        = generateKey();
  const expires_at = expires_days
    ? new Date(Date.now() + expires_days * 86400000).toISOString()
    : null;

  const { data, error } = await supabaseAdmin.from("license_keys").insert({
    key, notes, expires_at,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ key: data });
}

// GET /api/keys — list all keys (developer only)
export async function GET(req: NextRequest) {
  const devEmail = req.headers.get("x-developer-email");
  if (devEmail !== process.env.DEVELOPER_EMAIL) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const supabaseAdmin = getAdmin();
  const { data, error } = await supabaseAdmin
    .from("license_keys")
    .select("*, restaurants(name)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys: data });
}
