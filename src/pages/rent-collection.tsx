import { useEffect, useMemo, useState, Fragment } from "react";
import { ModulePage } from "@/components/module-page";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { Modal } from "@/components/modal";
import { supabase } from "@/lib/supabase";
import { isValidUuid } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { fetchCompanyInfo, fetchAdminInfo, downloadHtmlDocument, downloadPdfDocument, downloadPdfFromUrl, uploadPdfFromHtml, createPdfAttachmentFromUrl, uploadFileToBucket } from "@/lib/storage";
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
  Receipt,
  UploadCloud,
  FileText,
  ExternalLink,
  ShieldCheck
} from "lucide-react";
import { DataTableHeader, StatusBadge, TableRowActions, TableActionButton } from "@/components/data-table";

type RentTenantRow = {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  propertyId: string | null;
  propertyName: string;
  monthlyRent: number;
  tenureStatus: string;
  tenureStartDate?: string | null;
  createdAt?: string | null;
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
  paymentMethod?: string;
  popUrl?: string | null;
  notes?: string | null;
  executedByName?: string | null;
  popUploadedByName?: string | null;
  popUploadedAt?: string | null;
  createdAt?: string | null;
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
  amountPaid: "" as unknown as number,
  paidMonth: new Date().toISOString().slice(0, 7),
  paymentMethod: "Bank Transfer / EFT",
  notes: "",
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
  const [popFile, setPopFile] = useState<File | null>(null);
  const [selectedPaymentDetail, setSelectedPaymentDetail] = useState<{
    payment: TenantPaymentHistoryRow;
    tenant: RentTenantRow;
  } | null>(null);
  const [retroPopFile, setRetroPopFile] = useState<File | null>(null);
  const [savingRetroPop, setSavingRetroPop] = useState(false);
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
        const compId = currentCompany?.id;
        let tenantsQuery = supabase
          .from("tenants")
          .select("id, full_name, phone, email, property_id, tenure_status, tenure_start_date, created_at, tenure_end_date, notice_end_date, properties(name, monthly_rent)")
          .order("full_name", { ascending: true });

        let invoicesQuery = supabase
          .from("invoices")
          .select("id, tenant_id, month, total_amount, due_date, status, pdf_url")
          .order("created_at", { ascending: false });

        if (isValidUuid(compId)) {
          tenantsQuery = tenantsQuery.eq("company_id", compId);
          invoicesQuery = invoicesQuery.eq("company_id", compId);
        }

        // Resilient payment query
        let rawPayments: any[] = [];
        try {
          const { data: pData, error: pError } = await supabase
            .from("tenant_rent_payments")
            .select("id, tenant_id, payment_date, amount_paid, payment_method, pop_url, notes, executed_by_name, pop_uploaded_by_name, pop_uploaded_at, created_at")
            .order("payment_date", { ascending: false });
          if (!pError && pData) {
            rawPayments = pData;
          } else {
            const { data: fallbackData } = await supabase
              .from("tenant_rent_payments")
              .select("id, tenant_id, payment_date, amount_paid, notes")
              .order("payment_date", { ascending: false });
            if (fallbackData) rawPayments = fallbackData;
          }
        } catch {
          rawPayments = [];
        }

        const [{ data: tenantsData, error: tenantsError }, { data: invoicesData, error: invoicesError }, { data: companyData }] = await Promise.all([
          tenantsQuery,
          invoicesQuery,
          isValidUuid(compId)
            ? supabase.from("companies").select("default_due_day").eq("id", compId).maybeSingle()
            : supabase.from("company_settings").select("default_due_day").limit(1).maybeSingle()
        ]);

        if (tenantsError) throw tenantsError;
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
          try {
            const { data: invoiceItems } = await supabase
              .from("invoice_items")
              .select("invoice_id, description")
              .in("invoice_id", invoiceIds);

            (invoiceItems ?? []).forEach((item) => {
              const description = String(item.description ?? "");
              const match = description.match(/Payment ID:\s*([a-f0-9-]+)/i);
              if (!match?.[1]) return;
              paymentInvoiceMap.set(match[1], String(item.invoice_id ?? ""));
            });
          } catch {
            // invoice items non-fatal
          }
        }

        const invoiceByIdMap: Record<string, InvoiceLite> = {};
        invoices.forEach((invoice) => { invoiceByIdMap[invoice.id] = invoice; });
        setInvoiceById(invoiceByIdMap);

        const tenantIds = new Set((tenantsData ?? []).map((t) => String(t.id)));
        const paymentMap: Record<string, TenantPaymentHistoryRow[]> = {};
        rawPayments.forEach((payment) => {
          const tenantId = String(payment.tenant_id ?? "");
          if (!tenantId || !tenantIds.has(tenantId)) return;

          if (!paymentMap[tenantId]) paymentMap[tenantId] = [];
          paymentMap[tenantId].push({
            id: String(payment.id),
            tenantId,
            paymentDate: String(payment.payment_date),
            amountPaid: Number(payment.amount_paid),
            paymentMethod: payment.payment_method || "Bank Transfer / EFT",
            popUrl: payment.pop_url || null,
            notes: payment.notes || null,
            executedByName: payment.executed_by_name || null,
            popUploadedByName: payment.pop_uploaded_by_name || null,
            popUploadedAt: payment.pop_uploaded_at || null,
            createdAt: payment.created_at || null,
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
            } else if (!row.property_id) {
              // Unassigned tenant is not in arrears
              paymentStatus = "due";
              daysRemaining = null;
            } else {
              const joinedDate = row.tenure_start_date || row.created_at;
              const joinedDateObj = joinedDate ? new Date(joinedDate) : null;
              const isNewThisMonth = Boolean(
                joinedDateObj &&
                joinedDateObj.getFullYear() === now.getFullYear() &&
                joinedDateObj.getMonth() === now.getMonth()
              );

              if (isNewThisMonth) {
                // Onboarded in current month: not overdue
                paymentStatus = "due";
                daysRemaining = null;
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
            }

            return {
              id: String(row.id ?? ""),
              fullName: String(row.full_name ?? "Unnamed Tenant"),
              phone: String(row.phone ?? "-"),
              email: String(row.email ?? "-"),
              propertyId: row.property_id ? String(row.property_id) : null,
              propertyName: String((row.properties as { name?: string } | null)?.name ?? "Unassigned"),
              monthlyRent: Number((row.properties as { monthly_rent?: number } | null)?.monthly_rent ?? 0),
              tenureStatus: String(row.tenure_status ?? "active"),
              tenureStartDate: row.tenure_start_date ? String(row.tenure_start_date) : null,
              createdAt: row.created_at ? String(row.created_at) : null,
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
  }, [reloadKey, currentCompany?.id]);

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
    if (!tenant.propertyId) {
      alert("This tenant is unassigned. Please assign them to a property first before recording rent payments.");
      return;
    }
    setSelectedTenant(tenant);
    setPaymentForm({
      paymentDate: new Date().toISOString().slice(0, 10),
      amountPaid: tenant.monthlyRent > 0 ? tenant.monthlyRent : ("" as unknown as number),
      paidMonth: new Date().toISOString().slice(0, 7),
      paymentMethod: "Bank Transfer / EFT",
      notes: "",
    });
    setPopFile(null);
  };

  const onSavePayment = async () => {
    if (!selectedTenant?.propertyId) {
      alert("This tenant is unassigned. Please assign them to a property first.");
      return;
    }
    const numAmount = Number(paymentForm.amountPaid);
    if (!numAmount || numAmount <= 0) {
      alert("Enter a valid payment amount.");
      return;
    }
    setSaving(true);
    try {
      const admin = await fetchAdminInfo(user?.email ?? undefined);
      const executorName = admin.fullName || user?.email || "Admin";
      const compId = currentCompany?.id && isValidUuid(currentCompany.id) ? currentCompany.id : null;

      let popUrl: string | null = null;
      if (popFile) {
        try {
          popUrl = await uploadFileToBucket(
            "tenants",
            `pop/${selectedTenant.id}`,
            popFile
          );
        } catch (uploadErr) {
          console.warn("Could not upload POP file to bucket:", uploadErr);
        }
      }

      const paymentPayload: Record<string, unknown> = {
        tenant_id: selectedTenant.id,
        property_id: selectedTenant.propertyId,
        payment_date: paymentForm.paymentDate,
        amount_paid: numAmount,
        payment_method: paymentForm.paymentMethod,
        paid_months: [paymentForm.paidMonth],
        notes: paymentForm.notes ? `${paymentForm.notes} | Recorded by: ${executorName}` : `Recorded by: ${executorName}`,
        company_id: compId,
        executed_by_name: executorName,
      };

      if (popUrl) {
        paymentPayload.pop_url = popUrl;
        paymentPayload.pop_uploaded_by_name = executorName;
        paymentPayload.pop_uploaded_at = new Date().toISOString();
      }

      let insertedId: string | null = null;
      try {
        const { data: inserted, error: pErr } = await supabase
          .from("tenant_rent_payments")
          .insert(paymentPayload)
          .select("id")
          .single();
        if (pErr) throw pErr;
        insertedId = inserted?.id || null;
      } catch (insertErr) {
        console.warn("Primary insert failed, attempting fallback:", insertErr);
        const fallbackPayload: Record<string, unknown> = {
          tenant_id: selectedTenant.id,
          property_id: selectedTenant.propertyId,
          payment_date: paymentForm.paymentDate,
          amount_paid: numAmount,
          paid_months: [paymentForm.paidMonth],
          notes: `${paymentForm.notes ? paymentForm.notes + " | " : ""}Recorded by: ${executorName}${popUrl ? ` | POP: ${popUrl}` : ""}`,
          company_id: compId,
        };
        const { data: fbInserted, error: fbErr } = await supabase
          .from("tenant_rent_payments")
          .insert(fallbackPayload)
          .select("id")
          .single();
        if (fbErr) throw fbErr;
        insertedId = fbInserted?.id || null;
      }

      if (popUrl) {
        try {
          await supabase.from("tenant_payment_proofs").insert({
            tenant_id: selectedTenant.id,
            property_id: selectedTenant.propertyId,
            customer_name: selectedTenant.fullName,
            customer_email: selectedTenant.email,
            customer_phone: selectedTenant.phone,
            amount: numAmount,
            payment_date: paymentForm.paymentDate,
            document_url: popUrl,
            status: "verified",
            notes: `Recorded by Staff: ${executorName} | Method: ${paymentForm.paymentMethod}`,
            company_id: compId,
          });
        } catch (proofErr) {
          console.warn("Could not insert tenant_payment_proofs:", proofErr);
        }
      }

      try {
        await supabase.from("audit_log").insert({
          user_email: user?.email || "admin@paimbabook.com",
          user_name: executorName,
          action: "rent_payment_recorded",
          entity_type: "tenant_rent_payment",
          entity_id: insertedId && isValidUuid(insertedId) ? insertedId : null,
          company_id: compId,
          details: {
            tenant_name: selectedTenant.fullName,
            tenant_id: selectedTenant.id,
            property_id: selectedTenant.propertyId,
            amount_paid: numAmount,
            payment_date: paymentForm.paymentDate,
            paid_month: paymentForm.paidMonth,
            payment_method: paymentForm.paymentMethod,
            pop_url: popUrl,
            recorded_by: executorName,
          },
        });
      } catch {
        // audit log is non-fatal
      }

      setSelectedTenant(null);
      setPopFile(null);
      reload();
    } catch (saveError) {
      alert(saveError instanceof Error ? saveError.message : "Could not record rent payment.");
    } finally {
      setSaving(false);
    }
  };

  const onUploadRetroPop = async () => {
    if (!selectedPaymentDetail || !retroPopFile) return;
    setSavingRetroPop(true);
    try {
      const admin = await fetchAdminInfo(user?.email ?? undefined);
      const executorName = admin.fullName || user?.email || "Admin";
      const { payment, tenant } = selectedPaymentDetail;

      const popUrl = await uploadFileToBucket(
        "tenants",
        `pop/${payment.tenantId}`,
        retroPopFile
      );

      try {
        await supabase
          .from("tenant_rent_payments")
          .update({
            pop_url: popUrl,
            pop_uploaded_by_name: executorName,
            pop_uploaded_at: new Date().toISOString(),
          })
          .eq("id", payment.id);
      } catch (err) {
        console.warn("Could not update pop_url on payment:", err);
      }

      try {
        await supabase.from("tenant_payment_proofs").insert({
          tenant_id: tenant.id,
          property_id: tenant.propertyId,
          customer_name: tenant.fullName,
          customer_email: tenant.email,
          customer_phone: tenant.phone,
          amount: payment.amountPaid,
          payment_date: payment.paymentDate,
          document_url: popUrl,
          status: "verified",
          notes: `POP uploaded by: ${executorName} for payment on ${payment.paymentDate}`,
          company_id: currentCompany?.id && isValidUuid(currentCompany.id) ? currentCompany.id : null,
        });
      } catch (proofErr) {
        console.warn("Could not insert tenant_payment_proofs:", proofErr);
      }

      alert("Proof of payment uploaded successfully!");
      setSelectedPaymentDetail(null);
      setRetroPopFile(null);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to upload POP");
    } finally {
      setSavingRetroPop(false);
    }
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
    <ModulePage title="Record Rent Payment" description="Monitor payment cycles, record tenant payments, upload proof of payments (POP), and review verified audit trails.">
      {loading && <LoadingState label="Calculating collection metrics..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}
      {!loading && !error && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Collection Rate" value={`${stats.total ? Math.round((stats.paid / (stats.assigned || 1)) * 100) : 0}%`} detail="Current cycle efficiency" icon={TrendingUp} colorClass="text-green-600" />
            <StatCard label="Fully Settled" value={String(stats.paid)} detail={`${stats.assigned} active units`} icon={CheckCircle2} colorClass="text-sky-600" />
            <StatCard label="Arrears / Due" value={String(stats.overdue)} detail="Immediate action required" icon={AlertCircle} colorClass="text-red-600" />
            <StatCard label="Managed Tenants" value={String(stats.total)} detail={`${stats.unassigned} unassigned`} icon={Users} colorClass="text-muted" />
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
                  { key: "notice", label: "On Notice", count: tenants.filter(t => t.tenureStatus === "notice").length }
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
                              {isAssigned ? (
                                <button
                                  type="button"
                                  onClick={() => openRecordModal(tenant)}
                                  className="flex items-center gap-2 rounded-lg bg-foreground px-3 py-1.5 text-xs font-black text-surface hover:opacity-90 shadow-sm transition-all"
                                >
                                  <DollarSign size={14} />
                                  Record Payment
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => alert("This tenant is not assigned to any property yet. Please assign them to a property on the Properties or Tenants page before recording rent payments.")}
                                  className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-all"
                                  title="Cannot record rent for unassigned tenant"
                                >
                                  <AlertCircle size={13} />
                                  Unassigned
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
                                    {paymentsByTenant[tenant.id].slice(0, 10).map((pay) => (
                                      <div
                                        key={pay.id}
                                        onClick={() => setSelectedPaymentDetail({ payment: pay, tenant })}
                                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border-color bg-surface p-4 shadow-sm group/pay hover:border-foreground/30 hover:shadow-md transition-all cursor-pointer"
                                      >
                                        <div className="flex items-center gap-4">
                                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-600 dark:bg-green-900/20 shrink-0">
                                            <CheckCircle2 size={20} />
                                          </div>
                                          <div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                              <p className="font-bold text-foreground">{formatCurrency(pay.amountPaid)}</p>
                                              <span className="rounded-full bg-surface-elevated border border-border-color px-2 py-0.5 text-[10px] font-bold text-muted">
                                                {pay.paymentMethod || "EFT / Bank"}
                                              </span>
                                              {pay.popUrl ? (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                                                  <FileText size={11} /> POP Attached
                                                </span>
                                              ) : (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                                                  <UploadCloud size={11} /> Missing POP
                                                </span>
                                              )}
                                            </div>
                                            <p className="text-xs text-muted font-medium mt-0.5">
                                              Settled on {pay.paymentDate} • Recorded by {pay.executedByName || "Staff"}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                                          <button
                                            type="button"
                                            onClick={() => setSelectedPaymentDetail({ payment: pay, tenant })}
                                            className="rounded-lg border border-border-color bg-surface-elevated px-2.5 py-1.5 text-xs font-bold text-foreground hover:bg-surface transition flex items-center gap-1.5 shadow-2xs"
                                          >
                                            <Eye size={13} />
                                            <span>Details &amp; POP</span>
                                          </button>
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
        onClose={() => { setSelectedTenant(null); setPopFile(null); }}
        title={selectedTenant ? `Record Rent Payment: ${selectedTenant.fullName}` : "Record Rent Payment"}
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-border-color bg-surface-elevated/50 p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase text-muted/60">Assigned Property</p>
              <p className="font-bold text-foreground">{selectedTenant?.propertyName ?? "-"}</p>
              {selectedTenant && selectedTenant.monthlyRent > 0 && (
                <p className="text-xs font-bold text-emerald-600 mt-1">
                  Required Rent: NAD {selectedTenant.monthlyRent.toLocaleString()}
                </p>
              )}
            </div>
            <Building size={24} className="text-muted/20" />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Payment Date</label>
              <input
                type="date"
                value={paymentForm.paymentDate}
                onChange={(e) => setPaymentForm((prev) => ({ ...prev, paymentDate: e.target.value }))}
                className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-foreground/5"
              />
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Billing Month</label>
              <input
                type="month"
                value={paymentForm.paidMonth}
                onChange={(e) => setPaymentForm((prev) => ({ ...prev, paidMonth: e.target.value }))}
                className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-foreground/5"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Payment Method</label>
              <select
                value={paymentForm.paymentMethod}
                onChange={(e) => setPaymentForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-foreground/5"
              >
                <option value="Bank Transfer / EFT">Bank Transfer / EFT</option>
                <option value="Cash">Cash</option>
                <option value="Card / POS">Card / POS</option>
                <option value="Mobile Money">Mobile Money</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Amount Received (NAD)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted">NAD</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  placeholder="0.00"
                  value={paymentForm.amountPaid === ("" as unknown as number) ? "" : paymentForm.amountPaid}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, amountPaid: e.target.value === "" ? ("" as unknown as number) : Number(e.target.value) }))}
                  className="w-full rounded-lg border border-border-color bg-surface px-3 py-2 pl-12 text-lg font-black outline-none focus:ring-2 focus:ring-foreground/5"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Internal Notes / Payment Reference (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Reference code, receipt #, bank teller slip"
              value={paymentForm.notes}
              onChange={(e) => setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted">Proof of Payment (POP) File</label>
            <div className="rounded-xl border border-dashed border-border-color bg-surface-elevated/40 p-4 text-center hover:bg-surface-elevated/70 transition-colors">
              <input
                type="file"
                id="rent-pop-upload"
                accept="image/*,application/pdf"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setPopFile(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
              <label htmlFor="rent-pop-upload" className="cursor-pointer flex flex-col items-center gap-1.5">
                <UploadCloud size={24} className="text-muted" />
                <span className="text-xs font-bold text-foreground">
                  {popFile ? popFile.name : "Click to select or drop Proof of Payment (PDF / Image)"}
                </span>
                <span className="text-[10px] text-muted">Bank confirmation screenshot, scan, or EFT receipt</span>
              </label>
              {popFile && (
                <button
                  type="button"
                  onClick={() => setPopFile(null)}
                  className="mt-2 text-[10px] font-bold text-red-500 hover:underline"
                >
                  Remove attached file
                </button>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => { setSelectedTenant(null); setPopFile(null); }}
              className="rounded-lg border border-border-color px-4 py-2 text-sm font-bold text-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSavePayment}
              disabled={saving}
              className="rounded-lg bg-foreground px-6 py-2 text-sm font-black text-surface hover:opacity-90 disabled:opacity-50 shadow-md transition"
            >
              {saving ? "Recording..." : "Record Rent Payment"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Payment Details & Proof of Payment (POP) Inspection Modal */}
      <Modal
        open={Boolean(selectedPaymentDetail)}
        onClose={() => { setSelectedPaymentDetail(null); setRetroPopFile(null); }}
        title="Payment Record & Proof of Payment (POP)"
      >
        {selectedPaymentDetail && (
          <div className="space-y-5">
            <div className="rounded-xl border border-border-color bg-surface-elevated/50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-base text-foreground">{selectedPaymentDetail.tenant.fullName}</h4>
                  <p className="text-xs text-muted">{selectedPaymentDetail.tenant.propertyName}</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(selectedPaymentDetail.payment.amountPaid)}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                    Settled on {selectedPaymentDetail.payment.paymentDate}
                  </p>
                </div>
              </div>
              <div className="pt-2 border-t border-border-color/50 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-muted font-medium">Payment Method: </span>
                  <span className="font-bold text-foreground">{selectedPaymentDetail.payment.paymentMethod || "Bank Transfer / EFT"}</span>
                </div>
                <div>
                  <span className="text-muted font-medium">Recorded By: </span>
                  <span className="font-bold text-foreground">{selectedPaymentDetail.payment.executedByName || "Staff"}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border-color bg-surface p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-muted" />
                  <h5 className="font-bold text-sm text-foreground">Proof of Payment Document</h5>
                </div>
                {selectedPaymentDetail.payment.popUrl ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck size={12} /> Verified POP
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    <AlertCircle size={12} /> No POP Attached
                  </span>
                )}
              </div>

              {selectedPaymentDetail.payment.popUrl ? (
                <div className="space-y-3 pt-2">
                  <div className="rounded-lg bg-surface-elevated p-3 border border-border-color flex items-center justify-between">
                    <div className="min-w-0 pr-2">
                      <p className="text-xs font-bold text-foreground truncate">Proof of Payment File</p>
                      <p className="text-[10px] text-muted">
                        Uploaded by {selectedPaymentDetail.payment.popUploadedByName || "Staff"}
                        {selectedPaymentDetail.payment.popUploadedAt && ` on ${new Date(selectedPaymentDetail.payment.popUploadedAt).toLocaleString()}`}
                      </p>
                    </div>
                    <a
                      href={selectedPaymentDetail.payment.popUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-bold text-surface hover:opacity-90 shadow-2xs"
                    >
                      <ExternalLink size={13} />
                      <span>View POP</span>
                    </a>
                  </div>

                  <p className="text-[11px] text-muted">Need to replace or upload an updated proof of payment?</p>
                </div>
              ) : null}

              <div className="pt-2 border-t border-border-color/50 space-y-3">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                  {selectedPaymentDetail.payment.popUrl ? "Upload Replacement Proof of Payment" : "Attach Proof of Payment (POP)"}
                </label>
                <div className="rounded-xl border border-dashed border-border-color bg-surface-elevated/40 p-3 text-center">
                  <input
                    type="file"
                    id="retro-pop-upload"
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setRetroPopFile(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                  />
                  <label htmlFor="retro-pop-upload" className="cursor-pointer flex flex-col items-center gap-1">
                    <UploadCloud size={20} className="text-muted" />
                    <span className="text-xs font-bold text-foreground">
                      {retroPopFile ? retroPopFile.name : "Select POP Document (PDF / Image)"}
                    </span>
                  </label>
                </div>

                {retroPopFile && (
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setRetroPopFile(null)}
                      className="rounded-lg border border-border-color px-3 py-1.5 text-xs font-bold text-muted hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={onUploadRetroPop}
                      disabled={savingRetroPop}
                      className="rounded-lg bg-foreground px-4 py-1.5 text-xs font-bold text-surface hover:opacity-90 disabled:opacity-50"
                    >
                      {savingRetroPop ? "Uploading..." : "Save Proof of Payment"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => { setSelectedPaymentDetail(null); setRetroPopFile(null); }}
                className="rounded-lg border border-border-color px-4 py-2 text-sm font-bold text-foreground hover:bg-surface-elevated"
              >
                Close
              </button>
            </div>
          </div>
        )}
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


