import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

import { JsonLd } from "@/components/seo/JsonLd";
import { getCommunityAppUrl } from "@/lib/community/url";
import { articleJsonLd } from "@/lib/seo";
import { normalizeStateName } from "@/lib/indianStates";
import { CTA } from "@/modules/marketing/components/marketing/CTA";
import { SectionLabel } from "@/modules/marketing/components/marketing/SectionLabel";
import { PathwayReader } from "@/modules/pathway/components/PathwayReader";
import {
  PathwayHelpSection,
  PathwayStatsBanner,
} from "@/modules/pathway/components/PathwaySections";
import { fetchPathwayGuide } from "@/modules/pathway/fetchGuide";
import { sportFromSlug } from "@/modules/pathway/sports";

// ─── /roadmap/[sport] ────────────────────────────────────────────────────────
//
// The parent-facing pathway for one sport. Server-rendered so the whole guide is
// in the HTML: this is the page a parent searching "how do I start my child in
// tennis" should land on, and it cannot depend on JavaScript to have content.

/**
 * The reader's chosen state, canonicalised, or `undefined` if they didn't pick a
 * real one.
 *
 * Validated here rather than left to the API: an unrecognised name used to come
 * back as a 400 and take the whole page down with it. A typo, a crawler probing
 * `?state=xyz`, or a stale link all resolve to the national guide instead.
 */
function readState(raw: string | string[] | undefined): string | undefined {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const trimmed = value?.trim();
  return trimmed ? normalizeStateName(trimmed) : undefined;
}

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
  const title = `${name} pathway in India — a parent's guide`;
  const description =
    guide?.intro.description ??
    `Every stage of ${name} for Indian parents: where your child is now, what to watch for, the decisions ahead, and what to do next.`;

  return {
    title,
    description,
    // Every `?state=` variant canonicalises back to the bare path. A state
    // overlay scopes the content without minting a near-duplicate URL per state.
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
  const chosenState = readState(query.state);
  const guide = await fetchPathwayGuide(sport, chosenState);

  // Read on the server so a shared `?stage=` link renders that stage in the HTML
  // rather than flashing stage one and jumping once JavaScript arrives.
  const stageParam = Array.isArray(query.stage) ? query.stage[0] : query.stage;

  // Nothing published for this sport yet. A 404 rather than an empty shell: an
  // empty pathway is worse than none, and it keeps a thin page out of the index.
  if (!guide || guide.stages.length === 0) notFound();

  const communityUrl = getCommunityAppUrl();

  return (
    <main className="overflow-x-clip">
      {/* Only on the canonical URL — a `?state=` view is the same article with a
          different overlay, and Article schema per state would offer Google a
          near-identical "article" for every state in India. */}
      {!chosenState && (
        <JsonLd
          data={[
            articleJsonLd({
              headline: `${guide.sportName} pathway in India — a parent's guide`,
              path: `/roadmap/${guide.sportSlug}`,
              description:
                guide.intro.description ??
                `Every stage of ${guide.sportName} for Indian parents.`,
              ...(guide.updatedAt ? { dateModified: guide.updatedAt } : {}),
              section: guide.sportName,
              keywords: [
                `${guide.sportName} pathway India`,
                `${guide.sportName} for kids India`,
                `how to start ${guide.sportName} in India`,
              ],
            }),
          ]}
        />
      )}

      {/* ── Header ── */}
      <section className="pt-10 sm:pt-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Link
            href="/roadmap"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-power-orange"
          >
            <ChevronLeft className="h-4 w-4" />
            All sports
          </Link>

          <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3">
                <SectionLabel
                  label={
                    guide.intro.eyebrow ?? `${guide.sportName} pathway · for parents`
                  }
                  color="orange"
                />
              </div>
              <h1 className="font-title text-3xl font-bold text-slate-900 sm:text-4xl md:text-5xl">
                {guide.intro.headline ??
                  "Understand. Question. Observe. Decide. Act."}
              </h1>
              {guide.intro.description && (
                <p className="mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
                  {guide.intro.description}
                </p>
              )}
            </div>

            {guide.sportIntro.length > 0 && (
              <aside className="w-full rounded-2xl border border-white/70 bg-white/80 p-5 backdrop-blur-sm premium-shadow lg:max-w-sm">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  About {guide.sportName}
                </p>
                <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-600">
                  {guide.sportIntro.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </aside>
            )}
          </div>
        </div>
      </section>

      {/* ── The pathway ── */}
      <section className="py-8 sm:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <PathwayReader
            guide={guide}
            initialStageKey={stageParam?.trim().toLowerCase()}
          />
          {guide.reviewedOn && (
            <p className="mt-4 text-xs text-slate-400">{guide.reviewedOn}</p>
          )}
        </div>
      </section>

      <PathwayStatsBanner />
      <PathwayHelpSection />

      <CTA
        variant="gradient"
        title="Ready to Support Their Dream?"
        description="Find the right coach, book the right ground, and get a smart plan that shows exactly how to help your child grow in sports."
        primaryCTA={{ label: "Get Guidance", href: "/guidance" }}
        secondaryCTA={{ label: "Join Parent Community", href: communityUrl }}
      />
    </main>
  );
}
