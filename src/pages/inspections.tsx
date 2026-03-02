import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { Modal, ConfirmDialog, SideDrawer } from "@/components/modal";
import { Plus, Search, User, Building, Calendar, Clock, CheckSquare, Eye, Upload, Save, FileText, Activity, ClipboardList, ShieldCheck } from "lucide-react";
import { StatusBadge } from "@/components/data-table";
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

  const [deletingPhoto, setDeletingPhoto] = useState(false);

  const deleteInspectionPhoto = async (index: number) => {
    if (!details) return;
    setDeletingPhoto(true);
    try {
      const updatedPhotos = details.photos.filter((_, i) => i !== index);
      const { error: updateError } = await supabase.from("inspections").update({ photos: updatedPhotos }).eq("id", details.id);
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

      <SideDrawer open={detailsOpen} onClose={() => setDetailsOpen(false)} title="Property Inspection Detail">
        {detailsLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <LoadingState label="Retreiving inspection protocol..." />
          </div>
        )}

        {!detailsLoading && detailsError && (
          <ErrorState message={detailsError} onRetry={() => (details ? void openInspectionDetails(details.id) : undefined)} />
        )}

        {!detailsLoading && !detailsError && details && (
          <div className="space-y-8 pb-10">
            {/* Inspection Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-surface-elevated/50 p-6 rounded-2xl ring-1 ring-border-color/50 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-foreground text-surface shadow-lg">
                  <Search size={28} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xl font-bold tracking-tight text-foreground capitalize">{details.type.replace(/_/g, " ")} Inspection</h4>
                    <span className="inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-black uppercase tracking-widest bg-muted/10 text-muted">
                      ID: {details.id.slice(0, 8)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <StatusBadge status={details.status} />
                    <div className="flex items-center gap-1.5 text-xs text-muted font-medium">
                      <ShieldCheck size={14} className="text-green-600" />
                      <span>{details.overallCondition || "Condition Pending"}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <section className="space-y-4">
                  <h5 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted/40 px-1">Assignment Data</h5>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="p-4 rounded-xl border border-border-color bg-surface-elevated/30 flex items-center gap-3">
                      <Building size={16} className="text-muted/40" />
                      <div>
                        <p className="text-[10px] font-bold text-muted/60 uppercase">Unit</p>
                        <p className="font-bold text-foreground">{details.propertyName}</p>
                      </div>
                    </div>
                    <div className="p-4 rounded-xl border border-border-color bg-surface-elevated/30 flex items-center gap-3">
                      <User size={16} className="text-muted/40" />
                      <div>
                        <p className="text-[10px] font-bold text-muted/60 uppercase">Tenant</p>
                        <p className="font-bold text-foreground">{details.tenantName}</p>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h5 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted/40 px-1">Personnel</h5>
                  <div className="p-4 rounded-xl border border-border-color bg-surface-elevated/30 flex items-center gap-3">
                    <User size={16} className="text-muted/40" />
                    <div>
                      <p className="text-[10px] font-bold text-muted/60 uppercase">Assigned Inspector</p>
                      <p className="font-bold text-foreground">{details.inspectorName}</p>
                    </div>
                  </div>
                </section>
              </div>

              <div className="space-y-6">
                <section className="space-y-4">
                  <h5 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted/40 px-1">Timestamps</h5>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="p-4 rounded-xl border border-border-color bg-surface-elevated/30 flex items-center gap-4">
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-muted/60 uppercase mb-1">Scheduled</p>
                        <div className="flex items-center gap-1.5 font-bold text-foreground">
                          <Calendar size={14} className="text-muted/40" />
                          <span>{formatDate(details.scheduledDate)}</span>
                        </div>
                      </div>
                      <div className="flex-1">
                        <p className="text-[10px] font-bold text-muted/60 uppercase mb-1">Completed</p>
                        <div className="flex items-center gap-1.5 font-bold text-foreground">
                          <CheckSquare size={14} className="text-muted/40" />
                          <span>{formatDate(details.completedDate)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h5 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted/40 px-1">Status Protocol</h5>
                  <div className="p-4 rounded-xl border border-border-color bg-surface-elevated/30 space-y-3">
                    <label className="text-[10px] font-bold text-muted/60 uppercase">Current Workflow State</label>
                    <div className="flex gap-2">
                      <select
                        value={detailsStatus}
                        onChange={(event) => setDetailsStatus(event.target.value)}
                        className="flex-1 rounded-lg border border-border-color bg-surface px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-foreground/5"
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
                        className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-bold text-surface hover:opacity-90 transition-all disabled:opacity-50 shadow-md"
                      >
                        <Save size={16} />
                        <span>Save</span>
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {/* Qualitative Sections */}
            <div className="space-y-6">
              <section className="space-y-3">
                <h5 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted/40 px-1">Inspector Observations</h5>
                <div className="p-6 rounded-2xl border border-border-color bg-surface-elevated/20 text-foreground text-sm leading-relaxed">
                  {details.observations || "No qualitative observations recorded."}
                </div>
              </section>

              <section className="space-y-3">
                <h5 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted/40 px-1">Strategic Recommendations</h5>
                <div className="p-6 rounded-2xl border border-border-color bg-sky-50/20 text-foreground text-sm leading-relaxed border-l-4 border-l-sky-500">
                  {details.recommendations || "No recommendations issued for this cycle."}
                </div>
              </section>
            </div>

            {/* visual evidence */}
            <section className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <ClipboardList size={16} className="text-muted/40" />
                  <h5 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted/40">Inspection Images</h5>
                </div>
                <label className="cursor-pointer flex items-center gap-2 rounded-lg bg-surface-elevated border border-border-color px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted hover:text-foreground transition-all">
                  <Upload size={12} />
                  <span>{photoUploading ? "Uploading..." : "Add Evidence"}</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(event) => void uploadInspectionPhoto(event.target.files?.[0] ?? null)}
                    className="hidden"
                    disabled={photoUploading}
                  />
                </label>
              </div>

              {details.photos.length === 0 ? (
                <div className="p-12 border-2 border-dashed border-border-color rounded-2xl text-center">
                  <p className="text-xs text-muted">No site images captured for this session.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {details.photos.map((photoUrl, idx) => (
                    <button key={photoUrl} type="button" onClick={() => openGallery(idx)} className="aspect-square overflow-hidden rounded-xl border border-border-color bg-surface-elevated group relative shadow-sm">
                      <img src={photoUrl} alt="Inspection" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
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
        <ImageGallery images={details?.photos ?? []} currentIndex={galleryIndex} open={galleryOpen} onClose={() => setGalleryOpen(false)} onNavigate={setGalleryIndex} onDelete={deleteInspectionPhoto} deleting={deletingPhoto} />
      </SideDrawer>
    </ModulePage>
  );
}
