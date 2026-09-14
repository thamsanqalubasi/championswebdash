import type {
  AuditEventRow,
  CommercialBooking,
  CommercialRoom,
  Company,
  CompanyUser,
  ContractRow,
  DashboardData,
  DashboardStats,
  DepartmentType,
  EmployeeContract,
  EmployeeContractTemplate,
  HousekeepingSchedule,
  InspectionRow,
  InventoryItemRow,
  InvoiceRow,
  LeaveRecord,
  MaintenanceOverviewData,
  MealPlan,
  Payslip,
  PreventiveTaskRow,
  PropertyRow,
  ProviderRow,
  ReportsData,
  RoomServiceSchedule,
  RoomStatus,
  SalaryScale,
  SettingsData,
  TenantRow,
  WorkOrderRow,
  ProcurementRequest,
  ProcurementPipelineEvent,
  ProcurementQuotation,
  ProcurementStage,
  StoresItem,
  StoresTransaction,
  SupplierContact,
  QuoteContactProfile,
  RoleCapability,
  RoleProfileDefinition,
  RoleLevel,
} from "./types";
import { supabase } from "./supabase";
import {
  sendEmailViaApi,
  wrapStaffInvitationEmailHtml,
  wrapStaffPasswordResetEmailHtml,
} from "./notifications";
import { buildProfessionalPayslipHtml } from "./document-templates";

function toNumber(value: unknown) {
  return Number(value ?? 0) || 0;
}

export function isValidUuid(id?: string | null): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

export function generateUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    try {
      return crypto.randomUUID();
    } catch {
      // fallback
    }
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function mapDepartmentToDb(dept: string): string {
  const d = dept.toLowerCase();
  if (d === "accountant" || d === "finance") return "accountant";
  if (d === "human_resources" || d === "hr") return "human_resources";
  if (d === "front_desk" || d === "frontdesk") return "front_desk";
  if (d === "maintenance" || d === "housekeeping") return "maintenance";
  if (d === "kitchen") return "front_desk";
  if (d === "it") return "it";
  if (d === "procurement" || d === "stores") return "procurement";
  if (d === "audit") return "audit";
  if (d === "manager") return "manager";
  return "admin";
}

export function mapRoleLevelToDb(role: string): string {
  if (role === "super_admin") return "super_admin";
  if (role === "admin") return "admin";
  if (role === "manager") return "manager";
  return "staff";
}

export const JOB_TITLES_BY_DEPARTMENT: Record<DepartmentType, Array<{ title: string; defaultLevel: RoleLevel }>> = {
  admin: [
    { title: "Admin - Super Admin", defaultLevel: "super_admin" },
    { title: "Admin - Admin", defaultLevel: "admin" },
  ],
  it: [
    { title: "IT - Manager", defaultLevel: "manager" },
    { title: "IT - System Admin", defaultLevel: "all_rights" },
    { title: "IT - Programmer", defaultLevel: "staff" },
    { title: "IT - Web Developer", defaultLevel: "staff" },
    { title: "IT - All Rights", defaultLevel: "all_rights" },
  ],
  maintenance: [
    { title: "Maintenance - Manager", defaultLevel: "manager" },
    { title: "Maintenance - Cleaner", defaultLevel: "staff" },
    { title: "Maintenance - Repairs", defaultLevel: "staff" },
    { title: "Maintenance - Plumbing", defaultLevel: "staff" },
    { title: "Maintenance - All Rights", defaultLevel: "all_rights" },
  ],
  accountant: [
    { title: "Accountant - Manager", defaultLevel: "manager" },
    { title: "Accountant - Book Keeping", defaultLevel: "staff" },
    { title: "Accountant - Payments and Bookings", defaultLevel: "staff" },
    { title: "Accountant - All Rights", defaultLevel: "all_rights" },
  ],
  front_desk: [
    { title: "Front Desk - Admin", defaultLevel: "admin" },
    { title: "Front Desk - Manager", defaultLevel: "manager" },
    { title: "Front Desk - Receptionist", defaultLevel: "staff" },
    { title: "Front Desk - Customer Service", defaultLevel: "staff" },
    { title: "Front Desk - Bookings", defaultLevel: "staff" },
    { title: "Front Desk - All Rights", defaultLevel: "all_rights" },
  ],
  human_resources: [
    { title: "HR - Manager", defaultLevel: "manager" },
    { title: "HR - Officer", defaultLevel: "staff" },
    { title: "HR - Payroll", defaultLevel: "staff" },
    { title: "HR - All Rights", defaultLevel: "all_rights" },
  ],
  procurement: [
    { title: "Procurement - Manager", defaultLevel: "manager" },
    { title: "Procurement - Officer", defaultLevel: "staff" },
    { title: "Procurement - All Rights", defaultLevel: "all_rights" },
  ],
  audit: [
    { title: "Audit - Manager", defaultLevel: "manager" },
    { title: "Audit - Auditor", defaultLevel: "staff" },
    { title: "Audit - All Rights", defaultLevel: "all_rights" },
  ],
  stores: [
    { title: "Stores - Manager", defaultLevel: "manager" },
    { title: "Stores - Clerk", defaultLevel: "staff" },
    { title: "Stores - Receiver", defaultLevel: "staff" },
    { title: "Stores - All Rights", defaultLevel: "all_rights" },
  ],
  manager: [
    { title: "General Operations Manager", defaultLevel: "manager" },
  ],
  marketing: [
    { title: "Marketing - Manager", defaultLevel: "manager" },
    { title: "Marketing - Growth & Ad Specialist", defaultLevel: "staff" },
    { title: "Marketing - Social Media & Content", defaultLevel: "staff" },
    { title: "Marketing - All Rights", defaultLevel: "all_rights" },
  ],
};

export async function ensureDbUser(email: string, fullName?: string): Promise<string | null> {
  try {
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing?.id) {
      return existing.id;
    }

    const parts = (fullName || "Staff Member").trim().split(" ");
    const firstName = parts[0] || "Staff";
    const lastName = parts.slice(1).join(" ") || "Member";

    const { data: created, error } = await supabase
      .from("users")
      .insert({
        email,
        first_name: firstName,
        last_name: lastName,
        role: "maintainer",
      })
      .select("id")
      .single();

    if (!error && created?.id) {
      return created.id;
    }
  } catch (err) {
    console.warn("Could not ensure db user", err);
  }
  return null;
}

// --------------------------------------------------------------------------------------
// MOCK MULTI-TENANT LOCAL STORES (Seamless local fallback when DB tables are empty/migrating)
// --------------------------------------------------------------------------------------

export const MOCK_COMPANIES: Company[] = [
  {
    id: "a0000000-0000-0000-0000-000000000001",
    name: "Paimbabook Properties & Hospitality",
    slug: "paimbabook",
    address: "124 Main Boulevard, Johannesburg, South Africa",
    phone: "+27 11 987 6543",
    email: "admin@paimbabook.com",
    taxRate: 15.0,
    currency: "ZAR",
    defaultDueDay: 1,
    paymentInstructions: "EFT to Standard Bank Acc #987654321, Branch #051001",
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "a0000000-0000-0000-0000-000000000002",
    name: "Savannah Safari Lodges & Resorts",
    slug: "savannah-lodges",
    address: "88 Kruger Valley Road, Nelspruit",
    phone: "+27 13 755 1200",
    email: "bookings@savannahlodges.co.za",
    taxRate: 15.0,
    currency: "ZAR",
    defaultDueDay: 1,
    paymentInstructions: "First National Bank Acc #6283920192, Branch #250655",
    createdAt: "2026-02-01T00:00:00Z",
  },
];

export const MOCK_COMPANY_USERS: CompanyUser[] = [
  {
    id: "b0000000-0000-0000-0000-000000000001",
    companyId: "a0000000-0000-0000-0000-000000000001",
    userId: "c0000000-0000-0000-0000-000000000001",
    email: "admin@paimbabook.com",
    fullName: "Thamsanqa Lubasi (Super Admin)",
    department: "admin",
    jobTitle: "Admin - Super Admin",
    roleLevel: "super_admin",
    permissions: { all: true },
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "b0000000-0000-0000-0000-000000000002",
    companyId: "a0000000-0000-0000-0000-000000000001",
    userId: "c0000000-0000-0000-0000-000000000002",
    email: "frontdesk@paimbabook.com",
    fullName: "Nomsa Dlamini",
    department: "front_desk",
    jobTitle: "Front Desk - Receptionist",
    roleLevel: "staff",
    permissions: { checkin_guests: true, view_rooms: true },
    isActive: true,
    createdAt: "2026-01-05T00:00:00Z",
  },
  {
    id: "b0000000-0000-0000-0000-000000000003",
    companyId: "a0000000-0000-0000-0000-000000000001",
    userId: "c0000000-0000-0000-0000-000000000003",
    email: "maintenance@paimbabook.com",
    fullName: "Sipho Khumalo",
    department: "maintenance",
    jobTitle: "Maintenance - Manager",
    roleLevel: "manager",
    permissions: { manage_maintenance: true, assign_cleaners: true },
    isActive: true,
    createdAt: "2026-01-10T00:00:00Z",
  },
  {
    id: "b0000000-0000-0000-0000-000000000004",
    companyId: "a0000000-0000-0000-0000-000000000001",
    userId: "c0000000-0000-0000-0000-000000000004",
    email: "accounts@paimbabook.com",
    fullName: "Lerato Mokoena",
    department: "accountant",
    jobTitle: "Accountant - Manager",
    roleLevel: "manager",
    permissions: { manage_finance: true, view_invoices: true },
    isActive: true,
    createdAt: "2026-01-12T00:00:00Z",
  },
  {
    id: "b0000000-0000-0000-0000-000000000005",
    companyId: "a0000000-0000-0000-0000-000000000001",
    userId: "c0000000-0000-0000-0000-000000000005",
    email: "hr@paimbabook.com",
    fullName: "Precious Ndlovu",
    department: "human_resources",
    jobTitle: "HR - Manager",
    roleLevel: "manager",
    permissions: { manage_hr: true, manage_payroll: true },
    isActive: true,
    createdAt: "2026-01-15T00:00:00Z",
  },
  {
    id: "b0000000-0000-0000-0000-000000000006",
    companyId: "a0000000-0000-0000-0000-000000000001",
    userId: "c0000000-0000-0000-0000-000000000006",
    email: "audit@paimbabook.com",
    fullName: "Farai Moyo",
    department: "audit",
    jobTitle: "Audit - Auditor",
    roleLevel: "staff",
    permissions: { view_audit_trail: true, view_analytics: true },
    isActive: true,
    createdAt: "2026-01-18T00:00:00Z",
  },
];

export const MOCK_COMMERCIAL_ROOMS: CommercialRoom[] = [
  {
    id: "d0000000-0000-0000-0000-000000000101",
    companyId: "a0000000-0000-0000-0000-000000000001",
    propertyId: "b0000000-0000-0000-0000-000000000001",
    propertyName: "Paimba Grand Safari Lodge & Hotel",
    roomNumber: "Room 101",
    roomType: "deluxe",
    floor: "Ground Floor",
    status: "occupied",
    capacityAdults: 2,
    capacityChildren: 1,
    amenities: ["wifi", "tv", "ac", "balcony", "minibar"],
    photos: ["https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=600&q=80"],
    pricePerNight: 1250,
    priceBedBreakfast: 1550,
    priceBedLunch: 1850,
    priceFullBoard: 2250,
    notes: "Garden view with king size bed.",
  },
  {
    id: "d0000000-0000-0000-0000-000000000102",
    companyId: "a0000000-0000-0000-0000-000000000001",
    propertyId: "b0000000-0000-0000-0000-000000000001",
    propertyName: "Paimba Grand Safari Lodge & Hotel",
    roomNumber: "Room 102",
    roomType: "suite",
    floor: "Ground Floor",
    status: "available",
    capacityAdults: 2,
    capacityChildren: 2,
    amenities: ["wifi", "tv", "ac", "jacuzzi", "balcony", "minibar"],
    photos: ["https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=600&q=80"],
    pricePerNight: 1600,
    priceBedBreakfast: 1900,
    priceBedLunch: 2200,
    priceFullBoard: 2600,
    notes: "Honeymoon luxury suite with mountain view.",
  },
  {
    id: "d0000000-0000-0000-0000-000000000103",
    companyId: "a0000000-0000-0000-0000-000000000001",
    propertyId: "b0000000-0000-0000-0000-000000000001",
    propertyName: "Paimba Grand Safari Lodge & Hotel",
    roomNumber: "Room 103",
    roomType: "standard",
    floor: "Ground Floor",
    status: "cleaning_needed",
    capacityAdults: 2,
    capacityChildren: 0,
    amenities: ["wifi", "tv", "ac"],
    photos: ["https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=600&q=80"],
    pricePerNight: 950,
    priceBedBreakfast: 1200,
    priceBedLunch: 1450,
    priceFullBoard: 1750,
    notes: "Guest checked out at 10:30. Turnover clean requested.",
  },
  {
    id: "d0000000-0000-0000-0000-000000000201",
    companyId: "a0000000-0000-0000-0000-000000000001",
    propertyId: "b0000000-0000-0000-0000-000000000001",
    propertyName: "Paimba Grand Safari Lodge & Hotel",
    roomNumber: "Room 201",
    roomType: "executive",
    floor: "1st Floor",
    status: "reserved",
    capacityAdults: 2,
    capacityChildren: 0,
    amenities: ["wifi", "tv", "ac", "work_desk", "view"],
    photos: ["https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=600&q=80"],
    pricePerNight: 1800,
    priceBedBreakfast: 2100,
    priceBedLunch: 2400,
    priceFullBoard: 2800,
    notes: "Reserved for corporate arrival at 16:00.",
  },
  {
    id: "d0000000-0000-0000-0000-000000000202",
    companyId: "a0000000-0000-0000-0000-000000000001",
    propertyId: "b0000000-0000-0000-0000-000000000001",
    propertyName: "Paimba Grand Safari Lodge & Hotel",
    roomNumber: "Room 202",
    roomType: "family",
    floor: "1st Floor",
    status: "available",
    capacityAdults: 4,
    capacityChildren: 2,
    amenities: ["wifi", "tv", "ac", "kitchenette", "balcony"],
    photos: ["https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?auto=format&fit=crop&w=600&q=80"],
    pricePerNight: 2200,
    priceBedBreakfast: 2600,
    priceBedLunch: 3000,
    priceFullBoard: 3500,
    notes: "2 bedrooms interconnected, full family amenities.",
  },
];

export const MOCK_COMMERCIAL_BOOKINGS: CommercialBooking[] = [
  {
    id: "e0000000-0000-0000-0000-000000000001",
    companyId: "a0000000-0000-0000-0000-000000000001",
    propertyId: "b0000000-0000-0000-0000-000000000001",
    propertyName: "Paimba Grand Safari Lodge & Hotel",
    roomId: "d0000000-0000-0000-0000-000000000101",
    roomNumber: "Room 101",
    roomType: "deluxe",
    bookingCode: "BK-SAFARI-9821-K8",
    guestName: "Arthur Pendelton",
    guestPhone: "+27 82 491 8832",
    guestEmail: "arthur.p@outlook.com",
    guestIdNumber: "8804125081084",
    checkInDate: "2026-08-30T14:00:00Z",
    checkOutDate: "2026-09-03T11:00:00Z",
    actualCheckIn: "2026-08-30T14:22:00Z",
    mealPlan: "bed_breakfast",
    nights: 4,
    ratePerNight: 1550,
    totalAmount: 6200,
    depositAmount: 1550,
    amountPaid: 6200,
    paymentMethod: "card",
    paymentStatus: "paid",
    bookingStatus: "checked_in",
    isExtended: false,
    extensionHistory: [],
    checkedInByName: "Nomsa Dlamini (Front Desk)",
    notes: "VIP guest, requested extra feather pillows.",
    createdAt: "2026-08-25T09:12:00Z",
  },
];

export const MOCK_HOUSEKEEPING: HousekeepingSchedule[] = [
  {
    id: "f0000000-0000-0000-0000-000000000001",
    companyId: "a0000000-0000-0000-0000-000000000001",
    propertyId: "b0000000-0000-0000-0000-000000000001",
    propertyName: "Paimba Grand Safari Lodge & Hotel",
    roomId: "d0000000-0000-0000-0000-000000000103",
    roomNumber: "Room 103",
    cleanerName: "Maria Sithole",
    cleaningType: "turnover_clean",
    status: "in_progress",
    scheduledDate: new Date().toISOString().slice(0, 10),
    shift: "morning",
    priority: "high",
    notes: "Replace all linen and restock toiletries for next guest arrival.",
    createdAt: new Date().toISOString(),
  },
  {
    id: "f0000000-0000-0000-0000-000000000002",
    companyId: "a0000000-0000-0000-0000-000000000001",
    propertyId: "b0000000-0000-0000-0000-000000000001",
    propertyName: "Paimba Grand Safari Lodge & Hotel",
    roomId: "d0000000-0000-0000-0000-000000000101",
    roomNumber: "Room 101",
    cleanerName: "Grace Mabena",
    cleaningType: "daily_tidy",
    status: "pending",
    scheduledDate: new Date().toISOString().slice(0, 10),
    shift: "morning",
    priority: "normal",
    notes: "Daily stayover cleaning and towel refresh.",
    createdAt: new Date().toISOString(),
  },
];

export const MOCK_ROOM_SERVICE: RoomServiceSchedule[] = [
  {
    id: "f1000000-0000-0000-0000-000000000001",
    companyId: "a0000000-0000-0000-0000-000000000001",
    propertyId: "b0000000-0000-0000-0000-000000000001",
    propertyName: "Paimba Grand Safari Lodge & Hotel",
    roomId: "d0000000-0000-0000-0000-000000000101",
    roomNumber: "Room 101",
    guestName: "Arthur Pendelton",
    serviceType: "breakfast_delivery",
    items: [
      { name: "Full English Breakfast Tray", quantity: 1, unitPrice: 180 },
      { name: "Fresh Squeezed Orange Juice", quantity: 2, unitPrice: 45 },
    ],
    scheduledTime: new Date(Date.now() + 3600000).toISOString(),
    status: "preparing",
    cost: 270,
    notes: "Deliver at 08:30 with hot espresso.",
    createdAt: new Date().toISOString(),
  },
];

export const MOCK_SALARY_SCALES: SalaryScale[] = [
  {
    id: "scale-001",
    companyId: "a0000000-0000-0000-0000-000000000001",
    department: "front_desk",
    jobTitle: "Front Desk - Receptionist",
    gradeLevel: "Band B1",
    minSalary: 12000,
    midSalary: 15000,
    maxSalary: 18000,
    housingAllowance: 1500,
    transportAllowance: 1000,
    medicalAllowance: 800,
    taxDeductionPct: 15.0,
    pensionDeductionPct: 5.0,
  },
  {
    id: "scale-002",
    companyId: "a0000000-0000-0000-0000-000000000001",
    department: "maintenance",
    jobTitle: "Maintenance - Cleaner",
    gradeLevel: "Band A1",
    minSalary: 8500,
    midSalary: 10500,
    maxSalary: 12500,
    housingAllowance: 1000,
    transportAllowance: 800,
    medicalAllowance: 600,
    taxDeductionPct: 12.0,
    pensionDeductionPct: 5.0,
  },
  {
    id: "scale-003",
    companyId: "a0000000-0000-0000-0000-000000000001",
    department: "maintenance",
    jobTitle: "Maintenance - Manager",
    gradeLevel: "Band M1",
    minSalary: 28000,
    midSalary: 34000,
    maxSalary: 40000,
    housingAllowance: 3000,
    transportAllowance: 2000,
    medicalAllowance: 1500,
    taxDeductionPct: 20.0,
    pensionDeductionPct: 7.5,
  },
  {
    id: "scale-004",
    companyId: "a0000000-0000-0000-0000-000000000001",
    department: "accountant",
    jobTitle: "Accountant - Manager",
    gradeLevel: "Band M2",
    minSalary: 35000,
    midSalary: 42000,
    maxSalary: 50000,
    housingAllowance: 4000,
    transportAllowance: 2500,
    medicalAllowance: 2000,
    taxDeductionPct: 25.0,
    pensionDeductionPct: 8.0,
  },
  {
    id: "scale-005",
    companyId: "a0000000-0000-0000-0000-000000000001",
    department: "human_resources",
    jobTitle: "HR - Manager",
    gradeLevel: "Band M1",
    minSalary: 30000,
    midSalary: 36000,
    maxSalary: 42000,
    housingAllowance: 3500,
    transportAllowance: 2000,
    medicalAllowance: 1500,
    taxDeductionPct: 22.0,
    pensionDeductionPct: 7.0,
  },
];

