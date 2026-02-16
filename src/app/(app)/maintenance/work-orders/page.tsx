"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { fetchWorkOrdersData } from "@/lib/data";
import type { WorkOrderRow } from "@/lib/types";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function WorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchWorkOrdersData();
        if (!cancelled) {
          setWorkOrders(result);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load work orders.");
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

  const counts = useMemo(() => {
    return {
      all: workOrders.length,
      open: workOrders.filter((item) => item.status === "open").length,
      completed: workOrders.filter((item) => item.status === "completed").length,
      cancelled: workOrders.filter((item) => item.status === "cancelled").length,
    };
  }, [workOrders]);

  return (
    <ModulePage
      title="Work Orders"
      description="Ticket table, filters, and status transitions (start/complete/reopen/cancel)."
    >
      {loading && <LoadingState label="Loading work orders..." />}

      {!loading && error && (
        <ErrorState message={error} onRetry={() => setReloadKey((value) => value + 1)} />
      )}

      {!loading && !error && (
        <section className="space-y-4 rounded-lg border border-border-color bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm">
                All ({counts.all})
              </button>
              <button type="button" className="rounded-md border border-border-color px-3 py-2 text-sm text-muted">
                Open ({counts.open})
              </button>
              <button type="button" className="rounded-md border border-border-color px-3 py-2 text-sm text-muted">
                Completed ({counts.completed})
              </button>
              <button type="button" className="rounded-md border border-border-color px-3 py-2 text-sm text-muted">
                Cancelled ({counts.cancelled})
              </button>
            </div>
            <button type="button" className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium">
              Create Work Order
            </button>
          </div>

          {workOrders.length === 0 ? (
            <EmptyState
              title="No work orders found"
              description="Create a work order in mobile or backend first, then refresh this page."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border-color text-left text-muted">
                    <th className="px-3 py-2 font-medium">Property</th>
                    <th className="px-3 py-2 font-medium">Provider</th>
                    <th className="px-3 py-2 font-medium">Category</th>
                    <th className="px-3 py-2 font-medium">Priority</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Scheduled</th>
                    <th className="px-3 py-2 font-medium">Cost (Est/Actual)</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {workOrders.map((row) => (
                    <tr key={row.id} className="border-b border-border-color/60">
                      <td className="px-3 py-3 font-medium">{row.propertyName}</td>
                      <td className="px-3 py-3 text-muted">{row.providerName}</td>
                      <td className="px-3 py-3 text-muted">{row.category}</td>
                      <td className="px-3 py-3 text-muted capitalize">{row.priority}</td>
                      <td className="px-3 py-3">
                        <span className="rounded-full border border-border-color bg-surface-elevated px-2 py-1 text-xs text-muted capitalize">
                          {row.status.replaceAll("_", " ")}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-muted">{row.scheduledDate}</td>
                      <td className="px-3 py-3 text-muted">
                        {formatCurrency(row.estimatedCost)} / {formatCurrency(row.actualCost)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="rounded-md border border-border-color px-2 py-1 text-xs text-muted">
                            Start
                          </button>
                          <button type="button" className="rounded-md border border-border-color px-2 py-1 text-xs text-muted">
                            Complete
                          </button>
                          <button type="button" className="rounded-md border border-border-color px-2 py-1 text-xs text-muted">
                            Reopen
                          </button>
                          <button type="button" className="rounded-md border border-border-color px-2 py-1 text-xs text-muted">
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </ModulePage>
  );
}
