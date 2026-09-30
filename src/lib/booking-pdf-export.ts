import type { CommercialBooking } from "@/lib/types";

export function openBookingPdfInNewTab(
  booking: CommercialBooking,
  companyName: string = "Paimbabook Hospitality",
  currencySymbol: string = "R"
) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to view and download the booking PDF.");
    return;
  }

  const nights = Math.max(booking.nights || 1, 1);
  const nightlyRate = booking.ratePerNight || Math.round((booking.totalAmount || 0) / nights) || 0;
  const totalAmount = booking.totalAmount || 0;
  const amountPaid = booking.amountPaid || 0;
  const balance = Math.max(totalAmount - amountPaid, 0);
  const isPaid = balance <= 0.01;
  const statusUpper = (booking.bookingStatus || "confirmed").toUpperCase().replace(/_/g, " ");

  const checkInDate = booking.checkInDate ? new Date(booking.checkInDate.slice(0, 10)).toLocaleDateString("en-US", {
    weekday: "short", year: "numeric", month: "short", day: "numeric"
  }) : "-";

  const checkOutDate = booking.checkOutDate ? new Date(booking.checkOutDate.slice(0, 10)).toLocaleDateString("en-US", {
    weekday: "short", year: "numeric", month: "short", day: "numeric"
  }) : "-";

  const issuedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric"
  });

  const mealPlanLabel = (booking.mealPlan || "room_only").replace(/_/g, " ").toUpperCase();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Booking Folio - ${booking.bookingCode} - ${booking.guestName}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f1f5f9;
      color: #0f172a;
      padding: 30px 16px;
      -webkit-font-smoothing: antialiased;
    }
    .toolbar {
      max-width: 800px;
      margin: 0 auto 20px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
      padding: 12px 20px;
      border-radius: 12px;
      border: 1px solid #cbd5e1;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      border: none;
      transition: all 0.2s;
    }
    .btn-primary {
      background: #2563eb;
      color: #ffffff;
    }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-secondary {
      background: #f8fafc;
      color: #475569;
      border: 1px solid #cbd5e1;
    }
    .btn-secondary:hover { background: #e2e8f0; }
    .doc-page {
      max-width: 800px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      border: 1px solid #cbd5e1;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08);
      overflow: hidden;
      padding: 40px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 24px;
      margin-bottom: 28px;
    }
    .company-title {
      font-size: 24px;
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.5px;
      text-transform: uppercase;
    }
    .company-sub {
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      margin-top: 3px;
    }
    .voucher-badge {
      text-align: right;
    }
    .voucher-title {
      font-size: 18px;
      font-weight: 800;
      color: #2563eb;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .voucher-code {
      font-family: monospace;
      font-size: 16px;
      font-weight: 800;
      background: #eff6ff;
      color: #1d4ed8;
      padding: 4px 10px;
      border-radius: 6px;
      display: inline-block;
      margin-top: 6px;
      border: 1px solid #bfdbfe;
    }
    .meta-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 28px;
    }
    .meta-col h3 {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748b;
      margin-bottom: 12px;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      margin-bottom: 8px;
    }
    .meta-label { color: #64748b; font-weight: 500; }
    .meta-val { color: #0f172a; font-weight: 700; text-align: right; }
    .status-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .status-confirmed { background: #dbeafe; color: #1e40af; }
    .status-checked-in { background: #dcfce7; color: #166534; }
    .status-reserved { background: #f3e8ff; color: #6b21a8; }
    .table-container { margin-bottom: 28px; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th {
      background: #f1f5f9;
      color: #475569;
      font-weight: 700;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
      padding: 10px 12px;
      border-top: 1px solid #cbd5e1;
      border-bottom: 1px solid #cbd5e1;
      text-align: left;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e2e8f0;
      color: #1e293b;
    }
    .financial-totals {
      margin-left: auto;
      max-width: 320px;
      border-top: 2px solid #0f172a;
      padding-top: 12px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 6px 0;
      font-size: 13px;
    }
    .total-row.grand {
      font-size: 16px;
      font-weight: 900;
      border-top: 1px solid #cbd5e1;
      padding-top: 8px;
      margin-top: 4px;
    }
    .paid-seal {
      margin-top: 12px;
      background: #dcfce7;
      color: #15803d;
      border: 1px dashed #16a34a;
      border-radius: 8px;
      padding: 8px 12px;
      font-weight: 800;
      font-size: 12px;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .due-seal {
      margin-top: 12px;
      background: #fee2e2;
      color: #b91c1c;
      border: 1px dashed #dc2626;
      border-radius: 8px;
      padding: 8px 12px;
      font-weight: 800;
      font-size: 12px;
      text-align: center;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .policies {
      margin-top: 30px;
      border-top: 1px solid #e2e8f0;
      padding-top: 18px;
      font-size: 11px;
      color: #64748b;
      line-height: 1.5;
    }
    .footer-signatures {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 30px;
      margin-top: 36px;
      padding-top: 20px;
      border-top: 1px dashed #cbd5e1;
    }
    .sig-line {
      border-top: 1px solid #94a3b8;
      margin-top: 40px;
      padding-top: 6px;
      font-size: 11px;
      color: #64748b;
      text-align: center;
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .toolbar { display: none !important; }
      .doc-page { border: none; box-shadow: none; padding: 0; max-width: 100%; border-radius: 0; }
      @page { margin: 15mm; size: A4; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div style="font-size: 13px; font-weight: 600; color: #475569;">
      Booking Folio Preview: <strong>#${booking.bookingCode}</strong>
    </div>
    <div style="display: flex; gap: 8px;">
      <button class="btn btn-secondary" onclick="window.close()">Close Window</button>
      <button class="btn btn-primary" onclick="window.print()">Print / Save as PDF</button>
    </div>
  </div>

  <div class="doc-page">
    <div class="header">
      <div>
        <h1 class="company-title">${companyName}</h1>
        <p class="company-sub">Hospitality &amp; Property Management Suite</p>
        <p class="company-sub">Document Generated: ${issuedDate}</p>
      </div>
      <div class="voucher-badge">
        <div class="voucher-title">Official Booking Folio</div>
        <div class="voucher-code">#${booking.bookingCode}</div>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-col">
        <h3>Guest &amp; Reservation Details</h3>
        <div class="meta-row">
          <span class="meta-label">Guest Name:</span>
          <span class="meta-val">${booking.guestName}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Contact Phone:</span>
          <span class="meta-val">${booking.guestPhone || "N/A"}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Email Address:</span>
          <span class="meta-val">${booking.guestEmail || "N/A"}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">ID / Passport #:</span>
          <span class="meta-val">${booking.guestIdNumber || "N/A"}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Booking Status:</span>
          <span class="meta-val">
            <span class="status-badge ${booking.bookingStatus === 'checked_in' ? 'status-checked-in' : (booking.bookingStatus as string) === 'reserved' ? 'status-reserved' : 'status-confirmed'}">
              ${statusUpper}
            </span>
          </span>
        </div>
      </div>

      <div class="meta-col">
        <h3>Accommodation &amp; Stay Info</h3>
        <div class="meta-row">
          <span class="meta-label">Property:</span>
          <span class="meta-val">${booking.propertyName || "Safari Lodge"}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Room Number:</span>
          <span class="meta-val">Room ${booking.roomNumber} (${booking.roomType})</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Check-In Date:</span>
          <span class="meta-val">${checkInDate}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Check-Out Date:</span>
          <span class="meta-val">${checkOutDate}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Duration of Stay:</span>
          <span class="meta-val">${nights} Night${nights > 1 ? "s" : ""}</span>
        </div>
        <div class="meta-row">
          <span class="meta-label">Meal Plan:</span>
          <span class="meta-val">${mealPlanLabel}</span>
        </div>
      </div>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Description &amp; Charges</th>
            <th style="text-align: center;">Nights</th>
            <th style="text-align: right;">Rate / Night</th>
            <th style="text-align: right;">Total Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>Room Lodging (${(booking.roomType || 'standard').toUpperCase()})</strong><br/>
              <span style="font-size: 11px; color: #64748b;">Room ${booking.roomNumber} • ${mealPlanLabel}</span>
            </td>
            <td style="text-align: center;">${nights}</td>
            <td style="text-align: right;">${currencySymbol}${nightlyRate.toLocaleString()}</td>
            <td style="text-align: right; font-weight: 700;">${currencySymbol}${totalAmount.toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 16px;">
      <div style="max-width: 380px;">
        <p style="font-size: 12px; font-weight: 700; color: #475569; margin-bottom: 4px;">Payment Method:</p>
        <p style="font-size: 13px; color: #0f172a; text-transform: uppercase; font-weight: 800;">
          ${booking.paymentMethod || "Card Terminal"} (${booking.paymentStatus || (isPaid ? "PAID" : "PARTIAL")})
        </p>
        ${booking.notes ? `
          <div style="margin-top: 10px; font-size: 11px; color: #64748b; background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
            <strong>Audit Notes:</strong> ${booking.notes}
          </div>
        ` : ""}
      </div>

      <div class="financial-totals">
        <div class="total-row">
          <span style="color: #64748b;">Subtotal Charges:</span>
          <span style="font-weight: 700;">${currencySymbol}${totalAmount.toLocaleString()}</span>
        </div>
        <div class="total-row">
          <span style="color: #64748b;">Total Amount Billed:</span>
          <span style="font-weight: 700;">${currencySymbol}${totalAmount.toLocaleString()}</span>
        </div>
        <div class="total-row">
          <span style="color: #16a34a;">Amount Paid / Deposit:</span>
          <span style="font-weight: 800; color: #16a34a;">-${currencySymbol}${amountPaid.toLocaleString()}</span>
        </div>
        <div class="total-row grand">
          <span>Outstanding Balance:</span>
          <span style="color: ${balance > 0 ? '#b91c1c' : '#15803d'};">
            ${currencySymbol}${balance.toLocaleString()}
          </span>
        </div>

        ${isPaid ? `
          <div class="paid-seal">
            &#10003; Full Payment Verified &amp; Settled
          </div>
        ` : `
          <div class="due-seal">
            Balance Due at Front Desk: ${currencySymbol}${balance.toLocaleString()}
          </div>
        `}
      </div>
    </div>

    <div class="policies">
      <p><strong>Check-In Policy:</strong> Standard check-in time is 14:00. Check-out time is strictly 10:00 AM on departure date. Overstay past checkout is subject to automatic late fee billing.</p>
      <p style="margin-top: 4px;"><strong>House Rules:</strong> Smoking is prohibited inside all rooms. Key cards must be returned upon express checkout.</p>
    </div>

    <div class="footer-signatures">
      <div>
        <div class="sig-line">Guest Signature: <strong>${booking.guestName}</strong></div>
      </div>
      <div>
        <div class="sig-line">Front Desk Officer: <strong>${booking.checkedInByName || "Authorized Staff"}</strong></div>
      </div>
    </div>
  </div>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

export function openMultiBookingPdfInNewTab(
  bookings: CommercialBooking[],
  companyName: string = "Paimbabook Hospitality",
  currencySymbol: string = "R",
  reportTitle: string = "Bookings & Reservations Ledger",
  periodLabel: string = "Selected Timeframe"
) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to view and download the ledger PDF.");
    return;
  }

  let totalNights = 0;
  let totalBilled = 0;
  let totalPaid = 0;

  bookings.forEach((b) => {
    const n = Math.max(b.nights || 1, 1);
    totalNights += n;
    totalBilled += b.totalAmount || 0;
    totalPaid += b.amountPaid || 0;
  });

  const totalBalance = Math.max(totalBilled - totalPaid, 0);
  const issuedDate = new Date().toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });

  const rowsHtml = bookings.map((b) => {
    const nights = Math.max(b.nights || 1, 1);
    const balance = Math.max((b.totalAmount || 0) - (b.amountPaid || 0), 0);
    const checkIn = b.checkInDate ? b.checkInDate.slice(0, 10) : "-";
    const checkOut = b.checkOutDate ? b.checkOutDate.slice(0, 10) : "-";
    const isReserved = (b.bookingStatus as string) === "reserved";

    return `
      <tr>
        <td style="font-family: monospace; font-weight: 800; color: #2563eb;">#${b.bookingCode}</td>
        <td>
          <strong>${b.guestName}</strong><br/>
          <span style="font-size: 11px; color: #64748b;">${b.guestPhone || "No Phone"}</span>
        </td>
        <td>
          Room ${b.roomNumber}<br/>
          <span style="font-size: 11px; color: #64748b;">${b.propertyName} (${b.roomType})</span>
        </td>
        <td style="font-size: 12px;">
          ${checkIn} &rarr; ${checkOut}<br/>
          <span style="color: #64748b; font-weight: 600;">${nights} Night${nights > 1 ? "s" : ""}</span>
        </td>
        <td style="font-size: 11px; text-transform: uppercase; font-weight: 600;">
          ${(b.mealPlan || "room_only").replace(/_/g, " ")}
        </td>
        <td style="text-align: right; font-weight: 700;">${currencySymbol}${(b.totalAmount || 0).toLocaleString()}</td>
        <td style="text-align: right; color: #16a34a; font-weight: 700;">${currencySymbol}${(b.amountPaid || 0).toLocaleString()}</td>
        <td style="text-align: right; color: ${balance > 0 ? '#dc2626' : '#16a34a'}; font-weight: 800;">${currencySymbol}${balance.toLocaleString()}</td>
        <td style="text-align: center;">
          <span style="display: inline-block; padding: 2px 7px; border-radius: 4px; font-size: 10px; font-weight: 800; text-transform: uppercase; background: ${isReserved ? '#f3e8ff; color: #6b21a8;' : b.bookingStatus === 'checked_in' ? '#dcfce7; color: #15803d;' : '#dbeafe; color: #1d4ed8;'}">
            ${(b.bookingStatus || "active").replace(/_/g, " ")}
          </span>
        </td>
      </tr>
    `;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${reportTitle} - ${companyName}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: #f1f5f9;
      color: #0f172a;
      padding: 30px 16px;
      -webkit-font-smoothing: antialiased;
    }
    .toolbar {
      max-width: 1000px;
      margin: 0 auto 20px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #ffffff;
      padding: 12px 20px;
      border-radius: 12px;
      border: 1px solid #cbd5e1;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      border: none;
    }
    .btn-primary { background: #2563eb; color: #ffffff; }
    .btn-primary:hover { background: #1d4ed8; }
    .btn-secondary { background: #f8fafc; color: #475569; border: 1px solid #cbd5e1; }
    .btn-secondary:hover { background: #e2e8f0; }
    .doc-page {
      max-width: 1000px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 16px;
      border: 1px solid #cbd5e1;
      box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.08);
      overflow: hidden;
      padding: 36px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #2563eb;
      padding-bottom: 20px;
      margin-bottom: 24px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 12px;
      margin-bottom: 24px;
    }
    .kpi-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 12px;
    }
    .kpi-label { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; }
    .kpi-val { font-size: 18px; font-weight: 900; margin-top: 4px; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th {
      background: #f1f5f9;
      color: #475569;
      font-weight: 800;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.5px;
      padding: 10px 8px;
      border-top: 1px solid #cbd5e1;
      border-bottom: 1px solid #cbd5e1;
      text-align: left;
    }
    td { padding: 10px 8px; border-bottom: 1px solid #e2e8f0; color: #1e293b; }
    tr:nth-child(even) { background: #fafafa; }
    .table-totals {
      background: #f8fafc;
      font-weight: 900;
      border-top: 2px solid #0f172a;
    }
    @media print {
      body { background: #ffffff; padding: 0; }
      .toolbar { display: none !important; }
      .doc-page { border: none; box-shadow: none; padding: 0; max-width: 100%; border-radius: 0; }
      @page { margin: 12mm; size: landscape; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <div style="font-size: 13px; font-weight: 600; color: #475569;">
      <strong>${reportTitle}</strong> &bull; ${bookings.length} Record${bookings.length > 1 ? "s" : ""}
    </div>
    <div style="display: flex; gap: 8px;">
      <button class="btn btn-secondary" onclick="window.close()">Close</button>
      <button class="btn btn-primary" onclick="window.print()">Print / Save PDF</button>
    </div>
  </div>

  <div class="doc-page">
    <div class="header">
      <div>
        <h1 style="font-size: 22px; font-weight: 900; color: #0f172a; text-transform: uppercase;">${companyName}</h1>
        <p style="font-size: 12px; color: #64748b; font-weight: 600; margin-top: 2px;">Front Desk Operational &amp; Hospitality Records</p>
        <p style="font-size: 11px; color: #94a3b8; margin-top: 2px;">Generated: ${issuedDate}</p>
      </div>
      <div style="text-align: right;">
        <h2 style="font-size: 16px; font-weight: 800; color: #2563eb; text-transform: uppercase;">${reportTitle}</h2>
        <p style="font-size: 12px; font-weight: 700; color: #475569; margin-top: 4px;">Period: ${periodLabel}</p>
      </div>
    </div>

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">Total Bookings</div>
        <div class="kpi-val">${bookings.length}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Stay Nights</div>
        <div class="kpi-val">${totalNights}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Billed</div>
        <div class="kpi-val">${currencySymbol}${totalBilled.toLocaleString()}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Collected</div>
        <div class="kpi-val" style="color: #16a34a;">${currencySymbol}${totalPaid.toLocaleString()}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Total Balance Due</div>
        <div class="kpi-val" style="color: ${totalBalance > 0 ? '#dc2626' : '#15803d'};">${currencySymbol}${totalBalance.toLocaleString()}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Code</th>
          <th>Guest Details</th>
          <th>Property &amp; Room</th>
          <th>Stay Dates</th>
          <th>Meal Plan</th>
          <th style="text-align: right;">Billed</th>
          <th style="text-align: right;">Paid</th>
          <th style="text-align: right;">Balance</th>
          <th style="text-align: center;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="table-totals">
          <td colspan="5" style="padding: 12px 8px;">TOTALS (${bookings.length} RECORDS &bull; ${totalNights} NIGHTS)</td>
          <td style="text-align: right; padding: 12px 8px;">${currencySymbol}${totalBilled.toLocaleString()}</td>
          <td style="text-align: right; color: #16a34a; padding: 12px 8px;">${currencySymbol}${totalPaid.toLocaleString()}</td>
          <td style="text-align: right; color: ${totalBalance > 0 ? '#dc2626' : '#15803d'}; padding: 12px 8px;">${currencySymbol}${totalBalance.toLocaleString()}</td>
          <td></td>
        </tr>
      </tbody>
    </table>

    <div style="margin-top: 30px; border-top: 1px dashed #cbd5e1; padding-top: 16px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b;">
      <span>Official System Ledger &bull; Paimbabook Hospitality Suite</span>
      <span>Confidential Operational Export</span>
    </div>
  </div>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