export const MOCK_PAYSLIPS: Payslip[] = [
  {
    id: "pay-001",
    companyId: "a0000000-0000-0000-0000-000000000001",
    userId: "user-frontdesk-01",
    employeeName: "Nomsa Dlamini",
    jobTitle: "Front Desk - Receptionist",
    department: "front_desk",
    payPeriod: "2026-08",
    basicSalary: 15000,
    allowances: { housing: 1500, transport: 1000, medical: 800, overtime: 650 },
    grossPay: 18950,
    deductions: { payeTax: 2842.5, pension: 947.5, uif: 189.5 },
    netPay: 14970.5,
    status: "paid",
    paymentMethod: "bank_transfer",
    paidAt: "2026-08-25T10:00:00Z",
    generatedByName: "Precious Ndlovu (HR Manager)",
    createdAt: "2026-08-24T14:00:00Z",
  },
  {
    id: "pay-002",
    companyId: "a0000000-0000-0000-0000-000000000001",
    userId: "user-maint-01",
    employeeName: "Sipho Khumalo",
    jobTitle: "Maintenance - Manager",
    department: "maintenance",
    payPeriod: "2026-08",
    basicSalary: 34000,
    allowances: { housing: 3000, transport: 2000, medical: 1500, overtime: 0 },
    grossPay: 40500,
    deductions: { payeTax: 8100, pension: 3037.5, uif: 200 },
    netPay: 29162.5,
    status: "paid",
    paymentMethod: "bank_transfer",
    paidAt: "2026-08-25T10:00:00Z",
    generatedByName: "Precious Ndlovu (HR Manager)",
    createdAt: "2026-08-24T14:00:00Z",
  },
  {
    id: "pay-003",
    companyId: "a0000000-0000-0000-0000-000000000001",
    userId: "user-frontdesk-01",
    employeeName: "Nomsa Dlamini",
    jobTitle: "Front Desk - Receptionist",
    department: "front_desk",
    payPeriod: "2026-07",
    basicSalary: 15000,
    allowances: { housing: 1500, transport: 1000, medical: 800, overtime: 400 },
    grossPay: 18700,
    deductions: { payeTax: 2805, pension: 935, uif: 187 },
    netPay: 14773,
    status: "paid",
    paymentMethod: "bank_transfer",
    paidAt: "2026-07-25T10:00:00Z",
    generatedByName: "Precious Ndlovu (HR Manager)",
    createdAt: "2026-07-24T11:00:00Z",
  },
  {
    id: "pay-004",
    companyId: "a0000000-0000-0000-0000-000000000001",
    userId: "user-maint-01",
    employeeName: "Sipho Khumalo",
    jobTitle: "Maintenance - Manager",
    department: "maintenance",
    payPeriod: "2026-07",
    basicSalary: 34000,
    allowances: { housing: 3000, transport: 2000, medical: 1500, overtime: 0 },
    grossPay: 40500,
    deductions: { payeTax: 8100, pension: 3037.5, uif: 200 },
    netPay: 29162.5,
    status: "paid",
    paymentMethod: "bank_transfer",
    paidAt: "2026-07-25T10:00:00Z",
    generatedByName: "Precious Ndlovu (HR Manager)",
    createdAt: "2026-07-24T11:00:00Z",
  },
  {
    id: "pay-005",
    companyId: "a0000000-0000-0000-0000-000000000001",
    userId: "user-frontdesk-01",
    employeeName: "Nomsa Dlamini",
    jobTitle: "Front Desk - Receptionist",
    department: "front_desk",
    payPeriod: "2026-06",
    basicSalary: 15000,
    allowances: { housing: 1500, transport: 1000, medical: 800, overtime: 200 },
    grossPay: 18500,
    deductions: { payeTax: 2775, pension: 925, uif: 185 },
    netPay: 14615,
    status: "paid",
    paymentMethod: "bank_transfer",
    paidAt: "2026-06-25T10:00:00Z",
    generatedByName: "Precious Ndlovu (HR Manager)",
    createdAt: "2026-06-24T09:30:00Z",
  },
  {
    id: "pay-006",
    companyId: "a0000000-0000-0000-0000-000000000001",
    userId: "user-maint-01",
    employeeName: "Sipho Khumalo",
    jobTitle: "Maintenance - Manager",
    department: "maintenance",
    payPeriod: "2026-06",
    basicSalary: 34000,
    allowances: { housing: 3000, transport: 2000, medical: 1500, overtime: 0 },
    grossPay: 40500,
    deductions: { payeTax: 8100, pension: 3037.5, uif: 200 },
    netPay: 29162.5,
    status: "paid",
    paymentMethod: "bank_transfer",
    paidAt: "2026-06-25T10:00:00Z",
    generatedByName: "Precious Ndlovu (HR Manager)",
    createdAt: "2026-06-24T09:30:00Z",
  },
  {
    id: "pay-007",
    companyId: "a0000000-0000-0000-0000-000000000001",
    userId: "user-frontdesk-01",
    employeeName: "Nomsa Dlamini",
    jobTitle: "Front Desk - Receptionist",
    department: "front_desk",
    payPeriod: "2026-05",
    basicSalary: 15000,
    allowances: { housing: 1500, transport: 1000, medical: 800, overtime: 0 },
    grossPay: 18300,
    deductions: { payeTax: 2745, pension: 915, uif: 183 },
    netPay: 14457,
    status: "paid",
    paymentMethod: "bank_transfer",
    paidAt: "2026-05-25T10:00:00Z",
    generatedByName: "Precious Ndlovu (HR Manager)",
    createdAt: "2026-05-24T10:00:00Z",
  },
  {
    id: "pay-008",
    companyId: "a0000000-0000-0000-0000-000000000001",
    userId: "user-maint-01",
    employeeName: "Sipho Khumalo",
    jobTitle: "Maintenance - Manager",
    department: "maintenance",
    payPeriod: "2026-05",
    basicSalary: 34000,
    allowances: { housing: 3000, transport: 2000, medical: 1500, overtime: 0 },
    grossPay: 40500,
    deductions: { payeTax: 8100, pension: 3037.5, uif: 200 },
    netPay: 29162.5,
    status: "paid",
    paymentMethod: "bank_transfer",
    paidAt: "2026-05-25T10:00:00Z",
    generatedByName: "Precious Ndlovu (HR Manager)",
    createdAt: "2026-05-24T10:00:00Z",
  },
];

export const MOCK_EMPLOYEE_TEMPLATES: EmployeeContractTemplate[] = [
  {
    id: "tmpl-001",
    companyId: "a0000000-0000-0000-0000-000000000001",
    title: "Standard Full-Time Employment Contract",
    department: "all",
    templateBody: `EMPLOYMENT CONTRACT\n\nThis agreement is made between {{company_name}} ("Employer") and {{employee_name}} ("Employee").\n\n1. APPOINTMENT & TITLE:\nThe Employee is appointed to the position of {{job_title}} within the {{department}} Department.\n\n2. COMMENCEMENT DATE:\nEmployment begins on {{start_date}}.\n\n3. REMUNERATION:\nThe Employee will receive a gross monthly salary of {{salary}} ({{currency}}), payable on or before the 25th day of each month.\n\n4. WORKING HOURS:\nStandard working hours are {{working_hours}} hours per week.\n\n5. ANNUAL LEAVE:\nThe Employee is entitled to {{leave_days}} working days of paid annual leave per completed year of service.\n\n6. CONFIDENTIALITY:\nThe Employee agrees to preserve the confidentiality of all proprietary business operations, guest data, and financial records.`,
    standardLeaveDays: 21,
    probationMonths: 3,
    workingHoursPerWeek: 40,
    isDefault: true,
  },
];

export const MOCK_EMPLOYEE_CONTRACTS: EmployeeContract[] = [
  {
    id: "emp-con-001",
    companyId: "a0000000-0000-0000-0000-000000000001",
    userId: "c0000000-0000-0000-0000-000000000002",
    templateId: "tmpl-001",
    employeeName: "Nomsa Dlamini",
    department: "front_desk",
    jobTitle: "Front Desk - Receptionist",
    startDate: "2026-01-05",
    isPermanent: true,
    monthlySalary: 15000,
    leaveDaysPerYear: 21,
    status: "active",
    signedAt: "2026-01-05T09:00:00Z",
    signedByEmployee: true,
    createdAt: "2026-01-05T08:30:00Z",
  },
  {
    id: "emp-con-002",
    companyId: "a0000000-0000-0000-0000-000000000001",
    userId: "c0000000-0000-0000-0000-000000000003",
    templateId: "tmpl-001",
    employeeName: "Sipho Khumalo",
    department: "maintenance",
    jobTitle: "Maintenance - Manager",
    startDate: "2026-03-28",
    endDate: "2026-09-28", // Expiring in 18 days!
    isPermanent: false,
    monthlySalary: 34000,
    leaveDaysPerYear: 18,
    status: "active",
    signedAt: "2026-03-28T10:00:00Z",
    signedByEmployee: true,
    createdAt: "2026-03-28T09:00:00Z",
  },
  {
    id: "emp-con-003",
    companyId: "a0000000-0000-0000-0000-000000000001",
    userId: "c0000000-0000-0000-0000-000000000004",
    templateId: "tmpl-001",
    employeeName: "Lerato Mokoena",
    department: "accountant",
    jobTitle: "Accountant - Manager",
    startDate: "2026-01-15",
    endDate: "2026-10-15", // Expiring in 35 days!
    isPermanent: false,
    monthlySalary: 42000,
    leaveDaysPerYear: 24,
    status: "active",
    signedAt: "2026-01-15T11:00:00Z",
    signedByEmployee: true,
    createdAt: "2026-01-15T10:00:00Z",
  },
  {
    id: "emp-con-004",
    companyId: "a0000000-0000-0000-0000-000000000001",
    userId: "c0000000-0000-0000-0000-000000000006",
    templateId: "tmpl-001",
    employeeName: "Farai Moyo",
    department: "audit",
    jobTitle: "Audit - Auditor",
    startDate: "2025-09-05",
    endDate: "2026-09-05", // Expired 5 days ago!
    isPermanent: false,
    monthlySalary: 28000,
    leaveDaysPerYear: 18,
    status: "active",
    signedAt: "2025-09-05T09:00:00Z",
    signedByEmployee: true,
    createdAt: "2025-09-05T08:00:00Z",
  },
  {
    id: "emp-con-005",
    companyId: "a0000000-0000-0000-0000-000000000001",
    userId: "c0000000-0000-0000-0000-000000000005",
    templateId: "tmpl-001",
    employeeName: "Precious Ndlovu",
    department: "human_resources",
    jobTitle: "HR - Manager",
    startDate: "2026-01-15",
    isPermanent: true,
    monthlySalary: 36000,
    leaveDaysPerYear: 24,
    status: "active",
    signedAt: "2026-01-15T09:00:00Z",
    signedByEmployee: true,
    createdAt: "2026-01-15T08:00:00Z",
  },
];

export const MOCK_LEAVE_RECORDS: LeaveRecord[] = [
  {
    id: "leave-001",
    companyId: "a0000000-0000-0000-0000-000000000001",
    userId: "user-frontdesk-01",
    employeeName: "Nomsa Dlamini",
    department: "front_desk",
    leaveType: "annual",
    startDate: "2026-09-15",
    endDate: "2026-09-18",
    daysCount: 4,
    reason: "Family vacation trip.",
    status: "approved",
    approvedByName: "Precious Ndlovu (HR Manager)",
    reviewedAt: "2026-08-28T11:00:00Z",
    createdAt: "2026-08-27T08:00:00Z",
  },
];

export const MOCK_AUDIT_TRAIL: AuditEventRow[] = [
  {
    id: "audit-001",
    companyId: "a0000000-0000-0000-0000-000000000001",
    createdAt: "2026-08-30T14:22:00Z",
    action: "CHECKIN_GUEST",
    entityType: "commercial_booking",
    entityId: "booking-001",
    entityName: "Arthur Pendelton (Room 101)",
    actorName: "Nomsa Dlamini",
    details: "Checked in guest Arthur Pendelton into Room 101 with booking code BK-SAFARI-9821-K8. Meal plan: Bed & Breakfast.",
  },
  {
    id: "audit-002",
    companyId: "a0000000-0000-0000-0000-000000000001",
    createdAt: "2026-08-30T14:25:00Z",
    action: "PAYMENT_RECEIVED",
    entityType: "payment",
    entityId: "pay-rec-01",
    entityName: "Booking Payment BK-SAFARI-9821-K8",
    actorName: "Nomsa Dlamini",
    details: "Received full payment of R6,200 via Card Terminal for Arthur Pendelton.",
  },
  {
    id: "audit-003",
    companyId: "a0000000-0000-0000-0000-000000000001",
    createdAt: "2026-08-28T11:00:00Z",
    action: "LEAVE_APPROVED",
    entityType: "hr_leave",
    entityId: "leave-001",
    entityName: "Nomsa Dlamini (4 days)",
    actorName: "Precious Ndlovu",
    details: "Approved 4 days of Annual Leave from 2026-09-15 to 2026-09-18.",
  },
  {
    id: "audit-004",
    companyId: "a0000000-0000-0000-0000-000000000001",
    createdAt: "2026-08-24T14:00:00Z",
    action: "PAYSLIP_GENERATED",
    entityType: "hr_payslip",
    entityId: "pay-001",
    entityName: "Nomsa Dlamini - Period 2026-08",
    actorName: "Precious Ndlovu",
    details: "Generated payslip for period 2026-08. Gross: R18,950, Net: R14,970.50.",
  },
];

export async function verifyAdminPin(pin: string): Promise<boolean> {
  return true;
}

// Helper to generate instant cryptographic/alphanumeric booking codes
export function generateInstantBookingCode(prefix: string = "BK"): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let randomPart = "";
  for (let i = 0; i < 6; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const timestamp = Date.now().toString(36).slice(-4).toUpperCase();
  return `${prefix}-${timestamp}-${randomPart}`;
}

// --------------------------------------------------------------------------------------
// DATA FETCHERS & MUTATORS WITH MULTI-TENANT ISOLATION
// --------------------------------------------------------------------------------------

export async function fetchCompanies(): Promise<Company[]> {
  try {
    const { data, error } = await supabase.from("companies").select("*").order("name");
    if (!error && data && data.length > 0) {
      return data.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        logoUrl: c.logo_url,
        logoBucketPath: c.logo_bucket_path,
        address: c.address,
        phone: c.phone,
        email: c.email,
        taxRate: toNumber(c.tax_rate),
        currency: c.currency || "ZAR",
        defaultDueDay: c.default_due_day,
        paymentInstructions: c.payment_instructions,
        createdAt: c.created_at,
      }));
    }
  } catch (err) {
    console.warn("Falling back to mock companies", err);
  }
  return MOCK_COMPANIES;
}

export async function createCompany(company: Partial<Company>): Promise<Company> {
  const newCompany: Company = {
    id: `comp-${Date.now()}`,
    name: company.name || "New Hospitality Group",
    slug: company.slug || `comp-${Date.now()}`,
    logoUrl: company.logoUrl || "",
    address: company.address || "",
    phone: company.phone || "",
    email: company.email || "",
    taxRate: company.taxRate ?? 15.0,
    currency: company.currency || "ZAR",
    defaultDueDay: company.defaultDueDay ?? 1,
    paymentInstructions: company.paymentInstructions || "",
    createdAt: new Date().toISOString(),
  };

  try {
    const { data, error } = await supabase
      .from("companies")
      .insert({
        name: newCompany.name,
        slug: newCompany.slug,
        logo_url: newCompany.logoUrl,
        address: newCompany.address,
        phone: newCompany.phone,
        email: newCompany.email,
        tax_rate: newCompany.taxRate,
        currency: newCompany.currency,
        default_due_day: newCompany.defaultDueDay,
        payment_instructions: newCompany.paymentInstructions,
      })
      .select()
      .single();

    if (!error && data) {
      return {
        id: data.id,
        name: data.name,
        slug: data.slug,
        logoUrl: data.logo_url,
        address: data.address,
        phone: data.phone,
        email: data.email,
        taxRate: toNumber(data.tax_rate),
        currency: data.currency,
        defaultDueDay: data.default_due_day,
        paymentInstructions: data.payment_instructions,
      };
    }
  } catch {
    // fallback
  }

  MOCK_COMPANIES.push(newCompany);
  return newCompany;
}

export async function fetchCompanyBySlug(slug: string): Promise<Company | null> {
  const cleanSlug = slug.trim().toLowerCase();
  try {
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("slug", cleanSlug)
      .maybeSingle();

    if (!error && data) {
      return {
        id: data.id,
        name: data.name,
        slug: data.slug,
        logoUrl: data.logo_url,
        logoBucketPath: data.logo_bucket_path,
        address: data.address,
        phone: data.phone,
        email: data.email,
        taxRate: toNumber(data.tax_rate),
        currency: data.currency || "ZAR",
        defaultDueDay: data.default_due_day,
        paymentInstructions: data.payment_instructions,
        createdAt: data.created_at,
      };
    }

    // Check by ID if UUID was passed as slug
    if (isValidUuid(cleanSlug)) {
      const { data: byId } = await supabase
        .from("companies")
        .select("*")
        .eq("id", cleanSlug)
        .maybeSingle();

      if (byId) {
        return {
          id: byId.id,
          name: byId.name,
          slug: byId.slug,
          logoUrl: byId.logo_url,
          logoBucketPath: byId.logo_bucket_path,
          address: byId.address,
          phone: byId.phone,
          email: byId.email,
          taxRate: toNumber(byId.tax_rate),
          currency: byId.currency || "ZAR",
          defaultDueDay: byId.default_due_day,
          paymentInstructions: byId.payment_instructions,
          createdAt: byId.created_at,
        };
      }
    }
  } catch (err) {
    console.warn("Could not fetch company by slug from supabase", err);
  }

  const mockMatch = MOCK_COMPANIES.find(
    (c) => (c.slug && c.slug.toLowerCase() === cleanSlug) || c.id === cleanSlug
  );
  return mockMatch || null;
}

export async function fetchCompanyUsers(companyId?: string): Promise<CompanyUser[]> {
  if (!companyId) return [];

  try {
    const { data, error } = await supabase
      .from("company_users")
      .select("*, users(email, first_name, last_name)")
      .eq("company_id", companyId);

    if (!error && data) {
      return data.map((cu) => ({
        id: cu.id,
        companyId: cu.company_id,
        userId: cu.user_id,
        email: cu.users?.email || cu.email || "user@domain.com",
        fullName:
          `${cu.users?.first_name || ""} ${cu.users?.last_name || ""}`.trim() ||
          cu.full_name ||
          "Staff Member",
        department: cu.department,
        jobTitle: cu.job_title,
        roleLevel: cu.role_level,
        permissions: cu.permissions || {},
        isActive: cu.is_active,
        createdAt: cu.created_at,
      }));
    }
    if (error) {
      console.warn("Supabase fetchCompanyUsers error", error);
    }
  } catch (err) {
    console.warn("Error fetching company users", err);
  }

  // Only fall back to mock users if querying legacy company
  if (companyId === "a0000000-0000-0000-0000-000000000001") {
    return MOCK_COMPANY_USERS.filter((u) => u.companyId === companyId);
  }

  return [];
}

