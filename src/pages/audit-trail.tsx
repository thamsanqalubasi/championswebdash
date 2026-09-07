import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { fetchAuditEvents, fetchCheckinPatterns, fetchInvoices } from "@/lib/data";
import type { AuditEventRow, InvoiceRow } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import {
  History,
  Search,
  Download,
  User,
  Clock,
  FileText,
  Home,
  Users,
  CreditCard,
  Wrench,
  Shield,
  KeyRound,
  TrendingUp,
  BarChart3,
  Calendar,
  Utensils,
  CheckCircle2,
  Lock,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const COLORS = ["#0ea5e9", "#10b981", "#8b5cf6", "#f59e0b"];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function AuditTrailPage() {
  const { currentCompany } = useAuth();
  const [activeTab, setActiveTab] = useState<"logs" | "patterns" | "financials">("logs");
  const [events, setEvents] = useState<AuditEventRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [patterns, setPatterns] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [evs, invs, pat] = await Promise.all([
          fetchAuditEvents(currentCompany.id),
          fetchInvoices(currentCompany.id),
          fetchCheckinPatterns(currentCompany.id),
        ]);
        setEvents(evs);
        setInvoices(invs);
        setPatterns(pat);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load audit data");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [currentCompany.id]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const matchesSearch =
        e.action.toLowerCase().includes(search.toLowerCase()) ||
        e.entityName.toLowerCase().includes(search.toLowerCase()) ||
        e.actorName.toLowerCase().includes(search.toLowerCase()) ||
        e.details.toLowerCase().includes(search.toLowerCase());

      const matchesFilter = actionFilter === "all" || e.entityType.includes(actionFilter) || e.action.toLowerCase().includes(actionFilter);
      return matchesSearch && matchesFilter;
    });
  }, [events, search, actionFilter]);

  return (
    <ModulePage
      title={`Audit Department & Compliance (${currentCompany.name})`}
      description="Immutable activity trail, financial transaction verification, and client check-in/checkout patterns."
    >
      {/* Tabs */}
      <div className="flex gap-2 border-b border-border-color pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("logs")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === "logs"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-muted hover:bg-surface-elevated hover:text-foreground"
          }`}
        >
          <History size={16} />
          System Activity Trail ({events.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("patterns")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === "patterns"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-muted hover:bg-surface-elevated hover:text-foreground"
          }`}
        >
          <TrendingUp size={16} />
          Check-In & Checkout Patterns
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("financials")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === "financials"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-muted hover:bg-surface-elevated hover:text-foreground"
          }`}
        >
          <CreditCard size={16} />
          Financial & Invoicing Audit
        </button>
      </div>

      {loading && <LoadingState label="Loading audit trail and compliance streams..." />}
      {!loading && error && <ErrorState message={error} onRetry={() => {}} />}

      {/* TAB 1: ACTIVITY LOGS */}
      {!loading && !error && activeTab === "logs" && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border-color bg-surface p-4">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="search"
                placeholder="Search audit trail by actor, action, booking code, or target entity..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-border-color bg-surface-elevated pl-9 pr-4 py-2 text-sm text-foreground outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted font-medium">Filter:</span>
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs font-semibold text-foreground focus:border-blue-600 focus:outline-none"
              >
                <option value="all">All Events</option>
                <option value="checkin">Check-Ins & Extensions</option>
                <option value="user">User & Rights Grants</option>
                <option value="payment">Payments & Invoices</option>
                <option value="leave">HR & Leave Approvals</option>
              </select>
            </div>
          </div>

          <div className="rounded-2xl border border-border-color bg-surface overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border-color bg-surface-elevated/70 text-[11px] font-bold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3.5">Timestamp</th>
                  <th className="px-4 py-3.5">Action & Scope</th>
                  <th className="px-4 py-3.5">Entity / Target</th>
                  <th className="px-4 py-3.5">Performed By</th>
                  <th className="px-4 py-3.5">Audit Summary & Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color text-foreground">
                {filteredEvents.map((row) => (
                  <tr key={row.id} className="hover:bg-surface-elevated/30 transition">
                    <td className="px-4 py-3.5 font-mono text-xs text-muted whitespace-nowrap">
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="rounded-md bg-blue-500/10 px-2 py-0.5 text-xs font-bold text-blue-600">
                        {row.action}
                      </span>
                      <p className="text-[10px] text-muted capitalize mt-0.5">{row.entityType}</p>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-foreground">
                      {row.entityName}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-semibold text-foreground">{row.actorName}</span>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-muted max-w-md">
                      {row.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: CHECK-IN & CHECKOUT PATTERN ANALYTICS */}
      {!loading && !error && activeTab === "patterns" && patterns && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-border-color bg-surface p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase text-muted">Average Length of Stay</p>
              <p className="mt-2 text-3xl font-black text-blue-600">{patterns.averageLengthOfStayNights} Nights</p>
              <p className="mt-1 text-[11px] text-muted">Guest reservation average</p>
            </div>

            <div className="rounded-2xl border border-border-color bg-surface p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase text-muted">Peak Check-In Arrival Window</p>
              <p className="mt-2 text-2xl font-black text-foreground">{patterns.peakCheckinHour}</p>
              <p className="mt-1 text-[11px] text-muted">Front desk rush period</p>
            </div>

            <div className="rounded-2xl border border-border-color bg-surface p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase text-muted">Most Selected Meal Plan</p>
              <p className="mt-2 text-lg font-black text-emerald-600">{patterns.mostPopularMealPlan}</p>
              <p className="mt-1 text-[11px] text-muted">Breakfast inclusive package</p>
            </div>

            <div className="rounded-2xl border border-border-color bg-surface p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase text-muted">Room Turnover Efficiency</p>
              <p className="mt-2 text-3xl font-black text-purple-600">{patterns.turnoverEfficiencyHours} Hours</p>
              <p className="mt-1 text-[11px] text-muted">Checkout to next guest ready</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Weekly Occupancy Pattern */}
            <div className="rounded-2xl border border-border-color bg-surface p-6 shadow-sm">
              <h3 className="text-base font-bold text-foreground mb-1">Weekly Check-In & Occupancy Trend (%)</h3>
              <p className="text-xs text-muted mb-4">Historical peak arrival days across weekend/weekdays</p>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={patterns.weeklyOccupancyTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted)" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted)" }} />
                    <Tooltip contentStyle={{ backgroundColor: "var(--surface-elevated)", borderColor: "var(--border-color)", borderRadius: "12px" }} />
                    <Bar dataKey="rate" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Meal Plan Distribution */}
            <div className="rounded-2xl border border-border-color bg-surface p-6 shadow-sm">
              <h3 className="text-base font-bold text-foreground mb-1">Meal & Board Selection Breakdown</h3>
              <p className="text-xs text-muted mb-4">Client package preferences at check-in</p>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={patterns.mealPlanDistribution}
                      dataKey="count"
                      nameKey="plan"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={(entry: any) => `${entry.plan || entry.name} (${entry.count || entry.value}%)`}
                    >
                      {patterns.mealPlanDistribution.map((_: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: FINANCIAL AUDIT */}
      {!loading && !error && activeTab === "financials" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-border-color bg-surface p-6 shadow-sm">
            <h3 className="text-base font-bold text-foreground mb-1">Invoice Reconciliation & Financial Stream</h3>
            <p className="text-xs text-muted mb-4">Verified billing history for audits and taxation</p>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border-color text-[11px] font-bold uppercase text-muted">
                  <tr>
                    <th className="pb-3">Invoice ID</th>
                    <th className="pb-3">Client / Tenant</th>
                    <th className="pb-3">Property</th>
                    <th className="pb-3">Billing Month</th>
                    <th className="pb-3">Amount</th>
                    <th className="pb-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color">
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-surface-elevated/30">
                      <td className="py-3 font-mono text-xs font-bold text-blue-600">{inv.id}</td>
                      <td className="py-3 font-semibold text-foreground">{inv.tenantName}</td>
                      <td className="py-3 text-muted">{inv.propertyName}</td>
                      <td className="py-3 text-muted">{inv.month}</td>
                      <td className="py-3 font-black text-foreground">{formatCurrency(inv.totalAmount)}</td>
                      <td className="py-3">
                        <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600 uppercase">
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </ModulePage>
  );
}
