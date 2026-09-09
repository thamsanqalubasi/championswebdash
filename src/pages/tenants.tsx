import { useEffect, useMemo, useState } from "react";
import { ModulePage } from "@/components/module-page";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { Modal, ConfirmDialog, SideDrawer } from "@/components/modal";
import { fetchTenantsData, isValidUuid } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { fetchCompanyInfo, fetchAdminInfo, uploadPdfFromHtml, createPdfAttachmentFromUrl, downloadHtmlDocument, downloadPdfDocument, downloadPdfFromUrl } from "@/lib/storage";
import { DocumentShareModal } from "@/components/document-share-modal";
import { buildProfessionalInvoiceHtml, buildProfessionalContractHtml } from "@/lib/document-templates";
import type { ContractSection } from "@/lib/document-templates";
import { sendEmail, sendWhatsApp } from "@/lib/notifications";
import type { TenantRow } from "@/lib/types";
import { Plus, User, Phone, Mail, Pencil, Trash, UserX, UserCheck, ChevronRight, MapPin, Calendar, CreditCard, Receipt, FileSignature, Activity, Send, Eye, Download } from "lucide-react";
import { DataTableHeader, StatusBadge, TableRowActions, TableActionButton } from "@/components/data-table";

type TenantPaymentRow = {
  id: string;
  paymentDate: string;
  amountPaid: number;
  recordedBy: string;
};

type TenantInvoiceRow = {
  id: string;
  month: string;
  dueDate: string;
  amount: number;
  status: string;
  pdfUrl: string;
  createdAt: string;
};

type InvoiceShareReportRow = {
  id: string;
  channel: "email" | "whatsapp";
  paymentDates: string[];
  sharedAt: string;
};

type TenantContractRow = {
  id: string;
  title: string;
  propertyName: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  depositAmount: number;
  status: string;
  notes: string;
  documentUrl: string;
  sections: ContractSection[];
};

const emptyForm = {
  full_name: "",
  id_number: "",
  phone: "",
  email: "",
  tenure_status: "active",
  property_id: "",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "NAD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function toMonthKey(dateValue: string) {
  return String(dateValue).slice(0, 7);
}

function extractDatesFromText(text: string) {
  const matches = text.match(/\d{4}-\d{2}-\d{2}/g);
  return matches ?? [];
}

function sanitizePhoneToWhatsApp(value: string) {
  return value.replace(/\D/g, "");
}

async function ensureShareableDocumentUrl(existingUrl: string, html: string, filename: string) {
  if (existingUrl && existingUrl.startsWith("http") && existingUrl.toLowerCase().includes(".pdf")) {
    return existingUrl;
  }

  const base = filename.replace(/\.html$/i, "").replace(/\.pdf$/i, "");
  const bucket = base.startsWith("invoice-") ? "invoice-pdfs" : "contract-documents";
  return uploadPdfFromHtml(bucket, "shared", html, base);
}

async function buildInvoiceHtmlProfessional(
  invoice: TenantInvoiceRow,
  tenantName: string,
  propertyName: string,
  paymentDates: string[],
  userEmail?: string,
) {
  const [company, admin] = await Promise.all([
    fetchCompanyInfo(),
    fetchAdminInfo(userEmail),
  ]);

  const lineItems = paymentDates.length > 0
    ? paymentDates.map((date) => ({ description: `Rent payment on ${date}`, amount: invoice.amount / paymentDates.length }))
    : [{ description: `Rent payment for ${invoice.month}`, amount: invoice.amount }];

  return buildProfessionalInvoiceHtml(
    {
      invoiceId: invoice.id,
      tenantName,
      propertyName,
      month: invoice.month,
      dueDate: invoice.dueDate,
      status: invoice.status,
      lineItems,
    },
    company,
    admin,
  );
}

