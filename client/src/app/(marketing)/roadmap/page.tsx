import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { JsonLd } from "@/components/seo/JsonLd";
import { getCommunityAppUrl } from "@/lib/community/url";
import { itemListJsonLd } from "@/lib/seo";
import { CTA } from "@/modules/marketing/components/marketing/CTA";
import { PathwayPicker } from "@/modules/pathway/components/PathwayPicker";
import { fetchPathwayIndex } from "@/modules/pathway/services/fetchGuide";
import { sectionDomId } from "@/modules/pathway/utils/sectionIds";
import { PageHeader } from "@/modules/shared/ui/PageHeader";

// ─── /roadmap ────────────────────────────────────────────────────────────────
//
// The index: which sports a parent can read a pathway for, and enough of what is
// inside one to make opening it obviously worth doing.
//
// A server component with no client state of its own. Pathways are authored and
// published in the CMS, so this page only lists what exists; the one interactive
// part, the picker, is a client island.
//
// ── What the page is optimised for ──
//
// Getting a parent *into* a pathway at the stage that is about their child, and,
// for the parent who is not ready to read one, giving them a next move that is not
// "leave". So everything a parent can act on (the picker, real already-answered
// questions, concrete next steps) comes before anything that explains why the page
// exists, and the explanation is one short strip, not a band.
//
// ── On the layout ──
//
// Sections alternate paper and deeper cream, and are ruled with hairlines rather
// than boxed: rows, not cards. Section chrome goes through `SectionHead` so no
// section invents its own heading scale.
//
// `overflow-x-clip` on <main>, not `overflow-x-hidden`: hiding one axis promotes
// the other to `auto`, which makes this a scroll container and silently breaks
// `position: sticky` for every descendant on the page.

