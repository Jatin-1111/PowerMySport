import { cn } from "@/utils/cn";

interface SlotGridProps {
  /** Every slot for the day, as "09:00-10:00". */
  slots: string[];
  /** The subset that can still be booked; the rest offer the waitlist. */
  availableSlots: string[];
  selectedStart: string | null;
  onSelect: (slot: { startTime: string; endTime: string }) => void;
}

const startOf = (slot: string) => slot.split("-")[0] || slot;

const GROUPS = [
  { label: "Morning", until: 12 },
  { label: "Afternoon", until: 17 },
  { label: "Evening", until: 24 },
] as const;

/**
 * The day's time slots, grouped into morning, afternoon and evening so a long
 * day reads as three short lists instead of a scrolling box. Each button shows
 * the start time (slots are consecutive, so the end is the next one; it is in
 * the accessible name and the tooltip, and the booking summary spells it out).
 * A booked slot is dashed and struck through and offers the waitlist; the chosen
 * one is ink.
 */
export function SlotGrid({ slots, availableSlots, selectedStart, onSelect }: SlotGridProps) {
  const available = new Set(availableSlots.map(startOf));

  const hourOf = (slot: string) => parseInt(startOf(slot).split(":")[0] || "0", 10);
  const groups = GROUPS.map((group, i) => {
    const from = i === 0 ? 0 : GROUPS[i - 1].until;
    return {
      label: group.label,
      slots: slots.filter((slot) => hourOf(slot) >= from && hourOf(slot) < group.until),
    };
  }).filter((group) => group.slots.length > 0);

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="text-ink-muted mb-2 text-sm">{group.label}</p>
          <div className="grid grid-cols-3 gap-2">
            {group.slots.map((slot) => {
              const startTime = startOf(slot);
              const startHour = hourOf(slot);
              const endTime = slot.split("-")[1] || `${String(startHour + 1).padStart(2, "0")}:00`;
              const isAvailable = available.has(startTime);
              const isSelected = selectedStart === startTime;
              return (
                <button
                  key={slot}
                  type="button"
                  aria-pressed={isSelected}
                  aria-label={`${startTime} to ${endTime}${isAvailable ? "" : ", booked, join the waitlist"}`}
                  title={`${startTime} to ${endTime}`}
                  onClick={() => onSelect({ startTime, endTime })}
                  className={cn(
                    "focus-visible:ring-ink rounded-lg border px-2 py-2.5 text-sm font-medium tabular-nums transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 active:scale-[0.98]",
                    isSelected
                      ? "border-ink bg-ink text-white"
                      : isAvailable
                        ? "border-hairline text-ink hover:border-ink/40 bg-white"
                        : "border-hairline text-ink-muted hover:border-ink/40 border-dashed bg-transparent line-through"
                  )}
                >
                  {startTime}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {slots.some((slot) => !available.has(startOf(slot))) && (
        <p className="text-ink-muted text-sm">
          Struck-through times are booked. Choose one to join the waitlist.
        </p>
      )}
    </div>
  );
}
