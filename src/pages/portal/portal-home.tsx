import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { getAllCountries, getCitiesForCountry } from "@/lib/geo-data";
import { MapPin, BedDouble, Home, Search, ChevronLeft, ChevronRight, Users, Baby, Star, DollarSign, Phone, X, Calendar, Flame, Megaphone, Sparkles, ExternalLink } from "lucide-react";

type RentalProp = {
  id: string;
  name: string;
  type: string;
  address: string;
  city: string;
  country: string;
  status: string;
  monthly_rent: number;
  photos: string[];
  available_from?: string;
  discount_percentage?: number;
  discount_start_date?: string;
  discount_end_date?: string;
  booking_mode?: string;
};

type RoomListing = {
  id: string;
  property_id: string;
  display_name: string;
  property_name: string;
  type_key: string;
  adults_capacity: number;
  kids_capacity: number;
  total_rooms_of_type: number;
  price_room_only: number;
  price_bed_breakfast: number;
  price_full_board: number;
  photos: string[];
  amenities: string[];
  city?: string;
  country?: string;
  discount_percentage?: number;
  discount_start_date?: string;
  discount_end_date?: string;
  booking_mode?: string;
};

type AgentListing = {
  id: string; name: string; type: string; listing_type: string;
  address: string; city: string; country: string; description: string;
  bedrooms: number; bathrooms: number; area_sqm: number;
  price: number; photos: string[]; amenities: string[];
  is_published: boolean;
  agent_name: string; agent_email: string; agent_phone: string;
  agent_whatsapp: string; agent_photo_url: string;
};

function formatVacancyDate(isoDate?: string): string | null {
  if (!isoDate) return null;
  try {
    const d = new Date(isoDate);
    if (isNaN(d.getTime())) return null;
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return null;
  }
}

function isDiscountActive(pct?: number, start?: string, end?: string): boolean {
  if (!pct || pct <= 0) return false;
  const today = new Date().toISOString().slice(0, 10);
  if (start && start > today) return false;
  if (end && end < today) return false;
  return true;
}

