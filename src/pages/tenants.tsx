import { useEffect, useMemo, useState } from "react";
import { ModulePage } from "@/components/module-page";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { Modal, ConfirmDialog, SideDrawer } from "@/components/modal";
import { fetchTenantsData } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { fetchCompanyInfo, fetchAdminInfo, downloadHtmlDocument } from "@/lib/storage";
import { buildProfessionalInvoiceHtml, buildProfessionalContractHtml } from "@/lib/document-templates";
import type { ContractSection } from "@/lib/document-templates";
import { sendEmail, sendWhatsApp } from "@/lib/notifications";
import type { TenantRow } from "@/lib/types";

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
    currency: "ZAR",
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
  const { user } = useAuth();

  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [activeFilter, setActiveFilter] = useState("all");
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

  const filtered = useMemo(
    () => (activeFilter === "all" ? tenants : tenants.filter((tenant) => tenant.tenureStatus === activeFilter)),
    [tenants, activeFilter],
  );

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
      const payload: Record<string, unknown> = {
        full_name: form.full_name,
        id_number: form.id_number,
        phone: form.phone,
        email: form.email,
        tenure_status: form.tenure_status,
      };

      if (form.property_id) {
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
          .select("contract_id, sort_order, title, content")
          .in("contract_id", contractIds)
          .order("sort_order");
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
        property_id: detailsPropertyId || null,
      };

      if (detailsPropertyId) {
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

    if (!detailsPropertyId) {
      alert("Assign tenant to a property first.");
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

      const { data: createdInvoice, error: createError } = await supabase
        .from("invoices")
        .insert({
          tenant_id: detailsRow.id,
          property_id: detailsPropertyId,
          month: invoiceMonthLabel,
          due_date: dueDate,
          total_amount: totalAmount,
          status: "paid",
        })
        .select("id")
        .single();

      if (createError) throw createError;

      const { error: itemsError } = await supabase.from("invoice_items").insert(
        selectedPayments.map((payment) => ({
          invoice_id: createdInvoice.id,
          description: `Payment on ${payment.paymentDate} recorded by ${payment.recordedBy}`,
          amount: payment.amountPaid,
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
      if (invoice.pdfUrl && invoice.pdfUrl.startsWith("http")) {
        const link = document.createElement("a");
        link.href = invoice.pdfUrl;
        link.download = `invoice-${invoice.id}.pdf`;
        link.click();
        return;
      }

      // Check if we have stored HTML
      if (invoice.pdfUrl && invoice.pdfUrl.startsWith("<")) {
        downloadHtmlDocument(invoice.pdfUrl, `invoice-${invoice.id}.html`);
        return;
      }

      const paymentDates = await getInvoicePaymentDates(invoice.id);
      const html = await buildInvoiceHtmlProfessional(invoice, detailsRow.fullName, detailsPropertyName, paymentDates, user?.email ?? undefined);
      downloadHtmlDocument(html, `invoice-${invoice.id}.html`);
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
      user_email: user?.email ?? null,
      user_name: user?.email ?? "Admin",
      action: "invoice_shared",
      entity_type: "invoice_share",
      entity_id: tenantId,
      entity_name: invoiceId,
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
      const messageText = `Invoice ${invoice.month} (${formatCurrency(invoice.amount)}), payments made on ${paymentsLabel}.`;

      // Build professional invoice HTML for email attachment
      const invoiceHtml = await buildInvoiceHtmlProfessional(
        invoice,
        detailsRow.fullName,
        detailsPropertyName,
        paymentDates,
        user?.email ?? undefined,
      );
      const company = await fetchCompanyInfo();

      if (channel === "email") {
        if (!detailsRow.email) {
          alert("Tenant email is missing.");
          return;
        }

        const subject = `Invoice ${invoice.month} - ${detailsRow.fullName}`;
        const result = await sendEmail({
          to: detailsRow.email,
          recipientName: detailsRow.fullName,
          subject,
          bodyText: `Please find your invoice for <strong>${invoice.month}</strong> attached below. The total amount due is <strong>${formatCurrency(invoice.amount)}</strong>. Payments recorded on ${paymentsLabel}.`,
          documentHtml: invoiceHtml,
          companyName: company?.companyName,
        });

        if (result.sent) {
          alert("Invoice sent via email successfully!");
        } else if (result.fallback) {
          // Fallback mailto was opened
        }
      } else {
        const phone = sanitizePhoneToWhatsApp(detailsRow.phone ?? "");
        if (!phone) {
          alert("Tenant phone is missing.");
          return;
        }

        const result = await sendWhatsApp({
          to: `+${phone}`,
          message: messageText,
        });

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
      if (contract.documentUrl && contract.documentUrl.startsWith("http")) {
        const link = document.createElement("a");
        link.href = contract.documentUrl;
        link.download = `contract-${contract.id}.pdf`;
        link.click();
        return;
      }
      const html = await buildContractHtmlForTenant(contract);
      downloadHtmlDocument(html, `contract-${contract.title.replace(/\s+/g, "-")}.html`);
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
      const company = await fetchCompanyInfo();

      if (channel === "email") {
        if (!detailsRow.email) { alert("Tenant email is missing."); return; }
        const subject = `${contract.title} - ${detailsRow.fullName}`;
        const result = await sendEmail({
          to: detailsRow.email,
          recipientName: detailsRow.fullName,
          subject,
          bodyText: `Please find your lease agreement <strong>"${contract.title}"</strong> for <strong>${contract.propertyName}</strong> attached below. The contract period is ${formatDate(contract.startDate)} to ${formatDate(contract.endDate)} with a monthly rent of <strong>${formatCurrency(contract.monthlyRent)}</strong>.`,
          documentHtml: contractHtml,
          companyName: company?.companyName,
        });
        if (result.sent) {
          alert("Contract sent via email successfully!");
        }
      } else {
        const phone = sanitizePhoneToWhatsApp(detailsRow.phone ?? "");
        if (!phone) { alert("Tenant phone is missing."); return; }
        const result = await sendWhatsApp({
          to: `+${phone}`,
          message: messageText,
        });
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

  return (
    <ModulePage title="Tenants" description="Tenant management, assignment flows, payment actions, and invoice audit trail.">
      {loading && <LoadingState label="Loading tenants..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && (
        <section className="space-y-4 rounded-lg border border-border-color bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              {(["all", "active", "notice"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveFilter(key)}
                  className={`rounded-md border border-border-color px-3 py-2 text-sm ${
                    activeFilter === key ? "bg-surface-elevated font-medium" : "text-muted"
                  }`}
                >
                  {key === "all"
                    ? `All Tenants (${statusCounts.all})`
                    : `${key.charAt(0).toUpperCase() + key.slice(1)} (${statusCounts[key]})`}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={openAdd}
              className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium"
            >
              Add Tenant
            </button>
          </div>

          {filtered.length === 0 ? (
            <EmptyState title="No tenants found" description="Add a tenant to get started." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border-color text-left text-muted">
                    <th className="px-3 py-2 font-medium">Tenant</th>
                    <th className="px-3 py-2 font-medium">Property</th>
                    <th className="px-3 py-2 font-medium">Phone</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                    <th className="px-3 py-2 font-medium">Tenure</th>
                    <th className="px-3 py-2 font-medium">Rent Status</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((row) => (
                    <tr key={row.id} className="border-b border-border-color/60">
                      <td className="px-3 py-3 font-medium">
                        <button
                          type="button"
                          onClick={() => openTenantDetails(row)}
                          className="text-left underline"
                        >
                          {row.fullName}
                        </button>
                      </td>
                      <td className="px-3 py-3 text-muted">{row.propertyName}</td>
                      <td className="px-3 py-3 text-muted">{row.phone}</td>
                      <td className="px-3 py-3 text-muted">{row.email}</td>
                      <td className="px-3 py-3">
                        <span className="rounded-full border border-border-color bg-surface-elevated px-2 py-1 text-xs text-muted capitalize">
                          {row.tenureStatus}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-full border border-border-color bg-surface-elevated px-2 py-1 text-xs text-muted capitalize">
                          {row.rentStatus}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openEdit(row)}
                            className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated"
                          >
                            Edit
                          </button>
                          {row.tenureStatus === "active" && (
                            <button
                              type="button"
                              onClick={() => onStatusChange(row.id, "notice")}
                              className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated"
                            >
                              Give Notice
                            </button>
                          )}
                          {row.tenureStatus === "notice" && (
                            <button
                              type="button"
                              onClick={() => onStatusChange(row.id, "active")}
                              className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated"
                            >
                              Reactivate
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
            </div>
          )}
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

      <SideDrawer open={Boolean(detailsRow)} onClose={() => setDetailsRow(null)} title="Tenant Details">
        {!detailsRow && null}

        {detailsRow && detailsLoading && <LoadingState label="Loading tenant detail audit trail..." />}

        {detailsRow && !detailsLoading && detailsError && (
          <ErrorState message={detailsError} onRetry={() => void loadTenantDetails(detailsRow.id)} />
        )}

        {detailsRow && !detailsLoading && !detailsError && (
          <div className="space-y-5">
            <section className="space-y-3 rounded-md border border-border-color bg-surface-elevated p-3">
              <p className="text-sm font-medium">{detailsRow.fullName}</p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted">Assigned Property</p>
                  <p>{detailsPropertyName || "Unassigned"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Assignment Date</p>
                  <p>{formatDate(assignmentDate)}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <select
                  value={detailsPropertyId}
                  onChange={(event) => setDetailsPropertyId(event.target.value)}
                  className="w-full rounded-md border border-border-color bg-surface px-3 py-2 text-sm"
                >
                  <option value="">Unassign tenant</option>
                  {properties.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={assignTenantToProperty}
                  disabled={assigningProperty}
                  className="rounded-md border border-border-color bg-surface px-3 py-2 text-sm disabled:opacity-50"
                >
                  {assigningProperty ? "Saving..." : "Assign"}
                </button>
              </div>
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold">Payments</h4>
                <span className="text-xs text-muted">Select payments to generate invoice</span>
              </div>

              {payments.length === 0 ? (
                <EmptyState title="No payments yet" description="Recorded rent payments will appear here." />
              ) : (
                <div className="overflow-x-auto rounded-md border border-border-color">
                  <table className="min-w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border-color text-left text-muted">
                        <th className="px-2 py-2 font-medium">Select</th>
                        <th className="px-2 py-2 font-medium">Date</th>
                        <th className="px-2 py-2 font-medium">Amount</th>
                        <th className="px-2 py-2 font-medium">Recorded By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => {
                        const checked = selectedPaymentIds.includes(payment.id);
                        return (
                          <tr key={payment.id} className="border-b border-border-color/60">
                            <td className="px-2 py-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePaymentSelection(payment.id)}
                              />
                            </td>
                            <td className="px-2 py-2 text-muted">{payment.paymentDate}</td>
                            <td className="px-2 py-2 text-muted">{formatCurrency(payment.amountPaid)}</td>
                            <td className="px-2 py-2 text-muted">{payment.recordedBy}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <button
                type="button"
                onClick={generateInvoiceFromSelectedPayments}
                disabled={generatingInvoice || selectedPaymentIds.length === 0}
                className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50"
              >
                {generatingInvoice ? "Generating..." : "Generate Invoice from Selected Payments"}
              </button>
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-semibold">Invoices</h4>

              {invoices.length === 0 ? (
                <EmptyState title="No invoices yet" description="Generated invoices will appear here." />
              ) : (
                <div className="overflow-x-auto rounded-md border border-border-color">
                  <table className="min-w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-border-color text-left text-muted">
                        <th className="px-2 py-2 font-medium">Month</th>
                        <th className="px-2 py-2 font-medium">Amount</th>
                        <th className="px-2 py-2 font-medium">Status</th>
                        <th className="px-2 py-2 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice) => (
                        <tr key={invoice.id} className="border-b border-border-color/60">
                          <td className="px-2 py-2 text-muted">{invoice.month}</td>
                          <td className="px-2 py-2 text-muted">{formatCurrency(invoice.amount)}</td>
                          <td className="px-2 py-2 text-muted capitalize">{invoice.status}</td>
                          <td className="px-2 py-2">
                            <div className="flex flex-wrap gap-1">
                              <button
                                type="button"
                                onClick={() => void openInvoicePreview(invoice)}
                                className="rounded-md border border-border-color px-2 py-1 text-xs text-muted"
                              >
                                View
                              </button>
                              <button
                                type="button"
                                onClick={() => void downloadInvoice(invoice)}
                                className="rounded-md border border-border-color px-2 py-1 text-xs text-muted"
                              >
                                Download
                              </button>
                              <button
                                type="button"
                                onClick={() => void shareInvoice(invoice, "whatsapp")}
                                disabled={sharingInvoiceId === invoice.id}
                                className="rounded-md border border-border-color px-2 py-1 text-xs text-muted disabled:opacity-50"
                              >
                                WhatsApp
                              </button>
                              <button
                                type="button"
                                onClick={() => void shareInvoice(invoice, "email")}
                                disabled={sharingInvoiceId === invoice.id}
                                className="rounded-md border border-border-color px-2 py-1 text-xs text-muted disabled:opacity-50"
                              >
                                Email
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-semibold">Contracts</h4>

              {tenantContracts.length === 0 ? (
                <EmptyState title="No contracts yet" description="Contracts generated for this tenant will appear here." />
              ) : (
                <div className="space-y-3">
                  {tenantContracts.map((contract) => (
                    <div key={contract.id} className="rounded-md border border-border-color bg-surface-elevated p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{contract.title}</p>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                          contract.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : contract.status === "expired" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        }`}>{contract.status}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs text-muted">
                        <div>
                          <p className="text-[10px] uppercase tracking-wider">Property</p>
                          <p>{contract.propertyName}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider">Rent</p>
                          <p>{formatCurrency(contract.monthlyRent)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider">Start</p>
                          <p>{formatDate(contract.startDate)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wider">End</p>
                          <p>{formatDate(contract.endDate)}</p>
                        </div>
                      </div>
                      {contract.sections.length > 0 && (
                        <p className="text-[10px] text-muted">{contract.sections.length} section{contract.sections.length !== 1 ? "s" : ""}: {contract.sections.map((s) => s.title).join(", ")}</p>
                      )}
                      <div className="flex flex-wrap gap-1 pt-1">
                        <button type="button" onClick={() => void openContractPreview(contract)} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface">View</button>
                        <button type="button" onClick={() => void downloadContract(contract)} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface">Download</button>
                        <button type="button" onClick={() => void shareContract(contract, "whatsapp")} disabled={contractActionId === contract.id} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface disabled:opacity-50">WhatsApp</button>
                        <button type="button" onClick={() => void shareContract(contract, "email")} disabled={contractActionId === contract.id} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface disabled:opacity-50">Email</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-2">
              <h4 className="text-sm font-semibold">Share Report</h4>

              {shareReports.length === 0 ? (
                <EmptyState title="No share activity" description="Invoice sharing events will appear here." />
              ) : (
                <ul className="space-y-2">
                  {shareReports.map((report) => (
                    <li key={report.id} className="rounded-md border border-border-color bg-surface-elevated p-3 text-xs text-muted">
                      Sent for payments made on {report.paymentDates.length ? report.paymentDates.join(", ") : "-"} via {report.channel} on {formatDate(report.sharedAt)}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </SideDrawer>
    </ModulePage>
  );
}
