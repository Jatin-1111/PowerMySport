"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
  Star,
  Tag,
  Trash2,
  Trophy,
  Users,
  X,
  Zap,
  Dumbbell,
  Bell,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { Button } from "@/modules/shared/ui/Button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/modules/shared/ui/Card";
import { ProfileSectionHeader } from "@/modules/player/components/ProfileSectionHeader";
import { cn } from "@/utils/cn";
import {
  calendarApi,
  type CalendarBooking,
  type CalendarEvent,
  type CalendarEventType,
  EVENT_TYPE_LABELS,
  EVENT_TYPE_COLORS,
  EVENT_TYPE_BG,
} from "@/modules/booking/services/calendarApi";

// ── Constants ────────────────────────────────────────────────────────────────

const DAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
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

const BOOKING_STATUS_COLORS: Record<string, string> = {
  CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  PENDING_CONFIRMATION: "bg-amber-50 text-amber-700 border-amber-200",
  PENDING_INVITES: "bg-indigo-50 text-indigo-700 border-indigo-200",
  IN_PROGRESS: "bg-yellow-50 text-yellow-700 border-yellow-200",
  COMPLETED: "bg-slate-50 text-slate-600 border-slate-200",
};

const EVENT_TYPE_ICONS: Record<CalendarEventType, React.ElementType> = {
  IMPORTANT: Star,
  COMPETITION: Trophy,
  TRAINING: Dumbbell,
  REMINDER: Bell,
  OTHER: Tag,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("T")[0].split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatMonthRange(month: Date): { startDate: string; endDate: string } {
  const year = month.getFullYear();
  const mo = month.getMonth();
  // Extend ±1 week to capture bookings on leading/trailing calendar cells
  const start = new Date(year, mo, 1);
  start.setDate(start.getDate() - start.getDay());
  const end = new Date(year, mo + 1, 0);
  end.setDate(end.getDate() + (6 - end.getDay()));
  return {
    startDate: toDateKey(start),
    endDate: toDateKey(end),
  };
}

function buildCalendarGrid(month: Date): Date[] {
  const year = month.getFullYear();
  const mo = month.getMonth();
  const firstDay = new Date(year, mo, 1);
  const lastDay = new Date(year, mo + 1, 0);
  const cells: Date[] = [];
  // Leading days from previous month
  for (let i = firstDay.getDay() - 1; i >= 0; i--) {
    cells.push(new Date(year, mo, -i));
  }
  // Current month days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    cells.push(new Date(year, mo, d));
  }
  // Trailing days to fill 6-row grid (42 cells)
  while (cells.length < 42) {
    const last = cells[cells.length - 1]!;
    cells.push(
      new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
    );
  }
  return cells;
}

function formatShortDate(d: Date): string {
  return d.toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = (h ?? 0) >= 12 ? "PM" : "AM";
  const display =
    (h ?? 0) > 12 ? (h ?? 0) - 12 : (h ?? 0) === 0 ? 12 : (h ?? 0);
  return `${display}:${String(m ?? 0).padStart(2, "0")} ${suffix}`;
}

function getBookingLabel(b: CalendarBooking): string {
  if (typeof b.venueId === "object" && b.venueId?.name) return b.venueId.name;
  if (typeof b.coachId === "object" && b.coachId !== null) {
    const uid = (b.coachId as { userId?: { name?: string } | string }).userId;
    if (typeof uid === "object" && uid?.name) return uid.name;
  }
  return b.sport;
}

