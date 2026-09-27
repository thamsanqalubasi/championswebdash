import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

// Disable automatic body parsing so Stripe can verify raw body signature
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
      // Development fallback: skip signature verification if webhook secret is not set
      event = JSON.parse(rawBody) as Stripe.Event;
    }
  } catch (err: any) {
    console.error(`⚠️ Webhook signature verification failed:`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Connect to Supabase for database updates
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

  console.log(`📨 Stripe Webhook received: ${event.type}`);

  switch (event.type) {
    // ============================================================
    // Trial Started / Subscription Created
    // Fired when user completes the trial signup flow.
    // Card is saved, NO charge yet. Trial runs for TRIAL_PERIOD_DAYS.
    // ============================================================
    case "customer.subscription.created": {
      const subscription = event.data.object as Stripe.Subscription;
      const companyId = subscription.metadata?.companyId;
      const packageId = subscription.metadata?.packageId || "starter";

      console.log(`🎉 Subscription created for company ${companyId} - package: ${packageId} - trial_end: ${subscription.trial_end}`);

      if (supabase && companyId) {
        const trialEnd = subscription.trial_end
          ? new Date(subscription.trial_end * 1000).toISOString()
          : null;

        await supabase.from("company_subscriptions").upsert(
          {
            company_id: companyId,
            package_id: packageId,
            status: subscription.status === "trialing" ? "trial" : "active",
            is_trial: subscription.status === "trialing",
            trial_ends_at: trialEnd,
            stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : null,
            stripe_subscription_id: subscription.id,
            stripe_price_id: subscription.items?.data?.[0]?.price?.id || null,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            package_mode_enabled: true,
            is_setup_intent_only: false,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "company_id" }
        );
      }
      break;
    }

    // ============================================================
    // Trial Ending Soon (3 days before charge)
    // TODO (future admin dashboard agent): Send email reminder to company admin
    //   "Your trial ends in 3 days. You will be charged $X on [date]."
    // ============================================================
    case "customer.subscription.trial_will_end": {
      const subscription = event.data.object as Stripe.Subscription;
      const companyId = subscription.metadata?.companyId;
      console.log(`⚠️ Trial ending soon for company ${companyId}. Trial ends: ${subscription.trial_end}`);
      // TODO: Send "trial ending soon" email via Supabase/Resend
      break;
    }

    // ============================================================
    // Monthly Payment Succeeded (after trial, and each month after)
    // Extends the subscription for another month.
    // ============================================================
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscription_id = typeof invoice.subscription === "string" ? invoice.subscription : null;

      if (!subscription_id) break;

      const subscription = await stripe.subscriptions.retrieve(subscription_id);
      const companyId = subscription.metadata?.companyId;
      const packageId = subscription.metadata?.packageId || "starter";
      const amountUsd = invoice.amount_paid / 100;

      console.log(`✅ Monthly payment succeeded for company ${companyId} - $${amountUsd} - pkg: ${packageId}`);

      if (supabase && companyId) {
        // Update subscription to active + extend period
        await supabase.from("company_subscriptions").upsert(
          {
            company_id: companyId,
            package_id: packageId,
            status: "active",
            is_trial: false,
            amount_usd: amountUsd,
            stripe_customer_id: typeof subscription.customer === "string" ? subscription.customer : null,
            stripe_subscription_id: subscription.id,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            package_mode_enabled: true,
            cancelled_at: null, // Clear any previous cancellation
            updated_at: new Date().toISOString(),
          },
          { onConflict: "company_id" }
        );

        // Log financial transaction
        await supabase.from("payment_transactions").insert({
          company_id: companyId,
          package_id: packageId,
          amount_usd: amountUsd,
          currency: invoice.currency || "usd",
          status: "succeeded",
          provider: "stripe_subscription",
          provider_tx_id: invoice.id,
          metadata: { subscription_id, invoice_url: invoice.hosted_invoice_url },
        });
      }
      break;
    }

    // ============================================================
    // Monthly Payment Failed (card declined, expired, etc.)
    // Start the 5-day grace period. Retry logic is handled by Stripe.
    // If all retries fail, Stripe fires customer.subscription.deleted.
    // ============================================================
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const subscription_id = typeof invoice.subscription === "string" ? invoice.subscription : null;

      if (!subscription_id) break;

      const subscription = await stripe.subscriptions.retrieve(subscription_id);
      const companyId = subscription.metadata?.companyId;

      console.log(`❌ Payment failed for company ${companyId} - invoice: ${invoice.id}`);

      if (supabase && companyId) {
        await supabase.from("company_subscriptions").upsert(
          {
            company_id: companyId,
            status: "past_due",
            grace_period_started_at: new Date().toISOString(),
            payment_failure_reason: invoice.last_finalization_error?.message || "Card declined or payment failed.",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "company_id" }
        );
      }
      // TODO (future admin dashboard agent): Send "payment failed" email to company admin
      break;
    }

    // ============================================================
    // Subscription Cancelled or Deleted
    // Fired when: user cancels, payment retries exhausted, or admin cancels.
    // Features should be locked. 60-day window before account freeze.
    // ============================================================
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const companyId = subscription.metadata?.companyId;

      console.log(`🚫 Subscription cancelled for company ${companyId}`);

      if (supabase && companyId) {
        await supabase.from("company_subscriptions").upsert(
          {
            company_id: companyId,
            status: "cancelled",
            is_trial: false,
            cancelled_at: new Date().toISOString(),
            cancel_reason: subscription.cancellation_details?.reason || "user_cancelled",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "company_id" }
        );
      }
      // TODO (future admin dashboard agent):
      //   1. Send cancellation confirmation email to company admin
      //   2. After 60 days of status="cancelled", freeze account (can't login)
      //   3. Flag company for permanent deletion in admin dashboard
      //   4. If admin doesn't manually delete after 90 days → auto-delete cron fires
      break;
    }

    // ============================================================
    // Subscription Updated (plan change, upgrade, downgrade)
    // ============================================================
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const companyId = subscription.metadata?.companyId;
      const packageId = subscription.metadata?.packageId || "starter";

      console.log(`🔄 Subscription updated for company ${companyId} - status: ${subscription.status}`);

      if (supabase && companyId) {
        await supabase.from("company_subscriptions").upsert(
          {
            company_id: companyId,
            package_id: packageId,
            status: subscription.status === "trialing" ? "trial" : subscription.status === "active" ? "active" : subscription.status,
            is_trial: subscription.status === "trialing",
            stripe_subscription_id: subscription.id,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "company_id" }
        );
      }
      break;
    }

    // ============================================================
    // SetupIntent Succeeded - Card saved for future billing
    // Fired after user completes the trial card capture form.
    // We know the card is saved; we can now create the subscription.
    // ============================================================
    case "setup_intent.succeeded": {
      const setupIntent = event.data.object as Stripe.SetupIntent;
      const companyId = setupIntent.metadata?.companyId;
      const packageId = setupIntent.metadata?.packageId || "starter";

      console.log(`💳 Card saved successfully for company ${companyId} via SetupIntent`);

      if (supabase && companyId) {
        await supabase.from("company_subscriptions").upsert(
          {
            company_id: companyId,
            package_id: packageId,
            status: "trial",
            is_trial: true,
            is_setup_intent_only: true, // Card saved, subscription not yet created
            stripe_customer_id: typeof setupIntent.customer === "string" ? setupIntent.customer : null,
            package_mode_enabled: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "company_id" }
        );
      }
      break;
    }

    // ============================================================
    // One-off Payment Succeeded (legacy test package / $0.50 sandbox)
    // ============================================================
    case "payment_intent.succeeded": {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const companyId = paymentIntent.metadata?.companyId;
      const packageId = paymentIntent.metadata?.packageId || "test";
      const amountUsd = (paymentIntent.amount / 100).toFixed(2);

      console.log(`✅ One-off payment succeeded for company ${companyId} - $${amountUsd}`);

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
          provider: "stripe_one_off",
          provider_tx_id: paymentIntent.id,
          metadata: paymentIntent.metadata,
        });
      }
      break;
    }

    // ============================================================
    // Checkout Session Completed (hosted Stripe checkout)
    // ============================================================
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const companyId = session.metadata?.companyId;
      const packageId = session.metadata?.packageId || "standard";
      const amountUsd = session.amount_total ? (session.amount_total / 100).toFixed(2) : "0.00";

      console.log(`✅ Checkout session completed for company ${companyId} - mode: ${session.mode}`);

      if (supabase && companyId) {
        await supabase.from("company_subscriptions").upsert(
          {
            company_id: companyId,
            package_id: packageId,
            status: session.mode === "subscription" ? "trial" : "active", // If subscription with trial, starts in trial
            amount_usd: Number(amountUsd),
            is_trial: session.mode === "subscription",
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

    default:
      console.log(`ℹ️ Unhandled Stripe event type: ${event.type}`);
  }

  return res.status(200).json({ received: true });
}
