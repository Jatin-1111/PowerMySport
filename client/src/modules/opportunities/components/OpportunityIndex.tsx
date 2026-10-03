import { SPORT_LABEL } from "@/modules/pathway/config/tournamentDisplay";
import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/modules/shared/ui/PageHeader";

import { TRACKS } from "../config/tracks";
import { fetchOpportunities, type OpportunityTrack } from "../services/opportunities";
import { OpportunityCard } from "./OpportunityCard";

// ─── /admissions and /scholarships ──────────────────────────────────────────
//
// One component for both: they are the same list of the same kind of record,
// grouped into the track's sections. A sport filter appears only when entries
// name more than one sport, since offering a choice of one is not a choice.

export async function OpportunityIndex({
  track,
  sport,
}: {
  track: OpportunityTrack;
  sport?: string | undefined;
}) {
  const config = TRACKS[track];
  const data = await fetchOpportunities(track, sport);
  const items = data?.items ?? [];
  const sports = data?.sports ?? [];
  const selectedSport = sport && sports.includes(sport) ? sport : undefined;

  const sections = (data?.categories ?? Object.keys(config.categories))
    .map((category) => ({
      category,
      meta: config.categories[category],
      items: items.filter((item) => item.category === category),
    }))
    .filter((section) => section.meta && section.items.length > 0);

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        breadcrumbs={[{ label: config.title }]}
        title={config.heading}
        description={config.intro}
      />

      <div className="mx-auto max-w-6xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
        <p className="flex items-start gap-2 rounded-lg border border-slate-200 bg-white p-4 text-[13.5px] leading-relaxed text-slate-600">
          <ShieldCheck aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <span>
            Every entry links the official source it was checked against and the date we last
            checked it. These rules change every year, so confirm on the source before you apply.
          </span>
        </p>

        {sports.length > 1 && (
          <nav aria-label="Filter by sport" className="flex flex-wrap gap-2">
            {[undefined, ...sports].map((slug) => {
              const selected = slug === selectedSport;
              return (
                <Link
                  key={slug ?? "all"}
                  href={slug ? `${config.path}?sport=${slug}` : config.path}
                  aria-current={selected ? "true" : undefined}
                  className={`inline-flex min-h-9 items-center rounded-lg border px-3 text-[13px] font-semibold transition ${
                    selected
                      ? "bg-power-orange-solid border-power-orange-solid text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:text-orange-700"
                  }`}
                >
                  {slug ? (SPORT_LABEL[slug] ?? slug) : "All sports"}
                </Link>
              );
            })}
          </nav>
        )}

        {sections.length > 0 ? (
          sections.map((section) => (
            <section key={section.category} aria-labelledby={`section-${section.category}`}>
              <h2
                id={`section-${section.category}`}
                className="font-title text-xl font-extrabold text-slate-900"
              >
                {section.meta!.label}
              </h2>
              <p className="mt-1 text-sm text-slate-500">{section.meta!.blurb}</p>
              <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {section.items.map((item) => (
                  <li key={item.slug}>
                    <OpportunityCard opportunity={item} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
            <p className="text-sm font-semibold text-slate-700">
              We are checking these against their official sources.
            </p>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              Each one goes up once someone has verified it, so nothing here sends you after a
              deadline that has moved.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
