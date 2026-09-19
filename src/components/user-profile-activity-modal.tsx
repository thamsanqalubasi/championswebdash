import { useState, useEffect, useMemo } from "react";
import { Modal } from "@/components/modal";
import {
  fetchUserSessionsAndActivities,
  type UserActivitySummary,
  type UserActionStat,
  type UserLoginSession,
} from "@/lib/activity-tracker";
import type { CompanyUser } from "@/lib/types";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import {
  User,
  Activity,
  Clock,
  Laptop,
  Lock,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Flame,
  Calendar,
  Layers,
  Phone,
  Mail,
  Building2,
  ShieldAlert,
  History,
  TrendingUp,
} from "lucide-react";

interface UserProfileActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: CompanyUser | null;
  companyName: string;
  isSuperAdmin: boolean;
  isManager: boolean;
  currentManagerDept?: string;
}

export function UserProfileActivityModal({
  isOpen,
  onClose,
  targetUser,
  companyName,
  isSuperAdmin,
  isManager,
  currentManagerDept,
}: UserProfileActivityModalProps) {
  const [activeTab, setActiveTab] = useState<"graphs" | "logs" | "sessions">("graphs");
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<UserActivitySummary | null>(null);
  const [searchLog, setSearchLog] = useState("");
  const [logFilter, setLogFilter] = useState("all");
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  // Department manager security check
  const isAccessDenied = useMemo(() => {
    if (!targetUser) return false;
    if (isSuperAdmin) return false;
    if (isManager && currentManagerDept) {
      return targetUser.department !== currentManagerDept;
    }
    return !isSuperAdmin;
  }, [targetUser, isSuperAdmin, isManager, currentManagerDept]);

  useEffect(() => {
    if (!isOpen || !targetUser || isAccessDenied) return;
    setLoading(true);
    setSearchLog("");
    setLogFilter("all");
    setExpandedSessionId(null);

    void (async () => {
      try {
        const res = await fetchUserSessionsAndActivities(
          targetUser.companyId,
          targetUser.email,
          targetUser.fullName,
          targetUser.department,
          targetUser.jobTitle
        );
        setSummary(res);
        if (res.sessions.length > 0) {
          setExpandedSessionId(res.sessions[0].sessionId);
        }
      } catch (err) {
        console.warn("Could not load user activity summary", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, targetUser, isAccessDenied]);

  if (!targetUser) return null;

  const userInitial = targetUser.fullName ? targetUser.fullName.charAt(0).toUpperCase() : "U";

  // Filtered activity logs for Tab 2
  const filteredLogs = useMemo(() => {
    if (!summary) return [];
    return summary.rawAuditLogs.filter((log) => {
      const q = searchLog.toLowerCase();
      const matchesSearch =
        log.action.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q) ||
        log.entityName.toLowerCase().includes(q);

      const matchesFilter =
        logFilter === "all" ||
        log.entityType.toLowerCase().includes(logFilter) ||
        log.action.toLowerCase().includes(logFilter);

      return matchesSearch && matchesFilter;
    });
  }, [summary, searchLog, logFilter]);

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="User Profile & Activity Intelligence"
    >
      <div className="space-y-6 max-h-[82vh] overflow-y-auto pr-1">
        {/* ACCESS RESTRICTION BANNER */}
        {isAccessDenied ? (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-rose-500/20 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
              <ShieldAlert size={28} />
            </div>
            <h3 className="text-base font-bold text-rose-700 dark:text-rose-300">
              Departmental Access Restricted
            </h3>
            <p className="text-xs text-rose-600/90 dark:text-rose-300/80 max-w-md mx-auto leading-relaxed">
              As a Department Manager, your system inspection privileges are strictly scoped to staff members in your own department (<strong>{currentManagerDept?.toUpperCase()}</strong>). You cannot view activity profiles for staff in other departments.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 rounded-xl bg-surface-elevated border border-border-color px-4 py-2 text-xs font-semibold text-foreground hover:bg-surface"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* USER HEADER BANNER */}
            <div className="rounded-2xl border border-border-color bg-surface p-5 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white font-black text-xl shadow-md shrink-0">
                    {userInitial}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-bold text-foreground">{targetUser.fullName}</h2>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${
                          targetUser.roleLevel === "super_admin" || targetUser.roleLevel === "admin"
                            ? "bg-purple-500/10 text-purple-600 border border-purple-500/20"
                            : targetUser.roleLevel === "manager"
                            ? "bg-blue-500/10 text-blue-600 border border-blue-500/20"
                            : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                        }`}
                      >
                        {targetUser.roleLevel.replace("_", " ")}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                        <CheckCircle2 size={10} /> Active
                      </span>
                    </div>
                    <p className="text-xs text-muted mt-0.5 font-medium">
                      {targetUser.jobTitle} • <span className="capitalize">{targetUser.department.replace("_", " ")} Department</span> • {companyName}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-[11px] text-muted">
                      <span className="flex items-center gap-1"><Mail size={12}/> {targetUser.email}</span>
                      {targetUser.createdAt && (
                        <span className="flex items-center gap-1"><Calendar size={12}/> Joined {new Date(targetUser.createdAt).toLocaleDateString()}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* KPI Micro Cards */}
                {summary && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full sm:w-auto border-t sm:border-t-0 sm:border-l border-border-color pt-3 sm:pt-0 sm:pl-4">
                    <div className="rounded-xl bg-surface-elevated/70 p-2 text-center min-w-[75px]">
                      <p className="text-[10px] font-semibold text-muted uppercase">Total Actions</p>
                      <p className="text-sm font-black text-foreground mt-0.5">{summary.totalActions}</p>
                    </div>
                    <div className="rounded-xl bg-surface-elevated/70 p-2 text-center min-w-[75px]">
                      <p className="text-[10px] font-semibold text-muted uppercase">Sessions</p>
                      <p className="text-sm font-black text-blue-600 dark:text-blue-400 mt-0.5">{summary.totalSessions}</p>
                    </div>
                    <div className="rounded-xl bg-surface-elevated/70 p-2 text-center min-w-[75px]">
                      <p className="text-[10px] font-semibold text-muted uppercase">Avg Time</p>
                      <p className="text-sm font-black text-emerald-600 mt-0.5">{summary.averageSessionDuration}</p>
                    </div>
                    <div className="rounded-xl bg-surface-elevated/70 p-2 text-center min-w-[75px]">
                      <p className="text-[10px] font-semibold text-muted uppercase">Last Active</p>
                      <p className="text-sm font-black text-amber-600 mt-0.5">{summary.lastActive}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* TAB CONTROLS */}
            <div className="flex border-b border-border-color gap-2 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab("graphs")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                  activeTab === "graphs"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-muted hover:bg-surface-elevated hover:text-foreground"
                }`}
              >
                <TrendingUp size={15} />
                <span>Visual Graph &amp; Profile</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("logs")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                  activeTab === "logs"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-muted hover:bg-surface-elevated hover:text-foreground"
                }`}
              >
                <Activity size={15} />
                <span>System Activity Log ({summary?.rawAuditLogs.length || 0})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("sessions")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                  activeTab === "sessions"
                    ? "bg-blue-600 text-white shadow-xs"
                    : "text-muted hover:bg-surface-elevated hover:text-foreground"
                }`}
              >
                <Laptop size={15} />
                <span>Login Sessions ({summary?.sessions.length || 0})</span>
              </button>
            </div>

            {loading ? (
              <div className="py-16 text-center text-xs text-muted animate-pulse">
                Loading user profile, action graphs, and login sessions...
              </div>
            ) : (
              <>
                {/* TAB 1: VISUAL GRAPHS & PROFILE */}
                {activeTab === "graphs" && summary && (
                  <div className="space-y-6">
                    {/* Visual Bar Chart: Top Clicked Buttons & Actions */}
                    <div className="rounded-2xl border border-border-color bg-surface p-5 space-y-4 shadow-xs">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                            <Activity size={16} className="text-blue-600" />
                            Most Clicked Buttons &amp; Performed Actions
                          </h3>
                          <p className="text-xs text-muted mt-0.5">
                            Frequency of actions and feature buttons clicked by {targetUser.fullName}
                          </p>
                        </div>
                        <span className="rounded-full bg-blue-500/10 text-blue-600 px-3 py-1 text-xs font-bold">
                          Top: {summary.mostFrequentAction} ({summary.mostFrequentClicks} clicks)
                        </span>
                      </div>

                      {summary.actionStats.length === 0 ? (
                        <p className="text-xs text-muted italic py-8 text-center">No action clicks recorded yet.</p>
                      ) : (
                        <div className="h-64 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={summary.actionStats}
                              layout="vertical"
                              margin={{ top: 5, right: 30, left: 30, bottom: 5 }}
                            >
                              <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                              <XAxis type="number" tick={{ fontSize: 11 }} />
                              <YAxis dataKey="name" type="category" width={140} tick={{ fontSize: 11 }} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "var(--color-surface, #1e293b)",
                                  borderColor: "var(--color-border, #334155)",
                                  borderRadius: "0.75rem",
                                  fontSize: "12px",
                                }}
                                formatter={(val: any) => [`${val} clicks`, "Frequency"]}
                              />
                              <Bar dataKey="clicks" fill="#3b82f6" radius={[0, 8, 8, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </div>

                    {/* Split Row: Category Donut & Permissions Card */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                      {/* Action Category Breakdown */}
                      <div className="rounded-2xl border border-border-color bg-surface p-5 space-y-3 shadow-xs">
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                          <Layers size={16} className="text-emerald-500" />
                          Action Category Breakdown
                        </h3>
                        <p className="text-xs text-muted">Distribution of user operations across operational modules</p>

                        <div className="h-52 w-full flex items-center justify-center">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={summary.categoryStats}
                                dataKey="count"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={45}
                                outerRadius={75}
                                paddingAngle={4}
                              >
                                {summary.categoryStats.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                              </Pie>
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: "var(--color-surface, #1e293b)",
                                  borderColor: "var(--color-border, #334155)",
                                  borderRadius: "0.75rem",
                                  fontSize: "12px",
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-2 border-t border-border-color">
                          {summary.categoryStats.map((cat) => (
                            <span
                              key={cat.name}
                              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold bg-surface-elevated text-foreground"
                            >
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: cat.color }} />
                              <span>{cat.name}: {cat.count}</span>
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Full Profile Details & Rights */}
                      <div className="rounded-2xl border border-border-color bg-surface p-5 space-y-4 shadow-xs">
                        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                          <ShieldCheck size={16} className="text-purple-600" />
                          Security &amp; Operational Permissions
                        </h3>

                        <div className="space-y-2 text-xs">
                          <div className="flex justify-between py-1.5 border-b border-border-color/60">
                            <span className="text-muted">Security PIN Status</span>
                            <span className="font-bold text-emerald-600 flex items-center gap-1">
                              <CheckCircle2 size={13} /> Configured &amp; Active
                            </span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-border-color/60">
                            <span className="text-muted">Department Scope</span>
                            <span className="font-bold text-foreground capitalize">{targetUser.department.replace("_", " ")}</span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-border-color/60">
                            <span className="text-muted">Role Privilege Level</span>
                            <span className="font-bold text-foreground capitalize">{targetUser.roleLevel.replace("_", " ")}</span>
                          </div>
                        </div>

                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wider text-muted mb-2">Granted Feature Rights</p>
                          <div className="grid grid-cols-2 gap-1.5">
                            {Object.entries(targetUser.permissions || {
                              view_dashboard: true,
                              checkin_guests: targetUser.department === "front_desk",
                              manage_properties: targetUser.roleLevel !== "staff",
                              manage_finance: targetUser.department === "accountant",
                              manage_maintenance: targetUser.department === "maintenance",
                              manage_hr: targetUser.department === "human_resources",
                              manage_audit: targetUser.roleLevel === "super_admin",
                            }).map(([key, val]) => (
                              <div
                                key={key}
                                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold border ${
                                  val
                                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                                    : "border-border-color/40 bg-surface-elevated/40 text-muted opacity-60"
                                }`}
                              >
                                {val ? <CheckCircle2 size={11} className="text-emerald-600" /> : <XCircle size={11} />}
                                <span className="truncate capitalize">{key.replace(/_/g, " ")}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: SYSTEM ACTIVITY LOG */}
                {activeTab === "logs" && (
                  <div className="space-y-4">
                    {/* Search and Filters */}
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <div className="relative flex-1 w-full">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                        <input
                          type="search"
                          placeholder="Search action, details, entity..."
                          value={searchLog}
                          onChange={(e) => setSearchLog(e.target.value)}
                          className="w-full rounded-xl border border-border-color bg-surface-elevated pl-9 pr-4 py-2 text-xs text-foreground outline-none focus:border-blue-600"
                        />
                      </div>
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Filter size={13} className="text-muted" />
                        <select
                          value={logFilter}
                          onChange={(e) => setLogFilter(e.target.value)}
                          className="rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-xs font-semibold text-foreground outline-none"
                        >
                          <option value="all">All Actions</option>
                          <option value="button">Button Clicks</option>
                          <option value="financial">Financial &amp; Rent</option>
                          <option value="checkin">Check-in &amp; Booking</option>
                          <option value="user">User &amp; Roles</option>
                        </select>
                      </div>
                    </div>

                    {filteredLogs.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border-color p-8 text-center text-xs text-muted">
                        No activity records found matching your search.
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-border-color bg-surface overflow-hidden divide-y divide-border-color/60">
                        {filteredLogs.map((log) => (
                          <div key={log.id} className="p-3.5 hover:bg-surface-elevated/40 transition flex items-start gap-3">
                            <div className="h-8 w-8 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                              <Activity size={15} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="font-bold text-xs text-foreground">{log.action.replace(/_/g, " ")}</span>
                                <span className="text-[11px] text-muted font-medium flex items-center gap-1">
                                  <Clock size={11} />
                                  {new Date(log.createdAt).toLocaleString()}
                                </span>
                              </div>
                              <p className="text-xs text-muted mt-0.5 leading-relaxed">{log.details}</p>
                              {log.entityName && log.entityName !== log.entityType && (
                                <span className="inline-block mt-1.5 rounded-md bg-surface-elevated px-2 py-0.5 text-[10px] font-bold text-foreground">
                                  Target: {log.entityName}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: LOGIN SESSIONS */}
                {activeTab === "sessions" && summary && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs text-muted">
                        Historical login sessions and timeline of activities executed within each session.
                      </p>
                      <span className="text-xs font-bold text-foreground">{summary.sessions.length} sessions logged</span>
                    </div>

                    {summary.sessions.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border-color p-8 text-center text-xs text-muted">
                        No recorded login sessions.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {summary.sessions.map((session) => {
                          const isExpanded = expandedSessionId === session.sessionId;
                          return (
                            <div
                              key={session.sessionId}
                              className="rounded-2xl border border-border-color bg-surface overflow-hidden transition shadow-xs"
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  setExpandedSessionId(isExpanded ? null : session.sessionId)
                                }
                                className="w-full p-4 flex items-center justify-between text-left hover:bg-surface-elevated/40 transition gap-4"
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                                      session.isActiveNow
                                        ? "bg-emerald-500/20 text-emerald-600"
                                        : "bg-surface-elevated text-muted"
                                    }`}
                                  >
                                    <Laptop size={18} />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="font-bold text-xs text-foreground">{session.sessionId}</span>
                                      {session.isActiveNow ? (
                                        <span className="rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider">
                                          Active Now
                                        </span>
                                      ) : (
                                        <span className="text-[11px] text-muted font-semibold">
                                          Duration: {session.durationFormatted}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-muted mt-0.5">
                                      {new Date(session.startTime).toLocaleString()} • {session.device} ({session.browser})
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-lg">
                                    {session.activitiesCount} activities
                                  </span>
                                  {isExpanded ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
                                </div>
                              </button>

                              {/* Nested per-session activities list */}
                              {isExpanded && (
                                <div className="border-t border-border-color/60 bg-surface-elevated/20 p-4 space-y-2.5 animate-in fade-in duration-200">
                                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                                    Activities in this session ({session.activities.length}):
                                  </p>
                                  <div className="space-y-1.5">
                                    {session.activities.map((act) => (
                                      <div
                                        key={act.id}
                                        className="flex items-center justify-between gap-2 rounded-xl border border-border-color/40 bg-surface p-2.5 text-xs text-foreground"
                                      >
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500 shrink-0" />
                                          <span className="font-semibold truncate">{act.description}</span>
                                        </div>
                                        <span className="text-[10px] text-muted shrink-0 font-medium">
                                          {new Date(act.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
