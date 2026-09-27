import { useState, useEffect } from "react";
import { Modal } from "./modal";
import {
  getCompanySubscription,
  restartCompanyTrial,
  setPackageModeEnabled,
  startGracePeriod,
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
  ShieldCheck,
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

  const [selectedMinutes, setSelectedMinutes] = useState<number>(() =>
    Math.max(1, Math.round((sub.trialDurationSeconds || 60) / 60))
  );

  const handleRestart = (mins?: number) => {
    const minutesToUse = mins || selectedMinutes;
    restartCompanyTrial(companyId, minutesToUse * 60);
    if (onTrialRestarted) onTrialRestarted();
  };

  const handleStartGrace = () => {
    startGracePeriod(companyId, "Trial period ended - 5-day grace period activated.");
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
        title="Trial Expired - Payment Gateway"
      >
        <div className="py-2 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-400">
            <Clock size={32} />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-red-500/10 border border-red-500/30 text-red-400 text-[11px] font-bold uppercase tracking-wider mb-2">
              <AlertTriangle size={12} />
              <span>Test Mode: Trial Ended</span>
            </div>
            <h3 className="text-lg font-bold text-foreground">
              Your {Math.round((sub.trialDurationSeconds || 60) / 60)}-Minute Trial Has Expired
            </h3>
            <p className="text-xs text-muted mt-1 leading-relaxed max-w-sm mx-auto">
              You were testing the <span className="font-semibold text-foreground">{currentPlan.name}</span>.
              To test live payment verification, proceed with the <span className="font-semibold text-blue-400">$0.50 Test Package</span>, test the 5-day grace period, or restart the countdown.
            </p>
          </div>

          {/* Action cards */}
          <div className="space-y-2.5 text-left">
            {/* Primary Action 1: Pay $0.50 Test Package */}
            <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                  <CreditCard size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Secure Payment Gateway ($0.50)</p>
                  <p className="text-[11px] text-muted">Test live card payment & instant verification ($0.50 minimum)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStripeOpen(true)}
                className="shrink-0 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
              >
                Pay $0.50
              </button>
            </div>

            {/* Action 2: Activate 5-Day Grace Period Reminder */}
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface border border-amber-500/40 text-amber-500">
                  <ShieldCheck size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Activate 5-Day Grace Period</p>
                  <p className="text-[11px] text-muted">Timed reminder before auto-downgrade. Zero data is ever deleted.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleStartGrace}
                className="shrink-0 rounded-xl bg-amber-500 hover:bg-amber-600 text-black px-3 py-1.5 text-xs font-black shadow-xs transition"
              >
                Start 5-Day Grace
              </button>
            </div>

            {/* Action 3: Choose Duration & Restart Trial */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface border border-border-color text-amber-400">
                    <RotateCcw size={18} />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-foreground">Restart Test Trial</p>
                    <p className="text-[11px] text-muted">Select duration before restarting countdown</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRestart()}
                  className="shrink-0 rounded-xl border border-amber-500/60 bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-300 hover:bg-amber-500/30 transition shadow-xs"
                >
                  Restart ({selectedMinutes}m)
                </button>
              </div>

              {/* Minute selector chips */}
              <div className="flex items-center gap-1.5 pt-1 border-t border-border-color/50 flex-wrap">
                <span className="text-[11px] font-semibold text-muted mr-1">Choose Trial Length:</span>
                {[1, 2, 3, 5, 10].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => {
                      setSelectedMinutes(mins);
                    }}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      selectedMinutes === mins
                        ? "bg-amber-500 text-black shadow-xs"
                        : "border border-border-color bg-surface text-muted hover:text-foreground hover:bg-surface-elevated"
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
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
        packageTitle="Test Verification Package"
        onSuccess={() => {
          setSub(getCompanySubscription(companyId));
          setStripeOpen(false);
          if (onTrialRestarted) onTrialRestarted();
        }}
      />
    </>
  );
}
