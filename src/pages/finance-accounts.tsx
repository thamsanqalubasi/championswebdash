import { useEffect, useMemo, useState } from "react";
import { ModulePage } from "@/components/module-page";
import { ErrorState, LoadingState } from "@/components/data-state";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { fetchAdminInfo, fetchCompanyInfo } from "@/lib/storage";
import {
  buildBalanceSheetHtml,
  type AdminInfo,
  type BalanceSheetMonthlyRow,
  type CompanyInfo,
} from "@/lib/document-templates";

type ScopeMode = "system" | "property";
type PresentationMode = "summary" | "expanded";
type TimePreset = "this_month" | "last_3" | "last_6" | "last_12" | "last_24" | "last_60";

type BalanceSheetSummary = {
  rentCollected: number;
  maintenance: number;
  bills: number;
  renovations: number;
  tax: number;
  totalExpenses: number;
  netProfit: number;
};

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

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "NAD", maximumFractionDigits: 0 }).format(amount);
}

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
  tenants?: { property_id?: string } | null;
};

type PaymentWithProperty = {
  paymentDate: string;
  amountPaid: number;
  tenantPropertyId: string;
};

async function fetchPaymentsWithProperty(startDate: string, endDate: string): Promise<PaymentWithProperty[]> {
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
      .select("id, property_id")
      .in("id", tenantIds);
    if (!tenantsResult.error) {
      tenantPropertyMap = new Map(
        (tenantsResult.data ?? []).map((row) => [String(row.id ?? ""), String(row.property_id ?? "")]),
      );
    }
  }

  return rows.map((row) => {
    const tenantId = String(row.tenant_id ?? "");
    return {
      paymentDate: String(row.payment_date ?? ""),
      amountPaid: Number(row.amount_paid ?? 0),
      tenantPropertyId: tenantPropertyMap.get(tenantId) ?? "",
    };
  });
}

type MaintenanceProjection = {
  created_at?: string;
  cost?: number;
  actual_cost?: number;
  category?: string;
  property_id?: string;
};

async function fetchMaintenanceRows(startDate: string, endDate: string): Promise<MaintenanceProjection[]> {
  const withProperty = await supabase
    .from("maintenance")
    .select("created_at, cost, actual_cost, category, property_id")
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
    .select("created_at, cost, actual_cost, category")
    .gte("created_at", `${startDate}T00:00:00.000Z`)
    .lte("created_at", `${endDate}T23:59:59.999Z`);

  if (fallback.error) throw fallback.error;

  return ((fallback.data ?? []) as MaintenanceProjection[]).map((row) => ({
    ...row,
    property_id: "",
  }));
}

