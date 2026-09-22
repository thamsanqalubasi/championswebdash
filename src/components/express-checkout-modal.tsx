import { useState, useMemo } from "react";
import {
  X,
  Search,
  LogOut,
  Clock,
  AlertTriangle,
  ArrowUpDown,
  User,
  Phone,
  Mail,
  CreditCard,
  Bed,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import type { CommercialBooking } from "@/lib/types";
import { CheckoutCountdown, getCheckoutDelta } from "./checkout-countdown";
import { checkoutCommercialBooking } from "@/lib/data";
import { CheckoutConfirmModal } from "./checkout-confirm-modal";
import { useAuth } from "@/lib/auth";

interface ExpressCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookings: CommercialBooking[];
  onCheckoutSuccess: () => void;
  onSelectBooking?: (booking: CommercialBooking) => void;
}

type FilterTab = "overstays" | "due_today" | "latest_checkins" | "all";

export function ExpressCheckoutModal({
  isOpen,
  onClose,
  bookings,
  onCheckoutSuccess,
  onSelectBooking,
}: ExpressCheckoutModalProps) {
  const { currentCompanyUser, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("overstays");
  const [sortAscending, setSortAscending] = useState(true); // true = most urgent overstay / earliest checkout first
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [confirmBooking, setConfirmBooking] = useState<CommercialBooking | null>(null);

  // Filter only in-house active stays
  const inHouseBookings = useMemo(() => {
    return bookings.filter(
      (b) => b.bookingStatus === "checked_in" || b.isExtended
    );
  }, [bookings]);

  // Compute checkout delta and categories
  const categorized = useMemo(() => {
    const overstays: CommercialBooking[] = [];
    const dueToday: CommercialBooking[] = [];
    const latestCheckins: CommercialBooking[] = [];

    const now = Date.now();
    const twentyFourHoursMs = 24 * 60 * 60 * 1000;

    inHouseBookings.forEach((b) => {
      const delta = getCheckoutDelta(b.checkOutDate);
      if (delta.diffMs <= 0) {
        overstays.push(b);
      } else if (delta.diffMs <= twentyFourHoursMs) {
        dueToday.push(b);
      } else {
        latestCheckins.push(b);
      }
    });

    return {
      overstays,
      dueToday,
      latestCheckins,
      all: inHouseBookings,
    };
  }, [inHouseBookings]);

  // Filter by Tab and Search Query
  const displayedBookings = useMemo(() => {
    let list: CommercialBooking[] = [];
    if (activeTab === "overstays") list = categorized.overstays;
    else if (activeTab === "due_today") list = categorized.dueToday;
    else if (activeTab === "latest_checkins") list = categorized.latestCheckins;
    else list = categorized.all;

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((b) => {
        const guestName = (b.guestName || "").toLowerCase();
        const code = (b.bookingCode || "").toLowerCase();
        const email = (b.guestEmail || "").toLowerCase();
        const phone = (b.guestPhone || "").toLowerCase();
        const idNum = (b.guestIdNumber || "").toLowerCase();
        const room = (b.roomNumber || "").toLowerCase();
        return (
          guestName.includes(q) ||
          code.includes(q) ||
          email.includes(q) ||
          phone.includes(q) ||
          idNum.includes(q) ||
          room.includes(q)
        );
      });
    }

    // Sort by checkout target date
    list.sort((a, b) => {
      const deltaA = getCheckoutDelta(a.checkOutDate).diffMs;
      const deltaB = getCheckoutDelta(b.checkOutDate).diffMs;
      return sortAscending ? deltaA - deltaB : deltaB - deltaA;
    });

    return list;
  }, [categorized, activeTab, searchQuery, sortAscending]);

  if (!isOpen) return null;

  const handleExecuteCheckout = (b: CommercialBooking) => {
    setConfirmBooking(b);
  };

  const handleConfirmCheckout = async (b: CommercialBooking) => {
    setProcessingId(b.id);
    setActionMessage(null);
    try {
      const actor = currentCompanyUser?.fullName || user?.email || "Front Desk";
      const ok = await checkoutCommercialBooking(b.id, actor);
      if (ok) {
        setActionMessage(`Guest ${b.guestName} was successfully checked out.`);
        setConfirmBooking(null);
        onCheckoutSuccess();
      } else {
        setActionMessage(`Could not check out ${b.guestName}. Please try again.`);
      }
    } catch (err: any) {
      setActionMessage(err.message || "Failed to process checkout.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="flex flex-col max-h-[92vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-border-color bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-color px-6 py-4 bg-surface-elevated/30">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-red-500/10 p-2.5 text-red-600 dark:text-red-400 border border-red-500/20">
              <LogOut size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-foreground">Express Checkout & Overstay Desk</h2>
                {categorized.overstays.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-black text-white animate-pulse">
                    <AlertTriangle size={12} />
                    {categorized.overstays.length} Overdue
                  </span>
                )}
              </div>
              <p className="text-xs text-muted">
                Rapidly search, monitor live stay timers, and check out in-house guests in one click.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-muted hover:bg-surface-elevated hover:text-foreground transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Action Message Banner */}
        {actionMessage && (
          <div className="mx-6 mt-4 flex items-center justify-between gap-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm text-emerald-600 dark:text-emerald-400">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} />
              <span>{actionMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setActionMessage(null)}
              className="text-xs font-semibold hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Multi-Field Search Bar */}
        <div className="p-6 pb-2 space-y-4">
          <div className="relative">
            <Search
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Booking ID (BK-...), First Name, Surname, Email, Phone, ID Number, or Room..."
              className="w-full rounded-2xl border border-border-color bg-surface-elevated pl-11 pr-4 py-3 text-sm font-medium text-foreground placeholder:text-muted focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20 transition"
              autoFocus
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted hover:text-foreground"
              >
                Clear
              </button>
            )}
          </div>

          {/* Navigation Filter Tabs & Sorting */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-color pb-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveTab("overstays")}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  activeTab === "overstays"
                    ? "bg-red-600 text-white shadow-xs"
                    : "bg-surface-elevated text-muted hover:text-foreground"
                }`}
              >
                <span>Overstays</span>
                <span
                  className={`rounded-full px-2 py-0.2 text-[11px] font-black ${
                    activeTab === "overstays"
                      ? "bg-white/20 text-white"
                      : categorized.overstays.length > 0
                      ? "bg-red-500/20 text-red-600"
                      : "bg-muted/20 text-muted"
                  }`}
                >
                  {categorized.overstays.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("due_today")}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  activeTab === "due_today"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "bg-surface-elevated text-muted hover:text-foreground"
                }`}
              >
                <span>About to Checkout (Due Today)</span>
                <span
                  className={`rounded-full px-2 py-0.2 text-[11px] font-black ${
                    activeTab === "due_today"
                      ? "bg-white/20 text-white"
                      : "bg-muted/20 text-muted"
                  }`}
                >
                  {categorized.dueToday.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("latest_checkins")}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  activeTab === "latest_checkins"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-surface-elevated text-muted hover:text-foreground"
                }`}
              >
                <span>Active In-House (Later)</span>
                <span
                  className={`rounded-full px-2 py-0.2 text-[11px] font-black ${
                    activeTab === "latest_checkins"
                      ? "bg-white/20 text-white"
                      : "bg-muted/20 text-muted"
                  }`}
                >
                  {categorized.latestCheckins.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("all")}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  activeTab === "all"
                    ? "bg-foreground text-surface shadow-xs"
                    : "bg-surface-elevated text-muted hover:text-foreground"
                }`}
              >
                <span>All In-House</span>
                <span
                  className={`rounded-full px-2 py-0.2 text-[11px] font-black ${
                    activeTab === "all"
                      ? "bg-surface text-foreground"
                      : "bg-muted/20 text-muted"
                  }`}
                >
                  {categorized.all.length}
                </span>
              </button>
            </div>

            {/* Ascending / Descending Sort Toggle */}
            <button
              type="button"
              onClick={() => setSortAscending(!sortAscending)}
              className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface-elevated px-3 py-1.5 text-xs font-bold text-muted hover:text-foreground transition"
              title="Toggle sort direction"
            >
              <ArrowUpDown size={13} />
              <span>
                {sortAscending
                  ? "Urgent / Earliest First"
                  : "Latest / Furthest First"}
              </span>
            </button>
          </div>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-3">
          {displayedBookings.length === 0 ? (
            <div className="py-16 text-center">
              <Clock size={40} className="mx-auto text-muted/40 mb-3" />
              <h3 className="text-base font-bold text-foreground">No matching bookings found</h3>
              <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
                {searchQuery
                  ? `No in-house guests matched "${searchQuery}". Try searching by surname, phone, room number, or booking code.`
                  : activeTab === "overstays"
                  ? "Great news! There are currently no guests past their checkout time."
                  : "No guests found under this filter."}
              </p>
            </div>
          ) : (
            displayedBookings.map((b) => {
              const delta = getCheckoutDelta(b.checkOutDate);
              const isOverstay = delta.isOverstay;

              return (
                <div
                  key={b.id}
                  className={`rounded-2xl border p-4 transition-all duration-200 ${
                    isOverstay
                      ? "border-red-500/40 bg-red-500/5 hover:border-red-500"
                      : "border-border-color bg-surface-elevated/40 hover:border-border-color/80"
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Guest & Room Info */}
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="font-mono text-xs font-black text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-lg">
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
                      </div>

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
                        <span>
                          Check-In: {new Date(b.checkInDate).toLocaleDateString()}
                        </span>
                        <span>
                          Check-Out: {new Date(b.checkOutDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    {/* Timer & Actions */}
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <CheckoutCountdown
                          checkOutDate={b.checkOutDate}
                          isStayActive={true}
                          compact={false}
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        {onSelectBooking && (
                          <button
                            type="button"
                            onClick={() => onSelectBooking(b)}
                            className="rounded-xl border border-border-color bg-surface px-3 py-2 text-xs font-bold text-foreground hover:bg-surface-elevated transition"
                            title="View Full Booking Folio"
                          >
                            <ExternalLink size={14} />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleExecuteCheckout(b)}
                          disabled={processingId === b.id}
                          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-md transition disabled:opacity-50 ${
                            isOverstay
                              ? "bg-red-600 hover:bg-red-700 animate-pulse"
                              : "bg-red-600 hover:bg-red-700"
                          }`}
                        >
                          <LogOut size={14} />
                          <span>
                            {processingId === b.id
                              ? "Checking Out..."
                              : "Check Out Guest"}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border-color px-6 py-3.5 bg-surface-elevated/30 text-xs text-muted">
          <span>
            Displaying <strong>{displayedBookings.length}</strong> of{" "}
            <strong>{inHouseBookings.length}</strong> in-house guests
          </span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-1.5 font-bold text-foreground hover:bg-surface-elevated transition"
          >
            Close
          </button>
        </div>
      </div>

      <CheckoutConfirmModal
        isOpen={Boolean(confirmBooking)}
        booking={confirmBooking}
        onClose={() => setConfirmBooking(null)}
        onConfirm={handleConfirmCheckout}
        isProcessing={Boolean(processingId)}
      />
    </div>
  );
}

