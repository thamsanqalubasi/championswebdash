import { useState, useEffect } from "react";
import {
  UserCog,
  Plus,
  Trash2,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Key,
  Users,
  Search,
  Filter,
  Lock,
} from "lucide-react";
import {
  fetchCompanyUsers,
  createCompanyUser,
  deleteCompanyUser,
  logAuditEvent,
} from "@/lib/data";
import type { CompanyUser, DepartmentType, RoleLevel } from "@/lib/types";
import { useAuth } from "@/lib/auth";

const JOB_TITLES_BY_DEPARTMENT: Record<DepartmentType, Array<{ title: string; defaultLevel: RoleLevel }>> = {
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
  manager: [
    { title: "General Operations Manager", defaultLevel: "manager" },
  ],
};

export default function UsersManagementPage() {
  const { currentCompany, currentCompanyUser, isSuperAdmin, isAdmin, isManager } = useAuth();
  const [users, setUsers] = useState<CompanyUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState<DepartmentType>("front_desk");
  const [jobTitle, setJobTitle] = useState("Front Desk - Receptionist");
  const [roleLevel, setRoleLevel] = useState<RoleLevel>("staff");

  // Permissions config
  const [permissions, setPermissions] = useState<Record<string, boolean>>({
    view_dashboard: true,
    checkin_guests: false,
    manage_properties: false,
    manage_finance: false,
    manage_maintenance: false,
    manage_hr: false,
    view_audit_trail: false,
  });

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const loadUsers = async () => {
    setLoading(true);
    const data = await fetchCompanyUsers(currentCompany.id);
    setUsers(data);
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, [currentCompany.id]);

  // When department changes in modal, update available job titles
  useEffect(() => {
    const available = JOB_TITLES_BY_DEPARTMENT[department] || [];
    // If manager is adding, filter out manager / super_admin titles
    const filtered = isManager && !isAdmin
      ? available.filter((j) => j.defaultLevel !== "manager" && j.defaultLevel !== "super_admin" && j.defaultLevel !== "admin")
      : available;

    if (filtered.length > 0) {
      setJobTitle(filtered[0].title);
      setRoleLevel(filtered[0].defaultLevel);
    }
  }, [department, isManager, isAdmin]);

  const openAddUser = () => {
    setErrorMsg("");
    setSuccessMsg("");
    setFullName("");
    setEmail("");
    setPassword("TempPassword123!");

    // If manager, lock to their department
    if (isManager && !isAdmin) {
      setDepartment(currentCompanyUser.department);
    } else {
      setDepartment("front_desk");
    }

    setModalOpen(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email) {
      setErrorMsg("Please provide employee full name and email.");
      return;
    }

    // Manager validation: cannot add managers or add outside their department
    if (isManager && !isAdmin) {
      if (department !== currentCompanyUser.department) {
        setErrorMsg("Managers can only add staff in their own department.");
        return;
      }
      if (roleLevel === "manager" || roleLevel === "super_admin" || roleLevel === "admin") {
        setErrorMsg("Department managers cannot create other managers or admins.");
        return;
      }
    }

    try {
      const newUser = await createCompanyUser({
        companyId: currentCompany.id,
        fullName,
        email,
        department,
        jobTitle,
        roleLevel,
        permissions,
      });

      await logAuditEvent({
        companyId: currentCompany.id,
        action: "CREATE_USER",
        entityType: "company_user",
        entityId: newUser.id,
        entityName: `${fullName} (${jobTitle})`,
        actorName: currentCompanyUser.fullName,
        details: `Added new user ${fullName} to ${department} department with role ${roleLevel}.`,
      });

      setSuccessMsg(`User ${fullName} created successfully.`);
      setTimeout(() => {
        setModalOpen(false);
        loadUsers();
      }, 1200);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create user");
    }
  };

  const handleDeleteUser = async (u: CompanyUser) => {
    if (u.id === currentCompanyUser.id) {
      alert("You cannot delete your own active account.");
      return;
    }

    // Manager validation: cannot delete managers or users outside their department
    if (isManager && !isAdmin) {
      if (u.department !== currentCompanyUser.department) {
        alert("Managers can only delete staff in their own department.");
        return;
      }
      if (u.roleLevel === "manager" || u.roleLevel === "admin" || u.roleLevel === "super_admin") {
        alert("Managers cannot delete other managers or admins.");
        return;
      }
    }

    if (window.confirm(`Are you sure you want to remove ${u.fullName} (${u.jobTitle}) from ${currentCompany.name}?`)) {
      await deleteCompanyUser(u.id);
      await logAuditEvent({
        companyId: currentCompany.id,
        action: "DELETE_USER",
        entityType: "company_user",
        entityId: u.id,
        entityName: `${u.fullName} (${u.jobTitle})`,
        actorName: currentCompanyUser.fullName,
        details: `Deleted user ${u.fullName} from ${u.department} department.`,
      });
      loadUsers();
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.jobTitle.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDept = deptFilter === "all" || u.department === deptFilter;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            User Accounts & Departmental Rights
          </h1>
          <p className="text-sm text-muted">
            Manage administrative access, department staff roles, and granular permissions for {currentCompany.name}.
          </p>
        </div>

        {(isAdmin || isManager) && (
          <button
            type="button"
            onClick={openAddUser}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition"
          >
            <Plus size={18} />
            <span>Add New User</span>
          </button>
        )}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-border-color bg-surface p-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            placeholder="Search by Employee Name, Email, or Job Title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-border-color bg-surface-elevated pl-9 pr-4 py-2 text-sm text-foreground outline-none focus:border-blue-600"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter size={14} className="text-muted" />
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs font-semibold text-foreground focus:border-blue-600 focus:outline-none"
          >
            <option value="all">All Departments</option>
            <option value="admin">Administration</option>
            <option value="front_desk">Front Desk</option>
            <option value="maintenance">Maintenance</option>
            <option value="accountant">Accountant / Finance</option>
            <option value="human_resources">Human Resources</option>
            <option value="it">Information Technology</option>
            <option value="procurement">Procurement</option>
            <option value="audit">Audit Department</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-hidden rounded-2xl border border-border-color bg-surface shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border-color bg-surface-elevated/70 text-[11px] font-bold uppercase tracking-wider text-muted">
            <tr>
              <th className="px-4 py-3.5">Employee Name & Email</th>
              <th className="px-4 py-3.5">Department</th>
              <th className="px-4 py-3.5">Job Title & Specialization</th>
              <th className="px-4 py-3.5">Role Level</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-color text-foreground">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted">
                  Loading company users...
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted">
                  No users found matching your filters.
                </td>
              </tr>
            ) : (
              filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-surface-elevated/30 transition">
                  <td className="px-4 py-3.5">
                    <p className="font-bold text-foreground">{u.fullName}</p>
                    <p className="text-xs text-muted">{u.email}</p>
                  </td>

                  <td className="px-4 py-3.5 capitalize font-medium text-foreground">
                    {u.department.replace("_", " ")}
                  </td>

                  <td className="px-4 py-3.5">
                    <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-md text-xs">
                      {u.jobTitle}
                    </span>
                  </td>

                  <td className="px-4 py-3.5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                        u.roleLevel === "super_admin" || u.roleLevel === "admin"
                          ? "bg-purple-500/10 text-purple-600"
                          : u.roleLevel === "manager"
                          ? "bg-blue-500/10 text-blue-600"
                          : u.roleLevel === "all_rights"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : "bg-muted/10 text-muted"
                      }`}
                    >
                      {u.roleLevel.replace("_", " ")}
                    </span>
                  </td>

                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                      <CheckCircle2 size={13} />
                      <span>Active</span>
                    </span>
                  </td>

                  <td className="px-4 py-3.5 text-right">
                    {(isAdmin || (isManager && u.department === currentCompanyUser.department && u.roleLevel !== "manager")) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(u)}
                        className="rounded-lg p-1.5 text-muted hover:bg-red-500/10 hover:text-red-600 transition"
                        title="Delete User"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border-color bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-color pb-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Add New User</h3>
                <p className="text-xs text-muted">
                  {isManager && !isAdmin ? `Adding staff in ${currentCompanyUser.department} department` : "Assign department, job title, and rights"}
                </p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-muted hover:text-foreground">✕</button>
            </div>

            {errorMsg && (
              <div className="flex items-center gap-2 rounded-lg bg-red-500/10 p-2.5 text-xs text-red-600">
                <AlertCircle size={15} />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 p-2.5 text-xs text-emerald-600">
                <CheckCircle2 size={15} />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-foreground">Full Name *</label>
                  <input
                    type="text"
                    placeholder="e.g. Sipho Sithole"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-foreground">Email Address *</label>
                  <input
                    type="email"
                    placeholder="user@domain.co.za"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-foreground">Department *</label>
                  <select
                    value={department}
                    disabled={isManager && !isAdmin}
                    onChange={(e) => setDepartment(e.target.value as DepartmentType)}
                    className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none disabled:opacity-60"
                  >
                    <option value="admin">Administration</option>
                    <option value="front_desk">Front Desk</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="accountant">Accountant / Finance</option>
                    <option value="human_resources">Human Resources</option>
                    <option value="it">Information Technology</option>
                    <option value="procurement">Procurement</option>
                    <option value="audit">Audit Department</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-medium text-foreground">Job Title & Position *</label>
                  <select
                    value={jobTitle}
                    onChange={(e) => {
                      setJobTitle(e.target.value);
                      const match = (JOB_TITLES_BY_DEPARTMENT[department] || []).find((j) => j.title === e.target.value);
                      if (match) setRoleLevel(match.defaultLevel);
                    }}
                    className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                  >
                    {(JOB_TITLES_BY_DEPARTMENT[department] || [])
                      .filter((j) => !isManager || isAdmin || (j.defaultLevel !== "manager" && j.defaultLevel !== "super_admin" && j.defaultLevel !== "admin"))
                      .map((j) => (
                        <option key={j.title} value={j.title}>
                          {j.title}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Rights / Permissions Checklist */}
              <div className="rounded-xl border border-border-color bg-surface-elevated p-3 space-y-2">
                <p className="font-bold text-foreground">Specific Permissions Matrix:</p>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <label className="flex items-center gap-2 text-muted hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={permissions.checkin_guests}
                      onChange={(e) => setPermissions({ ...permissions, checkin_guests: e.target.checked })}
                    />
                    Front Desk Check-In & Extensions
                  </label>
                  <label className="flex items-center gap-2 text-muted hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={permissions.manage_properties}
                      onChange={(e) => setPermissions({ ...permissions, manage_properties: e.target.checked })}
                    />
                    Manage Properties & Rooms
                  </label>
                  <label className="flex items-center gap-2 text-muted hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={permissions.manage_finance}
                      onChange={(e) => setPermissions({ ...permissions, manage_finance: e.target.checked })}
                    />
                    Invoices & Rent Collection
                  </label>
                  <label className="flex items-center gap-2 text-muted hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={permissions.manage_maintenance}
                      onChange={(e) => setPermissions({ ...permissions, manage_maintenance: e.target.checked })}
                    />
                    Housekeeping & Work Orders
                  </label>
                  <label className="flex items-center gap-2 text-muted hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={permissions.manage_hr}
                      onChange={(e) => setPermissions({ ...permissions, manage_hr: e.target.checked })}
                    />
                    HR Payroll & Leave Approval
                  </label>
                  <label className="flex items-center gap-2 text-muted hover:text-foreground">
                    <input
                      type="checkbox"
                      checked={permissions.view_audit_trail}
                      onChange={(e) => setPermissions({ ...permissions, view_audit_trail: e.target.checked })}
                    />
                    Audit Logs & Analytics
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg border border-border-color px-3.5 py-1.5 text-muted hover:bg-surface-elevated"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-5 py-1.5 font-bold text-white shadow-md hover:bg-blue-700"
                >
                  Create & Grant Rights
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

