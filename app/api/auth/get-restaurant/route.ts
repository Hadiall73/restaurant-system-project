import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

export async function GET(req: NextRequest) {
  const user_id = req.nextUrl.searchParams.get("user_id");
  if (!user_id) return NextResponse.json({ error: "user_id fehlt" }, { status: 400 });

  const admin = getAdmin();
  const { data: restaurant } = await admin
    .from("restaurants")
    .select("*")
    .eq("owner_id", user_id)
    .single();

  return NextResponse.json({ restaurant: restaurant || null });
}
