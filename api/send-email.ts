import type { VercelRequest, VercelResponse } from "@vercel/node";

type EmailAttachment = {
  filename: string;
  content?: string;
  contentBase64?: string;
  contentType?: string;
};

type EmailSettingsRow = {
  method?: string;
  from_name?: string;
  from_email?: string;
  reply_to?: string;
  resend_api_key?: string;
  sendgrid_api_key?: string;
  mailgun_api_key?: string;
  mailgun_domain?: string;
};

async function loadEmailSettingsFromSupabase(): Promise<EmailSettingsRow | null> {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRole) {
    return null;
  }

  const base = supabaseUrl.replace(/\/$/, "");
  const query = `${base}/rest/v1/email_delivery_settings?select=method,from_name,from_email,reply_to,resend_api_key,sendgrid_api_key,mailgun_api_key,mailgun_domain&order=updated_at.desc&limit=1`;

  const response = await fetch(query, {
    headers: {
      apikey: serviceRole,
      Authorization: `Bearer ${serviceRole}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const rows = (await response.json()) as EmailSettingsRow[];
  return rows?.[0] ?? null;
}

function toSender(fromName: string, fromEmail: string, fallback: string) {
  const trimmedEmail = String(fromEmail ?? "").trim();
  const trimmedName = String(fromName ?? "").trim();
  if (trimmedName && trimmedEmail) {
    return `${trimmedName} <${trimmedEmail}>`;
  }
  if (trimmedEmail) {
    return trimmedEmail;
  }
  return fallback;
}

function toResendAttachments(attachments: EmailAttachment[]) {
  return attachments
    .filter((item) => item && typeof item.filename === "string" && (typeof item.contentBase64 === "string" || typeof item.content === "string"))
    .map((item) => ({
      filename: item.filename,
      content: item.contentBase64 || Buffer.from(String(item.content ?? ""), "utf-8").toString("base64"),
      ...(item.contentType ? { content_type: item.contentType } : {}),
    }));
}

function toSendgridAttachments(attachments: EmailAttachment[]) {
  return attachments
    .filter((item) => item && typeof item.filename === "string" && (typeof item.contentBase64 === "string" || typeof item.content === "string"))
    .map((item) => ({
      filename: item.filename,
      content: item.contentBase64 || Buffer.from(String(item.content ?? ""), "utf-8").toString("base64"),
      type: item.contentType || "text/plain",
      disposition: "attachment",
    }));
}

async function sendWithResend(params: {
  apiKey: string;
  sender: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  attachments: EmailAttachment[];
}) {
  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: params.sender,
      to: [params.to],
      subject: params.subject,
      html: params.html,
      ...(params.replyTo ? { reply_to: params.replyTo } : {}),
      ...(params.attachments.length > 0 ? { attachments: toResendAttachments(params.attachments) } : {}),
    }),
  });

  const resendData = await resendResponse.json();
  if (!resendResponse.ok) {
    return { ok: false as const, status: resendResponse.status, error: resendData?.message || "Failed to send via Resend", details: resendData };
  }

  return { ok: true as const, providerId: resendData?.id };
}

async function sendWithSendgrid(params: {
  apiKey: string;
  sender: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  attachments: EmailAttachment[];
}) {
  const sendgridResponse = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: params.to }] }],
      from: (() => {
        const match = params.sender.match(/^(.*)<(.+)>$/);
        if (!match) return { email: params.sender.trim() };
        return { name: match[1].trim().replace(/^"|"$/g, ""), email: match[2].trim() };
      })(),
      subject: params.subject,
      content: [{ type: "text/html", value: params.html }],
      ...(params.replyTo ? { reply_to: { email: params.replyTo } } : {}),
      ...(params.attachments.length > 0 ? { attachments: toSendgridAttachments(params.attachments) } : {}),
    }),
  });

  if (!sendgridResponse.ok) {
    const details = await sendgridResponse.json().catch(() => ({}));
    return { ok: false as const, status: sendgridResponse.status, error: "Failed to send via SendGrid", details };
  }

  return { ok: true as const, providerId: "sendgrid" };
}

async function sendWithMailgun(params: {
  apiKey: string;
  domain: string;
  sender: string;
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  attachments: EmailAttachment[];
}) {
  const form = new FormData();
  form.set("from", params.sender);
  form.set("to", params.to);
  form.set("subject", params.subject);
  form.set("html", params.html);
  if (params.replyTo) {
    form.set("h:Reply-To", params.replyTo);
  }

  params.attachments.forEach((attachment) => {
    const bytes = attachment.contentBase64
      ? Buffer.from(attachment.contentBase64, "base64")
      : Buffer.from(String(attachment.content ?? ""), "utf-8");
    const blob = new Blob([bytes], { type: attachment.contentType || "text/plain" });
    form.append("attachment", blob, attachment.filename);
  });

  const auth = Buffer.from(`api:${params.apiKey}`).toString("base64");
  const url = `https://api.mailgun.net/v3/${params.domain}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
    },
    body: form,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false as const, status: response.status, error: data?.message || "Failed to send via Mailgun", details: data };
  }

  return { ok: true as const, providerId: data?.id || "mailgun" };
}

