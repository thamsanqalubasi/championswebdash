import { useState, useEffect, useRef } from "react";
import { ModulePage } from "@/components/module-page";
import { EmptyState, LoadingState } from "@/components/data-state";
import { Modal } from "@/components/modal";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { uploadFileToBucket } from "@/lib/storage";
import { useCurrency } from "@/lib/currency";
import type { RoomTypeListing, PropertyRow } from "@/lib/types";
import { DataTableHeader, TableRowActions, TableActionButton } from "@/components/data-table";
import {
  Plus, Pencil, Trash2, BedDouble, Users, Baby, Image as ImageIcon, Upload,
  Loader2, X, ChevronLeft, ChevronRight, Building2, Layers, Star, Wifi,
  Tv, Wind, Coffee, Bath, Dumbbell, ParkingCircle, Utensils, Globe, AlertCircle,
  Eye, EyeOff, Home, MapPin, DollarSign
} from "lucide-react";

const ROOM_TYPE_OPTIONS = [
  { key: "standard", label: "Standard Room", adults: 2, kids: 0 },
  { key: "single", label: "Single Room", adults: 1, kids: 0 },
  { key: "twin", label: "Twin Room", adults: 2, kids: 0 },
  { key: "double", label: "Double Room", adults: 2, kids: 0 },
  { key: "deluxe", label: "Deluxe Room", adults: 2, kids: 1 },
  { key: "executive", label: "Executive Room", adults: 2, kids: 0 },
  { key: "family", label: "Family Room", adults: 4, kids: 2 },
  { key: "suite", label: "Suite", adults: 2, kids: 2 },
  { key: "penthouse", label: "Penthouse Suite", adults: 4, kids: 2 },
  { key: "honeymoon", label: "Honeymoon Suite", adults: 2, kids: 0 },
  { key: "accessible", label: "Accessible Room", adults: 2, kids: 0 },
];

const AMENITY_OPTIONS = [
  { key: "wifi", label: "Free Wi-Fi", icon: Wifi },
  { key: "tv", label: "Smart TV", icon: Tv },
  { key: "ac", label: "Air Con", icon: Wind },
  { key: "coffee", label: "Coffee Maker", icon: Coffee },
  { key: "bath", label: "Bathtub", icon: Bath },
  { key: "gym", label: "Gym Access", icon: Dumbbell },
  { key: "parking", label: "Parking", icon: ParkingCircle },
  { key: "breakfast", label: "Breakfast", icon: Utensils },
  { key: "balcony", label: "Balcony", icon: Globe },
];

const emptyForm = {
  property_id: "",
  type_key: "",
  display_name: "",
  adults_capacity: 2,
  kids_capacity: 0,
  total_rooms_of_type: 1,
  price_room_only: "" as string | number,
  price_bed_breakfast: "" as string | number,
  price_full_board: "" as string | number,
  description: "",
  amenities: [] as string[],
  sort_order: 0,
  is_active: true,
};

function PhotoCarousel({ photos }: { photos: string[] }) {
  const [idx, setIdx] = useState(0);
  const safe = (photos || []).filter(Boolean);
  if (safe.length === 0) return (
    <div className="aspect-video rounded-xl bg-surface-elevated/50 flex items-center justify-center border border-border-color">
      <ImageIcon size={32} className="text-muted/30" />
    </div>
  );
  return (
    <div className="relative aspect-video overflow-hidden rounded-xl group">
      <img src={safe[idx]} alt="room" className="h-full w-full object-cover" />
      {safe.length > 1 && (<>
        <button onClick={() => setIdx(i => i > 0 ? i-1 : safe.length-1)} className="absolute left-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition"><ChevronLeft size={14}/></button>
        <button onClick={() => setIdx(i => i < safe.length-1 ? i+1 : 0)} className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition"><ChevronRight size={14}/></button>
        <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">{idx+1}/{safe.length}</div>
      </>)}
    </div>
  );
}

