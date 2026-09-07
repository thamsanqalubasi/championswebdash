import { useState, useEffect } from "react";
import {
  X,
  KeyRound,
  QrCode,
  UserCheck,
  Calendar,
  CreditCard,
  Utensils,
  Bed,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
} from "lucide-react";
import {
  fetchCommercialRooms,
  fetchProperties,
  createInstantCheckin,
  verifyAndCheckinBookingCode,
  generateInstantBookingCode,
} from "@/lib/data";
import type { CommercialRoom, MealPlan, PropertyRow } from "@/lib/types";
import { useAuth } from "@/lib/auth";

interface CheckinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function CheckinModal({ isOpen, onClose, onSuccess }: CheckinModalProps) {
  const { currentCompany, currentCompanyUser } = useAuth();
  const [activeTab, setActiveTab] = useState<"instant" | "code">("instant");

  // Properties & Rooms state
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [rooms, setRooms] = useState<CommercialRoom[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");

  // Instant Checkin Form fields
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestIdNumber, setGuestIdNumber] = useState("");
  const [checkInDate, setCheckInDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [checkOutDate, setCheckOutDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [mealPlan, setMealPlan] = useState<MealPlan>("bed_breakfast");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [instantCode, setInstantCode] = useState(() => generateInstantBookingCode("BK"));

  // Online Code Form
  const [lookupCode, setLookupCode] = useState("");
  const [lookupResult, setLookupResult] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    if (isOpen) {
      setErrorMsg("");
      setSuccessMsg("");
      setInstantCode(generateInstantBookingCode("BK"));
      fetchProperties(currentCompany.id).then((props) => {
        setProperties(props);
        const firstCommercial = props.find((p) =>
          ["hotel", "motel", "lodge", "guest_house", "commercial"].includes(p.type)
        ) || props[0];
        if (firstCommercial) {
          setSelectedPropertyId(firstCommercial.id);
        }
      });
    }
  }, [isOpen, currentCompany.id]);

  useEffect(() => {
    if (selectedPropertyId) {
      fetchCommercialRooms(currentCompany.id, selectedPropertyId).then((allRooms) => {
        setRooms(allRooms);
        const available = allRooms.find((r) => r.status === "available");
        if (available) {
          setSelectedRoomId(available.id);
        } else if (allRooms.length > 0) {
          setSelectedRoomId(allRooms[0].id);
        }
      });
    }
  }, [selectedPropertyId, currentCompany.id]);

  if (!isOpen) return null;

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  // Calculate nights
  const d1 = new Date(checkInDate);
  const d2 = new Date(checkOutDate);
  const diffTime = Math.max(d2.getTime() - d1.getTime(), 86400000);
  const nights = Math.max(Math.ceil(diffTime / (1000 * 60 * 60 * 24)), 1);

  // Calculate rate based on meal plan
  let nightlyRate = selectedRoom?.priceBedBreakfast || 1200;
  if (selectedRoom) {
    if (mealPlan === "room_only") nightlyRate = selectedRoom.pricePerNight;
    else if (mealPlan === "bed_breakfast") nightlyRate = selectedRoom.priceBedBreakfast;
    else if (mealPlan === "bed_lunch") nightlyRate = selectedRoom.priceBedLunch;
    else if (mealPlan === "full_board") nightlyRate = selectedRoom.priceFullBoard;
  }
  const totalAmount = nights * nightlyRate;

