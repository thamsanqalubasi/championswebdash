// ============================================================================
// PAIMBABOOK SUBSCRIPTION PACKAGES & COMMERCIALIZATION ARCHITECTURE
// ============================================================================

export type PackageId = "starter" | "standard" | "pro" | "enterprise" | "custom" | "test";

export interface PackagePlan {
  id: PackageId;
  name: string;
  tagline: string;
  priceUsd: number;
  billingPeriod: "month";
  isTestPackage?: boolean;
  isContactSales?: boolean;
  limits: {
    maxProperties: number; // -1 for unlimited
    maxRooms: number;      // -1 for unlimited
    maxTenants: number;    // -1 for unlimited
    maxStaff: number;      // -1 for unlimited
    emailSharing: boolean;
    multiRecipientEmail: boolean;
  };
  features: {
    dashboardAnalytics: boolean;
    advancedStatistics: boolean;
    frontDeskCheckInOut: boolean;
    expressCheckoutDesk: boolean;
    mealPricingTiers: boolean;
    roomShowcasePublicPortal: boolean;
    customerEnquiriesTickets: boolean;
    maintenanceWorkOrders: boolean;
    serviceProvidersDirectory: boolean;
    inspectionsAndScheduled: boolean;
    centralStoresAndStock: boolean;
    rentCollectionAndPop: boolean;
    invoicesAndReceipts: boolean;
    recurringBillsTracking: boolean;
    financialAccountsLedger: boolean;
    financialBalanceReports: boolean;
    digitalContracts: boolean;
    procurementPipeline: boolean; // RFQs, POs, Vendor approvals
    hrAndPayroll: boolean;       // Staff contracts, leave, payroll
    organogramAndCustomRoles: boolean;
    marketingGrowthHub: boolean;
    itAndSystemsHub: boolean;
    auditTrailBasic: boolean;
    auditUserJourneyMap: boolean; // Visual journey map & forensic clicks
    exportCsvReports: boolean;
    exportPdfReports: boolean;
    customDomainBranding: boolean;
    prioritySupportSla: boolean;
  };
  commercialRationale: {
    targetAudience: string;
    whyThisPrice: string;
    keyBenefits: string[];
  };
}

