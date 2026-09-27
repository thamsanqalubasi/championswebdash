import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import {
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ArrowLeft,
  Mail,
  Loader2,
  ArrowRight,
} from "lucide-react";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Mode: "request" = enter email to request link, "update" = enter new password
  const [mode, setMode] = useState<"request" | "update">("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestSent, setRequestSent] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);

  useEffect(() => {
    // 1. Check for PKCE 'code' query parameter
    const code = searchParams.get("code");
    if (code) {
      setLoading(true);
      supabase.auth.exchangeCodeForSession(code)
        .then(({ error: exchangeErr }) => {
          setLoading(false);
          if (!exchangeErr) {
            setMode("update");
          } else {
            setError(exchangeErr.message);
          }
        })
        .catch((err) => {
          setLoading(false);
          setError(err.message);
        });
      return;
    }

    // 2. Check for hash fragments containing access_token & type=recovery
    const hash = window.location.hash;
    if (hash && (hash.includes("type=recovery") || hash.includes("access_token"))) {
      setMode("update");
      return;
    }

    // 3. Listen to auth state changes for PASSWORD_RECOVERY event
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "PASSWORD_RECOVERY") {
        setMode("update");
      }
    });

    // 4. Check if session already exists
    supabase.auth.getSession().then(({ data }) => {
      if (data.session && hash.includes("type=recovery")) {
        setMode("update");
      }
    });

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [searchParams]);

  // Request Reset Link handler
  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim()) {
      setError("Please enter your registered email address.");
      return;
    }

    setLoading(true);
    try {
      const origin = window.location.origin;
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${origin}/auth/reset-password`,
      });
      if (resetErr) throw resetErr;
      setRequestSent(true);
    } catch (err: any) {
      setError(err.message || "Failed to send password reset email. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Update Password handler
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        password: password,
      });
      if (updateErr) throw updateErr;

      setUpdateSuccess(true);
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 2500);
    } catch (err: any) {
      setError(err.message || "Failed to update password. Please try again or request a new reset link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-border-color bg-surface p-8 shadow-xl">
        {/* Header */}
        <header className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500 shadow-inner">
            <KeyRound size={28} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {mode === "update" ? "Set New Password" : "Reset Your Password"}
          </h1>
          <p className="mt-1.5 text-xs text-muted leading-relaxed">
            {mode === "update"
              ? "Choose a strong, secure new password for your account."
              : "Enter your registered email address and we'll send you a password recovery link."}
          </p>
        </header>

        {error && (
          <div className="flex items-start gap-2.5 rounded-xl bg-red-500/10 p-3.5 text-xs text-red-500">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Mode: REQUEST LINK */}
        {mode === "request" && !requestSent && (
          <form onSubmit={handleRequestReset} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="reset-email" className="block text-xs font-semibold text-foreground">
                Email Address
              </label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                className="w-full rounded-xl border border-border-color bg-surface-elevated px-3.5 py-2.5 text-xs text-foreground outline-none focus:border-blue-600 transition"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Sending Reset Link...</span>
                </>
              ) : (
                <>
                  <Mail size={14} />
                  <span>Send Reset Link</span>
                </>
              )}
            </button>
          </form>
        )}

        {mode === "request" && requestSent && (
          <div className="space-y-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-center text-emerald-600">
            <CheckCircle2 size={36} className="mx-auto" />
            <div className="space-y-1">
              <p className="font-bold text-sm">Reset Link Sent!</p>
              <p className="text-xs text-emerald-700/80 leading-relaxed">
                We've sent a password reset link to <strong className="text-foreground">{email}</strong>.
                Please check your inbox (and spam folder) and click the link to choose a new password.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRequestSent(false)}
              className="text-xs font-bold text-blue-500 hover:underline pt-2 inline-block cursor-pointer"
            >
              Didn't receive it? Send again
            </button>
          </div>
        )}

        {/* Mode: UPDATE PASSWORD */}
        {mode === "update" && !updateSuccess && (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="new-password" className="block text-xs font-semibold text-foreground">
                New Password
              </label>
              <div className="relative">
                <input
                  id="new-password"
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
              <label htmlFor="confirm-new-password" className="block text-xs font-semibold text-foreground">
                Confirm New Password
              </label>
              <input
                id="confirm-new-password"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                required
                className="w-full rounded-xl border border-border-color bg-surface-elevated px-3.5 py-2.5 text-xs text-foreground outline-none focus:border-blue-600 transition"
              />
            </div>

            <div className="rounded-xl border border-border-color/60 bg-surface-elevated/40 p-3 text-[11px] text-muted space-y-1">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-blue-600" />
                Password Requirement
              </p>
              <p>• At least 6 characters in length</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 transition cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Updating Password...</span>
                </>
              ) : (
                <>
                  <span>Save New Password</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>
        )}

        {mode === "update" && updateSuccess && (
          <div className="space-y-4 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-5 text-center text-emerald-600">
            <CheckCircle2 size={36} className="mx-auto animate-bounce" />
            <div className="space-y-1">
              <p className="font-bold text-sm">Password Updated Successfully!</p>
              <p className="text-xs text-emerald-700/80 leading-relaxed">
                Your new password is now active. Redirecting you to login...
              </p>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline pt-2"
            >
              Click here if not redirected automatically
            </Link>
          </div>
        )}

        {/* Back Link */}
        <footer className="pt-2 text-center border-t border-border-color">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground transition"
          >
            <ArrowLeft size={14} />
            Back to Sign In
          </Link>
        </footer>
      </div>
    </div>
  );
}
