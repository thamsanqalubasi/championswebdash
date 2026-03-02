import { useEffect, useMemo, useState } from "react";
import { ModulePage } from "@/components/module-page";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { Modal } from "@/components/modal";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { fetchCompanyInfo, fetchAdminInfo, downloadHtmlDocument } from "@/lib/storage";
import { buildProfessionalInvoiceHtml } from "@/lib/document-templates";
import { sendEmailViaApi, sendWhatsAppViaApi, wrapDocumentInEmailHtml } from "@/lib/notifications";

type RentTenantRow = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  propertyId: string | null;
  propertyName: string;
};

type TenantPaymentHistoryRow = {
  id: string;
  tenantId: string;
  paymentDate: string;
  amountPaid: number;
  invoiceId: string | null;
  invoicePdfUrl: string | null;
};

type InvoiceLite = {
  id: string;
  tenantId: string;
  month: string;
  amount: number;
  dueDate: string;
  status: string;
  pdfUrl: string;
};

const emptyPaymentForm = {
  paymentDate: new Date().toISOString().slice(0, 10),
  amountPaid: 0,
  paidMonth: new Date().toISOString().slice(0, 7),
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "NAD",
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function RentCollectionPage() {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<RentTenantRow[]>([]);
  const [paymentsByTenant, setPaymentsByTenant] = useState<Record<string, TenantPaymentHistoryRow[]>>({});
  const [invoiceById, setInvoiceById] = useState<Record<string, InvoiceLite>>({});
  const [expandedTenantId, setExpandedTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [selectedTenant, setSelectedTenant] = useState<RentTenantRow | null>(null);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
  const [saving, setSaving] = useState(false);
  const [invoiceActionPaymentId, setInvoiceActionPaymentId] = useState<string | null>(null);
  const [regeneratingPaymentId, setRegeneratingPaymentId] = useState<string | null>(null);
  const [sendingPaymentId, setSendingPaymentId] = useState<string | null>(null);

  const PAGE_SIZE = 8;
  const [tenantsLimit, setTenantsLimit] = useState(PAGE_SIZE);
  const [historyLimits, setHistoryLimits] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const [{ data: tenantsData, error: tenantsError }, { data: paymentsData, error: paymentsError }, { data: invoicesData, error: invoicesError }] = await Promise.all([
          supabase
            .from("tenants")
            .select("id, full_name, phone, email, property_id, properties(name)")
            .order("full_name", { ascending: true }),
          supabase
            .from("tenant_rent_payments")
            .select("id, tenant_id, payment_date, amount_paid")
            .order("payment_date", { ascending: false }),
          supabase
            .from("invoices")
            .select("id, tenant_id, month, total_amount, due_date, status, pdf_url")
            .order("created_at", { ascending: false }),
        ]);

        if (tenantsError) throw tenantsError;
        if (paymentsError) throw paymentsError;
        if (invoicesError) throw invoicesError;

        const invoices = (invoicesData ?? []).map((row) => ({
          id: String(row.id ?? ""),
          tenantId: String(row.tenant_id ?? ""),
          month: String(row.month ?? ""),
          amount: Number(row.total_amount ?? 0),
          dueDate: String(row.due_date ?? ""),
          status: String(row.status ?? "draft"),
          pdfUrl: String(row.pdf_url ?? ""),
        }));

        const invoiceIds = invoices.map((invoice) => invoice.id).filter(Boolean);
        let paymentInvoiceMap = new Map<string, string>();

        if (invoiceIds.length > 0) {
          const { data: invoiceItems, error: invoiceItemsError } = await supabase
            .from("invoice_items")
            .select("invoice_id, description")
            .in("invoice_id", invoiceIds);

          if (invoiceItemsError) throw invoiceItemsError;

          paymentInvoiceMap = new Map<string, string>();
          (invoiceItems ?? []).forEach((item) => {
            const description = String(item.description ?? "");
            const match = description.match(/Payment ID:\s*([a-f0-9-]+)/i);
            if (!match?.[1]) return;

            const paymentId = match[1];
            if (!paymentInvoiceMap.has(paymentId)) {
              paymentInvoiceMap.set(paymentId, String(item.invoice_id ?? ""));
            }
          });
        }

        const invoiceLookupByTenantMonthAmount = new Map<string, string>();
        invoices.forEach((invoice) => {
          const key = `${invoice.tenantId}|${invoice.month}|${invoice.amount}`;
          if (!invoiceLookupByTenantMonthAmount.has(key)) {
            invoiceLookupByTenantMonthAmount.set(key, invoice.id);
          }
        });

        if (!cancelled) {
          const mapped = (tenantsData ?? []).map((row) => ({
            id: String(row.id ?? ""),
            fullName: String(row.full_name ?? "Unnamed Tenant"),
            phone: String(row.phone ?? "-"),
            email: String(row.email ?? "-"),
            propertyId: row.property_id ? String(row.property_id) : null,
            propertyName: String((row.properties as { name?: string } | null)?.name ?? "Unassigned"),
          }));
          setTenants(mapped);

          const invoiceByIdMap: Record<string, InvoiceLite> = {};
          invoices.forEach((invoice) => {
            invoiceByIdMap[invoice.id] = invoice;
          });
          setInvoiceById(invoiceByIdMap);

          const paymentMap: Record<string, TenantPaymentHistoryRow[]> = {};
          (paymentsData ?? []).forEach((payment) => {
            const tenantId = String(payment.tenant_id ?? "");
            if (!tenantId) return;

            const paymentId = String(payment.id ?? "");
            const amountPaid = Number(payment.amount_paid ?? 0);
            const paymentDate = String(payment.payment_date ?? "");
            const month = paymentDate.slice(0, 7);
            const fallbackKey = `${tenantId}|${month}|${amountPaid}`;
            const invoiceId =
              paymentInvoiceMap.get(paymentId) ??
              invoiceLookupByTenantMonthAmount.get(fallbackKey) ??
              null;

            if (!paymentMap[tenantId]) {
              paymentMap[tenantId] = [];
            }

            paymentMap[tenantId].push({
              id: paymentId,
              tenantId,
              paymentDate,
              amountPaid,
              invoiceId,
              invoicePdfUrl: invoiceId ? (invoiceByIdMap[invoiceId]?.pdfUrl ?? null) : null,
            });
          });

          Object.keys(paymentMap).forEach((key) => {
            paymentMap[key].sort((a, b) => String(b.paymentDate).localeCompare(String(a.paymentDate)));
          });

          setPaymentsByTenant(paymentMap);
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
      const admin = await fetchAdminInfo(user?.email ?? undefined);
      const executorName = admin.fullName || user?.email || "Admin";

      const { data: insertedPayment, error: paymentError } = await supabase
        .from("tenant_rent_payments")
        .insert({
          tenant_id: selectedTenant.id,
          payment_date: paymentForm.paymentDate,
          amount_paid: paymentForm.amountPaid,
          paid_months: [monthLabel],
          executed_by_name: executorName,
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

  const generateInvoiceForPayment = async (tenant: RentTenantRow, payment: TenantPaymentHistoryRow) => {
    if (!tenant.propertyId) {
      alert("Assign tenant to property first.");
      return;
    }

    setInvoiceActionPaymentId(payment.id);
    try {
      const month = payment.paymentDate.slice(0, 7);
      const { data: existingInvoice, error: existingInvoiceError } = await supabase
        .from("invoices")
        .select("id")
        .eq("tenant_id", tenant.id)
        .eq("property_id", tenant.propertyId)
        .eq("month", month)
        .eq("total_amount", payment.amountPaid)
        .limit(1)
        .maybeSingle();

      if (existingInvoiceError) throw existingInvoiceError;

      if (existingInvoice?.id) {
        reload();
        return;
      }

      const { data: createdInvoice, error: createInvoiceError } = await supabase
        .from("invoices")
        .insert({
          tenant_id: tenant.id,
          property_id: tenant.propertyId,
          month,
          due_date: payment.paymentDate,
          total_amount: payment.amountPaid,
          status: "paid",
        })
        .select("id")
        .single();

      if (createInvoiceError) throw createInvoiceError;

      const { error: itemError } = await supabase.from("invoice_items").insert({
        invoice_id: createdInvoice.id,
        description: `Rent payment invoice. Payment ID: ${payment.id}`,
        amount: payment.amountPaid,
      });

      if (itemError) throw itemError;

      reload();
    } catch (invoiceError) {
      alert(invoiceError instanceof Error ? invoiceError.message : "Could not generate invoice.");
    } finally {
      setInvoiceActionPaymentId(null);
    }
  };

  const viewInvoiceForPayment = async (payment: TenantPaymentHistoryRow, tenantName: string, propertyName: string) => {
    const invoiceId = payment.invoiceId;
    if (!invoiceId) return;

    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) {
      alert("Please allow popups to view invoice.");
      return;
    }

    try {
      const invoice = invoiceById[invoiceId];

      // If we have stored HTML in pdfUrl
      if (invoice?.pdfUrl && invoice.pdfUrl.startsWith("<")) {
        previewWindow.document.open();
        previewWindow.document.write(invoice.pdfUrl);
        previewWindow.document.close();
        return;
      }

      // If we have an external URL
      if (invoice?.pdfUrl && invoice.pdfUrl.startsWith("http")) {
        previewWindow.location.href = invoice.pdfUrl;
        return;
      }

      // Generate professional invoice
      const [company, admin] = await Promise.all([
        fetchCompanyInfo(),
        fetchAdminInfo(user?.email ?? undefined),
      ]);

      const html = buildProfessionalInvoiceHtml(
        {
          invoiceId: invoiceId,
          tenantName,
          propertyName,
          month: invoice?.month ?? payment.paymentDate.slice(0, 7),
          dueDate: payment.paymentDate,
          status: invoice?.status ?? "paid",
          lineItems: [{ description: `Rent payment on ${payment.paymentDate}`, amount: payment.amountPaid }],
        },
        company,
        admin,
      );

      // Save the generated HTML to DB
      await supabase.from("invoices").update({ pdf_url: html }).eq("id", invoiceId);

      previewWindow.document.open();
      previewWindow.document.write(html);
      previewWindow.document.close();
    } catch (viewError) {
      alert(viewError instanceof Error ? viewError.message : "Could not view invoice.");
      previewWindow.close();
    }
  };

  const regenerateInvoiceForPayment = async (tenant: RentTenantRow, payment: TenantPaymentHistoryRow) => {
    const invoiceId = payment.invoiceId;
    if (!invoiceId) {
      await generateInvoiceForPayment(tenant, payment);
      return;
    }
    setRegeneratingPaymentId(payment.id);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const month = today.slice(0, 7);
      const [company, admin] = await Promise.all([fetchCompanyInfo(), fetchAdminInfo(user?.email ?? undefined)]);
      const html = buildProfessionalInvoiceHtml(
        {
          invoiceId,
          tenantName: tenant.fullName,
          propertyName: tenant.propertyName,
          month,
          dueDate: today,
          status: "paid",
          lineItems: [{ description: `Rent payment on ${payment.paymentDate}`, amount: payment.amountPaid }],
        },
        company,
        admin,
      );
      const { error: updateError } = await supabase
        .from("invoices")
        .update({ pdf_url: html, due_date: today, month, updated_at: new Date().toISOString() })
        .eq("id", invoiceId);
      if (updateError) throw updateError;
      reload();
      alert("Invoice regenerated with today's date.");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not regenerate invoice.");
    } finally {
      setRegeneratingPaymentId(null);
    }
  };

  const downloadInvoiceForPayment = async (payment: TenantPaymentHistoryRow, tenantName: string, propertyName: string) => {
    const invoiceId = payment.invoiceId;
    if (!invoiceId) return;
    try {
      const invoice = invoiceById[invoiceId];
      if (invoice?.pdfUrl && invoice.pdfUrl.startsWith("http")) {
        const link = document.createElement("a");
        link.href = invoice.pdfUrl;
        link.download = `invoice-${invoiceId}.pdf`;
        link.click();
        return;
      }
      if (invoice?.pdfUrl && invoice.pdfUrl.startsWith("<")) {
        downloadHtmlDocument(invoice.pdfUrl, `invoice-${invoiceId}.html`);
        return;
      }
      const [company, admin] = await Promise.all([fetchCompanyInfo(), fetchAdminInfo(user?.email ?? undefined)]);
      const html = buildProfessionalInvoiceHtml(
        {
          invoiceId,
          tenantName,
          propertyName,
          month: invoice?.month ?? payment.paymentDate.slice(0, 7),
          dueDate: payment.paymentDate,
          status: invoice?.status ?? "paid",
          lineItems: [{ description: `Rent payment on ${payment.paymentDate}`, amount: payment.amountPaid }],
        },
        company,
        admin,
      );
      downloadHtmlDocument(html, `invoice-${invoiceId}.html`);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not download invoice.");
    }
  };

  const sendInvoiceForPayment = async (
    tenant: RentTenantRow,
    payment: TenantPaymentHistoryRow,
    channel: "email" | "whatsapp",
  ) => {
    const invoiceId = payment.invoiceId;
    if (!invoiceId) { alert("Generate invoice first."); return; }
    setSendingPaymentId(payment.id);
    try {
      const invoice = invoiceById[invoiceId];
      const [company, admin] = await Promise.all([fetchCompanyInfo(), fetchAdminInfo(user?.email ?? undefined)]);
      const html = invoice?.pdfUrl && invoice.pdfUrl.startsWith("<")
        ? invoice.pdfUrl
        : buildProfessionalInvoiceHtml(
          {
            invoiceId,
            tenantName: tenant.fullName,
            propertyName: tenant.propertyName,
            month: invoice?.month ?? payment.paymentDate.slice(0, 7),
            dueDate: payment.paymentDate,
            status: invoice?.status ?? "paid",
            lineItems: [{ description: `Rent payment on ${payment.paymentDate}`, amount: payment.amountPaid }],
          },
          company,
          admin,
        );
      if (channel === "email") {
        if (!tenant.email || tenant.email === "-") { alert("No tenant email address available."); return; }
        const subject = `Invoice for ${payment.paymentDate} - ${tenant.fullName}`;
        const bodyText = `Please find your invoice attached. Total amount: ${formatCurrency(payment.amountPaid)}.`;
        const emailHtml = wrapDocumentInEmailHtml({
          recipientName: tenant.fullName,
          subject,
          bodyText,
          documentHtml: html,
          companyName: company?.companyName,
        });
        const result = await sendEmailViaApi({
          to: tenant.email,
          subject,
          html: emailHtml,
          attachments: [{
            filename: `invoice-${invoiceId}.html`,
            content: html,
            contentType: "text/html",
          }],
        });
        if (!result.success) throw new Error(result.error || "Email API request failed.");
        alert("Invoice sent via email successfully!");
      } else {
        const phone = tenant.phone.replace(/\D/g, "");
        if (!phone) { alert("No tenant phone number available."); return; }
        const message = `Invoice for ${formatCurrency(payment.amountPaid)} - Payment on ${payment.paymentDate}.`;
        const mediaUrl = invoice?.pdfUrl && invoice.pdfUrl.startsWith("http") ? invoice.pdfUrl : undefined;
        const result = await sendWhatsAppViaApi({ to: `+${phone}`, message, ...(mediaUrl ? { mediaUrl } : {}) });
        if (!result.success) throw new Error(result.error || "WhatsApp API request failed.");
        alert("Invoice sent via WhatsApp successfully!");
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not send invoice.");
    } finally {
      setSendingPaymentId(null);
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
                  {tenants.slice(0, tenantsLimit).map((tenant) => {
                    const assigned = Boolean(tenant.propertyId);
                    return (
                      <tr key={tenant.id} className="border-b border-border-color/60">
                        <td className="px-3 py-3 font-medium">{tenant.fullName}</td>
                        <td className="px-3 py-3 text-muted">{tenant.propertyName}</td>
                        <td className="px-3 py-3 text-muted">{tenant.phone}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
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
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedTenantId((current) => (current === tenant.id ? null : tenant.id))
                              }
                              className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-xs"
                            >
                              {expandedTenantId === tenant.id ? "Hide History" : "Show History"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {tenants.slice(0, tenantsLimit).map((tenant) => {
                    if (expandedTenantId !== tenant.id) return null;
                    const paymentHistory = paymentsByTenant[tenant.id] ?? [];
                    const historyLimit = historyLimits[tenant.id] ?? PAGE_SIZE;
                    return (
                      <tr key={`${tenant.id}-history`} className="border-b border-border-color/60 bg-surface-elevated/30">
                        <td colSpan={4} className="px-3 py-3">
                          <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-wide text-muted">Rent Payment History</p>
                            {paymentHistory.length === 0 ? (
                              <p className="text-sm text-muted">No previous rent transactions for this tenant.</p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="min-w-full border-collapse text-xs">
                                  <thead>
                                    <tr className="border-b border-border-color text-left text-muted">
                                      <th className="px-2 py-2 font-medium">Date</th>
                                      <th className="px-2 py-2 font-medium">Amount</th>
                                      <th className="px-2 py-2 font-medium">Invoice</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {paymentHistory.slice(0, historyLimit).map((payment) => (
                                      <tr key={payment.id} className="border-b border-border-color/60">
                                        <td className="px-2 py-2 text-muted">{payment.paymentDate}</td>
                                        <td className="px-2 py-2 text-muted">{formatCurrency(payment.amountPaid)}</td>
                                        <td className="px-2 py-2">
                                          {payment.invoiceId ? (
                                            <div className="flex flex-wrap gap-1">
                                              <button
                                                type="button"
                                                onClick={() => void viewInvoiceForPayment(payment, tenant.fullName, tenant.propertyName)}
                                                className="rounded-md border border-border-color bg-surface px-2 py-1 text-xs"
                                              >
                                                View
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => void downloadInvoiceForPayment(payment, tenant.fullName, tenant.propertyName)}
                                                className="rounded-md border border-border-color bg-surface px-2 py-1 text-xs"
                                              >
                                                Download
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => void regenerateInvoiceForPayment(tenant, payment)}
                                                disabled={regeneratingPaymentId === payment.id}
                                                className="rounded-md border border-border-color bg-surface px-2 py-1 text-xs disabled:opacity-50"
                                              >
                                                {regeneratingPaymentId === payment.id ? "..." : "Regenerate"}
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => void sendInvoiceForPayment(tenant, payment, "email")}
                                                disabled={sendingPaymentId === payment.id}
                                                className="rounded-md border border-border-color bg-surface px-2 py-1 text-xs disabled:opacity-50"
                                              >
                                                Email
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => void sendInvoiceForPayment(tenant, payment, "whatsapp")}
                                                disabled={sendingPaymentId === payment.id}
                                                className="rounded-md border border-border-color bg-surface px-2 py-1 text-xs disabled:opacity-50"
                                              >
                                                WhatsApp
                                              </button>
                                            </div>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => void generateInvoiceForPayment(tenant, payment)}
                                              disabled={invoiceActionPaymentId === payment.id}
                                              className="rounded-md border border-border-color bg-surface px-2 py-1 text-xs disabled:opacity-50"
                                            >
                                              {invoiceActionPaymentId === payment.id ? "Generating..." : "Generate Invoice"}
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                                {paymentHistory.length > historyLimit && (
                                  <button
                                    type="button"
                                    onClick={() => setHistoryLimits((prev) => ({ ...prev, [tenant.id]: (prev[tenant.id] ?? PAGE_SIZE) + PAGE_SIZE }))}
                                    className="mt-2 w-full rounded-md border border-border-color bg-surface px-3 py-2 text-xs text-muted hover:bg-surface-elevated"
                                  >
                                    Load More ({paymentHistory.length - historyLimit} remaining)
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {tenants.length > tenantsLimit && (
                <button type="button" onClick={() => setTenantsLimit((v) => v + PAGE_SIZE)} className="mt-2 w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm text-muted hover:bg-surface">
                  Load More Tenants ({tenants.length - tenantsLimit} remaining)
                </button>
              )}
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
            <label className="mb-1 block text-sm text-muted">Amount (NAD)</label>
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
