import type {
  AuditEventRow,
  ContractRow,
  DashboardData,
  DashboardStats,
  InspectionRow,
  InventoryItemRow,
  InvoiceRow,
  MaintenanceOverviewData,
  PreventiveTaskRow,
  PropertyRow,
  ProviderRow,
  ReportsData,
  SettingsData,
  TenantRow,
  WorkOrderRow,
} from "./types";
import { supabase } from "./supabase";

const apiBaseUrl = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

function hasApiBase() {
  return Boolean(apiBaseUrl);
}

function hasSupabaseConfig() {
  // supabase.ts has hardcoded fallbacks, so Supabase is always available
  return true;
}

function getSupabaseClient() {
  return supabase;
}

function toNumber(value: unknown) {
  return Number(value ?? 0) || 0;
}

function titleFromMonth(month: string) {
  const [year, monthIndex] = month.split("-").map(Number);
  if (!year || !monthIndex) {
    return month;
  }

  return new Date(year, monthIndex - 1, 1).toLocaleString("en-ZA", {
    month: "short",
  });
}

async function fetchApiJson<T>(path: string): Promise<T> {
  if (!hasApiBase()) {
    throw new Error("VITE_API_URL is not configured.");
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`API request failed (${response.status}) for ${path}`);
  }

  return (await response.json()) as T;
}

function unwrapData<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: T }).data;
  }

  return payload as T;
}

function buildRentStatus(invoiceStatus?: string): TenantRow["rentStatus"] {
  if (!invoiceStatus) {
    return "unknown";
  }

  if (invoiceStatus === "paid") {
    return "paid";
  }

  if (invoiceStatus === "sent" || invoiceStatus === "draft") {
    return "partial";
  }

  if (invoiceStatus === "overdue") {
    return "overdue";
  }

  return "unknown";
}

function normalizeInvoiceStatus(status?: string): InvoiceRow["status"] {
  if (!status) {
    return "draft";
  }

  if (status === "paid" || status === "sent" || status === "overdue" || status === "draft") {
    return status;
  }

  // Map legacy values
  if (status === "unpaid" || status === "partially_paid") {
    return "draft";
  }

  return status;
}

function asRelationObject(value: unknown): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    return (value[0] as Record<string, unknown> | undefined) ?? null;
  }

  if (typeof value === "object") {
    return value as Record<string, unknown>;
  }

  return null;
}

function toInvoiceRow(payload: Record<string, unknown>): InvoiceRow {
  const tenant = asRelationObject(payload.tenant);
  const property = asRelationObject(payload.properties);
  const dueDate = String(payload.due_date ?? payload.month ?? "-");

  return {
    id: String(payload.id ?? ""),
    tenantName: String(tenant?.full_name ?? payload.tenant_name ?? "Unknown Tenant"),
    propertyName: String(property?.name ?? payload.property_name ?? "Unassigned"),
    month: String(payload.month ?? "-"),
    dueDate,
    totalAmount: toNumber(payload.total_amount),
    status: normalizeInvoiceStatus(String(payload.status ?? "draft")),
  };
}

function toWorkOrderRow(payload: Record<string, unknown>): WorkOrderRow {
  const property = asRelationObject(payload.properties);
  const provider = asRelationObject(payload.maintainers);

  return {
    id: String(payload.id ?? ""),
    propertyName: String(property?.name ?? payload.property_name ?? "Unassigned"),
    providerName: String(provider?.name ?? payload.provider_name ?? "Unassigned"),
    category: String(payload.category ?? "General"),
    priority: String(payload.priority ?? "medium"),
    status: String(payload.status ?? "open"),
    scheduledDate: String(payload.scheduled_date ?? "-"),
    estimatedCost: toNumber(payload.estimated_cost),
    actualCost: toNumber(payload.actual_cost),
  };
}

function toProviderRow(payload: Record<string, unknown>): ProviderRow {
  return {
    id: String(payload.id ?? ""),
    name: String(payload.name ?? "Unnamed Provider"),
    phone: String(payload.phone ?? "-"),
    specialization: String(payload.specialization ?? "General"),
    rate: toNumber(payload.rate),
    totalJobs: toNumber(payload.total_jobs),
    totalPaid: toNumber(payload.total_paid),
  };
}

