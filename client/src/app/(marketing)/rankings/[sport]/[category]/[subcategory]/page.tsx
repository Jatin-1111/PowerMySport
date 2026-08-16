import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { breadcrumbJsonLd } from "@/lib/seo";
import {
  fetchRankingDates,
  fetchRankingMeta,
  fetchRankings,
  formatAsOn,
} from "@/modules/rankings/api";
import {
  RANKING_SPORTS,
  comboHref,
  comboLabel,
  getRankingSport,
  resolveCombo,
} from "@/modules/rankings/config";
import { isJuniorBracket } from "@/modules/rankings/aitaRules";
import { EntryRules, HowToRead } from "@/modules/rankings/HowToRead";
import { rankAtPercentile } from "@/modules/rankings/insights";
import { PlayerSpotlight } from "@/modules/rankings/PlayerSpotlight";
import { PointsComposition } from "@/modules/rankings/PointsComposition";
import { PointsLadder } from "@/modules/rankings/PointsLadder";
import { RankingStatStrip } from "@/modules/rankings/RankingStatStrip";
import { RankingTable } from "@/modules/rankings/RankingTable";
import { StateDistribution } from "@/modules/rankings/StateDistribution";
import { CalendarDays, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RankingFilters } from "./RankingFilters";

type Params = Promise<{ sport: string; category: string; subcategory: string }>;
type Search = Promise<{
  state?: string;
  search?: string;
  date?: string;
  page?: string;
}>;

/** Pre-renders every mirrored sport's real lists; anything else notFounds. */
export function generateStaticParams() {
  return RANKING_SPORTS.flatMap((sport) =>
    sport.combos.map((combo) => ({
      sport: sport.slug,
      category: combo.category.toLowerCase(),
      subcategory: combo.subcategory.toLowerCase(),
    })),
  );
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { sport: sportSlug, category, subcategory } = await params;
  const sport = getRankingSport(sportSlug);
  const combo = sport && resolveCombo(sport, category, subcategory);
  if (!sport || !combo) return { title: "Rankings" };

  const label = comboLabel(combo);
  const path = comboHref(sport.slug, combo);
  const acronym = sport.federation.acronym;
  return {
    title: `${acronym} ${label} Ranking — Live List by State | PowerMySport`,
    description:
      `The current ${sport.federation.name} ${label} ranking, searchable by ` +
      `player name and filterable by state, with each player's week-by-week history.`,
    // Canonical is the clean list URL. Filtered and paginated views are the same
    // list sliced differently, and letting each `?state=`/`?page=` combination
    // compete as its own page is how a useful table turns into hundreds of thin
    // near-duplicates in Search Console.
    alternates: { canonical: path },
    openGraph: {
      title: `${acronym} ${label} Ranking`,
      description: `Current ${label} rankings from ${acronym}, filterable by state.`,
      url: path,
      type: "website",
      siteName: "PowerMySport",
    },
  };
}

