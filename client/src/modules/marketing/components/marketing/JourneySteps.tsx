import { SECTION_HEADING, SECTION_LEAD, SectionKicker } from "./SectionKicker";

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
    title: "Get it done",
    body: "Find tournaments, book an expert or buy what you need.",
  },
] as const;

/**
 * The four-step "from questions to action" band. A deeper paper tone separates
 * it from the sections around it; the steps are ruled columns led by a serif
 * numeral, with no cards.
 */
export function JourneySteps() {
  return (
    <section className="bg-[#EFE7DA] py-24 sm:py-32 lg:py-40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="reveal-on-scroll max-w-3xl">
          <SectionKicker label="How it works" />
          <h2 className={`${SECTION_HEADING} mb-6`}>From questions to action</h2>
          <p className={SECTION_LEAD}>
            Sports decisions are easier when someone helps you work out the next step.
          </p>
        </div>

        <ol className="reveal-on-scroll mt-16 grid grid-cols-1 gap-x-10 gap-y-12 sm:grid-cols-2 lg:mt-24 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="border-t border-[#1C1B1A]/20 pt-6">
              <span className="font-editorial mb-10 block text-5xl font-light tabular-nums text-[#1C1B1A]">
                {index + 1}
              </span>
              <h3 className="mb-2 text-lg font-semibold text-[#1C1B1A]">{step.title}</h3>
              <p className="max-w-[32ch] text-pretty leading-relaxed text-[#4A4741]">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
