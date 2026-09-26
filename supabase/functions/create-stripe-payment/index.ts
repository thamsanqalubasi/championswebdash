// Supabase Edge Function: create-stripe-payment
// Deploy via: supabase functions deploy create-stripe-payment --no-verify-jwt
// Required Secret: STRIPE_SECRET_KEY in Supabase Dashboard -> Edge Functions -> Secrets

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.14.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  // 1. Handle CORS Preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      return new Response(
        JSON.stringify({
          error: "STRIPE_SECRET_KEY is not configured in Supabase Edge Function secrets.",
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2023-10-16",
      httpClient: Stripe.createFetchHttpClient(),
    });

    const { companyId, packageId, amountUsd, mode = "payment_intent", returnUrl } = await req.json();

    if (!companyId || !amountUsd) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: companyId, amountUsd" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const amountInCents = Math.round(Number(amountUsd) * 100);

    // Mode A: Embedded Payment Intent (for card forms in frontend modal)
    if (mode === "payment_intent") {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        metadata: {
          companyId,
          packageId: packageId || "test",
          system: "paimbabook",
        },
      });

      return new Response(
        JSON.stringify({
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          amountUsd,
          packageId,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mode B: Hosted Stripe Checkout Session (redirect url)
    if (mode === "checkout_session") {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `PaimbaBook Subscription - ${packageId?.toUpperCase() || "PLAN"}`,
                description: "Monthly property management subscription plan",
              },
              unit_amount: amountInCents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${returnUrl || "http://localhost:5173"}/settings?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${returnUrl || "http://localhost:5173"}/settings?payment=cancelled`,
        metadata: {
          companyId,
          packageId: packageId || "test",
        },
      });

      return new Response(
        JSON.stringify({
          url: session.url,
          sessionId: session.id,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Unsupported mode: ${mode}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Failed to create Stripe payment." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
