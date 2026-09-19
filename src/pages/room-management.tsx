import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  BedDouble,
  Plus,
  Edit2,
  Trash2,
  Sparkles,
  Utensils,
  Brush,
  Clock,
  CheckCircle2,
  Building2,
  Sliders,
  DollarSign,
  Coffee,
  CheckCheck,
  AlertCircle,
  Wifi,
  Tv,
  Wind,
  Sun,
  Wine,
  Bath,
  Bell,
  Shield,
  Image as ImageIcon,
  X,
  Loader2,
  Lock,
  ExternalLink,
  KeyRound,
} from "lucide-react";
import {
  fetchCommercialRooms,
  fetchProperties,
  saveCommercialRoom,
  setUniformRoomPricing,
  fetchHousekeepingSchedules,
  updateHousekeepingStatus,
  fetchRoomServiceSchedules,
  createRoomServiceOrder,
  fetchPropertyFloors,
  savePropertyFloors,
  deleteCommercialRoom,
  verifyUserPin,
} from "@/lib/data";
import { uploadFileToBucket } from "@/lib/storage";
import { PinPromptDialog } from "@/components/pin-dialog";
import type {
  CommercialRoom,
  PropertyRow,
  RoomType,
  HousekeepingSchedule,
  RoomServiceSchedule,
} from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";

export const AVAILABLE_AMENITIES = [
  { key: "wifi", label: "Free Wi-Fi", icon: Wifi },
  { key: "tv", label: "Smart TV", icon: Tv },
  { key: "ac", label: "Air Conditioning", icon: Wind },
  { key: "balcony", label: "Balcony / Terrace", icon: Sun },
  { key: "minibar", label: "Mini Bar / Fridge", icon: Wine },
  { key: "ensuite", label: "En-Suite Bathroom", icon: Bath },
  { key: "room_service", label: "Room Service", icon: Bell },
  { key: "safe", label: "In-Room Safe", icon: Shield },
];

