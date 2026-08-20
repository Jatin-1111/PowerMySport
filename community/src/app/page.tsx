import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  Compass,
  MessageCircle,
  MessageSquare,
  MessageSquareQuote,
  Newspaper,
  ShieldCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { getMainAppUrl } from "@/lib/auth/redirect";
import DynamicCommunityPosts from "@/modules/community/components/page/home/DynamicCommunityPosts";
import DynamicFeaturedQA from "@/modules/community/components/page/home/DynamicFeaturedQA";
import FeatureWaitlist from "@/components/FeatureWaitlist";
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
    title: "Groups & People Near You",
    description:
      "Browse sport-wise groups and find parents, players, and coaches in your city to follow and talk to.",
    href: "/discover",
    cta: "Open Discover",
    icon: Compass,
  },
  {
    title: "Stories & Expert Advice",
    description:
      "Read coaching tips, training insights, and first-hand journeys written by coaches, parents, and players.",
    href: "/blog",
    cta: "Read the blog",
    icon: Newspaper,
  },
  {
    title: "Questions & Answers",
    description:
      "Ask about coaching, training, gear, injuries, nutrition, or tournaments and get answers from people who have been there.",
    href: "/questions",
    cta: "Browse Q&A",
    icon: MessageSquare,
  },
];

type HeroStep = {
  title: string;
  description: string;
  cta: string;
  icon: typeof ShieldCheck;
  /** Absolute for the main app, root-relative for a community route. */
  href: string;
  external?: boolean;
};

const heroSteps: HeroStep[] = [
  {
    title: "Read what others did",
    description:
      "First-hand write-ups from parents and coaches on trials, training, and picking a sport.",
    cta: "Open the blog",
    icon: Newspaper,
    href: "/blog",
  },
  {
    title: "Ask what worries you",
    description:
      "Put your question to parents and coaches who have already made the same call.",
    cta: "Go to Q&A",
    icon: MessageCircle,
    href: "/questions",
  },
  {
    title: "Then book with confidence",
    description:
      "Pick a verified coach or venue once you know what your child actually needs.",
    cta: "Browse coaches",
    icon: BadgeCheck,
    href: `${getMainAppUrl()}/coaches`,
    external: true,
  },
];

function HeroStep({ step, index }: { step: HeroStep; index: number }) {
  const { title, description, cta, icon: Icon, href, external } = step;
  const inner = (
    <>
      <span className="relative z-10 flex h-11 w-11 flex-none items-center justify-center rounded-2xl border border-slate-200 bg-white text-power-orange shadow-sm transition group-hover:border-power-orange/40">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="flex items-baseline gap-2">
          <span className="text-[11px] font-bold tabular-nums text-slate-300">
            0{index + 1}
          </span>
          <span className="text-[15px] font-semibold text-slate-900">
            {title}
          </span>
        </span>
        <span className="mt-1 block text-[13px] leading-5 text-slate-500">
          {description}
        </span>
        <span className="mt-1.5 inline-flex items-center gap-1 text-[12px] font-semibold text-power-orange">
          {cta}
          <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
        </span>
      </span>
    </>
  );

  const className =
    "group flex gap-3 rounded-2xl p-2 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-power-orange";

  return external ? (
    <a href={href} className={className}>
      {inner}
    </a>
  ) : (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-power-orange">
        {eyebrow}
      </p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
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
  const isCommunityLive = process.env.NEXT_PUBLIC_COMMUNITY_IS_LIVE !== "false";

  if (!isCommunityLive) {
    return (
      <FeatureWaitlist
        title="Community."
        subtitle={
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-power-orange to-amber-500">
            Coming Soon.
          </span>
        }
        description="Our Community platform is almost here. Get ready to connect with parents, coaches, and sports enthusiasts."
        icon={Users}
        gradientFrom="#E97316"
        gradientTo="#F59E0B"
        shadowColorClass="shadow-power-orange/30"
        buttonColorClass="bg-power-orange"
      />
    );
  }

  return (
    <div className="flex min-h-full flex-col overflow-x-hidden">
      <JsonLd data={[organizationSchema, websiteSchema]} />
      <main className="relative isolate flex-1 overflow-hidden bg-[radial-gradient(circle_at_top,rgba(233,115,22,0.10),transparent_34%),radial-gradient(circle_at_85%_10%,rgba(16,185,129,0.08),transparent_22%),linear-gradient(to_bottom,#f8fafc,#f1f5f9)] text-slate-900">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.85),transparent_22%),radial-gradient(circle_at_80%_10%,rgba(255,255,255,0.55),transparent_18%)]" />
        <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-7 px-3 py-4 sm:px-4 sm:py-6 lg:px-6 lg:py-7">
          <section className="relative overflow-hidden rounded-[2rem] border border-white/70 bg-[linear-gradient(120deg,#ffffff_0%,rgba(255,251,246,0.96)_45%,rgba(255,244,235,0.94)_100%)] shadow-xl shadow-slate-900/5">
            {/* Warm glow + faint grid: gives the panel some depth so the
                headline isn't sitting on a flat white rectangle. */}
            <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(233,115,22,0.20),transparent_65%)] blur-2xl" />
            <div className="pointer-events-none absolute -bottom-28 -left-16 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.14),transparent_65%)] blur-2xl" />
            <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(to_right,rgba(15,23,42,0.045)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.045)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(circle_at_15%_0%,black,transparent_65%)]" />

            <div className="relative grid gap-7 px-5 py-7 sm:px-7 sm:py-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-10 lg:px-9 lg:py-9">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-power-orange/25 bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-power-orange">
                  <Users className="h-3.5 w-3.5" />
                  Parent-first youth sports community
                </span>
                <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl lg:text-[2.9rem] lg:leading-[1.08]">
                  Learn, connect, and plan your{" "}
                  <span className="bg-[linear-gradient(100deg,#E97316,#F59E0B)] bg-clip-text text-transparent">
                    child&apos;s sports journey.
                  </span>
                </h1>
                <p className="mt-4 max-w-xl text-[15px] leading-7 text-slate-600 sm:text-base">
                  Before you book a coach or a venue, get the knowledge you
                  need. Ask questions, read what other parents did, and hear
                  from the people who have already been through it.
                </p>

                <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                  <Link
                    href="/questions"
                    className="group inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
                  >
                    Ask a question
                    <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                  </Link>
                  <Link
                    href="/discover"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                  >
                    <Compass className="h-4 w-4" />
                    Find parents near you
                  </Link>
                </div>

                <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-[13px] font-medium text-slate-500">
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

              <div className="rounded-[1.6rem] border border-slate-200/80 bg-white/85 p-5 shadow-lg shadow-slate-900/5 backdrop-blur">
                <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-400">
                  How parents use PowerMySport
                </p>
                <ol className="mt-4 space-y-1">
                  {heroSteps.map((step, index) => (
                    <li key={step.title} className="relative">
                      {index < heroSteps.length - 1 && (
                        <span
                          aria-hidden
                          className="absolute left-[1.35rem] top-11 h-[calc(100%-1.75rem)] w-px bg-gradient-to-b from-slate-200 to-transparent"
                        />
                      )}
                      <HeroStep step={step} index={index} />
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </section>

          <section className="space-y-6">
            <SectionHeading
              eyebrow="Why join the community"
              title="Three ways to get answers before you commit"
              description="Find the people going through the same thing, read what coaches and parents have written, or just ask your question outright."
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
