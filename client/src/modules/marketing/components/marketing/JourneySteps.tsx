import { cn } from "@/utils/cn";
import { SECTION_HEADING, SectionKicker } from "./SectionKicker";

/**
 * The five steps from the 20 Oct review: PMS must gather context before it
 * recommends, so asking about the child comes before the recommendation, and what
 * the parent decides is kept so the journey carries on.
 *
 * The titles and the first four steps follow the review. The last step says
 * "remembers" where the review says "learns", and does not promise that outcomes
 * change future recommendations: outcomes are kept (decisions, check-ins) but
 * nothing reads them back yet. Change it when that is built.
 */
const STEPS = [
  {
    title: "Choose a question",
    body: "Pick a suggested question, or describe what you want for your child.",
  },
  {
    title: "PMS understands",
    body: "We ask about your child, your goals, their current level and anything that limits you.",
  },
  {
    title: "PMS recommends",
    body: "Your child's situation is combined with what we know about the sport, and the next step is explained.",
  },
  {
    title: "PMS helps execute",
    body: "Find the options, connect with experts, plan the season, book or complete the step.",
  },
  {
    title: "PMS remembers",
    body: (
      <>
        Your decisions and <span className="whitespace-nowrap">check-ins</span> are kept with your
        child&apos;s journey, so you can pick up where you left off.
      </>
    ),
  },
] as const;

/** How far each step sits below the one before it, from the `xl` breakpoint up. */
const STAIR = ["", "xl:mt-8", "xl:mt-16", "xl:mt-24", "xl:mt-32"] as const;

/**
 * The five-step "from questions to action" band, drawn as a staircase on wide
 * screens: each step starts a little lower than the last, and one hairline runs
 * along every step and down every riser, so the five read as a single path rather
 * than five equal boxes. Below `xl` it falls back to ruled columns, then one column.
 * Server-rendered, no client code; the reveal is the CSS scroll-driven one.
 */
export function JourneySteps() {
  return (
    <section className="bg-paper py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="reveal-on-scroll max-w-3xl">
          <SectionKicker label="How it works" />
          <h2 className={SECTION_HEADING}>From questions to action</h2>
        </div>

        <ol className="mt-12 grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3 xl:grid-cols-5 xl:gap-x-0 xl:gap-y-0">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className={cn(
                "reveal-on-scroll border-ink/25 relative border-t pt-8 xl:pr-8",
                // The marker where the step begins, sitting on its rule.
                "before:bg-ink before:absolute before:-top-[5px] before:left-0 before:h-[9px] before:w-[9px] before:rounded-[2px] before:content-['']",
                // The riser: from the end of this step's rule down to where the next one starts.
                index < STEPS.length - 1 &&
                  "xl:after:bg-ink/25 xl:after:absolute xl:after:-top-px xl:after:right-0 xl:after:h-8 xl:after:w-px xl:after:content-['']",
                STAIR[index]
              )}
            >
              <span className="font-editorial text-ink mb-8 block text-6xl font-light tabular-nums leading-none">
                {index + 1}
              </span>
              <h3 className="text-ink mb-2 text-lg font-semibold">{step.title}</h3>
              <p className="text-ink-body max-w-[30ch] text-pretty leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>

        {/* Room under the lowest step on wide screens, where the staircase ends. */}
        <div aria-hidden className="hidden xl:block xl:h-4" />
      </div>
    </section>
  );
}
