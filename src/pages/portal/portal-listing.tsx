import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { ImageSlider } from "@/components/image-slider";
import { MapPin, BedDouble, Star, Send, ArrowLeft, CheckCircle, Users, Calendar } from "lucide-react";

const HOSP = ["hotel","motel","lodge","guest_house","commercial"];

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
  const [property, setProperty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [enquirySent, setEnquirySent] = useState(false);
  const [reviewSent, setReviewSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "", check_in: "", check_out: "", guests: 1 });
  const [review, setReview] = useState({ name: "", email: "", rating: 5, title: "", body: "" });

  useEffect(() => {
    if (!propertyId) return;
    async function load() {
      setLoading(true);
      const { data } = await supabase.from("properties").select("*").eq("id", propertyId).single();
      if (data) setProperty(data);
      try {
        const { data: rv } = await supabase.from("listing_reviews").select("*").eq("property_id", propertyId).eq("is_approved", true).order("created_at", { ascending: false });
        if (rv) setReviews(rv);
      } catch {}
      setLoading(false);
    }
    void load();
  }, [propertyId]);

  const isHosp = property ? HOSP.includes(property.type) : false;
  const avgRating = reviews.length > 0 ? reviews.reduce((s,r) => s+r.rating, 0) / reviews.length : 0;

  const submitEnquiry = async () => {
    if (!form.name || !form.email) { alert("Please enter your name and email."); return; }
    setSubmitting(true);
    try {
      await supabase.from("enquiries").insert({ company_id: property?.company_id || null, property_id: propertyId, customer_name: form.name, customer_email: form.email, customer_phone: form.phone, type: isHosp ? "room_booking" : "rental_enquiry", check_in_date: form.check_in || null, check_out_date: form.check_out || null, guests: form.guests, message: form.message });
      setEnquirySent(true);
    } catch { alert("Failed to send enquiry. Please try again."); }
    setSubmitting(false);
  };

  const submitReview = async () => {
    if (!review.name || !review.email) { alert("Please enter your name and email."); return; }
    setSubmitting(true);
    try {
      await supabase.from("listing_reviews").insert({ property_id: propertyId, company_id: property?.company_id || null, customer_name: review.name, customer_email: review.email, rating: review.rating, title: review.title, body: review.body, is_approved: false });
      setReviewSent(true);
    } catch { alert("Failed to submit review."); }
    setSubmitting(false);
  };

  if (loading) return <div className="flex items-center justify-center py-32 text-gray-400">Loading listing...</div>;
  if (!property) return <div className="flex items-center justify-center py-32 text-gray-400">Property not found.</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <Link to="/portal" className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 mb-6 transition"><ArrowLeft size={15}/> Back to Listings</Link>

      <div className="grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <ImageSlider images={property.photos || []} alt={property.name} aspectRatio="video" showThumbnails/>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${isHosp ? "bg-purple-100 text-purple-700" : "bg-blue-100 text-blue-700"}`}>{isHosp ? "Hospitality" : "Rental"}</span>
              <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold capitalize">{(property.type||"").replace(/_/g," ")}</span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${property.status==="vacant"?"bg-green-100 text-green-700":"bg-orange-100 text-orange-700"}`}>{property.status==="vacant"?"Available":"Occupied"}</span>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{property.name}</h1>
            <div className="flex items-center gap-2 text-gray-500 mb-4"><MapPin size={16}/><span>{[property.address, property.city, property.country].filter(Boolean).join(", ")}</span></div>
            {reviews.length > 0 && (<div className="flex items-center gap-2"><StarRating value={Math.round(avgRating)}/><span className="text-sm text-gray-500">({reviews.length} review{reviews.length!==1?"s":""})</span></div>)}
          </div>

          {isHosp && (
            <div className="rounded-2xl border border-gray-200 p-5">
              <h3 className="font-bold text-gray-900 mb-4">Pricing Options</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[["Room Only","default_room_price","/night"],["B&B","default_bed_breakfast","/night"],["Bed & Lunch","default_bed_lunch","/night"],["Full Board","default_full_board","/night"]].map(([label,key,unit]) => (
                  property[key] > 0 && (
                    <div key={key as string} className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-center">
                      <p className="text-xs text-gray-500 mb-1">{label}</p>
                      <p className="font-bold text-blue-700">R{Number(property[key as string]).toLocaleString()}<span className="text-xs font-normal text-gray-400">{unit}</span></p>
                    </div>
                  )
                ))}
              </div>
              {property.total_rooms > 0 && <p className="mt-3 text-sm text-gray-500 flex items-center gap-1.5"><BedDouble size={15}/>{property.total_rooms} rooms total</p>}
            </div>
          )}

          {!isHosp && (
            <div className="rounded-2xl border border-gray-200 p-5">
              <h3 className="font-bold text-gray-900 mb-2">Rental Details</h3>
              <p className="text-3xl font-bold text-blue-700">R{Number(property.monthly_rent||0).toLocaleString()}<span className="text-base font-normal text-gray-400">/month</span></p>
            </div>
          )}

          {/* Reviews */}
          <div>
            <h3 className="text-xl font-bold text-gray-900 mb-4">Guest Reviews {reviews.length > 0 && `(${reviews.length})`}</h3>
            {reviews.length === 0 ? (<p className="text-gray-400 text-sm">No reviews yet. Be the first to leave a review!</p>) : (
              <div className="space-y-4">
                {reviews.map(r => (
                  <div key={r.id} className="rounded-2xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2"><div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700">{r.customer_name.charAt(0).toUpperCase()}</div><span className="font-semibold text-gray-900">{r.customer_name}</span></div>
                      <StarRating value={r.rating}/>
                    </div>
                    {r.title && <p className="font-semibold text-gray-900 mb-1">{r.title}</p>}
                    <p className="text-sm text-gray-600">{r.body}</p>
                    <p className="text-xs text-gray-400 mt-2">{new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}

            {reviewSent ? (
              <div className="mt-6 rounded-2xl bg-green-50 border border-green-200 p-4 flex items-center gap-3 text-green-700"><CheckCircle size={20}/><div><p className="font-semibold">Review submitted!</p><p className="text-sm">Thank you. Your review will appear after approval.</p></div></div>
            ) : (
              <div className="mt-6 rounded-2xl border border-gray-200 p-5 space-y-3">
                <h4 className="font-bold text-gray-900">Leave a Review</h4>
                <div><label className="text-xs font-medium text-gray-600 mb-1 block">Your Rating</label><StarRating value={review.rating} onChange={v => setReview({...review, rating: v})}/></div>
                <div className="grid grid-cols-2 gap-3"><input placeholder="Your name" value={review.name} onChange={e=>setReview({...review,name:e.target.value})} className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500"/><input placeholder="Email" type="email" value={review.email} onChange={e=>setReview({...review,email:e.target.value})} className="rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500"/></div>
                <input placeholder="Review title" value={review.title} onChange={e=>setReview({...review,title:e.target.value})} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500"/>
                <textarea rows={3} placeholder="Write your experience..." value={review.body} onChange={e=>setReview({...review,body:e.target.value})} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 resize-none"/>
                <button onClick={submitReview} disabled={submitting} className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition">{submitting?"Submitting...":"Submit Review"}</button>
              </div>
            )}
          </div>
        </div>

        {/* Enquiry Form */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 rounded-2xl border border-gray-200 bg-white p-5 shadow-lg space-y-4">
            {enquirySent ? (
              <div className="text-center py-8">
                <CheckCircle size={48} className="mx-auto mb-3 text-green-500"/>
                <h3 className="font-bold text-gray-900 text-lg mb-2">Enquiry Sent!</h3>
                <p className="text-sm text-gray-500">We will get back to you as soon as possible.</p>
              </div>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
