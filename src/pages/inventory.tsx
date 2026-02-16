import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { Modal, ConfirmDialog } from "@/components/modal";
import { fetchInventoryData } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { InventoryItemRow } from "@/lib/types";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(amount);
}

const emptyForm = { name: "", category: "General", quantity: 0, unit: "pcs", min_stock_level: 0, unit_cost: 0, supplier: "", location: "" };

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeFilter, setActiveFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItemRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [restockTarget, setRestockTarget] = useState<InventoryItemRow | null>(null);
  const [restockQty, setRestockQty] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        const result = await fetchInventoryData();
        if (!cancelled) setItems(result);
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load inventory."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const reload = () => setReloadKey((v) => v + 1);

  const counts = useMemo(() => ({
    all: items.length,
    low: items.filter((i) => i.quantity <= i.minStockLevel).length,
    inStock: items.filter((i) => i.quantity > i.minStockLevel).length,
  }), [items]);

  const filtered = useMemo(() => {
    if (activeFilter === "low") return items.filter((i) => i.quantity <= i.minStockLevel);
    if (activeFilter === "inStock") return items.filter((i) => i.quantity > i.minStockLevel);
    return items;
  }, [items, activeFilter]);

  const totalValue = useMemo(() => items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0), [items]);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (row: InventoryItemRow) => {
    setEditingId(row.id);
    setForm({ name: row.name, category: row.category, quantity: row.quantity, unit: row.unit, min_stock_level: row.minStockLevel, unit_cost: row.unitCost, supplier: row.supplier, location: row.location });
    setModalOpen(true);
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const payload = { name: form.name, category: form.category, quantity: form.quantity, unit: form.unit, min_stock_level: form.min_stock_level, unit_cost: form.unit_cost, supplier: form.supplier, location: form.location };
      if (editingId) {
        const { error: err } = await supabase.from("maintenance_inventory").update(payload).eq("id", editingId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("maintenance_inventory").insert(payload);
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
      const { error: err } = await supabase.from("maintenance_inventory").delete().eq("id", deleteTarget.id);
      if (err) throw err;
      setDeleteTarget(null); reload();
    } catch (e) { alert(e instanceof Error ? e.message : "Delete failed"); }
    finally { setDeleting(false); }
  };

  const onRestock = async () => {
    if (!restockTarget || restockQty <= 0) return;
    const newQty = restockTarget.quantity + restockQty;
    const { error: err } = await supabase.from("maintenance_inventory").update({ quantity: newQty }).eq("id", restockTarget.id);
    if (err) { alert(err.message); return; }
    setRestockTarget(null); setRestockQty(0); reload();
  };

  return (
    <ModulePage title="Inventory" description="Track maintenance parts, supplies, and stock levels.">
      {loading && <LoadingState label="Loading inventory..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (
        <section className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border-color bg-surface p-4"><p className="text-sm text-muted">Total Items</p><p className="text-2xl font-bold">{items.length}</p></div>
            <div className="rounded-lg border border-border-color bg-surface p-4"><p className="text-sm text-muted">Low Stock</p><p className="text-2xl font-bold text-red-500">{counts.low}</p></div>
            <div className="rounded-lg border border-border-color bg-surface p-4"><p className="text-sm text-muted">Total Value</p><p className="text-2xl font-bold">{formatCurrency(totalValue)}</p></div>
          </div>

          <div className="rounded-lg border border-border-color bg-surface p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {([["all", "All"], ["low", "Low Stock"], ["inStock", "In Stock"]] as const).map(([key, label]) => (
                  <button key={key} type="button" onClick={() => setActiveFilter(key)}
                    className={`rounded-md border border-border-color px-3 py-2 text-sm ${activeFilter === key ? "bg-surface-elevated font-medium" : "text-muted"}`}>
                    {label} ({counts[key]})
                  </button>
                ))}
              </div>
              <button type="button" onClick={openAdd} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium">Add Item</button>
            </div>

            {filtered.length === 0 ? <EmptyState title="No inventory items" description="Add an item to get started." /> : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead><tr className="border-b border-border-color text-left text-muted">
                    <th className="px-3 py-2 font-medium">Name</th><th className="px-3 py-2 font-medium">Category</th><th className="px-3 py-2 font-medium">Qty</th><th className="px-3 py-2 font-medium">Unit</th><th className="px-3 py-2 font-medium">Min Stock</th><th className="px-3 py-2 font-medium">Unit Cost</th><th className="px-3 py-2 font-medium">Value</th><th className="px-3 py-2 font-medium">Supplier</th><th className="px-3 py-2 font-medium">Actions</th>
                  </tr></thead>
                  <tbody>{filtered.map((row) => {
                    const isLow = row.quantity <= row.minStockLevel;
                    return (
                      <tr key={row.id} className="border-b border-border-color/60">
                        <td className="px-3 py-3 font-medium">{row.name}</td>
                        <td className="px-3 py-3 text-muted">{row.category}</td>
                        <td className={`px-3 py-3 ${isLow ? "font-semibold text-red-500" : "text-muted"}`}>{row.quantity}</td>
                        <td className="px-3 py-3 text-muted">{row.unit}</td>
                        <td className="px-3 py-3 text-muted">{row.minStockLevel}</td>
                        <td className="px-3 py-3 text-muted">{formatCurrency(row.unitCost)}</td>
                        <td className="px-3 py-3 text-muted">{formatCurrency(row.quantity * row.unitCost)}</td>
                        <td className="px-3 py-3 text-muted">{row.supplier}</td>
                        <td className="px-3 py-3"><div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => { setRestockTarget(row); setRestockQty(0); }} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Restock</button>
                          <button type="button" onClick={() => openEdit(row)} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Edit</button>
                          <button type="button" onClick={() => setDeleteTarget(row)} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Delete</button>
                        </div></td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit Item" : "Add Item"}>
        <div className="space-y-3">
          <div><label className="mb-1 block text-sm text-muted">Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm text-muted">Category</label><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
            <div><label className="mb-1 block text-sm text-muted">Unit</label><input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="mb-1 block text-sm text-muted">Quantity</label><input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
            <div><label className="mb-1 block text-sm text-muted">Min Stock</label><input type="number" value={form.min_stock_level} onChange={(e) => setForm({ ...form, min_stock_level: Number(e.target.value) })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
            <div><label className="mb-1 block text-sm text-muted">Unit Cost</label><input type="number" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: Number(e.target.value) })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm text-muted">Supplier</label><input value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
            <div><label className="mb-1 block text-sm text-muted">Location</label><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-md border border-border-color px-3 py-2 text-sm">Cancel</button>
            <button type="button" onClick={onSave} disabled={saving} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!restockTarget} onClose={() => setRestockTarget(null)} title={`Restock: ${restockTarget?.name ?? ""}`}>
        <div className="space-y-3">
          <p className="text-sm text-muted">Current quantity: <span className="font-medium">{restockTarget?.quantity}</span></p>
          <div><label className="mb-1 block text-sm text-muted">Add Quantity</label><input type="number" min={1} value={restockQty} onChange={(e) => setRestockQty(Number(e.target.value))} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setRestockTarget(null)} className="rounded-md border border-border-color px-3 py-2 text-sm">Cancel</button>
            <button type="button" onClick={onRestock} disabled={restockQty <= 0} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50">Add Stock</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={onDelete} title="Delete Item" message={`Delete "${deleteTarget?.name}"?`} confirmLabel="Delete" loading={deleting} />
    </ModulePage>
  );
}
