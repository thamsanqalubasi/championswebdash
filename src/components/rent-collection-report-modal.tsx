import { useState, useMemo } from "react";
import {
  X,
  Calendar,
  Download,
  Printer,
  Mail,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  PieChart as PieIcon,
  BarChart2,
} from "lucide-react";
import type { TenantRow } from "@/lib/types";
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

interface RentCollectionReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  tenants: TenantRow[];
  companyName: string;
  currency?: string;
}

const COLORS = ["#10b981", "#ef4444", "#f59e0b", "#6366f1"];

export function RentCollectionReportModal({
  isOpen,
  onClose,
  tenants,
  companyName,
  currency = "ZAR",
}: RentCollectionReportModalProps) {
  const [period, setPeriod] = useState<string>("current_month");
  const [displayMode, setDisplayMode] = useState<"both" | "numbers" | "graphs">("both");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);

  const stats = useMemo(() => {
    let totalDue = 0;
    let totalCollected = 0;
    let fullySettledCount = 0;
    let arrearsCount = 0;

    tenants.forEach((t) => {
      const rent = t.rentAmount || 0;
      totalDue += rent;
      // In mock/demo: calculate settled vs arrears
      if (t.tenureStatus === "active" || t.status === "active") {
        totalCollected += rent;
        fullySettledCount++;
      } else {
        arrearsCount++;
      }
    });

    const collectionRate = totalDue > 0 ? Math.round((totalCollected / totalDue) * 100) : 100;
    const outstanding = Math.max(0, totalDue - totalCollected);

    return { totalDue, totalCollected, collectionRate, outstanding, fullySettledCount, arrearsCount };
  }, [tenants]);

  const pieData = useMemo(() => [
    { name: "Collected / Settled", value: stats.totalCollected },
    { name: "Arrears / Due", value: stats.outstanding || 1 },
  ], [stats]);

  const reportHtml = useMemo(() => `
    <h3>${companyName} — Rent Collection & Revenue Audit Report</h3>
    <p><strong>Cycle:</strong> Current Billing Cycle | Generated: ${new Date().toLocaleString()}</p>
    <hr style="margin: 10px 0; border: none; border-top: 1px solid #ddd;" />
    <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
      <tr><td style="padding: 5px 0;"><strong>Collection Rate:</strong></td><td>${stats.collectionRate}%</td></tr>
      <tr><td style="padding: 5px 0;"><strong>Total Rent Due:</strong></td><td>${currency} ${stats.totalDue.toLocaleString()}</td></tr>
      <tr><td style="padding: 5px 0;"><strong>Total Rent Collected:</strong></td><td>${currency} ${stats.totalCollected.toLocaleString()}</td></tr>
      <tr><td style="padding: 5px 0;"><strong>Total Arrears / Outstanding:</strong></td><td>${currency} ${stats.outstanding.toLocaleString()}</td></tr>
      <tr><td style="padding: 5px 0;"><strong>Fully Settled Units:</strong></td><td>${stats.fullySettledCount}</td></tr>
      <tr><td style="padding: 5px 0;"><strong>Units in Arrears:</strong></td><td>${stats.arrearsCount}</td></tr>
    </table>
  `, [companyName, stats, currency]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-3 sm:p-5 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex flex-col h-[90vh] w-full max-w-4xl overflow-hidden rounded-3xl border border-border-color bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-color px-6 py-4 bg-surface-elevated/40">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-emerald-600/10 p-2.5 text-emerald-600 border border-emerald-600/20">
              <DollarSign size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-foreground flex items-center gap-2">
                <span>Rent Collection Executive Report</span>
              </h2>
              <p className="text-xs text-muted">Efficiency audit, tenant payments summary, and revenue realization.</p>
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
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition"
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-border-color bg-surface p-4">
              <span className="text-xs font-semibold text-muted">Collection Rate</span>
              <p className="mt-1 text-2xl font-black text-emerald-600">{stats.collectionRate}%</p>
            </div>
            <div className="rounded-2xl border border-border-color bg-surface p-4">
              <span className="text-xs font-semibold text-muted">Total Collected</span>
              <p className="mt-1 text-2xl font-black text-foreground">{currency} {stats.totalCollected.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-border-color bg-surface p-4">
              <span className="text-xs font-semibold text-muted">Outstanding Arrears</span>
              <p className="mt-1 text-2xl font-black text-red-600">{currency} {stats.outstanding.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-border-color bg-surface p-4">
              <span className="text-xs font-semibold text-muted">Fully Settled</span>
              <p className="mt-1 text-2xl font-black text-blue-600">{stats.fullySettledCount} Units</p>
            </div>
          </div>

          <div className="rounded-2xl border border-border-color bg-surface p-5">
            <h4 className="text-sm font-black text-foreground mb-4">Rent Collection Distribution</h4>
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
          <span>{companyName} • Generated at {new Date().toLocaleDateString()}</span>
          <button type="button" onClick={onClose} className="rounded-xl border border-border-color bg-surface px-4 py-1.5 font-bold">Close</button>
        </div>
      </div>

      <ReportEmailDialog
        isOpen={emailDialogOpen}
        onClose={() => setEmailDialogOpen(false)}
        reportTitle={`Rent Collection Executive Report (${companyName})`}
        reportHtml={reportHtml}
      />
    </div>
  );
}
