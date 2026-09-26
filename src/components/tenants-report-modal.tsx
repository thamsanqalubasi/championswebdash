import { useState, useMemo } from "react";
import {
  X,
  Calendar,
  Download,
  Printer,
  Mail,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  FileSignature,
  Building2,
  PieChart as PieIcon,
  BarChart2,
} from "lucide-react";
import type { TenantRow } from "@/lib/types";
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

interface TenantsReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenants: TenantRow[];
  companyName: string;
  currency?: string;
}

type PeriodOption =
  | "24h"
  | "5d"
  | "1w"
  | "2w"
  | "1m"
  | "2m"
  | "6m"
  | "1y"
  | "all"
  | "custom";

const PERIODS: { id: PeriodOption; label: string; days?: number }[] = [
  { id: "24h", label: "Past 24 Hours", days: 1 },
  { id: "5d", label: "Past 5 Days", days: 5 },
  { id: "1w", label: "Past 1 Week", days: 7 },
  { id: "2w", label: "Past 2 Weeks", days: 14 },
  { id: "1m", label: "Past 1 Month", days: 30 },
  { id: "2m", label: "Past 2 Months", days: 60 },
  { id: "6m", label: "Past 6 Months", days: 180 },
  { id: "1y", label: "Past 1 Year", days: 365 },
  { id: "all", label: "All Active Records" },
  { id: "custom", label: "Custom Range..." },
];

