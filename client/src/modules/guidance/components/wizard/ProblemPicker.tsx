import type { ProblemId } from "@/modules/guidance/config/wizard/guidanceUtils";
import {
  PROBLEM_TYPES,
  WIZARD_STEPS,
  estimateMinutes,
} from "@/modules/guidance/config/wizard/wizardConfig";
import { ArrowRight } from "lucide-react";

/**
 * The first screen of the guidance flow: pick the challenge. Problems are a
 * hairline-ruled list in one ink-on-paper style; the per-problem colours the
 * config still carries are deliberately not used here.
 */
export function ProblemPicker({ onSelect }: { onSelect: (id: ProblemId) => void }) {
  return (
    <div className="bg-paper min-h-screen px-4 pb-24 pt-16 sm:pt-24">
      <div className="mx-auto w-full max-w-4xl">
        <header className="max-w-2xl">
          <p className="text-ink-muted text-sm">Expert help</p>
          <h1 className="font-editorial text-ink mt-3 text-balance text-4xl font-light leading-tight tracking-tight sm:text-6xl">
            What do you need <span className="italic">help with?</span>
          </h1>
          <p className="text-ink-body mt-5 max-w-xl text-pretty text-lg leading-relaxed">
            Pick the challenge you&apos;re facing. We&apos;ll ask a few targeted questions and
            return an actionable plan.
          </p>
        </header>

        <ul className="divide-hairline border-hairline mt-14 grid divide-y border-y sm:grid-cols-2 sm:divide-y-0">
          {PROBLEM_TYPES.map((pt, i) => (
            <li
              key={pt.id}
              className={
                "border-hairline " +
                (i >= 2 ? "sm:border-t" : "") +
                (i % 2 === 1 ? "sm:border-l" : "")
              }
            >
              <button
                type="button"
                onClick={() => onSelect(pt.id)}
                className="hover:bg-paper-deep/60 focus-visible:ring-ink group flex h-full w-full flex-col px-1 py-7 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 sm:px-7"
              >
                <p className="text-ink-muted text-sm">{pt.tagline}</p>
                <h2 className="font-editorial text-ink mt-1.5 text-2xl font-light tracking-tight">
                  {pt.label}
                </h2>
                <p className="text-ink-body mt-2 flex-1 text-pretty text-sm leading-relaxed">
                  {pt.description}
                </p>
                <div className="mt-5 flex items-center justify-between gap-4">
                  <span className="text-ink-muted text-sm tabular-nums">
                    {estimateMinutes(WIZARD_STEPS[pt.id])}
                  </span>
                  <span className="text-ink inline-flex items-center gap-1.5 text-sm font-medium group-hover:underline group-hover:underline-offset-4">
                    Get started
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>

        <p className="text-ink-muted mt-6 text-sm">Free to use. AI-powered. No commitment.</p>
      </div>
    </div>
  );
}