function formatStatus(s: string): string {
  return s
    .charAt(0)
    .toUpperCase()
    .concat(s.slice(1).toLowerCase().replace(/_/g, " "));
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface DayDot {
  color: string;
  kind: "booking" | "event";
}

function CalendarCell({
  date,
  isCurrentMonth,
  isToday,
  isSelected,
  dots,
  onClick,
}: {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  dots: DayDot[];
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center gap-0.5 rounded-xl p-1.5 text-xs font-medium transition-all duration-150 focus:outline-none",
        isCurrentMonth ? "text-slate-800" : "text-slate-300",
        isToday && !isSelected && "font-bold",
        isSelected
          ? "bg-power-orange text-white shadow-md ring-2 ring-power-orange/40"
          : isToday
            ? "bg-orange-50 ring-1 ring-power-orange/40"
            : "hover:bg-slate-100",
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 items-center justify-center rounded-full text-xs",
          isToday &&
            !isSelected &&
            "bg-power-orange/10 text-power-orange font-bold",
        )}
      >
        {date.getDate()}
      </span>

      {/* Dot indicators — up to 3 */}
      {dots.length > 0 && (
        <div className="flex items-center gap-0.5">
          {dots.slice(0, 3).map((dot, i) => (
            <span
              key={i}
              className={cn(
                "inline-block h-1.5 w-1.5 rounded-full",
                isSelected ? "bg-white/80" : "",
              )}
              style={isSelected ? {} : { backgroundColor: dot.color }}
            />
          ))}
          {dots.length > 3 && (
            <span
              className={cn(
                "text-[9px] font-bold",
                isSelected ? "text-white/80" : "text-slate-400",
              )}
            >
              +{dots.length - 3}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

function BookingCard({ booking }: { booking: CalendarBooking }) {
  const label = getBookingLabel(booking);
  const statusClass =
    BOOKING_STATUS_COLORS[booking.status] ??
    "bg-slate-50 text-slate-600 border-slate-200";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 rounded-xl border border-slate-200/70 bg-slate-50/60 p-3"
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-100">
        <Calendar className="h-4 w-4 text-power-orange" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{label}</p>
        <p className="text-xs text-slate-500">
          {booking.sport} · {formatTime(booking.startTime)} –{" "}
          {formatTime(booking.endTime)}
        </p>
      </div>
      <Badge className={cn("shrink-0 border text-xs", statusClass)}>
        {formatStatus(booking.status)}
      </Badge>
    </motion.div>
  );
}

function EventCard({
  event,
  onDelete,
  deleting,
}: {
  event: CalendarEvent;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const Icon = EVENT_TYPE_ICONS[event.type] ?? Star;
  const bgClass = EVENT_TYPE_BG[event.type] ?? "bg-slate-100 text-slate-600";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 rounded-xl border border-slate-200/70 bg-slate-50/60 p-3"
    >
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${event.color}18` }}
      >
        <Icon className="h-4 w-4" style={{ color: event.color }} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">
          {event.title}
        </p>
        {event.notes && (
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
            {event.notes}
          </p>
        )}
        <Badge
          className={cn(
            "mt-1 border-0 px-1.5 py-0.5 text-[10px] font-semibold",
            bgClass,
          )}
        >
          {EVENT_TYPE_LABELS[event.type]}
        </Badge>
      </div>
      <button
        type="button"
        disabled={deleting}
        onClick={() => onDelete(event.id)}
        className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-40"
        aria-label="Delete event"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}

// ── Add-event form ────────────────────────────────────────────────────────────

const EVENT_TYPES: CalendarEventType[] = [
  "IMPORTANT",
  "COMPETITION",
  "TRAINING",
  "REMINDER",
  "OTHER",
];

function AddEventForm({
  date,
  onAdd,
  onCancel,
}: {
  date: string;
  onAdd: (event: CalendarEvent) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<CalendarEventType>("IMPORTANT");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a title");
      return;
    }
    setSaving(true);
    try {
      const created = await calendarApi.createEvent({
        title: title.trim(),
        date,
        color: EVENT_TYPE_COLORS[type],
        type,
        notes: notes.trim() || undefined,
      });
      onAdd(created);
      toast.success("Event added");
    } catch {
      toast.error("Failed to add event");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      onSubmit={handleSubmit}
      className="rounded-xl border border-power-orange/30 bg-orange-50/40 p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-800">New Event</p>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg p-1 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Event title…"
        maxLength={120}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-power-orange focus:outline-none focus:ring-1 focus:ring-power-orange/40"
      />

      {/* Event type chips */}
      <div className="flex flex-wrap gap-1.5">
        {EVENT_TYPES.map((t) => {
          const Icon = EVENT_TYPE_ICONS[t] ?? Star;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={cn(
                "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-all",
                type === t
                  ? "ring-2 shadow-sm"
                  : "bg-white/80 text-slate-500 border border-slate-200 hover:border-slate-300",
              )}
              style={
                type === t
                  ? {
                      backgroundColor: `${EVENT_TYPE_COLORS[t]}18`,
                      color: EVENT_TYPE_COLORS[t],
                      borderColor: `${EVENT_TYPE_COLORS[t]}40`,
                    }
                  : {}
              }
            >
              <Icon className="h-3 w-3" />
              {EVENT_TYPE_LABELS[t]}
            </button>
          );
        })}
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)"
        maxLength={500}
        rows={2}
        className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-power-orange focus:outline-none focus:ring-1 focus:ring-power-orange/40"
      />

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" loading={saving}>
          Add Event
        </Button>
      </div>
    </motion.form>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DashboardCalendar() {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const [currentMonth, setCurrentMonth] = useState<Date>(
    () => new Date(today.getFullYear(), today.getMonth(), 1),
  );
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(
    toDateKey(today),
  );
  const [bookingsByDate, setBookingsByDate] = useState<
    Record<string, CalendarBooking[]>
  >({});
  const [eventsByDate, setEventsByDate] = useState<
    Record<string, CalendarEvent[]>
  >({});
  const [upcomingBookings, setUpcomingBookings] = useState<CalendarBooking[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [bookingTab, setBookingTab] = useState<"upcoming" | "past">("upcoming");

  // Build the visible grid cells once per month change
  const calendarCells = useMemo(
    () => buildCalendarGrid(currentMonth),
    [currentMonth],
  );

  const loadMonthData = useCallback(async (month: Date) => {
    setLoading(true);
    setShowAddForm(false);
    try {
      const { startDate, endDate } = formatMonthRange(month);
      const [bookings, events] = await Promise.all([
        calendarApi.getBookings(startDate, endDate),
        calendarApi.getEvents(startDate, endDate),
      ]);

      // Index by date key for O(1) lookups in the grid
      const byDateB: Record<string, CalendarBooking[]> = {};
      for (const b of bookings) {
        const key = toDateKey(parseLocalDate(b.date));
        (byDateB[key] ??= []).push(b);
      }

      const byDateE: Record<string, CalendarEvent[]> = {};
      for (const e of events) {
        const key = toDateKey(parseLocalDate(e.date));
        (byDateE[key] ??= []).push(e);
      }

      setBookingsByDate(byDateB);
      setEventsByDate(byDateE);
    } catch {
      toast.error("Failed to load calendar data");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load 3-month window for upcoming list (today → +90 days)
  const loadUpcomingBookings = useCallback(async () => {
    try {
      const start = toDateKey(today);
      const end = toDateKey(
        new Date(today.getFullYear(), today.getMonth() + 3, today.getDate()),
      );
      const bookings = await calendarApi.getBookings(start, end);
      setUpcomingBookings(
        bookings.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        ),
      );
    } catch {
      // non-critical
    }
  }, [today]);

  useEffect(() => {
    void loadMonthData(currentMonth);
  }, [currentMonth, loadMonthData]);

  useEffect(() => {
    void loadUpcomingBookings();
  }, [loadUpcomingBookings]);

  // Dots for a given calendar cell
  const getDotsForDate = useCallback(
    (key: string): DayDot[] => {
      const bookingCount = bookingsByDate[key]?.length ?? 0;
      const bookingDots: DayDot[] = Array.from(
        { length: bookingCount },
        () => ({
          color: "#f97316",
          kind: "booking" as const,
        }),
      );
      const eventDots: DayDot[] = (eventsByDate[key] ?? []).map((e) => ({
        color: e.color,
        kind: "event" as const,
      }));
      return [...bookingDots, ...eventDots];
    },
    [bookingsByDate, eventsByDate],
  );

  const navigateMonth = (dir: -1 | 1) => {
    setCurrentMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + dir, 1),
    );
    setSelectedDateKey(null);
  };

  const handleDateClick = (date: Date) => {
    const key = toDateKey(date);
    setSelectedDateKey((prev) => (prev === key ? null : key));
    setShowAddForm(false);
  };

  const handleAddEvent = (event: CalendarEvent) => {
    const key = toDateKey(parseLocalDate(event.date));
    setEventsByDate((prev) => ({
      ...prev,
      [key]: [...(prev[key] ?? []), event],
    }));
    setShowAddForm(false);
    void loadUpcomingBookings();
  };

  const handleDeleteEvent = async (id: string) => {
    setDeletingEventId(id);
    try {
      await calendarApi.deleteEvent(id);
      setEventsByDate((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(next)) {
          next[key] = (next[key] ?? []).filter((e) => e.id !== id);
        }
        return next;
      });
      toast.success("Event removed");
    } catch {
      toast.error("Failed to delete event");
    } finally {
      setDeletingEventId(null);
    }
  };

  // Selected date data
  const selectedBookings = selectedDateKey
    ? (bookingsByDate[selectedDateKey] ?? [])
    : [];
  const selectedEvents = selectedDateKey
    ? (eventsByDate[selectedDateKey] ?? [])
    : [];
  const selectedDateObj = selectedDateKey
    ? parseLocalDate(selectedDateKey)
    : null;

  // Upcoming / past bookings for the list tab
  const todayKey = toDateKey(today);
  const allBookingEntries = useMemo(() => {
    const entries: { key: string; bookings: CalendarBooking[] }[] = [];
    for (const [key, bookings] of Object.entries(bookingsByDate)) {
      if (bookings.length) entries.push({ key, bookings });
    }
    return entries.sort((a, b) => a.key.localeCompare(b.key));
  }, [bookingsByDate]);

  const upcomingEntries = allBookingEntries.filter((e) => e.key >= todayKey);
  const pastEntries = allBookingEntries
    .filter((e) => e.key < todayKey)
    .reverse();

  return (
    <Card className="shop-surface premium-shadow overflow-hidden p-0">
      <ProfileSectionHeader
        icon={Calendar}
        title="My Calendar"
        description="Track bookings and mark important dates for your athlete."
        action={
          selectedDateKey ? (
            <Button
              variant="outline"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() => setShowAddForm((v) => !v)}
            >
              Add Event
            </Button>
          ) : undefined
        }
      />

      <CardContent className="px-5 py-5 lg:px-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
          {/* ── Left: Calendar Grid ────────────────────────── */}
          <div className="shrink-0 lg:w-72">
            {/* Month navigator */}
            <div className="mb-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => navigateMonth(-1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="text-sm font-semibold text-slate-800">
                {MONTH_NAMES[currentMonth.getMonth()]}{" "}
                {currentMonth.getFullYear()}
              </p>
              <button
                type="button"
                onClick={() => navigateMonth(1)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Day-of-week headers */}
            <div className="mb-1 grid grid-cols-7 gap-0.5">
              {DAY_LABELS.map((d) => (
                <div
                  key={d}
                  className="flex items-center justify-center py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar cells */}
            {loading ? (
              <div className="grid grid-cols-7 gap-0.5">
                {Array.from({ length: 42 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-10 animate-pulse rounded-xl bg-slate-100"
                  />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-7 gap-0.5">
                {calendarCells.map((date, i) => {
                  const key = toDateKey(date);
                  const isCurrent = date.getMonth() === currentMonth.getMonth();
                  const isToday =
                    date.getFullYear() === today.getFullYear() &&
                    date.getMonth() === today.getMonth() &&
                    date.getDate() === today.getDate();
                  return (
                    <CalendarCell
                      key={i}
                      date={date}
                      isCurrentMonth={isCurrent}
                      isToday={isToday}
                      isSelected={selectedDateKey === key}
                      dots={getDotsForDate(key)}
                      onClick={() => handleDateClick(date)}
                    />
                  );
                })}
              </div>
            )}

            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-x-3 gap-y-1.5">
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                <span className="h-2 w-2 rounded-full bg-power-orange" />
                Booking
              </span>
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                <span className="h-2 w-2 rounded-full bg-violet-500" />
                Competition
              </span>
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                <span className="h-2 w-2 rounded-full bg-turf-green" />
                Training
              </span>
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                Reminder
              </span>
            </div>
          </div>

          {/* ── Right: Detail / List Panel ─────────────────── */}
          <div className="flex-1 min-w-0 lg:border-l lg:border-slate-200/60 lg:pl-6">
            <AnimatePresence mode="wait">
              {selectedDateKey && selectedDateObj ? (
                <motion.div
                  key={selectedDateKey}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="space-y-4"
                >
                  {/* Selected date header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {formatShortDate(selectedDateObj)}
                      </p>
                      <p className="text-xs text-slate-500">
                        {selectedBookings.length} booking
                        {selectedBookings.length !== 1 ? "s" : ""} ·{" "}
                        {selectedEvents.length} event
                        {selectedEvents.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDateKey(null);
                        setShowAddForm(false);
                      }}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Add event form */}
                  <AnimatePresence>
                    {showAddForm && (
                      <AddEventForm
                        date={selectedDateKey}
                        onAdd={handleAddEvent}
                        onCancel={() => setShowAddForm(false)}
                      />
                    )}
                  </AnimatePresence>

                  {/* Bookings for this day */}
                  {selectedBookings.length > 0 && (
                    <div className="space-y-2">
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        <Clock className="h-3 w-3" />
                        Sessions
                      </p>
                      {selectedBookings.map((b, idx) => (
                        <BookingCard
                          key={b.id ?? (b as any)._id ?? `booking-${idx}`}
                          booking={b}
                        />
                      ))}
                    </div>
                  )}

                  {/* Events for this day */}
                  {selectedEvents.length > 0 && (
                    <div className="space-y-2">
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                        <Star className="h-3 w-3" />
                        Events
                      </p>
                      {selectedEvents.map((e, idx) => (
                        <EventCard
                          key={e.id ?? (e as any)._id ?? `event-${idx}`}
                          event={e}
                          onDelete={handleDeleteEvent}
                          deleting={deletingEventId === e.id}
                        />
                      ))}
                    </div>
                  )}

                  {/* Empty state for this day */}
                  {selectedBookings.length === 0 &&
                    selectedEvents.length === 0 &&
                    !showAddForm && (
                      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 py-10 text-center">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100">
                          <Calendar className="h-5 w-5 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-600">
                            Nothing scheduled
                          </p>
                          <p className="text-xs text-slate-400">
                            Add an event to mark this date
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<Plus size={13} />}
                          onClick={() => setShowAddForm(true)}
                        >
                          Add Event
                        </Button>
                      </div>
                    )}
                </motion.div>
              ) : (
                <motion.div
                  key="list"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className="space-y-4"
                >
                  {/* Tab selector */}
                  <div className="flex items-center gap-2">
                    <p className="mr-1 text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                      <Zap className="h-4 w-4 text-power-orange" />
                      Sessions
                    </p>
                    {(["upcoming", "past"] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setBookingTab(tab)}
                        className={cn(
                          "rounded-lg px-3 py-1 text-xs font-semibold transition-all",
                          bookingTab === tab
                            ? "bg-power-orange text-white shadow-sm"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200",
                        )}
                      >
                        {tab === "upcoming" ? "Upcoming" : "Past"}
                      </button>
                    ))}
                    <span className="ml-auto text-xs text-slate-400">
                      Click a date to see details
                    </span>
                  </div>

                  {loading ? (
                    <div className="space-y-2">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="h-16 animate-pulse rounded-xl bg-slate-100"
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1 overflow-y-auto max-h-72 pr-1">
                      {(bookingTab === "upcoming"
                        ? upcomingEntries
                        : pastEntries
                      ).length === 0 ? (
                        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-8 text-center">
                          <Calendar className="h-8 w-8 text-slate-300" />
                          <p className="text-sm text-slate-400">
                            No {bookingTab} sessions
                          </p>
                        </div>
                      ) : (
                        (bookingTab === "upcoming"
                          ? upcomingEntries
                          : pastEntries
                        ).map(({ key, bookings }) => {
                          const d = parseLocalDate(key);
                          return (
                            <div key={key}>
                              <p
                                className={cn(
                                  "px-1 py-1.5 text-[10px] font-bold uppercase tracking-wider",
                                  key === todayKey
                                    ? "text-power-orange"
                                    : "text-slate-400",
                                )}
                              >
                                {key === todayKey
                                  ? "Today"
                                  : d.toLocaleDateString("en-IN", {
                                      weekday: "short",
                                      day: "numeric",
                                      month: "short",
                                    })}
                              </p>
                              <div className="space-y-1.5">
                                {bookings.map((b, idx) => (
                                  <motion.div
                                    key={
                                      b.id ??
                                      (b as any)._id ??
                                      `upc-booking-${idx}`
                                    }
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200/70 bg-slate-50/60 px-3 py-2.5 hover:bg-white transition-colors"
                                    onClick={() =>
                                      handleDateClick(
                                        parseLocalDate(
                                          typeof b.date === "string"
                                            ? b.date
                                            : toDateKey(new Date(b.date)),
                                        ),
                                      )
                                    }
                                  >
                                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-100">
                                      <Calendar className="h-3.5 w-3.5 text-power-orange" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="truncate text-sm font-semibold text-slate-900">
                                        {getBookingLabel(b)}
                                      </p>
                                      <p className="text-xs text-slate-500">
                                        {b.sport} · {formatTime(b.startTime)}
                                      </p>
                                    </div>
                                    <Badge
                                      className={cn(
                                        "shrink-0 border text-[10px]",
                                        BOOKING_STATUS_COLORS[b.status] ??
                                          "bg-slate-50 text-slate-600 border-slate-200",
                                      )}
                                    >
                                      {formatStatus(b.status)}
                                    </Badge>
                                  </motion.div>
                                ))}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
