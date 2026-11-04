import { DAYS } from "@/modules/coach/utils/profileFlow";
import { Button } from "@/modules/shared/ui/Button";
import { TEXT_LINK } from "@/modules/shared/ui/textLink";
import { UnderlineFilter } from "@/modules/shared/ui/UnderlineFilter";
import { IAvailability } from "@/types";
import { Plus, Trash2 } from "lucide-react";
import {
  FIELD_INPUT,
  FIELD_LABEL,
  ProfileSection,
} from "@/modules/shared/components/settings/ProfileSection";

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

/**
 * The weekly hours clients can book, set per sport. This section is always
 * editable (the rows are the form), so the add link and the save button are
 * always there; nothing is saved until the coach saves.
 */
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
  const slots = availabilityBySport[activeSportTab] || [];

  return (
    <ProfileSection
      id="availability"
      title="Availability"
      description="The weekly hours clients can book you, set separately for each sport."
      action={
        <button
          type="button"
          onClick={onAddTimeSlot}
          disabled={!activeSportTab}
          className={`${TEXT_LINK} ring-offset-paper min-h-11 text-sm disabled:opacity-50`}
        >
          <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
          Add a time slot
        </button>
      }
    >
      {sports.length > 1 && (
        <UnderlineFilter
          label="Sport"
          value={activeSportTab}
          onChange={setActiveSportTab}
          items={sports.map((sport) => ({
            label: sport,
            value: sport,
            count: (availabilityBySport[sport] || []).length,
          }))}
          className="mb-6"
        />
      )}

      {!activeSportTab ? (
        <p className="text-ink-body">No sports are listed on your profile yet.</p>
      ) : slots.length === 0 ? (
        <p className="text-ink-body max-w-[56ch] text-pretty">
          No time slots for {activeSportTab} yet. Add one to let clients book you.
        </p>
      ) : (
        <ul>
          {slots.map((slot, index) => (
            <li
              key={`${slot.dayOfWeek}-${slot.startTime}-${slot.endTime}-${index}`}
              className="border-hairline grid gap-3 border-b pb-5 pt-5 first:pt-0 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end"
            >
              <div>
                <label htmlFor={`slot-day-${index}`} className={FIELD_LABEL}>
                  Day
                </label>
                <select
                  id={`slot-day-${index}`}
                  value={slot.dayOfWeek}
                  onChange={(event) =>
                    onUpdateTimeSlot(index, "dayOfWeek", Number(event.target.value))
                  }
                  className={FIELD_INPUT}
                >
                  {DAYS.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor={`slot-start-${index}`} className={FIELD_LABEL}>
                  From
                </label>
                <input
                  id={`slot-start-${index}`}
                  type="time"
                  value={slot.startTime}
                  onChange={(event) => onUpdateTimeSlot(index, "startTime", event.target.value)}
                  className={FIELD_INPUT}
                />
              </div>

              <div>
                <label htmlFor={`slot-end-${index}`} className={FIELD_LABEL}>
                  To
                </label>
                <input
                  id={`slot-end-${index}`}
                  type="time"
                  value={slot.endTime}
                  onChange={(event) => onUpdateTimeSlot(index, "endTime", event.target.value)}
                  className={FIELD_INPUT}
                />
              </div>

              <button
                type="button"
                onClick={() => onRemoveTimeSlot(index)}
                className="text-ink hover:bg-paper-deep focus-visible:ring-ink inline-flex h-11 w-11 items-center justify-center rounded-md transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2"
                aria-label={`Remove ${DAYS.find((d) => d.value === slot.dayOfWeek)?.label ?? ""} time slot`}
              >
                <Trash2 size={18} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-6">
        <Button
          type="button"
          variant="secondary"
          onClick={onSave}
          disabled={savingAvailability}
          className="min-h-11"
        >
          {savingAvailability ? "Saving" : "Save time slots"}
        </Button>
      </div>
    </ProfileSection>
  );
}