export default function ShowcasePage() {
  const { currentCompany } = useAuth();
  const { format: formatCurrency } = useCurrency();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<"bookings" | "forrent">("bookings");
  const [listings, setListings] = useState<RoomTypeListing[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [rentalProperties, setRentalProperties] = useState<any[]>([]);
  const [propertyRoomTypes, setPropertyRoomTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof emptyForm>({ ...emptyForm });
  const [formPhotos, setFormPhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data: props } = await supabase.from("properties").select("*").eq("company_id", currentCompany.id).order("name");
        if (props) {
          const mapped = props.map((p: any) => ({ id: p.id, companyId: p.company_id || currentCompany.id, name: p.name, type: p.type, address: p.address || "", status: p.status || "occupied", monthlyRent: p.monthly_rent || 0, totalRooms: p.total_rooms || 0, defaultRoomPrice: p.default_room_price || 0, defaultBedBreakfast: p.default_bed_breakfast || 0, defaultBedLunch: p.default_bed_lunch || 0, defaultFullBoard: p.default_full_board || 0, photos: p.photos || [], rooms: [], floors: p.floors || [], city: p.city || "", country: p.country || "", isPublished: p.is_published || false }));
          setProperties(mapped);
          setRentalProperties(props.filter((p: any) => ["house","apartment","storage"].includes(p.type)));
        }
      } catch {}
      try {
        const { data } = await supabase.from("room_type_listings").select("*").eq("company_id", currentCompany.id).order("sort_order").order("created_at");
        if (data) setListings(data.map((r: any) => ({ id: r.id, companyId: r.company_id, propertyId: r.property_id, propertyName: r.property_name || "", typeKey: r.type_key, displayName: r.display_name, adultsCapacity: r.adults_capacity, kidsCapacity: r.kids_capacity, totalRoomsOfType: r.total_rooms_of_type, priceRoomOnly: r.price_room_only, priceBedBreakfast: r.price_bed_breakfast, priceFullBoard: r.price_full_board, photos: r.photos || [], description: r.description || "", amenities: r.amenities || [], isActive: r.is_active, sortOrder: r.sort_order, createdAt: r.created_at })));
        else setListings([]);
      } catch { setListings([]); }
      setLoading(false);
    }
    void load();
  }, [currentCompany.id]);

  useEffect(() => {
    if (!form.property_id) { setPropertyRoomTypes([]); return; }
    async function fetchRoomTypes() {
      try {
        const { data } = await supabase.from("commercial_rooms").select("room_type").eq("property_id", form.property_id).eq("company_id", currentCompany.id);
        if (data && data.length > 0) {
          setPropertyRoomTypes([...new Set(data.map((r: any) => r.room_type as string).filter(Boolean))]);
        } else {
          setPropertyRoomTypes(ROOM_TYPE_OPTIONS.map(o => o.key));
        }
      } catch { setPropertyRoomTypes(ROOM_TYPE_OPTIONS.map(o => o.key)); }
    }
    void fetchRoomTypes();
  }, [form.property_id, currentCompany.id]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.property_id) e.property_id = "Please select a property.";
    if (!form.type_key) e.type_key = "Please select a room type.";
    if (!form.display_name.trim()) e.display_name = "Room name is required.";
    if ((Number(form.price_room_only)||0) <= 0 && (Number(form.price_bed_breakfast)||0) <= 0 && (Number(form.price_full_board)||0) <= 0) e.price = "At least one price must be greater than 0.";
    if (formPhotos.length < 2) e.photos = "Please upload at least 2 photos.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const openAdd = () => { setEditingId(null); setForm({ ...emptyForm }); setFormPhotos([]); setErrors({}); setPropertyRoomTypes([]); setModalOpen(true); };
  const openEdit = (r: RoomTypeListing) => { setEditingId(r.id); setForm({ property_id: r.propertyId, type_key: r.typeKey, display_name: r.displayName, adults_capacity: r.adultsCapacity, kids_capacity: r.kidsCapacity, total_rooms_of_type: r.totalRoomsOfType, price_room_only: r.priceRoomOnly || "", price_bed_breakfast: r.priceBedBreakfast || "", price_full_board: r.priceFullBoard || "", description: r.description, amenities: r.amenities, sort_order: r.sortOrder, is_active: r.isActive }); setFormPhotos(r.photos); setErrors({}); setModalOpen(true); };

  const toggleBookingVisibility = async (r: RoomTypeListing) => {
    const next = !r.isActive;
    await supabase.from("room_type_listings").update({ is_active: next }).eq("id", r.id);
    setListings(prev => prev.map(x => x.id === r.id ? { ...x, isActive: next } : x));
  };

  const toggleRentalVisibility = async (p: any) => {
    const next = !p.is_published;
    await supabase.from("properties").update({ is_published: next }).eq("id", p.id);
    setRentalProperties(prev => prev.map(x => x.id === p.id ? { ...x, is_published: next } : x));
    setProperties(prev => prev.map(x => x.id === p.id ? { ...x, isPublished: next } : x));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingPhoto(true);
    for (const file of files) {
      try { const url = await uploadFileToBucket("room-type-photos", currentCompany.id, file); setFormPhotos(prev => [...prev, url]); setErrors(prev => ({ ...prev, photos: "" })); }
      catch (err) { alert(err instanceof Error ? err.message : "Upload failed"); }
    }
    setUploadingPhoto(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const prop = properties.find(p => p.id === form.property_id);
      const payload: any = { company_id: currentCompany.id, property_id: form.property_id, property_name: prop?.name || "", type_key: form.type_key, display_name: form.display_name.trim(), adults_capacity: form.adults_capacity, kids_capacity: form.kids_capacity, total_rooms_of_type: form.total_rooms_of_type, price_room_only: Number(form.price_room_only)||0, price_bed_breakfast: Number(form.price_bed_breakfast)||0, price_full_board: Number(form.price_full_board)||0, description: form.description, amenities: form.amenities, photos: formPhotos, sort_order: form.sort_order, is_active: form.is_active };
      if (editingId) {
        const { error } = await supabase.from("room_type_listings").update(payload).eq("id", editingId);
        if (error) throw error;
        setListings(prev => prev.map(r => r.id === editingId ? { ...r, ...payload, id: editingId, companyId: currentCompany.id, propertyId: form.property_id, propertyName: prop?.name || "", typeKey: form.type_key, displayName: form.display_name, adultsCapacity: form.adults_capacity, kidsCapacity: form.kids_capacity, totalRoomsOfType: form.total_rooms_of_type, priceRoomOnly: payload.price_room_only, priceBedBreakfast: payload.price_bed_breakfast, priceFullBoard: payload.price_full_board, isActive: form.is_active, sortOrder: form.sort_order, photos: formPhotos } : r));
      } else {
        const { data, error } = await supabase.from("room_type_listings").insert(payload).select().single();
        if (error) throw error;
        if (data) setListings(prev => [...prev, { id: data.id, companyId: currentCompany.id, propertyId: form.property_id, propertyName: prop?.name || "", typeKey: form.type_key, displayName: form.display_name, adultsCapacity: form.adults_capacity, kidsCapacity: form.kids_capacity, totalRoomsOfType: form.total_rooms_of_type, priceRoomOnly: payload.price_room_only, priceBedBreakfast: payload.price_bed_breakfast, priceFullBoard: payload.price_full_board, description: form.description, amenities: form.amenities, photos: formPhotos, isActive: form.is_active, sortOrder: form.sort_order }]);
      }
      setModalOpen(false);
    } catch (e: any) { alert(e.message || "Save failed"); }
    setSaving(false);
  };

  const handleDeleteBooking = async (r: RoomTypeListing) => {
    if (!confirm(`Delete "${r.displayName}"?`)) return;
    await supabase.from("room_type_listings").delete().eq("id", r.id);
    setListings(prev => prev.filter(x => x.id !== r.id));
  };

  const hospProps = properties.filter(p => ["hotel","motel","lodge","guest_house","commercial"].includes(p.type));
  const availableTypeOptions = propertyRoomTypes.length > 0 ? ROOM_TYPE_OPTIONS.filter(o => propertyRoomTypes.includes(o.key)) : ROOM_TYPE_OPTIONS;
  const inputCls = (field: string) => `w-full rounded-xl border px-3 py-2 text-foreground outline-none focus:border-purple-600 bg-surface-elevated text-sm ${errors[field] ? "border-red-500" : "border-border-color"}`;

  const filteredListings = listings.filter(r => !searchQuery || r.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || (r.propertyName||"").toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredRentals = rentalProperties.filter((p: any) => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.city||"").toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <ModulePage title="Showcase" description="Manage what shows on the public portal — rooms for booking and properties for rent.">
      {loading && <LoadingState label="Loading showcase..."/>}
      {!loading && (
        <div className="space-y-6">
          {/* Tab switcher */}
          <div className="flex items-center gap-1 rounded-2xl bg-surface border border-border-color p-1.5 w-fit shadow-sm">
            <button type="button" onClick={() => setTab("bookings")} className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition ${tab === "bookings" ? "bg-purple-600 text-white shadow-md" : "text-muted hover:text-foreground"}`}>
              <BedDouble size={16}/> Room Bookings
            </button>
            <button type="button" onClick={() => setTab("forrent")} className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold transition ${tab === "forrent" ? "bg-blue-600 text-white shadow-md" : "text-muted hover:text-foreground"}`}>
              <Home size={16}/> For Rent
            </button>
          </div>

          {/* Search */}
          <div className="flex items-center gap-3">
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={tab === "bookings" ? "Search room types..." : "Search rental properties..."} className="rounded-xl border border-border-color bg-surface px-3 py-2 text-sm outline-none focus:border-purple-600 w-full max-w-sm"/>
            {tab === "bookings" && (
              <button type="button" onClick={openAdd} className="ml-auto flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-purple-700 transition">
                <Plus size={16}/> Add Room Type
              </button>
            )}
          </div>

          {/* ── BOOKINGS TAB ── */}
          {tab === "bookings" && (
            <section>
              {filteredListings.length === 0 && <EmptyState title="No room types yet" description="Add hospitality room types to showcase on the booking portal."/>}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredListings.map(r => (
                  <div key={r.id} className={`rounded-2xl border bg-surface-elevated overflow-hidden shadow-sm ${r.isActive ? "border-border-color" : "border-dashed border-border-color/50 opacity-70"}`}>
                    <div className="relative">
                      <PhotoCarousel photos={r.photos}/>
                      <span className={`absolute top-2 left-2 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${r.isActive ? "bg-green-500 text-white" : "bg-gray-500 text-white"}`}>{r.isActive ? "Visible" : "Hidden"}</span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-bold text-foreground">{r.displayName}</h4>
                        <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 border border-border-color text-[10px] capitalize">{r.typeKey}</span>
                      </div>
                      <p className="text-xs text-muted mb-2 flex items-center gap-1"><Building2 size={10}/>{r.propertyName}</p>
                      <div className="flex items-center gap-3 text-xs text-muted mb-3">
                        <span className="flex items-center gap-1"><Users size={11}/>{r.adultsCapacity} Adults</span>
                        {r.kidsCapacity > 0 && <span className="flex items-center gap-1"><Baby size={11}/>{r.kidsCapacity} Kids</span>}
                        <span>{r.totalRoomsOfType} rooms</span>
                      </div>
                      <div className="space-y-1 text-xs mb-3">
                        {r.priceRoomOnly > 0 && <div className="flex justify-between"><span className="text-muted">Room Only</span><span className="font-bold text-purple-600">{formatCurrency(r.priceRoomOnly)}/night</span></div>}
                        {r.priceBedBreakfast > 0 && <div className="flex justify-between"><span className="text-muted">B&B</span><span className="font-semibold">{formatCurrency(r.priceBedBreakfast)}/night</span></div>}
                        {r.priceFullBoard > 0 && <div className="flex justify-between"><span className="text-muted">Full Board</span><span className="font-semibold">{formatCurrency(r.priceFullBoard)}/night</span></div>}
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => toggleBookingVisibility(r)} className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-semibold transition ${r.isActive ? "border-orange-300 text-orange-600 hover:bg-orange-50" : "border-green-300 text-green-600 hover:bg-green-50"}`}>
                          {r.isActive ? <><EyeOff size={12}/> Hide</> : <><Eye size={12}/> Show</>}
                        </button>
                        <button type="button" onClick={() => openEdit(r)} className="flex items-center justify-center gap-1.5 rounded-lg border border-border-color px-2 py-1.5 text-xs font-semibold text-muted hover:text-foreground transition"><Pencil size={12}/></button>
                        <button type="button" onClick={() => handleDeleteBooking(r)} className="flex items-center justify-center gap-1.5 rounded-lg border border-red-200 px-2 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-50 transition"><Trash2 size={12}/></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── FOR RENT TAB ── */}
          {tab === "forrent" && (
            <section>
              {filteredRentals.length === 0 && <EmptyState title="No rental properties" description="Add houses or apartments in Properties first. Then toggle them visible here."/>}
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredRentals.map((p: any) => (
                  <div key={p.id} className={`rounded-2xl border bg-surface-elevated overflow-hidden shadow-sm ${p.is_published ? "border-border-color" : "border-dashed border-border-color/50 opacity-70"}`}>
                    <div className="relative">
                      {(p.photos || []).filter(Boolean).length > 0
                        ? <img src={(p.photos || []).filter(Boolean)[0]} alt={p.name} className="aspect-video w-full object-cover"/>
                        : <div className="aspect-video bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center"><Home size={40} className="text-blue-300"/></div>
                      }
                      <span className={`absolute top-2 left-2 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${p.is_published ? "bg-green-500 text-white" : "bg-gray-500 text-white"}`}>{p.is_published ? "Visible" : "Hidden"}</span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4 className="font-bold text-foreground">{p.name}</h4>
                        <span className="shrink-0 rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-[10px] font-bold uppercase">{(p.type||"").replace(/_/g," ")}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted mb-2"><MapPin size={10}/>{[p.city,p.country].filter(Boolean).join(", ")||p.address}</div>
                      <div className="flex items-center justify-between mb-3">
                        <div><span className="text-lg font-bold text-blue-700">{formatCurrency(p.monthly_rent||0)}</span><span className="text-xs text-muted">/month</span></div>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.status==="vacant"?"bg-green-100 text-green-700":"bg-orange-100 text-orange-700"}`}>{p.status==="vacant"?"Available":"Occupied"}</span>
                      </div>
                      {p.is_published ? (
                        <button type="button" onClick={() => toggleRentalVisibility(p)} className="w-full flex items-center justify-center gap-2 rounded-xl border border-orange-300 px-3 py-2 text-sm font-bold text-orange-600 hover:bg-orange-50 transition">
                          <EyeOff size={14}/> Unpublish
                        </button>
                      ) : p.status === "vacant" ? (
                        <button type="button" onClick={() => toggleRentalVisibility(p)} className="w-full flex items-center justify-center gap-2 rounded-xl border border-green-400 bg-green-50 px-3 py-2 text-sm font-bold text-green-700 hover:bg-green-100 transition">
                          <Eye size={14}/> Publish
                        </button>
                      ) : (
                        <div className="w-full flex items-center justify-center gap-2 rounded-xl border border-border-color px-3 py-2 text-sm text-muted cursor-not-allowed opacity-60">
                          <EyeOff size={14}/> Occupied — cannot publish
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── Modal: Add/Edit Booking Room ── */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit Room Type" : "Add Room Type"}>
        <div className="space-y-4 text-xs">
          <div>
            <label className="mb-1 block font-semibold text-foreground">Property <span className="text-red-500">*</span></label>
            <select value={form.property_id} onChange={e => { setForm(f=>({...f,property_id:e.target.value,type_key:"",display_name:""})); setErrors(v=>({...v,property_id:""})); }} className={inputCls("property_id")}>
              <option value="">— Select a hospitality property —</option>
              {hospProps.map(p => <option key={p.id} value={p.id}>{p.name} ({p.type.replace(/_/g," ")})</option>)}
            </select>
            {errors.property_id && <p className="mt-1 flex items-center gap-1 text-red-500 text-[11px]"><AlertCircle size={11}/>{errors.property_id}</p>}
          </div>
          <div>
            <label className="mb-1 block font-semibold text-foreground">Room Type <span className="text-red-500">*</span></label>
            <select value={form.type_key} onChange={e => { const opt = ROOM_TYPE_OPTIONS.find(o=>o.key===e.target.value); setForm(f=>({...f,type_key:e.target.value,display_name:opt?opt.label:f.display_name,adults_capacity:opt?opt.adults:f.adults_capacity,kids_capacity:opt?opt.kids:f.kids_capacity})); setErrors(v=>({...v,type_key:""})); }} disabled={!form.property_id} className={`${inputCls("type_key")} ${!form.property_id?"opacity-50 cursor-not-allowed":""}`}>
              <option value="">{form.property_id?"— Select room type —":"— Select a property first —"}</option>
              {availableTypeOptions.map(o => <option key={o.key} value={o.key}>{o.label} · {o.adults} Adults, {o.kids} Kids</option>)}
            </select>
            {errors.type_key && <p className="mt-1 flex items-center gap-1 text-red-500 text-[11px]"><AlertCircle size={11}/>{errors.type_key}</p>}
          </div>
          <div>
            <label className="mb-1 block font-semibold text-foreground">Display Name <span className="text-red-500">*</span></label>
            <input value={form.display_name} onChange={e=>{setForm({...form,display_name:e.target.value});setErrors(v=>({...v,display_name:""}));}} placeholder="e.g. Family Safari Suite" className={inputCls("display_name")}/>
            {errors.display_name && <p className="mt-1 flex items-center gap-1 text-red-500 text-[11px]"><AlertCircle size={11}/>{errors.display_name}</p>}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="mb-1 block font-semibold text-foreground">Adults</label><input type="text" inputMode="numeric" value={form.adults_capacity} onChange={e=>setForm({...form,adults_capacity:Number(e.target.value.replace(/\D/g,""))||0})} className={inputCls("")}/></div>
            <div><label className="mb-1 block font-semibold text-foreground">Kids</label><input type="text" inputMode="numeric" value={form.kids_capacity} onChange={e=>setForm({...form,kids_capacity:Number(e.target.value.replace(/\D/g,""))||0})} className={inputCls("")}/></div>
            <div><label className="mb-1 block font-semibold text-foreground">Total Rooms</label><input type="text" inputMode="numeric" value={form.total_rooms_of_type} onChange={e=>setForm({...form,total_rooms_of_type:Number(e.target.value.replace(/\D/g,""))||1})} className={inputCls("")}/></div>
          </div>
          <div className={`rounded-xl border p-3 space-y-2 ${errors.price?"border-red-400 bg-red-50/10":"border-border-color"}`}>
            <label className="font-bold text-foreground flex items-center gap-1.5"><Star size={12} className="text-yellow-500"/>Pricing per night <span className="text-red-500 text-[10px] font-normal ml-1">(at least one required)</span></label>
            <div className="grid grid-cols-3 gap-2">
              <div><label className="mb-1 block text-muted/70">Room Only</label><input type="text" inputMode="decimal" value={form.price_room_only} placeholder="e.g. 1200" onChange={e=>{setForm({...form,price_room_only:e.target.value});setErrors(v=>({...v,price:""}));}} className="w-full rounded-lg border border-border-color bg-surface px-2 py-1.5 text-foreground outline-none focus:border-purple-600 text-xs"/></div>
              <div><label className="mb-1 block text-muted/70">Bed & Breakfast</label><input type="text" inputMode="decimal" value={form.price_bed_breakfast} placeholder="e.g. 1600" onChange={e=>{setForm({...form,price_bed_breakfast:e.target.value});setErrors(v=>({...v,price:""}));}} className="w-full rounded-lg border border-border-color bg-surface px-2 py-1.5 text-foreground outline-none focus:border-purple-600 text-xs"/></div>
              <div><label className="mb-1 block text-muted/70">Full Board</label><input type="text" inputMode="decimal" value={form.price_full_board} placeholder="e.g. 2100" onChange={e=>{setForm({...form,price_full_board:e.target.value});setErrors(v=>({...v,price:""}));}} className="w-full rounded-lg border border-border-color bg-surface px-2 py-1.5 text-foreground outline-none focus:border-purple-600 text-xs"/></div>
            </div>
            {errors.price && <p className="flex items-center gap-1 text-red-500 text-[11px]"><AlertCircle size={11}/>{errors.price}</p>}
          </div>
          <div><label className="mb-1 block font-semibold text-foreground">Description</label><textarea rows={2} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Describe this room type..." className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-purple-600 resize-none text-xs"/></div>
          <div>
            <label className="mb-2 block font-semibold text-foreground">Amenities</label>
            <div className="flex flex-wrap gap-2">
              {AMENITY_OPTIONS.map(opt => { const Icon = opt.icon; const active = form.amenities.includes(opt.key); return (<button key={opt.key} type="button" onClick={()=>setForm(f=>({...f,amenities:f.amenities.includes(opt.key)?f.amenities.filter(a=>a!==opt.key):[...f.amenities,opt.key]}))} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${active?"border-purple-600 bg-purple-50 text-purple-700":"border-border-color text-muted hover:border-purple-400"}`}><Icon size={11}/>{opt.label}</button>); })}
            </div>
          </div>
          <div className={`rounded-xl border p-3 space-y-2 ${errors.photos?"border-red-400 bg-red-50/10":"border-border-color"}`}>
            <div className="flex items-center justify-between">
              <label className="font-bold text-foreground flex items-center gap-1.5"><ImageIcon size={13} className="text-purple-600"/>Photos ({formPhotos.length}/min 2) <span className="text-red-500 ml-1">*</span></label>
              <div><input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" multiple className="hidden" id="room-photo-upload"/><label htmlFor="room-photo-upload" className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border-color bg-surface px-3 py-1.5 text-[11px] font-semibold hover:bg-surface-elevated ${uploadingPhoto?"opacity-50 pointer-events-none":""}`}>{uploadingPhoto?<Loader2 size={11} className="animate-spin"/>:<Upload size={11}/>}{uploadingPhoto?"Uploading...":"Upload Photos"}</label></div>
            </div>
            {errors.photos && <p className="flex items-center gap-1 text-red-500 text-[11px]"><AlertCircle size={11}/>{errors.photos}</p>}
            {formPhotos.length === 0
              ? <p className="text-[11px] text-muted italic">Upload at least 2 high-quality room photos.</p>
              : <div className="grid grid-cols-4 gap-2">{formPhotos.map((url,idx)=>(<div key={idx} className="group relative aspect-video rounded-lg overflow-hidden border border-border-color"><img src={url} alt={`room-${idx}`} className="h-full w-full object-cover"/><button type="button" onClick={()=>setFormPhotos(prev=>prev.filter((_,i)=>i!==idx))} className="absolute top-1 right-1 rounded-md bg-black/70 p-1 text-white opacity-0 group-hover:opacity-100 transition hover:bg-red-600"><X size={10}/></button></div>))}</div>}
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <div onClick={()=>setForm(f=>({...f,is_active:!f.is_active}))} className={`relative h-5 w-9 rounded-full transition-colors ${form.is_active?"bg-purple-600":"bg-gray-300"}`}><div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.is_active?"translate-x-4":"translate-x-0.5"}`}/></div>
            <span className="font-medium text-foreground text-xs">{form.is_active?"Visible on portal":"Hidden from portal"}</span>
          </label>
          <div className="flex justify-end gap-2 pt-2 border-t border-border-color">
            <button type="button" onClick={()=>setModalOpen(false)} className="rounded-xl border border-border-color px-4 py-2 text-sm text-muted hover:bg-surface-elevated">Cancel</button>
            <button type="button" onClick={onSave} disabled={saving} className="rounded-xl bg-purple-600 px-5 py-2 text-sm font-bold text-white shadow-md hover:bg-purple-700 disabled:opacity-50">{saving?"Saving...":editingId?"Save Changes":"Create Room Type"}</button>
          </div>
        </div>
      </Modal>
    </ModulePage>
  );
}
