import { useState, useMemo } from "react";
import {
  X,
  Calendar,
  Download,
  Printer,
  Mail,
  CalendarClock,
  DollarSign,
  PieChart as PieIcon,
} from "lucide-react";
import type { BillRow } from "@/lib/bills";
import { ReportEmailDialog } from "./reports/report-email-dialog";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";

interface BillsReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  bills: BillRow[];
  companyName: string;
  currency?: string;
}

const COLORS = ["#10b981", "#f59e0b", "#ef4444", "#3b82f6"];

export function BillsReportModal({
  isOpen,
  onClose,
  bills,
  companyName,
  currency = "ZAR",
}: BillsReportModalProps) {
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  const stats = useMemo(() => {
    let totalCommitment = 0;
    let paidAmount = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let overdueCount = 0;

    bills.forEach((b) => {
      const amt = b.amount || 0;
      totalCommitment += amt;
      if (b.status === "paid") {
        paidAmount += b.lastPaidAmount || amt;
        paidCount++;
      } else {
        pendingCount++;
      }
    });

    const pendingAmount = Math.max(0, totalCommitment - paidAmount);
    return { totalCommitment, paidAmount, pendingAmount, paidCount, pendingCount, overdueCount };
  }, [bills]);

  const pieData = useMemo(() => [
    { name: "Paid", value: stats.paidCount },
    { name: "Pending", value: stats.pendingCount },
    { name: "Overdue", value: stats.overdueCount },
  ].filter((p) => p.value > 0), [stats]);

  const reportHtml = useMemo(() => `
    <h3>${companyName} — Property Bills & Recurring Liabilities Report</h3>
    <p>Generated: ${new Date().toLocaleString()}</p>
    <hr style="margin: 10px 0; border: none; border-top: 1px solid #ddd;" />
    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <tr><td style="padding: 5px 0;"><strong>Total Recurring Commitments:</strong></td><td>${currency} ${stats.totalCommitment.toLocaleString()}</td></tr>
      <tr><td style="padding: 5px 0;"><strong>Total Paid in Cycle:</strong></td><td>${currency} ${stats.paidAmount.toLocaleString()}</td></tr>
      <tr><td style="padding: 5px 0;"><strong>Total Pending / Due:</strong></td><td>${currency} ${stats.pendingAmount.toLocaleString()}</td></tr>
      <tr><td style="padding: 5px 0;"><strong>Paid Bills:</strong></td><td>${stats.paidCount}</td></tr>
      <tr><td style="padding: 5px 0;"><strong>Pending Bills:</strong></td><td>${stats.pendingCount}</td></tr>
      <tr><td style="padding: 5px 0;"><strong>Overdue Bills:</strong></td><td>${stats.overdueCount}</td></tr>
    </table>
  `, [companyName, stats, currency]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-3 sm:p-5 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex flex-col h-[90vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-border-color bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-color px-6 py-4 bg-surface-elevated/40">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-amber-500/10 p-2.5 text-amber-600 border border-amber-500/20">
              <CalendarClock size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
                <span>Property Bills & Liabilities Report</span>
              </h2>
              <p className="text-xs text-muted">Recurring utility commitments, countdowns, and vendor payments.</p>
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
              className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white shadow-md hover:bg-amber-700 transition"
            >
              <Download size={14} />
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              onClick={() => setEmailDialogOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface px-3 py-2 text-xs font-bold text-foreground hover:bg-surface-elevated transition shadow-xs"
            >
              <Mail size={14} className="text-blue-500" />
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
              <span className="text-xs font-semibold text-muted">Total Commitment</span>
              <p className="mt-1 text-2xl font-black text-foreground">{currency} {stats.totalCommitment.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-border-color bg-surface p-4">
              <span className="text-xs font-semibold text-muted">Paid Bills</span>
              <p className="mt-1 text-2xl font-black text-emerald-600">{currency} {stats.paidAmount.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-border-color bg-surface p-4">
              <span className="text-xs font-semibold text-muted">Pending / Due</span>
              <p className="mt-1 text-2xl font-black text-amber-600">{currency} {stats.pendingAmount.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-border-color bg-surface p-4">
              <span className="text-xs font-semibold text-muted">Overdue Count</span>
              <p className="mt-1 text-2xl font-black text-red-600">{stats.overdueCount}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border-color bg-surface p-5">
            <h4 className="text-sm font-black text-foreground mb-4">Bills Status Distribution</h4>
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
          <span>{companyName} • {bills.length} bills monitored</span>
          <button type="button" onClick={onClose} className="rounded-xl border border-border-color bg-surface px-4 py-1.5 font-bold">Close</button>
        </div>
      </div>

      <ReportEmailDialog
        isOpen={emailDialogOpen}
        onClose={() => setEmailDialogOpen(false)}
        reportTitle={`Property Bills & Liabilities Report (${companyName})`}
        reportHtml={reportHtml}
      />
    </div>
  );
}
