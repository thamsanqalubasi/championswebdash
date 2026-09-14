import { useState, useEffect, useMemo } from "react";
import {
  Users,
  Briefcase,
  DollarSign,
  FileSignature,
  Calendar,
  Plus,
  CheckCircle2,
  XCircle,
  FileText,
  Printer,
  ShieldCheck,
  Building,
  BadgePercent,
  Clock,
  Eye,
  History,
  Search,
  Filter,
  Mail,
  ChevronRight,
  ArrowUpRight,
  ExternalLink,
  Building2,
  Check,
  CreditCard,
  Receipt,
  UserCheck,
  UserX,
  AlertTriangle,
  RefreshCw,
  Sparkles,
  Timer,
  Hourglass,
  ShieldAlert,
  CalendarClock,
  UserMinus,
  RotateCcw,
  UserPlus,
  Send,
  CheckSquare,
  Square,
  Network,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  fetchCompanyUsers,
  createCompanyUser,
  sendStaffInvitation,
  fetchSalaryScales,
  saveSalaryScale,
  fetchPayslips,
  generatePayslip,
  fetchEmployeeContracts,
  fetchEmployeeContractTemplates,
  createEmployeeContract,
  extendEmployeeContract,
  terminateEmployeeContract,
  deactivateEmployeeUser,
  reactivateEmployeeUser,
  massGeneratePayroll,
  fetchLeaveRecords,
  requestLeave,
  updateLeaveStatus,
  sendPayslipEmailViaApi,
  JOB_TITLES_BY_DEPARTMENT,
  fetchCustomRoleDefinitions,
} from "@/lib/data";
import type {
  CompanyUser,
  SalaryScale,
  Payslip,
  EmployeeContract,
  EmployeeContractTemplate,
  LeaveRecord,
  RoleProfileDefinition,
  RoleLevel,
  DepartmentType,
} from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { buildProfessionalPayslipHtml } from "@/lib/document-templates";
import { fetchCompanyInfo, openDocumentPreview } from "@/lib/storage";

