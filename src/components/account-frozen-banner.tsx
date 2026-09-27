/**
 * AccountFrozenBanner - Shown to staff members whose company has been deleted.
 *
 * Replaces the entire dashboard for affected staff.
 * Shows a countdown of the remaining 30-day hold period.
 * After 30 days, they can create or join a new company.
 */
import { useEffect, useState } from "react";
import { Building2, Clock, ArrowRight, UserPlus } from "lucide-react";
import { COMPANY_DELETE_FREEZE_DAYS } from "@/lib/packages";

interface AccountFrozenBannerProps {
  companyName: string;
  frozenAt: string | Date; // When account was frozen
  onNavigateToSignup?: () => void;
}

export function AccountFrozenBanner({
  companyName,
  frozenAt,
  onNavigateToSignup,
}: AccountFrozenBannerProps) {
  const frozenAtMs = new Date(frozenAt).getTime();
  const unfreezeMs = frozenAtMs + COMPANY_DELETE_FREEZE_DAYS * 24 * 60 * 60 * 1000;

  const [msRemaining, setMsRemaining] = useState(Math.max(0, unfreezeMs - Date.now()));

  useEffect(() => {
    const interval = setInterval(() => {
      setMsRemaining(Math.max(0, unfreezeMs - Date.now()));
    }, 1000);
    return () => clearInterval(interval);
  }, [unfreezeMs]);

  const daysLeft = Math.floor(msRemaining / (24 * 60 * 60 * 1000));
  const hoursLeft = Math.floor((msRemaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  const minsLeft = Math.floor((msRemaining % (60 * 60 * 1000)) / (60 * 1000));

  const unfreezeDate = new Date(unfreezeMs).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const signupUrl = "https://app.paimbabook.com/signup";

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-3xl border border-border-color bg-surface shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-red-600/20 to-amber-600/20 border-b border-border-color p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-600 text-white">
            <Building2 size={30} />
          </div>
          <h1 className="text-xl font-black text-foreground">Your Company Was Deleted</h1>
          <p className="text-sm text-muted mt-2">
            <strong className="text-foreground">{companyName}</strong> has been permanently deleted
            by its administrator.
          </p>
        </div>

        {/* Countdown */}
        <div className="p-6 space-y-5">
          {msRemaining > 0 ? (
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-center space-y-2">
              <p className="text-xs font-bold text-blue-300 uppercase tracking-wider">
                Account Hold Period Remaining
              </p>
              <div className="flex items-center justify-center gap-3">
                {[
                  { val: daysLeft, label: "Days" },
                  { val: hoursLeft, label: "Hours" },
                  { val: minsLeft, label: "Mins" },
                ].map((unit) => (
                  <div key={unit.label} className="text-center">
                    <div className="text-3xl font-black text-foreground font-mono">
                      {String(unit.val).padStart(2, "0")}
                    </div>
                    <div className="text-[10px] text-muted uppercase tracking-wider">{unit.label}</div>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-muted">
                Your account hold expires on <strong className="text-foreground">{unfreezeDate}</strong>
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
              <p className="text-sm font-bold text-emerald-300">Hold Period Ended</p>
              <p className="text-xs text-muted mt-1">
                You are now free to create a new company or join an existing one.
              </p>
            </div>
          )}

          {/* Explanation */}
          <div className="space-y-3 text-xs text-muted">
            <p className="font-bold text-foreground text-[11px] uppercase tracking-wider">What This Means</p>
            <div className="flex items-start gap-2.5">
              <Clock size={12} className="shrink-0 mt-0.5 text-amber-400" />
              <span>
                Your personal account is on hold for <strong className="text-foreground">{COMPANY_DELETE_FREEZE_DAYS} days</strong>.
                During this time you can log in but cannot access any features.
              </span>
            </div>
            <div className="flex items-start gap-2.5">
              <UserPlus size={12} className="shrink-0 mt-0.5 text-blue-400" />
              <span>
                After the hold period, you can create your own company or be added to a new company by an administrator.
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-1">
            <p className="text-xs font-bold text-foreground">Your Options After Hold Period:</p>

            <a
              href={signupUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between w-full rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-xs font-bold text-blue-300 hover:bg-blue-500/20 transition"
            >
              <span>Create Your Own Company</span>
              <ArrowRight size={14} />
            </a>

            <div className="rounded-xl border border-border-color bg-surface-elevated px-4 py-3 text-xs text-muted">
              <p className="font-bold text-foreground mb-1">Get Added to Another Company</p>
              <p>
                Ask a company administrator to add you as a staff member. They will need your email:{" "}
                <span className="font-mono text-foreground bg-surface px-1.5 py-0.5 rounded">
                  your email address
                </span>
              </p>
            </div>
          </div>

          {/* Signup link */}
          <div className="rounded-xl border border-border-color bg-surface p-3 text-center text-xs text-muted">
            <p>Sign up at: <a href={signupUrl} className="text-blue-400 underline font-mono">{signupUrl}</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}