export const SUBSCRIPTION_PACKAGES: Record<PackageId, PackagePlan> = {
  starter: {
    id: "starter",
    name: "Starter Package",
    tagline: "For Solo Landlords & Micro Guest Houses",
    priceUsd: 5,
    billingPeriod: "month",
    limits: {
      maxProperties: 1,
      maxRooms: 5,
      maxTenants: 15,
      maxStaff: 2,
      emailSharing: false, // Print & PDF download only
      multiRecipientEmail: false,
    },
    features: {
      dashboardAnalytics: true,
      advancedStatistics: false,
      frontDeskCheckInOut: true,
      expressCheckoutDesk: false,
      mealPricingTiers: false,
      roomShowcasePublicPortal: false,
      customerEnquiriesTickets: false,
      maintenanceWorkOrders: true,
      serviceProvidersDirectory: false,
      inspectionsAndScheduled: false,
      centralStoresAndStock: false,
      rentCollectionAndPop: true,
      invoicesAndReceipts: true,
      recurringBillsTracking: true,
      financialAccountsLedger: false,
      financialBalanceReports: false,
      digitalContracts: false,
      procurementPipeline: false,
      hrAndPayroll: false,
      organogramAndCustomRoles: false,
      marketingGrowthHub: false,
      itAndSystemsHub: false,
      auditTrailBasic: true,
      auditUserJourneyMap: false,
      exportCsvReports: false,
      exportPdfReports: true,
      customDomainBranding: false,
      prioritySupportSla: false,
    },
    commercialRationale: {
      targetAudience: "Micro-landlords with 1 property, boutique guest houses (1-5 rooms), or cottage owners managing up to 15 tenants.",
      whyThisPrice: "$5/month creates virtually zero barrier to entry. It beats manual Excel and paper receipt books without high upfront software costs.",
      keyBenefits: [
        "1 Property & up to 5 Lodging Rooms",
        "Up to 15 Tenants & Lease records",
        "Rent Collection & Automated Invoices",
        "Basic Maintenance Work Orders (up to 5)",
        "On-screen Reports & PDF Downloads",
        "2 Staff accounts (Owner + Caregiver)",
      ],
    },
  },

  standard: {
    id: "standard",
    name: "Standard Package",
    tagline: "For Small Commercial Operators & Multi-Unit Landlords",
    priceUsd: 20,
    billingPeriod: "month",
    limits: {
      maxProperties: 5,
      maxRooms: 25,
      maxTenants: 60,
      maxStaff: 6,
      emailSharing: true, // Single recipient verified emails
      multiRecipientEmail: false,
    },
    features: {
      dashboardAnalytics: true,
      advancedStatistics: true,
      frontDeskCheckInOut: true,
      expressCheckoutDesk: true,
      mealPricingTiers: true,
      roomShowcasePublicPortal: true,
      customerEnquiriesTickets: true,
      maintenanceWorkOrders: true,
      serviceProvidersDirectory: true,
      inspectionsAndScheduled: true,
      centralStoresAndStock: true, // Inventory up to 50 items
      rentCollectionAndPop: true,
      invoicesAndReceipts: true,
      recurringBillsTracking: true,
      financialAccountsLedger: false,
      financialBalanceReports: false,
      digitalContracts: true,
      procurementPipeline: false,
      hrAndPayroll: false,
      organogramAndCustomRoles: false,
      marketingGrowthHub: false,
      itAndSystemsHub: false,
      auditTrailBasic: true,
      auditUserJourneyMap: false,
      exportCsvReports: true,
      exportPdfReports: true,
      customDomainBranding: false,
      prioritySupportSla: false,
    },
    commercialRationale: {
      targetAudience: "Growing property operators managing small complexes (up to 5 properties), motels, lodges with 10-25 rooms, and 60 tenants.",
      whyThisPrice: "$20/month aligns with standard SME operations. Operators gain automated billing, express checkout desk, inventory tracking, and work order dispatch.",
      keyBenefits: [
        "Up to 5 Properties & 25 Accommodation Rooms",
        "Up to 60 Managed Tenants",
        "Express Checkout Desk with Stay Countdowns",
        "4-Tier Meal Pricing (BB, HB, FB, Room Only)",
        "Service Providers & Periodic Inspections",
        "Central Stores & Inventory Management",
        "Direct PDF Email Reports with confirmation",
        "Up to 6 Staff User Accounts",
      ],
    },
  },

  pro: {
    id: "pro",
    name: "Professional Package",
    tagline: "For Real Estate Agencies & Boutique Hotel Groups",
    priceUsd: 50,
    billingPeriod: "month",
    limits: {
      maxProperties: 20,
      maxRooms: 100,
      maxTenants: 200, // Updated to 200 max tenants
      maxStaff: 20,
      emailSharing: true,
      multiRecipientEmail: true,
    },
    features: {
      dashboardAnalytics: true,
      advancedStatistics: true,
      frontDeskCheckInOut: true,
      expressCheckoutDesk: true,
      mealPricingTiers: true,
      roomShowcasePublicPortal: true,
      customerEnquiriesTickets: true,
      maintenanceWorkOrders: true,
      serviceProvidersDirectory: true,
      inspectionsAndScheduled: true,
      centralStoresAndStock: true,
      rentCollectionAndPop: true,
      invoicesAndReceipts: true,
      recurringBillsTracking: true,
      financialAccountsLedger: true, // Chart of accounts, general ledger
      financialBalanceReports: true, // Balance sheet & financial reports
      digitalContracts: true,
      procurementPipeline: true, // Requisitions, PO approvals, vendor bids
      hrAndPayroll: true,       // Staff leaves, contracts, payroll records
      organogramAndCustomRoles: true,
      marketingGrowthHub: true,
      itAndSystemsHub: false,
      auditTrailBasic: true,
      auditUserJourneyMap: false,
      exportCsvReports: true,
      exportPdfReports: true,
      customDomainBranding: false,
      prioritySupportSla: true,
    },
    commercialRationale: {
      targetAudience: "Established property management firms, 50-100 unit residential blocks, and hotel groups with dedicated departments (Front Desk, HR, Accounts, Maintenance).",
      whyThisPrice: "$50/month replaces multiple standalone tools (HR software, procurement trackers, accounting modules) into one unified system, delivering massive ROI.",
      keyBenefits: [
        "Up to 20 Properties & 100 Lodging Rooms",
        "Up to 200 Managed Tenants",
        "Full Procurement Pipeline (Requisitions, RFQs, POs)",
        "Human Resources Suite (Leave approvals & Contracts)",
        "Interactive Organogram & Granular Permissions",
        "Financial General Ledger & Chart of Accounts",
        "Multi-Recipient Email Reports with audit confirmation",
        "Up to 20 Departmental Staff Members",
      ],
    },
  },

  enterprise: {
    id: "enterprise",
    name: "Enterprise Conglomerate",
    tagline: "For Multi-Property Operators, Boutique Hotel Chains & REIT Portfolios",
    priceUsd: 200,
    billingPeriod: "month",
    limits: {
      maxProperties: 20,   // Max 20 properties
      maxRooms: 500,        // Max 500 rooms
      maxTenants: 600,      // Max 600 tenants
      maxStaff: 100,        // Max 100 staff
      emailSharing: true,
      multiRecipientEmail: true,
    },
    features: {
      dashboardAnalytics: true,
      advancedStatistics: true,
      frontDeskCheckInOut: true,
      expressCheckoutDesk: true,
      mealPricingTiers: true,
      roomShowcasePublicPortal: true,
      customerEnquiriesTickets: true,
      maintenanceWorkOrders: true,
      serviceProvidersDirectory: true,
      inspectionsAndScheduled: true,
      centralStoresAndStock: true,
      rentCollectionAndPop: true,
      invoicesAndReceipts: true,
      recurringBillsTracking: true,
      financialAccountsLedger: true,
      financialBalanceReports: true,
      digitalContracts: true,
      procurementPipeline: true,
      hrAndPayroll: true,
      organogramAndCustomRoles: true,
      marketingGrowthHub: true,
      itAndSystemsHub: true,
      auditTrailBasic: true,
      auditUserJourneyMap: true, // Complete Visual User Map & button-level forensics
      exportCsvReports: true,
      exportPdfReports: true,
      customDomainBranding: true,
      prioritySupportSla: true,
    },
    commercialRationale: {
      targetAudience: "Established hospitality groups, multi-property portfolios, and boutique hotel operators needing robust high-capacity infrastructure.",
      whyThisPrice: "$200/month delivers powerful high-capacity operations: up to 20 properties, 500 rooms, 600 tenants, and 100 staff with forensic audit trails.",
      keyBenefits: [
        "Up to 20 Properties & 500 Lodging Rooms",
        "Up to 600 Tenants & Complete Lease Management",
        "Up to 100 Staff and Departmental Accounts",
        "Visual User Journey Map & Deep Session Forensics",
        "Full Financial Ledger, Balance Sheet & Multi-Entity",
        "Mass HR Payroll Processing & Bank Export",
        "Custom Corporate Domain & Dedicated SLA Support",
      ],
    },
  },

  custom: {
    id: "custom",
    name: "Custom Enterprise",
    tagline: "For Portfolios with >20 Properties, >500 Rooms & >600 Tenants",
    priceUsd: 0,
    billingPeriod: "month",
    isContactSales: true,
    limits: {
      maxProperties: -1, // Over 20 properties
      maxRooms: -1,      // Over 500 rooms
      maxTenants: -1,    // Over 600 tenants
      maxStaff: -1,      // Over 100 staff
      emailSharing: true,
      multiRecipientEmail: true,
    },
    features: {
      dashboardAnalytics: true,
      advancedStatistics: true,
      frontDeskCheckInOut: true,
      expressCheckoutDesk: true,
      mealPricingTiers: true,
      roomShowcasePublicPortal: true,
      customerEnquiriesTickets: true,
      maintenanceWorkOrders: true,
      serviceProvidersDirectory: true,
      inspectionsAndScheduled: true,
      centralStoresAndStock: true,
      rentCollectionAndPop: true,
      invoicesAndReceipts: true,
      recurringBillsTracking: true,
      financialAccountsLedger: true,
      financialBalanceReports: true,
      digitalContracts: true,
      procurementPipeline: true,
      hrAndPayroll: true,
      organogramAndCustomRoles: true,
      marketingGrowthHub: true,
      itAndSystemsHub: true,
      auditTrailBasic: true,
      auditUserJourneyMap: true,
      exportCsvReports: true,
      exportPdfReports: true,
      customDomainBranding: true,
      prioritySupportSla: true,
    },
    commercialRationale: {
      targetAudience: "National hotel chains, government hospitality assets, large international REIT portfolios, and operators with over 20 properties, 500 rooms, 600 tenants, or 100 staff.",
      whyThisPrice: "Bespoke annual or multi-entity commercial contract tailored to your specific scale, ERP integrations, dedicated database clusters, and 24/7 dedicated engineering SLA.",
      keyBenefits: [
        "Greater than 20 Properties & Over 500 Rooms",
        "Over 600 Tenants & Infinite Tenancy Archiving",
        "Over 100 Staff Accounts with Granular Organograms",
        "Custom ERP Integrations (SAP, Oracle, QuickBooks)",
        "Dedicated Account Executive & 24/7 Priority SLA",
        "Custom White-Labeling, SSO & Custom Cloud Clusters",
      ],
    },
  },

  test: {
    id: "test",
    name: "Stripe Test Package",
    tagline: "Live Payment & Integration Sandbox ($0.50)",
    priceUsd: 0.50,
    billingPeriod: "month",
    isTestPackage: true,
    limits: {
      maxProperties: -1, // Unlimited for testing
      maxRooms: -1,
      maxTenants: -1,
      maxStaff: -1,
      emailSharing: true,
      multiRecipientEmail: true,
    },
    features: {
      dashboardAnalytics: true,
      advancedStatistics: true,
      frontDeskCheckInOut: true,
      expressCheckoutDesk: true,
      mealPricingTiers: true,
      roomShowcasePublicPortal: true,
      customerEnquiriesTickets: true,
      maintenanceWorkOrders: true,
      serviceProvidersDirectory: true,
      inspectionsAndScheduled: true,
      centralStoresAndStock: true,
      rentCollectionAndPop: true,
      invoicesAndReceipts: true,
      recurringBillsTracking: true,
      financialAccountsLedger: true,
      financialBalanceReports: true,
      digitalContracts: true,
      procurementPipeline: true,
      hrAndPayroll: true,
      organogramAndCustomRoles: true,
      marketingGrowthHub: true,
      itAndSystemsHub: true,
      auditTrailBasic: true,
      auditUserJourneyMap: true,
      exportCsvReports: true,
      exportPdfReports: true,
      customDomainBranding: true,
      prioritySupportSla: true,
    },
    commercialRationale: {
      targetAudience: "Internal QA testers, developers, and platform administrators verifying Stripe integration.",
      whyThisPrice: "$0.50 is Stripe's absolute minimum acceptable USD charge, allowing live card testing without incurring extra cost.",
      keyBenefits: [
        "Tests live or sandbox Stripe Checkout flow",
        "Simulates real card authorization ($0.50 USD Stripe minimum)",
        "Unlocks all platform features for verification",
        "1-Minute Trial with Instant Restart option",
      ],
    },
  },
};

