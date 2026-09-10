import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { MapPin, BedDouble, Home, ChevronLeft, ChevronRight, Briefcase, Users, Baby, Star, Calendar, Clock, CheckCircle, XCircle, Loader2, Send, Building2 } from "lucide-react";

type RoomShowcase = {
  id: string; property_id: string; property_name: string; type_key: string;
  display_name: string; adults_capacity: number; kids_capacity: number;
  total_rooms_of_type: number; price_room_only: number; price_bed_breakfast: number;
  price_full_board: number; photos: string[]; description: string; amenities: string[];
};

type Booking = { check_in_date: string; check_out_date: string; room_type_listing_id: string; status: string; };

function PhotoSlider({ photos, name }: { photos: string[]; name: string }) {
  const [idx, setIdx] = useState(0);
  const safe = photos.filter(Boolean);
  if (safe.length === 0) return (
    <div className="aspect-video bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
      <BedDouble size={40} className="text-slate-300" />
    </div>
  );
  return (
    <div className="relative aspect-[4/3] overflow-hidden group">
      <img src={safe[idx]} alt={name} className="h-full w-full object-cover transition-all duration-500" />
      {safe.length > 1 && (<>
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIdx(i => i > 0 ? i-1 : safe.length-1); }} className="absolute left-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition hover:bg-black/70"><ChevronLeft size={15}/></button>
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIdx(i => i < safe.length-1 ? i+1 : 0); }} className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition hover:bg-black/70"><ChevronRight size={15}/></button>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
          {safe.map((_,i) => (<div key={i} className={`h-1.5 rounded-full transition-all ${i===idx?"w-4 bg-white":"w-1.5 bg-white/50"}`}/>))}
        </div>
      </>)}
    </div>
  );
}

