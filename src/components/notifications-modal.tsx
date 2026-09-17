import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  Bell,
  CheckCircle2,
  Clock,
  KeyRound,
  MessageSquare,
  AlertTriangle,
  Receipt,
  Wrench,
  HelpCircle,
  ExternalLink,
  Flame,
  ArrowRight,
  RefreshCw,
  Zap,
  Sparkles,
  Search,
  UserCheck,
  X,
  ArrowLeft,
  ChevronRight
} from "lucide-react";

export type NotificationSource =
  | "booking"
  | "post_enquiry"
  | "resident_chat"
  | "general_enquiry"
  | "payment_proof"
  | "tenant_request"
  | "maintenance";

export type PriorityLevel = "critical" | "high" | "medium" | "standard";

export type UnifiedNotification = {
  id: string;
  source: NotificationSource;
  title: string;
  subtitle: string;
  messageSnippet?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  propertyName?: string;
  roomName?: string;
  amount?: number;
  createdAt: string; // ISO date
  
  // Attended tracking
  isAttended: boolean;
  attendedByName?: string | null;
  attendedAt?: string | null;
  statusLabel: string;
  
  // Priority calculation
  priorityLevel: PriorityLevel;
  priorityScore: number;
  priorityReason: string;
  
  // Navigation & direct actions
  targetUrl: string;
  actionLabel: string;
  tableSource: "commercial_bookings" | "enquiries" | "tenant_payment_proofs" | "tenant_requests" | "maintenance";
  recordId: string;
};

// Formats elapsed time as a live count-up: "4m ago", "1h 22m waiting", "2d 4h waiting"
export function formatElapsedCountUp(isoDate: string): { label: string; ageCategory: "fresh" | "pending" | "escalated"; hours: number } {
  const created = new Date(isoDate).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - created);
  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let label = "Just now";
  if (days > 0) {
    const remHours = hours % 24;
    label = `${days}d ${remHours}h waiting`;
  } else if (hours > 0) {
    const remMin = minutes % 60;
    label = `${hours}h ${remMin}m waiting`;
  } else if (minutes > 0) {
    label = `${minutes}m waiting`;
  }

  let ageCategory: "fresh" | "pending" | "escalated" = "fresh";
  if (hours >= 24) ageCategory = "escalated";
  else if (hours >= 2) ageCategory = "pending";

  return { label, ageCategory, hours };
}

