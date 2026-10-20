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
    body: "Your decisions and check-ins are kept with your child's journey, so you can pick up where you left off.",
  },
] as const;

/**
 * The five-step "from questions to action" band. A lighter paper tone separates it
 * from the sections around it; the steps are ruled columns led by a serif numeral,
 * with no cards.
 */
export function JourneySteps() {
  return (
    <section className="bg-paper py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="reveal-on-scroll max-w-3xl">
          <SectionKicker label="How it works" />
          <h2 className={SECTION_HEADING}>From questions to action</h2>
        </div>

        <ol className="reveal-on-scroll mt-12 grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:mt-16 lg:grid-cols-3 xl:grid-cols-5">
          {STEPS.map((step, index) => (
            <li key={step.title} className="border-ink/20 border-t pt-6">
              <span className="font-editorial text-ink mb-10 block text-5xl font-light tabular-nums">
                {index + 1}
              </span>
              <h3 className="text-ink mb-2 text-lg font-semibold">{step.title}</h3>
              <p className="text-ink-body max-w-[32ch] text-pretty leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
