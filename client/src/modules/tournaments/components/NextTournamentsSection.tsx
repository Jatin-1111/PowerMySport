import { ArrowRight } from "lucide-react";
import Link from "next/link";

import type { TournamentEdition } from "@/modules/pathway/services/pathway";
import {
  SECTION_HEADING,
  SECTION_LEAD,
  SectionKicker,
} from "@/modules/marketing/components/marketing/SectionKicker";
import { FlipBoard } from "./FlipBoard";

/**
 * The homepage's window onto the tournament calendar: the next few real
 * tournaments on a departures board, each row a link to its fact sheet.
 *
 * The editions come from the same list /tournaments reads, so the board cannot
 * show something the calendar does not. With none upcoming it renders nothing;
 * an empty board would be a dead end on the front page.
 */
export function NextTournamentsSection({
  editions,
  sportLabel,
  sportSlug,
}: {
  editions: TournamentEdition[];
  sportLabel: string;
  sportSlug: string;
}) {
  if (editions.length === 0) return null;

  return (
    <section className="bg-paper py-24 sm:py-32 lg:py-40">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="reveal-on-scroll">
          <div className="mb-12 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div className="max-w-2xl">
              <SectionKicker label="Tournaments" />
              <h2 className={`${SECTION_HEADING} mb-6`}>What&apos;s coming up</h2>
              <p className={SECTION_LEAD}>
                The next {sportLabel.toLowerCase()} tournaments on the federation&apos;s own
                calendar. Open one for its dates, venue and entry details.
              </p>
            </div>
            <Link
              href={`/tournaments/sport/${sportSlug}`}
              className="text-ink decoration-ink/30 hover:decoration-ink inline-flex items-center gap-1.5 text-base font-medium underline underline-offset-[6px] transition-colors"
            >
              See all {sportLabel.toLowerCase()} tournaments
              <ArrowRight aria-hidden className="h-4 w-4" />
            </Link>
          </div>

          <FlipBoard editions={editions} title={`Next up in ${sportLabel.toLowerCase()}`} />
        </div>
      </div>
    </section>
  );
}
