import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";

import type { TournamentEdition } from "@/modules/pathway/services/pathway";
import { HomeEyebrow } from "@/modules/marketing/components/marketing/HomeEyebrow";
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
    <section className="bg-slate-50 py-24 sm:py-32 lg:py-40">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="reveal-on-scroll">
          <div className="mb-14 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div className="max-w-2xl">
              <HomeEyebrow label="Tournaments" tone="yellow" className="mb-6" />
              <h2 className="font-title mb-6 text-balance text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-slate-900 sm:text-5xl">
                What&apos;s coming up
              </h2>
              <p className="text-base leading-relaxed text-slate-600 sm:text-lg">
                The next {sportLabel.toLowerCase()} tournaments on the federation&apos;s own
                calendar. Open one for its dates, venue and entry details.
              </p>
            </div>
            <Link
              href={`/tournaments/sport/${sportSlug}`}
              className="text-power-orange-solid inline-flex items-center gap-2 text-sm font-medium hover:text-orange-800"
            >
              See all {sportLabel.toLowerCase()} tournaments
              <ArrowUpRight weight="light" aria-hidden className="h-4 w-4" />
            </Link>
          </div>

          <FlipBoard editions={editions} title={`Next up in ${sportLabel.toLowerCase()}`} />
        </div>
      </div>
    </section>
  );
}
