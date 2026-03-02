export type BillFrequency = "monthly" | "quarterly" | "semi_annual" | "annual";

export type BillStatus = "pending" | "paid";

export type BillRow = {
  id: string;
  name: string;
  propertyId: string;
  propertyName: string;
  amount: number;
  frequency: BillFrequency;
  dueDay: number;
  status: BillStatus;
  startDate: string;
  lastPaidDate: string;
  lastPaidAmount: number;
};

const frequencyMonths: Record<BillFrequency, number> = {
  monthly: 1,
  quarterly: 3,
  semi_annual: 6,
  annual: 12,
};

function parseDate(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function atMidday(year: number, monthIndex: number, day: number) {
  return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

function clampDueDay(year: number, monthIndex: number, dueDay: number) {
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  return Math.max(1, Math.min(lastDay, dueDay));
}

function addMonths(date: Date, months: number) {
  return atMidday(date.getFullYear(), date.getMonth() + months, 1);
}

function dayDiff(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export function frequencyLabel(frequency: BillFrequency) {
  if (frequency === "monthly") return "Monthly";
  if (frequency === "quarterly") return "Quarterly";
  if (frequency === "semi_annual") return "6 Months";
  return "Annual";
}

export function nextDueDate(bill: Pick<BillRow, "frequency" | "dueDay" | "startDate">, now = new Date()) {
  const monthsStep = frequencyMonths[bill.frequency] ?? 1;
  const anchorRaw = parseDate(bill.startDate) ?? now;
  let cursor = atMidday(anchorRaw.getFullYear(), anchorRaw.getMonth(), 1);

  for (let index = 0; index < 240; index += 1) {
    const due = atMidday(cursor.getFullYear(), cursor.getMonth(), clampDueDay(cursor.getFullYear(), cursor.getMonth(), bill.dueDay));
    if (due >= atMidday(now.getFullYear(), now.getMonth(), now.getDate())) {
      return due;
    }
    cursor = addMonths(cursor, monthsStep);
  }

  return atMidday(now.getFullYear(), now.getMonth(), now.getDate());
}

export function previousDueDate(bill: Pick<BillRow, "frequency" | "dueDay" | "startDate">, now = new Date()) {
  const monthsStep = frequencyMonths[bill.frequency] ?? 1;
  const anchorRaw = parseDate(bill.startDate) ?? now;
  let cursor = atMidday(anchorRaw.getFullYear(), anchorRaw.getMonth(), 1);
  let previous: Date | null = null;

  for (let index = 0; index < 240; index += 1) {
    const due = atMidday(cursor.getFullYear(), cursor.getMonth(), clampDueDay(cursor.getFullYear(), cursor.getMonth(), bill.dueDay));
    if (due > atMidday(now.getFullYear(), now.getMonth(), now.getDate())) {
      return previous;
    }
    previous = due;
    cursor = addMonths(cursor, monthsStep);
  }

  return previous;
}

export function billStatusMeta(bill: BillRow, now = new Date()) {
  const previousDue = previousDueDate(bill, now);
  const upcomingDue = nextDueDate(bill, now);
  const paidDate = parseDate(bill.lastPaidDate);

  const paidForCurrentCycle = Boolean(
    paidDate && previousDue && paidDate >= previousDue,
  );

  if (paidForCurrentCycle || (bill.status === "paid" && paidDate)) {
    return {
      tone: "paid" as const,
      text: `Paid on ${paidDate!.toISOString().slice(0, 10)}`,
      nextDue: upcomingDue,
    };
  }

  const today = atMidday(now.getFullYear(), now.getMonth(), now.getDate());
  const daysToDue = dayDiff(today, upcomingDue);

  if (daysToDue < 0) {
    return {
      tone: "overdue" as const,
      text: `Overdue by ${Math.abs(daysToDue)} day(s)`,
      nextDue: upcomingDue,
    };
  }

  return {
    tone: "upcoming" as const,
    text: `Due in ${daysToDue} day(s)`,
    nextDue: upcomingDue,
  };
}
