import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { MapPin, BedDouble, Home, Search, ChevronLeft, ChevronRight, Users, Baby, Star } from "lucide-react";

type RentalProp = { id: string; name: string; type: string; address: string; city: string; country: string; status: string; monthly_rent: number; photos: string[]; };
type RoomListing = { id: string; property_id: string; display_name: string; property_name: string; type_key: string; adults_capacity: number; kids_capacity: number; total_rooms_of_type: number; price_room_only: number; price_bed_breakfast: number; price_full_board: number; photos: string[]; amenities: string[]; };

function PhotoSlider({ photos, name }: { photos: string[]; name: string }) {
  const [idx, setIdx] = useState(0);
  const safe = (photos || []).filter(Boolean);
  if (safe.length === 0) return <div className="aspect-video bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center"><Home size={40} className="text-blue-300"/></div>;
  return (
    <div className="relative aspect-video overflow-hidden group">
      <img src={safe[idx]} alt={name} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"/>
      {safe.length > 1 && (<>
        <button onClick={e=>{e.preventDefault();setIdx(i=>i>0?i-1:safe.length-1);}} className="absolute left-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition"><ChevronLeft size={14}/></button>
        <button onClick={e=>{e.preventDefault();setIdx(i=>i<safe.length-1?i+1:0);}} className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition"><ChevronRight size={14}/></button>
        <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">{idx+1}/{safe.length}</div>
      </>)}
    </div>
  );
}

