import { useEffect, useState } from "react";
import { ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { Modal } from "@/components/modal";
import { fetchSettingsData, verifyAdminPin } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { uploadFileToBucket } from "@/lib/storage";
import type { SettingsData } from "@/lib/types";

import { 
  User as UserIcon, 
  Building2, 
  CreditCard, 
  ShieldCheck, 
  Mail, 
  MapPin, 
  Percent, 
  Calendar, 
  Lock, 
  Pencil, 
  Upload, 
  CheckCircle2, 
  AlertCircle,
  FileSignature,
  FileText
} from "lucide-react";

export default function SettingsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Edit states
  const [editSection, setEditSection] = useState<"admin" | "company" | "invoice" | null>(null);
  const [adminForm, setAdminForm] = useState({ first_name: "", last_name: "", email: "", signature_url: "" });
  const [companyForm, setCompanyForm] = useState({ company_name: "", logo_url: "", address: "" });
  const [invoiceForm, setInvoiceForm] = useState({ tax_rate: 0, default_due_day: 1, payment_instructions: "" });
  const [saving, setSaving] = useState(false);
  const [signatureUploading, setSignatureUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

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
        if (!cancelled) {
          setData(result);
        }

        if (user?.id) {
          const { data: currentUser, error: currentUserError } = await supabase
            .from("users")
            .select("first_name, last_name, email, signature_url")
            .eq("id", user.id)
            .single();

          if (currentUserError) throw currentUserError;

          if (!cancelled && currentUser) {
            setData((previous) => {
              if (!previous) {
                return previous;
              }

              return {
                ...previous,
                adminProfile: {
                  firstName: String(currentUser.first_name ?? ""),
                  lastName: String(currentUser.last_name ?? ""),
                  email: String(currentUser.email ?? "-"),
                  signatureUrl: String(currentUser.signature_url ?? ""),
                },
              };
            });
          }
        }
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load settings."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [reloadKey, user?.id]);

  const reload = () => setReloadKey((v) => v + 1);

  const openEditAdmin = () => {
    if (!data) return;
    setAdminForm({ first_name: data.adminProfile.firstName, last_name: data.adminProfile.lastName, email: data.adminProfile.email, signature_url: data.adminProfile.signatureUrl });
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
      if (!user?.id) {
        throw new Error("No signed-in user found.");
      }

      const { error: err } = await supabase
        .from("users")
        .update({ first_name: adminForm.first_name, last_name: adminForm.last_name, email: adminForm.email, signature_url: adminForm.signature_url })
        .eq("id", user.id);
      if (err) throw err;
      setEditSection(null); reload();
    } catch (e) { alert(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  };

  const onUploadSignature = async (file: File | null) => {
    if (!file) return;
    if (!user?.id) { alert("No signed-in user found."); return; }
    setSignatureUploading(true);
    try {
      const bucketName = import.meta.env.VITE_SUPABASE_SIGNATURE_BUCKET || "signatures";
      const url = await uploadFileToBucket(bucketName, user.id, file);
      setAdminForm((previous) => ({ ...previous, signature_url: url }));
    } catch (uploadError) {
      alert(uploadError instanceof Error ? uploadError.message : "Could not upload signature.");
    } finally {
      setSignatureUploading(false);
    }
  };

  const onUploadLogo = async (file: File | null) => {
    if (!file) return;
    setLogoUploading(true);
    try {
      const url = await uploadFileToBucket("company-logos", "logo", file);
      setCompanyForm((previous) => ({ ...previous, logo_url: url }));
    } catch (uploadError) {
      alert(uploadError instanceof Error ? uploadError.message : "Could not upload logo.");
    } finally {
      setLogoUploading(false);
    }
  };

  const saveCompany = async () => {
    setSaving(true);
    try {
      // First try to get the existing row id
      const { data: existing } = await supabase.from("company_settings").select("id").limit(1).maybeSingle();
      if (existing?.id) {
        const { error: err } = await supabase.from("company_settings").update({ company_name: companyForm.company_name, logo_url: companyForm.logo_url, address: companyForm.address }).eq("id", existing.id);
        if (err) throw err;
      } else {
        // No row yet — insert one
        const { error: err } = await supabase.from("company_settings").insert({ company_name: companyForm.company_name, logo_url: companyForm.logo_url, address: companyForm.address });
        if (err) throw err;
      }
      setEditSection(null); reload();
    } catch (e) { alert(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  };

  const saveInvoice = async () => {
    setSaving(true);
    try {
      const { data: existing } = await supabase.from("company_settings").select("id").limit(1).maybeSingle();
      if (existing?.id) {
        const { error: err } = await supabase.from("company_settings").update({ tax_rate: invoiceForm.tax_rate, default_due_day: invoiceForm.default_due_day, payment_instructions: invoiceForm.payment_instructions }).eq("id", existing.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase.from("company_settings").insert({ tax_rate: invoiceForm.tax_rate, default_due_day: invoiceForm.default_due_day, payment_instructions: invoiceForm.payment_instructions });
        if (err) throw err;
      }
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

  const SectionHeader = ({ icon: Icon, title, description, onEdit }: { icon: any; title: string; description: string; onEdit: () => void }) => (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-foreground text-surface shadow-lg">
          <Icon size={24} />
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">{title}</h2>
          <p className="text-sm text-muted">{description}</p>
        </div>
      </div>
      <button 
        type="button" 
        onClick={onEdit} 
        className="flex items-center gap-2 rounded-lg border border-border-color bg-surface-elevated px-4 py-2 text-sm font-bold text-muted hover:text-foreground transition-all"
      >
        <Pencil size={16} />
        <span>Edit</span>
      </button>
    </div>
  );

  const LabelValue = ({ label, value, icon: Icon }: { label: string; value: string; icon?: any }) => (
    <div className="p-4 rounded-xl border border-border-color bg-surface-elevated/20 flex items-center gap-3">
      {Icon && <Icon size={16} className="text-muted/40" />}
      <div>
        <p className="text-[10px] font-bold text-muted/60 uppercase mb-0.5">{label}</p>
        <p className="font-bold text-foreground truncate">{value || "-"}</p>
      </div>
    </div>
  );

  return (
    <ModulePage title="System Configuration" description="Manage administrator credentials, company branding, and financial parameters.">
      {loading && <LoadingState label="Synchronizing cloud settings..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && data && (
        <div className="max-w-5xl space-y-10 pb-20">

          {/* Admin Profile */}
          <section className="rounded-2xl border border-border-color bg-surface p-6 shadow-sm">
            <SectionHeader icon={UserIcon} title="Administrator Profile" description="Your personal identity and security credentials." onEdit={openEditAdmin} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <LabelValue label="First Name" value={data.adminProfile.firstName} />
              <LabelValue label="Last Name" value={data.adminProfile.lastName} />
              <LabelValue label="Email Address" value={data.adminProfile.email} icon={Mail} />
            </div>
            <div className="mt-8 pt-6 border-t border-border-color/50">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted/40 mb-4 px-1">Authorization Signature</p>
              {data.adminProfile.signatureUrl ? (
                <div className="inline-block rounded-xl border border-border-color bg-surface-elevated/40 p-4 shadow-inner">
                  <img src={data.adminProfile.signatureUrl} alt="Admin signature" className="h-16 object-contain mix-blend-multiply dark:invert dark:mix-blend-normal" />
                </div>
              ) : (
                <div className="p-8 rounded-xl border-2 border-dashed border-border-color bg-muted/5 text-center">
                  <FileSignature size={24} className="mx-auto text-muted/20 mb-2" />
                  <p className="text-xs text-muted font-medium">No digital signature established.</p>
                </div>
              )}
            </div>
          </section>

          {/* Company Profile */}
          <section className="rounded-2xl border border-border-color bg-surface p-6 shadow-sm">
            <SectionHeader icon={Building2} title="Company Identity" description="Public branding and corporate correspondence details." onEdit={openEditCompany} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <LabelValue label="Legal Company Name" value={data.companyProfile.companyName} />
              <LabelValue label="Physical Address" value={data.companyProfile.address} icon={MapPin} />
            </div>
            <div className="mt-8 pt-6 border-t border-border-color/50">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted/40 mb-4 px-1">Corporate Logo</p>
              {data.companyProfile.logoUrl ? (
                <div className="inline-block rounded-xl border border-border-color bg-surface-elevated/40 p-4 shadow-inner">
                  <img src={data.companyProfile.logoUrl} alt="Company logo" className="h-12 object-contain" />
                </div>
              ) : (
                <div className="p-8 rounded-xl border-2 border-dashed border-border-color bg-muted/5 text-center">
                  <Building2 size={24} className="mx-auto text-muted/20 mb-2" />
                  <p className="text-xs text-muted font-medium">No company logo uploaded.</p>
                </div>
              )}
            </div>
          </section>

          {/* Financial & Invoice Settings */}
          <section className="rounded-2xl border border-border-color bg-surface p-6 shadow-sm">
            <SectionHeader icon={CreditCard} title="Financial Parameters" description="Global tax rates and default invoicing behaviors." onEdit={openEditInvoice} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <LabelValue label="Default Tax Rate" value={`${data.invoiceSettings.taxRate}%`} icon={Percent} />
              <LabelValue label="Monthly Due Day" value={`Day ${data.invoiceSettings.defaultDueDay}`} icon={Calendar} />
            </div>
            <div className="mt-6">
              <div className="p-5 rounded-2xl border border-border-color bg-surface-elevated/10">
                <p className="text-[10px] font-bold text-muted/60 uppercase mb-2 flex items-center gap-1.5">
                  <FileText size={12} />
                  Default Payment Instructions
                </p>
                <p className="text-sm font-medium text-foreground whitespace-pre-wrap leading-relaxed">{data.invoiceSettings.paymentInstructions || "No instructions provided."}</p>
              </div>
            </div>
          </section>

          {/* Security */}
          <section className="rounded-2xl border border-border-color bg-surface p-6 shadow-sm overflow-hidden relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500 text-white shadow-lg">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-foreground">Advanced Security</h2>
                  <p className="text-sm text-muted">Manage system-wide access tokens and administrative PINs.</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setPinModalOpen(true)} 
                className="rounded-lg bg-foreground px-6 py-2 text-sm font-black text-surface hover:opacity-90 shadow-md transition-all"
              >
                Manage Access PIN
              </button>
            </div>
            <div className="mt-6 flex items-center gap-2 px-1">
              {data.security.activePinExists ? (
                <>
                  <CheckCircle2 size={16} className="text-green-600" />
                  <span className="text-xs font-bold text-green-700 uppercase tracking-wider">System Locked & Protected</span>
                </>
              ) : (
                <>
                  <AlertCircle size={16} className="text-amber-600" />
                  <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">No active admin PIN established</span>
                </>
              )}
            </div>
            <div className="absolute right-[-20px] bottom-[-20px] opacity-5">
              <Lock size={120} />
            </div>
          </section>
        </div>
      )}

      {/* Edit Admin Modal */}
      <Modal open={editSection === "admin"} onClose={() => setEditSection(null)} title="Edit Admin Profile">
        <div className="space-y-3">
          <div><label className="mb-1 block text-sm text-muted">First Name</label><input value={adminForm.first_name} onChange={(e) => setAdminForm({ ...adminForm, first_name: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div><label className="mb-1 block text-sm text-muted">Last Name</label><input value={adminForm.last_name} onChange={(e) => setAdminForm({ ...adminForm, last_name: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div><label className="mb-1 block text-sm text-muted">Email</label><input value={adminForm.email} onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div>
            <label className="mb-1 block text-sm text-muted">Signature Image</label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm text-muted hover:bg-surface">
              {signatureUploading ? "Uploading..." : "Choose Signature Image"}
              <input type="file" accept="image/png,image/jpeg,image/webp,.jpg,.jpeg,.png,.webp" onChange={(e) => void onUploadSignature(e.target.files?.[0] ?? null)} className="hidden" disabled={signatureUploading} />
            </label>
            <p className="mt-1 text-xs text-muted">Select an image from your device. Click Save after uploading.</p>
          </div>
          {adminForm.signature_url ? (
            <div className="rounded-md border border-border-color bg-surface-elevated p-3">
              <p className="mb-2 text-xs text-muted">Signature Preview</p>
              <img src={adminForm.signature_url} alt="Signature preview" className="h-20 w-full object-contain" />
            </div>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEditSection(null)} className="rounded-md border border-border-color px-3 py-2 text-sm">Cancel</button>
            <button type="button" onClick={saveAdmin} disabled={saving || signatureUploading} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50">{saving ? "Saving..." : signatureUploading ? "Uploading..." : "Save"}</button>
          </div>
        </div>
      </Modal>

      {/* Edit Company Modal */}
      <Modal open={editSection === "company"} onClose={() => setEditSection(null)} title="Edit Company Profile">
        <div className="space-y-3">
          <div><label className="mb-1 block text-sm text-muted">Company Name</label><input value={companyForm.company_name} onChange={(e) => setCompanyForm({ ...companyForm, company_name: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div>
            <label className="mb-1 block text-sm text-muted">Company Logo</label>
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm text-muted hover:bg-surface">
              {logoUploading ? "Uploading..." : "Choose Logo Image"}
              <input type="file" accept="image/png,image/jpeg,image/webp,.jpg,.jpeg,.png,.webp" onChange={(e) => void onUploadLogo(e.target.files?.[0] ?? null)} className="hidden" disabled={logoUploading} />
            </label>
            {companyForm.logo_url && (
              <div className="mt-2 rounded-md border border-border-color bg-surface-elevated p-2">
                <img src={companyForm.logo_url} alt="Logo preview" className="h-12 w-full object-contain" />
              </div>
            )}
          </div>
          <div><label className="mb-1 block text-sm text-muted">Address</label><input value={companyForm.address} onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" /></div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEditSection(null)} className="rounded-md border border-border-color px-3 py-2 text-sm">Cancel</button>
            <button type="button" onClick={saveCompany} disabled={saving || logoUploading} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50">{saving ? "Saving..." : logoUploading ? "Uploading..." : "Save"}</button>
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
