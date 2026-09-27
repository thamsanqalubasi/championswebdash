import { useState, useEffect, useRef } from "react";
import { Modal } from "./modal";
import {
  SUBSCRIPTION_PACKAGES,
  getCompanySubscription,
  switchCompanyPackage,
  restartCompanyTrial,
  setPackageModeEnabled,
  getRemainingTrialSeconds,
  isTrialExpired,
  formatTrialCountdown,
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
  ChevronLeft,
  ChevronRight,
  Mail,
} from "lucide-react";
import { EnterpriseSalesModal } from "./enterprise-sales-modal";

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
    amount: SUBSCRIPTION_PACKAGES.test.priceUsd,
    title: SUBSCRIPTION_PACKAGES.test.name,
  });
  const [selectedRationaleTab, setSelectedRationaleTab] = useState<PackageId>("starter");
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [salesModalOpen, setSalesModalOpen] = useState(false);

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

  // Select package handler
  const handleSelectPackage = (pkgId: PackageId) => {
    if (pkgId === "custom") {
      setSalesModalOpen(true);
      return;
    }

    if (pkgId === "test") {
      setStripePackageInfo({ amount: SUBSCRIPTION_PACKAGES.test.priceUsd, title: SUBSCRIPTION_PACKAGES.test.name });
      setStripeOpen(true);
      return;
    }

    const updated = switchCompanyPackage(companyId, pkgId, true);
    setSub(updated);
    setRemainingSeconds(getRemainingTrialSeconds(updated));
    setActionNotice(`Switched to ${SUBSCRIPTION_PACKAGES[pkgId].name}! (1-minute trial started)`);
    setTimeout(() => setActionNotice(null), 3500);
  };

  const [selectedMinutes, setSelectedMinutes] = useState<number>(() =>
    Math.max(1, Math.round((sub.trialDurationSeconds || 60) / 60))
  );

  // Restart trial with customizable duration (1, 2, 3, 5, 10 minutes)
  const handleRestartTrial = (mins?: number) => {
    const minutesToUse = mins || selectedMinutes;
    const durationSeconds = minutesToUse * 60;
    const updated = restartCompanyTrial(companyId, durationSeconds);
    setSub(updated);
    setRemainingSeconds(durationSeconds);
    setActionNotice(`Test trial restarted for ${minutesToUse} minute${minutesToUse > 1 ? "s" : ""}!`);
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
        maxWidthClassName="max-w-[85vw] w-[85vw]"
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
                          ? `Your ${Math.round((sub.trialDurationSeconds || 60) / 60)}-Minute Trial Has Expired`
                          : sub.status === "active"
                          ? `Active Plan: ${currentPlan.name} (Paid)`
                          : `Active Trial: ${currentPlan.name}`}
                      </h4>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full font-mono ${
                          expired
                            ? "bg-red-500/20 text-red-400 border border-red-500/30"
                            : sub.status === "active"
                            ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                            : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                        }`}
                      >
                        {expired
                          ? "Expired"
                          : sub.status === "active"
                          ? "Active"
                          : `${formatTrialCountdown(remainingSeconds)} Remaining`}
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-0.5">
                      {expired
                        ? "The trial period ended. Test Stripe payment ($0.50) or choose new minutes and restart below."
                        : sub.status === "active"
                        ? "Subscription is fully active and verified."
                        : `Test trial is counting down live. Change minutes or restart anytime.`}
                    </p>
                  </div>
                </div>

                {/* Expiration action buttons & minute selector */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1 bg-surface-elevated/70 p-1 rounded-xl border border-border-color">
                    <span className="text-[10px] font-bold text-muted px-1.5 uppercase">Minutes:</span>
                    {[1, 2, 3, 5, 10].map((mins) => (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => {
                          setSelectedMinutes(mins);
                          handleRestartTrial(mins);
                        }}
                        className={`rounded-lg px-2 py-1 text-xs font-bold transition ${
                          selectedMinutes === mins
                            ? "bg-amber-500 text-black shadow-xs"
                            : "text-muted hover:text-foreground hover:bg-surface"
                        }`}
                        title={`Restart trial for ${mins} minutes`}
                      >
                        {mins}m
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRestartTrial()}
                    className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-surface px-3 py-2 text-xs font-bold text-amber-400 hover:bg-amber-500/10 transition shadow-xs"
                  >
                    <RotateCcw size={14} className="text-amber-400" />
                    <span>Restart ({selectedMinutes}m)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStripePackageInfo({
                        amount: SUBSCRIPTION_PACKAGES.test.priceUsd,
                        title: SUBSCRIPTION_PACKAGES.test.name,
                      });
                      setStripeOpen(true);
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
                  >
                    <CreditCard size={14} />
                    <span>Pay ${SUBSCRIPTION_PACKAGES.test.priceUsd.toFixed(2)} Test Package (Stripe)</span>
                  </button>
                </div>
              </div>

              {/* Progress countdown bar */}
              {sub.isTrial && sub.status !== "active" && (
                <div className="mt-3">
                  <div className="flex justify-between text-[11px] text-muted mb-1 font-mono">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
                      Live Trial Countdown
                    </span>
                    <span className="font-bold text-foreground">
                      {formatTrialCountdown(remainingSeconds)} ({remainingSeconds}s total)
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-surface overflow-hidden">
                    <div
                      className={`h-full transition-all duration-1000 ${
                        expired ? "bg-red-500" : remainingSeconds < 15 ? "bg-amber-500" : "bg-blue-500"
                      }`}
                      style={{
                        width: `${Math.min(
                          100,
                          (remainingSeconds / (sub.trialDurationSeconds || 60)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Package Carousel (5 Big Tiers with smooth horizontal scroll) */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <h3 className="text-sm font-bold text-foreground">Available Commercial Plans</h3>
                <p className="text-xs text-muted">
                  Click any plan to switch. Non-test tiers require no bank card in test mode.
                </p>
              </div>
            </div>

            <PackageCarousel
              currentPackageId={sub.packageId}
              onSelectPackage={handleSelectPackage}
            />
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

      {/* Custom Enterprise Consultation Form Modal */}
      <EnterpriseSalesModal
        open={salesModalOpen}
        onClose={() => setSalesModalOpen(false)}
        companyId={companyId}
      />
    </>
  );
}

// Package Carousel Component with horizontal scrolling & navigation controls
export function PackageCarousel({
  currentPackageId,
  onSelectPackage,
  trialMode = false,
}: {
  currentPackageId: PackageId;
  onSelectPackage: (pkgId: PackageId) => void;
  trialMode?: boolean; // When true: shows "Start Trial" instead of "Select Plan", hides test package
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (containerRef.current) {
      const scrollAmount = 340;
      containerRef.current.scrollBy({
        left: dir === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const allPlans: {
    plan: (typeof SUBSCRIPTION_PACKAGES)[PackageId];
    priceDisplay: string;
    recommended?: boolean;
    isTestBadge?: boolean;
    isContactSales?: boolean;
  }[] = [
    { plan: SUBSCRIPTION_PACKAGES.starter, priceDisplay: "$5" },
    { plan: SUBSCRIPTION_PACKAGES.standard, priceDisplay: "$20", recommended: true },
    { plan: SUBSCRIPTION_PACKAGES.pro, priceDisplay: "$50" },
    { plan: SUBSCRIPTION_PACKAGES.enterprise, priceDisplay: "$200" },
    {
      plan: SUBSCRIPTION_PACKAGES.custom,
      priceDisplay: "Custom Quote",
      isContactSales: true,
    },
    {
      plan: SUBSCRIPTION_PACKAGES.test,
      priceDisplay: `$${SUBSCRIPTION_PACKAGES.test.priceUsd.toFixed(2)}`,
      isTestBadge: true,
    },
  ];

  // In trial mode, hide the test/sandbox package — only show real commercial plans
  const plans = trialMode ? allPlans.filter((p) => !p.isTestBadge) : allPlans;

  return (
    <div className="relative group">
      {/* Scroll controls bar */}
      <div className="flex items-center justify-between mb-2.5 px-1">
        <span className="text-[11px] text-muted flex items-center gap-1.5 font-medium">
          <span className="hidden sm:inline">← Scroll or drag horizontally to view all plans →</span>
          <span className="sm:hidden">Swipe sideways to view tiers</span>
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scroll("left")}
            aria-label="Scroll left"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-border-color bg-surface-elevated text-foreground hover:bg-surface hover:border-blue-500 transition shadow-xs"
            title="Scroll left"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => scroll("right")}
            aria-label="Scroll right"
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-border-color bg-surface-elevated text-foreground hover:bg-surface hover:border-blue-500 transition shadow-xs"
            title="Scroll right"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Big Carousel Scroll Track */}
      <div
        ref={containerRef}
        className="flex gap-4 overflow-x-auto pb-4 pt-2 px-1 scroll-smooth snap-x snap-mandatory"
        style={{ scrollbarWidth: "thin" }}
      >
        {plans.map(({ plan, priceDisplay, recommended, isTestBadge, isContactSales }) => (
          <PlanCard
            key={plan.id}
            plan={plan}
            isCurrent={currentPackageId === plan.id}
            onSelect={() => onSelectPackage(plan.id)}
            priceDisplay={priceDisplay}
            recommended={recommended}
            isTestBadge={isTestBadge}
            isContactSales={isContactSales}
          />
        ))}
      </div>
    </div>
  );
}

// Plan Card Component - Large, Spacious, and High-Impact
export function PlanCard({
  plan,
  isCurrent,
  onSelect,
  priceDisplay,
  recommended,
  isTestBadge,
  isContactSales,
}: {
  plan: (typeof SUBSCRIPTION_PACKAGES)[PackageId];
  isCurrent: boolean;
  onSelect: () => void;
  priceDisplay: string;
  recommended?: boolean;
  isTestBadge?: boolean;
  isContactSales?: boolean;
}) {
  return (
    <div
      className={`relative flex flex-col justify-between w-[320px] min-w-[300px] shrink-0 snap-start rounded-2xl border p-5 transition shadow-sm hover:shadow-md ${
        isCurrent
          ? "border-blue-500 bg-blue-500/10 shadow-md ring-2 ring-blue-500/50"
          : recommended
          ? "border-violet-500/40 bg-surface-elevated hover:border-violet-500"
          : isContactSales
          ? "border-indigo-500/40 bg-surface-elevated hover:border-indigo-500"
          : isTestBadge
          ? "border-amber-500/40 bg-surface-elevated hover:border-amber-500"
          : "border-border-color bg-surface hover:border-foreground/30"
      }`}
    >
      {recommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-violet-600 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs">
          Popular
        </div>
      )}

      {isContactSales && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs">
          Bespoke Scale
        </div>
      )}

      {isTestBadge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-amber-600 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-xs">
          Stripe Sandbox
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <h4 className="text-sm font-bold text-foreground truncate">{plan.name}</h4>
          {isCurrent && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs">
              <Check size={13} />
            </span>
          )}
        </div>

        <div className="mb-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-foreground tracking-tight">{priceDisplay}</span>
            {!isContactSales && <span className="text-xs text-muted font-bold uppercase">/ month</span>}
          </div>
          <p className="text-xs text-muted leading-relaxed mt-0.5 line-clamp-2">{plan.tagline}</p>
        </div>

        {/* Feature bullets in clean mini badges */}
        <div className="border-t border-border-color pt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1.5 text-foreground font-semibold rounded-lg bg-surface-elevated/70 p-2 border border-border-color/60">
            <Building2 size={13} className="text-blue-400 shrink-0" />
            <span className="truncate">
              {isContactSales ? "> 20 Props" : plan.limits.maxProperties === -1 ? "Unlimited" : `${plan.limits.maxProperties} Props`}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-foreground font-semibold rounded-lg bg-surface-elevated/70 p-2 border border-border-color/60">
            <BedDouble size={13} className="text-emerald-400 shrink-0" />
            <span className="truncate">
              {isContactSales ? "> 500 Rooms" : plan.limits.maxRooms === -1 ? "Unlimited" : `${plan.limits.maxRooms} Rooms`}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-foreground font-semibold rounded-lg bg-surface-elevated/70 p-2 border border-border-color/60">
            <Users size={13} className="text-violet-400 shrink-0" />
            <span className="truncate">
              {isContactSales ? "> 600 Tenants" : plan.limits.maxTenants === -1 ? "Unlimited" : `${plan.limits.maxTenants} Tenants`}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-foreground font-semibold rounded-lg bg-surface-elevated/70 p-2 border border-border-color/60">
            <Layers size={13} className="text-amber-400 shrink-0" />
            <span className="truncate">
              {isContactSales ? "> 100 Staff" : plan.limits.maxStaff === -1 ? "Unlimited" : `${plan.limits.maxStaff} Staff`}
            </span>
          </div>
        </div>

        {/* Key Feature highlights */}
        <div className="mt-3 pt-3 border-t border-border-color space-y-1.5 text-xs text-muted">
          {plan.commercialRationale.keyBenefits.slice(0, 4).map((benefit, i) => (
            <div key={i} className="flex items-start gap-1.5">
              <Check size={12} className="text-emerald-400 shrink-0 mt-0.5" />
              <span className="text-[11px] leading-tight text-foreground/80">{benefit}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-border-color">
        <button
          type="button"
          onClick={onSelect}
          className={`w-full rounded-xl py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            isCurrent
              ? "bg-surface border border-blue-500 text-blue-400 cursor-default"
              : isContactSales
              ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-md"
              : isTestBadge
              ? "bg-amber-600 text-white hover:bg-amber-700 shadow-md"
              : "bg-foreground text-background hover:opacity-90 shadow-md"
          }`}
        >
          {isCurrent ? (
            <span>Active Plan</span>
          ) : isContactSales ? (
            <>
              <Mail size={13} />
              <span>Contact Our Sales Agent</span>
            </>
          ) : isTestBadge ? (
            <>
              <CreditCard size={13} />
              <span>Test Stripe (${SUBSCRIPTION_PACKAGES.test.priceUsd.toFixed(2)})</span>
            </>
          ) : (
            <>
              <span>Select Plan</span>
              <ArrowRight size={12} />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
