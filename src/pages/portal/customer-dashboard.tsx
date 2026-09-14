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
} from "lucide-react";
import {
  DEFAULT_ENQUIRY_QUESTIONS,
  getDefaultResponseForQuestion,
  sendEnquiryResponseEmail,
} from "@/lib/enquiry-templates";

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
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagesByEnquiry, setMessagesByEnquiry] = useState<Record<string, EnquiryMessage[]>>({});
  const [expandedEnquiries, setExpandedEnquiries] = useState<Record<string, boolean>>({});
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [submittingReply, setSubmittingReply] = useState<Record<string, boolean>>({});
  const [reopenedNotices, setReopenedNotices] = useState<Record<string, boolean>>({});

  // New enquiry modal state
  const [showNewModal, setShowNewModal] = useState(false);
  const [properties, setProperties] = useState<Array<{ id: string; name: string; type: string }>>([]);
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
      void loadEnquiries(data.session.user.email!);
      void loadProperties();
    });
  }, [navigate]);

  async function loadProperties() {
    try {
      const { data } = await supabase
        .from("properties")
        .select("id, name, type")
        .order("name", { ascending: true })
        .limit(50);
      if (data) setProperties(data);
    } catch {}
  }

  async function loadEnquiries(email: string) {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("enquiries")
        .select("*")
        .eq("customer_email", email)
        .order("created_at", { ascending: false });

      if (data) {
        setEnquiries(data);
        // Automatically expand the first 2 enquiries and load their messages
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
    setLoading(false);
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

      // 1. Insert customer's reply into messages table
      const newMsgPayload = {
        enquiry_id: enquiry.id,
        sender_type: "customer",
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

      // Optimistically update message thread
      setMessagesByEnquiry((prev) => ({
        ...prev,
        [enquiry.id]: [...(prev[enquiry.id] || []), createdMsg],
      }));

      // 2. AUTOMATIC TICKET REOPENING CHECK:
      // If the ticket was resolved, auto_closed, or cancelled, reopen it to "in_progress"
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

      // Clear input
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

      const { data: insertedTicket, error } = await supabase
        .from("enquiries")
        .insert(payload)
        .select()
        .maybeSingle();

      if (error) throw error;

      const ticketId = insertedTicket?.id || "";

      // Generate automated response
      const autoReply = getDefaultResponseForQuestion(newForm.message, {
        propertyName: selectedProp?.name,
        customerName,
      });

      if (ticketId) {
        // Insert conversation thread
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

        // Send email
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/portal/login");
  };

  const userName =
    session?.user?.user_metadata?.full_name || session?.user?.email || "Customer";

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:py-10 text-slate-900 dark:text-slate-100">
      {/* Top Welcome Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold text-xl shrink-0 shadow-xs">
            {userName.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Welcome back</h1>
            <p className="text-gray-500 dark:text-slate-400 text-sm truncate">{userName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => setShowNewModal(true)}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 shadow-xs transition"
          >
            <Plus size={16} /> New Enquiry
          </button>
          <Link
            to="/"
            className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 shadow-xs transition"
          >
            <Home size={15} /> Listings
          </Link>
          <button
            onClick={handleSignOut}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-sm font-medium text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-800 shadow-xs transition"
          >
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </div>

      {/* Header with Title & Refresh */}
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
                    <Clock size={11} className="inline mr-1" />
                    {new Date(e.created_at).toLocaleDateString()}
                  </span>
                </div>

                {e.message && (
                  <p className="text-sm text-gray-800 dark:text-slate-200 font-medium bg-gray-50 dark:bg-slate-800/60 rounded-xl p-3 leading-relaxed border border-gray-100 dark:border-slate-800 mb-3">
                    "{e.message}"
                  </p>
                )}

                {(e.check_in_date || e.check_out_date) && (
                  <p className="text-xs text-gray-500 dark:text-slate-400 mb-3">
                    Check-in: {e.check_in_date || "—"} &rarr; Check-out: {e.check_out_date || "—"}
                  </p>
                )}

                {/* Auto Re-opened Banner if triggered */}
                {isReopened && (
                  <div className="mb-3 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-800 p-2.5 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2 font-medium">
                    <RefreshCw size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
                    <span>
                      Ticket re-opened automatically upon your reply. A leasing agent will follow up shortly!
                    </span>
                  </div>
                )}

                {/* Action Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    {e.status === "open" || e.status === "in_progress" ? (
                      <button
                        onClick={() => handleResolve(e.id)}
                        className="flex items-center gap-1.5 rounded-xl bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800/40 px-3 py-1.5 text-xs font-semibold text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/50 transition"
                      >
                        <CheckCircle size={14} /> Mark as Resolved
                      </button>
                    ) : e.status === "resolved" ? (
                      <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-semibold">
                        <CheckCircle size={14} /> Resolved
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400 capitalize">
                        {e.status.replace(/_/g, " ")}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => toggleExpand(e.id)}
                    className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 py-1 transition"
                  >
                    <MessageSquare size={13} />
                    <span>Conversation ({messages.length})</span>
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>
              </div>

              {/* Conversation Thread & Reply Box */}
              {isExpanded && (
                <div className="border-t border-gray-100 dark:border-slate-800 bg-gray-50/50 dark:bg-slate-950/30 p-4 sm:p-5 space-y-4">
                  <div className="space-y-3">
                    {messages.length === 0 ? (
                      <p className="text-xs text-gray-400 dark:text-slate-500 italic text-center py-2">
                        No recorded message history yet. Post a message below to start the conversation.
                      </p>
                    ) : (
                      messages.map((m) => {
                        const isStaff = m.sender_type === "staff";
                        return (
                          <div
                            key={m.id}
                            className={`flex flex-col ${isStaff ? "items-start" : "items-end"}`}
                          >
                            <div className="flex items-center gap-2 mb-1 px-1">
                              <span className="text-[11px] font-bold text-gray-700 dark:text-slate-300">
                                {m.sender_name || (isStaff ? "Property Management" : "You")}
                              </span>
                              <span className="text-[10px] text-gray-400 dark:text-slate-500">
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
                {/* Select Property if applicable */}
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

                {/* Common Frequent Questions Dropdown */}
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

                {/* Message Textarea */}
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

                {/* Phone */}
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
    </div>
  );
}
