import { useEffect, useMemo, useState } from "react";
import { ModulePage } from "@/components/module-page";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { fetchDashboardData } from "@/lib/data";
import type { DashboardData, DashboardStats } from "@/lib/types";
import {
  TrendingUp,
  Users,
  Building2,
  DollarSign,
  Wrench,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  PieChart as PieChartIcon,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "NAD",
    maximumFractionDigits: 0,
  }).format(amount);
}

const COLORS = ["#0ea5e9", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6"];

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
    <article className="group relative overflow-hidden rounded-xl border border-border-color bg-surface p-5 transition-all hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted/60">{label}</p>
          <p className={`mt-2 text-3xl font-bold tracking-tight ${colorClass}`}>{value}</p>
        </div>
        <div className="rounded-lg bg-surface-elevated p-2 ring-1 ring-border-color/50 group-hover:ring-foreground/20">
          <Icon size={20} className="text-muted" />
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-muted">{detail}</p>
        {trend && (
          <div className={`flex items-center gap-0.5 text-xs font-bold ${trend.positive ? "text-green-600" : "text-red-600"}`}>
            {trend.positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            {trend.value}
          </div>
        )}
      </div>
      <div className={`absolute bottom-0 left-0 h-1 w-full bg-current opacity-5 ${colorClass}`} />
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
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchDashboardData();
        if (!cancelled) setData(result);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load dashboard data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadData();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const stats = data?.stats;

  return (
    <ModulePage
      title="Dashboard"
      description="Real-time operational metrics, financial trends, and property health."
    >
      {loading && <LoadingState label="Analyzing property data..." />}

      {!loading && error && (
        <ErrorState message={error} onRetry={() => setReloadKey((v) => v + 1)} />
      )}

      {!loading && !error && stats && data && (
        <div className="space-y-6">
          {/* Main Stats Grid */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Revenue"
              value={formatCurrency(stats.totalMonthlyIncome)}
              detail="Total collected this month"
              icon={DollarSign}
              trend={{ value: "12%", positive: true }}
              colorClass="text-green-600"
            />
            <StatCard
              label="Expenses"
              value={formatCurrency(stats.totalMonthlyExpenses)}
              detail="Maintenance & Operational"
              icon={Wrench}
              trend={{ value: "5%", positive: false }}
              colorClass="text-amber-600"
            />
            <StatCard
              label="Net Operating Income"
              value={formatCurrency(stats.netProfit)}
              detail="Monthly profit position"
              icon={TrendingUp}
              colorClass="text-foreground"
            />
            <StatCard
              label="Overdue"
              value={String(stats.overduePayments)}
              detail="Invoices requiring action"
              icon={AlertCircle}
              colorClass={stats.overduePayments > 0 ? "text-red-600" : "text-foreground"}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Financial Trend Chart */}
            <article className="rounded-xl border border-border-color bg-surface p-6 lg:col-span-2">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold tracking-tight">Financial Trends</h3>
                  <p className="text-sm text-muted">Income vs Expenses (Last 6 Months)</p>
                </div>
                <div className="flex items-center gap-4 text-xs font-medium">
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <span>Income</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                    <span>Expenses</span>
                  </div>
                </div>
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={data.cashflow}>
                    <defs>
                      <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted)" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--muted)" }} tickFormatter={(v) => `N$${v/1000}k`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: "var(--surface-elevated)", borderColor: "var(--border-color)", borderRadius: "12px", boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)" }}
                      itemStyle={{ fontSize: "12px", fontWeight: "bold" }}
                    />
                    <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorIncome)" />
                    <Area type="monotone" dataKey="expenses" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorExpenses)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </article>

            {/* Health Gauges */}
            <article className="flex flex-col justify-between rounded-xl border border-border-color bg-surface p-6">
              <div>
                <h3 className="text-lg font-bold tracking-tight">Property Health</h3>
                <p className="text-sm text-muted">Occupancy and collection efficiency</p>
              </div>
              <div className="grid grid-cols-2 py-8">
                <GaugeCard label="Occupancy" value={stats.occupancyRate} color="#0ea5e9" />
                <GaugeCard label="Collection" value={stats.collectionRate} color="#10b981" />
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted">
                    <Building2 size={16} />
                    <span>Total Units</span>
                  </div>
                  <span className="font-bold">{stats.totalProperties}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted">
                    <Users size={16} />
                    <span>Occupied</span>
                  </div>
                  <span className="font-bold text-sky-600">{stats.occupiedUnits}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-muted">
                    <AlertCircle size={16} />
                    <span>Vacant</span>
                  </div>
                  <span className="font-bold text-amber-600">{stats.vacantUnits}</span>
                </div>
              </div>
            </article>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Maintenance Breakdown */}
            <article className="rounded-xl border border-border-color bg-surface p-6">
              <div className="mb-6">
                <h3 className="text-lg font-bold tracking-tight">Maintenance Distribution</h3>
                <p className="text-sm text-muted">Work orders by category</p>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.maintenanceByCategory}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.3} />
                    <XAxis dataKey="category" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--muted)" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--muted)" }} />
                    <Tooltip
                      cursor={{ fill: "var(--surface-elevated)" }}
                      contentStyle={{ backgroundColor: "var(--surface-elevated)", borderColor: "var(--border-color)", borderRadius: "8px" }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {stats.maintenanceByCategory.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>

            {/* Status Distribution */}
            <article className="rounded-xl border border-border-color bg-surface p-6">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold tracking-tight">Portfolio Status</h3>
                  <p className="text-sm text-muted">Property availability breakdown</p>
                </div>
                <div className="rounded-full bg-surface-elevated px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted ring-1 ring-border-color/50">
                  Real-time
                </div>
              </div>
              <div className="flex flex-col sm:flex-row h-64 items-center justify-center gap-8">
                <div className="h-full w-full max-w-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.propertyStatus}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={75}
                        paddingAngle={4}
                        dataKey="count"
                        nameKey="status"
                        stroke="none"
                      >
                        {stats.propertyStatus.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: "var(--surface-elevated)", borderRadius: "8px", border: "1px solid var(--border-color)" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col justify-center gap-3">
                  {stats.propertyStatus.map((item, index) => (
                    <div key={item.status} className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted/60 leading-none">{item.status}</span>
                        <span className="text-sm font-bold mt-0.5">{item.count} Units</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          </div>

          {/* New Section: Operational Insights */}
          <section className="grid gap-6 lg:grid-cols-3">
            <article className="lg:col-span-2 rounded-xl border border-border-color bg-surface overflow-hidden">
              <header className="p-6 border-b border-border-color/50 bg-surface-elevated/30">
                <h3 className="text-lg font-bold tracking-tight">Operational Alerts</h3>
                <p className="text-sm text-muted">Active items requiring immediate administrative attention</p>
              </header>
              <div className="divide-y divide-border-color/40">
                {stats.pendingMaintenance > 0 && (
                  <div className="flex items-center gap-4 p-5 hover:bg-surface-elevated/20 transition-colors">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-900/20">
                      <Wrench size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">Maintenance Backlog</p>
                      <p className="text-xs text-muted truncate">{stats.pendingMaintenance} work orders are currently in progress or awaiting assignment.</p>
                    </div>
                    <button className="text-xs font-bold text-foreground bg-surface-elevated px-3 py-1.5 rounded-md border border-border-color/60 hover:border-foreground/20 transition-all">
                      Review
                    </button>
                  </div>
                )}
                {stats.overduePayments > 0 && (
                  <div className="flex items-center gap-4 p-5 hover:bg-surface-elevated/20 transition-colors">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 dark:bg-red-900/20">
                      <DollarSign size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">Overdue Rent Collection</p>
                      <p className="text-xs text-muted truncate">{stats.overduePayments} tenants have invoices marked as overdue this cycle.</p>
                    </div>
                    <button className="text-xs font-bold text-foreground bg-surface-elevated px-3 py-1.5 rounded-md border border-border-color/60 hover:border-foreground/20 transition-all">
                      Collection
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-4 p-5 hover:bg-surface-elevated/20 transition-colors">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-600 dark:bg-sky-900/20">
                    <Building2 size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground">Occupancy Optimization</p>
                    <p className="text-xs text-muted truncate">Current occupancy is {stats.occupancyRate.toFixed(1)}%. {stats.vacantUnits} units are ready for listing.</p>
                  </div>
                  <button className="text-xs font-bold text-foreground bg-surface-elevated px-3 py-1.5 rounded-md border border-border-color/60 hover:border-foreground/20 transition-all">
                    View
                  </button>
                </div>
              </div>
            </article>

            <article className="rounded-xl border border-border-color bg-surface p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-lg font-bold tracking-tight">Summary Notes</h3>
                <p className="text-sm text-muted">Automated insight summary</p>
              </div>
              <div className="mt-6 space-y-4">
                <div className="p-4 rounded-lg bg-foreground/5 border-l-4 border-foreground">
                  <p className="text-xs italic text-muted leading-relaxed">
                    "Overall property health is stable. Revenue has increased by 12% compared to last month, primarily due to higher collection efficiency."
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                  <span className="text-xs font-medium">Monthly Target: 95% Collection</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-sky-500" />
                  <span className="text-xs font-medium">Occupancy Target: 100% Units</span>
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-border-color/40 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {[1,2,3].map(i => (
                    <div key={i} className="h-8 w-8 rounded-full border-2 border-surface bg-muted/20" />
                  ))}
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted/60">System Active</span>
              </div>
            </article>
          </section>
        </div>
      )}
    </ModulePage>
  );
}
