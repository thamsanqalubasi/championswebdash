import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { Modal, ConfirmDialog } from "@/components/modal";
import { fetchPreventiveTasksData } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { PreventiveTaskRow } from "@/lib/types";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "NAD", maximumFractionDigits: 0 }).format(amount);
}

const emptyForm = { title: "", property_id: "", maintainer_id: "", category: "general", frequency: "monthly", next_due: "", estimated_cost: 0, status: "active" };

export default function ScheduledTasksPage() {
  const [tasks, setTasks] = useState<PreventiveTaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeFilter, setActiveFilter] = useState("all");
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

  const filtered = useMemo(() => activeFilter === "all" ? tasks : tasks.filter((t) => t.status === activeFilter), [tasks, activeFilter]);

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
      const payload: Record<string, unknown> = { title: form.title, category: form.category, frequency: form.frequency, next_due: form.next_due || null, estimated_cost: form.estimated_cost, status: form.status };
      if (form.property_id) payload.property_id = form.property_id;
      if (form.maintainer_id) payload.maintainer_id = form.maintainer_id;
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

  return (
    <ModulePage title="Scheduled Tasks" description="Preventive maintenance schedules and execution logs.">
      {loading && <LoadingState label="Loading preventive tasks..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (
        <section className="space-y-4 rounded-lg border border-border-color bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {(["all", "active", "paused", "overdue", "completed"] as const).map((key) => (
                <button key={key} type="button" onClick={() => setActiveFilter(key)}
                  className={`rounded-md border border-border-color px-3 py-2 text-sm ${activeFilter === key ? "bg-surface-elevated font-medium" : "text-muted"}`}>
                  {key === "all" ? `All (${counts.all})` : `${key.charAt(0).toUpperCase() + key.slice(1)} (${counts[key]})`}
                </button>
              ))}
            </div>
            <button type="button" onClick={openAdd} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium">Create Task</button>
          </div>
          {filtered.length === 0 ? <EmptyState title="No scheduled tasks found" description="Create a task to get started." /> : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead><tr className="border-b border-border-color text-left text-muted">
                  <th className="px-3 py-2 font-medium">Task</th><th className="px-3 py-2 font-medium">Property</th><th className="px-3 py-2 font-medium">Provider</th><th className="px-3 py-2 font-medium">Frequency</th><th className="px-3 py-2 font-medium">Next Due</th><th className="px-3 py-2 font-medium">Est. Cost</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Actions</th>
                </tr></thead>
                <tbody>{filtered.map((row) => (
                  <tr key={row.id} className="border-b border-border-color/60">
                    <td className="px-3 py-3 font-medium">{row.title}</td>
                    <td className="px-3 py-3 text-muted">{row.propertyName}</td>
                    <td className="px-3 py-3 text-muted">{row.providerName}</td>
                    <td className="px-3 py-3 text-muted">{row.frequency}</td>
                    <td className="px-3 py-3 text-muted">{row.nextDue}</td>
                    <td className="px-3 py-3 text-muted">{formatCurrency(row.estimatedCost)}</td>
                    <td className="px-3 py-3"><span className="rounded-full border border-border-color bg-surface-elevated px-2 py-1 text-xs text-muted capitalize">{row.status}</span></td>
                    <td className="px-3 py-3"><div className="flex flex-wrap gap-2">
                      <button type="button" onClick={(event) => { event.stopPropagation(); void openEdit(row.id); }} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Edit</button>
                      {row.status !== "completed" && <button type="button" onClick={(event) => { event.stopPropagation(); onStatusChange(row.id, "completed"); }} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Complete</button>}
                      {row.status === "completed" && <button type="button" onClick={(event) => { event.stopPropagation(); onStatusChange(row.id, "active"); }} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Reschedule</button>}
                      {row.status === "active" && <button type="button" onClick={(event) => { event.stopPropagation(); onStatusChange(row.id, "paused"); }} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Pause</button>}
                      {row.status === "paused" && <button type="button" onClick={(event) => { event.stopPropagation(); onStatusChange(row.id, "active"); }} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Resume</button>}
                      <button type="button" onClick={(event) => { event.stopPropagation(); setDeleteTarget(row); }} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Delete</button>
                    </div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit Task" : "Create Task"}>
        <div className="space-y-3">
          <div><label className="mb-1 block text-sm text-muted">Title</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div><label className="mb-1 block text-sm text-muted">Property</label><select value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
            <option value="">Select property...</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></div>
          <div><label className="mb-1 block text-sm text-muted">Provider</label><select value={form.maintainer_id} onChange={(e) => setForm({ ...form, maintainer_id: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
            <option value="">Select provider...</option>{providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm text-muted">Category</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
              <option value="plumbing">Plumbing</option><option value="electrical">Electrical</option><option value="structural">Structural</option><option value="appliance">Appliance</option><option value="hvac">HVAC</option><option value="pest_control">Pest Control</option><option value="painting">Painting</option><option value="landscaping">Landscaping</option><option value="fire_safety">Fire Safety</option><option value="general">General</option>
            </select></div>
            <div><label className="mb-1 block text-sm text-muted">Frequency</label><select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
              <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="biannual">Biannual</option><option value="annual">Annual</option>
            </select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm text-muted">Next Due</label><input type="date" value={form.next_due} onChange={(e) => setForm({ ...form, next_due: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
            <div><label className="mb-1 block text-sm text-muted">Est. Cost</label><input type="number" value={form.estimated_cost} onChange={(e) => setForm({ ...form, estimated_cost: Number(e.target.value) })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          </div>
          {editingId && (
            <div><label className="mb-1 block text-sm text-muted">Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
              <option value="active">Active</option><option value="paused">Paused</option><option value="overdue">Overdue</option><option value="completed">Completed</option>
            </select></div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-md border border-border-color px-3 py-2 text-sm">Cancel</button>
            <button type="button" onClick={onSave} disabled={saving} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={onDelete} title="Delete Task" message={`Delete "${deleteTarget?.title}"?`} confirmLabel="Delete" loading={deleting} />
    </ModulePage>
  );
}