export default async function RankingListPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Search;
}) {
  const { sport: sportSlug, category, subcategory } = await params;
  const sport = getRankingSport(sportSlug);
  const combo = sport && resolveCombo(sport, category, subcategory);
  if (!sport || !combo) notFound();

  const query = await searchParams;
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);

  const [result, meta, dates] = await Promise.all([
    fetchRankings({
      sport: sport.slug,
      category: combo.category,
      subcategory: combo.subcategory,
      ...(query.state ? { state: query.state } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.date ? { date: query.date } : {}),
      page,
    }),
    fetchRankingMeta(sport.slug),
    fetchRankingDates(combo.category, combo.subcategory, sport.slug),
  ]);

  const label = comboLabel(combo);
  const entries = result?.entries ?? [];
  const pagination = result?.pagination;
  const isHistorical = Boolean(query.date);

  const listSize = result?.snapshot?.rowCount ?? null;
  // Movement is only shown when there is a week to measure it against. On the
  // oldest list we hold, every player would otherwise read as "new", which is a
  // fact about our archive rather than about them.
  const hasBaseline = Boolean(result?.snapshot?.comparedTo);
  // A search that narrowed to a few people is someone looking for one child;
  // give them the answers instead of a row in a table.
  const spotlight = query.search && entries.length > 0 && entries.length <= 6 ? entries : [];

  // Aggregates computed when the list was ingested. Each panel enforces its own
  // minimum (a two-rung ladder is not a ladder), so this only decides whether the
  // section exists at all — a list backfilled before the analytics shipped has
  // none of them and simply shows the table.
  const benchmarks = result?.snapshot?.benchmarks ?? [];
  const bandProfiles = result?.snapshot?.bandProfiles ?? [];
  const stateCounts = result?.snapshot?.stateCounts ?? [];
  // The entry-rules panel is not computed from the list, so it stands on its own
  // — a junior list with no analytics at all still has rules worth explaining.
  const hasInsights =
    entries.length > 0 &&
    (benchmarks.length > 1 || bandProfiles.length > 0 || stateCounts.length >= 3);

  const scaled = listSize !== null && listSize >= 100;
  // Junior lists are the parent-facing ones. Men's and Women's Singles/Doubles
  // are adults reading about themselves, and neither the "your child" copy nor
  // the junior entry gates belong there.
  const isJunior = isJuniorBracket(combo.subcategory);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <script
        id="ranking-list-breadcrumb-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: "Rankings", path: "/rankings" },
              { name: sport.name, path: `/rankings/${sport.slug}` },
              { name: label, path: comboHref(sport.slug, combo) },
            ]),
          ),
        }}
      />
      {/* The sport rung matters now the URL has one — a crumb that jumps
          Rankings → Boys Under-14 hides a level the address bar shows. */}
      <Breadcrumbs
        items={[
          { label: "Rankings", href: "/rankings" },
          { label: sport.name, href: `/rankings/${sport.slug}` },
          { label },
        ]}
        className="mb-6"
      />

      <header>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {sport.federation.acronym} {label} Ranking
            </h1>
            {/* One sentence saying what this is, for the reader who arrived from
                a forwarded link and has never seen an AITA list before. */}
            <p className="mt-2 max-w-xl text-base text-muted-foreground">
              The official {sport.federation.name} ranking for {label} in India,
              updated most weeks.
            </p>
            {/* Freshness first and as a pill, not buried in a sentence. Anyone
                mirroring another body's data is asked "is this current?" before
                anything else, and the honest answer is the whole trust story. */}
            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm">
              {result?.snapshot ? (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 font-medium">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    As on {formatAsOn(result.snapshot.asOnDate)}
                  </span>
                  {hasBaseline && (
                    <span className="text-muted-foreground">
                      movement against {formatAsOn(result.snapshot.comparedTo)}
                    </span>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground">
                  This list has not been published yet.
                </span>
              )}
            </div>
          </div>

          {result?.snapshot?.sourceUrl && (
            <a
              href={result.snapshot.sourceUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors hover:border-power-orange hover:text-power-orange"
            >
              Official {sport.federation.acronym} source
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          )}
        </div>

        <RankingStatStrip
          listSize={listSize}
          benchmarks={benchmarks}
          listLabel={label}
        />

        <HowToRead
          listLabel={label}
          listSize={listSize}
          asOnLabel={formatAsOn(result?.snapshot?.asOnDate)}
          top10Rank={scaled ? rankAtPercentile(10, listSize) : null}
          top25Rank={scaled ? rankAtPercentile(25, listSize) : null}
        />
      </header>

      {isHistorical && (
        <p className="mt-5 rounded-lg border border-power-orange/30 bg-power-orange/5 px-3.5 py-2.5 text-sm">
          You are viewing an archived week.{" "}
          <Link href={comboHref(sport.slug, combo)} className="font-medium underline">
            Back to the latest list
          </Link>
          .
        </p>
      )}

      <div className="mt-7">
        <RankingFilters
          states={meta?.states ?? []}
          dates={dates ?? []}
          searchLabel={
            isJunior ? "Find your child on this list" : "Find a player"
          }
        />
      </div>

      {spotlight.length > 0 && (
        <PlayerSpotlight
          entries={spotlight}
          sportSlug={sport.slug}
          listSize={listSize}
          hasBaseline={hasBaseline}
        />
      )}

      {entries.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed p-10 text-center">
          <p className="font-medium">No players match these filters.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a shorter name, the registration number on its own, or clear the
            state filter.
          </p>
        </div>
      ) : (
        <>
          <RankingTable
            entries={entries}
            sportSlug={sport.slug}
            listLabel={`${sport.federation.acronym} ${label}`}
            listSize={listSize}
            hasBaseline={hasBaseline}
            benchmarks={benchmarks}
            stateFiltered={query.state}
            asOnLabel={formatAsOn(result?.snapshot?.asOnDate)}
          />

          {pagination && pagination.pages > 1 && (
            <Pagination
              basePath={comboHref(sport.slug, combo)}
              query={query}
              page={pagination.page}
              pages={pagination.pages}
              total={pagination.total}
            />
          )}
        </>
      )}

      {/*
        Read sideways.

        Everything below answers "is my child doing well" rather than "what number
        are they" — which is the question the source PDF cannot answer at all. It
        sits after the table because the table is what someone came for, and it is
        ordered by how much a parent can act on it: what the next level costs, what
        this rank opens and closes, what kind of matches the points come from, and
        only then the state breakdown, which is folded away.

        The computed panels cover the whole list, not the page above, and do not
        change with the filters. The entry rules are not computed at all — they are
        AITA's, and say so on screen.
      */}
      {(hasInsights || isJunior) && (
        <section className="mt-14 border-t pt-10" aria-labelledby="ranking-insights">
          <h2
            id="ranking-insights"
            className="scroll-mt-8 text-2xl font-bold tracking-tight"
          >
            What these numbers mean
          </h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Worked out across all{" "}
            {listSize?.toLocaleString("en-IN") ?? "the"} ranked players, not just the
            page above. The filters do not change anything here.
          </p>

          <div className="mt-6 grid items-start gap-5 lg:grid-cols-2">
            <PointsLadder
              benchmarks={benchmarks}
              listLabel={label}
              parentAudience={isJunior}
            />
            <EntryRules subcategory={combo.subcategory} listLabel={label} />
            <div className="lg:col-span-2">
              <PointsComposition
                bands={bandProfiles}
                subcategory={combo.subcategory}
              />
            </div>
            <div className="lg:col-span-2">
              <StateDistribution stateCounts={stateCounts} listLabel={label} />
            </div>
          </div>
        </section>
      )}

      <p className="mt-10 text-xs leading-relaxed text-muted-foreground">
        Rankings are published by the {sport.federation.name} and mirrored here.
        PowerMySport is not affiliated with {sport.federation.acronym}.
      </p>
    </div>
  );
}

