import { useState } from "react";
import { X, Send, ShieldAlert, Mail, User, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { sendEmailViaApi } from "@/lib/notifications";

interface ReportEmailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  reportTitle: string;
  reportHtml: string;
  defaultRecipientName?: string;
  defaultRecipientEmail?: string;
  onSuccess?: () => void;
}

export function ReportEmailDialog({
  isOpen,
  onClose,
  reportTitle,
  reportHtml,
  defaultRecipientName = "",
  defaultRecipientEmail = "",
  onSuccess,
}: ReportEmailDialogProps) {
  const [recipientName, setRecipientName] = useState(defaultRecipientName);
  const [recipientEmail, setRecipientEmail] = useState(defaultRecipientEmail);
  const [confirmAuth, setConfirmAuth] = useState(false);
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  if (!isOpen) return null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    const name = recipientName.trim();
    const email = recipientEmail.trim().toLowerCase();

    if (!name) {
      setErrorMsg("Recipient Full Name is required to confirm identity.");
      return;
    }
    if (!email || !email.includes("@")) {
      setErrorMsg("Please enter a valid recipient email address.");
      return;
    }
    if (!confirmAuth) {
      setErrorMsg("You must check the authorization confirmation box before sending company data.");
      return;
    }

    setSending(true);
    try {
      await sendEmailViaApi({
        to: email,
        subject: `Confidential Report: ${reportTitle}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 650px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
            <div style="background-color: #0f172a; color: #ffffff; padding: 16px 20px; border-radius: 6px; margin-bottom: 20px;">
              <h2 style="margin: 0; font-size: 18px;">${reportTitle}</h2>
              <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;">Confidential Company Document — Dispatched to ${name} (${email})</p>
            </div>
            <p style="font-size: 14px; color: #334155;">Hello <strong>${name}</strong>,</p>
            <p style="font-size: 14px; color: #334155;">Please find the attached verified executive summary and report below:</p>
            <div style="margin: 20px 0; padding: 15px; background-color: #f8fafc; border-radius: 6px; border: 1px solid #cbd5e1;">
              ${reportHtml}
            </div>
            <p style="font-size: 11px; color: #64748b; margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 12px;">
              CONFIDENTIALITY NOTICE: This report contains proprietary company operational records. If you received this in error, please immediately notify the sender and delete this email.
            </p>
          </div>
        `,
      });

      setSuccessMsg(`Report successfully emailed to ${name} (${email})`);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
        setSuccessMsg("");
      }, 1800);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to dispatch email. Please check internet connection.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border-color bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-color px-6 py-4 bg-amber-500/5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-500/10 p-2.5 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <ShieldAlert size={22} />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight text-foreground">
                Confirm Report Recipient
              </h3>
              <p className="text-xs text-muted">Double confirmation required to prevent accidental data leaks</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="rounded-xl p-1.5 text-muted hover:bg-surface-elevated hover:text-foreground transition disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSend} className="p-6 space-y-4 text-xs">
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-red-600 font-bold">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-emerald-600 font-bold">
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="rounded-xl bg-blue-500/5 border border-blue-500/20 p-3">
            <p className="font-bold text-foreground truncate">{reportTitle}</p>
            <p className="text-[11px] text-muted mt-0.5">
              Review and confirm the exact name and email address of the authorized recipient.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-foreground block">Recipient Full Name *</label>
            <div className="relative">
              <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                required
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                placeholder="e.g. Johnathan Smith (Finance Director)"
                className="w-full rounded-xl border border-border-color bg-surface-elevated pl-9 pr-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="font-bold text-foreground block">Recipient Email Address *</label>
            <div className="relative">
              <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="email"
                required
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="e.g. director@company.com"
                className="w-full rounded-xl border border-border-color bg-surface-elevated pl-9 pr-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <label className="flex items-start gap-2.5 pt-2 cursor-pointer select-none">
            <input
              type="checkbox"
              required
              checked={confirmAuth}
              onChange={(e) => setConfirmAuth(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-border-color text-blue-600 focus:ring-blue-500"
            />
            <span className="text-[11px] text-foreground font-semibold leading-snug">
              I certify that this recipient is authorized to receive this confidential company report, and that their email address has been verified.
            </span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-color">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="rounded-xl border border-border-color bg-surface px-4 py-2 font-bold text-muted hover:text-foreground transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending || !confirmAuth}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 font-bold text-white shadow-md hover:bg-blue-700 transition disabled:opacity-50"
            >
              {sending ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send size={14} />
                  <span>Confirm & Send Report</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
