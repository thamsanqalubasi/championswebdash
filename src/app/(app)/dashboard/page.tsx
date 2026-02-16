"use client";

import { useEffect, useMemo, useState } from "react";
import { ModulePage } from "@/components/module-page";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { fetchDashboardData } from "@/lib/data";
import type { DashboardData } from "@/lib/types";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchDashboardData();
        if (!cancelled) {
          setData(result);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load dashboard data.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const maxCashflow = useMemo(() => {
    if (!data?.cashflow.length) {
      return 0;
    }

    return Math.max(...data.cashflow.map((item) => item.profit));
  }, [data]);

  const activityRows = useMemo(() => {
    if (!data) {
      return [];
    }

    return [
      {
        module: "Maintenance",
        item: `${data.stats.pendingMaintenance} work orders open`,
        state: data.stats.pendingMaintenance > 0 ? "Needs assignment" : "Stable",
      },
      {
        module: "Collections",
        item: `${data.stats.overduePayments} overdue invoices`,
        state: data.stats.overduePayments > 0 ? "Follow-up pending" : "On track",
      },
      {
        module: "Occupancy",
        item: `${data.stats.occupiedUnits}/${data.stats.totalProperties} occupied units`,
        state: `${data.stats.occupancyRate.toFixed(1)}% occupancy`,
      },
      {
        module: "Finance",
        item: `${formatCurrency(data.stats.netProfit)} net profit`,
        state: data.stats.netProfit >= 0 ? "Positive month" : "Negative month",
      },
    ];
  }, [data]);

  const kpis = useMemo(() => {
    if (!data) {
      return [];
    }

    return [
      {
        label: "Occupancy",
        value: `${data.stats.occupancyRate.toFixed(1)}%`,
        detail: `${data.stats.occupiedUnits} / ${data.stats.totalProperties} units occupied`,
      },
      {
        label: "Collection Rate",
        value: `${data.stats.collectionRate.toFixed(1)}%`,
        detail: "Calculated from latest invoice month",
      },
      {
        label: "Revenue",
        value: formatCurrency(data.stats.totalMonthlyIncome),
        detail: "Current month rental income",
      },
      {
        label: "Expenses",
        value: formatCurrency(data.stats.totalMonthlyExpenses),
        detail: "Current month maintenance expenses",
      },
      {
        label: "NOI",
        value: formatCurrency(data.stats.netProfit),
        detail: "Net operating income",
      },
      {
        label: "Overdue Invoices",
        value: String(data.stats.overduePayments),
        detail: "Invoices marked overdue",
      },
    ];
  }, [data]);

  return (
    <ModulePage
      title="Dashboard"
      description="Operational KPIs, occupancy, collection rate, and 6-month cashflow will be implemented here."
    >
      {loading && <LoadingState label="Loading dashboard analytics..." />}

      {!loading && error && (
        <ErrorState message={error} onRetry={() => setReloadKey((value) => value + 1)} />
      )}

      {!loading && !error && data && (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {kpis.map((kpi) => (
              <article key={kpi.label} className="rounded-lg border border-border-color bg-surface p-4">
                <p className="text-sm text-muted">{kpi.label}</p>
                <p className="mt-2 text-2xl font-semibold">{kpi.value}</p>
                <p className="mt-1 text-sm text-muted">{kpi.detail}</p>
              </article>
            ))}
          </div>

          <section className="grid gap-4 xl:grid-cols-3">
            <article className="rounded-lg border border-border-color bg-surface p-4 xl:col-span-2">
              <header className="mb-4 flex items-center justify-between">
                <h3 className="text-base font-semibold">6-Month Cashflow</h3>
                <span className="text-xs text-muted">Monthly profit position</span>
              </header>
              {data.cashflow.length === 0 ? (
                <EmptyState
                  title="No cashflow records"
                  description="No monthly records were returned yet for this account."
                />
              ) : (
                <div className="grid grid-cols-6 gap-3">
                  {data.cashflow.map((item) => (
                    <div key={item.month} className="flex flex-col items-center gap-2">
                      <div className="flex h-40 w-full items-end rounded-md border border-border-color bg-surface-elevated p-2">
                        <div
                          className="w-full rounded-sm bg-foreground/80"
                          style={{
                            height: `${Math.max(
                              10,
                              (Math.abs(item.profit) / Math.max(1, Math.abs(maxCashflow))) * 100,
                            )}%`,
                          }}
                        />
                      </div>
                      <p className="text-xs text-muted">{item.label}</p>
                    </div>
                  ))}
                </div>
              )}
            </article>

            <article className="rounded-lg border border-border-color bg-surface p-4">
              <h3 className="mb-4 text-base font-semibold">Alerts</h3>
              <ul className="space-y-3 text-sm text-muted">
                <li className="rounded-md border border-border-color bg-surface-elevated p-3">
                  {data.stats.pendingMaintenance} maintenance tickets are awaiting assignment.
                </li>
                <li className="rounded-md border border-border-color bg-surface-elevated p-3">
                  {data.stats.overduePayments} invoices are currently overdue.
                </li>
                <li className="rounded-md border border-border-color bg-surface-elevated p-3">
                  Occupancy is at {data.stats.occupancyRate.toFixed(1)}% this cycle.
                </li>
              </ul>
            </article>
          </section>

          <section className="rounded-lg border border-border-color bg-surface p-4">
            <header className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold">Operational Snapshot</h3>
            </header>
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border-color text-left text-muted">
                    <th className="px-3 py-2 font-medium">Module</th>
                    <th className="px-3 py-2 font-medium">Current Item</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {activityRows.map((row) => (
                    <tr key={row.module} className="border-b border-border-color/60">
                      <td className="px-3 py-2 font-medium">{row.module}</td>
                      <td className="px-3 py-2 text-muted">{row.item}</td>
                      <td className="px-3 py-2">
                        <span className="rounded-full border border-border-color bg-surface-elevated px-2 py-1 text-xs text-muted">
                          {row.state}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </ModulePage>
  );
}
