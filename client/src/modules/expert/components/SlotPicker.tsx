"use client";

import { expertApi, type OpenSlot } from "@/modules/expert/services/expert";
import { Skeleton } from "@/modules/shared/ui/Skeleton";
import { cn } from "@/utils/cn";
import { CalendarClock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const TZ_FALLBACK = "Asia/Kolkata";

interface SlotPickerProps {
  expertId: string;
  value: string | null;
  onChange: (iso: string | null) => void;
  className?: string;
  /** Timezone to render slot times in (defaults to the expert's, Asia/Kolkata). */
  timezone?: string;
}

const weekdayLabel = (iso: string, tz: string) =>
  new Date(iso).toLocaleDateString("en-IN", { timeZone: tz, weekday: "short" });

const dateLabel = (iso: string, tz: string) =>
  new Date(iso).toLocaleDateString("en-IN", { timeZone: tz, day: "numeric", month: "short" });

const timeLabel = (iso: string, tz: string) =>
  new Date(iso).toLocaleTimeString("en-IN", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  });

// Group by the calendar date *in the expert's timezone* so day buckets line up
// with the times shown.
const dateKey = (iso: string, tz: string) =>
  new Date(iso).toLocaleDateString("en-CA", { timeZone: tz });

const focusRing =
  "focus-visible:ring-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

/**
 * Fetches an expert's open slots and lets the user pick one. Groups slots by
 * day; selecting a time emits its ISO string. Used for booking and rescheduling.
 * All times render in the expert's timezone so client + expert see the same time.
 *
 * Days run along a swipeable strip with no scrollbar (the right edge fades to
 * show there are more), and the chosen day and time are marked in ink; orange
 * is left for the booking button.
 */
export function SlotPicker({ expertId, value, onChange, className, timezone }: SlotPickerProps) {
  const tz = timezone || TZ_FALLBACK;
  const [slots, setSlots] = useState<OpenSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await expertApi.getAvailability(expertId);
        if (!active) return;
        if (res.success && res.data) setSlots(res.data);
        else setError(res.message || "Could not load availability.");
      } catch {
        if (active) setError("Could not load availability.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [expertId]);

  const days = useMemo(() => {
    const map = new Map<string, OpenSlot[]>();
    for (const s of slots) {
      const key = dateKey(s.start, tz);
      const arr = map.get(key) || [];
      arr.push(s);
      map.set(key, arr);
    }
    return Array.from(map.entries()).map(([key, list]) => ({ key, list }));
  }, [slots, tz]);

  useEffect(() => {
    if (!activeDay && days.length > 0) setActiveDay(days[0].key);
  }, [days, activeDay]);

  if (loading) {
    return (
      <div className={className} aria-busy="true" aria-label="Loading available times">
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-14 w-16 shrink-0 rounded-lg" />
          ))}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <p className={cn("text-sm text-red-700", className)} role="alert">
        {error}
      </p>
    );
  }

  if (slots.length === 0) {
    return (
      <div
        className={cn(
          "bg-paper-deep text-ink-body flex items-start gap-2 rounded-lg p-3 text-sm",
          className
        )}
      >
        <CalendarClock aria-hidden strokeWidth={1.5} className="mt-0.5 h-4 w-4 shrink-0" />
        No open slots right now. Please check back later.
      </div>
    );
  }

  const activeSlots = days.find((d) => d.key === activeDay)?.list || [];

  return (
    <div className={className}>
      <p className="text-ink-muted mb-3 text-sm">Times shown in {tz}</p>

      {/* Day strip: swipe or scroll, scrollbar hidden, fade on the right edge. */}
      <div
        className="hide-scrollbar -mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1 pr-8 [mask-image:linear-gradient(to_right,black_calc(100%-2.5rem),transparent)]"
        role="group"
        aria-label="Choose a day"
      >
        {days.map((d) => {
          const selected = activeDay === d.key;
          return (
            <button
              key={d.key}
              type="button"
              aria-pressed={selected}
              onClick={() => setActiveDay(d.key)}
              className={cn(
                "flex min-w-[4.25rem] shrink-0 snap-start flex-col items-center rounded-lg border px-3 py-2 transition-colors duration-200",
                focusRing,
                selected
                  ? "border-ink bg-paper-deep text-ink"
                  : "border-hairline text-ink-body hover:border-ink/40 bg-white"
              )}
            >
              <span className={cn("text-xs", selected ? "text-ink" : "text-ink-muted")}>
                {weekdayLabel(d.list[0].start, tz)}
              </span>
              <span className="text-sm font-semibold tabular-nums">
                {dateLabel(d.list[0].start, tz)}
              </span>
            </button>
          );
        })}
      </div>

      <div
        className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4"
        role="group"
        aria-label="Choose a time"
      >
        {activeSlots.map((s) => {
          const selected = value === s.start;
          return (
            <button
              key={s.start}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(selected ? null : s.start)}
              className={cn(
                "rounded-lg border py-2.5 text-sm font-medium tabular-nums transition-colors duration-200 active:scale-[0.98]",
                focusRing,
                selected
                  ? "border-ink bg-ink text-white"
                  : "border-hairline text-ink hover:border-ink/40 bg-white"
              )}
            >
              {timeLabel(s.start, tz)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
