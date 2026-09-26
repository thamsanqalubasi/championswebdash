import { useState, useMemo } from "react";
import {
  X,
  Calendar,
  Download,
  Printer,
  Mail,
  FileText,
  DollarSign,
  PieChart as PieIcon,
  BarChart2,
} from "lucide-react";
import type { InvoiceRow } from "@/lib/types";
import { ReportEmailDialog } from "./reports/report-email-dialog";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface InvoicesReportModalProps {
  isOpen?: boolean;
  open?: boolean;
  onClose: () => void;
  invoices: InvoiceRow[];
  companyName: string;
  currency?: string;
}

const COLORS = ["#10b981", "#3b82f6", "#ef4444", "#94a3b8"];

export function InvoicesReportModal({
  isOpen,
  open,
  onClose,
  invoices,
  companyName,
  currency = "ZAR",
}: InvoicesReportModalProps) {
  const isModalOpen = open ?? isOpen ?? false;
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  const stats = useMemo(() => {
    let totalInvoiced = 0;
    let totalPaid = 0;
    let paidCount = 0;
    let overdueCount = 0;
    let sentCount = 0;
    let draftCount = 0;

    invoices.forEach((inv) => {
      const amt = inv.totalAmount || 0;
      totalInvoiced += amt;
      if (inv.status === "paid") {
        totalPaid += amt;
        paidCount++;
      } else if (inv.status === "overdue") {
        overdueCount++;
      } else if (inv.status === "sent") {
        sentCount++;
      } else {
        draftCount++;
      }
    });

    const outstanding = Math.max(0, totalInvoiced - totalPaid);
    return { totalInvoiced, totalPaid, outstanding, paidCount, overdueCount, sentCount, draftCount };
  }, [invoices]);

  const pieData = useMemo(() => [
    { name: "Paid", value: stats.paidCount },
    { name: "Sent", value: stats.sentCount },
    { name: "Overdue", value: stats.overdueCount },
    { name: "Draft", value: stats.draftCount },
  ].filter((p) => p.value > 0), [stats]);

  const reportHtml = useMemo(() => `
    <h3>${companyName} — Invoices & Accounts Receivable Report</h3>
    <p>Generated: ${new Date().toLocaleString()}</p>
    <hr style="margin: 10px 0; border: none; border-top: 1px solid #ddd;" />
    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <tr><td style="padding: 5px 0;"><strong>Total Invoiced:</strong></td><td>${currency} ${stats.totalInvoiced.toLocaleString()}</td></tr>
      <tr><td style="padding: 5px 0;"><strong>Total Paid:</strong></td><td>${currency} ${stats.totalPaid.toLocaleString()}</td></tr>
      <tr><td style="padding: 5px 0;"><strong>Total Outstanding:</strong></td><td>${currency} ${stats.outstanding.toLocaleString()}</td></tr>
      <tr><td style="padding: 5px 0;"><strong>Paid Invoices:</strong></td><td>${stats.paidCount}</td></tr>
      <tr><td style="padding: 5px 0;"><strong>Overdue Invoices:</strong></td><td>${stats.overdueCount}</td></tr>
      <tr><td style="padding: 5px 0;"><strong>Sent / Pending:</strong></td><td>${stats.sentCount}</td></tr>
    </table>
  `, [companyName, stats, currency]);

  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-3 sm:p-5 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex flex-col h-[90vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-border-color bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-color px-6 py-4 bg-surface-elevated/40">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-600/10 p-2.5 text-blue-600 border border-blue-600/20">
              <FileText size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
                <span>Invoices & Revenue Audit Report</span>
              </h2>
              <p className="text-xs text-muted">Billed rent invoices, collector transactions, and outstanding aging balances.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface px-3 py-2 text-xs font-bold text-foreground hover:bg-surface-elevated transition shadow-xs"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const w = window.open("", "_blank");
                if (w) {
                  w.document.write(`<html><body style="font-family:sans-serif;padding:30px;">${reportHtml}<script>window.onload=function(){window.print();}</script></body></html>`);
                  w.document.close();
                }
              }}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition"
            >
              <Download size={14} />
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              onClick={() => setEmailDialogOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface px-3 py-2 text-xs font-bold text-foreground hover:bg-surface-elevated transition shadow-xs"
            >
              <Mail size={14} className="text-emerald-500" />
              <span>Email</span>
            </button>
            <button type="button" onClick={onClose} className="rounded-xl p-2 text-muted hover:bg-surface-elevated">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-border-color bg-surface p-4">
              <span className="text-xs font-semibold text-muted">Total Invoiced</span>
              <p className="mt-1 text-2xl font-black text-foreground">{currency} {stats.totalInvoiced.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-border-color bg-surface p-4">
              <span className="text-xs font-semibold text-muted">Total Paid</span>
              <p className="mt-1 text-2xl font-black text-emerald-600">{currency} {stats.totalPaid.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-border-color bg-surface p-4">
              <span className="text-xs font-semibold text-muted">Outstanding</span>
              <p className="mt-1 text-2xl font-black text-red-600">{currency} {stats.outstanding.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-border-color bg-surface p-4">
              <span className="text-xs font-semibold text-muted">Paid Rate</span>
              <p className="mt-1 text-2xl font-black text-blue-600">
                {stats.totalInvoiced > 0 ? Math.round((stats.totalPaid / stats.totalInvoiced) * 100) : 100}%
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border-color bg-surface p-5">
            <h4 className="text-sm font-black text-foreground mb-4">Invoice Status Distribution</h4>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border-color px-6 py-3 bg-surface-elevated/30 text-xs text-muted">
          <span>{companyName} • {invoices.length} invoices analyzed</span>
          <button type="button" onClick={onClose} className="rounded-xl border border-border-color bg-surface px-4 py-1.5 font-bold">Close</button>
        </div>
      </div>

      <ReportEmailDialog
        isOpen={emailDialogOpen}
        onClose={() => setEmailDialogOpen(false)}
        reportTitle={`Invoices & Receivables Executive Report (${companyName})`}
        reportHtml={reportHtml}
      />
    </div>
  );
}
