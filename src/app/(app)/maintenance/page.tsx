"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { fetchMaintenanceOverviewData } from "@/lib/data";
import type { MaintenanceOverviewData } from "@/lib/types";

export default function MaintenancePage() {
  const [data, setData] = useState<MaintenanceOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchMaintenanceOverviewData();
        if (!cancelled) {
          setData(result);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load maintenance overview.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  return (
    <ModulePage
      title="Maintenance"
      description="Maintenance operations overview and quick stats for work orders, providers, inspections, scheduled tasks, and inventory."
    >
      {loading && <LoadingState label="Loading maintenance overview..." />}

      {!loading && error && (
        <ErrorState message={error} onRetry={() => setReloadKey((value) => value + 1)} />
      )}

      {!loading && !error && data && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-lg border border-border-color bg-surface p-4">
              <p className="text-sm text-muted">Work Orders</p>
              <p className="mt-2 text-2xl font-semibold">{data.totalWorkOrders}</p>
              <p className="mt-1 text-sm text-muted">{data.openWorkOrders} open / in progress</p>
            </article>
            <article className="rounded-lg border border-border-color bg-surface p-4">
              <p className="text-sm text-muted">Providers</p>
              <p className="mt-2 text-2xl font-semibold">{data.totalProviders}</p>
              <p className="mt-1 text-sm text-muted">Active service providers</p>
            </article>
            <article className="rounded-lg border border-border-color bg-surface p-4">
              <p className="text-sm text-muted">Inspections Scheduled</p>
              <p className="mt-2 text-2xl font-semibold">{data.scheduledInspections}</p>
              <p className="mt-1 text-sm text-muted">Pending inspections</p>
            </article>
            <article className="rounded-lg border border-border-color bg-surface p-4">
              <p className="text-sm text-muted">Risk Alerts</p>
              <p className="mt-2 text-2xl font-semibold">
                {data.overduePreventiveTasks + data.lowStockItems}
              </p>
              <p className="mt-1 text-sm text-muted">
                {data.overduePreventiveTasks} overdue tasks, {data.lowStockItems} low stock
              </p>
            </article>
          </div>

          <section className="rounded-lg border border-border-color bg-surface p-4">
            <h3 className="mb-4 text-base font-semibold">Quick Links</h3>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <Link
                href="/maintenance/work-orders"
                className="rounded-md border border-border-color bg-surface-elevated px-3 py-3 text-sm"
              >
                Work Orders
              </Link>
              <Link
                href="/maintenance/providers"
                className="rounded-md border border-border-color bg-surface-elevated px-3 py-3 text-sm"
              >
                Providers
              </Link>
              <Link
                href="/maintenance/inspections"
                className="rounded-md border border-border-color bg-surface-elevated px-3 py-3 text-sm"
              >
                Inspections
              </Link>
              <Link
                href="/maintenance/scheduled-tasks"
                className="rounded-md border border-border-color bg-surface-elevated px-3 py-3 text-sm"
              >
                Scheduled Tasks
              </Link>
              <Link
                href="/maintenance/inventory"
                className="rounded-md border border-border-color bg-surface-elevated px-3 py-3 text-sm"
              >
                Inventory
              </Link>
            </div>
          </section>
        </>
      )}
    </ModulePage>
  );
}
