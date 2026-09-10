export type PropertyType =
  | "house"
  | "storage"
  | "apartment"
  | "hotel"
  | "motel"
  | "lodge"
  | "guest_house"
  | "commercial"
  | string;

export type PropertyStatus = "occupied" | "vacant" | "maintenance" | string;

export type PropertyRow = {
  id: string;
  companyId: string;
  name: string;
  type: PropertyType;
  address: string;
  city?: string;
  country?: string;
  status: PropertyStatus;
  monthlyRent: number;
  totalRooms?: number;
  uniformRoomPricing?: boolean;
  defaultRoomPrice?: number;
  defaultBedBreakfast?: number;
  defaultBedLunch?: number;
  defaultFullBoard?: number;
  photos?: string[];
  isPublished?: boolean;
};

export type RoomTypeListing = {
  id: string;
  companyId: string;
  propertyId: string;
  propertyName?: string;
  typeKey: string;           // 'family' | 'executive' | 'deluxe' | 'suite' | 'standard' | 'twin' | 'single'
  displayName: string;       // "Family Suite"
  adultsCapacity: number;
  kidsCapacity: number;
  totalRoomsOfType: number;  // how many physical rooms of this type exist
  priceRoomOnly: number;
  priceBedBreakfast: number;
  priceFullBoard: number;
  photos: string[];
  description: string;
  amenities: string[];
  isActive: boolean;
  sortOrder: number;
  createdAt?: string;
};

export type Company = {
  id: string;
  name: string;
  slug?: string;
  logoUrl?: string;
  logoBucketPath?: string;
  address?: string;
  phone?: string;
  email?: string;
  taxRate: number;
  currency: string;
  defaultDueDay?: number;
  paymentInstructions?: string;
  createdAt?: string;
};

export type DepartmentType =
  | "admin"
  | "manager"
  | "accountant"
  | "front_desk"
  | "it"
  | "maintenance"
  | "human_resources"
  | "procurement"
  | "audit";

export type RoleLevel =
  | "super_admin"
  | "admin"
  | "manager"
  | "all_rights"
  | "staff";

export type CompanyUser = {
  id: string;
  companyId: string;
  userId: string;
  email: string;
  fullName: string;
  department: DepartmentType;
  jobTitle: string;
  roleLevel: RoleLevel;
  permissions: Record<string, boolean>;
  isActive: boolean;
  createdAt: string;
};

export type RoomStatus =
  | "available"
  | "occupied"
  | "cleaning_needed"
  | "maintenance"
  | "reserved";

export type RoomType =
  | "standard"
  | "single"
  | "double"
  | "twin"
  | "suite"
  | "deluxe"
  | "family"
  | "penthouse"
  | "executive";

export type MealPlan =
  | "room_only"
  | "bed_breakfast"
  | "bed_lunch"
  | "full_board";

export type CommercialRoom = {
  id: string;
  companyId: string;
  propertyId: string;
  propertyName?: string;
  roomNumber: string;
  roomType: RoomType;
  floor: string;
  status: RoomStatus;
  capacityAdults: number;
  capacityChildren: number;
  amenities: string[];
  photos: string[];
  pricePerNight: number;
  priceBedBreakfast: number;
  priceBedLunch: number;
  priceFullBoard: number;
  notes?: string;
  currentBooking?: CommercialBooking;
};

export type BookingStatus =
  | "confirmed"
  | "checked_in"
  | "checked_out"
  | "cancelled"
  | "extended";

export type CommercialBooking = {
  id: string;
  companyId: string;
  propertyId: string;
  propertyName?: string;
  roomId: string;
  roomNumber?: string;
  roomType?: string;
  bookingCode: string;
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  guestIdNumber: string;
  checkInDate: string;
  checkOutDate: string;
  actualCheckIn?: string;
  actualCheckOut?: string;
  mealPlan: MealPlan;
  nights: number;
  ratePerNight: number;
  totalAmount: number;
  depositAmount: number;
  amountPaid: number;
  paymentMethod: "cash" | "card" | "eft" | "online" | "company_account" | string;
  paymentStatus: "pending" | "partial" | "paid" | "refunded";
  bookingStatus: BookingStatus;
  isExtended: boolean;
  extensionHistory: Array<{
    extendedAt: string;
    previousCheckOutDate: string;
    newCheckOutDate: string;
    additionalNights: number;
    additionalCost: number;
    extendedBy: string;
    notes?: string;
  }>;
  createdByName?: string;
  checkedInByName?: string;
  notes?: string;
  createdAt: string;
};

