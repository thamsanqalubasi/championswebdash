import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { Modal, ConfirmDialog } from "@/components/modal";
import { fetchInspectionsData } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { InspectionRow } from "@/lib/types";

const emptyForm = { property_id: "", tenant_id: "", type: "General", inspector_name: "", scheduled_date: "", status: "scheduled" };

export default function InspectionsPage() {
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeFilter, setActiveFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InspectionRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [tenantsList, setTenantsList] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true); setError(null);
      try {
        const result = await fetchInspectionsData();
        if (!cancelled) setInspections(result);
        const [{ data: props }, { data: tens }] = await Promise.all([
          supabase.from("properties").select("id, name").order("name"),
          supabase.from("tenants").select("id, full_name").order("full_name"),
        ]);
        if (!cancelled) {
          if (props) setProperties(props.map((p) => ({ id: String(p.id), name: String(p.name) })));
          if (tens) setTenantsList(tens.map((t) => ({ id: String(t.id), name: String(t.full_name) })));
        }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load inspections."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void loadData();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const reload = () => setReloadKey((v) => v + 1);

  const counts = useMemo(() => ({
    all: inspections.length,
    scheduled: inspections.filter((i) => i.status === "scheduled").length,
    paused: inspections.filter((i) => i.status === "paused").length,
    completed: inspections.filter((i) => i.status === "completed").length,
  }), [inspections]);

  const filtered = useMemo(() => activeFilter === "all" ? inspections : inspections.filter((i) => i.status === activeFilter), [inspections, activeFilter]);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setModalOpen(true); };

  const onSave = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { type: form.type, inspector_name: form.inspector_name, scheduled_date: form.scheduled_date || null, status: form.status };
      if (form.property_id) payload.property_id = form.property_id;
      if (form.tenant_id) payload.tenant_id = form.tenant_id;
      if (editingId) {
        const { error: err } = await supabase.from("inspections").update(payload).eq("id", editingId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("inspections").insert(payload);
        if (err) throw err;
      }
      setModalOpen(false); reload();
    } catch (e) { alert(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  };

  const onStatusChange = async (id: string, newStatus: string, completedDate?: string) => {
    const update: Record<string, unknown> = { status: newStatus };
    if (completedDate) update.completed_date = completedDate;
    const { error: err } = await supabase.from("inspections").update(update).eq("id", id);
    if (err) { alert(err.message); return; }
    reload();
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error: err } = await supabase.from("inspections").delete().eq("id", deleteTarget.id);
      if (err) throw err;
      setDeleteTarget(null); reload();
    } catch (e) { alert(e instanceof Error ? e.message : "Delete failed"); }
    finally { setDeleting(false); }
  };

  return (
    <ModulePage title="Inspections" description="Inspection schedules, statuses, and checklist workflows.">
      {loading && <LoadingState label="Loading inspections..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (
        <section className="space-y-4 rounded-lg border border-border-color bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {(["all", "scheduled", "paused", "completed"] as const).map((key) => (
                <button key={key} type="button" onClick={() => setActiveFilter(key)}
                  className={`rounded-md border border-border-color px-3 py-2 text-sm ${activeFilter === key ? "bg-surface-elevated font-medium" : "text-muted"}`}>
                  {key === "all" ? `All (${counts.all})` : `${key.charAt(0).toUpperCase() + key.slice(1)} (${counts[key]})`}
                </button>
              ))}
            </div>
            <button type="button" onClick={openAdd} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium">Schedule Inspection</button>
          </div>
          {filtered.length === 0 ? <EmptyState title="No inspections found" description="Schedule an inspection to get started." /> : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead><tr className="border-b border-border-color text-left text-muted">
                  <th className="px-3 py-2 font-medium">Property</th><th className="px-3 py-2 font-medium">Tenant</th><th className="px-3 py-2 font-medium">Type</th><th className="px-3 py-2 font-medium">Inspector</th><th className="px-3 py-2 font-medium">Scheduled</th><th className="px-3 py-2 font-medium">Completed</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Actions</th>
                </tr></thead>
                <tbody>{filtered.map((row) => (
                  <tr key={row.id} className="border-b border-border-color/60">
                    <td className="px-3 py-3 font-medium">{row.propertyName}</td>
                    <td className="px-3 py-3 text-muted">{row.tenantName}</td>
                    <td className="px-3 py-3 text-muted">{row.type}</td>
                    <td className="px-3 py-3 text-muted">{row.inspectorName}</td>
                    <td className="px-3 py-3 text-muted">{row.scheduledDate}</td>
                    <td className="px-3 py-3 text-muted">{row.completedDate}</td>
                    <td className="px-3 py-3"><span className="rounded-full border border-border-color bg-surface-elevated px-2 py-1 text-xs text-muted capitalize">{row.status}</span></td>
                    <td className="px-3 py-3"><div className="flex flex-wrap gap-2">
                      {row.status === "scheduled" && <button type="button" onClick={() => onStatusChange(row.id, "paused")} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Pause</button>}
                      {row.status === "paused" && <button type="button" onClick={() => onStatusChange(row.id, "scheduled")} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Resume</button>}
                      {row.status !== "completed" && <button type="button" onClick={() => onStatusChange(row.id, "completed", new Date().toISOString().slice(0, 10))} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Complete</button>}
                      <button type="button" onClick={() => setDeleteTarget(row)} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Delete</button>
                    </div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit Inspection" : "Schedule Inspection"}>
        <div className="space-y-3">
          <div><label className="mb-1 block text-sm text-muted">Property</label><select value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
            <option value="">Select property...</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></div>
          <div><label className="mb-1 block text-sm text-muted">Tenant</label><select value={form.tenant_id} onChange={(e) => setForm({ ...form, tenant_id: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
            <option value="">Select tenant...</option>{tenantsList.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select></div>
          <div><label className="mb-1 block text-sm text-muted">Type</label><input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div><label className="mb-1 block text-sm text-muted">Inspector Name</label><input value={form.inspector_name} onChange={(e) => setForm({ ...form, inspector_name: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div><label className="mb-1 block text-sm text-muted">Scheduled Date</label><input type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-md border border-border-color px-3 py-2 text-sm">Cancel</button>
            <button type="button" onClick={onSave} disabled={saving} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={onDelete} title="Delete Inspection" message={`Delete this inspection at "${deleteTarget?.propertyName}"?`} confirmLabel="Delete" loading={deleting} />
    </ModulePage>
  );
}
