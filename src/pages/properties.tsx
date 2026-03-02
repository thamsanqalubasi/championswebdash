import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ModulePage } from "@/components/module-page";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { Modal, ConfirmDialog } from "@/components/modal";
import { fetchPropertiesData } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { PropertyRow } from "@/lib/types";
import { Plus, Download, Pencil, Trash, ChevronRight, Building2 } from "lucide-react";
import { DataTableHeader, StatusBadge, TableRowActions, TableActionButton } from "@/components/data-table";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "NAD",
    maximumFractionDigits: 0,
  }).format(amount);
}

const emptyForm = { name: "", type: "house", address: "", status: "vacant", monthlyRent: 0 };

export default function PropertiesPage() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PropertyRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchPropertiesData();
        if (!cancelled) setProperties(result);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load properties.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadData();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const reload = () => setReloadKey((v) => v + 1);

  const statusCounts = useMemo(() => ({
    all: properties.length,
    occupied: properties.filter((i) => i.status === "occupied").length,
    vacant: properties.filter((i) => i.status === "vacant").length,
    maintenance: properties.filter((i) => i.status === "maintenance").length,
  }), [properties]);

  const filtered = useMemo(() => {
    let result = activeFilter === "all" ? properties : properties.filter((p) => p.status === activeFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q));
    }
    return result;
  }, [properties, activeFilter, searchQuery]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (row: PropertyRow) => {
    setEditingId(row.id);
    setForm({ name: row.name, type: row.type, address: row.address, status: row.status, monthlyRent: row.monthlyRent });
    setModalOpen(true);
  };

  const onSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = { name: form.name, type: form.type, address: form.address, status: form.status, monthly_rent: form.monthlyRent };
      if (editingId) {
        const { error: err } = await supabase.from("properties").update(payload).eq("id", editingId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("properties").insert(payload);
        if (err) throw err;
      }
      setModalOpen(false);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error: err } = await supabase.from("properties").delete().eq("id", deleteTarget.id);
      if (err) throw err;
      setDeleteTarget(null);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const exportCsv = () => {
    const header = "Name,Type,Address,Status,Monthly Rent\n";
    const rows = filtered.map((r) => `"${r.name}","${r.type}","${r.address}","${r.status}",${r.monthlyRent}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "properties.csv";
    a.click();
  };

  const filterTabs = [
    { key: "all", label: "All", count: statusCounts.all },
    { key: "occupied", label: "Occupied", count: statusCounts.occupied },
    { key: "vacant", label: "Vacant", count: statusCounts.vacant },
    { key: "maintenance", label: "Maintenance", count: statusCounts.maintenance },
  ];

  return (
    <ModulePage title="Properties" description="Manage your property portfolio and track vacancy status.">
      {loading && <LoadingState label="Loading properties..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (
        <section className="rounded-xl border border-border-color bg-surface p-1">
          <div className="p-4">
            <DataTableHeader
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search properties by name or address..."
              filters={filterTabs}
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
                    <span>Add Property</span>
                  </button>
                </>
              }
            />
          </div>

          {filtered.length === 0 ? (
            <div className="p-12">
              <EmptyState title="No properties found" description={searchQuery ? "Try a different search term or filter." : "Add a property to get started."} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border-color text-left text-muted/60 uppercase text-[10px] font-bold tracking-wider">
                    <th className="px-6 py-4 font-bold">Property</th>
                    <th className="px-6 py-4 font-bold">Type</th>
                    <th className="px-6 py-4 font-bold">Status</th>
                    <th className="px-6 py-4 font-bold text-right">Monthly Rent</th>
                    <th className="px-6 py-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color/40">
                  {filtered.map((row) => (
                    <tr
                      key={row.id}
                      onClick={() => navigate(`/properties/${row.id}`)}
                      className="group cursor-pointer hover:bg-surface-elevated/40 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/5 group-hover:bg-foreground group-hover:text-surface transition-all">
                            <Building2 size={20} className="text-muted/60 group-hover:text-current" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold tracking-tight text-foreground truncate">{row.name}</p>
                            <p className="text-xs text-muted truncate">{row.address}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted/80 capitalize">{row.type}</td>
                      <td className="px-6 py-4">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-6 py-4 text-right font-bold text-foreground">
                        {formatCurrency(row.monthlyRent)}
                      </td>
                      <td className="px-6 py-4">
                        <TableRowActions>
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
              Showing {filtered.length} of {statusCounts.all} properties
            </p>
          </div>
        </section>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit Property" : "Add Property"}>
        <div className="space-y-3">
          <div><label className="mb-1 block text-sm text-muted">Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div><label className="mb-1 block text-sm text-muted">Type</label><select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
            <option value="house">House</option><option value="storage">Storage</option>
          </select></div>
          <div><label className="mb-1 block text-sm text-muted">Address</label><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div><label className="mb-1 block text-sm text-muted">Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
            <option value="vacant">Vacant</option><option value="occupied">Occupied</option><option value="maintenance">Maintenance</option>
          </select></div>
          <div><label className="mb-1 block text-sm text-muted">Monthly Rent (NAD)</label><input type="number" value={form.monthlyRent} onChange={(e) => setForm({ ...form, monthlyRent: Number(e.target.value) })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-md border border-border-color px-3 py-2 text-sm">Cancel</button>
            <button type="button" onClick={onSave} disabled={saving} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={onDelete} title="Delete Property" message={`Delete "${deleteTarget?.name}"? This cannot be undone.`} confirmLabel="Delete" loading={deleting} />
    </ModulePage>
  );
}
