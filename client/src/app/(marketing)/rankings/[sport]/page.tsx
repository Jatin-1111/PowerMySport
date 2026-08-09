// ─── One sport's ranking lists ──────────────────────────────────────────────
//
// Was `/rankings` when tennis was the only sport this could mean. The lists,
// grouping and federation attribution all come off the sport's registry entry,
// so a second federation renders here without a new page.

import { Breadcrumbs } from "@/components/ui/breadcrumbs";
import { breadcrumbJsonLd } from "@/lib/seo";
import { fetchRankingMeta, formatAsOn } from "@/modules/rankings/api";
import {
  RANKING_SPORTS,
  comboHref,
  comboLabel,
  getRankingSport,
} from "@/modules/rankings/config";
import { ArrowRight, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export function generateStaticParams() {
  return RANKING_SPORTS.map((s) => ({ sport: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sport: string }>;
}): Promise<Metadata> {
  const sport = getRankingSport((await params).sport);
  if (!sport) return {};
  const { acronym, name } = sport.federation;
  return {
    title: `${acronym} ${sport.name} Rankings — Search by State, Age Group & Player | PowerMySport`,
    description: `Official ${name} rankings, made searchable. Filter every list by state, look up a player by name or registration number, and follow a rank week by week.`,
    alternates: { canonical: `/rankings/${sport.slug}` },
    openGraph: {
      title: `${acronym} ${sport.name} Rankings — searchable, by state and age group`,
      description: `Every ${acronym} ranking list, filterable by state and searchable by name, with each player's week-by-week history.`,
      url: `https://powermysport.com/rankings/${sport.slug}`,
      type: "website",
      siteName: "PowerMySport",
    },
  };
}

export default async function SportRankingsPage({
  params,
}: {
  params: Promise<{ sport: string }>;
}) {
  const sport = getRankingSport((await params).sport);
  if (!sport) notFound();

  const meta = await fetchRankingMeta(sport.slug);
  const availability = new Map(
    (meta?.combos ?? []).map((c) => [`${c.category}/${c.subcategory}`, c]),
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <script
        id="sport-rankings-breadcrumb-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbJsonLd([
              { name: "Rankings", path: "/rankings" },
              { name: sport.name, path: `/rankings/${sport.slug}` },
            ]),
          ),
        }}
      />
      <Breadcrumbs
        items={[{ label: "Rankings", href: "/rankings" }, { label: sport.name }]}
        className="mb-6"
      />

      <header className="max-w-3xl">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          {sport.federation.acronym} {sport.name} Rankings
        </h1>
        <p className="mt-3 text-base text-muted-foreground sm:text-lg">
          The official {sport.federation.name} lists, made searchable. Filter by
          state, look up a player by name or registration number, and see how a
          ranking has moved week by week — something the source PDFs cannot show
          you.
        </p>
      </header>

      <div className="mt-10 space-y-10">
        {sport.groups.map((group) => (
          <section key={group.title}>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-xl font-semibold tracking-tight">{group.title}</h2>
              <p className="text-sm text-muted-foreground">{group.blurb}</p>
            </div>

            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {group.combos.map((combo) => {
                const info = availability.get(
                  `${combo.category}/${combo.subcategory}`,
                );
                const available = info?.available ?? false;
                return (
                  <li key={comboHref(sport.slug, combo)}>
                    <Link
                      href={comboHref(sport.slug, combo)}
                      className="group flex h-full flex-col justify-between rounded-lg border bg-card p-4 shadow-sm transition-colors hover:border-power-orange focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-power-orange focus-visible:ring-offset-2"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium">{comboLabel(combo)}</span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-power-orange" />
                      </span>
                      <span className="mt-3 block text-sm text-muted-foreground">
                        {available ? (
                          <>
                            {info?.rowCount?.toLocaleString("en-IN")} players
                            <span className="mx-1.5" aria-hidden>
                              ·
                            </span>
                            as on {formatAsOn(info?.asOnDate)}
                          </>
                        ) : (
                          "Not published yet"
                        )}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {/*
        Attribution is not decoration. We are republishing another body's data,
        and a parent checking a rank they disagree with should be one click from
        the official source rather than stuck arguing with us.
      */}
      <footer className="mt-12 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
        <p>
          Rankings are published by the{" "}
          <span className="font-medium text-foreground">
            {meta?.source.federation ?? sport.federation.name}
          </span>{" "}
          and mirrored here for search and history. PowerMySport is not affiliated
          with {sport.federation.acronym}. Always treat the official list as
          authoritative.
        </p>
        <a
          href={meta?.source.url ?? sport.federation.officialUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="mt-2 inline-flex items-center gap-1.5 font-medium text-power-orange hover:underline"
        >
          View the official {sport.federation.acronym} rankings page
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </footer>
    </div>
  );
}
