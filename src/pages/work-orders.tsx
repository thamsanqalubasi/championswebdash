import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { Modal, ConfirmDialog, SideDrawer } from "@/components/modal";
import { ImageGallery } from "@/components/image-gallery";
import { fetchWorkOrdersData } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { uploadFileToBucket } from "@/lib/storage";
import type { WorkOrderRow } from "@/lib/types";
import { Plus, Wrench, ClipboardList, Clock, Play, CheckCircle2, XCircle, RotateCcw, Trash, ChevronRight, AlertTriangle, User, Building, Calendar, DollarSign, Image as ImageIcon, Save, Upload, Eye, Pencil } from "lucide-react";
import { DataTableHeader, StatusBadge, TableRowActions, TableActionButton } from "@/components/data-table";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "NAD", maximumFractionDigits: 0 }).format(amount);
}

const emptyForm = { property_id: "", maintainer_id: "", description: "", category: "general", priority: "medium", status: "open", scheduled_date: "", estimated_cost: 0, actual_cost: 0 };

type WorkOrderDetail = {
  id: string;
  propertyName: string;
  providerName: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  scheduledDate: string;
  estimatedCost: number;
  actualCost: number;
  photos: string[];
  createdAt: string;
};

function formatDate(value: string) {
  if (!value || value === "-") return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "2-digit" });
}

