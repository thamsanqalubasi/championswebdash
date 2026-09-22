import { useState, useMemo } from "react";
import {
  X,
  Search,
  Calendar,
  Clock,
  Download,
  Filter,
  LogOut,
  User,
  Phone,
  Mail,
  Bed,
  CreditCard,
  FileText,
  DollarSign,
  TrendingUp,
  Hash,
  ArrowUpDown,
  Building,
  CheckCircle2,
} from "lucide-react";
import type { CommercialBooking } from "@/lib/types";

interface CheckoutHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookings: CommercialBooking[];
  onSelectBooking?: (booking: CommercialBooking) => void;
  currency?: string;
}

type PeriodPreset =
  | "1d"
  | "2d"
  | "1w"
  | "2w"
  | "3w"
  | "1m"
  | "2m"
  | "3m"
  | "5m"
  | "6m"
  | "1y"
  | "2y"
  | "3y"
  | "all"
  | "custom";

const PERIOD_PRESETS: { id: PeriodPreset; label: string; days?: number }[] = [
  { id: "1d", label: "Today / 24h", days: 1 },
  { id: "2d", label: "Past 2 Days", days: 2 },
  { id: "1w", label: "Past 1 Week", days: 7 },
  { id: "2w", label: "Past 2 Weeks", days: 14 },
  { id: "3w", label: "Past 3 Weeks", days: 21 },
  { id: "1m", label: "Past 1 Month", days: 30 },
  { id: "2m", label: "Past 2 Months", days: 60 },
  { id: "3m", label: "Past 3 Months", days: 90 },
  { id: "5m", label: "Past 5 Months", days: 150 },
  { id: "6m", label: "Past 6 Months", days: 180 },
  { id: "1y", label: "Past 1 Year", days: 365 },
  { id: "2y", label: "Past 2 Years", days: 730 },
  { id: "3y", label: "Past 3 Years", days: 1095 },
  { id: "all", label: "All Time" },
  { id: "custom", label: "Custom Range..." },
];

