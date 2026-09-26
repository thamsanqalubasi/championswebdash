// ============================================================================
// PAIMBABOOK SUBSCRIPTION PACKAGES & COMMERCIALIZATION ARCHITECTURE
// ============================================================================

export type PackageId = "starter" | "standard" | "pro" | "enterprise" | "test";

export interface PackagePlan {
  id: PackageId;
  name: string;
  tagline: string;
  priceUsd: number;
  billingPeriod: "month";
  isTestPackage?: boolean;
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
    frontDeskCheckInOut: boolean;
    expressCheckoutDesk: boolean;
    mealPricingTiers: boolean;
    maintenanceWorkOrders: boolean;
    serviceProvidersDirectory: boolean;
    inspectionsAndScheduled: boolean;
    rentCollectionAndPop: boolean;
    invoicesAndReceipts: boolean;
    recurringBillsTracking: boolean;
    centralStoresAndStock: boolean;
    procurementPipeline: boolean; // RFQs, POs, Vendor approvals
    hrAndPayroll: boolean;       // Staff contracts, leave, payroll
    organogramAndCustomRoles: boolean;
    financialAccountsLedger: boolean;
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
      frontDeskCheckInOut: true,
      expressCheckoutDesk: false,
      mealPricingTiers: false,
      maintenanceWorkOrders: true,
      serviceProvidersDirectory: false,
      inspectionsAndScheduled: false,
      rentCollectionAndPop: true,
      invoicesAndReceipts: true,
      recurringBillsTracking: true,
      centralStoresAndStock: false,
      procurementPipeline: false,
      hrAndPayroll: false,
      organogramAndCustomRoles: false,
      financialAccountsLedger: false,
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
      frontDeskCheckInOut: true,
      expressCheckoutDesk: true,
      mealPricingTiers: true,
      maintenanceWorkOrders: true,
      serviceProvidersDirectory: true,
      inspectionsAndScheduled: true,
      rentCollectionAndPop: true,
      invoicesAndReceipts: true,
      recurringBillsTracking: true,
      centralStoresAndStock: true, // Basic inventory up to 50 items
      procurementPipeline: false,
      hrAndPayroll: false,
      organogramAndCustomRoles: false,
      financialAccountsLedger: false,
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
      maxTenants: 300,
      maxStaff: 20,
      emailSharing: true,
      multiRecipientEmail: true,
    },
    features: {
      dashboardAnalytics: true,
      frontDeskCheckInOut: true,
      expressCheckoutDesk: true,
      mealPricingTiers: true,
      maintenanceWorkOrders: true,
      serviceProvidersDirectory: true,
      inspectionsAndScheduled: true,
      rentCollectionAndPop: true,
      invoicesAndReceipts: true,
      recurringBillsTracking: true,
      centralStoresAndStock: true,
      procurementPipeline: true, // Requisitions, PO approvals, vendor bids
      hrAndPayroll: true,       // Staff leaves, contracts, payroll records
      organogramAndCustomRoles: true,
      financialAccountsLedger: true, // Chart of accounts, general ledger
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
        "Up to 300 Managed Tenants",
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
    tagline: "For Hotel Chains, REITs & Large Hospitality Portfolios",
    priceUsd: 200,
    billingPeriod: "month",
    limits: {
      maxProperties: -1, // Unlimited
      maxRooms: -1,      // Unlimited
      maxTenants: -1,    // Unlimited
      maxStaff: -1,      // Unlimited
      emailSharing: true,
      multiRecipientEmail: true,
    },
    features: {
      dashboardAnalytics: true,
      frontDeskCheckInOut: true,
      expressCheckoutDesk: true,
      mealPricingTiers: true,
      maintenanceWorkOrders: true,
      serviceProvidersDirectory: true,
      inspectionsAndScheduled: true,
      rentCollectionAndPop: true,
      invoicesAndReceipts: true,
      recurringBillsTracking: true,
      centralStoresAndStock: true,
      procurementPipeline: true,
      hrAndPayroll: true,
      organogramAndCustomRoles: true,
      financialAccountsLedger: true,
      auditTrailBasic: true,
      auditUserJourneyMap: true, // Complete Visual User Map & button-level forensics
      exportCsvReports: true,
      exportPdfReports: true,
      customDomainBranding: true,
      prioritySupportSla: true,
    },
    commercialRationale: {
      targetAudience: "Large hospitality groups, national property funds, REITs, and enterprise hotel brands requiring unlimited capacity and compliance auditing.",
      whyThisPrice: "$200/month delivers enterprise-scale power: unlimited properties and rooms, full forensic visual audit trails, custom corporate domains, and 24/7 dedicated support.",
      keyBenefits: [
        "UNLIMITED Properties, Rooms, and Tenants",
        "UNLIMITED Staff and Departmental Accounts",
        "Visual User Journey Map & Deep Session Forensics",
        "Full Financial Ledger, Balance Sheet & Multi-Entity",
        "Mass HR Payroll Processing & Bank Export",
        "Custom Branding, White-Label & Dedicated SLA",
        "Complete Unlimited Multi-Range Report Generation",
      ],
    },
  },

  test: {
    id: "test",
    name: "Stripe Test Package",
    tagline: "Live Payment & Integration Sandbox ($2)",
    priceUsd: 2,
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
      frontDeskCheckInOut: true,
      expressCheckoutDesk: true,
      mealPricingTiers: true,
      maintenanceWorkOrders: true,
      serviceProvidersDirectory: true,
      inspectionsAndScheduled: true,
      rentCollectionAndPop: true,
      invoicesAndReceipts: true,
      recurringBillsTracking: true,
      centralStoresAndStock: true,
      procurementPipeline: true,
      hrAndPayroll: true,
      organogramAndCustomRoles: true,
      financialAccountsLedger: true,
      auditTrailBasic: true,
      auditUserJourneyMap: true,
      exportCsvReports: true,
      exportPdfReports: true,
      customDomainBranding: true,
      prioritySupportSla: true,
    },
    commercialRationale: {
      targetAudience: "Internal QA testers, developers, and platform administrators verifying Stripe integration.",
      whyThisPrice: "$2 is a micro-test transaction allowing verified card testing via Stripe checkout without incurring large costs.",
      keyBenefits: [
        "Tests live or sandbox Stripe Checkout flow",
        "Simulates real card authorization ($2.00 USD)",
        "Unlocks all platform features for verification",
        "1-Minute Trial with Instant Restart option",
      ],
    },
  },
};