function toInspectionRow(payload: Record<string, unknown>): InspectionRow {
  const property = asRelationObject(payload.properties);
  const tenant = asRelationObject(payload.tenants);

  return {
    id: String(payload.id ?? ""),
    propertyName: String(property?.name ?? payload.property_name ?? "Unassigned"),
    tenantName: String(tenant?.full_name ?? payload.tenant_name ?? "Unassigned"),
    type: String(payload.type ?? "General"),
    status: String(payload.status ?? "scheduled"),
    scheduledDate: String(payload.scheduled_date ?? "-"),
    completedDate: String(payload.completed_date ?? "-"),
    inspectorName: String(payload.inspector_name ?? "-"),
  };
}

function toPreventiveTaskRow(payload: Record<string, unknown>): PreventiveTaskRow {
  const property = asRelationObject(payload.properties);
  const provider = asRelationObject(payload.maintainers);

  return {
    id: String(payload.id ?? ""),
    propertyName: String(property?.name ?? payload.property_name ?? "Unassigned"),
    providerName: String(provider?.name ?? payload.provider_name ?? "Unassigned"),
    title: String(payload.title ?? "Untitled Task"),
    category: String(payload.category ?? "General"),
    frequency: String(payload.frequency ?? "-"),
    status: String(payload.status ?? "scheduled"),
    nextDue: String(payload.next_due ?? "-"),
    estimatedCost: toNumber(payload.estimated_cost),
  };
}

function toInventoryItemRow(payload: Record<string, unknown>): InventoryItemRow {
  return {
    id: String(payload.id ?? ""),
    name: String(payload.name ?? "Unnamed Item"),
    category: String(payload.category ?? "General"),
    quantity: toNumber(payload.quantity),
    unit: String(payload.unit ?? "unit"),
    minStockLevel: toNumber(payload.min_stock_level),
    unitCost: toNumber(payload.unit_cost),
    supplier: String(payload.supplier ?? "-"),
    location: String(payload.location ?? "-"),
  };
}

function toContractRow(payload: Record<string, unknown>): ContractRow {
  const tenant = asRelationObject(payload.tenants);
  const property = asRelationObject(payload.properties);

  return {
    id: String(payload.id ?? ""),
    tenantName: String(tenant?.full_name ?? payload.tenant_name ?? "Unassigned"),
    propertyName: String(property?.name ?? payload.property_name ?? "Unassigned"),
    startDate: String(payload.start_date ?? "-"),
    endDate: String(payload.end_date ?? "-"),
    monthlyRent: toNumber(payload.monthly_rent),
    depositAmount: toNumber(payload.deposit_amount),
    notes: String(payload.notes ?? ""),
    status: String(payload.status ?? "pending"),
  };
}

function toAuditEventRow(payload: Record<string, unknown>): AuditEventRow {
  const detailsValue = payload.details;

  return {
    id: String(payload.id ?? ""),
    createdAt: String(payload.created_at ?? "-"),
    action: String(payload.action ?? "unknown"),
    entityType: String(payload.entity_type ?? "-"),
    entityId: String(payload.entity_id ?? "-"),
    actorName: String(payload.user_name ?? payload.actor_name ?? "System"),
    details:
      typeof detailsValue === "string"
        ? detailsValue
        : JSON.stringify(detailsValue ?? {}),
  };
}

function buildStatsFromValues(values: {
  totalProperties: number;
  occupiedUnits: number;
  totalMonthlyIncome: number;
  totalMonthlyExpenses: number;
  netProfit: number;
  pendingMaintenance: number;
  overduePayments: number;
  collectionRate: number;
}): DashboardStats {
  const vacantUnits = Math.max(0, values.totalProperties - values.occupiedUnits);
  const occupancyRate =
    values.totalProperties > 0
      ? (values.occupiedUnits / values.totalProperties) * 100
      : 0;

  return {
    totalProperties: values.totalProperties,
    occupiedUnits: values.occupiedUnits,
    vacantUnits,
    occupancyRate,
    totalMonthlyIncome: values.totalMonthlyIncome,
    totalMonthlyExpenses: values.totalMonthlyExpenses,
    netProfit: values.netProfit,
    pendingMaintenance: values.pendingMaintenance,
    overduePayments: values.overduePayments,
    collectionRate: values.collectionRate,
  };
}

