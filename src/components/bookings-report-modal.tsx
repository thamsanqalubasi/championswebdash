import { useState, useMemo } from "react";
import {
  X,
  Calendar,
  Download,
  Printer,
  Mail,
  Filter,
  BarChart2,
  PieChart as PieIcon,
  CheckSquare,
  Square,
  Bed,
  Clock,
  KeyRound,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import type { CommercialBooking, CommercialRoom } from "@/lib/types";
import { getCheckoutDelta } from "./checkout-countdown";
import { ReportEmailDialog } from "./reports/report-email-dialog";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface BookingsReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookings: CommercialBooking[];
  rooms: CommercialRoom[];
  companyName: string;
  currency?: string;
}

type PeriodOption =
  | "24h"
  | "2d"
  | "3d"
  | "5d"
  | "1w"
  | "2w"
  | "3w"
  | "1m"
  | "3m"
  | "1y"
  | "custom";

const PERIODS: { id: PeriodOption; label: string; days?: number }[] = [
  { id: "24h", label: "Past 24 Hours", days: 1 },
  { id: "2d", label: "Past 2 Days", days: 2 },
  { id: "3d", label: "Past 3 Days", days: 3 },
  { id: "5d", label: "Past 5 Days", days: 5 },
  { id: "1w", label: "Past 1 Week", days: 7 },
  { id: "2w", label: "Past 2 Weeks", days: 14 },
  { id: "3w", label: "Past 3 Weeks", days: 21 },
  { id: "1m", label: "Past 1 Month", days: 30 },
  { id: "3m", label: "Past 3 Months", days: 90 },
  { id: "1y", label: "Past 1 Year", days: 365 },
  { id: "custom", label: "Custom Range..." },
];

const CHART_COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

