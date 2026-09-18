import { useState, useRef } from "react";
import { X, Calendar, Send, CheckCircle2, AlertCircle, Paperclip, Upload, FileText, Trash2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { requestLeave } from "@/lib/data";
import { uploadFileToBucket } from "@/lib/storage";
import type { LeaveRecord } from "@/lib/types";

interface LeaveRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function LeaveRequestModal({ isOpen, onClose, onSuccess }: LeaveRequestModalProps) {
  const { currentCompany, currentCompanyUser } = useAuth();
  const [leaveType, setLeaveType] = useState<LeaveRecord["leaveType"]>("annual");
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [reason, setReason] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!startDate || !endDate) {
      setError("Please select both start and end dates.");
      return;
    }

    const d1 = new Date(startDate);
    const d2 = new Date(endDate);
    if (d2 < d1) {
      setError("End date cannot be before start date.");
      return;
    }

    const days = Math.max(Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1, 1);

    setSubmitting(true);
    try {
      let attachmentUrl = "";
      if (attachmentFile) {
        setUploadingAttachment(true);
        try {
          attachmentUrl = await uploadFileToBucket("payment-proofs", "leave-proofs", attachmentFile);
        } catch (uErr) {
          console.warn("Attachment upload fallback:", uErr);
        } finally {
          setUploadingAttachment(false);
        }
      }

      const combinedReason = [
        reason.trim() || undefined,
        attachmentUrl ? `Supporting Document: ${attachmentUrl}` : undefined,
      ].filter(Boolean).join(" | ");

      await requestLeave({
        companyId: currentCompany?.id,
        userId: currentCompanyUser?.userId || currentCompanyUser?.id || "unknown",
        employeeName: currentCompanyUser?.fullName || "Staff Member",
        department: currentCompanyUser?.department || "front_desk",
        leaveType,
        startDate,
        endDate,
        daysCount: days,
        reason: combinedReason || undefined,
      });

      setSuccess(true);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err?.message || "Failed to submit leave request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl border border-border-color bg-surface p-6 shadow-2xl space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-border-color pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pink-500/10 text-pink-600 dark:text-pink-400">
              <Calendar size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Request Leave</h3>
              <p className="text-[10px] text-muted">
                {currentCompanyUser?.fullName} ({currentCompanyUser?.jobTitle || "Staff"})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface-elevated hover:text-foreground transition"
          >
            <X size={15} />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-600 dark:text-red-400">
            <AlertCircle size={15} className="shrink-0" />
            <span className="text-[11px] font-medium">{error}</span>
          </div>
        )}

        {success ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
            <CheckCircle2 size={36} className="text-emerald-500" />
            <p className="text-sm font-bold text-foreground">Application Submitted!</p>
            <p className="text-muted text-[11px]">Your leave request has been sent for managerial review.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="mb-1 block font-semibold text-foreground text-[11px]">Leave Category *</label>
              <select
                value={leaveType}
                onChange={(e) => setLeaveType(e.target.value as LeaveRecord["leaveType"])}
                className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-pink-500 focus:outline-none"
              >
                <option value="annual">Annual Leave</option>
                <option value="sick">Sick Leave</option>
                <option value="study">Study Leave</option>
                <option value="maternity">Maternity Leave</option>
                <option value="paternity">Paternity Leave</option>
                <option value="bereavement">Bereavement Leave</option>
                <option value="unpaid">Unpaid Leave</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-semibold text-foreground text-[11px]">Start Date *</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-pink-500 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-foreground text-[11px]">End Date *</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-pink-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block font-semibold text-foreground text-[11px]">Reason / Details (Optional)</label>
              <textarea
                rows={2}
                placeholder="State your reason, handover coverage, or emergency contact..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-pink-500 focus:outline-none resize-none"
              />
            </div>

            <div>
              <label className="mb-1 block font-semibold text-foreground text-[11px]">Supporting Document / Proof (Optional)</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setAttachmentFile(f);
                }}
              />
              {attachmentFile ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-pink-500/30 bg-pink-500/10 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText size={14} className="text-pink-600 dark:text-pink-400 shrink-0" />
                    <span className="text-[11px] font-semibold text-foreground truncate">{attachmentFile.name}</span>
                    <span className="text-[10px] text-muted shrink-0">({(attachmentFile.size / 1024).toFixed(0)} KB)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAttachmentFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="text-muted hover:text-red-500 transition"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-color bg-surface-elevated/40 px-3 py-2.5 text-muted hover:border-pink-500 hover:text-foreground transition"
                >
                  <Paperclip size={14} className="text-pink-500" />
                  <span className="text-[11px] font-medium">Attach Medical Certificate or Proof (PDF / Image)</span>
                </button>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border-color">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-border-color px-4 py-2 text-muted hover:bg-surface-elevated hover:text-foreground font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-1.5 rounded-xl bg-pink-600 px-5 py-2 font-bold text-white hover:bg-pink-700 shadow disabled:opacity-50 transition"
              >
                <Send size={13} />
                <span>{submitting ? "Submitting..." : "Submit Leave Application"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

