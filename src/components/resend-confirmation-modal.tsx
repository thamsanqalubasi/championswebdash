import { useState } from "react";
import { Modal } from "./modal";
import { Mail, CheckCircle2, AlertCircle, Loader2, Send } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface ResendConfirmationModalProps {
  open: boolean;
  onClose: () => void;
  defaultEmail?: string;
}

export function ResendConfirmationModal({
  open,
  onClose,
  defaultEmail = "",
}: ResendConfirmationModalProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync defaultEmail when modal opens
  const handleOpen = () => {
    if (defaultEmail && !email) {
      setEmail(defaultEmail);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const confirmRedirectUrl = `${window.location.origin}/auth/confirm-email`;
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: cleanEmail,
        options: {
          emailRedirectTo: confirmRedirectUrl,
        },
      });

      if (error) {
        throw error;
      }

      setSuccess(true);
    } catch (err: any) {
      setErrorMsg(
        err?.message || "Failed to send confirmation link. Please check your email or try again later."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSuccess(false);
    setErrorMsg(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Confirm Your Email Address">
      <div className="py-2 space-y-4">
        {success ? (
          <div className="text-center py-6 space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-base font-bold text-foreground">Confirmation Link Sent!</h3>
            <p className="text-xs text-muted max-w-sm mx-auto leading-relaxed">
              We dispatched a fresh verification link to{" "}
              <strong className="text-foreground">{email}</strong>. Please check your inbox and spam folder, then click the link to activate your account.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl bg-blue-600 px-6 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSend} className="space-y-4 text-xs">
            <div className="flex items-start gap-3 rounded-xl border border-blue-500/20 bg-blue-500/5 p-3.5">
              <Mail size={18} className="text-blue-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-bold text-foreground">Email Confirmation Required</p>
                <p className="text-[11px] text-muted leading-relaxed">
                  Your account requires email verification before signing in. Enter your registration email below to receive a direct verification link.
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-red-600">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="confirm-email-input" className="block font-semibold text-foreground">
                Account Email Address
              </label>
              <input
                id="confirm-email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-border-color bg-surface-elevated px-3.5 py-2.5 text-foreground outline-none focus:border-blue-600 transition"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="rounded-xl border border-border-color bg-surface px-4 py-2.5 text-xs font-semibold text-muted hover:text-foreground transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 transition"
              >
                {loading ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Sending Link...</span>
                  </>
                ) : (
                  <>
                    <Send size={13} />
                    <span>Send Confirmation Link</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
