import type { CommercialBooking, MealPlan } from "@/lib/types";

export function formatRoomDisplayName(roomNumber: string | undefined | null, roomType?: string): string {
  const rawNum = (roomNumber || "101").trim();
  const cleanNum = /^room\b/i.test(rawNum) ? rawNum : `Room ${rawNum}`;
  if (!roomType) return cleanNum;
  const cleanType = roomType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return `${cleanNum} • ${cleanType}`;
}

export function formatMealPlanLabel(mealPlan: MealPlan | string | undefined | null): string {
  switch (mealPlan) {
    case "bed_breakfast":
      return "Bed & Breakfast";
    case "room_only":
      return "Room Only (No Meals)";
    case "bed_lunch":
      return "Bed, Breakfast & Lunch";
    case "full_board":
      return "Full Board (All Meals Included)";
    default:
      if (!mealPlan) return "Standard Accommodation";
      return String(mealPlan).replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

export function formatStatusLabel(status: string | undefined | null): { label: string; color: string; bg: string } {
  const s = (status || "checked_in").toLowerCase();
  switch (s) {
    case "checked_in":
      return { label: "OFFICIALLY CHECKED IN", color: "#15803d", bg: "#dcfce7" };
    case "confirmed":
      return { label: "CONFIRMED RESERVATION", color: "#2563eb", bg: "#dbeafe" };
    case "checked_out":
      return { label: "CHECKED OUT", color: "#475569", bg: "#f1f5f9" };
    case "extended":
      return { label: "EXTENDED STAY", color: "#9333ea", bg: "#f3e8ff" };
    case "cancelled":
      return { label: "CANCELLED", color: "#b91c1c", bg: "#fee2e2" };
    default:
      return { label: s.toUpperCase().replace(/_/g, " "), color: "#1e293b", bg: "#e2e8f0" };
  }
}

function formatDateDisplay(dateStr: string | undefined | null): string {
  if (!dateStr) return "-";
  try {
    const raw = dateStr.slice(0, 10);
    const d = new Date(raw + "T00:00:00");
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function buildFolioHtml(
  booking: CommercialBooking,
  companyName: string = "Paimbabook Hospitality",
  currencySymbol: string = "R"
): string {
  const balance = Math.max((booking.totalAmount || 0) - (booking.amountPaid || 0), 0);
  const isSettled = balance <= 0.01;
  const statusInfo = formatStatusLabel(booking.bookingStatus);
  const cleanRoom = formatRoomDisplayName(booking.roomNumber, booking.roomType);
  const mealPlanName = formatMealPlanLabel(booking.mealPlan);
  const checkInFormatted = formatDateDisplay(booking.checkInDate);
  const checkOutFormatted = formatDateDisplay(booking.checkOutDate);
  const nights = Math.max(booking.nights || 1, 1);
  const nightlyRate = booking.ratePerNight || Math.round((booking.totalAmount || 0) / nights) || 0;
  const paymentMethodLabel = (booking.paymentMethod || "card").replace(/_/g, " ").toUpperCase();
  const paymentStatusLabel = (booking.paymentStatus || (isSettled ? "paid" : "pending")).toUpperCase();
  const issueDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const issueTime = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Proof of Check-In - ${booking.bookingCode}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 32px 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      color: #0f172a;
      background: #f8fafc;
      -webkit-font-smoothing: antialiased;
    }
    .folio-card {
      max-width: 720px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 18px;
      overflow: hidden;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08);
    }
    .folio-top-bar {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      color: #ffffff;
      padding: 24px 32px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #2563eb;
    }
    .company-name {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.5px;
      margin: 0 0 4px 0;
      color: #ffffff;
      text-transform: uppercase;
    }
    .company-sub {
      font-size: 11px;
      font-weight: 600;
      color: #94a3b8;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      margin: 0;
    }
    .ref-block {
      text-align: right;
    }
    .ref-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 1px;
      text-transform: uppercase;
      background: rgba(37, 99, 235, 0.25);
      border: 1px solid rgba(147, 197, 253, 0.4);
      color: #93c5fd;
      padding: 4px 10px;
      border-radius: 9999px;
      margin-bottom: 6px;
    }
    .ref-code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 18px;
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #ffffff;
      margin: 0;
    }
    .ref-meta {
      font-size: 11px;
      color: #94a3b8;
      margin-top: 4px;
    }
    .folio-body {
      padding: 28px 32px;
    }
    .status-banner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: ${statusInfo.bg};
      border: 1px solid ${statusInfo.color}30;
      border-radius: 12px;
      padding: 12px 18px;
      margin-bottom: 24px;
    }
    .status-banner-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .status-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: ${statusInfo.color};
      color: #ffffff;
      font-weight: 900;
      font-size: 14px;
    }
    .status-title {
      font-size: 13px;
      font-weight: 800;
      color: ${statusInfo.color};
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .status-time {
      font-size: 11px;
      font-weight: 600;
      color: #475569;
    }
    .cards-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }
    .detail-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
    }
    .card-heading {
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: #64748b;
      margin-bottom: 10px;
      padding-bottom: 6px;
      border-bottom: 1px solid #e2e8f0;
    }
    .guest-name {
      font-size: 16px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 6px 0;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      line-height: 1.6;
      color: #334155;
    }
    .info-label {
      color: #64748b;
      font-weight: 500;
    }
    .info-val {
      font-weight: 700;
      color: #0f172a;
      text-align: right;
    }
    .table-container {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 24px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    thead th {
      background: #0f172a;
      color: #ffffff;
      text-align: left;
      padding: 12px 14px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    tbody td {
      padding: 14px;
      border-bottom: 1px solid #e2e8f0;
      color: #334155;
      vertical-align: top;
    }
    .item-title {
      font-weight: 700;
      color: #0f172a;
      font-size: 13px;
      margin-bottom: 2px;
    }
    .item-sub {
      font-size: 11px;
      color: #64748b;
    }
    .summary-section {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 24px;
    }
    .summary-box {
      width: 320px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 0;
      font-size: 12px;
      color: #475569;
    }
    .summary-row.total {
      border-top: 2px solid #0f172a;
      padding-top: 10px;
      margin-top: 6px;
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
    }
    .summary-row.paid {
      color: #15803d;
      font-weight: 700;
    }
    .summary-row.balance {
      border-top: 1px dashed #cbd5e1;
      padding-top: 8px;
      margin-top: 6px;
      font-size: 13px;
      font-weight: 800;
    }
    .settled-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 800;
      color: #15803d;
      background: #dcfce7;
      border: 1px solid #86efac;
      padding: 4px 10px;
      border-radius: 8px;
    }
    .due-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 800;
      color: #b91c1c;
      background: #fee2e2;
      border: 1px solid #fca5a5;
      padding: 4px 10px;
      border-radius: 8px;
    }
    .security-stamp-box {
      display: flex;
      align-items: center;
      justify-content: space-between;
      border: 1px dashed #94a3b8;
      border-radius: 12px;
      padding: 12px 18px;
      background: #fdfdfd;
      margin-bottom: 24px;
    }
    .stamp-text-title {
      font-size: 11px;
      font-weight: 800;
      color: #1e293b;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .stamp-text-sub {
      font-size: 10px;
      color: #64748b;
      margin-top: 2px;
    }
    .stamp-badge {
      font-family: ui-monospace, monospace;
      font-size: 10px;
      font-weight: 700;
      color: #2563eb;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      padding: 4px 8px;
      border-radius: 6px;
    }
    .folio-footer {
      border-top: 1px solid #e2e8f0;
      padding: 20px 32px 24px;
      background: #f8fafc;
      text-align: center;
      font-size: 11px;
      color: #64748b;
      line-height: 1.5;
    }
    .footer-thankyou {
      font-weight: 700;
      font-size: 13px;
      color: #0f172a;
      margin: 0 0 6px 0;
    }
    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .folio-card {
        border: none;
        box-shadow: none;
        border-radius: 0;
      }
    }
  </style>
