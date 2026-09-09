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
  KeyRound,
  Mail,
  Send,
  Globe,
} from "lucide-react";
import {
  fetchCompanyUsers,
  createCompanyUser,
  updateCompanyUser,
  deleteCompanyUser,
  logAuditEvent,
  resetUserPinByPrivilege,
  sendStaffInvitation,
  triggerStaffPasswordReset,
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

  // PIN reset modal state
  const [resetPinModalOpen, setResetPinModalOpen] = useState(false);
  const [pinResetTarget, setPinResetTarget] = useState<CompanyUser | null>(null);
  const [adminNewPin, setAdminNewPin] = useState("");
  const [adminConfirmPin, setAdminConfirmPin] = useState("");
  const [pinResetLoading, setPinResetLoading] = useState(false);
  const [pinResetSuccess, setPinResetSuccess] = useState<string | null>(null);
  const [pinResetError, setPinResetError] = useState<string | null>(null);

  const canResetAnyPin =
    isAdmin ||
    isSuperAdmin ||
    currentCompanyUser?.department === "it" ||
    currentCompanyUser?.roleLevel === "super_admin";

  const canResetUserPin = (u: CompanyUser) => {
    if (canResetAnyPin) return true;
    if (isManager && u.department === currentCompanyUser?.department) {
      return u.roleLevel !== "admin" && u.roleLevel !== "super_admin" && u.department !== "admin";
    }
    return false;
  };

  // Staff Invitation & Password Reset Triggers
  const [sendInviteEmail, setSendInviteEmail] = useState(true);
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [passwordResetTarget, setPasswordResetTarget] = useState<CompanyUser | null>(null);
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [passwordResetSuccess, setPasswordResetSuccess] = useState<string | null>(null);
  const [passwordResetError, setPasswordResetError] = useState<string | null>(null);

  // Password reset authorization:
  // Admin, Super Admin, or IT department can reset any staff password in the company.
  // Department Manager can reset staff passwords within their department.
  const canTriggerPasswordReset = (u: CompanyUser) => {
    if (isAdmin || isSuperAdmin || currentCompanyUser?.department === "it") return true;
    if (isManager && (u.department === currentCompanyUser?.department || currentCompanyUser?.department === "manager")) {
      return u.roleLevel !== "admin" && u.roleLevel !== "super_admin" && u.department !== "admin";
    }
    return false;
  };

  const openResetPasswordModal = (u: CompanyUser) => {
    setPasswordResetTarget(u);
    setPasswordResetSuccess(null);
    setPasswordResetError(null);
    setResetPasswordModalOpen(true);
  };

  const handleConfirmPasswordReset = async () => {
    if (!passwordResetTarget) return;
    setPasswordResetLoading(true);
    setPasswordResetError(null);
    setPasswordResetSuccess(null);
    try {
      const res = await triggerStaffPasswordReset({
        company: currentCompany,
        targetUser: {
          fullName: passwordResetTarget.fullName,
          email: passwordResetTarget.email,
        },
        requester: {
          fullName: currentCompanyUser.fullName,
          jobTitle: currentCompanyUser.jobTitle,
        },
      });

      if (!res.success && res.error) {
        setPasswordResetError(res.error);
      } else {
        setPasswordResetSuccess(`Password reset link emailed to ${passwordResetTarget.email}!`);
        setTimeout(() => {
          setResetPasswordModalOpen(false);
        }, 1800);
      }
    } catch (err) {
      setPasswordResetError(err instanceof Error ? err.message : "Failed to send password reset email.");
    } finally {
      setPasswordResetLoading(false);
    }
  };

  // Rights editing permissions:
  // 1. Admin/SuperAdmin can edit anyone's rights and grant/revoke manager's delegation rights.
  // 2. Manager can edit rights ONLY IF manage_user_rights !== false, AND target is staff under them.
  const managerHasRightsPermission =
    isManager && currentCompanyUser?.permissions?.manage_user_rights !== false;

  const canEditUserRights = (u: CompanyUser) => {
    if (isAdmin || isSuperAdmin) return true;
    if (managerHasRightsPermission) {
      // Manager can only edit staff in their department (not self, not other managers, not admins)
      const isUnderManager =
        u.id !== currentCompanyUser?.id &&
        u.roleLevel === "staff" &&
        (u.department === currentCompanyUser?.department || currentCompanyUser?.department === "manager");
      return isUnderManager;
    }
    return false;
  };

  // Edit Rights Modal State
  const [editRightsModalOpen, setEditRightsModalOpen] = useState(false);
  const [rightsTargetUser, setRightsTargetUser] = useState<CompanyUser | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editDepartment, setEditDepartment] = useState<DepartmentType>("front_desk");
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editRoleLevel, setEditRoleLevel] = useState<RoleLevel>("staff");
  const [editPermissions, setEditPermissions] = useState<Record<string, boolean>>({});
  const [savingRights, setSavingRights] = useState(false);
  const [rightsError, setRightsError] = useState<string | null>(null);
  const [rightsSuccess, setRightsSuccess] = useState<string | null>(null);

  const openEditRightsModal = (u: CompanyUser) => {
    setRightsTargetUser(u);
    setEditFullName(u.fullName || "");
    setEditDepartment(u.department || "front_desk");
    setEditJobTitle(u.jobTitle || "");
    setEditRoleLevel(u.roleLevel || "staff");
    const perms = { ...(u.permissions || {}) };
    if (u.roleLevel === "manager" && perms.manage_user_rights === undefined) {
      perms.manage_user_rights = true;
    }
    setEditPermissions(perms);
    setRightsError(null);
    setRightsSuccess(null);
    setEditRightsModalOpen(true);
  };

  const togglePermission = (key: string) => {
    setEditPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSaveUserRights = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rightsTargetUser) return;
    setRightsError(null);
    setRightsSuccess(null);
    setSavingRights(true);

    try {
      const updates: Partial<CompanyUser> = {};
      if (isAdmin || isSuperAdmin) {
        updates.fullName = editFullName;
        updates.department = editDepartment;
        updates.jobTitle = editJobTitle;
        updates.roleLevel = editRoleLevel;
        updates.permissions = editPermissions;
      } else if (managerHasRightsPermission) {
        // Manager can only update permissions on staff
        updates.permissions = editPermissions;
      }

      const res = await updateCompanyUser(rightsTargetUser.id, updates);
      if (!res) {
        setRightsError("Failed to update user permissions.");
      } else {
        setRightsSuccess(`Rights updated successfully for ${rightsTargetUser.fullName}!`);
        await logAuditEvent({
          companyId: currentCompany.id,
          action: "UPDATE_USER_RIGHTS",
          entityType: "company_user",
          entityId: rightsTargetUser.id,
          entityName: `${rightsTargetUser.fullName} (${rightsTargetUser.jobTitle})`,
          actorName: currentCompanyUser.fullName,
          details: `Updated permissions and rights for ${rightsTargetUser.fullName}.`,
        });
        setTimeout(() => {
          setEditRightsModalOpen(false);
          setRightsTargetUser(null);
          loadUsers();
        }, 1200);
      }
    } catch (err) {
      setRightsError(err instanceof Error ? err.message : "Error saving user permissions.");
    } finally {
      setSavingRights(false);
    }
  };

  const openResetPinModal = (u: CompanyUser) => {
    setPinResetTarget(u);
    setAdminNewPin("");
    setAdminConfirmPin("");
    setPinResetSuccess(null);
    setPinResetError(null);
    setResetPinModalOpen(true);
  };

  const handleExecutePinReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinResetTarget) return;
    setPinResetError(null);
    setPinResetSuccess(null);

    if (adminNewPin.length < 4) {
      setPinResetError("PIN must be at least 4 digits.");
      return;
    }
    if (adminNewPin !== adminConfirmPin) {
      setPinResetError("PINs do not match.");
      return;
    }

    setPinResetLoading(true);
    try {
      const res = await resetUserPinByPrivilege(
        currentCompanyUser,
        {
          id: pinResetTarget.userId,
          email: pinResetTarget.email,
          roleLevel: pinResetTarget.roleLevel,
          department: pinResetTarget.department,
        },
        adminNewPin
      );

      if (!res.ok) {
        setPinResetError(res.message || "Could not reset PIN.");
      } else {
        setPinResetSuccess(`PIN for ${pinResetTarget.fullName} was reset successfully!`);
        await logAuditEvent({
          companyId: currentCompany.id,
          action: "PIN_RESET_BY_PRIVILEGE",
          entityType: "user_account",
          entityId: pinResetTarget.userId,
          entityName: pinResetTarget.fullName,
          actorName: currentCompanyUser.fullName,
          details: `Reset security PIN for ${pinResetTarget.fullName} (${pinResetTarget.email}).`,
        });
        setTimeout(() => {
          setResetPinModalOpen(false);
          setPinResetTarget(null);
        }, 1400);
      }
    } catch (err) {
      setPinResetError(err instanceof Error ? err.message : "Error resetting PIN.");
    } finally {
      setPinResetLoading(false);
    }
  };

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
    setSendInviteEmail(true);

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

      let inviteNote = "";
      if (sendInviteEmail) {
        try {
          await sendStaffInvitation({
            company: currentCompany,
            targetUser: {
              fullName,
              email,
              department,
              jobTitle,
            },
            inviter: {
              fullName: currentCompanyUser.fullName,
              jobTitle: currentCompanyUser.jobTitle,
            },
          });
          inviteNote = " Company login invitation link has been dispatched to their email.";
        } catch (invErr) {
          console.warn("Could not send staff invitation email", invErr);
          inviteNote = " (User created; email dispatch encountered an issue).";
        }
      }

      await logAuditEvent({
        companyId: currentCompany.id,
        action: "CREATE_USER",
        entityType: "company_user",
        entityId: newUser.id,
        entityName: `${fullName} (${jobTitle})`,
        actorName: currentCompanyUser.fullName,
        details: `Added new user ${fullName} to ${department} department with role ${roleLevel}.${sendInviteEmail ? " Sent company login invitation link." : ""}`,
      });

      setSuccessMsg(`User ${fullName} created successfully.${inviteNote}`);
      setTimeout(() => {
        setModalOpen(false);
        loadUsers();
      }, 1600);
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

      {/* Manager rights restricted notice banner */}
      {isManager && !isAdmin && currentCompanyUser?.permissions?.manage_user_rights === false && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-300">
          <Lock size={16} className="shrink-0 text-amber-600" />
          <span>
            <strong>Staff Rights Restricted:</strong> Your privilege to configure operational rights for staff in your department has been disabled by the Administrator.
          </span>
        </div>
      )}

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
                    {u.roleLevel === "manager" && (
                      <div className="mt-1">
                        {u.permissions?.manage_user_rights === false ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">
                            <Lock size={10} /> Staff Rights Revoked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-600 bg-blue-500/10 px-1.5 py-0.5 rounded">
                            <ShieldCheck size={10} /> Staff Rights Allowed
                          </span>
                        )}
                      </div>
                    )}
                  </td>

                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                      <CheckCircle2 size={13} />
                      <span>Active</span>
                    </span>
                  </td>

                  <td className="px-4 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {canEditUserRights(u) && (
                        <button
                          type="button"
                          onClick={() => openEditRightsModal(u)}
                          className="flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-500/20 transition"
                          title="Edit User Rights & Permissions"
                        >
                          <ShieldCheck size={13} />
                          <span>Rights</span>
                        </button>
                      )}

                      {canResetUserPin(u) && (
                        <button
                          type="button"
                          onClick={() => openResetPinModal(u)}
                          className="flex items-center gap-1 rounded-lg border border-border-color bg-surface-elevated/70 px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-surface-elevated hover:text-blue-600 transition"
                          title="Reset Security PIN"
                        >
                          <KeyRound size={13} className="text-amber-500" />
                          <span>Reset PIN</span>
                        </button>
                      )}

                      {canTriggerPasswordReset(u) && (
                        <button
                          type="button"
                          onClick={() => openResetPasswordModal(u)}
                          className="flex items-center gap-1 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-500/20 transition"
                          title="Trigger Password Reset Email with Company Login Link"
                        >
                          <Mail size={13} />
                          <span>Reset Password</span>
                        </button>
                      )}

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
                    </div>
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

              {/* Send Invitation Email Option */}
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 space-y-1.5">
                <label className="flex items-center gap-2 font-semibold text-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sendInviteEmail}
                    onChange={(e) => setSendInviteEmail(e.target.checked)}
                    className="rounded border-border-color text-blue-600 focus:ring-blue-500"
                  />
                  <span>Send email login invitation with company's unique setup link</span>
                </label>
                {sendInviteEmail && (
                  <p className="text-[11px] text-muted pl-6">
                    Recipient will receive an email directing them to create their password at:{" "}
                    <span className="font-mono text-blue-600 font-semibold">
                      /c/{currentCompany.slug || currentCompany.id}/set-password
                    </span>
                  </p>
                )}
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

      {/* Trigger Staff Password Reset Modal */}
      {resetPasswordModalOpen && passwordResetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-border-color bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-color pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-600">
                  <Mail size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Trigger Password Reset</h3>
                  <p className="text-[11px] text-muted">Authorized by Enterprise Security Policy</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setResetPasswordModalOpen(false)}
                className="text-muted hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="rounded-xl border border-border-color bg-surface-elevated/70 p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted">Staff Member:</span>
                <span className="font-bold text-foreground">{passwordResetTarget.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Email Address:</span>
                <span className="font-semibold text-blue-600">{passwordResetTarget.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Department:</span>
                <span className="capitalize text-foreground">{passwordResetTarget.department.replace("_", " ")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Company Portal:</span>
                <span className="font-mono text-muted">{currentCompany.name}</span>
              </div>
            </div>

            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-foreground space-y-1.5">
              <p className="font-semibold text-blue-700 dark:text-blue-400">What happens next?</p>
              <p className="text-[11px] text-muted leading-relaxed">
                An email will be dispatched to <strong>{passwordResetTarget.email}</strong> containing a secure password reset link directing them to <strong>{currentCompany.name}&apos;s</strong> unique login portal:
              </p>
              <p className="font-mono text-[10px] text-blue-600 bg-surface px-2 py-1 rounded border border-blue-500/20 break-all">
                /c/{currentCompany.slug || currentCompany.id}/set-password?email={encodeURIComponent(passwordResetTarget.email)}&amp;action=reset
              </p>
            </div>

            {passwordResetError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-500/10 p-3 text-xs text-red-600 font-medium">
                <AlertCircle size={15} className="shrink-0" />
                <span>{passwordResetError}</span>
              </div>
            )}

            {passwordResetSuccess && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-600 font-medium">
                <CheckCircle2 size={15} className="shrink-0" />
                <span>{passwordResetSuccess}</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-border-color">
              <button
                type="button"
                onClick={() => setResetPasswordModalOpen(false)}
                className="rounded-xl border border-border-color px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-elevated transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPasswordReset}
                disabled={passwordResetLoading}
                className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50 transition"
              >
                {passwordResetLoading ? (
                  <span>Sending Email...</span>
                ) : (
                  <>
                    <Send size={13} />
                    <span>Send Password Reset Link</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Security PIN Modal */}
      {resetPinModalOpen && pinResetTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl border border-border-color bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-color pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
                  <KeyRound size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-foreground">Reset Security PIN</h3>
                  <p className="text-xs text-muted">
                    Assign a new security PIN for {pinResetTarget.fullName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setResetPinModalOpen(false);
                  setPinResetTarget(null);
                }}
                className="rounded-lg p-1.5 text-muted hover:bg-surface-elevated"
              >
                ✕
              </button>
            </div>

            {pinResetError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-500/10 p-2.5 text-xs text-red-600 border border-red-500/20">
                <AlertCircle size={14} className="shrink-0" />
                <span>{pinResetError}</span>
              </div>
            )}

            {pinResetSuccess && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-2.5 text-xs text-emerald-600 border border-emerald-500/20">
                <CheckCircle2 size={14} className="shrink-0" />
                <span>{pinResetSuccess}</span>
              </div>
            )}

            <form onSubmit={handleExecutePinReset} className="space-y-3.5 text-xs">
              <div className="rounded-xl bg-surface-elevated/60 p-3 space-y-1">
                <p className="font-semibold text-foreground">{pinResetTarget.fullName}</p>
                <p className="text-muted">{pinResetTarget.email} · <span className="capitalize">{pinResetTarget.department}</span></p>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-foreground">New 4-Digit Security PIN *</label>
                <input
                  type="password"
                  maxLength={8}
                  placeholder="••••"
                  autoFocus
                  value={adminNewPin}
                  onChange={(e) => setAdminNewPin(e.target.value)}
                  className="w-full tracking-widest font-mono text-center text-lg rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold text-foreground">Confirm New 4-Digit Security PIN *</label>
                <input
                  type="password"
                  maxLength={8}
                  placeholder="••••"
                  value={adminConfirmPin}
                  onChange={(e) => setAdminConfirmPin(e.target.value)}
                  className="w-full tracking-widest font-mono text-center text-lg rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border-color">
                <button
                  type="button"
                  onClick={() => {
                    setResetPinModalOpen(false);
                    setPinResetTarget(null);
                  }}
                  disabled={pinResetLoading}
                  className="rounded-xl border border-border-color px-4 py-2 font-semibold text-muted hover:bg-surface-elevated transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pinResetLoading}
                  className="rounded-xl bg-amber-600 px-5 py-2 font-bold text-white shadow-md hover:bg-amber-700 transition disabled:opacity-50"
                >
                  {pinResetLoading ? "Resetting..." : "Apply New PIN"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Rights & Permissions Modal */}
      {editRightsModalOpen && rightsTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-border-color bg-surface p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-border-color pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <ShieldCheck size={18} className="text-blue-600" />
                  <h3 className="text-base font-bold text-foreground">Configure User Rights & Roles</h3>
                </div>
                <p className="text-xs text-muted mt-0.5">
                  {isAdmin || isSuperAdmin
                    ? "Administrator Control: Configure role level, departmental assignment, and operational rights."
                    : `Manager Delegation: Configure operational permissions for staff in ${currentCompanyUser.department} department.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditRightsModalOpen(false);
                  setRightsTargetUser(null);
                }}
                className="rounded-lg p-1.5 text-muted hover:bg-surface-elevated hover:text-foreground"
              >
                ✕
              </button>
            </div>

            {rightsError && (
              <div className="flex items-center gap-2 rounded-xl bg-red-500/10 p-3 text-xs text-red-600 border border-red-500/20">
                <AlertCircle size={15} className="shrink-0" />
                <span>{rightsError}</span>
              </div>
            )}

            {rightsSuccess && (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-600 border border-emerald-500/20">
                <CheckCircle2 size={15} className="shrink-0" />
                <span>{rightsSuccess}</span>
              </div>
            )}

            {/* Target User Summary Card */}
            <div className="rounded-2xl border border-border-color bg-surface-elevated/50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-foreground text-sm">{rightsTargetUser.fullName}</h4>
                  <p className="text-xs text-muted">{rightsTargetUser.email}</p>
                </div>
                <span className="rounded-full bg-blue-500/10 px-3 py-0.5 text-xs font-bold text-blue-600 uppercase">
                  {rightsTargetUser.roleLevel.replace(/_/g, " ")}
                </span>
              </div>
              <p className="text-[11px] text-muted capitalize">
                Department: <strong>{rightsTargetUser.department.replace(/_/g, " ")}</strong> • Title:{" "}
                <strong>{rightsTargetUser.jobTitle}</strong>
              </p>
            </div>

            <form onSubmit={handleSaveUserRights} className="space-y-4 text-xs">
              {/* If Admin: can edit Full Name, Department, Job Title, Role Level */}
              {(isAdmin || isSuperAdmin) ? (
                <div className="space-y-3 rounded-2xl border border-border-color bg-surface-elevated/30 p-4">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted block">
                    Role & Department Assignment
                  </span>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block font-semibold text-foreground">Employee Name</label>
                      <input
                        type="text"
                        value={editFullName}
                        onChange={(e) => setEditFullName(e.target.value)}
                        required
                        className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none text-xs"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block font-semibold text-foreground">Department</label>
                      <select
                        value={editDepartment}
                        onChange={(e) => {
                          const newDept = e.target.value as DepartmentType;
                          setEditDepartment(newDept);
                          const titles = JOB_TITLES_BY_DEPARTMENT[newDept] || [];
                          if (titles.length > 0) {
                            setEditJobTitle(titles[0].title);
                            setEditRoleLevel(titles[0].defaultLevel);
                          }
                        }}
                        className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none text-xs font-medium"
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
                      <label className="mb-1 block font-semibold text-foreground">Job Title</label>
                      <input
                        type="text"
                        value={editJobTitle}
                        onChange={(e) => setEditJobTitle(e.target.value)}
                        className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none text-xs"
                        placeholder="e.g. Maintenance - Manager"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block font-semibold text-foreground">Role Level</label>
                      <select
                        value={editRoleLevel}
                        onChange={(e) => setEditRoleLevel(e.target.value as RoleLevel)}
                        className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none text-xs font-bold"
                      >
                        <option value="staff">Staff (Operational)</option>
                        <option value="all_rights">All Rights (Specialist)</option>
                        <option value="manager">Manager (Department Head)</option>
                        <option value="admin">Admin (Administrative Access)</option>
                        {isSuperAdmin && <option value="super_admin">Super Admin (System Owner)</option>}
                      </select>
                    </div>
                  </div>

                  {/* SPECIAL ADMIN CONTROL FOR MANAGERS: GRANT / REVOKE RIGHT TO EDIT STAFF RIGHTS */}
                  {(editRoleLevel === "manager" || rightsTargetUser.roleLevel === "manager") && (
                    <div className="mt-3 rounded-xl border border-blue-500/30 bg-blue-500/10 p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldCheck size={16} className="text-blue-600" />
                          <span className="font-bold text-foreground text-xs">
                            Allow this Manager to Edit Staff Rights
                          </span>
                        </div>
                        <label className="relative inline-flex cursor-pointer items-center">
                          <input
                            type="checkbox"
                            checked={editPermissions.manage_user_rights !== false}
                            onChange={(e) =>
                              setEditPermissions((prev) => ({
                                ...prev,
                                manage_user_rights: e.target.checked,
                              }))
                            }
                            className="peer sr-only"
                          />
                          <div className="peer h-5 w-9 rounded-full bg-muted/40 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:bg-blue-600 peer-checked:after:translate-x-full" />
                        </label>
                      </div>
                      <p className="text-[11px] text-muted">
                        {editPermissions.manage_user_rights !== false
                          ? "Authorized: This manager CAN configure operational permissions for staff in their department."
                          : "Revoked by Administrator: This manager is BLOCKED from editing user rights."}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                /* Manager View: Target user role and department locked */
                <div className="rounded-2xl border border-border-color bg-surface-elevated/30 p-3 text-xs text-muted space-y-1">
                  <p className="font-semibold text-foreground">Department Staff Member</p>
                  <p>
                    You are configuring operational permissions for <strong>{rightsTargetUser.fullName}</strong> in the{" "}
                    <strong>{rightsTargetUser.department}</strong> department. Role level remains standard staff.
                  </p>
                </div>
              )}

              {/* Granular Operational Permissions */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold uppercase tracking-wider text-muted block">
                  Operational Permissions
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <label className="flex items-start gap-2.5 rounded-xl border border-border-color bg-surface-elevated/40 p-2.5 hover:bg-surface-elevated cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={Boolean(editPermissions.view_dashboard)}
                      onChange={() => togglePermission("view_dashboard")}
                      className="mt-0.5 rounded border-border-color text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-bold text-foreground block">View Dashboard</span>
                      <span className="text-[11px] text-muted block">Analytics & company overview</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 rounded-xl border border-border-color bg-surface-elevated/40 p-2.5 hover:bg-surface-elevated cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={Boolean(editPermissions.checkin_guests)}
                      onChange={() => togglePermission("checkin_guests")}
                      className="mt-0.5 rounded border-border-color text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-bold text-foreground block">Front Desk & Check-Ins</span>
                      <span className="text-[11px] text-muted block">Process guest arrivals & rooms</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 rounded-xl border border-border-color bg-surface-elevated/40 p-2.5 hover:bg-surface-elevated cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={Boolean(editPermissions.manage_properties)}
                      onChange={() => togglePermission("manage_properties")}
                      className="mt-0.5 rounded border-border-color text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-bold text-foreground block">Property Management</span>
                      <span className="text-[11px] text-muted block">Properties, units & room setups</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 rounded-xl border border-border-color bg-surface-elevated/40 p-2.5 hover:bg-surface-elevated cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={Boolean(editPermissions.manage_finance)}
                      onChange={() => togglePermission("manage_finance")}
                      className="mt-0.5 rounded border-border-color text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-bold text-foreground block">Finance & Billing</span>
                      <span className="text-[11px] text-muted block">Invoices, bills & rent collection</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 rounded-xl border border-border-color bg-surface-elevated/40 p-2.5 hover:bg-surface-elevated cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={Boolean(editPermissions.manage_maintenance)}
                      onChange={() => togglePermission("manage_maintenance")}
                      className="mt-0.5 rounded border-border-color text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-bold text-foreground block">Maintenance & Work Orders</span>
                      <span className="text-[11px] text-muted block">Work orders, repairs & inventory</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 rounded-xl border border-border-color bg-surface-elevated/40 p-2.5 hover:bg-surface-elevated cursor-pointer transition">
                    <input
                      type="checkbox"
                      checked={Boolean(editPermissions.manage_hr)}
                      onChange={() => togglePermission("manage_hr")}
                      className="mt-0.5 rounded border-border-color text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-bold text-foreground block">Human Resources (HR)</span>
                      <span className="text-[11px] text-muted block">Contracts, payroll & staff leave</span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 rounded-xl border border-border-color bg-surface-elevated/40 p-2.5 hover:bg-surface-elevated cursor-pointer transition sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={Boolean(editPermissions.view_audit_trail)}
                      onChange={() => togglePermission("view_audit_trail")}
                      className="mt-0.5 rounded border-border-color text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <span className="font-bold text-foreground block">Audit Trail & Activity Log</span>
                      <span className="text-[11px] text-muted block">Inspect security and operational audit records</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-border-color">
                <button
                  type="button"
                  onClick={() => {
                    setEditRightsModalOpen(false);
                    setRightsTargetUser(null);
                  }}
                  disabled={savingRights}
                  className="rounded-xl border border-border-color px-4 py-2 font-semibold text-muted hover:bg-surface-elevated transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRights}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 font-bold text-white shadow-md hover:bg-blue-700 transition disabled:opacity-50"
                >
                  <ShieldCheck size={15} />
                  <span>{savingRights ? "Saving Rights..." : "Save User Rights"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}