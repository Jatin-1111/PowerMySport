import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Trophy } from "lucide-react";
import { EditionCard } from "@/modules/tournaments/components/EditionCard";
import { FEATURED_TOURNAMENT_SPORT } from "@/modules/tournaments/config/featured";
import {
  fetchSportEditions,
  fetchSportFacets,
} from "@/modules/tournaments/services/editionListing";
import { tournamentListHref } from "@/modules/tournaments/utils/listHref";
import { SPORT_LABEL } from "../federations/[slug]/federationShared";

/**
 * The front door to every tournament calendar we hold. It leads with one
 * sport (FEATURED_TOURNAMENT_SPORT) because that is where the data is deepest,
 * and lists the other sports only once they actually have tournaments: a card
 * for a sport with an empty calendar is a dead end.
 */

const FEATURED_COUNT = 6;

export const metadata: Metadata = {
  title: "Sports Tournaments in India: Upcoming Dates by Sport",
  description:
    "Upcoming junior and open tournaments across India, by sport: dates, venues, age groups and entry fact sheets, read from each federation's own calendar.",
  alternates: { canonical: "/tournaments" },
  openGraph: {
    title: "Sports Tournaments in India: Upcoming Dates by Sport",
    description:
      "Upcoming tournaments across India, by sport, read from each federation's own calendar.",
    url: "/tournaments",
    type: "website",
    siteName: "PowerMySport",
  },
};

export default async function TournamentsPage() {
  const featured = FEATURED_TOURNAMENT_SPORT;
  const featuredLabel = SPORT_LABEL[featured] ?? featured;

  const [sportFacets, featuredList] = await Promise.all([
    fetchSportFacets(),
    fetchSportEditions(featured, { page: 1, limit: FEATURED_COUNT, upcoming: true }),
  ]);

  const featuredEditions = featuredList?.editions ?? [];
  const featuredTotal = featuredList?.total ?? 0;
  const categories = featuredList?.facets?.categories ?? [];
  const featuredState = { upcoming: true, page: 1 };

  const otherSports = sportFacets
    .filter((f) => f.sportSlug !== featured && f.upcoming > 0 && SPORT_LABEL[f.sportSlug])
    .sort((a, b) => b.upcoming - a.upcoming);

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Tournaments", path: "/tournaments" },
          ]),
        ]}
      />

      <div className="min-h-screen bg-slate-50">
        <div className="from-power-orange bg-gradient-to-br to-orange-600 px-4 pb-10 pt-14 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <h1 className="font-title text-2xl font-extrabold text-white sm:text-3xl">
              Tournaments
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-orange-50">
              Upcoming tournaments across India, read from each federation&apos;s own calendar.
              Narrow them to your child&apos;s age group, the type of event and the month.
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-6xl space-y-12 px-4 py-8 sm:px-6">
          <section aria-labelledby="featured-heading">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2
                  id="featured-heading"
                  className="font-title text-xl font-extrabold text-slate-900"
                >
                  Coming up in {featuredLabel.toLowerCase()}
                </h2>
                {featuredTotal > 0 && (
                  <p className="mt-1 text-sm text-slate-500">
                    {featuredTotal} upcoming tournament{featuredTotal === 1 ? "" : "s"}
                  </p>
                )}
              </div>
              {featuredTotal > 0 && (
                <Link
                  href={`/tournaments/sport/${featured}`}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-orange-700 hover:text-orange-800"
                >
                  See all {featuredLabel.toLowerCase()} tournaments
                  <ArrowRight aria-hidden className="h-4 w-4" />
                </Link>
              )}
            </div>

            {categories.length > 1 && (
              <div className="mb-5">
                <p className="mb-2 text-[12px] font-bold uppercase tracking-wider text-slate-500">
                  Browse by type of event
                </p>
                <ul className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <li key={category.value}>
                      <Link
                        href={tournamentListHref(featured, featuredState, {
                          category: category.value,
                        })}
                        className="hover:border-power-orange/50 inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 transition hover:text-orange-700"
                      >
                        {category.label}
                        <span className="text-slate-400">{category.count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {featuredEditions.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {featuredEditions.map((edition) => (
                  <EditionCard key={edition.slug} edition={edition} />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-slate-300 py-14 text-center">
                <Trophy aria-hidden className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                <p className="text-sm font-semibold text-slate-600">
                  No upcoming {featuredLabel.toLowerCase()} tournaments are listed right now.
                </p>
              </div>
            )}
          </section>

          {otherSports.length > 0 && (
            <section aria-labelledby="other-sports-heading">
              <h2
                id="other-sports-heading"
                className="font-title mb-4 text-xl font-extrabold text-slate-900"
              >
                Other sports
              </h2>
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {otherSports.map((sport) => (
                  <li key={sport.sportSlug}>
                    <Link
                      href={`/tournaments/sport/${sport.sportSlug}`}
                      className="hover:border-power-orange/40 group flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                    >
                      <span>
                        <span className="font-title block text-[15px] font-bold text-slate-900 group-hover:text-orange-700">
                          {SPORT_LABEL[sport.sportSlug]}
                        </span>
                        <span className="text-[13px] text-slate-500">
                          {sport.upcoming} upcoming tournament{sport.upcoming === 1 ? "" : "s"}
                        </span>
                      </span>
                      <ArrowRight aria-hidden className="h-4 w-4 text-slate-400" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