export function CheckoutHistoryModal({
  isOpen,
  onClose,
  bookings,
  onSelectBooking,
  currency = "ZAR",
}: CheckoutHistoryModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodPreset>("all");
  const [customStartDate, setCustomStartDate] = useState("");
  const [customEndDate, setCustomEndDate] = useState("");
  const [sortDescending, setSortDescending] = useState(true); // true = newest checkout first

  // Base list: only checked-out bookings
  const allCheckedOut = useMemo(() => {
    return bookings.filter(
      (b) => b.bookingStatus === "checked_out" || Boolean(b.actualCheckOut)
    );
  }, [bookings]);

  // Filter by Timeframe / Period
  const periodFiltered = useMemo(() => {
    const now = Date.now();

    if (selectedPeriod === "all") {
      return allCheckedOut;
    }

    if (selectedPeriod === "custom") {
      if (!customStartDate && !customEndDate) return allCheckedOut;
      const startMs = customStartDate ? new Date(customStartDate).getTime() : 0;
      const endMs = customEndDate
        ? new Date(customEndDate).getTime() + 24 * 60 * 60 * 1000 - 1
        : Infinity;

      return allCheckedOut.filter((b) => {
        const t = new Date(b.actualCheckOut || b.checkOutDate).getTime();
        return t >= startMs && t <= endMs;
      });
    }

    const preset = PERIOD_PRESETS.find((p) => p.id === selectedPeriod);
    if (!preset || !preset.days) return allCheckedOut;

    const windowMs = preset.days * 24 * 60 * 60 * 1000;
    const thresholdMs = now - windowMs;

    return allCheckedOut.filter((b) => {
      const t = new Date(b.actualCheckOut || b.checkOutDate).getTime();
      return t >= thresholdMs;
    });
  }, [allCheckedOut, selectedPeriod, customStartDate, customEndDate]);

  // Filter by Search Query (Name, Email, Phone, ID, Booking Code, Date, Date and Time)
  const displayedCheckouts = useMemo(() => {
    let list = [...periodFiltered];
    const q = searchQuery.trim().toLowerCase();

    if (q) {
      list = list.filter((b) => {
        const guestName = (b.guestName || "").toLowerCase();
        const code = (b.bookingCode || "").toLowerCase();
        const email = (b.guestEmail || "").toLowerCase();
        const phone = (b.guestPhone || "").toLowerCase();
        const idNum = (b.guestIdNumber || "").toLowerCase();
        const room = (b.roomNumber || "").toLowerCase();
        const prop = (b.propertyName || "").toLowerCase();
        const staff = (b.checkedOutByName || "").toLowerCase();

        // Check date and time text formats
        const coIso = b.actualCheckOut || b.checkOutDate || "";
        const coDateObj = coIso ? new Date(coIso) : null;
        let dateMatches = false;
        if (coDateObj) {
          const dateStr = coDateObj.toLocaleDateString().toLowerCase();
          const timeStr = coDateObj.toLocaleTimeString().toLowerCase();
          const fullStr = `${dateStr} ${timeStr}`;
          const isoPart = coIso.toLowerCase();
          dateMatches =
            dateStr.includes(q) ||
            timeStr.includes(q) ||
            fullStr.includes(q) ||
            isoPart.includes(q);
        }

        return (
          guestName.includes(q) ||
          code.includes(q) ||
          email.includes(q) ||
          phone.includes(q) ||
          idNum.includes(q) ||
          room.includes(q) ||
          prop.includes(q) ||
          staff.includes(q) ||
          dateMatches
        );
      });
    }

    // Sort by checkout timestamp
    list.sort((a, b) => {
      const timeA = new Date(a.actualCheckOut || a.checkOutDate).getTime();
      const timeB = new Date(b.actualCheckOut || b.checkOutDate).getTime();
      return sortDescending ? timeB - timeA : timeA - timeB;
    });

    return list;
  }, [periodFiltered, searchQuery, sortDescending]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalCount = displayedCheckouts.length;
    const totalRevenue = displayedCheckouts.reduce(
      (sum, b) => sum + (b.totalAmount || 0),
      0
    );
    const totalNights = displayedCheckouts.reduce(
      (sum, b) => sum + (b.nights || 1),
      0
    );
    const avgNights =
      totalCount > 0 ? (totalNights / totalCount).toFixed(1) : "0";

    return { totalCount, totalRevenue, avgNights };
  }, [displayedCheckouts]);

  // Export CSV handler
  const handleExportCSV = () => {
    if (displayedCheckouts.length === 0) return;

    const headers = [
      "Booking Reference",
      "Guest Full Name",
      "Guest Phone",
      "Guest Email",
      "National ID / Passport",
      "Property Name",
      "Room Number",
      "Room Type",
      "Check-In Date",
      "Check-Out Date",
      "Actual Checkout Timestamp",
      "Nights",
      "Meal Plan",
      "Total Amount (ZAR)",
      "Amount Paid (ZAR)",
      "Payment Method",
      "Payment Status",
      "Checked Out By",
    ];

    const rows = displayedCheckouts.map((b) => [
      `"${b.bookingCode}"`,
      `"${b.guestName}"`,
      `"${b.guestPhone}"`,
      `"${b.guestEmail || ""}"`,
      `"${b.guestIdNumber || ""}"`,
      `"${b.propertyName || ""}"`,
      `"${b.roomNumber || ""}"`,
      `"${b.roomType || ""}"`,
      `"${new Date(b.checkInDate).toLocaleDateString()}"`,
      `"${new Date(b.checkOutDate).toLocaleDateString()}"`,
      `"${b.actualCheckOut ? new Date(b.actualCheckOut).toLocaleString() : ""}"`,
      b.nights || 1,
      `"${b.mealPlan || ""}"`,
      b.totalAmount || 0,
      b.amountPaid || 0,
      `"${b.paymentMethod || ""}"`,
      `"${b.paymentStatus || ""}"`,
      `"${b.checkedOutByName || ""}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `Checkout_History_${selectedPeriod}_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-3 sm:p-5 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex flex-col h-[94vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-border-color bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-border-color px-6 py-4 bg-surface-elevated/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-emerald-500/10 p-2.5 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <Clock size={24} />
              </div>
              <div>
                <h2 className="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
                  <span>Guest Checkout History</span>
                  <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-black text-emerald-600">
                    {displayedCheckouts.length} Departures
                  </span>
                </h2>
                <p className="text-xs text-muted">
                  Historical departures log, stay folios, payment records, and timestamp audits.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCSV}
                disabled={displayedCheckouts.length === 0}
                className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface px-3 py-2 text-xs font-bold text-foreground hover:bg-surface-elevated transition shadow-xs disabled:opacity-40"
                title="Export filtered records to CSV"
              >
                <Download size={14} />
                <span className="hidden sm:inline">Export CSV</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-muted hover:bg-surface-elevated hover:text-foreground transition"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-border-color bg-surface p-3 shadow-xs">
              <span className="text-[11px] font-semibold text-muted flex items-center gap-1">
                <Hash size={13} className="text-blue-500" /> Total Checkouts
              </span>
              <p className="mt-1 text-xl font-black text-foreground">
                {metrics.totalCount}
              </p>
            </div>

            <div className="rounded-2xl border border-border-color bg-surface p-3 shadow-xs">
              <span className="text-[11px] font-semibold text-muted flex items-center gap-1">
                <DollarSign size={13} className="text-emerald-500" /> Total Folio Revenue
              </span>
              <p className="mt-1 text-xl font-black text-emerald-600 dark:text-emerald-400">
                {currency} {metrics.totalRevenue.toLocaleString()}
              </p>
            </div>

            <div className="rounded-2xl border border-border-color bg-surface p-3 shadow-xs">
              <span className="text-[11px] font-semibold text-muted flex items-center gap-1">
                <TrendingUp size={13} className="text-purple-500" /> Average Stay Length
              </span>
              <p className="mt-1 text-xl font-black text-foreground">
                {metrics.avgNights} Nights
              </p>
            </div>

            <div className="rounded-2xl border border-border-color bg-surface p-3 shadow-xs">
              <span className="text-[11px] font-semibold text-muted flex items-center gap-1">
                <Building size={13} className="text-amber-500" /> Active Filter Window
              </span>
              <p className="mt-1 text-sm font-black text-amber-600 truncate">
                {PERIOD_PRESETS.find((p) => p.id === selectedPeriod)?.label || "Custom"}
              </p>
            </div>
          </div>

          {/* Search & Period Selector Controls */}
          <div className="space-y-2.5">
            {/* Unified Search Input */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by Guest Name, Email, Phone, ID, Booking Code (BK-...), Date, Time, Room #..."
                  className="w-full rounded-2xl border border-border-color bg-surface pl-10 pr-4 py-2 text-xs font-medium text-foreground outline-none focus:border-blue-600 shadow-xs"
                />
              </div>

              {/* Period Preset Dropdown */}
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <span className="text-xs font-bold text-muted flex items-center gap-1 whitespace-nowrap">
                  <Calendar size={13} /> Timeframe:
                </span>
                <select
                  value={selectedPeriod}
                  onChange={(e) => setSelectedPeriod(e.target.value as PeriodPreset)}
                  className="rounded-xl border border-border-color bg-surface px-3 py-2 text-xs font-bold text-foreground focus:border-blue-600 focus:outline-none shadow-xs"
                >
                  {PERIOD_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setSortDescending(!sortDescending)}
                  className="flex items-center gap-1 rounded-xl border border-border-color bg-surface px-3 py-2 text-xs font-bold text-muted hover:text-foreground transition shadow-xs whitespace-nowrap"
                  title="Toggle sort direction"
                >
                  <ArrowUpDown size={13} />
                  <span>{sortDescending ? "Newest First" : "Oldest First"}</span>
                </button>
              </div>
            </div>

            {/* Custom Date & Time Range Pickers */}
            {selectedPeriod === "custom" && (
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-blue-500/30 bg-blue-500/5 p-3 text-xs">
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  Custom Date Range:
                </span>
                <div className="flex items-center gap-2">
                  <label className="text-muted font-medium">From:</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="rounded-xl border border-border-color bg-surface px-2.5 py-1 text-foreground focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-muted font-medium">To:</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="rounded-xl border border-border-color bg-surface px-2.5 py-1 text-foreground focus:outline-none"
                  />
                </div>
                {(customStartDate || customEndDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomStartDate("");
                      setCustomEndDate("");
                    }}
                    className="text-[11px] font-bold text-muted hover:text-foreground underline ml-auto"
                  >
                    Clear Dates
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Content Body / List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {displayedCheckouts.length === 0 ? (
            <div className="py-20 text-center">
              <Clock size={44} className="mx-auto text-muted/30 mb-3" />
              <h3 className="text-base font-bold text-foreground">
                No checkout records found
              </h3>
              <p className="text-xs text-muted mt-1 max-w-md mx-auto">
                {searchQuery
                  ? `No checkouts matched "${searchQuery}". Try searching by surname, phone number, booking code, or date.`
                  : "No checkouts were recorded in the selected timeframe."}
              </p>
              {selectedPeriod !== "all" && (
                <button
                  type="button"
                  onClick={() => setSelectedPeriod("all")}
                  className="mt-4 rounded-xl border border-border-color bg-surface px-4 py-2 text-xs font-bold text-blue-600 hover:bg-surface-elevated transition"
                >
                  View All Time Checkouts
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {displayedCheckouts.map((b) => {
                const checkoutTimestamp = b.actualCheckOut || b.checkOutDate;
                const coDate = new Date(checkoutTimestamp);
                const formattedDate = coDate.toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                });
                const formattedTime = coDate.toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                });

                return (
                  <div
                    key={b.id}
                    className="group rounded-2xl border border-border-color bg-surface p-4 transition-all duration-150 hover:border-blue-500/50 hover:bg-surface-elevated/40"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Departure Timestamp + Guest Details */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-mono text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-lg">
                            {b.bookingCode}
                          </span>
                          <h4 className="text-base font-black text-foreground">
                            {b.guestName}
                          </h4>
                          <span className="inline-flex items-center gap-1 rounded-lg bg-surface-elevated border border-border-color px-2 py-0.5 text-xs font-bold text-foreground">
                            <Bed size={12} className="text-muted" />
                            Room {b.roomNumber || "N/A"}
                            {b.roomType && (
                              <span className="text-muted text-[11px] capitalize">
                                ({b.roomType})
                              </span>
                            )}
                          </span>
                          <span className="rounded-full bg-slate-500/10 border border-slate-500/20 px-2 py-0.5 text-[10px] font-black text-muted uppercase">
                            Checked Out
                          </span>
                        </div>

                        {/* Guest Contact & Identification */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                          {b.guestPhone && (
                            <span className="inline-flex items-center gap-1">
                              <Phone size={12} />
                              {b.guestPhone}
                            </span>
                          )}
                          {b.guestEmail && (
                            <span className="inline-flex items-center gap-1">
                              <Mail size={12} />
                              {b.guestEmail}
                            </span>
                          )}
                          {b.guestIdNumber && (
                            <span className="font-mono text-[11px]">
                              ID: {b.guestIdNumber}
                            </span>
                          )}
                          <span className="text-muted/80">
                            Property: <strong>{b.propertyName || "Lodge"}</strong>
                          </span>
                        </div>

                        {/* Stay Dates */}
                        <div className="flex flex-wrap items-center gap-x-3 text-xs text-muted">
                          <span>
                            Stay:{" "}
                            <strong>
                              {new Date(b.checkInDate).toLocaleDateString()} →{" "}
                              {new Date(b.checkOutDate).toLocaleDateString()}
                            </strong>{" "}
                            ({b.nights || 1} nights, {b.mealPlan.replace(/_/g, " ")})
                          </span>
                        </div>
                      </div>

                      {/* Middle: Departure Timestamp & Staff */}
                      <div className="lg:text-right space-y-1 shrink-0 rounded-xl bg-surface-elevated/60 p-3 lg:p-0 lg:bg-transparent">
                        <div className="flex items-center lg:justify-end gap-1.5 text-xs font-black text-foreground">
                          <Clock size={14} className="text-emerald-500" />
                          <span>
                            {formattedDate} at {formattedTime}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted">
                          Checked out by:{" "}
                          <strong className="text-foreground">
                            {b.checkedOutByName || b.checkedInByName || "Front Desk"}
                          </strong>
                        </p>
                      </div>

                      {/* Right: Financials & Action Buttons */}
                      <div className="flex items-center justify-between lg:justify-end gap-4 shrink-0 pt-2 lg:pt-0 border-t border-border-color lg:border-t-0">
                        <div className="text-right">
                          <p className="text-sm font-black text-foreground">
                            {currency} {(b.totalAmount || 0).toLocaleString()}
                          </p>
                          <span className="text-[11px] text-muted capitalize">
                            Paid via {b.paymentMethod || "card"}
                          </span>
                        </div>

                        {onSelectBooking && (
                          <button
                            type="button"
                            onClick={() => onSelectBooking(b)}
                            className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface px-3 py-2 text-xs font-bold text-foreground hover:bg-surface-elevated transition shadow-xs"
                            title="View Full Booking Folio"
                          >
                            <FileText size={14} />
                            <span>View Folio</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border-color px-6 py-3.5 bg-surface-elevated/30 text-xs text-muted">
          <span>
            Showing <strong>{displayedCheckouts.length}</strong> of{" "}
            <strong>{allCheckedOut.length}</strong> historical checkouts
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border-color bg-surface px-4 py-1.5 font-bold text-foreground hover:bg-surface-elevated transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

