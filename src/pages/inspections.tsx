import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { Modal, ConfirmDialog, SideDrawer } from "@/components/modal";
import { ImageGallery } from "@/components/image-gallery";
import { fetchInspectionsData } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { uploadFileToBucket } from "@/lib/storage";
import type { InspectionRow } from "@/lib/types";

const emptyForm = { property_id: "", tenant_id: "", type: "routine", inspector_name: "", scheduled_date: "", status: "scheduled" };

type InspectionDetail = {
  id: string;
  propertyName: string;
  tenantName: string;
  type: string;
  inspectorName: string;
  status: string;
  scheduledDate: string;
  completedDate: string;
  overallCondition: string;
  notes: string;
  observations: string;
  recommendations: string;
  photos: string[];
  createdAt: string;
};

function formatDate(value: string) {
  if (!value || value === "-") return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "2-digit" });
}

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
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [details, setDetails] = useState<InspectionDetail | null>(null);
  const [detailsStatus, setDetailsStatus] = useState("scheduled");
  const [statusSaving, setStatusSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

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
    in_progress: inspections.filter((i) => i.status === "in_progress").length,
    completed: inspections.filter((i) => i.status === "completed").length,
    cancelled: inspections.filter((i) => i.status === "cancelled").length,
  }), [inspections]);

  const filtered = useMemo(() => activeFilter === "all" ? inspections : inspections.filter((i) => i.status === activeFilter), [inspections, activeFilter]);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setModalOpen(true); };

  const onSave = async () => {
    if (!form.inspector_name.trim()) { alert("Please enter inspector name."); return; }
    if (!form.scheduled_date) { alert("Please select scheduled date."); return; }
    if (!editingId && !form.property_id) { alert("Please select a property."); return; }
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

  const openInspectionDetails = async (inspectionId: string) => {
    setDetailsOpen(true);
    setDetailsLoading(true);
    setDetailsError(null);

    try {
      const { data, error: detailError } = await supabase
        .from("inspections")
        .select(
          "id, type, status, inspector_name, scheduled_date, completed_date, overall_condition, notes, observations, recommendations, photos, created_at, properties(name), tenants(full_name)",
        )
        .eq("id", inspectionId)
        .single();

      if (detailError) throw detailError;

      const detailRow: InspectionDetail = {
        id: String(data.id ?? ""),
        propertyName: String((data.properties as { name?: string } | null)?.name ?? "Unassigned"),
        tenantName: String((data.tenants as { full_name?: string } | null)?.full_name ?? "Unassigned"),
        type: String(data.type ?? "-"),
        inspectorName: String(data.inspector_name ?? "-"),
        status: String(data.status ?? "scheduled"),
        scheduledDate: String(data.scheduled_date ?? "-"),
        completedDate: String(data.completed_date ?? "-"),
        overallCondition: String(data.overall_condition ?? "-"),
        notes: String(data.notes ?? ""),
        observations: String(data.observations ?? ""),
        recommendations: String(data.recommendations ?? ""),
        photos: Array.isArray(data.photos) ? data.photos.map((item) => String(item)) : [],
        createdAt: String(data.created_at ?? "-"),
      };

      setDetails(detailRow);
      setDetailsStatus(detailRow.status);
    } catch (loadError) {
      setDetailsError(loadError instanceof Error ? loadError.message : "Could not load inspection details.");
    } finally {
      setDetailsLoading(false);
    }
  };

  const saveDetailsStatus = async () => {
    if (!details) return;

    setStatusSaving(true);
    try {
      const payload: Record<string, unknown> = { status: detailsStatus };
      if (detailsStatus === "completed" && (!details.completedDate || details.completedDate === "-")) {
        payload.completed_date = new Date().toISOString().slice(0, 10);
      }
      if (detailsStatus !== "completed") {
        payload.completed_date = null;
      }

      const { error: updateError } = await supabase.from("inspections").update(payload).eq("id", details.id);
      if (updateError) throw updateError;

      await openInspectionDetails(details.id);
      reload();
    } catch (saveError) {
      alert(saveError instanceof Error ? saveError.message : "Could not update status.");
    } finally {
      setStatusSaving(false);
    }
  };

  const uploadInspectionPhoto = async (file: File | null) => {
    if (!file || !details) return;
    setPhotoUploading(true);
    try {
      const photoUrl = await uploadFileToBucket("inspection-photos", details.id, file);
      const updatedPhotos = [...details.photos, photoUrl];
      const { error: updateError } = await supabase.from("inspections").update({ photos: updatedPhotos }).eq("id", details.id);
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
    <ModulePage title="Inspections" description="Inspection schedules, statuses, and checklist workflows.">
      {loading && <LoadingState label="Loading inspections..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (
        <section className="space-y-4 rounded-lg border border-border-color bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {(["all", "scheduled", "in_progress", "completed", "cancelled"] as const).map((key) => (
                <button key={key} type="button" onClick={() => setActiveFilter(key)}
                  className={`rounded-md border border-border-color px-3 py-2 text-sm ${activeFilter === key ? "bg-surface-elevated font-medium" : "text-muted"}`}>
                  {key === "all" ? `All (${counts.all})` : `${key.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase())} (${counts[key]})`}
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
                  <tr key={row.id} onClick={() => void openInspectionDetails(row.id)} className="cursor-pointer border-b border-border-color/60 hover:bg-surface-elevated/40">
                    <td className="px-3 py-3 font-medium">{row.propertyName}</td>
                    <td className="px-3 py-3 text-muted">{row.tenantName}</td>
                    <td className="px-3 py-3 text-muted">{row.type}</td>
                    <td className="px-3 py-3 text-muted">{row.inspectorName}</td>
                    <td className="px-3 py-3 text-muted">{row.scheduledDate}</td>
                    <td className="px-3 py-3 text-muted">{row.completedDate}</td>
                    <td className="px-3 py-3"><span className="rounded-full border border-border-color bg-surface-elevated px-2 py-1 text-xs text-muted capitalize">{row.status}</span></td>
                    <td className="px-3 py-3"><div className="flex flex-wrap gap-2">
                      {row.status === "scheduled" && <button type="button" onClick={(event) => { event.stopPropagation(); onStatusChange(row.id, "in_progress"); }} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Start</button>}
                      {row.status === "in_progress" && <button type="button" onClick={(event) => { event.stopPropagation(); onStatusChange(row.id, "scheduled"); }} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Reschedule</button>}
                      {row.status !== "completed" && row.status !== "cancelled" && <button type="button" onClick={(event) => { event.stopPropagation(); onStatusChange(row.id, "completed", new Date().toISOString().slice(0, 10)); }} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Complete</button>}
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit Inspection" : "Schedule Inspection"}>
        <div className="space-y-3">
          <div><label className="mb-1 block text-sm text-muted">Property</label><select value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
            <option value="">Select property...</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select></div>
          <div><label className="mb-1 block text-sm text-muted">Tenant</label><select value={form.tenant_id} onChange={(e) => setForm({ ...form, tenant_id: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
            <option value="">Select tenant...</option>{tenantsList.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select></div>
          <div><label className="mb-1 block text-sm text-muted">Type</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
            <option value="move_in">Move In</option><option value="move_out">Move Out</option><option value="routine">Routine</option><option value="annual">Annual</option><option value="emergency">Emergency</option>
          </select></div>
          <div><label className="mb-1 block text-sm text-muted">Inspector Name</label><input value={form.inspector_name} onChange={(e) => setForm({ ...form, inspector_name: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div><label className="mb-1 block text-sm text-muted">Scheduled Date</label><input type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-md border border-border-color px-3 py-2 text-sm">Cancel</button>
            <button type="button" onClick={onSave} disabled={saving} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={onDelete} title="Delete Inspection" message={`Delete this inspection at "${deleteTarget?.propertyName}"?`} confirmLabel="Delete" loading={deleting} />

      <SideDrawer open={detailsOpen} onClose={() => setDetailsOpen(false)} title="Inspection Details">
        {detailsLoading && <LoadingState label="Loading inspection details..." />}

        {!detailsLoading && detailsError && (
          <ErrorState message={detailsError} onRetry={() => (details ? void openInspectionDetails(details.id) : undefined)} />
        )}

        {!detailsLoading && !detailsError && details && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-muted">Property</p><p>{details.propertyName}</p></div>
              <div><p className="text-xs text-muted">Tenant</p><p>{details.tenantName}</p></div>
              <div><p className="text-xs text-muted">Type</p><p className="capitalize">{details.type.replace(/_/g, " ")}</p></div>
              <div><p className="text-xs text-muted">Inspector</p><p>{details.inspectorName}</p></div>
              <div><p className="text-xs text-muted">Scheduled</p><p>{formatDate(details.scheduledDate)}</p></div>
              <div><p className="text-xs text-muted">Completed</p><p>{formatDate(details.completedDate)}</p></div>
              <div><p className="text-xs text-muted">Overall Condition</p><p className="capitalize">{details.overallCondition.replace(/_/g, " ")}</p></div>
              <div><p className="text-xs text-muted">Created</p><p>{formatDate(details.createdAt)}</p></div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-muted">Status</label>
              <div className="flex gap-2">
                <select
                  value={detailsStatus}
                  onChange={(event) => setDetailsStatus(event.target.value)}
                  className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none"
                >
                  <option value="scheduled">Scheduled</option>
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
              <p className="mb-1 text-sm text-muted">Notes</p>
              <p className="rounded-md border border-border-color bg-surface-elevated p-3 text-sm">{details.notes || "-"}</p>
            </div>

            <div>
              <p className="mb-1 text-sm text-muted">Observations</p>
              <p className="rounded-md border border-border-color bg-surface-elevated p-3 text-sm">{details.observations || "-"}</p>
            </div>

            <div>
              <p className="mb-1 text-sm text-muted">Recommendations</p>
              <p className="rounded-md border border-border-color bg-surface-elevated p-3 text-sm">{details.recommendations || "-"}</p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-medium">Pictures</h4>
                <label className="cursor-pointer rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-xs text-muted">
                  {photoUploading ? "Uploading..." : "Upload Picture"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,.jpg,.jpeg,.png,.webp"
                    onChange={(event) => void uploadInspectionPhoto(event.target.files?.[0] ?? null)}
                    className="hidden"
                    disabled={photoUploading}
                  />
                </label>
              </div>

              {details.photos.length === 0 ? (
                <EmptyState title="No pictures" description="Upload inspection pictures to track condition evidence." />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {details.photos.map((photoUrl, idx) => (
                    <button key={photoUrl} type="button" onClick={() => openGallery(idx)} className="overflow-hidden rounded-md border border-border-color bg-surface-elevated text-left">
                      <img src={photoUrl} alt="Inspection" className="h-28 w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='112' fill='%23ccc'%3E%3Crect width='200' height='112' fill='%23f0f0f0'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' font-size='14' fill='%23999'%3EImage unavailable%3C/text%3E%3C/svg%3E"; }} />
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
