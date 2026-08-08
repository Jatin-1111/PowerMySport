import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import {
  fetchRankingDates,
  fetchRankingMeta,
  fetchRankings,
  formatAsOn,
} from "@/modules/rankings/api";
import { LIVE_COMBOS, comboHref, comboLabel, resolveCombo } from "@/modules/rankings/config";
import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RankingFilters } from "./RankingFilters";

type Params = Promise<{ category: string; subcategory: string }>;
type Search = Promise<{
  state?: string;
  search?: string;
  date?: string;
  page?: string;
}>;

/** Pre-renders the twelve real lists; anything else falls through to notFound. */
export function generateStaticParams() {
  return LIVE_COMBOS.map((combo) => ({
    category: combo.category.toLowerCase(),
    subcategory: combo.subcategory.toLowerCase(),
  }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { category, subcategory } = await params;
  const combo = resolveCombo(category, subcategory);
  if (!combo) return { title: "Rankings — PowerMySport" };

  const label = comboLabel(combo);
  const path = comboHref(combo);
  return {
    title: `AITA ${label} Ranking — Live List by State | PowerMySport`,
    description:
      `The current All India Tennis Association ${label} ranking, searchable by ` +
      `player name and filterable by state, with each player's week-by-week history.`,
    // Canonical is the clean list URL. Filtered and paginated views are the same
    // list sliced differently, and letting each `?state=`/`?page=` combination
    // compete as its own page is how a useful table turns into hundreds of thin
    // near-duplicates in Search Console.
    alternates: { canonical: path },
    openGraph: {
      title: `AITA ${label} Ranking`,
      description: `Current ${label} rankings from AITA, filterable by state.`,
      url: `https://powermysport.com${path}`,
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
  const { category, subcategory } = await params;
  const combo = resolveCombo(category, subcategory);
  if (!combo) notFound();

  const query = await searchParams;
  const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);

  const [result, meta, dates] = await Promise.all([
    fetchRankings({
      category: combo.category,
      subcategory: combo.subcategory,
      ...(query.state ? { state: query.state } : {}),
      ...(query.search ? { search: query.search } : {}),
      ...(query.date ? { date: query.date } : {}),
      page,
    }),
    fetchRankingMeta(),
    fetchRankingDates(combo.category, combo.subcategory),
  ]);

  const label = comboLabel(combo);
  const entries = result?.entries ?? [];
  const pagination = result?.pagination;
  // Point column labels come off the rows themselves: the set differs between
  // junior and open-age lists, and reading them from the data means a new
  // column appears in the table without a code change.
  const pointLabels = entries[0]?.points.map((p) => p.label) ?? [];
  const isHistorical = Boolean(query.date);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <Breadcrumbs
        items={[{ label: "Rankings", href: "/rankings" }, { label }]}
        className="mb-6"
      />

      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            AITA {label} Ranking
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {result?.snapshot ? (
              <>
                As on{" "}
                <span className="font-medium text-foreground">
                  {formatAsOn(result.snapshot.asOnDate)}
                </span>
                {typeof result.snapshot.rowCount === "number" && (
                  <>
                    <span className="mx-1.5" aria-hidden>
                      ·
                    </span>
                    {result.snapshot.rowCount.toLocaleString("en-IN")} ranked players
                  </>
                )}
              </>
            ) : (
              "This list has not been published yet."
            )}
          </p>
        </div>

        {result?.snapshot?.sourceUrl && (
          <a
            href={result.snapshot.sourceUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-power-orange hover:underline"
          >
            Official AITA source
            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        )}
      </header>

      {isHistorical && (
        <p className="mt-4 rounded-md border border-power-orange/30 bg-power-orange/5 px-3 py-2 text-sm">
          Showing an archived week. <Link href={comboHref(combo)} className="font-medium underline">Back to the latest list</Link>.
        </p>
      )}

      <div className="mt-6">
        <RankingFilters states={meta?.states ?? []} dates={dates ?? []} />
      </div>

      {entries.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          No players match these filters.
        </p>
      ) : (
        <>
          {/* Point columns are numerous and long-labelled; the table scrolls
              inside its own container so the page body never scrolls sideways. */}
          <div className="mt-6 overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[46rem] border-collapse text-sm">
              <caption className="sr-only">
                AITA {label} ranking{query.state ? `, ${query.state}` : ""}, as on{" "}
                {formatAsOn(result?.snapshot?.asOnDate)}
              </caption>
              <thead>
                <tr className="border-b bg-muted/50 text-left">
                  <th scope="col" className="w-16 px-3 py-2.5 font-semibold">
                    Rank
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    Player
                  </th>
                  <th scope="col" className="px-3 py-2.5 font-semibold">
                    State
                  </th>
                  {pointLabels.slice(0, -1).map((pointLabel) => (
                    <th
                      key={pointLabel}
                      scope="col"
                      className="hidden px-3 py-2.5 text-right font-medium text-muted-foreground lg:table-cell"
                    >
                      {pointLabel}
                    </th>
                  ))}
                  <th scope="col" className="px-3 py-2.5 text-right font-semibold">
                    Points
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry._id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-3 py-2.5 font-semibold tabular-nums">
                      {entry.rank}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/rankings/players/${entry.regNo}`}
                        className="font-medium hover:text-power-orange hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-power-orange focus-visible:ring-offset-2 rounded"
                      >
                        {entry.fullName}
                      </Link>
                      <span className="block text-xs text-muted-foreground">
                        {entry.regNo}
                        {entry.birthYear ? ` · b. ${entry.birthYear}` : ""}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {entry.state ?? entry.stateCode ?? "—"}
                    </td>
                    {entry.points.slice(0, -1).map((point) => (
                      <td
                        key={point.label}
                        className="hidden px-3 py-2.5 text-right tabular-nums text-muted-foreground lg:table-cell"
                      >
                        {point.value.toLocaleString("en-IN")}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                      {entry.totalPoints.toLocaleString("en-IN")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.pages > 1 && (
            <Pagination
              basePath={comboHref(combo)}
              query={query}
              page={pagination.page}
              pages={pagination.pages}
              total={pagination.total}
            />
          )}
        </>
      )}
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
