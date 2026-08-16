import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { getCommunityAppUrl } from "@/lib/community/url";
import { CTA } from "@/modules/marketing/components/marketing/CTA";
import { AmbientBlob } from "@/modules/pathway/components/AmbientBlob";
import {
  PathwayHelpSection,
  PathwayStatsBanner,
} from "@/modules/pathway/components/PathwaySections";
import { fetchPublishedPathways } from "@/modules/pathway/fetchGuide";

// ─── /roadmap ────────────────────────────────────────────────────────────────
//
// The index: why the journey is worth understanding, the five questions every
// stage answers, and the sports whose pathway a parent can read today.
//
// A server component with no client state. The old explorer was a 2,000-line
// client component that generated a pathway on demand; pathways are now authored
// and published in the CMS, so this page only has to list what exists.
//
// `overflow-x-clip` on <main>, not `overflow-x-hidden`: hiding one axis promotes
// the other to `auto`, which makes this a scroll container and silently breaks
// `position: sticky` for every descendant on the page.

const BUCKETS = [
  { n: "01", title: "Overview", body: "Where am I and what does this stage mean?" },
  {
    n: "02",
    title: "Your questions",
    body: "What am I likely to be worried or confused about?",
  },
  {
    n: "03",
    title: "What to look for",
    body: "What should I observe in my child, coach and environment?",
  },
  { n: "04", title: "Decisions", body: "What choices may I need to make?" },
  { n: "05", title: "Next step", body: "What should I actually do now?" },
];

export default async function PathwaysIndexPage() {
  const pathways = await fetchPublishedPathways();
  const communityUrl = getCommunityAppUrl();

  return (
    <main className="overflow-x-clip">
      {/* ── Hero + sport picker ──
          One section, deliberately. They were two, and the gap between them
          pushed the only thing a parent can actually click below the fold on a
          laptop: a page whose job is "pick your sport" opened with no sport in
          sight. The picker is now the first thing under the headline. */}
      <section className="relative pb-12 pt-12 sm:pt-16">
        <AmbientBlob className="-right-24 top-0 h-72 w-72 bg-orange-100/40" />
        <AmbientBlob className="-left-28 top-32 h-64 w-64 bg-emerald-100/30" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* No eyebrow badge: "Sports Pathways" restated the headline a line
              above it, and cost a row to do it. */}
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="font-title text-3xl font-bold text-slate-900 sm:text-4xl">
              Starting a sport is easy. Navigating the journey is not.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base text-slate-600 sm:text-lg">
              Coaches, academies, competitions, costs, education — the answers
              are scattered everywhere. We put them in one place, stage by stage.
            </p>
          </div>

          <div className="mt-10">
            <h2 className="text-center text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
              Choose a sport
            </h2>

            {pathways.length === 0 ? (
              <p className="mx-auto mt-4 max-w-xl text-center text-sm text-slate-600 sm:text-base">
                No pathways are published yet. We&apos;re building them with
                coaches and experienced parents, one sport at a time — check back
                shortly.
              </p>
            ) : (
              <>
                {/* Flex-wrap rather than a 3-column grid: with one published
                    sport a grid left-aligns a lone card against two empty
                    columns, which reads as a page that failed to load. This
                    centres cleanly at any count. */}
                <ul className="mt-4 flex flex-wrap justify-center gap-4">
                  {pathways.map((pathway) => (
                    <li
                      key={pathway.sportSlug}
                      className="w-full sm:w-[300px]"
                    >
                      <Link
                        href={`/roadmap/${pathway.sportSlug}`}
                        className="group flex h-full items-center gap-4 rounded-2xl border border-white/70 bg-white/80 p-5 backdrop-blur-sm premium-shadow transition hover:-translate-y-0.5 hover:border-power-orange/40 hover:shadow-lg"
                      >
                        <div className="min-w-0 flex-1 text-left">
                          <p className="font-title text-xl font-bold text-slate-900 transition group-hover:text-power-orange">
                            {pathway.sportName}
                          </p>
                          <p className="mt-0.5 text-sm text-slate-500">
                            {pathway.stageCount} stage
                            {pathway.stageCount === 1 ? "" : "s"}, first session
                            to what comes after
                          </p>
                        </div>
                        <ArrowRight className="h-5 w-5 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-power-orange" />
                      </Link>
                    </li>
                  ))}
                </ul>

                <p className="mt-4 text-center text-xs text-slate-400">
                  More sports are being written with coaches and experienced
                  parents, one at a time.
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── The five questions ──
          Now an explanation of what a parent is about to open, rather than a
          wall standing between them and the list. */}
      <section className="border-y border-white/60 bg-white/40 py-12 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 text-center">
            <h2 className="font-title text-2xl font-bold text-slate-900 sm:text-3xl">
              Every stage answers the same five questions
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-600 sm:text-base">
              Learn the shape once and it never moves again — whatever the sport,
              whatever your child&apos;s age.
            </p>
          </div>

          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {BUCKETS.map((bucket) => (
              <li
                key={bucket.n}
                className="flex h-full flex-col rounded-2xl border border-white/70 bg-white/80 p-5 backdrop-blur-sm premium-shadow"
              >
                <p className="font-title text-xs font-extrabold tracking-[0.18em] text-power-orange">
                  {bucket.n}
                </p>
                <p className="font-title mt-2 text-base font-bold text-slate-900">
                  {bucket.title}
                </p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                  {bucket.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Why this matters ──
          Below the sport picker, not above it. This is the argument for reading
          a pathway at all; a parent who came here already looking for their
          sport should not have to scroll past it to find the list. */}
      <section className="pt-12 sm:pt-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-white/70 bg-white/80 p-6 backdrop-blur-sm premium-shadow">
              <h2 className="font-title text-lg font-bold text-slate-900">
                Why sport matters
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                The foundational years are an important time for every child to
                discover movement, build confidence and find a sport they enjoy.
                Some children discover their sport simply by playing. Others need
                guidance. Some parents already know the sport they want their
                child to pursue. There is no single right way to start — what
                matters is making an informed choice and understanding the
                journey ahead.
              </p>
            </div>
            <div className="rounded-2xl border border-white/70 bg-white/80 p-6 backdrop-blur-sm premium-shadow">
              <h2 className="font-title text-lg font-bold text-slate-900">
                Why understanding the journey matters
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Finding the right information at the right time is difficult. As
                sports parents ourselves, we build sport-specific pathways with
                experienced coaches, experts and fellow parents — so you can see
                where your child is today, what comes next, and what decisions
                you may need to make along the way.
              </p>
            </div>
          </div>
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