function mostRecentMonth(invoices: Array<{ month?: string }>) {
  return invoices
    .map((item) => item.month)
    .filter((month): month is string => Boolean(month))
    .sort()
    .at(-1);
}

function computeCollectionRate(invoices: Array<{ month?: string; status?: string }>) {
  const latestMonth = mostRecentMonth(invoices);
  if (!latestMonth) {
    return 0;
  }

  const currentMonthInvoices = invoices.filter((invoice) => invoice.month === latestMonth);
  if (currentMonthInvoices.length === 0) {
    return 0;
  }

  const paidCount = currentMonthInvoices.filter((invoice) => invoice.status === "paid").length;
  return (paidCount / currentMonthInvoices.length) * 100;
}

export async function fetchDashboardData(): Promise<DashboardData> {
  if (hasApiBase()) {
    const [statsPayload, monthlyPayload, invoicesPayload] = await Promise.all([
      fetchApiJson<unknown>("/api/dashboard/stats"),
      fetchApiJson<unknown>("/api/dashboard/monthly"),
      fetchApiJson<unknown>("/api/invoices"),
    ]);

    const stats = unwrapData<{
      total_properties?: number;
      occupied_units?: number;
      total_monthly_income?: number;
      total_monthly_expenses?: number;
      net_profit?: number;
      pending_maintenance?: number;
      overdue_payments?: number;
    }>(statsPayload);

    const monthly = unwrapData<
      Array<{ month: string; income: number; expenses: number; profit: number }>
    >(monthlyPayload);

    const invoices = unwrapData<Array<{ month?: string; status?: string }>>(invoicesPayload);

    const normalizedMonthly = (monthly ?? []).slice(-6).map((item) => ({
      month: item.month,
      label: titleFromMonth(item.month),
      income: toNumber(item.income),
      expenses: toNumber(item.expenses),
      profit: toNumber(item.profit),
    }));

    return {
      stats: buildStatsFromValues({
        totalProperties: toNumber(stats?.total_properties),
        occupiedUnits: toNumber(stats?.occupied_units),
        totalMonthlyIncome: toNumber(stats?.total_monthly_income),
        totalMonthlyExpenses: toNumber(stats?.total_monthly_expenses),
        netProfit: toNumber(stats?.net_profit),
        pendingMaintenance: toNumber(stats?.pending_maintenance),
        overduePayments: toNumber(stats?.overdue_payments),
        collectionRate: computeCollectionRate(invoices ?? []),
      }),
      cashflow: normalizedMonthly,
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(
      "Configure VITE_API_URL or Supabase env vars (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).",
    );
  }

  const [{ data: properties, error: propertiesError }, { data: maintenance, error: maintenanceError }, { data: invoices, error: invoicesError }] =
    await Promise.all([
      supabase.from("properties").select("id, status, monthly_rent"),
      supabase.from("maintenance").select("cost, status, created_at"),
      supabase.from("invoices").select("month, total_amount, status, due_date"),
    ]);

  if (propertiesError) throw propertiesError;
  if (maintenanceError) throw maintenanceError;
  if (invoicesError) throw invoicesError;

  const propertyRows = properties ?? [];
  const occupiedUnits = propertyRows.filter((row) => row.status === "occupied").length;
  const totalMonthlyIncome = propertyRows
    .filter((row) => row.status === "occupied")
    .reduce((sum, row) => sum + toNumber(row.monthly_rent), 0);

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthlyMaintenance = (maintenance ?? []).filter((row) =>
    String(row.created_at ?? "").startsWith(monthKey),
  );

  const totalMonthlyExpenses = monthlyMaintenance.reduce(
    (sum, row) => sum + toNumber(row.cost),
    0,
  );

  const normalizedMonthlyMap = new Map<string, { income: number; expenses: number; profit: number }>();

  (invoices ?? [])
    .filter((invoice) => invoice.status === "paid")
    .forEach((invoice) => {
      const key = String(invoice.month ?? "").slice(0, 7);
      const current = normalizedMonthlyMap.get(key) ?? { income: 0, expenses: 0, profit: 0 };
      current.income += toNumber(invoice.total_amount);
      normalizedMonthlyMap.set(key, current);
    });

  (maintenance ?? []).forEach((row) => {
    const key = String(row.created_at ?? "").slice(0, 7);
    const current = normalizedMonthlyMap.get(key) ?? { income: 0, expenses: 0, profit: 0 };
    current.expenses += toNumber(row.cost);
    normalizedMonthlyMap.set(key, current);
  });

  const cashflow = Array.from(normalizedMonthlyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6)
    .map(([month, value]) => ({
      month,
      label: titleFromMonth(month),
      income: value.income,
      expenses: value.expenses,
      profit: value.income - value.expenses,
    }));

  const overduePayments = (invoices ?? []).filter((row) => row.status === "overdue").length;
  const collectionRate = computeCollectionRate((invoices ?? []) as Array<{ month?: string; status?: string }>);

  return {
    stats: buildStatsFromValues({
      totalProperties: propertyRows.length,
      occupiedUnits,
      totalMonthlyIncome,
      totalMonthlyExpenses,
      netProfit: totalMonthlyIncome - totalMonthlyExpenses,
      pendingMaintenance: monthlyMaintenance.filter((row) => row.status !== "completed").length,
      overduePayments,
      collectionRate,
    }),
    cashflow,
  };
}

export async function fetchPropertiesData(): Promise<PropertyRow[]> {
  if (hasApiBase()) {
    const payload = await fetchApiJson<unknown>("/api/properties");
    const rows = unwrapData<Array<Record<string, unknown>>>(payload) ?? [];

    return rows.map((row) => ({
      id: String(row.id ?? ""),
      name: String(row.name ?? "Unnamed"),
      type: String(row.type ?? "Unknown"),
      address: String(row.address ?? "Address not set"),
      status: String(row.status ?? "vacant"),
      monthlyRent: toNumber(row.monthly_rent),
    }));
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(
      "Configure VITE_API_URL or Supabase env vars (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).",
    );
  }

  const { data, error } = await supabase
    .from("properties")
    .select("id, name, type, address, status, monthly_rent")
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    name: String(row.name ?? "Unnamed"),
    type: String(row.type ?? "Unknown"),
    address: String(row.address ?? "Address not set"),
    status: String(row.status ?? "vacant"),
    monthlyRent: toNumber(row.monthly_rent),
  }));
}

