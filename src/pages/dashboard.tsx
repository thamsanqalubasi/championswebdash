import { useEffect, useState } from "react";
import { ModulePage } from "@/components/module-page";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { fetchDashboardData, fetchCommercialBookings } from "@/lib/data";
import type { DashboardData, CommercialBooking } from "@/lib/types";
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
        <div className="rounded-xl bg-surface-elevated p-2.5 ring-1 ring-border-color/50 group-hover:ring-foreground/20">
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
  const { currentCompany } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [recentBookings, setRecentBookings] = useState<CommercialBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [checkinOpen, setCheckinOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [result, bks] = await Promise.all([
          fetchDashboardData(currentCompany.id),
          fetchCommercialBookings(currentCompany.id),
        ]);
        if (!cancelled) {
          setData(result);
          setRecentBookings(bks.slice(0, 5));
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

  return (
    <ModulePage
      title={`${currentCompany.name}`}
      description="Hospitality lodging metrics, real-time guest occupancy, cash flows, and operations."
    >
      {loading && <LoadingState label="Analyzing company & lodging data..." />}

      {!loading && error && (
        <ErrorState message={error} onRetry={() => setReloadKey((v) => v + 1)} />
      )}

      {!loading && !error && stats && data && (
        <div className="space-y-6">
          {/* Quick Operations Action Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-600/10 via-surface to-surface p-5 shadow-sm">
            <div className="flex items-center gap-3.5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md">
                <KeyRound size={24} />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  Front Desk Quick Actions
                </h2>
                <p className="text-xs text-muted">
                  Instant client walk-in check-in with booking code generation & online code verification.
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
                <span>View All Bookings</span>
              </Link>
            </div>
          </div>

          {/* Hospitality & Room Overview Strip */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-sm">
              <div className="flex items-center gap-2 text-blue-600">
                <BedDouble size={18} />
                <span className="text-xs font-bold uppercase tracking-wider">Total Rooms</span>
              </div>
              <p className="mt-2 text-2xl font-black text-foreground">{stats.totalRooms}</p>
              <p className="text-[11px] text-muted">{stats.totalCommercialProperties} Lodges / Hotels</p>
            </div>

            <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-sm">
              <div className="flex items-center gap-2 text-emerald-600">
                <Sparkles size={18} />
                <span className="text-xs font-bold uppercase tracking-wider">Available Rooms</span>
              </div>
              <p className="mt-2 text-2xl font-black text-emerald-600">{stats.availableRooms}</p>
              <p className="text-[11px] text-muted">Ready for walk-in</p>
            </div>

            <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-sm">
              <div className="flex items-center gap-2 text-blue-600">
                <Users size={18} />
                <span className="text-xs font-bold uppercase tracking-wider">Occupied Rooms</span>
              </div>
              <p className="mt-2 text-2xl font-black text-blue-600">{stats.occupiedRooms}</p>
              <p className="text-[11px] text-muted">{stats.occupancyRate}% occupancy</p>
            </div>

            <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-sm">
              <div className="flex items-center gap-2 text-amber-600">
                <Brush size={18} />
                <span className="text-xs font-bold uppercase tracking-wider">Cleaning Needed</span>
              </div>
              <p className="mt-2 text-2xl font-black text-amber-600">{stats.cleaningNeededRooms}</p>
              <p className="text-[11px] text-muted">Housekeeping queue</p>
            </div>
          </div>

          {/* Main Financial Stats Grid */}
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
              detail="Maintenance & Housekeeping"
              icon={Wrench}
              trend={{ value: "4%", positive: false }}
              colorClass="text-amber-600"
            />
            <StatCard
              label="Net Operating Income"
              value={formatCurrency(stats.netProfit)}
              detail="Net monthly margin"
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

          {/* Charts Strip */}
          <div className="grid gap-6 lg:grid-cols-3">
            <article className="rounded-2xl border border-border-color bg-surface p-6 lg:col-span-2 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold tracking-tight">Financial & Hospitality Trends</h3>
                  <p className="text-sm text-muted">Revenue vs Expenses (Last 6 Months)</p>
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
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                View All →
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
