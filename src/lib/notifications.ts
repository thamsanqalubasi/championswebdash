/**
 * Client-side helpers for sending email and WhatsApp messages
 * via Vercel serverless functions (/api/send-email, /api/send-whatsapp).
 *
 * Falls back to mailto: / wa.me links when the server API is unavailable.
 */

import { supabase } from "@/lib/supabase";
import { createPdfAttachmentFromHtml } from "@/lib/storage";

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
  companyLogo?: string;
}) {
  const { recipientName, subject, bodyText, documentHtml, companyName, companyEmail, companyLogo } = opts;
  const company = (!companyName || companyName.toLowerCase().includes("champions"))
    ? "Paimbabook Hospitality & Properties"
    : companyName.trim();
  const logo = (!companyLogo || companyLogo.toLowerCase().includes("champions"))
    ? "https://paimbabook.com/paimbabook-logo.svg"
    : companyLogo;
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
  .email-header img { max-height: 48px; max-width: 220px; object-fit: contain; margin-bottom: 12px; display: inline-block; }
  .email-header h1 { color: #ffffff; font-size: 22px; margin: 0 0 4px; letter-spacing: 0.5px; }
  .email-header p { color: rgba(255,255,255,0.7); font-size: 13px; margin: 0; }
  .email-body { padding: 28px; }
  .greeting { font-size: 16px; color: #333; margin: 0 0 16px; }
  .body-text { font-size: 14px; line-height: 1.6; color: #555; margin: 0 0 24px; }
  .pdf-badge { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px 16px; margin: 0 0 20px; font-size: 13px; color: #166534; }
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
      <div style="text-align: center; margin-bottom: 10px;">
        <img src="${logo}" alt="${company}" />
      </div>
      <h1>${company}</h1>
      <p>Hospitality &amp; Property Management</p>
    </div>
    <div class="email-body">
      <p class="greeting">Dear ${recipientName},</p>
      <p class="body-text">${bodyText}</p>
      <div class="pdf-badge">
        📎 <strong>Official PDF Attached:</strong> A printable PDF document has been generated and attached to this email for your records.
      </div>
      <div class="document-frame">
        <div class="document-frame-header">📄 Document Preview</div>
        <div class="document-frame-content">
          ${documentHtml}
        </div>
      </div>
      <p class="cta-note">Please review the document above and the attached PDF. If you have any questions, don't hesitate to reach out.</p>
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

export function wrapSignupWelcomeEmailHtml(opts: {
  recipientName: string;
  companyName: string;
  companySlug: string;
  adminEmail: string;
  portalLoginUrl: string;
  currency: string;
  country: string;
  companyLogo?: string;
}): string {
  const { recipientName, companyName, companySlug, adminEmail, portalLoginUrl, currency, country, companyLogo } = opts;
  const year = new Date().getFullYear();
  const safeCompany = (!companyName || companyName.toLowerCase().includes("champions"))
    ? "Paimbabook Hospitality & Properties"
    : companyName.trim();
  const logo = (!companyLogo || companyLogo.toLowerCase().includes("champions"))
    ? "https://paimbabook.com/paimbabook-logo.svg"
    : companyLogo;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Welcome to ${safeCompany} - Organization Workspace Provisioned</title>
<style>
  body { margin: 0; padding: 0; background: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1e293b; }
  .wrapper { padding: 32px 16px; }
  .card { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
  .header { background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); padding: 36px 32px; text-align: center; color: #ffffff; }
  .header h1 { margin: 0 0 8px; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
  .header p { margin: 0; font-size: 14px; color: #93c5fd; font-weight: 500; }
  .content { padding: 32px; }
  .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 14px; }
  .body-text { font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px; }
  .highlight-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px 20px; margin: 0 0 24px; }
  .highlight-row { display: flex; justify-content: space-between; font-size: 13px; padding: 8px 0; border-bottom: 1px solid #f1f5f9; }
  .highlight-row:last-child { border-bottom: none; }
  .highlight-label { color: #64748b; font-weight: 500; }
  .highlight-val { color: #0f172a; font-weight: 700; }
  .btn-container { text-align: center; margin: 28px 0; }
  .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 14px rgba(37,99,235,0.35); }
  .direct-link { font-size: 12px; color: #64748b; line-height: 1.5; word-break: break-all; margin: 0 0 20px; padding: 12px; background: #f1f5f9; border-radius: 8px; }
  .guide-title { font-size: 14px; font-weight: 700; color: #0f172a; margin: 24px 0 12px; }
  .guide-steps { margin: 0 0 24px; padding-left: 20px; font-size: 13px; line-height: 1.7; color: #475569; }
  .compliance-note { font-size: 11px; color: #64748b; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 16px; margin-top: 24px; line-height: 1.5; }
  .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="card">
    <div class="header">
      <div style="text-align: center; margin-bottom: 12px;">
        <img src="${logo}" alt="${safeCompany}" style="max-height: 48px; max-width: 220px; object-fit: contain; display: inline-block;" />
      </div>
      <h1>${safeCompany}</h1>
      <p>Dedicated Enterprise Portal Provisioned</p>
    </div>
    <div class="content">
      <p class="greeting">Welcome ${recipientName},</p>
      <p class="body-text">
        Congratulations! Your private organization tenant for <strong>${safeCompany}</strong> has been successfully provisioned and configured on the property management platform.
      </p>

      <div class="highlight-box">
        <div class="highlight-row">
          <span class="highlight-label">Organization:</span>
          <span class="highlight-val">${safeCompany}</span>
        </div>
        <div class="highlight-row">
          <span class="highlight-label">Dedicated Portal URL:</span>
          <span class="highlight-val">/c/${companySlug}</span>
        </div>
        <div class="highlight-row">
          <span class="highlight-label">Super Admin Email:</span>
          <span class="highlight-val">${adminEmail}</span>
        </div>
        <div class="highlight-row">
          <span class="highlight-label">Operating Country:</span>
          <span class="highlight-val">${country}</span>
        </div>
        <div class="highlight-row">
          <span class="highlight-label">Billing Currency:</span>
          <span class="highlight-val">${currency}</span>
        </div>
      </div>

      <div class="btn-container">
        <a href="${portalLoginUrl}" target="_blank" class="btn">Log In to Your Admin Portal &rarr;</a>
      </div>

      <p style="font-size: 12px; color: #64748b; margin-bottom: 6px;">Direct portal access link:</p>
      <div class="direct-link">${portalLoginUrl}</div>

      <div class="guide-title">Recommended Quick-Start Steps:</div>
      <ol class="guide-steps">
        <li><strong>Add Properties &amp; Units:</strong> Record buildings, units, and inventory in the Properties dashboard.</li>
        <li><strong>Lease Contracts:</strong> Generate standardized legal agreements with automatic PDF export and e-signatures.</li>
        <li><strong>Invite Staff &amp; Agents:</strong> Issue role-based invitations for managers, accountants, and field agents.</li>
        <li><strong>Invoicing &amp; Billing:</strong> Set up automated rent cycles with uniform <strong>${currency}</strong> invoicing.</li>
      </ol>

      <div class="compliance-note">
        <strong>Statutory Compliance &amp; Terms Agreement:</strong> By registering this workspace, you have certified that your organization holds all required statutory real estate licenses and legal permits in ${country}, and agrees to the Paimbabook Terms of Service.
      </div>
    </div>
    <div class="footer">
      &copy; ${year} ${safeCompany}. Multi-tenant Property Management SaaS.
    </div>
  </div>
</div>
</body>
</html>`;
}

export function wrapPasswordChangeConfirmationEmailHtml(opts: {
  recipientName: string;
  userEmail: string;
  companyName: string;
  companyLogo?: string;
  portalLoginUrl?: string;
  changeType?: "updated" | "initial_setup" | "reset";
}): string {
  const { recipientName, userEmail, companyName, companyLogo, portalLoginUrl, changeType = "updated" } = opts;
  const safeCompany = (!companyName || companyName.toLowerCase().includes("champions"))
    ? "Paimbabook Hospitality & Properties"
    : companyName.trim();
  const logo = (!companyLogo || companyLogo.toLowerCase().includes("champions"))
    ? "https://paimbabook.com/paimbabook-logo.svg"
    : companyLogo;
  const year = new Date().getFullYear();
  const timestamp = new Date().toUTCString();

  const title =
    changeType === "initial_setup"
      ? "Account Password Established"
      : changeType === "reset"
        ? "Password Reset Successful"
        : "Security Notice: Password Updated";

  const description =
    changeType === "initial_setup"
      ? "Your initial account password has been set up successfully."
      : changeType === "reset"
        ? "Your account password was successfully reset."
        : "Your account password was recently updated.";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title} - ${safeCompany}</title>
<style>
  body { margin: 0; padding: 0; background: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1e293b; }
  .wrapper { padding: 32px 16px; }
  .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.15); }
  .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px; text-align: center; color: #ffffff; }
  .header h1 { margin: 0 0 6px; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
  .header p { margin: 0; font-size: 13px; color: #94a3b8; font-weight: 500; }
  .content { padding: 32px; }
  .greeting { font-size: 16px; font-weight: 700; color: #0f172a; margin: 0 0 14px; }
  .body-text { font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 20px; }
  .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px 20px; margin: 0 0 20px; font-size: 13px; }
  .info-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f5f9; }
  .info-row:last-child { border-bottom: none; }
  .info-label { color: #64748b; font-weight: 500; }
  .info-val { color: #0f172a; font-weight: 700; }
  .notice-box { background: #eff6ff; border: 1px solid #dbeafe; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 14px 16px; margin: 0 0 24px; font-size: 13px; color: #1e40af; line-height: 1.5; }
  .alert-box { background: #fef2f2; border: 1px solid #fee2e2; border-left: 4px solid #ef4444; border-radius: 8px; padding: 14px 16px; margin: 0 0 24px; font-size: 12px; color: #991b1b; line-height: 1.5; }
  .btn-container { text-align: center; margin: 24px 0; }
  .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 8px; box-shadow: 0 4px 12px rgba(37,99,235,0.3); }
  .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="card">
    <div class="header">
      <div style="text-align: center; margin-bottom: 12px;">
        <img src="${logo}" alt="${safeCompany}" style="max-height: 48px; max-width: 220px; object-fit: contain; display: inline-block;" />
      </div>
      <h1>${title}</h1>
      <p>${description}</p>
    </div>
    <div class="content">
      <p class="greeting">Hello ${recipientName},</p>
      <p class="body-text">
        This is an official confirmation that the password for your account on <strong>${safeCompany}</strong> was successfully updated.
      </p>

      <div class="info-box">
        <div class="info-row">
          <span class="info-label">Account:</span>
          <span class="info-val">${userEmail}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Organization:</span>
          <span class="info-val">${safeCompany}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Timestamp:</span>
          <span class="info-val">${timestamp}</span>
        </div>
      </div>

      <div class="notice-box">
        <strong>Authorized change?</strong> If you made this change, no further action is required. You can now use your new credentials to log in.
      </div>

      <div class="alert-box">
        <strong>Did not make this change?</strong> If you did NOT authorize this password update, someone may have compromised your account. Please notify your organization administrator or IT department immediately.
      </div>

      ${portalLoginUrl ? `
      <div class="btn-container">
        <a href="${portalLoginUrl}" target="_blank" class="btn">Log In to Your Portal &rarr;</a>
      </div>
      ` : ""}
    </div>
    <div class="footer">
      &copy; ${year} ${safeCompany}. Account Security Notification.
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
  const safeCompany = (!companyName || companyName.toLowerCase().includes("champions"))
    ? "Paimbabook Hospitality & Properties"
    : companyName.trim();
  const logo = (!companyLogo || companyLogo.toLowerCase().includes("champions"))
    ? "https://paimbabook.com/paimbabook-logo.svg"
    : companyLogo;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Staff Account Invitation - ${safeCompany}</title>
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
      <div style="text-align: center; margin-bottom: 12px;">
        <img src="${logo}" alt="${safeCompany}" style="max-height: 48px; max-width: 220px; object-fit: contain; display: inline-block;" />
      </div>
      <h1>${safeCompany}</h1>
      <p>Staff Portal Access &amp; Onboarding</p>
    </div>
    <div class="content">
      <p class="greeting">Hello ${recipientName},</p>
      <p class="body-text">
        You have been invited by <strong>${invitedByName}</strong> to join <strong>${safeCompany}</strong> on the property management platform.
      </p>
      <div class="highlight-box">
        <div class="highlight-row">
          <span class="highlight-label">Organization:</span>
          <span class="highlight-val">${safeCompany}</span>
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
      &copy; ${year} ${safeCompany}. Powered by Enterprise Property Management SaaS.
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
  const safeCompany = (!companyName || companyName.toLowerCase().includes("champions"))
    ? "Paimbabook Hospitality & Properties"
    : companyName.trim();
  const logo = (!companyLogo || companyLogo.toLowerCase().includes("champions"))
    ? "https://paimbabook.com/paimbabook-logo.svg"
    : companyLogo;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Password Reset - ${safeCompany}</title>
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
      <div style="text-align: center; margin-bottom: 12px;">
        <img src="${logo}" alt="${safeCompany}" style="max-height: 48px; max-width: 220px; object-fit: contain; display: inline-block;" />
      </div>
      <h1>${safeCompany}</h1>
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
      &copy; ${year} ${safeCompany}. Enterprise RBAC Security.
    </div>
  </div>
</div>
</body>
</html>`;
}

export function wrapCustomerWelcomeEmailHtml(opts: {
  customerName: string;
  customerEmail: string;
  portalUrl: string;
  companyLogo?: string;
}): string {
  const { customerName, customerEmail, portalUrl, companyLogo } = opts;
  const logo = (!companyLogo || companyLogo.toLowerCase().includes("champions"))
    ? "https://paimbabook.com/paimbabook-logo.svg"
    : companyLogo;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Welcome to Paimbabook - Your Customer Account is Ready</title>
<style>
  body { margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1e293b; }
  .wrapper { padding: 32px 16px; }
  .card { max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #e2e8f0; }
  .header { background: linear-gradient(135deg, #1d4ed8 0%, #2563eb 100%); padding: 36px 32px; text-align: center; color: #ffffff; }
  .header h1 { margin: 0 0 8px; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; }
  .header p { margin: 0; font-size: 14px; color: #bfdbfe; font-weight: 500; }
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
  .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="card">
    <div class="header">
      <div style="text-align: center; margin-bottom: 12px;">
        <img src="${logo}" alt="Paimbabook" style="max-height: 48px; max-width: 220px; object-fit: contain; display: inline-block;" />
      </div>
      <h1>Paimbabook</h1>
      <p>Guest &amp; Tenant Customer Portal</p>
    </div>
    <div class="content">
      <p class="greeting">Welcome, ${customerName}!</p>
      <p class="body-text">
        Thank you for joining Paimbabook. Your customer account is active. You can now browse verified rental properties, book safari lodges &amp; hotel rooms, manage your bookings, and track maintenance and lease enquiries directly online.
      </p>

      <div class="highlight-box">
        <div class="highlight-row">
          <span class="highlight-label">Account Name:</span>
          <span class="highlight-val">${customerName}</span>
        </div>
        <div class="highlight-row">
          <span class="highlight-label">Login Email:</span>
          <span class="highlight-val">${customerEmail}</span>
        </div>
        <div class="highlight-row">
          <span class="highlight-label">Portal:</span>
          <span class="highlight-val">paimbabook.com</span>
        </div>
      </div>

      <div class="btn-container">
        <a href="${portalUrl}" target="_blank" class="btn">Explore Listings &amp; Bookings &rarr;</a>
      </div>
    </div>
    <div class="footer">
      &copy; ${year} Paimbabook. All rights reserved.
    </div>
  </div>
</div>
</body>
</html>`;
}

export function wrapTenantInvitationEmailHtml(opts: {
  recipientName: string;
  companyName: string;
  propertyName: string;
  inviteUrl: string;
  companyLogo?: string;
}): string {
  const { recipientName, companyName, propertyName, inviteUrl, companyLogo } = opts;
  const safeCompany = (!companyName || companyName.toLowerCase().includes("champions"))
    ? "Paimbabook Hospitality & Properties"
    : companyName.trim();
  const logo = (!companyLogo || companyLogo.toLowerCase().includes("champions"))
    ? "https://paimbabook.com/paimbabook-logo.svg"
    : companyLogo;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Tenant Account Invitation - ${propertyName}</title>
<style>
  body { margin: 0; padding: 0; background: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1e293b; }
  .wrapper { padding: 32px 16px; }
  .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 12px 36px rgba(0,0,0,0.18); }
  .header { background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); padding: 36px 32px; text-align: center; color: #ffffff; }
  .logo { max-height: 46px; margin-bottom: 12px; }
  .header h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
  .header p { margin: 6px 0 0; font-size: 13px; color: #93c5fd; }
  .content { padding: 32px; }
  .greeting { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 12px; }
  .body-text { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 20px; }
  .highlight-box { background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 18px 20px; margin: 0 0 24px; }
  .highlight-row { display: flex; justify-content: space-between; font-size: 13px; padding: 7px 0; border-bottom: 1px solid #f1f5f9; }
  .highlight-row:last-child { border-bottom: none; }
  .highlight-label { color: #64748b; font-weight: 500; }
  .highlight-val { color: #0f172a; font-weight: 700; text-align: right; }
  .feature-list { margin: 0 0 24px; padding: 0; list-style: none; }
  .feature-item { font-size: 13px; color: #334155; padding: 6px 0; display: flex; align-items: center; gap: 8px; }
  .btn-container { text-align: center; margin: 28px 0 16px; }
  .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 34px; border-radius: 12px; box-shadow: 0 6px 18px rgba(37,99,235,0.35); }
  .direct-link { font-size: 11px; color: #64748b; word-break: break-all; padding: 10px; background: #f1f5f9; border-radius: 8px; margin-top: 10px; }
  .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="card">
    <div class="header">
      <div style="text-align: center; margin-bottom: 10px;">
        <img src="${logo}" alt="${safeCompany}" style="max-height: 46px; max-width: 220px; object-fit: contain; display: inline-block;" />
      </div>
      <h1>Welcome to Your Tenant Portal</h1>
      <p>${safeCompany} &bull; Property Management</p>
    </div>
    <div class="content">
      <p class="greeting">Hello ${recipientName},</p>
      <p class="body-text">
        You have been registered as an assigned tenant for <strong>${propertyName}</strong> managed by <strong>${safeCompany}</strong>.
      </p>
      <div class="highlight-box">
        <div class="highlight-row">
          <span class="highlight-label">Assigned Property:</span>
          <span class="highlight-val">${propertyName}</span>
        </div>
        <div class="highlight-row">
          <span class="highlight-label">Managing Organization:</span>
          <span class="highlight-val">${safeCompany}</span>
        </div>
        <div class="highlight-row">
          <span class="highlight-label">Portal:</span>
          <span class="highlight-val">paimbabook.com</span>
        </div>
      </div>
      <p class="body-text" style="margin-bottom: 8px; font-weight: 600; color: #0f172a;">
        Create your free tenant account to access all resident benefits:
      </p>
      <ul class="feature-list">
        <li class="feature-item">📄 <strong>Lease Agreements &amp; Contracts:</strong> Access, review, and download your contracts anytime.</li>
        <li class="feature-item">🧾 <strong>Digital Rent Invoices:</strong> View monthly invoices and itemized billing statements.</li>
        <li class="feature-item">💳 <strong>Submit Proof of Payment (POP):</strong> Upload bank slips or payment receipts directly for instant ledger reconciliation.</li>
        <li class="feature-item">🔧 <strong>Maintenance Requests:</strong> Report plumbing, electrical, or structural repairs with photo attachments.</li>
        <li class="feature-item">💬 <strong>Direct Property Chat:</strong> Message your property manager and maintenance staff directly.</li>
      </ul>
      <div class="btn-container">
        <a href="${inviteUrl}" target="_blank" class="btn">Create Your Tenant Account &rarr;</a>
      </div>
      <p style="font-size: 11px; color: #94a3b8; text-align: center; margin-top: 14px;">Or copy and paste this onboarding link into your browser:</p>
      <div class="direct-link">${inviteUrl}</div>
    </div>
    <div class="footer">
      &copy; ${year} ${safeCompany}. Powered by Paimbabook Tenant Services.
    </div>
  </div>
</div>
</body>
</html>`;
}

export function wrapStaffDeregistrationNoticeEmailHtml(opts: {
  recipientName: string;
  staffCompanyName: string;
  tenantCompanyName: string;
  propertyName: string;
  inviteUrl: string;
  staffEmail: string;
  companyLogo?: string;
}): string {
  const { recipientName, staffCompanyName, tenantCompanyName, propertyName, inviteUrl, staffEmail, companyLogo } = opts;
  const safeCompany = (!tenantCompanyName || tenantCompanyName.toLowerCase().includes("champions"))
    ? "Paimbabook Hospitality & Properties"
    : tenantCompanyName.trim();
  const logo = (!companyLogo || companyLogo.toLowerCase().includes("champions"))
    ? "https://paimbabook.com/paimbabook-logo.svg"
    : companyLogo;
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Important Notice: Tenant Registration &amp; Account Status</title>
<style>
  body { margin: 0; padding: 0; background: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1e293b; }
  .wrapper { padding: 32px 16px; }
  .card { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 14px 40px rgba(0,0,0,0.2); }
  .header { background: linear-gradient(135deg, #7c2d12 0%, #b45309 100%); padding: 34px 32px; text-align: center; color: #ffffff; }
  .logo { max-height: 46px; margin-bottom: 12px; }
  .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
  .header p { margin: 6px 0 0; font-size: 13px; color: #fde68a; }
  .content { padding: 32px; }
  .greeting { font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 12px; }
  .body-text { font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 18px; }
  .alert-banner { background: #fffbeb; border: 1.5px solid #fef3c7; border-left: 5px solid #d97706; border-radius: 12px; padding: 16px 20px; margin: 0 0 22px; }
  .alert-title { font-size: 14px; font-weight: 700; color: #92400e; margin: 0 0 6px; }
  .alert-body { font-size: 13px; color: #78350f; line-height: 1.5; margin: 0; }
  .options-box { background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 20px; margin: 0 0 24px; }
  .option-card { margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px solid #e2e8f0; }
  .option-card:last-child { margin-bottom: 0; padding-bottom: 0; border-bottom: none; }
  .option-num { font-size: 12px; font-weight: 800; text-transform: uppercase; color: #2563eb; }
  .option-title { font-size: 14px; font-weight: 700; color: #0f172a; margin: 2px 0 4px; }
  .option-desc { font-size: 13px; color: #475569; line-height: 1.5; margin: 0; }
  .reassurance-box { background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 12px; padding: 14px 18px; margin: 0 0 24px; font-size: 13px; color: #166534; line-height: 1.5; }
  .btn-container { text-align: center; margin: 24px 0 12px; }
  .btn { display: inline-block; background: #b45309; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 13px 30px; border-radius: 10px; }
  .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="card">
    <div class="header">
      <div style="text-align: center; margin-bottom: 10px;">
        <img src="${logo}" alt="${safeCompany}" style="max-height: 46px; max-width: 220px; object-fit: contain; display: inline-block;" />
      </div>
      <h1>Tenant Registration &amp; Account Advisory</h1>
      <p>${propertyName} &bull; ${safeCompany}</p>
    </div>
    <div class="content">
      <p class="greeting">Dear ${recipientName},</p>
      <p class="body-text">
        You are registered as a tenant for <strong>${propertyName}</strong> under <strong>${safeCompany}</strong>.
      </p>

      <div class="alert-banner">
        <p class="alert-title">⚠️ Existing Staff Account Detected</p>
        <p class="alert-body">
          Our system detected that your email address (<strong>${staffEmail}</strong>) is currently registered as a staff or administrator profile for <strong>${staffCompanyName}</strong>.
        </p>
      </div>

      <p class="body-text">
        Because administrative staff accounts have elevated company permissions, a user profile cannot simultaneously operate as an internal staff member for one organization and an external tenant for another. To activate your tenant portal features for <strong>${propertyName}</strong>, please choose one of the following options:
      </p>

      <div class="options-box">
        <div class="option-card">
          <span class="option-num">Option 1 (Recommended)</span>
          <p class="option-title">Register with an Alternative Personal Email</p>
          <p class="option-desc">
            Create a tenant account using your personal email address, and notify your property manager at <strong>${safeCompany}</strong> so they can update your tenancy contact records.
          </p>
        </div>
        <div class="option-card">
          <span class="option-num">Option 2</span>
          <p class="option-title">De-register from ${staffCompanyName}</p>
          <p class="option-desc">
            If you are no longer employed with or managing <strong>${staffCompanyName}</strong>, ask their administrator to remove your staff profile, after which you can register as a tenant using this email.
          </p>
        </div>
      </div>

      <div class="reassurance-box">
        ✅ <strong>Your Invoices &amp; Contracts are Secure:</strong> Even while registered under another organization, all your official lease contracts, monthly invoices, and payment receipts will continue to be sent directly to <strong>${staffEmail}</strong> as downloadable PDF attachments.
      </div>

      <div class="btn-container">
        <a href="${inviteUrl}" target="_blank" class="btn">View Registration Portal &rarr;</a>
      </div>
    </div>
    <div class="footer">
      &copy; ${year} ${safeCompany}. Account Security Advisory.
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
  companyLogo?: string;
}): Promise<{ sent: boolean; fallback: boolean }> {
  const emailHtml = wrapDocumentInEmailHtml(opts);

  let filename = opts.attachmentFilename || "document.pdf";
  if (!filename.toLowerCase().endsWith(".pdf")) {
    filename = `${filename}.pdf`;
  }

  let base64Content = opts.attachmentContentBase64;
  if (!base64Content && opts.documentHtml) {
    try {
      const pdfAttachment = await createPdfAttachmentFromHtml(opts.documentHtml, filename);
      base64Content = pdfAttachment.contentBase64;
    } catch (e) {
      console.warn("Could not compile PDF attachment from documentHtml", e);
    }
  }

  const attachments = base64Content
    ? [{
      filename,
      contentBase64: base64Content,
      contentType: "application/pdf",
    }]
    : opts.attachmentFilename
      ? [{
        filename,
        content: opts.documentHtml,
        contentType: opts.attachmentContentType || "application/pdf",
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

export async function sendCustomHtmlEmail(opts: {
  to: string;
  subject: string;
  html: string;
  bodyFallback?: string;
}): Promise<{ sent: boolean; fallback: boolean }> {
  const result = await sendEmailViaApi({
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });

  if (result.success) {
    return { sent: true, fallback: false };
  }

  // Fallback to mailto:
  const subject = encodeURIComponent(opts.subject);
  const body = encodeURIComponent(opts.bodyFallback || "Please check your notification.");
  window.open(`mailto:${opts.to}?subject=${subject}&body=${body}`, "_blank", "noopener,noreferrer");
  return { sent: false, fallback: true };
}