// ============================================================
// TRIAL PERIOD CONFIGURATION
// ============================================================
// CHANGE THIS VALUE to adjust the free trial length for ALL new subscriptions.
// This mirrors the TRIAL_PERIOD_DAYS constant in web/api/create-stripe-payment.ts.
//
// Future agents and admins: you can also expose this via a backend admin UI
// so non-technical staff can adjust trial periods without a code deploy.
//
// Examples:
//   7   = 1 week trial
//   30  = 1 month trial  (recommended for soft launch)
//   90  = 3 months trial (current marketing offer: "3 months free!")
//   120 = 4 months trial
//
// When changed, also update the matching TRIAL_PERIOD_DAYS in:
//   → web/api/create-stripe-payment.ts  (line ~17)
// ============================================================
export const TRIAL_PERIOD_DAYS = 90; // 3-month free trial — first charge on day 91

export type SubscriptionStatus =
  | "trial"        // In free trial period (card saved, no charge yet)
  | "active"       // Paying, subscription current
  | "expired"      // Trial expired without subscribing
  | "grace_period" // Payment failed — 5-day grace period before downgrade
  | "downgraded"   // Safely downgraded to Starter (payment failure after grace)
  | "cancelling"   // Cancel requested, access active until period ends
  | "cancelled"    // Subscription ended, features locked
  | "frozen";      // Account frozen (60+ days no subscription — can't login)

export interface CompanySubscription {
  packageId: PackageId;
  previousPackageId?: PackageId;  // Prior package tier before safe downgrade
  status: SubscriptionStatus;
  isTrial: boolean;
  trialStartedAt: number;         // Unix timestamp ms
  trialDurationSeconds: number;   // Test mode: 60s (1 min); Production: TRIAL_PERIOD_DAYS * 86400
  trialEndsAt?: number;           // Production trial end timestamp (ms) — first charge after this
  paidAt?: number;
  lastPaymentRef?: string;
  paymentMethod?: string;
  stripeSubscriptionId?: string;  // Stripe sub ID for cancel/update operations
  stripeCustomerId?: string;      // Stripe customer ID for future charges
  packageModeEnabled: boolean;    // Master toggle to turn off package mode completely
  gracePeriodStartedAt?: number;  // Timestamp when 5-day grace period began
  gracePeriodDays?: number;       // Defaults to 5 days
  downgradedAt?: number;          // Timestamp when downgraded to Starter
  paymentFailureReason?: string;
  cancelledAt?: number;           // Timestamp when user cancelled
  frozenAt?: number;              // Timestamp when account was frozen (60+ days no sub)
}

const STORAGE_KEY_PREFIX = "paimba_company_sub_";
const DEFAULT_TRIAL_SECONDS = 60; // 1 minute as requested
export const DEFAULT_GRACE_PERIOD_DAYS = 5;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

// 60 days no subscription → account frozen (can't login)
export const UNSUBSCRIBED_FREEZE_DAYS = 60;
// 30 days after company deletion → permanent data deletion
export const COMPANY_DELETE_FREEZE_DAYS = 30;
// 90 days after freeze (non-payment) → permanent auto-deletion
export const AUTO_DELETE_AFTER_DAYS = 90;

