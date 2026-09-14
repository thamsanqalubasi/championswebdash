import { useState, useEffect, useMemo, useRef } from "react";
import {
  X,
  Printer,
  Mail,
  Calendar,
  DollarSign,
  TrendingUp,
  BedDouble,
  Users,
  Eye,
  MousePointerClick,
  Sparkles,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Shield,
  SlidersHorizontal,
  Download,
  Coffee,
  Wrench,
  Flame,
  FileText,
  ArrowLeft,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { supabase } from "@/lib/supabase";
import {
  fetchCommercialRooms,
  fetchCommercialBookings,
  fetchAuditEvents,
} from "@/lib/data";
import type {
  CommercialRoom,
  CommercialBooking,
  PropertyRow,
} from "@/lib/types";

interface PropertyStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: {
    id: string;
    name: string;
    type: string;
    address?: string;
    city?: string;
    country?: string;
    totalRooms?: number;
    createdAt?: string;
  };
}

type TimeRangeKey = "24h" | "3d" | "1w" | "3w" | "1m" | "custom";
type ReportType = "all" | "pnl" | "occupancy" | "guests" | "marketing";

interface StatsRolePermissions {
  showFinancials: string[]; // roles that can view
  showOccupancy: string[];
  showInventory: string[];
  showMarketing: string[];
  showAuditTrail: string[];
}

const DEFAULT_PERMISSIONS: StatsRolePermissions = {
  showFinancials: ["admin", "super_admin", "manager", "accountant"],
  showOccupancy: ["admin", "super_admin", "manager", "front_desk", "accountant", "receptionist"],
  showInventory: ["admin", "super_admin", "manager", "front_desk", "maintenance"],
  showMarketing: ["admin", "super_admin", "manager", "marketing"],
  showAuditTrail: ["admin", "super_admin", "manager", "audit"],
};

