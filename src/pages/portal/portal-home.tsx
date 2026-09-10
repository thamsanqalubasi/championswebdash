import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { MapPin, BedDouble, Home, Search, Star, ChevronLeft, ChevronRight, Briefcase } from "lucide-react";

type Listing = {
  id: string; name: string; type: string; address: string; city: string; country: string;
  status: string; monthly_rent: number; total_rooms: number; default_room_price: number; photos: string[];
};

function PhotoSlider({ photos, name }: { photos: string[]; name: string }) {
  const [idx, setIdx] = useState(0);
  const safe = photos.filter(Boolean);
  if (safe.length === 0) return (
    <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
      <Home size={40} className="text-blue-300" />
    </div>
  );
  return (
    <div className="relative aspect-video overflow-hidden group">
      <img src={safe[idx]} alt={name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
      {safe.length > 1 && (<>
        <button onClick={(e) => { e.preventDefault(); setIdx(i => i > 0 ? i-1 : safe.length-1); }} className="absolute left-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition hover:bg-black/70"><ChevronLeft size={14}/></button>
        <button onClick={(e) => { e.preventDefault(); setIdx(i => i < safe.length-1 ? i+1 : 0); }} className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition hover:bg-black/70"><ChevronRight size={14}/></button>
        <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">{idx+1}/{safe.length}</div>
      </>)}
    </div>
  );
}

const HOSP_TYPES = ["hotel","motel","lodge","guest_house","commercial"];

export default function PortalHomePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        let q = supabase.from("properties").select("id,name,type,address,city,country,status,monthly_rent,total_rooms,default_room_price,photos");
        try { q = (q as any).eq("is_published", true); } catch {}
        const { data, error } = await q.order("name");
        if (!error && data) setListings(data as Listing[]);
        else {
          const { data: d2 } = await supabase.from("properties").select("id,name,type,address,city,country,status,monthly_rent,total_rooms,default_room_price,photos").order("name");
          if (d2) setListings(d2 as Listing[]);
        }
      } catch { setListings([]); }
      finally { setLoading(false); }
    }
    void load();
  }, []);

  const filtered = listings.filter(l => {
    if (filter === "hospitality" && !HOSP_TYPES.includes(l.type)) return false;
    if (filter === "rental" && HOSP_TYPES.includes(l.type)) return false;
    if (search) { const q = search.toLowerCase(); return l.name.toLowerCase().includes(q) || (l.city||"").toLowerCase().includes(q) || (l.country||"").toLowerCase().includes(q); }
    return true;
  });

  const hospListings = filtered.filter(l => HOSP_TYPES.includes(l.type));
  const rentalListings = filtered.filter(l => !HOSP_TYPES.includes(l.type));

  return (
    <div>
      {/* Hero */}
      <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-purple-700 py-20 px-4 text-center text-white">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4 tracking-tight">Find Your Perfect Stay or Home</h1>
        <p className="text-lg text-blue-100 mb-8 max-w-2xl mx-auto">Browse available rooms, lodges, and rental properties. Book instantly or send an enquiry.</p>
        <div className="mx-auto max-w-2xl flex gap-3 bg-white rounded-2xl p-2 shadow-2xl mb-6">
          <div className="flex items-center gap-2 flex-1 px-3"><Search size={18} className="text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search city, country or property name..." className="flex-1 outline-none text-gray-800 text-sm"/></div>
          <select value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500">
            <option value="all">All Types</option>
            <option value="hospitality">🏨 Hotels &amp; Lodges</option>
            <option value="rental">🏠 Rental Homes</option>
          </select>
        </div>
        {/* Agent portal shortcut */}
        <Link to="/portal/agent" className="inline-flex items-center gap-2 rounded-2xl border-2 border-amber-400 bg-amber-500/20 px-6 py-3 text-sm font-bold text-white hover:bg-amber-500/40 transition">
          <Briefcase size={18}/>
          Are you an agent? View room types &amp; availability →
        </Link>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-12">
        {loading && <div className="text-center py-20 text-gray-400">Loading listings...</div>}
        {!loading && filtered.length === 0 && <div className="text-center py-20 text-gray-400"><Home size={48} className="mx-auto mb-4 opacity-30"/><p className="text-lg font-medium">No listings available at the moment.</p><p className="text-sm">Check back soon or contact us directly.</p></div>}

        {!loading && hospListings.length > 0 && (
          <section className="mb-14">
            <div className="flex items-center gap-3 mb-6"><BedDouble size={22} className="text-purple-600"/><h2 className="text-2xl font-bold text-gray-900">Book a Room</h2><span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-700">{hospListings.length}</span></div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {hospListings.map(l => (
                <Link key={l.id} to={`/portal/listing/${l.id}`} className="group rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-lg transition-all hover:-translate-y-1">
                  <PhotoSlider photos={l.photos||[]} name={l.name}/>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-gray-900 group-hover:text-blue-700 transition">{l.name}</h3>
                      <span className="shrink-0 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700 uppercase">{l.type.replace(/_/g," ")}</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-500 mb-3"><MapPin size={13}/><span>{[l.city,l.country].filter(Boolean).join(", ")||l.address}</span></div>
                    <div className="flex items-center justify-between">
                      <div><span className="text-xl font-bold text-blue-700">R{(l.default_room_price||0).toLocaleString()}</span><span className="text-sm text-gray-400">/night</span></div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${l.status==="vacant"?"bg-green-100 text-green-700":"bg-orange-100 text-orange-700"}`}>{l.status==="vacant"?"Available":"Occupied"}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {!loading && rentalListings.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-6"><Home size={22} className="text-blue-600"/><h2 className="text-2xl font-bold text-gray-900">Rental Properties</h2><span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">{rentalListings.length}</span></div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rentalListings.map(l => (
                <Link key={l.id} to={`/portal/listing/${l.id}`} className="group rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-lg transition-all hover:-translate-y-1">
                  <PhotoSlider photos={l.photos||[]} name={l.name}/>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-bold text-gray-900 group-hover:text-blue-700 transition">{l.name}</h3>
                      <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 uppercase">{l.type.replace(/_/g," ")}</span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-500 mb-3"><MapPin size={13}/><span>{[l.city,l.country].filter(Boolean).join(", ")||l.address}</span></div>
                    <div className="flex items-center justify-between">
                      <div><span className="text-xl font-bold text-blue-700">R{(l.monthly_rent||0).toLocaleString()}</span><span className="text-sm text-gray-400">/month</span></div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${l.status==="vacant"?"bg-green-100 text-green-700":"bg-orange-100 text-orange-700"}`}>{l.status==="vacant"?"Available":"Occupied"}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Agent Portal CTA Banner */}
        {!loading && (
          <div className="mt-16 rounded-3xl overflow-hidden bg-gradient-to-r from-slate-800 to-purple-900 text-white">
            <div className="px-8 py-10 flex flex-col sm:flex-row items-center gap-6 justify-between">
              <div className="flex items-center gap-5">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-amber-500 shadow-lg">
                  <Briefcase size={28}/>
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-1">Are you a property agent?</h3>
                  <p className="text-slate-300 text-sm max-w-md">Access the full agent portal to view all available room types, check real-time date and time availability, and submit booking requests on behalf of your clients.</p>
                </div>
              </div>
              <Link to="/portal/agent" className="shrink-0 flex items-center gap-2 rounded-2xl bg-amber-500 px-7 py-3.5 text-sm font-bold text-white hover:bg-amber-400 transition shadow-lg whitespace-nowrap">
                <Briefcase size={17}/>
                Open Agent Portal →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
