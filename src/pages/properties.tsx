import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ModulePage } from "@/components/module-page";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { Modal, ConfirmDialog } from "@/components/modal";
import { fetchPropertiesData } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { PropertyRow } from "@/lib/types";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(amount);
}

const emptyForm = { name: "", type: "house", address: "", status: "vacant", monthlyRent: 0 };

export default function PropertiesPage() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeFilter, setActiveFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PropertyRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true); setError(null);
      try { const result = await fetchPropertiesData(); if (!cancelled) setProperties(result); }
      catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load properties."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void loadData();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const reload = () => setReloadKey((v) => v + 1);

  const statusCounts = useMemo(() => ({
    all: properties.length,
    occupied: properties.filter((i) => i.status === "occupied").length,
    vacant: properties.filter((i) => i.status === "vacant").length,
    maintenance: properties.filter((i) => i.status === "maintenance").length,
  }), [properties]);

  const filtered = useMemo(() => activeFilter === "all" ? properties : properties.filter((p) => p.status === activeFilter), [properties, activeFilter]);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (row: PropertyRow) => { setEditingId(row.id); setForm({ name: row.name, type: row.type, address: row.address, status: row.status, monthlyRent: row.monthlyRent }); setModalOpen(true); };

  const onSave = async () => {
    setSaving(true);
    try {
      const payload = { name: form.name, type: form.type, address: form.address, status: form.status, monthly_rent: form.monthlyRent };
      if (editingId) {
        const { error: err } = await supabase.from("properties").update(payload).eq("id", editingId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("properties").insert(payload);
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
      const { error: err } = await supabase.from("properties").delete().eq("id", deleteTarget.id);
      if (err) throw err;
      setDeleteTarget(null); reload();
    } catch (e) { alert(e instanceof Error ? e.message : "Delete failed"); }
    finally { setDeleting(false); }
  };

  const exportCsv = () => {
    const header = "Name,Type,Address,Status,Monthly Rent\n";
    const rows = filtered.map((r) => `"${r.name}","${r.type}","${r.address}","${r.status}",${r.monthlyRent}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "properties.csv"; a.click();
  };

  return (
    <ModulePage title="Properties" description="Property table/cards, status filters, and property detail navigation.">
      {loading && <LoadingState label="Loading properties..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (
        <section className="space-y-4 rounded-lg border border-border-color bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {(["all", "occupied", "vacant", "maintenance"] as const).map((key) => (
                <button key={key} type="button" onClick={() => setActiveFilter(key)}
                  className={`rounded-md border border-border-color px-3 py-2 text-sm ${activeFilter === key ? "bg-surface-elevated font-medium" : "text-muted"}`}>
                  {key === "all" ? `All (${statusCounts.all})` : `${key.charAt(0).toUpperCase() + key.slice(1)} (${statusCounts[key]})`}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={exportCsv} className="rounded-md border border-border-color px-3 py-2 text-sm text-muted">Export CSV</button>
              <button type="button" onClick={openAdd} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium">Add Property</button>
            </div>
          </div>
          {filtered.length === 0 ? <EmptyState title="No properties found" description="Add a property to get started." /> : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead><tr className="border-b border-border-color text-left text-muted">
                  <th className="px-3 py-2 font-medium">Property</th><th className="px-3 py-2 font-medium">Type</th><th className="px-3 py-2 font-medium">Address</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Monthly Rent</th><th className="px-3 py-2 font-medium">Actions</th>
                </tr></thead>
                <tbody>{filtered.map((row) => (
                  <tr key={row.id} onClick={() => navigate(`/properties/${row.id}`)} className="cursor-pointer border-b border-border-color/60 hover:bg-surface-elevated/40">
                    <td className="px-3 py-3 font-medium">{row.name}</td>
                    <td className="px-3 py-3 text-muted">{row.type}</td>
                    <td className="px-3 py-3 text-muted">{row.address}</td>
                    <td className="px-3 py-3"><span className="rounded-full border border-border-color bg-surface-elevated px-2 py-1 text-xs text-muted capitalize">{row.status}</span></td>
                    <td className="px-3 py-3 text-muted">{formatCurrency(row.monthlyRent)}</td>
                    <td className="px-3 py-3"><div className="flex flex-wrap gap-2">
                      <button type="button" onClick={(event) => { event.stopPropagation(); openEdit(row); }} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Edit</button>
                      <button type="button" onClick={(event) => { event.stopPropagation(); setDeleteTarget(row); }} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Delete</button>
                    </div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit Property" : "Add Property"}>
        <div className="space-y-3">
          <div><label className="mb-1 block text-sm text-muted">Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div><label className="mb-1 block text-sm text-muted">Type</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
            <option value="house">House</option><option value="storage">Storage</option>
          </select></div>
          <div><label className="mb-1 block text-sm text-muted">Address</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div><label className="mb-1 block text-sm text-muted">Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
            <option value="vacant">Vacant</option><option value="occupied">Occupied</option><option value="maintenance">Maintenance</option>
          </select></div>
          <div><label className="mb-1 block text-sm text-muted">Monthly Rent (ZAR)</label><input type="number" value={form.monthlyRent} onChange={(e) => setForm({ ...form, monthlyRent: Number(e.target.value) })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-md border border-border-color px-3 py-2 text-sm">Cancel</button>
            <button type="button" onClick={onSave} disabled={saving} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={onDelete} title="Delete Property" message={`Delete "${deleteTarget?.name}"? This cannot be undone.`} confirmLabel="Delete" loading={deleting} />
    </ModulePage>
  );
}
