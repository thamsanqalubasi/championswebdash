import { useEffect, useState } from "react";
import { ModulePage } from "@/components/module-page";
import { EmptyState, LoadingState } from "@/components/data-state";
import { Modal } from "@/components/modal";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import {
  MessageSquare,
  Clock,
  CheckCircle,
  X,
  Send,
  AlertTriangle,
  Mail,
  Phone,
  Calendar,
  Users,
  HelpCircle,
  Wrench,
  Building,
  Hotel,
  ChevronDown,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { DEFAULT_ENQUIRY_QUESTIONS, sendEnquiryResponseEmail } from "@/lib/enquiry-templates";

type Enquiry = {
  id: string; customer_name: string; customer_email: string; customer_phone: string;
  type: string; status: string; message: string; created_at: string; property_id: string;
  check_in_date: string; check_out_date: string; guests: number;
  resolved_by_name: string; resolved_at: string;
};

type Message = { id: string; sender_type: string; sender_name: string; body: string; created_at: string; };

const TICKET_SUBJECTS = [
  "Plumbing Issue",
  "Electrical & Power Repair",
  "Air Conditioning & HVAC",
  "Lease Renewal / Contract Extension",
  "Appliance Repair",
  "Noise Complaint",
  "Billing & Rent Inquiry",
  "Key, Lock & Access Control",
  "General Property Maintenance",
];

const TYPE_COLORS: Record<string, string> = {
  room_booking: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800",
  property_chat: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
  assigned_property_chat: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800",
  rental_enquiry: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800",
  maintenance_ticket: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800",
  general: "bg-gray-100 text-gray-700 dark:bg-slate-800 dark:text-slate-300 border border-border-color",
};

function formatTypeLabel(type: string) {
  if (type === "room_booking") return "Room Booking Chat";
  if (type === "property_chat" || type === "assigned_property_chat") return "Assigned Property Chat";
  if (type === "maintenance_ticket") return "Maintenance Ticket";
  if (type === "rental_enquiry") return "Rental Enquiry";
  return type.replace(/_/g, " ");
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-orange-100 text-orange-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  resolved: "bg-green-100 text-green-700",
  auto_closed: "bg-gray-100 text-gray-500",
  cancelled: "bg-red-100 text-red-600",
};

export default function EnquiriesPage() {
  const { currentCompany, user } = useAuth();
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [selected, setSelected] = useState<Enquiry | null>(null);
  const [thread, setThread] = useState<Message[]>([]);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [showPromptMenu, setShowPromptMenu] = useState(false);
  const [customSubjectInput, setCustomSubjectInput] = useState("");
  const [showCustomModal, setShowCustomModal] = useState(false);

  const counts = {
    all: enquiries.length,
    open: enquiries.filter(e => e.status === "open").length,
    in_progress: enquiries.filter(e => e.status === "in_progress").length,
    resolved: enquiries.filter(e => e.status === "resolved" || e.status === "auto_closed").length,
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      let loaded: any[] = [];
      try {
        const { data, error } = await supabase
          .from("enquiries")
          .select("*")
          .or(`company_id.eq.${currentCompany.id},company_id.is.null`)
          .order("created_at", { ascending: false });
        if (error) {
          // Fallback simple query
          const { data: fallbackData } = await supabase.from("enquiries").select("*").order("created_at", { ascending: false });
          if (fallbackData) {
            loaded = fallbackData;
          } else if (error.message.includes("does not exist") || error.code === "42P01") {
            setEmpty(true);
          }
        } else if (data) {
          loaded = data;
        }
      } catch {
        setEmpty(true);
      }

      // Merge with locally submitted portal enquiries
      try {
        const stored = JSON.parse(localStorage.getItem("pambabook_enquiries") || "[]");
        if (Array.isArray(stored) && stored.length > 0) {
          const ids = new Set(loaded.map((item: any) => item.id));
          const uniqueLocal = stored.filter((item: any) => !ids.has(item.id));
          loaded = [...uniqueLocal, ...loaded];
        }
      } catch {}

      // Filter by company or include universal/unassigned
      const filtered = loaded.filter((e: any) => 
        !e.company_id || e.company_id === currentCompany.id || e.company_id === "a0000000-0000-0000-0000-000000000001"
      );

      setEnquiries(filtered);
      setEmpty(filtered.length === 0);
      setLoading(false);
    }
    void load();
  }, [currentCompany.id]);

  const openTicket = async (e: Enquiry) => {
    setSelected(e); setReply("");
    try {
      const { data } = await supabase.from("enquiry_messages").select("*").eq("enquiry_id", e.id).order("created_at");
      setThread(data || []);
    } catch { setThread([]); }
  };

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      const staffName = (user as any)?.fullName || user?.email || "Staff";
      await supabase.from("enquiry_messages").insert({ enquiry_id: selected.id, sender_type: "staff", sender_name: staffName, body: reply });
      await supabase.from("enquiries").update({ status: "in_progress" }).eq("id", selected.id);
      setThread(prev => [...prev, { id: Date.now().toString(), sender_type: "staff", sender_name: staffName, body: reply, created_at: new Date().toISOString() }]);
      setEnquiries(prev => prev.map(e => e.id === selected.id ? { ...e, status: "in_progress" } : e));
      setSelected(prev => prev ? { ...prev, status: "in_progress" } : null);

      if (selected.customer_email) {
        void sendEnquiryResponseEmail({
          toEmail: selected.customer_email,
          customerName: selected.customer_name || "Customer",
          propertyName: (selected as any).property_name,
          enquiryId: selected.id,
          question: selected.message || "Enquiry",
          response: reply,
          companyName: currentCompany?.name || "Paimbabook",
        });
      }

      setReply("");
    } catch { alert("Failed to send reply. The enquiry messages table may not exist yet."); }
    setSending(false);
  };

  const promptTenantToOpenTicket = async (subject: string) => {
    if (!selected || !subject.trim()) return;
    setSending(true);
    setShowPromptMenu(false);
    try {
      const staffName = (user as any)?.fullName || user?.email || "Staff";
      const promptBody = `[Ticket Prompt: ${subject.trim()}] Dear ${selected.customer_name}, please log an official service ticket regarding "${subject.trim()}" using the prompt button below so our maintenance team can dispatch a technician and track resolution.`;

      await supabase.from("enquiry_messages").insert({
        enquiry_id: selected.id,
        sender_type: "staff",
        sender_name: staffName,
        body: promptBody,
      });

      await supabase.from("enquiries").update({ status: "in_progress" }).eq("id", selected.id);

      setThread((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          sender_type: "staff",
          sender_name: staffName,
          body: promptBody,
          created_at: new Date().toISOString(),
        },
      ]);

      setEnquiries((prev) => prev.map((e) => (e.id === selected.id ? { ...e, status: "in_progress" } : e)));
      setSelected((prev) => (prev ? { ...prev, status: "in_progress" } : null));

      if (selected.customer_email) {
        void sendEnquiryResponseEmail({
          toEmail: selected.customer_email,
          customerName: selected.customer_name || "Customer",
          propertyName: (selected as any).property_name,
          enquiryId: selected.id,
          question: selected.message || "Enquiry",
          response: `Our team has prompted you to log a structured maintenance ticket regarding "${subject.trim()}". Please open your resident portal to submit photos and track progress.`,
          companyName: currentCompany?.name || "Paimbabook",
        });
      }
    } catch (err) {
      alert("Failed to send ticket prompt: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSending(false);
    }
  };

  const markResolved = async () => {
    if (!selected) return;
    const staffName = (user as any)?.fullName || user?.email || "Staff";
    await supabase.from("enquiries").update({ status: "resolved", resolved_by_name: staffName, resolved_at: new Date().toISOString() }).eq("id", selected.id);
    setEnquiries(prev => prev.map(e => e.id === selected.id ? { ...e, status: "resolved" } : e));
    setSelected(prev => prev ? { ...prev, status: "resolved" } : null);
  };

  const closeTicket = async () => {
    if (!selected) return;
    await supabase.from("enquiries").update({ status: "cancelled" }).eq("id", selected.id);
    setEnquiries(prev => prev.map(e => e.id === selected.id ? { ...e, status: "cancelled" } : e));
    setSelected(null);
  };

  const filtered = activeFilter === "all" ? enquiries : activeFilter === "resolved" ? enquiries.filter(e => e.status === "resolved" || e.status === "auto_closed") : enquiries.filter(e => e.status === activeFilter);
  const tabs = [{ key: "all", label: "All", count: counts.all }, { key: "open", label: "Open", count: counts.open }, { key: "in_progress", label: "In Progress", count: counts.in_progress }, { key: "resolved", label: "Resolved", count: counts.resolved }];

  return (
    <ModulePage title="Enquiries & Tickets" description="Manage customer property enquiries, resident chat threads, and booking requests.">
      <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/40 dark:border-blue-800 px-4 py-3 flex items-center gap-3 text-sm text-blue-700 dark:text-blue-300">
        <AlertTriangle size={16} className="shrink-0"/>
        <span>Auto-close policy: Enquiries with no response for 24 hours are automatically closed.</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[{ label: "Open", count: counts.open, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-950/20" },{ label: "In Progress", count: counts.in_progress, color: "text-yellow-600", bg: "bg-yellow-50 dark:bg-yellow-950/20" },{ label: "Resolved", count: counts.resolved, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/20" },{ label: "Total", count: counts.all, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-950/20" }].map(s => (
          <div key={s.label} className={`rounded-2xl ${s.bg} border border-border-color p-4 shadow-xs`}>
            <p className="text-xs font-bold uppercase text-muted/60">{s.label}</p>
            <p className={`text-3xl font-bold ${s.color}`}>{s.count}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 rounded-xl bg-surface-elevated/50 p-1 w-fit border border-border-color">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveFilter(t.key)} className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition-all ${activeFilter===t.key?"bg-blue-600 text-white shadow":"text-muted hover:text-foreground"}`}>
            {t.label} {t.count > 0 && <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] ${activeFilter===t.key?"bg-white/20":"bg-surface-elevated"}`}>{t.count}</span>}
          </button>
        ))}
      </div>

      {loading && <LoadingState label="Loading enquiries..."/>}

      {!loading && empty && (
        <div className="rounded-2xl border border-dashed border-border-color p-12 text-center">
          <MessageSquare size={48} className="mx-auto mb-4 text-muted/30"/>
          <h3 className="font-bold text-foreground mb-2">No enquiries yet</h3>
          <p className="text-sm text-muted">Publish properties to the portal to start receiving customer enquiries and resident chats.</p>
        </div>
      )}

      {!loading && !empty && filtered.length === 0 && <EmptyState title="No enquiries in this category" description="Try another filter."/>}

      <div className="space-y-3">
        {filtered.map(e => (
          <div key={e.id} onClick={() => openTicket(e)} className="cursor-pointer rounded-2xl border border-border-color bg-surface p-4 hover:bg-surface-elevated/40 transition-all shadow-xs">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold flex items-center gap-1 ${TYPE_COLORS[e.type]||"bg-gray-100 text-gray-600"}`}>
                    {e.type === "room_booking" ? <Hotel size={11} /> : e.type.includes("property") ? <Building size={11} /> : <MessageSquare size={11} />}
                    <span>{formatTypeLabel(e.type)}</span>
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_COLORS[e.status]||"bg-gray-100 text-gray-600"}`}>{e.status.replace(/_/g," ")}</span>
                </div>
                <div className="flex items-center gap-3 text-sm flex-wrap">
                  <span className="font-bold text-foreground">{e.customer_name}</span>
                  <span className="flex items-center gap-1 text-muted text-xs"><Mail size={11}/>{e.customer_email}</span>
                  {e.customer_phone && <span className="flex items-center gap-1 text-muted text-xs"><Phone size={11}/>{e.customer_phone}</span>}
                </div>
                {e.message && <p className="text-xs text-muted mt-1 truncate max-w-xl">{e.message}</p>}
                {(e.check_in_date||e.check_out_date) && <p className="text-xs text-muted mt-0.5 flex items-center gap-1"><Calendar size={10}/>{e.check_in_date} → {e.check_out_date}{e.guests>1&&<span className="ml-2 flex items-center gap-0.5"><Users size={10}/>{e.guests}</span>}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted flex items-center gap-1"><Clock size={10}/>{new Date(e.created_at).toLocaleDateString()}</p>
                {e.resolved_by_name && <p className="text-xs text-green-600 mt-1">Resolved by {e.resolved_by_name}</p>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Ticket Thread Modal */}
      <Modal open={selected!==null} onClose={()=>setSelected(null)} title={selected?`${formatTypeLabel(selected.type)} — ${selected.customer_name}`:""}>
        {selected && (
          <div className="space-y-4">
            <div className="rounded-xl bg-surface-elevated/50 border border-border-color p-4 text-sm space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-[10px] font-bold uppercase text-muted/60">Customer</span><p className="font-semibold">{selected.customer_name}</p></div>
                <div><span className="text-[10px] font-bold uppercase text-muted/60">Email</span><p className="font-semibold">{selected.customer_email}</p></div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-muted/60">Conversation Type</span>
                  <div className="mt-0.5">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${TYPE_COLORS[selected.type] || "bg-gray-100 text-gray-600"}`}>
                      {selected.type === "room_booking" ? <Hotel size={11} /> : selected.type.includes("property") ? <Building size={11} /> : <MessageSquare size={11} />}
                      <span>{formatTypeLabel(selected.type)}</span>
                    </span>
                  </div>
                </div>
                <div><span className="text-[10px] font-bold uppercase text-muted/60">Status</span><span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_COLORS[selected.status]}`}>{selected.status.replace(/_/g," ")}</span></div>
              </div>
              {selected.message && <div><span className="text-[10px] font-bold uppercase text-muted/60">Initial Message / Context</span><p className="mt-1 rounded-lg bg-surface p-3 text-sm">{selected.message}</p></div>}
            </div>

            {/* Thread with small-font responder attribution */}
            <div className="space-y-3 max-h-72 overflow-y-auto px-1">
              {thread.length === 0 && <p className="text-xs text-muted italic text-center py-4">No messages yet. Reply to start the conversation.</p>}
              {thread.map((m) => {
                const isStaff = m.sender_type === "staff";
                const isTicketPrompt = isStaff && m.body.includes("[Ticket Prompt:");
                let promptSubject = "";
                if (isTicketPrompt) {
                  const match = m.body.match(/\[Ticket Prompt:\s*([^\]]+)\]/);
                  if (match) promptSubject = match[1];
                }

                return (
                  <div key={m.id} className={`flex flex-col ${isStaff ? "items-end" : "items-start"}`}>
                    <div
                      className={`max-w-md rounded-2xl p-3.5 text-xs shadow-xs ${
                        isStaff
                          ? "bg-blue-600 text-white rounded-br-xs"
                          : "bg-surface-elevated text-foreground rounded-bl-xs border border-border-color"
                      }`}
                    >
                      <p className="whitespace-pre-wrap leading-relaxed">{m.body}</p>
                      {isTicketPrompt && (
                        <div className="mt-2.5 p-2.5 rounded-xl bg-white/10 border border-white/20 text-white text-[11px]">
                          <div className="flex items-center gap-1.5 font-bold mb-0.5">
                            <Wrench size={12} />
                            <span>Prompt Sent: {promptSubject}</span>
                          </div>
                          <p className="text-[10px] text-white/80">Interactive 1-click ticket action button rendered in resident portal.</p>
                        </div>
                      )}
                    </div>
                    {/* Small font responder attribution */}
                    <span className="text-[10px] text-muted mt-1 px-1">
                      {isStaff ? (
                        <span className="font-semibold text-blue-600 dark:text-blue-400">
                          Responded by: {m.sender_name || "Staff"} • {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      ) : (
                        <span>
                          {m.sender_name || selected.customer_name} • {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Quick Templates & Action Toolbar */}
            {selected.status !== "resolved" && selected.status !== "auto_closed" && selected.status !== "cancelled" && (
              <div className="space-y-2 pt-2 border-t border-border-color/50">
                <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] font-bold uppercase text-muted/60 shrink-0 mr-1 flex items-center gap-1">
                      <HelpCircle size={12} /> Templates:
                    </span>
                    {DEFAULT_ENQUIRY_QUESTIONS.map((q) => (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => setReply(q.defaultResponse)}
                        className="shrink-0 text-[11px] px-2.5 py-1 rounded-lg border border-border-color bg-surface-elevated hover:bg-surface-elevated/80 text-foreground transition font-medium"
                        title={q.question}
                      >
                        {q.shortLabel}
                      </button>
                    ))}
                  </div>

                  {/* Prompt Tenant to Open Ticket Action */}
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowPromptMenu((prev) => !prev)}
                      className="flex items-center gap-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 hover:bg-amber-500/20 transition shadow-xs"
                    >
                      <Wrench size={12} />
                      <span>Prompt to Open Ticket</span>
                      <ChevronDown size={11} />
                    </button>

                    {showPromptMenu && (
                      <div className="absolute right-0 bottom-full mb-1 w-64 rounded-xl border border-border-color bg-surface p-2 shadow-xl z-50 space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted px-2 py-1">Select Ticket Subject</p>
                        {TICKET_SUBJECTS.map((sub) => (
                          <button
                            key={sub}
                            type="button"
                            onClick={() => void promptTenantToOpenTicket(sub)}
                            className="w-full text-left rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-surface-elevated transition"
                          >
                            {sub}
                          </button>
                        ))}
                        <div className="pt-1 border-t border-border-color/50">
                          <button
                            type="button"
                            onClick={() => {
                              setShowPromptMenu(false);
                              setShowCustomModal(true);
                            }}
                            className="w-full text-left rounded-lg px-2.5 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 transition flex items-center gap-1.5"
                          >
                            <Sparkles size={12} />
                            <span>Custom Ticket Subject...</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <textarea
                  rows={3}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="Type your reply or choose a template/prompt above..."
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-blue-600 resize-none"
                />

                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <button onClick={markResolved} className="flex items-center gap-1.5 rounded-xl bg-green-500/10 px-3 py-1.5 text-xs font-semibold text-green-600 hover:bg-green-500/20 transition">
                      <CheckCircle size={13}/>
                      <span>Mark Resolved / Solved</span>
                    </button>
                    <button onClick={closeTicket} className="flex items-center gap-1.5 rounded-xl bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-500/20 transition">
                      <X size={13}/>
                      <span>Close</span>
                    </button>
                  </div>
                  <button
                    onClick={sendReply}
                    disabled={sending || !reply.trim()}
                    className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition"
                  >
                    <Send size={13}/>
                    <span>{sending ? "Sending..." : "Send Reply"}</span>
                  </button>
                </div>
              </div>
            )}

            {(selected.status==="resolved"||selected.status==="auto_closed"||selected.status==="cancelled") && (
              <div className="flex items-center justify-between rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3 text-sm text-green-700 dark:text-green-300">
                <div className="flex items-center gap-2">
                  <CheckCircle size={15}/>
                  <span>Ticket {selected.status.replace(/_/g, " ")}. {selected.resolved_by_name && `Resolved by ${selected.resolved_by_name}.`}</span>
                </div>
                <button
                  onClick={async () => {
                    await supabase.from("enquiries").update({ status: "in_progress", resolved_at: null, resolved_by_name: null }).eq("id", selected.id);
                    setSelected(prev => prev ? { ...prev, status: "in_progress" } : null);
                    setEnquiries(prev => prev.map(e => e.id === selected.id ? { ...e, status: "in_progress" } : e));
                  }}
                  className="rounded-lg bg-surface border border-green-300 dark:border-green-700 px-3 py-1 text-xs font-bold text-green-800 dark:text-green-300 hover:bg-green-100 transition"
                >
                  Re-open Ticket
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Custom Ticket Subject Modal */}
      <Modal open={showCustomModal} onClose={() => setShowCustomModal(false)} title="Prompt Custom Ticket Subject">
        <div className="space-y-4">
          <p className="text-xs text-muted">
            Enter the specific subject for the ticket you want {selected?.customer_name} to log:
          </p>
          <input
            type="text"
            value={customSubjectInput}
            onChange={(e) => setCustomSubjectInput(e.target.value)}
            placeholder="e.g. Geyser Leak in Bathroom"
            className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-blue-500/20"
          />
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowCustomModal(false)}
              className="rounded-lg border border-border-color px-3 py-1.5 text-xs text-muted hover:text-foreground transition"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!customSubjectInput.trim()}
              onClick={() => {
                const sub = customSubjectInput.trim();
                setShowCustomModal(false);
                setCustomSubjectInput("");
                void promptTenantToOpenTicket(sub);
              }}
              className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition disabled:opacity-50"
            >
              Send Prompt
            </button>
          </div>
        </div>
      </Modal>
    </ModulePage>
  );
}
