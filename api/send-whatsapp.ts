import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * POST /api/send-whatsapp
 *
 * Body JSON:
 * - to: string (recipient phone in E.164 format, e.g. "+27612345678")
 * - message: string (body text)
 * - mediaUrl?: string (optional public URL for attachment/media)
 *
 * Env vars required:
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_WHATSAPP_FROM (e.g. "whatsapp:+14155238886")
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM;

  if (!accountSid || !authToken || !fromNumber) {
    return res.status(500).json({ error: "Twilio environment variables not configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM)" });
  }

  const { to, message, mediaUrl } = req.body ?? {};

  if (!to || !message) {
    return res.status(400).json({ error: "Missing required fields: to, message" });
  }

  // Ensure the "to" phone number is in whatsapp: format
  const whatsappTo = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  const whatsappFrom = fromNumber.startsWith("whatsapp:") ? fromNumber : `whatsapp:${fromNumber}`;

  try {
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;

    const body = new URLSearchParams({
      From: whatsappFrom,
      To: whatsappTo,
      Body: message,
    });

    if (typeof mediaUrl === "string" && mediaUrl.trim()) {
      body.append("MediaUrl", mediaUrl.trim());
    }

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Twilio API error:", data);
      return res.status(response.status).json({ error: data?.message || "Failed to send WhatsApp message", details: data });
    }

    return res.status(200).json({ success: true, sid: data.sid, status: data.status });
  } catch (error) {
    console.error("WhatsApp send error:", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
}
