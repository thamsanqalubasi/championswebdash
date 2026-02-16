import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { fetchContractsData, verifyAdminPin } from "@/lib/data";
import type { ContractRow } from "@/lib/types";

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", maximumFractionDigits: 0 }).format(amount);
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [pin, setPin] = useState("");
  const [pinVerified, setPinVerified] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinLoading, setPinLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true); setError(null);
      try { const result = await fetchContractsData(); if (!cancelled) setContracts(result); }
      catch (loadError) { if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load contracts."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void loadData();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const contractStats = useMemo(() => ({
    total: contracts.length,
    active: contracts.filter((i) => i.status === "active").length,
    draft: contracts.filter((i) => i.status === "draft").length,
    value: contracts.reduce((s, i) => s + i.amount, 0),
  }), [contracts]);

  const onVerifyPin = async () => {
    setPinLoading(true); setPinError(null);
    try {
      const valid = await verifyAdminPin(pin);
      if (!valid) { setPinVerified(false); setPinError("Invalid admin PIN."); return; }
      setPinVerified(true); setPinError(null);
    } catch (verifyError) {
      setPinVerified(false); setPinError(verifyError instanceof Error ? verifyError.message : "Could not verify PIN.");
    } finally { setPinLoading(false); }
  };

  return (
    <ModulePage title="Contracts" description="Template-backed contract list, generation workflow, and PDF actions.">
      {loading && <LoadingState label="Loading contracts..." />}
      {!loading && error && <ErrorState message={error} onRetry={() => setReloadKey((v) => v + 1)} />}
      {!loading && !error && (
        <section className="space-y-4 rounded-lg border border-border-color bg-surface p-4">
          <div className="grid gap-3 md:grid-cols-4">
            <article className="rounded-md border border-border-color bg-surface-elevated p-3"><p className="text-xs text-muted">Contracts</p><p className="mt-1 text-xl font-semibold">{contractStats.total}</p></article>
            <article className="rounded-md border border-border-color bg-surface-elevated p-3"><p className="text-xs text-muted">Active</p><p className="mt-1 text-xl font-semibold">{contractStats.active}</p></article>
            <article className="rounded-md border border-border-color bg-surface-elevated p-3"><p className="text-xs text-muted">Draft</p><p className="mt-1 text-xl font-semibold">{contractStats.draft}</p></article>
            <article className="rounded-md border border-border-color bg-surface-elevated p-3"><p className="text-xs text-muted">Contract Value</p><p className="mt-1 text-xl font-semibold">{formatCurrency(contractStats.value)}</p></article>
          </div>
          <div className="rounded-md border border-border-color bg-surface-elevated p-3">
            <p className="mb-2 text-sm font-medium">Admin PIN (Sensitive Actions)</p>
            <div className="flex flex-wrap items-center gap-2">
              <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Enter admin PIN" className="rounded-md border border-border-color bg-surface px-3 py-2 text-sm outline-none focus:border-foreground" />
              <button type="button" onClick={onVerifyPin} disabled={pinLoading} className="rounded-md border border-border-color bg-surface px-3 py-2 text-sm">{pinLoading ? "Verifying..." : "Verify PIN"}</button>
              <span className="text-xs text-muted">{pinVerified ? "Verified: delete actions unlocked" : "Not verified"}</span>
            </div>
            {pinError && <p className="mt-2 text-xs text-muted">{pinError}</p>}
          </div>
          {contracts.length === 0 ? (
            <EmptyState title="No contracts found" description="Generate contracts in mobile or backend first, then refresh this page." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead><tr className="border-b border-border-color text-left text-muted">
                  <th className="px-3 py-2 font-medium">Title</th><th className="px-3 py-2 font-medium">Tenant</th><th className="px-3 py-2 font-medium">Property</th><th className="px-3 py-2 font-medium">Start</th><th className="px-3 py-2 font-medium">End</th><th className="px-3 py-2 font-medium">Amount</th><th className="px-3 py-2 font-medium">Status</th><th className="px-3 py-2 font-medium">Actions</th>
                </tr></thead>
                <tbody>{contracts.map((row) => (
                  <tr key={row.id} className="border-b border-border-color/60">
                    <td className="px-3 py-3 font-medium">{row.title}</td>
                    <td className="px-3 py-3 text-muted">{row.tenantName}</td>
                    <td className="px-3 py-3 text-muted">{row.propertyName}</td>
                    <td className="px-3 py-3 text-muted">{row.startDate}</td>
                    <td className="px-3 py-3 text-muted">{row.endDate}</td>
                    <td className="px-3 py-3 text-muted">{formatCurrency(row.amount)}</td>
                    <td className="px-3 py-3"><span className="rounded-full border border-border-color bg-surface-elevated px-2 py-1 text-xs text-muted capitalize">{row.status}</span></td>
                    <td className="px-3 py-3"><div className="flex flex-wrap gap-2">
                      <button type="button" className="rounded-md border border-border-color px-2 py-1 text-xs text-muted">View PDF</button>
                      <button type="button" className="rounded-md border border-border-color px-2 py-1 text-xs text-muted">Share</button>
                      <button type="button" disabled={!pinVerified} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted disabled:opacity-50">Delete</button>
                    </div></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </ModulePage>
  );
}
