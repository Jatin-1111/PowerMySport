import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, itemListJsonLd, NOINDEX_METADATA } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Trophy } from "lucide-react";
import { EditionCard } from "@/modules/tournaments/components/EditionCard";
import { EditionFilters } from "@/modules/tournaments/components/EditionFilters";
import {
  fetchSportEditions,
  fetchSportFacets,
} from "@/modules/tournaments/services/editionListing";
import { tournamentListHref, type TournamentListState } from "@/modules/tournaments/utils/listHref";
import { SPORT_LABEL } from "../../../federations/[slug]/federationShared";

/**
 * The category-level counterpart to /tournaments/[slug]. That page wins
 * hundreds of individual long-tail searches ("CS7 Delhi") but nothing ranks
 * for the broader "chess tournaments in India" query these editions are all
 * an answer to — this page is that answer, and it fans out into the dated
 * pages via the card grid below.
 *
 * Filtered views (?category=, ?age=, ?month=) keep the unfiltered page as
 * their canonical: they are the same list narrowed, not separate pages.
 */

const EDITIONS_PER_PAGE = 24;

const text = (value: string | string[] | undefined) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sport: string }>;
}): Promise<Metadata> {
  const { sport } = await params;
  const sportLabel = SPORT_LABEL[sport];
  if (!sportLabel) return { title: "Tournaments" };

  const title = `${sportLabel} Tournaments in India: Upcoming Dates & Fact Sheets`;
  const description = `Browse upcoming ${sportLabel} tournaments across India by type, age group and month: dates, venues and entry fact sheets, updated as federations publish them.`;

  // A hub exists for every supported sport, but most hold no tournaments yet
  // and render an empty listing. The sitemap already skips those; this stops
  // one reaching the index by another route and being read as a soft 404.
  const facets = await fetchSportFacets();
  const known = facets.find((f) => f.sportSlug === sport);
  if (facets.length > 0 && !known?.total) {
    return { title, description, ...NOINDEX_METADATA };
  }

  return {
    title,
    description,
    alternates: { canonical: `/tournaments/sport/${sport}` },
    openGraph: {
      title,
      description,
      url: `/tournaments/sport/${sport}`,
      type: "website",
      siteName: "PowerMySport",
    },
  };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function SportTournamentsHubPage({
  params,
  searchParams,
}: {
  params: Promise<{ sport: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { sport } = await params;
  const sportLabel = SPORT_LABEL[sport];
  if (!sportLabel) notFound();

  const query = await searchParams;
  const upcoming = text(query.when) !== "past";
  const page = Math.max(1, parseInt(text(query.page) || "1", 10) || 1);

  const result = await fetchSportEditions(sport, {
    page,
    limit: EDITIONS_PER_PAGE,
    upcoming,
    filters: { category: text(query.category), age: text(query.age), month: text(query.month) },
  });
  const editions = result?.editions ?? [];
  const totalPages = result?.totalPages ?? 1;
  const total = result?.total ?? 0;

  // The server drops a filter value that matches nothing, and the chips follow
  // what it applied, so a stale link never shows a selected chip over a list
  // that ignored it.
  const state: TournamentListState = { upcoming, page, ...(result?.applied ?? {}) };
  const filtered = Boolean(state.category || state.age || state.month);
  const sportLower = sportLabel.toLowerCase();

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Tournaments", path: "/tournaments" },
            { name: `${sportLabel} Tournaments`, path: `/tournaments/sport/${sport}` },
          ]),
          ...(editions.length
            ? [
                itemListJsonLd({
                  name: `${sportLabel} Tournaments in India`,
                  path: `/tournaments/sport/${sport}`,
                  description: `Upcoming ${sportLabel} tournaments across India`,
                  items: editions
                    .filter((e) => e.slug)
                    .map((e) => ({ name: e.name, path: `/tournaments/${e.slug}` })),
                }),
              ]
            : []),
        ]}
      />

      <div className="min-h-screen bg-slate-50">
        <div className="from-power-orange bg-gradient-to-br to-orange-600 px-4 pb-10 pt-14 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <nav aria-label="Breadcrumb" className="mb-3 text-[13px] font-semibold text-orange-50">
              <Link href="/tournaments" className="hover:text-white hover:underline">
                Tournaments
              </Link>
              <ChevronRight aria-hidden className="mx-1 inline h-3.5 w-3.5" />
              <span className="text-white">{sportLabel}</span>
            </nav>
            <h1 className="font-title text-2xl font-extrabold text-white sm:text-3xl">
              {sportLabel} Tournaments in India
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-orange-50">
              {total > 0
                ? `${total} ${upcoming ? "upcoming" : "past"} ${sportLower} tournament${total === 1 ? "" : "s"}${filtered ? " match these filters" : ""}: dates, venues and entry fact sheets as federations publish them.`
                : `${upcoming ? "Upcoming" : "Past"} ${sportLower} tournaments across India.`}
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          {/* Upcoming / past toggle */}
          <div className="mb-4 flex gap-2">
            {([true, false] as const).map((isUpcoming) => (
              <Link
                key={String(isUpcoming)}
                href={tournamentListHref(sport, state, { upcoming: isUpcoming })}
                aria-current={isUpcoming === upcoming ? "true" : undefined}
                className={`rounded-lg border px-4 py-1.5 text-xs font-semibold transition ${
                  isUpcoming === upcoming
                    ? "bg-power-orange-solid border-power-orange-solid text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:text-orange-700"
                }`}
              >
                {isUpcoming ? "Upcoming" : "Past"}
              </Link>
            ))}
          </div>

          {result?.facets && (
            <EditionFilters sportSlug={sport} state={state} facets={result.facets} />
          )}

          {editions.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {editions.map((e) => (
                <EditionCard key={e.slug} edition={e} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 py-16 text-center">
              <Trophy className="mx-auto mb-3 h-8 w-8 text-slate-300" />
              <p className="text-sm font-semibold text-slate-600">
                {filtered
                  ? `No ${upcoming ? "upcoming" : "past"} ${sportLower} tournaments match these filters`
                  : `No ${upcoming ? "upcoming" : "past"} ${sportLower} tournaments listed yet`}
              </p>
              {filtered && (
                <Link
                  href={tournamentListHref(sport, state, {
                    category: undefined,
                    age: undefined,
                    month: undefined,
                  })}
                  className="mt-3 inline-block text-sm font-bold text-orange-700 hover:text-orange-800"
                >
                  Clear all filters
                </Link>
              )}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <nav aria-label="Pages" className="mt-8 flex items-center justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <Link
                  key={p}
                  href={tournamentListHref(sport, state, { page: p })}
                  aria-current={p === page ? "page" : undefined}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                    p === page
                      ? "bg-power-orange-solid border-power-orange-solid text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:text-orange-700"
                  }`}
                >
                  {p}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </div>
    </>
  );
}
