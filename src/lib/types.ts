export type PropertyStatus = "occupied" | "vacant" | "maintenance" | string;

export type PropertyRow = {
  id: string;
  name: string;
  type: string;
  address: string;
  status: PropertyStatus;
  monthlyRent: number;
};

export type TenantStatus = "active" | "notice" | "ended" | string;

export type TenantRow = {
  id: string;
  fullName: string;
  propertyName: string;
  phone: string;
  email: string;
  tenureStatus: TenantStatus;
  rentStatus: "paid" | "partial" | "overdue" | "unknown";
};

export type DashboardStats = {
  totalProperties: number;
  occupiedUnits: number;
  vacantUnits: number;
  occupancyRate: number;
  totalMonthlyIncome: number;
  totalMonthlyExpenses: number;
  netProfit: number;
  pendingMaintenance: number;
  overduePayments: number;
  collectionRate: number;
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
  name: string;
  phone: string;
  specialization: string;
  rate: number;
  totalJobs: number;
  totalPaid: number;
};

export type InspectionRow = {
  id: string;
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
};

export type ContractRow = {
  id: string;
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
  createdAt: string;
  action: string;
  entityType: string;
  entityId: string;
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
  };
  invoiceSettings: {
    taxRate: number;
    defaultDueDay: number;
    paymentInstructions: string;
  };
  security: {
    activePinExists: boolean;
  };
};
