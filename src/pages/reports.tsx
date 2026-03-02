import { useEffect, useState } from "react";
import { ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { fetchReportsData } from "@/lib/data";
import type { ReportsData } from "@/lib/types";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "NAD", maximumFractionDigits: 0 }).format(amount);
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true); setError(null);
      try {
        const result = await fetchReportsData();
        if (!cancelled) setData(result);
      } catch (e) { if (!cancelled) setError(e instanceof Error ? e.message : "Could not load reports."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const reload = () => setReloadKey((v) => v + 1);

  const exportCSV = () => {
    if (!data) return;
    const header = "Metric,Value";
    const rows = [
      `"Total Invoiced","${data.summary.totalInvoiced}"`,
      `"Total Paid","${data.summary.totalPaid}"`,
      `"Total Overdue","${data.summary.totalOverdue}"`,
      `"Collection Rate","${data.summary.collectionRate}%"`,
      "",
      "Status,Count",
      ...data.byStatus.map((s) => `"${s.label}","${s.count}"`),
      "",
      "Month,Income,Expenses",
      ...data.monthly.map((m) => `"${m.month}","${m.income}","${m.expenses}"`),
    ];
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "reports.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ModulePage title="Reports" description="Financial analytics and summaries.">
      {loading && <LoadingState label="Loading reports..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && data && (
        <div className="space-y-6">
          {/* Actions */}
          <div className="flex gap-3">
            <button type="button" onClick={exportCSV} className="rounded-md border border-border-color bg-surface-elevated px-4 py-2 text-sm font-medium">Export Report CSV</button>
            <button type="button" onClick={reload} className="rounded-md border border-border-color px-4 py-2 text-sm text-muted hover:bg-surface-elevated">Refresh</button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-border-color bg-surface p-4">
              <p className="text-sm text-muted">Total Invoiced</p>
              <p className="text-2xl font-bold">{formatCurrency(data.summary.totalInvoiced)}</p>
            </div>
            <div className="rounded-lg border border-border-color bg-surface p-4">
              <p className="text-sm text-muted">Total Paid</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(data.summary.totalPaid)}</p>
            </div>
            <div className="rounded-lg border border-border-color bg-surface p-4">
              <p className="text-sm text-muted">Total Overdue</p>
              <p className="text-2xl font-bold text-red-500">{formatCurrency(data.summary.totalOverdue)}</p>
            </div>
            <div className="rounded-lg border border-border-color bg-surface p-4">
              <p className="text-sm text-muted">Collection Rate</p>
              <p className="text-2xl font-bold">{data.summary.collectionRate}%</p>
            </div>
          </div>

          {/* Invoice Status Breakdown */}
          <section className="rounded-lg border border-border-color bg-surface p-4">
            <h2 className="mb-3 text-lg font-semibold">Invoice Status Breakdown</h2>
            {data.byStatus.length === 0 ? <p className="text-sm text-muted">No invoices to display.</p> : (
              <div className="space-y-2">
                {data.byStatus.map((item) => {
                  const total = data.byStatus.reduce((s, i) => s + i.count, 0);
                  const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                  return (
                    <div key={item.label} className="flex items-center gap-3">
                      <span className="w-24 text-sm capitalize text-muted">{item.label}</span>
                      <div className="flex-1 bg-surface-elevated rounded-full h-4 overflow-hidden">
                        <div className="bg-blue-500/70 h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="w-16 text-sm text-muted text-right">{item.count} ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Monthly Cashflow */}
          <section className="rounded-lg border border-border-color bg-surface p-4">
            <h2 className="mb-3 text-lg font-semibold">Monthly Cashflow</h2>
            {data.monthly.length === 0 ? <p className="text-sm text-muted">No cashflow data available.</p> : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead><tr className="border-b border-border-color text-left text-muted">
                    <th className="px-3 py-2 font-medium">Month</th>
                    <th className="px-3 py-2 font-medium text-right">Income</th>
                    <th className="px-3 py-2 font-medium text-right">Expenses</th>
                    <th className="px-3 py-2 font-medium text-right">Net</th>
                  </tr></thead>
                  <tbody>{data.monthly.map((row) => (
                    <tr key={row.month} className="border-b border-border-color/60">
                      <td className="px-3 py-3 font-medium">{row.month}</td>
                      <td className="px-3 py-3 text-right text-green-600">{formatCurrency(row.income)}</td>
                      <td className="px-3 py-3 text-right text-red-500">{formatCurrency(row.expenses)}</td>
                      <td className={`px-3 py-3 text-right font-medium ${row.income - row.expenses >= 0 ? "text-green-600" : "text-red-500"}`}>{formatCurrency(row.income - row.expenses)}</td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </ModulePage>
  );
}
