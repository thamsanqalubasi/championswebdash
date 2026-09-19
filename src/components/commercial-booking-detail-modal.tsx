import { useState, useEffect } from "react";
import {
  X,
  User,
  Phone,
  Mail,
  CreditCard,
  Calendar,
  Bed,
  Utensils,
  CheckCircle2,
  AlertCircle,
  Clock,
  Pencil,
  Save,
  RotateCcw,
  FileText,
  ShieldCheck,
  Building2,
  ArrowRight,
  Receipt,
  Sparkles,
  Download,
  KeyRound,
} from "lucide-react";
import { DocumentShareModal } from "@/components/document-share-modal";
import { downloadPdfDocument } from "@/lib/storage";
import { updateCommercialBooking, checkinCommercialBooking } from "@/lib/data";
import type {
  CommercialBooking,
  CommercialRoom,
  MealPlan,
  BookingStatus,
} from "@/lib/types";
import { useAuth } from "@/lib/auth";
import {
  buildFolioHtml,
  buildCheckinEmailTemplates,
} from "@/lib/booking-folio";

interface CommercialBookingDetailModalProps {
  isOpen: boolean;
  booking: CommercialBooking | null;
  rooms: CommercialRoom[];
  onClose: () => void;
  onSuccess?: () => void;
}