export function NotificationsBell() {
  const { currentCompany, user, currentCompanyUser } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<UnifiedNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<"all" | "unattended" | "attended" | "priorities">("unattended");

  // Load all notifications across bookings, inquiries, chats, tenant requests, POPs, maintenance
  const fetchAllNotifications = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    const compId = currentCompany.id;

    try {
      const [bookingsRes, enquiriesRes, proofsRes, requestsRes, maintRes] = await Promise.all([
        // 1. Commercial Bookings
        supabase
          .from("commercial_bookings")
          .select("id, booking_code, guest_name, guest_phone, guest_email, check_in_date, check_out_date, total_amount, booking_status, created_at, checked_in_by_name, actual_check_in, properties(name), commercial_rooms(room_number, room_type)")
          .eq("company_id", compId)
          .order("created_at", { ascending: false })
          .limit(35),

        // 2. Enquiries & Chats
        supabase
          .from("enquiries")
          .select("id, customer_name, customer_email, customer_phone, type, message, status, created_at, resolved_by_name, resolved_at, properties(name), room_type_listings(display_name)")
          .eq("company_id", compId)
          .order("created_at", { ascending: false })
          .limit(45),

        // 3. Tenant Payment Proofs (POPs)
        supabase
          .from("tenant_payment_proofs")
          .select("id, customer_name, customer_email, amount, payment_date, reference_number, status, reviewed_by, reviewed_at, created_at")
          .eq("company_id", compId)
          .order("created_at", { ascending: false })
          .limit(25),

        // 4. Tenant Requests
        supabase
          .from("tenant_requests")
          .select("id, type, status, payload, created_at, resolved_at, tenants(full_name, phone, email, properties(name))")
          .order("created_at", { ascending: false })
          .limit(25),

        // 5. Maintenance Requests
        supabase
          .from("maintenance")
          .select("id, description, category, priority, status, created_at, executed_by_name, reported_by, properties(name)")
          .eq("company_id", compId)
          .order("created_at", { ascending: false })
          .limit(25),
      ]);

      const items: UnifiedNotification[] = [];

      // ── Process Bookings (PRIORITY #1) ──
      (bookingsRes.data || []).forEach((b: any) => {
        const isAttended = b.booking_status === "checked_in" || b.booking_status === "checked_out" || Boolean(b.checked_in_by_name);
        const { hours } = formatElapsedCountUp(b.created_at);
        const propName = b.properties?.name || "Hospitality Suite";
        const roomNum = b.commercial_rooms?.room_number ? `Room ${b.commercial_rooms.room_number}` : "Room Assigned";

        items.push({
          id: `booking-${b.id}`,
          source: "booking",
          title: `New Guest Booking #${b.booking_code}`,
          subtitle: `${propName} • ${roomNum}`,
          messageSnippet: `Stay reservation from ${new Date(b.check_in_date).toLocaleDateString()} to ${new Date(b.check_out_date).toLocaleDateString()}`,
          customerName: b.guest_name,
          customerPhone: b.guest_phone,
          customerEmail: b.guest_email,
          propertyName: propName,
          roomName: roomNum,
          amount: Number(b.total_amount || 0),
          createdAt: b.created_at,
          isAttended,
          attendedByName: b.checked_in_by_name || (isAttended ? "Reception Team" : null),
          attendedAt: b.actual_check_in,
          statusLabel: isAttended ? "Checked In / Attended" : "Unattended (Needs Confirmation)",
          // PRIORITY TECHNIQUE: Bookings are Tier 1 Critical (Score 100+)
          priorityLevel: "critical",
          priorityScore: 100 + Math.min(50, hours * 2),
          priorityReason: "Direct Guest Booking: Immediate room confirmation & arrival reception required",
          targetUrl: "/commercial-bookings",
          actionLabel: "View Booking",
          tableSource: "commercial_bookings",
          recordId: b.id,
        });
      });

      // ── Process Enquiries & Chats (PRIORITY #1 for published post inquiries, #3 for chats) ──
      (enquiriesRes.data || []).forEach((e: any) => {
        const isResidentChat = (e.message || "").startsWith("[RESIDENT_CHAT]");
        const isPublishedPostEnquiry = Boolean(e.properties?.name || e.room_type_listings?.display_name);
        const isAttended = e.status === "resolved" || e.status === "auto_closed" || Boolean(e.resolved_by_name);
        const { hours } = formatElapsedCountUp(e.created_at);

        let source: NotificationSource = "general_enquiry";
        let title = "Customer Inquiry";
        let priorityLevel: PriorityLevel = "standard";
        let priorityScore = 50 + Math.min(30, hours);
        let priorityReason = "General customer question or feedback";

        if (isResidentChat) {
          source = "resident_chat";
          title = "Resident Chat Message";
          priorityLevel = "high";
          priorityScore = 80 + Math.min(40, hours * 2);
          priorityReason = "Assigned Resident Chat: In-house tenant awaiting staff reply";
        } else if (isPublishedPostEnquiry) {
          source = "post_enquiry";
          title = `Public Post Lead — ${e.room_type_listings?.display_name || e.properties?.name || "Published Listing"}`;
          // PRIORITY TECHNIQUE: Published post inquiries are Tier 1 (Score 95+)
          priorityLevel = "critical";
          priorityScore = 95 + Math.min(50, hours * 2);
          priorityReason = "Published Post Lead: Prospective customer inquiry on public showcase";
        }

        items.push({
          id: `enquiry-${e.id}`,
          source,
          title,
          subtitle: e.room_type_listings?.display_name || e.properties?.name || "General Portal",
          messageSnippet: (e.message || "").replace("[RESIDENT_CHAT]", "").trim(),
          customerName: e.customer_name,
          customerEmail: e.customer_email,
          customerPhone: e.customer_phone,
          propertyName: e.properties?.name,
          createdAt: e.created_at,
          isAttended,
          attendedByName: e.resolved_by_name,
          attendedAt: e.resolved_at,
          statusLabel: isAttended ? "Resolved / Replied" : "Unattended (Awaiting Reply)",
          priorityLevel,
          priorityScore,
          priorityReason,
          targetUrl: "/enquiries",
          actionLabel: "Open Enquiry Inbox",
          tableSource: "enquiries",
          recordId: e.id,
        });
      });

      // ── Process Tenant Payment Proofs (POPs) (PRIORITY #2) ──
      (proofsRes.data || []).forEach((p: any) => {
        const isAttended = p.status === "verified" || p.status === "rejected";
        const { hours } = formatElapsedCountUp(p.created_at);

        items.push({
          id: `pop-${p.id}`,
          source: "payment_proof",
          title: "Rent Proof of Payment (POP)",
          subtitle: p.reference_number ? `Ref: ${p.reference_number}` : `Paid on ${p.payment_date}`,
          messageSnippet: `Tenant submitted rent slip receipt for NAD ${Number(p.amount || 0).toLocaleString()}`,
          customerName: p.customer_name || "Assigned Tenant",
          customerEmail: p.customer_email,
          amount: Number(p.amount || 0),
          createdAt: p.created_at,
          isAttended,
          attendedByName: p.reviewed_by,
          attendedAt: p.reviewed_at,
          statusLabel: isAttended ? (p.status === "verified" ? "Verified" : "Rejected") : "Pending Review",
          priorityLevel: "high",
          priorityScore: 85 + Math.min(40, Math.floor(hours * 1.5)),
          priorityReason: "Tenant Rent Payment: Requires accounts verification and receipt matching",
          targetUrl: "/tenants",
          actionLabel: "Review Rent POP",
          tableSource: "tenant_payment_proofs",
          recordId: p.id,
        });
      });

      // ── Process Tenant Requests ──
      (requestsRes.data || []).forEach((tr: any) => {
        const isAttended = tr.status === "resolved" || tr.status === "cancelled" || Boolean(tr.resolved_at);
        const { hours } = formatElapsedCountUp(tr.created_at);
        const tenant = tr.tenants;

        items.push({
          id: `request-${tr.id}`,
          source: "tenant_request",
          title: `Tenant Service Request (${tr.type})`,
          subtitle: tenant?.properties?.name || "Residential Unit",
          messageSnippet: tr.payload?.notes || tr.payload?.description || `Tenant requested assistance regarding ${tr.type}`,
          customerName: tenant?.full_name || "Tenant",
          customerPhone: tenant?.phone,
          customerEmail: tenant?.email,
          propertyName: tenant?.properties?.name,
          createdAt: tr.created_at,
          isAttended,
          attendedByName: isAttended ? "Management Staff" : null,
          attendedAt: tr.resolved_at,
          statusLabel: isAttended ? "Resolved" : "Open Request",
          priorityLevel: "medium",
          priorityScore: 68 + Math.min(30, hours),
          priorityReason: "Tenant Portal Request: Resident inquiry regarding tenancy or unit",
          targetUrl: "/tenants",
          actionLabel: "View Tenant",
          tableSource: "tenant_requests",
          recordId: tr.id,
        });
      });

      // ── Process Maintenance Work Orders ──
      (maintRes.data || []).forEach((m: any) => {
        const isAttended = m.status === "completed" || (m.status === "in_progress" && Boolean(m.executed_by_name));
        const { hours } = formatElapsedCountUp(m.created_at);
        const isUrgent = m.priority === "urgent" || m.priority === "high";

        items.push({
          id: `maint-${m.id}`,
          source: "maintenance",
          title: `${m.priority.toUpperCase()} Maintenance: ${m.category} Fault`,
          subtitle: m.properties?.name || "Facility",
          messageSnippet: m.description,
          customerName: m.reported_by || "Resident / Facility",
          propertyName: m.properties?.name,
          createdAt: m.created_at,
          isAttended,
          attendedByName: m.executed_by_name,
          statusLabel: isAttended ? "Completed / In Progress" : "Pending Dispatch",
          priorityLevel: isUrgent ? "high" : "medium",
          priorityScore: (isUrgent ? 82 : 55) + Math.min(35, hours),
          priorityReason: isUrgent
            ? "Urgent Facility Fault: Potential hazard or severe tenant disruption"
            : "Routine Maintenance: Scheduled repair order",
          targetUrl: "/maintenance",
          actionLabel: "View Work Order",
          tableSource: "maintenance",
          recordId: m.id,
        });
      });

      // Sort globally by createdAt descending
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setNotifications(items);
      setLastRefreshed(new Date());
    } catch (err) {
      console.warn("Could not load notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  // Initial load + periodic poll every 30s
  useEffect(() => {
    void fetchAllNotifications();
    const timer = setInterval(() => {
      void fetchAllNotifications();
    }, 30000);
    return () => clearInterval(timer);
  }, [currentCompany?.id]);

  // Unattended count badge
  const unattendedCount = useMemo(() => {
    return notifications.filter((n) => !n.isAttended).length;
  }, [notifications]);

  // Latest unhandled alert snippet for tooltip
  const latestUnhandled = useMemo(() => {
    return notifications.find((n) => !n.isAttended);
  }, [notifications]);

  return (
    <>
      {/* ── Bell Icon Button on Top Bar ── */}
      <div className="relative inline-flex items-center">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          title={latestUnhandled ? `Alert: ${latestUnhandled.title} (${unattendedCount} unattended)` : "Notifications & Priority Queue"}
          className={`relative flex h-9 w-9 items-center justify-center rounded-lg border transition shadow-xs ${
            unattendedCount > 0
              ? "border-amber-400 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
              : "border-border-color bg-surface-elevated text-muted hover:text-foreground hover:bg-surface"
          }`}
          aria-label="Notifications"
        >
          <Bell size={17} className={unattendedCount > 0 ? "animate-pulse" : ""} />
          {unattendedCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-black text-white shadow-xs">
              {unattendedCount > 99 ? "99+" : unattendedCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Full Notifications & Priorities Popup Modal ── */}
      {modalOpen && (
        <NotificationsModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          notifications={notifications}
          loading={loading}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onRefresh={fetchAllNotifications}
          lastRefreshed={lastRefreshed}
          currentUserName={currentCompanyUser?.jobTitle ? `${user?.email?.split("@")[0]} (${currentCompanyUser.jobTitle})` : (user?.email || "Manager")}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Detailed Notification Modal Component
// ─────────────────────────────────────────────────────────────────────────────

function NotificationsModal({
  open,
  onClose,
  notifications,
  loading,
  activeTab,
  setActiveTab,
  onRefresh,
  lastRefreshed,
  currentUserName,
}: {
  open: boolean;
  onClose: () => void;
  notifications: UnifiedNotification[];
  loading: boolean;
  activeTab: "all" | "unattended" | "attended" | "priorities";
  setActiveTab: (tab: "all" | "unattended" | "attended" | "priorities") => void;
  onRefresh: () => Promise<void>;
  lastRefreshed: Date;
  currentUserName: string;
}) {
  const navigate = useNavigate();
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Live count-up tick re-render every 30 seconds
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  // Filtered sets
  const unattendedItems = useMemo(() => notifications.filter((n) => !n.isAttended), [notifications]);
  const attendedItems = useMemo(() => notifications.filter((n) => n.isAttended), [notifications]);

  // PRIORITY TECHNIQUE SORTED QUEUE:
  // Strictly orders unattended notifications:
  // 1. Bookings & Index Published Post Inquiries first
  // 2. Rent Payment Proofs & Urgent Maintenance next
  // 3. Resident Chats & Tenant Requests next
  // 4. Standard inquiries
  const priorityQueue = useMemo(() => {
    return [...unattendedItems].sort((a, b) => b.priorityScore - a.priorityScore);
  }, [unattendedItems]);

  // Current active list based on tab
  const displayedItems = useMemo(() => {
    let list: UnifiedNotification[] = [];
    if (activeTab === "priorities") {
      list = priorityQueue;
    } else if (activeTab === "unattended") {
      list = unattendedItems;
    } else if (activeTab === "attended") {
      list = attendedItems;
    } else {
      list = notifications;
    }

    if (filterSource !== "all") {
      list = list.filter((n) => n.source === filterSource);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (n) =>
          n.title.toLowerCase().includes(q) ||
          n.customerName.toLowerCase().includes(q) ||
          (n.propertyName && n.propertyName.toLowerCase().includes(q)) ||
          (n.messageSnippet && n.messageSnippet.toLowerCase().includes(q))
      );
    }

    return list;
  }, [activeTab, priorityQueue, unattendedItems, attendedItems, notifications, filterSource, searchQuery]);

  // Mark an item as attended directly in Supabase
  const handleMarkAsAttended = async (item: UnifiedNotification) => {
    setMarkingId(item.id);
    const nowIso = new Date().toISOString();
    try {
      if (item.tableSource === "commercial_bookings") {
        await supabase
          .from("commercial_bookings")
          .update({ checked_in_by_name: currentUserName, booking_status: "checked_in", actual_check_in: nowIso })
          .eq("id", item.recordId);
      } else if (item.tableSource === "enquiries") {
        await supabase
          .from("enquiries")
          .update({ status: "resolved", resolved_by_name: currentUserName, resolved_at: nowIso })
          .eq("id", item.recordId);
      } else if (item.tableSource === "tenant_payment_proofs") {
        await supabase
          .from("tenant_payment_proofs")
          .update({ status: "verified", reviewed_by: currentUserName, reviewed_at: nowIso })
          .eq("id", item.recordId);
      } else if (item.tableSource === "tenant_requests") {
        await supabase
          .from("tenant_requests")
          .update({ status: "resolved", resolved_at: nowIso })
          .eq("id", item.recordId);
      } else if (item.tableSource === "maintenance") {
        await supabase
          .from("maintenance")
          .update({ status: "completed", executed_by_name: currentUserName, completed_date: new Date().toISOString().slice(0, 10) })
          .eq("id", item.recordId);
      }

      await onRefresh();
    } catch (err) {
      console.warn("Failed to mark notification as attended:", err);
    } finally {
      setMarkingId(null);
    }
  };

  const handleNavigate = (url: string) => {
    onClose();
    navigate(url);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-4 px-3 sm:px-4 bg-black/60 backdrop-blur-xs">
      <div className="relative z-10 w-full max-w-4xl rounded-2xl border border-border-color bg-surface text-foreground shadow-2xl my-auto overflow-hidden">
        {/* ── Modal Header ── */}
        <div className="flex items-center justify-between border-b border-border-color bg-surface-elevated/70 px-5 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border-color bg-surface text-muted hover:text-foreground transition shadow-xs"
              title="Close"
            >
              <ArrowLeft size={16} />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 font-black">
                <Bell size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold tracking-tight">System Alerts &amp; Notifications</h3>
                <p className="text-[11px] text-muted">Real-time bookings, post leads, resident chats &amp; tenant tickets</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-border-color bg-surface px-2.5 py-1.5 text-xs font-semibold text-muted hover:text-foreground transition disabled:opacity-50"
              title="Refresh alerts"
            >
              <RefreshCw size={13} className={loading ? "animate-spin text-blue-500" : ""} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-muted hover:text-foreground text-2xl leading-none px-1"
            >
              &times;
            </button>
          </div>
        </div>

        {/* ── Metrics Bar ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 sm:p-4 bg-surface border-b border-border-color text-xs">
          <div className="rounded-xl border border-border-color bg-surface-elevated/50 p-2.5 text-center">
            <p className="text-[10px] font-bold uppercase text-muted">Total Events</p>
            <p className="text-base font-black text-foreground mt-0.5">{notifications.length}</p>
          </div>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-2.5 text-center">
            <p className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">⚠️ Unattended</p>
            <p className="text-base font-black text-amber-600 dark:text-amber-400 mt-0.5">{unattendedItems.length}</p>
          </div>

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-center">
            <p className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">✅ Attended</p>
            <p className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{attendedItems.length}</p>
          </div>

          <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-2.5 text-center">
            <p className="text-[10px] font-bold uppercase text-red-600 dark:text-red-400 flex items-center justify-center gap-1">
              <Flame size={12} /> Priorities
            </p>
            <p className="text-base font-black text-red-600 dark:text-red-400 mt-0.5">
              {unattendedItems.filter((i) => i.priorityLevel === "critical" || i.priorityLevel === "high").length}
            </p>
          </div>
        </div>

        {/* ── Main Tab Navigation Bar ── */}
        <div className="flex items-center justify-between border-b border-border-color bg-surface px-4 py-2.5 flex-wrap gap-2">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab("unattended")}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                activeTab === "unattended"
                  ? "bg-amber-500 text-black shadow-xs"
                  : "text-muted hover:bg-surface-elevated hover:text-foreground"
              }`}
            >
              <AlertTriangle size={13} />
              <span>Unattended</span>
              {unattendedItems.length > 0 && (
                <span className="rounded-full bg-black/20 px-1.5 py-0.2 text-[10px] font-black">
                  {unattendedItems.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("priorities")}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                activeTab === "priorities"
                  ? "bg-red-600 text-white shadow-xs"
                  : "text-muted hover:bg-surface-elevated hover:text-foreground"
              }`}
            >
              <Zap size={13} />
              <span>Priorities ⚡</span>
              <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] font-black">
                {priorityQueue.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("attended")}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                activeTab === "attended"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-muted hover:bg-surface-elevated hover:text-foreground"
              }`}
            >
              <CheckCircle2 size={13} />
              <span>Attended</span>
              <span className="rounded-full bg-white/20 px-1.5 py-0.2 text-[10px] font-black">
                {attendedItems.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                activeTab === "all"
                  ? "bg-surface-elevated text-foreground font-black ring-1 ring-border-color"
                  : "text-muted hover:bg-surface-elevated hover:text-foreground"
              }`}
            >
              <span>All Activity ({notifications.length})</span>
            </button>
          </div>

          {/* Type Filter dropdown */}
          <div className="flex items-center gap-2">
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="rounded-lg border border-border-color bg-surface-elevated px-2.5 py-1 text-xs text-foreground outline-none"
            >
              <option value="all">All Channels</option>
              <option value="booking">Direct Bookings</option>
              <option value="post_enquiry">Published Post Leads</option>
              <option value="resident_chat">Resident Chats</option>
              <option value="payment_proof">Rent POP Proofs</option>
              <option value="maintenance">Maintenance Work Orders</option>
              <option value="tenant_request">Tenant Requests</option>
            </select>
          </div>
        </div>

        {/* ── Priority Technique Header Explanation (Shown when on Priorities tab) ── */}
        {activeTab === "priorities" && (
          <div className="bg-gradient-to-r from-red-500/10 via-amber-500/10 to-transparent border-b border-border-color px-5 py-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Zap size={15} className="text-red-500" />
              <span className="font-bold text-foreground">Priority Technique Active:</span>
              <span className="text-muted">
                <strong>1. Bookings &amp; Published Post Leads</strong> rank first for immediate guest conversion, followed by <strong>2. Payment Proofs</strong> and <strong>3. Resident Chats &amp; Requests</strong>.
              </span>
            </div>
            <span className="text-[10px] text-muted shrink-0 ml-2">Score + Age Multiplier</span>
          </div>
        )}

        {/* ── Search bar ── */}
        <div className="px-5 py-2.5 border-b border-border-color bg-surface/50">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-muted" />
            <input
              placeholder="Search by customer name, property, room, or details..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-border-color bg-surface-elevated pl-9 pr-3 py-1.5 text-xs text-foreground outline-none"
            />
          </div>
        </div>

        {/* ── Notifications List Body ── */}
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-border-color p-2 sm:p-4 space-y-2">
          {displayedItems.length === 0 ? (
            <div className="p-12 text-center text-muted">
              <CheckCircle2 size={36} className="mx-auto mb-2 text-emerald-500 opacity-40" />
              <p className="text-sm font-bold text-foreground">No alerts in this view</p>
              <p className="text-xs mt-1">All tasks are currently up-to-date and attended to.</p>
            </div>
          ) : (
            displayedItems.map((item) => {
              const { label: waitLabel, ageCategory } = formatElapsedCountUp(item.createdAt);

              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-3.5 transition flex flex-col gap-2 ${
                    item.isAttended
                      ? "border-border-color bg-surface/60 opacity-80"
                      : item.priorityLevel === "critical"
                      ? "border-red-500/40 bg-red-500/5 hover:border-red-500"
                      : item.priorityLevel === "high"
                      ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-500"
                      : "border-border-color bg-surface hover:border-border-color/80"
                  }`}
                >
                  {/* Top row: Badges, Elapsed Count-Up & Priority Score */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Channel icon badge */}
                      <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                        item.source === "booking"
                          ? "bg-purple-600 text-white"
                          : item.source === "post_enquiry"
                          ? "bg-blue-600 text-white"
                          : item.source === "resident_chat"
                          ? "bg-emerald-600 text-white"
                          : item.source === "payment_proof"
                          ? "bg-green-700 text-white"
                          : item.source === "maintenance"
                          ? "bg-orange-600 text-white"
                          : "bg-slate-700 text-white"
                      }`}>
                        {item.source === "booking" && <KeyRound size={11} />}
                        {item.source === "post_enquiry" && <Sparkles size={11} />}
                        {item.source === "resident_chat" && <MessageSquare size={11} />}
                        {item.source === "payment_proof" && <Receipt size={11} />}
                        {item.source === "maintenance" && <Wrench size={11} />}
                        {item.source === "tenant_request" && <HelpCircle size={11} />}
                        <span>{item.source.replace(/_/g, " ")}</span>
                      </span>

                      {/* Priority Tag */}
                      <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase ${
                        item.priorityLevel === "critical"
                          ? "bg-red-500/20 text-red-600 dark:text-red-400 border border-red-500/40"
                          : item.priorityLevel === "high"
                          ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40"
                          : "bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/40"
                      }`}>
                        {item.priorityLevel === "critical" && "🔴 Critical"}
                        {item.priorityLevel === "high" && "🟠 High"}
                        {item.priorityLevel === "medium" && "🟡 Medium"}
                        {item.priorityLevel === "standard" && "🔵 Standard"}
                      </span>

                      {/* Elapsed Time Count-Up */}
                      <span className={`flex items-center gap-1 text-[10px] font-bold rounded-md px-2 py-0.5 ${
                        ageCategory === "escalated"
                          ? "bg-red-600 text-white animate-pulse"
                          : ageCategory === "pending"
                          ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                          : "bg-surface-elevated text-muted"
                      }`}>
                        <Clock size={10} />
                        <span>{waitLabel}</span>
                      </span>
                    </div>

                    {/* Attended vs Unattended status indicator */}
                    <div className="flex items-center gap-2">
                      {item.isAttended ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 size={13} />
                          <span>Attended by {item.attendedByName || "Staff"}</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[11px] font-black text-amber-600 dark:text-amber-400">
                          <AlertTriangle size={13} />
                          <span>⚠️ Unattended</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Middle row: Main title, subtitle & message snippet */}
                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <h4 className="font-bold text-sm text-foreground">{item.title}</h4>
                      {item.amount && item.amount > 0 && (
                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 shrink-0">
                          NAD {item.amount.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted mt-0.5">
                      <strong>Customer:</strong> {item.customerName}
                      {item.customerPhone && ` • ${item.customerPhone}`}
                      {item.customerEmail && ` • ${item.customerEmail}`}
                      {item.propertyName && ` • Property: ${item.propertyName}`}
                    </p>
                    {item.messageSnippet && (
                      <p className="text-xs text-foreground/80 mt-1 bg-surface-elevated/60 rounded-lg p-2 leading-relaxed">
                        "{item.messageSnippet}"
                      </p>
                    )}
                    {/* Priority Reason Explanation */}
                    <p className="text-[10px] text-muted/80 mt-1 italic flex items-center gap-1">
                      <Zap size={10} className="text-amber-500" />
                      <span>{item.priorityReason}</span>
                    </p>
                  </div>

                  {/* Bottom row: Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-border-color/60 gap-2 flex-wrap">
                    <div className="text-[10px] text-muted">
                      Created: {new Date(item.createdAt).toLocaleString()}
                    </div>

                    <div className="flex items-center gap-2 ml-auto">
                      {!item.isAttended && (
                        <button
                          type="button"
                          onClick={() => handleMarkAsAttended(item)}
                          disabled={markingId === item.id}
                          className="flex items-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition disabled:opacity-50"
                        >
                          <UserCheck size={13} />
                          <span>{markingId === item.id ? "Marking..." : "Mark as Attended"}</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleNavigate(item.targetUrl)}
                        className="flex items-center gap-1 rounded-xl bg-blue-600 hover:bg-blue-700 px-3.5 py-1.5 text-xs font-bold text-white transition shadow-xs"
                      >
                        <span>{item.actionLabel}</span>
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* ── Modal Footer ── */}
        <div className="flex items-center justify-between border-t border-border-color bg-surface-elevated/70 px-5 py-3 text-xs text-muted">
          <span>Active user: <strong>{currentUserName}</strong></span>
          <span>Last synced: {lastRefreshed.toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}