export default function FinanceAccountsPage() {
  const { user } = useAuth();
  const today = new Date();

  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [scope, setScope] = useState<ScopeMode>("system");
  const [propertyId, setPropertyId] = useState("");
  const [preset, setPreset] = useState<TimePreset>("this_month");
  const [startDate, setStartDate] = useState(toIsoDate(firstDayOfMonth(today)));
  const [endDate, setEndDate] = useState(toIsoDate(today));
  const [presentation, setPresentation] = useState<PresentationMode>("summary");
  const [showSignature, setShowSignature] = useState(true);
  const [showAdminName, setShowAdminName] = useState(true);

  const [summary, setSummary] = useState<BalanceSheetSummary | null>(null);
  const [monthlyRows, setMonthlyRows] = useState<BalanceSheetMonthlyRow[]>([]);
  const [companyInfo, setCompanyInfo] = useState<CompanyInfo | null>(null);
  const [adminInfo, setAdminInfo] = useState<AdminInfo | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadProperties() {
      const { data, error: propsError } = await supabase
        .from("properties")
        .select("id, name")
        .order("name");

      if (propsError) {
        if (!cancelled) setError(propsError.message);
        return;
      }

      if (!cancelled) {
        setProperties((data ?? []).map((row) => ({ id: String(row.id), name: String(row.name ?? "Unnamed") })));
      }
    }

    void loadProperties();
    return () => {
      cancelled = true;
    };
  }, []);

  const scopeLabel = useMemo(() => {
    if (scope === "system") return "Whole System";
    const selected = properties.find((item) => item.id === propertyId);
    return selected ? `Property: ${selected.name}` : "Property";
  }, [scope, propertyId, properties]);

  const applyPreset = (nextPreset: TimePreset) => {
    setPreset(nextPreset);
    const end = new Date();
    const start = addMonths(firstDayOfMonth(end), -presetMonthOffsets[nextPreset]);
    setStartDate(toIsoDate(start));
    setEndDate(toIsoDate(end));
  };

  const generateBalanceSheet = async () => {
    if (!startDate || !endDate) {
      setError("Please select start and end date.");
      return;
    }

    if (scope === "property" && !propertyId) {
      setError("Please choose a property.");
      return;
    }

    if (startDate > endDate) {
      setError("Start date cannot be after end date.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [company, admin, payments, maintenanceRows, renovations, bills] = await Promise.all([
        fetchCompanyInfo(),
        fetchAdminInfo(user?.email ?? undefined),
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

      const monthKeys = buildMonthRange(startDate, endDate);
      const monthMap = new Map<string, BalanceSheetMonthlyRow>();
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

      payments.forEach((row) => {
        const tenantPropertyId = row.tenantPropertyId;
        if (scope === "property" && tenantPropertyId !== propertyId) return;
        const month = toMonthKey(row.paymentDate);
        if (!monthMap.has(month)) return;
        monthMap.get(month)!.rentCollected += Number(row.amountPaid ?? 0);
      });

      maintenanceRows.forEach((row) => {
        if (scope === "property" && String(row.property_id ?? "") !== propertyId) return;
        const month = toMonthKey(String(row.created_at ?? ""));
        if (!monthMap.has(month)) return;
        const amount = Number(row.actual_cost ?? row.cost ?? 0);
        if (classifyMaintenanceCategory(String(row.category ?? "")) === "bills") {
          monthMap.get(month)!.bills += amount;
        } else {
          monthMap.get(month)!.maintenance += amount;
        }
      });

      renovations.forEach((row) => {
        if (scope === "property" && String(row.property_id ?? "") !== propertyId) return;
        const month = toMonthKey(String(row.created_at ?? ""));
        if (!monthMap.has(month)) return;
        monthMap.get(month)!.renovations += Number(row.actual_cost ?? row.cost ?? 0);
      });

      bills.forEach((row) => {
        if (scope === "property" && String(row.property_id ?? "") !== propertyId) return;
        const month = toMonthKey(String(row.created_at ?? ""));
        if (!monthMap.has(month)) return;
        monthMap.get(month)!.bills += Number(row.amount ?? 0);
      });

      monthMap.forEach((value) => {
        value.tax = value.rentCollected * ((company.taxRate ?? 0) / 100);
        value.totalExpenses = value.maintenance + value.bills + value.renovations;
        value.netProfit = value.rentCollected - value.totalExpenses - value.tax;
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
      setSummary(reportSummary);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "Could not generate balance sheet."));
    } finally {
      setLoading(false);
    }
  };

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
        summary,
        monthlyRows,
      },
      companyInfo,
      adminInfo,
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

  return (
    <ModulePage title="Finance Accounts" description="Generate balance sheets for whole system or specific properties.">
      <section className="space-y-4 rounded-lg border border-border-color bg-surface p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-sm text-muted">Scope</label>
            <select value={scope} onChange={(event) => setScope(event.target.value as ScopeMode)} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm">
              <option value="system">Whole system</option>
              <option value="property">Specific property</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-muted">Property</label>
            <select value={propertyId} onChange={(event) => setPropertyId(event.target.value)} disabled={scope !== "property"} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm disabled:opacity-50">
              <option value="">Select property...</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>{property.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-muted">Start date</label>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm" />
          </div>

          <div>
            <label className="mb-1 block text-sm text-muted">End date</label>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {(Object.keys(presetLabels) as TimePreset[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => applyPreset(key)}
              className={`rounded-md border border-border-color px-3 py-1.5 text-xs ${preset === key ? "bg-surface-elevated font-medium" : "text-muted"}`}
            >
              {presetLabels[key]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm text-muted">Presentation</label>
            <select value={presentation} onChange={(event) => setPresentation(event.target.value as PresentationMode)} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm">
              <option value="summary">Summary</option>
              <option value="expanded">Expanded</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-muted">Show signature</label>
            <select value={showSignature ? "yes" : "no"} onChange={(event) => setShowSignature(event.target.value === "yes")} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm">
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-muted">Show admin name</label>
            <select value={showAdminName ? "yes" : "no"} onChange={(event) => setShowAdminName(event.target.value === "yes")} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm">
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void generateBalanceSheet()} className="rounded-md border border-border-color bg-surface-elevated px-4 py-2 text-sm font-medium">
            Generate Balance Sheet
          </button>
          <button type="button" onClick={() => openPdfWindow(false)} className="rounded-md border border-border-color px-4 py-2 text-sm text-muted hover:bg-surface-elevated">
            View PDF
          </button>
          <button type="button" onClick={() => openPdfWindow(true)} className="rounded-md border border-border-color px-4 py-2 text-sm text-muted hover:bg-surface-elevated">
            Download PDF
          </button>
        </div>
      </section>

      {loading && <LoadingState label="Generating balance sheet..." />}
      {!loading && error && <ErrorState message={error} onRetry={() => void generateBalanceSheet()} />}

      {!loading && !error && summary && (
        <section className="mt-4 space-y-4 rounded-lg border border-border-color bg-surface p-4">
          <h3 className="text-base font-semibold">Generated Summary ({scopeLabel})</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <article className="rounded-md border border-border-color bg-surface-elevated p-3">
              <p className="text-xs text-muted">Rent Collected</p>
              <p className="text-lg font-semibold">{formatCurrency(summary.rentCollected)}</p>
            </article>
            <article className="rounded-md border border-border-color bg-surface-elevated p-3">
              <p className="text-xs text-muted">Total Expenses</p>
              <p className="text-lg font-semibold">{formatCurrency(summary.totalExpenses)}</p>
            </article>
            <article className="rounded-md border border-border-color bg-surface-elevated p-3">
              <p className="text-xs text-muted">Tax</p>
              <p className="text-lg font-semibold">{formatCurrency(summary.tax)}</p>
            </article>
            <article className="rounded-md border border-border-color bg-surface-elevated p-3">
              <p className="text-xs text-muted">Net Profit</p>
              <p className="text-lg font-semibold">{formatCurrency(summary.netProfit)}</p>
            </article>
          </div>

          {presentation === "expanded" && (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border-color text-left text-muted">
                    <th className="px-3 py-2 font-medium">Month</th>
                    <th className="px-3 py-2 font-medium text-right">Rent</th>
                    <th className="px-3 py-2 font-medium text-right">Maintenance</th>
                    <th className="px-3 py-2 font-medium text-right">Bills</th>
                    <th className="px-3 py-2 font-medium text-right">Renovations</th>
                    <th className="px-3 py-2 font-medium text-right">Tax</th>
                    <th className="px-3 py-2 font-medium text-right">Expenses</th>
                    <th className="px-3 py-2 font-medium text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyRows.map((row) => (
                    <tr key={row.month} className="border-b border-border-color/60">
                      <td className="px-3 py-3">{row.month}</td>
                      <td className="px-3 py-3 text-right">{formatCurrency(row.rentCollected)}</td>
                      <td className="px-3 py-3 text-right">{formatCurrency(row.maintenance)}</td>
                      <td className="px-3 py-3 text-right">{formatCurrency(row.bills)}</td>
                      <td className="px-3 py-3 text-right">{formatCurrency(row.renovations)}</td>
                      <td className="px-3 py-3 text-right">{formatCurrency(row.tax)}</td>
                      <td className="px-3 py-3 text-right">{formatCurrency(row.totalExpenses)}</td>
                      <td className={`px-3 py-3 text-right font-medium ${row.netProfit >= 0 ? "text-green-600" : "text-red-500"}`}>{formatCurrency(row.netProfit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </ModulePage>
  );
}