export async function createCompanyUser(user: Partial<CompanyUser>): Promise<CompanyUser> {
  const companyId = user.companyId;
  if (!companyId) {
    throw new Error("Missing active organization ID for user creation.");
  }
  const email = (user.email || "").trim().toLowerCase();
  if (!email) {
    throw new Error("Valid email is required.");
  }
  const fullName = (user.fullName || "New Staff Member").trim();
  const department = user.department || "front_desk";
  const jobTitle = user.jobTitle || "Front Desk - Receptionist";
  const roleLevel = user.roleLevel || "staff";
  const permissions = user.permissions || {};

  let validUserId: string = user.userId || "";
  if (!isValidUuid(validUserId)) {
    const dbUserId = await ensureDbUser(email, fullName);
    if (!dbUserId) {
      throw new Error(`Could not initialize base user account for ${email}`);
    }
    validUserId = dbUserId;
  }

  const newUser: CompanyUser = {
    id: generateUuid(),
    companyId,
    userId: validUserId,
    email,
    fullName,
    department,
    jobTitle,
    roleLevel,
    permissions,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  const dbDept = mapDepartmentToDb(department);
  const dbRole = mapRoleLevelToDb(roleLevel);

  const { data, error } = await supabase
    .from("company_users")
    .insert({
      company_id: companyId,
      user_id: validUserId,
      department: dbDept,
      job_title: jobTitle,
      role_level: dbRole,
      permissions,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Supabase insert error on company_users:", error);
    throw new Error(error.message || "Could not assign user to organization.");
  }

  if (data?.id) {
    newUser.id = data.id;
  }

  return newUser;
}

export async function deleteCompanyUser(id: string): Promise<boolean> {
  try {
    if (isValidUuid(id)) {
      await supabase.from("company_users").delete().eq("id", id);
    }
  } catch (err) {
    console.warn("Could not delete company user in Supabase", err);
  }
  const idx = MOCK_COMPANY_USERS.findIndex((u) => u.id === id);
  if (idx !== -1) {
    MOCK_COMPANY_USERS.splice(idx, 1);
  }
  return true;
}

export async function updateCompanyUser(
  id: string,
  updates: Partial<CompanyUser>
): Promise<CompanyUser | null> {
  const user = MOCK_COMPANY_USERS.find((u) => u.id === id);
  let targetUserId = updates.userId || user?.userId;

  try {
    if (isValidUuid(id)) {
      const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.department !== undefined) payload.department = mapDepartmentToDb(updates.department);
      if (updates.jobTitle !== undefined) payload.job_title = updates.jobTitle;
      if (updates.roleLevel !== undefined) payload.role_level = mapRoleLevelToDb(updates.roleLevel);
      if (updates.permissions !== undefined) payload.permissions = updates.permissions;
      if (updates.isActive !== undefined) payload.is_active = updates.isActive;

      const { data: updatedCu } = await supabase
        .from("company_users")
        .update(payload)
        .eq("id", id)
        .select("user_id")
        .maybeSingle();

      if (updatedCu?.user_id) {
        targetUserId = updatedCu.user_id;
      }

      if (updates.fullName && targetUserId) {
        const parts = updates.fullName.trim().split(" ");
        const firstName = parts[0] || "Staff";
        const lastName = parts.slice(1).join(" ") || "Member";
        await supabase
          .from("users")
          .update({ first_name: firstName, last_name: lastName })
          .eq("id", targetUserId);
      }
    }
  } catch (err) {
    console.warn("Could not update company user in Supabase", err);
  }

  if (user) {
    Object.assign(user, updates);
    return user;
  }

  return {
    id,
    companyId: updates.companyId || "",
    userId: targetUserId || "",
    email: updates.email || "",
    fullName: updates.fullName || "",
    department: updates.department || "admin",
    jobTitle: updates.jobTitle || "",
    roleLevel: updates.roleLevel || "staff",
    permissions: updates.permissions || {},
    isActive: updates.isActive ?? true,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Dispatches an official branded invitation email to a newly added staff member,
 * containing that company's unique login / password setup link.
 */
export async function sendStaffInvitation(opts: {
  company: Company;
  targetUser: {
    fullName: string;
    email: string;
    department: string;
    jobTitle: string;
  };
  inviter: {
    fullName: string;
    jobTitle: string;
  };
}): Promise<{ success: boolean; error?: string }> {
  const { company, targetUser, inviter } = opts;
  const companySlug = company.slug || company.id;
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
  const inviteUrl = `${origin}/c/${companySlug}/set-password?email=${encodeURIComponent(targetUser.email)}&action=invite`;

  const html = wrapStaffInvitationEmailHtml({
    recipientName: targetUser.fullName,
    companyName: company.name,
    companyLogo: company.logoUrl,
    jobTitle: targetUser.jobTitle,
    department: targetUser.department,
    inviteUrl,
    invitedByName: `${inviter.fullName} (${inviter.jobTitle})`,
  });

  const res = await sendEmailViaApi({
    to: targetUser.email,
    subject: `Invitation to join ${company.name} Staff Portal`,
    html,
  });

  await logAuditEvent({
    companyId: company.id,
    action: "STAFF_INVITATION_SENT",
    entityType: "company_user",
    entityName: `${targetUser.fullName} (${targetUser.email})`,
    actorName: inviter.fullName,
    details: `Sent company login invitation to ${targetUser.email} with link: ${inviteUrl}`,
  });

  return res;
}

/**
 * Triggers a staff password reset by Admin, IT, or Department Manager.
 * Sends a branded password reset link pointing to the company's unique reset portal.
 */
export async function triggerStaffPasswordReset(opts: {
  company: Company;
  targetUser: {
    fullName: string;
    email: string;
  };
  requester: {
    fullName: string;
    jobTitle: string;
  };
}): Promise<{ success: boolean; error?: string }> {
  const { company, targetUser, requester } = opts;
  const companySlug = company.slug || company.id;
  const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:5173";
  const resetUrl = `${origin}/c/${companySlug}/set-password?email=${encodeURIComponent(targetUser.email)}&action=reset`;

  const html = wrapStaffPasswordResetEmailHtml({
    recipientName: targetUser.fullName,
    companyName: company.name,
    companyLogo: company.logoUrl,
    resetUrl,
    requestedByName: requester.fullName,
    requestedByRole: requester.jobTitle,
  });

  const res = await sendEmailViaApi({
    to: targetUser.email,
    subject: `Password Reset Request - ${company.name} Staff Account`,
    html,
  });

  await logAuditEvent({
    companyId: company.id,
    action: "STAFF_PASSWORD_RESET_TRIGGERED",
    entityType: "company_user",
    entityName: `${targetUser.fullName} (${targetUser.email})`,
    actorName: requester.fullName,
    details: `Password reset link triggered by ${requester.fullName} (${requester.jobTitle}) for ${targetUser.email}. Reset URL: ${resetUrl}`,
  });

  return res;
}

export async function fetchCommercialRooms(
  companyId: string = MOCK_COMPANIES[0].id,
  propertyId?: string
): Promise<CommercialRoom[]> {
  try {
    let query = supabase
      .from("commercial_rooms")
      .select("*, properties(name)")
      .eq("company_id", companyId);

    if (propertyId) {
      query = query.eq("property_id", propertyId);
    }

    const { data, error } = await query;
    if (!error && data) {
      return data.map((r) => ({
        id: r.id,
        companyId: r.company_id,
        propertyId: r.property_id,
        propertyName: r.properties?.name || "Lodge Property",
        roomNumber: r.room_number,
        roomType: r.room_type,
        floor: r.floor || "Ground Floor",
        status: r.status,
        capacityAdults: r.capacity_adults,
        capacityChildren: r.capacity_children,
        amenities: r.amenities || [],
        photos: r.photos || [],
        pricePerNight: toNumber(r.price_per_night),
        priceBedBreakfast: toNumber(r.price_bed_breakfast),
        priceBedLunch: toNumber(r.price_bed_lunch),
        priceFullBoard: toNumber(r.price_full_board),
        notes: r.notes,
      }));
    }
  } catch (err) {
    console.warn("Could not load commercial rooms from server", err);
  }

  if (companyId === MOCK_COMPANIES[0].id || !isValidUuid(companyId)) {
    let list = MOCK_COMMERCIAL_ROOMS;
    if (propertyId) {
      list = list.filter((r) => r.propertyId === propertyId);
    }
    return list;
  }
  return [];
}

export async function saveCommercialRoom(room: Partial<CommercialRoom>): Promise<CommercialRoom> {
  const companyId = room.companyId || MOCK_COMPANIES[0].id;
  const propertyId = room.propertyId || MOCK_COMMERCIAL_ROOMS[0].propertyId;
  const roomNumber = room.roomNumber || "Room 100";
  const roomType = room.roomType || "standard";
  const floor = room.floor || "Ground Floor";
  const status = room.status || "available";
  const capacityAdults = room.capacityAdults ?? 2;
  const capacityChildren = room.capacityChildren ?? 0;
  const amenities = room.amenities || ["wifi", "tv", "ac"];
  const photos = room.photos || [];
  const pricePerNight = room.pricePerNight ?? 1000;
  const priceBedBreakfast = room.priceBedBreakfast ?? 1300;
  const priceBedLunch = room.priceBedLunch ?? 1600;
  const priceFullBoard = room.priceFullBoard ?? 2000;
  const notes = room.notes || "";

  let id = room.id;
  const isExisting = isValidUuid(id);
  if (!id || !isExisting) {
    id = generateUuid();
  }

  const updatedRoom: CommercialRoom = {
    id,
    companyId,
    propertyId,
    propertyName: room.propertyName || "Paimba Grand Safari Lodge & Hotel",
    roomNumber,
    roomType,
    floor,
    status,
    capacityAdults,
    capacityChildren,
    amenities,
    photos,
    pricePerNight,
    priceBedBreakfast,
    priceBedLunch,
    priceFullBoard,
    notes,
  };

  try {
    if (isValidUuid(companyId) && isValidUuid(propertyId)) {
      const payload = {
        company_id: companyId,
        property_id: propertyId,
        room_number: roomNumber,
        room_type: roomType,
        floor,
        status,
        capacity_adults: capacityAdults,
        capacity_children: capacityChildren,
        amenities,
        photos,
        price_per_night: pricePerNight,
        price_bed_breakfast: priceBedBreakfast,
        price_bed_lunch: priceBedLunch,
        price_full_board: priceFullBoard,
        notes,
        updated_at: new Date().toISOString(),
      };

      if (isExisting) {
        await supabase.from("commercial_rooms").update(payload).eq("id", id);
      } else {
        const { data, error } = await supabase
          .from("commercial_rooms")
          .insert({ id, ...payload })
          .select()
          .single();
        if (!error && data) {
          updatedRoom.id = data.id;
        }
      }
    }
  } catch (err) {
    console.warn("Could not save commercial room to Supabase", err);
  }

  const existingIdx = MOCK_COMMERCIAL_ROOMS.findIndex((r) => r.id === updatedRoom.id);
  if (existingIdx !== -1) {
    MOCK_COMMERCIAL_ROOMS[existingIdx] = updatedRoom;
  } else {
    MOCK_COMMERCIAL_ROOMS.push(updatedRoom);
  }
  return updatedRoom;
}

export async function setUniformRoomPricing(
  propertyId: string,
  prices: {
    pricePerNight: number;
    priceBedBreakfast: number;
    priceBedLunch: number;
    priceFullBoard: number;
  }
): Promise<boolean> {
  try {
    if (isValidUuid(propertyId)) {
      await Promise.all([
        supabase
          .from("properties")
          .update({
            uniform_room_pricing: true,
            default_room_price: prices.pricePerNight,
            default_bed_breakfast: prices.priceBedBreakfast,
            default_bed_lunch: prices.priceBedLunch,
            default_full_board: prices.priceFullBoard,
          })
          .eq("id", propertyId),
        supabase
          .from("commercial_rooms")
          .update({
            price_per_night: prices.pricePerNight,
            price_bed_breakfast: prices.priceBedBreakfast,
            price_bed_lunch: prices.priceBedLunch,
            price_full_board: prices.priceFullBoard,
            updated_at: new Date().toISOString(),
          })
          .eq("property_id", propertyId),
      ]);
    }
  } catch (err) {
    console.warn("Could not set uniform room pricing in Supabase", err);
  }

  MOCK_COMMERCIAL_ROOMS.forEach((r) => {
    if (r.propertyId === propertyId) {
      r.pricePerNight = prices.pricePerNight;
      r.priceBedBreakfast = prices.priceBedBreakfast;
      r.priceBedLunch = prices.priceBedLunch;
      r.priceFullBoard = prices.priceFullBoard;
    }
  });

  return true;
}

export async function fetchCommercialBookings(companyId: string = MOCK_COMPANIES[0].id): Promise<CommercialBooking[]> {
  try {
    const { data, error } = await supabase
      .from("commercial_bookings")
      .select("*, properties(name), commercial_rooms(room_number, room_type)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      return data.map((b) => ({
        id: b.id,
        companyId: b.company_id,
        propertyId: b.property_id,
        propertyName: b.properties?.name || "Lodge Property",
        roomId: b.room_id,
        roomNumber: b.commercial_rooms?.room_number || "Room",
        roomType: b.commercial_rooms?.room_type || "standard",
        bookingCode: b.booking_code,
        guestName: b.guest_name,
        guestPhone: b.guest_phone,
        guestEmail: b.guest_email,
        guestIdNumber: b.guest_id_number,
        checkInDate: b.check_in_date,
        checkOutDate: b.check_out_date,
        actualCheckIn: b.actual_check_in,
        actualCheckOut: b.actual_check_out,
        mealPlan: b.meal_plan,
        nights: b.nights,
        ratePerNight: toNumber(b.rate_per_night),
        totalAmount: toNumber(b.total_amount),
        depositAmount: toNumber(b.deposit_amount),
        amountPaid: toNumber(b.amount_paid),
        paymentMethod: b.payment_method,
        paymentStatus: b.payment_status,
        bookingStatus: b.booking_status,
        isExtended: b.is_extended,
        extensionHistory: b.extension_history || [],
        checkedInByName: b.checked_in_by_name,
        notes: b.notes,
        createdAt: b.created_at,
      }));
    }
  } catch (err) {
    console.warn("Could not load bookings from server", err);
  }

  if (companyId === MOCK_COMPANIES[0].id || !isValidUuid(companyId)) {
    return MOCK_COMMERCIAL_BOOKINGS.filter((b) => b.companyId === companyId);
  }
  return [];
}

export async function createInstantCheckin(params: {
  companyId: string;
  propertyId: string;
  propertyName: string;
  roomId: string;
  roomNumber: string;
  roomType: string;
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  guestIdNumber: string;
  checkInDate: string;
  checkOutDate: string;
  mealPlan: MealPlan;
  nights: number;
  ratePerNight: number;
  totalAmount: number;
  depositAmount: number;
  amountPaid: number;
  paymentMethod: string;
  checkedInByName: string;
  notes?: string;
}): Promise<CommercialBooking> {
  const bookingCode = generateInstantBookingCode("BK");
  const newBookingId = generateUuid();

  const newBooking: CommercialBooking = {
    id: newBookingId,
    companyId: params.companyId,
    propertyId: params.propertyId,
    propertyName: params.propertyName,
    roomId: params.roomId,
    roomNumber: params.roomNumber,
    roomType: params.roomType,
    bookingCode,
    guestName: params.guestName,
    guestPhone: params.guestPhone,
    guestEmail: params.guestEmail || "",
    guestIdNumber: params.guestIdNumber,
    checkInDate: params.checkInDate,
    checkOutDate: params.checkOutDate,
    actualCheckIn: new Date().toISOString(),
    mealPlan: params.mealPlan,
    nights: params.nights,
    ratePerNight: params.ratePerNight,
    totalAmount: params.totalAmount,
    depositAmount: params.depositAmount,
    amountPaid: params.amountPaid,
    paymentMethod: params.paymentMethod,
    paymentStatus: params.amountPaid >= params.totalAmount ? "paid" : (params.amountPaid > 0 ? "partial" : "pending"),
    bookingStatus: "checked_in",
    isExtended: false,
    extensionHistory: [],
    checkedInByName: params.checkedInByName,
    notes: params.notes || "",
    createdAt: new Date().toISOString(),
  };

  try {
    if (isValidUuid(params.companyId) && isValidUuid(params.propertyId) && isValidUuid(params.roomId)) {
      const { data, error } = await supabase
        .from("commercial_bookings")
        .insert({
          id: newBookingId,
          company_id: params.companyId,
          property_id: params.propertyId,
          room_id: params.roomId,
          booking_code: bookingCode,
          guest_name: params.guestName,
          guest_email: params.guestEmail || null,
          guest_phone: params.guestPhone,
          guest_id_number: params.guestIdNumber || null,
          meal_plan: params.mealPlan,
          check_in_date: params.checkInDate.slice(0, 10),
          check_out_date: params.checkOutDate.slice(0, 10),
          actual_check_in: new Date().toISOString(),
          status: "checked_in",
          rate_per_night: params.ratePerNight,
          total_amount: params.totalAmount,
          paid_amount: params.amountPaid,
          payment_status: params.amountPaid >= params.totalAmount ? "paid" : "partially_paid",
          payment_method: params.paymentMethod,
          special_requests: params.notes || null,
        })
        .select()
        .single();

      if (!error && data) {
        newBooking.id = data.id;
      }

      await supabase
        .from("commercial_rooms")
        .update({ status: "occupied", updated_at: new Date().toISOString() })
        .eq("id", params.roomId);
    }
  } catch (err) {
    console.warn("Could not insert commercial booking in Supabase", err);
  }

  MOCK_COMMERCIAL_BOOKINGS.unshift(newBooking);
  const room = MOCK_COMMERCIAL_ROOMS.find((r) => r.id === params.roomId);
  if (room) {
    room.status = "occupied";
  }

  await logAuditEvent({
    companyId: params.companyId,
    action: "CHECKIN_GUEST",
    entityType: "commercial_booking",
    entityId: newBooking.id,
    entityName: `${params.guestName} (${params.roomNumber})`,
    actorName: params.checkedInByName,
    details: `Checked in guest ${params.guestName} into ${params.roomNumber}. Booking Code: ${bookingCode}. Total: R${params.totalAmount}.`,
  });

  return newBooking;
}