export async function fetchTenantsData(): Promise<TenantRow[]> {
  if (hasApiBase()) {
    const [tenantsPayload, invoicesPayload] = await Promise.all([
      fetchApiJson<unknown>("/api/tenants"),
      fetchApiJson<unknown>("/api/invoices"),
    ]);

    const tenants = unwrapData<Array<Record<string, unknown>>>(tenantsPayload) ?? [];
    const invoices =
      unwrapData<Array<{ tenant_id?: string; status?: string; due_date?: string }>>(invoicesPayload) ?? [];

    const latestStatusByTenant = new Map<string, string>();
    invoices
      .slice()
      .sort((a, b) => String(b.due_date ?? "").localeCompare(String(a.due_date ?? "")))
      .forEach((invoice) => {
        const tenantId = invoice.tenant_id;
        if (!tenantId || latestStatusByTenant.has(tenantId)) {
          return;
        }

        latestStatusByTenant.set(tenantId, String(invoice.status ?? ""));
      });

    return tenants.map((tenant) => {
      const tenantId = String(tenant.id ?? "");
      const status = latestStatusByTenant.get(tenantId);
      const propertyObj = tenant.properties as { name?: string } | undefined;

      return {
        id: tenantId,
        fullName: String(tenant.full_name ?? "Unnamed Tenant"),
        propertyName: String(propertyObj?.name ?? "Unassigned"),
        phone: String(tenant.phone ?? tenant.whatsapp_number ?? "-"),
        email: String(tenant.email ?? "-"),
        tenureStatus: String(tenant.tenure_status ?? "active"),
        rentStatus: buildRentStatus(status),
      };
    });
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(
      "Configure VITE_API_URL or Supabase env vars (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).",
    );
  }

  const [{ data: tenants, error: tenantsError }, { data: invoices, error: invoicesError }] =
    await Promise.all([
      supabase
        .from("tenants")
        .select("id, full_name, phone, whatsapp_number, email, tenure_status, properties(name)"),
      supabase.from("invoices").select("tenant_id, status, due_date"),
    ]);

  if (tenantsError) throw tenantsError;
  if (invoicesError) throw invoicesError;

  const latestStatusByTenant = new Map<string, string>();
  (invoices ?? [])
    .slice()
    .sort((a, b) => String(b.due_date ?? "").localeCompare(String(a.due_date ?? "")))
    .forEach((invoice) => {
      const tenantId = String(invoice.tenant_id ?? "");
      if (!tenantId || latestStatusByTenant.has(tenantId)) {
        return;
      }

      latestStatusByTenant.set(tenantId, String(invoice.status ?? ""));
    });

  return (tenants ?? []).map((tenant) => ({
    id: String(tenant.id),
    fullName: String(tenant.full_name ?? "Unnamed Tenant"),
    propertyName: String((tenant.properties as { name?: string } | null)?.name ?? "Unassigned"),
    phone: String(tenant.phone ?? tenant.whatsapp_number ?? "-"),
    email: String(tenant.email ?? "-"),
    tenureStatus: String(tenant.tenure_status ?? "active"),
    rentStatus: buildRentStatus(latestStatusByTenant.get(String(tenant.id))),
  }));
}

