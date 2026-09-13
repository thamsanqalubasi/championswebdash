import { useEffect, useState, useMemo } from "react";
import { ModulePage } from "@/components/module-page";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import {
  fetchDashboardData,
  fetchCommercialBookings,
  fetchProcurementRequests,
  fetchStoresInventory,
} from "@/lib/data";
import type {
  DashboardData,
  CommercialBooking,
  ProcurementRequest,
  StoresItem,
  DepartmentType,
} from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { CheckinModal } from "@/components/checkin-modal";
import {
  TrendingUp,
  Users,
  Building2,
  DollarSign,
  Wrench,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  KeyRound,
  BedDouble,
  Sparkles,
  Calendar,
  Utensils,
  Brush,
  Truck,
  Package,
  ClipboardList,
  Briefcase,
  Inbox,
  ShieldCheck,
  Layers,
  Network,
  History,
  CheckCircle2,
  Clock,
  ExternalLink,
  ChevronRight,
  PlusCircle,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { Link } from "react-router-dom";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  trend,
  colorClass = "text-foreground",
}: {
  label: string;
  value: string;
  detail: string;
  icon: any;
  trend?: { value: string; positive: boolean };
  colorClass?: string;
}) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-border-color bg-surface p-5 transition-all hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted/70">{label}</p>
          <p className={`mt-2 text-3xl font-black tracking-tight ${colorClass}`}>{value}</p>
        </div>
        <div className="rounded-xl bg-surface-elevated p-2.5 ring-1 border border-border-color/50 group-hover:border-foreground/20">
          <Icon size={20} className="text-muted" />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-muted">{detail}</p>
        {trend && (
          <div className={`flex items-center gap-0.5 text-xs font-bold ${trend.positive ? "text-emerald-600" : "text-red-600"}`}>
            {trend.positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {trend.value}
          </div>
        )}
      </div>
      <div className={`absolute bottom-0 left-0 h-1 w-full bg-current opacity-10 ${colorClass}`} />
    </article>
  );
}

function GaugeCard({ label, value, color }: { label: string; value: number; color: string }) {
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (value / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-4">
      <div className="relative flex items-center justify-center">
        <svg className="h-24 w-24 -rotate-90 transform">
          <circle
            cx="48"
            cy="48"
            r={radius}
            stroke="currentColor"
            strokeWidth="8"
            fill="transparent"
            className="text-border-color/30"
          />
          <circle
            cx="48"
            cy="48"
            r={radius}
            stroke={color}
            strokeWidth="8"
            fill="transparent"
            strokeDasharray={circumference}
            style={{ strokeDashoffset, transition: "stroke-dashoffset 0.5s ease-out" }}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute text-lg font-bold">{Math.round(value)}%</span>
      </div>
      <p className="mt-2 text-xs font-bold uppercase tracking-wider text-muted/60">{label}</p>
    </div>
  );
}

