import { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Network,
  Users,
  ShieldCheck,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Search,
  CheckCircle2,
  XCircle,
  Building2,
  Briefcase,
  Truck,
  Package,
  DollarSign,
  Wrench,
  KeyRound,
  Laptop,
  History,
  UserPlus,
  ArrowRight,
  Filter,
  Eye,
  Layers,
  Lock,
  Unlock,
  SlidersHorizontal,
  Info,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import {
  fetchCompanyUsers,
  createCompanyUser,
  ALL_ROLE_CAPABILITIES,
  fetchRolePermissions,
  saveRolePermissions,
} from "@/lib/data";
import type { CompanyUser, DepartmentType, RoleLevel, RoleCapability } from "@/lib/types";

// ─── DEPARTMENT METADATA & ORGANOGRAM SPECS ──────────────────────────────────

type RoleProfileSpec = {
  title: string;
  defaultLevel: RoleLevel;
  responsibilities: string;
  allowedRules: string[];
  restrictedRules: string[];
  reportsTo: string;
};

type DepartmentOrganogramSpec = {
  department: DepartmentType;
  label: string;
  icon: typeof Building2;
  color: string;
  bgBadge: string;
  borderBadge: string;
  textBadge: string;
  description: string;
  headTitle: string;
  profiles: RoleProfileSpec[];
};

export const DEPARTMENT_ORGANOGRAM_DATA: DepartmentOrganogramSpec[] = [
  {
    department: "admin",
    label: "Executive & Administration",
    icon: Building2,
    color: "from-purple-600 to-indigo-600",
    bgBadge: "bg-purple-500/10",
    borderBadge: "border-purple-500/30",
    textBadge: "text-purple-400",
    description: "Overall organizational oversight, company configuration, executive policies, and access controls.",
    headTitle: "Admin - Super Admin",
    profiles: [
      {
        title: "Admin - Super Admin",
        defaultLevel: "super_admin",
        responsibilities: "Highest executive clearance. Oversees multi-company tenancy, system-wide role capabilities, reminder thresholds, and core security settings.",
        allowedRules: [
          "Full unrestricted access to all departments and data",
          "Toggle and enforce role capabilities system-wide",
          "Manage company registrations and multi-tenant profiles",
          "Set company-wide reminder triggers (hours stuck)",
          "Reset admin PINs and override security restrictions",
        ],
        restrictedRules: [
          "None (Executive authority)",
        ],
        reportsTo: "Board of Directors / Stakeholders",
      },
      {
        title: "Admin - Admin",
        defaultLevel: "admin",
        responsibilities: "Day-to-day organizational administrator. Manages user accounts, global company configurations, and cross-departmental operations.",
        allowedRules: [
          "Access and manage all modules across the system",
          "Create, edit, and deactivate staff user accounts",
          "View financial audits and company reports",
          "Approve system-wide overrides and operational requests",
        ],
        restrictedRules: [
          "Cannot modify multi-tenant global organization structures",
          "Cannot override super-admin security policies",
        ],
        reportsTo: "Super Admin",
      },
    ],
  },
  {
    department: "manager",
    label: "General Operations Management",
    icon: Layers,
    color: "from-blue-600 to-cyan-600",
    bgBadge: "bg-blue-500/10",
    borderBadge: "border-blue-500/30",
    textBadge: "text-blue-400",
    description: "Cross-departmental leadership coordinating hospitality, maintenance, procurement, and staff logistics.",
    headTitle: "General Operations Manager",
    profiles: [
      {
        title: "General Operations Manager",
        defaultLevel: "manager",
        responsibilities: "Orchestrates operational workflows, approves high-priority requests, and audits team performance.",
        allowedRules: [
          "Cross-departmental supervisory view and approvals",
          "Approve departmental procurement requests",
          "Manage hospitality bookings and room statuses",
          "Supervise maintenance jobs and work order schedules",
          "Review monthly employee attendance and HR activity",
        ],
        restrictedRules: [
          "Cannot alter company billing or organization setup",
          "Cannot edit super admin security credentials",
        ],
        reportsTo: "Executive Admin",
      },
    ],
  },
  {
    department: "human_resources",
    label: "Human Resources & Payroll",
    icon: Briefcase,
    color: "from-pink-600 to-rose-600",
    bgBadge: "bg-pink-500/10",
    borderBadge: "border-pink-500/30",
    textBadge: "text-pink-400",
    description: "Employee directory, contracts lifecycle, leaves administration, salary scales, and payroll generation.",
    headTitle: "HR - Manager",
    profiles: [
      {
        title: "HR - Manager",
        defaultLevel: "manager",
        responsibilities: "Leads human resources, approves employee contracts, manages salary grading, and approves mass payroll.",
        allowedRules: [
          "Approve and sign employee contracts (permanent & fixed)",
          "Approve leave requests and contract renewals/terminations",
          "Generate and approve monthly staff payroll and payslips",
          "Configure department salary scales and allowances",
        ],
        restrictedRules: [
          "Cannot access financial accounts balance or general ledger",
          "Cannot modify IT systems credentials",
        ],
        reportsTo: "General Operations Manager",
      },
      {
        title: "HR - Officer",
        defaultLevel: "staff",
        responsibilities: "Maintains employee profile records, assists staff onboarding, and reviews contract countdowns.",
        allowedRules: [
          "View and update employee directory records",
          "Submit draft contract extensions for approval",
          "Review expiring contracts countdowns",
        ],
        restrictedRules: [
          "Cannot approve or execute payroll payments",
          "Cannot terminate contracts without managerial approval",
        ],
        reportsTo: "HR - Manager",
      },
      {
        title: "HR - Payroll",
        defaultLevel: "staff",
        responsibilities: "Prepares payslip breakdowns, taxes, UIF, and pension deductions.",
        allowedRules: [
          "Calculate payroll deductions and gross/net salaries",
          "Draft monthly payroll batches",
          "Print and distribute payslips",
        ],
        restrictedRules: [
          "Cannot approve salary scale changes",
          "Cannot alter company bank accounts",
        ],
        reportsTo: "HR - Manager",
      },
      {
        title: "HR - All Rights",
        defaultLevel: "all_rights",
        responsibilities: "Full unrestricted operator access across all HR & payroll functionalities.",
        allowedRules: [
          "Execute all operations in the HR module without friction",
          "Mass generate payroll, manage leave, and extend contracts",
        ],
        restrictedRules: [
          "Scoped strictly to HR and staff management",
        ],
        reportsTo: "HR - Manager",
      },
    ],
  },
  {
    department: "procurement",
    label: "Procurement & Supply Chain",
    icon: Truck,
    color: "from-amber-600 to-orange-600",
    bgBadge: "bg-amber-500/10",
    borderBadge: "border-amber-500/30",
    textBadge: "text-amber-400",
    description: "Vendor quotation gathering, purchasing pipeline governance, purchase orders, and supplier relationships.",
    headTitle: "Procurement - Manager",
    profiles: [
      {
        title: "Procurement - Manager",
        defaultLevel: "manager",
        responsibilities: "Oversees purchasing pipeline, reviews supplier bids, approves selected quotes, and escalates fund requests.",
        allowedRules: [
          "Approve or reject quotation batches (up to 10 quotes per request)",
          "Escalate approved purchases to Accounts for funding",
          "Generate and issue external Quote Request documents (RFQs)",
          "Manage supplier database and contact directories",
        ],
        restrictedRules: [
          "Cannot disburse funds directly (requires Accounts signoff)",
          "Cannot alter stores inventory count directly without receipts",
        ],
        reportsTo: "General Operations Manager",
      },
      {
        title: "Procurement - Officer",
        defaultLevel: "staff",
        responsibilities: "Initiates quote gathering, uploads supplier quotations, communicates with suppliers, and tracks lead times.",
        allowedRules: [
          "Upload supplier quotations (PDF & Images)",
          "Trigger pipeline stage reminders when items are delayed",
          "Generate quote inquiries and contact suppliers",
          "Track purchase deliveries into stores",
        ],
        restrictedRules: [
          "Cannot approve final quotation selections",
          "Cannot approve departmental fund disbursements",
        ],
        reportsTo: "Procurement - Manager",
      },
      {
        title: "Procurement - All Rights",
        defaultLevel: "all_rights",
        responsibilities: "Unrestricted operational clearance across the entire procurement hub.",
        allowedRules: [
          "Initiate requests, upload quotes, and manage external RFQs",
          "Advance pipeline stages and submit fund approvals",
        ],
        restrictedRules: [
          "Restricted from disbursing bank funds without Accounts approval",
        ],
        reportsTo: "Procurement - Manager",
      },
    ],
  },
  {
    department: "stores",
    label: "Stores & Inventory Control",
    icon: Package,
    color: "from-teal-600 to-emerald-600",
    bgBadge: "bg-teal-500/10",
    borderBadge: "border-teal-500/30",
    textBadge: "text-teal-400",
    description: "Warehousing, receiving procured stock, inventory dispatch to departments, and min-stock monitoring.",
    headTitle: "Stores - Manager",
    profiles: [
      {
        title: "Stores - Manager",
        defaultLevel: "manager",
        responsibilities: "Directs warehouse operations, inventory valuations, stock checks, and release approvals.",
        allowedRules: [
          "Full oversight of central storerooms and sub-stores",
          "Approve stores dispatch requests to requesting departments",
          "Authorize inventory manual quantity adjustments",
          "Set minimum stock thresholds and reorder triggers",
        ],
        restrictedRules: [
          "Cannot solicit quotes from suppliers without procurement",
          "Cannot disburse payments",
        ],
        reportsTo: "General Operations Manager",
      },
      {
        title: "Stores - Clerk",
        defaultLevel: "staff",
        responsibilities: "Daily inventory counting, logging dispatches, and preparing items for release.",
        allowedRules: [
          "Record item releases to departments with recipient signatures",
          "Conduct inventory cycle counts and search stock levels",
          "View open procurement orders pending delivery",
        ],
        restrictedRules: [
          "Cannot write-off stock without Manager approval",
          "Cannot adjust unit costs or catalog prices",
        ],
        reportsTo: "Stores - Manager",
      },
      {
        title: "Stores - Receiver",
        defaultLevel: "staff",
        responsibilities: "Inspects incoming deliveries from suppliers, verifies packing slips, and records stock receipts.",
        allowedRules: [
          "Receive incoming shipments linked to procurement requests",
          "Verify physical counts against supplier delivery notes",
          "Advance procurement pipeline to 'delivered_to_stores'",
        ],
        restrictedRules: [
          "Cannot release stock directly without dispatch authorization",
        ],
        reportsTo: "Stores - Manager",
      },
      {
        title: "Stores - All Rights",
        defaultLevel: "all_rights",
        responsibilities: "Complete inventory management rights across receiving, releases, and stock adjustments.",
        allowedRules: [
          "Receive, dispatch, log, and adjust all stores inventory",
          "Full transaction audit log access",
        ],
        restrictedRules: [
          "Restricted to physical stores and inventory domains",
        ],
        reportsTo: "Stores - Manager",
      },
    ],
  },
  {
    department: "accountant",
    label: "Finance & Accounting",
    icon: DollarSign,
    color: "from-emerald-600 to-green-600",
    bgBadge: "bg-emerald-500/10",
    borderBadge: "border-emerald-500/30",
    textBadge: "text-emerald-400",
    description: "Financial ledgers, rent collection, invoice issuance, procurement funding approval, and tax reporting.",
    headTitle: "Accountant - Manager",
    profiles: [
      {
        title: "Accountant - Manager",
        defaultLevel: "manager",
        responsibilities: "Chief financial controller. Approves procurement fund disbursements, financial statements, and payment gateways.",
        allowedRules: [
          "Approve or reject procurement fund requests (cash/online/bank deposit)",
          "Access financial statements, profit/loss, and audit reports",
          "Oversee rent collection ledgers and tenant payment disputes",
          "Generate official quote inquiries with accounting letterhead",
        ],
        restrictedRules: [
          "Cannot alter physical room keys or maintenance schedules",
        ],
        reportsTo: "Executive Admin",
      },
      {
        title: "Accountant - Book Keeping",
        defaultLevel: "staff",
        responsibilities: "Maintains invoice journals, posts daily transactions, and reconciles bank statements.",
        allowedRules: [
          "Create and issue tenant invoices and receipts",
          "Log utility bills and recurring scheduled expenses",
          "Reconcile bank deposit references",
        ],
        restrictedRules: [
          "Cannot approve large procurement fund releases without manager",
        ],
        reportsTo: "Accountant - Manager",
      },
      {
        title: "Accountant - Payments and Bookings",
        defaultLevel: "staff",
        responsibilities: "Reconciles hospitality room bookings and incoming tenant rent collections.",
        allowedRules: [
          "Verify point-of-sale card transactions and EFT receipts",
          "Issue rent collection receipts to tenants",
          "Track overdue accounts and generate reminder notices",
        ],
        restrictedRules: [
          "Cannot approve procurement funding",
        ],
        reportsTo: "Accountant - Manager",
      },
      {
        title: "Accountant - All Rights",
        defaultLevel: "all_rights",
        responsibilities: "Complete clearance across all financial ledgers, rent tools, and funding approvals.",
        allowedRules: [
          "Unrestricted financial accounting and procurement fund signoffs",
          "Full reporting and billing configuration",
        ],
        restrictedRules: [
          "Restricted to financial and commercial operations",
        ],
        reportsTo: "Accountant - Manager",
      },
    ],
  },
  {
    department: "maintenance",
    label: "Maintenance & Facilities",
    icon: Wrench,
    color: "from-yellow-600 to-amber-600",
    bgBadge: "bg-yellow-500/10",
    borderBadge: "border-yellow-500/30",
    textBadge: "text-yellow-400",
    description: "Property upkeep, scheduled preventive maintenance, external contractor work orders, and repairs.",
    headTitle: "Maintenance - Manager",
    profiles: [
      {
        title: "Maintenance - Manager",
        defaultLevel: "manager",
        responsibilities: "Supervises facilities operations, schedules inspections, manages service providers, and authorizes work orders.",
        allowedRules: [
          "Assign and close work orders with external providers",
          "Submit urgent procurement requests for replacement hardware",
          "Approve maintenance job signoffs and room releases",
          "Schedule preventive maintenance calendars",
        ],
        restrictedRules: [
          "Cannot approve financial payments directly",
          "Cannot modify staff contracts",
        ],
        reportsTo: "General Operations Manager",
      },
      {
        title: "Maintenance - Cleaner",
        defaultLevel: "staff",
        responsibilities: "Executes room turnover cleaning, sanitization schedules, and linen replenishment.",
        allowedRules: [
          "View housekeeping schedule assignments",
          "Mark room cleaning as completed / verified",
          "Request cleaning chemical replenishment from stores",
        ],
        restrictedRules: [
          "Cannot view financial ledgers or room pricing",
          "Cannot alter room booking statuses",
        ],
        reportsTo: "Maintenance - Manager",
      },
      {
        title: "Maintenance - Repairs",
        defaultLevel: "staff",
        responsibilities: "Handles general electrical, carpentry, HVAC, and mechanical repairs in guest rooms and villas.",
        allowedRules: [
          "Log maintenance repairs completed with before/after notes",
          "Raise internal stores request for replacement parts",
          "Flag rooms as out-of-order for maintenance",
        ],
        restrictedRules: [
          "Cannot assign contracts to external service providers",
        ],
        reportsTo: "Maintenance - Manager",
      },
      {
        title: "Maintenance - Plumbing",
        defaultLevel: "staff",
        responsibilities: "Specialized plumbing inspections, pipe repairs, boiler maintenance, and drainage care.",
        allowedRules: [
          "Log plumbing inspections and repair logs",
          "Request plumbing fixtures and supplies from stores",
        ],
        restrictedRules: [
          "Restricted strictly to plumbing facilities scope",
        ],
        reportsTo: "Maintenance - Manager",
      },
      {
        title: "Maintenance - All Rights",
        defaultLevel: "all_rights",
        responsibilities: "Full supervisor rights across work orders, inspections, provider directories, and maintenance stock.",
        allowedRules: [
          "Direct access to all facilities management modules",
          "Schedule, dispatch, inspect, and sign off jobs",
        ],
        restrictedRules: [
          "Restricted to facilities and physical property domains",
        ],
        reportsTo: "Maintenance - Manager",
      },
    ],
  },
  {
    department: "front_desk",
    label: "Front Desk & Hospitality",
    icon: KeyRound,
    color: "from-sky-600 to-blue-600",
    bgBadge: "bg-sky-500/10",
    borderBadge: "border-sky-500/30",
    textBadge: "text-sky-400",
    description: "Guest check-ins/outs, commercial reservations, hospitality guest services, and portal inquiry responses.",
    headTitle: "Front Desk - Manager",
    profiles: [
      {
        title: "Front Desk - Admin",
        defaultLevel: "admin",
        responsibilities: "Hospitality business administrator. Configures room pricing models, meal plans, and booking rules.",
        allowedRules: [
          "Configure commercial room types, night rates, and meal plans",
          "Manage hospitality bookings, cancellations, and extensions",
          "Respond to customer portal tickets and publish listings",
          "Supervise front-desk staff registers and cash shifts",
        ],
        restrictedRules: [
          "Cannot modify backend database or server infrastructure",
        ],
        reportsTo: "General Operations Manager",
      },
      {
        title: "Front Desk - Manager",
        defaultLevel: "manager",
        responsibilities: "Manages front-office operations, guest dispute resolution, room allocation, and daily check-ins.",
        allowedRules: [
          "Authorize booking discounts, late check-outs, and room upgrades",
          "Resolve customer complaints and portal inquiry escalations",
          "Raise front-desk stationery requests to stores/procurement",
        ],
        restrictedRules: [
          "Cannot alter base room rate catalog without Admin",
        ],
        reportsTo: "General Operations Manager",
      },
      {
        title: "Front Desk - Receptionist",
        defaultLevel: "staff",
        responsibilities: "Direct guest interface: check-ins, key cards, card payments, identity verification, and booking creation.",
        allowedRules: [
          "Perform guest check-in and check-out with instant booking codes",
          "Record card/cash payments and generate guest receipts",
          "Create new bookings and assign vacant rooms",
        ],
        restrictedRules: [
          "Cannot edit base room prices or delete past bookings",
          "Cannot issue refunds without manager authorization",
        ],
        reportsTo: "Front Desk - Manager",
      },
      {
        title: "Front Desk - Customer Service",
        defaultLevel: "staff",
        responsibilities: "Answers guest queries, responds to portal tickets, and facilitates guest amenities.",
        allowedRules: [
          "Respond to incoming customer enquiries and room inquiries",
          "Provide property information and amenities guidance",
        ],
        restrictedRules: [
          "Cannot process payments or sign leases",
        ],
        reportsTo: "Front Desk - Manager",
      },
      {
        title: "Front Desk - Bookings",
        defaultLevel: "staff",
        responsibilities: "Handles reservation requests, phone bookings, corporate bookings, and calendar availability.",
        allowedRules: [
          "Create reservations, confirm dates, and issue proforma invoices",
          "Track room occupancy calendar and vacant slots",
        ],
        restrictedRules: [
          "Cannot delete bookings or modify completed transactions",
        ],
        reportsTo: "Front Desk - Manager",
      },
      {
        title: "Front Desk - All Rights",
        defaultLevel: "all_rights",
        responsibilities: "Complete clearance across all front-office and customer portal interfaces.",
        allowedRules: [
          "Manage rooms, bookings, enquiries, and guest check-ins with zero restrictions",
        ],
        restrictedRules: [
          "Restricted to hospitality front-office domain",
        ],
        reportsTo: "Front Desk - Manager",
      },
    ],
  },
  {
    department: "it",
    label: "IT & Systems Administration",
    icon: Laptop,
    color: "from-cyan-600 to-teal-600",
    bgBadge: "bg-cyan-500/10",
    borderBadge: "border-cyan-500/30",
    textBadge: "text-cyan-400",
    description: "System infrastructure, user access provisioning, security policies, API integrations, and developer maintenance.",
    headTitle: "IT - Manager",
    profiles: [
      {
        title: "IT - Manager",
        defaultLevel: "manager",
        responsibilities: "Directs IT infrastructure, cybersecurity, system integrations, and staff credential policies.",
        allowedRules: [
          "Configure email delivery gateways (Resend/SMTP/SendGrid/SES)",
          "Supervise system user provisioning and access rights",
          "Audit cybersecurity logs and authentication methods",
          "Submit hardware and software procurement requests",
        ],
        restrictedRules: [
          "Cannot disburse accounting funds or approve payroll",
        ],
        reportsTo: "Super Admin",
      },
      {
        title: "IT - System Admin",
        defaultLevel: "all_rights",
        responsibilities: "Day-to-day sysadmin: provisions new staff accounts, configures permissions, and monitors system health.",
        allowedRules: [
          "Create and provision user accounts across all departments",
          "Reset staff PINs and trigger password resets",
          "Configure role capabilities and access toggles",
        ],
        restrictedRules: [
          "Cannot alter super admin executive account credentials",
        ],
        reportsTo: "IT - Manager",
      },
      {
        title: "IT - Programmer",
        defaultLevel: "staff",
        responsibilities: "Maintains software integrations, API endpoints, webhook listeners, and automation logic.",
        allowedRules: [
          "Access developer documentation and system architecture",
          "Test integrations and troubleshoot system data states",
        ],
        restrictedRules: [
          "Cannot view financial ledgers or guest personal card info",
        ],
        reportsTo: "IT - Manager",
      },
      {
        title: "IT - Web Developer",
        defaultLevel: "staff",
        responsibilities: "Front-end customization, portal showcases, brand styling, and customer-facing listing pages.",
        allowedRules: [
          "Customize public portal themes, banners, and layout modules",
          "Optimize website speed and responsive UI components",
        ],
        restrictedRules: [
          "Cannot alter backend security policies",
        ],
        reportsTo: "IT - Manager",
      },
      {
        title: "IT - All Rights",
        defaultLevel: "all_rights",
        responsibilities: "Full technical control over software, user accounts, and environment parameters.",
        allowedRules: [
          "Unrestricted technical and user administration rights",
        ],
        restrictedRules: [
          "Restricted from signing legal contracts or financial cheques",
        ],
        reportsTo: "IT - Manager",
      },
    ],
  },
  {
    department: "audit",
    label: "Internal Audit & Compliance",
    icon: History,
    color: "from-slate-600 to-zinc-600",
    bgBadge: "bg-slate-500/10",
    borderBadge: "border-slate-500/30",
    textBadge: "text-slate-300",
    description: "Independent audit trail review, transaction verification, anti-fraud compliance, and policy adherence.",
    headTitle: "Audit - Manager",
    profiles: [
      {
        title: "Audit - Manager",
        defaultLevel: "manager",
        responsibilities: "Leads internal audit, inspects immutable system logs, flags irregular transactions, and reports directly to executive governance.",
        allowedRules: [
          "View full immutable audit trail across all modules and users",
          "Inspect all financial transactions, rent payments, and invoices",
          "Audit procurement bids and stores inventory movements",
          "Generate compliance inspection reports for executive leadership",
        ],
        restrictedRules: [
          "Read-only operational clearance (cannot create, edit, or delete transactions to preserve audit neutrality)",
        ],
        reportsTo: "Super Admin / Board Audit Committee",
      },
      {
        title: "Audit - Auditor",
        defaultLevel: "staff",
        responsibilities: "Performs sample transaction audits, verifies guest invoices, and checks procurement quotations against policy.",
        allowedRules: [
          "Search and inspect audit logs by user, date, and action",
          "Verify that stores inventory receipts match procurement orders",
          "Check payroll disbursement breakdowns against approved contracts",
        ],
        restrictedRules: [
          "Strictly read-only access across all audited operational domains",
        ],
        reportsTo: "Audit - Manager",
      },
      {
        title: "Audit - All Rights",
        defaultLevel: "all_rights",
        responsibilities: "Complete unrestricted audit trail exploration and forensic review capabilities.",
        allowedRules: [
          "Full forensic read access to system activity logs and records",
        ],
        restrictedRules: [
          "Cannot execute operational transactions (strictly supervisory)",
        ],
        reportsTo: "Audit - Manager",
      },
    ],
  },
];

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function OrganogramPage() {
  const { currentCompany, currentCompanyUser, isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<"tree" | "departments" | "rules_matrix">("tree");
  const [selectedDept, setSelectedDept] = useState<DepartmentType | "all">("all");
  const [selectedRoleModal, setSelectedRoleModal] = useState<{
    spec: RoleProfileSpec;
    deptSpec: DepartmentOrganogramSpec;
  } | null>(null);

  // Quick account creation modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    fullName: "",
    email: "",
    department: "procurement" as DepartmentType,
    jobTitle: "Procurement - Officer",
    roleLevel: "staff" as RoleLevel,
  });
  const [creating, setCreating] = useState(false);
  const [createSuccess, setCreateSuccess] = useState("");

  // Search & filter state for Matrix
  const [searchQuery, setSearchQuery] = useState("");
  const [filterLevel, setFilterLevel] = useState<string>("all");

  // Company users to count active accounts
  const [companyUsers, setCompanyUsers] = useState<CompanyUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Expanded departments in tree view
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({
    admin: true,
    manager: true,
    human_resources: true,
    procurement: true,
    stores: true,
    accountant: true,
    maintenance: true,
    front_desk: true,
    it: true,
    audit: true,
  });

  useEffect(() => {
    fetchCompanyUsers(currentCompany.id)
      .then((users) => {
        setCompanyUsers(users);
        setLoadingUsers(false);
      })
      .catch(() => setLoadingUsers(false));
  }, [currentCompany.id]);

  const toggleDeptExpand = (dept: string) => {
    setExpandedDepts((prev) => ({ ...prev, [dept]: !prev[dept] }));
  };

  const getActiveUsersForRole = (jobTitle: string) => {
    return companyUsers.filter(
      (u) => u.jobTitle.toLowerCase() === jobTitle.toLowerCase() && u.isActive
    );
  };

  const getActiveUsersForDept = (dept: DepartmentType) => {
    return companyUsers.filter((u) => u.department === dept && u.isActive);
  };

  const openCreateForRole = (spec: RoleProfileSpec, deptSpec: DepartmentOrganogramSpec) => {
    setCreateForm({
      fullName: "",
      email: "",
      department: deptSpec.department,
      jobTitle: spec.title,
      roleLevel: spec.defaultLevel,
    });
    setSelectedRoleModal(null);
    setCreateModalOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.fullName || !createForm.email) return;

    setCreating(true);
    setCreateSuccess("");
    try {
      const newUser = await createCompanyUser({
        companyId: currentCompany.id,
        fullName: createForm.fullName,
        email: createForm.email,
        department: createForm.department,
        jobTitle: createForm.jobTitle,
        roleLevel: createForm.roleLevel,
      });
      setCompanyUsers((prev) => [...prev, newUser]);
      setCreateSuccess(`Account for "${newUser.fullName}" created successfully!`);
      setTimeout(() => {
        setCreateModalOpen(false);
        setCreateSuccess("");
      }, 1500);
    } catch {
      alert("Account creation failed. Please check inputs.");
    } finally {
      setCreating(false);
    }
  };

  // Flattened role specs for rules matrix search
  const filteredProfiles = useMemo(() => {
    const list: Array<{ spec: RoleProfileSpec; deptSpec: DepartmentOrganogramSpec }> = [];
    DEPARTMENT_ORGANOGRAM_DATA.forEach((dept) => {
      if (selectedDept !== "all" && dept.department !== selectedDept) return;
      dept.profiles.forEach((p) => {
        if (filterLevel !== "all" && p.defaultLevel !== filterLevel) return;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const match =
            p.title.toLowerCase().includes(q) ||
            dept.label.toLowerCase().includes(q) ||
            p.responsibilities.toLowerCase().includes(q) ||
            p.allowedRules.some((r) => r.toLowerCase().includes(q));
          if (!match) return;
        }
        list.push({ spec: p, deptSpec: dept });
      });
    });
    return list;
  }, [selectedDept, filterLevel, searchQuery]);

  const totalProfilesCount = DEPARTMENT_ORGANOGRAM_DATA.reduce(
    (acc, d) => acc + d.profiles.length,
    0
  );

  return (
    <div className="space-y-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600/10 text-violet-500 border border-violet-500/20">
              <Network size={22} />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Company Organogram & Role Matrix
              </h1>
              <p className="text-xs text-muted">
                System hierarchy, account profiles that can be created, responsibilities, and security rules
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/users-management"
            className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs font-semibold text-foreground hover:bg-surface-elevated/80 transition"
          >
            <Users size={14} className="text-muted" />
            <span>Manage Staff Users</span>
          </Link>

          <button
            type="button"
            onClick={() => {
              setCreateForm({
                fullName: "",
                email: "",
                department: "procurement",
                jobTitle: "Procurement - Officer",
                roleLevel: "staff",
              });
              setCreateModalOpen(true);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-violet-700 transition shadow-sm"
          >
            <UserPlus size={14} />
            <span>Create Account</span>
          </button>
        </div>
      </div>

      {/* ── Key Metrics Overview ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Departments</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-foreground">
              {DEPARTMENT_ORGANOGRAM_DATA.length}
            </span>
            <span className="text-[11px] text-muted">operational units</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Account Profiles</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-violet-500">
              {totalProfilesCount}
            </span>
            <span className="text-[11px] text-muted">creatable roles</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Active Staff</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-500">
              {loadingUsers ? "..." : companyUsers.filter((u) => u.isActive).length}
            </span>
            <span className="text-[11px] text-muted">in {currentCompany.name}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border-color bg-surface p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted">System Rules</p>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-500">
              {ALL_ROLE_CAPABILITIES.length}
            </span>
            <span className="text-[11px] text-muted">gated permissions</span>
          </div>
        </div>
      </div>

      {/* ── Tabs Navigation ── */}
      <div className="flex border-b border-border-color gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setActiveTab("tree")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition ${
            activeTab === "tree"
              ? "border-b-2 border-violet-600 bg-surface-elevated text-violet-500"
              : "text-muted hover:text-foreground"
          }`}
        >
          <Network size={15} />
          <span>Hierarchy Organogram Tree</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("departments")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition ${
            activeTab === "departments"
              ? "border-b-2 border-violet-600 bg-surface-elevated text-violet-500"
              : "text-muted hover:text-foreground"
          }`}
        >
          <Building2 size={15} />
          <span>Department Profiles Cards</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("rules_matrix")}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold rounded-t-xl transition ${
            activeTab === "rules_matrix"
              ? "border-b-2 border-violet-600 bg-surface-elevated text-violet-500"
              : "text-muted hover:text-foreground"
          }`}
        >
          <ShieldCheck size={15} />
          <span>Roles & Security Rules Matrix</span>
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 1: HIERARCHY TREE VIEW (ORGANOGRAM FLOW)                         */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "tree" && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border-color bg-surface p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-border-color">
              <div>
                <h2 className="text-sm font-bold text-foreground">Interactive Company Organogram</h2>
                <p className="text-xs text-muted">
                  Click on any profile card to view full operational rules, capabilities, and active account holders.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Filter Department:</span>
                <select
                  value={selectedDept}
                  onChange={(e) => setSelectedDept(e.target.value as DepartmentType | "all")}
                  className="rounded-xl border border-border-color bg-surface-elevated px-2.5 py-1.5 text-xs text-foreground outline-none"
                >
                  <option value="all">All Departments ({DEPARTMENT_ORGANOGRAM_DATA.length})</option>
                  {DEPARTMENT_ORGANOGRAM_DATA.map((d) => (
                    <option key={d.department} value={d.department}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* ── Executive Level (Apex) ── */}
            <div className="flex flex-col items-center">
              <div
                onClick={() =>
                  setSelectedRoleModal({
                    spec: DEPARTMENT_ORGANOGRAM_DATA[0].profiles[0],
                    deptSpec: DEPARTMENT_ORGANOGRAM_DATA[0],
                  })
                }
                className="group relative flex flex-col items-center cursor-pointer rounded-2xl border-2 border-purple-500/50 bg-gradient-to-b from-purple-500/15 via-purple-500/5 to-surface p-4 text-center shadow-md hover:border-purple-500 hover:shadow-lg transition max-w-sm w-full"
              >
                <span className="absolute -top-3 rounded-full bg-purple-600 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-sm">
                  Executive Authority
                </span>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-600 text-white shadow-md my-1 group-hover:scale-105 transition">
                  <ShieldCheck size={26} />
                </div>
                <h3 className="mt-1 font-extrabold text-foreground text-sm">
                  Super Admin (Executive)
                </h3>
                <p className="text-[11px] text-purple-400 font-semibold">
                  Multi-Company Governance & Core Policies
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="rounded-lg bg-surface-elevated px-2 py-0.5 text-[10px] text-muted border border-border-color">
                    Clearance: super_admin
                  </span>
                  <span className="rounded-lg bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                    {getActiveUsersForRole("Admin - Super Admin").length} Active
                  </span>
                </div>
              </div>

              {/* Vertical Branch Connector */}
              <div className="h-8 w-0.5 bg-border-color my-1" />

              {/* ── Operational Leadership Level ── */}
              <div
                onClick={() =>
                  setSelectedRoleModal({
                    spec: DEPARTMENT_ORGANOGRAM_DATA[1].profiles[0],
                    deptSpec: DEPARTMENT_ORGANOGRAM_DATA[1],
                  })
                }
                className="group relative flex flex-col items-center cursor-pointer rounded-2xl border-2 border-blue-500/40 bg-gradient-to-b from-blue-500/15 via-blue-500/5 to-surface p-3.5 text-center shadow-sm hover:border-blue-500 hover:shadow-md transition max-w-xs w-full"
              >
                <span className="absolute -top-2.5 rounded-full bg-blue-600 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-white shadow-sm">
                  Operations Leadership
                </span>
                <h4 className="mt-1 font-bold text-foreground text-xs">
                  General Operations Manager
                </h4>
                <p className="text-[10px] text-blue-400">
                  Cross-Departmental Supervisory & Approvals
                </p>
                <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted">
                  <span className="rounded bg-surface-elevated px-1.5 py-0.5 border border-border-color">
                    Level: manager
                  </span>
                  <span className="text-emerald-400 font-medium">
                    {getActiveUsersForRole("General Operations Manager").length} Active
                  </span>
                </div>
              </div>

              {/* Connector to Department Hubs */}
              <div className="h-8 w-0.5 bg-border-color my-1" />
              <div className="w-full max-w-5xl border-t-2 border-dashed border-border-color mb-6" />
            </div>

            {/* ── Department Branches Grid ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {DEPARTMENT_ORGANOGRAM_DATA.filter(
                (d) => selectedDept === "all" || d.department === selectedDept
              ).map((dept) => {
                const Icon = dept.icon;
                const isExpanded = expandedDepts[dept.department];
                const activeInDept = getActiveUsersForDept(dept.department).length;

                return (
                  <div
                    key={dept.department}
                    className="flex flex-col rounded-2xl border border-border-color bg-surface-elevated/40 p-4 transition shadow-sm hover:border-border-color/80"
                  >
                    {/* Department Branch Header */}
                    <div className="flex items-start justify-between gap-2 pb-3 border-b border-border-color/60">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${dept.color} text-white shadow-sm`}
                        >
                          <Icon size={18} />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-foreground">{dept.label}</h4>
                          <span
                            className={`inline-block rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${dept.bgBadge} ${dept.borderBadge} ${dept.textBadge}`}
                          >
                            Head: {dept.headTitle}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="rounded-lg bg-surface px-2 py-1 text-[10px] font-bold text-foreground border border-border-color">
                          {activeInDept} staff
                        </span>
                        <button
                          type="button"
                          onClick={() => toggleDeptExpand(dept.department)}
                          className="rounded-lg p-1 text-muted hover:text-foreground hover:bg-surface transition"
                          title={isExpanded ? "Collapse profiles" : "Expand profiles"}
                        >
                          <ChevronDown
                            size={16}
                            className={`transition-transform duration-200 ${
                              isExpanded ? "rotate-0" : "-rotate-90"
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Creatable Profiles in this Department */}
                    {isExpanded && (
                      <div className="mt-3 space-y-2 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted/70">
                          Creatable Account Profiles ({dept.profiles.length}):
                        </p>

                        <div className="space-y-1.5">
                          {dept.profiles.map((prof) => {
                            const activeCount = getActiveUsersForRole(prof.title).length;

                            return (
                              <div
                                key={prof.title}
                                onClick={() =>
                                  setSelectedRoleModal({ spec: prof, deptSpec: dept })
                                }
                                className="group flex items-center justify-between rounded-xl border border-border-color/70 bg-surface p-2.5 text-xs hover:border-violet-500/50 hover:bg-surface-elevated transition cursor-pointer"
                              >
                                <div className="min-w-0 flex-1 pr-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-semibold text-foreground truncate group-hover:text-violet-400 transition">
                                      {prof.title}
                                    </span>
                                    <span
                                      className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                                        prof.defaultLevel === "super_admin"
                                          ? "bg-purple-500/20 text-purple-400"
                                          : prof.defaultLevel === "admin"
                                          ? "bg-blue-500/20 text-blue-400"
                                          : prof.defaultLevel === "manager"
                                          ? "bg-amber-500/20 text-amber-400"
                                          : prof.defaultLevel === "all_rights"
                                          ? "bg-cyan-500/20 text-cyan-400"
                                          : "bg-zinc-500/20 text-zinc-400"
                                      }`}
                                    >
                                      {prof.defaultLevel}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-muted truncate mt-0.5">
                                    {prof.responsibilities}
                                  </p>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  {activeCount > 0 ? (
                                    <span className="rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                                      {activeCount}
                                    </span>
                                  ) : (
                                    <span className="rounded-full bg-surface-elevated border border-border-color px-2 py-0.5 text-[10px] text-muted">
                                      0
                                    </span>
                                  )}
                                  <ChevronRight
                                    size={14}
                                    className="text-muted group-hover:text-foreground group-hover:translate-x-0.5 transition"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Quick Action Footer */}
                    <div className="mt-3 pt-2.5 border-t border-border-color/40 flex items-center justify-between text-[11px]">
                      <span className="text-muted text-[10px]">
                        Reports to: {dept.profiles[0]?.reportsTo || "Operations"}
                      </span>
                      <button
                        type="button"
                        onClick={() => openCreateForRole(dept.profiles[0], dept)}
                        className="text-violet-400 hover:text-violet-300 font-semibold flex items-center gap-1 transition"
                      >
                        <UserPlus size={12} />
                        <span>Add Profile</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 2: DEPARTMENT PROFILES CARDS (COMPREHENSIVE DIRECTORY)            */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "departments" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {DEPARTMENT_ORGANOGRAM_DATA.map((dept) => {
              const Icon = dept.icon;
              const activeInDept = getActiveUsersForDept(dept.department).length;

              return (
                <div
                  key={dept.department}
                  className="rounded-2xl border border-border-color bg-surface p-5 shadow-sm space-y-4"
                >
                  {/* Department Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${dept.color} text-white shadow-sm`}
                      >
                        <Icon size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground text-sm">{dept.label}</h3>
                        <p className="text-xs text-muted mt-0.5">{dept.description}</p>
                      </div>
                    </div>
                    <span className="rounded-xl bg-surface-elevated border border-border-color px-2.5 py-1 text-xs font-bold text-foreground shrink-0">
                      {activeInDept} staff active
                    </span>
                  </div>

                  {/* Creatable Account Profiles in this Department */}
                  <div className="space-y-3 pt-2 border-t border-border-color">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted">
                      System Account Profiles Configured For This Department:
                    </p>

                    <div className="space-y-2.5">
                      {dept.profiles.map((prof) => {
                        const activeList = getActiveUsersForRole(prof.title);

                        return (
                          <div
                            key={prof.title}
                            className="rounded-xl border border-border-color bg-surface-elevated/40 p-3.5 space-y-2 hover:border-border-color transition"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-foreground text-xs">
                                    {prof.title}
                                  </span>
                                  <span
                                    className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                      prof.defaultLevel === "super_admin"
                                        ? "bg-purple-500/20 text-purple-400"
                                        : prof.defaultLevel === "admin"
                                        ? "bg-blue-500/20 text-blue-400"
                                        : prof.defaultLevel === "manager"
                                        ? "bg-amber-500/20 text-amber-400"
                                        : prof.defaultLevel === "all_rights"
                                        ? "bg-cyan-500/20 text-cyan-400"
                                        : "bg-zinc-500/20 text-zinc-400"
                                    }`}
                                  >
                                    Level: {prof.defaultLevel}
                                  </span>
                                </div>
                                <p className="text-[11px] text-muted mt-1 leading-relaxed">
                                  {prof.responsibilities}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => openCreateForRole(prof, dept)}
                                className="shrink-0 rounded-lg bg-violet-600/10 text-violet-400 border border-violet-500/20 px-2.5 py-1 text-[11px] font-semibold hover:bg-violet-600 hover:text-white transition"
                              >
                                Create
                              </button>
                            </div>

                            {/* Rules Summary */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-border-color/60 text-[11px]">
                              <div>
                                <span className="font-semibold text-emerald-400 flex items-center gap-1 text-[10px]">
                                  <CheckCircle2 size={12} /> Key Permissions Allowed:
                                </span>
                                <ul className="list-disc list-inside text-muted text-[10px] space-y-0.5 mt-1">
                                  {prof.allowedRules.slice(0, 2).map((r, i) => (
                                    <li key={i} className="truncate" title={r}>
                                      {r}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div>
                                <span className="font-semibold text-rose-400 flex items-center gap-1 text-[10px]">
                                  <XCircle size={12} /> Key Restrictions:
                                </span>
                                <ul className="list-disc list-inside text-muted text-[10px] space-y-0.5 mt-1">
                                  {prof.restrictedRules.slice(0, 2).map((r, i) => (
                                    <li key={i} className="truncate" title={r}>
                                      {r}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>

                            {/* Active Staff List in Company */}
                            <div className="flex items-center justify-between text-[10px] text-muted pt-1">
                              <span>Reports to: {prof.reportsTo}</span>
                              <span>
                                Currently active:{" "}
                                <strong className="text-foreground">{activeList.length} staff</strong>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* TAB 3: ROLES & SECURITY RULES MATRIX (SEARCHABLE BREAKDOWN)           */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "rules_matrix" && (
        <div className="rounded-2xl border border-border-color bg-surface p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border-color">
            <div>
              <h2 className="text-sm font-bold text-foreground">
                Role Permissions & Rule Breakdown Matrix
              </h2>
              <p className="text-xs text-muted">
                Inspect rules, reporting lines, and security boundaries for every creatable account profile
              </p>
            </div>

            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px]">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                />
                <input
                  type="text"
                  placeholder="Search role or rule..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated pl-8 pr-3 py-1.5 text-xs text-foreground outline-none focus:border-violet-500"
                />
              </div>

              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value as DepartmentType | "all")}
                className="rounded-xl border border-border-color bg-surface-elevated px-2.5 py-1.5 text-xs text-foreground outline-none"
              >
                <option value="all">All Departments</option>
                {DEPARTMENT_ORGANOGRAM_DATA.map((d) => (
                  <option key={d.department} value={d.department}>
                    {d.label}
                  </option>
                ))}
              </select>

              <select
                value={filterLevel}
                onChange={(e) => setFilterLevel(e.target.value)}
                className="rounded-xl border border-border-color bg-surface-elevated px-2.5 py-1.5 text-xs text-foreground outline-none"
              >
                <option value="all">All Clearance Levels</option>
                <option value="super_admin">super_admin</option>
                <option value="admin">admin</option>
                <option value="manager">manager</option>
                <option value="all_rights">all_rights</option>
                <option value="staff">staff</option>
              </select>
            </div>
          </div>

          {/* Matrix Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border-color bg-surface-elevated/60 text-[11px] font-bold uppercase tracking-wider text-muted">
                  <th className="py-2.5 px-3">Role / Profile Title</th>
                  <th className="py-2.5 px-3">Department</th>
                  <th className="py-2.5 px-3">Clearance Level</th>
                  <th className="py-2.5 px-3">Allowed Rules (What they can do)</th>
                  <th className="py-2.5 px-3">Restricted Rules (What they cannot do)</th>
                  <th className="py-2.5 px-3">Reports To</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color">
                {filteredProfiles.map(({ spec, deptSpec }) => {
                  return (
                    <tr
                      key={spec.title}
                      className="hover:bg-surface-elevated/40 transition group"
                    >
                      <td className="py-3 px-3">
                        <span className="font-bold text-foreground block">{spec.title}</span>
                        <span className="text-[10px] text-muted line-clamp-1">
                          {spec.responsibilities}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-[10px] font-semibold border ${deptSpec.bgBadge} ${deptSpec.borderBadge} ${deptSpec.textBadge}`}
                        >
                          {deptSpec.label}
                        </span>
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                            spec.defaultLevel === "super_admin"
                              ? "bg-purple-500/20 text-purple-400"
                              : spec.defaultLevel === "admin"
                              ? "bg-blue-500/20 text-blue-400"
                              : spec.defaultLevel === "manager"
                              ? "bg-amber-500/20 text-amber-400"
                              : spec.defaultLevel === "all_rights"
                              ? "bg-cyan-500/20 text-cyan-400"
                              : "bg-zinc-500/20 text-zinc-400"
                          }`}
                        >
                          {spec.defaultLevel}
                        </span>
                      </td>

                      <td className="py-3 px-3 max-w-xs">
                        <ul className="space-y-1 text-[10px] text-muted">
                          {spec.allowedRules.map((r, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <CheckCircle2 size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </td>

                      <td className="py-3 px-3 max-w-xs">
                        <ul className="space-y-1 text-[10px] text-muted">
                          {spec.restrictedRules.map((r, i) => (
                            <li key={i} className="flex items-start gap-1">
                              <XCircle size={12} className="text-rose-400 shrink-0 mt-0.5" />
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </td>

                      <td className="py-3 px-3 text-[11px] text-muted">
                        {spec.reportsTo}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => openCreateForRole(spec, deptSpec)}
                          className="rounded-xl bg-violet-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-violet-700 transition"
                        >
                          Create
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: ROLE DETAILS & INSPECTOR                                      */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {selectedRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl border border-border-color bg-surface p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between pb-3 border-b border-border-color">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${selectedRoleModal.deptSpec.color} text-white shadow-sm`}
                >
                  <ShieldCheck size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {selectedRoleModal.spec.title}
                  </h3>
                  <p className="text-xs text-muted">
                    {selectedRoleModal.deptSpec.label} &bull; Reports to:{" "}
                    <strong>{selectedRoleModal.spec.reportsTo}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRoleModal(null)}
                className="rounded-lg p-1 text-muted hover:text-foreground hover:bg-surface-elevated transition"
              >
                ✕
              </button>
            </div>

            {/* Role Clearance Details */}
            <div className="rounded-xl border border-border-color bg-surface-elevated p-3 text-xs space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-muted text-[11px]">System Role Level:</span>
                <span className="rounded bg-violet-600/20 text-violet-400 font-bold px-2 py-0.5 text-[10px] uppercase">
                  {selectedRoleModal.spec.defaultLevel}
                </span>
              </div>
              <p className="text-foreground text-xs leading-relaxed pt-1">
                {selectedRoleModal.spec.responsibilities}
              </p>
            </div>

            {/* Allowed vs Restricted Rules */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 space-y-2">
                <p className="font-bold text-emerald-400 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                  <CheckCircle2 size={14} /> Permitted Operational Rules:
                </p>
                <ul className="space-y-1 text-muted text-[11px]">
                  {selectedRoleModal.spec.allowedRules.map((rule, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-emerald-400">&bull;</span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 space-y-2">
                <p className="font-bold text-rose-400 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                  <XCircle size={14} /> Boundaries & Restrictions:
                </p>
                <ul className="space-y-1 text-muted text-[11px]">
                  {selectedRoleModal.spec.restrictedRules.map((rule, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-rose-400">&bull;</span>
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Currently Active Staff in This Company */}
            <div className="rounded-xl border border-border-color bg-surface-elevated/40 p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Active Accounts In {currentCompany.name}:
                </span>
                <span className="text-[11px] font-bold text-emerald-400">
                  {getActiveUsersForRole(selectedRoleModal.spec.title).length} staff holding this role
                </span>
              </div>

              <div className="max-h-24 overflow-y-auto space-y-1">
                {getActiveUsersForRole(selectedRoleModal.spec.title).length > 0 ? (
                  getActiveUsersForRole(selectedRoleModal.spec.title).map((user) => (
                    <div
                      key={user.id}
                      className="flex items-center justify-between rounded-lg bg-surface px-2.5 py-1 text-[11px] border border-border-color"
                    >
                      <span className="font-semibold text-foreground">{user.fullName}</span>
                      <span className="text-muted text-[10px]">{user.email}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] text-muted italic">
                    No staff accounts currently hold this role in this company organization.
                  </p>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-color">
              <button
                type="button"
                onClick={() => setSelectedRoleModal(null)}
                className="rounded-xl border border-border-color bg-surface-elevated px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-elevated/80 transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() =>
                  openCreateForRole(selectedRoleModal.spec, selectedRoleModal.deptSpec)
                }
                className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 transition flex items-center gap-1.5"
              >
                <UserPlus size={14} />
                <span>Create Account With This Profile</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {/* MODAL: CREATE ACCOUNT WITH ROLE                                       */}
      {/* ═══════════════════════════════════════════════════════════════════════ */}
      {createModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl border border-border-color bg-surface p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between pb-3 border-b border-border-color">
              <div>
                <h3 className="text-sm font-bold text-foreground">Create System Account Profile</h3>
                <p className="text-xs text-muted">
                  Add a new staff member with an official organogram role assignment
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateModalOpen(false)}
                className="rounded-lg p-1 text-muted hover:text-foreground transition"
              >
                ✕
              </button>
            </div>

            {createSuccess && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-400 font-semibold flex items-center gap-2">
                <CheckCircle2 size={16} />
                <span>{createSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sipho Sithole"
                  value={createForm.fullName}
                  onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs text-foreground outline-none focus:border-violet-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  Work Email Address *
                </label>
                <input
                  type="email"
                  required
                  placeholder="e.g. sipho@championscourt.co.za"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs text-foreground outline-none focus:border-violet-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-foreground mb-1">
                    Department
                  </label>
                  <select
                    value={createForm.department}
                    onChange={(e) => {
                      const dept = e.target.value as DepartmentType;
                      const deptSpec = DEPARTMENT_ORGANOGRAM_DATA.find((d) => d.department === dept);
                      const defaultProf = deptSpec?.profiles[0];
                      setCreateForm({
                        ...createForm,
                        department: dept,
                        jobTitle: defaultProf ? defaultProf.title : `${dept} staff`,
                        roleLevel: defaultProf ? defaultProf.defaultLevel : "staff",
                      });
                    }}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs text-foreground outline-none focus:border-violet-500"
                  >
                    {DEPARTMENT_ORGANOGRAM_DATA.map((d) => (
                      <option key={d.department} value={d.department}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-foreground mb-1">
                    Access Clearance Level
                  </label>
                  <select
                    value={createForm.roleLevel}
                    onChange={(e) =>
                      setCreateForm({ ...createForm, roleLevel: e.target.value as RoleLevel })
                    }
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs text-foreground outline-none focus:border-violet-500"
                  >
                    <option value="staff">Staff</option>
                    <option value="manager">Manager</option>
                    <option value="all_rights">All Rights</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-foreground mb-1">
                  Assigned Job Title / Profile
                </label>
                <select
                  value={createForm.jobTitle}
                  onChange={(e) => {
                    const title = e.target.value;
                    const deptSpec = DEPARTMENT_ORGANOGRAM_DATA.find(
                      (d) => d.department === createForm.department
                    );
                    const prof = deptSpec?.profiles.find((p) => p.title === title);
                    setCreateForm({
                      ...createForm,
                      jobTitle: title,
                      roleLevel: prof ? prof.defaultLevel : createForm.roleLevel,
                    });
                  }}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs text-foreground outline-none focus:border-violet-500"
                >
                  {DEPARTMENT_ORGANOGRAM_DATA.find(
                    (d) => d.department === createForm.department
                  )?.profiles.map((p) => (
                    <option key={p.title} value={p.title}>
                      {p.title} ({p.defaultLevel})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-color">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="rounded-xl border border-border-color bg-surface-elevated px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-elevated/80 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700 transition disabled:opacity-60 flex items-center gap-1.5"
                >
                  {creating ? "Creating..." : "Confirm & Create Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
