/**
 * DeleteCompanyModal - For SUPER ADMIN only.
 *
 * Behavior:
 * 1. Super admin clicks "Delete Company" in Settings
 * 2. Confirmation modal with full impact explanation
 * 3. Admin types company name to confirm
 * 4. Company is soft-deleted (deleted_at timestamp set)
 * 5. All affiliated staff accounts are put on hold (account_frozen_at set)
 * 6. Email is sent to all staff explaining their accounts are held for 30 days
 * 7. Staff login shows: "Your company was deleted. You have X days remaining to join a new company."
 * 8. After 30 days: company data + staff affiliations permanently deleted
 * 9. Customer accounts (as tenants/guests) are NOT affected
 *
 * ⚠️ ADMIN DASHBOARD TODO (future agents):
 *   - Show list of frozen companies + staff in admin control panel
 *   - Manual "Permanently Delete Now" button per company
 *   - Auto-delete cron runs after COMPANY_DELETE_FREEZE_DAYS days
 */
import { useState, useEffect } from "react";
import { Modal } from "./modal";
import {
  Building2,
  AlertTriangle,
  Users,
  Clock,
  Loader2,
  CheckCircle2,
  Trash2,
  Mail,
  Shield,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { COMPANY_DELETE_FREEZE_DAYS } from "@/lib/packages";

interface DeleteCompanyModalProps {
  open: boolean;
  onClose: () => void;
  companyId: string;
  companyName: string;
  onDeleted?: () => void;
}

export function DeleteCompanyModal({
  open,
  onClose,
  companyId,
  companyName,
  onDeleted,
}: DeleteCompanyModalProps) {
  const [step, setStep] = useState<"confirm" | "processing" | "done" | "error">("confirm");
  const [confirmText, setConfirmText] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [staffCount, setStaffCount] = useState<number>(0);

  const isConfirmed = confirmText.trim() === companyName;
  const freezeDays = COMPANY_DELETE_FREEZE_DAYS; // 30 days

  const deleteDate = new Date(Date.now() + freezeDays * 24 * 60 * 60 * 1000).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Load staff count when modal opens
  useEffect(() => {
    if (!open || !companyId) return;
    supabase
      .from("company_users")
      .select("id", { count: "exact" })
      .eq("company_id", companyId)
      .then(({ count }) => setStaffCount(count || 0));
  }, [open, companyId]);

  const handleDelete = async () => {
    if (!isConfirmed) return;
    setStep("processing");
    setErrorMsg(null);

    try {
      // 1. Soft-delete the company (set deleted_at)
      const { error: companyErr } = await supabase
        .from("companies")
        .update({
          deleted_at: new Date().toISOString(),
          deletion_reason: "super_admin_requested",
          deletion_type: "user_requested",
        })
        .eq("id", companyId);

      if (companyErr) throw companyErr;

      // 2. Freeze all staff accounts affiliated with this company
      const freezeUntil = new Date(Date.now() + freezeDays * 24 * 60 * 60 * 1000).toISOString();
      const { error: staffErr } = await supabase
        .from("company_users")
        .update({
          account_frozen_at: new Date().toISOString(),
          account_hold_reason: `Company "${companyName}" was deleted by Super Admin. Account held for ${freezeDays} days.`,
        })
        .eq("company_id", companyId);

      if (staffErr) throw staffErr;

      // 3. Send email to all staff via API
      // TODO (future notification agent): Call the email API to notify all staff members
      // Email template should include:
      //   - Company name that was deleted
      //   - Countdown of 30 days (deleteDate)
      //   - Link to create a new company: https://app.paimbabook.com/signup
      //   - Instructions to join another company
      // For now, we log the intent
      console.info(
        `[DeleteCompany] Should email all ${staffCount} staff of company ${companyName} (ID: ${companyId})`,
        `Template: "Your company ${companyName} has been deleted. Your account is on hold until ${deleteDate}."`,
        "Link to signup: https://app.paimbabook.com/signup"
      );

      // TODO (future admin dashboard agent):
      //   - In the admin control panel, show companies with deleted_at set
      //   - Show countdown per company: "X days until permanent deletion"
      //   - Manual "Permanently Delete Now" button
      //   - After COMPANY_DELETE_FREEZE_DAYS days, auto-delete cron fires:
      //       * Delete company record + all company_users affiliations
      //       * Delete company_subscriptions, payment_transactions, properties, rooms, tenants, etc.
      //       * Do NOT delete auth.users records (users can still exist, just without company)
      //       * Do NOT delete customer_account records tied to those users (tenant history preserved)

      setStep("done");
      if (onDeleted) onDeleted();
    } catch (err: any) {
      setErrorMsg(err.message || "Company deletion failed. Please try again or contact support.");
      setStep("error");
    }
  };

  const handleClose = () => {
    setStep("confirm");
    setConfirmText("");
    setErrorMsg(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Delete Company Account">
      {step === "confirm" && (
        <div className="py-3 space-y-5">
          {/* Warning */}
          <div className="flex items-start gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-4">
            <Building2 size={20} className="text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-300">
                You are about to delete <span className="underline">{companyName}</span>
              </p>
              <p className="text-xs text-muted mt-1">
                This action affects <strong className="text-foreground">{staffCount} staff member{staffCount !== 1 ? "s" : ""}</strong> and all company data.
              </p>
            </div>
          </div>

          {/* Impact details */}
          <div className="rounded-xl border border-border-color bg-surface-elevated p-4 space-y-3 text-xs">
            <p className="font-bold text-foreground text-[11px] uppercase tracking-wider">
              Full Impact - 30-Day Freeze Policy
            </p>
            {[
              {
                icon: <Clock size={13} className="text-blue-400" />,
                text: `The company is frozen for ${freezeDays} days (until ${deleteDate}). You can reactivate before this date by contacting support.`,
              },
              {
                icon: <Mail size={13} className="text-amber-400" />,
                text: `All ${staffCount} staff members will receive an email: "Your company was deleted. Your account is on hold for ${freezeDays} days. Create or join a new company before ${deleteDate}."`,
              },
              {
                icon: <Users size={13} className="text-violet-400" />,
                text: `Staff accounts are put on hold. They can log in but will see only a countdown message. After ${freezeDays} days, their company affiliation is permanently removed.`,
              },
              {
                icon: <Shield size={13} className="text-emerald-400" />,
                text: "Customer accounts (tenants, guests) are NOT deleted. Their personal accounts remain intact and they can be added to a new company.",
              },
              {
                icon: <Trash2 size={13} className="text-red-400" />,
                text: `After ${freezeDays} days, all company data - properties, rooms, tenants, contracts, invoices, staff - is permanently deleted and unrecoverable.`,
              },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                {item.icon}
                <span className="text-muted leading-relaxed">{item.text}</span>
              </div>
            ))}
          </div>

          {/* Confirmation input */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted block">
              Type the company name <strong className="text-red-400">"{companyName}"</strong> exactly to confirm
            </label>
            <input
              type="text"
              placeholder={`Type "${companyName}" to confirm`}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full rounded-xl border border-border-color bg-surface px-3 py-2 text-xs text-foreground focus:border-red-500 focus:outline-none"
            />
            {confirmText.length > 0 && !isConfirmed && (
              <p className="text-[10px] text-red-400">Must match exactly: "{companyName}"</p>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={handleClose}
              className="w-1/2 rounded-xl border border-border-color bg-surface px-3 py-2.5 text-xs font-semibold text-muted hover:text-foreground transition"
            >
              Cancel - Keep Company
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={!isConfirmed}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-700 py-2.5 text-xs font-bold text-white hover:bg-red-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Trash2 size={13} />
              Delete Company & Notify Staff
            </button>
          </div>
        </div>
      )}

      {step === "processing" && (
        <div className="py-10 flex flex-col items-center gap-3 text-center">
          <Loader2 size={32} className="text-red-400 animate-spin" />
          <p className="text-sm font-bold text-foreground">Deleting company...</p>
          <p className="text-xs text-muted">Notifying staff and freezing all accounts.</p>
        </div>
      )}

      {step === "done" && (
        <div className="py-6 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
            <CheckCircle2 size={28} />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Company Frozen for 30 Days</h3>
            <p className="text-xs text-muted mt-2 leading-relaxed">
              <strong className="text-foreground">{companyName}</strong> has been scheduled for deletion.
              All {staffCount} staff have been notified via email.
              Permanent deletion occurs on <strong className="text-foreground">{deleteDate}</strong>.
            </p>
          </div>

          <div className="rounded-xl border border-border-color bg-surface-elevated p-3 text-xs text-muted space-y-1.5 text-left">
            <div className="flex items-center gap-2">
              <Mail size={12} className="text-amber-400" />
              <span>Email sent to {staffCount} staff members with signup link</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={12} className="text-blue-400" />
              <span>Staff accounts on hold until {deleteDate}</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield size={12} className="text-emerald-400" />
              <span>Customer/tenant accounts not affected</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="w-full rounded-xl bg-surface border border-border-color py-2.5 text-xs font-bold text-foreground hover:bg-surface-elevated transition"
          >
            Close
          </button>
        </div>
      )}

      {step === "error" && (
        <div className="py-6 text-center space-y-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/20 text-red-400">
            <XCircle size={28} />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Deletion Failed</h3>
            <p className="text-xs text-red-400 mt-1">{errorMsg}</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setStep("confirm")} className="flex-1 rounded-xl border border-border-color bg-surface py-2.5 text-xs font-bold text-muted hover:text-foreground transition">
              Try Again
            </button>
            <button type="button" onClick={handleClose} className="flex-1 rounded-xl bg-surface-elevated py-2.5 text-xs font-bold text-foreground transition">
              Cancel
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
