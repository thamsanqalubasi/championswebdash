import React, { useState, useEffect } from "react";
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
  ArrowLeft,
  Loader2,
  Download,
  Mail,
  Printer,
  RefreshCw,
} from "lucide-react";
import {
  fetchCommercialRooms,
  fetchProperties,
  createInstantCheckin,
  verifyAndCheckinBookingCode,
  generateInstantBookingCode,
} from "@/lib/data";
import type { CommercialBooking, CommercialRoom, MealPlan, PropertyRow } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { useCurrency } from "@/lib/currency";
import { supabase } from "@/lib/supabase";
import { downloadPdfDocument } from "@/lib/storage";
import { DocumentShareModal } from "@/components/document-share-modal";
import {
  buildFolioHtml,
  buildCheckinEmailTemplates,
  formatRoomDisplayName,
  formatMealPlanLabel,
} from "@/lib/booking-folio";

class SafeErrorBoundary extends React.Component<
  { children: React.ReactNode; onClose?: () => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: any) {
    console.error("CheckinModal render error:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center space-y-4" data-no-translate="true">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-100 dark:bg-red-950/40 text-red-600">
            <AlertCircle size={24} />
          </div>
          <h3 className="text-base font-bold text-foreground">
            Could not open Check-In Center
          </h3>
          <p className="text-xs text-muted max-w-sm mx-auto">
            {this.state.error?.message || "An unexpected error occurred while loading guest check-in."}
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                this.props.onClose?.();
              }}
              className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
            >
              Close Window
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface CheckinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialPropertyId?: string;
}

export function CheckinModal(props: CheckinModalProps) {
  if (!props.isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
      data-no-translate="true"
    >
      <div
        className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-border-color bg-surface p-6 shadow-2xl text-foreground"
        data-no-translate="true"
      >
        <SafeErrorBoundary onClose={props.onClose}>
          <CheckinModalContent {...props} />
        </SafeErrorBoundary>
      </div>
    </div>
  );
}

