import { useState, useEffect, useRef } from "react";
import { ModulePage } from "@/components/module-page";
import { EmptyState, LoadingState } from "@/components/data-state";
import { Modal } from "@/components/modal";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { uploadFileToBucket } from "@/lib/storage";
import { useCurrency } from "@/lib/currency";
import type { RoomTypeListing, PropertyRow } from "@/lib/types";
import { DataTableHeader, StatusBadge, TableRowActions, TableActionButton } from "@/components/data-table";
import {
  Plus, Pencil, Trash2, BedDouble, Users, Baby, Image as ImageIcon, Upload,
  Loader2, X, ChevronLeft, ChevronRight, Building2, Layers, Star, Wifi,
  Tv, Wind, Coffee, Bath, Dumbbell, ParkingCircle, Utensils, Globe
} from "lucide-react";

const ROOM_TYPE_OPTIONS = [
  { key: "standard",   label: "Standard",          adults: 2, kids: 0 },
  { key: "twin",       label: "Twin",               adults: 2, kids: 0 },
  { key: "single",     label: "Single",             adults: 1, kids: 0 },
  { key: "double",     label: "Double",             adults: 2, kids: 0 },
  { key: "deluxe",     label: "Deluxe",             adults: 2, kids: 1 },
  { key: "executive",  label: "Executive",          adults: 2, kids: 0 },
  { key: "family",     label: "Family",             adults: 4, kids: 2 },
  { key: "suite",      label: "Suite",              adults: 2, kids: 2 },
  { key: "penthouse",  label: "Penthouse Suite",    adults: 4, kids: 2 },
  { key: "honeymoon",  label: "Honeymoon Suite",    adults: 2, kids: 0 },
  { key: "accessible", label: "Accessible Room",    adults: 2, kids: 0 },
];

const AMENITY_OPTIONS = [
  { key: "wifi",      label: "Free Wi-Fi",      icon: Wifi },
  { key: "tv",        label: "Smart TV",         icon: Tv },
  { key: "ac",        label: "Air Con",          icon: Wind },
  { key: "coffee",    label: "Coffee Maker",     icon: Coffee },
  { key: "bath",      label: "Bathtub",          icon: Bath },
  { key: "gym",       label: "Gym Access",       icon: Dumbbell },
  { key: "parking",   label: "Parking",          icon: ParkingCircle },
  { key: "breakfast", label: "Breakfast",        icon: Utensils },
  { key: "balcony",   label: "Balcony",          icon: Globe },
];

const emptyForm = {
  property_id: "",
  type_key: "standard",
  display_name: "Standard Room",
  adults_capacity: 2,
  kids_capacity: 0,
  total_rooms_of_type: 1,
  price_room_only: 0,
  price_bed_breakfast: 0,
  price_full_board: 0,
  description: "",
  amenities: [] as string[],
  sort_order: 0,
  is_active: true,
};

