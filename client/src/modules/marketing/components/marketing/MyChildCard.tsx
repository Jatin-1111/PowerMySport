import { cn } from "@/utils/cn";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { EXAMPLE_CHILD, MY_CHILD_CONTROL_LINE, MY_CHILD_ROWS } from "../../data/myChildExample";
import { SECTION_HEADING, SECTION_LEAD, SectionKicker } from "./SectionKicker";

/**
 * The homepage "My Child" section, from the 20 Oct review: a visual showing how PMS
 * builds an ongoing understanding of a child's sporting journey. One example child as
 * a card, five labelled rows ruled by hairlines. The child is invented and labelled
 * "Example". The words describe only what is kept today; they do not promise that
 * every question starts from this picture, because the assistant does not read it yet.
 */

/** A square "Example" label. Not a pill, and not styled as a status. */
function ExampleLabel() {
  return (
    <span className="border-ink/25 text-ink-muted inline-block rounded-sm border px-1.5 py-0.5 text-xs font-medium">
      Example
    </span>
  );
}

export function MyChildCard() {
  return (
    <section className="bg-paper-deep py-16 sm:py-24 lg:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)] lg:gap-20">
          <div className="reveal-on-scroll">
            <SectionKicker label="My Child" />
            <h2 className={`${SECTION_HEADING} mb-6`}>
              A picture of your child that builds over time
            </h2>
            <p className={SECTION_LEAD}>
              Their profile, goals, progress, decisions and what is still open, kept together in one
              place.
            </p>

            <div className="mt-8 flex flex-col items-start gap-4">
              <p className="text-ink-muted max-w-[44ch] text-sm leading-relaxed">
                {MY_CHILD_CONTROL_LINE}
              </p>
              <Link
                href="/assessment/discover"
                className="text-ink decoration-ink/30 hover:decoration-ink focus-visible:ring-ink focus-visible:ring-offset-paper-deep group inline-flex items-center gap-1.5 rounded text-base font-medium underline underline-offset-[6px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                Start with your child
                <ArrowRight
                  aria-hidden
                  strokeWidth={1.5}
                  className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                />
              </Link>
            </div>
          </div>

          <div className="reveal-on-scroll border-hairline w-full overflow-hidden rounded-2xl border bg-white">
            <div className="border-hairline flex items-center gap-3 border-b px-5 py-4 sm:px-6">
              {/* An initial in a small square: a person, without a stock photo of a child. */}
              <span
                aria-hidden
                className="bg-paper-deep text-ink font-editorial flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-2xl font-light"
              >
                {EXAMPLE_CHILD.initial}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-ink font-semibold">{EXAMPLE_CHILD.name}</p>
                <p className="text-ink-muted text-sm">{EXAMPLE_CHILD.summary}</p>
              </div>
              <ExampleLabel />
            </div>
            <dl>
              {MY_CHILD_ROWS.map((row) => (
                <div
                  key={row.key}
                  className={cn(
                    "border-hairline grid gap-1 border-b px-5 py-4 last:border-b-0 sm:grid-cols-[7.5rem_1fr] sm:gap-4 sm:px-6",
                    // A real left border, rounded to match the card's inner corner (16px
                    // radius less its 1px border), so it bends round the corner. The
                    // padding is 2px short to make room, which keeps the text aligned.
                    row.key === "open" &&
                      "border-l-power-orange-solid rounded-bl-[15px] border-l-2 pl-[18px] sm:pl-[22px]"
                  )}
                >
                  <dt className="text-ink-muted text-sm font-medium">{row.label}</dt>
                  <dd className="text-ink text-pretty tabular-nums leading-snug">{row.summary}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
