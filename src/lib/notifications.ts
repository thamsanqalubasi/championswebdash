/**
 * Client-side helpers for sending email and WhatsApp messages
 * via Vercel serverless functions (/api/send-email, /api/send-whatsapp).
 *
 * Falls back to mailto: / wa.me links when the server API is unavailable.
 */

import { supabase } from "@/lib/supabase";

/* ------------------------------------------------------------------ */
/*  Beautiful HTML email wrapper                                       */
/* ------------------------------------------------------------------ */

export function wrapDocumentInEmailHtml(opts: {
  recipientName: string;
  subject: string;
  bodyText: string;
  documentHtml: string;
  companyName?: string;
  companyEmail?: string;
}) {
  const { recipientName, subject, bodyText, documentHtml, companyName, companyEmail } = opts;
  const company = companyName || "Champions Court";
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${subject}</title>
<style>
  body { margin: 0; padding: 0; background: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1a1a2e; }
  .email-container { max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
  .email-header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); padding: 32px 28px; text-align: center; }
  .email-header h1 { color: #ffffff; font-size: 22px; margin: 0 0 4px; letter-spacing: 0.5px; }
  .email-header p { color: rgba(255,255,255,0.7); font-size: 13px; margin: 0; }
  .email-body { padding: 28px; }
  .greeting { font-size: 16px; color: #333; margin: 0 0 16px; }
  .body-text { font-size: 14px; line-height: 1.6; color: #555; margin: 0 0 24px; }
  .document-frame { border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; margin: 0 0 24px; }
  .document-frame-header { background: #f8f9fa; border-bottom: 1px solid #e0e0e0; padding: 10px 16px; font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
  .document-frame-content { padding: 0; }
  .document-frame-content > * { margin: 0; }
  .cta-note { font-size: 13px; color: #888; text-align: center; margin: 0 0 8px; }
  .email-footer { background: #f8f9fa; border-top: 1px solid #e8e8e8; padding: 20px 28px; text-align: center; }
  .email-footer p { font-size: 12px; color: #999; margin: 4px 0; }
  .email-footer a { color: #1a1a2e; text-decoration: none; }
</style>
</head>
<body>
<div style="padding: 24px 12px;">
  <div class="email-container">
    <div class="email-header">
      <h1>${company}</h1>
      <p>Property Management</p>
    </div>
    <div class="email-body">
      <p class="greeting">Dear ${recipientName},</p>
      <p class="body-text">${bodyText}</p>
      <div class="document-frame">
        <div class="document-frame-header">📄 Attached Document</div>
        <div class="document-frame-content">
          ${documentHtml}
        </div>
      </div>
      <p class="cta-note">Please review the document above. If you have any questions, don't hesitate to reach out.</p>
    </div>
    <div class="email-footer">
      <p>&copy; ${year} ${company}. All rights reserved.</p>
      ${companyEmail ? `<p><a href="mailto:${companyEmail}">${companyEmail}</a></p>` : ""}
    </div>
  </div>
</div>
</body>
</html>`;
}

/* ------------------------------------------------------------------ */
/*  API callers                                                        */
/* ------------------------------------------------------------------ */

export async function sendEmailViaApi(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType?: string;
  }>;
}): Promise<{ success: boolean; error?: string }> {
  try {
    let configuredMethod = "resend";
    try {
      const { data: deliverySettings } = await supabase
        .from("email_delivery_settings")
        .select("method")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      configuredMethod = String((deliverySettings as { method?: string } | null)?.method ?? "resend").toLowerCase();
    } catch {
      configuredMethod = "resend";
    }

    if (configuredMethod === "mailto") {
      const subject = encodeURIComponent(opts.subject);
      const body = encodeURIComponent("Please find your document in the system preview/download and send manually.");
      window.open(`mailto:${opts.to}?subject=${subject}&body=${body}`, "_blank", "noopener,noreferrer");
      return { success: true };
    }

    const response = await fetch("/api/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...opts, method: configuredMethod }),
    });

    const data = await response.json();

    if (!response.ok) {
      if (response.status === 409 && typeof data?.mailtoUrl === "string" && data.mailtoUrl) {
        window.open(data.mailtoUrl, "_blank", "noopener,noreferrer");
        return { success: true };
      }
      return { success: false, error: data?.error || `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Network error" };
  }
}

export async function sendWhatsAppViaApi(opts: {
  to: string;
  message: string;
  mediaUrl?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch("/api/send-whatsapp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(opts),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data?.error || `HTTP ${response.status}` };
    }

    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Network error" };
  }
}

/* ------------------------------------------------------------------ */
/*  High-level send-with-fallback helpers                              */
/* ------------------------------------------------------------------ */

/**
 * Attempts to send email via API. If the server API fails (e.g. not configured),
 * falls back to opening mailto: link.
 */
export async function sendEmail(opts: {
  to: string;
  recipientName: string;
  subject: string;
  bodyText: string;
  documentHtml: string;
  attachmentFilename?: string;
  companyName?: string;
  companyEmail?: string;
}): Promise<{ sent: boolean; fallback: boolean }> {
  const emailHtml = wrapDocumentInEmailHtml(opts);

  const attachments = opts.attachmentFilename
    ? [{ filename: opts.attachmentFilename, content: opts.documentHtml, contentType: "text/html" }]
    : undefined;

  const result = await sendEmailViaApi({ to: opts.to, subject: opts.subject, html: emailHtml, attachments });

  if (result.success) {
    return { sent: true, fallback: false };
  }

  // Fallback to mailto:
  const subject = encodeURIComponent(opts.subject);
  const body = encodeURIComponent(opts.bodyText);
  window.open(`mailto:${opts.to}?subject=${subject}&body=${body}`, "_blank", "noopener,noreferrer");
  return { sent: false, fallback: true };
}

/**
 * Attempts to send WhatsApp message via Twilio API. If the server API fails,
 * falls back to opening wa.me link.
 */
export async function sendWhatsApp(opts: {
  to: string; // E.164 format phone, e.g. "+27612345678"
  message: string;
  mediaUrl?: string;
}): Promise<{ sent: boolean; fallback: boolean }> {
  const result = await sendWhatsAppViaApi(opts);

  if (result.success) {
    return { sent: true, fallback: false };
  }

  // Fallback to wa.me link
  const phone = opts.to.replace(/^\+/, "");
  const fallbackMessage = opts.mediaUrl
    ? `${opts.message}\n\nDocument: ${opts.mediaUrl}`
    : opts.message;
  window.open(`https://wa.me/${phone}?text=${encodeURIComponent(fallbackMessage)}`, "_blank", "noopener,noreferrer");
  return { sent: false, fallback: true };
}
