import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { CheckCircle2, AlertTriangle, ArrowRight, Mail, Loader2, RefreshCw } from "lucide-react";
import { ResendConfirmationModal } from "@/components/resend-confirmation-modal";

export default function ConfirmEmailPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [resendModalOpen, setResendModalOpen] = useState(false);

  useEffect(() => {
    async function handleEmailConfirmation() {
      try {
        // 1. Check for PKCE 'code' query parameter
        const code = searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          setStatus("success");
          return;
        }

        // 2. Check for token_hash & type (email verification OTP link)
        const tokenHash = searchParams.get("token_hash");
        const type = searchParams.get("type") as any;
        if (tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: type || "email",
          });
          if (error) throw error;
          setStatus("success");
          return;
        }

        // 3. Check if hash fragments contain access_token (implicit flow)
        const hash = window.location.hash;
        if (hash && hash.includes("access_token")) {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;
          if (data.session) {
            setStatus("success");
            return;
          }
        }

        // 4. Check if already have an active verified session
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData.session?.user?.email_confirmed_at) {
          setStatus("success");
          return;
        }

        // If no code, token_hash, or session
        setStatus("error");
        setErrorMessage("No confirmation token was found in this link. The link may have expired or already been used.");
      } catch (err: any) {
        console.error("Confirmation error:", err);
        setStatus("error");
        setErrorMessage(err.message || "Failed to confirm email. The link may be invalid or expired.");
      }
    }

    void handleEmailConfirmation();
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-border-color bg-surface p-8 shadow-xl text-center">
        {status === "verifying" && (
          <div className="py-8 space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500">
              <Loader2 size={32} className="animate-spin" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Verifying Your Email</h2>
              <p className="text-xs text-muted mt-1.5 leading-relaxed">
                Please wait while we confirm your email address with the system...
              </p>
            </div>
          </div>
        )}

        {status === "success" && (
          <div className="py-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
              <CheckCircle2 size={36} />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-2xl font-bold text-foreground">Email Confirmed!</h2>
              <p className="text-xs text-muted leading-relaxed">
                Your email address has been successfully verified. Your account is fully active and ready to use.
              </p>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-xs text-emerald-600 dark:text-emerald-400 space-y-1">
              <p className="font-semibold">All permissions unlocked</p>
              <p className="text-[11px] text-muted">You can now sign in to your dashboard and manage properties, bookings, and billing.</p>
            </div>

            <div className="space-y-2 pt-2">
              <Link
                to="/login"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition"
              >
                <span>Proceed to Staff Login</span>
                <ArrowRight size={14} />
              </Link>
              <Link
                to="/portal"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border-color bg-surface-elevated py-2.5 text-xs font-semibold text-muted hover:text-foreground transition"
              >
                Go to Public Portal
              </Link>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="py-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/15 text-red-500">
              <AlertTriangle size={36} />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold text-foreground">Verification Failed</h2>
              <p className="text-xs text-red-400 leading-relaxed">{errorMessage}</p>
            </div>

            <div className="rounded-xl border border-border-color bg-surface-elevated p-4 text-xs text-muted space-y-2 text-left">
              <p className="font-bold text-foreground text-[11px] uppercase tracking-wider">Common Reasons:</p>
              <ul className="list-disc pl-4 space-y-1 text-[11px]">
                <li>The confirmation link has expired (links usually expire after 24 hours).</li>
                <li>The email was already verified previously.</li>
                <li>The link was partially truncated in your email client.</li>
              </ul>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => setResendModalOpen(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>Resend Confirmation Email</span>
              </button>
              <Link
                to="/login"
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-border-color bg-surface-elevated py-2.5 text-xs font-semibold text-muted hover:text-foreground transition"
              >
                Back to Sign In
              </Link>
            </div>
          </div>
        )}
      </div>

      <ResendConfirmationModal
        open={resendModalOpen}
        onClose={() => setResendModalOpen(false)}
      />
    </div>
  );
}