export interface FeatureRouteConfig {
  pathPrefix: string;
  featureKey: keyof PackagePlan["features"];
  featureTitle: string;
  description: string;
  detailedCapabilities: string[]; // Deep breakdown of everything possible in this module
  minPackage: PackageId;
  minPackageName: string;
  minPackagePriceUsd: number;
}

export const ROUTE_FEATURE_MAP: FeatureRouteConfig[] = [
  {
    pathPrefix: "/statistics",
    featureKey: "advancedStatistics",
    featureTitle: "Advanced Hospitality & Financial Analytics",
    description: "Deep statistical analytics, occupancy charts, and seasonal forecasting.",
    detailedCapabilities: [
      "Interactive multi-year revenue, ADR (Average Daily Rate), and RevPAR performance forecasting",
      "Historical seasonal occupancy rate heatmaps and comparative monthly trend curves",
      "Dynamic guest length-of-stay analysis with front-desk check-in arrival distribution",
      "Exportable executive presentation summaries in PDF and formatted CSV data feeds",
    ],
    minPackage: "standard",
    minPackageName: "Standard Package",
    minPackagePriceUsd: 20,
  },
  {
    pathPrefix: "/maintenance/providers",
    featureKey: "serviceProvidersDirectory",
    featureTitle: "Service Providers Directory",
    description: "External contractor registry, trade ratings, and dispatch tracking.",
    detailedCapabilities: [
      "Comprehensive trade contractor registry with verified licensing, insurance, and contact details",
      "Specialty categorization: Plumbing, Electrical, HVAC, Masonry, Carpentry, and Security",
      "One-click work order dispatch with automated supplier confirmation and ETA scheduling",
      "Historical contractor rating scorecards, completion timelines, and invoice reconciliation",
    ],
    minPackage: "standard",
    minPackageName: "Standard Package",
    minPackagePriceUsd: 20,
  },
  {
    pathPrefix: "/maintenance/inspections",
    featureKey: "inspectionsAndScheduled",
    featureTitle: "Property Inspections & Move-in/Move-out Audits",
    description: "Automated inspection checklists, photo deficiency logging, and scheduled visits.",
    detailedCapabilities: [
      "Standardized digital inspection checklists customized for lodging rooms and long-term units",
      "Immediate photographic deficiency logging with room condition ratings and damage tagging",
      "Automatic work order generation directly from failed inspection checklist criteria",
      "Digital tenant endorsement signatures captured directly on move-in and exit audit folios",
    ],
    minPackage: "standard",
    minPackageName: "Standard Package",
    minPackagePriceUsd: 20,
  },
  {
    pathPrefix: "/maintenance/scheduled-tasks",
    featureKey: "inspectionsAndScheduled",
    featureTitle: "Preventative Maintenance Schedules",
    description: "Recurring HVAC, plumbing, generator, and asset maintenance routines.",
    detailedCapabilities: [
      "Automated preventative maintenance routines with custom recurrence: weekly, monthly, quarterly",
      "Asset compliance tracking for backup generators, fire extinguishers, water pumps, and HVAC",
      "Technician task dispatching with real-time countdown alerts and status change verification",
      "Historical equipment service records preventing expensive breakdowns and asset depreciation",
    ],
    minPackage: "standard",
    minPackageName: "Standard Package",
    minPackagePriceUsd: 20,
  },
  {
    pathPrefix: "/maintenance/inventory",
    featureKey: "centralStoresAndStock",
    featureTitle: "Maintenance Parts & Central Inventory",
    description: "Track maintenance supplies, tool inventory, and stock depreciation.",
    detailedCapabilities: [
      "Granular maintenance supplies inventory tracking spare parts, plumbing fittings, and paint",
      "Automated low-stock threshold alerts with one-click reorder requisition generation",
      "Stock transfer logs between central warehouses and individual accommodation properties",
      "Depreciation tracking and material cost allocation per work order and maintenance ticket",
    ],
    minPackage: "standard",
    minPackageName: "Standard Package",
    minPackagePriceUsd: 20,
  },
  {
    pathPrefix: "/stores",
    featureKey: "centralStoresAndStock",
    featureTitle: "Central Stores & Stock Depot",
    description: "Warehouse item management, low-stock alerts, and transfer logs.",
    detailedCapabilities: [
      "Central warehouse SKU inventory management with unit purchase pricing and suppliers",
      "Inter-property stock dispatching with verified digital sign-off and custodial logging",
      "Automated batch reorder recommendations based on historical consumption velocity",
      "Real-time total inventory valuation reports for accounting and balance sheet audits",
    ],
    minPackage: "standard",
    minPackageName: "Standard Package",
    minPackagePriceUsd: 20,
  },
  {
    pathPrefix: "/enquiries",
    featureKey: "customerEnquiriesTickets",
    featureTitle: "Guest Enquiries & CRM Tickets",
    description: "Inbound prospective booking leads, ticket triage, and guest messages.",
    detailedCapabilities: [
      "Multi-channel inbound inquiry intake pipeline for website leads, walk-ins, and phone calls",
      "Priority ticket triage with internal team assignments and guest status progression boards",
      "Integrated quotation generation and direct email responses stamped with company branding",
      "Instant conversion of prospective leads into live confirmed room and lodging reservations",
    ],
    minPackage: "standard",
    minPackageName: "Standard Package",
    minPackagePriceUsd: 20,
  },
  {
    pathPrefix: "/room-showcases",
    featureKey: "roomShowcasePublicPortal",
    featureTitle: "Public Room Showcases & Direct Booking Catalog",
    description: "Showcase guest rooms with live availability, gallery photos, and meal pricing.",
    detailedCapabilities: [
      "Public-facing direct booking room showcase with high-res galleries and amenities lists",
      "Real-time calendar availability preventing double bookings and manual scheduling errors",
      "Tiered meal plan pricing options (Bed & Breakfast, Half Board, Full Board, Room Only)",
      "Direct commission-free guest reservation intake with automated confirmation emails",
    ],
    minPackage: "standard",
    minPackageName: "Standard Package",
    minPackagePriceUsd: 20,
  },
  {
    pathPrefix: "/portal",
    featureKey: "roomShowcasePublicPortal",
    featureTitle: "Resident & Guest Self-Service Portal",
    description: "Tenant online payment upload, stay overview, and maintenance requests.",
    detailedCapabilities: [
      "Dedicated resident and guest self-service portal accessible from any phone or computer",
      "Direct Proof of Payment (POP) upload with instant accounting verification notifications",
      "Tenant maintenance issue reporting with live ticket progress and technician updates",
      "Instant download of historical rent receipts, invoices, and active lease agreement copies",
    ],
    minPackage: "standard",
    minPackageName: "Standard Package",
    minPackagePriceUsd: 20,
  },
  {
    pathPrefix: "/agent-mode",
    featureKey: "roomShowcasePublicPortal",
    featureTitle: "Direct Agent Booking Desk",
    description: "Specialized portal for booking agents, corporate rates, and travel desks.",
    detailedCapabilities: [
      "Specialized B2B portal for accredited travel agents, corporate desks, and tour operators",
      "Custom negotiated corporate rate tiers with automated agent commission calculation",
      "Bulk room block reservations with delayed guest name manifest submission",
      "Consolidated monthly invoicing and agent statement generation with payment tracking",
    ],
    minPackage: "standard",
    minPackageName: "Standard Package",
    minPackagePriceUsd: 20,
  },
  {
    pathPrefix: "/contracts",
    featureKey: "digitalContracts",
    featureTitle: "Digital Lease Contracts & Signatures",
    description: "Legally binding electronic contracts, digital signatures, and clause templates.",
    detailedCapabilities: [
      "Legally binding electronic lease contract builder with custom legal clause templates",
      "Dual digital signature capture for company administrators and incoming tenants",
      "Automated lease expiration countdowns with 30, 60, and 90-day renewal notice alerts",
      "Official PDF contract generation with verified audit timestamps and security hashing",
    ],
    minPackage: "standard",
    minPackageName: "Standard Package",
    minPackagePriceUsd: 20,
  },
  {
    pathPrefix: "/procurement",
    featureKey: "procurementPipeline",
    featureTitle: "Procurement Pipeline (RFQs, POs, Vendor Bidding)",
    description: "End-to-end departmental requisitions, competitive vendor bidding, and PO sign-off.",
    detailedCapabilities: [
      "Multi-stage departmental procurement workflow: Requisition ➔ Review ➔ RFQ ➔ PO ➔ GRN",
      "Competitive vendor quotation matrix comparing supplier pricing, delivery, and warranty",
      "Official Purchase Order (PO) creation with digital signatures and budgetary sign-offs",
      "Goods Received Note (GRN) three-way matching against supplier delivery and invoices",
    ],
    minPackage: "pro",
    minPackageName: "Professional Package",
    minPackagePriceUsd: 50,
  },
  {
    pathPrefix: "/hr",
    featureKey: "hrAndPayroll",
    featureTitle: "Human Resources, Leave Management & Payroll",
    description: "Staff employment records, leave approvals, shifts, and monthly payroll.",
    detailedCapabilities: [
      "Complete employee personnel profiles, employment contracts, and document repositories",
      "Interactive annual/sick/maternity leave request workflow with multi-level manager approvals",
      "Automated monthly payroll generation with overtime, allowances, and statutory deductions",
      "Professional individual salary payslip PDF generation and bank payroll export batches",
    ],
    minPackage: "pro",
    minPackageName: "Professional Package",
    minPackagePriceUsd: 50,
  },
  {
    pathPrefix: "/organogram",
    featureKey: "organogramAndCustomRoles",
    featureTitle: "Dynamic Organogram & Custom Granular Roles",
    description: "Interactive visual company organogram with custom permission hierarchies.",
    detailedCapabilities: [
      "Interactive visual company organogram diagram showing departmental chains of command",
      "Granular role-based permission toggles across 20+ operational, financial, and audit rights",
      "Department head assignments with delegated managerial approval authorizations",
      "Real-time access audit preventing unauthorized modifications to financial accounts",
    ],
    minPackage: "pro",
    minPackageName: "Professional Package",
    minPackagePriceUsd: 50,
  },
  {
    pathPrefix: "/finance/accounts",
    featureKey: "financialAccountsLedger",
    featureTitle: "General Ledger & Chart of Accounts",
    description: "Double-entry bookkeeping, chart of accounts, bank journals, and debit/credit ledger.",
    detailedCapabilities: [
      "Comprehensive double-entry general ledger complying with standard accounting practices",
      "Multi-level chart of accounts: Assets, Liabilities, Equity, Revenue, and Operating Expenses",
      "Bank reconciliation journal entries with audit receipts and petty cash tracking",
      "Real-time accounts receivable (AR) and accounts payable (AP) aging summaries",
    ],
    minPackage: "pro",
    minPackageName: "Professional Package",
    minPackagePriceUsd: 50,
  },
  {
    pathPrefix: "/finance/reports",
    featureKey: "financialBalanceReports",
    featureTitle: "Financial Balance Sheet & Multi-Period Reports",
    description: "Balance sheet, income statement, cash flow statement, and tax summaries.",
    detailedCapabilities: [
      "Instant Balance Sheet, Income Statement (P&L), and Cash Flow Statement generation",
      "Comparative multi-period financial analyses across quarters, fiscal years, and months",
      "Departmental cost-center profitability reports identifying revenue leaders and cost leaks",
      "Audit-ready financial package exportable in high-resolution PDF and Excel spreadsheets",
    ],
    minPackage: "pro",
    minPackageName: "Professional Package",
    minPackagePriceUsd: 50,
  },
  {
    pathPrefix: "/marketing",
    featureKey: "marketingGrowthHub",
    featureTitle: "Marketing Hub & Mass Broadcasts",
    description: "Email campaigns, promotions, discount blast engine, and lead conversion tracker.",
    detailedCapabilities: [
      "Automated guest re-engagement campaigns targeting past guests with personalized promotions",
      "Promotional discount code generator with usage limits, date ranges, and percentage caps",
      "Automated loyalty rewards, birthday vouchers, and corporate holiday greetings",
      "Campaign ROI tracking linking marketing broadcasts directly to confirmed paid stays",
    ],
    minPackage: "pro",
    minPackageName: "Professional Package",
    minPackagePriceUsd: 50,
  },
  {
    pathPrefix: "/it",
    featureKey: "itAndSystemsHub",
    featureTitle: "IT & Systems Architecture Hub",
    description: "Enterprise system diagnostics, database schema tools, and server metrics.",
    detailedCapabilities: [
      "Enterprise infrastructure health monitoring, database latency, and storage bucket metrics",
      "API webhook logs, webhook retry triggers, and third-party integration diagnostics",
      "User session IP geolocation, device forensics, and active socket connection monitoring",
      "Security key rotation, environment variable audit, and backup restoration verification",
    ],
    minPackage: "enterprise",
    minPackageName: "Enterprise Conglomerate",
    minPackagePriceUsd: 200,
  },
  {
    pathPrefix: "/audit-trail",
    featureKey: "auditUserJourneyMap",
    featureTitle: "Forensic User Journey Map & Audit Dept",
    description: "High-resolution clickstream forensic replays, session analytics, and user journey graphs.",
    detailedCapabilities: [
      "Visual user journey mapping with button-level clickstream tracking and origin-to-destination pathways",
      "High-resolution session forensics showing operator transitions, timestamps, and active sessions",
      "Immutable system activity trail recording all creations, edits, deletions, and payment receipts",
      "Comprehensive compliance search filterable by staff actor, entity type, and chronological windows",
    ],
    minPackage: "enterprise",
    minPackageName: "Enterprise Conglomerate",
    minPackagePriceUsd: 200,
  },
];

