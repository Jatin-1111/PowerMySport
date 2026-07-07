"use client";

import { expertApi, type OpenSlot } from "@/modules/expert/services/expert";
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

const dayLabel = (iso: string, tz: string) =>
  new Date(iso).toLocaleDateString("en-IN", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
  });

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

/**
 * Fetches an expert's open slots and lets the user pick one. Groups slots by
 * day; selecting a time emits its ISO string. Used for booking and rescheduling.
 * All times render in the expert's timezone so client + expert see the same time.
 */
export function SlotPicker({
  expertId,
  value,
  onChange,
  className,
  timezone,
}: SlotPickerProps) {
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
      <div
        className={cn(
          "flex items-center gap-2 text-sm text-slate-500",
          className,
        )}
      >
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-power-orange" />
        Loading available times…
      </div>
    );
  }

  if (error) {
    return <p className={cn("text-sm text-red-600", className)}>{error}</p>;
  }

  if (slots.length === 0) {
    return (
      <div
        className={cn(
          "flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-500",
          className,
        )}
      >
        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
        No open slots right now. Please check back later.
      </div>
    );
  }

  const activeSlots = days.find((d) => d.key === activeDay)?.list || [];

  return (
    <div className={className}>
      <p className="mb-2 text-xs text-slate-400">Times shown in {tz}</p>
      <div className="flex gap-1.5 overflow-x-auto pb-2">
        {days.map((d) => (
          <button
            key={d.key}
            type="button"
            onClick={() => setActiveDay(d.key)}
            className={cn(
              "shrink-0 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
              activeDay === d.key
                ? "border-power-orange bg-orange-50 text-power-orange"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
            )}
          >
            {dayLabel(d.list[0].start, tz)}
          </button>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {activeSlots.map((s) => (
          <button
            key={s.start}
            type="button"
            onClick={() => onChange(value === s.start ? null : s.start)}
            className={cn(
              "rounded-lg border py-2 text-sm font-medium transition-colors",
              value === s.start
                ? "border-power-orange bg-power-orange text-white"
                : "border-slate-200 bg-white text-slate-700 hover:border-power-orange hover:bg-orange-50",
            )}
          >
            {timeLabel(s.start, tz)}
          </button>
        ))}
      </div>
    </div>
  );
}