/**
 * POST /api/send-email
 *
 * Body JSON:
 * - to: string (recipient email)
 * - subject: string
 * - html: string (the full HTML email body)
 * - attachments?: Array<{ filename: string; content: string; contentType?: string }>
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

  const { to, subject, html, attachments, from, method: requestedMethod } = req.body ?? {};

  if (!to || !subject || !html) {
    return res.status(400).json({ error: "Missing required fields: to, subject, html" });
  }

  const settings = await loadEmailSettingsFromSupabase();
  const configuredMethod = String(settings?.method || process.env.EMAIL_PROVIDER || "resend").toLowerCase();
  const method = String(requestedMethod || configuredMethod).toLowerCase();

  const sender = from || toSender(String(settings?.from_name ?? ""), String(settings?.from_email ?? ""), process.env.EMAIL_FROM || "Champions Court <onboarding@resend.dev>");
  const replyTo = String(settings?.reply_to ?? "").trim() || undefined;
  const normalizedAttachments: EmailAttachment[] = Array.isArray(attachments)
    ? (attachments as EmailAttachment[]).filter(
      (item) => item && typeof item.filename === "string" && (typeof item.contentBase64 === "string" || typeof item.content === "string"),
    )
    : [];

  try {
    if (method === "mailto") {
      const mailtoSubject = encodeURIComponent(subject);
      const mailtoBody = encodeURIComponent("This message is configured for mailto mode. Use your local email client to send.");
      return res.status(409).json({
        error: "Email method is set to mailto (manual send).",
        mailtoUrl: `mailto:${to}?subject=${mailtoSubject}&body=${mailtoBody}`,
      });
    }

    if (method === "resend") {
      const resendApiKey = String(settings?.resend_api_key ?? process.env.RESEND_API_KEY ?? "").trim();
      if (!resendApiKey) {
        return res.status(500).json({ error: "RESEND_API_KEY (or email_delivery_settings.resend_api_key) not configured" });
      }

      const resendResult = await sendWithResend({
        apiKey: resendApiKey,
        sender,
        to,
        subject,
        html,
        replyTo,
        attachments: normalizedAttachments,
      });

      if (!resendResult.ok) {
        console.error("Resend API error:", resendResult.details);
        return res.status(resendResult.status).json({ error: resendResult.error, details: resendResult.details });
      }

      return res.status(200).json({ success: true, provider: "resend", id: resendResult.providerId });
    }

    if (method === "sendgrid") {
      const sendgridApiKey = String(settings?.sendgrid_api_key ?? process.env.SENDGRID_API_KEY ?? "").trim();
      if (!sendgridApiKey) {
        return res.status(500).json({ error: "SENDGRID_API_KEY (or email_delivery_settings.sendgrid_api_key) not configured" });
      }

      const sendgridResult = await sendWithSendgrid({
        apiKey: sendgridApiKey,
        sender,
        to,
        subject,
        html,
        replyTo,
        attachments: normalizedAttachments,
      });

      if (!sendgridResult.ok) {
        console.error("SendGrid API error:", sendgridResult.details);
        return res.status(sendgridResult.status).json({ error: sendgridResult.error, details: sendgridResult.details });
      }

      return res.status(200).json({ success: true, provider: "sendgrid", id: sendgridResult.providerId });
    }

    if (method === "mailgun") {
      const mailgunApiKey = String(settings?.mailgun_api_key ?? process.env.MAILGUN_API_KEY ?? "").trim();
      const mailgunDomain = String(settings?.mailgun_domain ?? process.env.MAILGUN_DOMAIN ?? "").trim();
      if (!mailgunApiKey || !mailgunDomain) {
        return res.status(500).json({ error: "MAILGUN_API_KEY/MAILGUN_DOMAIN (or email_delivery_settings values) not configured" });
      }

      const mailgunResult = await sendWithMailgun({
        apiKey: mailgunApiKey,
        domain: mailgunDomain,
        sender,
        to,
        subject,
        html,
        replyTo,
        attachments: normalizedAttachments,
      });

      if (!mailgunResult.ok) {
        console.error("Mailgun API error:", mailgunResult.details);
        return res.status(mailgunResult.status).json({ error: mailgunResult.error, details: mailgunResult.details });
      }

      return res.status(200).json({ success: true, provider: "mailgun", id: mailgunResult.providerId });
    }

    return res.status(400).json({
      error: `Selected email method '${method}' is not yet implemented in server API. Implemented methods: mailto, resend, sendgrid, mailgun.`,
    });
  } catch (error) {
    console.error("Email send error:", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
  }
}
