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
  Flame,
  RefreshCw,
  Zap,
  Sparkles,
  Search,
  UserCheck,
  User,
  ArrowLeft,
  ChevronRight,
  Send,
  Timer,
  Activity,
  Layers,
  Check
} from "lucide-react";

export type NotificationSource =
  | "booking"
  | "post_enquiry"
  | "resident_chat"
  | "general_enquiry"
  | "payment_proof"
  | "tenant_request"
  | "maintenance";

export type TicketStage = "unattended" | "in_progress" | "attended";
export type PriorityLevel = "critical" | "high" | "medium" | "standard" | "low";

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
  
  // Freshdesk / Jira Stage Tracking
  stage: TicketStage;
  stageLabel: string;
  
  // Timing & SLA tracking
  lastCustomerMessageAt: string; // ISO date of last customer message
  timeSinceLastCustomerMsg: { label: string; hours: number };
  timeWaitingOverall: { label: string; ageCategory: "fresh" | "pending" | "escalated"; hours: number };
  
  // Staff Assignment & Attribution
  assignedStaffName: string | null;
  attendedByName?: string | null;
  attendedAt?: string | null;
  
  // Dynamic Priority Matrix (Freshdesk SLA Logic)
  priorityLevel: PriorityLevel;
  priorityScore: number;
  priorityReason: string;
  
  // Actions
  targetUrl: string;
  actionLabel: string;
  tableSource: "commercial_bookings" | "enquiries" | "tenant_payment_proofs" | "tenant_requests" | "maintenance";
  recordId: string;
};

