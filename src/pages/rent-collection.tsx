import { useEffect, useMemo, useState, Fragment } from "react";
import { ModulePage } from "@/components/module-page";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { Modal } from "@/components/modal";
import { supabase } from "@/lib/supabase";
import { isValidUuid } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { fetchCompanyInfo, fetchAdminInfo, downloadHtmlDocument, downloadPdfDocument, downloadPdfFromUrl, uploadPdfFromHtml, createPdfAttachmentFromUrl } from "@/lib/storage";
import { DocumentShareModal } from "@/components/document-share-modal";
import { buildProfessionalInvoiceHtml } from "@/lib/document-templates";
import { sendEmailViaApi, sendWhatsAppViaApi, wrapDocumentInEmailHtml } from "@/lib/notifications";
import { 
  Users, 
  Building, 
  Phone, 
  CreditCard, 
  History, 
  ChevronRight, 
  ChevronDown, 
  DollarSign, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Mail, 
  Send, 
  Download, 
  Eye, 
  RefreshCw,
  Search,
  ArrowUpRight,
  TrendingUp,
  UserCheck,
  UserMinus,
  MessageSquare,
  Receipt
} from "lucide-react";
import { DataTableHeader, StatusBadge, TableRowActions, TableActionButton } from "@/components/data-table";

type RentTenantRow = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  propertyId: string | null;
  propertyName: string;
  tenureStatus: string;
  tenureEndDate: string | null;
  noticeEndDate: string | null;
  paymentStatus: "paid" | "due" | "overdue";
  daysRemaining: number | null;
  lastPaymentDate: string | null;
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

function isExecutedByNameColumnMissing(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lowered = message.toLowerCase();
  return lowered.includes("executed_by_name") && lowered.includes("does not exist");
}

function StatCard({ label, value, detail, icon: Icon, colorClass = "text-foreground" }: { label: string; value: string; detail: string; icon: any; colorClass?: string }) {
  return (
    <article className="rounded-xl border border-border-color bg-surface p-5 transition-all hover:shadow-md">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted/60">{label}</p>
          <p className={`mt-1 text-2xl font-black tracking-tight ${colorClass}`}>{value}</p>
        </div>
        <div className="rounded-lg bg-surface-elevated p-2 ring-1 ring-border-color/50">
          <Icon size={18} className="text-muted" />
        </div>
      </div>
      <p className="mt-3 text-[10px] font-bold text-muted/40 uppercase tracking-widest">{detail}</p>
    </article>
  );
}

