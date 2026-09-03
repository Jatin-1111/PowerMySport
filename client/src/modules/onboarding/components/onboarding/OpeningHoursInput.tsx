import React from "react";

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-semibold text-slate-900">Opening Hours</label>
        <button
          type="button"
          onClick={copyToAllDays}
          className="text-power-orange text-sm font-semibold hover:text-orange-600"
        >
          Copy Monday to all days
        </button>
      </div>

      <div className="space-y-3">
        {DAYS.map(({ key, label }) => {
          const dayHours = normalizeDayHours(value[key]);
          return (
            <div key={key} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={dayHours.isOpen}
                    onChange={() => handleDayToggle(key)}
                    className="accent-power-orange h-4 w-4 rounded"
                  />
                  <span className="text-sm font-medium text-slate-700">{label}</span>
                </div>

                {dayHours.isOpen && (
                  <button
                    type="button"
                    onClick={() => addSlot(key)}
                    className="text-power-orange text-sm font-semibold hover:text-orange-600"
                  >
                    Add slot
                  </button>
                )}
              </div>

              {dayHours.isOpen ? (
                <div className="space-y-2">
                  {(dayHours.slots || []).map((slot, slotIndex) => (
                    <div key={`${key}-${slotIndex}`} className="flex items-center gap-2">
                      <input
                        type="time"
                        value={slot.startTime}
                        onChange={(e) =>
                          handleSlotTimeChange(key, slotIndex, "startTime", e.target.value)
                        }
                        className="focus:ring-power-orange rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-transparent focus:ring-2"
                      />
                      <span className="text-sm text-slate-500">to</span>
                      <input
                        type="time"
                        value={slot.endTime}
                        onChange={(e) =>
                          handleSlotTimeChange(key, slotIndex, "endTime", e.target.value)
                        }
                        className="focus:ring-power-orange rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus:border-transparent focus:ring-2"
                      />
                      {(dayHours.slots || []).length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSlot(key, slotIndex)}
                          className="text-sm font-medium text-red-600 hover:text-red-700"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-sm text-slate-500 italic">Closed</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