const TIER_LEVELS: Record<PackageId, number> = {
  starter: 1,
  standard: 2,
  pro: 3,
  enterprise: 4,
  custom: 5,
  test: 99,
};

/**
 * Check if a given route pathname is locked under the company's active plan.
 */
export function isRouteLocked(
  companyId: string,
  pathname: string
): { locked: boolean; config?: FeatureRouteConfig; currentPlanName: string } {
  const sub = getCompanySubscription(companyId);
  if (!sub.packageModeEnabled) {
    return { locked: false, currentPlanName: "Unrestricted Mode" };
  }

  // Find if route matches any protected feature prefix
  const matched = ROUTE_FEATURE_MAP.find((item) => {
    return pathname === item.pathPrefix || pathname.startsWith(`${item.pathPrefix}/`);
  });

  if (!matched) {
    return { locked: false, currentPlanName: SUBSCRIPTION_PACKAGES[sub.packageId]?.name || "Starter" };
  }

  const currentLevel = TIER_LEVELS[sub.packageId] || 1;
  const requiredLevel = TIER_LEVELS[matched.minPackage] || 1;

  if (currentLevel < requiredLevel) {
    return {
      locked: true,
      config: matched,
      currentPlanName: SUBSCRIPTION_PACKAGES[sub.packageId]?.name || "Starter",
    };
  }

  return {
    locked: false,
    config: matched,
    currentPlanName: SUBSCRIPTION_PACKAGES[sub.packageId]?.name || "Starter",
  };
}

