import React from "react";

export interface DayHours {
  isOpen: boolean;
  openTime?: string;
  closeTime?: string;
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
  monday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
  tuesday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
  wednesday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
  thursday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
  friday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
  saturday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
  sunday: { isOpen: true, openTime: "09:00", closeTime: "21:00" },
});

export default function OpeningHoursInput({
  value,
  onChange,
}: OpeningHoursInputProps) {
  const handleDayToggle = (day: keyof OpeningHours) => {
    onChange({
      ...value,
      [day]: {
        ...value[day],
        isOpen: !value[day].isOpen,
      },
    });
  };

  const handleTimeChange = (
    day: keyof OpeningHours,
    field: "openTime" | "closeTime",
    time: string,
  ) => {
    onChange({
      ...value,
      [day]: {
        ...value[day],
        [field]: time,
      },
    });
  };

  const copyToAllDays = () => {
    const mondayHours = value.monday;
    const newHours: OpeningHours = {} as OpeningHours;
    DAYS.forEach(({ key }) => {
      newHours[key] = { ...mondayHours };
    });
    onChange(newHours);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          Opening Hours
        </label>
        <button
          type="button"
          onClick={copyToAllDays}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Copy Monday to all days
        </button>
      </div>

      <div className="space-y-3">
        {DAYS.map(({ key, label }) => {
          const dayHours = value[key];
          return (
            <div
              key={key}
              className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg justify-between"
            >
              <div className="flex items-center gap-2 w-32">
                <input
                  type="checkbox"
                  checked={dayHours.isOpen}
                  onChange={() => handleDayToggle(key)}
                  className="w-4 h-4 text-blue-600 rounded"
                />
                <span className="text-sm font-medium text-gray-700">
                  {label}
                </span>
              </div>

              {dayHours.isOpen ? (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={dayHours.openTime || "09:00"}
                    onChange={(e) =>
                      handleTimeChange(key, "openTime", e.target.value)
                    }
                    className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <span className="text-gray-500 text-sm">to</span>
                  <input
                    type="time"
                    value={dayHours.closeTime || "21:00"}
                    onChange={(e) =>
                      handleTimeChange(key, "closeTime", e.target.value)
                    }
                    className="px-3 py-1.5 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              ) : (
                <span className="text-sm text-gray-500 italic">Closed</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
