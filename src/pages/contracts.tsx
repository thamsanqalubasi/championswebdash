import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { Modal, ConfirmDialog } from "@/components/modal";
import { fetchContractsData } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import type { ContractRow } from "@/lib/types";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(amount);
}

const emptyForm = { tenant_id: "", property_id: "", start_date: "", end_date: "", monthly_rent: 0, deposit_amount: 0, notes: "", status: "pending" };

export default function ContractsPage() {
  const { user } = useAuth();
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeFilter, setActiveFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [printingId, setPrintingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContractRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [tenants, setTenants] = useState<Array<{ id: string; full_name: string }>>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        const result = await fetchContractsData();
        if (!cancelled) setContracts(result);
        const [{ data: props }, { data: tens }] = await Promise.all([
          supabase.from("properties").select("id, name").order("name"),
          supabase.from("tenants").select("id, full_name").order("full_name"),
        ]);
        if (!cancelled) {
          if (props) setProperties(props.map((p) => ({ id: String(p.id), name: String(p.name) })));
          if (tens) setTenants(tens.map((t) => ({ id: String(t.id), full_name: String(t.full_name) })));
        }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load contracts."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const reload = () => setReloadKey((v) => v + 1);

  const counts = useMemo(() => ({
    all: contracts.length,
    pending: contracts.filter((c) => c.status === "pending").length,
    active: contracts.filter((c) => c.status === "active").length,
    expired: contracts.filter((c) => c.status === "expired").length,
    terminated: contracts.filter((c) => c.status === "terminated").length,
  }), [contracts]);

  const filtered = useMemo(() => activeFilter === "all" ? contracts : contracts.filter((c) => c.status === activeFilter), [contracts, activeFilter]);

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (row: ContractRow) => {
    setEditingId(row.id);
    setForm({ tenant_id: "", property_id: "", start_date: row.startDate, end_date: row.endDate, monthly_rent: row.monthlyRent, deposit_amount: row.depositAmount, notes: row.notes, status: row.status });
    setModalOpen(true);
  };

  const onSave = async () => {
    if (!form.start_date || !form.end_date) { alert("Please select start and end dates."); return; }
    if (!editingId && (!form.tenant_id || !form.property_id)) { alert("Please select tenant and property."); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { start_date: form.start_date || null, end_date: form.end_date || null, monthly_rent: form.monthly_rent, deposit_amount: form.deposit_amount, notes: form.notes, status: form.status };
      if (form.tenant_id) payload.tenant_id = form.tenant_id;
      if (form.property_id) payload.property_id = form.property_id;
      if (editingId) {
        const { error: err } = await supabase.from("contracts").update(payload).eq("id", editingId);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("contracts").insert(payload);
        if (err) throw err;
      }
      setModalOpen(false); reload();
    } catch (e) { alert(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  };

  const onStatusChange = async (id: string, status: string) => {
    const { error: err } = await supabase.from("contracts").update({ status }).eq("id", id);
    if (err) { alert(err.message); return; }
    reload();
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error: err } = await supabase.from("contracts").delete().eq("id", deleteTarget.id);
      if (err) throw err;
      setDeleteTarget(null); reload();
    } catch (e) { alert(e instanceof Error ? e.message : "Delete failed"); }
    finally { setDeleting(false); }
  };

  const onPrint = async (row: ContractRow) => {
    setPrintingId(row.id);
    try {
      let adminName = user?.email ?? "Admin";
      let signatureUrl = "";

      if (user?.email) {
        const { data: adminRow } = await supabase
          .from("users")
          .select("first_name, last_name, signature_url")
          .eq("email", user.email)
          .limit(1)
          .maybeSingle();

        if (adminRow) {
          const fullName = `${String(adminRow.first_name ?? "")} ${String(adminRow.last_name ?? "")}`.trim();
          adminName = fullName || user.email;
          signatureUrl = String(adminRow.signature_url ?? "");
        }
      }

      const printWindow = window.open("", "_blank", "width=900,height=700");
      if (!printWindow) {
        alert("Popup blocked. Please allow popups to print.");
        return;
      }

      const html = `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Contract - ${row.tenantName}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 32px; color: #111; line-height: 1.45; }
      h1 { margin: 0 0 8px; }
      h2 { margin: 20px 0 8px; font-size: 16px; }
      p { margin: 8px 0; font-size: 14px; }
      .muted { color: #555; font-size: 12px; }
      .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 20px; margin: 16px 0; }
      .meta { font-size: 14px; }
      .box { border: 1px solid #ddd; border-radius: 8px; padding: 12px; margin-top: 12px; }
      .section { margin-top: 16px; }
      .sig-box { margin-top: 56px; display: flex; justify-content: space-between; gap: 24px; }
      .sig { width: 45%; border-top: 1px solid #333; padding-top: 8px; font-size: 12px; min-height: 86px; }
      .sig img { max-height: 80px; display: block; margin-bottom: 8px; }
      ol { padding-left: 20px; }
      li { margin: 6px 0; font-size: 14px; }
      @media print { button { display: none; } }
    </style>
  </head>
  <body>
    <h1>Residential Lease Agreement</h1>
    <div class="muted">Generated on ${new Date().toLocaleDateString("en-ZA")}</div>

    <div class="meta-grid box">
      <div class="meta"><strong>Tenant:</strong> ${row.tenantName}</div>
      <div class="meta"><strong>Property:</strong> ${row.propertyName}</div>
      <div class="meta"><strong>Contract Status:</strong> ${row.status}</div>
      <div class="meta"><strong>Lease Period:</strong> ${row.startDate} to ${row.endDate}</div>
      <div class="meta"><strong>Monthly Rent:</strong> ${formatCurrency(row.monthlyRent)}</div>
      <div class="meta"><strong>Deposit:</strong> ${formatCurrency(row.depositAmount)}</div>
    </div>

    <div class="section">
      <h2>1. Parties</h2>
      <p>This Lease Agreement is made between the Landlord/Administrator (<strong>${adminName}</strong>) and the Tenant (<strong>${row.tenantName}</strong>) for occupation of <strong>${row.propertyName}</strong>.</p>
    </div>

    <div class="section">
      <h2>2. Core Terms</h2>
      <ol>
        <li>Lease commencement date: <strong>${row.startDate}</strong>.</li>
        <li>Lease end date: <strong>${row.endDate}</strong>.</li>
        <li>Monthly rent payable: <strong>${formatCurrency(row.monthlyRent)}</strong>.</li>
        <li>Security deposit payable: <strong>${formatCurrency(row.depositAmount)}</strong>.</li>
        <li>Rent is due in accordance with the company payment instructions and due-day settings.</li>
      </ol>
    </div>

    <div class="section">
      <h2>3. Obligations</h2>
      <ol>
        <li>The Tenant shall keep the property in reasonable condition and promptly report maintenance issues.</li>
        <li>The Tenant shall not sublet the property without prior written approval.</li>
        <li>The Landlord/Administrator shall maintain essential services and attend to qualifying maintenance requests.</li>
        <li>Any damages beyond fair wear and tear may be recovered from the deposit as permitted by law.</li>
      </ol>
    </div>

    <div class="section">
      <h2>4. Additional Notes</h2>
      <div class="box">
        <p>${(row.notes || "No additional notes.").replaceAll("\n", "<br />")}</p>
      </div>
    </div>

    <div class="sig-box">
      <div class="sig">
        ${signatureUrl ? `<img src="${signatureUrl}" alt="Admin signature" />` : ""}
        <div><strong>Admin:</strong> ${adminName}</div>
        <div>Date: ${new Date().toLocaleDateString("en-ZA")}</div>
      </div>
      <div class="sig">
        <div><strong>Tenant:</strong> ${row.tenantName}</div>
        <div>Date: ____________________</div>
      </div>
    </div>

    <script>
      window.onload = () => { window.print(); };
    </script>
  </body>
</html>`;

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not prepare contract print.");
    } finally {
      setPrintingId(null);
    }
  };

  return (
    <ModulePage title="Contracts" description="Manage lease agreements and contract lifecycle.">
      {loading && <LoadingState label="Loading contracts..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (
        <section className="space-y-4 rounded-lg border border-border-color bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {(["all", "pending", "active", "expired", "terminated"] as const).map((key) => (
                <button key={key} type="button" onClick={() => setActiveFilter(key)}
                  className={`rounded-md border border-border-color px-3 py-2 text-sm ${activeFilter === key ? "bg-surface-elevated font-medium" : "text-muted"}`}>
                  {key === "all" ? `All (${counts.all})` : `${key.charAt(0).toUpperCase() + key.slice(1)} (${counts[key]})`}
                </button>
              ))}
            </div>
            <button type="button" onClick={openAdd} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium">Add Contract</button>
          </div>

          {filtered.length === 0 ? <EmptyState title="No contracts found" description="Add a contract to get started." /> : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead><tr className="border-b border-border-color text-left text-muted">
                  <th className="px-3 py-2 font-medium">Tenant</th><th className="px-3 py-2 font-medium">Property</th><th className="px-3 py-2 font-medium">Start</th><th className="px-3 py-2 font-medium">End</th><th className="px-3 py-2 font-medium">Monthly Rent</th><th className="px-3 py-2 font-medium">Deposit</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Actions</th>
                </tr></thead>
                <tbody>{filtered.map((row) => (
                  <tr key={row.id} className="border-b border-border-color/60">
                    <td className="px-3 py-3 font-medium">{row.tenantName}</td>
                    <td className="px-3 py-3 text-muted">{row.propertyName}</td>
                    <td className="px-3 py-3 text-muted">{row.startDate}</td>
                    <td className="px-3 py-3 text-muted">{row.endDate}</td>
                    <td className="px-3 py-3 text-muted">{formatCurrency(row.monthlyRent)}</td>
                    <td className="px-3 py-3 text-muted">{formatCurrency(row.depositAmount)}</td>
                    <td className="px-3 py-3"><span className="rounded-full border border-border-color bg-surface-elevated px-2 py-1 text-xs text-muted capitalize">{row.status}</span></td>
                    <td className="px-3 py-3"><div className="flex flex-wrap gap-2">
                      {row.status === "pending" && <button type="button" onClick={() => onStatusChange(row.id, "active")} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Activate</button>}
                      {row.status === "active" && <button type="button" onClick={() => onPrint(row)} disabled={printingId === row.id} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated disabled:opacity-50">{printingId === row.id ? "Preparing..." : "Print"}</button>}
                      {row.status === "active" && <button type="button" onClick={() => onStatusChange(row.id, "terminated")} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Terminate</button>}
                      {row.status === "expired" && <button type="button" onClick={() => onStatusChange(row.id, "active")} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Renew</button>}
                      {row.status === "terminated" && <button type="button" onClick={() => onStatusChange(row.id, "active")} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Reactivate</button>}
                      <button type="button" onClick={() => openEdit(row)} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Edit</button>
                      <button type="button" onClick={() => setDeleteTarget(row)} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Delete</button>
                    </div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit Contract" : "Add Contract"}>
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
            <div><label className="mb-1 block text-sm text-muted">Start Date</label><input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
            <div><label className="mb-1 block text-sm text-muted">End Date</label><input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="mb-1 block text-sm text-muted">Monthly Rent</label><input type="number" value={form.monthly_rent} onChange={(e) => setForm({ ...form, monthly_rent: Number(e.target.value) })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
            <div><label className="mb-1 block text-sm text-muted">Deposit Amount</label><input type="number" value={form.deposit_amount} onChange={(e) => setForm({ ...form, deposit_amount: Number(e.target.value) })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          </div>
          <div><label className="mb-1 block text-sm text-muted">Notes</label><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div><label className="mb-1 block text-sm text-muted">Status</label><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
            <option value="pending">Pending</option><option value="active">Active</option><option value="expired">Expired</option><option value="terminated">Terminated</option>
          </select></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-md border border-border-color px-3 py-2 text-sm">Cancel</button>
            <button type="button" onClick={onSave} disabled={saving} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={onDelete} title="Delete Contract" message={`Delete contract for ${deleteTarget?.tenantName}?`} confirmLabel="Delete" loading={deleting} />
    </ModulePage>
  );
}
