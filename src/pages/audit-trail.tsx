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
  Route,
  MousePointerClick,
  ArrowRight,
  Navigation,
  Compass,
  MapPin,
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
  const [activeTab, setActiveTab] = useState<"logs" | "patterns" | "financials" | "journeys">("logs");
  const [events, setEvents] = useState<AuditEventRow[]>([]);
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [patterns, setPatterns] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [journeyActorFilter, setJourneyActorFilter] = useState("all");
  const [journeySearch, setJourneySearch] = useState("");

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

  const userJourneys = useMemo(() => {
    return events.map((e) => {
      let buttonName = "Click Action";
      let originPath = "/dashboard";
      let destinationPath = "/dashboard";
      let sessionId = "Active Session";

      if (typeof e.details === "object" && e.details !== null) {
        const d = e.details as Record<string, any>;
        buttonName = d.button_name || e.action;
        originPath = d.origin_path || d.path || "/dashboard";
        destinationPath = d.destination_path || originPath;
        sessionId = d.session_id || "Active Session";
      } else if (typeof e.details === "string") {
        try {
          const parsed = JSON.parse(e.details);
          buttonName = parsed.button_name || e.action;
          originPath = parsed.origin_path || parsed.path || "/dashboard";
          destinationPath = parsed.destination_path || originPath;
          sessionId = parsed.session_id || "Active Session";
        } catch {
          const clickMatch = e.details.match(/clicked ["'](.*?)["']/i);
          if (clickMatch) buttonName = clickMatch[1];
          const originMatch = e.details.match(/from (\/\S+)/i) || e.details.match(/on (\/\S+)/i);
          if (originMatch) originPath = originMatch[1];
          const destMatch = e.details.match(/➔ (\/\S+)/i) || e.details.match(/to (\/\S+)/i);
          if (destMatch) destinationPath = destMatch[1];
          else destinationPath = originPath;
        }
      }

      return {
        id: e.id,
        timestamp: e.createdAt,
        actor: e.actorName || "Staff Member",
        action: e.action,
        buttonName,
        originPath,
        destinationPath,
        sessionId,
      };
    });
  }, [events]);

  const uniqueActors = useMemo(() => {
    return Array.from(new Set(userJourneys.map((j) => j.actor).filter(Boolean)));
  }, [userJourneys]);

  const filteredJourneys = useMemo(() => {
    return userJourneys.filter((j) => {
      const matchesActor = journeyActorFilter === "all" || j.actor === journeyActorFilter;
      const matchesSearch =
        !journeySearch ||
        j.actor.toLowerCase().includes(journeySearch.toLowerCase()) ||
        j.buttonName.toLowerCase().includes(journeySearch.toLowerCase()) ||
        j.originPath.toLowerCase().includes(journeySearch.toLowerCase()) ||
        j.destinationPath.toLowerCase().includes(journeySearch.toLowerCase());
      return matchesActor && matchesSearch;
    });
  }, [userJourneys, journeyActorFilter, journeySearch]);

  const pathwayStats = useMemo(() => {
    const transitionCounts: Record<string, number> = {};
    filteredJourneys.forEach((j) => {
      const key = `${j.originPath} ➔ ${j.destinationPath}`;
      transitionCounts[key] = (transitionCounts[key] || 0) + 1;
    });
    return Object.entries(transitionCounts)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [filteredJourneys]);

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

        <button
          type="button"
          onClick={() => setActiveTab("journeys")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === "journeys"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-muted hover:bg-surface-elevated hover:text-foreground"
          }`}
        >
          <Route size={16} />
          Visual User Journey &amp; Click Map ({userJourneys.length})
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

      {/* TAB 4: VISUAL USER JOURNEY & CLICK MAP */}
      {!loading && !error && activeTab === "journeys" && (
        <div className="space-y-6">
          {/* Metrics summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase text-muted tracking-wider">Total Interactions</span>
                <div className="rounded-xl bg-blue-500/10 p-2 text-blue-600">
                  <MousePointerClick size={18} />
                </div>
              </div>
              <p className="text-2xl font-black text-foreground">{filteredJourneys.length}</p>
              <p className="text-[11px] text-muted mt-1">Logged clicks &amp; transitions</p>
            </div>

            <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase text-muted tracking-wider">Active Staff Tracked</span>
                <div className="rounded-xl bg-purple-500/10 p-2 text-purple-600">
                  <Users size={18} />
                </div>
              </div>
              <p className="text-2xl font-black text-purple-600">{uniqueActors.length}</p>
              <p className="text-[11px] text-muted mt-1">Users generating navigation flows</p>
            </div>

            <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase text-muted tracking-wider">Active Pathways</span>
                <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-600">
                  <Route size={18} />
                </div>
              </div>
              <p className="text-2xl font-black text-emerald-600">{pathwayStats.length}</p>
              <p className="text-[11px] text-muted mt-1">Origin ➔ Destination routes</p>
            </div>

            <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase text-muted tracking-wider">Top Route</span>
                <div className="rounded-xl bg-amber-500/10 p-2 text-amber-600">
                  <Navigation size={18} />
                </div>
              </div>
              <p className="text-sm font-bold text-foreground truncate" title={pathwayStats[0]?.path || "None"}>
                {pathwayStats[0]?.path || "None yet"}
              </p>
              <p className="text-[11px] text-muted mt-1">
                {pathwayStats[0] ? `${pathwayStats[0].count} traversed transitions` : "No transitions logged"}
              </p>
            </div>
          </div>

          {/* Top Pathways Overview */}
          {pathwayStats.length > 0 && (
            <div className="rounded-2xl border border-border-color bg-surface p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Route size={16} className="text-blue-600" />
                    <span>Top Navigational Flow Pathways</span>
                  </h3>
                  <p className="text-xs text-muted">Most frequent routes users traverse through the system.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {pathwayStats.map((item, idx) => {
                  const parts = item.path.split(" ➔ ");
                  const origin = parts[0] || "/";
                  const dest = parts[1] || parts[0];
                  return (
                    <div
                      key={idx}
                      className="rounded-xl border border-border-color bg-surface-elevated/40 p-3.5 flex flex-col justify-between space-y-2 hover:border-blue-500/40 transition"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 font-semibold truncate max-w-[120px]">
                          {origin}
                        </span>
                        <ArrowRight size={14} className="text-muted shrink-0 mx-1" />
                        <span className="font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-semibold truncate max-w-[120px]">
                          {dest}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted pt-1 border-t border-border-color/60">
                        <span>Traversed Frequency</span>
                        <span className="font-black text-foreground">{item.count} times</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Controls: Search and User Filter */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between rounded-2xl border border-border-color bg-surface p-4 shadow-sm">
            <div className="relative flex-1 w-full">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="search"
                placeholder="Search user journeys by button name, origin, destination, or operator..."
                value={journeySearch}
                onChange={(e) => setJourneySearch(e.target.value)}
                className="w-full rounded-xl border border-border-color bg-surface-elevated pl-9 pr-4 py-2 text-sm text-foreground outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs text-muted font-medium whitespace-nowrap">Operator:</span>
              <select
                value={journeyActorFilter}
                onChange={(e) => setJourneyActorFilter(e.target.value)}
                className="w-full sm:w-auto rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs font-semibold text-foreground focus:border-blue-600 focus:outline-none"
              >
                <option value="all">All Operators ({uniqueActors.length})</option>
                {uniqueActors.map((actor) => (
                  <option key={actor} value={actor}>
                    {actor}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Visual User Journey Pipeline & Click Map */}
          {filteredJourneys.length === 0 ? (
            <div className="rounded-2xl border border-border-color bg-surface p-12 text-center shadow-sm">
              <Route size={40} className="mx-auto text-muted mb-3 opacity-60" />
              <h3 className="text-base font-bold text-foreground">No User Journeys Recorded</h3>
              <p className="text-xs text-muted max-w-md mx-auto mt-1">
                As operators navigate between modules, click actions, and operate features, real-time visual movement maps and origin-destination pipelines will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-muted">
                  Interactive User Movement Sequence ({filteredJourneys.length} events)
                </span>
                <span className="text-[11px] text-muted">Arranged from latest transitions</span>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {filteredJourneys.slice(0, 30).map((journey, index) => (
                  <div
                    key={journey.id || index}
                    className="group rounded-2xl border border-border-color bg-surface p-4 shadow-sm hover:border-blue-500/50 hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      {/* Left: Origin Page */}
                      <div className="flex items-center gap-3 min-w-[200px] flex-1">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 border border-blue-500/20">
                          <Compass size={18} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase text-muted tracking-wider">Origin Screen</p>
                          <p className="font-mono text-xs font-bold text-foreground truncate" title={journey.originPath}>
                            {journey.originPath}
                          </p>
                        </div>
                      </div>

                      {/* Center: Button Clicked & Transition Arrow */}
                      <div className="flex flex-col items-center justify-center gap-1.5 shrink-0 px-2 py-1">
                        <div className="flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-700 dark:text-amber-400 shadow-xs">
                          <MousePointerClick size={13} className="text-amber-600" />
                          <span className="truncate max-w-[220px]" title={journey.buttonName}>
                            "{journey.buttonName}"
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-muted text-[10px]">
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                          <ArrowRight size={14} className="text-blue-500" />
                          <span className="font-semibold uppercase tracking-wider text-[9px]">{journey.action}</span>
                        </div>
                      </div>

                      {/* Right: Destination Page */}
                      <div className="flex items-center gap-3 min-w-[200px] flex-1 md:justify-end">
                        <div className="text-left md:text-right min-w-0">
                          <p className="text-[10px] font-bold uppercase text-muted tracking-wider">Destination Screen</p>
                          <p className="font-mono text-xs font-bold text-emerald-600 truncate" title={journey.destinationPath}>
                            {journey.destinationPath}
                          </p>
                        </div>
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          <MapPin size={18} />
                        </div>
                      </div>
                    </div>

                    {/* Footer bar with operator and timestamp */}
                    <div className="mt-3 pt-3 border-t border-border-color/60 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 rounded-full bg-surface-elevated border border-border-color flex items-center justify-center text-[10px] font-bold text-foreground">
                          {journey.actor.charAt(0).toUpperCase()}
                        </div>
                        <span className="font-semibold text-foreground">{journey.actor}</span>
                        <span className="text-muted/40">•</span>
                        <span className="font-mono text-[10px] bg-surface-elevated px-2 py-0.5 rounded text-muted">
                          {journey.sessionId}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 font-mono text-[11px] text-muted">
                        <Clock size={12} />
                        <span>{new Date(journey.timestamp).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </ModulePage>
  );
}