export default function DashboardPage() {
  const { currentCompany, currentCompanyUser, isSuperAdmin, isAdmin } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [recentBookings, setRecentBookings] = useState<CommercialBooking[]>([]);
  const [procurementRequests, setProcurementRequests] = useState<ProcurementRequest[]>([]);
  const [storesInventory, setStoresInventory] = useState<StoresItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [checkinOpen, setCheckinOpen] = useState(false);

  const userDept = currentCompanyUser?.department || "admin";
  const isExecutive = isSuperAdmin || isAdmin;

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [result, bks, procReqs, storesItems] = await Promise.all([
          fetchDashboardData(currentCompany.id),
          fetchCommercialBookings(currentCompany.id),
          fetchProcurementRequests(currentCompany.id),
          fetchStoresInventory(currentCompany.id),
        ]);
        if (!cancelled) {
          setData(result);
          setRecentBookings(bks.slice(0, 5));
          setProcurementRequests(procReqs || []);
          setStoresInventory(storesItems || []);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load dashboard data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadData();
    return () => { cancelled = true; };
  }, [reloadKey, currentCompany.id]);

  const stats = data?.stats;

  // Stores & Procurement derived metrics
  const storesMetrics = useMemo(() => {
    const totalItems = storesInventory.length;
    const lowStock = storesInventory.filter((i) => i.quantity <= i.minStockLevel).length;
    const totalValue = storesInventory.reduce((acc, curr) => acc + curr.quantity * curr.unitCost, 0);
    const maintenanceBlended = storesInventory.filter((i) => i.source === "maintenance_inventory").length;
    return { totalItems, lowStock, totalValue, maintenanceBlended };
  }, [storesInventory]);

  const procurementMetrics = useMemo(() => {
    const active = procurementRequests.filter((p) => p.status === "open").length;
    const inQuotation = procurementRequests.filter((p) => p.pipelineStage === "quotation_gathering").length;
    const awaitingFunds = procurementRequests.filter((p) => p.pipelineStage === "fund_request_to_accounts").length;
    const completed = procurementRequests.filter((p) => p.status === "completed").length;
    return { active, inQuotation, awaitingFunds, completed };
  }, [procurementRequests]);

  return (
    <ModulePage
      title={isExecutive ? `${currentCompany.name} — Executive Command Center` : `${currentCompany.name} — ${currentCompanyUser?.jobTitle || "Staff Portal"}`}
      description={
        isExecutive
          ? "Cross-department operational overview: Hospitality, Procurement, Stores, Maintenance, Finance, HR, and Audit."
          : `Dedicated operational dashboard and assigned queues for the ${userDept.replace(/_/g, " ")} department.`
      }
    >
      {loading && <LoadingState label="Loading real-time company & department metrics..." />}

      {!loading && error && (
        <ErrorState message={error} onRetry={() => setReloadKey((v) => v + 1)} />
      )}

      {!loading && !error && stats && data && (
        <div className="space-y-8">
          {/* ========================================================================= */}
          {/* SUPER ADMIN / ADMIN MULTI-DEPARTMENT DASHBOARD                            */}
          {/* ========================================================================= */}
          {isExecutive && (
            <>
              {/* Executive Cross-Department Navigation Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border-color bg-surface p-4 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-blue-600/10 px-3 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 border border-blue-600/20 uppercase tracking-wider">
                    {isSuperAdmin ? "Super Admin Access" : "Admin Command"}
                  </span>
                  <p className="text-xs text-muted font-medium">All 10 departments operational and synced</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <Link to="/commercial-bookings" className="rounded-lg border border-border-color bg-surface-elevated px-3 py-1.5 hover:text-blue-600 transition">
                    Front Desk
                  </Link>
                  <Link to="/procurement" className="rounded-lg border border-border-color bg-surface-elevated px-3 py-1.5 hover:text-blue-600 transition">
                    Procurement Hub
                  </Link>
                  <Link to="/stores" className="rounded-lg border border-border-color bg-surface-elevated px-3 py-1.5 hover:text-blue-600 transition">
                    Stores & Inventory
                  </Link>
                  <Link to="/maintenance/inventory" className="rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-600 px-3 py-1.5 hover:bg-blue-500/20 transition">
                    Inventory & Stock Hub
                  </Link>
                  <Link to="/maintenance" className="rounded-lg border border-border-color bg-surface-elevated px-3 py-1.5 hover:text-blue-600 transition">
                    Maintenance
                  </Link>
                  <Link to="/finance/reports" className="rounded-lg border border-border-color bg-surface-elevated px-3 py-1.5 hover:text-blue-600 transition">
                    Finance
                  </Link>
                  <Link to="/organogram" className="rounded-lg border border-border-color bg-surface-elevated px-3 py-1.5 hover:text-blue-600 transition">
                    Organogram & Roles
                  </Link>
                </div>
              </div>

              {/* Quick Operations Action Banner */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-600/10 via-surface to-surface p-5 shadow-sm">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shrink-0">
                    <KeyRound size={24} />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">
                      Hospitality & Front Desk Operations
                    </h2>
                    <p className="text-xs text-muted">
                      Instant walk-in guest check-in, automated booking code generation & online verification.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCheckinOpen(true)}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition"
                  >
                    <KeyRound size={16} />
                    <span>Check In Guest</span>
                  </button>

                  <Link
                    to="/commercial-bookings"
                    className="flex items-center gap-2 rounded-xl border border-border-color bg-surface px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-surface-elevated transition"
                  >
                    <BedDouble size={16} />
                    <span>All Bookings</span>
                  </Link>
                </div>
              </div>

              {/* Multi-Department Metrics Grid */}
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-muted mb-3 flex items-center gap-2">
                  <Layers size={16} className="text-blue-600" />
                  Multi-Department Key Metrics
                </h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
                  {/* Front Desk */}
                  <Link to="/commercial-bookings" className="rounded-2xl border border-border-color bg-surface p-4 shadow-sm hover:border-blue-500/40 transition group">
                    <div className="flex items-center justify-between text-blue-600">
                      <BedDouble size={18} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Front Desk</span>
                    </div>
                    <p className="mt-2 text-2xl font-black text-foreground">{stats.occupiedRooms}/{stats.totalRooms}</p>
                    <p className="text-[11px] text-muted">{stats.occupancyRate}% Occupied</p>
                  </Link>

                  {/* Procurement */}
                  <Link to="/procurement" className="rounded-2xl border border-border-color bg-surface p-4 shadow-sm hover:border-purple-500/40 transition group">
                    <div className="flex items-center justify-between text-purple-600">
                      <Truck size={18} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Procurement</span>
                    </div>
                    <p className="mt-2 text-2xl font-black text-purple-600">{procurementMetrics.active}</p>
                    <p className="text-[11px] text-muted">{procurementMetrics.inQuotation} in quotation</p>
                  </Link>

                  {/* Stores & Inventory */}
                  <Link to="/stores" className="rounded-2xl border border-border-color bg-surface p-4 shadow-sm hover:border-emerald-500/40 transition group">
                    <div className="flex items-center justify-between text-emerald-600">
                      <Package size={18} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Stores Stock</span>
                    </div>
                    <p className="mt-2 text-2xl font-black text-emerald-600">{storesMetrics.totalItems}</p>
                    <p className="text-[11px] text-muted">{storesMetrics.lowStock} Low stock items</p>
                  </Link>

                  {/* Maintenance */}
                  <Link to="/maintenance" className="rounded-2xl border border-border-color bg-surface p-4 shadow-sm hover:border-amber-500/40 transition group">
                    <div className="flex items-center justify-between text-amber-600">
                      <Wrench size={18} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Maintenance</span>
                    </div>
                    <p className="mt-2 text-2xl font-black text-amber-600">{stats.pendingMaintenance}</p>
                    <p className="text-[11px] text-muted">Open work orders</p>
                  </Link>

                  {/* Finance */}
                  <Link to="/finance/reports" className="rounded-2xl border border-border-color bg-surface p-4 shadow-sm hover:border-emerald-500/40 transition group">
                    <div className="flex items-center justify-between text-emerald-600">
                      <DollarSign size={18} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Finance</span>
                    </div>
                    <p className="mt-2 text-2xl font-black text-emerald-600">{formatCurrency(stats.totalMonthlyIncome)}</p>
                    <p className="text-[11px] text-muted">{stats.collectionRate}% collection</p>
                  </Link>

                  {/* HR & Users */}
                  <Link to="/organogram" className="rounded-2xl border border-border-color bg-surface p-4 shadow-sm hover:border-blue-500/40 transition group">
                    <div className="flex items-center justify-between text-blue-600">
                      <Network size={18} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Organogram</span>
                    </div>
                    <p className="mt-2 text-2xl font-black text-foreground">Active</p>
                    <p className="text-[11px] text-muted">Role rules & rights</p>
                  </Link>
                </div>
              </div>

              {/* Stores & Maintenance Inventory Highlight Banner */}
              <div className="rounded-2xl border border-blue-500/20 bg-surface p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl">
                      <Package size={22} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                        Stores & Maintenance Stock Blended Integration
                        <span className="rounded-full bg-emerald-500/10 text-emerald-600 px-2 py-0.5 text-[10px] font-bold">
                          Live Sync Active
                        </span>
                      </h3>
                      <p className="text-xs text-muted">
                        Total Stock Valuation: <strong>R {storesMetrics.totalValue.toLocaleString()}</strong> across {storesMetrics.totalItems} cataloged items. Items added in <strong>Inventory & Stock</strong> are synced automatically.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      to="/stores"
                      className="rounded-xl border border-border-color bg-surface-elevated px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface transition flex items-center gap-1.5"
                    >
                      <span>Stores & Inventory</span>
                      <ChevronRight size={14} />
                    </Link>
                    <Link
                      to="/maintenance/inventory"
                      className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition flex items-center gap-1.5"
                    >
                      <ClipboardList size={14} />
                      <span>Inventory & Stock (Maintenance)</span>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Financial Stats Grid */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                  label="Revenue"
                  value={formatCurrency(stats.totalMonthlyIncome)}
                  detail="Total collected this month"
                  icon={DollarSign}
                  trend={{ value: "14%", positive: true }}
                  colorClass="text-emerald-600"
                />
                <StatCard
                  label="Operating Expenses"
                  value={formatCurrency(stats.totalMonthlyExpenses)}
                  detail="Maintenance, Housekeeping & Ops"
                  icon={Wrench}
                  trend={{ value: "4%", positive: false }}
                  colorClass="text-amber-600"
                />
                <StatCard
                  label="Net Operating Income"
                  value={formatCurrency(stats.netProfit)}
                  detail="Net monthly operating margin"
                  icon={TrendingUp}
                  colorClass="text-foreground"
                />
                <StatCard
                  label="Collection Rate"
                  value={`${stats.collectionRate}%`}
                  detail="Invoice reconciliation"
                  icon={AlertCircle}
                  colorClass="text-blue-600"
                />
              </div>

              {/* Financial Charts & Occupancy Gauges */}
              <div className="grid gap-6 lg:grid-cols-3">
                <article className="rounded-2xl border border-border-color bg-surface p-6 lg:col-span-2 shadow-sm">
                  <div className="mb-6 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold tracking-tight">Financial Trends</h3>
                      <p className="text-sm text-muted">Income vs Operating Expenses (Last 6 Months)</p>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-medium">
                      <div className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        <span>Income</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                        <span>Expenses</span>
                      </div>
                    </div>
                  </div>
                  <div className="h-72 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.cashflow}>
                        <defs>
                          <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.15}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15}/>
                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted)" }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted)" }} tickFormatter={(v) => `R${v/1000}k`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: "var(--surface-elevated)", borderColor: "var(--border-color)", borderRadius: "12px" }}
                          itemStyle={{ fontSize: "12px", fontWeight: "bold" }}
                        />
                        <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                        <Area type="monotone" dataKey="expenses" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorExpenses)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </article>

                {/* Health Gauges */}
                <article className="flex flex-col justify-between rounded-2xl border border-border-color bg-surface p-6 shadow-sm">
                  <div>
                    <h3 className="text-lg font-bold tracking-tight">Occupancy & Health</h3>
                    <p className="text-sm text-muted">Room utilization & billing speed</p>
                  </div>
                  <div className="grid grid-cols-2 py-4">
                    <GaugeCard label="Occupancy" value={stats.occupancyRate} color="#0ea5e9" />
                    <GaugeCard label="Collection" value={stats.collectionRate} color="#10b981" />
                  </div>
                  <div className="space-y-2 rounded-xl bg-surface-elevated p-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted">Active Check-ins Today:</span>
                      <span className="font-bold text-foreground">{stats.activeCheckinsToday}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Pending Work Orders:</span>
                      <span className="font-bold text-amber-600">{stats.pendingMaintenance}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted">Procurement Requests:</span>
                      <span className="font-bold text-purple-600">{procurementMetrics.active} Active</span>
                    </div>
                  </div>
                </article>
              </div>

              {/* Recent In-House Bookings Strip */}
              <div className="rounded-2xl border border-border-color bg-surface p-6 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-foreground">Recent Front Desk Check-Ins</h3>
                    <p className="text-xs text-muted">Latest guest arrivals and room assignments</p>
                  </div>
                  <Link
                    to="/commercial-bookings"
                    className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    <span>View All</span>
                    <ChevronRight size={14} />
                  </Link>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-border-color text-[10px] font-bold uppercase tracking-wider text-muted">
                      <tr>
                        <th className="pb-2">Booking Code</th>
                        <th className="pb-2">Guest Name</th>
                        <th className="pb-2">Room</th>
                        <th className="pb-2">Meal Plan</th>
                        <th className="pb-2">Stay Dates</th>
                        <th className="pb-2">Amount Paid</th>
                        <th className="pb-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-color">
                      {recentBookings.map((b) => (
                        <tr key={b.id} className="hover:bg-surface-elevated/30">
                          <td className="py-2.5 font-mono font-bold text-blue-600">{b.bookingCode}</td>
                          <td className="py-2.5 font-semibold text-foreground">{b.guestName}</td>
                          <td className="py-2.5">{b.roomNumber}</td>
                          <td className="py-2.5 capitalize text-muted">{b.mealPlan.replace(/_/g, " ")}</td>
                          <td className="py-2.5 text-muted">
                            {new Date(b.checkInDate).toLocaleDateString()} → {new Date(b.checkOutDate).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 font-bold text-emerald-600">R{b.amountPaid.toLocaleString()}</td>
                          <td className="py-2.5">
                            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-600 uppercase">
                              {b.bookingStatus.replace("_", " ")}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* ========================================================================= */}
          {/* STORES DEPARTMENT DEDICATED VIEW                                         */}
          {/* ========================================================================= */}
          {!isExecutive && userDept === "stores" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-border-color bg-surface p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl">
                      <Package size={24} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-foreground">Stores & Inventory Workspace</h2>
                      <p className="text-xs text-muted">
                        Manage central warehouse inventory, receive goods, and disburse stock to maintenance and operations.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      to="/stores"
                      className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
                    >
                      <Package size={16} />
                      <span>Stores & Inventory Management</span>
                    </Link>
                    <Link
                      to="/maintenance/inventory"
                      className="flex items-center gap-2 rounded-xl border border-border-color bg-surface-elevated px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-surface transition"
                    >
                      <ClipboardList size={16} />
                      <span>Inventory & Stock (Maintenance)</span>
                    </Link>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                  label="Cataloged Stock Items"
                  value={String(storesMetrics.totalItems)}
                  detail="Stores & Maintenance Blended"
                  icon={Package}
                  colorClass="text-blue-600"
                />
                <StatCard
                  label="Low Stock Alerts"
                  value={String(storesMetrics.lowStock)}
                  detail="Items below re-order threshold"
                  icon={AlertCircle}
                  colorClass={storesMetrics.lowStock > 0 ? "text-red-600" : "text-emerald-600"}
                />
                <StatCard
                  label="Total Stock Valuation"
                  value={`R ${storesMetrics.totalValue.toLocaleString()}`}
                  detail="Current warehouse inventory worth"
                  icon={DollarSign}
                  colorClass="text-emerald-600"
                />
              </div>

              {/* Quick links banner */}
              <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-blue-600 shrink-0" />
                  <span>
                    <strong>Inventory Blend Active:</strong> When items are added in <strong>Inventory & Stock</strong>, they appear on your Stores dashboard automatically.
                  </span>
                </div>
                <Link to="/maintenance/inventory" className="text-blue-600 font-semibold hover:underline flex items-center gap-1">
                  <span>Open Inventory & Stock Hub</span>
                  <ExternalLink size={13} />
                </Link>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* PROCUREMENT DEPARTMENT DEDICATED VIEW                                    */}
          {/* ========================================================================= */}
          {!isExecutive && userDept === "procurement" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-border-color bg-surface p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-500/10 text-purple-600 rounded-xl">
                      <Truck size={24} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-foreground">Procurement Operations Hub</h2>
                      <p className="text-xs text-muted">
                        Cross-department requests, quotation gathering, supplier RFQs, and accounts funding requests.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      to="/procurement"
                      className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-purple-700 transition"
                    >
                      <Truck size={16} />
                      <span>Procurement Pipeline</span>
                    </Link>
                    <Link
                      to="/stores"
                      className="flex items-center gap-2 rounded-xl border border-border-color bg-surface-elevated px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-surface transition"
                    >
                      <Package size={16} />
                      <span>Check Stores Inventory</span>
                    </Link>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                  label="Active Pipeline Requests"
                  value={String(procurementMetrics.active)}
                  detail="In progress across stages"
                  icon={Clock}
                  colorClass="text-purple-600"
                />
                <StatCard
                  label="Quote Gathering"
                  value={String(procurementMetrics.inQuotation)}
                  detail="Awaiting up to 10 quotations"
                  icon={ClipboardList}
                  colorClass="text-amber-600"
                />
                <StatCard
                  label="Awaiting Accounts Approval"
                  value={String(procurementMetrics.awaitingFunds)}
                  detail="Purchase funds authorization"
                  icon={DollarSign}
                  colorClass="text-pink-600"
                />
                <StatCard
                  label="Completed Purchases"
                  value={String(procurementMetrics.completed)}
                  detail="Delivered & disbursed to stores"
                  icon={CheckCircle2}
                  colorClass="text-emerald-600"
                />
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MAINTENANCE DEPARTMENT DEDICATED VIEW                                    */}
          {/* ========================================================================= */}
          {!isExecutive && userDept === "maintenance" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-border-color bg-surface p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl">
                      <Wrench size={24} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-foreground">Maintenance & Engineering Workspace</h2>
                      <p className="text-xs text-muted">
                        Asset repairs, preventive maintenance schedules, and equipment spare parts stock.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      to="/maintenance/work-orders"
                      className="flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700 transition"
                    >
                      <ClipboardList size={16} />
                      <span>Work Orders Queue</span>
                    </Link>
                    <Link
                      to="/maintenance/inventory"
                      className="flex items-center gap-2 rounded-xl border border-border-color bg-surface-elevated px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-surface transition"
                    >
                      <Package size={16} />
                      <span>Inventory & Stock</span>
                    </Link>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                  label="Pending Work Orders"
                  value={String(stats.pendingMaintenance)}
                  detail="Repairs and maintenance tickets"
                  icon={Wrench}
                  colorClass="text-amber-600"
                />
                <StatCard
                  label="Cleaning Needed Rooms"
                  value={String(stats.cleaningNeededRooms)}
                  detail="Housekeeping preparation"
                  icon={Brush}
                  colorClass="text-amber-600"
                />
                <StatCard
                  label="Stock Items Cataloged"
                  value={String(storesMetrics.totalItems)}
                  detail="Available in Inventory & Stores"
                  icon={Package}
                  colorClass="text-blue-600"
                />
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* FINANCE / ACCOUNTANT DEDICATED VIEW                                      */}
          {/* ========================================================================= */}
          {!isExecutive && userDept === "accountant" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-border-color bg-surface p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
                      <DollarSign size={24} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-foreground">Finance & Accounts Workspace</h2>
                      <p className="text-xs text-muted">
                        Rent reconciliation, operating expenses, financial statements, and procurement fund authorizations.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      to="/procurement"
                      className="flex items-center gap-2 rounded-xl bg-pink-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-pink-700 transition"
                    >
                      <DollarSign size={16} />
                      <span>Approve Purchase Funds ({procurementMetrics.awaitingFunds})</span>
                    </Link>
                    <Link
                      to="/finance/reports"
                      className="flex items-center gap-2 rounded-xl border border-border-color bg-surface-elevated px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-surface transition"
                    >
                      <Layers size={16} />
                      <span>Financial Reports</span>
                    </Link>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <StatCard
                  label="Revenue"
                  value={formatCurrency(stats.totalMonthlyIncome)}
                  detail="Total collected this month"
                  icon={DollarSign}
                  colorClass="text-emerald-600"
                />
                <StatCard
                  label="Operating Expenses"
                  value={formatCurrency(stats.totalMonthlyExpenses)}
                  detail="Operations and vendor costs"
                  icon={Wrench}
                  colorClass="text-amber-600"
                />
                <StatCard
                  label="Net Operating Income"
                  value={formatCurrency(stats.netProfit)}
                  detail="Current month profit"
                  icon={TrendingUp}
                  colorClass="text-foreground"
                />
                <StatCard
                  label="Collection Rate"
                  value={`${stats.collectionRate}%`}
                  detail="Invoiced vs settled"
                  icon={AlertCircle}
                  colorClass="text-blue-600"
                />
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* FRONT DESK DEDICATED VIEW                                                */}
          {/* ========================================================================= */}
          {!isExecutive && userDept === "front_desk" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-border-color bg-surface p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl">
                      <KeyRound size={24} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-foreground">Front Desk & Hospitality Workspace</h2>
                      <p className="text-xs text-muted">
                        Walk-in guest registration, room key assignments, and live occupancy status.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setCheckinOpen(true)}
                      className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition"
                    >
                      <KeyRound size={16} />
                      <span>Check In Guest</span>
                    </button>
                    <Link
                      to="/commercial-bookings"
                      className="flex items-center gap-2 rounded-xl border border-border-color bg-surface px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-surface-elevated transition"
                    >
                      <BedDouble size={16} />
                      <span>All Bookings</span>
                    </Link>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-blue-600">
                    <BedDouble size={18} />
                    <span className="text-xs font-bold uppercase tracking-wider">Total Rooms</span>
                  </div>
                  <p className="mt-2 text-2xl font-black text-foreground">{stats.totalRooms}</p>
                </div>
                <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-emerald-600">
                    <Sparkles size={18} />
                    <span className="text-xs font-bold uppercase tracking-wider">Available Rooms</span>
                  </div>
                  <p className="mt-2 text-2xl font-black text-emerald-600">{stats.availableRooms}</p>
                </div>
                <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-blue-600">
                    <Users size={18} />
                    <span className="text-xs font-bold uppercase tracking-wider">Occupied Rooms</span>
                  </div>
                  <p className="mt-2 text-2xl font-black text-blue-600">{stats.occupiedRooms}</p>
                </div>
                <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-sm">
                  <div className="flex items-center gap-2 text-amber-600">
                    <Brush size={18} />
                    <span className="text-xs font-bold uppercase tracking-wider">Cleaning Needed</span>
                  </div>
                  <p className="mt-2 text-2xl font-black text-amber-600">{stats.cleaningNeededRooms}</p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* HUMAN RESOURCES DEDICATED VIEW                                           */}
          {/* ========================================================================= */}
          {!isExecutive && userDept === "human_resources" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-border-color bg-surface p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl">
                      <Briefcase size={24} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-foreground">Human Resources & Payroll</h2>
                      <p className="text-xs text-muted">
                        Staff roster, organogram hierarchy, and payroll disbursements.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      to="/hr"
                      className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
                    >
                      <Users size={16} />
                      <span>Employee Directory</span>
                    </Link>
                    <Link
                      to="/organogram"
                      className="flex items-center gap-2 rounded-xl border border-border-color bg-surface-elevated px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-surface transition"
                    >
                      <Network size={16} />
                      <span>Organogram & Roles</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Checkin Modal */}
      <CheckinModal
        isOpen={checkinOpen}
        onClose={() => setCheckinOpen(false)}
        onSuccess={() => setReloadKey((k) => k + 1)}
      />
    </ModulePage>
  );
}
