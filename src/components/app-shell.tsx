import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "./theme-toggle";
import { CheckinModal } from "./checkin-modal";
import {
  LayoutDashboard, Building2, Users, DollarSign, Wrench, ClipboardList,
  Truck, SearchCheck, CalendarClock, Package, FileSignature, Settings,
  History, Landmark, BedDouble, KeyRound, Briefcase, Layers, ChevronDown,
  Building, Inbox, Globe, UserCog, ChevronLeft, ChevronRight, Menu,
  type LucideIcon,
} from "lucide-react";
import type { DepartmentType } from "@/lib/types";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  departments?: DepartmentType[];
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
      { label: "Front Desk & Bookings", href: "/commercial-bookings", icon: KeyRound, departments: ["admin","front_desk","manager","audit"] },
      { label: "Rooms & Pricing", href: "/room-management", icon: BedDouble, departments: ["admin","front_desk","manager","maintenance"] },
      { label: "Properties & Lodges", href: "/properties", icon: Building2 },
      { label: "Tenants & Leases", href: "/tenants", icon: Users, departments: ["admin","manager","accountant"] },
    ],
  },
  {
    title: "Operations & Maintenance",
    items: [
      { label: "Maintenance Hub", href: "/maintenance", icon: Wrench, departments: ["admin","maintenance","manager"] },
      { label: "Work Orders", href: "/maintenance/work-orders", icon: ClipboardList, departments: ["admin","maintenance","manager"] },
      { label: "Service Providers", href: "/maintenance/providers", icon: Truck, departments: ["admin","maintenance","manager","procurement"] },
      { label: "Inspections", href: "/maintenance/inspections", icon: SearchCheck, departments: ["admin","maintenance","manager"] },
      { label: "Scheduled Tasks", href: "/maintenance/scheduled-tasks", icon: CalendarClock, departments: ["admin","maintenance","manager"] },
      { label: "Inventory & Stock", href: "/maintenance/inventory", icon: Package, departments: ["admin","maintenance","procurement","manager"] },
    ],
  },
  {
    title: "Finance & Accounts",
    items: [
      { label: "Rent & Revenue", href: "/rent-collection", icon: DollarSign, departments: ["admin","accountant","manager"] },
      { label: "Invoices", href: "/finance/invoices", icon: ClipboardList, departments: ["admin","accountant","manager","audit"] },
      { label: "Bills & Schedules", href: "/finance/bills", icon: CalendarClock, departments: ["admin","accountant","manager"] },
      { label: "Financial Accounts", href: "/finance/accounts", icon: Landmark, departments: ["admin","accountant","manager"] },
      { label: "Financial Reports", href: "/finance/reports", icon: Layers, departments: ["admin","accountant","manager","audit"] },
    ],
  },
  {
    title: "Human Resources",
    items: [
      { label: "HR & Payroll", href: "/hr", icon: Briefcase, departments: ["admin","human_resources","manager"] },
    ],
  },
  {
    title: "Customer Portal",
    items: [
      { label: "Showcase", href: "/room-showcases", icon: BedDouble, departments: ["admin","manager","front_desk"] },
      { label: "Enquiries & Tickets", href: "/enquiries", icon: Inbox, departments: ["admin","manager","front_desk","accountant"] },
      { label: "Public Portal", href: "/portal", icon: Globe },
      { label: "Agent Portal", href: "/portal/agent", icon: Briefcase },
    ],
  },
  {
    title: "Administration & Audit",
    items: [
      { label: "Companies / Orgs", href: "/companies", icon: Building, requiresSuperAdmin: true },
      { label: "Users & Rights", href: "/users-management", icon: UserCog, departments: ["admin","manager","it"] },
      { label: "Contracts", href: "/contracts", icon: FileSignature, departments: ["admin","manager"] },
      { label: "Settings", href: "/settings", icon: Settings },
      { label: "Audit Department", href: "/audit-trail", icon: History, departments: ["admin","audit","manager"] },
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
  const [companyDropdownOpen, setCompanyDropdownOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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
        if (!item.departments) return true;
        return item.departments.includes(currentCompanyUser.department);
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
              <button
                type="button"
                onClick={() => isSuperAdmin && setCompanyDropdownOpen(!companyDropdownOpen)}
                className="flex w-full items-center justify-between gap-2 rounded-xl bg-surface-elevated/80 p-2.5 shadow-sm ring-1 ring-border-color/50 text-left transition hover:bg-surface-elevated"
              >
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
                {isSuperAdmin && <ChevronDown size={14} className="text-muted shrink-0"/>}
              </button>

              {/* Company Switcher Dropdown */}
              {companyDropdownOpen && isSuperAdmin && (
                <div className="absolute left-0 top-full z-30 mt-1 w-full rounded-xl border border-border-color bg-surface p-2 shadow-xl">
                  <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted">Switch Organisation</p>
                  {companies.map((c) => (
                    <button key={c.id} type="button" onClick={() => { setCurrentCompany(c); setCompanyDropdownOpen(false); }}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${c.id === currentCompany.id ? "bg-blue-600 text-white" : "text-foreground hover:bg-surface-elevated"}`}>
                      <Building size={12}/><span className="truncate">{c.name}</span>
                    </button>
                  ))}
                </div>
              )}
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
      </aside>

      {/* ── Right Panel: Header + Scrollable Main ── */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        {/* Top Header — fixed, does NOT scroll */}
        <header className="flex-shrink-0 z-20 border-b border-border-color bg-surface px-4 py-3 lg:px-6">
          <div className="flex flex-wrap items-center gap-3">
            {/* Mobile menu button */}
            <button type="button" onClick={() => setMobileMenuOpen(true)} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm text-muted lg:hidden">
              <Menu size={16}/>
            </button>

            <div className="w-full min-w-0 lg:flex-1">
              <input id="global-search" type="search" placeholder="Search rooms, bookings, guests, invoices, staff..."
                className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-foreground"/>
            </div>

            <div className="flex w-full items-center gap-2 sm:w-auto">
              <button type="button" onClick={() => setCheckinOpen(true)}
                className="flex items-center gap-1.5 rounded-md border border-blue-600 bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition">
                <KeyRound size={16}/><span>Check In</span>
              </button>
              <Link to="/rent-collection"
                className="flex items-center gap-1.5 rounded-md border border-emerald-600 bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 transition">
                <DollarSign size={16}/><span>Collect Rent</span>
              </Link>
              <ThemeToggle/>
              <div className="max-w-[180px] flex-1 truncate px-1 py-2 text-xs font-medium text-muted sm:flex-none" title={userEmail}>{userEmail}</div>
              <button type="button" onClick={onSignOut}
                className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-xs font-medium text-muted hover:text-foreground">
                Sign out
              </button>
            </div>
          </div>
        </header>

        {/* Main content — scrolls independently, content centred */}
        <main id="main-content" className="flex-1 overflow-y-auto bg-background">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 lg:px-6">
            {children}
          </div>
        </main>
      </div>

      <CheckinModal isOpen={checkinOpen} onClose={() => setCheckinOpen(false)} onSuccess={() => {}}/>

      {/* ── Mobile Drawer ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close menu" onClick={() => setMobileMenuOpen(false)} className="absolute inset-0 bg-black/50 backdrop-blur-xs"/>
          <div className="absolute left-0 top-0 flex h-full w-[86%] max-w-sm flex-col border-r border-border-color bg-surface">
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
          </div>
        </div>
      )}
    </div>
  );
}
