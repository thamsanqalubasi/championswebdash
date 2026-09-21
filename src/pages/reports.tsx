import { useEffect, useMemo, useState } from "react";
import { ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { fetchReportsData } from "@/lib/data";
import type { ReportsData } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { Calendar } from "lucide-react";

export type ReportTimeframe =
  | "weekly"
  | "monthly"
  | "quarter"
  | "six_months"
  | "one_year"
  | "two_years"
  | "three_years"
  | "custom";

export default function ReportsPage() {
  const { currentCompany } = useAuth();
  const { format: formatCurrency } = useCurrency();
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [timeframe, setTimeframe] = useState<ReportTimeframe>("six_months");
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const timeframeLabels: Record<ReportTimeframe, string> = {
    weekly: "Weekly (Last 7 Days)",
    monthly: "Monthly",
    quarter: "Quarter (3 Months)",
    six_months: "6 Months",
    one_year: "1 Year",
    two_years: "2 Years",
    three_years: "3 Years",
    custom: "Custom Range",
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchReportsData(currentCompany?.id, timeframe, customStartDate, customEndDate);
        if (!cancelled) setData(result);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load reports.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey, currentCompany?.id, timeframe, customStartDate, customEndDate]);

  const reload = () => setReloadKey((v) => v + 1);

  const exportCSV = () => {
    if (!data) return;
    const header = "Metric,Value";
    const rows = [
      `"Timeframe","${timeframeLabels[timeframe]}"`,
      `"Total Invoiced","${data.summary.totalInvoiced}"`,
      `"Total Paid","${data.summary.totalPaid}"`,
      `"Total Overdue","${data.summary.totalOverdue}"`,
      `"Collection Rate","${data.summary.collectionRate}%"`,
      "",
      "Status,Count",
      ...data.byStatus.map((s) => `"${s.label}","${s.count}"`),
      "",
      "Period,Income,Expenses,Profit",
      ...data.monthly.map((m) => `"${m.label || m.month}","${m.income}","${m.expenses}","${m.profit}"`),
    ];
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reports-${timeframe}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ModulePage title="Reports" description="Financial analytics, multi-period summaries, and cashflow breakdowns.">
      {/* Timeframe Selector Bar */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 bg-surface p-4 rounded-2xl border border-border-color shadow-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Calendar size={16} className="text-blue-600 shrink-0" />
          <span className="text-xs font-bold text-foreground">Timeframe:</span>
          <div className="flex flex-wrap gap-1">
            {(
              [
                { key: "weekly", label: "Weekly" },
                { key: "monthly", label: "Monthly" },
                { key: "quarter", label: "Quarter" },
                { key: "six_months", label: "6 Months" },
                { key: "one_year", label: "1 Year" },
                { key: "two_years", label: "2 Years" },
                { key: "three_years", label: "3 Years" },
                { key: "custom", label: "Custom Range" },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTimeframe(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  timeframe === t.key
                    ? "bg-blue-600 text-white shadow-xs"
                    : "bg-surface-elevated text-muted hover:text-foreground border border-border-color/60"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {timeframe === "custom" && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted font-medium">From:</span>
            <input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="rounded-lg border border-border-color bg-surface-elevated px-2.5 py-1 text-xs outline-none"
            />
            <span className="text-muted font-medium">To:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="rounded-lg border border-border-color bg-surface-elevated px-2.5 py-1 text-xs outline-none"
            />
          </div>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={exportCSV}
            disabled={!data}
            className="rounded-xl border border-border-color bg-surface-elevated px-3.5 py-1.5 text-xs font-bold text-foreground hover:bg-surface transition disabled:opacity-50"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={reload}
            className="rounded-xl border border-border-color px-3.5 py-1.5 text-xs font-semibold text-muted hover:text-foreground transition"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading && <LoadingState label={`Loading reports for ${timeframeLabels[timeframe]}...`} />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && data && (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Total Invoiced</p>
              <p className="text-2xl font-black mt-1 text-foreground">{formatCurrency(data.summary.totalInvoiced)}</p>
              <span className="text-[10px] text-muted">{timeframeLabels[timeframe]}</span>
            </div>
            <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Total Paid</p>
              <p className="text-2xl font-black mt-1 text-green-600">{formatCurrency(data.summary.totalPaid)}</p>
              <span className="text-[10px] text-muted">Collected revenue</span>
            </div>
            <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Total Overdue</p>
              <p className="text-2xl font-black mt-1 text-red-500">{formatCurrency(data.summary.totalOverdue)}</p>
              <span className="text-[10px] text-muted">Outstanding receivables</span>
            </div>
            <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs">
              <p className="text-xs font-bold uppercase tracking-wider text-muted">Collection Rate</p>
              <p className="text-2xl font-black mt-1 text-blue-600">{data.summary.collectionRate}%</p>
              <span className="text-[10px] text-muted">Efficiency ratio</span>
            </div>
          </div>

          {/* Invoice Status Breakdown */}
          <section className="rounded-2xl border border-border-color bg-surface p-5 shadow-xs">
            <h2 className="mb-3 text-base font-bold text-foreground">Invoice Status Breakdown</h2>
            {data.byStatus.length === 0 ? (
              <p className="text-sm text-muted">No invoices to display.</p>
            ) : (
              <div className="space-y-3">
                {data.byStatus.map((item) => {
                  const total = data.byStatus.reduce((s, i) => s + i.count, 0);
                  const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                  return (
                    <div key={item.label} className="flex items-center gap-3">
                      <span className="w-24 text-xs font-semibold capitalize text-muted">{item.label}</span>
                      <div className="flex-1 bg-surface-elevated rounded-full h-3.5 overflow-hidden border border-border-color/60">
                        <div
                          className="bg-blue-600 h-full rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-20 text-xs font-bold text-foreground text-right">
                        {item.count} ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Cashflow Breakdown Table */}
          <section className="rounded-2xl border border-border-color bg-surface p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold text-foreground">
                Cashflow Breakdown ({timeframeLabels[timeframe]})
              </h2>
              <span className="text-xs text-muted font-medium">{data.monthly.length} reporting intervals</span>
            </div>

            {data.monthly.length === 0 ? (
              <p className="text-sm text-muted">No cashflow data available for this timeframe.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border-color text-left text-muted">
                      <th className="px-3 py-2 font-medium">Period / Interval</th>
                      <th className="px-3 py-2 font-medium text-right">Income</th>
                      <th className="px-3 py-2 font-medium text-right">Expenses</th>
                      <th className="px-3 py-2 font-medium text-right">Net Profit / Cashflow</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.monthly.map((row) => (
                      <tr key={row.month} className="border-b border-border-color/60 hover:bg-surface-elevated/40 transition">
                        <td className="px-3 py-3 font-semibold text-foreground">{row.label || row.month}</td>
                        <td className="px-3 py-3 text-right font-bold text-green-600">{formatCurrency(row.income)}</td>
                        <td className="px-3 py-3 text-right font-bold text-red-500">{formatCurrency(row.expenses)}</td>
                        <td
                          className={`px-3 py-3 text-right font-black ${
                            row.income - row.expenses >= 0 ? "text-green-600" : "text-red-500"
                          }`}
                        >
                          {row.income - row.expenses >= 0 ? "+" : ""}
                          {formatCurrency(row.income - row.expenses)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </ModulePage>
  );
}