export default function TenantsPage() {
  const { user, currentCompany } = useAuth();

  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<TenantRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);

  const [detailsRow, setDetailsRow] = useState<TenantRow | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [detailsPropertyId, setDetailsPropertyId] = useState<string>("");
  const [detailsPropertyName, setDetailsPropertyName] = useState<string>("Unassigned");
  const [assignmentDate, setAssignmentDate] = useState<string>("");
  const [assigningProperty, setAssigningProperty] = useState(false);

  const [payments, setPayments] = useState<TenantPaymentRow[]>([]);
  const [selectedPaymentIds, setSelectedPaymentIds] = useState<string[]>([]);
  const [invoices, setInvoices] = useState<TenantInvoiceRow[]>([]);
  const [shareReports, setShareReports] = useState<InvoiceShareReportRow[]>([]);

  const [generatingInvoice, setGeneratingInvoice] = useState(false);
  const [sharingInvoiceId, setSharingInvoiceId] = useState<string | null>(null);
  const [tenantContracts, setTenantContracts] = useState<TenantContractRow[]>([]);
  const [contractActionId, setContractActionId] = useState<string | null>(null);
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
        const result = await fetchTenantsData();
        if (!cancelled) {
          setTenants(result);
        }

        const { data: props, error: propsError } = await supabase
          .from("properties")
          .select("id, name")
          .order("name");

        if (propsError) throw propsError;

        if (!cancelled && props) {
          setProperties(props.map((item) => ({ id: String(item.id), name: String(item.name) })));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load tenants.");
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

  const reload = () => setReloadKey((value) => value + 1);

  const statusCounts = useMemo(
    () => ({
      all: tenants.length,
      active: tenants.filter((item) => item.tenureStatus === "active").length,
      notice: tenants.filter((item) => item.tenureStatus === "notice").length,
    }),
    [tenants],
  );

  const filtered = useMemo(() => {
    let result = activeFilter === "all" ? tenants : tenants.filter((tenant) => tenant.tenureStatus === activeFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) =>
        t.fullName.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        t.phone.toLowerCase().includes(q) ||
        t.propertyName.toLowerCase().includes(q)
      );
    }
    return result;
  }, [tenants, activeFilter, searchQuery]);

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (row: TenantRow) => {
    setEditingId(row.id);
    setForm({
      full_name: row.fullName,
      id_number: "",
      phone: row.phone,
      email: row.email,
      tenure_status: row.tenureStatus,
      property_id: "",
    });
    setModalOpen(true);
  };

  const onSave = async () => {
    if (!form.full_name.trim()) {
      alert("Please enter full name.");
      return;
    }

    if (!form.id_number.trim()) {
      alert("Please enter ID number.");
      return;
    }

    if (!form.phone.trim() || !form.email.trim()) {
      alert("Please enter phone and email.");
      return;
    }

    setSaving(true);

    try {
      const parts = form.full_name.trim().split(/\s+/);
      const firstName = parts[0] || "";
      const surname = parts.slice(1).join(" ") || parts[0] || "";

      const payload: Record<string, unknown> = {
        full_name: form.full_name.trim(),
        first_name: firstName,
        surname: surname,
        id_number: form.id_number.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        tenure_status: form.tenure_status,
        company_id: currentCompany?.id && isValidUuid(currentCompany.id) ? currentCompany.id : null,
      };

      if (form.property_id && isValidUuid(form.property_id)) {
        payload.property_id = form.property_id;
        payload.tenure_start_date = new Date().toISOString().slice(0, 10);
      }

      if (editingId) {
        const { error: updateError } = await supabase.from("tenants").update(payload).eq("id", editingId);
        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase.from("tenants").insert(payload);
        if (insertError) throw insertError;
      }

      setModalOpen(false);
      reload();
    } catch (saveError) {
      alert(saveError instanceof Error ? saveError.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeleting(true);

    try {
      const { error: deleteError } = await supabase.from("tenants").delete().eq("id", deleteTarget.id);
      if (deleteError) throw deleteError;

      setDeleteTarget(null);
      reload();
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  const onStatusChange = async (id: string, newStatus: string) => {
    const { error: statusError } = await supabase
      .from("tenants")
      .update({ tenure_status: newStatus })
      .eq("id", id);

    if (statusError) {
      alert(statusError.message);
      return;
    }

    reload();
  };

  const loadTenantDetails = async (tenantId: string) => {
    setDetailsLoading(true);
    setDetailsError(null);

    try {
      const [tenantResult, paymentsResult, invoicesResult, sharesResult, contractsResult] = await Promise.all([
        supabase
          .from("tenants")
          .select("id, property_id, tenure_start_date, created_at, properties(name)")
          .eq("id", tenantId)
          .single(),
        supabase
          .from("tenant_rent_payments")
          .select("id, payment_date, amount_paid")
          .eq("tenant_id", tenantId)
          .order("payment_date", { ascending: false }),
        supabase
          .from("invoices")
          .select("id, month, due_date, total_amount, status, pdf_url, created_at")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false }),
        supabase
          .from("audit_log")
          .select("id, created_at, details")
          .eq("entity_type", "invoice_share")
          .eq("entity_id", tenantId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("contracts")
          .select("id, title, start_date, end_date, monthly_rent, deposit_amount, status, notes, document_url, properties(name)")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false }),
      ]);

      if (tenantResult.error) throw tenantResult.error;
      if (paymentsResult.error) throw paymentsResult.error;
      if (invoicesResult.error) throw invoicesResult.error;
      if (sharesResult.error) throw sharesResult.error;
      if (contractsResult.error) throw contractsResult.error;

      // Load contract sections
      const contractIds = (contractsResult.data ?? []).map((c) => String(c.id));
      let contractSectionsMap: Record<string, ContractSection[]> = {};
      if (contractIds.length > 0) {
        const { data: cs } = await supabase
          .from("contract_sections")
          .select("contract_id, order_index, title, content")
          .in("contract_id", contractIds)
          .order("order_index");
        if (cs) {
          contractSectionsMap = {};
          cs.forEach((s) => {
            const cid = String((s as Record<string, unknown>).contract_id ?? "");
            if (!contractSectionsMap[cid]) contractSectionsMap[cid] = [];
            contractSectionsMap[cid].push({ title: String(s.title), content: String(s.content) });
          });
        }
      }

      setTenantContracts(
        (contractsResult.data ?? []).map((c) => ({
          id: String(c.id),
          title: String(c.title ?? "Lease Agreement"),
          propertyName: String((c.properties as { name?: string } | null)?.name ?? "-"),
          startDate: String(c.start_date ?? ""),
          endDate: String(c.end_date ?? ""),
          monthlyRent: Number(c.monthly_rent ?? 0),
          depositAmount: Number(c.deposit_amount ?? 0),
          status: String(c.status ?? "pending"),
          notes: String(c.notes ?? ""),
          documentUrl: String(c.document_url ?? ""),
          sections: contractSectionsMap[String(c.id)] ?? [],
        })),
      );

      const paymentRows = paymentsResult.data ?? [];
      const paymentIds = paymentRows.map((item) => String(item.id ?? "")).filter(Boolean);

      let recordedByMap = new Map<string, string>();
      if (paymentIds.length) {
        const { data: paymentAudits, error: paymentAuditsError } = await supabase
          .from("audit_log")
          .select("entity_id, user_name, user_email, created_at")
          .eq("entity_type", "tenant_rent_payment")
          .eq("action", "rent_payment_recorded")
          .in("entity_id", paymentIds)
          .order("created_at", { ascending: false });

        if (paymentAuditsError) throw paymentAuditsError;

        recordedByMap = new Map<string, string>();
        (paymentAudits ?? []).forEach((row) => {
          const entityId = String(row.entity_id ?? "");
          if (!entityId || recordedByMap.has(entityId)) {
            return;
          }

          recordedByMap.set(entityId, String(row.user_name ?? row.user_email ?? "Admin"));
        });
      }

      const tenant = tenantResult.data;
      setDetailsPropertyId(String(tenant.property_id ?? ""));
      setDetailsPropertyName(String((tenant.properties as { name?: string } | null)?.name ?? "Unassigned"));
      setAssignmentDate(String(tenant.tenure_start_date ?? tenant.created_at ?? ""));

      setPayments(
        paymentRows.map((row) => ({
          id: String(row.id ?? ""),
          paymentDate: String(row.payment_date ?? ""),
          amountPaid: Number(row.amount_paid ?? 0),
          recordedBy: recordedByMap.get(String(row.id ?? "")) ?? "Admin",
        })),
      );

      setInvoices(
        (invoicesResult.data ?? []).map((row) => ({
          id: String(row.id ?? ""),
          month: String(row.month ?? "-"),
          dueDate: String(row.due_date ?? "-"),
          amount: Number(row.total_amount ?? 0),
          status: String(row.status ?? "draft"),
          pdfUrl: String(row.pdf_url ?? ""),
          createdAt: String(row.created_at ?? ""),
        })),
      );

      setShareReports(
        (sharesResult.data ?? []).map((row) => {
          const details = (row.details as { channel?: "email" | "whatsapp"; payment_dates?: string[] } | null) ?? {};
          return {
            id: String(row.id ?? ""),
            channel: details.channel === "whatsapp" ? "whatsapp" : "email",
            paymentDates: Array.isArray(details.payment_dates) ? details.payment_dates.map((value) => String(value)) : [],
            sharedAt: String(row.created_at ?? ""),
          };
        }),
      );

      setSelectedPaymentIds([]);
    } catch (loadError) {
      setDetailsError(loadError instanceof Error ? loadError.message : "Could not load tenant detail audit trail.");
    } finally {
      setDetailsLoading(false);
    }
  };

  const openTenantDetails = (row: TenantRow) => {
    setDetailsRow(row);
    void loadTenantDetails(row.id);
  };

  const selectedPayments = useMemo(
    () => payments.filter((payment) => selectedPaymentIds.includes(payment.id)),
    [payments, selectedPaymentIds],
  );

  const togglePaymentSelection = (paymentId: string) => {
    setSelectedPaymentIds((previous) =>
      previous.includes(paymentId)
        ? previous.filter((id) => id !== paymentId)
        : [...previous, paymentId],
    );
  };

  const assignTenantToProperty = async () => {
    if (!detailsRow) {
      return;
    }

    setAssigningProperty(true);

    try {
      const payload: Record<string, unknown> = {
        property_id: (detailsPropertyId && isValidUuid(detailsPropertyId)) ? detailsPropertyId : null,
      };

      if (detailsPropertyId && isValidUuid(detailsPropertyId)) {
        payload.tenure_start_date = new Date().toISOString().slice(0, 10);
      }

      const { error: assignError } = await supabase
        .from("tenants")
        .update(payload)
        .eq("id", detailsRow.id);

      if (assignError) throw assignError;

      reload();
      await loadTenantDetails(detailsRow.id);
    } catch (assignError) {
      alert(assignError instanceof Error ? assignError.message : "Could not update assignment.");
    } finally {
      setAssigningProperty(false);
    }
  };

  const generateInvoiceFromSelectedPayments = async () => {
    if (!detailsRow) {
      return;
    }

    if (selectedPayments.length === 0) {
      alert("Select one or more payment transactions first.");
      return;
    }

    if (!detailsPropertyId || !isValidUuid(detailsPropertyId)) {
      alert("Assign tenant to a valid property first.");
      return;
    }

    setGeneratingInvoice(true);

    try {
      const sortedMonthKeys = Array.from(
        new Set(selectedPayments.map((payment) => toMonthKey(payment.paymentDate)).filter(Boolean)),
      ).sort((a, b) => b.localeCompare(a));

      const invoiceMonthLabel =
        sortedMonthKeys.length <= 1
          ? sortedMonthKeys[0]
          : `${sortedMonthKeys.at(-1)}_to_${sortedMonthKeys[0]}`;

      const { data: existingInvoice, error: existingError } = await supabase
        .from("invoices")
        .select("id")
        .eq("tenant_id", detailsRow.id)
        .eq("property_id", detailsPropertyId)
        .eq("month", invoiceMonthLabel)
        .limit(1)
        .maybeSingle();

      if (existingError) throw existingError;

      if (existingInvoice?.id) {
        alert("Invoice already exists for selected transaction period. Duplicate generation blocked.");
        return;
      }

      const totalAmount = selectedPayments.reduce((sum, payment) => sum + payment.amountPaid, 0);
      const dueDate = new Date().toISOString().slice(0, 10);
      const compId = currentCompany?.id && isValidUuid(currentCompany.id) ? currentCompany.id : null;

      const { data: createdInvoice, error: createError } = await supabase
        .from("invoices")
        .insert({
          tenant_id: detailsRow.id,
          property_id: detailsPropertyId,
          month: invoiceMonthLabel,
          due_date: dueDate,
          total_amount: totalAmount,
          status: "paid",
          company_id: compId,
        })
        .select("id")
        .single();

      if (createError) throw createError;

      const { error: itemsError } = await supabase.from("invoice_items").insert(
        selectedPayments.map((payment) => ({
          invoice_id: createdInvoice.id,
          description: `Payment on ${payment.paymentDate} recorded by ${payment.recordedBy}`,
          amount: payment.amountPaid,
          company_id: compId,
        })),
      );

      if (itemsError) throw itemsError;

      await loadTenantDetails(detailsRow.id);
      reload();
      alert("Invoice generated from selected transactions.");
    } catch (generateError) {
      alert(generateError instanceof Error ? generateError.message : "Could not generate invoice.");
    } finally {
      setGeneratingInvoice(false);
    }
  };

  const getInvoicePaymentDates = async (invoiceId: string) => {
    const { data, error: itemsError } = await supabase
      .from("invoice_items")
      .select("description")
      .eq("invoice_id", invoiceId);

    if (itemsError) throw itemsError;

    return Array.from(
      new Set(
        (data ?? [])
          .flatMap((item) => extractDatesFromText(String(item.description ?? ""))),
      ),
    );
  };

  const openInvoicePreview = async (invoice: TenantInvoiceRow) => {
    if (!detailsRow) return;

    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) { alert("Please allow popups to preview invoice."); return; }

    try {
      if (invoice.pdfUrl && invoice.pdfUrl.startsWith("http")) {
        previewWindow.location.href = invoice.pdfUrl;
        return;
      }

      // Check if we have stored HTML in pdf_url
      if (invoice.pdfUrl && invoice.pdfUrl.startsWith("<")) {
        previewWindow.document.open();
        previewWindow.document.write(invoice.pdfUrl);
        previewWindow.document.close();
        return;
      }

      const paymentDates = await getInvoicePaymentDates(invoice.id);
      const html = await buildInvoiceHtmlProfessional(invoice, detailsRow.fullName, detailsPropertyName, paymentDates, user?.email ?? undefined);

      // Save the HTML to DB for future use
      await supabase.from("invoices").update({ pdf_url: html }).eq("id", invoice.id);

      previewWindow.document.open();
      previewWindow.document.write(html);
      previewWindow.document.close();
    } catch (previewError) {
      alert(previewError instanceof Error ? previewError.message : "Could not preview invoice.");
      previewWindow.close();
    }
  };

  const downloadInvoice = async (invoice: TenantInvoiceRow) => {
    if (!detailsRow) return;

    try {
      const fileNameBase = `invoice-${detailsRow.fullName.replace(/\s+/g, "_")}-${invoice.month}`;
      if (invoice.pdfUrl && invoice.pdfUrl.startsWith("http") && invoice.pdfUrl.toLowerCase().includes(".pdf")) {
        await downloadPdfFromUrl(invoice.pdfUrl, fileNameBase);
        return;
      }

      if (invoice.pdfUrl && invoice.pdfUrl.startsWith("<")) {
        downloadPdfDocument(invoice.pdfUrl, fileNameBase);
        return;
      }

      const paymentDates = await getInvoicePaymentDates(invoice.id);
      const html = await buildInvoiceHtmlProfessional(invoice, detailsRow.fullName, detailsPropertyName, paymentDates, user?.email ?? undefined);
      downloadPdfDocument(html, fileNameBase);
    } catch (downloadError) {
      alert(downloadError instanceof Error ? downloadError.message : "Could not download invoice.");
    }
  };

  const logShareReport = async (
    tenantId: string,
    invoiceId: string,
    channel: "email" | "whatsapp",
    paymentDates: string[],
  ) => {
    const { error: logError } = await supabase.from("audit_log").insert({
      user_email: user?.email || "admin@championscourt.co.za",
      user_name: user?.email ?? "Admin",
      action: "invoice_shared",
      entity_type: "invoice_share",
      entity_id: isValidUuid(tenantId) ? tenantId : null,
      company_id: currentCompany?.id && isValidUuid(currentCompany.id) ? currentCompany.id : null,
      details: {
        channel,
        invoice_id: invoiceId,
        payment_dates: paymentDates,
      },
    });

    if (logError) throw logError;
  };

  const shareInvoice = async (invoice: TenantInvoiceRow, channel: "email" | "whatsapp") => {
    if (!detailsRow) {
      return;
    }

    setSharingInvoiceId(invoice.id);

    try {
      const paymentDates = await getInvoicePaymentDates(invoice.id);
      const paymentsLabel = paymentDates.length ? paymentDates.join(", ") : "linked dates unavailable";

      // Build professional invoice HTML for email attachment
      const invoiceHtml = await buildInvoiceHtmlProfessional(
        invoice,
        detailsRow.fullName,
        detailsPropertyName,
        paymentDates,
        user?.email ?? undefined,
      );

      if (channel === "email") {
        const pdfUrl = await ensureShareableDocumentUrl(invoice.pdfUrl, invoiceHtml, `invoice-${invoice.id}.pdf`);
        if (pdfUrl && pdfUrl !== invoice.pdfUrl) {
          await supabase.from("invoices").update({ pdf_url: pdfUrl }).eq("id", invoice.id);
        }
        setShareModalDoc({
          isOpen: true,
          documentTitle: `Invoice #${invoice.id.slice(0, 8)} (${invoice.month})`,
          documentType: "Invoice",
          documentHtml: invoiceHtml,
          documentUrl: pdfUrl,
          fileNameBase: `invoice-${detailsRow.fullName.replace(/\s+/g, "_")}-${invoice.month}`,
          ownerName: detailsRow.fullName,
          ownerEmail: detailsRow.email || "",
          defaultSubject: `Invoice ${invoice.month} - ${detailsRow.fullName}`,
          defaultMessage: `Dear ${detailsRow.fullName},\n\nPlease find your rental invoice for ${invoice.month} attached in the amount of ${formatCurrency(invoice.amount)}.`,
        });
        return;
      } else {
        const phone = sanitizePhoneToWhatsApp(detailsRow.phone ?? "");
        if (!phone) {
          alert("Tenant phone is missing.");
          return;
        }

        const latestPdfUrl = await ensureShareableDocumentUrl(invoice.pdfUrl, invoiceHtml, `invoice-${invoice.id}.pdf`);
        const result = await sendWhatsApp({
          to: `+${phone}`,
          message: messageText,
          mediaUrl: latestPdfUrl,
        });

        await supabase.from("invoices").update({ pdf_url: latestPdfUrl }).eq("id", invoice.id);

        if (result.sent) {
          alert("Invoice sent via WhatsApp successfully!");
        }
      }

      await logShareReport(detailsRow.id, invoice.id, channel, paymentDates);
      await loadTenantDetails(detailsRow.id);
    } catch (shareError) {
      alert(shareError instanceof Error ? shareError.message : "Could not share invoice.");
    } finally {
      setSharingInvoiceId(null);
    }
  };

  /* ---- Contract preview / download / share helpers ---- */

  const buildContractHtmlForTenant = async (contract: TenantContractRow) => {
    if (!detailsRow) throw new Error("No tenant selected");
    const [company, admin] = await Promise.all([
      fetchCompanyInfo(),
      fetchAdminInfo(user?.email ?? undefined),
    ]);
    return buildProfessionalContractHtml(
      {
        contractTitle: contract.title,
        tenantName: detailsRow.fullName,
        propertyName: contract.propertyName,
        startDate: contract.startDate,
        endDate: contract.endDate,
        monthlyRent: contract.monthlyRent,
        depositAmount: contract.depositAmount,
        status: contract.status,
        notes: contract.notes,
        sections: contract.sections,
      },
      company,
      admin,
    );
  };

  const openContractPreview = async (contract: TenantContractRow) => {
    const previewWindow = window.open("about:blank", "_blank");
    if (!previewWindow) { alert("Please allow popups to preview contract."); return; }
    try {
      if (contract.documentUrl && contract.documentUrl.startsWith("http")) {
        previewWindow.location.href = contract.documentUrl;
        return;
      }
      const html = await buildContractHtmlForTenant(contract);
      previewWindow.document.open();
      previewWindow.document.write(html);
      previewWindow.document.close();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not preview contract.");
      previewWindow.close();
    }
  };

  const downloadContract = async (contract: TenantContractRow) => {
    try {
      const fileNameBase = `contract-${contract.title.replace(/\s+/g, "-")}`;
      if (contract.documentUrl && contract.documentUrl.startsWith("http") && contract.documentUrl.toLowerCase().includes(".pdf")) {
        await downloadPdfFromUrl(contract.documentUrl, fileNameBase);
        return;
      }
      const html = await buildContractHtmlForTenant(contract);
      downloadPdfDocument(html, fileNameBase);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not download contract.");
    }
  };

  const shareContract = async (contract: TenantContractRow, channel: "email" | "whatsapp") => {
    if (!detailsRow) return;
    setContractActionId(contract.id);
    try {
      const messageText = `${contract.title} for ${contract.propertyName}: ${formatDate(contract.startDate)} – ${formatDate(contract.endDate)}, Monthly rent ${formatCurrency(contract.monthlyRent)}.`;
      const contractHtml = await buildContractHtmlForTenant(contract);

      if (channel === "email") {
        const pdfUrl = await ensureShareableDocumentUrl(contract.documentUrl, contractHtml, `contract-${contract.id}.pdf`);
        if (pdfUrl && pdfUrl !== contract.documentUrl) {
          await supabase.from("contracts").update({ document_url: pdfUrl }).eq("id", contract.id);
        }
        setShareModalDoc({
          isOpen: true,
          documentTitle: `${contract.title} - ${detailsRow.fullName}`,
          documentType: "Contract",
          documentHtml: contractHtml,
          documentUrl: pdfUrl,
          fileNameBase: `contract-${contract.title.replace(/\s+/g, "_")}`,
          ownerName: detailsRow.fullName,
          ownerEmail: detailsRow.email || "",
          defaultSubject: `${contract.title} - ${detailsRow.fullName}`,
          defaultMessage: `Dear ${detailsRow.fullName},\n\nPlease find your lease agreement "${contract.title}" for ${contract.propertyName} attached. The contract period is ${formatDate(contract.startDate)} to ${formatDate(contract.endDate)} with a monthly rent of ${formatCurrency(contract.monthlyRent)}.`,
        });
        return;
      } else {
        const phone = sanitizePhoneToWhatsApp(detailsRow.phone ?? "");
        if (!phone) { alert("Tenant phone is missing."); return; }
        const latestContractPdfUrl = await ensureShareableDocumentUrl(contract.documentUrl, contractHtml, `contract-${contract.id}.pdf`);
        const result = await sendWhatsApp({
          to: `+${phone}`,
          message: messageText,
          mediaUrl: latestContractPdfUrl,
        });

        await supabase.from("contracts").update({ document_url: latestContractPdfUrl }).eq("id", contract.id);
        if (result.sent) {
          alert("Contract sent via WhatsApp successfully!");
        }
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Could not share contract.");
    } finally {
      setContractActionId(null);
    }
  };

  const filterTabs = [
    { key: "all", label: "All Tenants", count: statusCounts.all },
    { key: "active", label: "Active", count: statusCounts.active },
    { key: "notice", label: "Notice", count: statusCounts.notice },
  ];

  return (
    <ModulePage title="Tenants" description="Manage tenant records, property assignments, and payment history.">
      {loading && <LoadingState label="Loading tenants..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && (
        <section className="rounded-xl border border-border-color bg-surface p-1">
          <div className="p-4">
            <DataTableHeader
              searchValue={searchQuery}
              onSearchChange={setSearchQuery}
              searchPlaceholder="Search tenants by name, email, or property..."
              filters={filterTabs}
              activeFilter={activeFilter}
              onFilterChange={setActiveFilter}
              actions={
                <button
                  type="button"
                  onClick={openAdd}
                  className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-surface hover:opacity-90 transition-all"
                >
                  <Plus size={16} />
                  <span>Add Tenant</span>
                </button>
              }
            />
          </div>

          {filtered.length === 0 ? (
            <div className="p-12">
              <EmptyState title="No tenants found" description={searchQuery ? "Try a different search term or filter." : "Add a tenant to get started."} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border-color text-left text-muted/60 uppercase text-[10px] font-bold tracking-wider">
                    <th className="px-6 py-4 font-bold">Tenant</th>
                    <th className="px-6 py-4 font-bold">Property</th>
                    <th className="px-6 py-4 font-bold">Contact</th>
                    <th className="px-6 py-4 font-bold text-center">Tenure</th>
                    <th className="px-6 py-4 font-bold text-center">Rent Status</th>
                    <th className="px-6 py-4 font-bold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color/40">
                  {filtered.map((row) => (
                    <tr key={row.id} className="group hover:bg-surface-elevated/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/5 group-hover:bg-foreground group-hover:text-surface transition-all">
                            <User size={20} className="text-muted/60 group-hover:text-current" />
                          </div>
                          <button
                            type="button"
                            onClick={() => openTenantDetails(row)}
                            className="text-left font-bold tracking-tight text-foreground hover:underline decoration-foreground/30 underline-offset-4"
                          >
                            {row.fullName}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-muted/80">{row.propertyName}</td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-xs text-muted">
                            <Phone size={12} />
                            <span>{row.phone}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-muted">
                            <Mail size={12} />
                            <span>{row.email}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <StatusBadge status={row.tenureStatus} />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <StatusBadge status={row.rentStatus} />
                      </td>
                      <td className="px-6 py-4">
                        <TableRowActions>
                          <TableActionButton
                            icon={Pencil}
                            label="Edit"
                            onClick={() => openEdit(row)}
                          />
                          {row.tenureStatus === "active" && (
                            <TableActionButton
                              icon={UserX}
                              label="Give Notice"
                              onClick={() => onStatusChange(row.id, "notice")}
                            />
                          )}
                          {row.tenureStatus === "notice" && (
                            <TableActionButton
                              icon={UserCheck}
                              label="Reactivate"
                              onClick={() => onStatusChange(row.id, "active")}
                              variant="success"
                            />
                          )}
                          <TableActionButton
                            icon={Trash}
                            label="Delete"
                            variant="danger"
                            onClick={() => setDeleteTarget(row)}
                          />
                        </TableRowActions>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="border-t border-border-color/50 px-6 py-4 bg-surface-elevated/20">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted/40">
              Showing {filtered.length} of {statusCounts.all} tenants
            </p>
          </div>
        </section>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit Tenant" : "Add Tenant"}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-muted">Full Name</label>
            <input
              value={form.full_name}
              onChange={(event) => setForm({ ...form, full_name: event.target.value })}
              className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">ID Number</label>
            <input
              value={form.id_number}
              onChange={(event) => setForm({ ...form, id_number: event.target.value })}
              className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Phone</label>
            <input
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
              className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Property</label>
            <select
              value={form.property_id}
              onChange={(event) => setForm({ ...form, property_id: event.target.value })}
              className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none"
            >
              <option value="">Select property...</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-muted">Tenure Status</label>
            <select
              value={form.tenure_status}
              onChange={(event) => setForm({ ...form, tenure_status: event.target.value })}
              className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none"
            >
              <option value="active">Active</option>
              <option value="notice">Notice</option>
              <option value="ended">Ended</option>
            </select>
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
              onClick={onSave}
              disabled={saving}
              className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={onDelete}
        title="Delete Tenant"
        message={`Delete "${deleteTarget?.fullName}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={deleting}
      />

      <SideDrawer open={Boolean(detailsRow)} onClose={() => setDetailsRow(null)} title="Tenant Account Overview">
        {!detailsRow && null}

        {detailsRow && detailsLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <LoadingState label="Retreiving comprehensive audit trail..." />
          </div>
        )}

        {detailsRow && !detailsLoading && detailsError && (
          <ErrorState message={detailsError} onRetry={() => void loadTenantDetails(detailsRow.id)} />
        )}

        {detailsRow && !detailsLoading && !detailsError && (
          <div className="space-y-8 pb-10">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 bg-surface-elevated/50 p-6 rounded-2xl ring-1 ring-border-color/50 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-foreground text-surface shadow-lg">
                  <User size={28} />
                </div>
                <div>
                  <h4 className="text-xl font-bold tracking-tight text-foreground">{detailsRow.fullName}</h4>
                  <div className="flex items-center gap-3 mt-1">
                    <StatusBadge status={detailsRow.tenureStatus} />
                    <StatusBadge status={detailsRow.rentStatus} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted/60">Assigned Property</p>
                  <div className="flex items-center gap-1.5 font-bold text-foreground">
                    <MapPin size={14} className="text-muted/40" />
                    <span>{detailsPropertyName || "Unassigned"}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted/60">Joined Since</p>
                  <div className="flex items-center gap-1.5 font-bold text-foreground">
                    <Calendar size={14} className="text-muted/40" />
                    <span>{formatDate(assignmentDate)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions / Assignment */}
            <section className="space-y-3">
              <h5 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted/40 px-1">Assignment Controls</h5>
              <div className="flex items-center gap-3 p-4 bg-surface-elevated/30 rounded-xl border border-border-color/40">
                <div className="flex-1">
                  <select
                    value={detailsPropertyId}
                    onChange={(event) => setDetailsPropertyId(event.target.value)}
                    className="w-full rounded-lg border border-border-color bg-surface px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-foreground/5 transition-all"
                  >
                    <option value="">Unassign tenant (Available Units)</option>
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>{property.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={assignTenantToProperty}
                  disabled={assigningProperty}
                  className="rounded-lg bg-foreground px-6 py-2 text-sm font-bold text-surface hover:opacity-90 transition-all disabled:opacity-50"
                >
                  {assigningProperty ? "Saving..." : "Update Unit"}
                </button>
              </div>
            </section>

            {/* Payments Section */}
            <section className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <CreditCard size={16} className="text-muted/40" />
                  <h5 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted/40">Recent Transactions</h5>
                </div>
                <p className="text-[10px] text-muted italic">Select items to batch into invoice</p>
              </div>

              {payments.length === 0 ? (
                <EmptyState title="No transactions" description="Tenant has no recorded payments yet." />
              ) : (
                <div className="overflow-hidden rounded-xl border border-border-color bg-surface">
                  <table className="min-w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border-color/50 bg-surface-elevated/30 text-left text-muted/50 uppercase text-[9px] font-bold tracking-wider">
                        <th className="px-4 py-3 text-center">Batch</th>
                        <th className="px-4 py-3">Date</th>
                        <th className="px-4 py-3">Amount</th>
                        <th className="px-4 py-3">Verified By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-color/30">
                      {payments.map((payment) => (
                        <tr key={payment.id} className={`group hover:bg-surface-elevated/20 transition-colors ${selectedPaymentIds.includes(payment.id) ? "bg-foreground/[0.02]" : ""}`}>
                          <td className="px-4 py-4 text-center">
                            <input
                              type="checkbox"
                              checked={selectedPaymentIds.includes(payment.id)}
                              onChange={() => togglePaymentSelection(payment.id)}
                              className="h-4 w-4 rounded border-border-color accent-foreground"
                            />
                          </td>
                          <td className="px-4 py-4 font-medium text-foreground">{payment.paymentDate}</td>
                          <td className="px-4 py-4 font-bold text-foreground">{formatCurrency(payment.amountPaid)}</td>
                          <td className="px-4 py-4 text-muted/80">{payment.recordedBy}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="p-4 border-t border-border-color/50 bg-surface-elevated/20">
                    <button
                      type="button"
                      onClick={generateInvoiceFromSelectedPayments}
                      disabled={generatingInvoice || selectedPaymentIds.length === 0}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-foreground py-3 text-sm font-bold text-surface hover:opacity-90 transition-all disabled:opacity-50 shadow-md"
                    >
                      <Receipt size={18} />
                      <span>{generatingInvoice ? "Generating..." : `Generate Invoice from ${selectedPaymentIds.length} Selected`}</span>
                    </button>
                  </div>
                </div>
              )}
            </section>

            {/* Invoices & Contracts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Invoices Sub-section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <Receipt size={16} className="text-muted/40" />
                  <h5 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted/40">Invoices</h5>
                </div>

                {invoices.length === 0 ? (
                  <div className="py-10 border border-dashed border-border-color rounded-xl"><EmptyState title="No invoices" description="" /></div>
                ) : (
                  <div className="space-y-3">
                    {invoices.map((invoice) => (
                      <div key={invoice.id} className="p-4 rounded-xl border border-border-color bg-surface-elevated/40 hover:bg-surface-elevated transition-colors group">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-bold text-foreground">{invoice.month}</p>
                          <StatusBadge status={invoice.status} />
                        </div>
                        <p className="text-lg font-bold text-foreground">{formatCurrency(invoice.amount)}</p>
                        <div className="flex items-center gap-1.5 mt-4 pt-4 border-t border-border-color/40 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => void openInvoicePreview(invoice)} className="p-1.5 rounded-lg border border-border-color hover:bg-foreground hover:text-surface transition-all" title="View"><Eye size={14} /></button>
                          <button onClick={() => void downloadInvoice(invoice)} className="p-1.5 rounded-lg border border-border-color hover:bg-foreground hover:text-surface transition-all" title="Download"><Download size={14} /></button>
                          <button onClick={() => void shareInvoice(invoice, "whatsapp")} disabled={sharingInvoiceId === invoice.id} className="p-1.5 rounded-lg border border-border-color hover:bg-green-600 hover:text-white transition-all" title="WhatsApp"><Send size={14} /></button>
                          <button onClick={() => void shareInvoice(invoice, "email")} disabled={sharingInvoiceId === invoice.id} className="p-1.5 rounded-lg border border-border-color hover:bg-sky-600 hover:text-white transition-all" title="Email"><Mail size={14} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Contracts Sub-section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <FileSignature size={16} className="text-muted/40" />
                  <h5 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted/40">Contracts</h5>
                </div>

                {tenantContracts.length === 0 ? (
                  <div className="py-10 border border-dashed border-border-color rounded-xl"><EmptyState title="No active contracts" description="" /></div>
                ) : (
                  <div className="space-y-4">
                    {tenantContracts.map((contract) => (
                      <div key={contract.id} className="p-5 rounded-2xl border-2 border-border-color bg-surface group relative overflow-hidden">
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-sm font-black tracking-tight text-foreground uppercase">{contract.title}</p>
                          <StatusBadge status={contract.status} />
                        </div>
                        <div className="grid grid-cols-2 gap-y-4 text-xs">
                          <div>
                            <p className="text-[9px] font-bold text-muted/50 uppercase mb-1">Rental Period</p>
                            <p className="font-bold">{formatDate(contract.startDate)} - {formatDate(contract.endDate)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[9px] font-bold text-muted/50 uppercase mb-1">Monthly Cost</p>
                            <p className="font-bold text-foreground text-sm">{formatCurrency(contract.monthlyRent)}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-end gap-1.5 mt-6">
                          <button onClick={() => void openContractPreview(contract)} className="p-2 rounded-xl bg-surface-elevated border border-border-color hover:border-foreground/20 transition-all shadow-sm"><Eye size={16} className="text-muted" /></button>
                          <button onClick={() => void downloadContract(contract)} className="p-2 rounded-xl bg-surface-elevated border border-border-color hover:border-foreground/20 transition-all shadow-sm"><Download size={16} className="text-muted" /></button>
                          <button onClick={() => void shareContract(contract, "whatsapp")} className="p-2 rounded-xl bg-green-50 text-green-600 border border-green-100 hover:bg-green-600 hover:text-white transition-all shadow-sm"><Send size={16} /></button>
                        </div>
                        <div className={`absolute bottom-0 left-0 h-1.5 w-full bg-current opacity-5 ${contract.status === "active" ? "text-green-500" : "text-amber-500"}`} />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            {/* Activity Log / Share Report */}
            <section className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <Activity size={16} className="text-muted/40" />
                <h5 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted/40">Communication Audit</h5>
              </div>

              {shareReports.length === 0 ? (
                <div className="p-6 rounded-xl bg-surface-elevated/30 text-center border border-border-color/40">
                  <p className="text-xs text-muted">No external communication recorded yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {shareReports.map((report) => (
                    <div key={report.id} className="flex items-center justify-between p-4 rounded-xl border border-border-color/30 bg-surface text-xs hover:bg-surface-elevated/40 transition-all">
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 flex items-center justify-center rounded-lg ${report.channel === "whatsapp" ? "bg-green-50 text-green-600" : "bg-sky-50 text-sky-600"}`}>
                          {report.channel === "whatsapp" ? <Send size={14} /> : <Mail size={14} />}
                        </div>
                        <div>
                          <p className="font-bold text-foreground capitalize">Invoice {report.channel} distribution</p>
                          <p className="text-[10px] text-muted">Payload: {report.paymentDates.length ? report.paymentDates.join(", ") : "Manual share"}</p>
                        </div>
                      </div>
                      <p className="font-medium text-muted/60">{formatDate(report.sharedAt)}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </SideDrawer>

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
