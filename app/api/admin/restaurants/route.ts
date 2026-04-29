import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const developerEmail = searchParams.get("developer_email");

  if (developerEmail !== process.env.DEVELOPER_EMAIL) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const admin = getAdmin();
  const { data, error } = await admin
    .from("restaurants")
    .select("*, restaurant_members(count)")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ restaurants: data || [] });
}

export async function PATCH(req: NextRequest) {
  const { developer_email, id, is_active } = await req.json();

  if (developer_email !== process.env.DEVELOPER_EMAIL) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const admin = getAdmin();
  const { error } = await admin.from("restaurants").update({ is_active }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