export type HousekeepingStatus = "pending" | "in_progress" | "completed" | "verified";
export type CleaningType = "daily_tidy" | "turnover_clean" | "deep_clean" | "inspection" | "sanitization";

export type HousekeepingSchedule = {
  id: string;
  companyId: string;
  propertyId: string;
  propertyName?: string;
  roomId: string;
  roomNumber?: string;
  cleanerId?: string;
  cleanerName: string;
  cleaningType: CleaningType;
  status: HousekeepingStatus;
  scheduledDate: string;
  shift: "morning" | "afternoon" | "evening" | "turnover";
  priority: "low" | "normal" | "high" | "urgent";
  completedAt?: string;
  notes?: string;
  createdAt: string;
};

export type RoomServiceStatus = "requested" | "preparing" | "out_for_delivery" | "delivered" | "cancelled";
export type RoomServiceType =
  | "breakfast_delivery"
  | "lunch_delivery"
  | "dinner_delivery"
  | "beverages"
  | "laundry"
  | "luggage"
  | "custom";

export type RoomServiceSchedule = {
  id: string;
  companyId: string;
  propertyId: string;
  propertyName?: string;
  roomId: string;
  roomNumber?: string;
  bookingId?: string;
  guestName: string;
  serviceType: RoomServiceType;
  items: Array<{ name: string; quantity: number; unitPrice: number }>;
  scheduledTime: string;
  status: RoomServiceStatus;
  cost: number;
  deliveredAt?: string;
  notes?: string;
  createdAt: string;
};

export type SalaryScale = {
  id: string;
  companyId: string;
  department: DepartmentType;
  jobTitle: string;
  gradeLevel: string;
  minSalary: number;
  midSalary: number;
  maxSalary: number;
  housingAllowance: number;
  transportAllowance: number;
  medicalAllowance: number;
  taxDeductionPct: number;
  pensionDeductionPct: number;
};

export type Payslip = {
  id: string;
  companyId: string;
  userId: string;
  employeeName: string;
  jobTitle: string;
  department: DepartmentType;
  payPeriod: string; // YYYY-MM
  basicSalary: number;
  allowances: {
    housing?: number;
    transport?: number;
    medical?: number;
    overtime?: number;
    bonuses?: number;
    [key: string]: number | undefined;
  };
  grossPay: number;
  deductions: {
    payeTax?: number;
    pension?: number;
    uif?: number;
    other?: number;
    [key: string]: number | undefined;
  };
  netPay: number;
  status: "draft" | "approved" | "paid";
  paymentMethod: string;
  paidAt?: string;
  pdfUrl?: string;
  generatedByName?: string;
  createdAt: string;
};

export type EmployeeContractTemplate = {
  id: string;
  companyId: string;
  title: string;
  department: string;
  templateBody: string;
  standardLeaveDays: number;
  probationMonths: number;
  workingHoursPerWeek: number;
  isDefault: boolean;
};

export type EmployeeContract = {
  id: string;
  companyId: string;
  userId: string;
  templateId?: string;
  employeeName: string;
  department: DepartmentType;
  jobTitle: string;
  startDate: string;
  endDate?: string;
  isPermanent: boolean;
  monthlySalary: number;
  leaveDaysPerYear: number;
  contractDocumentUrl?: string;
  status: "draft" | "active" | "suspended" | "terminated" | "expired";
  signedAt?: string;
  signedByEmployee: boolean;
  createdAt: string;
};

export type LeaveRecord = {
  id: string;
  companyId: string;
  userId: string;
  employeeName: string;
  department: DepartmentType;
  leaveType: "annual" | "sick" | "study" | "maternity" | "paternity" | "bereavement" | "unpaid";
  startDate: string;
  endDate: string;
  daysCount: number;
  reason?: string;
  status: "pending" | "approved" | "rejected";
  approvedByName?: string;
  reviewedAt?: string;
  notes?: string;
  createdAt: string;
};

export type TenantStatus = "active" | "notice" | "ended" | string;

export type TenantRow = {
  id: string;
  companyId?: string;
  fullName: string;
  propertyName: string;
  phone: string;
  email: string;
  tenureStatus: TenantStatus;
  rentStatus: "paid" | "partial" | "overdue" | "unknown";
};

