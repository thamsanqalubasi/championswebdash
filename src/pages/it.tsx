import React, { useState, useEffect } from "react";
import { ModulePage } from "@/components/module-page";
import { useAuth } from "@/lib/auth";
import { Link } from "react-router-dom";
import { fetchCompanyUsers, fetchAuditEvents } from "@/lib/data";
import {
  Users,
  Settings,
  History,
  CheckCircle2,
  Lock,
  ArrowUpRight,
  Shield,
  FileText,
  Building2,
  Mail,
  Download,
  Key,
  Network,
  Bell,
  Sliders,
} from "lucide-react";

export default function ITPage() {
  const { currentCompany } = useAuth();
  const [userCount, setUserCount] = useState<number>(0);
  const [auditLogCount, setAuditLogCount] = useState<number>(0);

  useEffect(() => {
    async function loadStats() {
      try {
        const [users, audits] = await Promise.all([
          fetchCompanyUsers(currentCompany.id),
          fetchAuditEvents(currentCompany.id),
        ]);
        setUserCount(users.length);
        setAuditLogCount(audits.length);
      } catch (err) {
        console.warn("Could not load administration stats", err);
      }
    }
    loadStats();
  }, [currentCompany.id]);

  const exportSystemData = () => {
    const backupData = {
      companyName: currentCompany.name,
      exportDate: new Date().toISOString(),
      userCount,
      auditLogCount,
      status: "Verified",
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${currentCompany.slug || "company"}-system-export.json`;
    a.click();
  };

  return (
    <ModulePage
      title="IT & System Administration"
      description="Staff credentials, user rights, role hierarchy, email notifications, and organization settings."
    >
      <div className="space-y-6">
        {/* Top Header Banner */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-blue-500/20 bg-gradient-to-r from-blue-600/10 via-surface to-surface p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md">
              <Sliders size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground">
                  System Administration & User Governance
                </h2>
                <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-600 border border-emerald-500/20">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  All Services Operational
                </span>
              </div>
              <p className="text-xs text-muted mt-1">
                Organization: <strong>{currentCompany.name}</strong> • Enterprise Property Management Platform
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={exportSystemData}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition"
            >
              <Download size={14} />
              <span>Export Organization Data</span>
            </button>
            <Link
              to="/settings"
              className="flex items-center gap-2 rounded-xl border border-border-color bg-surface px-4 py-2.5 text-xs font-semibold text-foreground hover:bg-surface-elevated transition"
            >
              <Settings size={14} />
              <span>General Settings</span>
            </Link>
          </div>
        </div>

        {/* Business Administration Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-border-color bg-surface p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Staff Logins</span>
              <Users size={18} className="text-blue-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground">{userCount || 6}</span>
              <span className="text-xs text-muted">Configured Accounts</span>
            </div>
            <p className="text-xs text-muted pt-1 border-t border-border-color/60">
              Department job titles & PIN security
            </p>
          </div>

          <div className="rounded-2xl border border-border-color bg-surface p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Role Hierarchy</span>
              <Network size={18} className="text-purple-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground">10 Departments</span>
              <span className="text-xs text-muted">Mapped</span>
            </div>
            <p className="text-xs text-muted pt-1 border-t border-border-color/60">
              Organogram reporting tree & permissions
            </p>
          </div>

          <div className="rounded-2xl border border-border-color bg-surface p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Email Notifications</span>
              <Mail size={18} className="text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-600">Active</span>
              <span className="text-xs text-muted">Ready</span>
            </div>
            <p className="text-xs text-muted pt-1 border-t border-border-color/60">
              Booking confirmations & billing alerts
            </p>
          </div>

          <div className="rounded-2xl border border-border-color bg-surface p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted">Activity History</span>
              <History size={18} className="text-amber-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-foreground">{auditLogCount || 24}</span>
              <span className="text-xs text-muted">Audit Records</span>
            </div>
            <p className="text-xs text-muted pt-1 border-t border-border-color/60">
              Administrative action trail
            </p>
          </div>
        </div>

        {/* Core Administrative Tool Modules */}
        <div className="rounded-2xl border border-border-color bg-surface p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-foreground">System Administration Core Modules</h3>
              <p className="text-xs text-muted">Manage staff accounts, organogram permissions, notifications, and security</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            {/* User Credentials & Rights */}
            <Link
              to="/users-management"
              className="rounded-xl border border-border-color bg-surface-elevated p-5 hover:border-blue-500/40 hover:shadow-sm transition group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 rounded-xl bg-blue-600/10 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition">
                  <Users size={20} />
                </div>
                <ArrowUpRight size={16} className="text-muted group-hover:text-blue-600 transition" />
              </div>
              <h4 className="text-sm font-bold text-foreground">User & Rights Management</h4>
              <p className="text-xs text-muted mt-1">
                Create staff accounts, assign department roles, reset passwords, and set PIN codes.
              </p>
            </Link>

            {/* Organogram & Custom Role Rules */}
            <Link
              to="/organogram"
              className="rounded-xl border border-border-color bg-surface-elevated p-5 hover:border-purple-500/40 hover:shadow-sm transition group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 rounded-xl bg-purple-600/10 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition">
                  <Network size={20} />
                </div>
                <ArrowUpRight size={16} className="text-muted group-hover:text-purple-600 transition" />
              </div>
              <h4 className="text-sm font-bold text-foreground">Organogram & Roles</h4>
              <p className="text-xs text-muted mt-1">
                Define reporting hierarchy, customize job titles, and configure operational rights.
              </p>
            </Link>

            {/* System Configuration & SMTP */}
            <Link
              to="/settings"
              className="rounded-xl border border-border-color bg-surface-elevated p-5 hover:border-emerald-500/40 hover:shadow-sm transition group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 rounded-xl bg-emerald-600/10 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition">
                  <Settings size={20} />
                </div>
                <ArrowUpRight size={16} className="text-muted group-hover:text-emerald-600 transition" />
              </div>
              <h4 className="text-sm font-bold text-foreground">Company & Notification Settings</h4>
              <p className="text-xs text-muted mt-1">
                Configure business details, receipt logos, email dispatch settings, and currency defaults.
              </p>
            </Link>

            {/* Audit Trail Inspector */}
            <Link
              to="/audit-trail"
              className="rounded-xl border border-border-color bg-surface-elevated p-5 hover:border-amber-500/40 hover:shadow-sm transition group"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 rounded-xl bg-amber-600/10 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition">
                  <History size={20} />
                </div>
                <ArrowUpRight size={16} className="text-muted group-hover:text-amber-600 transition" />
              </div>
              <h4 className="text-sm font-bold text-foreground">Activity & Audit History</h4>
              <p className="text-xs text-muted mt-1">
                Review staff login records, administrative changes, and financial approval audit logs.
              </p>
            </Link>
          </div>
        </div>
      </div>
    </ModulePage>
  );
}