export interface CompanySubscription {
  packageId: PackageId;
  status: "trial" | "active" | "expired";
  isTrial: boolean;
  trialStartedAt: number; // Unix timestamp ms
  trialDurationSeconds: number; // 60 seconds (1 minute) in test mode
  paidAt?: number;
  lastPaymentRef?: string;
  paymentMethod?: string;
  packageModeEnabled: boolean; // Master toggle to turn off package mode completely
}

const STORAGE_KEY_PREFIX = "paimba_company_sub_";
const DEFAULT_TRIAL_SECONDS = 60; // 1 minute as requested

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
  };
  saveCompanySubscription(companyId, updated);
  return updated;
}

/**
 * Restart the 1-minute trial for testing.
 */
export function restartCompanyTrial(companyId: string): CompanySubscription {
  const current = getCompanySubscription(companyId);
  const updated: CompanySubscription = {
    ...current,
    isTrial: true,
    status: "trial",
    trialStartedAt: Date.now(),
    trialDurationSeconds: DEFAULT_TRIAL_SECONDS,
  };
  saveCompanySubscription(companyId, updated);
  return updated;
}

/**
 * Mark subscription as paid (e.g. after $2 Stripe test checkout).
 */
export function markSubscriptionPaid(
  companyId: string,
  paymentRef: string,
  method = "stripe_card"
): CompanySubscription {
  const current = getCompanySubscription(companyId);
  const updated: CompanySubscription = {
    ...current,
    isTrial: false,
    status: "active",
    paidAt: Date.now(),
    lastPaymentRef: paymentRef,
    paymentMethod: method,
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
