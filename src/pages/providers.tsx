import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { Modal, ConfirmDialog, SideDrawer } from "@/components/modal";
import { fetchProvidersData } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { ProviderRow } from "@/lib/types";
import { 
  Plus, 
  Phone, 
  Wrench, 
  DollarSign, 
  Briefcase, 
  ChevronRight, 
  Pencil, 
  Trash, 
  Download, 
  Truck,
  User,
  Star,
  ExternalLink
} from "lucide-react";
import { DataTableHeader, TableRowActions, TableActionButton } from "@/components/data-table";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "NAD", maximumFractionDigits: 0 }).format(amount);
}

const emptyForm = { name: "", phone: "", specialization: "General", rate: 0 };

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

export default function ProvidersPage() {
  const [providers, setProviders] = useState<ProviderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProviderRow | null>(null);
  const [detailsRow, setDetailsRow] = useState<ProviderRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true); setError(null);
      try { const result = await fetchProvidersData(); if (!cancelled) setProviders(result); }
      catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load providers."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void loadData();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const reload = () => setReloadKey((v) => v + 1);

  const totals = useMemo(() => ({
    jobs: providers.reduce((s, r) => s + r.totalJobs, 0),
    paid: providers.reduce((s, r) => s + r.totalPaid, 0),
  }), [providers]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return providers;
    const q = searchQuery.toLowerCase();
    return providers.filter(p => p.name.toLowerCase().includes(q) || p.specialization.toLowerCase().includes(q));
  }, [providers, searchQuery]);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (row: ProviderRow) => { setEditingId(row.id); setForm({ name: row.name, phone: row.phone, specialization: row.specialization, rate: row.rate }); setModalOpen(true); };

  const onSave = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.specialization.trim()) {
      alert("Please enter name, phone, and specialization.");
      return;
    }
    setSaving(true);
    try {
      const payload = { name: form.name, phone: form.phone, specialization: form.specialization, rate: form.rate };
      if (editingId) {
        const { error: err } = await supabase.from("maintainers").update(payload).eq("id", editingId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("maintainers").insert(payload);
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
      const { error: err } = await supabase.from("maintainers").delete().eq("id", deleteTarget.id);
      if (err) throw err;
      setDeleteTarget(null); reload();
    } catch (e) { alert(e instanceof Error ? e.message : "Delete failed"); }
    finally { setDeleting(false); }
  };

  const exportCsv = () => {
    const header = "Name,Phone,Specialization,Rate,Jobs,Paid\n";
    const rows = filtered.map((r) => `"${r.name}","${r.phone}","${r.specialization}",${r.rate},${r.totalJobs},${r.totalPaid}`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "providers.csv";
    a.click();
  };

  return (
    <ModulePage title="Service Providers" description="Manage maintenance teams, track performance, and view financial payouts.">
      {loading && <LoadingState label="Loading maintainers..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Active Partners" value={String(providers.length)} detail="Verified service providers" icon={Truck} colorClass="text-sky-600" />
            <StatCard label="Total Deployments" value={String(totals.jobs)} detail="Completed work orders" icon={Briefcase} colorClass="text-amber-600" />
            <StatCard label="Total Settlements" value={formatCurrency(totals.paid)} detail="Cumulative payouts" icon={DollarSign} colorClass="text-green-600" />
          </div>

          <section className="rounded-xl border border-border-color bg-surface p-1">
            <div className="p-4">
              <DataTableHeader
                searchValue={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search providers by name or trade..."
                filters={[{ key: "all", label: "All Providers", count: providers.length }]}
                activeFilter="all"
                onFilterChange={() => {}}
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
                      <span>Add Provider</span>
                    </button>
                  </>
                }
              />
            </div>

            {filtered.length === 0 ? (
              <div className="p-12">
                <EmptyState title="No providers found" description={searchQuery ? "Try a different search term." : "Add your first service provider to get started."} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border-color text-left text-muted/60 uppercase text-[10px] font-bold tracking-wider">
                      <th className="px-6 py-4 font-bold">Service Partner</th>
                      <th className="px-6 py-4 font-bold">Specialization</th>
                      <th className="px-6 py-4 font-bold text-right">Standard Rate</th>
                      <th className="px-6 py-4 font-bold text-center">Jobs</th>
                      <th className="px-6 py-4 font-bold text-right">Total Paid</th>
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
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/5 group-hover:bg-foreground group-hover:text-surface transition-all">
                              <User size={20} className="text-muted/60 group-hover:text-current" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold tracking-tight text-foreground truncate">{row.name}</p>
                              <div className="flex items-center gap-1.5 text-xs text-muted">
                                <Phone size={12} />
                                <span>{row.phone}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <Wrench size={14} className="text-muted/40" />
                            <span className="font-medium text-foreground">{row.specialization}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-foreground">{formatCurrency(row.rate)}</td>
                        <td className="px-6 py-4 text-center">
                          <span className="inline-flex items-center rounded-full bg-muted/5 px-2.5 py-0.5 text-xs font-bold text-muted">
                            {row.totalJobs}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-foreground">{formatCurrency(row.totalPaid)}</td>
                        <td className="px-6 py-4 text-right">
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
                Showing {filtered.length} of {providers.length} registered partners
              </p>
            </div>
          </section>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit Service Partner" : "Add Service Partner"}>
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Full Name / Business Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/5" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Phone Number</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/5" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Trade Specialization</label>
              <input value={form.specialization} onChange={(e) => setForm({ ...form, specialization: e.target.value })} className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/5" placeholder="e.g. Plumbing, Electrical" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Standard Hourly/Job Rate (NAD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted">NAD</span>
                <input type="number" value={form.rate} onChange={(e) => setForm({ ...form, rate: Number(e.target.value) })} className="w-full rounded-lg border border-border-color bg-surface-elevated pl-12 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/5" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-lg border border-border-color px-4 py-2 text-sm font-bold text-muted hover:text-foreground">Cancel</button>
            <button type="button" onClick={onSave} disabled={saving} className="rounded-lg bg-foreground px-6 py-2 text-sm font-bold text-surface hover:opacity-90 disabled:opacity-50">
              {saving ? "Saving..." : "Save Partner"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={onDelete} title="Remove Provider" message={`Are you sure you want to remove "${deleteTarget?.name}"? This will not delete their historical job records but will remove them from active selection.`} confirmLabel="Remove Partner" loading={deleting} />

      <SideDrawer open={!!detailsRow} onClose={() => setDetailsRow(null)} title="Service Partner Profile">
        {detailsRow && (
          <div className="space-y-8">
            <header className="flex flex-col items-center text-center">
              <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-foreground text-surface shadow-xl">
                <User size={40} />
              </div>
              <h2 className="text-2xl font-bold tracking-tight">{detailsRow.name}</h2>
              <div className="mt-1 flex items-center gap-2 text-sm text-muted">
                <Wrench size={14} />
                <span className="font-medium">{detailsRow.specialization} Expert</span>
                <span className="h-1 w-1 rounded-full bg-border-color" />
                <div className="flex items-center gap-1 text-amber-500 font-bold">
                  <Star size={14} fill="currentColor" />
                  <span>4.8</span>
                </div>
              </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section className="space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted/40 px-1">Contact Information</h3>
                <div className="rounded-2xl border border-border-color bg-surface-elevated/30 p-4 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface border border-border-color">
                      <Phone size={14} className="text-muted" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted/60 uppercase">Primary Phone</p>
                      <p className="font-bold text-foreground">{detailsRow.phone}</p>
                    </div>
                    <button className="ml-auto text-sky-600 hover:text-sky-700 p-1">
                      <ExternalLink size={16} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 opacity-60">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface border border-border-color">
                      <DollarSign size={14} className="text-muted" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted/60 uppercase">Billing Rate</p>
                      <p className="font-bold text-foreground">{formatCurrency(detailsRow.rate)} / hour</p>
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-4">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted/40 px-1">Performance Summary</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-border-color bg-surface-elevated/30 p-4">
                    <p className="text-[10px] font-bold text-muted/60 uppercase">Total Jobs</p>
                    <p className="text-2xl font-black text-foreground">{detailsRow.totalJobs}</p>
                  </div>
                  <div className="rounded-2xl border border-border-color bg-surface-elevated/30 p-4">
                    <p className="text-[10px] font-bold text-muted/60 uppercase">Total Earned</p>
                    <p className="text-2xl font-black text-green-600">{formatCurrency(detailsRow.totalPaid)}</p>
                  </div>
                </div>
              </section>
            </div>

            <section className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted/40">Recent Activity</h3>
                <button className="text-[10px] font-bold uppercase text-sky-600 hover:underline">View All History</button>
              </div>
              <div className="rounded-2xl border border-border-color bg-surface-elevated/30 p-8 text-center">
                <Briefcase size={24} className="mx-auto text-muted/20 mb-3" />
                <p className="text-sm text-muted">Comprehensive work history tracking is being initialized for this partner.</p>
              </div>
            </section>

            <footer className="flex gap-3 pt-6 border-t border-border-color/50">
              <button
                type="button"
                onClick={() => { setDetailsRow(null); openEdit(detailsRow); }}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-border-color bg-surface px-4 py-3 text-sm font-bold text-foreground hover:bg-surface-elevated transition-all"
              >
                <Pencil size={16} />
                <span>Edit Profile</span>
              </button>
              <button
                type="button"
                onClick={() => { setDetailsRow(null); setDeleteTarget(detailsRow); }}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-red-600 px-4 py-3 text-sm font-bold hover:bg-red-100 transition-all dark:bg-red-900/10 dark:border-red-900/20"
              >
                <Trash size={16} />
                <span>Delete Partner</span>
              </button>
            </footer>
          </div>
        )}
      </SideDrawer>
    </ModulePage>
  );
}