export async function verifyAndCheckinBookingCode(
  bookingCode: string,
  actorName: string
): Promise<{ success: boolean; booking?: CommercialBooking; error?: string }> {
  const normalizedCode = bookingCode.trim().toUpperCase();

  try {
    const { data: dbBooking, error: fetchErr } = await supabase
      .from("commercial_bookings")
      .select("*, properties(name), commercial_rooms(room_number, room_type)")
      .eq("booking_code", normalizedCode)
      .maybeSingle();

    if (!fetchErr && dbBooking) {
      await Promise.all([
        supabase
          .from("commercial_bookings")
          .update({
            status: "checked_in",
            actual_check_in: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", dbBooking.id),
        supabase
          .from("commercial_rooms")
          .update({ status: "occupied", updated_at: new Date().toISOString() })
          .eq("id", dbBooking.room_id),
      ]);

      const booking: CommercialBooking = {
        id: dbBooking.id,
        companyId: dbBooking.company_id,
        propertyId: dbBooking.property_id,
        propertyName: dbBooking.properties?.name || "Lodge Property",
        roomId: dbBooking.room_id,
        roomNumber: dbBooking.commercial_rooms?.room_number || "Room",
        roomType: dbBooking.commercial_rooms?.room_type || "standard",
        bookingCode: dbBooking.booking_code,
        guestName: dbBooking.guest_name,
        guestPhone: dbBooking.guest_phone,
        guestEmail: dbBooking.guest_email || "",
        guestIdNumber: dbBooking.guest_id_number || "",
        checkInDate: dbBooking.check_in_date,
        checkOutDate: dbBooking.check_out_date,
        actualCheckIn: new Date().toISOString(),
        mealPlan: dbBooking.meal_plan,
        nights: 1,
        ratePerNight: toNumber(dbBooking.rate_per_night),
        totalAmount: toNumber(dbBooking.total_amount),
        depositAmount: 0,
        amountPaid: toNumber(dbBooking.paid_amount),
        paymentMethod: dbBooking.payment_method || "card",
        paymentStatus: dbBooking.payment_status,
        bookingStatus: "checked_in",
        isExtended: false,
        extensionHistory: [],
        checkedInByName: actorName,
        notes: dbBooking.special_requests || "",
        createdAt: dbBooking.created_at,
      };

      await logAuditEvent({
        companyId: booking.companyId,
        action: "ONLINE_CODE_CHECKIN",
        entityType: "commercial_booking",
        entityId: booking.id,
        entityName: `${booking.guestName} (${booking.roomNumber})`,
        actorName,
        details: `Checked in verified online booking ${booking.bookingCode} for guest ${booking.guestName}.`,
      });

      return { success: true, booking };
    }
  } catch (err) {
    console.warn("Supabase lookup failed for booking code, checking local mock", err);
  }

  let booking = MOCK_COMMERCIAL_BOOKINGS.find(
    (b) => b.bookingCode.toUpperCase() === normalizedCode
  );

  if (!booking) {
    return { success: false, error: "Booking code not found in the system." };
  }

  booking.bookingStatus = "checked_in";
  booking.actualCheckIn = new Date().toISOString();
  booking.checkedInByName = actorName;

  const room = MOCK_COMMERCIAL_ROOMS.find((r) => r.id === booking!.roomId);
  if (room) {
    room.status = "occupied";
  }

  await logAuditEvent({
    companyId: booking.companyId,
    action: "ONLINE_CODE_CHECKIN",
    entityType: "commercial_booking",
    entityId: booking.id,
    entityName: `${booking.guestName} (${booking.roomNumber})`,
    actorName,
    details: `Checked in verified online booking ${booking.bookingCode} for guest ${booking.guestName}.`,
  });

  return { success: true, booking };
}

export async function extendCommercialBooking(params: {
  bookingId: string;
  newCheckOutDate: string;
  additionalNights: number;
  additionalCost: number;
  actorName: string;
  notes?: string;
}): Promise<boolean> {
  const booking = MOCK_COMMERCIAL_BOOKINGS.find((b) => b.id === params.bookingId);

  try {
    if (isValidUuid(params.bookingId)) {
      const { data: cur } = await supabase
        .from("commercial_bookings")
        .select("total_amount, check_out_date")
        .eq("id", params.bookingId)
        .maybeSingle();

      const newTotal = (toNumber(cur?.total_amount) || (booking?.totalAmount || 0)) + params.additionalCost;

      await supabase
        .from("commercial_bookings")
        .update({
          check_out_date: params.newCheckOutDate.slice(0, 10),
          total_amount: newTotal,
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.bookingId);
    }
  } catch (err) {
    console.warn("Could not extend booking in Supabase", err);
  }

  if (booking) {
    const previousCheckOut = booking.checkOutDate;
    booking.checkOutDate = params.newCheckOutDate;
    booking.nights += params.additionalNights;
    booking.totalAmount += params.additionalCost;
    booking.isExtended = true;
    booking.bookingStatus = "extended";

    booking.extensionHistory.push({
      extendedAt: new Date().toISOString(),
      previousCheckOutDate: previousCheckOut,
      newCheckOutDate: params.newCheckOutDate,
      additionalNights: params.additionalNights,
      additionalCost: params.additionalCost,
      extendedBy: params.actorName,
      notes: params.notes,
    });
  }

  await logAuditEvent({
    companyId: booking?.companyId,
    action: "EXTEND_BOOKING",
    entityType: "commercial_booking",
    entityId: params.bookingId,
    entityName: booking ? `${booking.guestName} (${booking.roomNumber})` : params.bookingId,
    actorName: params.actorName,
    details: `Extended stay by ${params.additionalNights} nights to ${params.newCheckOutDate}. Added cost: R${params.additionalCost}.`,
  });

  return true;
}

export async function checkoutCommercialBooking(
  bookingId: string,
  actorName: string
): Promise<boolean> {
  let booking = MOCK_COMMERCIAL_BOOKINGS.find((b) => b.id === bookingId);

  try {
    if (isValidUuid(bookingId)) {
      const { data: dbBooking } = await supabase
        .from("commercial_bookings")
        .select("*, properties(name), commercial_rooms(room_number)")
        .eq("id", bookingId)
        .maybeSingle();

      if (dbBooking) {
        await Promise.all([
          supabase
            .from("commercial_bookings")
            .update({
              status: "checked_out",
              actual_check_out: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", bookingId),
          supabase
            .from("commercial_rooms")
            .update({ status: "cleaning_needed", updated_at: new Date().toISOString() })
            .eq("id", dbBooking.room_id),
          supabase
            .from("housekeeping_schedules")
            .insert({
              company_id: dbBooking.company_id,
              property_id: dbBooking.property_id,
              room_id: dbBooking.room_id,
              task_type: "turnover",
              status: "pending",
              priority: "high",
              scheduled_date: new Date().toISOString().slice(0, 10),
              notes: `Turnover cleaning after checkout of ${dbBooking.guest_name}.`,
            }),
        ]);
      }
    }
  } catch (err) {
    console.warn("Could not checkout booking in Supabase", err);
  }

  if (booking) {
    booking.bookingStatus = "checked_out";
    booking.actualCheckOut = new Date().toISOString();

    const room = MOCK_COMMERCIAL_ROOMS.find((r) => r.id === booking.roomId);
    if (room) {
      room.status = "cleaning_needed";
    }

    MOCK_HOUSEKEEPING.unshift({
      id: generateUuid(),
      companyId: booking.companyId,
      propertyId: booking.propertyId,
      propertyName: booking.propertyName,
      roomId: booking.roomId,
      roomNumber: booking.roomNumber,
      cleanerName: "Housekeeping Team",
      cleaningType: "turnover_clean",
      status: "pending",
      scheduledDate: new Date().toISOString().slice(0, 10),
      shift: "turnover",
      priority: "high",
      notes: `Turnover cleaning after checkout of ${booking.guestName}.`,
      createdAt: new Date().toISOString(),
    });
  }

  await logAuditEvent({
    companyId: booking?.companyId,
    action: "CHECKOUT_GUEST",
    entityType: "commercial_booking",
    entityId: bookingId,
    entityName: booking ? `${booking.guestName} (${booking.roomNumber})` : bookingId,
    actorName,
    details: `Completed checkout for ${booking?.guestName || "Guest"} from ${booking?.roomNumber || "Room"}. Room flagged for turnover cleaning.`,
  });

  return true;
}

export async function deleteCommercialRoom(roomId: string): Promise<boolean> {
  try {
    if (isValidUuid(roomId)) {
      const { error } = await supabase.from("commercial_rooms").delete().eq("id", roomId);
      if (error) throw error;
    }
  } catch (err) {
    console.warn("Could not delete commercial room from Supabase", err);
  }

  const idx = MOCK_COMMERCIAL_ROOMS.findIndex((r) => r.id === roomId);
  if (idx !== -1) {
    MOCK_COMMERCIAL_ROOMS.splice(idx, 1);
  }
  return true;
}

export async function updateCommercialBooking(
  bookingId: string,
  updates: Partial<CommercialBooking>
): Promise<CommercialBooking | null> {
  const booking = MOCK_COMMERCIAL_BOOKINGS.find((b) => b.id === bookingId);

  try {
    if (isValidUuid(bookingId)) {
      const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.guestName !== undefined) payload.guest_name = updates.guestName;
      if (updates.guestPhone !== undefined) payload.guest_phone = updates.guestPhone;
      if (updates.guestEmail !== undefined) payload.guest_email = updates.guestEmail;
      if (updates.guestIdNumber !== undefined) payload.guest_id_number = updates.guestIdNumber;
      if (updates.roomId !== undefined) payload.room_id = updates.roomId;
      if (updates.checkInDate !== undefined) payload.check_in_date = updates.checkInDate.slice(0, 10);
      if (updates.checkOutDate !== undefined) payload.check_out_date = updates.checkOutDate.slice(0, 10);
      if (updates.mealPlan !== undefined) payload.meal_plan = updates.mealPlan;
      if (updates.nights !== undefined) payload.nights = updates.nights;
      if (updates.ratePerNight !== undefined) payload.rate_per_night = updates.ratePerNight;
      if (updates.totalAmount !== undefined) payload.total_amount = updates.totalAmount;
      if (updates.depositAmount !== undefined) payload.deposit_amount = updates.depositAmount;
      if (updates.amountPaid !== undefined) {
        payload.amount_paid = updates.amountPaid;
        payload.paid_amount = updates.amountPaid;
      }
      if (updates.paymentMethod !== undefined) payload.payment_method = updates.paymentMethod;
      if (updates.paymentStatus !== undefined) payload.payment_status = updates.paymentStatus;
      if (updates.bookingStatus !== undefined) {
        payload.booking_status = updates.bookingStatus;
      }
      if (updates.notes !== undefined) {
        payload.notes = updates.notes;
      }

      await supabase.from("commercial_bookings").update(payload).eq("id", bookingId);

      // Handle room re-assignment
      if (updates.roomId && updates.roomId !== booking?.roomId) {
        if (booking?.roomId) {
          await supabase.from("commercial_rooms").update({ status: "available" }).eq("id", booking.roomId);
          const oldRm = MOCK_COMMERCIAL_ROOMS.find((r) => r.id === booking.roomId);
          if (oldRm) oldRm.status = "available";
        }
        if (updates.bookingStatus === "checked_in" || updates.bookingStatus === "extended" || (!updates.bookingStatus && (booking?.bookingStatus === "checked_in" || booking?.bookingStatus === "extended"))) {
          await supabase.from("commercial_rooms").update({ status: "occupied" }).eq("id", updates.roomId);
          const newRm = MOCK_COMMERCIAL_ROOMS.find((r) => r.id === updates.roomId);
          if (newRm) newRm.status = "occupied";
        }
      }

      // Handle booking status change on room
      if (updates.bookingStatus === "checked_out") {
        const targetRoomId = updates.roomId || booking?.roomId;
        if (targetRoomId) {
          await supabase.from("commercial_rooms").update({ status: "cleaning_needed" }).eq("id", targetRoomId);
          const rm = MOCK_COMMERCIAL_ROOMS.find((r) => r.id === targetRoomId);
          if (rm) rm.status = "cleaning_needed";
        }
      } else if (updates.bookingStatus === "cancelled") {
        const targetRoomId = updates.roomId || booking?.roomId;
        if (targetRoomId) {
          await supabase.from("commercial_rooms").update({ status: "available" }).eq("id", targetRoomId);
          const rm = MOCK_COMMERCIAL_ROOMS.find((r) => r.id === targetRoomId);
          if (rm) rm.status = "available";
        }
      }
    }
  } catch (err) {
    console.warn("Could not update commercial booking in Supabase", err);
  }

  if (booking) {
    Object.assign(booking, updates);
    if (updates.roomId) {
      const targetRoom = MOCK_COMMERCIAL_ROOMS.find((r) => r.id === updates.roomId);
      if (targetRoom) {
        booking.roomNumber = targetRoom.roomNumber;
        booking.roomType = targetRoom.roomType;
        booking.propertyName = targetRoom.propertyName;
        booking.propertyId = targetRoom.propertyId;
      }
    }
  }

  return booking || null;
}

// --------------------------------------------------------------------------------------
// PROPERTY FLOORS PERSISTENCE
// --------------------------------------------------------------------------------------
export async function fetchPropertyFloors(companyId: string, propertyId: string): Promise<string[]> {
  if (propertyId) {
    const stored = localStorage.getItem(`cc_property_floors_${propertyId}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
  }

  try {
    if (isValidUuid(propertyId)) {
      const { data } = await supabase
        .from("commercial_rooms")
        .select("floor")
        .eq("property_id", propertyId);
      if (data && data.length > 0) {
        const distinct = Array.from(
          new Set(data.map((r) => r.floor).filter((f): f is string => Boolean(f && f.trim())))
        );
        if (distinct.length > 0) {
          localStorage.setItem(`cc_property_floors_${propertyId}`, JSON.stringify(distinct));
          return distinct;
        }
      }
    }
  } catch {}

  return ["Ground Floor", "1st Floor", "2nd Floor"];
}

export async function savePropertyFloors(companyId: string, propertyId: string, floors: string[]): Promise<void> {
  const clean = Array.from(new Set(floors.map((f) => f.trim()).filter(Boolean)));
  if (clean.length === 0) clean.push("Ground Floor");
  localStorage.setItem(`cc_property_floors_${propertyId}`, JSON.stringify(clean));
}

// --------------------------------------------------------------------------------------
// SECURITY PIN CRYPTOGRAPHIC HELPERS & ACCESS CONTROL
// --------------------------------------------------------------------------------------
export async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin.trim());
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hasUserPin(userIdOrEmail: string): Promise<boolean> {
  if (!userIdOrEmail) return false;
  if (localStorage.getItem(`cc_user_pin_${userIdOrEmail}`)) return true;

  try {
    let query = supabase.from("users").select("signature_pincode_hash");
    if (isValidUuid(userIdOrEmail)) {
      query = query.eq("id", userIdOrEmail);
    } else {
      query = query.eq("email", userIdOrEmail);
    }
    const { data } = await query.maybeSingle();
    if (data?.signature_pincode_hash) {
      localStorage.setItem(`cc_user_pin_${userIdOrEmail}`, data.signature_pincode_hash);
      return true;
    }
  } catch {}
  return false;
}

export async function verifyUserPin(userIdOrEmail: string, pin: string): Promise<boolean> {
  if (!pin || !userIdOrEmail) return false;
  const hashed = await hashPin(pin);

  const cachedHash = localStorage.getItem(`cc_user_pin_${userIdOrEmail}`);
  if (cachedHash && cachedHash === hashed) {
    return true;
  }

  try {
    let query = supabase.from("users").select("signature_pincode_hash");
    if (isValidUuid(userIdOrEmail)) {
      query = query.eq("id", userIdOrEmail);
    } else {
      query = query.eq("email", userIdOrEmail);
    }
    const { data, error } = await query.maybeSingle();
    if (!error && data?.signature_pincode_hash) {
      localStorage.setItem(`cc_user_pin_${userIdOrEmail}`, data.signature_pincode_hash);
      return data.signature_pincode_hash === hashed;
    }
  } catch (err) {
    console.warn("Could not verify PIN against database", err);
  }

  // Demo fallback for initial setup if no PIN yet
  if (!cachedHash) {
    const demoDefaultHash = await hashPin("1234");
    if (hashed === demoDefaultHash) return true;
  }

  return false;
}

export async function setUserPin(
  userIdOrEmail: string,
  newPin: string,
  oldPin?: string
): Promise<{ ok: boolean; message?: string }> {
  if (!newPin || newPin.trim().length < 4) {
    return { ok: false, message: "New PIN must be at least 4 digits" };
  }

  const alreadyHasPin = await hasUserPin(userIdOrEmail);
  if (alreadyHasPin) {
    if (!oldPin) {
      return { ok: false, message: "Please enter your current PIN to change it." };
    }
    const isOldValid = await verifyUserPin(userIdOrEmail, oldPin);
    if (!isOldValid) {
      return { ok: false, message: "Incorrect current PIN entered." };
    }
  }

  const hashed = await hashPin(newPin);
  const now = new Date().toISOString();

  try {
    let query = supabase.from("users").update({
      signature_pincode_hash: hashed,
      signature_updated_at: now,
    });
    if (isValidUuid(userIdOrEmail)) {
      query = query.eq("id", userIdOrEmail);
    } else {
      query = query.eq("email", userIdOrEmail);
    }
    const { error } = await query;
    if (error) {
      console.warn("Could not update PIN in database", error);
    }
  } catch (err) {
    console.warn("Database update error for PIN", err);
  }

  localStorage.setItem(`cc_user_pin_${userIdOrEmail}`, hashed);
  return { ok: true };
}

export async function resetUserPinByPrivilege(
  actor: { roleLevel?: string; department?: string; email?: string },
  targetUser: { id: string; email: string; roleLevel?: string; department?: string },
  newPin: string
): Promise<{ ok: boolean; message?: string }> {
  if (!newPin || newPin.trim().length < 4) {
    return { ok: false, message: "PIN must be at least 4 digits" };
  }

  const isActorSuperAdminOrAdmin =
    actor.roleLevel === "super_admin" ||
    actor.roleLevel === "admin" ||
    actor.department === "admin";
  const isActorIT = actor.department === "it";
  const isActorManager = actor.roleLevel === "manager" || actor.department === "manager";

  if (!isActorSuperAdminOrAdmin && !isActorIT && !isActorManager) {
    return { ok: false, message: "Unauthorized: You do not have rights to reset PINs." };
  }

  if (isActorManager && !isActorSuperAdminOrAdmin && !isActorIT) {
    if (
      targetUser.roleLevel === "super_admin" ||
      targetUser.roleLevel === "admin" ||
      targetUser.department === "admin"
    ) {
      return { ok: false, message: "Managers cannot reset PINs for Administrators." };
    }
  }

  const hashed = await hashPin(newPin);
  const now = new Date().toISOString();

  try {
    let query = supabase.from("users").update({
      signature_pincode_hash: hashed,
      signature_updated_at: now,
    });
    if (isValidUuid(targetUser.id)) {
      query = query.eq("id", targetUser.id);
    } else {
      query = query.eq("email", targetUser.email);
    }
    await query;
  } catch (err) {
    console.warn("Could not reset PIN in DB", err);
  }

  localStorage.setItem(`cc_user_pin_${targetUser.id}`, hashed);
  localStorage.setItem(`cc_user_pin_${targetUser.email}`, hashed);

  return { ok: true };
}

export async function fetchHousekeepingSchedules(
  companyId: string = MOCK_COMPANIES[0].id
): Promise<HousekeepingSchedule[]> {
  try {
    let query = supabase
      .from("housekeeping_schedules")
      .select("*, properties(name), commercial_rooms(room_number)");

    if (isValidUuid(companyId)) {
      query = query.eq("company_id", companyId);
    }

    const { data, error } = await query.order("scheduled_date", { ascending: false });
    if (!error && data && data.length > 0) {
      return data.map((h) => ({
        id: h.id,
        companyId: h.company_id,
        propertyId: h.property_id,
        propertyName: h.properties?.name || "Paimba Grand Safari Lodge",
        roomId: h.room_id,
        roomNumber: h.commercial_rooms?.room_number || "Room",
        cleanerName: "Housekeeping Team",
        cleaningType: h.task_type === "turnover" ? "turnover_clean" : (h.task_type === "daily_clean" ? "daily_tidy" : "deep_clean"),
        status: h.status === "completed" ? "completed" : (h.status === "inspected" ? "verified" : (h.status === "in_progress" ? "in_progress" : "pending")),
        scheduledDate: h.scheduled_date,
        shift: "morning",
        priority: h.priority === "urgent" || h.priority === "high" ? "high" : "normal",
        notes: h.notes || "",
        createdAt: h.created_at,
      }));
    }
  } catch (err) {
    console.warn("Falling back to mock housekeeping", err);
  }

  return MOCK_HOUSEKEEPING.filter((h) => h.companyId === companyId || !h.companyId);
}

export async function updateHousekeepingStatus(
  id: string,
  status: HousekeepingSchedule["status"],
  actorName: string
): Promise<boolean> {
  try {
    if (isValidUuid(id)) {
      const dbStatus = status === "verified" ? "inspected" : (status === "completed" ? "completed" : (status === "in_progress" ? "in_progress" : "pending"));
      const updatePayload: Record<string, unknown> = {
        status: dbStatus,
      };
      if (status === "completed" || status === "verified") {
        updatePayload.completed_at = new Date().toISOString();
      }

      const { data: schedule } = await supabase
        .from("housekeeping_schedules")
        .update(updatePayload)
        .eq("id", id)
        .select("room_id")
        .maybeSingle();

      if ((status === "completed" || status === "verified") && schedule?.room_id) {
        await supabase
          .from("commercial_rooms")
          .update({ status: "available", updated_at: new Date().toISOString() })
          .eq("id", schedule.room_id);
      }
    }
  } catch (err) {
    console.warn("Could not update housekeeping in Supabase", err);
  }

  const item = MOCK_HOUSEKEEPING.find((h) => h.id === id);
  if (item) {
    item.status = status;
    if (status === "completed" || status === "verified") {
      item.completedAt = new Date().toISOString();
      const room = MOCK_COMMERCIAL_ROOMS.find((r) => r.id === item.roomId);
      if (room && room.status === "cleaning_needed") {
        room.status = "available";
      }
    }
  }
  return true;
}

export async function fetchRoomServiceSchedules(
  companyId: string = MOCK_COMPANIES[0].id
): Promise<RoomServiceSchedule[]> {
  try {
    let query = supabase
      .from("room_service_schedules")
      .select("*, properties(name), commercial_rooms(room_number)");

    if (isValidUuid(companyId)) {
      query = query.eq("company_id", companyId);
    }

    const { data, error } = await query.order("scheduled_for", { ascending: false });
    if (!error && data && data.length > 0) {
      return data.map((rs) => ({
        id: rs.id,
        companyId: rs.company_id,
        propertyId: rs.property_id,
        propertyName: rs.properties?.name || "Paimba Grand Safari Lodge",
        roomId: rs.room_id,
        roomNumber: rs.commercial_rooms?.room_number || "Room",
        guestName: "In-house Guest",
        serviceType: rs.service_type === "meal_delivery" ? "breakfast_delivery" : "custom",
        items: Array.isArray(rs.items) ? rs.items : [],
        scheduledTime: rs.scheduled_for,
        status: (["requested", "preparing", "out_for_delivery", "delivered", "cancelled"].includes(rs.status) ? rs.status : "requested") as RoomServiceSchedule["status"],
        cost: toNumber(rs.total_charge),
        deliveredAt: rs.delivered_at,
        notes: rs.special_instructions || "",
        createdAt: rs.created_at,
      }));
    }
  } catch (err) {
    console.warn("Falling back to mock room service", err);
  }

  return MOCK_ROOM_SERVICE.filter((rs) => rs.companyId === companyId || !rs.companyId);
}

export async function createRoomServiceOrder(order: Partial<RoomServiceSchedule>): Promise<RoomServiceSchedule> {
  const companyId = order.companyId || MOCK_COMPANIES[0].id;
  const propertyId = order.propertyId || MOCK_COMMERCIAL_ROOMS[0].propertyId;
  const roomId = order.roomId || MOCK_COMMERCIAL_ROOMS[0].id;
  const newId = generateUuid();

  const newOrder: RoomServiceSchedule = {
    id: newId,
    companyId,
    propertyId,
    propertyName: order.propertyName || "Paimba Grand Safari Lodge & Hotel",
    roomId,
    roomNumber: order.roomNumber || "Room 101",
    guestName: order.guestName || "In-house Guest",
    serviceType: order.serviceType || "breakfast_delivery",
    items: order.items || [{ name: "Standard Meal Tray", quantity: 1, unitPrice: 150 }],
    scheduledTime: order.scheduledTime || new Date().toISOString(),
    status: "requested",
    cost: order.cost ?? 150,
    notes: order.notes || "",
    createdAt: new Date().toISOString(),
  };

  try {
    if (isValidUuid(companyId) && isValidUuid(propertyId) && isValidUuid(roomId)) {
      const { data, error } = await supabase
        .from("room_service_schedules")
        .insert({
          id: newId,
          company_id: companyId,
          property_id: propertyId,
          room_id: roomId,
          service_type: "meal_delivery",
          items: newOrder.items,
          status: "pending",
          total_charge: newOrder.cost,
          scheduled_for: newOrder.scheduledTime,
          special_instructions: newOrder.notes || null,
        })
        .select()
        .single();

      if (!error && data) {
        newOrder.id = data.id;
      }
    }
  } catch (err) {
    console.warn("Could not insert room service in Supabase", err);
  }

  MOCK_ROOM_SERVICE.unshift(newOrder);
  return newOrder;
}

export async function fetchSalaryScales(companyId: string = MOCK_COMPANIES[0].id): Promise<SalaryScale[]> {
  try {
    let query = supabase.from("hr_salary_scales").select("*");
    if (isValidUuid(companyId)) {
      query = query.eq("company_id", companyId);
    }
    const { data, error } = await query.order("department");
    if (!error && data) {
      return data.map((s) => ({
        id: s.id,
        companyId: s.company_id,
        department: s.department as DepartmentType,
        jobTitle: s.job_title,
        gradeLevel: "Standard",
        minSalary: toNumber(s.base_salary_min),
        midSalary: (toNumber(s.base_salary_min) + toNumber(s.base_salary_max)) / 2,
        maxSalary: toNumber(s.base_salary_max),
        housingAllowance: 1500,
        transportAllowance: 1000,
        medicalAllowance: 800,
        taxDeductionPct: 15.0,
        pensionDeductionPct: 5.0,
      }));
    }
  } catch (err) {
    console.warn("Could not load salary scales from server", err);
  }
  if (companyId === MOCK_COMPANIES[0].id || !isValidUuid(companyId)) {
    return MOCK_SALARY_SCALES;
  }
  return [];
}

export async function saveSalaryScale(scale: Partial<SalaryScale>): Promise<SalaryScale> {
  const companyId = scale.companyId || MOCK_COMPANIES[0].id;
  const department = scale.department || "front_desk";
  const jobTitle = scale.jobTitle || "Front Desk - Staff";
  const minSalary = scale.minSalary ?? 12000;
  const maxSalary = scale.maxSalary ?? 18000;

  const updated: SalaryScale = {
    id: scale.id || generateUuid(),
    companyId,
    department,
    jobTitle,
    gradeLevel: scale.gradeLevel || "Band B1",
    minSalary,
    midSalary: scale.midSalary ?? ((minSalary + maxSalary) / 2),
    maxSalary,
    housingAllowance: scale.housingAllowance ?? 1500,
    transportAllowance: scale.transportAllowance ?? 1000,
    medicalAllowance: scale.medicalAllowance ?? 800,
    taxDeductionPct: scale.taxDeductionPct ?? 15.0,
    pensionDeductionPct: scale.pensionDeductionPct ?? 5.0,
  };

  try {
    if (isValidUuid(companyId)) {
      const dbDept = mapDepartmentToDb(department);
      await supabase.from("hr_salary_scales").upsert(
        {
          company_id: companyId,
          department: dbDept,
          job_title: jobTitle,
          base_salary_min: minSalary,
          base_salary_max: maxSalary,
          currency: "ZAR",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "company_id,department,job_title" }
      );
    }
  } catch (err) {
    console.warn("Could not save salary scale in Supabase", err);
  }

  const existingIdx = MOCK_SALARY_SCALES.findIndex(
    (s) => s.department === department && s.jobTitle === jobTitle
  );
  if (existingIdx !== -1) {
    MOCK_SALARY_SCALES[existingIdx] = updated;
  } else {
    MOCK_SALARY_SCALES.push(updated);
  }
  return updated;
}

export async function fetchPayslips(companyId: string = MOCK_COMPANIES[0].id, payPeriod?: string): Promise<Payslip[]> {
  try {
    let query = supabase
      .from("hr_payslips")
      .select("*, users(first_name, last_name, email)");

    if (isValidUuid(companyId)) {
      query = query.eq("company_id", companyId);
    }
    if (payPeriod) {
      const parts = payPeriod.split("-");
      if (parts.length === 2) {
        query = query.eq("period_year", parseInt(parts[0])).eq("period_month", parseInt(parts[1]));
      }
    }

    const { data, error } = await query.order("created_at", { ascending: false });
    if (!error && data) {
      return data.map((p) => {
        const fullName = `${p.users?.first_name || ""} ${p.users?.last_name || ""}`.trim() || p.users?.email || "Employee";
        return {
          id: p.id,
          companyId: p.company_id,
          userId: p.user_id,
          employeeName: fullName,
          jobTitle: "Staff",
          department: "front_desk" as DepartmentType,
          payPeriod: `${p.period_year}-${String(p.period_month).padStart(2, "0")}`,
          basicSalary: toNumber(p.gross_salary),
          allowances: {
            overtime: toNumber(p.overtime_amount),
            bonuses: toNumber(p.bonus_amount),
          },
          grossPay: toNumber(p.gross_salary),
          deductions: {
            payeTax: toNumber(p.tax_amount),
            uif: toNumber(p.uif_amount),
          },
          netPay: toNumber(p.net_salary),
          status: p.payment_status as "draft" | "approved" | "paid",
          paymentMethod: "bank_transfer",
          paidAt: p.paid_at,
          notes: p.notes,
          createdAt: p.created_at,
        };
      });
    }
  } catch (err) {
    console.warn("Could not load payslips from server", err);
  }
  if (companyId === MOCK_COMPANIES[0].id || !isValidUuid(companyId)) {
    return MOCK_PAYSLIPS;
  }
  return [];
}

export async function generatePayslip(params: {
  companyId: string;
  userId: string;
  employeeName: string;
  jobTitle: string;
  department: Payslip["department"];
  payPeriod: string;
  basicSalary: number;
  allowances: Record<string, number>;
  deductions: Record<string, number>;
  generatedByName: string;
}): Promise<Payslip> {
  const user = MOCK_COMPANY_USERS.find(
    (u) => u.userId === params.userId || u.id === params.userId || u.fullName === params.employeeName
  );
  if (user && user.isActive === false) {
    throw new Error("Payroll and payslips can only be generated for active employees.");
  }

  const totalAllowances = Object.values(params.allowances).reduce((a, b) => a + b, 0);
  const grossPay = params.basicSalary + totalAllowances;
  const totalDeductions = Object.values(params.deductions).reduce((a, b) => a + b, 0);
  const netPay = grossPay - totalDeductions;
  const newId = generateUuid();

  let validUserId = params.userId;
  if (!isValidUuid(validUserId)) {
    const dbUserId = await ensureDbUser(`${params.employeeName.toLowerCase().replace(/\s+/g, ".")}@paimbabook.com`, params.employeeName);
    validUserId = dbUserId || generateUuid();
  }

  const newPayslip: Payslip = {
    id: newId,
    companyId: params.companyId,
    userId: validUserId,
    employeeName: params.employeeName,
    jobTitle: params.jobTitle,
    department: params.department,
    payPeriod: params.payPeriod,
    basicSalary: params.basicSalary,
    allowances: params.allowances,
    grossPay,
    deductions: params.deductions,
    netPay,
    status: "draft",
    paymentMethod: "bank_transfer",
    generatedByName: params.generatedByName,
    createdAt: new Date().toISOString(),
  };

  try {
    if (isValidUuid(params.companyId) && isValidUuid(validUserId)) {
      const periodParts = params.payPeriod.split("-");
      const year = parseInt(periodParts[0]) || 2026;
      const month = parseInt(periodParts[1]) || 8;

      const { data, error } = await supabase
        .from("hr_payslips")
        .upsert(
          {
            id: newId,
            company_id: params.companyId,
            user_id: validUserId,
            period_year: year,
            period_month: month,
            gross_salary: grossPay,
            deductions: totalDeductions,
            net_salary: netPay,
            tax_amount: params.deductions.payeTax || 0,
            uif_amount: params.deductions.uif || 0,
            overtime_amount: params.allowances.overtime || 0,
            bonus_amount: params.allowances.bonuses || 0,
            payment_status: "draft",
            notes: `Generated by ${params.generatedByName}`,
          },
          { onConflict: "company_id,user_id,period_month,period_year" }
        )
        .select()
        .single();

      if (!error && data) {
        newPayslip.id = data.id;
      }
    }
  } catch (err) {
    console.warn("Could not insert payslip in Supabase", err);
  }

  MOCK_PAYSLIPS.unshift(newPayslip);

  await logAuditEvent({
    companyId: params.companyId,
    action: "GENERATE_PAYSLIP",
    entityType: "hr_payslip",
    entityId: newPayslip.id,
    entityName: `${params.employeeName} (${params.payPeriod})`,
    actorName: params.generatedByName,
    details: `Generated payslip for ${params.employeeName}. Gross: R${grossPay}, Net: R${netPay}.`,
  });

  return newPayslip;
}

export async function fetchEmployeeContractTemplates(companyId: string = MOCK_COMPANIES[0].id): Promise<EmployeeContractTemplate[]> {
  try {
    let query = supabase.from("hr_employee_contract_templates").select("*");
    if (isValidUuid(companyId)) {
      query = query.eq("company_id", companyId);
    }
    const { data, error } = await query.order("created_at", { ascending: false });
    if (!error && data) {
      return data.map((t) => ({
        id: t.id,
        companyId: t.company_id,
        title: t.title,
        department: t.department,
        templateBody: t.description || "",
        standardLeaveDays: 21,
        probationMonths: 3,
        workingHoursPerWeek: 40,
        isDefault: t.is_active ?? true,
      }));
    }
  } catch (err) {
    console.warn("Could not load contract templates from server", err);
  }
  if (companyId === MOCK_COMPANIES[0].id || !isValidUuid(companyId)) {
    return MOCK_EMPLOYEE_TEMPLATES;
  }
  return [];
}

export async function fetchEmployeeContracts(companyId: string = MOCK_COMPANIES[0].id): Promise<EmployeeContract[]> {
  try {
    let query = supabase
      .from("hr_employee_contracts")
      .select("*, users(first_name, last_name, email)");

    if (isValidUuid(companyId)) {
      query = query.eq("company_id", companyId);
    }
    const { data, error } = await query.order("created_at", { ascending: false });
    if (!error && data) {
      return data.map((c) => ({
        id: c.id,
        companyId: c.company_id,
        userId: c.user_id,
        templateId: c.template_id || undefined,
        employeeName: `${c.users?.first_name || ""} ${c.users?.last_name || ""}`.trim() || c.users?.email || "Employee",
        department: c.department as DepartmentType,
        jobTitle: c.job_title,
        startDate: c.start_date,
        endDate: c.end_date || undefined,
        isPermanent: c.employment_type === "permanent",
        monthlySalary: toNumber(c.basic_salary),
        leaveDaysPerYear: 21,
        status: c.status as any,
        signedAt: c.signed_by_employee_at || undefined,
        signedByEmployee: Boolean(c.signed_by_employee_at),
        createdAt: c.created_at,
      }));
    }
  } catch (err) {
    console.warn("Could not load employee contracts from server", err);
  }
  if (companyId === MOCK_COMPANIES[0].id || !isValidUuid(companyId)) {
    return MOCK_EMPLOYEE_CONTRACTS;
  }
  return [];
}

export async function createEmployeeContract(contract: Partial<EmployeeContract>): Promise<EmployeeContract> {
  const companyId = contract.companyId || MOCK_COMPANIES[0].id;
  const newId = generateUuid();
  let validUserId = contract.userId;
  if (!isValidUuid(validUserId)) {
    const dbUserId = await ensureDbUser(`${(contract.employeeName || "staff").toLowerCase().replace(/\s+/g, ".")}@paimbabook.com`, contract.employeeName);
    validUserId = dbUserId || generateUuid();
  }

  const newCon: EmployeeContract = {
    id: newId,
    companyId,
    userId: validUserId || generateUuid(),
    templateId: contract.templateId || undefined,
    employeeName: contract.employeeName || "Employee Name",
    department: contract.department || "front_desk",
    jobTitle: contract.jobTitle || "Front Desk - Receptionist",
    startDate: contract.startDate || new Date().toISOString().slice(0, 10),
    endDate: contract.isPermanent ? undefined : contract.endDate,
    isPermanent: contract.isPermanent ?? true,
    monthlySalary: contract.monthlySalary ?? 15000,
    leaveDaysPerYear: contract.leaveDaysPerYear ?? 21,
    status: "active",
    signedAt: new Date().toISOString(),
    signedByEmployee: true,
    createdAt: new Date().toISOString(),
  };

  try {
    if (isValidUuid(companyId) && isValidUuid(validUserId)) {
      const dbDept = mapDepartmentToDb(newCon.department);
      const { data, error } = await supabase
        .from("hr_employee_contracts")
        .insert({
          id: newId,
          company_id: companyId,
          user_id: validUserId,
          template_id: isValidUuid(contract.templateId) ? contract.templateId : null,
          job_title: newCon.jobTitle,
          department: dbDept,
          employment_type: newCon.isPermanent ? "permanent" : "fixed_term",
          start_date: newCon.startDate,
          end_date: newCon.isPermanent ? null : (newCon.endDate || null),
          basic_salary: newCon.monthlySalary,
          working_hours: "40 hours per week",
          status: "active",
          signed_by_employee_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (!error && data) {
        newCon.id = data.id;
      }
    }
  } catch (err) {
    console.warn("Could not insert employee contract in Supabase", err);
  }

  MOCK_EMPLOYEE_CONTRACTS.unshift(newCon);
  return newCon;
}

export async function extendEmployeeContract(
  contractId: string,
  newEndDate: string,
  extendedByName: string,
  salaryAdjustment?: number,
  notes?: string
): Promise<EmployeeContract | null> {
  const contract = MOCK_EMPLOYEE_CONTRACTS.find((c) => c.id === contractId);
  const previousEndDate = contract?.endDate;

  try {
    if (isValidUuid(contractId)) {
      const updatePayload: Record<string, any> = {
        end_date: newEndDate,
        status: "active",
        updated_at: new Date().toISOString(),
      };
      if (salaryAdjustment !== undefined && salaryAdjustment > 0) {
        updatePayload.basic_salary = salaryAdjustment;
      }
      await supabase.from("hr_employee_contracts").update(updatePayload).eq("id", contractId);
    }
  } catch (err) {
    console.warn("Could not extend contract in Supabase", err);
  }

  if (contract) {
    contract.endDate = newEndDate;
    contract.status = "active";
    if (salaryAdjustment !== undefined && salaryAdjustment > 0) {
      contract.monthlySalary = salaryAdjustment;
    }
    if (!contract.extensionHistory) contract.extensionHistory = [];
    contract.extensionHistory.push({
      previousEndDate,
      newEndDate,
      extendedAt: new Date().toISOString(),
      extendedByName,
      salaryAdjustment,
      notes,
    });
  }
  return contract || null;
}

export async function terminateEmployeeContract(
  contractId: string,
  terminatedByName: string,
  reason: string,
  deactivateEmployee: boolean = true
): Promise<EmployeeContract | null> {
  const contract = MOCK_EMPLOYEE_CONTRACTS.find((c) => c.id === contractId);

  try {
    if (isValidUuid(contractId)) {
      await supabase
        .from("hr_employee_contracts")
        .update({
          status: "terminated",
          updated_at: new Date().toISOString(),
        })
        .eq("id", contractId);
    }
  } catch (err) {
    console.warn("Could not terminate contract in Supabase", err);
  }

  if (contract) {
    contract.status = "terminated";
    contract.terminatedAt = new Date().toISOString();
    contract.terminatedByName = terminatedByName;
    contract.terminationReason = reason;

    if (deactivateEmployee && contract.userId) {
      const user = MOCK_COMPANY_USERS.find(
        (u) => u.userId === contract.userId || u.id === contract.userId
      );
      if (user) {
        user.isActive = false;
        user.deactivationReason = "contract_ended";
        user.deactivationDate = new Date().toISOString().slice(0, 10);
        user.deactivationNotes = reason;
      }
    }
  }
  return contract || null;
}

export async function deactivateEmployeeUser(
  userId: string,
  reason: "resigned" | "terminated" | "deceased" | "contract_ended" | "other" | string,
  notes: string = "",
  effectiveDate: string = new Date().toISOString().slice(0, 10)
): Promise<boolean> {
  try {
    if (isValidUuid(userId)) {
      await supabase
        .from("company_users")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
    }
  } catch (err) {
    console.warn("Could not deactivate employee in Supabase", err);
  }

  const user = MOCK_COMPANY_USERS.find((u) => u.id === userId || u.userId === userId);
  if (user) {
    user.isActive = false;
    user.deactivationReason = reason;
    user.deactivationDate = effectiveDate;
    user.deactivationNotes = notes;
  }
  return true;
}

export async function reactivateEmployeeUser(userId: string): Promise<boolean> {
  try {
    if (isValidUuid(userId)) {
      await supabase
        .from("company_users")
        .update({
          is_active: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
    }
  } catch (err) {
    console.warn("Could not reactivate employee in Supabase", err);
  }

  const user = MOCK_COMPANY_USERS.find((u) => u.id === userId || u.userId === userId);
  if (user) {
    user.isActive = true;
    user.deactivationReason = undefined;
    user.deactivationDate = undefined;
    user.deactivationNotes = undefined;
  }
  return true;
}

export async function massGeneratePayroll(params: {
  companyId: string;
  payPeriod: string;
  generatedByName: string;
}): Promise<{
  generated: Payslip[];
  skippedInactiveCount: number;
}> {
  const users = await fetchCompanyUsers(params.companyId);
  const salaryScales = await fetchSalaryScales(params.companyId);
  const contracts = await fetchEmployeeContracts(params.companyId);

  // STRICT RULE: Payroll and payslip can ONLY be generated for active employees
  const activeUsers = users.filter((u) => u.isActive !== false);
  const skippedInactiveCount = users.length - activeUsers.length;

  const generated: Payslip[] = [];

  for (const u of activeUsers) {
    // Skip if already generated for this exact period
    const existing = MOCK_PAYSLIPS.find(
      (p) =>
        (p.userId === u.userId || p.employeeName === u.fullName) &&
        p.payPeriod === params.payPeriod
    );
    if (existing) {
      continue;
    }

    const contract = contracts.find((c) => c.userId === u.userId);
    const scale = salaryScales.find(
      (s) =>
        s.jobTitle.toLowerCase() === u.jobTitle.toLowerCase() ||
        s.department === u.department
    );

    const basic = contract?.monthlySalary || scale?.midSalary || scale?.minSalary || 15000;
    const house = scale?.housingAllowance ?? 1500;
    const trans = scale?.transportAllowance ?? 1000;
    const med = scale?.medicalAllowance ?? 800;

    const gross = basic + house + trans + med;
    const paye = (basic + house + trans) * 0.15;
    const pension = basic * 0.05;
    const uif = Math.min(basic * 0.01, 177.12);
    const net = gross - (paye + pension + uif);

    const newPayslip: Payslip = {
      id: generateUuid(),
      companyId: params.companyId,
      userId: u.userId,
      employeeName: u.fullName,
      jobTitle: u.jobTitle,
      department: u.department,
      payPeriod: params.payPeriod,
      basicSalary: basic,
      allowances: {
        housing: house,
        transport: trans,
        medical: med,
      },
      grossPay: gross,
      deductions: {
        payeTax: paye,
        pension,
        uif,
      },
      netPay: net,
      status: "paid",
      paymentMethod: "bank_transfer",
      paidAt: new Date().toISOString(),
      generatedByName: params.generatedByName,
      createdAt: new Date().toISOString(),
    };

    MOCK_PAYSLIPS.unshift(newPayslip);
    generated.push(newPayslip);
  }

  return { generated, skippedInactiveCount };
}

export async function fetchLeaveRecords(companyId: string = MOCK_COMPANIES[0].id): Promise<LeaveRecord[]> {
  try {
    let query = supabase
      .from("hr_leave_records")
      .select("*, users(first_name, last_name, email)");

    if (isValidUuid(companyId)) {
      query = query.eq("company_id", companyId);
    }
    const { data, error } = await query.order("created_at", { ascending: false });
    if (!error && data) {
      return data.map((l) => ({
        id: l.id,
        companyId: l.company_id,
        userId: l.user_id,
        employeeName: `${l.users?.first_name || ""} ${l.users?.last_name || ""}`.trim() || l.users?.email || "Employee",
        department: "front_desk" as DepartmentType,
        leaveType: l.leave_type as any,
        startDate: l.start_date,
        endDate: l.end_date,
        daysCount: l.days_count,
        reason: l.reason || "",
        status: l.status as any,
        reviewedAt: l.approved_at || undefined,
        createdAt: l.created_at,
      }));
    }
  } catch (err) {
    console.warn("Error fetching leave records", err);
  }
  return [];
}

export async function requestLeave(record: Partial<LeaveRecord>): Promise<LeaveRecord> {
  const companyId = record.companyId || MOCK_COMPANIES[0].id;
  const newId = generateUuid();
  let validUserId = record.userId;
  if (!isValidUuid(validUserId)) {
    const dbUserId = await ensureDbUser(`${(record.employeeName || "staff").toLowerCase().replace(/\s+/g, ".")}@paimbabook.com`, record.employeeName);
    validUserId = dbUserId || generateUuid();
  }

  const newLeave: LeaveRecord = {
    id: newId,
    companyId,
    userId: validUserId || generateUuid(),
    employeeName: record.employeeName || "Employee",
    department: record.department || "front_desk",
    leaveType: record.leaveType || "annual",
    startDate: record.startDate || new Date().toISOString().slice(0, 10),
    endDate: record.endDate || new Date().toISOString().slice(0, 10),
    daysCount: record.daysCount ?? 1,
    reason: record.reason || "",
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  try {
    if (isValidUuid(companyId) && isValidUuid(validUserId)) {
      const allowedLeave = ["annual", "sick", "maternity", "family_responsibility", "unpaid", "study"];
      const lType = allowedLeave.includes(newLeave.leaveType) ? newLeave.leaveType : "annual";

      const { data, error } = await supabase
        .from("hr_leave_records")
        .insert({
          id: newId,
          company_id: companyId,
          user_id: validUserId,
          leave_type: lType,
          start_date: newLeave.startDate,
          end_date: newLeave.endDate,
          days_count: newLeave.daysCount,
          reason: newLeave.reason || null,
          status: "pending",
        })
        .select()
        .single();

      if (!error && data) {
        newLeave.id = data.id;
      }
    }
  } catch (err) {
    console.warn("Could not insert leave record in Supabase", err);
  }

  MOCK_LEAVE_RECORDS.unshift(newLeave);
  return newLeave;
}

export async function updateLeaveStatus(
  id: string,
  status: "approved" | "rejected",
  reviewerName: string
): Promise<boolean> {
  try {
    if (isValidUuid(id)) {
      await supabase
        .from("hr_leave_records")
        .update({
          status,
          approved_at: new Date().toISOString(),
        })
        .eq("id", id);
    }
  } catch (err) {
    console.warn("Could not update leave status in Supabase", err);
  }

  const item = MOCK_LEAVE_RECORDS.find((l) => l.id === id);
  if (item) {
    item.status = status;
    item.approvedByName = reviewerName;
    item.reviewedAt = new Date().toISOString();
  }
  return true;
}

export async function logAuditEvent(event: {
  companyId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityName: string;
  actorName: string;
  details: string;
  userEmail?: string;
}): Promise<void> {
  const compId = event.companyId || MOCK_COMPANIES[0].id;
  const row: AuditEventRow = {
    id: `audit-${Date.now()}`,
    companyId: compId,
    createdAt: new Date().toISOString(),
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId || "",
    entityName: event.entityName,
    actorName: event.actorName,
    details: event.details,
  };

  try {
    const payload: Record<string, unknown> = {
      action: event.action,
      entity_type: event.entityType,
      user_email: event.userEmail || "admin@paimbabook.com",
      user_name: event.actorName || "System Admin",
      details: {
        summary: event.details,
        entity_name: event.entityName,
        original_entity_id: event.entityId,
      },
    };

    if (isValidUuid(compId)) {
      payload.company_id = compId;
    }
    if (isValidUuid(event.entityId)) {
      payload.entity_id = event.entityId;
    }

    await supabase.from("audit_log").insert(payload);
  } catch (err) {
    console.warn("Could not insert audit log to Supabase", err);
  }

  MOCK_AUDIT_TRAIL.unshift(row);
}

export async function fetchAuditEvents(companyId: string = MOCK_COMPANIES[0].id): Promise<AuditEventRow[]> {
  try {
    let query = supabase.from("audit_log").select("*");
    if (isValidUuid(companyId)) {
      query = query.eq("company_id", companyId);
    }
    const { data, error } = await query.order("created_at", { ascending: false }).limit(200);
    if (!error && data) {
      return data.map((row) => ({
        id: row.id,
        companyId: row.company_id || companyId,
        createdAt: row.created_at,
        action: row.action,
        entityType: row.entity_type,
        entityId: row.entity_id || (row.details && typeof row.details === "object" ? (row.details as any).original_entity_id : "") || "",
        entityName: (row.details && typeof row.details === "object" ? (row.details as any).entity_name : "") || row.entity_type,
        actorName: row.user_name || row.user_email || "System",
        details: (row.details && typeof row.details === "object" ? (row.details as any).summary : typeof row.details === "string" ? row.details : "") || JSON.stringify(row.details || {}),
      }));
    }
  } catch (err) {
    console.warn("Error fetching audit events", err);
  }
  return [];
}

export async function fetchCheckinPatterns(companyId: string = MOCK_COMPANIES[0].id) {
  return {
    averageLengthOfStayNights: 2.8,
    peakCheckinHour: "14:00 - 16:00",
    mostPopularMealPlan: "Bed & Breakfast (62%)",
    turnoverEfficiencyHours: 2.1,
    weeklyOccupancyTrend: [
      { day: "Mon", rate: 58 },
      { day: "Tue", rate: 64 },
      { day: "Wed", rate: 72 },
      { day: "Thu", rate: 81 },
      { day: "Fri", rate: 94 },
      { day: "Sat", rate: 96 },
      { day: "Sun", rate: 70 },
    ],
    mealPlanDistribution: [
      { plan: "Bed & Breakfast", count: 62 },
      { plan: "Room Only", count: 21 },
      { plan: "Full Board", count: 12 },
      { plan: "Bed, Breakfast & Lunch", count: 5 },
    ],
  };
}

export async function fetchDashboardData(companyId: string = MOCK_COMPANIES[0].id): Promise<DashboardData> {
  try {
    const [propsRes, roomsRes, tenantsRes, invRes, maintRes, bookingsRes] = await Promise.all([
      isValidUuid(companyId)
        ? supabase.from("properties").select("id, type, status, monthly_rent").eq("company_id", companyId)
        : Promise.resolve({ data: [] }),
      isValidUuid(companyId)
        ? supabase.from("commercial_rooms").select("id, status, price_per_night").eq("company_id", companyId)
        : Promise.resolve({ data: [] }),
      isValidUuid(companyId)
        ? supabase.from("tenants").select("id, tenure_status").eq("company_id", companyId)
        : Promise.resolve({ data: [] }),
      isValidUuid(companyId)
        ? supabase.from("invoices").select("id, total_amount, status, created_at").eq("company_id", companyId)
        : Promise.resolve({ data: [] }),
      isValidUuid(companyId)
        ? supabase.from("maintenance").select("id, status, category, cost, created_at").eq("company_id", companyId)
        : Promise.resolve({ data: [] }),
      isValidUuid(companyId)
        ? supabase.from("commercial_bookings").select("id, check_in_date, booking_status, total_amount, amount_paid").eq("company_id", companyId)
        : Promise.resolve({ data: [] }),
    ]);

    const props = propsRes.data || [];
    const rooms = roomsRes.data || [];
    const tenants = tenantsRes.data || [];
    const invoices = invRes.data || [];
    const maintenance = maintRes.data || [];
    const bookings = bookingsRes.data || [];

    const occupiedRooms = rooms.filter((r) => r.status === "occupied").length;
    const availableRooms = rooms.filter((r) => r.status === "available").length;
    const cleaningNeeded = rooms.filter((r) => r.status === "cleaning_needed").length;

    const totalProperties = props.length;
    const commercialProps = props.filter((p) => ["hotel", "motel", "lodge", "guest_house"].includes(p.type)).length;
    const occupiedUnits = props.filter((p) => p.status === "occupied").length;
    const vacantUnits = props.filter((p) => p.status === "vacant").length;
    const totalUnits = occupiedUnits + vacantUnits;
    const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : (rooms.length > 0 ? Math.round((occupiedRooms / rooms.length) * 100) : 0);

    const paidInvoices = invoices.filter((i) => i.status === "paid");
    const overdueInvoices = invoices.filter((i) => i.status === "overdue");
    const totalMonthlyIncome = paidInvoices.reduce((acc, i) => acc + Number(i.total_amount || 0), 0);
    const totalMonthlyInvoiced = invoices.reduce((acc, i) => acc + Number(i.total_amount || 0), 0);
    const totalMonthlyExpenses = maintenance.reduce((acc, m) => acc + Number(m.cost || 0), 0);
    const netProfit = totalMonthlyIncome - totalMonthlyExpenses;
    const collectionRate = totalMonthlyInvoiced > 0 ? Math.round((totalMonthlyIncome / totalMonthlyInvoiced) * 100) : 0;

    const pendingMaintenance = maintenance.filter((m) => m.status === "open" || m.status === "in_progress").length;
    const todayStr = new Date().toISOString().slice(0, 10);
    const activeCheckinsToday = bookings.filter((b) => b.check_in_date && String(b.check_in_date).startsWith(todayStr)).length;

    const statusMap: Record<string, number> = {};
    maintenance.forEach((m) => {
      const s = m.status === "in_progress" ? "In Progress" : m.status === "completed" ? "Completed" : "Open";
      statusMap[s] = (statusMap[s] || 0) + 1;
    });
    const maintenanceByStatus = Object.entries(statusMap).map(([status, count]) => ({ status, count }));

    const catMap: Record<string, number> = {};
    maintenance.forEach((m) => {
      const c = m.category ? m.category.charAt(0).toUpperCase() + m.category.slice(1) : "General";
      catMap[c] = (catMap[c] || 0) + 1;
    });
    const maintenanceByCategory = Object.entries(catMap).map(([category, count]) => ({ category, count }));

    const propTypeMap: Record<string, number> = {};
    props.forEach((p) => {
      const t = ["hotel", "motel", "lodge", "guest_house"].includes(p.type) ? "Commercial Lodge" : "Residential";
      propTypeMap[t] = (propTypeMap[t] || 0) + 1;
    });
    const propertyStatus = Object.entries(propTypeMap).map(([status, count]) => ({ status, count }));

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const now = new Date();
    const cashflow = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = d.toISOString().slice(0, 7);
      const label = monthNames[d.getMonth()];
      const mInvoices = invoices.filter((inv) => (inv.created_at || "").startsWith(monthKey));
      const mIncome = mInvoices.filter((inv) => inv.status === "paid").reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0);
      const mMaint = maintenance.filter((m) => (m.created_at || "").startsWith(monthKey));
      const mExpenses = mMaint.reduce((sum, m) => sum + Number(m.cost || 0), 0);
      cashflow.push({
        month: monthKey,
        label,
        income: mIncome,
        expenses: mExpenses,
        profit: mIncome - mExpenses,
      });
    }

    const stats: DashboardStats = {
      totalProperties,
      totalCommercialProperties: commercialProps,
      occupiedUnits,
      vacantUnits,
      occupancyRate,
      totalMonthlyIncome,
      totalMonthlyInvoiced,
      totalMonthlyExpenses,
      netProfit,
      pendingMaintenance,
      overduePayments: overdueInvoices.length,
      collectionRate,
      totalRooms: rooms.length,
      occupiedRooms,
      availableRooms,
      cleaningNeededRooms: cleaningNeeded,
      activeCheckinsToday,
      maintenanceByStatus,
      maintenanceByCategory,
      propertyStatus,
    };

    return { stats, cashflow };
  } catch (err) {
    console.warn("Error calculating dashboard data", err);
    return {
      stats: {
        totalProperties: 0,
        totalCommercialProperties: 0,
        occupiedUnits: 0,
        vacantUnits: 0,
        occupancyRate: 0,
        totalMonthlyIncome: 0,
        totalMonthlyInvoiced: 0,
        totalMonthlyExpenses: 0,
        netProfit: 0,
        pendingMaintenance: 0,
        overduePayments: 0,
        collectionRate: 0,
        totalRooms: 0,
        occupiedRooms: 0,
        availableRooms: 0,
        cleaningNeededRooms: 0,
        activeCheckinsToday: 0,
        maintenanceByStatus: [],
        maintenanceByCategory: [],
        propertyStatus: [],
      },
      cashflow: [],
    };
  }
}

export async function fetchProperties(companyId?: string): Promise<PropertyRow[]> {
  if (!companyId) return [];
  try {
    let query = supabase.from("properties").select("*");
    if (isValidUuid(companyId)) {
      query = query.eq("company_id", companyId);
    } else {
      query = query.eq("company_id", companyId);
    }
    const { data, error } = await query.order("name");

    if (!error && data) {
      return data.map((p) => ({
        id: p.id,
        companyId: p.company_id || companyId,
        name: p.name,
        type: p.type,
        address: p.address || "",
        city: p.city || "",
        country: p.country || "",
        status: p.status,
        monthlyRent: toNumber(p.monthly_rent),
        totalRooms: p.total_rooms,
        uniformRoomPricing: p.uniform_room_pricing,
        defaultRoomPrice: toNumber(p.default_room_price),
        defaultBedBreakfast: toNumber(p.default_bed_breakfast),
        defaultBedLunch: toNumber(p.default_bed_lunch),
        defaultFullBoard: toNumber(p.default_full_board),
        photos: p.photos || [],
        isPublished: p.is_published || false,
        availableFrom: p.available_from || undefined,
      }));
    }
  } catch (err) {
    console.warn("Error fetching properties", err);
  }
  return [];
}

export async function fetchTenants(companyId?: string): Promise<TenantRow[]> {
  if (!companyId) return [];
  try {
    let query = supabase.from("tenants").select("*, properties(name)");
    if (isValidUuid(companyId)) {
      query = query.eq("company_id", companyId);
    } else {
      query = query.eq("company_id", companyId);
    }
    const { data, error } = await query.order("created_at", { ascending: false });
    if (!error && data) {
      return data.map((t) => ({
        id: t.id,
        companyId: t.company_id || companyId,
        fullName: t.full_name,
        propertyName: t.properties?.name || "Unassigned Property",
        phone: t.phone || "",
        email: t.email || "",
        tenureStatus: t.tenure_status || "active",
        rentStatus: t.rent_status || "unpaid",
      }));
    }
  } catch (err) {
    console.warn("Error fetching tenants", err);
  }
  return [];
}

export async function fetchInvoices(companyId?: string): Promise<InvoiceRow[]> {
  if (!companyId) return [];
  try {
    let query = supabase.from("invoices").select("*, tenants(full_name), properties(name)");
    query = query.eq("company_id", companyId);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (!error && data) {
      return data.map((inv) => ({
        id: inv.id,
        companyId: inv.company_id || companyId,
        tenantName: inv.tenants?.full_name || "Unknown Tenant",
        propertyName: inv.properties?.name || "Unknown Property",
        month: inv.month,
        dueDate: inv.due_date,
        totalAmount: toNumber(inv.total_amount),
        status: inv.status,
      }));
    }
  } catch (err) {
    console.warn("Error fetching invoices", err);
  }
  return [];
}

export async function fetchReportsData(companyId?: string): Promise<ReportsData> {
  if (!companyId) return { summary: { totalInvoiced: 0, totalPaid: 0, totalOverdue: 0, collectionRate: 0 }, byStatus: [], monthly: [] };
  try {
    let query = supabase.from("invoices").select("total_amount, status, created_at");
    query = query.eq("company_id", companyId);
    const { data: invoices } = await query;
    const invList = invoices || [];
    const totalInvoiced = invList.reduce((acc, i) => acc + Number(i.total_amount || 0), 0);
    const totalPaid = invList.filter((i) => i.status === "paid").reduce((acc, i) => acc + Number(i.total_amount || 0), 0);
    const totalOverdue = invList.filter((i) => i.status === "overdue").reduce((acc, i) => acc + Number(i.total_amount || 0), 0);
    const collectionRate = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0;

    const statusCounts = {
      Paid: invList.filter((i) => i.status === "paid").length,
      Sent: invList.filter((i) => i.status === "sent").length,
      Draft: invList.filter((i) => i.status === "draft").length,
      Overdue: invList.filter((i) => i.status === "overdue").length,
    };

    return {
      summary: { totalInvoiced, totalPaid, totalOverdue, collectionRate },
      byStatus: Object.entries(statusCounts).map(([label, count]) => ({ label, count })),
      monthly: [],
    };
  } catch {
    return {
      summary: { totalInvoiced: 0, totalPaid: 0, totalOverdue: 0, collectionRate: 0 },
      byStatus: [],
      monthly: [],
    };
  }
}

export async function fetchMaintenanceOverview(companyId: string = MOCK_COMPANIES[0].id): Promise<MaintenanceOverviewData> {
  try {
    const [maintRes, provRes, inspRes, prevRes, invRes, hkRes, rsRes] = await Promise.all([
      isValidUuid(companyId) ? supabase.from("maintenance").select("id, status").eq("company_id", companyId) : Promise.resolve({ data: [] }),
      isValidUuid(companyId) ? supabase.from("maintainers").select("id").eq("company_id", companyId) : Promise.resolve({ data: [] }),
      isValidUuid(companyId) ? supabase.from("inspections").select("id, status").eq("company_id", companyId) : Promise.resolve({ data: [] }),
      isValidUuid(companyId) ? supabase.from("preventive_maintenance").select("id, status").eq("company_id", companyId) : Promise.resolve({ data: [] }),
      isValidUuid(companyId) ? supabase.from("maintenance_inventory").select("id, quantity, min_stock_level").eq("company_id", companyId) : Promise.resolve({ data: [] }),
      isValidUuid(companyId) ? supabase.from("housekeeping_schedules").select("id, status").eq("company_id", companyId) : Promise.resolve({ data: [] }),
      isValidUuid(companyId) ? supabase.from("room_service_schedules").select("id, status").eq("company_id", companyId) : Promise.resolve({ data: [] }),
    ]);

    const maint = maintRes.data || [];
    const openWorkOrders = maint.filter((m) => m.status === "open" || m.status === "in_progress").length;
    const completedWorkOrders = maint.filter((m) => m.status === "completed").length;
    const lowStockItems = (invRes.data || []).filter((i) => Number(i.quantity) <= Number(i.min_stock_level)).length;
    const overduePreventive = (prevRes.data || []).filter((p) => p.status === "overdue").length;
    const hkPending = (hkRes.data || []).filter((h) => h.status === "pending" || h.status === "in_progress").length;
    const rsRequested = (rsRes.data || []).filter((r) => r.status === "requested" || r.status === "preparing").length;

    return {
      totalWorkOrders: maint.length,
      openWorkOrders,
      completedWorkOrders,
      totalProviders: (provRes.data || []).length,
      scheduledInspections: (inspRes.data || []).length,
      overduePreventiveTasks: overduePreventive,
      lowStockItems,
      housekeepingPending: hkPending,
      roomServiceRequested: rsRequested,
    };
  } catch {
    return {
      totalWorkOrders: 0,
      openWorkOrders: 0,
      completedWorkOrders: 0,
      totalProviders: 0,
      scheduledInspections: 0,
      overduePreventiveTasks: 0,
      lowStockItems: 0,
      housekeepingPending: 0,
      roomServiceRequested: 0,
    };
  }
}

export async function fetchWorkOrders(companyId?: string): Promise<WorkOrderRow[]> {
  if (!companyId) return [];
  try {
    let query = supabase.from("maintenance").select("*, properties(name), maintainers(name)");
    query = query.eq("company_id", companyId);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (!error && data) {
      return data.map((w) => ({
        id: w.id,
        companyId: w.company_id || companyId,
        propertyName: w.properties?.name || "Unassigned Property",
        providerName: w.maintainers?.name || "Internal Staff",
        category: w.category || "general",
        priority: w.priority || "medium",
        status: w.status || "open",
        scheduledDate: w.scheduled_date || "",
        estimatedCost: toNumber(w.estimated_cost),
        actualCost: toNumber(w.actual_cost),
      }));
    }
  } catch (err) {
    console.warn("Error fetching work orders", err);
  }
  return [];
}

export async function fetchProviders(companyId?: string): Promise<ProviderRow[]> {
  if (!companyId) return [];
  try {
    let query = supabase.from("maintainers").select("*");
    query = query.eq("company_id", companyId);
    const { data, error } = await query.order("name");
    if (!error && data) {
      return data.map((p) => ({
        id: p.id,
        companyId: p.company_id || companyId,
        name: p.name,
        phone: p.phone,
        specialization: p.specialization,
        rate: toNumber(p.rate),
        totalJobs: p.total_jobs || 0,
        totalPaid: toNumber(p.total_paid),
      }));
    }
  } catch (err) {
    console.warn("Error fetching providers", err);
  }
  return [];
}

export async function fetchInspections(companyId?: string): Promise<InspectionRow[]> {
  if (!companyId) return [];
  try {
    let query = supabase.from("inspections").select("*, properties(name), tenants(full_name)");
    query = query.eq("company_id", companyId);
    const { data, error } = await query.order("scheduled_date", { ascending: false });
    if (!error && data) {
      return data.map((insp) => ({
        id: insp.id,
        companyId: insp.company_id || companyId,
        propertyName: insp.properties?.name || "Unassigned Property",
        tenantName: insp.tenants?.full_name || "Commercial Operations",
        type: insp.type || "routine",
        status: insp.status || "scheduled",
        scheduledDate: insp.scheduled_date || "",
        completedDate: insp.completed_date || "",
        inspectorName: insp.inspector_name || "Staff Inspector",
      }));
    }
  } catch (err) {
    console.warn("Error fetching inspections", err);
  }
  return [];
}

export async function fetchPreventiveTasks(companyId?: string): Promise<PreventiveTaskRow[]> {
  if (!companyId) return [];
  try {
    let query = supabase.from("preventive_maintenance").select("*, properties(name), maintainers(name)");
    query = query.eq("company_id", companyId);
    const { data, error } = await query.order("next_due");
    if (!error && data) {
      return data.map((t) => ({
        id: t.id,
        companyId: t.company_id || companyId,
        propertyName: t.properties?.name || "Unassigned Property",
        providerName: t.maintainers?.name || "Maintenance Staff",
        title: t.title,
        category: t.category,
        frequency: t.frequency,
        status: t.status,
        nextDue: t.next_due,
        estimatedCost: toNumber(t.estimated_cost),
      }));
    }
  } catch (err) {
    console.warn("Error fetching preventive tasks", err);
  }
  return [];
}

export async function fetchInventoryItems(companyId?: string): Promise<InventoryItemRow[]> {
  if (!companyId) return [];
  try {
    let query = supabase.from("maintenance_inventory").select("*");
    query = query.eq("company_id", companyId);
    const { data, error } = await query.order("name");
    if (!error && data) {
      return data.map((item) => ({
        id: item.id,
        companyId: item.company_id || companyId,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        minStockLevel: item.min_stock_level,
        unitCost: toNumber(item.unit_cost),
        supplier: item.supplier || "",
        location: item.location || "",
      }));
    }
  } catch (err) {
    console.warn("Error fetching inventory items", err);
  }
  return [];
}

export async function fetchContracts(companyId?: string): Promise<ContractRow[]> {
  if (!companyId) return [];
  try {
    let query = supabase.from("contracts").select("*, tenants(full_name), properties(name)");
    query = query.eq("company_id", companyId);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (!error && data) {
      return data.map((c) => ({
        id: c.id,
        companyId: c.company_id || companyId,
        title: c.title,
        tenantName: c.tenants?.full_name || "Unknown Tenant",
        propertyName: c.properties?.name || "Unknown Property",
        startDate: c.start_date,
        endDate: c.end_date,
        monthlyRent: toNumber(c.monthly_rent),
        depositAmount: toNumber(c.deposit_amount),
        notes: c.notes || "",
        status: c.status,
      }));
    }
  } catch (err) {
    console.warn("Error fetching contracts", err);
  }
  return [];
}

export async function fetchSettingsData(companyId: string = MOCK_COMPANIES[0].id): Promise<SettingsData> {
  const company = MOCK_COMPANIES.find((c) => c.id === companyId) || MOCK_COMPANIES[0];

  return {
    adminProfile: {
      firstName: "Thamsanqa",
      lastName: "Lubasi",
      email: "admin@paimbabook.com",
      signatureUrl: "",
    },
    companyProfile: {
      companyName: company.name,
      logoUrl: company.logoUrl || "",
      address: company.address || "",
      phone: company.phone,
      email: company.email,
      currency: company.currency,
    },
    invoiceSettings: {
      taxRate: company.taxRate,
      defaultDueDay: company.defaultDueDay || 1,
      paymentInstructions: company.paymentInstructions || "",
    },
    security: {
      activePinExists: true,
    },
    emailDelivery: {
      method: "resend",
      fromName: company.name,
      fromEmail: company.email || "noreply@paimbabook.com",
      replyTo: company.email || "support@paimbabook.com",
      resendApiKey: "",
      smtpHost: "smtp.resend.com",
      smtpPort: 587,
      smtpSecure: false,
      smtpUser: "resend",
      smtpPass: "",
      nodemailerTransportJson: "",
      sendgridApiKey: "",
      sesRegion: "af-south-1",
      sesAccessKeyId: "",
      sesSecretAccessKey: "",
      sesFromArn: "",
      mailgunApiKey: "",
      mailgunDomain: "",
    },
  };
}

// --------------------------------------------------------------------------------------
// BACKWARD COMPATIBILITY ALIASES
// --------------------------------------------------------------------------------------
export const fetchContractsData = fetchContracts;
export const fetchInspectionsData = fetchInspections;
export const fetchInventoryData = fetchInventoryItems;
export const fetchInvoicesData = fetchInvoices;
export const fetchMaintenanceOverviewData = fetchMaintenanceOverview;
export const fetchProvidersData = fetchProviders;
export const fetchPreventiveTasksData = fetchPreventiveTasks;
export const fetchTenantsData = fetchTenants;
export const fetchWorkOrdersData = fetchWorkOrders;
export const fetchPropertiesData = fetchProperties;
export const fetchAuditTrailData = fetchAuditEvents;


// --------------------------------------------------------------------------------------
// PROCUREMENT & STORES MOCK DATA
// --------------------------------------------------------------------------------------

export const MOCK_PROCUREMENT_REQUESTS: ProcurementRequest[] = [
  {
    id: "proc-001",
    companyId: "a0000000-0000-0000-0000-000000000001",
    requestedByName: "Sipho Khumalo",
    requestingDepartment: "maintenance",
    itemName: "Industrial Air Conditioner Unit",
    itemSpecifications: "18,000 BTU inverter split system, 220V, R410A refrigerant, SABS approved, includes installation brackets and 5m copper piping.",
    quantity: 2,
    unit: "units",
    urgency: "high",
    justification: "Guest rooms 203 and 204 HVAC units have failed. Guest comfort severely impacted.",
    pipelineStage: "quotation_gathering",
    pipelineType: "procurement",
    stageEnteredAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    status: "open",
    events: [
      { id: "ev-001", requestId: "proc-001", stage: "draft", action: "Request submitted by requester", actorName: "Sipho Khumalo", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString() },
      { id: "ev-002", requestId: "proc-001", stage: "dept_manager_approval", action: "Approved by department manager", actorName: "Thamsanqa Lubasi", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 40).toISOString() },
      { id: "ev-003", requestId: "proc-001", stage: "stores_check", action: "Stores checked — item not found in inventory", actorName: "Stores Staff", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 35).toISOString() },
      { id: "ev-004", requestId: "proc-001", stage: "quotation_gathering", action: "Quotation gathering initiated", actorName: "Procurement Staff", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString() },
    ],
    quotations: [
      { id: "quot-001", requestId: "proc-001", supplierName: "CoolTech HVAC", supplierContact: "+27 11 555 0001", amount: 24500, currency: "ZAR", fileType: "pdf", isSelected: false, uploadedByName: "Procurement Staff", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 20).toISOString() },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
  },
  {
    id: "proc-002",
    companyId: "a0000000-0000-0000-0000-000000000001",
    requestedByName: "Nomsa Dlamini",
    requestingDepartment: "front_desk",
    itemName: "A4 Printing Paper (500 sheets/ream)",
    itemSpecifications: "80gsm white A4 printing paper, 500 sheets per ream, acid-free, suitable for laser and inkjet printers. Brand: Rotatrim or equivalent.",
    quantity: 20,
    unit: "reams",
    urgency: "medium",
    justification: "Stock depleted. Required for daily operations and guest receipts.",
    pipelineStage: "stores_dispatch",
    pipelineType: "stores",
    stageEnteredAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    status: "open",
    events: [
      { id: "ev-010", requestId: "proc-002", stage: "draft", action: "Request submitted", actorName: "Nomsa Dlamini", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString() },
      { id: "ev-011", requestId: "proc-002", stage: "dept_manager_approval", action: "Approved by manager", actorName: "Thamsanqa Lubasi", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString() },
      { id: "ev-012", requestId: "proc-002", stage: "stores_check", action: "Stores checked — 25 reams found in inventory", actorName: "Stores Staff", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString() },
      { id: "ev-013", requestId: "proc-002", stage: "stores_dispatch", action: "Item confirmed available in stores. Awaiting dispatch.", actorName: "Stores Staff", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString() },
    ],
    quotations: [],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: "proc-003",
    companyId: "a0000000-0000-0000-0000-000000000001",
    requestedByName: "Lerato Mokoena",
    requestingDepartment: "accountant",
    itemName: "Laptop Computer",
    itemSpecifications: "15.6 inch FHD display, Intel Core i7 12th Gen, 16GB DDR4 RAM, 512GB NVMe SSD, Windows 11 Pro. Dell Latitude 5540 or Lenovo ThinkPad E15 preferred.",
    quantity: 1,
    unit: "pcs",
    urgency: "high",
    justification: "Current laptop is failing, impacting financial reporting deadlines.",
    pipelineStage: "fund_request_to_accounts",
    pipelineType: "procurement",
    stageEnteredAt: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(),
    paymentMethod: "bank_deposit",
    bankDetails: { bankName: "Standard Bank", accountName: "TechZone Supplies (Pty) Ltd", accountNumber: "076543210", branchCode: "051001", reference: "PO-2026-003" },
    totalApprovedAmount: 18500,
    status: "open",
    events: [
      { id: "ev-020", requestId: "proc-003", stage: "draft", action: "Request submitted", actorName: "Lerato Mokoena", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 80).toISOString() },
      { id: "ev-021", requestId: "proc-003", stage: "dept_manager_approval", action: "Approved", actorName: "Thamsanqa Lubasi", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 75).toISOString() },
      { id: "ev-022", requestId: "proc-003", stage: "stores_check", action: "Stores checked — not in inventory", actorName: "Stores Staff", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 70).toISOString() },
      { id: "ev-023", requestId: "proc-003", stage: "quotation_gathering", action: "Quotation gathering started", actorName: "Procurement Staff", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 65).toISOString() },
      { id: "ev-024", requestId: "proc-003", stage: "procurement_manager_approval", action: "Approved by procurement manager. Best quote: TechZone R18,500", actorName: "Procurement Manager", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 55).toISOString() },
      { id: "ev-025", requestId: "proc-003", stage: "fund_request_to_accounts", action: "Fund request submitted to accounts. Payment method: Bank Deposit.", actorName: "Procurement Staff", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString() },
    ],
    quotations: [
      { id: "quot-005", requestId: "proc-003", supplierName: "TechZone Supplies", supplierContact: "+27 21 555 8800", amount: 18500, currency: "ZAR", isSelected: true, uploadedByName: "Procurement", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 63).toISOString() },
      { id: "quot-006", requestId: "proc-003", supplierName: "iStore Business", supplierContact: "+27 11 888 0200", amount: 21000, currency: "ZAR", isSelected: false, uploadedByName: "Procurement", createdAt: new Date(Date.now() - 1000 * 60 * 60 * 62).toISOString() },
    ],
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 80).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(),
  },
];

export const MOCK_STORES_INVENTORY: StoresItem[] = [
  {
    id: "store-001",
    companyId: "a0000000-0000-0000-0000-000000000001",
    name: "Luxury Egyptian Cotton Linen Sets",
    category: "Hospitality & Housekeeping",
    quantity: 45,
    unit: "sets",
    minStockLevel: 20,
    unitCost: 650,
    supplier: "Hotel Linen Direct",
    location: "Central Linen Room B",
    source: "maintenance_inventory",
    createdAt: "2026-01-10T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  },
  {
    id: "store-002",
    companyId: "a0000000-0000-0000-0000-000000000001",
    name: "LED Ceiling Downlights 9W",
    category: "Electrical",
    quantity: 12,
    unit: "pcs",
    minStockLevel: 25,
    unitCost: 85,
    supplier: "VoltMax Supplies",
    location: "Maintenance Store 1",
    source: "maintenance_inventory",
    createdAt: "2026-01-10T00:00:00Z",
    updatedAt: "2026-09-05T00:00:00Z",
  },
  {
    id: "store-003",
    companyId: "a0000000-0000-0000-0000-000000000001",
    name: "A4 Printing Paper (500 sheets/ream)",
    category: "Office Supplies",
    quantity: 25,
    unit: "reams",
    minStockLevel: 10,
    unitCost: 55,
    supplier: "Office Mart",
    location: "Admin Storeroom",
    source: "stores",
    createdAt: "2026-03-15T00:00:00Z",
    updatedAt: "2026-09-10T00:00:00Z",
  },
  {
    id: "store-004",
    companyId: "a0000000-0000-0000-0000-000000000001",
    name: "Bathroom Amenity Sets (Shampoo/Soap/Lotion)",
    category: "Hospitality & Housekeeping",
    quantity: 8,
    unit: "sets",
    minStockLevel: 50,
    unitCost: 35,
    supplier: "Amenity World SA",
    location: "Housekeeping Storage A",
    source: "procured",
    createdAt: "2026-05-20T00:00:00Z",
    updatedAt: "2026-09-12T00:00:00Z",
  },
  {
    id: "store-005",
    companyId: "a0000000-0000-0000-0000-000000000001",
    name: "Gate Remote Controls",
    category: "Security & Access",
    quantity: 6,
    unit: "pcs",
    minStockLevel: 5,
    unitCost: 180,
    supplier: "Access Systems SA",
    location: "Front Desk Drawer",
    source: "procured",
    createdAt: "2026-06-10T00:00:00Z",
    updatedAt: "2026-08-30T00:00:00Z",
  },
  {
    id: "store-006",
    companyId: "a0000000-0000-0000-0000-000000000001",
    name: "First Aid Kits (Complete)",
    category: "Safety & Medical",
    quantity: 4,
    unit: "kits",
    minStockLevel: 5,
    unitCost: 320,
    supplier: "Safety First SA",
    location: "Reception & Kitchen",
    source: "stores",
    createdAt: "2026-04-01T00:00:00Z",
    updatedAt: "2026-08-15T00:00:00Z",
  },
];

export const MOCK_STORES_TRANSACTIONS: StoresTransaction[] = [
  {
    id: "txn-001",
    companyId: "a0000000-0000-0000-0000-000000000001",
    inventoryId: "store-003",
    inventoryName: "A4 Printing Paper (500 sheets/ream)",
    transactionType: "receive",
    quantity: 30,
    receivedFrom: "Office Mart Delivery",
    notes: "Monthly restock order",
    performedByName: "Stores Staff",
    transactionDate: "2026-09-01",
    createdAt: "2026-09-01T09:00:00Z",
  },
  {
    id: "txn-002",
    companyId: "a0000000-0000-0000-0000-000000000001",
    inventoryId: "store-003",
    inventoryName: "A4 Printing Paper (500 sheets/ream)",
    transactionType: "release",
    quantity: 5,
    department: "front_desk",
    releasedToName: "Nomsa Dlamini",
    notes: "Daily operational use",
    performedByName: "Stores Staff",
    transactionDate: "2026-09-05",
    createdAt: "2026-09-05T10:00:00Z",
  },
  {
    id: "txn-003",
    companyId: "a0000000-0000-0000-0000-000000000001",
    inventoryId: "store-004",
    inventoryName: "Bathroom Amenity Sets",
    transactionType: "receive",
    quantity: 100,
    receivedFrom: "Amenity World SA",
    procurementRequestId: "proc-001",
    notes: "Received from procurement order",
    performedByName: "Stores Staff",
    transactionDate: "2026-09-10",
    createdAt: "2026-09-10T14:00:00Z",
  },
];

export const MOCK_SUPPLIER_CONTACTS: SupplierContact[] = [
  {
    id: "sup-001",
    companyId: "a0000000-0000-0000-0000-000000000001",
    supplierName: "CoolTech HVAC Solutions",
    email: "quotes@cooltechhvac.co.za",
    phone: "+27 11 555 0001",
    address: "14 Industrial Road, Boksburg, Gauteng",
    contactPerson: "Mr. Andre Botha",
    contactPersonPhone: "+27 83 555 0001",
    createdAt: "2026-05-01T00:00:00Z",
    updatedAt: "2026-09-01T00:00:00Z",
  },
  {
    id: "sup-002",
    companyId: "a0000000-0000-0000-0000-000000000001",
    supplierName: "TechZone Supplies (Pty) Ltd",
    email: "corporate@techzone.co.za",
    phone: "+27 21 555 8800",
    address: "Suite 5, Century City, Cape Town",
    contactPerson: "Ms. Karen Naidoo",
    contactPersonPhone: "+27 72 888 0200",
    createdAt: "2026-06-15T00:00:00Z",
    updatedAt: "2026-09-10T00:00:00Z",
  },
  {
    id: "sup-003",
    companyId: "a0000000-0000-0000-0000-000000000001",
    supplierName: "Office Mart SA",
    email: "orders@officemart.co.za",
    phone: "+27 11 334 5600",
    address: "88 Commissioner Street, Johannesburg CBD",
    contactPerson: "Mr. Bongani Zulu",
    contactPersonPhone: "+27 76 334 5601",
    createdAt: "2026-03-10T00:00:00Z",
    updatedAt: "2026-08-20T00:00:00Z",
  },
];

export const MOCK_QUOTE_CONTACTS: QuoteContactProfile[] = [
  {
    id: "qc-001",
    companyId: "a0000000-0000-0000-0000-000000000001",
    name: "Lerato Mokoena",
    title: "Accounts Manager",
    email: "accounts@paimbabook.com",
    phone: "+27 11 987 6543",
    department: "accountant",
  },
  {
    id: "qc-002",
    companyId: "a0000000-0000-0000-0000-000000000001",
    name: "Thamsanqa Lubasi",
    title: "General Manager",
    email: "admin@paimbabook.com",
    phone: "+27 11 987 6540",
    department: "admin",
  },
];

// Reminder threshold in hours (default 24h, set by super admin)
let MOCK_REMINDER_THRESHOLD_HOURS = 24;

// ─── PROCUREMENT FUNCTIONS ─────────────────────────────────────────────────────

export async function fetchProcurementRequests(companyId: string = MOCK_COMPANIES[0].id): Promise<ProcurementRequest[]> {
  try {
    const { data, error } = await supabase
      .from("procurement_requests")
      .select("*, procurement_pipeline_events(*), procurement_quotations(*)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      return data.map((r) => ({
        id: r.id,
        companyId: r.company_id,
        requestedByUserId: r.requested_by_user_id,
        requestedByName: r.requested_by_name,
        requestingDepartment: r.requesting_department,
        itemName: r.item_name,
        itemSpecifications: r.item_specifications || "",
        quantity: r.quantity,
        unit: r.unit,
        urgency: r.urgency,
        justification: r.justification || "",
        pipelineStage: r.pipeline_stage,
        pipelineType: r.pipeline_type,
        stageEnteredAt: r.stage_entered_at,
        reminderSentAt: r.reminder_sent_at,
        paymentMethod: r.payment_method,
        bankDetails: r.bank_details,
        totalApprovedAmount: r.total_approved_amount,
        notes: r.notes || "",
        status: r.status,
        events: (r.procurement_pipeline_events || []).map((ev: Record<string, unknown>) => ({
          id: ev.id as string,
          requestId: ev.request_id as string,
          stage: ev.stage as ProcurementStage,
          action: ev.action as string,
          actorName: ev.actor_name as string,
          actorUserId: ev.actor_user_id as string | undefined,
          notes: ev.notes as string | undefined,
          createdAt: ev.created_at as string,
        })),
        quotations: (r.procurement_quotations || []).map((q: Record<string, unknown>) => ({
          id: q.id as string,
          requestId: q.request_id as string,
          supplierName: q.supplier_name as string,
          supplierContact: q.supplier_contact as string | undefined,
          amount: Number(q.amount),
          currency: q.currency as string,
          fileUrl: q.file_url as string | undefined,
          fileType: q.file_type as "pdf" | "image" | undefined,
          notes: q.notes as string | undefined,
          isSelected: q.is_selected as boolean,
          uploadedByName: q.uploaded_by_name as string | undefined,
          createdAt: q.created_at as string,
        })),
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      }));
    }
  } catch (err) {
    console.warn("Error fetching procurement requests", err);
  }
  return [];
}

export async function createProcurementRequest(
  req: Omit<ProcurementRequest, "id" | "pipelineStage" | "pipelineType" | "stageEnteredAt" | "status" | "events" | "quotations" | "createdAt" | "updatedAt">
): Promise<ProcurementRequest> {
  const now = new Date().toISOString();
  const newReq: ProcurementRequest = {
    ...req,
    id: `proc-${Date.now()}`,
    pipelineStage: "dept_manager_approval",
    pipelineType: "procurement",
    stageEnteredAt: now,
    status: "open",
    events: [
      {
        id: `ev-${Date.now()}`,
        requestId: `proc-${Date.now()}`,
        stage: "draft",
        action: "Procurement request submitted",
        actorName: req.requestedByName,
        createdAt: now,
      },
    ],
    quotations: [],
    createdAt: now,
    updatedAt: now,
  };

  try {
    if (isValidUuid(req.companyId)) {
      await supabase.from("procurement_requests").insert({
        company_id: req.companyId,
        requested_by_name: req.requestedByName,
        requesting_department: req.requestingDepartment,
        item_name: req.itemName,
        item_specifications: req.itemSpecifications,
        quantity: req.quantity,
        unit: req.unit,
        urgency: req.urgency,
        justification: req.justification,
        pipeline_stage: "dept_manager_approval",
        pipeline_type: "procurement",
        stage_entered_at: now,
        status: "open",
        notes: req.notes || "",
      });
    }
  } catch (err) {
    console.warn("Could not insert procurement request in Supabase", err);
  }

  MOCK_PROCUREMENT_REQUESTS.push(newReq);
  return newReq;
}

export async function advancePipelineStage(
  requestId: string,
  newStage: ProcurementStage,
  actorName: string,
  action: string,
  notes?: string,
  extraUpdates?: Partial<ProcurementRequest>
): Promise<ProcurementRequest | null> {
  const now = new Date().toISOString();
  const idx = MOCK_PROCUREMENT_REQUESTS.findIndex((r) => r.id === requestId);
  if (idx === -1) return null;

  const event: ProcurementPipelineEvent = {
    id: `ev-${Date.now()}`,
    requestId,
    stage: newStage,
    action,
    actorName,
    notes,
    createdAt: now,
  };

  MOCK_PROCUREMENT_REQUESTS[idx] = {
    ...MOCK_PROCUREMENT_REQUESTS[idx],
    ...extraUpdates,
    pipelineStage: newStage,
    stageEnteredAt: now,
    updatedAt: now,
    events: [...(MOCK_PROCUREMENT_REQUESTS[idx].events || []), event],
  };

  if (newStage === "completed" || newStage === "cancelled") {
    MOCK_PROCUREMENT_REQUESTS[idx].status = newStage === "completed" ? "completed" : "cancelled";
  }

  try {
    if (isValidUuid(requestId)) {
      await supabase.from("procurement_requests").update({
        pipeline_stage: newStage,
        stage_entered_at: now,
        updated_at: now,
        ...(extraUpdates || {}),
      }).eq("id", requestId);

      await supabase.from("procurement_pipeline_events").insert({
        request_id: requestId,
        stage: newStage,
        action,
        actor_name: actorName,
        notes: notes || "",
        created_at: now,
      });
    }
  } catch (err) {
    console.warn("Could not advance pipeline stage in Supabase", err);
  }

  return MOCK_PROCUREMENT_REQUESTS[idx];
}

export async function approveDeptManagerRequest(requestId: string, actorName: string, approved: boolean, notes?: string): Promise<ProcurementRequest | null> {
  if (!approved) {
    return advancePipelineStage(requestId, "cancelled", actorName, `Request rejected by department manager${notes ? `: ${notes}` : ""}`, notes);
  }
  return advancePipelineStage(requestId, "stores_check", actorName, "Approved by department manager. Checking stores inventory.", notes);
}

export async function performStoresCheck(requestId: string, actorName: string, foundInStores: boolean, quantityAvailable?: number, notes?: string): Promise<ProcurementRequest | null> {
  if (foundInStores) {
    return advancePipelineStage(
      requestId, "stores_dispatch", actorName,
      `Stores check complete — ${quantityAvailable || 0} unit(s) available in inventory. Routing to stores dispatch.`,
      notes,
      { pipelineType: "stores" }
    );
  }
  return advancePipelineStage(requestId, "quotation_gathering", actorName, "Stores check complete — item not in inventory. Proceeding to quotation gathering.", notes);
}

export async function startQuotationGathering(requestId: string, actorName: string): Promise<ProcurementRequest | null> {
  return advancePipelineStage(requestId, "quotation_gathering", actorName, "Quotation gathering initiated by procurement staff.");
}

export async function uploadQuotation(
  requestId: string,
  quotation: Omit<ProcurementQuotation, "id" | "requestId" | "createdAt">
): Promise<ProcurementQuotation | null> {
  const req = MOCK_PROCUREMENT_REQUESTS.find((r) => r.id === requestId);
  if (!req) return null;

  const currentQuotations = req.quotations || [];
  if (currentQuotations.length >= 10) {
    throw new Error("Maximum of 10 quotations per request has been reached.");
  }

  const newQuotation: ProcurementQuotation = {
    ...quotation,
    id: `quot-${Date.now()}`,
    requestId,
    createdAt: new Date().toISOString(),
  };

  const idx = MOCK_PROCUREMENT_REQUESTS.findIndex((r) => r.id === requestId);
  if (idx !== -1) {
    MOCK_PROCUREMENT_REQUESTS[idx].quotations = [...currentQuotations, newQuotation];
    MOCK_PROCUREMENT_REQUESTS[idx].updatedAt = new Date().toISOString();
  }

  try {
    if (isValidUuid(requestId)) {
      await supabase.from("procurement_quotations").insert({
        request_id: requestId,
        supplier_name: quotation.supplierName,
        supplier_contact: quotation.supplierContact,
        amount: quotation.amount,
        currency: quotation.currency || "ZAR",
        file_url: quotation.fileUrl,
        file_type: quotation.fileType,
        notes: quotation.notes,
        is_selected: quotation.isSelected,
        uploaded_by_name: quotation.uploadedByName,
      });
    }
  } catch (err) {
    console.warn("Could not insert quotation in Supabase", err);
  }

  return newQuotation;
}

export async function escalateToProcurementManager(requestId: string, actorName: string, selectedQuotationId?: string, notes?: string): Promise<ProcurementRequest | null> {
  const idx = MOCK_PROCUREMENT_REQUESTS.findIndex((r) => r.id === requestId);
  if (idx !== -1 && selectedQuotationId) {
    MOCK_PROCUREMENT_REQUESTS[idx].quotations = (MOCK_PROCUREMENT_REQUESTS[idx].quotations || []).map((q) => ({
      ...q,
      isSelected: q.id === selectedQuotationId,
    }));
  }
  return advancePipelineStage(requestId, "procurement_manager_approval", actorName, "Escalated to procurement manager for final quote approval.", notes);
}

export async function approveProcurementManager(requestId: string, actorName: string, approved: boolean, notes?: string): Promise<ProcurementRequest | null> {
  if (!approved) {
    return advancePipelineStage(requestId, "quotation_gathering", actorName, `Returned to quotation stage by procurement manager${notes ? `: ${notes}` : ""}`, notes);
  }
  return advancePipelineStage(requestId, "fund_request_to_accounts", actorName, "Approved by procurement manager. Fund request sent to accounts department.", notes);
}

export async function requestFundsFromAccounts(
  requestId: string,
  actorName: string,
  paymentMethod: "online" | "cash" | "bank_deposit",
  totalAmount: number,
  bankDetails?: ProcurementRequest["bankDetails"],
  notes?: string
): Promise<ProcurementRequest | null> {
  return advancePipelineStage(
    requestId, "fund_request_to_accounts", actorName,
    `Fund request submitted to accounts. Payment method: ${paymentMethod}. Amount: R${totalAmount.toLocaleString()}`,
    notes,
    { paymentMethod, totalApprovedAmount: totalAmount, bankDetails }
  );
}

export async function approveAccountsFunding(requestId: string, actorName: string, approved: boolean, notes?: string): Promise<ProcurementRequest | null> {
  if (!approved) {
    return advancePipelineStage(requestId, "procurement_manager_approval", actorName, `Fund request returned by accounts${notes ? `: ${notes}` : ""}`, notes);
  }
  return advancePipelineStage(requestId, "payment_approved", actorName, "Funds approved by accounts department. Procurement may proceed with purchase.", notes);
}

export async function markPurchaseComplete(requestId: string, actorName: string, notes?: string): Promise<ProcurementRequest | null> {
  return advancePipelineStage(requestId, "delivered_to_stores", actorName, "Purchase completed. Items delivered to stores for receiving.", notes);
}

export async function confirmStoresReceived(requestId: string, actorName: string, notes?: string): Promise<ProcurementRequest | null> {
  return advancePipelineStage(requestId, "released_to_department", actorName, "Items received and recorded in stores inventory.", notes);
}

export async function releaseFromStoresToDept(requestId: string, actorName: string, notes?: string): Promise<ProcurementRequest | null> {
  return advancePipelineStage(requestId, "completed", actorName, "Items released to requesting department. Request fulfilled.", notes);
}

export async function triggerStageReminder(requestId: string, actorName: string): Promise<boolean> {
  const now = new Date().toISOString();
  const idx = MOCK_PROCUREMENT_REQUESTS.findIndex((r) => r.id === requestId);
  if (idx !== -1) {
    MOCK_PROCUREMENT_REQUESTS[idx].reminderSentAt = now;
    const req = MOCK_PROCUREMENT_REQUESTS[idx];
    const event: ProcurementPipelineEvent = {
      id: `ev-remind-${Date.now()}`,
      requestId,
      stage: req.pipelineStage,
      action: `Reminder triggered by ${actorName} — request has been at "${req.pipelineStage}" stage for extended time.`,
      actorName,
      createdAt: now,
    };
    MOCK_PROCUREMENT_REQUESTS[idx].events = [...(req.events || []), event];
  }
  try {
    if (isValidUuid(requestId)) {
      await supabase.from("procurement_requests").update({ reminder_sent_at: now }).eq("id", requestId);
    }
  } catch {}
  return true;
}

// ─── STORES INVENTORY FUNCTIONS ───────────────────────────────────────────────

export async function fetchStoresInventory(companyId: string = MOCK_COMPANIES[0].id): Promise<StoresItem[]> {
  try {
    const { data, error } = await supabase
      .from("stores_inventory")
      .select("*")
      .eq("company_id", companyId)
      .order("name");

    if (!error && data) {
      return data.map((item) => ({
        id: item.id,
        companyId: item.company_id,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        minStockLevel: item.min_stock_level,
        unitCost: toNumber(item.unit_cost),
        supplier: item.supplier,
        location: item.location,
        source: item.source,
        maintenanceInventoryId: item.maintenance_inventory_id,
        lastRestocked: item.last_restocked,
        notes: item.notes,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      }));
    }
  } catch (err) {
    console.warn("Error fetching stores inventory", err);
  }
  return [];
}

export async function checkStoresForItem(itemName: string, companyId: string = MOCK_COMPANIES[0].id): Promise<StoresItem[]> {
  const inventory = await fetchStoresInventory(companyId);
  const search = itemName.toLowerCase().trim();
  return inventory.filter(
    (item) => item.name.toLowerCase().includes(search) || item.category.toLowerCase().includes(search)
  );
}

export async function receiveStoresItem(
  transaction: Omit<StoresTransaction, "id" | "transactionType" | "createdAt">
): Promise<StoresTransaction> {
  const now = new Date().toISOString();
  const newTxn: StoresTransaction = {
    ...transaction,
    id: `txn-${Date.now()}`,
    transactionType: "receive",
    createdAt: now,
  };

  // Update inventory quantity
  const idx = MOCK_STORES_INVENTORY.findIndex((s) => s.id === transaction.inventoryId);
  if (idx !== -1) {
    MOCK_STORES_INVENTORY[idx].quantity += transaction.quantity;
    MOCK_STORES_INVENTORY[idx].lastRestocked = transaction.transactionDate;
    MOCK_STORES_INVENTORY[idx].updatedAt = now;
  }

  MOCK_STORES_TRANSACTIONS.push(newTxn);

  try {
    if (isValidUuid(transaction.companyId)) {
      await supabase.from("stores_transactions").insert({
        company_id: transaction.companyId,
        inventory_id: transaction.inventoryId,
        procurement_request_id: transaction.procurementRequestId,
        transaction_type: "receive",
        quantity: transaction.quantity,
        received_from: transaction.receivedFrom,
        notes: transaction.notes,
        performed_by_name: transaction.performedByName,
        transaction_date: transaction.transactionDate,
      });

      if (isValidUuid(transaction.inventoryId)) {
        await supabase.from("stores_inventory")
          .update({ quantity: MOCK_STORES_INVENTORY[idx]?.quantity || 0, last_restocked: transaction.transactionDate })
          .eq("id", transaction.inventoryId);
      }
    }
  } catch (err) {
    console.warn("Could not save stores receive transaction", err);
  }

  return newTxn;
}

export async function releaseStoresItem(
  transaction: Omit<StoresTransaction, "id" | "transactionType" | "createdAt">
): Promise<StoresTransaction> {
  const now = new Date().toISOString();

  const idx = MOCK_STORES_INVENTORY.findIndex((s) => s.id === transaction.inventoryId);
  if (idx !== -1) {
    if (MOCK_STORES_INVENTORY[idx].quantity < transaction.quantity) {
      throw new Error(`Insufficient stock. Available: ${MOCK_STORES_INVENTORY[idx].quantity} ${MOCK_STORES_INVENTORY[idx].unit}.`);
    }
    MOCK_STORES_INVENTORY[idx].quantity -= transaction.quantity;
    MOCK_STORES_INVENTORY[idx].updatedAt = now;
  }

  const newTxn: StoresTransaction = {
    ...transaction,
    id: `txn-${Date.now()}`,
    transactionType: "release",
    createdAt: now,
  };

  MOCK_STORES_TRANSACTIONS.push(newTxn);

  try {
    if (isValidUuid(transaction.companyId)) {
      await supabase.from("stores_transactions").insert({
        company_id: transaction.companyId,
        inventory_id: transaction.inventoryId,
        transaction_type: "release",
        quantity: transaction.quantity,
        department: transaction.department,
        released_to_name: transaction.releasedToName,
        notes: transaction.notes,
        performed_by_name: transaction.performedByName,
        transaction_date: transaction.transactionDate,
      });

      if (isValidUuid(transaction.inventoryId)) {
        await supabase.from("stores_inventory")
          .update({ quantity: MOCK_STORES_INVENTORY[idx]?.quantity || 0 })
          .eq("id", transaction.inventoryId);
      }
    }
  } catch (err) {
    console.warn("Could not save stores release transaction", err);
  }

  return newTxn;
}

export async function fetchStoresTransactions(companyId: string = MOCK_COMPANIES[0].id): Promise<StoresTransaction[]> {
  try {
    const { data, error } = await supabase
      .from("stores_transactions")
      .select("*, stores_inventory(name)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      return data.map((t) => ({
        id: t.id,
        companyId: t.company_id,
        inventoryId: t.inventory_id,
        inventoryName: t.stores_inventory?.name,
        procurementRequestId: t.procurement_request_id,
        transactionType: t.transaction_type,
        quantity: t.quantity,
        department: t.department,
        receivedFrom: t.received_from,
        releasedToName: t.released_to_name,
        notes: t.notes,
        performedByName: t.performed_by_name,
        transactionDate: t.transaction_date,
        createdAt: t.created_at,
      }));
    }
  } catch (err) {
    console.warn("Error fetching stores transactions", err);
  }
  return [];
}

export async function addStoresInventoryItem(
  item: Omit<StoresItem, "id" | "createdAt" | "updatedAt">
): Promise<StoresItem> {
  const now = new Date().toISOString();
  const newItem: StoresItem = { ...item, id: `store-${Date.now()}`, createdAt: now, updatedAt: now };

  try {
    if (isValidUuid(item.companyId)) {
      await supabase.from("stores_inventory").insert({
        company_id: item.companyId,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unit: item.unit,
        min_stock_level: item.minStockLevel,
        unit_cost: item.unitCost,
        supplier: item.supplier,
        location: item.location,
        source: item.source,
        notes: item.notes,
      });
    }
  } catch (err) {
    console.warn("Could not insert stores item", err);
  }

  MOCK_STORES_INVENTORY.push(newItem);
  return newItem;
}

export async function updateStoresInventoryItem(id: string, updates: Partial<StoresItem>): Promise<StoresItem | null> {
  const now = new Date().toISOString();
  const idx = MOCK_STORES_INVENTORY.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  MOCK_STORES_INVENTORY[idx] = { ...MOCK_STORES_INVENTORY[idx], ...updates, updatedAt: now };

  try {
    if (isValidUuid(id)) {
      await supabase.from("stores_inventory").update({ ...updates, updated_at: now }).eq("id", id);
    }
  } catch {}

  return MOCK_STORES_INVENTORY[idx];
}

// ─── SUPPLIER CONTACT FUNCTIONS ───────────────────────────────────────────────

export async function fetchSupplierContacts(companyId: string = MOCK_COMPANIES[0].id): Promise<SupplierContact[]> {
  try {
    const { data, error } = await supabase.from("supplier_contacts").select("*").eq("company_id", companyId).order("supplier_name");
    if (!error && data && data.length > 0) {
      return data.map((s) => ({
        id: s.id,
        companyId: s.company_id,
        supplierName: s.supplier_name,
        email: s.email,
        phone: s.phone,
        address: s.address,
        contactPerson: s.contact_person,
        contactPersonPhone: s.contact_person_phone,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
      }));
    }
  } catch (err) {
    console.warn("Falling back to mock supplier contacts", err);
  }
  return MOCK_SUPPLIER_CONTACTS.filter((s) => s.companyId === companyId);
}

export async function saveSupplierContact(
  contact: Omit<SupplierContact, "id" | "createdAt" | "updatedAt">
): Promise<SupplierContact> {
  const now = new Date().toISOString();
  const newContact: SupplierContact = { ...contact, id: `sup-${Date.now()}`, createdAt: now, updatedAt: now };

  try {
    if (isValidUuid(contact.companyId)) {
      await supabase.from("supplier_contacts").insert({
        company_id: contact.companyId,
        supplier_name: contact.supplierName,
        email: contact.email,
        phone: contact.phone,
        address: contact.address,
        contact_person: contact.contactPerson,
        contact_person_phone: contact.contactPersonPhone,
      });
    }
  } catch (err) {
    console.warn("Could not save supplier contact", err);
  }

  MOCK_SUPPLIER_CONTACTS.push(newContact);
  return newContact;
}

// ─── QUOTE CONTACT FUNCTIONS ──────────────────────────────────────────────────

export async function fetchQuoteContacts(companyId: string = MOCK_COMPANIES[0].id): Promise<QuoteContactProfile[]> {
  return MOCK_QUOTE_CONTACTS.filter((q) => q.companyId === companyId);
}

export async function saveQuoteContact(contact: Omit<QuoteContactProfile, "id">): Promise<QuoteContactProfile> {
  const newContact: QuoteContactProfile = { ...contact, id: `qc-${Date.now()}` };
  MOCK_QUOTE_CONTACTS.push(newContact);
  return newContact;
}

export async function updateQuoteContact(id: string, updates: Partial<QuoteContactProfile>): Promise<QuoteContactProfile | null> {
  const idx = MOCK_QUOTE_CONTACTS.findIndex((q) => q.id === id);
  if (idx === -1) return null;
  MOCK_QUOTE_CONTACTS[idx] = { ...MOCK_QUOTE_CONTACTS[idx], ...updates };
  return MOCK_QUOTE_CONTACTS[idx];
}

export async function deleteQuoteContact(id: string): Promise<boolean> {
  const idx = MOCK_QUOTE_CONTACTS.findIndex((q) => q.id === id);
  if (idx !== -1) MOCK_QUOTE_CONTACTS.splice(idx, 1);
  return true;
}

// ─── REMINDER THRESHOLD FUNCTIONS ─────────────────────────────────────────────

export async function fetchReminderThreshold(companyId: string = MOCK_COMPANIES[0].id): Promise<number> {
  try {
    const { data, error } = await supabase
      .from("company_settings")
      .select("reminder_threshold_hours")
      .eq("id", companyId)
      .maybeSingle();
    if (!error && data && data.reminder_threshold_hours) {
      MOCK_REMINDER_THRESHOLD_HOURS = data.reminder_threshold_hours;
      return data.reminder_threshold_hours;
    }
  } catch {}
  return MOCK_REMINDER_THRESHOLD_HOURS;
}

export async function saveReminderThreshold(companyId: string, hours: number): Promise<boolean> {
  MOCK_REMINDER_THRESHOLD_HOURS = hours;
  try {
    if (isValidUuid(companyId)) {
      await supabase.from("company_settings").update({ reminder_threshold_hours: hours }).eq("id", companyId);
    }
  } catch {}
  return true;
}

// ─── ROLE CAPABILITIES ─────────────────────────────────────────────────────────

export const ALL_ROLE_CAPABILITIES: RoleCapability[] = [
  // Hospitality & Core
  { slug: "view_dashboard", label: "View Dashboard", description: "Access the main dashboard overview", section: "Hospitality & Core", defaultEnabled: ["admin", "manager", "front_desk", "accountant", "human_resources", "maintenance", "procurement", "stores", "audit", "it"] },
  { slug: "manage_bookings", label: "Manage Bookings", description: "Create, edit, check-in/out bookings", section: "Hospitality & Core", defaultEnabled: ["admin", "manager", "front_desk"] },
  { slug: "view_rooms", label: "View Rooms & Pricing", description: "View room list and pricing", section: "Hospitality & Core", defaultEnabled: ["admin", "manager", "front_desk", "maintenance"] },
  { slug: "manage_rooms", label: "Manage Rooms & Pricing", description: "Create and edit rooms and rates", section: "Hospitality & Core", defaultEnabled: ["admin", "manager"] },
  { slug: "manage_properties", label: "Manage Properties", description: "Add, edit, delete properties", section: "Hospitality & Core", defaultEnabled: ["admin", "manager"] },
  { slug: "manage_tenants", label: "Manage Tenants & Leases", description: "Create and manage tenant records and lease agreements", section: "Hospitality & Core", defaultEnabled: ["admin", "manager", "accountant"] },
  // Finance & Accounts
  { slug: "collect_rent", label: "Collect Rent", description: "Record rent payments from tenants", section: "Finance & Accounts", defaultEnabled: ["admin", "manager", "accountant"] },
  { slug: "manage_invoices", label: "Manage Invoices", description: "Create, send, and mark invoices as paid", section: "Finance & Accounts", defaultEnabled: ["admin", "manager", "accountant"] },
  { slug: "manage_bills", label: "Manage Bills & Schedules", description: "Manage property utility bills and payment schedules", section: "Finance & Accounts", defaultEnabled: ["admin", "manager", "accountant"] },
  { slug: "view_financial_reports", label: "View Financial Reports", description: "Access financial reports and analytics", section: "Finance & Accounts", defaultEnabled: ["admin", "manager", "accountant", "audit"] },
  { slug: "manage_accounts", label: "Manage Financial Accounts", description: "Access and manage financial account records", section: "Finance & Accounts", defaultEnabled: ["admin", "accountant", "manager"] },
  { slug: "approve_procurement_funds", label: "Approve Procurement Funds", description: "Approve fund requests from procurement department", section: "Finance & Accounts", defaultEnabled: ["admin", "accountant"] },
  // Operations & Maintenance
  { slug: "view_maintenance", label: "View Maintenance Hub", description: "View maintenance jobs and work orders", section: "Operations & Maintenance", defaultEnabled: ["admin", "manager", "maintenance"] },
  { slug: "manage_maintenance", label: "Manage Maintenance", description: "Create and manage maintenance jobs", section: "Operations & Maintenance", defaultEnabled: ["admin", "manager", "maintenance"] },
  { slug: "manage_work_orders", label: "Manage Work Orders", description: "Create and manage work orders for external providers", section: "Operations & Maintenance", defaultEnabled: ["admin", "manager", "maintenance"] },
  { slug: "manage_providers", label: "Manage Service Providers", description: "Add and manage external maintenance providers", section: "Operations & Maintenance", defaultEnabled: ["admin", "manager", "maintenance", "procurement"] },
  { slug: "manage_inspections", label: "Manage Inspections", description: "Schedule and conduct property inspections", section: "Operations & Maintenance", defaultEnabled: ["admin", "manager", "maintenance"] },
  { slug: "manage_scheduled_tasks", label: "Manage Scheduled Tasks", description: "Create and manage preventive maintenance tasks", section: "Operations & Maintenance", defaultEnabled: ["admin", "manager", "maintenance"] },
  { slug: "view_inventory", label: "View Inventory & Stock", description: "View maintenance and stores inventory", section: "Operations & Maintenance", defaultEnabled: ["admin", "manager", "maintenance", "procurement", "stores"] },
  // Human Resources
  { slug: "view_hr", label: "View HR & Payroll", description: "View employee records and HR data", section: "Human Resources", defaultEnabled: ["admin", "manager", "human_resources"] },
  { slug: "manage_payroll", label: "Manage Payroll", description: "Generate, approve, and issue payslips", section: "Human Resources", defaultEnabled: ["admin", "human_resources"] },
  { slug: "manage_employees", label: "Manage Employee Contracts", description: "Create, extend, and terminate employee contracts", section: "Human Resources", defaultEnabled: ["admin", "human_resources", "manager"] },
  { slug: "manage_leave", label: "Manage Leave Records", description: "Approve or reject employee leave applications", section: "Human Resources", defaultEnabled: ["admin", "human_resources", "manager"] },
  // Procurement & Stores
  { slug: "raise_procurement_request", label: "Raise Procurement Requests", description: "Submit procurement requests on behalf of your department", section: "Procurement & Stores", defaultEnabled: ["admin", "manager", "front_desk", "maintenance", "accountant", "human_resources", "it", "procurement", "stores"] },
  { slug: "approve_procurement_dept", label: "Approve Dept Procurement Requests", description: "Approve or reject procurement requests from your department", section: "Procurement & Stores", defaultEnabled: ["admin", "manager"] },
  { slug: "manage_quotations", label: "Manage Quotations", description: "Upload and manage supplier quotations for procurement requests", section: "Procurement & Stores", defaultEnabled: ["admin", "procurement"] },
  { slug: "approve_procurement_manager", label: "Approve as Procurement Manager", description: "Final approval of quotations as procurement manager", section: "Procurement & Stores", defaultEnabled: ["admin", "procurement"] },
  { slug: "generate_quote_request", label: "Generate External Quote Request", description: "Generate and email formal quote request documents to suppliers", section: "Procurement & Stores", defaultEnabled: ["admin", "accountant", "procurement"] },
  { slug: "manage_stores", label: "Manage Stores Inventory", description: "Receive, release, and manage stores inventory items", section: "Procurement & Stores", defaultEnabled: ["admin", "stores", "procurement"] },
  // Customer Portal & Enquiries
  { slug: "manage_enquiries", label: "Manage Enquiries", description: "View and respond to customer enquiries and tickets", section: "Customer Portal", defaultEnabled: ["admin", "manager", "front_desk", "accountant"] },
  { slug: "manage_showcases", label: "Manage Room Showcases", description: "Manage public room listings and showcases", section: "Customer Portal", defaultEnabled: ["admin", "manager", "front_desk"] },
  // Administration & Audit
  { slug: "manage_users", label: "Manage Users & Rights", description: "Create, edit, and deactivate staff user accounts", section: "Administration & Audit", defaultEnabled: ["admin", "it"] },
  { slug: "manage_contracts", label: "Manage Contracts", description: "Create and manage tenant contract templates and contracts", section: "Administration & Audit", defaultEnabled: ["admin", "manager"] },
  { slug: "manage_settings", label: "Manage Settings", description: "Modify company settings, email configuration, and payment details", section: "Administration & Audit", defaultEnabled: ["admin"] },
  { slug: "view_audit_trail", label: "View Audit Trail", description: "View the full system audit log", section: "Administration & Audit", defaultEnabled: ["admin", "audit", "manager"] },
  { slug: "manage_companies", label: "Manage Companies / Organisations", description: "Add and manage multiple company organisations", section: "Administration & Audit", defaultEnabled: ["admin"] },
  { slug: "manage_roles_organogram", label: "Manage Roles, Restrictions & Organogram", description: "Create new roles/job titles, modify duties, and adjust restrictions in the organogram", section: "Administration & Audit", defaultEnabled: ["admin"] },
];

export async function fetchRolePermissions(department: string, companyId: string = MOCK_COMPANIES[0].id): Promise<Record<string, boolean>> {
  try {
    const { data, error } = await supabase
      .from("company_users")
      .select("permissions")
      .eq("company_id", companyId)
      .eq("department", department)
      .limit(1)
      .maybeSingle();

    if (!error && data?.permissions) {
      return data.permissions as Record<string, boolean>;
    }
  } catch {}

  // Build default permissions from capability definitions
  const defaults: Record<string, boolean> = {};
  ALL_ROLE_CAPABILITIES.forEach((cap) => {
    defaults[cap.slug] = cap.defaultEnabled.includes(department as DepartmentType);
  });
  return defaults;
}

export async function saveRolePermissions(
  department: string,
  permissions: Record<string, boolean>,
  companyId: string = MOCK_COMPANIES[0].id
): Promise<boolean> {
  try {
    if (isValidUuid(companyId)) {
      await supabase
        .from("company_users")
        .update({ permissions })
        .eq("company_id", companyId)
        .eq("department", department);
    }
  } catch {}
  // Update mock data
  MOCK_COMPANY_USERS
    .filter((u) => u.companyId === companyId && u.department === department)
    .forEach((u) => { u.permissions = { ...u.permissions, ...permissions }; });
  return true;
}

// ─── CUSTOM ROLES & ORGANOGRAM OVERRIDES ──────────────────────────────────────

export const MOCK_CUSTOM_ROLES: RoleProfileDefinition[] = [];

export async function fetchCustomRoleDefinitions(companyId: string = MOCK_COMPANIES[0].id): Promise<RoleProfileDefinition[]> {
  try {
    const { data, error } = await supabase
      .from("custom_roles")
      .select("*")
      .eq("company_id", companyId);

    if (!error && data && data.length > 0) {
      return data.map((r) => ({
        id: r.id,
        companyId: r.company_id,
        title: r.title,
        department: r.department,
        defaultLevel: r.role_level,
        responsibilities: r.responsibilities || "",
        allowedRules: Array.isArray(r.allowed_rules) ? r.allowed_rules : [],
        restrictedRules: Array.isArray(r.restricted_rules) ? r.restricted_rules : [],
        rights: Array.isArray(r.rights) ? r.rights : [],
        reportsTo: r.reports_to || "General Operations Manager",
        isCustom: true,
      }));
    }
  } catch (err) {
    console.warn("Falling back to mock custom roles", err);
  }
  return MOCK_CUSTOM_ROLES.filter((r) => r.companyId === companyId || !r.companyId);
}

export async function saveCustomRoleDefinition(roleDef: RoleProfileDefinition): Promise<RoleProfileDefinition> {
  const companyId = roleDef.companyId || MOCK_COMPANIES[0].id;
  const now = new Date().toISOString();
  const id = roleDef.id || `custom-role-${Date.now()}`;
  const fullDef: RoleProfileDefinition = {
    ...roleDef,
    id,
    companyId,
    isCustom: true,
  };

  const existingIdx = MOCK_CUSTOM_ROLES.findIndex(
    (r) => (r.id && r.id === id) || (r.title.toLowerCase() === roleDef.title.toLowerCase() && (r.companyId === companyId || !r.companyId))
  );

  if (existingIdx !== -1) {
    MOCK_CUSTOM_ROLES[existingIdx] = fullDef;
  } else {
    MOCK_CUSTOM_ROLES.push(fullDef);
  }

  try {
    if (isValidUuid(companyId)) {
      await supabase.from("custom_roles").upsert({
        company_id: companyId,
        title: roleDef.title,
        department: roleDef.department,
        role_level: roleDef.defaultLevel,
        responsibilities: roleDef.responsibilities,
        allowed_rules: roleDef.allowedRules,
        restricted_rules: roleDef.restrictedRules,
        rights: roleDef.rights || [],
        reports_to: roleDef.reportsTo,
        updated_at: now,
      });
    }
  } catch (err) {
    console.warn("Could not upsert custom role to Supabase", err);
  }

  return fullDef;
}

export async function deleteCustomRoleDefinition(title: string, companyId: string = MOCK_COMPANIES[0].id): Promise<boolean> {
  const idx = MOCK_CUSTOM_ROLES.findIndex(
    (r) => r.title.toLowerCase() === title.toLowerCase() && (r.companyId === companyId || !r.companyId)
  );
  if (idx !== -1) {
    MOCK_CUSTOM_ROLES.splice(idx, 1);
  }

  try {
    if (isValidUuid(companyId)) {
      await supabase.from("custom_roles").delete().eq("company_id", companyId).eq("title", title);
    }
  } catch {}

  return true;
}

export function canUserManageRoles(user?: CompanyUser | null, isSuperAdmin?: boolean): boolean {
  if (isSuperAdmin) return true;
  if (!user) return false;
  if (user.roleLevel === "super_admin" || user.roleLevel === "admin") return true;
  if (user.permissions && (user.permissions["manage_roles_organogram"] || user.permissions["all"])) return true;
  if (user.department === "human_resources" && (user.roleLevel === "manager" || user.permissions?.["manage_hr"])) return true;
  return false;
}

/**
 * Dispatches an official branded payslip email to an employee,
 * containing one or multiple monthly payslips as separate HTML attachments.
 */
export async function sendPayslipEmailViaApi(opts: {
  employeeEmail: string;
  employeeName: string;
  company: Company;
  payslips: Payslip[];
  senderName?: string;
}): Promise<{ success: boolean; error?: string }> {
  const { employeeEmail, employeeName, company, payslips, senderName } = opts;
  if (!employeeEmail || !employeeEmail.includes("@")) {
    return { success: false, error: "Invalid employee email address." };
  }
  if (!payslips || payslips.length === 0) {
    return { success: false, error: "No payslips provided to send." };
  }

  // Maximum 6 payslips allowed per email dispatch
  const trimmedPayslips = payslips.slice(0, 6);

  const attachments = trimmedPayslips.map((slip) => {
    const html = buildProfessionalPayslipHtml(
      {
        ...slip,
        paymentMethod: slip.paymentMethod || "Electronic Funds Transfer (EFT)",
        generatedByName: slip.generatedByName || senderName || "HR & Payroll Administration",
      },
      {
        companyName: company.name,
        currency: company.currency || "ZAR",
        address: company.address || "",
        logoUrl: company.logoUrl || "",
        phone: company.phone || "",
        email: company.email || "",
        taxRate: 15,
        paymentInstructions: "Direct Bank Deposit / EFT",
      }
    );

    const safePeriod = slip.payPeriod.replace(/[^a-zA-Z0-9_-]/g, "_");
    const safeName = employeeName.replace(/[^a-zA-Z0-9_-]/g, "_");
    return {
      filename: `Payslip_${safeName}_${safePeriod}.html`,
      content: html,
      contentType: "text/html",
    };
  });

  const periodList = trimmedPayslips.map((s) => s.payPeriod).join(", ");
  const singleOrPlural = trimmedPayslips.length > 1 ? "Payslips" : "Payslip";

  const emailHtml = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 32px 16px; color: #1e293b; }
      .container { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
      .header { background: #0f172a; padding: 32px 24px; text-align: center; }
      .content { padding: 32px 24px; }
      .card { background: #f1f5f9; border-radius: 12px; padding: 20px; margin: 20px 0; }
      .badge { display: inline-block; background: #2563eb; color: #ffffff; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; padding: 4px 10px; border-radius: 6px; }
      .footer { background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; font-size: 12px; color: #64748b; text-align: center; }
      table { width: 100%; border-collapse: collapse; margin-top: 12px; }
      th, td { padding: 8px 12px; text-align: left; font-size: 13px; border-bottom: 1px solid #e2e8f0; }
      th { font-weight: 700; color: #475569; background: #e2e8f0; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1 style="color: #ffffff; margin: 0; font-size: 20px; font-weight: 800;">${company.name}</h1>
        <p style="color: #94a3b8; margin: 6px 0 0; font-size: 13px;">Human Resources & Payroll Administration</p>
      </div>
      <div class="content">
        <span class="badge">Official Payroll Record</span>
        <h2 style="font-size: 18px; font-weight: 800; margin: 16px 0 8px; color: #0f172a;">Official ${singleOrPlural} Enclosed</h2>
        <p style="font-size: 14px; line-height: 1.6; color: #334155;">
          Dear <strong>${employeeName}</strong>,
        </p>
        <p style="font-size: 14px; line-height: 1.6; color: #334155;">
          Please find attached your official ${singleOrPlural.toLowerCase()} for the period(s): <strong>${periodList}</strong>.
        </p>
        <div class="card">
          <p style="margin: 0 0 8px; font-size: 12px; font-weight: 700; text-transform: uppercase; color: #475569;">Summary of Attached Payroll Records</p>
          <table>
            <thead>
              <tr>
                <th>Pay Period</th>
                <th>Gross Pay</th>
                <th>Net Disbursed</th>
              </tr>
            </thead>
            <tbody>
              ${trimmedPayslips
                .map(
                  (s) => `
                <tr>
                  <td><strong>${s.payPeriod}</strong></td>
                  <td>${company.currency || "ZAR"} ${s.grossPay.toLocaleString()}</td>
                  <td style="color: #059669; font-weight: 700;">${company.currency || "ZAR"} ${s.netPay.toLocaleString()}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </div>
        <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
          Each payslip is attached as a distinct standalone document for your official records and tax filing.
        </p>
      </div>
      <div class="footer">
        <p style="margin: 0;">Dispatched by ${senderName || "HR & Payroll"} on behalf of ${company.name}.</p>
        <p style="margin: 4px 0 0;">Strictly confidential. If you received this email in error, please notify HR immediately.</p>
      </div>
    </div>
  </body>
  </html>
  `;

  const result = await sendEmailViaApi({
    to: employeeEmail,
    subject: `Official ${singleOrPlural} (${periodList}) - ${company.name}`,
    html: emailHtml,
    attachments,
  });

  await logAuditEvent({
    companyId: company.id,
    action: "SEND_PAYSLIP_EMAIL",
    entityType: "payslip",
    entityName: `${employeeName} (${periodList})`,
    actorName: senderName || "HR & Payroll",
    details: `Dispatched ${trimmedPayslips.length} payslip(s) via email to ${employeeEmail} for periods: ${periodList}.`,
  });

  return result;
}

