import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(req: NextRequest) {
  const user_id = req.nextUrl.searchParams.get("user_id");
  const role    = req.nextUrl.searchParams.get("role") || "chef";
  if (!user_id) return NextResponse.json({ error: "user_id fehlt" }, { status: 400 });

  const admin = getAdmin();

  if (role === "employee") {
    // Mitarbeiter: Restaurant über restaurant_members finden (Service-Role umgeht RLS)
    const { data: member } = await admin
      .from("restaurant_members")
      .select("restaurant_id, restaurants(*)")
      .eq("user_id", user_id)
      .eq("is_active", true)
      .single();
    return NextResponse.json({ restaurant: member ? (member as any).restaurants : null });
  }

  // Chef: eigenes Restaurant
  const { data: restaurant } = await admin
    .from("restaurants")
    .select("*")
    .eq("owner_id", user_id)
    .single();

  return NextResponse.json({ restaurant: restaurant || null });
}
