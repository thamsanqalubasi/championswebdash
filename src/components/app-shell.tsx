import { Link, useLocation, useNavigate } from "react-router-dom";
import { type ReactNode } from "react";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "./theme-toggle";

type NavItem = {
  label: string;
  href: string;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    title: "Core",
    items: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Properties", href: "/properties" },
      { label: "Tenants", href: "/tenants" },
      { label: "Finance", href: "/finance" },
    ],
  },
  {
    title: "Maintenance",
    items: [
      { label: "Overview", href: "/maintenance" },
      { label: "Work Orders", href: "/maintenance/work-orders" },
      { label: "Providers", href: "/maintenance/providers" },
      { label: "Inspections", href: "/maintenance/inspections" },
      { label: "Scheduled Tasks", href: "/maintenance/scheduled-tasks" },
      { label: "Inventory", href: "/maintenance/inventory" },
    ],
  },
  {
    title: "Admin",
    items: [
      { label: "Contracts", href: "/contracts" },
      { label: "Settings", href: "/settings" },
      { label: "Audit Trail", href: "/audit-trail" },
    ],
  },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

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
        <div className="mb-6 rounded-lg bg-surface-elevated p-4">
          <p className="text-sm text-muted">Champions Court</p>
          <h1 className="text-lg font-semibold">Desktop Dashboard</h1>
        </div>

        <nav className="space-y-6" aria-label="Primary navigation">
          {navSections.map((section) => (
            <div key={section.title}>
              <p className="mb-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted">
                {section.title}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`block rounded-md px-3 py-2 text-sm ${
                        active
                          ? "bg-surface-elevated font-medium"
                          : "text-muted hover:bg-surface-elevated hover:text-foreground"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border-color bg-surface px-4 py-3 lg:px-6" style={{ contain: "layout paint" }}>
          <div className="flex flex-wrap items-center gap-3">
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

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border-color bg-surface p-2 lg:hidden" aria-label="Mobile navigation" style={{ contain: "layout paint" }}>
        {[
          { label: "Home", href: "/dashboard" },
          { label: "Props", href: "/properties" },
          { label: "Tenants", href: "/tenants" },
          { label: "Maint", href: "/maintenance" },
          { label: "More", href: "/finance" },
        ].map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              to={item.href}
              aria-current={active ? "page" : undefined}
              className={`rounded-md px-2 py-2 text-center text-xs ${
                active
                  ? "bg-surface-elevated font-medium"
                  : "text-muted hover:bg-surface-elevated hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
