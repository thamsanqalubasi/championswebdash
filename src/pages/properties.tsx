import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ModulePage } from "@/components/module-page";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { Modal } from "@/components/modal";
import { PinPromptDialog } from "@/components/pin-dialog";
import { ImageSlider } from "@/components/image-slider";
import { fetchProperties, isValidUuid, fetchPropertyFloors, savePropertyFloors, generateUuid, verifyUserPin } from "@/lib/data";
import { uploadFileToBucket } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import type { PropertyRow } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { Plus, Pencil, Trash, ChevronRight, Building2, BedDouble, X, Layers, Image as ImageIcon, Loader2, Eye, Globe, EyeOff, MapPin, DollarSign, Calendar, TrendingUp, KeyRound, ExternalLink, Percent, Sparkles } from "lucide-react";
import { DataTableHeader, StatusBadge, TableRowActions, TableActionButton } from "@/components/data-table";
import { useCurrency } from "@/lib/currency";
import { PropertyStatsModal } from "@/components/property-stats-modal";
import { CheckinModal } from "@/components/checkin-modal";

const HOSPITALITY_TYPES = ["hotel", "motel", "lodge", "guest_house", "commercial"];
const RENTAL_TYPES = ["house", "apartment", "storage"];
function isHospitality(type: string) { return HOSPITALITY_TYPES.includes(type); }

const COUNTRIES_AND_CITIES: Record<string, string[]> = {
  Namibia: [
    "Windhoek", "Walvis Bay", "Swakopmund", "Oshakati", "Rundu",
    "Katima Mulilo", "Otjiwarongo", "Keetmanshoop", "Tsumeb", "Gobabis",
    "Ondangwa", "Lüderitz", "Mariental", "Rehoboth", "Henties Bay"
  ],
  "South Africa": [
    "Johannesburg", "Cape Town", "Durban", "Pretoria", "Nelspruit (Mbombela)",
    "Port Elizabeth (Gqeberha)", "Bloemfontein", "East London", "Polokwane",
    "Kimberley", "George", "Rustenburg", "Pietermaritzburg"
  ],
  Zimbabwe: [
    "Harare", "Bulawayo", "Victoria Falls", "Mutare", "Gweru", "Kwekwe", "Masvingo", "Chinhoyi"
  ],
  Botswana: [
    "Gaborone", "Francistown", "Maun", "Kasane", "Palapye", "Selebi-Phikwe", "Lobatse"
  ],
  Zambia: [
    "Lusaka", "Livingstone", "Ndola", "Kitwe", "Chipata", "Solwezi"
  ],
  Angola: [
    "Luanda", "Lubango", "Benguela", "Huambo"
  ],
  Mozambique: [
    "Maputo", "Beira", "Nampula", "Vilankulo"
  ],
  "United Kingdom": [
    "London", "Manchester", "Birmingham", "Edinburgh"
  ],
  "United States": [
    "New York", "Los Angeles", "Miami", "Chicago"
  ],
  Other: [],
};

const emptyForm = {
  name: "",
  type: "lodge",
  address: "",
  city: "Windhoek",
  country: "Namibia",
  status: "occupied",
  monthlyRent: 0,
  totalRooms: 10,
  defaultRoomPrice: 1200,
  defaultBedBreakfast: 1500,
  availableFrom: "",
  bookingMode: "platform" as "platform" | "external",
  externalBookingUrl: "",
  discountPercentage: 0,
  discountStartDate: "",
  discountEndDate: "",
};

