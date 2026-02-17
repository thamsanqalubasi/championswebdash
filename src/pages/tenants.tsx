import { useEffect, useMemo, useState } from "react";
import { ModulePage } from "@/components/module-page";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { Modal, ConfirmDialog, SideDrawer } from "@/components/modal";
import { fetchTenantsData } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { TenantRow } from "@/lib/types";

const emptyForm = { full_name: "", id_number: "", phone: "", email: "", tenure_status: "active", property_id: "" };

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeFilter, setActiveFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TenantRow | null>(null);
  const [detailsRow, setDetailsRow] = useState<TenantRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true); setError(null);
      try {
        const result = await fetchTenantsData();
        if (!cancelled) setTenants(result);
        const { data: props } = await supabase.from("properties").select("id, name").order("name");
        if (!cancelled && props) setProperties(props.map((p) => ({ id: String(p.id), name: String(p.name) })));
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load tenants."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void loadData();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const reload = () => setReloadKey((v) => v + 1);

  const statusCounts = useMemo(() => ({
    all: tenants.length,
    active: tenants.filter((i) => i.tenureStatus === "active").length,
    notice: tenants.filter((i) => i.tenureStatus === "notice").length,
  }), [tenants]);

  const filtered = useMemo(() => activeFilter === "all" ? tenants : tenants.filter((t) => t.tenureStatus === activeFilter), [tenants, activeFilter]);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (row: TenantRow) => { setEditingId(row.id); setForm({ full_name: row.fullName, id_number: "", phone: row.phone, email: row.email, tenure_status: row.tenureStatus, property_id: "" }); setModalOpen(true); };

  const onSave = async () => {
    if (!form.full_name.trim()) { alert("Please enter full name."); return; }
    if (!form.id_number.trim()) { alert("Please enter ID number."); return; }
    if (!form.phone.trim() || !form.email.trim()) { alert("Please enter phone and email."); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { full_name: form.full_name, id_number: form.id_number, phone: form.phone, email: form.email, tenure_status: form.tenure_status };
      if (form.property_id) payload.property_id = form.property_id;
      if (editingId) {
        const { error: err } = await supabase.from("tenants").update(payload).eq("id", editingId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("tenants").insert(payload);
        if (err) throw err;
      }
      setModalOpen(false); reload();
    } catch (e) { alert(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error: err } = await supabase.from("tenants").delete().eq("id", deleteTarget.id);
      if (err) throw err;
      setDeleteTarget(null); reload();
    } catch (e) { alert(e instanceof Error ? e.message : "Delete failed"); }
    finally { setDeleting(false); }
  };

  const onStatusChange = async (id: string, newStatus: string) => {
    const { error: err } = await supabase.from("tenants").update({ tenure_status: newStatus }).eq("id", id);
    if (err) { alert(err.message); return; }
    reload();
  };

  return (
    <ModulePage title="Tenants" description="Tenant management, assignment flows, and payment actions.">
      {loading && <LoadingState label="Loading tenants..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (
        <section className="space-y-4 rounded-lg border border-border-color bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              {(["all", "active", "notice"] as const).map((key) => (
                <button key={key} type="button" onClick={() => setActiveFilter(key)}
                  className={`rounded-md border border-border-color px-3 py-2 text-sm ${activeFilter === key ? "bg-surface-elevated font-medium" : "text-muted"}`}>
                  {key === "all" ? `All Tenants (${statusCounts.all})` : `${key.charAt(0).toUpperCase() + key.slice(1)} (${statusCounts[key]})`}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={openAdd} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium">Add Tenant</button>
            </div>
          </div>
          {filtered.length === 0 ? <EmptyState title="No tenants found" description="Add a tenant to get started." /> : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead><tr className="border-b border-border-color text-left text-muted">
                  <th className="px-3 py-2 font-medium">Tenant</th><th className="px-3 py-2 font-medium">Property</th><th className="px-3 py-2 font-medium">Phone</th><th className="px-3 py-2 font-medium">Email</th><th className="px-3 py-2 font-medium">Tenure</th><th className="px-3 py-2 font-medium">Rent Status</th><th className="px-3 py-2 font-medium">Actions</th>
                </tr></thead>
                <tbody>{filtered.map((row) => (
                  <tr key={row.id} onClick={() => setDetailsRow(row)} className="cursor-pointer border-b border-border-color/60 hover:bg-surface-elevated/40">
                    <td className="px-3 py-3 font-medium">{row.fullName}</td>
                    <td className="px-3 py-3 text-muted">{row.propertyName}</td>
                    <td className="px-3 py-3 text-muted">{row.phone}</td>
                    <td className="px-3 py-3 text-muted">{row.email}</td>
                    <td className="px-3 py-3"><span className="rounded-full border border-border-color bg-surface-elevated px-2 py-1 text-xs text-muted capitalize">{row.tenureStatus}</span></td>
                    <td className="px-3 py-3"><span className="rounded-full border border-border-color bg-surface-elevated px-2 py-1 text-xs text-muted capitalize">{row.rentStatus}</span></td>
                    <td className="px-3 py-3"><div className="flex flex-wrap gap-2">
                      <button type="button" onClick={(event) => { event.stopPropagation(); openEdit(row); }} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Edit</button>
                      {row.tenureStatus === "active" && <button type="button" onClick={(event) => { event.stopPropagation(); onStatusChange(row.id, "notice"); }} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Give Notice</button>}
                      {row.tenureStatus === "notice" && <button type="button" onClick={(event) => { event.stopPropagation(); onStatusChange(row.id, "active"); }} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Reactivate</button>}
                      <button type="button" onClick={(event) => { event.stopPropagation(); setDeleteTarget(row); }} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Delete</button>
                    </div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit Tenant" : "Add Tenant"}>
        <div className="space-y-3">
          <div><label className="mb-1 block text-sm text-muted">Full Name</label><input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div><label className="mb-1 block text-sm text-muted">ID Number</label><input value={form.id_number} onChange={(e) => setForm({ ...form, id_number: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div><label className="mb-1 block text-sm text-muted">Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div><label className="mb-1 block text-sm text-muted">Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div><label className="mb-1 block text-sm text-muted">Property</label><select value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
            <option value="">Select property...</option>
            {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></div>
          <div><label className="mb-1 block text-sm text-muted">Tenure Status</label><select value={form.tenure_status} onChange={(e) => setForm({ ...form, tenure_status: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
            <option value="active">Active</option><option value="notice">Notice</option><option value="ended">Ended</option>
          </select></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-md border border-border-color px-3 py-2 text-sm">Cancel</button>
            <button type="button" onClick={onSave} disabled={saving} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={onDelete} title="Delete Tenant" message={`Delete "${deleteTarget?.fullName}"? This cannot be undone.`} confirmLabel="Delete" loading={deleting} />

      <SideDrawer open={!!detailsRow} onClose={() => setDetailsRow(null)} title="Tenant Details">
        {detailsRow && (
          <div className="space-y-4">
            <div className="text-sm text-muted">{detailsRow.fullName}</div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted">Property</p><p>{detailsRow.propertyName}</p></div>
              <div><p className="text-xs text-muted">Tenure</p><p>{detailsRow.tenureStatus}</p></div>
              <div><p className="text-xs text-muted">Phone</p><p>{detailsRow.phone}</p></div>
              <div><p className="text-xs text-muted">Email</p><p>{detailsRow.email}</p></div>
            </div>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => { setDetailsRow(null); openEdit(detailsRow); }} className="rounded-md border border-border-color px-3 py-2 text-sm">Edit</button>
              <button type="button" onClick={() => { setDetailsRow(null); setDeleteTarget(detailsRow); }} className="rounded-md border border-border-color px-3 py-2 text-sm">Delete</button>
            </div>
          </div>
        )}
      </SideDrawer>
    </ModulePage>
  );
}
