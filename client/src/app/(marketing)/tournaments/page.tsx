import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EditionTable } from "@/modules/tournaments/components/EditionCard";
import { FEATURED_TOURNAMENT_SPORT } from "@/modules/tournaments/config/featured";
import {
  fetchSportEditions,
  fetchSportFacets,
} from "@/modules/tournaments/services/editionListing";
import { tournamentListHref } from "@/modules/tournaments/utils/listHref";
import { PageHeader } from "@/modules/shared/ui/PageHeader";
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

      <div className="bg-paper min-h-screen">
        <PageHeader
          breadcrumbs={[{ label: "Tournaments" }]}
          title="Tournaments"
          description="Upcoming tournaments across India, read from each federation's own calendar. Narrow them to your child's age group, the type of event and the month."
        />

        <div className="mx-auto max-w-6xl space-y-12 px-4 py-8 sm:px-6 lg:px-8">
          <section aria-labelledby="featured-heading">
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2
                  id="featured-heading"
                  className="font-editorial text-ink text-3xl font-light tracking-tight"
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
                  className="text-ink inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-4"
                >
                  See all {featuredLabel.toLowerCase()} tournaments
                  <ArrowRight aria-hidden className="h-4 w-4" />
                </Link>
              )}
            </div>

            {categories.length > 1 && (
              <div className="mb-5">
                <p className="text-ink-muted mb-2 text-sm">Browse by type of event</p>
                <ul className="flex flex-wrap gap-2">
                  {categories.map((category) => (
                    <li key={category.value}>
                      <Link
                        href={tournamentListHref(featured, featuredState, {
                          category: category.value,
                        })}
                        className="border-hairline text-ink hover:border-ink/40 inline-flex min-h-9 items-center gap-1.5 rounded-md border bg-white px-3 text-sm font-medium transition"
                      >
                        {category.label}
                        <span className="text-slate-500">{category.count}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {featuredEditions.length > 0 ? (
              <EditionTable editions={featuredEditions} />
            ) : (
              <div className="border-hairline rounded-xl border border-dashed py-14 text-center">
                <p className="text-ink-body text-sm">
                  No upcoming {featuredLabel.toLowerCase()} tournaments are listed right now.
                </p>
              </div>
            )}
          </section>

          {otherSports.length > 0 && (
            <section aria-labelledby="other-sports-heading">
              <h2
                id="other-sports-heading"
                className="font-editorial text-ink mb-6 text-3xl font-light tracking-tight"
              >
                Other sports
              </h2>
              <ul className="divide-hairline border-hairline divide-y border-y">
                {otherSports.map((sport) => (
                  <li key={sport.sportSlug}>
                    <Link
                      href={`/tournaments/sport/${sport.sportSlug}`}
                      className="hover:bg-paper-deep/60 group flex items-center justify-between gap-4 px-1 py-4 transition-colors md:px-2"
                    >
                      <span className="text-ink text-lg group-hover:underline group-hover:underline-offset-4">
                        {SPORT_LABEL[sport.sportSlug]}
                      </span>
                      <span className="text-ink-muted flex items-center gap-3 text-sm">
                        {sport.upcoming} upcoming tournament{sport.upcoming === 1 ? "" : "s"}
                        <ArrowRight aria-hidden className="text-ink h-4 w-4" />
                      </span>
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