export default function PropertiesPage() {
  const navigate = useNavigate();
  const { user, currentCompany } = useAuth();
  const { format: formatCurrency, currency } = useCurrency();
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [propDiscountPin, setPropDiscountPin] = useState("");
  const [propDiscountPinError, setPropDiscountPinError] = useState<string | null>(null);
  const [propDiscountApplyToRooms, setPropDiscountApplyToRooms] = useState(true);
  const [propBookingChannelApplyToRooms, setPropBookingChannelApplyToRooms] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PropertyRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishPromptOpen, setPublishPromptOpen] = useState(false);
  const [publishPromptTarget, setPublishPromptTarget] = useState<PropertyRow | null>(null);
  const [publishVacancyDate, setPublishVacancyDate] = useState("");
  const [publishPromptLoading, setPublishPromptLoading] = useState(false);
  const [publishPromptError, setPublishPromptError] = useState<string | null>(null);
  const [viewTarget, setViewTarget] = useState<PropertyRow | null>(null);
  const [formFloors, setFormFloors] = useState<string[]>(["Ground Floor", "1st Floor", "2nd Floor"]);
  const [newFloorInput, setNewFloorInput] = useState("");
  const [formPhotos, setFormPhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pinDialogForProperty, setPinDialogForProperty] = useState(false);
  const [photoToDeleteIndex, setPhotoToDeleteIndex] = useState<number | null>(null);
  const [pinDialogForPhoto, setPinDialogForPhoto] = useState(false);
  const [checkinPropertyId, setCheckinPropertyId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      setLoading(true); setError(null);
      try {
        const result = await fetchProperties(currentCompany.id);
        if (!cancelled) setProperties(result);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load properties.");
      } finally { if (!cancelled) setLoading(false); }
    }
    void loadData();
    return () => { cancelled = true; };
  }, [reloadKey, currentCompany.id]);

  const reload = () => setReloadKey((v) => v + 1);

  const statusCounts = useMemo(() => ({
    all: properties.length,
    hospitality: properties.filter((i) => HOSPITALITY_TYPES.includes(i.type)).length,
    rental: properties.filter((i) => RENTAL_TYPES.includes(i.type)).length,
    occupied: properties.filter((i) => i.status === "occupied").length,
    vacant: properties.filter((i) => i.status === "vacant").length,
  }), [properties]);

  const filtered = useMemo(() => {
    let result = properties;
    if (activeFilter === "hospitality") result = result.filter((p) => HOSPITALITY_TYPES.includes(p.type));
    else if (activeFilter === "rental") result = result.filter((p) => RENTAL_TYPES.includes(p.type));
    else if (activeFilter === "occupied") result = result.filter((p) => p.status === "occupied");
    else if (activeFilter === "vacant") result = result.filter((p) => p.status === "vacant");
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q) || (p.city||"").toLowerCase().includes(q) || (p.country||"").toLowerCase().includes(q));
    }
    return result;
  }, [properties, activeFilter, searchQuery]);

  const [floorCount, setFloorCount] = useState<number>(3);
  const [isCustomCity, setIsCustomCity] = useState(false);
  const [statsProperty, setStatsProperty] = useState<PropertyRow | null>(null);

  const availableCities = useMemo(() => {
    return COUNTRIES_AND_CITIES[form.country] || [];
  }, [form.country]);

  const openAdd = () => {
    setEditingId(null);
    setForm({ ...emptyForm, country: "Namibia", city: "Windhoek" });
    setFloorCount(3);
    setFormFloors(["Ground Floor", "1st Floor", "2nd Floor"]);
    setFormPhotos([]);
    setIsCustomCity(false);
    setPropDiscountPin("");
    setPropDiscountPinError(null);
    setPropDiscountApplyToRooms(true);
    setPropBookingChannelApplyToRooms(true);
    setModalOpen(true);
  };
  const openEdit = (row: PropertyRow) => {
    setEditingId(row.id);
    const countryVal = row.country || "Namibia";
    const cityVal = row.city || "";
    const knownCities = COUNTRIES_AND_CITIES[countryVal] || [];
    const isCustom = Boolean(cityVal && !knownCities.includes(cityVal));
    setForm({
      name: row.name,
      type: row.type,
      address: row.address,
      city: cityVal,
      country: countryVal,
      status: row.status,
      monthlyRent: row.monthlyRent,
      totalRooms: row.totalRooms || 0,
      defaultRoomPrice: row.defaultRoomPrice || 0,
      defaultBedBreakfast: row.defaultBedBreakfast || 0,
      availableFrom: row.availableFrom || "",
      bookingMode: row.bookingMode || "platform",
      externalBookingUrl: row.externalBookingUrl || "",
      discountPercentage: row.discountPercentage || 0,
      discountStartDate: row.discountStartDate || "",
      discountEndDate: row.discountEndDate || "",
    });
    setIsCustomCity(isCustom);
    setFormPhotos(row.photos || []);
    setPropDiscountPin("");
    setPropDiscountPinError(null);
    setPropDiscountApplyToRooms(true);
    setPropBookingChannelApplyToRooms(true);
    fetchPropertyFloors(currentCompany.id, row.id).then((fls) => {
      setFormFloors(fls);
      setFloorCount(fls.length || 1);
    });
    setModalOpen(true);
  };

  const handleAddFloor = (e: React.FormEvent) => { e.preventDefault(); const t=newFloorInput.trim(); if(!t)return; if(!formFloors.includes(t))setFormFloors([...formFloors,t]); setNewFloorInput(""); };
  const handleRemoveFloor = (f: string) => { if(formFloors.length<=1){alert("Must have at least one floor");return;} setFormFloors(formFloors.filter((x)=>x!==f)); };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files; if(!files||files.length===0)return; setUploadingPhoto(true);
    try { const id=editingId||"prop-photo"; const urls: string[]=[];
      for(let i=0;i<files.length;i++){urls.push(await uploadFileToBucket("property-photos",id,files[i]));}
      setFormPhotos((prev)=>[...prev,...urls]);
    } catch(err){alert(err instanceof Error?err.message:"Upload failed");}
    finally{setUploadingPhoto(false);if(fileInputRef.current)fileInputRef.current.value="";}
  };

  const promptDeletePhoto=(index:number)=>{setPhotoToDeleteIndex(index);setPinDialogForPhoto(true);};
  const confirmDeletePhoto=async()=>{
    if(photoToDeleteIndex===null)return;
    const updated=formPhotos.filter((_,i)=>i!==photoToDeleteIndex); setFormPhotos(updated);
    if(editingId&&isValidUuid(editingId)){try{await supabase.from("properties").update({photos:updated}).eq("id",editingId);}catch{} localStorage.setItem(`cc_prop_photos_${editingId}`,JSON.stringify(updated));}
    setPhotoToDeleteIndex(null);
  };

  const onSave = async () => {
    if (!form.name.trim() || !form.country.trim() || !form.city.trim()) {
      alert("Please fill in Property Name, Country, and City.");
      return;
    }

    const pct = Number(form.discountPercentage) || 0;
    if (pct > 0) {
      if (!propDiscountPin.trim()) {
        setPropDiscountPinError("Security PIN is required to activate promotional discount.");
        return;
      }
      const isPinValid = await verifyUserPin(user?.email || "", propDiscountPin.trim());
      if (!isPinValid) {
        setPropDiscountPinError("Incorrect security PIN. Default is 1234 if not yet configured.");
        return;
      }
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        type: form.type,
        address: form.address.trim(),
        city: form.city.trim(),
        country: form.country.trim(),
        status: form.status,
        monthly_rent: form.monthlyRent,
        total_rooms: form.totalRooms,
        default_room_price: form.defaultRoomPrice,
        default_bed_breakfast: form.defaultBedBreakfast,
        available_from: form.availableFrom || null,
        booking_mode: form.bookingMode || "platform",
        external_booking_url: form.bookingMode === "external" ? (form.externalBookingUrl?.trim() || null) : null,
        discount_percentage: pct,
        discount_start_date: form.discountStartDate || null,
        discount_end_date: form.discountEndDate || null,
        company_id: currentCompany?.id && isValidUuid(currentCompany.id) ? currentCompany.id : null,
        photos: formPhotos,
      };

      const fallbackPayload = (p: Record<string, unknown>) => {
        const copy = { ...p };
        delete copy.available_from;
        delete copy.booking_mode;
        delete copy.external_booking_url;
        delete copy.discount_percentage;
        delete copy.discount_start_date;
        delete copy.discount_end_date;
        return copy;
      };

      let savedId = editingId;
      if (editingId) {
        const { error: err } = await supabase.from("properties").update(payload).eq("id", editingId);
        if (err) {
          console.warn("Retrying property update with fallback payload:", err.message);
          const { error: e2 } = await supabase.from("properties").update(fallbackPayload(payload)).eq("id", editingId);
          if (e2) throw e2;
        }
      } else {
        savedId = generateUuid();
        const { data, error: err } = await supabase.from("properties").insert({ id: savedId, ...payload }).select("id").maybeSingle();
        if (err) {
          console.warn("Retrying property insert with fallback payload:", err.message);
          const { data: d2, error: e2 } = await supabase.from("properties").insert({ id: savedId, ...fallbackPayload(payload) }).select("id").maybeSingle();
          if (e2) throw e2;
          if (d2?.id) savedId = d2.id;
        } else if (data?.id) {
          savedId = data.id;
        }
      }
      if (savedId) {
        await savePropertyFloors(currentCompany.id, savedId, formFloors);
        localStorage.setItem(`cc_prop_photos_${savedId}`, JSON.stringify(formPhotos));

        // Sync discount across all individual rooms & listings if requested
        if (propDiscountApplyToRooms) {
          try {
            await supabase.from("commercial_rooms").update({
              discount_percentage: pct,
              discount_start_date: form.discountStartDate || null,
              discount_end_date: form.discountEndDate || null,
            }).eq("property_id", savedId);
            await supabase.from("room_type_listings").update({
              discount_percentage: pct,
              discount_start_date: form.discountStartDate || null,
              discount_end_date: form.discountEndDate || null,
            }).eq("property_id", savedId);
          } catch (syncErr) {
            console.warn("Could not sync discount to rooms/listings:", syncErr);
          }
        }

        // Sync booking channel across all individual rooms & listings if requested
        if (propBookingChannelApplyToRooms) {
          try {
            await supabase.from("commercial_rooms").update({
              booking_mode: form.bookingMode || "platform",
              external_booking_url: form.bookingMode === "external" ? (form.externalBookingUrl?.trim() || null) : null,
            }).eq("property_id", savedId);
            await supabase.from("room_type_listings").update({
              booking_mode: form.bookingMode || "platform",
              external_booking_url: form.bookingMode === "external" ? (form.externalBookingUrl?.trim() || null) : null,
            }).eq("property_id", savedId);
          } catch (syncErr) {
            console.warn("Could not sync booking channel to rooms/listings:", syncErr);
          }
        }
      }
      setModalOpen(false);
      reload();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (row: PropertyRow) => {
    if (isHospitality(row.type)) {
      alert("Hospitality properties cannot be published as a whole. Please publish specific room types under Showcase → Room Bookings.");
      return;
    }

    if (row.isPublished) {
      setPublishingId(row.id);
      try {
        await supabase.from("properties").update({ is_published: false }).eq("id", row.id);
        setProperties((prev) => prev.map((p) => p.id === row.id ? { ...p, isPublished: false } : p));
        if (viewTarget?.id === row.id) setViewTarget((prev) => prev ? { ...prev, isPublished: false } : null);
      } catch {
        alert("Failed to unpublish property.");
      } finally {
        setPublishingId(null);
      }
      return;
    }

    // Publishing: if occupied, prompt user for date and month it will become vacant
    if (row.status !== "vacant") {
      setPublishPromptTarget(row);
      setPublishVacancyDate(row.availableFrom || "");
      setPublishPromptError(null);
      setPublishPromptOpen(true);
      return;
    }

    // Vacant property: publish directly
    setPublishingId(row.id);
    try {
      await supabase.from("properties").update({ is_published: true }).eq("id", row.id);
      setProperties((prev) => prev.map((p) => p.id === row.id ? { ...p, isPublished: true } : p));
      if (viewTarget?.id === row.id) setViewTarget((prev) => prev ? { ...prev, isPublished: true } : null);
    } catch {
      alert("Failed to publish property.");
    } finally {
      setPublishingId(null);
    }
  };

  const handleConfirmPublishOccupied = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publishPromptTarget) return;
    if (!publishVacancyDate) {
      setPublishPromptError("Please select the date and month this property will become vacant.");
      return;
    }

    setPublishPromptLoading(true);
    setPublishPromptError(null);
    try {
      const updatePayload: Record<string, any> = {
        is_published: true,
        available_from: publishVacancyDate,
      };

      const { error: err } = await supabase.from("properties").update(updatePayload).eq("id", publishPromptTarget.id);
      if (err) {
        const { error: fErr } = await supabase.from("properties").update({ is_published: true }).eq("id", publishPromptTarget.id);
        if (fErr) throw fErr;
      }

      setProperties((prev) =>
        prev.map((p) =>
          p.id === publishPromptTarget.id
            ? { ...p, isPublished: true, availableFrom: publishVacancyDate }
            : p
        )
      );
      if (viewTarget?.id === publishPromptTarget.id) {
        setViewTarget((prev) => prev ? { ...prev, isPublished: true, availableFrom: publishVacancyDate } : null);
      }

      setPublishPromptOpen(false);
      setPublishPromptTarget(null);
      setPublishVacancyDate("");
    } catch (err) {
      setPublishPromptError(err instanceof Error ? err.message : "Failed to publish property.");
    } finally {
      setPublishPromptLoading(false);
    }
  };

  const handleTriggerDeleteProperty=(row:PropertyRow)=>{setDeleteTarget(row);setPinDialogForProperty(true);};
  const confirmDeleteProperty=async()=>{
    if(!deleteTarget)return; setDeleting(true);
    try{const {error:err}=await supabase.from("properties").delete().eq("id",deleteTarget.id);if(err)throw err;setDeleteTarget(null);reload();}
    catch(e){alert(e instanceof Error?e.message:"Delete failed");}finally{setDeleting(false);}
  };

  const filterTabs=[{key:"all",label:"All Properties",count:statusCounts.all},{key:"hospitality",label:"🏨 Hospitality",count:statusCounts.hospitality},{key:"rental",label:"🏠 Rental",count:statusCounts.rental},{key:"occupied",label:"Occupied",count:statusCounts.occupied},{key:"vacant",label:"Vacant",count:statusCounts.vacant}];

  return (
    <ModulePage title={`Properties (${currentCompany.name})`} description="Manage rental and hospitality properties.">
      {loading&&<LoadingState label="Loading properties..."/>}
      {!loading&&error&&<ErrorState message={error} onRetry={reload}/>}
      {!loading&&!error&&(
        <section className="rounded-2xl border border-border-color bg-surface p-1 shadow-sm">
          <div className="p-4">
            <DataTableHeader searchValue={searchQuery} onSearchChange={setSearchQuery} searchPlaceholder="Search by name, city, country..." filters={filterTabs} activeFilter={activeFilter} onFilterChange={setActiveFilter}
              actions={<button type="button" onClick={openAdd} className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition"><Plus size={16}/><span>Add Property</span></button>}
            />
          </div>
          {filtered.length===0?(
            <div className="p-12"><EmptyState title="No properties found" description={searchQuery?"Try a different search.":"Add a property to get started."}/></div>
          ):(
            <div className="overflow-x-auto">
              <table className="min-w-full border-collapse text-sm">
                <thead><tr className="border-b border-border-color text-left text-muted uppercase text-[10px] font-bold tracking-wider">
                  <th className="px-6 py-4">Property</th><th className="px-6 py-4">Type</th><th className="px-6 py-4">Units</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Pricing</th><th className="px-6 py-4 text-right">Actions</th>
                </tr></thead>
                <tbody className="divide-y divide-border-color/40">
                  {filtered.map((row)=>{
                    const hosp=isHospitality(row.type);
                    return (
                      <tr key={row.id} onClick={()=>navigate(`/properties/${row.id}`)} className="group cursor-pointer hover:bg-surface-elevated/40 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white ${hosp?"bg-purple-600":"bg-blue-600"}`}>
                              {hosp?<BedDouble size={20}/>:<Building2 size={20}/>}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-bold text-foreground truncate">{row.name}</p>
                                {row.isPublished&&<span className="shrink-0 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-bold text-green-600 uppercase">Live</span>}
                                {row.bookingMode === "external" && (
                                  <span className="shrink-0 rounded-full bg-indigo-500/15 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                                    <ExternalLink size={10} /> Direct Link
                                  </span>
                                )}
                                {row.discountPercentage && row.discountPercentage > 0 ? (
                                  <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-0.5">
                                    <Sparkles size={10} /> -{row.discountPercentage}%
                                  </span>
                                ) : null}
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted"><MapPin size={10}/><span className="truncate">{[row.address,row.city,row.country].filter(Boolean).join(", ")}</span></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4"><div className="flex flex-col gap-1"><span className="font-semibold capitalize text-foreground">{row.type.replace(/_/g," ")}</span><span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase w-fit ${hosp?"bg-purple-500/10 text-purple-600":"bg-blue-500/10 text-blue-600"}`}>{hosp?"Hospitality":"Rental"}</span></div></td>
                        <td className="px-6 py-4 text-xs font-semibold text-muted">{hosp?`${row.totalRooms||0} Rooms`:"Single Unit"}</td>
                        <td className="px-6 py-4">
                          {hosp ? (
                            <div className="flex flex-col gap-1">
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-[10px] font-bold text-blue-600 border border-blue-500/20 w-fit">
                                <BedDouble size={11} /> {row.totalRooms || 0} Total Rooms
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setStatsProperty(row);
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-600 hover:text-purple-700 hover:underline"
                              >
                                <TrendingUp size={12} />
                                <span>Stats &amp; Reports</span>
                              </button>
                            </div>
                          ) : (
                            <StatusBadge status={row.status}/>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right font-bold text-foreground">
                          {row.discountPercentage && row.discountPercentage > 0 ? (
                            <div>
                              <span className="text-xs text-muted line-through mr-1.5 block sm:inline">
                                {hosp ? formatCurrency(row.defaultRoomPrice || 0) : formatCurrency(row.monthlyRent)}
                              </span>
                              <span className="text-amber-600 font-extrabold">
                                {hosp
                                  ? `From ${formatCurrency(Math.round((row.defaultRoomPrice || 0) * (1 - row.discountPercentage / 100)))}/night`
                                  : `${formatCurrency(Math.round(row.monthlyRent * (1 - row.discountPercentage / 100)))}/mo`}
                              </span>
                            </div>
                          ) : (
                            hosp ? `From ${formatCurrency(row.defaultRoomPrice||0)}/night` : `${formatCurrency(row.monthlyRent)}/mo`
                          )}
                        </td>
                        <td className="px-6 py-4" onClick={(e)=>e.stopPropagation()}>
                          <TableRowActions>
                            <TableActionButton icon={Eye} label="View" onClick={()=>setViewTarget(row)}/>
                            {hosp && (
                              <TableActionButton icon={KeyRound} label="Check In" onClick={()=>setCheckinPropertyId(row.id)}/>
                            )}
                            {hosp && (
                              <TableActionButton icon={TrendingUp} label="Stats" onClick={()=>setStatsProperty(row)}/>
                            )}
                            {!hosp && (
                              <TableActionButton icon={row.isPublished?EyeOff:Globe} label={row.isPublished?"Unpublish":"Publish"} onClick={()=>handleTogglePublish(row)} disabled={publishingId===row.id}/>
                            )}
                            <TableActionButton icon={Pencil} label="Edit" onClick={()=>openEdit(row)}/>
                            <TableActionButton icon={Trash} label="Delete" variant="danger" onClick={()=>handleTriggerDeleteProperty(row)}/>
                            <div className="ml-2 pl-2 border-l border-border-color/40"><ChevronRight size={18} className="text-muted/40 group-hover:text-foreground transition-all" onClick={()=>navigate(`/properties/${row.id}`)}/></div>
                          </TableRowActions>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* View Property Modal */}
      <Modal open={viewTarget!==null} onClose={()=>setViewTarget(null)} title={viewTarget?.name||"Property Details"}>
        {viewTarget&&(
          <div className="space-y-4">
            <ImageSlider images={viewTarget.photos||[]} alt={viewTarget.name} aspectRatio="video" showThumbnails/>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${isHospitality(viewTarget.type)?"bg-purple-500/10 text-purple-600":"bg-blue-500/10 text-blue-600"}`}>{isHospitality(viewTarget.type)?"Hospitality":"Rental"}</span>
              <span className="rounded-full bg-surface-elevated border border-border-color px-3 py-1 text-xs font-semibold capitalize">{viewTarget.type.replace(/_/g," ")}</span>
              <StatusBadge status={viewTarget.status}/>
              {viewTarget.isPublished&&<span className="rounded-full bg-green-500/15 px-3 py-1 text-xs font-bold text-green-600">Live on Portal</span>}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-surface-elevated/50 border border-border-color p-3"><p className="text-[10px] font-bold uppercase text-muted/60 mb-1">Address</p><div className="flex items-start gap-1.5"><MapPin size={13} className="mt-0.5 shrink-0 text-muted"/><span className="font-semibold text-foreground">{viewTarget.address||"—"}</span></div></div>
              {(viewTarget.city||viewTarget.country)&&(<div className="rounded-xl bg-surface-elevated/50 border border-border-color p-3"><p className="text-[10px] font-bold uppercase text-muted/60 mb-1">Location</p><div className="flex items-center gap-1.5"><Globe size={13} className="shrink-0 text-muted"/><span className="font-semibold text-foreground">{[viewTarget.city,viewTarget.country].filter(Boolean).join(", ")}</span></div></div>)}
              <div className="rounded-xl bg-surface-elevated/50 border border-border-color p-3"><p className="text-[10px] font-bold uppercase text-muted/60 mb-1">{isHospitality(viewTarget.type)?"Rate":"Monthly Rent"}</p><div className="flex items-center gap-1.5"><DollarSign size={13} className="shrink-0 text-muted"/><span className="font-bold text-foreground">{isHospitality(viewTarget.type)?`${viewTarget.totalRooms||0} rooms from ${formatCurrency(viewTarget.defaultRoomPrice||0)}/night`:formatCurrency(viewTarget.monthlyRent)+"/month"}</span></div></div>
              {viewTarget.availableFrom && (
                <div className="rounded-xl bg-surface-elevated/50 border border-border-color p-3"><p className="text-[10px] font-bold uppercase text-muted/60 mb-1">Scheduled Vacancy</p><div className="flex items-center gap-1.5"><Calendar size={13} className="shrink-0 text-amber-500"/><span className="font-semibold text-foreground">{new Date(viewTarget.availableFrom).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</span></div></div>
              )}
            </div>
            {viewTarget.bookingMode === "external" && viewTarget.externalBookingUrl && (
              <div className="rounded-xl bg-indigo-500/10 border border-indigo-500/20 p-3 text-xs">
                <p className="font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5 mb-1">
                  <ExternalLink size={13} /> Direct External Booking Channel
                </p>
                <a
                  href={viewTarget.externalBookingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline truncate block font-mono text-[11px]"
                >
                  {viewTarget.externalBookingUrl}
                </a>
              </div>
            )}
            {viewTarget.discountPercentage && viewTarget.discountPercentage > 0 ? (
              <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs">
                <p className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5 mb-1">
                  <Sparkles size={13} /> Active Promotion: {viewTarget.discountPercentage}% Discount
                </p>
                <p className="text-muted text-[11px]">
                  {viewTarget.discountStartDate ? `From ${viewTarget.discountStartDate}` : "Immediate"} {viewTarget.discountEndDate ? `until ${viewTarget.discountEndDate}` : "ongoing"}
                </p>
              </div>
            ) : null}
            <div className="flex items-center justify-between pt-2 border-t border-border-color">
              <button type="button" onClick={()=>{setViewTarget(null);navigate(`/properties/${viewTarget.id}`);}} className="rounded-xl border border-border-color px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-elevated transition">Full Details →</button>
              <div className="flex gap-2">
                {!isHospitality(viewTarget.type) && (
                  <button type="button" onClick={()=>handleTogglePublish(viewTarget)} disabled={publishingId===viewTarget.id} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${viewTarget.isPublished?"bg-orange-500/10 text-orange-600 hover:bg-orange-500/20":"bg-green-500/10 text-green-600 hover:bg-green-500/20"}`}>{viewTarget.isPublished?"Unpublish":"Publish to Portal"}</button>
                )}
                <button type="button" onClick={()=>{const t=viewTarget;setViewTarget(null);openEdit(t);}} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 transition">Edit Property</button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Add / Edit Modal */}
      <Modal open={modalOpen} onClose={()=>setModalOpen(false)} title={editingId?"Edit Property":"Add Property"}>
        <div className="space-y-3.5 text-xs">
          <div><label className="mb-1 block font-medium text-foreground">Property Name *</label><input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} placeholder="e.g. Serengeti Luxury Lodge" className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600"/></div>
          <div><label className="mb-1 block font-medium text-foreground">Property Type *</label><select value={form.type} onChange={(e)=>setForm({...form,type:e.target.value})} className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600"><optgroup label="Hospitality"><option value="hotel">Hotel</option><option value="lodge">Safari Lodge</option><option value="motel">Motel</option><option value="guest_house">Guest House / B&B</option><option value="commercial">Commercial Complex</option></optgroup><optgroup label="Rental"><option value="house">Residential House</option><option value="apartment">Apartment</option><option value="storage">Storage Unit</option></optgroup></select></div>
          <div><label className="mb-1 block font-medium text-foreground">Street Address</label><input value={form.address} onChange={(e)=>setForm({...form,address:e.target.value})} placeholder="Street address or Plot #" className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600"/></div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-medium text-foreground">Country *</label>
              <select
                value={form.country}
                onChange={(e) => {
                  const c = e.target.value;
                  const firstCity = COUNTRIES_AND_CITIES[c]?.[0] || "";
                  setForm({
                    ...form,
                    country: c,
                    city: firstCity,
                  });
                  setIsCustomCity(c === "Other" || !firstCity);
                }}
                className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600"
                required
              >
                <option value="">— Select Country First —</option>
                {Object.keys(COUNTRIES_AND_CITIES).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block font-medium text-foreground">City *</label>
              <select
                value={isCustomCity ? "__custom__" : form.city}
                disabled={!form.country}
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    setIsCustomCity(true);
                    setForm({ ...form, city: "" });
                  } else {
                    setIsCustomCity(false);
                    setForm({ ...form, city: e.target.value });
                  }
                }}
                className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600 disabled:opacity-50"
                required
              >
                <option value="">
                  {!form.country ? "— Select Country First —" : "— Select City —"}
                </option>
                {availableCities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
                <option value="__custom__">+ Enter Custom City...</option>
              </select>
            </div>
          </div>

          {isCustomCity && (
            <div>
              <label className="mb-1 block font-medium text-foreground">Custom City Name *</label>
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Type city or town name"
                className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600"
                required
              />
            </div>
          )}

          {HOSPITALITY_TYPES.includes(form.type) ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-foreground">Total Rooms</label>
                  <input
                    type="number"
                    value={form.totalRooms}
                    onChange={(e) => setForm({ ...form, totalRooms: Number(e.target.value) })}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-foreground">Default Rate ({currency}/Night)</label>
                  <input
                    type="number"
                    value={form.defaultRoomPrice}
                    onChange={(e) => setForm({ ...form, defaultRoomPrice: Number(e.target.value) })}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-medium text-foreground">
                  Number of Floors *
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={floorCount}
                  onChange={(e) => {
                    const count = Math.max(1, Number(e.target.value) || 1);
                    setFloorCount(count);
                    const generated: string[] = [];
                    for (let i = 0; i < count; i++) {
                      if (i === 0) generated.push("Ground Floor");
                      else if (i === 1) generated.push("1st Floor");
                      else if (i === 2) generated.push("2nd Floor");
                      else if (i === 3) generated.push("3rd Floor");
                      else generated.push(`${i}th Floor`);
                    }
                    setFormFloors(generated);
                  }}
                  placeholder="e.g. 2, 6, 13"
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600"
                  required
                />
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {formFloors.map((fl) => (
                    <span
                      key={fl}
                      className="rounded-md bg-surface border border-border-color px-2 py-0.5 text-[10px] font-medium text-muted"
                    >
                      {fl}
                    </span>
                  ))}
                </div>
              </div>
            </>
          ):(
            <div className="space-y-3">
              <div><label className="mb-1 block font-medium text-foreground">Monthly Rent ({currency})</label><input type="number" value={form.monthlyRent} onChange={(e)=>setForm({...form,monthlyRent:Number(e.target.value)})} className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600"/></div>
              <div><label className="mb-1 block font-medium text-foreground">Available / Vacant From (Optional)</label><input type="date" value={form.availableFrom||""} onChange={(e)=>setForm({...form,availableFrom:e.target.value})} className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600"/><p className="text-[10px] text-muted mt-0.5">Required before publishing occupied properties to the public portal.</p></div>
            </div>
          )}

          {/* Booking Channel Selection */}
          <div className="rounded-xl border border-border-color bg-surface-elevated/40 p-3.5 space-y-2.5">
            <label className="block font-bold text-foreground">Booking &amp; Reservation Channel</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm({ ...form, bookingMode: "platform" })}
                className={`flex flex-col gap-0.5 rounded-xl border p-2.5 text-left transition ${
                  form.bookingMode === "platform"
                    ? "border-blue-600 bg-blue-600/10 text-blue-700 dark:text-blue-400 font-semibold"
                    : "border-border-color bg-surface text-muted hover:border-blue-400/50"
                }`}
              >
                <span className="text-xs font-bold text-foreground">🏨 Paimbabook Platform</span>
                <span className="text-[10px] text-muted">Process reservations, enquiries &amp; check-ins here</span>
              </button>

              <button
                type="button"
                onClick={() => setForm({ ...form, bookingMode: "external" })}
                className={`flex flex-col gap-0.5 rounded-xl border p-2.5 text-left transition ${
                  form.bookingMode === "external"
                    ? "border-indigo-600 bg-indigo-600/10 text-indigo-700 dark:text-indigo-400 font-semibold"
                    : "border-border-color bg-surface text-muted hover:border-indigo-400/50"
                }`}
              >
                <span className="text-xs font-bold text-foreground flex items-center gap-1">
                  <ExternalLink size={12} /> Custom Booking Link
                </span>
                <span className="text-[10px] text-muted">Redirect to own website, affiliate or external URL</span>
              </button>
            </div>

            {form.bookingMode === "external" && (
              <div className="pt-1.5 space-y-1">
                <label className="text-[11px] font-semibold text-foreground">External Booking URL *</label>
                <input
                  type="url"
                  value={form.externalBookingUrl}
                  onChange={(e) => setForm({ ...form, externalBookingUrl: e.target.value })}
                  placeholder="https://example.com/book or affiliate link"
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-indigo-600"
                  required
                />
                <p className="text-[10px] text-muted">
                  Guests clicking &quot;Book&quot; on the public portal will be redirected to this link.
                </p>
              </div>
            )}

            {/* Apply channel to all rooms */}
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={propBookingChannelApplyToRooms}
                onChange={(e) => setPropBookingChannelApplyToRooms(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border-color text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-semibold text-muted">
                Apply this channel across all individual rooms of this property
              </span>
            </label>
          </div>

          {/* Promotional Discount Section */}
          <div className="rounded-xl border border-border-color bg-surface-elevated/40 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                  <Sparkles size={14} className="text-amber-500" />
                  <span>Promotional Discount (Optional)</span>
                </label>
                <span className="text-[10px] text-muted">Drag the bar to set a discount percentage</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-xl font-black text-amber-600 dark:text-amber-400">
                  {form.discountPercentage || 0}%
                </span>
                {Number(form.discountPercentage) > 0 ? (
                  <span className="text-xs font-bold text-amber-600">OFF</span>
                ) : (
                  <span className="text-xs font-semibold text-muted">(Off)</span>
                )}
              </div>
            </div>

            {/* Movable Slider Bar from 5% to 100% */}
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={form.discountPercentage || 0}
              onChange={(e) => {
                setForm({ ...form, discountPercentage: Number(e.target.value) });
                setPropDiscountPinError(null);
              }}
              className="w-full accent-amber-600 cursor-pointer h-2 bg-border-color rounded-lg appearance-none"
            />
            <div className="flex justify-between text-[10px] text-muted font-semibold px-0.5">
              <span>0% (Off)</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100% (Free)</span>
            </div>

            {/* Quick Presets */}
            <div className="flex flex-wrap gap-1.5">
              {[0, 5, 10, 15, 20, 25, 30, 50, 75].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => {
                    setForm({ ...form, discountPercentage: pct });
                    setPropDiscountPinError(null);
                  }}
                  className={`rounded-lg px-2 py-0.5 text-xs font-bold transition ${
                    (form.discountPercentage || 0) === pct
                      ? "bg-amber-600 text-white shadow-xs"
                      : "border border-border-color bg-surface text-muted hover:border-amber-500 hover:text-amber-600"
                  }`}
                >
                  {pct === 0 ? "Off (0%)" : `${pct}%`}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1">
              <div>
                <label className="text-[10px] font-medium text-foreground block mb-1">Start Date</label>
                <input
                  type="date"
                  value={form.discountStartDate}
                  onChange={(e) => setForm({ ...form, discountStartDate: e.target.value })}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-2 py-2 text-foreground outline-none focus:border-amber-500 text-xs"
                />
              </div>
              <div>
                <label className="text-[10px] font-medium text-foreground block mb-1">End Date</label>
                <input
                  type="date"
                  value={form.discountEndDate}
                  onChange={(e) => setForm({ ...form, discountEndDate: e.target.value })}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-2 py-2 text-foreground outline-none focus:border-amber-500 text-xs"
                />
              </div>
            </div>

            {/* Apply to rooms checkbox */}
            <label className="flex items-center gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={propDiscountApplyToRooms}
                onChange={(e) => setPropDiscountApplyToRooms(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border-color text-amber-600 focus:ring-amber-500"
              />
              <span className="text-xs font-semibold text-muted">
                Apply this promotional discount across all individual rooms of this property
              </span>
            </label>

            {/* PIN Confirmation Box if discount > 0 */}
            {Number(form.discountPercentage) > 0 && (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2">
                <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold text-xs">
                  <KeyRound size={13} />
                  <span>Security PIN Confirmation Required</span>
                </div>
                <p className="text-[11px] text-muted leading-tight">
                  Confirm setting <strong>{form.discountPercentage}% discount</strong> on <strong>{form.name || "this property"}</strong>{propDiscountApplyToRooms ? " and across all its rooms" : ""}. Enter PIN (default 1234):
                </p>
                <input
                  type="password"
                  maxLength={8}
                  value={propDiscountPin}
                  onChange={(e) => {
                    setPropDiscountPin(e.target.value);
                    setPropDiscountPinError(null);
                  }}
                  placeholder="Security PIN"
                  className="w-full rounded-xl border border-border-color bg-surface px-3 py-1.5 text-xs text-foreground tracking-widest outline-none focus:border-amber-500"
                />
                {propDiscountPinError && (
                  <p className="text-xs text-red-600 font-semibold flex items-center gap-1">
                    <X size={12} /> {propDiscountPinError}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border-color bg-surface-elevated/40 p-3 space-y-2.5"><div className="flex items-center justify-between"><label className="font-bold text-foreground flex items-center gap-1.5"><ImageIcon size={14} className="text-emerald-600"/><span>Photos ({formPhotos.length})</span></label><div className="flex items-center gap-2"><input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" multiple className="hidden" id="property-photo-upload"/><label htmlFor="property-photo-upload" className={`inline-flex items-center gap-1.5 cursor-pointer rounded-lg bg-surface border border-border-color px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-surface-elevated ${uploadingPhoto?"opacity-50 pointer-events-none":""}`}>{uploadingPhoto?<Loader2 size={12} className="animate-spin"/>:<Plus size={12}/>}<span>{uploadingPhoto?"Uploading...":"Upload"}</span></label></div></div>{formPhotos.length===0?(<p className="text-[11px] text-muted italic py-1">No photos yet.</p>):(<div className="grid grid-cols-4 gap-2 pt-1">{formPhotos.map((url,idx)=>(<div key={idx} className="group relative aspect-video rounded-lg overflow-hidden border border-border-color bg-black/10"><img src={url} alt={`${idx+1}`} className="h-full w-full object-cover"/><button type="button" onClick={()=>promptDeletePhoto(idx)} className="absolute top-1 right-1 rounded-md bg-black/70 p-1 text-white hover:bg-red-600 opacity-0 group-hover:opacity-100 transition"><Trash size={12}/></button></div>))}</div>)}</div>
          <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={()=>setModalOpen(false)} className="rounded-xl border border-border-color px-3.5 py-1.5 text-muted hover:bg-surface-elevated">Cancel</button><button type="button" onClick={onSave} disabled={saving} className="rounded-xl bg-blue-600 px-5 py-1.5 font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50">{saving?"Saving...":"Save Property"}</button></div>
        </div>
      </Modal>

      {/* Occupied Listing Vacancy Date Prompt Modal */}
      <Modal
        open={publishPromptOpen}
        onClose={() => { if (!publishPromptLoading) { setPublishPromptOpen(false); setPublishPromptTarget(null); } }}
        title="Scheduled Vacancy Date Required"
      >
        <form onSubmit={handleConfirmPublishOccupied} className="space-y-4">
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-3 text-xs text-amber-700 dark:text-amber-400">
            <p className="font-semibold mb-1">
              Publishing Occupied Property: {publishPromptTarget?.name}
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
              value={publishVacancyDate}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => setPublishVacancyDate(e.target.value)}
              className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground outline-none focus:border-blue-600"
            />
            <p className="text-[11px] text-muted mt-1">
              Visitors on the main portal will see: <strong>Occupied · Available [Date]</strong>
            </p>
          </div>

          {publishPromptError && (
            <p className="text-xs text-red-500">{publishPromptError}</p>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-border-color">
            <button
              type="button"
              disabled={publishPromptLoading}
              onClick={() => { setPublishPromptOpen(false); setPublishPromptTarget(null); }}
              className="rounded-xl border border-border-color px-4 py-2 text-xs font-semibold text-muted hover:bg-surface-elevated"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={publishPromptLoading || !publishVacancyDate}
              className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {publishPromptLoading && <Loader2 size={13} className="animate-spin" />}
              <span>{publishPromptLoading ? "Publishing..." : "Confirm & Publish"}</span>
            </button>
          </div>
        </form>
      </Modal>

      <PinPromptDialog isOpen={pinDialogForProperty} onClose={()=>{setPinDialogForProperty(false);setDeleteTarget(null);}} onSuccess={confirmDeleteProperty} title={`Delete "${deleteTarget?.name}"`} description="This will permanently remove this property." actionLabel="Verify PIN & Delete" actionVariant="danger"/>
      <PinPromptDialog isOpen={pinDialogForPhoto} onClose={()=>{setPinDialogForPhoto(false);setPhotoToDeleteIndex(null);}} onSuccess={confirmDeletePhoto} title="Delete Photo" description="Enter PIN to delete this photo." actionLabel="Verify PIN & Delete" actionVariant="danger"/>

      <PropertyStatsModal
        isOpen={statsProperty !== null}
        onClose={() => setStatsProperty(null)}
        property={statsProperty || { id: "", name: "", type: "" }}
      />

      <CheckinModal
        isOpen={Boolean(checkinPropertyId)}
        onClose={() => setCheckinPropertyId(null)}
        initialPropertyId={checkinPropertyId || undefined}
        onSuccess={reload}
      />
    </ModulePage>
  );
}