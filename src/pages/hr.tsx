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
} from "lucide-react";
import {
  fetchCompanyUsers,
  fetchSalaryScales,
  saveSalaryScale,
  fetchPayslips,
  generatePayslip,
  fetchEmployeeContracts,
  fetchEmployeeContractTemplates,
  createEmployeeContract,
  fetchLeaveRecords,
  requestLeave,
  updateLeaveStatus,
} from "@/lib/data";
import type {
  CompanyUser,
  SalaryScale,
  Payslip,
  EmployeeContract,
  EmployeeContractTemplate,
  LeaveRecord,
  DepartmentType,
} from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { buildProfessionalPayslipHtml } from "@/lib/document-templates";
import { fetchCompanyInfo, openDocumentPreview } from "@/lib/storage";

export default function HRPage() {
  const { currentCompany, currentCompanyUser, isManager, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<
    "directory" | "salaries" | "payslips" | "history" | "contracts" | "leave"
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

  // Directory filters
  const [directorySearch, setDirectorySearch] = useState("");
  const [directoryDept, setDirectoryDept] = useState("all");

  // Payslips filters
  const [payslipSearch, setPayslipSearch] = useState("");
  const [payslipPeriodFilter, setPayslipPeriodFilter] = useState("all");

  // History filters
  const [historyPeriodFilter, setHistoryPeriodFilter] = useState("all");

  // Printing state indicator
  const [printingSlipId, setPrintingSlipId] = useState<string | null>(null);

  // Payslip Modal State
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
    if (usrs.length > 0 && !selectedUserId) setSelectedUserId(usrs[0].id);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [currentCompany.id]);

  // Handle printing official payslip in a new browser tab with company branding
  const handlePrintOfficialPayslip = async (slip: Payslip) => {
    setPrintingSlipId(slip.id);
    // Open a blank window synchronously before async calls to prevent browser popup blocking
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

  const openPayslipModalForEmployee = (employee: CompanyUser) => {
    setSelectedUserId(employee.id);
    // Check if there is a salary scale matching their job title or department
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

  const handleGeneratePayslip = async (e: React.FormEvent) => {
    e.preventDefault();
    const u = users.find((usr) => usr.id === selectedUserId) || users[0];
    if (!u) return;

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
  };

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
      return matchesSearch && matchesDept;
    });
  }, [users, directorySearch, directoryDept]);

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
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-foreground">
              Human Resources & Payroll Administration
            </h1>
            <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-bold text-blue-600">
              {users.length} Personnel
            </span>
          </div>
          <p className="text-sm text-muted">
            Manage organization employees, salary scales, payslip generation, salary disbursements history, and leave tracking.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLeaveModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-elevated transition-colors shadow-sm"
          >
            <Calendar size={15} />
            <span>Request Leave</span>
          </button>

          {(isAdmin || isManager) && (
            <button
              type="button"
              onClick={() => setPayslipModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition-colors"
            >
              <DollarSign size={15} />
              <span>Generate Payslip</span>
            </button>
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
          Salary History ({availablePeriods.length} Periods)
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
          onClick={() => setActiveTab("contracts")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === "contracts"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-muted hover:bg-surface-elevated hover:text-foreground"
          }`}
        >
          <FileSignature size={16} />
          Employee Contracts ({contracts.length})
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

      {/* TAB 1: EMPLOYEE DIRECTORY (LIST VIEW & CLICKABLE ROW) */}
      {activeTab === "directory" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-surface p-4 rounded-2xl border border-border-color shadow-sm">
            <div className="flex flex-1 items-center gap-3">
              <div className="relative flex-1 max-w-md">
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
              </div>
            </div>

            <div className="text-xs font-semibold text-muted">
              Showing <span className="text-foreground">{filteredUsers.length}</span> of {users.length} employees
            </div>
          </div>

          {/* List Table */}
          <div className="rounded-2xl border border-border-color bg-surface overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border-color bg-surface-elevated/70 text-[11px] font-bold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-5 py-4">Employee</th>
                  <th className="px-5 py-4">Contact</th>
                  <th className="px-5 py-4">Department</th>
                  <th className="px-5 py-4">Job Title</th>
                  <th className="px-5 py-4">Role Level</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color text-foreground">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted">
                      No employees match your search criteria.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr
                      key={u.id}
                      onClick={() => setSelectedEmployee(u)}
                      className="cursor-pointer hover:bg-surface-elevated/60 transition-colors group"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 font-bold text-sm shadow-inner group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            {u.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-foreground group-hover:text-blue-600 transition-colors">
                              {u.fullName}
                            </p>
                            <p className="text-[11px] text-muted">ID: {u.id.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-xs">
                        <div className="flex items-center gap-1.5 text-muted">
                          <Mail size={13} />
                          <span>{u.email}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center rounded-full bg-surface-elevated px-2.5 py-1 text-xs font-semibold text-foreground capitalize border border-border-color/60">
                          {u.department.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-semibold text-foreground text-xs">
                        {u.jobTitle}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            u.roleLevel === "super_admin" || u.roleLevel === "admin"
                              ? "bg-purple-500/10 text-purple-600 border border-purple-500/20"
                              : u.roleLevel === "manager"
                              ? "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                              : "bg-gray-500/10 text-muted border border-border-color"
                          }`}
                        >
                          {u.roleLevel.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          Active
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedEmployee(u);
                            }}
                            className="rounded-lg border border-border-color bg-surface-elevated px-3 py-1.5 text-xs font-semibold text-muted hover:text-foreground hover:border-blue-500 transition-colors"
                          >
                            View Details
                          </button>
                          {(isAdmin || isManager) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openPayslipModalForEmployee(u);
                              }}
                              className="rounded-lg bg-blue-600/10 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-600 hover:text-white transition-colors"
                            >
                              Issue Slip
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PAYSLIPS & PAYROLL (IMPROVED PRESENTATION) */}
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
              <p className="text-[11px] text-muted">Direct to employee accounts</p>
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
                <span className="text-xs font-bold uppercase tracking-wider">Payroll Records</span>
                <div className="rounded-xl bg-purple-500/10 p-2 text-purple-600">
                  <FileText size={18} />
                </div>
              </div>
              <p className="text-2xl font-black text-foreground">{payrollMetrics.count} Payslips</p>
              <p className="text-[11px] text-muted">All active periods processed</p>
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
              <button
                type="button"
                onClick={() => setPayslipModalOpen(true)}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-blue-700 transition"
              >
                <Plus size={14} />
                <span>Issue New Payslip</span>
              </button>
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

      {/* TAB 3: SALARY HISTORY & PAST PAYMENTS */}
      {activeTab === "history" && (
        <div className="space-y-6">
          {/* Period Selector Tabs */}
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

          {/* Historical Summary Banner */}
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

          {/* Historical Transactions Table */}
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

      {/* TAB 4: SALARY SCALES */}
      {activeTab === "salaries" && (
        <div className="rounded-2xl border border-border-color bg-surface overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-color bg-surface-elevated/70 text-[11px] font-bold uppercase tracking-wider text-muted">
              <tr>
                <th className="px-5 py-4">Department & Title</th>
                <th className="px-5 py-4">Grade</th>
                <th className="px-5 py-4">Base Salary Range (ZAR)</th>
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

      {/* TAB 5: CONTRACTS */}
      {activeTab === "contracts" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {contracts.map((c) => (
              <div key={c.id} className="rounded-2xl border border-border-color bg-surface p-5 shadow-sm space-y-3">
                <div className="flex items-center justify-between border-b border-border-color pb-2">
                  <h3 className="font-bold text-foreground">{c.employeeName}</h3>
                  <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600 uppercase">
                    {c.status}
                  </span>
                </div>
                <div className="text-xs space-y-1 text-muted">
                  <p><b className="text-foreground">Position:</b> {c.jobTitle} ({c.department})</p>
                  <p><b className="text-foreground">Commenced:</b> {c.startDate}</p>
                  <p><b className="text-foreground">Monthly Salary:</b> R{c.monthlySalary.toLocaleString()}</p>
                  <p><b className="text-foreground">Annual Leave:</b> {c.leaveDaysPerYear} Days/Year</p>
                </div>
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => alert(`Showing full employment contract for ${c.employeeName}`)}
                    className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:underline"
                  >
                    <FileText size={13} />
                    <span>View Contract Document</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 6: LEAVE TRACKING */}
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

      {/* EMPLOYEE DETAILS MODAL */}
      {selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-border-color bg-surface p-6 shadow-2xl space-y-5 text-xs max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-border-color pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white font-extrabold text-xl shadow-md">
                  {selectedEmployee.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-black text-foreground">{selectedEmployee.fullName}</h2>
                    <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                      Active
                    </span>
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
                <h4 className="font-bold text-foreground text-xs uppercase tracking-wider text-muted">
                  Remuneration & Scale
                </h4>
                {(() => {
                  const scale = salaryScales.find(
                    (s) =>
                      s.jobTitle.toLowerCase() === selectedEmployee.jobTitle.toLowerCase() ||
                      s.department === selectedEmployee.department
                  );
                  if (!scale) {
                    return <p className="text-muted text-xs">Custom salary structure applies.</p>;
                  }
                  return (
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted">Grade Level:</span>
                        <span className="font-mono font-bold text-foreground">{scale.gradeLevel}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Salary Range:</span>
                        <span className="font-bold text-foreground">
                          R{scale.minSalary.toLocaleString()} - R{scale.maxSalary.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Target Mid:</span>
                        <span className="font-semibold text-blue-600">R{scale.midSalary.toLocaleString()}</span>
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
                Close Profile
              </button>

              {(isAdmin || isManager) && (
                <button
                  type="button"
                  onClick={() => {
                    const emp = selectedEmployee;
                    setSelectedEmployee(null);
                    openPayslipModalForEmployee(emp);
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 font-bold text-white shadow hover:bg-blue-700 transition"
                >
                  <DollarSign size={14} />
                  <span>Generate Payslip for {selectedEmployee.fullName}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Generate Payslip Modal */}
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
                <label className="mb-1 block font-medium text-foreground">Select Employee *</label>
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
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.fullName} ({u.jobTitle})
                    </option>
                  ))}
                </select>
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
                  <label className="mb-1 block font-medium text-foreground">Basic Salary (ZAR) *</label>
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

      {/* Leave Request Modal */}
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

      {/* Payslip View Modal */}
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
    </div>
  );
}