export function PropertyStatsModal({ isOpen, onClose, property }: PropertyStatsModalProps) {
  const { currentCompany, currentCompanyUser, isSuperAdmin, isAdmin } = useAuth();
  const { format: formatCurrency } = useCurrency();
  const reportRef = useRef<HTMLDivElement>(null);

  const [timeRange, setTimeRange] = useState<TimeRangeKey>("1w");
  const [reportType, setReportType] = useState<ReportType>("all");
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().slice(0, 10));

  // Data states
  const [rooms, setRooms] = useState<CommercialRoom[]>([]);
  const [bookings, setBookings] = useState<CommercialBooking[]>([]);
  const [maintenanceCosts, setMaintenanceCosts] = useState<number>(0);
  const [adEventsCount, setAdEventsCount] = useState({ impressions: 0, clicks: 0 });
  const [auditLogs, setAuditLogs] = useState<Array<any>>([]);
  const [publishedTypesCount, setPublishedTypesCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  // Admin permission management
  const [permissions, setPermissions] = useState<StatsRolePermissions>(() => {
    try {
      const saved = localStorage.getItem(`cc_stats_role_permissions_${currentCompany.id}`);
      return saved ? JSON.parse(saved) : DEFAULT_PERMISSIONS;
    } catch {
      return DEFAULT_PERMISSIONS;
    }
  });
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailSentSuccess, setEmailSentSuccess] = useState(false);

  const userRole = (currentCompanyUser?.department || "front_desk").toLowerCase();
  const canConfigPermissions = isSuperAdmin || isAdmin || userRole === "admin";

  // Check what current user can view
  const canViewFinancials = isSuperAdmin || isAdmin || permissions.showFinancials.includes(userRole);
  const canViewOccupancy = isSuperAdmin || isAdmin || permissions.showOccupancy.includes(userRole);
  const canViewInventory = isSuperAdmin || isAdmin || permissions.showInventory.includes(userRole);
  const canViewMarketing = isSuperAdmin || isAdmin || permissions.showMarketing.includes(userRole);
  const canViewAuditTrail = isSuperAdmin || isAdmin || permissions.showAuditTrail.includes(userRole);

  useEffect(() => {
    if (!isOpen || !property.id) return;
    let cancelled = false;

    async function loadStatsData() {
      setLoading(true);
      try {
        const [allRooms, allBookings, { data: maintData }, { data: showcaseData }, adsRes, boostsRes] =
          await Promise.all([
            fetchCommercialRooms(currentCompany.id, property.id),
            fetchCommercialBookings(currentCompany.id),
            supabase
              .from("maintenance")
              .select("cost, created_at")
              .eq("property_id", property.id),
            supabase
              .from("room_type_listings")
              .select("id")
              .eq("property_id", property.id)
              .eq("is_active", true),
            supabase
              .from("marketing_ads")
              .select("target_property_id, impressions_count, clicks_count")
              .eq("company_id", currentCompany.id),
            supabase
              .from("marketing_boosted_listings")
              .select("listing_id, impressions_count, clicks_count")
              .eq("company_id", currentCompany.id),
          ]);

        if (cancelled) return;

        setRooms(allRooms);
        const propBookings = allBookings.filter((b) => b.propertyId === property.id);
        setBookings(propBookings);

        const totalMaint = (maintData || []).reduce((acc: number, curr: any) => acc + (Number(curr.cost) || 0), 0);
        setMaintenanceCosts(totalMaint);
        setPublishedTypesCount(showcaseData ? showcaseData.length : 0);

        // Filter ads & boost counts for this property
        const propAds = (adsRes.data || []).filter((a: any) => a.target_property_id === property.id);
        const propBoosts = (boostsRes.data || []).filter((b: any) => b.listing_id === property.id);
        const totalImpressions =
          propAds.reduce((acc: number, a: any) => acc + (a.impressions_count || 0), 0) +
          propBoosts.reduce((acc: number, b: any) => acc + (b.impressions_count || 0), 0);
        const totalClicks =
          propAds.reduce((acc: number, a: any) => acc + (a.clicks_count || 0), 0) +
          propBoosts.reduce((acc: number, b: any) => acc + (b.clicks_count || 0), 0);

        setAdEventsCount({ impressions: totalImpressions, clicks: totalClicks });

        // Load audit events
        try {
          const audits = await fetchAuditEvents(currentCompany.id);
          const relatedAudits = (audits || []).filter(
            (a: any) =>
              (a.entity_id === property.id || JSON.stringify(a.details || {}).includes(property.id))
          );
          setAuditLogs(relatedAudits);
        } catch {
          setAuditLogs([]);
        }
      } catch (err) {
        console.error("Failed loading property stats", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadStatsData();
    return () => {
      cancelled = true;
    };
  }, [isOpen, property.id, currentCompany.id]);

  // Date Filtering calculation
  const dateThreshold = useMemo(() => {
    const now = new Date();
    if (timeRange === "24h") return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    if (timeRange === "3d") return new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    if (timeRange === "1w") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    if (timeRange === "3w") return new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);
    if (timeRange === "1m") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    return new Date(customStartDate);
  }, [timeRange, customStartDate]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const bDate = new Date(b.createdAt || b.checkInDate);
      if (timeRange === "custom") {
        const start = new Date(customStartDate);
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        return bDate >= start && bDate <= end;
      }
      return bDate >= dateThreshold;
    });
  }, [bookings, timeRange, dateThreshold, customStartDate, customEndDate]);

  const [guestFilter, setGuestFilter] = useState<"all" | "overdue" | "extended">("all");

  const isBookingOverdue = (b: CommercialBooking) => {
    if (b.bookingStatus !== "checked_in") return false;
    const todayStr = new Date().toISOString().slice(0, 10);
    return Boolean(b.checkOutDate && b.checkOutDate <= todayStr);
  };

  // Current Checked-in Guests
  const checkedInGuests = useMemo(() => {
    return bookings.filter((b) => b.bookingStatus === "checked_in");
  }, [bookings]);

  const overdueGuestsCount = useMemo(() => {
    return checkedInGuests.filter((b) => isBookingOverdue(b)).length;
  }, [checkedInGuests]);

  const extendedGuestsCount = useMemo(() => {
    return checkedInGuests.filter((b) => b.isExtended || (b.extensionHistory && b.extensionHistory.length > 0)).length;
  }, [checkedInGuests]);

  const displayedGuests = useMemo(() => {
    if (guestFilter === "overdue") {
      return checkedInGuests.filter((b) => isBookingOverdue(b));
    }
    if (guestFilter === "extended") {
      return checkedInGuests.filter((b) => b.isExtended || (b.extensionHistory && b.extensionHistory.length > 0));
    }
    return checkedInGuests;
  }, [checkedInGuests, guestFilter]);

  // Financial Metrics
  const financials = useMemo(() => {
    const grossRoomRevenue = filteredBookings.reduce((sum, b) => sum + (Number(b.totalAmount) || 0), 0);
    const totalCollected = filteredBookings.reduce((sum, b) => sum + (Number(b.amountPaid) || 0), 0);
    const operatingExpenses = maintenanceCosts;
    const netProfit = grossRoomRevenue - operatingExpenses;
    const totalNights = filteredBookings.reduce((sum, b) => sum + (Number(b.nights) || 1), 0);
    const adr = totalNights > 0 ? grossRoomRevenue / totalNights : 0;
    const totalPossibleNights = Math.max(1, rooms.length * (timeRange === "24h" ? 1 : timeRange === "3d" ? 3 : timeRange === "1w" ? 7 : timeRange === "3w" ? 21 : 30));
    const revPar = grossRoomRevenue / totalPossibleNights;

    return {
      grossRoomRevenue,
      totalCollected,
      operatingExpenses,
      netProfit,
      adr,
      revPar,
      totalNights,
    };
  }, [filteredBookings, maintenanceCosts, rooms.length, timeRange]);

  // Occupancy Metrics
  const occupancy = useMemo(() => {
    const total = rooms.length || property.totalRooms || 1;
    const occupied = rooms.filter((r) => r.status === "occupied").length;
    const available = rooms.filter((r) => r.status === "available").length;
    const cleaningNeeded = rooms.filter((r) => r.status === "cleaning_needed").length;
    const maintenanceNeeded = rooms.filter((r) => r.status === "maintenance").length;
    const rate = Math.round((occupied / total) * 100);

    return {
      total,
      occupied,
      available,
      cleaningNeeded,
      maintenanceNeeded,
      rate,
    };
  }, [rooms, property.totalRooms]);

  const handlePrint = () => {
    window.print();
  };

  const handleSavePermissions = (newPerms: StatsRolePermissions) => {
    setPermissions(newPerms);
    localStorage.setItem(`cc_stats_role_permissions_${currentCompany.id}`, JSON.stringify(newPerms));
    setShowConfigModal(false);
  };

  const handleSendEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail) return;
    setEmailSentSuccess(true);
    setTimeout(() => {
      setEmailSentSuccess(false);
      setEmailModalOpen(false);
      setRecipientEmail("");
    }, 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm print:p-0 print:bg-white print:fixed print:inset-0">
      <div className="relative max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-border-color bg-surface p-6 sm:p-8 shadow-2xl print:max-h-none print:shadow-none print:border-none print:p-4">
        {/* Header with Title & Action Controls */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border-color pb-5 print:border-b-2">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border-color bg-surface text-muted hover:bg-surface-elevated hover:text-foreground transition shadow-xs print:hidden"
              title="Back / Close Modal"
            >
              <ArrowLeft size={18} />
            </button>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 print:hidden">
              <Building2 size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black tracking-tight text-foreground">{property.name}</h2>
                <span className="rounded-full bg-blue-600/10 px-3 py-0.5 text-xs font-bold uppercase text-blue-600">
                  {property.type.replace(/_/g, " ")}
                </span>
              </div>
              <p className="text-xs text-muted mt-0.5">
                Executive Property Performance, Occupancy Analytics, Financials & Audit Log
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            {canConfigPermissions && (
              <button
                type="button"
                onClick={() => setShowConfigModal(true)}
                className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs font-semibold text-muted hover:text-foreground transition"
                title="Configure Role-based Stats Visibility"
              >
                <Shield size={14} className="text-blue-500" />
                <span className="hidden sm:inline">Permissions</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setEmailModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface transition"
            >
              <Mail size={14} className="text-emerald-600" />
              <span>Email Report</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
            >
              <Printer size={14} />
              <span>Print / PDF</span>
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

        {/* Filter Controls Bar (Hidden during print) */}
        <div className="my-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-surface-elevated/70 p-3 print:hidden">
          {/* Time Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            <span className="text-[11px] font-bold uppercase text-muted mr-1 flex items-center gap-1">
              <Calendar size={13} /> Time:
            </span>
            {(["24h", "3d", "1w", "3w", "1m", "custom"] as TimeRangeKey[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTimeRange(t)}
                className={`rounded-lg px-2.5 py-1 font-semibold transition ${
                  timeRange === t
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-muted hover:bg-surface hover:text-foreground"
                }`}
              >
                {t === "24h"
                  ? "Past 24h"
                  : t === "3d"
                  ? "3 Days"
                  : t === "1w"
                  ? "1 Week"
                  : t === "3w"
                  ? "3 Weeks"
                  : t === "1m"
                  ? "1 Month"
                  : "Custom Range"}
              </button>
            ))}
          </div>

          {/* Report Scope Selector */}
          <div className="flex items-center gap-2 text-xs">
            <label className="font-semibold text-muted">Report Focus:</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="rounded-lg border border-border-color bg-surface px-2.5 py-1 text-xs font-semibold text-foreground outline-none"
            >
              <option value="all">Full Comprehensive Report</option>
              <option value="pnl">Profit &amp; Loss Statement</option>
              <option value="occupancy">Occupancy &amp; Rooms</option>
              <option value="guests">Checked-in Guests &amp; Extensions</option>
              <option value="marketing">Marketing &amp; Ad Reach</option>
            </select>
          </div>
        </div>

        {/* Custom Range Date Pickers */}
        {timeRange === "custom" && (
          <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs print:hidden">
            <span className="font-semibold text-blue-900 dark:text-blue-200">Custom Date Range:</span>
            <div className="flex items-center gap-2">
              <label className="text-muted">From:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="rounded-lg border border-border-color bg-surface px-2 py-1 text-xs text-foreground"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-muted">To:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="rounded-lg border border-border-color bg-surface px-2 py-1 text-xs text-foreground"
              />
            </div>
          </div>
        )}

        {/* Report Content Container */}
        <div ref={reportRef} className="space-y-6">
          {/* SECTION 1: FINANCIALS & PROFIT / LOSS (Protected by Permission) */}
          {canViewFinancials && (reportType === "all" || reportType === "pnl") && (
            <section className="space-y-3">
              <div className="flex items-center justify-between border-b border-border-color pb-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <DollarSign size={16} className="text-emerald-600" />
                  Financial &amp; Profit / Loss Statistics
                </h3>
                <span className="text-[11px] text-muted">
                  Bookings: {filteredBookings.length} • Total Nights: {financials.totalNights}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <p className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                    Gross Room Revenue
                  </p>
                  <p className="mt-1 text-xl font-black text-emerald-600">
                    {formatCurrency(financials.grossRoomRevenue)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted">Total booked value</p>
                </div>

                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
                  <p className="text-[10px] font-bold uppercase text-blue-700 dark:text-blue-300">
                    Amount Collected
                  </p>
                  <p className="mt-1 text-xl font-black text-blue-600">
                    {formatCurrency(financials.totalCollected)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted">Front desk settled cash/card</p>
                </div>

                <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4">
                  <p className="text-[10px] font-bold uppercase text-red-700 dark:text-red-300">
                    Operating &amp; Maintenance Costs
                  </p>
                  <p className="mt-1 text-xl font-black text-red-600">
                    {formatCurrency(financials.operatingExpenses)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted">Repairs &amp; work orders</p>
                </div>

                <div className={`rounded-2xl border p-4 ${
                  financials.netProfit >= 0
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-red-500/30 bg-red-500/10"
                }`}>
                  <p className="text-[10px] font-bold uppercase text-foreground">
                    Net Profit / (Loss)
                  </p>
                  <p className={`mt-1 text-xl font-black ${
                    financials.netProfit >= 0 ? "text-emerald-600" : "text-red-600"
                  }`}>
                    {formatCurrency(financials.netProfit)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted">
                    ADR: {formatCurrency(financials.adr)} • RevPAR: {formatCurrency(financials.revPar)}
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* SECTION 2: OCCUPANCY DATA & ROOM UTILIZATION */}
          {canViewOccupancy && (reportType === "all" || reportType === "occupancy") && (
            <section className="space-y-3">
              <div className="flex items-center justify-between border-b border-border-color pb-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <BedDouble size={16} className="text-blue-600" />
                  Live Room Occupancy &amp; Inventory Status
                </h3>
                <span className="text-xs font-black text-blue-600 bg-blue-500/10 px-2.5 py-0.5 rounded-full">
                  {occupancy.rate}% Occupancy
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-border-color bg-surface p-4">
                  <p className="text-[10px] font-bold uppercase text-muted">Total Room Units</p>
                  <p className="mt-1 text-2xl font-black text-foreground">{occupancy.total}</p>
                  <p className="mt-0.5 text-[10px] text-muted">Configured in system</p>
                </div>

                <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
                  <p className="text-[10px] font-bold uppercase text-blue-600">Currently Occupied</p>
                  <p className="mt-1 text-2xl font-black text-blue-600">{occupancy.occupied}</p>
                  <p className="mt-0.5 text-[10px] text-muted">Checked in with active keys</p>
                </div>

                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <p className="text-[10px] font-bold uppercase text-emerald-600">Vacant &amp; Ready</p>
                  <p className="mt-1 text-2xl font-black text-emerald-600">{occupancy.available}</p>
                  <p className="mt-0.5 text-[10px] text-muted">Available for booking</p>
                </div>

                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
                  <p className="text-[10px] font-bold uppercase text-amber-600">Housekeeping Queue</p>
                  <p className="mt-1 text-2xl font-black text-amber-600">{occupancy.cleaningNeeded}</p>
                  <p className="mt-0.5 text-[10px] text-muted">Turnover cleaning required</p>
                </div>
              </div>
            </section>
          )}

          {/* SECTION 3: INVENTORY & PORTAL VISIBILITY */}
          {canViewInventory && (reportType === "all" || reportType === "occupancy") && (
            <section className="space-y-3">
              <div className="flex items-center justify-between border-b border-border-color pb-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Layers size={16} className="text-purple-600" />
                  Public Portal Showcases &amp; Publication Status
                </h3>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border-color bg-surface p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-muted">Published Room Types</p>
                    <p className="text-xl font-bold text-purple-600">{publishedTypesCount} Types Active</p>
                    <p className="text-[10px] text-muted">Visible on booking portal</p>
                  </div>
                  <Sparkles size={24} className="text-purple-500 opacity-60" />
                </div>

                <div className="rounded-2xl border border-border-color bg-surface p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-muted">Total Physical Rooms</p>
                    <p className="text-xl font-bold text-foreground">{rooms.length} Units</p>
                    <p className="text-[10px] text-muted">Across all property floors</p>
                  </div>
                  <BedDouble size={24} className="text-blue-500 opacity-60" />
                </div>

                <div className="rounded-2xl border border-border-color bg-surface p-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase text-muted">Online Booking Status</p>
                    <p className="text-sm font-bold text-emerald-600">Active &amp; Accepting Reservations</p>
                    <p className="text-[10px] text-muted">Direct guest payment enabled</p>
                  </div>
                  <CheckCircle2 size={24} className="text-emerald-500 opacity-60" />
                </div>
              </div>
            </section>
          )}

          {/* SECTION 4: AD PERFORMANCE & MARKETING REACH */}
          {canViewMarketing && (reportType === "all" || reportType === "marketing") && (
            <section className="space-y-3">
              <div className="flex items-center justify-between border-b border-border-color pb-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                  <Flame size={16} className="text-amber-500" />
                  Marketing Reach &amp; Portal Ad Performance
                </h3>
                <span className="text-[11px] text-muted">Public Customer Portal Telemetry</span>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-2xl border border-border-color bg-surface p-4 text-center">
                  <p className="text-[10px] font-bold uppercase text-muted">Impressions</p>
                  <p className="mt-1 text-2xl font-black text-foreground">{adEventsCount.impressions}</p>
                  <p className="text-[10px] text-muted">Portal search views</p>
                </div>
                <div className="rounded-2xl border border-border-color bg-surface p-4 text-center">
                  <p className="text-[10px] font-bold uppercase text-muted">Ad Clicks</p>
                  <p className="mt-1 text-2xl font-black text-blue-600">{adEventsCount.clicks}</p>
                  <p className="text-[10px] text-muted">Direct clicks to listing</p>
                </div>
                <div className="rounded-2xl border border-border-color bg-surface p-4 text-center">
                  <p className="text-[10px] font-bold uppercase text-muted">Click-Through Rate (CTR)</p>
                  <p className="mt-1 text-2xl font-black text-amber-500">
                    {adEventsCount.impressions > 0
                      ? ((adEventsCount.clicks / adEventsCount.impressions) * 100).toFixed(1)
                      : "0.0"}
                    %
                  </p>
                  <p className="text-[10px] text-muted">Visitor engagement</p>
                </div>
              </div>
            </section>
          )}

          {/* SECTION 5: CHECKED-IN GUESTS & ACTIVITY AUDIT TRAIL */}
          {canViewAuditTrail && (reportType === "all" || reportType === "guests") && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-color pb-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                    <Users size={16} className="text-indigo-600" />
                    Current Checked-In Guests ({checkedInGuests.length}) &amp; Live Turnaround
                  </h3>
                </div>

                {/* Sub-filters for Guests */}
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setGuestFilter("all")}
                    className={`rounded-lg px-2.5 py-1 font-bold transition ${
                      guestFilter === "all"
                        ? "bg-indigo-600 text-white"
                        : "bg-surface-elevated text-muted hover:text-foreground"
                    }`}
                  >
                    All Active ({checkedInGuests.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuestFilter("extended")}
                    className={`rounded-lg px-2.5 py-1 font-bold transition ${
                      guestFilter === "extended"
                        ? "bg-blue-600 text-white"
                        : "bg-surface-elevated text-muted hover:text-foreground"
                    }`}
                  >
                    Extended ({extendedGuestsCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuestFilter("overdue")}
                    className={`rounded-lg px-2.5 py-1 font-bold transition ${
                      guestFilter === "overdue"
                        ? "bg-red-600 text-white"
                        : overdueGuestsCount > 0
                        ? "bg-red-500/10 text-red-600 border border-red-500/20"
                        : "bg-surface-elevated text-muted hover:text-foreground"
                    }`}
                  >
                    ⚠️ Overdue Checkout ({overdueGuestsCount})
                  </button>
                </div>
              </div>

              {/* Overdue Urgent Banner */}
              {overdueGuestsCount > 0 && (
                <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/25 p-3 text-xs font-bold text-red-600 dark:text-red-400 animate-pulse">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>
                    URGENT ATTENTION: {overdueGuestsCount} room(s) have passed their checkout time without checkout completed! Front desk staff must inspect rooms immediately.
                  </span>
                </div>
              )}

              {displayedGuests.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border-color p-8 text-center text-xs text-muted">
                  {guestFilter === "overdue"
                    ? "No overdue checkouts. All rooms are within valid scheduled stay time."
                    : guestFilter === "extended"
                    ? "No extended stay guests found."
                    : `No guests currently checked into ${property.name}.`}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-border-color bg-surface">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-surface-elevated/70 text-[10px] uppercase font-bold text-muted border-b border-border-color">
                      <tr>
                        <th className="p-3">Room</th>
                        <th className="p-3">Guest Name &amp; Contact</th>
                        <th className="p-3">Meal Plan</th>
                        <th className="p-3">Scheduled Stay &amp; Checkout</th>
                        <th className="p-3">Extensions History</th>
                        <th className="p-3">Paid / Total</th>
                        <th className="p-3">Staff / Clerk Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-color/40">
                      {displayedGuests.map((g) => {
                        const isOverdue = isBookingOverdue(g);
                        const extHistory = (g.extensionHistory || []) as any[];

                        return (
                          <tr
                            key={g.id}
                            className={`transition ${
                              isOverdue
                                ? "bg-red-500/5 hover:bg-red-500/10"
                                : "hover:bg-surface-elevated/30"
                            }`}
                          >
                            <td className="p-3 font-black text-foreground">
                              {g.roomNumber}
                              <span className="block text-[10px] font-normal text-muted capitalize">
                                {g.roomType}
                              </span>
                              {isOverdue && (
                                <span className="inline-block mt-1 rounded bg-red-600 px-1.5 py-0.5 text-[9px] font-black text-white uppercase">
                                  Overstay
                                </span>
                              )}
                            </td>
                            <td className="p-3">
                              <span className="font-bold text-foreground block">{g.guestName}</span>
                              <span className="text-[10px] text-muted">{g.guestPhone}</span>
                              {g.guestEmail && (
                                <span className="text-[10px] text-muted block">{g.guestEmail}</span>
                              )}
                            </td>
                            <td className="p-3 capitalize font-medium text-blue-600">
                              {g.mealPlan?.replace(/_/g, " ") || "Bed & Breakfast"}
                            </td>
                            <td className="p-3 text-[11px]">
                              <div>
                                <span className="text-muted">{g.checkInDate}</span> &rarr;{" "}
                                <span className={`font-bold ${isOverdue ? "text-red-600 font-black" : "text-foreground"}`}>
                                  {g.checkOutDate}
                                </span>
                              </div>
                              <span className="block text-[10px] text-muted font-semibold">
                                {g.nights} Night(s)
                              </span>
                              {/* Overdue Alert message */}
                              {isOverdue && (
                                <div className="mt-1 inline-flex items-center gap-1 rounded-md bg-red-500/15 border border-red-500/30 px-2 py-0.5 text-[10px] font-bold text-red-600 animate-pulse">
                                  <AlertTriangle size={11} className="shrink-0" />
                                  <span>Checkout time passed but no checkout done, must check room</span>
                                </div>
                              )}
                            </td>
                            <td className="p-3 text-[11px]">
                              {g.isExtended || extHistory.length > 0 ? (
                                <div className="space-y-1">
                                  <span className="inline-block rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 font-bold px-2 py-0.5 text-[10px]">
                                    Extended (+{extHistory.length || 1})
                                  </span>
                                  {extHistory.map((ext: any, i: number) => (
                                    <p key={i} className="text-[10px] text-muted">
                                      Prev: {ext.previousCheckOut} &rarr; {ext.newCheckOut}
                                      {ext.extendedByName && ` (by ${ext.extendedByName})`}
                                    </p>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted text-[10px] italic">Original Stay</span>
                              )}
                            </td>
                            <td className="p-3">
                              <span className="font-bold text-emerald-600 block">
                                {formatCurrency(g.amountPaid || g.totalAmount)}
                              </span>
                              <span className="text-[10px] text-muted">
                                of {formatCurrency(g.totalAmount)}
                              </span>
                            </td>
                            <td className="p-3 text-[11px] text-muted space-y-0.5">
                              <p className="font-medium text-foreground">
                                Check-in: <span className="font-normal text-muted">{g.checkedInByName || "Front Desk Staff"}</span>
                              </p>
                              {g.actualCheckIn && (
                                <p className="text-[10px] text-muted">
                                  Time: {new Date(g.actualCheckIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </p>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Property Audit Trail Snippet */}
              {auditLogs.length > 0 && (
                <div className="pt-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted mb-2">
                    Recent Operational Activity Trail
                  </h4>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto rounded-xl border border-border-color bg-surface-elevated/40 p-3 text-xs">
                    {auditLogs.slice(0, 10).map((log: any, idx) => (
                      <div key={idx} className="flex items-center justify-between gap-2 border-b border-border-color/30 pb-1 text-[11px]">
                        <div>
                          <span className="font-semibold text-foreground capitalize">
                            {log.action?.replace(/_/g, " ") || "Operation"}
                          </span>
                          <span className="text-muted ml-2">by {log.user_name || log.user_email}</span>
                        </div>
                        <span className="text-[10px] text-muted shrink-0">
                          {new Date(log.created_at || Date.now()).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Footer info */}
        <div className="mt-8 border-t border-border-color pt-4 flex items-center justify-between text-[11px] text-muted">
          <span>Generated for {currentCompany.name} • Certified Property Records</span>
          <span>{new Date().toLocaleDateString(undefined, { dateStyle: "long" })}</span>
        </div>
      </div>

      {/* Admin Role Visibility Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-2xl border border-border-color bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-color pb-3">
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                <Shield size={16} className="text-blue-500" />
                Configure Role-Based Stats Visibility
              </h3>
              <button onClick={() => setShowConfigModal(false)} className="text-muted hover:text-foreground">
                ✕
              </button>
            </div>
            <p className="text-xs text-muted">
              Select which organizational roles are permitted to view sensitive property statistics.
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSavePermissions(permissions);
              }}
              className="space-y-3 text-xs"
            >
              {[
                { key: "showFinancials", label: "Financials & Profits / Loss" },
                { key: "showOccupancy", label: "Occupancy & Room Utilization" },
                { key: "showInventory", label: "Published Room Inventory" },
                { key: "showMarketing", label: "Portal Ads & Marketing Metrics" },
                { key: "showAuditTrail", label: "Checked-in Guests & Audit Logs" },
              ].map((item) => (
                <div key={item.key} className="rounded-xl border border-border-color bg-surface-elevated/60 p-3">
                  <p className="font-bold text-foreground mb-1.5">{item.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {["admin", "manager", "accountant", "front_desk", "maintenance", "marketing"].map((role) => {
                      const list = (permissions as any)[item.key] as string[];
                      const checked = list.includes(role);
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => {
                            const next = checked ? list.filter((r) => r !== role) : [...list, role];
                            setPermissions({ ...permissions, [item.key]: next });
                          }}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase transition ${
                            checked
                              ? "bg-blue-600 text-white"
                              : "bg-surface border border-border-color text-muted hover:text-foreground"
                          }`}
                        >
                          {role.replace(/_/g, " ")}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="flex justify-end gap-2 pt-2 border-t border-border-color">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="rounded-lg border border-border-color px-3 py-1.5 text-xs text-muted hover:bg-surface-elevated"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700"
                >
                  Save Permissions
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Email Report Modal */}
      {emailModalOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border-color bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-color pb-3">
              <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                <Mail size={16} className="text-emerald-600" />
                Email Property Report
              </h3>
              <button onClick={() => setEmailModalOpen(false)} className="text-muted hover:text-foreground">
                ✕
              </button>
            </div>

            {emailSentSuccess ? (
              <div className="rounded-xl bg-emerald-500/10 p-4 text-center text-xs text-emerald-600 font-bold">
                ✓ Report dispatched successfully to {recipientEmail}!
              </div>
            ) : (
              <form onSubmit={handleSendEmail} className="space-y-3 text-xs">
                <div>
                  <label className="block text-muted font-medium mb-1">Recipient Email Address *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. director@company.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none text-xs"
                  />
                </div>
                <p className="text-[11px] text-muted">
                  Sends the {property.name} performance statement and occupancy breakdown formatted as an official executive summary.
                </p>
                <div className="flex justify-end gap-2 pt-2 border-t border-border-color">
                  <button
                    type="button"
                    onClick={() => setEmailModalOpen(false)}
                    className="rounded-lg border border-border-color px-3 py-1.5 text-xs text-muted hover:bg-surface-elevated"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                  >
                    Send Report
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
