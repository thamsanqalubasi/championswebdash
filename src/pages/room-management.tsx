import { useState, useEffect } from "react";
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
} from "@/lib/data";
import type {
  CommercialRoom,
  PropertyRow,
  RoomType,
  HousekeepingSchedule,
  RoomServiceSchedule,
} from "@/lib/types";
import { useAuth } from "@/lib/auth";

export default function RoomManagementPage() {
  const { currentCompany, currentCompanyUser } = useAuth();
  const [activeTab, setActiveTab] = useState<"rooms" | "pricing" | "housekeeping" | "roomservice">("rooms");

  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [rooms, setRooms] = useState<CommercialRoom[]>([]);
  const [housekeeping, setHousekeeping] = useState<HousekeepingSchedule[]>([]);
  const [roomServices, setRoomServices] = useState<RoomServiceSchedule[]>([]);
  const [loading, setLoading] = useState(true);

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
  const [amenities, setAmenities] = useState<string[]>(["wifi", "tv", "ac"]);
  const [notes, setNotes] = useState("");

  // Uniform Pricing Form State
  const [uniBedOnly, setUniBedOnly] = useState(1000);
  const [uniBedBreakfast, setUniBedBreakfast] = useState(1300);
  const [uniBedLunch, setUniBedLunch] = useState(1600);
  const [uniFullBoard, setUniFullBoard] = useState(2000);
  const [uniSuccess, setUniSuccess] = useState(false);

  const loadData = async () => {
    setLoading(true);
    const props = await fetchProperties(currentCompany.id);
    setProperties(props);

    const activePropId = selectedPropertyId || props[0]?.id || "";
    setSelectedPropertyId(activePropId);

    const [allRooms, hk, rs] = await Promise.all([
      fetchCommercialRooms(currentCompany.id, activePropId),
      fetchHousekeepingSchedules(currentCompany.id),
      fetchRoomServiceSchedules(currentCompany.id),
    ]);

    setRooms(allRooms);
    setHousekeeping(hk);
    setRoomServices(rs);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [currentCompany.id, selectedPropertyId]);

  const openAddRoom = () => {
    setEditingRoom(null);
    setRoomNumber(`Room ${rooms.length + 101}`);
    setRoomType("standard");
    setFloor("Ground Floor");
    setCapacityAdults(2);
    setCapacityChildren(0);
    setPricePerNight(950);
    setPriceBedBreakfast(1250);
    setPriceBedLunch(1550);
    setPriceFullBoard(1950);
    setAmenities(["wifi", "tv", "ac"]);
    setNotes("");
    setRoomModalOpen(true);
  };

  const openEditRoom = (r: CommercialRoom) => {
    setEditingRoom(r);
    setRoomNumber(r.roomNumber);
    setRoomType(r.roomType);
    setFloor(r.floor);
    setCapacityAdults(r.capacityAdults);
    setCapacityChildren(r.capacityChildren);
    setPricePerNight(r.pricePerNight);
    setPriceBedBreakfast(r.priceBedBreakfast);
    setPriceBedLunch(r.priceBedLunch);
    setPriceFullBoard(r.priceFullBoard);
    setAmenities(r.amenities);
    setNotes(r.notes || "");
    setRoomModalOpen(true);
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
              className="rounded-2xl border border-border-color bg-surface p-5 shadow-sm transition hover:shadow-md"
            >
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

              <div className="mt-3 space-y-2 text-xs">
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

              <div className="mt-4 flex items-center justify-end gap-2 border-t border-border-color pt-3">
                <button
                  type="button"
                  onClick={() => openEditRoom(r)}
                  className="flex items-center gap-1 rounded-lg border border-border-color px-2.5 py-1 text-xs font-semibold text-muted hover:bg-surface-elevated hover:text-foreground"
                >
                  <Edit2 size={13} />
                  <span>Edit Room</span>
                </button>
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
                  <label className="mb-1 block font-medium text-foreground">Floor</label>
                  <input
                    type="text"
                    value={floor}
                    onChange={(e) => setFloor(e.target.value)}
                    className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                  />
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

              {/* Price tiers */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="mb-1 block font-medium text-foreground">Bed Only Rate (ZAR)</label>
                  <input
                    type="number"
                    value={pricePerNight}
                    onChange={(e) => setPricePerNight(Number(e.target.value))}
                    className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-foreground">Bed & Breakfast Rate (ZAR)</label>
                  <input
                    type="number"
                    value={priceBedBreakfast}
                    onChange={(e) => setPriceBedBreakfast(Number(e.target.value))}
                    className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-foreground">Bed, B/Fast & Lunch (ZAR)</label>
                  <input
                    type="number"
                    value={priceBedLunch}
                    onChange={(e) => setPriceBedLunch(Number(e.target.value))}
                    className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-foreground">Full Board Rate (ZAR)</label>
                  <input
                    type="number"
                    value={priceFullBoard}
                    onChange={(e) => setPriceFullBoard(Number(e.target.value))}
                    className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:border-blue-600 focus:outline-none"
                  />
                </div>
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
    </div>
  );
}

