"use client";

import { toast } from "@/lib/toast";
import { bookingApi } from "@/modules/booking/services/booking";
import { coachApi } from "@/modules/coach/services/coach";
import { Button } from "@/modules/shared/ui/Button";
import { Modal } from "@/modules/shared/ui/Modal";
import { Booking, CoachCalendarData, IBlockedDate } from "@/types";
import { cn } from "@/utils/cn";
import { AnimatePresence, motion } from "framer-motion";
import {
  Ban,
  CalendarCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  IndianRupee,
  Loader2,
  MapPin,
  Pencil,
  RefreshCw,
  Trash2,
  User,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const HOUR_START = 6;
const HOUR_END = 22;
const HOURS = Array.from({ length: HOUR_END - HOUR_START }, (_, i) => HOUR_START + i);
const ROW_HEIGHT = 64; // px per hour

type CalendarView = "month" | "week" | "day";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toISODate(d: Date): string {
  return d.toISOString().split("T")[0];
}

function timeToMinutes(t: string): number {
  const [h = "0", m = "0"] = t.split(":");
  return parseInt(h) * 60 + parseInt(m);
}

function formatTime(t: string): string {
  const mins = timeToMinutes(t);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const display = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${display}:${m.toString().padStart(2, "0")} ${suffix}`;
}

function formatFullDate(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getWeekStart(d: Date): Date {
  const dt = new Date(d);
  dt.setDate(dt.getDate() - dt.getDay());
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function getCalendarRange(view: CalendarView, current: Date): { start: Date; end: Date } {
  if (view === "day") {
    const start = new Date(current);
    start.setHours(0, 0, 0, 0);
    const end = new Date(current);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  if (view === "week") {
    const start = getWeekStart(current);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }
  // month — include leading/trailing days for a full 6-week grid
  const start = new Date(current.getFullYear(), current.getMonth(), 1);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(current.getFullYear(), current.getMonth() + 1, 0);
  end.setDate(end.getDate() + (6 - end.getDay()));
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function isDateBlocked(d: Date, blocks: IBlockedDate[]): boolean {
  const ts = d.getTime();
  return blocks.some((b) => {
    const s = new Date(b.startDate).setHours(0, 0, 0, 0);
    const e = new Date(b.endDate).setHours(23, 59, 59, 999);
    return ts >= s && ts <= e;
  });
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function bookingsForDay(day: Date, bookings: Booking[]): Booking[] {
  return bookings.filter((b) => sameDay(new Date(b.date), day));
}

const STATUS_LABEL: Record<string, string> = {
  AWAITING_PAYMENT: "Awaiting Payment",
  AWAITING_PROVIDER: "Awaiting Approval",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  NO_SHOW: "No Show",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired — Refunded",
};

const STATUS_BADGE: Record<string, string> = {
  AWAITING_PAYMENT: "bg-slate-50 text-slate-600 border border-slate-200",
  AWAITING_PROVIDER: "bg-amber-50 text-amber-700 border border-amber-200",
  CONFIRMED: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  IN_PROGRESS: "bg-indigo-50 text-indigo-700 border border-indigo-200",
  COMPLETED: "bg-slate-100 text-slate-600 border border-slate-200",
  NO_SHOW: "bg-rose-50 text-rose-600 border border-rose-200",
  CANCELLED: "bg-red-50 text-red-600 border border-red-200",
  EXPIRED: "bg-red-50 text-red-600 border border-red-200",
};

const BOOKING_BLOCK: Record<string, string> = {
  AWAITING_PAYMENT: "bg-slate-100 border-slate-300 text-slate-700",
  AWAITING_PROVIDER: "bg-amber-100 border-amber-300 text-amber-800",
  CONFIRMED: "bg-emerald-100 border-emerald-300 text-emerald-800",
  IN_PROGRESS: "bg-indigo-100 border-indigo-300 text-blue-800",
  COMPLETED: "bg-slate-100 border-slate-200 text-slate-600",
  NO_SHOW: "bg-rose-100 border-rose-200 text-rose-700",
  EXPIRED: "bg-red-100 border-red-200 text-red-700",
};

// ─── Session Detail Modal ──────────────────────────────────────────────────────

interface SessionModalProps {
  booking: Booking | null;
  onClose: () => void;
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onReschedule: (id: string, date: string, start: string, end: string) => Promise<void>;
  actionLoading: string | null;
}

function SessionModal({
  booking,
  onClose,
  onApprove,
  onReject,
  onReschedule,
  actionLoading,
}: SessionModalProps) {
  const [showReschedule, setShowReschedule] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleStart, setRescheduleStart] = useState("");
  const [rescheduleEnd, setRescheduleEnd] = useState("");

  useEffect(() => {
    if (booking) {
      setShowReschedule(false);
      setRescheduleDate(toISODate(new Date(booking.date)));
      setRescheduleStart(booking.startTime);
      setRescheduleEnd(booking.endTime);
    }
  }, [booking]);

  if (!booking) return null;

  const playerName =
    typeof booking.userId === "object" && booking.userId !== null
      ? ((booking.userId as { name?: string }).name ?? "Player")
      : "Player";

  const isPending = booking.status === "AWAITING_PROVIDER";
  const isConfirmed = booking.status === "CONFIRMED";
  const isLoading = (id: string) => actionLoading === id;
  const today = toISODate(new Date());

  const handleRescheduleSubmit = async () => {
    if (!rescheduleDate || !rescheduleStart || !rescheduleEnd) {
      toast.error("Please fill in all reschedule fields.");
      return;
    }
    if (rescheduleStart >= rescheduleEnd) {
      toast.error("End time must be after start time.");
      return;
    }
    await onReschedule(booking.id, rescheduleDate, rescheduleStart, rescheduleEnd);
    setShowReschedule(false);
  };

  return (
    <Modal isOpen={!!booking} onClose={onClose} title="Session Details" size="md">
      <div className="space-y-5">
        {/* Player */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100">
            <User size={18} className="text-slate-500" />
          </div>
          <div>
            <p className="font-semibold text-slate-900">{playerName}</p>
            <p className="text-xs capitalize text-slate-500">{booking.sport}</p>
          </div>
          <span
            className={cn(
              "ml-auto rounded-full px-3 py-1 text-xs font-medium",
              STATUS_BADGE[booking.status]
            )}
          >
            {STATUS_LABEL[booking.status] ?? booking.status}
          </span>
        </div>

        <div className="h-px bg-slate-100" />

        {/* Date / Time / Amount */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <div className="mb-1 flex items-center gap-2 text-slate-500">
              <CalendarDays size={14} />
              <span className="text-xs font-medium uppercase tracking-wide">Date</span>
            </div>
            <p className="text-sm font-semibold text-slate-800">
              {formatFullDate(new Date(booking.date))}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <div className="mb-1 flex items-center gap-2 text-slate-500">
              <Clock size={14} />
              <span className="text-xs font-medium uppercase tracking-wide">Time</span>
            </div>
            <p className="text-sm font-semibold text-slate-800">
              {formatTime(booking.startTime)} – {formatTime(booking.endTime)}
            </p>
          </div>
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <div className="mb-1 flex items-center gap-2 text-slate-500">
              <IndianRupee size={14} />
              <span className="text-xs font-medium uppercase tracking-wide">Amount</span>
            </div>
            <p className="text-sm font-semibold text-slate-800">
              ₹{booking.totalAmount.toLocaleString("en-IN")}
            </p>
          </div>
          {(booking.venue || booking.coachId) && (
            <div className="rounded-xl bg-slate-50 px-4 py-3">
              <div className="mb-1 flex items-center gap-2 text-slate-500">
                <MapPin size={14} />
                <span className="text-xs font-medium uppercase tracking-wide">Location</span>
              </div>
              <p className="truncate text-sm font-semibold text-slate-800">
                {typeof booking.venue === "object" && booking.venue
                  ? booking.venue.name
                  : "Coach venue"}
              </p>
            </div>
          )}
        </div>

        {/* Reschedule form */}
        <AnimatePresence>
          {showReschedule && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-700">Reschedule to</p>
                <div className="grid grid-cols-1 gap-2">
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Date</label>
                    <input
                      type="date"
                      min={today}
                      value={rescheduleDate}
                      onChange={(e) => setRescheduleDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">Start time</label>
                      <input
                        type="time"
                        value={rescheduleStart}
                        onChange={(e) => setRescheduleStart(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">End time</label>
                      <input
                        type="time"
                        value={rescheduleEnd}
                        onChange={(e) => setRescheduleEnd(e.target.value)}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="primary"
                    loading={isLoading(`reschedule-${booking.id}`)}
                    onClick={handleRescheduleSubmit}
                  >
                    Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowReschedule(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 pt-1">
          {isPending && (
            <>
              <Button
                size="sm"
                variant="success"
                loading={isLoading(`approve-${booking.id}`)}
                icon={<CalendarCheck size={15} />}
                onClick={() => onApprove(booking.id)}
              >
                Approve
              </Button>
              <Button
                size="sm"
                variant="danger"
                loading={isLoading(`reject-${booking.id}`)}
                icon={<X size={15} />}
                onClick={() => onReject(booking.id)}
              >
                Decline
              </Button>
            </>
          )}
          {isConfirmed && !showReschedule && (
            <Button
              size="sm"
              variant="outline"
              icon={<RefreshCw size={15} />}
              onClick={() => setShowReschedule(true)}
            >
              Reschedule
            </Button>
          )}
          {isConfirmed && (
            <Button
              size="sm"
              variant="ghost"
              className="text-rose-600 hover:bg-rose-50"
              loading={isLoading(`reject-${booking.id}`)}
              icon={<X size={15} />}
              onClick={() => onReject(booking.id)}
            >
              Decline
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Month View ───────────────────────────────────────────────────────────────

function MonthView({
  current,
  bookings,
  blockedDates,
  onDayClick,
  onBookingClick,
}: {
  current: Date;
  bookings: Booking[];
  blockedDates: IBlockedDate[];
  onDayClick: (d: Date) => void;
  onBookingClick: (b: Booking) => void;
}) {
  const { start } = getCalendarRange("month", current);
  const today = new Date();

  const days: Date[] = [];
  const d = new Date(start);
  while (days.length < 42) {
    days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }

  return (
    <div className="flex-1 overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-slate-100">
        {DAY_LABELS.map((l) => (
          <div
            key={l}
            className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-400"
          >
            {l}
          </div>
        ))}
      </div>
      {/* Grid */}
      <div className="grid grid-cols-7" style={{ gridAutoRows: "minmax(100px, 1fr)" }}>
        {days.map((day, i) => {
          const isCurrentMonth = day.getMonth() === current.getMonth();
          const isToday = sameDay(day, today);
          const blocked = isDateBlocked(day, blockedDates);
          const dayBookings = bookingsForDay(day, bookings);
          const visible = dayBookings.slice(0, 3);
          const overflow = dayBookings.length - 3;

          return (
            <div
              key={i}
              onClick={() => onDayClick(day)}
              className={cn(
                "relative cursor-pointer border-b border-r border-slate-100 p-1.5 transition-colors hover:bg-slate-50",
                !isCurrentMonth && "opacity-40",
                blocked && "bg-rose-50"
              )}
            >
              {blocked && (
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(244,63,94,0.06) 4px, rgba(244,63,94,0.06) 8px)",
                  }}
                />
              )}
              <span
                className={cn(
                  "relative z-10 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium",
                  isToday && "bg-power-orange text-white",
                  !isToday && isCurrentMonth && "text-slate-800",
                  !isToday && !isCurrentMonth && "text-slate-400"
                )}
              >
                {day.getDate()}
              </span>
              <div className="relative z-10 mt-0.5 space-y-0.5">
                {visible.map((b) => (
                  <button
                    key={b.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onBookingClick(b);
                    }}
                    className={cn(
                      "w-full truncate rounded px-1.5 py-0.5 text-left text-xs font-medium leading-tight",
                      BOOKING_BLOCK[b.status] ?? "bg-slate-100 text-slate-600"
                    )}
                  >
                    {formatTime(b.startTime)}{" "}
                    {typeof b.userId === "object"
                      ? ((b.userId as { name?: string }).name ?? "")
                      : ""}
                  </button>
                ))}
                {overflow > 0 && <p className="px-1 text-xs text-slate-400">+{overflow} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Week / Day View (shared time-grid) ──────────────────────────────────────

function TimeGrid({
  days,
  bookings,
  blockedDates,
  onBookingClick,
}: {
  days: Date[];
  bookings: Booking[];
  blockedDates: IBlockedDate[];
  onBookingClick: (b: Booking) => void;
}) {
  const totalHeight = HOURS.length * ROW_HEIGHT;
  const now = new Date();
  const todayStr = toISODate(now);

  // Current-time indicator position (minutes from HOUR_START)
  const nowMinutesFromStart = now.getHours() * 60 + now.getMinutes() - HOUR_START * 60;
  const nowTop =
    nowMinutesFromStart >= 0 && nowMinutesFromStart <= HOURS.length * 60
      ? (nowMinutesFromStart / 60) * ROW_HEIGHT
      : null;

  return (
    <div className="flex-1 overflow-auto">
      {/* Day headers */}
      <div
        className="sticky top-0 z-10 grid border-b border-slate-100 bg-white"
        style={{ gridTemplateColumns: `64px repeat(${days.length}, 1fr)` }}
      >
        <div className="py-2" />
        {days.map((d, i) => {
          const isToday = sameDay(d, now);
          return (
            <div key={i} className="py-2 text-center">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                {DAY_LABELS[d.getDay()]}
              </p>
              <p
                className={cn(
                  "mx-auto mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                  isToday ? "bg-power-orange text-white" : "text-slate-700"
                )}
              >
                {d.getDate()}
              </p>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div
        className="relative grid"
        style={{ gridTemplateColumns: `64px repeat(${days.length}, 1fr)` }}
      >
        {/* Time labels column */}
        <div className="relative select-none" style={{ height: totalHeight }}>
          {HOURS.map((h) => (
            <div
              key={h}
              className="absolute flex w-full items-start justify-end pr-2"
              style={{ top: (h - HOUR_START) * ROW_HEIGHT }}
            >
              <span className="-translate-y-1/2 text-[11px] font-medium leading-none text-slate-400">
                {h === 12 ? "12 PM" : h > 12 ? `${h - 12} PM` : `${h} AM`}
              </span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day, ci) => {
          const dayBookings = bookingsForDay(day, bookings);
          const blocked = isDateBlocked(day, blockedDates);
          const isToday = toISODate(day) === todayStr;

          return (
            <div
              key={ci}
              className="relative border-l border-slate-100"
              style={{ height: totalHeight }}
            >
              {/* Hour lines */}
              {HOURS.map((h) => (
                <div
                  key={h}
                  className={cn(
                    "absolute w-full border-t",
                    h % 2 === 0 ? "border-slate-100" : "border-slate-50"
                  )}
                  style={{ top: (h - HOUR_START) * ROW_HEIGHT }}
                />
              ))}

              {/* Half-hour guide lines */}
              {HOURS.map((h) => (
                <div
                  key={`half-${h}`}
                  className="absolute w-full border-t border-dashed border-slate-50"
                  style={{ top: (h - HOUR_START) * ROW_HEIGHT + ROW_HEIGHT / 2 }}
                />
              ))}

              {/* Blocked overlay */}
              {blocked && (
                <div
                  className="pointer-events-none absolute inset-0 z-0"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(-45deg, transparent, transparent 6px, rgba(244,63,94,0.08) 6px, rgba(244,63,94,0.08) 12px)",
                  }}
                />
              )}

              {/* Current-time indicator */}
              {isToday && nowTop !== null && (
                <div
                  className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
                  style={{ top: nowTop }}
                >
                  <span className="bg-power-orange -ml-1.5 h-2.5 w-2.5 shrink-0 rounded-full shadow-sm" />
                  <div className="border-power-orange flex-1 border-t-2" />
                </div>
              )}

              {/* Booking blocks */}
              {dayBookings.map((b) => {
                const startMins = timeToMinutes(b.startTime) - HOUR_START * 60;
                const endMins = timeToMinutes(b.endTime) - HOUR_START * 60;
                const top = Math.max(0, (startMins / 60) * ROW_HEIGHT);
                const height = Math.max(28, ((endMins - startMins) / 60) * ROW_HEIGHT - 2);
                const playerName =
                  typeof b.userId === "object" && b.userId
                    ? ((b.userId as { name?: string }).name ?? "")
                    : "";
                const durationMins = endMins - startMins;

                return (
                  <button
                    key={b.id}
                    onClick={() => onBookingClick(b)}
                    className={cn(
                      "absolute left-0.5 right-0.5 z-10 overflow-hidden rounded-lg border px-2 py-1 text-left",
                      "transition-all hover:z-20 hover:scale-[1.01] hover:shadow-md active:scale-[0.99]",
                      BOOKING_BLOCK[b.status] ?? "border-slate-200 bg-slate-100 text-slate-600"
                    )}
                    style={{ top, height }}
                    title={`${playerName || b.sport} — ${formatTime(b.startTime)} to ${formatTime(b.endTime)}`}
                  >
                    {/* Sport tag */}
                    <p className="truncate text-[10px] font-bold uppercase leading-none tracking-wide opacity-60">
                      {b.sport}
                    </p>
                    {/* Player name */}
                    {height > 24 && (
                      <p className="mt-0.5 truncate text-xs font-semibold leading-tight">
                        {playerName || "Session"}
                      </p>
                    )}
                    {/* Time range — only if tall enough */}
                    {height > 44 && durationMins >= 30 && (
                      <p className="mt-0.5 truncate text-[10px] leading-tight opacity-60">
                        {formatTime(b.startTime)}–{formatTime(b.endTime)}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CoachSchedulePage() {
  const [view, setView] = useState<CalendarView>("month");
  const [currentDate, setCurrentDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [calendarData, setCalendarData] = useState<CoachCalendarData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Block-date form state
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [isBlocking, setIsBlocking] = useState(false);
  const [removingBlockId, setRemovingBlockId] = useState<string | null>(null);

  // Edit blocked date state
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);
  const [editBlockStart, setEditBlockStart] = useState("");
  const [editBlockEnd, setEditBlockEnd] = useState("");
  const [editBlockReason, setEditBlockReason] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchCalendar = useCallback(async (v: CalendarView, d: Date) => {
    setIsLoading(true);
    try {
      const { start, end } = getCalendarRange(v, d);
      const res = await coachApi.getCalendar(toISODate(start), toISODate(end));
      if (res.success && res.data) {
        setCalendarData(res.data);
      }
    } catch {
      toast.error("Failed to load calendar.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCalendar(view, currentDate);
  }, [view, currentDate, fetchCalendar]);

  // ── Navigation ─────────────────────────────────────────────────────────────

  const navigate = (delta: number) => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      if (view === "month") d.setMonth(d.getMonth() + delta);
      else if (view === "week") d.setDate(d.getDate() + delta * 7);
      else d.setDate(d.getDate() + delta);
      return d;
    });
  };

  const goToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    setCurrentDate(d);
  };

  const headerLabel = useMemo(() => {
    if (view === "month")
      return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    if (view === "week") {
      const ws = getWeekStart(currentDate);
      const we = new Date(ws);
      we.setDate(we.getDate() + 6);
      if (ws.getMonth() === we.getMonth()) {
        return `${ws.getDate()} – ${we.getDate()} ${MONTH_NAMES[we.getMonth()]} ${we.getFullYear()}`;
      }
      return `${ws.getDate()} ${MONTH_NAMES[ws.getMonth()]} – ${we.getDate()} ${MONTH_NAMES[we.getMonth()]} ${we.getFullYear()}`;
    }
    return formatFullDate(currentDate);
  }, [view, currentDate]);

  const weekDays = useMemo(() => {
    const ws = getWeekStart(currentDate);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(ws);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [currentDate]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleApprove = async (bookingId: string) => {
    setActionLoading(`approve-${bookingId}`);
    try {
      const res = await bookingApi.confirmBookingByProvider(bookingId);
      if (res.success) {
        toast.success("Booking approved.");
        setSelectedBooking(null);
        void fetchCalendar(view, currentDate);
      }
    } catch {
      toast.error("Failed to approve booking.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (bookingId: string) => {
    setActionLoading(`reject-${bookingId}`);
    try {
      const res = await bookingApi.rejectBookingByProvider(bookingId);
      if (res.success) {
        toast.success("Booking declined.");
        setSelectedBooking(null);
        void fetchCalendar(view, currentDate);
      }
    } catch {
      toast.error("Failed to decline booking.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReschedule = async (id: string, date: string, start: string, end: string) => {
    setActionLoading(`reschedule-${id}`);
    try {
      const res = await bookingApi.rescheduleBooking(id, {
        newDate: date,
        newStartTime: start,
        newEndTime: end,
      });
      if (res.success) {
        toast.success("Booking rescheduled.");
        setSelectedBooking(null);
        void fetchCalendar(view, currentDate);
      }
    } catch {
      toast.error("Failed to reschedule booking.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleBlockDates = async () => {
    if (!blockStart || !blockEnd) {
      toast.error("Please select a start and end date.");
      return;
    }
    if (blockEnd < blockStart) {
      toast.error("End date must be on or after start date.");
      return;
    }
    setIsBlocking(true);
    try {
      const res = await coachApi.blockDates({
        startDate: blockStart,
        endDate: blockEnd,
        reason: blockReason || undefined,
        allDay: true,
      });
      if (res.success) {
        toast.success("Dates blocked.");
        setBlockStart("");
        setBlockEnd("");
        setBlockReason("");
        void fetchCalendar(view, currentDate);
      }
    } catch {
      toast.error("Failed to block dates.");
    } finally {
      setIsBlocking(false);
    }
  };

  const handleUnblock = async (blockId: string) => {
    setRemovingBlockId(blockId);
    try {
      const res = await coachApi.unblockDate(blockId);
      if (res.success) {
        toast.success("Date unblocked.");
        void fetchCalendar(view, currentDate);
      }
    } catch {
      toast.error("Failed to unblock date.");
    } finally {
      setRemovingBlockId(null);
    }
  };

  const handleEditBlock = async (oldBlockId: string) => {
    if (!editBlockStart || !editBlockEnd) {
      toast.error("Please select start and end dates.");
      return;
    }
    if (editBlockEnd < editBlockStart) {
      toast.error("End date must be on or after start date.");
      return;
    }
    setIsSavingEdit(true);
    try {
      // Remove old block then add new one
      await coachApi.unblockDate(oldBlockId);
      const res = await coachApi.blockDates({
        startDate: editBlockStart,
        endDate: editBlockEnd,
        reason: editBlockReason || undefined,
        allDay: true,
      });
      if (res.success) {
        toast.success("Block updated.");
        setEditingBlockId(null);
        void fetchCalendar(view, currentDate);
      }
    } catch {
      toast.error("Failed to update block.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDayClick = (day: Date) => {
    setCurrentDate(day);
    setView("day");
  };

  // ── Derived data ───────────────────────────────────────────────────────────

  const bookings = calendarData?.bookings ?? [];
  const blockedDates = calendarData?.blockedDates ?? [];
  const bufferTime = calendarData?.travelBufferTime ?? 0;

  // Only paid bookings are actionable by the coach — an AWAITING_PAYMENT
  // booking is still the customer's to complete, not the coach's to approve.
  const pendingBookings = bookings.filter((b) => b.status === "AWAITING_PROVIDER");

  const today = toISODate(new Date());

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Schedule</h1>
            <p className="mt-0.5 text-sm text-slate-500">
              Manage your bookings, availability, and blocked dates
            </p>
          </div>

          {/* View switcher */}
          <div className="flex self-start rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:self-auto">
            {(["month", "week", "day"] as CalendarView[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-lg px-4 py-1.5 text-sm font-medium capitalize transition-all",
                  view === v
                    ? "bg-slate-900 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </motion.div>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* ── Calendar card ── */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 }}
            className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            style={{ minHeight: view === "month" ? 600 : 680 }}
          >
            {/* Calendar toolbar */}
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(-1)}
                  className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
                  aria-label="Previous"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={() => navigate(1)}
                  className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100"
                  aria-label="Next"
                >
                  <ChevronRight size={18} />
                </button>
                <h2 className="ml-1 text-base font-semibold text-slate-800">{headerLabel}</h2>
              </div>
              <div className="flex items-center gap-2">
                {isLoading && <Loader2 size={16} className="animate-spin text-slate-400" />}
                <button
                  onClick={goToday}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
                >
                  Today
                </button>
              </div>
            </div>

            {/* Calendar body */}
            <AnimatePresence mode="wait">
              <motion.div
                key={`${view}-${toISODate(currentDate)}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="flex flex-1 flex-col overflow-hidden"
              >
                {isLoading && !calendarData ? (
                  <div className="flex flex-1 items-center justify-center">
                    <Loader2 size={28} className="animate-spin text-slate-300" />
                  </div>
                ) : view === "month" ? (
                  <MonthView
                    current={currentDate}
                    bookings={bookings}
                    blockedDates={blockedDates}
                    onDayClick={handleDayClick}
                    onBookingClick={setSelectedBooking}
                  />
                ) : (
                  <TimeGrid
                    days={view === "week" ? weekDays : [currentDate]}
                    bookings={bookings}
                    blockedDates={blockedDates}
                    onBookingClick={setSelectedBooking}
                  />
                )}
              </motion.div>
            </AnimatePresence>

            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 px-4 py-2.5">
              {[
                { label: "Pending", cls: "bg-amber-400" },
                { label: "Confirmed", cls: "bg-turf-green" },
                { label: "In Progress", cls: "bg-blue-400" },
                { label: "Completed", cls: "bg-slate-300" },
              ].map(({ label, cls }) => (
                <div key={label} className="flex items-center gap-1.5">
                  <span className={cn("inline-block h-2 w-2 rounded-full", cls)} />
                  <span className="text-xs text-slate-500">{label}</span>
                </div>
              ))}
              <div className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-4 rounded-sm"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(-45deg, transparent, transparent 2px, rgba(244,63,94,0.3) 2px, rgba(244,63,94,0.3) 4px)",
                  }}
                />
                <span className="text-xs text-slate-500">Blocked</span>
              </div>
            </div>
          </motion.div>

          {/* ── Right panel ── */}
          <div className="space-y-5">
            {/* Pending approvals */}
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: 0.1 }}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5">
                <h3 className="text-sm font-semibold text-slate-800">Pending Approvals</h3>
                {pendingBookings.length > 0 && (
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                    {pendingBookings.length}
                  </span>
                )}
              </div>
              <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
                {pendingBookings.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-slate-400">
                    <CalendarCheck size={28} strokeWidth={1.5} />
                    <p className="mt-2 text-xs">No pending approvals</p>
                  </div>
                ) : (
                  pendingBookings.map((b) => {
                    const playerName =
                      typeof b.userId === "object" && b.userId
                        ? ((b.userId as { name?: string }).name ?? "Player")
                        : "Player";
                    return (
                      <div key={b.id} className="flex items-start gap-3 px-4 py-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100">
                          <User size={14} className="text-slate-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-slate-800">
                            {playerName}
                          </p>
                          <p className="text-xs capitalize text-slate-500">{b.sport}</p>
                          <p className="text-xs text-slate-400">
                            {formatFullDate(new Date(b.date))} · {formatTime(b.startTime)}
                          </p>
                        </div>
                        <button
                          onClick={() => setSelectedBooking(b)}
                          className="shrink-0 rounded-lg border border-orange-200 px-2.5 py-1 text-xs font-medium text-orange-600 transition-colors hover:bg-orange-50"
                        >
                          Review
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>

            {/* Availability info */}
            {bufferTime > 0 && (
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: 0.15 }}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50">
                  <Clock size={15} className="text-indigo-500" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-700">
                    Buffer time between sessions
                  </p>
                  <p className="text-xs text-slate-500">{bufferTime} minutes</p>
                </div>
              </motion.div>
            )}

            {/* Block dates */}
            <motion.div
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, delay: 0.2 }}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="border-b border-slate-100 px-4 py-3.5">
                <h3 className="text-sm font-semibold text-slate-800">Block Time Off</h3>
                <p className="mt-0.5 text-xs text-slate-500">
                  Mark dates unavailable — holidays, personal time, etc.
                </p>
              </div>

              <div className="space-y-3 px-4 py-4">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">From</label>
                    <input
                      type="date"
                      min={today}
                      value={blockStart}
                      onChange={(e) => setBlockStart(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">To</label>
                    <input
                      type="date"
                      min={blockStart || today}
                      value={blockEnd}
                      onChange={(e) => setBlockEnd(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    Reason (optional)
                  </label>
                  <input
                    type="text"
                    placeholder="Holiday, personal, travel..."
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  fullWidth
                  loading={isBlocking}
                  icon={<Ban size={14} />}
                  onClick={handleBlockDates}
                >
                  Block dates
                </Button>
              </div>

              {/* Existing blocked dates */}
              {blockedDates.length > 0 && (
                <div className="border-t border-slate-100">
                  <div className="px-4 py-2.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Blocked periods
                    </p>
                  </div>
                  <div className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
                    {blockedDates.map((b) => {
                      const bid =
                        (b as { _id?: string; id?: string })._id ?? (b as { id?: string }).id ?? "";
                      const start = new Date(b.startDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                      });
                      const end = new Date(b.endDate).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      });
                      const isSameDay =
                        toISODate(new Date(b.startDate)) === toISODate(new Date(b.endDate));
                      const isEditing = editingBlockId === bid;

                      return (
                        <div key={bid}>
                          {isEditing ? (
                            /* ── Inline edit form ── */
                            <div className="space-y-2 bg-slate-50 px-4 py-3">
                              <p className="text-xs font-semibold text-slate-700">Edit block</p>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="mb-0.5 block text-[10px] font-medium text-slate-500">
                                    From
                                  </label>
                                  <input
                                    type="date"
                                    value={editBlockStart}
                                    onChange={(e) => setEditBlockStart(e.target.value)}
                                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
                                  />
                                </div>
                                <div>
                                  <label className="mb-0.5 block text-[10px] font-medium text-slate-500">
                                    To
                                  </label>
                                  <input
                                    type="date"
                                    min={editBlockStart}
                                    value={editBlockEnd}
                                    onChange={(e) => setEditBlockEnd(e.target.value)}
                                    className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-400"
                                  />
                                </div>
                              </div>
                              <input
                                type="text"
                                placeholder="Reason (optional)"
                                value={editBlockReason}
                                onChange={(e) => setEditBlockReason(e.target.value)}
                                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-800 placeholder-slate-300 focus:outline-none focus:ring-2 focus:ring-orange-400"
                              />
                              <div className="flex gap-2 pt-1">
                                <Button
                                  size="sm"
                                  variant="primary"
                                  loading={isSavingEdit}
                                  onClick={() => handleEditBlock(bid)}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingBlockId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            /* ── Read view ── */
                            <div className="flex items-center gap-2 px-4 py-2.5">
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-slate-700">
                                  {isSameDay ? start : `${start} – ${end}`}
                                </p>
                                {b.reason && (
                                  <p className="truncate text-xs text-slate-400">{b.reason}</p>
                                )}
                              </div>
                              {/* Edit button */}
                              <button
                                onClick={() => {
                                  setEditingBlockId(bid);
                                  setEditBlockStart(toISODate(new Date(b.startDate)));
                                  setEditBlockEnd(toISODate(new Date(b.endDate)));
                                  setEditBlockReason(b.reason ?? "");
                                }}
                                className="hover:text-power-orange shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-orange-50"
                                aria-label="Edit block"
                              >
                                <Pencil size={13} />
                              </button>
                              {/* Delete button */}
                              <button
                                onClick={() => handleUnblock(bid)}
                                disabled={removingBlockId === bid}
                                className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50"
                                aria-label="Remove block"
                              >
                                {removingBlockId === bid ? (
                                  <Loader2 size={14} className="animate-spin" />
                                ) : (
                                  <Trash2 size={14} />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </div>

      {/* Session detail modal */}
      <SessionModal
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onApprove={handleApprove}
        onReject={handleReject}
        onReschedule={handleReschedule}
        actionLoading={actionLoading}
      />
    </div>
  );
}
