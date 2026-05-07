import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST(req: NextRequest) {
  const body      = await req.text();
  const signature = req.headers.get("stripe-signature") || "";

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Ungültige Signatur" }, { status: 400 });
  }

  const admin = getAdmin();

  if (event.type === "checkout.session.completed") {
    const session      = event.data.object as Stripe.Checkout.Session;
    const restaurantId = session.metadata?.restaurant_id;
    if (restaurantId) {
      await admin.from("restaurants").update({
        is_paid:            true,
        stripe_customer_id: session.customer as string,
        stripe_sub_id:      session.subscription as string,
      }).eq("id", restaurantId);
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub          = event.data.object as Stripe.Subscription;
    const { data: rs } = await admin
      .from("restaurants")
      .select("id")
      .eq("stripe_sub_id", sub.id)
      .single();
    if (rs) {
      await admin.from("restaurants").update({ is_paid: false }).eq("id", rs.id);
    }
  }

  return NextResponse.json({ received: true });
}
