import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { Modal, ConfirmDialog } from "@/components/modal";
import { fetchInvoicesData } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { InvoiceRow } from "@/lib/types";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(amount);
}

const emptyForm = { tenant_id: "", property_id: "", month: "", due_date: "", total_amount: 0, status: "draft" };

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeFilter, setActiveFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<InvoiceRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [tenants, setTenants] = useState<Array<{ id: string; full_name: string }>>([]);
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        const result = await fetchInvoicesData();
        if (!cancelled) setInvoices(result);
        const [{ data: tens }, { data: props }] = await Promise.all([
          supabase.from("tenants").select("id, full_name").order("full_name"),
          supabase.from("properties").select("id, name").order("name"),
        ]);
        if (!cancelled) {
          if (tens) setTenants(tens.map((t) => ({ id: String(t.id), full_name: String(t.full_name) })));
          if (props) setProperties(props.map((p) => ({ id: String(p.id), name: String(p.name) })));
        }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load invoices."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const reload = () => setReloadKey((v) => v + 1);

  const counts = useMemo(() => ({
    all: invoices.length,
    paid: invoices.filter((i) => i.status === "paid").length,
    sent: invoices.filter((i) => i.status === "sent").length,
    overdue: invoices.filter((i) => i.status === "overdue").length,
    draft: invoices.filter((i) => i.status === "draft").length,
  }), [invoices]);

  const totalAmount = useMemo(() => invoices.reduce((sum, i) => sum + i.totalAmount, 0), [invoices]);
  const totalPaid = useMemo(() => invoices.filter((i) => i.status === "paid").reduce((sum, i) => sum + i.totalAmount, 0), [invoices]);
  const totalOutstanding = totalAmount - totalPaid;

  const filtered = useMemo(() => activeFilter === "all" ? invoices : invoices.filter((i) => i.status === activeFilter), [invoices, activeFilter]);

  const openAdd = () => { setForm(emptyForm); setModalOpen(true); };

  const onSave = async () => {
    if (!form.tenant_id || !form.property_id) { alert("Please select tenant and property."); return; }
    if (!form.month || !form.due_date) { alert("Please select month and due date."); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { month: form.month || null, due_date: form.due_date || null, total_amount: form.total_amount, status: form.status };
      if (form.tenant_id) payload.tenant_id = form.tenant_id;
      if (form.property_id) payload.property_id = form.property_id;
      const { error: err } = await supabase.from("invoices").insert(payload);
      if (err) throw err;
      setModalOpen(false); reload();
    } catch (e) { alert(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  };

  const onStatusChange = async (id: string, status: string) => {
    const { error: err } = await supabase.from("invoices").update({ status }).eq("id", id);
    if (err) { alert(err.message); return; }
    reload();
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error: err } = await supabase.from("invoices").delete().eq("id", deleteTarget.id);
      if (err) throw err;
      setDeleteTarget(null); reload();
    } catch (e) { alert(e instanceof Error ? e.message : "Delete failed"); }
    finally { setDeleting(false); }
  };

  const exportCSV = () => {
    const header = "Tenant,Property,Month,Due Date,Amount,Status";
    const rows = filtered.map((i) => `"${i.tenantName}","${i.propertyName}","${i.month}","${i.dueDate}","${i.totalAmount}","${i.status}"`);
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "invoices.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ModulePage title="Invoices" description="Manage tenant invoices and payment tracking.">
      {loading && <LoadingState label="Loading invoices..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (
        <section className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border-color bg-surface p-4"><p className="text-sm text-muted">Total Invoiced</p><p className="text-2xl font-bold">{formatCurrency(totalAmount)}</p></div>
            <div className="rounded-lg border border-border-color bg-surface p-4"><p className="text-sm text-muted">Total Paid</p><p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p></div>
            <div className="rounded-lg border border-border-color bg-surface p-4"><p className="text-sm text-muted">Outstanding</p><p className="text-2xl font-bold text-red-500">{formatCurrency(totalOutstanding)}</p></div>
          </div>

          <div className="rounded-lg border border-border-color bg-surface p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {(["all", "paid", "sent", "overdue", "draft"] as const).map((key) => (
                  <button key={key} type="button" onClick={() => setActiveFilter(key)}
                    className={`rounded-md border border-border-color px-3 py-2 text-sm ${activeFilter === key ? "bg-surface-elevated font-medium" : "text-muted"}`}>
                    {key === "all" ? `All (${counts.all})` : `${key.charAt(0).toUpperCase() + key.slice(1)} (${counts[key]})`}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={exportCSV} className="rounded-md border border-border-color px-3 py-2 text-sm text-muted hover:bg-surface-elevated">Export CSV</button>
                <button type="button" onClick={openAdd} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium">Generate Invoice</button>
              </div>
            </div>

            {filtered.length === 0 ? <EmptyState title="No invoices found" description="Generate an invoice to get started." /> : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead><tr className="border-b border-border-color text-left text-muted">
                    <th className="px-3 py-2 font-medium">Tenant</th><th className="px-3 py-2 font-medium">Property</th><th className="px-3 py-2 font-medium">Month</th><th className="px-3 py-2 font-medium">Due Date</th><th className="px-3 py-2 font-medium">Amount</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Actions</th>
                  </tr></thead>
                  <tbody>{filtered.map((row) => (
                    <tr key={row.id} className="border-b border-border-color/60">
                      <td className="px-3 py-3 font-medium">{row.tenantName}</td>
                      <td className="px-3 py-3 text-muted">{row.propertyName}</td>
                      <td className="px-3 py-3 text-muted">{row.month}</td>
                      <td className="px-3 py-3 text-muted">{row.dueDate}</td>
                      <td className="px-3 py-3 text-muted">{formatCurrency(row.totalAmount)}</td>
                      <td className="px-3 py-3"><span className={`rounded-full border px-2 py-1 text-xs capitalize ${row.status === "paid" ? "border-green-500/30 bg-green-500/10 text-green-600" : row.status === "overdue" ? "border-red-500/30 bg-red-500/10 text-red-600" : "border-border-color bg-surface-elevated text-muted"}`}>{row.status}</span></td>
                      <td className="px-3 py-3"><div className="flex flex-wrap gap-2">
                        {row.status !== "paid" && <button type="button" onClick={() => onStatusChange(row.id, "paid")} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Mark Paid</button>}
                        {row.status === "sent" && <button type="button" onClick={() => onStatusChange(row.id, "overdue")} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Mark Overdue</button>}
                        {row.status === "draft" && <button type="button" onClick={() => onStatusChange(row.id, "sent")} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Send</button>}
                        {row.status === "paid" && <button type="button" onClick={() => onStatusChange(row.id, "sent")} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Revert</button>}
                        <button type="button" onClick={() => setDeleteTarget(row)} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Delete</button>
                      </div></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Generate Invoice">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm text-muted">Tenant</label><select value={form.tenant_id} onChange={(e) => setForm({ ...form, tenant_id: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
              <option value="">Select tenant...</option>{tenants.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
            </select></div>
            <div><label className="mb-1 block text-sm text-muted">Property</label><select value={form.property_id} onChange={(e) => setForm({ ...form, property_id: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
              <option value="">Select property...</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm text-muted">Month</label><input type="month" value={form.month} onChange={(e) => setForm({ ...form, month: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
            <div><label className="mb-1 block text-sm text-muted">Due Date</label><input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm text-muted">Amount</label><input type="number" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: Number(e.target.value) })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
            <div><label className="mb-1 block text-sm text-muted">Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
              <option value="draft">Draft</option><option value="sent">Sent</option><option value="paid">Paid</option><option value="overdue">Overdue</option>
            </select></div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-md border border-border-color px-3 py-2 text-sm">Cancel</button>
            <button type="button" onClick={onSave} disabled={saving} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50">{saving ? "Saving..." : "Generate"}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={onDelete} title="Delete Invoice" message={`Delete invoice for ${deleteTarget?.tenantName}?`} confirmLabel="Delete" loading={deleting} />
    </ModulePage>
  );
}
