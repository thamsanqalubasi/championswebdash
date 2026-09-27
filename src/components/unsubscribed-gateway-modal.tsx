/**
 * UnsubscribedGatewayModal
 *
 * Fullscreen modal shown when:
 *   - User's subscription is cancelled (status = "cancelled" or "frozen")
 *   - User can still log in but ALL features are locked
 *
 * Shows:
 *   - Days remaining before account freeze (60-day countdown)
 *   - Reactivation CTA (takes user to trial onboarding or subscription checkout)
 *   - If frozen (>60 days): account frozen message, can only reactivate with new subscription
 */
import { useState } from "react";
import {
  Lock,
  AlertTriangle,
  RotateCcw,
  Clock,
  XCircle,
  Sparkles,
} from "lucide-react";
import {
  getCompanySubscription,
  getDaysUntilFreeze,
  UNSUBSCRIBED_FREEZE_DAYS,
  AUTO_DELETE_AFTER_DAYS,
  COMPANY_DELETE_FREEZE_DAYS,
} from "@/lib/packages";
import { TrialOnboardingModal } from "./trial-onboarding-modal";

interface UnsubscribedGatewayModalProps {
  companyId: string;
  customerEmail?: string;
  onReactivated?: () => void;
}

export function UnsubscribedGatewayModal({
  companyId,
  customerEmail,
  onReactivated,
}: UnsubscribedGatewayModalProps) {
  const sub = getCompanySubscription(companyId);
  const [showTrialOnboarding, setShowTrialOnboarding] = useState(false);

  const isFrozen = sub.status === "frozen";
  const daysCancelled = sub.cancelledAt
    ? Math.floor((Date.now() - sub.cancelledAt) / (24 * 60 * 60 * 1000))
    : 0;
  const daysUntilFreeze = Math.ceil(getDaysUntilFreeze(sub));
  const daysUntilDelete = Math.max(
    0,
    AUTO_DELETE_AFTER_DAYS - daysCancelled
  );

  // Don't render if subscription is active or in trial
  if (sub.status === "active" || sub.status === "trial" || sub.status === "cancelling") {
    return null;
  }

  return (
    <>
      {/* Fullscreen overlay */}
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
        <div className="w-full max-w-lg rounded-3xl border border-border-color bg-background shadow-2xl">
          {/* Header */}
          <div
            className={`rounded-t-3xl p-6 text-center ${
              isFrozen ? "bg-red-500/10" : "bg-amber-500/10"
            }`}
          >
            <div
              className={`mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl ${
                isFrozen ? "bg-red-600" : "bg-amber-500"
              } text-white`}
            >
              {isFrozen ? <XCircle size={32} /> : <Lock size={32} />}
            </div>
            <h2 className="text-xl font-black text-foreground">
              {isFrozen ? "Account Frozen" : "Subscription Ended"}
            </h2>
            <p className="text-sm text-muted mt-1">
              {isFrozen
                ? "Your account has been frozen due to non-payment."
                : "Your PaimbaBook subscription has been cancelled. All features are currently locked."}
            </p>
          </div>

          {/* Body */}
          <div className="p-6 space-y-4">
            {!isFrozen && (
              <>
                {/* Countdown */}
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-600 text-white font-black text-lg">
                    {daysUntilFreeze}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-amber-300">
                      {daysUntilFreeze} {daysUntilFreeze === 1 ? "day" : "days"} left to reactivate
                    </p>
                    <p className="text-xs text-muted">
                      After {UNSUBSCRIBED_FREEZE_DAYS} days without a subscription, your account will be frozen and you will no longer be able to log in.
                    </p>
                  </div>
                </div>

                {/* Data safety */}
                <div className="rounded-xl border border-border-color bg-surface-elevated p-3 text-xs space-y-1.5">
                  <p className="font-bold text-foreground text-[11px] uppercase tracking-wider">Your Data is Safe</p>
                  <div className="flex items-start gap-2 text-muted">
                    <Clock size={12} className="shrink-0 mt-0.5 text-blue-400" />
                    <span>All your properties, tenants, invoices, and contracts are preserved during the {UNSUBSCRIBED_FREEZE_DAYS}-day window.</span>
                  </div>
                  <div className="flex items-start gap-2 text-muted">
                    <AlertTriangle size={12} className="shrink-0 mt-0.5 text-red-400" />
                    <span>
                      After freezing, your account is flagged for permanent deletion in approximately{" "}
                      <strong className="text-foreground">{daysUntilDelete} days</strong> (
                      {AUTO_DELETE_AFTER_DAYS} total days from cancellation).
                    </span>
                  </div>
                </div>
              </>
            )}

            {isFrozen && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-muted space-y-1.5">
                <p className="font-bold text-red-300">Account Frozen - Action Required</p>
                <p>
                  Your account was frozen after {UNSUBSCRIBED_FREEZE_DAYS} days without an active subscription.
                  You can still reactivate by starting a new subscription below. Your data is preserved for a short window.
                </p>
                <p className="text-red-400 font-bold">
                  Permanent deletion in approximately {daysUntilDelete} days if not reactivated.
                </p>
              </div>
            )}

            {/* CTA buttons */}
            <button
              type="button"
              onClick={() => setShowTrialOnboarding(true)}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 py-3 text-sm font-bold text-white shadow-lg hover:opacity-90 transition"
            >
              <Sparkles size={16} />
              Reactivate with Free Trial
            </button>

            <p className="text-center text-[11px] text-muted">
              Questions? Contact us at{" "}
              <a href="mailto:support@paimbabook.com" className="text-blue-400 underline">
                support@paimbabook.com
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Trial Onboarding Modal (reactivation flow) */}
      <TrialOnboardingModal
        open={showTrialOnboarding}
        onClose={() => setShowTrialOnboarding(false)}
        companyId={companyId}
        customerEmail={customerEmail}
        onSuccess={() => {
          setShowTrialOnboarding(false);
          if (onReactivated) onReactivated();
        }}
      />
    </>
  );
}
