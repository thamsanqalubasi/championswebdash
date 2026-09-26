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
  Camera,
  Layers,
  Timer,
  CalendarRange,
  UserCheck,
  AlertTriangle,
  ChevronRight,
  Eye,
} from "lucide-react";
import {
  fetchCommercialRooms,
  fetchProperties,
  saveCommercialRoom,
  setUniformRoomPricing,
  fetchHousekeepingSchedules,
  fetchHousekeepingShifts,
  createHousekeepingShift,
  createHousekeepingTask,
  startHousekeepingTask,
  completeHousekeepingTask,
  verifyHousekeepingTask,
  updateHousekeepingStatus,
  fetchRoomServiceSchedules,
  createRoomServiceOrder,
  updateRoomServiceOrderStatus,
  requestRoomServiceTrayRetrieval,
  completeRoomServiceTrayRetrieval,
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
  HousekeepingShift,
  HousekeepingScope,
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

function CleaningTimer({
  startedAt,
  targetMinutes,
  status,
  completedAt,
}: {
  startedAt?: string;
  targetMinutes?: number;
  status: string;
  completedAt?: string;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (status !== "in_progress" || !startedAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [status, startedAt]);

  if (!startedAt) {
    return (
      <span className="text-xs text-muted inline-flex items-center gap-1 font-mono">
        <Clock size={12} />
        Est. {targetMinutes || 30}m
      </span>
    );
  }

  const startMs = new Date(startedAt).getTime();
  const targetMs = (targetMinutes || 30) * 60 * 1000;

  if (status === "completed" || status === "verified") {
    const endMs = completedAt ? new Date(completedAt).getTime() : Date.now();
    const durationMin = Math.max(1, Math.round((endMs - startMs) / 60000));
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
        <CheckCircle2 size={12} />
        {durationMin}m total
      </span>
    );
  }

  const elapsedMs = now - startMs;
  const remainingMs = targetMs - elapsedMs;
  const isOverdue = remainingMs < 0;
  const absRemaining = Math.abs(remainingMs);
  const minutes = Math.floor(absRemaining / 60000);
  const seconds = Math.floor((absRemaining % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");

  if (isOverdue) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-black text-red-600 dark:text-red-400 animate-pulse bg-red-500/10 px-2.5 py-1 rounded-lg border border-red-500/30">
        <AlertTriangle size={12} />
        -{pad(minutes)}m {pad(seconds)}s (OVERDUE)
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20">
      <Clock size={12} />
      {pad(minutes)}m {pad(seconds)}s left
    </span>
  );
}

function RoomServiceTimer({
  scheduledTime,
  targetDeliveryTime,
  status,
  deliveredAt,
}: {
  scheduledTime: string;
  targetDeliveryTime?: string;
  status: string;
  deliveredAt?: string;
}) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (status === "delivered" || status === "cancelled") return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [status]);

  if (status === "delivered") {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
        <CheckCircle2 size={12} />
        Delivered {deliveredAt ? new Date(deliveredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
      </span>
    );
  }

  if (status === "cancelled") {
    return <span className="text-xs text-muted">Cancelled</span>;
  }

  const targetMs = targetDeliveryTime ? new Date(targetDeliveryTime).getTime() : new Date(scheduledTime).getTime();
  const diffMs = targetMs - now;
  const isOverdue = diffMs < 0;
  const absDiff = Math.abs(diffMs);
  const minutes = Math.floor(absDiff / 60000);
  const seconds = Math.floor((absDiff % 60000) / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");

  if (isOverdue) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-black text-red-600 dark:text-red-400 animate-pulse bg-red-500/10 px-2 py-0.5 rounded-lg border border-red-500/30">
        <AlertTriangle size={12} />
        -{pad(minutes)}m {pad(seconds)}s (LATE)
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-lg border border-blue-500/20">
      <Clock size={12} />
      {pad(minutes)}m {pad(seconds)}s
    </span>
  );
}

export default function RoomManagementPage() {
  const { currentCompany, currentCompanyUser } = useAuth();
  const { currency, symbol } = useCurrency();
  const [activeTab, setActiveTab] = useState<"rooms" | "pricing" | "housekeeping" | "roomservice">("rooms");

  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");
  const [rooms, setRooms] = useState<CommercialRoom[]>([]);
  const [housekeeping, setHousekeeping] = useState<HousekeepingSchedule[]>([]);
  const [housekeepingShifts, setHousekeepingShifts] = useState<HousekeepingShift[]>([]);
  const [roomServices, setRoomServices] = useState<RoomServiceSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  // Housekeeping enterprise filters & sub-tabs
  const [hkSubTab, setHkSubTab] = useState<"tasks" | "shifts" | "audits">("tasks");
  const [hkScopeFilter, setHkScopeFilter] = useState<"all" | "room" | "corridor">("all");
  const [hkShiftFilter, setHkShiftFilter] = useState<string>("all");
  const [hkPropertyFilter, setHkPropertyFilter] = useState<string>("all");

  // Room Service filters
  const [rsPropertyFilter, setRsPropertyFilter] = useState<string>("all");
  const [rsStatusFilter, setRsStatusFilter] = useState<string>("all");

  // Housekeeping Modals
  const [isNewTaskModalOpen, setIsNewTaskModalOpen] = useState(false);
  const [isNewShiftModalOpen, setIsNewShiftModalOpen] = useState(false);
  const [isCompleteTaskModalOpen, setIsCompleteTaskModalOpen] = useState(false);
  const [activeTaskForComplete, setActiveTaskForComplete] = useState<HousekeepingSchedule | null>(null);
  const [afterPhotosList, setAfterPhotosList] = useState<string[]>([]);
  const [completionNotes, setCompletionNotes] = useState("");
  const [uploadingAfterPhoto, setUploadingAfterPhoto] = useState(false);

  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditTask, setAuditTask] = useState<HousekeepingSchedule | null>(null);

  // New Task Form State
  const [taskScope, setTaskScope] = useState<HousekeepingScope>("room");
  const [taskPropertyId, setTaskPropertyId] = useState("");
  const [taskRoomId, setTaskRoomId] = useState("");
  const [taskFloor, setTaskFloor] = useState("Ground Floor");
  const [taskCorridorName, setTaskCorridorName] = useState("");
  const [taskShiftId, setTaskShiftId] = useState("");
  const [taskCleanerName, setTaskCleanerName] = useState("");
  const [taskCleaningType, setTaskCleaningType] = useState<string>("turnover_clean");
  const [taskPriority, setTaskPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [taskTargetMinutes, setTaskTargetMinutes] = useState(30);
  const [taskBeforePhotos, setTaskBeforePhotos] = useState<string[]>([]);
  const [taskNotes, setTaskNotes] = useState("");
  const [uploadingBeforePhoto, setUploadingBeforePhoto] = useState(false);

  // New Shift Form State
  const [shiftPropertyId, setShiftPropertyId] = useState("");
  const [shiftNameInput, setShiftNameInput] = useState("");
  const [shiftDateInput, setShiftDateInput] = useState(new Date().toISOString().slice(0, 10));
  const [shiftStartTimeInput, setShiftStartTimeInput] = useState("07:00");
  const [shiftEndTimeInput, setShiftEndTimeInput] = useState("15:30");
  const [shiftSupervisorInput, setShiftSupervisorInput] = useState("");
  const [shiftCleanersInput, setShiftCleanersInput] = useState("");
  const [shiftNotesInput, setShiftNotesInput] = useState("");

  // Room Service New Order Modal
  const [isNewRoomServiceModalOpen, setIsNewRoomServiceModalOpen] = useState(false);
  const [rsPropertyId, setRsPropertyId] = useState("");
  const [rsRoomId, setRsRoomId] = useState("");
  const [rsGuestName, setRsGuestName] = useState("");
  const [rsServiceType, setRsServiceType] = useState<string>("breakfast_delivery");
  const [rsRunnerName, setRsRunnerName] = useState("");
  const [rsItemName, setRsItemName] = useState("");
  const [rsItemPrice, setRsItemPrice] = useState(150);
  const [rsTargetMinutes, setRsTargetMinutes] = useState(25);
  const [rsNotes, setRsNotes] = useState("");

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

    // Strictly filter: only accommodation/hospitality properties, never residential/rental properties
    const accomm = props.filter((p) => {
      const t = (p.type || "").toLowerCase().trim();
      return ["hotel", "motel", "lodge", "guest_house", "commercial", "resort", "inn", "b&b", "hospitality"].includes(t);
    });
    setProperties(accomm);

    if ((!selectedPropertyId || !accomm.some((p) => p.id === selectedPropertyId)) && accomm.length > 0) {
      setSelectedPropertyId(accomm[0].id);
    }

    const rms = await fetchCommercialRooms(currentCompany.id, selectedPropertyId);
    const effectiveHkProp = hkPropertyFilter !== "all" ? hkPropertyFilter : selectedPropertyId;
    const hk = await fetchHousekeepingSchedules(currentCompany.id, effectiveHkProp);
    const shifts = await fetchHousekeepingShifts(currentCompany.id, effectiveHkProp);
    const effectiveRsProp = rsPropertyFilter !== "all" ? rsPropertyFilter : selectedPropertyId;
    const rs = await fetchRoomServiceSchedules(currentCompany.id, effectiveRsProp);
    const floors = await fetchPropertyFloors(currentCompany.id, selectedPropertyId);

    setRooms(rms);
    setHousekeeping(hk);
    setHousekeepingShifts(shifts);
    setRoomServices(rs);
    setPropertyFloors(floors);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [currentCompany.id, selectedPropertyId, hkPropertyFilter, rsPropertyFilter]);

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

  const handleStartCleaning = async (task: HousekeepingSchedule) => {
    await startHousekeepingTask(task.id);
    loadData();
  };

  const handleOpenCompleteModal = (task: HousekeepingSchedule) => {
    setActiveTaskForComplete(task);
    setAfterPhotosList(task.afterPhotos || []);
    setCompletionNotes(task.notes || "");
    setIsCompleteTaskModalOpen(true);
  };

  const handleUploadAfterPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingAfterPhoto(true);
    try {
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const url = await uploadFileToBucket("property-photos", "housekeeping-after", files[i]);
        urls.push(url);
      }
      setAfterPhotosList((prev) => [...prev, ...urls]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to upload after photo");
    } finally {
      setUploadingAfterPhoto(false);
    }
  };

  const handleUploadBeforePhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingBeforePhoto(true);
    try {
      const urls: string[] = [];
      for (let i = 0; i < files.length; i++) {
        const url = await uploadFileToBucket("property-photos", "housekeeping-before", files[i]);
        urls.push(url);
      }
      setTaskBeforePhotos((prev) => [...prev, ...urls]);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to upload before photo");
    } finally {
      setUploadingBeforePhoto(false);
    }
  };

  const handleConfirmCompleteTask = async () => {
    if (!activeTaskForComplete) return;
    await completeHousekeepingTask(activeTaskForComplete.id, afterPhotosList, completionNotes);
    setIsCompleteTaskModalOpen(false);
    setActiveTaskForComplete(null);
    loadData();
  };

  const handleVerifyInspection = async (task: HousekeepingSchedule) => {
    const defaultInspector = currentCompanyUser?.fullName || "Supervisor";
    const inspector = window.prompt("Enter Inspecting Supervisor / Manager Name:", defaultInspector);
    if (!inspector) return;
    await verifyHousekeepingTask(task.id, inspector);
    loadData();
  };

  const handleSaveNewTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const propId = taskPropertyId || selectedPropertyId;
    const prop = properties.find((p) => p.id === propId);
    const room = rooms.find((r) => r.id === taskRoomId);
    const shift = housekeepingShifts.find((s) => s.id === taskShiftId);

    await createHousekeepingTask({
      companyId: currentCompany.id,
      propertyId: propId,
      propertyName: prop?.name || "Accommodation Property",
      scopeType: taskScope,
      roomId: taskScope === "room" ? taskRoomId : undefined,
      roomNumber: taskScope === "room" ? room?.roomNumber : undefined,
      floor: taskFloor,
      corridorName: taskScope === "corridor" ? taskCorridorName : undefined,
      cleanerName: taskCleanerName || (shift?.assignedCleaners?.[0] ?? "Housekeeping Team"),
      cleaningType: taskCleaningType as any,
      shift: (shift?.shiftName.toLowerCase().includes("evening") ? "evening" : "morning") as any,
      customShiftName: shift?.shiftName || "Turnover Shift",
      shiftId: taskShiftId || undefined,
      priority: taskPriority,
      targetMinutes: Number(taskTargetMinutes) || 30,
      beforePhotos: taskBeforePhotos,
      notes: taskNotes,
    });

    setIsNewTaskModalOpen(false);
    setTaskBeforePhotos([]);
    setTaskNotes("");
    setTaskCorridorName("");
    loadData();
  };

  const handleSaveNewShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftNameInput.trim()) {
      alert("Please enter a Shift Name");
      return;
    }
    const propId = shiftPropertyId || selectedPropertyId;
    const prop = properties.find((p) => p.id === propId);
    const cleaners = shiftCleanersInput.split(",").map((c) => c.trim()).filter(Boolean);

    await createHousekeepingShift({
      companyId: currentCompany.id,
      propertyId: propId,
      propertyName: prop?.name || "Accommodation Property",
      shiftName: shiftNameInput.trim(),
      shiftDate: shiftDateInput,
      startTime: shiftStartTimeInput,
      endTime: shiftEndTimeInput,
      supervisorName: shiftSupervisorInput.trim() || currentCompanyUser?.fullName || "Constance Moyo",
      assignedCleaners: cleaners.length > 0 ? cleaners : ["Housekeeping Team"],
      notes: shiftNotesInput.trim(),
    });

    setIsNewShiftModalOpen(false);
    setShiftNameInput("");
    setShiftCleanersInput("");
    setShiftNotesInput("");
    loadData();
  };

  const handleSaveRoomServiceOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const propId = rsPropertyId || selectedPropertyId;
    const prop = properties.find((p) => p.id === propId);
    const room = rooms.find((r) => r.id === rsRoomId);

    const targetDelivery = new Date(Date.now() + (rsTargetMinutes || 25) * 60 * 1000).toISOString();

    await createRoomServiceOrder({
      companyId: currentCompany.id,
      propertyId: propId,
      propertyName: prop?.name || "Accommodation Property",
      roomId: rsRoomId,
      roomNumber: room?.roomNumber || "Room",
      guestName: rsGuestName || "In-house Guest",
      serviceType: rsServiceType as any,
      runnerName: rsRunnerName || "Butler Team",
      items: [{ name: rsItemName || "Gourmet Dining Tray", quantity: 1, unitPrice: Number(rsItemPrice) || 150 }],
      cost: Number(rsItemPrice) || 150,
      scheduledTime: new Date().toISOString(),
      targetDeliveryTime: targetDelivery,
      notes: rsNotes,
    });

    setIsNewRoomServiceModalOpen(false);
    setRsGuestName("");
    setRsItemName("");
    setRsNotes("");
    loadData();
  };

  const handleUpdateRsStatus = async (id: string, status: RoomServiceSchedule["status"]) => {
    await updateRoomServiceOrderStatus(id, status);
    loadData();
  };

  const handleRequestTrayRetrieval = async (id: string) => {
    await requestRoomServiceTrayRetrieval(id);
    loadData();
  };

  const handleCompleteTrayRetrieval = async (id: string) => {
    await completeRoomServiceTrayRetrieval(id);
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

      {/* TAB 3: ENTERPRISE HOUSEKEEPING QUEUE */}
      {activeTab === "housekeeping" && (
        <div className="space-y-4">
          {/* Housekeeping Control Bar */}
          <div className="flex flex-col gap-3 rounded-2xl border border-border-color bg-surface p-4 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {/* Property Filter */}
                <div className="flex items-center gap-2">
                  <Building2 size={15} className="text-muted" />
                  <select
                    value={hkPropertyFilter}
                    onChange={(e) => setHkPropertyFilter(e.target.value)}
                    className="rounded-xl border border-border-color bg-surface-elevated px-3 py-1.5 text-xs font-bold text-foreground focus:border-blue-600 focus:outline-none"
                  >
                    <option value="all">All Properties</option>
                    {properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sub-tab Pills */}
                <div className="flex items-center rounded-xl bg-surface-elevated p-1 border border-border-color/60">
                  <button
                    type="button"
                    onClick={() => setHkSubTab("tasks")}
                    className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                      hkSubTab === "tasks"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    Cleaning Tasks ({housekeeping.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHkSubTab("shifts")}
                    className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                      hkSubTab === "shifts"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    Custom Shifts ({housekeepingShifts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHkSubTab("audits")}
                    className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                      hkSubTab === "audits"
                        ? "bg-blue-600 text-white shadow-xs"
                        : "text-muted hover:text-foreground"
                    }`}
                  >
                    Before/After Audits ({housekeeping.filter((h) => (h.beforePhotos && h.beforePhotos.length > 0) || (h.afterPhotos && h.afterPhotos.length > 0)).length})
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => {
                    setShiftPropertyId(selectedPropertyId || properties[0]?.id || "");
                    setIsNewShiftModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 rounded-xl border border-border-color bg-surface-elevated px-3 py-1.5 text-xs font-bold text-foreground hover:bg-surface-elevated/80 transition shadow-xs"
                >
                  <CalendarRange size={14} className="text-purple-600" />
                  <span>+ New Shift</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTaskPropertyId(selectedPropertyId || properties[0]?.id || "");
                    setTaskRoomId(rooms[0]?.id || "");
                    setTaskShiftId(housekeepingShifts[0]?.id || "");
                    setIsNewTaskModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition"
                >
                  <Plus size={14} />
                  <span>Schedule Task (Room / Corridor)</span>
                </button>
              </div>
            </div>

            {/* Sub-Filters for Tasks */}
            {hkSubTab === "tasks" && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-color/60 pt-3">
                {/* Scope Filters */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-bold text-muted uppercase tracking-wider mr-1">Scope:</span>
                  <button
                    type="button"
                    onClick={() => setHkScopeFilter("all")}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      hkScopeFilter === "all"
                        ? "bg-foreground text-surface"
                        : "bg-surface-elevated text-muted hover:text-foreground"
                    }`}
                  >
                    All Scopes
                  </button>
                  <button
                    type="button"
                    onClick={() => setHkScopeFilter("room")}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      hkScopeFilter === "room"
                        ? "bg-blue-600 text-white"
                        : "bg-surface-elevated text-muted hover:text-foreground"
                    }`}
                  >
                    <BedDouble size={13} />
                    <span>Rooms ({housekeeping.filter((h) => !h.scopeType || h.scopeType === "room").length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHkScopeFilter("corridor")}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                      hkScopeFilter === "corridor"
                        ? "bg-purple-600 text-white"
                        : "bg-surface-elevated text-muted hover:text-foreground"
                    }`}
                  >
                    <Layers size={13} />
                    <span>Corridors & Hallways ({housekeeping.filter((h) => h.scopeType === "corridor").length})</span>
                  </button>
                </div>

                {/* Shift Filter Dropdown */}
                {housekeepingShifts.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-semibold text-muted">Filter Shift:</span>
                    <select
                      value={hkShiftFilter}
                      onChange={(e) => setHkShiftFilter(e.target.value)}
                      className="rounded-lg border border-border-color bg-surface-elevated px-2.5 py-1 text-xs font-medium text-foreground focus:outline-none"
                    >
                      <option value="all">All Shifts</option>
                      {housekeepingShifts.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.shiftName} ({s.startTime}–{s.endTime})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* VIEW 1: CLEANING TASKS TABLE */}
          {hkSubTab === "tasks" && (
            <div className="rounded-2xl border border-border-color bg-surface overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border-color bg-surface-elevated/70 text-[11px] font-bold uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-3.5">Target & Scope</th>
                    <th className="px-4 py-3.5">Shift & Cleaner</th>
                    <th className="px-4 py-3.5">Task Type & Priority</th>
                    <th className="px-4 py-3.5">Live Cleaning Timer</th>
                    <th className="px-4 py-3.5">Audit Photos</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-color text-foreground">
                  {housekeeping
                    .filter((h) => {
                      if (hkScopeFilter === "room" && h.scopeType && h.scopeType !== "room") return false;
                      if (hkScopeFilter === "corridor" && h.scopeType !== "corridor") return false;
                      if (hkShiftFilter !== "all" && h.shiftId !== hkShiftFilter) return false;
                      return true;
                    })
                    .map((h) => {
                      const isCorridor = h.scopeType === "corridor";
                      const hasBeforePhotos = h.beforePhotos && h.beforePhotos.length > 0;
                      const hasAfterPhotos = h.afterPhotos && h.afterPhotos.length > 0;

                      return (
                        <tr key={h.id} className="hover:bg-surface-elevated/30 transition">
                          {/* Target & Scope */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              {isCorridor ? (
                                <span className="rounded-lg bg-purple-500/10 p-1.5 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                  <Layers size={15} />
                                </span>
                              ) : (
                                <span className="rounded-lg bg-blue-500/10 p-1.5 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                  <BedDouble size={15} />
                                </span>
                              )}
                              <div>
                                <p className="font-bold text-foreground">
                                  {isCorridor ? (h.corridorName || "Floor Corridor") : (h.roomNumber || "Room")}
                                </p>
                                <p className="text-[11px] text-muted">
                                  {h.floor || "Ground Floor"} • {h.propertyName}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Shift & Cleaner */}
                          <td className="px-4 py-3.5">
                            <p className="font-semibold text-foreground text-xs">{h.cleanerName}</p>
                            <p className="text-[10px] font-mono text-purple-600 dark:text-purple-400">
                              {h.customShiftName || h.shift}
                            </p>
                          </td>

                          {/* Task Type & Priority */}
                          <td className="px-4 py-3.5">
                            <span className="capitalize font-medium text-xs block">
                              {h.cleaningType.replace(/_/g, " ")}
                            </span>
                            <span
                              className={`inline-block mt-0.5 rounded-full px-2 py-0.2 text-[10px] font-black uppercase ${
                                h.priority === "urgent"
                                  ? "bg-red-500/15 text-red-600 animate-pulse"
                                  : h.priority === "high"
                                  ? "bg-amber-500/15 text-amber-600"
                                  : "bg-muted/15 text-muted"
                              }`}
                            >
                              {h.priority}
                            </span>
                          </td>

                          {/* Live Cleaning Timer */}
                          <td className="px-4 py-3.5">
                            <CleaningTimer
                              startedAt={h.startedAt}
                              targetMinutes={h.targetMinutes}
                              status={h.status}
                              completedAt={h.completedAt}
                            />
                          </td>

                          {/* Photos Preview */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-1.5">
                              {hasBeforePhotos ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAuditTask(h);
                                    setIsAuditModalOpen(true);
                                  }}
                                  className="group relative h-8 w-8 rounded-lg overflow-hidden border border-border-color hover:scale-105 transition"
                                  title="View Before Photo"
                                >
                                  <img
                                    src={h.beforePhotos![0]}
                                    alt="Before"
                                    className="h-full w-full object-cover"
                                  />
                                  <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[8px] font-bold text-white text-center">
                                    Pre
                                  </span>
                                </button>
                              ) : (
                                <span className="text-[11px] text-muted italic">No photos</span>
                              )}

                              {hasAfterPhotos && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAuditTask(h);
                                    setIsAuditModalOpen(true);
                                  }}
                                  className="group relative h-8 w-8 rounded-lg overflow-hidden border border-emerald-500/40 hover:scale-105 transition"
                                  title="View After Photo"
                                >
                                  <img
                                    src={h.afterPhotos![0]}
                                    alt="After"
                                    className="h-full w-full object-cover"
                                  />
                                  <span className="absolute bottom-0 inset-x-0 bg-emerald-600/80 text-[8px] font-bold text-white text-center">
                                    Post
                                  </span>
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                h.status === "verified"
                                  ? "bg-purple-500/15 text-purple-600 dark:text-purple-400"
                                  : h.status === "completed"
                                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                  : h.status === "in_progress"
                                  ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                              }`}
                            >
                              {h.status === "verified" && <Shield size={11} />}
                              {h.status.replace(/_/g, " ")}
                            </span>
                            {h.inspectedBy && (
                              <p className="text-[10px] text-muted mt-0.5">
                                By {h.inspectedBy}
                              </p>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {h.status === "pending" && (
                                <button
                                  type="button"
                                  onClick={() => handleStartCleaning(h)}
                                  className="flex items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-bold text-white shadow-xs hover:bg-blue-700 transition"
                                >
                                  <Timer size={12} />
                                  <span>Start</span>
                                </button>
                              )}

                              {h.status === "in_progress" && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenCompleteModal(h)}
                                  className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition"
                                >
                                  <Camera size={12} />
                                  <span>Mark Cleaned</span>
                                </button>
                              )}

                              {h.status === "completed" && (
                                <button
                                  type="button"
                                  onClick={() => handleVerifyInspection(h)}
                                  className="flex items-center gap-1 rounded-lg border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-xs font-bold text-purple-600 hover:bg-purple-500/20 transition"
                                >
                                  <UserCheck size={12} />
                                  <span>Verify</span>
                                </button>
                              )}

                              {(hasBeforePhotos || hasAfterPhotos) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAuditTask(h);
                                    setIsAuditModalOpen(true);
                                  }}
                                  className="p-1 rounded-lg text-muted hover:text-foreground hover:bg-surface-elevated transition"
                                  title="Audit Photos Comparison"
                                >
                                  <Eye size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

          {/* VIEW 2: SHIFT MANAGEMENT */}
          {hkSubTab === "shifts" && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {housekeepingShifts.map((s) => (
                <div
                  key={s.id}
                  className="rounded-2xl border border-border-color bg-surface p-5 space-y-3 shadow-xs"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-bold text-purple-600 dark:text-purple-400">
                        <Clock size={11} />
                        {s.startTime} – {s.endTime}
                      </span>
                      <h4 className="text-base font-black text-foreground mt-1.5">
                        {s.shiftName}
                      </h4>
                      <p className="text-xs text-muted">{s.propertyName}</p>
                    </div>
                    <span className="font-mono text-xs text-muted">
                      {s.shiftDate}
                    </span>
                  </div>

                  <div className="space-y-1.5 border-t border-border-color/60 pt-2 text-xs">
                    {s.supervisorName && (
                      <p className="text-muted">
                        Supervisor: <strong className="text-foreground">{s.supervisorName}</strong>
                      </p>
                    )}
                    <div>
                      <span className="text-muted block mb-1 font-semibold">Assigned Cleaners:</span>
                      <div className="flex flex-wrap gap-1">
                        {s.assignedCleaners && s.assignedCleaners.length > 0 ? (
                          s.assignedCleaners.map((c, i) => (
                            <span
                              key={i}
                              className="rounded-md bg-surface-elevated px-2 py-0.5 text-[11px] font-medium text-foreground border border-border-color/60"
                            >
                              {c}
                            </span>
                          ))
                        ) : (
                          <span className="text-muted italic">General housekeeping team</span>
                        )}
                      </div>
                    </div>
                    {s.notes && (
                      <p className="text-[11px] text-muted italic pt-1">"{s.notes}"</p>
                    )}
                  </div>
                </div>
              ))}

              {/* Add Shift Action Card */}
              <div
                onClick={() => {
                  setShiftPropertyId(selectedPropertyId || properties[0]?.id || "");
                  setIsNewShiftModalOpen(true);
                }}
                className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border-color bg-surface-elevated/40 p-6 text-center hover:border-blue-500 hover:bg-surface-elevated cursor-pointer transition"
              >
                <div className="rounded-xl bg-blue-500/10 p-3 text-blue-600 mb-2">
                  <CalendarRange size={22} />
                </div>
                <h4 className="text-sm font-bold text-foreground">+ Add New Custom Shift</h4>
                <p className="text-xs text-muted mt-0.5">
                  Configure custom shift windows (e.g. 07:00–15:30) and supervisor
                </p>
              </div>
            </div>
          )}

          {/* VIEW 3: PHOTO AUDITS GALLERY */}
          {hkSubTab === "audits" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {housekeeping
                .filter((h) => (h.beforePhotos && h.beforePhotos.length > 0) || (h.afterPhotos && h.afterPhotos.length > 0))
                .map((h) => (
                  <div
                    key={h.id}
                    className="rounded-2xl border border-border-color bg-surface p-4 space-y-3 shadow-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-foreground text-sm">
                          {h.scopeType === "corridor" ? h.corridorName : h.roomNumber}
                        </h4>
                        <p className="text-xs text-muted">
                          {h.floor || "Floor"} • Cleaner: {h.cleanerName}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                          h.status === "verified"
                            ? "bg-purple-500/15 text-purple-600"
                            : "bg-emerald-500/15 text-emerald-600"
                        }`}
                      >
                        {h.status}
                      </span>
                    </div>

                    {/* Side-by-side Before & After */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-muted">
                          Before Cleaning
                        </span>
                        {h.beforePhotos && h.beforePhotos.length > 0 ? (
                          <div className="h-32 rounded-xl overflow-hidden border border-border-color bg-surface-elevated">
                            <img
                              src={h.beforePhotos[0]}
                              alt="Before"
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="h-32 rounded-xl border border-dashed border-border-color flex items-center justify-center text-xs text-muted">
                            No Before Photo
                          </div>
                        )}
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600">
                          After Cleaning
                        </span>
                        {h.afterPhotos && h.afterPhotos.length > 0 ? (
                          <div className="h-32 rounded-xl overflow-hidden border border-emerald-500/40 bg-surface-elevated">
                            <img
                              src={h.afterPhotos[0]}
                              alt="After"
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="h-32 rounded-xl border border-dashed border-border-color flex items-center justify-center text-xs text-muted">
                            Pending After Photo
                          </div>
                        )}
                      </div>
                    </div>

                    {h.notes && (
                      <p className="text-xs text-foreground italic bg-surface-elevated p-2 rounded-lg border border-border-color/60">
                        "{h.notes}"
                      </p>
                    )}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: ROOM SERVICE & CORRIDOR TRAY RETRIEVALS */}
      {activeTab === "roomservice" && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border-color bg-surface p-4 shadow-sm">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Building2 size={15} className="text-muted" />
                <select
                  value={rsPropertyFilter}
                  onChange={(e) => setRsPropertyFilter(e.target.value)}
                  className="rounded-xl border border-border-color bg-surface-elevated px-3 py-1.5 text-xs font-bold text-foreground focus:outline-none"
                >
                  <option value="all">All Properties</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                <span className="font-semibold text-muted">Filter:</span>
                <button
                  type="button"
                  onClick={() => setRsStatusFilter("all")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    rsStatusFilter === "all" ? "bg-foreground text-surface" : "bg-surface-elevated text-muted"
                  }`}
                >
                  All ({roomServices.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRsStatusFilter("in_flight")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    rsStatusFilter === "in_flight" ? "bg-blue-600 text-white" : "bg-surface-elevated text-muted"
                  }`}
                >
                  In-Flight ({roomServices.filter((r) => r.status === "preparing" || r.status === "out_for_delivery").length})
                </button>
                <button
                  type="button"
                  onClick={() => setRsStatusFilter("tray_pending")}
                  className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                    rsStatusFilter === "tray_pending" ? "bg-amber-600 text-white" : "bg-surface-elevated text-muted"
                  }`}
                >
                  Corridor Tray Collection ({roomServices.filter((r) => r.trayRetrievalStatus === "pending_retrieval").length})
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setRsPropertyId(selectedPropertyId || properties[0]?.id || "");
                setRsRoomId(rooms[0]?.id || "");
                setIsNewRoomServiceModalOpen(true);
              }}
              className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md hover:bg-blue-700 transition"
            >
              <Plus size={14} />
              <span>+ New Room Service Order</span>
            </button>
          </div>

          {/* Orders Table */}
          <div className="rounded-2xl border border-border-color bg-surface overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border-color bg-surface-elevated/70 text-[11px] font-bold uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-3.5">Room & Guest</th>
                  <th className="px-4 py-3.5">Service & Items</th>
                  <th className="px-4 py-3.5">Runner / Butler</th>
                  <th className="px-4 py-3.5">Delivery Countdown</th>
                  <th className="px-4 py-3.5">Cost</th>
                  <th className="px-4 py-3.5">Status & Tray Retrieval</th>
                  <th className="px-4 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-color text-foreground">
                {roomServices
                  .filter((rs) => {
                    if (rsStatusFilter === "in_flight") {
                      return rs.status === "preparing" || rs.status === "out_for_delivery";
                    }
                    if (rsStatusFilter === "tray_pending") {
                      return rs.trayRetrievalStatus === "pending_retrieval";
                    }
                    return true;
                  })
                  .map((rs) => {
                    const isTrayPending = rs.trayRetrievalStatus === "pending_retrieval";

                    return (
                      <tr
                        key={rs.id}
                        className={`transition ${
                          isTrayPending
                            ? "bg-amber-500/5 hover:bg-amber-500/10"
                            : "hover:bg-surface-elevated/30"
                        }`}
                      >
                        <td className="px-4 py-3.5 font-bold text-foreground">
                          <p>{rs.roomNumber} · {rs.guestName}</p>
                          <p className="text-[11px] text-muted">{rs.propertyName}</p>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="capitalize font-bold text-xs text-foreground block">
                            {rs.serviceType.replace(/_/g, " ")}
                          </span>
                          <p className="text-xs text-muted">
                            {rs.items && rs.items.length > 0
                              ? rs.items.map((i) => `${i.quantity}x ${i.name}`).join(", ")
                              : "Standard Service Tray"}
                          </p>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="font-semibold text-xs text-foreground">
                            {rs.runnerName || "Unassigned"}
                          </span>
                        </td>

                        <td className="px-4 py-3.5">
                          <RoomServiceTimer
                            scheduledTime={rs.scheduledTime}
                            targetDeliveryTime={rs.targetDeliveryTime}
                            status={rs.status}
                            deliveredAt={rs.deliveredAt}
                          />
                        </td>

                        <td className="px-4 py-3.5 font-black text-foreground">
                          R{rs.cost}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="space-y-1">
                            <span
                              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-bold capitalize ${
                                rs.status === "delivered"
                                  ? "bg-emerald-500/10 text-emerald-600"
                                  : rs.status === "out_for_delivery"
                                  ? "bg-purple-500/10 text-purple-600"
                                  : rs.status === "preparing"
                                  ? "bg-amber-500/10 text-amber-600"
                                  : "bg-blue-500/10 text-blue-600"
                              }`}
                            >
                              {rs.status.replace(/_/g, " ")}
                            </span>

                            {isTrayPending && (
                              <div className="flex items-center gap-1 text-[11px] font-black text-amber-600 dark:text-amber-400 animate-pulse">
                                <AlertTriangle size={11} />
                                <span>Hallway Tray Retrieval Needed</span>
                              </div>
                            )}
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {rs.status === "requested" && (
                              <button
                                type="button"
                                onClick={() => handleUpdateRsStatus(rs.id, "preparing")}
                                className="rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-bold text-white shadow-xs hover:bg-amber-700"
                              >
                                Preparing
                              </button>
                            )}

                            {rs.status === "preparing" && (
                              <button
                                type="button"
                                onClick={() => handleUpdateRsStatus(rs.id, "out_for_delivery")}
                                className="rounded-lg bg-purple-600 px-2.5 py-1 text-xs font-bold text-white shadow-xs hover:bg-purple-700"
                              >
                                Out for Delivery
                              </button>
                            )}

                            {rs.status === "out_for_delivery" && (
                              <button
                                type="button"
                                onClick={() => handleUpdateRsStatus(rs.id, "delivered")}
                                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                              >
                                Mark Delivered
                              </button>
                            )}

                            {rs.status === "delivered" && !isTrayPending && rs.trayRetrievalStatus !== "retrieved" && (
                              <button
                                type="button"
                                onClick={() => handleRequestTrayRetrieval(rs.id)}
                                className="flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-bold text-amber-600 hover:bg-amber-500/20"
                                title="Guest finished; tray placed in hallway"
                              >
                                <Bell size={11} />
                                <span>Tray in Hallway</span>
                              </button>
                            )}

                            {isTrayPending && (
                              <button
                                type="button"
                                onClick={() => handleCompleteTrayRetrieval(rs.id)}
                                className="flex items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-bold text-white shadow-xs hover:bg-amber-700 animate-bounce"
                                title="Collect finished tray from floor corridor"
                              >
                                <CheckCircle2 size={12} />
                                <span>Collect Tray</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
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

      {/* MODAL 1: SCHEDULE CLEANING TASK (ROOM OR CORRIDOR) */}
      {isNewTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex flex-col max-h-[92vh] w-full max-w-xl overflow-hidden rounded-3xl border border-border-color bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-color px-6 py-4 bg-surface-elevated/40">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-blue-500/10 p-2 text-blue-600">
                  <Brush size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Schedule Cleaning Task</h3>
                  <p className="text-xs text-muted">Assign room or floor corridor cleaning with target timers</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewTaskModalOpen(false)}
                className="rounded-xl p-1.5 text-muted hover:bg-surface-elevated hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveNewTask} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              {/* Scope Selection */}
              <div>
                <label className="font-bold text-foreground block mb-1">Target Cleaning Scope *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTaskScope("room")}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 font-bold transition ${
                      taskScope === "room"
                        ? "border-blue-600 bg-blue-500/10 text-blue-600 shadow-xs"
                        : "border-border-color bg-surface-elevated text-muted hover:text-foreground"
                    }`}
                  >
                    <BedDouble size={16} />
                    <span>Individual Room</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTaskScope("corridor")}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-3 font-bold transition ${
                      taskScope === "corridor"
                        ? "border-purple-600 bg-purple-500/10 text-purple-600 shadow-xs"
                        : "border-border-color bg-surface-elevated text-muted hover:text-foreground"
                    }`}
                  >
                    <Layers size={16} />
                    <span>Floor Corridor / Wing</span>
                  </button>
                </div>
              </div>

              {/* Property Selection */}
              <div>
                <label className="font-bold text-foreground block mb-1">Accommodation Property *</label>
                <select
                  value={taskPropertyId || selectedPropertyId}
                  onChange={(e) => setTaskPropertyId(e.target.value)}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 font-medium text-foreground focus:outline-none"
                  required
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Scope Fields */}
              {taskScope === "room" ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-foreground block mb-1">Select Room *</label>
                    <select
                      value={taskRoomId}
                      onChange={(e) => setTaskRoomId(e.target.value)}
                      className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 font-medium text-foreground focus:outline-none"
                      required
                    >
                      <option value="">Select a room...</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.roomNumber} ({r.roomType}) - Floor: {r.floor}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-foreground block mb-1">Cleaning Type *</label>
                    <select
                      value={taskCleaningType}
                      onChange={(e) => setTaskCleaningType(e.target.value)}
                      className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 font-medium text-foreground focus:outline-none"
                    >
                      <option value="turnover_clean">Turnover Clean (Checkout)</option>
                      <option value="daily_tidy">Daily Tidy (Stayover)</option>
                      <option value="deep_clean">Deep Clean</option>
                      <option value="inspection">Inspection Only</option>
                      <option value="sanitization">Sanitization</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-foreground block mb-1">Floor *</label>
                      <select
                        value={taskFloor}
                        onChange={(e) => setTaskFloor(e.target.value)}
                        className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 font-medium text-foreground focus:outline-none"
                      >
                        {propertyFloors.map((f, i) => (
                          <option key={i} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="font-bold text-foreground block mb-1">Cleaning Type *</label>
                      <select
                        value={taskCleaningType}
                        onChange={(e) => setTaskCleaningType(e.target.value)}
                        className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 font-medium text-foreground focus:outline-none"
                      >
                        <option value="sanitization">Floor Mopping & Sanitization</option>
                        <option value="deep_clean">Deep Clean & Carpet Shampoo</option>
                        <option value="daily_tidy">Trash & Linen Clearing</option>
                        <option value="inspection">Safety & Cleanliness Inspection</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="font-bold text-foreground block mb-1">Corridor / Aisle Name *</label>
                    <input
                      type="text"
                      value={taskCorridorName}
                      onChange={(e) => setTaskCorridorName(e.target.value)}
                      placeholder="e.g. East Wing Corridor & Lobby Aisle"
                      className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:outline-none"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Shift & Cleaner */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">Assigned Shift</label>
                  <select
                    value={taskShiftId}
                    onChange={(e) => setTaskShiftId(e.target.value)}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 font-medium text-foreground focus:outline-none"
                  >
                    <option value="">Select custom shift...</option>
                    {housekeepingShifts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.shiftName} ({s.startTime}–{s.endTime})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">Cleaner Name</label>
                  <input
                    type="text"
                    value={taskCleanerName}
                    onChange={(e) => setTaskCleanerName(e.target.value)}
                    placeholder="e.g. Maria Sithole"
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:outline-none"
                  />
                </div>
              </div>

              {/* Priority & Target Minutes */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">Priority</label>
                  <select
                    value={taskPriority}
                    onChange={(e) => setTaskPriority(e.target.value as any)}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 font-medium text-foreground focus:outline-none"
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High Priority</option>
                    <option value="urgent">Urgent</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">Target Duration (Minutes) *</label>
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={taskTargetMinutes}
                    onChange={(e) => setTaskTargetMinutes(Number(e.target.value))}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:outline-none"
                    required
                  />
                  <span className="text-[10px] text-muted">Timer turns red if cleaning exceeds this duration</span>
                </div>
              </div>

              {/* Upload Before Photos */}
              <div>
                <label className="font-bold text-foreground block mb-1">Before Cleaning Photos (Optional)</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleUploadBeforePhotos}
                  disabled={uploadingBeforePhoto}
                  className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-500/10 file:text-blue-600 hover:file:bg-blue-500/20"
                />
                {uploadingBeforePhoto && <p className="text-muted mt-1">Uploading before photos...</p>}
                {taskBeforePhotos.length > 0 && (
                  <div className="flex gap-2 pt-2">
                    {taskBeforePhotos.map((url, i) => (
                      <img key={i} src={url} alt="Before" className="h-14 w-14 rounded-lg object-cover border border-border-color" />
                    ))}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="font-bold text-foreground block mb-1">Instructions / Notes</label>
                <input
                  type="text"
                  value={taskNotes}
                  onChange={(e) => setTaskNotes(e.target.value)}
                  placeholder="e.g. VIP guest checking in early, change all linens and sanitize touchpoints"
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-color">
                <button
                  type="button"
                  onClick={() => setIsNewTaskModalOpen(false)}
                  className="rounded-xl border border-border-color px-4 py-2 font-bold text-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white shadow-md hover:bg-blue-700"
                >
                  Create Cleaning Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: NEW CUSTOM SHIFT */}
      {isNewShiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex flex-col max-h-[92vh] w-full max-w-lg overflow-hidden rounded-3xl border border-border-color bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-color px-6 py-4 bg-surface-elevated/40">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-purple-500/10 p-2 text-purple-600">
                  <CalendarRange size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Configure Custom Shift</h3>
                  <p className="text-xs text-muted">Create custom shifts with defined working hours and supervisors</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewShiftModalOpen(false)}
                className="rounded-xl p-1.5 text-muted hover:bg-surface-elevated hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveNewShift} className="p-6 space-y-4 text-xs">
              <div>
                <label className="font-bold text-foreground block mb-1">Shift Name *</label>
                <input
                  type="text"
                  value={shiftNameInput}
                  onChange={(e) => setShiftNameInput(e.target.value)}
                  placeholder="e.g. Morning Turnover & Deep Clean, Evening Turndown"
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:outline-none"
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">Shift Date *</label>
                  <input
                    type="date"
                    value={shiftDateInput}
                    onChange={(e) => setShiftDateInput(e.target.value)}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">Start Time *</label>
                  <input
                    type="time"
                    value={shiftStartTimeInput}
                    onChange={(e) => setShiftStartTimeInput(e.target.value)}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">End Time *</label>
                  <input
                    type="time"
                    value={shiftEndTimeInput}
                    onChange={(e) => setShiftEndTimeInput(e.target.value)}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Shift Supervisor Name</label>
                <input
                  type="text"
                  value={shiftSupervisorInput}
                  onChange={(e) => setShiftSupervisorInput(e.target.value)}
                  placeholder="e.g. Constance Moyo"
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Assigned Cleaners (Comma-separated)</label>
                <input
                  type="text"
                  value={shiftCleanersInput}
                  onChange={(e) => setShiftCleanersInput(e.target.value)}
                  placeholder="e.g. Maria Sithole, Grace Mabena, Kudzai Dube"
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Shift Directives / Notes</label>
                <input
                  type="text"
                  value={shiftNotesInput}
                  onChange={(e) => setShiftNotesInput(e.target.value)}
                  placeholder="e.g. Priority on Ground Floor checkouts before 11:00"
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-color">
                <button
                  type="button"
                  onClick={() => setIsNewShiftModalOpen(false)}
                  className="rounded-xl border border-border-color px-4 py-2 font-bold text-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-purple-600 px-5 py-2 font-bold text-white shadow-md hover:bg-purple-700"
                >
                  Save Shift
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: MARK TASK CLEANED WITH AFTER PHOTOS */}
      {isCompleteTaskModalOpen && activeTaskForComplete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex flex-col max-h-[92vh] w-full max-w-lg overflow-hidden rounded-3xl border border-border-color bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-color px-6 py-4 bg-surface-elevated/40">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-600">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Mark Cleaned &amp; Upload Proof</h3>
                  <p className="text-xs text-muted">
                    {activeTaskForComplete.scopeType === "corridor"
                      ? activeTaskForComplete.corridorName
                      : activeTaskForComplete.roomNumber}{" "}
                    • {activeTaskForComplete.propertyName}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsCompleteTaskModalOpen(false)}
                className="rounded-xl p-1.5 text-muted hover:bg-surface-elevated hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs overflow-y-auto">
              {/* Before Photo Review */}
              {activeTaskForComplete.beforePhotos && activeTaskForComplete.beforePhotos.length > 0 && (
                <div>
                  <span className="font-bold text-muted block mb-1">Before Cleaning Photo</span>
                  <img
                    src={activeTaskForComplete.beforePhotos[0]}
                    alt="Before"
                    className="h-28 w-full object-cover rounded-xl border border-border-color"
                  />
                </div>
              )}

              {/* Upload After Photo */}
              <div>
                <label className="font-bold text-foreground block mb-1">Upload After-Cleaning Photos *</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleUploadAfterPhotos}
                  disabled={uploadingAfterPhoto}
                  className="w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-500/10 file:text-emerald-600 hover:file:bg-emerald-500/20"
                />
                {uploadingAfterPhoto && <p className="text-muted mt-1">Uploading after-cleaning proof...</p>}
                {afterPhotosList.length > 0 && (
                  <div className="flex gap-2 pt-2">
                    {afterPhotosList.map((url, i) => (
                      <img key={i} src={url} alt="After" className="h-16 w-16 rounded-xl object-cover border border-emerald-500" />
                    ))}
                  </div>
                )}
              </div>

              {/* Completion Notes */}
              <div>
                <label className="font-bold text-foreground block mb-1">Housekeeping Completion Notes</label>
                <textarea
                  rows={3}
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="e.g. Linen refreshed, bathroom disinfected, minibar checked. Ready for supervisor inspection."
                  className="w-full rounded-xl border border-border-color bg-surface-elevated p-2.5 text-foreground focus:outline-none"
                />
              </div>

              <div className="rounded-xl bg-blue-500/10 p-3 text-xs text-blue-600 dark:text-blue-400">
                Completing this cleaning task will release the room as <strong>Available</strong> in the Front Desk booking inventory.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-color">
                <button
                  type="button"
                  onClick={() => setIsCompleteTaskModalOpen(false)}
                  className="rounded-xl border border-border-color px-4 py-2 font-bold text-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmCompleteTask}
                  className="rounded-xl bg-emerald-600 px-5 py-2 font-bold text-white shadow-md hover:bg-emerald-700"
                >
                  Confirm Cleaning Complete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: PHOTO AUDIT INSPECTION MODAL */}
      {isAuditModalOpen && auditTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex flex-col max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-3xl border border-border-color bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-color px-6 py-4 bg-surface-elevated/40">
              <div>
                <h3 className="text-base font-black text-foreground">
                  Photo Audit: {auditTask.scopeType === "corridor" ? auditTask.corridorName : auditTask.roomNumber}
                </h3>
                <p className="text-xs text-muted">
                  Cleaner: {auditTask.cleanerName} • Shift: {auditTask.customShiftName || auditTask.shift}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAuditModalOpen(false)}
                className="rounded-xl p-1.5 text-muted hover:bg-surface-elevated hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black uppercase tracking-wider text-muted">Before Cleaning</span>
                    <span className="font-mono text-muted text-[10px]">{auditTask.scheduledDate}</span>
                  </div>
                  {auditTask.beforePhotos && auditTask.beforePhotos.length > 0 ? (
                    <img
                      src={auditTask.beforePhotos[0]}
                      alt="Before"
                      className="w-full h-56 object-cover rounded-2xl border border-border-color"
                    />
                  ) : (
                    <div className="w-full h-56 rounded-2xl border border-dashed border-border-color flex items-center justify-center text-xs text-muted">
                      No Before Photo Uploaded
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black uppercase tracking-wider text-emerald-600">After Cleaning</span>
                    {auditTask.completedAt && (
                      <span className="font-mono text-emerald-600 text-[10px]">
                        {new Date(auditTask.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  {auditTask.afterPhotos && auditTask.afterPhotos.length > 0 ? (
                    <img
                      src={auditTask.afterPhotos[0]}
                      alt="After"
                      className="w-full h-56 object-cover rounded-2xl border border-emerald-500/40"
                    />
                  ) : (
                    <div className="w-full h-56 rounded-2xl border border-dashed border-border-color flex items-center justify-center text-xs text-muted">
                      No After Photo Uploaded
                    </div>
                  )}
                </div>
              </div>

              {auditTask.notes && (
                <div className="p-3 rounded-xl bg-surface-elevated border border-border-color/60 text-xs">
                  <span className="font-bold text-muted block mb-0.5">Notes:</span>
                  <p className="text-foreground italic">"{auditTask.notes}"</p>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-border-color pt-3 text-xs">
                <span className="text-muted">
                  Status: <strong className="text-foreground capitalize">{auditTask.status}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setIsAuditModalOpen(false)}
                  className="rounded-xl px-4 py-1.5 font-bold text-foreground hover:bg-surface-elevated transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: NEW ROOM SERVICE ORDER */}
      {isNewRoomServiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="flex flex-col max-h-[92vh] w-full max-w-lg overflow-hidden rounded-3xl border border-border-color bg-surface shadow-2xl">
            <div className="flex items-center justify-between border-b border-border-color px-6 py-4 bg-surface-elevated/40">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-blue-500/10 p-2 text-blue-600">
                  <Coffee size={18} />
                </div>
                <div>
                  <h3 className="text-base font-black text-foreground">Place Room Service Order</h3>
                  <p className="text-xs text-muted">Dispatch meal trays, beverages, and amenities with butler runner</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsNewRoomServiceModalOpen(false)}
                className="rounded-xl p-1.5 text-muted hover:bg-surface-elevated hover:text-foreground"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveRoomServiceOrder} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">Target Room *</label>
                  <select
                    value={rsRoomId}
                    onChange={(e) => setRsRoomId(e.target.value)}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:outline-none"
                    required
                  >
                    <option value="">Select Room...</option>
                    {rooms.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.roomNumber} ({r.roomType})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">Guest Name</label>
                  <input
                    type="text"
                    value={rsGuestName}
                    onChange={(e) => setRsGuestName(e.target.value)}
                    placeholder="e.g. Arthur Pendelton"
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">Service Type</label>
                  <select
                    value={rsServiceType}
                    onChange={(e) => setRsServiceType(e.target.value)}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:outline-none"
                  >
                    <option value="breakfast_delivery">Breakfast Delivery</option>
                    <option value="lunch_delivery">Lunch Delivery</option>
                    <option value="dinner_delivery">Dinner Delivery</option>
                    <option value="beverages">Beverages / Bar Tray</option>
                    <option value="laundry">Laundry Service</option>
                    <option value="luggage">Luggage Assistance</option>
                    <option value="custom">Custom Service</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">Assigned Runner / Butler</label>
                  <input
                    type="text"
                    value={rsRunnerName}
                    onChange={(e) => setRsRunnerName(e.target.value)}
                    placeholder="e.g. Tinashe Shumba"
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">Items Description</label>
                  <input
                    type="text"
                    value={rsItemName}
                    onChange={(e) => setRsItemName(e.target.value)}
                    placeholder="e.g. Full English Breakfast Tray"
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">Total Charge (ZAR)</label>
                  <input
                    type="number"
                    value={rsItemPrice}
                    onChange={(e) => setRsItemPrice(Number(e.target.value))}
                    className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Target Delivery Window (Minutes)</label>
                <input
                  type="number"
                  min="5"
                  max="120"
                  value={rsTargetMinutes}
                  onChange={(e) => setRsTargetMinutes(Number(e.target.value))}
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Special Instructions</label>
                <input
                  type="text"
                  value={rsNotes}
                  onChange={(e) => setRsNotes(e.target.value)}
                  placeholder="e.g. Deliver with hot espresso and newspaper"
                  className="w-full rounded-xl border border-border-color bg-surface-elevated px-3 py-2 text-foreground focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-color">
                <button
                  type="button"
                  onClick={() => setIsNewRoomServiceModalOpen(false)}
                  className="rounded-xl border border-border-color px-4 py-2 font-bold text-muted hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-blue-600 px-5 py-2 font-bold text-white shadow-md hover:bg-blue-700"
                >
                  Dispatch Order
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
