import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { fetchReportsData } from "@/lib/data";
import type { ReportsData } from "@/lib/types";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(amount);
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true); setError(null);
      try {
        const result = await fetchReportsData();
        if (!cancelled) setData(result);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load reports.");
      } finally { if (!cancelled) setLoading(false); }
    }
    void loadData();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const maxProfit = useMemo(() => {
    if (!data?.monthly.length) return 0;
    return Math.max(...data.monthly.map((p) => Math.abs(p.profit)));
  }, [data]);

  return (
    <ModulePage title="Reports" description="Income statement, occupancy, expense mix, and trend dashboards.">
      {loading && <LoadingState label="Loading report analytics..." />}
      {!loading && error && <ErrorState message={error} onRetry={() => setReloadKey((v) => v + 1)} />}
      {!loading && !error && data && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-lg border border-border-color bg-surface p-4"><p className="text-sm text-muted">Total Invoiced</p><p className="mt-2 text-2xl font-semibold">{formatCurrency(data.summary.totalInvoiced)}</p></article>
            <article className="rounded-lg border border-border-color bg-surface p-4"><p className="text-sm text-muted">Total Paid</p><p className="mt-2 text-2xl font-semibold">{formatCurrency(data.summary.totalPaid)}</p></article>
            <article className="rounded-lg border border-border-color bg-surface p-4"><p className="text-sm text-muted">Overdue Amount</p><p className="mt-2 text-2xl font-semibold">{formatCurrency(data.summary.totalOverdue)}</p></article>
            <article className="rounded-lg border border-border-color bg-surface p-4"><p className="text-sm text-muted">Collection Rate</p><p className="mt-2 text-2xl font-semibold">{data.summary.collectionRate.toFixed(1)}%</p></article>
          </div>
          <section className="grid gap-4 xl:grid-cols-3">
            <article className="rounded-lg border border-border-color bg-surface p-4 xl:col-span-2">
              <header className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold">Income Trend (6 Months)</h3>
                <span className="text-xs text-muted">Net profit by month</span>
              </header>
              {data.monthly.length === 0 ? (
                <EmptyState title="No monthly data" description="No monthly cashflow records are available yet." />
              ) : (
                <div className="grid grid-cols-6 gap-3">
                  {data.monthly.map((point) => (
                    <div key={point.month} className="flex flex-col items-center gap-2">
                      <div className="flex h-40 w-full items-end rounded-md border border-border-color bg-surface-elevated p-2">
                        <div className="w-full rounded-sm bg-foreground/80" style={{ height: `${Math.max(10, (Math.abs(point.profit) / Math.max(1, maxProfit)) * 100)}%` }} />
                      </div>
                      <p className="text-xs text-muted">{point.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </article>
            <article className="rounded-lg border border-border-color bg-surface p-4">
              <h3 className="mb-4 text-base font-semibold">Invoice Status Mix</h3>
              {data.byStatus.length === 0 ? (
                <EmptyState title="No invoice statuses" description="Generate invoices to populate this breakdown." />
              ) : (
                <ul className="space-y-3 text-sm text-muted">
                  {data.byStatus.map((item) => (
                    <li key={item.label} className="flex items-center justify-between rounded-md border border-border-color bg-surface-elevated p-3">
                      <span className="capitalize">{item.label.replaceAll("_", " ")}</span>
                      <span className="font-medium text-foreground">{item.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </section>
        </>
      )}
    </ModulePage>
  );
}
