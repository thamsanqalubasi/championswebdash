import { useEffect, useState } from "react";
import { ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { Modal } from "@/components/modal";
import { fetchSettingsData, verifyAdminPin } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import type { SettingsData } from "@/lib/types";

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Edit states
  const [editSection, setEditSection] = useState<"admin" | "company" | "invoice" | null>(null);
  const [adminForm, setAdminForm] = useState({ full_name: "", email: "", signature_url: "" });
  const [companyForm, setCompanyForm] = useState({ company_name: "", logo_url: "", address: "" });
  const [invoiceForm, setInvoiceForm] = useState({ tax_rate: 0, default_due_day: 1, payment_instructions: "" });
  const [saving, setSaving] = useState(false);

  // PIN states
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [pinVerifying, setPinVerifying] = useState(false);
  const [pinError, setPinError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        const result = await fetchSettingsData();
        if (!cancelled) setData(result);
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load settings."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const reload = () => setReloadKey((v) => v + 1);

  const openEditAdmin = () => {
    if (!data) return;
    setAdminForm({ full_name: data.adminProfile.fullName, email: data.adminProfile.email, signature_url: data.adminProfile.signatureUrl });
    setEditSection("admin");
  };
  const openEditCompany = () => {
    if (!data) return;
    setCompanyForm({ company_name: data.companyProfile.companyName, logo_url: data.companyProfile.logoUrl, address: data.companyProfile.address });
    setEditSection("company");
  };
  const openEditInvoice = () => {
    if (!data) return;
    setInvoiceForm({ tax_rate: data.invoiceSettings.taxRate, default_due_day: data.invoiceSettings.defaultDueDay, payment_instructions: data.invoiceSettings.paymentInstructions });
    setEditSection("invoice");
  };

  const saveAdmin = async () => {
    setSaving(true);
    try {
      const { error: err } = await supabase.from("users").update({ full_name: adminForm.full_name, email: adminForm.email, signature_url: adminForm.signature_url }).limit(1);
      if (err) throw err;
      setEditSection(null); reload();
    } catch (e) { alert(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  };

  const saveCompany = async () => {
    setSaving(true);
    try {
      const { error: err } = await supabase.from("company_settings").update({ company_name: companyForm.company_name, logo_url: companyForm.logo_url, address: companyForm.address }).limit(1);
      if (err) throw err;
      setEditSection(null); reload();
    } catch (e) { alert(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  };

  const saveInvoice = async () => {
    setSaving(true);
    try {
      const { error: err } = await supabase.from("company_settings").update({ tax_rate: invoiceForm.tax_rate, default_due_day: invoiceForm.default_due_day, payment_instructions: invoiceForm.payment_instructions }).limit(1);
      if (err) throw err;
      setEditSection(null); reload();
    } catch (e) { alert(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  };

  const handleChangePin = async () => {
    if (!newPin.trim()) return;
    setPinVerifying(true); setPinError("");
    try {
      // Deactivate old pins
      await supabase.from("admin_signup_pincodes").update({ is_active: false }).eq("is_active", true);
      // Insert new pin
      const { error: err } = await supabase.from("admin_signup_pincodes").insert({ code: newPin.trim(), is_active: true });
      if (err) throw err;
      setPinModalOpen(false); setPin(""); setNewPin(""); reload();
    } catch (e) { setPinError(e instanceof Error ? e.message : "Failed to change PIN"); }
    finally { setPinVerifying(false); }
  };

  const handleVerifyPin = async () => {
    setPinVerifying(true); setPinError("");
    try {
      const valid = await verifyAdminPin(pin);
      if (valid) { alert("PIN is valid!"); }
      else { setPinError("Invalid PIN."); }
    } catch (e) { setPinError(e instanceof Error ? e.message : "Verification failed"); }
    finally { setPinVerifying(false); }
  };

  const LabelValue = ({ label, value }: { label: string; value: string }) => (
    <div><p className="text-xs text-muted">{label}</p><p className="font-medium">{value || "-"}</p></div>
  );

  return (
    <ModulePage title="Settings" description="Manage admin, company, and invoice settings.">
      {loading && <LoadingState label="Loading settings..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && data && (
        <div className="space-y-6">

          {/* Admin Profile */}
          <section className="rounded-lg border border-border-color bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Admin Profile</h2>
              <button type="button" onClick={openEditAdmin} className="rounded-md border border-border-color px-3 py-1 text-sm text-muted hover:bg-surface-elevated">Edit</button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <LabelValue label="Full Name" value={data.adminProfile.fullName} />
              <LabelValue label="Email" value={data.adminProfile.email} />
              <LabelValue label="Signature URL" value={data.adminProfile.signatureUrl} />
            </div>
          </section>

          {/* Company Profile */}
          <section className="rounded-lg border border-border-color bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Company Profile</h2>
              <button type="button" onClick={openEditCompany} className="rounded-md border border-border-color px-3 py-1 text-sm text-muted hover:bg-surface-elevated">Edit</button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <LabelValue label="Company Name" value={data.companyProfile.companyName} />
              <LabelValue label="Logo URL" value={data.companyProfile.logoUrl} />
              <LabelValue label="Address" value={data.companyProfile.address} />
            </div>
          </section>

          {/* Invoice Settings */}
          <section className="rounded-lg border border-border-color bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Invoice Settings</h2>
              <button type="button" onClick={openEditInvoice} className="rounded-md border border-border-color px-3 py-1 text-sm text-muted hover:bg-surface-elevated">Edit</button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <LabelValue label="Tax Rate" value={`${data.invoiceSettings.taxRate}%`} />
              <LabelValue label="Default Due Day" value={String(data.invoiceSettings.defaultDueDay)} />
              <LabelValue label="Payment Instructions" value={data.invoiceSettings.paymentInstructions} />
            </div>
          </section>

          {/* Security */}
          <section className="rounded-lg border border-border-color bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Security</h2>
              <button type="button" onClick={() => setPinModalOpen(true)} className="rounded-md border border-border-color px-3 py-1 text-sm text-muted hover:bg-surface-elevated">Manage PIN</button>
            </div>
            <p className="text-sm text-muted">Active PIN: {data.security.activePinExists ? "Yes" : "No PIN set"}</p>
          </section>
        </div>
      )}

      {/* Edit Admin Modal */}
      <Modal open={editSection === "admin"} onClose={() => setEditSection(null)} title="Edit Admin Profile">
        <div className="space-y-3">
          <div><label className="mb-1 block text-sm text-muted">Full Name</label><input value={adminForm.full_name} onChange={(e) => setAdminForm({ ...adminForm, full_name: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div><label className="mb-1 block text-sm text-muted">Email</label><input value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div><label className="mb-1 block text-sm text-muted">Signature URL</label><input value={adminForm.signature_url} onChange={(e) => setAdminForm({ ...adminForm, signature_url: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEditSection(null)} className="rounded-md border border-border-color px-3 py-2 text-sm">Cancel</button>
            <button type="button" onClick={saveAdmin} disabled={saving} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </Modal>

      {/* Edit Company Modal */}
      <Modal open={editSection === "company"} onClose={() => setEditSection(null)} title="Edit Company Profile">
        <div className="space-y-3">
          <div><label className="mb-1 block text-sm text-muted">Company Name</label><input value={companyForm.company_name} onChange={(e) => setCompanyForm({ ...companyForm, company_name: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div><label className="mb-1 block text-sm text-muted">Logo URL</label><input value={companyForm.logo_url} onChange={(e) => setCompanyForm({ ...companyForm, logo_url: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div><label className="mb-1 block text-sm text-muted">Address</label><input value={companyForm.address} onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEditSection(null)} className="rounded-md border border-border-color px-3 py-2 text-sm">Cancel</button>
            <button type="button" onClick={saveCompany} disabled={saving} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </Modal>

      {/* Edit Invoice Settings Modal */}
      <Modal open={editSection === "invoice"} onClose={() => setEditSection(null)} title="Edit Invoice Settings">
        <div className="space-y-3">
          <div><label className="mb-1 block text-sm text-muted">Tax Rate (%)</label><input type="number" value={invoiceForm.tax_rate} onChange={(e) => setInvoiceForm({ ...invoiceForm, tax_rate: Number(e.target.value) })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div><label className="mb-1 block text-sm text-muted">Default Due Day</label><input type="number" min={1} max={28} value={invoiceForm.default_due_day} onChange={(e) => setInvoiceForm({ ...invoiceForm, default_due_day: Number(e.target.value) })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div><label className="mb-1 block text-sm text-muted">Payment Instructions</label><textarea value={invoiceForm.payment_instructions} onChange={(e) => setInvoiceForm({ ...invoiceForm, payment_instructions: e.target.value })} rows={3} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEditSection(null)} className="rounded-md border border-border-color px-3 py-2 text-sm">Cancel</button>
            <button type="button" onClick={saveInvoice} disabled={saving} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50">{saving ? "Saving..." : "Save"}</button>
          </div>
        </div>
      </Modal>

      {/* PIN Management Modal */}
      <Modal open={pinModalOpen} onClose={() => { setPinModalOpen(false); setPinError(""); }} title="Manage Admin PIN">
        <div className="space-y-4">
          <div>
            <h3 className="mb-2 text-sm font-medium">Verify Existing PIN</h3>
            <div className="flex gap-2">
              <input type="password" placeholder="Enter PIN" value={pin} onChange={(e) => setPin(e.target.value)} className="flex-1 rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" />
              <button type="button" onClick={handleVerifyPin} disabled={pinVerifying || !pin.trim()} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50">Verify</button>
            </div>
          </div>
          <hr className="border-border-color" />
          <div>
            <h3 className="mb-2 text-sm font-medium">Set New PIN</h3>
            <div className="flex gap-2">
              <input type="password" placeholder="New PIN" value={newPin} onChange={(e) => setNewPin(e.target.value)} className="flex-1 rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" />
              <button type="button" onClick={handleChangePin} disabled={pinVerifying || !newPin.trim()} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50">Set PIN</button>
            </div>
          </div>
          {pinError && <p className="text-sm text-red-500">{pinError}</p>}
        </div>
      </Modal>
    </ModulePage>
  );
}
