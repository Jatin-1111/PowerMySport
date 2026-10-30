"use client";

import { roadmapHref } from "@/modules/pathway/data/sports";
import type { Dependent } from "@/types";
import Link from "next/link";

interface DependentSportFitProps {
  name: string;
  matches: NonNullable<Dependent["sportMatches"]>;
  /** The sport they play now, marked in the list. */
  currentSport?: string;
  assessedOn: string | null;
  discoverHref: string;
}

const linkClass =
  "text-ink decoration-ink/30 hover:decoration-ink focus-visible:ring-ink underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2";

/**
 * The assessment's sports in order, best fit first, with the strongest one set larger so the
 * answer to "which sport suits them" is the first thing read. Each sport links to its roadmap.
 */
export function DependentSportFit({
  name,
  matches,
  currentSport,
  assessedOn,
  discoverHref,
}: DependentSportFitProps) {
  const [best, ...rest] = matches;

  return (
    <section
      aria-labelledby="sport-fit-heading"
      id="sport-fit"
      className="border-hairline scroll-mt-24 border-t pt-10"
    >
      <h2
        id="sport-fit-heading"
        className="font-editorial text-ink text-2xl font-light tracking-tight sm:text-3xl"
      >
        Sports that suit {name}
      </h2>
      <p className="text-ink-body mt-2 max-w-[56ch] text-pretty">
        Best fit first, from the assessment{assessedOn ? ` taken on ${assessedOn}` : ""}. Open a
        sport to see the path ahead of it.
      </p>

      <div className="border-hairline mt-6 border-t py-6">
        <p className="text-ink-body text-sm">Best fit</p>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <Link
            href={roadmapHref(best.sport)}
            className="font-editorial text-ink focus-visible:ring-ink text-4xl font-light underline decoration-transparent underline-offset-4 hover:decoration-current focus-visible:outline-none focus-visible:ring-2"
          >
            {best.sport}
          </Link>
          <span className="text-ink-body">{best.fitLabel}</span>
          {best.sport === currentSport && (
            <span className="text-ink text-sm font-medium">Currently playing</span>
          )}
        </p>
      </div>

      {rest.length > 0 && (
        <ol start={2} className="divide-hairline border-hairline divide-y border-y">
          {rest.map((match, index) => (
            <li key={match.sport} className="flex items-baseline gap-4 py-4">
              <span className="text-ink-body w-5 text-sm tabular-nums">{index + 2}</span>
              <Link href={roadmapHref(match.sport)} className={`${linkClass} flex-1 font-medium`}>
                {match.sport}
              </Link>
              {match.sport === currentSport && (
                <span className="text-ink text-sm font-medium">Currently playing</span>
              )}
              <span className="text-ink-body text-sm">{match.fitLabel}</span>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-4 text-sm">
        <Link href={discoverHref} className={linkClass}>
          Retake the assessment
        </Link>
      </p>
    </section>
  );
}