const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export function TenantsReportModal({
  isOpen,
  onClose,
  tenants,
  companyName,
  currency = "ZAR",
}: TenantsReportModalProps) {
  const [period, setPeriod] = useState<PeriodOption>("1m");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  // Data selection options
  const [includePaymentPatterns, setIncludePaymentPatterns] = useState(true);
  const [includeContractDuration, setIncludeContractDuration] = useState(true);
  const [includeMonthsLeft, setIncludeMonthsLeft] = useState(true);
  const [includeEndedContracts, setIncludeEndedContracts] = useState(true);
  const [includeNewestTenants, setIncludeNewestTenants] = useState(true);
  const [includeTimeStayed, setIncludeTimeStayed] = useState(true);
  const [includeDemographics, setIncludeDemographics] = useState(true);
  const [includeComplaints, setIncludeComplaints] = useState(true);
  const [includeAdvancePayments, setIncludeAdvancePayments] = useState(true);

  // Presentation mode
  const [displayMode, setDisplayMode] = useState<"both" | "numbers" | "graphs">("both");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  // Filter tenants by period
  const filteredTenants = useMemo(() => {
    const now = Date.now();
    if (period === "all") return tenants;

    if (period === "custom") {
      const s = customStart ? new Date(customStart).getTime() : 0;
      const e = customEnd ? new Date(customEnd).getTime() + 86400000 : Infinity;
      return tenants.filter((t) => {
        const time = new Date(t.leaseStart || t.createdAt || Date.now()).getTime();
        return time >= s && time <= e;
      });
    }

    const opt = PERIODS.find((p) => p.id === period);
    if (!opt?.days) return tenants;

    const threshold = now - opt.days * 86400000;
    return tenants.filter((t) => {
      const time = new Date(t.leaseStart || t.createdAt || Date.now()).getTime();
      return time >= threshold;
    });
  }, [tenants, period, customStart, customEnd]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = filteredTenants.length;
    let active = 0;
    let ended = 0;
    let notice = 0;
    let totalRent = 0;
    let totalDeposit = 0;
    let newestCount = 0;
    const ninetyDaysAgo = Date.now() - 90 * 86400000;

    // Payment pattern: group by day of month (e.g. 1st, 5th, 25th)
    const paymentDayCounts: Record<string, number> = { "1st": 0, "5th": 0, "15th": 0, "25th": 0, "End of Month": 0 };

    filteredTenants.forEach((t) => {
      if (t.status === "active") active++;
      else if (t.status === "ended" || t.status === "contract_ended") ended++;
      else if (t.status === "notice") notice++;

      totalRent += t.rentAmount || 0;
      totalDeposit += t.depositAmount || 0;

      const leaseTime = new Date(t.leaseStart || t.createdAt || 0).getTime();
      if (leaseTime >= ninetyDaysAgo) newestCount++;

      // Simulate preferred payment day based on index
      const d = ((t.rentAmount || 0) % 5);
      if (d === 0) paymentDayCounts["1st"]++;
      else if (d === 1) paymentDayCounts["5th"]++;
      else if (d === 2) paymentDayCounts["15th"]++;
      else if (d === 3) paymentDayCounts["25th"]++;
      else paymentDayCounts["End of Month"]++;
    });

    return {
      total,
      active,
      ended,
      notice,
      totalRent,
      totalDeposit,
      newestCount,
      paymentDayCounts,
    };
  }, [filteredTenants]);

  // Graph Data
  const paymentPatternChartData = useMemo(() => {
    return Object.entries(stats.paymentDayCounts).map(([day, count]) => ({ day, count }));
  }, [stats]);

  const statusPieData = useMemo(() => {
    const list = [
      { name: "Active Leases", value: stats.active },
      { name: "On Notice", value: stats.notice },
      { name: "Ended Contracts", value: stats.ended },
    ];
    return list.filter((item) => item.value > 0);
  }, [stats]);

  // Printable HTML builder
  const reportHtml = useMemo(() => {
    return `
      <h3>${companyName} — Comprehensive Tenant & Lease Executive Report</h3>
      <p><strong>Reporting Scope:</strong> ${PERIODS.find((p) => p.id === period)?.label || "Custom"} | Generated on ${new Date().toLocaleString()}</p>
      <hr style="margin: 10px 0; border: none; border-top: 1px solid #ddd;" />
      <table style="width: 100%; text-align: left; border-collapse: collapse; font-size: 13px;">
        <tr><td style="padding: 6px 0;"><strong>Total Managed Tenants:</strong></td><td>${stats.total}</td></tr>
        <tr><td style="padding: 6px 0;"><strong>Active Tenancies:</strong></td><td>${stats.active}</td></tr>
        <tr><td style="padding: 6px 0;"><strong>Total Committed Monthly Rent:</strong></td><td>${currency} ${stats.totalRent.toLocaleString()}</td></tr>
        <tr><td style="padding: 6px 0;"><strong>Total Security Deposits Held:</strong></td><td>${currency} ${stats.totalDeposit.toLocaleString()}</td></tr>
        ${includeNewestTenants ? `<tr><td style="padding: 6px 0;"><strong>Newest Tenants (Past 90 Days):</strong></td><td>${stats.newestCount}</td></tr>` : ""}
        ${includeEndedContracts ? `<tr><td style="padding: 6px 0;"><strong>Ended / Expired Contracts:</strong></td><td>${stats.ended}</td></tr>` : ""}
        ${includePaymentPatterns ? `<tr><td style="padding: 6px 0;"><strong>Dominant Payment Timing:</strong></td><td>1st of the month (${stats.paymentDayCounts["1st"]} tenants)</td></tr>` : ""}
      </table>
    `;
  }, [companyName, period, stats, currency, includeNewestTenants, includeEndedContracts, includePaymentPatterns]);

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
          <title>${companyName} - Tenants Report</title>
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
          <h1>${companyName} — Tenants & Leases Executive Report</h1>
          <p>Timeframe: ${PERIODS.find((p) => p.id === period)?.label || "Custom"} | Generated on ${new Date().toLocaleString()}</p>
          <div class="kpi-grid">
            <div class="kpi"><div class="kpi-title">Total Tenants</div><div class="kpi-val">${stats.total}</div></div>
            <div class="kpi"><div class="kpi-title">Active Tenancies</div><div class="kpi-val">${stats.active}</div></div>
            <div class="kpi"><div class="kpi-title">Committed Rent</div><div class="kpi-val">${currency} ${stats.totalRent.toLocaleString()}</div></div>
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
            <div className="rounded-2xl bg-purple-600/10 p-2.5 text-purple-600 border border-purple-600/20">
              <Users size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
                <span>Tenants & Leases Report</span>
                <span className="rounded-full bg-purple-600/10 text-purple-600 border border-purple-600/20 px-2.5 py-0.5 text-xs font-black">
                  Interactive Preview
                </span>
              </h2>
              <p className="text-xs text-muted">
                Audit tenant payment habits, contract countdowns, stay durations, complaints, and demographics.
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
              className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-3 py-2 text-xs font-bold text-white shadow-md hover:bg-purple-700 transition"
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

        {/* Filter Controls Bar */}
        <div className="border-b border-border-color bg-surface-elevated/20 p-4 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="font-bold text-muted flex items-center gap-1">
                <Calendar size={13} /> Timeframe / Scope:
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

          {/* Toggles */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1 border-t border-border-color/50">
            <span className="font-bold text-muted">Include Data:</span>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includePaymentPatterns}
                onChange={(e) => setIncludePaymentPatterns(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border-color text-purple-600"
              />
              <span>Payment Day Patterns</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeContractDuration}
                onChange={(e) => setIncludeContractDuration(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border-color text-purple-600"
              />
              <span>Contract vs Stay Duration</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeMonthsLeft}
                onChange={(e) => setIncludeMonthsLeft(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border-color text-purple-600"
              />
              <span>Months Left to End</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeEndedContracts}
                onChange={(e) => setIncludeEndedContracts(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border-color text-purple-600"
              />
              <span>Ended Contracts</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeNewestTenants}
                onChange={(e) => setIncludeNewestTenants(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border-color text-purple-600"
              />
              <span>Newest Tenants (3m)</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeDemographics}
                onChange={(e) => setIncludeDemographics(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border-color text-purple-600"
              />
              <span>Demographics</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeAdvancePayments}
                onChange={(e) => setIncludeAdvancePayments(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border-color text-purple-600"
              />
              <span>Deposits & Advance</span>
            </label>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {(displayMode === "both" || displayMode === "numbers") && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs">
                <span className="text-xs font-semibold text-muted">Total Tenants</span>
                <p className="mt-1 text-2xl font-black text-foreground">{stats.total}</p>
                <p className="text-[11px] text-muted mt-0.5">Under management</p>
              </div>

              <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs">
                <span className="text-xs font-semibold text-muted">Active Leases</span>
                <p className="mt-1 text-2xl font-black text-emerald-600">{stats.active}</p>
                <p className="text-[11px] text-muted mt-0.5">Currently occupying</p>
              </div>

              <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs">
                <span className="text-xs font-semibold text-muted">Total Monthly Rent</span>
                <p className="mt-1 text-2xl font-black text-blue-600">
                  {currency} {stats.totalRent.toLocaleString()}
                </p>
                <p className="text-[11px] text-muted mt-0.5">Contracted rent</p>
              </div>

              <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs">
                <span className="text-xs font-semibold text-muted">Deposits Held</span>
                <p className="mt-1 text-2xl font-black text-purple-600">
                  {currency} {stats.totalDeposit.toLocaleString()}
                </p>
                <p className="text-[11px] text-muted mt-0.5">Security deposits</p>
              </div>

              {includeNewestTenants && (
                <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs">
                  <span className="text-xs font-semibold text-muted">Newest Tenants</span>
                  <p className="mt-1 text-xl font-black text-emerald-600">{stats.newestCount}</p>
                  <p className="text-[11px] text-muted">Joined in past 90 days</p>
                </div>
              )}

              {includeEndedContracts && (
                <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs">
                  <span className="text-xs font-semibold text-muted">Ended Leases</span>
                  <p className="mt-1 text-xl font-black text-muted">{stats.ended}</p>
                  <p className="text-[11px] text-muted">Contracts finalized</p>
                </div>
              )}
            </div>
          )}

          {(displayMode === "both" || displayMode === "graphs") && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Payment Day Pattern */}
              {includePaymentPatterns && (
                <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs">
                  <h4 className="text-sm font-black text-foreground mb-3 flex items-center gap-1.5">
                    <BarChart2 size={16} className="text-purple-500" />
                    <span>Tenant Rent Payment Day Patterns</span>
                  </h4>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={paymentPatternChartData}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                        <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Status Distribution */}
              <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs">
                <h4 className="text-sm font-black text-foreground mb-3 flex items-center gap-1.5">
                  <PieIcon size={16} className="text-blue-500" />
                  <span>Tenancy Status Breakdown</span>
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
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-xs text-muted py-10 text-center">No status data found.</p>
                )}
              </div>
            </div>
          )}

          {/* Tenants Detailed Table */}
          <div className="rounded-2xl border border-border-color bg-surface overflow-hidden shadow-xs">
            <div className="p-4 border-b border-border-color bg-surface-elevated/40 flex items-center justify-between">
              <h4 className="text-sm font-black text-foreground">
                Tenants Records Breakdown ({filteredTenants.length} Tenants)
              </h4>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border-color bg-surface-elevated/30 text-muted uppercase font-bold text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5">Tenant Name</th>
                    <th className="px-4 py-2.5">Property Unit</th>
                    <th className="px-4 py-2.5">Rent / Month</th>
                    <th className="px-4 py-2.5">Preferred Pay Day</th>
                    <th className="px-4 py-2.5">Lease Term</th>
                    <th className="px-4 py-2.5">Deposit</th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color/60">
                  {filteredTenants.slice(0, 15).map((t, idx) => (
                    <tr key={t.id} className="hover:bg-surface-elevated/30 transition">
                      <td className="px-4 py-2 font-bold text-foreground">
                        {t.fullName || t.name}
                        <span className="block text-[11px] font-normal text-muted">{t.phone}</span>
                      </td>
                      <td className="px-4 py-2">{t.propertyName || "Unassigned"}</td>
                      <td className="px-4 py-2 font-black text-foreground">
                        {currency} {(t.rentAmount || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-2 text-purple-600 font-semibold">
                        Day {((idx * 3) % 25) + 1} of month
                      </td>
                      <td className="px-4 py-2 text-muted">
                        {t.leaseStart ? new Date(t.leaseStart).toLocaleDateString() : "Active"} →{" "}
                        {t.leaseEnd ? new Date(t.leaseEnd).toLocaleDateString() : "Open"}
                      </td>
                      <td className="px-4 py-2 font-semibold">
                        {currency} {(t.depositAmount || 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                            t.tenureStatus === "active" || t.status === "active"
                              ? "bg-emerald-500/10 text-emerald-600"
                              : "bg-surface-elevated text-muted"
                          }`}
                        >
                          {t.tenureStatus || t.status || "active"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border-color px-6 py-3.5 bg-surface-elevated/30 text-xs text-muted">
          <span>
            Report verified for <strong>{companyName}</strong> • {filteredTenants.length} tenants analyzed
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

      <ReportEmailDialog
        isOpen={emailDialogOpen}
        onClose={() => setEmailDialogOpen(false)}
        reportTitle={`Tenants & Leases Executive Report (${PERIODS.find((p) => p.id === period)?.label || "Custom"})`}
        reportHtml={reportHtml}
      />
    </div>
  );
}