export type DashboardStats = {
  totalProperties: number;
  totalCommercialProperties: number;
  occupiedUnits: number;
  vacantUnits: number;
  occupancyRate: number;
  totalMonthlyIncome: number;
  totalMonthlyInvoiced: number;
  totalMonthlyExpenses: number;
  netProfit: number;
  pendingMaintenance: number;
  overduePayments: number;
  collectionRate: number;
  totalRooms: number;
  occupiedRooms: number;
  availableRooms: number;
  cleaningNeededRooms: number;
  activeCheckinsToday: number;
  maintenanceByStatus: Array<{ status: string; count: number }>;
  maintenanceByCategory: Array<{ category: string; count: number }>;
  propertyStatus: Array<{ status: string; count: number }>;
};

export type CashflowPoint = {
  month: string;
  label: string;
  income: number;
  expenses: number;
  profit: number;
};

export type DashboardData = {
  stats: DashboardStats;
  cashflow: CashflowPoint[];
};

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "paid"
  | "overdue"
  | string;

export type InvoiceRow = {
  id: string;
  companyId?: string;
  tenantId?: string;
  tenantName: string;
  propertyName: string;
  month: string;
  dueDate: string;
  totalAmount: number;
  status: InvoiceStatus;
};

export type ReportsSummary = {
  totalInvoiced: number;
  totalPaid: number;
  totalOverdue: number;
  collectionRate: number;
};

export type ReportsData = {
  summary: ReportsSummary;
  byStatus: Array<{ label: string; count: number }>;
  monthly: CashflowPoint[];
};

export type WorkOrderStatus =
  | "open"
  | "in_progress"
  | "completed"
  | "cancelled"
  | string;

export type WorkOrderRow = {
  id: string;
  companyId?: string;
  propertyName: string;
  providerName: string;
  category: string;
  priority: string;
  status: WorkOrderStatus;
  scheduledDate: string;
  estimatedCost: number;
  actualCost: number;
};

export type ProviderRow = {
  id: string;
  companyId?: string;
  name: string;
  phone: string;
  specialization: string;
  rate: number;
  totalJobs: number;
  totalPaid: number;
};

export type InspectionRow = {
  id: string;
  companyId?: string;
  propertyName: string;
  tenantName: string;
  type: string;
  status: string;
  scheduledDate: string;
  completedDate: string;
  inspectorName: string;
};

export type PreventiveTaskRow = {
  id: string;
  companyId?: string;
  propertyName: string;
  providerName: string;
  title: string;
  category: string;
  frequency: string;
  status: string;
  nextDue: string;
  estimatedCost: number;
};

export type InventoryItemRow = {
  id: string;
  companyId?: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  minStockLevel: number;
  unitCost: number;
  supplier: string;
  location: string;
};

export type MaintenanceOverviewData = {
  totalWorkOrders: number;
  openWorkOrders: number;
  completedWorkOrders: number;
  totalProviders: number;
  scheduledInspections: number;
  overduePreventiveTasks: number;
  lowStockItems: number;
  housekeepingPending: number;
  roomServiceRequested: number;
};

export type ContractRow = {
  id: string;
  companyId?: string;
  title: string;
  tenantName: string;
  propertyName: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  depositAmount: number;
  notes: string;
  status: string;
};

export type AuditEventRow = {
  id: string;
  companyId?: string;
  createdAt: string;
  action: string;
  entityType: string;
  entityId: string;
  entityName: string;
  actorName: string;
  details: string;
};

export type SettingsData = {
  adminProfile: {
    firstName: string;
    lastName: string;
    email: string;
    signatureUrl: string;
  };
  companyProfile: {
    companyName: string;
    logoUrl: string;
    address: string;
    phone?: string;
    email?: string;
    currency?: string;
  };
  invoiceSettings: {
    taxRate: number;
    defaultDueDay: number;
    paymentInstructions: string;
  };
  security: {
    activePinExists: boolean;
  };
  emailDelivery: {
    method: "mailto" | "resend" | "smtp" | "nodemailer" | "sendgrid" | "ses" | "mailgun";
    fromName: string;
    fromEmail: string;
    replyTo: string;
    resendApiKey: string;
    smtpHost: string;
    smtpPort: number;
    smtpSecure: boolean;
    smtpUser: string;
    smtpPass: string;
    nodemailerTransportJson: string;
    sendgridApiKey: string;
    sesRegion: string;
    sesAccessKeyId: string;
    sesSecretAccessKey: string;
    sesFromArn: string;
    mailgunApiKey: string;
    mailgunDomain: string;
  };
};
