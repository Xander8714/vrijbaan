import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
  if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Stripe webhook nog niet geconfigureerd." }, { status: 501 });
  }
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Ontbrekende Stripe-signature header." }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Stripe webhook signature ongeldig:", err);
    return NextResponse.json({ error: "Ongeldige webhook signature." }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.user_id;
    if (userId && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = supabaseAdmin();
      const { error } = await admin.from("profiles").update({
        subscription_status: "pro",
        stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
      }).eq("id", userId);
      if (error) { console.error("Kon profiel niet updaten na checkout:", error); return NextResponse.json({ error: "Database-update mislukt." }, { status: 500 }); }
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const admin = supabaseAdmin();
      await admin.from("profiles").update({ subscription_status: "free" }).eq("stripe_customer_id", typeof sub.customer === "string" ? sub.customer : "");
    }
  }

  return NextResponse.json({ received: true });
}
