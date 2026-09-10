import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { User, MessageSquare, CheckCircle, Clock, LogOut, Star, Home } from "lucide-react";

type Enquiry = { id: string; type: string; status: string; message: string; created_at: string; property_id: string; check_in_date: string; check_out_date: string; };

const STATUS_COLORS: Record<string, string> = {
  open: "bg-blue-100 text-blue-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  resolved: "bg-green-100 text-green-700",
  auto_closed: "bg-gray-100 text-gray-500",
  cancelled: "bg-red-100 text-red-600",
};

export default function CustomerDashboardPage() {
  const navigate = useNavigate();
  const [session, setSession] = useState<any>(null);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { navigate("/portal/login"); return; }
      setSession(data.session);
      loadEnquiries(data.session.user.email!);
    });
  }, [navigate]);

  async function loadEnquiries(email: string) {
    setLoading(true);
    try {
      const { data } = await supabase.from("enquiries").select("*").eq("customer_email", email).order("created_at", { ascending: false });
      if (data) setEnquiries(data);
    } catch {}
    setLoading(false);
  }

  const handleResolve = async (id: string) => {
    await supabase.from("enquiries").update({ status: "resolved", resolved_by_name: "Customer" }).eq("id", id);
    setEnquiries(prev => prev.map(e => e.id === id ? { ...e, status: "resolved" } : e));
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/portal/login");
  };

  const userName = session?.user?.user_metadata?.full_name || session?.user?.email || "Customer";

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-blue-600 flex items-center justify-center text-white font-bold text-xl">{userName.charAt(0).toUpperCase()}</div>
          <div><h1 className="text-xl font-bold text-gray-900">Welcome back</h1><p className="text-gray-500 text-sm">{userName}</p></div>
        </div>
        <div className="flex gap-3">
          <Link to="/portal" className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"><Home size={15}/> Listings</Link>
          <button onClick={handleSignOut} className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition"><LogOut size={15}/> Sign Out</button>
        </div>
      </div>

      <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2"><MessageSquare size={18} className="text-blue-600"/> My Enquiries & Bookings</h2>

      {loading && <div className="text-center py-10 text-gray-400">Loading your enquiries...</div>}
      {!loading && enquiries.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <MessageSquare size={48} className="mx-auto mb-3 opacity-30"/>
          <p className="font-medium">No enquiries yet.</p>
          <p className="text-sm mt-1">Browse listings and send an enquiry to get started.</p>
          <Link to="/portal" className="mt-4 inline-block rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition">Browse Listings</Link>
        </div>
      )}

      <div className="space-y-4">
        {enquiries.map(e => (
          <div key={e.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_COLORS[e.status] || "bg-gray-100 text-gray-600"}`}>{e.status.replace(/_/g," ")}</span>
                <span className="ml-2 text-xs text-gray-400">{e.type.replace(/_/g," ")}</span>
              </div>
              <span className="text-xs text-gray-400"><Clock size={11} className="inline mr-1"/>{new Date(e.created_at).toLocaleDateString()}</span>
            </div>
            {e.message && <p className="text-sm text-gray-700 mb-3 bg-gray-50 rounded-xl p-3">{e.message}</p>}
            {(e.check_in_date || e.check_out_date) && (
              <p className="text-xs text-gray-500 mb-3">Check-in: {e.check_in_date || "—"} → Check-out: {e.check_out_date || "—"}</p>
            )}
            {e.status === "open" || e.status === "in_progress" ? (
              <button onClick={() => handleResolve(e.id)} className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-100 transition">
                <CheckCircle size={15}/> Problem Resolved
              </button>
            ) : e.status === "resolved" && (
              <div className="flex items-center gap-2 text-sm text-green-600"><CheckCircle size={15}/> Resolved — Thank you!</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