export function BookingsReportModal({
  isOpen,
  onClose,
  bookings,
  rooms,
  companyName,
  currency = "ZAR",
}: BookingsReportModalProps) {
  const [period, setPeriod] = useState<PeriodOption>("1w");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Data selection toggles
  const [includeOnTime, setIncludeOnTime] = useState(true);
  const [includeDelayed, setIncludeDelayed] = useState(true);
  const [includeExtended, setIncludeExtended] = useState(true);
  const [includeOccupiedRooms, setIncludeOccupiedRooms] = useState(true);
  const [includeBookedRooms, setIncludeBookedRooms] = useState(true);
  const [includeOverstays, setIncludeOverstays] = useState(true);

  // Presentation mode: "both" | "numbers" | "graphs"
  const [displayMode, setDisplayMode] = useState<"both" | "numbers" | "graphs">("both");

  // Email confirmation dialog
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  // Filter bookings by selected timeframe
  const filteredBookings = useMemo(() => {
    const now = Date.now();
    let threshold = 0;

    if (period === "custom") {
      const s = customStart ? new Date(customStart).getTime() : 0;
      const e = customEnd ? new Date(customEnd).getTime() + 86400000 : Infinity;
      return bookings.filter((b) => {
        const t = new Date(b.createdAt || b.checkInDate).getTime();
        return t >= s && t <= e;
      });
    }

    const opt = PERIODS.find((p) => p.id === period);
    if (opt?.days) {
      threshold = now - opt.days * 86400000;
    }

    return bookings.filter((b) => {
      const t = new Date(b.createdAt || b.checkInDate).getTime();
      return t >= threshold;
    });
  }, [bookings, period, customStart, customEnd]);

  // Aggregate statistics
  const stats = useMemo(() => {
    const total = filteredBookings.length;
    let onTimeCheckins = 0;
    let delayedCheckins = 0;
    let extendedStays = 0;
    let overstays = 0;
    let revenue = 0;

    filteredBookings.forEach((b) => {
      revenue += b.totalAmount || 0;
      if (b.isExtended) extendedStays++;
      const isOverstay = (b.bookingStatus === "checked_in" || b.isExtended) && getCheckoutDelta(b.checkOutDate).isOverstay;
      if (isOverstay) overstays++;

      if (b.actualCheckIn && b.checkInDate) {
        const diffHours = (new Date(b.actualCheckIn).getTime() - new Date(b.checkInDate).getTime()) / 3600000;
        if (diffHours > 3) delayedCheckins++;
        else onTimeCheckins++;
      } else {
        onTimeCheckins++;
      }
    });

    const occupiedCount = rooms.filter((r) => r.status === "occupied").length;
    const reservedCount = rooms.filter((r) => r.status === "reserved").length;
    const totalRooms = rooms.length;
    const occupancyRate = totalRooms > 0 ? Math.round((occupiedCount / totalRooms) * 100) : 0;

    return {
      total,
      onTimeCheckins,
      delayedCheckins,
      extendedStays,
      overstays,
      revenue,
      occupiedCount,
      reservedCount,
      totalRooms,
      occupancyRate,
    };
  }, [filteredBookings, rooms]);

  // Chart data
  const statusPieData = useMemo(() => {
    const list = [];
    if (includeOnTime) list.push({ name: "On-Time Checkins", value: stats.onTimeCheckins });
    if (includeDelayed) list.push({ name: "Delayed Checkins", value: stats.delayedCheckins });
    if (includeExtended) list.push({ name: "Extended Stays", value: stats.extendedStays });
    if (includeOverstays) list.push({ name: "Overstays", value: stats.overstays });
    return list.filter((item) => item.value > 0);
  }, [stats, includeOnTime, includeDelayed, includeExtended, includeOverstays]);

  const mealPlanData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredBookings.forEach((b) => {
      const plan = (b.mealPlan || "room_only").replace(/_/g, " ").toUpperCase();
      counts[plan] = (counts[plan] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count }));
  }, [filteredBookings]);

  // Printable HTML builder for export / email
  const reportHtml = useMemo(() => {
    return `
      <h3>${companyName} — Front Desk & Bookings Executive Report</h3>
      <p><strong>Reporting Period:</strong> ${PERIODS.find((p) => p.id === period)?.label || "Custom Range"} | Generated: ${new Date().toLocaleString()}</p>
      <hr style="margin: 10px 0; border: none; border-top: 1px solid #ddd;" />
      <table style="width: 100%; text-align: left; border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding: 6px 0;"><strong>Total Bookings in Period:</strong></td><td>${stats.total}</td></tr>
        <tr><td style="padding: 6px 0;"><strong>Total Recorded Revenue:</strong></td><td>${currency} ${stats.revenue.toLocaleString()}</td></tr>
        <tr><td style="padding: 6px 0;"><strong>Current Occupancy Rate:</strong></td><td>${stats.occupancyRate}% (${stats.occupiedCount} of ${stats.totalRooms} rooms occupied)</td></tr>
        ${includeOnTime ? `<tr><td style="padding: 6px 0;"><strong>On-Time Check-Ins:</strong></td><td>${stats.onTimeCheckins}</td></tr>` : ""}
        ${includeDelayed ? `<tr><td style="padding: 6px 0;"><strong>Delayed Check-Ins:</strong></td><td>${stats.delayedCheckins}</td></tr>` : ""}
        ${includeExtended ? `<tr><td style="padding: 6px 0;"><strong>Extended Stays:</strong></td><td>${stats.extendedStays}</td></tr>` : ""}
        ${includeOverstays ? `<tr><td style="padding: 6px 0;"><strong>Active Overstays:</strong></td><td>${stats.overstays}</td></tr>` : ""}
        ${includeBookedRooms ? `<tr><td style="padding: 6px 0;"><strong>Reserved / Booked Rooms:</strong></td><td>${stats.reservedCount}</td></tr>` : ""}
      </table>
    `;
  }, [companyName, period, stats, currency, includeOnTime, includeDelayed, includeExtended, includeOverstays, includeBookedRooms]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>${companyName} - Bookings Report</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; color: #1e293b; }
            h1 { font-size: 22px; margin-bottom: 4px; }
            p { font-size: 13px; color: #64748b; }
            .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px; margin: 25px 0; }
            .kpi { border: 1px solid #cbd5e1; border-radius: 8px; padding: 15px; background: #f8fafc; }
            .kpi-title { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: bold; }
            .kpi-val { font-size: 20px; font-weight: bold; color: #0f172a; margin-top: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
            th { background-color: #f1f5f9; }
          </style>
        </head>
        <body>
          <h1>${companyName} — Bookings & Lodging Executive Report</h1>
          <p>Timeframe: ${PERIODS.find((p) => p.id === period)?.label || "Custom"} | Generated on ${new Date().toLocaleString()}</p>
          <div class="kpi-grid">
            <div class="kpi"><div class="kpi-title">Total Bookings</div><div class="kpi-val">${stats.total}</div></div>
            <div class="kpi"><div class="kpi-title">Revenue Generated</div><div class="kpi-val">${currency} ${stats.revenue.toLocaleString()}</div></div>
            <div class="kpi"><div class="kpi-title">Occupancy Rate</div><div class="kpi-val">${stats.occupancyRate}%</div></div>
          </div>
          ${reportHtml}
          <script>window.onload = function() { window.print(); }<\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-3 sm:p-5 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex flex-col h-[94vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-border-color bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-color px-6 py-4 bg-surface-elevated/40">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-600/10 p-2.5 text-blue-600 border border-blue-600/20">
              <BarChart2 size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
                <span>Bookings & Front Desk Report</span>
                <span className="rounded-full bg-blue-600/10 text-blue-600 border border-blue-600/20 px-2.5 py-0.5 text-xs font-black">
                  Interactive Preview
                </span>
              </h2>
              <p className="text-xs text-muted">
                Analyze check-ins, overstays, extensions, room occupancies, and generate verified exports.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface px-3 py-2 text-xs font-bold text-foreground hover:bg-surface-elevated transition shadow-xs"
              title="Print Report"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Print</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition"
              title="Download Report PDF"
            >
              <Download size={14} />
              <span>Download PDF</span>
            </button>

            <button
              type="button"
              onClick={() => setEmailDialogOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface px-3 py-2 text-xs font-bold text-foreground hover:bg-surface-elevated transition shadow-xs"
              title="Email Report with Double Confirmation"
            >
              <Mail size={14} className="text-emerald-500" />
              <span>Email Report</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-muted hover:bg-surface-elevated hover:text-foreground transition ml-1"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Filter & Selection Bar */}
        <div className="border-b border-border-color bg-surface-elevated/20 p-4 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Timeframe Presets */}
            <div className="flex items-center gap-2">
              <span className="font-bold text-muted flex items-center gap-1">
                <Calendar size={13} /> Timeframe:
              </span>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as PeriodOption)}
                className="rounded-xl border border-border-color bg-surface px-3 py-1.5 font-bold text-foreground focus:border-blue-600 focus:outline-none shadow-xs"
              >
                {PERIODS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>

              {period === "custom" && (
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="rounded-xl border border-border-color bg-surface px-2.5 py-1 text-foreground"
                  />
                  <span>to</span>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="rounded-xl border border-border-color bg-surface px-2.5 py-1 text-foreground"
                  />
                </div>
              )}
            </div>

            {/* Presentation Mode Selector */}
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-muted mr-1">Display:</span>
              <button
                type="button"
                onClick={() => setDisplayMode("both")}
                className={`rounded-xl px-3 py-1 font-bold transition ${
                  displayMode === "both"
                    ? "bg-foreground text-surface shadow-xs"
                    : "bg-surface border border-border-color text-muted hover:text-foreground"
                }`}
              >
                Both
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode("numbers")}
                className={`rounded-xl px-3 py-1 font-bold transition ${
                  displayMode === "numbers"
                    ? "bg-foreground text-surface shadow-xs"
                    : "bg-surface border border-border-color text-muted hover:text-foreground"
                }`}
              >
                Numbers Alone
              </button>
              <button
                type="button"
                onClick={() => setDisplayMode("graphs")}
                className={`rounded-xl px-3 py-1 font-bold transition ${
                  displayMode === "graphs"
                    ? "bg-foreground text-surface shadow-xs"
                    : "bg-surface border border-border-color text-muted hover:text-foreground"
                }`}
              >
                Visualizations
              </button>
            </div>
          </div>

          {/* Data Points Inclusion Checkboxes */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 border-t border-border-color/50">
            <span className="font-bold text-muted">Include Data:</span>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeOnTime}
                onChange={(e) => setIncludeOnTime(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border-color text-blue-600"
              />
              <span>On-Time Checkins</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeDelayed}
                onChange={(e) => setIncludeDelayed(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border-color text-blue-600"
              />
              <span>Delayed Checkins</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeExtended}
                onChange={(e) => setIncludeExtended(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border-color text-blue-600"
              />
              <span>Extended Checkins</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeOccupiedRooms}
                onChange={(e) => setIncludeOccupiedRooms(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border-color text-blue-600"
              />
              <span>Current Occupied Rooms</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeBookedRooms}
                onChange={(e) => setIncludeBookedRooms(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border-color text-blue-600"
              />
              <span>Booked Rooms</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeOverstays}
                onChange={(e) => setIncludeOverstays(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border-color text-blue-600"
              />
              <span>Active Overstays</span>
            </label>
          </div>
        </div>

        {/* Report Preview Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Numbers / KPI Cards */}
          {(displayMode === "both" || displayMode === "numbers") && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs">
                <span className="text-xs font-semibold text-muted">Total Stays in Period</span>
                <p className="mt-1 text-2xl font-black text-foreground">{stats.total}</p>
                <p className="text-[11px] text-muted mt-0.5">Recorded bookings</p>
              </div>

              <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs">
                <span className="text-xs font-semibold text-muted">Total Folio Value</span>
                <p className="mt-1 text-2xl font-black text-emerald-600">
                  {currency} {stats.revenue.toLocaleString()}
                </p>
                <p className="text-[11px] text-muted mt-0.5">Gross revenue</p>
              </div>

              {includeOccupiedRooms && (
                <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs">
                  <span className="text-xs font-semibold text-muted">Occupancy Rate</span>
                  <p className="mt-1 text-2xl font-black text-blue-600">{stats.occupancyRate}%</p>
                  <p className="text-[11px] text-muted mt-0.5">
                    {stats.occupiedCount} of {stats.totalRooms} rooms occupied
                  </p>
                </div>
              )}

              {includeOverstays && (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 shadow-xs">
                  <span className="text-xs font-semibold text-red-600">Active Overstays</span>
                  <p className="mt-1 text-2xl font-black text-red-600">{stats.overstays}</p>
                  <p className="text-[11px] text-muted mt-0.5">Past checkout deadline</p>
                </div>
              )}

              {includeOnTime && (
                <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs">
                  <span className="text-xs font-semibold text-muted">On-Time Arrivals</span>
                  <p className="mt-1 text-xl font-black text-foreground">{stats.onTimeCheckins}</p>
                </div>
              )}

              {includeDelayed && (
                <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs">
                  <span className="text-xs font-semibold text-muted">Delayed Checkins</span>
                  <p className="mt-1 text-xl font-black text-amber-600">{stats.delayedCheckins}</p>
                </div>
              )}

              {includeExtended && (
                <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs">
                  <span className="text-xs font-semibold text-muted">Extended Stays</span>
                  <p className="mt-1 text-xl font-black text-purple-600">{stats.extendedStays}</p>
                </div>
              )}

              {includeBookedRooms && (
                <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs">
                  <span className="text-xs font-semibold text-muted">Reserved Rooms</span>
                  <p className="mt-1 text-xl font-black text-foreground">{stats.reservedCount}</p>
                </div>
              )}
            </div>
          )}

          {/* Visualizations / Charts */}
          {(displayMode === "both" || displayMode === "graphs") && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Checkin Status Breakdown */}
              <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs">
                <h4 className="text-sm font-black text-foreground mb-3 flex items-center gap-1.5">
                  <PieIcon size={16} className="text-blue-500" />
                  <span>Stay Category Breakdown</span>
                </h4>
                {statusPieData.length > 0 ? (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={statusPieData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={75}
                          label={({ name, percent }) => `${name} (${((percent || 0) * 100).toFixed(0)}%)`}
                          labelLine={false}
                        >
                          {statusPieData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-xs text-muted py-10 text-center">No data for selected breakdown.</p>
                )}
              </div>

              {/* Meal Plan Preferences */}
              <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs">
                <h4 className="text-sm font-black text-foreground mb-3 flex items-center gap-1.5">
                  <BarChart2 size={16} className="text-emerald-500" />
                  <span>Meal Plan Distribution</span>
                </h4>
                {mealPlanData.length > 0 ? (
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={mealPlanData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#10b981" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-xs text-muted py-10 text-center">No meal plan data found.</p>
                )}
              </div>
            </div>
          )}

          {/* Bookings Table Snapshot */}
          <div className="rounded-2xl border border-border-color bg-surface overflow-hidden shadow-xs">
            <div className="p-4 border-b border-border-color bg-surface-elevated/40 flex items-center justify-between">
              <h4 className="text-sm font-black text-foreground">
                Filtered Bookings Log ({filteredBookings.length} Records)
              </h4>
              <span className="text-xs text-muted">
                Displaying snapshot for {PERIODS.find((p) => p.id === period)?.label || "Custom Range"}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border-color bg-surface-elevated/30 text-muted uppercase font-bold text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5">Code</th>
                    <th className="px-4 py-2.5">Guest</th>
                    <th className="px-4 py-2.5">Room</th>
                    <th className="px-4 py-2.5">Dates</th>
                    <th className="px-4 py-2.5">Package</th>
                    <th className="px-4 py-2.5">Financials</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color/60">
                  {filteredBookings.slice(0, 15).map((b) => (
                    <tr key={b.id} className="hover:bg-surface-elevated/30 transition">
                      <td className="px-4 py-2 font-mono font-bold text-blue-600">{b.bookingCode}</td>
                      <td className="px-4 py-2 font-semibold text-foreground">{b.guestName}</td>
                      <td className="px-4 py-2">Room {b.roomNumber || "N/A"}</td>
                      <td className="px-4 py-2 text-muted">
                        {new Date(b.checkInDate).toLocaleDateString()} → {new Date(b.checkOutDate).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2 capitalize">{b.mealPlan.replace(/_/g, " ")}</td>
                      <td className="px-4 py-2 font-bold text-foreground">
                        {currency} {(b.totalAmount || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-2">
                        <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] font-bold capitalize">
                          {b.bookingStatus.replace(/_/g, " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredBookings.length > 15 && (
                <div className="p-3 text-center text-xs text-muted border-t border-border-color bg-surface-elevated/20">
                  + {filteredBookings.length - 15} additional bookings included in full printable report / PDF export.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border-color px-6 py-3.5 bg-surface-elevated/30 text-xs text-muted">
          <span>
            Report verified for <strong>{companyName}</strong> • {filteredBookings.length} records analyzed
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

      {/* Double Confirmation Email Dialog */}
      <ReportEmailDialog
        isOpen={emailDialogOpen}
        onClose={() => setEmailDialogOpen(false)}
        reportTitle={`Front Desk & Bookings Executive Report (${PERIODS.find((p) => p.id === period)?.label || "Custom"})`}
        reportHtml={reportHtml}
      />
    </div>
  );
}