export default function PortalHomePage() {
  const [rentals, setRentals] = useState<RentalProp[]>([]);
  const [roomListings, setRoomListings] = useState<RoomListing[]>([]);
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

  const filteredRentals = filter === "booking" ? [] : rentals.filter(matchRental);
  const filteredRooms = filter === "rental" ? [] : roomListings.filter(matchRoom);
  const total = filteredRentals.length + filteredRooms.length;

  const lowestPrice = (r: RoomListing) => Math.min(...[r.price_room_only,r.price_bed_breakfast,r.price_full_board].filter(p=>p>0)) || 0;

  return (
    <div>
      <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-purple-700 py-20 px-4 text-center text-white">
        <h1 className="text-4xl sm:text-5xl font-bold mb-4 tracking-tight">Find Your Perfect Stay or Home</h1>
        <p className="text-lg text-blue-100 mb-8 max-w-2xl mx-auto">Browse available rooms, lodges, and rental properties with verified customer reviews.</p>
        <div className="mx-auto max-w-2xl flex gap-3 bg-white rounded-2xl p-2 shadow-2xl">
          <div className="flex items-center gap-2 flex-1 px-3"><Search size={18} className="text-gray-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search city, property or room name..." className="flex-1 outline-none text-gray-800 text-sm"/></div>
          <select value={filter} onChange={e=>setFilter(e.target.value)} className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-700 outline-none focus:border-blue-500">
            <option value="all">All Listings</option>
            <option value="booking">🛏️ Book a Room</option>
            <option value="rental">🏠 For Rent</option>
          </select>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-12">
        {loading && <div className="text-center py-20 text-gray-400">Loading listings...</div>}
        {!loading && total === 0 && (
          <div className="text-center py-24">
            <Home size={56} className="mx-auto mb-4 text-gray-200"/>
            <p className="text-xl font-bold text-gray-400 mb-2">No listings published yet</p>
            <p className="text-sm text-gray-400">New rooms and properties will appear here once published by the property manager.</p>
          </div>
        )}

        {/* Book a Room — room_type_listings */}
        {!loading && filteredRooms.length > 0 && (
          <section className="mb-14">
            <div className="flex items-center gap-3 mb-6">
              <BedDouble size={22} className="text-purple-600"/>
              <h2 className="text-2xl font-bold text-gray-900">Book a Room</h2>
              <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-bold text-purple-700">{filteredRooms.length}</span>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredRooms.map(r => {
                const stat = reviewsMap[r.id] || reviewsMap[r.property_id];
                return (
                  <Link key={r.id} to={`/portal/listing/${r.id}`} className="group rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-lg transition-all hover:-translate-y-1">
                    <PhotoSlider photos={r.photos||[]} name={r.display_name}/>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h3 className="font-bold text-gray-900 group-hover:text-purple-700 transition">{r.display_name}</h3>
                        <span className="shrink-0 rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold text-purple-700 capitalize">{r.type_key.replace(/_/g," ")}</span>
                      </div>
                      <p className="text-xs text-gray-500 mb-2 flex items-center gap-1"><MapPin size={11}/>{r.property_name}</p>
                      
                      {/* Review rating badge */}
                      <div className="flex items-center gap-1.5 mb-2.5">
                        <div className="flex items-center text-amber-500">
                          <Star size={13} className="fill-amber-400 text-amber-400"/>
                        </div>
                        <span className="text-xs font-bold text-gray-800">
                          {stat ? stat.avg.toFixed(1) : "5.0"}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          ({stat ? `${stat.count} review${stat.count !== 1 ? 's' : ''}` : "Guest Reviews"})
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                        <span className="flex items-center gap-1"><Users size={11}/>{r.adults_capacity} Adults</span>
                        {r.kids_capacity>0&&<span className="flex items-center gap-1"><Baby size={11}/>{r.kids_capacity} Kids</span>}
                        <span className="text-gray-300">·</span>
                        <span>{r.total_rooms_of_type} room{r.total_rooms_of_type!==1?"s":""}</span>
                      </div>
                      {r.amenities&&r.amenities.length>0&&(
                        <div className="flex flex-wrap gap-1 mb-3">
                          {r.amenities.slice(0,3).map((a:string)=><span key={a} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600 capitalize">{a.replace(/_/g," ")}</span>)}
                          {r.amenities.length>3&&<span className="text-[10px] text-gray-400">+{r.amenities.length-3} more</span>}
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                        <div><span className="text-xl font-bold text-purple-700">R{lowestPrice(r).toLocaleString()}</span><span className="text-sm text-gray-400">/night</span></div>
                        <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">Available</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* For Rent — published rental properties */}
        {!loading && filteredRentals.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <Home size={22} className="text-blue-600"/>
              <h2 className="text-2xl font-bold text-gray-900">Houses & Apartments for Rent</h2>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">{filteredRentals.length}</span>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredRentals.map(l => {
                const stat = reviewsMap[l.id];
                return (
                  <Link key={l.id} to={`/portal/listing/${l.id}`} className="group rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-lg transition-all hover:-translate-y-1">
                    <PhotoSlider photos={l.photos||[]} name={l.name}/>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-bold text-gray-900 group-hover:text-blue-700 transition">{l.name}</h3>
                        <span className="shrink-0 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700 uppercase">{l.type.replace(/_/g," ")}</span>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-500 mb-2"><MapPin size={13}/><span>{[l.city,l.country].filter(Boolean).join(", ")||l.address}</span></div>
                      
                      {/* Review rating badge */}
                      <div className="flex items-center gap-1.5 mb-3">
                        <div className="flex items-center text-amber-500">
                          <Star size={13} className="fill-amber-400 text-amber-400"/>
                        </div>
                        <span className="text-xs font-bold text-gray-800">
                          {stat ? stat.avg.toFixed(1) : "5.0"}
                        </span>
                        <span className="text-[11px] text-gray-400">
                          ({stat ? `${stat.count} review${stat.count !== 1 ? 's' : ''}` : "Customer Reviews"})
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div><span className="text-xl font-bold text-blue-700">R{(l.monthly_rent||0).toLocaleString()}</span><span className="text-sm text-gray-400">/month</span></div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${l.status==="vacant"?"bg-green-100 text-green-700":"bg-orange-100 text-orange-700"}`}>{l.status==="vacant"?"Available":"Occupied"}</span>
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
