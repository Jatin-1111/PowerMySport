import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  Compass,
  MessagesSquare,
  PenLine,
  Sparkles,
  Wallet,
} from "lucide-react";

import { getCommunityAppUrl } from "@/lib/community/url";
import { CTA } from "@/modules/marketing/components/marketing/CTA";
import { AmbientBlob } from "@/modules/pathway/components/AmbientBlob";
import { PathwayPicker } from "@/modules/pathway/components/PathwayPicker";
import { fetchPathwayIndex } from "@/modules/pathway/services/fetchGuide";
import { sectionDomId } from "@/modules/pathway/utils/sectionIds";

// ─── /roadmap ────────────────────────────────────────────────────────────────
//
// The index: which sports a parent can read a pathway for, and enough of what is
// inside one to make opening it obviously worth doing.
//
// A server component with no client state of its own. The old explorer was a
// 2,000-line client component that generated a pathway on demand; pathways are
// now authored and published in the CMS, so this page only lists what exists —
// the one interactive part, the picker, is a client island.
//
// ── What this page is optimised for ──
//
// Two things, in order: getting a parent *into* a pathway at the stage that is
// about their child, and — for the parent who is not ready to read one — giving
// them a next move that is not "leave".
//
// Three things carry most of that, and the ordering of the page is the third:
//
//   1. The picker is search-first, and once the child's age is known (asked for
//      inside a pathway, never here) each sport points at their stage.
//   2. A band of real, already-answered parent questions links straight into the
//      stage that answers each one. The index used to describe the content in
//      the abstract ("Your questions: what am I worried about?"); a parent
//      cannot tell from that whether their own worry is in there.
//   3. Everything a parent can act on comes before everything that explains why
//      the page exists. The generic stats banner and the two-card "how we help"
//      block used to sit between the sport list and the footer CTA, which meant
//      three marketing blocks in a row and a long scroll past content nobody
//      came here for. Both still run on `/roadmap/[sport]`, where a reader who
//      finished a pathway has actually earned the pitch; here they are replaced
//      by one band of concrete next steps.
//
// ── On the layout ──
//
// Four sections and a closer, each with one job, alternating between the page's
// own washed background and a flat white band so the boundaries are legible
// without a rule across the screen. Section chrome — eyebrow, heading, standfirst
// — goes through `SectionHead`, and every raised surface through `SURFACE`,
// because the previous pass had five sections inventing their own heading sizes
// and six different card borders. Consistency is most of what reads as "designed".
//
// `overflow-x-clip` on <main>, not `overflow-x-hidden`: hiding one axis promotes
// the other to `auto`, which makes this a scroll container and silently breaks
// `position: sticky` for every descendant on the page.

/** Every raised card on this page. One definition, so they cannot drift apart. */
const SURFACE =
  "rounded-2xl border border-white/70 bg-white/80 backdrop-blur-sm premium-shadow";

/** The same, plus the lift that marks a card as a link. */
const SURFACE_LINK = `${SURFACE} transition duration-300 hover:-translate-y-0.5 hover:border-power-orange/40 hover:shadow-lg`;

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
    icon: Compass,
    title: "Not sure which sport yet?",
    body: "Answer a few questions about your child and get a shortlist of sports worth trying, with what a first trial looks like.",
    href: "/assessment",
    cta: "Find their sport",
    tone: "text-power-orange bg-orange-100",
  },
  {
    icon: CalendarCheck,
    title: "Know the sport, need a plan?",
    body: "Get a plan built around your child's age, level and what you're aiming at — training, competitions and the decisions in between.",
    href: "/guidance",
    cta: "Get guidance",
    tone: "text-emerald-600 bg-emerald-100",
  },
  {
    icon: MessagesSquare,
    title: "Want to ask a person?",
    body: "Book time with a verified expert who has been through this — a coach, an ex-player, someone who has taken a child down this road.",
    href: "/experts",
    cta: "Speak with an expert",
    tone: "text-indigo-600 bg-indigo-100",
  },
];

