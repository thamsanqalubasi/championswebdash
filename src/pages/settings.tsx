import { useEffect, useState } from "react";
import { ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { fetchSettingsData, verifyAdminPin } from "@/lib/data";
import type { SettingsData } from "@/lib/types";

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
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
      try { const result = await fetchSettingsData(); if (!cancelled) setData(result); }
      catch (loadError) { if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load settings."); }
      finally { if (!cancelled) setLoading(false); }
    }
    void loadData();
    return () => { cancelled = true; };
  }, [reloadKey]);

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
    <ModulePage title="Settings" description="Company profile, admin profile, invoice settings, and security controls.">
      {loading && <LoadingState label="Loading settings..." />}
      {!loading && error && <ErrorState message={error} onRetry={() => setReloadKey((v) => v + 1)} />}
      {!loading && !error && data && (
        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-lg border border-border-color bg-surface p-4">
            <h3 className="mb-3 text-base font-semibold">Admin Profile</h3>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-muted">Full Name</dt><dd>{data.adminProfile.fullName}</dd></div>
              <div><dt className="text-muted">Email</dt><dd>{data.adminProfile.email}</dd></div>
              <div><dt className="text-muted">Signature</dt><dd className="break-all text-muted">{data.adminProfile.signatureUrl || "No signature uploaded"}</dd></div>
            </dl>
          </section>
          <section className="rounded-lg border border-border-color bg-surface p-4">
            <h3 className="mb-3 text-base font-semibold">Company Profile</h3>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-muted">Company Name</dt><dd>{data.companyProfile.companyName}</dd></div>
              <div><dt className="text-muted">Address</dt><dd>{data.companyProfile.address}</dd></div>
              <div><dt className="text-muted">Logo</dt><dd className="break-all text-muted">{data.companyProfile.logoUrl || "No logo uploaded"}</dd></div>
            </dl>
          </section>
          <section className="rounded-lg border border-border-color bg-surface p-4">
            <h3 className="mb-3 text-base font-semibold">Invoice Settings</h3>
            <dl className="space-y-2 text-sm">
              <div><dt className="text-muted">Tax Rate</dt><dd>{data.invoiceSettings.taxRate}%</dd></div>
              <div><dt className="text-muted">Default Due Day</dt><dd>{data.invoiceSettings.defaultDueDay || "-"}</dd></div>
              <div><dt className="text-muted">Payment Instructions</dt><dd>{data.invoiceSettings.paymentInstructions}</dd></div>
            </dl>
          </section>
          <section className="rounded-lg border border-border-color bg-surface p-4">
            <h3 className="mb-3 text-base font-semibold">Security</h3>
            <p className="mb-3 text-sm text-muted">Active admin PIN: {data.security.activePinExists ? "Configured" : "Not configured"}</p>
            <div className="flex flex-wrap items-center gap-2">
              <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Enter admin PIN" className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-foreground" />
              <button type="button" onClick={onVerifyPin} disabled={pinLoading} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm">{pinLoading ? "Verifying..." : "Verify PIN"}</button>
              <button type="button" disabled={!pinVerified} className="rounded-md border border-border-color px-3 py-2 text-sm text-muted disabled:opacity-50">Rotate PIN</button>
            </div>
            {pinError && <p className="mt-2 text-xs text-muted">{pinError}</p>}
            <p className="mt-2 text-xs text-muted">{pinVerified ? "PIN verified for sensitive actions." : "Sensitive actions remain locked."}</p>
          </section>
        </div>
      )}
    </ModulePage>
  );
}
