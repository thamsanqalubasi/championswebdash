import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { fetchInventoryData } from "@/lib/data";
import type { InventoryItemRow } from "@/lib/types";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(amount);
}

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true); setError(null);
      try { const result = await fetchInventoryData(); if (!cancelled) setItems(result); }
      catch (loadError) { if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load inventory."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void loadData();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const counts = useMemo(() => ({
    total: items.length,
    lowStock: items.filter((i) => i.quantity <= i.minStockLevel).length,
    value: items.reduce((s, r) => s + r.quantity * r.unitCost, 0),
  }), [items]);

  return (
    <ModulePage title="Inventory" description="Stock levels, low-stock alerts, and usage logging.">
      {loading && <LoadingState label="Loading inventory..." />}
      {!loading && error && <ErrorState message={error} onRetry={() => setReloadKey((v) => v + 1)} />}
      {!loading && !error && (
        <section className="space-y-4 rounded-lg border border-border-color bg-surface p-4">
          <div className="grid gap-3 md:grid-cols-3">
            <article className="rounded-md border border-border-color bg-surface-elevated p-3"><p className="text-xs text-muted">Items</p><p className="mt-1 text-xl font-semibold">{counts.total}</p></article>
            <article className="rounded-md border border-border-color bg-surface-elevated p-3"><p className="text-xs text-muted">Low Stock Alerts</p><p className="mt-1 text-xl font-semibold">{counts.lowStock}</p></article>
            <article className="rounded-md border border-border-color bg-surface-elevated p-3"><p className="text-xs text-muted">Inventory Value</p><p className="mt-1 text-xl font-semibold">{formatCurrency(counts.value)}</p></article>
          </div>
          {items.length === 0 ? (
            <EmptyState title="No inventory items found" description="Create stock items in mobile or backend first, then refresh this page." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead><tr className="border-b border-border-color text-left text-muted">
                  <th className="px-3 py-2 font-medium">Item</th><th className="px-3 py-2 font-medium">Category</th><th className="px-3 py-2 font-medium">Quantity</th><th className="px-3 py-2 font-medium">Min Stock</th><th className="px-3 py-2 font-medium">Unit Cost</th><th className="px-3 py-2 font-medium">Supplier</th><th className="px-3 py-2 font-medium">Location</th><th className="px-3 py-2 font-medium">Actions</th>
                </tr></thead>
                <tbody>{items.map((row) => {
                  const isLowStock = row.quantity <= row.minStockLevel;
                  return (
                    <tr key={row.id} className="border-b border-border-color/60">
                      <td className="px-3 py-3 font-medium">{row.name}</td>
                      <td className="px-3 py-3 text-muted">{row.category}</td>
                      <td className="px-3 py-3 text-muted">{row.quantity} {row.unit}</td>
                      <td className="px-3 py-3 text-muted">{row.minStockLevel}</td>
                      <td className="px-3 py-3 text-muted">{formatCurrency(row.unitCost)}</td>
                      <td className="px-3 py-3 text-muted">{row.supplier}</td>
                      <td className="px-3 py-3 text-muted">{row.location}</td>
                      <td className="px-3 py-3"><div className="flex flex-wrap gap-2">
                        <button type="button" className="rounded-md border border-border-color px-2 py-1 text-xs text-muted">Restock</button>
                        <button type="button" className="rounded-md border border-border-color px-2 py-1 text-xs text-muted">Use</button>
                        <span className="rounded-full border border-border-color bg-surface-elevated px-2 py-1 text-xs text-muted">{isLowStock ? "Low stock" : "OK"}</span>
                      </div></td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </ModulePage>
  );
}
