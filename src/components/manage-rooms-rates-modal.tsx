import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import {
  fetchCommercialRooms,
  saveCommercialRoom,
  fetchCommercialBookings,
  isValidUuid,
  verifyUserPin,
} from "@/lib/data";
import { useAuth } from "@/lib/auth";
import { uploadFileToBucket } from "@/lib/storage";
import type { PropertyRow, CommercialRoom, RoomStatus, RoomType, CommercialBooking } from "@/lib/types";
import {
  ArrowLeft,
  BedDouble,
  DollarSign,
  Layers,
  ChevronDown,
  ChevronUp,
  List,
  LayoutGrid,
  Edit2,
  Check,
  X,
  Plus,
  AlertTriangle,
  Upload,
  Image as ImageIcon,
  Sparkles,
  Save,
  Trash2,
  KeyRound,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

interface ManageRoomsRatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  property: PropertyRow;
  companyId: string;
  onUpdated?: () => void;
}

export function ManageRoomsRatesModal({
  isOpen,
  onClose,
  property,
  companyId,
  onUpdated,
}: ManageRoomsRatesModalProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"rates" | "rooms">("rates");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [rooms, setRooms] = useState<CommercialRoom[]>([]);
  const [bookings, setBookings] = useState<CommercialBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFloors, setExpandedFloors] = useState<Record<string, boolean>>({});
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [roomEditForm, setRoomEditForm] = useState<Partial<CommercialRoom>>({});
  const [savingRoom, setSavingRoom] = useState(false);
  const [roomPhotoUploading, setRoomPhotoUploading] = useState(false);
  const [roomDiscountPin, setRoomDiscountPin] = useState("");
  const [roomDiscountPinError, setRoomDiscountPinError] = useState<string | null>(null);

  // New room modal/inline state
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoomFloor, setNewRoomFloor] = useState("Ground Floor");
  const [newRoomNumber, setNewRoomNumber] = useState("");
  const [newRoomType, setNewRoomType] = useState<RoomType>("standard");
  const [newRoomPrice, setNewRoomPrice] = useState<number>(property.defaultRoomPrice || 1000);
  const [creatingRoom, setCreatingRoom] = useState(false);

  // Rates Form State
  const [ratesForm, setRatesForm] = useState({
    defaultRoomPrice: property.defaultRoomPrice || 0,
    defaultBedBreakfast: property.defaultBedBreakfast || 0,
    defaultBedLunch: property.defaultBedLunch || 0,
    defaultFullBoard: property.defaultFullBoard || 0,
    uniformRoomPricing: property.uniformRoomPricing ?? true,
    monthlyRent: property.monthlyRent || 0,
  });
  const [savingRates, setSavingRates] = useState(false);
  const [ratesSuccessMsg, setRatesSuccessMsg] = useState("");

  useEffect(() => {
    if (!isOpen || !property.id) return;
    setRatesForm({
      defaultRoomPrice: property.defaultRoomPrice || 0,
      defaultBedBreakfast: property.defaultBedBreakfast || 0,
      defaultBedLunch: property.defaultBedLunch || 0,
      defaultFullBoard: property.defaultFullBoard || 0,
      uniformRoomPricing: property.uniformRoomPricing ?? true,
      monthlyRent: property.monthlyRent || 0,
    });
    void loadRoomsAndBookings();
  }, [isOpen, property.id, companyId]);

  async function loadRoomsAndBookings() {
    setLoading(true);
    try {
      const [allRooms, allBookings] = await Promise.all([
        fetchCommercialRooms(companyId, property.id),
        fetchCommercialBookings(companyId),
      ]);
      setRooms(allRooms);
      const propBookings = allBookings.filter((b) => b.propertyId === property.id);
      setBookings(propBookings);

      // Auto expand all floors initially
      const floorsMap: Record<string, boolean> = {};
      allRooms.forEach((r) => {
        const floorName = r.floor || "Ground Floor";
        floorsMap[floorName] = true;
      });
      if (Object.keys(floorsMap).length === 0) {
        floorsMap["Ground Floor"] = true;
      }
      setExpandedFloors(floorsMap);
    } catch (err) {
      console.warn("Could not load rooms/bookings:", err);
    } finally {
      setLoading(false);
    }
  }

  // Group rooms by floor
  const roomsByFloor = useMemo(() => {
    const grouped: Record<string, CommercialRoom[]> = {};
    // Extract floors from property floors array or default
    const propertyFloors = property.floors && property.floors.length > 0
      ? property.floors
      : ["Ground Floor", "1st Floor", "2nd Floor"];

    propertyFloors.forEach((f: string) => {
      grouped[f] = [];
    });

    rooms.forEach((room) => {
      const floorKey = room.floor || "Ground Floor";
      if (!grouped[floorKey]) {
        grouped[floorKey] = [];
      }
      grouped[floorKey].push(room);
    });

    return grouped;
  }, [rooms, property.floors]);

  // Map of overdue rooms: room_id -> boolean
  const overdueRoomsMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    const todayStr = new Date().toISOString().slice(0, 10);
    bookings.forEach((b) => {
      if (b.bookingStatus === "checked_in" && b.checkOutDate && b.checkOutDate <= todayStr) {
        if (b.roomId) map[b.roomId] = true;
        // Also map by roomNumber if roomId missing
        if (b.roomNumber) {
          const match = rooms.find((r) => r.roomNumber === b.roomNumber);
          if (match) map[match.id] = true;
        }
      }
    });
    return map;
  }, [bookings, rooms]);

  const toggleFloor = (floor: string) => {
    setExpandedFloors((prev) => ({ ...prev, [floor]: !prev[floor] }));
  };

  const handleSaveRates = async () => {
    setSavingRates(true);
    setRatesSuccessMsg("");
    try {
      const payload: Record<string, unknown> = {
        default_room_price: Number(ratesForm.defaultRoomPrice) || 0,
        default_bed_breakfast: Number(ratesForm.defaultBedBreakfast) || 0,
        default_bed_lunch: Number(ratesForm.defaultBedLunch) || 0,
        default_full_board: Number(ratesForm.defaultFullBoard) || 0,
        uniform_room_pricing: Boolean(ratesForm.uniformRoomPricing),
        monthly_rent: Number(ratesForm.monthlyRent) || 0,
      };

      if (isValidUuid(property.id)) {
        await supabase.from("properties").update(payload).eq("id", property.id);
      }

      setRatesSuccessMsg("Rates and pricing successfully updated and active across portal!");
      setTimeout(() => setRatesSuccessMsg(""), 3500);
      onUpdated?.();
    } catch (err) {
      alert("Could not update rates: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSavingRates(false);
    }
  };

  const startEditRoom = (room: CommercialRoom) => {
    setEditingRoomId(room.id);
    setRoomDiscountPin("");
    setRoomDiscountPinError(null);
    setRoomEditForm({
      ...room,
      bookingMode: room.bookingMode || "platform",
      externalBookingUrl: room.externalBookingUrl || "",
      photos: [...(room.photos || [])],
      amenities: [...(room.amenities || [])],
    });
  };

  const cancelEditRoom = () => {
    setEditingRoomId(null);
    setRoomEditForm({});
    setRoomDiscountPin("");
    setRoomDiscountPinError(null);
  };

  const handleSaveRoomEdit = async () => {
    if (!editingRoomId || !roomEditForm.roomNumber?.trim()) {
      alert("Please provide a valid Room Number.");
      return;
    }

    if (roomEditForm.bookingMode === "external" && !roomEditForm.externalBookingUrl?.trim()) {
      alert("Please enter a valid external booking URL for this room.");
      return;
    }

    const pct = Number(roomEditForm.discountPercentage) || 0;
    if (pct > 0) {
      if (!roomDiscountPin.trim()) {
        setRoomDiscountPinError("Security PIN is required to set a promotional discount.");
        return;
      }
      const isPinValid = await verifyUserPin(user?.email || "", roomDiscountPin.trim());
      if (!isPinValid) {
        setRoomDiscountPinError("Incorrect security PIN. Default is 1234 if not yet configured.");
        return;
      }
    }

    setSavingRoom(true);
    try {
      await saveCommercialRoom({
        ...roomEditForm,
        discountPercentage: pct,
        id: editingRoomId,
        propertyId: property.id,
        companyId,
      });

      await loadRoomsAndBookings();
      setEditingRoomId(null);
      setRoomEditForm({});
      setRoomDiscountPin("");
      setRoomDiscountPinError(null);
      onUpdated?.();
    } catch (err) {
      alert("Could not update room: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSavingRoom(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!newRoomNumber.trim()) {
      alert("Please enter a room number (e.g. 101, Suite A).");
      return;
    }
    setCreatingRoom(true);
    try {
      await saveCommercialRoom({
        companyId,
        propertyId: property.id,
        propertyName: property.name,
        roomNumber: newRoomNumber.trim(),
        roomType: newRoomType,
        floor: newRoomFloor,
        pricePerNight: Number(newRoomPrice) || 1000,
        status: "available",
        capacityAdults: 2,
        capacityChildren: 1,
        amenities: ["wifi", "tv", "ac"],
        photos: property.photos?.length ? [property.photos[0]] : [],
      });

      setNewRoomNumber("");
      setShowAddRoom(false);
      await loadRoomsAndBookings();
      onUpdated?.();
    } catch (err) {
      alert("Failed to add room: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setCreatingRoom(false);
    }
  };

  const handleUploadRoomPhoto = async (file: File | null) => {
    if (!file || !editingRoomId) return;
    setRoomPhotoUploading(true);
    try {
      const url = await uploadFileToBucket("room-photos", editingRoomId, file);
      setRoomEditForm((prev) => ({
        ...prev,
        photos: [...(prev.photos || []), url],
      }));
    } catch (err) {
      alert("Could not upload photo: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setRoomPhotoUploading(false);
    }
  };

  const removeRoomPhoto = (index: number) => {
    setRoomEditForm((prev) => ({
      ...prev,
      photos: (prev.photos || []).filter((_, i) => i !== index),
    }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-6 backdrop-blur-xs">
      <div className="relative flex h-full max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border-color bg-surface text-foreground shadow-2xl">
        {/* Top Header with Back Navigation */}
        <header className="flex shrink-0 items-center justify-between border-b border-border-color/50 bg-surface-elevated/70 px-6 py-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border-color bg-surface text-muted hover:bg-surface-elevated hover:text-foreground transition shadow-xs"
              title="Back"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight text-foreground">
                  Manage Rooms &amp; Rates
                </h2>
                <span className="rounded-full bg-purple-600/10 px-2.5 py-0.5 text-xs font-bold text-purple-600">
                  {property.name}
                </span>
              </div>
              <p className="text-xs text-muted">
                Configure rates, room distribution per floor, and live occupancy status
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-muted/10 hover:text-foreground text-2xl leading-none"
          >
            &times;
          </button>
        </header>

        {/* Tab Selector */}
        <div className="flex shrink-0 items-center justify-between border-b border-border-color/50 bg-surface px-6 pt-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("rates")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-bold transition ${
                activeTab === "rates"
                  ? "border-purple-600 text-purple-600 dark:text-purple-400"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              <DollarSign size={16} />
              <span>Rates &amp; Meal Plans</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("rooms")}
              className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-bold transition ${
                activeTab === "rooms"
                  ? "border-purple-600 text-purple-600 dark:text-purple-400"
                  : "border-transparent text-muted hover:text-foreground"
              }`}
            >
              <Layers size={16} />
              <span>Floors &amp; Rooms ({rooms.length})</span>
            </button>
          </div>

          {activeTab === "rooms" && (
            <div className="flex items-center gap-2 pb-2">
              <div className="flex items-center rounded-xl border border-border-color bg-surface-elevated p-1">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`rounded-lg p-1.5 transition ${
                    viewMode === "list"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "text-muted hover:text-foreground"
                  }`}
                  title="List View"
                >
                  <List size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={`rounded-lg p-1.5 transition ${
                    viewMode === "grid"
                      ? "bg-purple-600 text-white shadow-xs"
                      : "text-muted hover:text-foreground"
                  }`}
                  title="Grid View"
                >
                  <LayoutGrid size={14} />
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowAddRoom(true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-purple-700 transition shadow-xs"
              >
                <Plus size={14} />
                <span>Add Room</span>
              </button>
            </div>
          )}
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ================= RATES TAB ================= */}
          {activeTab === "rates" && (
            <div className="max-w-2xl space-y-6">
              {ratesSuccessMsg && (
                <div className="flex items-center gap-2 rounded-2xl bg-green-500/10 border border-green-500/20 p-4 text-sm font-medium text-green-700 dark:text-green-300">
                  <Check size={18} className="shrink-0" />
                  <span>{ratesSuccessMsg}</span>
                </div>
              )}

              {/* Uniform Pricing Toggle */}
              <div className="flex items-center justify-between rounded-2xl border border-border-color bg-surface-elevated/40 p-4">
                <div>
                  <h4 className="text-sm font-bold text-foreground">Uniform Standard Pricing</h4>
                  <p className="text-xs text-muted">
                    Apply default rates across all standard rooms unless customized individually
                  </p>
                </div>
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    checked={ratesForm.uniformRoomPricing}
                    onChange={(e) =>
                      setRatesForm({ ...ratesForm, uniformRoomPricing: e.target.checked })
                    }
                    className="peer sr-only"
                  />
                  <div className="peer h-6 w-11 rounded-full bg-border-color peer-checked:bg-purple-600 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full" />
                </label>
              </div>

              {/* Rate Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-border-color bg-surface p-4 space-y-1.5">
                  <label className="text-xs font-bold uppercase text-muted tracking-wider">
                    Default Nightly Rate (NAD / ZAR) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={ratesForm.defaultRoomPrice}
                    onChange={(e) =>
                      setRatesForm({ ...ratesForm, defaultRoomPrice: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-base font-black text-foreground outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g. 1200"
                  />
                  <p className="text-[11px] text-muted">Standard room only per night</p>
                </div>

                <div className="rounded-2xl border border-border-color bg-surface p-4 space-y-1.5">
                  <label className="text-xs font-bold uppercase text-muted tracking-wider">
                    Bed &amp; Breakfast Rate (NAD / ZAR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={ratesForm.defaultBedBreakfast}
                    onChange={(e) =>
                      setRatesForm({ ...ratesForm, defaultBedBreakfast: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-base font-black text-foreground outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g. 1450"
                  />
                  <p className="text-[11px] text-muted">Includes morning breakfast</p>
                </div>

                <div className="rounded-2xl border border-border-color bg-surface p-4 space-y-1.5">
                  <label className="text-xs font-bold uppercase text-muted tracking-wider">
                    Bed &amp; Lunch / Half Board (NAD / ZAR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={ratesForm.defaultBedLunch}
                    onChange={(e) =>
                      setRatesForm({ ...ratesForm, defaultBedLunch: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-base font-black text-foreground outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g. 1750"
                  />
                  <p className="text-[11px] text-muted">Includes breakfast &amp; lunch</p>
                </div>

                <div className="rounded-2xl border border-border-color bg-surface p-4 space-y-1.5">
                  <label className="text-xs font-bold uppercase text-muted tracking-wider">
                    Full Board Package (NAD / ZAR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={ratesForm.defaultFullBoard}
                    onChange={(e) =>
                      setRatesForm({ ...ratesForm, defaultFullBoard: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-base font-black text-foreground outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g. 2200"
                  />
                  <p className="text-[11px] text-muted">Includes breakfast, lunch &amp; dinner</p>
                </div>

                <div className="rounded-2xl border border-border-color bg-surface p-4 space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-bold uppercase text-muted tracking-wider">
                    Monthly Long-term Rate (NAD / ZAR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={ratesForm.monthlyRent}
                    onChange={(e) =>
                      setRatesForm({ ...ratesForm, monthlyRent: Number(e.target.value) })
                    }
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-base font-black text-foreground outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="e.g. 15000"
                  />
                  <p className="text-[11px] text-muted">Used if property offers extended month-to-month tenancy</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveRates}
                disabled={savingRates}
                className="inline-flex items-center gap-2 rounded-xl bg-purple-600 px-6 py-3 text-sm font-bold text-white hover:bg-purple-700 transition shadow-md disabled:opacity-50"
              >
                <Save size={16} />
                <span>{savingRates ? "Saving Rates..." : "Save Rates & Pricing"}</span>
              </button>
            </div>
          )}

          {/* ================= ROOMS TAB ================= */}
          {activeTab === "rooms" && (
            <div className="space-y-6">
              {/* Quick Add Room Form Modal/Card */}
              {showAddRoom && (
                <div className="rounded-2xl border-2 border-purple-500/30 bg-purple-500/5 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-purple-700 dark:text-purple-300">
                      Add New Room to {property.name}
                    </h4>
                    <button
                      type="button"
                      onClick={() => setShowAddRoom(false)}
                      className="text-muted hover:text-foreground text-sm"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-muted block mb-1">Room # *</label>
                      <input
                        type="text"
                        value={newRoomNumber}
                        onChange={(e) => setNewRoomNumber(e.target.value)}
                        placeholder="e.g. 101 or Suite B"
                        className="w-full rounded-xl border border-border-color bg-surface px-3 py-2 text-sm text-foreground outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-muted block mb-1">Floor *</label>
                      <select
                        value={newRoomFloor}
                        onChange={(e) => setNewRoomFloor(e.target.value)}
                        className="w-full rounded-xl border border-border-color bg-surface px-3 py-2 text-sm text-foreground outline-none"
                      >
                        {Object.keys(roomsByFloor).map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-muted block mb-1">Room Type</label>
                      <select
                        value={newRoomType}
                        onChange={(e) => setNewRoomType(e.target.value as RoomType)}
                        className="w-full rounded-xl border border-border-color bg-surface px-3 py-2 text-sm text-foreground outline-none"
                      >
                        <option value="standard">Standard</option>
                        <option value="deluxe">Deluxe</option>
                        <option value="executive_suite">Executive Suite</option>
                        <option value="family_room">Family Room</option>
                        <option value="penthouse">Penthouse</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-muted block mb-1">Nightly Rate (NAD)</label>
                      <input
                        type="number"
                        min="0"
                        value={newRoomPrice}
                        onChange={(e) => setNewRoomPrice(Number(e.target.value))}
                        className="w-full rounded-xl border border-border-color bg-surface px-3 py-2 text-sm text-foreground outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowAddRoom(false)}
                      className="rounded-xl border border-border-color px-4 py-1.5 text-xs font-bold text-muted hover:bg-surface-elevated transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateRoom}
                      disabled={creatingRoom || !newRoomNumber.trim()}
                      className="rounded-xl bg-purple-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-purple-700 transition disabled:opacity-50"
                    >
                      {creatingRoom ? "Saving..." : "Save Room"}
                    </button>
                  </div>
                </div>
              )}

              {/* Floors & Rooms Accordion List */}
              {loading ? (
                <div className="py-12 text-center text-sm text-muted">Loading floors &amp; rooms...</div>
              ) : Object.keys(roomsByFloor).length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border-color p-8 text-center text-sm text-muted">
                  No rooms added yet. Click &quot;Add Room&quot; above to create your first room.
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(roomsByFloor).map(([floorName, floorRooms]) => {
                    const isExpanded = expandedFloors[floorName] ?? true;
                    return (
                      <div
                        key={floorName}
                        className="rounded-2xl border border-border-color bg-surface overflow-hidden transition-all shadow-xs"
                      >
                        {/* Floor Accordion Header */}
                        <button
                          type="button"
                          onClick={() => toggleFloor(floorName)}
                          className="flex w-full items-center justify-between border-b border-border-color/40 bg-surface-elevated/40 px-5 py-3.5 text-left hover:bg-surface-elevated/70 transition"
                        >
                          <div className="flex items-center gap-3">
                            <Layers size={16} className="text-purple-600" />
                            <span className="font-bold text-sm text-foreground">{floorName}</span>
                            <span className="rounded-full bg-muted/10 px-2.5 py-0.5 text-xs font-semibold text-muted">
                              {floorRooms.length} {floorRooms.length === 1 ? "Room" : "Rooms"}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 text-muted">
                            <span className="text-xs font-medium">
                              {isExpanded ? "Collapse Floor" : "Expand Floor"}
                            </span>
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </div>
                        </button>

                        {/* Floor Rooms Content */}
                        {isExpanded && (
                          <div className="p-4">
                            {floorRooms.length === 0 ? (
                              <p className="text-xs text-muted italic py-3 text-center">
                                No rooms assigned to {floorName} yet.
                              </p>
                            ) : viewMode === "grid" ? (
                              /* ====== GRID VIEW ====== */
                              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {floorRooms.map((room) => {
                                  const isEditing = editingRoomId === room.id;
                                  const isOverdue = overdueRoomsMap[room.id];

                                  return (
                                    <div
                                      key={room.id}
                                      className={`rounded-xl border p-4 transition ${
                                        isOverdue
                                          ? "border-red-500/40 bg-red-500/5 ring-2 ring-red-500/20"
                                          : isEditing
                                          ? "border-purple-500 bg-purple-500/5 shadow-md"
                                          : "border-border-color bg-surface-elevated/30 hover:border-purple-500/30"
                                      }`}
                                    >
                                      {isEditing ? (
                                        /* Inline Room Editor */
                                        <div className="space-y-3">
                                          <div className="flex items-center justify-between">
                                            <span className="text-xs font-black text-purple-600 uppercase">
                                              Edit Room {roomEditForm.roomNumber}
                                            </span>
                                            <button
                                              type="button"
                                              onClick={cancelEditRoom}
                                              className="text-muted hover:text-foreground"
                                            >
                                              <X size={14} />
                                            </button>
                                          </div>

                                          <div>
                                            <label className="text-[10px] font-bold text-muted uppercase">Room #</label>
                                            <input
                                              type="text"
                                              value={roomEditForm.roomNumber || ""}
                                              onChange={(e) => setRoomEditForm({ ...roomEditForm, roomNumber: e.target.value })}
                                              className="w-full rounded-lg border border-border-color bg-surface px-2.5 py-1.5 text-xs text-foreground outline-none"
                                            />
                                          </div>

                                          <div className="grid grid-cols-2 gap-2">
                                            <div>
                                              <label className="text-[10px] font-bold text-muted uppercase">Type</label>
                                              <select
                                                value={roomEditForm.roomType || "standard"}
                                                onChange={(e) => setRoomEditForm({ ...roomEditForm, roomType: e.target.value as RoomType })}
                                                className="w-full rounded-lg border border-border-color bg-surface px-2 py-1.5 text-xs text-foreground outline-none capitalize"
                                              >
                                                <option value="standard">Standard</option>
                                                <option value="deluxe">Deluxe</option>
                                                <option value="executive_suite">Executive Suite</option>
                                                <option value="family_room">Family Room</option>
                                                <option value="penthouse">Penthouse</option>
                                              </select>
                                            </div>

                                            <div>
                                              <label className="text-[10px] font-bold text-muted uppercase">Status</label>
                                              <select
                                                value={roomEditForm.status || "available"}
                                                onChange={(e) => setRoomEditForm({ ...roomEditForm, status: e.target.value as RoomStatus })}
                                                className="w-full rounded-lg border border-border-color bg-surface px-2 py-1.5 text-xs text-foreground outline-none capitalize"
                                              >
                                                <option value="available">Available</option>
                                                <option value="occupied">Occupied</option>
                                                <option value="cleaning_needed">Cleaning Needed</option>
                                                <option value="maintenance">Maintenance</option>
                                                <option value="reserved">Reserved</option>
                                              </select>
                                            </div>
                                          </div>

                                          <div>
                                            <label className="text-[10px] font-bold text-muted uppercase">Nightly Rate (NAD)</label>
                                            <input
                                              type="number"
                                              min="0"
                                              value={roomEditForm.pricePerNight ?? 0}
                                              onChange={(e) => setRoomEditForm({ ...roomEditForm, pricePerNight: Number(e.target.value) })}
                                              className="w-full rounded-lg border border-border-color bg-surface px-2.5 py-1.5 text-xs text-foreground outline-none"
                                            />
                                          </div>

                                           {/* Booking Channel for this Room */}
                                           <div className="rounded-lg border border-border-color bg-surface/50 p-2.5 space-y-2">
                                             <label className="text-[10px] font-bold text-muted uppercase block">
                                               Booking Channel
                                             </label>
                                             <div className="grid grid-cols-2 gap-1.5">
                                               <button
                                                 type="button"
                                                 onClick={() => setRoomEditForm({ ...roomEditForm, bookingMode: "platform" })}
                                                 className={`flex flex-col items-start p-2 rounded-lg border text-left text-[11px] transition ${
                                                   (roomEditForm.bookingMode || "platform") === "platform"
                                                     ? "border-blue-600 bg-blue-600/10 text-blue-700 dark:text-blue-400 font-semibold"
                                                     : "border-border-color bg-surface text-muted hover:border-blue-400/50"
                                                 }`}
                                               >
                                                 <span className="font-bold">🏨 Paimbabook</span>
                                                 <span className="text-[9px] text-muted">Native booking</span>
                                               </button>
                                               <button
                                                 type="button"
                                                 onClick={() => setRoomEditForm({ ...roomEditForm, bookingMode: "external" })}
                                                 className={`flex flex-col items-start p-2 rounded-lg border text-left text-[11px] transition ${
                                                   roomEditForm.bookingMode === "external"
                                                     ? "border-indigo-600 bg-indigo-600/10 text-indigo-700 dark:text-indigo-400 font-semibold"
                                                     : "border-border-color bg-surface text-muted hover:border-indigo-400/50"
                                                 }`}
                                               >
                                                 <span className="font-bold flex items-center gap-1">
                                                   <ExternalLink size={10} /> Custom Link
                                                 </span>
                                                 <span className="text-[9px] text-muted">Direct / Affiliate</span>
                                               </button>
                                             </div>
                                             {roomEditForm.bookingMode === "external" && (
                                               <div className="pt-1">
                                                 <label className="text-[9px] text-muted block mb-0.5">External Booking URL *</label>
                                                 <input
                                                   type="url"
                                                   placeholder="https://example.com/book or affiliate link"
                                                   value={roomEditForm.externalBookingUrl || ""}
                                                   onChange={(e) => setRoomEditForm({ ...roomEditForm, externalBookingUrl: e.target.value })}
                                                   className="w-full rounded border border-border-color bg-surface px-2 py-1 text-xs text-foreground outline-none focus:border-indigo-600"
                                                   required
                                                 />
                                               </div>
                                             )}
                                           </div>

                                           {/* Promotional Discount */}
                                           <div className="rounded-lg border border-border-color bg-surface/50 p-2.5 space-y-2">
                                             <div className="flex items-center justify-between">
                                               <label className="text-[10px] font-bold text-muted uppercase flex items-center gap-1">
                                                 <Sparkles size={11} className="text-amber-500" /> Promotional Discount
                                               </label>
                                               {Number(roomEditForm.discountPercentage) > 0 ? (
                                                 <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-black text-amber-600">
                                                   {roomEditForm.discountPercentage}% OFF
                                                 </span>
                                               ) : (
                                                 <span className="text-[9px] text-muted font-semibold">Inactive</span>
                                               )}
                                             </div>

                                             {/* Movable Bar (Slider) from 5% to 100% */}
                                             <div className="space-y-1">
                                               <input
                                                 type="range"
                                                 min="0"
                                                 max="100"
                                                 step="5"
                                                 value={roomEditForm.discountPercentage || 0}
                                                 onChange={(e) => {
                                                   setRoomEditForm({ ...roomEditForm, discountPercentage: Number(e.target.value) });
                                                   setRoomDiscountPinError(null);
                                                 }}
                                                 className="w-full accent-amber-600 cursor-pointer h-1.5 bg-border-color rounded-lg appearance-none"
                                               />
                                               <div className="flex justify-between text-[8px] text-muted font-semibold">
                                                 <span>0%</span>
                                                 <span>25%</span>
                                                 <span>50%</span>
                                                 <span>75%</span>
                                                 <span>100%</span>
                                               </div>
                                             </div>

                                             {/* Presets */}
                                             <div className="flex flex-wrap gap-1">
                                               {[0, 5, 10, 15, 20, 25, 50, 75].map((pct) => (
                                                 <button
                                                   key={pct}
                                                   type="button"
                                                   onClick={() => {
                                                     setRoomEditForm({ ...roomEditForm, discountPercentage: pct });
                                                     setRoomDiscountPinError(null);
                                                   }}
                                                   className={`rounded px-1.5 py-0.5 text-[10px] font-bold transition ${
                                                     roomEditForm.discountPercentage === pct
                                                       ? "bg-amber-600 text-white"
                                                       : "border border-border-color bg-surface text-muted hover:border-amber-500"
                                                   }`}
                                                 >
                                                   {pct === 0 ? "Off" : `${pct}%`}
                                                 </button>
                                               ))}
                                             </div>

                                             <div className="grid grid-cols-2 gap-1.5 pt-1">
                                               <div>
                                                 <label className="text-[9px] text-muted block mb-0.5">Start Date</label>
                                                 <input
                                                   type="date"
                                                   value={roomEditForm.discountStartDate ?? ""}
                                                   onChange={(e) => setRoomEditForm({ ...roomEditForm, discountStartDate: e.target.value })}
                                                   className="w-full rounded border border-border-color bg-surface px-1 py-1 text-[11px] text-foreground outline-none"
                                                 />
                                               </div>
                                               <div>
                                                 <label className="text-[9px] text-muted block mb-0.5">End Date</label>
                                                 <input
                                                   type="date"
                                                   value={roomEditForm.discountEndDate ?? ""}
                                                   onChange={(e) => setRoomEditForm({ ...roomEditForm, discountEndDate: e.target.value })}
                                                   className="w-full rounded border border-border-color bg-surface px-1 py-1 text-[11px] text-foreground outline-none"
                                                 />
                                               </div>
                                             </div>

                                             {/* PIN Confirmation prompt if discount > 0 */}
                                             {Number(roomEditForm.discountPercentage) > 0 && (
                                               <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 space-y-1.5 mt-2">
                                                 <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 text-[11px] font-bold">
                                                   <KeyRound size={12} />
                                                   <span>PIN Required to Set Discount</span>
                                                 </div>
                                                 <p className="text-[10px] text-muted leading-tight">
                                                   Confirm setting <strong>{roomEditForm.discountPercentage}% discount</strong> on Room <strong>{roomEditForm.roomNumber}</strong>:
                                                 </p>
                                                 <input
                                                   type="password"
                                                   maxLength={8}
                                                   value={roomDiscountPin}
                                                   onChange={(e) => {
                                                     setRoomDiscountPin(e.target.value);
                                                     setRoomDiscountPinError(null);
                                                   }}
                                                   placeholder="PIN (default 1234)"
                                                   className="w-full rounded border border-border-color bg-surface px-2 py-1 text-xs text-foreground tracking-widest outline-none focus:border-amber-500"
                                                 />
                                                 {roomDiscountPinError && (
                                                   <p className="text-[10px] text-red-600 font-semibold flex items-center gap-1">
                                                     <AlertCircle size={10} /> {roomDiscountPinError}
                                                   </p>
                                                 )}
                                               </div>
                                             )}
                                           </div>

                                          {/* Photo upload */}
                                          <div>
                                            <label className="text-[10px] font-bold text-muted uppercase block mb-1">Room Photos</label>
                                            <div className="flex items-center gap-1.5 flex-wrap mb-2">
                                              {(roomEditForm.photos || []).map((url, i) => (
                                                <div key={i} className="relative h-10 w-10 rounded-lg overflow-hidden border border-border-color">
                                                  <img src={url} alt="" className="h-full w-full object-cover" />
                                                  <button
                                                    type="button"
                                                    onClick={() => removeRoomPhoto(i)}
                                                    className="absolute top-0 right-0 bg-black/70 text-white p-0.5 rounded-bl-sm"
                                                  >
                                                    <X size={10} />
                                                  </button>
                                                </div>
                                              ))}
                                            </div>
                                            <label className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-600 hover:underline cursor-pointer">
                                              <Upload size={12} />
                                              <span>{roomPhotoUploading ? "Uploading..." : "+ Upload Photo"}</span>
                                              <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => handleUploadRoomPhoto(e.target.files?.[0] || null)}
                                              />
                                            </label>
                                          </div>

                                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-color/40">
                                            <button
                                              type="button"
                                              onClick={cancelEditRoom}
                                              className="rounded-lg border border-border-color px-2.5 py-1 text-xs text-muted hover:bg-surface-elevated"
                                            >
                                              Cancel
                                            </button>
                                            <button
                                              type="button"
                                              onClick={handleSaveRoomEdit}
                                              disabled={savingRoom}
                                              className="rounded-lg bg-purple-600 px-3 py-1 text-xs font-bold text-white hover:bg-purple-700 disabled:opacity-50"
                                            >
                                              {savingRoom ? "Saving..." : "Save"}
                                            </button>
                                          </div>
                                        </div>
                                      ) : (
                                        /* Normal Room Card View */
                                        <div>
                                          <div className="flex items-start justify-between gap-2 mb-2">
                                            <div>
                                              <span className="font-black text-base text-foreground block">
                                                {room.roomNumber}
                                              </span>
                                              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted capitalize">
                                                {room.roomType.replace(/_/g, " ")}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-1 flex-wrap justify-end">
                                              {room.bookingMode === "external" && (
                                                <span className="rounded-full bg-indigo-500/15 px-1.5 py-0.5 text-[9px] font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-0.5">
                                                  <ExternalLink size={9} /> Direct Link
                                                </span>
                                              )}
                                              <span
                                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                                  room.status === "available"
                                                    ? "bg-green-500/10 text-green-700 dark:text-green-300"
                                                    : room.status === "occupied"
                                                    ? "bg-purple-500/10 text-purple-700 dark:text-purple-300"
                                                    : room.status === "cleaning_needed"
                                                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                                    : "bg-red-500/10 text-red-700 dark:text-red-300"
                                                }`}
                                              >
                                                {room.status.replace(/_/g, " ")}
                                              </span>
                                            </div>
                                          </div>

                                          <div className="flex items-center justify-between text-xs text-muted mt-3 pt-3 border-t border-border-color/40">
                                            {room.discountPercentage && room.discountPercentage > 0 ? (
                                              <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-black text-amber-600 dark:text-amber-400">
                                                  NAD {Math.round(room.pricePerNight * (1 - room.discountPercentage / 100))}
                                                  <span className="text-[10px] font-normal text-muted">/nt</span>
                                                </span>
                                                <span className="text-[10px] line-through text-muted">NAD {room.pricePerNight}</span>
                                                <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-black text-amber-600">
                                                  -{room.discountPercentage}%
                                                </span>
                                              </div>
                                            ) : (
                                              <span className="font-black text-foreground">
                                                NAD {room.pricePerNight}
                                                <span className="text-[10px] font-normal text-muted">/nt</span>
                                              </span>
                                            )}
                                            <button
                                              type="button"
                                              onClick={() => startEditRoom(room)}
                                              className="inline-flex items-center gap-1 rounded-lg border border-border-color bg-surface px-2 py-1 text-[11px] font-bold text-muted hover:text-foreground transition"
                                            >
                                              <Edit2 size={11} />
                                              <span>Edit</span>
                                            </button>
                                          </div>

                                          {/* Overstay checkout warning */}
                                          {isOverdue && (
                                            <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/20 p-2 text-[10px] font-bold text-red-600 animate-pulse">
                                              <AlertTriangle size={13} className="shrink-0" />
                                              <span>Checkout time passed but no checkout done, must check room</span>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              /* ====== LIST VIEW ====== */
                              <div className="overflow-x-auto rounded-xl border border-border-color/40 bg-surface">
                                <table className="w-full text-left text-xs">
                                  <thead className="border-b border-border-color/40 bg-surface-elevated/40 text-[10px] uppercase font-bold text-muted">
                                    <tr>
                                      <th className="p-3">Room #</th>
                                      <th className="p-3">Type</th>
                                      <th className="p-3">Status</th>
                                      <th className="p-3">Nightly Rate</th>
                                      <th className="p-3 text-right">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-border-color/30">
                                    {floorRooms.map((room) => {
                                      const isEditing = editingRoomId === room.id;
                                      const isOverdue = overdueRoomsMap[room.id];

                                      return (
                                        <tr
                                          key={room.id}
                                          className={`hover:bg-surface-elevated/30 transition ${
                                            isOverdue ? "bg-red-500/5" : ""
                                          }`}
                                        >
                                          <td className="p-3 font-bold text-foreground">
                                            {isEditing ? (
                                              <input
                                                type="text"
                                                value={roomEditForm.roomNumber || ""}
                                                onChange={(e) => setRoomEditForm({ ...roomEditForm, roomNumber: e.target.value })}
                                                className="w-24 rounded-lg border border-border-color bg-surface px-2 py-1 text-xs outline-none"
                                              />
                                            ) : (
                                              <div>
                                                <span>{room.roomNumber}</span>
                                                {isOverdue && (
                                                  <span className="block text-[10px] font-bold text-red-600">
                                                    ⚠️ Checkout time passed but no checkout done, must check room
                                                  </span>
                                                )}
                                              </div>
                                            )}
                                          </td>

                                          <td className="p-3 capitalize text-muted">
                                            {isEditing ? (
                                              <select
                                                value={roomEditForm.roomType || "standard"}
                                                onChange={(e) => setRoomEditForm({ ...roomEditForm, roomType: e.target.value as RoomType })}
                                                className="rounded-lg border border-border-color bg-surface px-2 py-1 text-xs outline-none"
                                              >
                                                <option value="standard">Standard</option>
                                                <option value="deluxe">Deluxe</option>
                                                <option value="executive_suite">Executive Suite</option>
                                                <option value="family_room">Family Room</option>
                                                <option value="penthouse">Penthouse</option>
                                              </select>
                                            ) : (
                                              room.roomType.replace(/_/g, " ")
                                            )}
                                          </td>

                                          <td className="p-3">
                                            {isEditing ? (
                                              <select
                                                value={roomEditForm.status || "available"}
                                                onChange={(e) => setRoomEditForm({ ...roomEditForm, status: e.target.value as RoomStatus })}
                                                className="rounded-lg border border-border-color bg-surface px-2 py-1 text-xs outline-none capitalize"
                                              >
                                                <option value="available">Available</option>
                                                <option value="occupied">Occupied</option>
                                                <option value="cleaning_needed">Cleaning Needed</option>
                                                <option value="maintenance">Maintenance</option>
                                                <option value="reserved">Reserved</option>
                                              </select>
                                            ) : (
                                              <span
                                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                                                  room.status === "available"
                                                    ? "bg-green-500/10 text-green-700 dark:text-green-300"
                                                    : room.status === "occupied"
                                                    ? "bg-purple-500/10 text-purple-700 dark:text-purple-300"
                                                    : room.status === "cleaning_needed"
                                                    ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                                    : "bg-red-500/10 text-red-700 dark:text-red-300"
                                                }`}
                                              >
                                                {room.status.replace(/_/g, " ")}
                                              </span>
                                            )}
                                          </td>

                                          <td className="p-3 font-bold text-foreground">
                                            {isEditing ? (
                                              <input
                                                type="number"
                                                min="0"
                                                value={roomEditForm.pricePerNight ?? 0}
                                                onChange={(e) => setRoomEditForm({ ...roomEditForm, pricePerNight: Number(e.target.value) })}
                                                className="w-24 rounded-lg border border-border-color bg-surface px-2 py-1 text-xs outline-none"
                                              />
                                            ) : (
                                              `NAD ${room.pricePerNight}`
                                            )}
                                          </td>

                                          <td className="p-3 text-right">
                                            {isEditing ? (
                                              <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                  type="button"
                                                  onClick={handleSaveRoomEdit}
                                                  disabled={savingRoom}
                                                  className="rounded-lg bg-purple-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-purple-700"
                                                >
                                                  {savingRoom ? "..." : "Save"}
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={cancelEditRoom}
                                                  className="rounded-lg border border-border-color px-2 py-1 text-[11px] text-muted hover:bg-surface-elevated"
                                                >
                                                  Cancel
                                                </button>
                                              </div>
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={() => startEditRoom(room)}
                                                className="inline-flex items-center gap-1 rounded-lg border border-border-color bg-surface-elevated px-2.5 py-1 text-[11px] font-bold text-muted hover:text-foreground transition"
                                              >
                                                <Edit2 size={11} />
                                                <span>Edit</span>
                                              </button>
                                            )}
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
