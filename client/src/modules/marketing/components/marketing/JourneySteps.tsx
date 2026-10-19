import { SECTION_HEADING, SectionKicker } from "./SectionKicker";

const STEPS = [
  {
    title: "Tell us about your child",
    body: "Share their age, sport, level and goals.",
  },
  {
    title: "Ask what to do next",
    body: "Get recommendations based on your child's situation.",
  },
  {
    title: "Decide with confidence",
    body: "Compare options and see what the next stage asks of you.",
  },
  {
    title: "Take the next step",
    body: "Find a tournament, book an expert or shop for kit.",
  },
] as const;

/**
 * The four-step "from questions to action" band. A deeper paper tone separates
 * it from the sections around it; the steps are ruled columns led by a serif
 * numeral, with no cards.
 */
export function JourneySteps() {
  return (
    <section className="bg-paper py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="reveal-on-scroll max-w-3xl">
          <SectionKicker label="How it works" />
          <h2 className={SECTION_HEADING}>From questions to action</h2>
        </div>

        <ol className="reveal-on-scroll mt-12 grid grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2 lg:mt-16 lg:grid-cols-4">
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
