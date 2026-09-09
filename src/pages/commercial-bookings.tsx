import { useState, useEffect } from "react";
import {
  KeyRound,
  Search,
  Plus,
  CalendarPlus,
  LogOut,
  Calendar,
  Bed,
  Utensils,
  CheckCircle2,
  Clock,
  QrCode,
  Sparkles,
  Phone,
  Mail,
  User,
  ShieldCheck,
  Building2,
  FileText,
  Eye,
  Pencil,
} from "lucide-react";
import {
  fetchCommercialBookings,
  fetchCommercialRooms,
  checkoutCommercialBooking,
} from "@/lib/data";
import type { CommercialBooking, CommercialRoom } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { CheckinModal } from "@/components/checkin-modal";
import { ExtendBookingModal } from "@/components/extend-booking-modal";
import { CommercialBookingDetailModal } from "@/components/commercial-booking-detail-modal";
import { DocumentShareModal } from "@/components/document-share-modal";
import { downloadPdfDocument } from "@/lib/storage";

function buildFolioHtml(booking: CommercialBooking, companyName: string) {
  const balance = booking.totalAmount - booking.amountPaid;
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Guest Folio - ${booking.bookingCode}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 32px; color: #0f172a; background: #ffffff;">
  <div style="max-width: 680px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 28px;">
    <div style="border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-start;">
      <div>
        <h1 style="margin: 0 0 4px 0; font-size: 20px; font-weight: 800; color: #0f172a; text-transform: uppercase;">${companyName}</h1>
        <p style="margin: 0; font-size: 12px; color: #64748b;">Hospitality & Guest Operations</p>
      </div>
      <div style="text-align: right;">
        <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #2563eb;">Guest Folio & Receipt</div>
        <div style="font-family: monospace; font-size: 15px; font-weight: 700; color: #0f172a; margin-top: 4px;">#${booking.bookingCode}</div>
        <div style="font-size: 11px; color: #64748b; margin-top: 2px;">${new Date().toLocaleDateString()}</div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
      <div>
        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b;">Guest Details</div>
        <div style="font-size: 14px; font-weight: 700; color: #0f172a; margin-top: 4px;">${booking.guestName}</div>
        <div style="font-size: 12px; color: #475569; margin-top: 2px;">Email: ${booking.guestEmail || "-"}</div>
        <div style="font-size: 12px; color: #475569;">Phone: ${booking.guestPhone || "-"}</div>
      </div>
      <div>
        <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b;">Stay Details</div>
        <div style="font-size: 13px; font-weight: 600; color: #0f172a; margin-top: 4px;">Room: ${booking.roomNumber} (${booking.propertyName})</div>
        <div style="font-size: 12px; color: #475569; margin-top: 2px;">${booking.checkinDate} to ${booking.checkoutDate} (${booking.nights} night${booking.nights > 1 ? "s" : ""})</div>
        <div style="font-size: 12px; color: #475569;">Meal Board: ${booking.mealPlan.replace(/_/g, " ")} | Status: ${booking.status}</div>
      </div>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
      <thead>
        <tr style="background: #0f172a; color: #ffffff; text-align: left;">
          <th style="padding: 10px 12px;">Description</th>
          <th style="padding: 10px 12px; text-align: center;">Nights</th>
          <th style="padding: 10px 12px; text-align: right;">Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px 12px;">Room Accommodation (${booking.propertyName} - Room ${booking.roomNumber})</td>
          <td style="padding: 10px 12px; text-align: center;">${booking.nights}</td>
          <td style="padding: 10px 12px; text-align: right; font-weight: 600;">R${booking.totalAmount.toLocaleString()}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr>
          <td colspan="2" style="padding: 8px 12px; text-align: right; font-weight: 600; color: #64748b;">Total Charges:</td>
          <td style="padding: 8px 12px; text-align: right; font-weight: 700; color: #0f172a;">R${booking.totalAmount.toLocaleString()}</td>
        </tr>
        <tr>
          <td colspan="2" style="padding: 6px 12px; text-align: right; font-weight: 600; color: #16a34a;">Amount Paid:</td>
          <td style="padding: 6px 12px; text-align: right; font-weight: 700; color: #16a34a;">R${booking.amountPaid.toLocaleString()}</td>
        </tr>
        <tr style="border-top: 2px solid #0f172a;">
          <td colspan="2" style="padding: 10px 12px; text-align: right; font-weight: 800; color: #0f172a; font-size: 14px;">Balance:</td>
          <td style="padding: 10px 12px; text-align: right; font-weight: 800; color: ${balance > 0 ? "#dc2626" : "#16a34a"}; font-size: 14px;">R${balance.toLocaleString()}</td>
        </tr>
      </tfoot>
    </table>

    <div style="border-top: 1px dashed #cbd5e1; padding-top: 16px; font-size: 11px; color: #64748b; text-align: center;">
      <p style="margin: 0 0 4px 0;">Thank you for staying with us at ${companyName}!</p>
      <p style="margin: 0;">For inquiries or assistance, please reach out to our front desk.</p>
    </div>
  </div>
</body>
</html>`;
}

export default function CommercialBookingsPage() {
  const { currentCompany, currentCompanyUser } = useAuth();
  const [bookings, setBookings] = useState<CommercialBooking[]>([]);
  const [rooms, setRooms] = useState<CommercialRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Modals state
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [extendModalBooking, setExtendModalBooking] = useState<CommercialBooking | null>(null);
  const [folioBooking, setFolioBooking] = useState<CommercialBooking | null>(null);
  const [detailModalBooking, setDetailModalBooking] = useState<CommercialBooking | null>(null);
  const [shareModalDoc, setShareModalDoc] = useState<{
    isOpen: boolean;
    documentTitle: string;
    documentType?: string;
    documentHtml?: string;
    documentUrl?: string;
    fileNameBase?: string;
    ownerName?: string;
    ownerEmail?: string;
    defaultSubject?: string;
    defaultMessage?: string;
  }>({
    isOpen: false,
    documentTitle: "",
  });

  const loadData = async () => {
    setLoading(true);
    const [bks, rms] = await Promise.all([
      fetchCommercialBookings(currentCompany.id),
      fetchCommercialRooms(currentCompany.id),
    ]);
    setBookings(bks);
    setRooms(rms);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [currentCompany.id]);

  const handleCheckout = async (booking: CommercialBooking) => {
    if (
      window.confirm(
        `Are you sure you want to check out ${booking.guestName} from ${booking.roomNumber}? This will mark the room as 'Cleaning Needed' for housekeeping.`
      )
    ) {
      await checkoutCommercialBooking(booking.id, currentCompanyUser.fullName);
      loadData();
    }
  };

  const filteredBookings = bookings.filter((b) => {
    const matchesSearch =
      b.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.bookingCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (b.roomNumber && b.roomNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      b.guestPhone.includes(searchQuery);

    const matchesStatus =
      statusFilter === "all" || b.bookingStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const activeCheckedIn = bookings.filter((b) => b.bookingStatus === "checked_in" || b.bookingStatus === "extended").length;
  const occupiedRooms = rooms.filter((r) => r.status === "occupied").length;
  const cleaningNeededRooms = rooms.filter((r) => r.status === "cleaning_needed").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Front Desk & Hospitality Bookings
          </h1>
          <p className="text-sm text-muted">
            Manage guest check-ins, extensions, departures, and instant booking codes for {currentCompany.name}.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setCheckinOpen(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition"
        >
          <KeyRound size={18} />
          <span>New Guest Check-In</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-muted">Active In-House Guests</p>
          <p className="mt-2 text-2xl font-black text-blue-600">{activeCheckedIn}</p>
          <p className="mt-1 text-[11px] text-muted">Across all commercial rooms</p>
        </div>

        <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-muted">Occupied Rooms</p>
          <p className="mt-2 text-2xl font-black text-foreground">{occupiedRooms} / {rooms.length}</p>
          <p className="mt-1 text-[11px] text-muted">Current occupancy rate</p>
        </div>

        <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-muted">Cleaning / Turnover Needed</p>
          <p className="mt-2 text-2xl font-black text-amber-600">{cleaningNeededRooms}</p>
          <p className="mt-1 text-[11px] text-muted">Pending housekeeping</p>
        </div>

        <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-muted">Total Available Rooms</p>
          <p className="mt-2 text-2xl font-black text-emerald-600">
            {rooms.filter((r) => r.status === "available").length}
          </p>
          <p className="mt-1 text-[11px] text-muted">Ready for walk-in check-in</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border-color bg-surface p-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            placeholder="Search by Guest Name, Booking Code (e.g. BK-...), Room # or Phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-border-color bg-surface-elevated pl-9 pr-4 py-2 text-sm text-foreground outline-none focus:border-blue-600"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs font-semibold text-foreground focus:border-blue-600 focus:outline-none"
          >
            <option value="all">All Bookings</option>
            <option value="checked_in">Checked In</option>
            <option value="extended">Stay Extended</option>
            <option value="confirmed">Confirmed / Upcoming</option>
            <option value="checked_out">Checked Out</option>
          </select>
        </div>
      </div>

      {/* Bookings List Table */}
      <div className="overflow-hidden rounded-2xl border border-border-color bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-color bg-surface-elevated/70 text-[11px] font-bold uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3.5">Booking Code</th>
                <th className="px-4 py-3.5">Guest Details</th>
                <th className="px-4 py-3.5">Room & Property</th>
                <th className="px-4 py-3.5">Stay Dates & Package</th>
                <th className="px-4 py-3.5">Financials</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Front Desk Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color text-foreground">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted">
                    Loading commercial bookings...
                  </td>
                </tr>
              ) : filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted">
                    No bookings found matching your search.
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b) => {
                  const isStayActive = b.bookingStatus === "checked_in" || b.bookingStatus === "extended";
                  return (
                    <tr
                      key={b.id}
                      onClick={() => setDetailModalBooking(b)}
                      className="hover:bg-surface-elevated/70 transition cursor-pointer group"
                    >
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-extrabold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-md group-hover:bg-blue-600 group-hover:text-white transition">
                            {b.bookingCode}
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] text-muted">
                          By {b.checkedInByName || "Front Desk"}
                        </p>
                      </td>

                      <td className="px-4 py-3.5">
                        <p className="font-bold text-foreground group-hover:text-blue-600 transition">{b.guestName}</p>
                        <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                          <Phone size={12} />
                          <span>{b.guestPhone}</span>
                        </div>
                        <p className="text-[10px] text-muted">ID: {b.guestIdNumber}</p>
                      </td>

                      <td className="px-4 py-3.5">
                        <p className="font-bold text-foreground">
                          {b.roomNumber} ({b.roomType})
                        </p>
                        <p className="text-xs text-muted truncate max-w-[180px]">
                          {b.propertyName}
                        </p>
                      </td>

                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5 text-xs text-foreground">
                          <Calendar size={13} className="text-muted" />
                          <span>
                            {new Date(b.checkInDate).toLocaleDateString()} →{" "}
                            {new Date(b.checkOutDate).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
                          <Utensils size={12} />
                          <span className="capitalize">{b.mealPlan.replace(/_/g, " ")} ({b.nights}n)</span>
                        </div>
                      </td>

                      <td className="px-4 py-3.5">
                        <p className="font-extrabold text-foreground">
                          R{b.totalAmount.toLocaleString()}
                        </p>
                        <p className="text-[11px] text-muted">
                          Paid: R{b.amountPaid.toLocaleString()} ({b.paymentMethod})
                        </p>
                        <span
                          className={`inline-block mt-0.5 text-[10px] font-bold uppercase ${
                            b.paymentStatus === "paid" ? "text-emerald-600" : "text-amber-600"
                          }`}
                        >
                          {b.paymentStatus}
                        </span>
                      </td>

                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                            b.bookingStatus === "checked_in"
                              ? "bg-blue-500/10 text-blue-600"
                              : b.bookingStatus === "extended"
                              ? "bg-purple-500/10 text-purple-600"
                              : b.bookingStatus === "checked_out"
                              ? "bg-muted/10 text-muted"
                              : "bg-emerald-500/10 text-emerald-600"
                          }`}
                        >
                          {b.bookingStatus === "extended" ? "Extended Stay" : b.bookingStatus.replace("_", " ")}
                        </span>
                      </td>

                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetailModalBooking(b);
                            }}
                            className="flex items-center gap-1 rounded-lg border border-border-color bg-surface-elevated px-2 py-1 text-xs text-muted hover:text-blue-600 hover:border-blue-500/40 transition"
                            title="View & Edit Booking Details"
                          >
                            <Eye size={13} />
                            <span className="hidden sm:inline">Details</span>
                          </button>

                          {isStayActive && (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExtendModalBooking(b);
                                }}
                                className="flex items-center gap-1 rounded-lg border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-xs font-semibold text-purple-600 hover:bg-purple-500/20"
                                title="Extend Stay"
                              >
                                <CalendarPlus size={13} />
                                <span>Extend</span>
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCheckout(b);
                                }}
                                className="flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-500/20"
                                title="Check Out Guest"
                              >
                                <LogOut size={13} />
                                <span>Check Out</span>
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setFolioBooking(b);
                            }}
                            className="rounded-lg border border-border-color bg-surface-elevated px-2 py-1 text-xs text-muted hover:text-foreground"
                            title="View Folio / Receipt"
                          >
                            <FileText size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Booking Details & Edit Modal */}
      <CommercialBookingDetailModal
        isOpen={Boolean(detailModalBooking)}
        booking={detailModalBooking}
        rooms={rooms}
        onClose={() => setDetailModalBooking(null)}
        onSuccess={loadData}
      />

      {/* Checkin Modal */}
      <CheckinModal
        isOpen={checkinOpen}
        onClose={() => setCheckinOpen(false)}
        onSuccess={loadData}
      />

      {/* Extend Booking Modal */}
      <ExtendBookingModal
        isOpen={Boolean(extendModalBooking)}
        booking={extendModalBooking}
        onClose={() => setExtendModalBooking(null)}
        onSuccess={loadData}
      />

      {/* Folio / Guest Bill Modal */}
      {folioBooking && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border-color bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-color pb-3">
              <div>
                <p className="text-xs font-bold text-blue-600 uppercase">Guest Folio & Receipt</p>
                <h3 className="text-lg font-bold text-foreground">{folioBooking.guestName}</h3>
              </div>
              <button
                onClick={() => setFolioBooking(null)}
                className="rounded-lg p-1.5 text-muted hover:bg-surface-elevated"
              >
                Close
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-border-color">
                <span className="text-muted">Booking Reference:</span>
                <span className="font-mono font-bold text-foreground">{folioBooking.bookingCode}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border-color">
                <span className="text-muted">Room & Property:</span>
                <span className="font-semibold text-foreground">{folioBooking.roomNumber} ({folioBooking.propertyName})</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border-color">
                <span className="text-muted">Stay Duration:</span>
                <span className="font-semibold text-foreground">{folioBooking.nights} Night(s)</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border-color">
                <span className="text-muted">Meal Board:</span>
                <span className="font-semibold text-foreground capitalize">{folioBooking.mealPlan.replace(/_/g, " ")}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border-color">
                <span className="text-muted">Total Charges:</span>
                <span className="font-bold text-foreground">R{folioBooking.totalAmount.toLocaleString()}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-border-color">
                <span className="text-muted">Amount Paid:</span>
                <span className="font-bold text-emerald-600">R{folioBooking.amountPaid.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const html = buildFolioHtml(folioBooking, currentCompany?.name || "Champions Court");
                  downloadPdfDocument(html, `folio-${folioBooking.bookingCode}`);
                }}
                className="rounded-xl border border-border-color px-4 py-2 text-xs font-bold text-foreground hover:bg-surface-elevated transition-all"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => {
                  const html = buildFolioHtml(folioBooking, currentCompany?.name || "Champions Court");
                  setShareModalDoc({
                    isOpen: true,
                    documentTitle: `Guest Folio & Receipt - #${folioBooking.bookingCode} (${folioBooking.guestName})`,
                    documentType: "Receipt",
                    documentHtml: html,
                    fileNameBase: `receipt-${folioBooking.bookingCode}-${folioBooking.guestName.replace(/\s+/g, "_")}`,
                    ownerName: folioBooking.guestName,
                    ownerEmail: folioBooking.guestEmail || "",
                    defaultSubject: `Folio Receipt #${folioBooking.bookingCode} - ${currentCompany?.name || "Champions Court"}`,
                    defaultMessage: `Dear ${folioBooking.guestName},\n\nPlease find attached your official guest folio and payment receipt for your stay in Room ${folioBooking.roomNumber}.`,
                  });
                }}
                className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-sky-700 transition-all"
              >
                Email / Share
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition-all"
              >
                Print
              </button>
            </div>
          </div>
        </div>
      )}

      <DocumentShareModal
        isOpen={shareModalDoc.isOpen}
        onClose={() => setShareModalDoc((prev) => ({ ...prev, isOpen: false }))}
        documentTitle={shareModalDoc.documentTitle}
        documentType={shareModalDoc.documentType}
        documentHtml={shareModalDoc.documentHtml}
        documentUrl={shareModalDoc.documentUrl}
        fileNameBase={shareModalDoc.fileNameBase}
        ownerName={shareModalDoc.ownerName}
        ownerEmail={shareModalDoc.ownerEmail}
        defaultSubject={shareModalDoc.defaultSubject}
        defaultMessage={shareModalDoc.defaultMessage}
      />
    </div>
  );
}

