import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { fetchPreventiveTasksData } from "@/lib/data";
import type { PreventiveTaskRow } from "@/lib/types";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(amount);
}

export default function ScheduledTasksPage() {
  const [tasks, setTasks] = useState<PreventiveTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true); setError(null);
      try { const result = await fetchPreventiveTasksData(); if (!cancelled) setTasks(result); }
      catch (loadError) { if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load scheduled tasks."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void loadData();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const counts = useMemo(() => ({
    all: tasks.length,
    scheduled: tasks.filter((i) => i.status === "scheduled").length,
    overdue: tasks.filter((i) => i.status === "overdue").length,
    completed: tasks.filter((i) => i.status === "completed").length,
  }), [tasks]);

  return (
    <ModulePage title="Scheduled Tasks" description="Preventive maintenance schedules and execution logs.">
      {loading && <LoadingState label="Loading preventive tasks..." />}
      {!loading && error && <ErrorState message={error} onRetry={() => setReloadKey((v) => v + 1)} />}
      {!loading && !error && (
        <section className="space-y-4 rounded-lg border border-border-color bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button type="button" className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm">All ({counts.all})</button>
              <button type="button" className="rounded-md border border-border-color px-3 py-2 text-sm text-muted">Scheduled ({counts.scheduled})</button>
              <button type="button" className="rounded-md border border-border-color px-3 py-2 text-sm text-muted">Overdue ({counts.overdue})</button>
              <button type="button" className="rounded-md border border-border-color px-3 py-2 text-sm text-muted">Completed ({counts.completed})</button>
            </div>
            <button type="button" className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium">Create Task</button>
          </div>
          {tasks.length === 0 ? (
            <EmptyState title="No scheduled tasks found" description="Create preventive maintenance tasks in mobile or backend first, then refresh this page." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead><tr className="border-b border-border-color text-left text-muted">
                  <th className="px-3 py-2 font-medium">Task</th><th className="px-3 py-2 font-medium">Property</th><th className="px-3 py-2 font-medium">Provider</th><th className="px-3 py-2 font-medium">Frequency</th><th className="px-3 py-2 font-medium">Next Due</th><th className="px-3 py-2 font-medium">Est. Cost</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Actions</th>
                </tr></thead>
                <tbody>{tasks.map((row) => (
                  <tr key={row.id} className="border-b border-border-color/60">
                    <td className="px-3 py-3 font-medium">{row.title}</td>
                    <td className="px-3 py-3 text-muted">{row.propertyName}</td>
                    <td className="px-3 py-3 text-muted">{row.providerName}</td>
                    <td className="px-3 py-3 text-muted">{row.frequency}</td>
                    <td className="px-3 py-3 text-muted">{row.nextDue}</td>
                    <td className="px-3 py-3 text-muted">{formatCurrency(row.estimatedCost)}</td>
                    <td className="px-3 py-3"><span className="rounded-full border border-border-color bg-surface-elevated px-2 py-1 text-xs text-muted capitalize">{row.status}</span></td>
                    <td className="px-3 py-3"><div className="flex flex-wrap gap-2">
                      <button type="button" className="rounded-md border border-border-color px-2 py-1 text-xs text-muted">Run Now</button>
                      <button type="button" className="rounded-md border border-border-color px-2 py-1 text-xs text-muted">Edit</button>
                      <button type="button" className="rounded-md border border-border-color px-2 py-1 text-xs text-muted">Delete</button>
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
