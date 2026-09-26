import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { Modal } from "@/components/modal";
import { useAuth } from "@/lib/auth";
import {
  fetchMaintenanceOverviewData,
  fetchWorkOrders,
  fetchProviders,
  fetchInspections,
  fetchPreventiveTasks,
  fetchInventoryItems,
  isValidUuid,
} from "@/lib/data";
import { fetchAdminInfo } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import type {
  MaintenanceOverviewData,
  WorkOrderRow,
  ProviderRow,
  InspectionRow,
  PreventiveTaskRow,
  InventoryItemRow,
} from "@/lib/types";
import { ExternalLink, ArrowRight, CheckCircle2, Clock, AlertTriangle, Package, Wrench, ShieldCheck } from "lucide-react";

export default function MaintenancePage() {
  const { user, currentCompany } = useAuth();
  const [data, setData] = useState<MaintenanceOverviewData | null>(null);
  const [workOrders, setWorkOrders] = useState<WorkOrderRow[]>([]);
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [inspections, setInspections] = useState<InspectionRow[]>([]);
  const [preventiveTasks, setPreventiveTasks] = useState<PreventiveTaskRow[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItemRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [kpiModal, setKpiModal] = useState<
    "total" | "open" | "completed" | "providers" | "inspections" | "overdue" | "low_stock" | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ property_id: "", category: "general", priority: "medium", description: "" });
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const compId = currentCompany?.id;
        const [result, wo, provs, insp, tasks, inv] = await Promise.all([
          fetchMaintenanceOverviewData(compId),
          fetchWorkOrders(compId).catch(() => []),
          fetchProviders(compId).catch(() => []),
          fetchInspections(compId).catch(() => []),
          fetchPreventiveTasks(compId).catch(() => []),
          fetchInventoryItems(compId).catch(() => []),
        ]);
        if (!cancelled) {
          setData(result);
          setWorkOrders(wo || []);
          setProviders(provs || []);
          setInspections(insp || []);
          setPreventiveTasks(tasks || []);
          setInventoryItems(inv || []);
        }
        let propsQuery = supabase.from("properties").select("id, name").order("name");
        if (isValidUuid(compId)) {
          propsQuery = propsQuery.eq("company_id", compId);
        }
        const { data: props } = await propsQuery;
        if (!cancelled && props) setProperties(props.map((p) => ({ id: String(p.id), name: String(p.name) })));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load maintenance overview.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey, currentCompany?.id]);

  const reload = () => setReloadKey((v) => v + 1);

  const onSubmitRequest = async () => {
    if (!form.property_id) { alert("Please select a property."); return; }
    if (!form.description.trim()) { alert("Please enter a description."); return; }
    setSaving(true);
    try {
      const admin = await fetchAdminInfo(user?.email ?? undefined);
      const executorName = admin.fullName || user?.email || "Admin";
      const compId = currentCompany?.id && isValidUuid(currentCompany.id) ? currentCompany.id : null;
      const payload: Record<string, unknown> = {
        description: form.description,
        category: form.category,
        priority: form.priority,
        status: "open",
        executed_by_name: executorName,
        company_id: compId,
      };
      if (form.property_id && isValidUuid(form.property_id)) payload.property_id = form.property_id;
      const { error: err } = await supabase.from("maintenance").insert(payload);
      if (err) throw err;
      setModalOpen(false); setForm({ property_id: "", category: "general", priority: "medium", description: "" }); reload();
    } catch (e) { alert(e instanceof Error ? e.message : "Failed to create request"); }
    finally { setSaving(false); }
  };

  const StatCard = ({
    label,
    value,
    color,
    onClick,
  }: {
    label: string;
    value: number;
    color?: string;
    onClick?: () => void;
  }) => (
    <button
      type="button"
      onClick={onClick}
      className="text-left w-full rounded-xl border border-border-color bg-surface p-4 hover:border-blue-500/50 hover:bg-surface-elevated/60 transition shadow-xs group"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted group-hover:text-foreground transition-colors">{label}</p>
        <ExternalLink size={12} className="text-muted/50 group-hover:text-blue-600 transition-colors" />
      </div>
      <p className={`mt-2 text-2xl font-black ${color ?? "text-foreground"}`}>{value}</p>
      <p className="text-[10px] text-muted mt-1 group-hover:underline">Click to view items →</p>
    </button>
  );

  const NavCard = ({ to, title, description }: { to: string; title: string; description: string }) => (
    <Link to={to} className="rounded-lg border border-border-color bg-surface p-4 hover:bg-surface-elevated transition-colors block">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="text-sm text-muted mt-1">{description}</p>
    </Link>
  );

  const openOrders = useMemo(() => workOrders.filter((w) => w.status !== "completed"), [workOrders]);
  const completedOrders = useMemo(() => workOrders.filter((w) => w.status === "completed"), [workOrders]);
  const overdueTasks = useMemo(() => preventiveTasks.filter((t) => t.status === "overdue" || (t.nextDue && new Date(t.nextDue) < new Date())), [preventiveTasks]);
  const lowStockItems = useMemo(() => inventoryItems.filter((i) => i.quantity <= i.minStockLevel), [inventoryItems]);

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
            <StatCard label="Total Work Orders" value={data.totalWorkOrders} onClick={() => setKpiModal("total")} />
            <StatCard label="Open" value={data.openWorkOrders} color="text-yellow-500" onClick={() => setKpiModal("open")} />
            <StatCard label="Completed" value={data.completedWorkOrders} color="text-green-600" onClick={() => setKpiModal("completed")} />
            <StatCard label="Providers" value={data.totalProviders} onClick={() => setKpiModal("providers")} />
            <StatCard label="Scheduled Inspections" value={data.scheduledInspections} onClick={() => setKpiModal("inspections")} />
            <StatCard label="Overdue Tasks" value={data.overduePreventiveTasks} color="text-red-500" onClick={() => setKpiModal("overdue")} />
            <StatCard label="Low Stock Items" value={data.lowStockItems} color="text-orange-500" onClick={() => setKpiModal("low_stock")} />
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <NavCard to="/maintenance/work-orders" title="Work Orders" description="Manage repair and maintenance jobs." />
            <NavCard to="/maintenance/providers" title="Providers" description="Service providers and contractors." />
            <NavCard to="/maintenance/inspections" title="Inspections" description="Property inspection schedules." />
            <NavCard to="/maintenance/scheduled-tasks" title="Scheduled Tasks" description="Preventive maintenance tasks." />
            <NavCard to="/procurement" title="Stores & Inventory" description="Parts, supplies, and stock levels." />
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
                <option value="plumbing">Plumbing</option><option value="electrical">Electrical</option><option value="structural">Structural</option><option value="appliance">Appliance</option><option value="hvac">HVAC</option><option value="pest_control">Pest Control</option><option value="painting">Painting</option><option value="landscaping">Landscaping</option><option value="general">General</option>
              </select>
            </div>
            <div><label className="mb-1 block text-sm text-muted">Priority</label>
              <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="urgent">Urgent</option>
              </select>
            </div>
          </div>
          <div><label className="mb-1 block text-sm text-muted">Description</label><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-md border border-border-color px-3 py-2 text-sm">Cancel</button>
            <button type="button" onClick={onSubmitRequest} disabled={saving} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50">{saving ? "Saving..." : "Submit"}</button>
          </div>
        </div>
      </Modal>

      {/* KPI Details Modal */}
      <Modal
        open={Boolean(kpiModal)}
        onClose={() => setKpiModal(null)}
        title={
          kpiModal === "total"
            ? `All Maintenance Work Orders (${workOrders.length})`
            : kpiModal === "open"
            ? `Open & Active Work Orders (${openOrders.length})`
            : kpiModal === "completed"
            ? `Completed Work Orders (${completedOrders.length})`
            : kpiModal === "providers"
            ? `Service Providers & Contractors (${providers.length})`
            : kpiModal === "inspections"
            ? `Scheduled Property Inspections (${inspections.length})`
            : kpiModal === "overdue"
            ? `Overdue Preventive Tasks (${overdueTasks.length})`
            : `Low Stock Items (${lowStockItems.length})`
        }
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {(kpiModal === "total" || kpiModal === "open" || kpiModal === "completed") && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted">
                  Showing {kpiModal === "total" ? workOrders.length : kpiModal === "open" ? openOrders.length : completedOrders.length} work order ticket(s).
                </p>
                <Link
                  to="/maintenance/work-orders"
                  onClick={() => setKpiModal(null)}
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <span>Open Work Orders Queue</span>
                  <ExternalLink size={12} />
                </Link>
              </div>

              {(kpiModal === "total" ? workOrders : kpiModal === "open" ? openOrders : completedOrders).length === 0 ? (
                <p className="text-xs text-muted py-6 text-center">No work orders found in this status.</p>
              ) : (
                <div className="divide-y divide-border-color border border-border-color rounded-xl overflow-hidden text-xs">
                  {(kpiModal === "total" ? workOrders : kpiModal === "open" ? openOrders : completedOrders).map((wo) => (
                    <div key={wo.id} className="p-3 hover:bg-surface-elevated/40 transition flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-foreground">{wo.propertyName || "General Property"}</p>
                        <p className="text-muted mt-0.5">{wo.category} • Priority: <span className="font-semibold text-foreground uppercase">{wo.priority}</span></p>
                        {wo.scheduledDate && <p className="text-[10px] text-muted">Scheduled: {new Date(wo.scheduledDate).toLocaleDateString()}</p>}
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                          wo.status === "completed"
                            ? "bg-emerald-500/10 text-emerald-600"
                            : "bg-amber-500/10 text-amber-600"
                        }`}>
                          {wo.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {kpiModal === "providers" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted">Showing {providers.length} registered service provider(s).</p>
                <Link
                  to="/maintenance/providers"
                  onClick={() => setKpiModal(null)}
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <span>Manage Providers</span>
                  <ExternalLink size={12} />
                </Link>
              </div>

              {providers.length === 0 ? (
                <p className="text-xs text-muted py-6 text-center">No service providers registered.</p>
              ) : (
                <div className="divide-y divide-border-color border border-border-color rounded-xl overflow-hidden text-xs">
                  {providers.map((p) => (
                    <div key={p.id} className="p-3 hover:bg-surface-elevated/40 transition flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-foreground">{p.name}</p>
                        <p className="text-muted mt-0.5">{p.specialization} • Phone: {p.phone}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-bold text-foreground">
                          {p.totalJobs} Job(s)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {kpiModal === "inspections" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted">Showing {inspections.length} scheduled property inspection(s).</p>
                <Link
                  to="/maintenance/inspections"
                  onClick={() => setKpiModal(null)}
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <span>Inspections Schedule</span>
                  <ExternalLink size={12} />
                </Link>
              </div>

              {inspections.length === 0 ? (
                <p className="text-xs text-muted py-6 text-center">No inspections scheduled.</p>
              ) : (
                <div className="divide-y divide-border-color border border-border-color rounded-xl overflow-hidden text-xs">
                  {inspections.map((i) => (
                    <div key={i.id} className="p-3 hover:bg-surface-elevated/40 transition flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-foreground">{i.propertyName || "Property"}</p>
                        <p className="text-muted mt-0.5">{i.type} • Inspector: {i.inspectorName || "Unassigned"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-foreground">
                          {i.scheduledDate ? new Date(i.scheduledDate).toLocaleDateString() : "-"}
                        </p>
                        <span className="text-[10px] text-muted capitalize">{i.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {kpiModal === "overdue" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted">Showing {overdueTasks.length} overdue task(s).</p>
                <Link
                  to="/maintenance/scheduled-tasks"
                  onClick={() => setKpiModal(null)}
                  className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                >
                  <span>Scheduled Tasks Hub</span>
                  <ExternalLink size={12} />
                </Link>
              </div>

              {overdueTasks.length === 0 ? (
                <p className="text-xs text-muted py-6 text-center">No overdue preventive tasks! All maintenance tasks are on schedule.</p>
              ) : (
                <div className="divide-y divide-border-color border border-border-color rounded-xl overflow-hidden text-xs">
                  {overdueTasks.map((t) => (
                    <div key={t.id} className="p-3 hover:bg-surface-elevated/40 transition flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-foreground">{t.title}</p>
                        <p className="text-muted mt-0.5">{t.propertyName} • Frequency: {t.frequency}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="inline-block rounded-full bg-red-500/10 text-red-600 px-2 py-0.5 text-[10px] font-bold">
                          Due: {t.nextDue ? new Date(t.nextDue).toLocaleDateString() : "Overdue"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {kpiModal === "low_stock" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted">Showing {lowStockItems.length} item(s) below re-order threshold.</p>
                <Link
                  to="/procurement"
                  onClick={() => setKpiModal(null)}
                  className="text-xs font-bold text-purple-600 hover:underline flex items-center gap-1"
                >
                  <span>Request Re-order</span>
                  <ExternalLink size={12} />
                </Link>
              </div>

              {lowStockItems.length === 0 ? (
                <p className="text-xs text-muted py-6 text-center">No low stock items. All inventory levels are adequate.</p>
              ) : (
                <div className="divide-y divide-border-color border border-border-color rounded-xl overflow-hidden text-xs">
                  {lowStockItems.map((item) => (
                    <div key={item.id} className="p-3 hover:bg-surface-elevated/40 transition flex items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-foreground">{item.name}</p>
                        <p className="text-muted mt-0.5">{item.category} • Location: {item.location || "Central Store"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="inline-block rounded-full bg-orange-500/10 text-orange-600 px-2 py-0.5 text-[10px] font-bold">
                          Qty: {item.quantity} / Min: {item.minStockLevel}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setKpiModal(null)}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-border-color bg-surface-elevated text-foreground hover:bg-surface transition"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </ModulePage>
  );
}