export default function RoomManagementPage() {
  const { currentCompany, currentCompanyUser } = useAuth();
  const { currency, symbol } = useCurrency();
  const [activeTab, setActiveTab] = useState<"rooms" | "pricing" | "housekeeping" | "roomservice">("rooms");

  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [rooms, setRooms] = useState<CommercialRoom[]>([]);
  const [housekeeping, setHousekeeping] = useState<HousekeepingSchedule[]>([]);
  const [roomServices, setRoomServices] = useState<RoomServiceSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  // Property floors state
  const [propertyFloors, setPropertyFloors] = useState<string[]>(["Ground Floor", "1st Floor", "2nd Floor"]);
  const [showNewFloorInput, setShowNewFloorInput] = useState(false);
  const [newFloorName, setNewFloorName] = useState("");

  // Add / Edit Room Modal State
  const [roomModalOpen, setRoomModalOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<CommercialRoom | null>(null);
  const [roomNumber, setRoomNumber] = useState("");
  const [roomType, setRoomType] = useState<RoomType>("standard");
  const [floor, setFloor] = useState("Ground Floor");
  const [capacityAdults, setCapacityAdults] = useState(2);
  const [capacityChildren, setCapacityChildren] = useState(0);
  const [pricePerNight, setPricePerNight] = useState(950);
  const [priceBedBreakfast, setPriceBedBreakfast] = useState(1250);
  const [priceBedLunch, setPriceBedLunch] = useState(1550);
  const [priceFullBoard, setPriceFullBoard] = useState(1950);
  const [amenities, setAmenities] = useState<string[]>(["wifi", "tv", "ac", "ensuite"]);
  const [roomPhotos, setRoomPhotos] = useState<string[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [notes, setNotes] = useState("");
  const roomPhotoInputRef = useRef<HTMLInputElement | null>(null);

  // Booking Channel & Discounts State for Room
  const [bookingMode, setBookingMode] = useState<"platform" | "external">("platform");
  const [externalBookingUrl, setExternalBookingUrl] = useState("");
  const [discountPercentage, setDiscountPercentage] = useState(0);
  const [discountStartDate, setDiscountStartDate] = useState("");
  const [discountEndDate, setDiscountEndDate] = useState("");
  const [roomDiscountPin, setRoomDiscountPin] = useState("");
  const [roomDiscountPinError, setRoomDiscountPinError] = useState<string | null>(null);
  const [savingRoom, setSavingRoom] = useState(false);

  // PIN security states
  const [roomToDelete, setRoomToDelete] = useState<CommercialRoom | null>(null);
  const [pinDialogForRoom, setPinDialogForRoom] = useState(false);
  const [photoToDeleteIndex, setPhotoToDeleteIndex] = useState<number | null>(null);
  const [pinDialogForPhoto, setPinDialogForPhoto] = useState(false);

  // Uniform Pricing Form State
  const [uniBedOnly, setUniBedOnly] = useState(1000);
  const [uniBedBreakfast, setUniBedBreakfast] = useState(1300);
  const [uniBedLunch, setUniBedLunch] = useState(1600);
  const [uniFullBoard, setUniFullBoard] = useState(2000);
  const [uniSuccess, setUniSuccess] = useState(false);

  // Rights Checks: Admin, Manager, Accountant, or users with given rights can edit room pricing
  const isSuperAdminOrAdmin =
    currentCompanyUser?.roleLevel === "super_admin" ||
    currentCompanyUser?.roleLevel === "admin" ||
    currentCompanyUser?.department === "admin";
  const isManager =
    currentCompanyUser?.roleLevel === "manager" ||
    currentCompanyUser?.department === "manager";
  const isAccountant =
    currentCompanyUser?.department === "accountant";
  const hasAllRights =
    currentCompanyUser?.roleLevel === "all_rights" ||
    currentCompanyUser?.permissions?.all ||
    currentCompanyUser?.permissions?.manage_pricing ||
    currentCompanyUser?.permissions?.manage_finance;

  const canEditPricing = isSuperAdminOrAdmin || isManager || isAccountant || hasAllRights;
  const canDelete = isSuperAdminOrAdmin || isManager || hasAllRights;

  const loadData = async () => {
    setLoading(true);
    const props = await fetchProperties(currentCompany.id);
    setProperties(props);

    const accomm = props.filter((p) =>
      ["hotel", "motel", "lodge", "guest_house", "commercial"].includes(p.type?.toLowerCase() || "")
    );

    if (!selectedPropertyId && accomm.length > 0) {
      setSelectedPropertyId(accomm[0].id);
    }

    const rms = await fetchCommercialRooms(currentCompany.id, selectedPropertyId);
    const hk = await fetchHousekeepingSchedules(currentCompany.id);
    const rs = await fetchRoomServiceSchedules(currentCompany.id);
    const floors = await fetchPropertyFloors(currentCompany.id, selectedPropertyId);

    setRooms(rms);
    setHousekeeping(hk);
    setRoomServices(rs);
    setPropertyFloors(floors);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [currentCompany.id, selectedPropertyId]);

  const openAddRoom = () => {
    if (properties.length === 0 || !selectedPropertyId) {
      alert("All rooms must belong to an accommodation property (Hotel, Motel, Lodge, Guest House). Please create or select an accommodation property first.");
      return;
    }
    setEditingRoom(null);
    setRoomNumber(`Room ${rooms.length + 101}`);
    setRoomType("standard");
    setFloor(propertyFloors[0] || "Ground Floor");
    setCapacityAdults(2);
    setCapacityChildren(0);
    setPricePerNight(950);
    setPriceBedBreakfast(1250);
    setPriceBedLunch(1550);
    setPriceFullBoard(1950);
    setAmenities(["wifi", "tv", "ac", "ensuite"]);
    setRoomPhotos([]);
    setNotes("");
    setBookingMode("platform");
    setExternalBookingUrl("");
    setDiscountPercentage(0);
    setDiscountStartDate("");
    setDiscountEndDate("");
    setRoomDiscountPin("");
    setRoomDiscountPinError(null);
    setShowNewFloorInput(false);
    setRoomModalOpen(true);
  };

  const openEditRoom = (r: CommercialRoom) => {
    if (r.propertyId) {
      setSelectedPropertyId(r.propertyId);
    }
    setEditingRoom(r);
    setRoomNumber(r.roomNumber);
    setRoomType(r.roomType);
    setFloor(r.floor || propertyFloors[0] || "Ground Floor");
    setCapacityAdults(r.capacityAdults);
    setCapacityChildren(r.capacityChildren);
    setPricePerNight(r.pricePerNight);
    setPriceBedBreakfast(r.priceBedBreakfast);
    setPriceBedLunch(r.priceBedLunch);
    setPriceFullBoard(r.priceFullBoard);
    setAmenities(r.amenities || []);
    setRoomPhotos(r.photos || []);
    setNotes(r.notes || "");
    setBookingMode(r.bookingMode || "platform");
    setExternalBookingUrl(r.externalBookingUrl || "");
    setDiscountPercentage(r.discountPercentage || 0);
    setDiscountStartDate(r.discountStartDate || "");
    setDiscountEndDate(r.discountEndDate || "");
    setRoomDiscountPin("");
    setRoomDiscountPinError(null);
    setShowNewFloorInput(false);
    setRoomModalOpen(true);
  };

  const handleAddNewFloor = async () => {
    const trimmed = newFloorName.trim();
    if (!trimmed) return;
    const updated = Array.from(new Set([...propertyFloors, trimmed]));
    setPropertyFloors(updated);
    await savePropertyFloors(currentCompany.id, selectedPropertyId, updated);
    setFloor(trimmed);
    setNewFloorName("");
    setShowNewFloorInput(false);
  };

  const toggleAmenity = (key: string) => {
    setAmenities((prev) =>
      prev.includes(key) ? prev.filter((a) => a !== key) : [...prev, key]
    );
  };

  const handleRoomPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingPhoto(true);
    try {
      const targetId = editingRoom?.id || "new-room-photo";
      const newUrls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const url = await uploadFileToBucket("room-photos", targetId, files[i]);
        newUrls.push(url);
      }
      setRoomPhotos((prev) => [...prev, ...newUrls]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to upload room photo");
    } finally {
      setUploadingPhoto(false);
      if (roomPhotoInputRef.current) roomPhotoInputRef.current.value = "";
    }
  };

  const promptDeletePhoto = (idx: number) => {
    setPhotoToDeleteIndex(idx);
    setPinDialogForPhoto(true);
  };

  const confirmDeletePhoto = async () => {
    if (photoToDeleteIndex === null) return;
    const updated = roomPhotos.filter((_, i) => i !== photoToDeleteIndex);
    setRoomPhotos(updated);
    if (editingRoom?.id) {
      await saveCommercialRoom({
        id: editingRoom.id,
        photos: updated,
      });
    }
    setPhotoToDeleteIndex(null);
  };

  const handleTriggerDeleteRoom = (r: CommercialRoom) => {
    setRoomToDelete(r);
    setPinDialogForRoom(true);
  };

  const confirmDeleteRoom = async () => {
    if (!roomToDelete) return;
    await deleteCommercialRoom(roomToDelete.id);
    setRoomToDelete(null);
    loadData();
  };

  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPropertyId) {
      alert("Please select an accommodation property (Hotel, Motel, Lodge, Guest House) first. All rooms must belong to a property.");
      return;
    }
    if (!roomPhotos || roomPhotos.length === 0) {
      alert("Room photo is mandatory! Please upload at least one picture of the room before saving.");
      return;
    }
    if (bookingMode === "external" && !externalBookingUrl.trim()) {
      alert("Please enter a valid external booking URL for this room.");
      return;
    }
    const pct = Number(discountPercentage) || 0;
    if (pct > 0) {
      if (!roomDiscountPin.trim()) {
        setRoomDiscountPinError("Security PIN is required to activate a promotional discount.");
        return;
      }
      const isPinValid = await verifyUserPin(currentCompanyUser?.email || "", roomDiscountPin.trim());
      if (!isPinValid) {
        setRoomDiscountPinError("Incorrect security PIN. Default is 1234 if not yet configured.");
        return;
      }
    }

    setSavingRoom(true);
    try {
      await saveCommercialRoom({
        id: editingRoom?.id,
        companyId: currentCompany.id,
        propertyId: selectedPropertyId,
        roomNumber,
        roomType,
        floor,
        capacityAdults,
        capacityChildren,
        pricePerNight,
        priceBedBreakfast,
        priceBedLunch,
        priceFullBoard,
        amenities,
        photos: roomPhotos,
        notes,
        bookingMode,
        externalBookingUrl: externalBookingUrl.trim(),
        discountPercentage: pct,
        discountStartDate: discountStartDate || undefined,
        discountEndDate: discountEndDate || undefined,
      });
      setRoomModalOpen(false);
      await loadData();
    } catch (err) {
      alert("Could not save room: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSavingRoom(false);
    }
  };

  const handleApplyUniformPricing = async (e: React.FormEvent) => {
    e.preventDefault();
    await setUniformRoomPricing(selectedPropertyId, {
      pricePerNight: uniBedOnly,
      priceBedBreakfast: uniBedBreakfast,
      priceBedLunch: uniBedLunch,
      priceFullBoard: uniFullBoard,
    });
    setUniSuccess(true);
    setTimeout(() => setUniSuccess(false), 3000);
    loadData();
  };

  const handleHousekeepingStatus = async (id: string, status: HousekeepingSchedule["status"]) => {
    await updateHousekeepingStatus(id, status, currentCompanyUser.fullName);
    loadData();
  };

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Rooms & Commercial Lodging Sub-Management
          </h1>
          <p className="text-sm text-muted">
            Configure room inventory, 4-tier meal pricing, cleaning schedules, and room service.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {properties.length > 0 ? (
            <select
              value={selectedPropertyId}
              onChange={(e) => setSelectedPropertyId(e.target.value)}
              className="rounded-xl border border-border-color bg-surface px-4 py-2.5 text-sm font-semibold text-foreground focus:border-blue-600 focus:outline-none"
            >
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.type.replace(/_/g, " ").toUpperCase()})
                </option>
              ))}
            </select>
          ) : (
            <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-500/10 px-3 py-2 rounded-xl border border-amber-500/20">
              <AlertCircle size={14} />
              <span>No Accommodation Property</span>
            </div>
          )}

          {activeTab === "rooms" && (
            <button
              type="button"
              onClick={openAddRoom}
              disabled={properties.length === 0 || !selectedPropertyId}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              title={properties.length === 0 ? "All rooms must belong to an accommodation property. Add a property first." : "Add New Room"}
            >
              <Plus size={16} />
              <span>Add New Room</span>
            </button>
          )}
        </div>
      </div>

      {/* Short Accommodation Property Requirement Banner */}
      <div
        className={`rounded-2xl border p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-xs ${
          properties.length === 0
            ? "border-amber-400 bg-amber-500/10 text-amber-900 dark:text-amber-200"
            : "border-blue-200 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200"
        }`}
      >
        <div className="flex items-start sm:items-center gap-3">
          <Building2
            size={20}
            className={`shrink-0 mt-0.5 sm:mt-0 ${
              properties.length === 0 ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400"
            }`}
          />
          <div>
            <span className="font-bold text-sm block sm:inline mr-1.5">
              {properties.length === 0 ? "⚠️ Accommodation Property Required:" : "🏨 Accommodation Property Assignment:"}
            </span>
            <span>
              All rooms must belong to an accommodation property (Hotel, Motel, Lodge, Guest House, Commercial). Without selecting a property or having an accommodation property in the system, you cannot create or manage rooms.
            </span>
          </div>
        </div>
        {properties.length === 0 ? (
          <Link
            to="/properties"
            className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-700 transition"
          >
            <Plus size={14} /> Create Property First
          </Link>
        ) : (
          <div className="shrink-0 text-[11px] font-semibold bg-white/70 dark:bg-slate-900/70 px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300">
            Selected: <strong>{selectedProperty?.name}</strong> ({selectedProperty?.type.replace(/_/g, " ").toUpperCase()})
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border-color pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("rooms")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === "rooms"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-muted hover:bg-surface-elevated hover:text-foreground"
          }`}
        >
          <BedDouble size={16} />
          Rooms Directory ({rooms.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("pricing")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === "pricing"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-muted hover:bg-surface-elevated hover:text-foreground"
          }`}
        >
          <Sliders size={16} />
          Uniform & Board Pricing
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("housekeeping")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === "housekeeping"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-muted hover:bg-surface-elevated hover:text-foreground"
          }`}
        >
          <Brush size={16} />
          Housekeeping Queue ({housekeeping.filter((h) => h.status !== "verified").length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("roomservice")}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === "roomservice"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-muted hover:bg-surface-elevated hover:text-foreground"
          }`}
        >
          <Coffee size={16} />
          Room Service Orders ({roomServices.length})
        </button>
      </div>

      {/* TAB 1: ROOMS DIRECTORY */}
      {activeTab === "rooms" && (
        <>
          {properties.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-amber-500/30 bg-amber-500/5 p-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 mb-4">
                <Building2 size={28} />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">
                Accommodation Property Required
              </h3>
              <p className="max-w-md text-xs text-muted mb-5">
                All rooms must belong to an accommodation property (Hotel, Motel, Lodge, Guest House, Commercial).
                Without selecting a property or having an accommodation property in the system, you cannot create or manage rooms.
              </p>
              <Link
                to="/properties"
                className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-amber-700 transition"
              >
                <Plus size={16} /> Create Accommodation Property First
              </Link>
            </div>
          ) : rooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-color bg-surface p-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600 mb-4">
                <BedDouble size={28} />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">
                No Rooms Found in {selectedProperty?.name}
              </h3>
              <p className="max-w-md text-xs text-muted mb-5">
                Start adding room units to this accommodation property to manage availability, meal rates, and guest services.
              </p>
              <button
                type="button"
                onClick={openAddRoom}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition"
              >
                <Plus size={16} /> Add First Room
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rooms.map((r) => (
            <div
              key={r.id}
              className="rounded-2xl border border-border-color bg-surface overflow-hidden shadow-sm transition hover:shadow-md flex flex-col justify-between"
            >
              {r.photos && r.photos.length > 0 && (
                <div className="relative aspect-video w-full overflow-hidden bg-black/10 border-b border-border-color">
                  <img src={r.photos[0]} alt={r.roomNumber} className="h-full w-full object-cover" />
                  {r.photos.length > 1 && (
                    <span className="absolute bottom-2 right-2 rounded-md bg-black/70 px-2 py-0.5 text-[10px] font-bold text-white">
                      +{r.photos.length - 1} photos
                    </span>
                  )}
                </div>
              )}

              <div className="p-5 flex-1 space-y-3">
                <div className="flex items-center justify-between border-b border-border-color pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                      {r.floor}
                    </span>
                    <h3 className="text-lg font-black text-foreground">{r.roomNumber}</h3>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                        r.status === "available"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : r.status === "occupied"
                          ? "bg-blue-500/10 text-blue-600"
                          : r.status === "cleaning_needed"
                          ? "bg-amber-500/10 text-amber-600"
                          : "bg-purple-500/10 text-purple-600"
                      }`}
                    >
                      {r.status.replace("_", " ")}
                    </span>
                    {r.bookingMode === "external" && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-indigo-500/15 px-2 py-0.5 text-[9px] font-bold text-indigo-600 dark:text-indigo-400">
                        <ExternalLink size={9} /> Direct Link
                      </span>
                    )}
                    {r.discountPercentage && r.discountPercentage > 0 ? (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-black text-amber-600">
                        <Sparkles size={9} /> {r.discountPercentage}% OFF
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted">Type & Capacity:</span>
                    <span className="font-semibold text-foreground capitalize">
                      {r.roomType} · {r.capacityAdults} Adults, {r.capacityChildren} Kids
                    </span>
                  </div>

                  <div className="rounded-xl bg-surface-elevated/70 p-2.5 space-y-1">
                    <p className="text-[10px] font-bold uppercase text-muted">Meal Board Rates</p>
                    <div className="grid grid-cols-2 gap-1 text-[11px]">
                      <div>
                        <span className="text-muted">Bed Only:</span>{" "}
                        {r.discountPercentage && r.discountPercentage > 0 ? (
                          <>
                            <span className="font-bold text-amber-600">
                              R{Math.round(r.pricePerNight * (1 - r.discountPercentage / 100))}
                            </span>{" "}
                            <span className="text-[10px] line-through text-muted">R{r.pricePerNight}</span>
                          </>
                        ) : (
                          <span className="font-bold text-foreground">R{r.pricePerNight}</span>
                        )}
                      </div>
                      <div>
                        <span className="text-muted">B&B:</span>{" "}
                        <span className="font-bold text-emerald-600">R{r.priceBedBreakfast}</span>
                      </div>
                      <div>
                        <span className="text-muted">B&L:</span>{" "}
                        <span className="font-bold text-amber-600">R{r.priceBedLunch}</span>
                      </div>
                      <div>
                        <span className="text-muted">Full Board:</span>{" "}
                        <span className="font-bold text-purple-600">R{r.priceFullBoard}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1 pt-1">
                    {r.amenities.map((am) => (
                      <span
                        key={am}
                        className="rounded-md bg-surface-elevated px-2 py-0.5 text-[10px] font-medium text-muted uppercase"
                      >
                        {am}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-border-color p-3 bg-surface-elevated/30">
                <button
                  type="button"
                  onClick={() => openEditRoom(r)}
                  className="flex items-center gap-1 rounded-lg border border-border-color px-2.5 py-1 text-xs font-semibold text-muted hover:bg-surface-elevated hover:text-foreground transition"
                >
                  <Edit2 size={13} />
                  <span>Edit Room</span>
                </button>

                {canDelete && (
                  <button
                    type="button"
                    onClick={() => handleTriggerDeleteRoom(r)}
                    className="flex items-center gap-1 rounded-lg border border-red-500/20 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-500/10 transition"
                    title="Delete Room (Requires PIN)"
                  >
                    <Trash2 size={13} />
                    <span>Delete</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )}

      {/* TAB 2: UNIFORM PRICING CONFIGURATOR */}
      {activeTab === "pricing" && (
        <div className="max-w-2xl rounded-2xl border border-border-color bg-surface p-6 shadow-sm">
          <div className="mb-4">
            <h3 className="text-lg font-bold text-foreground">
              Uniform Nightly & Meal Board Pricing
            </h3>
            <p className="text-xs text-muted">
              Apply uniform flat rates per night to all rooms in <b>{selectedProperty?.name}</b> in a single click.
            </p>
          </div>

          {uniSuccess && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-sm text-emerald-600">
              <CheckCircle2 size={18} />
              <span>Uniform pricing applied successfully to all rooms!</span>
            </div>
          )}

          <form onSubmit={handleApplyUniformPricing} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  1. Bed Alone / Room Only ({currency})
                </label>
                <input
                  type="number"
                  value={uniBedOnly}
                  onChange={(e) => setUniBedOnly(Number(e.target.value))}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3.5 py-2.5 text-sm font-bold text-foreground focus:border-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  2. Bed & Breakfast ({currency})
                </label>
                <input
                  type="number"
                  value={uniBedBreakfast}
                  onChange={(e) => setUniBedBreakfast(Number(e.target.value))}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3.5 py-2.5 text-sm font-bold text-emerald-600 focus:border-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  3. Bed, Breakfast & Lunch ({currency})
                </label>
                <input
                  type="number"
                  value={uniBedLunch}
                  onChange={(e) => setUniBedLunch(Number(e.target.value))}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3.5 py-2.5 text-sm font-bold text-amber-600 focus:border-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-foreground">
                  4. Bed, Breakfast, Lunch & Dinner (Full Board) ({currency})
                </label>
                <input
                  type="number"
                  value={uniFullBoard}
                  onChange={(e) => setUniFullBoard(Number(e.target.value))}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3.5 py-2.5 text-sm font-bold text-purple-600 focus:border-blue-600 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700"
              >
                <CheckCheck size={16} />
                <span>Apply Flat Pricing to All {rooms.length} Rooms</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: HOUSEKEEPING SCHEDULES */}
      {activeTab === "housekeeping" && (
        <div className="rounded-2xl border border-border-color bg-surface overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-color bg-surface-elevated/70 text-[11px] font-bold uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3.5">Room</th>
                <th className="px-4 py-3.5">Cleaning Type</th>
                <th className="px-4 py-3.5">Assigned Cleaner</th>
                <th className="px-4 py-3.5">Scheduled Date & Shift</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5 text-right">Housekeeping Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color text-foreground">
              {housekeeping.map((h) => (
                <tr key={h.id} className="hover:bg-surface-elevated/30">
                  <td className="px-4 py-3.5 font-bold text-foreground">
                    {h.roomNumber}
                    <p className="text-[10px] text-muted">{h.propertyName}</p>
                  </td>
                  <td className="px-4 py-3.5 capitalize font-medium">
                    {h.cleaningType.replace("_", " ")}
                  </td>
                  <td className="px-4 py-3.5 text-muted">{h.cleanerName}</td>
                  <td className="px-4 py-3.5 text-xs">
                    {h.scheduledDate} ({h.shift})
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                        h.status === "completed" || h.status === "verified"
                          ? "bg-emerald-500/10 text-emerald-600"
                          : h.status === "in_progress"
                          ? "bg-blue-500/10 text-blue-600"
                          : "bg-amber-500/10 text-amber-600"
                      }`}
                    >
                      {h.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {h.status === "pending" && (
                      <button
                        type="button"
                        onClick={() => handleHousekeepingStatus(h.id, "in_progress")}
                        className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white"
                      >
                        Start Cleaning
                      </button>
                    )}
                    {h.status === "in_progress" && (
                      <button
                        type="button"
                        onClick={() => handleHousekeepingStatus(h.id, "completed")}
                        className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"
                      >
                        Mark Cleaned
                      </button>
                    )}
                    {h.status === "completed" && (
                      <button
                        type="button"
                        onClick={() => handleHousekeepingStatus(h.id, "verified")}
                        className="rounded-lg border border-border-color px-3 py-1 text-xs font-semibold text-muted"
                      >
                        Verify Inspection
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 4: ROOM SERVICE ORDERS */}
      {activeTab === "roomservice" && (
        <div className="rounded-2xl border border-border-color bg-surface overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-color bg-surface-elevated/70 text-[11px] font-bold uppercase tracking-wider text-muted">
              <tr>
                <th className="px-4 py-3.5">Room & Guest</th>
                <th className="px-4 py-3.5">Service Type</th>
                <th className="px-4 py-3.5">Items Ordered</th>
                <th className="px-4 py-3.5">Scheduled Delivery</th>
                <th className="px-4 py-3.5">Cost</th>
                <th className="px-4 py-3.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color text-foreground">
              {roomServices.map((rs) => (
                <tr key={rs.id} className="hover:bg-surface-elevated/30">
                  <td className="px-4 py-3.5 font-bold text-foreground">
                    {rs.roomNumber} · {rs.guestName}
                  </td>
                  <td className="px-4 py-3.5 capitalize font-medium">
                    {rs.serviceType.replace("_", " ")}
                  </td>
                  <td className="px-4 py-3.5 text-xs text-muted">
                    {rs.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")}
                  </td>
                  <td className="px-4 py-3.5 text-xs">
                    {new Date(rs.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-4 py-3.5 font-bold text-foreground">
                    R{rs.cost}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-bold text-blue-600 capitalize">
                      {rs.status.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Room Modal (Scrollable with Booking Channel & Discounts) */}
      {roomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-sm overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl border border-border-color bg-surface text-foreground shadow-2xl overflow-hidden my-auto flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border-color/60 bg-surface-elevated/70 px-6 py-4 shrink-0">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  {editingRoom ? `Edit ${editingRoom.roomNumber}` : "Add New Room"}
                </h3>
                <p className="text-xs text-muted">
                  Configure room rates, booking channel, discounts and details
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRoomModalOpen(false)}
                className="rounded-lg p-1.5 text-muted hover:bg-surface-elevated text-xl leading-none"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSaveRoom} className="flex flex-col flex-1 overflow-hidden">
              <div className="overflow-y-auto p-6 space-y-5 flex-1 text-xs">
                {/* Modal Accommodation Property Warning Banner */}
                <div
                  className={`rounded-xl border p-3 flex items-start gap-2.5 text-xs ${
                    properties.length === 0
                      ? "border-amber-400 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                      : "border-blue-200 dark:border-blue-900/40 bg-blue-50/70 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200"
                  }`}
                >
                  <Building2
                    size={16}
                    className={`shrink-0 mt-0.5 ${
                      properties.length === 0 ? "text-amber-600" : "text-blue-600"
                    }`}
                  />
                  <div>
                    <p className="font-bold">
                      {properties.length === 0
                        ? "⚠️ Accommodation Property Required"
                        : "🏨 Accommodation Property Assignment"}
                    </p>
                    <p className="text-[11px] opacity-90 mt-0.5">
                      All rooms must belong to an accommodation property (Hotel, Motel, Lodge, Guest House, Commercial). Without selecting a property or having an accommodation property in the system, you cannot create or manage rooms.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="mb-1 block font-semibold text-foreground">
                    Accommodation Property <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={selectedPropertyId}
                    onChange={(e) => setSelectedPropertyId(e.target.value)}
                    disabled={properties.length === 0}
                    className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none disabled:opacity-50"
                    required
                  >
                    {properties.length === 0 ? (
                      <option value="">No accommodation property found</option>
                    ) : (
                      properties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.type.replace(/_/g, " ").toUpperCase()})
                        </option>
                      ))
                    )}
                  </select>
                  {properties.length === 0 && (
                    <p className="mt-1 text-[11px] text-amber-600 font-medium">
                      You cannot create a room without an accommodation property. Please create a property first.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block font-medium text-foreground">Room Number / Name *</label>
                    <input
                      type="text"
                      value={roomNumber}
                      onChange={(e) => setRoomNumber(e.target.value)}
                      className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none font-semibold"
                      required
                    />
                  </div>

                  <div>
                    <label className="mb-1 block font-medium text-foreground">Room Category *</label>
                    <select
                      value={roomType}
                      onChange={(e) => setRoomType(e.target.value as RoomType)}
                      className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                    >
                      <option value="standard">Standard Room</option>
                      <option value="single">Single Room</option>
                      <option value="double">Double Room</option>
                      <option value="twin">Twin Room</option>
                      <option value="suite">Luxury Suite</option>
                      <option value="deluxe">Deluxe Room</option>
                      <option value="family">Family Chalet</option>
                      <option value="penthouse">Penthouse</option>
                      <option value="executive">Executive</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-medium text-foreground">Floor / Level</label>
                      {!showNewFloorInput && (
                        <button
                          type="button"
                          onClick={() => setShowNewFloorInput(true)}
                          className="text-[10px] text-blue-600 hover:underline font-semibold"
                        >
                          + New
                        </button>
                      )}
                    </div>
                    {showNewFloorInput ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={newFloorName}
                          onChange={(e) => setNewFloorName(e.target.value)}
                          placeholder="Floor name"
                          className="w-full rounded-lg border border-border-color bg-surface-elevated px-2 py-1 text-xs text-foreground focus:border-blue-600 focus:outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleAddNewFloor}
                          className="rounded-lg bg-blue-600 px-2 py-1 text-xs font-bold text-white hover:bg-blue-700"
                        >
                          Add
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowNewFloorInput(false)}
                          className="rounded-lg border border-border-color px-2 py-1 text-xs text-muted hover:bg-surface-elevated"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <select
                        value={floor}
                        onChange={(e) => {
                          if (e.target.value === "__add_new__") {
                            setShowNewFloorInput(true);
                          } else {
                            setFloor(e.target.value);
                          }
                        }}
                        className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                      >
                        {propertyFloors.map((fl) => (
                          <option key={fl} value={fl}>
                            {fl}
                          </option>
                        ))}
                        <option value="__add_new__">+ Add new floor...</option>
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block font-medium text-foreground">Adults Capacity</label>
                    <input
                      type="number"
                      value={capacityAdults}
                      onChange={(e) => setCapacityAdults(Number(e.target.value))}
                      className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block font-medium text-foreground">Kids Capacity</label>
                    <input
                      type="number"
                      value={capacityChildren}
                      onChange={(e) => setCapacityChildren(Number(e.target.value))}
                      className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Price tiers with permission check */}
                <div className="space-y-2 pt-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-foreground">Nightly Rate &amp; Meal Plan Pricing ({currency})</label>
                    {editingRoom && !canEditPricing && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded">
                        <Lock size={12} />
                        <span>Pricing Locked (Requires Admin, Manager, or Accountant)</span>
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block font-medium text-foreground">Bed Only Rate ({currency}) *</label>
                      <input
                        type="number"
                        value={pricePerNight}
                        disabled={editingRoom !== null && !canEditPricing}
                        readOnly={editingRoom !== null && !canEditPricing}
                        onChange={(e) => setPricePerNight(Number(e.target.value))}
                        className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground font-semibold focus:border-blue-600 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-medium text-foreground">Bed &amp; Breakfast Rate ({currency})</label>
                      <input
                        type="number"
                        value={priceBedBreakfast}
                        disabled={editingRoom !== null && !canEditPricing}
                        readOnly={editingRoom !== null && !canEditPricing}
                        onChange={(e) => setPriceBedBreakfast(Number(e.target.value))}
                        className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-medium text-foreground">Bed, B/Fast &amp; Lunch ({currency})</label>
                      <input
                        type="number"
                        value={priceBedLunch}
                        disabled={editingRoom !== null && !canEditPricing}
                        readOnly={editingRoom !== null && !canEditPricing}
                        onChange={(e) => setPriceBedLunch(Number(e.target.value))}
                        className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-medium text-foreground">Full Board Rate ({currency})</label>
                      <input
                        type="number"
                        value={priceFullBoard}
                        disabled={editingRoom !== null && !canEditPricing}
                        readOnly={editingRoom !== null && !canEditPricing}
                        onChange={(e) => setPriceFullBoard(Number(e.target.value))}
                        className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                      />
                    </div>
                  </div>
                </div>

                {/* Booking & Reservation Channel for this Room */}
                <div className="pt-3 border-t border-border-color/50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted block">
                      Booking &amp; Reservation Channel
                    </label>
                    <span className="text-[10px] text-muted">Configured per room</span>
                  </div>
                  <p className="text-[11px] text-muted">
                    Choose whether guests booking this room use our native Paimbabook reservation flow, or are redirected to an external direct link or affiliate booking site.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setBookingMode("platform")}
                      className={`flex flex-col items-start p-3 rounded-xl border text-left transition ${
                        bookingMode === "platform"
                          ? "border-blue-600 bg-blue-600/10 text-blue-700 dark:text-blue-300 ring-2 ring-blue-600/30"
                          : "border-border-color bg-surface hover:border-blue-400/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">🏨</span>
                        <span className="font-bold text-xs text-foreground">Paimbabook Platform</span>
                      </div>
                      <p className="text-[10px] text-muted">
                        Process reservations, enquiries &amp; check-ins directly on Paimbabook.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBookingMode("external")}
                      className={`flex flex-col items-start p-3 rounded-xl border text-left transition ${
                        bookingMode === "external"
                          ? "border-indigo-600 bg-indigo-600/10 text-indigo-700 dark:text-indigo-300 ring-2 ring-indigo-600/30"
                          : "border-border-color bg-surface hover:border-indigo-400/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <ExternalLink size={14} className="text-indigo-600" />
                        <span className="font-bold text-xs text-foreground">Custom Booking Link</span>
                      </div>
                      <p className="text-[10px] text-muted">
                        Redirect guests to your website, affiliate or external engine.
                      </p>
                    </button>
                  </div>

                  {bookingMode === "external" && (
                    <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-3 space-y-1.5">
                      <label className="text-[11px] font-bold text-indigo-800 dark:text-indigo-300 block">
                        External Booking URL *
                      </label>
                      <input
                        type="url"
                        placeholder="https://example.com/book or affiliate link"
                        value={externalBookingUrl}
                        onChange={(e) => setExternalBookingUrl(e.target.value)}
                        className="w-full rounded-lg border border-indigo-400/50 bg-surface px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-indigo-500"
                        required
                      />
                      <p className="text-[10px] text-muted">
                        Guests clicking &quot;Book&quot; on this room in the public portal will be redirected to this link.
                      </p>
                    </div>
                  )}
                </div>

                {/* Promotional Discounts */}
                <div className="pt-3 border-t border-border-color/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-muted flex items-center gap-1.5">
                      <Sparkles size={14} className="text-amber-500" />
                      <span>Promotional Discounts</span>
                    </label>
                    {discountPercentage > 0 ? (
                      <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-xs font-black text-amber-600">
                        {discountPercentage}% OFF Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-muted/10 px-2.5 py-0.5 text-[10px] font-bold text-muted">
                        No discount active
                      </span>
                    )}
                  </div>

                  <div className="rounded-xl border border-border-color bg-surface-elevated/40 p-4 space-y-3.5">
                    {/* Movable Bar (Slider) from 0% to 100% */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[11px] font-bold text-foreground">
                          Discount Percentage: <span className="text-amber-600 font-black">{discountPercentage}%</span>
                        </label>
                        {discountPercentage > 0 && (
                          <span className="text-[10px] text-muted">
                            Bed Only becomes: <strong className="text-foreground">R{Math.round(pricePerNight * (1 - discountPercentage / 100))}</strong>/nt
                          </span>
                        )}
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={discountPercentage}
                        onChange={(e) => {
                          setDiscountPercentage(Number(e.target.value));
                          setRoomDiscountPinError(null);
                        }}
                        className="w-full accent-amber-600 cursor-pointer h-2 bg-border-color rounded-lg appearance-none"
                      />
                      <div className="flex justify-between text-[9px] text-muted font-bold mt-1 px-1">
                        <span>0%</span>
                        <span>25%</span>
                        <span>50%</span>
                        <span>75%</span>
                        <span>100%</span>
                      </div>
                    </div>

                    {/* Presets */}
                    <div>
                      <label className="text-[10px] font-bold text-muted uppercase block mb-1">Presets</label>
                      <div className="flex flex-wrap gap-1.5">
                        {[0, 5, 10, 15, 20, 25, 30, 40, 50, 75].map((pct) => (
                          <button
                            key={pct}
                            type="button"
                            onClick={() => {
                              setDiscountPercentage(pct);
                              setRoomDiscountPinError(null);
                            }}
                            className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                              discountPercentage === pct
                                ? "bg-amber-600 text-white shadow-xs"
                                : "border border-border-color bg-surface text-muted hover:border-amber-500"
                            }`}
                          >
                            {pct === 0 ? "Off" : `${pct}%`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-muted uppercase block mb-1">Start Date</label>
                        <input
                          type="date"
                          value={discountStartDate}
                          onChange={(e) => setDiscountStartDate(e.target.value)}
                          className="w-full rounded-lg border border-border-color bg-surface px-3 py-1.5 text-xs text-foreground outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-muted uppercase block mb-1">End Date</label>
                        <input
                          type="date"
                          value={discountEndDate}
                          onChange={(e) => setDiscountEndDate(e.target.value)}
                          className="w-full rounded-lg border border-border-color bg-surface px-3 py-1.5 text-xs text-foreground outline-none"
                        />
                      </div>
                    </div>

                    {/* Security PIN Requirement when discount > 0 */}
                    {discountPercentage > 0 && (
                      <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
                        <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-bold text-xs">
                          <KeyRound size={13} />
                          <span>Security PIN Required to Activate Discount</span>
                        </div>
                        <p className="text-[11px] text-muted leading-tight">
                          Confirm setting <strong>{discountPercentage}% discount</strong> on <strong>{roomNumber || "this room"}</strong>:
                        </p>
                        <div className="max-w-xs">
                          <input
                            type="password"
                            maxLength={8}
                            value={roomDiscountPin}
                            onChange={(e) => {
                              setRoomDiscountPin(e.target.value);
                              setRoomDiscountPinError(null);
                            }}
                            placeholder="Security PIN (default 1234)"
                            className="w-full rounded-lg border border-border-color bg-surface px-3 py-1.5 text-xs text-foreground tracking-widest outline-none focus:border-amber-500"
                          />
                        </div>
                        {roomDiscountPinError && (
                          <p className="text-xs text-red-600 font-semibold flex items-center gap-1">
                            <AlertCircle size={12} /> {roomDiscountPinError}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Room Amenities Multi-Select */}
                <div className="space-y-1.5 pt-1">
                  <label className="block font-medium text-foreground">
                    Room Features &amp; Amenities ({amenities.length} selected)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {AVAILABLE_AMENITIES.map((item) => {
                      const Icon = item.icon;
                      const isSelected = amenities.includes(item.key);
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => toggleAmenity(item.key)}
                          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                            isSelected
                              ? "border-blue-600 bg-blue-600/10 text-blue-600 dark:text-blue-400"
                              : "border-border-color bg-surface-elevated text-muted hover:text-foreground"
                          }`}
                        >
                          <Icon size={13} />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Room Photos Section */}
                <div className={`space-y-2 rounded-xl border p-3 ${
                  roomPhotos.length === 0
                    ? "border-amber-500/40 bg-amber-500/5 dark:bg-amber-950/20"
                    : "border-border-color bg-surface-elevated/40"
                }`}>
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-foreground flex items-center gap-1.5">
                      <ImageIcon size={14} className="text-emerald-600" />
                      <span>Room Pictures ({roomPhotos.length})</span>
                      <span className="text-red-500 text-xs font-semibold">* (Mandatory)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        ref={roomPhotoInputRef}
                        onChange={handleRoomPhotoUpload}
                        accept="image/*"
                        multiple
                        className="hidden"
                        id="room-photo-upload"
                      />
                      <label
                        htmlFor="room-photo-upload"
                        className={`inline-flex items-center gap-1.5 cursor-pointer rounded-lg bg-surface border border-border-color px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-surface-elevated shadow-xs ${
                          uploadingPhoto ? "opacity-50 pointer-events-none" : ""
                        }`}
                      >
                        {uploadingPhoto ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                        <span>{uploadingPhoto ? "Uploading..." : "Upload Photo"}</span>
                      </label>
                    </div>
                  </div>

                  {roomPhotos.length === 0 ? (
                    <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 p-2 text-xs text-amber-600 dark:text-amber-400 font-medium">
                      <AlertCircle size={14} className="shrink-0" />
                      <span>A room photo is strictly mandatory before saving. Please click Upload Photo above.</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-2 pt-1">
                      {roomPhotos.map((url, idx) => (
                        <div key={idx} className="group relative aspect-video rounded-lg overflow-hidden border border-border-color bg-black/10">
                          <img src={url} alt={`Room ${idx + 1}`} className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => promptDeletePhoto(idx)}
                            className="absolute top-1 right-1 rounded-md bg-black/70 p-1 text-white hover:bg-red-600 opacity-0 group-hover:opacity-100 transition shadow-sm"
                            title="Delete picture (Requires PIN)"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-1 block font-medium text-foreground">Room Notes &amp; Special Instructions</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Garden facing, recently refurbished with extra storage"
                    className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                  />
                </div>
              </div>

              {/* Modal Sticky Footer */}
              <div className="flex items-center justify-between border-t border-border-color/60 bg-surface-elevated/70 px-6 py-4 shrink-0">
                <button
                  type="button"
                  onClick={() => setRoomModalOpen(false)}
                  className="rounded-xl border border-border-color px-4 py-2 font-medium text-muted hover:bg-surface-elevated"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={properties.length === 0 || !selectedPropertyId || roomPhotos.length === 0 || uploadingPhoto || savingRoom}
                  className="rounded-xl bg-blue-600 px-6 py-2 font-semibold text-white shadow-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {savingRoom && <Loader2 size={14} className="animate-spin" />}
                  <span>{savingRoom ? "Saving Room..." : "Save Room"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PIN-Protected Room Deletion Dialog */}
      <PinPromptDialog
        isOpen={pinDialogForRoom}
        onClose={() => {
          setPinDialogForRoom(false);
          setRoomToDelete(null);
        }}
        onSuccess={confirmDeleteRoom}
        title={`Delete Room ${roomToDelete?.roomNumber}`}
        description="Security PIN verification required. Please enter your PIN to permanently delete this room."
        actionLabel="Verify PIN & Delete Room"
        actionVariant="danger"
      />

      {/* PIN-Protected Room Photo Deletion Dialog */}
      <PinPromptDialog
        isOpen={pinDialogForPhoto}
        onClose={() => {
          setPinDialogForPhoto(false);
          setPhotoToDeleteIndex(null);
        }}
        onSuccess={confirmDeletePhoto}
        title="Delete Room Picture"
        description="Security PIN verification required. Please enter your PIN to permanently remove this room picture."
        actionLabel="Verify PIN & Delete Picture"
        actionVariant="danger"
      />
    </div>
  );
}

