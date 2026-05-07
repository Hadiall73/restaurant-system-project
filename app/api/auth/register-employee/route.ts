import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitize(str: string) {
  return str.trim().slice(0, 200).replace(/[<>]/g, "");
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const { name, email, password, invite_code } = body as Record<string, string>;

  // Validierung
  if (!name?.trim() || !email?.trim() || !password || !invite_code?.trim()) {
    return NextResponse.json({ error: "Alle Felder sind erforderlich" }, { status: 400 });
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Ungültige E-Mail-Adresse" }, { status: 400 });
  }
  if (password.length < 6 || password.length > 72) {
    return NextResponse.json({ error: "Passwort muss 6–72 Zeichen lang sein" }, { status: 400 });
  }
  if (name.trim().length < 2 || name.trim().length > 80) {
    return NextResponse.json({ error: "Name muss 2–80 Zeichen lang sein" }, { status: 400 });
  }
  if (invite_code.trim().length < 4 || invite_code.trim().length > 20) {
    return NextResponse.json({ error: "Ungültiger Einladungscode" }, { status: 400 });
  }

  const cleanName = sanitize(name);
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = invite_code.trim().toLowerCase();

  const admin = getAdmin();

  // Einladungscode prüfen — case-insensitive
  const { data: restaurant } = await admin
    .from("restaurants")
    .select("id, name")
    .ilike("invite_code", cleanCode)
    .eq("is_active", true)
    .single();

  if (!restaurant) {
    // Gleiche Fehlermeldung ob Code falsch oder Restaurant inaktiv (kein Info-Leak)
    return NextResponse.json({ error: "Ungültiger Einladungscode" }, { status: 400 });
  }

  // User erstellen — direkt bestätigt, kein E-Mail nötig
  const { data: userData, error: createError } = await admin.auth.admin.createUser({
    email: cleanEmail,
    password,
    email_confirm: true,
    user_metadata: { name: cleanName },
  });

  if (createError) {
    if (createError.message.includes("already been registered") || createError.message.includes("already exists")) {
      return NextResponse.json({ error: "Diese E-Mail ist bereits registriert" }, { status: 400 });
    }
    return NextResponse.json({ error: "Registrierung fehlgeschlagen" }, { status: 500 });
  }

  const userId = userData.user.id;

  // Profil erstellen
  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId,
    email: cleanEmail,
    name: cleanName,
    role: "employee",
  });

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: "Profil konnte nicht erstellt werden" }, { status: 500 });
  }

  // Dem Restaurant hinzufügen
  const { error: memberError } = await admin.from("restaurant_members").upsert({
    restaurant_id: restaurant.id,
    user_id: userId,
    role: "employee",
    is_active: true,
  }, { onConflict: "restaurant_id,user_id" });

  if (memberError) {
    await admin.auth.admin.deleteUser(userId);
    return NextResponse.json({ error: "Team-Zuweisung fehlgeschlagen" }, { status: 500 });
  }

  return NextResponse.json({ success: true, restaurant_name: restaurant.name });
}
