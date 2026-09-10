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

export function wrapStaffInvitationEmailHtml(opts: {
  recipientName: string;
  companyName: string;
  companyLogo?: string;
  jobTitle: string;
  department: string;
  inviteUrl: string;
  invitedByName: string;
}): string {
  const { recipientName, companyName, companyLogo, jobTitle, department, inviteUrl, invitedByName } = opts;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Staff Account Invitation - ${companyName}</title>
<style>
  body { margin: 0; padding: 0; background: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1e293b; }
  .wrapper { padding: 32px 16px; }
  .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.15); }
  .header { background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 36px 32px; text-align: center; color: #ffffff; }
  .logo { max-height: 48px; margin-bottom: 12px; }
  .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
  .header p { margin: 6px 0 0; font-size: 13px; color: #bfdbfe; font-weight: 500; }
  .content { padding: 32px; }
  .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 14px; }
  .body-text { font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px; }
  .highlight-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin: 0 0 24px; }
  .highlight-row { display: flex; justify-content: space-between; font-size: 13px; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
  .highlight-row:last-child { border-bottom: none; }
  .highlight-label { color: #64748b; font-weight: 500; }
  .highlight-val { color: #0f172a; font-weight: 700; }
  .btn-container { text-align: center; margin: 28px 0; }
  .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 14px rgba(37,99,235,0.35); }
  .btn:hover { background: #1d4ed8; }
  .direct-link { font-size: 12px; color: #64748b; line-height: 1.5; word-break: break-all; margin: 0 0 20px; padding: 12px; background: #f1f5f9; border-radius: 8px; }
  .security-note { font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 24px; }
  .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="card">
    <div class="header">
      ${companyLogo ? `<img src="${companyLogo}" alt="${companyName}" class="logo" />` : ""}
      <h1>${companyName}</h1>
      <p>Staff Portal Access & Onboarding</p>
    </div>
    <div class="content">
      <p class="greeting">Hello ${recipientName},</p>
      <p class="body-text">
        You have been invited by <strong>${invitedByName}</strong> to join <strong>${companyName}</strong> on the property management platform.
      </p>
      <div class="highlight-box">
        <div class="highlight-row">
          <span class="highlight-label">Organization:</span>
          <span class="highlight-val">${companyName}</span>
        </div>
        <div class="highlight-row">
          <span class="highlight-label">Job Title:</span>
          <span class="highlight-val">${jobTitle}</span>
        </div>
        <div class="highlight-row">
          <span class="highlight-label">Department:</span>
          <span class="highlight-val" style="text-transform: capitalize;">${department.replace(/_/g, " ")}</span>
        </div>
      </div>
      <p class="body-text">
        Please click the button below to create your password and log in to your company's dedicated portal:
      </p>
      <div class="btn-container">
        <a href="${inviteUrl}" target="_blank" class="btn">Create Password &amp; Log In &rarr;</a>
      </div>
      <p style="font-size: 12px; color: #64748b; margin-bottom: 6px;">Or paste this link into your browser:</p>
      <div class="direct-link">${inviteUrl}</div>
      <div class="security-note">
        This invitation was dispatched securely. If you did not expect this email, please notify ${invitedByName} or ignore this message.
      </div>
    </div>
    <div class="footer">
      &copy; ${year} ${companyName}. Powered by Enterprise Property Management SaaS.
    </div>
  </div>
</div>
</body>
</html>`;
}

export function wrapStaffPasswordResetEmailHtml(opts: {
  recipientName: string;
  companyName: string;
  companyLogo?: string;
  resetUrl: string;
  requestedByName: string;
  requestedByRole: string;
}): string {
  const { recipientName, companyName, companyLogo, resetUrl, requestedByName, requestedByRole } = opts;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Password Reset - ${companyName}</title>
<style>
  body { margin: 0; padding: 0; background: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1e293b; }
  .wrapper { padding: 32px 16px; }
  .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.15); }
  .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 36px 32px; text-align: center; color: #ffffff; }
  .logo { max-height: 48px; margin-bottom: 12px; }
  .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
  .header p { margin: 6px 0 0; font-size: 13px; color: #94a3b8; font-weight: 500; }
  .content { padding: 32px; }
  .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 14px; }
  .body-text { font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px; }
  .alert-box { background: #fef2f2; border: 1px solid #fee2e2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 14px 16px; margin: 0 0 24px; font-size: 13px; color: #991b1b; }
  .btn-container { text-align: center; margin: 28px 0; }
  .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 14px rgba(37,99,235,0.35); }
  .btn:hover { background: #1d4ed8; }
  .direct-link { font-size: 12px; color: #64748b; line-height: 1.5; word-break: break-all; margin: 0 0 20px; padding: 12px; background: #f1f5f9; border-radius: 8px; }
  .security-note { font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; margin-top: 24px; }
  .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="card">
    <div class="header">
      ${companyLogo ? `<img src="${companyLogo}" alt="${companyName}" class="logo" />` : ""}
      <h1>${companyName}</h1>
      <p>Staff Account Security</p>
    </div>
    <div class="content">
      <p class="greeting">Hello ${recipientName},</p>
      <p class="body-text">
        A password reset was requested for your staff portal account by <strong>${requestedByName}</strong> (${requestedByRole}).
      </p>
      <div class="alert-box">
        If you requested this reset or your manager initiated it for you, you can proceed below to create your new password.
      </div>
      <div class="btn-container">
        <a href="${resetUrl}" target="_blank" class="btn">Reset Staff Password &rarr;</a>
      </div>
      <p style="font-size: 12px; color: #64748b; margin-bottom: 6px;">Or paste this reset link into your browser:</p>
      <div class="direct-link">${resetUrl}</div>
      <div class="security-note">
        If you did not authorize or expect this reset request, please contact your department manager or IT administrator immediately.
      </div>
    </div>
    <div class="footer">
      &copy; ${year} ${companyName}. Enterprise RBAC Security.
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
    content?: string;
    contentBase64?: string;
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
  attachmentContentBase64?: string;
  attachmentContentType?: string;
  companyName?: string;
  companyEmail?: string;
}): Promise<{ sent: boolean; fallback: boolean }> {
  const emailHtml = wrapDocumentInEmailHtml(opts);

  const attachments = opts.attachmentFilename
    ? [{
      filename: opts.attachmentFilename,
      ...(opts.attachmentContentBase64
        ? { contentBase64: opts.attachmentContentBase64 }
        : { content: opts.documentHtml }),
      contentType: opts.attachmentContentType || (opts.attachmentContentBase64 ? "application/pdf" : "text/html"),
    }]
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