/**
 * Retrieve the current subscription configuration for a given company.
 */
export function getCompanySubscription(companyId: string): CompanySubscription {
  try {
    const key = `${STORAGE_KEY_PREFIX}${companyId || "default"}`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as CompanySubscription;
      // Ensure valid packageId
      if (SUBSCRIPTION_PACKAGES[parsed.packageId]) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("Error reading company subscription:", err);
  }

  // Default: Starter package on 1-minute trial with package mode ON
  const defaultSub: CompanySubscription = {
    packageId: "starter",
    status: "trial",
    isTrial: true,
    trialStartedAt: Date.now(),
    trialDurationSeconds: DEFAULT_TRIAL_SECONDS,
    packageModeEnabled: true,
    gracePeriodDays: DEFAULT_GRACE_PERIOD_DAYS,
  };
  saveCompanySubscription(companyId, defaultSub);
  return defaultSub;
}

/**
 * Persist company subscription to storage & trigger change event.
 */
export function saveCompanySubscription(companyId: string, sub: CompanySubscription): void {
  try {
    const key = `${STORAGE_KEY_PREFIX}${companyId || "default"}`;
    localStorage.setItem(key, JSON.stringify(sub));
    // Dispatch window event so all mounted components react in real-time
    window.dispatchEvent(new CustomEvent("paimba_package_changed", { detail: sub }));
  } catch (err) {
    console.error("Error saving company subscription:", err);
  }
}

/**
 * Switch package for the company.
 * Non-test packages ($5, $20, $50, $200) do NOT require bank details in test mode.
 */
export function switchCompanyPackage(
  companyId: string,
  newPackageId: PackageId,
  startAsTrial = true
): CompanySubscription {
  const current = getCompanySubscription(companyId);
  const updated: CompanySubscription = {
    ...current,
    packageId: newPackageId,
    isTrial: startAsTrial,
    status: startAsTrial ? "trial" : "active",
    trialStartedAt: Date.now(),
    trialDurationSeconds: DEFAULT_TRIAL_SECONDS,
    gracePeriodStartedAt: undefined,
    paymentFailureReason: undefined,
  };
  saveCompanySubscription(companyId, updated);
  return updated;
}

/**
 * Format remaining seconds into a digital countdown: "01:00", "00:59", "03:15", etc.
 */
