import { SupabaseClient } from "@supabase/supabase-js";
import { isValidUuid } from "./data";

export interface RentPaymentItem {
  id: string;
  tenantId?: string;
  paymentDate: string;
  amountPaid: number;
  paymentMethod?: string;
  paidMonths?: string[] | null;
  paidMonth?: string | null;
  popUrl?: string | null;
  notes?: string | null;
  executedByName?: string | null;
  popUploadedByName?: string | null;
  popUploadedAt?: string | null;
  createdAt?: string | null;
  invoiceId?: string | null;
  invoicePdfUrl?: string | null;
  isSuppressed?: boolean;
  suppressedAt?: string | null;
  suppressedBy?: string | null;
  suppressedReason?: string | null;
  isAdvance?: boolean;
  advanceMonths?: string[] | null;
}

/**
 * Checks if a payment record is suppressed (voided).
 * Suppressed records are preserved for audit history but strictly excluded
 * from accounting, finance totals, and rent fulfillment calculations.
 */
export function isPaymentSuppressed(payment: any): boolean {
  if (!payment) return false;
  if (payment.is_suppressed === true || payment.isSuppressed === true) return true;
  if (payment.status === "suppressed" || payment.status === "void") return true;
  const notes = String(payment.notes || "");
  if (notes.includes("[SUPPRESSED]") || notes.includes("[SUPPRESSED:")) return true;
  return false;
}

/**
 * Checks if a payment record is marked as an advance payment.
 */
export function isPaymentAdvance(payment: any): boolean {
  if (!payment) return false;
  if (payment.is_advance === true || payment.isAdvance === true) return true;
  const notes = String(payment.notes || "");
  if (notes.includes("[ADVANCE PAYMENT") || notes.includes("[ADVANCE:")) return true;
  const months = getPaymentMonths(payment);
  return months.length > 1;
}

/**
 * Extracts normalized YYYY-MM billing month strings covered by this payment.
 */
export function getPaymentMonths(payment: any): string[] {
  if (!payment) return [];
  const results = new Set<string>();

  if (Array.isArray(payment.paid_months)) {
    payment.paid_months.forEach((m: any) => {
      if (typeof m === "string" && m.trim().length >= 7) results.add(m.trim().slice(0, 7));
    });
  }
  if (Array.isArray(payment.paidMonths)) {
    payment.paidMonths.forEach((m: any) => {
      if (typeof m === "string" && m.trim().length >= 7) results.add(m.trim().slice(0, 7));
    });
  }
  if (Array.isArray(payment.advance_months)) {
    payment.advance_months.forEach((m: any) => {
      if (typeof m === "string" && m.trim().length >= 7) results.add(m.trim().slice(0, 7));
    });
  }
  if (Array.isArray(payment.advanceMonths)) {
    payment.advanceMonths.forEach((m: any) => {
      if (typeof m === "string" && m.trim().length >= 7) results.add(m.trim().slice(0, 7));
    });
  }

  const singleMonth = payment.paid_month || payment.paidMonth;
  if (typeof singleMonth === "string" && singleMonth.trim().length >= 7) {
    results.add(singleMonth.trim().slice(0, 7));
  }

  // Look into notes for advance months or YYYY-MM
  const notes = String(payment.notes || "");
  const advanceMatch = notes.match(/\[ADVANCE PAYMENT:\s*([^\]]+)\]/i);
  if (advanceMatch && advanceMatch[1]) {
    advanceMatch[1].split(",").forEach((s) => {
      const trimmed = s.trim().slice(0, 7);
      if (/^\d{4}-\d{2}$/.test(trimmed)) results.add(trimmed);
    });
  }

  // Fallback to payment_date or paymentDate
  if (results.size === 0) {
    const pDate = payment.payment_date || payment.paymentDate;
    if (typeof pDate === "string" && pDate.length >= 7) {
      results.add(pDate.slice(0, 7));
    }
  }

  return Array.from(results);
}

/**
 * Checks if a payment covers or matches a target billing month (YYYY-MM).
 */
export function paymentMatchesMonth(payment: any, targetMonth: string): boolean {
  if (!payment || !targetMonth) return false;
  const target = targetMonth.slice(0, 7);
  const months = getPaymentMonths(payment);
  if (months.includes(target)) return true;

  const notes = String(payment.notes || "");
  if (notes.includes(target)) return true;

  const pDate = payment.payment_date || payment.paymentDate;
  if (typeof pDate === "string" && pDate.startsWith(target)) return true;

  return false;
}

