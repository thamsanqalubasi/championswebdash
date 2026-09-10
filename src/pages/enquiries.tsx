import { useEffect, useState } from "react";
import { ModulePage } from "@/components/module-page";
import { EmptyState, LoadingState } from "@/components/data-state";
import { Modal } from "@/components/modal";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { MessageSquare, Clock, CheckCircle, X, Send, AlertTriangle, Mail, Phone, Calendar, Users } from "lucide-react";

type Enquiry = {
  id: string; customer_name: string; customer_email: string; customer_phone: string;
  type: string; status: string; message: string; created_at: string; property_id: string;
  check_in_date: string; check_out_date: string; guests: number;
  resolved_by_name: string; resolved_at: string;
};

type Message = { id: string; sender_type: string; sender_name: string; body: string; created_at: string; };

const TYPE_COLORS: Record<string, string> = {
  room_booking: "bg-purple-100 text-purple-700",
  rental_enquiry: "bg-blue-100 text-blue-700",
  general: "bg-gray-100 text-gray-600",
};
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

  const counts = {
    all: enquiries.length,
    open: enquiries.filter(e => e.status === "open").length,
    in_progress: enquiries.filter(e => e.status === "in_progress").length,
    resolved: enquiries.filter(e => e.status === "resolved" || e.status === "auto_closed").length,
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data, error } = await supabase.from("enquiries").select("*").eq("company_id", currentCompany.id).order("created_at", { ascending: false });
        if (error) { if (error.message.includes("does not exist") || error.code === "42P01") { setEmpty(true); } setLoading(false); return; }
        setEnquiries(data || []);
      } catch { setEmpty(true); }
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
      setReply("");
    } catch { alert("Failed to send reply. The enquiry messages table may not exist yet."); }
    setSending(false);
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
    <ModulePage title="Enquiries & Tickets" description="Manage customer property enquiries and booking requests from the portal.">
      <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 flex items-center gap-3 text-sm text-blue-700">
        <AlertTriangle size={16} className="shrink-0"/>
        <span>Auto-close policy: Enquiries with no response for 24 hours are automatically closed.</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[{ label: "Open", count: counts.open, color: "text-orange-600", bg: "bg-orange-50" },{ label: "In Progress", count: counts.in_progress, color: "text-yellow-600", bg: "bg-yellow-50" },{ label: "Resolved", count: counts.resolved, color: "text-green-600", bg: "bg-green-50" },{ label: "Total", count: counts.all, color: "text-blue-600", bg: "bg-blue-50" }].map(s => (
          <div key={s.label} className={`rounded-2xl ${s.bg} border border-border-color p-4`}>
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
          <p className="text-sm text-muted">Publish properties to the portal to start receiving customer enquiries.</p>
        </div>
      )}

      {!loading && !empty && filtered.length === 0 && <EmptyState title="No enquiries in this category" description="Try another filter."/>}

      <div className="space-y-3">
        {filtered.map(e => (
          <div key={e.id} onClick={() => openTicket(e)} className="cursor-pointer rounded-2xl border border-border-color bg-surface p-4 hover:bg-surface-elevated/40 transition-all shadow-xs">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${TYPE_COLORS[e.type]||"bg-gray-100 text-gray-600"}`}>{e.type.replace(/_/g," ")}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_COLORS[e.status]||"bg-gray-100 text-gray-600"}`}>{e.status.replace(/_/g," ")}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-semibold text-foreground">{e.customer_name}</span>
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
      <Modal open={selected!==null} onClose={()=>setSelected(null)} title={selected?`Ticket — ${selected.customer_name}`:""}>
        {selected && (
          <div className="space-y-4">
            <div className="rounded-xl bg-surface-elevated/50 border border-border-color p-4 text-sm space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div><span className="text-[10px] font-bold uppercase text-muted/60">Customer</span><p className="font-semibold">{selected.customer_name}</p></div>
                <div><span className="text-[10px] font-bold uppercase text-muted/60">Email</span><p className="font-semibold">{selected.customer_email}</p></div>
                <div><span className="text-[10px] font-bold uppercase text-muted/60">Type</span><p className="font-semibold capitalize">{selected.type.replace(/_/g," ")}</p></div>
                <div><span className="text-[10px] font-bold uppercase text-muted/60">Status</span><span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold ${STATUS_COLORS[selected.status]}`}>{selected.status.replace(/_/g," ")}</span></div>
              </div>
              {selected.message && <div><span className="text-[10px] font-bold uppercase text-muted/60">Message</span><p className="mt-1 rounded-lg bg-surface p-3 text-sm">{selected.message}</p></div>}
            </div>

            {/* Thread */}
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {thread.length === 0 && <p className="text-xs text-muted italic text-center py-4">No messages yet. Reply to start the conversation.</p>}
              {thread.map(m => (
                <div key={m.id} className={`rounded-xl p-3 text-sm ${m.sender_type==="staff"?"bg-blue-50 ml-8":"bg-surface-elevated mr-8"}`}>
                  <div className="flex items-center justify-between mb-1"><span className="font-semibold text-xs">{m.sender_name}</span><span className="text-[10px] text-muted">{new Date(m.created_at).toLocaleString()}</span></div>
                  <p>{m.body}</p>
                </div>
              ))}
            </div>

            {/* Reply */}
            {selected.status !== "resolved" && selected.status !== "auto_closed" && selected.status !== "cancelled" && (
              <div className="space-y-2">
                <textarea rows={3} value={reply} onChange={e=>setReply(e.target.value)} placeholder="Type your reply..." className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-blue-600 resize-none"/>
                <div className="flex items-center justify-between">
                  <div className="flex gap-2">
                    <button onClick={markResolved} className="flex items-center gap-1.5 rounded-xl bg-green-500/10 px-3 py-1.5 text-xs font-semibold text-green-600 hover:bg-green-500/20 transition"><CheckCircle size={13}/>Mark Resolved</button>
                    <button onClick={closeTicket} className="flex items-center gap-1.5 rounded-xl bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-500/20 transition"><X size={13}/>Close Ticket</button>
                  </div>
                  <button onClick={sendReply} disabled={sending||!reply.trim()} className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition"><Send size={13}/>{sending?"Sending...":"Send Reply"}</button>
                </div>
              </div>
            )}
            {(selected.status==="resolved"||selected.status==="auto_closed") && <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-700"><CheckCircle size={15}/>Ticket closed. {selected.resolved_by_name&&`Resolved by ${selected.resolved_by_name}.`}</div>}
          </div>
        )}
      </Modal>
    </ModulePage>
  );
}
