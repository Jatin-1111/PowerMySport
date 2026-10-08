import { CheckCircle2, ClipboardList, MessageCircle, Scale } from "lucide-react";
import { SectionLabel } from "./SectionLabel";

const STEPS = [
  {
    icon: ClipboardList,
    title: "Tell us about your child",
    body: "Share their age, sport, level and goals.",
  },
  {
    icon: MessageCircle,
    title: "Ask what to do next",
    body: "Get recommendations based on your child's situation.",
  },
  {
    icon: Scale,
    title: "Decide with confidence",
    body: "Compare options and see what the next stage asks of you.",
  },
  {
    icon: CheckCircle2,
    title: "Get it done",
    body: "Find tournaments, book an expert or buy what you need.",
  },
] as const;

/** The four-step "from questions to action" strip under the hero. */
export function JourneySteps() {
  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="reveal-on-scroll mx-auto max-w-2xl text-center">
          <div className="mb-4 flex justify-center">
            <SectionLabel label="How it works" color="slate" />
          </div>
          <h2 className="font-title mb-4 text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl">
            From questions to action
          </h2>
          <p className="text-lg text-slate-600">
            Sports decisions are easier when someone helps you work out the next step.
          </p>
        </div>

        <ol className="reveal-on-scroll mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="rounded-lg border border-slate-200/60 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
            >
              <div className="mb-4 flex items-center gap-3">
                <span className="bg-power-orange-solid flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm font-bold text-white">
                  {index + 1}
                </span>
                <step.icon className="h-5 w-5 text-slate-500" aria-hidden />
              </div>
              <h3 className="mb-1 font-bold text-slate-900">{step.title}</h3>
              <p className="text-sm leading-relaxed text-slate-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
