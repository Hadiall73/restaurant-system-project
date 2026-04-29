import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function generateKey(plan: string) {
  const prefix = plan === "enterprise" ? "ENT" : plan === "pro" ? "PRO" : "BSC";
  const random = randomBytes(4).toString("hex").toUpperCase();
  const random2 = randomBytes(4).toString("hex").toUpperCase();
  return `RESTO-${prefix}-${random}-${random2}`;
}

// POST /api/keys — create a new license key (developer only)
export async function POST(req: NextRequest) {
  const { plan = "basic", max_employees = 10, notes, expires_days, developer_email } = await req.json();

  if (developer_email !== process.env.DEVELOPER_EMAIL) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const supabaseAdmin = getAdmin();
  const key = generateKey(plan);
  const expires_at = expires_days
    ? new Date(Date.now() + expires_days * 86400000).toISOString()
    : null;

  const { data, error } = await supabaseAdmin.from("license_keys").insert({
    key, plan, max_employees, notes, expires_at,
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