export default function RentCollectionPage() {
  const { user, currentCompany } = useAuth();
  const { format: formatCurrency } = useCurrency();
  const [tenants, setTenants] = useState<RentTenantRow[]>([]);
  const [paymentsByTenant, setPaymentsByTenant] = useState<Record<string, TenantPaymentHistoryRow[]>>({});
  const [invoiceById, setInvoiceById] = useState<Record<string, InvoiceLite>>({});
  const [expandedTenantId, setExpandedTenantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  const [selectedTenant, setSelectedTenant] = useState<RentTenantRow | null>(null);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
  const [saving, setSaving] = useState(false);
  const [invoiceActionPaymentId, setInvoiceActionPaymentId] = useState<string | null>(null);
  const [sendingPaymentId, setSendingPaymentId] = useState<string | null>(null);
  const [shareModalDoc, setShareModalDoc] = useState<{
    isOpen: boolean;
    documentTitle: string;
    documentType?: string;
    documentHtml?: string;
    documentUrl?: string;
    fileNameBase?: string;
    ownerName?: string;
    ownerEmail?: string;
    defaultSubject?: string;
    defaultMessage?: string;
  }>({
    isOpen: false,
    documentTitle: "",
  });

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const [{ data: tenantsData, error: tenantsError }, { data: paymentsData, error: paymentsError }, { data: invoicesData, error: invoicesError }, { data: companyData }] = await Promise.all([
          supabase
            .from("tenants")
            .select("id, full_name, phone, email, property_id, tenure_status, tenure_end_date, notice_end_date, properties(name)")
            .order("full_name", { ascending: true }),
          supabase
            .from("tenant_rent_payments")
            .select("id, tenant_id, payment_date, amount_paid")
            .order("payment_date", { ascending: false }),
          supabase
            .from("invoices")
            .select("id, tenant_id, month, total_amount, due_date, status, pdf_url")
            .order("created_at", { ascending: false }),
          supabase.from("company_settings").select("default_due_day").limit(1).maybeSingle()
        ]);

        if (tenantsError) throw tenantsError;
        if (paymentsError) throw paymentsError;
        if (invoicesError) throw invoicesError;

        const defaultDueDay = Number(companyData?.default_due_day ?? 1);
        const now = new Date();
        const currentMonth = now.toISOString().slice(0, 7);

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

          (invoiceItems ?? []).forEach((item) => {
            const description = String(item.description ?? "");
            const match = description.match(/Payment ID:\s*([a-f0-9-]+)/i);
            if (!match?.[1]) return;
            paymentInvoiceMap.set(match[1], String(item.invoice_id ?? ""));
          });
        }

        const invoiceByIdMap: Record<string, InvoiceLite> = {};
        invoices.forEach((invoice) => { invoiceByIdMap[invoice.id] = invoice; });
        setInvoiceById(invoiceByIdMap);

        const paymentMap: Record<string, TenantPaymentHistoryRow[]> = {};
        (paymentsData ?? []).forEach((payment) => {
          const tenantId = String(payment.tenant_id ?? "");
          if (!tenantId) return;

          if (!paymentMap[tenantId]) paymentMap[tenantId] = [];
          paymentMap[tenantId].push({
            id: String(payment.id),
            tenantId,
            paymentDate: String(payment.payment_date),
            amountPaid: Number(payment.amount_paid),
            invoiceId: paymentInvoiceMap.get(String(payment.id)) || null,
            invoicePdfUrl: paymentInvoiceMap.has(String(payment.id)) ? (invoiceByIdMap[paymentInvoiceMap.get(String(payment.id))!]?.pdfUrl ?? null) : null,
          });
        });
        setPaymentsByTenant(paymentMap);

        if (!cancelled) {
          const mapped = (tenantsData ?? []).map((row) => {
            const tenantPayments = paymentMap[String(row.id)] ?? [];
            const hasPaidCurrent = tenantPayments.some(p => p.paymentDate.startsWith(currentMonth));
            const lastPayment = tenantPayments[0]?.paymentDate || null;
            
            let paymentStatus: "paid" | "due" | "overdue" = "due";
            let daysRemaining: number | null = null;

            if (hasPaidCurrent) {
              paymentStatus = "paid";
            } else {
              const dueDate = new Date(now.getFullYear(), now.getMonth(), defaultDueDay);
              const diffTime = dueDate.getTime() - now.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              
              if (diffDays < 0) {
                paymentStatus = "overdue";
                daysRemaining = Math.abs(diffDays);
              } else {
                paymentStatus = "due";
                daysRemaining = diffDays;
              }
            }

            return {
              id: String(row.id ?? ""),
              fullName: String(row.full_name ?? "Unnamed Tenant"),
              phone: String(row.phone ?? "-"),
              email: String(row.email ?? "-"),
              propertyId: row.property_id ? String(row.property_id) : null,
              propertyName: String((row.properties as { name?: string } | null)?.name ?? "Unassigned"),
              tenureStatus: String(row.tenure_status ?? "active"),
              tenureEndDate: row.tenure_end_date ? String(row.tenure_end_date) : null,
              noticeEndDate: row.notice_end_date ? String(row.notice_end_date) : null,
              paymentStatus,
              daysRemaining,
              lastPaymentDate: lastPayment
            };
          });
          setTenants(mapped);
        }
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Could not load collection data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const stats = useMemo(() => {
    const assigned = tenants.filter(t => t.propertyId);
    return {
      total: tenants.length,
      assigned: assigned.length,
      unassigned: tenants.length - assigned.length,
      paid: assigned.filter(t => t.paymentStatus === "paid").length,
      overdue: assigned.filter(t => t.paymentStatus === "overdue").length,
      onNotice: assigned.filter(t => t.tenureStatus === "notice").length,
      collectionRate: assigned.length > 0 ? (assigned.filter(t => t.paymentStatus === "paid").length / assigned.length) * 100 : 0
    };
  }, [tenants]);

  const filteredTenants = useMemo(() => {
    let result = activeFilter === "all" ? tenants : tenants.filter(t => {
      if (activeFilter === "notice") return t.tenureStatus === "notice";
      if (activeFilter === "overdue") return t.paymentStatus === "overdue";
      if (activeFilter === "paid") return t.paymentStatus === "paid";
      return true;
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(t => t.fullName.toLowerCase().includes(q) || t.propertyName.toLowerCase().includes(q));
    }
    return result;
  }, [tenants, searchQuery, activeFilter]);

  const reload = () => setReloadKey((value) => value + 1);

  const openRecordModal = (tenant: RentTenantRow) => {
    if (!tenant.propertyId) return;
    setSelectedTenant(tenant);
    setPaymentForm({
      paymentDate: new Date().toISOString().slice(0, 10),
      amountPaid: 0,
      paidMonth: new Date().toISOString().slice(0, 7),
    });
  };

  const onSavePayment = async () => {
    if (!selectedTenant?.propertyId) return;
    if (!paymentForm.amountPaid || paymentForm.amountPaid <= 0) { alert("Enter a valid payment amount."); return; }
    setSaving(true);
    try {
      const admin = await fetchAdminInfo(user?.email ?? undefined);
      const executorName = admin.fullName || user?.email || "Admin";
      const compId = currentCompany?.id && isValidUuid(currentCompany.id) ? currentCompany.id : null;

      const paymentPayload: Record<string, unknown> = {
        tenant_id: selectedTenant.id,
        property_id: selectedTenant.propertyId,
        payment_date: paymentForm.paymentDate,
        amount_paid: paymentForm.amountPaid,
        paid_month: paymentForm.paidMonth,
        notes: `Recorded by ${executorName}`,
        company_id: compId,
      };

      const { data: insertedPayment, error: paymentError } = await supabase
        .from("tenant_rent_payments")
        .insert(paymentPayload)
        .select("id")
        .single();

      if (paymentError) throw paymentError;

      await supabase.from("audit_log").insert({
        user_email: user?.email || "admin@championscourt.co.za",
        user_name: executorName,
        action: "rent_payment_recorded",
        entity_type: "tenant_rent_payment",
        entity_id: insertedPayment?.id && isValidUuid(insertedPayment.id) ? insertedPayment.id : null,
        company_id: compId,
        details: {
          tenant_name: selectedTenant.fullName,
          tenant_id: selectedTenant.id,
          property_id: selectedTenant.propertyId,
          amount_paid: paymentForm.amountPaid,
          payment_date: paymentForm.paymentDate,
          paid_month: paymentForm.paidMonth,
        },
      });

      setSelectedTenant(null); reload();
    } catch (saveError) { alert(saveError instanceof Error ? saveError.message : "Could not record rent payment."); }
    finally { setSaving(false); }
  };

  const generateInvoiceForPayment = async (tenant: RentTenantRow, payment: TenantPaymentHistoryRow) => {
    if (!tenant.propertyId) return;
    setInvoiceActionPaymentId(payment.id);
    try {
      const compId = currentCompany?.id && isValidUuid(currentCompany.id) ? currentCompany.id : null;
      const month = payment.paymentDate.slice(0, 7);
      const { data: createdInvoice, error: createInvoiceError } = await supabase.from("invoices").insert({
        tenant_id: tenant.id,
        property_id: tenant.propertyId,
        month,
        due_date: payment.paymentDate,
        total_amount: payment.amountPaid,
        status: "paid",
        company_id: compId,
      }).select("id").single();

      if (createInvoiceError) throw createInvoiceError;

      await supabase.from("invoice_items").insert({
        invoice_id: createdInvoice.id,
        description: `Rent payment invoice. Payment ID: ${payment.id}`,
        amount: payment.amountPaid,
        company_id: compId,
      });

      reload();
    } catch (invoiceError) { alert(invoiceError instanceof Error ? invoiceError.message : "Could not generate invoice."); }
    finally { setInvoiceActionPaymentId(null); }
  };

  const viewInvoiceForPayment = async (payment: TenantPaymentHistoryRow, tenantName: string, propertyName: string) => {
    const invoiceId = payment.invoiceId;
    if (!invoiceId) return;
    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) { alert("Please allow popups to view invoice."); return; }
    try {
      const invoice = invoiceById[invoiceId];
      if (invoice?.pdfUrl && invoice.pdfUrl.startsWith("<")) {
        previewWindow.document.open(); previewWindow.document.write(invoice.pdfUrl); previewWindow.document.close(); return;
      }
      const [company, admin] = await Promise.all([fetchCompanyInfo(), fetchAdminInfo(user?.email ?? undefined)]);
      const html = buildProfessionalInvoiceHtml(
        { invoiceId, tenantName, propertyName, month: invoice?.month ?? payment.paymentDate.slice(0, 7), dueDate: payment.paymentDate, status: invoice?.status ?? "paid", lineItems: [{ description: `Rent payment on ${payment.paymentDate}`, amount: payment.amountPaid }] },
        company, admin
      );
      await supabase.from("invoices").update({ pdf_url: html }).eq("id", invoiceId);
      previewWindow.document.open(); previewWindow.document.write(html); previewWindow.document.close();
    } catch (e) { alert("Could not view invoice."); previewWindow.close(); }
  };

  const downloadInvoiceForPayment = async (payment: TenantPaymentHistoryRow, tenantName: string, propertyName: string) => {
    const invoiceId = payment.invoiceId;
    if (!invoiceId) return;
    try {
      const invoice = invoiceById[invoiceId];
      const fileNameBase = `receipt-${tenantName.replace(/\s+/g, "_")}-${payment.paymentDate}`;
      if (invoice?.pdfUrl && invoice.pdfUrl.startsWith("http") && invoice.pdfUrl.toLowerCase().includes(".pdf")) {
        await downloadPdfFromUrl(invoice.pdfUrl, fileNameBase);
        return;
      }
      const [company, admin] = await Promise.all([fetchCompanyInfo(), fetchAdminInfo(user?.email ?? undefined)]);
      const html = invoice?.pdfUrl && invoice.pdfUrl.startsWith("<") ? invoice.pdfUrl : buildProfessionalInvoiceHtml(
        { invoiceId, tenantName, propertyName, month: invoice?.month ?? payment.paymentDate.slice(0, 7), dueDate: payment.paymentDate, status: invoice?.status ?? "paid", lineItems: [{ description: `Rent payment on ${payment.paymentDate}`, amount: payment.amountPaid }] },
        company, admin
      );
      downloadPdfDocument(html, fileNameBase);
    } catch (e) { alert("Could not download invoice."); }
  };

  const sendInvoiceForPayment = async (tenant: RentTenantRow, payment: TenantPaymentHistoryRow, channel: "email" | "whatsapp") => {
    const invoiceId = payment.invoiceId;
    if (!invoiceId) return;
    setSendingPaymentId(payment.id);
    try {
      const invoice = invoiceById[invoiceId];
      const [company, admin] = await Promise.all([fetchCompanyInfo(), fetchAdminInfo(user?.email ?? undefined)]);
      const html = invoice?.pdfUrl && invoice.pdfUrl.startsWith("<") ? invoice.pdfUrl : buildProfessionalInvoiceHtml(
        { invoiceId, tenantName: tenant.fullName, propertyName: tenant.propertyName, month: invoice?.month ?? payment.paymentDate.slice(0, 7), dueDate: payment.paymentDate, status: invoice?.status ?? "paid", lineItems: [{ description: `Rent payment on ${payment.paymentDate}`, amount: payment.amountPaid }] },
        company, admin
      );
      if (channel === "email") {
        const pdfUrl = invoice?.pdfUrl && invoice.pdfUrl.startsWith("http") && invoice.pdfUrl.toLowerCase().includes(".pdf")
          ? invoice.pdfUrl
          : await uploadPdfFromHtml("invoice-pdfs", invoiceId, html, `invoice-${invoiceId}`);
        if (!invoice?.pdfUrl || invoice.pdfUrl !== pdfUrl) {
          await supabase.from("invoices").update({ pdf_url: pdfUrl }).eq("id", invoiceId);
        }
        setShareModalDoc({
          isOpen: true,
          documentTitle: `Rent Receipt - ${tenant.fullName} (${payment.paymentDate})`,
          documentType: "Receipt",
          documentHtml: html,
          documentUrl: pdfUrl,
          fileNameBase: `receipt-${tenant.fullName.replace(/\s+/g, "_")}-${payment.paymentDate}`,
          ownerName: tenant.fullName,
          ownerEmail: tenant.email && tenant.email !== "-" ? tenant.email : "",
          defaultSubject: `Rent Receipt - ${tenant.fullName} - ${tenant.propertyName}`,
          defaultMessage: `Dear ${tenant.fullName},\n\nPlease find your payment receipt for ${payment.paymentDate} in the amount of ${formatCurrency(payment.amountPaid)}.`,
        });
        return;
      } else {
        const phone = tenant.phone.replace(/\D/g, "");
        if (!phone) { alert("No phone available."); return; }
        const mediaUrl = invoice?.pdfUrl && invoice.pdfUrl.startsWith("http") && invoice.pdfUrl.toLowerCase().includes(".pdf")
          ? invoice.pdfUrl
          : await uploadPdfFromHtml("invoice-pdfs", invoiceId, html, `invoice-${invoiceId}`);
        if (!invoice?.pdfUrl || invoice.pdfUrl !== mediaUrl) {
          await supabase.from("invoices").update({ pdf_url: mediaUrl }).eq("id", invoiceId);
        }
        const result = await sendWhatsAppViaApi({ to: `+${phone}`, message: `Rent Receipt: ${formatCurrency(payment.amountPaid)} settled on ${payment.paymentDate}.`, mediaUrl });
        if (result.success) alert("Sent successfully!");
      }
    } catch (e) { alert("Could not send invoice."); }
    finally { setSendingPaymentId(null); }
  };

  return (
    <ModulePage title="Rent Collection" description="Monitor payment cycles, record transactions, and automate tenant correspondence.">
      {loading && <LoadingState label="Calculating collection metrics..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Collection Rate" value={`${stats.collectionRate.toFixed(0)}%`} detail="Current cycle efficiency" icon={TrendingUp} colorClass="text-green-600" />
            <StatCard label="Fully Settled" value={String(stats.paid)} detail={`${stats.assigned} active units`} icon={CheckCircle2} colorClass="text-sky-600" />
            <StatCard label="Arrears / Due" value={String(stats.overdue)} detail="Immediate action required" icon={AlertCircle} colorClass="text-red-600" />
            <StatCard label="Lease Notices" value={String(stats.onNotice)} detail="Vacation countdowns" icon={Clock} colorClass="text-amber-600" />
          </div>

          <section className="rounded-xl border border-border-color bg-surface p-1">
            <div className="p-4">
              <DataTableHeader
                searchValue={searchQuery}
                onSearchChange={setSearchQuery}
                searchPlaceholder="Search by tenant name or property unit..."
                filters={[
                  { key: "all", label: "All Tenants", count: tenants.length },
                  { key: "overdue", label: "In Arrears", count: stats.overdue },
                  { key: "paid", label: "Settled", count: stats.paid },
                  { key: "notice", label: "On Notice", count: stats.onNotice }
                ]}
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                actions={
                  <button type="button" onClick={reload} className="flex h-9 w-9 items-center justify-center rounded-lg border border-border-color bg-surface-elevated text-muted hover:text-foreground">
                    <RefreshCw size={16} />
                  </button>
                }
              />
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border-color text-left text-muted/60 uppercase text-[10px] font-bold tracking-wider">
                    <th className="px-6 py-4 font-bold">Tenant Profile</th>
                    <th className="px-6 py-4 font-bold">Unit Data</th>
                    <th className="px-6 py-4 font-bold">Payment Lifecycle</th>
                    <th className="px-6 py-4 font-bold">Lease Health</th>
                    <th className="px-6 py-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color/40">
                  {filteredTenants.map((tenant) => {
                    const isAssigned = Boolean(tenant.propertyId);
                    const isOverdue = tenant.paymentStatus === "overdue";

                    return (
                      <Fragment key={tenant.id}>
                        <tr className={`group transition-colors ${expandedTenantId === tenant.id ? "bg-surface-elevated/20" : "hover:bg-surface-elevated/40"}`}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted/5 group-hover:bg-foreground group-hover:text-surface transition-all">
                                <Users size={20} className="text-muted/60 group-hover:text-current" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold tracking-tight text-foreground truncate">{tenant.fullName}</p>
                                <div className="flex items-center gap-1.5 text-xs text-muted">
                                  <Phone size={12} />
                                  <span>{tenant.phone}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Building size={14} className="text-muted/40" />
                              <span className="font-medium text-foreground">{tenant.propertyName}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <StatusBadge status={tenant.paymentStatus} />
                                {tenant.daysRemaining !== null && (
                                  <span className={`text-[10px] font-bold uppercase ${isOverdue ? "text-red-600" : "text-sky-600"}`}>
                                    {isOverdue ? `${tenant.daysRemaining}d Late` : `${tenant.daysRemaining}d Left`}
                                  </span>
                                )}
                              </div>
                              {tenant.lastPaymentDate && (
                                <p className="text-[10px] text-muted font-bold uppercase tracking-tighter">
                                  Last: {tenant.lastPaymentDate}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {tenant.tenureStatus === "notice" ? (
                              <div className="flex flex-col gap-0.5">
                                <div className="flex items-center gap-1.5 text-amber-600">
                                  <AlertCircle size={14} />
                                  <span className="text-xs font-bold uppercase">On Notice</span>
                                </div>
                                <p className="text-[10px] text-muted font-medium">Ends: {tenant.noticeEndDate || "TBD"}</p>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 text-green-600">
                                <UserCheck size={14} />
                                <span className="text-xs font-bold uppercase tracking-widest">Active Lease</span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isAssigned && (
                                <button
                                  type="button"
                                  onClick={() => openRecordModal(tenant)}
                                  className="flex items-center gap-2 rounded-lg bg-foreground px-3 py-1.5 text-xs font-black text-surface hover:opacity-90 shadow-sm transition-all"
                                >
                                  <DollarSign size={14} />
                                  Record Rent
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setExpandedTenantId(current => current === tenant.id ? null : tenant.id)}
                                className={`p-1.5 rounded-lg border border-border-color transition-all ${expandedTenantId === tenant.id ? "bg-foreground text-surface border-foreground" : "bg-surface-elevated text-muted hover:text-foreground"}`}
                              >
                                {expandedTenantId === tenant.id ? <ChevronDown size={16} /> : <History size={16} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                        
                        {expandedTenantId === tenant.id && (
                          <tr className="bg-surface-elevated/10">
                            <td colSpan={5} className="px-6 py-8 border-l-4 border-l-foreground shadow-inner">
                              <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                  <h4 className="text-sm font-black uppercase tracking-[0.2em] text-muted/60">Historical Audit: {tenant.fullName}</h4>
                                </div>
                                
                                {!(paymentsByTenant[tenant.id]?.length > 0) ? (
                                  <div className="p-10 rounded-2xl border-2 border-dashed border-border-color text-center">
                                    <p className="text-sm text-muted">Zero payment history found for this profile.</p>
                                  </div>
                                ) : (
                                  <div className="grid gap-4">
                                    {paymentsByTenant[tenant.id].slice(0, 5).map((pay) => (
                                      <div key={pay.id} className="flex items-center justify-between rounded-xl border border-border-color bg-surface p-4 shadow-sm group/pay hover:border-foreground/20 transition-all">
                                        <div className="flex items-center gap-4">
                                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-600 dark:bg-green-900/20">
                                            <CheckCircle2 size={20} />
                                          </div>
                                          <div>
                                            <p className="font-bold text-foreground">{formatCurrency(pay.amountPaid)}</p>
                                            <p className="text-xs text-muted font-medium">Settled on {pay.paymentDate}</p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1 opacity-0 group-hover/pay:opacity-100 transition-all">
                                          {pay.invoiceId ? (
                                            <Fragment>
                                              <TableActionButton icon={Eye} label="View Invoice" onClick={() => void viewInvoiceForPayment(pay, tenant.fullName, tenant.propertyName)} />
                                              <TableActionButton icon={Download} label="Download" onClick={() => void downloadInvoiceForPayment(pay, tenant.fullName, tenant.propertyName)} />
                                              <TableActionButton icon={Mail} label="Email" onClick={() => void sendInvoiceForPayment(tenant, pay, "email")} />
                                              <TableActionButton icon={MessageSquare} label="WhatsApp" onClick={() => void sendInvoiceForPayment(tenant, pay, "whatsapp")} />
                                            </Fragment>
                                          ) : (
                                            <button 
                                              onClick={() => void generateInvoiceForPayment(tenant, pay)}
                                              disabled={invoiceActionPaymentId === pay.id}
                                              className="rounded-lg bg-surface-elevated border border-border-color px-3 py-1.5 text-[10px] font-black uppercase text-muted hover:text-foreground"
                                            >
                                              {invoiceActionPaymentId === pay.id ? "Processing..." : "Generate Invoice"}
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border-color/50 px-6 py-4 bg-surface-elevated/20">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted/40">
                Managed Portfolio: {tenants.length} Tenant Profiles
              </p>
            </div>
          </section>
        </div>
      )}

      <Modal
        open={Boolean(selectedTenant)}
        onClose={() => setSelectedTenant(null)}
        title={selectedTenant ? `Record Rent: ${selectedTenant.fullName}` : "Record Rent"}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-border-color bg-surface-elevated/50 p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase text-muted/60">Property Unit</p>
              <p className="font-bold text-foreground">{selectedTenant?.propertyName ?? "-"}</p>
            </div>
            <Building size={24} className="text-muted/20" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Payment Date</label>
              <input type="date" value={paymentForm.paymentDate} onChange={(e) => setPaymentForm((prev) => ({ ...prev, paymentDate: e.target.value }))} className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-foreground/5" />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Billing Month</label>
              <input type="month" value={paymentForm.paidMonth} onChange={(e) => setPaymentForm((prev) => ({ ...prev, paidMonth: e.target.value }))} className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-foreground/5" />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Amount Received (NAD)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted">NAD</span>
              <input type="number" min={0} value={paymentForm.amountPaid} onChange={(e) => setPaymentForm((prev) => ({ ...prev, amountPaid: Number(e.target.value) }))} className="w-full rounded-lg border border-border-color bg-surface px-3 py-3 pl-12 text-xl font-black outline-none focus:ring-2 focus:ring-foreground/5" />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setSelectedTenant(null)} className="rounded-lg border border-border-color px-4 py-2 text-sm font-bold text-muted hover:text-foreground">Cancel</button>
            <button type="button" onClick={onSavePayment} disabled={saving} className="rounded-lg bg-foreground px-6 py-2 text-sm font-black text-surface hover:opacity-90 disabled:opacity-50 shadow-md">{saving ? "Processing..." : "Confirm Payment"}</button>
          </div>
        </div>
      </Modal>

      <DocumentShareModal
        isOpen={shareModalDoc.isOpen}
        onClose={() => setShareModalDoc((prev) => ({ ...prev, isOpen: false }))}
        documentTitle={shareModalDoc.documentTitle}
        documentType={shareModalDoc.documentType}
        documentHtml={shareModalDoc.documentHtml}
        documentUrl={shareModalDoc.documentUrl}
        fileNameBase={shareModalDoc.fileNameBase}
        ownerName={shareModalDoc.ownerName}
        ownerEmail={shareModalDoc.ownerEmail}
        defaultSubject={shareModalDoc.defaultSubject}
        defaultMessage={shareModalDoc.defaultMessage}
      />
    </ModulePage>
  );
}


