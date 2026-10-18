import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { Bezel } from "./Bezel";
import { HomeEyebrow } from "./HomeEyebrow";

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
    <section className="bg-slate-50 py-24 sm:py-32 lg:py-40">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[5fr_7fr] lg:gap-24 lg:px-8">
        <div className="reveal-on-scroll lg:sticky lg:top-32 lg:self-start">
          <HomeEyebrow label="Ask PowerMySport" tone="green" className="mb-6" />
          <h2 className="font-title mb-6 text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-slate-900 sm:text-5xl">
            Ask anything about your child&apos;s sporting journey
          </h2>
          <p className="max-w-md text-base leading-relaxed text-slate-600 sm:text-lg">
            Tap a question to ask it on WhatsApp, or write your own.
          </p>
        </div>

        <Bezel className="reveal-on-scroll" innerClassName="p-2 sm:p-3">
          <ul>
            {QUESTIONS.map((question) => (
              <li
                key={question}
                className="[&:not(:last-child)]:border-b [&:not(:last-child)]:border-slate-900/[0.06]"
              >
                <a
                  href={buildWhatsAppUrl(question)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-visible:ring-power-orange-solid group flex items-center justify-between gap-6 rounded-[1.25rem] px-4 py-5 text-left text-base leading-snug text-slate-900 transition-colors duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 sm:px-5 sm:text-lg"
                >
                  {question}
                  <span
                    aria-hidden
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900/[0.04] transition-[transform,background-color] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105 group-hover:bg-orange-50"
                  >
                    <ArrowUpRight
                      weight="light"
                      className="group-hover:text-power-orange-solid h-4 w-4 text-slate-600 transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:-translate-y-px group-hover:translate-x-0.5 motion-reduce:transition-none"
                    />
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </Bezel>
      </div>
    </section>
  );
}
