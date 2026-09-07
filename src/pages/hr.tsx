import { useState, useEffect } from "react";
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

export default function HRPage() {
  const { currentCompany, currentCompanyUser, isManager, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<"directory" | "salaries" | "payslips" | "contracts" | "leave">("directory");

  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [salaryScales, setSalaryScales] = useState<SalaryScale[]>([]);
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [contracts, setContracts] = useState<EmployeeContract[]>([]);
  const [templates, setTemplates] = useState<EmployeeContractTemplate[]>([]);
  const [leaveRecords, setLeaveRecords] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);

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
    if (usrs.length > 0) setSelectedUserId(usrs[0].id);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [currentCompany.id]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Human Resources & Payroll Administration
          </h1>
          <p className="text-sm text-muted">
            Manage organization employees, salary scales, payslips, employment contracts, and leave requests.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLeaveModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface-elevated"
          >
            <Calendar size={15} />
            <span>Request Leave</span>
          </button>

          {(isAdmin || isManager) && (
            <button
              type="button"
              onClick={() => setPayslipModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700"
            >
              <DollarSign size={15} />
              <span>Generate Payslip</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
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

      {/* TAB 1: EMPLOYEE DIRECTORY */}
      {activeTab === "directory" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {users.map((u) => (
            <div
              key={u.id}
              className="rounded-2xl border border-border-color bg-surface p-5 shadow-sm space-y-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600 font-bold text-base">
                  {u.fullName.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{u.fullName}</h3>
                  <p className="text-xs text-muted">{u.email}</p>
                </div>
              </div>

              <div className="rounded-xl bg-surface-elevated p-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted">Department:</span>
                  <span className="font-semibold text-foreground capitalize">{u.department.replace("_", " ")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Job Title:</span>
                  <span className="font-bold text-blue-600">{u.jobTitle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Role Level:</span>
                  <span className="font-semibold text-foreground uppercase text-[10px]">{u.roleLevel}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TAB 2: SALARY SCALES */}
      {activeTab === "salaries" && (
        <div className="rounded-2xl border border-border-color bg-surface overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-color bg-surface-elevated/70 text-[11px] font-bold uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3.5">Department & Title</th>
                <th className="px-4 py-3.5">Grade</th>
                <th className="px-4 py-3.5">Base Salary Range (ZAR)</th>
                <th className="px-4 py-3.5">Monthly Allowances</th>
                <th className="px-4 py-3.5">Statutory Deductions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color text-foreground">
              {salaryScales.map((s) => (
                <tr key={s.id} className="hover:bg-surface-elevated/30">
                  <td className="px-4 py-3.5">
                    <p className="font-bold text-foreground">{s.jobTitle}</p>
                    <p className="text-xs text-muted capitalize">{s.department.replace("_", " ")}</p>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs text-muted">{s.gradeLevel}</td>
                  <td className="px-4 py-3.5">
                    <p className="font-extrabold text-foreground">
                      R{s.minSalary.toLocaleString()} - R{s.maxSalary.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-muted">Mid: R{s.midSalary.toLocaleString()}</p>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-muted">
                    House: R{s.housingAllowance} · Trans: R{s.transportAllowance} · Med: R{s.medicalAllowance}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-muted">
                    PAYE: {s.taxDeductionPct}% · Pension: {s.pensionDeductionPct}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 3: PAYSLIPS */}
      {activeTab === "payslips" && (
        <div className="rounded-2xl border border-border-color bg-surface overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-color bg-surface-elevated/70 text-[11px] font-bold uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3.5">Employee</th>
                <th className="px-4 py-3.5">Period</th>
                <th className="px-4 py-3.5">Basic Salary</th>
                <th className="px-4 py-3.5">Gross Pay</th>
                <th className="px-4 py-3.5">Net Pay</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color text-foreground">
              {payslips.map((p) => (
                <tr key={p.id} className="hover:bg-surface-elevated/30">
                  <td className="px-4 py-3.5 font-bold text-foreground">
                    {p.employeeName}
                    <p className="text-xs text-muted font-normal">{p.jobTitle}</p>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs">{p.payPeriod}</td>
                  <td className="px-4 py-3.5">R{p.basicSalary.toLocaleString()}</td>
                  <td className="px-4 py-3.5 font-semibold text-foreground">R{p.grossPay.toLocaleString()}</td>
                  <td className="px-4 py-3.5 font-black text-emerald-600">R{p.netPay.toLocaleString()}</td>
                  <td className="px-4 py-3.5">
                    <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600 uppercase">
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => setPreviewPayslip(p)}
                      className="rounded-lg border border-border-color bg-surface-elevated px-2.5 py-1 text-xs font-semibold text-muted hover:text-foreground"
                    >
                      View Payslip
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: CONTRACTS */}
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

      {/* TAB 5: LEAVE TRACKING */}
      {activeTab === "leave" && (
        <div className="rounded-2xl border border-border-color bg-surface overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-color bg-surface-elevated/70 text-[11px] font-bold uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3.5">Employee</th>
                <th className="px-4 py-3.5">Leave Type</th>
                <th className="px-4 py-3.5">Duration</th>
                <th className="px-4 py-3.5">Days</th>
                <th className="px-4 py-3.5">Reason</th>
                <th className="px-4 py-3.5">Status</th>
                {(isAdmin || isManager) && <th className="px-4 py-3.5 text-right">Approval Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color text-foreground">
              {leaveRecords.map((l) => (
                <tr key={l.id} className="hover:bg-surface-elevated/30">
                  <td className="px-4 py-3.5 font-bold text-foreground">
                    {l.employeeName}
                    <p className="text-xs text-muted font-normal capitalize">{l.department.replace("_", " ")}</p>
                  </td>
                  <td className="px-4 py-3.5 capitalize font-medium">{l.leaveType}</td>
                  <td className="px-4 py-3.5 text-xs text-muted">
                    {l.startDate} → {l.endDate}
                  </td>
                  <td className="px-4 py-3.5 font-bold text-foreground">{l.daysCount} Days</td>
                  <td className="px-4 py-3.5 text-xs text-muted max-w-[200px] truncate">{l.reason}</td>
                  <td className="px-4 py-3.5">
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
                    <td className="px-4 py-3.5 text-right">
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

      {/* Generate Payslip Modal */}
      {payslipModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border-color bg-surface p-6 shadow-2xl space-y-4 text-xs">
            <div className="flex items-center justify-between border-b border-border-color pb-3">
              <h3 className="text-base font-bold text-foreground">Generate Employee Payslip</h3>
              <button onClick={() => setPayslipModalOpen(false)} className="text-muted hover:text-foreground">✕</button>
            </div>

            <form onSubmit={handleGeneratePayslip} className="space-y-4">
              <div>
                <label className="mb-1 block font-medium text-foreground">Select Employee *</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
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
                  className="rounded-lg bg-blue-600 px-5 py-1.5 font-bold text-white hover:bg-blue-700"
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
              <button onClick={() => setLeaveModalOpen(false)} className="text-muted hover:text-foreground">✕</button>
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
                  className="rounded-lg bg-blue-600 px-5 py-1.5 font-bold text-white hover:bg-blue-700"
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
              <button onClick={() => setPreviewPayslip(null)} className="text-muted hover:text-foreground">✕</button>
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
                <span className="font-semibold">-R{(previewPayslip.grossPay - previewPayslip.netPay).toLocaleString()}</span>
              </div>
              <div className="flex justify-between pt-1 text-sm font-black text-emerald-600">
                <span>Net Payable Remuneration:</span>
                <span>R{previewPayslip.netPay.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700"
              >
                <Printer size={14} />
                <span>Print Official Payslip</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

