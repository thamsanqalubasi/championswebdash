import { useEffect, useState } from "react";
import { ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { Modal } from "@/components/modal";
import { fetchSettingsData, verifyAdminPin, logAuditEvent } from "@/lib/data";
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
  FileText,
  KeyRound,
} from "lucide-react";

export default function SettingsPage() {
  const { user, currentCompany, currentCompanyUser, changePassword, isAdmin } = useAuth();
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Edit states
  const [editSection, setEditSection] = useState<"admin" | "company" | "invoice" | "email" | "password" | null>(null);
  const [adminForm, setAdminForm] = useState({ first_name: "", last_name: "", email: "", signature_url: "" });
  const [companyForm, setCompanyForm] = useState({ company_name: "", logo_url: "", address: "" });
  const [invoiceForm, setInvoiceForm] = useState({ tax_rate: 0, default_due_day: 1, payment_instructions: "" });
  const [emailForm, setEmailForm] = useState({
    method: "resend" as "mailto" | "resend" | "smtp" | "nodemailer" | "sendgrid" | "ses" | "mailgun",
    from_name: "",
    from_email: "",
    reply_to: "",
    resend_api_key: "",
    smtp_host: "",
    smtp_port: 587,
    smtp_secure: false,
    smtp_user: "",
    smtp_pass: "",
    nodemailer_transport_json: "",
    sendgrid_api_key: "",
    ses_region: "",
    ses_access_key_id: "",
    ses_secret_access_key: "",
    ses_from_arn: "",
    mailgun_api_key: "",
    mailgun_domain: "",
  });

  // Password Change state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [passwordChanging, setPasswordChanging] = useState(false);

  const [saving, setSaving] = useState(false);
  const [signatureUploading, setSignatureUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

  // PIN states
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pin, setPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [pinVerifying, setPinVerifying] = useState(false);
  const [pinError, setPinError] = useState("");
  const [emailSavePin, setEmailSavePin] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchSettingsData(currentCompany.id);
        if (!cancelled) {
          setData(result);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load settings.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [reloadKey, currentCompany.id]);

  const reload = () => setReloadKey((v) => v + 1);

  const openEditAdmin = () => {
    if (!data) return;
    setAdminForm({
      first_name: data.adminProfile.firstName,
      last_name: data.adminProfile.lastName,
      email: data.adminProfile.email,
      signature_url: data.adminProfile.signatureUrl,
    });
    setEditSection("admin");
  };

  const openEditCompany = () => {
    if (!data) return;
    setCompanyForm({
      company_name: currentCompany.name,
      logo_url: currentCompany.logoUrl || "",
      address: currentCompany.address || "",
    });
    setEditSection("company");
  };

  const openEditInvoice = () => {
    if (!data) return;
    setInvoiceForm({
      tax_rate: data.invoiceSettings.taxRate,
      default_due_day: data.invoiceSettings.defaultDueDay,
      payment_instructions: data.invoiceSettings.paymentInstructions,
    });
    setEditSection("invoice");
  };

  const openEditEmail = () => {
    if (!data) return;
    setEmailForm({
      method: data.emailDelivery.method,
      from_name: data.emailDelivery.fromName,
      from_email: data.emailDelivery.fromEmail,
      reply_to: data.emailDelivery.replyTo,
      resend_api_key: data.emailDelivery.resendApiKey,
      smtp_host: data.emailDelivery.smtpHost,
      smtp_port: data.emailDelivery.smtpPort,
      smtp_secure: data.emailDelivery.smtpSecure,
      smtp_user: data.emailDelivery.smtpUser,
      smtp_pass: data.emailDelivery.smtpPass,
      nodemailer_transport_json: data.emailDelivery.nodemailerTransportJson,
      sendgrid_api_key: data.emailDelivery.sendgridApiKey,
      ses_region: data.emailDelivery.sesRegion,
      ses_access_key_id: data.emailDelivery.sesAccessKeyId,
      ses_secret_access_key: data.emailDelivery.sesSecretAccessKey,
      ses_from_arn: data.emailDelivery.sesFromArn,
      mailgun_api_key: data.emailDelivery.mailgunApiKey,
      mailgun_domain: data.emailDelivery.mailgunDomain,
    });
    setEditSection("email");
  };

  const onUploadSignature = async (file: File | null) => {
    if (!file) return;
    setSignatureUploading(true);
    try {
      const publicUrl = await uploadFileToBucket("signatures", "admin-signatures", file);
      setAdminForm((prev) => ({ ...prev, signature_url: publicUrl }));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Signature upload failed");
    } finally {
      setSignatureUploading(false);
    }
  };

  const onUploadLogo = async (file: File | null) => {
    if (!file) return;
    setLogoUploading(true);
    try {
      const publicUrl = await uploadFileToBucket("company-assets", "logos", file);
      setCompanyForm((prev) => ({ ...prev, logo_url: publicUrl }));
    } catch (e) {
      alert(e instanceof Error ? e.message : "Logo upload failed");
    } finally {
      setLogoUploading(false);
    }
  };

  const saveAdmin = async () => {
    setSaving(true);
    try {
      if (user?.id) {
        await supabase
          .from("users")
          .update({
            first_name: adminForm.first_name,
            last_name: adminForm.last_name,
            signature_url: adminForm.signature_url,
          })
          .eq("id", user.id);
      }
      setEditSection(null);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const saveCompany = async () => {
    setSaving(true);
    try {
      await supabase
        .from("companies")
        .update({
          name: companyForm.company_name,
          logo_url: companyForm.logo_url,
          address: companyForm.address,
        })
        .eq("id", currentCompany.id);

      currentCompany.name = companyForm.company_name;
      currentCompany.logoUrl = companyForm.logo_url;
      currentCompany.address = companyForm.address;

      await logAuditEvent({
        companyId: currentCompany.id,
        action: "UPDATE_COMPANY_SETTINGS",
        entityType: "company",
        entityId: currentCompany.id,
        entityName: companyForm.company_name,
        actorName: currentCompanyUser.fullName,
        details: `Updated company branding and headquarters address.`,
      });

      setEditSection(null);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const saveInvoice = async () => {
    setSaving(true);
    try {
      await supabase
        .from("companies")
        .update({
          tax_rate: invoiceForm.tax_rate,
          default_due_day: invoiceForm.default_due_day,
          payment_instructions: invoiceForm.payment_instructions,
        })
        .eq("id", currentCompany.id);

      setEditSection(null);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const saveEmailSettings = async () => {
    setSaving(true);
    try {
      setEditSection(null);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setPasswordMsg({ type: "error", text: "Password must be at least 6 characters long." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "Passwords do not match." });
      return;
    }

    setPasswordChanging(true);
    setPasswordMsg(null);

    const res = await changePassword(newPassword);
    setPasswordChanging(false);

    if (res.error) {
      setPasswordMsg({ type: "error", text: res.error });
    } else {
      setPasswordMsg({ type: "success", text: "Password updated successfully!" });
      setNewPassword("");
      setConfirmPassword("");

      await logAuditEvent({
        companyId: currentCompany.id,
        action: "PASSWORD_CHANGED",
        entityType: "user_account",
        entityId: currentCompanyUser.userId,
        entityName: currentCompanyUser.fullName,
        actorName: currentCompanyUser.fullName,
        details: "User updated their account password.",
      });
    }
  };

  const SectionHeader = ({ icon: Icon, title, description, onEdit }: { icon: any; title: string; description: string; onEdit?: () => void }) => (
    <div className="mb-6 flex flex-col justify-between gap-4 border-b border-border-color pb-4 sm:flex-row sm:items-center">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600">
          <Icon size={20} />
        </div>
        <div>
          <h2 className="text-base font-bold text-foreground">{title}</h2>
          <p className="text-xs text-muted">{description}</p>
        </div>
      </div>
      {onEdit && (
        <button
          type="button"
          onClick={onEdit}
          className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface-elevated px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-surface"
        >
          <Pencil size={13} />
          <span>Edit Details</span>
        </button>
      )}
    </div>
  );

  return (
    <ModulePage
      title={`Settings & Security (${currentCompany.name})`}
      description="Manage user credentials, password security, company branding, and financial parameters."
    >
      {loading && <LoadingState label="Synchronizing cloud settings..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && data && (
        <div className="max-w-4xl space-y-6 pb-16">
          {/* User Account & Password Change */}
          <section className="rounded-2xl border border-border-color bg-surface p-6 shadow-sm">
            <SectionHeader
              icon={KeyRound}
              title="User Account & Password Management"
              description="Update your login password and review your active permissions."
            />

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="rounded-xl bg-surface-elevated/60 p-4 text-xs space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Active Profile</p>
                <p className="text-sm font-bold text-foreground">{currentCompanyUser.fullName}</p>
                <p className="text-muted">{currentCompanyUser.email}</p>
                <div className="pt-2">
                  <span className="rounded-md bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-600">
                    {currentCompanyUser.jobTitle}
                  </span>
                </div>
              </div>

              {/* Change Password Form */}
              <form onSubmit={handlePasswordChange} className="space-y-3 text-xs">
                <p className="font-bold text-foreground">Change Account Password</p>
                {passwordMsg && (
                  <div
                    className={`flex items-center gap-2 rounded-lg p-2 text-xs font-medium ${
                      passwordMsg.type === "success"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-red-500/10 text-red-600"
                    }`}
                  >
                    {passwordMsg.type === "success" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                    <span>{passwordMsg.text}</span>
                  </div>
                )}
                <div>
                  <label className="mb-1 block text-muted">New Password</label>
                  <input
                    type="password"
                    placeholder="Min 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-muted">Confirm New Password</label>
                  <input
                    type="password"
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={passwordChanging}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {passwordChanging ? "Updating..." : "Update Password"}
                </button>
              </form>
            </div>
          </section>

          {/* Company Profile */}
          <section className="rounded-2xl border border-border-color bg-surface p-6 shadow-sm">
            <SectionHeader
              icon={Building2}
              title="Company Identity & Branding"
              description="Organization name, logo, and correspondence address."
              onEdit={isAdmin ? openEditCompany : undefined}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
              <div>
                <p className="text-muted">Company Name:</p>
                <p className="text-sm font-bold text-foreground mt-0.5">{currentCompany.name}</p>
              </div>
              <div>
                <p className="text-muted">Headquarters Address:</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">{currentCompany.address || "Unconfigured"}</p>
              </div>
            </div>
          </section>

          {/* Financial & Invoice Settings */}
          <section className="rounded-2xl border border-border-color bg-surface p-6 shadow-sm">
            <SectionHeader
              icon={CreditCard}
              title="Financial & Taxation Parameters"
              description="Default tax rate, billing due dates, and remittance instructions."
              onEdit={isAdmin ? openEditInvoice : undefined}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 text-xs">
              <div>
                <p className="text-muted">Standard Tax Rate:</p>
                <p className="text-sm font-bold text-foreground mt-0.5">{currentCompany.taxRate}% ({currentCompany.currency})</p>
              </div>
              <div>
                <p className="text-muted">Monthly Invoice Due Day:</p>
                <p className="text-sm font-bold text-foreground mt-0.5">Day {currentCompany.defaultDueDay || 1}</p>
              </div>
            </div>
            <div className="mt-4 rounded-xl bg-surface-elevated/70 p-3.5 text-xs">
              <p className="font-bold text-muted uppercase text-[10px]">Payment Instructions</p>
              <p className="mt-1 text-foreground whitespace-pre-wrap">{currentCompany.paymentInstructions || "No instructions provided."}</p>
            </div>
          </section>
        </div>
      )}

      {/* Edit Company Modal */}
      <Modal open={editSection === "company"} onClose={() => setEditSection(null)} title="Edit Organization Details">
        <div className="space-y-3.5 text-xs">
          <div>
            <label className="mb-1 block font-medium text-foreground">Company Name *</label>
            <input
              value={companyForm.company_name}
              onChange={(e) => setCompanyForm({ ...companyForm, company_name: e.target.value })}
              className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600"
            />
          </div>
          <div>
            <label className="mb-1 block font-medium text-foreground">Headquarters Address</label>
            <input
              value={companyForm.address}
              onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
              className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEditSection(null)} className="rounded-lg border border-border-color px-3 py-1.5 text-muted">
              Cancel
            </button>
            <button type="button" onClick={saveCompany} disabled={saving} className="rounded-lg bg-blue-600 px-5 py-1.5 font-bold text-white hover:bg-blue-700">
              {saving ? "Saving..." : "Save Company"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Invoice Modal */}
      <Modal open={editSection === "invoice"} onClose={() => setEditSection(null)} title="Edit Financial Settings">
        <div className="space-y-3.5 text-xs">
          <div>
            <label className="mb-1 block font-medium text-foreground">Tax Rate (%)</label>
            <input
              type="number"
              value={invoiceForm.tax_rate}
              onChange={(e) => setInvoiceForm({ ...invoiceForm, tax_rate: Number(e.target.value) })}
              className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600"
            />
          </div>
          <div>
            <label className="mb-1 block font-medium text-foreground">Default Due Day of Month</label>
            <input
              type="number"
              min={1}
              max={31}
              value={invoiceForm.default_due_day}
              onChange={(e) => setInvoiceForm({ ...invoiceForm, default_due_day: Number(e.target.value) })}
              className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600"
            />
          </div>
          <div>
            <label className="mb-1 block font-medium text-foreground">Payment Instructions</label>
            <textarea
              rows={3}
              value={invoiceForm.payment_instructions}
              onChange={(e) => setInvoiceForm({ ...invoiceForm, payment_instructions: e.target.value })}
              className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEditSection(null)} className="rounded-lg border border-border-color px-3 py-1.5 text-muted">
              Cancel
            </button>
            <button type="button" onClick={saveInvoice} disabled={saving} className="rounded-lg bg-blue-600 px-5 py-1.5 font-bold text-white hover:bg-blue-700">
              {saving ? "Saving..." : "Save Parameters"}
            </button>
          </div>
        </div>
      </Modal>
    </ModulePage>
  );
}
