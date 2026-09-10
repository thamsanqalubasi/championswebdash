import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ModulePage } from "@/components/module-page";
import { EmptyState, ErrorState, LoadingState } from "@/components/data-state";
import { Modal } from "@/components/modal";
import { PinPromptDialog } from "@/components/pin-dialog";
import { ImageSlider } from "@/components/image-slider";
import { fetchProperties, isValidUuid, fetchPropertyFloors, savePropertyFloors, generateUuid } from "@/lib/data";
import { uploadFileToBucket } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import type { PropertyRow } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { Plus, Pencil, Trash, ChevronRight, Building2, BedDouble, X, Layers, Image as ImageIcon, Loader2, Eye, Globe, EyeOff, MapPin, DollarSign } from "lucide-react";
import { DataTableHeader, StatusBadge, TableRowActions, TableActionButton } from "@/components/data-table";
import { useCurrency } from "@/lib/currency";




const HOSPITALITY_TYPES = ["hotel", "motel", "lodge", "guest_house", "commercial"];
const RENTAL_TYPES = ["house", "apartment", "storage"];
function isHospitality(type: string) { return HOSPITALITY_TYPES.includes(type); }

const emptyForm = { name: "", type: "lodge", address: "", city: "", country: "", status: "occupied", monthlyRent: 0, totalRooms: 10, defaultRoomPrice: 1200, defaultBedBreakfast: 1500 };

