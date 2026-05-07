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
  let body: any;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 }); }

  const { restaurant_id, restaurant_name, email } = body;
  if (!restaurant_id || !email) {
    return NextResponse.json({ error: "Fehlende Parameter" }, { status: 400 });
  }

  const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "";

  const session = await stripe.checkout.sessions.create({
    mode:                 "subscription",
    payment_method_types: ["card"],
    customer_email:       email,
    line_items: [
      {
        price_data: {
          currency:    "eur",
          unit_amount: 9999, // 99.99 €
          recurring:   { interval: "month" },
          product_data: {
            name:        "Restaurant System Abo",
            description: `${restaurant_name} · Unbegrenzte Nutzung`,
          },
        },
        quantity: 1,
      },
    ],
    metadata:   { restaurant_id },
    success_url: `${origin}/chef?abo=success`,
    cancel_url:  `${origin}/chef?abo=cancel`,
  });

  return NextResponse.json({ url: session.url });
}
