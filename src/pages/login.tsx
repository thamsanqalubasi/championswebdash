import { useState, useEffect } from "react";
import { Navigate, useNavigate, useSearchParams, useParams, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { fetchCompanyBySlug } from "@/lib/data";
import type { Company } from "@/lib/types";
import { Lock, Mail, KeyRound, Building2, ShieldCheck, ArrowRight, Sparkles, Globe } from "lucide-react";

export default function LoginPage() {
  const { signIn, user, setCurrentCompany } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { companySlug } = useParams<{ companySlug?: string }>();

  const [company, setCompany] = useState<Company | null>(null);
  const [companyLoading, setCompanyLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load custom company branding if companySlug is present in URL
  useEffect(() => {
    if (!companySlug) {
      setCompany(null);
      return;
    }

    setCompanyLoading(true);
    fetchCompanyBySlug(companySlug)
      .then((comp) => {
        if (comp) {
          setCompany(comp);
          setCurrentCompany(comp);
        }
      })
      .catch((err) => {
        console.warn("Could not load company for slug", err);
      })
      .finally(() => {
        setCompanyLoading(false);
      });
  }, [companySlug, setCurrentCompany]);

  // Redirect if already logged in
  if (user) {
    const nextPath = searchParams.get("next") || "/dashboard";
    return <Navigate to={nextPath} replace />;
  }

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await signIn(email, password);
      if (result.error) {
        setError(result.error);
        return;
      }

      // If logging into a specific company, keep context
      if (company) {
        setCurrentCompany(company);
      }

      const nextPath = searchParams.get("next") || "/dashboard";
      navigate(nextPath, { replace: true });
    } catch {
      setError("Could not sign in. Please check your credentials and try again.");
    } finally {
      setLoading(false);
    }
  };

  const portalName = company ? company.name : "Pambabook";
  const portalSubtitle = company
    ? "Dedicated Staff & Operations Portal"
    : "Smart Hospitality & Property Management Platform";
  const setPasswordPath = companySlug
    ? `/c/${companySlug}/set-password`
    : "/set-password";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10">
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
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 shadow-inner">
              {company ? (
                <span className="text-2xl font-black">{company.name.charAt(0)}</span>
              ) : (
                <Building2 size={28} />
              )}
            </div>
          )}

          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {company ? company.name : "Sign In"}
          </h1>
          <p className="mt-1 text-xs text-muted">{portalSubtitle}</p>
          {companySlug && (
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-blue-600">
              <Globe size={10} />
              <span>/c/{companySlug}</span>
            </div>
          )}
        </header>

        {/* First-time User Invite Banner */}
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5 text-xs text-foreground flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <KeyRound size={18} className="text-blue-600 shrink-0" />
            <div>
              <p className="font-bold text-xs text-blue-700 dark:text-blue-400">
                Newly Added Staff?
              </p>
              <p className="text-[11px] text-muted">Create your initial password here</p>
            </div>
          </div>
          <Link
            to={setPasswordPath}
            className="shrink-0 flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-blue-700 transition"
          >
            <span>Set Password</span>
            <ArrowRight size={12} />
          </Link>
        </div>

        <form className="space-y-4 text-xs" onSubmit={onSubmit}>
          {error && (
            <div className="rounded-xl bg-red-500/10 p-3 text-red-600 font-medium">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="email" className="block font-semibold text-foreground">
              Work Email Address
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={company?.email || "name@company.com"}
                required
                className="w-full rounded-xl border border-border-color bg-surface-elevated pl-3.5 pr-3 py-2.5 text-foreground outline-none focus:border-blue-600 transition"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="block font-semibold text-foreground">
                Password
              </label>
              <Link
                to={`${setPasswordPath}${email ? `?email=${encodeURIComponent(email)}&action=reset` : "?action=reset"}`}
                className="text-[11px] font-medium text-blue-600 hover:underline"
              >
                Forgot Password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                required
                className="w-full rounded-xl border border-border-color bg-surface-elevated pl-3.5 pr-3 py-2.5 text-foreground outline-none focus:border-blue-600 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 py-2.5 font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 transition text-xs flex items-center justify-center gap-2"
          >
            {loading ? (
              <span>Signing in...</span>
            ) : (
              <span>Sign In to {company ? company.name : "Dashboard"}</span>
            )}
          </button>
        </form>

        {/* Organization Links: switch company or register new */}
        <div className="space-y-2 pt-2 border-t border-border-color/60 text-center text-xs">
          {companySlug ? (
            <p className="text-[11px] text-muted">
              Not part of {company?.name || companySlug}?{" "}
              <Link to="/login" className="font-semibold text-blue-600 hover:underline">
                Go to Main Portal Login
              </Link>
            </p>
          ) : (
            <div className="rounded-xl border border-border-color/80 bg-surface-elevated p-3 text-xs">
              <p className="text-muted text-[11px]">
                Want to run your own hotel, lodge, or property network?
              </p>
              <Link
                to="/signup"
                className="mt-1 inline-flex items-center gap-1 font-bold text-blue-600 hover:underline"
              >
                <Sparkles size={13} className="text-amber-500" />
                <span>Register a New Organization &rarr;</span>
              </Link>
            </div>
          )}
        </div>

        <footer className="text-center text-[11px] text-muted">
          <p>Protected by Enterprise RBAC &amp; Multi-Tenant Security</p>
        </footer>
      </section>
    </main>
  );
}
