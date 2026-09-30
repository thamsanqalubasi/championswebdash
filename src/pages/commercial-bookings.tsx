import { useState, useEffect, useMemo } from "react";
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
  History,
  MessageSquare,
  UserCheck,
  CalendarRange,
  Copy,
  ChevronDown,
  ChevronUp,
  X,
  Send,
  Printer,
  Download,
  CheckSquare,
  Square,
  Lock,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  fetchCommercialBookings,
  fetchCommercialRooms,
  checkinCommercialBooking,
  checkoutCommercialBooking,
} from "@/lib/data";
import type { CommercialBooking, CommercialRoom } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { CheckinModal } from "@/components/checkin-modal";
import { ExtendBookingModal } from "@/components/extend-booking-modal";
import { CommercialBookingDetailModal } from "@/components/commercial-booking-detail-modal";
import { DocumentShareModal } from "@/components/document-share-modal";
import { downloadPdfDocument } from "@/lib/storage";
import {
  buildFolioHtml,
  buildCheckinEmailTemplates,
} from "@/lib/booking-folio";
import { openBookingPdfInNewTab, openMultiBookingPdfInNewTab } from "@/lib/booking-pdf-export";
import { ReportEmailDialog } from "@/components/reports/report-email-dialog";
import { CheckoutCountdown, getCheckoutDelta } from "@/components/checkout-countdown";
import { ExpressCheckoutModal } from "@/components/express-checkout-modal";
import { CheckoutConfirmModal } from "@/components/checkout-confirm-modal";
import { CheckoutHistoryModal } from "@/components/checkout-history-modal";
import { BookingsReportModal } from "@/components/bookings-report-modal";
import { Pagination } from "@/components/pagination";

