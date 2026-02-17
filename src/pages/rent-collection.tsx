import { useEffect, useMemo, useState } from "react";
import { ModulePage } from "@/components/module-page";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { Modal } from "@/components/modal";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

type RentTenantRow = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  propertyId: string | null;
  propertyName: string;
};

const emptyPaymentForm = {
  paymentDate: new Date().toISOString().slice(0, 10),
  amountPaid: 0,
  paidMonth: new Date().toISOString().slice(0, 7),
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function RentCollectionPage() {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<RentTenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [selectedTenant, setSelectedTenant] = useState<RentTenantRow | null>(null);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const { data, error: tenantsError } = await supabase
          .from("tenants")
          .select("id, full_name, phone, email, property_id, properties(name)")
          .order("full_name", { ascending: true });

        if (tenantsError) throw tenantsError;

        if (!cancelled) {
          const mapped = (data ?? []).map((row) => ({
            id: String(row.id ?? ""),
            fullName: String(row.full_name ?? "Unnamed Tenant"),
            phone: String(row.phone ?? "-"),
            email: String(row.email ?? "-"),
            propertyId: row.property_id ? String(row.property_id) : null,
            propertyName: String((row.properties as { name?: string } | null)?.name ?? "Unassigned"),
          }));
          setTenants(mapped);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load tenants for rent collection.");
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

  const assignedCount = useMemo(
    () => tenants.filter((tenant) => Boolean(tenant.propertyId)).length,
    [tenants],
  );

  const unassignedCount = tenants.length - assignedCount;

  const reload = () => setReloadKey((value) => value + 1);

  const openRecordModal = (tenant: RentTenantRow) => {
    if (!tenant.propertyId) {
      return;
    }

    setSelectedTenant(tenant);
    setPaymentForm({
      paymentDate: new Date().toISOString().slice(0, 10),
      amountPaid: 0,
      paidMonth: new Date().toISOString().slice(0, 7),
    });
  };

  const onSavePayment = async () => {
    if (!selectedTenant?.propertyId) {
      return;
    }

    if (!paymentForm.amountPaid || paymentForm.amountPaid <= 0) {
      alert("Enter a valid payment amount.");
      return;
    }

    if (!paymentForm.paymentDate || !paymentForm.paidMonth) {
      alert("Select payment date and paid month.");
      return;
    }

    setSaving(true);

    try {
      const monthLabel = `${paymentForm.paidMonth}-01`;

      const { data: insertedPayment, error: paymentError } = await supabase
        .from("tenant_rent_payments")
        .insert({
          tenant_id: selectedTenant.id,
          payment_date: paymentForm.paymentDate,
          amount_paid: paymentForm.amountPaid,
          paid_months: [monthLabel],
        })
        .select("id")
        .single();

      if (paymentError) {
        throw paymentError;
      }

      const actorName = user?.email ?? "Admin";

      const { error: auditError } = await supabase.from("audit_log").insert({
        user_email: user?.email ?? null,
        user_name: actorName,
        action: "rent_payment_recorded",
        entity_type: "tenant_rent_payment",
        entity_id: insertedPayment?.id ?? null,
        entity_name: selectedTenant.fullName,
        details: {
          tenant_id: selectedTenant.id,
          property_id: selectedTenant.propertyId,
          amount_paid: paymentForm.amountPaid,
          payment_date: paymentForm.paymentDate,
          paid_month: paymentForm.paidMonth,
        },
      });

      if (auditError) {
        throw auditError;
      }

      setSelectedTenant(null);
      reload();
    } catch (saveError) {
      alert(saveError instanceof Error ? saveError.message : "Could not record rent payment.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ModulePage
      title="Rent Collection"
      description="Record rent payments for assigned tenants. Unassigned tenants must be assigned first."
    >
      {loading && <LoadingState label="Loading tenants..." />}

      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && (
        <section className="space-y-4 rounded-lg border border-border-color bg-surface p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <article className="rounded-lg border border-border-color bg-surface-elevated p-3">
              <p className="text-xs text-muted">Total Tenants</p>
              <p className="mt-1 text-xl font-semibold">{tenants.length}</p>
            </article>
            <article className="rounded-lg border border-border-color bg-surface-elevated p-3">
              <p className="text-xs text-muted">Assigned (Clickable)</p>
              <p className="mt-1 text-xl font-semibold">{assignedCount}</p>
            </article>
            <article className="rounded-lg border border-border-color bg-surface-elevated p-3">
              <p className="text-xs text-muted">Unassigned</p>
              <p className="mt-1 text-xl font-semibold">{unassignedCount}</p>
            </article>
          </div>

          {tenants.length === 0 ? (
            <EmptyState
              title="No tenants found"
              description="Add tenants first, then assign them to properties to enable rent collection."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border-color text-left text-muted">
                    <th className="px-3 py-2 font-medium">Tenant</th>
                    <th className="px-3 py-2 font-medium">Property</th>
                    <th className="px-3 py-2 font-medium">Contact</th>
                    <th className="px-3 py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((tenant) => {
                    const assigned = Boolean(tenant.propertyId);
                    return (
                      <tr key={tenant.id} className="border-b border-border-color/60">
                        <td className="px-3 py-3 font-medium">{tenant.fullName}</td>
                        <td className="px-3 py-3 text-muted">{tenant.propertyName}</td>
                        <td className="px-3 py-3 text-muted">{tenant.phone}</td>
                        <td className="px-3 py-3">
                          {assigned ? (
                            <button
                              type="button"
                              onClick={() => openRecordModal(tenant)}
                              className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-xs font-medium"
                            >
                              Record Rent
                            </button>
                          ) : (
                            <span className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-xs text-muted">
                              Assign to property first
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <Modal
        open={Boolean(selectedTenant)}
        onClose={() => setSelectedTenant(null)}
        title={selectedTenant ? `Record Rent: ${selectedTenant.fullName}` : "Record Rent"}
      >
        <div className="space-y-3">
          <div className="rounded-md border border-border-color bg-surface-elevated p-3 text-sm text-muted">
            <p>Property: {selectedTenant?.propertyName ?? "-"}</p>
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Payment Date</label>
            <input
              type="date"
              value={paymentForm.paymentDate}
              onChange={(event) =>
                setPaymentForm((prev) => ({ ...prev, paymentDate: event.target.value }))
              }
              className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Paid Month</label>
            <input
              type="month"
              value={paymentForm.paidMonth}
              onChange={(event) =>
                setPaymentForm((prev) => ({ ...prev, paidMonth: event.target.value }))
              }
              className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Amount (ZAR)</label>
            <input
              type="number"
              min={0}
              value={paymentForm.amountPaid}
              onChange={(event) =>
                setPaymentForm((prev) => ({ ...prev, amountPaid: Number(event.target.value) }))
              }
              className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none"
            />
          </div>

          <div className="rounded-md border border-border-color bg-surface-elevated p-3 text-sm">
            <p className="text-xs text-muted">Preview</p>
            <p className="mt-1 font-medium">{formatCurrency(paymentForm.amountPaid || 0)}</p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setSelectedTenant(null)}
              className="rounded-md border border-border-color px-3 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSavePayment}
              disabled={saving}
              className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Saving..." : "Record Payment"}
            </button>
          </div>
        </div>
      </Modal>
    </ModulePage>
  );
}
