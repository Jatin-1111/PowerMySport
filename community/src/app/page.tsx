import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  Compass,
  MessageSquare,
  MessageSquareQuote,
  Newspaper,
  ShieldCheck,
  Users,
} from "lucide-react";
import Image from "next/image";
import heroImage from "../../public/hero.png";
import Link from "next/link";
import { HeroSearch } from "@/modules/community/components/page/HeroSearch";
import DynamicCommunityPosts from "@/modules/community/components/page/home/DynamicCommunityPosts";
import DynamicFeaturedQA from "@/modules/community/components/page/home/DynamicFeaturedQA";
import {
  JsonLd,
  organizationSchema,
  websiteSchema,
} from "@/modules/community/components/seo/JsonLd";
import { buildMetadata } from "@/lib/seo";


export const metadata = buildMetadata({
  title: "Youth Sports Community for Parents, Players & Coaches",
  description:
    "A parent-first youth sports community. Find vetted coaches and trusted venues, ask questions, read expert blogs, and get AI guidance to choose the right next step for your child.",
  path: "/",
});

type ValueProp = {
  title: string;
  description: string;
  href: string;
  cta: string;
  icon: typeof ShieldCheck;
};

const valueProps: ValueProp[] = [
  {
    title: "Discover",
    description:
      "Parents, Players, Coaches in your neighbourhood. Connect & learn.",
    href: "/discover",
    cta: "Open Discover",
    icon: Compass,
  },
  {
    title: "Knowledge",
    description: "Read & share blogs, experiences.",
    href: "/blog",
    cta: "Read the blog",
    icon: Newspaper,
  },
  {
    title: "Questions & Answers",
    description:
      "Ask about coaching, training, gear, injuries, nutrition, or tournaments and get answers from experienced parents and experts.",
    href: "/questions",
    cta: "Browse Q&A",
    icon: MessageSquare,
  },
];

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  /** Optional: a section whose heading already names it does not need an
   *  eyebrow repeating the same words above it. */
  eyebrow?: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-3xl">
      {eyebrow ? (
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.26em] text-power-orange">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
        {title}
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-600 sm:text-base">
        {description}
      </p>
    </div>
  );
}

function ValuePropCard({
  title,
  description,
  href,
  cta,
  icon: Icon,
}: ValueProp) {
  return (
    <Link
      href={href}
      className="group flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5 transition hover:-translate-y-0.5 hover:border-power-orange/40 hover:shadow-lg hover:shadow-slate-900/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-power-orange focus-visible:ring-offset-2"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,rgba(233,115,22,0.14),rgba(245,158,11,0.16))] text-power-orange">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-balance text-lg font-semibold text-slate-900">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      {/* mt-auto pins the CTA to the card's bottom edge so a longer or shorter
          description can't shift it out of line with the sibling cards. */}
      <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-power-orange">
        {cta}
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}

