/**
 * CancelSubscriptionModal
 *
 * Shown when user clicks "Cancel Subscription" in settings.
 * - Confirms they understand features will be locked
 * - Shows 60-day countdown before account freeze
 * - Calls /api/cancel-subscription to cancel Stripe subscription at period end
 * - After cancellation, user sees UnsubscribedGatewayModal on next feature access
 */
import { useState } from "react";
import { Modal } from "./modal";
import {
  AlertTriangle,
  Lock,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
} from "lucide-react";
import {
  markSubscriptionCancelling,
  UNSUBSCRIBED_FREEZE_DAYS as FREEZE_DAYS,
  getCompanySubscription,
} from "@/lib/packages";


interface CancelSubscriptionModalProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  packageName?: string;
  onCancelled?: () => void;
}

export function CancelSubscriptionModal({
  open,
  onClose,
  companyId,
  packageName = "your current plan",
  onCancelled,
}: CancelSubscriptionModalProps) {
  const [step, setStep] = useState<"confirm" | "processing" | "done" | "error">("confirm");
  const [confirmText, setConfirmText] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const sub = getCompanySubscription(companyId);
  const isConfirmed = confirmText.toLowerCase().trim() === "cancel";

  const handleCancel = async () => {
    if (!isConfirmed) return;
    setStep("processing");
    setErrorMsg(null);

    try {
      // Call Vercel API to cancel Stripe subscription at period end
      if (sub.stripeSubscriptionId) {
        const res = await fetch("/api/cancel-subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            companyId,
            stripeSubscriptionId: sub.stripeSubscriptionId,
          }),
        });

        const data = await res.json().catch(() => null);
        if (!res.ok) {
          throw new Error(data?.error || "Failed to cancel subscription.");
        }
      }

      // Update local state
      markSubscriptionCancelling(companyId, sub.stripeSubscriptionId);
      setStep("done");

      if (onCancelled) onCancelled();
    } catch (err: any) {
      setErrorMsg(err.message || "Cancellation failed. Please try again or contact support.");
      setStep("error");
    }
  };

  const handleClose = () => {
    setStep("confirm");
    setConfirmText("");
    setErrorMsg(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Cancel Subscription">
      {step === "confirm" && (
        <div className="py-3 space-y-5">
          {/* Warning banner */}
          <div className="flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4">
            <AlertTriangle size={20} className="text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-red-300">Are you sure you want to cancel?</p>
              <p className="text-xs text-muted leading-relaxed">
                Once cancelled, your subscription to{" "}
                <strong className="text-foreground">{packageName}</strong> ends at the close of the current billing period.
              </p>
            </div>
          </div>

          {/* What happens */}
          <div className="rounded-xl border border-border-color bg-surface-elevated p-4 space-y-3 text-xs">
            <p className="font-bold text-foreground text-[11px] uppercase tracking-wider">What Happens After Cancellation</p>
            {[
              {
                icon: <Lock size={13} className="text-amber-400" />,
                text: "All premium features will be locked. You can still log in and view data.",
              },
              {
                icon: <Clock size={13} className="text-blue-400" />,
                text: `You have ${FREEZE_DAYS} days to re-subscribe before your account is frozen and you can no longer log in.`,
              },
              {
                icon: <XCircle size={13} className="text-red-400" />,
                text: "After 60 days frozen, your account and company data are flagged for permanent deletion (90 days total).",
              },
              {
                icon: <RotateCcw size={13} className="text-emerald-400" />,
                text: "You can reactivate anytime during the 60-day window by re-subscribing in Settings. Your data is never lost until permanent deletion.",
              },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                {item.icon}
                <span className="text-muted leading-relaxed">{item.text}</span>
              </div>
            ))}
          </div>

          {/* Confirmation input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted block">
              Type <strong className="text-red-400">cancel</strong> to confirm cancellation
            </label>
            <input
              type="text"
              placeholder='Type "cancel" to confirm'
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full rounded-xl border border-border-color bg-surface px-3 py-2 text-xs text-foreground focus:border-red-500 focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="w-1/2 rounded-xl border border-border-color bg-surface px-3 py-2.5 text-xs font-semibold text-muted hover:text-foreground transition"
            >
              Keep Subscription
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={!isConfirmed}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white hover:bg-red-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <XCircle size={13} />
              Cancel Subscription
            </button>
          </div>
        </div>
      )}

      {step === "processing" && (
        <div className="py-10 flex flex-col items-center gap-3 text-center">
          <Loader2 size={32} className="text-blue-400 animate-spin" />
          <p className="text-sm font-bold text-foreground">Cancelling your subscription...</p>
          <p className="text-xs text-muted">Processing cancellation with secure gateway. Please wait...</p>
        </div>
      )}

      {step === "done" && (
        <div className="py-6 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
            <CheckCircle2 size={28} />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Subscription Cancelled</h3>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              Your subscription has been cancelled. You still have access until the end of your current billing period.
              After that, features will be locked. You have <strong className="text-foreground">{FREEZE_DAYS} days</strong> to reactivate before your account is frozen.
            </p>
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
            <XCircle size={28} />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Cancellation Failed</h3>
            <p className="text-xs text-red-400 mt-1">{errorMsg}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep("confirm")} className="flex-1 rounded-xl border border-border-color bg-surface py-2.5 text-xs font-bold text-muted hover:text-foreground transition">
              Try Again
            </button>
            <button type="button" onClick={handleClose} className="flex-1 rounded-xl bg-surface-elevated py-2.5 text-xs font-bold text-foreground transition">
              Close
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