</head>
<body>
  <div class="folio-card">
    <!-- Top Header Bar -->
    <div class="folio-top-bar">
      <div>
        <h1 class="company-name">${companyName}</h1>
        <p class="company-sub">Hospitality &amp; Guest Operations • Official Guest Folio</p>
      </div>
      <div class="ref-block">
        <div class="ref-badge">Proof of Check-In</div>
        <div class="ref-code">#${booking.bookingCode}</div>
        <div class="ref-meta">Issued: ${issueDate} • ${issueTime}</div>
      </div>
    </div>

    <div class="folio-body">
      <!-- Status Banner -->
      <div class="status-banner">
        <div class="status-banner-left">
          <span class="status-icon">✓</span>
          <div>
            <div class="status-title">${statusInfo.label}</div>
            <div class="status-time">Registered into ${cleanRoom} at ${booking.propertyName || companyName}</div>
          </div>
        </div>
        <div class="status-time">
          Method: <strong>${paymentMethodLabel}</strong> • Status: <strong>${paymentStatusLabel}</strong>
        </div>
      </div>

      <!-- Guest and Stay Information Cards -->
      <div class="cards-grid">
        <!-- Guest Details -->
        <div class="detail-card">
          <div class="card-heading">Guest Information</div>
          <p class="guest-name">${booking.guestName}</p>
          <div class="info-row">
            <span class="info-label">Email:</span>
            <span class="info-val">${booking.guestEmail || "-"}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Phone:</span>
            <span class="info-val">${booking.guestPhone || "-"}</span>
          </div>
          <div class="info-row">
            <span class="info-label">ID / Passport:</span>
            <span class="info-val">${booking.guestIdNumber || "Verified"}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Checked-In By:</span>
            <span class="info-val">${booking.checkedInByName || "Front Desk Staff"}</span>
          </div>
        </div>

        <!-- Stay Details -->
        <div class="detail-card">
          <div class="card-heading">Stay &amp; Accommodation Details</div>
          <p class="guest-name" style="font-size: 14px;">${cleanRoom}</p>
          <div class="info-row">
            <span class="info-label">Property:</span>
            <span class="info-val">${booking.propertyName || companyName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Check-In:</span>
            <span class="info-val">${checkInFormatted} (from 14:00)</span>
          </div>
          <div class="info-row">
            <span class="info-label">Check-Out:</span>
            <span class="info-val">${checkOutFormatted} (by 10:00)</span>
          </div>
          <div class="info-row">
            <span class="info-label">Duration:</span>
            <span class="info-val">${nights} Night${nights > 1 ? "s" : ""}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Meal Plan:</span>
            <span class="info-val">${mealPlanName}</span>
          </div>
        </div>
      </div>

      <!-- Itemized Ledger Table -->
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th style="width: 55%;">Accommodation &amp; Services</th>
              <th style="text-align: center; width: 15%;">Nights</th>
              <th style="text-align: right; width: 15%;">Rate / Night</th>
              <th style="text-align: right; width: 15%;">Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <div class="item-title">Room Accommodation — ${cleanRoom}</div>
                <div class="item-sub">${booking.propertyName || companyName} • Meal Board: ${mealPlanName}</div>
                ${booking.notes ? `<div class="item-sub" style="margin-top: 4px; font-style: italic; color: #475569;">Notes: ${booking.notes}</div>` : ""}
              </td>
              <td style="text-align: center; font-weight: 700;">${nights}</td>
              <td style="text-align: right; font-family: monospace;">${currencySymbol}${nightlyRate.toLocaleString()}</td>
              <td style="text-align: right; font-weight: 800; font-family: monospace;">${currencySymbol}${booking.totalAmount.toLocaleString()}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Summary / Balances -->
      <div class="summary-section">
        <div class="summary-box">
          <div class="summary-row">
            <span>Total Accommodation Charges:</span>
            <strong style="font-family: monospace;">${currencySymbol}${booking.totalAmount.toLocaleString()}</strong>
          </div>
          <div class="summary-row paid">
            <span>Amount Received (${paymentMethodLabel}):</span>
            <strong style="font-family: monospace;">${currencySymbol}${booking.amountPaid.toLocaleString()}</strong>
          </div>
          <div class="summary-row balance">
            <span>Outstanding Balance:</span>
            <span>
              ${
                isSettled
                  ? `<span class="settled-badge">✓ SETTLED IN FULL (${currencySymbol}0)</span>`
                  : `<span class="due-badge">${currencySymbol}${balance.toLocaleString()} DUE</span>`
              }
            </span>
          </div>
        </div>
      </div>

      <!-- Authenticity Stamp -->
      <div class="security-stamp-box">
        <div>
          <div class="stamp-text-title">🔒 Digital Verification &amp; Security Stamp</div>
          <div class="stamp-text-sub">
            Folio Record authenticated by ${companyName} Front Desk Systems.
          </div>
        </div>
        <div class="stamp-badge">REF: ${booking.bookingCode}</div>
      </div>
    </div>

    <!-- Luxury Footer -->
    <div class="folio-footer">
      <p class="footer-thankyou">Thank you for staying with us at ${booking.propertyName || companyName}!</p>
      <p style="margin: 0 0 4px 0;">
        Standard check-out time is strictly 10:00 AM on ${checkOutFormatted}. For room extensions, concierge or assistance, dial Front Desk.
      </p>
      <p style="margin: 0; font-size: 10px; color: #94a3b8;">
        Official guest proof of check-in • Generated via Paimbabook Hospitality Operations Management Platform
      </p>
    </div>
  </div>
</body>
</html>`;
}

export interface CheckinEmailTemplates {
  ownerSubject: string;
  ownerMessage: string;
  staffSubject: string;
  staffMessage: string;
  customSubject: string;
  customMessage: string;
}

export function buildCheckinEmailTemplates(
  booking: CommercialBooking,
  companyName: string = "Paimbabook Hospitality"
): CheckinEmailTemplates {
  const cleanRoom = formatRoomDisplayName(booking.roomNumber, booking.roomType);
  const property = booking.propertyName || companyName;
  const guestName = booking.guestName || "Valued Guest";
  const nights = booking.nights || 1;
  const mealPlan = formatMealPlanLabel(booking.mealPlan);
  const checkInDate = booking.checkInDate?.slice(0, 10) || "";
  const checkOutDate = booking.checkOutDate?.slice(0, 10) || "";

  return {
    // 1. Emailed to customer:
    ownerSubject: `Your Proof of Check-In - ${property} (#${booking.bookingCode})`,
    ownerMessage: `Dear ${guestName},\n\nPlease find your official proof of check-in and booking receipt attached for your stay in ${cleanRoom} at ${property}.\n\nStay Details:\n• Check-In Date: ${checkInDate} (from 14:00)\n• Check-Out Date: ${checkOutDate} (by 10:00)\n• Duration: ${nights} Night${nights > 1 ? "s" : ""}\n• Meal Plan: ${mealPlan}\n• Booking Reference: #${booking.bookingCode}\n\nThank you for choosing ${property}. We wish you a peaceful and enjoyable stay! Please contact the front desk should you require any assistance.`,

    // 2. Emailed to internal staff member:
    staffSubject: `[Staff Record] Check-In Proof: ${guestName} - ${cleanRoom} (#${booking.bookingCode})`,
    staffMessage: `Kindly find customer ${guestName}'s check-in proof attached for ${cleanRoom} at ${property}.\n\nBooking Summary:\n• Reference: #${booking.bookingCode}\n• Guest Phone: ${booking.guestPhone || "-"}\n• Guest Email: ${booking.guestEmail || "-"}\n• Dates: ${checkInDate} to ${checkOutDate} (${nights} nights)\n• Meal Plan: ${mealPlan}\n• Total Amount: R${booking.totalAmount?.toLocaleString() || "0"} (Paid: R${booking.amountPaid?.toLocaleString() || "0"})\n• Checked-In By: ${booking.checkedInByName || "Front Desk"}`,

    // 3. Emailed to custom/external address:
    customSubject: `Proof of Check-In: ${guestName} at ${property} - #${booking.bookingCode}`,
    customMessage: `Good day,\n\nKindly find ${guestName}'s proof of check-in at ${property} attached for your reference.\n\nAccommodation Details:\n• Room: ${cleanRoom}\n• Property: ${property}\n• Stay Dates: ${checkInDate} to ${checkOutDate} (${nights} night${nights > 1 ? "s" : ""})\n• Booking Reference: #${booking.bookingCode}\n\nPlease let us know if any further details are required.`,
  };
}

