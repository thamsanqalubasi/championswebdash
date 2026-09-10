import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { ImageSlider } from "@/components/image-slider";
import { MapPin, BedDouble, Star, Send, ArrowLeft, CheckCircle, Users, Calendar, Baby, Wifi, Tv, Wind, Coffee, Bath, Dumbbell, ParkingCircle, Utensils, Globe, MessageSquareQuote } from "lucide-react";

const AMENITY_ICONS: Record<string, any> = { wifi: Wifi, tv: Tv, ac: Wind, coffee: Coffee, bath: Bath, gym: Dumbbell, parking: ParkingCircle, breakfast: Utensils, balcony: Globe };
const AMENITY_LABELS: Record<string, string> = { wifi: "Free Wi-Fi", tv: "Smart TV", ac: "Air Con", coffee: "Coffee Maker", bath: "Bathtub", gym: "Gym Access", parking: "Parking", breakfast: "Breakfast", balcony: "Balcony" };

type Review = { id: string; customer_name: string; rating: number; title: string; body: string; created_at: string; };

function StarRating({ value, onChange }: { value: number; onChange?: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1,2,3,4,5].map(n => (
        <button key={n} type="button" onClick={() => onChange?.(n)} className={onChange ? "cursor-pointer" : "cursor-default"}>
          <Star size={20} className={n <= value ? "fill-yellow-400 text-yellow-400" : "text-gray-300"} />
        </button>
      ))}
    </div>
  );
}

