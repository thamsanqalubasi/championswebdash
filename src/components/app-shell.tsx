"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
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
  const pathname = usePathname();
  const [userEmail, setUserEmail] = useState<string>("Admin");

  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as {
          authenticated?: boolean;
          user?: { email?: string };
        };

        if (!cancelled && payload.authenticated && payload.user?.email) {
          setUserEmail(payload.user.email);
        }
      } catch {
        if (!cancelled) {
          setUserEmail("Admin");
        }
      }
    }

    void loadSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const onSignOut = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:border focus:border-border-color focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to main content
      </a>

      <aside className="hidden w-72 flex-col border-r border-border-color bg-surface p-4 lg:flex">
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
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`block rounded-md px-3 py-2 text-sm transition ${
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

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-border-color bg-surface/90 px-4 py-3 backdrop-blur lg:px-6">
          <div className="flex items-center gap-3">
            <label htmlFor="global-search" className="sr-only">
              Search module, tenant, property
            </label>
            <input
              id="global-search"
              type="search"
              placeholder="Search module, tenant, property..."
              className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-foreground"
            />
            <ThemeToggle />
            <div className="max-w-[220px] truncate rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm text-muted">
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
        </header>

        <main id="main-content" className="flex-1 bg-background p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
