import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import {
  MessageSquare,
  CheckCircle,
  Clock,
  LogOut,
  Home,
  Send,
  ChevronDown,
  ChevronUp,
  Plus,
  RefreshCw,
  HelpCircle,
  X,
  Wrench,
  Receipt,
  FileText,
  Upload,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import {
  DEFAULT_ENQUIRY_QUESTIONS,
  getDefaultResponseForQuestion,
  sendEnquiryResponseEmail,
} from "@/lib/enquiry-templates";
import type { TenantPaymentProof } from "@/lib/types";

type Enquiry = {
  id: string;
  type: string;
  status: string;
  message: string;
  created_at: string;
  property_id?: string;
  check_in_date?: string;
  check_out_date?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  company_id?: string;
};

type EnquiryMessage = {
  id: string;
  enquiry_id: string;
  sender_type: "customer" | "staff";
  sender_name: string;
  body: string;
  created_at: string;
};

type MaintenanceItem = {
  id: string;
  property_id?: string;
  category: string;
  priority: string;
  description: string;
  status: string;
  executed_by_name?: string;
  company_id?: string;
  created_at: string;
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
  in_progress: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  resolved: "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300",
  auto_closed: "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400",
  cancelled: "bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-300",
};

export default function CustomerDashboardPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"enquiries" | "maintenance" | "payments">("enquiries");
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesByEnquiry, setMessagesByEnquiry] = useState<Record<string, EnquiryMessage[]>>({});
  const [expandedEnquiries, setExpandedEnquiries] = useState<Record<string, boolean>>({});
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [submittingReply, setSubmittingReply] = useState<Record<string, boolean>>({});
  const [reopenedNotices, setReopenedNotices] = useState<Record<string, boolean>>({});

  // Maintenance state
  const [maintenanceList, setMaintenanceList] = useState<MaintenanceItem[]>([]);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [maintenanceForm, setMaintenanceForm] = useState({
    property_id: "",
    category: "plumbing",
    priority: "medium",
    description: "",
    photo_url: "",
  });
  const [submittingMaintenance, setSubmittingMaintenance] = useState(false);
  const [maintenanceSuccessMsg, setMaintenanceSuccessMsg] = useState("");

  // Rent & Payment Proof (POP) state
  const [paymentProofs, setPaymentProofs] = useState<TenantPaymentProof[]>([]);
  const [showPopModal, setShowPopModal] = useState(false);
  const [popForm, setPopForm] = useState({
    property_id: "",
    amount: "",
    payment_date: new Date().toISOString().slice(0, 10),
    reference_number: "",
    document_url: "",
    notes: "",
  });
  const [submittingPop, setSubmittingPop] = useState(false);
  const [popSuccessMsg, setPopSuccessMsg] = useState("");

  // New enquiry modal state
  const [showNewModal, setShowNewModal] = useState(false);
  const [properties, setProperties] = useState<Array<{ id: string; name: string; type: string; company_id?: string }>>([]);
  const [newForm, setNewForm] = useState({
    property_id: "",
    question_id: "",
    message: "",
    phone: "",
  });
  const [submittingNew, setSubmittingNew] = useState(false);
  const [newSuccessMsg, setNewSuccessMsg] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        navigate("/portal/login");
        return;
      }
      setSession(data.session);
      const email = data.session.user.email!;
      void loadAllData(email);
    });
  }, [navigate]);

  async function loadAllData(email: string) {
    setLoading(true);
    await Promise.all([
      loadProperties(),
      loadEnquiries(email),
      loadMaintenance(email),
      loadPaymentProofs(email),
    ]);
    setLoading(false);
  }

  async function loadProperties() {
    try {
      const { data } = await supabase
        .from("properties")
        .select("id, name, type, company_id")
        .order("name", { ascending: true })
        .limit(50);
      if (data) setProperties(data);
    } catch {}
  }

  async function loadEnquiries(email: string) {
    try {
      const { data } = await supabase
        .from("enquiries")
        .select("*")
        .eq("customer_email", email)
        .order("created_at", { ascending: false });

      if (data) {
        setEnquiries(data);
        const ids = data.map((e) => e.id);
        const initialExpanded: Record<string, boolean> = {};
        data.slice(0, 3).forEach((e) => {
          initialExpanded[e.id] = true;
        });
        setExpandedEnquiries(initialExpanded);
        void loadMessagesForEnquiries(ids);
      }
    } catch (err) {
      console.error("Error loading enquiries:", err);
    }
  }

  async function loadMessagesForEnquiries(enquiryIds: string[]) {
    if (!enquiryIds || enquiryIds.length === 0) return;
    try {
      const { data } = await supabase
        .from("enquiry_messages")
        .select("*")
        .in("enquiry_id", enquiryIds)
        .order("created_at", { ascending: true });

      if (data) {
        const grouped: Record<string, EnquiryMessage[]> = {};
        data.forEach((m: any) => {
          if (!grouped[m.enquiry_id]) grouped[m.enquiry_id] = [];
          grouped[m.enquiry_id].push(m);
        });
        setMessagesByEnquiry((prev) => ({ ...prev, ...grouped }));
      }
    } catch (err) {
      console.warn("Could not load enquiry messages:", err);
    }
  }

  async function loadMaintenance(email: string) {
    try {
      const { data } = await supabase
        .from("maintenance")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) {
        const filtered = data.filter(
          (m: any) =>
            (m.executed_by_name && (m.executed_by_name.includes(email) || m.executed_by_name.includes(userName))) ||
            (m.description && m.description.includes(email))
        );
        setMaintenanceList(filtered.length > 0 ? filtered : data.slice(0, 5));
      }
    } catch (err) {
      console.warn("Could not load maintenance requests:", err);
    }
  }

  async function loadPaymentProofs(email: string) {
    try {
      const { data } = await supabase
        .from("tenant_payment_proofs")
        .select("*")
        .eq("customer_email", email)
        .order("created_at", { ascending: false });
      if (data) setPaymentProofs(data);
    } catch (err) {
      console.warn("Could not load payment proofs:", err);
    }
  }

  const toggleExpand = (id: string) => {
    setExpandedEnquiries((prev) => {
      const nextState = !prev[id];
      if (nextState && !messagesByEnquiry[id]) {
        void loadMessagesForEnquiries([id]);
      }
      return { ...prev, [id]: nextState };
    });
  };

  const handleResolve = async (id: string) => {
    await supabase.from("enquiries").update({ status: "resolved", resolved_by_name: "Customer" }).eq("id", id);
    setEnquiries((prev) => prev.map((e) => (e.id === id ? { ...e, status: "resolved" } : e)));
  };

  const handleSendReply = async (enquiry: Enquiry) => {
    const text = (replyText[enquiry.id] || "").trim();
    if (!text) return;

    setSubmittingReply((prev) => ({ ...prev, [enquiry.id]: true }));
    try {
      const customerName =
        session?.user?.user_metadata?.full_name ||
        enquiry.customer_name ||
        session?.user?.email ||
        "Customer";

      const newMsgPayload = {
        enquiry_id: enquiry.id,
        sender_type: "customer" as const,
        sender_name: customerName,
        body: text,
      };

      const { data: insertedMsg } = await supabase
        .from("enquiry_messages")
        .insert(newMsgPayload)
        .select()
        .maybeSingle();

      const createdMsg: EnquiryMessage = insertedMsg || {
        id: String(Date.now()),
        enquiry_id: enquiry.id,
        sender_type: "customer",
        sender_name: customerName,
        body: text,
        created_at: new Date().toISOString(),
      };

      setMessagesByEnquiry((prev) => ({
        ...prev,
        [enquiry.id]: [...(prev[enquiry.id] || []), createdMsg],
      }));

      const wasClosed = ["resolved", "auto_closed", "cancelled"].includes(enquiry.status);
      if (wasClosed) {
        await supabase
          .from("enquiries")
          .update({
            status: "in_progress",
            resolved_at: null,
            resolved_by_name: null,
          })
          .eq("id", enquiry.id);

        setEnquiries((prev) =>
          prev.map((e) => (e.id === enquiry.id ? { ...e, status: "in_progress" } : e))
        );

        setReopenedNotices((prev) => ({ ...prev, [enquiry.id]: true }));
      }

      setReplyText((prev) => ({ ...prev, [enquiry.id]: "" }));
    } catch (err: any) {
      alert(err?.message || "Failed to send reply. Please try again.");
    }
    setSubmittingReply((prev) => ({ ...prev, [enquiry.id]: false }));
  };

  const handleCreateNewEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newForm.message.trim()) {
      alert("Please enter a message or choose a common question.");
      return;
    }

    setSubmittingNew(true);
    try {
      const email = session?.user?.email!;
      const customerName =
        session?.user?.user_metadata?.full_name || email.split("@")[0] || "Customer";
      const selectedProp = properties.find((p) => p.id === newForm.property_id);

      const payload: any = {
        customer_name: customerName,
        customer_email: email,
        customer_phone: newForm.phone || "",
        type: "rental_enquiry",
        message: newForm.message,
      };

      if (newForm.property_id) {
        payload.property_id = newForm.property_id;
      }
      if (selectedProp?.company_id) {
        payload.company_id = selectedProp.company_id;
      }

      const { data: insertedTicket, error } = await supabase
        .from("enquiries")
        .insert(payload)
        .select()
        .maybeSingle();

      if (error) throw error;

      const ticketId = insertedTicket?.id || "";

      const autoReply = getDefaultResponseForQuestion(newForm.message, {
        propertyName: selectedProp?.name,
        customerName,
      });

      if (ticketId) {
        try {
          await supabase.from("enquiry_messages").insert([
            {
              enquiry_id: ticketId,
              sender_type: "customer",
              sender_name: customerName,
              body: newForm.message,
            },
            {
              enquiry_id: ticketId,
              sender_type: "staff",
              sender_name: "Automated Assistant",
              body: autoReply,
            },
          ]);
        } catch (msgErr) {
          console.warn("Could not insert initial messages:", msgErr);
        }

        try {
          await sendEnquiryResponseEmail({
            toEmail: email,
            customerName,
            propertyName: selectedProp?.name,
            enquiryId: ticketId,
            question: newForm.message,
            response: autoReply,
          });
        } catch (mailErr) {
          console.warn("Could not send automated response email:", mailErr);
        }
      }

      setNewSuccessMsg("Your ticket has been created! An automated response was sent to your email.");
      setTimeout(() => {
        setShowNewModal(false);
        setNewSuccessMsg("");
        setNewForm({ property_id: "", question_id: "", message: "", phone: "" });
        void loadEnquiries(email);
      }, 1800);
    } catch (err: any) {
      alert(err?.message || "Failed to submit enquiry. Please try again.");
    }
    setSubmittingNew(false);
  };

  const handleCreateMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintenanceForm.description.trim()) {
      alert("Please enter a description for the maintenance issue.");
      return;
    }
    setSubmittingMaintenance(true);
    try {
      const email = session?.user?.email!;
      const selectedProp = properties.find((p) => p.id === maintenanceForm.property_id);
      const desc = maintenanceForm.photo_url.trim()
        ? `${maintenanceForm.description.trim()}\n\n[Photo Attachment]: ${maintenanceForm.photo_url.trim()}`
        : maintenanceForm.description.trim();

      const payload: Record<string, any> = {
        category: maintenanceForm.category,
        priority: maintenanceForm.priority,
        description: desc,
        status: "open",
        executed_by_name: `${userName} (${email})`,
      };
      if (maintenanceForm.property_id) {
        payload.property_id = maintenanceForm.property_id;
      }
      if (selectedProp?.company_id) {
        payload.company_id = selectedProp.company_id;
      }

      const { data: inserted, error } = await supabase.from("maintenance").insert(payload).select().maybeSingle();
      if (error) throw error;

      if (inserted) {
        setMaintenanceList((prev) => [inserted, ...prev]);
      }
      setMaintenanceSuccessMsg("Your maintenance request has been submitted! Management will dispatch service shortly.");
      setTimeout(() => {
        setShowMaintenanceModal(false);
        setMaintenanceSuccessMsg("");
        setMaintenanceForm({
          property_id: "",
          category: "plumbing",
          priority: "medium",
          description: "",
          photo_url: "",
        });
      }, 1800);
    } catch (err: any) {
      alert(err?.message || "Failed to submit maintenance request.");
    }
    setSubmittingMaintenance(false);
  };

  const handleCreatePop = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(popForm.amount);
    if (!amt || amt <= 0) {
      alert("Please enter a valid payment amount.");
      return;
    }
    setSubmittingPop(true);
    try {
      const email = session?.user?.email!;
      const selectedProp = properties.find((p) => p.id === popForm.property_id);

      const payload: any = {
        company_id: selectedProp?.company_id || (properties[0]?.company_id || "00000000-0000-0000-0000-000000000000"),
        customer_email: email,
        customer_name: userName,
        property_id: popForm.property_id || null,
        amount: amt,
        payment_date: popForm.payment_date,
        reference_number: popForm.reference_number.trim() || `REF-${Date.now().toString().slice(-6)}`,
        document_url: popForm.document_url.trim() || "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80",
        notes: popForm.notes.trim() || null,
        status: "pending_review",
      };

      const { data: inserted, error } = await supabase.from("tenant_payment_proofs").insert(payload).select().maybeSingle();
      if (error) throw error;

      if (inserted) {
        setPaymentProofs((prev) => [inserted, ...prev]);
      }
      setPopSuccessMsg("Proof of payment submitted successfully! Accounts department will verify and update your invoice.");
      setTimeout(() => {
        setShowPopModal(false);
        setPopSuccessMsg("");
        setPopForm({
          property_id: "",
          amount: "",
          payment_date: new Date().toISOString().slice(0, 10),
          reference_number: "",
          document_url: "",
          notes: "",
        });
      }, 1800);
    } catch (err: any) {
      alert(err?.message || "Failed to submit proof of payment.");
    }
    setSubmittingPop(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/portal/login");
  };

  const userName =
    session?.user?.user_metadata?.full_name || session?.user?.email || "Customer";

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10 text-slate-900 dark:text-slate-100">
      {/* Top Welcome Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold text-xl shrink-0 shadow-xs">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Welcome back</h1>
            <p className="text-gray-500 dark:text-slate-400 text-sm truncate">{userName}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-blue-700 shadow-xs transition"
          >
            <Plus size={15} /> Enquiry
          </button>
          <button
            onClick={() => setShowMaintenanceModal(true)}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-amber-700 shadow-xs transition"
          >
            <Wrench size={15} /> Report Issue
          </button>
          <button
            onClick={() => setShowPopModal(true)}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white hover:bg-emerald-700 shadow-xs transition"
          >
            <Upload size={15} /> Submit POP
          </button>
          <Link
            to="/"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 shadow-xs transition"
          >
            <Home size={14} /> Listings
          </Link>
          <button
            onClick={handleSignOut}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 shadow-xs transition"
          >
            <LogOut size={14} /> Sign Out
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 mb-6 border-b border-gray-200 dark:border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab("enquiries")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
            activeTab === "enquiries"
              ? "bg-blue-600 text-white shadow-xs"
              : "text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
          }`}
        >
          <MessageSquare size={15} />
          Enquiries &amp; Support
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
            activeTab === "enquiries" ? "bg-white/20 text-white" : "bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300"
          }`}>
            {enquiries.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("maintenance")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
            activeTab === "maintenance"
              ? "bg-amber-600 text-white shadow-xs"
              : "text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
          }`}
        >
          <Wrench size={15} />
          Maintenance Requests
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
            activeTab === "maintenance" ? "bg-white/20 text-white" : "bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300"
          }`}>
            {maintenanceList.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("payments")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition ${
            activeTab === "payments"
              ? "bg-emerald-600 text-white shadow-xs"
              : "text-gray-600 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-800"
          }`}
        >
          <Receipt size={15} />
          Rent &amp; Proof of Payment
          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
            activeTab === "payments" ? "bg-white/20 text-white" : "bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300"
          }`}>
            {paymentProofs.length}
          </span>
        </button>
      </div>

      {/* TAB 1: ENQUIRIES & TICKETS */}
      {activeTab === "enquiries" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <MessageSquare size={18} className="text-blue-600 dark:text-blue-400" />
                My Enquiries &amp; Support Tickets
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                View conversations, respond directly, and track responses from management.
              </p>
            </div>
            <button
              onClick={() => session?.user?.email && loadEnquiries(session.user.email)}
              disabled={loading}
              className="text-xs font-semibold text-gray-500 hover:text-blue-600 dark:text-slate-400 flex items-center gap-1.5 transition"
            >
              <RefreshCw size={13} className={loading ? "animate-spin" : ""} /> Refresh
            </button>
          </div>

          {loading && (
            <div className="text-center py-12 text-gray-400 dark:text-slate-500">
              <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-blue-500" />
              Loading your enquiries and conversations...
            </div>
          )}

          {!loading && enquiries.length === 0 && (
            <div className="text-center py-16 text-gray-400 dark:text-slate-500 rounded-2xl border border-dashed border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 p-8">
              <MessageSquare size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold text-gray-700 dark:text-slate-300">No enquiries yet.</p>
              <p className="text-sm mt-1">
                Ask questions about properties, viewings, or lease agreements.
              </p>
              <div className="mt-4 flex justify-center gap-3">
                <button
                  onClick={() => setShowNewModal(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-xs transition"
                >
                  <Plus size={15} /> Create First Enquiry
                </button>
                <Link
                  to="/"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 transition"
                >
                  Browse Listings
                </Link>
              </div>
            </div>
          )}

          {/* Enquiries List */}
          <div className="space-y-4">
            {enquiries.map((e) => {
              const isExpanded = !!expandedEnquiries[e.id];
              const messages = messagesByEnquiry[e.id] || [];
              const isReopened = reopenedNotices[e.id];
              const isClosed = ["resolved", "auto_closed", "cancelled"].includes(e.status);

              return (
                <div
                  key={e.id}
                  className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs transition"
                >
                  {/* Card Header */}
                  <div className="p-4 sm:p-5">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            STATUS_COLORS[e.status] || "bg-gray-100 dark:bg-slate-800 text-gray-600"
                          }`}
                        >
                          {e.status.replace(/_/g, " ").toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-400 dark:text-slate-500 capitalize">
                          {e.type.replace(/_/g, " ")}
                        </span>
                        <span className="text-[11px] font-bold text-gray-400 dark:text-slate-500">
                          #{e.id.slice(0, 8).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-slate-500 whitespace-nowrap">
                        {new Date(e.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {isReopened && (
                      <div className="mb-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
                        <span>🔄</span>
                        <span>
                          <strong>Ticket Re-opened!</strong> Your response automatically placed this ticket back in progress for management review.
                        </span>
                      </div>
                    )}

                    <p className="text-sm font-semibold text-gray-900 dark:text-white leading-relaxed mb-3">
                      {e.message}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleExpand(e.id)}
                          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                        >
                          {isExpanded ? (
                            <>
                              <ChevronUp size={14} /> Hide Conversation ({messages.length})
                            </>
                          ) : (
                            <>
                              <ChevronDown size={14} /> View Conversation ({messages.length})
                            </>
                          )}
                        </button>
                      </div>

                      {e.status === "open" || e.status === "in_progress" ? (
                        <button
                          onClick={() => handleResolve(e.id)}
                          className="text-xs font-medium text-gray-500 hover:text-green-600 dark:text-slate-400 flex items-center gap-1 transition"
                        >
                          <CheckCircle size={13} /> Mark as Resolved
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {/* Message Thread */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 dark:border-slate-800 bg-gray-50/70 dark:bg-slate-900/60 p-4 sm:p-5 space-y-4">
                      <div className="space-y-3">
                        {messages.length === 0 ? (
                          <div className="text-center py-4 text-xs text-gray-400 dark:text-slate-500">
                            No additional messages yet. Reply below to follow up.
                          </div>
                        ) : (
                          messages.map((m) => {
                            const isStaff = m.sender_type === "staff";
                            return (
                              <div
                                key={m.id}
                                className={`flex flex-col ${isStaff ? "items-start" : "items-end"}`}
                              >
                                <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-slate-500 mb-1 px-1">
                                  <span className="font-semibold text-gray-700 dark:text-slate-300">
                                    {isStaff ? "🏢 Staff / Management" : "👤 You"}
                                  </span>
                                  <span>·</span>
                                  <span>
                                    {new Date(m.created_at).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                                <div
                                  className={`rounded-2xl px-4 py-2.5 text-xs max-w-[85%] sm:max-w-[75%] leading-relaxed ${
                                    isStaff
                                      ? "bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 border border-gray-200 dark:border-slate-700 shadow-xs"
                                      : "bg-blue-600 text-white shadow-xs"
                                  }`}
                                >
                                  {m.body}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Reply Input Box */}
                      <div className="pt-3 border-t border-gray-200/70 dark:border-slate-800 space-y-2">
                        {isClosed && (
                          <p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
                            💡 This ticket is currently marked {e.status.replace(/_/g, " ")}. Replying below will automatically re-open it.
                          </p>
                        )}
                        <div className="flex gap-2">
                          <textarea
                            rows={2}
                            placeholder={
                              isClosed
                                ? "Type your response to automatically re-open this ticket..."
                                : "Type your reply to management..."
                            }
                            value={replyText[e.id] || ""}
                            onChange={(evt) =>
                              setReplyText((prev) => ({ ...prev, [e.id]: evt.target.value }))
                            }
                            className="flex-1 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-slate-100 outline-none focus:border-blue-500 resize-none"
                          />
                          <button
                            onClick={() => handleSendReply(e)}
                            disabled={submittingReply[e.id] || !(replyText[e.id] || "").trim()}
                            className="self-end rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-xs flex items-center gap-1.5"
                          >
                            <Send size={13} />
                            {submittingReply[e.id] ? "Sending..." : "Reply"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: MAINTENANCE REQUESTS */}
      {activeTab === "maintenance" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Wrench size={18} className="text-amber-600 dark:text-amber-400" />
                Maintenance &amp; Repairs
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Submit repair work orders, track status, and notify property managers of property issues.
              </p>
            </div>
            <button
              onClick={() => setShowMaintenanceModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 shadow-xs transition"
            >
              <Plus size={14} /> Report Issue
            </button>
          </div>

          {maintenanceList.length === 0 ? (
            <div className="text-center py-16 text-gray-400 dark:text-slate-500 rounded-2xl border border-dashed border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 p-8">
              <Wrench size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold text-gray-700 dark:text-slate-300">No maintenance requests logged.</p>
              <p className="text-sm mt-1">
                Notice any plumbing leaks, electrical faults, or appliance damage? Report it here.
              </p>
              <button
                onClick={() => setShowMaintenanceModal(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700 shadow-xs transition"
              >
                <Plus size={15} /> Report Maintenance Issue
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {maintenanceList.map((m) => {
                const prop = properties.find((p) => p.id === m.property_id);
                return (
                  <div
                    key={m.id}
                    className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          m.status === "completed" ? "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300" :
                          m.status === "in_progress" ? "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300" :
                          "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                        }`}>
                          {m.status.toUpperCase()}
                        </span>
                        <span className="rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-0.5 text-xs font-semibold capitalize">
                          {m.category}
                        </span>
                        <span className={`text-[11px] font-bold uppercase ${
                          m.priority === "urgent" ? "text-red-600" :
                          m.priority === "high" ? "text-orange-600" :
                          "text-gray-500 dark:text-slate-400"
                        }`}>
                          ● {m.priority} priority
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-slate-500">
                        {new Date(m.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    {prop && (
                      <p className="text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <Home size={12} /> {prop.name}
                      </p>
                    )}

                    <p className="text-xs sm:text-sm text-gray-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                      {m.description}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: RENT & PROOF OF PAYMENT (POP) */}
      {activeTab === "payments" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Receipt size={18} className="text-emerald-600 dark:text-emerald-400" />
                Rent &amp; Proof of Payment (POP)
              </h2>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                Upload your bank deposit slips, receipts, or EFT confirmations for rent reconciliation.
              </p>
            </div>
            <button
              onClick={() => setShowPopModal(true)}
              className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs transition"
            >
              <Upload size={14} /> Submit POP
            </button>
          </div>

          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-4 mb-6 flex items-start gap-3">
            <ShieldCheck size={20} className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-900 dark:text-emerald-200 leading-relaxed">
              <strong>Direct Bank Transfer / EFT:</strong> Please make payment to the management company account and submit your proof below. Our accounting team reviews submissions within 24 hours.
            </div>
          </div>

          {paymentProofs.length === 0 ? (
            <div className="text-center py-16 text-gray-400 dark:text-slate-500 rounded-2xl border border-dashed border-gray-200 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-900/50 p-8">
              <Receipt size={48} className="mx-auto mb-3 opacity-30" />
              <p className="font-semibold text-gray-700 dark:text-slate-300">No payment receipts submitted yet.</p>
              <p className="text-sm mt-1">
                Once you make a bank transfer or rent deposit, upload the receipt here to avoid late fees.
              </p>
              <button
                onClick={() => setShowPopModal(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 shadow-xs transition"
              >
                <Upload size={15} /> Upload First Proof of Payment
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {paymentProofs.map((p) => {
                const prop = properties.find((pr) => pr.id === p.property_id);
                return (
                  <div
                    key={p.id}
                    className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          p.status === "verified" ? "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300" :
                          p.status === "rejected" ? "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" :
                          "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                        }`}>
                          {p.status === "verified" ? "VERIFIED" : p.status === "rejected" ? "REJECTED" : "PENDING REVIEW"}
                        </span>
                        <span className="text-xs font-bold text-gray-900 dark:text-white">
                          Ref: {p.reference_number || "N/A"}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400 dark:text-slate-500">
                        Paid on: {p.payment_date}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                          R{Number(p.amount).toLocaleString()}
                        </div>
                        {prop && <p className="text-xs text-gray-500 dark:text-slate-400">{prop.name}</p>}
                      </div>

                      {p.document_url && (
                        <a
                          href={p.document_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:text-slate-200 hover:bg-gray-100 transition"
                        >
                          <FileText size={13} /> View Receipt <ExternalLink size={11} />
                        </a>
                      )}
                    </div>

                    {p.notes && (
                      <p className="text-xs text-gray-600 dark:text-slate-400 bg-gray-50 dark:bg-slate-800/60 p-2.5 rounded-xl">
                        Note: {p.notes}
                      </p>
                    )}

                    {p.status === "rejected" && p.rejection_reason && (
                      <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 p-3 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                        <AlertTriangle size={15} className="shrink-0 mt-0.5 text-red-600" />
                        <div>
                          <strong>Rejection Reason:</strong> {p.rejection_reason}. Please re-submit with the correct receipt or contact accounting.
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

      {/* New Enquiry Modal */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
              <h3 className="font-bold text-gray-900 dark:text-white text-lg flex items-center gap-2">
                <Plus size={18} className="text-blue-600" />
                Submit New Enquiry
              </h3>
              <button
                onClick={() => setShowNewModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            {newSuccessMsg ? (
              <div className="p-6 text-center space-y-2">
                <CheckCircle size={36} className="mx-auto text-green-500" />
                <p className="font-bold text-green-700 dark:text-green-300 text-sm">
                  {newSuccessMsg}
                </p>
              </div>
            ) : (
              <form onSubmit={handleCreateNewEnquiry} className="space-y-4">
                {properties.length > 0 && (
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1 block">
                      Target Property (Optional)
                    </label>
                    <select
                      value={newForm.property_id}
                      onChange={(e) => setNewForm({ ...newForm, property_id: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-slate-100 outline-none focus:border-blue-500"
                    >
                      <option value="">-- General / Any Property --</option>
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.type})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <HelpCircle size={14} className="text-blue-600 dark:text-blue-400" />
                    Select a Common Question
                  </label>
                  <select
                    value={newForm.question_id}
                    onChange={(e) => {
                      const qId = e.target.value;
                      const found = DEFAULT_ENQUIRY_QUESTIONS.find((q) => q.id === qId);
                      setNewForm({
                        ...newForm,
                        question_id: qId,
                        message: found ? found.question : newForm.message,
                      });
                    }}
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-gray-900 dark:text-slate-100 outline-none focus:border-blue-500 mb-2 cursor-pointer"
                  >
                    <option value="">-- Select a frequent question or write custom --</option>
                    {DEFAULT_ENQUIRY_QUESTIONS.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.shortLabel}: {q.question}
                      </option>
                    ))}
                  </select>

                  <div className="flex flex-wrap gap-1 mb-2">
                    {DEFAULT_ENQUIRY_QUESTIONS.map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() =>
                          setNewForm({ ...newForm, question_id: q.id, message: q.question })
                        }
                        className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition ${
                          newForm.question_id === q.id
                            ? "bg-blue-50 border-blue-400 text-blue-700 dark:bg-blue-950/50 dark:border-blue-500 dark:text-blue-300"
                            : "border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50 text-gray-600 dark:text-slate-300 hover:border-blue-300"
                        }`}
                      >
                        {q.shortLabel}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1 block">
                    Your Question / Message *
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Type your question or choose one from the options above..."
                    value={newForm.message}
                    onChange={(e) =>
                      setNewForm({ ...newForm, message: e.target.value, question_id: "" })
                    }
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-slate-100 outline-none focus:border-blue-500 resize-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1 block">
                    Phone Number (Optional)
                  </label>
                  <input
                    type="tel"
                    placeholder="e.g. +264 81 123 4567"
                    value={newForm.phone}
                    onChange={(e) => setNewForm({ ...newForm, phone: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-slate-100 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowNewModal(false)}
                    className="rounded-xl border border-gray-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingNew || !newForm.message.trim()}
                    className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-xs flex items-center gap-1.5"
                  >
                    <Send size={13} />
                    {submittingNew ? "Submitting..." : "Submit Ticket"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Maintenance Request Modal */}
      {showMaintenanceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
              <h3 className="font-bold text-gray-900 dark:text-white text-lg flex items-center gap-2">
                <Wrench size={18} className="text-amber-600" />
                Report Maintenance Issue
              </h3>
              <button
                onClick={() => setShowMaintenanceModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            {maintenanceSuccessMsg ? (
              <div className="p-6 text-center space-y-2">
                <CheckCircle size={36} className="mx-auto text-green-500" />
                <p className="font-bold text-green-700 dark:text-green-300 text-sm">
                  {maintenanceSuccessMsg}
                </p>
              </div>
            ) : (
              <form onSubmit={handleCreateMaintenance} className="space-y-4">
                {properties.length > 0 && (
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1 block">
                      Property / Leased Unit
                    </label>
                    <select
                      value={maintenanceForm.property_id}
                      onChange={(e) => setMaintenanceForm({ ...maintenanceForm, property_id: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-slate-100 outline-none focus:border-amber-500"
                    >
                      <option value="">-- Select Property --</option>
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.type})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1 block">
                      Category
                    </label>
                    <select
                      value={maintenanceForm.category}
                      onChange={(e) => setMaintenanceForm({ ...maintenanceForm, category: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-slate-100 outline-none focus:border-amber-500 capitalize"
                    >
                      <option value="plumbing">Plumbing (Leaks, Taps, Drains)</option>
                      <option value="electrical">Electrical (Lights, Wiring, Outlets)</option>
                      <option value="appliances">Appliances (Stove, Geyser, Fridge)</option>
                      <option value="structural">Structural (Doors, Windows, Roof)</option>
                      <option value="cleaning">Cleaning &amp; Pest Control</option>
                      <option value="general">General Repairs</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1 block">
                      Priority Level
                    </label>
                    <select
                      value={maintenanceForm.priority}
                      onChange={(e) => setMaintenanceForm({ ...maintenanceForm, priority: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-slate-100 outline-none focus:border-amber-500"
                    >
                      <option value="low">Low (Minor issue)</option>
                      <option value="medium">Medium (Needs attention)</option>
                      <option value="high">High (Affects daily use)</option>
                      <option value="urgent">Urgent / Emergency</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1 block">
                    Issue Description *
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe what is broken, location in unit, and when it started..."
                    value={maintenanceForm.description}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-slate-100 outline-none focus:border-amber-500 resize-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1 block">
                    Photo URL / Attachment (Optional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={maintenanceForm.photo_url}
                    onChange={(e) => setMaintenanceForm({ ...maintenanceForm, photo_url: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-slate-100 outline-none focus:border-amber-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowMaintenanceModal(false)}
                    className="rounded-xl border border-gray-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingMaintenance || !maintenanceForm.description.trim()}
                    className="rounded-xl bg-amber-600 px-5 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50 transition shadow-xs flex items-center gap-1.5"
                  >
                    <Wrench size={13} />
                    {submittingMaintenance ? "Submitting..." : "Submit Work Order"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Proof of Payment (POP) Modal */}
      {showPopModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-slate-800">
              <h3 className="font-bold text-gray-900 dark:text-white text-lg flex items-center gap-2">
                <Upload size={18} className="text-emerald-600" />
                Submit Proof of Payment
              </h3>
              <button
                onClick={() => setShowPopModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            {popSuccessMsg ? (
              <div className="p-6 text-center space-y-2">
                <CheckCircle size={36} className="mx-auto text-green-500" />
                <p className="font-bold text-green-700 dark:text-green-300 text-sm">
                  {popSuccessMsg}
                </p>
              </div>
            ) : (
              <form onSubmit={handleCreatePop} className="space-y-4">
                {properties.length > 0 && (
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1 block">
                      Target Property
                    </label>
                    <select
                      value={popForm.property_id}
                      onChange={(e) => setPopForm({ ...popForm, property_id: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-slate-100 outline-none focus:border-emerald-500"
                    >
                      <option value="">-- Select Leased Property --</option>
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1 block">
                      Amount Paid (NAD / R) *
                    </label>
                    <input
                      type="number"
                      placeholder="e.g. 5500"
                      min="1"
                      step="any"
                      required
                      value={popForm.amount}
                      onChange={(e) => setPopForm({ ...popForm, amount: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-slate-100 outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1 block">
                      Payment Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={popForm.payment_date}
                      onChange={(e) => setPopForm({ ...popForm, payment_date: e.target.value })}
                      className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-slate-100 outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1 block">
                    Bank Reference / Transaction # (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. EFT-982348 or ATM Deposit slip #"
                    value={popForm.reference_number}
                    onChange={(e) => setPopForm({ ...popForm, reference_number: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-slate-100 outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1 block">
                    Receipt / POP Document Link (URL or Image)
                  </label>
                  <input
                    type="url"
                    placeholder="https://... (direct link to screenshot, PDF, or cloud receipt)"
                    value={popForm.document_url}
                    onChange={(e) => setPopForm({ ...popForm, document_url: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-slate-100 outline-none focus:border-emerald-500"
                  />
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-1">
                    Paste the link to your uploaded payment slip or banking receipt screenshot.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1 block">
                    Notes / Comments
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Rent for October + water bill..."
                    value={popForm.notes}
                    onChange={(e) => setPopForm({ ...popForm, notes: e.target.value })}
                    className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs text-gray-900 dark:text-slate-100 outline-none focus:border-emerald-500 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPopModal(false)}
                    className="rounded-xl border border-gray-200 dark:border-slate-700 px-4 py-2 text-xs font-semibold text-gray-600 dark:text-slate-300 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPop || !popForm.amount}
                    className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition shadow-xs flex items-center gap-1.5"
                  >
                    <Upload size={13} />
                    {submittingPop ? "Submitting..." : "Submit Proof"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
