import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { ModulePage } from "@/components/module-page";
import { Modal, ConfirmDialog } from "@/components/modal";
import { fetchInvoicesData, isValidUuid } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { fetchCompanyInfo, fetchAdminInfo, downloadPdfDocument, downloadPdfFromUrl } from "@/lib/storage";
import { buildProfessionalInvoiceHtml, buildUnifiedInvoiceHtml } from "@/lib/document-templates";
import type { InvoiceRow } from "@/lib/types";
import { DocumentShareModal } from "@/components/document-share-modal";
import { Mail, Download, FileText, Send, Info, X } from "lucide-react";

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
    currency: "NAD",
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
  const { user, currentCompany } = useAuth();
  const { format: formatCurrency } = useCurrency();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [activeFilter, setActiveFilter] = useState("all");
  const [activeInfoId, setActiveInfoId] = useState<string | null>(null);
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
  const [shareModalDoc, setShareModalDoc] = useState<{
    isOpen: boolean;
    documentTitle: string;
    documentType: string;
    documentHtml?: string;
    documentUrl?: string;
    fileNameBase?: string;
    ownerName?: string;
    ownerEmail?: string;
    defaultSubject?: string;
    defaultMessage?: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchInvoicesData(currentCompany?.id);
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
  }, [reloadKey, currentCompany?.id]);

  useEffect(() => {
    if (!modalOpen) {
      return;
    }

    let cancelled = false;

    async function loadTransactions() {
      setTransactionsLoading(true);

      try {
        const compId = currentCompany?.id;
        const offset = periodFilter === "this_month" ? 0 : periodFilter === "last_2_months" ? 1 : 2;
        const fromDate = monthStartOffset(offset).toISOString().slice(0, 10);
        const toDate = new Date().toISOString().slice(0, 10);

        let pQuery = supabase
          .from("tenant_rent_payments")
          .select("id, tenant_id, payment_date, amount_paid, notes, is_suppressed, tenants(full_name, property_id, properties(name))")
          .gte("payment_date", fromDate)
          .lte("payment_date", toDate)
          .order("payment_date", { ascending: false });

        if (compId && isValidUuid(compId)) {
          pQuery = pQuery.or(`company_id.eq.${compId},company_id.is.null`);
        }

        const { data: rawPayments, error: paymentsError } = await pQuery;

        if (paymentsError) throw paymentsError;

        const payments = (rawPayments ?? []).filter(
          (row: any) => !row.is_suppressed && !(row.notes && String(row.notes).includes("[SUPPRESSED"))
        );

        const paymentIds = payments.map((row) => String(row.id ?? "")).filter(Boolean);

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
          const mappedRows: RentPaymentTransaction[] = payments
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
      all: invoices.filter((item) => item.status !== "suppressed" && !item.isSuppressed).length,
      paid: invoices.filter((item) => item.status === "paid" && !item.isSuppressed).length,
      sent: invoices.filter((item) => item.status === "sent" && !item.isSuppressed).length,
      overdue: invoices.filter((item) => item.status === "overdue" && !item.isSuppressed).length,
      draft: invoices.filter((item) => item.status === "draft" && !item.isSuppressed).length,
      suppressed: invoices.filter((item) => item.status === "suppressed" || Boolean(item.isSuppressed)).length,
    }),
    [invoices],
  );

  const activeInvoices = useMemo(() => invoices.filter((item) => item.status !== "suppressed" && !item.isSuppressed), [invoices]);
  const totalAmount = useMemo(() => activeInvoices.reduce((sum, item) => sum + item.totalAmount, 0), [activeInvoices]);
  const totalPaid = useMemo(
    () => activeInvoices.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.totalAmount, 0),
    [activeInvoices],
  );
  const totalOutstanding = totalAmount - totalPaid;

  const filtered = useMemo(
    () => {
      if (activeFilter === "all") {
        return invoices.filter((item) => item.status !== "suppressed" && !item.isSuppressed);
      }
      if (activeFilter === "suppressed") {
        return invoices.filter((item) => item.status === "suppressed" || Boolean(item.isSuppressed));
      }
      return invoices.filter((item) => item.status === activeFilter && !item.isSuppressed);
    },
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
          .neq("status", "suppressed")
          .limit(1)
          .maybeSingle();

        if (existingError) throw existingError;

        if (existingInvoice?.id) {
          alert("Invoice already exists for this tenant and month. Duplicate generation blocked.");
          return;
        }

        const compId = currentCompany?.id && isValidUuid(currentCompany.id) ? currentCompany.id : null;
        const actorName = user?.user_metadata?.full_name || user?.email || "Admin";

        const { data: createdInv, error: createError } = await supabase
          .from("invoices")
          .insert({
            tenant_id: transaction.tenantId,
            property_id: transaction.propertyId,
            month,
            due_date: transaction.paymentDate,
            total_amount: transaction.amountPaid,
            status: "paid",
            company_id: compId,
          })
          .select("id")
          .maybeSingle();

        if (createError) throw createError;

        await supabase.from("audit_log").insert({
          user_email: user?.email || "admin@paimbabook.com",
          user_name: actorName,
          action: "invoice_generated",
          entity_type: "invoice",
          entity_id: createdInv?.id,
          company_id: compId,
          details: {
            tenant_name: transaction.tenantName,
            property_name: transaction.propertyName,
            month,
            amount: transaction.amountPaid,
            collector_name: transaction.collectorName,
            payment_date: transaction.paymentDate,
          },
        });

        setModalOpen(false);
        reload();
        return;
      }

      openUnifiedInvoiceDocument(selectedTransactions, user?.email ?? undefined);

      const totalAmountPaid = selectedTransactions.reduce((sum, row) => sum + row.amountPaid, 0);
      const compId = currentCompany?.id && isValidUuid(currentCompany.id) ? currentCompany.id : null;
      const actorName = user?.user_metadata?.full_name || user?.email || "Admin";

      const { error: auditError } = await supabase.from("audit_log").insert({
        user_email: user?.email || "admin@paimbabook.com",
        user_name: actorName,
        action: "unified_invoice_generated",
        entity_type: "tenant_rent_payment",
        company_id: compId,
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

  const handleSuppressInvoice = async (row: InvoiceRow) => {
    const reason = window.prompt(
      `Suppress invoice for ${row.tenantName} (${row.month})?\n\n` +
      `• Suppressed invoices remain in system audit logs and records.\n` +
      `• The invoice will no longer be shareable or active.\n` +
      `• This allows generating a new, corrected invoice for ${row.month}.\n\n` +
      `Enter suppression reason:`,
      "Suppressed by staff for correction/regeneration"
    );
    if (reason === null) return;

    try {
      const actorName = user?.user_metadata?.full_name || user?.email || "Admin";
      const compId = currentCompany?.id && isValidUuid(currentCompany.id) ? currentCompany.id : null;

      try {
        await supabase
          .from("invoices")
          .update({
            status: "suppressed",
            is_suppressed: true,
            suppressed_at: new Date().toISOString(),
            suppressed_by: actorName,
            suppressed_reason: reason,
          })
          .eq("id", row.id);
      } catch {
        await supabase
          .from("invoices")
          .update({ status: "suppressed" })
          .eq("id", row.id);
      }

      await supabase.from("audit_log").insert({
        user_email: user?.email || "admin@paimbabook.com",
        user_name: actorName,
        action: "invoice_suppressed",
        entity_type: "invoice",
        entity_id: row.id,
        company_id: compId,
        details: {
          invoice_id: row.id,
          tenant_name: row.tenantName,
          month: row.month,
          amount: row.totalAmount,
          reason,
        },
      });

      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to suppress invoice.");
    }
  };

  const handleUnsuppressInvoice = async (row: InvoiceRow) => {
    try {
      const { error: updateError } = await supabase
        .from("invoices")
        .update({ status: "sent" })
        .eq("id", row.id);

      if (updateError) throw updateError;
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to restore invoice.");
    }
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

  const getInvoiceHtmlAndUrl = async (row: InvoiceRow): Promise<{ html: string; url: string; tenantEmail: string }> => {
    let html = "";
    let url = "";

    try {
      const { data: invoiceData } = await supabase
        .from("invoices")
        .select("pdf_url")
        .eq("id", row.id)
        .maybeSingle();

      const pdfUrl = String(invoiceData?.pdf_url ?? "");
      if (pdfUrl.startsWith("http")) {
        url = pdfUrl;
      } else if (pdfUrl.startsWith("<")) {
        html = pdfUrl;
      }
    } catch {
      // fallback
    }

    if (!html && !url) {
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

      html = buildProfessionalInvoiceHtml(
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
        admin
      );

      try {
        await supabase.from("invoices").update({ pdf_url: html }).eq("id", row.id);
      } catch {
        // ignore
      }
    }

    let tenantEmail = "";
    if (row.tenantId) {
      try {
        const { data: t } = await supabase.from("tenants").select("email").eq("id", row.tenantId).maybeSingle();
        if (t?.email) tenantEmail = t.email;
      } catch {
        // ignore
      }
    } else if (row.tenantName) {
      try {
        const { data: t } = await supabase.from("tenants").select("email").ilike("name", row.tenantName).maybeSingle();
        if (t?.email) tenantEmail = t.email;
      } catch {
        // ignore
      }
    }

    return { html, url, tenantEmail };
  };

  const handleOpenShare = async (row: InvoiceRow) => {
    const { html, url, tenantEmail } = await getInvoiceHtmlAndUrl(row);
    setShareModalDoc({
      isOpen: true,
      documentTitle: `Invoice #${row.id.slice(0, 8)} (${row.month})`,
      documentType: "Invoice",
      documentHtml: html,
      documentUrl: url,
      fileNameBase: `invoice-${row.tenantName.replace(/\s+/g, "_")}-${row.month}`,
      ownerName: row.tenantName,
      ownerEmail: tenantEmail,
      defaultSubject: `Invoice ${row.month} - ${row.propertyName || currentCompany?.name || "Paimbabook"}`,
      defaultMessage: `Dear ${row.tenantName},\n\nPlease find your official rental invoice for ${row.month} in the amount of ${formatCurrency(row.totalAmount)} attached as a PDF document.`,
    });
  };

  const handleDownloadRowPdf = async (row: InvoiceRow) => {
    const { html, url } = await getInvoiceHtmlAndUrl(row);
    const base = `invoice-${row.tenantName.replace(/\s+/g, "_")}-${row.month}`;
    if (url && url.startsWith("http")) {
      await downloadPdfFromUrl(url, base);
    } else if (html) {
      downloadPdfDocument(html, base);
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
                {(["all", "paid", "sent", "overdue", "draft", "suppressed"] as const).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveFilter(key)}
                    className={`rounded-md border border-border-color px-3 py-2 text-sm ${activeFilter === key ? "bg-surface-elevated font-medium" : "text-muted"
                      }`}
                  >
                    {key === "all"
                      ? `All (${counts.all})`
                      : key === "suppressed"
                        ? `Suppressed (${counts.suppressed})`
                        : `${key.charAt(0).toUpperCase() + key.slice(1)} (${counts[key]})`}
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
                    {filtered.slice(0, invoicesLimit).map((row) => {
                      const isSuppressed = row.status === "suppressed";
                      return (
                        <tr key={row.id} className={`border-b border-border-color/60 ${isSuppressed ? "opacity-75 bg-amber-500/[0.02]" : ""}`}>
                          <td className="px-3 py-3 font-medium">
                            <div className="flex items-center gap-1.5">
                              <span>{row.tenantName}</span>
                              <div className="relative inline-block">
                                <button
                                  type="button"
                                  onClick={() => setActiveInfoId(activeInfoId === row.id ? null : row.id)}
                                  className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-surface-elevated text-muted hover:text-foreground hover:bg-surface border border-border-color transition"
                                  title="View tracking & audit details"
                                >
                                  <Info size={11} />
                                </button>
                                {activeInfoId === row.id && (
                                  <div className="absolute left-0 top-6 z-50 w-72 rounded-xl border border-border-color bg-surface p-3.5 shadow-2xl text-left text-xs font-normal">
                                    <div className="flex items-center justify-between border-b border-border-color pb-1.5 mb-2">
                                      <span className="font-bold text-foreground">Invoice Audit & Tracking</span>
                                      <button
                                        type="button"
                                        onClick={() => setActiveInfoId(null)}
                                        className="text-muted hover:text-foreground p-0.5 rounded"
                                      >
                                        <X size={13} />
                                      </button>
                                    </div>

                                    <div className="space-y-2.5">
                                      <div>
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted block">Generated By</span>
                                        <p className="font-semibold text-foreground">{row.generatedByName || "System Admin"}</p>
                                        <p className="text-[11px] text-muted">
                                          {row.generatedAt ? new Date(row.generatedAt).toLocaleString() : (row.createdAt ? new Date(row.createdAt).toLocaleString() : "N/A")}
                                        </p>
                                      </div>

                                      <div>
                                        <span className="text-[10px] uppercase font-bold tracking-wider text-muted block">Payment Recorded By</span>
                                        <p className="font-semibold text-foreground">{row.paymentRecordedByName || "Finance Admin"}</p>
                                        <p className="text-[11px] text-muted">
                                          {row.paymentRecordedAt ? new Date(row.paymentRecordedAt).toLocaleDateString() : (row.dueDate || "N/A")}
                                        </p>
                                      </div>

                                      {(isSuppressed || row.isSuppressed) && (
                                        <div className="pt-2 border-t border-amber-500/20 bg-amber-500/10 p-2.5 rounded-lg">
                                          <span className="text-[10px] uppercase font-bold tracking-wider text-amber-600 dark:text-amber-400 block">
                                            Suppression Details
                                          </span>
                                          <p className="font-semibold text-foreground mt-0.5">By: {row.suppressedBy || "Staff Admin"}</p>
                                          <p className="text-[11px] text-muted">
                                            {row.suppressedAt ? new Date(row.suppressedAt).toLocaleString() : "Date N/A"}
                                          </p>
                                          <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-1 italic font-medium">
                                            "{row.suppressedReason || "Suppressed by staff for correction/regeneration"}"
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-muted">{row.propertyName}</td>
                          <td className="px-3 py-3 text-muted">{row.month}</td>
                          <td className="px-3 py-3 text-muted">{row.dueDate}</td>
                          <td className="px-3 py-3 text-muted">{formatCurrency(row.totalAmount)}</td>
                          <td className="px-3 py-3">
                            <span
                              className={`rounded-full border px-2 py-1 text-xs capitalize font-medium ${
                                row.status === "paid"
                                  ? "border-green-500/30 bg-green-500/10 text-green-600 font-semibold"
                                  : row.status === "overdue"
                                    ? "border-red-500/30 bg-red-500/10 text-red-600 font-semibold"
                                    : isSuppressed
                                      ? "border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400 font-bold"
                                      : "border-border-color bg-surface-elevated text-muted"
                                }`}
                            >
                              {isSuppressed ? "Suppressed (Superseded)" : row.status}
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
                              {isSuppressed ? (
                                <button
                                  type="button"
                                  disabled
                                  className="flex items-center gap-1 rounded-md border border-border-color bg-surface px-2 py-1 text-xs font-semibold text-muted opacity-50 cursor-not-allowed"
                                  title="Suppressed invoices are archived for audit records and cannot be shared"
                                >
                                  <Mail size={12} />
                                  <span>Email (Archived)</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void handleOpenShare(row)}
                                  className="flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-500/20 transition"
                                  title="Email to Owner, Staff, or Custom Email"
                                >
                                  <Mail size={12} />
                                  <span>Email</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => void handleDownloadRowPdf(row)}
                                className="flex items-center gap-1 rounded-md border border-border-color px-2 py-1 text-xs text-foreground hover:bg-surface-elevated transition"
                                title="Download as PDF"
                              >
                                <Download size={12} />
                                <span>PDF</span>
                              </button>
                              {!isSuppressed && row.status !== "paid" && (
                                <button
                                  type="button"
                                  onClick={() => onStatusChange(row.id, "paid")}
                                  className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated"
                                >
                                  Mark Paid
                                </button>
                              )}
                              {!isSuppressed && row.status === "sent" && (
                                <button
                                  type="button"
                                  onClick={() => onStatusChange(row.id, "overdue")}
                                  className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated"
                                >
                                  Mark Overdue
                                </button>
                              )}
                              {!isSuppressed && row.status === "draft" && (
                                <button
                                  type="button"
                                  onClick={() => onStatusChange(row.id, "sent")}
                                  className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated"
                                >
                                  Send
                                </button>
                              )}
                              {!isSuppressed && row.status === "paid" && (
                                <button
                                  type="button"
                                  onClick={() => onStatusChange(row.id, "sent")}
                                  className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated"
                                >
                                  Revert
                                </button>
                              )}
                              {isSuppressed ? (
                                <button
                                  type="button"
                                  onClick={() => void handleUnsuppressInvoice(row)}
                                  className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated transition"
                                  title="Restore this invoice to active status"
                                >
                                  Restore
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void handleSuppressInvoice(row)}
                                  className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-600 hover:bg-amber-500/20 transition"
                                  title="Suppress this invoice so a corrected one can be generated for this month"
                                >
                                  Suppress
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
                      );
                    })}
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

      {shareModalDoc && (
        <DocumentShareModal
          isOpen={shareModalDoc.isOpen}
          onClose={() => setShareModalDoc(null)}
          documentTitle={shareModalDoc.documentTitle}
          documentType={shareModalDoc.documentType}
          documentHtml={shareModalDoc.documentHtml}
          documentUrl={shareModalDoc.documentUrl}
          fileNameBase={shareModalDoc.fileNameBase}
          ownerName={shareModalDoc.ownerName}
          ownerEmail={shareModalDoc.ownerEmail}
          defaultSubject={shareModalDoc.defaultSubject}
          defaultMessage={shareModalDoc.defaultMessage}
          onSuccess={reload}
        />
      )}
    </ModulePage>
  );
}


