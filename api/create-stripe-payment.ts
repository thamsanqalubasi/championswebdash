import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. CORS headers
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS,PATCH,DELETE,POST,PUT");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version"
  );

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  const secretKey =
    process.env.STRIPE_SECRET_KEY ||
    process.env.STRIPE_KEY ||
    process.env.STRIPE_API_KEY;

  if (!secretKey) {
    return res.status(500).json({
      error: "Stripe Secret Key is not configured on Vercel. Please set STRIPE_SECRET_KEY in your Vercel Project Settings > Environment Variables.",
    });
  }

  try {
    const stripe = new Stripe(secretKey, {
      apiVersion: "2023-10-16",
    });

    const { companyId, packageId = "test", amountUsd = 0.50, mode = "payment_intent", returnUrl } = req.body ?? {};

    if (!companyId) {
      return res.status(400).json({ error: "Missing required parameter: companyId" });
    }

    const amountInCents = Math.max(50, Math.round(Number(amountUsd) * 100));

    // Mode A: PaymentIntent for card forms in frontend modal
    if (mode === "payment_intent") {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: "usd",
        automatic_payment_methods: { enabled: true },
        metadata: {
          companyId,
          packageId,
          system: "paimbabook",
        },
      });

      return res.status(200).json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amountUsd,
        packageId,
      });
    }

    // Mode B: Hosted Stripe Checkout Session (redirect URL)
    if (mode === "checkout_session") {
      const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost:5173";
      const proto = (req.headers["x-forwarded-proto"] as string) || (host.includes("localhost") ? "http" : "https");
      const origin = returnUrl || `${proto}://${host}`;

      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `PaimbaBook Subscription - ${packageId.toUpperCase()}`,
                description: "Monthly subscription package ($0.50 USD Stripe Minimum)",
              },
              unit_amount: amountInCents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `${origin}/settings?payment=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/settings?payment=cancelled`,
        metadata: {
          companyId,
          packageId,
        },
      });

      return res.status(200).json({
        url: session.url,
        sessionId: session.id,
      });
    }

    return res.status(400).json({ error: `Unsupported mode: ${mode}` });
  } catch (err: any) {
    console.error("Vercel Stripe Error:", err);
    return res.status(500).json({
      error: err.message || "Failed to create Stripe payment intent via Vercel.",
    });
  }
}
