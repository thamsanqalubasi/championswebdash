import { useState, useEffect } from "react";
import {
  X,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  Bed,
  Calendar,
  CreditCard,
  KeyRound,
  ShieldAlert,
  Sparkles,
  Loader2,
  Phone,
  Mail,
  User,
} from "lucide-react";
import type { CommercialBooking } from "@/lib/types";

interface CheckoutConfirmModalProps {
  isOpen: boolean;
  booking: CommercialBooking | null;
  onClose: () => void;
  onConfirm: (booking: CommercialBooking) => Promise<void> | void;
  isProcessing?: boolean;
}

export function CheckoutConfirmModal({
  isOpen,
  booking,
  onClose,
  onConfirm,
  isProcessing = false,
}: CheckoutConfirmModalProps) {
  const [keysReturned, setKeysReturned] = useState(true);
  const [minibarCleared, setMinibarCleared] = useState(true);
  const [roomInspected, setRoomInspected] = useState(true);

  // Reset checklist whenever a new booking is opened
  useEffect(() => {
    if (booking) {
      setKeysReturned(true);
      setMinibarCleared(true);
      setRoomInspected(true);
    }
  }, [booking]);

  if (!isOpen || !booking) return null;

  const remainingBalance = Math.max(
    (booking.totalAmount || 0) - (booking.amountPaid || 0),
    0
  );
  const hasUnpaidBalance = remainingBalance > 0;

  const handleConfirmClick = () => {
    onConfirm(booking);
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex flex-col max-h-[94vh] w-full max-w-lg overflow-hidden rounded-3xl border border-red-500/30 bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-border-color px-6 py-4 bg-red-500/5">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-red-500/10 p-2.5 text-red-600 dark:text-red-400 border border-red-500/20">
              <LogOut size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight text-foreground">
                  Confirm Guest Check-Out
                </h3>
                <span className="rounded-lg bg-red-500/10 px-2 py-0.5 font-mono text-[11px] font-black text-red-600">
                  {booking.bookingCode}
                </span>
              </div>
              <p className="text-xs text-muted">
                Are you sure you want to complete departure for this guest?
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="rounded-xl p-1.5 text-muted hover:bg-surface-elevated hover:text-foreground transition disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-xs">
          {/* Guest & Room Summary Card */}
          <div className="rounded-2xl border border-border-color bg-surface-elevated/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
                  Departing Guest
                </span>
                <h4 className="text-base font-black text-foreground">
                  {booking.guestName}
                </h4>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 rounded-xl bg-blue-500/10 border border-blue-500/20 px-3 py-1 font-bold text-blue-600 dark:text-blue-400">
                  <Bed size={13} />
                  Room {booking.roomNumber || "N/A"}
                </span>
                {booking.roomType && (
                  <p className="text-[10px] text-muted capitalize mt-0.5">
                    {booking.roomType}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border-color/60 text-muted">
              <div>
                <span className="text-[10px] block font-semibold text-muted/70">Property</span>
                <span className="font-bold text-foreground truncate block">
                  {booking.propertyName || "Lodge Property"}
                </span>
              </div>
              <div>
                <span className="text-[10px] block font-semibold text-muted/70">Stay Duration</span>
                <span className="font-bold text-foreground block">
                  {booking.nights || 1} Night(s)
                </span>
              </div>
              <div>
                <span className="text-[10px] block font-semibold text-muted/70">Check-In</span>
                <span className="font-semibold text-foreground">
                  {new Date(booking.checkInDate).toLocaleDateString()}
                </span>
              </div>
              <div>
                <span className="text-[10px] block font-semibold text-muted/70">Scheduled Checkout</span>
                <span className="font-semibold text-foreground">
                  {new Date(booking.checkOutDate).toLocaleDateString()}
                </span>
              </div>
            </div>

            {(booking.guestPhone || booking.guestEmail) && (
              <div className="flex items-center gap-4 pt-2 border-t border-border-color/60 text-muted">
                {booking.guestPhone && (
                  <span className="inline-flex items-center gap-1 text-[11px]">
                    <Phone size={11} />
                    {booking.guestPhone}
                  </span>
                )}
                {booking.guestEmail && (
                  <span className="inline-flex items-center gap-1 text-[11px] truncate">
                    <Mail size={11} />
                    {booking.guestEmail}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Financial Folio Warning / Banner */}
          {hasUnpaidBalance ? (
            <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 space-y-2">
              <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-black text-sm">
                <AlertTriangle size={18} />
                <span>Outstanding Balance Warning!</span>
              </div>
              <p className="text-xs text-red-700 dark:text-red-300">
                This guest has an unpaid balance of{" "}
                <strong className="font-mono text-sm underline">
                  ZAR {remainingBalance.toLocaleString()}
                </strong>
                . Total charges are ZAR {(booking.totalAmount || 0).toLocaleString()}, but only ZAR{" "}
                {(booking.amountPaid || 0).toLocaleString()} was recorded as paid.
              </p>
              <p className="text-[11px] text-muted italic">
                Checking out will release the guest without settling this balance in the front desk folio.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                <CheckCircle2 size={16} />
                <span>Folio Settled (Paid in Full)</span>
              </div>
              <span className="font-mono font-black text-emerald-700 dark:text-emerald-300">
                ZAR {(booking.totalAmount || 0).toLocaleString()}
              </span>
            </div>
          )}

          {/* Security Deposit Notice */}
          {booking.depositAmount > 0 && (
            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <ShieldAlert size={15} />
                <span className="font-semibold">Security Deposit on File:</span>
              </div>
              <span className="font-mono font-bold text-amber-800 dark:text-amber-300">
                ZAR {booking.depositAmount.toLocaleString()}
              </span>
            </div>
          )}

          {/* Departure Checklist */}
          <div className="rounded-2xl border border-border-color bg-surface-elevated/20 p-3.5 space-y-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted block">
              Front Desk Departure Checklist
            </span>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={keysReturned}
                onChange={(e) => setKeysReturned(e.target.checked)}
                className="h-4 w-4 rounded border-border-color text-blue-600 focus:ring-blue-500"
              />
              <span className="text-foreground font-medium">
                Room keys / keycard(s) received from guest
              </span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={minibarCleared}
                onChange={(e) => setMinibarCleared(e.target.checked)}
                className="h-4 w-4 rounded border-border-color text-blue-600 focus:ring-blue-500"
              />
              <span className="text-foreground font-medium">
                Minibar & room service orders cleared / settled
              </span>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={roomInspected}
                onChange={(e) => setRoomInspected(e.target.checked)}
                className="h-4 w-4 rounded border-border-color text-blue-600 focus:ring-blue-500"
              />
              <span className="text-foreground font-medium">
                Luggage removed; room clear of guest personal belongings
              </span>
            </label>
          </div>

          {/* Housekeeping Action Notice */}
          <div className="rounded-xl bg-blue-500/5 border border-blue-500/20 p-3 flex items-start gap-2.5 text-muted">
            <Sparkles size={15} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Confirming checkout will immediately set <strong>Room {booking.roomNumber}</strong> to{" "}
              <strong className="text-amber-600">Cleaning Needed</strong> and queue a priority room turnover task in Housekeeping.
            </p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-border-color px-6 py-4 bg-surface-elevated/30">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="rounded-xl border border-border-color bg-surface px-4 py-2 font-bold text-muted hover:text-foreground hover:bg-surface-elevated transition disabled:opacity-50"
          >
            Cancel / Keep In-House
          </button>
          <button
            type="button"
            onClick={handleConfirmClick}
            disabled={isProcessing}
            className="flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2 font-bold text-white shadow-lg hover:bg-red-700 transition disabled:opacity-50"
          >
            {isProcessing ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Checking Out...</span>
              </>
            ) : (
              <>
                <LogOut size={15} />
                <span>Yes, Confirm Check Out</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