export function CommercialBookingDetailModal({
  isOpen,
  booking,
  rooms,
  onClose,
  onSuccess,
}: CommercialBookingDetailModalProps) {
  const { currentCompany, currentCompanyUser, user } = useAuth();
  const [isEditMode, setIsEditMode] = useState(false);

  // Form edit states
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestIdNumber, setGuestIdNumber] = useState("");
  const [roomId, setRoomId] = useState("");
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [mealPlan, setMealPlan] = useState<MealPlan>("room_only");
  const [nights, setNights] = useState(1);
  const [ratePerNight, setRatePerNight] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [amountPaid, setAmountPaid] = useState(0);
  const [depositAmount, setDepositAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [paymentStatus, setPaymentStatus] = useState<
    "pending" | "partial" | "paid" | "refunded"
  >("pending");
  const [bookingStatus, setBookingStatus] = useState<BookingStatus>("confirmed");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
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
    emailTemplates?: any;
  }>({
    isOpen: false,
    documentTitle: "",
  });

  const currencyCode = currentCompany?.currency || "ZAR";

  // Sync state with selected booking whenever booking changes
  useEffect(() => {
    if (booking) {
      setGuestName(booking.guestName || "");
      setGuestPhone(booking.guestPhone || "");
      setGuestEmail(booking.guestEmail || "");
      setGuestIdNumber(booking.guestIdNumber || "");
      setRoomId(booking.roomId || "");
      setCheckInDate(booking.checkInDate ? booking.checkInDate.slice(0, 10) : "");
      setCheckOutDate(booking.checkOutDate ? booking.checkOutDate.slice(0, 10) : "");
      setMealPlan(booking.mealPlan || "room_only");
      setNights(booking.nights || 1);
      setRatePerNight(booking.ratePerNight || 0);
      setTotalAmount(booking.totalAmount || 0);
      setAmountPaid(booking.amountPaid || 0);
      setDepositAmount(booking.depositAmount || 0);
      setPaymentMethod(booking.paymentMethod || "card");
      setPaymentStatus(booking.paymentStatus || "pending");
      setBookingStatus(booking.bookingStatus || "confirmed");
      setNotes(booking.notes || "");
      setIsEditMode(false);
      setErrorMsg("");
      setSuccessMsg("");
    }
  }, [booking, isOpen]);

  // Recalculate nights and total when dates or rate change during edit
  const handleDatesChange = (newIn: string, newOut: string) => {
    setCheckInDate(newIn);
    setCheckOutDate(newOut);
    if (newIn && newOut) {
      const d1 = new Date(newIn);
      const d2 = new Date(newOut);
      const diffTime = d2.getTime() - d1.getTime();
      const diffDays = Math.max(Math.ceil(diffTime / (1000 * 60 * 60 * 24)), 1);
      setNights(diffDays);
      setTotalAmount(diffDays * ratePerNight);
    }
  };

  const handleRateChange = (newRate: number) => {
    setRatePerNight(newRate);
    setTotalAmount(nights * newRate);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!booking) return;

    if (!guestName.trim()) {
      setErrorMsg("Guest full name is required.");
      return;
    }
    if (!guestPhone.trim()) {
      setErrorMsg("Guest phone number is required.");
      return;
    }
    if (!roomId) {
      setErrorMsg("Please assign a room.");
      return;
    }

    setSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const updated = await updateCommercialBooking(booking.id, {
        guestName,
        guestPhone,
        guestEmail,
        guestIdNumber,
        roomId,
        checkInDate,
        checkOutDate,
        mealPlan,
        nights,
        ratePerNight,
        totalAmount,
        amountPaid,
        depositAmount,
        paymentMethod,
        paymentStatus,
        bookingStatus,
        notes,
      });

      if (updated) {
        setSuccessMsg("Booking details successfully updated!");
        setIsEditMode(false);
        if (onSuccess) onSuccess();
      } else {
        setErrorMsg("Failed to update booking. Please try again.");
      }
    } catch (err: any) {
      setErrorMsg(err?.message || "An unexpected error occurred while saving.");
    } finally {
      setSaving(false);
    }
  };

  const [checkingIn, setCheckingIn] = useState(false);
  const handleCheckInNow = async () => {
    if (!booking) return;
    setCheckingIn(true);
    setErrorMsg("");
    try {
      await checkinCommercialBooking(booking.id, currentCompanyUser?.fullName || "Front Desk");
      setSuccessMsg(`Guest ${booking.guestName} has been checked in successfully!`);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err?.message || "Failed to check in guest.");
    } finally {
      setCheckingIn(false);
    }
  };

  if (!isOpen || !booking) return null;

  const currentRoom = rooms.find((r) => r.id === (isEditMode ? roomId : booking.roomId));
  const remainingBalance = Math.max(
    (isEditMode ? totalAmount : booking.totalAmount) -
      (isEditMode ? amountPaid : booking.amountPaid),
    0
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-border-color bg-surface p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border-color pb-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-sm font-extrabold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-3 py-1 rounded-lg">
                {booking.bookingCode}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                  booking.bookingStatus === "checked_in"
                    ? "bg-blue-500/15 text-blue-600"
                    : booking.bookingStatus === "extended"
                    ? "bg-purple-500/15 text-purple-600"
                    : booking.bookingStatus === "checked_out"
                    ? "bg-gray-500/15 text-gray-600 dark:text-gray-400"
                    : booking.bookingStatus === "cancelled"
                    ? "bg-red-500/15 text-red-600"
                    : "bg-emerald-500/15 text-emerald-600"
                }`}
              >
                {booking.bookingStatus.replace(/_/g, " ")}
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
                  booking.paymentStatus === "paid"
                    ? "bg-emerald-500/15 text-emerald-600"
                    : booking.paymentStatus === "partial"
                    ? "bg-amber-500/15 text-amber-600"
                    : booking.paymentStatus === "refunded"
                    ? "bg-red-500/15 text-red-600"
                    : "bg-orange-500/15 text-orange-600"
                }`}
              >
                {booking.paymentStatus}
              </span>
            </div>
            <h2 className="mt-2 text-xl font-black text-foreground">
              {isEditMode ? `Edit Booking: ${booking.guestName}` : `Guest Booking: ${booking.guestName}`}
            </h2>
            <p className="text-xs text-muted">
              {booking.propertyName || currentCompany?.name} • Created{" "}
              {new Date(booking.createdAt).toLocaleDateString()}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!isEditMode && (booking.bookingStatus === "confirmed" || (booking.bookingStatus as string) === "pending") && (
              <button
                type="button"
                onClick={handleCheckInNow}
                disabled={checkingIn}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-500/20 transition shadow-xs disabled:opacity-50"
                title="Check In Guest Now"
              >
                <KeyRound size={14} />
                <span>{checkingIn ? "Checking In..." : "Check In Guest"}</span>
              </button>
            )}

            {!isEditMode ? (
              <button
                type="button"
                onClick={() => setIsEditMode(true)}
                className="flex items-center gap-1.5 rounded-xl border border-blue-600/30 bg-blue-500/10 px-3.5 py-2 text-xs font-bold text-blue-600 hover:bg-blue-500/20 transition"
              >
                <Pencil size={14} />
                <span>Edit Booking</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsEditMode(false)}
                className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface-elevated px-3.5 py-2 text-xs font-bold text-muted hover:text-foreground transition"
              >
                <RotateCcw size={14} />
                <span>Cancel Edit</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-muted hover:bg-surface-elevated hover:text-foreground transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-600">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-sm text-emerald-600">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* VIEW MODE */}
        {!isEditMode ? (
          <div className="space-y-6">
            {/* Grid 1: Guest & Room Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Guest Details Card */}
              <div className="rounded-2xl border border-border-color bg-surface-elevated/40 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted tracking-wider">
                  <User size={14} className="text-blue-600" />
                  <span>Guest Details</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-xs text-muted block">Full Name</span>
                    <span className="font-bold text-foreground text-base">{booking.guestName}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <span className="text-xs text-muted block">Phone</span>
                      <a
                        href={`tel:${booking.guestPhone}`}
                        className="font-medium text-blue-600 hover:underline inline-flex items-center gap-1"
                      >
                        <Phone size={12} />
                        {booking.guestPhone}
                      </a>
                    </div>
                    <div>
                      <span className="text-xs text-muted block">National ID / Passport</span>
                      <span className="font-semibold text-foreground font-mono">
                        {booking.guestIdNumber || "N/A"}
                      </span>
                    </div>
                  </div>
                  {booking.guestEmail && (
                    <div className="pt-1">
                      <span className="text-xs text-muted block">Email Address</span>
                      <a
                        href={`mailto:${booking.guestEmail}`}
                        className="font-medium text-blue-600 hover:underline inline-flex items-center gap-1"
                      >
                        <Mail size={12} />
                        {booking.guestEmail}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Room & Stay Details Card */}
              <div className="rounded-2xl border border-border-color bg-surface-elevated/40 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted tracking-wider">
                  <Bed size={14} className="text-blue-600" />
                  <span>Room & Stay Package</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs text-muted block">Assigned Room</span>
                      <span className="font-bold text-foreground text-base">
                        Room {booking.roomNumber || (currentRoom?.roomNumber ?? "N/A")}
                      </span>
                      <span className="text-xs text-muted block capitalize">
                        {booking.roomType || (currentRoom?.roomType ?? "Standard Room")} • Floor{" "}
                        {currentRoom?.floor || "1"}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-muted block">Meal Plan</span>
                      <span className="inline-flex items-center gap-1 font-semibold text-emerald-600 capitalize">
                        <Utensils size={12} />
                        {booking.mealPlan.replace(/_/g, " ")}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border-color/60">
                    <div>
                      <span className="text-xs text-muted block">Check-In</span>
                      <span className="font-semibold text-foreground">
                        {new Date(booking.checkInDate).toLocaleDateString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-muted block">Check-Out</span>
                      <span className="font-semibold text-foreground">
                        {new Date(booking.checkOutDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  <div className="pt-1 flex justify-between text-xs text-muted">
                    <span>Duration: <strong className="text-foreground">{booking.nights} night(s)</strong></span>
                    {booking.checkedInByName && (
                      <span>Checked In By: <strong className="text-foreground">{booking.checkedInByName}</strong></span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Financial Breakdown Card */}
            <div className="rounded-2xl border border-border-color bg-surface-elevated/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted tracking-wider">
                  <Receipt size={14} className="text-emerald-600" />
                  <span>Billing & Payment Breakdown</span>
                </div>
                <div className="text-xs font-semibold text-muted">
                  Method: <span className="uppercase text-foreground font-bold">{booking.paymentMethod}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                <div className="rounded-xl border border-border-color bg-surface p-3">
                  <span className="text-[11px] font-semibold text-muted block">Rate / Night</span>
                  <span className="text-base font-bold text-foreground">
                    {currencyCode} {booking.ratePerNight.toLocaleString()}
                  </span>
                </div>

                <div className="rounded-xl border border-border-color bg-surface p-3">
                  <span className="text-[11px] font-semibold text-muted block">Total Charges</span>
                  <span className="text-base font-extrabold text-foreground">
                    {currencyCode} {booking.totalAmount.toLocaleString()}
                  </span>
                </div>

                <div className="rounded-xl border border-border-color bg-surface p-3">
                  <span className="text-[11px] font-semibold text-muted block">Amount Paid</span>
                  <span className="text-base font-extrabold text-emerald-600">
                    {currencyCode} {booking.amountPaid.toLocaleString()}
                  </span>
                </div>

                <div className="rounded-xl border border-border-color bg-surface p-3">
                  <span className="text-[11px] font-semibold text-muted block">Balance Remaining</span>
                  <span
                    className={`text-base font-extrabold ${
                      remainingBalance > 0 ? "text-amber-600" : "text-emerald-600"
                    }`}
                  >
                    {currencyCode} {remainingBalance.toLocaleString()}
                  </span>
                </div>
              </div>

              {booking.depositAmount > 0 && (
                <p className="text-xs text-muted pt-1">
                  Security Deposit Recorded: {currencyCode} {booking.depositAmount.toLocaleString()}
                </p>
              )}
            </div>

            {/* Extension History (if any) */}
            {booking.extensionHistory && booking.extensionHistory.length > 0 && (
              <div className="rounded-2xl border border-border-color bg-surface-elevated/40 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted tracking-wider">
                  <Clock size={14} className="text-purple-600" />
                  <span>Stay Extension History ({booking.extensionHistory.length})</span>
                </div>
                <div className="space-y-2">
                  {booking.extensionHistory.map((ext, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-xl border border-border-color bg-surface p-3 text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2 font-semibold text-foreground">
                          <span>{ext.previousCheckOutDate}</span>
                          <ArrowRight size={12} className="text-muted" />
                          <span className="text-purple-600">{ext.newCheckOutDate}</span>
                          <span className="rounded-md bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-600">
                            +{ext.additionalNights} Night(s)
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted">
                          Extended by {ext.extendedBy} on {new Date(ext.extendedAt).toLocaleDateString()}
                          {ext.notes ? ` • Note: ${ext.notes}` : ""}
                        </p>
                      </div>
                      <div className="text-right font-bold text-foreground">
                        +{currencyCode} {ext.additionalCost.toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {booking.notes && (
              <div className="rounded-2xl border border-border-color bg-surface-elevated/40 p-4 space-y-1.5">
                <span className="text-xs font-bold uppercase text-muted tracking-wider block">
                  Front Desk Notes & Special Requests
                </span>
                <p className="text-sm text-foreground italic bg-surface p-3 rounded-xl border border-border-color">
                  "{booking.notes}"
                </p>
              </div>
            )}

            {/* View Mode Footer Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-color pt-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (!booking) return;
                    const companyName = currentCompany?.name || "Paimbabook";
                    const html = buildFolioHtml(booking, companyName, "R");
                    downloadPdfDocument(html, `checkin-proof-${booking.bookingCode}`);
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs font-bold text-foreground hover:bg-surface-elevated/80 transition"
                >
                  <Download size={14} />
                  <span>Download PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!booking) return;
                    const companyName = currentCompany?.name || "Paimbabook";
                    const html = buildFolioHtml(booking, companyName, "R");
                    const templates = buildCheckinEmailTemplates(booking, companyName);
                    setShareModalDoc({
                      isOpen: true,
                      documentTitle: `Proof of Check-In - #${booking.bookingCode} (${booking.guestName})`,
                      documentType: "checkin",
                      documentHtml: html,
                      fileNameBase: `checkin-proof-${booking.bookingCode}-${booking.guestName.replace(/\s+/g, "_")}`,
                      ownerName: booking.guestName,
                      ownerEmail: booking.guestEmail || "",
                      defaultSubject: templates.ownerSubject,
                      defaultMessage: templates.ownerMessage,
                      emailTemplates: templates,
                    });
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white shadow-md hover:bg-sky-700 transition"
                >
                  <Mail size={14} />
                  <span>Email / Share</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs font-bold text-foreground hover:bg-surface-elevated/80 transition"
                >
                  <FileText size={14} />
                  <span>Print</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                {!isEditMode && (booking.bookingStatus === "confirmed" || (booking.bookingStatus as string) === "pending") && (
                  <button
                    type="button"
                    onClick={handleCheckInNow}
                    disabled={checkingIn}
                    className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition disabled:opacity-50"
                  >
                    <KeyRound size={14} />
                    <span>{checkingIn ? "Checking In..." : "Check In Guest"}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setIsEditMode(true)}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition"
                >
                  <Pencil size={14} />
                  <span>Edit Guest & Booking Details</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* EDIT MODE FORM */
          <form onSubmit={handleSave} className="space-y-6">
            {/* Section 1: Guest Information */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-2">
                <User size={14} />
                <span>Guest Information</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">
                    Guest Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground focus:border-blue-600 focus:outline-none"
                    placeholder="e.g. John Doe"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="text"
                    required
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground focus:border-blue-600 focus:outline-none"
                    placeholder="e.g. +27 82 123 4567"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground focus:border-blue-600 focus:outline-none"
                    placeholder="e.g. guest@example.com"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">
                    ID / Passport Number
                  </label>
                  <input
                    type="text"
                    value={guestIdNumber}
                    onChange={(e) => setGuestIdNumber(e.target.value)}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground focus:border-blue-600 focus:outline-none"
                    placeholder="e.g. 9001015000080"
                  />
                </div>
              </div>
            </div>

            {/* Section 2: Room & Dates */}
            <div className="space-y-3 pt-3 border-t border-border-color">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-2">
                <Bed size={14} />
                <span>Room Assignment & Stay Dates</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-muted block mb-1">
                    Assigned Room *
                  </label>
                  <select
                    value={roomId}
                    onChange={(e) => {
                      const newRmId = e.target.value;
                      setRoomId(newRmId);
                      const targetRm = rooms.find((r) => r.id === newRmId);
                      if (targetRm && targetRm.pricePerNight) {
                        handleRateChange(targetRm.pricePerNight);
                      }
                    }}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground focus:border-blue-600 focus:outline-none"
                  >
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        Room {r.roomNumber} - {r.roomType.toUpperCase()} (Floor {r.floor} •{" "}
                        {r.propertyName || "Property"}) [{r.status}]
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">
                    Check-In Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={checkInDate}
                    onChange={(e) => handleDatesChange(e.target.value, checkOutDate)}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">
                    Check-Out Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={checkOutDate}
                    onChange={(e) => handleDatesChange(checkInDate, e.target.value)}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">
                    Meal Plan Board
                  </label>
                  <select
                    value={mealPlan}
                    onChange={(e) => setMealPlan(e.target.value as MealPlan)}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground focus:border-blue-600 focus:outline-none"
                  >
                    <option value="room_only">Room Only (No Meals)</option>
                    <option value="bed_breakfast">Bed & Breakfast (B&B)</option>
                    <option value="bed_lunch">Bed & Lunch</option>
                    <option value="full_board">Full Board (Breakfast, Lunch & Dinner)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">
                    Booking Status
                  </label>
                  <select
                    value={bookingStatus}
                    onChange={(e) => setBookingStatus(e.target.value as BookingStatus)}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-sm font-semibold text-foreground focus:border-blue-600 focus:outline-none"
                  >
                    <option value="confirmed">Confirmed (Upcoming)</option>
                    <option value="checked_in">Checked In (Active In-House)</option>
                    <option value="extended">Stay Extended</option>
                    <option value="checked_out">Checked Out (Departed)</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 3: Financials & Payment */}
            <div className="space-y-3 pt-3 border-t border-border-color">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-600 flex items-center gap-2">
                <Receipt size={14} />
                <span>Financials & Payment Breakdown</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">
                    Rate per Night ({currencyCode})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={ratePerNight}
                    onChange={(e) => handleRateChange(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">
                    Total Amount ({currencyCode})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={totalAmount}
                    onChange={(e) => setTotalAmount(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-sm font-bold text-foreground focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">
                    Amount Paid ({currencyCode})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amountPaid}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value) || 0;
                      setAmountPaid(val);
                      if (val >= totalAmount && totalAmount > 0) {
                        setPaymentStatus("paid");
                      } else if (val > 0) {
                        setPaymentStatus("partial");
                      }
                    }}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-sm font-bold text-emerald-600 focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">
                    Deposit Amount ({currencyCode})
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(parseFloat(e.target.value) || 0)}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground focus:border-blue-600 focus:outline-none"
                  >
                    <option value="card">Card (POS Terminal)</option>
                    <option value="cash">Cash</option>
                    <option value="eft">EFT / Bank Transfer</option>
                    <option value="online">Online Payment</option>
                    <option value="company_account">Company Account</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted block mb-1">
                    Payment Status
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={(e) =>
                      setPaymentStatus(
                        e.target.value as "pending" | "partial" | "paid" | "refunded"
                      )
                    }
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-sm font-semibold text-foreground focus:border-blue-600 focus:outline-none"
                  >
                    <option value="paid">Paid in Full</option>
                    <option value="partial">Partially Paid</option>
                    <option value="pending">Pending Payment</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Section 4: Notes */}
            <div className="space-y-2 pt-3 border-t border-border-color">
              <label className="text-xs font-semibold text-muted block">
                Front Desk Notes & Special Requests
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any special requests, arrival notes, or corporate billing remarks..."
                className="w-full rounded-xl border border-border-color bg-surface-elevated p-3 text-sm text-foreground focus:border-blue-600 focus:outline-none"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 border-t border-border-color pt-4">
              <button
                type="button"
                onClick={() => setIsEditMode(false)}
                className="rounded-xl border border-border-color bg-surface-elevated px-5 py-2.5 text-sm font-semibold text-muted hover:text-foreground transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 transition"
              >
                <Save size={16} />
                <span>{saving ? "Saving Changes..." : "Save Changes"}</span>
              </button>
            </div>
          </form>
        )}
      </div>

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
        emailTemplates={shareModalDoc.emailTemplates}
      />
    </div>
  );
}

