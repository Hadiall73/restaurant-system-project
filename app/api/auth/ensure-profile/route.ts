import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { user_id, email, name, phone } = body as Record<string, string>;

  if (!user_id || !email) {
    return NextResponse.json({ error: "Fehlende Daten" }, { status: 400 });
  }

  const admin = getAdmin();

  // Prüfen ob der User in Supabase Auth existiert
  const { data: authUser, error: authError } = await admin.auth.admin.getUserById(user_id);
  if (authError || !authUser.user) {
    return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 401 });
  }

  const devEmail = process.env.DEVELOPER_EMAIL;
  const role = email === devEmail ? "developer" : "employee";

  // Profil laden oder erstellen
  const { data: existing } = await admin.from("profiles").select("*").eq("id", user_id).single();
  if (existing) return NextResponse.json({ profile: existing });

  const { data: profile, error } = await admin.from("profiles").insert({
    id: user_id,
    email: email.toLowerCase().trim(),
    name: name || email.split("@")[0],
    role,
    phone: phone || null,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile });
}
