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
  const [responseEmail, setResponseEmail] = useState("");
  const [showResponseEmailSetting, setShowResponseEmailSetting] = useState(false);
  const [responseEmailInput, setResponseEmailInput] = useState("");

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

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const matchesSearch =
        b.guestName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.bookingCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (b.roomNumber && b.roomNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        b.guestPhone.includes(searchQuery);

      const matchesStatus =
        statusFilter === "all" || b.bookingStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [bookings, searchQuery, statusFilter]);

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
            <option value="reserved">Reserved</option>
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
                paginatedBookings.map((b) => {
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
        <div className="overflow-hidden rounded-2xl border border-border-color bg-surface shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border-color bg-surface-elevated/70 text-[11px] font-bold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3.5">Booking Code</th>
                  <th className="px-4 py-3.5">Guest Details</th>
                  <th className="px-4 py-3.5">Room & Property</th>
                  <th className="px-4 py-3.5">Stay Dates</th>
                  <th className="px-4 py-3.5">Financials</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color text-foreground">
                {reservations.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-muted">
                      <div className="flex flex-col items-center justify-center">
                        <CalendarRange size={32} className="mb-2 text-indigo-400" />
                        <p>No pending reservations</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  reservations.map((b) => (
                    <tr key={b.id} className="hover:bg-surface-elevated/70 transition">
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
                        <p className="font-extrabold text-foreground">R{b.totalAmount.toLocaleString()}</p>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
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
      )}

      {activeTab === 'enquiries' && (
        <div className="space-y-4">
          {/* Response Email Setting Bar */}
          <div className="flex items-center gap-3 rounded-xl border border-border-color bg-surface p-3">
            <Mail size={15} className="text-muted shrink-0" />
            <div className="flex-1">
              <span className="text-xs font-medium text-muted">Response From Email: </span>
              {responseEmail ? (
                <span className="text-xs font-bold text-foreground">{responseEmail}</span>
              ) : (
                <span className="text-xs text-amber-600 font-medium">Not set - replies will use system default</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setResponseEmailInput(responseEmail);
                setShowResponseEmailSetting(true);
              }}
              className="flex items-center gap-1.5 rounded-lg border border-border-color bg-surface-elevated px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-elevated/80 transition"
            >
              <Pencil size={13} />
              Set Response Email
            </button>
          </div>

          {/* Response Email Setting Modal */}
          {showResponseEmailSetting && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <div className="w-full max-w-md rounded-2xl border border-border-color bg-surface p-6 shadow-2xl space-y-4">
                <h3 className="text-base font-bold text-foreground">Set Response Email Address</h3>
                <p className="text-xs text-muted">Emails sent from the Booking Enquiries tab will appear to come from this address. Make sure it's a monitored inbox.</p>
                <input
                  type="email"
                  placeholder="e.g. reservations@yourproperty.com"
                  value={responseEmailInput}
                  onChange={(e) => setResponseEmailInput(e.target.value)}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-blue-600"
                />
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowResponseEmailSetting(false)} className="rounded-lg border border-border-color px-4 py-2 text-xs font-medium text-muted hover:bg-surface-elevated">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setResponseEmail(responseEmailInput.trim());
                      setShowResponseEmailSetting(false);
                    }}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
                  >
                    Save Email
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Email Compose Modal */}
          {emailModalEnquiry && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
              <div className="w-full max-w-lg rounded-2xl border border-border-color bg-surface p-6 shadow-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-border-color pb-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">Compose Email Response</p>
                    <h3 className="text-base font-bold text-foreground">To: {emailModalEnquiry.customer_name}</h3>
                  </div>
                  <button onClick={() => setEmailModalEnquiry(null)} className="rounded-lg p-1.5 text-muted hover:bg-surface-elevated">
                    <X size={18} />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted block mb-1">From</label>
                    <div className="rounded-xl border border-border-color bg-surface-elevated/50 px-3 py-2 text-sm text-muted">
                      {responseEmail || 'system@paimbabook.com'}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted block mb-1">To</label>
                    <div className="rounded-xl border border-border-color bg-surface-elevated/50 px-3 py-2 text-sm text-foreground">
                      {emailModalEnquiry.customer_email}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted block mb-1">Subject</label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted block mb-1">Message</label>
                    <textarea
                      rows={6}
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      placeholder="Type your response here..."
                      className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-blue-600 resize-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button type="button" onClick={() => setEmailModalEnquiry(null)} className="rounded-lg border border-border-color px-4 py-2 text-xs font-medium text-muted hover:bg-surface-elevated">
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={sendingEmail || !emailBody.trim()}
                    onClick={async () => {
                      setSendingEmail(true);
                      try {
                        const { sendEnquiryResponseEmail } = await import('@/lib/enquiry-templates');
                        await sendEnquiryResponseEmail({
                          toEmail: emailModalEnquiry.customer_email,
                          customerName: emailModalEnquiry.customer_name,
                          propertyName: undefined,
                          enquiryId: emailModalEnquiry.id,
                          question: emailModalEnquiry.message,
                          response: emailBody,
                          companyName: currentCompany.name,
                        });
                        // Log to audit trail
                        const actorName = currentCompanyUser?.fullName || 'Staff';
                        await supabase.from('audit_logs').insert([{
                          company_id: currentCompany.id,
                          action: 'sent_email_response',
                          target_entity: 'enquiry',
                          target_id: emailModalEnquiry.id,
                          performed_by_name: actorName,
                          details: { subject: emailSubject, to: emailModalEnquiry.customer_email }
                        }]);
                        // Mark as in_progress
                        await supabase.from('enquiries').update({ status: 'in_progress' }).eq('id', emailModalEnquiry.id);
                        loadData();
                        setEmailModalEnquiry(null);
                        setEmailSubject('');
                        setEmailBody('');
                        alert('Email response sent successfully.');
                      } catch (err: any) {
                        alert('Failed to send email: ' + (err.message || String(err)));
                      } finally {
                        setSendingEmail(false);
                      }
                    }}
                    className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Send size={13} />
                    {sendingEmail ? 'Sending...' : 'Send Email'}
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
                    <th className="px-4 py-3.5">Message</th>
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
                          <p>No booking enquiries yet</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    bookingEnquiries.map((e) => (
                      <>
                        <tr key={e.id} className="hover:bg-surface-elevated/50 transition cursor-pointer" onClick={() => setExpandedEnquiryId(expandedEnquiryId === e.id ? null : e.id)}>
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
                              e.type === 'room_booking' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
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
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              e.status === 'open' ? 'bg-orange-100 text-orange-700' :
                              e.status === 'in_progress' ? 'bg-yellow-100 text-yellow-700' :
                              'bg-green-100 text-green-700'
                            }`}>
                              {e.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right" onClick={(ev) => ev.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {e.status !== 'resolved' && e.status !== 'in_progress' ? (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const actorName = currentCompanyUser?.fullName || 'Staff';
                                    await supabase.from('enquiries').update({
                                      status: 'in_progress',
                                      resolved_by_name: actorName,
                                      resolved_at: new Date().toISOString()
                                    }).eq('id', e.id);
                                    await supabase.from('audit_logs').insert([{
                                      company_id: currentCompany.id,
                                      action: 'attended_booking_enquiry',
                                      target_entity: 'enquiry',
                                      target_id: e.id,
                                      performed_by_name: actorName,
                                      details: { enquiry_type: e.type, customer_name: e.customer_name }
                                    }]);
                                    loadData();
                                  }}
                                  className="flex items-center gap-1 rounded-lg border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-xs font-semibold text-purple-600 hover:bg-purple-500/20"
                                >
                                  <CheckCircle2 size={13} />
                                  <span>Attend</span>
                                </button>
                              ) : (
                                <span className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-50/50 px-2.5 py-1 text-xs font-semibold text-emerald-600">
                                  <CheckCircle2 size={13} />
                                  Attended
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setEmailModalEnquiry(e);
                                  setEmailSubject(`Re: Your Booking Enquiry - ${currentCompany.name}`);
                                  setEmailBody('');
                                }}
                                className="flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-500/20"
                                title="Reply by email within the system"
                              >
                                <Mail size={13} />
                                <span>Reply</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                        {/* Expanded row */}
                        {expandedEnquiryId === e.id && (
                          <tr key={`${e.id}-expanded`}>
                            <td colSpan={7} className="px-6 pb-5 pt-0 bg-surface-elevated/30">
                              <div className="rounded-xl border border-border-color bg-surface p-4 space-y-4">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Full Enquiry Details</p>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                  <div>
                                    <span className="text-[11px] font-bold uppercase text-muted block mb-1">Customer Name</span>
                                    <p className="text-sm font-bold text-foreground">{e.customer_name}</p>
                                  </div>
                                  <div>
                                    <span className="text-[11px] font-bold uppercase text-muted block mb-1">Email Address</span>
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm text-foreground">{e.customer_email}</p>
                                      <button
                                        type="button"
                                        onClick={() => copyToClipboard(e.customer_email, `email-${e.id}`)}
                                        className="flex items-center gap-1 rounded-md bg-surface-elevated border border-border-color px-2 py-0.5 text-[11px] text-muted hover:text-foreground transition"
                                        title="Copy email"
                                      >
                                        {copiedField === `email-${e.id}` ? <CheckCircle2 size={12} className="text-emerald-600" /> : <Copy size={12} />}
                                        {copiedField === `email-${e.id}` ? 'Copied' : 'Copy'}
                                      </button>
                                    </div>
                                  </div>
                                  <div>
                                    <span className="text-[11px] font-bold uppercase text-muted block mb-1">Phone Number</span>
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm text-foreground">{e.customer_phone || 'Not provided'}</p>
                                      {e.customer_phone && (
                                        <button
                                          type="button"
                                          onClick={() => copyToClipboard(e.customer_phone, `phone-${e.id}`)}
                                          className="flex items-center gap-1 rounded-md bg-surface-elevated border border-border-color px-2 py-0.5 text-[11px] text-muted hover:text-foreground transition"
                                          title="Copy phone"
                                        >
                                          {copiedField === `phone-${e.id}` ? <CheckCircle2 size={12} className="text-emerald-600" /> : <Copy size={12} />}
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
                                        <span className="text-[11px] font-bold uppercase text-muted block mb-1">Check-in Date</span>
                                        <p className="text-sm text-foreground">{new Date(e.check_in_date).toLocaleDateString()}</p>
                                      </div>
                                    )}
                                    {e.check_out_date && (
                                      <div>
                                        <span className="text-[11px] font-bold uppercase text-muted block mb-1">Check-out Date</span>
                                        <p className="text-sm text-foreground">{new Date(e.check_out_date).toLocaleDateString()}</p>
                                      </div>
                                    )}
                                    {e.guests && (
                                      <div>
                                        <span className="text-[11px] font-bold uppercase text-muted block mb-1">Guests</span>
                                        <p className="text-sm text-foreground">{e.guests}</p>
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div>
                                  <span className="text-[11px] font-bold uppercase text-muted block mb-1">Full Message</span>
                                  <p className="text-sm text-foreground whitespace-pre-wrap rounded-xl bg-surface-elevated/50 border border-border-color p-3">{e.message}</p>
                                </div>

                                {e.resolved_by_name && (
                                  <div className="flex items-center gap-2 text-xs text-emerald-600">
                                    <CheckCircle2 size={13} />
                                    <span>Attended by {e.resolved_by_name} on {e.resolved_at ? new Date(e.resolved_at).toLocaleString() : 'N/A'}</span>
                                  </div>
                                )}

                                <div className="flex gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEmailModalEnquiry(e);
                                      setEmailSubject(`Re: Your Booking Enquiry - ${currentCompany.name}`);
                                      setEmailBody('');
                                    }}
                                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
                                  >
                                    <Mail size={13} />
                                    Reply by Email
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))
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
    </div>
  );
}

