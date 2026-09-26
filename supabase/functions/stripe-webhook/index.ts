// Supabase Edge Function: stripe-webhook
// Deploy via: supabase functions deploy stripe-webhook --no-verify-jwt
// Required Secrets in Supabase:
//   - STRIPE_SECRET_KEY
//   - STRIPE_WEBHOOK_SECRET (obtained from Stripe Dashboard -> Webhooks)
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
const endpointSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response(JSON.stringify({ error: "Missing stripe-signature header" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let event: Stripe.Event;

  try {
    const body = await req.text();
    event = await stripe.webhooks.constructEventAsync(body, signature, endpointSecret);
  } catch (err: any) {
    console.error(`Webhook signature verification failed: ${err.message}`);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Handle relevant events
  switch (event.type) {
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const companyId = paymentIntent.metadata?.companyId;
      const packageId = paymentIntent.metadata?.packageId || "test";
      const amountUsd = (paymentIntent.amount / 100).toFixed(2);

      console.log(`Payment succeeded for company: ${companyId}, amount: $${amountUsd}`);

      if (companyId) {
        // 1. Update or upsert subscription in Supabase
        await supabaseAdmin.from("company_subscriptions").upsert(
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

        // 2. Insert transaction audit log
        await supabaseAdmin.from("payment_transactions").insert({
          company_id: companyId,
          package_id: packageId,
          amount_usd: Number(amountUsd),
          currency: paymentIntent.currency || "usd",
          status: "succeeded",
          provider: "stripe",
          provider_tx_id: paymentIntent.id,
          receipt_url: paymentIntent.charges?.data?.[0]?.receipt_url || null,
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

      if (companyId) {
        await supabaseAdmin.from("company_subscriptions").upsert(
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

        await supabaseAdmin.from("payment_transactions").insert({
          company_id: companyId,
          package_id: packageId,
          amount_usd: Number(amountUsd),
          currency: session.currency || "usd",
          status: "succeeded",
          provider: "stripe",
          provider_tx_id: session.id,
          metadata: session.metadata,
        });
      }
      break;
    }

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
