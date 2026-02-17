import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { Modal, ConfirmDialog, SideDrawer } from "@/components/modal";
import { ImageGallery } from "@/components/image-gallery";
import { fetchWorkOrdersData } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { uploadFileToBucket } from "@/lib/storage";
import type { WorkOrderRow } from "@/lib/types";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(amount);
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

  const filtered = useMemo(() => activeFilter === "all" ? workOrders : workOrders.filter((w) => w.status === activeFilter), [workOrders, activeFilter]);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setModalOpen(true); };

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

  const openGallery = (index: number) => {
    setGalleryIndex(index);
    setGalleryOpen(true);
  };

  return (
    <ModulePage title="Work Orders" description="Ticket table, filters, and status transitions.">
      {loading && <LoadingState label="Loading work orders..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (
        <section className="space-y-4 rounded-lg border border-border-color bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {(["all", "open", "in_progress", "completed", "cancelled"] as const).map((key) => (
                <button key={key} type="button" onClick={() => setActiveFilter(key)}
                  className={`rounded-md border border-border-color px-3 py-2 text-sm ${activeFilter === key ? "bg-surface-elevated font-medium" : "text-muted"}`}>
                  {key === "all" ? `All (${counts.all})` : `${key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())} (${counts[key]})`}
                </button>
              ))}
            </div>
            <button type="button" onClick={openAdd} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium">Create Work Order</button>
          </div>
          {filtered.length === 0 ? <EmptyState title="No work orders found" description="Create a work order to get started." /> : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead><tr className="border-b border-border-color text-left text-muted">
                  <th className="px-3 py-2 font-medium">Property</th><th className="px-3 py-2 font-medium">Provider</th><th className="px-3 py-2 font-medium">Category</th><th className="px-3 py-2 font-medium">Priority</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Scheduled</th><th className="px-3 py-2 font-medium">Cost (Est/Act)</th><th className="px-3 py-2 font-medium">Actions</th>
                </tr></thead>
                <tbody>{filtered.map((row) => (
                  <tr key={row.id} onClick={() => void openWorkOrderDetails(row.id)} className="cursor-pointer border-b border-border-color/60 hover:bg-surface-elevated/40">
                    <td className="px-3 py-3 font-medium">{row.propertyName}</td>
                    <td className="px-3 py-3 text-muted">{row.providerName}</td>
                    <td className="px-3 py-3 text-muted">{row.category}</td>
                    <td className="px-3 py-3 text-muted capitalize">{row.priority}</td>
                    <td className="px-3 py-3"><span className="rounded-full border border-border-color bg-surface-elevated px-2 py-1 text-xs text-muted capitalize">{row.status.replace(/_/g, " ")}</span></td>
                    <td className="px-3 py-3 text-muted">{row.scheduledDate}</td>
                    <td className="px-3 py-3 text-muted">{formatCurrency(row.estimatedCost)} / {formatCurrency(row.actualCost)}</td>
                    <td className="px-3 py-3"><div className="flex flex-wrap gap-2">
                      {row.status === "open" && <button type="button" onClick={(event) => { event.stopPropagation(); onStatusChange(row.id, "in_progress"); }} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Start</button>}
                      {(row.status === "open" || row.status === "in_progress") && <button type="button" onClick={(event) => { event.stopPropagation(); onStatusChange(row.id, "completed"); }} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Complete</button>}
                      {(row.status === "completed" || row.status === "cancelled") && <button type="button" onClick={(event) => { event.stopPropagation(); onStatusChange(row.id, "open"); }} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Reopen</button>}
                      {row.status !== "cancelled" && row.status !== "completed" && <button type="button" onClick={(event) => { event.stopPropagation(); onStatusChange(row.id, "cancelled"); }} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Cancel</button>}
                      <button type="button" onClick={(event) => { event.stopPropagation(); setDeleteTarget(row); }} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Delete</button>
                    </div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
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
            <div><label className="mb-1 block text-sm text-muted">Estimated Cost</label><input type="number" value={form.estimated_cost} onChange={(e) => setForm({ ...form, estimated_cost: Number(e.target.value) })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
            <div><label className="mb-1 block text-sm text-muted">Actual Cost</label><input type="number" value={form.actual_cost} onChange={(e) => setForm({ ...form, actual_cost: Number(e.target.value) })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-md border border-border-color px-3 py-2 text-sm">Cancel</button>
            <button type="button" onClick={onSave} disabled={saving} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={onDelete} title="Delete Work Order" message={`Delete this work order at "${deleteTarget?.propertyName}"? This cannot be undone.`} confirmLabel="Delete" loading={deleting} />

      <SideDrawer open={detailsOpen} onClose={() => setDetailsOpen(false)} title="Work Order Details">
        {detailsLoading && <LoadingState label="Loading work order details..." />}

        {!detailsLoading && detailsError && (
          <ErrorState message={detailsError} onRetry={() => (details ? void openWorkOrderDetails(details.id) : undefined)} />
        )}

        {!detailsLoading && !detailsError && details && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted">Property</p><p>{details.propertyName}</p></div>
              <div><p className="text-xs text-muted">Provider</p><p>{details.providerName}</p></div>
              <div><p className="text-xs text-muted">Category</p><p className="capitalize">{details.category}</p></div>
              <div><p className="text-xs text-muted">Priority</p><p className="capitalize">{details.priority}</p></div>
              <div><p className="text-xs text-muted">Scheduled</p><p>{formatDate(details.scheduledDate)}</p></div>
              <div><p className="text-xs text-muted">Created</p><p>{formatDate(details.createdAt)}</p></div>
              <div><p className="text-xs text-muted">Estimated Cost</p><p>{formatCurrency(details.estimatedCost)}</p></div>
              <div><p className="text-xs text-muted">Actual Cost</p><p>{formatCurrency(details.actualCost)}</p></div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-muted">Status</label>
              <div className="flex gap-2">
                <select
                  value={detailsStatus}
                  onChange={(event) => setDetailsStatus(event.target.value)}
                  className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none"
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
                  className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {statusSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>

            <div>
              <p className="mb-1 text-sm text-muted">Description</p>
              <p className="rounded-md border border-border-color bg-surface-elevated p-3 text-sm">{details.description || "-"}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-medium">Pictures</h4>
                <label className="cursor-pointer rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-xs text-muted">
                  {photoUploading ? "Uploading..." : "Upload Picture"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => void uploadWorkOrderPhoto(event.target.files?.[0] ?? null)}
                    className="hidden"
                    disabled={photoUploading}
                  />
                </label>
              </div>

              {details.photos.length === 0 ? (
                <EmptyState title="No pictures" description="Upload work order pictures for evidence." />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {details.photos.map((photoUrl, idx) => (
                    <button key={photoUrl} type="button" onClick={() => openGallery(idx)} className="overflow-hidden rounded-md border border-border-color bg-surface-elevated text-left">
                      <img src={photoUrl} alt="Work order" className="h-28 w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              <ImageGallery images={details.photos} currentIndex={galleryIndex} open={galleryOpen} onClose={() => setGalleryOpen(false)} onNavigate={setGalleryIndex} />
            </div>
          </div>
        )}
      </SideDrawer>
    </ModulePage>
  );
}