export default function PropertiesPage() {
  const navigate = useNavigate();
  const { currentCompany } = useAuth();
  const { format: formatCurrency } = useCurrency();
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activeFilter, setActiveFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PropertyRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [viewTarget, setViewTarget] = useState<PropertyRow | null>(null);
  const [formFloors, setFormFloors] = useState<string[]>(["Ground Floor", "1st Floor", "2nd Floor"]);
  const [newFloorInput, setNewFloorInput] = useState("");
  const [formPhotos, setFormPhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pinDialogForProperty, setPinDialogForProperty] = useState(false);
  const [photoToDeleteIndex, setPhotoToDeleteIndex] = useState<number | null>(null);
  const [pinDialogForPhoto, setPinDialogForPhoto] = useState(false);

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

  const openAdd = () => { setEditingId(null); setForm(emptyForm); setFormFloors(["Ground Floor","1st Floor","2nd Floor"]); setFormPhotos([]); setModalOpen(true); };
  const openEdit = (row: PropertyRow) => {
    setEditingId(row.id);
    setForm({ name: row.name, type: row.type, address: row.address, city: row.city||"", country: row.country||"", status: row.status, monthlyRent: row.monthlyRent, totalRooms: row.totalRooms||0, defaultRoomPrice: row.defaultRoomPrice||0, defaultBedBreakfast: row.defaultBedBreakfast||0 });
    setFormPhotos(row.photos||[]); fetchPropertyFloors(currentCompany.id, row.id).then(setFormFloors); setModalOpen(true);
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
    if(!form.name.trim())return; setSaving(true);
    try {
      const payload: Record<string,unknown> = { name:form.name, type:form.type, address:form.address, city:form.city, country:form.country, status:form.status, monthly_rent:form.monthlyRent, total_rooms:form.totalRooms, default_room_price:form.defaultRoomPrice, default_bed_breakfast:form.defaultBedBreakfast, company_id:currentCompany?.id&&isValidUuid(currentCompany.id)?currentCompany.id:null };
      if(formPhotos.length>0)payload.photos=formPhotos;
      let savedId=editingId;
      if(editingId){
        const {error:err}=await supabase.from("properties").update(payload).eq("id",editingId);
        if(err){const sp={...payload};delete sp.photos;delete sp.city;delete sp.country;const {error:e2}=await supabase.from("properties").update(sp).eq("id",editingId);if(e2)throw e2;}
      } else {
        savedId=generateUuid();
        const {data,error:err}=await supabase.from("properties").insert({id:savedId,...payload}).select("id").maybeSingle();
        if(err){const sp={...payload};delete sp.photos;delete sp.city;delete sp.country;const {data:d2,error:e2}=await supabase.from("properties").insert({id:savedId,...sp}).select("id").maybeSingle();if(e2)throw e2;if(d2?.id)savedId=d2.id;}
        else if(data?.id)savedId=data.id;
      }
      if(savedId){await savePropertyFloors(currentCompany.id,savedId,formFloors);localStorage.setItem(`cc_prop_photos_${savedId}`,JSON.stringify(formPhotos));}
      setModalOpen(false);reload();
    } catch(e){alert(e instanceof Error?e.message:"Save failed");}
    finally{setSaving(false);}
  };

  const handleTogglePublish = async (row: PropertyRow) => {
    setPublishingId(row.id);
    try { const nv=!row.isPublished; await supabase.from("properties").update({is_published:nv}).eq("id",row.id); setProperties((prev)=>prev.map((p)=>p.id===row.id?{...p,isPublished:nv}:p)); }
    catch{} finally{setPublishingId(null);}
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
                              <div className="flex items-center gap-2"><p className="font-bold text-foreground truncate">{row.name}</p>{row.isPublished&&<span className="shrink-0 rounded-full bg-green-500/15 px-2 py-0.5 text-[10px] font-bold text-green-600 uppercase">Live</span>}</div>
                              <div className="flex items-center gap-1 text-xs text-muted"><MapPin size={10}/><span className="truncate">{[row.address,row.city,row.country].filter(Boolean).join(", ")}</span></div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4"><div className="flex flex-col gap-1"><span className="font-semibold capitalize text-foreground">{row.type.replace(/_/g," ")}</span><span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase w-fit ${hosp?"bg-purple-500/10 text-purple-600":"bg-blue-500/10 text-blue-600"}`}>{hosp?"Hospitality":"Rental"}</span></div></td>
                        <td className="px-6 py-4 text-xs font-semibold text-muted">{hosp?`${row.totalRooms||0} Rooms`:"Single Unit"}</td>
                        <td className="px-6 py-4"><StatusBadge status={row.status}/></td>
                        <td className="px-6 py-4 text-right font-bold text-foreground">{hosp?`From ${formatCurrency(row.defaultRoomPrice||0)}/night`:`${formatCurrency(row.monthlyRent)}/mo`}</td>
                        <td className="px-6 py-4" onClick={(e)=>e.stopPropagation()}>
                          <TableRowActions>
                            <TableActionButton icon={Eye} label="View" onClick={()=>setViewTarget(row)}/>
                            <TableActionButton icon={row.isPublished?EyeOff:Globe} label={row.isPublished?"Unpublish":"Publish"} onClick={()=>handleTogglePublish(row)} disabled={publishingId===row.id}/>
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
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border-color">
              <button type="button" onClick={()=>{setViewTarget(null);navigate(`/properties/${viewTarget.id}`);}} className="rounded-xl border border-border-color px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-elevated transition">Full Details →</button>
              <div className="flex gap-2">
                <button type="button" onClick={()=>handleTogglePublish(viewTarget)} disabled={publishingId===viewTarget.id} className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${viewTarget.isPublished?"bg-orange-500/10 text-orange-600 hover:bg-orange-500/20":"bg-green-500/10 text-green-600 hover:bg-green-500/20"}`}>{viewTarget.isPublished?"Unpublish":"Publish to Portal"}</button>
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
            <div><label className="mb-1 block font-medium text-foreground">City *</label><input value={form.city} onChange={(e)=>setForm({...form,city:e.target.value})} placeholder="e.g. Windhoek" className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600"/></div>
            <div><label className="mb-1 block font-medium text-foreground">Country *</label><input value={form.country} onChange={(e)=>setForm({...form,country:e.target.value})} placeholder="e.g. Namibia" className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600"/></div>
          </div>
          {HOSPITALITY_TYPES.includes(form.type)?(
            <>
              <div className="grid grid-cols-2 gap-3"><div><label className="mb-1 block font-medium text-foreground">Total Rooms</label><input type="number" value={form.totalRooms} onChange={(e)=>setForm({...form,totalRooms:Number(e.target.value)})} className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600"/></div><div><label className="mb-1 block font-medium text-foreground">Default Rate (ZAR/Night)</label><input type="number" value={form.defaultRoomPrice} onChange={(e)=>setForm({...form,defaultRoomPrice:Number(e.target.value)})} className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600"/></div></div>
              <div className="rounded-xl border border-border-color bg-surface-elevated/40 p-3 space-y-2.5"><div className="flex items-center justify-between"><label className="font-bold text-foreground flex items-center gap-1.5"><Layers size={14} className="text-blue-600"/><span>Floors ({formFloors.length})</span></label></div><div className="flex flex-wrap gap-1.5">{formFloors.map((fl)=>(<span key={fl} className="inline-flex items-center gap-1 rounded-lg bg-surface border border-border-color px-2.5 py-1 text-xs font-semibold text-foreground"><span>{fl}</span><button type="button" onClick={()=>handleRemoveFloor(fl)} className="text-muted hover:text-red-500 rounded p-0.5"><X size={12}/></button></span>))}</div><div className="flex items-center gap-2 pt-1"><input type="text" value={newFloorInput} onChange={(e)=>setNewFloorInput(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter"){e.preventDefault();handleAddFloor(e);}}} placeholder="e.g. 3rd Floor" className="flex-1 rounded-lg border border-border-color bg-surface px-3 py-1.5 text-xs text-foreground outline-none focus:border-blue-600"/><button type="button" onClick={handleAddFloor} disabled={!newFloorInput.trim()} className="flex items-center gap-1 rounded-lg bg-surface border border-border-color px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-elevated disabled:opacity-40"><Plus size={13}/>Add</button></div></div>
            </>
          ):(
            <div><label className="mb-1 block font-medium text-foreground">Monthly Rent (ZAR)</label><input type="number" value={form.monthlyRent} onChange={(e)=>setForm({...form,monthlyRent:Number(e.target.value)})} className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground outline-none focus:border-blue-600"/></div>
          )}
          <div className="rounded-xl border border-border-color bg-surface-elevated/40 p-3 space-y-2.5"><div className="flex items-center justify-between"><label className="font-bold text-foreground flex items-center gap-1.5"><ImageIcon size={14} className="text-emerald-600"/><span>Photos ({formPhotos.length})</span></label><div className="flex items-center gap-2"><input type="file" ref={fileInputRef} onChange={handlePhotoUpload} accept="image/*" multiple className="hidden" id="property-photo-upload"/><label htmlFor="property-photo-upload" className={`inline-flex items-center gap-1.5 cursor-pointer rounded-lg bg-surface border border-border-color px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-surface-elevated ${uploadingPhoto?"opacity-50 pointer-events-none":""}`}>{uploadingPhoto?<Loader2 size={12} className="animate-spin"/>:<Plus size={12}/>}<span>{uploadingPhoto?"Uploading...":"Upload"}</span></label></div></div>{formPhotos.length===0?(<p className="text-[11px] text-muted italic py-1">No photos yet.</p>):(<div className="grid grid-cols-4 gap-2 pt-1">{formPhotos.map((url,idx)=>(<div key={idx} className="group relative aspect-video rounded-lg overflow-hidden border border-border-color bg-black/10"><img src={url} alt={`${idx+1}`} className="h-full w-full object-cover"/><button type="button" onClick={()=>promptDeletePhoto(idx)} className="absolute top-1 right-1 rounded-md bg-black/70 p-1 text-white hover:bg-red-600 opacity-0 group-hover:opacity-100 transition"><Trash size={12}/></button></div>))}</div>)}</div>
          <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={()=>setModalOpen(false)} className="rounded-xl border border-border-color px-3.5 py-1.5 text-muted hover:bg-surface-elevated">Cancel</button><button type="button" onClick={onSave} disabled={saving} className="rounded-xl bg-blue-600 px-5 py-1.5 font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50">{saving?"Saving...":"Save Property"}</button></div>
        </div>
      </Modal>

      <PinPromptDialog isOpen={pinDialogForProperty} onClose={()=>{setPinDialogForProperty(false);setDeleteTarget(null);}} onSuccess={confirmDeleteProperty} title={`Delete "${deleteTarget?.name}"`} description="This will permanently remove this property." actionLabel="Verify PIN & Delete" actionVariant="danger"/>
      <PinPromptDialog isOpen={pinDialogForPhoto} onClose={()=>{setPinDialogForPhoto(false);setPhotoToDeleteIndex(null);}} onSuccess={confirmDeletePhoto} title="Delete Photo" description="Enter PIN to delete this photo." actionLabel="Verify PIN & Delete" actionVariant="danger"/>
    </ModulePage>
  );
}