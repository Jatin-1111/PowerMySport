import { ACADEMY_STEPS, resumeStepFor } from "@/modules/onboarding/utils/academySteps";
import { cn } from "@/utils/cn";
import { Check } from "lucide-react";
import type { StatusSteps } from "../types";

type StepState = "done" | "current" | "upcoming";

interface Row {
  title: string;
  state: StepState;
}

const STATE_WORD: Record<StepState, string> = {
  done: "Done",
  current: "Next",
  upcoming: "To do",
};

const setupRows = (savedSteps: number): Row[] => {
  const next = resumeStepFor(savedSteps);
  return ACADEMY_STEPS.map((step) => ({
    title: step.title,
    state: step.number <= savedSteps ? "done" : step.number === next ? "current" : "upcoming",
  }));
};

// What happens after submitting. These are the real stages an academy moves through.
const REVIEW_ROWS: Row[] = [
  { title: "You submit your details", state: "done" },
  { title: "Our team reviews your academy", state: "current" },
  { title: "Your academy goes live in search", state: "upcoming" },
];

/**
 * A ruled list of stages with one marked as the place the owner is. No cards:
 * the hairlines and the numerals do the work. The state is written out for
 * screen readers, so it never depends on the tick or the weight.
 */
export function StepList({
  kind,
  savedSteps,
}: {
  kind: Exclude<StatusSteps, null>;
  savedSteps: number;
}) {
  const rows = kind === "setup" ? setupRows(savedSteps) : REVIEW_ROWS;

  return (
    <ol aria-label={kind === "setup" ? "Setup steps" : "Review stages"}>
      {rows.map((row, index) => (
        <li
          key={row.title}
          aria-current={row.state === "current" ? "step" : undefined}
          className="border-ink/15 flex items-center gap-4 border-t py-3.5 first:border-t-0 first:pt-0"
        >
          <span
            aria-hidden="true"
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center text-sm tabular-nums",
              row.state === "done" ? "text-ink" : "text-ink-muted"
            )}
          >
            {row.state === "done" ? <Check size={18} strokeWidth={1.5} /> : index + 1}
          </span>
          <span
            className={cn(
              "min-w-0 flex-1",
              row.state === "current" && "text-ink font-semibold",
              row.state === "done" && "text-ink-body",
              row.state === "upcoming" && "text-ink-body"
            )}
          >
            {row.title}
            <span className="sr-only">. {STATE_WORD[row.state]}</span>
          </span>
          {row.state === "current" && (
            <span aria-hidden="true" className="text-ink text-sm font-medium">
              {kind === "setup" ? "Next" : "In progress"}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
