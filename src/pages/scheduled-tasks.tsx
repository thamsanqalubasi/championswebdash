import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { Modal, ConfirmDialog } from "@/components/modal";
import { 
  Plus, 
  Search, 
  CalendarClock, 
  Briefcase, 
  Building, 
  RefreshCw, 
  Pause, 
  Play, 
  CheckCircle2, 
  Trash, 
  Pencil, 
  Download,
  Clock,
  DollarSign,
  ChevronRight,
  Truck,
  XCircle,
  AlertCircle
} from "lucide-react";
import { DataTableHeader, StatusBadge, TableRowActions, TableActionButton } from "@/components/data-table";
import { fetchPreventiveTasksData, isValidUuid } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { PreventiveTaskRow } from "@/lib/types";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "NAD", maximumFractionDigits: 0 }).format(amount);
}

const emptyForm = { title: "", property_id: "", maintainer_id: "", category: "general", frequency: "monthly", next_due: "", estimated_cost: 0, status: "active" };

function StatCard({ label, value, detail, icon: Icon, colorClass = "text-foreground" }: { label: string; value: string; detail: string; icon: any; colorClass?: string }) {
  return (
    <article className="rounded-xl border border-border-color bg-surface p-5 transition-all hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted/60">{label}</p>
          <p className={`mt-2 text-2xl font-bold tracking-tight ${colorClass}`}>{value}</p>
        </div>
        <div className="rounded-lg bg-surface-elevated p-2 ring-1 ring-border-color/50">
          <Icon size={20} className="text-muted" />
        </div>
      </div>
      <p className="mt-4 text-[10px] font-bold uppercase tracking-widest text-muted/40">{detail}</p>
    </article>
  );
}

