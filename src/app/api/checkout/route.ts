import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe is nog niet geconfigureerd. Zet STRIPE_SECRET_KEY in .env.local." }, { status: 501 });
  }
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Log eerst in." }, { status: 401 });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card", "ideal"],
    line_items: [{ price: process.env.STRIPE_PRICE_ID_PRO!, quantity: 1 }],
    customer_email: user.email,
    success_url: `${origin}/account?upgrade=success`,
    cancel_url: `${origin}/pricing?upgrade=cancelled`,
    metadata: { user_id: user.id },
  });
  return NextResponse.json({ url: session.url });
}
