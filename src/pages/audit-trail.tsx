import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { fetchAuditTrailData } from "@/lib/data";
import type { AuditEventRow } from "@/lib/types";

export default function AuditTrailPage() {
  const [events, setEvents] = useState<AuditEventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [entityFilter, setEntityFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        const result = await fetchAuditTrailData();
        if (!cancelled) setEvents(result);
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load audit trail."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const reload = () => setReloadKey((v) => v + 1);

  const entityTypes = useMemo(() => {
    const types = new Set(events.map((e) => e.entityType).filter(Boolean));
    return Array.from(types).sort();
  }, [events]);

  const filtered = useMemo(() => {
    let result = events;
    if (entityFilter !== "all") result = result.filter((e) => e.entityType === entityFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((e) =>
        e.action.toLowerCase().includes(q) ||
        e.entityType.toLowerCase().includes(q) ||
        e.actorName.toLowerCase().includes(q) ||
        e.details.toLowerCase().includes(q)
      );
    }
    return result;
  }, [events, entityFilter, search]);

  const exportCSV = () => {
    const header = "Date,Action,Entity Type,Entity ID,Actor,Details";
    const rows = filtered.map((e) => `"${e.createdAt}","${e.action}","${e.entityType}","${e.entityId}","${e.actorName}","${e.details.replace(/"/g, '""')}"`);
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "audit-trail.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ModulePage title="Audit Trail" description="Activity log and change history.">
      {loading && <LoadingState label="Loading audit trail..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (
        <section className="space-y-4 rounded-lg border border-border-color bg-surface p-4">
          <div className="flex flex-wrap items-center gap-3">
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search events..." className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none flex-1 min-w-[200px]" />
            <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
              <option value="all">All Types</option>
              {entityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button type="button" onClick={exportCSV} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium">Export CSV</button>
            <button type="button" onClick={reload} className="rounded-md border border-border-color px-3 py-2 text-sm text-muted hover:bg-surface-elevated">Refresh</button>
          </div>

          <p className="text-sm text-muted">{filtered.length} event{filtered.length !== 1 ? "s" : ""}</p>

          {filtered.length === 0 ? <EmptyState title="No audit events" description="No matching events found." /> : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead><tr className="border-b border-border-color text-left text-muted">
                  <th className="px-3 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">Action</th><th className="px-3 py-2 font-medium">Entity</th><th className="px-3 py-2 font-medium">Actor</th><th className="px-3 py-2 font-medium">Details</th>
                </tr></thead>
                <tbody>{filtered.map((row) => (
                  <tr key={row.id} className="border-b border-border-color/60">
                    <td className="px-3 py-3 text-muted whitespace-nowrap">{new Date(row.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-3"><span className="rounded-full border border-border-color bg-surface-elevated px-2 py-1 text-xs capitalize">{row.action}</span></td>
                    <td className="px-3 py-3 text-muted"><span className="font-medium">{row.entityType}</span> <span className="text-xs">#{row.entityId}</span></td>
                    <td className="px-3 py-3 text-muted">{row.actorName}</td>
                    <td className="px-3 py-3 text-muted text-xs max-w-xs truncate">{row.details}</td>
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