function AvailabilityChecker({ room, bookings }: { room: RoomShowcase; bookings: Booking[] }) {
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [checkInTime, setCheckInTime] = useState("14:00");
  const [checkOutTime, setCheckOutTime] = useState("11:00");
  const [availability, setAvailability] = useState<"unknown"|"available"|"partial"|"full">("unknown");
  const [availableCount, setAvailableCount] = useState(0);
  const [enquiring, setEnquiring] = useState(false);
  const [enquireOpen, setEnquireOpen] = useState(false);
  const [enquiryForm, setEnquiryForm] = useState({ name: "", email: "", phone: "", guests: 2, message: "" });
  const [sent, setSent] = useState(false);

  const checkAvailability = useCallback(() => {
    if (!checkIn || !checkOut) { setAvailability("unknown"); return; }
    const inDT = new Date(`${checkIn}T${checkInTime}`);
    const outDT = new Date(`${checkOut}T${checkOutTime}`);
    if (outDT <= inDT) { setAvailability("unknown"); return; }

    const conflicting = bookings.filter(b => {
      if (b.room_type_listing_id !== room.id) return false;
      if (!["open","in_progress","confirmed"].includes(b.status)) return false;
      if (!b.check_in_date || !b.check_out_date) return false;
      const bIn = new Date(b.check_in_date);
      const bOut = new Date(b.check_out_date);
      return bIn < outDT && bOut > inDT;
    });

    const booked = conflicting.length;
    const available = room.total_rooms_of_type - booked;
    setAvailableCount(Math.max(0, available));
    if (available <= 0) setAvailability("full");
    else if (available < room.total_rooms_of_type) setAvailability("partial");
    else setAvailability("available");
  }, [checkIn, checkOut, checkInTime, checkOutTime, bookings, room]);

  useEffect(() => { checkAvailability(); }, [checkAvailability]);

  const today = new Date().toISOString().slice(0, 10);

  const sendEnquiry = async () => {
    if (!enquiryForm.name || !enquiryForm.email) { alert("Please enter your name and email."); return; }
    setEnquiring(true);
    try {
      await supabase.from("enquiries").insert({
        property_id: room.property_id,
        room_type_listing_id: room.id,
        customer_name: enquiryForm.name,
        customer_email: enquiryForm.email,
        customer_phone: enquiryForm.phone,
        type: "room_booking",
        check_in_date: checkIn || null,
        check_out_date: checkOut || null,
        guests: enquiryForm.guests,
        message: `Room Type: ${room.display_name} (${room.adults_capacity} Adults, ${room.kids_capacity} Kids)\nCheck-in: ${checkIn} ${checkInTime}\nCheck-out: ${checkOut} ${checkOutTime}\n\n${enquiryForm.message}`,
        status: "open",
      });
      setSent(true);
      setEnquireOpen(false);
    } catch { alert("Failed to send. Please try again."); }
    setEnquiring(false);
  };

  return (
    <div className="p-4 border-t border-gray-100 bg-gray-50">
      <h4 className="text-xs font-bold text-gray-700 mb-3 flex items-center gap-1.5"><Calendar size={13} className="text-purple-600"/>Check Availability</h4>
      <div className="grid grid-cols-2 gap-2 mb-2">
        <div>
          <label className="text-[10px] font-semibold text-gray-500 block mb-1">Check-in Date</label>
          <input type="date" min={today} value={checkIn} onChange={e => setCheckIn(e.target.value)} className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-purple-500"/>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 block mb-1">Check-out Date</label>
          <input type="date" min={checkIn || today} value={checkOut} onChange={e => setCheckOut(e.target.value)} className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-purple-500"/>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 block mb-1 flex items-center gap-1"><Clock size={9}/>Check-in Time</label>
          <input type="time" value={checkInTime} onChange={e => setCheckInTime(e.target.value)} className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-purple-500"/>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-gray-500 block mb-1 flex items-center gap-1"><Clock size={9}/>Check-out Time</label>
          <input type="time" value={checkOutTime} onChange={e => setCheckOutTime(e.target.value)} className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-purple-500"/>
        </div>
      </div>

      {/* Availability result */}
      {availability !== "unknown" && (
        <div className={`mb-3 rounded-xl px-3 py-2 text-xs font-semibold flex items-center gap-2 ${availability === "full" ? "bg-red-50 text-red-700 border border-red-200" : "bg-green-50 text-green-700 border border-green-200"}`}>
          {availability === "full" ? <XCircle size={14}/> : <CheckCircle size={14}/>}
          {availability === "full" ? "Fully booked for these dates" :
           availability === "partial" ? `${availableCount} of ${room.total_rooms_of_type} rooms still available` :
           `All ${room.total_rooms_of_type} rooms available`}
        </div>
      )}

      {sent ? (
        <div className="rounded-xl bg-green-50 border border-green-200 px-3 py-2 text-xs font-semibold text-green-700 flex items-center gap-2"><CheckCircle size={13}/>Booking request sent! We will contact you soon.</div>
      ) : enquireOpen ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="Your name *" value={enquiryForm.name} onChange={e => setEnquiryForm({...enquiryForm,name:e.target.value})} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-purple-500"/>
            <input placeholder="Email *" type="email" value={enquiryForm.email} onChange={e => setEnquiryForm({...enquiryForm,email:e.target.value})} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-purple-500"/>
            <input placeholder="Phone" value={enquiryForm.phone} onChange={e => setEnquiryForm({...enquiryForm,phone:e.target.value})} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-purple-500"/>
            <input type="number" min={1} placeholder="Guests" value={enquiryForm.guests} onChange={e => setEnquiryForm({...enquiryForm,guests:Number(e.target.value)})} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-purple-500"/>
          </div>
          <textarea rows={2} placeholder="Special requirements..." value={enquiryForm.message} onChange={e => setEnquiryForm({...enquiryForm,message:e.target.value})} className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-purple-500 resize-none"/>
          <div className="flex gap-2">
            <button onClick={() => setEnquireOpen(false)} className="flex-1 rounded-lg border border-gray-200 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100">Cancel</button>
            <button onClick={sendEnquiry} disabled={enquiring} className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-purple-600 py-1.5 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-50"><Send size={11}/>{enquiring?"Sending...":"Send Request"}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setEnquireOpen(true)} disabled={availability === "full"} className="w-full rounded-xl bg-purple-600 py-2 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed transition">
          {availability === "full" ? "Fully Booked" : "Book This Room →"}
        </button>
      )}
    </div>
  );
}

