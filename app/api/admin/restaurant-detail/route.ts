import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const developerEmail = searchParams.get("developer_email");
  const restaurantId = searchParams.get("restaurant_id");

  if (developerEmail !== process.env.DEVELOPER_EMAIL) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const admin = getAdmin();

  const [membersRes, salesRes, shiftsRes] = await Promise.all([
    admin.from("restaurant_members").select("*, profiles(name, email, role)").eq("restaurant_id", restaurantId),
    admin.from("sales").select("*").eq("restaurant_id", restaurantId).order("recorded_at", { ascending: false }).limit(50),
    admin.from("shifts").select("*, profiles(name)").eq("restaurant_id", restaurantId).order("start_time", { ascending: false }).limit(20),
  ]);

  return NextResponse.json({
    members: membersRes.data || [],
    sales: salesRes.data || [],
    shifts: shiftsRes.data || [],
  });
}

export async function PATCH(req: NextRequest) {
  const { developer_email, restaurant_id, updates } = await req.json();

  if (developer_email !== process.env.DEVELOPER_EMAIL) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const admin = getAdmin();
  const { error } = await admin.from("restaurants").update(updates).eq("id", restaurant_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const { developer_email, sale_id } = await req.json();

  if (developer_email !== process.env.DEVELOPER_EMAIL) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 403 });
  }

  const admin = getAdmin();
  const { error } = await admin.from("sales").delete().eq("id", sale_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
