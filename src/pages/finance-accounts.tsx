import { useEffect, useMemo, useState, useRef } from "react";
import { ModulePage } from "@/components/module-page";
import { ErrorState, LoadingState } from "@/components/data-state";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { isValidUuid } from "@/lib/data";
import { fetchAdminInfo, fetchCompanyInfo, downloadPdfDocument, uploadFileToBucket } from "@/lib/storage";
import { DocumentShareModal } from "@/components/document-share-modal";
import { Modal } from "@/components/modal";
import {
  Download,
  Mail,
  Eye,
  Plus,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
  Upload,
  Search,
  ArrowRight,
  DollarSign,
  Activity,
  FileCheck,
  Shield,
  Users,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Paperclip,
  X,
  ChevronRight,
  Filter,
  AlertCircle,
  FileSpreadsheet,
  Building2,
  Calendar,
  FileSignature,
  Check,
  ChevronDown,
  Trash2,
  ExternalLink,
  Sparkles,
  Send,
  UserCheck,
  ShieldAlert,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import {
  buildBalanceSheetHtml,
  type AdminInfo,
  type BalanceSheetMonthlyRow,
  type BalanceSheetTransactionRow,
  type CompanyInfo,
} from "@/lib/document-templates";
import {
  fetchProcurementRequests,
  approveAccountsFunding,
  advancePipelineStage,
  MOCK_PROCUREMENT_REQUESTS,
} from "@/lib/data";
import type { ProcurementRequest, ProcurementPipelineEvent } from "@/lib/types";

export type ScopeMode = "system" | "property";
export type PresentationMode = "summary" | "expanded";
export type TimePreset = "this_month" | "last_3" | "last_6" | "last_12" | "last_24" | "last_60";

export type BalanceSheetSummary = {
  rentCollected: number;
  maintenance: number;
  bills: number;
  renovations: number;
  tax: number;
  totalExpenses: number;
  netProfit: number;
};

type BalanceSheetTransaction = BalanceSheetTransactionRow;
export type FinanceTransactionAttachment = {
  id: string;
  name: string;
  url: string;
  type: "pdf" | "image" | "document";
  size?: number;
  uploadedAt: string;
  uploadedByName: string;
};

export type FinanceTransaction = {
  id: string;
  companyId?: string;
  propertyId?: string;
  propertyName?: string;
  transactionDate: string;
  type: "income" | "expense" | "transfer" | "payment";
  category: string;
  amount: number;
  paymentMethod: string;
  referenceNumber: string;
  description: string;
  status: "approved" | "pending_approval" | "rejected";
  priority: "low" | "normal" | "urgent" | "critical";
  attachments: FinanceTransactionAttachment[];
  recordedByUserId?: string;
  recordedByName: string;
  recordedByRole?: string;
  approvalRequestedTo?: string;
  approvalRequestedToName?: string;
  approvedByUserId?: string;
  approvedByName?: string;
  approvedAt?: string;
  signatureUrl?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
};

export const FINANCE_STAFF_HIERARCHY = [
  { id: "fin-cfo", name: "Thamsanqa Lubasi", role: "CFO / Financial Director", level: "Executive", badgeColor: "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300" },
  { id: "fin-mgr", name: "Grace Ndlovu", role: "Finance Manager / Senior Accountant", level: "Manager", badgeColor: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300" },
  { id: "fin-audit", name: "David Mthembu", role: "Internal Auditor", level: "Auditor", badgeColor: "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300" },
  { id: "fin-ap", name: "Sipho Khumalo", role: "Accounts Payable Specialist", level: "Staff", badgeColor: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300" },
  { id: "fin-desk", name: "Nomsa Dlamini", role: "Front Desk / Operations Accountant", level: "Staff", badgeColor: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
];

const TRANSACTION_CATEGORIES = [
  "Rental Income",
  "Utility - Electricity",
  "Utility - Water & Refuse",
  "Utility - Internet & WiFi",
  "Property Maintenance & Repairs",
  "Renovations & Upgrades",
  "Office & Administrative Supplies",
  "Cleaning & Hygiene Services",
  "Marketing & Advertising",
  "Legal & Professional Fees",
  "Security & Access Control",
  "Vendor Direct Payment",
  "Payroll & Staff Allowances",
  "Petty Cash Reimbursement",
  "Tax Provision & Levies",
  "Bank & Transaction Fees",
  "General Operating Expense",
];

const presetLabels: Record<TimePreset, string> = {
  this_month: "This month",
  last_3: "Last 3 months",
  last_6: "6 months",
  last_12: "Last year",
  last_24: "2 years",
  last_60: "5 years",
};

const presetMonthOffsets: Record<TimePreset, number> = {
  this_month: 0,
  last_3: 2,
  last_6: 5,
  last_12: 11,
  last_24: 23,
  last_60: 59,
};

// formatCurrency is provided by useCurrency() hook inside the component

function firstDayOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toMonthKey(value: string) {
  return String(value).slice(0, 7);
}

function humanize(value: string) {
  return String(value || "general")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\w/, (char) => char.toUpperCase());
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const value = (error as { message?: unknown }).message;
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
}

function isMissingDbObjectError(error: unknown) {
  const message = getErrorMessage(error, "").toLowerCase();
  return (
    message.includes("does not exist") ||
    message.includes("could not find") ||
    message.includes("schema cache") ||
    message.includes("column")
  );
}

function buildMonthRange(startDate: string, endDate: string) {
  const start = firstDayOfMonth(new Date(startDate));
  const end = firstDayOfMonth(new Date(endDate));
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return [] as string[];
  }

  const months: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
    cursor = addMonths(cursor, 1);
  }
  return months;
}

function classifyMaintenanceCategory(category: string) {
  const normalized = category.toLowerCase();
  if (normalized.includes("bill") || normalized.includes("utility") || normalized.includes("electric") || normalized.includes("water")) {
    return "bills" as const;
  }
  return "maintenance" as const;
}

async function fetchOptionalTable<T>(table: string, selector: string, startDate: string, endDate: string): Promise<T[]> {
  const { data, error } = await supabase
    .from(table)
    .select(selector)
    .gte("created_at", `${startDate}T00:00:00.000Z`)
    .lte("created_at", `${endDate}T23:59:59.999Z`);

  if (error) {
    if (isMissingDbObjectError(error)) {
      return [];
    }
    throw error;
  }

  return (data ?? []) as T[];
}

type PaymentProjection = {
  payment_date?: string;
  amount_paid?: number;
  tenant_id?: string;
  executed_by_name?: string;
  created_by?: string;
  recorded_by?: string;
  collected_by?: string;
  tenants?: { property_id?: string; full_name?: string } | null;
};

type PaymentWithProperty = {
  paymentDate: string;
  amountPaid: number;
  tenantPropertyId: string;
  tenantName: string;
  executor: string;
};

function pickExecutor(record: Record<string, unknown>) {
  const candidates = ["executed_by", "recorded_by", "collected_by", "created_by", "updated_by", "executor", "actor"];
  for (const key of candidates) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "-";
}

async function fetchPaymentsWithProperty(startDate: string, endDate: string): Promise<PaymentWithProperty[]> {
  const richJoin = await supabase
    .from("tenant_rent_payments")
    .select("payment_date, amount_paid, tenant_id, executed_by_name, created_by, recorded_by, collected_by, tenants(property_id, full_name)")
    .gte("payment_date", startDate)
    .lte("payment_date", endDate)
    .order("payment_date");
// Initial mock transactions to seed rich daily operations immediately
const SEED_FINANCE_TRANSACTIONS: FinanceTransaction[] = [
  {
    id: "tx-seed-001",
    transactionDate: new Date().toISOString().slice(0, 10),
    type: "expense",
    category: "Office & Administrative Supplies",
    amount: 1850,
    paymentMethod: "EFT / Bank Transfer",
    referenceNumber: "INV-TZ-8841",
    description: "Purchase of high-grade printing paper, toner cartridges and filing folders for reception desk.",
    status: "approved",
    priority: "normal",
    attachments: [
      {
        id: "att-1",
        name: "TechZone_Invoice_8841.pdf",
        url: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=1200&auto=format&fit=crop&q=80",
        type: "pdf",
        uploadedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
        uploadedByName: "Nomsa Dlamini",
      },
    ],
    recordedByName: "Nomsa Dlamini",
    recordedByRole: "Front Desk / Operations Accountant",
    approvedByName: "Grace Ndlovu",
    approvedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: "tx-seed-002",
    transactionDate: new Date().toISOString().slice(0, 10),
    type: "payment",
    category: "Utility - Electricity",
    amount: 6420,
    paymentMethod: "EFT / Bank Transfer",
    referenceNumber: "ELEC-2026-SEP",
    description: "Municipal prepaid electricity bulk reload for commercial lodging blocks and central heating.",
    status: "approved",
    priority: "urgent",
    attachments: [
      {
        id: "att-2",
        name: "City_Power_Receipt_441.jpg",
        url: "https://images.unsplash.com/photo-1586281380349-632531db7ed4?w=1200&auto=format&fit=crop&q=80",
        type: "image",
        uploadedAt: new Date(Date.now() - 3600000 * 8).toISOString(),
        uploadedByName: "Thamsanqa Lubasi",
      },
    ],
    recordedByName: "Thamsanqa Lubasi",
    recordedByRole: "CFO / Financial Director",
    approvedByName: "Thamsanqa Lubasi",
    approvedAt: new Date(Date.now() - 3600000 * 7).toISOString(),
    createdAt: new Date(Date.now() - 3600000 * 8).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 7).toISOString(),
  },
  {
    id: "tx-seed-003",
    transactionDate: new Date().toISOString().slice(0, 10),
    type: "expense",
    category: "Property Maintenance & Repairs",
    amount: 3200,
    paymentMethod: "EFT / Bank Transfer",
    referenceNumber: "PLUMB-902",
    description: "Emergency main waterline valve replacement and pressure inspection by AquaFix Plumbing.",
    status: "pending_approval",
    priority: "urgent",
    approvalRequestedTo: "fin-mgr",
    approvalRequestedToName: "Grace Ndlovu",
    attachments: [
      {
        id: "att-3",
        name: "AquaFix_Quote_Invoice_902.pdf",
        url: "https://images.unsplash.com/photo-1450133064473-71024230f91b?w=1200&auto=format&fit=crop&q=80",
        type: "pdf",
        uploadedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
        uploadedByName: "Sipho Khumalo",
      },
    ],
    recordedByName: "Sipho Khumalo",
    recordedByRole: "Accounts Payable Specialist",
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
];

  if (!richJoin.error) {
    return ((richJoin.data ?? []) as PaymentProjection[]).map((row) => ({
      paymentDate: String(row.payment_date ?? ""),
      amountPaid: Number(row.amount_paid ?? 0),
      tenantPropertyId: String((row.tenants as { property_id?: string } | null)?.property_id ?? ""),
      tenantName: String((row.tenants as { full_name?: string } | null)?.full_name ?? "Tenant"),
      executor: String(row.executed_by_name ?? "") || pickExecutor(row as Record<string, unknown>),
    }));
  }

  if (!isMissingDbObjectError(richJoin.error)) {
    throw richJoin.error;
  }

  const withJoin = await supabase
    .from("tenant_rent_payments")
    .select("payment_date, amount_paid, tenant_id, tenants(property_id)")
    .gte("payment_date", startDate)
    .lte("payment_date", endDate)
    .order("payment_date");

  if (!withJoin.error) {
    return ((withJoin.data ?? []) as PaymentProjection[]).map((row) => ({
      paymentDate: String(row.payment_date ?? ""),
      amountPaid: Number(row.amount_paid ?? 0),
      tenantPropertyId: String((row.tenants as { property_id?: string } | null)?.property_id ?? ""),
      tenantName: String((row.tenants as { full_name?: string } | null)?.full_name ?? "Tenant"),
      executor: "-",
    }));
  }

  if (!isMissingDbObjectError(withJoin.error)) {
    throw withJoin.error;
  }

  const base = await supabase
    .from("tenant_rent_payments")
    .select("payment_date, amount_paid, tenant_id")
    .gte("payment_date", startDate)
    .lte("payment_date", endDate)
    .order("payment_date");

  if (base.error) throw base.error;

  const rows = (base.data ?? []) as PaymentProjection[];
  const tenantIds = Array.from(new Set(rows.map((row) => String(row.tenant_id ?? "")).filter(Boolean)));

  let tenantPropertyMap = new Map<string, string>();
  if (tenantIds.length > 0) {
    const tenantsResult = await supabase
      .from("tenants")
      .select("id, property_id, full_name")
      .in("id", tenantIds);
    if (!tenantsResult.error) {
      tenantPropertyMap = new Map(
        (tenantsResult.data ?? []).map((row) => [String(row.id ?? ""), String(row.property_id ?? "")]),
      );
    }
  }

  let tenantNameMap = new Map<string, string>();
  if (tenantIds.length > 0) {
    const namesResult = await supabase
      .from("tenants")
      .select("id, full_name")
      .in("id", tenantIds);
    if (!namesResult.error) {
      tenantNameMap = new Map(
        (namesResult.data ?? []).map((row) => [String(row.id ?? ""), String(row.full_name ?? "Tenant")]),
      );
    }
  }

  return rows.map((row) => {
    const tenantId = String(row.tenant_id ?? "");
    return {
      paymentDate: String(row.payment_date ?? ""),
      amountPaid: Number(row.amount_paid ?? 0),
      tenantPropertyId: tenantPropertyMap.get(tenantId) ?? "",
      tenantName: tenantNameMap.get(tenantId) ?? "Tenant",
      executor: "-",
    };
  });
}

type MaintenanceProjection = {
  created_at?: string;
  cost?: number;
  actual_cost?: number;
  category?: string;
  description?: string;
  property_id?: string;
  executed_by_name?: string;
  maintainers?: { name?: string } | null;
  created_by?: string;
  updated_by?: string;
  executed_by?: string;
};

const mapUrgencyToPriority = (u?: string): "low" | "normal" | "urgent" | "critical" => {
  if (u === "critical") return "critical";
  if (u === "high" || u === "urgent") return "urgent";
  if (u === "low") return "low";
  return "normal";
};

type AdminUserRow = {
  id: string;
  email: string;
  fullName: string;
};

function buildAdminLookup(users: AdminUserRow[]) {
  const lookup = new Map<string, string>();
  users.forEach((user) => {
    if (user.id) lookup.set(user.id.toLowerCase(), user.fullName);
    if (user.email) lookup.set(user.email.toLowerCase(), user.fullName);
  });
  return lookup;
}

function resolveExecutorName(rawValue: string, lookup: Map<string, string>) {
  const value = String(rawValue ?? "").trim();
  if (!value) return "-";
  return lookup.get(value.toLowerCase()) ?? value;
}

async function fetchMaintenanceRows(startDate: string, endDate: string): Promise<MaintenanceProjection[]> {
  const rich = await supabase
    .from("maintenance")
    .select("created_at, cost, actual_cost, category, description, property_id, executed_by_name, created_by, updated_by, executed_by, maintainers(name)")
    .gte("created_at", `${startDate}T00:00:00.000Z`)
    .lte("created_at", `${endDate}T23:59:59.999Z`);

  if (!rich.error) {
    return (rich.data ?? []) as MaintenanceProjection[];
  }

  if (!isMissingDbObjectError(rich.error)) {
    throw rich.error;
  }

  const withProperty = await supabase
    .from("maintenance")
    .select("created_at, cost, actual_cost, category, description, property_id")
    .gte("created_at", `${startDate}T00:00:00.000Z`)
    .lte("created_at", `${endDate}T23:59:59.999Z`);

  if (!withProperty.error) {
    return (withProperty.data ?? []) as MaintenanceProjection[];
  }

  if (!isMissingDbObjectError(withProperty.error)) {
    throw withProperty.error;
  }

  const fallback = await supabase
    .from("maintenance")
    .select("created_at, cost, actual_cost, category, description")
    .gte("created_at", `${startDate}T00:00:00.000Z`)
    .lte("created_at", `${endDate}T23:59:59.999Z`);

  if (fallback.error) throw fallback.error;

  return ((fallback.data ?? []) as MaintenanceProjection[]).map((row) => ({
    ...row,
    property_id: "",
  }));
}

export default function FinanceAccountsPage() {
  const { currentCompany, user, currentCompanyUser } = useAuth();
  const { format: formatCurrency } = useCurrency();
  const today = new Date();

  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  // Primary navigation tabs
  const [activeTab, setActiveTab] = useState<"journal" | "balance_sheet" | "procurement" | "pending">("journal");

  // Balance Sheet Generator State
  const [scope, setScope] = useState<ScopeMode>("system");
  const [propertyId, setPropertyId] = useState("");
  const [startDate, setStartDate] = useState(() => toIsoDate(firstDayOfMonth(new Date())));
  const [endDate, setEndDate] = useState(() => toIsoDate(new Date()));
  const [preset, setPreset] = useState<TimePreset>("this_month");
  const [presentation, setPresentation] = useState<PresentationMode>("summary");
  const [showSignature, setShowSignature] = useState(true);
  const [showAdminName, setShowAdminName] = useState(true);
  const [showExecutor, setShowExecutor] = useState(true);
  const [dailyMode, setDailyMode] = useState(false);

  const [summary, setSummary] = useState<BalanceSheetSummary | null>(null);
  const [monthlyRows, setMonthlyRows] = useState<BalanceSheetMonthlyRow[]>([]);
  const [transactionRows, setTransactionRows] = useState<BalanceSheetTransactionRow[]>([]);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Daily Journal & Transactions State
  const [financeTransactions, setFinanceTransactions] = useState<FinanceTransaction[]>(() => {
    const saved = localStorage.getItem(`finance_txs_${currentCompany?.id || "default"}`);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [];
  });
  const [txSearch, setTxSearch] = useState("");
  const [txTypeFilter, setTxTypeFilter] = useState("all");
  const [txStatusFilter, setTxStatusFilter] = useState("all");
  const [selectedTxForAudit, setSelectedTxForAudit] = useState<FinanceTransaction | null>(null);
  const [retroProofUploading, setRetroProofUploading] = useState(false);

  // Record Transaction Modal State
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [savingTx, setSavingTx] = useState(false);
  const [txForm, setTxForm] = useState({
    type: "expense" as "income" | "expense" | "transfer" | "payment",
    category: "Office & Administrative Supplies",
    amount: "",
    propertyId: "",
    paymentMethod: "EFT / Bank Transfer",
    referenceNumber: "",
    description: "",
    transactionDate: new Date().toISOString().slice(0, 10),
    requestApproval: false,
    approvalRequestedTo: "fin-mgr",
    priority: "normal" as "low" | "normal" | "urgent" | "critical",
    attachments: [] as FinanceTransactionAttachment[],
  });
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  // Procurement Requests State
  const [procurementRequests, setProcurementRequests] = useState<ProcurementRequest[]>([]);
  const [loadingProcurement, setLoadingProcurement] = useState(false);
  const [procurementFilter, setProcurementFilter] = useState<"all" | "my_sig" | "other_sig" | "approved">("all");
  const [selectedProcurementForTimeline, setSelectedProcurementForTimeline] = useState<ProcurementRequest | null>(null);
  const [reassignModalReq, setReassignModalReq] = useState<ProcurementRequest | null>(null);
  const [reassignTargetStaffId, setReassignTargetStaffId] = useState("fin-mgr");
  const [reassignNotes, setReassignNotes] = useState("");
  const [authorizingProcId, setAuthorizingProcId] = useState<string | null>(null);

  // Pending Matters State
  const [pendingSortBy, setPendingSortBy] = useState<"priority" | "date_asc" | "date_desc">("priority");

  // Document Share Modal
  const [shareModalDoc, setShareModalDoc] = useState<{
    isOpen: boolean;
    documentTitle: string;
    documentType: string;
    documentHtml: string;
    documentUrl?: string;
    fileNameBase: string;
    ownerName: string;
    ownerEmail: string;
    defaultSubject: string;
    defaultMessage: string;
  }>({
    isOpen: false,
    documentTitle: "",
    documentType: "",
    documentHtml: "",
    fileNameBase: "balance-sheet",
    ownerName: "",
    ownerEmail: "",
    defaultSubject: "",
    defaultMessage: "",
  });

  // Save transactions to local storage as fallback cache
  useEffect(() => {
    if (financeTransactions.length > 0) {
      localStorage.setItem(`finance_txs_${currentCompany?.id || "default"}`, JSON.stringify(financeTransactions));
    }
  }, [financeTransactions, currentCompany?.id]);

  // Load properties, procurement requests, and finance transactions
  useEffect(() => {
    let cancelled = false;
    async function init() {
      try {
        const compId = currentCompany?.id;
        let pQuery = supabase.from("properties").select("id, name").order("name");
        if (compId && isValidUuid(compId)) {
          pQuery = pQuery.or(`company_id.eq.${compId},company_id.is.null`);
        }
        const { data: propData } = await pQuery;
        if (!cancelled && propData) {
          setProperties(propData.map((row) => ({ id: String(row.id), name: String(row.name) })));
        }

        // Fetch Procurement Requests
        setLoadingProcurement(true);
        const pReqs = await fetchProcurementRequests(compId || undefined);
        if (!cancelled) {
          setProcurementRequests(pReqs);
        }

        // Fetch database finance transactions if table exists
        if (compId && isValidUuid(compId)) {
          const { data: dbTxs } = await supabase
            .from("finance_transactions")
            .select("*")
            .eq("company_id", compId)
            .order("transaction_date", { ascending: false });
          if (!cancelled && dbTxs && dbTxs.length > 0) {
            setFinanceTransactions(
              dbTxs.map((row: any) => ({
                id: row.id,
                companyId: row.company_id,
                propertyId: row.property_id,
                transactionDate: row.transaction_date,
                type: row.type,
                category: row.category,
                amount: Number(row.amount || 0),
                paymentMethod: row.payment_method || "EFT / Bank Transfer",
                referenceNumber: row.reference_number || "",
                description: row.description,
                status: row.status,
                priority: row.priority || "normal",
                attachments: Array.isArray(row.attachments) ? row.attachments : [],
                recordedByUserId: row.recorded_by_user_id,
                recordedByName: row.recorded_by_name || "Staff",
                recordedByRole: row.recorded_by_role || "Finance",
                approvalRequestedTo: row.approval_requested_to,
                approvalRequestedToName: row.approval_requested_to_name,
                approvedByUserId: row.approved_by_user_id,
                approvedByName: row.approved_by_name,
                approvedAt: row.approved_at,
                signatureUrl: row.signature_url,
                rejectionReason: row.rejection_reason,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
              }))
            );
          }
        }
      } catch (err) {
        console.warn("Error initializing finance accounts:", err);
      } finally {
        if (!cancelled) setLoadingProcurement(false);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [currentCompany?.id]);

  const scopeLabel = useMemo(() => {
    if (scope === "system") {
      return currentCompany?.name ? `${currentCompany.name} (Portfolio)` : "Company Portfolio (All Properties)";
    }
    const selected = properties.find((item) => item.id === propertyId);
    return selected ? `Property: ${selected.name}` : "Property";
  }, [scope, propertyId, properties, currentCompany]);

  const applyPreset = (key: TimePreset) => {
    setPreset(key);
    setDailyMode(false);
    const now = new Date();
    const end = toIsoDate(now);
    const monthsBack = presetMonthOffsets[key];
    const start = toIsoDate(firstDayOfMonth(addMonths(now, -monthsBack)));
    setStartDate(start);
    setEndDate(end);
  };

  const applyDailyPreset = (dayOffset = 0) => {
    setDailyMode(true);
    const target = new Date(Date.now() + dayOffset * 86400000);
    const dateStr = toIsoDate(target);
    setStartDate(dateStr);
    setEndDate(dateStr);
  };

  // Generate Balance Sheet Report
  const generateBalanceSheet = async () => {
    setLoading(true);
    setError(null);

    try {
      if (!startDate || !endDate) throw new Error("Select both start and end dates.");
      if (startDate > endDate) throw new Error("Start date cannot be after end date.");
      if (scope === "property" && !propertyId) throw new Error("Select a property when scope is set to 'Specific property'.");

      const [company, admin, usersResult, payments, maintenanceRows, renovations, bills] = await Promise.all([
        fetchCompanyInfo(),
        fetchAdminInfo(user?.email ?? undefined),
        supabase.from("users").select("id, email, first_name, last_name"),
        fetchPaymentsWithProperty(startDate, endDate),
        fetchMaintenanceRows(startDate, endDate),
        fetchOptionalTable<Array<{ created_at?: string; cost?: number; actual_cost?: number; property_id?: string }>[number]>(
          "renovations",
          "created_at, cost, actual_cost, property_id",
          startDate,
          endDate,
        ),
        fetchOptionalTable<Array<{ created_at?: string; amount?: number; property_id?: string }>[number]>(
          "bills",
          "created_at, amount, property_id",
          startDate,
          endDate,
        ),
      ]);

      setCompanyInfo(company);
      setAdminInfo(admin);

      const adminLookup = buildAdminLookup(
        (usersResult.data ?? []).map((row) => ({
          id: String(row.id ?? ""),
          email: String(row.email ?? ""),
          fullName: `${String((row as Record<string, unknown>).first_name ?? "")} ${String((row as Record<string, unknown>).last_name ?? "")}`.trim() || String(row.email ?? "Admin"),
        })),
      );

      const monthKeys = buildMonthRange(startDate, endDate);
      const monthMap = new Map<string, BalanceSheetMonthlyRow>();
      const transactions: BalanceSheetTransaction[] = [];
      monthKeys.forEach((month) => {
        monthMap.set(month, {
          month,
          rentCollected: 0,
          maintenance: 0,
          bills: 0,
          renovations: 0,
          tax: 0,
          totalExpenses: 0,
          netProfit: 0,
        });
      });

      const companyPropertyIds = new Set(properties.map((p) => p.id));

      // 1. Process Payments / Rent Collected
      payments.forEach((row) => {
        const tenantPropertyId = row.tenantPropertyId;
        if (scope === "property" && tenantPropertyId !== propertyId) return;
        if (scope === "system" && companyPropertyIds.size > 0 && !companyPropertyIds.has(tenantPropertyId)) return;
        const month = toMonthKey(row.paymentDate);
        if (!monthMap.has(month)) return;
        monthMap.get(month)!.rentCollected += Number(row.amountPaid ?? 0);
        transactions.push({
          date: row.paymentDate,
          month,
          entryType: "income",
          category: "Rent Collected",
          details: `Rent payment accepted: ${row.tenantName}`,
          executor: resolveExecutorName(row.executor, adminLookup),
          amount: Number(row.amountPaid ?? 0),
          tax: 0,
          net: Number(row.amountPaid ?? 0),
        });
      });

      // 2. Process Maintenance
      maintenanceRows.forEach((row) => {
        const maintPropId = String(row.property_id ?? "");
        if (scope === "property" && maintPropId !== propertyId) return;
        if (scope === "system" && companyPropertyIds.size > 0 && maintPropId && !companyPropertyIds.has(maintPropId)) return;
        const month = toMonthKey(String(row.created_at ?? ""));
        if (!monthMap.has(month)) return;
        const amount = Number(row.actual_cost ?? row.cost ?? 0);
        const categoryLabel = humanize(String(row.category ?? "general"));
        const description = String(row.description ?? "").trim();
        const executor = String(row.executed_by_name ?? "") || (pickExecutor(row as Record<string, unknown>) !== "-"
          ? pickExecutor(row as Record<string, unknown>)
          : String((row.maintainers as { name?: string } | null)?.name ?? "-"));
        if (classifyMaintenanceCategory(String(row.category ?? "")) === "bills") {
          monthMap.get(month)!.bills += amount;
          transactions.push({
            date: String(row.created_at ?? `${month}-01`).slice(0, 10),
            month,
            entryType: "expense",
            category: "Bill Payment",
            details: `Bill payment: ${categoryLabel}${description ? ` - ${description}` : ""}`,
            executor: resolveExecutorName(executor, adminLookup),
            amount,
            tax: 0,
            net: -amount,
          });
        } else {
          monthMap.get(month)!.maintenance += amount;
          transactions.push({
            date: String(row.created_at ?? `${month}-01`).slice(0, 10),
            month,
            entryType: "expense",
            category: "Work Order Fee",
            details: `Work order fee: ${categoryLabel}${description ? ` - ${description}` : ""}`,
            executor: resolveExecutorName(executor, adminLookup),
            amount,
            tax: 0,
            net: -amount,
          });
        }
      });

      // 3. Process Renovations
      renovations.forEach((row) => {
        const renoPropId = String(row.property_id ?? "");
        if (scope === "property" && renoPropId !== propertyId) return;
        if (scope === "system" && companyPropertyIds.size > 0 && renoPropId && !companyPropertyIds.has(renoPropId)) return;
        const month = toMonthKey(String(row.created_at ?? ""));
        if (!monthMap.has(month)) return;
        const amount = Number(row.actual_cost ?? row.cost ?? 0);
        monthMap.get(month)!.renovations += amount;
        transactions.push({
          date: String(row.created_at ?? `${month}-01`).slice(0, 10),
          month,
          entryType: "expense",
          category: "Renovation",
          details: `Renovation expense entry`,
          executor: resolveExecutorName(String((row as Record<string, unknown>).executed_by_name ?? "") || pickExecutor(row as Record<string, unknown>), adminLookup),
          amount,
          tax: 0,
          net: -amount,
        });
      });

      // 4. Process Bills
      bills.forEach((row) => {
        const billPropId = String(row.property_id ?? "");
        if (scope === "property" && billPropId !== propertyId) return;
        if (scope === "system" && companyPropertyIds.size > 0 && billPropId && !companyPropertyIds.has(billPropId)) return;
        const month = toMonthKey(String(row.created_at ?? ""));
        if (!monthMap.has(month)) return;
        const amount = Number(row.amount ?? 0);
        monthMap.get(month)!.bills += amount;
        const rowRecord = row as Record<string, unknown>;
        const billHint = humanize(String(rowRecord.title ?? rowRecord.name ?? rowRecord.category ?? "general bill"));
        transactions.push({
          date: String(row.created_at ?? `${month}-01`).slice(0, 10),
          month,
          entryType: "expense",
          category: "Bill Payment",
          details: `Bill payment: ${billHint}`,
          executor: resolveExecutorName(String((row as Record<string, unknown>).executed_by_name ?? "") || pickExecutor(row as Record<string, unknown>), adminLookup),
          amount,
          tax: 0,
          net: -amount,
        });
      });

      // 5. Process Approved Daily Finance Transactions
      financeTransactions
        .filter((tx) => tx.status === "approved")
        .filter((tx) => tx.transactionDate >= startDate && tx.transactionDate <= endDate)
        .forEach((tx) => {
          if (scope === "property" && tx.propertyId && tx.propertyId !== propertyId) return;
          const month = toMonthKey(tx.transactionDate);
          if (tx.type === "income") {
            if (monthMap.has(month)) monthMap.get(month)!.rentCollected += tx.amount;
            transactions.push({
              date: tx.transactionDate,
              month,
              entryType: "income",
              category: tx.category,
              details: `${tx.description} (${tx.referenceNumber || "Direct"})`,
              executor: tx.approvedByName || tx.recordedByName,
              amount: tx.amount,
              tax: 0,
              net: tx.amount,
            });
          } else if (tx.type === "expense" || tx.type === "payment") {
            if (monthMap.has(month)) monthMap.get(month)!.maintenance += tx.amount;
            transactions.push({
              date: tx.transactionDate,
              month,
              entryType: "expense",
              category: tx.category,
              details: `${tx.description} (${tx.referenceNumber || "Direct"})`,
              executor: tx.approvedByName || tx.recordedByName,
              amount: tx.amount,
              tax: 0,
              net: -tx.amount,
            });
          }
        });

      // Compute Taxes and Totals
      monthMap.forEach((val) => {
        val.tax = val.rentCollected * ((company.taxRate ?? 0) / 100);
        val.totalExpenses = val.maintenance + val.bills + val.renovations;
        val.netProfit = val.rentCollected - val.totalExpenses - val.tax;
        if (val.tax > 0) {
          transactions.push({
            date: `${val.month}-28`,
            month: val.month,
            entryType: "tax",
            category: "Tax",
            details: `Tax accrued for ${val.month}`,
            executor: "System",
            amount: val.tax,
            tax: val.tax,
            net: -val.tax,
          });
        }
      });

      const monthly = Array.from(monthMap.values()).sort((a, b) => a.month.localeCompare(b.month));
      const reportSummary: BalanceSheetSummary = {
        rentCollected: monthly.reduce((sum, row) => sum + row.rentCollected, 0),
        maintenance: monthly.reduce((sum, row) => sum + row.maintenance, 0),
        bills: monthly.reduce((sum, row) => sum + row.bills, 0),
        renovations: monthly.reduce((sum, row) => sum + row.renovations, 0),
        tax: monthly.reduce((sum, row) => sum + row.tax, 0),
        totalExpenses: monthly.reduce((sum, row) => sum + row.totalExpenses, 0),
        netProfit: monthly.reduce((sum, row) => sum + row.netProfit, 0),
      };

      setMonthlyRows(monthly);
      setTransactionRows(
        transactions
          .filter((row) => row.month && row.date)
          .sort((a, b) => `${a.date}-${a.category}`.localeCompare(`${b.date}-${b.category}`))
      );
      setSummary(reportSummary);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Could not generate balance sheet."));
    } finally {
      setLoading(false);
    }
  };

  // Generate and open PDF
  const openPdfWindow = (autoPrint: boolean) => {
    if (!summary || !companyInfo || !adminInfo) {
      setError("Generate the balance sheet first.");
      return;
    }

    const html = buildBalanceSheetHtml(
      {
        scopeLabel,
        startDate,
        endDate,
        presentation,
        includeSignature: showSignature,
        includeAdminName: showAdminName,
        includeExecutor: showExecutor,
        summary,
        monthlyRows,
        transactionRows,
      },
      companyInfo,
      adminInfo
    );

    const win = window.open("about:blank", "_blank");
    if (!win) {
      setError("Please allow popups to view/download PDF.");
      return;
    }

    win.document.open();
    win.document.write(html);
    win.document.close();

    if (autoPrint) {
      setTimeout(() => {
        win.focus();
        win.print();
      }, 300);
    }
  };

  const getBalanceSheetHtml = () => {
    if (!summary || !companyInfo || !adminInfo) return "";
    return buildBalanceSheetHtml(
      {
        scopeLabel,
        startDate,
        endDate,
        presentation,
        includeSignature: showSignature,
        includeAdminName: showAdminName,
        includeExecutor: showExecutor,
        summary,
        monthlyRows,
        transactionRows,
      },
      companyInfo,
      adminInfo
    );
  };

  const handleDownloadBalanceSheetPdf = () => {
    const html = getBalanceSheetHtml();
    if (!html) {
      setError("Please generate the balance sheet first.");
      return;
    }
    const cleanScope = scopeLabel.replace(/[^a-zA-Z0-9_-]/g, "_");
    downloadPdfDocument(html, `balance-sheet-${cleanScope}-${startDate}-to-${endDate}`);
  };

  const handleShareBalanceSheet = () => {
    const html = getBalanceSheetHtml();
    if (!html) {
      setError("Please generate the balance sheet first.");
      return;
    }
    const cleanScope = scopeLabel.replace(/[^a-zA-Z0-9_-]/g, "_");
    setShareModalDoc({
      isOpen: true,
      documentTitle: `Balance Sheet - ${scopeLabel} (${startDate} to ${endDate})`,
      documentType: "Financial Statement",
      documentHtml: html,
      fileNameBase: `balance-sheet-${cleanScope}-${startDate}-to-${endDate}`,
      ownerName: "Property Stakeholder",
      ownerEmail: "",
      defaultSubject: `Official Balance Sheet: ${scopeLabel} (${startDate} to ${endDate})`,
      defaultMessage: `Attached is the certified financial statement for ${scopeLabel} covering ${startDate} to ${endDate}.`,
    });
  };

  // Upload attachment for new transaction
  const handleUploadTxAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (txForm.attachments.length + files.length > 5) {
      alert("A maximum of 5 attachments (invoices, receipts, proofs) are permitted per transaction.");
      return;
    }

    setUploadingAttachment(true);
    const newAttachments = [...txForm.attachments];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const url = await uploadFileToBucket("finance-docs", currentCompany?.id || "general", file);
        newAttachments.push({
          id: `att-${Date.now()}-${i}`,
          name: file.name,
          url,
          type: file.type.includes("pdf") ? "pdf" : "image",
          size: file.size,
          uploadedAt: new Date().toISOString(),
          uploadedByName: currentCompanyUser?.fullName || user?.email?.split("@")[0] || "Staff",
        });
      } catch (err) {
        console.warn("Attachment upload fallback to blob url:", err);
        newAttachments.push({
          id: `att-${Date.now()}-${i}`,
          name: file.name,
          url: URL.createObjectURL(file),
          type: file.type.includes("pdf") ? "pdf" : "image",
          size: file.size,
          uploadedAt: new Date().toISOString(),
          uploadedByName: currentCompanyUser?.fullName || user?.email?.split("@")[0] || "Staff",
        });
      }
    }

    setTxForm((prev) => ({ ...prev, attachments: newAttachments }));
    setUploadingAttachment(false);
    e.target.value = "";
  };

  // Save new transaction
  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txForm.amount || Number(txForm.amount) <= 0) {
      alert("Please specify a valid transaction amount.");
      return;
    }

    setSavingTx(true);
    try {
      const actorName = currentCompanyUser?.fullName || user?.email?.split("@")[0] || "Accounts Staff";
      const actorRole = currentCompanyUser?.jobTitle || "Finance";
      const targetStaff = FINANCE_STAFF_HIERARCHY.find((s) => s.id === txForm.approvalRequestedTo);
      const isApproval = txForm.requestApproval;

      const newTx: FinanceTransaction = {
        id: `tx-${Date.now()}`,
        companyId: currentCompany?.id,
        propertyId: txForm.propertyId || undefined,
        propertyName: properties.find((p) => p.id === txForm.propertyId)?.name,
        transactionDate: txForm.transactionDate,
        type: txForm.type,
        category: txForm.category,
        amount: Number(txForm.amount),
        paymentMethod: txForm.paymentMethod,
        referenceNumber: txForm.referenceNumber || `REF-${Math.floor(100000 + Math.random() * 900000)}`,
        description: txForm.description.trim(),
        status: isApproval ? "pending_approval" : "approved",
        priority: txForm.priority,
        attachments: txForm.attachments,
        recordedByUserId: user?.id,
        recordedByName: actorName,
        recordedByRole: actorRole,
        approvalRequestedTo: isApproval ? txForm.approvalRequestedTo : undefined,
        approvalRequestedToName: isApproval ? targetStaff?.name : undefined,
        approvedByName: isApproval ? undefined : actorName,
        approvedAt: isApproval ? undefined : new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Try inserting into Supabase
      if (currentCompany?.id && isValidUuid(currentCompany.id)) {
        try {
          await supabase.from("finance_transactions").insert({
            company_id: currentCompany.id,
            property_id: txForm.propertyId || null,
            transaction_date: txForm.transactionDate,
            type: txForm.type,
            category: txForm.category,
            amount: Number(txForm.amount),
            payment_method: txForm.paymentMethod,
            reference_number: newTx.referenceNumber,
            description: txForm.description.trim(),
            status: newTx.status,
            priority: txForm.priority,
            attachments: txForm.attachments,
            recorded_by_name: actorName,
            recorded_by_role: actorRole,
            approval_requested_to: newTx.approvalRequestedTo,
            approval_requested_to_name: newTx.approvalRequestedToName,
          });
        } catch (dbErr) {
          console.warn("Database insert fallback to client state:", dbErr);
        }
      }

      setFinanceTransactions((prev) => [newTx, ...prev]);
      setRecordModalOpen(false);
      setTxForm({
        type: "expense",
        category: "Office & Administrative Supplies",
        amount: "",
        propertyId: "",
        paymentMethod: "EFT / Bank Transfer",
        referenceNumber: "",
        description: "",
        transactionDate: new Date().toISOString().slice(0, 10),
        requestApproval: false,
        approvalRequestedTo: "fin-mgr",
        priority: "normal",
        attachments: [],
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error saving transaction.");
    } finally {
      setSavingTx(false);
    }
  };
  // Retroactive upload of proof to existing transaction in voucher modal
  const handleUploadRetroProof = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selectedTxForAudit) return;
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if ((selectedTxForAudit.attachments || []).length + files.length > 5) {
      alert("A maximum of 5 attachments can be stored per transaction.");
      return;
    }

    setRetroProofUploading(true);
    const updatedAttachments = [...(selectedTxForAudit.attachments || [])];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const url = await uploadFileToBucket("finance-docs", currentCompany?.id || "general", file);
        updatedAttachments.push({
          id: `att-retro-${Date.now()}-${i}`,
          name: file.name,
          url,
          type: file.type.includes("pdf") ? "pdf" : "image",
          size: file.size,
          uploadedAt: new Date().toISOString(),
          uploadedByName: currentCompanyUser?.fullName || user?.email?.split("@")[0] || "Staff",
        });
      } catch (err) {
        updatedAttachments.push({
          id: `att-retro-${Date.now()}-${i}`,
          name: file.name,
          url: URL.createObjectURL(file),
          type: file.type.includes("pdf") ? "pdf" : "image",
          size: file.size,
          uploadedAt: new Date().toISOString(),
          uploadedByName: currentCompanyUser?.fullName || user?.email?.split("@")[0] || "Staff",
        });
      }
    }

    const updatedTx = { ...selectedTxForAudit, attachments: updatedAttachments };
    setSelectedTxForAudit(updatedTx);
    setFinanceTransactions((prev) => prev.map((t) => (t.id === updatedTx.id ? updatedTx : t)));

    // Update in database
    if (isValidUuid(updatedTx.id)) {
      try {
        await supabase.from("finance_transactions").update({ attachments: updatedAttachments }).eq("id", updatedTx.id);
      } catch {}
    }

    setRetroProofUploading(false);
    e.target.value = "";
  };

  // Authorize & Sign Procurement Request
  const handleAuthorizeProcurement = async (req: ProcurementRequest) => {
    setAuthorizingProcId(req.id);
    try {
      const actorName = currentCompanyUser?.fullName || user?.email?.split("@")[0] || "Finance Approver";
      const sigUrl = localStorage.getItem(`staff_signature_${user?.id || user?.email}`) || "";

      await approveAccountsFunding(req.id, actorName, true, `Authorized and digitally stamped by ${actorName}`);

      // Also create an approved finance transaction entry so it books directly into the daily journal!
      const winningQuote = req.quotations?.find((q) => q.isSelected) || req.quotations?.[0];
      const amount = Number(req.totalApprovedAmount || winningQuote?.amount || 0);

      const autoTx: FinanceTransaction = {
        id: `tx-proc-${Date.now()}`,
        companyId: currentCompany?.id,
        transactionDate: new Date().toISOString().slice(0, 10),
        type: "payment",
        category: "Vendor Direct Payment",
        amount,
        paymentMethod: req.paymentMethod === "bank_deposit" ? "EFT / Bank Transfer" : req.paymentMethod === "cash" ? "Cash" : "Online Payment",
        referenceNumber: `PO-${req.id.toUpperCase()}`,
        description: `Authorized procurement disbursement for ${req.itemName} (${winningQuote?.supplierName || "Direct Supplier"}).`,
        status: "approved",
        priority: mapUrgencyToPriority(req.urgency),
        attachments: winningQuote?.fileUrl
          ? [
              {
                id: `att-quote-${Date.now()}`,
                name: `${winningQuote.supplierName}_Quote.pdf`,
                url: winningQuote.fileUrl,
                type: winningQuote.fileType || "pdf",
                uploadedAt: new Date().toISOString(),
                uploadedByName: req.requestedByName,
              },
            ]
          : [],
        recordedByName: req.requestedByName,
        recordedByRole: req.requestingDepartment,
        approvedByName: actorName,
        approvedAt: new Date().toISOString(),
        signatureUrl: sigUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setFinanceTransactions((prev) => [autoTx, ...prev]);

      // Refresh procurement requests
      const refreshed = await fetchProcurementRequests(currentCompany?.id || undefined);
      setProcurementRequests(refreshed);
      if (selectedProcurementForTimeline?.id === req.id) {
        setSelectedProcurementForTimeline(refreshed.find((r) => r.id === req.id) || null);
      }
      alert(`Procurement request #${req.id} successfully authorized & signed for payment disbursement!`);
    } catch (err) {
      alert("Failed to authorize payment request.");
    } finally {
      setAuthorizingProcId(null);
    }
  };

  // Reassign Procurement Request to Finance Colleague
  const handleExecuteReassign = async () => {
    if (!reassignModalReq) return;
    try {
      const targetStaff = FINANCE_STAFF_HIERARCHY.find((s) => s.id === reassignTargetStaffId);
      const actorName = currentCompanyUser?.fullName || user?.email?.split("@")[0] || "Finance";

      await advancePipelineStage(
        reassignModalReq.id,
        "fund_request_to_accounts",
        actorName,
        `Reassigned to ${targetStaff?.name} (${targetStaff?.role}). ${reassignNotes ? `Note: ${reassignNotes}` : ""}`
      );

      const refreshed = await fetchProcurementRequests(currentCompany?.id || undefined);
      setProcurementRequests(refreshed);
      setReassignModalReq(null);
      setReassignNotes("");
      alert(`Request reassigned to ${targetStaff?.name}!`);
    } catch (err) {
      alert("Error reassigning request.");
    }
  };

  // Approve a pending manual transaction
  const handleApproveTransaction = async (txId: string) => {
    const actorName = currentCompanyUser?.fullName || user?.email?.split("@")[0] || "Finance Approver";
    const sigUrl = localStorage.getItem(`staff_signature_${user?.id || user?.email}`) || "";

    setFinanceTransactions((prev) =>
      prev.map((tx) =>
        tx.id === txId
          ? {
              ...tx,
              status: "approved",
              approvedByName: actorName,
              approvedAt: new Date().toISOString(),
              signatureUrl: sigUrl,
            }
          : tx
      )
    );

    if (isValidUuid(txId)) {
      try {
        await supabase
          .from("finance_transactions")
          .update({
            status: "approved",
            approved_by_name: actorName,
            approved_at: new Date().toISOString(),
            signature_url: sigUrl,
          })
          .eq("id", txId);
      } catch {}
    }
  };

  // Reject a pending manual transaction
  const handleRejectTransaction = async (txId: string) => {
    const reason = prompt("Enter reason for rejection / return:");
    if (reason === null) return;

    setFinanceTransactions((prev) =>
      prev.map((tx) =>
        tx.id === txId
          ? {
              ...tx,
              status: "rejected",
              rejectionReason: reason || "Returned by accounts",
            }
          : tx
      )
    );

    if (isValidUuid(txId)) {
      try {
        await supabase
          .from("finance_transactions")
          .update({ status: "rejected", rejection_reason: reason })
          .eq("id", txId);
      } catch {}
    }
  };

  // Filtered Journal Transactions
  const filteredJournalTransactions = useMemo(() => {
    return financeTransactions.filter((tx) => {
      const q = txSearch.toLowerCase();
      const matchesSearch =
        !q ||
        tx.description.toLowerCase().includes(q) ||
        tx.category.toLowerCase().includes(q) ||
        tx.referenceNumber.toLowerCase().includes(q) ||
        tx.recordedByName.toLowerCase().includes(q);

      const matchesType = txTypeFilter === "all" || tx.type === txTypeFilter;
      const matchesStatus = txStatusFilter === "all" || tx.status === txStatusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [financeTransactions, txSearch, txTypeFilter, txStatusFilter]);

  // KPI calculations for Today's operations
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayInflow = financeTransactions
    .filter((t) => t.transactionDate === todayStr && t.status === "approved" && t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);

  const todayOutflow = financeTransactions
    .filter((t) => t.transactionDate === todayStr && t.status === "approved" && (t.type === "expense" || t.type === "payment"))
    .reduce((sum, t) => sum + t.amount, 0);

  const pendingApprovalsCount =
    financeTransactions.filter((t) => t.status === "pending_approval").length +
    procurementRequests.filter((r) => r.pipelineStage === "fund_request_to_accounts").length;

  // Pending Matters Combined Queue
  const pendingAccountingMatters = useMemo(() => {
    const items: Array<{
      id: string;
      source: "manual_tx" | "procurement";
      title: string;
      subtitle: string;
      amount: number;
      date: string;
      priority: "critical" | "urgent" | "normal" | "low";
      recordedByName: string;
      assignedTo: string;
      attachmentsCount: number;
      raw: any;
    }> = [];

    // 1. Manual pending transactions
    financeTransactions
      .filter((t) => t.status === "pending_approval")
      .forEach((t) => {
        items.push({
          id: t.id,
          source: "manual_tx",
          title: `${t.category} — ${t.referenceNumber}`,
          subtitle: t.description,
          amount: t.amount,
          date: t.transactionDate,
          priority: t.priority,
          recordedByName: t.recordedByName,
          assignedTo: t.approvalRequestedToName || "Finance Manager",
          attachmentsCount: t.attachments.length,
          raw: t,
        });
      });

    // 2. Procurement payment requests
    procurementRequests
      .filter((r) => r.pipelineStage === "fund_request_to_accounts")
      .forEach((r) => {
        const winningQuote = r.quotations?.find((q) => q.isSelected) || r.quotations?.[0];
        const amount = Number(r.totalApprovedAmount || winningQuote?.amount || 0);
        items.push({
          id: r.id,
          source: "procurement",
          title: `Procurement Payment: ${r.itemName}`,
          subtitle: `Supplier: ${winningQuote?.supplierName || "Direct"} • Dept: ${r.requestingDepartment}`,
          amount,
          date: r.stageEnteredAt ? r.stageEnteredAt.slice(0, 10) : r.createdAt.slice(0, 10),
          priority: mapUrgencyToPriority(r.urgency),
          recordedByName: r.requestedByName,
          assignedTo: "Accounts & Finance",
          attachmentsCount: (r.quotations || []).length,
          raw: r,
        });
      });

    // Sorting
    return items.sort((a, b) => {
      if (pendingSortBy === "priority") {
        const weight = { critical: 4, urgent: 3, normal: 2, low: 1 };
        return weight[b.priority] - weight[a.priority];
      }
      if (pendingSortBy === "date_asc") {
        return a.date.localeCompare(b.date);
      }
      return b.date.localeCompare(a.date);
    });
  }, [financeTransactions, procurementRequests, pendingSortBy]);

  return (
    <ModulePage
      title="Finance &amp; Accounts"
      description="Record daily financial operations, manage invoices &amp; proofs, approve procurement disbursements, and generate certified balance sheets."
    >
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-surface-elevated/70 rounded-2xl border border-border-color/60 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("journal")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === "journal"
                ? "bg-surface text-blue-600 shadow-xs border border-border-color"
                : "text-muted hover:text-foreground"
            }`}
          >
            <Activity size={14} />
            <span>Daily Journal &amp; Transactions</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab("balance_sheet");
              if (!summary) void generateBalanceSheet();
            }}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
              activeTab === "balance_sheet"
                ? "bg-surface text-blue-600 shadow-xs border border-border-color"
                : "text-muted hover:text-foreground"
            }`}
          >
            <FileSpreadsheet size={14} />
            <span>Daily Balance Sheet &amp; Statements</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("procurement")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap relative ${
              activeTab === "procurement"
                ? "bg-surface text-blue-600 shadow-xs border border-border-color"
                : "text-muted hover:text-foreground"
            }`}
          >
            <ShieldCheck size={14} />
            <span>Procurement Payment Requests</span>
            {procurementRequests.filter((r) => r.pipelineStage === "fund_request_to_accounts").length > 0 && (
              <span className="h-5 px-1.5 rounded-full bg-amber-500 text-white text-[10px] font-black flex items-center justify-center">
                {procurementRequests.filter((r) => r.pipelineStage === "fund_request_to_accounts").length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("pending")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap relative ${
              activeTab === "pending"
                ? "bg-surface text-blue-600 shadow-xs border border-border-color"
                : "text-muted hover:text-foreground"
            }`}
          >
            <Clock size={14} />
            <span>Pending Matters</span>
            {pendingApprovalsCount > 0 && (
              <span className="h-5 px-1.5 rounded-full bg-red-600 text-white text-[10px] font-black flex items-center justify-center animate-pulse">
                {pendingApprovalsCount}
              </span>
            )}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab("balance_sheet");
              void generateBalanceSheet();
            }}
            className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface-elevated hover:bg-surface px-3.5 py-2 text-xs font-bold text-foreground transition shadow-xs"
          >
            <FileText size={14} className="text-blue-500" />
            <span>Generate Statement &amp; Report</span>
          </button>

          <button
            type="button"
            onClick={() => setRecordModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-bold text-white transition shadow-sm"
          >
            <Plus size={15} />
            <span>Record Transaction</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: DAILY JOURNAL & OPERATIONS TRANSACTIONS                           */}
      {/* ========================================================================= */}
      {activeTab === "journal" && (
        <div className="space-y-6">
          {/* Daily Operations KPI Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Today's Inflow (Revenue)</p>
                <p className="text-xl font-black text-emerald-600 mt-1">+{formatCurrency(todayInflow)}</p>
                <span className="text-[10px] text-muted">Rent &amp; operating receipts</span>
              </div>
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <ArrowDownRight size={22} />
              </div>
            </div>

            <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Today's Outflow (Expenses)</p>
                <p className="text-xl font-black text-red-600 mt-1">-{formatCurrency(todayOutflow)}</p>
                <span className="text-[10px] text-muted">Disbursements &amp; utilities</span>
              </div>
              <div className="h-10 w-10 rounded-xl bg-red-500/10 text-red-600 flex items-center justify-center">
                <ArrowUpRight size={22} />
              </div>
            </div>

            <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Today's Net Cashflow</p>
                <p className={`text-xl font-black mt-1 ${todayInflow - todayOutflow >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {todayInflow - todayOutflow >= 0 ? "+" : ""}{formatCurrency(todayInflow - todayOutflow)}
                </p>
                <span className="text-[10px] text-muted">Operating balance today</span>
              </div>
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <DollarSign size={20} />
              </div>
            </div>

            <div
              onClick={() => setActiveTab("pending")}
              className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs flex items-center justify-between cursor-pointer hover:border-amber-500/50 transition"
            >
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Pending Approvals</p>
                <p className="text-xl font-black text-amber-500 mt-1">{pendingApprovalsCount}</p>
                <span className="text-[10px] text-blue-600 font-medium">Click to review queue &rarr;</span>
              </div>
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Clock size={20} />
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[220px]">
                <Search size={14} className="absolute left-3 top-2.5 text-muted" />
                <input
                  type="text"
                  placeholder="Search transactions by reference, description, category, staff..."
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated pl-9 pr-3 py-2 text-xs text-foreground outline-none focus:border-blue-600"
                />
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={txTypeFilter}
                  onChange={(e) => setTxTypeFilter(e.target.value)}
                  className="rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs text-foreground outline-none focus:border-blue-600"
                >
                  <option value="all">All Types</option>
                  <option value="expense">Expenses</option>
                  <option value="income">Income</option>
                  <option value="payment">Direct Payments</option>
                  <option value="transfer">Transfers</option>
                </select>

                <select
                  value={txStatusFilter}
                  onChange={(e) => setTxStatusFilter(e.target.value)}
                  className="rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs text-foreground outline-none focus:border-blue-600"
                >
                  <option value="all">All Statuses</option>
                  <option value="approved">Approved</option>
                  <option value="pending_approval">Pending Approval</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
            </div>

            {/* Daily Journal Table */}
            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-border-color text-muted font-bold">
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3">Category</th>
                    <th className="py-2.5 px-3">Description &amp; Summary</th>
                    <th className="py-2.5 px-3">Reference / Proof</th>
                    <th className="py-2.5 px-3">Recorded By</th>
                    <th className="py-2.5 px-3 text-right">Amount</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color/60">
                  {filteredJournalTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-muted">
                        <FileText size={32} className="mx-auto mb-2 opacity-30" />
                        No transactions found matching your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredJournalTransactions.map((tx) => {
                      const isIncome = tx.type === "income";
                      const isPending = tx.status === "pending_approval";
                      const isRejected = tx.status === "rejected";

                      return (
                        <tr
                          key={tx.id}
                          onClick={() => setSelectedTxForAudit(tx)}
                          className="hover:bg-surface-elevated/70 cursor-pointer transition group"
                          title="Click to view full voucher, proof attachments & audit trail"
                        >
                          <td className="py-3 px-3 font-medium text-foreground whitespace-nowrap">{tx.transactionDate}</td>
                          <td className="py-3 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold uppercase text-[10px] ${
                                isIncome
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : tx.type === "payment"
                                  ? "bg-blue-500/10 text-blue-600"
                                  : tx.type === "transfer"
                                  ? "bg-purple-500/10 text-purple-600"
                                  : "bg-red-500/10 text-red-600"
                              }`}
                            >
                              {tx.type}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-semibold text-foreground whitespace-nowrap">{tx.category}</td>
                          <td className="py-3 px-3 max-w-xs truncate text-muted group-hover:text-foreground transition">
                            {tx.description}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[11px] text-muted">{tx.referenceNumber || "-"}</span>
                              {tx.attachments.length > 0 && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 font-bold text-[10px]">
                                  <Paperclip size={10} /> {tx.attachments.length}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-muted whitespace-nowrap">
                            {tx.recordedByName}
                            {tx.approvedByName && (
                              <span className="block text-[10px] text-emerald-600 font-medium">
                                Appr: {tx.approvedByName}
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-black whitespace-nowrap">
                            <span className={isIncome ? "text-emerald-600" : "text-red-600"}>
                              {isIncome ? "+" : "-"}{formatCurrency(tx.amount)}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center whitespace-nowrap">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isPending
                                  ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                                  : isRejected
                                  ? "bg-red-500/10 text-red-600 border border-red-500/20"
                                  : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                              }`}
                            >
                              {isPending ? "Pending Approval" : isRejected ? "Rejected" : "Approved"}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DAILY BALANCE SHEET & STATEMENTS (QUICKBOOKS STYLE)                */}
      {/* ========================================================================= */}
      {activeTab === "balance_sheet" && (
        <div className="space-y-6">
          <section className="space-y-4 rounded-2xl border border-border-color bg-surface p-5 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-color/60 pb-4">
              <div>
                <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                  <FileSpreadsheet size={18} className="text-blue-600" />
                  <span>Certified Balance Sheet &amp; Financial Statement Generator</span>
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Generate official daily or multi-period balance sheets. Click any transaction in the statement to inspect audit details and vouchers.
                </p>
              </div>

              {/* Quick Daily Mode Toggles */}
              <div className="flex items-center gap-1.5 self-start sm:self-auto bg-surface-elevated/70 p-1 rounded-xl border border-border-color/60">
                <button
                  type="button"
                  onClick={() => applyDailyPreset(0)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    dailyMode && startDate === toIsoDate(new Date())
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-muted hover:text-foreground"
                  }`}
                >
                  Today's Balance Sheet
                </button>
                <button
                  type="button"
                  onClick={() => applyDailyPreset(-1)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-muted hover:text-foreground transition"
                >
                  Yesterday
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4 text-xs">
              <div>
                <label className="mb-1 block font-medium text-muted">Scope of Statement</label>
                <select
                  value={scope}
                  onChange={(e) => setScope(e.target.value as ScopeMode)}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground font-medium outline-none focus:border-blue-600"
                >
                  <option value="system">Portfolio-Wide (All Company Properties)</option>
                  <option value="property">Specific Single Property</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium text-muted">Selected Property</label>
                <select
                  value={propertyId}
                  onChange={(e) => setPropertyId(e.target.value)}
                  disabled={scope !== "property"}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground font-medium outline-none focus:border-blue-600 disabled:opacity-50"
                >
                  <option value="">Select property...</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium text-muted">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => { setStartDate(e.target.value); setDailyMode(false); }}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground font-medium outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-muted">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => { setEndDate(e.target.value); setDailyMode(false); }}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground font-medium outline-none focus:border-blue-600"
                />
              </div>
            </div>

            {/* Presets */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {(Object.keys(presetLabels) as TimePreset[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyPreset(key)}
                  className={`rounded-lg border px-3 py-1 text-xs font-semibold transition ${
                    preset === key && !dailyMode
                      ? "bg-blue-600 border-blue-600 text-white"
                      : "border-border-color bg-surface-elevated text-muted hover:text-foreground"
                  }`}
                >
                  {presetLabels[key]}
                </button>
              ))}
            </div>

            {/* Display Options */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 text-xs pt-2 border-t border-border-color/60">
              <div>
                <label className="mb-1 block font-medium text-muted">Presentation</label>
                <select
                  value={presentation}
                  onChange={(e) => setPresentation(e.target.value as PresentationMode)}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-1.5 text-foreground"
                >
                  <option value="expanded">Expanded (Detailed Transactions)</option>
                  <option value="summary">Summary Only</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium text-muted">Include Digital Signature</label>
                <select
                  value={showSignature ? "yes" : "no"}
                  onChange={(e) => setShowSignature(e.target.value === "yes")}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-1.5 text-foreground"
                >
                  <option value="yes">Yes (Stamped Signature)</option>
                  <option value="no">No</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium text-muted">Show Admin Name</label>
                <select
                  value={showAdminName ? "yes" : "no"}
                  onChange={(e) => setShowAdminName(e.target.value === "yes")}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-1.5 text-foreground"
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium text-muted">Show Executor Column</label>
                <select
                  value={showExecutor ? "yes" : "no"}
                  onChange={(e) => setShowExecutor(e.target.value === "yes")}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-1.5 text-foreground"
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => void generateBalanceSheet()}
                className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition flex items-center gap-1.5"
              >
                <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
                <span>Recalculate Statement</span>
              </button>
              <button
                type="button"
                onClick={() => openPdfWindow(false)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border-color bg-surface-elevated px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface transition"
              >
                <Eye size={13} />
                <span>View Official PDF</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadBalanceSheetPdf}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border-color bg-surface-elevated px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface transition"
              >
                <Download size={13} />
                <span>Download PDF</span>
              </button>
              <button
                type="button"
                onClick={handleShareBalanceSheet}
                className="inline-flex items-center gap-1.5 rounded-xl bg-foreground px-4 py-2 text-xs font-bold text-surface hover:opacity-90 transition shadow-xs"
              >
                <Mail size={13} />
                <span>Email / Share Statement</span>
              </button>
            </div>
          </section>

          {loading && <LoadingState label="Computing financial ledgers & balance sheet..." />}
          {!loading && error && <ErrorState message={error} onRetry={() => void generateBalanceSheet()} />}

          {!loading && !error && summary && (
            <section className="space-y-4 rounded-2xl border border-border-color bg-surface p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border-color/60 pb-3">
                <h3 className="text-base font-black text-foreground">
                  Statement Summary — {scopeLabel}
                </h3>
                <span className="text-xs text-muted font-medium">
                  Period: {startDate} to {endDate}
                </span>
              </div>

              {/* QuickBooks Style Summary Cards */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <article className="rounded-xl border border-border-color bg-surface-elevated/70 p-3.5">
                  <p className="text-[11px] font-bold text-muted uppercase">Gross Revenue / Rent</p>
                  <p className="text-xl font-black text-emerald-600 mt-0.5">{formatCurrency(summary.rentCollected)}</p>
                  <span className="text-[10px] text-muted">Total recognized income</span>
                </article>

                <article className="rounded-xl border border-border-color bg-surface-elevated/70 p-3.5">
                  <p className="text-[11px] font-bold text-muted uppercase">Total Operating Expenses</p>
                  <p className="text-xl font-black text-red-600 mt-0.5">{formatCurrency(summary.totalExpenses)}</p>
                  <span className="text-[10px] text-muted">Maintenance, bills &amp; renovations</span>
                </article>

                <article className="rounded-xl border border-border-color bg-surface-elevated/70 p-3.5">
                  <p className="text-[11px] font-bold text-muted uppercase">Tax Provision</p>
                  <p className="text-xl font-black text-amber-600 mt-0.5">{formatCurrency(summary.tax)}</p>
                  <span className="text-[10px] text-muted">Estimated standard tax</span>
                </article>

                <article className="rounded-xl border border-border-color bg-surface-elevated/70 p-3.5">
                  <p className="text-[11px] font-bold text-muted uppercase">Net Operating Income</p>
                  <p className={`text-xl font-black mt-0.5 ${summary.netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    {formatCurrency(summary.netProfit)}
                  </p>
                  <span className="text-[10px] text-muted">Net profit after tax provision</span>
                </article>
              </div>

              {/* Interactive Clickable Transaction Ledger */}
              {presentation === "expanded" && (
                <div className="space-y-2 pt-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <span>Detailed Transaction Items ({transactionRows.length})</span>
                      <span className="text-[11px] font-normal text-muted">(Click any transaction row to inspect voucher &amp; proofs)</span>
                    </p>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-border-color">
                    <table className="min-w-full text-xs text-left">
                      <thead>
                        <tr className="border-b border-border-color bg-surface-elevated/50 text-muted font-bold">
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Entry Type</th>
                          <th className="py-2.5 px-3">Category</th>
                          <th className="py-2.5 px-3">Concise Summary &amp; Details</th>
                          {showExecutor && <th className="py-2.5 px-3">Executed By</th>}
                          <th className="py-2.5 px-3 text-right">Amount</th>
                          <th className="py-2.5 px-3 text-right">Net Effect</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-color/60">
                        {transactionRows.map((row, idx) => {
                          const isIncome = row.entryType === "income";

                          // Match with finance transaction if available
                          const matchedTx = financeTransactions.find(
                            (f) => f.transactionDate === row.date && f.category === row.category
                          );

                          return (
                            <tr
                              key={`${row.date}-${row.category}-${idx}`}
                              onClick={() => {
                                if (matchedTx) {
                                  setSelectedTxForAudit(matchedTx);
                                } else {
                                  // Fallback ad-hoc transaction representation for rent/maintenance
                                  setSelectedTxForAudit({
                                    id: `tx-rep-${idx}`,
                                    transactionDate: row.date,
                                    type: row.entryType === "income" ? "income" : "expense",
                                    category: row.category,
                                    amount: row.amount,
                                    paymentMethod: "EFT / Bank Transfer",
                                    referenceNumber: `LEDGER-${row.date.replace(/-/g, "")}-${idx}`,
                                    description: row.details,
                                    status: "approved",
                                    priority: "normal",
                                    attachments: [],
                                    recordedByName: row.executor || "System Accountant",
                                    recordedByRole: "Finance Operations",
                                    approvedByName: adminInfo?.fullName || "Audit Verified",
                                    createdAt: row.date,
                                    updatedAt: row.date,
                                  });
                                }
                              }}
                              className="hover:bg-surface-elevated/80 cursor-pointer transition group"
                              title="Click to view voucher, approval timeline & attach proof"
                            >
                              <td className="py-3 px-3 font-medium text-foreground whitespace-nowrap">{row.date}</td>
                              <td className="py-3 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded-md font-bold uppercase text-[10px] ${
                                    isIncome ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"
                                  }`}
                                >
                                  {row.entryType}
                                </span>
                              </td>
                              <td className="py-3 px-3 font-semibold text-foreground whitespace-nowrap">{row.category}</td>
                              <td className="py-3 px-3 text-muted group-hover:text-foreground transition max-w-sm truncate">
                                {row.details}
                              </td>
                              {showExecutor && (
                                <td className="py-3 px-3 text-muted whitespace-nowrap">{row.executor || "-"}</td>
                              )}
                              <td className="py-3 px-3 text-right font-black whitespace-nowrap">
                                <span className={isIncome ? "text-emerald-600" : "text-red-600"}>
                                  {formatCurrency(row.amount)}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-right font-black whitespace-nowrap">
                                <span className={row.net >= 0 ? "text-emerald-600" : "text-red-600"}>
                                  {formatCurrency(row.net)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PROCUREMENT PAYMENT REQUESTS & AUTHORIZATIONS                     */}
      {/* ========================================================================= */}
      {activeTab === "procurement" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-color pb-4">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Shield size={18} className="text-blue-600" />
                <span>Procurement Payment Requests Pipeline</span>
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Official fund requests from departments awaiting financial authorization, accounts signature, and supplier disbursement.
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setProcurementFilter("all")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  procurementFilter === "all" ? "bg-blue-600 text-white" : "border border-border-color text-muted hover:text-foreground"
                }`}
              >
                All Funding Requests ({procurementRequests.filter((r) => r.pipelineStage === "fund_request_to_accounts").length})
              </button>
              <button
                type="button"
                onClick={() => setProcurementFilter("my_sig")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  procurementFilter === "my_sig" ? "bg-blue-600 text-white" : "border border-border-color text-muted hover:text-foreground"
                }`}
              >
                ✍️ Requires Your Signature
              </button>
            </div>
          </div>

          {/* Procurement Funding Cards Grid */}
          <div className="grid grid-cols-1 gap-4">
            {procurementRequests
              .filter((r) => {
                if (procurementFilter === "my_sig") {
                  return r.pipelineStage === "fund_request_to_accounts";
                }
                return r.pipelineStage === "fund_request_to_accounts" || r.pipelineStage === "payment_approved";
              })
              .map((req) => {
                const winningQuote = req.quotations?.find((q) => q.isSelected) || req.quotations?.[0];
                const amount = Number(req.totalApprovedAmount || winningQuote?.amount || 0);
                const isAuthorized = req.pipelineStage === "payment_approved";
                const isAuthorizing = authorizingProcId === req.id;

                return (
                  <div
                    key={req.id}
                    className={`rounded-2xl border bg-surface p-5 shadow-xs transition hover:shadow-md space-y-4 ${
                      isAuthorized ? "border-emerald-500/30" : "border-border-color ring-1 ring-amber-500/20"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-black text-xs text-blue-600 uppercase">
                            #{req.id}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                              req.urgency === "critical"
                                ? "bg-red-500 text-white animate-pulse"
                                : req.urgency === "high"
                                ? "bg-amber-500 text-white"
                                : "bg-blue-500/10 text-blue-600"
                            }`}
                          >
                            {req.urgency === "critical" ? "⚡ Critical Priority" : `${req.urgency} Urgency`}
                          </span>
                          <span className="px-2 py-0.5 rounded-md bg-surface-elevated text-muted font-bold text-[10px] uppercase">
                            Dept: {req.requestingDepartment}
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-foreground">{req.itemName}</h3>
                        <p className="text-xs text-muted max-w-2xl leading-relaxed">
                          {req.justification || req.itemSpecifications}
                        </p>
                      </div>

                      <div className="text-left sm:text-right shrink-0">
                        <p className="text-[10px] uppercase tracking-wider text-muted font-bold">Disbursement Amount</p>
                        <p className="text-xl font-black text-foreground mt-0.5">
                          {formatCurrency(amount)}
                        </p>
                        <span className="text-xs font-semibold text-emerald-600">
                          Method: {req.paymentMethod === "bank_deposit" ? "Bank Deposit / EFT" : req.paymentMethod || "Direct"}
                        </span>
                      </div>
                    </div>

                    {/* Supplier & Banking Summary */}
                    {winningQuote && (
                      <div className="rounded-xl bg-surface-elevated/70 p-3 text-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <p className="text-[10px] text-muted font-bold uppercase">Vendor / Supplier</p>
                          <p className="font-bold text-foreground mt-0.5">{winningQuote.supplierName}</p>
                          <p className="text-[11px] text-muted">{winningQuote.supplierContact || "Contact on file"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted font-bold uppercase">Payment Requisitioner</p>
                          <p className="font-bold text-foreground mt-0.5">{req.requestedByName}</p>
                          <p className="text-[11px] text-muted">Submitted: {new Date(req.createdAt).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-muted font-bold uppercase">Current Signature Status</p>
                          <div className="mt-0.5">
                            {isAuthorized ? (
                              <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-xs">
                                <CheckCircle size={13} /> Stamped &amp; Authorized
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-600 font-bold text-xs">
                                <Clock size={13} /> Requires Accounts Signature
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-border-color/60 text-xs">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedProcurementForTimeline(req)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-border-color bg-surface-elevated px-3 py-1.5 font-semibold text-foreground hover:bg-surface transition"
                        >
                          <Clock size={13} className="text-blue-500" />
                          <span>View Lifecycle Timeline &amp; Stages</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setReassignModalReq(req);
                            setReassignTargetStaffId("fin-mgr");
                            setReassignNotes("");
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-border-color bg-surface-elevated px-3 py-1.5 font-semibold text-foreground hover:bg-surface transition"
                        >
                          <UserCheck size={13} className="text-indigo-500" />
                          <span>Push / Reassign to Colleague</span>
                        </button>
                      </div>

                      <div>
                        {!isAuthorized ? (
                          <button
                            type="button"
                            onClick={() => handleAuthorizeProcurement(req)}
                            disabled={isAuthorizing}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 font-bold text-white shadow-sm transition disabled:opacity-50"
                          >
                            {isAuthorizing ? <Loader2 size={14} className="animate-spin" /> : <FileSignature size={14} />}
                            <span>Authorize &amp; Stamp Signature</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-500/10 px-3 py-1.5 rounded-xl">
                            <CheckCircle size={14} /> Ready for Purchasing
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

            {procurementRequests.filter((r) => r.pipelineStage === "fund_request_to_accounts").length === 0 && (
              <div className="text-center py-16 text-muted bg-surface rounded-2xl border border-dashed border-border-color">
                <CheckCircle size={36} className="mx-auto mb-2 text-emerald-500 opacity-60" />
                <p className="text-sm font-semibold text-foreground">No pending procurement payment requests</p>
                <p className="text-xs text-muted mt-1">
                  All procurement requisitions are currently funded or awaiting department reviews.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PENDING ACCOUNTING MATTERS                                         */}
      {/* ========================================================================= */}
      {activeTab === "pending" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-color pb-4">
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <Clock size={18} className="text-amber-500" />
                <span>Centralized Pending Accounting Matters ({pendingAccountingMatters.length})</span>
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Critical SLA approvals, manual expense authorizations, and procurement funding requests requiring immediate action.
              </p>
            </div>

            {/* Sorting Controls */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted font-medium">Sort by:</span>
              <select
                value={pendingSortBy}
                onChange={(e) => setPendingSortBy(e.target.value as any)}
                className="rounded-xl border border-border-color bg-surface-elevated px-3 py-1.5 text-foreground font-semibold outline-none focus:border-blue-600"
              >
                <option value="priority">Priority (Critical ⚡ First)</option>
                <option value="date_asc">Date (Oldest First / SLA)</option>
                <option value="date_desc">Date (Newest First)</option>
              </select>
            </div>
          </div>

          {/* Pending Matters Queue List */}
          <div className="space-y-3">
            {pendingAccountingMatters.length === 0 ? (
              <div className="text-center py-16 text-muted bg-surface rounded-2xl border border-dashed border-border-color">
                <CheckCircle size={40} className="mx-auto mb-2 text-emerald-500 opacity-50" />
                <p className="text-sm font-bold text-foreground">All accounting matters are up to date</p>
                <p className="text-xs text-muted mt-1">Zero pending payment approvals or fund requisitions in the queue.</p>
              </div>
            ) : (
              pendingAccountingMatters.map((item) => (
                <div
                  key={`${item.source}-${item.id}`}
                  className="rounded-2xl border border-border-color bg-surface p-4 shadow-xs hover:border-amber-500/40 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                          item.priority === "critical"
                            ? "bg-red-600 text-white animate-pulse"
                            : item.priority === "urgent"
                            ? "bg-amber-500 text-white"
                            : "bg-blue-500/10 text-blue-600"
                        }`}
                      >
                        {item.priority === "critical" ? "⚡ Critical Priority" : `${item.priority} Priority`}
                      </span>
                      <span className="text-[11px] font-bold text-muted">
                        Date: {item.date}
                      </span>
                      <span className="text-[11px] font-medium text-muted">
                        Recorded by: {item.recordedByName}
                      </span>
                      {item.attachmentsCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 bg-blue-500/10 px-1.5 py-0.5 rounded">
                          <Paperclip size={10} /> {item.attachmentsCount} Proof(s)
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-bold text-foreground">{item.title}</h4>
                    <p className="text-xs text-muted max-w-xl line-clamp-1">{item.subtitle}</p>
                  </div>

                  <div className="flex items-center gap-4 self-end sm:self-center">
                    <div className="text-right">
                      <span className="text-base font-black text-foreground block">
                        {formatCurrency(item.amount)}
                      </span>
                      <span className="text-[10px] font-bold text-amber-600">
                        Assigned: {item.assignedTo}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {item.source === "manual_tx" ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleApproveTransaction(item.id)}
                            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition"
                          >
                            Approve &amp; Sign
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectTransaction(item.id)}
                            className="rounded-xl border border-red-200 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 px-3 py-1.5 text-xs font-bold transition"
                          >
                            Reject
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAuthorizeProcurement(item.raw)}
                          className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white shadow-xs transition"
                        >
                          Authorize &amp; Sign
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: RECORD NEW TRANSACTION (WITH MULTI-ATTACHMENTS & APPROVAL)      */}
      {/* ========================================================================= */}
      <Modal open={recordModalOpen} onClose={() => setRecordModalOpen(false)} title="Record Daily Operation / Transaction">
        <form onSubmit={handleSaveTransaction} className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-medium text-foreground">Transaction Type *</label>
              <select
                value={txForm.type}
                onChange={(e) => setTxForm({ ...txForm, type: e.target.value as any })}
                className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground font-semibold outline-none focus:border-blue-600"
              >
                <option value="expense">Expense (Outflow)</option>
                <option value="income">Income (Inflow / Receipt)</option>
                <option value="payment">Direct Vendor Payment</option>
                <option value="transfer">Account Transfer</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block font-medium text-foreground">Category *</label>
              <select
                value={txForm.category}
                onChange={(e) => setTxForm({ ...txForm, category: e.target.value })}
                className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground font-semibold outline-none focus:border-blue-600"
              >
                {TRANSACTION_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block font-medium text-foreground">Amount (NAD) *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                placeholder="e.g. 2500"
                value={txForm.amount}
                onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
                className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground font-bold outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="mb-1 block font-medium text-foreground">Transaction Date *</label>
              <input
                type="date"
                required
                value={txForm.transactionDate}
                onChange={(e) => setTxForm({ ...txForm, transactionDate: e.target.value })}
                className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground font-semibold outline-none focus:border-blue-600"
              />
            </div>

            <div>
              <label className="mb-1 block font-medium text-foreground">Payment Method</label>
              <select
                value={txForm.paymentMethod}
                onChange={(e) => setTxForm({ ...txForm, paymentMethod: e.target.value })}
                className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground font-semibold outline-none focus:border-blue-600"
              >
                <option value="EFT / Bank Transfer">EFT / Bank Transfer</option>
                <option value="Cash / Petty Cash">Cash / Petty Cash</option>
                <option value="Credit / Debit Card">Credit / Debit Card</option>
                <option value="Cheque">Cheque</option>
                <option value="Mobile Money / SpeedPay">Mobile Money / SpeedPay</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-medium text-foreground">Property / Scope</label>
              <select
                value={txForm.propertyId}
                onChange={(e) => setTxForm({ ...txForm, propertyId: e.target.value })}
                className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground font-semibold outline-none focus:border-blue-600"
              >
                <option value="">General Company Portfolio (Headquarters)</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block font-medium text-foreground">Invoice / Reference No.</label>
              <input
                type="text"
                placeholder="e.g. INV-9041 or CHQ-4412"
                value={txForm.referenceNumber}
                onChange={(e) => setTxForm({ ...txForm, referenceNumber: e.target.value })}
                className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground font-mono outline-none focus:border-blue-600"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-medium text-foreground">Description &amp; Purpose *</label>
            <textarea
              rows={2}
              required
              placeholder="Explain the commercial rationale or vendor services provided..."
              value={txForm.description}
              onChange={(e) => setTxForm({ ...txForm, description: e.target.value })}
              className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600 resize-none"
            />
          </div>

          {/* Payment Approval Request Section */}
          <div className="rounded-xl border border-border-color/80 bg-surface-elevated/50 p-3.5 space-y-3">
            <label className="flex items-center gap-2 font-bold text-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={txForm.requestApproval}
                onChange={(e) => setTxForm({ ...txForm, requestApproval: e.target.checked })}
                className="rounded border-border-color h-4 w-4 text-blue-600"
              />
              <span>Request Payment Approval from Accounts / Finance Department</span>
            </label>

            {txForm.requestApproval && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border-color/60">
                <div>
                  <label className="mb-1 block font-medium text-muted">Assign Approver (By Hierarchy &amp; Role) *</label>
                  <select
                    value={txForm.approvalRequestedTo}
                    onChange={(e) => setTxForm({ ...txForm, approvalRequestedTo: e.target.value })}
                    className="w-full rounded-xl border border-border-color bg-surface px-3 py-2 text-foreground font-bold outline-none focus:border-blue-600"
                  >
                    {FINANCE_STAFF_HIERARCHY.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.role} — {staff.name} ({staff.level})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-medium text-muted">Priority Level</label>
                  <select
                    value={txForm.priority}
                    onChange={(e) => setTxForm({ ...txForm, priority: e.target.value as any })}
                    className="w-full rounded-xl border border-border-color bg-surface px-3 py-2 text-foreground font-bold outline-none focus:border-blue-600"
                  >
                    <option value="normal">Normal Priority</option>
                    <option value="urgent">Urgent Priority</option>
                    <option value="critical">⚡ Critical (Immediate SLA)</option>
                    <option value="low">Low Priority</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Attachment Upload (Up to 5) */}
          <div className="space-y-2 pt-1 border-t border-border-color/60">
            <div className="flex items-center justify-between">
              <label className="font-bold text-foreground flex items-center gap-1.5">
                <Paperclip size={13} className="text-blue-500" />
                <span>Invoice &amp; Proof Attachments ({txForm.attachments.length} of 5 attached)</span>
              </label>
              <span className="text-[10px] text-muted">Accepts PNG, JPG, PDF</span>
            </div>

            {txForm.attachments.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {txForm.attachments.map((att, idx) => (
                  <div
                    key={att.id}
                    className="flex items-center justify-between p-2 rounded-xl border border-border-color bg-surface"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText size={14} className="text-blue-500 shrink-0" />
                      <span className="truncate font-medium text-foreground">{att.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setTxForm((prev) => ({
                          ...prev,
                          attachments: prev.attachments.filter((_, i) => i !== idx),
                        }))
                      }
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {txForm.attachments.length < 5 && (
              <label
                className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border-color bg-surface-elevated px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface transition ${
                  uploadingAttachment ? "opacity-60 pointer-events-none" : ""
                }`}
              >
                {uploadingAttachment ? <Loader2 size={13} className="animate-spin text-blue-600" /> : <Upload size={13} className="text-blue-500" />}
                <span>{uploadingAttachment ? "Uploading Attachment..." : "+ Upload Invoice / Proof File"}</span>
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleUploadTxAttachment}
                  disabled={uploadingAttachment}
                />
              </label>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border-color">
            <button
              type="button"
              onClick={() => setRecordModalOpen(false)}
              className="rounded-xl border border-border-color px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-elevated transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingTx || uploadingAttachment}
              className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {savingTx ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              <span>{savingTx ? "Recording Transaction..." : txForm.requestApproval ? "Submit for Approval" : "Save Transaction"}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: QUICKBOOKS VOUCHER AUDIT & PROOF GALLERY MODAL                  */}
      {/* ========================================================================= */}
      <Modal
        open={Boolean(selectedTxForAudit)}
        onClose={() => setSelectedTxForAudit(null)}
        title="Financial Voucher &amp; Transaction Audit Trail"
      >
        {selectedTxForAudit && (
          <div className="space-y-4 text-xs">
            {/* Header Voucher Card */}
            <div className="rounded-2xl border border-border-color bg-surface-elevated/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="font-mono text-[11px] font-bold text-blue-600">
                  REF: {selectedTxForAudit.referenceNumber}
                </span>
                <h3 className="text-base font-black text-foreground mt-0.5">{selectedTxForAudit.category}</h3>
                <p className="text-xs text-muted">Date: {selectedTxForAudit.transactionDate}</p>
              </div>

              <div className="text-left sm:text-right">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-black uppercase inline-block mb-1 ${
                    selectedTxForAudit.status === "approved"
                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                      : selectedTxForAudit.status === "pending_approval"
                      ? "bg-amber-500/10 text-amber-600 border border-amber-500/20"
                      : "bg-red-500/10 text-red-600 border border-red-500/20"
                  }`}
                >
                  {selectedTxForAudit.status.replace(/_/g, " ")}
                </span>
                <p className="text-2xl font-black text-foreground">
                  {formatCurrency(selectedTxForAudit.amount)}
                </p>
              </div>
            </div>

            {/* Voucher Details Table */}
            <div className="rounded-xl border border-border-color bg-surface p-3.5 space-y-2">
              <p className="font-bold text-[10px] uppercase tracking-wider text-muted">Voucher Breakdown</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div>
                  <span className="text-muted text-[11px]">Type:</span>
                  <p className="font-bold text-foreground capitalize">{selectedTxForAudit.type}</p>
                </div>
                <div>
                  <span className="text-muted text-[11px]">Payment Method:</span>
                  <p className="font-bold text-foreground">{selectedTxForAudit.paymentMethod}</p>
                </div>
                <div>
                  <span className="text-muted text-[11px]">Property Scope:</span>
                  <p className="font-bold text-foreground">{selectedTxForAudit.propertyName || "Portfolio HQ"}</p>
                </div>
              </div>
              <div className="pt-2 border-t border-border-color/60">
                <span className="text-muted text-[11px]">Summary &amp; Commercial Explanation:</span>
                <p className="font-medium text-foreground mt-0.5 leading-relaxed">{selectedTxForAudit.description}</p>
              </div>
            </div>

            {/* Who Did What & Timeframe Block */}
            <div className="rounded-xl border border-border-color bg-surface p-3.5 space-y-2">
              <p className="font-bold text-[10px] uppercase tracking-wider text-muted">Accountability &amp; Audit Trail</p>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-muted">Recorded By:</span>
                  <span className="font-bold text-foreground">
                    {selectedTxForAudit.recordedByName} ({selectedTxForAudit.recordedByRole || "Staff"})
                  </span>
                </div>

                {selectedTxForAudit.approvedByName && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted">Authorized &amp; Signed By:</span>
                    <span className="font-bold text-emerald-600">
                      {selectedTxForAudit.approvedByName} {selectedTxForAudit.approvedAt ? `on ${selectedTxForAudit.approvedAt.slice(0, 10)}` : ""}
                    </span>
                  </div>
                )}

                {selectedTxForAudit.signatureUrl && (
                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-muted">Digital Signature Stamp:</span>
                    <img src={selectedTxForAudit.signatureUrl} alt="Signature" className="h-10 object-contain bg-white dark:bg-slate-900 rounded p-1 border border-border-color" />
                  </div>
                )}
              </div>
            </div>

            {/* Attachments & Proofs Gallery (Up to 5) */}
            <div className="rounded-xl border border-border-color bg-surface p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-bold text-[10px] uppercase tracking-wider text-muted flex items-center gap-1.5">
                  <Paperclip size={13} className="text-blue-500" />
                  <span>Proof &amp; Invoice Attachments ({(selectedTxForAudit.attachments || []).length} of 5)</span>
                </p>
                <span className="text-[10px] text-muted">Images &amp; PDFs</span>
              </div>

              {(selectedTxForAudit.attachments || []).length === 0 ? (
                <div className="text-center py-6 text-muted border border-dashed border-border-color rounded-xl">
                  <p className="text-xs">No invoices or proof documents attached yet.</p>
                  <p className="text-[10px] mt-0.5">Upload receipts below to complete voucher documentation.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedTxForAudit.attachments.map((att) => (
                    <div
                      key={att.id}
                      className="p-2.5 rounded-xl border border-border-color bg-surface-elevated/60 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText size={16} className="text-blue-500 shrink-0" />
                        <div className="truncate">
                          <p className="font-bold text-foreground truncate text-[11px]">{att.name}</p>
                          <span className="text-[9px] text-muted">{att.uploadedByName}</span>
                        </div>
                      </div>
                      <a
                        href={att.url}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded-lg border border-border-color hover:bg-surface text-foreground transition"
                        title="View / Download Proof"
                      >
                        <ExternalLink size={13} />
                      </a>
                    </div>
                  ))}
                </div>
              )}

              {/* Retroactive Attachment Upload */}
              {(selectedTxForAudit.attachments || []).length < 5 && (
                <div className="pt-2 border-t border-border-color/60">
                  <label
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border border-border-color bg-surface-elevated px-3.5 py-1.5 text-xs font-semibold text-foreground hover:bg-surface transition ${
                      retroProofUploading ? "opacity-60 pointer-events-none" : ""
                    }`}
                  >
                    {retroProofUploading ? <Loader2 size={13} className="animate-spin text-blue-600" /> : <Upload size={13} className="text-blue-500" />}
                    <span>{retroProofUploading ? "Attaching Proof..." : "+ Attach Additional Invoice / Proof File"}</span>
                    <input
                      type="file"
                      multiple
                      accept="image/*,application/pdf"
                      className="hidden"
                      onChange={handleUploadRetroProof}
                      disabled={retroProofUploading}
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setSelectedTxForAudit(null)}
                className="rounded-xl border border-border-color px-4 py-2 text-xs font-bold text-foreground hover:bg-surface-elevated transition"
              >
                Close Voucher
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: PROCUREMENT LIFECYCLE TIMELINE POPUP                            */}
      {/* ========================================================================= */}
      <Modal
        open={Boolean(selectedProcurementForTimeline)}
        onClose={() => setSelectedProcurementForTimeline(null)}
        title="Procurement &amp; Payment Lifecycle Timeline"
      >
        {selectedProcurementForTimeline && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-surface-elevated/70 border border-border-color">
              <div>
                <span className="font-mono text-blue-600 font-black">#{selectedProcurementForTimeline.id}</span>
                <h3 className="text-sm font-bold text-foreground mt-0.5">{selectedProcurementForTimeline.itemName}</h3>
                <p className="text-[11px] text-muted">Dept: {selectedProcurementForTimeline.requestingDepartment}</p>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-foreground block">
                  {formatCurrency(Number(selectedProcurementForTimeline.totalApprovedAmount || 0))}
                </span>
                <span className="text-[10px] font-bold text-emerald-600 uppercase">
                  Stage: {selectedProcurementForTimeline.pipelineStage.replace(/_/g, " ")}
                </span>
              </div>
            </div>

            {/* Interactive Timeline Stepper */}
            <div className="relative pl-6 space-y-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-blue-500/20">
              {(selectedProcurementForTimeline.events || []).map((ev, index) => (
                <div key={ev.id || index} className="relative">
                  <div className="absolute -left-6 top-0.5 h-4 w-4 rounded-full border-2 border-surface bg-blue-600 shadow-xs" />
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-foreground capitalize">
                        {ev.stage.replace(/_/g, " ")}
                      </span>
                      <span className="text-[10px] text-muted">
                        {new Date(ev.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-xs text-foreground font-medium">{ev.action}</p>
                    <p className="text-[11px] text-muted">Actor: {ev.actorName || "Procurement Specialist"}</p>
                    {ev.notes && <p className="text-[11px] text-amber-600 italic mt-0.5">Note: {ev.notes}</p>}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-3 border-t border-border-color">
              {selectedProcurementForTimeline.pipelineStage === "fund_request_to_accounts" && (
                <button
                  type="button"
                  onClick={() => {
                    handleAuthorizeProcurement(selectedProcurementForTimeline);
                  }}
                  className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 font-bold text-white shadow-xs flex items-center gap-1.5 transition"
                >
                  <FileSignature size={14} />
                  <span>Authorize &amp; Stamp Signature</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedProcurementForTimeline(null)}
                className="rounded-xl border border-border-color px-4 py-2 font-semibold text-foreground hover:bg-surface-elevated transition ml-auto"
              >
                Close Timeline
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 4: PUSH / REASSIGN PROCUREMENT REQUEST MODAL                        */}
      {/* ========================================================================= */}
      <Modal
        open={Boolean(reassignModalReq)}
        onClose={() => setReassignModalReq(null)}
        title="Push / Reassign Request to Finance Colleague"
      >
        {reassignModalReq && (
          <div className="space-y-4 text-xs">
            <p className="text-muted">
              Select an authorized colleague from the Accounts &amp; Finance department hierarchy to take ownership of request #{reassignModalReq.id}.
            </p>

            <div>
              <label className="mb-1 block font-bold text-foreground">Select Recipient (By Role Hierarchy) *</label>
              <select
                value={reassignTargetStaffId}
                onChange={(e) => setReassignTargetStaffId(e.target.value)}
                className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground font-bold outline-none focus:border-blue-600"
              >
                {FINANCE_STAFF_HIERARCHY.map((staff) => (
                  <option key={staff.id} value={staff.id}>
                    {staff.level} — {staff.role}: {staff.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block font-medium text-foreground">Handover Note / Instructions</label>
              <textarea
                rows={2}
                placeholder="Reason for reassignment or payment verification instructions..."
                value={reassignNotes}
                onChange={(e) => setReassignNotes(e.target.value)}
                className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border-color">
              <button
                type="button"
                onClick={() => setReassignModalReq(null)}
                className="rounded-xl border border-border-color px-4 py-2 font-semibold text-muted hover:bg-surface-elevated transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReassign}
                className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white shadow-sm hover:bg-blue-700 transition"
              >
                Confirm Reassignment
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Document Share Modal */}
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


