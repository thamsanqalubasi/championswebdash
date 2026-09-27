import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";

// ============================================================
// TRIAL PERIOD CONFIGURATION
// ============================================================
// CHANGE THIS VALUE to adjust the free trial length for ALL new subscriptions.
// This value is used both here (Stripe trial_period_days) and mirrors
// the TRIAL_PERIOD_DAYS constant in web/src/lib/packages.ts.
//
// Future agents and admins: you can also expose this via a backend admin UI
// so non-technical staff can adjust trial periods without a code deploy.
// Examples:
//   7   = 1 week trial
//   30  = 1 month trial  (recommended for soft launch)
//   90  = 3 months trial (current marketing offer: "3 months free!")
//   120 = 4 months trial
// ============================================================
const TRIAL_PERIOD_DAYS = 90; // 3-month free trial - card saved now, first charge on day 91

// Map of package IDs to Stripe recurring Price IDs.
// ============================================================
// ACTION REQUIRED: Create recurring prices in your Stripe Dashboard:
//   Stripe Dashboard → Products → Create Product per tier → Add a Recurring Monthly Price
//   Copy the price_xxx IDs and add them to Vercel Environment Variables:
//     STRIPE_PRICE_STARTER    = price_xxxxxxxxxxxxx
//     STRIPE_PRICE_STANDARD   = price_xxxxxxxxxxxxx
//     STRIPE_PRICE_PRO        = price_xxxxxxxxxxxxx
//     STRIPE_PRICE_ENTERPRISE = price_xxxxxxxxxxxxx
// ============================================================
function getStripePriceId(packageId: string): string | null {
  const priceMap: Record<string, string | undefined> = {
    starter:    process.env.STRIPE_PRICE_STARTER,
    standard:   process.env.STRIPE_PRICE_STANDARD,
    pro:        process.env.STRIPE_PRICE_PRO,
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
    test:       process.env.STRIPE_PRICE_TEST, // Optional sandbox price
  };
  return priceMap[packageId] || null;
}

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
      error:
        "Stripe Secret Key is not configured on Vercel. Please set STRIPE_SECRET_KEY in your Vercel Project Settings > Environment Variables.",
    });
  }

  try {
    const stripe = new Stripe(secretKey, {
      apiVersion: "2023-10-16",
    });

    const {
      companyId,
      packageId = "test",
      amountUsd = 0.5,
      mode = "payment_intent",
      returnUrl,
      customerEmail,
      customerId: existingCustomerId,
    } = req.body ?? {};

    if (!companyId) {
      return res.status(400).json({ error: "Missing required parameter: companyId" });
    }

    const amountInCents = Math.max(50, Math.round(Number(amountUsd) * 100));

    // ============================================================
    // Mode: setup_intent
    // Saves the customer's card WITHOUT charging anything.
    // Used for the "3-month free trial" flow:
    //   1. User selects a plan
    //   2. Frontend calls this with mode="setup_intent"
    //   3. Stripe saves the card securely (creates a Customer + SetupIntent)
    //   4. When trial ends, the backend creates a subscription using the saved payment method
    //   5. First real charge happens on day TRIAL_PERIOD_DAYS + 1
    // ============================================================
    if (mode === "setup_intent") {
      // Create or reuse a Stripe Customer object
      let stripeCustomerId = existingCustomerId as string | undefined;

      if (!stripeCustomerId && customerEmail) {
        // Check if customer already exists by email to avoid duplicates
        const existingList = await stripe.customers.list({ email: customerEmail, limit: 1 });
        if (existingList.data.length > 0) {
          stripeCustomerId = existingList.data[0].id;
        } else {
          const newCustomer = await stripe.customers.create({
            email: customerEmail,
            metadata: { companyId, packageId, system: "paimbabook" },
          });
          stripeCustomerId = newCustomer.id;
        }
      }

      if (!stripeCustomerId) {
        // Create anonymous customer if no email provided
        const anonCustomer = await stripe.customers.create({
          metadata: { companyId, packageId, system: "paimbabook" },
        });
        stripeCustomerId = anonCustomer.id;
      }

      // Create SetupIntent - no charge, just saves the card
      const setupIntent = await stripe.setupIntents.create({
        customer: stripeCustomerId,
        // off_session = card can be charged later without user present (for auto-renewal)
        usage: "off_session",
        metadata: {
          companyId,
          packageId,
          system: "paimbabook",
          trialPeriodDays: String(TRIAL_PERIOD_DAYS),
        },
      });

      return res.status(200).json({
        clientSecret: setupIntent.client_secret,
        setupIntentId: setupIntent.id,
        stripeCustomerId,
        trialPeriodDays: TRIAL_PERIOD_DAYS,
        packageId,
        mode: "setup_intent",
      });
    }

    // ============================================================
    // Mode: subscription
    // Creates a full Stripe Subscription with recurring billing.
    // Requires Stripe Price IDs in Vercel env vars (STRIPE_PRICE_xxx).
    // Uses the saved payment method from setup_intent if available.
    // ============================================================
    if (mode === "subscription") {
      const priceId = getStripePriceId(packageId);

      if (!priceId) {
        return res.status(400).json({
          error: `No Stripe Price ID configured for package "${packageId}". Set STRIPE_PRICE_${packageId.toUpperCase()} in Vercel Environment Variables.`,
        });
      }

      let stripeCustomerId = existingCustomerId as string | undefined;
      if (!stripeCustomerId && customerEmail) {
        const existingList = await stripe.customers.list({ email: customerEmail, limit: 1 });
        stripeCustomerId = existingList.data.length > 0 ? existingList.data[0].id : undefined;
      }

      if (!stripeCustomerId) {
        return res.status(400).json({
          error: "Missing stripeCustomerId or customerEmail. Cannot create subscription without a Stripe Customer.",
        });
      }

      // Attach the payment method to customer
      const customer = await stripe.customers.retrieve(stripeCustomerId) as Stripe.Customer;
      const paymentMethods = await stripe.paymentMethods.list({ customer: stripeCustomerId, type: "card" });

      const subscription = await stripe.subscriptions.create({
        customer: stripeCustomerId,
        items: [{ price: priceId }],
        // TRIAL PERIOD: No charge for TRIAL_PERIOD_DAYS days
        trial_period_days: TRIAL_PERIOD_DAYS,
        // After trial, auto-charge the saved payment method
        default_payment_method: paymentMethods.data[0]?.id || undefined,
        payment_behavior: "default_incomplete",
        expand: ["latest_invoice.payment_intent"],
        metadata: {
          companyId,
          packageId,
          system: "paimbabook",
        },
        // When trial ends and payment fails, Stripe will retry
        payment_settings: {
          save_default_payment_method: "on_subscription",
        },
      });

      return res.status(200).json({
        subscriptionId: subscription.id,
        stripeCustomerId,
        status: subscription.status,
        trialEnd: subscription.trial_end,
        packageId,
        mode: "subscription",
      });
    }

    // ============================================================
    // Mode: subscription_checkout
    // Stripe-hosted checkout with built-in trial + recurring billing.
    // The cleanest UX - Stripe handles card UI, 3DS, Apple/Google Pay.
    // After trial, Stripe auto-charges monthly.
    // ============================================================
    if (mode === "subscription_checkout") {
      const priceId = getStripePriceId(packageId);
      const host = (req.headers["x-forwarded-host"] as string) || req.headers.host || "localhost:5173";
      const proto = (req.headers["x-forwarded-proto"] as string) || (host.includes("localhost") ? "http" : "https");
      const origin = returnUrl || `${proto}://${host}`;

      if (!priceId) {
        // Fallback: use price_data (dynamic pricing) if no Price ID configured
        const session = await stripe.checkout.sessions.create({
          payment_method_types: ["card"],
          mode: "subscription",
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: `PaimbaBook - ${packageId.charAt(0).toUpperCase() + packageId.slice(1)} Package`,
                  description: `Monthly subscription (${TRIAL_PERIOD_DAYS}-day free trial - card saved now, first charge after trial)`,
                },
                recurring: { interval: "month" },
                unit_amount: amountInCents,
              },
              quantity: 1,
            },
          ],
          subscription_data: {
            trial_period_days: TRIAL_PERIOD_DAYS,
            metadata: { companyId, packageId, system: "paimbabook" },
          },
          success_url: `${origin}/settings?payment=success&session_id={CHECKOUT_SESSION_ID}&pkg=${packageId}`,
          cancel_url: `${origin}/settings?payment=cancelled`,
          metadata: { companyId, packageId },
          customer_email: customerEmail || undefined,
        });
        return res.status(200).json({ url: session.url, sessionId: session.id, mode: "subscription_checkout" });
      }

      // With configured Price ID (preferred)
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        subscription_data: {
          trial_period_days: TRIAL_PERIOD_DAYS,
          metadata: { companyId, packageId, system: "paimbabook" },
        },
        success_url: `${origin}/settings?payment=success&session_id={CHECKOUT_SESSION_ID}&pkg=${packageId}`,
        cancel_url: `${origin}/settings?payment=cancelled`,
        metadata: { companyId, packageId },
        customer_email: customerEmail || undefined,
      });

      return res.status(200).json({ url: session.url, sessionId: session.id, mode: "subscription_checkout" });
    }

    // ============================================================
    // Mode: payment_intent (legacy one-off payment - still used for the $0.50 test package)
    // ============================================================
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
        mode: "payment_intent",
      });
    }

    // ============================================================
    // Mode: checkout_session (legacy one-time hosted checkout)
    // ============================================================
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
        mode: "checkout_session",
      });
    }

    return res.status(400).json({ error: `Unsupported mode: ${mode}. Use: setup_intent | subscription | subscription_checkout | payment_intent | checkout_session` });
  } catch (err: any) {
    console.error("Vercel Stripe Error:", err);
    return res.status(500).json({
      error: err.message || "Failed to create Stripe payment intent via Vercel.",
    });
  }
}