export interface MonthRentCalculation {
  targetMonth: string;
  allocatedRent: number;
  totalPaid: number; // Sum of active (non-suppressed) payments
  remainingDue: number;
  isFullyPaid: boolean;
  isPartial: boolean;
  activePayments: any[];
  suppressedPayments: any[];
  allPaymentsForMonth: any[];
}

/**
 * Calculates rent fulfillment, totals, remaining balance, and itemized entries
 * for a specific tenant and target billing month.
 * Suppressed payments are segregated and excluded from totalPaid.
 */
export function calculateMonthRentState(params: {
  monthlyRent: number;
  payments: any[];
  targetMonth: string;
}): MonthRentCalculation {
  const { monthlyRent = 0, payments = [], targetMonth } = params;
  const normalizedMonth = targetMonth.slice(0, 7);
  const allocatedRent = Math.max(0, Number(monthlyRent) || 0);

  const matching = payments.filter((p) => paymentMatchesMonth(p, normalizedMonth));

  const activePayments: any[] = [];
  const suppressedPayments: any[] = [];

  matching.forEach((p) => {
    if (isPaymentSuppressed(p)) {
      suppressedPayments.push(p);
    } else {
      activePayments.push(p);
    }
  });

  const totalPaid = activePayments.reduce((sum, p) => {
    const amt = Number(p.amount_paid ?? p.amountPaid ?? p.amount ?? 0);
    return sum + (isNaN(amt) ? 0 : amt);
  }, 0);

  const remainingDue = allocatedRent > 0 ? Math.max(0, allocatedRent - totalPaid) : 0;
  const isFullyPaid = allocatedRent > 0 && totalPaid >= allocatedRent;
  const isPartial = allocatedRent > 0 && totalPaid > 0 && totalPaid < allocatedRent;

  return {
    targetMonth: normalizedMonth,
    allocatedRent,
    totalPaid,
    remainingDue,
    isFullyPaid,
    isPartial,
    activePayments,
    suppressedPayments,
    allPaymentsForMonth: matching,
  };
}

/**
 * Suppresses a rent payment.
 * Suppressed payments are NOT deleted; they are flagged as suppressed,
 * audit-logged, and excluded from system accounting and financial reports.
 */
