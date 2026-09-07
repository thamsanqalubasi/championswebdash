import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ModulePage } from "@/components/module-page";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { Modal, ConfirmDialog } from "@/components/modal";
import { fetchProperties } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { PropertyRow } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { Plus, Download, Pencil, Trash, ChevronRight, Building2, BedDouble } from "lucide-react";
import { DataTableHeader, StatusBadge, TableRowActions, TableActionButton } from "@/components/data-table";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(amount);
}

const emptyForm = {
  name: "",
  type: "lodge",
  address: "",
  status: "occupied",
  monthlyRent: 0,
  totalRooms: 10,
  defaultRoomPrice: 1200,
  defaultBedBreakfast: 1500,
};

export default function PropertiesPage() {
  const navigate = useNavigate();
  const { currentCompany } = useAuth();
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
        const result = await fetchProperties(currentCompany.id);
        if (!cancelled) setProperties(result);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load properties.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadData();
    return () => { cancelled = true; };
  }, [reloadKey, currentCompany.id]);

  const reload = () => setReloadKey((v) => v + 1);

  const statusCounts = useMemo(() => ({
    all: properties.length,
    commercial: properties.filter((i) => ["hotel", "motel", "lodge", "guest_house", "commercial"].includes(i.type)).length,
    residential: properties.filter((i) => ["house", "apartment", "storage"].includes(i.type)).length,
    occupied: properties.filter((i) => i.status === "occupied").length,
    vacant: properties.filter((i) => i.status === "vacant").length,
  }), [properties]);

  const filtered = useMemo(() => {
    let result = properties;
    if (activeFilter === "commercial") {
      result = result.filter((p) => ["hotel", "motel", "lodge", "guest_house", "commercial"].includes(p.type));
    } else if (activeFilter === "residential") {
      result = result.filter((p) => ["house", "apartment", "storage"].includes(p.type));
    } else if (activeFilter !== "all") {
      result = result.filter((p) => p.status === activeFilter);
    }

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
    setForm({
      name: row.name,
      type: row.type,
      address: row.address,
      status: row.status,
      monthlyRent: row.monthlyRent,
      totalRooms: row.totalRooms || 0,
      defaultRoomPrice: row.defaultRoomPrice || 0,
      defaultBedBreakfast: row.defaultBedBreakfast || 0,
    });
    setModalOpen(true);
  };

  const onSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        type: form.type,
        address: form.address,
        status: form.status,
        monthly_rent: form.monthlyRent,
        total_rooms: form.totalRooms,
        default_room_price: form.defaultRoomPrice,
        default_bed_breakfast: form.defaultBedBreakfast,
        company_id: currentCompany.id,
      };

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

  const filterTabs = [
    { key: "all", label: "All Properties", count: statusCounts.all },
    { key: "commercial", label: "Hotels & Lodges", count: statusCounts.commercial },
    { key: "residential", label: "Residential", count: statusCounts.residential },
    { key: "occupied", label: "Occupied", count: statusCounts.occupied },
    { key: "vacant", label: "Vacant", count: statusCounts.vacant },
  ];

  return (
    <ModulePage
      title={`Properties & Lodging (${currentCompany.name})`}
      description="Manage residential units, hotels, safari lodges, motels, guest houses, and commercial spaces."
    >
      {loading && <LoadingState label="Loading property portfolio..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (
        <section className="rounded-2xl border border-border-color bg-surface p-1 shadow-sm">
          <div className="p-4">
            <DataTableHeader
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search properties by name or address..."
              filters={filterTabs}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              actions={
                <button
                  type="button"
                  onClick={openAdd}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition"
                >
                  <Plus size={16} />
                  <span>Add Property / Hotel</span>
                </button>
              }
            />
          </div>

          {filtered.length === 0 ? (
            <div className="p-12">
              <EmptyState
                title="No properties found"
                description={searchQuery ? "Try a different search term or filter." : "Add a property or hotel to get started."}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border-color text-left text-muted uppercase text-[10px] font-bold tracking-wider">
                    <th className="px-6 py-4">Property / Facility</th>
                    <th className="px-6 py-4">Category & Sub-Type</th>
                    <th className="px-6 py-4">Rooms / Units</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Pricing / Rent</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color/40">
                  {filtered.map((row) => {
                    const isCommercial = ["hotel", "motel", "lodge", "guest_house", "commercial"].includes(row.type);
                    return (
                      <tr
                        key={row.id}
                        onClick={() => navigate(`/properties/${row.id}`)}
                        className="group cursor-pointer hover:bg-surface-elevated/40 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600">
                              {isCommercial ? <BedDouble size={20} /> : <Building2 size={20} />}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold tracking-tight text-foreground truncate">{row.name}</p>
                              <p className="text-xs text-muted truncate">{row.address}</p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span className="font-semibold capitalize text-foreground">
                            {row.type.replace("_", " ")}
                          </span>
                          {isCommercial && (
                            <span className="ml-2 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-600 uppercase">
                              Hospitality
                            </span>
                          )}
                        </td>

                        <td className="px-6 py-4 text-xs font-semibold text-muted">
                          {isCommercial ? `${row.totalRooms || 12} Rooms` : "Single Unit"}
                        </td>

                        <td className="px-6 py-4">
                          <StatusBadge status={row.status} />
                        </td>

                        <td className="px-6 py-4 text-right font-bold text-foreground">
                          {isCommercial
                            ? `From R${row.defaultRoomPrice || 950}/night`
                            : formatCurrency(row.monthlyRent)}
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
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Add / Edit Property Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit Property" : "Add Property / Commercial Lodge"}>
        <div className="space-y-3.5 text-xs">
          <div>
            <label className="mb-1 block font-medium text-foreground">Property Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Serengeti Luxury Lodge"
              className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="mb-1 block font-medium text-foreground">Property Type *</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600"
            >
              <optgroup label="Commercial & Hospitality">
                <option value="hotel">Hotel</option>
                <option value="lodge">Safari Lodge</option>
                <option value="motel">Motel</option>
                <option value="guest_house">Guest House / B&B</option>
                <option value="commercial">Commercial Complex</option>
              </optgroup>
              <optgroup label="Residential & Storage">
                <option value="house">Residential House</option>
                <option value="apartment">Apartment</option>
                <option value="storage">Storage Unit</option>
              </optgroup>
            </select>
          </div>

          <div>
            <label className="mb-1 block font-medium text-foreground">Address / Location</label>
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="Street address or Plot #"
              className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600"
            />
          </div>

          {["hotel", "motel", "lodge", "guest_house", "commercial"].includes(form.type) ? (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-foreground">Total Number of Rooms</label>
                <input
                  type="number"
                  value={form.totalRooms}
                  onChange={(e) => setForm({ ...form, totalRooms: Number(e.target.value) })}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600"
                />
              </div>
              <div>
                <label className="mb-1 block font-medium text-foreground">Default Rate (ZAR/Night)</label>
                <input
                  type="number"
                  value={form.defaultRoomPrice}
                  onChange={(e) => setForm({ ...form, defaultRoomPrice: Number(e.target.value) })}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1 block font-medium text-foreground">Monthly Rent (ZAR)</label>
              <input
                type="number"
                value={form.monthlyRent}
                onChange={(e) => setForm({ ...form, monthlyRent: Number(e.target.value) })}
                className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-xl border border-border-color px-3.5 py-1.5 text-muted hover:bg-surface-elevated"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="rounded-xl bg-blue-600 px-5 py-1.5 font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Property"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={onDelete}
        title="Delete Property"
        message={`Delete "${deleteTarget?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </ModulePage>
  );
}
