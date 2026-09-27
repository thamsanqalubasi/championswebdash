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
  Phone,
  Loader2,
  Package,
  RotateCcw,
  Power,
  Sparkles,
  Clock,
  ArrowUpRight,
  BedDouble,
  Users,
  Layers,
} from "lucide-react";
import {
  SUBSCRIPTION_PACKAGES,
  getCompanySubscription,
  restartCompanyTrial,
  setPackageModeEnabled,
  switchCompanyPackage,
  markSubscriptionPaid,
  getRemainingTrialSeconds,
  isTrialExpired,
  formatTrialCountdown,
  TRIAL_PERIOD_DAYS,
  getTrialEndDateDisplay,
  isAccountUnsubscribed,
  type CompanySubscription,
  type PackageId,
} from "@/lib/packages";
import { PackageSwitcherModal, PackageCarousel, PlanCard } from "@/components/package-switcher-modal";
import { StripePaymentModal } from "@/components/stripe-payment-modal";
import { TrialOnboardingModal } from "@/components/trial-onboarding-modal";
import { CancelSubscriptionModal } from "@/components/cancel-subscription-modal";
import { DeleteAccountModal } from "@/components/delete-account-modal";
import { DeleteCompanyModal } from "@/components/delete-company-modal";
import { UnsubscribedGatewayModal } from "@/components/unsubscribed-gateway-modal";
import { EnterpriseSalesModal } from "@/components/enterprise-sales-modal";