export default function ScheduledTasksPage() {
  const { currentCompany } = useAuth();
  const [tasks, setTasks] = useState<PreventiveTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PreventiveTaskRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [providers, setProviders] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true); setError(null);
      try {
        const result = await fetchPreventiveTasksData();
        if (!cancelled) setTasks(result);
        const [{ data: props }, { data: provs }] = await Promise.all([
          supabase.from("properties").select("id, name").order("name"),
          supabase.from("maintainers").select("id, name").order("name"),
        ]);
        if (!cancelled) {
          if (props) setProperties(props.map((p) => ({ id: String(p.id), name: String(p.name) })));
          if (provs) setProviders(provs.map((p) => ({ id: String(p.id), name: String(p.name) })));
        }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load scheduled tasks."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void loadData();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const reload = () => setReloadKey((v) => v + 1);

  const counts = useMemo(() => ({
    all: tasks.length,
    active: tasks.filter((i) => i.status === "active").length,
    paused: tasks.filter((i) => i.status === "paused").length,
    overdue: tasks.filter((i) => i.status === "overdue").length,
    completed: tasks.filter((i) => i.status === "completed").length,
  }), [tasks]);

  const filtered = useMemo(() => {
    let result = activeFilter === "all" ? tasks : tasks.filter((t) => t.status === activeFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => t.title.toLowerCase().includes(q) || t.propertyName.toLowerCase().includes(q) || t.providerName.toLowerCase().includes(q));
    }
    return result;
  }, [tasks, activeFilter, searchQuery]);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setModalOpen(true); };

  const openEdit = async (taskId: string) => {
    try {
      const { data, error: fetchError } = await supabase
        .from("preventive_maintenance")
        .select("id, title, property_id, maintainer_id, category, frequency, next_due, estimated_cost, status")
        .eq("id", taskId)
        .single();
      if (fetchError) throw fetchError;
      setEditingId(taskId);
      setForm({
        title: String(data.title ?? ""),
        property_id: String(data.property_id ?? ""),
        maintainer_id: String(data.maintainer_id ?? ""),
        category: String(data.category ?? "general"),
        frequency: String(data.frequency ?? "monthly"),
        next_due: String(data.next_due ?? ""),
        estimated_cost: Number(data.estimated_cost ?? 0),
        status: String(data.status ?? "active"),
      });
      setModalOpen(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not load task for editing.");
    }
  };

  const onSave = async () => {
    if (!form.title.trim()) { alert("Please enter a task title."); return; }
    if (!form.next_due) { alert("Please select a next due date."); return; }
    setSaving(true);
    try {
      const compId = currentCompany?.id && isValidUuid(currentCompany.id) ? currentCompany.id : null;
      const payload: Record<string, unknown> = {
        title: form.title,
        category: form.category,
        frequency: form.frequency,
        next_due: form.next_due || null,
        estimated_cost: form.estimated_cost,
        status: form.status,
        company_id: compId,
      };
      if (form.property_id && isValidUuid(form.property_id)) payload.property_id = form.property_id;
      if (form.maintainer_id && isValidUuid(form.maintainer_id)) payload.maintainer_id = form.maintainer_id;
      if (editingId) {
        const { error: err } = await supabase.from("preventive_maintenance").update(payload).eq("id", editingId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("preventive_maintenance").insert(payload);
        if (err) throw err;
      }
      setModalOpen(false); reload();
    } catch (e) { alert(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  };

  const onStatusChange = async (id: string, newStatus: string) => {
    const { error: err } = await supabase.from("preventive_maintenance").update({ status: newStatus }).eq("id", id);
    if (err) { alert(err.message); return; }
    reload();
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error: err } = await supabase.from("preventive_maintenance").delete().eq("id", deleteTarget.id);
      if (err) throw err;
      setDeleteTarget(null); reload();
    } catch (e) { alert(e instanceof Error ? e.message : "Delete failed"); }
    finally { setDeleting(false); }
  };

  const exportCsv = () => {
    const header = "Task,Property,Provider,Frequency,Next Due,Est. Cost,Status\n";
    const rows = filtered.map((r) => `"${r.title}","${r.propertyName}","${r.providerName}","${r.frequency}","${r.nextDue}",${r.estimatedCost},"${r.status}"`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "scheduled-tasks.csv";
    a.click();
  };

  const filterTabs = [
    { key: "all", label: "All Tasks", count: counts.all },
    { key: "active", label: "Active", count: counts.active },
    { key: "paused", label: "Paused", count: counts.paused },
    { key: "overdue", label: "Overdue", count: counts.overdue },
    { key: "completed", label: "Completed", count: counts.completed },
  ];

  return (
    <ModulePage title="Scheduled Maintenance" description="Manage preventive service intervals, recurrent tasks, and partner assignments.">
      {loading && <LoadingState label="Synchronizing maintenance schedules..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Total Protocols" value={String(counts.all)} detail="Preventive maintenance tasks" icon={CalendarClock} />
            <StatCard label="Active" value={String(counts.active)} detail="Ongoing service intervals" icon={Play} colorClass="text-sky-600" />
            <StatCard label="Overdue" value={String(counts.overdue)} detail="Immediate action required" icon={AlertCircle} colorClass="text-red-600" />
            <StatCard label="Estimated Budget" value={formatCurrency(tasks.reduce((s, t) => s + t.estimatedCost, 0))} detail="Total cycle valuation" icon={DollarSign} colorClass="text-green-600" />
          </div>

          <section className="rounded-xl border border-border-color bg-surface p-1">
          <div className="p-4">
            <DataTableHeader
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search tasks by title, unit or provider..."
              filters={filterTabs}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              actions={
                <>
                  <button
                    type="button"
                    onClick={exportCsv}
                    className="flex items-center gap-2 rounded-lg border border-border-color bg-surface-elevated px-4 py-2 text-sm font-medium text-muted hover:text-foreground transition-all"
                  >
                    <Download size={16} />
                    <span>Export</span>
                  </button>
                  <button
                    type="button"
                    onClick={openAdd}
                    className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-surface hover:opacity-90 transition-all"
                  >
                    <Plus size={16} />
                    <span>Create Task</span>
                  </button>
                </>
              }
            />
          </div>

          {filtered.length === 0 ? (
            <div className="p-12">
              <EmptyState title="No tasks found" description={searchQuery ? "Try a different search term or filter." : "Schedule your first preventive task to get started."} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border-color text-left text-muted/60 uppercase text-[10px] font-bold tracking-wider">
                    <th className="px-6 py-4 font-bold">Maintenance Task</th>
                    <th className="px-6 py-4 font-bold">Target Unit</th>
                    <th className="px-6 py-4 font-bold">Assigned Provider</th>
                    <th className="px-6 py-4 font-bold">Frequency</th>
                    <th className="px-6 py-4 font-bold">Timeline</th>
                    <th className="px-6 py-4 font-bold text-right">Est. Budget</th>
                    <th className="px-6 py-4 font-bold">Status</th>
                    <th className="px-6 py-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color/40">
                  {filtered.map((row) => (
                    <tr key={row.id} className="group hover:bg-surface-elevated/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/5 group-hover:bg-foreground group-hover:text-surface transition-all">
                            <CalendarClock size={20} className="text-muted/60 group-hover:text-current" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold tracking-tight text-foreground truncate">{row.title}</p>
                            <p className="text-[10px] font-bold text-muted/60 uppercase tracking-widest">{row.category}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Building size={14} className="text-muted/40" />
                          <span className="font-medium text-foreground">{row.propertyName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Truck size={14} className="text-muted/40" />
                          <span className="font-bold text-foreground">{row.providerName}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 capitalize text-muted font-medium">{row.frequency}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 font-bold text-foreground">
                          <Clock size={14} className="text-muted/40" />
                          <span>{row.nextDue}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1 font-bold text-foreground">
                          <span className="text-[10px] text-muted">NAD</span>
                          <span>{row.estimatedCost.toLocaleString()}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <TableRowActions>
                          <TableActionButton
                            icon={Pencil}
                            label="Edit"
                            onClick={(e) => { e.stopPropagation(); void openEdit(row.id); }}
                          />
                          {row.status !== "completed" && (
                            <TableActionButton
                              icon={CheckCircle2}
                              label="Mark Done"
                              onClick={(e) => { e.stopPropagation(); onStatusChange(row.id, "completed"); }}
                              variant="success"
                            />
                          )}
                          {row.status === "active" ? (
                            <TableActionButton
                              icon={Pause}
                              label="Pause"
                              onClick={(e) => { e.stopPropagation(); onStatusChange(row.id, "paused"); }}
                            />
                          ) : (
                            <TableActionButton
                              icon={Play}
                              label="Resume"
                              onClick={(e) => { e.stopPropagation(); onStatusChange(row.id, "active"); }}
                              variant="success"
                            />
                          )}
                          <TableActionButton
                            icon={Trash}
                            label="Delete"
                            variant="danger"
                            onClick={(e) => { e.stopPropagation(); setDeleteTarget(row); }}
                          />
                          <div className="ml-2 pl-2 border-l border-border-color/40">
                            <ChevronRight size={18} className="text-muted/40 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </TableRowActions>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="border-t border-border-color/50 px-6 py-4 bg-surface-elevated/20">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted/40">
              Showing {filtered.length} of {counts.all} preventive protocols
            </p>
          </div>
        </section>
      </div>
    )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit Maintenance Protocol" : "New Preventive Task"}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Protocol Title</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/5" placeholder="e.g. Annual AC Service" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Target Unit</label>
              <select value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })} className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/5">
                <option value="">Select property...</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Service Partner</label>
              <select value={form.maintainer_id} onChange={(e) => setForm({ ...form, maintainer_id: e.target.value })} className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/5">
                <option value="">Select provider...</option>{providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/5">
                <option value="plumbing">Plumbing</option><option value="electrical">Electrical</option><option value="structural">Structural</option><option value="appliance">Appliance</option><option value="hvac">HVAC</option><option value="pest_control">Pest Control</option><option value="painting">Painting</option><option value="landscaping">Landscaping</option><option value="fire_safety">Fire Safety</option><option value="general">General</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Frequency</label>
              <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/5">
                <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="biannual">Biannual</option><option value="annual">Annual</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Next Due Date</label>
              <input type="date" value={form.next_due} onChange={(e) => setForm({ ...form, next_due: e.target.value })} className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/5" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Estimated Cost (NAD)</label>
              <input type="number" value={form.estimated_cost} onChange={(e) => setForm({ ...form, estimated_cost: Number(e.target.value) })} className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/5" />
            </div>
          </div>
          {editingId && (
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Current Workflow Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/5">
                <option value="active">Active</option><option value="paused">Paused</option><option value="overdue">Overdue</option><option value="completed">Completed</option>
              </select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-border-color px-4 py-2 text-sm font-bold text-muted hover:text-foreground">Cancel</button>
            <button type="button" onClick={onSave} disabled={saving} className="rounded-lg bg-foreground px-6 py-2 text-sm font-bold text-surface hover:opacity-90 disabled:opacity-50">
              {saving ? "Saving..." : "Save Protocol"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={onDelete} title="Delete Maintenance Protocol" message={`Are you sure you want to delete "${deleteTarget?.title}"? This will stop all future scheduling for this task.`} confirmLabel="Delete Task" loading={deleting} />
    </ModulePage>
  );
}
