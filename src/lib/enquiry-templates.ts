import { sendEmailViaApi } from "@/lib/notifications";

export interface DefaultQuestion {
  id: string;
  category: "viewing" | "lease" | "utilities" | "lodge" | "parking" | "furnishing";
  shortLabel: string;
  question: string;
  defaultResponse: string;
}

export const DEFAULT_ENQUIRY_QUESTIONS: DefaultQuestion[] = [
  {
    id: "viewing-schedule",
    category: "viewing",
    shortLabel: "Schedule a Viewing",
    question: "How do I schedule an in-person or virtual viewing for this property?",
    defaultResponse:
      "Thank you for your interest! Viewings can be scheduled Monday through Saturday between 09:00 and 17:00. Please reply with your preferred date and time, and our leasing agent will confirm your appointment.",
  },
  {
    id: "lease-deposit-docs",
    category: "lease",
    shortLabel: "Lease Terms & Deposit",
    question: "What are the lease duration, deposit requirements, and required application documents?",
    defaultResponse:
      "Standard residential leases are 12 months with a 1-month refundable security deposit. Required application documents include: valid ID or Passport, latest 3 months bank statements, and proof of income/employment. You can upload these directly inside your customer portal.",
  },
  {
    id: "utilities-wifi",
    category: "utilities",
    shortLabel: "Utilities & Wi-Fi",
    question: "Are utilities (water, electricity, Wi-Fi) included in the rental price or nightly rate?",
    defaultResponse:
      "For residential rentals, municipal refuse and building insurance are included, while electricity is managed via prepaid sub-meters. For hotel and lodge bookings, all utilities, water, electricity, and high-speed Wi-Fi are fully inclusive.",
  },
  {
    id: "checkin-policies",
    category: "lodge",
    shortLabel: "Check-in & Lodge Policies",
    question: "What are the check-in/out times, meal plan options, and cancellation policies?",
    defaultResponse:
      "Check-in begins at 14:00 and check-out is by 10:00. Breakfast is served daily from 07:00 to 09:30 for applicable bookings. Free cancellation is permitted up to 48 hours prior to arrival. Early check-in or late check-out is subject to availability upon request.",
  },
  {
    id: "parking-pets",
    category: "parking",
    shortLabel: "Parking & Pet Policy",
    question: "Is secured parking available, and what is the pet accommodation policy for this property?",
    defaultResponse:
      "Secured access-controlled parking is allocated with 1 to 2 covered bays per unit. Small pets are considered subject to written application and landlord approval. Please reply with details regarding your pet breed and size.",
  },
  {
    id: "furnishing-appliances",
    category: "furnishing",
    shortLabel: "Furnishing & Appliances",
    question: "Is this property furnished, semi-furnished, or unfurnished, and what appliances are included?",
    defaultResponse:
      "Units feature built-in bedroom cupboards and a fitted stove/oven. Semi-furnished and furnished units also include living room furniture, bed, refrigerator, and microwave as indicated in the listing specifications.",
  },
];

/**
 * Matches a user's question to a default response or provides a smart standard response.
 */
export function getDefaultResponseForQuestion(
  questionText: string,
  context?: { propertyName?: string; companyName?: string; customerName?: string }
): string {
  const normalized = (questionText || "").toLowerCase().trim();

  for (const item of DEFAULT_ENQUIRY_QUESTIONS) {
    if (
      normalized.includes(item.id) ||
      normalized === item.question.toLowerCase().trim() ||
      normalized.includes(item.shortLabel.toLowerCase())
    ) {
      return item.defaultResponse;
    }
  }

  // Keyword-based fallback matching
  if (normalized.includes("view") || normalized.includes("visit") || normalized.includes("see")) {
    return DEFAULT_ENQUIRY_QUESTIONS[0].defaultResponse;
  }
  if (normalized.includes("deposit") || normalized.includes("lease") || normalized.includes("document")) {
    return DEFAULT_ENQUIRY_QUESTIONS[1].defaultResponse;
  }
  if (normalized.includes("utilit") || normalized.includes("water") || normalized.includes("electric") || normalized.includes("wifi")) {
    return DEFAULT_ENQUIRY_QUESTIONS[2].defaultResponse;
  }
  if (normalized.includes("check-in") || normalized.includes("check in") || normalized.includes("cancel") || normalized.includes("meal")) {
    return DEFAULT_ENQUIRY_QUESTIONS[3].defaultResponse;
  }
  if (normalized.includes("park") || normalized.includes("pet") || normalized.includes("dog") || normalized.includes("cat")) {
    return DEFAULT_ENQUIRY_QUESTIONS[4].defaultResponse;
  }
  if (normalized.includes("furnish") || normalized.includes("appliance") || normalized.includes("fridge")) {
    return DEFAULT_ENQUIRY_QUESTIONS[5].defaultResponse;
  }

  const propText = context?.propertyName ? ` regarding "${context.propertyName}"` : "";
  return `Thank you for reaching out to us${propText}. We have received your enquiry and our property management team has been notified. We will review your request and reply shortly. You can track this ticket and respond directly in your Customer Portal at any time.`;
}

