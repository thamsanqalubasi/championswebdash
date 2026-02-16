import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { Modal } from "@/components/modal";
import { fetchMaintenanceOverviewData } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { MaintenanceOverviewData } from "@/lib/types";

export default function MaintenancePage() {
  const [data, setData] = useState<MaintenanceOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ property_id: "", category: "General", priority: "medium", description: "" });
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        const result = await fetchMaintenanceOverviewData();
        if (!cancelled) setData(result);
        const { data: props } = await supabase.from("properties").select("id, name").order("name");
        if (!cancelled && props) setProperties(props.map((p) => ({ id: String(p.id), name: String(p.name) })));
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load maintenance overview."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const reload = () => setReloadKey((v) => v + 1);

  const onSubmitRequest = async () => {
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { category: form.category, priority: form.priority, status: "open" };
      if (form.property_id) payload.property_id = form.property_id;
      const { error: err } = await supabase.from("maintenance").insert(payload);
      if (err) throw err;
      setModalOpen(false); setForm({ property_id: "", category: "General", priority: "medium", description: "" }); reload();
    } catch (e) { alert(e instanceof Error ? e.message : "Failed to create request"); }
    finally { setSaving(false); }
  };

  const StatCard = ({ label, value, color }: { label: string; value: number; color?: string }) => (
    <div className="rounded-lg border border-border-color bg-surface p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className={`text-2xl font-bold ${color ?? ""}`}>{value}</p>
    </div>
  );

  const NavCard = ({ to, title, description }: { to: string; title: string; description: string }) => (
    <Link to={to} className="rounded-lg border border-border-color bg-surface p-4 hover:bg-surface-elevated transition-colors block">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted mt-1">{description}</p>
    </Link>
  );

  return (
    <ModulePage title="Maintenance" description="Overview of maintenance operations.">
      {loading && <LoadingState label="Loading maintenance data..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && data && (
        <div className="space-y-6">
          {/* Quick action */}
          <div className="flex gap-3">
            <button type="button" onClick={() => setModalOpen(true)} className="rounded-md border border-border-color bg-surface-elevated px-4 py-2 text-sm font-medium">New Maintenance Request</button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
            <StatCard label="Total Work Orders" value={data.totalWorkOrders} />
            <StatCard label="Open" value={data.openWorkOrders} color="text-yellow-500" />
            <StatCard label="Completed" value={data.completedWorkOrders} color="text-green-600" />
            <StatCard label="Providers" value={data.totalProviders} />
            <StatCard label="Scheduled Inspections" value={data.scheduledInspections} />
            <StatCard label="Overdue Tasks" value={data.overduePreventiveTasks} color="text-red-500" />
            <StatCard label="Low Stock Items" value={data.lowStockItems} color="text-orange-500" />
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <NavCard to="/maintenance/work-orders" title="Work Orders" description="Manage repair and maintenance jobs." />
            <NavCard to="/maintenance/providers" title="Providers" description="Service providers and contractors." />
            <NavCard to="/maintenance/inspections" title="Inspections" description="Property inspection schedules." />
            <NavCard to="/maintenance/scheduled-tasks" title="Scheduled Tasks" description="Preventive maintenance tasks." />
            <NavCard to="/maintenance/inventory" title="Inventory" description="Parts, supplies, and stock levels." />
          </div>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Maintenance Request">
        <div className="space-y-3">
          <div><label className="mb-1 block text-sm text-muted">Property</label>
            <select value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
              <option value="">Select property...</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm text-muted">Category</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
                <option>General</option><option>Plumbing</option><option>Electrical</option><option>HVAC</option><option>Structural</option><option>Painting</option><option>Cleaning</option>
              </select>
            </div>
            <div><label className="mb-1 block text-sm text-muted">Priority</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-md border border-border-color px-3 py-2 text-sm">Cancel</button>
            <button type="button" onClick={onSubmitRequest} disabled={saving} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50">{saving ? "Saving..." : "Submit"}</button>
          </div>
        </div>
      </Modal>
    </ModulePage>
  );
}
