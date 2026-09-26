import { useState, useEffect } from "react";
import { Modal } from "./modal";
import {
  SUBSCRIPTION_PACKAGES,
  getCompanySubscription,
  switchCompanyPackage,
  restartCompanyTrial,
  setPackageModeEnabled,
  getRemainingTrialSeconds,
  isTrialExpired,
  type PackageId,
  type CompanySubscription,
} from "@/lib/packages";
import { StripePaymentModal } from "./stripe-payment-modal";
import {
  Package,
  Check,
  Clock,
  Sparkles,
  CreditCard,
  RotateCcw,
  Power,
  Building2,
  Users,
  BedDouble,
  Layers,
  ArrowRight,
  Info,
  CheckCircle2,
} from "lucide-react";

// TEMPORARY TEST FEATURE: Remove before production launch

interface PackageSwitcherModalProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  forceExpiredView?: boolean;
}

export function PackageSwitcherModal({
  open,
  onClose,
  companyId,
  forceExpiredView = false,
}: PackageSwitcherModalProps) {
  const [sub, setSub] = useState<CompanySubscription>(() => getCompanySubscription(companyId));
  const [remainingSeconds, setRemainingSeconds] = useState<number>(() => getRemainingTrialSeconds(sub));
  const [stripeOpen, setStripeOpen] = useState(false);
  const [stripePackageInfo, setStripePackageInfo] = useState<{ amount: number; title: string }>({
    amount: 2,
    title: "Stripe Test Package",
  });
  const [selectedRationaleTab, setSelectedRationaleTab] = useState<PackageId>("starter");
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Sync state on companyId change or storage update
  useEffect(() => {
    const handleUpdate = () => {
      const current = getCompanySubscription(companyId);
      setSub(current);
      setRemainingSeconds(getRemainingTrialSeconds(current));
    };

    handleUpdate();
    window.addEventListener("paimba_package_changed", handleUpdate);
    return () => window.removeEventListener("paimba_package_changed", handleUpdate);
  }, [companyId]);

  // Live countdown timer for the 1-minute trial
  useEffect(() => {
    if (!sub.packageModeEnabled || !sub.isTrial || sub.status === "active") return;

    const interval = setInterval(() => {
      const rem = getRemainingTrialSeconds(sub);
      setRemainingSeconds(rem);
      if (rem <= 0) {
        setSub((prev) => ({ ...prev, status: "expired" }));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [sub]);

  const expired = isTrialExpired(sub) || (forceExpiredView && sub.packageModeEnabled);

  // Select non-test package (no card required in test mode)
  const handleSelectPackage = (pkgId: PackageId) => {
    if (pkgId === "test") {
      setStripePackageInfo({ amount: 2, title: SUBSCRIPTION_PACKAGES.test.name });
      setStripeOpen(true);
      return;
    }

    const updated = switchCompanyPackage(companyId, pkgId, true);
    setSub(updated);
    setRemainingSeconds(getRemainingTrialSeconds(updated));
    setActionNotice(`Switched to ${SUBSCRIPTION_PACKAGES[pkgId].name}! (1-minute trial started)`);
    setTimeout(() => setActionNotice(null), 3500);
  };

  // Restart 1-minute trial
  const handleRestartTrial = () => {
    const updated = restartCompanyTrial(companyId);
    setSub(updated);
    setRemainingSeconds(60);
    setActionNotice("1-Minute Trial restarted successfully!");
    setTimeout(() => setActionNotice(null), 3000);
  };

  // Master switch to turn off package mode completely
  const handleTogglePackageMode = () => {
    const nextVal = !sub.packageModeEnabled;
    const updated = setPackageModeEnabled(companyId, nextVal);
    setSub(updated);
    setActionNotice(
      nextVal
        ? "Package Enforcement Mode enabled."
        : "Package Enforcement Mode TURNED OFF. All features unlocked!"
    );
    setTimeout(() => setActionNotice(null), 3500);
  };

  const currentPlan = SUBSCRIPTION_PACKAGES[sub.packageId] || SUBSCRIPTION_PACKAGES.starter;

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Subscription Packages & Commercialization Architecture"
      >
        <div className="space-y-6 py-2">
          {/* Temporary test mode banner */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-amber-400 shrink-0" />
              <div>
                <span className="font-bold text-amber-300">
                  DEVELOPMENT TEST MODE: Package Selector & Stripe Sandbox
                </span>
                <p className="text-[11px] text-muted">
                  Non-test packages do not require card details. 1-minute trial tests automated expiration.
                </p>
              </div>
            </div>

            {/* Master toggle to turn off package mode */}
            <button
              type="button"
              onClick={handleTogglePackageMode}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-xs transition border ${
                sub.packageModeEnabled
                  ? "bg-surface border-border-color text-muted hover:text-foreground hover:border-red-500/40"
                  : "bg-emerald-600 border-emerald-500 text-white shadow-xs"
              }`}
            >
              <Power size={13} className={sub.packageModeEnabled ? "text-muted" : "text-white"} />
              <span>
                {sub.packageModeEnabled ? "Turn OFF Package Mode" : "Package Mode: DISABLED (Full Free Access)"}
              </span>
            </button>
          </div>

          {actionNotice && (
            <div className="flex items-center gap-2 rounded-xl bg-blue-600/20 border border-blue-500/40 p-2.5 text-xs text-blue-300 font-medium">
              <CheckCircle2 size={15} className="shrink-0" />
              <span>{actionNotice}</span>
            </div>
          )}

          {/* Trial Status & Expiration Alert */}
          {sub.packageModeEnabled && (
            <div
              className={`rounded-2xl border p-4 transition ${
                expired
                  ? "border-red-500/50 bg-red-500/10 text-red-200"
                  : sub.status === "active"
                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                  : "border-blue-500/30 bg-blue-500/10 text-blue-200"
              }`}
            >
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold ${
                      expired
                        ? "bg-red-600 text-white"
                        : sub.status === "active"
                        ? "bg-emerald-600 text-white"
                        : "bg-blue-600 text-white"
                    }`}
                  >
                    <Clock size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-foreground">
                        {expired
                          ? "Your 1-Minute Trial Has Expired"
                          : sub.status === "active"
                          ? `Active Plan: ${currentPlan.name} (Paid)`
                          : `Active Trial: ${currentPlan.name}`}
                      </h4>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          expired
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : sub.status === "active"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        }`}
                      >
                        {expired ? "Expired" : sub.status === "active" ? "Active" : `${remainingSeconds}s Remaining`}
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-0.5">
                      {expired
                        ? "The 1-minute trial period ended. Test Stripe payment ($2) or restart the trial below."
                        : sub.status === "active"
                        ? "Subscription is fully active and verified."
                        : `Test trial lasts 60 seconds. Currently on ${currentPlan.name}.`}
                    </p>
                  </div>
                </div>

                {/* Expiration action buttons */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRestartTrial}
                    className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface hover:border-foreground/30 transition shadow-xs"
                  >
                    <RotateCcw size={14} className="text-amber-400" />
                    <span>Restart 1-Minute Trial</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStripePackageInfo({ amount: 2, title: "Stripe Test Package" });
                      setStripeOpen(true);
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
                  >
                    <CreditCard size={14} />
                    <span>Pay $2 Test Package (Stripe)</span>
                  </button>
                </div>
              </div>

              {/* Progress countdown bar */}
              {sub.isTrial && sub.status !== "active" && (
                <div className="mt-3">
                  <div className="flex justify-between text-[11px] text-muted mb-1 font-mono">
                    <span>Trial Progress</span>
                    <span>{remainingSeconds} seconds left</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-surface overflow-hidden">
                    <div
                      className={`h-full transition-all duration-1000 ${
                        expired ? "bg-red-500" : remainingSeconds < 15 ? "bg-amber-500" : "bg-blue-500"
                      }`}
                      style={{ width: `${Math.min(100, (remainingSeconds / 60) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Package Grid (4 Standard Tiers + 1 Stripe Test Tier) */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">Available Commercial Plans</h3>
                <p className="text-xs text-muted">
                  Click any plan to switch. Non-test tiers require no bank card in test mode.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Package 1: Starter $5 */}
              <PlanCard
                plan={SUBSCRIPTION_PACKAGES.starter}
                isCurrent={sub.packageId === "starter"}
                onSelect={() => handleSelectPackage("starter")}
                priceDisplay="$5"
              />

              {/* Package 2: Standard $20 */}
              <PlanCard
                plan={SUBSCRIPTION_PACKAGES.standard}
                isCurrent={sub.packageId === "standard"}
                onSelect={() => handleSelectPackage("standard")}
                priceDisplay="$20"
                recommended
              />

              {/* Package 3: Pro $50 */}
              <PlanCard
                plan={SUBSCRIPTION_PACKAGES.pro}
                isCurrent={sub.packageId === "pro"}
                onSelect={() => handleSelectPackage("pro")}
                priceDisplay="$50"
              />

              {/* Package 4: Enterprise $200 */}
              <PlanCard
                plan={SUBSCRIPTION_PACKAGES.enterprise}
                isCurrent={sub.packageId === "enterprise"}
                onSelect={() => handleSelectPackage("enterprise")}
                priceDisplay="$200"
              />

              {/* Package 5: Stripe Test Package $2 */}
              <PlanCard
                plan={SUBSCRIPTION_PACKAGES.test}
                isCurrent={sub.packageId === "test"}
                onSelect={() => handleSelectPackage("test")}
                priceDisplay="$2"
                isTestBadge
              />
            </div>
          </div>

          {/* Commercialization Rationale Breakdown */}
          <div className="rounded-2xl border border-border-color bg-surface-elevated p-4">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3 border-b border-border-color pb-2.5">
              <div className="flex items-center gap-2">
                <Info size={16} className="text-blue-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Commercialization Strategy & Market Placement Rationale
                </h4>
              </div>

              {/* Tabs for each package */}
              <div className="flex flex-wrap gap-1">
                {(["starter", "standard", "pro", "enterprise", "test"] as PackageId[]).map((pkgKey) => (
                  <button
                    key={pkgKey}
                    type="button"
                    onClick={() => setSelectedRationaleTab(pkgKey)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      selectedRationaleTab === pkgKey
                        ? "bg-blue-600 text-white"
                        : "bg-surface border border-border-color text-muted hover:text-foreground"
                    }`}
                  >
                    {SUBSCRIPTION_PACKAGES[pkgKey].name} (${SUBSCRIPTION_PACKAGES[pkgKey].priceUsd})
                  </button>
                ))}
              </div>
            </div>

            {/* Rationale Details */}
            {(() => {
              const currentTabPlan = SUBSCRIPTION_PACKAGES[selectedRationaleTab];
              return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="rounded-xl border border-border-color bg-surface p-3 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400">Target Segment</p>
                    <p className="text-foreground leading-relaxed">
                      {currentTabPlan.commercialRationale.targetAudience}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border-color bg-surface p-3 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Pricing Rationale</p>
                    <p className="text-foreground leading-relaxed">
                      {currentTabPlan.commercialRationale.whyThisPrice}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border-color bg-surface p-3 space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Capacity & Quotas</p>
                    <ul className="space-y-1 text-muted">
                      <li className="flex justify-between">
                        <span>Max Properties:</span>
                        <span className="font-semibold text-foreground">
                          {currentTabPlan.limits.maxProperties === -1 ? "Unlimited" : currentTabPlan.limits.maxProperties}
                        </span>
                      </li>
                      <li className="flex justify-between">
                        <span>Max Rooms:</span>
                        <span className="font-semibold text-foreground">
                          {currentTabPlan.limits.maxRooms === -1 ? "Unlimited" : currentTabPlan.limits.maxRooms}
                        </span>
                      </li>
                      <li className="flex justify-between">
                        <span>Max Tenants:</span>
                        <span className="font-semibold text-foreground">
                          {currentTabPlan.limits.maxTenants === -1 ? "Unlimited" : currentTabPlan.limits.maxTenants}
                        </span>
                      </li>
                      <li className="flex justify-between">
                        <span>Max Staff Users:</span>
                        <span className="font-semibold text-foreground">
                          {currentTabPlan.limits.maxStaff === -1 ? "Unlimited" : currentTabPlan.limits.maxStaff}
                        </span>
                      </li>
                      <li className="flex justify-between">
                        <span>Email Reports:</span>
                        <span className="font-semibold text-foreground">
                          {currentTabPlan.limits.emailSharing ? "Enabled" : "Download Only"}
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </Modal>

      {/* Stripe Payment Modal for $2 test transaction */}
      <StripePaymentModal
        open={stripeOpen}
        onClose={() => setStripeOpen(false)}
        companyId={companyId}
        amountUsd={stripePackageInfo.amount}
        packageTitle={stripePackageInfo.title}
        onSuccess={() => {
          setSub(getCompanySubscription(companyId));
          setRemainingSeconds(0);
          setActionNotice("Stripe payment processed! Subscription is now Active.");
          setTimeout(() => setActionNotice(null), 3500);
        }}
      />
    </>
  );
}

// Plan Card Component
function PlanCard({
  plan,
  isCurrent,
  onSelect,
  priceDisplay,
  recommended,
  isTestBadge,
}: {
  plan: (typeof SUBSCRIPTION_PACKAGES)[PackageId];
  isCurrent: boolean;
  onSelect: () => void;
  priceDisplay: string;
  recommended?: boolean;
  isTestBadge?: boolean;
}) {
  return (
    <div
      className={`relative flex flex-col justify-between rounded-2xl border p-3.5 transition ${
        isCurrent
          ? "border-blue-500 bg-blue-500/10 shadow-md ring-1 ring-blue-500"
          : recommended
          ? "border-violet-500/40 bg-surface-elevated hover:border-violet-500"
          : isTestBadge
          ? "border-amber-500/40 bg-surface-elevated hover:border-amber-500"
          : "border-border-color bg-surface hover:border-foreground/30"
      }`}
    >
      {recommended && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-violet-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-xs">
          Popular
        </div>
      )}

      {isTestBadge && (
        <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-amber-600 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white shadow-xs">
          Stripe Test
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-xs font-bold text-foreground truncate">{plan.name}</h4>
          {isCurrent && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
              <Check size={12} />
            </span>
          )}
        </div>

        <div className="mb-2">
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-black text-foreground">{priceDisplay}</span>
            <span className="text-[10px] text-muted font-bold uppercase">/ month</span>
          </div>
          <p className="text-[10px] text-muted line-clamp-1">{plan.tagline}</p>
        </div>

        {/* Feature bullets */}
        <div className="border-t border-border-color pt-2 space-y-1 text-[11px]">
          <div className="flex items-center gap-1.5 text-foreground font-medium">
            <Building2 size={12} className="text-blue-400 shrink-0" />
            <span>{plan.limits.maxProperties === -1 ? "Unlimited" : `${plan.limits.maxProperties}`} Properties</span>
          </div>
          <div className="flex items-center gap-1.5 text-foreground font-medium">
            <BedDouble size={12} className="text-emerald-400 shrink-0" />
            <span>{plan.limits.maxRooms === -1 ? "Unlimited" : `${plan.limits.maxRooms}`} Rooms</span>
          </div>
          <div className="flex items-center gap-1.5 text-foreground font-medium">
            <Users size={12} className="text-violet-400 shrink-0" />
            <span>{plan.limits.maxTenants === -1 ? "Unlimited" : `${plan.limits.maxTenants}`} Tenants</span>
          </div>
          <div className="flex items-center gap-1.5 text-foreground font-medium">
            <Layers size={12} className="text-amber-400 shrink-0" />
            <span>{plan.limits.maxStaff === -1 ? "Unlimited" : `${plan.limits.maxStaff}`} Staff</span>
          </div>
        </div>

        {/* Key Feature highlights */}
        <div className="mt-2.5 pt-2 border-t border-border-color space-y-1 text-[10px] text-muted">
          {plan.commercialRationale.keyBenefits.slice(0, 3).map((benefit, i) => (
            <div key={i} className="flex items-center gap-1 truncate">
              <Check size={10} className="text-emerald-400 shrink-0" />
              <span className="truncate">{benefit}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 pt-2">
        <button
          type="button"
          onClick={onSelect}
          className={`w-full rounded-xl py-1.5 text-xs font-bold transition flex items-center justify-center gap-1 ${
            isCurrent
              ? "bg-surface border border-blue-500 text-blue-400 cursor-default"
              : isTestBadge
              ? "bg-amber-600 text-white hover:bg-amber-700 shadow-xs"
              : "bg-foreground text-background hover:opacity-90 shadow-xs"
          }`}
        >
          {isCurrent ? (
            <span>Active Plan</span>
          ) : isTestBadge ? (
            <>
              <CreditCard size={12} />
              <span>Test Stripe ($2)</span>
            </>
          ) : (
            <>
              <span>Select Plan</span>
              <ArrowRight size={11} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
