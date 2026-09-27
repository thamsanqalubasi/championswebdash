/**
 * TrialOnboardingModal - 3-Step Free Trial Signup Flow
 *
 * Step 1: Welcome screen - "3 months free, no charge today"
 * Step 2: Package selection - user picks their plan (sees features of that plan)
 * Step 3: Card details - Stripe SetupIntent (card saved, $0 charged)
 *
 * After completing step 3, Stripe saves the card and a subscription is created
 * with a TRIAL_PERIOD_DAYS trial. First real charge happens after trial ends.
 */
import { useState } from "react";
import { Modal } from "./modal";
import {
  SUBSCRIPTION_PACKAGES,
  TRIAL_PERIOD_DAYS,
  getCompanySubscription,
  saveCompanySubscription,
  type PackageId,
} from "@/lib/packages";
import { PackageCarousel } from "./package-switcher-modal";
import { loadStripe } from "@stripe/stripe-js";
import {
  Sparkles,
  CheckCircle2,
  CreditCard,
  Shield,
  Lock,
  ArrowRight,
  Loader2,
  Calendar,
  Gift,
  AlertCircle,
} from "lucide-react";

type Step = 1 | 2 | 3 | 4; // 4 = success

interface TrialOnboardingModalProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  customerEmail?: string;
  onSuccess?: (packageId: PackageId) => void;
}

