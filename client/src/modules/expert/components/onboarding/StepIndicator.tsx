import { cn } from "@/utils/cn";
import { Check } from "lucide-react";
import { STEPS } from "./steps";

/**
 * The five steps as a row of text tabs: the current one is underlined, finished
 * ones carry a tick and can be clicked to go back, later ones are quiet and
 * cannot be reached yet. Colour is never the only signal.
 */
export function StepIndicator({ step, onGoTo }: { step: number; onGoTo: (step: number) => void }) {
  return (
    <nav aria-label="Onboarding steps" className="border-hairline border-b">
      <ol className="hide-scrollbar -mb-px flex gap-x-7 overflow-x-auto">
        {STEPS.map((s) => {
          const done = step > s.id;
          const current = step === s.id;
          return (
            <li key={s.id} className="shrink-0">
              <button
                type="button"
                onClick={() => done && onGoTo(s.id)}
                disabled={s.id >= step}
                aria-current={current ? "step" : undefined}
                aria-label={`Step ${s.id}: ${s.title}${
                  done ? " (completed, go back to this step)" : current ? " (current)" : ""
                }`}
                className={cn(
                  "focus-visible:ring-ink flex min-h-11 items-center gap-2 whitespace-nowrap border-b-2 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2",
                  current
                    ? "border-ink text-ink font-semibold"
                    : done
                      ? "text-ink hover:border-ink/40 border-transparent"
                      : "text-ink-ash border-transparent"
                )}
              >
                <span aria-hidden="true" className="tabular-nums">
                  {done ? <Check size={16} strokeWidth={1.5} /> : s.id}
                </span>
                <span aria-hidden="true">{s.title}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
