import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { ImageSlider } from "@/components/image-slider";
import { MapPin, BedDouble, Star, Send, ArrowLeft, CheckCircle, Users, Calendar, Baby, Wifi, Tv, Wind, Coffee, Bath, Dumbbell, ParkingCircle, Utensils, Globe, MessageSquareQuote, HelpCircle, MessageSquare, ExternalLink, Sparkles, Loader2 } from "lucide-react";
import { DEFAULT_ENQUIRY_QUESTIONS, getDefaultResponseForQuestion, sendEnquiryResponseEmail } from "@/lib/enquiry-templates";

const AMENITY_ICONS: Record<string, any> = { wifi: Wifi, tv: Tv, ac: Wind, coffee: Coffee, bath: Bath, gym: Dumbbell, parking: ParkingCircle, breakfast: Utensils, balcony: Globe };
const AMENITY_LABELS: Record<string, string> = { wifi: "Free Wi-Fi", tv: "Smart TV", ac: "Air Con", coffee: "Coffee Maker", bath: "Bathtub", gym: "Gym Access", parking: "Parking", breakfast: "Breakfast", balcony: "Balcony" };

type Review = { id: string; customer_name: string; rating: number; title: string; body: string; created_at: string; };

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
  const [automatedResponse, setAutomatedResponse] = useState<string>("");
  const [createdTicketId, setCreatedTicketId] = useState<string>("");
  const [selectedQuestionId, setSelectedQuestionId] = useState<string>("");

  // External booking & marketing opt-in state
  const [marketingAgreed, setMarketingAgreed] = useState(false);
  const [marketingEmail, setMarketingEmail] = useState("");
  const [savingMarketingEmail, setSavingMarketingEmail] = useState(false);
  const [marketingSuccess, setMarketingSuccess] = useState(false);
  const [showEnquiryForExternal, setShowEnquiryForExternal] = useState(false);

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
        const { data: roomData } = await supabase
          .from("room_type_listings")
          .select("*, properties(booking_mode, external_booking_url, discount_percentage)")
          .eq("id", pid)
          .maybeSingle();
        if (roomData) {
          const parentProps = (roomData as any).properties;
          const merged = {
            ...roomData,
            booking_mode: roomData.booking_mode || parentProps?.booking_mode || "platform",
            external_booking_url: roomData.external_booking_url || parentProps?.external_booking_url || "",
            discount_percentage: Number(roomData.discount_percentage || parentProps?.discount_percentage || 0),
          };
          setData(merged);
          setListingType("room_listing");
          await loadReviews(pid, true, roomData.property_id);
        }
      }
      setLoading(false);
    }
    void load();
  }, [propertyId]);

  const isExternalBooking = data?.booking_mode === "external" && Boolean(data?.external_booking_url);
  const externalBookingUrl = data?.external_booking_url || "";

  const handleExternalBooking = async () => {
    if (!externalBookingUrl) return;

    if (marketingAgreed) {
      const em = marketingEmail.trim().toLowerCase();
      if (!em || !em.includes("@") || !em.includes(".")) {
        alert("Please enter a valid email address to receive discounts and marketing updates.");
        return;
      }
      setSavingMarketingEmail(true);
      try {
        await supabase.from("marketing_agreed").insert({
          email: em,
          property_id: propertyId || null,
          marketing_opt_in: true,
          agreed_at: new Date().toISOString(),
        });
        setMarketingSuccess(true);
      } catch (err) {
        console.warn("Could not record marketing agreement:", err);
      } finally {
        setSavingMarketingEmail(false);
      }
    }

    // Open direct partner booking link
    window.open(externalBookingUrl, "_blank", "noopener,noreferrer");
  };

  const isHosp = listingType === "room_listing" || (data && ["hotel","motel","lodge","guest_house","commercial"].includes(data.type));
  const avgRating = reviews.length > 0 ? reviews.reduce((s,r) => s+r.rating, 0) / reviews.length : 0;

  const submitEnquiry = async () => {
    if (!form.name || !form.email) { alert("Please enter your name and email."); return; }
    if (!form.message.trim()) { alert("Please enter a question or select one from the common questions list."); return; }
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

      let insertedId = "";
      const { data: insertedRecord, error: insertError } = await supabase.from("enquiries").insert(payload).select().maybeSingle();
      if (insertError) {
        // Retry without room_type_listing_id in case column is not yet in table
        const fallbackPayload = { ...payload };
        delete fallbackPayload.room_type_listing_id;
        const { data: fallbackRecord, error: retryError } = await supabase.from("enquiries").insert(fallbackPayload).select().maybeSingle();
        if (retryError) throw retryError;
        insertedId = fallbackRecord?.id || "";
      } else {
        insertedId = insertedRecord?.id || "";
      }

      // Generate instant automated response for customer's enquiry question
      const autoReply = getDefaultResponseForQuestion(form.message, {
        propertyName: data?.name || data?.title,
        customerName: form.name,
      });

      setAutomatedResponse(autoReply);
      setCreatedTicketId(insertedId);

      // Save initial conversation thread if ticket id was obtained
      if (insertedId) {
        try {
          await supabase.from("enquiry_messages").insert([
            {
              enquiry_id: insertedId,
              sender_type: "customer",
              sender_name: form.name,
              body: form.message,
            },
            {
              enquiry_id: insertedId,
              sender_type: "staff",
              sender_name: "Automated Assistant",
              body: autoReply,
            },
          ]);
        } catch (msgErr) {
          console.warn("Could not save initial enquiry messages:", msgErr);
        }
      }

      // Dispatch automated response email to customer
      try {
        await sendEnquiryResponseEmail({
          toEmail: form.email,
          customerName: form.name,
          propertyName: data?.name || data?.title,
          enquiryId: insertedId,
          question: form.message,
          response: autoReply,
          companyName: data?.company_name || "Paimbabook",
        });
      } catch (mailErr) {
        console.warn("Could not send enquiry email:", mailErr);
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
      <Link to="/" className="text-blue-600 text-sm hover:underline">← Back to all listings</Link>
    </div>
  );

  // Derived display values
  const title = listingType === "room_listing" ? data.display_name : data.name;
  const subtitle = listingType === "room_listing" ? data.property_name : [data.address, data.city, data.country].filter(Boolean).join(", ");
  const photos = data.photos || [];
  const amenities: string[] = data.amenities || [];

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:py-10">
      <Link to="/" className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 mb-6 transition font-medium"><ArrowLeft size={15}/> Back to Listings</Link>

      <div className="grid lg:grid-cols-3 gap-6 sm:gap-8">
        <div className="lg:col-span-2 space-y-6">
          <ImageSlider images={photos} alt={title} aspectRatio="video" showThumbnails/>

          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${isHosp ? "bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300" : "bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300"}`}>{isHosp ? "Hospitality" : "Rental"}</span>
              {listingType === "room_listing" && <span className="rounded-full bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 px-3 py-1 text-xs font-semibold capitalize">{(data.type_key||"").replace(/_/g," ")}</span>}
              {listingType === "property" && <span className="rounded-full bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-slate-300 px-3 py-1 text-xs font-semibold capitalize">{(data.type||"").replace(/_/g," ")}</span>}
              {listingType === "property" && (
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${data.status==="vacant"?"bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300":"bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300"}`}>
                  {data.status==="vacant" ? "Available" : (data.available_from ? `Occupied · Available ${formatVacancyDate(data.available_from)}` : "Occupied")}
                </span>
              )}
              {listingType === "room_listing" && <span className="rounded-full bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-300 px-3 py-1 text-xs font-semibold">Available</span>}
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">{title}</h1>
            <div className="flex items-center gap-2 text-gray-500 dark:text-slate-400 mb-3 text-sm"><MapPin size={16}/><span>{subtitle}</span></div>
            
            {/* Rating Banner */}
            <div className="flex items-center gap-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 p-3 w-fit">
              <StarRating value={Math.round(avgRating || 5)}/>
              <span className="text-sm font-bold text-gray-800 dark:text-slate-200">
                {avgRating > 0 ? `${avgRating.toFixed(1)} / 5.0` : "5.0 / 5.0"}
              </span>
              <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">
                ({reviews.length} {reviews.length === 1 ? "review" : "reviews"} from verified customers)
              </span>
            </div>

            {data.discount_percentage > 0 && (
              <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-amber-800 dark:text-amber-200 text-xs font-semibold mt-2">
                <Sparkles size={16} className="text-amber-500 shrink-0" />
                <span>
                  🔥 Promotional Discount: <strong>{data.discount_percentage}% OFF</strong> active for this listing!
                </span>
              </div>
            )}
          </div>

          {/* Room listing details */}
          {listingType === "room_listing" && (
            <>
              <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4">Room Details</h3>
                <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-slate-300 mb-4">
                  <span className="flex items-center gap-1.5"><Users size={15} className="text-purple-600 dark:text-purple-400"/><strong>{data.adults_capacity}</strong> Adults</span>
                  {data.kids_capacity > 0 && <span className="flex items-center gap-1.5"><Baby size={15} className="text-purple-600 dark:text-purple-400"/><strong>{data.kids_capacity}</strong> Kids</span>}
                  <span className="flex items-center gap-1.5"><BedDouble size={15} className="text-purple-600 dark:text-purple-400"/><strong>{data.total_rooms_of_type}</strong> Rooms of this type</span>
                </div>
                {data.description && <p className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed">{data.description}</p>}
              </div>

              <div className="rounded-2xl border border-gray-200 p-5">
                <h3 className="font-bold text-gray-900 dark:text-white mb-4">Pricing Options</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {data.price_room_only > 0 && <div className="rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-800/40 p-3 text-center"><p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Room Only</p><p className="font-bold text-purple-700 dark:text-purple-300 text-lg">R{Number(data.price_room_only).toLocaleString()}<span className="text-xs font-normal text-gray-400 dark:text-slate-500">/night</span></p></div>}
                  {data.price_bed_breakfast > 0 && <div className="rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800/40 p-3 text-center"><p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Bed & Breakfast</p><p className="font-bold text-blue-700 dark:text-blue-300 text-lg">R{Number(data.price_bed_breakfast).toLocaleString()}<span className="text-xs font-normal text-gray-400 dark:text-slate-500">/night</span></p></div>}
                  {data.price_full_board > 0 && <div className="rounded-xl bg-green-50 dark:bg-green-950/40 border border-green-100 dark:border-green-800/40 p-3 text-center"><p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Full Board</p><p className="font-bold text-green-700 dark:text-green-300 text-lg">R{Number(data.price_full_board).toLocaleString()}<span className="text-xs font-normal text-gray-400 dark:text-slate-500">/night</span></p></div>}
                </div>
              </div>

              {amenities.length > 0 && (
                <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs">
                  <h3 className="font-bold text-gray-900 dark:text-white mb-4">Amenities</h3>
                  <div className="flex flex-wrap gap-2">
                    {amenities.map(a => { const Icon = AMENITY_ICONS[a]; return <span key={a} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3 py-1.5 text-sm text-gray-700 dark:text-slate-200">{Icon && <Icon size={14} className="text-purple-600 dark:text-purple-400"/>}{AMENITY_LABELS[a]||a}</span>; })}
                  </div>
                </div>
              )}
            </>
          )}

          {/* Property (hospitality) pricing */}
          {listingType === "property" && isHosp && (
            <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Pricing Options</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[["Room Only","default_room_price","/night"],["B&B","default_bed_breakfast","/night"],["Bed & Lunch","default_bed_lunch","/night"],["Full Board","default_full_board","/night"]].map(([label,key,unit]) => (
                  data[key] > 0 && (<div key={key} className="rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-800/40 p-3 text-center"><p className="text-xs text-gray-500 dark:text-slate-400 mb-1">{label}</p><p className="font-bold text-blue-700 dark:text-blue-300">R{Number(data[key]).toLocaleString()}<span className="text-xs font-normal text-gray-400 dark:text-slate-500">{unit}</span></p></div>)
                ))}
              </div>
              {data.total_rooms > 0 && <p className="mt-3 text-sm text-gray-500 dark:text-slate-400 flex items-center gap-1.5"><BedDouble size={15}/>{data.total_rooms} rooms total</p>}
            </div>
          )}

          {/* Property (rental) pricing */}
          {listingType === "property" && !isHosp && (
            <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs space-y-3">
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-1">Rental Details</h3>
                {data.discount_percentage > 0 ? (
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <p className="text-3xl font-black text-amber-600 dark:text-amber-400">
                      R{Math.round(Number(data.monthly_rent || 0) * (1 - data.discount_percentage / 100)).toLocaleString()}
                      <span className="text-base font-normal text-gray-400 dark:text-slate-500">/month</span>
                    </p>
                    <span className="text-base line-through text-gray-400 dark:text-slate-500">
                      R{Number(data.monthly_rent || 0).toLocaleString()}
                    </span>
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-black text-amber-600">
                      -{data.discount_percentage}% OFF
                    </span>
                  </div>
                ) : (
                  <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                    R{Number(data.monthly_rent||0).toLocaleString()}
                    <span className="text-base font-normal text-gray-400 dark:text-slate-500">/month</span>
                  </p>
                )}
              </div>

              {data.status !== "vacant" && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200 flex items-start gap-2">
                  <Calendar size={16} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div>
                    <span className="font-bold block">Scheduled Vacancy Date</span>
                    <span>
                      {data.available_from
                        ? `This unit is currently occupied and is scheduled to become vacant and ready for new tenancy on ${formatVacancyDate(data.available_from)}. You can submit an enquiry below to reserve or pre-book.`
                        : "This unit is currently occupied. Contact the property manager via the enquiry form below for expected vacancy date."}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Customer Reviews Section */}
          <div className="rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                  <MessageSquareQuote className="text-blue-600 dark:text-blue-400" size={22}/> Customer Reviews & Feedback
                </h3>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Real experiences shared by customers and guests.</p>
              </div>
              {reviews.length > 0 && (
                <div className="text-right">
                  <div className="text-2xl font-black text-gray-900 dark:text-white">{avgRating.toFixed(1)}</div>
                  <div className="text-xs text-gray-400 dark:text-slate-500">{reviews.length} total</div>
                </div>
              )}
            </div>

            {reviews.length === 0 ? (
              <div className="rounded-xl bg-gray-50/70 dark:bg-slate-800/40 border border-dashed border-gray-200 dark:border-slate-800 p-8 text-center text-gray-500 dark:text-slate-400">
                <MessageSquareQuote size={36} className="mx-auto mb-2 text-gray-300 dark:text-slate-600"/>
                <p className="font-semibold text-gray-700 dark:text-slate-300">No reviews yet</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Have you stayed or rented here? Be the first to leave your feedback below!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map(r => (
                  <div key={r.id} className="rounded-xl border border-gray-200/80 dark:border-slate-800 bg-gray-50/30 dark:bg-slate-800/50 p-4 transition hover:bg-gray-50 dark:hover:bg-slate-800">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-blue-600 text-white flex items-center justify-center text-sm font-bold shadow-xs">
                          {r.customer_name ? r.customer_name.charAt(0).toUpperCase() : "G"}
                        </div>
                        <div>
                          <p className="font-bold text-gray-900 dark:text-white text-sm">{r.customer_name}</p>
                          <p className="text-[11px] text-gray-400 dark:text-slate-500">{new Date(r.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                        </div>
                      </div>
                      <StarRating value={r.rating}/>
                    </div>
                    {r.title && <h4 className="font-bold text-gray-800 dark:text-slate-200 text-sm mb-1">{r.title}</h4>}
                    <p className="text-sm text-gray-600 dark:text-slate-300 leading-relaxed">{r.body}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Leave a Review Form */}
            <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-800">
              {reviewSent ? (
                <div className="rounded-2xl bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800/40 p-5 flex items-center gap-3 text-green-700 dark:text-green-300">
                  <CheckCircle size={24} className="shrink-0"/>
                  <div>
                    <p className="font-bold">Thank you! Your review has been posted.</p>
                    <p className="text-xs text-green-600 dark:text-green-400">Your honest feedback helps future guests and tenants make informed choices.</p>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-blue-100 dark:border-slate-800 bg-blue-50/20 dark:bg-slate-800/40 p-4 sm:p-5 space-y-4">
                  <h4 className="font-bold text-gray-900 dark:text-white text-base">Leave a Customer Review</h4>
                  <p className="text-xs text-gray-500 dark:text-slate-400">Rate your experience and share comments with other prospective tenants and guests.</p>
                  
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-1.5 block">Your Rating</label>
                    <StarRating value={review.rating} onChange={v => setReview({...review, rating: v})}/>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-medium text-gray-600 dark:text-slate-400 mb-1 block">Your Name *</label>
                      <input placeholder="e.g. Sarah M." value={review.name} onChange={e=>setReview({...review, name: e.target.value})} className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-slate-100 outline-none focus:border-blue-500"/>
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-gray-600 dark:text-slate-400 mb-1 block">Email Address *</label>
                      <input placeholder="email@example.com" type="email" value={review.email} onChange={e=>setReview({...review, email: e.target.value})} className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-slate-100 outline-none focus:border-blue-500"/>
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-gray-600 dark:text-slate-400 mb-1 block">Headline / Title (Optional)</label>
                    <input placeholder="e.g. Great stay, clean rooms and friendly host" value={review.title} onChange={e=>setReview({...review, title: e.target.value})} className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-slate-100 outline-none focus:border-blue-500"/>
                  </div>

                  <div>
                    <label className="text-[11px] font-medium text-gray-600 dark:text-slate-400 mb-1 block">Your Review *</label>
                    <textarea rows={3} placeholder="Tell others what you liked, room comfort, hospitality, amenities, or neighbourhood..." value={review.body} onChange={e=>setReview({...review, body: e.target.value})} className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-slate-100 outline-none focus:border-blue-500 resize-none"/>
                  </div>

                  <button onClick={submitReview} disabled={submitting} className="rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-xs">
                    {submitting ? "Posting Review..." : "Post Review"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Enquiry / Booking Form */}
        <div className="lg:col-span-1">
          <div className="sticky top-20 rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-lg space-y-4">
            {isExternalBooking && !showEnquiryForExternal ? (
              /* External Direct Booking Card */
              <div className="space-y-4">
                <div className="pb-3 border-b border-gray-100 dark:border-slate-800">
                  <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                    <ExternalLink size={11} /> Official Booking Partner
                  </span>
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg mt-1.5">
                    Direct Partner Booking
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                    Book directly with {data?.name || data?.display_name || "the provider"} on their official reservation site.
                  </p>
                </div>

                {data.discount_percentage > 0 && (
                  <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-amber-800 dark:text-amber-200 text-xs">
                    <Sparkles size={16} className="text-amber-500 shrink-0" />
                    <div>
                      <span className="font-bold block">🔥 {data.discount_percentage}% Promotional Discount</span>
                      <span className="text-[11px] opacity-90">Special rates apply when booking directly.</span>
                    </div>
                  </div>
                )}

                {/* Marketing & Discounts Agreement Checkbox */}
                <label className="flex items-start gap-2.5 p-3 rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-950/20 cursor-pointer transition hover:bg-blue-50 dark:hover:bg-blue-950/30">
                  <input
                    type="checkbox"
                    checked={marketingAgreed}
                    onChange={(e) => {
                      setMarketingAgreed(e.target.checked);
                      if (!e.target.checked) {
                        setMarketingEmail("");
                        setMarketingSuccess(false);
                      }
                    }}
                    className="mt-0.5 h-4 w-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-gray-800 dark:text-slate-200 leading-snug">
                    Receive property discounts from Paimbabook and marketing material
                  </span>
                </label>

                {/* If checkbox is ticked, prompt for email */}
                {marketingAgreed && (
                  <div className="space-y-1.5 p-3.5 rounded-xl border border-blue-100 dark:border-blue-900/30 bg-white dark:bg-slate-800">
                    <label className="text-xs font-bold text-gray-700 dark:text-slate-300 block">
                      Enter your email to unlock discounts *
                    </label>
                    <input
                      type="email"
                      placeholder="visitor@example.com"
                      value={marketingEmail}
                      onChange={(e) => setMarketingEmail(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-gray-900 dark:text-slate-100 outline-none focus:border-blue-500"
                      required
                    />
                    <p className="text-[10px] text-gray-500 dark:text-slate-400">
                      We store this in our marketing table and notify you of new property promotions.
                    </p>
                    {marketingSuccess && (
                      <p className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                        <CheckCircle size={12} /> Email registered! Redirecting to booking...
                      </p>
                    )}
                  </div>
                )}

                {/* Main Action Button */}
                <button
                  type="button"
                  onClick={handleExternalBooking}
                  disabled={savingMarketingEmail || (marketingAgreed && !marketingEmail.trim())}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 text-sm font-bold shadow-md transition disabled:opacity-50"
                >
                  {savingMarketingEmail ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <ExternalLink size={16} />
                  )}
                  <span>
                    {marketingAgreed
                      ? (marketingEmail.trim() ? "Submit & Book Now ↗" : "Enter Email to Enable Booking")
                      : "Book Now on Partner Site ↗"}
                  </span>
                </button>

                <div className="pt-2 border-t border-gray-100 dark:border-slate-800 text-center">
                  <button
                    type="button"
                    onClick={() => setShowEnquiryForExternal(true)}
                    className="text-xs font-medium text-gray-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 underline transition"
                  >
                    Need to ask a question first? Send an enquiry message ↓
                  </button>
                </div>
              </div>
            ) : enquirySent ? (
              <div className="py-4 space-y-4">
                <div className="text-center">
                  <div className="h-12 w-12 rounded-2xl bg-green-100 dark:bg-green-950/60 text-green-600 dark:text-green-400 mx-auto flex items-center justify-center mb-3 shadow-xs">
                    <CheckCircle size={28} />
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-lg">Enquiry Submitted!</h3>
                  {createdTicketId && (
                    <span className="inline-block mt-1 text-[11px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 px-2.5 py-0.5 rounded-md border border-blue-200 dark:border-blue-800">
                      Ticket #{createdTicketId.slice(0, 8).toUpperCase()}
                    </span>
                  )}
                </div>

                {automatedResponse && (
                  <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-slate-800/80 p-3.5 text-xs text-blue-950 dark:text-blue-100 space-y-2">
                    <div className="flex items-center gap-1.5 font-bold text-blue-700 dark:text-blue-300">
                      <MessageSquare size={14} />
                      <span>Instant Automated Response</span>
                    </div>
                    <p className="italic text-gray-700 dark:text-slate-300 leading-relaxed bg-white/80 dark:bg-slate-900/80 p-2.5 rounded-lg border border-blue-100 dark:border-slate-700">
                      "{automatedResponse}"
                    </p>
                  </div>
                )}

                <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-950/30 p-3 text-xs text-emerald-800 dark:text-emerald-200 space-y-1.5 leading-relaxed">
                  <p className="font-bold flex items-center gap-1">
                    <CheckCircle size={13} className="text-emerald-600 dark:text-emerald-400" />
                    Sent to {form.email}
                  </p>
                  <p>
                    A full copy of this response has been sent to your email. You can log in to your Customer Portal to view your ticket, upload documents, and reply.
                  </p>
                  <p className="text-[11px] text-emerald-700 dark:text-emerald-300 pt-1 font-semibold border-t border-emerald-200/60 dark:border-emerald-800/40">
                    💡 If this ticket is ever resolved or closed, replying from your portal will automatically re-open it at any time.
                  </p>
                </div>

                <div className="space-y-2 pt-1">
                  <Link
                    to="/portal/login"
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 shadow-xs transition"
                  >
                    Log In to Customer Portal &amp; Reply &rarr;
                  </Link>
                  <button
                    onClick={() => {
                      setEnquirySent(false);
                      setAutomatedResponse("");
                      setCreatedTicketId("");
                      setForm(prev => ({ ...prev, message: "" }));
                    }}
                    className="w-full text-center text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-slate-400 dark:hover:text-slate-200 py-1"
                  >
                    Ask Another Question
                  </button>
                </div>
              </div>
            ) : (<>
              {isExternalBooking && (
                <button
                  type="button"
                  onClick={() => setShowEnquiryForExternal(false)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline mb-2"
                >
                  <ArrowLeft size={12} /> Back to Direct Booking
                </button>
              )}
              <h3 className="font-bold text-gray-900 dark:text-white text-lg">{isHosp ? "Book a Room" : "Enquire Now"}</h3>
              <input placeholder="Your name *" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-slate-100 outline-none focus:border-blue-500"/>
              <input placeholder="Email address *" type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-slate-100 outline-none focus:border-blue-500"/>
              <input placeholder="Phone number" value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})} className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-slate-100 outline-none focus:border-blue-500"/>
              {isHosp && (<>
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="text-xs font-medium text-gray-600 dark:text-slate-400 mb-1 flex items-center gap-1"><Calendar size={11}/>Check-in</label><input type="date" value={form.check_in} onChange={e=>setForm({...form,check_in:e.target.value})} className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-slate-100 outline-none focus:border-blue-500"/></div>
                  <div><label className="text-xs font-medium text-gray-600 dark:text-slate-400 mb-1 flex items-center gap-1"><Calendar size={11}/>Check-out</label><input type="date" value={form.check_out} onChange={e=>setForm({...form,check_out:e.target.value})} className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-slate-100 outline-none focus:border-blue-500"/></div>
                </div>
                <div className="flex items-center gap-2"><Users size={15} className="text-gray-400"/><input type="number" min={1} value={form.guests} onChange={e=>setForm({...form,guests:Number(e.target.value)})} className="w-20 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-slate-100 outline-none focus:border-blue-500"/><span className="text-sm text-gray-500 dark:text-slate-400">Guests</span></div>
              </>)}

              {/* Common default questions selector */}
              <div>
                <label className="text-xs font-bold text-gray-700 dark:text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <HelpCircle size={14} className="text-blue-600 dark:text-blue-400" />
                  Common Questions
                </label>
                <select
                  value={selectedQuestionId}
                  onChange={(e) => {
                    const qId = e.target.value;
                    setSelectedQuestionId(qId);
                    const found = DEFAULT_ENQUIRY_QUESTIONS.find((q) => q.id === qId);
                    if (found) {
                      setForm((prev) => ({ ...prev, message: found.question }));
                    }
                  }}
                  className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-xs font-medium text-gray-900 dark:text-slate-100 outline-none focus:border-blue-500 mb-2 cursor-pointer"
                >
                  <option value="">-- Choose a frequent question or write below --</option>
                  {DEFAULT_ENQUIRY_QUESTIONS.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.shortLabel}: {q.question}
                    </option>
                  ))}
                </select>

                <div className="flex flex-wrap gap-1 mb-2">
                  {DEFAULT_ENQUIRY_QUESTIONS.slice(0, 4).map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => {
                        setSelectedQuestionId(q.id);
                        setForm((prev) => ({ ...prev, message: q.question }));
                      }}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border font-medium transition ${
                        selectedQuestionId === q.id
                          ? "bg-blue-50 border-blue-400 text-blue-700 dark:bg-blue-950/50 dark:border-blue-500 dark:text-blue-300"
                          : "border-gray-200 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-800/50 text-gray-600 dark:text-slate-300 hover:border-blue-300"
                      }`}
                    >
                      {q.shortLabel}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-gray-600 dark:text-slate-400 mb-1 block">Your Enquiry / Message *</label>
                <textarea rows={3} placeholder="Type your question or choose one of the common questions above..." value={form.message} onChange={e=>{ setForm({...form,message:e.target.value}); setSelectedQuestionId(""); }} className="w-full rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm text-gray-900 dark:text-slate-100 outline-none focus:border-blue-500 resize-none"/>
              </div>

              <button onClick={submitEnquiry} disabled={submitting || !form.message.trim()} className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-xs"><Send size={15}/>{submitting?"Sending...": isHosp ? "Send Booking Request" : "Send Enquiry"}</button>
              <p className="text-[11px] text-center text-gray-400 dark:text-slate-500">Instant response sent to your email. You can reply anytime in Customer Portal.</p>
            </>)}
          </div>
        </div>
      </div>
    </div>
  );
}