export async function fetchInvoicesData(): Promise<InvoiceRow[]> {
  if (hasApiBase()) {
    const payload = await fetchApiJson<unknown>("/api/invoices");
    const rows = unwrapData<Array<Record<string, unknown>>>(payload) ?? [];

    return rows
      .map(toInvoiceRow)
      .sort((a, b) => String(b.dueDate).localeCompare(String(a.dueDate)));
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(
      "Configure VITE_API_URL or Supabase env vars (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).",
    );
  }

  const { data, error } = await supabase
    .from("invoices")
    .select("id, month, due_date, total_amount, status, tenant:tenants(full_name), properties(name)")
    .order("due_date", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => toInvoiceRow(row as Record<string, unknown>));
}

export async function fetchReportsData(): Promise<ReportsData> {
  const [dashboardData, invoiceRows] = await Promise.all([
    fetchDashboardData(),
    fetchInvoicesData(),
  ]);

  const totalInvoiced = invoiceRows.reduce((sum, row) => sum + row.totalAmount, 0);
  const totalPaid = invoiceRows
    .filter((row) => row.status === "paid")
    .reduce((sum, row) => sum + row.totalAmount, 0);
  const totalOverdue = invoiceRows
    .filter((row) => row.status === "overdue")
    .reduce((sum, row) => sum + row.totalAmount, 0);

  const statusCounts = new Map<string, number>();
  invoiceRows.forEach((row) => {
    const current = statusCounts.get(row.status) ?? 0;
    statusCounts.set(row.status, current + 1);
  });

  return {
    summary: {
      totalInvoiced,
      totalPaid,
      totalOverdue,
      collectionRate: dashboardData.stats.collectionRate,
    },
    byStatus: Array.from(statusCounts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count),
    monthly: dashboardData.cashflow,
  };
}

export async function fetchWorkOrdersData(): Promise<WorkOrderRow[]> {
  if (hasApiBase()) {
    const payload = await fetchApiJson<unknown>("/api/maintenance");
    const rows = unwrapData<Array<Record<string, unknown>>>(payload) ?? [];
    return rows
      .map(toWorkOrderRow)
      .sort((a, b) => String(b.scheduledDate).localeCompare(String(a.scheduledDate)));
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(
      "Configure VITE_API_URL or Supabase env vars (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).",
    );
  }

  const { data, error } = await supabase
    .from("maintenance")
    .select(
      "id, category, priority, status, scheduled_date, estimated_cost, actual_cost, properties(name), maintainers(name)",
    )
    .order("scheduled_date", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => toWorkOrderRow(row as Record<string, unknown>));
}

