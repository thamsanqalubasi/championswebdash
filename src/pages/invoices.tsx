import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { Modal, ConfirmDialog } from "@/components/modal";
import { fetchInvoicesData } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { fetchCompanyInfo, fetchAdminInfo } from "@/lib/storage";
import { buildProfessionalInvoiceHtml, buildUnifiedInvoiceHtml } from "@/lib/document-templates";
import type { InvoiceRow } from "@/lib/types";

type PeriodFilter = "this_month" | "last_2_months" | "last_3_months";

type RentPaymentTransaction = {
  id: string;
  tenantId: string;
  tenantName: string;
  propertyId: string;
  propertyName: string;
  paymentDate: string;
  amountPaid: number;
  collectorName: string;
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function monthStartOffset(monthOffset: number) {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() - monthOffset, 1);
}

function toMonthKey(dateString: string) {
  return String(dateString).slice(0, 7);
}

async function openUnifiedInvoiceDocument(
  transactions: RentPaymentTransaction[],
  userEmail?: string,
) {
  const previewWindow = window.open("about:blank", "_blank");
  if (!previewWindow) {
    alert("Please allow popups to view unified invoice.");
    return;
  }

  try {
    const [company, admin] = await Promise.all([
      fetchCompanyInfo(),
      fetchAdminInfo(userEmail),
    ]);

    const html = buildUnifiedInvoiceHtml(
      {
        collectorName: transactions[0]?.collectorName ?? "Admin",
        transactions: transactions.map((t) => ({
          paymentDate: t.paymentDate,
          tenantName: t.tenantName,
          propertyName: t.propertyName,
          amountPaid: t.amountPaid,
        })),
      },
      company,
      admin,
    );

    previewWindow.document.open();
    previewWindow.document.write(html);
    previewWindow.document.close();
  } catch (e) {
    alert(e instanceof Error ? e.message : "Could not generate unified invoice.");
    previewWindow.close();
  }
}

