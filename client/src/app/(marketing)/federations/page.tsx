import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { JsonLd } from "@/components/seo/JsonLd";
import { getCommunityAppUrl } from "@/lib/community/url";
import { breadcrumbJsonLd, itemListJsonLd } from "@/lib/seo";
import { FederationCard } from "@/modules/federations/components/FederationCard";
import {
  FEDERATION_INDEX_REVALIDATE_SECONDS,
  fetchFederations,
} from "@/modules/federations/fetchFederations";
import { CTA } from "@/modules/marketing/components/marketing/CTA";
import { SectionLabel } from "@/modules/marketing/components/marketing/SectionLabel";
import { fetchPublishedPathways } from "@/modules/pathway/fetchGuide";
import { PATHWAY_SPORTS } from "@/modules/pathway/sports";

// ─── /federations ────────────────────────────────────────────────────────────
//
// The parent every `/federations/[slug]` page was missing. Until this existed
// the detail pages were reachable only from the sitemap, tournament pages and
// search — deep, useful content with no way into it from the site itself.
//
// Grouped by sport, and each group links back to that sport's pathway: a parent
// who lands here from a search for "AITA age categories" should be one click
// from the guide that explains why the answer matters.

const TITLE = "Sports federations in India";
const DESCRIPTION =
  "The governing bodies behind Indian youth sport — who they are, who can enter their tournaments, how to register, and what's on their official calendars.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/federations" },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: "/federations",
    type: "website",
    siteName: "PowerMySport",
  },
};

/**
 * Display name for a sport slug.
 *
 * `PATHWAY_SPORTS` is the site's slug ↔ name registry, but a federation can
 * exist for a sport with no pathway yet, so an unknown slug falls back to a
 * title-cased version of itself rather than rendering a bare slug.
 */
function sportName(slug: string): string {
  const known = PATHWAY_SPORTS.find((sport) => sport.slug === slug);
  if (known) return known.name;
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default async function FederationsIndexPage() {
  // Both lists, because they answer different questions. `federations` is what
  // this page shows; `published` is the only honest source for whether a
  // "read the pathway" link has anywhere to go — the sport registry lists what
  // we are willing to publish, and linking off that produced a 404 for every
  // sport with a federation but no published guide (badminton, today).
  const [federations, published] = await Promise.all([
    fetchFederations(undefined, FEDERATION_INDEX_REVALIDATE_SECONDS),
    fetchPublishedPathways(),
  ]);
  const communityUrl = getCommunityAppUrl();

  const publishedSports = new Set(published.map((guide) => guide.sportSlug));

  // Grouped by sport, sports in registry order so the list matches /roadmap.
  // `fetchFederations` already sorted within each sport by governing relevance,
  // and grouping preserves that order.
  const bySport = new Map<string, typeof federations>();
  for (const federation of federations) {
    const group = bySport.get(federation.sportSlug);
    if (group) group.push(federation);
    else bySport.set(federation.sportSlug, [federation]);
  }

  const registryOrder = (slug: string): number => {
    const index = PATHWAY_SPORTS.findIndex((sport) => sport.slug === slug);
    return index === -1 ? PATHWAY_SPORTS.length : index;
  };
  const groups = Array.from(bySport.entries()).sort(
    ([a], [b]) => registryOrder(a) - registryOrder(b) || a.localeCompare(b),
  );

  return (
    <main className="overflow-x-clip">
      <JsonLd
        data={[
          breadcrumbJsonLd([{ name: "Federations", path: "/federations" }]),
          itemListJsonLd({
            name: TITLE,
            path: "/federations",
            description: DESCRIPTION,
            items: federations.map((federation) => ({
              name: `${federation.acronym} — ${federation.name}`,
              path: `/federations/${federation.slug}`,
            })),
          }),
        ]}
      />

      {/* ── Hero ── */}
      <section className="pt-12 sm:pt-16 lg:pt-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-4 flex justify-center">
              <SectionLabel label="Governing Bodies" color="green" />
            </div>
            <h1 className="font-title text-3xl font-bold text-slate-900 sm:text-4xl md:text-5xl">
              Who decides what your child can enter
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
              Every competitive sport in India runs on someone&apos;s rulebook —
              age cut-offs, registration order, ranking points, an official
              calendar. We keep the details for each body in one place, checked
              against its own published sources rather than summarised from
              memory.
            </p>
          </div>
        </div>
      </section>

      {/* ── Federations by sport ── */}
      <section className="py-12 sm:py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {groups.length === 0 ? (
            <p className="mx-auto max-w-xl text-center text-sm text-slate-600 sm:text-base">
              We&apos;re curating federation records one sport at a time — check
              back shortly.
            </p>
          ) : (
            <div className="flex flex-col gap-12">
              {groups.map(([slug, sportFederations]) => (
                <div key={slug}>
                  <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
                    <h2 className="font-title text-2xl font-bold text-slate-900 sm:text-3xl">
                      {sportName(slug)}
                    </h2>
                    {publishedSports.has(slug) && (
                      <Link
                        href={`/roadmap/${slug}`}
                        className="inline-flex items-center gap-1 text-sm font-semibold text-power-orange transition hover:gap-1.5"
                      >
                        Read the {sportName(slug)} pathway
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    )}
                  </div>

                  <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {sportFederations.map((federation) => (
                      <li key={federation.slug}>
                        <FederationCard federation={federation} />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <CTA
        variant="gradient"
        title="Not sure what any of this means for your child?"
        description="The sport pathways explain where your child is today, what comes next, and which of these rules actually apply at their stage."
        primaryCTA={{ label: "Explore Sport Pathways", href: "/roadmap" }}
        secondaryCTA={{ label: "Join Parent Community", href: communityUrl }}
      />
    </main>
  );
}
