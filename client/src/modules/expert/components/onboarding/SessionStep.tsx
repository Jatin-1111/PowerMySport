import {
  FIELD_HINT,
  FIELD_INPUT,
  FIELD_LABEL,
} from "@/modules/shared/components/settings/ProfileSection";
import { cn } from "@/utils/cn";
import { useRef } from "react";
import { SESSION_MODES } from "./steps";
import { StepShell } from "./StepShell";
import type { ExpertOnboardingState } from "./useExpertOnboarding";

const MODE_LABEL = { ONLINE: "Online", IN_PERSON: "In person", BOTH: "Both" } as const;

export function SessionStep({ o }: { o: ExpertOnboardingState }) {
  const modeRefs = useRef<(HTMLButtonElement | null)[]>([]);

  return (
    <StepShell
      title="Session setup"
      description="Your fee, the format and the length of a session."
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <label htmlFor="expert-session-fee" className={FIELD_LABEL}>
            Session fee (₹)
          </label>
          <input
            id="expert-session-fee"
            type="number"
            min={0}
            inputMode="numeric"
            className={cn(FIELD_INPUT, "tabular-nums")}
            value={o.sessionFee}
            onChange={(e) => o.setSessionFee(e.target.value)}
          />
          <p className={FIELD_HINT}>For example, 1500.</p>
        </div>
        <div>
          <label htmlFor="expert-session-length" className={FIELD_LABEL}>
            Session length
          </label>
          <select
            id="expert-session-length"
            className={FIELD_INPUT}
            value={o.sessionDurationMinutes}
            onChange={(e) => o.setSessionDurationMinutes(e.target.value)}
          >
            {[30, 45, 60, 75, 90, 120].map((m) => (
              <option key={m} value={m}>
                {m} minutes
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <span id="session-mode-label" className={FIELD_LABEL}>
          How you hold sessions
        </span>
        {/* Native-radio keyboard behaviour: one tab stop, arrows move and select. */}
        <div
          role="radiogroup"
          aria-labelledby="session-mode-label"
          className="flex flex-wrap gap-2"
        >
          {SESSION_MODES.map((mode, idx) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={o.sessionMode === mode}
              tabIndex={o.sessionMode === mode ? 0 : -1}
              ref={(el) => {
                modeRefs.current[idx] = el;
              }}
              onClick={() => o.setSessionMode(mode)}
              onKeyDown={(e) => {
                let next = -1;
                if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                  next = (idx + 1) % SESSION_MODES.length;
                } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                  next = (idx - 1 + SESSION_MODES.length) % SESSION_MODES.length;
                }
                if (next >= 0) {
                  e.preventDefault();
                  o.setSessionMode(SESSION_MODES[next]);
                  modeRefs.current[next]?.focus();
                }
              }}
              className={cn(
                "focus-visible:ring-ink min-h-11 min-w-28 rounded-md border px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                o.sessionMode === mode
                  ? "border-ink text-ink bg-white font-semibold"
                  : "border-ink/25 text-ink-body hover:border-ink"
              )}
            >
              {MODE_LABEL[mode]}
            </button>
          ))}
        </div>
      </div>

      {(o.sessionMode === "IN_PERSON" || o.sessionMode === "BOTH") && (
        <div>
          <label htmlFor="expert-address" className={FIELD_LABEL}>
            In-person location
          </label>
          <input
            id="expert-address"
            autoComplete="street-address"
            className={FIELD_INPUT}
            value={o.inPersonAddress}
            onChange={(e) => o.setInPersonAddress(e.target.value)}
          />
          <p className={FIELD_HINT}>
            For example, 2nd Floor, ABC Sports Complex, Sector 15, Chandigarh. Only shared with
            parents who have an active booking, never shown on the public listing.
          </p>
        </div>
      )}
    </StepShell>
  );
}
