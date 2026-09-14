import { useEffect, useState, useMemo } from "react";
import { ModulePage } from "@/components/module-page";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import {
  fetchDashboardData,
  fetchCommercialBookings,
  fetchProcurementRequests,
  fetchStoresInventory,
  fetchCompanyUsers,
  fetchAuditEvents,
  fetchProperties,
} from "@/lib/data";
import type {
  DashboardData,
  CommercialBooking,
  ProcurementRequest,
  StoresItem,
  DepartmentType,
  CompanyUser,
  AuditEventRow,
  PropertyRow,
} from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { CheckinModal } from "@/components/checkin-modal";
import {
  TrendingUp,
  Users,
  Building2,
  DollarSign,
  MapPin,
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
  ChevronDown,
  ChevronUp,
  PlusCircle,
  Server,
  Activity,
  Globe,
  Settings,
  UserCog,
  FileSignature,
  Sliders,
  Check,
  FolderOpen,
  Folder,
  SlidersHorizontal,
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
  const { formatWhole: formatCurrency, currency, symbol } = useCurrency();
  const [data, setData] = useState<DashboardData | null>(null);
  const [allCommercialBookings, setAllCommercialBookings] = useState<CommercialBooking[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [expandedPropertyIds, setExpandedPropertyIds] = useState<Record<string, boolean>>({});
  const [recentBookings, setRecentBookings] = useState<CommercialBooking[]>([]);
  const [procurementRequests, setProcurementRequests] = useState<ProcurementRequest[]>([]);
  const [storesInventory, setStoresInventory] = useState<StoresItem[]>([]);
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [checkinOpen, setCheckinOpen] = useState(false);

  const togglePropertyAccordion = (propId: string) => {
    setExpandedPropertyIds((prev) => ({
      ...prev,
      [propId]: !prev[propId],
    }));
  };

  const accommodationProperties = useMemo(() => {
    return properties.filter((p) =>
      ["hotel", "motel", "lodge", "guest_house", "commercial"].includes(p.type)
    );
  }, [properties]);

  // Accordion drop toggler state for all departments
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({
    it: false,
    procurement: false,
    stores: false,
    front_desk: false,
    finance: false,
    maintenance: false,
    hr: false,
    portal: false,
    audit: false,
    governance: false,
  });

  const toggleDept = (deptId: string) => {
    setExpandedDepts((prev) => ({ ...prev, [deptId]: !prev[deptId] }));
  };

  const expandAll = () => {
    setExpandedDepts({
      it: true,
      procurement: true,
      stores: true,
      front_desk: true,
      finance: true,
      maintenance: true,
      hr: true,
      portal: true,
      audit: true,
      governance: true,
    });
  };

  const collapseAll = () => {
    setExpandedDepts({
      it: false,
      procurement: false,
      stores: false,
      front_desk: false,
      finance: false,
      maintenance: false,
      hr: false,
      portal: false,
      audit: false,
      governance: false,
    });
  };

  const userDept = currentCompanyUser?.department || "admin";
  const isExecutive = isSuperAdmin || isAdmin;

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const [result, bks, procReqs, storesItems, users, audits, propsData] = await Promise.all([
          fetchDashboardData(currentCompany.id),
          fetchCommercialBookings(currentCompany.id),
          fetchProcurementRequests(currentCompany.id),
          fetchStoresInventory(currentCompany.id),
          fetchCompanyUsers(currentCompany.id),
          fetchAuditEvents(currentCompany.id),
          fetchProperties(currentCompany.id),
        ]);
        if (!cancelled) {
          setData(result);
          setAllCommercialBookings(bks || []);
          setRecentBookings((bks || []).slice(0, 5));
          setProcurementRequests(procReqs || []);
          setStoresInventory(storesItems || []);
          setCompanyUsers(users || []);
          setAuditEvents(audits || []);
          setProperties(propsData || []);
          const firstAccomm = (propsData || []).find((p) =>
            ["hotel", "motel", "lodge", "guest_house", "commercial"].includes(p.type)
          );
          if (firstAccomm) {
            setExpandedPropertyIds({ [firstAccomm.id]: true });
          }
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
      title={isExecutive ? `${currentCompany.name} — Super Admin Dashboard` : `${currentCompany.name} — ${currentCompanyUser?.jobTitle || "Staff Portal"}`}
      description={
        isExecutive
          ? "Enterprise hospitality & property management. Click any department below to toggle its operational functions."
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
              {/* Executive Overview Banner */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-600/10 via-surface to-surface p-5 shadow-sm">
                <div className="flex items-center gap-3.5">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md shrink-0">
                    <Layers size={24} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-base font-bold text-foreground">
                        Operational Department Command Deck
                      </h2>
                      <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 border border-emerald-500/20 uppercase tracking-wider">
                        All Services Active
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-0.5">
                      10 Operational Departments • Real-time synchronization between Front Desk, Stores, Procurement, HR, and Accounts.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setCheckinOpen(true)}
                    className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition"
                  >
                    <KeyRound size={15} />
                    <span>Check In Guest</span>
                  </button>
                  <Link
                    to="/procurement"
                    className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-purple-700 transition"
                  >
                    <Truck size={15} />
                    <span>New Procurement</span>
                  </Link>
                </div>
              </div>

              {/* Accordion Controls Bar */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                    <SlidersHorizontal size={14} className="text-blue-600" />
                    Departments & Functions (Click heading to expand / collapse)
                  </h3>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={expandAll}
                    className="text-xs font-semibold text-blue-600 hover:underline px-2 py-1"
                  >
                    Expand All
                  </button>
                  <span className="text-muted text-xs">•</span>
                  <button
                    type="button"
                    onClick={collapseAll}
                    className="text-xs font-semibold text-muted hover:text-foreground px-2 py-1"
                  >
                    Collapse All
                  </button>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* THE 10 OPERATIONAL DEPARTMENTS AS DROPDOWN TOGGLERS                       */}
              {/* ========================================================================= */}
              <div className="space-y-4">

                {/* 1. IT & SYSTEM ADMINISTRATION TOGGLER */}
                <div className="rounded-2xl border border-blue-500/20 bg-surface shadow-sm overflow-hidden transition">
                  <button
                    type="button"
                    onClick={() => toggleDept("it")}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-surface-elevated/40 transition"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 shrink-0">
                        <Server size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-foreground">IT & System Administration</h4>
                          <span className="rounded-full bg-blue-600/10 text-blue-600 px-2 py-0.5 text-[10px] font-bold">
                            {companyUsers.length || 6} Staff Accounts
                          </span>
                        </div>
                        <p className="text-xs text-muted">User accounts, role rights, company settings & security history</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted font-medium hidden sm:inline">
                        {expandedDepts.it ? "Collapse" : "Expand Functions"}
                      </span>
                      {expandedDepts.it ? (
                        <ChevronUp size={18} className="text-muted" />
                      ) : (
                        <ChevronDown size={18} className="text-muted" />
                      )}
                    </div>
                  </button>

                  {expandedDepts.it && (
                    <div className="p-5 pt-0 border-t border-border-color/60 space-y-4 bg-muted/5">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3">
                        {/* Group 1: User Rights & Access */}
                        <div className="rounded-xl border border-border-color bg-surface p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-wider">
                            <Users size={15} />
                            <span>User Rights & Access</span>
                          </div>
                          <p className="text-xs text-muted">Create staff logins, assign job titles, and enforce department security.</p>
                          <div className="pt-2 flex flex-col gap-1.5">
                            <Link
                              to="/users-management"
                              className="flex items-center justify-between rounded-lg bg-surface-elevated p-2 text-xs font-semibold text-foreground hover:bg-blue-600 hover:text-white transition group"
                            >
                              <span>Manage Staff Accounts</span>
                              <ArrowUpRight size={13} className="text-muted group-hover:text-white" />
                            </Link>
                            <Link
                              to="/organogram"
                              className="flex items-center justify-between rounded-lg bg-surface-elevated p-2 text-xs font-semibold text-foreground hover:bg-blue-600 hover:text-white transition group"
                            >
                              <span>Organogram & Role Hierarchy</span>
                              <ArrowUpRight size={13} className="text-muted group-hover:text-white" />
                            </Link>
                          </div>
                        </div>

                        {/* Group 2: Company & System Settings */}
                        <div className="rounded-xl border border-border-color bg-surface p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-purple-600 font-bold text-xs uppercase tracking-wider">
                            <Settings size={15} />
                            <span>Company & Settings</span>
                          </div>
                          <p className="text-xs text-muted">Configure organization profile, invoice logos, tax defaults, and emails.</p>
                          <div className="pt-2 flex flex-col gap-1.5">
                            <Link
                              to="/settings"
                              className="flex items-center justify-between rounded-lg bg-surface-elevated p-2 text-xs font-semibold text-foreground hover:bg-purple-600 hover:text-white transition group"
                            >
                              <span>General Company Settings</span>
                              <ArrowUpRight size={13} className="text-muted group-hover:text-white" />
                            </Link>
                            <Link
                              to="/settings"
                              className="flex items-center justify-between rounded-lg bg-surface-elevated p-2 text-xs font-semibold text-foreground hover:bg-purple-600 hover:text-white transition group"
                            >
                              <span>Email & Notifications</span>
                              <ArrowUpRight size={13} className="text-muted group-hover:text-white" />
                            </Link>
                          </div>
                        </div>

                        {/* Group 3: Data & Security */}
                        <div className="rounded-xl border border-border-color bg-surface p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-wider">
                            <ShieldCheck size={15} />
                            <span>Data & Security</span>
                          </div>
                          <p className="text-xs text-muted">Review administrative action history and manage data backups.</p>
                          <div className="pt-2 flex flex-col gap-1.5">
                            <Link
                              to="/it"
                              className="flex items-center justify-between rounded-lg bg-surface-elevated p-2 text-xs font-semibold text-foreground hover:bg-emerald-600 hover:text-white transition group"
                            >
                              <span>IT Administration Hub</span>
                              <ArrowUpRight size={13} className="text-muted group-hover:text-white" />
                            </Link>
                            <Link
                              to="/audit-trail"
                              className="flex items-center justify-between rounded-lg bg-surface-elevated p-2 text-xs font-semibold text-foreground hover:bg-emerald-600 hover:text-white transition group"
                            >
                              <span>Activity Audit History</span>
                              <ArrowUpRight size={13} className="text-muted group-hover:text-white" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. FRONT DESK & HOSPITALITY TOGGLER */}
                <div className="rounded-2xl border border-border-color bg-surface shadow-sm overflow-hidden transition">
                  <button
                    type="button"
                    onClick={() => toggleDept("front_desk")}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-surface-elevated/40 transition"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 shrink-0">
                        <BedDouble size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-foreground">Front Desk & Hospitality</h4>
                          <span className="rounded-full bg-emerald-500/10 text-emerald-600 px-2 py-0.5 text-[10px] font-bold">
                            {stats.occupancyRate}% Occupied
                          </span>
                        </div>
                        <p className="text-xs text-muted">Walk-in check-in, bookings calendar, room management & cleaning queue</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted font-medium hidden sm:inline">
                        {expandedDepts.front_desk ? "Collapse" : "Expand Functions"}
                      </span>
                      {expandedDepts.front_desk ? (
                        <ChevronUp size={18} className="text-muted" />
                      ) : (
                        <ChevronDown size={18} className="text-muted" />
                      )}
                    </div>
                  </button>

                  {expandedDepts.front_desk && (
                    <div className="p-5 pt-0 border-t border-border-color/60 space-y-4 bg-muted/5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
                        <div className="rounded-xl border border-border-color bg-surface p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-wider">
                            <KeyRound size={15} />
                            <span>Guest Operations</span>
                          </div>
                          <div className="pt-1 flex flex-col gap-1.5">
                            <button
                              type="button"
                              onClick={() => setCheckinOpen(true)}
                              className="flex items-center justify-between rounded-lg bg-blue-600 p-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
                            >
                              <span>Check In Guest (Walk-in)</span>
                              <KeyRound size={13} />
                            </button>
                            <Link
                              to="/commercial-bookings"
                              className="flex items-center justify-between rounded-lg bg-surface-elevated p-2 text-xs font-semibold text-foreground hover:bg-surface transition"
                            >
                              <span>All Guest Bookings</span>
                              <ArrowUpRight size={13} />
                            </Link>
                          </div>
                        </div>

                        <div className="rounded-xl border border-border-color bg-surface p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-wider">
                            <BedDouble size={15} />
                            <span>Rooms & Lodging</span>
                          </div>
                          <div className="pt-1 flex flex-col gap-1.5">
                            <Link
                              to="/room-management"
                              className="flex items-center justify-between rounded-lg bg-surface-elevated p-2 text-xs font-semibold text-foreground hover:bg-surface transition"
                            >
                              <span>Rooms & Pricing Tiers</span>
                              <ArrowUpRight size={13} />
                            </Link>
                            <Link
                              to="/properties"
                              className="flex items-center justify-between rounded-lg bg-surface-elevated p-2 text-xs font-semibold text-foreground hover:bg-surface transition"
                            >
                              <span>Properties & Lodges</span>
                              <ArrowUpRight size={13} />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 3. PROCUREMENT TOGGLER */}
                <div className="rounded-2xl border border-purple-500/20 bg-surface shadow-sm overflow-hidden transition">
                  <button
                    type="button"
                    onClick={() => toggleDept("procurement")}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-surface-elevated/40 transition"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600/10 text-purple-600 shrink-0">
                        <Truck size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-foreground">Procurement Department</h4>
                          <span className="rounded-full bg-purple-600/10 text-purple-600 px-2 py-0.5 text-[10px] font-bold">
                            {procurementMetrics.active} In Pipeline
                          </span>
                        </div>
                        <p className="text-xs text-muted">Purchase requests, quotation gathering (max 10), supplier RFQs & accounts funding</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted font-medium hidden sm:inline">
                        {expandedDepts.procurement ? "Collapse" : "Expand Functions"}
                      </span>
                      {expandedDepts.procurement ? (
                        <ChevronUp size={18} className="text-muted" />
                      ) : (
                        <ChevronDown size={18} className="text-muted" />
                      )}
                    </div>
                  </button>

                  {expandedDepts.procurement && (
                    <div className="p-5 pt-0 border-t border-border-color/60 space-y-4 bg-muted/5">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3">
                        <div className="rounded-xl border border-border-color bg-surface p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-purple-600 font-bold text-xs uppercase tracking-wider">
                            <ClipboardList size={15} />
                            <span>Purchasing Requests</span>
                          </div>
                          <div className="pt-1 flex flex-col gap-1.5">
                            <Link
                              to="/procurement"
                              className="flex items-center justify-between rounded-lg bg-purple-600 p-2 text-xs font-semibold text-white shadow-sm hover:bg-purple-700 transition"
                            >
                              <span>New Purchase Request</span>
                              <PlusCircle size={13} />
                            </Link>
                            <Link
                              to="/procurement"
                              className="flex items-center justify-between rounded-lg bg-surface-elevated p-2 text-xs font-semibold text-foreground hover:bg-surface transition"
                            >
                              <span>View Pipeline Stages</span>
                              <ArrowUpRight size={13} />
                            </Link>
                          </div>
                        </div>

                        <div className="rounded-xl border border-border-color bg-surface p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-amber-600 font-bold text-xs uppercase tracking-wider">
                            <Clock size={15} />
                            <span>Quotes & Sourcing</span>
                          </div>
                          <div className="pt-1 flex flex-col gap-1.5">
                            <Link
                              to="/procurement"
                              className="flex items-center justify-between rounded-lg bg-surface-elevated p-2 text-xs font-semibold text-foreground hover:bg-surface transition"
                            >
                              <span>Quotation Gathering ({procurementMetrics.inQuotation})</span>
                              <ArrowUpRight size={13} />
                            </Link>
                            <Link
                              to="/procurement"
                              className="flex items-center justify-between rounded-lg bg-surface-elevated p-2 text-xs font-semibold text-foreground hover:bg-surface transition"
                            >
                              <span>Generate RFQ Document</span>
                              <ArrowUpRight size={13} />
                            </Link>
                          </div>
                        </div>

                        <div className="rounded-xl border border-border-color bg-surface p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-pink-600 font-bold text-xs uppercase tracking-wider">
                            <DollarSign size={15} />
                            <span>Accounts Funding</span>
                          </div>
                          <div className="pt-1 flex flex-col gap-1.5">
                            <Link
                              to="/procurement"
                              className="flex items-center justify-between rounded-lg bg-surface-elevated p-2 text-xs font-semibold text-foreground hover:bg-surface transition"
                            >
                              <span>Awaiting Funds ({procurementMetrics.awaitingFunds})</span>
                              <ArrowUpRight size={13} />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 4. STORES & INVENTORY TOGGLER */}
                <div className="rounded-2xl border border-emerald-500/20 bg-surface shadow-sm overflow-hidden transition">
                  <button
                    type="button"
                    onClick={() => toggleDept("stores")}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-surface-elevated/40 transition"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-600 shrink-0">
                        <Package size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-foreground">Stores & Central Inventory</h4>
                          <span className="rounded-full bg-emerald-500/10 text-emerald-600 px-2 py-0.5 text-[10px] font-bold">
                            {storesMetrics.totalItems} Items Cataloged
                          </span>
                        </div>
                        <p className="text-xs text-muted">Stockroom catalog, stock receipts, departmental issuance & maintenance inventory blend</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted font-medium hidden sm:inline">
                        {expandedDepts.stores ? "Collapse" : "Expand Functions"}
                      </span>
                      {expandedDepts.stores ? (
                        <ChevronUp size={18} className="text-muted" />
                      ) : (
                        <ChevronDown size={18} className="text-muted" />
                      )}
                    </div>
                  </button>

                  {expandedDepts.stores && (
                    <div className="p-5 pt-0 border-t border-border-color/60 space-y-4 bg-muted/5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
                        <div className="rounded-xl border border-border-color bg-surface p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-wider">
                            <Package size={15} />
                            <span>Stock Catalog</span>
                          </div>
                          <div className="pt-1 flex flex-col gap-1.5">
                            <Link
                              to="/stores"
                              className="flex items-center justify-between rounded-lg bg-emerald-600 p-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition"
                            >
                              <span>Stores & Inventory Management</span>
                              <Package size={13} />
                            </Link>
                            <Link
                              to="/maintenance/inventory"
                              className="flex items-center justify-between rounded-lg border border-blue-500/20 bg-blue-500/10 p-2 text-xs font-semibold text-blue-600 hover:bg-blue-500/20 transition"
                            >
                              <span>Inventory & Stock (Maintenance Hub)</span>
                              <ArrowUpRight size={13} />
                            </Link>
                          </div>
                        </div>

                        <div className="rounded-xl border border-border-color bg-surface p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-wider">
                            <Activity size={15} />
                            <span>Stock Movements</span>
                          </div>
                          <div className="pt-1 flex flex-col gap-1.5">
                            <Link
                              to="/stores"
                              className="flex items-center justify-between rounded-lg bg-surface-elevated p-2 text-xs font-semibold text-foreground hover:bg-surface transition"
                            >
                              <span>Receive Delivered Goods</span>
                              <ArrowDownRight size={13} />
                            </Link>
                            <Link
                              to="/stores"
                              className="flex items-center justify-between rounded-lg bg-surface-elevated p-2 text-xs font-semibold text-foreground hover:bg-surface transition"
                            >
                              <span>Issue Stock to Department</span>
                              <ArrowUpRight size={13} />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 5. FINANCE & ACCOUNTS TOGGLER */}
                <div className="rounded-2xl border border-border-color bg-surface shadow-sm overflow-hidden transition">
                  <button
                    type="button"
                    onClick={() => toggleDept("finance")}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-surface-elevated/40 transition"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/10 text-emerald-600 shrink-0">
                        <DollarSign size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-foreground">Finance & Accounts</h4>
                          <span className="rounded-full bg-emerald-500/10 text-emerald-600 px-2 py-0.5 text-[10px] font-bold">
                            {formatCurrency(stats.totalMonthlyIncome)} Revenue
                          </span>
                        </div>
                        <p className="text-xs text-muted">Rent revenue, invoice billing, financial accounts & purchase fund approvals</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted font-medium hidden sm:inline">
                        {expandedDepts.finance ? "Collapse" : "Expand Functions"}
                      </span>
                      {expandedDepts.finance ? (
                        <ChevronUp size={18} className="text-muted" />
                      ) : (
                        <ChevronDown size={18} className="text-muted" />
                      )}
                    </div>
                  </button>

                  {expandedDepts.finance && (
                    <div className="p-5 pt-0 border-t border-border-color/60 space-y-4 bg-muted/5">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3">
                        <div className="rounded-xl border border-border-color bg-surface p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-wider">
                            <TrendingUp size={15} />
                            <span>Revenue & Billing</span>
                          </div>
                          <div className="pt-1 flex flex-col gap-1.5">
                            <Link
                              to="/rent-collection"
                              className="flex items-center justify-between rounded-lg bg-surface-elevated p-2 text-xs font-semibold text-foreground hover:bg-surface transition"
                            >
                              <span>Rent & Revenue Collection</span>
                              <ArrowUpRight size={13} />
                            </Link>
                            <Link
                              to="/finance/invoices"
                              className="flex items-center justify-between rounded-lg bg-surface-elevated p-2 text-xs font-semibold text-foreground hover:bg-surface transition"
                            >
                              <span>Invoices Management</span>
                              <ArrowUpRight size={13} />
                            </Link>
                          </div>
                        </div>

                        <div className="rounded-xl border border-border-color bg-surface p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-pink-600 font-bold text-xs uppercase tracking-wider">
                            <DollarSign size={15} />
                            <span>Purchase Approvals</span>
                          </div>
                          <div className="pt-1 flex flex-col gap-1.5">
                            <Link
                              to="/procurement"
                              className="flex items-center justify-between rounded-lg bg-pink-600 p-2 text-xs font-semibold text-white shadow-sm hover:bg-pink-700 transition"
                            >
                              <span>Approve Procurement Funds</span>
                              <CheckCircle2 size={13} />
                            </Link>
                          </div>
                        </div>

                        <div className="rounded-xl border border-border-color bg-surface p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-wider">
                            <Layers size={15} />
                            <span>Statements & Reports</span>
                          </div>
                          <div className="pt-1 flex flex-col gap-1.5">
                            <Link
                              to="/finance/accounts"
                              className="flex items-center justify-between rounded-lg bg-surface-elevated p-2 text-xs font-semibold text-foreground hover:bg-surface transition"
                            >
                              <span>Financial Accounts</span>
                              <ArrowUpRight size={13} />
                            </Link>
                            <Link
                              to="/finance/reports"
                              className="flex items-center justify-between rounded-lg bg-surface-elevated p-2 text-xs font-semibold text-foreground hover:bg-surface transition"
                            >
                              <span>Financial Reports</span>
                              <ArrowUpRight size={13} />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 6. OPERATIONS & MAINTENANCE TOGGLER */}
                <div className="rounded-2xl border border-border-color bg-surface shadow-sm overflow-hidden transition">
                  <button
                    type="button"
                    onClick={() => toggleDept("maintenance")}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-surface-elevated/40 transition"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600/10 text-amber-600 shrink-0">
                        <Wrench size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-foreground">Operations & Maintenance</h4>
                          <span className="rounded-full bg-amber-500/10 text-amber-600 px-2 py-0.5 text-[10px] font-bold">
                            {stats.pendingMaintenance} Open Work Orders
                          </span>
                        </div>
                        <p className="text-xs text-muted">Repairs queue, scheduled tasks, routine inspections & service providers</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted font-medium hidden sm:inline">
                        {expandedDepts.maintenance ? "Collapse" : "Expand Functions"}
                      </span>
                      {expandedDepts.maintenance ? (
                        <ChevronUp size={18} className="text-muted" />
                      ) : (
                        <ChevronDown size={18} className="text-muted" />
                      )}
                    </div>
                  </button>

                  {expandedDepts.maintenance && (
                    <div className="p-5 pt-0 border-t border-border-color/60 space-y-4 bg-muted/5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
                        <div className="rounded-xl border border-border-color bg-surface p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-amber-600 font-bold text-xs uppercase tracking-wider">
                            <Wrench size={15} />
                            <span>Repairs & Work Orders</span>
                          </div>
                          <div className="pt-1 flex flex-col gap-1.5">
                            <Link
                              to="/maintenance/work-orders"
                              className="flex items-center justify-between rounded-lg bg-amber-600 p-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 transition"
                            >
                              <span>Work Orders Queue</span>
                              <ArrowUpRight size={13} />
                            </Link>
                            <Link
                              to="/maintenance/inventory"
                              className="flex items-center justify-between rounded-lg bg-surface-elevated p-2 text-xs font-semibold text-foreground hover:bg-surface transition"
                            >
                              <span>Maintenance Inventory & Parts</span>
                              <ArrowUpRight size={13} />
                            </Link>
                          </div>
                        </div>

                        <div className="rounded-xl border border-border-color bg-surface p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-wider">
                            <Calendar size={15} />
                            <span>Preventive Care</span>
                          </div>
                          <div className="pt-1 flex flex-col gap-1.5">
                            <Link
                              to="/maintenance/scheduled-tasks"
                              className="flex items-center justify-between rounded-lg bg-surface-elevated p-2 text-xs font-semibold text-foreground hover:bg-surface transition"
                            >
                              <span>Scheduled Tasks</span>
                              <ArrowUpRight size={13} />
                            </Link>
                            <Link
                              to="/maintenance/providers"
                              className="flex items-center justify-between rounded-lg bg-surface-elevated p-2 text-xs font-semibold text-foreground hover:bg-surface transition"
                            >
                              <span>Service Providers Network</span>
                              <ArrowUpRight size={13} />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 7. HUMAN RESOURCES & PAYROLL TOGGLER */}
                <div className="rounded-2xl border border-border-color bg-surface shadow-sm overflow-hidden transition">
                  <button
                    type="button"
                    onClick={() => toggleDept("hr")}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-surface-elevated/40 transition"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 shrink-0">
                        <Briefcase size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-foreground">Human Resources & Payroll</h4>
                          <span className="rounded-full bg-blue-600/10 text-blue-600 px-2 py-0.5 text-[10px] font-bold">
                            {companyUsers.length || 6} Staff Active
                          </span>
                        </div>
                        <p className="text-xs text-muted">Staff directory, contract countdowns, mass payroll generator & leave records</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted font-medium hidden sm:inline">
                        {expandedDepts.hr ? "Collapse" : "Expand Functions"}
                      </span>
                      {expandedDepts.hr ? (
                        <ChevronUp size={18} className="text-muted" />
                      ) : (
                        <ChevronDown size={18} className="text-muted" />
                      )}
                    </div>
                  </button>

                  {expandedDepts.hr && (
                    <div className="p-5 pt-0 border-t border-border-color/60 space-y-4 bg-muted/5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
                        <div className="rounded-xl border border-border-color bg-surface p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-wider">
                            <Users size={15} />
                            <span>Staff Management</span>
                          </div>
                          <div className="pt-1 flex flex-col gap-1.5">
                            <Link
                              to="/hr"
                              className="flex items-center justify-between rounded-lg bg-blue-600 p-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
                            >
                              <span>Employee Directory & Contracts</span>
                              <ArrowUpRight size={13} />
                            </Link>
                            <Link
                              to="/organogram"
                              className="flex items-center justify-between rounded-lg bg-surface-elevated p-2 text-xs font-semibold text-foreground hover:bg-surface transition"
                            >
                              <span>Organogram Hierarchy</span>
                              <ArrowUpRight size={13} />
                            </Link>
                          </div>
                        </div>

                        <div className="rounded-xl border border-border-color bg-surface p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-wider">
                            <DollarSign size={15} />
                            <span>Payroll & Compensation</span>
                          </div>
                          <div className="pt-1 flex flex-col gap-1.5">
                            <Link
                              to="/hr"
                              className="flex items-center justify-between rounded-lg bg-surface-elevated p-2 text-xs font-semibold text-foreground hover:bg-surface transition"
                            >
                              <span>Mass Payroll Generator</span>
                              <ArrowUpRight size={13} />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 8. CUSTOMER PORTAL & ENQUIRIES TOGGLER */}
                <div className="rounded-2xl border border-border-color bg-surface shadow-sm overflow-hidden transition">
                  <button
                    type="button"
                    onClick={() => toggleDept("portal")}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-surface-elevated/40 transition"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 shrink-0">
                        <Inbox size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-foreground">Customer Portal & Enquiries</h4>
                          <span className="rounded-full bg-blue-500/10 text-blue-600 px-2 py-0.5 text-[10px] font-bold">
                            Live Guest Inquiries
                          </span>
                        </div>
                        <p className="text-xs text-muted">Customer enquiries inbox, property showcase galleries, public portal & agent portal</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted font-medium hidden sm:inline">
                        {expandedDepts.portal ? "Collapse" : "Expand Functions"}
                      </span>
                      {expandedDepts.portal ? (
                        <ChevronUp size={18} className="text-muted" />
                      ) : (
                        <ChevronDown size={18} className="text-muted" />
                      )}
                    </div>
                  </button>

                  {expandedDepts.portal && (
                    <div className="p-5 pt-0 border-t border-border-color/60 space-y-4 bg-muted/5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
                        <div className="rounded-xl border border-border-color bg-surface p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-wider">
                            <Inbox size={15} />
                            <span>Enquiry Management</span>
                          </div>
                          <div className="pt-1 flex flex-col gap-1.5">
                            <Link
                              to="/enquiries"
                              className="flex items-center justify-between rounded-lg bg-blue-600 p-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition"
                            >
                              <span>Customer Enquiries & Tickets</span>
                              <ArrowUpRight size={13} />
                            </Link>
                          </div>
                        </div>

                        <div className="rounded-xl border border-border-color bg-surface p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-purple-600 font-bold text-xs uppercase tracking-wider">
                            <Globe size={15} />
                            <span>Portals & Showcase</span>
                          </div>
                          <div className="pt-1 flex flex-col gap-1.5">
                            <Link
                              to="/room-showcases"
                              className="flex items-center justify-between rounded-lg bg-surface-elevated p-2 text-xs font-semibold text-foreground hover:bg-surface transition"
                            >
                              <span>Room Showcases</span>
                              <ArrowUpRight size={13} />
                            </Link>
                            <Link
                              to="/portal"
                              target="_blank"
                              className="flex items-center justify-between rounded-lg bg-surface-elevated p-2 text-xs font-semibold text-foreground hover:bg-surface transition"
                            >
                              <span>Open Public Portal ↗</span>
                              <ArrowUpRight size={13} />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 9. AUDIT & COMPLIANCE TOGGLER */}
                <div className="rounded-2xl border border-border-color bg-surface shadow-sm overflow-hidden transition">
                  <button
                    type="button"
                    onClick={() => toggleDept("audit")}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-surface-elevated/40 transition"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600/10 text-amber-600 shrink-0">
                        <History size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-foreground">Audit & Compliance Department</h4>
                          <span className="rounded-full bg-amber-500/10 text-amber-600 px-2 py-0.5 text-[10px] font-bold">
                            {auditEvents.length || 24} Audit Events
                          </span>
                        </div>
                        <p className="text-xs text-muted">Administrative audit logs, security checks, and financial reconciliation history</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted font-medium hidden sm:inline">
                        {expandedDepts.audit ? "Collapse" : "Expand Functions"}
                      </span>
                      {expandedDepts.audit ? (
                        <ChevronUp size={18} className="text-muted" />
                      ) : (
                        <ChevronDown size={18} className="text-muted" />
                      )}
                    </div>
                  </button>

                  {expandedDepts.audit && (
                    <div className="p-5 pt-0 border-t border-border-color/60 space-y-4 bg-muted/5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3">
                        <div className="rounded-xl border border-border-color bg-surface p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-amber-600 font-bold text-xs uppercase tracking-wider">
                            <History size={15} />
                            <span>System Logs</span>
                          </div>
                          <div className="pt-1 flex flex-col gap-1.5">
                            <Link
                              to="/audit-trail"
                              className="flex items-center justify-between rounded-lg bg-amber-600 p-2 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 transition"
                            >
                              <span>Audit Trail Inspector</span>
                              <ArrowUpRight size={13} />
                            </Link>
                          </div>
                        </div>

                        <div className="rounded-xl border border-border-color bg-surface p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase tracking-wider">
                            <ShieldCheck size={15} />
                            <span>Role Rights Compliance</span>
                          </div>
                          <div className="pt-1 flex flex-col gap-1.5">
                            <Link
                              to="/organogram"
                              className="flex items-center justify-between rounded-lg bg-surface-elevated p-2 text-xs font-semibold text-foreground hover:bg-surface transition"
                            >
                              <span>Role Capability Matrix</span>
                              <ArrowUpRight size={13} />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* 10. EXECUTIVE GOVERNANCE TOGGLER */}
                <div className="rounded-2xl border border-indigo-500/20 bg-surface shadow-sm overflow-hidden transition">
                  <button
                    type="button"
                    onClick={() => toggleDept("governance")}
                    className="w-full flex items-center justify-between p-5 text-left hover:bg-surface-elevated/40 transition"
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600/10 text-indigo-600 shrink-0">
                        <Network size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-foreground">Executive Governance & Organogram</h4>
                          <span className="rounded-full bg-indigo-500/10 text-indigo-600 px-2 py-0.5 text-[10px] font-bold">
                            Corporate Structure
                          </span>
                        </div>
                        <p className="text-xs text-muted">Role definitions, organogram reporting hierarchy & multi-organization management</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted font-medium hidden sm:inline">
                        {expandedDepts.governance ? "Collapse" : "Expand Functions"}
                      </span>
                      {expandedDepts.governance ? (
                        <ChevronUp size={18} className="text-muted" />
                      ) : (
                        <ChevronDown size={18} className="text-muted" />
                      )}
                    </div>
                  </button>

                  {expandedDepts.governance && (
                    <div className="p-5 pt-0 border-t border-border-color/60 space-y-4 bg-muted/5">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3">
                        <div className="rounded-xl border border-border-color bg-surface p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs uppercase tracking-wider">
                            <Network size={15} />
                            <span>Organogram</span>
                          </div>
                          <div className="pt-1 flex flex-col gap-1.5">
                            <Link
                              to="/organogram"
                              className="flex items-center justify-between rounded-lg bg-indigo-600 p-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 transition"
                            >
                              <span>Organogram Hierarchy Tree</span>
                              <ArrowUpRight size={13} />
                            </Link>
                          </div>
                        </div>

                        <div className="rounded-xl border border-border-color bg-surface p-4 space-y-2.5">
                          <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-wider">
                            <FileSignature size={15} />
                            <span>Contracts</span>
                          </div>
                          <div className="pt-1 flex flex-col gap-1.5">
                            <Link
                              to="/contracts"
                              className="flex items-center justify-between rounded-lg bg-surface-elevated p-2 text-xs font-semibold text-foreground hover:bg-surface transition"
                            >
                              <span>Contracts & Leases</span>
                              <ArrowUpRight size={13} />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Charts & Occupancy Gauges */}
              <div className="grid gap-6 lg:grid-cols-3 pt-2">
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
            </>
          )}

          {/* ========================================================================= */}
          {/* IT DEPARTMENT DEDICATED VIEW                                             */}
          {/* ========================================================================= */}
          {!isExecutive && userDept === "it" && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-border-color bg-surface p-6 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-500/10 text-blue-600 rounded-xl">
                      <Server size={24} />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-foreground">IT & System Administration</h2>
                      <p className="text-xs text-muted">
                        Staff account credentials, user rights, role hierarchy, and organization security.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      to="/it"
                      className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
                    >
                      <Sliders size={16} />
                      <span>Administration Hub</span>
                    </Link>
                    <Link
                      to="/users-management"
                      className="flex items-center gap-2 rounded-xl border border-border-color bg-surface-elevated px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-surface transition"
                    >
                      <UserCog size={16} />
                      <span>User Rights</span>
                    </Link>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                  label="System Status"
                  value="Operational"
                  detail="All platform services active"
                  icon={Server}
                  colorClass="text-emerald-600"
                />
                <StatCard
                  label="Configured Users"
                  value={String(companyUsers.length || 6)}
                  detail="Staff Accounts Active"
                  icon={Users}
                  colorClass="text-blue-600"
                />
                <StatCard
                  label="Audit Logs"
                  value={String(auditEvents.length || 24)}
                  detail="Administrative records"
                  icon={History}
                  colorClass="text-amber-600"
                />
              </div>
            </div>
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
                  value={formatCurrency(storesMetrics.totalValue)}
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
          {/* PROPERTY CHECK-IN & LIVE GUEST ACTIVITY ACCORDION                         */}
          {/* ========================================================================= */}
          <section className="rounded-2xl border border-border-color bg-surface shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-4 p-5 border-b border-border-color bg-surface-elevated/30">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600/10 text-purple-600">
                  <BedDouble size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-foreground">
                      Property Check-In &amp; Guest Roster
                    </h3>
                    <span className="rounded-full bg-purple-500/10 px-2.5 py-0.5 text-[10px] font-bold text-purple-600 border border-purple-500/20 uppercase tracking-wider">
                      Live Operations
                    </span>
                  </div>
                  <p className="text-xs text-muted mt-0.5">
                    Expand any accommodation property below to inspect active guests, meal packages, stay dates, and collected payments.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCheckinOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
                >
                  <KeyRound size={14} />
                  <span>Check In Guest</span>
                </button>
                <Link
                  to="/commercial-bookings"
                  className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface-elevated px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface transition"
                >
                  <span>All Bookings</span>
                  <ExternalLink size={13} />
                </Link>
              </div>
            </div>

            {accommodationProperties.length === 0 ? (
              <div className="p-8 text-center">
                <EmptyState
                  title="No Accommodation Properties Found"
                  description="Add a Hotel, Lodge, Motel, or Guest House under Properties to view live guest check-in data."
                />
              </div>
            ) : (
              <div className="divide-y divide-border-color/60">
                {accommodationProperties.map((prop) => {
                  const propBookings = allCommercialBookings.filter((b) => b.propertyId === prop.id);
                  const activeGuests = propBookings.filter(
                    (b) => b.bookingStatus === "checked_in" || b.bookingStatus === "confirmed"
                  );
                  const isExpanded = Boolean(expandedPropertyIds[prop.id]);
                  const totalCollected = propBookings.reduce(
                    (sum, b) => sum + (b.amountPaid || b.totalAmount || 0),
                    0
                  );

                  return (
                    <div key={prop.id} className="transition">
                      {/* Property Header Bar / Accordion Trigger */}
                      <button
                        type="button"
                        onClick={() => togglePropertyAccordion(prop.id)}
                        className="w-full flex flex-wrap items-center justify-between gap-4 p-4 text-left hover:bg-surface-elevated/40 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-600/10 text-purple-600 shrink-0 font-black text-xs">
                            <BedDouble size={18} />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-foreground text-sm truncate">
                                {prop.name}
                              </p>
                              <span className="rounded-full bg-surface-elevated border border-border-color px-2 py-0.5 text-[10px] font-bold uppercase text-muted">
                                {prop.type.replace(/_/g, " ")}
                              </span>
                            </div>
                            <p className="text-xs text-muted flex items-center gap-1 mt-0.5">
                              <MapPin size={11} className="shrink-0" />
                              <span className="truncate">
                                {[prop.address, prop.city, prop.country].filter(Boolean).join(", ")}
                              </span>
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs">
                          <div className="text-right hidden sm:block">
                            <p className="font-bold text-foreground">
                              {activeGuests.length} Active / Checked In
                            </p>
                            <p className="text-[11px] text-muted">
                              {propBookings.length} Total Bookings Recorded
                            </p>
                          </div>

                          <div className="text-right hidden md:block">
                            <p className="font-bold text-emerald-600">
                              {formatCurrency(totalCollected)}
                            </p>
                            <p className="text-[11px] text-muted">Revenue Collected</p>
                          </div>

                          <div className="flex items-center gap-1.5 rounded-lg border border-border-color bg-surface-elevated px-2.5 py-1 text-xs font-semibold text-foreground">
                            <span>{isExpanded ? "Collapse" : "View Roster"}</span>
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </div>
                        </div>
                      </button>

                      {/* Expanded Guest Roster Content */}
                      {isExpanded && (
                        <div className="bg-muted/5 border-t border-border-color/60 p-4 space-y-3">
                          {propBookings.length === 0 ? (
                            <div className="p-6 text-center rounded-xl border border-dashed border-border-color bg-surface">
                              <p className="text-xs text-muted font-medium">
                                No guest bookings or check-ins recorded for {prop.name} yet.
                              </p>
                              <button
                                type="button"
                                onClick={() => setCheckinOpen(true)}
                                className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition"
                              >
                                <KeyRound size={12} />
                                <span>Check In First Guest</span>
                              </button>
                            </div>
                          ) : (
                            <div className="overflow-x-auto rounded-xl border border-border-color bg-surface shadow-xs">
                              <table className="w-full text-left text-xs">
                                <thead className="border-b border-border-color bg-surface-elevated/70 text-[10px] font-bold uppercase tracking-wider text-muted">
                                  <tr>
                                    <th className="px-4 py-3">Guest</th>
                                    <th className="px-4 py-3">Room</th>
                                    <th className="px-4 py-3">Board Package</th>
                                    <th className="px-4 py-3">Dates &amp; Nights</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 text-right">Payment</th>
                                    <th className="px-4 py-3">Clerk / Notes</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border-color/40">
                                  {propBookings.map((b) => (
                                    <tr key={b.id} className="hover:bg-surface-elevated/30 transition">
                                      <td className="px-4 py-3 font-bold text-foreground">
                                        <div>{b.guestName}</div>
                                        <div className="text-[10px] text-muted font-normal">
                                          {b.guestPhone || b.guestEmail || "-"}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className="font-semibold text-foreground">
                                          {b.roomNumber}
                                        </span>
                                        <span className="block text-[10px] text-muted uppercase">
                                          {b.roomType}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 capitalize">
                                        <span className="inline-flex items-center gap-1 rounded-md bg-surface-elevated border border-border-color px-2 py-0.5 text-[10px] font-semibold text-foreground">
                                          <Utensils size={10} className="text-amber-500" />
                                          <span>{b.mealPlan ? b.mealPlan.replace(/_/g, " ") : "Room Only"}</span>
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-muted">
                                        <div>{b.checkInDate} → {b.checkOutDate}</div>
                                        <div className="text-[10px] font-semibold text-foreground">{b.nights} Night(s)</div>
                                      </td>
                                      <td className="px-4 py-3">
                                        <span
                                          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                            b.bookingStatus === "checked_in"
                                              ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                              : b.bookingStatus === "confirmed"
                                              ? "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                                              : b.bookingStatus === "checked_out"
                                              ? "bg-muted/20 text-muted"
                                              : "bg-rose-500/10 text-rose-600"
                                          }`}
                                        >
                                          {b.bookingStatus ? b.bookingStatus.replace(/_/g, " ") : "confirmed"}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3 text-right">
                                        <div className="font-bold text-foreground">
                                          {formatCurrency(b.amountPaid || b.totalAmount || 0)}
                                        </div>
                                        {b.amountPaid !== undefined && b.totalAmount !== undefined && b.amountPaid !== b.totalAmount && (
                                          <span className="text-[9px] font-bold text-rose-500 block">
                                            Diff: {formatCurrency(Math.abs(b.totalAmount - b.amountPaid))}
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-4 py-3 text-muted text-[11px] max-w-xs truncate">
                                        {b.checkedInByName && (
                                          <span className="font-semibold text-foreground">
                                            {b.checkedInByName}:{" "}
                                          </span>
                                        )}
                                        <span>{b.notes || "Standard check-in"}</span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>

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
