import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/seo/JsonLd";
import { getCommunityAppUrl } from "@/lib/community/url";
import { articleJsonLd } from "@/lib/seo";
import { FederationBand } from "@/modules/federations/components/FederationBand";
import { CTA } from "@/modules/marketing/components/marketing/CTA";
import { PathwayContributorCard } from "@/modules/pathway/components/PathwayContributorCard";
import { PathwayReader } from "@/modules/pathway/components/PathwayReader";
import {
  PathwayHelpSection,
  PathwayStatsBanner,
} from "@/modules/pathway/components/PathwaySections";
import { fetchPathwayGuide } from "@/modules/pathway/services/fetchGuide";
import { sportFromSlug } from "@/modules/pathway/data/sports";
import { PageHeader } from "@/modules/shared/ui/PageHeader";

// ─── /roadmap/[sport] ────────────────────────────────────────────────────────
//
// The parent-facing pathway for one sport. Server-rendered so the whole guide is
// in the HTML: this is the page a parent searching "how do I start my child in
// tennis" should land on, and it cannot depend on JavaScript to have content.

export async function generateMetadata({
  params,
}: {
  params: Promise<{ sport: string }>;
}): Promise<Metadata> {
  const { sport } = await params;
  const guide = await fetchPathwayGuide(sport);
  const name = guide?.sportName ?? sportFromSlug(sport)?.name;
  if (!name) return { title: "Sport pathway" };

  // No " | PowerMySport" suffix — the root layout's `%s | PowerMySport`
  // template appends it, and spelling it out here produced it twice.
  const title = `${name} pathway in India: a parent's guide`;
  const description =
    guide?.intro.description ??
    `Every stage of ${name} for Indian parents: where your child is now, what to watch for, the decisions ahead, and what to do next.`;

  return {
    title,
    description,
    alternates: { canonical: `/roadmap/${sport}` },
    openGraph: {
      title,
      description,
      url: `/roadmap/${sport}`,
      type: "article",
      siteName: "PowerMySport",
    },
  };
}

// Deliberately no `generateStaticParams`. Which sports have a published pathway
// changes in the CMS, not at build time; on-demand rendering plus ISR keeps a
// newly published sport from needing a deploy.

export default async function SportPathwayPage({
  params,
  searchParams,
}: {
  params: Promise<{ sport: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { sport } = await params;
  const query = await searchParams;
  const guide = await fetchPathwayGuide(sport);

  // Read on the server so a shared `?stage=` link renders that stage in the HTML
  // rather than flashing stage one and jumping once JavaScript arrives.
  const stageParam = Array.isArray(query.stage) ? query.stage[0] : query.stage;

  // Nothing published for this sport yet. A 404 rather than an empty shell: an
  // empty pathway is worse than none, and it keeps a thin page out of the index.
  if (!guide || guide.stages.length === 0) notFound();

  const communityUrl = getCommunityAppUrl();

  return (
    <main className="overflow-x-clip">
      <JsonLd
        data={[
          articleJsonLd({
            headline: `${guide.sportName} pathway in India: a parent's guide`,
            path: `/roadmap/${guide.sportSlug}`,
            description:
              guide.intro.description ?? `Every stage of ${guide.sportName} for Indian parents.`,
            ...(guide.updatedAt ? { dateModified: guide.updatedAt } : {}),
            section: guide.sportName,
            keywords: [
              `${guide.sportName} pathway India`,
              `${guide.sportName} for kids India`,
              `how to start ${guide.sportName} in India`,
            ],
            // A contributed pathway is authored by a named person, not by us.
            // This is the field that carries that into search results, so it has
            // to come from the same credit the page renders.
            ...(guide.contributor
              ? {
                  author: {
                    name: guide.contributor.name,
                    ...(guide.contributor.url ? { url: guide.contributor.url } : {}),
                    ...(guide.contributor.organisation
                      ? { organisation: guide.contributor.organisation }
                      : {}),
                  },
                }
              : {}),
          }),
        ]}
      />

      {/* ── Header ── */}
      {/* The hero is the headline block alone.
          "About <sport>" used to sit beside it as a sidebar card, which
          only worked while the two columns happened to be the same height.
          They are not related: the card grows with however many intro
          paragraphs a sport has, so whichever column was shorter left dead
          space, bottom-aligned it was a void above the headline, top-
          aligned it was a void below. Tennis has three short paragraphs and
          got away with it; Chess has four longer ones and did not.
          It reads as prose, so it is laid out as prose, below. */}
      <PageHeader
        width="7xl"
        breadcrumbs={[{ label: "Sports pathways", href: "/roadmap" }, { label: guide.sportName }]}
        eyebrow={guide.intro.eyebrow ?? `${guide.sportName} pathway · for parents`}
        title={guide.intro.headline ?? "Understand. Question. Observe. Decide. Act."}
        description={guide.intro.description ?? undefined}
      >
        {/* The first paragraph leads, in the serif; the rest follow as plain prose in one
            readable column. Two flowing columns made a short intro look like a magazine
            spread and a long one an uneven wall. */}
        {guide.sportIntro.length > 0 && (
          <section className="border-hairline border-t pt-6">
            <p className="text-ink-muted text-sm">About {guide.sportName}</p>
            <p className="font-editorial text-ink mt-3 max-w-3xl text-pretty text-2xl font-light leading-snug">
              {guide.sportIntro[0]}
            </p>
            {guide.sportIntro.length > 1 && (
              <div className="text-ink-body mt-5 max-w-prose space-y-3 leading-relaxed">
                {guide.sportIntro.slice(1).map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            )}
          </section>
        )}
      </PageHeader>

      {/* ── The pathway ── */}
      <section className="py-8 sm:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <PathwayReader guide={guide} initialStageKey={stageParam?.trim().toLowerCase()} />
          {guide.contributor && (
            <div className="mt-6">
              <PathwayContributorCard contributor={guide.contributor} sportName={guide.sportName} />
            </div>
          )}
          {guide.reviewedOn && <p className="text-ink-muted mt-4 text-sm">{guide.reviewedOn}</p>}
        </div>
      </section>

      {/* Directly under the stages, before the marketing chrome: a parent who has
          just read what decision is coming is one scroll from the body whose
          rules that decision has to satisfy. */}
      <FederationBand sportSlug={guide.sportSlug} sportName={guide.sportName} />

      <PathwayStatsBanner />
      <PathwayHelpSection />

      <CTA
        title="Ready to support their dream?"
        description="Find the right coach, book the right ground, and get a smart plan that shows exactly how to help your child grow in sports."
        primaryCTA={{ label: "Get guidance", href: "/guidance" }}
        secondaryCTA={{ label: "Join parent community", href: communityUrl }}
      />
    </main>
  );
}
