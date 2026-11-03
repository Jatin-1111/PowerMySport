import { FIELD_INPUT, ProfileSection } from "@/modules/shared/components/settings/ProfileSection";
import { Button } from "@/modules/shared/ui/Button";
import { TEXT_LINK } from "@/modules/shared/ui/textLink";
import { cn } from "@/utils/cn";
import { X } from "lucide-react";
import { DAYS } from "./steps";
import { StepShell } from "./StepShell";
import type { ExpertOnboardingState } from "./useExpertOnboarding";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TIME_INPUT = cn(FIELD_INPUT, "w-36 tabular-nums");
const ACTION = `${TEXT_LINK} ring-offset-paper min-h-11 text-sm`;

export function AvailabilityStep({ o }: { o: ExpertOnboardingState }) {
  return (
    <>
      <StepShell
        title="Weekly availability"
        description="Parents can only book times inside these windows. You can skip this and set it later."
      >
        <ul className="border-hairline -mt-2 max-w-none border-t">
          {DAYS.map((day, dayIdx) => {
            const dayWindows = o.windows
              .map((w, i) => ({ w, i }))
              .filter(({ w }) => w.dayOfWeek === dayIdx);
            return (
              <li
                key={day}
                className="border-hairline grid gap-x-6 gap-y-2 border-b py-3 sm:grid-cols-[8rem_minmax(0,1fr)]"
              >
                <p className="text-ink flex min-h-11 items-center self-start text-sm font-medium">
                  {DAY_NAMES[dayIdx]}
                </p>
                <div className="space-y-2">
                  {dayWindows.length === 0 && (
                    <p className="text-ink-body flex min-h-11 items-center text-sm">Unavailable</p>
                  )}
                  {dayWindows.map(({ w, i }, slotIdx) => (
                    <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <input
                        type="time"
                        aria-label={`${day} slot ${slotIdx + 1} start time`}
                        className={TIME_INPUT}
                        value={w.start}
                        onChange={(e) => o.updateWindow(i, "start", e.target.value)}
                      />
                      <span className="text-ink-body text-sm" aria-hidden="true">
                        to
                      </span>
                      <input
                        type="time"
                        aria-label={`${day} slot ${slotIdx + 1} end time`}
                        className={TIME_INPUT}
                        value={w.end}
                        onChange={(e) => o.updateWindow(i, "end", e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => o.removeWindow(i)}
                        aria-label={`Remove ${day} slot ${slotIdx + 1}`}
                        className={ACTION}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => o.addWindow(dayIdx)}
                    aria-label={`Add availability slot for ${day}`}
                    className={ACTION}
                  >
                    Add a slot
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </StepShell>

      <ProfileSection
        id="days-off"
        title="Days off"
        description="Optional. Days you are unavailable even within your weekly hours."
      >
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <input
              type="date"
              aria-label="Blackout date"
              className={cn(FIELD_INPUT, "w-auto")}
              value={o.newBlackout}
              onChange={(e) => o.setNewBlackout(e.target.value)}
              onKeyDown={(e) => {
                // Enter adds the date instead of advancing the wizard
                if (e.key === "Enter") {
                  e.preventDefault();
                  o.addBlackout();
                }
              }}
            />
            <Button type="button" variant="secondary" className="min-h-11" onClick={o.addBlackout}>
              Add
            </Button>
          </div>
          {o.blackout.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2" aria-label="Days off">
              {o.blackout.map((d) => (
                <li
                  key={d}
                  className="border-hairline bg-paper-deep text-ink flex min-h-11 items-center gap-1 rounded-md border pl-3 text-sm font-medium tabular-nums"
                >
                  {d}
                  <button
                    type="button"
                    onClick={() => o.setBlackout((b) => b.filter((x) => x !== d))}
                    aria-label={`Remove blackout date ${d}`}
                    className="text-ink-body hover:text-ink focus-visible:ring-ink inline-flex h-11 w-11 items-center justify-center rounded-md focus-visible:outline-none focus-visible:ring-2"
                  >
                    <X size={16} strokeWidth={1.5} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </ProfileSection>
    </>
  );
}