export default function WorkOrdersPage() {
  const [workOrders, setWorkOrders] = useState<WorkOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WorkOrderRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [providers, setProviders] = useState<Array<{ id: string; name: string }>>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [details, setDetails] = useState<WorkOrderDetail | null>(null);
  const [detailsStatus, setDetailsStatus] = useState("open");
  const [statusSaving, setStatusSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true); setError(null);
      try {
        const result = await fetchWorkOrdersData();
        if (!cancelled) setWorkOrders(result);
        const [{ data: props }, { data: provs }] = await Promise.all([
          supabase.from("properties").select("id, name").order("name"),
          supabase.from("maintainers").select("id, name").order("name"),
        ]);
        if (!cancelled) {
          if (props) setProperties(props.map((p) => ({ id: String(p.id), name: String(p.name) })));
          if (provs) setProviders(provs.map((p) => ({ id: String(p.id), name: String(p.name) })));
        }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load work orders."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void loadData();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const reload = () => setReloadKey((v) => v + 1);

  const counts = useMemo(() => ({
    all: workOrders.length,
    open: workOrders.filter((i) => i.status === "open").length,
    in_progress: workOrders.filter((i) => i.status === "in_progress").length,
    completed: workOrders.filter((i) => i.status === "completed").length,
    cancelled: workOrders.filter((i) => i.status === "cancelled").length,
  }), [workOrders]);

  const filtered = useMemo(() => {
    let result = activeFilter === "all" ? workOrders : workOrders.filter((w) => w.status === activeFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((w) =>
        w.propertyName.toLowerCase().includes(q) ||
        w.providerName.toLowerCase().includes(q) ||
        w.category.toLowerCase().includes(q)
      );
    }
    return result;
  }, [workOrders, activeFilter, searchQuery]);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setModalOpen(true); };

  const openEdit = async (workOrderId: string) => {
    try {
      const { data, error: detailError } = await supabase
        .from("maintenance")
        .select("id, property_id, maintainer_id, description, category, priority, status, scheduled_date, estimated_cost, actual_cost")
        .eq("id", workOrderId)
        .single();

      if (detailError) throw detailError;

      setEditingId(String(data.id));
      setForm({
        property_id: String(data.property_id ?? ""),
        maintainer_id: String(data.maintainer_id ?? ""),
        description: String(data.description ?? ""),
        category: String(data.category ?? "general"),
        priority: String(data.priority ?? "medium"),
        status: String(data.status ?? "open"),
        scheduled_date: String(data.scheduled_date ?? ""),
        estimated_cost: Number(data.estimated_cost ?? 0),
        actual_cost: Number(data.actual_cost ?? 0),
      });
      setModalOpen(true);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not load work order for editing.");
    }
  };

  const onSave = async () => {
    if (!form.description.trim()) { alert("Please enter a description."); return; }
    if (!editingId && !form.property_id) { alert("Please select a property."); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { description: form.description, category: form.category, priority: form.priority, status: form.status, scheduled_date: form.scheduled_date || null, estimated_cost: form.estimated_cost, actual_cost: form.actual_cost };
      if (form.property_id) payload.property_id = form.property_id;
      if (form.maintainer_id) payload.maintainer_id = form.maintainer_id;
      if (editingId) {
        const { error: err } = await supabase.from("maintenance").update(payload).eq("id", editingId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("maintenance").insert(payload);
        if (err) throw err;
      }
      setModalOpen(false); reload();
    } catch (e) { alert(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  };

  const onStatusChange = async (id: string, newStatus: string) => {
    const { error: err } = await supabase.from("maintenance").update({ status: newStatus }).eq("id", id);
    if (err) { alert(err.message); return; }
    reload();
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error: err } = await supabase.from("maintenance").delete().eq("id", deleteTarget.id);
      if (err) throw err;
      setDeleteTarget(null); reload();
    } catch (e) { alert(e instanceof Error ? e.message : "Delete failed"); }
    finally { setDeleting(false); }
  };

  const openWorkOrderDetails = async (workOrderId: string) => {
    setDetailsOpen(true);
    setDetailsLoading(true);
    setDetailsError(null);

    try {
      const { data, error: detailError } = await supabase
        .from("maintenance")
        .select(
          "id, description, category, priority, status, scheduled_date, estimated_cost, actual_cost, photos, created_at, properties(name), maintainers(name)",
        )
        .eq("id", workOrderId)
        .single();

      if (detailError) throw detailError;

      const detail: WorkOrderDetail = {
        id: String(data.id ?? ""),
        propertyName: String((data.properties as { name?: string } | null)?.name ?? "Unassigned"),
        providerName: String((data.maintainers as { name?: string } | null)?.name ?? "Unassigned"),
        description: String(data.description ?? ""),
        category: String(data.category ?? "general"),
        priority: String(data.priority ?? "medium"),
        status: String(data.status ?? "open"),
        scheduledDate: String(data.scheduled_date ?? "-"),
        estimatedCost: Number(data.estimated_cost ?? 0),
        actualCost: Number(data.actual_cost ?? 0),
        photos: Array.isArray(data.photos) ? data.photos.map((item) => String(item)) : [],
        createdAt: String(data.created_at ?? "-"),
      };

      setDetails(detail);
      setDetailsStatus(detail.status);
    } catch (loadError) {
      setDetailsError(loadError instanceof Error ? loadError.message : "Could not load work order details.");
    } finally {
      setDetailsLoading(false);
    }
  };

  const saveDetailsStatus = async () => {
    if (!details) return;
    setStatusSaving(true);
    try {
      const { error: updateError } = await supabase
        .from("maintenance")
        .update({ status: detailsStatus })
        .eq("id", details.id);
      if (updateError) throw updateError;

      await openWorkOrderDetails(details.id);
      reload();
    } catch (saveError) {
      alert(saveError instanceof Error ? saveError.message : "Could not update status.");
    } finally {
      setStatusSaving(false);
    }
  };

  const uploadWorkOrderPhoto = async (file: File | null) => {
    if (!file || !details) return;
    setPhotoUploading(true);
    try {
      const photoUrl = await uploadFileToBucket("maintenance-photos", details.id, file);
      const updatedPhotos = [...details.photos, photoUrl];
      const { error: updateError } = await supabase.from("maintenance").update({ photos: updatedPhotos }).eq("id", details.id);
      if (updateError) throw updateError;
      setDetails({ ...details, photos: updatedPhotos });
    } catch (uploadError) {
      alert(uploadError instanceof Error ? uploadError.message : "Could not upload photo.");
    } finally {
      setPhotoUploading(false);
    }
  };

  const [deletingPhoto, setDeletingPhoto] = useState(false);

  const deleteWorkOrderPhoto = async (index: number) => {
    if (!details) return;
    setDeletingPhoto(true);
    try {
      const updatedPhotos = details.photos.filter((_, i) => i !== index);
      const { error: updateError } = await supabase.from("maintenance").update({ photos: updatedPhotos }).eq("id", details.id);
      if (updateError) throw updateError;
      setDetails({ ...details, photos: updatedPhotos });
      if (index >= updatedPhotos.length && updatedPhotos.length > 0) {
        setGalleryIndex(updatedPhotos.length - 1);
      }
      if (updatedPhotos.length === 0) {
        setGalleryOpen(false);
      }
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : "Could not delete photo.");
    } finally {
      setDeletingPhoto(false);
    }
  };

  const openGallery = (index: number) => {
    setGalleryIndex(index);
    setGalleryOpen(true);
  };

  const filterTabs = [
    { key: "all", label: "All", count: counts.all },
    { key: "open", label: "Open", count: counts.open },
    { key: "in_progress", label: "In Progress", count: counts.in_progress },
    { key: "completed", label: "Completed", count: counts.completed },
    { key: "cancelled", label: "Cancelled", count: counts.cancelled },
  ];

  const getPriorityColor = (p: string) => {
    switch (p.toLowerCase()) {
      case "urgent": return "text-red-600";
      case "high": return "text-amber-600";
      case "medium": return "text-foreground";
      case "low": return "text-muted";
      default: return "text-muted";
    }
  };

  return (
    <ModulePage title="Work Orders" description="Track and manage maintenance requests and ticket statuses.">
      {loading && <LoadingState label="Loading work orders..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (
        <section className="rounded-xl border border-border-color bg-surface p-1">
          <div className="p-4">
            <DataTableHeader
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search work orders by property, provider, or category..."
              filters={filterTabs}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              actions={
                <button
                  type="button"
                  onClick={openAdd}
                  className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-surface hover:opacity-90 transition-all"
                >
                  <Plus size={16} />
                  <span>Create Work Order</span>
                </button>
              }
            />
          </div>

          {filtered.length === 0 ? (
            <div className="p-12">
              <EmptyState title="No work orders found" description={searchQuery ? "Try a different search term or filter." : "Create a work order to get started."} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border-color text-left text-muted/60 uppercase text-[10px] font-bold tracking-wider">
                    <th className="px-6 py-4 font-bold">Ticket Details</th>
                    <th className="px-6 py-4 font-bold">Category</th>
                    <th className="px-6 py-4 font-bold text-center">Priority</th>
                    <th className="px-6 py-4 font-bold text-center">Status</th>
                    <th className="px-6 py-4 font-bold">Scheduled</th>
                    <th className="px-6 py-4 font-bold text-right">Cost (Est/Act)</th>
                    <th className="px-6 py-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color/40">
                  {filtered.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => void openWorkOrderDetails(row.id)}
                      className="group cursor-pointer hover:bg-surface-elevated/40 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/5 group-hover:bg-foreground group-hover:text-surface transition-all">
                            <Wrench size={20} className="text-muted/60 group-hover:text-current" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold tracking-tight text-foreground truncate">{row.propertyName}</p>
                            <p className="text-xs text-muted truncate">{row.providerName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-muted/80">
                          <ClipboardList size={14} />
                          <span className="capitalize">{row.category}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className={`flex items-center justify-center gap-1.5 text-xs font-bold uppercase tracking-wider ${getPriorityColor(row.priority)}`}>
                          {row.priority === "urgent" && <AlertTriangle size={12} />}
                          <span>{row.priority}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1.5 text-xs text-muted">
                          <Clock size={14} />
                          <span>{row.scheduledDate}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="space-y-0.5">
                          <p className="text-xs text-muted font-medium">Est: {formatCurrency(row.estimatedCost)}</p>
                          <p className="text-sm font-bold text-foreground">Act: {formatCurrency(row.actualCost)}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <TableRowActions>
                          <TableActionButton
                            icon={Pencil}
                            label="Edit"
                            onClick={(e) => { e.stopPropagation(); void openEdit(row.id); }}
                          />
                          {row.status === "open" && (
                            <TableActionButton
                              icon={Play}
                              label="Start"
                              onClick={(e) => { e.stopPropagation(); onStatusChange(row.id, "in_progress"); }}
                              variant="success"
                            />
                          )}
                          {(row.status === "open" || row.status === "in_progress") && (
                            <TableActionButton
                              icon={CheckCircle2}
                              label="Complete"
                              onClick={(e) => { e.stopPropagation(); onStatusChange(row.id, "completed"); }}
                              variant="success"
                            />
                          )}
                          {(row.status === "completed" || row.status === "cancelled") && (
                            <TableActionButton
                              icon={RotateCcw}
                              label="Reopen"
                              onClick={(e) => { e.stopPropagation(); onStatusChange(row.id, "open"); }}
                            />
                          )}
                          {row.status !== "cancelled" && row.status !== "completed" && (
                            <TableActionButton
                              icon={XCircle}
                              label="Cancel"
                              onClick={(e) => { e.stopPropagation(); onStatusChange(row.id, "cancelled"); }}
                              variant="danger"
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
              Showing {filtered.length} of {counts.all} tickets
            </p>
          </div>
        </section>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit Work Order" : "Create Work Order"}>
        <div className="space-y-3">
          <div><label className="mb-1 block text-sm text-muted">Property</label><select value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
            <option value="">Select property...</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></div>
          <div><label className="mb-1 block text-sm text-muted">Provider</label><select value={form.maintainer_id} onChange={(e) => setForm({ ...form, maintainer_id: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
            <option value="">Select provider...</option>{providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></div>
          <div><label className="mb-1 block text-sm text-muted">Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm text-muted">Category</label><select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
              <option value="plumbing">Plumbing</option><option value="electrical">Electrical</option><option value="structural">Structural</option><option value="appliance">Appliance</option><option value="hvac">HVAC</option><option value="pest_control">Pest Control</option><option value="painting">Painting</option><option value="landscaping">Landscaping</option><option value="general">General</option>
            </select></div>
            <div><label className="mb-1 block text-sm text-muted">Priority</label><select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
              <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
            </select></div>
          </div>
          <div><label className="mb-1 block text-sm text-muted">Scheduled Date</label><input type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm text-muted">Estimated Cost (NAD)</label><input type="number" value={form.estimated_cost} onChange={(e) => setForm({ ...form, estimated_cost: Number(e.target.value) })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
            <div><label className="mb-1 block text-sm text-muted">Actual Cost (NAD)</label><input type="number" value={form.actual_cost} onChange={(e) => setForm({ ...form, actual_cost: Number(e.target.value) })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-md border border-border-color px-3 py-2 text-sm">Cancel</button>
            <button type="button" onClick={onSave} disabled={saving} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={onDelete} title="Delete Work Order" message={`Delete this work order at "${deleteTarget?.propertyName}"? This cannot be undone.`} confirmLabel="Delete" loading={deleting} />

      <SideDrawer open={detailsOpen} onClose={() => setDetailsOpen(false)} title="Maintenance Work Order Details">
        {detailsLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <LoadingState label="Retreiving ticket details..." />
          </div>
        )}

        {!detailsLoading && detailsError && (
          <ErrorState message={detailsError} onRetry={() => (details ? void openWorkOrderDetails(details.id) : undefined)} />
        )}

        {!detailsLoading && !detailsError && details && (
          <div className="space-y-8 pb-10">
            {/* Ticket Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-surface-elevated/50 p-6 rounded-2xl ring-1 ring-border-color/50 shadow-sm">
              <div className="flex items-center gap-4">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-lg ${
                  details.priority === "urgent" ? "bg-red-600 text-white" : "bg-foreground text-surface"
                }`}>
                  <Wrench size={28} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xl font-bold tracking-tight text-foreground capitalize">{details.category} Ticket</h4>
                    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-widest ${
                      details.priority === "urgent" ? "bg-red-100 text-red-700" : "bg-muted/10 text-muted"
                    }`}>
                      {details.priority}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <StatusBadge status={details.status} />
                    <span className="text-xs text-muted font-medium">#{details.id.slice(0, 8)}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted/60">Actual Cost</p>
                <p className="text-2xl font-black text-foreground">{formatCurrency(details.actualCost)}</p>
              </div>
            </div>

            {/* Main Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <section className="space-y-4">
                  <h5 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted/40 px-1">Location & Provider</h5>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="p-4 rounded-xl border border-border-color bg-surface-elevated/30">
                      <div className="flex items-center gap-3">
                        <Building size={16} className="text-muted/40" />
                        <div>
                          <p className="text-[10px] font-bold text-muted/60 uppercase">Property</p>
                          <p className="font-bold text-foreground">{details.propertyName}</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 rounded-xl border border-border-color bg-surface-elevated/30">
                      <div className="flex items-center gap-3">
                        <User size={16} className="text-muted/40" />
                        <div>
                          <p className="text-[10px] font-bold text-muted/60 uppercase">Maintainer</p>
                          <p className="font-bold text-foreground">{details.providerName}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h5 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted/40 px-1">Timestamps</h5>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-border-color bg-surface-elevated/30">
                      <Calendar size={16} className="text-muted/40 mb-2" />
                      <p className="text-[10px] font-bold text-muted/60 uppercase">Scheduled</p>
                      <p className="font-bold text-foreground">{formatDate(details.scheduledDate)}</p>
                    </div>
                    <div className="p-4 rounded-xl border border-border-color bg-surface-elevated/30">
                      <Clock size={16} className="text-muted/40 mb-2" />
                      <p className="text-[10px] font-bold text-muted/60 uppercase">Created</p>
                      <p className="font-bold text-foreground">{formatDate(details.createdAt)}</p>
                    </div>
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <section className="space-y-4">
                  <h5 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted/40 px-1">Financial Data</h5>
                  <div className="p-6 rounded-2xl bg-foreground text-surface shadow-lg relative overflow-hidden group">
                    <DollarSign size={64} className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform" />
                    <div className="relative z-10">
                      <p className="text-xs font-bold uppercase tracking-wider text-surface/60">Estimated Budget</p>
                      <p className="text-3xl font-black mt-1">{formatCurrency(details.estimatedCost)}</p>
                      <div className="mt-6 pt-6 border-t border-surface/20">
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span className="text-surface/60 uppercase">Variance</span>
                          <span className={details.actualCost > details.estimatedCost ? "text-red-400" : "text-green-400"}>
                            {formatCurrency(details.estimatedCost - details.actualCost)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h5 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted/40 px-1">Ticket Workflow</h5>
                  <div className="p-4 rounded-xl border border-border-color bg-surface-elevated/30 space-y-3">
                    <label className="text-[10px] font-bold text-muted/60 uppercase">Current Status</label>
                    <div className="flex gap-2">
                      <select
                        value={detailsStatus}
                        onChange={(event) => setDetailsStatus(event.target.value)}
                        className="flex-1 rounded-lg border border-border-color bg-surface px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-foreground/5"
                      >
                        <option value="open">Open</option>
                        <option value="in_progress">In progress</option>
                        <option value="completed">Completed</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                      <button
                        type="button"
                        onClick={saveDetailsStatus}
                        disabled={statusSaving}
                        className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-bold text-surface hover:opacity-90 transition-all disabled:opacity-50 shadow-md"
                      >
                        <Save size={16} />
                        <span>Update</span>
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {/* Description Section */}
            <section className="space-y-3">
              <h5 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted/40 px-1">Problem Description</h5>
              <div className="p-6 rounded-2xl border border-border-color bg-surface-elevated/20 italic text-foreground leading-relaxed">
                "{details.description || "No detailed description provided."}"
              </div>
            </section>

            {/* Evidence Gallery */}
            <section className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <ImageIcon size={16} className="text-muted/40" />
                  <h5 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted/40">Evidence Gallery</h5>
                </div>
                <label className="cursor-pointer flex items-center gap-2 rounded-lg bg-surface-elevated border border-border-color px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted hover:text-foreground transition-all">
                  <Upload size={12} />
                  <span>{photoUploading ? "Uploading..." : "Add Picture"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => void uploadWorkOrderPhoto(event.target.files?.[0] ?? null)}
                    className="hidden"
                    disabled={photoUploading}
                  />
                </label>
              </div>

              {details.photos.length === 0 ? (
                <div className="p-12 border-2 border-dashed border-border-color rounded-2xl text-center">
                  <p className="text-xs text-muted">No visual evidence attached yet.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {details.photos.map((photoUrl, idx) => (
                    <button key={photoUrl} type="button" onClick={() => openGallery(idx)} className="aspect-video overflow-hidden rounded-xl border border-border-color bg-surface-elevated group relative shadow-sm">
                      <img src={photoUrl} alt="Evidence" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Eye size={20} className="text-white" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
        <ImageGallery images={details?.photos ?? []} currentIndex={galleryIndex} open={galleryOpen} onClose={() => setGalleryOpen(false)} onNavigate={setGalleryIndex} onDelete={deleteWorkOrderPhoto} deleting={deletingPhoto} />
      </SideDrawer>
    </ModulePage>
  );
}
