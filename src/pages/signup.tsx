import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { fetchCompanyBySlug } from "@/lib/data";
import {
  Building2,
  Lock,
  Mail,
  User,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Globe,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Coins,
} from "lucide-react";

const COUNTRY_PRESETS = [
  { code: "ZA", name: "South Africa", currency: "ZAR", taxRate: 15 },
  { code: "NA", name: "Namibia", currency: "NAD", taxRate: 15 },
  { code: "BW", name: "Botswana", currency: "BWP", taxRate: 14 },
  { code: "ZW", name: "Zimbabwe", currency: "USD", taxRate: 15 },
  { code: "KE", name: "Kenya", currency: "KES", taxRate: 16 },
  { code: "NG", name: "Nigeria", currency: "NGN", taxRate: 7.5 },
  { code: "GB", name: "United Kingdom", currency: "GBP", taxRate: 20 },
  { code: "US", name: "United States", currency: "USD", taxRate: 8.5 },
  { code: "AE", name: "United Arab Emirates", currency: "AED", taxRate: 5 },
];

export default function SignupPage() {
  const { signUpCompany, user } = useAuth();
  const navigate = useNavigate();

  // Organization Info
  const [companyName, setCompanyName] = useState("");
  const [companySlug, setCompanySlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugChecking, setSlugChecking] = useState(false);
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [country, setCountry] = useState("South Africa");
  const [currency, setCurrency] = useState("ZAR");
  const [taxRate, setTaxRate] = useState<number>(15.0);
  const [phone, setPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");

  // Super Admin Owner Info
  const [adminFirstName, setAdminFirstName] = useState("");
  const [adminLastName, setAdminLastName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // If already logged in
  useEffect(() => {
    if (user) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate]);

  // Auto-generate slug from company name if user hasn't typed custom slug
  const handleCompanyNameChange = (val: string) => {
    setCompanyName(val);
    if (!slugTouched) {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-");
      setCompanySlug(generated);
    }
  };

  // Debounced check for slug availability
  useEffect(() => {
    if (!companySlug.trim()) {
      setSlugAvailable(null);
      return;
    }

    const cleanSlug = companySlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    setSlugChecking(true);

    const timer = setTimeout(async () => {
      try {
        const found = await fetchCompanyBySlug(cleanSlug);
        setSlugAvailable(!found);
      } catch {
        setSlugAvailable(true);
      } finally {
        setSlugChecking(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [companySlug]);

  const handleCountryChange = (selectedCountryName: string) => {
    setCountry(selectedCountryName);
    const preset = COUNTRY_PRESETS.find((c) => c.name === selectedCountryName);
    if (preset) {
      setCurrency(preset.currency);
      setTaxRate(preset.taxRate);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!companyName.trim()) {
      setError("Please enter your organization or company name.");
      return;
    }

    if (!companySlug.trim()) {
      setError("Please provide a unique portal URL slug for your company.");
      return;
    }

    if (slugAvailable === false) {
      setError("This URL slug is already taken. Please pick another unique slug.");
      return;
    }

    if (!adminFirstName.trim() || !adminLastName.trim()) {
      setError("Please provide your first and last name.");
      return;
    }

    if (!adminEmail.trim()) {
      setError("Please enter your work email address.");
      return;
    }

    if (adminPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (adminPassword !== confirmPassword) {
      setError("Passwords do not match. Please verify and try again.");
      return;
    }

    setLoading(true);
    try {
      const result = await signUpCompany({
        companyName: companyName.trim(),
        companySlug: companySlug.trim().toLowerCase(),
        country,
        currency,
        taxRate,
        phone,
        companyEmail: companyEmail.trim() || adminEmail.trim(),
        adminFirstName: adminFirstName.trim(),
        adminLastName: adminLastName.trim(),
        adminEmail: adminEmail.trim(),
        adminPassword,
      });

      if (result.error) {
        setError(result.error);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register organization.");
    } finally {
      setLoading(false);
    }
  };

  const previewOrigin = typeof window !== "undefined" ? window.location.origin : "https://domain.com";

  return (
    <main className="min-h-screen bg-background py-10 px-4 flex flex-col items-center justify-center">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 shadow-inner">
            <Building2 size={32} />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground">
            Create Your Company Organization
          </h1>
          <p className="text-sm text-muted max-w-md mx-auto">
            WordPress-style multi-tenant SaaS architecture. Each organization gets its own dedicated portal, isolated data, and custom branding.
          </p>
        </div>

        {/* Card */}
        <section className="rounded-2xl border border-border-color bg-surface p-6 sm:p-8 shadow-xl">
          {success ? (
            <div className="space-y-4 rounded-xl bg-emerald-500/10 p-8 text-center text-emerald-600">
              <CheckCircle2 size={48} className="mx-auto text-emerald-600 animate-bounce" />
              <h2 className="text-xl font-black">Organization Provisioned!</h2>
              <p className="text-sm text-emerald-700/90">
                Welcome, <strong>{companyName}</strong>! Initializing your private dashboard and property database...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6 text-xs">
              {error && (
                <div className="flex items-start gap-2.5 rounded-xl bg-red-500/10 p-3.5 text-xs text-red-600 font-medium">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Section 1: Company Details */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-border-color/60 pb-2">
                  <Building2 size={16} className="text-blue-600" />
                  <h3 className="text-sm font-bold text-foreground">
                    1. Organization &amp; Custom Portal URL
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="block font-semibold text-foreground">
                      Company / Property Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Savannah Royal Safari Lodge"
                      value={companyName}
                      onChange={(e) => handleCompanyNameChange(e.target.value)}
                      className="w-full rounded-xl border border-border-color bg-surface-elevated px-3.5 py-2.5 text-foreground outline-none focus:border-blue-600 transition"
                    />
                  </div>

                  {/* Slug & URL preview */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <label className="block font-semibold text-foreground">
                        Dedicated Portal URL Slug *
                      </label>
                      {slugChecking && (
                        <span className="text-[10px] text-muted animate-pulse">
                          Checking availability...
                        </span>
                      )}
                      {!slugChecking && slugAvailable === true && companySlug && (
                        <span className="text-[10px] font-bold text-emerald-600 flex items-center gap-1">
                          <CheckCircle2 size={12} /> Available
                        </span>
                      )}
                      {!slugChecking && slugAvailable === false && (
                        <span className="text-[10px] font-bold text-red-500 flex items-center gap-1">
                          <AlertCircle size={12} /> Already taken
                        </span>
                      )}
                    </div>
                    <div className="flex items-center rounded-xl border border-border-color bg-surface-elevated overflow-hidden focus-within:border-blue-600 transition">
                      <span className="px-3 text-[11px] text-muted bg-surface/50 font-mono border-r border-border-color">
                        {previewOrigin}/c/
                      </span>
                      <input
                        type="text"
                        required
                        placeholder="savannah-royal"
                        value={companySlug}
                        onChange={(e) => {
                          setSlugTouched(true);
                          setCompanySlug(
                            e.target.value
                              .toLowerCase()
                              .replace(/[^a-z0-9-]/g, "-")
                              .replace(/-+/g, "-")
                          );
                        }}
                        className="flex-1 bg-transparent px-3 py-2.5 text-foreground font-mono outline-none"
                      />
                      <span className="px-3 text-[11px] text-muted bg-surface/50 font-mono border-l border-border-color">
                        /login
                      </span>
                    </div>
                    <p className="text-[11px] text-muted">
                      Your staff and clients will access your branded portal via this unique link.
                    </p>
                  </div>

                  {/* Country & Currency */}
                  <div className="space-y-1.5">
                    <label className="block font-semibold text-foreground">
                      Operating Country
                    </label>
                    <select
                      value={country}
                      onChange={(e) => handleCountryChange(e.target.value)}
                      className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2.5 text-foreground outline-none focus:border-blue-600 transition"
                    >
                      {COUNTRY_PRESETS.map((c) => (
                        <option key={c.code} value={c.name}>
                          {c.name} ({c.currency})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-semibold text-foreground">
                      Billing Currency
                    </label>
                    <input
                      type="text"
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                      placeholder="ZAR"
                      className="w-full rounded-xl border border-border-color bg-surface-elevated px-3.5 py-2.5 text-foreground uppercase outline-none focus:border-blue-600 transition font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-semibold text-foreground">
                      Standard VAT / Tax Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={taxRate}
                      onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                      className="w-full rounded-xl border border-border-color bg-surface-elevated px-3.5 py-2.5 text-foreground outline-none focus:border-blue-600 transition"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-semibold text-foreground">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+27 11 000 0000"
                      className="w-full rounded-xl border border-border-color bg-surface-elevated px-3.5 py-2.5 text-foreground outline-none focus:border-blue-600 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Super Admin Account */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center gap-2 border-b border-border-color/60 pb-2">
                  <User size={16} className="text-blue-600" />
                  <h3 className="text-sm font-bold text-foreground">
                    2. Super Admin Account Credentials
                  </h3>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="block font-semibold text-foreground">
                      Admin First Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. John"
                      value={adminFirstName}
                      onChange={(e) => setAdminFirstName(e.target.value)}
                      className="w-full rounded-xl border border-border-color bg-surface-elevated px-3.5 py-2.5 text-foreground outline-none focus:border-blue-600 transition"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-semibold text-foreground">
                      Admin Last Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Doe"
                      value={adminLastName}
                      onChange={(e) => setAdminLastName(e.target.value)}
                      className="w-full rounded-xl border border-border-color bg-surface-elevated px-3.5 py-2.5 text-foreground outline-none focus:border-blue-600 transition"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="block font-semibold text-foreground">
                      Work Email Address (Super Admin Login) *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="admin@yourcompany.com"
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full rounded-xl border border-border-color bg-surface-elevated px-3.5 py-2.5 text-foreground outline-none focus:border-blue-600 transition"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-semibold text-foreground">
                      Password * (min. 6 chars)
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        placeholder="••••••••"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        className="w-full rounded-xl border border-border-color bg-surface-elevated pl-3.5 pr-10 py-2.5 text-foreground outline-none focus:border-blue-600 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block font-semibold text-foreground">
                      Confirm Password *
                    </label>
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-xl border border-border-color bg-surface-elevated px-3.5 py-2.5 text-foreground outline-none focus:border-blue-600 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || slugAvailable === false}
                className="w-full rounded-xl bg-blue-600 py-3 font-bold text-white shadow-lg hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2 text-sm"
              >
                {loading ? (
                  <span>Provisioning Organization...</span>
                ) : (
                  <>
                    <span>Create Organization &amp; Open Portal</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>

              <div className="text-center pt-2 border-t border-border-color/60 text-xs text-muted">
                Already registered your company?{" "}
                <Link to="/login" className="font-bold text-blue-600 hover:underline">
                  Sign In to Existing Portal
                </Link>
              </div>
            </form>
          )}
        </section>

        {/* Security badge footer */}
        <div className="flex items-center justify-center gap-6 text-[11px] text-muted">
          <div className="flex items-center gap-1.5">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>Isolated Tenant Data</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Globe size={14} className="text-blue-500" />
            <span>Dedicated URL Routing</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Sparkles size={14} className="text-amber-500" />
            <span>Custom Branding</span>
          </div>
        </div>
      </div>
    </main>
  );
}