function calculateDiscountedPrice(original: number, pct?: number): number {
  if (!pct || pct <= 0) return original;
  return Math.round(original * (1 - pct / 100));
}

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
  const [agentMap, setAgentMap] = useState<Record<string, AgentListing>>({});
  const [reviewsMap, setReviewsMap] = useState<Record<string, { avg: number; count: number }>>({});
  const [ads, setAds] = useState<any[]>([]);
  const [boostedMap, setBoostedMap] = useState<Record<string, { badge: string; tier: string; score: number }>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedCity, setSelectedCity] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("properties")
          .select("id,name,type,address,city,country,status,monthly_rent,photos,available_from,discount_percentage,discount_start_date,discount_end_date,booking_mode")
          .eq("is_published", true)
          .order("name");
        if (error) {
          const fallback = await supabase
            .from("properties")
            .select("id,name,type,address,city,country,status,monthly_rent,photos,available_from")
            .eq("is_published", true)
            .order("name");
          setRentals((fallback.data || []) as RentalProp[]);
        } else {
          setRentals((data || []) as RentalProp[]);
        }
      } catch { setRentals([]); }

      try {
        const { data, error } = await supabase
          .from("room_type_listings")
          .select("id,property_id,display_name,property_name,type_key,adults_capacity,kids_capacity,total_rooms_of_type,price_room_only,price_bed_breakfast,price_full_board,photos,amenities,discount_percentage,discount_start_date,discount_end_date,booking_mode,properties(city,country,discount_percentage,discount_start_date,discount_end_date,booking_mode)")
          .eq("is_active", true)
          .order("sort_order")
          .order("created_at");
        if (error) {
          const fallback = await supabase
            .from("room_type_listings")
            .select("id,property_id,display_name,property_name,type_key,adults_capacity,kids_capacity,total_rooms_of_type,price_room_only,price_bed_breakfast,price_full_board,photos,amenities,properties(city,country)")
            .eq("is_active", true)
            .order("sort_order")
            .order("created_at");
          if (fallback.data) {
            const mapped = fallback.data.map((r: any) => ({
              ...r,
              city: r.properties?.city || "",
              country: r.properties?.country || "",
            }));
            setRoomListings(mapped as RoomListing[]);
          }
        } else if (data) {
          const mapped = data.map((r: any) => ({
            ...r,
            city: r.properties?.city || "",
            country: r.properties?.country || "",
            discount_percentage: r.discount_percentage ?? r.properties?.discount_percentage,
            discount_start_date: r.discount_start_date ?? r.properties?.discount_start_date,
            discount_end_date: r.discount_end_date ?? r.properties?.discount_end_date,
            booking_mode: r.booking_mode ?? r.properties?.booking_mode,
          }));
          setRoomListings(mapped as RoomListing[]);
        }
      } catch { setRoomListings([]); }

      try {
        const { data: agentData } = await supabase.from('agent_listings')
          .select('*')
          .eq('is_published', true)
          .order('created_at', { ascending: false });

        if (agentData && agentData.length > 0) {
          // Strictly ensure agent details are entered before appearing on the front page index
          const validAgentListings = agentData.filter((row: any) => 
            Boolean(row.agent_name && (row.agent_phone || row.agent_whatsapp))
          );

          // Sales listings
          const sales = validAgentListings.filter((l: any) => l.listing_type === 'sale');
          setSaleListings(sales as AgentListing[]);

          // Build agent lookup map by name and ID
          const aMap: Record<string, AgentListing> = {};
          validAgentListings.forEach((al: any) => {
            if (al.name) aMap[al.name.trim().toLowerCase()] = al;
            if (al.id) aMap[al.id] = al;
          });
          setAgentMap(aMap);

          // Merge any residential rentals from agent_listings into rentals
          const agentRentals: RentalProp[] = validAgentListings
            .filter((l: any) => l.listing_type === 'rent')
            .map((l: any) => ({
              id: l.id,
              name: l.name,
              type: l.type || 'residential',
              address: l.address || '',
              city: l.city || '',
              country: l.country || '',
              status: 'vacant',
              monthly_rent: l.price || 0,
              photos: l.photos || [],
            }));

          if (agentRentals.length > 0) {
            setRentals(prev => {
              const existingNames = new Set(prev.map(p => p.name.trim().toLowerCase()));
              const newProps = agentRentals.filter(p => !existingNames.has(p.name.trim().toLowerCase()));
              return [...prev, ...newProps];
            });
          }
        } else {
          setSaleListings([]);
          setAgentMap({});
        }
      } catch { 
        setSaleListings([]); 
        setAgentMap({});
      }

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

      try {
        const { data: adsData } = await supabase
          .from("marketing_ads")
          .select("*")
          .eq("is_active", true)
          .order("created_at", { ascending: false });
        if (adsData) setAds(adsData);
      } catch {}

      try {
        const { data: boostData } = await supabase
          .from("marketing_boosted_listings")
          .select("*")
          .eq("is_active", true);
        if (boostData) {
          const bMap: Record<string, { badge: string; tier: string; score: number }> = {};
          boostData.forEach((b: any) => {
            bMap[b.listing_id] = {
              badge: b.badge_label || "🔥 Featured",
              tier: b.boost_tier,
              score: b.priority_score || 10,
            };
          });
          setBoostedMap(bMap);
        }
      } catch {}

      setLoading(false);
    }
    void load();
  }, []);

  const trackAdClick = async (adId: string) => {
    try {
      await supabase.from("marketing_ad_events").insert({
        ad_id: adId,
        event_type: "click",
        page_url: window.location.href,
      });
    } catch {}
  };

  const tickerAd = useMemo(() => ads.find((a) => a.placement === "ticker"), [ads]);
  const heroBannerAd = useMemo(() => ads.find((a) => a.placement === "hero_banner"), [ads]);
  const inFeedAds = useMemo(() => ads.filter((a) => a.placement === "in_feed"), [ads]);

  const allListingsGeo = useMemo(() => {
    return [
      ...rentals.map(r => ({ country: r.country, city: r.city })),
      ...roomListings.map(r => ({ country: r.country, city: r.city })),
      ...saleListings.map(s => ({ country: s.country, city: s.city })),
    ];
  }, [rentals, roomListings, saleListings]);

  const countryOptions = useMemo(() => getAllCountries(allListingsGeo), [allListingsGeo]);
  const cityOptions = useMemo(() => getCitiesForCountry(selectedCountry, allListingsGeo), [selectedCountry, allListingsGeo]);

  const q = search.toLowerCase();
  const matchGeo = (item: { country?: string; city?: string }) => {
    if (selectedCountry && (item.country || "").trim().toLowerCase() !== selectedCountry.trim().toLowerCase()) {
      return false;
    }
    if (selectedCity && (item.city || "").trim().toLowerCase() !== selectedCity.trim().toLowerCase()) {
      return false;
    }
    return true;
  };

  const matchRental = (l: RentalProp) =>
    matchGeo(l) &&
    (!search || l.name.toLowerCase().includes(q) || (l.city||"").toLowerCase().includes(q) || (l.country||"").toLowerCase().includes(q));

  const matchRoom = (r: RoomListing) =>
    matchGeo(r) &&
    (!search || r.display_name.toLowerCase().includes(q) || (r.property_name||"").toLowerCase().includes(q) || (r.city||"").toLowerCase().includes(q) || (r.country||"").toLowerCase().includes(q));

  const matchSale = (s: AgentListing) =>
    matchGeo(s) &&
    (!search || s.name.toLowerCase().includes(q) || (s.city||'').toLowerCase().includes(q) || (s.country||'').toLowerCase().includes(q));

  const filteredRentals = useMemo(() => {
    if (filter === "booking" || filter === "sale") return [];
    return rentals.filter(matchRental).sort((a, b) => (boostedMap[b.id]?.score || 0) - (boostedMap[a.id]?.score || 0));
  }, [filter, rentals, search, selectedCountry, selectedCity, boostedMap]);

  const filteredRooms = useMemo(() => {
    if (filter === "rental" || filter === "sale") return [];
    return roomListings.filter(matchRoom).sort((a, b) => (boostedMap[b.id]?.score || 0) - (boostedMap[a.id]?.score || 0));
  }, [filter, roomListings, search, selectedCountry, selectedCity, boostedMap]);

  const filteredSales = useMemo(() => {
    if (filter === "rental" || filter === "booking") return [];
    return saleListings.filter(matchSale).sort((a, b) => (boostedMap[b.id]?.score || 0) - (boostedMap[a.id]?.score || 0));
  }, [filter, saleListings, search, selectedCountry, selectedCity, boostedMap]);

  const total = filteredRentals.length + filteredRooms.length + filteredSales.length;

  const lowestPrice = (r: RoomListing) => Math.min(...[r.price_room_only,r.price_bed_breakfast,r.price_full_board].filter(p=>p>0)) || 0;

  return (
    <div className="bg-slate-50 dark:bg-slate-950 transition-colors">
      {/* Top Announcement Ticker Ad */}
      {tickerAd && (
        <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 text-white px-4 py-2.5 text-xs text-center font-bold flex items-center justify-center gap-2 shadow-xs">
          <span className="bg-black/30 px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider">{tickerAd.badge_text || "PROMOTION"}</span>
          <span>{tickerAd.title}</span>
          {tickerAd.subtitle && <span className="hidden sm:inline text-white/90 font-normal">— {tickerAd.subtitle}</span>}
          {tickerAd.link_url && (
            <a
              href={tickerAd.link_url}
              onClick={() => trackAdClick(tickerAd.id)}
              className="inline-flex items-center gap-1 rounded-full bg-white/20 hover:bg-white/30 px-2.5 py-0.5 text-[11px] font-black underline ml-1"
            >
              {tickerAd.cta_text || "Explore"} <ExternalLink size={10} />
            </a>
          )}
        </div>
      )}

      {/* Hero Search Section */}
      <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-purple-700 dark:from-blue-900 dark:via-indigo-950 dark:to-purple-950 py-16 sm:py-20 px-4 text-center text-white">
        <h1 className="text-3xl sm:text-5xl font-bold mb-3 sm:mb-4 tracking-tight">Find Your Perfect Stay or Home</h1>
        <p className="text-sm sm:text-lg text-blue-100 dark:text-blue-200 mb-6 sm:mb-8 max-w-2xl mx-auto px-2">Browse available rooms, lodges, and rental properties with verified customer reviews.</p>

        {/* Promotional Hero Banner Ad */}
        {heroBannerAd && (
          <div className="mx-auto max-w-3xl mb-8 rounded-2xl overflow-hidden bg-white/10 backdrop-blur-md border border-white/20 p-4 text-left flex flex-col sm:flex-row items-center gap-4 shadow-xl">
            {heroBannerAd.image_url && (
              <img src={heroBannerAd.image_url} alt={heroBannerAd.title} className="w-full sm:w-48 aspect-video rounded-xl object-cover shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              {heroBannerAd.badge_text && (
                <span className="inline-block rounded-md bg-amber-400 text-slate-900 px-2 py-0.5 text-[10px] font-black uppercase mb-1">
                  {heroBannerAd.badge_text}
                </span>
              )}
              <h3 className="font-extrabold text-base sm:text-lg text-white leading-tight">{heroBannerAd.title}</h3>
              {heroBannerAd.subtitle && <p className="text-xs text-blue-100 mt-1 line-clamp-2">{heroBannerAd.subtitle}</p>}
            </div>
            {heroBannerAd.link_url && (
              <a
                href={heroBannerAd.link_url}
                onClick={() => trackAdClick(heroBannerAd.id)}
                className="shrink-0 rounded-xl bg-white text-blue-700 font-extrabold px-4 py-2.5 text-xs shadow-md hover:bg-blue-50 transition"
              >
                {heroBannerAd.cta_text || "View Offer →"}
              </a>
            )}
          </div>
        )}
        
        {/* Search Bar Container - Fully responsive with cascaded Country & City selectors */}
        <div className="mx-auto max-w-3xl flex flex-col gap-2.5 bg-white dark:bg-slate-900 rounded-2xl p-3 shadow-2xl border border-gray-100 dark:border-slate-800 text-left">
          {/* Top Row: Search Input */}
          <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-slate-800/70 rounded-xl border border-gray-100 dark:border-slate-700/60">
            <Search size={18} className="text-gray-400 dark:text-slate-400 shrink-0"/>
            <input
              value={search}
              onChange={e=>setSearch(e.target.value)}
              placeholder="Search by keyword, property or room name..."
              className="w-full outline-none text-gray-800 dark:text-slate-100 placeholder:text-gray-400 dark:placeholder:text-slate-500 text-sm bg-transparent"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
                <X size={16} />
              </button>
            )}
          </div>

          {/* Bottom Filter Controls: Category, Country, City */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Category Filter */}
            <div>
              <label className="block text-[11px] font-bold text-gray-500 dark:text-slate-400 mb-1">Category</label>
              <select
                value={filter}
                onChange={e=>setFilter(e.target.value)}
                className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm text-gray-800 dark:text-slate-200 outline-none focus:border-blue-500 font-medium cursor-pointer"
              >
                <option value="all">All Listings</option>
                <option value="booking">Book a Room</option>
                <option value="rental">For Rent</option>
                <option value="sale">For Sale</option>
              </select>
            </div>

            {/* Country Selector (Must be selected first) */}
            <div>
              <label className="block text-[11px] font-bold text-gray-500 dark:text-slate-400 mb-1">Country</label>
              <select
                value={selectedCountry}
                onChange={e => {
                  setSelectedCountry(e.target.value);
                  setSelectedCity("");
                }}
                className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-2 text-xs sm:text-sm text-gray-800 dark:text-slate-200 outline-none focus:border-blue-500 font-medium cursor-pointer"
              >
                <option value="">All Countries</option>
                {countryOptions.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* City Selector (Disabled until country is chosen) */}
            <div>
              <label className="block text-[11px] font-bold text-gray-500 dark:text-slate-400 mb-1">
                City {!selectedCountry && <span className="text-[10px] text-amber-500 font-normal">(Select country first)</span>}
              </label>
              <select
                value={selectedCity}
                onChange={e => setSelectedCity(e.target.value)}
                disabled={!selectedCountry}
                className={`w-full rounded-xl border px-3 py-2 text-xs sm:text-sm outline-none font-medium transition ${
                  !selectedCountry
                    ? "border-gray-200 dark:border-slate-800 bg-gray-100 dark:bg-slate-800/40 text-gray-400 dark:text-slate-500 cursor-not-allowed"
                    : "border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-800 dark:text-slate-200 focus:border-blue-500 cursor-pointer"
                }`}
              >
                {!selectedCountry ? (
                  <option value="">Select country first</option>
                ) : (
                  <>
                    <option value="">All Cities in {selectedCountry}</option>
                    {cityOptions.map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </>
                )}
              </select>
            </div>
          </div>

          {/* Active Filter Badges & Clear All */}
          {(selectedCountry || selectedCity || search || filter !== "all") && (
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-100 dark:border-slate-800/80 text-xs">
              <div className="flex flex-wrap items-center gap-1.5 text-gray-600 dark:text-slate-300">
                <span className="font-semibold text-gray-400 dark:text-slate-500 text-[11px]">Active Filters:</span>
                {selectedCountry && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 text-blue-700 dark:text-blue-300 font-medium">
                    {selectedCountry}
                    <button type="button" onClick={() => { setSelectedCountry(""); setSelectedCity(""); }} className="hover:text-blue-900 dark:hover:text-blue-100">×</button>
                  </span>
                )}
                {selectedCity && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 dark:bg-purple-950/60 px-2 py-0.5 text-purple-700 dark:text-purple-300 font-medium">
                    {selectedCity}
                    <button type="button" onClick={() => setSelectedCity("")} className="hover:text-purple-900 dark:hover:text-purple-100">×</button>
                  </span>
                )}
                {filter !== "all" && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-emerald-700 dark:text-emerald-300 font-medium capitalize">
                    {filter}
                    <button type="button" onClick={() => setFilter("all")} className="hover:text-emerald-900 dark:hover:text-emerald-100">×</button>
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedCountry("");
                  setSelectedCity("");
                  setSearch("");
                  setFilter("all");
                }}
                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                Clear all
              </button>
            </div>
          )}
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

        {/* In-Feed Sponsored Ads */}
        {inFeedAds.length > 0 && (
          <div className="mb-14 grid gap-6 grid-cols-1 md:grid-cols-2">
            {inFeedAds.map((ad) => (
              <div key={ad.id} className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 text-white p-6 shadow-xl flex flex-col justify-between border border-purple-400/30">
                <div className="flex items-center justify-between mb-4">
                  <span className="rounded-full bg-amber-400 text-slate-900 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide">
                    {ad.badge_text || "Sponsored Highlight"}
                  </span>
                  <Megaphone size={16} className="text-amber-300" />
                </div>
                <div className="mb-4">
                  <h3 className="text-xl font-black mb-1">{ad.title}</h3>
                  {ad.subtitle && <p className="text-sm text-purple-200">{ad.subtitle}</p>}
                </div>
                {ad.image_url && (
                  <img src={ad.image_url} alt={ad.title} className="w-full h-40 object-cover rounded-xl mb-4" />
                )}
                {ad.link_url && (
                  <a
                    href={ad.link_url}
                    onClick={() => trackAdClick(ad.id)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-white text-purple-900 font-bold px-4 py-2.5 text-sm hover:bg-purple-50 transition shadow"
                  >
                    {ad.cta_text || "Learn More"} <ExternalLink size={14} />
                  </a>
                )}
              </div>
            ))}
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
                const boost = boostedMap[r.id] || boostedMap[r.property_id];
                const hasDiscount = isDiscountActive(r.discount_percentage, r.discount_start_date, r.discount_end_date);
                const originalPrice = lowestPrice(r);
                const discountedPrice = hasDiscount ? calculateDiscountedPrice(originalPrice, r.discount_percentage) : originalPrice;
                return (
                  <Link key={r.id} to={`/listing/${r.id}`} className={`group relative rounded-2xl border ${boost ? "border-amber-400 dark:border-amber-500 shadow-md ring-2 ring-amber-400/30" : "border-gray-200 dark:border-slate-800"} bg-white dark:bg-slate-900 overflow-hidden shadow-xs hover:shadow-lg transition-all hover:-translate-y-1`}>
                    {boost && (
                      <div className="absolute top-3 left-3 z-20 flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white px-2.5 py-1 text-[11px] font-black shadow-md tracking-wider uppercase">
                        <Sparkles size={11} className="fill-white" />
                        {boost.badge}
                      </div>
                    )}
                    {hasDiscount && (
                      <div className="absolute top-3 right-3 z-20 flex items-center gap-1 rounded-full bg-rose-600 text-white px-2.5 py-1 text-[11px] font-black shadow-md tracking-wider uppercase">
                        <Flame size={11} className="fill-white" />
                        -{r.discount_percentage}% OFF
                      </div>
                    )}
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
                        <div>
                          {hasDiscount ? (
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-xl font-bold text-rose-600 dark:text-rose-400">R{discountedPrice.toLocaleString()}</span>
                              <span className="text-xs line-through text-gray-400">R{originalPrice.toLocaleString()}</span>
                              <span className="text-sm text-gray-400 dark:text-slate-500">/night</span>
                            </div>
                          ) : (
                            <div><span className="text-xl font-bold text-purple-600 dark:text-purple-400">R{originalPrice.toLocaleString()}</span><span className="text-sm text-gray-400 dark:text-slate-500">/night</span></div>
                          )}
                        </div>
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
              {filteredSales.map(s => {
                const boost = boostedMap[s.id];
                return (
                  <div key={s.id} className={`relative rounded-2xl border ${boost ? "border-amber-400 dark:border-amber-500 shadow-md ring-2 ring-amber-400/30" : "border-gray-200 dark:border-slate-800"} bg-white dark:bg-slate-900 overflow-hidden shadow-xs hover:shadow-lg transition-all`}>
                    {boost && (
                      <div className="absolute top-3 left-3 z-20 flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white px-2.5 py-1 text-[11px] font-black shadow-md tracking-wider uppercase">
                        <Sparkles size={11} className="fill-white" />
                        {boost.badge}
                      </div>
                    )}
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
                              {s.agent_phone && <span className="flex items-center gap-1"><Phone size={11} className="text-gray-400 shrink-0" /> {s.agent_phone}</span>}
                              {s.agent_whatsapp && <a href={`https://wa.me/${s.agent_whatsapp.replace(/[^0-9]/g,'')}`} target="_blank" rel="noreferrer" className="text-green-600 dark:text-green-400 hover:underline">WhatsApp</a>}
                            </div>
                            {s.agent_email && <div className="text-[10px] text-gray-400 dark:text-slate-500 truncate">{s.agent_email}</div>}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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
                const boost = boostedMap[l.id];
                const hasDiscount = isDiscountActive(l.discount_percentage, l.discount_start_date, l.discount_end_date);
                const originalRent = l.monthly_rent || 0;
                const discountedRent = hasDiscount ? calculateDiscountedPrice(originalRent, l.discount_percentage) : originalRent;
                return (
                  <Link key={l.id} to={`/listing/${l.id}`} className={`group relative rounded-2xl border ${boost ? "border-amber-400 dark:border-amber-500 shadow-md ring-2 ring-amber-400/30" : "border-gray-200 dark:border-slate-800"} bg-white dark:bg-slate-900 overflow-hidden shadow-xs hover:shadow-lg transition-all hover:-translate-y-1`}>
                    {boost && (
                      <div className="absolute top-3 left-3 z-20 flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white px-2.5 py-1 text-[11px] font-black shadow-md tracking-wider uppercase">
                        <Sparkles size={11} className="fill-white" />
                        {boost.badge}
                      </div>
                    )}
                    {hasDiscount && (
                      <div className="absolute top-3 right-3 z-20 flex items-center gap-1 rounded-full bg-rose-600 text-white px-2.5 py-1 text-[11px] font-black shadow-md tracking-wider uppercase">
                        <Flame size={11} className="fill-white" />
                        -{l.discount_percentage}% OFF
                      </div>
                    )}
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
                        <div>
                          {hasDiscount ? (
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-xl font-bold text-rose-600 dark:text-rose-400">R{discountedRent.toLocaleString()}</span>
                              <span className="text-xs line-through text-gray-400">R{originalRent.toLocaleString()}</span>
                              <span className="text-sm text-gray-400 dark:text-slate-500">/month</span>
                            </div>
                          ) : (
                            <div><span className="text-xl font-bold text-blue-600 dark:text-blue-400">R{originalRent.toLocaleString()}</span><span className="text-sm text-gray-400 dark:text-slate-500">/month</span></div>
                          )}
                        </div>
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${l.status==="vacant"?"bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300":"bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300"}`}>
                          {l.status==="vacant" ? "Available" : (l.available_from ? `Occupied · Available ${formatVacancyDate(l.available_from)}` : "Occupied")}
                        </span>
                      </div>

                      {/* Agent Contact Card */}
                      {(() => {
                        const agent = agentMap[l.name.trim().toLowerCase()] || agentMap[l.id];
                        if (!agent || !agent.agent_name) return null;
                        return (
                          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-800 flex items-center gap-2.5">
                            {agent.agent_photo_url ? (
                              <img src={agent.agent_photo_url} alt={agent.agent_name} className="w-8 h-8 rounded-full object-cover border border-white dark:border-slate-700 shadow-xs shrink-0"/>
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center font-bold text-xs shrink-0">
                                {agent.agent_name.charAt(0)}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold text-xs text-gray-900 dark:text-white truncate flex items-center gap-1.5">
                                <span>{agent.agent_name}</span>
                                <span className="text-[9px] bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-bold">Agent</span>
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-slate-400 mt-0.5">
                                {agent.agent_phone && (
                                  <span 
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `tel:${agent.agent_phone}`; }}
                                    className="flex items-center gap-1 hover:text-blue-600 cursor-pointer"
                                  >
                                    <Phone size={10} className="text-gray-400 shrink-0" />
                                    <span>{agent.agent_phone}</span>
                                  </span>
                                )}
                                {agent.agent_whatsapp && (
                                  <span 
                                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(`https://wa.me/${agent.agent_whatsapp.replace(/[^0-9]/g,'')}`, '_blank'); }}
                                    className="text-green-600 dark:text-green-400 font-bold hover:underline cursor-pointer"
                                  >
                                    WhatsApp
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
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
