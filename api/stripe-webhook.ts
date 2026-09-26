import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Disable automatic body parsing so Stripe can verify raw body
export const config = {
  api: {
    bodyParser: false,
  },
};

async function getRawBody(req: VercelRequest): Promise<string> {
  const chunks: any[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const secretKey =
    process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_KEY ||
    process.env.STRIPE_API_KEY ||
    "";
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

  const stripe = new Stripe(secretKey, {
    apiVersion: "2023-10-16",
  });

  const sig = req.headers["stripe-signature"];

  if (!sig) {
    return res.status(400).json({ error: "Missing stripe-signature header." });
  }

  let event: Stripe.Event;

  try {
    const rawBody = await getRawBody(req);
    if (endpointSecret) {
      event = stripe.webhooks.constructEvent(rawBody, sig as string, endpointSecret);
    } else {
      // In development if webhook secret is not set yet
      event = JSON.parse(rawBody) as Stripe.Event;
    }
  } catch (err: any) {
    console.error(`⚠️ Webhook signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Connect to Supabase to update company subscription in database if configured
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

  switch (event.type) {
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const companyId = paymentIntent.metadata?.companyId;
      const packageId = paymentIntent.metadata?.packageId || "test";
      const amountUsd = (paymentIntent.amount / 100).toFixed(2);

      console.log(`✅ Payment succeeded on Vercel for company: ${companyId}, amount: $${amountUsd}`);

      if (supabase && companyId) {
        await supabase.from("company_subscriptions").upsert(
          {
            company_id: companyId,
            package_id: packageId,
            status: "active",
            amount_usd: Number(amountUsd),
            is_trial: false,
            stripe_payment_intent_id: paymentIntent.id,
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            package_mode_enabled: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "company_id" }
        );

        await supabase.from("payment_transactions").insert({
          company_id: companyId,
          package_id: packageId,
          amount_usd: Number(amountUsd),
          currency: paymentIntent.currency || "usd",
          status: "succeeded",
          provider: "stripe_vercel",
          provider_tx_id: paymentIntent.id,
          metadata: paymentIntent.metadata,
        });
      }
      break;
    }

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const companyId = session.metadata?.companyId;
      const packageId = session.metadata?.packageId || "standard";
      const amountUsd = session.amount_total ? (session.amount_total / 100).toFixed(2) : "0.00";

      if (supabase && companyId) {
        await supabase.from("company_subscriptions").upsert(
          {
            company_id: companyId,
            package_id: packageId,
            status: "active",
            amount_usd: Number(amountUsd),
            is_trial: false,
            stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
            stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : null,
            current_period_start: new Date().toISOString(),
            current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            package_mode_enabled: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "company_id" }
        );
      }
      break;
    }
  }

  return res.status(200).json({ received: true });
}
