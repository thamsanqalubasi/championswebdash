import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { MapPin, BedDouble, Home, Search, ChevronLeft, ChevronRight, Users, Baby, Star, DollarSign } from "lucide-react";

type RentalProp = { id: string; name: string; type: string; address: string; city: string; country: string; status: string; monthly_rent: number; photos: string[]; };
type RoomListing = { id: string; property_id: string; display_name: string; property_name: string; type_key: string; adults_capacity: number; kids_capacity: number; total_rooms_of_type: number; price_room_only: number; price_bed_breakfast: number; price_full_board: number; photos: string[]; amenities: string[]; };
type AgentListing = {
  id: string; name: string; type: string; listing_type: string;
  address: string; city: string; country: string; description: string;
  bedrooms: number; bathrooms: number; area_sqm: number;
  price: number; photos: string[]; amenities: string[];
  is_published: boolean;
  agent_name: string; agent_email: string; agent_phone: string;
  agent_whatsapp: string; agent_photo_url: string;
};

function PhotoSlider({ photos, name }: { photos: string[]; name: string }) {
  const [idx, setIdx] = useState(0);
  const safe = (photos || []).filter(Boolean);
  if (safe.length === 0) return <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-100 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center"><Home size={40} className="text-blue-300 dark:text-slate-500"/></div>;
  return (
    <div className="relative aspect-video overflow-hidden group">
      <img src={safe[idx]} alt={name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"/>
      {safe.length > 1 && (<>
        <button onClick={e=>{e.preventDefault();setIdx(i=>i>0?i-1:safe.length-1);}} aria-label="Previous photo" className="absolute left-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition"><ChevronLeft size={14}/></button>
        <button onClick={e=>{e.preventDefault();setIdx(i=>i<safe.length-1?i+1:0);}} aria-label="Next photo" className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition"><ChevronRight size={14}/></button>
        <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">{idx+1}/{safe.length}</div>
      </>)}
    </div>
  );
}

export default function PortalHomePage() {
  const [rentals, setRentals] = useState<RentalProp[]>([]);
  const [roomListings, setRoomListings] = useState<RoomListing[]>([]);
  const [saleListings, setSaleListings] = useState<AgentListing[]>([]);
  const [reviewsMap, setReviewsMap] = useState<Record<string, { avg: number; count: number }>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data } = await supabase.from("properties").select("id,name,type,address,city,country,status,monthly_rent,photos").eq("is_published", true).in("type", ["house","apartment","storage"]).order("name");
        setRentals((data || []) as RentalProp[]);
      } catch { setRentals([]); }

      try {
        const { data } = await supabase.from("room_type_listings").select("id,property_id,display_name,property_name,type_key,adults_capacity,kids_capacity,total_rooms_of_type,price_room_only,price_bed_breakfast,price_full_board,photos,amenities").eq("is_active", true).order("sort_order").order("created_at");
        setRoomListings((data || []) as RoomListing[]);
      } catch { setRoomListings([]); }

      try {
        const { data: agentData } = await supabase.from('agent_listings')
          .select('*')
          .eq('is_published', true)
          .eq('listing_type', 'sale')
          .order('created_at', { ascending: false });
        setSaleListings((agentData || []) as AgentListing[]);
      } catch { setSaleListings([]); }

      try {
        const { data: revs } = await supabase.from("listing_reviews").select("property_id, rating");
        if (revs && revs.length > 0) {
          const map: Record<string, { total: number; count: number }> = {};
          revs.forEach((r: any) => {
            if (!r.property_id) return;
            if (!map[r.property_id]) map[r.property_id] = { total: 0, count: 0 };
            map[r.property_id].total += Number(r.rating) || 5;
            map[r.property_id].count += 1;
          });
          const computed: Record<string, { avg: number; count: number }> = {};
          Object.keys(map).forEach(k => {
            computed[k] = {
              avg: map[k].count > 0 ? (map[k].total / map[k].count) : 5,
              count: map[k].count,
            };
          });
          setReviewsMap(computed);
        }
      } catch {}

      setLoading(false);
    }
    void load();
  }, []);

  const q = search.toLowerCase();
  const matchRental = (l: RentalProp) => !search || l.name.toLowerCase().includes(q) || (l.city||"").toLowerCase().includes(q) || (l.country||"").toLowerCase().includes(q);
  const matchRoom = (r: RoomListing) => !search || r.display_name.toLowerCase().includes(q) || (r.property_name||"").toLowerCase().includes(q);
  const matchSale = (s: AgentListing) => !search || s.name.toLowerCase().includes(q) || (s.city||'').toLowerCase().includes(q) || (s.country||'').toLowerCase().includes(q);

  const filteredRentals = filter === "booking" || filter === "sale" ? [] : rentals.filter(matchRental);
  const filteredRooms = filter === "rental" || filter === "sale" ? [] : roomListings.filter(matchRoom);
  const filteredSales = (filter === 'rental' || filter === 'booking') ? [] : saleListings.filter(matchSale);
  const total = filteredRentals.length + filteredRooms.length + filteredSales.length;

  const lowestPrice = (r: RoomListing) => Math.min(...[r.price_room_only,r.price_bed_breakfast,r.price_full_board].filter(p=>p>0)) || 0;

  return (
    <div className="bg-slate-50 dark:bg-slate-950 transition-colors">
      {/* Hero Search Section */}
      <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-purple-700 dark:from-blue-900 dark:via-indigo-950 dark:to-purple-950 py-16 sm:py-20 px-4 text-center text-white">
        <h1 className="text-3xl sm:text-5xl font-bold mb-3 sm:mb-4 tracking-tight">Find Your Perfect Stay or Home</h1>
        <p className="text-sm sm:text-lg text-blue-100 dark:text-blue-200 mb-6 sm:mb-8 max-w-2xl mx-auto px-2">Browse available rooms, lodges, and rental properties with verified customer reviews.</p>
        
        {/* Search Bar Container - Fully responsive */}
        <div className="mx-auto max-w-2xl flex flex-col sm:flex-row gap-2 sm:gap-3 bg-white dark:bg-slate-900 rounded-2xl p-2 sm:p-2 shadow-2xl border border-gray-100 dark:border-slate-800">
          <div className="flex items-center gap-2 flex-1 px-3 py-2 sm:py-0 bg-gray-50 dark:bg-slate-800/70 rounded-xl sm:bg-transparent sm:dark:bg-transparent">
            <Search size={18} className="text-gray-400 dark:text-slate-400 shrink-0"/>
            <input
              value={search}
              onChange={e=>setSearch(e.target.value)}
              placeholder="Search city, property or room name..."
              className="w-full outline-none text-gray-800 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 text-sm bg-transparent"
            />
          </div>
          <select
            value={filter}
            onChange={e=>setFilter(e.target.value)}
            className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3.5 py-2.5 sm:py-2 text-sm text-gray-700 dark:text-slate-200 outline-none focus:border-blue-500 font-medium"
          >
            <option value="all">All Listings</option>
            <option value="booking">Book a Room</option>
            <option value="rental">For Rent</option>
            <option value="sale">For Sale</option>
          </select>
        </div>
      </div>

      {/* Listings Section */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 sm:py-12">
        {loading && <div className="text-center py-20 text-gray-400 dark:text-slate-500">Loading listings...</div>}
        {!loading && total === 0 && (
          <div className="text-center py-24">
            <Home size={56} className="mx-auto mb-4 text-gray-200 dark:text-slate-700"/>
            <p className="text-xl font-bold text-gray-400 dark:text-slate-500 mb-2">No listings published yet</p>
            <p className="text-sm text-gray-400 dark:text-slate-500">New rooms and properties will appear here once published by the property manager.</p>
          </div>
        )}

        {/* Book a Room — room_type_listings */}
        {!loading && filteredRooms.length > 0 && (
          <section className="mb-14">
            <div className="flex items-center gap-3 mb-6">
              <BedDouble size={22} className="text-purple-600 dark:text-purple-400"/>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Book a Room</h2>
              <span className="rounded-full bg-purple-100 dark:bg-purple-950/80 px-2.5 py-0.5 text-xs font-bold text-purple-700 dark:text-purple-300">{filteredRooms.length}</span>
            </div>
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredRooms.map(r => {
                const stat = reviewsMap[r.id] || reviewsMap[r.property_id];
                return (
                  <Link key={r.id} to={`/listing/${r.id}`} className="group rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs hover:shadow-lg transition-all hover:-translate-y-1">
                    <PhotoSlider photos={r.photos||[]} name={r.display_name}/>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition">{r.display_name}</h3>
                        <span className="shrink-0 rounded-full bg-purple-100 dark:bg-purple-950/80 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300 capitalize">{r.type_key.replace(/_/g," ")}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mb-2 flex items-center gap-1"><MapPin size={11}/>{r.property_name}</p>
                      
                      {/* Review rating badge */}
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <div className="flex items-center text-amber-500">
                          <Star size={13} className="fill-amber-400 text-amber-400"/>
                        </div>
                        <span className="text-xs font-bold text-gray-800 dark:text-slate-200">
                          {stat ? stat.avg.toFixed(1) : "5.0"}
                        </span>
                        <span className="text-[11px] text-gray-400 dark:text-slate-500">
                          ({stat ? `${stat.count} review${stat.count !== 1 ? 's' : ''}` : "Guest Reviews"})
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400 mb-3">
                        <span className="flex items-center gap-1"><Users size={11}/>{r.adults_capacity} Adults</span>
                        {r.kids_capacity>0&&<span className="flex items-center gap-1"><Baby size={11}/>{r.kids_capacity} Kids</span>}
                        <span className="text-gray-300 dark:text-slate-600">·</span>
                        <span>{r.total_rooms_of_type} room{r.total_rooms_of_type!==1?"s":""}</span>
                      </div>
                      {r.amenities&&r.amenities.length>0&&(
                        <div className="flex flex-wrap gap-1 mb-3">
                          {r.amenities.slice(0,3).map((a:string)=><span key={a} className="rounded-full bg-gray-100 dark:bg-slate-800 px-2 py-0.5 text-[10px] text-gray-600 dark:text-slate-300 capitalize">{a.replace(/_/g," ")}</span>)}
                          {r.amenities.length>3&&<span className="text-[10px] text-gray-400 dark:text-slate-500">+{r.amenities.length-3} more</span>}
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-800">
                        <div><span className="text-xl font-bold text-purple-600 dark:text-purple-400">R{lowestPrice(r).toLocaleString()}</span><span className="text-sm text-gray-400 dark:text-slate-500">/night</span></div>
                        <span className="rounded-full bg-green-100 dark:bg-green-950/80 px-2.5 py-1 text-xs font-semibold text-green-700 dark:text-green-300">Available</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {!loading && filteredSales.length > 0 && (
          <section className="mb-14">
            <div className="flex items-center gap-3 mb-6">
              <DollarSign size={22} className="text-emerald-600 dark:text-emerald-400"/>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Properties For Sale</h2>
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">{filteredSales.length}</span>
            </div>
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSales.map(s => (
                <div key={s.id} className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs hover:shadow-lg transition-all">
                  <PhotoSlider photos={s.photos||[]} name={s.name}/>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <h3 className="font-bold text-gray-900 dark:text-white">{s.name}</h3>
                      <span className="shrink-0 rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">For Sale</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mb-2 flex items-center gap-1"><MapPin size={11}/>{[s.city, s.country].filter(Boolean).join(', ') || s.address}</p>
                    {s.description && <p className="text-xs text-gray-500 dark:text-slate-400 mb-3 line-clamp-2">{s.description}</p>}
                    <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400 mb-3">
                      {s.bedrooms > 0 && <span>{s.bedrooms} Bed</span>}
                      {s.bathrooms > 0 && <span>{s.bathrooms} Bath</span>}
                      {s.area_sqm > 0 && <span>{s.area_sqm} m²</span>}
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-800 mb-3">
                      <div><span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">R{(s.price||0).toLocaleString()}</span></div>
                      <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/80 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">For Sale</span>
                    </div>
                    {/* Agent Contact Card */}
                    {s.agent_name && (
                      <div className="rounded-xl bg-gray-50 dark:bg-slate-800/80 border border-gray-100 dark:border-slate-700/60 p-3 flex items-center gap-3">
                        {s.agent_photo_url ? (
                          <img src={s.agent_photo_url} alt={s.agent_name} className="w-10 h-10 rounded-full object-cover border-2 border-white dark:border-slate-700 shadow"/>
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-sm">{s.agent_name.charAt(0)}</div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-gray-900 dark:text-white truncate">{s.agent_name}</div>
                          <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-slate-400 mt-0.5">
                            {s.agent_phone && <span className="flex items-center gap-0.5">📞 {s.agent_phone}</span>}
                            {s.agent_whatsapp && <a href={`https://wa.me/${s.agent_whatsapp.replace(/[^0-9]/g,'')}`} target="_blank" rel="noreferrer" className="text-green-600 dark:text-green-400 hover:underline">WhatsApp</a>}
                          </div>
                          {s.agent_email && <div className="text-[10px] text-gray-400 dark:text-slate-500 truncate">{s.agent_email}</div>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* For Rent — published rental properties */}
        {!loading && filteredRentals.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <Home size={22} className="text-blue-600 dark:text-blue-400"/>
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Houses & Apartments for Rent</h2>
              <span className="rounded-full bg-blue-100 dark:bg-blue-950/80 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:text-blue-300">{filteredRentals.length}</span>
            </div>
            <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {filteredRentals.map(l => {
                const stat = reviewsMap[l.id];
                return (
                  <Link key={l.id} to={`/listing/${l.id}`} className="group rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden shadow-xs hover:shadow-lg transition-all hover:-translate-y-1">
                    <PhotoSlider photos={l.photos||[]} name={l.name}/>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-bold text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">{l.name}</h3>
                        <span className="shrink-0 rounded-full bg-blue-100 dark:bg-blue-950/80 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 uppercase">{l.type.replace(/_/g," ")}</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-slate-400 mb-2"><MapPin size={13}/><span>{[l.city,l.country].filter(Boolean).join(", ")||l.address}</span></div>
                      
                      {/* Review rating badge */}
                      <div className="flex items-center gap-1.5 mb-3">
                        <div className="flex items-center text-amber-500">
                          <Star size={13} className="fill-amber-400 text-amber-400"/>
                        </div>
                        <span className="text-xs font-bold text-gray-800 dark:text-slate-200">
                          {stat ? stat.avg.toFixed(1) : "5.0"}
                        </span>
                        <span className="text-[11px] text-gray-400 dark:text-slate-500">
                          ({stat ? `${stat.count} review${stat.count !== 1 ? 's' : ''}` : "Customer Reviews"})
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-slate-800">
                        <div><span className="text-xl font-bold text-blue-600 dark:text-blue-400">R{(l.monthly_rent||0).toLocaleString()}</span><span className="text-sm text-gray-400 dark:text-slate-500">/month</span></div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${l.status==="vacant"?"bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300":"bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300"}`}>{l.status==="vacant"?"Available":"Occupied"}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
