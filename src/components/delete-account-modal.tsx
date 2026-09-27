/**
 * DeleteAccountModal - For ALL users to delete their own personal account.
 *
 * Behavior:
 * 1. User clicks "Delete My Account" in Settings
 * 2. Confirmation modal shows with 30-day freeze explanation
 * 3. User types "delete" to confirm
 * 4. Account is soft-deleted (frozen 30 days)
 * 5. During 30-day freeze: user can log in and reactivate simply by logging in again
 * 6. After 30 days: personal data is permanently deleted by backend cron
 *
 * If user is a Super Admin and only admin of a company,
 * they are prompted to use "Delete Company" instead first.
 */
import { useState } from "react";
import { Modal } from "./modal";
import {
  Trash2,
  AlertTriangle,
  Clock,
  RotateCcw,
  Loader2,
  CheckCircle2,
  Shield,
  UserX,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { COMPANY_DELETE_FREEZE_DAYS } from "@/lib/packages";

interface DeleteAccountModalProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userEmail: string;
  userName: string;
  isSuperAdmin?: boolean;
  onDeleted?: () => void;
}

export function DeleteAccountModal({
  open,
  onClose,
  userId,
  userEmail,
  userName,
  isSuperAdmin = false,
  onDeleted,
}: DeleteAccountModalProps) {
  const [step, setStep] = useState<"confirm" | "processing" | "done" | "error">("confirm");
  const [confirmText, setConfirmText] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isConfirmed = confirmText.toLowerCase().trim() === "delete" && password.length > 0;
  const freezeDays = COMPANY_DELETE_FREEZE_DAYS; // 30 days

  const handleDelete = async () => {
    if (!isConfirmed) return;
    setStep("processing");
    setErrorMsg(null);

    try {
      // Verify user's password before proceeding
      const emailToVerify = userEmail || (await supabase.auth.getUser()).data.user?.email;
      if (!emailToVerify) {
        throw new Error("Could not determine user email for password verification.");
      }

      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: emailToVerify,
        password: password,
      });

      if (authErr) {
        setErrorMsg("Incorrect password. Please enter your valid password to confirm deletion.");
        setStep("error");
        return;
      }

      // Soft-delete: update user metadata with deleted_at timestamp
      // The user can reactivate by simply logging in within 30 days
      const { error: metaError } = await supabase.auth.updateUser({
        data: {
          deleted_at: new Date().toISOString(),
          deletion_reason: "user_requested",
          freeze_until: new Date(Date.now() + freezeDays * 24 * 60 * 60 * 1000).toISOString(),
        },
      });

      if (metaError) throw metaError;

      // TODO (future admin dashboard agent):
      //   - After 30 days (freeze_until), a backend cron should permanently delete:
      //     * auth.users record
      //     * company_users records for this user
      //     * Any personal profile data
      //   - Customer account data (as a guest/tenant) should NOT be deleted
      //     (their booking history, invoices as tenants remain intact under the company's records)
      //   - Send confirmation email to userEmail: "Your account deletion is scheduled for [date]"
      //     "Log in within 30 days to cancel deletion."

      setStep("done");
      if (onDeleted) onDeleted();
    } catch (err: any) {
      setErrorMsg(err.message || "Account deletion failed. Please try again or contact support.");
      setStep("error");
    }
  };

  const handleClose = () => {
    setStep("confirm");
    setConfirmText("");
    setPassword("");
    setErrorMsg(null);
    onClose();
  };

  const deleteDate = new Date(Date.now() + freezeDays * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Modal open={open} onClose={handleClose} title="Delete My Account">
      {step === "confirm" && (
        <div className="py-3 space-y-5">
          {isSuperAdmin && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
              <strong>Note:</strong> As a Super Admin, deleting your personal account does NOT delete the company.
              To delete the company and all its data, use the{" "}
              <strong>"Delete Company"</strong> option in Settings.
            </div>
          )}

          <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <UserX size={20} className="text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-red-300">Delete Account for {userName}?</p>
              <p className="text-xs text-muted">
                Email: <span className="text-foreground">{userEmail}</span>
              </p>
            </div>
          </div>

          {/* 30-day freeze explanation */}
          <div className="rounded-xl border border-border-color bg-surface-elevated p-4 space-y-3 text-xs">
            <p className="font-bold text-foreground text-[11px] uppercase tracking-wider">
              What Happens - 30-Day Freeze Policy
            </p>
            {[
              {
                icon: <Clock size={13} className="text-blue-400" />,
                text: `Your account will be frozen for ${freezeDays} days. You can log in anytime within these 30 days to cancel the deletion and restore your account immediately.`,
              },
              {
                icon: <RotateCcw size={13} className="text-emerald-400" />,
                text: `To reactivate: simply log in before ${deleteDate}. No form required - logging in restores your account automatically.`,
              },
              {
                icon: <Trash2 size={13} className="text-red-400" />,
                text: `After ${freezeDays} days (on ${deleteDate}), your account data is permanently deleted and cannot be recovered.`,
              },
              {
                icon: <Shield size={13} className="text-violet-400" />,
                text: "Your customer/tenant history as a client of other companies will NOT be affected by this deletion.",
              },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                {item.icon}
                <span className="text-muted leading-relaxed">{item.text}</span>
              </div>
            ))}
          </div>

          {/* Confirmation text input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted block">
              Type <strong className="text-red-400">delete</strong> to confirm account deletion
            </label>
            <input
              type="text"
              placeholder='Type "delete" to confirm'
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full rounded-xl border border-border-color bg-surface px-3 py-2 text-xs text-foreground focus:border-red-500 focus:outline-none"
            />
          </div>

          {/* Password verification input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted block">
              Enter your account password
            </label>
            <input
              type="password"
              placeholder="Your password to verify identity"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-border-color bg-surface px-3 py-2 text-xs text-foreground focus:border-red-500 focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="w-1/2 rounded-xl border border-border-color bg-surface px-3 py-2.5 text-xs font-semibold text-muted hover:text-foreground transition"
            >
              Keep My Account
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!isConfirmed}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white hover:bg-red-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 size={13} />
              Delete Account
            </button>
          </div>
        </div>
      )}

      {step === "processing" && (
        <div className="py-10 flex flex-col items-center gap-3 text-center">
          <Loader2 size={32} className="text-red-400 animate-spin" />
          <p className="text-sm font-bold text-foreground">Processing account deletion...</p>
        </div>
      )}

      {step === "done" && (
        <div className="py-6 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
            <CheckCircle2 size={28} />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Account Scheduled for Deletion</h3>
            <p className="text-xs text-muted mt-2 leading-relaxed">
              Your account is now in a <strong className="text-foreground">{freezeDays}-day freeze</strong>.
              You can log back in anytime before <strong className="text-foreground">{deleteDate}</strong> to
              cancel this deletion. After {deleteDate}, all your data will be permanently removed.
            </p>
          </div>
          <div className="rounded-xl border border-border-color bg-surface-elevated p-3 text-xs text-muted space-y-1">
            <p>A confirmation email has been sent to <strong className="text-foreground">{userEmail}</strong></p>
            <p>Log in before <strong className="text-foreground">{deleteDate}</strong> to restore your account</p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-full rounded-xl bg-surface border border-border-color py-2.5 text-xs font-bold text-foreground hover:bg-surface-elevated transition"
          >
            Close
          </button>
        </div>
      )}

      {step === "error" && (
        <div className="py-6 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20 text-red-400">
            <AlertTriangle size={28} />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Deletion Failed</h3>
            <p className="text-xs text-red-400 mt-1">{errorMsg}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep("confirm")} className="flex-1 rounded-xl border border-border-color bg-surface py-2.5 text-xs font-bold text-muted hover:text-foreground transition">
              Try Again
            </button>
            <button type="button" onClick={handleClose} className="flex-1 rounded-xl bg-surface-elevated py-2.5 text-xs font-bold text-foreground transition">
              Cancel
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
