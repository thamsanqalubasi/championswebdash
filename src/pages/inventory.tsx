import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { Modal, ConfirmDialog, SideDrawer } from "@/components/modal";
import { fetchInventoryData, isValidUuid } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { InventoryItemRow } from "@/lib/types";

import { 
  Plus, 
  Search, 
  Package, 
  AlertTriangle, 
  DollarSign, 
  PlusCircle, 
  Pencil, 
  Trash, 
  Download,
  Boxes,
  MapPin,
  Truck,
  ChevronRight,
  RefreshCw,
  Tag
} from "lucide-react";
import { DataTableHeader, StatusBadge, TableRowActions, TableActionButton } from "@/components/data-table";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "NAD", maximumFractionDigits: 0 }).format(amount);
}

const emptyForm = { name: "", category: "general", quantity: 0, unit: "pcs", min_stock_level: 0, unit_cost: 0, supplier: "", location: "" };

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

export default function InventoryPage() {
  const { currentCompany } = useAuth();
  const [items, setItems] = useState<InventoryItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InventoryItemRow | null>(null);
  const [detailsRow, setDetailsRow] = useState<InventoryItemRow | null>(null);
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

  const totals = useMemo(() => ({
    all: items.length,
    low: items.filter((i) => i.quantity <= i.minStockLevel).length,
    inStock: items.filter((i) => i.quantity > i.minStockLevel).length,
    totalValue: items.reduce((sum, i) => sum + i.quantity * i.unitCost, 0)
  }), [items]);

  const filtered = useMemo(() => {
    let result = items;
    if (activeFilter === "low") result = items.filter((i) => i.quantity <= i.minStockLevel);
    if (activeFilter === "inStock") result = items.filter((i) => i.quantity > i.minStockLevel);
    
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q) || i.supplier.toLowerCase().includes(q));
    }
    return result;
  }, [items, activeFilter, searchQuery]);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (row: InventoryItemRow) => {
    setEditingId(row.id);
    setForm({ name: row.name, category: row.category, quantity: row.quantity, unit: row.unit, min_stock_level: row.minStockLevel, unit_cost: row.unitCost, supplier: row.supplier, location: row.location });
    setModalOpen(true);
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const compId = currentCompany?.id && isValidUuid(currentCompany.id) ? currentCompany.id : null;
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        category: form.category,
        quantity: form.quantity,
        unit: form.unit,
        min_stock_level: form.min_stock_level,
        unit_cost: form.unit_cost,
        supplier: form.supplier,
        location: form.location,
        company_id: compId,
      };
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

  const exportCsv = () => {
    const header = "Name,Category,Quantity,Unit,Min Stock,Unit Cost,Supplier,Location\n";
    const rows = filtered.map((r) => `"${r.name}","${r.category}",${r.quantity},"${r.unit}",${r.minStockLevel},${r.unitCost},"${r.supplier}","${r.location}"`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "inventory.csv";
    a.click();
  };

  const filterTabs = [
    { key: "all", label: "All Items", count: totals.all },
    { key: "low", label: "Low Stock", count: totals.low },
    { key: "inStock", label: "In Stock", count: totals.inStock },
  ];

  return (
    <ModulePage title="Maintenance Inventory" description="Track parts, supplies, and asset stock levels for maintenance operations.">
      {loading && <LoadingState label="Auditing warehouse stock..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Total Catalog" value={String(items.length)} detail="Unique items listed" icon={Boxes} />
            <StatCard label="Critical Alerts" value={String(totals.low)} detail="Items below min level" icon={AlertTriangle} colorClass={totals.low > 0 ? "text-red-600" : "text-foreground"} />
            <StatCard label="Asset Valuation" value={formatCurrency(totals.totalValue)} detail="Total market value" icon={DollarSign} colorClass="text-green-600" />
          </div>

          <section className="rounded-xl border border-border-color bg-surface p-1">
            <div className="p-4">
              <DataTableHeader
                searchValue={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search inventory by name, category or supplier..."
                filters={[
                  { key: "all", label: "All Items", count: totals.all },
                  { key: "low", label: "Low Stock", count: totals.low },
                  { key: "inStock", label: "In Stock", count: totals.inStock },
                ]}
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
                      <span>Add Item</span>
                    </button>
                  </>
                }
              />
            </div>

            {filtered.length === 0 ? (
              <div className="p-12">
                <EmptyState title="No items found" description={searchQuery ? "Try a different search term or filter." : "Add maintenance items to start tracking stock."} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border-color text-left text-muted/60 uppercase text-[10px] font-bold tracking-wider">
                      <th className="px-6 py-4 font-bold">Item Description</th>
                      <th className="px-6 py-4 font-bold">Category</th>
                      <th className="px-6 py-4 font-bold text-center">Availability</th>
                      <th className="px-6 py-4 font-bold text-right">Unit Cost</th>
                      <th className="px-6 py-4 font-bold text-right">Total Value</th>
                      <th className="px-6 py-4 font-bold">Supplier / Location</th>
                      <th className="px-6 py-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-color/40">
                    {filtered.map((row) => {
                      const isLow = row.quantity <= row.minStockLevel;
                      return (
                        <tr
                          key={row.id}
                          onClick={() => setDetailsRow(row)}
                          className="group cursor-pointer hover:bg-surface-elevated/40 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/5 group-hover:bg-foreground group-hover:text-surface transition-all">
                                <Package size={20} className="text-muted/60 group-hover:text-current" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold tracking-tight text-foreground truncate">{row.name}</p>
                                <p className="text-xs text-muted">Min Level: {row.minStockLevel} {row.unit}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 capitalize text-muted/80">{row.category}</td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col items-center gap-1">
                              <span className={`text-sm font-black ${isLow ? "text-red-600" : "text-foreground"}`}>
                                {row.quantity} {row.unit}
                              </span>
                              <StatusBadge status={isLow ? "low_stock" : "in_stock"} className="scale-90" />
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right font-medium text-foreground">{formatCurrency(row.unitCost)}</td>
                          <td className="px-6 py-4 text-right font-bold text-foreground">{formatCurrency(row.quantity * row.unitCost)}</td>
                          <td className="px-6 py-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                                <Truck size={12} className="text-muted" />
                                <span>{row.supplier || "Internal Store"}</span>
                              </div>
                              <div className="flex items-center gap-1.5 text-[10px] text-muted font-bold uppercase">
                                <MapPin size={10} />
                                <span>{row.location || "Main Depot"}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <TableRowActions>
                              <TableActionButton
                                icon={RefreshCw}
                                label="Restock"
                                onClick={(e) => { e.stopPropagation(); setRestockTarget(row); setRestockQty(0); }}
                                variant="success"
                              />
                              <TableActionButton
                                icon={Pencil}
                                label="Edit"
                                onClick={(e) => { e.stopPropagation(); openEdit(row); }}
                              />
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
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="border-t border-border-color/50 px-6 py-4 bg-surface-elevated/20">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted/40">
                Showing {filtered.length} of {items.length} unique catalog items
              </p>
            </div>
          </section>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit Item" : "Add Item"}>
        <div className="space-y-3">
          <div><label className="mb-1 block text-sm text-muted">Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm text-muted">Category</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
              <option value="tools">Tools</option><option value="plumbing">Plumbing</option><option value="electrical">Electrical</option><option value="hardware">Hardware</option><option value="paint">Paint</option><option value="cleaning">Cleaning</option><option value="safety">Safety</option><option value="appliance_parts">Appliance Parts</option><option value="general">General</option>
            </select></div>
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

      <SideDrawer open={!!detailsRow} onClose={() => setDetailsRow(null)} title="Inventory Item Details">
        {detailsRow && (
          <div className="space-y-4">
            <div className="text-sm text-muted">{detailsRow.name}</div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted">Category</p><p>{detailsRow.category}</p></div>
              <div><p className="text-xs text-muted">Quantity</p><p>{detailsRow.quantity} {detailsRow.unit}</p></div>
              <div><p className="text-xs text-muted">Min Stock</p><p>{detailsRow.minStockLevel}</p></div>
              <div><p className="text-xs text-muted">Unit Cost</p><p>{formatCurrency(detailsRow.unitCost)}</p></div>
              <div><p className="text-xs text-muted">Supplier</p><p>{detailsRow.supplier}</p></div>
              <div><p className="text-xs text-muted">Location</p><p>{detailsRow.location}</p></div>
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
