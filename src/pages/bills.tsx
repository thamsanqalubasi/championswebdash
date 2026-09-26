import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ModulePage } from "@/components/module-page";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { Modal, ConfirmDialog } from "@/components/modal";
import { supabase } from "@/lib/supabase";
import { verifyAdminPin, isValidUuid } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { fetchAdminInfo, uploadFileToBucket } from "@/lib/storage";
import { billStatusMeta, frequencyLabel, type BillFrequency, type BillRow, type BillStatus } from "@/lib/bills";
import { Eye, Paperclip, Upload, CheckCircle, Clock, ExternalLink, FileText } from "lucide-react";
import { BillsReportModal } from "@/components/bills-report-modal";
import { Pagination } from "@/components/pagination";

type BillForm = {
  name: string;
  propertyId: string;
  frequency: BillFrequency;
  dueDay: number;
  amount: number;
  status: BillStatus;
  paidDate: string;
  paidAmount: number;
  adminPin: string;
};

type ScheduleBaseRow = {
  id: string;
  title: string;
  property_id: string;
  amount: number;
  due_day: number;
  created_at: string;
  created_by_name?: string;
  properties: { name?: string } | null;
  frequency?: BillFrequency;
};

type MonthlyBillRow = {
  id?: string;
  schedule_id: string;
  month: string;
  due_date: string;
  amount: number;
  status: string;
  paid_at: string | null;
  pop_url?: string | null;
  executed_by_name?: string | null;
  confirmed_by_name?: string | null;
};

const emptyForm: BillForm = {
  name: "",
  propertyId: "",
  frequency: "monthly",
  dueDay: Number(new Date().toISOString().slice(8, 10)),
  amount: 0,
  status: "pending",
  paidDate: new Date().toISOString().slice(0, 10),
  paidAmount: 0,
  adminPin: "",
};

// formatCurrency is provided by useCurrency() hook inside the component

function statusToneClass(tone: "paid" | "overdue" | "upcoming") {
  if (tone === "paid") return "text-green-600";
  if (tone === "overdue") return "text-red-600";
  return "text-amber-500";
}

function currentMonthKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function buildDueDate(monthKey: string, dueDay: number) {
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const safeMonth = Number.isFinite(month) ? month : 1;
  const safeYear = Number.isFinite(year) ? year : new Date().getFullYear();
  const lastDay = new Date(safeYear, safeMonth, 0).getDate();
  const day = Math.max(1, Math.min(lastDay, dueDay));
  return `${safeYear}-${String(safeMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isFrequencyColumnMissing(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lowered = message.toLowerCase();
  return lowered.includes("frequency") && lowered.includes("does not exist");
}

export default function BillsPage() {
  const { user, currentCompany } = useAuth();
  const { format: formatCurrency, currency: currencyCode } = useCurrency();
  const [searchParams, setSearchParams] = useSearchParams();
  const [bills, setBills] = useState<BillRow[]>([]);
  const [properties, setProperties] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<BillRow | null>(null);
  const [form, setForm] = useState<BillForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Dedicated Bill Payment Details & POP Modal
  const [paymentModalBill, setPaymentModalBill] = useState<BillRow | null>(null);
  const [popFile, setPopFile] = useState<File | null>(null);
  const [popPreview, setPopPreview] = useState<string>("");
  const [popStatus, setPopStatus] = useState<BillStatus>("pending");
  const [popPaidDate, setPopPaidDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [popPaidAmount, setPopPaidAmount] = useState<number>(0);
  const [popAdminPin, setPopAdminPin] = useState<string>("");
  const [updatingPayment, setUpdatingPayment] = useState<boolean>(false);

  const [deleteTarget, setDeleteTarget] = useState<BillRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [prefillConsumed, setPrefillConsumed] = useState(false);
  const [prefillPropertyId, setPrefillPropertyId] = useState("");
  const [flashMessage, setFlashMessage] = useState("");
  const [supportsFrequency, setSupportsFrequency] = useState(true);
  const [billsReportOpen, setBillsReportOpen] = useState(false);
  const [kpiListModal, setKpiListModal] = useState<"all" | "paid" | "pending" | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = 10;
  const totalPages = Math.ceil(bills.length / itemsPerPage);
  const paginatedBills = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return bills.slice(start, start + itemsPerPage);
  }, [bills, currentPage]);

  useEffect(() => {
    let cancelled = false;

    async function fetchSchedules() {
      const compId = currentCompany?.id;
      let q = supabase
        .from("property_bill_schedules")
        .select("id, title, property_id, category, amount, due_day, created_at, is_active, frequency, company_id, properties(name)")
        .eq("is_active", true)
        .order("title");
      if (compId && isValidUuid(compId)) {
        q = q.or(`company_id.eq.${compId},company_id.is.null`);
      }
      const res = await q;

      if (!res.error && res.data) {
        return res.data.map((row: any) => ({
          ...row,
          title: row.title || "Bill",
          frequency: (row.frequency ?? "monthly") as BillFrequency,
        }));
      }

      // Fallback
      let fb = supabase
        .from("property_bill_schedules")
        .select("id, title, property_id, amount, due_day, created_at, is_active, properties(name)")
        .eq("is_active", true)
        .order("title");
      if (compId && isValidUuid(compId)) {
        fb = fb.or(`company_id.eq.${compId},company_id.is.null`);
      }
      const fallback = await fb;

      if (fallback.error) throw fallback.error;
      setSupportsFrequency(false);
      return ((fallback.data ?? []) as ScheduleBaseRow[]).map((row) => ({ ...row, frequency: "monthly" as const }));
    }

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const compId = currentCompany?.id;
        let monthlyQ = supabase
          .from("property_monthly_bills")
          .select("id, schedule_id, property_id, month, due_date, amount, status, paid_at, executed_by_name")
          .order("month", { ascending: false });
        let propsQ = supabase.from("properties").select("id, name, type").order("name");
        if (compId && isValidUuid(compId)) {
          monthlyQ = monthlyQ.or(`company_id.eq.${compId},company_id.is.null`);
          propsQ = propsQ.or(`company_id.eq.${compId},company_id.is.null`);
        }

        let [scheduleRows, monthlyResult, propsResult] = await Promise.all([
          fetchSchedules(),
          monthlyQ,
          propsQ,
        ]);

        if (monthlyResult.error) {
          let fbMonthlyQ = supabase
            .from("property_monthly_bills")
            .select("id, schedule_id, property_id, month, due_date, amount, status, paid_at, executed_by_name")
            .order("month", { ascending: false });
          if (compId && isValidUuid(compId)) {
            fbMonthlyQ = fbMonthlyQ.or(`company_id.eq.${compId},company_id.is.null`);
          }
          monthlyResult = (await fbMonthlyQ) as any;
        }

        if (monthlyResult.error) throw monthlyResult.error;
        if (propsResult.error) throw propsResult.error;

        const scheduleIds = (scheduleRows ?? []).map((s: any) => String(s.id || "")).filter(Boolean);
        const creatorMap = new Map<string, { creatorName: string; createdAt: string }>();
        const popMap = new Map<string, { popUrl: string; confirmedBy: string }>();

        try {
          const { data: auditRows } = await supabase
            .from("audit_log")
            .select("entity_id, user_name, user_email, action, details, created_at")
            .or("entity_type.eq.property_bill_schedule,action.eq.bill_payment_confirmed")
            .order("created_at", { ascending: false })
            .limit(200);

          (auditRows ?? []).forEach((row: any) => {
            if (row.action === "bill_payment_confirmed") {
              let d: any = {};
              try {
                d = typeof row.details === "string" ? JSON.parse(row.details) : (row.details || {});
              } catch {}
              const pop = d.pop_url || "";
              const sid = String(row.entity_id || d.schedule_id || "");
              const month = String(d.month || "");
              const conf = String(d.confirmed_by_name || row.user_name || row.user_email || "Admin");
              if (pop || conf) {
                if (sid && month && !popMap.has(`${sid}_${month}`)) {
                  popMap.set(`${sid}_${month}`, { popUrl: pop, confirmedBy: conf });
                }
                if (sid && !popMap.has(sid)) {
                  popMap.set(sid, { popUrl: pop, confirmedBy: conf });
                }
              }
            } else {
              const eid = String(row.entity_id || "");
              if (eid && !creatorMap.has(eid)) {
                creatorMap.set(eid, {
                  creatorName: String(row.user_name || row.user_email || "Admin"),
                  createdAt: String(row.created_at || ""),
                });
              }
            }
          });
        } catch {}

        if (!cancelled) {
          const monthlyRows = (monthlyResult.data ?? []).map((row: any) => {
            const sid = String(row.schedule_id ?? "");
            const mKey = String(row.month ?? "");
            const auditInfo = popMap.get(`${sid}_${mKey}`) || popMap.get(sid);
            return {
              id: row.id ? String(row.id) : undefined,
              schedule_id: sid,
              month: mKey,
              due_date: String(row.due_date ?? ""),
              amount: Number(row.amount ?? 0),
              status: String(row.status ?? "pending"),
              paid_at: row.paid_at ? String(row.paid_at) : null,
              pop_url: row.pop_url || auditInfo?.popUrl || null,
              executed_by_name: row.executed_by_name ? String(row.executed_by_name) : null,
              confirmed_by_name: row.confirmed_by_name || auditInfo?.confirmedBy || row.executed_by_name || null,
            };
          }) as MonthlyBillRow[];

          const monthlyBySchedule = new Map<string, MonthlyBillRow[]>();
          monthlyRows.forEach((row) => {
            const existing = monthlyBySchedule.get(row.schedule_id) ?? [];
            existing.push(row);
            monthlyBySchedule.set(row.schedule_id, existing);
          });

          const monthKey = currentMonthKey();

          setBills(
            scheduleRows.map((row) => {
              const scheduleId = String(row.id ?? "");
              const scheduleRowsForId = monthlyBySchedule.get(scheduleId) ?? [];
              const currentCycle = scheduleRowsForId.find((item) => item.month === monthKey);
              const latestPaid = scheduleRowsForId.find((item) => item.status === "paid" && Boolean(item.paid_at));
              const currentPaid = currentCycle?.status === "paid";
              const frequency = (row.frequency ?? "monthly") as BillFrequency;

              const creatorInfo = creatorMap.get(scheduleId);
              const createdByName = String(row.created_by_name || creatorInfo?.creatorName || "Staff Admin");
              const createdAt = String(row.created_at || creatorInfo?.createdAt || "");
              const confirmedByName = String(currentCycle?.confirmed_by_name || currentCycle?.executed_by_name || latestPaid?.confirmed_by_name || latestPaid?.executed_by_name || (currentPaid ? "Admin" : ""));
              const popUrl = String(currentCycle?.pop_url || latestPaid?.pop_url || "");

              return {
                id: scheduleId,
                name: String(row.title ?? "Unnamed Bill"),
                propertyId: String(row.property_id ?? ""),
                propertyName: String((row.properties as { name?: string } | null)?.name ?? "Unknown Property"),
                amount: Number(row.amount ?? 0),
                frequency,
                dueDay: Number(row.due_day ?? 1),
                status: currentPaid ? "paid" : "pending",
                startDate: String(currentCycle?.due_date ?? row.created_at ?? `${monthKey}-01`),
                lastPaidDate: currentPaid
                  ? String((currentCycle?.paid_at ?? "").slice(0, 10))
                  : String((latestPaid?.paid_at ?? "").slice(0, 10)),
                lastPaidAmount: currentPaid
                  ? Number(currentCycle?.amount ?? 0)
                  : Number(latestPaid?.amount ?? 0),
                createdByName,
                createdAt,
                confirmedByName,
                popUrl,
                currentMonthlyId: currentCycle?.id || latestPaid?.id,
              } satisfies BillRow;
            }),
          );

          setProperties((propsResult.data ?? []).map((row) => ({ id: String(row.id), name: String(row.name ?? "Unnamed") })));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Could not load bills.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadData();
    return () => {
      cancelled = true;
    };
  }, [reloadKey, currentCompany?.id]);

  const reload = () => setReloadKey((value) => value + 1);

  const openCreate = (propertyId = "") => {
    setEditingBill(null);
    setForm({
      ...emptyForm,
      propertyId,
      dueDay: Number(new Date().toISOString().slice(8, 10)),
      paidDate: new Date().toISOString().slice(0, 10),
      frequency: supportsFrequency ? "monthly" : "monthly",
    });
    setModalOpen(true);
  };

  useEffect(() => {
    if (prefillConsumed) return;

    const shouldCreate = searchParams.get("create") === "1";
    const propertyId = searchParams.get("propertyId") ?? "";

    if (shouldCreate) {
      openCreate(propertyId);
      setPrefillPropertyId(propertyId);
      setPrefillConsumed(true);

      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("create");
      nextParams.delete("propertyId");
      setSearchParams(nextParams, { replace: true });
    }
  }, [prefillConsumed, searchParams, setSearchParams]);

  useEffect(() => {
    if (!prefillPropertyId || properties.length === 0) return;

    const matchedProperty = properties.find((property) => property.id === prefillPropertyId);
    if (matchedProperty) {
      setFlashMessage(`Creating bill for ${matchedProperty.name}`);
      setPrefillPropertyId("");
    }
  }, [prefillPropertyId, properties]);

  useEffect(() => {
    if (!flashMessage) return;
    const timer = window.setTimeout(() => setFlashMessage(""), 3500);
    return () => window.clearTimeout(timer);
  }, [flashMessage]);

  const openEdit = (bill: BillRow) => {
    setEditingBill(bill);
    setForm({
      name: bill.name,
      propertyId: bill.propertyId,
      frequency: bill.frequency,
      dueDay: bill.dueDay,
      amount: bill.amount,
      status: bill.status,
      paidDate: bill.lastPaidDate || new Date().toISOString().slice(0, 10),
      paidAmount: bill.lastPaidAmount || bill.amount,
      adminPin: "",
    });
    setModalOpen(true);
  };

  const upsertCurrentMonthStatus = async (scheduleId: string) => {
    const monthKey = currentMonthKey();
    const admin = await fetchAdminInfo(user?.email ?? undefined);
    const executorName = admin.fullName || user?.email || "Admin";
    const { data: existingMonthly, error: existingMonthlyError } = await supabase
      .from("property_monthly_bills")
      .select("id")
      .eq("schedule_id", scheduleId)
      .eq("month", monthKey)
      .maybeSingle();

    if (existingMonthlyError) throw existingMonthlyError;

    const compId = currentCompany?.id && isValidUuid(currentCompany.id) ? currentCompany.id : null;
    const monthlyPayload: Record<string, unknown> = {
      schedule_id: scheduleId,
      property_id: form.propertyId,
      month: monthKey,
      due_date: buildDueDate(monthKey, form.dueDay),
      amount: form.status === "paid" ? form.paidAmount : form.amount,
      status: form.status,
      paid_at: form.status === "paid" ? (form.paidDate ? new Date(form.paidDate).toISOString() : new Date().toISOString()) : null,
      executed_by_name: executorName,
      company_id: compId,
    };

    if (existingMonthly?.id) {
      const { error: updateMonthlyError } = await supabase
        .from("property_monthly_bills")
        .update(monthlyPayload)
        .eq("id", existingMonthly.id);
      if (updateMonthlyError) throw updateMonthlyError;
    } else {
      const { error: insertMonthlyError } = await supabase.from("property_monthly_bills").insert(monthlyPayload);
      if (insertMonthlyError) throw insertMonthlyError;
    }
  };

  const onSave = async () => {
    if (!form.name.trim()) {
      alert("Please enter a bill name.");
      return;
    }

    if (!form.propertyId) {
      alert("Please assign a property.");
      return;
    }

    if (form.amount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    if (form.dueDay < 1 || form.dueDay > 31) {
      alert("Due day must be between 1 and 31.");
      return;
    }

    if (form.status === "paid" && form.paidAmount <= 0) {
      alert("Please enter a valid paid amount.");
      return;
    }

    setSaving(true);

    try {
      const currentEditingBill = editingBill;
      const statusChanged = currentEditingBill ? currentEditingBill.status !== form.status : false;
      if (statusChanged) {
        const pinOk = await verifyAdminPin(form.adminPin);
        if (!pinOk) {
          alert("Invalid admin PIN. Status change denied.");
          return;
        }
      }

      const scheduleBase: Record<string, unknown> = {
        title: form.name,
        property_id: form.propertyId,
        category: "other",
        amount: form.amount,
        due_day: form.dueDay,
        is_active: true,
        company_id: currentCompany?.id && isValidUuid(currentCompany.id) ? currentCompany.id : null,
      };

      const saveSchedule = async (withFrequency: boolean) => {
        const payload = withFrequency ? { ...scheduleBase, frequency: form.frequency } : scheduleBase;

        if (currentEditingBill) {
          const { error: updateError } = await supabase.from("property_bill_schedules").update(payload).eq("id", currentEditingBill.id);
          if (updateError) throw updateError;
          return currentEditingBill.id;
        }

        const { data: insertedSchedule, error: insertError } = await supabase
          .from("property_bill_schedules")
          .insert(payload)
          .select("id")
          .single();
        if (insertError) throw insertError;
        return String(insertedSchedule.id);
      };

      let scheduleId = "";
      try {
        scheduleId = await saveSchedule(supportsFrequency);
      } catch (scheduleError) {
        if (!supportsFrequency || !isFrequencyColumnMissing(scheduleError)) throw scheduleError;
        setSupportsFrequency(false);
        scheduleId = await saveSchedule(false);
      }

      await upsertCurrentMonthStatus(scheduleId);

      await supabase.from("audit_log").insert({
        user_email: user?.email || "admin@paimbabook.com",
        user_name: user?.user_metadata?.full_name || user?.email || "Admin",
        action: currentEditingBill ? "bill_schedule_updated" : "bill_schedule_created",
        entity_type: "property_bill_schedule",
        entity_id: scheduleId,
        company_id: currentCompany?.id && isValidUuid(currentCompany.id) ? currentCompany.id : null,
        details: {
          title: form.name,
          property_id: form.propertyId,
          amount: form.amount,
          frequency: form.frequency,
        },
      });

      setModalOpen(false);
      reload();
    } catch (saveError) {
      alert(saveError instanceof Error ? saveError.message : "Could not save bill.");
    } finally {
      setSaving(false);
    }
  };

  const openPaymentModal = (bill: BillRow) => {
    setPaymentModalBill(bill);
    setPopStatus(bill.status);
    setPopPaidDate(bill.lastPaidDate || new Date().toISOString().slice(0, 10));
    setPopPaidAmount(bill.lastPaidAmount || bill.amount);
    setPopPreview(bill.popUrl || "");
    setPopFile(null);
    setPopAdminPin("");
  };

  const handleSavePaymentDetails = async () => {
    if (!paymentModalBill) return;

    if (popStatus === "paid" && popPaidAmount <= 0) {
      alert("Please enter a valid paid amount.");
      return;
    }

    const pinOk = await verifyAdminPin(popAdminPin);
    if (!pinOk) {
      alert("Invalid admin PIN. Verification failed.");
      return;
    }

    setUpdatingPayment(true);
    try {
      let finalPopUrl = popPreview;
      if (popFile) {
        finalPopUrl = await uploadFileToBucket("property-photos", "bills/pop", popFile);
      }

      const monthKey = currentMonthKey();
      const admin = await fetchAdminInfo(user?.email ?? undefined);
      const executorName = admin.fullName || user?.user_metadata?.full_name || user?.email || "Admin";
      const compId = currentCompany?.id && isValidUuid(currentCompany.id) ? currentCompany.id : null;

      const { data: existingMonthly } = await supabase
        .from("property_monthly_bills")
        .select("id")
        .eq("schedule_id", paymentModalBill.id)
        .eq("month", monthKey)
        .maybeSingle();

      const monthlyPayload: Record<string, unknown> = {
        schedule_id: paymentModalBill.id,
        property_id: paymentModalBill.propertyId,
        month: monthKey,
        due_date: buildDueDate(monthKey, paymentModalBill.dueDay),
        amount: popStatus === "paid" ? popPaidAmount : paymentModalBill.amount,
        status: popStatus,
        paid_at: popStatus === "paid" ? (popPaidDate ? new Date(popPaidDate).toISOString() : new Date().toISOString()) : null,
        executed_by_name: executorName,
        company_id: compId,
      };

      if (existingMonthly?.id) {
        const { error: updErr } = await supabase.from("property_monthly_bills").update(monthlyPayload).eq("id", existingMonthly.id);
        if (updErr) console.warn("Could not update monthly bill", updErr);
      } else {
        const { error: insErr } = await supabase.from("property_monthly_bills").insert(monthlyPayload);
        if (insErr) console.warn("Could not insert monthly bill", insErr);
      }

      await supabase.from("audit_log").insert({
        user_email: user?.email || "admin@paimbabook.com",
        user_name: executorName,
        action: "bill_payment_confirmed",
        entity_type: "property_monthly_bill",
        entity_id: paymentModalBill.id,
        company_id: compId,
        details: {
          schedule_id: paymentModalBill.id,
          bill_name: paymentModalBill.name,
          property_id: paymentModalBill.propertyId,
          month: monthKey,
          amount: popStatus === "paid" ? popPaidAmount : paymentModalBill.amount,
          status: popStatus,
          pop_url: finalPopUrl || null,
          confirmed_by_name: executorName,
        },
      });

      setPaymentModalBill(null);
      reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update payment status and POP");
    } finally {
      setUpdatingPayment(false);
    }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error: clearMonthlyError } = await supabase.from("property_monthly_bills").delete().eq("schedule_id", deleteTarget.id);
      if (clearMonthlyError) throw clearMonthlyError;
      const { error: deleteScheduleError } = await supabase.from("property_bill_schedules").delete().eq("id", deleteTarget.id);
      if (deleteScheduleError) throw deleteScheduleError;
      setDeleteTarget(null);
      reload();
    } catch (deleteError) {
      alert(deleteError instanceof Error ? deleteError.message : "Could not delete bill.");
    } finally {
      setDeleting(false);
    }
  };

  const paidCount = useMemo(() => bills.filter((bill) => bill.status === "paid").length, [bills]);

  return (
    <ModulePage title="Bills" description="Create recurring property bills and track payment status/countdowns.">
      {loading && <LoadingState label="Loading bills..." />}
      {!loading && error && <ErrorState message={error} onRetry={reload} />}

      {!loading && !error && (
        <section className="space-y-4 rounded-lg border border-border-color bg-surface p-4">
          {flashMessage && (
            <div className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm text-muted">
              {flashMessage}
            </div>
          )}

          {!supportsFrequency && (
            <div className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-xs text-muted">
              Frequency column not found on schedule table. Bills are running in monthly-compatible mode.
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => setKpiListModal("all")}
                className="text-left rounded-xl border border-border-color bg-surface-elevated p-3 hover:border-blue-500/50 hover:bg-surface transition shadow-xs group"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted group-hover:text-foreground font-semibold">Total Bills</p>
                  <ExternalLink size={12} className="text-muted/40 group-hover:text-blue-600" />
                </div>
                <p className="text-lg font-black text-foreground mt-0.5">{bills.length}</p>
                <p className="text-[10px] text-muted">Click to view all →</p>
              </button>

              <button
                type="button"
                onClick={() => setKpiListModal("paid")}
                className="text-left rounded-xl border border-border-color bg-surface-elevated p-3 hover:border-emerald-500/50 hover:bg-surface transition shadow-xs group"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted group-hover:text-foreground font-semibold">Paid</p>
                  <ExternalLink size={12} className="text-muted/40 group-hover:text-emerald-600" />
                </div>
                <p className="text-lg font-black text-emerald-600 mt-0.5">{paidCount}</p>
                <p className="text-[10px] text-muted">Click to view paid →</p>
              </button>

              <button
                type="button"
                onClick={() => setKpiListModal("pending")}
                className="text-left rounded-xl border border-border-color bg-surface-elevated p-3 hover:border-amber-500/50 hover:bg-surface transition shadow-xs group"
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted group-hover:text-foreground font-semibold">Pending</p>
                  <ExternalLink size={12} className="text-muted/40 group-hover:text-amber-600" />
                </div>
                <p className="text-lg font-black text-amber-600 mt-0.5">{Math.max(0, bills.length - paidCount)}</p>
                <p className="text-[10px] text-muted">Click to view pending →</p>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBillsReportOpen(true)}
                className="flex items-center gap-1.5 rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-sm font-semibold text-foreground hover:bg-surface transition shadow-xs"
                title="Generate, Preview, Print or Share Bills Report"
              >
                <FileText size={16} className="text-blue-600" />
                <span>Bills Report</span>
              </button>

              <button
                type="button"
                onClick={() => openCreate()}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-xs hover:bg-blue-700 transition"
              >
                <span>Create Bill</span>
              </button>
            </div>
          </div>

          {bills.length === 0 ? (
            <EmptyState title="No bills yet" description="Create your first recurring bill." />
          ) : (
            <>
              <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border-color text-left text-muted">
                    <th className="px-3 py-2 font-medium">Bill</th>
                    <th className="px-3 py-2 font-medium">Property</th>
                    <th className="px-3 py-2 font-medium">Frequency</th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Created By</th>
                    <th className="px-3 py-2 font-medium">Payment & POP</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBills.map((bill) => {
                    const meta = billStatusMeta(bill);
                    return (
                      <tr
                        key={bill.id}
                        onClick={() => openPaymentModal(bill)}
                        className="border-b border-border-color/60 hover:bg-surface-elevated/40 cursor-pointer transition"
                      >
                        <td className="px-3 py-3 font-medium text-foreground">{bill.name}</td>
                        <td className="px-3 py-3 text-muted">{bill.propertyName}</td>
                        <td className="px-3 py-3 text-muted">{frequencyLabel(bill.frequency)} (day {String(bill.dueDay).padStart(2, "0")})</td>
                        <td className="px-3 py-3 text-muted font-medium">{formatCurrency(bill.amount)}</td>
                        <td className={`px-3 py-3 font-medium ${statusToneClass(meta.tone)}`}>{meta.text}</td>
                        <td className="px-3 py-3 text-muted text-xs">
                          <span className="font-semibold text-foreground block">{bill.createdByName || "Staff Admin"}</span>
                          {bill.createdAt && <span className="text-[10px] text-muted">{new Date(bill.createdAt).toLocaleDateString()}</span>}
                        </td>
                        <td className="px-3 py-3 text-xs">
                          {bill.status === "paid" ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                                <CheckCircle size={12} />
                                <span>Confirmed by {bill.confirmedByName || "Admin"}</span>
                              </span>
                              {bill.popUrl ? (
                                <a
                                  href={bill.popUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:underline bg-blue-500/10 px-2 py-0.5 rounded-md w-fit"
                                >
                                  <Paperclip size={11} />
                                  <span>View POP</span>
                                  <ExternalLink size={10} />
                                </a>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); openPaymentModal(bill); }}
                                  className="flex items-center gap-1 text-[10px] font-semibold text-muted hover:text-blue-500 bg-surface-elevated px-2 py-0.5 rounded-md border border-border-color/60 w-fit"
                                >
                                  <Upload size={10} />
                                  <span>Upload POP</span>
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-muted text-xs font-medium">
                              <Clock size={12} className="text-amber-500" />
                              <span>Pending confirmation</span>
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => openPaymentModal(bill)}
                              className="rounded-md border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-500/20 transition"
                              title="View or update payment status and upload Proof of Payment"
                            >
                              Payment / POP
                            </button>
                            <button type="button" onClick={() => openEdit(bill)} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Edit</button>
                            <button type="button" onClick={() => setDeleteTarget(bill)} className="rounded-md border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated">Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="border-t border-border-color p-3 bg-surface">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                  totalItems={bills.length}
                  itemsPerPage={itemsPerPage}
                />
              </div>
            )}
            </>
          )}
        </section>
      )}

      {/* CREATE / EDIT BILL SCHEDULE MODAL */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingBill ? "Edit Bill" : "Create Bill"}>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-sm text-muted">Bill name</label>
            <input value={form.name} onChange={(event) => setForm((previous) => ({ ...previous, name: event.target.value }))} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" />
          </div>

          <div>
            <label className="mb-1 block text-sm text-muted">Property</label>
            <select value={form.propertyId} onChange={(event) => setForm((previous) => ({ ...previous, propertyId: event.target.value }))} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
              <option value="">Select property...</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>{property.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-muted">Frequency</label>
            <select
              value={form.frequency}
              onChange={(event) => setForm((previous) => ({ ...previous, frequency: event.target.value as BillFrequency }))}
              disabled={!supportsFrequency}
              className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none disabled:opacity-70"
            >
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="semi_annual">6 Months</option>
              <option value="annual">Annual</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm text-muted">Payment day of month (e.g. 03 or 30)</label>
            <input type="number" min={1} max={31} value={form.dueDay} onChange={(event) => setForm((previous) => ({ ...previous, dueDay: Number(event.target.value) }))} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" />
          </div>

          <div>
            <label className="mb-1 block text-sm text-muted">Default amount ({currencyCode})</label>
            <input type="number" min={0} value={form.amount} onChange={(event) => setForm((previous) => ({ ...previous, amount: Number(event.target.value), paidAmount: previous.paidAmount || Number(event.target.value) }))} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" />
          </div>

          <div>
            <label className="mb-1 block text-sm text-muted">Current cycle status</label>
            <select value={form.status} onChange={(event) => setForm((previous) => ({ ...previous, status: event.target.value as BillStatus }))} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none">
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
            </select>
          </div>

          {form.status === "paid" && (
            <>
              <div>
                <label className="mb-1 block text-sm text-muted">Paid date</label>
                <input type="date" value={form.paidDate} onChange={(event) => setForm((previous) => ({ ...previous, paidDate: event.target.value }))} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-muted">Amount paid (default editable)</label>
                <input type="number" min={0} value={form.paidAmount || form.amount} onChange={(event) => setForm((previous) => ({ ...previous, paidAmount: Number(event.target.value) }))} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" />
              </div>
            </>
          )}

          {editingBill && editingBill.status !== form.status && (
            <div>
              <label className="mb-1 block text-sm text-muted">Admin PIN (required for status change)</label>
              <input type="password" value={form.adminPin} onChange={(event) => setForm((previous) => ({ ...previous, adminPin: event.target.value }))} className="w-full rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none" />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-md border border-border-color px-3 py-2 text-sm">Cancel</button>
            <button type="button" onClick={onSave} disabled={saving} className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium disabled:opacity-50">
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </Modal>

      {/* BILL PAYMENT STATUS & PROOF OF PAYMENT (POP) MODAL */}
      <Modal
        open={Boolean(paymentModalBill)}
        onClose={() => setPaymentModalBill(null)}
        title={paymentModalBill ? `Payment Status & POP - ${paymentModalBill.name}` : "Bill Payment Details"}
      >
        {paymentModalBill && (
          <div className="space-y-4 text-sm">
            <div className="rounded-xl border border-border-color bg-surface-elevated p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-foreground text-base">{paymentModalBill.name}</span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${paymentModalBill.status === "paid" ? "bg-emerald-500/15 text-emerald-600 border border-emerald-500/30" : "bg-amber-500/15 text-amber-600 border border-amber-500/30"}`}>
                  {paymentModalBill.status === "paid" ? "Paid" : "Pending"}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-muted">
                <div>
                  <span className="text-[10px] uppercase tracking-wider block font-medium">Property</span>
                  <span className="font-semibold text-foreground">{paymentModalBill.propertyName}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider block font-medium">Cycle Amount</span>
                  <span className="font-semibold text-foreground">{formatCurrency(paymentModalBill.amount)}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider block font-medium">Created By</span>
                  <span className="font-semibold text-foreground">{paymentModalBill.createdByName || "Staff Admin"}</span>
                  {paymentModalBill.createdAt && <span className="block text-[10px] text-muted">{new Date(paymentModalBill.createdAt).toLocaleDateString()}</span>}
                </div>
                <div>
                  <span className="text-[10px] uppercase tracking-wider block font-medium">Frequency</span>
                  <span className="font-semibold text-foreground">{frequencyLabel(paymentModalBill.frequency)} (day {String(paymentModalBill.dueDay).padStart(2, "0")})</span>
                </div>
              </div>
            </div>

            {/* Payment Update Form */}
            <div className="space-y-3 pt-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted">Update Current Cycle Payment</h3>

              <div>
                <label className="mb-1 block text-xs text-muted font-medium">Payment Status</label>
                <select
                  value={popStatus}
                  onChange={(e) => setPopStatus(e.target.value as BillStatus)}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none font-medium"
                >
                  <option value="pending">Pending Payment</option>
                  <option value="paid">Paid &amp; Confirmed</option>
                </select>
              </div>

              {popStatus === "paid" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-muted font-medium">Paid Date</label>
                    <input
                      type="date"
                      value={popPaidDate}
                      onChange={(e) => setPopPaidDate(e.target.value)}
                      className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-muted font-medium">Amount Paid ({currencyCode})</label>
                    <input
                      type="number"
                      min={0}
                      value={popPaidAmount}
                      onChange={(e) => setPopPaidAmount(Number(e.target.value))}
                      className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Proof of Payment (POP) Upload / Preview */}
              <div>
                <label className="mb-1 block text-xs text-muted font-medium">Proof of Payment (POP)</label>
                {popPreview && (
                  <div className="mb-2 p-2.5 rounded-xl border border-border-color bg-surface-elevated flex items-center justify-between">
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Paperclip size={15} className="text-blue-500 shrink-0" />
                      <span className="text-xs font-medium truncate max-w-[220px]">
                        {popFile ? popFile.name : "Current Proof of Payment"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={popPreview}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline font-bold"
                      >
                        <Eye size={13} />
                        <span>View</span>
                      </a>
                    </div>
                  </div>
                )}

                <div className="relative">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    id="bill-pop-file"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setPopFile(file);
                        setPopPreview(URL.createObjectURL(file));
                      }
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="bill-pop-file"
                    className="flex items-center justify-center gap-2 w-full cursor-pointer rounded-xl border border-dashed border-border-color p-3 text-xs text-muted hover:border-blue-500 hover:text-blue-500 hover:bg-surface-elevated transition"
                  >
                    <Upload size={14} />
                    <span>{popPreview ? "Change Proof of Payment File" : "Upload POP Document or Screenshot (PDF / Image)"}</span>
                  </label>
                </div>
              </div>

              {/* PIN requirement when updating status */}
              <div>
                <label className="mb-1 block text-xs text-muted font-medium">Admin PIN (Required to confirm changes)</label>
                <input
                  type="password"
                  placeholder="Enter Admin PIN"
                  value={popAdminPin}
                  onChange={(e) => setPopAdminPin(e.target.value)}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-sm outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border-color">
                <button
                  type="button"
                  onClick={() => setPaymentModalBill(null)}
                  className="rounded-xl border border-border-color px-4 py-2 text-xs font-semibold text-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={updatingPayment}
                  onClick={() => void handleSavePaymentDetails()}
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-bold text-white transition disabled:opacity-50"
                >
                  {updatingPayment ? "Saving Payment..." : "Save Payment & POP"}
                </button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={onDelete} title="Delete Bill" message={`Delete bill \"${deleteTarget?.name}\"?`} confirmLabel="Delete" loading={deleting} />

      {/* Bills Report Modal */}
      <BillsReportModal
        isOpen={billsReportOpen}
        onClose={() => setBillsReportOpen(false)}
        bills={bills}
        companyName={currentCompany.name}
      />

      {/* KPI Filtered Bills Modal */}
      <Modal
        open={Boolean(kpiListModal)}
        onClose={() => setKpiListModal(null)}
        title={
          kpiListModal === "paid"
            ? `Paid Recurring Bills (${bills.filter((b) => b.status === "paid").length})`
            : kpiListModal === "pending"
            ? `Pending Scheduled Bills (${bills.filter((b) => b.status !== "paid").length})`
            : `All Scheduled Bills (${bills.length})`
        }
      >
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {(() => {
            const list = bills.filter((b) => {
              if (kpiListModal === "paid") return b.status === "paid";
              if (kpiListModal === "pending") return b.status !== "paid";
              return true;
            });

            if (list.length === 0) {
              return <p className="text-xs text-muted py-6 text-center">No bills found.</p>;
            }

            return (
              <div className="divide-y divide-border-color border border-border-color rounded-xl overflow-hidden text-xs">
                {list.map((b) => (
                  <div
                    key={b.id}
                    onClick={() => {
                      setKpiListModal(null);
                      openPaymentModal(b);
                    }}
                    className="p-3 hover:bg-surface-elevated/40 transition flex items-center justify-between gap-3 cursor-pointer"
                  >
                    <div>
                      <p className="font-bold text-foreground">{b.name}</p>
                      <p className="text-muted mt-0.5">{b.propertyName} • Due Day {b.dueDay}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-foreground">{formatCurrency(b.amount)}</p>
                      <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        b.status === "paid" ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600"
                      }`}>
                        {b.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            );
          })()}

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setKpiListModal(null)}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-border-color bg-surface-elevated text-foreground hover:bg-surface transition"
            >
              Close
            </button>
          </div>
        </div>
      </Modal>
    </ModulePage>
  );
}