function PhotoCarousel({ photos }: { photos: string[] }) {
  const [idx, setIdx] = useState(0);
  const safe = photos.filter(Boolean);
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

export default function RoomShowcasesPage() {
  const { currentCompany } = useAuth();
  const { format: formatCurrency } = useCurrency();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [listings, setListings] = useState<RoomTypeListing[]>([]);
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProperty, setFilterProperty] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [formPhotos, setFormPhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RoomTypeListing | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data: props } = await supabase.from("properties").select("*").eq("company_id", currentCompany.id).in("type", ["hotel","motel","lodge","guest_house","commercial"]).order("name");
        if (props) setProperties(props.map((p: any) => ({ id: p.id, companyId: p.company_id || currentCompany.id, name: p.name, type: p.type, address: p.address || "", status: p.status || "occupied", monthlyRent: p.monthly_rent || 0, totalRooms: p.total_rooms || 0, defaultRoomPrice: p.default_room_price || 0, defaultBedBreakfast: p.default_bed_breakfast || 0, defaultBedLunch: p.default_bed_lunch || 0, defaultFullBoard: p.default_full_board || 0, photos: p.photos || [], rooms: [], floors: p.floors || [], city: p.city || "", country: p.country || "", isPublished: p.is_published || false })));
      } catch {}
      try {
        const { data } = await supabase.from("room_type_listings").select("*").eq("company_id", currentCompany.id).order("sort_order").order("created_at");
        if (data) {
          setListings(data.map((r: any) => ({
            id: r.id, companyId: r.company_id, propertyId: r.property_id, propertyName: r.property_name || "",
            typeKey: r.type_key, displayName: r.display_name, adultsCapacity: r.adults_capacity, kidsCapacity: r.kids_capacity,
            totalRoomsOfType: r.total_rooms_of_type, priceRoomOnly: r.price_room_only, priceBedBreakfast: r.price_bed_breakfast,
            priceFullBoard: r.price_full_board, photos: r.photos || [], description: r.description || "",
            amenities: r.amenities || [], isActive: r.is_active, sortOrder: r.sort_order, createdAt: r.created_at,
          })));
        } else {
          setListings([]);
        }
      } catch { setListings([]); }
      setLoading(false);
    }
    void load();
  }, [currentCompany.id]);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setFormPhotos([]);
    setModalOpen(true);
  };

  const openEdit = (r: RoomTypeListing) => {
    setEditingId(r.id);
    setForm({ property_id: r.propertyId, type_key: r.typeKey, display_name: r.displayName, adults_capacity: r.adultsCapacity, kids_capacity: r.kidsCapacity, total_rooms_of_type: r.totalRoomsOfType, price_room_only: r.priceRoomOnly, price_bed_breakfast: r.priceBedBreakfast, price_full_board: r.priceFullBoard, description: r.description, amenities: r.amenities, sort_order: r.sortOrder, is_active: r.isActive });
    setFormPhotos(r.photos);
    setModalOpen(true);
  };

  const handleTypeKeyChange = (key: string) => {
    const opt = ROOM_TYPE_OPTIONS.find(o => o.key === key);
    setForm(f => ({ ...f, type_key: key, display_name: opt ? opt.label + " Room" : f.display_name, adults_capacity: opt ? opt.adults : f.adults_capacity, kids_capacity: opt ? opt.kids : f.kids_capacity }));
  };

  const toggleAmenity = (key: string) => {
    setForm(f => ({ ...f, amenities: f.amenities.includes(key) ? f.amenities.filter(a => a !== key) : [...f.amenities, key] }));
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingPhoto(true);
    for (const file of files) {
      try {
        const url = await uploadFileToBucket("room-type-photos", currentCompany.id, file);
        setFormPhotos(prev => [...prev, url]);
      } catch (err) { alert(err instanceof Error ? err.message : "Upload failed"); }
    }
    setUploadingPhoto(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSave = async () => {
    if (!form.property_id) { alert("Please select a property."); return; }
    if (!form.display_name.trim()) { alert("Please enter a room name."); return; }
    setSaving(true);
    try {
      const prop = properties.find(p => p.id === form.property_id);
      const payload: any = {
        company_id: currentCompany.id, property_id: form.property_id, property_name: prop?.name || "",
        type_key: form.type_key, display_name: form.display_name.trim(), adults_capacity: form.adults_capacity,
        kids_capacity: form.kids_capacity, total_rooms_of_type: form.total_rooms_of_type,
        price_room_only: form.price_room_only, price_bed_breakfast: form.price_bed_breakfast,
        price_full_board: form.price_full_board, description: form.description, amenities: form.amenities,
        photos: formPhotos, sort_order: form.sort_order, is_active: form.is_active,
      };
      if (editingId) {
        const { error } = await supabase.from("room_type_listings").update(payload).eq("id", editingId);
        if (error) throw error;
        setListings(prev => prev.map(r => r.id === editingId ? { ...r, ...payload, id: editingId } : r));
      } else {
        const { data, error } = await supabase.from("room_type_listings").insert(payload).select().single();
        if (error) throw error;
        if (data) setListings(prev => [...prev, { ...payload, id: data.id, companyId: currentCompany.id, propertyId: form.property_id, propertyName: prop?.name || "", typeKey: form.type_key, displayName: form.display_name, adultsCapacity: form.adults_capacity, kidsCapacity: form.kids_capacity, totalRoomsOfType: form.total_rooms_of_type, priceRoomOnly: form.price_room_only, priceBedBreakfast: form.price_bed_breakfast, priceFullBoard: form.price_full_board, description: form.description, amenities: form.amenities, photos: formPhotos, isActive: form.is_active, sortOrder: form.sort_order }]);
      }
      setModalOpen(false);
    } catch (e: any) { alert(e.message || "Save failed"); }
    setSaving(false);
  };

  const handleDelete = async (r: RoomTypeListing) => {
    if (!confirm(`Delete "${r.displayName}"? This cannot be undone.`)) return;
    await supabase.from("room_type_listings").delete().eq("id", r.id);
    setListings(prev => prev.filter(x => x.id !== r.id));
  };

  const hospProps = properties.filter(p => ["hotel","motel","lodge","guest_house","commercial"].includes(p.type));

  const filtered = listings.filter(r => {
    if (filterProperty !== "all" && r.propertyId !== filterProperty) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return r.displayName.toLowerCase().includes(q) || (r.propertyName||"").toLowerCase().includes(q) || r.typeKey.includes(q);
    }
    return true;
  });

  // Group by property for display
  const byProperty: Record<string, { prop: PropertyRow | undefined; rooms: RoomTypeListing[] }> = {};
  for (const r of filtered) {
    if (!byProperty[r.propertyId]) byProperty[r.propertyId] = { prop: properties.find(p => p.id === r.propertyId), rooms: [] };
    byProperty[r.propertyId].rooms.push(r);
  }

  const filterTabs = [
    { key: "all", label: "All Properties", count: listings.length },
    ...hospProps.map(p => ({ key: p.id, label: p.name, count: listings.filter(r => r.propertyId === p.id).length })),
  ];

  return (
    <ModulePage title="Room Type Showcases" description="Create and manage room type listings shown on the agent portal and public website.">
      {loading && <LoadingState label="Loading room showcases..."/>}
      {!loading && (
        <section className="rounded-2xl border border-border-color bg-surface p-1 shadow-sm">
          <div className="p-4">
            <DataTableHeader searchValue={searchQuery} onSearchChange={setSearchQuery} searchPlaceholder="Search rooms or properties..."
              filters={filterTabs} activeFilter={filterProperty} onFilterChange={setFilterProperty}
              actions={<button type="button" onClick={openAdd} className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-purple-700 transition"><Plus size={16}/><span>Add Room Type</span></button>}
            />
          </div>

          {hospProps.length === 0 && (
            <div className="p-12 text-center">
              <Building2 size={48} className="mx-auto mb-4 text-muted/30"/>
              <h3 className="font-bold text-foreground mb-2">No hospitality properties found</h3>
              <p className="text-sm text-muted">Add a hotel, lodge, motel, or guest house in Properties first.</p>
            </div>
          )}

          {hospProps.length > 0 && filtered.length === 0 && (
            <EmptyState title="No room types yet" description="Add room types to showcase on the agent portal and public listings."/>
          )}

          {Object.entries(byProperty).map(([propId, { prop, rooms }]) => (
            <div key={propId} className="mb-6 px-4">
              <div className="flex items-center gap-3 mb-4 pb-2 border-b border-border-color/50">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-600/10 text-purple-600"><Building2 size={16}/></div>
                <div>
                  <h3 className="font-bold text-foreground">{prop?.name || "Unknown Property"}</h3>
                  <p className="text-xs text-muted">{[prop?.city, prop?.country].filter(Boolean).join(", ")} · {rooms.length} room type{rooms.length !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rooms.map(r => (
                  <div key={r.id} className={`rounded-2xl border bg-surface-elevated overflow-hidden shadow-sm ${r.isActive ? "border-border-color" : "border-dashed border-border-color/50 opacity-60"}`}>
                    <PhotoCarousel photos={r.photos}/>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h4 className="font-bold text-foreground">{r.displayName}</h4>
                          <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                            <span className="flex items-center gap-1"><Users size={11}/>{r.adultsCapacity} Adults</span>
                            {r.kidsCapacity > 0 && <span className="flex items-center gap-1"><Baby size={11}/>{r.kidsCapacity} Kids</span>}
                            <span className="rounded-full bg-surface px-2 py-0.5 border border-border-color capitalize">{r.typeKey}</span>
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${r.isActive ? "bg-green-500/10 text-green-600" : "bg-gray-500/10 text-gray-500"}`}>{r.isActive ? "Active" : "Hidden"}</span>
                      </div>
                      <div className="space-y-1 text-xs mb-3">
                        {r.priceRoomOnly > 0 && <div className="flex justify-between"><span className="text-muted">Room Only</span><span className="font-bold text-purple-600">{formatCurrency(r.priceRoomOnly)}/night</span></div>}
                        {r.priceBedBreakfast > 0 && <div className="flex justify-between"><span className="text-muted">Bed & Breakfast</span><span className="font-semibold">{formatCurrency(r.priceBedBreakfast)}/night</span></div>}
                        {r.priceFullBoard > 0 && <div className="flex justify-between"><span className="text-muted">Full Board</span><span className="font-semibold">{formatCurrency(r.priceFullBoard)}/night</span></div>}
                        <div className="flex justify-between pt-1 border-t border-border-color/30"><span className="text-muted">Available Rooms</span><span className="font-bold">{r.totalRoomsOfType} rooms</span></div>
                      </div>
                      {r.amenities.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {r.amenities.slice(0,4).map(a => { const opt = AMENITY_OPTIONS.find(o => o.key === a); const Icon = opt?.icon; return <span key={a} className="inline-flex items-center gap-1 rounded-lg bg-surface border border-border-color px-1.5 py-0.5 text-[10px] text-muted">{Icon && <Icon size={9}/>}{opt?.label||a}</span>; })}
                          {r.amenities.length > 4 && <span className="text-[10px] text-muted">+{r.amenities.length-4} more</span>}
                        </div>
                      )}
                      <TableRowActions>
                        <TableActionButton icon={Pencil} label="Edit" onClick={() => openEdit(r)}/>
                        <TableActionButton icon={Trash2} label="Delete" variant="danger" onClick={() => handleDelete(r)}/>
                      </TableRowActions>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      )}

      {/* Add / Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit Room Type" : "Add Room Type Showcase"}>
        <div className="space-y-4 text-xs">
          {/* Property */}
          <div>
            <label className="mb-1 block font-medium text-foreground">Property *</label>
            <select value={form.property_id} onChange={e => setForm({ ...form, property_id: e.target.value })} className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-purple-600">
              <option value="">— Select a hospitality property —</option>
              {hospProps.map(p => <option key={p.id} value={p.id}>{p.name} ({p.type.replace(/_/g," ")})</option>)}
            </select>
          </div>

          {/* Room Type */}
          <div>
            <label className="mb-1 block font-medium text-foreground">Room Type *</label>
            <select value={form.type_key} onChange={e => handleTypeKeyChange(e.target.value)} className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-purple-600">
              {ROOM_TYPE_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label} · {o.adults} Adults, {o.kids} Kids</option>)}
            </select>
          </div>

          {/* Display Name */}
          <div>
            <label className="mb-1 block font-medium text-foreground">Display Name *</label>
            <input value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} placeholder="e.g. Family Safari Suite" className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-purple-600"/>
          </div>

          {/* Capacity */}
          <div className="grid grid-cols-3 gap-3">
            <div><label className="mb-1 block font-medium text-foreground flex items-center gap-1"><Users size={11}/>Adults</label><input type="number" min={1} value={form.adults_capacity} onChange={e => setForm({ ...form, adults_capacity: Number(e.target.value) })} className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-purple-600"/></div>
            <div><label className="mb-1 block font-medium text-foreground flex items-center gap-1"><Baby size={11}/>Kids</label><input type="number" min={0} value={form.kids_capacity} onChange={e => setForm({ ...form, kids_capacity: Number(e.target.value) })} className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-purple-600"/></div>
            <div><label className="mb-1 block font-medium text-foreground flex items-center gap-1"><Layers size={11}/>Total Rooms</label><input type="number" min={1} value={form.total_rooms_of_type} onChange={e => setForm({ ...form, total_rooms_of_type: Number(e.target.value) })} className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-purple-600"/></div>
          </div>

          {/* Pricing */}
          <div className="rounded-xl border border-border-color p-3 space-y-2.5">
            <label className="font-bold text-foreground flex items-center gap-1.5"><Star size={13} className="text-yellow-500"/>Pricing (per night)</label>
            <div className="grid grid-cols-3 gap-2">
              <div><label className="mb-1 block text-muted/70">Room Only</label><input type="number" value={form.price_room_only} onChange={e => setForm({ ...form, price_room_only: Number(e.target.value) })} className="w-full rounded-lg border border-border-color bg-surface px-2 py-1.5 text-foreground outline-none focus:border-purple-600"/></div>
              <div><label className="mb-1 block text-muted/70">Bed & Breakfast</label><input type="number" value={form.price_bed_breakfast} onChange={e => setForm({ ...form, price_bed_breakfast: Number(e.target.value) })} className="w-full rounded-lg border border-border-color bg-surface px-2 py-1.5 text-foreground outline-none focus:border-purple-600"/></div>
              <div><label className="mb-1 block text-muted/70">Full Board</label><input type="number" value={form.price_full_board} onChange={e => setForm({ ...form, price_full_board: Number(e.target.value) })} className="w-full rounded-lg border border-border-color bg-surface px-2 py-1.5 text-foreground outline-none focus:border-purple-600"/></div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block font-medium text-foreground">Description</label>
            <textarea rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Describe this room type..." className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-purple-600 resize-none"/>
          </div>

          {/* Amenities */}
          <div>
            <label className="mb-2 block font-medium text-foreground">Amenities</label>
            <div className="flex flex-wrap gap-2">
              {AMENITY_OPTIONS.map(opt => { const Icon = opt.icon; const active = form.amenities.includes(opt.key); return (
                <button key={opt.key} type="button" onClick={() => toggleAmenity(opt.key)} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition ${active ? "border-purple-600 bg-purple-50 text-purple-700" : "border-border-color text-muted hover:border-purple-400 hover:text-purple-600"}`}>
                  <Icon size={11}/>{opt.label}
                </button>
              ); })}
            </div>
          </div>

          {/* Photos */}
          <div className="rounded-xl border border-border-color p-3 space-y-2">
            <div className="flex items-center justify-between">
              <label className="font-bold text-foreground flex items-center gap-1.5"><ImageIcon size={13} className="text-purple-600"/>Room Photos ({formPhotos.length})</label>
              <div>
                <input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" multiple className="hidden" id="room-photo-upload"/>
                <label htmlFor="room-photo-upload" className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border-color bg-surface px-3 py-1.5 text-[11px] font-semibold text-foreground hover:bg-surface-elevated ${uploadingPhoto?"opacity-50 pointer-events-none":""}`}>{uploadingPhoto?<Loader2 size={11} className="animate-spin"/>:<Upload size={11}/>}{uploadingPhoto?"Uploading...":"Upload Photos"}</label>
              </div>
            </div>
            {formPhotos.length === 0 ? (<p className="text-[11px] text-muted italic">Upload high-quality photos of this room type.</p>) : (
              <div className="grid grid-cols-4 gap-2">
                {formPhotos.map((url, idx) => (<div key={idx} className="group relative aspect-video rounded-lg overflow-hidden border border-border-color bg-black/10">
                  <img src={url} alt={`room-${idx}`} className="h-full w-full object-cover"/>
                  <button type="button" onClick={() => setFormPhotos(prev => prev.filter((_,i) => i !== idx))} className="absolute top-1 right-1 rounded-md bg-black/70 p-1 text-white opacity-0 group-hover:opacity-100 transition hover:bg-red-600"><X size={10}/></button>
                </div>))}
              </div>
            )}
          </div>

          {/* Active toggle + Sort */}
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <div onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))} className={`relative h-5 w-9 rounded-full transition-colors ${form.is_active ? "bg-purple-600" : "bg-gray-300"}`}><div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.is_active ? "translate-x-4" : "translate-x-0.5"}`}/></div>
              <span className="font-medium text-foreground">{form.is_active ? "Visible on portal" : "Hidden from portal"}</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-border-color px-4 py-2 text-muted hover:bg-surface-elevated">Cancel</button>
            <button type="button" onClick={onSave} disabled={saving} className="rounded-xl bg-purple-600 px-5 py-2 font-bold text-white shadow-md hover:bg-purple-700 disabled:opacity-50">{saving ? "Saving..." : editingId ? "Save Changes" : "Create Room Type"}</button>
          </div>
        </div>
      </Modal>
    </ModulePage>
  );
}