import { ArrowRight } from "lucide-react";
import Link from "next/link";

import type { TournamentEdition } from "@/modules/pathway/services/pathway";
import { SectionLabel } from "@/modules/marketing/components/marketing/SectionLabel";
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
    <section className="py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="reveal-on-scroll">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div className="max-w-2xl">
              <div className="mb-4">
                <SectionLabel label="Tournaments" color="orange" />
              </div>
              <h2 className="font-title mb-4 text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl">
                What&apos;s coming up
              </h2>
              <p className="text-base leading-relaxed text-slate-600 sm:text-lg">
                The next {sportLabel.toLowerCase()} tournaments on the federation&apos;s own
                calendar. Open one for its dates, venue and entry details.
              </p>
            </div>
            <Link
              href={`/tournaments/sport/${sportSlug}`}
              className="text-power-orange-solid inline-flex items-center gap-1.5 text-sm font-bold hover:text-orange-800"
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
