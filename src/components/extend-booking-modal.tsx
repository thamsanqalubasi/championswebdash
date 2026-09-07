import { useState } from "react";
import { X, CalendarPlus, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { extendCommercialBooking } from "@/lib/data";
import type { CommercialBooking } from "@/lib/types";
import { useAuth } from "@/lib/auth";

interface ExtendBookingModalProps {
  isOpen: boolean;
  booking: CommercialBooking | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ExtendBookingModal({
  isOpen,
  booking,
  onClose,
  onSuccess,
}: ExtendBookingModalProps) {
  const { currentCompanyUser } = useAuth();
  const [newCheckOutDate, setNewCheckOutDate] = useState(() => {
    if (!booking) return "";
    const d = new Date(booking.checkOutDate);
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  if (!isOpen || !booking) return null;

  const currentCheckOut = new Date(booking.checkOutDate);
  const proposedCheckOut = new Date(newCheckOutDate);
  const diffDays = Math.max(
    Math.round(
      (proposedCheckOut.getTime() - currentCheckOut.getTime()) /
        (1000 * 60 * 60 * 24)
    ),
    0
  );

  const additionalCost = diffDays * booking.ratePerNight;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (diffDays <= 0) {
      setErrorMsg("New check-out date must be later than current check-out date.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const ok = await extendCommercialBooking({
        bookingId: booking.id,
        newCheckOutDate,
        additionalNights: diffDays,
        additionalCost,
        actorName: currentCompanyUser.fullName,
        notes,
      });

      if (ok) {
        setSuccessMsg(
          `Stay extended by ${diffDays} nights until ${newCheckOutDate}. Added cost: R${additionalCost.toLocaleString()}`
        );
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 1500);
      } else {
        setErrorMsg("Failed to extend booking.");
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error extending booking");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-border-color bg-surface p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-color pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600">
              <CalendarPlus size={22} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Extend Guest Stay</h2>
              <p className="text-xs text-muted">
                {booking.guestName} · {booking.roomNumber} ({booking.bookingCode})
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

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="rounded-xl border border-border-color bg-surface-elevated/60 p-3 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted">Current Check-In:</span>
              <span className="font-semibold text-foreground">
                {new Date(booking.checkInDate).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Current Check-Out:</span>
              <span className="font-semibold text-foreground">
                {new Date(booking.checkOutDate).toLocaleDateString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Rate Per Night:</span>
              <span className="font-semibold text-purple-600">
                R{booking.ratePerNight.toLocaleString()} ({booking.mealPlan.replace("_", " ")})
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              New Extended Check-Out Date *
            </label>
            <input
              type="date"
              value={newCheckOutDate}
              onChange={(e) => setNewCheckOutDate(e.target.value)}
              className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground focus:border-purple-500 focus:outline-none"
              required
            />
          </div>

          <div className="rounded-xl border border-purple-500/20 bg-purple-500/10 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-purple-900 dark:text-purple-200">Additional Nights</p>
                <p className="text-lg font-bold text-purple-700 dark:text-purple-300">
                  +{diffDays} Night(s)
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-purple-900 dark:text-purple-200">Additional Charge</p>
                <p className="text-lg font-black text-purple-700 dark:text-purple-300">
                  R{additionalCost.toLocaleString()}
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-foreground">
              Extension Reason / Notes
            </label>
            <textarea
              rows={2}
              placeholder="Guest requested to extend for weekend safari..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border border-border-color bg-surface-elevated px-3 py-2 text-sm text-foreground focus:border-purple-500 focus:outline-none"
            />
          </div>

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
              disabled={loading || diffDays <= 0}
              className="flex items-center gap-2 rounded-lg bg-purple-600 px-5 py-2 text-sm font-semibold text-white shadow-md hover:bg-purple-700 disabled:opacity-50"
            >
              {loading ? "Extending..." : "Confirm Stay Extension"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