  const handleInstantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName || !guestPhone || !guestIdNumber || !selectedRoom) {
      setErrorMsg("Please fill in all required guest information and select an available room.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      await createInstantCheckin({
        companyId: currentCompany.id,
        propertyId: selectedPropertyId,
        propertyName: selectedProperty?.name || "Safari Lodge",
        roomId: selectedRoom.id,
        roomNumber: selectedRoom.roomNumber,
        roomType: selectedRoom.roomType,
        guestName,
        guestPhone,
        guestEmail,
        guestIdNumber,
        checkInDate,
        checkOutDate,
        mealPlan,
        nights,
        ratePerNight: nightlyRate,
        totalAmount,
        depositAmount: amountPaid,
        amountPaid: amountPaid > 0 ? amountPaid : totalAmount,
        paymentMethod,
        checkedInByName: currentCompanyUser.fullName,
        notes,
      });

      setSuccessMsg(`Guest ${guestName} checked in successfully into ${selectedRoom.roomNumber}! Booking Code: ${instantCode}`);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1800);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to execute check-in");
    } finally {
      setLoading(false);
    }
  };

  const handleCodeVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lookupCode.trim()) return;

    setLoading(true);
    setErrorMsg("");
    setLookupResult(null);

    const res = await verifyAndCheckinBookingCode(
      lookupCode.trim(),
      currentCompanyUser.fullName
    );

    setLoading(false);
    if (res.success && res.booking) {
      setSuccessMsg(`Booking ${res.booking.bookingCode} verified! Guest ${res.booking.guestName} checked into ${res.booking.roomNumber}.`);
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1800);
    } else {
      setErrorMsg(res.error || "Invalid booking code.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border-color bg-surface p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-color pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600">
              <KeyRound size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Guest Check-In & Booking Center</h2>
              <p className="text-xs text-muted">
                Front desk instant walk-in registration and online booking verification for {currentCompany.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-elevated hover:text-foreground"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex gap-2 border-b border-border-color pb-3">
          <button
            type="button"
            onClick={() => {
              setActiveTab("instant");
              setErrorMsg("");
              setSuccessMsg("");
            }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              activeTab === "instant"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-muted hover:bg-surface-elevated hover:text-foreground"
            }`}
          >
            <UserCheck size={16} />
            Instant Walk-In Check-In
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab("code");
              setErrorMsg("");
              setSuccessMsg("");
            }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
              activeTab === "code"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-muted hover:bg-surface-elevated hover:text-foreground"
            }`}
          >
            <QrCode size={16} />
            Online Booking Code Check-In
          </button>
        </div>

        {/* Error / Success feedback */}
        {errorMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-500/10 p-3 text-sm text-red-600">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-500/10 p-3 text-sm text-emerald-600">
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Tab 1: Instant Walk-In Check-In */}
        {activeTab === "instant" && (
          <form onSubmit={handleInstantSubmit} className="mt-4 space-y-4">
            {/* Auto Booking Code Banner */}
            <div className="flex items-center justify-between rounded-xl bg-blue-500/10 p-3.5 border border-blue-500/20">
              <div className="flex items-center gap-2.5">
                <Sparkles size={18} className="text-blue-500" />
                <div>
                  <p className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                    System Audit Booking Code
                  </p>
                  <p className="text-sm font-mono font-bold tracking-wider text-blue-600 dark:text-blue-400">
                    {instantCode}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInstantCode(generateInstantBookingCode("BK"))}
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                Regenerate
              </button>
            </div>

            {/* Property & Room Selection */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  Commercial Property / Lodge *
                </label>
                <select
                  value={selectedPropertyId}
                  onChange={(e) => setSelectedPropertyId(e.target.value)}
                  className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none"
                  required
                >
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.type.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  Select Room / Unit *
                </label>
                <select
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none"
                  required
                >
                  {rooms.map((r) => (
                    <option
                      key={r.id}
                      value={r.id}
                      disabled={r.status === "occupied"}
                    >
                      {r.roomNumber} - {r.roomType.toUpperCase()} ({r.status.replace("_", " ")}) - R{r.priceBedBreakfast}/night
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Guest Details */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  Guest Full Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. David Nkosi"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  placeholder="+27 82 000 0000"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  ID / Passport Number *
                </label>
                <input
                  type="text"
                  placeholder="National ID or Passport"
                  value={guestIdNumber}
                  onChange={(e) => setGuestIdNumber(e.target.value)}
                  className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Stay Dates */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  Check-In Date *
                </label>
                <input
                  type="date"
                  value={checkInDate}
                  onChange={(e) => setCheckInDate(e.target.value)}
                  className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-foreground">
                  Check-Out Date *
                </label>
                <input
                  type="date"
                  value={checkOutDate}
                  onChange={(e) => setCheckOutDate(e.target.value)}
                  className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Meal Plan Pricing Options */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted">
                Select Meal & Board Package (Per Night)
              </label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <button
                  type="button"
                  onClick={() => setMealPlan("room_only")}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    mealPlan === "room_only"
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-foreground ring-1 ring-blue-600"
                      : "border-border-color bg-surface-elevated/60 text-muted hover:border-foreground/30"
                  }`}
                >
                  <Bed size={18} className="mb-1 text-blue-600" />
                  <p className="text-xs font-bold text-foreground">Bed Only</p>
                  <p className="text-[11px] text-muted">Room Only</p>
                  <p className="mt-1 text-sm font-extrabold text-blue-600">
                    R{selectedRoom?.pricePerNight || 950}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setMealPlan("bed_breakfast")}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    mealPlan === "bed_breakfast"
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-foreground ring-1 ring-blue-600"
                      : "border-border-color bg-surface-elevated/60 text-muted hover:border-foreground/30"
                  }`}
                >
                  <Utensils size={18} className="mb-1 text-emerald-600" />
                  <p className="text-xs font-bold text-foreground">Bed & Breakfast</p>
                  <p className="text-[11px] text-muted">Room + Breakfast</p>
                  <p className="mt-1 text-sm font-extrabold text-emerald-600">
                    R{selectedRoom?.priceBedBreakfast || 1250}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setMealPlan("bed_lunch")}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    mealPlan === "bed_lunch"
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-foreground ring-1 ring-blue-600"
                      : "border-border-color bg-surface-elevated/60 text-muted hover:border-foreground/30"
                  }`}
                >
                  <Utensils size={18} className="mb-1 text-amber-600" />
                  <p className="text-xs font-bold text-foreground">Bed, B/fast & Lunch</p>
                  <p className="text-[11px] text-muted">Half Board+</p>
                  <p className="mt-1 text-sm font-extrabold text-amber-600">
                    R{selectedRoom?.priceBedLunch || 1550}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setMealPlan("full_board")}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    mealPlan === "full_board"
                      ? "border-blue-600 bg-blue-50 dark:bg-blue-950/40 text-foreground ring-1 ring-blue-600"
                      : "border-border-color bg-surface-elevated/60 text-muted hover:border-foreground/30"
                  }`}
                >
                  <Utensils size={18} className="mb-1 text-purple-600" />
                  <p className="text-xs font-bold text-foreground">Full Board</p>
                  <p className="text-[11px] text-muted">B/fast, Lunch & Dinner</p>
                  <p className="mt-1 text-sm font-extrabold text-purple-600">
                    R{selectedRoom?.priceFullBoard || 1950}
                  </p>
                </button>
              </div>
            </div>

            {/* Billing & Payment summary */}
            <div className="rounded-xl border border-border-color bg-surface-elevated/80 p-4">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-color pb-3">
                <div>
                  <p className="text-xs text-muted">Duration & Rate</p>
                  <p className="text-sm font-bold text-foreground">
                    {nights} Night(s) × R{nightlyRate}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted">Total Payable</p>
                  <p className="text-lg font-black text-foreground">
                    R{totalAmount.toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full rounded-lg border border-border-color bg-surface px-3 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none"
                  >
                    <option value="card">Credit / Debit Card Terminal</option>
                    <option value="cash">Cash at Front Desk</option>
                    <option value="eft">Bank Transfer / EFT</option>
                    <option value="online">Online Prepayment</option>
                    <option value="company_account">Corporate Account</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">
                    Amount Collected Now (ZAR)
                  </label>
                  <input
                    type="number"
                    placeholder={`Full: R${totalAmount}`}
                    value={amountPaid || ""}
                    onChange={(e) => setAmountPaid(Number(e.target.value))}
                    className="w-full rounded-lg border border-border-color bg-surface px-3 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border-color px-4 py-2 text-sm font-medium text-muted hover:bg-surface-elevated"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Processing..." : "Complete Check-In & Issue Room Key"}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Online Code Check-In */}
        {activeTab === "code" && (
          <form onSubmit={handleCodeVerifySubmit} className="mt-6 space-y-6">
            <div className="rounded-xl border border-border-color bg-surface-elevated/50 p-6 text-center">
              <QrCode size={40} className="mx-auto mb-3 text-blue-600" />
              <h3 className="text-base font-bold text-foreground">
                Enter Client Booking Code
              </h3>
              <p className="mx-auto mt-1 max-w-md text-xs text-muted">
                Scan QR or type the reservation code provided to the guest upon online booking.
              </p>

              <div className="mx-auto mt-4 max-w-sm">
                <input
                  type="text"
                  placeholder="e.g. BK-SAFARI-9821-K8"
                  value={lookupCode}
                  onChange={(e) => setLookupCode(e.target.value)}
                  className="w-full rounded-xl border border-border-color bg-surface px-4 py-3 text-center text-base font-mono font-bold tracking-widest text-foreground focus:border-blue-600 focus:outline-none"
                  required
                />
              </div>

              <div className="mt-4 flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => setLookupCode("BK-SAFARI-9821-K8")}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Fill Sample Demo Code (BK-SAFARI-9821-K8)
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-border-color px-4 py-2 text-sm font-medium text-muted hover:bg-surface-elevated"
              >
                Close
              </button>
              <button
                type="submit"
                disabled={loading || !lookupCode.trim()}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Verifying..." : "Verify & Check In Guest"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

