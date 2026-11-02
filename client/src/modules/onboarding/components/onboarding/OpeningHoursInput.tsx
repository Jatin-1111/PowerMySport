import { FIELD_INPUT } from "@/modules/shared/components/settings/ProfileSection";
import { TEXT_LINK } from "@/modules/shared/ui/textLink";
import { cn } from "@/utils/cn";

export interface DaySlot {
  startTime: string;
  endTime: string;
}

export interface DayHours {
  isOpen: boolean;
  openTime?: string;
  closeTime?: string;
  slots?: DaySlot[];
}

export interface OpeningHours {
  monday: DayHours;
  tuesday: DayHours;
  wednesday: DayHours;
  thursday: DayHours;
  friday: DayHours;
  saturday: DayHours;
  sunday: DayHours;
}

interface OpeningHoursInputProps {
  value: OpeningHours;
  onChange: (hours: OpeningHours) => void;
}

/** A time box sized to its content, not the full row. */
const TIME_INPUT = cn(FIELD_INPUT, "w-36 tabular-nums");

const DAYS = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
] as const;

export const getDefaultOpeningHours = (): OpeningHours => ({
  monday: {
    isOpen: true,
    openTime: "09:00",
    closeTime: "21:00",
    slots: [{ startTime: "09:00", endTime: "21:00" }],
  },
  tuesday: {
    isOpen: true,
    openTime: "09:00",
    closeTime: "21:00",
    slots: [{ startTime: "09:00", endTime: "21:00" }],
  },
  wednesday: {
    isOpen: true,
    openTime: "09:00",
    closeTime: "21:00",
    slots: [{ startTime: "09:00", endTime: "21:00" }],
  },
  thursday: {
    isOpen: true,
    openTime: "09:00",
    closeTime: "21:00",
    slots: [{ startTime: "09:00", endTime: "21:00" }],
  },
  friday: {
    isOpen: true,
    openTime: "09:00",
    closeTime: "21:00",
    slots: [{ startTime: "09:00", endTime: "21:00" }],
  },
  saturday: {
    isOpen: true,
    openTime: "09:00",
    closeTime: "21:00",
    slots: [{ startTime: "09:00", endTime: "21:00" }],
  },
  sunday: {
    isOpen: true,
    openTime: "09:00",
    closeTime: "21:00",
    slots: [{ startTime: "09:00", endTime: "21:00" }],
  },
});

const sortSlots = (slots: DaySlot[]): DaySlot[] => {
  return [...slots].sort((a, b) => a.startTime.localeCompare(b.startTime));
};

const normalizeDayHours = (dayHours: DayHours): DayHours => {
  const derivedSlots =
    dayHours.slots && dayHours.slots.length > 0
      ? dayHours.slots
      : dayHours.openTime && dayHours.closeTime
        ? [{ startTime: dayHours.openTime, endTime: dayHours.closeTime }]
        : dayHours.isOpen
          ? [{ startTime: "09:00", endTime: "21:00" }]
          : [];

  const sortedSlots = sortSlots(derivedSlots);
  const firstSlot = sortedSlots[0];
  const lastSlot = sortedSlots[sortedSlots.length - 1];

  return {
    ...dayHours,
    slots: sortedSlots,
    openTime: firstSlot?.startTime,
    closeTime: lastSlot?.endTime,
  };
};