/** Shared section chrome, so five sections cannot each invent their own scale. */
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
    <div className="mx-auto max-w-2xl text-center">
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-power-orange">
        {eyebrow}
      </p>
      <h2 className="font-title mt-2.5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
        {title}
      </h2>
      {children && (
        <p className="mx-auto mt-3 text-[15px] leading-relaxed text-slate-600 sm:text-base">
          {children}
        </p>
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
      {/* ── Hero + picker ──
          One section, deliberately. They were two, and the gap between them
          pushed the only thing a parent can actually click below the fold on a
          laptop: a page whose job is "pick your sport" opened with no sport in
          sight. */}
      <section className="relative pb-14 pt-14 sm:pb-16 sm:pt-20">
        <AmbientBlob className="-right-24 -top-10 h-80 w-80 bg-orange-100/50" />
        <AmbientBlob className="-left-28 top-40 h-72 w-72 bg-emerald-100/40" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* No eyebrow badge: "Sports Pathways" restated the headline a line
              above it, and cost a row to do it. */}
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="font-title text-[2rem] font-bold leading-[1.1] tracking-[-0.02em] text-slate-900 sm:text-5xl lg:text-[3.5rem]">
              Starting a sport is easy.
              {/* The turn is the whole headline, so it gets its own line rather
                  than wrapping wherever the viewport happens to break it. */}
              <span className="mt-1 block text-slate-400">
                Navigating the journey is not.
              </span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              Coaches, academies, competitions, costs, education — the answers
              are scattered everywhere. We put them in one place, stage by stage.
            </p>
          </div>

          <PathwayPicker entries={sports} />

          {/* ── Credibility, in one row ──
              This was a four-card stats banner of its own, most of the way down
              the page, saying "6 stages / 5 questions / Built with coaches / ₹0".
              Two of those are facts the page itself demonstrates, and none of
              them were worth a band. As a single meta line under the picker they
              answer the two questions a first-time visitor actually has — who
              wrote this, and what will it cost me — in the place they ask them. */}
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12.5px] font-semibold text-slate-500">
            <li className="inline-flex items-center gap-1.5">
              <PenLine aria-hidden className="h-3.5 w-3.5 text-slate-400" />
              Written with coaches and sports parents
            </li>
            <li className="inline-flex items-center gap-1.5">
              <Wallet aria-hidden className="h-3.5 w-3.5 text-slate-400" />
              Free to read, no sign-up
            </li>
            {updated && (
              <li className="inline-flex items-center gap-1.5">
                <Sparkles aria-hidden className="h-3.5 w-3.5 text-slate-400" />
                Last updated {updated}
              </li>
            )}
          </ul>
        </div>
      </section>

      {/* ── Real questions ──
          Proof, in the parent's own words, placed where a visitor decides
          whether this page is a brochure. Each one is a link into the stage that
          answers it, so scanning for your own worry and reading the answer is a
          single click rather than a sport, a stage and a section. */}
      {questions.length > 0 && (
        <section className="reveal-on-scroll border-y border-white/60 bg-white/50 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <SectionHead
              eyebrow="Straight to the answer"
              title="Questions other parents already asked"
            >
              Answered inside the pathway, at the stage they come up. Open one
              and you land on the answer.
            </SectionHead>

            {/* Three columns at nine questions — two would run to five rows and
                turn a scan into a scroll. */}
            <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {questions.map((item) => (
                <li key={`${item.sportSlug}-${item.question}`}>
                  <Link
                    // `?stage=` is read on the server, so this renders the right
                    // stage in the HTML; the hash then scrolls to the questions
                    // section within it. Both work without JavaScript.
                    href={`/roadmap/${item.sportSlug}?stage=${encodeURIComponent(
                      item.stageKey,
                    )}#${sectionDomId("questions")}`}
                    className={`group flex h-full flex-col justify-between gap-3 p-4 ${SURFACE_LINK}`}
                  >
                    <span className="text-[15px] font-bold leading-snug text-slate-900 transition group-hover:text-power-orange">
                      {item.question}
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[12px] font-semibold uppercase tracking-wider text-slate-400">
                        {item.sportName} · {item.stageName}
                      </span>
                      <ArrowRight
                        aria-hidden
                        className="h-4 w-4 shrink-0 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-power-orange"
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
          The shape of the content, and the argument for reading it, in one
          section rather than two. They were separate bands stacked back to back,
          which made the page feel like a list of blocks; the five buckets are
          the *what* and the two paragraphs below are the *why*, and reading them
          together is how the shape actually lands. */}
      <section className="reveal-on-scroll py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHead
            eyebrow="The same shape, every time"
            title="Every stage answers the same five questions"
          >
            Learn the shape once and it never moves again — whatever the sport,
            whatever your child&apos;s age.
          </SectionHead>

          {/* The rail behind the numbers turns five boxes into one sequence.
              Decorative and desktop-only: on a phone the cards already stack in
              reading order and a vertical line would just be another thing to
              draw. */}
          <div className="relative mx-auto mt-10 max-w-5xl">
            <div
              aria-hidden
              className="absolute inset-x-8 top-[1.4rem] hidden h-px bg-gradient-to-r from-transparent via-slate-300/70 to-transparent lg:block"
            />
            <ol className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:gap-3">
              {BUCKETS.map((bucket) => (
                <li key={bucket.n} className="flex h-full flex-col">
                  <span className="font-title mb-3 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/80 bg-white text-[13px] font-extrabold text-power-orange shadow-sm">
                    {bucket.n}
                  </span>
                  <p className="font-title text-[15px] font-bold text-slate-900">
                    {bucket.title}
                  </p>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-slate-600">
                    {bucket.body}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          {/* ── The argument, in two lines each ──
              This was two cards of six and three sentences. Nobody was reading
              them: they sat below a five-step diagram that had already made the
              point, and a wall of body copy in a card reads as terms and
              conditions. Both are now the one sentence each was actually for,
              and they have lost the card chrome with it — a rule and a heading
              is enough to mark a statement, and it stops this reading as a third
              row of clickable things in a section where nothing is clickable. */}
          <div className="mx-auto mt-12 grid max-w-4xl gap-8 sm:grid-cols-2 sm:gap-10">
            <div>
              <span
                aria-hidden
                className="block h-0.5 w-8 rounded-full bg-power-orange"
              />
              <h3 className="font-title mt-4 text-[17px] font-bold text-slate-900">
                Why sport matters
              </h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600">
                There is no single right way to start. Some children find their
                sport by playing, others need guiding to it — what matters is
                choosing with your eyes open.
              </p>
            </div>
            <div>
              <span
                aria-hidden
                className="block h-0.5 w-8 rounded-full bg-emerald-500"
              />
              <h3 className="font-title mt-4 text-[17px] font-bold text-slate-900">
                Why the journey matters
              </h3>
              <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600">
                The hard part is not information, it is finding the right
                information at the right time. Every pathway is written with
                coaches, experts and parents who have already walked it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Next steps ──
          For the parent whose sport is not published yet, or who does not want
          to read six stages tonight. One band, three concrete routes, each
          naming what it actually does — this replaces the generic stats banner
          and the "PowerMySport helps you grow faster" pair, which between them
          asked for a long scroll and offered no specific action. */}
      <section className="reveal-on-scroll relative overflow-hidden border-y border-white/60 bg-white/50 py-16 sm:py-20">
        <AmbientBlob className="-right-24 top-10 h-72 w-72 bg-orange-100/40" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHead
            eyebrow="If reading isn't enough"
            title="Your sport isn't here yet, or you want more than reading?"
          >
            Three ways to get an answer today.
          </SectionHead>

          <ul className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-3">
            {NEXT_STEPS.map(({ icon: Icon, ...step }) => (
              <li key={step.href} className="h-full">
                <Link
                  href={step.href}
                  className={`group flex h-full flex-col p-6 sm:p-7 ${SURFACE_LINK}`}
                >
                  <span
                    className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110 ${step.tone}`}
                  >
                    <Icon aria-hidden className="h-5 w-5" />
                  </span>
                  <span className="font-title text-[17px] font-bold leading-snug text-slate-900">
                    {step.title}
                  </span>
                  <span className="mt-2.5 flex-1 text-[14px] leading-relaxed text-slate-600">
                    {step.body}
                  </span>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-[13.5px] font-bold text-power-orange">
                    {step.cta}
                    <ArrowRight
                      aria-hidden
                      className="h-4 w-4 transition group-hover:translate-x-0.5"
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* The closer is the community, not guidance: guidance already has a card
          of its own three inches up, and the thing most likely to bring a parent
          back is other parents. */}
      <CTA
        variant="gradient"
        title="You are not the first parent doing this"
        description="Thousands of Indian sports parents comparing academies, coaches, costs and competitions — ask the question you have not found an answer to yet."
        primaryCTA={{ label: "Join Parent Community", href: communityUrl }}
        secondaryCTA={{ label: "Get Guidance", href: "/guidance" }}
      />
    </main>
  );
}
