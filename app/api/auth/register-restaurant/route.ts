import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitize(str: string) {
  return str.trim().slice(0, 200).replace(/[<>]/g, "");
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 }); }

  const { restaurant_name, chef_name, chef_email, chef_password, license_key } =
    body as Record<string, string>;

  // ── Validierung ────────────────────────────────────────────────────────────
  if (!restaurant_name?.trim() || !chef_name?.trim() || !chef_email?.trim() || !chef_password || !license_key?.trim()) {
    return NextResponse.json({ error: "Alle Felder sind erforderlich" }, { status: 400 });
  }
  if (!isValidEmail(chef_email.trim())) {
    return NextResponse.json({ error: "Ungültige E-Mail-Adresse" }, { status: 400 });
  }
  if (chef_password.length < 6) {
    return NextResponse.json({ error: "Passwort muss mindestens 6 Zeichen haben" }, { status: 400 });
  }

  const cleanRestaurant = sanitize(restaurant_name);
  const cleanName       = sanitize(chef_name);
  const cleanEmail      = chef_email.trim().toLowerCase();
  const cleanKey        = license_key.trim().toUpperCase();

  const admin = getAdmin();

  // ── Lizenzschlüssel prüfen ──────────────────────────────────────────────
  const { data: license } = await admin
    .from("license_keys")
    .select("*")
    .eq("key", cleanKey)
    .single();

  if (!license) {
    return NextResponse.json({ error: "Ungültiger Lizenzschlüssel" }, { status: 400 });
  }
  if (license.restaurant_id) {
    return NextResponse.json({ error: "Dieser Lizenzschlüssel wurde bereits verwendet" }, { status: 400 });
  }
  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    return NextResponse.json({ error: "Dieser Lizenzschlüssel ist abgelaufen" }, { status: 400 });
  }

  // ── Auth-User erstellen ─────────────────────────────────────────────────
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: cleanEmail,
    password: chef_password,
    email_confirm: true,
    user_metadata: { name: cleanName },
  });

  if (authError || !authData.user) {
    if (authError?.message?.includes("already")) {
      return NextResponse.json({ error: "Diese E-Mail ist bereits registriert" }, { status: 400 });
    }
    return NextResponse.json({ error: "Registrierung fehlgeschlagen" }, { status: 500 });
  }

  const userId     = authData.user.id;
  const inviteCode = randomBytes(3).toString("hex").toUpperCase();

  // ── Profil erstellen ────────────────────────────────────────────────────
  const { error: profileError } = await admin.from("profiles").insert({
    id:    userId,
    name:  cleanName,
    email: cleanEmail,
    role:  "chef",
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: "Profil konnte nicht erstellt werden" }, { status: 500 });
  }

  // ── Trial: 14 Tage kostenlos, dann 99,99 €/Monat ───────────────────────
  const trialEndsAt = new Date(Date.now() + 14 * 86400000).toISOString();

  // ── Restaurant erstellen ────────────────────────────────────────────────
  const { data: restaurant, error: restError } = await admin
    .from("restaurants")
    .insert({
      name:          cleanRestaurant,
      owner_id:      userId,
      email:         cleanEmail,
      invite_code:   inviteCode,
      is_active:     true,
      trial_ends_at: trialEndsAt,
      is_paid:       false,
    })
    .select()
    .single();

  if (restError || !restaurant) {
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: "Restaurant konnte nicht erstellt werden" }, { status: 500 });
  }

  // ── Chef als Mitglied hinzufügen ────────────────────────────────────────
  await admin.from("restaurant_members").insert({
    restaurant_id: restaurant.id,
    user_id:       userId,
    role:          "chef",
    hourly_wage:   0,
    position:      "Chef",
    is_active:     true,
  });

  // ── Lizenzschlüssel verknüpfen ──────────────────────────────────────────
  await admin.from("license_keys").update({
    restaurant_id: restaurant.id,
    activated_at:  new Date().toISOString(),
  }).eq("key", cleanKey);

  return NextResponse.json({
    success:         true,
    invite_code:     inviteCode,
    restaurant_name: cleanRestaurant,
    trial_ends_at:   trialEndsAt,
  });
}