export default function AgentPortalPage() {
  const [roomShowcases, setRoomShowcases] = useState<RoomShowcase[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data: rooms } = await supabase.from("room_type_listings").select("*").eq("is_active", true).order("sort_order").order("property_id");
        if (rooms) setRoomShowcases(rooms as RoomShowcase[]);
      } catch { setRoomShowcases([]); }
      try {
        const { data: bks } = await supabase.from("enquiries").select("check_in_date,check_out_date,room_type_listing_id,status").in("status", ["open","in_progress","confirmed"]).not("room_type_listing_id", "is", null);
        if (bks) setBookings(bks as Booking[]);
      } catch { setBookings([]); }
      setLoading(false);
    }
    void load();
  }, []);

  // Group by property
  const byProperty: Record<string, { name: string; rooms: RoomShowcase[] }> = {};
  for (const r of roomShowcases) {
    if (!byProperty[r.property_id]) byProperty[r.property_id] = { name: r.property_name || "Property", rooms: [] };
    byProperty[r.property_id].rooms.push(r);
  }

  const allTypes = [...new Set(roomShowcases.map(r => r.type_key))];

  const filteredByProperty: typeof byProperty = {};
  for (const [pid, { name, rooms }] of Object.entries(byProperty)) {
    const filtered = filterType === "all" ? rooms : rooms.filter(r => r.type_key === filterType);
    if (filtered.length > 0) filteredByProperty[pid] = { name, rooms: filtered };
  }

  const AMENITY_LABELS: Record<string, string> = {
    wifi: "Wi-Fi", tv: "Smart TV", ac: "Air Con", coffee: "Coffee", bath: "Bathtub",
    gym: "Gym", parking: "Parking", breakfast: "Breakfast", balcony: "Balcony",
  };

  return (
    <div>
      {/* Hero */}
      <div className="bg-gradient-to-br from-slate-800 via-purple-900 to-slate-900 py-14 px-4 text-white">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500"><Briefcase size={20}/></div>
            <span className="text-sm font-semibold text-slate-300 uppercase tracking-widest">Agent & Booking Portal</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Available Room Types</h1>
          <p className="text-slate-300 max-w-2xl mb-6">Browse our full room type catalogue with real-time availability. Select your dates to see which room types are open for booking.</p>

          {allTypes.length > 1 && (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setFilterType("all")} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${filterType==="all"?"bg-amber-500 text-white":"bg-white/10 text-white/80 hover:bg-white/20"}`}>All Types</button>
              {allTypes.map(t => (<button key={t} onClick={() => setFilterType(t)} className={`rounded-xl px-4 py-2 text-sm font-semibold capitalize transition ${filterType===t?"bg-amber-500 text-white":"bg-white/10 text-white/80 hover:bg-white/20"}`}>{t}</button>))}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10">
        {loading && <div className="text-center py-20 text-gray-400"><Loader2 size={32} className="animate-spin mx-auto mb-3"/>Loading room showcases...</div>}

        {!loading && Object.keys(filteredByProperty).length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <BedDouble size={48} className="mx-auto mb-4 opacity-30"/>
            <p className="text-lg font-semibold">No room types published yet.</p>
            <p className="text-sm text-gray-400 mt-1">Admin: go to Room Showcases in the dashboard to add room types.</p>
          </div>
        )}

        {Object.entries(filteredByProperty).map(([pid, { name, rooms }]) => (
          <section key={pid} className="mb-12">
            <div className="flex items-center gap-3 mb-6 pb-3 border-b border-gray-200">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-700"><Building2 size={20}/></div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{name}</h2>
                <p className="text-sm text-gray-500">{rooms.length} room type{rooms.length !== 1 ? "s" : ""} available</p>
              </div>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map(room => (
                <div key={room.id} className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <PhotoSlider photos={room.photos} name={room.display_name}/>

                  <div className="p-4">
                    {/* Room header */}
                    <div className="mb-3">
                      <h3 className="font-bold text-gray-900 text-base">{room.display_name}</h3>
                      <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                        <span className="flex items-center gap-1.5"><Users size={13} className="text-purple-500"/>{room.adults_capacity} Adults</span>
                        {room.kids_capacity > 0 && <span className="flex items-center gap-1.5"><Baby size={13} className="text-blue-400"/>{room.kids_capacity} Kids</span>}
                        <span className="ml-auto rounded-full bg-purple-100 px-2.5 py-0.5 text-[10px] font-bold text-purple-700 capitalize">{room.type_key}</span>
                      </div>
                    </div>

                    {/* Description */}
                    {room.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{room.description}</p>}

                    {/* Pricing */}
                    <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 mb-3 space-y-1.5 text-xs">
                      {room.price_room_only > 0 && (<div className="flex justify-between items-center"><span className="text-gray-500">Room Only</span><span className="font-bold text-purple-700 text-sm">R{room.price_room_only.toLocaleString()}<span className="text-xs font-normal text-gray-400">/night</span></span></div>)}
                      {room.price_bed_breakfast > 0 && (<div className="flex justify-between"><span className="text-gray-500">Bed & Breakfast</span><span className="font-semibold">R{room.price_bed_breakfast.toLocaleString()}/night</span></div>)}
                      {room.price_full_board > 0 && (<div className="flex justify-between"><span className="text-gray-500">Full Board</span><span className="font-semibold">R{room.price_full_board.toLocaleString()}/night</span></div>)}
                      <div className="flex justify-between pt-1 border-t border-gray-200 mt-1">
                        <span className="text-gray-400">Total rooms of this type</span>
                        <span className="font-bold text-gray-700">{room.total_rooms_of_type}</span>
                      </div>
                    </div>

                    {/* Amenities */}
                    {room.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {room.amenities.map(a => (<span key={a} className="rounded-lg bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">{AMENITY_LABELS[a]||a}</span>))}
                      </div>
                    )}
                  </div>

                  {/* Availability checker */}
                  <AvailabilityChecker room={room} bookings={bookings}/>
                </div>
              ))}
            </div>
          </section>
        ))}

        {/* Tips */}
        {!loading && Object.keys(filteredByProperty).length > 0 && (
          <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <h3 className="font-bold text-amber-900 mb-2 flex items-center gap-2"><Star size={15} className="text-amber-500"/>Booking Notes</h3>
            <ul className="text-sm text-amber-800 space-y-1 list-disc list-inside">
              <li>Select your check-in and check-out dates and times to see real-time availability</li>
              <li>Green = rooms available · Orange = some rooms booked · Red = fully booked for those dates</li>
              <li>Clicking "Book This Room" sends a request to the property team who will confirm within 24h</li>
              <li>Contact us directly for group bookings or long-stay arrangements</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
