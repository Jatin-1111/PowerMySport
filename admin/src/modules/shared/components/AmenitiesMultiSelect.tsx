"use client";

import { ChevronDown, X } from "lucide-react";
import { useState } from "react";

const AMENITIES_OPTIONS = [
  "Parking",
  "Restroom",
  "Water",
  "Changing Room",
  "Lockers",
  "Cafeteria",
  "AC",
  "Lights",
  "Equipment Rental",
  "WiFi",
];

interface AmenitiesMultiSelectProps {
  value: string[];
  onChange: (amenities: string[]) => void;
  disabled?: boolean;
  required?: boolean;
}

export default function AmenitiesMultiSelect({
  value,
  onChange,
  disabled = false,
  required = false,
}: AmenitiesMultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleAmenity = (amenity: string) => {
    const updated = value.includes(amenity)
      ? value.filter((a) => a !== amenity)
      : [...value, amenity];
    onChange(updated);
  };

  const removeAmenity = (amenity: string) => {
    onChange(value.filter((a) => a !== amenity));
  };

  return (
    <div className="w-full">
      <div className="relative">
        {/* Selected Tags */}
        {value.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2 border-b border-slate-200 pb-2">
            {value.map((amenity) => (
              <div
                key={amenity}
                className="bg-power-orange/10 text-power-orange inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm"
              >
                <span>{amenity}</span>
                <button
                  type="button"
                  onClick={() => removeAmenity(amenity)}
                  disabled={disabled}
                  className="hover:text-power-orange/70 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Dropdown Button */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 transition-colors hover:border-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100"
        >
          <span className="text-slate-700">
            {value.length === 0 ? "Select amenities..." : `${value.length} selected`}
          </span>
          <ChevronDown size={20} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>

        {/* Dropdown Menu */}
        {isOpen && !disabled && (
          <div className="absolute top-full right-0 left-0 z-10 mt-1 max-h-64 overflow-y-auto rounded-lg border border-slate-300 bg-white shadow-lg">
            {AMENITIES_OPTIONS.map((amenity) => (
              <label
                key={amenity}
                className="flex cursor-pointer items-center gap-3 border-b border-slate-100 px-4 py-3 transition-colors last:border-b-0 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={value.includes(amenity)}
                  onChange={() => toggleAmenity(amenity)}
                  className="accent-power-orange h-4 w-4 cursor-pointer rounded border-slate-300"
                />
                <span className="text-sm text-slate-900">{amenity}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {required && value.length === 0 && (
        <p className="mt-1 text-xs text-red-500">At least one amenity is required</p>
      )}
    </div>
  );
}