export async function fetchProvidersData(): Promise<ProviderRow[]> {
  if (hasApiBase()) {
    const payload = await fetchApiJson<unknown>("/api/maintainers");
    const rows = unwrapData<Array<Record<string, unknown>>>(payload) ?? [];
    return rows.map(toProviderRow).sort((a, b) => b.totalJobs - a.totalJobs);
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(
      "Configure VITE_API_URL or Supabase env vars (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).",
    );
  }

  const { data, error } = await supabase
    .from("maintainers")
    .select("id, name, phone, specialization, rate, total_jobs, total_paid")
    .order("total_jobs", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => toProviderRow(row as Record<string, unknown>));
}

export async function fetchInspectionsData(): Promise<InspectionRow[]> {
  if (hasApiBase()) {
    const payload = await fetchApiJson<unknown>("/api/inspections");
    const rows = unwrapData<Array<Record<string, unknown>>>(payload) ?? [];
    return rows
      .map(toInspectionRow)
      .sort((a, b) => String(b.scheduledDate).localeCompare(String(a.scheduledDate)));
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(
      "Configure VITE_API_URL or Supabase env vars (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).",
    );
  }

  const { data, error } = await supabase
    .from("inspections")
    .select(
      "id, type, status, scheduled_date, completed_date, inspector_name, properties(name), tenants(full_name)",
    )
    .order("scheduled_date", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => toInspectionRow(row as Record<string, unknown>));
}

export async function fetchPreventiveTasksData(): Promise<PreventiveTaskRow[]> {
  if (hasApiBase()) {
    const payload = await fetchApiJson<unknown>("/api/preventive-maintenance");
    const rows = unwrapData<Array<Record<string, unknown>>>(payload) ?? [];
    return rows
      .map(toPreventiveTaskRow)
      .sort((a, b) => String(a.nextDue).localeCompare(String(b.nextDue)));
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(
      "Configure VITE_API_URL or Supabase env vars (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).",
    );
  }

  const { data, error } = await supabase
    .from("preventive_maintenance")
    .select(
      "id, title, category, frequency, status, next_due, estimated_cost, properties(name), maintainers(name)",
    )
    .order("next_due", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => toPreventiveTaskRow(row as Record<string, unknown>));
}

export async function fetchInventoryData(): Promise<InventoryItemRow[]> {
  if (hasApiBase()) {
    const payload = await fetchApiJson<unknown>("/api/inventory");
    const rows = unwrapData<Array<Record<string, unknown>>>(payload) ?? [];
    return rows.map(toInventoryItemRow).sort((a, b) => a.quantity - b.quantity);
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(
      "Configure VITE_API_URL or Supabase env vars (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).",
    );
  }

  const { data, error } = await supabase
    .from("maintenance_inventory")
    .select("id, name, category, quantity, unit, min_stock_level, unit_cost, supplier, location")
    .order("quantity", { ascending: true });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => toInventoryItemRow(row as Record<string, unknown>));
}

export async function fetchMaintenanceOverviewData(): Promise<MaintenanceOverviewData> {
  const [workOrders, providers, inspections, preventiveTasks, inventoryItems] = await Promise.all([
    fetchWorkOrdersData(),
    fetchProvidersData(),
    fetchInspectionsData(),
    fetchPreventiveTasksData(),
    fetchInventoryData(),
  ]);

  return {
    totalWorkOrders: workOrders.length,
    openWorkOrders: workOrders.filter(
      (item) => item.status === "open" || item.status === "in_progress",
    ).length,
    completedWorkOrders: workOrders.filter((item) => item.status === "completed").length,
    totalProviders: providers.length,
    scheduledInspections: inspections.filter((item) => item.status === "scheduled").length,
    overduePreventiveTasks: preventiveTasks.filter((item) => item.status === "overdue").length,
    lowStockItems: inventoryItems.filter((item) => item.quantity <= item.minStockLevel).length,
  };
}

export async function fetchContractsData(): Promise<ContractRow[]> {
  if (hasApiBase()) {
    const payload = await fetchApiJson<unknown>("/api/contracts");
    const rows = unwrapData<Array<Record<string, unknown>>>(payload) ?? [];
    return rows
      .map(toContractRow)
      .sort((a, b) => String(b.startDate).localeCompare(String(a.startDate)));
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(
      "Configure VITE_API_URL or Supabase env vars (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).",
    );
  }

  const { data, error } = await supabase
    .from("contracts")
    .select("id, start_date, end_date, monthly_rent, deposit_amount, status, notes, tenants(full_name), properties(name)")
    .order("start_date", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => toContractRow(row as Record<string, unknown>));
}