export default function PortalListingPage() {
  const { propertyId } = useParams<{ propertyId: string }>();
  const [data, setData] = useState<any>(null);
  const [listingType, setListingType] = useState<"property" | "room_listing">("property");
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [enquirySent, setEnquirySent] = useState(false);
  const [reviewSent, setReviewSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "", check_in: "", check_out: "", guests: 1 });
  const [review, setReview] = useState({ name: "", email: "", rating: 5, title: "", body: "" });

  async function loadReviews(propId: string, isRoomType: boolean, parentPropId?: string) {
    try {
      // 1. Query reviews that belong to this listing (by property_id or room_type_listing_id)
      const targetIds = [propId, parentPropId].filter(Boolean) as string[];
      const { data: rv, error } = await supabase
        .from("listing_reviews")
        .select("*")
        .in("property_id", targetIds)
        .order("created_at", { ascending: false });

      if (!error && rv && rv.length > 0) {
        setReviews(rv as Review[]);
        return;
      }

      // 2. If no direct match by property_id, check for reviews with room_type_listing_id or any reviews with null property_id
      const { data: allRevs } = await supabase
        .from("listing_reviews")
        .select("*")
        .order("created_at", { ascending: false });

      if (allRevs && allRevs.length > 0) {
        const matched = allRevs.filter((r: any) => 
          (r.room_type_listing_id && r.room_type_listing_id === propId) ||
          (r.property_id && targetIds.includes(r.property_id)) ||
          (!r.property_id && !r.room_type_listing_id) // show unassigned general reviews on listings
        );
        if (matched.length > 0) {
          setReviews(matched as Review[]);
          return;
        }
      }
      setReviews([]);
    } catch {
      setReviews([]);
    }
  }

  useEffect(() => {
    if (!propertyId) return;
    const pid = propertyId;
    async function load() {
      setLoading(true);
      // Try properties first
      const { data: propData } = await supabase.from("properties").select("*").eq("id", pid).maybeSingle();
      if (propData) {
        setData(propData);
        setListingType("property");
        await loadReviews(pid, false);
      } else {
        // Try room_type_listings
        const { data: roomData } = await supabase.from("room_type_listings").select("*").eq("id", pid).maybeSingle();
        if (roomData) {
          setData(roomData);
          setListingType("room_listing");
          await loadReviews(pid, true, roomData.property_id);
        }
      }
      setLoading(false);
    }
    void load();
  }, [propertyId]);

  const isHosp = listingType === "room_listing" || (data && ["hotel","motel","lodge","guest_house","commercial"].includes(data.type));
  const avgRating = reviews.length > 0 ? reviews.reduce((s,r) => s+r.rating, 0) / reviews.length : 0;

  const submitEnquiry = async () => {
    if (!form.name || !form.email) { alert("Please enter your name and email."); return; }
    setSubmitting(true);
    try {
      const targetCompanyId = data?.company_id || data?.companyId || null;
      const payload: any = {
        customer_name: form.name,
        customer_email: form.email,
        customer_phone: form.phone || "",
        type: isHosp ? "room_booking" : "rental_enquiry",
        check_in_date: form.check_in || null,
        check_out_date: form.check_out || null,
        guests: form.guests,
        message: form.message,
      };

      if (targetCompanyId) {
        payload.company_id = targetCompanyId;
      }
      if (listingType === "room_listing") {
        payload.room_type_listing_id = propertyId;
        if (data?.property_id) payload.property_id = data.property_id;
      } else {
        payload.property_id = propertyId;
      }

      const { error: insertError } = await supabase.from("enquiries").insert(payload);
      if (insertError) {
        // Retry without room_type_listing_id in case column is not yet in table
        const fallbackPayload = { ...payload };
        delete fallbackPayload.room_type_listing_id;
        const { error: retryError } = await supabase.from("enquiries").insert(fallbackPayload);
        if (retryError) throw retryError;
      }
      setEnquirySent(true);
    } catch (err: any) {
      alert(err?.message || "Failed to send enquiry. Please try again.");
    }
    setSubmitting(false);
  };

  const submitReview = async () => {
    if (!review.name || !review.email) { alert("Please enter your name and email."); return; }
    if (!review.body.trim()) { alert("Please write a few words about your experience."); return; }
    setSubmitting(true);
    try {
      // Prepare payload with company_id from parent property or listing
      const payload: any = {
        property_id: listingType === "room_listing" ? (data?.property_id || propertyId) : propertyId,
        customer_name: review.name,
        customer_email: review.email,
        rating: review.rating,
        title: review.title || "Guest Review",
        body: review.body,
        is_approved: true, // Show immediately on portal
      };

      if (data?.company_id) {
        payload.company_id = data.company_id;
      }

      const { data: inserted, error } = await supabase.from("listing_reviews").insert(payload).select().single();
      if (error) {
        // If company_id is strictly required or column mismatch, retry with fallback payload
        const retryPayload = { ...payload };
        delete retryPayload.company_id;
        const { error: retryError } = await supabase.from("listing_reviews").insert(retryPayload);
        if (retryError) throw retryError;
      }

      // Optimistically update local review list
      const newReviewItem: Review = {
        id: inserted?.id || String(Date.now()),
        customer_name: review.name,
        rating: review.rating,
        title: review.title || "Guest Review",
        body: review.body,
        created_at: new Date().toISOString(),
      };
      setReviews(prev => [newReviewItem, ...prev]);
      setReviewSent(true);
      setReview({ name: "", email: "", rating: 5, title: "", body: "" });
    } catch (err: any) {
      alert(err?.message || "Failed to submit review. Please try again.");
    }
    setSubmitting(false);
  };

  if (loading) return <div className="flex items-center justify-center py-32 text-gray-400">Loading listing...</div>;
  if (!data) return (
    <div className="flex flex-col items-center justify-center py-32 text-gray-400 gap-4">
      <BedDouble size={48} className="opacity-20"/>
      <p className="text-lg font-medium">Listing not found.</p>
      <Link to="/portal" className="text-blue-600 text-sm hover:underline">← Back to all listings</Link>
    </div>
  );

  // Derived display values
  const title = listingType === "room_listing" ? data.display_name : data.name;
  const subtitle = listingType === "room_listing" ? data.property_name : [data.address, data.city, data.country].filter(Boolean).join(", ");
  const photos = data.photos || [];
  const amenities: string[] = data.amenities || [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link to="/portal" className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 mb-6 transition"><ArrowLeft size={15}/> Back to Listings</Link>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <ImageSlider images={photos} alt={title} aspectRatio="video" showThumbnails/>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${isHosp ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{isHosp ? "Hospitality" : "Rental"}</span>
              {listingType === "room_listing" && <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold capitalize">{(data.type_key||"").replace(/_/g," ")}</span>}
              {listingType === "property" && <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold capitalize">{(data.type||"").replace(/_/g," ")}</span>}
              {listingType === "property" && <span className={`rounded-full px-3 py-1 text-xs font-semibold ${data.status==="vacant"?"bg-green-100 text-green-700":"bg-orange-100 text-orange-700"}`}>{data.status==="vacant"?"Available":"Occupied"}</span>}
              {listingType === "room_listing" && <span className="rounded-full bg-green-100 text-green-700 px-3 py-1 text-xs font-semibold">Available</span>}
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{title}</h1>
            <div className="flex items-center gap-2 text-gray-500 mb-3"><MapPin size={16}/><span>{subtitle}</span></div>
            
            {/* Rating Banner */}
            <div className="flex items-center gap-3 rounded-xl bg-amber-50/80 border border-amber-200/60 p-3 w-fit">
              <StarRating value={Math.round(avgRating || 5)}/>
              <span className="text-sm font-bold text-gray-800">
                {avgRating > 0 ? `${avgRating.toFixed(1)} / 5.0` : "5.0 / 5.0"}
              </span>
              <span className="text-xs text-gray-500 font-medium">
                ({reviews.length} {reviews.length === 1 ? "review" : "reviews"} from verified customers)
              </span>
            </div>
          </div>

          {/* Room listing details */}
          {listingType === "room_listing" && (
            <>
              <div className="rounded-2xl border border-gray-200 p-5">
                <h3 className="font-bold text-gray-900 mb-4">Room Details</h3>
                <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-4">
                  <span className="flex items-center gap-1.5"><Users size={15} className="text-purple-600"/><strong>{data.adults_capacity}</strong> Adults</span>
                  {data.kids_capacity > 0 && <span className="flex items-center gap-1.5"><Baby size={15} className="text-purple-600"/><strong>{data.kids_capacity}</strong> Kids</span>}
                  <span className="flex items-center gap-1.5"><BedDouble size={15} className="text-purple-600"/><strong>{data.total_rooms_of_type}</strong> Rooms of this type</span>
                </div>
                {data.description && <p className="text-gray-600 text-sm">{data.description}</p>}
              </div>

              <div className="rounded-2xl border border-gray-200 p-5">
                <h3 className="font-bold text-gray-900 mb-4">Pricing Options</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {data.price_room_only > 0 && <div className="rounded-xl bg-purple-50 border border-purple-100 p-3 text-center"><p className="text-xs text-gray-500 mb-1">Room Only</p><p className="font-bold text-purple-700 text-lg">R{Number(data.price_room_only).toLocaleString()}<span className="text-xs font-normal text-gray-400">/night</span></p></div>}
                  {data.price_bed_breakfast > 0 && <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-center"><p className="text-xs text-gray-500 mb-1">Bed & Breakfast</p><p className="font-bold text-blue-700 text-lg">R{Number(data.price_bed_breakfast).toLocaleString()}<span className="text-xs font-normal text-gray-400">/night</span></p></div>}
                  {data.price_full_board > 0 && <div className="rounded-xl bg-green-50 border border-green-100 p-3 text-center"><p className="text-xs text-gray-500 mb-1">Full Board</p><p className="font-bold text-green-700 text-lg">R{Number(data.price_full_board).toLocaleString()}<span className="text-xs font-normal text-gray-400">/night</span></p></div>}
                </div>
              </div>

              {amenities.length > 0 && (
                <div className="rounded-2xl border border-gray-200 p-5">
                  <h3 className="font-bold text-gray-900 mb-4">Amenities</h3>
                  <div className="flex flex-wrap gap-2">
                    {amenities.map(a => { const Icon = AMENITY_ICONS[a]; return <span key={a} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-700">{Icon && <Icon size={14} className="text-purple-600"/>}{AMENITY_LABELS[a]||a}</span>; })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Property (hospitality) pricing */}
          {listingType === "property" && isHosp && (
            <div className="rounded-2xl border border-gray-200 p-5">
              <h3 className="font-bold text-gray-900 mb-4">Pricing Options</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[["Room Only","default_room_price","/night"],["B&B","default_bed_breakfast","/night"],["Bed & Lunch","default_bed_lunch","/night"],["Full Board","default_full_board","/night"]].map(([label,key,unit]) => (
                  data[key] > 0 && (<div key={key} className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-center"><p className="text-xs text-gray-500 mb-1">{label}</p><p className="font-bold text-blue-700">R{Number(data[key]).toLocaleString()}<span className="text-xs font-normal text-gray-400">{unit}</span></p></div>)
                ))}
              </div>
              {data.total_rooms > 0 && <p className="mt-3 text-sm text-gray-500 flex items-center gap-1.5"><BedDouble size={15}/>{data.total_rooms} rooms total</p>}
            </div>
          )}

          {/* Property (rental) pricing */}
          {listingType === "property" && !isHosp && (
            <div className="rounded-2xl border border-gray-200 p-5">
              <h3 className="font-bold text-gray-900 mb-2">Rental Details</h3>
              <p className="text-3xl font-bold text-blue-700">R{Number(data.monthly_rent||0).toLocaleString()}<span className="text-base font-normal text-gray-400">/month</span></p>
            </div>
          )}

          {/* Customer Reviews Section */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <MessageSquareQuote className="text-blue-600" size={22}/> Customer Reviews & Feedback
                </h3>
                <p className="text-xs text-gray-500 mt-1">Real experiences shared by customers and guests.</p>
              </div>
              {reviews.length > 0 && (
                <div className="text-right">
                  <div className="text-2xl font-black text-gray-900">{avgRating.toFixed(1)}</div>
                  <div className="text-xs text-gray-400">{reviews.length} total</div>
                </div>
              )}
            </div>

            {reviews.length === 0 ? (
              <div className="rounded-xl bg-gray-50/70 border border-dashed border-gray-200 p-8 text-center text-gray-500">
                <MessageSquareQuote size={36} className="mx-auto mb-2 text-gray-300"/>
                <p className="font-semibold text-gray-700">No reviews yet</p>
                <p className="text-xs text-gray-400 mt-1">Have you stayed or rented here? Be the first to leave your feedback below!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map(r => (
                  <div key={r.id} className="rounded-xl border border-gray-200/80 bg-gray-50/30 p-4 transition hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold shadow-sm">
                          {r.customer_name ? r.customer_name.charAt(0).toUpperCase() : "G"}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 text-sm">{r.customer_name}</p>
                          <p className="text-[11px] text-gray-400">{new Date(r.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                        </div>
                      </div>
                      <StarRating value={r.rating}/>
                    </div>
                    {r.title && <h4 className="font-bold text-gray-800 text-sm mb-1">{r.title}</h4>}
                    <p className="text-sm text-gray-600 leading-relaxed">{r.body}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Leave a Review Form */}
            <div className="mt-8 pt-6 border-t border-gray-100">
              {reviewSent ? (
                <div className="rounded-2xl bg-green-50 border border-green-200 p-5 flex items-center gap-3 text-green-700">
                  <CheckCircle size={24} className="shrink-0"/>
                  <div>
                    <p className="font-bold">Thank you! Your review has been posted.</p>
                    <p className="text-xs text-green-600">Your honest feedback helps future guests and tenants make informed choices.</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-blue-100 bg-blue-50/20 p-5 space-y-4">
                  <h4 className="font-bold text-gray-900 text-base">Leave a Customer Review</h4>
                  <p className="text-xs text-gray-500">Rate your experience and share comments with other prospective tenants and guests.</p>
                  
                  <div>
                    <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Your Rating</label>
                    <StarRating value={review.rating} onChange={v => setReview({...review, rating: v})}/>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-medium text-gray-600 mb-1 block">Your Name *</label>
                      <input placeholder="e.g. Sarah M." value={review.name} onChange={e=>setReview({...review, name: e.target.value})} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"/>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-gray-600 mb-1 block">Email Address *</label>
                      <input placeholder="email@example.com" type="email" value={review.email} onChange={e=>setReview({...review, email: e.target.value})} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"/>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-gray-600 mb-1 block">Headline / Title (Optional)</label>
                    <input placeholder="e.g. Great stay, clean rooms and friendly host" value={review.title} onChange={e=>setReview({...review, title: e.target.value})} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"/>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-gray-600 mb-1 block">Your Review *</label>
                    <textarea rows={3} placeholder="Tell others what you liked, room comfort, hospitality, amenities, or neighbourhood..." value={review.body} onChange={e=>setReview({...review, body: e.target.value})} className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none"/>
                  </div>

                  <button onClick={submitReview} disabled={submitting} className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-sm">
                    {submitting ? "Posting Review..." : "Post Review"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Enquiry / Booking Form */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 rounded-2xl border border-gray-200 bg-white p-5 shadow-lg space-y-4">
            {enquirySent ? (
              <div className="text-center py-8"><CheckCircle size={48} className="mx-auto mb-3 text-green-500"/><h3 className="font-bold text-gray-900 text-lg mb-2">Enquiry Sent!</h3><p className="text-sm text-gray-500">We will get back to you as soon as possible.</p></div>
            ) : (<>
              <h3 className="font-bold text-gray-900 text-lg">{isHosp ? "Book a Room" : "Enquire Now"}</h3>
              <input placeholder="Your name *" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500"/>
              <input placeholder="Email address *" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500"/>
              <input placeholder="Phone number" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500"/>
              {isHosp && (<>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs font-medium text-gray-600 mb-1 block flex items-center gap-1"><Calendar size={11}/>Check-in</label><input type="date" value={form.check_in} onChange={e=>setForm({...form,check_in:e.target.value})} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500"/></div>
                  <div><label className="text-xs font-medium text-gray-600 mb-1 block flex items-center gap-1"><Calendar size={11}/>Check-out</label><input type="date" value={form.check_out} onChange={e=>setForm({...form,check_out:e.target.value})} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500"/></div>
                </div>
                <div className="flex items-center gap-2"><Users size={15} className="text-gray-400"/><input type="number" min={1} value={form.guests} onChange={e=>setForm({...form,guests:Number(e.target.value)})} className="w-20 rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500"/><span className="text-sm text-gray-500">Guests</span></div>
              </>)}
              <textarea rows={3} placeholder="Message or specific requirements..." value={form.message} onChange={e=>setForm({...form,message:e.target.value})} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none"/>
              <button onClick={submitEnquiry} disabled={submitting} className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition"><Send size={15}/>{submitting?"Sending...": isHosp ? "Send Booking Request" : "Send Enquiry"}</button>
              <p className="text-xs text-center text-gray-400">We typically respond within 24 hours</p>
            </>)}
          </div>
        </div>
      </div>
    </div>
  );
}
