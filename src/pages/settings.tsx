import { useEffect, useState } from "react";
import { ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { Modal } from "@/components/modal";
import { fetchSettingsData, verifyAdminPin, logAuditEvent, setUserPin, hasUserPin } from "@/lib/data";
import { COUNTRIES, COMMON_CURRENCIES, getCurrencyForCountry } from "@/lib/countries";
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
  Globe,
  Coins,
} from "lucide-react";

export default function SettingsPage() {
  const { user, currentCompany, currentCompanyUser, setCurrentCompany, changePassword, isAdmin } = useAuth();
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Edit states
  const [editSection, setEditSection] = useState<"admin" | "company" | "invoice" | "email" | "password" | null>(null);
  const [adminForm, setAdminForm] = useState({ first_name: "", last_name: "", email: "", signature_url: "" });
  const [companyForm, setCompanyForm] = useState({
    company_name: "",
    logo_url: "",
    address: "",
    country: "South Africa",
    currency: "ZAR",
  });
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

  // Security PIN state
  const [userHasPin, setUserHasPin] = useState(false);
  const [pinOld, setPinOld] = useState("");
  const [pinNew, setPinNew] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinSaving, setPinSaving] = useState(false);
  const [pinMessage, setPinMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [saving, setSaving] = useState(false);
  const [signatureUploading, setSignatureUploading] = useState(false);
  const [logoUploading, setLogoUploading] = useState(false);

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
    const savedCountry = localStorage.getItem(`cc_company_country_${currentCompany.id}`) || "South Africa";
    setCompanyForm({
      company_name: currentCompany.name,
      logo_url: currentCompany.logoUrl || "",
      address: currentCompany.address || "",
      country: savedCountry,
      currency: currentCompany.currency || "ZAR",
    });
    setEditSection("company");
  };

  const openEditInvoice = () => {
    setInvoiceForm({
      tax_rate: currentCompany.taxRate || 15,
      default_due_day: currentCompany.defaultDueDay || 1,
      payment_instructions: currentCompany.paymentInstructions || "",
    });
    setEditSection("invoice");
  };

  const handleCountryChange = (newCountry: string) => {
    const defaultCurr = getCurrencyForCountry(newCountry);
    setCompanyForm((prev) => ({
      ...prev,
      country: newCountry,
      currency: defaultCurr,
    }));
  };

  const userId = user?.id || currentCompanyUser?.userId || currentCompanyUser?.email || "";

  useEffect(() => {
    if (userId) {
      hasUserPin(userId).then(setUserHasPin);
    }
  }, [userId, reloadKey]);

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinMessage(null);

    if (pinNew.length < 4) {
      setPinMessage({ type: "error", text: "New PIN must be at least 4 digits." });
      return;
    }
    if (pinNew !== pinConfirm) {
      setPinMessage({ type: "error", text: "New PIN and Confirmation PIN do not match." });
      return;
    }

    setPinSaving(true);
    try {
      const res = await setUserPin(userId, pinNew, userHasPin ? pinOld : undefined);
      if (!res.ok) {
        setPinMessage({ type: "error", text: res.message || "Failed to set PIN." });
      } else {
        setPinMessage({
          type: "success",
          text: userHasPin
            ? "Security PIN changed successfully!"
            : "Security PIN created successfully! You can now use it to authorize deletions.",
        });
        setUserHasPin(true);
        setPinOld("");
        setPinNew("");
        setPinConfirm("");

        await logAuditEvent({
          companyId: currentCompany.id,
          action: "PIN_UPDATED",
          entityType: "user_security",
          entityId: userId,
          entityName: currentCompanyUser.fullName,
          actorName: currentCompanyUser.fullName,
          details: "User configured/updated their security PIN.",
        });
      }
    } catch (err) {
      setPinMessage({ type: "error", text: err instanceof Error ? err.message : "Error saving PIN." });
    } finally {
      setPinSaving(false);
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
          currency: companyForm.currency,
        })
        .eq("id", currentCompany.id);

      const updatedCompany = {
        ...currentCompany,
        name: companyForm.company_name,
        logoUrl: companyForm.logo_url,
        address: companyForm.address,
        currency: companyForm.currency,
      };

      setCurrentCompany(updatedCompany);
      localStorage.setItem(`cc_company_country_${currentCompany.id}`, companyForm.country);

      await logAuditEvent({
        companyId: currentCompany.id,
        action: "UPDATE_COMPANY_SETTINGS",
        entityType: "company",
        entityId: currentCompany.id,
        entityName: companyForm.company_name,
        actorName: currentCompanyUser.fullName,
        details: `Updated company operating country to ${companyForm.country}, currency to ${companyForm.currency}, and logo.`,
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

      const updatedCompany = {
        ...currentCompany,
        taxRate: invoiceForm.tax_rate,
        defaultDueDay: invoiceForm.default_due_day,
        paymentInstructions: invoiceForm.payment_instructions,
      };

      setCurrentCompany(updatedCompany);

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

          {/* Security PIN Section */}
          <section className="rounded-2xl border border-border-color bg-surface p-6 shadow-sm">
            <SectionHeader
              icon={ShieldCheck}
              title="Security PIN Management"
              description="Set or change your personal 4-digit authorization PIN used to verify deletions (pictures, properties, rooms)."
            />

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="rounded-xl bg-surface-elevated/60 p-4 text-xs space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted">PIN Status</p>
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      userHasPin ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                    }`}
                  >
                    {userHasPin ? "● Custom Security PIN Active" : "○ No PIN Configured (Default: 1234)"}
                  </span>
                </div>
                <p className="text-muted leading-relaxed pt-1">
                  Your PIN safeguards sensitive business records. Every time you delete a property, room, or picture,
                  the system will require you to verify this PIN before proceeding.
                </p>
              </div>

              {/* PIN Form */}
              <form onSubmit={handlePinSubmit} className="space-y-3 text-xs">
                <p className="font-bold text-foreground">
                  {userHasPin ? "Change Security PIN" : "First-Time Security PIN Setup"}
                </p>

                {pinMessage && (
                  <div
                    className={`flex items-center gap-2 rounded-lg p-2.5 text-xs font-medium ${
                      pinMessage.type === "success"
                        ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                        : "bg-red-500/10 text-red-600 border border-red-500/20"
                    }`}
                  >
                    {pinMessage.type === "success" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                    <span>{pinMessage.text}</span>
                  </div>
                )}

                {userHasPin && (
                  <div>
                    <label className="mb-1 block text-muted font-medium">Current PIN *</label>
                    <input
                      type="password"
                      maxLength={8}
                      placeholder="••••"
                      value={pinOld}
                      onChange={(e) => setPinOld(e.target.value)}
                      className="w-full tracking-widest font-mono rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                      required
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-muted font-medium">New 4-Digit PIN *</label>
                  <input
                    type="password"
                    maxLength={8}
                    placeholder="••••"
                    value={pinNew}
                    onChange={(e) => setPinNew(e.target.value)}
                    className="w-full tracking-widest font-mono rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-muted font-medium">Confirm New 4-Digit PIN *</label>
                  <input
                    type="password"
                    maxLength={8}
                    placeholder="••••"
                    value={pinConfirm}
                    onChange={(e) => setPinConfirm(e.target.value)}
                    className="w-full tracking-widest font-mono rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={pinSaving}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {pinSaving ? "Saving..." : userHasPin ? "Update Security PIN" : "Save Security PIN"}
                </button>
              </form>
            </div>
          </section>

          {/* Company Profile */}
          <section className="rounded-2xl border border-border-color bg-surface p-6 shadow-sm">
            <SectionHeader
              icon={Building2}
              title="Company Identity & Country/Currency"
              description="Organization operating country, billing currency, name, and correspondence address."
              onEdit={isAdmin ? openEditCompany : undefined}
            />
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 border-b border-border-color/60 pb-4 mb-4">
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border-color bg-surface-elevated p-1 shadow-sm">
                {currentCompany.logoUrl ? (
                  <img
                    src={currentCompany.logoUrl}
                    alt={currentCompany.name}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <Building2 size={28} className="text-muted" />
                )}
              </div>
              <div className="space-y-0.5">
                <h3 className="text-lg font-black text-foreground">{currentCompany.name}</h3>
                <p className="font-mono text-xs text-blue-600 font-semibold">
                  Dedicated Portal URL: /c/{currentCompany.slug || currentCompany.id}
                </p>
                <p className="text-xs text-muted">
                  Your logo and company details dynamically brand all generated invoices, contracts, receipts, and folios.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 text-xs">
              <div>
                <p className="text-muted">Company Name:</p>
                <p className="text-sm font-bold text-foreground mt-0.5">{currentCompany.name}</p>
              </div>
              <div>
                <p className="text-muted flex items-center gap-1">
                  <Globe size={12} className="text-blue-500" />
                  <span>Operating Country:</span>
                </p>
                <p className="text-sm font-bold text-foreground mt-0.5">
                  {localStorage.getItem(`cc_company_country_${currentCompany.id}`) || "South Africa"}
                </p>
              </div>
              <div>
                <p className="text-muted flex items-center gap-1">
                  <Coins size={12} className="text-amber-500" />
                  <span>Billing Currency:</span>
                </p>
                <p className="text-sm font-bold text-emerald-600 mt-0.5">{currentCompany.currency || "ZAR"}</p>
              </div>
              <div className="sm:col-span-3">
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
            <label className="mb-2 block font-medium text-foreground flex items-center gap-1.5">
              <Upload size={13} className="text-blue-500" />
              Company Logo
            </label>
            {/* Current logo preview */}
            {companyForm.logo_url && (
              <div className="mb-3 flex items-center gap-4 rounded-xl border border-border-color bg-surface-elevated/40 p-3">
                <img
                  src={companyForm.logo_url}
                  alt="Current Logo"
                  className="h-16 w-16 object-contain rounded-lg border border-border-color bg-white p-1"
                  onError={(e) => ((e.target as HTMLElement).style.display = "none")}
                />
                <div>
                  <p className="text-xs font-semibold text-foreground">Current logo</p>
                  <p className="text-[11px] text-muted mt-0.5">Appears on invoices, contracts, receipts, and the portal</p>
                </div>
              </div>
            )}
            {/* File Upload */}
            <div className="flex items-center gap-3">
              <label
                htmlFor="logo-file-upload"
                className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border-color bg-surface-elevated px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-elevated/70 transition ${logoUploading ? "opacity-60 pointer-events-none" : ""}`}
              >
                <Upload size={15} className="text-blue-500" />
                {logoUploading ? "Uploading..." : companyForm.logo_url ? "Change Logo" : "Upload Logo"}
              </label>
              <input
                id="logo-file-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setLogoUploading(true);
                  try {
                    const url = await uploadFileToBucket("company-logos", currentCompany.id, file);
                    setCompanyForm({ ...companyForm, logo_url: url });
                  } catch (err) {
                    alert(err instanceof Error ? err.message : "Upload failed");
                  } finally {
                    setLogoUploading(false);
                    e.target.value = "";
                  }
                }}
              />
              {companyForm.logo_url && (
                <button
                  type="button"
                  onClick={() => setCompanyForm({ ...companyForm, logo_url: "" })}
                  className="rounded-lg px-3 py-2 text-sm text-red-500 hover:bg-red-500/10 transition"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted">Or paste a URL below:</p>
            <input
              type="url"
              placeholder="https://example.com/logo.png"
              value={companyForm.logo_url}
              onChange={(e) => setCompanyForm({ ...companyForm, logo_url: e.target.value })}
              className="mt-1.5 w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600 font-mono text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-medium text-foreground flex items-center gap-1">
                <Globe size={13} className="text-blue-500" />
                <span>Operating Country *</span>
              </label>
              <select
                value={companyForm.country}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600"
              >
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.name}>
                    {c.name} ({c.currency})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block font-medium text-foreground flex items-center gap-1">
                <Coins size={13} className="text-amber-500" />
                <span>Billing Currency *</span>
              </label>
              <select
                value={companyForm.currency}
                onChange={(e) => setCompanyForm({ ...companyForm, currency: e.target.value })}
                className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600 font-mono font-semibold"
              >
                {COMMON_CURRENCIES.map((cur) => (
                  <option key={cur.code} value={cur.code}>
                    {cur.code} - {cur.name} ({cur.symbol})
                  </option>
                ))}
              </select>
            </div>
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