function CheckinModalContent({ onClose, onSuccess, initialPropertyId }: CheckinModalProps) {
  const { currentCompany, currentCompanyUser } = useAuth();
  const { currency, symbol } = useCurrency();
  const [activeTab, setActiveTab] = useState<"instant" | "code">("instant");

  // Properties & Rooms state
  const [properties, setProperties] = useState<PropertyRow[]>([]);
  const [rooms, setRooms] = useState<CommercialRoom[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [loadingData, setLoadingData] = useState(true);

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
  const [amountDifferenceReason, setAmountDifferenceReason] = useState("");
  const [notes, setNotes] = useState("");
  const [instantCode, setInstantCode] = useState(() => generateInstantBookingCode("BK"));

  // Online Code Form
  const [lookupCode, setLookupCode] = useState("");
  const [lookupResult, setLookupResult] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [completedBooking, setCompletedBooking] = useState<CommercialBooking | null>(null);
  const [shareModalDoc, setShareModalDoc] = useState<{
    isOpen: boolean;
    documentTitle: string;
    documentType?: string;
    documentHtml?: string;
    documentUrl?: string;
    fileNameBase?: string;
    ownerName?: string;
    ownerEmail?: string;
    defaultSubject?: string;
    defaultMessage?: string;
    emailTemplates?: any;
  }>({
    isOpen: false,
    documentTitle: "",
  });

  const compId = currentCompany?.id || "";
  const compName = currentCompany?.name || "Company";

  useEffect(() => {
    setErrorMsg("");
    setSuccessMsg("");
    setInstantCode(generateInstantBookingCode("BK"));
    if (compId) {
      setLoadingData(true);
      fetchProperties(compId)
        .then((props) => {
          const list = Array.isArray(props) ? props : [];
          setProperties(list);
          if (initialPropertyId && list.some((p) => p.id === initialPropertyId)) {
            setSelectedPropertyId(initialPropertyId);
          } else {
            const firstCommercial = list.find((p) =>
              ["hotel", "motel", "lodge", "guest_house", "commercial"].includes(p?.type || "")
            ) || list[0];
            if (firstCommercial) {
              setSelectedPropertyId(firstCommercial.id);
            }
          }
        })
        .catch((err) => {
          console.warn("Could not load properties for checkin", err);
        })
        .finally(() => {
          setLoadingData(false);
        });
    }
  }, [compId, initialPropertyId]);

  const [creatingQuickRoom, setCreatingQuickRoom] = useState(false);
  const handleCreateQuickRoom = async () => {
    if (!selectedPropertyId || !compId) return;
    setCreatingQuickRoom(true);
    try {
      const roomNum = String(101 + rooms.length);
      const { data: newRoom, error: createRoomErr } = await supabase
        .from("commercial_rooms")
        .insert({
          property_id: selectedPropertyId,
          company_id: compId,
          room_number: roomNum,
          room_type: "standard",
          status: "available",
          price_per_night: 850,
          price_bed_breakfast: 950,
          max_guests: 2,
        })
        .select("*")
        .single();
      if (createRoomErr) throw createRoomErr;
      if (newRoom) {
        const mappedRoom: CommercialRoom = {
          id: newRoom.id,
          companyId: newRoom.company_id,
          propertyId: newRoom.property_id,
          propertyName: selectedProperty?.name || "Lodge Property",
          roomNumber: newRoom.room_number,
          roomType: newRoom.room_type,
          floor: newRoom.floor || "Ground Floor",
          status: newRoom.status,
          capacityAdults: Number(newRoom.capacity_adults || newRoom.max_guests) || 2,
          capacityChildren: Number(newRoom.capacity_children) || 0,
          amenities: Array.isArray(newRoom.amenities) ? newRoom.amenities : ["wifi", "tv"],
          photos: Array.isArray(newRoom.photos) ? newRoom.photos : [],
          pricePerNight: Number(newRoom.price_per_night) || 850,
          priceBedBreakfast: Number(newRoom.price_bed_breakfast) || 950,
          priceBedLunch: Number(newRoom.price_bed_lunch) || 1150,
          priceFullBoard: Number(newRoom.price_full_board) || 1450,
        };
        setRooms((prev) => [...prev, mappedRoom]);
        setSelectedRoomId(mappedRoom.id);
      }
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to quick create room");
    } finally {
      setCreatingQuickRoom(false);
    }
  };

  useEffect(() => {
    if (selectedPropertyId && compId) {
      fetchCommercialRooms(compId, selectedPropertyId)
        .then((allRooms) => {
          const list = Array.isArray(allRooms) ? allRooms : [];
          setRooms(list);
          const available = list.find((r) => r.status === "available");
          if (available) {
            setSelectedRoomId(available.id);
          } else if (list.length > 0) {
            setSelectedRoomId(list[0].id);
          }
        })
        .catch((err) => {
          console.warn("Could not load rooms for checkin", err);
        });
    }
  }, [selectedPropertyId, compId]);

  const selectedProperty = properties.find((p) => p.id === selectedPropertyId);
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId);

  // Calculate nights
  const d1 = new Date(checkInDate);
  const d2 = new Date(checkOutDate);
  const diffTime = Math.max(d2.getTime() - d1.getTime(), 86400000);
  const nights = Math.max(Math.ceil(diffTime / (1000 * 60 * 60 * 24)), 1);

  // Calculate rate based on meal plan
  let nightlyRate = selectedRoom?.priceBedBreakfast || selectedRoom?.pricePerNight || 1200;
  if (selectedRoom) {
    if (mealPlan === "room_only") nightlyRate = selectedRoom.pricePerNight || 950;
    else if (mealPlan === "bed_breakfast") nightlyRate = selectedRoom.priceBedBreakfast || 1200;
    else if (mealPlan === "bed_lunch") nightlyRate = selectedRoom.priceBedLunch || 1500;
    else if (mealPlan === "full_board") nightlyRate = selectedRoom.priceFullBoard || 1900;
  }
  const totalAmount = nights * nightlyRate;

  useEffect(() => {
    if (totalAmount > 0 && amountPaid === 0) {
      setAmountPaid(totalAmount);
    }
  }, [totalAmount]);

  const handleInstantSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim() || !guestPhone.trim() || !guestEmail.trim() || !selectedRoom) {
      setErrorMsg("Please fill in Guest Name, Phone, Email, and select an available room.");
      return;
    }

    const effectivePaid = amountPaid > 0 ? amountPaid : totalAmount;
    const isExact = Math.abs(effectivePaid - totalAmount) < 0.01;
    if (!isExact && !amountDifferenceReason.trim()) {
      setErrorMsg("Please provide an explanation reason for the price difference before completing check-in.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const combinedNotes = [
        notes.trim(),
        !isExact
          ? `[Payment Discrepancy Note: Expected ${symbol}${totalAmount}, Collected ${symbol}${effectivePaid}. Reason: ${amountDifferenceReason.trim()}]`
          : null,
      ]
        .filter(Boolean)
        .join(" | ");

      const actorName = currentCompanyUser?.fullName || currentCompanyUser?.jobTitle || "Front Desk Staff";

      const newBooking = await createInstantCheckin({
        companyId: compId,
        propertyId: selectedPropertyId,
        propertyName: selectedProperty?.name || "Safari Lodge",
        roomId: selectedRoom.id,
        roomNumber: selectedRoom.roomNumber || "101",
        roomType: selectedRoom.roomType || "standard",
        guestName,
        guestPhone,
        guestEmail,
        guestIdNumber: guestIdNumber.trim() || "N/A",
        checkInDate,
        checkOutDate,
        mealPlan,
        nights,
        ratePerNight: nightlyRate,
        totalAmount,
        depositAmount: effectivePaid,
        amountPaid: effectivePaid,
        paymentMethod,
        checkedInByName: actorName,
        notes: combinedNotes,
      });

      setCompletedBooking(newBooking);
      onSuccess?.();
    } catch (err: any) {
      const msg = err?.message || err?.error_description || (err instanceof Error ? err.message : String(err));
      setErrorMsg(msg || "Failed to execute check-in");
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

    const actorName = currentCompanyUser?.fullName || currentCompanyUser?.jobTitle || "Front Desk Staff";

    const res = await verifyAndCheckinBookingCode(
      lookupCode.trim(),
      actorName
    );

    setLoading(false);
    if (res.success && res.booking) {
      setCompletedBooking(res.booking);
      onSuccess?.();
    } else {
      setErrorMsg(res.error || "Invalid booking code.");
    }
  };

  if (completedBooking) {
    const cleanRoom = formatRoomDisplayName(completedBooking.roomNumber, completedBooking.roomType);
    const folioHtml = buildFolioHtml(completedBooking, compName, symbol);
    const emailTemplates = buildCheckinEmailTemplates(completedBooking, compName);

    return (
      <div className="space-y-6 py-2" data-no-translate="true">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="text-xl font-black text-foreground">Guest Checked In Successfully!</h2>
          <p className="text-xs text-muted max-w-md mx-auto">
            Official proof of check-in folio has been generated. You can now download, print, or email the proof to the guest or staff.
          </p>
        </div>

        {/* Quick Details Card */}
        <div className="rounded-2xl border border-border-color bg-surface-elevated/40 p-4 space-y-3">
          <div className="flex items-center justify-between border-b border-border-color pb-2.5">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Booking Reference</span>
              <p className="font-mono text-base font-black text-blue-600">#{completedBooking.bookingCode}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted">Status</span>
              <p className="inline-block rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-600">
                ✓ Checked In
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <span className="text-muted block text-[11px]">Guest Name</span>
              <span className="font-bold text-foreground truncate block">{completedBooking.guestName}</span>
            </div>
            <div>
              <span className="text-muted block text-[11px]">Room &amp; Property</span>
              <span className="font-bold text-foreground truncate block">{cleanRoom}</span>
            </div>
            <div>
              <span className="text-muted block text-[11px]">Dates ({completedBooking.nights} night{completedBooking.nights > 1 ? "s" : ""})</span>
              <span className="font-bold text-foreground block">
                {completedBooking.checkInDate.slice(0, 10)} &rarr; {completedBooking.checkOutDate.slice(0, 10)}
              </span>
            </div>
            <div>
              <span className="text-muted block text-[11px]">Amount Collected</span>
              <span className="font-black text-emerald-600 block">
                {symbol}{completedBooking.amountPaid.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => {
              downloadPdfDocument(folioHtml, `checkin-proof-${completedBooking.bookingCode}`);
            }}
            className="flex items-center justify-center gap-2 rounded-xl border border-border-color bg-surface-elevated p-3 text-xs font-bold text-foreground hover:bg-surface-elevated/80 shadow-xs transition"
          >
            <Download size={15} />
            <span>Download PDF Proof</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setShareModalDoc({
                isOpen: true,
                documentTitle: `Proof of Check-In - #${completedBooking.bookingCode} (${completedBooking.guestName})`,
                documentType: "checkin",
                documentHtml: folioHtml,
                fileNameBase: `checkin-proof-${completedBooking.bookingCode}-${completedBooking.guestName.replace(/\s+/g, "_")}`,
                ownerName: completedBooking.guestName,
                ownerEmail: completedBooking.guestEmail || "",
                defaultSubject: emailTemplates.ownerSubject,
                defaultMessage: emailTemplates.ownerMessage,
                emailTemplates,
              });
            }}
            className="flex items-center justify-center gap-2 rounded-xl bg-sky-600 p-3 text-xs font-bold text-white hover:bg-sky-700 shadow-md transition"
          >
            <Mail size={15} />
            <span>Email / Share Proof</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center justify-center gap-2 rounded-xl border border-border-color bg-surface-elevated p-3 text-xs font-bold text-foreground hover:bg-surface-elevated/80 shadow-xs transition"
          >
            <Printer size={15} />
            <span>Print Folio / Receipt</span>
          </button>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-border-color pt-4">
          <button
            type="button"
            onClick={() => {
              setCompletedBooking(null);
              setGuestName("");
              setGuestPhone("");
              setGuestEmail("");
              setGuestIdNumber("");
              setNotes("");
              setAmountPaid(0);
              setAmountDifferenceReason("");
              setInstantCode(generateInstantBookingCode("BK"));
            }}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground"
          >
            <RefreshCw size={13} />
            <span>Check-In Another Guest</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700"
          >
            Done &amp; Close Window
          </button>
        </div>

        <DocumentShareModal
          isOpen={shareModalDoc.isOpen}
          onClose={() => setShareModalDoc((prev) => ({ ...prev, isOpen: false }))}
          documentTitle={shareModalDoc.documentTitle}
          documentType={shareModalDoc.documentType}
          documentHtml={shareModalDoc.documentHtml}
          documentUrl={shareModalDoc.documentUrl}
          fileNameBase={shareModalDoc.fileNameBase}
          ownerName={shareModalDoc.ownerName}
          ownerEmail={shareModalDoc.ownerEmail}
          defaultSubject={shareModalDoc.defaultSubject}
          defaultMessage={shareModalDoc.defaultMessage}
          emailTemplates={shareModalDoc.emailTemplates}
        />
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-color pb-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border-color bg-surface text-muted hover:bg-surface-elevated hover:text-foreground transition shadow-xs"
            title="Back"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/10 text-blue-600">
            <KeyRound size={22} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Guest Check-In &amp; Booking Center</h2>
            <p className="text-xs text-muted">
              Front desk instant walk-in registration and online booking verification for {compName}
            </p>
          </div>
        </div>
        <button
          type="button"
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
              ? "bg-blue-600 text-white shadow-xs"
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
              ? "bg-blue-600 text-white shadow-xs"
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

      {loadingData ? (
        <div className="py-12 flex flex-col items-center justify-center gap-2 text-muted">
          <Loader2 size={24} className="animate-spin text-blue-600" />
          <p className="text-xs">Loading available properties and rooms...</p>
        </div>
      ) : (
        <>
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
                  {properties.length === 0 ? (
                    <div className="rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-xs text-muted">
                      No properties found. Please add a property first.
                    </div>
                  ) : (
                    <select
                      value={selectedPropertyId}
                      onChange={(e) => setSelectedPropertyId(e.target.value)}
                      className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none"
                      required
                    >
                      {properties.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name || "Property"} ({String(p.type || "property").toUpperCase()})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">
                    Select Room / Unit *
                  </label>
                  {rooms.length === 0 ? (
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">No rooms found for this property.</p>
                      <button
                        type="button"
                        onClick={handleCreateQuickRoom}
                        disabled={creatingQuickRoom || !selectedPropertyId}
                        className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition disabled:opacity-50"
                      >
                        {creatingQuickRoom ? "Creating Room..." : "+ Add Quick Room 101"}
                      </button>
                    </div>
                  ) : (
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
                          {r.roomNumber || "Room"} - {String(r.roomType || "Standard").toUpperCase()} ({String(r.status || "available").replace(/_/g, " ")}) - {symbol}{r.priceBedBreakfast || r.pricePerNight || 0}/night
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* Guest Details */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">
                    Guest Full Name <span className="text-red-500">*</span>
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
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    placeholder="+264 81 000 0000"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">
                    Guest Email Address <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    placeholder="guest@example.com"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-foreground">
                    ID / Passport <span className="text-muted text-[10px]">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="National ID or Passport"
                    value={guestIdNumber}
                    onChange={(e) => setGuestIdNumber(e.target.value)}
                    className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground focus:border-blue-500 focus:outline-none"
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
                  Select Meal &amp; Board Package (Per Night)
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
                      {symbol}{selectedRoom?.pricePerNight || 950}
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
                    <p className="text-xs font-bold text-foreground">Bed &amp; Breakfast</p>
                    <p className="text-[11px] text-muted">Room + Breakfast</p>
                    <p className="mt-1 text-sm font-extrabold text-emerald-600">
                      {symbol}{selectedRoom?.priceBedBreakfast || 1250}
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
                    <p className="text-xs font-bold text-foreground">Bed, B/fast &amp; Lunch</p>
                    <p className="text-[11px] text-muted">Half Board+</p>
                    <p className="mt-1 text-sm font-extrabold text-amber-600">
                      {symbol}{selectedRoom?.priceBedLunch || 1550}
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
                    <p className="text-[11px] text-muted">B/fast, Lunch &amp; Dinner</p>
                    <p className="mt-1 text-sm font-extrabold text-purple-600">
                      {symbol}{selectedRoom?.priceFullBoard || 1950}
                    </p>
                  </button>
                </div>
              </div>

              {/* Billing & Payment summary */}
              <div className="rounded-xl border border-border-color bg-surface-elevated/80 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-color pb-3">
                  <div>
                    <p className="text-xs text-muted">Duration &amp; Rate</p>
                    <p className="text-sm font-bold text-foreground">
                      {nights} Night(s) × {symbol}{nightlyRate}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted">Total Payable</p>
                    <p className="text-lg font-black text-foreground">
                      {symbol}{totalAmount.toLocaleString()}
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
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-medium text-foreground">
                        Amount Collected Now ({currency}) <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setAmountPaid(totalAmount);
                          setAmountDifferenceReason("");
                        }}
                        className="text-[10px] text-blue-600 hover:underline font-semibold"
                      >
                        Set Exact ({symbol}{totalAmount})
                      </button>
                    </div>
                    <input
                      type="number"
                      placeholder={`Expected: ${symbol} ${totalAmount}`}
                      value={amountPaid || ""}
                      onChange={(e) => setAmountPaid(Number(e.target.value))}
                      className={`w-full rounded-lg border px-3 py-2 text-sm font-bold focus:outline-none transition-all ${
                        Math.abs(amountPaid - totalAmount) < 0.01
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-600 focus:border-emerald-600"
                          : "border-rose-500 bg-rose-500/10 text-rose-600 focus:border-rose-600"
                      }`}
                      required
                    />

                    {Math.abs(amountPaid - totalAmount) < 0.01 ? (
                      <p className="mt-1.5 flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                        <CheckCircle2 size={13} className="shrink-0" />
                        <span>Exact amount collected in full. Approved for immediate check-in.</span>
                      </p>
                    ) : (
                      <div className="mt-2 space-y-1.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600 dark:text-rose-400">
                          <AlertCircle size={14} className="shrink-0" />
                          <span>
                            {amountPaid < totalAmount
                              ? `Price Difference: Underpayment of ${symbol} ${(totalAmount - amountPaid).toLocaleString()} balance.`
                              : `Price Difference: Overpayment / Extra buffer of ${symbol} ${(amountPaid - totalAmount).toLocaleString()}.`}
                          </span>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-foreground mb-1">
                            Explanation / Reason for Difference <span className="text-rose-600">* (Strictly Required)</span>
                          </label>
                          <textarea
                            value={amountDifferenceReason}
                            onChange={(e) => setAmountDifferenceReason(e.target.value)}
                            placeholder="e.g. Approved seasonal discount, paying remaining balance at checkout, corporate voucher..."
                            rows={2}
                            required
                            className="w-full rounded-lg border border-rose-300 dark:border-rose-800 bg-surface px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted outline-none focus:border-rose-600"
                          />
                        </div>
                      </div>
                    )}
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
                  disabled={loading || !selectedRoom}
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
        </>
      )}
    </>
  );
}