const BUCKETS = [
  { n: "01", title: "Overview", body: "Where am I, and what does this stage mean?" },
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

const NEXT_STEPS = [
  {
    title: "Not sure which sport yet?",
    body: "Answer a few questions about your child and get a shortlist of sports worth trying, with what a first trial looks like.",
    href: "/assessment",
    cta: "Find their sport",
  },
  {
    title: "Know the sport, need a plan?",
    body: "Get a plan built around your child's age, level and what you're aiming at: training, competitions and the decisions in between.",
    href: "/guidance",
    cta: "Talk to PMS",
  },
  {
    title: "Want to speak to an expert?",
    body: "Book time with a verified expert who has been through this: a coach, an ex-player, someone who has taken a child down this road.",
    href: "/booking?tab=experts",
    cta: "Connect with an expert",
  },
];

const ROW_LINK =
  "group hover:bg-paper-deep/60 focus-visible:ring-ink block transition-colors focus-visible:outline-none focus-visible:ring-2";

/** Shared section chrome, so no section invents its own heading scale. */
function SectionHead({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="max-w-2xl">
      <p className="text-ink-muted text-sm">{eyebrow}</p>
      <h2 className="font-editorial text-ink mt-2 text-balance text-3xl font-light tracking-tight sm:text-4xl">
        {title}
      </h2>
      {children && (
        <p className="text-ink-body mt-3 max-w-prose text-pretty leading-relaxed">{children}</p>
      )}
    </div>
  );
}

/** "August 2026" from the most recently edited pathway, or nothing. */
function lastUpdatedLabel(dates: Array<string | undefined>): string | null {
  const times = dates
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((time) => Number.isFinite(time));
  if (times.length === 0) return null;
  return new Date(Math.max(...times)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

export default async function PathwaysIndexPage() {
  const { sports, questions } = await fetchPathwayIndex();
  const communityUrl = getCommunityAppUrl();
  const updated = lastUpdatedLabel(sports.map((sport) => sport.updatedAt));

  return (
    <main className="overflow-x-clip">
      {sports.length > 0 && (
        <JsonLd
          data={itemListJsonLd({
            name: "Sport pathways for parents in India",
            path: "/roadmap",
            items: sports.map((sport) => ({
              name: `${sport.sportName} pathway`,
              path: `/roadmap/${sport.sportSlug}`,
            })),
          })}
        />
      )}
      {/* ── Hero and picker ──
          One section, deliberately: a page whose job is "pick your sport" must show
          a sport before the fold. */}
      <PageHeader
        align="center"
        width="7xl"
        title={
          <>
            Starting a sport is easy.
            {/* The turn is the whole headline, so it gets its own line. */}
            <span className="mt-1 block italic">Navigating the journey is not.</span>
          </>
        }
        description="Coaches, academies, competitions, costs, education. The answers are scattered everywhere. We put them in one place, stage by stage."
      >
        <PathwayPicker entries={sports} />

        <ul className="text-ink-muted mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          <li>Written with coaches and sports parents</li>
          <li>Free to read, no sign-up</li>
          {updated && <li>Last updated {updated}</li>}
        </ul>
      </PageHeader>

      {/* ── Real questions ──
          Proof, in parents' own words, each a link into the stage that answers it, so
          scanning for your own worry and reading the answer is one click. */}
      {questions.length > 0 && (
        <section className="bg-paper-deep py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHead
              eyebrow="Straight to the answer"
              title="Questions other parents already asked"
            >
              Answered inside the pathway, at the stage they come up. Open one and you land on the
              answer.
            </SectionHead>

            <ul className="divide-hairline border-hairline mt-10 grid divide-y border-y lg:grid-cols-2 lg:divide-y-0">
              {questions.map((item, index) => (
                <li
                  key={`${item.sportSlug}-${item.question}`}
                  className={`border-hairline lg:border-b ${index % 2 === 0 ? "lg:border-r" : ""}`}
                >
                  <Link
                    // `?stage=` is read on the server, so this renders the right stage in
                    // the HTML; the hash then scrolls to the questions section within it.
                    href={`/roadmap/${item.sportSlug}?stage=${encodeURIComponent(
                      item.stageKey
                    )}#${sectionDomId("questions")}`}
                    className={`${ROW_LINK} px-1 py-5 lg:px-6`}
                  >
                    <span className="text-ink block text-lg leading-snug group-hover:underline group-hover:underline-offset-4">
                      {item.question}
                    </span>
                    <span className="text-ink-muted mt-2 flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">
                        {item.sportName} · {item.stageName}
                      </span>
                      <ArrowRight
                        aria-hidden
                        className="text-ink h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5"
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ── What a pathway is ──
          The shape of the content in one ruled strip: the same five questions at
          every stage, whatever the sport. */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHead
            eyebrow="The same shape, every time"
            title="Every stage answers the same five questions"
          >
            Learn the shape once and it never moves again, whatever the sport, whatever your
            child&apos;s age.
          </SectionHead>

          <ol className="divide-hairline border-hairline mt-10 grid divide-y border-y sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5 lg:divide-x">
            {BUCKETS.map((bucket) => (
              <li key={bucket.n} className="px-1 py-6 lg:px-6 lg:first:pl-1">
                <span className="text-ink-muted text-sm tabular-nums">{bucket.n}</span>
                <p className="font-editorial text-ink mt-2 text-2xl font-light tracking-tight">
                  {bucket.title}
                </p>
                <p className="text-ink-body mt-2 text-pretty text-sm leading-relaxed">
                  {bucket.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Next steps ──
          For the parent whose sport is not published yet, or who does not want to read
          six stages tonight: three concrete routes, each naming what it does. */}
      <section className="bg-paper-deep py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHead
            eyebrow="If reading isn't enough"
            title="Your sport isn't here yet, or you want more than reading?"
          >
            Three ways to get an answer today.
          </SectionHead>

          <ul className="divide-hairline border-hairline mt-10 grid divide-y border-y md:grid-cols-3 md:divide-x md:divide-y-0">
            {NEXT_STEPS.map((step) => (
              <li key={step.href}>
                <Link
                  href={step.href}
                  className={`${ROW_LINK} flex h-full flex-col px-1 py-8 md:px-8 md:first:pl-1`}
                >
                  <span className="font-editorial text-ink text-2xl font-light leading-snug tracking-tight">
                    {step.title}
                  </span>
                  <span className="text-ink-body mt-3 flex-1 text-pretty text-sm leading-relaxed">
                    {step.body}
                  </span>
                  <span className="text-ink mt-6 inline-flex items-center gap-1.5 text-sm font-medium group-hover:underline group-hover:underline-offset-4">
                    {step.cta}
                    <ArrowRight
                      aria-hidden
                      className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* The closer is the community, not guidance: guidance already has a card of its
          own above, and the thing most likely to bring a parent back is other parents. */}
      <CTA
        title="You are not the first parent doing this"
        description="Thousands of Indian sports parents comparing academies, coaches, costs and competitions. Ask the question you have not found an answer to yet."
        primaryCTA={{ label: "Join parent community", href: communityUrl }}
        secondaryCTA={{ label: "Talk to PMS", href: "/guidance" }}
      />
    </main>
  );
}