export default function HRPage() {
  const { currentCompany, currentCompanyUser, isManager, isAdmin } = useAuth();
  const { currency, symbol, formatWhole } = useCurrency();
  const [activeTab, setActiveTab] = useState<
    "directory" | "payslips" | "history" | "expiring" | "contracts" | "salaries" | "leave"
  >("directory");

  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [salaryScales, setSalaryScales] = useState<SalaryScale[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [contracts, setContracts] = useState<EmployeeContract[]>([]);
  const [templates, setTemplates] = useState<EmployeeContractTemplate[]>([]);
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Employee details modal state
  const [selectedEmployee, setSelectedEmployee] = useState<CompanyUser | null>(null);

  // Employee deactivation modal state
  const [deactivatingEmployee, setDeactivatingEmployee] = useState<CompanyUser | null>(null);
  const [deactivationReason, setDeactivationReason] = useState<
    "resigned" | "terminated" | "deceased" | "contract_ended" | "other"
  >("resigned");
  const [deactivationNotes, setDeactivationNotes] = useState("");
  const [deactivationEffectiveDate, setDeactivationEffectiveDate] = useState(
    new Date().toISOString().slice(0, 10)
  );

  // Contract extension modal state
  const [extendingContract, setExtendingContract] = useState<EmployeeContract | null>(null);
  const [extensionEndDate, setExtensionEndDate] = useState("");
  const [extensionSalary, setExtensionSalary] = useState<number>(0);
  const [extensionNotes, setExtensionNotes] = useState("");

  // Contract immediate termination modal state
  const [terminatingContract, setTerminatingContract] = useState<EmployeeContract | null>(null);
  const [contractTerminationReason, setContractTerminationReason] = useState("Contract ended by mutual agreement");
  const [deactivateEmployeeOnContractEnd, setDeactivateEmployeeOnContractEnd] = useState(true);

  // Create Contract modal state
  const [createContractTarget, setCreateContractTarget] = useState<CompanyUser | null>(null);
  const [newContractIsPermanent, setNewContractIsPermanent] = useState(false);
  const [newContractStartDate, setNewContractStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [newContractEndDate, setNewContractEndDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 12);
    return d.toISOString().slice(0, 10);
  });
  const [newContractSalary, setNewContractSalary] = useState(15000);
  const [newContractLeaveDays, setNewContractLeaveDays] = useState(21);
  const [creatingContract, setCreatingContract] = useState(false);

  // Add Staff Modal State (HR Manager quick onboarding)
  const [addStaffModalOpen, setAddStaffModalOpen] = useState(false);
  const [staffFullName, setStaffFullName] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffDepartment, setStaffDepartment] = useState<DepartmentType>("front_desk");
  const [staffJobTitle, setStaffJobTitle] = useState("Front Desk - Receptionist");
  const [staffRoleLevel, setStaffRoleLevel] = useState<RoleLevel>("staff");
  const [staffSendInvite, setStaffSendInvite] = useState(true);
  const [staffSaving, setStaffSaving] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);
  const [staffSuccess, setStaffSuccess] = useState<string | null>(null);
  const [customRoles, setCustomRoles] = useState<RoleProfileDefinition[]>([]);

  // Advanced Single & Multi-Month Bulk Payslip Suite State
  const [batchGeneratorModalOpen, setBatchGeneratorModalOpen] = useState(false);
  const [batchStep, setBatchStep] = useState<"select" | "review">("select");
  const [batchSelectedEmployeeIds, setBatchSelectedEmployeeIds] = useState<string[]>([]);
  const [batchSelectedMonths, setBatchSelectedMonths] = useState<string[]>([new Date().toISOString().slice(0, 7)]);
  const [batchDrafts, setBatchDrafts] = useState<
    Array<{
      id: string;
      user: CompanyUser;
      month: string;
      basicSalary: number;
      allowances: Record<string, number>;
      deductions: Record<string, number>;
      grossPay: number;
      netPay: number;
      eligible: boolean;
      ineligibleReason?: string;
      selectedForDispatch: boolean;
      emailSent?: boolean;
    }>
  >([]);
  const [batchSending, setBatchSending] = useState(false);
  const [batchSendProgress, setBatchSendProgress] = useState({ current: 0, total: 0 });
  const [batchResultMsg, setBatchResultMsg] = useState<string | null>(null);

  // Directory filters
  const [directorySearch, setDirectorySearch] = useState("");
  const [directoryDept, setDirectoryDept] = useState("all");
  const [directoryStatusFilter, setDirectoryStatusFilter] = useState<"all" | "active" | "inactive">("all");

  // Expiring contracts custom duration filter
  const [expiringDurationDays, setExpiringDurationDays] = useState<number>(30);
  const [isCustomExpiringDuration, setIsCustomExpiringDuration] = useState(false);

  // Payslips filters
  const [payslipSearch, setPayslipSearch] = useState("");
  const [payslipPeriodFilter, setPayslipPeriodFilter] = useState("all");

  // History filters
  const [historyPeriodFilter, setHistoryPeriodFilter] = useState("all");

  // Printing state indicator
  const [printingSlipId, setPrintingSlipId] = useState<string | null>(null);

  // Single Payslip Modal State (Legacy quick launcher)
  const [payslipModalOpen, setPayslipModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [payPeriod, setPayPeriod] = useState("2026-08");
  const [basicSalary, setBasicSalary] = useState(15000);
  const [housingAllowance, setHousingAllowance] = useState(1500);
  const [transportAllowance, setTransportAllowance] = useState(1000);
  const [medicalAllowance, setMedicalAllowance] = useState(800);
  const [previewPayslip, setPreviewPayslip] = useState<Payslip | null>(null);

  // Leave Modal State
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveRecord["leaveType"]>("annual");
  const [leaveStartDate, setLeaveStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [leaveEndDate, setLeaveEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [leaveReason, setLeaveReason] = useState("");

  const loadData = async () => {
    setLoading(true);
    const [usrs, scales, slips, cons, tmpls, lvs] = await Promise.all([
      fetchCompanyUsers(currentCompany.id),
      fetchSalaryScales(currentCompany.id),
      fetchPayslips(currentCompany.id),
      fetchEmployeeContracts(currentCompany.id),
      fetchEmployeeContractTemplates(currentCompany.id),
      fetchLeaveRecords(currentCompany.id),
    ]);
    setUsers(usrs);
    setSalaryScales(scales);
    setPayslips(slips);
    setContracts(cons);
    setTemplates(tmpls);
    setLeaveRecords(lvs);
    // Set default selected active user
    const activeFirst = usrs.find((u) => u.isActive !== false);
    if (activeFirst && !selectedUserId) setSelectedUserId(activeFirst.id);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [currentCompany.id]);

  // Active employees list (strictly enforced)
  const activeEmployees = useMemo(() => {
    return users.filter((u) => u.isActive !== false);
  }, [users]);

  const inactiveEmployees = useMemo(() => {
    return users.filter((u) => u.isActive === false);
  }, [users]);

  // Handle printing official payslip in a new browser tab with company branding
  const handlePrintOfficialPayslip = async (slip: Payslip) => {
    setPrintingSlipId(slip.id);
    const printTab = window.open("about:blank", "_blank");
    try {
      let company = await fetchCompanyInfo(currentCompany.id);
      if (!company.logoUrl && currentCompany.logoUrl) {
        company = { ...company, logoUrl: currentCompany.logoUrl };
      }
      if (!company.companyName && currentCompany.name) {
        company = { ...company, companyName: currentCompany.name };
      }

      const html = buildProfessionalPayslipHtml(
        {
          ...slip,
          paymentMethod: slip.paymentMethod || "Electronic Funds Transfer (EFT)",
          generatedByName: slip.generatedByName || currentCompanyUser?.fullName || "HR & Payroll",
        },
        company
      );

      if (printTab) {
        printTab.document.open();
        printTab.document.write(html);
        printTab.document.close();
      } else {
        openDocumentPreview(html);
      }
    } catch (err) {
      console.error("Error preparing official printable payslip:", err);
      if (printTab) printTab.close();
      alert("Failed to prepare printable payslip. Please try again.");
    } finally {
      setPrintingSlipId(null);
    }
  };

  // Open single payslip modal for active employee
  const openPayslipModalForEmployee = (employee: CompanyUser) => {
    if (employee.isActive === false) {
      alert("Cannot generate payslip: This employee is deactivated/inactive.");
      return;
    }
    setSelectedUserId(employee.id);
    const scale = salaryScales.find(
      (s) => s.jobTitle.toLowerCase() === employee.jobTitle.toLowerCase() || s.department === employee.department
    );
    if (scale) {
      setBasicSalary(scale.midSalary || scale.minSalary);
      setHousingAllowance(scale.housingAllowance || 0);
      setTransportAllowance(scale.transportAllowance || 0);
      setMedicalAllowance(scale.medicalAllowance || 0);
    }
    setPayslipModalOpen(true);
  };

  // Generate single payslip (Strict active check)
  const handleGeneratePayslip = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = users.find((usr) => usr.id === selectedUserId) || activeEmployees[0];
    if (!u) {
      alert("Please select an employee.");
      return;
    }
    if (u.isActive === false) {
      alert("Error: Payroll and payslips can ONLY be generated for active employees.");
      return;
    }

    try {
      const slip = await generatePayslip({
        companyId: currentCompany.id,
        userId: u.userId,
        employeeName: u.fullName,
        jobTitle: u.jobTitle,
        department: u.department,
        payPeriod,
        basicSalary,
        allowances: {
          housing: housingAllowance,
          transport: transportAllowance,
          medical: medicalAllowance,
        },
        deductions: {
          paye_tax: (basicSalary + housingAllowance + transportAllowance) * 0.15,
          pension: basicSalary * 0.05,
          uif: Math.min(basicSalary * 0.01, 177.12),
        },
        generatedByName: currentCompanyUser.fullName,
      });

      setPayslipModalOpen(false);
      setPreviewPayslip(slip);
      loadData();
    } catch (err: any) {
      alert(err.message || "Failed to generate payslip.");
    }
  };

  // Past 6 months calculation for payslip generation
  const pastSixMonths = useMemo(() => {
    const months: string[] = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push(monthStr);
    }
    return months;
  }, []);

  // Contract creation modal opener
  const openCreateContractModal = (employee: CompanyUser) => {
    setCreateContractTarget(employee);
    setNewContractIsPermanent(false);
    setNewContractStartDate(new Date().toISOString().slice(0, 10));
    const d = new Date();
    d.setMonth(d.getMonth() + 12);
    setNewContractEndDate(d.toISOString().slice(0, 10));
    const scale = salaryScales.find(
      (s) => s.jobTitle.toLowerCase() === employee.jobTitle.toLowerCase() || s.department === employee.department
    );
    setNewContractSalary(scale?.midSalary || scale?.minSalary || 15000);
    setNewContractLeaveDays(21);
  };

  // Contract creation submit
  const handleCreateContractSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createContractTarget) return;
    setCreatingContract(true);
    try {
      await createEmployeeContract({
        companyId: currentCompany.id,
        userId: createContractTarget.userId || createContractTarget.id,
        employeeName: createContractTarget.fullName,
        department: createContractTarget.department,
        jobTitle: createContractTarget.jobTitle,
        startDate: newContractStartDate,
        endDate: newContractIsPermanent ? undefined : newContractEndDate,
        isPermanent: newContractIsPermanent,
        monthlySalary: newContractSalary,
        leaveDaysPerYear: newContractLeaveDays,
      });
      setCreateContractTarget(null);
      await loadData();
      alert(`Contract created successfully for ${createContractTarget.fullName}!`);
    } catch (err: any) {
      alert(err.message || "Failed to create contract.");
    } finally {
      setCreatingContract(false);
    }
  };

  // Add staff modal opener
  const openAddStaffModal = async () => {
    setStaffFullName("");
    setStaffEmail("");
    setStaffDepartment("front_desk");
    setStaffJobTitle("Front Desk - Receptionist");
    setStaffRoleLevel("staff");
    setStaffSendInvite(true);
    setStaffError(null);
    setStaffSuccess(null);
    setAddStaffModalOpen(true);
    try {
      const roles = await fetchCustomRoleDefinitions(currentCompany.id);
      setCustomRoles(roles);
    } catch {}
  };

  // Add staff modal submit
  const handleCreateStaffSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffSaving(true);
    setStaffError(null);
    setStaffSuccess(null);
    try {
      const newUser = await createCompanyUser({
        companyId: currentCompany.id,
        email: staffEmail.trim().toLowerCase(),
        fullName: staffFullName.trim(),
        roleLevel: staffRoleLevel,
        department: staffDepartment,
        jobTitle: staffJobTitle,
      });

      if (staffSendInvite) {
        try {
          await sendStaffInvitation({
            company: currentCompany,
            targetUser: {
              fullName: staffFullName.trim(),
              email: staffEmail.trim().toLowerCase(),
              department: staffDepartment,
              jobTitle: staffJobTitle,
            },
            inviter: {
              fullName: currentCompanyUser?.fullName || "HR Manager",
              jobTitle: currentCompanyUser?.jobTitle || "HR & Payroll Administration",
            },
          });
        } catch (e) {
          console.warn("Could not send email invite automatically", e);
        }
      }

      setStaffSuccess(`Successfully added ${staffFullName} as ${staffJobTitle}!`);
      await loadData();
      setTimeout(() => {
        setAddStaffModalOpen(false);
      }, 1000);
    } catch (err: any) {
      setStaffError(err.message || "Failed to add staff member.");
    } finally {
      setStaffSaving(false);
    }
  };

  // Open multi-month payslip suite (optionally preselected for a single employee)
  const openBatchGenerator = (preselectedUserId?: string) => {
    if (preselectedUserId) {
      setBatchSelectedEmployeeIds([preselectedUserId]);
    } else {
      setBatchSelectedEmployeeIds(activeEmployees.map((e) => e.id));
    }
    setBatchSelectedMonths([pastSixMonths[0]]);
    setBatchDrafts([]);
    setBatchStep("select");
    setBatchResultMsg(null);
    setBatchGeneratorModalOpen(true);
  };

  // Generate batch drafts with strict tenure verification
  const handleGenerateBatchDrafts = () => {
    if (batchSelectedEmployeeIds.length === 0) {
      alert("Please select at least one employee.");
      return;
    }
    if (batchSelectedMonths.length === 0) {
      alert("Please select at least one month.");
      return;
    }
    if (batchSelectedMonths.length > 6) {
      alert("Maximum of 6 months can be selected per generation run.");
      return;
    }

    const drafts: typeof batchDrafts = [];

    for (const empId of batchSelectedEmployeeIds) {
      const emp = users.find((u) => u.id === empId);
      if (!emp) continue;

      // Determine joining month boundary from createdAt (e.g., "2026-08")
      const joinMonth = emp.createdAt ? emp.createdAt.slice(0, 7) : "2020-01";

      const scale = salaryScales.find(
        (s) => s.jobTitle.toLowerCase() === emp.jobTitle.toLowerCase() || s.department === emp.department
      );
      const bSalary = scale?.midSalary || scale?.minSalary || 15000;
      const allowances = {
        housing: scale?.housingAllowance || 1500,
        transport: scale?.transportAllowance || 1000,
        medical: scale?.medicalAllowance || 800,
      };
      const gross = bSalary + allowances.housing + allowances.transport + allowances.medical;
      const deductions = {
        paye_tax: gross * 0.15,
        pension: bSalary * 0.05,
        uif: Math.min(bSalary * 0.01, 177.12),
      };
      const net = gross - (deductions.paye_tax + deductions.pension + deductions.uif);

      for (const m of batchSelectedMonths) {
        // Tenure check: cannot generate payslips before person was hired / joined
        const isEligible = m >= joinMonth;
        const ineligibleReason = !isEligible
          ? `Joined in ${joinMonth} (Before tenure start)`
          : undefined;

        drafts.push({
          id: `${emp.id}-${m}`,
          user: emp,
          month: m,
          basicSalary: bSalary,
          allowances,
          deductions,
          grossPay: gross,
          netPay: net,
          eligible: isEligible,
          ineligibleReason,
          selectedForDispatch: isEligible,
        });
      }
    }

    setBatchDrafts(drafts);
    setBatchStep("review");
  };

  // Dispatch batch payslips via email (single employee or all selected)
  const handleDispatchBatchEmails = async (targetEmployeeId?: string) => {
    const eligibleSelected = batchDrafts.filter(
      (d) => d.eligible && d.selectedForDispatch && (targetEmployeeId ? d.user.id === targetEmployeeId : true)
    );

    if (eligibleSelected.length === 0) {
      alert("No eligible payslips selected for email dispatch.");
      return;
    }

    setBatchSending(true);
    setBatchResultMsg(null);

    // Group by employee
    const groupedByUser = new Map<string, typeof eligibleSelected>();
    for (const d of eligibleSelected) {
      const list = groupedByUser.get(d.user.id) || [];
      list.push(d);
      groupedByUser.set(d.user.id, list);
    }

    const userEntries = Array.from(groupedByUser.entries());
    setBatchSendProgress({ current: 0, total: userEntries.length });

    let sentUsersCount = 0;
    let failedUsersCount = 0;

    for (let i = 0; i < userEntries.length; i++) {
      const [, userDrafts] = userEntries[i];
      const emp = userDrafts[0].user;

      // Cap to at most 6 payslips per employee email
      const cappedDrafts = userDrafts.slice(0, 6);
      const createdSlips: Payslip[] = [];

      for (const draft of cappedDrafts) {
        try {
          const slip = await generatePayslip({
            companyId: currentCompany.id,
            userId: emp.userId || emp.id,
            employeeName: emp.fullName,
            jobTitle: emp.jobTitle,
            department: emp.department,
            payPeriod: draft.month,
            basicSalary: draft.basicSalary,
            allowances: draft.allowances,
            deductions: draft.deductions,
            generatedByName: currentCompanyUser?.fullName || "HR & Payroll",
          });
          createdSlips.push(slip);
        } catch (e) {
          console.error("Error generating slip for", emp.fullName, draft.month, e);
        }
      }

      if (createdSlips.length > 0 && emp.email) {
        const sendResult = await sendPayslipEmailViaApi({
          employeeEmail: emp.email,
          employeeName: emp.fullName,
          company: currentCompany,
          payslips: createdSlips,
          senderName: currentCompanyUser?.fullName || "HR & Payroll",
        });

        if (sendResult.success) {
          sentUsersCount++;
          setBatchDrafts((prev) =>
            prev.map((d) => (d.user.id === emp.id ? { ...d, emailSent: true } : d))
          );
        } else {
          failedUsersCount++;
        }
      }

      setBatchSendProgress({ current: i + 1, total: userEntries.length });
    }

    setBatchSending(false);
    setBatchResultMsg(
      `Batch Dispatch Complete: Successfully dispatched email(s) to ${sentUsersCount} employee(s) with separate payslip attachments.${
        failedUsersCount > 0 ? ` (${failedUsersCount} failed)` : ""
      }`
    );
    await loadData();
  };

  // Deactivate employee confirmation
  const handleConfirmDeactivation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deactivatingEmployee) return;

    await deactivateEmployeeUser(
      deactivatingEmployee.id,
      deactivationReason,
      deactivationNotes,
      deactivationEffectiveDate
    );

    setDeactivatingEmployee(null);
    setDeactivationNotes("");
    if (selectedEmployee?.id === deactivatingEmployee.id) {
      setSelectedEmployee({
        ...selectedEmployee,
        isActive: false,
        deactivationReason,
        deactivationDate: deactivationEffectiveDate,
        deactivationNotes,
      });
    }
    await loadData();
  };

  // Reactivate employee
  const handleReactivateEmployee = async (employee: CompanyUser) => {
    if (!confirm(`Reactivate ${employee.fullName}? They will become eligible for payroll and system access again.`)) {
      return;
    }
    await reactivateEmployeeUser(employee.id);
    if (selectedEmployee?.id === employee.id) {
      setSelectedEmployee({
        ...selectedEmployee,
        isActive: true,
        deactivationReason: undefined,
        deactivationDate: undefined,
        deactivationNotes: undefined,
      });
    }
    await loadData();
  };

  // Open contract extension modal
  const openExtendContractModal = (contract: EmployeeContract) => {
    setExtendingContract(contract);
    // Default to +6 months from current end date or today
    const baseDate = contract.endDate ? new Date(contract.endDate) : new Date();
    baseDate.setMonth(baseDate.getMonth() + 6);
    setExtensionEndDate(baseDate.toISOString().slice(0, 10));
    setExtensionSalary(contract.monthlySalary);
    setExtensionNotes("");
  };

  // Submit contract extension
  const handleConfirmExtension = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendingContract) return;

    await extendEmployeeContract(
      extendingContract.id,
      extensionEndDate,
      currentCompanyUser.fullName,
      extensionSalary,
      extensionNotes
    );

    setExtendingContract(null);
    await loadData();
  };

  // Open contract immediate termination modal
  const openTerminateContractModal = (contract: EmployeeContract) => {
    setTerminatingContract(contract);
    setContractTerminationReason("Contract ended immediately by HR review");
    setDeactivateEmployeeOnContractEnd(true);
  };

  // Submit contract immediate termination
  const handleConfirmContractTermination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminatingContract) return;

    await terminateEmployeeContract(
      terminatingContract.id,
      currentCompanyUser.fullName,
      contractTerminationReason,
      deactivateEmployeeOnContractEnd
    );

    setTerminatingContract(null);
    await loadData();
  };

  // Leave submission
  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const d1 = new Date(leaveStartDate);
    const d2 = new Date(leaveEndDate);
    const days = Math.max(Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24)) + 1, 1);

    await requestLeave({
      companyId: currentCompany.id,
      userId: currentCompanyUser.userId,
      employeeName: currentCompanyUser.fullName,
      department: currentCompanyUser.department,
      leaveType,
      startDate: leaveStartDate,
      endDate: leaveEndDate,
      daysCount: days,
      reason: leaveReason,
    });

    setLeaveModalOpen(false);
    loadData();
  };

  const handleLeaveApproval = async (id: string, status: "approved" | "rejected") => {
    await updateLeaveStatus(id, status, currentCompanyUser.fullName);
    loadData();
  };

  // Distinct pay periods from payslips
  const availablePeriods = useMemo(() => {
    const periods = Array.from(new Set(payslips.map((p) => p.payPeriod))).filter(Boolean);
    return periods.sort().reverse();
  }, [payslips]);

  // Filtered employees for directory
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch =
        directorySearch === "" ||
        u.fullName.toLowerCase().includes(directorySearch.toLowerCase()) ||
        u.email.toLowerCase().includes(directorySearch.toLowerCase()) ||
        u.jobTitle.toLowerCase().includes(directorySearch.toLowerCase());
      const matchesDept = directoryDept === "all" || u.department === directoryDept;
      const matchesStatus =
        directoryStatusFilter === "all" ||
        (directoryStatusFilter === "active" && u.isActive !== false) ||
        (directoryStatusFilter === "inactive" && u.isActive === false);
      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [users, directorySearch, directoryDept, directoryStatusFilter]);

  // Helper for contract countdown
  const getContractCountdown = (c: EmployeeContract) => {
    if (c.isPermanent || !c.endDate) {
      return { isPermanent: true, daysRemaining: 9999, label: "Permanent Tenure", colorClass: "bg-blue-500/10 text-blue-600 border-blue-500/20" };
    }
    const end = new Date(c.endDate);
    const now = new Date();
    // Normalize to dates
    const diffTime = end.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (daysRemaining < 0) {
      return {
        isPermanent: false,
        daysRemaining,
        label: `Expired ${Math.abs(daysRemaining)} days ago`,
        colorClass: "bg-red-500/10 text-red-600 border-red-500/30 font-extrabold",
        urgency: "expired",
      };
    }
    if (daysRemaining === 0) {
      return {
        isPermanent: false,
        daysRemaining,
        label: "Expires Today",
        colorClass: "bg-red-600 text-white animate-pulse font-extrabold",
        urgency: "critical",
      };
    }
    if (daysRemaining <= 14) {
      return {
        isPermanent: false,
        daysRemaining,
        label: `⚠️ Critical: ${daysRemaining} days left`,
        colorClass: "bg-red-500/15 text-red-600 border-red-500/30 font-bold",
        urgency: "critical",
      };
    }
    if (daysRemaining <= 30) {
      return {
        isPermanent: false,
        daysRemaining,
        label: `⏳ Expiring: ${daysRemaining} days left`,
        colorClass: "bg-amber-500/15 text-amber-600 border-amber-500/30 font-bold",
        urgency: "warning",
      };
    }
    if (daysRemaining <= 60) {
      return {
        isPermanent: false,
        daysRemaining,
        label: `📅 ${daysRemaining} days left (~2 mos)`,
        colorClass: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
        urgency: "moderate",
      };
    }
    return {
      isPermanent: false,
      daysRemaining,
      label: `✓ ${daysRemaining} days left`,
      colorClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
      urgency: "good",
    };
  };

  // Expiring contracts filtered by custom duration
  const expiringContractsList = useMemo(() => {
    return contracts
      .filter((c) => {
        if (c.isPermanent || !c.endDate || c.status === "terminated" || c.status === "expired") {
          return false;
        }
        const countdown = getContractCountdown(c);
        // Expired or expiring within selected duration
        return countdown.daysRemaining <= expiringDurationDays;
      })
      .sort((a, b) => {
        const da = a.endDate ? new Date(a.endDate).getTime() : 0;
        const db = b.endDate ? new Date(b.endDate).getTime() : 0;
        return da - db;
      });
  }, [contracts, expiringDurationDays]);

  // Filtered payslips for payroll view
  const filteredPayslips = useMemo(() => {
    return payslips.filter((p) => {
      const matchesSearch =
        payslipSearch === "" ||
        p.employeeName.toLowerCase().includes(payslipSearch.toLowerCase()) ||
        p.jobTitle.toLowerCase().includes(payslipSearch.toLowerCase());
      const matchesPeriod = payslipPeriodFilter === "all" || p.payPeriod === payslipPeriodFilter;
      return matchesSearch && matchesPeriod;
    });
  }, [payslips, payslipSearch, payslipPeriodFilter]);

  // Historical payslips grouped/filtered
  const historicalPayslips = useMemo(() => {
    return payslips.filter((p) => {
      return historyPeriodFilter === "all" || p.payPeriod === historyPeriodFilter;
    });
  }, [payslips, historyPeriodFilter]);

  // Payroll KPI statistics
  const payrollMetrics = useMemo(() => {
    const totalGross = payslips.reduce((sum, p) => sum + (p.grossPay || 0), 0);
    const totalNet = payslips.reduce((sum, p) => sum + (p.netPay || 0), 0);
    const totalDeductions = totalGross - totalNet;
    const count = payslips.length;
    return { totalGross, totalNet, totalDeductions, count };
  }, [payslips]);

  // Historical period metrics
  const historyPeriodMetrics = useMemo(() => {
    const totalDisbursed = historicalPayslips.reduce((sum, p) => sum + (p.netPay || 0), 0);
    const totalGross = historicalPayslips.reduce((sum, p) => sum + (p.grossPay || 0), 0);
    const count = historicalPayslips.length;
    return { totalDisbursed, totalGross, count };
  }, [historicalPayslips]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              Human Resources & Payroll Administration
            </h1>
            <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-bold text-blue-600">
              {activeEmployees.length} Active / {users.length} Total Personnel
            </span>
          </div>
          <p className="text-sm text-muted">
            Manage personnel directory, contract countdowns & extensions, mass payroll runs, payslips, and staff lifecycle.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setLeaveModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-elevated transition-colors shadow-sm"
          >
            <Calendar size={15} />
            <span>Request Leave</span>
          </button>

          {(isAdmin || isManager) && (
            <>
              <button
                type="button"
                onClick={openAddStaffModal}
                className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface-elevated px-3.5 py-2 text-xs font-bold text-foreground shadow-sm hover:border-blue-500 hover:text-blue-600 transition"
                title="Add and onboard a new company staff member"
              >
                <UserPlus size={15} />
                <span>Add Staff Member</span>
              </button>

              <Link
                to="/organogram"
                className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface-elevated px-3.5 py-2 text-xs font-bold text-foreground shadow-sm hover:border-blue-500 hover:text-blue-600 transition"
                title="Manage company job titles, role hierarchy & organogram"
              >
                <Network size={15} />
                <span>Roles & Organogram</span>
              </Link>

              <button
                type="button"
                onClick={() => openBatchGenerator()}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:from-blue-700 hover:to-indigo-700 transition"
                title="Generate, review and dispatch single or multi-month payslips"
              >
                <FileText size={15} />
                <span>Generate & Review Payslips</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border-color pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("directory")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === "directory"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-muted hover:bg-surface-elevated hover:text-foreground"
          }`}
        >
          <Users size={16} />
          Employees Directory ({users.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("expiring")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === "expiring"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-muted hover:bg-surface-elevated hover:text-foreground"
          }`}
        >
          <Hourglass size={16} />
          <span>Expiring Contracts</span>
          {expiringContractsList.length > 0 && (
            <span className="rounded-full bg-red-500 px-2 py-0.2 text-[10px] font-extrabold text-white">
              {expiringContractsList.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("contracts")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === "contracts"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-muted hover:bg-surface-elevated hover:text-foreground"
          }`}
        >
          <FileSignature size={16} />
          All Contracts ({contracts.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("payslips")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === "payslips"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-muted hover:bg-surface-elevated hover:text-foreground"
          }`}
        >
          <DollarSign size={16} />
          Payslips & Payroll ({payslips.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === "history"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-muted hover:bg-surface-elevated hover:text-foreground"
          }`}
        >
          <History size={16} />
          Salary History ({availablePeriods.length} Runs)
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("salaries")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === "salaries"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-muted hover:bg-surface-elevated hover:text-foreground"
          }`}
        >
          <BadgePercent size={16} />
          Salary Scales ({salaryScales.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("leave")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === "leave"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-muted hover:bg-surface-elevated hover:text-foreground"
          }`}
        >
          <Clock size={16} />
          Leave Tracking ({leaveRecords.length})
        </button>
      </div>

      {/* TAB 1: EMPLOYEE DIRECTORY (WITH DEACTIVATION & STATUS FILTER) */}
      {activeTab === "directory" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-surface p-4 rounded-2xl border border-border-color shadow-sm">
            <div className="flex flex-1 flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-[240px] max-w-md">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Search by employee name, email or job title..."
                  value={directorySearch}
                  onChange={(e) => setDirectorySearch(e.target.value)}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <Filter size={14} className="text-muted" />
                <select
                  value={directoryDept}
                  onChange={(e) => setDirectoryDept(e.target.value)}
                  className="rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs font-semibold text-foreground focus:border-blue-600 focus:outline-none capitalize"
                >
                  <option value="all">All Departments</option>
                  <option value="front_desk">Front Desk</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="accountant">Finance & Accounting</option>
                  <option value="human_resources">Human Resources</option>
                  <option value="it">Information Technology</option>
                  <option value="manager">Management</option>
                  <option value="admin">Administration</option>
                </select>

                <select
                  value={directoryStatusFilter}
                  onChange={(e) => setDirectoryStatusFilter(e.target.value as any)}
                  className="rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs font-semibold text-foreground focus:border-blue-600 focus:outline-none"
                >
                  <option value="all">All Statuses ({users.length})</option>
                  <option value="active">Active Staff Only ({activeEmployees.length})</option>
                  <option value="inactive">Deactivated Only ({inactiveEmployees.length})</option>
                </select>
              </div>
            </div>

            <div className="text-xs font-semibold text-muted">
              Showing <span className="text-foreground">{filteredUsers.length}</span> of {users.length} personnel
            </div>
          </div>

          {/* List Table */}
          <div className="rounded-2xl border border-border-color bg-surface overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border-color bg-surface-elevated/70 text-[11px] font-bold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-4">Employee</th>
                  <th className="px-5 py-4">Department & Role</th>
                  <th className="px-5 py-4">Contract / Tenure</th>
                  <th className="px-5 py-4">Status & Reason</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color text-foreground">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-muted">
                      No employees match your search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isActive = u.isActive !== false;
                    const contract = contracts.find((c) => c.userId === u.userId || c.userId === u.id);
                    const countdown = contract ? getContractCountdown(contract) : null;

                    return (
                      <tr
                        key={u.id}
                        onClick={() => setSelectedEmployee(u)}
                        className={`cursor-pointer transition-colors group ${
                          isActive
                            ? "hover:bg-surface-elevated/60"
                            : "bg-surface-elevated/20 opacity-80 hover:bg-surface-elevated/50"
                        }`}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold text-sm shadow-inner transition-colors ${
                                isActive
                                  ? "bg-blue-600/10 text-blue-600 group-hover:bg-blue-600 group-hover:text-white"
                                  : "bg-red-500/10 text-red-500"
                              }`}
                            >
                              {u.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-foreground group-hover:text-blue-600 transition-colors">
                                  {u.fullName}
                                </p>
                                {!isActive && (
                                  <span className="rounded bg-red-500/10 px-1.5 py-0.2 text-[9px] font-extrabold text-red-600 uppercase">
                                    Deactivated
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-muted">{u.email}</p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-semibold text-foreground text-xs">{u.jobTitle}</p>
                          <span className="text-[11px] text-muted capitalize">
                            {u.department.replace(/_/g, " ")} · {u.roleLevel.replace(/_/g, " ")}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-xs">
                          {contract ? (
                            <div>
                              <span
                                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                                  countdown?.colorClass
                                }`}
                              >
                                {countdown?.label}
                              </span>
                              <p className="text-[10px] text-muted mt-0.5">
                                {contract.isPermanent
                                  ? "Permanent Indefinite"
                                  : `Term: ${contract.startDate} → ${contract.endDate}`}
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted text-xs italic">Standard Staff Agreement</span>
                          )}
                        </td>

                        <td className="px-5 py-4">
                          {isActive ? (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Active Personnel
                            </span>
                          ) : (
                            <div>
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 border border-red-500/20 px-2 py-0.5 text-[10px] font-bold text-red-600 uppercase">
                                {u.deactivationReason?.replace(/_/g, " ") || "Deactivated"}
                              </span>
                              {u.deactivationDate && (
                                <p className="text-[10px] text-muted mt-0.5">Effective: {u.deactivationDate}</p>
                              )}
                            </div>
                          )}
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEmployee(u);
                              }}
                              className="rounded-lg border border-border-color bg-surface-elevated px-2.5 py-1 text-xs font-semibold text-muted hover:text-foreground hover:border-blue-500 transition-colors"
                            >
                              Profile
                            </button>

                            {(isAdmin || isManager) && (
                              <>
                                {isActive ? (
                                  <>
                                    {contract ? (
                                      <>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openExtendContractModal(contract);
                                          }}
                                          className="rounded-lg border border-border-color bg-surface-elevated px-2 py-1 text-xs font-semibold text-foreground hover:border-blue-500 hover:text-blue-600 transition-colors"
                                          title="Extend / Renew employee contract"
                                        >
                                          Renew
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            openTerminateContractModal(contract);
                                          }}
                                          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400 hover:bg-amber-600 hover:text-white transition-colors"
                                          title="End / Terminate contract agreement"
                                        >
                                          End
                                        </button>
                                      </>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openCreateContractModal(u);
                                        }}
                                        className="rounded-lg border border-border-color bg-surface-elevated px-2 py-1 text-xs font-semibold text-foreground hover:border-blue-500 hover:text-blue-600 transition-colors"
                                        title="Issue new employee contract"
                                      >
                                        + Contract
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openBatchGenerator(u.id);
                                      }}
                                      className="rounded-lg bg-blue-600/10 px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-600 hover:text-white transition-colors"
                                      title="Generate & Review payslip(s) for this employee"
                                    >
                                      Issue Slip
                                    </button>

                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setDeactivatingEmployee(u);
                                        setDeactivationReason("resigned");
                                        setDeactivationNotes("");
                                      }}
                                      className="rounded-lg border border-red-500/30 bg-red-500/5 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-600 hover:text-white transition-colors"
                                      title="Deactivate employee with official reason"
                                    >
                                      Deactivate
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleReactivateEmployee(u);
                                    }}
                                    className="flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 hover:bg-emerald-600 hover:text-white transition-colors"
                                  >
                                    <RotateCcw size={12} />
                                    <span>Reactivate</span>
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: EXPIRING CONTRACTS (CUSTOM DURATION & COUNTDOWN) */}
      {activeTab === "expiring" && (
        <div className="space-y-6">
          {/* Duration Selector Bar */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-surface p-5 rounded-2xl border border-border-color shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-bold text-red-600 uppercase">
                  HR Contract Review Alert
                </span>
                <span className="text-xs text-muted">Fixed-term expirations countdown</span>
              </div>
              <h2 className="text-xl font-black text-foreground mt-1">
                Contracts Expiring within {expiringDurationDays} Days ({expiringContractsList.length})
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Extend contracts with customized terms or end agreements immediately with automatic directory deactivation.
              </p>
            </div>

            {/* Custom Duration Selector */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-muted mr-1">Review Horizon:</span>
              {[7, 14, 30, 60, 90].map((days) => (
                <button
                  key={days}
                  type="button"
                  onClick={() => {
                    setExpiringDurationDays(days);
                    setIsCustomExpiringDuration(false);
                  }}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                    expiringDurationDays === days && !isCustomExpiringDuration
                      ? "bg-blue-600 text-white shadow"
                      : "border border-border-color bg-surface-elevated text-muted hover:text-foreground"
                  }`}
                >
                  {days} Days
                </button>
              ))}

              <div className="flex items-center gap-1.5 pl-2 border-l border-border-color">
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={expiringDurationDays}
                  onChange={(e) => {
                    setExpiringDurationDays(Math.max(1, Number(e.target.value)));
                    setIsCustomExpiringDuration(true);
                  }}
                  className="w-16 rounded-lg border border-border-color bg-surface-elevated px-2 py-1 text-xs text-foreground font-bold text-center focus:border-blue-600 focus:outline-none"
                />
                <span className="text-xs font-semibold text-muted">Custom Days</span>
              </div>
            </div>
          </div>

          {/* Expiring Contracts Table */}
          <div className="rounded-2xl border border-border-color bg-surface overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border-color bg-surface-elevated/70 text-[11px] font-bold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-4">Employee</th>
                  <th className="px-5 py-4">Position & Dept</th>
                  <th className="px-5 py-4">Contract Period</th>
                  <th className="px-5 py-4">Countdown Remaining</th>
                  <th className="px-5 py-4">Monthly Salary</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color text-foreground">
                {expiringContractsList.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <CheckCircle2 size={32} className="text-emerald-500" />
                        <p className="font-bold text-foreground">No contracts expiring within {expiringDurationDays} days.</p>
                        <p className="text-xs text-muted">All active staff contracts are within valid compliance periods.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  expiringContractsList.map((c) => {
                    const countdown = getContractCountdown(c);
                    return (
                      <tr key={c.id} className="hover:bg-surface-elevated/40 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 font-bold text-sm">
                              {c.employeeName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-foreground">{c.employeeName}</p>
                              <p className="text-[11px] font-mono text-muted">Ref #{c.id.slice(0, 8)}</p>
                            </div>
                          </div>
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-semibold text-foreground text-xs">{c.jobTitle}</p>
                          <span className="text-[11px] text-muted capitalize">
                            {c.department.replace(/_/g, " ")}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-xs font-mono">
                          <p className="text-muted">Start: {c.startDate}</p>
                          <p className="font-bold text-foreground">End: {c.endDate || "N/A"}</p>
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-extrabold ${countdown.colorClass}`}
                          >
                            <Timer size={13} />
                            <span>{countdown.label}</span>
                          </span>
                        </td>

                        <td className="px-5 py-4 font-bold text-foreground text-xs">
                          R{c.monthlySalary.toLocaleString()} /mo
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => openExtendContractModal(c)}
                              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
                            >
                              <RefreshCw size={13} />
                              <span>Extend</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => openTerminateContractModal(c)}
                              className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-600 hover:text-white transition"
                            >
                              <XCircle size={13} />
                              <span>End Now</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ALL CONTRACTS */}
      {activeTab === "contracts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-surface p-4 rounded-2xl border border-border-color shadow-sm">
            <div>
              <h3 className="font-bold text-foreground">Organization Employee Agreements</h3>
              <p className="text-xs text-muted">Fixed-term and permanent contracts with live tenure tracking.</p>
            </div>
            <span className="text-xs font-semibold text-muted">
              {contracts.filter((c) => c.isPermanent).length} Permanent ·{" "}
              {contracts.filter((c) => !c.isPermanent).length} Fixed-Term
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {contracts.map((c) => {
              const countdown = getContractCountdown(c);
              const isTerminated = c.status === "terminated" || c.status === "expired";

              return (
                <div key={c.id} className="rounded-2xl border border-border-color bg-surface p-5 shadow-sm space-y-3">
                  <div className="flex items-start justify-between border-b border-border-color pb-2">
                    <div>
                      <h3 className="font-bold text-foreground text-sm">{c.employeeName}</h3>
                      <p className="text-xs text-muted">{c.jobTitle} ({c.department})</p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${countdown.colorClass}`}
                    >
                      {countdown.label}
                    </span>
                  </div>

                  <div className="text-xs space-y-1.5 text-muted">
                    <div className="flex justify-between">
                      <span>Tenure Type:</span>
                      <span className="font-bold text-foreground">
                        {c.isPermanent ? "Permanent Indefinite" : "Fixed-Term Contract"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Commenced:</span>
                      <span className="font-mono text-foreground">{c.startDate}</span>
                    </div>
                    {!c.isPermanent && (
                      <div className="flex justify-between">
                        <span>Expiration Date:</span>
                        <span className="font-mono font-bold text-foreground">{c.endDate}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Monthly Compensation:</span>
                      <span className="font-bold text-emerald-600">R{c.monthlySalary.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Leave Allowance:</span>
                      <span className="text-foreground">{c.leaveDaysPerYear} Days/Year</span>
                    </div>
                  </div>

                  {c.extensionHistory && c.extensionHistory.length > 0 && (
                    <div className="rounded-lg bg-surface-elevated p-2 text-[11px] text-muted space-y-1">
                      <p className="font-bold text-foreground text-[10px] uppercase tracking-wider">
                        Renewal History ({c.extensionHistory.length})
                      </p>
                      {c.extensionHistory.map((h, i) => (
                        <p key={i}>
                          Extended to <b className="text-blue-600">{h.newEndDate}</b> by {h.extendedByName}
                        </p>
                      ))}
                    </div>
                  )}

                  {!isTerminated && !c.isPermanent && (
                    <div className="pt-2 flex items-center justify-end gap-2 border-t border-border-color">
                      <button
                        type="button"
                        onClick={() => openExtendContractModal(c)}
                        className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                      >
                        <RefreshCw size={12} />
                        <span>Extend Contract</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => openTerminateContractModal(c)}
                        className="flex items-center gap-1 text-xs font-bold text-red-600 hover:underline ml-2"
                      >
                        <XCircle size={12} />
                        <span>End Immediately</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: PAYSLIPS & PAYROLL (ACTIVE PERSONNEL ONLY) */}
      {activeTab === "payslips" && (
        <div className="space-y-6">
          {/* Payroll KPI Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-border-color bg-surface p-5 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-muted">
                <span className="text-xs font-bold uppercase tracking-wider">Total Net Disbursed</span>
                <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-600">
                  <CreditCard size={18} />
                </div>
              </div>
              <p className="text-2xl font-black text-emerald-600">
                R{payrollMetrics.totalNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-muted">Disbursed to active employee accounts</p>
            </div>

            <div className="rounded-2xl border border-border-color bg-surface p-5 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-muted">
                <span className="text-xs font-bold uppercase tracking-wider">Total Gross Remuneration</span>
                <div className="rounded-xl bg-blue-500/10 p-2 text-blue-600">
                  <DollarSign size={18} />
                </div>
              </div>
              <p className="text-2xl font-black text-foreground">
                R{payrollMetrics.totalGross.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-muted">Base salaries + allowances</p>
            </div>

            <div className="rounded-2xl border border-border-color bg-surface p-5 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-muted">
                <span className="text-xs font-bold uppercase tracking-wider">Statutory Deductions</span>
                <div className="rounded-xl bg-red-500/10 p-2 text-red-600">
                  <Receipt size={18} />
                </div>
              </div>
              <p className="text-2xl font-black text-red-600">
                R{payrollMetrics.totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-muted">PAYE tax, pension fund, UIF</p>
            </div>

            <div className="rounded-2xl border border-border-color bg-surface p-5 shadow-sm space-y-1">
              <div className="flex items-center justify-between text-muted">
                <span className="text-xs font-bold uppercase tracking-wider">Eligible Active Staff</span>
                <div className="rounded-xl bg-purple-500/10 p-2 text-purple-600">
                  <FileText size={18} />
                </div>
              </div>
              <p className="text-2xl font-black text-foreground">
                {activeEmployees.length} Staff
              </p>
              <p className="text-[11px] text-muted">
                {inactiveEmployees.length} Deactivated excluded
              </p>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-surface p-4 rounded-2xl border border-border-color shadow-sm">
            <div className="flex flex-1 items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Search payslip by employee or role..."
                  value={payslipSearch}
                  onChange={(e) => setPayslipSearch(e.target.value)}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated pl-9 pr-4 py-2 text-xs text-foreground placeholder:text-muted focus:border-blue-600 focus:outline-none"
                />
              </div>

              <select
                value={payslipPeriodFilter}
                onChange={(e) => setPayslipPeriodFilter(e.target.value)}
                className="rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs font-semibold text-foreground focus:border-blue-600 focus:outline-none"
              >
                <option value="all">All Pay Periods</option>
                {availablePeriods.map((p) => (
                  <option key={p} value={p}>
                    Period: {p}
                  </option>
                ))}
              </select>
            </div>

            {(isAdmin || isManager) && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openBatchGenerator()}
                  className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow hover:from-blue-700 hover:to-indigo-700 transition"
                >
                  <Sparkles size={14} />
                  <span>Batch & Mass Payroll Suite</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPayslipModalOpen(true)}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-blue-700 transition"
                >
                  <Plus size={14} />
                  <span>Single Payslip</span>
                </button>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="rounded-2xl border border-border-color bg-surface overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border-color bg-surface-elevated/70 text-[11px] font-bold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-4">Employee</th>
                  <th className="px-5 py-4">Period</th>
                  <th className="px-5 py-4">Basic Salary</th>
                  <th className="px-5 py-4">Gross Earnings</th>
                  <th className="px-5 py-4">Deductions</th>
                  <th className="px-5 py-4">Net Remuneration</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color text-foreground">
                {filteredPayslips.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted">
                      No payslips found for this period.
                    </td>
                  </tr>
                ) : (
                  filteredPayslips.map((p) => {
                    const totalDeductions = p.grossPay - p.netPay;
                    const isPrinting = printingSlipId === p.id;
                    return (
                      <tr key={p.id} className="hover:bg-surface-elevated/40 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 font-bold text-xs">
                              {p.employeeName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-foreground">{p.employeeName}</p>
                              <p className="text-xs text-muted capitalize">
                                {p.jobTitle} · {p.department.replace(/_/g, " ")}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-mono text-xs font-bold text-blue-600 bg-blue-500/10 px-2.5 py-1 rounded-lg">
                            {p.payPeriod}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs font-medium">R{p.basicSalary.toLocaleString()}</td>
                        <td className="px-5 py-4 font-semibold text-foreground text-xs">
                          R{p.grossPay.toLocaleString()}
                        </td>
                        <td className="px-5 py-4 text-xs font-semibold text-red-600">
                          -R{totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-5 py-4 font-black text-emerald-600 text-sm">
                          R{p.netPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-5 py-4">
                          <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600 uppercase">
                            {p.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handlePrintOfficialPayslip(p)}
                              disabled={isPrinting}
                              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition"
                              title="Print branded payslip with company logo in a new tab"
                            >
                              <Printer size={13} />
                              <span>{isPrinting ? "Opening..." : "Print"}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setPreviewPayslip(p)}
                              className="rounded-lg border border-border-color bg-surface-elevated px-2.5 py-1.5 text-xs font-semibold text-muted hover:text-foreground transition"
                            >
                              <Eye size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: SALARY HISTORY */}
      {activeTab === "history" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setHistoryPeriodFilter("all")}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition ${
                historyPeriodFilter === "all"
                  ? "bg-blue-600 text-white shadow"
                  : "border border-border-color bg-surface text-muted hover:bg-surface-elevated hover:text-foreground"
              }`}
            >
              All Past Periods ({payslips.length} Slips)
            </button>
            {availablePeriods.map((period) => {
              const count = payslips.filter((p) => p.payPeriod === period).length;
              return (
                <button
                  key={period}
                  type="button"
                  onClick={() => setHistoryPeriodFilter(period)}
                  className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 ${
                    historyPeriodFilter === period
                      ? "bg-blue-600 text-white shadow"
                      : "border border-border-color bg-surface text-muted hover:bg-surface-elevated hover:text-foreground"
                  }`}
                >
                  <Calendar size={13} />
                  <span>Month: {period}</span>
                  <span className="ml-1 rounded-full bg-black/10 dark:bg-white/10 px-1.5 py-0.2 text-[10px]">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl border border-border-color bg-surface p-6 shadow-sm flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600 uppercase">
                  Audit Completed & Disbursed
                </span>
                <span className="text-xs text-muted">
                  {historyPeriodFilter === "all" ? "All Historical Runs" : `Period ${historyPeriodFilter}`}
                </span>
              </div>
              <h2 className="text-xl font-black text-foreground mt-1">
                {historyPeriodFilter === "all"
                  ? "Historical Salary Payments & Disbursements"
                  : `Salary Disbursements — ${historyPeriodFilter}`}
              </h2>
              <p className="text-xs text-muted mt-0.5">
                Every past transaction below includes official branded payslips with authorized signatures available for immediate print or PDF export.
              </p>
            </div>

            <div className="flex items-center gap-6 border-t sm:border-t-0 sm:border-l border-border-color pt-4 sm:pt-0 sm:pl-6">
              <div>
                <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
                  Net Disbursed
                </span>
                <span className="text-xl font-black text-emerald-600">
                  R{historyPeriodMetrics.totalDisbursed.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div>
                <span className="text-[11px] font-bold text-muted uppercase tracking-wider block">
                  Recipients Paid
                </span>
                <span className="text-xl font-black text-foreground">
                  {historyPeriodMetrics.count} Staff
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border-color bg-surface overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border-color bg-surface-elevated/70 text-[11px] font-bold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-4">Transaction / Ref</th>
                  <th className="px-5 py-4">Employee</th>
                  <th className="px-5 py-4">Pay Period</th>
                  <th className="px-5 py-4">Payment Method</th>
                  <th className="px-5 py-4">Gross Earnings</th>
                  <th className="px-5 py-4">Deductions</th>
                  <th className="px-5 py-4">Net Salary Paid</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Official Payslip</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color text-foreground">
                {historicalPayslips.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-muted">
                      No past salary transactions found for this period.
                    </td>
                  </tr>
                ) : (
                  historicalPayslips.map((p) => {
                    const totalDeductions = p.grossPay - p.netPay;
                    const isPrinting = printingSlipId === p.id;
                    return (
                      <tr key={p.id} className="hover:bg-surface-elevated/40 transition-colors">
                        <td className="px-5 py-4 font-mono text-xs">
                          <p className="font-bold text-foreground">#{p.id.slice(0, 8).toUpperCase()}</p>
                          <p className="text-[10px] text-muted">
                            {p.paidAt ? new Date(p.paidAt).toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" }) : "Disbursed"}
                          </p>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600 font-bold text-xs">
                              {p.employeeName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-foreground text-xs">{p.employeeName}</p>
                              <p className="text-[11px] text-muted capitalize">{p.jobTitle}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="font-mono text-xs font-bold text-blue-600 bg-blue-500/10 px-2 py-0.5 rounded">
                            {p.payPeriod}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs capitalize text-muted">
                          {p.paymentMethod.replace(/_/g, " ")}
                        </td>
                        <td className="px-5 py-4 text-xs font-semibold text-foreground">
                          R{p.grossPay.toLocaleString()}
                        </td>
                        <td className="px-5 py-4 text-xs font-semibold text-red-600">
                          -R{totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-5 py-4 font-black text-emerald-600 text-sm">
                          R{p.netPay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="px-5 py-4">
                          <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 uppercase">
                            {p.status}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <button
                            type="button"
                            onClick={() => handlePrintOfficialPayslip(p)}
                            disabled={isPrinting}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition"
                          >
                            <Printer size={13} />
                            <span>{isPrinting ? "Opening..." : "Print Payslip"}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 6: SALARY SCALES */}
      {activeTab === "salaries" && (
        <div className="rounded-2xl border border-border-color bg-surface overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-color bg-surface-elevated/70 text-[11px] font-bold uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-4">Department & Title</th>
                <th className="px-5 py-4">Grade</th>
                <th className="px-5 py-4">Base Salary Range ({currency})</th>
                <th className="px-5 py-4">Monthly Allowances</th>
                <th className="px-5 py-4">Statutory Deductions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color text-foreground">
              {salaryScales.map((s) => (
                <tr key={s.id} className="hover:bg-surface-elevated/30">
                  <td className="px-5 py-4">
                    <p className="font-bold text-foreground">{s.jobTitle}</p>
                    <p className="text-xs text-muted capitalize">{s.department.replace(/_/g, " ")}</p>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs text-muted">{s.gradeLevel}</td>
                  <td className="px-5 py-4">
                    <p className="font-extrabold text-foreground">
                      R{s.minSalary.toLocaleString()} - R{s.maxSalary.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-muted">Mid: R{s.midSalary.toLocaleString()}</p>
                  </td>
                  <td className="px-5 py-4 text-xs text-muted">
                    House: R{s.housingAllowance} · Trans: R{s.transportAllowance} · Med: R{s.medicalAllowance}
                  </td>
                  <td className="px-5 py-4 text-xs text-muted">
                    PAYE: {s.taxDeductionPct}% · Pension: {s.pensionDeductionPct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 7: LEAVE TRACKING */}
      {activeTab === "leave" && (
        <div className="rounded-2xl border border-border-color bg-surface overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-color bg-surface-elevated/70 text-[11px] font-bold uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-4">Employee</th>
                <th className="px-5 py-4">Leave Type</th>
                <th className="px-5 py-4">Duration</th>
                <th className="px-5 py-4">Days</th>
                <th className="px-5 py-4">Reason</th>
                <th className="px-5 py-4">Status</th>
                {(isAdmin || isManager) && <th className="px-5 py-4 text-right">Approval Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color text-foreground">
              {leaveRecords.map((l) => (
                <tr key={l.id} className="hover:bg-surface-elevated/30">
                  <td className="px-5 py-4 font-bold text-foreground">
                    {l.employeeName}
                    <p className="text-xs text-muted font-normal capitalize">{l.department.replace(/_/g, " ")}</p>
                  </td>
                  <td className="px-5 py-4 capitalize font-medium">{l.leaveType}</td>
                  <td className="px-5 py-4 text-xs text-muted">
                    {l.startDate} → {l.endDate}
                  </td>
                  <td className="px-5 py-4 font-bold text-foreground">{l.daysCount} Days</td>
                  <td className="px-5 py-4 text-xs text-muted max-w-[200px] truncate">{l.reason}</td>
                  <td className="px-5 py-4">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${
                        l.status === "approved"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : l.status === "rejected"
                          ? "bg-red-500/10 text-red-600"
                          : "bg-amber-500/10 text-amber-600"
                      }`}
                    >
                      {l.status}
                    </span>
                  </td>
                  {(isAdmin || isManager) && (
                    <td className="px-5 py-4 text-right">
                      {l.status === "pending" && (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleLeaveApproval(l.id, "approved")}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLeaveApproval(l.id, "rejected")}
                            className="rounded-lg bg-red-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-red-700"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}


      {/* EMPLOYEE DEACTIVATION MODAL */}
      {deactivatingEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-surface p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-border-color pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-600">
                  <UserMinus size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Deactivate Employee</h3>
                  <p className="text-xs text-muted">{deactivatingEmployee.fullName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeactivatingEmployee(null)}
                className="text-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmDeactivation} className="space-y-3">
              <div className="rounded-lg bg-red-500/10 p-3 text-[11px] text-red-700 dark:text-red-400">
                <p className="font-bold">⚠️ Important System Rule:</p>
                <p>
                  Once deactivated, this employee will be blocked from future payroll generation and payslip calculation.
                </p>
              </div>

              <div>
                <label className="mb-1 block font-bold text-foreground">Reason for Deactivation *</label>
                <select
                  value={deactivationReason}
                  onChange={(e) => setDeactivationReason(e.target.value as any)}
                  className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground font-semibold focus:border-red-500 focus:outline-none capitalize"
                >
                  <option value="resigned">Resigned (Voluntary resignation)</option>
                  <option value="terminated">Let Go / Terminated (Dismissal / Redundancy)</option>
                  <option value="contract_ended">Contract Ended (Fixed-term completion)</option>
                  <option value="deceased">Deceased</option>
                  <option value="other">Other Reason</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-bold text-foreground">Effective Date *</label>
                <input
                  type="date"
                  value={deactivationEffectiveDate}
                  onChange={(e) => setDeactivationEffectiveDate(e.target.value)}
                  className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-red-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-foreground">Notes & Handover Comments</label>
                <textarea
                  rows={3}
                  value={deactivationNotes}
                  onChange={(e) => setDeactivationNotes(e.target.value)}
                  placeholder="Optional exit notes, reason details, or reference numbers..."
                  className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-red-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-color">
                <button
                  type="button"
                  onClick={() => setDeactivatingEmployee(null)}
                  className="rounded-xl border border-border-color px-4 py-2 font-semibold text-muted hover:bg-surface-elevated"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-red-600 px-5 py-2 font-bold text-white hover:bg-red-700 shadow"
                >
                  Confirm Deactivation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXTEND CONTRACT MODAL */}
      {extendingContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border-color bg-surface p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-border-color pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600">
                  <RefreshCw size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Extend Fixed-Term Contract</h3>
                  <p className="text-xs text-muted">{extendingContract.employeeName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setExtendingContract(null)}
                className="text-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmExtension} className="space-y-4">
              <div className="rounded-xl border border-border-color bg-surface-elevated p-3 text-xs space-y-1 text-muted">
                <p>
                  Current Expiration Date: <b className="text-foreground">{extendingContract.endDate || "N/A"}</b>
                </p>
                <p>
                  Current Salary: <b className="text-emerald-600">R{extendingContract.monthlySalary.toLocaleString()}</b>
                </p>
              </div>

              {/* Quick Preset Buttons */}
              <div>
                <label className="mb-1 block font-bold text-foreground">Quick Extension Presets</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: "+3 Mos", mos: 3 },
                    { label: "+6 Mos", mos: 6 },
                    { label: "+1 Year", mos: 12 },
                    { label: "+2 Years", mos: 24 },
                  ].map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        const d = extendingContract.endDate ? new Date(extendingContract.endDate) : new Date();
                        d.setMonth(d.getMonth() + p.mos);
                        setExtensionEndDate(d.toISOString().slice(0, 10));
                      }}
                      className="rounded-lg border border-border-color bg-surface-elevated py-1.5 text-xs font-semibold hover:border-blue-500 hover:text-blue-600 transition"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block font-bold text-foreground">New Expiration End Date *</label>
                <input
                  type="date"
                  value={extensionEndDate}
                  onChange={(e) => setExtensionEndDate(e.target.value)}
                  className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-foreground">Monthly Salary on Renewal ({currency})</label>
                <input
                  type="number"
                  value={extensionSalary}
                  onChange={(e) => setExtensionSalary(Number(e.target.value))}
                  className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-foreground">Renewal Addendum Notes</label>
                <textarea
                  rows={2}
                  value={extensionNotes}
                  onChange={(e) => setExtensionNotes(e.target.value)}
                  placeholder="e.g. Approved extension following satisfactory performance review."
                  className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-color">
                <button
                  type="button"
                  onClick={() => setExtendingContract(null)}
                  className="rounded-xl border border-border-color px-4 py-2 font-semibold text-muted hover:bg-surface-elevated"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700 shadow"
                >
                  Apply Contract Extension
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* END CONTRACT IMMEDIATELY MODAL */}
      {terminatingContract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-red-500/30 bg-surface p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-border-color pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-600">
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">End Contract Immediately</h3>
                  <p className="text-xs text-muted">{terminatingContract.employeeName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTerminatingContract(null)}
                className="text-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmContractTermination} className="space-y-4">
              <div className="rounded-lg bg-red-500/10 p-3 text-[11px] text-red-700 dark:text-red-400">
                <p className="font-bold">⚠️ Warning:</p>
                <p>
                  This action will terminate the employee agreement effective today ({new Date().toISOString().slice(0, 10)}).
                </p>
              </div>

              <div>
                <label className="mb-1 block font-bold text-foreground">Termination Reason *</label>
                <input
                  type="text"
                  value={contractTerminationReason}
                  onChange={(e) => setContractTerminationReason(e.target.value)}
                  className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-red-500 focus:outline-none"
                  required
                />
              </div>

              <div className="flex items-center gap-2 rounded-lg bg-surface-elevated p-3 border border-border-color">
                <input
                  type="checkbox"
                  id="deactivateUserCheck"
                  checked={deactivateEmployeeOnContractEnd}
                  onChange={(e) => setDeactivateEmployeeOnContractEnd(e.target.checked)}
                  className="h-4 w-4 rounded border-border-color text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="deactivateUserCheck" className="text-xs font-semibold text-foreground cursor-pointer">
                  Also deactivate this employee in organization directory (Reason: Contract Ended)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-color">
                <button
                  type="button"
                  onClick={() => setTerminatingContract(null)}
                  className="rounded-xl border border-border-color px-4 py-2 font-semibold text-muted hover:bg-surface-elevated"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-red-600 px-5 py-2 font-bold text-white hover:bg-red-700 shadow"
                >
                  Terminate Contract Immediately
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EMPLOYEE DETAILS MODAL (WITH DEACTIVATION STATUS) */}
      {selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-border-color bg-surface p-6 shadow-2xl space-y-5 text-xs max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-border-color pb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl font-extrabold text-xl shadow-md ${
                    selectedEmployee.isActive !== false ? "bg-blue-600 text-white" : "bg-red-500/20 text-red-500"
                  }`}
                >
                  {selectedEmployee.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-foreground">{selectedEmployee.fullName}</h2>
                    {selectedEmployee.isActive !== false ? (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-600 uppercase">
                        Deactivated ({selectedEmployee.deactivationReason || "Inactive"})
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted">{selectedEmployee.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEmployee(null)}
                className="rounded-lg p-1.5 text-muted hover:bg-surface-elevated hover:text-foreground transition"
              >
                ✕
              </button>
            </div>

            {/* Deactivation Banner if inactive */}
            {selectedEmployee.isActive === false && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 space-y-1 text-red-700 dark:text-red-400">
                <p className="font-bold flex items-center gap-1.5">
                  <UserX size={15} />
                  <span>Personnel Deactivated</span>
                </p>
                <p className="text-xs">
                  Reason: <b className="capitalize">{selectedEmployee.deactivationReason?.replace(/_/g, " ") || "Other"}</b>
                  {selectedEmployee.deactivationDate && ` · Effective: ${selectedEmployee.deactivationDate}`}
                </p>
                {selectedEmployee.deactivationNotes && (
                  <p className="text-[11px] italic">Notes: "{selectedEmployee.deactivationNotes}"</p>
                )}
              </div>
            )}

            {/* Profile Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="rounded-xl border border-border-color bg-surface-elevated p-4 space-y-2">
                <h4 className="font-bold text-foreground text-xs uppercase tracking-wider text-muted">
                  Position & Department
                </h4>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted">Job Title:</span>
                    <span className="font-bold text-blue-600">{selectedEmployee.jobTitle}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Department:</span>
                    <span className="font-semibold text-foreground capitalize">
                      {selectedEmployee.department.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Role Level:</span>
                    <span className="font-bold text-foreground uppercase text-[10px]">
                      {selectedEmployee.roleLevel.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">User ID:</span>
                    <span className="font-mono text-[11px] text-muted">{selectedEmployee.userId}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-border-color bg-surface-elevated p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-foreground text-xs uppercase tracking-wider text-muted">
                    Contract & Tenure
                  </h4>
                  {(() => {
                    const contract = contracts.find(
                      (c) => c.userId === selectedEmployee.userId || c.userId === selectedEmployee.id
                    );
                    if (contract) {
                      return (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openExtendContractModal(contract)}
                            className="rounded px-2 py-0.5 text-[10px] font-bold border border-blue-500/30 bg-blue-500/10 text-blue-600 hover:bg-blue-600 hover:text-white transition"
                          >
                            Renew
                          </button>
                          <button
                            type="button"
                            onClick={() => openTerminateContractModal(contract)}
                            className="rounded px-2 py-0.5 text-[10px] font-bold border border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-600 hover:text-white transition"
                          >
                            End
                          </button>
                        </div>
                      );
                    }
                    return (
                      <button
                        type="button"
                        onClick={() => openCreateContractModal(selectedEmployee)}
                        className="rounded px-2 py-0.5 text-[10px] font-bold border border-border-color bg-surface text-foreground hover:border-blue-500 hover:text-blue-600 transition"
                      >
                        + Issue Contract
                      </button>
                    );
                  })()}
                </div>
                {(() => {
                  const contract = contracts.find(
                    (c) => c.userId === selectedEmployee.userId || c.userId === selectedEmployee.id
                  );
                  if (!contract) {
                    return (
                      <div className="space-y-1 text-xs">
                        <p className="text-muted italic">Standard staff agreement (no fixed-term expiry).</p>
                      </div>
                    );
                  }
                  const countdown = getContractCountdown(contract);
                  return (
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted">Tenure:</span>
                        <span className="font-bold text-foreground">
                          {contract.isPermanent ? "Permanent Indefinite" : "Fixed-Term Contract"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Countdown:</span>
                        <span className={`font-bold rounded px-1.5 py-0.2 text-[10px] ${countdown.colorClass}`}>
                          {countdown.label}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Monthly Salary:</span>
                        <span className="font-bold text-emerald-600">R{contract.monthlySalary.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Payslips for this employee */}
            <div className="space-y-2">
              <h4 className="font-bold text-foreground text-xs uppercase tracking-wider text-muted">
                Salary & Payslip History
              </h4>
              <div className="rounded-xl border border-border-color bg-surface-elevated overflow-hidden">
                {(() => {
                  const userPayslips = payslips.filter(
                    (p) => p.userId === selectedEmployee.userId || p.employeeName === selectedEmployee.fullName
                  );
                  if (userPayslips.length === 0) {
                    return (
                      <p className="p-4 text-center text-muted text-xs">
                        No payslips generated for this employee yet.
                      </p>
                    );
                  }
                  return (
                    <table className="w-full text-left text-xs">
                      <thead className="bg-surface/50 border-b border-border-color text-muted font-bold">
                        <tr>
                          <th className="p-2.5">Period</th>
                          <th className="p-2.5">Gross</th>
                          <th className="p-2.5">Deductions</th>
                          <th className="p-2.5">Net Pay</th>
                          <th className="p-2.5 text-right">Official Payslip</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border-color">
                        {userPayslips.map((up) => (
                          <tr key={up.id} className="hover:bg-surface/30">
                            <td className="p-2.5 font-mono font-bold text-blue-600">{up.payPeriod}</td>
                            <td className="p-2.5">R{up.grossPay.toLocaleString()}</td>
                            <td className="p-2.5 text-red-600">
                              -R{(up.grossPay - up.netPay).toLocaleString()}
                            </td>
                            <td className="p-2.5 font-bold text-emerald-600">R{up.netPay.toLocaleString()}</td>
                            <td className="p-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => handlePrintOfficialPayslip(up)}
                                className="inline-flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-blue-700 transition"
                              >
                                <Printer size={11} />
                                <span>Print Payslip</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between border-t border-border-color pt-4">
              <button
                type="button"
                onClick={() => setSelectedEmployee(null)}
                className="rounded-xl border border-border-color px-4 py-2 font-semibold text-muted hover:bg-surface-elevated hover:text-foreground transition"
              >
                Close
              </button>

              <div className="flex items-center gap-2">
                {(isAdmin || isManager) && (
                  <>
                    {selectedEmployee.isActive !== false ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            const emp = selectedEmployee;
                            setDeactivatingEmployee(emp);
                            setDeactivationReason("resigned");
                            setDeactivationNotes("");
                          }}
                          className="rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2 font-semibold text-red-600 hover:bg-red-600 hover:text-white transition"
                        >
                          Deactivate Employee
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const emp = selectedEmployee;
                            setSelectedEmployee(null);
                            openBatchGenerator(emp.id);
                          }}
                          className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 font-bold text-white shadow hover:bg-blue-700 transition"
                        >
                          <DollarSign size={14} />
                          <span>Generate & Review Payslips</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="text-xs text-muted italic mr-2">
                          🔒 Cannot generate payslip for deactivated personnel
                        </span>

                        <button
                          type="button"
                          onClick={() => handleReactivateEmployee(selectedEmployee)}
                          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white shadow hover:bg-emerald-700 transition"
                        >
                          <RotateCcw size={14} />
                          <span>Reactivate Personnel</span>
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SINGLE PAYSLIP GENERATION MODAL (ACTIVE ONLY) */}
      {payslipModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border-color bg-surface p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-border-color pb-3">
              <h3 className="text-base font-bold text-foreground">Generate Employee Payslip</h3>
              <button onClick={() => setPayslipModalOpen(false)} className="text-muted hover:text-foreground">
                ✕
              </button>
            </div>

            <form onSubmit={handleGeneratePayslip} className="space-y-4">
              <div>
                <label className="mb-1 block font-medium text-foreground">Select Active Employee *</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedUserId(id);
                    const u = users.find((usr) => usr.id === id);
                    if (u) {
                      const scale = salaryScales.find(
                        (s) =>
                          s.jobTitle.toLowerCase() === u.jobTitle.toLowerCase() ||
                          s.department === u.department
                      );
                      if (scale) {
                        setBasicSalary(scale.midSalary || scale.minSalary);
                        setHousingAllowance(scale.housingAllowance || 0);
                        setTransportAllowance(scale.transportAllowance || 0);
                        setMedicalAllowance(scale.medicalAllowance || 0);
                      }
                    }
                  }}
                  className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                >
                  {activeEmployees.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.jobTitle})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-muted mt-1">
                  ✓ Only active employees are listed ({activeEmployees.length} eligible). Deactivated staff cannot receive payslips.
                </p>
              </div>

              <div>
                <label className="mb-1 block font-medium text-foreground">Pay Period (YYYY-MM) *</label>
                <input
                  type="text"
                  value={payPeriod}
                  onChange={(e) => setPayPeriod(e.target.value)}
                  className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-foreground">Basic Salary ({currency}) *</label>
                  <input
                    type="number"
                    value={basicSalary}
                    onChange={(e) => setBasicSalary(Number(e.target.value))}
                    className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-foreground">Housing Allowance</label>
                  <input
                    type="number"
                    value={housingAllowance}
                    onChange={(e) => setHousingAllowance(Number(e.target.value))}
                    className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-foreground">Transport Allowance</label>
                  <input
                    type="number"
                    value={transportAllowance}
                    onChange={(e) => setTransportAllowance(Number(e.target.value))}
                    className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-foreground">Medical Allowance</label>
                  <input
                    type="number"
                    value={medicalAllowance}
                    onChange={(e) => setMedicalAllowance(Number(e.target.value))}
                    className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPayslipModalOpen(false)}
                  className="rounded-lg border border-border-color px-3 py-1.5 text-muted hover:bg-surface-elevated"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-5 py-1.5 font-bold text-white hover:bg-blue-700 shadow"
                >
                  Calculate & Issue Payslip
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LEAVE REQUEST MODAL */}
      {leaveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border-color bg-surface p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-border-color pb-3">
              <h3 className="text-base font-bold text-foreground">Submit Leave Application</h3>
              <button onClick={() => setLeaveModalOpen(false)} className="text-muted hover:text-foreground">
                ✕
              </button>
            </div>

            <form onSubmit={handleLeaveSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block font-medium text-foreground">Leave Category *</label>
                <select
                  value={leaveType}
                  onChange={(e) => setLeaveType(e.target.value as LeaveRecord["leaveType"])}
                  className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                >
                  <option value="annual">Annual Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="study">Study Leave</option>
                  <option value="maternity">Maternity Leave</option>
                  <option value="paternity">Paternity Leave</option>
                  <option value="bereavement">Bereavement Leave</option>
                  <option value="unpaid">Unpaid Leave</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-foreground">Start Date *</label>
                  <input
                    type="date"
                    value={leaveStartDate}
                    onChange={(e) => setLeaveStartDate(e.target.value)}
                    className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-foreground">End Date *</label>
                  <input
                    type="date"
                    value={leaveEndDate}
                    onChange={(e) => setLeaveEndDate(e.target.value)}
                    className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-medium text-foreground">Reason for Leave</label>
                <textarea
                  rows={2}
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setLeaveModalOpen(false)}
                  className="rounded-lg border border-border-color px-3 py-1.5 text-muted hover:bg-surface-elevated"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-5 py-1.5 font-bold text-white hover:bg-blue-700 shadow"
                >
                  Submit Application
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAYSLIP VIEW MODAL */}
      {previewPayslip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border-color bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-color pb-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600">OFFICIAL PAYSLIP</p>
                <h3 className="text-base font-bold text-foreground">{previewPayslip.employeeName}</h3>
              </div>
              <button onClick={() => setPreviewPayslip(null)} className="text-muted hover:text-foreground">
                ✕
              </button>
            </div>

            <div className="rounded-xl border border-border-color bg-surface-elevated p-4 text-xs space-y-2">
              <div className="flex justify-between border-b border-border-color/50 pb-1.5">
                <span className="text-muted">Pay Period:</span>
                <span className="font-mono font-bold text-foreground">{previewPayslip.payPeriod}</span>
              </div>
              <div className="flex justify-between border-b border-border-color/50 pb-1.5">
                <span className="text-muted">Basic Salary:</span>
                <span className="font-semibold text-foreground">R{previewPayslip.basicSalary.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b border-border-color/50 pb-1.5">
                <span className="text-muted">Gross Earnings:</span>
                <span className="font-bold text-foreground">R{previewPayslip.grossPay.toLocaleString()}</span>
              </div>
              <div className="flex justify-between border-b border-border-color/50 pb-1.5 text-red-600">
                <span>Total Statutory Deductions (PAYE + Pension + UIF):</span>
                <span className="font-semibold">
                  -R{(previewPayslip.grossPay - previewPayslip.netPay).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between pt-1 text-sm font-black text-emerald-600">
                <span>Net Payable Remuneration:</span>
                <span>R{previewPayslip.netPay.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPreviewPayslip(null)}
                className="rounded-xl border border-border-color px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-elevated transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handlePrintOfficialPayslip(previewPayslip)}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition"
              >
                <Printer size={14} />
                <span>Print Official Payslip (New Tab)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD STAFF MODAL (HR MANAGER QUICK ONBOARDING) */}
      {addStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border-color bg-surface p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-border-color pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                  <UserPlus size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Add New Staff Member</h3>
                  <p className="text-[11px] text-muted">Onboard personnel across company departments</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAddStaffModalOpen(false)}
                className="text-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>

            {staffError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-600 font-semibold">
                {staffError}
              </div>
            )}
            {staffSuccess && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-600 font-semibold">
                {staffSuccess}
              </div>
            )}

            <form onSubmit={handleCreateStaffSubmit} className="space-y-3">
              <div>
                <label className="mb-1 block font-bold text-foreground">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Jenkins"
                  value={staffFullName}
                  onChange={(e) => setStaffFullName(e.target.value)}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-foreground">Email Address *</label>
                <input
                  type="email"
                  required
                  placeholder="e.g. s.jenkins@company.com"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-bold text-foreground">Department *</label>
                  <select
                    value={staffDepartment}
                    onChange={(e) => {
                      const dept = e.target.value as DepartmentType;
                      setStaffDepartment(dept);
                      const titles = JOB_TITLES_BY_DEPARTMENT[dept] || [];
                      if (titles.length > 0) {
                        setStaffJobTitle(titles[0].title);
                        setStaffRoleLevel(titles[0].defaultLevel as RoleLevel);
                      }
                    }}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none capitalize"
                  >
                    <option value="front_desk">Front Desk</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="accountant">Finance & Accounts</option>
                    <option value="human_resources">Human Resources</option>
                    <option value="procurement">Procurement</option>
                    <option value="stores">Stores & Inventory</option>
                    <option value="it">Information Technology</option>
                    <option value="manager">Management</option>
                    <option value="admin">Administration</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-bold text-foreground">Role Level *</label>
                  <select
                    value={staffRoleLevel}
                    onChange={(e) => setStaffRoleLevel(e.target.value as RoleLevel)}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none capitalize"
                  >
                    <option value="staff">Staff</option>
                    <option value="supervisor">Supervisor</option>
                    <option value="manager">Manager</option>
                    <option value="all_rights">All Rights</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-bold text-foreground">Job Title / Designation *</label>
                <div className="space-y-1.5">
                  <select
                    value={staffJobTitle}
                    onChange={(e) => setStaffJobTitle(e.target.value)}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                  >
                    {(JOB_TITLES_BY_DEPARTMENT[staffDepartment] || []).map((item) => (
                      <option key={item.title} value={item.title}>
                        {item.title}
                      </option>
                    ))}
                    <option value="__custom__">+ Custom Title...</option>
                  </select>
                  {staffJobTitle === "__custom__" && (
                    <input
                      type="text"
                      placeholder="Enter custom job title..."
                      onChange={(e) => setStaffJobTitle(e.target.value)}
                      className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                      required
                    />
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="staffSendInvite"
                  checked={staffSendInvite}
                  onChange={(e) => setStaffSendInvite(e.target.checked)}
                  className="rounded border-border-color text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="staffSendInvite" className="text-muted cursor-pointer select-none">
                  Send welcome email invitation with login instructions
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border-color">
                <button
                  type="button"
                  onClick={() => setAddStaffModalOpen(false)}
                  className="rounded-xl border border-border-color px-4 py-2 text-muted hover:bg-surface-elevated"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={staffSaving}
                  className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700 shadow disabled:opacity-50 flex items-center gap-1.5"
                >
                  {staffSaving ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus size={13} />
                      <span>Create Staff Profile</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE EMPLOYEE CONTRACT MODAL */}
      {createContractTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border-color bg-surface p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-border-color pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
                  <FileSignature size={16} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Issue Staff Contract</h3>
                  <p className="text-[11px] text-muted">
                    {createContractTarget.fullName} · {createContractTarget.jobTitle}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCreateContractTarget(null)}
                className="text-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateContractSubmit} className="space-y-3">
              <div className="flex items-center gap-2 p-3 rounded-xl bg-surface-elevated border border-border-color">
                <input
                  type="checkbox"
                  id="newContractIsPermanent"
                  checked={newContractIsPermanent}
                  onChange={(e) => setNewContractIsPermanent(e.target.checked)}
                  className="rounded border-border-color text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="newContractIsPermanent" className="text-foreground font-bold cursor-pointer select-none">
                  Permanent Employment (Indefinite Tenure)
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-bold text-foreground">Start Date *</label>
                  <input
                    type="date"
                    required
                    value={newContractStartDate}
                    onChange={(e) => setNewContractStartDate(e.target.value)}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                  />
                </div>

                {!newContractIsPermanent && (
                  <div>
                    <label className="mb-1 block font-bold text-foreground">End Date *</label>
                    <input
                      type="date"
                      required={!newContractIsPermanent}
                      value={newContractEndDate}
                      onChange={(e) => setNewContractEndDate(e.target.value)}
                      className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-bold text-foreground">Monthly Salary ({currency}) *</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={newContractSalary}
                    onChange={(e) => setNewContractSalary(Number(e.target.value))}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block font-bold text-foreground">Annual Leave Days</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={newContractLeaveDays}
                    onChange={(e) => setNewContractLeaveDays(Number(e.target.value))}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border-color">
                <button
                  type="button"
                  onClick={() => setCreateContractTarget(null)}
                  className="rounded-xl border border-border-color px-4 py-2 text-muted hover:bg-surface-elevated"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingContract}
                  className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white hover:bg-blue-700 shadow disabled:opacity-50 flex items-center gap-1.5"
                >
                  {creatingContract ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={13} />
                      <span>Issue Contract</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADVANCED MULTI-MONTH & BULK PAYSLIP SUITE MODAL */}
      {batchGeneratorModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl border border-border-color bg-surface shadow-2xl overflow-hidden text-xs">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border-color p-5 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md">
                  <Receipt size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">
                    Multi-Month & Bulk Payslip Generator & Email Dispatch
                  </h3>
                  <p className="text-[11px] text-muted">
                    Generate up to 6 months of historical or current payslips, review drafts, and email separate file attachments.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBatchGeneratorModalOpen(false)}
                className="text-muted hover:text-foreground text-sm p-1"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {batchResultMsg && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>{batchResultMsg}</span>
                </div>
              )}

              {/* STEP 1: SELECTION */}
              {batchStep === "select" && (
                <div className="space-y-5">
                  {/* Month Selection */}
                  <div className="rounded-2xl border border-border-color bg-surface-elevated p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-black text-foreground text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <Calendar size={14} className="text-blue-600" />
                        <span>Select Pay Periods (Up to 6 Months) *</span>
                      </label>
                      <span className="text-[11px] font-bold text-muted">
                        Selected: <b className="text-blue-600">{batchSelectedMonths.length}</b> / 6 max
                      </span>
                    </div>
                    <p className="text-[11px] text-muted">
                      Select past months to generate historical arrears or catch-up payslips. System tenure rules prevent generating slips before employee hire date.
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1">
                      {pastSixMonths.map((m) => {
                        const isSelected = batchSelectedMonths.includes(m);
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              if (isSelected) {
                                if (batchSelectedMonths.length === 1) {
                                  alert("At least one month must remain selected.");
                                  return;
                                }
                                setBatchSelectedMonths(batchSelectedMonths.filter((x) => x !== m));
                              } else {
                                if (batchSelectedMonths.length >= 6) {
                                  alert("You can select a maximum of 6 months per batch.");
                                  return;
                                }
                                setBatchSelectedMonths([...batchSelectedMonths, m].sort().reverse());
                              }
                            }}
                            className={`flex items-center justify-between rounded-xl border p-2.5 font-bold transition-all text-xs ${
                              isSelected
                                ? "border-blue-600 bg-blue-600/10 text-blue-600 shadow-sm"
                                : "border-border-color bg-surface hover:bg-surface-elevated text-muted hover:text-foreground"
                            }`}
                          >
                            <span className="font-mono">{m}</span>
                            {isSelected ? <CheckCircle2 size={14} /> : <div className="h-3.5 w-3.5 rounded-full border border-border-color" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Employee Selection */}
                  <div className="rounded-2xl border border-border-color bg-surface-elevated p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <label className="font-black text-foreground text-xs uppercase tracking-wider flex items-center gap-1.5">
                          <Users size={14} className="text-blue-600" />
                          <span>Select Active Personnel *</span>
                        </label>
                        <p className="text-[11px] text-muted">
                          Choose individual employees or select all active staff for mass batch generation.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setBatchSelectedEmployeeIds(activeEmployees.map((e) => e.id))}
                          className="rounded-lg border border-border-color bg-surface px-2.5 py-1 font-bold text-[11px] text-foreground hover:border-blue-500 hover:text-blue-600 transition"
                        >
                          Select All Active ({activeEmployees.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => setBatchSelectedEmployeeIds([])}
                          className="rounded-lg border border-border-color bg-surface px-2.5 py-1 font-bold text-[11px] text-muted hover:text-foreground transition"
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    <div className="max-h-60 overflow-y-auto rounded-xl border border-border-color bg-surface divide-y divide-border-color">
                      {activeEmployees.length === 0 ? (
                        <p className="p-4 text-center text-muted">No active employees found.</p>
                      ) : (
                        activeEmployees.map((emp) => {
                          const isChecked = batchSelectedEmployeeIds.includes(emp.id);
                          const joinMonth = emp.createdAt ? emp.createdAt.slice(0, 7) : "Unknown";
                          return (
                            <label
                              key={emp.id}
                              className="flex items-center justify-between p-3 hover:bg-surface-elevated/60 cursor-pointer select-none transition"
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setBatchSelectedEmployeeIds([...batchSelectedEmployeeIds, emp.id]);
                                    } else {
                                      setBatchSelectedEmployeeIds(batchSelectedEmployeeIds.filter((id) => id !== emp.id));
                                    }
                                  }}
                                  className="rounded border-border-color text-blue-600 focus:ring-blue-500"
                                />
                                <div>
                                  <p className="font-bold text-foreground text-xs">{emp.fullName}</p>
                                  <p className="text-[11px] text-muted">
                                    {emp.jobTitle} · <span className="capitalize">{emp.department.replace(/_/g, " ")}</span>
                                  </p>
                                </div>
                              </div>
                              <div className="text-right text-[11px]">
                                <span className="font-mono text-muted">Joined: {joinMonth}</span>
                                <p className="text-[10px] text-muted">{emp.email}</p>
                              </div>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: REVIEW GENERATED DRAFTS & DISPATCH */}
              {batchStep === "review" && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-surface-elevated p-4 rounded-2xl border border-border-color">
                    <div>
                      <h4 className="font-black text-foreground text-sm">
                        Review Generated Payslips ({batchDrafts.length} Total Drafts)
                      </h4>
                      <p className="text-[11px] text-muted">
                        Inspect earnings, statutory deductions and tenure eligibility before finalizing and emailing attachments.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setBatchDrafts((prev) =>
                            prev.map((d) => (d.eligible ? { ...d, selectedForDispatch: true } : d))
                          )
                        }
                        className="rounded-lg border border-border-color bg-surface px-2.5 py-1 text-[11px] font-bold text-foreground hover:border-blue-500 transition"
                      >
                        Select All Eligible
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setBatchDrafts((prev) => prev.map((d) => ({ ...d, selectedForDispatch: false })))
                        }
                        className="rounded-lg border border-border-color bg-surface px-2.5 py-1 text-[11px] font-bold text-muted hover:text-foreground transition"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  {/* Batch Review Table */}
                  <div className="rounded-2xl border border-border-color bg-surface overflow-hidden shadow-sm">
                    <div className="max-h-80 overflow-y-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="sticky top-0 bg-surface-elevated border-b border-border-color font-bold text-[11px] uppercase tracking-wider text-muted z-10">
                          <tr>
                            <th className="p-3">Send</th>
                            <th className="p-3">Employee</th>
                            <th className="p-3">Period</th>
                            <th className="p-3">Gross Remuneration</th>
                            <th className="p-3">Net Disbursed</th>
                            <th className="p-3">Tenure / Status</th>
                            <th className="p-3 text-right">Individual Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border-color">
                          {batchDrafts.map((d) => (
                            <tr
                              key={d.id}
                              className={`transition-colors ${
                                !d.eligible
                                  ? "bg-red-500/5 opacity-70"
                                  : d.emailSent
                                  ? "bg-emerald-500/5"
                                  : "hover:bg-surface-elevated/50"
                              }`}
                            >
                              <td className="p-3">
                                <input
                                  type="checkbox"
                                  disabled={!d.eligible || batchSending}
                                  checked={d.selectedForDispatch && d.eligible}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setBatchDrafts((prev) =>
                                      prev.map((item) => (item.id === d.id ? { ...item, selectedForDispatch: checked } : item))
                                    );
                                  }}
                                  className="rounded border-border-color text-blue-600 focus:ring-blue-500 disabled:opacity-30"
                                />
                              </td>
                              <td className="p-3">
                                <p className="font-bold text-foreground">{d.user.fullName}</p>
                                <p className="text-[10px] text-muted">{d.user.email}</p>
                              </td>
                              <td className="p-3 font-mono font-bold text-blue-600">{d.month}</td>
                              <td className="p-3 font-semibold text-foreground">
                                {currency} {d.grossPay.toLocaleString()}
                              </td>
                              <td className="p-3 font-black text-emerald-600">
                                {currency} {d.netPay.toLocaleString()}
                              </td>
                              <td className="p-3">
                                {d.eligible ? (
                                  d.emailSent ? (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                                      <CheckCircle2 size={11} />
                                      Email Dispatched
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-600">
                                      ✓ Valid Tenure
                                    </span>
                                  )
                                ) : (
                                  <span
                                    className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold text-red-600"
                                    title={d.ineligibleReason}
                                  >
                                    <XCircle size={11} />
                                    {d.ineligibleReason || "Ineligible"}
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right">
                                {d.eligible && (
                                  <button
                                    type="button"
                                    disabled={batchSending}
                                    onClick={() => handleDispatchBatchEmails(d.user.id)}
                                    className="inline-flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-600 hover:text-white transition disabled:opacity-50"
                                  >
                                    <Mail size={11} />
                                    <span>Email Person</span>
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-t border-border-color p-5 bg-surface shrink-0">
              {batchStep === "select" ? (
                <>
                  <div className="text-xs text-muted">
                    Total Estimated Records:{" "}
                    <b className="text-foreground">
                      {batchSelectedEmployeeIds.length * batchSelectedMonths.length}
                    </b>{" "}
                    ({batchSelectedEmployeeIds.length} staff × {batchSelectedMonths.length} month(s))
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setBatchGeneratorModalOpen(false)}
                      className="rounded-xl border border-border-color px-4 py-2 font-semibold text-muted hover:bg-surface-elevated transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleGenerateBatchDrafts}
                      disabled={batchSelectedEmployeeIds.length === 0 || batchSelectedMonths.length === 0}
                      className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 font-bold text-white shadow-md hover:bg-blue-700 transition disabled:opacity-50"
                    >
                      <Sparkles size={14} />
                      <span>Review Generated Drafts ({batchSelectedEmployeeIds.length * batchSelectedMonths.length})</span>
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xs text-muted">
                    Selected for Emailing:{" "}
                    <b className="text-blue-600">
                      {batchDrafts.filter((d) => d.eligible && d.selectedForDispatch).length}
                    </b>{" "}
                    of {batchDrafts.filter((d) => d.eligible).length} eligible payslips
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={batchSending}
                      onClick={() => setBatchStep("select")}
                      className="rounded-xl border border-border-color px-4 py-2 font-semibold text-muted hover:bg-surface-elevated transition disabled:opacity-50"
                    >
                      Back to Selection
                    </button>
                    <button
                      type="button"
                      disabled={
                        batchSending ||
                        batchDrafts.filter((d) => d.eligible && d.selectedForDispatch).length === 0
                      }
                      onClick={() => handleDispatchBatchEmails()}
                      className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2 font-bold text-white shadow-md hover:from-emerald-700 hover:to-teal-700 transition disabled:opacity-50"
                    >
                      {batchSending ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>
                            Sending ({batchSendProgress.current} / {batchSendProgress.total})...
                          </span>
                        </>
                      ) : (
                        <>
                          <Send size={14} />
                          <span>
                            Email All Selected Payslips (
                            {batchDrafts.filter((d) => d.eligible && d.selectedForDispatch).length})
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