/**
 * Builds HTML email template for sending enquiry updates/responses to customers.
 */
export function wrapEnquiryEmailHtml(opts: {
  customerName: string;
  propertyName?: string;
  enquiryId: string;
  question: string;
  response: string;
  companyName?: string;
  portalUrl?: string;
}): string {
  const {
    customerName,
    propertyName,
    enquiryId,
    question,
    response,
    companyName = "Paimbabook",
    portalUrl = "https://paimbabook.com/portal/login",
  } = opts;

  const shortId = enquiryId ? enquiryId.slice(0, 8).toUpperCase() : "TICKET";
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Enquiry Update - #${shortId}</title>
<style>
  body { margin: 0; padding: 0; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; }
  .wrapper { padding: 32px 16px; }
  .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; }
  .header { background: #0f172a; padding: 32px 24px; text-align: center; color: #ffffff; }
  .header h1 { margin: 0 0 6px; font-size: 20px; font-weight: 800; }
  .header p { margin: 0; font-size: 13px; color: #94a3b8; }
  .badge { display: inline-block; background: #2563eb; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 4px 10px; border-radius: 6px; margin-bottom: 12px; }
  .content { padding: 32px 24px; }
  .section-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em; margin: 0 0 6px; }
  .bubble-question { background: #f1f5f9; border-radius: 12px; padding: 14px 16px; margin: 0 0 20px; font-size: 14px; line-height: 1.5; color: #334155; border-left: 4px solid #94a3b8; }
  .bubble-response { background: #eff6ff; border-radius: 12px; padding: 16px 18px; margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #1e3a8a; border-left: 4px solid #2563eb; }
  .btn-container { text-align: center; margin: 28px 0; }
  .btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; font-size: 14px; font-weight: 700; padding: 14px 30px; border-radius: 10px; box-shadow: 0 4px 12px rgba(37,99,235,0.25); }
  .reopen-banner { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; padding: 12px 16px; font-size: 13px; color: #166534; line-height: 1.5; margin-bottom: 20px; }
  .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; font-size: 12px; color: #94a3b8; text-align: center; }
</style>
</head>
<body>
<div class="wrapper">
  <div class="card">
    <div class="header">
      <span class="badge">Ticket #${shortId}</span>
      <h1>${companyName}</h1>
      <p>Customer Enquiries &amp; Support</p>
    </div>
    <div class="content">
      <p style="margin: 0 0 16px; font-size: 15px; font-weight: 600; color: #0f172a;">
        Dear ${customerName || "Customer"},
      </p>
      <p style="margin: 0 0 20px; font-size: 14px; color: #475569; line-height: 1.5;">
        ${propertyName ? `Thank you for your enquiry regarding <strong>${propertyName}</strong>.` : "Thank you for reaching out to us."} A response has been provided below:
      </p>

      <p class="section-label">Your Enquiry:</p>
      <div class="bubble-question">
        "${question}"
      </div>

      <p class="section-label">Management Response:</p>
      <div class="bubble-response">
        ${response}
      </div>

      <div class="reopen-banner">
        <strong>Automatic Ticket Reopening:</strong> If this ticket is ever closed or resolved, simply posting a new reply in your Customer Portal will automatically re-open it at any time.
      </div>

      <div class="btn-container">
        <a href="${portalUrl}" target="_blank" class="btn">Log In to Customer Portal &amp; Reply &rarr;</a>
      </div>

      <p style="margin: 0; font-size: 12px; color: #64748b; text-align: center; line-height: 1.4;">
        You can also reply directly from your portal dashboard at <a href="${portalUrl}" style="color: #2563eb;">${portalUrl}</a>.
      </p>
    </div>
    <div class="footer">
      &copy; ${year} ${companyName}. All rights reserved.
    </div>
  </div>
</div>
</body>
</html>`;
}

/**
 * Dispatches an automated or staff enquiry response email to the customer.
 */
export async function sendEnquiryResponseEmail(opts: {
  toEmail: string;
  customerName: string;
  propertyName?: string;
  enquiryId: string;
  question: string;
  response: string;
  companyName?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { toEmail, customerName, propertyName, enquiryId, question, response, companyName = "Paimbabook" } = opts;
  if (!toEmail || !toEmail.includes("@")) {
    return { success: false, error: "Invalid recipient email" };
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "https://paimbabook.com";
  const portalUrl = `${origin}/portal/login`;

  const shortId = enquiryId ? enquiryId.slice(0, 8).toUpperCase() : "TICKET";
  const subject = `Re: Your Enquiry on ${propertyName || "Property"} [Ticket #${shortId}] - ${companyName}`;
  const html = wrapEnquiryEmailHtml({
    customerName,
    propertyName,
    enquiryId,
    question,
    response,
    companyName,
    portalUrl,
  });

  return sendEmailViaApi({
    to: toEmail,
    subject,
    html,
  });
}

