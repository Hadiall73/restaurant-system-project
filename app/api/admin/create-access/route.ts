import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function POST(req: NextRequest) {
  const { developer_email, restaurant_name, chef_name, chef_email, chef_password } = await req.json();

  if (developer_email !== process.env.DEVELOPER_EMAIL) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const supabaseAdmin = getAdmin();

  // Create auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: chef_email,
    password: chef_password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    return NextResponse.json({ error: authError?.message || "Auth-Fehler" }, { status: 500 });
  }

  const userId = authData.user.id;
  const inviteCode = randomBytes(3).toString("hex").toUpperCase();

  // Create profile
  await supabaseAdmin.from("profiles").insert({
    id: userId,
    name: chef_name,
    email: chef_email,
    role: "chef",
  });

  // Create restaurant
  const { data: restaurant, error: restError } = await supabaseAdmin.from("restaurants").insert({
    name: restaurant_name,
    owner_id: userId,
    email: chef_email,
    invite_code: inviteCode,
    is_active: true,
  }).select().single();

  if (restError || !restaurant) {
    return NextResponse.json({ error: restError?.message || "Restaurant-Fehler" }, { status: 500 });
  }

  // Add chef as member
  await supabaseAdmin.from("restaurant_members").insert({
    restaurant_id: restaurant.id,
    user_id: userId,
    role: "chef",
    hourly_wage: 0,
    position: "Chef",
    is_active: true,
  });

  return NextResponse.json({ success: true, restaurant, invite_code: inviteCode });
}
