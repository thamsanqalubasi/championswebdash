import { useEffect, useMemo, useState } from "react";
import { ModulePage } from "@/components/module-page";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { fetchPropertiesData } from "@/lib/data";
import type { PropertyRow } from "@/lib/types";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function PropertiesPage() {
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchPropertiesData();
        if (!cancelled) {
          setProperties(result);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load properties.");
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

  const statusCounts = useMemo(() => {
    return {
      all: properties.length,
      occupied: properties.filter((item) => item.status === "occupied").length,
      vacant: properties.filter((item) => item.status === "vacant").length,
    };
  }, [properties]);

  return (
    <ModulePage
      title="Properties"
      description="Property table/cards, status filters, and property detail navigation."
    >
      {loading && <LoadingState label="Loading properties..." />}

      {!loading && error && (
        <ErrorState message={error} onRetry={() => setReloadKey((value) => value + 1)} />
      )}

      {!loading && !error && (
        <section className="space-y-4 rounded-lg border border-border-color bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm">
                All ({statusCounts.all})
              </button>
              <button type="button" className="rounded-md border border-border-color px-3 py-2 text-sm text-muted">
                Occupied ({statusCounts.occupied})
              </button>
              <button type="button" className="rounded-md border border-border-color px-3 py-2 text-sm text-muted">
                Vacant ({statusCounts.vacant})
              </button>
            </div>
            <div className="flex gap-2">
              <button type="button" className="rounded-md border border-border-color px-3 py-2 text-sm text-muted">
                Export CSV
              </button>
              <button type="button" className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium">
                Add Property
              </button>
            </div>
          </div>

          {properties.length === 0 ? (
            <EmptyState
              title="No properties found"
              description="Create a property in mobile or backend first, then refresh this page."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border-color text-left text-muted">
                    <th className="px-3 py-2 font-medium">Property</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Address</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Monthly Rent</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {properties.map((row) => (
                    <tr key={row.id} className="border-b border-border-color/60">
                      <td className="px-3 py-3 font-medium">{row.name}</td>
                      <td className="px-3 py-3 text-muted">{row.type}</td>
                      <td className="px-3 py-3 text-muted">{row.address}</td>
                      <td className="px-3 py-3">
                        <span className="rounded-full border border-border-color bg-surface-elevated px-2 py-1 text-xs text-muted capitalize">
                          {row.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-muted">{formatCurrency(row.monthlyRent)}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="rounded-md border border-border-color px-2 py-1 text-xs text-muted">
                            Open
                          </button>
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
