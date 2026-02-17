import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, type ReactNode } from "react";
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
                          onClick={() => setMobileMenuOpen(false)}
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
          </div>
        </div>
      )}
    </div>
  );
}
