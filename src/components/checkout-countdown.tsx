import { useState, useEffect } from "react";
import { Clock, AlertTriangle, AlertCircle } from "lucide-react";

export interface CheckoutCountdownProps {
  checkOutDate: string;
  isStayActive?: boolean;
  compact?: boolean;
  className?: string;
  checkoutTimeStr?: string; // default "10:00"
}

export function parseCheckoutTarget(checkOutDate: string, defaultTimeStr = "10:00"): Date {
  if (!checkOutDate) return new Date();

  // If date already includes time (e.g. ISO string with T), check if it's midnight UTC or full datetime
  if (checkOutDate.includes("T")) {
    const parsed = new Date(checkOutDate);
    // If it's midnight (00:00:00), default to 10:00 AM on that date
    if (parsed.getHours() === 0 && parsed.getMinutes() === 0) {
      const [hours, minutes] = defaultTimeStr.split(":").map(Number);
      parsed.setHours(hours || 10, minutes || 0, 0, 0);
    }
    return parsed;
  }

  // YYYY-MM-DD or MM/DD/YYYY format
  const [year, month, day] = checkOutDate.includes("-")
    ? checkOutDate.split("-").map(Number)
    : checkOutDate.split("/").map(Number);

  const target = new Date();
  if (checkOutDate.includes("-")) {
    target.setFullYear(year, month - 1, day);
  } else {
    // MM/DD/YYYY
    target.setFullYear(day, year - 1, month);
  }

  const [hours, minutes] = defaultTimeStr.split(":").map(Number);
  target.setHours(hours || 10, minutes || 0, 0, 0);
  return target;
}

export function getCheckoutDelta(checkOutDate: string, defaultTimeStr = "10:00") {
  const target = parseCheckoutTarget(checkOutDate, defaultTimeStr);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const isOverstay = diffMs <= 0;
  const absDiff = Math.abs(diffMs);

  const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((absDiff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((absDiff / (1000 * 60)) % 60);
  const seconds = Math.floor((absDiff / 1000) % 60);

  return {
    diffMs,
    isOverstay,
    days,
    hours,
    minutes,
    seconds,
    target,
  };
}

export function CheckoutCountdown({
  checkOutDate,
  isStayActive = true,
  compact = false,
  className = "",
  checkoutTimeStr = "10:00",
}: CheckoutCountdownProps) {
  const [delta, setDelta] = useState(() =>
    getCheckoutDelta(checkOutDate, checkoutTimeStr)
  );

  useEffect(() => {
    // Immediately calculate
    setDelta(getCheckoutDelta(checkOutDate, checkoutTimeStr));

    // Update every second
    const timer = setInterval(() => {
      setDelta(getCheckoutDelta(checkOutDate, checkoutTimeStr));
    }, 1000);

    return () => clearInterval(timer);
  }, [checkOutDate, checkoutTimeStr]);

  if (!isStayActive) {
    return null;
  }

  const { isOverstay, days, hours, minutes, seconds } = delta;

  // Format countdown string
  const pad = (n: number) => String(n).padStart(2, "0");
  let formattedTime = "";
  if (days > 0) {
    formattedTime = `${days}d ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  } else {
    formattedTime = `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
  }

  // COMPACT BADGE (e.g. For Bookings Table Row)
  if (compact) {
    if (isOverstay) {
      return (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-black bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 animate-pulse ${className}`}
          title="Checkout deadline has passed. Guest is currently overstaying."
        >
          <AlertCircle size={11} className="shrink-0 text-rose-600 dark:text-rose-400" />
          <span>-{formattedTime} (Overstay)</span>
        </span>
      );
    }

    // Active countdown remaining
    const isUrgent = days === 0 && hours < 2;
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold ${
          isUrgent
            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
            : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
        } ${className}`}
        title={`Checkout due at 10:00 AM (${formattedTime} remaining)`}
      >
        <Clock size={11} className="shrink-0" />
        <span>⏳ {formattedTime}</span>
      </span>
    );
  }

  // EXPANDED HERO BANNER (e.g. For Guest Profile Modal)
  if (isOverstay) {
    return (
      <div
        className={`rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 text-white shrink-0 shadow-xs animate-pulse">
            <AlertTriangle size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-rose-700 dark:text-rose-300">
                Checkout Overdue · Overstay Alert
              </span>
              <span className="rounded-full bg-rose-600 text-white px-2 py-0.5 text-[10px] font-black uppercase">
                Overstay
              </span>
            </div>
            <p className="text-xs text-rose-800/80 dark:text-rose-300/80 mt-0.5">
              Scheduled checkout was at {delta.target.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} on{" "}
              {delta.target.toLocaleDateString()}. Please initiate departure or extend stay.
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="text-[10px] uppercase font-bold text-rose-600 block">
            Overdue Elapsed
          </span>
          <span className="text-xl sm:text-2xl font-black font-mono text-rose-600 dark:text-rose-400">
            -{formattedTime}
          </span>
        </div>
      </div>
    );
  }

  // Stay active & countdown to checkout
  const isUrgent = days === 0 && hours < 2;
  return (
    <div
      className={`rounded-2xl border p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs ${
        isUrgent
          ? "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200"
          : "border-blue-500/30 bg-blue-500/10 text-blue-900 dark:text-blue-200"
      } ${className}`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl text-white shrink-0 shadow-xs ${
            isUrgent ? "bg-amber-600" : "bg-blue-600"
          }`}
        >
          <Clock size={20} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-foreground">
              {isUrgent ? "Checkout Imminent" : "Active Stay Countdown"}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                isUrgent
                  ? "bg-amber-600 text-white"
                  : "bg-blue-600 text-white"
              }`}
            >
              {isUrgent ? "Due Soon" : "In House"}
            </span>
          </div>
          <p className="text-xs text-muted mt-0.5">
            Checkout scheduled for {delta.target.toLocaleDateString()} at{" "}
            {delta.target.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </div>

      <div className="text-right shrink-0">
        <span className="text-[10px] uppercase font-bold text-muted block">
          Time Remaining
        </span>
        <span
          className={`text-xl sm:text-2xl font-black font-mono ${
            isUrgent ? "text-amber-600 dark:text-amber-400" : "text-blue-600 dark:text-blue-400"
          }`}
        >
          {formattedTime}
        </span>
      </div>
    </div>
  );
}
