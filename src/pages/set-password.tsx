import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useParams, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { fetchCompanyBySlug, verifyNewStaffEligibility, type StaffEligibilityResult } from "@/lib/data";
import { sendEmailViaApi, wrapPasswordChangeConfirmationEmailHtml } from "@/lib/notifications";
import { TermsCheckboxField } from "@/components/terms-modal";
import type { Company } from "@/lib/types";
import {
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ArrowLeft,
  Globe,
  Loader2,
  Lock,
  ArrowRight,
  UserCheck,
} from "lucide-react";

export default function SetPasswordPage() {
  const { setupFirstTimePassword, user, setCurrentCompany } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { companySlug } = useParams<{ companySlug?: string }>();

  const [company, setCompany] = useState<Company | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Real-time staff database eligibility state
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [eligibility, setEligibility] = useState<StaffEligibilityResult | null>(null);

  // If user navigated with action=reset, redirect strictly to the reset password page
  useEffect(() => {
    if (searchParams.get("action") === "reset") {
      const qEmail = searchParams.get("email");
      navigate(`/auth/reset-password${qEmail ? `?email=${encodeURIComponent(qEmail)}` : ""}`, { replace: true });
    }
  }, [searchParams, navigate]);

  // Load custom company branding if companySlug is present
  useEffect(() => {
    if (!companySlug) {
      setCompany(null);
      return;
    }

    fetchCompanyBySlug(companySlug).then((comp) => {
      if (comp) {
        setCompany(comp);
        setCurrentCompany(comp);
      }
    });
  }, [companySlug, setCurrentCompany]);

  // Populate email from URL query if present
  useEffect(() => {
    const queryEmail = searchParams.get("email");
    if (queryEmail) {
      setEmail(decodeURIComponent(queryEmail));
    }
  }, [searchParams]);

  // If already logged in and not setting password via query, redirect to dashboard
  useEffect(() => {
    if (user && !searchParams.get("email")) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate, searchParams]);

  // Strictly verify email against the database
  useEffect(() => {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) {
      setEligibility(null);
      return;
    }

    let active = true;
    setCheckingEligibility(true);
    const timer = setTimeout(async () => {
      const res = await verifyNewStaffEligibility(trimmed);
      if (active) {
        setEligibility(res);
        setCheckingEligibility(false);
        if (!res.eligible) {
          setError(res.error || "This email is not authorized for staff password creation.");
        } else {
          setError(null);
        }
      }
    }, 350);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [email]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Please enter your registered work email.");
      return;
    }

    // STRICT DATABASE ENFORCEMENT:
    // Block any random email, existing account, or non-staff email
    if (!eligibility || !eligibility.eligible) {
      setError(eligibility?.error || "This email does not belong to an invited, newly added staff member.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please verify and try again.");
      return;
    }

    if (!agreedToTerms) {
      setError("You must review and agree to the Platform Terms of Service & Regulatory Compliance Policy to activate your account.");
      return;
    }

    setLoading(true);
    try {
      const result = await setupFirstTimePassword(email, password);
      if (result.error) {
        setError(result.error);
        return;
      }

      if (company) {
        setCurrentCompany(company);
      }

      try {
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        const portalLoginUrl = companySlug ? `${origin}/c/${companySlug}/login` : `${origin}/login`;
        const emailHtml = wrapPasswordChangeConfirmationEmailHtml({
          recipientName: eligibility.fullName || email,
          userEmail: email,
          companyName: eligibility.companyName || orgName,
          companyLogo: company?.logoUrl,
          portalLoginUrl,
          changeType: "initial_setup",
        });
        void sendEmailViaApi({
          to: email,
          subject: `Account Security: Staff Credentials Established - ${eligibility.companyName || orgName}`,
          html: emailHtml,
        });
      } catch (emailErr) {
        console.warn("Could not dispatch password confirmation email", emailErr);
      }

      setSuccess(true);
      setTimeout(() => {
        navigate("/dashboard", { replace: true });
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not set password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const backLoginUrl = companySlug ? `/c/${companySlug}/login` : "/login";
  const orgName = company ? company.name : "Paimbabook";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <section className="w-full max-w-md space-y-6 rounded-2xl border border-border-color bg-surface p-8 shadow-xl">
        <header className="text-center">
          {company?.logoUrl ? (
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-border-color bg-surface-elevated p-1 shadow-sm">
              <img
                src={company.logoUrl}
                alt={company.name}
                className="h-full w-full object-contain"
              />
            </div>
          ) : (
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 shadow-inner">
              {company ? (
                <span className="text-2xl font-black">{company.name.charAt(0)}</span>
              ) : (
                <KeyRound size={28} />
              )}
            </div>
          )}

          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Staff Password Setup
          </h1>
          <p className="mt-1.5 text-xs text-muted leading-relaxed">
            Welcome to the team! Establish your initial staff password to activate company portal access.
          </p>
          {companySlug && (
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-blue-600">
              <Globe size={10} />
              <span>/c/{companySlug}</span>
            </div>
          )}
        </header>

        {/* Security Warning Notice */}
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-[11px] text-muted space-y-1">
          <p className="font-semibold text-blue-400 flex items-center gap-1.5">
            <Lock size={13} />
            Restricted Staff Portal
          </p>
          <p className="leading-relaxed">
            This setup page is exclusively for newly invited staff members. It does not accept random emails or existing accounts. If you forgot your password, please use the{" "}
            <Link to={`/auth/reset-password${email ? `?email=${encodeURIComponent(email)}` : ""}`} className="text-blue-500 underline font-semibold">
              Reset Password
            </Link>{" "}
            page.
          </p>
        </div>

        {success ? (
          <div className="space-y-4 rounded-xl bg-emerald-500/10 p-5 text-center text-emerald-600">
            <CheckCircle2 size={36} className="mx-auto text-emerald-600 animate-bounce" />
            <div>
              <p className="font-bold text-sm">Account Activated Successfully!</p>
              <p className="text-xs text-emerald-700/80 mt-1">Logging you in to your dashboard...</p>
            </div>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            {/* Error Banner with helpful direct links */}
            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 space-y-2">
                <div className="flex items-start gap-2 text-xs text-red-500 font-medium">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{error}</span>
                </div>
                {eligibility?.status === "already_active" && (
                  <div className="flex items-center gap-2 pt-1 border-t border-red-500/20 text-xs">
                    <Link
                      to={`/auth/reset-password?email=${encodeURIComponent(email)}`}
                      className="inline-flex items-center gap-1 font-bold text-blue-500 hover:underline"
                    >
                      <span>Reset Password</span>
                      <ArrowRight size={12} />
                    </Link>
                    <span className="text-muted">•</span>
                    <Link to="/login" className="font-semibold text-muted hover:text-foreground">
                      Sign In
                    </Link>
                  </div>
                )}
                {eligibility?.status === "not_staff" && (
                  <div className="pt-1 border-t border-red-500/20 text-[11px] text-muted">
                    If you are an existing customer or staff member, you can{" "}
                    <Link to={`/auth/reset-password?email=${encodeURIComponent(email)}`} className="text-blue-500 underline font-semibold">
                      reset your password
                    </Link>{" "}
                    or contact your company administrator.
                  </div>
                )}
              </div>
            )}

            {/* Verified Newly Added Staff Badge */}
            {eligibility?.eligible && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 flex items-center gap-2.5 animate-in fade-in">
                <UserCheck size={18} className="text-emerald-400 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-emerald-300">Verified Newly Added Staff</p>
                  <p className="text-[11px] text-emerald-400/90 truncate">
                    {eligibility.jobTitle} • {eligibility.companyName}
                  </p>
                </div>
              </div>
            )}

            {/* Email Field with Live Verification indicator */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="email" className="block text-xs font-semibold text-foreground">
                  Work Email Address
                </label>
                {checkingEligibility && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted">
                    <Loader2 size={11} className="animate-spin text-blue-500" />
                    <span>Verifying staff status...</span>
                  </span>
                )}
              </div>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={company?.email || "name@company.co.za"}
                required
                className={`w-full rounded-xl border bg-surface-elevated px-3.5 py-2.5 text-xs text-foreground outline-none transition ${
                  eligibility?.eligible
                    ? "border-emerald-500 focus:border-emerald-500"
                    : eligibility && !eligibility.eligible
                    ? "border-red-500 focus:border-red-500"
                    : "border-border-color focus:border-blue-600"
                }`}
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-semibold text-foreground">
                Create Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  required
                  disabled={!eligibility?.eligible}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated pl-3.5 pr-10 py-2.5 text-xs text-foreground outline-none focus:border-blue-600 disabled:opacity-50 transition"
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
              <label htmlFor="confirmPassword" className="block text-xs font-semibold text-foreground">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                required
                disabled={!eligibility?.eligible}
                className="w-full rounded-xl border border-border-color bg-surface-elevated px-3.5 py-2.5 text-xs text-foreground outline-none focus:border-blue-600 disabled:opacity-50 transition"
              />
            </div>

            <div className="rounded-xl border border-border-color/60 bg-surface-elevated/40 p-3 text-[11px] text-muted space-y-1">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-blue-600" />
                Security Guidelines
              </p>
              <p>• Minimum 6 characters</p>
              <p>• Departmental rights and access permissions will be automatically linked</p>
            </div>

            {/* Terms and Conditions Acceptance */}
            <div className="rounded-xl border border-border-color bg-surface-elevated/40 p-3">
              <TermsCheckboxField checked={agreedToTerms} onChange={setAgreedToTerms} />
            </div>

            <button
              type="submit"
              disabled={loading || !agreedToTerms || !eligibility?.eligible}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
            >
              {loading
                ? "Securing Credentials..."
                : !eligibility?.eligible
                ? "Enter Valid Staff Email to Continue"
                : "Create & Activate Staff Password"}
            </button>
          </form>
        )}

        <footer className="pt-2 text-center border-t border-border-color">
          <Link
            to={backLoginUrl}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground transition"
          >
            <ArrowLeft size={14} />
            Back to {company ? `${company.name} Sign In` : "Sign In"}
          </Link>
        </footer>
      </section>
    </main>
  );
}
