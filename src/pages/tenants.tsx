import { useEffect, useMemo, useState } from "react";
import { ModulePage } from "@/components/module-page";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { Modal, ConfirmDialog, SideDrawer } from "@/components/modal";
import { fetchTenantsData, isValidUuid, fetchCompanyUsers } from "@/lib/data";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { fetchCompanyInfo, fetchAdminInfo, uploadPdfFromHtml, createPdfAttachmentFromUrl, downloadHtmlDocument, downloadPdfDocument, downloadPdfFromUrl } from "@/lib/storage";
import { DocumentShareModal } from "@/components/document-share-modal";
import { buildProfessionalInvoiceHtml, buildProfessionalContractHtml } from "@/lib/document-templates";
import type { ContractSection } from "@/lib/document-templates";
import {
  sendEmail,
  sendWhatsApp,
  sendCustomHtmlEmail,
  wrapTenantInvitationEmailHtml,
  wrapStaffDeregistrationNoticeEmailHtml,
} from "@/lib/notifications";
import { uploadFileToBucket } from "@/lib/storage";
import type { TenantRow, CompanyUser } from "@/lib/types";
import {
  Plus,
  User,
  Phone,
  Mail,
  Pencil,
  Trash,
  UserX,
  UserCheck,
  ChevronRight,
  MapPin,
  Calendar,
  CreditCard,
  Receipt,
  FileSignature,
  Activity,
  Send,
  Eye,
  Download,
  AlertTriangle,
  CheckCircle2,
  Copy,
  Check,
  UploadCloud,
  Upload,
  FileText,
  ArrowLeft,
  ShieldAlert,
  Sparkles,
  ExternalLink,
  Users,
  ChevronDown,
  History,
  Clock,
  Ban,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import { DataTableHeader, StatusBadge, TableRowActions, TableActionButton } from "@/components/data-table";
import {
  isPaymentSuppressed,
  isPaymentAdvance,
  getPaymentMonths,
  calculateMonthRentState,
  suppressRentPayment,
  unsuppressRentPayment,
  generateUpcomingMonths,
  formatMonthLabel,
} from "@/lib/rent-calculator";

export type AccountStatusInfo = {
  type: "has_account" | "other_org_staff" | "no_account";
  label: string;
  orgName?: string;
};

export type PaymentTimelineItem = {
  id: string;
  source: "tenant_pop" | "staff_recorded";
  date: string;
  amount: number;
  method: string;
  actorName: string;
  actorRole: "Tenant" | "Staff";
  receiptUrl?: string;
  monthLabel?: string;
  notes?: string;
  status?: string;
  paymentId?: string;
  isSuppressed?: boolean;
  suppressedAt?: string;
  suppressedBy?: string;
  suppressedReason?: string;
  isAdvance?: boolean;
  advanceMonths?: string[];
  paidMonths?: string[];
};

type TenantPaymentRow = {
  id: string;
  paymentDate: string;
  amountPaid: number;
  recordedBy: string;
  paidMonth?: string;
  paidMonths?: string[];
  notes?: string;
  popUrl?: string;
  isSuppressed?: boolean;
  suppressedAt?: string;
  suppressedBy?: string;
  suppressedReason?: string;
  isAdvance?: boolean;
  advanceMonths?: string[];
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
  const { user, currentCompany, currentCompanyUser } = useAuth();
  const { format: formatCurrency } = useCurrency();

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

  const [viewTenantTarget, setViewTenantTarget] = useState<TenantRow | null>(null);

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

  // Account status detection state
  const [accountStatusMap, setAccountStatusMap] = useState<Record<string, AccountStatusInfo>>({});
  const [sendingInvitation, setSendingInvitation] = useState(false);
  const [invitationSuccessMessage, setInvitationSuccessMessage] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Traceable Payment Timeline & Staff POP Recording State
  const [paymentTimeline, setPaymentTimeline] = useState<PaymentTimelineItem[]>([]);
  const [recordRentModalOpen, setRecordRentModalOpen] = useState(false);
  const [rentRecordForm, setRentRecordForm] = useState({
    paymentDate: new Date().toISOString().slice(0, 10),
    amountPaid: "",
    paidMonth: new Date().toISOString().slice(0, 7),
    paymentMethod: "EFT / Bank Transfer",
    receiptUrl: "",
    referenceNumber: "",
    notes: "",
    isAdvancePayment: false,
    advanceMonths: [] as string[],
  });
  const [suppressPrompt, setSuppressPrompt] = useState<{
    isOpen: boolean;
    paymentId: string | null;
    amount: number;
    reason: string;
    submitting: boolean;
  }>({
    isOpen: false,
    paymentId: null,
    amount: 0,
    reason: "",
    submitting: false,
  });
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [detailsRequiredRent, setDetailsRequiredRent] = useState<number>(0);

  const currentMonthCalc = useMemo(() => {
    if (!detailsRow) return null;
    const paymentObjs = payments.map((p) => ({
      id: p.id,
      amount_paid: p.amountPaid,
      payment_date: p.paymentDate,
      paid_months: p.paidMonths || (p.paidMonth ? [p.paidMonth] : [toMonthKey(p.paymentDate)]),
      paid_month: p.paidMonth || toMonthKey(p.paymentDate),
      notes: p.notes,
      is_suppressed: p.isSuppressed,
      is_advance: p.isAdvance,
      advance_months: p.advanceMonths,
      pop_url: p.popUrl,
      executed_by_name: p.recordedBy,
    }));
    return calculateMonthRentState({
      monthlyRent: detailsRequiredRent,
      payments: paymentObjs,
      targetMonth: rentRecordForm.paidMonth || new Date().toISOString().slice(0, 7),
    });
  }, [detailsRow, payments, detailsRequiredRent, rentRecordForm.paidMonth]);
  const [generateInvoiceModalOpen, setGenerateInvoiceModalOpen] = useState(false);
  const [companyStaffList, setCompanyStaffList] = useState<CompanyUser[]>([]);
  const [openStaffDropdownInvoiceId, setOpenStaffDropdownInvoiceId] = useState<string | null>(null);
  const [sharingWithStaff, setSharingWithStaff] = useState(false);
  const [selectedInvoiceForAudit, setSelectedInvoiceForAudit] = useState<TenantInvoiceRow | null>(null);
  const [invoiceAuditLogs, setInvoiceAuditLogs] = useState<any[]>([]);
  const [loadingInvoiceAudit, setLoadingInvoiceAudit] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const result = await fetchTenantsData(currentCompany?.id);
        if (!cancelled) {
          setTenants(result);
        }

        let propQuery = supabase.from("properties").select("id, name, type").order("name");
        if (isValidUuid(currentCompany?.id)) {
          propQuery = propQuery.eq("company_id", currentCompany.id);
        }
        const { data: props, error: propsError } = await propQuery;

        if (propsError) throw propsError;

        if (!cancelled && props) {
          const hospitalityTypes = new Set(["hotel", "motel", "lodge", "guest_house", "commercial"]);
          const residentialProps = props.filter((item: any) => !item.type || !hospitalityTypes.has(item.type));
          setProperties(residentialProps.map((item) => ({ id: String(item.id), name: String(item.name) })));
        }

        // Detect account status for each tenant
        try {
          const [usersRes, cuRes] = await Promise.allSettled([
            supabase.from("users").select("id, email, role"),
            supabase.from("company_users").select("user_id, company_id, companies(id, name), users(id, email)"),
          ]);

          const customerEmails = new Set<string>();
          const otherOrgStaff = new Map<string, string>();
          const currentCompanyStaff = new Set<string>();

          if (cuRes.status === "fulfilled" && cuRes.value.data) {
            cuRes.value.data.forEach((cu: any) => {
              const em = (cu.users?.email || "").toLowerCase().trim();
              if (!em) return;
              if (cu.company_id === currentCompany?.id) {
                currentCompanyStaff.add(em);
              } else {
                const orgName = cu.companies?.name || "Another Organization";
                otherOrgStaff.set(em, orgName);
              }
            });
          }

          if (usersRes.status === "fulfilled" && usersRes.value.data) {
            usersRes.value.data.forEach((u: any) => {
              const em = (u.email || "").toLowerCase().trim();
              if (!em) return;
              if (u.role === "customer" || (!currentCompanyStaff.has(em) && !otherOrgStaff.has(em))) {
                customerEmails.add(em);
              }
            });
          }

          const accMap: Record<string, AccountStatusInfo> = {};
          result.forEach((t) => {
            const em = (t.email || "").toLowerCase().trim();
            if (otherOrgStaff.has(em)) {
              accMap[em] = {
                type: "other_org_staff",
                label: `Registered with ${otherOrgStaff.get(em)} as staff`,
                orgName: otherOrgStaff.get(em),
              };
            } else if (customerEmails.has(em)) {
              accMap[em] = {
                type: "has_account",
                label: "Has Account",
              };
            } else {
              accMap[em] = {
                type: "no_account",
                label: "No Account Yet",
              };
            }
          });

          if (!cancelled) {
            setAccountStatusMap(accMap);
          }
        } catch (accErr) {
          console.warn("Could not load tenant account statuses:", accErr);
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
  }, [reloadKey, currentCompany?.id]);

  useEffect(() => {
    if (currentCompany?.id) {
      fetchCompanyUsers(currentCompany.id).then(setCompanyStaffList).catch(() => {});
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    if (!selectedInvoiceForAudit) {
      setInvoiceAuditLogs([]);
      return;
    }
    let cancelled = false;
    async function loadAudit() {
      setLoadingInvoiceAudit(true);
      try {
        const { data, error } = await supabase
          .from("audit_log")
          .select("*")
          .eq("entity_id", selectedInvoiceForAudit?.id)
          .order("created_at", { ascending: false });
        if (!cancelled && !error && data) {
          setInvoiceAuditLogs(data);
        }
      } catch {
        // non fatal
      } finally {
        if (!cancelled) setLoadingInvoiceAudit(false);
      }
    }
    void loadAudit();
    return () => { cancelled = true; };
  }, [selectedInvoiceForAudit]);

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
      const [tenantResult, paymentsResult, invoicesResult, sharesResult, contractsResult, proofsResult] = await Promise.allSettled([
        supabase
          .from("tenants")
          .select("id, property_id, email, full_name, tenure_start_date, created_at, properties(id, name, monthly_rent)")
          .eq("id", tenantId)
          .maybeSingle(),
        supabase
          .from("tenant_rent_payments")
          .select("id, payment_date, amount_paid, paid_months, paid_month, notes, payment_method, pop_url, is_suppressed, suppressed_at, suppressed_by, suppressed_reason, is_advance, advance_months")
          .eq("tenant_id", tenantId)
          .order("payment_date", { ascending: false }),
        supabase
          .from("invoices")
          .select("id, month, due_date, total_amount, status, pdf_url, created_at, is_suppressed")
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
        supabase
          .from("tenant_payment_proofs")
          .select("*")
          .eq("tenant_id", tenantId)
          .order("payment_date", { ascending: false }),
      ]);

      const tenant = (tenantResult.status === "fulfilled" && tenantResult.value.data)
        ? tenantResult.value.data
        : detailsRow
        ? {
            id: detailsRow.id,
            property_id: detailsRow.propertyId,
            email: detailsRow.email,
            full_name: detailsRow.fullName,
            tenure_start_date: detailsRow.tenureStartDate,
            created_at: detailsRow.createdAt,
            properties: detailsRow.propertyName ? { name: detailsRow.propertyName } : null,
          }
        : null;

      if (!tenant) {
        throw new Error("Could not find tenant profile details.");
      }

      // Safely extract contracts
      const rawContracts = contractsResult.status === "fulfilled" && contractsResult.value.data ? contractsResult.value.data : [];
      const contractIds = rawContracts.map((c: any) => String(c.id));
      let contractSectionsMap: Record<string, ContractSection[]> = {};
      if (contractIds.length > 0) {
        try {
          const { data: cs } = await supabase
            .from("contract_sections")
            .select("contract_id, sort_order, title, content")
            .in("contract_id", contractIds)
            .order("sort_order");
          if (cs) {
            cs.forEach((s) => {
              const cid = String((s as Record<string, unknown>).contract_id ?? "");
              if (!contractSectionsMap[cid]) contractSectionsMap[cid] = [];
              contractSectionsMap[cid].push({ title: String(s.title), content: String(s.content) });
            });
          }
        } catch {
          // ignore contract sections fetch error
        }
      }

      setTenantContracts(
        rawContracts.map((c: any) => ({
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

      // Safely extract payments
      let paymentRows: any[] = [];
      if (paymentsResult.status === "fulfilled" && paymentsResult.value.data) {
        paymentRows = paymentsResult.value.data;
      } else {
        // Fallback in case columns like paid_months or pop_url don't exist yet
        try {
          const { data: fallbackPayments } = await supabase
            .from("tenant_rent_payments")
            .select("id, payment_date, amount_paid, paid_months, paid_month, notes, payment_method, pop_url")
            .eq("tenant_id", tenantId)
            .order("payment_date", { ascending: false });
          if (fallbackPayments) paymentRows = fallbackPayments;
        } catch {
          paymentRows = [];
        }
      }

      const paymentIds = paymentRows.map((item) => String(item.id ?? "")).filter(Boolean);

      let recordedByMap = new Map<string, string>();
      if (paymentIds.length) {
        try {
          const { data: paymentAudits } = await supabase
            .from("audit_log")
            .select("entity_id, user_name, user_email, created_at")
            .eq("entity_type", "tenant_rent_payment")
            .eq("action", "rent_payment_recorded")
            .in("entity_id", paymentIds)
            .order("created_at", { ascending: false });

          (paymentAudits ?? []).forEach((row) => {
            const entityId = String(row.entity_id ?? "");
            if (!entityId || recordedByMap.has(entityId)) {
              return;
            }
            recordedByMap.set(entityId, String(row.user_name ?? row.user_email ?? "Admin"));
          });
        } catch {
          // audit log is non-fatal
        }
      }

      setDetailsPropertyId(String(tenant.property_id ?? ""));
      setDetailsPropertyName(String((tenant.properties as { name?: string } | null)?.name ?? "Unassigned"));
      setAssignmentDate(String(tenant.tenure_start_date ?? tenant.created_at ?? ""));

      // Determine required rent from contract or assigned property
      let reqRent = 0;
      const activeContract = rawContracts.find((c: any) => c.status === "active") || rawContracts[0];
      if (activeContract && Number(activeContract.monthly_rent) > 0) {
        reqRent = Number(activeContract.monthly_rent);
      } else {
        const propMonthlyRent = Number((tenant.properties as any)?.monthly_rent || 0);
        if (propMonthlyRent > 0) {
          reqRent = propMonthlyRent;
        } else if (tenant.property_id && isValidUuid(tenant.property_id)) {
          try {
            const { data: propRow } = await supabase
              .from("properties")
              .select("monthly_rent")
              .eq("id", tenant.property_id)
              .maybeSingle();
            if (propRow && Number(propRow.monthly_rent) > 0) {
              reqRent = Number(propRow.monthly_rent);
            }
          } catch {}
        }
      }
      setDetailsRequiredRent(reqRent);

      setPayments(
        paymentRows.map((row) => {
          const isSupp = isPaymentSuppressed(row);
          const isAdv = isPaymentAdvance(row);
          const pMonths = getPaymentMonths(row);
          return {
            id: String(row.id ?? ""),
            paymentDate: String(row.payment_date ?? ""),
            amountPaid: Number(row.amount_paid ?? 0),
            recordedBy: recordedByMap.get(String(row.id ?? "")) ?? "Admin",
            paidMonth: String(row.paid_month || (Array.isArray(row.paid_months) ? row.paid_months[0] : "") || toMonthKey(row.payment_date || "")),
            paidMonths: pMonths,
            notes: row.notes || "",
            popUrl: row.pop_url || "",
            isSuppressed: isSupp,
            suppressedAt: row.suppressed_at || "",
            suppressedBy: row.suppressed_by || "",
            suppressedReason: row.suppressed_reason || "",
            isAdvance: isAdv,
            advanceMonths: Array.isArray(row.advance_months) ? row.advance_months : [],
          };
        }),
      );

      // Also gather proofs by email if exists
      let allProofs: any[] = proofsResult.status === "fulfilled" && proofsResult.value.data ? [...proofsResult.value.data] : [];
      if (tenant.email) {
        try {
          const { data: emailProofs } = await supabase
            .from("tenant_payment_proofs")
            .select("*")
            .eq("customer_email", tenant.email)
            .order("payment_date", { ascending: false });
          if (emailProofs && emailProofs.length > 0) {
            const existingIds = new Set(allProofs.map((p) => p.id));
            emailProofs.forEach((ep) => {
              if (!existingIds.has(ep.id)) allProofs.push(ep);
            });
          }
        } catch {}
      }

      // Build unified Proof of Payment & Collection Timeline
      const timelineItems: PaymentTimelineItem[] = [];

      paymentRows.forEach((p) => {
        const notesStr = String(p.notes || "");
        let method = String(p.payment_method || "Cash / Recorded");
        let receiptUrl: string | undefined = p.pop_url || undefined;

        const mMatch = notesStr.match(/Means:\s*([^|]+)/i) || notesStr.match(/Method:\s*([^|]+)/i);
        if (mMatch) method = mMatch[1].trim();

        const rMatch = notesStr.match(/Receipt:\s*(https?:\/\/[^\s|]+)/i);
        if (!receiptUrl && rMatch) receiptUrl = rMatch[1].trim();

        const clerk = recordedByMap.get(String(p.id)) || "Staff";
        const isSupp = isPaymentSuppressed(p);
        const isAdv = isPaymentAdvance(p);
        const pMonths = getPaymentMonths(p);
        const monthLabel = pMonths.length > 0
          ? pMonths.join(", ")
          : String(p.paid_months || p.paid_month || "");

        timelineItems.push({
          id: `staff-${p.id}`,
          source: "staff_recorded",
          date: String(p.payment_date || ""),
          amount: Number(p.amount_paid || 0),
          method,
          actorName: clerk,
          actorRole: "Staff",
          receiptUrl,
          monthLabel,
          notes: notesStr,
          paymentId: String(p.id),
          isSuppressed: isSupp,
          suppressedAt: p.suppressed_at || undefined,
          suppressedBy: p.suppressed_by || undefined,
          suppressedReason: p.suppressed_reason || undefined,
          isAdvance: isAdv,
          advanceMonths: Array.isArray(p.advance_months) ? p.advance_months : [],
          paidMonths: pMonths,
        });
      });

      allProofs.forEach((proof) => {
        const notesStr = String(proof.notes || "");
        let method = "EFT / Uploaded Proof";
        const mMatch = notesStr.match(/Method:\s*([^|]+)/i) || notesStr.match(/Means:\s*([^|]+)/i);
        if (mMatch) method = mMatch[1].trim();

        const isStaffRecorded = notesStr.includes("Recorded by Staff:");

        timelineItems.push({
          id: `proof-${proof.id}`,
          source: isStaffRecorded ? "staff_recorded" : "tenant_pop",
          date: String(proof.payment_date || proof.created_at?.slice(0, 10) || ""),
          amount: Number(proof.amount || 0),
          method,
          actorName: isStaffRecorded
            ? notesStr.match(/Recorded by Staff:\s*([^|]+)/i)?.[1]?.trim() || "Staff"
            : String(proof.customer_name || tenant.full_name || "Tenant"),
          actorRole: isStaffRecorded ? "Staff" : "Tenant",
          receiptUrl: String(proof.document_url || ""),
          notes: notesStr,
          status: String(proof.status || "verified"),
        });
      });

      timelineItems.sort((a, b) => b.date.localeCompare(a.date));
      setPaymentTimeline(timelineItems);

      const rawInvoices = invoicesResult.status === "fulfilled" && invoicesResult.value.data ? invoicesResult.value.data : [];
      setInvoices(
        rawInvoices.map((row: any) => ({
          id: String(row.id ?? ""),
          month: String(row.month ?? "-"),
          dueDate: String(row.due_date ?? "-"),
          amount: Number(row.total_amount ?? 0),
          status: String(row.status ?? "draft"),
          pdfUrl: String(row.pdf_url ?? ""),
          createdAt: String(row.created_at ?? ""),
        })),
      );

      const rawShares = sharesResult.status === "fulfilled" && sharesResult.value.data ? sharesResult.value.data : [];
      setShareReports(
        rawShares.map((row: any) => {
          const details = (row.details as { channel?: "email" | "whatsapp"; payment_dates?: string[] } | null) ?? {};
          return {
            id: String(row.id ?? ""),
            channel: details.channel === "whatsapp" ? "whatsapp" : "email",
            paymentDates: Array.isArray(details.payment_dates) ? details.payment_dates.map((value: any) => String(value)) : [],
            sharedAt: String(row.created_at ?? ""),
          };
        }),
      );

      setSelectedPaymentIds([]);
    } catch (loadError) {
      console.error("loadTenantDetails error:", loadError);
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
    () => payments.filter((payment) => selectedPaymentIds.includes(payment.id) && !payment.isSuppressed),
    [payments, selectedPaymentIds],
  );

  const togglePaymentSelection = (paymentId: string) => {
    const p = payments.find((item) => item.id === paymentId);
    if (p?.isSuppressed) {
      alert("Suppressed payment records are voided and cannot be included in invoices.");
      return;
    }
    setSelectedPaymentIds((previous) =>
      previous.includes(paymentId)
        ? previous.filter((id) => id !== paymentId)
        : [...previous, paymentId],
    );
  };

  const handleSuppressPayment = async () => {
    if (!suppressPrompt.paymentId) return;
    setSuppressPrompt((prev) => ({ ...prev, submitting: true }));
    try {
      const admin = await fetchAdminInfo(user?.email ?? undefined);
      const staffName = admin.fullName || user?.email || "Staff";
      const res = await suppressRentPayment({
        supabase,
        paymentId: suppressPrompt.paymentId,
        staffName,
        reason: suppressPrompt.reason || "Clerical amendment / voided entry",
        currentCompanyId: currentCompany?.id,
      });
      if (!res.success) {
        alert("Could not suppress payment: " + res.error);
        return;
      }
      setSuppressPrompt({ isOpen: false, paymentId: null, amount: 0, reason: "", submitting: false });
      if (detailsRow) {
        await loadTenantDetails(detailsRow.id);
      }
      reload();
    } catch (err: any) {
      alert("Error suppressing payment: " + err.message);
    } finally {
      setSuppressPrompt((prev) => ({ ...prev, submitting: false }));
    }
  };

  const handleUnsuppressPayment = async (paymentId: string, amount: number) => {
    if (!confirm(`Are you sure you want to restore this suppressed payment of ${formatCurrency(amount)}? It will be restored to active accounting totals.`)) return;
    try {
      const admin = await fetchAdminInfo(user?.email ?? undefined);
      const staffName = admin.fullName || user?.email || "Staff";
      const res = await unsuppressRentPayment({
        supabase,
        paymentId,
        staffName,
        currentCompanyId: currentCompany?.id,
      });
      if (!res.success) {
        alert("Could not restore payment: " + res.error);
        return;
      }
      if (detailsRow) {
        await loadTenantDetails(detailsRow.id);
      }
      reload();
    } catch (err: any) {
      alert("Error restoring payment: " + err.message);
    }
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

  /* ---- Tenant Account Invitation & Dispute Handlers ---- */

  const sendTenantInvitation = async (isNoticeForCrossOrgStaff: boolean = false) => {
    if (!detailsRow || !detailsRow.email) {
      alert("Tenant email is missing.");
      return;
    }

    setSendingInvitation(true);
    setInvitationSuccessMessage(null);

    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "https://paimbabook.com";
      const signupUrl = `${origin}/portal-login?mode=signup&email=${encodeURIComponent(detailsRow.email)}&property_id=${detailsPropertyId || detailsRow.propertyId || ""}&company_id=${currentCompany?.id || ""}`;

      const emailLower = detailsRow.email.toLowerCase().trim();
      const accStatus = accountStatusMap[emailLower];

      let emailHtml = "";
      let subject = "";

      if (isNoticeForCrossOrgStaff && accStatus?.orgName) {
        subject = `Action Required: Account Conflict Notice - ${currentCompany?.name || "Paimbabook"}`;
        emailHtml = wrapStaffDeregistrationNoticeEmailHtml({
          recipientName: detailsRow.fullName,
          staffEmail: detailsRow.email,
          propertyName: detailsPropertyName || "Assigned Property",
          staffCompanyName: accStatus.orgName,
          tenantCompanyName: currentCompany?.name || "Paimbabook",
          companyLogo: currentCompany?.logoUrl,
          inviteUrl: signupUrl,
        });
      } else {
        subject = `Resident Portal Invitation - ${detailsPropertyName || "Your Residence"} | ${currentCompany?.name || "Paimbabook"}`;
        emailHtml = wrapTenantInvitationEmailHtml({
          recipientName: detailsRow.fullName,
          propertyName: detailsPropertyName || "Assigned Property",
          companyName: currentCompany?.name || "Paimbabook",
          companyLogo: currentCompany?.logoUrl,
          inviteUrl: signupUrl,
        });
      }

      const res = await sendCustomHtmlEmail({
        to: detailsRow.email,
        subject,
        html: emailHtml,
        bodyFallback: `Dear ${detailsRow.fullName},\n\nYou are invited to activate your resident portal for ${detailsPropertyName || "your unit"}.\nSign up here: ${signupUrl}`,
      });

      // Log in audit_log
      await supabase.from("audit_log").insert({
        user_email: user?.email || "admin@paimbabook.com",
        user_name: (user as any)?.fullName || user?.email || "Staff",
        action: isNoticeForCrossOrgStaff ? "tenant_staff_conflict_notice_sent" : "tenant_invitation_sent",
        entity_type: "tenant",
        entity_id: detailsRow.id,
        company_id: currentCompany?.id && isValidUuid(currentCompany.id) ? currentCompany.id : null,
        details: {
          tenant_name: detailsRow.fullName,
          email: detailsRow.email,
          signupUrl,
          sent: res.sent,
        },
      });

      setInvitationSuccessMessage(
        res.sent
          ? `Invitation successfully delivered to ${detailsRow.email}!`
          : `Email client opened for ${detailsRow.email}.`,
      );
    } catch (err) {
      alert("Could not send invitation: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSendingInvitation(false);
    }
  };

  const copyInvitationLink = () => {
    if (!detailsRow) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "https://paimbabook.com";
    const signupUrl = `${origin}/portal-login?mode=signup&email=${encodeURIComponent(detailsRow.email)}&property_id=${detailsPropertyId || detailsRow.propertyId || ""}&company_id=${currentCompany?.id || ""}`;
    navigator.clipboard.writeText(signupUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  /* ---- Staff Rent Payment & POP Receipt Upload Handlers ---- */

  const [attachingPopPaymentId, setAttachingPopPaymentId] = useState<string | null>(null);

  const handleAttachPopToPayment = async (paymentId: string, file: File) => {
    if (!file || !detailsRow) return;
    setAttachingPopPaymentId(paymentId);
    try {
      const staffName = (currentCompanyUser as any)?.fullName || user?.email || "Staff";
      const actorEmail = user?.email || "staff";
      const compId = currentCompany?.id && isValidUuid(currentCompany.id) ? currentCompany.id : null;
      const url = await uploadFileToBucket("payment-proofs", actorEmail, file);

      const { error } = await supabase
        .from("tenant_rent_payments")
        .update({
          pop_url: url,
          pop_uploaded_by_name: staffName,
          pop_uploaded_at: new Date().toISOString(),
        })
        .eq("id", paymentId);

      if (error) throw error;

      // Also record into tenant_payment_proofs (non-fatal)
      try {
        await supabase.from("tenant_payment_proofs").insert({
          company_id: compId,
          tenant_id: detailsRow.id,
          property_id: detailsPropertyId || detailsRow.propertyId || null,
          customer_email: detailsRow.email,
          customer_name: detailsRow.fullName,
          payment_date: new Date().toISOString().slice(0, 10),
          document_url: url,
          notes: `Attached by staff ${staffName} to Payment ID: ${paymentId}`,
          status: "verified",
        });
      } catch {}

      await loadTenantDetails(detailsRow.id);
      reload();
      alert("Proof of payment successfully attached to this payment record!");
    } catch (err: any) {
      alert("Failed to attach proof of payment: " + (err?.message || String(err)));
    } finally {
      setAttachingPopPaymentId(null);
    }
  };

  const handleReceiptFileUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingReceipt(true);
    try {
      const actorEmail = user?.email || "staff";
      const url = await uploadFileToBucket("payment-proofs", actorEmail, file);
      setRentRecordForm((prev) => ({ ...prev, receiptUrl: url }));
    } catch (err) {
      alert("Could not upload receipt: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleSaveRentPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailsRow) return;
    const numAmount = Number(rentRecordForm.amountPaid);
    if (!numAmount || numAmount <= 0 || isNaN(numAmount)) {
      alert("Please enter a valid payment amount greater than 0. Rent collection cannot be 0.");
      return;
    }

    setRecordingPayment(true);
    try {
      const compId = currentCompany?.id && isValidUuid(currentCompany.id) ? currentCompany.id : null;
      const staffName = (currentCompanyUser as any)?.fullName || user?.email || "Staff";
      const propId = detailsPropertyId && isValidUuid(detailsPropertyId)
        ? detailsPropertyId
        : detailsRow.propertyId && isValidUuid(detailsRow.propertyId)
        ? detailsRow.propertyId
        : null;
      const targetMonth = rentRecordForm.paidMonth || new Date().toISOString().slice(0, 7);

      // 1. Advance Payment Validation: Requires at least one advance month
      if (rentRecordForm.isAdvancePayment) {
        if (!rentRecordForm.advanceMonths || rentRecordForm.advanceMonths.length === 0) {
          alert("Please select at least one advance payment month (mandatory for advance payment).");
          setRecordingPayment(false);
          return;
        }
      } else {
        // 2. Regular Payment Flow: Check month rent status and remaining due
        if (currentMonthCalc) {
          if (currentMonthCalc.isFullyPaid) {
            alert(
              `Monthly rent for ${formatMonthLabel(targetMonth)} is already fully paid (${formatCurrency(currentMonthCalc.totalPaid)} of ${formatCurrency(currentMonthCalc.allocatedRent)}).\n\n` +
              `Recording additional regular payments for this month is prohibited.\n\n` +
              `To proceed, either suppress an invalid entry in the list above, or tick 'Advance Payment' to record rent for future months.`
            );
            setRecordingPayment(false);
            return;
          }

          if (currentMonthCalc.remainingDue > 0 && numAmount > currentMonthCalc.remainingDue) {
            alert(
              `Payment amount of ${formatCurrency(numAmount)} exceeds the remaining balance of ${formatCurrency(currentMonthCalc.remainingDue)} for this month (${formatMonthLabel(targetMonth)}).\n\n` +
              `Allocated monthly rent is ${formatCurrency(currentMonthCalc.allocatedRent)} (already recorded: ${formatCurrency(currentMonthCalc.totalPaid)}).\n\n` +
              `If this payment includes advance rent for upcoming months, please tick the 'Advance Payment' box.`
            );
            setRecordingPayment(false);
            return;
          }
        }
      }

      // Check for existing payments for this tenant and billing month to prevent duplicate accounting
      const { data: existingRentPayments } = await supabase
        .from("tenant_rent_payments")
        .select("id, amount_paid, payment_date, paid_months, pop_url, notes, is_suppressed")
        .eq("tenant_id", detailsRow.id)
        .order("created_at", { ascending: false });

      const matchingPayment = (existingRentPayments || []).find((p: any) => {
        if (isPaymentSuppressed(p)) return false;
        const matchesMonth = (Array.isArray(p.paid_months) && p.paid_months.includes(targetMonth)) ||
          String(p.payment_date || "").startsWith(targetMonth) ||
          (p.notes && p.notes.includes(targetMonth));
        return matchesMonth;
      });

      const notesPayload = [
        rentRecordForm.isAdvancePayment ? `[ADVANCE PAYMENT: ${rentRecordForm.advanceMonths.join(", ")}]` : null,
        `Means: ${rentRecordForm.paymentMethod}`,
        `Ref: ${rentRecordForm.referenceNumber || "None"}`,
        rentRecordForm.receiptUrl ? `Receipt: ${rentRecordForm.receiptUrl}` : null,
        rentRecordForm.notes ? `Notes: ${rentRecordForm.notes}` : null,
      ]
        .filter(Boolean)
        .join(" | ");

      // If a matching payment already exists for this billing month and user just attaches a POP receipt:
      if (matchingPayment && !rentRecordForm.isAdvancePayment) {
        if (rentRecordForm.receiptUrl && !matchingPayment.pop_url) {
          const { error: updateErr } = await supabase
            .from("tenant_rent_payments")
            .update({
              pop_url: rentRecordForm.receiptUrl,
              pop_uploaded_by_name: staffName,
              pop_uploaded_at: new Date().toISOString(),
              notes: notesPayload,
            })
            .eq("id", matchingPayment.id);

          if (!updateErr) {
            try {
              await supabase.from("tenant_payment_proofs").insert({
                company_id: compId,
                tenant_id: detailsRow.id,
                property_id: propId,
                customer_email: detailsRow.email,
                customer_name: detailsRow.fullName,
                amount: Number(matchingPayment.amount_paid || numAmount),
                payment_date: rentRecordForm.paymentDate,
                reference_number: rentRecordForm.referenceNumber || `${targetMonth} Rent`,
                document_url: rentRecordForm.receiptUrl,
                notes: `POP attached by: ${staffName} to Payment ID: ${matchingPayment.id}`,
                status: "verified",
              });
            } catch {}

            setRecordRentModalOpen(false);
            setRentRecordForm({
              paymentDate: new Date().toISOString().slice(0, 10),
              amountPaid: "",
              paidMonth: new Date().toISOString().slice(0, 7),
              paymentMethod: "EFT / Bank Transfer",
              receiptUrl: "",
              referenceNumber: "",
              notes: "",
              isAdvancePayment: false,
              advanceMonths: [],
            });
            await loadTenantDetails(detailsRow.id);
            reload();
            alert(`Proof of payment successfully attached to existing payment of ${formatCurrency(matchingPayment.amount_paid)} for ${targetMonth}. Duplicate payment prevented!`);
            return;
          }
        }
      }

      const paidMonths = rentRecordForm.isAdvancePayment && rentRecordForm.advanceMonths.length > 0
        ? rentRecordForm.advanceMonths
        : [targetMonth];

      const paymentPayload: Record<string, any> = {
        tenant_id: detailsRow.id,
        payment_date: rentRecordForm.paymentDate,
        amount_paid: numAmount,
        paid_months: paidMonths,
        paid_month: targetMonth,
        payment_method: rentRecordForm.paymentMethod || "EFT / Bank Transfer",
        notes: notesPayload,
        is_suppressed: false,
        is_advance: rentRecordForm.isAdvancePayment,
        advance_months: rentRecordForm.isAdvancePayment ? rentRecordForm.advanceMonths : null,
      };
      if (compId) paymentPayload.company_id = compId;
      if (staffName) paymentPayload.executed_by_name = staffName;
      if (rentRecordForm.receiptUrl) {
        paymentPayload.pop_url = rentRecordForm.receiptUrl;
        paymentPayload.pop_uploaded_by_name = staffName;
        paymentPayload.pop_uploaded_at = new Date().toISOString();
      }

      let insertedPayment: any = null;

      const { data: d1, error: e1 } = await supabase
        .from("tenant_rent_payments")
        .insert(paymentPayload)
        .select()
        .single();

      if (!e1) {
        insertedPayment = d1;
      } else {
        console.warn("Standard insert failed:", e1.message || JSON.stringify(e1), "– trying fallback");
        const fallbackPayload: Record<string, any> = {
          tenant_id: detailsRow.id,
          payment_date: rentRecordForm.paymentDate,
          amount_paid: numAmount,
          paid_months: paidMonths,
          notes: notesPayload,
        };
        if (compId) fallbackPayload.company_id = compId;
        if (staffName) fallbackPayload.executed_by_name = staffName;
        if (rentRecordForm.receiptUrl) {
          fallbackPayload.pop_url = rentRecordForm.receiptUrl;
          fallbackPayload.pop_uploaded_by_name = staffName;
          fallbackPayload.pop_uploaded_at = new Date().toISOString();
        }
        const { data: d2, error: e2 } = await supabase
          .from("tenant_rent_payments")
          .insert(fallbackPayload)
          .select()
          .single();

        if (e2) {
          const realMsg = e2.message || e2.details || e2.hint || JSON.stringify(e2);
          throw new Error(`DB error: ${realMsg}`);
        }
        insertedPayment = d2;
      }

      // Proof of payment record (non-fatal)
      if (rentRecordForm.receiptUrl) {
        try {
          await supabase.from("tenant_payment_proofs").insert({
            company_id: compId,
            tenant_id: detailsRow.id,
            property_id: propId,
            customer_email: detailsRow.email,
            customer_name: detailsRow.fullName,
            amount: Number(rentRecordForm.amountPaid),
            payment_date: rentRecordForm.paymentDate,
            reference_number: rentRecordForm.referenceNumber || `${rentRecordForm.paidMonth} Rent`,
            document_url: rentRecordForm.receiptUrl,
            notes: `Recorded by: ${staffName} | Means: ${rentRecordForm.paymentMethod}${rentRecordForm.notes ? " | " + rentRecordForm.notes : ""}`,
            status: "verified",
          });
        } catch (proofErr) {
          console.warn("tenant_payment_proofs (non-fatal):", proofErr);
        }
      }

      // Sync to finance_transactions (non-fatal)
      try {
        await supabase.from("finance_transactions").insert({
          company_id: compId,
          property_id: propId && isValidUuid(propId) ? propId : null,
          transaction_date: rentRecordForm.paymentDate,
          type: "income",
          category: "Rent Collection",
          amount: Number(rentRecordForm.amountPaid),
          payment_method: rentRecordForm.paymentMethod || "EFT / Bank Transfer",
          reference_number: rentRecordForm.referenceNumber || `${rentRecordForm.paidMonth} Rent`,
          description: `Rent payment for ${detailsRow.fullName} (${rentRecordForm.paidMonth})`,
          status: "approved",
          priority: "normal",
          recorded_by_name: staffName,
          recorded_by_role: "Rent Collection / Front Desk",
          attachments: rentRecordForm.receiptUrl ? [{ id: `pop-${Date.now()}`, name: "Proof of Payment", url: rentRecordForm.receiptUrl, type: "image", uploadedAt: new Date().toISOString(), uploadedByName: staffName }] : [],
        });
      } catch (fErr) {
        console.warn("Could not insert finance_transactions (non-fatal):", fErr);
      }

      // Audit log (non-fatal)
      try {
        await supabase.from("audit_log").insert({
          user_email: user?.email || "admin",
          user_name: staffName,
          action: "rent_payment_recorded",
          entity_type: "tenant_rent_payment",
          entity_id: insertedPayment?.id && isValidUuid(insertedPayment.id) ? insertedPayment.id : null,
          company_id: compId,
          details: {
            tenant_name: detailsRow.fullName,
            tenant_id: detailsRow.id,
            amount_paid: Number(rentRecordForm.amountPaid),
            payment_date: rentRecordForm.paymentDate,
            paid_month: rentRecordForm.paidMonth,
            means: rentRecordForm.paymentMethod,
            receipt_url: rentRecordForm.receiptUrl,
          },
        });
      } catch (auditErr) {
        console.warn("Audit log (non-fatal):", auditErr);
      }

      setRecordRentModalOpen(false);
      setRentRecordForm({
        paymentDate: new Date().toISOString().slice(0, 10),
        amountPaid: "",
        paidMonth: new Date().toISOString().slice(0, 7),
        paymentMethod: "EFT / Bank Transfer",
        receiptUrl: "",
        referenceNumber: "",
        notes: "",
        isAdvancePayment: false,
        advanceMonths: [],
      });

      await loadTenantDetails(detailsRow.id);
      reload();
      alert("Rent payment recorded successfully!");
    } catch (err: any) {
      const msg = err?.message || err?.details || err?.hint || (err instanceof Error ? err.message : JSON.stringify(err));
      alert("Could not record payment: " + msg);
    } finally {
      setRecordingPayment(false);
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
        .neq("status", "suppressed")
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
      user_email: user?.email || "admin@paimbabook.com",
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
        const messageText = `Dear ${detailsRow.fullName}, please find your rental invoice for ${invoice.month} in the amount of ${formatCurrency(invoice.amount)}.`;
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

  const shareInvoiceWithStaff = async (invoice: TenantInvoiceRow, staff: CompanyUser) => {
    if (!detailsRow) return;
    setSharingWithStaff(true);
    setOpenStaffDropdownInvoiceId(null);
    try {
      const paymentDates = await getInvoicePaymentDates(invoice.id);
      const invoiceHtml = await buildInvoiceHtmlProfessional(
        invoice,
        detailsRow.fullName,
        detailsPropertyName,
        paymentDates,
        user?.email ?? undefined,
      );

      const pdfUrl = await ensureShareableDocumentUrl(invoice.pdfUrl, invoiceHtml, `invoice-${invoice.id}.pdf`);
      const compId = currentCompany?.id && isValidUuid(currentCompany.id) ? currentCompany.id : null;

      // Log share to audit_log
      await supabase.from("audit_log").insert({
        user_email: user?.email || "admin@paimbabook.com",
        user_name: user?.user_metadata?.full_name || user?.email || "Admin",
        action: "invoice_shared_staff",
        entity_type: "invoice",
        entity_id: invoice.id,
        company_id: compId,
        details: {
          invoice_id: invoice.id,
          invoice_month: invoice.month,
          amount: invoice.amount,
          tenant_name: detailsRow.fullName,
          recipient_name: staff.fullName || staff.email,
          recipient_email: staff.email,
          recipient_role: staff.jobTitle || staff.roleLevel || "Staff",
          shared_by: user?.email || "Admin",
          channel: "Internal Staff Share",
          pdf_url: pdfUrl,
        },
      });

      // Open share modal pre-addressed to staff member
      setShareModalDoc({
        isOpen: true,
        documentTitle: `Share Invoice #${invoice.id.slice(0, 8)} with ${staff.fullName || staff.email}`,
        documentType: "Invoice",
        documentHtml: invoiceHtml,
        documentUrl: pdfUrl,
        fileNameBase: `invoice-${detailsRow.fullName.replace(/\s+/g, "_")}-${invoice.month}`,
        ownerName: staff.fullName || staff.email,
        ownerEmail: staff.email,
        defaultSubject: `Staff Share: Invoice ${invoice.month} for ${detailsRow.fullName}`,
        defaultMessage: `Hi ${staff.fullName || "Colleague"},\n\nPlease find the rental invoice for tenant ${detailsRow.fullName} (${invoice.month}) in the amount of ${formatCurrency(invoice.amount)} for your reference.`,
      });

      await loadTenantDetails(detailsRow.id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not share invoice with staff.");
    } finally {
      setSharingWithStaff(false);
    }
  };

  const suppressTenantInvoice = async (invoice: { id: string; month: string; amount: number }) => {
    const confirmSuppress = window.confirm(
      `Suppress this invoice for ${detailsRow?.fullName || "this tenant"} (${invoice.month})?\n\n` +
      `• Suppressed invoices remain in system audit records.\n` +
      `• It will no longer be shareable or active.\n` +
      `• This allows generating a new, corrected invoice for ${invoice.month}.`
    );
    if (!confirmSuppress) return;

    try {
      const { error: updateError } = await supabase
        .from("invoices")
        .update({ status: "suppressed" })
        .eq("id", invoice.id);

      if (updateError) throw updateError;

      const compId = currentCompany?.id && isValidUuid(currentCompany.id) ? currentCompany.id : null;
      await supabase.from("audit_log").insert({
        user_email: user?.email || "admin@paimbabook.com",
        user_name: user?.email ?? "Admin",
        action: "invoice_suppressed",
        entity_type: "invoice",
        company_id: compId,
        details: {
          invoice_id: invoice.id,
          tenant_name: detailsRow?.fullName,
          month: invoice.month,
          amount: invoice.amount,
          reason: "Suppressed by staff for correction/regeneration",
        },
      });

      if (detailsRow) {
        await loadTenantDetails(detailsRow.id);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to suppress invoice.");
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
                    <th className="px-6 py-4 font-bold text-center">Account</th>
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
                        {(() => {
                          const emailLower = (row.email || "").toLowerCase().trim();
                          const acc = accountStatusMap[emailLower];
                          if (acc?.type === "other_org_staff") {
                            return (
                              <span
                                className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20"
                                title={`Registered with ${acc.orgName} as staff`}
                              >
                                <AlertTriangle size={11} className="shrink-0" />
                                <span className="truncate max-w-[150px]">Registered with {acc.orgName} as staff</span>
                              </span>
                            );
                          }
                          if (acc?.type === "has_account") {
                            return (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 size={11} className="shrink-0" />
                                <span>Has Account</span>
                              </span>
                            );
                          }
                          return (
                            <span className="inline-flex items-center gap-1 rounded-full bg-muted/10 px-2.5 py-1 text-[11px] font-medium text-muted border border-border-color/40">
                              <span>No Account Yet</span>
                            </span>
                          );
                        })()}
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
                            icon={Eye}
                            label="View"
                            onClick={() => setViewTenantTarget(row)}
                          />
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
            <div className="bg-surface-elevated/50 p-6 rounded-2xl ring-1 ring-border-color/50 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-foreground text-surface shadow-lg">
                    <User size={28} />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold tracking-tight text-foreground">{detailsRow.fullName}</h4>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
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

              {/* Account Status and Invitation Banner */}
              {(() => {
                const emailLower = (detailsRow.email || "").toLowerCase().trim();
                const acc = accountStatusMap[emailLower];
                if (acc?.type === "other_org_staff") {
                  return (
                    <div className="pt-3 border-t border-border-color/50">
                      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <AlertTriangle size={18} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                          <div>
                            <p className="font-bold text-sm">Registered as Staff with Another Organization</p>
                            <p className="text-[11px] text-amber-700 dark:text-amber-400/90 mt-0.5">
                              This email ({detailsRow.email}) is registered as active staff with <strong>{acc.orgName}</strong>. To access tenant features, the resident must de-register that staff role or provide a personal email.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          <button
                            type="button"
                            onClick={() => void sendTenantInvitation(true)}
                            disabled={sendingInvitation}
                            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 transition shadow-xs disabled:opacity-50"
                          >
                            <Mail size={13} />
                            <span>{sendingInvitation ? "Sending..." : "Send Invitation & Notice"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={copyInvitationLink}
                            className="flex items-center gap-1 rounded-lg border border-amber-300 dark:border-amber-700 bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-elevated transition"
                            title="Copy invitation link"
                          >
                            {copiedLink ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                            <span>{copiedLink ? "Copied" : "Copy Link"}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
                if (acc?.type === "has_account") {
                  return (
                    <div className="pt-3 border-t border-border-color/50">
                      <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <div>
                            <p className="font-bold">Active Resident Portal Account Linked</p>
                            <p className="text-[11px] text-emerald-700 dark:text-emerald-400/90">
                              Resident has an active customer account ({detailsRow.email}) and can log in to view contracts, upload POPs, and chat.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => void sendTenantInvitation(false)}
                            disabled={sendingInvitation}
                            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 transition shadow-xs disabled:opacity-50"
                          >
                            <Send size={12} />
                            <span>{sendingInvitation ? "Sending..." : "Resend Access Link"}</span>
                          </button>
                          <button
                            type="button"
                            onClick={copyInvitationLink}
                            className="flex items-center gap-1 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-elevated transition"
                            title="Copy portal access link"
                          >
                            {copiedLink ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                            <span>{copiedLink ? "Copied" : "Copy Link"}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="pt-3 border-t border-border-color/50">
                    <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-800 dark:text-blue-300 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <Mail size={16} className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Resident Has Not Registered Yet</p>
                          <p className="text-[11px] text-blue-700 dark:text-blue-400/90 mt-0.5">
                            Invite {detailsRow.fullName} to register on Paimbabook to access digital invoices, lease contracts, direct chat, and maintenance ticketing.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => void sendTenantInvitation(false)}
                          disabled={sendingInvitation}
                          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition shadow-xs disabled:opacity-50"
                        >
                          <Send size={12} />
                          <span>{sendingInvitation ? "Sending..." : "Send Invitation Email"}</span>
                        </button>
                        <button
                          type="button"
                          onClick={copyInvitationLink}
                          className="flex items-center gap-1 rounded-lg border border-blue-300 dark:border-blue-700 bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-elevated transition"
                          title="Copy registration link"
                        >
                          {copiedLink ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                          <span>{copiedLink ? "Copied" : "Copy Link"}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {invitationSuccessMessage && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
                  <CheckCircle2 size={14} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>{invitationSuccessMessage}</span>
                </div>
              )}
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

            {/* Proof of Payment & Collection Timeline */}
            <section className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
                <div className="flex items-center gap-2">
                  <CreditCard size={18} className="text-muted/60" />
                  <div>
                    <h5 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted/60">
                      Proof of Payment &amp; Collection Timeline
                    </h5>
                    <p className="text-[10px] text-muted">
                      Traceable ledger combining tenant POP receipts and staff recorded collections
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setRentRecordForm((prev) => ({
                        ...prev,
                        amountPaid: prev.amountPaid || (detailsRequiredRent > 0 ? String(detailsRequiredRent) : ""),
                      }));
                      setRecordRentModalOpen(true);
                    }}
                    className="flex items-center gap-1.5 rounded-xl bg-foreground px-4 py-2 text-xs font-bold text-surface hover:opacity-90 transition shadow-sm"
                  >
                    <Plus size={14} />
                    <span>Record Payment / Upload POP</span>
                  </button>
                </div>
              </div>

              {paymentTimeline.length === 0 ? (
                <EmptyState
                  title="No payment history recorded"
                  description="Tenant has no recorded collections or submitted proof of payments yet. Use the button above to record a payment."
                />
              ) : (
                <div className="overflow-hidden rounded-2xl border border-border-color bg-surface shadow-xs">
                  <div className="divide-y divide-border-color/30">
                    {paymentTimeline.map((item) => {
                      const isSelected = item.paymentId ? selectedPaymentIds.includes(item.paymentId) : false;
                      return (
                        <div
                          key={item.id}
                          className={`p-4 hover:bg-surface-elevated/30 transition-colors ${
                            isSelected ? "bg-foreground/[0.02]" : ""
                          } ${item.isSuppressed ? "bg-red-500/[0.02] opacity-80" : ""}`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-start gap-3">
                              {item.paymentId && !item.isSuppressed ? (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => togglePaymentSelection(item.paymentId!)}
                                  className="h-4 w-4 rounded border-border-color accent-foreground mt-1 cursor-pointer"
                                  title="Select to batch into invoice"
                                />
                              ) : item.isSuppressed ? (
                                <span className="mt-1" title="Suppressed records cannot be invoiced">
                                  <Ban size={15} className="text-red-400 shrink-0" />
                                </span>
                              ) : null}
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {item.source === "tenant_pop" ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                      <User size={11} />
                                      <span>Uploaded by Tenant: {item.actorName}</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                      <ShieldAlert size={11} />
                                      <span>Recorded by Staff: {item.actorName}</span>
                                    </span>
                                  )}
                                  <span className="text-xs font-semibold text-muted">
                                    {formatDate(item.date)}
                                  </span>
                                  {item.monthLabel && (
                                    <span className="rounded-md bg-surface-elevated px-2 py-0.5 text-[10px] font-bold text-foreground">
                                      Period: {item.monthLabel}
                                    </span>
                                  )}
                                  {item.isSuppressed && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:text-red-400 border border-red-500/20">
                                      <Ban size={10} />
                                      <span>Suppressed</span>
                                    </span>
                                  )}
                                  {item.isAdvance && (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                      Advance Payment
                                    </span>
                                  )}
                                  {item.status && !item.isSuppressed && (
                                    <StatusBadge status={item.status} />
                                  )}
                                </div>

                                <div className="flex items-center gap-3 text-xs">
                                  <span className={`font-bold text-sm ${item.isSuppressed ? "line-through text-muted/70" : "text-foreground"}`}>
                                    {formatCurrency(item.amount)}
                                  </span>
                                  <span className="rounded-md bg-surface-elevated px-2 py-0.5 text-[11px] font-medium text-muted">
                                    Means: {item.method}
                                  </span>
                                </div>

                                {item.isSuppressed && item.suppressedReason && (
                                  <p className="text-[11px] text-red-500 font-medium">Reason: {item.suppressedReason}</p>
                                )}

                                {item.notes && (
                                  <p className="text-[11px] text-muted/80 line-clamp-1">{item.notes}</p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              {item.receiptUrl ? (
                                <div className="flex items-center gap-1.5">
                                  <a
                                    href={item.receiptUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 rounded-lg border border-border-color bg-surface-elevated px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-elevated/80 transition"
                                  >
                                    <FileText size={13} className="text-blue-600 dark:text-blue-400" />
                                    <span>View Attached POP</span>
                                    <ExternalLink size={11} className="text-muted" />
                                  </a>
                                  {item.paymentId && !item.isSuppressed && (
                                    <label className="cursor-pointer p-1.5 rounded-lg border border-border-color bg-surface hover:bg-surface-elevated text-muted hover:text-foreground transition text-xs" title="Update / Replace POP">
                                      <Upload size={12} />
                                      <input
                                        type="file"
                                        accept="image/*,application/pdf"
                                        className="hidden"
                                        disabled={attachingPopPaymentId === item.paymentId}
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file && item.paymentId) void handleAttachPopToPayment(item.paymentId, file);
                                        }}
                                      />
                                    </label>
                                  )}
                                </div>
                              ) : item.paymentId && !item.isSuppressed ? (
                                <label className="flex items-center gap-1.5 rounded-lg border border-dashed border-blue-500/50 bg-blue-500/5 px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 cursor-pointer transition">
                                  <Upload size={12} />
                                  <span>{attachingPopPaymentId === item.paymentId ? "Attaching..." : "Attach POP / Receipt"}</span>
                                  <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    className="hidden"
                                    disabled={attachingPopPaymentId === item.paymentId}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file && item.paymentId) void handleAttachPopToPayment(item.paymentId, file);
                                    }}
                                  />
                                </label>
                              ) : (
                                <span className="text-[11px] text-muted/40 italic">No receipt attached</span>
                              )}

                              {/* Action Buttons for Suppression & Restoration */}
                              {item.paymentId && (
                                item.isSuppressed ? (
                                  <button
                                    type="button"
                                    onClick={() => void handleUnsuppressPayment(item.paymentId!, item.amount)}
                                    className="flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition"
                                    title="Restore payment to active status"
                                  >
                                    <RotateCcw size={11} />
                                    <span>Restore</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setSuppressPrompt({ isOpen: true, paymentId: item.paymentId!, amount: item.amount, reason: "", submitting: false })}
                                    className="flex items-center gap-1 rounded-lg border border-red-500/20 bg-red-500/10 px-2 py-1 text-[11px] font-bold text-red-600 dark:text-red-400 hover:bg-red-500/20 transition"
                                    title="Suppress this entry so it does not count in totals"
                                  >
                                    <Ban size={11} />
                                    <span>Suppress</span>
                                  </button>
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {selectedPaymentIds.length > 0 && (
                    <div className="p-4 border-t border-border-color/50 bg-surface-elevated/20 flex items-center justify-between gap-4">
                      <p className="text-xs font-medium text-muted">
                        {selectedPaymentIds.length} payment transaction(s) selected
                      </p>
                      <button
                        type="button"
                        onClick={generateInvoiceFromSelectedPayments}
                        disabled={generatingInvoice}
                        className="flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-xs font-bold text-surface hover:opacity-90 transition disabled:opacity-50 shadow-md"
                      >
                        <Receipt size={16} />
                        <span>{generatingInvoice ? "Generating..." : `Generate Invoice from ${selectedPaymentIds.length} Selected`}</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Invoices & Contracts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Invoices Sub-section */}
              <section className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <Receipt size={16} className="text-muted/40" />
                    <h5 className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted/40">Invoices</h5>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGenerateInvoiceModalOpen(true)}
                    className="flex items-center gap-1.5 rounded-lg bg-foreground px-2.5 py-1 text-xs font-bold text-surface hover:opacity-90 shadow-2xs transition"
                  >
                    <Plus size={13} />
                    <span>Generate Invoice</span>
                  </button>
                </div>

                {invoices.length === 0 ? (
                  <div className="py-10 border border-dashed border-border-color rounded-xl"><EmptyState title="No invoices" description="" /></div>
                ) : (
                  <div className="space-y-3">
                    {invoices.map((invoice) => {
                      const isSuppressed = invoice.status === "suppressed";
                      return (
                        <div key={invoice.id} className={`p-4 rounded-xl border transition-colors group ${
                          isSuppressed
                            ? "border-amber-500/30 bg-amber-500/[0.04] opacity-80"
                            : "border-border-color bg-surface-elevated/40 hover:bg-surface-elevated"
                        }`}>
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-bold text-foreground">{invoice.month}</p>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                                isSuppressed
                                  ? "border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                  : ""
                              }`}
                            >
                              {isSuppressed ? "Suppressed (Superseded)" : <StatusBadge status={invoice.status} />}
                            </span>
                          </div>
                          <p className="text-lg font-bold text-foreground">{formatCurrency(invoice.amount)}</p>
                          <div className="flex items-center justify-between gap-1 mt-4 pt-3 border-t border-border-color/40">
                            <div className="flex items-center gap-1">
                              <button onClick={() => void openInvoicePreview(invoice)} className="p-1.5 rounded-lg border border-border-color hover:bg-foreground hover:text-surface transition-all text-xs" title="View Invoice"><Eye size={13} /></button>
                              <button onClick={() => void downloadInvoice(invoice)} className="p-1.5 rounded-lg border border-border-color hover:bg-foreground hover:text-surface transition-all text-xs" title="Download"><Download size={13} /></button>
                              {!isSuppressed && (
                                <button onClick={() => void shareInvoice(invoice, "whatsapp")} disabled={sharingInvoiceId === invoice.id} className="p-1.5 rounded-lg border border-border-color hover:bg-green-600 hover:text-white transition-all text-xs" title="WhatsApp"><Send size={13} /></button>
                              )}
                              {!isSuppressed ? (
                                <button
                                  type="button"
                                  onClick={() => void suppressTenantInvoice(invoice)}
                                  className="p-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-all text-xs font-semibold"
                                  title="Suppress invoice to allow generating a new corrected one for this month"
                                >
                                  Suppress
                                </button>
                              ) : (
                                <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold italic px-1">
                                  Archived
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 relative">
                              {!isSuppressed && (
                                <>
                                  {/* Send to Tenant */}
                                  <button
                                    type="button"
                                    onClick={() => void shareInvoice(invoice, "email")}
                                    disabled={sharingInvoiceId === invoice.id}
                                    className="flex items-center gap-1 rounded-lg border border-border-color bg-surface px-2 py-1 text-xs font-bold text-foreground hover:bg-sky-600 hover:text-white transition-all shadow-2xs"
                                    title="Send to tenant via email"
                                  >
                                    <Mail size={12} />
                                    <span>Send</span>
                                  </button>

                                  {/* Share with Staff dropdown */}
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={() => setOpenStaffDropdownInvoiceId(current => current === invoice.id ? null : invoice.id)}
                                      className="flex items-center gap-1 rounded-lg border border-border-color bg-surface px-2 py-1 text-xs font-bold text-muted hover:text-foreground transition-all shadow-2xs"
                                      title="Share with internal company staff"
                                    >
                                      <Users size={12} />
                                      <span>Share</span>
                                      <ChevronDown size={10} />
                                    </button>

                                    {openStaffDropdownInvoiceId === invoice.id && (
                                      <div className="absolute right-0 bottom-full mb-1 z-50 w-56 rounded-xl border border-border-color bg-surface p-1.5 shadow-xl space-y-1 max-h-48 overflow-y-auto">
                                        <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted border-b border-border-color/50">
                                          Share with Staff
                                        </div>
                                        {companyStaffList.length === 0 ? (
                                          <div className="p-2 text-[11px] text-muted text-center">No other staff found</div>
                                        ) : (
                                          companyStaffList.map((staff) => (
                                            <button
                                              key={staff.id || staff.userId}
                                              type="button"
                                              onClick={() => void shareInvoiceWithStaff(invoice, staff)}
                                              className="w-full text-left rounded-lg px-2 py-1.5 text-xs hover:bg-surface-elevated flex items-center justify-between transition"
                                            >
                                              <div className="min-w-0 pr-2">
                                                <p className="font-bold text-foreground truncate">{staff.fullName || staff.email}</p>
                                                <p className="text-[10px] text-muted truncate">{staff.jobTitle || staff.roleLevel || staff.email}</p>
                                              </div>
                                              <Send size={11} className="text-muted shrink-0" />
                                            </button>
                                          ))
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}

                              {/* Audit Trail button */}
                              <button
                                type="button"
                                onClick={() => setSelectedInvoiceForAudit(invoice)}
                                className="p-1.5 rounded-lg border border-border-color text-muted hover:text-foreground hover:bg-surface-elevated transition-all"
                                title="View Invoice Share & Audit Trail"
                              >
                                <History size={13} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
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

      {/* View Tenant Profile Modal */}
      <Modal
        open={Boolean(viewTenantTarget)}
        onClose={() => setViewTenantTarget(null)}
        title={`View Tenant — ${viewTenantTarget?.fullName ?? ""}`}
      >
        {viewTenantTarget && (
          <div className="space-y-6">
            {/* Details grid */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted/60 mb-1">Full Name</p>
                <p className="font-bold text-foreground">{viewTenantTarget.fullName || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted/60 mb-1">Phone</p>
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <Phone size={13} className="text-muted/50" />
                  <span>{viewTenantTarget.phone || "—"}</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted/60 mb-1">Email</p>
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <Mail size={13} className="text-muted/50" />
                  <span>{viewTenantTarget.email || "—"}</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted/60 mb-1">Property Assigned</p>
                <div className="flex items-center gap-1.5 font-medium text-foreground">
                  <MapPin size={13} className="text-muted/50" />
                  <span>{viewTenantTarget.propertyName || "Unassigned"}</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted/60 mb-1">Tenure Status</p>
                <StatusBadge status={viewTenantTarget.tenureStatus} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted/60 mb-1">Rent Status</p>
                <StatusBadge status={viewTenantTarget.rentStatus} />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t border-border-color/50">
              <button
                type="button"
                onClick={() => setViewTenantTarget(null)}
                className="rounded-md border border-border-color px-4 py-2 text-sm hover:bg-surface-elevated transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  const target = viewTenantTarget;
                  setViewTenantTarget(null);
                  openEdit(target);
                }}
                className="flex items-center gap-2 rounded-md bg-foreground px-4 py-2 text-sm font-bold text-surface hover:opacity-90 transition-all"
              >
                <Pencil size={14} />
                Edit Tenant
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Record Rent Payment & Proof of Payment Modal */}
      <Modal
        open={recordRentModalOpen}
        onClose={() => setRecordRentModalOpen(false)}
        title="Record Rent Payment & Proof of Payment"
      >
        <form onSubmit={handleSaveRentPayment} className="space-y-4">
          <div className="rounded-xl bg-surface-elevated/70 p-3.5 border border-border-color text-xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-foreground text-sm">{detailsRow?.fullName || "Tenant"}</p>
                <p className="text-[11px] text-muted mt-0.5">
                  Assigned Property: <span className="font-semibold text-foreground">{detailsPropertyName || "Assigned Property"}</span>
                </p>
              </div>
              <span className="rounded-md bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Staff Collection
              </span>
            </div>

            {/* Required Rent Display */}
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60">
              <div>
                <span className="text-[10px] uppercase font-bold text-blue-800 dark:text-blue-300 block tracking-wider">Required Rent for Property</span>
                <span className="text-base font-black text-blue-700 dark:text-blue-400">
                  {detailsRequiredRent > 0 ? formatCurrency(detailsRequiredRent) : "None Set on Property"}
                </span>
              </div>
              {detailsRequiredRent > 0 && (
                <button
                  type="button"
                  onClick={() => setRentRecordForm((prev) => ({ ...prev, amountPaid: String(detailsRequiredRent) }))}
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-2.5 py-1 text-xs font-bold shadow-xs transition"
                  title="Auto-fill exact property rent"
                >
                  Fill Required ({formatCurrency(detailsRequiredRent)})
                </button>
              )}
            </div>
          </div>

          {/* REAL-TIME MONTHLY CALCULATION & BANNER */}
          {currentMonthCalc && (
            <div className="space-y-3">
              {currentMonthCalc.isFullyPaid ? (
                <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-600 dark:text-amber-400 text-sm">
                    <CheckCircle2 size={18} className="shrink-0" />
                    <span>Monthly Rent for {formatMonthLabel(rentRecordForm.paidMonth)} is Fully Paid</span>
                  </div>
                  <p className="text-muted leading-relaxed">
                    The tenant has completely paid the allocated property rent of <strong>{formatCurrency(currentMonthCalc.allocatedRent)}</strong> for <strong>{formatMonthLabel(rentRecordForm.paidMonth)}</strong> (Total recorded: <strong>{formatCurrency(currentMonthCalc.totalPaid)}</strong> across {currentMonthCalc.activePayments.length} payment{currentMonthCalc.activePayments.length !== 1 ? "s" : ""}).
                  </p>
                  <div className="rounded-lg bg-surface/80 border border-amber-500/30 p-2.5 text-[11px] text-foreground font-semibold flex items-center gap-2">
                    <Ban size={14} className="text-red-500 shrink-0" />
                    <span>Recording additional regular rent for this month is prohibited.</span>
                  </div>
                  <p className="text-[11px] text-muted">
                    <strong>To record another payment:</strong> Either suppress one of the entries below (if void/invalid) to reopen the balance, or tick <strong>Advance Payment</strong> below to record rent for future months.
                  </p>
                </div>
              ) : currentMonthCalc.isPartial ? (
                <div className="rounded-xl border border-blue-500/40 bg-blue-500/10 p-3.5 text-xs space-y-2">
                  <div className="flex items-center gap-2 font-bold text-blue-600 dark:text-blue-400 text-sm">
                    <AlertCircle size={18} className="shrink-0" />
                    <span>Partial Rent Recorded for {formatMonthLabel(rentRecordForm.paidMonth)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 p-2 rounded-lg bg-surface/80 border border-blue-500/20 text-center">
                    <div>
                      <span className="text-[10px] text-muted block font-bold uppercase">Required</span>
                      <span className="font-bold text-foreground">{formatCurrency(currentMonthCalc.allocatedRent)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted block font-bold uppercase">Paid So Far</span>
                      <span className="font-bold text-blue-600 dark:text-blue-400">{formatCurrency(currentMonthCalc.totalPaid)}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-muted block font-bold uppercase">Remaining Balance</span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(currentMonthCalc.remainingDue)}</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-muted">
                    Multiple collections are permitted for this tenant until the remaining balance of <strong>{formatCurrency(currentMonthCalc.remainingDue)}</strong> is fully collected.
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border border-border-color bg-surface-elevated/40 p-3 text-xs flex items-center justify-between">
                  <span className="text-muted">
                    No active payments recorded yet for <strong>{formatMonthLabel(rentRecordForm.paidMonth)}</strong>.
                  </span>
                  <span className="font-bold text-foreground">
                    Required: {formatCurrency(currentMonthCalc.allocatedRent)}
                  </span>
                </div>
              )}

              {/* All Recorded Entries for this Month */}
              <div className="rounded-xl border border-border-color bg-surface-elevated/20 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-wider text-muted flex items-center gap-1.5">
                    <History size={12} />
                    <span>All Entries on Record for {formatMonthLabel(rentRecordForm.paidMonth)} ({currentMonthCalc.allPaymentsForMonth.length})</span>
                  </label>
                  <span className="text-[11px] font-bold text-muted">
                    Active Total: <strong className="text-foreground">{formatCurrency(currentMonthCalc.totalPaid)}</strong> / {formatCurrency(currentMonthCalc.allocatedRent)}
                  </span>
                </div>

                {currentMonthCalc.allPaymentsForMonth.length === 0 ? (
                  <p className="text-[11px] text-muted/60 italic py-1">No payments recorded for this billing month yet.</p>
                ) : (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-0.5">
                    {currentMonthCalc.allPaymentsForMonth.map((p) => {
                      const isSupp = isPaymentSuppressed(p);
                      const isAdv = isPaymentAdvance(p);
                      const amt = Number(p.amount_paid || p.amountPaid || 0);
                      const pDate = p.payment_date || p.paymentDate || "-";
                      const pMethod = p.payment_method || p.paymentMethod || "EFT / Bank";
                      const clerk = p.executed_by_name || p.executedByName || p.recorded_by || "Staff";
                      const popUrl = p.pop_url || p.popUrl;
                      const suppReason = p.suppressed_reason || p.suppressedReason;
                      return (
                        <div
                          key={p.id}
                          className={`rounded-lg border p-2.5 text-xs flex items-center justify-between gap-2 transition ${
                            isSupp
                              ? "border-red-500/20 bg-red-500/[0.03] opacity-75"
                              : "border-border-color bg-surface"
                          }`}
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`font-bold ${isSupp ? "line-through text-muted" : "text-foreground"}`}>
                                {formatCurrency(amt)}
                              </span>
                              {isSupp && (
                                <span className="rounded bg-red-500/10 border border-red-500/20 px-1.5 py-0.2 text-[9px] font-bold text-red-600">
                                  Suppressed
                                </span>
                              )}
                              {isAdv && (
                                <span className="rounded bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.2 text-[9px] font-bold text-indigo-600">
                                  Advance
                                </span>
                              )}
                              <span className="rounded bg-surface-elevated px-1.5 py-0.2 text-[9px] font-medium text-muted">
                                {pMethod}
                              </span>
                              <span className="text-[10px] text-muted font-medium">{pDate}</span>
                            </div>
                            <p className="text-[10px] text-muted truncate">
                              Recorded by: {clerk}
                              {isSupp && suppReason && ` • Reason: ${suppReason}`}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {popUrl && (
                              <a
                                href={popUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline px-1.5 py-1"
                                title="View attached Proof of Payment"
                              >
                                <FileText size={11} /> POP
                              </a>
                            )}
                            {isSupp ? (
                              <button
                                type="button"
                                onClick={() => void handleUnsuppressPayment(p.id, amt)}
                                className="rounded border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-[10px] font-bold text-blue-600 hover:bg-blue-500/20 transition flex items-center gap-1"
                                title="Restore this entry to active accounting totals"
                              >
                                <RotateCcw size={10} /> Restore
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setSuppressPrompt({ isOpen: true, paymentId: p.id, amount: amt, reason: "", submitting: false })}
                                className="rounded border border-red-500/20 bg-red-500/10 px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-500/20 transition flex items-center gap-1"
                                title="Suppress / Void this entry so it does not count in totals"
                              >
                                <Ban size={10} /> Suppress
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Payment Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={rentRecordForm.paymentDate}
                onChange={(e) => setRentRecordForm((prev) => ({ ...prev, paymentDate: e.target.value }))}
                className="w-full rounded-lg border border-border-color bg-surface px-3 py-2 text-sm text-foreground focus:border-foreground focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Paid Period / Month <span className="text-red-500">*</span>
              </label>
              <input
                type="month"
                required
                value={rentRecordForm.paidMonth}
                onChange={(e) => setRentRecordForm((prev) => ({ ...prev, paidMonth: e.target.value }))}
                className="w-full rounded-lg border border-border-color bg-surface px-3 py-2 text-sm text-foreground focus:border-foreground focus:outline-hidden"
              />
            </div>
          </div>

          {/* ADVANCE PAYMENT TICK BOX & MULTI-MONTH SELECTOR */}
          <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-3.5 space-y-3">
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rentRecordForm.isAdvancePayment}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setRentRecordForm((prev) => {
                    const upcoming = checked && prev.advanceMonths.length === 0
                      ? generateUpcomingMonths(1, true, prev.paidMonth)
                      : prev.advanceMonths;
                    const autoAmount = checked && detailsRequiredRent > 0 && upcoming.length > 0
                      ? String(upcoming.length * detailsRequiredRent)
                      : prev.amountPaid;
                    return {
                      ...prev,
                      isAdvancePayment: checked,
                      advanceMonths: upcoming,
                      amountPaid: autoAmount,
                    };
                  });
                }}
                className="mt-0.5 h-4 w-4 rounded border-border-color text-indigo-600 focus:ring-indigo-500"
              />
              <div>
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <span>Advance Payment</span>
                  <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[9px] font-black text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                    Multi-Month / Future Rent
                  </span>
                </span>
                <p className="text-[10px] text-muted mt-0.5">
                  Tick this box to record payments in advance for upcoming months. Advance payments can exceed single-month rent (e.g. paying 6 months at once) and can be recorded multiple times.
                </p>
              </div>
            </label>

            {rentRecordForm.isAdvancePayment && (
              <div className="pt-2 border-t border-indigo-500/20 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase tracking-wider text-indigo-700 dark:text-indigo-300 flex items-center gap-1">
                    <span>Select Advance Payment Months</span>
                    <span className="text-red-500 font-bold">* (Mandatory)</span>
                  </label>
                  <span className="text-[11px] font-bold text-foreground">
                    {rentRecordForm.advanceMonths.length} month{rentRecordForm.advanceMonths.length !== 1 ? "s" : ""} selected
                  </span>
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-muted font-bold mr-1">Quick Select:</span>
                  {[1, 2, 3, 6, 12].map((cnt) => {
                    const gen = generateUpcomingMonths(cnt, true, rentRecordForm.paidMonth);
                    const isSelectedPreset = rentRecordForm.advanceMonths.length === cnt && gen.every(m => rentRecordForm.advanceMonths.includes(m));
                    return (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => {
                          setRentRecordForm((prev) => ({
                            ...prev,
                            advanceMonths: gen,
                            amountPaid: detailsRequiredRent > 0 ? String(cnt * detailsRequiredRent) : prev.amountPaid,
                          }));
                        }}
                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                          isSelectedPreset
                            ? "bg-indigo-600 text-white shadow-xs"
                            : "border border-border-color bg-surface hover:bg-surface-elevated text-foreground"
                        }`}
                      >
                        +{cnt} {cnt === 1 ? "Month" : "Months"}
                      </button>
                    );
                  })}
                </div>

                {/* Month Toggle Chips */}
                <div className="flex items-center gap-1.5 flex-wrap max-h-32 overflow-y-auto p-1.5 bg-surface rounded-lg border border-border-color">
                  {generateUpcomingMonths(12, true, rentRecordForm.paidMonth).map((m) => {
                    const isSel = rentRecordForm.advanceMonths.includes(m);
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setRentRecordForm((prev) => {
                            const next = isSel ? prev.advanceMonths.filter(x => x !== m) : [...prev.advanceMonths, m].sort();
                            const autoAmt = detailsRequiredRent > 0 && next.length > 0
                              ? String(next.length * detailsRequiredRent)
                              : prev.amountPaid;
                            return { ...prev, advanceMonths: next, amountPaid: autoAmt };
                          });
                        }}
                        className={`rounded-md px-2.5 py-1 text-xs font-bold transition flex items-center gap-1 select-none ${
                          isSel
                            ? "bg-indigo-600 text-white"
                            : "bg-surface-elevated hover:bg-surface text-muted hover:text-foreground border border-border-color"
                        }`}
                      >
                        {isSel && <Check size={12} />}
                        <span>{formatMonthLabel(m)}</span>
                      </button>
                    );
                  })}
                </div>

                {rentRecordForm.advanceMonths.length === 0 && (
                  <p className="text-[11px] font-bold text-red-500">
                    * Please select at least one advance payment month.
                  </p>
                )}

                {rentRecordForm.advanceMonths.length > 0 && detailsRequiredRent > 0 && (
                  <div className="flex items-center justify-between p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs">
                    <span className="text-muted">
                      Suggested total ({rentRecordForm.advanceMonths.length} × {formatCurrency(detailsRequiredRent)}):
                    </span>
                    <button
                      type="button"
                      onClick={() => setRentRecordForm(prev => ({ ...prev, amountPaid: String(prev.advanceMonths.length * detailsRequiredRent) }))}
                      className="font-black text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      {formatCurrency(rentRecordForm.advanceMonths.length * detailsRequiredRent)} (Apply Suggested)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-foreground">
                  Amount Paid <span className="text-red-500">*</span>
                </label>
                {!rentRecordForm.isAdvancePayment && currentMonthCalc && !currentMonthCalc.isFullyPaid && currentMonthCalc.remainingDue > 0 && (
                  <button
                    type="button"
                    onClick={() => setRentRecordForm((prev) => ({ ...prev, amountPaid: String(currentMonthCalc.remainingDue) }))}
                    className="text-[10px] font-bold text-emerald-600 hover:underline"
                  >
                    Fill Remaining ({formatCurrency(currentMonthCalc.remainingDue)})
                  </button>
                )}
              </div>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                disabled={!rentRecordForm.isAdvancePayment && currentMonthCalc?.isFullyPaid}
                value={rentRecordForm.amountPaid}
                onChange={(e) => setRentRecordForm((prev) => ({ ...prev, amountPaid: e.target.value }))}
                className="w-full rounded-lg border border-border-color bg-surface px-3 py-2 text-sm font-bold text-foreground focus:border-foreground focus:outline-hidden disabled:opacity-50 disabled:bg-surface-elevated"
              />
              {!rentRecordForm.isAdvancePayment && currentMonthCalc && !currentMonthCalc.isFullyPaid && Number(rentRecordForm.amountPaid) > currentMonthCalc.remainingDue && (
                <p className="text-[10px] font-bold text-amber-600 mt-1">
                  Exceeds remaining monthly balance of {formatCurrency(currentMonthCalc.remainingDue)}. Tick &quot;Advance Payment&quot; if paying ahead.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-1">
                Means of Collection <span className="text-red-500">*</span>
              </label>
              <select
                value={rentRecordForm.paymentMethod}
                onChange={(e) => setRentRecordForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                className="w-full rounded-lg border border-border-color bg-surface px-3 py-2 text-sm text-foreground focus:border-foreground focus:outline-hidden"
              >
                <option value="Cash">Cash</option>
                <option value="EFT / Bank Transfer">EFT / Bank Transfer</option>
                <option value="POS Card">POS Card</option>
                <option value="Mobile Money">Mobile Money</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Reference / Receipt Number
            </label>
            <input
              type="text"
              placeholder="e.g. TXN-829103, Bank Slip #, Cheque # (optional)"
              value={rentRecordForm.referenceNumber}
              onChange={(e) => setRentRecordForm((prev) => ({ ...prev, referenceNumber: e.target.value }))}
              className="w-full rounded-lg border border-border-color bg-surface px-3 py-2 text-sm text-foreground focus:border-foreground focus:outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Proof of Payment / Receipt Document (PDF or Image)
            </label>
            <div className="rounded-xl border border-dashed border-border-color p-4 bg-surface-elevated/20 text-center">
              {rentRecordForm.receiptUrl ? (
                <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-surface border border-border-color">
                  <div className="flex items-center gap-2 truncate">
                    <FileText size={16} className="text-blue-500 shrink-0" />
                    <span className="text-xs text-foreground truncate max-w-[220px]">
                      {rentRecordForm.receiptUrl.split("/").pop() || "Attached Receipt"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={rentRecordForm.receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 rounded-md text-xs font-semibold text-blue-600 hover:bg-surface-elevated"
                      title="View"
                    >
                      <ExternalLink size={14} />
                    </a>
                    <button
                      type="button"
                      onClick={() => setRentRecordForm((prev) => ({ ...prev, receiptUrl: "" }))}
                      className="p-1 rounded-md text-xs font-semibold text-red-500 hover:bg-surface-elevated"
                      title="Remove"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center cursor-pointer">
                  <UploadCloud size={24} className="text-muted/60 mb-1" />
                  <span className="text-xs font-bold text-foreground">
                    {uploadingReceipt ? "Uploading receipt..." : "Click to upload POP / Receipt"}
                  </span>
                  <span className="text-[10px] text-muted">Supports JPG, PNG, PDF</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    disabled={uploadingReceipt}
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      if (file) void handleReceiptFileUpload(file);
                    }}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1">
              Notes / Remarks
            </label>
            <textarea
              rows={2}
              placeholder="Add any internal notes about this payment..."
              value={rentRecordForm.notes}
              onChange={(e) => setRentRecordForm((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full rounded-lg border border-border-color bg-surface px-3 py-2 text-sm text-foreground focus:border-foreground focus:outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-border-color/50">
            <button
              type="button"
              onClick={() => setRecordRentModalOpen(false)}
              className="rounded-lg border border-border-color px-4 py-2 text-sm hover:bg-surface-elevated transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                recordingPayment ||
                uploadingReceipt ||
                !rentRecordForm.amountPaid ||
                Number(rentRecordForm.amountPaid) <= 0 ||
                (!rentRecordForm.isAdvancePayment && currentMonthCalc?.isFullyPaid) ||
                (rentRecordForm.isAdvancePayment && rentRecordForm.advanceMonths.length === 0)
              }
              className="flex items-center gap-2 rounded-lg bg-foreground px-5 py-2 text-sm font-bold text-surface hover:opacity-90 transition-all disabled:opacity-50"
            >
              <CreditCard size={15} />
              <span>{recordingPayment ? "Recording..." : "Save Payment & Proof"}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Payment Suppression Confirmation Modal */}
      <Modal
        open={suppressPrompt.isOpen}
        onClose={() => setSuppressPrompt({ isOpen: false, paymentId: null, amount: 0, reason: "", submitting: false })}
        title="Suppress Payment Record"
      >
        <div className="space-y-4">
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-red-600 dark:text-red-400 text-sm">
              <Ban size={16} />
              <span>Suppress Entry of {formatCurrency(suppressPrompt.amount)}</span>
            </div>
            <p className="text-muted leading-relaxed">
              Suppressed records are <strong>not deleted</strong> and remain in system audit logs with a permanent &quot;Suppressed&quot; label.
            </p>
            <p className="text-muted leading-relaxed">
              However, this entry will be <strong>strictly excluded from all accounting, financial reports, revenue totals, collection rates, and balance calculations</strong> throughout the platform.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted mb-1.5">
              Reason for Suppression <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={suppressPrompt.reason}
              onChange={(e) => setSuppressPrompt(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="e.g. Accidental duplicate entry, bounced bank transfer, clerical correction..."
              className="w-full rounded-xl border border-border-color bg-surface p-3 text-sm outline-none focus:ring-2 focus:ring-red-500/20"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-color">
            <button
              type="button"
              onClick={() => setSuppressPrompt({ isOpen: false, paymentId: null, amount: 0, reason: "", submitting: false })}
              className="rounded-lg border border-border-color px-4 py-2 text-sm font-bold text-muted hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={suppressPrompt.submitting || !suppressPrompt.reason.trim()}
              onClick={handleSuppressPayment}
              className="flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50"
            >
              <Ban size={14} />
              <span>{suppressPrompt.submitting ? "Suppressing..." : "Confirm Suppression"}</span>
            </button>
          </div>
        </div>
      </Modal>

      {/* Generate Invoice from Payments Modal */}
      <Modal
        open={generateInvoiceModalOpen}
        onClose={() => setGenerateInvoiceModalOpen(false)}
        title={detailsRow ? `Generate Invoice: ${detailsRow.fullName}` : "Generate Invoice"}
      >
        <div className="space-y-4">
          <p className="text-xs text-muted">
            Select the payment transactions you wish to include on this invoice. Each chosen transaction will appear as an itemized line item.
          </p>

          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {paymentTimeline.length === 0 && payments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border-color p-6 text-center text-xs text-muted">
                No recorded payments found for this tenant. Record a payment first to generate an invoice.
              </div>
            ) : (
              (paymentTimeline.length > 0 ? paymentTimeline : payments.map(p => ({
                id: p.id,
                date: p.paymentDate,
                amount: p.amountPaid,
                method: "Bank / EFT",
                actorName: p.recordedBy || "Staff",
                receiptUrl: undefined,
              }))).map((item) => {
                const isSelected = selectedPaymentIds.includes(item.id);
                return (
                  <label
                    key={item.id}
                    className={`flex items-start justify-between gap-3 rounded-xl border p-3 cursor-pointer transition select-none ${
                      isSelected
                        ? "border-foreground bg-surface-elevated shadow-xs"
                        : "border-border-color bg-surface hover:bg-surface-elevated/40"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPaymentIds((prev) => [...prev, item.id]);
                          } else {
                            setSelectedPaymentIds((prev) => prev.filter((id) => id !== item.id));
                          }
                        }}
                        className="mt-0.5 rounded border-border-color text-foreground h-4 w-4"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-foreground">{formatCurrency(item.amount)}</span>
                          <span className="text-[10px] font-bold text-muted rounded-full bg-surface-elevated border border-border-color px-2 py-0.5">
                            {item.method || "Payment"}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted mt-0.5">
                          Paid on {formatDate(item.date)} • Recorded by {item.actorName || "Staff"}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0" onClick={(e) => e.stopPropagation()}>
                      {item.receiptUrl ? (
                        <a
                          href={item.receiptUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                        >
                          <FileText size={10} /> View POP <ExternalLink size={9} />
                        </a>
                      ) : (
                        <span className="text-[10px] text-muted/60">No POP</span>
                      )}
                    </div>
                  </label>
                );
              })
            )}
          </div>

          <div className="pt-2 border-t border-border-color flex items-center justify-between">
            <div>
              <span className="text-xs text-muted">
                {selectedPaymentIds.length} payment{selectedPaymentIds.length !== 1 ? "s" : ""} selected
              </span>
              {selectedPaymentIds.length > 0 && (
                <p className="text-sm font-black text-foreground">
                  Total: {formatCurrency(
                    (paymentTimeline.length > 0
                      ? paymentTimeline.filter(p => selectedPaymentIds.includes(p.id))
                      : payments.filter(p => selectedPaymentIds.includes(p.id))
                    ).reduce((sum: number, p: any) => sum + Number(p.amount ?? p.amountPaid ?? 0), 0)
                  )}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setGenerateInvoiceModalOpen(false)}
                className="rounded-lg border border-border-color px-4 py-2 text-xs font-bold text-muted hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  await generateInvoiceFromSelectedPayments();
                  setGenerateInvoiceModalOpen(false);
                }}
                disabled={generatingInvoice || selectedPaymentIds.length === 0}
                className="rounded-lg bg-foreground px-5 py-2 text-xs font-bold text-surface hover:opacity-90 disabled:opacity-50 transition shadow-xs flex items-center gap-1.5"
              >
                <Receipt size={14} />
                <span>{generatingInvoice ? "Generating..." : "Generate Invoice"}</span>
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Invoice Share & Distribution Audit Trail Modal */}
      <Modal
        open={Boolean(selectedInvoiceForAudit)}
        onClose={() => setSelectedInvoiceForAudit(null)}
        title={selectedInvoiceForAudit ? `Invoice Audit Trail: #${selectedInvoiceForAudit.id.slice(0, 8)} (${selectedInvoiceForAudit.month})` : "Invoice Audit Trail"}
      >
        {selectedInvoiceForAudit && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border-color bg-surface-elevated/40 p-3.5 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Invoice Amount</span>
                <p className="text-lg font-black text-foreground">{formatCurrency(selectedInvoiceForAudit.amount)}</p>
                <p className="text-xs text-muted">Due date: {formatDate(selectedInvoiceForAudit.dueDate)}</p>
              </div>
              <div className="text-right">
                <StatusBadge status={selectedInvoiceForAudit.status} />
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => void openInvoicePreview(selectedInvoiceForAudit)}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                  >
                    <Eye size={12} /> View Shared Snapshot
                  </button>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <History size={14} className="text-muted" />
                <h5 className="text-xs font-bold uppercase tracking-wider text-muted">Distribution History &amp; Shares</h5>
              </div>

              {loadingInvoiceAudit ? (
                <div className="p-6 text-center text-xs text-muted">Loading audit records...</div>
              ) : invoiceAuditLogs.length === 0 && shareReports.length === 0 ? (
                <div className="p-6 rounded-xl border border-dashed border-border-color text-center text-xs text-muted">
                  No distribution or sharing events recorded for this invoice yet.
                </div>
              ) : (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {invoiceAuditLogs.map((log) => {
                    const details = log.details || {};
                    return (
                      <div key={log.id} className="rounded-xl border border-border-color bg-surface p-3 text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-foreground capitalize">
                            {log.action?.replace(/_/g, " ") || "Invoice Event"}
                          </span>
                          <span className="text-[10px] text-muted">
                            {log.created_at ? new Date(log.created_at).toLocaleString() : "-"}
                          </span>
                        </div>
                        <div className="text-muted flex items-center gap-1 flex-wrap">
                          <span>Recipient: <strong className="text-foreground">{details.recipient_name || details.recipient_email || "Recipient"}</strong></span>
                          {details.recipient_role && <span className="text-[10px] text-muted/80">({details.recipient_role})</span>}
                          {details.channel && <span>via <strong>{details.channel}</strong></span>}
                        </div>
                        <div className="text-[11px] text-muted/80 pt-1 border-t border-border-color/40 flex items-center justify-between">
                          <span>Shared by: {log.user_name || log.user_email || "Staff"}</span>
                          {details.pdf_url && (
                            <a href={details.pdf_url} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1">
                              <ExternalLink size={10} /> Open Attached Doc
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {shareReports.map((report) => (
                    <div key={report.id} className="rounded-xl border border-border-color bg-surface p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-foreground capitalize">
                          Distribution via {report.channel}
                        </span>
                        <span className="text-[10px] text-muted">
                          {report.sharedAt ? new Date(report.sharedAt).toLocaleString() : "-"}
                        </span>
                      </div>
                      <p className="text-muted">
                        Linked Payment Dates: {report.paymentDates.length ? report.paymentDates.join(", ") : "Manual share"}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-border-color">
              <button
                type="button"
                onClick={() => setSelectedInvoiceForAudit(null)}
                className="rounded-lg border border-border-color px-4 py-2 text-xs font-bold text-foreground hover:bg-surface-elevated"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </Modal>
    </ModulePage>
  );
}

