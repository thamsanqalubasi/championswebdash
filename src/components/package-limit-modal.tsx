import { useState } from "react";
import { Modal } from "./modal";
import { PackageSwitcherModal } from "./package-switcher-modal";
import { AlertCircle, ArrowUpRight, Sparkles, Building2, Users, BedDouble, Layers } from "lucide-react";

interface PackageLimitModalProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  metric: "properties" | "rooms" | "tenants" | "staff" | "feature";
  currentCount?: number;
  maxLimit?: number;
  planName: string;
  featureName?: string;
}

export function PackageLimitModal({
  open,
  onClose,
  companyId,
  metric,
  currentCount,
  maxLimit,
  planName,
  featureName,
}: PackageLimitModalProps) {
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const getMetricIcon = () => {
    switch (metric) {
      case "properties":
        return <Building2 size={28} className="text-blue-500" />;
      case "rooms":
        return <BedDouble size={28} className="text-emerald-500" />;
      case "tenants":
        return <Users size={28} className="text-violet-500" />;
      case "staff":
        return <Layers size={28} className="text-amber-500" />;
      default:
        return <Sparkles size={28} className="text-blue-500" />;
    }
  };

  const getMetricTitle = () => {
    switch (metric) {
      case "properties":
        return "Property Limit Reached";
      case "rooms":
        return "Accommodation Room Limit Reached";
      case "tenants":
        return "Tenant Quota Reached";
      case "staff":
        return "Staff Member Limit Reached";
      case "feature":
        return `${featureName || "Feature"} Not Included`;
    }
  };

  const getMetricDescription = () => {
    if (metric === "feature") {
      return `Your current subscription plan (${planName}) does not include ${
        featureName || "this module"
      }. Upgrade your tier to unlock access.`;
    }
    return `You have reached the maximum allowed ${metric} (${currentCount}/${maxLimit}) on the ${planName} plan. Upgrade to the next tier or test a higher package to add more.`;
  };

  return (
    <>
      <Modal open={open} onClose={onClose} title="Package Limit">
        <div className="py-3 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-elevated border border-border-color shadow-sm">
            {getMetricIcon()}
          </div>

          <div>
            <h3 className="text-base font-bold text-foreground">{getMetricTitle()}</h3>
            <p className="text-xs text-muted mt-1 leading-relaxed max-w-sm mx-auto">
              {getMetricDescription()}
            </p>
          </div>

          <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-left">
            <div className="flex items-center gap-2 text-blue-300 font-bold mb-1">
              <Sparkles size={14} />
              <span>Recommended Next Step</span>
            </div>
            <p className="text-muted leading-relaxed">
              Switch to a higher tier like <span className="font-semibold text-foreground">Standard ($20)</span> or <span className="font-semibold text-foreground">Professional ($50)</span>, or test the unrestricted Stripe Sandbox package.
            </p>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 rounded-xl border border-border-color bg-surface px-3 py-2 text-xs font-semibold text-muted hover:text-foreground"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                setSwitcherOpen(true);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
            >
              <span>Switch / Upgrade Package</span>
              <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
      </Modal>

      {switcherOpen && (
        <PackageSwitcherModal
          open={switcherOpen}
          onClose={() => setSwitcherOpen(false)}
          companyId={companyId}
        />
      )}
    </>
  );
}
