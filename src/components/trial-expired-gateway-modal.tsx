import { useState, useEffect } from "react";
import { Modal } from "./modal";
import {
  getCompanySubscription,
  restartCompanyTrial,
  setPackageModeEnabled,
  SUBSCRIPTION_PACKAGES,
  type CompanySubscription,
} from "@/lib/packages";
import { StripePaymentModal } from "./stripe-payment-modal";
import {
  Clock,
  CreditCard,
  RotateCcw,
  Power,
  AlertTriangle,
  PackageCheck,
} from "lucide-react";

// TEMPORARY TEST FEATURE: Remove before production launch

interface TrialExpiredGatewayModalProps {
  open: boolean;
  companyId: string;
  onOpenPackageSwitcher: () => void;
  onTrialRestarted?: () => void;
}

export function TrialExpiredGatewayModal({
  open,
  companyId,
  onOpenPackageSwitcher,
  onTrialRestarted,
}: TrialExpiredGatewayModalProps) {
  const [sub, setSub] = useState<CompanySubscription>(() => getCompanySubscription(companyId));
  const [stripeOpen, setStripeOpen] = useState(false);

  useEffect(() => {
    const handleUpdate = () => {
      setSub(getCompanySubscription(companyId));
    };
    handleUpdate();
    window.addEventListener("paimba_package_changed", handleUpdate);
    return () => window.removeEventListener("paimba_package_changed", handleUpdate);
  }, [companyId]);

  const handleRestart = () => {
    restartCompanyTrial(companyId);
    if (onTrialRestarted) onTrialRestarted();
  };

  const handleTurnOffPackageMode = () => {
    setPackageModeEnabled(companyId, false);
    if (onTrialRestarted) onTrialRestarted();
  };

  const currentPlan = SUBSCRIPTION_PACKAGES[sub.packageId] || SUBSCRIPTION_PACKAGES.starter;

  return (
    <>
      <Modal
        open={open}
        onClose={() => {}} // Block dismissal while expired unless restarted, paid, or turned off
        title="1-Minute Trial Expired — Payment Gateway"
      >
        <div className="py-2 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400">
            <Clock size={32} />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] font-bold uppercase tracking-wider mb-2">
              <AlertTriangle size={12} />
              <span>Test Mode: 60s Trial Ended</span>
            </div>
            <h3 className="text-lg font-bold text-foreground">
              Your 1-Minute Trial Has Expired
            </h3>
            <p className="text-xs text-muted mt-1 leading-relaxed max-w-sm mx-auto">
              You were testing the <span className="font-semibold text-foreground">{currentPlan.name}</span>.
              To test live payment verification, proceed with the <span className="font-semibold text-blue-400">$2 Test Package</span> via Stripe, or restart the 1-minute trial.
            </p>
          </div>

          {/* Action cards */}
          <div className="space-y-2 text-left">
            {/* Primary Action 1: Pay $2 Test Package via Stripe */}
            <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                  <CreditCard size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Stripe Payment Gateway ($2.00)</p>
                  <p className="text-[11px] text-muted">Test live card payment & instant verification</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStripeOpen(true)}
                className="shrink-0 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
              >
                Pay $2 Stripe
              </button>
            </div>

            {/* Action 2: Restart 1-Minute Trial */}
            <div className="rounded-xl border border-border-color bg-surface-elevated p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface border border-border-color text-amber-400">
                  <RotateCcw size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Restart 1-Minute Trial</p>
                  <p className="text-[11px] text-muted">Reset the countdown timer for another 60 seconds</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleRestart}
                className="shrink-0 rounded-xl border border-amber-500/40 bg-surface px-3 py-1.5 text-xs font-bold text-amber-400 hover:bg-amber-500/10 transition"
              >
                Restart Trial
              </button>
            </div>

            {/* Action 3: Switch Package Plan */}
            <div className="rounded-xl border border-border-color bg-surface-elevated p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface border border-border-color text-violet-400">
                  <PackageCheck size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Switch Package Tier</p>
                  <p className="text-[11px] text-muted">Choose $5, $20, $50, or $200 tier (No card needed)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onOpenPackageSwitcher}
                className="shrink-0 rounded-xl border border-border-color bg-surface px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-elevated transition"
              >
                View Plans
              </button>
            </div>
          </div>

          {/* Master Turn OFF Mode */}
          <div className="border-t border-border-color pt-3 text-center">
            <button
              type="button"
              onClick={handleTurnOffPackageMode}
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-red-400 transition font-medium"
            >
              <Power size={13} />
              <span>Turn OFF Package Mode Completely (Free Unrestricted Access)</span>
            </button>
          </div>
        </div>
      </Modal>

      <StripePaymentModal
        open={stripeOpen}
        onClose={() => setStripeOpen(false)}
        companyId={companyId}
        amountUsd={2}
        packageTitle="Stripe Test Package"
        onSuccess={() => {
          setSub(getCompanySubscription(companyId));
          setStripeOpen(false);
          if (onTrialRestarted) onTrialRestarted();
        }}
      />
    </>
  );
}
