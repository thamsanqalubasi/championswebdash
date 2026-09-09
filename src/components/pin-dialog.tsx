import { useState, useEffect } from "react";
import { ShieldAlert, KeyRound, AlertCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { verifyUserPin, hasUserPin } from "@/lib/data";

interface PinPromptDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
  title?: string;
  description?: string;
  actionLabel?: string;
  actionVariant?: "danger" | "primary";
}

export function PinPromptDialog({
  isOpen,
  onClose,
  onSuccess,
  title = "Security PIN Verification",
  description = "Please enter your 4-digit security PIN to confirm this action.",
  actionLabel = "Confirm Action",
  actionVariant = "danger",
}: PinPromptDialogProps) {
  const { user, currentCompanyUser } = useAuth();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [hasPinConfigured, setHasPinConfigured] = useState(true);

  const userId = user?.id || currentCompanyUser?.userId || currentCompanyUser?.email || "";

  useEffect(() => {
    if (isOpen) {
      setPin("");
      setError(null);
      setIsVerifying(false);
      if (userId) {
        hasUserPin(userId).then((configured) => {
          setHasPinConfigured(configured);
        });
      }
    }
  }, [isOpen, userId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin.trim()) {
      setError("Please enter your PIN.");
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const isValid = await verifyUserPin(userId, pin.trim());
      if (!isValid) {
        setError("Invalid PIN entered. Please try again or check Settings.");
        setIsVerifying(false);
        return;
      }

      await onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-md rounded-2xl border border-border-color bg-surface p-6 shadow-2xl space-y-5">
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
              actionVariant === "danger"
                ? "bg-red-500/10 text-red-600 dark:text-red-400"
                : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
            }`}
          >
            {actionVariant === "danger" ? <ShieldAlert size={26} /> : <KeyRound size={26} />}
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">{title}</h3>
            <p className="text-xs text-muted mt-1 leading-relaxed">{description}</p>
          </div>
        </div>

        {!hasPinConfigured && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">No Security PIN Set</p>
              <p className="text-[11px] mt-0.5">
                You have not configured a custom PIN in Settings yet. You may use default PIN{" "}
                <code className="bg-amber-500/20 px-1 py-0.5 rounded font-mono font-bold">1234</code> or visit Settings to set your permanent PIN.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Enter 4-Digit Security PIN
            </label>
            <input
              type="password"
              maxLength={8}
              autoFocus
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                if (error) setError(null);
              }}
              placeholder="••••"
              className="w-full text-center tracking-widest text-2xl font-mono py-2.5 rounded-xl border border-border-color bg-surface-elevated text-foreground focus:border-blue-600 focus:outline-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs font-medium text-red-600 dark:text-red-400 bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">
              <AlertCircle size={14} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isVerifying}
              className="rounded-xl border border-border-color px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-elevated hover:text-foreground transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isVerifying || !pin.trim()}
              className={`flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-bold text-white shadow-md transition disabled:opacity-50 ${
                actionVariant === "danger"
                  ? "bg-red-600 hover:bg-red-700 shadow-red-600/20"
                  : "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20"
              }`}
            >
              {isVerifying && <Loader2 size={14} className="animate-spin" />}
              <span>{actionLabel}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

