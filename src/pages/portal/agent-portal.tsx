import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { MapPin, BedDouble, Home, ChevronLeft, ChevronRight, Briefcase, Phone, Mail, Building2, Star } from "lucide-react";

type Listing = {
  id: string; name: string; type: string; address: string; city: string; country: string;
  status: string; monthly_rent: number; total_rooms: number; default_room_price: number;
  default_bed_breakfast: number; default_full_board: number; photos: string[];
};

const HOSP = ["hotel","motel","lodge","guest_house","commercial"];

function PhotoSlider({ photos, name }: { photos: string[]; name: string }) {
  const [idx, setIdx] = useState(0);
  const safe = photos.filter(Boolean);
  if (safe.length === 0) return (
    <div className="aspect-video bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
      <Building2 size={40} className="text-slate-300" />
    </div>
  );
  return (
    <div className="relative aspect-video overflow-hidden group">
      <img src={safe[idx]} alt={name} className="h-full w-full object-cover" />
      {safe.length > 1 && (<>
        <button onClick={(e) => { e.preventDefault(); setIdx(i => i > 0 ? i-1 : safe.length-1); }} className="absolute left-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition hover:bg-black/70"><ChevronLeft size={14}/></button>
        <button onClick={(e) => { e.preventDefault(); setIdx(i => i < safe.length-1 ? i+1 : 0); }} className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition hover:bg-black/70"><ChevronRight size={14}/></button>
        <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">{idx+1}/{safe.length}</div>
      </>)}
    </div>
  );
}

export default function AgentPortalPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "hospitality" | "rental">("all");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        // Try to get published vacant properties; fall back to all vacant properties
        let { data, error } = await supabase
          .from("properties")
          .select("id,name,type,address,city,country,status,monthly_rent,total_rooms,default_room_price,default_bed_breakfast,default_full_board,photos")
          .eq("status", "vacant")
          .order("name");

        // Also try to include is_published filter
        if (!error && data) {
          try {
            const { data: d2 } = await supabase
              .from("properties")
              .select("id,name,type,address,city,country,status,monthly_rent,total_rooms,default_room_price,default_bed_breakfast,default_full_board,photos")
              .eq("is_published", true)
              .eq("status", "vacant")
              .order("name");
            if (d2 && d2.length > 0) data = d2;
          } catch {}
        }
        if (!error && data) setListings(data as Listing[]);
      } catch { setListings([]); }
      setLoading(false);
    }
    void load();
  }, []);

  const filtered = listings.filter(l => {
    if (filter === "hospitality") return HOSP.includes(l.type);
    if (filter === "rental") return !HOSP.includes(l.type);
    return true;
  });

  const hospListings = filtered.filter(l => HOSP.includes(l.type));
  const rentalListings = filtered.filter(l => !HOSP.includes(l.type));

  return (
    <div>
      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 py-14 px-4 text-white">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-white"><Briefcase size={20}/></div>
            <span className="text-sm font-semibold text-slate-300 uppercase tracking-widest">Agent Portal</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Available Properties for Agents</h1>
          <p className="text-slate-300 max-w-xl">All currently vacant and bookable properties. Share these listings with potential clients. Click "View & Enquire" to submit a booking or rental enquiry.</p>

          {/* Filter tabs */}
          <div className="mt-6 flex gap-2">
            {(["all","hospitality","rental"] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} className={`rounded-xl px-4 py-2 text-sm font-semibold transition-all ${filter===f ? "bg-amber-500 text-white" : "bg-white/10 text-white/80 hover:bg-white/20"}`}>
                {f === "all" ? "All Vacancies" : f === "hospitality" ? "🏨 Hotels & Lodges" : "🏠 Rental Homes"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10">
        {loading && <div className="text-center py-20 text-gray-400">Loading available listings...</div>}

        {!loading && filtered.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <Building2 size={48} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg font-semibold">No vacant properties available at the moment.</p>
            <p className="text-sm text-gray-400 mt-1">Check back soon as properties become available.</p>
          </div>
        )}

        {/* Hospitality Section */}
        {!loading && hospListings.length > 0 && (
          <section className="mb-12">
            <div className="flex items-center gap-3 mb-5">
              <BedDouble size={22} className="text-purple-600"/>
              <h2 className="text-xl font-bold text-gray-900">Hotels, Lodges & Guest Houses</h2>
              <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-700">{hospListings.length} available</span>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {hospListings.map(l => (
                <Link key={l.id} to={`/portal/listing/${l.id}`} className="group rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5">
                  <PhotoSlider photos={l.photos||[]} name={l.name}/>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-gray-900 group-hover:text-purple-700 transition">{l.name}</h3>
                      <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 uppercase">Vacant</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mb-3"><MapPin size={11}/><span>{[l.city,l.country].filter(Boolean).join(", ")||l.address}</span></div>
                    <div className="bg-gray-50 rounded-xl p-3 space-y-1 text-xs">
                      <div className="flex justify-between"><span className="text-gray-500">Room Rate</span><span className="font-bold text-purple-700">R{(l.default_room_price||0).toLocaleString()}/night</span></div>
                      {l.default_bed_breakfast > 0 && <div className="flex justify-between"><span className="text-gray-500">B&B Rate</span><span className="font-semibold">R{l.default_bed_breakfast.toLocaleString()}/night</span></div>}
                      {l.default_full_board > 0 && <div className="flex justify-between"><span className="text-gray-500">Full Board</span><span className="font-semibold">R{l.default_full_board.toLocaleString()}/night</span></div>}
                      {l.total_rooms > 0 && <div className="flex justify-between"><span className="text-gray-500">Total Rooms</span><span className="font-semibold">{l.total_rooms}</span></div>}
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-gray-400 capitalize">{l.type.replace(/_/g," ")}</span>
                      <span className="text-xs font-semibold text-purple-600 group-hover:underline">View & Enquire →</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Rental Section */}
        {!loading && rentalListings.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-5">
              <Home size={22} className="text-blue-600"/>
              <h2 className="text-xl font-bold text-gray-900">Available Rental Properties</h2>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">{rentalListings.length} available</span>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rentalListings.map(l => (
                <Link key={l.id} to={`/portal/listing/${l.id}`} className="group rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-lg transition-all hover:-translate-y-0.5">
                  <PhotoSlider photos={l.photos||[]} name={l.name}/>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-gray-900 group-hover:text-blue-700 transition">{l.name}</h3>
                      <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700 uppercase">Vacant</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-500 mb-3"><MapPin size={11}/><span>{[l.city,l.country].filter(Boolean).join(", ")||l.address}</span></div>
                    <div className="text-center my-3">
                      <span className="text-2xl font-bold text-blue-700">R{(l.monthly_rent||0).toLocaleString()}</span>
                      <span className="text-sm text-gray-400">/month</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-400 capitalize">{l.type.replace(/_/g," ")}</span>
                      <span className="font-semibold text-blue-600 group-hover:underline">View & Enquire →</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Agent Tips */}
        <div className="mt-12 rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h3 className="font-bold text-amber-900 mb-2 flex items-center gap-2"><Star size={16} className="text-amber-500"/>Agent Quick Tips</h3>
          <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
            <li>Click any listing to view full details and submit a booking or enquiry on behalf of a client</li>
            <li>All enquiries are tracked in the admin dashboard with a full message thread</li>
            <li>Pricing shown is the base rate — contact the admin for group/corporate rates</li>
            <li>Properties showing "Vacant" are immediately available</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
