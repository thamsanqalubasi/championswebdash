import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { Modal, ConfirmDialog } from "@/components/modal";
import { fetchProvidersData } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { ProviderRow } from "@/lib/types";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(amount);
}

const emptyForm = { name: "", phone: "", specialization: "General", rate: 0 };

export default function ProvidersPage() {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProviderRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true); setError(null);
      try { const result = await fetchProvidersData(); if (!cancelled) setProviders(result); }
      catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load providers."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void loadData();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const reload = () => setReloadKey((v) => v + 1);

  const totals = useMemo(() => ({
    jobs: providers.reduce((s, r) => s + r.totalJobs, 0),
    paid: providers.reduce((s, r) => s + r.totalPaid, 0),
  }), [providers]);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (row: ProviderRow) => { setEditingId(row.id); setForm({ name: row.name, phone: row.phone, specialization: row.specialization, rate: row.rate }); setModalOpen(true); };

  const onSave = async () => {
    setSaving(true);
    try {
      const payload = { name: form.name, phone: form.phone, specialization: form.specialization, rate: form.rate };
      if (editingId) {
        const { error: err } = await supabase.from("maintainers").update(payload).eq("id", editingId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("maintainers").insert(payload);
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
      const { error: err } = await supabase.from("maintainers").delete().eq("id", deleteTarget.id);
      if (err) throw err;
      setDeleteTarget(null); reload();
    } catch (e) { alert(e instanceof Error ? e.message : "Delete failed"); }
    finally { setDeleting(false); }
  };

  return (
    <ModulePage title="Providers" description="Maintainer profiles, workload stats, and provider CRUD.">
      {loading && <LoadingState label="Loading providers..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (
        <section className="space-y-4 rounded-lg border border-border-color bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid gap-3 md:grid-cols-3 flex-1">
              <article className="rounded-md border border-border-color bg-surface-elevated p-3"><p className="text-xs text-muted">Providers</p><p className="mt-1 text-xl font-semibold">{providers.length}</p></article>
              <article className="rounded-md border border-border-color bg-surface-elevated p-3"><p className="text-xs text-muted">Total Jobs</p><p className="mt-1 text-xl font-semibold">{totals.jobs}</p></article>
              <article className="rounded-md border border-border-color bg-surface-elevated p-3"><p className="text-xs text-muted">Total Paid</p><p className="mt-1 text-xl font-semibold">{formatCurrency(totals.paid)}</p></article>
            </div>
            <button type="button" onClick={openAdd} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium">Add Provider</button>
          </div>
          {providers.length === 0 ? <EmptyState title="No providers found" description="Add a provider to get started." /> : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead><tr className="border-b border-border-color text-left text-muted">
                  <th className="px-3 py-2 font-medium">Provider</th><th className="px-3 py-2 font-medium">Phone</th><th className="px-3 py-2 font-medium">Specialization</th><th className="px-3 py-2 font-medium">Rate</th><th className="px-3 py-2 font-medium">Jobs</th><th className="px-3 py-2 font-medium">Paid</th><th className="px-3 py-2 font-medium">Actions</th>
                </tr></thead>
                <tbody>{providers.map((row) => (
                  <tr key={row.id} className="border-b border-border-color/60">
                    <td className="px-3 py-3 font-medium">{row.name}</td>
                    <td className="px-3 py-3 text-muted">{row.phone}</td>
                    <td className="px-3 py-3 text-muted">{row.specialization}</td>
                    <td className="px-3 py-3 text-muted">{formatCurrency(row.rate)}</td>
                    <td className="px-3 py-3 text-muted">{row.totalJobs}</td>
                    <td className="px-3 py-3 text-muted">{formatCurrency(row.totalPaid)}</td>
                    <td className="px-3 py-3"><div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => openEdit(row)} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Edit</button>
                      <button type="button" onClick={() => setDeleteTarget(row)} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Delete</button>
                    </div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit Provider" : "Add Provider"}>
        <div className="space-y-3">
          <div><label className="mb-1 block text-sm text-muted">Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div><label className="mb-1 block text-sm text-muted">Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div><label className="mb-1 block text-sm text-muted">Specialization</label><input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div><label className="mb-1 block text-sm text-muted">Rate (ZAR)</label><input type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: Number(e.target.value) })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-md border border-border-color px-3 py-2 text-sm">Cancel</button>
            <button type="button" onClick={onSave} disabled={saving} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={onDelete} title="Delete Provider" message={`Delete "${deleteTarget?.name}"? This cannot be undone.`} confirmLabel="Delete" loading={deleting} />
    </ModulePage>
  );
}
