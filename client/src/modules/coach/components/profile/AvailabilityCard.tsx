import { DAYS } from "@/modules/coach/utils/profileFlow";
import { Button } from "@/modules/shared/ui/Button";
import { Card } from "@/modules/shared/ui/Card";
import { IAvailability } from "@/types";
import { Clock3, Plus, Trash2 } from "lucide-react";

interface AvailabilityCardProps {
  sports: string[];
  activeSportTab: string;
  setActiveSportTab: (sport: string) => void;
  availabilityBySport: Record<string, IAvailability[]>;
  savingAvailability: boolean;
  onAddTimeSlot: () => void;
  onRemoveTimeSlot: (index: number) => void;
  onUpdateTimeSlot: (index: number, key: keyof IAvailability, value: number | string) => void;
  onSave: () => void;
}

export function AvailabilityCard({
  sports,
  activeSportTab,
  setActiveSportTab,
  availabilityBySport,
  savingAvailability,
  onAddTimeSlot,
  onRemoveTimeSlot,
  onUpdateTimeSlot,
  onSave,
}: AvailabilityCardProps) {
  return (
    <Card className="border border-slate-200 bg-white shadow-sm">
      <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Availability / Time Slots</h3>
        <Button
          type="button"
          variant="secondary"
          className="flex w-full items-center justify-center gap-2 sm:w-auto"
          onClick={onAddTimeSlot}
          disabled={!activeSportTab}
        >
          <Plus size={16} />
          Add Slot
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {sports.map((sport) => (
          <button
            key={sport}
            type="button"
            onClick={() => setActiveSportTab(sport)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${
              activeSportTab === sport
                ? "border-power-orange text-power-orange bg-orange-50"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {sport}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {!activeSportTab ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            No sports found for this coach profile.
          </div>
        ) : (availabilityBySport[activeSportTab] || []).length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
            No time slots added yet for {activeSportTab}.
          </div>
        ) : (
          (availabilityBySport[activeSportTab] || []).map((slot, index) => (
            <div
              key={`${slot.dayOfWeek}-${slot.startTime}-${slot.endTime}-${index}`}
              className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end"
            >
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Day
                </label>
                <select
                  value={slot.dayOfWeek}
                  onChange={(event) =>
                    onUpdateTimeSlot(index, "dayOfWeek", Number(event.target.value))
                  }
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                >
                  {DAYS.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Start Time
                </label>
                <input
                  type="time"
                  value={slot.startTime}
                  onChange={(event) => onUpdateTimeSlot(index, "startTime", event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  End Time
                </label>
                <input
                  type="time"
                  value={slot.endTime}
                  onChange={(event) => onUpdateTimeSlot(index, "endTime", event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                />
              </div>

              <button
                type="button"
                onClick={() => onRemoveTimeSlot(index)}
                className="inline-flex items-center justify-center rounded-lg border border-red-200 bg-white px-3 py-2 text-red-600 hover:bg-red-50"
                aria-label="Remove time slot"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          variant="primary"
          onClick={onSave}
          disabled={savingAvailability}
          className="flex w-full items-center justify-center gap-2 sm:w-auto"
        >
          <Clock3 size={16} />
          {savingAvailability ? "Saving..." : "Save Time Slots"}
        </Button>
      </div>
    </Card>
  );
}
