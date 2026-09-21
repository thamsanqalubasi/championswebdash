import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import { useCurrency } from '@/lib/currency';
import { supabase } from '@/lib/supabase';
import { isValidUuid } from '@/lib/data';
import { isPaymentSuppressed } from '@/lib/rent-calculator';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import {
  BarChart3, TrendingUp, Building2, Users, Package, DollarSign, Wrench, ArrowUpRight, ArrowDownRight, Calendar, Printer, RefreshCw
} from 'lucide-react';

const pieColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#6366f1', '#14b8a6', '#f97316'];

const DEPARTMENTS = [
  'Maintenance', 'Housekeeping', 'Front Desk', 'F&B', 'Events',
  'Admin', 'Marketing', 'Security', 'Spa', 'Transport'
];

export default function StatisticsPage() {
  const { currentCompany } = useAuth();
  const { currency, symbol, formatWhole } = useCurrency();
  const [timeframe, setTimeframe] = useState('This Month');
  const [loading, setLoading] = useState(true);

  // Live Stats State
  const [stats, setStats] = useState({
    totalRevenue: 0,
    totalExpenses: 0,
    netMargin: 0,
    occupancyRate: 0,
    activeLeasesBookings: 0,
    inventoryValuation: 0,
    openTasks: 0,
    staffCount: 0,
  });

  const [financialData, setFinancialData] = useState<Array<{ name: string; revenue: number; expenses: number; margin: number }>>([]);
  const [revenueStreamData, setRevenueStreamData] = useState<Array<{ name: string; bookings: number; leases: number; services: number }>>([]);
  const [budgetData, setBudgetData] = useState<Array<{ name: string; value: number }>>([]);
  const [occupancyData, setOccupancyData] = useState<Array<{ name: string; occupancy: number }>>([]);
  const [inventoryData, setInventoryData] = useState<Array<{ name: string; received: number; issued: number }>>([]);
  const [workOrdersData, setWorkOrdersData] = useState<Array<{ name: string; high: number; medium: number; low: number }>>([]);
  const [departmentPerformance, setDepartmentPerformance] = useState<Array<{ id: number; department: string; revenue: number; expenses: number; margin: number; tasksCompleted: number; sla: number }>>([]);

  useEffect(() => {
    let cancelled = false;

    async function loadStats() {
      setLoading(true);
      const compId = currentCompany?.id;

      if (!compId || !isValidUuid(compId)) {
        // Empty baseline
        setStats({
          totalRevenue: 0,
          totalExpenses: 0,
          netMargin: 0,
          occupancyRate: 0,
          activeLeasesBookings: 0,
          inventoryValuation: 0,
          openTasks: 0,
          staffCount: 0,
        });
        setFinancialData([]);
        setRevenueStreamData([]);
        setBudgetData([]);
        setOccupancyData([]);
        setInventoryData([]);
        setWorkOrdersData([]);
        setDepartmentPerformance(DEPARTMENTS.map((d, i) => ({
          id: i + 1,
          department: d,
          revenue: 0,
          expenses: 0,
          margin: 0,
          tasksCompleted: 0,
          sla: 100,
        })));
        setLoading(false);
        return;
      }

      try {
        const [
          invoicesRes,
          bookingsRes,
          propsRes,
          roomsRes,
          contractsRes,
          maintRes,
          invRes,
          storesRes,
          usersRes,
          expensesRes,
          rentPaymentsRes,
          financeTxsRes,
        ] = await Promise.all([
          supabase.from("invoices").select("id, tenant_id, month, total_amount, status, created_at, is_suppressed").eq("company_id", compId).neq("status", "suppressed"),
          supabase.from("commercial_bookings").select("total_amount, amount_paid, booking_status, created_at").eq("company_id", compId),
          supabase.from("properties").select("id, name, status, monthly_rent").eq("company_id", compId),
          supabase.from("commercial_rooms").select("id, status").eq("company_id", compId),
          supabase.from("contracts").select("id, status").eq("company_id", compId),
          supabase.from("maintenance").select("id, status, category, priority, cost, created_at").eq("company_id", compId),
          supabase.from("maintenance_inventory").select("quantity, unit_cost").eq("company_id", compId),
          supabase.from("stores_inventory").select("quantity, unit_cost").eq("company_id", compId),
          supabase.from("company_users").select("id, department, is_active").eq("company_id", compId),
          supabase.from("property_expenses").select("amount, category, created_at").eq("company_id", compId),
          supabase.from("tenant_rent_payments").select("id, tenant_id, amount_paid, payment_date, paid_months, created_at, is_suppressed, notes").eq("company_id", compId),
          supabase.from("finance_transactions").select("amount, type, category, transaction_date, created_at, status, is_suppressed").eq("company_id", compId).eq("status", "approved"),
        ]);

        if (cancelled) return;

        // Strictly exclude suppressed invoices, payments, and transactions from revenue metrics
        const invoices = (invoicesRes.data || []).filter((i: any) => !i.is_suppressed && i.status !== "suppressed");
        const bookings = bookingsRes.data || [];
        const props = propsRes.data || [];
        const rooms = roomsRes.data || [];
        const contracts = contractsRes.data || [];
        const maintenance = maintRes.data || [];
        const invItems = invRes.data || [];
        const storesItems = storesRes.data || [];
        const compUsers = usersRes.data || [];
        const propExpenses = expensesRes.data || [];
        const rentPayments = (rentPaymentsRes.data || []).filter((r: any) => !isPaymentSuppressed(r));
        const financeTxs = (financeTxsRes.data || []).filter((tx: any) => !tx.is_suppressed && tx.status !== "suppressed" && tx.status !== "cancelled");

        // Deduplicate rent payments by unique record ID to preserve legitimate multiple installments within the same billing month
        const seenRentIds = new Set<string>();
        const deduplicatedRentPayments = (rentPayments || []).filter((r: any) => {
          const id = String(r.id || "");
          if (id && seenRentIds.has(id)) return false;
          if (id) seenRentIds.add(id);
          return true;
        });

        // 1. Revenue
        const paidInvoiceTotal = invoices
          .filter((i) => i.status === "paid")
          .reduce((sum, i) => sum + Number(i.total_amount || 0), 0);
        const paidBookingTotal = bookings
          .reduce((sum, b) => sum + Number(b.amount_paid || 0), 0);

        // Paid invoice tenant+month keys to prevent double-counting with rent payments table
        const paidInvoiceKeys = new Set(
          invoices
            .filter((i) => i.status === "paid" && i.tenant_id)
            .map((i) => `${i.tenant_id}_${String(i.month || "").slice(0, 7)}`)
        );

        const unInvoicedRentTotal = deduplicatedRentPayments
          .filter((r: any) => {
            const monthKey = Array.isArray(r.paid_months) && r.paid_months[0]
              ? String(r.paid_months[0]).slice(0, 7)
              : String(r.payment_date || "").slice(0, 7);
            return !paidInvoiceKeys.has(`${r.tenant_id || ""}_${monthKey}`);
          })
          .reduce((sum, r: any) => sum + Number(r.amount_paid || 0), 0);

        // Other non-rent finance income
        const otherFinanceIncome = financeTxs
          .filter((tx) => tx.type === "income" && tx.category !== "Rent Collection")
          .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

        // Calculate combined revenue avoiding double counting between paid invoices and direct rent collections
        const effectiveLeaseRevenue = paidInvoiceTotal + unInvoicedRentTotal;
        const totalRev = effectiveLeaseRevenue + paidBookingTotal + otherFinanceIncome;

        // 2. Expenses
        const maintExpense = maintenance.reduce((sum, m) => sum + Number(m.cost || 0), 0);
        const otherExpense = propExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
        const financeExpense = financeTxs
          .filter((tx) => tx.type === "expense" || tx.type === "payment")
          .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
        const totalExp = maintExpense + otherExpense + financeExpense;

        const netMarginPct = totalRev > 0 ? Number(((totalRev - totalExp) / totalRev * 100).toFixed(1)) : 0;

        // 3. Occupancy
        const occupiedProps = props.filter((p) => p.status === "occupied").length;
        const occupiedRooms = rooms.filter((r) => r.status === "occupied").length;
        const totalUnits = props.length + rooms.length;
        const occupancyPct = totalUnits > 0 ? Number(((occupiedProps + occupiedRooms) / totalUnits * 100).toFixed(1)) : 0;

        // 4. Active Leases & Bookings
        const activeContracts = contracts.filter((c) => c.status === "active").length;
        const activeBookings = bookings.filter((b) => ["confirmed", "checked_in"].includes(b.booking_status)).length;
        const totalActiveLeases = activeContracts + activeBookings;

        // 5. Inventory Valuation
        const maintInvVal = invItems.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_cost || 0)), 0);
        const storesInvVal = storesItems.reduce((sum, item) => sum + (Number(item.quantity || 0) * Number(item.unit_cost || 0)), 0);
        const totalValuation = maintInvVal + storesInvVal;

        // 6. Open Tasks
        const openTasksCount = maintenance.filter((m) => m.status === "open" || m.status === "in_progress").length;

        // 7. Staff Count
        const staffTotal = compUsers.filter((u) => u.is_active !== false).length;

        setStats({
          totalRevenue: totalRev,
          totalExpenses: totalExp,
          netMargin: netMarginPct,
          occupancyRate: occupancyPct,
          activeLeasesBookings: totalActiveLeases,
          inventoryValuation: totalValuation,
          openTasks: openTasksCount,
          staffCount: staffTotal,
        });

        // 8. Financial Trajectory (Past 6 months)
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const now = new Date();
        const finHistory = [];
        const revStreamHistory = [];

        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthKey = d.toISOString().slice(0, 7);
          const label = monthNames[d.getMonth()];

          const mInvoices = invoices.filter((inv) => (inv.created_at || "").startsWith(monthKey));
          const mInvLeases = mInvoices.filter((inv) => inv.status === "paid").reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
          const mRentCollections = rentPayments
            .filter((rp) => (rp.payment_date || rp.created_at || "").startsWith(monthKey))
            .reduce((sum, rp) => sum + Number(rp.amount_paid || 0), 0);
          const mLeases = Math.max(mRentCollections, mInvLeases);

          const mBookings = bookings.filter((b) => (b.created_at || "").startsWith(monthKey));
          const mBookingRev = mBookings.reduce((sum, b) => sum + Number(b.amount_paid || 0), 0);

          const mMaint = maintenance.filter((m) => (m.created_at || "").startsWith(monthKey));
          const mMaintExp = mMaint.reduce((sum, m) => sum + Number(m.cost || 0), 0);
          const mPropExp = propExpenses.filter((e) => (e.created_at || "").startsWith(monthKey)).reduce((sum, e) => sum + Number(e.amount || 0), 0);
          const mFinanceExp = financeTxs
            .filter((tx) => (tx.type === "expense" || tx.type === "payment") && (tx.transaction_date || tx.created_at || "").startsWith(monthKey))
            .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
          const mExp = mMaintExp + mPropExp + mFinanceExp;

          const mFinanceIncome = financeTxs
            .filter((tx) => tx.type === "income" && tx.category !== "Rent Collection" && (tx.transaction_date || tx.created_at || "").startsWith(monthKey))
            .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
          const mRev = mLeases + mBookingRev + mFinanceIncome;

          finHistory.push({
            name: label,
            revenue: mRev,
            expenses: mExp,
            margin: mRev - mExp,
          });

          revStreamHistory.push({
            name: label,
            bookings: mBookingRev,
            leases: mLeases,
            services: mFinanceIncome,
          });
        }

        setFinancialData(finHistory);
        setRevenueStreamData(revStreamHistory);

        // 9. Departmental Budget / Expenses
        const categoryMap: Record<string, number> = {};
        maintenance.forEach((m) => {
          const cat = m.category ? m.category.charAt(0).toUpperCase() + m.category.slice(1) : "Maintenance";
          categoryMap[cat] = (categoryMap[cat] || 0) + Number(m.cost || 0);
        });
        propExpenses.forEach((e) => {
          const cat = e.category ? e.category.charAt(0).toUpperCase() + e.category.slice(1) : "Utilities";
          categoryMap[cat] = (categoryMap[cat] || 0) + Number(e.amount || 0);
        });

        const bData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));
        setBudgetData(bData.length > 0 ? bData : [{ name: "No expenses", value: 0 }]);

        // 10. Occupancy Data per Property
        const occData = props.map((p) => ({
          name: p.name.length > 15 ? p.name.slice(0, 15) + "..." : p.name,
          occupancy: p.status === "occupied" ? 100 : 0,
        }));
        setOccupancyData(occData);

        // 11. Work Orders Breakdown
        const cats = ["Electrical", "Plumbing", "HVAC", "General"];
        const woData = cats.map((cat) => {
          const matching = maintenance.filter((m) => (m.category || "").toLowerCase() === cat.toLowerCase());
          return {
            name: cat,
            high: matching.filter((m) => m.priority === "high" || m.priority === "urgent").length,
            medium: matching.filter((m) => m.priority === "medium").length,
            low: matching.filter((m) => m.priority === "low").length,
          };
        });
        setWorkOrdersData(woData);

        // 12. Department Performance Table
        const deptRows = DEPARTMENTS.map((dept, index) => {
          const deptUsers = compUsers.filter((u) => u.department === dept.toLowerCase().replace(/[^a-z]/g, '_'));
          const deptMaint = maintenance.filter((m) => (m.category || "").toLowerCase() === dept.toLowerCase());
          const tasksDone = deptMaint.filter((m) => m.status === "completed").length;
          const deptExp = deptMaint.reduce((sum, m) => sum + Number(m.cost || 0), 0);
          const deptRev = dept === 'Front Desk' ? paidBookingTotal : 0;

          return {
            id: index + 1,
            department: dept,
            revenue: deptRev,
            expenses: deptExp,
            margin: deptRev - deptExp,
            tasksCompleted: tasksDone,
            sla: tasksDone > 0 ? 98 : 100,
          };
        });
        setDepartmentPerformance(deptRows);

      } catch (err) {
        console.warn("Could not load company statistics", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadStats();
    return () => { cancelled = true; };
  }, [currentCompany?.id]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 bg-surface text-foreground">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">System Statistics & Analytics</h1>
          <p className="text-xs text-muted mt-1">
            Active Organisation: <span className="font-semibold text-foreground">{currentCompany?.name || "No Company Selected"}</span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <select
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="appearance-none bg-surface-elevated border border-border-color rounded-lg px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>Today</option>
              <option>This Week</option>
              <option>This Month</option>
              <option>This Quarter</option>
              <option>Year-to-Date</option>
              <option>All Time</option>
            </select>
            <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          </div>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-surface-elevated border border-border-color px-4 py-2 rounded-lg text-sm hover:bg-muted/10 transition"
          >
            <Printer className="w-4 h-4" />
            Print / Export
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center p-12 text-sm text-muted">
          <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
          Loading company metrics...
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        <div className="bg-surface rounded-2xl border border-border-color p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted mb-1">Total Revenue ({currency})</p>
              <h3 className="text-2xl font-bold">{formatWhole(stats.totalRevenue)}</h3>
            </div>
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-muted">Settled collections & bookings</span>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border-color p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted mb-1">Net Operating Margin</p>
              <h3 className="text-2xl font-bold">{stats.netMargin}%</h3>
            </div>
            <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-500">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-muted">Net profit margin</span>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border-color p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted mb-1">Portfolio Occupancy</p>
              <h3 className="text-2xl font-bold">{stats.occupancyRate}%</h3>
            </div>
            <div className="p-2 bg-amber-500/10 rounded-lg text-amber-500">
              <Building2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-muted">Occupied units & rooms</span>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border-color p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted mb-1">Active Leases & Bookings</p>
              <h3 className="text-2xl font-bold">{stats.activeLeasesBookings}</h3>
            </div>
            <div className="p-2 bg-purple-500/10 rounded-lg text-purple-500">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-muted">Active tenancies & guests</span>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border-color p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted mb-1">Inventory Valuation ({currency})</p>
              <h3 className="text-2xl font-bold">{formatWhole(stats.inventoryValuation)}</h3>
            </div>
            <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-500">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-muted">Stores & maintenance assets</span>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border-color p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted mb-1">Open Tasks</p>
              <h3 className="text-2xl font-bold">{stats.openTasks}</h3>
            </div>
            <div className="p-2 bg-pink-500/10 rounded-lg text-pink-500">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-muted">Pending maintenance orders</span>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border-color p-6 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-sm text-muted mb-1">Staff Count</p>
              <h3 className="text-2xl font-bold">{stats.staffCount}</h3>
            </div>
            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-500">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <span className="text-muted">Active company staff</span>
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-2xl border border-border-color p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Financial Trajectory</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={financialData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.5} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="revenue" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                <Area type="monotone" dataKey="expenses" stackId="2" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
                <Area type="monotone" dataKey="margin" stackId="3" stroke="#10b981" fill="#10b981" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border-color p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Revenue by Stream</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueStreamData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.5} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="bookings" fill="#3b82f6" />
                <Bar dataKey="leases" fill="#10b981" />
                <Bar dataKey="services" fill="#f59e0b" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border-color p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Departmental Budget Consumption</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={budgetData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {budgetData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border-color p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Property Occupancy Comparison</h3>
          <div className="h-[300px]">
            {occupancyData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted">
                No properties registered in this organisation yet.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={occupancyData} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.5} />
                  <XAxis type="number" domain={[0, 100]} />
                  <YAxis dataKey="name" type="category" />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="occupancy" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-border-color p-6 shadow-sm">
          <h3 className="text-lg font-semibold mb-4">Maintenance Work Orders</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={workOrdersData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.5} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="high" fill="#ef4444" stackId="a" />
                <Bar dataKey="medium" fill="#f59e0b" stackId="a" />
                <Bar dataKey="low" fill="#10b981" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Departmental Performance Table */}
      <div className="bg-surface rounded-2xl border border-border-color shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border-color">
          <h3 className="text-lg font-semibold">Departmental Performance</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-elevated text-muted">
              <tr>
                <th className="p-4 font-medium">Department</th>
                <th className="p-4 font-medium text-right">Revenue</th>
                <th className="p-4 font-medium text-right">Expenses</th>
                <th className="p-4 font-medium text-right">Margin</th>
                <th className="p-4 font-medium text-right">Tasks Completed</th>
                <th className="p-4 font-medium text-right">SLA %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color">
              {departmentPerformance.map((dept) => (
                <tr key={dept.id} className="hover:bg-surface-elevated/50">
                  <td className="p-4 font-medium">{dept.department}</td>
                  <td className="p-4 text-right">{formatWhole(dept.revenue)}</td>
                  <td className="p-4 text-right">{formatWhole(dept.expenses)}</td>
                  <td className={`p-4 text-right font-medium ${dept.margin >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {formatWhole(dept.margin)}
                  </td>
                  <td className="p-4 text-right">{dept.tasksCompleted}</td>
                  <td className="p-4 text-right">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${dept.sla >= 95 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {dept.sla}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
