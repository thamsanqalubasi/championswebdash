import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { Modal, ConfirmDialog, SideDrawer } from "@/components/modal";
import { fetchInventoryData, fetchSupplierContacts, saveSupplierContact, isValidUuid } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { COUNTRY_DIAL_CODES } from "./providers";
import type { InventoryItemRow, SupplierContact } from "@/lib/types";
import { uploadInventoryMedia } from "@/lib/storage";

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
  Tag, 
  Upload, 
  Image, 
  FileText,
  X
} from "lucide-react";
import { DataTableHeader, StatusBadge, TableRowActions, TableActionButton } from "@/components/data-table";

// formatCurrency is provided by useCurrency() hook inside the component

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
  const { format: formatCurrency } = useCurrency();
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [receiptPreview, setReceiptPreview] = useState<string>('');
  const [uploading, setUploading] = useState(false);

  // Suppliers state and quick-add
  const [suppliers, setSuppliers] = useState<SupplierContact[]>([]);
  const [isNewSupplierModalOpen, setIsNewSupplierModalOpen] = useState(false);
  const [newSupplierForm, setNewSupplierForm] = useState({
    supplierName: "",
    companyName: "",
    contactPerson: "",
    phone: "",
    phoneCode: "+264",
    email: "",
    address: "",
  });
  const [newSuppliedItems, setNewSuppliedItems] = useState<string[]>([]);
  const [newSuppliedItemInput, setNewSuppliedItemInput] = useState("");
  const [savingNewSupplier, setSavingNewSupplier] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        const [result, supList] = await Promise.all([
          fetchInventoryData(currentCompany?.id),
          fetchSupplierContacts(currentCompany?.id),
        ]);
        if (!cancelled) {
          setItems(result);
          setSuppliers(supList);
        }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load inventory."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [reloadKey, currentCompany?.id]);

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

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setPhotoFile(null); setReceiptFile(null); setPhotoPreview(''); setReceiptPreview(''); setModalOpen(true); };
  const openEdit = (row: InventoryItemRow) => {
    setEditingId(row.id);
    setForm({ name: row.name, category: row.category, quantity: row.quantity, unit: row.unit, min_stock_level: row.minStockLevel, unit_cost: row.unitCost, supplier: row.supplier, location: row.location });
    setPhotoFile(null);
    setReceiptFile(null);
    setPhotoPreview(row.photoUrl || '');
    setReceiptPreview(row.receiptUrl || '');
    setModalOpen(true);
  };

  const onSave = async () => {
    setSaving(true);
    setUploading(true);
    try {
      let uploadedPhotoUrl = photoPreview && !photoFile ? photoPreview : undefined;
      let uploadedReceiptUrl = receiptPreview && !receiptFile ? receiptPreview : undefined;

      try {
        if (photoFile) uploadedPhotoUrl = await uploadInventoryMedia('inventory', photoFile, 'picture');
      } catch (err) {
        console.error("Failed to upload photo", err);
      }
      try {
        if (receiptFile) uploadedReceiptUrl = await uploadInventoryMedia('inventory', receiptFile, 'receipt');
      } catch (err) {
        console.error("Failed to upload receipt", err);
      }

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

      if (uploadedPhotoUrl !== undefined) payload.photo_url = uploadedPhotoUrl;
      if (uploadedReceiptUrl !== undefined) payload.receipt_url = uploadedReceiptUrl;

      if (editingId) {
        const { error: err } = await supabase.from("maintenance_inventory").update(payload).eq("id", editingId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("maintenance_inventory").insert(payload);
        if (err) throw err;
      }
      setModalOpen(false); reload();
    } catch (e) { alert(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); setUploading(false); }
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
    setUploading(true);
    try {
      let uploadedReceiptUrl = undefined;
      try {
        if (receiptFile) uploadedReceiptUrl = await uploadInventoryMedia('inventory', receiptFile, 'receipt');
      } catch (err) {
        console.error("Failed to upload receipt", err);
      }
      
      const newQty = restockTarget.quantity + restockQty;
      const payload: Record<string, unknown> = { quantity: newQty };
      if (uploadedReceiptUrl) payload.receipt_url = uploadedReceiptUrl;
      
      const { error: err } = await supabase.from("maintenance_inventory").update(payload).eq("id", restockTarget.id);
      if (err) { alert(err.message); return; }
      setRestockTarget(null); setRestockQty(0); setReceiptFile(null); setReceiptPreview(''); reload();
    } finally {
      setUploading(false);
    }
  };

  const addSuppliedItemToQuickAdd = () => {
    const trimmed = newSuppliedItemInput.trim();
    if (!trimmed) return;
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length > 30) {
      alert("Supplied item description cannot exceed 30 words.");
      return;
    }
    if (newSuppliedItems.length >= 10) {
      alert("A supplier can have a maximum of 10 supplied items.");
      return;
    }
    setNewSuppliedItems((prev) => [...prev, trimmed]);
    setNewSuppliedItemInput("");
  };

  const handleQuickAddSupplier = async () => {
    if (!newSupplierForm.supplierName.trim()) {
      alert("Supplier name is required.");
      return;
    }
    setSavingNewSupplier(true);
    try {
      const compId = currentCompany?.id && isValidUuid(currentCompany.id) ? currentCompany.id : null;
      const fullPhone = newSupplierForm.phone.trim()
        ? `${newSupplierForm.phoneCode} ${newSupplierForm.phone.trim()}`
        : "";
      const saved = await saveSupplierContact({
        companyId: compId || "",
        supplierName: newSupplierForm.supplierName.trim(),
        companyName: newSupplierForm.companyName.trim() || newSupplierForm.supplierName.trim(),
        contactPerson: newSupplierForm.contactPerson.trim(),
        phone: fullPhone,
        email: newSupplierForm.email.trim(),
        address: newSupplierForm.address.trim(),
        suppliedItems: newSuppliedItems,
      });

      setSuppliers((prev) => {
        const filtered = prev.filter((s) => s.id !== saved.id);
        return [saved, ...filtered];
      });

      setForm((prev) => ({ ...prev, supplier: saved.supplierName }));
      setIsNewSupplierModalOpen(false);
      setNewSupplierForm({
        supplierName: "",
        companyName: "",
        contactPerson: "",
        phone: "",
        phoneCode: "+264",
        email: "",
        address: "",
      });
      setNewSuppliedItems([]);
      setNewSuppliedItemInput("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to register supplier");
    } finally {
      setSavingNewSupplier(false);
    }
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
          {/* Sync notice banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 px-4 py-3 text-xs">
            <div className="flex items-center gap-2 text-foreground">
              <Package className="h-4 w-4 text-blue-600 shrink-0" />
              <span>
                <strong>Stores & Procurement Connected:</strong> All items added or updated here automatically sync and appear under <strong>Stores & Inventory</strong> (`/stores`).
              </span>
            </div>
            <Link
              to="/stores"
              className="text-blue-600 dark:text-blue-400 font-semibold hover:underline shrink-0"
            >
              Open Stores & Inventory &rarr;
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Total Items" value={String(totals.all)} detail="Catalog Items" icon={Package} />
            <StatCard label="In Stock" value={String(totals.inStock)} detail="Healthy Stock" icon={Boxes} colorClass="text-green-600" />
            <StatCard label="Low Stock" value={String(totals.low)} detail="Needs Restock" icon={AlertTriangle} colorClass={totals.low > 0 ? "text-amber-500" : "text-foreground"} />
            <StatCard label="Inventory Value" value={formatCurrency(totals.totalValue)} detail="Total Asset Value" icon={DollarSign} />
          </div>

          <section className="rounded-xl border border-border-color bg-surface p-1">
            <div className="p-4">
              <DataTableHeader
                searchValue={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search by item name, category, or supplier..."
                filters={[
                  { key: "all", label: "All Items", count: totals.all },
                  { key: "low", label: "Low Stock", count: totals.low },
                  { key: "inStock", label: "In Stock", count: totals.inStock },
                ]}
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                actions={
                  <div className="flex gap-2">
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
                  </div>
                }
              />
            </div>

            {filtered.length === 0 ? (
              <div className="p-12">
                <EmptyState title="No items found" description={searchQuery ? "Try a different search term or filter." : "Add your first inventory item to get started."} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border-color text-left text-muted/60 uppercase text-[10px] font-bold tracking-wider">
                      <th className="px-6 py-4 font-bold">Item Name</th>
                      <th className="px-6 py-4 font-bold">Category</th>
                      <th className="px-6 py-4 font-bold text-center">In Stock</th>
                      <th className="px-6 py-4 font-bold text-right">Unit Cost</th>
                      <th className="px-6 py-4 font-bold text-right">Total Value</th>
                      <th className="px-6 py-4 font-bold">Supplier</th>
                      <th className="px-6 py-4 font-bold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-color/40">
                    {filtered.map((row) => (
                      <tr
                        key={row.id}
                        onClick={() => setDetailsRow(row)}
                        className="group cursor-pointer hover:bg-surface-elevated/40 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/5 group-hover:bg-foreground group-hover:text-surface transition-all">
                              <Package size={18} className="text-muted/60 group-hover:text-current" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold tracking-tight text-foreground truncate">{row.name}</p>
                              <p className="text-[10px] font-bold text-muted/60 uppercase tracking-wider">{row.unit}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 capitalize text-muted font-medium">{row.category.replace(/_/g, " ")}</td>
                        <td className="px-6 py-4 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-bold ${
                              row.quantity <= row.minStockLevel ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" : "bg-muted/5 text-foreground"
                            }`}>
                              {row.quantity}
                            </span>
                            {row.quantity <= row.minStockLevel && (
                              <AlertTriangle size={14} className="text-amber-500 animate-pulse" />
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-foreground">{formatCurrency(row.unitCost)}</td>
                        <td className="px-6 py-4 text-right font-bold text-foreground">{formatCurrency(row.quantity * row.unitCost)}</td>
                        <td className="px-6 py-4 text-muted truncate max-w-[150px]">{row.supplier || "—"}</td>
                        <td className="px-6 py-4 text-right">
                          <TableRowActions>
                            <TableActionButton
                              icon={PlusCircle}
                              label="Restock"
                              onClick={(e) => { e.stopPropagation(); setRestockTarget(row); setRestockQty(1); }}
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
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="border-t border-border-color/50 px-6 py-4 bg-surface-elevated/20">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted/40">
                Showing {filtered.length} of {items.length} items
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
            <div>
              <label className="mb-1 block text-sm text-muted">Supplier</label>
              <select
                value={form.supplier}
                onChange={(e) => {
                  if (e.target.value === "__NEW__") {
                    setIsNewSupplierModalOpen(true);
                  } else {
                    setForm({ ...form, supplier: e.target.value });
                  }
                }}
                className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none"
              >
                <option value="">Select supplier...</option>
                <option value="__NEW__" className="font-bold text-sky-600">+ Add New Supplier (Not in system)</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.supplierName}>
                    {s.supplierName} {s.companyName && s.companyName !== s.supplierName ? `(${s.companyName})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div><label className="mb-1 block text-sm text-muted">Location</label><input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm text-muted">Item Photo</label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setPhotoFile(f);
                      setPhotoPreview(URL.createObjectURL(f));
                    }
                  }}
                  className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {photoPreview && (
                  <img src={photoPreview} alt="Preview" className="h-9 w-9 rounded-md object-cover border border-border-color shrink-0" />
                )}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted">Receipt / Invoice</label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setReceiptFile(f);
                      if (f.type.startsWith('image/')) {
                        setReceiptPreview(URL.createObjectURL(f));
                      } else {
                        setReceiptPreview('');
                      }
                    }
                  }}
                  className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
                {receiptPreview && (
                  <img src={receiptPreview} alt="Receipt" className="h-9 w-9 rounded-md object-cover border border-border-color shrink-0" />
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-md border border-border-color px-3 py-2 text-sm">Cancel</button>
            <button type="button" onClick={onSave} disabled={saving || uploading} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50">{(saving || uploading) ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </Modal>

      <Modal open={!!restockTarget} onClose={() => { setRestockTarget(null); setReceiptFile(null); setReceiptPreview(''); }} title={`Restock: ${restockTarget?.name ?? ""}`}>
        <div className="space-y-3">
          <p className="text-sm text-muted">Current quantity: <span className="font-medium">{restockTarget?.quantity}</span></p>
          <div><label className="mb-1 block text-sm text-muted">Add Quantity</label><input type="number" min={1} value={restockQty} onChange={(e) => setRestockQty(Number(e.target.value))} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          
          <div>
            <label className="mb-1 block text-sm text-muted">Receipt / Invoice (Optional)</label>
            <div className="flex items-center gap-2">
              <input
                type="file"
                accept="image/*,.pdf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setReceiptFile(f);
                    if (f.type.startsWith('image/')) {
                      setReceiptPreview(URL.createObjectURL(f));
                    } else {
                      setReceiptPreview('');
                    }
                  }
                }}
                className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none file:mr-4 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {receiptPreview && (
                <img src={receiptPreview} alt="Receipt" className="h-9 w-9 rounded-md object-cover border border-border-color shrink-0" />
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => { setRestockTarget(null); setReceiptFile(null); setReceiptPreview(''); }} className="rounded-md border border-border-color px-3 py-2 text-sm">Cancel</button>
            <button type="button" onClick={onRestock} disabled={restockQty <= 0 || uploading} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50">{uploading ? "Saving..." : "Add Stock"}</button>
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

      <Modal open={isNewSupplierModalOpen} onClose={() => setIsNewSupplierModalOpen(false)} title="Register New Supplier">
        <div className="space-y-3 max-h-[80vh] overflow-y-auto pr-1 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-semibold text-muted">Supplier / Business Name *</label>
              <input
                value={newSupplierForm.supplierName}
                onChange={(e) => setNewSupplierForm({ ...newSupplierForm, supplierName: e.target.value })}
                placeholder="e.g. Apex Industrial Supplies"
                className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/5"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Registered Company Name</label>
              <input
                value={newSupplierForm.companyName}
                onChange={(e) => setNewSupplierForm({ ...newSupplierForm, companyName: e.target.value })}
                placeholder="e.g. Apex Holdings Ltd"
                className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/5"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Contact Person</label>
              <input
                value={newSupplierForm.contactPerson}
                onChange={(e) => setNewSupplierForm({ ...newSupplierForm, contactPerson: e.target.value })}
                placeholder="e.g. John Doe"
                className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/5"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Phone Number</label>
              <div className="flex gap-1.5">
                <select
                  value={newSupplierForm.phoneCode}
                  onChange={(e) => setNewSupplierForm({ ...newSupplierForm, phoneCode: e.target.value })}
                  className="rounded-md border border-border-color bg-surface-elevated px-2 py-2 text-xs font-semibold outline-none"
                >
                  {COUNTRY_DIAL_CODES.map((c) => (
                    <option key={c.code} value={c.code}>{c.code}</option>
                  ))}
                </select>
                <input
                  value={newSupplierForm.phone}
                  onChange={(e) => setNewSupplierForm({ ...newSupplierForm, phone: e.target.value })}
                  placeholder="81 234 5678"
                  className="flex-1 rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/5"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-muted">Email</label>
              <input
                type="email"
                value={newSupplierForm.email}
                onChange={(e) => setNewSupplierForm({ ...newSupplierForm, email: e.target.value })}
                placeholder="orders@supplier.com"
                className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/5"
              />
            </div>
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-semibold text-muted">Physical / Delivery Address</label>
              <input
                value={newSupplierForm.address}
                onChange={(e) => setNewSupplierForm({ ...newSupplierForm, address: e.target.value })}
                placeholder="123 Industrial Way, Warehouse 4"
                className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/5"
              />
            </div>
          </div>

          {/* Interactive Supplied Items List */}
          <div className="pt-2 border-t border-border-color">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-semibold text-muted">
                What They Supply ({newSuppliedItems.length}/10 items)
              </label>
              <span className="text-[10px] text-muted">Max 30 words per item</span>
            </div>
            <div className="flex gap-2">
              <input
                value={newSuppliedItemInput}
                onChange={(e) => setNewSuppliedItemInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addSuppliedItemToQuickAdd();
                  }
                }}
                placeholder="e.g. Copper pipes, valves, fittings"
                className="flex-1 rounded-md border border-border-color bg-surface-elevated px-3 py-1.5 text-xs outline-none"
              />
              <button
                type="button"
                onClick={addSuppliedItemToQuickAdd}
                disabled={newSuppliedItems.length >= 10 || !newSuppliedItemInput.trim()}
                className="rounded-md bg-foreground px-3 py-1.5 text-xs font-bold text-surface hover:opacity-90 disabled:opacity-50"
              >
                Add
              </button>
            </div>

            {newSuppliedItems.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {newSuppliedItems.map((item, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2.5 py-1 text-xs font-medium border border-blue-200 dark:border-blue-800"
                  >
                    <span>{item}</span>
                    <button
                      type="button"
                      onClick={() => setNewSuppliedItems(newSuppliedItems.filter((_, i) => i !== idx))}
                      className="hover:text-red-600 ml-0.5"
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border-color">
            <button
              type="button"
              onClick={() => setIsNewSupplierModalOpen(false)}
              className="rounded-md border border-border-color px-3 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleQuickAddSupplier}
              disabled={savingNewSupplier}
              className="rounded-md bg-foreground px-4 py-2 text-sm font-bold text-surface hover:opacity-90 disabled:opacity-50"
            >
              {savingNewSupplier ? "Saving..." : "Save & Select Supplier"}
            </button>
          </div>
        </div>
      </Modal>
    </ModulePage>
  );
}


