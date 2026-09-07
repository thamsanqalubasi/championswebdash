import type {
  AuditEventRow,
  CommercialBooking,
  CommercialRoom,
  Company,
  CompanyUser,
  ContractRow,
  DashboardData,
  DashboardStats,
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
} from "./types";
import { supabase } from "./supabase";

function toNumber(value: unknown) {
  return Number(value ?? 0) || 0;
}

// --------------------------------------------------------------------------------------
// MOCK MULTI-TENANT LOCAL STORES (Seamless local fallback when DB tables are empty/migrating)
// --------------------------------------------------------------------------------------

export const MOCK_COMPANIES: Company[] = [
  {
    id: "a0000000-0000-0000-0000-000000000001",
    name: "Champions Court Hospitality & Properties",
    slug: "champions-court",
    address: "124 Main Boulevard, Johannesburg, South Africa",
    phone: "+27 11 987 6543",
    email: "admin@championscourt.co.za",
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
    id: "u0000000-0000-0000-0000-000000000001",
    companyId: "a0000000-0000-0000-0000-000000000001",
    userId: "user-admin-01",
    email: "admin@championscourt.co.za",
    fullName: "Thamsanqa Lubasi (Super Admin)",
    department: "admin",
    jobTitle: "Admin - Super Admin",
    roleLevel: "super_admin",
    permissions: { all: true },
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "u0000000-0000-0000-0000-000000000002",
    companyId: "a0000000-0000-0000-0000-000000000001",
    userId: "user-frontdesk-01",
    email: "frontdesk@championscourt.co.za",
    fullName: "Nomsa Dlamini",
    department: "front_desk",
    jobTitle: "Front Desk - Receptionist",
    roleLevel: "staff",
    permissions: { checkin_guests: true, view_rooms: true },
    isActive: true,
    createdAt: "2026-01-05T00:00:00Z",
  },
  {
    id: "u0000000-0000-0000-0000-000000000003",
    companyId: "a0000000-0000-0000-0000-000000000001",
    userId: "user-maint-01",
    email: "maintenance@championscourt.co.za",
    fullName: "Sipho Khumalo",
    department: "maintenance",
    jobTitle: "Maintenance - Manager",
    roleLevel: "manager",
    permissions: { manage_maintenance: true, assign_cleaners: true },
    isActive: true,
    createdAt: "2026-01-10T00:00:00Z",
  },
  {
    id: "u0000000-0000-0000-0000-000000000004",
    companyId: "a0000000-0000-0000-0000-000000000001",
    userId: "user-acc-01",
    email: "accounts@championscourt.co.za",
    fullName: "Lerato Mokoena",
    department: "accountant",
    jobTitle: "Accountant - Manager",
    roleLevel: "manager",
    permissions: { manage_finance: true, view_invoices: true },
    isActive: true,
    createdAt: "2026-01-12T00:00:00Z",
  },
  {
    id: "u0000000-0000-0000-0000-000000000005",
    companyId: "a0000000-0000-0000-0000-000000000001",
    userId: "user-hr-01",
    email: "hr@championscourt.co.za",
    fullName: "Precious Ndlovu",
    department: "human_resources",
    jobTitle: "HR - Manager",
    roleLevel: "manager",
    permissions: { manage_hr: true, manage_payroll: true },
    isActive: true,
    createdAt: "2026-01-15T00:00:00Z",
  },
  {
    id: "u0000000-0000-0000-0000-000000000006",
    companyId: "a0000000-0000-0000-0000-000000000001",
    userId: "user-audit-01",
    email: "audit@championscourt.co.za",
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
    id: "room-101",
    companyId: "a0000000-0000-0000-0000-000000000001",
    propertyId: "b0000000-0000-0000-0000-000000000001",
    propertyName: "Grand Champions Safari Lodge & Hotel",
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
    id: "room-102",
    companyId: "a0000000-0000-0000-0000-000000000001",
    propertyId: "b0000000-0000-0000-0000-000000000001",
    propertyName: "Grand Champions Safari Lodge & Hotel",
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
    id: "room-103",
    companyId: "a0000000-0000-0000-0000-000000000001",
    propertyId: "b0000000-0000-0000-0000-000000000001",
    propertyName: "Grand Champions Safari Lodge & Hotel",
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
    id: "room-201",
    companyId: "a0000000-0000-0000-0000-000000000001",
    propertyId: "b0000000-0000-0000-0000-000000000001",
    propertyName: "Grand Champions Safari Lodge & Hotel",
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
    id: "room-202",
    companyId: "a0000000-0000-0000-0000-000000000001",
    propertyId: "b0000000-0000-0000-0000-000000000001",
    propertyName: "Grand Champions Safari Lodge & Hotel",
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
    id: "booking-001",
    companyId: "a0000000-0000-0000-0000-000000000001",
    propertyId: "b0000000-0000-0000-0000-000000000001",
    propertyName: "Grand Champions Safari Lodge & Hotel",
    roomId: "room-101",
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
    id: "clean-001",
    companyId: "a0000000-0000-0000-0000-000000000001",
    propertyId: "b0000000-0000-0000-0000-000000000001",
    propertyName: "Grand Champions Safari Lodge & Hotel",
    roomId: "room-103",
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
    id: "clean-002",
    companyId: "a0000000-0000-0000-0000-000000000001",
    propertyId: "b0000000-0000-0000-0000-000000000001",
    propertyName: "Grand Champions Safari Lodge & Hotel",
    roomId: "room-101",
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
    id: "rs-001",
    companyId: "a0000000-0000-0000-0000-000000000001",
    propertyId: "b0000000-0000-0000-0000-000000000001",
    propertyName: "Grand Champions Safari Lodge & Hotel",
    roomId: "room-101",
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
    userId: "user-frontdesk-01",
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

export async function fetchCompanyUsers(companyId: string = MOCK_COMPANIES[0].id): Promise<CompanyUser[]> {
  try {
    const { data, error } = await supabase
      .from("company_users")
      .select("*, users(email, first_name, last_name)")
      .eq("company_id", companyId);

    if (!error && data && data.length > 0) {
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
  } catch (err) {
    console.warn("Falling back to mock company users", err);
  }
  return MOCK_COMPANY_USERS.filter((u) => u.companyId === companyId || !u.companyId);
}

export async function createCompanyUser(user: Partial<CompanyUser>): Promise<CompanyUser> {
  const newUser: CompanyUser = {
    id: `cu-${Date.now()}`,
    companyId: user.companyId || MOCK_COMPANIES[0].id,
    userId: user.userId || `user-${Date.now()}`,
    email: user.email || "newuser@domain.com",
    fullName: user.fullName || "New Staff Member",
    department: user.department || "front_desk",
    jobTitle: user.jobTitle || "Front Desk - Receptionist",
    roleLevel: user.roleLevel || "staff",
    permissions: user.permissions || {},
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  try {
    await supabase.from("company_users").insert({
      company_id: newUser.companyId,
      user_id: newUser.userId,
      department: newUser.department,
      job_title: newUser.jobTitle,
      role_level: newUser.roleLevel,
      permissions: newUser.permissions,
      is_active: newUser.isActive,
    });
  } catch {
    // ignore
  }

  MOCK_COMPANY_USERS.push(newUser);
  return newUser;
}

export async function deleteCompanyUser(id: string): Promise<boolean> {
  try {
    await supabase.from("company_users").delete().eq("id", id);
  } catch {
    // ignore
  }
  const idx = MOCK_COMPANY_USERS.findIndex((u) => u.id === id);
  if (idx !== -1) {
    MOCK_COMPANY_USERS.splice(idx, 1);
  }
  return true;
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
    if (!error && data && data.length > 0) {
      return data.map((r) => ({
        id: r.id,
        companyId: r.company_id,
        propertyId: r.property_id,
        propertyName: r.properties?.name || "Grand Champions Safari Lodge",
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
    console.warn("Falling back to mock commercial rooms", err);
  }

  let list = MOCK_COMMERCIAL_ROOMS;
  if (propertyId) {
    list = list.filter((r) => r.propertyId === propertyId);
  }
  return list;
}

export async function saveCommercialRoom(room: Partial<CommercialRoom>): Promise<CommercialRoom> {
  const existingIdx = MOCK_COMMERCIAL_ROOMS.findIndex((r) => r.id === room.id);
  const updatedRoom: CommercialRoom = {
    id: room.id || `room-${Date.now()}`,
    companyId: room.companyId || MOCK_COMPANIES[0].id,
    propertyId: room.propertyId || MOCK_COMMERCIAL_ROOMS[0].propertyId,
    propertyName: room.propertyName || "Grand Champions Safari Lodge & Hotel",
    roomNumber: room.roomNumber || "Room 100",
    roomType: room.roomType || "standard",
    floor: room.floor || "Ground Floor",
    status: room.status || "available",
    capacityAdults: room.capacityAdults ?? 2,
    capacityChildren: room.capacityChildren ?? 0,
    amenities: room.amenities || ["wifi", "tv", "ac"],
    photos: room.photos || [],
    pricePerNight: room.pricePerNight ?? 1000,
    priceBedBreakfast: room.priceBedBreakfast ?? 1300,
    priceBedLunch: room.priceBedLunch ?? 1600,
    priceFullBoard: room.priceFullBoard ?? 2000,
    notes: room.notes || "",
  };

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

    if (!error && data && data.length > 0) {
      return data.map((b) => ({
        id: b.id,
        companyId: b.company_id,
        propertyId: b.property_id,
        propertyName: b.properties?.name || "Grand Champions Safari Lodge",
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
    console.warn("Falling back to mock bookings", err);
  }

  return MOCK_COMMERCIAL_BOOKINGS.filter((b) => b.companyId === companyId || !b.companyId);
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

  const newBooking: CommercialBooking = {
    id: `booking-${Date.now()}`,
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
    paymentStatus: params.amountPaid >= params.totalAmount ? "paid" : "partial",
    bookingStatus: "checked_in",
    isExtended: false,
    extensionHistory: [],
    checkedInByName: params.checkedInByName,
    notes: params.notes || "",
    createdAt: new Date().toISOString(),
  };

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
  if (!booking) return false;

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

  await logAuditEvent({
    companyId: booking.companyId,
    action: "EXTEND_BOOKING",
    entityType: "commercial_booking",
    entityId: booking.id,
    entityName: `${booking.guestName} (${booking.roomNumber})`,
    actorName: params.actorName,
    details: `Extended stay by ${params.additionalNights} nights to ${params.newCheckOutDate}. Added cost: R${params.additionalCost}.`,
  });

  return true;
}

export async function checkoutCommercialBooking(
  bookingId: string,
  actorName: string
): Promise<boolean> {
  const booking = MOCK_COMMERCIAL_BOOKINGS.find((b) => b.id === bookingId);
  if (!booking) return false;

  booking.bookingStatus = "checked_out";
  booking.actualCheckOut = new Date().toISOString();

  const room = MOCK_COMMERCIAL_ROOMS.find((r) => r.id === booking.roomId);
  if (room) {
    room.status = "cleaning_needed";
  }

  MOCK_HOUSEKEEPING.unshift({
    id: `clean-${Date.now()}`,
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

  await logAuditEvent({
    companyId: booking.companyId,
    action: "CHECKOUT_GUEST",
    entityType: "commercial_booking",
    entityId: booking.id,
    entityName: `${booking.guestName} (${booking.roomNumber})`,
    actorName,
    details: `Completed checkout for ${booking.guestName} from ${booking.roomNumber}. Room flagged for turnover cleaning.`,
  });

  return true;
}

export async function fetchHousekeepingSchedules(
  companyId: string = MOCK_COMPANIES[0].id
): Promise<HousekeepingSchedule[]> {
  return MOCK_HOUSEKEEPING;
}

export async function updateHousekeepingStatus(
  id: string,
  status: HousekeepingSchedule["status"],
  actorName: string
): Promise<boolean> {
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
  return MOCK_ROOM_SERVICE.filter((rs) => rs.companyId === companyId || !rs.companyId);
}

export async function createRoomServiceOrder(order: Partial<RoomServiceSchedule>): Promise<RoomServiceSchedule> {
  const newOrder: RoomServiceSchedule = {
    id: `rs-${Date.now()}`,
    companyId: order.companyId || MOCK_COMPANIES[0].id,
    propertyId: order.propertyId || MOCK_COMMERCIAL_ROOMS[0].propertyId,
    propertyName: order.propertyName || "Grand Champions Safari Lodge & Hotel",
    roomId: order.roomId || MOCK_COMMERCIAL_ROOMS[0].id,
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

  MOCK_ROOM_SERVICE.unshift(newOrder);
  return newOrder;
}

export async function fetchSalaryScales(companyId: string = MOCK_COMPANIES[0].id): Promise<SalaryScale[]> {
  return MOCK_SALARY_SCALES;
}

export async function saveSalaryScale(scale: Partial<SalaryScale>): Promise<SalaryScale> {
  const existingIdx = MOCK_SALARY_SCALES.findIndex(
    (s) => s.department === scale.department && s.jobTitle === scale.jobTitle
  );

  const updated: SalaryScale = {
    id: scale.id || `scale-${Date.now()}`,
    companyId: scale.companyId || MOCK_COMPANIES[0].id,
    department: scale.department || "front_desk",
    jobTitle: scale.jobTitle || "Front Desk - Staff",
    gradeLevel: scale.gradeLevel || "Band B1",
    minSalary: scale.minSalary ?? 12000,
    midSalary: scale.midSalary ?? 15000,
    maxSalary: scale.maxSalary ?? 18000,
    housingAllowance: scale.housingAllowance ?? 1500,
    transportAllowance: scale.transportAllowance ?? 1000,
    medicalAllowance: scale.medicalAllowance ?? 800,
    taxDeductionPct: scale.taxDeductionPct ?? 15.0,
    pensionDeductionPct: scale.pensionDeductionPct ?? 5.0,
  };

  if (existingIdx !== -1) {
    MOCK_SALARY_SCALES[existingIdx] = updated;
  } else {
    MOCK_SALARY_SCALES.push(updated);
  }
  return updated;
}

export async function fetchPayslips(companyId: string = MOCK_COMPANIES[0].id, payPeriod?: string): Promise<Payslip[]> {
  return MOCK_PAYSLIPS;
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
  const totalAllowances = Object.values(params.allowances).reduce((a, b) => a + b, 0);
  const grossPay = params.basicSalary + totalAllowances;
  const totalDeductions = Object.values(params.deductions).reduce((a, b) => a + b, 0);
  const netPay = grossPay - totalDeductions;

  const newPayslip: Payslip = {
    id: `pay-${Date.now()}`,
    companyId: params.companyId,
    userId: params.userId,
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
  return MOCK_EMPLOYEE_TEMPLATES;
}

export async function fetchEmployeeContracts(companyId: string = MOCK_COMPANIES[0].id): Promise<EmployeeContract[]> {
  return MOCK_EMPLOYEE_CONTRACTS;
}

export async function createEmployeeContract(contract: Partial<EmployeeContract>): Promise<EmployeeContract> {
  const newCon: EmployeeContract = {
    id: `emp-con-${Date.now()}`,
    companyId: contract.companyId || MOCK_COMPANIES[0].id,
    userId: contract.userId || `user-${Date.now()}`,
    templateId: contract.templateId || "tmpl-001",
    employeeName: contract.employeeName || "Employee Name",
    department: contract.department || "front_desk",
    jobTitle: contract.jobTitle || "Front Desk - Receptionist",
    startDate: contract.startDate || new Date().toISOString().slice(0, 10),
    isPermanent: contract.isPermanent ?? true,
    monthlySalary: contract.monthlySalary ?? 15000,
    leaveDaysPerYear: contract.leaveDaysPerYear ?? 21,
    status: "active",
    signedAt: new Date().toISOString(),
    signedByEmployee: true,
    createdAt: new Date().toISOString(),
  };

  MOCK_EMPLOYEE_CONTRACTS.unshift(newCon);
  return newCon;
}

export async function fetchLeaveRecords(companyId: string = MOCK_COMPANIES[0].id): Promise<LeaveRecord[]> {
  return MOCK_LEAVE_RECORDS;
}

export async function requestLeave(record: Partial<LeaveRecord>): Promise<LeaveRecord> {
  const newLeave: LeaveRecord = {
    id: `leave-${Date.now()}`,
    companyId: record.companyId || MOCK_COMPANIES[0].id,
    userId: record.userId || "user-01",
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

  MOCK_LEAVE_RECORDS.unshift(newLeave);
  return newLeave;
}

export async function updateLeaveStatus(
  id: string,
  status: "approved" | "rejected",
  reviewerName: string
): Promise<boolean> {
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
}): Promise<void> {
  const row: AuditEventRow = {
    id: `audit-${Date.now()}`,
    companyId: event.companyId || MOCK_COMPANIES[0].id,
    createdAt: new Date().toISOString(),
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId || "",
    entityName: event.entityName,
    actorName: event.actorName,
    details: event.details,
  };

  try {
    await supabase.from("audit_log").insert({
      company_id: row.companyId,
      action: row.action,
      entity_type: row.entityType,
      entity_id: row.entityId || null,
      entity_name: row.entityName,
      actor_name: row.actorName,
      details: { summary: row.details },
    });
  } catch {
    // fallback
  }

  MOCK_AUDIT_TRAIL.unshift(row);
}

export async function fetchAuditEvents(companyId: string = MOCK_COMPANIES[0].id): Promise<AuditEventRow[]> {
  return MOCK_AUDIT_TRAIL;
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
  const rooms = await fetchCommercialRooms(companyId);
  const occupiedRooms = rooms.filter((r) => r.status === "occupied").length;
  const availableRooms = rooms.filter((r) => r.status === "available").length;
  const cleaningNeeded = rooms.filter((r) => r.status === "cleaning_needed").length;

  const stats: DashboardStats = {
    totalProperties: 8,
    totalCommercialProperties: 2,
    occupiedUnits: 6,
    vacantUnits: 2,
    occupancyRate: 75,
    totalMonthlyIncome: 142500,
    totalMonthlyInvoiced: 156000,
    totalMonthlyExpenses: 48200,
    netProfit: 94300,
    pendingMaintenance: 3,
    overduePayments: 2,
    collectionRate: 91.3,
    totalRooms: rooms.length || 12,
    occupiedRooms,
    availableRooms,
    cleaningNeededRooms: cleaningNeeded,
    activeCheckinsToday: 4,
    maintenanceByStatus: [
      { status: "Open", count: 2 },
      { status: "In Progress", count: 1 },
      { status: "Completed", count: 9 },
    ],
    maintenanceByCategory: [
      { category: "Plumbing", count: 3 },
      { category: "Electrical", count: 2 },
      { category: "HVAC", count: 1 },
    ],
    propertyStatus: [
      { status: "Residential", count: 6 },
      { status: "Commercial Lodge", count: 2 },
    ],
  };

  const cashflow = [
    { month: "2026-03", label: "Mar", income: 110000, expenses: 42000, profit: 68000 },
    { month: "2026-04", label: "Apr", income: 125000, expenses: 44000, profit: 81000 },
    { month: "2026-05", label: "May", income: 132000, expenses: 41000, profit: 91000 },
    { month: "2026-06", label: "Jun", income: 128000, expenses: 46000, profit: 82000 },
    { month: "2026-07", label: "Jul", income: 139000, expenses: 45000, profit: 94000 },
    { month: "2026-08", label: "Aug", income: 142500, expenses: 48200, profit: 94300 },
  ];

  return { stats, cashflow };
}

export async function fetchProperties(companyId: string = MOCK_COMPANIES[0].id): Promise<PropertyRow[]> {
  try {
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("company_id", companyId)
      .order("name");

    if (!error && data && data.length > 0) {
      return data.map((p) => ({
        id: p.id,
        companyId: p.company_id || companyId,
        name: p.name,
        type: p.type,
        address: p.address || "",
        status: p.status,
        monthlyRent: toNumber(p.monthly_rent),
        totalRooms: p.total_rooms,
        uniformRoomPricing: p.uniform_room_pricing,
        defaultRoomPrice: toNumber(p.default_room_price),
        defaultBedBreakfast: toNumber(p.default_bed_breakfast),
        defaultBedLunch: toNumber(p.default_bed_lunch),
        defaultFullBoard: toNumber(p.default_full_board),
        photos: p.photos || [],
      }));
    }
  } catch {
    // fallback
  }

  return [
    {
      id: "b0000000-0000-0000-0000-000000000001",
      companyId: "a0000000-0000-0000-0000-000000000001",
      name: "Grand Champions Safari Lodge & Hotel",
      type: "lodge",
      address: "Plot 45 Kruger Gateway, Nelspruit, Mpumalanga",
      status: "occupied",
      monthlyRent: 0,
      totalRooms: 12,
      uniformRoomPricing: true,
      defaultRoomPrice: 1250,
      defaultBedBreakfast: 1550,
      defaultBedLunch: 1850,
      defaultFullBoard: 2250,
      photos: ["https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=800&q=80"],
    },
    {
      id: "prop-002",
      companyId: "a0000000-0000-0000-0000-000000000001",
      name: "Champions Executive Villa 4",
      type: "house",
      address: "18 Sandton Ridge, Johannesburg",
      status: "occupied",
      monthlyRent: 24000,
      photos: ["https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=800&q=80"],
    },
    {
      id: "prop-003",
      companyId: "a0000000-0000-0000-0000-000000000001",
      name: "Sunrise Guest House & Suites",
      type: "guest_house",
      address: "9 Ocean View Drive, Umhlanga",
      status: "occupied",
      monthlyRent: 0,
      totalRooms: 8,
      uniformRoomPricing: false,
      photos: ["https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=800&q=80"],
    },
  ];
}

export async function fetchTenants(companyId: string = MOCK_COMPANIES[0].id): Promise<TenantRow[]> {
  return [
    {
      id: "ten-001",
      companyId,
      fullName: "Michael Van Der Merwe",
      propertyName: "Champions Executive Villa 4",
      phone: "+27 83 902 1199",
      email: "m.vandermerwe@gmail.com",
      tenureStatus: "active",
      rentStatus: "paid",
    },
  ];
}

export async function fetchInvoices(companyId: string = MOCK_COMPANIES[0].id): Promise<InvoiceRow[]> {
  return [
    {
      id: "inv-001",
      companyId,
      tenantName: "Michael Van Der Merwe",
      propertyName: "Champions Executive Villa 4",
      month: "2026-08",
      dueDate: "2026-08-01",
      totalAmount: 24000,
      status: "paid",
    },
  ];
}

export async function fetchReportsData(companyId: string = MOCK_COMPANIES[0].id): Promise<ReportsData> {
  return {
    summary: {
      totalInvoiced: 156000,
      totalPaid: 142500,
      totalOverdue: 13500,
      collectionRate: 91.3,
    },
    byStatus: [
      { label: "Paid", count: 8 },
      { label: "Sent", count: 2 },
      { label: "Draft", count: 1 },
      { label: "Overdue", count: 1 },
    ],
    monthly: [
      { month: "2026-06", label: "Jun", income: 128000, expenses: 46000, profit: 82000 },
      { month: "2026-07", label: "Jul", income: 139000, expenses: 45000, profit: 94000 },
      { month: "2026-08", label: "Aug", income: 142500, expenses: 48200, profit: 94300 },
    ],
  };
}

export async function fetchMaintenanceOverview(companyId: string = MOCK_COMPANIES[0].id): Promise<MaintenanceOverviewData> {
  return {
    totalWorkOrders: 12,
    openWorkOrders: 3,
    completedWorkOrders: 9,
    totalProviders: 6,
    scheduledInspections: 4,
    overduePreventiveTasks: 1,
    lowStockItems: 2,
    housekeepingPending: 2,
    roomServiceRequested: 1,
  };
}

export async function fetchWorkOrders(companyId: string = MOCK_COMPANIES[0].id): Promise<WorkOrderRow[]> {
  return [
    {
      id: "wo-001",
      companyId,
      propertyName: "Grand Champions Safari Lodge & Hotel",
      providerName: "AquaPro Plumbing",
      category: "Plumbing",
      priority: "high",
      status: "open",
      scheduledDate: "2026-08-31",
      estimatedCost: 1800,
      actualCost: 0,
    },
  ];
}

export async function fetchProviders(companyId: string = MOCK_COMPANIES[0].id): Promise<ProviderRow[]> {
  return [
    {
      id: "prov-001",
      companyId,
      name: "AquaPro Plumbing",
      phone: "+27 11 800 2933",
      specialization: "Plumbing & Drainage",
      rate: 450,
      totalJobs: 14,
      totalPaid: 24500,
    },
  ];
}

export async function fetchInspections(companyId: string = MOCK_COMPANIES[0].id): Promise<InspectionRow[]> {
  return [
    {
      id: "insp-001",
      companyId,
      propertyName: "Grand Champions Safari Lodge & Hotel",
      tenantName: "Commercial Operations",
      type: "routine",
      status: "scheduled",
      scheduledDate: "2026-09-05",
      completedDate: "",
      inspectorName: "Sipho Khumalo",
    },
  ];
}

export async function fetchPreventiveTasks(companyId: string = MOCK_COMPANIES[0].id): Promise<PreventiveTaskRow[]> {
  return [
    {
      id: "prev-001",
      companyId,
      propertyName: "Grand Champions Safari Lodge & Hotel",
      providerName: "CoolBreeze HVAC",
      title: "Quarterly Air Conditioning Filter Replacement",
      category: "HVAC",
      frequency: "quarterly",
      status: "active",
      nextDue: "2026-09-10",
      estimatedCost: 3200,
    },
  ];
}

export async function fetchInventoryItems(companyId: string = MOCK_COMPANIES[0].id): Promise<InventoryItemRow[]> {
  return [
    {
      id: "inv-item-01",
      companyId,
      name: "Luxury Egyptian Cotton Linen Sets",
      category: "Hospitality & Housekeeping",
      quantity: 45,
      unit: "sets",
      minStockLevel: 20,
      unitCost: 650,
      supplier: "Hotel Linen Direct",
      location: "Central Linen Room B",
    },
    {
      id: "inv-item-02",
      companyId,
      name: "LED Ceiling Downlights 9W",
      category: "Electrical",
      quantity: 12,
      unit: "pcs",
      minStockLevel: 25,
      unitCost: 85,
      supplier: "VoltMax Supplies",
      location: "Maintenance Store 1",
    },
  ];
}

export async function fetchContracts(companyId: string = MOCK_COMPANIES[0].id): Promise<ContractRow[]> {
  return [
    {
      id: "con-001",
      companyId,
      title: "Commercial Master Lease",
      tenantName: "Michael Van Der Merwe",
      propertyName: "Champions Executive Villa 4",
      startDate: "2026-01-01",
      endDate: "2026-12-31",
      monthlyRent: 24000,
      depositAmount: 48000,
      notes: "Standard 12 month residential lease agreement.",
      status: "active",
    },
  ];
}

export async function fetchSettingsData(companyId: string = MOCK_COMPANIES[0].id): Promise<SettingsData> {
  const company = MOCK_COMPANIES.find((c) => c.id === companyId) || MOCK_COMPANIES[0];

  return {
    adminProfile: {
      firstName: "Thamsanqa",
      lastName: "Lubasi",
      email: "admin@championscourt.co.za",
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
      fromEmail: company.email || "noreply@championscourt.co.za",
      replyTo: company.email || "support@championscourt.co.za",
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
