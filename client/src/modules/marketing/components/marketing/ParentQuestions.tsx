import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { ArrowRight } from "lucide-react";
import { SectionLabel } from "./SectionLabel";

/**
 * Real questions parents ask. Each opens WhatsApp with the question already
 * typed, so the section is a way into the same primary channel as the hero.
 */
const QUESTIONS = [
  "Which sport is right for my 8-year-old?",
  "Which tournaments should my son play?",
  "How can my daughter pursue a US college scholarship?",
  "What does his ranking mean and how can we improve it?",
  "Is my child ready to start competing?",
  "What should we focus on at this stage?",
] as const;

export function ParentQuestions() {
  return (
    <section className="py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="reveal-on-scroll mx-auto max-w-2xl text-center">
          <div className="mb-4 flex justify-center">
            <SectionLabel label="Ask PowerMySport" color="green" />
          </div>
          <h2 className="font-title mb-4 text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl">
            Ask anything about your child&apos;s sporting journey
          </h2>
          <p className="text-lg text-slate-600">
            Tap a question to ask it on WhatsApp, or write your own.
          </p>
        </div>

        <ul className="reveal-on-scroll mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUESTIONS.map((question) => (
            <li key={question}>
              <a
                href={buildWhatsAppUrl(question)}
                target="_blank"
                rel="noopener noreferrer"
                className="focus-visible:ring-power-orange-solid group flex h-full items-center justify-between gap-3 rounded-lg border border-slate-200/60 bg-white p-5 text-left text-sm font-medium leading-snug text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-green-700/40 hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2"
              >
                {question}
                <ArrowRight
                  aria-hidden
                  className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none"
                />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
