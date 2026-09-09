import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, useParams, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { fetchCompanyBySlug } from "@/lib/data";
import type { Company } from "@/lib/types";
import {
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ArrowLeft,
  Building2,
  Globe,
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const action = searchParams.get("action") || "invite"; // 'invite' | 'reset'

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

  useEffect(() => {
    const queryEmail = searchParams.get("email");
    if (queryEmail) {
      setEmail(decodeURIComponent(queryEmail));
    }
  }, [searchParams]);

  // If already logged in and not setting password via query
  useEffect(() => {
    if (user && !searchParams.get("email")) {
      navigate("/dashboard", { replace: true });
    }
  }, [user, navigate, searchParams]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Please enter your registered work email.");
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
  const orgName = company ? company.name : "Champions Court";

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
            {action === "reset" ? "Reset Your Password" : "Create Your Password"}
          </h1>
          <p className="mt-1 text-xs text-muted">
            {action === "reset"
              ? `Set a new secure password for your ${orgName} staff account.`
              : `Welcome to the team at ${orgName}! Set up your secure account password to activate access.`}
          </p>
          {companySlug && (
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-blue-600">
              <Globe size={10} />
              <span>/c/{companySlug}</span>
            </div>
          )}
        </header>

        {success ? (
          <div className="space-y-4 rounded-xl bg-emerald-500/10 p-5 text-center text-emerald-600">
            <CheckCircle2 size={36} className="mx-auto text-emerald-600 animate-bounce" />
            <div>
              <p className="font-bold text-sm">
                {action === "reset" ? "Password Reset Successfully!" : "Account Activated Successfully!"}
              </p>
              <p className="text-xs text-emerald-700/80 mt-1">Logging you in to your dashboard...</p>
            </div>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-red-500/10 p-3 text-xs text-red-600 font-medium">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-xs font-semibold text-foreground">
                Work Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={company?.email || "name@company.co.za"}
                required
                className="w-full rounded-xl border border-border-color bg-surface-elevated px-3.5 py-2.5 text-xs text-foreground outline-none focus:border-blue-600 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-xs font-semibold text-foreground">
                {action === "reset" ? "New Password" : "Create Password"}
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  required
                  className="w-full rounded-xl border border-border-color bg-surface-elevated pl-3.5 pr-10 py-2.5 text-xs text-foreground outline-none focus:border-blue-600 transition"
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
                className="w-full rounded-xl border border-border-color bg-surface-elevated px-3.5 py-2.5 text-xs text-foreground outline-none focus:border-blue-600 transition"
              />
            </div>

            <div className="rounded-xl border border-border-color/60 bg-surface-elevated/40 p-3 text-[11px] text-muted space-y-1">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-blue-600" />
                Security Guidelines
              </p>
              <p>• Minimum 6 characters</p>
              <p>• Enterprise access and departmental rights will be assigned automatically</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {loading
                ? "Securing Credentials..."
                : action === "reset"
                ? "Reset & Activate Password"
                : "Create & Activate Password"}
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
