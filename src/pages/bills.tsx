import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ModulePage } from "@/components/module-page";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { Modal, ConfirmDialog } from "@/components/modal";
import { supabase } from "@/lib/supabase";
import { verifyAdminPin, isValidUuid } from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { fetchAdminInfo } from "@/lib/storage";
import { billStatusMeta, frequencyLabel, type BillFrequency, type BillRow, type BillStatus } from "@/lib/bills";

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
  properties: { name?: string } | null;
  frequency?: BillFrequency;
};

type MonthlyBillRow = {
  schedule_id: string;
  month: string;
  due_date: string;
  amount: number;
  status: string;
  paid_at: string | null;
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

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-ZA", { style: "currency", currency: "NAD", maximumFractionDigits: 0 }).format(amount);
}

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

  const [deleteTarget, setDeleteTarget] = useState<BillRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [prefillConsumed, setPrefillConsumed] = useState(false);
  const [prefillPropertyId, setPrefillPropertyId] = useState("");
  const [flashMessage, setFlashMessage] = useState("");
  const [supportsFrequency, setSupportsFrequency] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchSchedules() {
      const res = await supabase
        .from("property_bill_schedules")
        .select("id, name, property_id, amount, due_day, created_at, is_active, properties(name)")
        .eq("is_active", true)
        .order("name");

      if (!res.error && res.data) {
        return res.data.map((row) => ({
          ...row,
          title: row.name,
          frequency: "monthly" as const,
        }));
      }

      const fallback = await supabase
        .from("property_bill_schedules")
        .select("id, title, property_id, amount, due_day, created_at, is_active, properties(name)")
        .eq("is_active", true)
        .order("title");

      if (fallback.error) throw fallback.error;
      setSupportsFrequency(false);
      return ((fallback.data ?? []) as ScheduleBaseRow[]).map((row) => ({ ...row, frequency: "monthly" as const }));
    }

    async function loadData() {
      setLoading(true);
      setError(null);

      try {
        const [scheduleRows, monthlyResult, propsResult] = await Promise.all([
          fetchSchedules(),
          supabase
            .from("property_monthly_bills")
            .select("schedule_id, month, amount, status, paid_date")
            .order("month", { ascending: false }),
          supabase.from("properties").select("id, name").order("name"),
        ]);

        if (monthlyResult.error) throw monthlyResult.error;
        if (propsResult.error) throw propsResult.error;

        if (!cancelled) {
          const monthlyRows = (monthlyResult.data ?? []).map((row) => ({
            schedule_id: String(row.schedule_id ?? ""),
            month: String(row.month ?? ""),
            due_date: "",
            amount: Number(row.amount ?? 0),
            status: String(row.status ?? "pending"),
            paid_at: row.paid_date ? String(row.paid_date) : null,
          })) as MonthlyBillRow[];

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
  }, [reloadKey]);

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
      month: monthKey,
      amount: form.status === "paid" ? form.paidAmount : form.amount,
      status: form.status,
      paid_date: form.status === "paid" ? form.paidDate : null,
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
        name: form.name,
        property_id: form.propertyId,
        category: "other",
        amount: form.amount,
        due_day: form.dueDay,
        is_active: true,
        company_id: currentCompany.id,
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

      setModalOpen(false);
      reload();
    } catch (saveError) {
      alert(saveError instanceof Error ? saveError.message : "Could not save bill.");
    } finally {
      setSaving(false);
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
              <article className="rounded-md border border-border-color bg-surface-elevated p-3">
                <p className="text-xs text-muted">Total Bills</p>
                <p className="text-lg font-semibold">{bills.length}</p>
              </article>
              <article className="rounded-md border border-border-color bg-surface-elevated p-3">
                <p className="text-xs text-muted">Paid</p>
                <p className="text-lg font-semibold">{paidCount}</p>
              </article>
              <article className="rounded-md border border-border-color bg-surface-elevated p-3">
                <p className="text-xs text-muted">Pending</p>
                <p className="text-lg font-semibold">{Math.max(0, bills.length - paidCount)}</p>
              </article>
            </div>
            <button
              type="button"
              onClick={() => openCreate()}
              className="rounded-md border border-border-color bg-surface-elevated px-3 py-2 text-sm font-medium"
            >
              Create Bill
            </button>
          </div>

          {bills.length === 0 ? (
            <EmptyState title="No bills yet" description="Create your first recurring bill." />
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border-color text-left text-muted">
                    <th className="px-3 py-2 font-medium">Bill</th>
                    <th className="px-3 py-2 font-medium">Property</th>
                    <th className="px-3 py-2 font-medium">Frequency</th>
                    <th className="px-3 py-2 font-medium">Amount</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bills.map((bill) => {
                    const meta = billStatusMeta(bill);
                    return (
                      <tr key={bill.id} className="border-b border-border-color/60">
                        <td className="px-3 py-3 font-medium">{bill.name}</td>
                        <td className="px-3 py-3 text-muted">{bill.propertyName}</td>
                        <td className="px-3 py-3 text-muted">{frequencyLabel(bill.frequency)} (day {String(bill.dueDay).padStart(2, "0")})</td>
                        <td className="px-3 py-3 text-muted">{formatCurrency(bill.amount)}</td>
                        <td className={`px-3 py-3 font-medium ${statusToneClass(meta.tone)}`}>{meta.text}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap gap-2">
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
          )}
        </section>
      )}

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
            <label className="mb-1 block text-sm text-muted">Default amount (NAD)</label>
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

      <ConfirmDialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={onDelete} title="Delete Bill" message={`Delete bill \"${deleteTarget?.name}\"?`} confirmLabel="Delete" loading={deleting} />
    </ModulePage>
  );
}