export function TrialOnboardingModal({
  open,
  onClose,
  companyId,
  customerEmail,
  onSuccess,
}: TrialOnboardingModalProps) {
  const [step, setStep] = useState<Step>(1);
  const [selectedPackage, setSelectedPackage] = useState<PackageId>("standard");

  // Card form state
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [zipCode, setZipCode] = useState("");

  const [processing, setProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const trialEndDate = new Date(Date.now() + TRIAL_PERIOD_DAYS * 24 * 60 * 60 * 1000);
  const formattedTrialEnd = trialEndDate.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const selectedPlan = SUBSCRIPTION_PACKAGES[selectedPackage];

  // Format card number with spaces
  const handleCardNumberChange = (val: string) => {
    const raw = val.replace(/\D/g, "").slice(0, 16);
    const parts = raw.match(/[\s\S]{1,4}/g) || [];
    setCardNumber(parts.join(" "));
  };

  // Format expiry MM/YY
  const handleExpiryChange = (val: string) => {
    const raw = val.replace(/\D/g, "").slice(0, 4);
    if (raw.length >= 3) {
      setCardExpiry(`${raw.slice(0, 2)}/${raw.slice(2)}`);
    } else {
      setCardExpiry(raw);
    }
  };

  const handlePackageSelect = (pkgId: PackageId) => {
    setSelectedPackage(pkgId);
  };

  const handleStartTrial = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const strippedCard = cardNumber.replace(/\s/g, "");
    if (strippedCard.length < 15) {
      setErrorMsg("Please enter a valid card number.");
      return;
    }
    if (cardExpiry.length < 5) {
      setErrorMsg("Please enter card expiry as MM/YY.");
      return;
    }
    if (cardCvc.length < 3) {
      setErrorMsg("Please enter a valid CVC.");
      return;
    }

    setProcessing(true);

    try {
      // 1. Get SetupIntent from backend (saves card, $0 charge)
      const res = await fetch("/api/create-stripe-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          packageId: selectedPackage,
          mode: "setup_intent",
          customerEmail,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.clientSecret) {
        throw new Error(data?.error || "Failed to initialize trial setup. Please try again.");
      }

      // 2. Confirm the card via Stripe.js (saves payment method, $0 charged)
      const pubKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "";
      if (!pubKey) {
        // Fallback: sandbox simulation (for dev without Stripe publishable key)
        console.warn("No Stripe publishable key - simulating card save.");
        await new Promise((r) => setTimeout(r, 1500));
      } else {
        const stripeInstance = await loadStripe(pubKey);
        if (!stripeInstance) throw new Error("Could not initialize payment gateway.");

        const [expMonth, expYear] = cardExpiry.split("/");
        const result = await stripeInstance.confirmCardSetup(data.clientSecret, {
          payment_method: {
            card: {
              number: cardNumber.replace(/\s/g, ""),
              exp_month: Number(expMonth),
              exp_year: Number(`20${expYear}`),
              cvc: cardCvc,
            } as any,
            billing_details: {
              name: cardName || "Paimba Customer",
              address: { postal_code: zipCode || undefined },
            },
          },
        });

        if (result.error) {
          throw new Error(result.error.message || "Card could not be saved. Please check your details.");
        }
      }

      // 3. Update local subscription state
      const currentSub = getCompanySubscription(companyId);
      const trialEndsAt = Date.now() + TRIAL_PERIOD_DAYS * 24 * 60 * 60 * 1000;

      saveCompanySubscription(companyId, {
        ...currentSub,
        packageId: selectedPackage,
        status: "trial",
        isTrial: true,
        trialStartedAt: Date.now(),
        trialEndsAt,
        trialDurationSeconds: TRIAL_PERIOD_DAYS * 24 * 60 * 60,
        stripeCustomerId: data.stripeCustomerId,
        packageModeEnabled: true,
      });

      setStep(4); // Success
      if (onSuccess) onSuccess(selectedPackage);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to start trial. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setErrorMsg(null);
    setCardName("");
    setCardNumber("");
    setCardExpiry("");
    setCardCvc("");
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={
        step === 1
          ? "Start Your Free 3-Month Trial"
          : step === 2
          ? "Choose Your Plan"
          : step === 3
          ? "Save Your Card - No Charge Today"
          : "Trial Started!"
      }
      maxWidthClassName="max-w-[85vw] w-[85vw]"
    >
      {/* Step 1: Welcome */}
      {step === 1 && (
        <div className="py-4 space-y-6">
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-violet-600 text-white shadow-lg">
              <Gift size={32} />
            </div>
            <div>
              <h2 className="text-xl font-black text-foreground">3 Months Completely Free</h2>
              <p className="text-sm text-muted mt-1">
                No charge now. Your card is saved but never charged during the trial.
              </p>
            </div>
          </div>

          {/* Trial benefits */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              {
                icon: <Calendar size={18} className="text-blue-400" />,
                title: `${TRIAL_PERIOD_DAYS} Days Free`,
                desc: `Full access to your chosen plan until ${formattedTrialEnd}.`,
              },
              {
                icon: <CreditCard size={18} className="text-emerald-400" />,
                title: "Card Saved, Not Charged",
                desc: "We securely save your card. No money leaves your account today.",
              },
              {
                icon: <Shield size={18} className="text-violet-400" />,
                title: "Cancel Anytime",
                desc: "Cancel before the trial ends and you will never be charged. No questions asked.",
              },
            ].map((b, i) => (
              <div
                key={i}
                className="rounded-xl border border-border-color bg-surface-elevated p-3.5 space-y-1.5"
              >
                <div className="flex items-center gap-2">
                  {b.icon}
                  <span className="text-xs font-bold text-foreground">{b.title}</span>
                </div>
                <p className="text-[11px] text-muted leading-relaxed">{b.desc}</p>
              </div>
            ))}
          </div>

          {/* Timeline */}
          <div className="rounded-xl border border-border-color bg-surface p-4 space-y-2 text-xs">
            <p className="font-bold text-foreground text-[11px] uppercase tracking-wider mb-2">What Happens Next</p>
            {[
              { dot: "bg-blue-500", label: "Today", text: "Card saved securely (Encrypted, $0 charged)" },
              {
                dot: "bg-emerald-500",
                label: `Day 1–${TRIAL_PERIOD_DAYS}`,
                text: "Full access to all features in your chosen plan",
              },
              {
                dot: "bg-amber-500",
                label: `Day ${TRIAL_PERIOD_DAYS - 3}`,
                text: "We email you a reminder: 3 days until first charge",
              },
              {
                dot: "bg-violet-500",
                label: `Day ${TRIAL_PERIOD_DAYS + 1}`,
                text: `First monthly charge - ${selectedPlan?.priceUsd ? `$${selectedPlan.priceUsd}/month` : "plan price"} - auto-renews monthly`,
              },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className={`h-2 w-2 rounded-full ${item.dot} shrink-0 mt-1.5`} />
                <div>
                  <span className="font-bold text-foreground">{item.label}: </span>
                  <span className="text-muted">{item.text}</span>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setStep(2)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 py-3 text-sm font-bold text-white shadow-md hover:opacity-90 transition"
          >
            <Sparkles size={16} />
            Start My Free {TRIAL_PERIOD_DAYS}-Day Trial
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* Step 2: Choose Package */}
      {step === 2 && (
        <div className="py-4 space-y-4">
          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-300">
            <span className="font-bold">Your card will NOT be charged</span> during the{" "}
            {TRIAL_PERIOD_DAYS}-day trial. First payment on{" "}
            <span className="font-bold text-blue-200">{formattedTrialEnd}</span>.
          </div>

          <div>
            <h3 className="text-sm font-bold text-foreground mb-1">Choose Your Plan</h3>
            <p className="text-xs text-muted">
              Select the plan you want to trial. You will have access to all features within your chosen tier.
              Higher-tier features will remain locked.
            </p>
          </div>

          <PackageCarousel
            currentPackageId={selectedPackage}
            onSelectPackage={handlePackageSelect}
            trialMode
          />

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs">
            <p className="font-bold text-emerald-300">Selected: {selectedPlan?.name}</p>
            <p className="text-muted mt-0.5">
              {selectedPlan?.tagline} - ${selectedPlan?.priceUsd}/month after trial.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-1/3 rounded-xl border border-border-color bg-surface px-3 py-2.5 text-xs font-semibold text-muted hover:text-foreground transition"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-xs font-bold text-white hover:bg-blue-700 transition"
            >
              Save Card & Start Trial
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Card Details (SetupIntent - $0 charge) */}
      {step === 3 && (
        <form onSubmit={handleStartTrial} className="py-4 space-y-4">
          {/* Header */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 space-y-1">
            <div className="flex items-center gap-2">
              <Lock size={15} className="text-amber-400" />
              <p className="text-xs font-bold text-amber-300">
                No charge today - card saved for after trial
              </p>
            </div>
            <p className="text-[11px] text-muted">
              Your card is encrypted and stored securely. You will NOT be charged anything today.
              First payment of{" "}
              <strong className="text-foreground">${selectedPlan?.priceUsd}/month</strong> begins on{" "}
              <strong className="text-foreground">{formattedTrialEnd}</strong>.
            </p>
          </div>

          {errorMsg && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Plan summary */}
          <div className="flex items-center justify-between rounded-xl border border-border-color bg-surface-elevated p-3 text-xs">
            <div>
              <p className="font-bold text-foreground">{selectedPlan?.name}</p>
              <p className="text-muted">{TRIAL_PERIOD_DAYS}-day free trial</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-foreground">${selectedPlan?.priceUsd}</p>
              <p className="text-[10px] text-muted">/ month after trial</p>
            </div>
          </div>

          {/* Card form */}
          <div className="space-y-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
                Cardholder Name
              </label>
              <input
                type="text"
                required
                placeholder="Full name on card"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                className="w-full rounded-xl border border-border-color bg-surface px-3 py-2 text-xs text-foreground focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
                Card Number
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="4242 4242 4242 4242"
                  value={cardNumber}
                  onChange={(e) => handleCardNumberChange(e.target.value)}
                  maxLength={19}
                  className="w-full rounded-xl border border-border-color bg-surface pl-9 pr-3 py-2 text-xs font-mono text-foreground focus:border-blue-500 focus:outline-none"
                />
                <CreditCard size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
                  MM / YY
                </label>
                <input
                  type="text"
                  required
                  placeholder="MM/YY"
                  value={cardExpiry}
                  onChange={(e) => handleExpiryChange(e.target.value)}
                  maxLength={5}
                  className="w-full rounded-xl border border-border-color bg-surface px-3 py-2 text-xs font-mono text-center text-foreground focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="col-span-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
                  CVC
                </label>
                <input
                  type="password"
                  required
                  placeholder="123"
                  value={cardCvc}
                  onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  maxLength={4}
                  className="w-full rounded-xl border border-border-color bg-surface px-3 py-2 text-xs font-mono text-center text-foreground focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="col-span-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
                  ZIP / Postal
                </label>
                <input
                  type="text"
                  placeholder="90210"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  className="w-full rounded-xl border border-border-color bg-surface px-3 py-2 text-xs text-foreground focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Security note */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-muted/70">
            <Shield size={13} className="text-emerald-500" />
            <span>End-to-End Encrypted - we never store your card details</span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              disabled={processing}
              className="w-1/3 rounded-xl border border-border-color bg-surface px-3 py-2.5 text-xs font-semibold text-muted hover:text-foreground transition"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={processing}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 py-2.5 text-xs font-bold text-white shadow-md hover:opacity-90 transition disabled:opacity-60"
            >
              {processing ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Saving card securely...
                </>
              ) : (
                <>
                  <Lock size={13} />
                  Start Free Trial - $0 Charged Today
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {/* Step 4: Success */}
      {step === 4 && (
        <div className="py-6 text-center space-y-5">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-500">
            <CheckCircle2 size={36} />
          </div>
          <div>
            <h3 className="text-xl font-black text-foreground">Trial Started!</h3>
            <p className="text-sm text-muted mt-1">
              Welcome to your free {TRIAL_PERIOD_DAYS}-day trial of{" "}
              <strong className="text-foreground">{selectedPlan?.name}</strong>.
            </p>
          </div>

          <div className="rounded-xl border border-border-color bg-surface-elevated p-4 text-left space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted">Plan:</span>
              <span className="font-semibold text-foreground">{selectedPlan?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Trial Period:</span>
              <span className="font-semibold text-foreground">{TRIAL_PERIOD_DAYS} days free</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">First Charge:</span>
              <span className="font-semibold text-foreground">{formattedTrialEnd}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Monthly Rate:</span>
              <span className="font-semibold text-emerald-400">${selectedPlan?.priceUsd}/month</span>
            </div>
          </div>

          <p className="text-[11px] text-muted">
            You will receive an email reminder 3 days before your trial ends. Cancel anytime in Settings.
          </p>

          <button
            type="button"
            onClick={handleClose}
            className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition"
          >
            Explore My Dashboard
          </button>
        </div>
      )}
    </Modal>
  );
}
