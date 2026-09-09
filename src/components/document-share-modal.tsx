import { useState, useEffect } from "react";
import {
  X,
  Mail,
  User,
  Users,
  Download,
  FileText,
  Send,
  CheckCircle2,
  AlertCircle,
  Eye,
  Printer,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { fetchCompanyUsers } from "@/lib/data";
import type { CompanyUser } from "@/lib/types";
import {
  createPdfAttachmentFromHtml,
  createPdfAttachmentFromUrl,
  downloadPdfDocument,
  downloadPdfFromUrl,
  openDocumentPreview,
  fetchCompanyInfo,
} from "@/lib/storage";
import {
  sendEmailViaApi,
  wrapDocumentInEmailHtml,
} from "@/lib/notifications";

export interface DocumentShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
  documentType?: "invoice" | "contract" | "receipt" | "payslip" | "document" | string;
  documentHtml?: string;
  documentUrl?: string;
  fileNameBase?: string;
  ownerName?: string;
  ownerEmail?: string;
  defaultSubject?: string;
  defaultMessage?: string;
  onSuccess?: () => void;
}

export function DocumentShareModal({
  isOpen,
  onClose,
  documentTitle,
  documentType = "document",
  documentHtml = "",
  documentUrl = "",
  fileNameBase = "document",
  ownerName = "Owner / Client",
  ownerEmail = "",
  defaultSubject = "",
  defaultMessage = "",
  onSuccess,
}: DocumentShareModalProps) {
  const { currentCompany } = useAuth();
  const [recipientMode, setRecipientMode] = useState<"owner" | "staff" | "custom">("owner");

  // Recipient info
  const [ownerEmailInput, setOwnerEmailInput] = useState(ownerEmail);
  const [ownerNameInput, setOwnerNameInput] = useState(ownerName);
  const [staffList, setStaffList] = useState<CompanyUser[]>([]);
  const [selectedStaffId, setSelectedStaffId] = useState<string>("");
  const [customEmail, setCustomEmail] = useState("");
  const [customName, setCustomName] = useState("");

  // Email content
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  // Status
  const [sending, setSending] = useState(false);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setOwnerEmailInput(ownerEmail);
      setOwnerNameInput(ownerName);
      setSendSuccess(null);
      setSendError(null);

      // Default subject and message
      const subj =
        defaultSubject ||
        `${documentTitle} - ${currentCompany?.name || "Champions Court"}`;
      setSubject(subj);

      const msg =
        defaultMessage ||
        `Please find the official ${documentType.toLowerCase()} attached for your reference.`;
      setMessage(msg);

      // Fetch staff list for staff recipient option
      if (currentCompany?.id) {
        fetchCompanyUsers(currentCompany.id).then((users) => {
          setStaffList(users);
          if (users.length > 0 && !selectedStaffId) {
            setSelectedStaffId(users[0].id);
          }
        });
      }
    }
  }, [isOpen, ownerEmail, ownerName, documentTitle, documentType, defaultSubject, defaultMessage, currentCompany?.id, currentCompany?.name]);

  if (!isOpen) return null;

  const selectedStaff = staffList.find((s) => s.id === selectedStaffId);

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendError(null);
    setSendSuccess(null);

    let targetEmail = "";
    let targetName = "";

    if (recipientMode === "owner") {
      targetEmail = ownerEmailInput.trim();
      targetName = ownerNameInput.trim() || "Valued Client";
      if (!targetEmail) {
        setSendError("Please provide an email address for the owner/client.");
        return;
      }
    } else if (recipientMode === "staff") {
      if (!selectedStaff?.email) {
        setSendError("Please select a staff member with a valid email.");
        return;
      }
      targetEmail = selectedStaff.email;
      targetName = selectedStaff.fullName;
    } else if (recipientMode === "custom") {
      targetEmail = customEmail.trim();
      targetName = customName.trim() || "Recipient";
      if (!targetEmail || !targetEmail.includes("@")) {
        setSendError("Please enter a valid recipient email address.");
        return;
      }
    }

    setSending(true);

    try {
      // Build attachment
      let attachment: any = null;
      const cleanFileName = `${fileNameBase.replace(/\.pdf$/i, "")}.pdf`;

      if (documentUrl && documentUrl.startsWith("http") && documentUrl.toLowerCase().includes(".pdf")) {
        attachment = await createPdfAttachmentFromUrl(documentUrl, cleanFileName);
      } else if (documentHtml) {
        attachment = await createPdfAttachmentFromHtml(documentHtml, cleanFileName);
      }

      // Build email body HTML
      const companyInfo = await fetchCompanyInfo();
      const wrappedHtml = wrapDocumentInEmailHtml({
        recipientName: targetName,
        subject,
        bodyText: message,
        documentHtml: documentHtml || `<p>Please see the attached PDF document: ${documentTitle}</p>`,
        companyName: companyInfo.companyName,
      });

      const res = await sendEmailViaApi({
        to: targetEmail,
        subject,
        html: wrappedHtml,
        attachments: attachment ? [attachment] : undefined,
      });

      if (!res.success) {
        throw new Error(res.error || "Email delivery failed.");
      }

      setSendSuccess(`Document successfully emailed to ${targetName} (${targetEmail})!`);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        onClose();
      }, 1600);
    } catch (err: any) {
      setSendError(err?.message || "Could not send email. Please check internet connection.");
    } finally {
      setSending(false);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloading(true);
    try {
      const cleanBase = fileNameBase.replace(/\.pdf$/i, "");
      if (documentUrl && documentUrl.startsWith("http") && documentUrl.toLowerCase().includes(".pdf")) {
        await downloadPdfFromUrl(documentUrl, cleanBase);
      } else if (documentHtml) {
        downloadPdfDocument(documentHtml, cleanBase);
      } else {
        alert("Document content is not available for PDF generation.");
      }
    } catch (err: any) {
      alert(`Could not download PDF: ${err?.message || "Error occurred"}`);
    } finally {
      setDownloading(false);
    }
  };

  const handlePreview = () => {
    if (documentUrl && documentUrl.startsWith("http")) {
      window.open(documentUrl, "_blank");
    } else if (documentHtml) {
      openDocumentPreview(documentHtml);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-border-color bg-surface p-6 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-color pb-3">
          <div>
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-blue-600" />
              <h3 className="text-base font-bold text-foreground">Share & Export Document</h3>
            </div>
            <p className="text-xs text-muted mt-0.5">
              {documentTitle} • <span className="capitalize">{documentType}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-elevated hover:text-foreground transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Status Alerts */}
        {sendError && (
          <div className="flex items-center gap-2 rounded-xl bg-red-500/10 p-3 text-xs text-red-600 border border-red-500/20">
            <AlertCircle size={15} className="shrink-0" />
            <span>{sendError}</span>
          </div>
        )}
        {sendSuccess && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-600 border border-emerald-500/20">
            <CheckCircle2 size={15} className="shrink-0" />
            <span>{sendSuccess}</span>
          </div>
        )}

        {/* Recipient Mode Tabs */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-muted block">
            Select Destination or Action
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setRecipientMode("owner")}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-2.5 text-xs font-bold transition ${
                recipientMode === "owner"
                  ? "border-blue-600 bg-blue-500/10 text-blue-600"
                  : "border-border-color bg-surface-elevated/40 text-muted hover:text-foreground"
              }`}
            >
              <User size={16} />
              <span>Owner / Client</span>
            </button>

            <button
              type="button"
              onClick={() => setRecipientMode("staff")}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-2.5 text-xs font-bold transition ${
                recipientMode === "staff"
                  ? "border-blue-600 bg-blue-500/10 text-blue-600"
                  : "border-border-color bg-surface-elevated/40 text-muted hover:text-foreground"
              }`}
            >
              <Users size={16} />
              <span>Staff Member</span>
            </button>

            <button
              type="button"
              onClick={() => setRecipientMode("custom")}
              className={`flex flex-col items-center justify-center gap-1 rounded-xl border p-2.5 text-xs font-bold transition ${
                recipientMode === "custom"
                  ? "border-blue-600 bg-blue-500/10 text-blue-600"
                  : "border-border-color bg-surface-elevated/40 text-muted hover:text-foreground"
              }`}
            >
              <Mail size={16} />
              <span>New / Custom Email</span>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSendEmail} className="space-y-4 text-xs">
          {/* OPTION 1: OWNER / CLIENT */}
          {recipientMode === "owner" && (
            <div className="rounded-2xl border border-border-color bg-surface-elevated/30 p-3.5 space-y-3">
              <span className="font-semibold text-foreground block">Owner / Client Information</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-muted font-medium">Recipient Name</label>
                  <input
                    type="text"
                    value={ownerNameInput}
                    onChange={(e) => setOwnerNameInput(e.target.value)}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                    placeholder="e.g. John Doe"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-muted font-medium">Recipient Email *</label>
                  <input
                    type="email"
                    required
                    value={ownerEmailInput}
                    onChange={(e) => setOwnerEmailInput(e.target.value)}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                    placeholder="client@example.com"
                  />
                </div>
              </div>
            </div>
          )}

          {/* OPTION 2: STAFF MEMBER */}
          {recipientMode === "staff" && (
            <div className="rounded-2xl border border-border-color bg-surface-elevated/30 p-3.5 space-y-3">
              <span className="font-semibold text-foreground block">Select Internal Staff Member</span>
              <div>
                <label className="mb-1 block text-muted font-medium">Company Staff Recipient *</label>
                <select
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none font-medium"
                >
                  {staffList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.fullName} ({st.jobTitle} • {st.department.replace(/_/g, " ")}) - {st.email}
                    </option>
                  ))}
                </select>
              </div>
              {selectedStaff && (
                <p className="text-[11px] text-muted">
                  Sending to: <strong className="text-foreground">{selectedStaff.fullName}</strong> ({selectedStaff.email})
                </p>
              )}
            </div>
          )}

          {/* OPTION 3: NEW / CUSTOM EMAIL */}
          {recipientMode === "custom" && (
            <div className="rounded-2xl border border-border-color bg-surface-elevated/30 p-3.5 space-y-3">
              <span className="font-semibold text-foreground block">Custom Email Recipient</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-muted font-medium">Recipient Name (Optional)</label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                    placeholder="e.g. Accounting Dept"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-muted font-medium">Recipient Email *</label>
                  <input
                    type="email"
                    required
                    value={customEmail}
                    onChange={(e) => setCustomEmail(e.target.value)}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                    placeholder="new.email@example.com"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Email Subject & Message */}
          <div className="space-y-3">
            <div>
              <label className="mb-1 block font-semibold text-foreground">Email Subject Line</label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block font-semibold text-foreground">Personal Message / Note</label>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full rounded-xl border border-border-color bg-surface-elevated p-3 text-foreground focus:border-blue-600 focus:outline-none"
                placeholder="Add a polite note to accompany the attached PDF..."
              />
            </div>
          </div>

          {/* Attachment Preview Card */}
          <div className="flex items-center justify-between rounded-xl border border-border-color bg-surface-elevated/50 p-3">
            <div className="flex items-center gap-2.5">
              <div className="rounded-lg bg-red-500/10 p-2 text-red-600">
                <FileText size={18} />
              </div>
              <div>
                <p className="font-bold text-foreground">{fileNameBase.replace(/\.pdf$/i, "")}.pdf</p>
                <p className="text-[10px] text-muted uppercase font-semibold">Attached PDF Document</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handlePreview}
              className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
            >
              <Eye size={13} />
              <span>Preview</span>
            </button>
          </div>

          {/* Footer Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border-color">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloading}
                className="flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-xl border border-border-color bg-surface-elevated px-4 py-2.5 font-bold text-foreground hover:bg-surface-elevated/80 transition"
                title="Download this document as a PDF to your computer"
              >
                <Download size={15} />
                <span>{downloading ? "Preparing PDF..." : "Download as PDF"}</span>
              </button>

              <button
                type="button"
                onClick={handlePreview}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-border-color bg-surface-elevated px-3 py-2.5 text-muted hover:text-foreground transition"
                title="Print or view document"
              >
                <Printer size={15} />
              </button>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={onClose}
                disabled={sending}
                className="rounded-xl border border-border-color px-4 py-2.5 font-semibold text-muted hover:bg-surface-elevated transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending}
                className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 font-bold text-white shadow-md hover:bg-blue-700 transition disabled:opacity-50"
              >
                <Send size={15} />
                <span>{sending ? "Sending Email..." : "Send Email"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

