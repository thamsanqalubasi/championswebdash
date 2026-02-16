import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { fetchInspectionsData } from "@/lib/data";
import type { InspectionRow } from "@/lib/types";

export default function InspectionsPage() {
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true); setError(null);
      try { const result = await fetchInspectionsData(); if (!cancelled) setInspections(result); }
      catch (loadError) { if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load inspections."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void loadData();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const counts = useMemo(() => ({
    all: inspections.length,
    scheduled: inspections.filter((i) => i.status === "scheduled").length,
    paused: inspections.filter((i) => i.status === "paused").length,
    completed: inspections.filter((i) => i.status === "completed").length,
  }), [inspections]);

  return (
    <ModulePage title="Inspections" description="Inspection schedules, statuses, and checklist workflows.">
      {loading && <LoadingState label="Loading inspections..." />}
      {!loading && error && <ErrorState message={error} onRetry={() => setReloadKey((v) => v + 1)} />}
      {!loading && !error && (
        <section className="space-y-4 rounded-lg border border-border-color bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm">All ({counts.all})</button>
              <button type="button" className="rounded-md border border-border-color px-3 py-2 text-sm text-muted">Scheduled ({counts.scheduled})</button>
              <button type="button" className="rounded-md border border-border-color px-3 py-2 text-sm text-muted">Paused ({counts.paused})</button>
              <button type="button" className="rounded-md border border-border-color px-3 py-2 text-sm text-muted">Completed ({counts.completed})</button>
            </div>
            <button type="button" className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium">Schedule Inspection</button>
          </div>
          {inspections.length === 0 ? (
            <EmptyState title="No inspections found" description="Create inspections in mobile or backend first, then refresh this page." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead><tr className="border-b border-border-color text-left text-muted">
                  <th className="px-3 py-2 font-medium">Property</th><th className="px-3 py-2 font-medium">Tenant</th><th className="px-3 py-2 font-medium">Type</th><th className="px-3 py-2 font-medium">Inspector</th><th className="px-3 py-2 font-medium">Scheduled</th><th className="px-3 py-2 font-medium">Completed</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Actions</th>
                </tr></thead>
                <tbody>{inspections.map((row) => (
                  <tr key={row.id} className="border-b border-border-color/60">
                    <td className="px-3 py-3 font-medium">{row.propertyName}</td>
                    <td className="px-3 py-3 text-muted">{row.tenantName}</td>
                    <td className="px-3 py-3 text-muted">{row.type}</td>
                    <td className="px-3 py-3 text-muted">{row.inspectorName}</td>
                    <td className="px-3 py-3 text-muted">{row.scheduledDate}</td>
                    <td className="px-3 py-3 text-muted">{row.completedDate}</td>
                    <td className="px-3 py-3"><span className="rounded-full border border-border-color bg-surface-elevated px-2 py-1 text-xs text-muted capitalize">{row.status}</span></td>
                    <td className="px-3 py-3"><div className="flex flex-wrap gap-2">
                      <button type="button" className="rounded-md border border-border-color px-2 py-1 text-xs text-muted">Edit</button>
                      <button type="button" className="rounded-md border border-border-color px-2 py-1 text-xs text-muted">Start</button>
                      <button type="button" className="rounded-md border border-border-color px-2 py-1 text-xs text-muted">Complete</button>
                      <button type="button" className="rounded-md border border-border-color px-2 py-1 text-xs text-muted">Cancel</button>
                    </div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </ModulePage>
  );
}
