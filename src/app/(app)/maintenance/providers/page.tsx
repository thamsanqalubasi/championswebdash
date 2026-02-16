"use client";

import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { fetchProvidersData } from "@/lib/data";
import type { ProviderRow } from "@/lib/types";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ProvidersPage() {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchProvidersData();
        if (!cancelled) {
          setProviders(result);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load providers.");
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

  const totals = useMemo(() => {
    return {
      jobs: providers.reduce((sum, row) => sum + row.totalJobs, 0),
      paid: providers.reduce((sum, row) => sum + row.totalPaid, 0),
    };
  }, [providers]);

  return (
    <ModulePage
      title="Providers"
      description="Maintainer profiles, workload stats, and provider CRUD."
    >
      {loading && <LoadingState label="Loading providers..." />}

      {!loading && error && (
        <ErrorState message={error} onRetry={() => setReloadKey((value) => value + 1)} />
      )}

      {!loading && !error && (
        <section className="space-y-4 rounded-lg border border-border-color bg-surface p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <article className="rounded-md border border-border-color bg-surface-elevated p-3">
              <p className="text-xs text-muted">Providers</p>
              <p className="mt-1 text-xl font-semibold">{providers.length}</p>
            </article>
            <article className="rounded-md border border-border-color bg-surface-elevated p-3">
              <p className="text-xs text-muted">Total Jobs</p>
              <p className="mt-1 text-xl font-semibold">{totals.jobs}</p>
            </article>
            <article className="rounded-md border border-border-color bg-surface-elevated p-3">
              <p className="text-xs text-muted">Total Paid</p>
              <p className="mt-1 text-xl font-semibold">{formatCurrency(totals.paid)}</p>
            </article>
          </div>

          {providers.length === 0 ? (
            <EmptyState
              title="No providers found"
              description="Create providers in mobile or backend first, then refresh this page."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border-color text-left text-muted">
                    <th className="px-3 py-2 font-medium">Provider</th>
                    <th className="px-3 py-2 font-medium">Phone</th>
                    <th className="px-3 py-2 font-medium">Specialization</th>
                    <th className="px-3 py-2 font-medium">Rate</th>
                    <th className="px-3 py-2 font-medium">Jobs</th>
                    <th className="px-3 py-2 font-medium">Paid</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {providers.map((row) => (
                    <tr key={row.id} className="border-b border-border-color/60">
                      <td className="px-3 py-3 font-medium">{row.name}</td>
                      <td className="px-3 py-3 text-muted">{row.phone}</td>
                      <td className="px-3 py-3 text-muted">{row.specialization}</td>
                      <td className="px-3 py-3 text-muted">{formatCurrency(row.rate)}</td>
                      <td className="px-3 py-3 text-muted">{row.totalJobs}</td>
                      <td className="px-3 py-3 text-muted">{formatCurrency(row.totalPaid)}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="rounded-md border border-border-color px-2 py-1 text-xs text-muted">
                            Edit
                          </button>
                          <button type="button" className="rounded-md border border-border-color px-2 py-1 text-xs text-muted">
                            Delete
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
