import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "./theme-toggle";
import {
  LayoutDashboard,
  Building2,
  Users,
  DollarSign,
  Wrench,
  ClipboardList,
  Truck,
  SearchCheck,
  CalendarClock,
  Package,
  FileSignature,
  Settings,
  History,
  Landmark,
  type LucideIcon,
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    title: "Core",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { label: "Properties", href: "/properties", icon: Building2 },
      { label: "Tenants", href: "/tenants", icon: Users },
      { label: "Finance", href: "/finance", icon: DollarSign },
    ],
  },
  {
    title: "Maintenance",
    items: [
      { label: "Overview", href: "/maintenance", icon: Wrench },
      { label: "Work Orders", href: "/maintenance/work-orders", icon: ClipboardList },
      { label: "Providers", href: "/maintenance/providers", icon: Truck },
      { label: "Inspections", href: "/maintenance/inspections", icon: SearchCheck },
      { label: "Scheduled Tasks", href: "/maintenance/scheduled-tasks", icon: CalendarClock },
      { label: "Inventory", href: "/maintenance/inventory", icon: Package },
    ],
  },
  {
    title: "Admin",
    items: [
      { label: "Contracts", href: "/contracts", icon: FileSignature },
      { label: "Settings", href: "/settings", icon: Settings },
      { label: "Audit Trail", href: "/audit-trail", icon: History },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
}

function NavItemLink({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      to={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-200 ${
        active
          ? "bg-surface-elevated font-medium text-foreground"
          : "text-muted hover:bg-surface-elevated/50 hover:text-foreground"
      }`}
    >
      {/* Slide-in indicator */}
      <span
        className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-foreground transition-all duration-300 ease-out ${
          active ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0 group-hover:translate-x-0 group-hover:opacity-40"
        }`}
      />
      <div className={`flex items-center gap-3 transition-transform duration-200 ${active ? "translate-x-1" : "group-hover:translate-x-1"}`}>
        <Icon
          size={18}
          strokeWidth={active ? 2.5 : 2}
          className={`transition-all duration-200 ${
            active ? "text-foreground" : "text-muted group-hover:text-foreground"
          }`}
        />
        <span>{item.label}</span>
      </div>
    </Link>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const userEmail = user?.email ?? "Admin";

  const onSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-screen bg-background pb-16 text-foreground lg:pb-0">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:border focus:border-border-color focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to main content
      </a>

      <aside className="hidden w-72 flex-col border-r border-border-color bg-surface p-4 lg:flex" style={{ contain: "layout paint" }}>
        <div className="mb-8 flex items-center gap-3 rounded-xl bg-surface-elevated/80 p-4 shadow-sm ring-1 ring-border-color/50">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-foreground text-surface shadow-md">
            <Landmark size={20} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted/60">Champions Court</p>
            <h1 className="text-sm font-bold tracking-tight text-foreground">Dashboard</h1>
          </div>
        </div>

        <nav className="space-y-6" aria-label="Primary navigation">
              {navSections.map((section) => (
                <div key={section.title}>
                  <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.15em] text-muted/40">
                    {section.title}
                  </p>
                  <div className="ml-2 space-y-1 border-l border-border-color/20 pl-2">
                {section.items.map((item) => (
                  <NavItemLink
                    key={item.href}
                    item={item}
                    active={isActive(pathname, item.href)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border-color bg-surface px-4 py-3 lg:px-6" style={{ contain: "layout paint" }}>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm text-muted lg:hidden"
            >
              Menu
            </button>
            <label htmlFor="global-search" className="sr-only">
              Search module, tenant, property
            </label>
            <div className="w-full min-w-0 lg:flex-1">
              <input
                id="global-search"
                type="search"
                placeholder="Search module, tenant, property..."
                className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-foreground"
              />
            </div>
            <div className="flex w-full items-center gap-2 sm:w-auto">
              <Link
                to="/rent-collection"
                className="rounded-md border border-green-600 bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
              >
                Rent Collection
              </Link>
              <ThemeToggle />
              <div className="max-w-[220px] flex-1 truncate px-1 py-2 text-sm text-muted sm:flex-none" aria-label="Signed-in user">
                {userEmail}
              </div>
              <button
                type="button"
                onClick={onSignOut}
                className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm text-muted"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        <main id="main-content" className="flex-1 bg-background p-4 lg:p-6">
          {children}
        </main>
      </div>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileMenuOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute left-0 top-0 h-full w-[86%] max-w-sm overflow-y-auto border-r border-border-color bg-surface p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Navigation</h2>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md border border-border-color px-2 py-1 text-sm text-muted"
              >
                Close
              </button>
            </div>

            <nav className="space-y-6" aria-label="Mobile primary navigation">
              {navSections.map((section) => (
                <div key={section.title}>
                  <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.15em] text-muted/40">
                    {section.title}
                  </p>
                  <div className="ml-2 space-y-1 border-l border-border-color/20 pl-2">
                    {section.items.map((item) => (
                      <NavItemLink
                        key={item.href}
                        item={item}
                        active={isActive(pathname, item.href)}
                        onClick={() => setMobileMenuOpen(false)}
                      />
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