export default function SettingsPage() {
  const { user, currentCompany, currentCompanyUser, setCurrentCompany, setCurrentCompanyUser, changePassword, isAdmin } = useAuth();
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

  // Subscription & Package Tier state
  const [sub, setSub] = useState<CompanySubscription>(() => getCompanySubscription(currentCompany.id));
  const [remSeconds, setRemSeconds] = useState<number>(() => getRemainingTrialSeconds(sub));
  const [packageModalOpen, setPackageModalOpen] = useState(false);
  const [stripeModalOpen, setStripeModalOpen] = useState(false);

  // New lifecycle modals
  const [trialOnboardingOpen, setTrialOnboardingOpen] = useState(false);
  const [cancelSubOpen, setCancelSubOpen] = useState(false);
  const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
  const [deleteCompanyOpen, setDeleteCompanyOpen] = useState(false);
  const [salesModalOpen, setSalesModalOpen] = useState(false);

  useEffect(() => {
    const handleSubUpdate = () => {
      const updated = getCompanySubscription(currentCompany.id);
      setSub(updated);
      setRemSeconds(getRemainingTrialSeconds(updated));
    };
    handleSubUpdate();
    window.addEventListener("paimba_package_changed", handleSubUpdate);
    return () => window.removeEventListener("paimba_package_changed", handleSubUpdate);
  }, [currentCompany.id]);

  // Handle return from Stripe Hosted Checkout redirect
  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get("payment") === "success") {
        const sessionId = searchParams.get("session_id") || `cs_${Date.now()}`;
        const updated = markSubscriptionPaid(currentCompany.id, sessionId, "stripe_checkout");
        setSub(updated);
        setPkgNotice("Stripe payment successful! Your subscription has been verified and activated.");
        setTimeout(() => setPkgNotice(null), 6000);
        // Clean URL parameter without reloading
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (searchParams.get("payment") === "cancelled") {
        setPkgNotice("Stripe checkout was cancelled. You can retry at any time.");
        setTimeout(() => setPkgNotice(null), 5000);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (e) {
      console.error("Error reading payment search params:", e);
    }
  }, [currentCompany.id]);

  useEffect(() => {
    if (!sub.packageModeEnabled || !sub.isTrial || sub.status === "active") return;
    const interval = setInterval(() => {
      const rem = getRemainingTrialSeconds(sub);
      setRemSeconds(rem);
      if (rem <= 0) {
        setSub((prev) => ({ ...prev, status: "expired" }));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sub]);

  const [pkgNotice, setPkgNotice] = useState<string | null>(null);
  const [trialMinutesSetting, setTrialMinutesSetting] = useState<number>(() =>
    Math.max(1, Math.round((sub.trialDurationSeconds || 60) / 60))
  );

  const handleSelectPackageFromSettings = (pkgId: PackageId) => {
    if (pkgId === "custom") {
      setSalesModalOpen(true);
      return;
    }
    if (pkgId === "test") {
      setStripeModalOpen(true);
      return;
    }
    const durationSeconds = trialMinutesSetting * 60;
    switchCompanyPackage(currentCompany.id, pkgId, true);
    const refreshed = restartCompanyTrial(currentCompany.id, durationSeconds);
    setSub(refreshed);
    setRemSeconds(durationSeconds);
    setPkgNotice(`Switched to ${SUBSCRIPTION_PACKAGES[pkgId].name}! (${trialMinutesSetting}-minute trial active)`);
    setTimeout(() => setPkgNotice(null), 3500);
  };

  const reload = () => setReloadKey((v) => v + 1);

  // Staff Personal Profile & Digital Signature state
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [staffForm, setStaffForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    jobTitle: "",
    signatureUrl: "",
  });
  const [sigUploading, setSigUploading] = useState(false);
  const [staffMsg, setStaffMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    async function loadStaffProfile() {
      const email = user?.email || currentCompanyUser?.email || "";
      const uid = user?.id || currentCompanyUser?.userId || email;
      let sig = localStorage.getItem(`staff_signature_${uid}`) || localStorage.getItem(`staff_signature_${email}`) || "";
      let phone = localStorage.getItem(`staff_phone_${uid}`) || localStorage.getItem(`staff_phone_${email}`) || "";

      if (email) {
        try {
          const { data: uData } = await supabase
            .from("users")
            .select("first_name, last_name, phone, signature_url")
            .eq("email", email)
            .limit(1)
            .maybeSingle();

          if (uData) {
            if (uData.signature_url) sig = uData.signature_url;
            if (uData.phone) phone = uData.phone;
          }
        } catch {}
      }

      setStaffForm({
        fullName: currentCompanyUser?.fullName || (user?.user_metadata?.full_name as string) || email.split("@")[0],
        email: email,
        phone: phone || (user?.user_metadata?.phone as string) || "",
        jobTitle: currentCompanyUser?.jobTitle || "Staff Member",
        signatureUrl: sig,
      });
    }
    void loadStaffProfile();
  }, [user, currentCompanyUser, reloadKey]);

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSigUploading(true);
    try {
      const url = await uploadFileToBucket("signatures", user?.id || "staff", file);
      setStaffForm((prev) => ({ ...prev, signatureUrl: url }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to upload signature");
    } finally {
      setSigUploading(false);
    }
  };

  const handleSaveStaffProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSaving(true);
    setStaffMsg(null);
    try {
      const email = staffForm.email.trim();
      const names = staffForm.fullName.trim().split(" ");
      const firstName = names[0] || "";
      const lastName = names.slice(1).join(" ") || "";
      const uid = user?.id || currentCompanyUser?.userId || email;

      // 1. Update Supabase Auth metadata and email (if changed)
      try {
        if (user && email && email !== user.email) {
          await supabase.auth.updateUser({ email });
        }
        await supabase.auth.updateUser({
          data: {
            full_name: staffForm.fullName,
            phone: staffForm.phone,
          },
        });
      } catch (authErr) {
        console.warn("Supabase auth updateUser:", authErr);
      }

      // 2. Update users table
      try {
        await supabase
          .from("users")
          .update({
            first_name: firstName,
            last_name: lastName,
            phone: staffForm.phone,
            signature_url: staffForm.signatureUrl,
            email: email,
          })
          .eq("email", currentCompanyUser?.email || user?.email);
      } catch (uErr) {
        console.warn("users table update:", uErr);
      }

      // 3. Update company_users table
      try {
        await supabase
          .from("company_users")
          .update({
            full_name: staffForm.fullName,
            phone: staffForm.phone,
            signature_url: staffForm.signatureUrl,
            email: email,
          })
          .eq("email", currentCompanyUser?.email || user?.email);
      } catch (cuErr) {
        console.warn("company_users table update:", cuErr);
      }

      // 4. Save to localStorage for instant client-side availability
      localStorage.setItem(`staff_signature_${uid}`, staffForm.signatureUrl);
      localStorage.setItem(`staff_signature_${email}`, staffForm.signatureUrl);
      localStorage.setItem(`staff_phone_${uid}`, staffForm.phone);
      localStorage.setItem(`staff_phone_${email}`, staffForm.phone);

      // 5. Update auth context state
      if (setCurrentCompanyUser && currentCompanyUser) {
        setCurrentCompanyUser({
          ...currentCompanyUser,
          fullName: staffForm.fullName,
          email: email,
        });
      }

      await logAuditEvent({
        companyId: currentCompany.id,
        action: "STAFF_PROFILE_UPDATED",
        entityType: "user_account",
        entityId: uid,
        entityName: staffForm.fullName,
        actorName: staffForm.fullName,
        details: "Staff member updated personal profile and digital signature credentials.",
      });

      setStaffMsg({ type: "success", text: "Profile and digital signature updated successfully!" });
      setProfileModalOpen(false);
      reload();
    } catch (err) {
      setStaffMsg({ type: "error", text: err instanceof Error ? err.message : "Failed to save profile." });
    } finally {
      setProfileSaving(false);
    }
  };

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
      setPasswordMsg({ type: "success", text: "Password updated successfully! A security confirmation email has been dispatched to your email." });
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
      <div className="max-w-4xl space-y-6 pb-16">
        {/* Subscription & Commercial Packages (Always accessible at top of Settings) */}
        <section className="rounded-2xl border border-border-color bg-surface p-6 shadow-sm">
          <div className="mb-6 flex flex-col justify-between gap-4 border-b border-border-color pb-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600">
                <Package size={20} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-foreground">Subscription & Billing Packages</h2>
                  <span className="rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-400">
                    Test Mode Active
                  </span>
                </div>
                <p className="text-xs text-muted">
                  Tiered subscription management, 1-minute trial countdown, Stripe sandbox payment, and feature quota controls.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPackageModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface-elevated px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-surface transition shadow-xs"
              >
                <ArrowUpRight size={13} />
                <span>Full Comparison Modal</span>
              </button>
            </div>
          </div>

          {pkgNotice && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-blue-600/15 border border-blue-500/30 p-3 text-xs text-blue-300 font-medium animate-in fade-in">
              <CheckCircle2 size={16} className="shrink-0 text-blue-400" />
              <span>{pkgNotice}</span>
            </div>
          )}

          {/* Plan Overview & Controls */}
          {(() => {
              const currentPlan = SUBSCRIPTION_PACKAGES[sub.packageId] || SUBSCRIPTION_PACKAGES.starter;
              const expired = isTrialExpired(sub);
              return (
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                    !sub.packageModeEnabled
                      ? "border-border-color bg-surface-elevated/70"
                      : expired
                      ? "border-red-500/40 bg-red-500/10"
                      : sub.status === "active"
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : "border-blue-500/30 bg-blue-500/10"
                  }`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-black text-foreground">{currentPlan.name}</span>
                        <span className="text-sm font-bold text-muted">(${currentPlan.priceUsd} / month)</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                          !sub.packageModeEnabled
                            ? "bg-muted/10 border-border-color text-muted"
                            : expired
                            ? "bg-red-500/20 border-red-500/40 text-red-400"
                            : sub.status === "active"
                            ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                            : "bg-blue-500/20 border-blue-500/40 text-blue-400"
                        }`}>
                          {!sub.packageModeEnabled
                            ? "Package Mode Disabled"
                            : expired
                            ? "Trial Expired"
                            : sub.status === "active"
                            ? "Active / Paid"
                            : `Trial (${formatTrialCountdown(remSeconds)} remaining)`}
                        </span>
                      </div>
                      <p className="text-xs text-muted mt-1">{currentPlan.tagline}</p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex items-center gap-1 bg-surface-elevated/70 p-1 rounded-xl border border-border-color">
                        <span className="text-[10px] font-bold text-muted px-1.5 uppercase">Minutes:</span>
                        {[1, 2, 3, 5, 10].map((mins) => (
                          <button
                            key={mins}
                            type="button"
                            onClick={() => {
                              setTrialMinutesSetting(mins);
                              const durationSeconds = mins * 60;
                              const updated = restartCompanyTrial(currentCompany.id, durationSeconds);
                              setSub(updated);
                              setRemSeconds(durationSeconds);
                              setPkgNotice(`Trial restarted for ${mins} minute${mins > 1 ? "s" : ""}!`);
                              setTimeout(() => setPkgNotice(null), 3000);
                            }}
                            className={`rounded-lg px-2 py-1 text-xs font-bold transition ${
                              trialMinutesSetting === mins
                                ? "bg-amber-500 text-black shadow-xs"
                                : "text-muted hover:text-foreground hover:bg-surface"
                            }`}
                            title={`Set trial duration to ${mins} minutes and restart`}
                          >
                            {mins}m
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const durationSeconds = trialMinutesSetting * 60;
                          const updated = restartCompanyTrial(currentCompany.id, durationSeconds);
                          setSub(updated);
                          setRemSeconds(durationSeconds);
                          setPkgNotice(`Trial restarted for ${trialMinutesSetting} minute${trialMinutesSetting > 1 ? "s" : ""}!`);
                          setTimeout(() => setPkgNotice(null), 3000);
                        }}
                        className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-elevated transition shadow-xs"
                      >
                        <RotateCcw size={13} className="text-amber-400" />
                        <span>Restart ({trialMinutesSetting}m)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setStripeModalOpen(true)}
                        className="flex items-center gap-1.5 rounded-xl border border-blue-500/40 bg-blue-600/20 px-3 py-1.5 text-xs font-bold text-blue-300 hover:bg-blue-600/30 transition shadow-xs"
                      >
                        <CreditCard size={13} />
                        <span>Pay ${SUBSCRIPTION_PACKAGES.test.priceUsd.toFixed(2)} via Stripe</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const nextVal = !sub.packageModeEnabled;
                          const updated = setPackageModeEnabled(currentCompany.id, nextVal);
                          setSub(updated);
                        }}
                        className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold border transition ${
                          sub.packageModeEnabled
                            ? "border-border-color bg-surface text-muted hover:text-red-400"
                            : "border-emerald-500 bg-emerald-600 text-white font-bold"
                        }`}
                      >
                        <Power size={13} />
                        <span>{sub.packageModeEnabled ? "Turn OFF Package Mode" : "Package Mode: OFF"}</span>
                      </button>
                    </div>
                  </div>

                  {/* Quotas & Capacity Limits */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-border-color bg-surface-elevated/50 p-3">
                      <div className="flex items-center gap-2 text-muted text-xs mb-1">
                        <Building2 size={14} className="text-blue-500" />
                        <span>Max Properties</span>
                      </div>
                      <span className="text-base font-bold text-foreground">
                        {currentPlan.limits.maxProperties === -1 ? "Unlimited" : currentPlan.limits.maxProperties}
                      </span>
                    </div>

                    <div className="rounded-xl border border-border-color bg-surface-elevated/50 p-3">
                      <div className="flex items-center gap-2 text-muted text-xs mb-1">
                        <BedDouble size={14} className="text-emerald-500" />
                        <span>Max Rooms</span>
                      </div>
                      <span className="text-base font-bold text-foreground">
                        {currentPlan.limits.maxRooms === -1 ? "Unlimited" : currentPlan.limits.maxRooms}
                      </span>
                    </div>

                    <div className="rounded-xl border border-border-color bg-surface-elevated/50 p-3">
                      <div className="flex items-center gap-2 text-muted text-xs mb-1">
                        <Users size={14} className="text-violet-500" />
                        <span>Max Tenants</span>
                      </div>
                      <span className="text-base font-bold text-foreground">
                        {currentPlan.limits.maxTenants === -1 ? "Unlimited" : currentPlan.limits.maxTenants}
                      </span>
                    </div>

                    <div className="rounded-xl border border-border-color bg-surface-elevated/50 p-3">
                      <div className="flex items-center gap-2 text-muted text-xs mb-1">
                        <Layers size={14} className="text-amber-500" />
                        <span>Max Staff Users</span>
                      </div>
                      <span className="text-base font-bold text-foreground">
                        {currentPlan.limits.maxStaff === -1 ? "Unlimited" : currentPlan.limits.maxStaff}
                      </span>
                    </div>
                  </div>

                  {/* Direct 5-Plan Selector Grid Right on Settings Page */}
                  <div className="pt-2 border-t border-border-color">
                    <div className="flex items-center justify-between mb-2.5">
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                          Change Package (Click Any Plan to Switch)
                        </h4>
                        <p className="text-[11px] text-muted">
                          Select any tier below to test functionality. Non-test tiers switch instantly with no card needed.
                        </p>
                      </div>
                    </div>

                    <PackageCarousel
                      currentPackageId={sub.packageId}
                      onSelectPackage={handleSelectPackageFromSettings}
                    />
                  </div>

                  <div className="rounded-xl border border-border-color bg-surface-elevated/40 p-3 text-xs">
                    <p className="font-semibold text-foreground mb-1">Active Tier Commercial Rationale:</p>
                    <p className="text-muted leading-relaxed">{currentPlan.commercialRationale.whyThisPrice}</p>
                  </div>

                  {/* Free Trial CTA - shown when not on an active paid subscription */}
                  {(sub.status === "trial" || sub.status === "expired" || !sub.stripeSubscriptionId) && (
                    <div className="rounded-xl border border-blue-500/30 bg-gradient-to-r from-blue-500/10 to-violet-500/10 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-foreground">Start Your Free {TRIAL_PERIOD_DAYS}-Day Trial</p>
                        <p className="text-xs text-muted mt-0.5">
                          Choose your plan. Save your card. No charge for {TRIAL_PERIOD_DAYS} days. Cancel anytime before trial ends.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setTrialOnboardingOpen(true)}
                        className="shrink-0 flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:opacity-90 transition"
                      >
                        <Sparkles size={14} />
                        Start Free Trial
                      </button>
                    </div>
                  )}

                  {/* Cancel Subscription - shown only when actively subscribed */}
                  {(sub.status === "active" || sub.status === "cancelling") && sub.stripeSubscriptionId && (
                    <div className="rounded-xl border border-border-color bg-surface-elevated/40 p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-foreground">Subscription Management</p>
                        <p className="text-[11px] text-muted mt-0.5">
                          {sub.status === "cancelling"
                            ? "Your subscription is scheduled to cancel at end of billing period."
                            : `Active subscription. You are billed $${currentPlan.priceUsd}/month. Cancel anytime.`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCancelSubOpen(true)}
                        disabled={sub.status === "cancelling"}
                        className="shrink-0 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sub.status === "cancelling" ? "Cancellation Pending" : "Cancel Subscription"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </section>

          {/* Danger Zone - Account & Company Deletion */}
          <section className="rounded-2xl border border-red-500/20 bg-surface p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-3 pb-4 border-b border-red-500/20">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600/10 text-red-500">
                <AlertCircle size={20} />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">Danger Zone</h2>
                <p className="text-xs text-muted">Irreversible account and company management actions. Proceed with caution.</p>
              </div>
            </div>

            <div className="space-y-3">
              {/* Delete My Account (all users) */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-border-color bg-surface-elevated/40 p-4">
                <div>
                  <p className="text-xs font-bold text-foreground">Delete My Account</p>
                  <p className="text-[11px] text-muted mt-0.5">
                    Permanently removes your personal account after a 30-day freeze window.
                    Log in within 30 days to cancel the deletion.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeleteAccountOpen(true)}
                  className="shrink-0 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs font-bold text-red-400 hover:bg-red-500/20 transition"
                >
                  Delete Account
                </button>
              </div>

              {/* Delete Company (Super Admin only) */}
              {currentCompanyUser?.roleLevel === "super_admin" && (
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
                  <div>
                    <p className="text-xs font-bold text-red-400">Delete Company - Super Admin Only</p>
                    <p className="text-[11px] text-muted mt-0.5">
                      Permanently deletes this company and notifies all staff. 30-day freeze before permanent data removal.
                      All staff accounts go on hold for 30 days.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteCompanyOpen(true)}
                    className="shrink-0 flex items-center gap-2 rounded-xl border border-red-600/50 bg-red-600/20 px-3.5 py-2 text-xs font-bold text-red-400 hover:bg-red-600/30 transition"
                  >
                    Delete Company
                  </button>
                </div>
              )}
            </div>
          </section>

          {loading && <LoadingState label="Synchronizing cloud settings..." />}
          {!loading && error && <ErrorState message={error} onRetry={reload} />}
          {!loading && !error && data && (
            <>
              {/* Staff Personal Profile & Digital Signature */}
              <section className="rounded-2xl border border-border-color bg-surface p-6 shadow-sm">
            <SectionHeader
              icon={UserIcon}
              title="Staff Profile & Digital Signature"
              description="Your profile credentials and official digital signature stamped on Lease Agreements, invoices, receipts, and folios."
              onEdit={() => setProfileModalOpen(true)}
            />

            {staffMsg && (
              <div
                className={`mb-4 flex items-center gap-2 rounded-xl p-3 text-xs font-medium ${
                  staffMsg.type === "success"
                    ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                    : "bg-red-500/10 text-red-600 border border-red-500/20"
                }`}
              >
                {staffMsg.type === "success" ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span>{staffMsg.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {/* Profile Card */}
              <div className="rounded-xl bg-surface-elevated/60 p-4 text-xs space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Staff Member</p>
                    <span className="rounded-md bg-blue-500/10 px-2.5 py-0.5 text-xs font-bold text-blue-600">
                      {staffForm.jobTitle}
                    </span>
                  </div>
                  <div>
                    <p className="text-base font-black text-foreground">{staffForm.fullName}</p>
                    <p className="text-muted flex items-center gap-1.5 mt-1 font-medium">
                      <Mail size={13} className="text-blue-500" />
                      <span>{staffForm.email}</span>
                    </p>
                    <p className="text-muted flex items-center gap-1.5 mt-1 font-medium">
                      <Phone size={13} className="text-emerald-500" />
                      <span>{staffForm.phone || "Phone not configured"}</span>
                    </p>
                  </div>
                </div>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setProfileModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border-color bg-surface px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-elevated transition shadow-xs"
                  >
                    <Pencil size={12} />
                    <span>Edit Profile & Phone</span>
                  </button>
                </div>
              </div>

              {/* Digital Signature Card */}
              <div className="rounded-xl bg-surface-elevated/60 p-4 text-xs space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-1">
                      <FileSignature size={13} className="text-blue-500" />
                      <span>Digital Stamp / Signature</span>
                    </p>
                    {staffForm.signatureUrl ? (
                      <span className="rounded-md bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600">
                        ● Active on File
                      </span>
                    ) : (
                      <span className="rounded-md bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-600">
                        ○ Missing Signature
                      </span>
                    )}
                  </div>

                  {staffForm.signatureUrl ? (
                    <div className="rounded-xl border border-border-color bg-white dark:bg-slate-900 p-3 flex items-center justify-center min-h-[85px] shadow-inner">
                      <img
                        src={staffForm.signatureUrl}
                        alt="Digital Signature"
                        className="max-h-16 object-contain"
                      />
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border-color bg-surface p-4 text-center text-muted">
                      <p className="font-semibold text-foreground text-xs">No digital signature on file</p>
                      <p className="text-[11px] mt-0.5 leading-relaxed">
                        Upload your signature image (PNG/JPEG) to automatically endorse contracts and receipts.
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setProfileModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition shadow-xs"
                  >
                    <Upload size={12} />
                    <span>{staffForm.signatureUrl ? "Update Signature" : "Upload Signature"}</span>
                  </button>
                  {staffForm.signatureUrl && (
                    <button
                      type="button"
                      onClick={() => {
                        setStaffForm((prev) => ({ ...prev, signatureUrl: "" }));
                        const uid = user?.id || currentCompanyUser?.userId || staffForm.email;
                        localStorage.removeItem(`staff_signature_${uid}`);
                        localStorage.removeItem(`staff_signature_${staffForm.email}`);
                      }}
                      className="rounded-lg px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-500/10 transition font-medium"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>
          </section>

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
        </>
      )}
    </div>

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

      {/* Edit Staff Profile & Digital Signature Modal */}
      <Modal open={profileModalOpen} onClose={() => setProfileModalOpen(false)} title="Edit Staff Profile & Signature">
        <form onSubmit={handleSaveStaffProfile} className="space-y-4 text-xs">
          <div>
            <label className="mb-1 block font-medium text-foreground">Full Name *</label>
            <input
              type="text"
              required
              value={staffForm.fullName}
              onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })}
              placeholder="First and Last Name"
              className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600 font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-medium text-foreground">Email Address *</label>
              <input
                type="email"
                required
                value={staffForm.email}
                onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600 font-medium"
              />
            </div>
            <div>
              <label className="mb-1 block font-medium text-foreground">Phone / WhatsApp</label>
              <input
                type="text"
                placeholder="+27 XX XXX XXXX"
                value={staffForm.phone}
                onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600 font-medium"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-medium text-foreground">Job Title / Role</label>
            <input
              type="text"
              disabled
              value={staffForm.jobTitle}
              className="w-full rounded-xl border border-border-color bg-surface-elevated/50 px-3 py-2 text-muted font-medium cursor-not-allowed"
            />
            <p className="text-[10px] text-muted mt-0.5">Role level managed by organization administrator.</p>
          </div>

          {/* Digital Signature Upload */}
          <div className="pt-2 border-t border-border-color">
            <label className="mb-2 block font-medium text-foreground flex items-center gap-1.5">
              <FileSignature size={14} className="text-blue-500" />
              <span>Digital Signature Stamp (Clear PNG or JPG Recommended)</span>
            </label>

            {staffForm.signatureUrl && (
              <div className="mb-3 flex items-center gap-4 rounded-xl border border-border-color bg-white dark:bg-slate-900 p-3">
                <img
                  src={staffForm.signatureUrl}
                  alt="Signature Preview"
                  className="h-14 max-w-[200px] object-contain"
                />
                <div className="text-xs">
                  <p className="font-semibold text-foreground">Active Signature</p>
                  <p className="text-[11px] text-muted">Ready to stamp on lease agreements and folios.</p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3">
              <label
                className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border-color bg-surface-elevated px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface transition ${
                  sigUploading ? "opacity-60 pointer-events-none" : ""
                }`}
              >
                {sigUploading ? <Loader2 size={14} className="animate-spin text-blue-600" /> : <Upload size={14} className="text-blue-500" />}
                <span>{sigUploading ? "Uploading Signature..." : staffForm.signatureUrl ? "Change Signature File" : "Upload Signature File"}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleSignatureUpload}
                  disabled={sigUploading}
                />
              </label>

              {staffForm.signatureUrl && (
                <button
                  type="button"
                  onClick={() => setStaffForm({ ...staffForm, signatureUrl: "" })}
                  className="rounded-lg px-3 py-2 text-xs text-red-500 hover:bg-red-500/10 transition font-medium"
                >
                  Clear Signature
                </button>
              )}
            </div>

            <p className="mt-2 text-[11px] text-muted">Or enter a direct signature image URL:</p>
            <input
              type="url"
              placeholder="https://.../signature.png"
              value={staffForm.signatureUrl}
              onChange={(e) => setStaffForm({ ...staffForm, signatureUrl: e.target.value })}
              className="mt-1 w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600 font-mono text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border-color">
            <button
              type="button"
              onClick={() => setProfileModalOpen(false)}
              className="rounded-xl border border-border-color px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-elevated transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={profileSaving || sigUploading}
              className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {profileSaving ? <Loader2 size={14} className="animate-spin" /> : null}
              <span>{profileSaving ? "Saving..." : "Save Profile & Signature"}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Package Switcher Modal */}
      <PackageSwitcherModal
        open={packageModalOpen}
        onClose={() => setPackageModalOpen(false)}
        companyId={currentCompany.id}
      />

      {/* Stripe Payment Gateway Modal */}
      <StripePaymentModal
        open={stripeModalOpen}
        onClose={() => setStripeModalOpen(false)}
        companyId={currentCompany.id}
        amountUsd={SUBSCRIPTION_PACKAGES.test.priceUsd}
        packageTitle={SUBSCRIPTION_PACKAGES.test.name}
        onSuccess={() => {
          setSub(getCompanySubscription(currentCompany.id));
          setStripeModalOpen(false);
        }}
      />

      {/* Trial Onboarding Modal (3-step: welcome → choose plan → card details) */}
      <TrialOnboardingModal
        open={trialOnboardingOpen}
        onClose={() => setTrialOnboardingOpen(false)}
        companyId={currentCompany.id}
        customerEmail={user?.email}
        onSuccess={(pkgId) => {
          setSub(getCompanySubscription(currentCompany.id));
          setTrialOnboardingOpen(false);
          setPkgNotice(`${TRIAL_PERIOD_DAYS}-day free trial started for ${SUBSCRIPTION_PACKAGES[pkgId]?.name}! First charge on ${getTrialEndDateDisplay(getCompanySubscription(currentCompany.id))}.`);
          setTimeout(() => setPkgNotice(null), 6000);
        }}
      />

      {/* Cancel Subscription Modal */}
      <CancelSubscriptionModal
        open={cancelSubOpen}
        onClose={() => setCancelSubOpen(false)}
        companyId={currentCompany.id}
        packageName={SUBSCRIPTION_PACKAGES[sub.packageId]?.name}
        onCancelled={() => {
          setSub(getCompanySubscription(currentCompany.id));
          setCancelSubOpen(false);
        }}
      />

      {/* Delete Account Modal (all users) */}
      <DeleteAccountModal
        open={deleteAccountOpen}
        onClose={() => setDeleteAccountOpen(false)}
        userId={user?.id || ""}
        userEmail={user?.email || ""}
        userName={currentCompanyUser?.fullName || user?.email || "Unknown"}
        isSuperAdmin={currentCompanyUser?.roleLevel === "super_admin"}
        onDeleted={() => {
          setDeleteAccountOpen(false);
          // Sign user out after deletion
          supabase.auth.signOut();
        }}
      />

      {/* Delete Company Modal (Super Admin only) */}
      {currentCompanyUser?.roleLevel === "super_admin" && (
        <DeleteCompanyModal
          open={deleteCompanyOpen}
          onClose={() => setDeleteCompanyOpen(false)}
          companyId={currentCompany.id}
          companyName={currentCompany.name || ""}
          onDeleted={() => {
            setDeleteCompanyOpen(false);
            supabase.auth.signOut();
          }}
        />
      )}

      {/* Unsubscribed Gateway Modal (shown when subscription is cancelled/frozen) */}
      {isAccountUnsubscribed(sub) && (
        <UnsubscribedGatewayModal
          companyId={currentCompany.id}
          customerEmail={user?.email}
          onReactivated={() => setSub(getCompanySubscription(currentCompany.id))}
        />
      )}

      {/* Custom Enterprise Sales Consultation Modal */}
      <EnterpriseSalesModal
        open={salesModalOpen}
        onClose={() => setSalesModalOpen(false)}
        companyId={currentCompany.id}
        defaultEmail={user?.email || ""}
        defaultCompanyName={currentCompany.name || ""}
      />
    </ModulePage>
  );
}