export default function CommunityLandingPage() {
  return (
    <div className="flex min-h-full flex-col overflow-x-hidden">
      <JsonLd data={[organizationSchema, websiteSchema]} />
      <main className="relative isolate flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,rgba(233,115,22,0.10),transparent_34%),radial-gradient(circle_at_85%_10%,rgba(16,185,129,0.08),transparent_22%),linear-gradient(to_bottom,#f8fafc,#f1f5f9)] text-slate-900">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.85),transparent_22%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.55),transparent_18%)]" />
        <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-7 px-3 py-4 sm:px-4 sm:py-6 lg:px-6 lg:py-7">
          <section className="relative isolate overflow-hidden rounded-[2rem] border border-white/10 bg-slate-950 shadow-xl shadow-slate-900/20">
            {/* Hero photograph. `priority` because this is the largest element
                above the fold on the landing page — lazy-loading it would show
                a bare dark panel first and hurt LCP. */}
            {/* Imported rather than referenced as "/hero.png": with basePath
                set, next/image prefixes the optimizer route but NOT its `url`
                param, so a public/ path resolves against the wrong root and
                the optimizer answers 400 "not a valid image". A static import
                also gets a content-hashed filename, so this can be cached
                immutably. The 2.2MB PNG never reaches a browser — the
                optimizer re-encodes it to ~103KB of WebP. */}
            <Image
              src={heroImage}
              alt=""
              aria-hidden
              fill
              priority
              // The band is capped at max-w-7xl, so 100vw would make the
              // optimizer serve a wider file than any viewport can show.
              sizes="(min-width: 1280px) 1216px, 100vw"
              // The band is portrait below md, where object-cover shows the
              // full height and only the central 35% of the width — which is
              // empty field. Everything that carries the picture (parents at
              // the left edge, coach and children at the right) falls outside
              // it, so a phone got an empty ground and a clipped child. 88%
              // frames the coach and the group instead. The parents are lost
              // at that width; the meaning is on both edges and a focal point
              // can only choose one.
              className="-z-10 object-cover object-[88%_center] md:object-center"
            />

            {/* Overlay strength is solved, not guessed: for each row of text,
                the minimum wash that keeps the 99th-percentile brightest pixel
                behind it under the luminance its colour and size can tolerate.
                Measured on the crop this band actually shows, inside the
                centred text column rather than the full width.

                  badge     orange-200 11px  0.60 for AA, 0.76 for AAA
                  headline  white 46px       0.43
                  paragraph slate-50 16px    0.51
                  chips     slate-200 13px   0.31

                Heaviest at the top because the sun haze sits there — the
                brightest pixel in the centre column is (253,238,216), and the
                badge is the smallest text on the panel, so it sets the top
                stop. 0.80 rather than the 0.60 that AA needs buys AAA on every
                row, on both crops, for 20% of visibility in the least
                interesting part of the frame — the narrow crop below md swings
                more sun haze behind the badge, and 0.76 left it at 6.93. Lightest at the bottom, which is already the darkest part
                of the photo. The stops keep headroom over each figure so a
                different viewport crop or a re-encode cannot quietly drop a
                row below its target. */}
            <div className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-slate-950/80 via-slate-950/64 to-slate-950/48" />

            {/* Single column. The hero used to carry a three-step panel on
                the right, which competed with the headline and repeated the
                cards immediately below it. */}
            <div className="relative px-5 py-9 sm:px-7 sm:py-12 lg:px-9 lg:py-16">
              <div className="mx-auto max-w-3xl text-center">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-orange-200 backdrop-blur">
                  <Users className="h-3.5 w-3.5" />
                  Parent-first youth sports community
                </span>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white drop-shadow-sm sm:text-4xl lg:text-[2.9rem] lg:leading-[1.08]">
                  Learn, connect, and plan your{" "}
                  <span className="bg-[linear-gradient(100deg,#FB923C,#FCD34D)] bg-clip-text text-transparent">
                    child&apos;s sports journey.
                  </span>
                </h1>
                <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-7 text-slate-50 sm:text-base">
                  From choosing the right academy or coach to planning
                  tournaments, exploring scholarships and careers, learn from
                  parents who have already navigated the path—and share your
                  own experiences to support the community.
                </p>

                <HeroSearch />

                <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:justify-center">
                  {/* White, not brand orange: `bg-power-orange` with white text
                      measures 3.03:1, which fails AA for 14px. White is also the
                      strongest affordance against a photograph. */}
                  <Link
                    href="/questions"
                    className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-slate-950/20 transition hover:bg-slate-100"
                  >
                    Ask a question
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </Link>
                  <Link
                    href="/discover"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/20"
                  >
                    <Compass className="h-4 w-4" />
                    Find parents near you
                  </Link>
                </div>

                <div className="mt-5 flex flex-wrap justify-center gap-x-4 gap-y-2 text-[13px] font-medium text-slate-200">
                  <span className="inline-flex items-center gap-1.5">
                    <MessageSquareQuote className="h-4 w-4 text-power-orange" />
                    Parent-to-parent advice
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <BadgeCheck className="h-4 w-4 text-emerald-600" />
                    Verified expert answers
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-sky-600" />
                    Moderated discussions
                  </span>
                </div>
              </div>

            </div>
          </section>

          <section className="space-y-6">
            <SectionHeading
              title="Why Join the Community"
              description="Engage, Learn & Share experiences on Sports. Help your child with the right guidance."
            />
            <div className="grid gap-4 md:grid-cols-3">
              {valueProps.map((prop) => (
                <ValuePropCard key={prop.title} {...prop} />
              ))}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-6 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5 sm:p-6">
              <SectionHeading
                eyebrow="Live community hub"
                title="See what nearby parents are asking right now"
                description="A forum-style feed surfaces trending local conversations, coaching tips, and the questions parents keep asking before booking."
              />
              <div className="mt-4">
                <DynamicCommunityPosts />
              </div>
            </div>

            <div className="space-y-6">
              <DynamicFeaturedQA />
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-900/5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Community safety layer
                </p>
                <div className="mt-4 grid gap-3 text-sm text-slate-600">
                  <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
                    <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-600" />
                    <span>
                      Strict moderation to ensure helpful, respectful
                      discussions.
                    </span>
                  </div>
                  <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
                    <BadgeCheck className="mt-0.5 h-4 w-4 text-power-orange" />
                    <span>
                      Expert responses are clearly badged for credibility.
                    </span>
                  </div>
                  <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-3">
                    <BrainCircuit className="mt-0.5 h-4 w-4 text-sky-600" />
                    <span>
                      AI synthesis helps summarize complex debates into clear
                      takeaways.
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