export async function suppressRentPayment(params: {
  supabase: SupabaseClient;
  paymentId: string;
  staffName: string;
  reason: string;
  currentCompanyId?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  const { supabase, paymentId, staffName, reason, currentCompanyId } = params;
  if (!paymentId) return { success: false, error: "Payment ID is required" };

  try {
    const cleanReason = (reason || "Clerical amendment / voided entry").trim();
    const suppressionTag = `[SUPPRESSED: ${cleanReason} by ${staffName} on ${new Date().toISOString().slice(0, 10)}]`;

    // Fetch existing payment to retrieve notes and related links
    const { data: existingPayment } = await supabase
      .from("tenant_rent_payments")
      .select("id, notes, amount_paid, payment_date, tenant_id, company_id")
      .eq("id", paymentId)
      .maybeSingle();

    const prevNotes = existingPayment?.notes || "";
    const updatedNotes = prevNotes ? `${prevNotes} | ${suppressionTag}` : suppressionTag;

    // 1. Try updating with explicit suppression columns
    let updatePayload: Record<string, any> = {
      is_suppressed: true,
      suppressed_at: new Date().toISOString(),
      suppressed_by: staffName,
      suppressed_reason: cleanReason,
      notes: updatedNotes,
    };

    const { error: primaryErr } = await supabase
      .from("tenant_rent_payments")
      .update(updatePayload)
      .eq("id", paymentId);

    if (primaryErr) {
      // Fallback if is_suppressed column does not exist yet in DB schema
      console.warn("Primary suppression update failed, attempting fallback to notes tag:", primaryErr.message);
      const { error: fallbackErr } = await supabase
        .from("tenant_rent_payments")
        .update({ notes: updatedNotes })
        .eq("id", paymentId);

      if (fallbackErr) throw fallbackErr;
    }

    // 2. Mark any matching finance_transactions record as suppressed / void
    try {
      const compId = currentCompanyId && isValidUuid(currentCompanyId) ? currentCompanyId : existingPayment?.company_id;
      await supabase
        .from("finance_transactions")
        .update({
          status: "cancelled",
          description: `[SUPPRESSED] Rent payment voided by ${staffName}: ${cleanReason}`,
        })
        .or(`description.ilike.%${paymentId}%,reference_number.ilike.%${paymentId}%`);
    } catch (ftErr) {
      console.warn("Could not cancel associated finance_transactions (non-fatal):", ftErr);
    }

    // 3. Mark any matching invoice as suppressed
    try {
      const { data: invoiceItems } = await supabase
        .from("invoice_items")
        .select("invoice_id")
        .ilike("description", `%${paymentId}%`);

      if (invoiceItems && invoiceItems.length > 0) {
        const invIds = invoiceItems.map((item) => item.invoice_id).filter(Boolean);
        if (invIds.length > 0) {
          await supabase
            .from("invoices")
            .update({ status: "suppressed" })
            .in("id", invIds);
        }
      }
    } catch (invErr) {
      console.warn("Could not mark invoice as suppressed (non-fatal):", invErr);
    }

    // 4. Audit Trail Entry
    try {
      await supabase.from("audit_log").insert({
        user_name: staffName,
        action: "rent_payment_suppressed",
        entity_type: "tenant_rent_payment",
        entity_id: paymentId,
        company_id: currentCompanyId && isValidUuid(currentCompanyId) ? currentCompanyId : null,
        details: {
          payment_id: paymentId,
          amount_paid: existingPayment?.amount_paid,
          tenant_id: existingPayment?.tenant_id,
          reason: cleanReason,
          suppressed_by: staffName,
        },
      });
    } catch {}

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Restores a previously suppressed rent payment back to active state.
 */
export async function unsuppressRentPayment(params: {
  supabase: SupabaseClient;
  paymentId: string;
  staffName: string;
  currentCompanyId?: string | null;
}): Promise<{ success: boolean; error?: string }> {
  const { supabase, paymentId, staffName, currentCompanyId } = params;
  if (!paymentId) return { success: false, error: "Payment ID is required" };

  try {
    const { data: existingPayment } = await supabase
      .from("tenant_rent_payments")
      .select("id, notes, company_id")
      .eq("id", paymentId)
      .maybeSingle();

    const prevNotes = existingPayment?.notes || "";
    // Remove the [SUPPRESSED...] tag
    const cleanedNotes = prevNotes
      .replace(/\|\s*\[SUPPRESSED:[^\]]+\]/gi, "")
      .replace(/\[SUPPRESSED:[^\]]+\]/gi, "")
      .replace(/\|\s*\[SUPPRESSED\]/gi, "")
      .replace(/\[SUPPRESSED\]/gi, "")
      .trim();

    const restorePayload: Record<string, any> = {
      is_suppressed: false,
      suppressed_at: null,
      suppressed_by: null,
      suppressed_reason: null,
      notes: cleanedNotes,
    };

    const { error: primaryErr } = await supabase
      .from("tenant_rent_payments")
      .update(restorePayload)
      .eq("id", paymentId);

    if (primaryErr) {
      await supabase
        .from("tenant_rent_payments")
        .update({ notes: cleanedNotes })
        .eq("id", paymentId);
    }

    // Restore invoice if applicable
    try {
      const { data: invoiceItems } = await supabase
        .from("invoice_items")
        .select("invoice_id")
        .ilike("description", `%${paymentId}%`);

      if (invoiceItems && invoiceItems.length > 0) {
        const invIds = invoiceItems.map((item) => item.invoice_id).filter(Boolean);
        if (invIds.length > 0) {
          await supabase
            .from("invoices")
            .update({ status: "paid" })
            .in("id", invIds);
        }
      }
    } catch {}

    try {
      await supabase.from("audit_log").insert({
        user_name: staffName,
        action: "rent_payment_unsuppressed",
        entity_type: "tenant_rent_payment",
        entity_id: paymentId,
        company_id: currentCompanyId && isValidUuid(currentCompanyId) ? currentCompanyId : null,
        details: { payment_id: paymentId, restored_by: staffName },
      });
    } catch {}

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || String(err) };
  }
}

/**
 * Generates an array of future month keys [ 'YYYY-MM', ... ]
 * starting from a base month (defaults to next month or current month).
 */
export function generateUpcomingMonths(count = 12, startFromNext = true, baseMonth?: string): string[] {
  const base = baseMonth ? new Date(baseMonth + "-01") : new Date();
  const startOffset = startFromNext ? 1 : 0;
  const result: string[] = [];

  for (let i = 0; i < count; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + startOffset + i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    result.push(`${yyyy}-${mm}`);
  }
  return result;
}

/**
 * Formats a YYYY-MM month key into a friendly label like "Oct 2026".
 */
export function formatMonthLabel(monthKey: string): string {
  if (!monthKey || monthKey.length < 7) return monthKey || "";
  try {
    const [year, month] = monthKey.slice(0, 7).split("-").map(Number);
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  } catch {
    return monthKey;
  }
}

