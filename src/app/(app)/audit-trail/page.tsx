"use client";

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
  const [filter, setFilter] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchAuditTrailData();
        if (!cancelled) {
          setEvents(result);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load audit trail.");
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

  const filteredEvents = useMemo(() => {
    const query = filter.trim().toLowerCase();
    if (!query) {
      return events;
    }

    return events.filter((event) => {
      return (
        event.action.toLowerCase().includes(query) ||
        event.entityType.toLowerCase().includes(query) ||
        event.actorName.toLowerCase().includes(query)
      );
    });
  }, [events, filter]);

  return (
    <ModulePage
      title="Audit Trail"
      description="Action timelines, filters, and entity-level traceability."
    >
      {loading && <LoadingState label="Loading audit timeline..." />}

      {!loading && error && (
        <ErrorState message={error} onRetry={() => setReloadKey((value) => value + 1)} />
      )}

      {!loading && !error && (
        <section className="space-y-4 rounded-lg border border-border-color bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <input
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Filter by action, module, or actor"
              className="w-full max-w-md rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-foreground"
            />
            <p className="text-sm text-muted">{filteredEvents.length} events</p>
          </div>

          {filteredEvents.length === 0 ? (
            <EmptyState
              title="No audit events found"
              description="No audit events match the current filter or there are no events yet."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border-color text-left text-muted">
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                    <th className="px-3 py-2 font-medium">Entity</th>
                    <th className="px-3 py-2 font-medium">Actor</th>
                    <th className="px-3 py-2 font-medium">Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.map((event) => (
                    <tr key={event.id} className="border-b border-border-color/60 align-top">
                      <td className="px-3 py-3 text-muted">{event.createdAt}</td>
                      <td className="px-3 py-3">
                        <span className="rounded-full border border-border-color bg-surface-elevated px-2 py-1 text-xs text-muted capitalize">
                          {event.action}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-muted">
                        {event.entityType} ({event.entityId})
                      </td>
                      <td className="px-3 py-3 text-muted">{event.actorName}</td>
                      <td className="max-w-[420px] px-3 py-3 text-xs text-muted">{event.metadata}</td>
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