// Formats elapsed time as a live count-up: "4m ago", "1h 22m waiting", "2d 4h waiting"
export function formatElapsedCountUp(isoDate: string): { label: string; ageCategory: "fresh" | "pending" | "escalated"; hours: number } {
  if (!isoDate) return { label: "Just now", ageCategory: "fresh", hours: 0 };
  const created = new Date(isoDate).getTime();
  const now = Date.now();
  const diffMs = Math.max(0, now - created);
  const minutes = Math.floor(diffMs / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  let label = "Just now";
  if (days > 0) {
    const remHours = hours % 24;
    label = `${days}d ${remHours}h`;
  } else if (hours > 0) {
    const remMin = minutes % 60;
    label = `${hours}h ${remMin}m`;
  } else if (minutes > 0) {
    label = `${minutes}m`;
  }

  let ageCategory: "fresh" | "pending" | "escalated" = "fresh";
  if (hours >= 24) ageCategory = "escalated";
  else if (hours >= 3) ageCategory = "pending";

  return { label, ageCategory, hours };
}

export function NotificationsBell() {
  const { currentCompany, user, currentCompanyUser } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<UnifiedNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState<"unattended" | "in_progress" | "attended" | "priorities" | "all">("unattended");

  // Load all notifications across bookings, inquiries, chats, tenant requests, POPs, maintenance
  const fetchAllNotifications = async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    const compId = currentCompany.id;

    try {
      const [bookingsRes, enquiriesRes, messagesRes, proofsRes, requestsRes, maintRes] = await Promise.all([
        // 1. Commercial Bookings
        supabase
          .from("commercial_bookings")
          .select("id, booking_code, guest_name, guest_phone, guest_email, check_in_date, check_out_date, total_amount, booking_status, created_at, updated_at, checked_in_by_name, actual_check_in, properties(name), commercial_rooms(room_number, room_type)")
          .eq("company_id", compId)
          .order("created_at", { ascending: false })
          .limit(30),

        // 2. Enquiries & Chats
        supabase
          .from("enquiries")
          .select("id, customer_name, customer_email, customer_phone, type, message, status, created_at, updated_at, resolved_by_name, resolved_at, assigned_to_user_id, properties(name), room_type_listings(display_name)")
          .eq("company_id", compId)
          .order("created_at", { ascending: false })
          .limit(40),

        // 2b. Enquiry Thread Messages to detect if responded / in-progress
        supabase
          .from("enquiry_messages")
          .select("id, enquiry_id, sender_type, sender_name, created_at")
          .order("created_at", { ascending: false })
          .limit(150),

        // 3. Tenant Payment Proofs (POPs)
        supabase
          .from("tenant_payment_proofs")
          .select("id, customer_name, customer_email, amount, payment_date, reference_number, status, reviewed_by, reviewed_at, created_at")
          .eq("company_id", compId)
          .order("created_at", { ascending: false })
          .limit(20),

        // 4. Tenant Requests
        supabase
          .from("tenant_requests")
          .select("id, type, status, payload, created_at, resolved_at, tenants(full_name, phone, email, properties(name))")
          .order("created_at", { ascending: false })
          .limit(20),

        // 5. Maintenance Requests
        supabase
          .from("maintenance")
          .select("id, description, category, priority, status, created_at, executed_by_name, reported_by, properties(name)")
          .eq("company_id", compId)
          .order("created_at", { ascending: false })
          .limit(20),
      ]);

      const threadMessages = messagesRes.data || [];
      const items: UnifiedNotification[] = [];

      // ── Process Bookings (High/Critical priority depending on check-in date) ──
      (bookingsRes.data || []).forEach((b: any) => {
        const isCheckedInOrOut = b.booking_status === "checked_in" || b.booking_status === "checked_out";
        const hasStaffAttended = Boolean(b.checked_in_by_name);
        
        let stage: TicketStage = "unattended";
        let stageLabel = "New Booking (Needs Confirmation)";
        if (isCheckedInOrOut) {
          stage = "attended";
          stageLabel = b.booking_status === "checked_in" ? "Checked In" : "Checked Out";
        } else if (hasStaffAttended || b.booking_status === "confirmed") {
          stage = "in_progress";
          stageLabel = "Confirmed (Awaiting Guest Arrival)";
        }

        const waitTime = formatElapsedCountUp(b.created_at);
        const propName = b.properties?.name || "Hospitality Suite";
        const roomNum = b.commercial_rooms?.room_number ? `Room ${b.commercial_rooms.room_number}` : "Room Assigned";

        // Check if arrival is today or overdue
        const checkInDate = new Date(b.check_in_date);
        const isArrivalToday = checkInDate.toDateString() === new Date().toDateString();
        const priorityLevel: PriorityLevel = isArrivalToday ? "critical" : "high";

        items.push({
          id: `booking-${b.id}`,
          source: "booking",
          title: `Guest Reservation #${b.booking_code}`,
          subtitle: `${propName} • ${roomNum}`,
          messageSnippet: `Stay reservation from ${new Date(b.check_in_date).toLocaleDateString()} to ${new Date(b.check_out_date).toLocaleDateString()}`,
          customerName: b.guest_name,
          customerPhone: b.guest_phone,
          customerEmail: b.guest_email,
          propertyName: propName,
          roomName: roomNum,
          amount: Number(b.total_amount || 0),
          createdAt: b.created_at,
          stage,
          stageLabel,
          lastCustomerMessageAt: b.created_at,
          timeSinceLastCustomerMsg: { label: waitTime.label, hours: waitTime.hours },
          timeWaitingOverall: waitTime,
          assignedStaffName: b.checked_in_by_name || null,
          attendedByName: b.checked_in_by_name || (stage === "attended" ? "Front Desk" : null),
          attendedAt: b.actual_check_in,
          priorityLevel,
          priorityScore: (isArrivalToday ? 110 : 95) + Math.min(30, waitTime.hours * 2),
          priorityReason: isArrivalToday
            ? "Immediate Arrival Today: Guest checking in today, prepare room key"
            : "Commercial Booking: Revenue reservation awaiting arrival check-in",
          targetUrl: "/commercial-bookings",
          actionLabel: "View Booking",
          tableSource: "commercial_bookings",
          recordId: b.id,
        });
      });

      // ── Process Enquiries & Chats with Freshdesk Responded/In-Progress Logic ──
      (enquiriesRes.data || []).forEach((e: any) => {
        const isResidentChat = (e.message || "").startsWith("[RESIDENT_CHAT]");
        const isPublishedPostLead = Boolean(e.properties?.name || e.room_type_listings?.display_name);

        // Find messages in thread
        const relatedMsgs = threadMessages.filter((m: any) => m.enquiry_id === e.id);
        const staffReplies = relatedMsgs.filter((m: any) => m.sender_type === "staff");
        const customerMsgs = relatedMsgs.filter((m: any) => m.sender_type === "customer");

        const lastCustomerMsgTime = customerMsgs[0]?.created_at || e.created_at;
        const sinceLastCustomer = formatElapsedCountUp(lastCustomerMsgTime);
        const waitOverall = formatElapsedCountUp(e.created_at);

        // STAGE LOGIC:
        // 1. Resolved/Closed -> 'attended'
        // 2. Staff has replied or assigned, but still open -> 'in_progress'
        // 3. No staff reply yet -> 'unattended'
        let stage: TicketStage = "unattended";
        let stageLabel = "Awaiting First Response";

        if (e.status === "resolved" || e.status === "auto_closed" || Boolean(e.resolved_by_name)) {
          stage = "attended";
          stageLabel = "Resolved & Closed";
        } else if (staffReplies.length > 0 || e.status === "in_progress" || Boolean(e.assigned_to_user_id)) {
          stage = "in_progress";
          stageLabel = "In Progress (Responded)";
        }

        // Priority Logic: NOT everything is critical!
        let priorityLevel: PriorityLevel = "standard";
        let priorityScore = 45;
        let priorityReason = "General customer enquiry";

        if (isPublishedPostLead) {
          // Hot lead on showcase listing
          priorityLevel = stage === "unattended" ? "high" : "medium";
          priorityScore = (stage === "unattended" ? 92 : 65) + Math.min(30, sinceLastCustomer.hours);
          priorityReason = "Public Post Lead: Prospective tenant/guest inquiring on public showcase";
        } else if (isResidentChat) {
          // Resident tenant message
          priorityLevel = stage === "unattended" ? "high" : "medium";
          priorityScore = (stage === "unattended" ? 82 : 60) + Math.min(25, sinceLastCustomer.hours);
          priorityReason = "Resident Chat: Active tenant in conversation with property management";
        } else {
          // Routine general enquiry
          priorityLevel = stage === "unattended" ? (sinceLastCustomer.hours > 12 ? "medium" : "standard") : "low";
          priorityScore = 40 + Math.min(20, sinceLastCustomer.hours);
        }

        // Attending staff attribution
        const attendingClerk = e.resolved_by_name || staffReplies[0]?.sender_name || (e.assigned_to_user_id ? "Assigned Staff" : null);

        items.push({
          id: `enquiry-${e.id}`,
          source: isResidentChat ? "resident_chat" : isPublishedPostLead ? "post_enquiry" : "general_enquiry",
          title: isResidentChat
            ? "Resident Chat Message"
            : isPublishedPostLead
            ? `Lead: ${e.room_type_listings?.display_name || e.properties?.name || "Published Showcase"}`
            : "General Inquiry",
          subtitle: e.room_type_listings?.display_name || e.properties?.name || "Customer Portal",
          messageSnippet: (e.message || "").replace("[RESIDENT_CHAT]", "").trim(),
          customerName: e.customer_name,
          customerEmail: e.customer_email,
          customerPhone: e.customer_phone,
          propertyName: e.properties?.name,
          createdAt: e.created_at,
          stage,
          stageLabel,
          lastCustomerMessageAt: lastCustomerMsgTime,
          timeSinceLastCustomerMsg: { label: sinceLastCustomer.label, hours: sinceLastCustomer.hours },
          timeWaitingOverall: waitOverall,
          assignedStaffName: attendingClerk,
          attendedByName: e.resolved_by_name || (stage === "attended" ? attendingClerk : null),
          attendedAt: e.resolved_at,
          priorityLevel,
          priorityScore,
          priorityReason,
          targetUrl: "/enquiries",
          actionLabel: "Open Conversation",
          tableSource: "enquiries",
          recordId: e.id,
        });
      });

      // ── Process Tenant Payment Proofs (POPs) ──
      (proofsRes.data || []).forEach((p: any) => {
        const isAttended = p.status === "verified" || p.status === "rejected";
        const waitTime = formatElapsedCountUp(p.created_at);

        const stage: TicketStage = isAttended ? "attended" : "unattended";
        const stageLabel = isAttended ? (p.status === "verified" ? "Verified" : "Rejected") : "Awaiting Bank Slip Verification";

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
          stage,
          stageLabel,
          lastCustomerMessageAt: p.created_at,
          timeSinceLastCustomerMsg: { label: waitTime.label, hours: waitTime.hours },
          timeWaitingOverall: waitTime,
          assignedStaffName: p.reviewed_by || null,
          attendedByName: p.reviewed_by,
          attendedAt: p.reviewed_at,
          priorityLevel: isAttended ? "standard" : "high",
          priorityScore: (isAttended ? 30 : 85) + Math.min(25, waitTime.hours),
          priorityReason: "Tenant Rent Payment: Requires accounts verification and reconciliation",
          targetUrl: "/tenants",
          actionLabel: "Verify Rent POP",
          tableSource: "tenant_payment_proofs",
          recordId: p.id,
        });
      });

      // ── Process Tenant Requests ──
      (requestsRes.data || []).forEach((tr: any) => {
        const isAttended = tr.status === "resolved" || tr.status === "cancelled" || Boolean(tr.resolved_at);
        const isInProg = tr.status === "in_progress";
        const waitTime = formatElapsedCountUp(tr.created_at);
        const tenant = tr.tenants;

        const stage: TicketStage = isAttended ? "attended" : isInProg ? "in_progress" : "unattended";
        const stageLabel = isAttended ? "Resolved" : isInProg ? "Staff Working" : "Open Tenant Request";

        items.push({
          id: `request-${tr.id}`,
          source: "tenant_request",
          title: `Tenant Service Ticket (${tr.type})`,
          subtitle: tenant?.properties?.name || "Residential Unit",
          messageSnippet: tr.payload?.notes || tr.payload?.description || `Tenant requested assistance regarding ${tr.type}`,
          customerName: tenant?.full_name || "Tenant",
          customerPhone: tenant?.phone,
          customerEmail: tenant?.email,
          propertyName: tenant?.properties?.name,
          createdAt: tr.created_at,
          stage,
          stageLabel,
          lastCustomerMessageAt: tr.created_at,
          timeSinceLastCustomerMsg: { label: waitTime.label, hours: waitTime.hours },
          timeWaitingOverall: waitTime,
          assignedStaffName: stage === "in_progress" ? "Management Office" : null,
          attendedByName: isAttended ? "Management Staff" : null,
          attendedAt: tr.resolved_at,
          priorityLevel: "medium",
          priorityScore: 60 + Math.min(20, waitTime.hours),
          priorityReason: "Tenant Portal Request: Resident inquiry regarding tenancy or unit",
          targetUrl: "/tenants",
          actionLabel: "View Request",
          tableSource: "tenant_requests",
          recordId: tr.id,
        });
      });

      // ── Process Maintenance Work Orders ──
      (maintRes.data || []).forEach((m: any) => {
        const isAttended = m.status === "completed";
        const isInProg = m.status === "in_progress" || Boolean(m.executed_by_name);
        const waitTime = formatElapsedCountUp(m.created_at);
        const isUrgent = m.priority === "urgent" || m.priority === "high";

        const stage: TicketStage = isAttended ? "attended" : isInProg ? "in_progress" : "unattended";
        const stageLabel = isAttended ? "Completed" : isInProg ? `In Progress (${m.executed_by_name || "Dispatched"})` : "Pending Dispatch";

        items.push({
          id: `maint-${m.id}`,
          source: "maintenance",
          title: `${m.priority.toUpperCase()} Maintenance: ${m.category}`,
          subtitle: m.properties?.name || "Facility",
          messageSnippet: m.description,
          customerName: m.reported_by || "Resident / Facility",
          propertyName: m.properties?.name,
          createdAt: m.created_at,
          stage,
          stageLabel,
          lastCustomerMessageAt: m.created_at,
          timeSinceLastCustomerMsg: { label: waitTime.label, hours: waitTime.hours },
          timeWaitingOverall: waitTime,
          assignedStaffName: m.executed_by_name || null,
          attendedByName: m.executed_by_name,
          priorityLevel: isUrgent ? "high" : "medium",
          priorityScore: (isUrgent ? 80 : 50) + Math.min(25, waitTime.hours),
          priorityReason: isUrgent
            ? "Urgent Facility Fault: Potential hazard or severe disruption"
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

  // Unattended count badge (Freshdesk New tickets)
  const unattendedCount = useMemo(() => {
    return notifications.filter((n) => n.stage === "unattended").length;
  }, [notifications]);

  return (
    <>
      {/* ── Bell Icon Button on Top Bar ── */}
      <div className="relative inline-flex items-center">
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          title={`Alerts: ${unattendedCount} New / Unattended`}
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
          currentUserName={currentCompanyUser?.jobTitle ? `${user?.email?.split("@")[0]} (${currentCompanyUser.jobTitle})` : (user?.email || "Staff")}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// World-Class Freshdesk / Jira Style Notification & SLA Modal
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
  activeTab: "unattended" | "in_progress" | "attended" | "priorities" | "all";
  setActiveTab: (tab: "unattended" | "in_progress" | "attended" | "priorities" | "all") => void;
  onRefresh: () => Promise<void>;
  lastRefreshed: Date;
  currentUserName: string;
}) {
  const navigate = useNavigate();
  const [actionInProgressId, setActionInProgressId] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Live count-up tick re-render every 30 seconds
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  // Filtered stage counts
  const unattendedItems = useMemo(() => notifications.filter((n) => n.stage === "unattended"), [notifications]);
  const inProgressItems = useMemo(() => notifications.filter((n) => n.stage === "in_progress"), [notifications]);
  const attendedItems = useMemo(() => notifications.filter((n) => n.stage === "attended"), [notifications]);

  // JIRA / FRESHDESK SLA PRIORITY QUEUE:
  // Dynamically ranks all non-closed items (Unattended + In-Progress), prioritizing Bookings & Published Post Leads
  const priorityQueue = useMemo(() => {
    const activeItems = notifications.filter((n) => n.stage !== "attended");
    return [...activeItems].sort((a, b) => b.priorityScore - a.priorityScore);
  }, [notifications]);

  // Current active list based on tab
  const displayedItems = useMemo(() => {
    let list: UnifiedNotification[] = [];
    if (activeTab === "priorities") {
      list = priorityQueue;
    } else if (activeTab === "unattended") {
      list = unattendedItems;
    } else if (activeTab === "in_progress") {
      list = inProgressItems;
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
          (n.messageSnippet && n.messageSnippet.toLowerCase().includes(q)) ||
          (n.assignedStaffName && n.assignedStaffName.toLowerCase().includes(q))
      );
    }

    return list;
  }, [activeTab, priorityQueue, unattendedItems, inProgressItems, attendedItems, notifications, filterSource, searchQuery]);

  // Quick Action: Self-Assign / Move to In Progress
  const handleAssignToMe = async (item: UnifiedNotification) => {
    setActionInProgressId(item.id);
    const nowIso = new Date().toISOString();
    try {
      if (item.tableSource === "enquiries") {
        await supabase
          .from("enquiries")
          .update({ status: "in_progress", resolved_by_name: currentUserName })
          .eq("id", item.recordId);
      } else if (item.tableSource === "maintenance") {
        await supabase
          .from("maintenance")
          .update({ status: "in_progress", executed_by_name: currentUserName })
          .eq("id", item.recordId);
      } else if (item.tableSource === "commercial_bookings") {
        await supabase
          .from("commercial_bookings")
          .update({ checked_in_by_name: currentUserName })
          .eq("id", item.recordId);
      }
      await onRefresh();
    } catch (err) {
      console.warn("Failed to assign ticket:", err);
    } finally {
      setActionInProgressId(null);
    }
  };

  // Quick Action: Mark as Resolved / Attended
  const handleMarkResolved = async (item: UnifiedNotification) => {
    setActionInProgressId(item.id);
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
      console.warn("Failed to mark resolved:", err);
    } finally {
      setActionInProgressId(null);
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
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-border-color bg-surface-elevated/70 px-5 py-3.5">
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
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 font-black">
                <Layers size={18} />
              </div>
              <div>
                <h3 className="text-base font-bold tracking-tight">Operations Ticket &amp; Alert Center</h3>
                <p className="text-[11px] text-muted">Jira &amp; Freshdesk SLA tracking • Staff assignment • Timers</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-border-color bg-surface px-2.5 py-1.5 text-xs font-semibold text-muted hover:text-foreground transition disabled:opacity-50"
              title="Sync updates"
            >
              <RefreshCw size={13} className={loading ? "animate-spin text-blue-500" : ""} />
              <span className="hidden sm:inline">Sync</span>
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

        {/* ── Freshdesk / Jira Pipeline Stage Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 sm:p-4 bg-surface border-b border-border-color text-xs">
          {/* Stage 1: Unattended */}
          <button
            type="button"
            onClick={() => setActiveTab("unattended")}
            className={`rounded-xl border p-2.5 text-left transition ${
              activeTab === "unattended"
                ? "border-amber-500 bg-amber-500/10 ring-2 ring-amber-500/20"
                : "border-border-color bg-surface-elevated/40 hover:bg-surface-elevated"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400">⚠️ New / Unattended</p>
              <AlertTriangle size={12} className="text-amber-500" />
            </div>
            <p className="text-lg font-black text-foreground mt-0.5">{unattendedItems.length}</p>
            <p className="text-[10px] text-muted truncate">Awaiting 1st staff response</p>
          </button>

          {/* Stage 2: In Progress */}
          <button
            type="button"
            onClick={() => setActiveTab("in_progress")}
            className={`rounded-xl border p-2.5 text-left transition ${
              activeTab === "in_progress"
                ? "border-blue-500 bg-blue-500/10 ring-2 ring-blue-500/20"
                : "border-border-color bg-surface-elevated/40 hover:bg-surface-elevated"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400">🔄 In Progress</p>
              <Activity size={12} className="text-blue-500" />
            </div>
            <p className="text-lg font-black text-foreground mt-0.5">{inProgressItems.length}</p>
            <p className="text-[10px] text-muted truncate">Active staff handling</p>
          </button>

          {/* Stage 3: Attended / Resolved */}
          <button
            type="button"
            onClick={() => setActiveTab("attended")}
            className={`rounded-xl border p-2.5 text-left transition ${
              activeTab === "attended"
                ? "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/20"
                : "border-border-color bg-surface-elevated/40 hover:bg-surface-elevated"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">✅ Resolved</p>
              <CheckCircle2 size={12} className="text-emerald-500" />
            </div>
            <p className="text-lg font-black text-foreground mt-0.5">{attendedItems.length}</p>
            <p className="text-[10px] text-muted truncate">Completed / Closed</p>
          </button>

          {/* SLA Priority Queue */}
          <button
            type="button"
            onClick={() => setActiveTab("priorities")}
            className={`rounded-xl border p-2.5 text-left transition ${
              activeTab === "priorities"
                ? "border-red-500 bg-red-500/10 ring-2 ring-red-500/20"
                : "border-border-color bg-surface-elevated/40 hover:bg-surface-elevated"
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase text-red-600 dark:text-red-400 flex items-center gap-1">
                <Zap size={11} /> Priorities ⚡
              </p>
              <Flame size={12} className="text-red-500" />
            </div>
            <p className="text-lg font-black text-red-600 dark:text-red-400 mt-0.5">{priorityQueue.length}</p>
            <p className="text-[10px] text-muted truncate">Ranked by SLA urgency</p>
          </button>
        </div>

        {/* ── Search & Filter Subheader ── */}
        <div className="flex items-center justify-between border-b border-border-color bg-surface px-4 py-2 gap-3 flex-wrap">
          <div className="flex-1 min-w-[200px] relative">
            <Search size={14} className="absolute left-3 top-2.5 text-muted" />
            <input
              placeholder="Search by customer, unit, room, or staff name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-border-color bg-surface-elevated pl-9 pr-3 py-1.5 text-xs text-foreground outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="rounded-lg border border-border-color bg-surface-elevated px-2.5 py-1.5 text-xs text-foreground outline-none"
            >
              <option value="all">All Channels</option>
              <option value="booking">Direct Bookings</option>
              <option value="post_enquiry">Published Post Leads</option>
              <option value="resident_chat">Resident Chats</option>
              <option value="payment_proof">Rent POPs</option>
              <option value="maintenance">Maintenance Orders</option>
              <option value="tenant_request">Tenant Requests</option>
            </select>
          </div>
        </div>

        {/* ── Priorities Guide Banner (When Priorities Tab Active) ── */}
        {activeTab === "priorities" && (
          <div className="bg-gradient-to-r from-red-500/10 via-amber-500/10 to-transparent border-b border-border-color px-5 py-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Zap size={14} className="text-red-500" />
              <span className="font-bold text-foreground">Multi-Tier Priority Queue:</span>
              <span className="text-muted text-[11px]">
                Bookings &amp; Published Post Leads ranked top for conversion, followed by Rent POPs &amp; Urgent Maintenance.
              </span>
            </div>
            <span className="text-[10px] text-muted shrink-0 ml-2 font-mono">Sorted by SLA Impact</span>
          </div>
        )}

        {/* ── Cards List ── */}
        <div className="max-h-[58vh] overflow-y-auto divide-y divide-border-color p-2 sm:p-4 space-y-2">
          {displayedItems.length === 0 ? (
            <div className="p-12 text-center text-muted">
              <CheckCircle2 size={36} className="mx-auto mb-2 text-emerald-500 opacity-40" />
              <p className="text-sm font-bold text-foreground">No tickets in this stage</p>
              <p className="text-xs mt-1">All conversations and operational items in this view are up-to-date.</p>
            </div>
          ) : (
            displayedItems.map((item) => {
              const sinceLastMsg = item.timeSinceLastCustomerMsg;
              const waitOverall = item.timeWaitingOverall;

              return (
                <div
                  key={item.id}
                  className={`rounded-xl border p-3.5 transition flex flex-col gap-2.5 ${
                    item.stage === "attended"
                      ? "border-border-color bg-surface/50 opacity-85"
                      : item.stage === "in_progress"
                      ? "border-blue-500/30 bg-blue-500/5 hover:border-blue-500/60"
                      : item.priorityLevel === "critical"
                      ? "border-red-500/40 bg-red-500/5 hover:border-red-500"
                      : item.priorityLevel === "high"
                      ? "border-amber-500/40 bg-amber-500/5 hover:border-amber-500"
                      : "border-border-color bg-surface hover:border-border-color/80"
                  }`}
                >
                  {/* Top Bar: Channel Badge + Stage Badge + Timers + Assigned Staff */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Channel Icon */}
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

                      {/* Stage Tag */}
                      <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase ${
                        item.stage === "attended"
                          ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40"
                          : item.stage === "in_progress"
                          ? "bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/40"
                          : "bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/40"
                      }`}>
                        {item.stage === "attended" && "✅ Resolved"}
                        {item.stage === "in_progress" && "🔄 In Progress"}
                        {item.stage === "unattended" && "⚠️ Unattended"}
                      </span>

                      {/* Priority Tag (Freshdesk SLA: Critical/High/Medium/Standard) */}
                      <span className={`rounded-md px-1.5 py-0.5 text-[9px] font-black uppercase ${
                        item.priorityLevel === "critical"
                          ? "bg-red-500/20 text-red-600 dark:text-red-400"
                          : item.priorityLevel === "high"
                          ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                          : item.priorityLevel === "medium"
                          ? "bg-blue-500/20 text-blue-600 dark:text-blue-400"
                          : "bg-slate-500/20 text-slate-600 dark:text-slate-400"
                      }`}>
                        {item.priorityLevel.toUpperCase()}
                      </span>

                      {/* Timer: Time Since Last Customer Message */}
                      <span className="flex items-center gap-1 text-[10px] font-bold rounded-md bg-surface-elevated px-2 py-0.5 text-muted">
                        <Timer size={10} className="text-amber-500" />
                        <span>Last message: {sinceLastMsg.label} ago</span>
                      </span>
                    </div>

                    {/* Assigned Staff Attribution */}
                    <div className="flex items-center gap-1.5 text-[11px]">
                      {item.assignedStaffName ? (
                        <span className="flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400">
                          <UserCheck size={13} />
                          <span>Assigned: {item.assignedStaffName}</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-muted italic">
                          <User size={13} />
                          <span>Unassigned</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Customer Information */}
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
                      {item.roomName && ` • Room: ${item.roomName}`}
                    </p>

                    {item.messageSnippet && (
                      <p className="text-xs text-foreground/85 mt-1 bg-surface-elevated/70 rounded-lg p-2 leading-relaxed border border-border-color/40">
                        "{item.messageSnippet}"
                      </p>
                    )}

                    <p className="text-[10px] text-muted/70 mt-1 italic flex items-center gap-1">
                      <Zap size={10} className="text-amber-500" />
                      <span>{item.priorityReason}</span>
                    </p>
                  </div>

                  {/* Actions & Stage Handlers */}
                  <div className="flex items-center justify-between pt-2 border-t border-border-color/60 gap-2 flex-wrap">
                    <div className="text-[10px] text-muted">
                      Created: {new Date(item.createdAt).toLocaleString()}
                      {item.attendedByName && ` • Attended by: ${item.attendedByName}`}
                    </div>

                    <div className="flex items-center gap-1.5 ml-auto">
                      {/* Self-Assign if unassigned */}
                      {item.stage === "unattended" && !item.assignedStaffName && (
                        <button
                          type="button"
                          onClick={() => handleAssignToMe(item)}
                          disabled={actionInProgressId === item.id}
                          className="flex items-center gap-1 rounded-xl border border-blue-500/40 bg-blue-500/10 px-2.5 py-1 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 transition disabled:opacity-50"
                          title="Assign ticket to myself and start working"
                        >
                          <UserCheck size={12} />
                          <span>Assign to Me</span>
                        </button>
                      )}

                      {/* Mark Resolved / Attended */}
                      {item.stage !== "attended" && (
                        <button
                          type="button"
                          onClick={() => handleMarkResolved(item)}
                          disabled={actionInProgressId === item.id}
                          className="flex items-center gap-1 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition disabled:opacity-50"
                        >
                          <Check size={12} />
                          <span>{actionInProgressId === item.id ? "Updating..." : "Mark Resolved"}</span>
                        </button>
                      )}

                      {/* Direct jump to page */}
                      <button
                        type="button"
                        onClick={() => handleNavigate(item.targetUrl)}
                        className="flex items-center gap-1 rounded-xl bg-blue-600 hover:bg-blue-700 px-3 py-1 text-xs font-bold text-white transition shadow-xs"
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

        {/* ── Footer ── */}
        <div className="flex items-center justify-between border-t border-border-color bg-surface-elevated/70 px-5 py-2.5 text-xs text-muted">
          <span>Active Staff: <strong>{currentUserName}</strong></span>
          <span>Last synced: {lastRefreshed.toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}