export default function CommercialBookingsPage() {
  const { currentCompany, currentCompanyUser } = useAuth();
  const [bookings, setBookings] = useState<CommercialBooking[]>([]);
  const [rooms, setRooms] = useState<CommercialRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("all");
  const [bookingsReportOpen, setBookingsReportOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [activeTab, setActiveTab] = useState<'bookings' | 'reservations' | 'enquiries'>('bookings');
  const [reservations, setReservations] = useState<CommercialBooking[]>([]);
  const [bookingEnquiries, setBookingEnquiries] = useState<any[]>([]);
  const [expandedEnquiryId, setExpandedEnquiryId] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [emailModalEnquiry, setEmailModalEnquiry] = useState<any | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  // Response email verification states
  const [responseEmail, setResponseEmail] = useState("");
  const [responseEmailVerified, setResponseEmailVerified] = useState(false);
  const [showResponseEmailSetting, setShowResponseEmailSetting] = useState(false);
  const [responseEmailInput, setResponseEmailInput] = useState("");
  const [verificationStep, setVerificationStep] = useState<"input" | "verify">("input");
  const [verificationCodeInput, setVerificationCodeInput] = useState("");
  const [sentVerificationCode, setSentVerificationCode] = useState("");
  const [verifyingEmail, setVerifyingEmail] = useState(false);
  const [verificationError, setVerificationError] = useState("");

  // Enquiry conversation messages map
  const [enquiryMessagesMap, setEnquiryMessagesMap] = useState<Record<string, any[]>>({});
  const [loadingMessagesId, setLoadingMessagesId] = useState<string | null>(null);

  // Row selection states for batch download/print/email
  const [selectedBookingIds, setSelectedBookingIds] = useState<Set<string>>(new Set());
  const [selectedReservationIds, setSelectedReservationIds] = useState<Set<string>>(new Set());
  const [selectedRowsEmailOpen, setSelectedRowsEmailOpen] = useState(false);

  // Modals state
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [expressCheckoutOpen, setExpressCheckoutOpen] = useState(false);
  const [checkoutHistoryOpen, setCheckoutHistoryOpen] = useState(false);
  const [checkoutConfirmBooking, setCheckoutConfirmBooking] = useState<CommercialBooking | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
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
    emailTemplates?: any;
  }>({
    isOpen: false,
    documentTitle: "",
  });

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    });
  };

  const loadData = async () => {
    setLoading(true);
    const [bks, rms] = await Promise.all([
      fetchCommercialBookings(currentCompany.id),
      fetchCommercialRooms(currentCompany.id),
    ]);
    setBookings(bks);
    setRooms(rms);

    const { data: reservData } = await supabase
      .from('commercial_bookings')
      .select('*, properties(name), commercial_rooms(room_number, room_type)')
      .eq('company_id', currentCompany.id)
      .eq('booking_status', 'reserved')
      .order('created_at', { ascending: false });
      
    if (reservData) {
      setReservations(reservData.map((b: any) => ({
        id: b.id,
        companyId: b.company_id,
        propertyId: b.property_id,
        propertyName: b.properties?.name || "Lodge Property",
        roomId: b.room_id,
        roomNumber: b.commercial_rooms?.room_number || "Room",
        roomType: b.commercial_rooms?.room_type || "standard",
        bookingCode: b.booking_code,
        guestName: b.guest_name,
        guestPhone: b.guest_phone,
        guestEmail: b.guest_email,
        guestIdNumber: b.guest_id_number,
        checkInDate: b.check_in_date,
        checkOutDate: b.check_out_date,
        actualCheckIn: b.actual_check_in,
        actualCheckOut: b.actual_check_out,
        mealPlan: b.meal_plan,
        nights: b.nights,
        ratePerNight: Number(b.rate_per_night),
        totalAmount: Number(b.total_amount),
        depositAmount: Number(b.deposit_amount),
        amountPaid: Number(b.amount_paid),
        paymentMethod: b.payment_method,
        paymentStatus: b.payment_status,
        bookingStatus: b.booking_status,
        isExtended: b.is_extended,
        extensionHistory: b.extension_history || [],
        checkedInByName: b.checked_in_by_name,
        checkedOutByName: b.checked_out_by_name || b.checked_out_by || undefined,
        notes: b.notes,
        createdAt: b.created_at,
      })));
    }

    const { data: enqData } = await supabase
      .from('enquiries')
      .select('*')
      .eq('company_id', currentCompany.id)
      .in('type', ['room_booking', 'rental_enquiry'])
      .order('created_at', { ascending: false });
    if (enqData) setBookingEnquiries(enqData);

    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [currentCompany.id]);

  const handleCheckIn = async (booking: CommercialBooking) => {
    if (
      window.confirm(
        `Confirm front desk check-in for ${booking.guestName} into Room ${booking.roomNumber}?`
      )
    ) {
      try {
        const actorName = currentCompanyUser?.fullName || currentCompanyUser?.jobTitle || "Staff";
        await checkinCommercialBooking(booking.id, actorName);
        loadData();
      } catch (err: any) {
        const msg = err?.message || err?.details || JSON.stringify(err);
        alert("Check-in failed: " + msg);
      }
    }
  };

  const handleCheckout = (booking: CommercialBooking) => {
    setCheckoutConfirmBooking(booking);
  };

  const handleConfirmCheckout = async (booking: CommercialBooking) => {
    setIsCheckingOut(true);
    try {
      const actor = currentCompanyUser?.fullName || "Front Desk";
      await checkoutCommercialBooking(booking.id, actor);
      setCheckoutConfirmBooking(null);
      loadData();
    } catch (err: any) {
      alert("Checkout failed: " + (err.message || err));
    } finally {
      setIsCheckingOut(false);
    }
  };

  const currencySymbol = currentCompany?.currency === "USD" ? "$" : currentCompany?.currency === "EUR" ? "€" : currentCompany?.currency || "R";

  useEffect(() => {
    const saved = localStorage.getItem(`paimbabook_verified_response_email_${currentCompany.id}`);
    if (saved) {
      setResponseEmail(saved);
      setResponseEmailVerified(true);
    }
  }, [currentCompany.id]);

  const isWithinPeriod = (dateStr: string | undefined | null, period: string) => {
    if (!dateStr || period === "all") return true;
    const t = new Date(dateStr).getTime();
    const now = Date.now();
    let maxDiff = Infinity;
    if (period === "2h") maxDiff = 2 * 3600 * 1000;
    else if (period === "24h") maxDiff = 24 * 3600 * 1000;
    else if (period === "3d") maxDiff = 3 * 24 * 3600 * 1000;
    else if (period === "1w") maxDiff = 7 * 24 * 3600 * 1000;
    else if (period === "1m") maxDiff = 30 * 24 * 3600 * 1000;
    else if (period === "3m") maxDiff = 90 * 24 * 3600 * 1000;
    else if (period === "1y") maxDiff = 365 * 24 * 3600 * 1000;
    return now - t <= maxDiff;
  };

  const loadEnquiryMessages = async (enquiryId: string) => {
    setLoadingMessagesId(enquiryId);
    try {
      const { data } = await supabase
        .from('enquiry_messages')
        .select('*')
        .eq('enquiry_id', enquiryId)
        .order('created_at', { ascending: true });
      if (data) {
        setEnquiryMessagesMap((prev) => ({ ...prev, [enquiryId]: data }));
      }
    } catch (err) {
      console.warn("Could not load enquiry messages:", err);
    } finally {
      setLoadingMessagesId(null);
    }
  };

  const handleCloseTicket = async (enquiryId: string) => {
    try {
      const actorName = currentCompanyUser?.fullName || 'Staff';
      await supabase.from('enquiries').update({
        status: 'resolved',
        resolved_by_name: actorName,
        resolved_at: new Date().toISOString()
      }).eq('id', enquiryId);

      await supabase.from('audit_logs').insert([{
        company_id: currentCompany.id,
        action: 'closed_enquiry_ticket',
        target_entity: 'enquiry',
        target_id: enquiryId,
        performed_by_name: actorName,
        details: {}
      }]);

      setBookingEnquiries((prev) =>
        prev.map((item) =>
          item.id === enquiryId
            ? { ...item, status: 'resolved', resolved_by_name: actorName, resolved_at: new Date().toISOString() }
            : item
        )
      );
    } catch (err: any) {
      alert("Failed to close ticket: " + (err.message || String(err)));
    }
  };

  const handleReopenTicket = async (enquiryId: string) => {
    try {
      const actorName = currentCompanyUser?.fullName || 'Staff';
      await supabase.from('enquiries').update({
        status: 'open',
        resolved_by_name: null,
        resolved_at: null
      }).eq('id', enquiryId);

      await supabase.from('audit_logs').insert([{
        company_id: currentCompany.id,
        action: 'reopened_enquiry_ticket',
        target_entity: 'enquiry',
        target_id: enquiryId,
        performed_by_name: actorName,
        details: {}
      }]);

      setBookingEnquiries((prev) =>
        prev.map((item) =>
          item.id === enquiryId
            ? { ...item, status: 'open', resolved_by_name: null, resolved_at: null }
            : item
        )
      );
    } catch (err: any) {
      alert("Failed to reopen ticket: " + (err.message || String(err)));
    }
  };

  const handleSendVerificationCode = async () => {
    setVerificationError("");
    const email = responseEmailInput.trim().toLowerCase();
    if (!email || !email.includes("@")) {
      setVerificationError("Please enter a valid email address.");
      return;
    }
    setVerifyingEmail(true);
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setSentVerificationCode(code);

      const { sendEmailViaApi } = await import("@/lib/notifications");
      await sendEmailViaApi({
        to: email,
        subject: `[Verification Code] Front Desk Response Email: ${code}`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 550px; margin: 0 auto;">
            <h2 style="color: #2563eb; margin-top: 0;">Verify Front Desk Response Email</h2>
            <p style="color: #334155; font-size: 14px;">You requested to set <strong>${email}</strong> as the official front desk response email address for <strong>${currentCompany.name}</strong>.</p>
            <p style="color: #334155; font-size: 14px;">To avoid unauthorized email spoofing, enter the 6-digit confirmation code below:</p>
            <div style="margin: 24px 0; padding: 16px; background: #eff6ff; border: 1px dashed #3b82f6; border-radius: 8px; font-size: 28px; font-weight: 900; letter-spacing: 6px; color: #1d4ed8; text-align: center;">
              ${code}
            </div>
            <p style="font-size: 12px; color: #64748b; margin-bottom: 0;">If you did not request this verification, please disregard this email.</p>
          </div>
        `,
      });

      setVerificationStep("verify");
    } catch (err: any) {
      setVerificationError(err?.message || "Failed to dispatch verification code. Please check email address.");
    } finally {
      setVerifyingEmail(false);
    }
  };

  const handleConfirmVerificationCode = async () => {
    setVerificationError("");
    if (verificationCodeInput.trim() !== sentVerificationCode.trim()) {
      setVerificationError("Incorrect verification code. Please check your inbox and enter the 6 digits sent to you.");
      return;
    }

    const verifiedEmail = responseEmailInput.trim().toLowerCase();
    setResponseEmail(verifiedEmail);
    setResponseEmailVerified(true);
    localStorage.setItem(`paimbabook_verified_response_email_${currentCompany.id}`, verifiedEmail);

    try {
      await supabase.from("companies").update({ email: verifiedEmail }).eq("id", currentCompany.id);
      const actorName = currentCompanyUser?.fullName || "Staff";
      await supabase.from("audit_logs").insert([{
        company_id: currentCompany.id,
        action: "verified_response_email",
        target_entity: "company_settings",
        target_id: currentCompany.id,
        performed_by_name: actorName,
        details: { verified_email: verifiedEmail }
      }]);
    } catch (err) {
      console.warn("Could not save to Supabase companies:", err);
    }

    setShowResponseEmailSetting(false);
    setVerificationStep("input");
    setVerificationCodeInput("");
    alert(`Email successfully verified! All booking replies will now display from ${verifiedEmail}.`);
  };

  // Selection helpers
  const toggleSelectBooking = (id: string) => {
    setSelectedBookingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllBookings = (currentRows: CommercialBooking[]) => {
    if (selectedBookingIds.size === currentRows.length) {
      setSelectedBookingIds(new Set());
    } else {
      setSelectedBookingIds(new Set(currentRows.map((b) => b.id)));
    }
  };

  const toggleSelectReservation = (id: string) => {
    setSelectedReservationIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllReservations = (currentRows: CommercialBooking[]) => {
    if (selectedReservationIds.size === currentRows.length) {
      setSelectedReservationIds(new Set());
    } else {
      setSelectedReservationIds(new Set(currentRows.map((b) => b.id)));
    }
  };

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const matchesSearch =
        b.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.bookingCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.roomNumber && b.roomNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        b.guestPhone.includes(searchQuery);

      const matchesStatus =
        statusFilter === "all" || b.bookingStatus === statusFilter;

      const matchesPeriod = isWithinPeriod(b.createdAt || b.checkInDate, selectedPeriod);

      return matchesSearch && matchesStatus && matchesPeriod;
    });
  }, [bookings, searchQuery, statusFilter, selectedPeriod]);

  const filteredReservations = useMemo(() => {
    return reservations.filter((b) => {
      const matchesSearch =
        !searchQuery ||
        b.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.bookingCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.roomNumber && b.roomNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        b.guestPhone.includes(searchQuery);

      const matchesPeriod = isWithinPeriod(b.createdAt || b.checkInDate, selectedPeriod);
      return matchesSearch && matchesPeriod;
    });
  }, [reservations, searchQuery, selectedPeriod]);

  const selectedBookingsList = useMemo(() => {
    return bookings.filter((b) => selectedBookingIds.has(b.id));
  }, [bookings, selectedBookingIds]);

  const selectedReservationsList = useMemo(() => {
    return reservations.filter((b) => selectedReservationIds.has(b.id));
  }, [reservations, selectedReservationIds]);

  const itemsPerPage = 10;
  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage);
  const paginatedBookings = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredBookings.slice(start, start + itemsPerPage);
  }, [filteredBookings, currentPage]);

  const activeCheckedIn = bookings.filter((b) => b.bookingStatus === "checked_in" || b.bookingStatus === "extended").length;
  const occupiedRooms = rooms.filter((r) => r.status === "occupied").length;
  const cleaningNeededRooms = rooms.filter((r) => r.status === "cleaning_needed").length;

  const overstayCount = bookings.filter((b) => {
    if (b.bookingStatus !== "checked_in" && b.bookingStatus !== "extended") return false;
    return getCheckoutDelta(b.checkOutDate).isOverstay;
  }).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Front Desk & Hospitality Bookings
          </h1>
          <p className="text-sm text-muted">
            Manage guest check-ins, departures, live checkout countdowns, and turnover queue for {currentCompany.name}.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setBookingsReportOpen(true)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-border-color bg-surface px-3 py-1.5 text-xs font-bold text-foreground hover:bg-surface-elevated transition shadow-xs"
            title="Generate, Preview, Print or Share Bookings Report"
          >
            <FileText size={15} className="text-blue-600" />
            <span>Bookings Report</span>
          </button>

          <button
            type="button"
            onClick={() => setExpressCheckoutOpen(true)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-500/20 transition shadow-xs"
            title="Express Checkout & Overstay Desk"
          >
            <LogOut size={15} />
            <span>Check Out Guest</span>
            {overstayCount > 0 && (
              <span className="rounded-full bg-red-600 px-1.5 py-0.2 text-[10px] font-black text-white animate-pulse">
                {overstayCount} Overdue
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setCheckoutHistoryOpen(true)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-border-color bg-surface px-3 py-1.5 text-xs font-bold text-foreground hover:bg-surface-elevated transition shadow-xs"
            title="View Guest Checkout History & Departures Log"
          >
            <History size={15} className="text-emerald-600" />
            <span>Checkout History</span>
          </button>

          <button
            type="button"
            onClick={() => setCheckinOpen(true)}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
          >
            <KeyRound size={15} />
            <span>New Check-In</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-6">
        <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-muted">Active In-House</p>
          <p className="mt-2 text-2xl font-black text-blue-600">{activeCheckedIn}</p>
          <p className="mt-1 text-[11px] text-muted">Checked-in guests</p>
        </div>

        <div
          onClick={() => setExpressCheckoutOpen(true)}
          className={`cursor-pointer rounded-2xl border p-4 shadow-sm transition hover:border-red-500/50 ${
            overstayCount > 0
              ? "border-red-500/40 bg-red-500/10 text-red-600"
              : "border-border-color bg-surface"
          }`}
        >
          <p className="text-xs font-semibold uppercase text-muted">Overstay / Past Time</p>
          <p className={`mt-2 text-2xl font-black ${overstayCount > 0 ? "text-red-600 animate-pulse" : "text-foreground"}`}>
            {overstayCount}
          </p>
          <p className="mt-1 text-[11px] text-muted">Click to open Express Desk</p>
        </div>

        <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-muted">Occupied Rooms</p>
          <p className="mt-2 text-2xl font-black text-foreground">{occupiedRooms} / {rooms.length}</p>
          <p className="mt-1 text-[11px] text-muted">Current occupancy</p>
        </div>

        <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase text-muted">Housekeeping Needed</p>
          <p className="mt-2 text-2xl font-black text-amber-600">{cleaningNeededRooms}</p>
          <p className="mt-1 text-[11px] text-muted">Pending turnovers</p>
        </div>

        <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-sm sm:col-span-1">
          <p className="text-xs font-semibold uppercase text-muted">Available Rooms</p>
          <p className="mt-2 text-2xl font-black text-emerald-600">
            {rooms.filter((r) => r.status === "available").length}
          </p>
          <p className="mt-1 text-[11px] text-muted">Ready for walk-in</p>
        </div>

        <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-sm sm:col-span-1">
          <p className="text-xs font-semibold uppercase text-muted">Pending Reservations</p>
          <div className="mt-2 flex items-center gap-2">
            <CalendarRange size={24} className="text-indigo-600" />
            <p className="text-2xl font-black text-indigo-600">{reservations.length}</p>
          </div>
          <p className="mt-1 text-[11px] text-muted">Awaiting check-in</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 rounded-xl bg-surface-elevated p-1">
        <button
          onClick={() => setActiveTab('bookings')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
            activeTab === 'bookings'
              ? 'bg-surface shadow-sm text-foreground'
              : 'text-muted hover:text-foreground hover:bg-surface-elevated/80'
          }`}
        >
          <KeyRound size={16} />
          Active Bookings
        </button>
        <button
          onClick={() => setActiveTab('reservations')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
            activeTab === 'reservations'
              ? 'bg-surface shadow-sm text-indigo-600'
              : 'text-muted hover:text-indigo-600 hover:bg-surface-elevated/80'
          }`}
        >
          <CalendarRange size={16} />
          Reservations
          {reservations.length > 0 && (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
              {reservations.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('enquiries')}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all ${
            activeTab === 'enquiries'
              ? 'bg-surface shadow-sm text-purple-600'
              : 'text-muted hover:text-purple-600 hover:bg-surface-elevated/80'
          }`}
        >
          <MessageSquare size={16} />
          Booking Enquiries
          {bookingEnquiries.filter(e => e.status !== 'resolved').length > 0 && (
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
              {bookingEnquiries.filter(e => e.status !== 'resolved').length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'bookings' && (
        <div className="space-y-6">
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

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-muted">Period:</span>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs font-bold text-foreground focus:border-blue-600 focus:outline-none"
            >
              <option value="all">All Time</option>
              <option value="2h">Past 2 Hours</option>
              <option value="24h">Past 24 Hours</option>
              <option value="3d">Past 3 Days</option>
              <option value="1w">Past 1 Week</option>
              <option value="1m">Past 1 Month</option>
              <option value="3m">Past 3 Months</option>
              <option value="1y">Past 1 Year</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-muted">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs font-bold text-foreground focus:border-blue-600 focus:outline-none"
            >
              <option value="all">All Bookings</option>
              <option value="checked_in">Checked In</option>
              <option value="extended">Stay Extended</option>
              <option value="confirmed">Confirmed / Upcoming</option>
              <option value="reserved">Reserved</option>
              <option value="checked_out">Checked Out</option>
            </select>
          </div>
        </div>
      </div>

      {/* Batch Actions Bar */}
      {selectedBookingIds.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-500/30 bg-blue-50/80 dark:bg-blue-950/40 p-3 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckSquare size={16} className="text-blue-600" />
            <span className="text-xs font-bold text-foreground">
              {selectedBookingIds.size} Booking{selectedBookingIds.size > 1 ? "s" : ""} Selected
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => openMultiBookingPdfInNewTab(selectedBookingsList, currentCompany.name, currencySymbol, "Active Bookings Ledger", selectedPeriod)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
              title="Download & View PDF in New Tab"
            >
              <Download size={13} />
              <span>View & Download PDF ({selectedBookingIds.size})</span>
            </button>
            <button
              type="button"
              onClick={() => openMultiBookingPdfInNewTab(selectedBookingsList, currentCompany.name, currencySymbol, "Active Bookings Ledger", selectedPeriod)}
              className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface px-3 py-1.5 text-xs font-bold text-foreground hover:bg-surface-elevated transition shadow-xs"
              title="Print Selected Bookings"
            >
              <Printer size={13} />
              <span>Print Selected</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedRowsEmailOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface px-3 py-1.5 text-xs font-bold text-foreground hover:bg-surface-elevated transition shadow-xs"
              title="Email Selected Bookings to Staff or Custom Email"
            >
              <Mail size={13} className="text-blue-600" />
              <span>Email to Staff / Custom</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedBookingIds(new Set())}
              className="text-xs font-semibold text-muted hover:text-foreground underline ml-1"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Bookings List Table */}
      <div className="overflow-hidden rounded-2xl border border-border-color bg-surface shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-color bg-surface-elevated/70 text-[11px] font-bold uppercase tracking-wider text-muted">
              <tr>
                <th className="w-10 px-4 py-3.5 text-center">
                  <input
                    type="checkbox"
                    checked={paginatedBookings.length > 0 && selectedBookingIds.size === paginatedBookings.length}
                    onChange={() => selectAllBookings(paginatedBookings)}
                    className="h-4 w-4 rounded border-border-color text-blue-600 focus:ring-blue-600 cursor-pointer"
                    title="Select All on this Page"
                  />
                </th>
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
                  <td colSpan={8} className="p-8 text-center text-muted">
                    Loading commercial bookings...
                  </td>
                </tr>
              ) : filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-muted">
                    No bookings found matching your search and timeframe filter.
                  </td>
                </tr>
              ) : (
                paginatedBookings.map((b) => {
                  const isStayActive = b.bookingStatus === "checked_in" || b.bookingStatus === "extended";
                  return (
                    <tr
                      key={b.id}
                      onClick={() => setDetailModalBooking(b)}
                      className="hover:bg-surface-elevated/70 transition cursor-pointer group"
                    >
                      <td className="w-10 px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedBookingIds.has(b.id)}
                          onChange={() => toggleSelectBooking(b.id)}
                          className="h-4 w-4 rounded border-border-color text-blue-600 focus:ring-blue-600 cursor-pointer"
                        />
                      </td>
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
                        {isStayActive && (
                          <div className="mt-1.5">
                            <CheckoutCountdown
                              checkOutDate={b.checkOutDate}
                              isStayActive={true}
                              compact={true}
                            />
                          </div>
                        )}
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

                          {!isStayActive && (b.bookingStatus === "confirmed" || (b.bookingStatus as string) === "pending") && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCheckIn(b);
                              }}
                              className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 hover:bg-emerald-500/20 shadow-xs transition"
                              title="Check In Guest Now"
                            >
                              <KeyRound size={13} />
                              <span>Check In</span>
                            </button>
                          )}

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
                              openBookingPdfInNewTab(b, currentCompany.name, currencySymbol);
                            }}
                            className="flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-xs font-bold text-blue-600 hover:bg-blue-500/20 transition"
                            title="View & Download PDF Folio in New Tab"
                          >
                            <FileText size={13} />
                            <span>PDF</span>
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

        {totalPages > 1 && (
          <div className="border-t border-border-color p-3 bg-surface">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              totalItems={filteredBookings.length}
              itemsPerPage={itemsPerPage}
            />
          </div>
        )}
      </div>
        </div>
      )}

      {activeTab === 'reservations' && (
        <div className="space-y-6">
          {/* Search and Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border-color bg-surface p-4">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="search"
                placeholder="Search reservations by Guest Name, Booking Code, Room # or Phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-border-color bg-surface-elevated pl-9 pr-4 py-2 text-sm text-foreground outline-none focus:border-indigo-600"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted">Period:</span>
              <select
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs font-bold text-foreground focus:border-indigo-600 focus:outline-none"
              >
                <option value="all">All Time</option>
                <option value="2h">Past 2 Hours</option>
                <option value="24h">Past 24 Hours</option>
                <option value="3d">Past 3 Days</option>
                <option value="1w">Past 1 Week</option>
                <option value="1m">Past 1 Month</option>
                <option value="3m">Past 3 Months</option>
                <option value="1y">Past 1 Year</option>
              </select>
            </div>
          </div>

          {/* Batch Actions Bar for Reservations */}
          {selectedReservationIds.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-500/30 bg-indigo-50/80 dark:bg-indigo-950/40 p-3 shadow-xs">
              <div className="flex items-center gap-2">
                <CheckSquare size={16} className="text-indigo-600" />
                <span className="text-xs font-bold text-foreground">
                  {selectedReservationIds.size} Reservation{selectedReservationIds.size > 1 ? "s" : ""} Selected
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => openMultiBookingPdfInNewTab(selectedReservationsList, currentCompany.name, currencySymbol, "Pending Reservations Ledger", selectedPeriod)}
                  className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition"
                  title="Download & View PDF in New Tab"
                >
                  <Download size={13} />
                  <span>View & Download PDF ({selectedReservationIds.size})</span>
                </button>
                <button
                  type="button"
                  onClick={() => openMultiBookingPdfInNewTab(selectedReservationsList, currentCompany.name, currencySymbol, "Pending Reservations Ledger", selectedPeriod)}
                  className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface px-3 py-1.5 text-xs font-bold text-foreground hover:bg-surface-elevated transition shadow-xs"
                  title="Print Selected Reservations"
                >
                  <Printer size={13} />
                  <span>Print Selected</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRowsEmailOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface px-3 py-1.5 text-xs font-bold text-foreground hover:bg-surface-elevated transition shadow-xs"
                  title="Email Selected to Staff or Custom Email"
                >
                  <Mail size={13} className="text-indigo-600" />
                  <span>Email to Staff / Custom</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedReservationIds(new Set())}
                  className="text-xs font-semibold text-muted hover:text-foreground underline ml-1"
                >
                  Deselect All
                </button>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-border-color bg-surface shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border-color bg-surface-elevated/70 text-[11px] font-bold uppercase tracking-wider text-muted">
                  <tr>
                    <th className="w-10 px-4 py-3.5 text-center">
                      <input
                        type="checkbox"
                        checked={filteredReservations.length > 0 && selectedReservationIds.size === filteredReservations.length}
                        onChange={() => selectAllReservations(filteredReservations)}
                        className="h-4 w-4 rounded border-border-color text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                        title="Select All Reservations"
                      />
                    </th>
                    <th className="px-4 py-3.5">Booking Code</th>
                    <th className="px-4 py-3.5">Guest Details</th>
                    <th className="px-4 py-3.5">Room & Property</th>
                    <th className="px-4 py-3.5">Stay Dates</th>
                    <th className="px-4 py-3.5">Financials</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color text-foreground">
                  {filteredReservations.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted">
                        <div className="flex flex-col items-center justify-center">
                          <CalendarRange size={32} className="mb-2 text-indigo-400" />
                          <p>No pending reservations found for the selected timeframe</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredReservations.map((b) => (
                      <tr key={b.id} className="hover:bg-surface-elevated/70 transition">
                        <td className="w-10 px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedReservationIds.has(b.id)}
                            onChange={() => toggleSelectReservation(b.id)}
                            className="h-4 w-4 rounded border-border-color text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                          />
                        </td>
                        <td className="px-4 py-3.5">
                          <span className="font-mono text-xs font-extrabold text-indigo-600 bg-indigo-500/10 px-2.5 py-1 rounded-md">
                            {b.bookingCode}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-bold text-foreground">{b.guestName}</p>
                          <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                            <Phone size={12} />
                            <span>{b.guestPhone}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-bold text-foreground">{b.roomNumber}</p>
                          <p className="text-xs text-muted">{b.propertyName}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 text-xs text-foreground">
                            <Calendar size={13} className="text-muted" />
                            <span>
                              {new Date(b.checkInDate).toLocaleDateString()} →{" "}
                              {new Date(b.checkOutDate).toLocaleDateString()}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-extrabold text-foreground">{currencySymbol}{b.totalAmount.toLocaleString()}</p>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openBookingPdfInNewTab(b, currentCompany.name, currencySymbol)}
                              className="flex items-center gap-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-500/20 transition"
                              title="View & Download PDF Folio in New Tab"
                            >
                              <FileText size={13} />
                              <span className="hidden sm:inline">PDF</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setDetailModalBooking(b)}
                              className="flex items-center gap-1 rounded-lg border border-border-color bg-surface-elevated px-2 py-1 text-xs text-muted hover:text-blue-600 hover:border-blue-500/40 transition"
                            >
                              <Eye size={13} />
                              <span className="hidden sm:inline">Details</span>
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  const actorName = currentCompanyUser?.fullName || currentCompanyUser?.jobTitle || "Staff";
                                  await checkinCommercialBooking(b.id, actorName);
                                  loadData();
                                } catch (err: any) {
                                  alert("Check-in failed: " + (err.message || JSON.stringify(err)));
                                }
                              }}
                              className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 hover:bg-emerald-500/20"
                            >
                              <UserCheck size={13} />
                              <span>Check In</span>
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                if (window.confirm('Cancel this reservation?')) {
                                  await supabase.from('commercial_bookings').update({ booking_status: 'cancelled' }).eq('id', b.id);
                                  loadData();
                                }
                              }}
                              className="flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-500/20"
                            >
                              <LogOut size={13} />
                              <span>Cancel</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'enquiries' && (
        <div className="space-y-4">
          {/* Response Email Setting Bar */}
          <div className="flex items-center gap-3 rounded-2xl border border-border-color bg-surface p-4 shadow-xs">
            <Mail size={16} className="text-muted shrink-0" />
            <div className="flex-1 flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-muted">Response From Email:</span>
              {responseEmail && responseEmailVerified ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 text-xs font-bold text-emerald-600">
                  <CheckCircle2 size={13} />
                  <span>{responseEmail} (Verified Ownership)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-amber-600 font-semibold bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
                  <Lock size={12} />
                  <span>Not set - replies use system default (Verification Required)</span>
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setResponseEmailInput(responseEmail);
                setVerificationStep("input");
                setVerificationError("");
                setShowResponseEmailSetting(true);
              }}
              className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface-elevated px-3 py-1.5 text-xs font-bold text-foreground hover:bg-surface-elevated/80 transition shadow-xs"
            >
              <Pencil size={13} />
              <span>{responseEmailVerified ? "Change Response Email" : "Set & Verify Response Email"}</span>
            </button>
          </div>

          {/* Response Email Verification Modal */}
          {showResponseEmailSetting && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150">
              <div className="w-full max-w-md rounded-3xl border border-border-color bg-surface p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-border-color pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="rounded-xl bg-blue-600/10 p-2 text-blue-600">
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-foreground">Verify Response Email</h3>
                      <p className="text-[11px] text-muted">Confirm ownership via 6-digit code to avoid unauthorized from emails</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowResponseEmailSetting(false);
                      setVerificationStep("input");
                      setVerificationError("");
                    }}
                    className="rounded-lg p-1.5 text-muted hover:bg-surface-elevated"
                  >
                    <X size={18} />
                  </button>
                </div>

                {verificationError && (
                  <div className="rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-600 font-medium">
                    {verificationError}
                  </div>
                )}

                {verificationStep === "input" ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-foreground block mb-1">
                        Monitored Email Address *
                      </label>
                      <input
                        type="email"
                        placeholder="e.g. reservations@yourproperty.com"
                        value={responseEmailInput}
                        onChange={(e) => setResponseEmailInput(e.target.value)}
                        className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2.5 text-sm text-foreground outline-none focus:border-blue-600"
                      />
                      <p className="text-[11px] text-muted mt-1.5">
                        We will send a 6-digit confirmation code to this inbox. You must enter it to prove ownership before this email can be used as a sender.
                      </p>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowResponseEmailSetting(false)}
                        className="rounded-xl border border-border-color px-4 py-2 text-xs font-medium text-muted hover:bg-surface-elevated"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={verifyingEmail || !responseEmailInput.trim()}
                        onClick={handleSendVerificationCode}
                        className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-xs"
                      >
                        {verifyingEmail ? (
                          <>
                            <RefreshCw size={13} className="animate-spin" />
                            <span>Sending Code...</span>
                          </>
                        ) : (
                          <>
                            <Send size={13} />
                            <span>Send Verification Code</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-3 text-xs text-blue-700 dark:text-blue-300">
                      We sent a 6-digit verification code to <strong>{responseEmailInput}</strong>. Please enter it below:
                    </div>

                    <div>
                      <label className="text-xs font-bold text-foreground block mb-1">
                        6-Digit Verification Code *
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        placeholder="e.g. 123456"
                        value={verificationCodeInput}
                        onChange={(e) => setVerificationCodeInput(e.target.value.replace(/[^0-9]/g, ''))}
                        className="w-full text-center tracking-widest text-lg font-mono font-bold rounded-xl border border-border-color bg-surface-elevated px-3 py-2.5 text-foreground outline-none focus:border-blue-600"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                      <button
                        type="button"
                        onClick={handleSendVerificationCode}
                        disabled={verifyingEmail}
                        className="text-xs text-blue-600 hover:underline disabled:opacity-50 font-semibold"
                      >
                        {verifyingEmail ? "Resending..." : "Resend Code"}
                      </button>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setVerificationStep("input")}
                          className="rounded-xl border border-border-color px-3 py-2 text-xs font-medium text-muted hover:bg-surface-elevated"
                        >
                          Back
                        </button>
                        <button
                          type="button"
                          disabled={verificationCodeInput.length !== 6}
                          onClick={handleConfirmVerificationCode}
                          className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition shadow-xs"
                        >
                          Verify &amp; Activate
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Email Compose Modal */}
          {emailModalEnquiry && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <div className="w-full max-w-lg rounded-3xl border border-border-color bg-surface p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-border-color pb-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Compose Ticket Response</p>
                    <h3 className="text-base font-bold text-foreground">To: {emailModalEnquiry.customer_name}</h3>
                  </div>
                  <button onClick={() => setEmailModalEnquiry(null)} className="rounded-lg p-1.5 text-muted hover:bg-surface-elevated">
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-semibold text-muted block mb-1">From Email Address</label>
                    <div className="rounded-xl border border-border-color bg-surface-elevated/50 px-3 py-2 text-sm text-foreground flex items-center justify-between">
                      <span>{responseEmail || 'system@paimbabook.com'}</span>
                      {responseEmailVerified && (
                        <span className="text-[10px] bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                          Verified
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted block mb-1">To Customer</label>
                    <div className="rounded-xl border border-border-color bg-surface-elevated/50 px-3 py-2 text-sm text-foreground">
                      {emailModalEnquiry.customer_email}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted block mb-1">Subject</label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted block mb-1">Response Message *</label>
                    <textarea
                      rows={6}
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      placeholder="Type your response here. This will be emailed to the client and saved in the ticket audit trail..."
                      className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-blue-600 resize-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setEmailModalEnquiry(null)} className="rounded-xl border border-border-color px-4 py-2 text-xs font-medium text-muted hover:bg-surface-elevated">
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={sendingEmail || !emailBody.trim()}
                    onClick={async () => {
                      setSendingEmail(true);
                      try {
                        const actorName = currentCompanyUser?.fullName || currentCompanyUser?.jobTitle || 'Front Desk Staff';

                        // 1. Send the email response
                        const { sendEnquiryResponseEmail } = await import('@/lib/enquiry-templates');
                        await sendEnquiryResponseEmail({
                          toEmail: emailModalEnquiry.customer_email,
                          customerName: emailModalEnquiry.customer_name,
                          propertyName: emailModalEnquiry.property_name,
                          enquiryId: emailModalEnquiry.id,
                          question: emailModalEnquiry.message,
                          response: emailBody,
                          companyName: currentCompany.name,
                        });

                        // 2. Insert into enquiry_messages table
                        await supabase.from('enquiry_messages').insert({
                          enquiry_id: emailModalEnquiry.id,
                          sender_type: 'staff',
                          sender_name: actorName,
                          body: emailBody.trim(),
                        });

                        // 3. Log to audit trail
                        await supabase.from('audit_logs').insert([{
                          company_id: currentCompany.id,
                          action: 'sent_email_response',
                          target_entity: 'enquiry',
                          target_id: emailModalEnquiry.id,
                          performed_by_name: actorName,
                          details: { subject: emailSubject, to: emailModalEnquiry.customer_email }
                        }]);

                        // 4. Mark enquiry as in_progress
                        await supabase.from('enquiries').update({
                          status: 'in_progress',
                          resolved_by_name: actorName,
                          resolved_at: new Date().toISOString()
                        }).eq('id', emailModalEnquiry.id);

                        // 5. Update local thread
                        setEnquiryMessagesMap((prev) => ({
                          ...prev,
                          [emailModalEnquiry.id]: [
                            ...(prev[emailModalEnquiry.id] || []),
                            {
                              id: Date.now().toString(),
                              enquiry_id: emailModalEnquiry.id,
                              sender_type: 'staff',
                              sender_name: actorName,
                              body: emailBody.trim(),
                              created_at: new Date().toISOString(),
                            },
                          ],
                        }));

                        loadData();
                        setEmailModalEnquiry(null);
                        setEmailSubject('');
                        setEmailBody('');
                        alert('Email response dispatched and logged into ticket thread successfully.');
                      } catch (err: any) {
                        alert('Failed to send email: ' + (err.message || String(err)));
                      } finally {
                        setSendingEmail(false);
                      }
                    }}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-xs"
                  >
                    <Send size={13} />
                    {sendingEmail ? 'Sending...' : 'Send Email & Post to Chat'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-border-color bg-surface shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border-color bg-surface-elevated/70 text-[11px] font-bold uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-3.5 w-8"></th>
                    <th className="px-4 py-3.5">Customer</th>
                    <th className="px-4 py-3.5">Enquiry Type</th>
                    <th className="px-4 py-3.5">Dates / Guests</th>
                    <th className="px-4 py-3.5">Message Preview</th>
                    <th className="px-4 py-3.5">Received / Status</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color text-foreground">
                  {bookingEnquiries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted">
                        <div className="flex flex-col items-center justify-center">
                          <MessageSquare size={32} className="mb-2 text-purple-400" />
                          <p>No booking enquiries found</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    bookingEnquiries.map((e) => {
                      const is24hOldInactive =
                        e.status === 'in_progress' &&
                        e.resolved_at &&
                        (Date.now() - new Date(e.resolved_at).getTime()) / (3600 * 1000) >= 24;

                      const messages = enquiryMessagesMap[e.id] || [];

                      return (
                        <>
                          <tr
                            key={e.id}
                            className="hover:bg-surface-elevated/50 transition cursor-pointer"
                            onClick={() => {
                              const next = expandedEnquiryId === e.id ? null : e.id;
                              setExpandedEnquiryId(next);
                              if (next && !enquiryMessagesMap[next]) {
                                void loadEnquiryMessages(next);
                              }
                            }}
                          >
                            <td className="px-4 py-3.5">
                              <button type="button" className="text-muted hover:text-foreground transition">
                                {expandedEnquiryId === e.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </button>
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="font-bold text-foreground">{e.customer_name}</p>
                              <div className="flex items-center gap-1.5 text-xs text-muted mt-0.5">
                                <Mail size={11} />
                                <span className="truncate max-w-[160px]">{e.customer_email}</span>
                              </div>
                              {e.customer_phone && (
                                <div className="flex items-center gap-1.5 text-xs text-muted mt-0.5">
                                  <Phone size={11} />
                                  <span>{e.customer_phone}</span>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                e.type === 'room_booking'
                                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                              }`}>
                                {e.type === 'room_booking' ? 'Room Booking' : 'Rental Enquiry'}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-xs">
                              {e.check_in_date && (
                                <div className="flex items-center gap-1.5 mb-1">
                                  <Calendar size={12} className="text-muted" />
                                  <span>{new Date(e.check_in_date).toLocaleDateString()}{e.check_out_date && ` → ${new Date(e.check_out_date).toLocaleDateString()}`}</span>
                                </div>
                              )}
                              {e.guests && <div className="text-muted">{e.guests} guests</div>}
                            </td>
                            <td className="px-4 py-3.5">
                              <p className="text-xs text-muted max-w-[200px] truncate">{e.message}</p>
                            </td>
                            <td className="px-4 py-3.5 text-xs">
                              <p className="text-muted mb-1">{new Date(e.created_at).toLocaleDateString()}</p>
                              {is24hOldInactive ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 text-[10px] font-bold uppercase">
                                  Auto-Closed (24h Inactive)
                                </span>
                              ) : (
                                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                  e.status === 'open' ? 'bg-orange-100 text-orange-700' :
                                  e.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-green-100 text-green-700'
                                }`}>
                                  {e.status.replace('_', ' ')}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3.5 text-right" onClick={(ev) => ev.stopPropagation()}>
                              <div className="flex items-center justify-end gap-1.5">
                                {e.status !== 'resolved' && (
                                  <button
                                    type="button"
                                    onClick={() => handleCloseTicket(e.id)}
                                    className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 hover:bg-emerald-500/20"
                                    title="Close or resolve this ticket"
                                  >
                                    <CheckCircle2 size={13} />
                                    <span>Resolve</span>
                                  </button>
                                )}
                                {e.status === 'resolved' && (
                                  <button
                                    type="button"
                                    onClick={() => handleReopenTicket(e.id)}
                                    className="flex items-center gap-1 rounded-lg border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-xs font-semibold text-orange-600 hover:bg-orange-500/20"
                                    title="Reopen ticket"
                                  >
                                    <RefreshCw size={12} />
                                    <span>Reopen</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEmailModalEnquiry(e);
                                    setEmailSubject(`Re: Your Booking Enquiry - ${currentCompany.name}`);
                                    setEmailBody('');
                                  }}
                                  className="flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-500/20"
                                  title="Reply by email & in-system chat"
                                >
                                  <Mail size={13} />
                                  <span>Reply</span>
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded row with full communication trail */}
                          {expandedEnquiryId === e.id && (
                            <tr key={`${e.id}-expanded`}>
                              <td colSpan={7} className="px-6 pb-5 pt-0 bg-surface-elevated/30">
                                <div className="rounded-2xl border border-border-color bg-surface p-5 space-y-5">
                                  <div className="flex items-center justify-between border-b border-border-color pb-3">
                                    <div>
                                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Ticket #{e.id.slice(0, 8)}</p>
                                      <h4 className="text-sm font-extrabold text-foreground">Enquiry &amp; Support Audit Trail</h4>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {e.status !== 'resolved' ? (
                                        <button
                                          type="button"
                                          onClick={() => handleCloseTicket(e.id)}
                                          className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-600 hover:bg-emerald-500/20"
                                        >
                                          <CheckCircle2 size={13} />
                                          <span>Close Ticket</span>
                                        </button>
                                      ) : (
                                        <button
                                          type="button"
                                          onClick={() => handleReopenTicket(e.id)}
                                          className="flex items-center gap-1.5 rounded-xl border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-bold text-orange-600 hover:bg-orange-500/20"
                                        >
                                          <RefreshCw size={12} />
                                          <span>Reopen Ticket</span>
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEmailModalEnquiry(e);
                                          setEmailSubject(`Re: Your Booking Enquiry - ${currentCompany.name}`);
                                          setEmailBody('');
                                        }}
                                        className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1 text-xs font-bold text-white hover:bg-blue-700 transition shadow-xs"
                                      >
                                        <Mail size={13} />
                                        <span>Reply</span>
                                      </button>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-surface-elevated/40 p-4 rounded-xl border border-border-color">
                                    <div>
                                      <span className="text-[10px] font-bold uppercase text-muted block mb-1">Customer Name</span>
                                      <p className="text-sm font-bold text-foreground">{e.customer_name}</p>
                                    </div>
                                    <div>
                                      <span className="text-[10px] font-bold uppercase text-muted block mb-1">Email Address</span>
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm text-foreground truncate">{e.customer_email}</p>
                                        <button
                                          type="button"
                                          onClick={() => copyToClipboard(e.customer_email, `email-${e.id}`)}
                                          className="flex items-center gap-1 rounded-md bg-surface border border-border-color px-2 py-0.5 text-[10px] font-semibold text-muted hover:text-foreground transition"
                                          title="Copy email"
                                        >
                                          {copiedField === `email-${e.id}` ? <CheckCircle2 size={11} className="text-emerald-600" /> : <Copy size={11} />}
                                          {copiedField === `email-${e.id}` ? 'Copied' : 'Copy'}
                                        </button>
                                      </div>
                                    </div>
                                    <div>
                                      <span className="text-[10px] font-bold uppercase text-muted block mb-1">Phone Number</span>
                                      <div className="flex items-center gap-2">
                                        <p className="text-sm text-foreground">{e.customer_phone || 'Not provided'}</p>
                                        {e.customer_phone && (
                                          <button
                                            type="button"
                                            onClick={() => copyToClipboard(e.customer_phone, `phone-${e.id}`)}
                                            className="flex items-center gap-1 rounded-md bg-surface border border-border-color px-2 py-0.5 text-[10px] font-semibold text-muted hover:text-foreground transition"
                                            title="Copy phone"
                                          >
                                            {copiedField === `phone-${e.id}` ? <CheckCircle2 size={11} className="text-emerald-600" /> : <Copy size={11} />}
                                            {copiedField === `phone-${e.id}` ? 'Copied' : 'Copy'}
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  </div>

                                  {(e.check_in_date || e.guests) && (
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                      {e.check_in_date && (
                                        <div>
                                          <span className="text-[10px] font-bold uppercase text-muted block mb-1">Check-in Date</span>
                                          <p className="text-xs font-bold text-foreground">{new Date(e.check_in_date).toLocaleDateString()}</p>
                                        </div>
                                      )}
                                      {e.check_out_date && (
                                        <div>
                                          <span className="text-[10px] font-bold uppercase text-muted block mb-1">Check-out Date</span>
                                          <p className="text-xs font-bold text-foreground">{new Date(e.check_out_date).toLocaleDateString()}</p>
                                        </div>
                                      )}
                                      {e.guests && (
                                        <div>
                                          <span className="text-[10px] font-bold uppercase text-muted block mb-1">Guests</span>
                                          <p className="text-xs font-bold text-foreground">{e.guests}</p>
                                        </div>
                                      )}
                                    </div>
                                  )}

                                  {/* Conversation Trail */}
                                  <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                      <span className="text-[11px] font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                                        <MessageSquare size={13} className="text-blue-600" />
                                        <span>Communication &amp; Audit Trail ({messages.length + 1})</span>
                                      </span>
                                      {loadingMessagesId === e.id && (
                                        <span className="text-[11px] text-muted flex items-center gap-1">
                                          <RefreshCw size={11} className="animate-spin" />
                                          <span>Refreshing trail...</span>
                                        </span>
                                      )}
                                    </div>

                                    {/* Initial Question from customer */}
                                    <div className="rounded-xl border border-border-color bg-surface-elevated/40 p-4 space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <span className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                                          <User size={13} className="text-muted" />
                                          <span>{e.customer_name}</span>
                                          <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.2 text-[10px] text-muted font-bold uppercase">Customer Inquiry</span>
                                        </span>
                                        <span className="text-[10px] text-muted">
                                          {new Date(e.created_at).toLocaleString()}
                                        </span>
                                      </div>
                                      <p className="text-xs text-foreground/90 whitespace-pre-wrap pl-4 leading-relaxed">{e.message}</p>
                                    </div>

                                    {/* Thread messages from enquiry_messages */}
                                    {messages.map((m: any) => {
                                      const isStaff = m.sender_type === 'staff';
                                      return (
                                        <div
                                          key={m.id}
                                          className={`rounded-xl border p-4 space-y-1.5 ${
                                            isStaff
                                              ? 'border-blue-500/30 bg-blue-50/60 dark:bg-blue-950/30 ml-4'
                                              : 'border-border-color bg-surface-elevated/60 mr-4'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <span className="flex items-center gap-1.5 text-xs font-bold">
                                              {isStaff ? (
                                                <>
                                                  <ShieldCheck size={14} className="text-blue-600" />
                                                  <span className="text-blue-700 dark:text-blue-300">{m.sender_name || 'Staff Member'}</span>
                                                  <span className="rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-0.2 text-[10px] font-bold">
                                                    Email Dispatched &amp; Logged
                                                  </span>
                                                </>
                                              ) : (
                                                <>
                                                  <User size={14} className="text-muted" />
                                                  <span className="text-foreground">{m.sender_name || 'Customer'}</span>
                                                  <span className="rounded-full bg-slate-200 dark:bg-slate-700 px-2 py-0.2 text-[10px] text-muted font-bold uppercase">
                                                    Customer Reply
                                                  </span>
                                                </>
                                              )}
                                            </span>
                                            <span className="text-[10px] text-muted">
                                              {new Date(m.created_at).toLocaleString()}
                                            </span>
                                          </div>
                                          <p className="text-xs text-foreground/90 whitespace-pre-wrap pl-5 leading-relaxed">{m.body}</p>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  {e.resolved_by_name && (
                                    <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-500/5 border border-emerald-500/20 p-2.5 rounded-xl">
                                      <CheckCircle2 size={14} />
                                      <span>Attended / resolved by <strong>{e.resolved_by_name}</strong> on {e.resolved_at ? new Date(e.resolved_at).toLocaleString() : 'N/A'}</span>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

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
                  const company = currentCompany?.name || "Paimbabook";
                  const html = buildFolioHtml(folioBooking, company, "R");
                  downloadPdfDocument(html, `checkin-proof-${folioBooking.bookingCode}`);
                }}
                className="rounded-xl border border-border-color px-4 py-2 text-xs font-bold text-foreground hover:bg-surface-elevated transition-all"
              >
                Download PDF
              </button>
              <button
                type="button"
                onClick={() => {
                  const company = currentCompany?.name || "Paimbabook";
                  const html = buildFolioHtml(folioBooking, company, "R");
                  const templates = buildCheckinEmailTemplates(folioBooking, company);
                  setShareModalDoc({
                    isOpen: true,
                    documentTitle: `Proof of Check-In - #${folioBooking.bookingCode} (${folioBooking.guestName})`,
                    documentType: "checkin",
                    documentHtml: html,
                    fileNameBase: `checkin-proof-${folioBooking.bookingCode}-${folioBooking.guestName.replace(/\s+/g, "_")}`,
                    ownerName: folioBooking.guestName,
                    ownerEmail: folioBooking.guestEmail || "",
                    defaultSubject: templates.ownerSubject,
                    defaultMessage: templates.ownerMessage,
                    emailTemplates: templates,
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
        emailTemplates={shareModalDoc.emailTemplates}
      />

      <ExpressCheckoutModal
        isOpen={expressCheckoutOpen}
        onClose={() => setExpressCheckoutOpen(false)}
        bookings={bookings}
        onCheckoutSuccess={loadData}
        onSelectBooking={(b) => {
          setDetailModalBooking(b);
          setExpressCheckoutOpen(false);
        }}
      />

      <CheckoutConfirmModal
        isOpen={Boolean(checkoutConfirmBooking)}
        booking={checkoutConfirmBooking}
        onClose={() => setCheckoutConfirmBooking(null)}
        onConfirm={handleConfirmCheckout}
        isProcessing={isCheckingOut}
      />

      <CheckoutHistoryModal
        isOpen={checkoutHistoryOpen}
        onClose={() => setCheckoutHistoryOpen(false)}
        bookings={bookings}
        onSelectBooking={(b) => {
          setDetailModalBooking(b);
          setCheckoutHistoryOpen(false);
        }}
        currency={currentCompany.currency || "ZAR"}
      />

      {/* Bookings Report Modal */}
      <BookingsReportModal
        isOpen={bookingsReportOpen}
        onClose={() => setBookingsReportOpen(false)}
        bookings={bookings}
        rooms={rooms}
        companyName={currentCompany.name}
      />

      {/* Email Selected Bookings / Reservations Modal */}
      {selectedRowsEmailOpen && (
        <ReportEmailDialog
          isOpen={selectedRowsEmailOpen}
          onClose={() => setSelectedRowsEmailOpen(false)}
          reportTitle={`${currentCompany.name} - Selected Bookings / Reservations Ledger (${activeTab === 'reservations' ? selectedReservationsList.length : selectedBookingsList.length} Records)`}
          reportHtml={`
            <p><strong>Company:</strong> ${currentCompany.name}</p>
            <p><strong>Period Filter:</strong> ${selectedPeriod}</p>
            <p><strong>Selected Records:</strong> ${activeTab === 'reservations' ? selectedReservationsList.length : selectedBookingsList.length}</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px;">
              <thead>
                <tr style="background: #f1f5f9; border-bottom: 2px solid #cbd5e1;">
                  <th style="padding: 8px; text-align: left;">Code</th>
                  <th style="padding: 8px; text-align: left;">Guest</th>
                  <th style="padding: 8px; text-align: left;">Room</th>
                  <th style="padding: 8px; text-align: left;">Dates</th>
                  <th style="padding: 8px; text-align: right;">Total</th>
                  <th style="padding: 8px; text-align: right;">Paid</th>
                  <th style="padding: 8px; text-align: center;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${(activeTab === 'reservations' ? selectedReservationsList : selectedBookingsList).map((b) => `
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 8px; font-family: monospace; font-weight: bold;">#${b.bookingCode}</td>
                    <td style="padding: 8px;">${b.guestName} (${b.guestPhone || ''})</td>
                    <td style="padding: 8px;">Room ${b.roomNumber} - ${b.propertyName}</td>
                    <td style="padding: 8px;">${b.checkInDate ? b.checkInDate.slice(0, 10) : ''} to ${b.checkOutDate ? b.checkOutDate.slice(0, 10) : ''}</td>
                    <td style="padding: 8px; text-align: right; font-weight: bold;">${currencySymbol}${(b.totalAmount || 0).toLocaleString()}</td>
                    <td style="padding: 8px; text-align: right; color: #16a34a;">${currencySymbol}${(b.amountPaid || 0).toLocaleString()}</td>
                    <td style="padding: 8px; text-align: center; font-size: 11px; text-transform: uppercase;">${b.bookingStatus}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
          onSuccess={() => {
            setSelectedBookingIds(new Set());
            setSelectedReservationIds(new Set());
          }}
        />
      )}
    </div>
  );
}

