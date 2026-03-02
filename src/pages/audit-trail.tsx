import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { fetchAuditTrailData } from "@/lib/data";
import type { AuditEventRow } from "@/lib/types";
import { 
  History, 
  Search, 
  Download, 
  RefreshCw, 
  User, 
  Clock, 
  FileText, 
  Home, 
  Users, 
  CreditCard, 
  Wrench, 
  Shield, 
  CheckCircle2, 
  Mail, 
  Send 
} from "lucide-react";
import { DataTableHeader } from "@/components/data-table";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "NAD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatAuditAction(row: AuditEventRow): string {
  try {
    const details = JSON.parse(row.details);
    const action = row.action.toLowerCase();
    const entity = row.entityType.toLowerCase();

    switch (action) {
      case "create":
        return `Created a new ${entity}`;
      case "update":
        if (details.changes) {
          const changedKeys = Object.keys(details.changes).join(", ");
          return `Updated ${entity} details (${changedKeys})`;
        }
        return `Modified ${entity} information`;
      case "delete":
        return `Removed ${entity} record`;
      case "payment_recorded":
      case "rent_payment_recorded":
        return `Recorded payment of ${formatCurrency(details.amount_paid || 0)} for ${details.paid_month || details.payment_date || "this period"}`;
      case "invoice_generated":
      case "unified_invoice_generated":
        return `Generated invoice for ${details.month || "billing period"} total ${formatCurrency(details.total_amount || details.total_amount_paid || 0)}`;
      case "invoice_shared":
        return `Shared invoice via ${details.channel || "external channel"}`;
      case "status_change":
        return `Changed status to ${details.new_status || "updated state"}`;
      default:
        // Handle underscore separated actions
        return action.replace(/_/g, " ");
    }
  } catch (e) {
    return row.action.replace(/_/g, " ");
  }
}

function getEventIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes("property")) return <Home size={16} className="text-sky-600" />;
  if (t.includes("tenant")) return <Users size={16} className="text-emerald-600" />;
  if (t.includes("payment") || t.includes("invoice")) return <CreditCard size={16} className="text-amber-600" />;
  if (t.includes("maintenance") || t.includes("work_order")) return <Wrench size={16} className="text-orange-600" />;
  if (t.includes("contract")) return <FileText size={16} className="text-indigo-600" />;
  if (t.includes("user") || t.includes("admin")) return <Shield size={16} className="text-purple-600" />;
  return <History size={16} className="text-muted" />;
}

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
    const header = "Date,Action,Entity,Actor,Friendly Description";
    const rows = filtered.map((e) => `"${new Date(e.createdAt).toLocaleString()}","${e.action}","${e.entityType}","${e.actorName}","${formatAuditAction(e)}"`);
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "audit-trail.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const filterTabs = [
    { key: "all", label: "All Events", count: events.length },
    ...entityTypes.map(t => ({ key: t, label: t.replace(/_/g, " ").replace(/^\w/, c => c.toUpperCase()) }))
  ];

  return (
    <ModulePage title="Audit Trail" description="Activity log and historical operational records.">
      {loading && <LoadingState label="Retreiving security logs..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (
        <section className="rounded-xl border border-border-color bg-surface p-1">
          <div className="p-4">
            <DataTableHeader
              searchValue={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search events by actor or action..."
              filters={filterTabs}
              activeFilter={entityFilter}
              onFilterChange={setEntityFilter}
              actions={
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={reload}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-color bg-surface-elevated text-muted hover:text-foreground transition-all"
                    title="Refresh"
                  >
                    <RefreshCw size={16} />
                  </button>
                  <button
                    type="button"
                    onClick={exportCSV}
                    className="flex items-center gap-2 rounded-lg border border-border-color bg-surface-elevated px-4 py-2 text-sm font-bold text-muted hover:text-foreground transition-all"
                  >
                    <Download size={16} />
                    <span>Export</span>
                  </button>
                </div>
              }
            />
          </div>

          {filtered.length === 0 ? (
            <div className="p-12">
              <EmptyState title="No events recorded" description={search ? "No events match your criteria." : "Logs will appear as system actions occur."} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border-color text-left text-muted/60 uppercase text-[10px] font-bold tracking-wider">
                    <th className="px-6 py-4 font-bold">Activity Time</th>
                    <th className="px-6 py-4 font-bold">Category</th>
                    <th className="px-6 py-4 font-bold">Administrator</th>
                    <th className="px-6 py-4 font-bold">Record Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color/40">
                  {filtered.map((row) => (
                    <tr key={row.id} className="group hover:bg-surface-elevated/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground">{new Date(row.createdAt).toLocaleDateString("en-ZA", { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          <span className="text-[10px] font-medium text-muted uppercase tracking-tighter">{new Date(row.createdAt).toLocaleTimeString("en-ZA", { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/5 group-hover:bg-foreground group-hover:text-surface transition-all">
                            {getEventIcon(row.entityType)}
                          </div>
                          <span className="text-xs font-bold text-muted/80 capitalize tracking-tight">{row.entityType.replace(/_/g, " ")}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-foreground font-bold">
                          <User size={14} className="text-muted/40" />
                          <span>{row.actorName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-foreground leading-relaxed">
                          {formatAuditAction(row)}
                        </p>
                        <p className="text-[10px] text-muted font-bold uppercase tracking-wider mt-0.5 opacity-60">
                          Ref: #{row.entityId.slice(0, 8)}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="border-t border-border-color/50 px-6 py-4 bg-surface-elevated/20">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted/40">
              Showing {filtered.length} recent operations
            </p>
          </div>
        </section>
      )}
    </ModulePage>
  );
}
