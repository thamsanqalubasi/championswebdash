import type { VercelRequest, VercelResponse } from "@vercel/node";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed." });

  const secretKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_KEY || "";
  if (!secretKey) return res.status(500).json({ error: "Stripe not configured." });

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

  try {
    const stripe = new Stripe(secretKey, { apiVersion: "2023-10-16" });

    const { companyId, stripeSubscriptionId } = req.body ?? {};

    if (!companyId || !stripeSubscriptionId) {
      return res.status(400).json({ error: "Missing companyId or stripeSubscriptionId." });
    }

    // Cancel the Stripe subscription at end of current billing period
    // (cancel_at_period_end = true means user keeps access until period ends, then cancelled)
    const cancelled = await stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
      cancellation_details: {
        comment: "Cancelled by user via PaimbaBook Settings page.",
      },
    });

    if (supabase) {
      await supabase.from("company_subscriptions").upsert(
        {
          company_id: companyId,
          status: "cancelling", // Active until period ends, then webhook fires customer.subscription.deleted
          cancelled_at: new Date().toISOString(),
          cancel_reason: "user_requested",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id" }
      );
    }

    return res.status(200).json({
      success: true,
      message: "Subscription will be cancelled at end of current billing period.",
      cancelAt: cancelled.cancel_at ? new Date(cancelled.cancel_at * 1000).toISOString() : null,
    });
  } catch (err: any) {
    console.error("Cancel subscription error:", err);
    return res.status(500).json({ error: err.message || "Failed to cancel subscription." });
  }
}
