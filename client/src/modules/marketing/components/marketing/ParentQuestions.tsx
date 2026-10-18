import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { ArrowUpRight } from "lucide-react";
import { SECTION_HEADING, SECTION_LEAD, SectionKicker } from "./SectionKicker";

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
    <section className="bg-[#F8F3EA] py-24 sm:py-32 lg:py-40">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[5fr_7fr] lg:gap-24 lg:px-8">
        <div className="reveal-on-scroll lg:sticky lg:top-28 lg:self-start">
          <SectionKicker label="Ask PowerMySport" />
          <h2 className={`${SECTION_HEADING} mb-6`}>
            Ask anything about your child&apos;s sporting journey
          </h2>
          <p className={SECTION_LEAD}>Tap a question to ask it on WhatsApp, or write your own.</p>
        </div>

        <ul className="reveal-on-scroll border-t border-[#E1DCD3]">
          {QUESTIONS.map((question) => (
            <li key={question} className="border-b border-[#E1DCD3]">
              <a
                href={buildWhatsAppUrl(question)}
                target="_blank"
                rel="noopener noreferrer"
                className="group -mx-3 flex items-center justify-between gap-6 rounded-lg px-3 py-6 text-left text-lg leading-snug text-[#1C1B1A] transition-colors duration-200 hover:bg-[#EFE7DA]/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1C1B1A] sm:text-xl"
              >
                {question}
                <ArrowUpRight
                  aria-hidden
                  strokeWidth={1.5}
                  className="h-5 w-5 shrink-0 text-[#7A766E] transition-[transform,color] duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#1C1B1A] motion-reduce:transition-none"
                />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