export function formatTrialCountdown(seconds: number): string {
  if (seconds <= 0) return "00:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

/**
 * Restart the trial for testing with customizable duration (e.g. 1 min, 2 min, 3 min, 5 min).
 */
export function restartCompanyTrial(companyId: string, durationSeconds?: number): CompanySubscription {
  const current = getCompanySubscription(companyId);
  const duration = durationSeconds && durationSeconds > 0 ? durationSeconds : (current.trialDurationSeconds || DEFAULT_TRIAL_SECONDS);
  const updated: CompanySubscription = {
    ...current,
    isTrial: true,
    status: "trial",
    trialStartedAt: Date.now(),
    trialDurationSeconds: duration,
    gracePeriodStartedAt: undefined,
    paymentFailureReason: undefined,
  };
  saveCompanySubscription(companyId, updated);
  return updated;
}

/**
 * Set custom trial minutes (e.g. 2, 3, 5 minutes) and optionally restart immediately.
 */
export function setCompanyTrialMinutes(companyId: string, minutes: number, restartNow = true): CompanySubscription {
  const durationSeconds = Math.max(10, Math.round(minutes * 60));
  if (restartNow) {
    return restartCompanyTrial(companyId, durationSeconds);
  }
  const current = getCompanySubscription(companyId);
  const updated: CompanySubscription = {
    ...current,
    trialDurationSeconds: durationSeconds,
  };
  saveCompanySubscription(companyId, updated);
  return updated;
}

/**
 * Mark subscription as paid (e.g. after $0.50 Stripe test checkout or card billing).
 * RESTORATION GUARANTEE: If account was previously in grace period or safely downgraded,
 * restores the previous higher package tier seamlessly! Zero data lost.
 */
export function markSubscriptionPaid(
  companyId: string,
  paymentRef: string,
  method = "stripe_card"
): CompanySubscription {
  const current = getCompanySubscription(companyId);
  const targetPackageId = current.status === "downgraded" && current.previousPackageId
    ? current.previousPackageId
    : current.packageId;

  const updated: CompanySubscription = {
    ...current,
    packageId: targetPackageId,
    isTrial: false,
    status: "active",
    paidAt: Date.now(),
    lastPaymentRef: paymentRef,
    paymentMethod: method,
    gracePeriodStartedAt: undefined,
    downgradedAt: undefined,
    paymentFailureReason: undefined,
  };
  saveCompanySubscription(companyId, updated);
  return updated;
}

/**
 * Toggle master Package Mode (turns off package restrictions completely).
 */
export function setPackageModeEnabled(companyId: string, enabled: boolean): CompanySubscription {
  const current = getCompanySubscription(companyId);
  const updated: CompanySubscription = {
    ...current,
    packageModeEnabled: enabled,
  };
  saveCompanySubscription(companyId, updated);
  return updated;
}

/**
 * Calculate remaining trial seconds (0 if expired or not in trial).
 */
export function getRemainingTrialSeconds(sub: CompanySubscription): number {
  if (!sub.isTrial || sub.status === "active") return 0;
  const elapsedSeconds = Math.floor((Date.now() - sub.trialStartedAt) / 1000);
  const remaining = sub.trialDurationSeconds - elapsedSeconds;
  return Math.max(0, remaining);
}

/**
 * Check if the trial has expired.
 */
export function isTrialExpired(sub: CompanySubscription): boolean {
  if (!sub.packageModeEnabled) return false; // If package mode is OFF, never block
  if (!sub.isTrial) return false;
  return getRemainingTrialSeconds(sub) <= 0;
}

// ============================================================================
// 5-DAY GRACE PERIOD & NON-DESTRUCTIVE SAFE DOWNGRADE ARCHITECTURE
// ============================================================================

export interface GracePeriodInfo {
  inGracePeriod: boolean;
  isDowngraded: boolean;
  daysRemaining: number;
  hoursRemaining: number;
  totalMsRemaining: number;
  formattedCountdown: string;
  expiredAtDate: string;
}

/**
 * Calculate live remaining grace period duration.
 */
export function getGracePeriodInfo(sub: CompanySubscription): GracePeriodInfo {
  if (sub.status === "downgraded") {
    return {
      inGracePeriod: false,
      isDowngraded: true,
      daysRemaining: 0,
      hoursRemaining: 0,
      totalMsRemaining: 0,
      formattedCountdown: "Account Safely Downgraded",
      expiredAtDate: sub.downgradedAt ? new Date(sub.downgradedAt).toLocaleDateString() : "",
    };
  }

  if (sub.status !== "grace_period" || !sub.gracePeriodStartedAt) {
    return {
      inGracePeriod: false,
      isDowngraded: false,
      daysRemaining: 0,
      hoursRemaining: 0,
      totalMsRemaining: 0,
      formattedCountdown: "",
      expiredAtDate: "",
    };
  }

  const totalGraceMs = (sub.gracePeriodDays || DEFAULT_GRACE_PERIOD_DAYS) * MS_PER_DAY;
  const elapsedMs = Date.now() - sub.gracePeriodStartedAt;
  const remainingMs = Math.max(0, totalGraceMs - elapsedMs);

  const days = Math.floor(remainingMs / MS_PER_DAY);
  const hours = Math.floor((remainingMs % MS_PER_DAY) / (60 * 60 * 1000));
  const mins = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));

  let formatted = `${days}d ${hours}h left`;
  if (days === 0) {
    formatted = `${hours}h ${mins}m left`;
  }

  return {
    inGracePeriod: true,
    isDowngraded: false,
    daysRemaining: days,
    hoursRemaining: hours,
    totalMsRemaining: remainingMs,
    formattedCountdown: formatted,
    expiredAtDate: new Date(sub.gracePeriodStartedAt + totalGraceMs).toLocaleDateString(),
  };
}

/**
 * Trigger payment failure or subscription expiry: initiates the 5-day timed grace period.
 */
export function startGracePeriod(
  companyId: string,
  failureReason = "Payment authorization failed or subscription cycle ended."
): CompanySubscription {
  const current = getCompanySubscription(companyId);
  if (current.status === "grace_period") return current;

  const updated: CompanySubscription = {
    ...current,
    status: "grace_period",
    isTrial: false,
    gracePeriodStartedAt: Date.now(),
    gracePeriodDays: DEFAULT_GRACE_PERIOD_DAYS,
    paymentFailureReason: failureReason,
  };
  saveCompanySubscription(companyId, updated);
  return updated;
}

/**
 * Safely downgrade company subscription to Starter when the 5-day grace period expires.
 *
 * CRITICAL DATA PRESERVATION NOTICE:
 * NO DATA IS EVER DELETED!
 * All properties, accommodation rooms, tenants, contracts, staff accounts, invoices,
 * and historical logs remain 100% intact in the database.
 * Higher-tier features are locked/blurred and capacity limits prevent NEW creations
 * until subscription is renewed via Stripe.
 */
export function downgradeCompanySubscription(companyId: string): CompanySubscription {
  const current = getCompanySubscription(companyId);
  const updated: CompanySubscription = {
    ...current,
    previousPackageId: current.previousPackageId || current.packageId,
    packageId: "starter",
    status: "downgraded",
    isTrial: false,
    downgradedAt: Date.now(),
  };
  saveCompanySubscription(companyId, updated);
  return updated;
}

/**
 * Check grace period status and auto-downgrade safely if the 5 days have elapsed.
 */
export function checkGracePeriodAndAutoDowngrade(companyId: string): CompanySubscription {
  const current = getCompanySubscription(companyId);
  if (!current.packageModeEnabled) return current;

  if (current.status === "grace_period") {
    const info = getGracePeriodInfo(current);
    if (info.totalMsRemaining <= 0) {
      return downgradeCompanySubscription(companyId);
    }
  }

  return current;
}

