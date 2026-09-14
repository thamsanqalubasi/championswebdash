import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "./theme-toggle";
import { CheckinModal } from "./checkin-modal";
import { ALL_ROLE_CAPABILITIES, fetchReminderThreshold, saveReminderThreshold, fetchRolePermissions, saveRolePermissions } from "@/lib/data";
import {
  LayoutDashboard, Building2, Users, DollarSign, Wrench, ClipboardList,
  Truck, SearchCheck, CalendarClock, Package, FileSignature, Settings,
  History, Landmark, BedDouble, KeyRound, Briefcase, Layers, ChevronDown,
  Building, Inbox, Globe, UserCog, ChevronLeft, ChevronRight, Menu,
  ShieldCheck, Check, X, Network, Server, BarChart3, Megaphone,
  type LucideIcon,
} from "lucide-react";
import type { DepartmentType } from "@/lib/types";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  departments?: DepartmentType[];
  permissions?: string[];
  requiresSuperAdmin?: boolean;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const allNavSections: NavSection[] = [
  {
    title: "Hospitality & Core",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Statistics", href: "/statistics", icon: BarChart3, departments: ["admin","manager","it","accountant","audit"], permissions: ["view_dashboard", "manage_finance"] },
      { label: "Front Desk & Bookings", href: "/commercial-bookings", icon: KeyRound, departments: ["admin","front_desk","manager","audit"], permissions: ["checkin_guests", "manage_properties"] },
      { label: "Rooms & Pricing", href: "/room-management", icon: BedDouble, departments: ["admin","front_desk","manager","maintenance"], permissions: ["manage_properties"] },
      { label: "Properties & Lodges", href: "/properties", icon: Building2, departments: ["admin","manager","front_desk","maintenance"], permissions: ["manage_properties"] },
      { label: "Tenants & Leases", href: "/tenants", icon: Users, departments: ["admin","manager","accountant"], permissions: ["manage_properties", "manage_finance"] },
    ],
  },
  {
    title: "Operations & Maintenance",
    items: [
      { label: "Maintenance Hub", href: "/maintenance", icon: Wrench, departments: ["admin","maintenance","manager"], permissions: ["manage_maintenance"] },
      { label: "Work Orders", href: "/maintenance/work-orders", icon: ClipboardList, departments: ["admin","maintenance","manager"], permissions: ["manage_maintenance"] },
      { label: "Service Providers", href: "/maintenance/providers", icon: Truck, departments: ["admin","maintenance","manager","procurement"], permissions: ["manage_maintenance"] },
      { label: "Inspections", href: "/maintenance/inspections", icon: SearchCheck, departments: ["admin","maintenance","manager"], permissions: ["manage_maintenance"] },
      { label: "Scheduled Tasks", href: "/maintenance/scheduled-tasks", icon: CalendarClock, departments: ["admin","maintenance","manager"], permissions: ["manage_maintenance"] },
      { label: "Inventory & Stock", href: "/maintenance/inventory", icon: Package, departments: ["admin","maintenance","procurement","manager"], permissions: ["manage_maintenance"] },
    ],
  },
  {
    title: "Finance & Accounts",
    items: [
      { label: "Rent & Revenue", href: "/rent-collection", icon: DollarSign, departments: ["admin","accountant","manager"], permissions: ["manage_finance"] },
      { label: "Invoices", href: "/finance/invoices", icon: ClipboardList, departments: ["admin","accountant","manager","audit"], permissions: ["manage_finance"] },
      { label: "Bills & Schedules", href: "/finance/bills", icon: CalendarClock, departments: ["admin","accountant","manager"], permissions: ["manage_finance"] },
      { label: "Financial Accounts", href: "/finance/accounts", icon: Landmark, departments: ["admin","accountant","manager"], permissions: ["manage_finance"] },
      { label: "Financial Reports", href: "/finance/reports", icon: Layers, departments: ["admin","accountant","manager","audit"], permissions: ["manage_finance"] },
    ],
  },
  {
    title: "Human Resources",
    items: [
      { label: "HR & Payroll", href: "/hr", icon: Briefcase, departments: ["admin","human_resources","manager"], permissions: ["manage_hr"] },
    ],
  },
  {
    title: "Procurement & Stores",
    items: [
      { label: "Procurement Hub", href: "/procurement", icon: Truck, departments: ["admin","procurement","manager"], permissions: ["manage_procurement", "manage_maintenance"] },
      { label: "Stores & Inventory", href: "/stores", icon: Package, departments: ["admin","stores","procurement","manager","maintenance"], permissions: ["manage_procurement", "manage_maintenance"] },
      { label: "Inventory & Stock", href: "/maintenance/inventory", icon: ClipboardList, departments: ["admin","stores","procurement","manager","maintenance"], permissions: ["manage_procurement", "manage_maintenance"] },
    ],
  },
  {
    title: "Customer Portal",
    items: [
      { label: "Showcase", href: "/room-showcases", icon: BedDouble, departments: ["admin","manager","front_desk"] },
      { label: "Enquiries & Tickets", href: "/enquiries", icon: Inbox, departments: ["admin","manager","front_desk","accountant"] },
      { label: "Public Portal", href: "/portal", icon: Globe, departments: ["admin","manager","front_desk"] },
      { label: "Agent Mode", href: "/agent-mode", icon: Briefcase, departments: ["admin","manager","front_desk"] },
    ],
  },
  {
    title: "Marketing & Growth",
    items: [
      { label: "Marketing Hub", href: "/marketing", icon: Megaphone, departments: ["admin","manager","marketing"] },
    ],
  },
  {
    title: "IT, Administration & Audit",
    items: [
      { label: "IT & Systems Hub", href: "/it", icon: Server, departments: ["admin","it","manager"], permissions: ["manage_all_users"] },
      { label: "Users & Rights", href: "/users-management", icon: UserCog, departments: ["admin","it","manager"], permissions: ["manage_all_users", "manage_user_rights", "manage_hr"] },
      { label: "Organogram & Roles", href: "/organogram", icon: Network, departments: ["admin","it","manager"], permissions: ["manage_roles_organogram", "manage_all_users", "manage_hr"] },
      { label: "Contracts", href: "/contracts", icon: FileSignature, departments: ["admin","manager"], permissions: ["manage_properties", "manage_hr"] },
      { label: "Settings", href: "/settings", icon: Settings, departments: ["admin","it","manager"], permissions: ["manage_all_users"] },
      { label: "Audit Department", href: "/audit-trail", icon: History, departments: ["admin","audit","manager","it"], permissions: ["view_audit_trail", "manage_audit"] },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

function NavItemLink({ item, active, collapsed, onClick }: { item: NavItem; active: boolean; collapsed: boolean; onClick?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      title={collapsed ? item.label : undefined}
      className={`group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-200 ${
        active ? "bg-surface-elevated font-medium text-foreground" : "text-muted hover:bg-surface-elevated/50 hover:text-foreground"
      } ${collapsed ? "justify-center px-2" : ""}`}
    >
      <span className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-foreground transition-all duration-300 ease-out ${
        active ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-40"
      } ${collapsed ? "hidden" : ""}`}/>
      <div className={`flex items-center gap-3 transition-transform duration-200 ${active ? "translate-x-1" : "group-hover:translate-x-1"} ${collapsed ? "translate-x-0 group-hover:translate-x-0" : ""}`}>
        <Icon size={18} strokeWidth={active ? 2.5 : 2} className={`shrink-0 transition-all duration-200 ${active ? "text-foreground" : "text-muted group-hover:text-foreground"}`}/>
        {!collapsed && <span>{item.label}</span>}
      </div>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, signOut, currentCompany, companies, setCurrentCompany, currentCompanyUser, isSuperAdmin, isAdmin } = useAuth();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [seeRolesOpen, setSeeRolesOpen] = useState(false);
  const [selectedRoleDept, setSelectedRoleDept] = useState<string>("admin");
  const [rolePermissions, setRolePermissions] = useState<Record<string, boolean>>({});
  const [reminderThreshold, setReminderThreshold] = useState(24);
  const [savingPermissions, setSavingPermissions] = useState(false);

  useEffect(() => {
    if (isSuperAdmin && seeRolesOpen) {
      fetchRolePermissions(selectedRoleDept, currentCompany.id).then(setRolePermissions);
    }
  }, [isSuperAdmin, seeRolesOpen, selectedRoleDept, currentCompany.id]);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchReminderThreshold(currentCompany.id).then(setReminderThreshold);
    }
  }, [isSuperAdmin, currentCompany.id]);

  const handleSavePermissions = async () => {
    setSavingPermissions(true);
    await saveRolePermissions(selectedRoleDept, rolePermissions, currentCompany.id);
    setSavingPermissions(false);
  };

  const handleSaveThreshold = async (hours: number) => {
    setReminderThreshold(hours);
    await saveReminderThreshold(currentCompany.id, hours);
  };

  const userEmail = user?.email || currentCompanyUser.email;

  const onSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const filteredNavSections = allNavSections
    .map((section) => {
      const items = section.items.filter((item) => {
        if (item.requiresSuperAdmin && !isSuperAdmin) return false;
        if (isAdmin) return true;
        if (currentCompanyUser.roleLevel === "all_rights") return true;

        // Check if user's base department has access
        if (!item.departments || item.departments.includes(currentCompanyUser.department)) {
          return true;
        }

        // Check if user has explicit granular permissions granted
        if (item.permissions && currentCompanyUser.permissions) {
          const hasPerm = item.permissions.some(
            (p) => currentCompanyUser.permissions?.[p] === true || currentCompanyUser.permissions?.all === true
          );
          if (hasPerm) return true;
        }

        return false;
      });
      return { ...section, items };
    })
    .filter((section) => section.items.length > 0);

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:border focus:border-border-color focus:bg-surface focus:px-3 focus:py-2">
        Skip to main content
      </a>

      {/* ── Desktop Sidebar ── */}
      <aside className={`hidden lg:flex flex-col flex-shrink-0 border-r border-border-color bg-surface transition-all duration-300 ease-in-out ${sidebarCollapsed ? "w-16" : "w-72"}`}>
        {/* Sidebar Header: logo + collapse toggle */}
        <div className={`flex items-center border-b border-border-color px-3 py-3 ${sidebarCollapsed ? "justify-center" : "justify-between gap-2"}`}>
          {!sidebarCollapsed && (
            <div className="relative flex-1 min-w-0">
              <div className="flex w-full items-center justify-between gap-2 rounded-xl bg-surface-elevated/80 p-2.5 shadow-sm ring-1 ring-border-color/50 text-left">
                <div className="flex items-center gap-2 min-w-0">
                  {currentCompany.logoUrl ? (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border-color bg-surface-elevated p-0.5 shadow-sm">
                      <img src={currentCompany.logoUrl} alt={currentCompany.name} className="h-full w-full object-contain"/>
                    </div>
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white font-black text-xs">
                      {currentCompany.name ? currentCompany.name.charAt(0) : <Building2 size={16}/>}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400 truncate">{currentCompanyUser.jobTitle}</p>
                    <h1 className="truncate text-xs font-bold text-foreground">{currentCompany.name}</h1>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Collapsed: just avatar */}
          {sidebarCollapsed && (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white font-black text-xs">
              {currentCompany.logoUrl
                ? <img src={currentCompany.logoUrl} alt="" className="h-full w-full object-contain rounded-lg"/>
                : currentCompany.name?.charAt(0) || <Building2 size={14}/>}
            </div>
          )}

          {/* Collapse toggle button */}
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border-color bg-surface-elevated text-muted hover:bg-surface hover:text-foreground transition"
          >
            {sidebarCollapsed ? <ChevronRight size={14}/> : <ChevronLeft size={14}/>}
          </button>
        </div>

        {/* Scrollable Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-5" aria-label="Primary navigation">
          {filteredNavSections.map((section) => (
            <div key={section.title}>
              {!sidebarCollapsed && (
                <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted/40">{section.title}</p>
              )}
              {sidebarCollapsed && <div className="mb-1 border-t border-border-color/30"/>}
              <div className={`space-y-0.5 ${!sidebarCollapsed ? "ml-2 border-l border-border-color/20 pl-2" : ""}`}>
                {section.items.map((item) => (
                  <NavItemLink key={item.href} item={item} active={isActive(pathname, item.href)} collapsed={sidebarCollapsed}/>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* ── See Roles Panel (Super Admin Only) ── */}
        {isSuperAdmin && !sidebarCollapsed && (
          <div className="border-t border-border-color">
            <button
              type="button"
              onClick={() => setSeeRolesOpen(!seeRolesOpen)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-xs font-semibold text-muted hover:text-foreground transition"
            >
              <div className="flex items-center gap-2">
                <ShieldCheck size={14} className="text-violet-500"/>
                <span className="text-[11px] font-bold uppercase tracking-wider">See Roles</span>
              </div>
              <ChevronDown size={12} className={`transition-transform ${seeRolesOpen ? "rotate-180" : ""}`}/>
            </button>

            {seeRolesOpen && (
              <div className="max-h-[55vh] overflow-y-auto px-3 pb-3 space-y-3">
                {/* Reminder Threshold Setting */}
                <div className="rounded-xl border border-border-color bg-surface-elevated p-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">Reminder Threshold</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={168}
                      value={reminderThreshold}
                      onChange={(e) => handleSaveThreshold(Number(e.target.value))}
                      className="w-16 rounded-lg border border-border-color bg-surface px-2 py-1 text-xs text-center"
                    />
                    <span className="text-xs text-muted">hours before reminder activates</span>
                  </div>
                </div>

                {/* Department selector */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">View Role</p>
                  <div className="flex flex-wrap gap-1">
                    {(["admin","manager","accountant","front_desk","it","maintenance","human_resources","procurement","stores","audit"] as const).map((dept) => (
                      <button
                        key={dept}
                        type="button"
                        onClick={() => setSelectedRoleDept(dept)}
                        className={`rounded-lg px-2 py-0.5 text-[10px] font-medium transition ${
                          selectedRoleDept === dept ? "bg-violet-600 text-white" : "bg-surface border border-border-color text-muted hover:text-foreground"
                        }`}
                      >
                        {dept.replace(/_/g, " ")}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Capabilities by section */}
                {Array.from(new Set(ALL_ROLE_CAPABILITIES.map((c) => c.section))).map((section) => (
                  <div key={section}>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted/60 mb-1">{section}</p>
                    <div className="space-y-0.5">
                      {ALL_ROLE_CAPABILITIES.filter((c) => c.section === section).map((cap) => (
                        <label key={cap.slug} className="flex items-start gap-2 rounded-lg p-1.5 hover:bg-surface-elevated cursor-pointer" title={cap.description}>
                          <div
                            onClick={() => setRolePermissions((prev) => ({ ...prev, [cap.slug]: !prev[cap.slug] }))}
                            className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded cursor-pointer border transition ${
                              rolePermissions[cap.slug] ? "bg-violet-600 border-violet-600" : "border-border-color bg-surface"
                            }`}
                          >
                            {rolePermissions[cap.slug] && <Check size={9} className="text-white"/>}
                          </div>
                          <span className="text-[10px] leading-tight text-foreground">{cap.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleSavePermissions}
                  disabled={savingPermissions}
                  className="w-full rounded-xl bg-violet-600 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 transition disabled:opacity-60"
                >
                  {savingPermissions ? "Saving..." : "Save Permissions"}
                </button>

                <Link
                  to="/organogram"
                  className="flex items-center justify-center gap-1.5 w-full rounded-xl bg-surface-elevated border border-violet-500/30 py-1.5 text-[11px] font-semibold text-violet-400 hover:bg-violet-600/10 transition mt-1"
                >
                  <Network size={13} />
                  <span>Open Full Organogram & Roles ➔</span>
                </Link>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* ── Right Panel: Header + Scrollable Main ── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Top Header — fixed, does NOT scroll */}
        <header className="flex-shrink-0 z-20 border-b border-border-color bg-surface px-3 py-2.5 sm:px-4 sm:py-3 lg:px-6">
          <div className="flex items-center justify-between gap-2 sm:gap-3 flex-wrap lg:flex-nowrap">
            {/* Mobile menu button & Brand */}
            <div className="flex items-center gap-2 lg:hidden min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-color bg-surface-elevated text-muted hover:text-foreground transition"
                aria-label="Open mobile menu"
              >
                <Menu size={18}/>
              </button>
              <span className="text-xs font-bold truncate max-w-[130px] sm:max-w-[200px] text-foreground">{currentCompany.name}</span>
            </div>

            {/* Action buttons on mobile/tablet/desktop */}
            <div className="flex items-center gap-1.5 sm:gap-2 ml-auto lg:order-last">
              <button
                type="button"
                onClick={() => setCheckinOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-blue-600 bg-blue-600 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-blue-700 transition"
              >
                <KeyRound size={15}/><span>Check In</span>
              </button>
              <Link
                to="/rent-collection"
                className="hidden sm:flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-600 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white shadow-xs hover:bg-emerald-700 transition"
              >
                <DollarSign size={15}/><span>Collect Rent</span>
              </Link>
              <ThemeToggle variant="compact"/>
              <div className="hidden xl:block max-w-[160px] truncate px-1 py-1 text-xs font-medium text-muted" title={userEmail}>{userEmail}</div>
              <button
                type="button"
                onClick={onSignOut}
                className="rounded-lg border border-border-color bg-surface-elevated px-2.5 py-1.5 sm:py-2 text-xs font-medium text-muted hover:text-foreground transition"
              >
                Sign out
              </button>
            </div>

            {/* Global Search - wraps neatly below on mobile phones */}
            <div className="order-last lg:order-none w-full lg:w-auto lg:flex-1 min-w-0 mt-1 lg:mt-0">
              <input
                id="global-search"
                type="search"
                placeholder="Search rooms, bookings, guests, invoices, staff..."
                className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-1.5 sm:py-2 text-xs sm:text-sm outline-none focus:border-foreground transition"
              />
            </div>
          </div>
        </header>

        {/* Main content — scrolls independently, content centred */}
        <main id="main-content" className="flex-1 overflow-y-auto bg-background">
          <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-4 sm:py-6 lg:px-6">
            {children}
          </div>
        </main>
      </div>

      <CheckinModal isOpen={checkinOpen} onClose={() => setCheckinOpen(false)} onSuccess={() => {}}/>

      {/* ── Mobile Drawer ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)} className="absolute inset-0 bg-black/50 backdrop-blur-xs"/>
          <div className="absolute left-0 top-0 flex h-full w-[86%] max-w-sm flex-col border-r border-border-color bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-color px-4 py-3">
              <div className="flex items-center gap-2.5 min-w-0">
                {currentCompany.logoUrl ? (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border-color bg-surface-elevated p-0.5">
                    <img src={currentCompany.logoUrl} alt={currentCompany.name} className="h-full w-full object-contain"/>
                  </div>
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white font-black text-xs">
                    {currentCompany.name ? currentCompany.name.charAt(0) : <Building2 size={16}/>}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase text-blue-600">{currentCompanyUser.jobTitle}</p>
                  <h2 className="text-sm font-bold truncate">{currentCompany.name}</h2>
                </div>
              </div>
              <button type="button" onClick={() => setMobileMenuOpen(false)} className="rounded-md border border-border-color px-2.5 py-1 text-xs text-muted">Close</button>
            </div>

            {/* Quick Actions in Mobile Drawer */}
            <div className="p-3 border-b border-border-color/50 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { setMobileMenuOpen(false); setCheckinOpen(true); }}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 py-2 text-xs font-bold text-white shadow-xs"
              >
                <KeyRound size={14} /> Check In
              </button>
              <Link
                to="/rent-collection"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white shadow-xs"
              >
                <DollarSign size={14} /> Collect Rent
              </Link>
            </div>

            <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Mobile navigation">
              {filteredNavSections.map((section) => (
                <div key={section.title}>
                  <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-muted/40">{section.title}</p>
                  <div className="ml-2 space-y-0.5 border-l border-border-color/20 pl-2">
                    {section.items.map((item) => (
                      <NavItemLink key={item.href} item={item} active={isActive(pathname, item.href)} collapsed={false} onClick={() => setMobileMenuOpen(false)}/>
                    ))}
                  </div>
                </div>
              ))}
            </nav>

            <div className="p-3 border-t border-border-color space-y-2">
              <ThemeToggle variant="menu-item" />
              <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted">
                <span className="truncate max-w-[180px]" title={userEmail}>{userEmail}</span>
                <button type="button" onClick={onSignOut} className="text-red-500 font-semibold hover:underline">
                  Sign Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
