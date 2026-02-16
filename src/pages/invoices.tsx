import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { fetchInvoicesData } from "@/lib/data";
import type { InvoiceRow } from "@/lib/types";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(amount);
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true); setError(null);
      try {
        const result = await fetchInvoicesData();
        if (!cancelled) setInvoices(result);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load invoices.");
      } finally { if (!cancelled) setLoading(false); }
    }
    void loadData();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const stats = useMemo(() => ({
    total: invoices.length,
    paid: invoices.filter((r) => r.status === "paid").length,
    overdue: invoices.filter((r) => r.status === "overdue").length,
    value: invoices.reduce((s, r) => s + r.totalAmount, 0),
  }), [invoices]);

  return (
    <ModulePage title="Invoices" description="Invoice generation, status transitions, and PDF actions.">
      {loading && <LoadingState label="Loading invoices..." />}
      {!loading && error && <ErrorState message={error} onRetry={() => setReloadKey((v) => v + 1)} />}
      {!loading && !error && (
        <section className="space-y-4 rounded-lg border border-border-color bg-surface p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <article className="rounded-md border border-border-color bg-surface-elevated p-3"><p className="text-xs text-muted">Total Invoices</p><p className="mt-1 text-xl font-semibold">{stats.total}</p></article>
            <article className="rounded-md border border-border-color bg-surface-elevated p-3"><p className="text-xs text-muted">Paid</p><p className="mt-1 text-xl font-semibold">{stats.paid}</p></article>
            <article className="rounded-md border border-border-color bg-surface-elevated p-3"><p className="text-xs text-muted">Overdue</p><p className="mt-1 text-xl font-semibold">{stats.overdue}</p></article>
            <article className="rounded-md border border-border-color bg-surface-elevated p-3"><p className="text-xs text-muted">Gross Invoiced</p><p className="mt-1 text-xl font-semibold">{formatCurrency(stats.value)}</p></article>
          </div>
          {invoices.length === 0 ? (
            <EmptyState title="No invoices found" description="Generate invoices in mobile or backend first, then refresh this page." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead><tr className="border-b border-border-color text-left text-muted">
                  <th className="px-3 py-2 font-medium">Tenant</th><th className="px-3 py-2 font-medium">Property</th><th className="px-3 py-2 font-medium">Month</th><th className="px-3 py-2 font-medium">Due Date</th><th className="px-3 py-2 font-medium">Amount</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Actions</th>
                </tr></thead>
                <tbody>
                  {invoices.map((row) => (
                    <tr key={row.id} className="border-b border-border-color/60">
                      <td className="px-3 py-3 font-medium">{row.tenantName}</td>
                      <td className="px-3 py-3 text-muted">{row.propertyName}</td>
                      <td className="px-3 py-3 text-muted">{row.month}</td>
                      <td className="px-3 py-3 text-muted">{row.dueDate}</td>
                      <td className="px-3 py-3 text-muted">{formatCurrency(row.totalAmount)}</td>
                      <td className="px-3 py-3"><span className="rounded-full border border-border-color bg-surface-elevated px-2 py-1 text-xs text-muted capitalize">{row.status.replaceAll("_", " ")}</span></td>
                      <td className="px-3 py-3"><div className="flex flex-wrap gap-2">
                        <button type="button" className="rounded-md border border-border-color px-2 py-1 text-xs text-muted">View PDF</button>
                        <button type="button" className="rounded-md border border-border-color px-2 py-1 text-xs text-muted">Share</button>
                        <button type="button" className="rounded-md border border-border-color px-2 py-1 text-xs text-muted">Delete</button>
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </ModulePage>
  );
}
