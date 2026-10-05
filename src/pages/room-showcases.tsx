import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { ModulePage } from "@/components/module-page";
import { EmptyState, LoadingState } from "@/components/data-state";
import { Modal } from "@/components/modal";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { uploadFileToBucket } from "@/lib/storage";
import { useCurrency } from "@/lib/currency";
import { fetchCommercialRooms } from "@/lib/data";
import type { RoomTypeListing, PropertyRow, CommercialRoom } from "@/lib/types";
import { DataTableHeader, TableRowActions, TableActionButton } from "@/components/data-table";
import {
  Plus, Pencil, Trash2, BedDouble, Users, Baby, Image as ImageIcon, Upload,
  Loader2, X, ChevronLeft, ChevronRight, Building2, Layers, Star, Wifi,
  Tv, Wind, Coffee, Bath, Dumbbell, ParkingCircle, Utensils, Globe, AlertCircle,
  Eye, EyeOff, Home, MapPin, DollarSign, Calendar, Check, CheckSquare, Square,
  Search, Filter, Sparkles, ArrowRight
} from "lucide-react";

const DEFAULT_ROOM_FALLBACK_PHOTOS = [
  "https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80",
  "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80",
];

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
  booking_mode: "platform" as "platform" | "external",
  external_booking_url: "",
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
  const [modalTab, setModalTab] = useState<"existing" | "scratch">("existing");
  const [existingRooms, setExistingRooms] = useState<CommercialRoom[]>([]);
  const [loadingExistingRooms, setLoadingExistingRooms] = useState(false);
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set());
  const [existingSearch, setExistingSearch] = useState("");
  const [existingPropertyFilter, setExistingPropertyFilter] = useState<string>("all");
  const [existingShowcaseFilter, setExistingShowcaseFilter] = useState<"all" | "unshowcased" | "showcased">("all");
  const [importingRooms, setImportingRooms] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof emptyForm>({ ...emptyForm });
  const [formPhotos, setFormPhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rentalPromptOpen, setRentalPromptOpen] = useState(false);
  const [rentalPromptTarget, setRentalPromptTarget] = useState<any>(null);
  const [rentalVacancyDate, setRentalVacancyDate] = useState("");
  const [rentalPromptLoading, setRentalPromptLoading] = useState(false);
  const [rentalPromptError, setRentalPromptError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const { data: props } = await supabase.from("properties").select("*").eq("company_id", currentCompany.id).order("name");
        if (props) {
          const mapped = props.map((p: any) => ({ id: p.id, companyId: p.company_id || currentCompany.id, name: p.name, type: p.type, address: p.address || "", status: p.status || "occupied", monthlyRent: p.monthly_rent || 0, totalRooms: p.total_rooms || 0, defaultRoomPrice: p.default_room_price || 0, defaultBedBreakfast: p.default_bed_breakfast || 0, defaultBedLunch: p.default_bed_lunch || 0, defaultFullBoard: p.default_full_board || 0, photos: p.photos || [], rooms: [], floors: p.floors || [], city: p.city || "", country: p.country || "", isPublished: p.is_published || false, availableFrom: p.available_from || "" }));
          setProperties(mapped);
          setRentalProperties(props.filter((p: any) => ["house","apartment","storage"].includes(p.type)));
        }
      } catch {}
      try {
        const { data } = await supabase.from("room_type_listings").select("*").eq("company_id", currentCompany.id).order("sort_order").order("created_at");
        if (data) {
          setListings(data.map((r: any) => {
            let bookingMode: "platform" | "external" = r.booking_mode || "platform";
            let externalBookingUrl: string = r.external_booking_url || "";
            let cleanDescription: string = r.description || "";
            if (cleanDescription.includes("<!--ROOM_META:")) {
              try {
                const metaStr = cleanDescription.split("<!--ROOM_META:")[1].split("-->")[0];
                const meta = JSON.parse(metaStr);
                if (meta.bookingMode) bookingMode = meta.bookingMode;
                if (meta.externalBookingUrl) externalBookingUrl = meta.externalBookingUrl;
                cleanDescription = cleanDescription.split("<!--ROOM_META:")[0].trim();
              } catch {}
            }
            return {
              id: r.id,
              companyId: r.company_id,
              propertyId: r.property_id,
              propertyName: r.property_name || "",
              typeKey: r.type_key,
              displayName: r.display_name,
              adultsCapacity: r.adults_capacity,
              kidsCapacity: r.kids_capacity,
              totalRoomsOfType: r.total_rooms_of_type,
              priceRoomOnly: r.price_room_only,
              priceBedBreakfast: r.price_bed_breakfast,
              priceFullBoard: r.price_full_board,
              photos: r.photos || [],
              description: cleanDescription,
              amenities: r.amenities || [],
              isActive: r.is_active,
              sortOrder: r.sort_order,
              createdAt: r.created_at,
              bookingMode,
              externalBookingUrl,
            };
          }));
        } else {
          setListings([]);
        }
      } catch { setListings([]); }
      try {
        const rooms = await fetchCommercialRooms(currentCompany.id);
        setExistingRooms(rooms || []);
      } catch {}
      setLoading(false);
    }
    void load();
  }, [currentCompany.id]);

  const loadCommercialRooms = async () => {
    setLoadingExistingRooms(true);
    try {
      const data = await fetchCommercialRooms(currentCompany.id);
      setExistingRooms(data || []);
    } catch (err) {
      console.warn("Could not load existing commercial rooms", err);
    } finally {
      setLoadingExistingRooms(false);
    }
  };

  const formatRoomTypeName = (key: string) => {
    const match = ROOM_TYPE_OPTIONS.find(o => o.key.toLowerCase() === (key || "").toLowerCase());
    if (match) return match.label;
    return key ? key.charAt(0).toUpperCase() + key.slice(1) : "Standard Room";
  };

  const getRoomShowcaseStatus = (room: CommercialRoom) => {
    const exact = listings.find(l =>
      l.propertyId === room.propertyId &&
      l.displayName.toLowerCase().includes((room.roomNumber || "").toLowerCase())
    );
    if (exact) return { status: "exact" as const, label: "In Showcase", listing: exact };
    const typeMatch = listings.find(l =>
      l.propertyId === room.propertyId &&
      l.typeKey.toLowerCase() === (room.roomType || "").toLowerCase()
    );
    if (typeMatch) return { status: "type" as const, label: "Type Listed", listing: typeMatch };
    return { status: "none" as const, label: "Ready to Add", listing: null };
  };

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

  const hospProps = properties.filter(p => ["hotel","motel","lodge","guest_house","commercial"].includes(p.type));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.property_id) e.property_id = "All rooms must belong to an accommodation property (Hotel, Motel, Lodge, Guest House).";
    if (!form.type_key) e.type_key = "Please select a room type.";
    if (!form.display_name.trim()) e.display_name = "Room name is required.";
    if ((Number(form.price_room_only)||0) <= 0 && (Number(form.price_bed_breakfast)||0) <= 0 && (Number(form.price_full_board)||0) <= 0) e.price = "At least one price must be greater than 0.";
    if (formPhotos.length < 2) e.photos = "Please upload at least 2 photos.";
    if (form.booking_mode === "external" && !form.external_booking_url.trim()) {
      e.external_booking_url = "Custom booking / reservation link is required for external booking mode.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const openAdd = () => {
    if (hospProps.length === 0) {
      alert("All rooms must belong to an accommodation property (Hotel, Motel, Lodge, Guest House, Commercial). Please create an accommodation property first.");
      return;
    }
    setEditingId(null);
    setModalTab("existing");
    setForm({
      ...emptyForm,
      property_id: hospProps.length > 0 ? hospProps[0].id : "",
    });
    setFormPhotos([]);
    setErrors({});
    setPropertyRoomTypes([]);
    setSelectedRoomIds(new Set());
    setExistingSearch("");
    setExistingPropertyFilter("all");
    setExistingShowcaseFilter("all");
    void loadCommercialRooms();
    setModalOpen(true);
  };

  const openEdit = (r: RoomTypeListing) => {
    setEditingId(r.id);
    setModalTab("scratch");
    setForm({
      property_id: r.propertyId,
      type_key: r.typeKey,
      display_name: r.displayName,
      adults_capacity: r.adultsCapacity,
      kids_capacity: r.kidsCapacity,
      total_rooms_of_type: r.totalRoomsOfType,
      price_room_only: r.priceRoomOnly || "",
      price_bed_breakfast: r.priceBedBreakfast || "",
      price_full_board: r.priceFullBoard || "",
      description: r.description,
      amenities: r.amenities,
      sort_order: r.sortOrder,
      is_active: r.isActive,
      booking_mode: r.bookingMode || "platform",
      external_booking_url: r.externalBookingUrl || "",
    });
    setFormPhotos(r.photos);
    setErrors({});
    setModalOpen(true);
  };

  const handleCustomizeRoom = (room: CommercialRoom) => {
    const prop = properties.find(p => p.id === room.propertyId);
    let safePhotos = (room.photos || []).filter(Boolean);
    if (safePhotos.length < 2 && prop?.photos) {
      for (const p of prop.photos.filter(Boolean)) {
        if (!safePhotos.includes(p)) safePhotos.push(p);
        if (safePhotos.length >= 2) break;
      }
    }
    if (safePhotos.length < 2) {
      for (const fb of DEFAULT_ROOM_FALLBACK_PHOTOS) {
        if (!safePhotos.includes(fb)) safePhotos.push(fb);
        if (safePhotos.length >= 2) break;
      }
    }

    const typeLabel = formatRoomTypeName(room.roomType);
    const displayName = `${typeLabel} - ${room.roomNumber}`;

    setEditingId(null);
    setForm({
      property_id: room.propertyId,
      type_key: room.roomType,
      display_name: displayName,
      adults_capacity: room.capacityAdults || 2,
      kids_capacity: room.capacityChildren || 0,
      total_rooms_of_type: 1,
      price_room_only: room.pricePerNight > 0 ? room.pricePerNight : (prop?.defaultRoomPrice || 1000),
      price_bed_breakfast: room.priceBedBreakfast > 0 ? room.priceBedBreakfast : (prop?.defaultBedBreakfast || ""),
      price_full_board: room.priceFullBoard > 0 ? room.priceFullBoard : (prop?.defaultFullBoard || ""),
      description: room.notes ? room.notes.trim() : `Comfortable and elegant ${room.roomType} room (${room.roomNumber}) on ${room.floor || "main floor"} at ${prop?.name || "our property"}.`,
      amenities: (room.amenities && room.amenities.length > 0) ? room.amenities : ["wifi", "tv", "ac"],
      sort_order: listings.length,
      is_active: true,
      booking_mode: room.bookingMode || "platform",
      external_booking_url: room.externalBookingUrl || "",
    });
    setFormPhotos(safePhotos);
    setErrors({});
    setModalTab("scratch");
  };

  const toggleSelectRoom = (roomId: string) => {
    setSelectedRoomIds(prev => {
      const next = new Set(prev);
      if (next.has(roomId)) {
        next.delete(roomId);
      } else {
        next.add(roomId);
      }
      return next;
    });
  };

  const handleBulkAddExistingRooms = async () => {
    if (selectedRoomIds.size === 0) return;
    setImportingRooms(true);
    try {
      const selectedList = existingRooms.filter(r => selectedRoomIds.has(r.id));
      const newItems: RoomTypeListing[] = [];

      for (let i = 0; i < selectedList.length; i++) {
        const room = selectedList[i];
        const prop = properties.find(p => p.id === room.propertyId);

        let safePhotos = (room.photos || []).filter(Boolean);
        if (safePhotos.length < 2 && prop?.photos) {
          for (const p of prop.photos.filter(Boolean)) {
            if (!safePhotos.includes(p)) safePhotos.push(p);
            if (safePhotos.length >= 2) break;
          }
        }
        if (safePhotos.length < 2) {
          for (const fb of DEFAULT_ROOM_FALLBACK_PHOTOS) {
            if (!safePhotos.includes(fb)) safePhotos.push(fb);
            if (safePhotos.length >= 2) break;
          }
        }

        const metaTag = `\n<!--ROOM_META:${JSON.stringify({
          bookingMode: room.bookingMode || "platform",
          externalBookingUrl: (room.externalBookingUrl || "").trim(),
        })}-->`;
        const cleanDesc = room.notes ? room.notes.trim() : `Comfortable and elegant ${room.roomType} room (${room.roomNumber}) on ${room.floor || "main floor"} at ${prop?.name || "our property"}.`;
        const fullDescription = `${cleanDesc}${metaTag}`;

        const priceRoomOnly = room.pricePerNight > 0 ? room.pricePerNight : (prop?.defaultRoomPrice || 1000);
        const priceBedBreakfast = room.priceBedBreakfast > 0 ? room.priceBedBreakfast : (prop?.defaultBedBreakfast || 0);
        const priceFullBoard = room.priceFullBoard > 0 ? room.priceFullBoard : (prop?.defaultFullBoard || 0);

        const typeLabel = formatRoomTypeName(room.roomType);
        const displayName = `${typeLabel} - ${room.roomNumber}`;

        const payload: any = {
          company_id: currentCompany.id,
          property_id: room.propertyId,
          property_name: prop?.name || room.propertyName || "",
          type_key: room.roomType,
          display_name: displayName,
          adults_capacity: room.capacityAdults || 2,
          kids_capacity: room.capacityChildren || 0,
          total_rooms_of_type: 1,
          price_room_only: priceRoomOnly,
          price_bed_breakfast: priceBedBreakfast,
          price_full_board: priceFullBoard,
          description: fullDescription,
          amenities: (room.amenities && room.amenities.length > 0) ? room.amenities : ["wifi", "tv", "ac"],
          photos: safePhotos,
          sort_order: listings.length + i,
          is_active: true,
          booking_mode: room.bookingMode || "platform",
          external_booking_url: room.bookingMode === "external" ? (room.externalBookingUrl || "").trim() : null,
        };

        let insertRes = await supabase.from("room_type_listings").insert(payload).select().single();
        if (insertRes.error) {
          const { booking_mode, external_booking_url, ...fallbackPayload } = payload;
          insertRes = await supabase.from("room_type_listings").insert(fallbackPayload).select().single();
          if (insertRes.error) {
            console.warn(`Could not insert room ${room.roomNumber}`, insertRes.error);
            continue;
          }
        }

        if (insertRes.data) {
          const d = insertRes.data;
          newItems.push({
            id: d.id,
            companyId: currentCompany.id,
            propertyId: payload.property_id,
            propertyName: payload.property_name,
            typeKey: payload.type_key,
            displayName: payload.display_name,
            adultsCapacity: payload.adults_capacity,
            kidsCapacity: payload.kids_capacity,
            totalRoomsOfType: payload.total_rooms_of_type,
            priceRoomOnly: payload.price_room_only,
            priceBedBreakfast: payload.price_bed_breakfast,
            priceFullBoard: payload.price_full_board,
            description: cleanDesc,
            amenities: payload.amenities,
            photos: safePhotos,
            isActive: true,
            sortOrder: payload.sort_order,
            bookingMode: payload.booking_mode,
            externalBookingUrl: payload.external_booking_url || "",
          });
        }
      }

      if (newItems.length > 0) {
        setListings(prev => [...prev, ...newItems]);
        setSelectedRoomIds(new Set());
        setModalOpen(false);
      } else {
        alert("No rooms could be added. Please verify room details.");
      }
    } catch (err: any) {
      alert("Error adding rooms: " + (err.message || String(err)));
    } finally {
      setImportingRooms(false);
    }
  };

  const toggleBookingVisibility = async (r: RoomTypeListing) => {
    const next = !r.isActive;
    await supabase.from("room_type_listings").update({ is_active: next }).eq("id", r.id);
    setListings(prev => prev.map(x => x.id === r.id ? { ...x, isActive: next } : x));
  };

  const toggleRentalVisibility = async (p: any, nextPublishState?: boolean) => {
    const next = nextPublishState !== undefined ? nextPublishState : !p.is_published;
    await supabase.from("properties").update({ is_published: next }).eq("id", p.id);
    setRentalProperties(prev => prev.map(x => x.id === p.id ? { ...x, is_published: next } : x));
    setProperties(prev => prev.map(x => x.id === p.id ? { ...x, isPublished: next } : x));
  };

  const handleToggleRental = (p: any) => {
    if (p.is_published) {
      void toggleRentalVisibility(p, false);
      return;
    }
    if (p.status !== "vacant") {
      setRentalPromptTarget(p);
      setRentalVacancyDate(p.available_from || "");
      setRentalPromptError(null);
      setRentalPromptOpen(true);
      return;
    }
    void toggleRentalVisibility(p, true);
  };

  const handleConfirmPublishOccupiedRental = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rentalPromptTarget) return;
    if (!rentalVacancyDate) {
      setRentalPromptError("Please select the date and month this property will become vacant.");
      return;
    }

    setRentalPromptLoading(true);
    setRentalPromptError(null);
    try {
      const updatePayload: Record<string, any> = {
        is_published: true,
        available_from: rentalVacancyDate,
      };
      const { error: err } = await supabase.from("properties").update(updatePayload).eq("id", rentalPromptTarget.id);
      if (err) {
        const { error: fErr } = await supabase.from("properties").update({ is_published: true }).eq("id", rentalPromptTarget.id);
        if (fErr) throw fErr;
      }

      setRentalProperties(prev => prev.map(x => x.id === rentalPromptTarget.id ? { ...x, is_published: true, available_from: rentalVacancyDate } : x));
      setProperties(prev => prev.map(x => x.id === rentalPromptTarget.id ? { ...x, isPublished: true, availableFrom: rentalVacancyDate } : x));

      setRentalPromptOpen(false);
      setRentalPromptTarget(null);
      setRentalVacancyDate("");
    } catch (err) {
      setRentalPromptError(err instanceof Error ? err.message : "Failed to publish property.");
    } finally {
      setRentalPromptLoading(false);
    }
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
      const cleanDesc = form.description.split("<!--ROOM_META:")[0].trim();
      const metaTag = `\n<!--ROOM_META:${JSON.stringify({
        bookingMode: form.booking_mode,
        externalBookingUrl: form.external_booking_url.trim(),
      })}-->`;
      const fullDescription = `${cleanDesc}${metaTag}`;

      const payload: any = {
        company_id: currentCompany.id,
        property_id: form.property_id,
        property_name: prop?.name || "",
        type_key: form.type_key,
        display_name: form.display_name.trim(),
        adults_capacity: form.adults_capacity,
        kids_capacity: form.kids_capacity,
        total_rooms_of_type: form.total_rooms_of_type,
        price_room_only: Number(form.price_room_only) || 0,
        price_bed_breakfast: Number(form.price_bed_breakfast) || 0,
        price_full_board: Number(form.price_full_board) || 0,
        description: fullDescription,
        amenities: form.amenities,
        photos: formPhotos,
        sort_order: form.sort_order,
        is_active: form.is_active,
        booking_mode: form.booking_mode,
        external_booking_url: form.booking_mode === "external" ? form.external_booking_url.trim() : null,
      };

      if (editingId) {
        let updateRes = await supabase.from("room_type_listings").update(payload).eq("id", editingId);
        if (updateRes.error) {
          const { booking_mode, external_booking_url, ...fallbackPayload } = payload;
          const fallbackRes = await supabase.from("room_type_listings").update(fallbackPayload).eq("id", editingId);
          if (fallbackRes.error) throw fallbackRes.error;
        }
        setListings(prev => prev.map(r => r.id === editingId ? {
          ...r,
          ...payload,
          id: editingId,
          companyId: currentCompany.id,
          propertyId: form.property_id,
          propertyName: prop?.name || "",
          typeKey: form.type_key,
          displayName: form.display_name,
          adultsCapacity: form.adults_capacity,
          kidsCapacity: form.kids_capacity,
          totalRoomsOfType: form.total_rooms_of_type,
          priceRoomOnly: payload.price_room_only,
          priceBedBreakfast: payload.price_bed_breakfast,
          priceFullBoard: payload.price_full_board,
          description: cleanDesc,
          isActive: form.is_active,
          sortOrder: form.sort_order,
          photos: formPhotos,
          bookingMode: form.booking_mode,
          externalBookingUrl: form.booking_mode === "external" ? form.external_booking_url.trim() : "",
        } : r));
      } else {
        let insertRes = await supabase.from("room_type_listings").insert(payload).select().single();
        if (insertRes.error) {
          const { booking_mode, external_booking_url, ...fallbackPayload } = payload;
          insertRes = await supabase.from("room_type_listings").insert(fallbackPayload).select().single();
          if (insertRes.error) throw insertRes.error;
        }
        const data = insertRes.data;
        if (data) {
          setListings(prev => [...prev, {
            id: data.id,
            companyId: currentCompany.id,
            propertyId: form.property_id,
            propertyName: prop?.name || "",
            typeKey: form.type_key,
            displayName: form.display_name,
            adultsCapacity: form.adults_capacity,
            kidsCapacity: form.kids_capacity,
            totalRoomsOfType: form.total_rooms_of_type,
            priceRoomOnly: payload.price_room_only,
            priceBedBreakfast: payload.price_bed_breakfast,
            priceFullBoard: payload.price_full_board,
            description: cleanDesc,
            amenities: form.amenities,
            photos: formPhotos,
            isActive: form.is_active,
            sortOrder: form.sort_order,
            bookingMode: form.booking_mode,
            externalBookingUrl: form.booking_mode === "external" ? form.external_booking_url.trim() : "",
          }]);
        }
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

  const availableTypeOptions = propertyRoomTypes.length > 0 ? ROOM_TYPE_OPTIONS.filter(o => propertyRoomTypes.includes(o.key)) : ROOM_TYPE_OPTIONS;
  const inputCls = (field: string) => `w-full rounded-xl border px-3 py-2 text-foreground outline-none focus:border-purple-600 bg-surface-elevated text-sm ${errors[field] ? "border-red-500" : "border-border-color"}`;

  const filteredListings = listings.filter(r => !searchQuery || r.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || (r.propertyName||"").toLowerCase().includes(searchQuery.toLowerCase()));
  const filteredRentals = rentalProperties.filter((p: any) => !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()) || (p.city||"").toLowerCase().includes(searchQuery.toLowerCase()));

  const filteredExistingRooms = existingRooms.filter(r => {
    if (existingPropertyFilter !== "all" && r.propertyId !== existingPropertyFilter) {
      return false;
    }
    if (existingSearch.trim()) {
      const q = existingSearch.toLowerCase();
      const matchNumber = (r.roomNumber || "").toLowerCase().includes(q);
      const matchType = (r.roomType || "").toLowerCase().includes(q);
      const matchProp = (r.propertyName || "").toLowerCase().includes(q);
      const matchFloor = (r.floor || "").toLowerCase().includes(q);
      if (!matchNumber && !matchType && !matchProp && !matchFloor) return false;
    }
    const showcaseInfo = getRoomShowcaseStatus(r);
    if (existingShowcaseFilter === "unshowcased" && showcaseInfo.status !== "none") {
      return false;
    }
    if (existingShowcaseFilter === "showcased" && showcaseInfo.status === "none") {
      return false;
    }
    return true;
  });

  return (
    <ModulePage title="Showcase" description="Manage what shows on the public portal - rooms for booking and properties for rent.">
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
              <button
                type="button"
                onClick={openAdd}
                disabled={hospProps.length === 0}
                className="ml-auto flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                title={hospProps.length === 0 ? "You must have an accommodation property in the system before adding room types" : "Add Room Type"}
              >
                <Plus size={16}/> Add Room Type
              </button>
            )}
          </div>

          {/* Accommodation Property Requirement Banner */}
          {tab === "bookings" && (
            <div
              className={`rounded-2xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs ${
                hospProps.length === 0
                  ? "border-amber-400 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                  : "border-purple-200 dark:border-purple-900/50 bg-purple-50/70 dark:bg-purple-950/30 text-purple-900 dark:text-purple-200"
              }`}
            >
              <div className="flex items-start sm:items-center gap-3">
                <Building2
                  size={20}
                  className={`shrink-0 mt-0.5 sm:mt-0 ${
                    hospProps.length === 0 ? "text-amber-600 dark:text-amber-400" : "text-purple-600 dark:text-purple-400"
                  }`}
                />
                <div>
                  <span className="font-bold text-sm block sm:inline mr-1.5">
                    {hospProps.length === 0 ? "Accommodation Property Required:" : "Accommodation Property Assignment:"}
                  </span>
                  <span>
                    All rooms and booking types must belong to an accommodation property (Hotel, Motel, Lodge, Guest House, Commercial). Without selecting a property or having an accommodation property in the system, you cannot create or showcase rooms.
                  </span>
                </div>
              </div>
              {hospProps.length === 0 ? (
                <Link
                  to="/properties"
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700 transition"
                >
                  <Plus size={14} /> Create Property First
                </Link>
              ) : (
                <div className="shrink-0 text-[11px] font-semibold bg-white/70 dark:bg-slate-900/70 px-3 py-1.5 rounded-xl border border-purple-200 dark:border-purple-800 text-purple-700 dark:text-purple-300">
                  {hospProps.length} Accommodation {hospProps.length === 1 ? "Property" : "Properties"} Active
                </div>
              )}
            </div>
          )}

          {/* ── BOOKINGS TAB ── */}
          {tab === "bookings" && (
            <section>
              {hospProps.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-amber-500/30 bg-amber-500/5 p-12 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 mb-4">
                    <Building2 size={28} />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-1">
                    Accommodation Property Required
                  </h3>
                  <p className="max-w-md text-xs text-muted mb-5">
                    All rooms and booking types must belong to an accommodation property (Hotel, Motel, Lodge, Guest House, Commercial).
                    Without having an accommodation property in the system, you cannot create room types.
                  </p>
                  <Link
                    to="/properties"
                    className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-amber-700 transition"
                  >
                    <Plus size={16} /> Create Accommodation Property First
                  </Link>
                </div>
              ) : (
                <>
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
                        <div className="flex items-center gap-1.5 shrink-0">
                          {r.bookingMode === "external" ? (
                            <span className="rounded-full bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 px-2 py-0.5 text-[10px] font-bold" title={r.externalBookingUrl}>
                              Custom Link
                            </span>
                          ) : (
                            <span className="rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 px-2 py-0.5 text-[10px] font-bold">
                              Paimbabook
                            </span>
                          )}
                          <span className="rounded-full bg-surface px-2 py-0.5 border border-border-color text-[10px] capitalize">{r.typeKey}</span>
                        </div>
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
            </>
          )}
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
                        <div className="flex flex-col items-end gap-1">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${p.status==="vacant"?"bg-green-100 text-green-700":"bg-orange-100 text-orange-700"}`}>{p.status==="vacant"?"Available":"Occupied"}</span>
                          {p.status === "occupied" && p.available_from && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                              <Calendar size={10}/> Vacant {new Date(p.available_from).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                            </span>
                          )}
                        </div>
                      </div>
                      {p.is_published ? (
                        <button type="button" onClick={() => handleToggleRental(p)} className="w-full flex items-center justify-center gap-2 rounded-xl border border-orange-300 px-3 py-2 text-sm font-bold text-orange-600 hover:bg-orange-50 transition">
                          <EyeOff size={14}/> Unpublish
                        </button>
                      ) : (
                        <button type="button" onClick={() => handleToggleRental(p)} className="w-full flex items-center justify-center gap-2 rounded-xl border border-green-400 bg-green-50 px-3 py-2 text-sm font-bold text-green-700 hover:bg-green-100 transition">
                          <Eye size={14}/> Publish
                        </button>
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
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingId ? "Edit Room Type" : (modalTab === "existing" ? "Add Existing Rooms to Showcase" : "Create Room Type from Scratch")}
        maxWidthClassName="max-w-3xl"
      >
        <div className="space-y-4 text-xs">
          {/* Tab switcher: Existing Rooms vs From Scratch (only when adding new) */}
          {!editingId && (
            <div className="flex items-center gap-2 border-b border-border-color pb-3">
              <button
                type="button"
                onClick={() => setModalTab("existing")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                  modalTab === "existing"
                    ? "bg-purple-600 text-white shadow-sm ring-1 ring-purple-600"
                    : "border border-border-color bg-surface-elevated text-muted hover:text-foreground"
                }`}
              >
                <Building2 size={14} />
                <span>Select Existing Rooms</span>
                <span className={`ml-1 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                  modalTab === "existing" ? "bg-white/20 text-white" : "bg-muted/10 text-muted"
                }`}>
                  {existingRooms.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setModalTab("scratch")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition ${
                  modalTab === "scratch"
                    ? "bg-purple-600 text-white shadow-sm ring-1 ring-purple-600"
                    : "border border-border-color bg-surface-elevated text-muted hover:text-foreground"
                }`}
              >
                <Plus size={14} />
                <span>Create from Scratch</span>
              </button>
            </div>
          )}

          {/* ══════ TAB 1: EXISTING ROOMS ══════ */}
          {!editingId && modalTab === "existing" && (
            <div className="space-y-3">
              {/* Filter Toolbar */}
              <div className="flex flex-wrap items-center gap-2 bg-surface-elevated/40 p-2.5 rounded-xl border border-border-color">
                <div className="relative flex-1 min-w-[180px]">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
                  <input
                    value={existingSearch}
                    onChange={e => setExistingSearch(e.target.value)}
                    placeholder="Search room #, type, floor..."
                    className="w-full rounded-lg border border-border-color bg-surface pl-7 pr-7 py-1.5 text-xs text-foreground outline-none focus:border-purple-600"
                  />
                  {existingSearch && (
                    <button
                      type="button"
                      onClick={() => setExistingSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-foreground"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                {hospProps.length > 1 && (
                  <select
                    value={existingPropertyFilter}
                    onChange={e => setExistingPropertyFilter(e.target.value)}
                    className="rounded-lg border border-border-color bg-surface px-2 py-1.5 text-xs text-foreground outline-none focus:border-purple-600"
                  >
                    <option value="all">All Properties</option>
                    {hospProps.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                )}

                <select
                  value={existingShowcaseFilter}
                  onChange={e => setExistingShowcaseFilter(e.target.value as any)}
                  className="rounded-lg border border-border-color bg-surface px-2 py-1.5 text-xs text-foreground outline-none focus:border-purple-600"
                >
                  <option value="all">All Statuses</option>
                  <option value="unshowcased">Ready to Add (Unlisted)</option>
                  <option value="showcased">Already Showcased</option>
                </select>

                <button
                  type="button"
                  onClick={() => {
                    if (selectedRoomIds.size === filteredExistingRooms.length && filteredExistingRooms.length > 0) {
                      setSelectedRoomIds(new Set());
                    } else {
                      setSelectedRoomIds(new Set(filteredExistingRooms.map(r => r.id)));
                    }
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-border-color bg-surface px-2.5 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-elevated transition shrink-0"
                >
                  {selectedRoomIds.size === filteredExistingRooms.length && filteredExistingRooms.length > 0 ? (
                    <CheckSquare size={13} className="text-purple-600" />
                  ) : (
                    <Square size={13} className="text-muted" />
                  )}
                  <span>
                    {selectedRoomIds.size === filteredExistingRooms.length && filteredExistingRooms.length > 0
                      ? "Deselect All"
                      : "Select All"}
                  </span>
                </button>
              </div>

              {/* Scrollable Room List */}
              <div className="max-h-[50vh] overflow-y-auto space-y-2 pr-1">
                {loadingExistingRooms ? (
                  <div className="flex flex-col items-center justify-center py-12 text-muted gap-2">
                    <Loader2 size={24} className="animate-spin text-purple-600" />
                    <p className="text-xs">Loading commercial rooms...</p>
                  </div>
                ) : filteredExistingRooms.length === 0 ? (
                  <div className="py-12 text-center text-muted rounded-xl border border-dashed border-border-color bg-surface-elevated/20">
                    <BedDouble size={32} className="mx-auto mb-2 text-muted/40" />
                    <p className="text-sm font-semibold text-foreground">No matching rooms found</p>
                    <p className="text-xs text-muted mt-1 max-w-sm mx-auto">
                      {existingRooms.length === 0
                        ? "No commercial rooms found in the system. You can create showcase rooms from scratch using the tab above, or add physical rooms in the Rooms module."
                        : "Try clearing search or filters to see all available rooms."}
                    </p>
                  </div>
                ) : (
                  filteredExistingRooms.map((r) => {
                    const isSelected = selectedRoomIds.has(r.id);
                    const statusInfo = getRoomShowcaseStatus(r);
                    const prop = properties.find(p => p.id === r.propertyId);
                    const thumbUrl = (r.photos || []).find(Boolean) || (prop?.photos || []).find(Boolean);

                    return (
                      <div
                        key={r.id}
                        onClick={() => toggleSelectRoom(r.id)}
                        className={`group flex items-center justify-between gap-3 p-3 rounded-xl border transition cursor-pointer select-none ${
                          isSelected
                            ? "border-purple-600 bg-purple-500/10 shadow-xs"
                            : "border-border-color bg-surface-elevated/40 hover:bg-surface-elevated hover:border-purple-300 dark:hover:border-purple-800"
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Checkbox */}
                          <div
                            onClick={(e) => { e.stopPropagation(); toggleSelectRoom(r.id); }}
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition ${
                              isSelected
                                ? "border-purple-600 bg-purple-600 text-white"
                                : "border-border-color bg-surface text-transparent group-hover:border-purple-400"
                            }`}
                          >
                            <Check size={12} strokeWidth={3} className={isSelected ? "block" : "hidden"} />
                          </div>

                          {/* Thumbnail */}
                          <div className="relative h-12 w-16 sm:h-14 sm:w-20 shrink-0 overflow-hidden rounded-lg border border-border-color bg-surface-elevated">
                            {thumbUrl ? (
                              <img src={thumbUrl} alt={r.roomNumber} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-purple-500/10 text-purple-600">
                                <BedDouble size={20} />
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-sm text-foreground">{r.roomNumber}</span>
                              <span className="rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                                {formatRoomTypeName(r.roomType)}
                              </span>
                              {r.floor && (
                                <span className="text-[11px] text-muted hidden sm:inline">
                                  · {r.floor}
                                </span>
                              )}
                              {/* Showcase status badge */}
                              {statusInfo.status === "exact" ? (
                                <span className="rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 px-2 py-0.5 text-[10px] font-semibold flex items-center gap-1">
                                  <Check size={10} /> In Showcase
                                </span>
                              ) : statusInfo.status === "type" ? (
                                <span className="rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 px-2 py-0.5 text-[10px] font-semibold">
                                  Type Showcased
                                </span>
                              ) : (
                                <span className="rounded-full bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 text-[10px] font-medium">
                                  Ready to Add
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted">
                              <span className="flex items-center gap-1">
                                <Building2 size={11} className="text-muted shrink-0" />
                                <span className="truncate max-w-[130px]">{prop?.name || r.propertyName || "Accommodation"}</span>
                              </span>
                              <span className="flex items-center gap-1 hidden sm:flex">
                                <Users size={11} className="text-muted shrink-0" />
                                <span>{r.capacityAdults} adults{r.capacityChildren ? `, ${r.capacityChildren} kids` : ""}</span>
                              </span>
                              <span className="font-bold text-foreground">
                                {formatCurrency(r.pricePerNight || prop?.defaultRoomPrice || 0)} <span className="font-normal text-muted">/ night</span>
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right Quick Action: Customize */}
                        <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => handleCustomizeRoom(r)}
                            className="flex items-center gap-1 rounded-lg border border-purple-300 dark:border-purple-800 bg-surface px-2.5 py-1.5 text-xs font-semibold text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition"
                            title="Customize room details and preview before adding"
                          >
                            <span className="hidden sm:inline">Customize &amp;</span>
                            <span>Add</span>
                            <ArrowRight size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Sticky Action Bar */}
              <div className="flex items-center justify-between gap-3 pt-3 border-t border-border-color">
                <div className="flex items-center gap-2 text-xs text-muted">
                  <span className="font-bold text-foreground">
                    {selectedRoomIds.size} room{selectedRoomIds.size === 1 ? "" : "s"} selected
                  </span>
                  {selectedRoomIds.size > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedRoomIds(new Set())}
                      className="text-xs text-purple-600 hover:underline font-semibold"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-xl border border-border-color px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-elevated"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkAddExistingRooms}
                    disabled={selectedRoomIds.size === 0 || importingRooms}
                    className="flex items-center gap-1.5 rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {importingRooms ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                    <span>{importingRooms ? "Adding to Showcase..." : `Add ${selectedRoomIds.size > 0 ? selectedRoomIds.size : ""} Selected to Showcase`}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══════ TAB 2: CREATE FROM SCRATCH / EDIT ══════ */}
          {(editingId || modalTab === "scratch") && (
            <div className="space-y-4">
              {/* Modal Accommodation Property Requirement Banner */}
              <div
                className={`rounded-xl border p-3 flex items-start gap-2.5 text-xs ${
                  hospProps.length === 0
                    ? "border-amber-400 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                    : "border-purple-200 dark:border-purple-900/40 bg-purple-50/70 dark:bg-purple-950/30 text-purple-900 dark:text-purple-200"
                }`}
              >
                <Building2
                  size={16}
                  className={`shrink-0 mt-0.5 ${
                    hospProps.length === 0 ? "text-amber-600" : "text-purple-600"
                  }`}
                />
                <div>
                  <p className="font-bold">
                    {hospProps.length === 0
                      ? "Accommodation Property Required"
                      : "Accommodation Property Assignment"}
                  </p>
                  <p className="text-[11px] opacity-90 mt-0.5">
                    All rooms and showcase listings must belong to an accommodation property (Hotel, Motel, Lodge, Guest House, Commercial). Without selecting a property, room listings cannot be saved.
                  </p>
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold text-foreground">Property <span className="text-red-500">*</span></label>
                <select value={form.property_id} onChange={e => { setForm(f=>({...f,property_id:e.target.value,type_key:"",display_name:""})); setErrors(v=>({...v,property_id:""})); }} className={inputCls("property_id")}>
                  <option value="">- Select a hospitality property -</option>
                  {hospProps.map(p => <option key={p.id} value={p.id}>{p.name} ({p.type.replace(/_/g," ")})</option>)}
                </select>
                {errors.property_id && <p className="mt-1 flex items-center gap-1 text-red-500 text-[11px]"><AlertCircle size={11}/>{errors.property_id}</p>}
              </div>
              <div>
                <label className="mb-1 block font-semibold text-foreground">Room Type <span className="text-red-500">*</span></label>
                <select value={form.type_key} onChange={e => { const opt = ROOM_TYPE_OPTIONS.find(o=>o.key===e.target.value); setForm(f=>({...f,type_key:e.target.value,display_name:opt?opt.label:f.display_name,adults_capacity:opt?opt.adults:f.adults_capacity,kids_capacity:opt?opt.kids:f.kids_capacity})); setErrors(v=>({...v,type_key:""})); }} disabled={!form.property_id} className={`${inputCls("type_key")} ${!form.property_id?"opacity-50 cursor-not-allowed":""}`}>
                  <option value="">{form.property_id?"- Select room type -":"- Select a property first -"}</option>
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
              {/* Booking & Reservation Method Setting */}
              <div className="rounded-xl border border-border-color p-3 space-y-2.5 bg-surface-elevated/40">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-foreground flex items-center gap-1.5">
                    <Globe size={13} className="text-blue-500" />
                    Booking &amp; Reservation Method *
                  </label>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    form.booking_mode === "external"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                      : "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300"
                  }`}>
                    {form.booking_mode === "external" ? "Custom Link" : "Paimbabook Native"}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, booking_mode: "platform" }))}
                    className={`rounded-xl border p-2.5 text-left transition ${
                      form.booking_mode === "platform"
                        ? "border-purple-600 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold ring-1 ring-purple-600"
                        : "border-border-color bg-surface text-muted hover:border-foreground/30"
                    }`}
                  >
                    <p className="text-xs font-bold flex items-center gap-1">
                      <BedDouble size={12} /> Via Paimbabook
                    </p>
                    <p className="text-[10px] opacity-75 mt-0.5">Direct instant book &amp; hold reservations on website</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, booking_mode: "external" }))}
                    className={`rounded-xl border p-2.5 text-left transition ${
                      form.booking_mode === "external"
                        ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold ring-1 ring-blue-600"
                        : "border-border-color bg-surface text-muted hover:border-foreground/30"
                    }`}
                  >
                    <p className="text-xs font-bold flex items-center gap-1">
                      <Globe size={12} /> Custom Link / External
                    </p>
                    <p className="text-[10px] opacity-75 mt-0.5">Redirect guests to custom booking or partner link</p>
                  </button>
                </div>
                {form.booking_mode === "external" && (
                  <div className="pt-1.5 space-y-1">
                    <label className="block font-semibold text-foreground text-[11px]">
                      Custom Booking URL / External Link <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="url"
                      value={form.external_booking_url}
                      onChange={e => {
                        setForm(f => ({ ...f, external_booking_url: e.target.value }));
                        setErrors(prev => ({ ...prev, external_booking_url: "" }));
                      }}
                      placeholder="https://booking.com/your-hotel or https://mysite.com/reserve"
                      className={inputCls("external_booking_url")}
                    />
                    {errors.external_booking_url && (
                      <p className="flex items-center gap-1 text-red-500 text-[11px]">
                        <AlertCircle size={11} />
                        {errors.external_booking_url}
                      </p>
                    )}
                    <p className="text-[10px] text-muted">
                      When visitors click Book or Reserve on this room, they will be redirected to this custom link.
                    </p>
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <div onClick={()=>setForm(f=>({...f,is_active:!f.is_active}))} className={`relative h-5 w-9 rounded-full transition-colors ${form.is_active?"bg-purple-600":"bg-gray-300"}`}><div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${form.is_active?"translate-x-4":"translate-x-0.5"}`}/></div>
                <span className="font-medium text-foreground text-xs">{form.is_active?"Visible on portal":"Hidden from portal"}</span>
              </label>
              <div className="flex justify-end gap-2 pt-2 border-t border-border-color">
                <button type="button" onClick={()=>setModalOpen(false)} className="rounded-xl border border-border-color px-4 py-2 text-sm text-muted hover:bg-surface-elevated">Cancel</button>
                <button
                  type="button"
                  onClick={onSave}
                  disabled={saving || hospProps.length === 0 || !form.property_id}
                  className="rounded-xl bg-purple-600 px-5 py-2 text-sm font-bold text-white shadow-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving..." : editingId ? "Save Changes" : "Create Room Type"}
                </button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Occupied Rental Vacancy Date Prompt Modal */}
      <Modal
        open={rentalPromptOpen}
        onClose={() => { if (!rentalPromptLoading) { setRentalPromptOpen(false); setRentalPromptTarget(null); } }}
        title="Scheduled Vacancy Date Required"
      >
        <form onSubmit={handleConfirmPublishOccupiedRental} className="space-y-4">
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-700 dark:text-amber-400">
            <p className="font-semibold mb-1">
              Publishing Occupied Property: {rentalPromptTarget?.name}
            </p>
            <p>
              To avoid confusion on the public portal, occupied listings must display the date and month they will become vacant and available for new tenants.
            </p>
          </div>

          <div>
            <label className="mb-1 block font-medium text-foreground text-xs">
              When will this property become vacant? *
            </label>
            <input
              type="date"
              required
              value={rentalVacancyDate}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => setRentalVacancyDate(e.target.value)}
              className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-purple-600"
            />
            <p className="text-[11px] text-muted mt-1">
              Visitors on the main portal will see: <strong>Occupied · Available [Date]</strong>
            </p>
          </div>

          {rentalPromptError && (
            <p className="text-xs text-red-500">{rentalPromptError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-border-color">
            <button
              type="button"
              disabled={rentalPromptLoading}
              onClick={() => { setRentalPromptOpen(false); setRentalPromptTarget(null); }}
              className="rounded-xl border border-border-color px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-elevated"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={rentalPromptLoading || !rentalVacancyDate}
              className="rounded-xl bg-purple-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {rentalPromptLoading && <Loader2 size={13} className="animate-spin" />}
              <span>{rentalPromptLoading ? "Publishing..." : "Confirm & Publish"}</span>
            </button>
          </div>
        </form>
      </Modal>
    </ModulePage>
  );
}
