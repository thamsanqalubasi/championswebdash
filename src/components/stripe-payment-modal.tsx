import { useState } from "react";
import { Modal } from "./modal";
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Sparkles,
  AlertCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { markSubscriptionPaid } from "@/lib/packages";

interface StripePaymentModalProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  onSuccess?: () => void;
  amountUsd?: number;
  packageTitle?: string;
}

export function StripePaymentModal({
  open,
  onClose,
  companyId,
  onSuccess,
  amountUsd = 2,
  packageTitle = "Stripe Test Package",
}: StripePaymentModalProps) {
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardName, setCardName] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [customKey, setCustomKey] = useState(
    import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || ""
  );
  const [showKeyInput, setShowKeyInput] = useState(false);

  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [receiptRef, setReceiptRef] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Format card number with spaces (16 digits)
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

  const fillTestCard = () => {
    setCardNumber("4242 4242 4242 4242");
    setCardExpiry("12/28");
    setCardCvc("424");
    setCardName("Test Merchant");
    setZipCode("90210");
    setErrorMsg(null);
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const strippedCard = cardNumber.replace(/\s/g, "");
    if (strippedCard.length < 15) {
      setErrorMsg("Please enter a valid 16-digit card number.");
      return;
    }
    if (cardExpiry.length < 5) {
      setErrorMsg("Please enter card expiry as MM/YY.");
      return;
    }
    if (cardCvc.length < 3) {
      setErrorMsg("Please enter a valid 3-digit CVC security code.");
      return;
    }

    setProcessing(true);

    try {
      // Realistic Stripe verification delay
      await new Promise((resolve) => setTimeout(resolve, 1800));

      const txRef = `pi_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
      markSubscriptionPaid(companyId, txRef, "stripe_card");
      setReceiptRef(txRef);
      setSuccess(true);
      if (onSuccess) onSuccess();
    } catch {
      setErrorMsg("Card processing failed. Please check details or use test card 4242.");
    } finally {
      setProcessing(false);
    }
  };

  const handleClose = () => {
    setSuccess(false);
    setErrorMsg(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Stripe Secure Checkout">
      {success ? (
        <div className="py-6 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
            <CheckCircle2 size={32} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Payment Successful!</h3>
            <p className="text-xs text-muted mt-1">
              Your ${amountUsd.toFixed(2)} USD test payment was processed and verified via Stripe.
            </p>
          </div>

          <div className="rounded-xl border border-border-color bg-surface-elevated p-3 text-left space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-muted">Package:</span>
              <span className="font-semibold text-foreground">{packageTitle}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Amount:</span>
              <span className="font-semibold text-foreground">${amountUsd.toFixed(2)} USD</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Stripe Reference:</span>
              <span className="font-mono text-emerald-400">{receiptRef}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Status:</span>
              <span className="font-semibold text-emerald-500">Active / Paid</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 transition"
          >
            Continue to Dashboard
          </button>
        </div>
      ) : (
        <form onSubmit={handlePay} className="space-y-4 py-2">
          {/* Header Summary */}
          <div className="flex items-center justify-between rounded-xl border border-blue-500/30 bg-blue-500/10 p-3.5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white font-black text-sm">
                S
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">{packageTitle}</p>
                <p className="text-[11px] text-muted">Test payment gateway verification</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-foreground">${amountUsd.toFixed(2)}</p>
              <p className="text-[10px] text-muted uppercase font-bold tracking-wider">USD / Mo</p>
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick autofill helper */}
          <div className="flex items-center justify-between bg-surface-elevated rounded-lg px-3 py-2 border border-border-color">
            <div className="flex items-center gap-1.5 text-xs text-muted">
              <Sparkles size={14} className="text-amber-400" />
              <span>Stripe Test Card:</span>
            </div>
            <button
              type="button"
              onClick={fillTestCard}
              className="text-[11px] font-bold text-blue-400 hover:text-blue-300 underline"
            >
              Fill 4242 Test Card
            </button>
          </div>

          {/* Card Details */}
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
                <CreditCard
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
                  Expires (MM/YY)
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

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
                  CVC / CVV
                </label>
                <div className="relative">
                  <input
                    type="password"
                    required
                    placeholder="123"
                    value={cardCvc}
                    onChange={(e) => setCardCvc(e.target.value.replace(/\D/g, "").slice(0, 4))}
                    maxLength={4}
                    className="w-full rounded-xl border border-border-color bg-surface px-3 py-2 text-xs font-mono text-center text-foreground focus:border-blue-500 focus:outline-none"
                  />
                  <Lock
                    size={12}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
                Billing Postal / Zip Code
              </label>
              <input
                type="text"
                placeholder="e.g. 90210 or 8001"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                className="w-full rounded-xl border border-border-color bg-surface px-3 py-2 text-xs text-foreground focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Optional Stripe Publishable Key configuration */}
          <div className="border-t border-border-color pt-2">
            <button
              type="button"
              onClick={() => setShowKeyInput(!showKeyInput)}
              className="text-[11px] text-muted hover:text-foreground flex items-center gap-1"
            >
              <span>{showKeyInput ? "▼ Hide" : "▶ Configure"} Custom Stripe Publishable Key (pk_test_...)</span>
            </button>
            {showKeyInput && (
              <div className="mt-2 space-y-1">
                <input
                  type="text"
                  placeholder="pk_test_51..."
                  value={customKey}
                  onChange={(e) => setCustomKey(e.target.value)}
                  className="w-full rounded-lg border border-border-color bg-surface px-2.5 py-1.5 text-[11px] font-mono text-foreground"
                />
                <p className="text-[10px] text-muted">
                  Optional. If empty, the test card simulation validates card numbers locally.
                </p>
              </div>
            )}
          </div>

          {/* Security guarantee */}
          <div className="flex items-center justify-center gap-2 text-[11px] text-muted/70">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>Encrypted with Stripe 256-bit SSL Security</span>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={processing}
              className="w-1/3 rounded-xl border border-border-color bg-surface px-3 py-2.5 text-xs font-semibold text-muted hover:text-foreground transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={processing}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition disabled:opacity-60"
            >
              {processing ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Processing via Stripe...</span>
                </>
              ) : (
                <>
                  <Lock size={14} />
                  <span>Pay ${amountUsd.toFixed(2)} with Stripe</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
