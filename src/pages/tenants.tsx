import { useEffect, useMemo, useState } from "react";
import { ModulePage } from "@/components/module-page";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { fetchTenantsData } from "@/lib/data";
import type { TenantRow } from "@/lib/types";

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchTenantsData();
        if (!cancelled) setTenants(result);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load tenants.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadData();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const statusCounts = useMemo(() => ({
    all: tenants.length,
    active: tenants.filter((item) => item.tenureStatus === "active").length,
    notice: tenants.filter((item) => item.tenureStatus === "notice").length,
  }), [tenants]);

  return (
    <ModulePage title="Tenants" description="Tenant management, assignment flows, and payment actions.">
      {loading && <LoadingState label="Loading tenants..." />}
      {!loading && error && <ErrorState message={error} onRetry={() => setReloadKey((v) => v + 1)} />}
      {!loading && !error && (
        <section className="space-y-4 rounded-lg border border-border-color bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <button type="button" className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm">All Tenants ({statusCounts.all})</button>
              <button type="button" className="rounded-md border border-border-color px-3 py-2 text-sm text-muted">Active ({statusCounts.active})</button>
              <button type="button" className="rounded-md border border-border-color px-3 py-2 text-sm text-muted">Notice ({statusCounts.notice})</button>
            </div>
            <div className="flex gap-2">
              <button type="button" className="rounded-md border border-border-color px-3 py-2 text-sm text-muted">Bulk Actions</button>
              <button type="button" className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium">Add Tenant</button>
            </div>
          </div>
          {tenants.length === 0 ? (
            <EmptyState title="No tenants found" description="Create tenants in mobile or backend first, then refresh this page." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border-color text-left text-muted">
                    <th className="px-3 py-2 font-medium">Tenant</th>
                    <th className="px-3 py-2 font-medium">Property</th>
                    <th className="px-3 py-2 font-medium">Phone</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Tenure</th>
                    <th className="px-3 py-2 font-medium">Rent Status</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((row) => (
                    <tr key={row.id} className="border-b border-border-color/60">
                      <td className="px-3 py-3 font-medium">{row.fullName}</td>
                      <td className="px-3 py-3 text-muted">{row.propertyName}</td>
                      <td className="px-3 py-3 text-muted">{row.phone}</td>
                      <td className="px-3 py-3 text-muted">{row.email}</td>
                      <td className="px-3 py-3"><span className="rounded-full border border-border-color bg-surface-elevated px-2 py-1 text-xs text-muted capitalize">{row.tenureStatus}</span></td>
                      <td className="px-3 py-3"><span className="rounded-full border border-border-color bg-surface-elevated px-2 py-1 text-xs text-muted capitalize">{row.rentStatus}</span></td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="rounded-md border border-border-color px-2 py-1 text-xs text-muted">Open</button>
                          <button type="button" className="rounded-md border border-border-color px-2 py-1 text-xs text-muted">Assign</button>
                          <button type="button" className="rounded-md border border-border-color px-2 py-1 text-xs text-muted">Record Payment</button>
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