/**
 * Check if a company has reached a specific limit under their active plan.
 */
export function checkPackageCapacityLimit(
  companyId: string,
  metric: "properties" | "rooms" | "tenants" | "staff",
  currentCount: number
): { allowed: boolean; max: number; current: number; planName: string } {
  const sub = getCompanySubscription(companyId);
  if (!sub.packageModeEnabled) {
    return { allowed: true, max: -1, current: currentCount, planName: "Full Mode" };
  }

  const plan = SUBSCRIPTION_PACKAGES[sub.packageId] || SUBSCRIPTION_PACKAGES.starter;
  let max = -1;

  switch (metric) {
    case "properties":
      max = plan.limits.maxProperties;
      break;
    case "rooms":
      max = plan.limits.maxRooms;
      break;
    case "tenants":
      max = plan.limits.maxTenants;
      break;
    case "staff":
      max = plan.limits.maxStaff;
      break;
  }

  if (max === -1) {
    return { allowed: true, max: -1, current: currentCount, planName: plan.name };
  }

  return {
    allowed: currentCount < max,
    max,
    current: currentCount,
    planName: plan.name,
  };
}

/**
 * Check if a module or feature is enabled under the current package plan.
 */
export function isPackageFeatureEnabled(
  companyId: string,
  featureKey: keyof PackagePlan["features"]
): boolean {
  const sub = getCompanySubscription(companyId);
  if (!sub.packageModeEnabled) return true; // Unrestricted if mode is OFF
  const plan = SUBSCRIPTION_PACKAGES[sub.packageId] || SUBSCRIPTION_PACKAGES.starter;
  return !!plan.features[featureKey];
}

// ============================================================
// SUBSCRIPTION CANCELLATION & ACCOUNT FREEZE HELPERS
// ============================================================

/**
 * Mark a subscription as cancelling (user clicked cancel).
 * Stripe will still charge until end of billing period, then webhook fires.
 * The cancel API endpoint (web/api/cancel-subscription.ts) handles the Stripe call.
 */
export function markSubscriptionCancelling(
  companyId: string,
  stripeSubscriptionId?: string
): CompanySubscription {
  const current = getCompanySubscription(companyId);
  const updated: CompanySubscription = {
    ...current,
    status: "cancelling",
    cancelledAt: Date.now(),
    stripeSubscriptionId: stripeSubscriptionId || current.stripeSubscriptionId,
  };
  saveCompanySubscription(companyId, updated);
  return updated;
}

/**
 * Mark a subscription as fully cancelled (fired by webhook after period ends).
 * Features are now locked. User sees the unsubscribed gateway modal.
 * After 60 days, account will be frozen.
 */
export function markSubscriptionCancelled(companyId: string): CompanySubscription {
  const current = getCompanySubscription(companyId);
  const updated: CompanySubscription = {
    ...current,
    status: "cancelled",
    cancelledAt: current.cancelledAt || Date.now(),
  };
  saveCompanySubscription(companyId, updated);
  return updated;
}

/**
 * Check if a cancelled account has exceeded UNSUBSCRIBED_FREEZE_DAYS
 * and should be frozen (can't login, only reactivation prompt visible).
 * After UNSUBSCRIBED_FREEZE_DAYS days without resubscribing, account becomes "frozen".
 * After AUTO_DELETE_AFTER_DAYS total, flagged for permanent deletion.
 */
export function checkAndApplyAccountFreeze(companyId: string): CompanySubscription {
  const current = getCompanySubscription(companyId);
  if (current.status !== "cancelled" || !current.cancelledAt) return current;

  const daysSinceCancelled = (Date.now() - current.cancelledAt) / MS_PER_DAY;

  if (daysSinceCancelled >= UNSUBSCRIBED_FREEZE_DAYS) {
    const updated: CompanySubscription = {
      ...current,
      status: "frozen",
      frozenAt: Date.now(),
    };
    saveCompanySubscription(companyId, updated);
    // TODO (future admin dashboard agent):
    //   - Flag this company in the admin dashboard as "Pending Deletion"
    //   - Send email to company admin: "Your account has been frozen. Re-subscribe within X days."
    //   - After AUTO_DELETE_AFTER_DAYS, auto-delete company data permanently
    return updated;
  }

  return current;
}

/**
 * Get days remaining before account freeze (after cancellation).
 * Shows in the unsubscribed gateway modal as a countdown warning.
 */
export function getDaysUntilFreeze(sub: CompanySubscription): number {
  if (sub.status !== "cancelled" || !sub.cancelledAt) return UNSUBSCRIBED_FREEZE_DAYS;
  const daysSinceCancelled = (Date.now() - sub.cancelledAt) / MS_PER_DAY;
  return Math.max(0, UNSUBSCRIBED_FREEZE_DAYS - daysSinceCancelled);
}

/**
 * Reactivate a cancelled or frozen account (user re-subscribed).
 * This is called when payment succeeds after cancellation.
 * Does NOT restore the old Stripe subscription — requires new subscription setup.
 */
export function reactivateSubscription(
  companyId: string,
  packageId: PackageId,
  paymentRef: string
): CompanySubscription {
  const current = getCompanySubscription(companyId);
  const updated: CompanySubscription = {
    ...current,
    packageId,
    status: "active",
    isTrial: false,
    paidAt: Date.now(),
    lastPaymentRef: paymentRef,
    cancelledAt: undefined,
    frozenAt: undefined,
    gracePeriodStartedAt: undefined,
    paymentFailureReason: undefined,
  };
  saveCompanySubscription(companyId, updated);
  return updated;
}

/**
 * Check if a subscription is in "unsubscribed" state (cancelled or frozen).
 * Used to show the unsubscribed gateway modal that blocks all features.
 */
export function isAccountUnsubscribed(sub: CompanySubscription): boolean {
  if (!sub.packageModeEnabled) return false;
  return sub.status === "cancelled" || sub.status === "frozen";
}

/**
 * Get formatted trial end date string (for display in UI).
 * e.g. "Your free trial ends on December 31, 2026 — first charge on January 1, 2027"
 */
export function getTrialEndDateDisplay(sub: CompanySubscription): string {
  const trialEndsMs = sub.trialEndsAt || (sub.trialStartedAt + TRIAL_PERIOD_DAYS * MS_PER_DAY);
  const trialEndDate = new Date(trialEndsMs);
  return trialEndDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