export default function InvoicesPage() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [activeFilter, setActiveFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<InvoiceRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("this_month");
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactions, setTransactions] = useState<RentPaymentTransaction[]>([]);
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);

  const INVOICES_PAGE_SIZE = 8;
  const [invoicesLimit, setInvoicesLimit] = useState(INVOICES_PAGE_SIZE);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchInvoicesData();
        if (!cancelled) {
          setInvoices(result);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load invoices.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (!modalOpen) {
      return;
    }

    let cancelled = false;

    async function loadTransactions() {
      setTransactionsLoading(true);

      try {
        const offset = periodFilter === "this_month" ? 0 : periodFilter === "last_2_months" ? 1 : 2;
        const fromDate = monthStartOffset(offset).toISOString().slice(0, 10);
        const toDate = new Date().toISOString().slice(0, 10);

        const { data: payments, error: paymentsError } = await supabase
          .from("tenant_rent_payments")
          .select("id, tenant_id, payment_date, amount_paid, tenants(full_name, property_id, properties(name))")
          .gte("payment_date", fromDate)
          .lte("payment_date", toDate)
          .order("payment_date", { ascending: false });

        if (paymentsError) throw paymentsError;

        const paymentIds = (payments ?? []).map((row) => String(row.id ?? "")).filter(Boolean);

        let collectorNameByPaymentId = new Map<string, string>();

        if (paymentIds.length) {
          const { data: auditRows, error: auditError } = await supabase
            .from("audit_log")
            .select("entity_id, user_name, user_email, created_at")
            .eq("entity_type", "tenant_rent_payment")
            .eq("action", "rent_payment_recorded")
            .in("entity_id", paymentIds)
            .order("created_at", { ascending: false });

          if (auditError) throw auditError;

          collectorNameByPaymentId = new Map<string, string>();
          (auditRows ?? []).forEach((row) => {
            const entityId = String(row.entity_id ?? "");
            if (!entityId || collectorNameByPaymentId.has(entityId)) {
              return;
            }

            collectorNameByPaymentId.set(
              entityId,
              String(row.user_name ?? row.user_email ?? "Admin"),
            );
          });
        }

        if (!cancelled) {
          const mappedRows: RentPaymentTransaction[] = (payments ?? [])
            .map((row) => {
              const tenant = row.tenants as
                | { full_name?: string; property_id?: string; properties?: { name?: string } | null }
                | null;

              const propertyId = tenant?.property_id ? String(tenant.property_id) : "";

              return {
                id: String(row.id ?? ""),
                tenantId: String(row.tenant_id ?? ""),
                tenantName: String(tenant?.full_name ?? "Unknown Tenant"),
                propertyId,
                propertyName: String(tenant?.properties?.name ?? "Unassigned"),
                paymentDate: String(row.payment_date ?? "-"),
                amountPaid: Number(row.amount_paid ?? 0),
                collectorName: collectorNameByPaymentId.get(String(row.id ?? "")) ?? "Admin",
              };
            })
            .filter((row) => Boolean(row.id) && Boolean(row.tenantId) && Boolean(row.propertyId));

          setTransactions(mappedRows);
          setSelectedTransactionIds([]);
        }
      } catch (transactionError) {
        if (!cancelled) {
          alert(transactionError instanceof Error ? transactionError.message : "Could not load rent payment transactions.");
          setTransactions([]);
          setSelectedTransactionIds([]);
        }
      } finally {
        if (!cancelled) {
          setTransactionsLoading(false);
        }
      }
    }

    void loadTransactions();

    return () => {
      cancelled = true;
    };
  }, [modalOpen, periodFilter]);

  const reload = () => setReloadKey((value) => value + 1);

  const counts = useMemo(
    () => ({
      all: invoices.length,
      paid: invoices.filter((item) => item.status === "paid").length,
      sent: invoices.filter((item) => item.status === "sent").length,
      overdue: invoices.filter((item) => item.status === "overdue").length,
      draft: invoices.filter((item) => item.status === "draft").length,
    }),
    [invoices],
  );

  const totalAmount = useMemo(() => invoices.reduce((sum, item) => sum + item.totalAmount, 0), [invoices]);
  const totalPaid = useMemo(
    () => invoices.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.totalAmount, 0),
    [invoices],
  );
  const totalOutstanding = totalAmount - totalPaid;

  const filtered = useMemo(
    () => (activeFilter === "all" ? invoices : invoices.filter((item) => item.status === activeFilter)),
    [invoices, activeFilter],
  );

  const selectedTransactions = useMemo(
    () => transactions.filter((row) => selectedTransactionIds.includes(row.id)),
    [transactions, selectedTransactionIds],
  );

  const selectedCollector = useMemo(
    () => selectedTransactions[0]?.collectorName ?? "",
    [selectedTransactions],
  );

  const toggleTransaction = (transaction: RentPaymentTransaction) => {
    const alreadySelected = selectedTransactionIds.includes(transaction.id);

    if (alreadySelected) {
      setSelectedTransactionIds((prev) => prev.filter((id) => id !== transaction.id));
      return;
    }

    setSelectedTransactionIds((prev) => [...prev, transaction.id]);
  };

  const openGenerateModal = () => {
    setPeriodFilter("this_month");
    setModalOpen(true);
  };

  const onGenerateFromSelection = async () => {
    if (selectedTransactions.length === 0) {
      alert("Select at least one transaction.");
      return;
    }

    setGenerating(true);

    try {
      if (selectedTransactions.length === 1) {
        const transaction = selectedTransactions[0];
        const month = toMonthKey(transaction.paymentDate);

        const { data: existingInvoice, error: existingError } = await supabase
          .from("invoices")
          .select("id")
          .eq("tenant_id", transaction.tenantId)
          .eq("property_id", transaction.propertyId)
          .eq("month", month)
          .limit(1)
          .maybeSingle();

        if (existingError) throw existingError;

        if (existingInvoice?.id) {
          alert("Invoice already exists for this tenant and month. Duplicate generation blocked.");
          return;
        }

        const { error: createError } = await supabase.from("invoices").insert({
          tenant_id: transaction.tenantId,
          property_id: transaction.propertyId,
          month,
          due_date: transaction.paymentDate,
          total_amount: transaction.amountPaid,
          status: "paid",
        });

        if (createError) throw createError;

        setModalOpen(false);
        reload();
        return;
      }

      openUnifiedInvoiceDocument(selectedTransactions, user?.email ?? undefined);

      const totalAmountPaid = selectedTransactions.reduce((sum, row) => sum + row.amountPaid, 0);

      const { error: auditError } = await supabase.from("audit_log").insert({
        action: "unified_invoice_generated",
        entity_type: "tenant_rent_payment",
        entity_name: selectedCollector,
        details: {
          transaction_ids: selectedTransactions.map((row) => row.id),
          collector_name: selectedCollector,
          total_amount_paid: totalAmountPaid,
          period_filter: periodFilter,
        },
      });

      if (auditError) throw auditError;
    } catch (generateError) {
      alert(generateError instanceof Error ? generateError.message : "Could not generate invoice from selection.");
    } finally {
      setGenerating(false);
    }
  };

  const onStatusChange = async (id: string, status: string) => {
    const { error: updateError } = await supabase.from("invoices").update({ status }).eq("id", id);
    if (updateError) {
      alert(updateError.message);
      return;
    }
    reload();
  };

  const onDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);

    try {
      const { error: deleteError } = await supabase.from("invoices").delete().eq("id", deleteTarget.id);
      if (deleteError) throw deleteError;
      setDeleteTarget(null);
      reload();
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const viewInvoice = async (row: InvoiceRow) => {
    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) { alert("Please allow popups to view invoice."); return; }

    try {
      // Check for stored HTML in the DB
      const { data: invoiceData } = await supabase
        .from("invoices")
        .select("pdf_url")
        .eq("id", row.id)
        .maybeSingle();

      const pdfUrl = String(invoiceData?.pdf_url ?? "");

      if (pdfUrl.startsWith("<")) {
        previewWindow.document.open();
        previewWindow.document.write(pdfUrl);
        previewWindow.document.close();
        return;
      }

      if (pdfUrl.startsWith("http")) {
        previewWindow.location.href = pdfUrl;
        return;
      }

      // Generate fresh professional invoice
      const { data: items } = await supabase
        .from("invoice_items")
        .select("description, amount")
        .eq("invoice_id", row.id);

      const [company, admin] = await Promise.all([
        fetchCompanyInfo(),
        fetchAdminInfo(user?.email ?? undefined),
      ]);

      const lineItems = (items ?? []).map((item) => ({
        description: String(item.description ?? ""),
        amount: Number(item.amount ?? 0),
      }));

      if (lineItems.length === 0) {
        lineItems.push({ description: `Rent payment for ${row.month}`, amount: row.totalAmount });
      }

      const html = buildProfessionalInvoiceHtml(
        {
          invoiceId: row.id,
          tenantName: row.tenantName,
          propertyName: row.propertyName,
          month: row.month,
          dueDate: row.dueDate,
          status: row.status,
          lineItems,
        },
        company,
        admin,
      );

      // Save for future use
      await supabase.from("invoices").update({ pdf_url: html }).eq("id", row.id);

      previewWindow.document.open();
      previewWindow.document.write(html);
      previewWindow.document.close();
    } catch (viewError) {
      alert(viewError instanceof Error ? viewError.message : "Could not view invoice.");
      previewWindow.close();
    }
  };

  const exportCSV = () => {
    const header = "Tenant,Property,Month,Due Date,Amount,Status";
    const rows = filtered.map(
      (item) =>
        `"${item.tenantName}","${item.propertyName}","${item.month}","${item.dueDate}","${item.totalAmount}","${item.status}"`,
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "invoices.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <ModulePage
      title="Invoices"
      description="Generate invoices from rent collections, filter by period, and review collector-based transactions."
    >
      {loading && <LoadingState label="Loading invoices..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && (
        <section className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border-color bg-surface p-4">
              <p className="text-sm text-muted">Total Invoiced</p>
              <p className="text-2xl font-bold">{formatCurrency(totalAmount)}</p>
            </div>
            <div className="rounded-lg border border-border-color bg-surface p-4">
              <p className="text-sm text-muted">Total Paid</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totalPaid)}</p>
            </div>
            <div className="rounded-lg border border-border-color bg-surface p-4">
              <p className="text-sm text-muted">Outstanding</p>
              <p className="text-2xl font-bold text-red-500">{formatCurrency(totalOutstanding)}</p>
            </div>
          </div>

          <div className="space-y-4 rounded-lg border border-border-color bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {(["all", "paid", "sent", "overdue", "draft"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveFilter(key)}
                    className={`rounded-md border border-border-color px-3 py-2 text-sm ${
                      activeFilter === key ? "bg-surface-elevated font-medium" : "text-muted"
                    }`}
                  >
                    {key === "all" ? `All (${counts.all})` : `${key.charAt(0).toUpperCase() + key.slice(1)} (${counts[key]})`}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={exportCSV}
                  className="rounded-md border border-border-color px-3 py-2 text-sm text-muted hover:bg-surface-elevated"
                >
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={openGenerateModal}
                  className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium"
                >
                  Generate Invoice
                </button>
              </div>
            </div>

            {filtered.length === 0 ? (
              <EmptyState title="No invoices found" description="Generate invoices from rent payments to get started." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border-color text-left text-muted">
                      <th className="px-3 py-2 font-medium">Tenant</th>
                      <th className="px-3 py-2 font-medium">Property</th>
                      <th className="px-3 py-2 font-medium">Month</th>
                      <th className="px-3 py-2 font-medium">Due Date</th>
                      <th className="px-3 py-2 font-medium">Amount</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                      <th className="px-3 py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0, invoicesLimit).map((row) => (
                      <tr key={row.id} className="border-b border-border-color/60">
                        <td className="px-3 py-3 font-medium">{row.tenantName}</td>
                        <td className="px-3 py-3 text-muted">{row.propertyName}</td>
                        <td className="px-3 py-3 text-muted">{row.month}</td>
                        <td className="px-3 py-3 text-muted">{row.dueDate}</td>
                        <td className="px-3 py-3 text-muted">{formatCurrency(row.totalAmount)}</td>
                        <td className="px-3 py-3">
                          <span
                            className={`rounded-full border px-2 py-1 text-xs capitalize ${
                              row.status === "paid"
                                ? "border-green-500/30 bg-green-500/10 text-green-600"
                                : row.status === "overdue"
                                  ? "border-red-500/30 bg-red-500/10 text-red-600"
                                  : "border-border-color bg-surface-elevated text-muted"
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void viewInvoice(row)}
                              className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated"
                            >
                              View
                            </button>
                            {row.status !== "paid" && (
                              <button
                                type="button"
                                onClick={() => onStatusChange(row.id, "paid")}
                                className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated"
                              >
                                Mark Paid
                              </button>
                            )}
                            {row.status === "sent" && (
                              <button
                                type="button"
                                onClick={() => onStatusChange(row.id, "overdue")}
                                className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated"
                              >
                                Mark Overdue
                              </button>
                            )}
                            {row.status === "draft" && (
                              <button
                                type="button"
                                onClick={() => onStatusChange(row.id, "sent")}
                                className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated"
                              >
                                Send
                              </button>
                            )}
                            {row.status === "paid" && (
                              <button
                                type="button"
                                onClick={() => onStatusChange(row.id, "sent")}
                                className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated"
                              >
                                Revert
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(row)}
                              className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length > invoicesLimit && (
                  <button type="button" onClick={() => setInvoicesLimit((v) => v + INVOICES_PAGE_SIZE)} className="mt-2 w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm text-muted hover:bg-surface">
                    Load More ({filtered.length - invoicesLimit} remaining)
                  </button>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Generate Invoice from Rent Payments">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-muted">Payment Period</label>
            <select
              value={periodFilter}
              onChange={(event) => setPeriodFilter(event.target.value as PeriodFilter)}
              className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm"
            >
              <option value="this_month">This month</option>
              <option value="last_2_months">Last 2 months</option>
              <option value="last_3_months">Last 3 months</option>
            </select>
          </div>

          {transactionsLoading ? (
            <LoadingState label="Loading payment transactions..." />
          ) : transactions.length === 0 ? (
            <EmptyState title="No transactions found" description="No rent payments in the selected period." />
          ) : (
            <div className="max-h-80 overflow-y-auto rounded-md border border-border-color">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border-color text-left text-muted">
                    <th className="px-3 py-2 font-medium">Select</th>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Tenant</th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                    <th className="px-3 py-2 font-medium">Collected By</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => {
                    const checked = selectedTransactionIds.includes(transaction.id);

                    return (
                      <tr key={transaction.id} className="border-b border-border-color/60">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleTransaction(transaction)}
                          />
                        </td>
                        <td className="px-3 py-2 text-muted">{transaction.paymentDate}</td>
                        <td className="px-3 py-2">
                          <p className="font-medium">{transaction.tenantName}</p>
                          <p className="text-xs text-muted">{transaction.propertyName}</p>
                        </td>
                        <td className="px-3 py-2 text-muted">{formatCurrency(transaction.amountPaid)}</td>
                        <td className="px-3 py-2 text-muted">{transaction.collectorName}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="rounded-md border border-border-color bg-surface-elevated p-3 text-sm">
            <p className="text-muted">Selected: {selectedTransactions.length} transaction(s)</p>
            {selectedCollector ? <p className="text-muted">Collector: {selectedCollector}</p> : null}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-md border border-border-color px-3 py-2 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onGenerateFromSelection}
              disabled={generating || selectedTransactions.length === 0}
              className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              {generating ? "Generating..." : selectedTransactions.length > 1 ? "Generate Unified Invoice" : "Generate Invoice"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={onDelete}
        title="Delete Invoice"
        message={`Delete invoice for ${deleteTarget?.tenantName}?`}
        confirmLabel="Delete"
        loading={deleting}
      />
    </ModulePage>
  );
}
