import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * POST /api/send-email
 *
 * Body JSON:
 * - to: string (recipient email)
 * - subject: string
 * - html: string (the full HTML email body)
 * - from?: string (optional sender, default from env)
 *
 * Env vars required:
 * - RESEND_API_KEY
 * - EMAIL_FROM (e.g. "Champions Court <noreply@yourdomain.com>")
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "RESEND_API_KEY not configured" });
  }

  const { to, subject, html, from } = req.body ?? {};

  if (!to || !subject || !html) {
    return res.status(400).json({ error: "Missing required fields: to, subject, html" });
  }

  const sender = from || process.env.EMAIL_FROM || "Champions Court <onboarding@resend.dev>";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender,
        to: [to],
        subject,
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Resend API error:", data);
      return res.status(response.status).json({ error: data?.message || "Failed to send email", details: data });
    }

    return res.status(200).json({ success: true, id: data.id });
  } catch (error) {
    console.error("Email send error:", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
}
