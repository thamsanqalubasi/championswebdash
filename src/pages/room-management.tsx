import { useState, useEffect, useRef } from "react";
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

    const activePropId = selectedPropertyId || props[0]?.id || "";
    setSelectedPropertyId(activePropId);

    const [allRooms, hk, rs, floors] = await Promise.all([
      fetchCommercialRooms(currentCompany.id, activePropId),
      fetchHousekeepingSchedules(currentCompany.id),
      fetchRoomServiceSchedules(currentCompany.id),
      fetchPropertyFloors(currentCompany.id, activePropId),
    ]);

    setRooms(allRooms);
    setHousekeeping(hk);
    setRoomServices(rs);
    setPropertyFloors(floors);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [currentCompany.id, selectedPropertyId]);

  const openAddRoom = () => {
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
    setShowNewFloorInput(false);
    setRoomModalOpen(true);
  };

  const openEditRoom = (r: CommercialRoom) => {
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
    });
    setRoomModalOpen(false);
    loadData();
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
          <select
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            className="rounded-xl border border-border-color bg-surface px-4 py-2.5 text-sm font-semibold text-foreground focus:border-blue-600 focus:outline-none"
          >
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.type.toUpperCase()})
              </option>
            ))}
          </select>

          {activeTab === "rooms" && (
            <button
              type="button"
              onClick={openAddRoom}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white shadow-md hover:bg-blue-700 transition"
            >
              <Plus size={16} />
              <span>Add New Room</span>
            </button>
          )}
        </div>
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
                        <span className="font-bold text-foreground">R{r.pricePerNight}</span>
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
                  1. Bed Alone / Room Only (ZAR)
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
                  2. Bed & Breakfast (ZAR)
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
                  3. Bed, Breakfast & Lunch (ZAR)
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
                  4. Bed, Breakfast, Lunch & Dinner (Full Board) (ZAR)
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

      {/* Add / Edit Room Modal */}
      {roomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border-color bg-surface p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-border-color pb-3">
              <h3 className="text-base font-bold text-foreground">
                {editingRoom ? `Edit ${editingRoom.roomNumber}` : "Add New Room"}
              </h3>
              <button
                onClick={() => setRoomModalOpen(false)}
                className="rounded-lg p-1.5 text-muted hover:bg-surface-elevated"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveRoom} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-medium text-foreground">Room Number / Name *</label>
                  <input
                    type="text"
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
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
                  <label className="font-bold text-foreground">Nightly Rate & Meal Plan Pricing (ZAR)</label>
                  {editingRoom && !canEditPricing && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded">
                      <Lock size={12} />
                      <span>Pricing Locked (Requires Admin, Manager, or Accountant)</span>
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block font-medium text-foreground">Bed Only Rate (ZAR)</label>
                    <input
                      type="number"
                      value={pricePerNight}
                      disabled={editingRoom !== null && !canEditPricing}
                      readOnly={editingRoom !== null && !canEditPricing}
                      onChange={(e) => setPricePerNight(Number(e.target.value))}
                      className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-medium text-foreground">Bed & Breakfast Rate (ZAR)</label>
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
                    <label className="mb-1 block font-medium text-foreground">Bed, B/Fast & Lunch (ZAR)</label>
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
                    <label className="mb-1 block font-medium text-foreground">Full Board Rate (ZAR)</label>
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

              {/* Room Amenities Multi-Select */}
              <div className="space-y-1.5 pt-1">
                <label className="block font-medium text-foreground">
                  Room Features & Amenities ({amenities.length} selected)
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
              <div className="space-y-2 rounded-xl border border-border-color bg-surface-elevated/40 p-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-foreground flex items-center gap-1.5">
                    <ImageIcon size={14} className="text-emerald-600" />
                    <span>Room Pictures ({roomPhotos.length})</span>
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
                  <p className="text-[11px] text-muted italic">No pictures uploaded yet for this room.</p>
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
                <label className="mb-1 block font-medium text-foreground">Room Notes & Special Instructions</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Garden facing, recently refurbished with extra storage"
                  className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setRoomModalOpen(false)}
                  className="rounded-lg border border-border-color px-3 py-1.5 font-medium text-muted hover:bg-surface-elevated"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-5 py-1.5 font-semibold text-white shadow-md hover:bg-blue-700"
                >
                  Save Room
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

