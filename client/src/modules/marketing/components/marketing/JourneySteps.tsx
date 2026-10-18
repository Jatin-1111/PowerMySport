import { Bezel } from "./Bezel";
import { HomeEyebrow } from "./HomeEyebrow";

// Asymmetric 7/5 then 5/7 rhythm on `lg`; a single column below it.
const STEPS = [
  {
    title: "Tell us about your child",
    body: "Share their age, sport, level and goals.",
    span: "lg:col-span-7",
  },
  {
    title: "Ask what to do next",
    body: "Get recommendations based on your child's situation.",
    span: "lg:col-span-5",
  },
  {
    title: "Decide with confidence",
    body: "Compare options and see what the next stage asks of you.",
    span: "lg:col-span-5",
  },
  {
    title: "Get it done",
    body: "Find tournaments, book an expert or buy what you need.",
    span: "lg:col-span-7",
  },
] as const;

/** The four-step "from questions to action" bento under the questions. */
export function JourneySteps() {
  return (
    <section className="bg-white py-24 sm:py-32 lg:py-40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="reveal-on-scroll max-w-3xl">
          <HomeEyebrow label="How it works" className="mb-6" />
          <h2 className="font-title mb-6 text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-slate-900 sm:text-5xl lg:text-6xl">
            From questions to action
          </h2>
          <p className="max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
            Sports decisions are easier when someone helps you work out the next step.
          </p>
        </div>

        <ol className="reveal-on-scroll mt-20 grid grid-cols-1 gap-6 lg:grid-cols-12">
          {STEPS.map((step, index) => (
            <li key={step.title} className={step.span}>
              <Bezel
                className="h-full"
                innerClassName="flex min-h-[260px] flex-col justify-between bg-slate-50 p-8 sm:p-10"
              >
                <span className="text-power-orange-solid font-mono text-sm tracking-widest">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="font-title mb-3 text-2xl font-semibold tracking-[-0.02em] text-slate-900 sm:text-3xl">
                    {step.title}
                  </h3>
                  <p className="max-w-sm text-base leading-relaxed text-slate-600">{step.body}</p>
                </div>
              </Bezel>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