export default function OpeningHoursInput({ value, onChange }: OpeningHoursInputProps) {
  const handleDayToggle = (day: keyof OpeningHours) => {
    const current = normalizeDayHours(value[day]);
    const isOpening = !current.isOpen;

    onChange({
      ...value,
      [day]: {
        ...current,
        isOpen: isOpening,
        slots:
          current.slots && current.slots.length > 0
            ? current.slots
            : [{ startTime: "09:00", endTime: "21:00" }],
      },
    });
  };

  const handleSlotTimeChange = (
    day: keyof OpeningHours,
    slotIndex: number,
    field: keyof DaySlot,
    time: string
  ) => {
    const current = normalizeDayHours(value[day]);
    const nextSlots = (current.slots || []).map((slot, index) =>
      index === slotIndex ? { ...slot, [field]: time } : slot
    );

    const normalized = normalizeDayHours({
      ...current,
      slots: nextSlots,
    });

    onChange({
      ...value,
      [day]: {
        ...normalized,
      },
    });
  };

  const addSlot = (day: keyof OpeningHours) => {
    const current = normalizeDayHours(value[day]);
    const nextSlots = [...(current.slots || [])];
    const lastSlot = nextSlots[nextSlots.length - 1];

    nextSlots.push({
      startTime: lastSlot?.endTime || "09:00",
      endTime: lastSlot?.endTime || "10:00",
    });

    onChange({
      ...value,
      [day]: normalizeDayHours({
        ...current,
        isOpen: true,
        slots: nextSlots,
      }),
    });
  };

  const removeSlot = (day: keyof OpeningHours, slotIndex: number) => {
    const current = normalizeDayHours(value[day]);
    const nextSlots = (current.slots || []).filter((_, i) => i !== slotIndex);

    onChange({
      ...value,
      [day]: normalizeDayHours({
        ...current,
        slots: nextSlots.length > 0 ? nextSlots : [{ startTime: "09:00", endTime: "21:00" }],
      }),
    });
  };

  const copyToAllDays = () => {
    const mondayHours = normalizeDayHours(value.monday);
    const newHours: OpeningHours = {} as OpeningHours;
    DAYS.forEach(({ key }) => {
      newHours[key] = {
        ...mondayHours,
        slots: [...(mondayHours.slots || [])],
      };
    });
    onChange(newHours);
  };

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <span className="sr-only">Opening hours</span>
        <button
          type="button"
          onClick={copyToAllDays}
          className={`${TEXT_LINK} ring-offset-paper min-h-11 text-sm`}
        >
          Copy Monday to all days
        </button>
      </div>

      <ul className="border-hairline border-t">
        {DAYS.map(({ key, label }) => {
          const dayHours = normalizeDayHours(value[key]);
          const slots = dayHours.slots || [];
          return (
            <li
              key={key}
              className="border-hairline grid gap-x-6 gap-y-2 border-b py-3 sm:grid-cols-[9rem_minmax(0,1fr)]"
            >
              <label className="flex min-h-11 cursor-pointer items-center gap-3 self-start">
                <input
                  type="checkbox"
                  checked={dayHours.isOpen}
                  onChange={() => handleDayToggle(key)}
                  className="accent-ink h-4 w-4"
                />
                <span className="text-ink text-sm font-medium">{label}</span>
              </label>

              {dayHours.isOpen ? (
                <div className="space-y-2">
                  {slots.map((slot, slotIndex) => (
                    <div
                      key={`${key}-${slotIndex}`}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1"
                    >
                      <input
                        type="time"
                        aria-label={`${label}, slot ${slotIndex + 1} opens`}
                        value={slot.startTime}
                        onChange={(e) =>
                          handleSlotTimeChange(key, slotIndex, "startTime", e.target.value)
                        }
                        className={TIME_INPUT}
                      />
                      <span className="text-ink-body text-sm">to</span>
                      <input
                        type="time"
                        aria-label={`${label}, slot ${slotIndex + 1} closes`}
                        value={slot.endTime}
                        onChange={(e) =>
                          handleSlotTimeChange(key, slotIndex, "endTime", e.target.value)
                        }
                        className={TIME_INPUT}
                      />
                      {slots.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSlot(key, slotIndex)}
                          aria-label={`Remove ${label} slot ${slotIndex + 1}`}
                          className={`${TEXT_LINK} ring-offset-paper min-h-11 text-sm`}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => addSlot(key)}
                    aria-label={`Add another ${label} slot`}
                    className={`${TEXT_LINK} ring-offset-paper min-h-11 text-sm`}
                  >
                    Add a slot
                  </button>
                </div>
              ) : (
                <p className="text-ink-body flex min-h-11 items-center text-sm">Closed</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
