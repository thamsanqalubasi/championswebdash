/**
 * Professional document HTML templates for invoices and contracts.
 * These produce well-designed, printable HTML documents with company branding and admin signature.
 */

import { formatCurrencyValue } from "@/lib/currency";

/* ---------- shared helpers ---------- */

function esc(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function sanitizeRichTextHtml(raw: string) {
  const withoutScripts = raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+=("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");

  return withoutScripts;
}

function formatSectionContent(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return "";

  const hasHtml = /<[^>]+>/.test(trimmed);
  if (!hasHtml) {
    return `<p>${esc(trimmed).replace(/\n/g, "<br/>")}</p>`;
  }

  return sanitizeRichTextHtml(trimmed);
}

function formatDocCurrency(amount: number, currency: string = "ZAR") {
  return formatCurrencyValue(amount, currency || "ZAR", 2);
}

function formatNAD(amount: number, currency: string = "ZAR") {
  return formatDocCurrency(amount, currency);
}

function fmtDate(value: string) {
  if (!value || value === "-") return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" });
}

export function resolveDocCompanyName(companyName?: string | null): string {
  const trimmed = String(companyName ?? "").trim();
  return trimmed || "Company Name";
}

export function resolveDocLogoUrl(logoUrl?: string | null): string {
  const trimmed = String(logoUrl ?? "").trim();
  return trimmed;
}

/* ---------- types ---------- */

export type CompanyInfo = {
  companyName: string;
  logoUrl: string;
  address: string;
  taxRate: number;
  paymentInstructions: string;
  currency?: string;
  email?: string;
  phone?: string;
};

export type AdminInfo = {
  fullName: string;
  signatureUrl: string;
};

export type InvoiceDocData = {
  invoiceId: string;
  tenantName: string;
  propertyName: string;
  month: string;
  dueDate: string;
  status: string;
  lineItems: { description: string; amount: number }[];
};

export type ContractSection = {
  title: string;
  content: string;
};

export type ContractDocData = {
  contractTitle: string;
  tenantName: string;
  tenantIdNumber?: string;
  tenantPhone?: string;
  tenantEmail?: string;
  tenantAddress?: string;
  landlordName?: string;
  landlordIdNumber?: string;
  landlordContact?: string;
  landlordEmail?: string;
  landlordAddress?: string;
  propertyName: string;
  propertyAddress?: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  depositAmount: number;
  status: string;
  notes: string;
  sections: ContractSection[];
};

/* ---------- shared CSS ---------- */

const sharedCss = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a1a; line-height: 1.5; background: #fff; }
  .page { max-width: 800px; margin: 0 auto; padding: 40px 48px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; border-bottom: 3px solid #2563eb; padding-bottom: 18px; }
  .header-left { display: flex; align-items: center; gap: 16px; }
  .company-logo { height: 56px; width: auto; object-fit: contain; }
  .company-name { font-size: 24px; font-weight: 700; color: #2563eb; }
  .company-address { font-size: 12px; color: #666; margin-top: 4px; white-space: pre-line; }
  .doc-badge { display: inline-block; font-size: 26px; font-weight: 800; color: #1e3a8a; letter-spacing: 1px; text-transform: uppercase; }
  .doc-meta { text-align: right; margin-top: 6px; }
  .doc-meta p { font-size: 12px; color: #666; }
  .doc-meta strong { color: #333; }
  .section { margin-top: 24px; }
  .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #1d4ed8; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px; }
  .parties-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .party-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 16px; }
  .party-role { font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.6px; color: #2563eb; margin-bottom: 6px; }
  .party-name { font-size: 14px; color: #0f172a; margin-bottom: 4px; font-weight: 700; }
  .party-meta { font-size: 12px; color: #475569; margin-top: 4px; line-height: 1.4; }
  .meta-label { font-weight: 600; color: #334155; }
  .terms-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 12px; }
  .term-box { background: #f1f5f9; border-radius: 6px; padding: 10px 12px; text-align: center; }
  .term-box.highlight { background: #eff6ff; border: 1px solid #bfdbfe; }
  .term-label { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.3px; margin-bottom: 3px; }
  .term-val { display: block; font-size: 13px; font-weight: 700; color: #0f172a; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
  .info-item label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.3px; }
  .info-item p { font-size: 14px; font-weight: 500; }
  table.items { width: 100%; border-collapse: collapse; margin-top: 8px; }
  table.items th { background: #f8fafc; border: 1px solid #e5e7eb; padding: 10px 14px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.3px; color: #666; text-align: left; }
  table.items td { border: 1px solid #e5e7eb; padding: 10px 14px; font-size: 13px; }
  table.items td.amount { text-align: right; font-variant-numeric: tabular-nums; }
  table.items th.amount { text-align: right; }
  .totals { margin-top: 12px; display: flex; justify-content: flex-end; }
  .totals-table { min-width: 280px; }
  .totals-row { display: flex; justify-content: space-between; padding: 6px 14px; font-size: 13px; }
  .totals-row.subtotal { border-top: 1px solid #e5e7eb; }
  .totals-row.total { background: #2563eb; color: #fff; font-weight: 700; font-size: 15px; border-radius: 4px; margin-top: 4px; }
  .signature-area { margin-top: 48px; display: flex; justify-content: space-between; gap: 40px; }
  .sig-block { width: 45%; }
  .sig-block img { max-height: 64px; display: block; margin-bottom: 6px; }
  .sig-line { border-top: 1px solid #333; padding-top: 8px; font-size: 12px; color: #333; }
  .sig-label { font-size: 11px; color: #888; margin-top: 2px; }
  .payment-box { margin-top: 28px; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; }
  .payment-box h4 { font-size: 13px; font-weight: 600; color: #0369a1; margin-bottom: 8px; }
  .payment-box p { font-size: 12px; color: #555; white-space: pre-line; }
  .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #aaa; border-top: 1px solid #e5e7eb; padding-top: 16px; }
  .status-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; }
  .status-paid { background: #dcfce7; color: #15803d; }
  .status-pending { background: #fef9c3; color: #a16207; }
  .status-active { background: #dbeafe; color: #1d4ed8; }
  .status-overdue { background: #fecaca; color: #dc2626; }
  .status-draft { background: #f3f4f6; color: #6b7280; }
  .notes-box { background: #fafafa; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; font-size: 13px; color: #555; white-space: pre-wrap; }
  ol.terms { padding-left: 20px; counter-reset: item; }
  ol.terms li { margin: 8px 0; font-size: 13px; line-height: 1.6; }
  .parties-section p { font-size: 13px; line-height: 1.7; }
  .parties-section ul { list-style: disc; padding-left: 24px; margin: 8px 0; }
  .parties-section ol { list-style: decimal; padding-left: 24px; margin: 8px 0; }
  .parties-section li { margin: 4px 0; font-size: 13px; line-height: 1.6; }
  @media print { 
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 20px; }
    button { display: none !important; }
  }
`;

/* ---------- invoice builder ---------- */

export function buildProfessionalInvoiceHtml(
  doc: InvoiceDocData,
  company: CompanyInfo,
  admin: AdminInfo,
): string {
  const docCurrency = company.currency || "ZAR";
  const total = doc.lineItems.reduce((sum, item) => sum + item.amount, 0);
  const taxRate = Number(company?.taxRate || 0);
  // VAT is inclusive in the total amount: Total Due remains unchanged
  const subtotal = taxRate > 0 ? total / (1 + (taxRate / 100)) : total;
  const taxAmount = total - subtotal;

  const statusClass =
    doc.status === "paid" ? "status-paid"
    : doc.status === "overdue" ? "status-overdue"
    : doc.status === "draft" ? "status-draft"
    : "status-pending";

  const effectiveCompanyName = resolveDocCompanyName(company?.companyName);
  const effectiveLogoUrl = resolveDocLogoUrl(company?.logoUrl);
  const logoHtml = `<img src="${esc(effectiveLogoUrl)}" alt="${esc(effectiveCompanyName)} logo" class="company-logo" />`;

  const signatureHtml = admin.signatureUrl
    ? `<img src="${esc(admin.signatureUrl)}" alt="Admin signature" />`
    : "";

  const itemRows = doc.lineItems.map(
    (item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(item.description)}</td>
      <td class="amount">${formatDocCurrency(item.amount, docCurrency)}</td>
    </tr>`
  ).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Invoice ${esc(doc.invoiceId.slice(0, 8))} - ${esc(doc.tenantName)}</title>
  <style>${sharedCss}</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <div class="header-left">
          ${logoHtml}
          <div>
            <div class="company-name">${esc(effectiveCompanyName)}</div>
            <div class="company-address">${esc(company?.address || "South Africa")}</div>
          </div>
        </div>
      </div>
      <div>
        <div class="doc-badge">INVOICE</div>
        <div class="doc-meta">
          <p><strong>Invoice #:</strong> ${esc(doc.invoiceId.slice(0, 8).toUpperCase())}</p>
          <p><strong>Date:</strong> ${fmtDate(new Date().toISOString().slice(0, 10))}</p>
          <p><strong>Due Date:</strong> ${fmtDate(doc.dueDate)}</p>
          <p><strong>Status:</strong> <span class="status-badge ${statusClass}">${esc(doc.status)}</span></p>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Bill To</div>
      <div class="info-grid">
        <div class="info-item">
          <label>Tenant</label>
          <p>${esc(doc.tenantName)}</p>
        </div>
        <div class="info-item">
          <label>Property</label>
          <p>${esc(doc.propertyName)}</p>
        </div>
        <div class="info-item">
          <label>Billing Period</label>
          <p>${esc(doc.month)}</p>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Items</div>
      <table class="items">
        <thead>
          <tr>
            <th style="width:40px">#</th>
            <th>Description</th>
            <th class="amount" style="width:140px">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows || '<tr><td colspan="3" style="text-align:center;color:#888;">No line items</td></tr>'}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-table">
          <div class="totals-row subtotal">
            <span>Subtotal (Excl. VAT)</span>
            <span>${formatDocCurrency(subtotal, docCurrency)}</span>
          </div>
          ${taxRate > 0 ? `<div class="totals-row">
            <span>VAT (${taxRate}%) (Incl.)</span>
            <span>${formatDocCurrency(taxAmount, docCurrency)}</span>
          </div>` : ""}
          <div class="totals-row total">
            <span>Total Due</span>
            <span>${formatDocCurrency(total, docCurrency)}</span>
          </div>
        </div>
      </div>
    </div>

    ${company.paymentInstructions ? `
    <div class="payment-box">
      <h4>Payment Instructions</h4>
      <p>${esc(company.paymentInstructions)}</p>
    </div>` : ""}

    <div class="signature-area">
      <div class="sig-block">
        ${signatureHtml}
        <div class="sig-line">${esc(admin.fullName)}</div>
        <div class="sig-label">Administrator / Authorized Signatory</div>
        <div class="sig-label">Date: ${fmtDate(new Date().toISOString().slice(0, 10))}</div>
      </div>
      <div class="sig-block">
        <div class="sig-line">${esc(doc.tenantName)}</div>
        <div class="sig-label">Tenant</div>
      </div>
    </div>

    <div class="footer">
      ${esc(company.companyName)} &middot; ${esc(company.address)} &middot; Generated on ${fmtDate(new Date().toISOString().slice(0, 10))}
    </div>
  </div>
</body>
</html>`;
}

/* ---------- contract builder ---------- */

export function buildProfessionalContractHtml(
  doc: ContractDocData,
  company: CompanyInfo,
  admin: AdminInfo,
): string {
  const docCurrency = company.currency || "ZAR";
  const statusClass =
    doc.status === "active" ? "status-active"
    : doc.status === "expired" ? "status-overdue"
    : doc.status === "terminated" ? "status-overdue"
    : "status-pending";

  const effectiveCompanyName = resolveDocCompanyName(company?.companyName);
  const effectiveLogoUrl = resolveDocLogoUrl(company?.logoUrl);
  const logoHtml = effectiveLogoUrl
    ? `<img src="${esc(effectiveLogoUrl)}" alt="${esc(effectiveCompanyName)} logo" class="company-logo" />`
    : "";

  const signatureHtml = admin.signatureUrl
    ? `<img src="${esc(admin.signatureUrl)}" alt="Admin signature" />`
    : "";

  const docTitle = doc.contractTitle || "LEASE AGREEMENT";

  // Build custom sections HTML
  const customSectionsHtml = doc.sections.length > 0
    ? doc.sections.map((section, i) => `
    <div class="section">
      <div class="section-title">${i + 1}. ${esc(section.title)}</div>
      <div class="parties-section">
        ${formatSectionContent(section.content)}
      </div>
    </div>`).join("")
    : `
    <div class="section">
      <div class="section-title">1. Parties</div>
      <div class="parties-section">
        <p>This Residential Lease Agreement (&ldquo;Agreement&rdquo;) is made and entered into as of <strong>${fmtDate(doc.startDate)}</strong>, by and between:</p>
        <p style="margin-top:8px;"><strong>Landlord / Property Administrator:</strong> ${esc(doc.landlordName || admin.fullName || effectiveCompanyName)}, located at ${esc(doc.landlordAddress || company?.address || "address on file")}.</p>
        <p style="margin-top:8px;"><strong>Tenant:</strong> ${esc(doc.tenantName)}, for occupation of the property known as <strong>${esc(doc.propertyName)}</strong>.</p>
      </div>
    </div>

    <div class="section">
      <div class="section-title">2. Lease Term</div>
      <ol class="terms">
        <li>The lease commences on <strong>${fmtDate(doc.startDate)}</strong> and terminates on <strong>${fmtDate(doc.endDate)}</strong>, unless renewed or terminated earlier in accordance with this Agreement.</li>
        <li>Either party may terminate this Agreement by providing written notice of at least one (1) calendar month prior to the intended termination date.</li>
      </ol>
    </div>

    <div class="section">
      <div class="section-title">3. Financial Terms</div>
      <ol class="terms">
        <li><strong>Monthly Rent:</strong> The Tenant shall pay <strong>${formatDocCurrency(doc.monthlyRent, docCurrency)}</strong> per month, due in accordance with the company&rsquo;s payment schedule and instructions.</li>
        <li><strong>Security Deposit:</strong> A refundable deposit of <strong>${formatDocCurrency(doc.depositAmount, docCurrency)}</strong> is payable upon signing and shall be held for the duration of the tenancy.</li>
        <li>Late payments may incur penalties as determined by the Landlord&rsquo;s policies. The Tenant is responsible for ensuring timely payment.</li>
      </ol>
    </div>

    <div class="section">
      <div class="section-title">4. Tenant Obligations</div>
      <ol class="terms">
        <li>The Tenant shall maintain the property in a clean, sanitary, and reasonable condition throughout the tenancy.</li>
        <li>The Tenant shall promptly report all maintenance issues, damages, or safety hazards to the Landlord.</li>
        <li>The Tenant shall not sublet, assign, or transfer this lease or the premises without prior written consent of the Landlord.</li>
        <li>The Tenant shall comply with all applicable laws, regulations, and community rules pertaining to the property.</li>
        <li>The Tenant shall not make structural alterations or modifications without written approval from the Landlord.</li>
      </ol>
    </div>

    <div class="section">
      <div class="section-title">5. Landlord Obligations</div>
      <ol class="terms">
        <li>The Landlord shall maintain essential services including potable water, electricity supply connections, and structural integrity of the premises.</li>
        <li>The Landlord shall attend to qualifying maintenance requests within a reasonable timeframe.</li>
        <li>The Landlord shall return the security deposit (less any deductions for damages beyond fair wear and tear) within 14 days of lease termination.</li>
      </ol>
    </div>

    <div class="section">
      <div class="section-title">6. Termination &amp; Breach</div>
      <ol class="terms">
        <li>In the event of a material breach by either party, the non-breaching party may terminate this Agreement after providing written notice and a reasonable period to cure the breach.</li>
        <li>The Landlord may terminate the Agreement immediately for non-payment of rent exceeding 30 days, illegal activities, or willful destruction of property.</li>
      </ol>
    </div>`;

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${esc(docTitle)} - ${esc(doc.tenantName)}</title>
  <style>${sharedCss}</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="header-left">
        ${logoHtml}
        <div>
          <div class="company-name">${esc(effectiveCompanyName)}</div>
          ${company?.address ? `<div class="company-address">${esc(company.address)}</div>` : ""}
        </div>
      </div>
      <div>
        <div class="doc-badge">${esc(docTitle.toUpperCase())}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Parties &amp; Lease Schedule</div>
      <div class="parties-grid">
        <div class="party-card">
          <div class="party-role">Landlord (Lessor)</div>
          <p class="party-name">${esc(doc.landlordName || admin.fullName || effectiveCompanyName)}</p>
          ${doc.landlordIdNumber ? `<p class="party-meta"><span class="meta-label">ID / Reg No:</span> ${esc(doc.landlordIdNumber)}</p>` : ""}
          ${doc.landlordAddress || company?.address ? `<p class="party-meta"><span class="meta-label">Address:</span> ${esc(doc.landlordAddress || company?.address || "")}</p>` : ""}
          ${doc.landlordContact || company?.phone ? `<p class="party-meta"><span class="meta-label">Contact:</span> ${esc(doc.landlordContact || company?.phone || "")}</p>` : ""}
          ${doc.landlordEmail || company?.email ? `<p class="party-meta"><span class="meta-label">Email:</span> ${esc(doc.landlordEmail || company?.email || "")}</p>` : ""}
        </div>

        <div class="party-card">
          <div class="party-role">Tenant (Lessee)</div>
          <p class="party-name">${esc(doc.tenantName)}</p>
          ${doc.tenantIdNumber ? `<p class="party-meta"><span class="meta-label">ID / Passport:</span> ${esc(doc.tenantIdNumber)}</p>` : ""}
          ${doc.tenantPhone ? `<p class="party-meta"><span class="meta-label">Phone:</span> ${esc(doc.tenantPhone)}</p>` : ""}
          ${doc.tenantEmail ? `<p class="party-meta"><span class="meta-label">Email:</span> ${esc(doc.tenantEmail)}</p>` : ""}
          <p class="party-meta"><span class="meta-label">Premises:</span> <strong>${esc(doc.propertyName)}</strong>${doc.propertyAddress ? `, ${esc(doc.propertyAddress)}` : ""}</p>
        </div>
      </div>

      <div class="terms-grid">
        <div class="term-box">
          <span class="term-label">Lease Start</span>
          <span class="term-val">${fmtDate(doc.startDate)}</span>
        </div>
        <div class="term-box">
          <span class="term-label">Lease End</span>
          <span class="term-val">${fmtDate(doc.endDate)}</span>
        </div>
        <div class="term-box highlight">
          <span class="term-label">Monthly Rent</span>
          <span class="term-val">${formatDocCurrency(doc.monthlyRent, docCurrency)}</span>
        </div>
        <div class="term-box">
          <span class="term-label">Security Deposit</span>
          <span class="term-val">${formatDocCurrency(doc.depositAmount, docCurrency)}</span>
        </div>
      </div>
    </div>

    ${customSectionsHtml}

    ${doc.notes ? `
    <div class="section">
      <div class="section-title">Additional Notes &amp; Special Conditions</div>
      <div class="notes-box">${esc(doc.notes)}</div>
    </div>` : ""}

    ${company.paymentInstructions ? `
    <div class="payment-box">
      <h4>Payment Instructions</h4>
      <p>${esc(company.paymentInstructions)}</p>
    </div>` : ""}

    <div class="signature-area">
      <div class="sig-block">
        ${signatureHtml}
        <div class="sig-line">${esc(admin.fullName)}</div>
        <div class="sig-label">Landlord / Property Administrator</div>
        <div class="sig-label">Date: ${fmtDate(new Date().toISOString().slice(0, 10))}</div>
      </div>
      <div class="sig-block">
        <div style="min-height:64px;"></div>
        <div class="sig-line">${esc(doc.tenantName)}</div>
        <div class="sig-label">Tenant</div>
        <div class="sig-label">Date: ____________________</div>
      </div>
    </div>

    <div class="footer">
      ${esc(company.companyName)} &middot; ${esc(company.address)} &middot; Generated on ${fmtDate(new Date().toISOString().slice(0, 10))}
    </div>
  </div>
</body>
</html>`;
}

/* ---------- unified invoice (multi-payment) builder ---------- */

export type UnifiedInvoiceDocData = {
  collectorName: string;
  transactions: {
    paymentDate: string;
    tenantName: string;
    propertyName: string;
    amountPaid: number;
  }[];
};

export function buildUnifiedInvoiceHtml(
  doc: UnifiedInvoiceDocData,
  company: CompanyInfo,
  admin: AdminInfo,
): string {
  const docCurrency = company.currency || "ZAR";
  const total = doc.transactions.reduce((sum, t) => sum + t.amountPaid, 0);

  const effectiveCompanyName = resolveDocCompanyName(company?.companyName);
  const effectiveLogoUrl = resolveDocLogoUrl(company?.logoUrl);
  const logoHtml = `<img src="${esc(effectiveLogoUrl)}" alt="${esc(effectiveCompanyName)} logo" class="company-logo" />`;

  const signatureHtml = admin.signatureUrl
    ? `<img src="${esc(admin.signatureUrl)}" alt="Admin signature" />`
    : "";

  const rows = doc.transactions.map(
    (t, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(t.paymentDate)}</td>
      <td>${esc(t.tenantName)}</td>
      <td>${esc(t.propertyName)}</td>
      <td class="amount">${formatDocCurrency(t.amountPaid, docCurrency)}</td>
    </tr>`
  ).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Unified Invoice - ${esc(doc.collectorName)}</title>
  <style>${sharedCss}</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <div class="header-left">
          ${logoHtml}
          <div>
            <div class="company-name">${esc(effectiveCompanyName)}</div>
            <div class="company-address">${esc(company?.address || "South Africa")}</div>
          </div>
        </div>
      </div>
      <div>
        <div class="doc-badge">UNIFIED INVOICE</div>
        <div class="doc-meta">
          <p><strong>Collector:</strong> ${esc(doc.collectorName)}</p>
          <p><strong>Date:</strong> ${fmtDate(new Date().toISOString().slice(0, 10))}</p>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Rent Collection Summary</div>
      <table class="items">
        <thead>
          <tr>
            <th style="width:40px">#</th>
            <th>Payment Date</th>
            <th>Tenant</th>
            <th>Property</th>
            <th class="amount" style="width:140px">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="totals">
        <div class="totals-table">
          <div class="totals-row total">
            <span>Total Collected</span>
            <span>${formatDocCurrency(total, docCurrency)}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="signature-area">
      <div class="sig-block">
        ${signatureHtml}
        <div class="sig-line">${esc(admin.fullName)}</div>
        <div class="sig-label">Administrator</div>
        <div class="sig-label">Date: ${fmtDate(new Date().toISOString().slice(0, 10))}</div>
      </div>
      <div class="sig-block">
        <div class="sig-line">${esc(doc.collectorName)}</div>
        <div class="sig-label">Rent Collector</div>
      </div>
    </div>

    <div class="footer">
      ${esc(company.companyName)} &middot; ${esc(company.address)} &middot; Generated on ${fmtDate(new Date().toISOString().slice(0, 10))}
    </div>
  </div>
</body>
</html>`;
}

/* ---------- balance sheet builder ---------- */

export type BalanceSheetMonthlyRow = {
  month: string;
  rentCollected: number;
  maintenance: number;
  bills: number;
  renovations: number;
  tax: number;
  totalExpenses: number;
  netProfit: number;
};

export type BalanceSheetTransactionRow = {
  date: string;
  month: string;
  entryType: "income" | "expense" | "tax";
  category: string;
  details: string;
  executor: string;
  amount: number;
  tax: number;
  net: number;
};

export type BalanceSheetDocData = {
  scopeLabel: string;
  startDate: string;
  endDate: string;
  presentation: "summary" | "expanded";
  includeSignature: boolean;
  includeAdminName: boolean;
  includeExecutor: boolean;
  summary: {
    rentCollected: number;
    maintenance: number;
    bills: number;
    renovations: number;
    tax: number;
    totalExpenses: number;
    netProfit: number;
  };
  monthlyRows: BalanceSheetMonthlyRow[];
  transactionRows: BalanceSheetTransactionRow[];
};

export function buildBalanceSheetHtml(
  doc: BalanceSheetDocData,
  company: CompanyInfo,
  admin: AdminInfo,
): string {
  const docCurrency = company.currency || "ZAR";
  const effectiveCompanyName = resolveDocCompanyName(company?.companyName);
  const effectiveLogoUrl = resolveDocLogoUrl(company?.logoUrl);
  const logoHtml = `<img src="${esc(effectiveLogoUrl)}" alt="${esc(effectiveCompanyName)} logo" class="company-logo" />`;

  const signatureHtml = doc.includeSignature && admin.signatureUrl
    ? `<img src="${esc(admin.signatureUrl)}" alt="Admin signature" />`
    : "";

  const adminName = doc.includeAdminName ? admin.fullName : "________________________";

  const monthlyRowsHtml = doc.monthlyRows.map((row, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${esc(row.month)}</td>
      <td class="amount" style="color:#15803d;font-weight:700;">${formatDocCurrency(row.rentCollected, docCurrency)}</td>
      <td class="amount" style="color:#dc2626;">${formatDocCurrency(row.maintenance, docCurrency)}</td>
      <td class="amount" style="color:#dc2626;">${formatDocCurrency(row.bills, docCurrency)}</td>
      <td class="amount" style="color:#dc2626;">${formatDocCurrency(row.renovations, docCurrency)}</td>
      <td class="amount" style="color:#dc2626;">${formatDocCurrency(row.tax, docCurrency)}</td>
      <td class="amount" style="color:#dc2626;font-weight:700;">${formatDocCurrency(row.totalExpenses, docCurrency)}</td>
      <td class="amount" style="color:${row.netProfit >= 0 ? "#15803d" : "#dc2626"};font-weight:700;">${formatDocCurrency(row.netProfit, docCurrency)}</td>
    </tr>`).join("");

  const transactionRowsHtml = doc.transactionRows.map((row, index) => {
    const amountColor = row.entryType === "income" ? "#15803d" : "#dc2626";
    return `
    <tr>
      <td>${index + 1}</td>
      <td>${fmtDate(row.date)}</td>
      <td>${esc(row.month)}</td>
      <td>${esc(row.category)}</td>
      <td>${esc(row.details)}</td>
      ${doc.includeExecutor ? `<td>${esc(row.executor || "-")}</td>` : ""}
      <td class="amount" style="color:${amountColor};font-weight:700;">${formatDocCurrency(row.amount, docCurrency)}</td>
      <td class="amount" style="color:#dc2626;">${formatDocCurrency(row.tax, docCurrency)}</td>
      <td class="amount" style="color:${row.net >= 0 ? "#15803d" : "#dc2626"};font-weight:700;">${formatDocCurrency(row.net, docCurrency)}</td>
    </tr>`;
  }).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Balance Sheet - ${esc(doc.scopeLabel)}</title>
  <style>${sharedCss}</style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <div class="header-left">
          ${logoHtml}
          <div>
            <div class="company-name">${esc(effectiveCompanyName)}</div>
            <div class="company-address">${esc(company?.address || "")}</div>
          </div>
        </div>
      </div>
      <div>
        <div class="doc-badge">BALANCE SHEET</div>
        <div class="doc-meta">
          <p><strong>Scope:</strong> ${esc(doc.scopeLabel)}</p>
          <p><strong>From:</strong> ${fmtDate(doc.startDate)}</p>
          <p><strong>To:</strong> ${fmtDate(doc.endDate)}</p>
          <p><strong>Presentation:</strong> ${esc(doc.presentation)}</p>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Summary</div>
      <table class="items">
        <thead>
          <tr>
            <th>Metric</th>
            <th class="amount" style="width:220px">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr><td><strong>INFLOWS (Income)</strong></td><td class="amount" style="color:#15803d;font-weight:700;">${formatDocCurrency(doc.summary.rentCollected, docCurrency)}</td></tr>
          <tr><td>Rent Collected</td><td class="amount" style="color:#15803d;">${formatDocCurrency(doc.summary.rentCollected, docCurrency)}</td></tr>
          <tr><td><strong>OUTFLOWS (Expenses)</strong></td><td class="amount" style="color:#dc2626;font-weight:700;">${formatDocCurrency(doc.summary.totalExpenses + doc.summary.tax, docCurrency)}</td></tr>
          <tr><td>Work Order Fees / Maintenance</td><td class="amount" style="color:#dc2626;">${formatDocCurrency(doc.summary.maintenance, docCurrency)}</td></tr>
          <tr><td>Bill Payments</td><td class="amount" style="color:#dc2626;">${formatDocCurrency(doc.summary.bills, docCurrency)}</td></tr>
          <tr><td>Renovations</td><td class="amount" style="color:#dc2626;">${formatDocCurrency(doc.summary.renovations, docCurrency)}</td></tr>
          <tr><td>Tax</td><td class="amount" style="color:#dc2626;">${formatDocCurrency(doc.summary.tax, docCurrency)}</td></tr>
          <tr><td><strong>Net Position</strong></td><td class="amount" style="color:${doc.summary.netProfit >= 0 ? "#15803d" : "#dc2626"};font-weight:700;">${formatDocCurrency(doc.summary.netProfit, docCurrency)}</td></tr>
        </tbody>
      </table>
    </div>

    ${doc.presentation === "expanded" ? `
    <div class="section">
      <div class="section-title">Monthly Breakdown</div>
      <table class="items">
        <thead>
          <tr>
            <th style="width:40px">#</th>
            <th>Month</th>
            <th class="amount">Rent</th>
            <th class="amount">Maintenance</th>
            <th class="amount">Bills</th>
            <th class="amount">Renovations</th>
            <th class="amount">Tax</th>
            <th class="amount">Expenses</th>
            <th class="amount">Net</th>
          </tr>
        </thead>
        <tbody>
          ${monthlyRowsHtml || '<tr><td colspan="9" style="text-align:center;color:#888;">No monthly rows in selected range</td></tr>'}
        </tbody>
      </table>

      <table class="items" style="margin-top:14px;">
        <thead>
          <tr>
            <th style="width:40px">#</th>
            <th style="width:120px">Date</th>
            <th style="width:90px">Month</th>
            <th style="width:110px">Entry</th>
            <th>Details</th>
            ${doc.includeExecutor ? '<th style="width:120px">Executed By</th>' : ""}
            <th class="amount" style="width:120px">Amount</th>
            <th class="amount" style="width:100px">Tax</th>
            <th class="amount" style="width:120px">Net</th>
          </tr>
        </thead>
        <tbody>
          ${transactionRowsHtml || `<tr><td colspan="${doc.includeExecutor ? 9 : 8}" style="text-align:center;color:#888;">No transaction rows in selected range</td></tr>`}
        </tbody>
      </table>
    </div>` : ""}

    <div class="signature-area">
      <div class="sig-block">
        ${signatureHtml}
        <div class="sig-line">${esc(adminName)}</div>
        <div class="sig-label">Administrator</div>
        <div class="sig-label">Date: ${fmtDate(new Date().toISOString().slice(0, 10))}</div>
      </div>
      <div class="sig-block">
        <div class="sig-line">${esc(company.companyName)}</div>
        <div class="sig-label">Company</div>
      </div>
    </div>

    <div class="footer">
      ${esc(company.companyName)} &middot; ${esc(company.address)} &middot; Generated on ${fmtDate(new Date().toISOString().slice(0, 10))}
    </div>
  </div>
</body>
</html>`;
}

export function buildProfessionalPayslipHtml(
  payslip: {
    id: string;
    employeeName: string;
    jobTitle: string;
    department: string;
    payPeriod: string;
    basicSalary: number;
    allowances: Record<string, number | undefined>;
    grossPay: number;
    deductions: Record<string, number | undefined>;
    netPay: number;
    paymentMethod?: string;
    generatedByName?: string;
    createdAt?: string;
  },
  company: CompanyInfo
): string {
  const docCurrency = company.currency || "ZAR";
  const effectiveCompanyName = resolveDocCompanyName(company?.companyName);
  const effectiveLogoUrl = resolveDocLogoUrl(company?.logoUrl);
  const companyLogoHtml = `<div style="display:flex; align-items:center; gap:12px;">
    <img src="${esc(effectiveLogoUrl)}" alt="${esc(effectiveCompanyName)}" style="height:52px; max-width:180px; object-fit:contain;" />
    <div style="font-size:22px; font-weight:900; color:#1e3a8a; letter-spacing:-0.5px;">${esc(effectiveCompanyName)}</div>
  </div>`;

  const allowanceEntries = Object.entries(payslip.allowances || {}).filter(([_, v]) => Number(v) > 0);
  const deductionEntries = Object.entries(payslip.deductions || {}).filter(([_, v]) => Number(v) > 0);

  const totalAllowances = allowanceEntries.reduce((sum, [_, v]) => sum + Number(v), 0);
  const totalDeductions = deductionEntries.reduce((sum, [_, v]) => sum + Number(v), 0);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Official Payslip - ${esc(payslip.employeeName)} (${esc(payslip.payPeriod)})</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #0f172a; background: #fff; padding: 40px 24px; }
    .payslip-container { max-width: 780px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 16px; padding: 36px; box-shadow: 0 4px 20px rgba(0,0,0,0.04); }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 24px; }
    .badge { display: inline-block; background: #1e40af; color: #fff; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; padding: 4px 10px; border-radius: 6px; margin-bottom: 6px; }
    .meta-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .meta-item label { display: block; font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 2px; }
    .meta-item p { font-size: 14px; font-weight: 700; color: #0f172a; }
    .tables-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #f1f5f9; text-align: left; padding: 8px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #475569; border-bottom: 1px solid #cbd5e1; }
    td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; }
    .amount { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
    .subtotal-row { font-weight: 700; background: #f8fafc; border-top: 1px solid #cbd5e1; }
    .net-box { background: linear-gradient(135deg, #1e3a8a, #2563eb); color: #fff; border-radius: 12px; padding: 20px 24px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }
    .net-label { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.9; }
    .net-amount { font-size: 28px; font-weight: 900; font-family: monospace; }
    .sig-area { display: flex; justify-content: space-between; margin-top: 36px; padding-top: 16px; }
    .sig-col { width: 42%; border-top: 1px solid #64748b; padding-top: 8px; font-size: 12px; }
    .footer-note { text-align: center; font-size: 11px; color: #94a3b8; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 12px; }
    .no-print { display: flex; justify-content: space-between; align-items: center; background: #0f172a; color: #fff; padding: 12px 24px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
    .print-btn { background: #2563eb; color: #fff; border: none; padding: 8px 18px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: background 0.15s; }
    .print-btn:hover { background: #1d4ed8; }
    .close-btn { background: #334155; color: #e2e8f0; border: none; padding: 8px 14px; border-radius: 8px; font-weight: 600; font-size: 13px; cursor: pointer; }
    .close-btn:hover { background: #475569; }
    @media print {
      body { padding: 0; background: #fff; }
      .no-print { display: none !important; }
      .payslip-container { border: none !important; box-shadow: none !important; padding: 0 !important; }
      @page { margin: 1.5cm; }
    }
  </style>
</head>
<body>
  <div class="payslip-container">
    <div class="no-print">
      <div>
        <div style="font-weight: 800; font-size: 14px; display: flex; align-items: center; gap: 8px;">
          <span>Official Company Payslip</span>
          <span style="font-size: 11px; background: #1e293b; padding: 2px 8px; border-radius: 4px; color: #93c5fd;">Ready to Print / PDF</span>
        </div>
        <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">Use the button on the right or press Ctrl+P to save as PDF</div>
      </div>
      <div style="display: flex; gap: 10px;">
        <button class="print-btn" onclick="window.print()">
          <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>
          Print / Save as PDF
        </button>
        <button class="close-btn" onclick="window.close()">Close</button>
      </div>
    </div>

    <div class="header">
      <div>
        ${companyLogoHtml}
        <p style="font-size: 12px; color: #64748b; margin-top: 6px;">${esc(company.address || "Company Headquarters")}</p>
      </div>
      <div style="text-align:right;">
        <div class="badge">Official Payslip</div>
        <p style="font-size: 12px; color: #64748b; font-weight: 600;">Ref: PAY-${esc(payslip.id.slice(0, 8).toUpperCase())}</p>
        <p style="font-size: 12px; color: #64748b;">Period: <strong style="color:#0f172a;">${esc(payslip.payPeriod)}</strong></p>
      </div>
    </div>

    <div class="meta-box">
      <div>
        <div class="meta-item">
          <label>Employee Name</label>
          <p>${esc(payslip.employeeName)}</p>
        </div>
        <div class="meta-item" style="margin-top:8px;">
          <label>Designation / Job Title</label>
          <p>${esc(payslip.jobTitle)}</p>
        </div>
      </div>
      <div>
        <div class="meta-item">
          <label>Department</label>
          <p style="text-transform:capitalize;">${esc(payslip.department.replace(/_/g, " "))}</p>
        </div>
        <div class="meta-item" style="margin-top:8px;">
          <label>Disbursement Method</label>
          <p style="text-transform:uppercase;">${esc(payslip.paymentMethod || "Direct Bank Transfer")}</p>
        </div>
      </div>
    </div>

    <div class="tables-grid">
      <!-- Earnings -->
      <div style="border:1px solid #e2e8f0; border-radius:10px; overflow:hidden;">
        <table>
          <thead>
            <tr>
              <th>Earnings</th>
              <th class="amount">Amount (${esc(docCurrency)})</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Basic Salary</td>
              <td class="amount">${formatDocCurrency(payslip.basicSalary, docCurrency)}</td>
            </tr>
            ${allowanceEntries.map(([k, v]) => `
              <tr>
                <td style="text-transform:capitalize;">${esc(k.replace(/_/g, " "))} Allowance</td>
                <td class="amount">${formatDocCurrency(Number(v), docCurrency)}</td>
              </tr>
            `).join("")}
            <tr class="subtotal-row">
              <td>Total Gross Earnings</td>
              <td class="amount" style="color:#1e3a8a;">${formatDocCurrency(payslip.grossPay, docCurrency)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Deductions -->
      <div style="border:1px solid #e2e8f0; border-radius:10px; overflow:hidden;">
        <table>
          <thead>
            <tr>
              <th>Statutory Deductions</th>
              <th class="amount">Amount (${esc(docCurrency)})</th>
            </tr>
          </thead>
          <tbody>
            ${deductionEntries.length === 0 ? `
              <tr>
                <td colspan="2" style="text-align:center; color:#94a3b8; font-style:italic;">No deductions recorded</td>
              </tr>
            ` : deductionEntries.map(([k, v]) => `
              <tr>
                <td style="text-transform:capitalize;">${esc(k.replace(/([A-Z])/g, ' $1').toLowerCase())}</td>
                <td class="amount" style="color:#dc2626;">-${formatDocCurrency(Number(v), docCurrency)}</td>
              </tr>
            `).join("")}
            <tr class="subtotal-row">
              <td>Total Deductions</td>
              <td class="amount" style="color:#dc2626;">-${formatDocCurrency(totalDeductions || (payslip.grossPay - payslip.netPay), docCurrency)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="net-box">
      <div>
        <div class="net-label">Net Take-Home Pay</div>
        <div style="font-size:11px; opacity:0.8; margin-top:2px;">Credited directly to employee account</div>
      </div>
      <div class="net-amount">${formatDocCurrency(payslip.netPay, docCurrency)}</div>
    </div>

    <div class="sig-area">
      <div class="sig-col">
        <p style="font-weight:700; color:#0f172a;">Prepared & Authorized by:</p>
        <p style="color:#64748b; margin-top:2px;">${esc(payslip.generatedByName || company.companyName + " HR")}</p>
      </div>
      <div class="sig-col" style="text-align:right;">
        <p style="font-weight:700; color:#0f172a;">Employee Acknowledgment:</p>
        <p style="color:#64748b; margin-top:2px;">${esc(payslip.employeeName)}</p>
      </div>
    </div>

    <div class="footer-note">
      This is a confidential computer-generated payslip issued by ${esc(company.companyName)}. No physical signature required.
    </div>
  </div>
  <script>
    window.addEventListener('load', () => {
      // Auto-trigger print dialog when opened in new tab
      setTimeout(() => {
        try { window.print(); } catch (e) { console.log(e); }
      }, 350);
    });
  </script>
</body>
</html>`;
}

export type ExternalQuoteRequestData = {
  // Requesting company info
  requestingCompanyName: string;
  requestingCompanyLogo?: string;
  requestingCompanyAddress?: string;
  requestingCompanyPhone?: string;
  requestingCompanyEmail?: string;
  // Accounting/requesting contact
  contactName: string;
  contactTitle?: string;
  contactEmail?: string;
  contactPhone?: string;
  // Supplier / recipient company
  supplierName: string;
  supplierContactPerson?: string;
  supplierEmail?: string;
  supplierPhone?: string;
  supplierAddress?: string;
  // Items (from procurement requests)
  items: Array<{
    itemName: string;
    specifications: string;
    quantity: number;
    unit: string;
  }>;
  // Reference info
  referenceNumber?: string;
  requestDate?: string;
  currency?: string;
};

export function buildExternalQuoteRequestHtml(data: ExternalQuoteRequestData): string {
  const today = data.requestDate || new Date().toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" });
  const refNo = data.referenceNumber || `RFQ-${Date.now().toString(36).toUpperCase()}`;
  const currency = data.currency || "ZAR";

  const itemRows = data.items.map((item, i) => `
    <tr style="border-bottom: 1px solid #e5e7eb;">
      <td style="padding: 10px 12px; font-size: 12px; color: #374151;">${i + 1}</td>
      <td style="padding: 10px 12px; font-size: 12px; font-weight: 600; color: #111827;">${esc(item.itemName)}</td>
      <td style="padding: 10px 12px; font-size: 11px; color: #6b7280; line-height: 1.5;">${esc(item.specifications)}</td>
      <td style="padding: 10px 12px; font-size: 12px; text-align: center; color: #374151;">${item.quantity} ${esc(item.unit)}</td>
      <td style="padding: 10px 12px; font-size: 12px; color: #9ca3af; font-style: italic;">Awaiting Quote</td>
    </tr>
  `).join("");

  const effectiveCompanyName = resolveDocCompanyName(data.requestingCompanyName);
  const effectiveLogoUrl = resolveDocLogoUrl(data.requestingCompanyLogo);
  const logoHtml = `<img src="${esc(effectiveLogoUrl)}" alt="${esc(effectiveCompanyName)}" style="height: 52px; width: auto; object-fit: contain; border-radius: 6px;"/>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Request for Quotation — ${esc(refNo)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; background: #f9fafb; color: #111827; }
    @media print {
      .no-print { display: none !important; }
      body { background: white; }
      .page { box-shadow: none !important; }
    }
    .no-print {
      position: fixed; top: 0; left: 0; right: 0; z-index: 100;
      background: #1e293b; padding: 10px 24px;
      display: flex; align-items: center; justify-between; gap: 12px;
      border-bottom: 1px solid #334155;
    }
    .no-print span { color: #94a3b8; font-size: 12px; }
    .no-print button {
      padding: 8px 18px; border-radius: 8px; font-size: 12px; font-weight: 600;
      cursor: pointer; border: none; transition: all 0.15s;
    }
    .btn-print { background: #2563eb; color: white; }
    .btn-print:hover { background: #1d4ed8; }
    .btn-close { background: #475569; color: white; }
    .btn-close:hover { background: #334155; }
    .page {
      max-width: 900px; margin: 80px auto 40px; background: white;
      border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08);
      overflow: hidden;
    }
    .header { background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 32px 40px; }
    .header-top { display: flex; align-items: center; justify-content: space-between; }
    .rfq-badge {
      background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25);
      border-radius: 8px; padding: 8px 16px; color: white; font-size: 11px;
      font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;
    }
    .company-info { text-align: right; color: rgba(255,255,255,0.8); font-size: 11px; margin-top: 4px; line-height: 1.6; }
    .company-name-header { color: white; font-size: 18px; font-weight: 800; margin-top: 2px; }
    .doc-title { margin-top: 20px; }
    .doc-title h1 { font-size: 28px; font-weight: 900; color: white; letter-spacing: -0.5px; }
    .doc-title p { font-size: 13px; color: rgba(255,255,255,0.7); margin-top: 4px; }
    .body { padding: 36px 40px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; }
    .meta-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 16px 20px; }
    .meta-card-title { font-size: 10px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #64748b; margin-bottom: 8px; }
    .meta-card p { font-size: 12px; color: #374151; line-height: 1.6; }
    .meta-card strong { color: #111827; font-weight: 700; }
    .intro { background: #eff6ff; border-left: 4px solid #2563eb; border-radius: 0 8px 8px 0; padding: 14px 18px; margin-bottom: 28px; font-size: 13px; color: #1e40af; line-height: 1.6; }
    .section-title { font-size: 13px; font-weight: 800; color: #111827; letter-spacing: -0.2px; margin-bottom: 12px; display: flex; align-items: center; gap-8px; }
    table { width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; margin-bottom: 28px; }
    thead { background: #f1f5f9; }
    thead th { padding: 10px 12px; text-align: left; font-size: 10px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; }
    .footer { background: #f8fafc; border-top: 1px solid #e5e7eb; padding: 20px 40px; display: flex; align-items: center; justify-content: space-between; }
    .footer p { font-size: 11px; color: #94a3b8; }
    .footer strong { color: #64748b; }
    .sig-area { margin-top: 32px; display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
    .sig-box { border-top: 2px solid #e5e7eb; padding-top: 10px; }
    .sig-box p { font-size: 11px; color: #6b7280; }
    .sig-box strong { font-size: 12px; color: #111827; display: block; margin-bottom: 2px; }
  </style>
</head>
<body>

  <div class="no-print" style="display: flex; align-items: center; justify-content: space-between;">
    <span>📄 Request for Quotation — ${esc(refNo)}</span>
    <div style="display: flex; gap: 8px;">
      <button class="btn-print" onclick="window.print()">🖨 Print / Save as PDF</button>
      <button class="btn-close" onclick="window.close()">✕ Close</button>
    </div>
  </div>

  <div class="page">
    <div class="header">
      <div class="header-top">
        <div style="display: flex; align-items: center; gap: 14px;">
          ${logoHtml}
          <div>
            <div class="company-name-header">${esc(data.requestingCompanyName)}</div>
            <div class="company-info">
              ${data.requestingCompanyAddress ? esc(data.requestingCompanyAddress) + "<br>" : ""}
              ${data.requestingCompanyPhone ? "Tel: " + esc(data.requestingCompanyPhone) : ""}
              ${data.requestingCompanyEmail ? " | " + esc(data.requestingCompanyEmail) : ""}
            </div>
          </div>
        </div>
        <div class="rfq-badge">REQUEST FOR QUOTATION</div>
      </div>
      <div class="doc-title">
        <h1>Quotation Request</h1>
        <p>Ref: ${esc(refNo)} &nbsp;|&nbsp; Date: ${esc(today)}</p>
      </div>
    </div>

    <div class="body">
      <div class="meta-grid">
        <div class="meta-card">
          <div class="meta-card-title">📤 Quote Requested By</div>
          <p><strong>${esc(data.contactName)}</strong></p>
          ${data.contactTitle ? `<p>${esc(data.contactTitle)}</p>` : ""}
          <p>${esc(data.requestingCompanyName)}</p>
          ${data.contactEmail ? `<p>Email: ${esc(data.contactEmail)}</p>` : ""}
          ${data.contactPhone ? `<p>Tel: ${esc(data.contactPhone)}</p>` : ""}
        </div>
        <div class="meta-card">
          <div class="meta-card-title">📩 Quote To Be Submitted To</div>
          <p><strong>${esc(data.supplierName)}</strong></p>
          ${data.supplierContactPerson ? `<p>Attn: ${esc(data.supplierContactPerson)}</p>` : ""}
          ${data.supplierAddress ? `<p>${esc(data.supplierAddress)}</p>` : ""}
          ${data.supplierEmail ? `<p>Email: ${esc(data.supplierEmail)}</p>` : ""}
          ${data.supplierPhone ? `<p>Tel: ${esc(data.supplierPhone)}</p>` : ""}
        </div>
      </div>

      <div class="intro">
        Dear ${data.supplierContactPerson ? esc(data.supplierContactPerson) : "Sir/Madam"},<br/><br/>
        We hereby request you to provide us with a formal quotation for the items listed below. Please ensure your quotation includes unit pricing, VAT breakdown, delivery lead times, and any applicable terms and conditions.<br/><br/>
        Kindly submit your quotation to <strong>${data.contactEmail ? esc(data.contactEmail) : esc(data.requestingCompanyName)}</strong> by return.
      </div>

      <div class="section-title">📋 Items Requiring Quotation</div>
      <table>
        <thead>
          <tr>
            <th style="width: 32px;">#</th>
            <th>Item Description</th>
            <th>Full Specifications</th>
            <th style="width: 80px; text-align: center;">Qty</th>
            <th style="width: 100px;">Unit Price (${esc(currency)})</th>
          </tr>
        </thead>
        <tbody>
          ${itemRows}
        </tbody>
      </table>

      <div class="sig-area">
        <div class="sig-box">
          <strong>${esc(data.contactName)}</strong>
          <p>${data.contactTitle ? esc(data.contactTitle) + " — " : ""}${esc(data.requestingCompanyName)}</p>
          <p style="margin-top: 4px; color: #9ca3af;">Signature: ________________________</p>
          <p style="color: #9ca3af;">Date: ________________________</p>
        </div>
        <div class="sig-box">
          <strong>For: ${esc(data.supplierName)}</strong>
          <p>Authorised Signatory</p>
          <p style="margin-top: 4px; color: #9ca3af;">Signature: ________________________</p>
          <p style="color: #9ca3af;">Date: ________________________</p>
        </div>
      </div>
    </div>

    <div class="footer">
      <p>This is a formal request for quotation only and does not constitute a purchase order or commitment to purchase.</p>
      <p><strong>Ref: ${esc(refNo)}</strong></p>
    </div>
  </div>

</body>
</html>`;
}

export function openExternalQuoteRequestInNewTab(data: ExternalQuoteRequestData): void {
  const html = buildExternalQuoteRequestHtml(data);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, "_blank", "noopener,noreferrer");
  if (win) {
    win.focus();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}