export async function fetchSettingsData(): Promise<SettingsData> {
  if (hasApiBase()) {
    const payload = await fetchApiJson<unknown>("/api/settings");
    const data = unwrapData<Record<string, unknown>>(payload) ?? {};

    return {
      adminProfile: {
        firstName: String(data.first_name ?? ""),
        lastName: String(data.last_name ?? ""),
        email: String(data.admin_email ?? data.email ?? "-"),
        signatureUrl: String(data.signature_url ?? ""),
      },
      companyProfile: {
        companyName: String(data.company_name ?? "Champions Court"),
        logoUrl: String(data.logo_url ?? ""),
        address: String(data.address ?? "-"),
      },
      invoiceSettings: {
        taxRate: toNumber(data.tax_rate),
        defaultDueDay: toNumber(data.default_due_day),
        paymentInstructions: String(data.payment_instructions ?? "-"),
      },
      security: {
        activePinExists: Boolean(data.active_pin_exists),
      },
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(
      "Configure VITE_API_URL or Supabase env vars (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).",
    );
  }

  const [{ data: settingsRows, error: settingsError }, { data: userRows, error: userError }, { count: activePinCount, error: pinError }] =
    await Promise.all([
      supabase
        .from("company_settings")
        .select("company_name, logo_url, address, tax_rate, default_due_day, payment_instructions")
        .limit(1),
      supabase
        .from("users")
        .select("first_name, last_name, email, signature_url")
        .limit(1),
      supabase
        .from("admin_signup_pincodes")
        .select("id", { count: "exact", head: true })
        .eq("is_active", true),
    ]);

  if (settingsError) throw settingsError;
  if (userError) throw userError;
  if (pinError) throw pinError;

  const settings = settingsRows?.[0];
  const user = userRows?.[0];

  return {
    adminProfile: {
      firstName: String(user?.first_name ?? ""),
      lastName: String(user?.last_name ?? ""),
      email: String(user?.email ?? "-"),
      signatureUrl: String(user?.signature_url ?? ""),
    },
    companyProfile: {
      companyName: String(settings?.company_name ?? "Champions Court"),
      logoUrl: String(settings?.logo_url ?? ""),
      address: String(settings?.address ?? "-"),
    },
    invoiceSettings: {
      taxRate: toNumber(settings?.tax_rate),
      defaultDueDay: toNumber(settings?.default_due_day),
      paymentInstructions: String(settings?.payment_instructions ?? "-"),
    },
    security: {
      activePinExists: (activePinCount ?? 0) > 0,
    },
  };
}

export async function verifyAdminPin(pin: string): Promise<boolean> {
  const normalizedPin = pin.trim();
  if (!normalizedPin) {
    return false;
  }

  if (hasApiBase()) {
    const response = await fetch(`${apiBaseUrl}/api/admin-pin/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin: normalizedPin }),
    });

    if (!response.ok) {
      throw new Error(`PIN verification request failed (${response.status}).`);
    }

    const payload = (await response.json()) as { valid?: boolean };
    return Boolean(payload.valid);
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(
      "Configure VITE_API_URL or Supabase env vars (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).",
    );
  }

  const { count, error } = await supabase
    .from("admin_signup_pincodes")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .eq("code", normalizedPin);

  if (error) {
    throw error;
  }

  return (count ?? 0) > 0;
}

export async function fetchAuditTrailData(): Promise<AuditEventRow[]> {
  if (hasApiBase()) {
    const payload = await fetchApiJson<unknown>("/api/audit-log");
    const rows = unwrapData<Array<Record<string, unknown>>>(payload) ?? [];
    return rows
      .map(toAuditEventRow)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    throw new Error(
      "Configure VITE_API_URL or Supabase env vars (VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY).",
    );
  }

  const { data, error } = await supabase
    .from("audit_log")
    .select("id, created_at, action, entity_type, entity_id, details, user_name")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw error;
  }

  return (data ?? []).map((row) => toAuditEventRow(row as Record<string, unknown>));
}