/**
 * Plain links, not buttons — pagination that works without JavaScript is also
 * pagination a crawler can follow, and these lists run to 30+ pages.
 */
function Pagination({
  basePath,
  query,
  page,
  pages,
  total,
}: {
  basePath: string;
  query: { state?: string; search?: string; date?: string };
  page: number;
  pages: number;
  total: number;
}) {
  const href = (target: number) => {
    const params = new URLSearchParams();
    if (query.state) params.set("state", query.state);
    if (query.search) params.set("search", query.search);
    if (query.date) params.set("date", query.date);
    if (target > 1) params.set("page", String(target));
    const suffix = params.toString();
    return suffix ? `${basePath}?${suffix}` : basePath;
  };

  const linkClass =
    "inline-flex h-9 items-center rounded-md border px-3 text-sm font-medium transition-colors hover:border-power-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-power-orange focus-visible:ring-offset-2";

  return (
    <nav
      className="mt-6 flex items-center justify-between gap-4"
      aria-label="Ranking pages"
    >
      <p className="text-sm text-muted-foreground">
        Page {page} of {pages}
        <span className="mx-1.5" aria-hidden>
          ·
        </span>
        {total.toLocaleString("en-IN")} players
      </p>
      <div className="flex gap-2">
        {page > 1 && (
          <Link href={href(page - 1)} className={linkClass} rel="prev">
            Previous
          </Link>
        )}
        {page < pages && (
          <Link href={href(page + 1)} className={linkClass} rel="next">
            Next
          </Link>
        )}
      </div>
    </nav>
  );
}
