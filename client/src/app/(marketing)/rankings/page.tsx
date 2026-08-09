// ─── Rankings, by sport ─────────────────────────────────────────────────────
//
// The index exists so the URL space is not tennis-shaped. Only tennis is
// mirrored today, and the page says so plainly rather than hiding the other
// sports — a parent who came looking for badminton deserves a straight "not
// yet" instead of a page that silently pretends only tennis has rankings.
//
// The unmirrored list is drawn from RESOURCE_SPORTS so it cannot drift from the
// sports the platform actually covers, and it deliberately carries no dates:
// these depend on federations publishing machine-readable lists, which is not
// ours to promise.

import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { breadcrumbJsonLd } from "@/lib/seo";
import { RESOURCE_SPORTS } from "@/modules/resources/config";
import { fetchRankingMeta, formatAsOn } from "@/modules/rankings/api";
import { RANKING_SPORTS, rankingSportHref } from "@/modules/rankings/config";
import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sports Rankings in India — Official Federation Lists | PowerMySport",
  description:
    "Official Indian federation ranking lists, made searchable. Filter by state, look up a player by name or registration number, and follow a rank week by week. Tennis (AITA) is live.",
  alternates: { canonical: "/rankings" },
  openGraph: {
    title: "Sports rankings in India — official federation lists, searchable",
    description:
      "Federation ranking lists mirrored for search and history. Tennis is live, more to follow.",
    url: "https://powermysport.com/rankings",
    type: "website",
    siteName: "PowerMySport",
  },
};

export default async function RankingsIndexPage() {
  const live = new Set(RANKING_SPORTS.map((s) => s.slug));
  const notYet = RESOURCE_SPORTS.filter((s) => !live.has(s.slug));

  // Only tennis has data today; a single fetch is honest rather than a loop that
  // would make nine pointless requests. The freshest list date across the sport's
  // combos is what a reader actually wants to see on an index card.
  const meta = await fetchRankingMeta("tennis");
  const latest = (meta?.combos ?? [])
    .map((c) => c.asOnDate)
    .filter((d): d is string => Boolean(d))
    .sort()
    .at(-1);
  const asOn = formatAsOn(latest);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <script
        id="rankings-breadcrumb-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([{ name: "Rankings", path: "/rankings" }]),
          ),
        }}
      />
      <Breadcrumbs items={[{ label: "Rankings" }]} className="mb-6" />

      <header className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Sports rankings in India
        </h1>
        <p className="mt-3 text-base text-muted-foreground sm:text-lg">
          Official federation lists, made searchable. Filter by state, look up a
          player by name or registration number, and see how a ranking has moved
          week by week — something the source PDFs cannot show you.
        </p>
      </header>

      <section className="mt-10">
        <h2 className="text-xl font-semibold tracking-tight">Available now</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {RANKING_SPORTS.map((sport) => (
            <li key={sport.slug}>
              <Link
                href={rankingSportHref(sport.slug)}
                className="group flex h-full flex-col justify-between rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-power-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-power-orange focus-visible:ring-offset-2"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium">{sport.name}</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-power-orange" />
                </span>
                <span className="mt-3 block text-sm text-muted-foreground">
                  {sport.federation.acronym} lists
                  {asOn !== "—" && (
                    <>
                      <span className="mx-1.5" aria-hidden>
                        ·
                      </span>
                      as on {asOn}
                    </>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {notYet.length > 0 && (
        <section className="mt-10">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-xl font-semibold tracking-tight">Not mirrored yet</h2>
            <p className="text-sm text-muted-foreground">
              These sports have pathway guides, but no ranking lists here yet.
            </p>
          </div>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {notYet.map((sport) => (
              <li
                key={sport.slug}
                className="flex h-full flex-col justify-between rounded-lg border border-dashed bg-muted/30 p-4"
              >
                <span className="font-medium text-muted-foreground">{sport.name}</span>
                <span className="mt-3 block text-sm text-muted-foreground">
                  Not available yet ·{" "}
                  <Link
                    href={`/resources/${sport.slug}`}
                    className="font-medium text-power-orange hover:underline"
                  >
                    pathway guide
                  </Link>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted-foreground">
            Adding a sport depends on its federation publishing lists we can mirror
            accurately. We would rather show nothing than show a rank we cannot
            stand behind.
          </p>
        </section>
      )}
    </div>
  );
}
