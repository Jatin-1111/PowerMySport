import {
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  Compass,
  MessageSquare,
  Newspaper,
  ShieldCheck,
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
  title: "Youth Sports Community for Parents",
  description:
    "A parent-first youth sports community. Find vetted coaches and trusted venues, ask questions, read real parent experiences, and get AI guidance to choose the right next step for your child.",
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
    description: "Parents in your neighbourhood. Connect & learn.",
    href: "/discover",
    cta: "Open Discover",
    icon: Compass,
  },
  {
    title: "Knowledge",
    description: "Real experiences from parents, on the things you are deciding.",
    href: "/experiences",
    cta: "Read experiences",
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

const SAFETY_POINTS = [
  { icon: ShieldCheck, text: "Strict moderation to keep discussions helpful and respectful." },
  { icon: BadgeCheck, text: "Expert responses are clearly badged, so you know who is answering." },
  { icon: BrainCircuit, text: "AI synthesis summarises long debates into a few clear takeaways." },
];

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  /** Optional: a section whose heading already names it does not need a
   *  kicker repeating the same words above it. */
  eyebrow?: string;
  title: string;
  description: string;
}) {
  return (
    <div className="max-w-3xl">
      {eyebrow ? <p className="text-ink-muted mb-3 text-sm font-medium">{eyebrow}</p> : null}
      <h2 className="font-editorial text-ink text-balance text-4xl font-light leading-[1.08] sm:text-5xl">
        {title}
      </h2>
      <p className="text-ink-body mt-4 max-w-[56ch] text-pretty text-base leading-relaxed sm:text-lg">
        {description}
      </p>
    </div>
  );
}

/** A ruled row, not a card: hairline above, serif title, link that underlines
 *  solid on hover. The three entry points read as a list of places to go. */
function ValuePropRow({ title, description, href, cta, icon: Icon }: ValueProp) {
  return (
    <Link
      href={href}
      className="border-hairline hover:border-ink group flex h-full flex-col border-t pt-6 transition-colors duration-200"
    >
      <Icon className="text-ink h-6 w-6" strokeWidth={1.5} aria-hidden />
      <h3 className="font-editorial text-ink mt-6 text-balance text-2xl font-normal leading-tight">
        {title}
      </h3>
      <p className="text-ink-body mt-3 max-w-[40ch] text-pretty text-base leading-relaxed">
        {description}
      </p>
      {/* mt-auto pins the link to the bottom so a longer description cannot
          push it out of line with its neighbours. */}
      <span className="text-ink decoration-ink/30 group-hover:decoration-ink mt-auto inline-flex items-center gap-1.5 pt-6 text-base font-semibold underline underline-offset-4 transition-colors duration-200">
        {cta}
        <ArrowRight
          className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>
    </Link>
  );
}

export default function CommunityLandingPage() {
  return (
    <div className="bg-paper flex min-h-full flex-col overflow-x-hidden">
      <JsonLd data={[organizationSchema, websiteSchema]} />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8">
          <section className="bg-ink relative isolate overflow-hidden rounded-3xl">
            {/* Hero photograph. `priority` because this is the largest element
                above the fold on the landing page; lazy-loading it would show
                a bare dark panel first and hurt LCP. */}
            {/* Imported rather than referenced as "/hero.png": with basePath
                set, next/image prefixes the optimizer route but NOT its `url`
                param, so a public/ path resolves against the wrong root and
                the optimizer answers 400 "not a valid image". A static import
                also gets a content-hashed filename, so this can be cached
                immutably. The 2.2MB PNG never reaches a browser; the
                optimizer re-encodes it to ~103KB of WebP. */}
            <Image
              src={heroImage}
              alt=""
              aria-hidden
              fill
              priority
              sizes="(min-width: 1280px) 1216px, 100vw"
              // Portrait below md shows only the central 35% of the width,
              // which is empty field; 88% frames the coach and the group.
              className="-z-10 object-cover object-[88%_center] saturate-[0.7] md:object-center"
            />

            {/* Overlay strength was solved against the brightest pixel behind
                each row of text (badge 11px, headline 46px, paragraph 16px,
                chips 13px) on the crop this band shows. Do not lighten it
                without re-measuring: the sun haze sits behind the top rows. */}
            <div className="bg-ink/80 pointer-events-none absolute inset-0 -z-10" />

            <div className="relative px-6 py-14 sm:px-10 sm:py-20 lg:px-16 lg:py-28">
              <div className="max-w-3xl">
                <p className="text-sm font-medium text-orange-200">
                  Parent-first youth sports community
                </p>
                <h1 className="mt-5 text-balance text-4xl font-semibold leading-[1.04] tracking-[-0.04em] text-white sm:text-5xl lg:text-[3.9rem]">
                  Learn, connect, and plan your{" "}
                  <span className="font-editorial text-[1.22em] font-light italic tracking-[-0.02em]">
                    child&apos;s sports journey.
                  </span>
                </h1>
                <p className="mt-6 max-w-[56ch] text-pretty text-base leading-7 text-white/90 sm:text-lg">
                  From choosing the right academy or coach to planning tournaments, exploring
                  scholarships and careers, learn from parents who have already walked the path, and
                  share your own experience to help the next family.
                </p>

                <div className="mt-8 max-w-xl">
                  <HeroSearch />
                </div>

                <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
                  {/* White on the photograph: `bg-power-orange` with white text
                      measures 3.03:1 and fails AA. */}
                  <Link
                    href="/questions"
                    className="btn-motion text-ink hover:bg-paper-deep inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-white px-7 py-3.5 text-base font-semibold"
                  >
                    Ask a question
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                  <Link
                    href="/discover"
                    className="inline-flex items-center gap-2 text-base font-semibold text-white underline decoration-white/40 underline-offset-4 transition-colors duration-200 hover:decoration-white"
                  >
                    Find parents near you
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>

        <section className="mx-auto w-full max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
          <SectionHeading
            title="Why join the community"
            description="Ask, read and share what you have learned about youth sport, so the next decision for your child is a better informed one."
          />
          <div className="mt-14 grid gap-x-8 gap-y-12 md:grid-cols-3">
            {valueProps.map((prop) => (
              <ValuePropRow key={prop.title} {...prop} />
            ))}
          </div>
        </section>

        <section className="bg-paper-deep">
          <div className="mx-auto grid w-full max-w-7xl gap-14 px-4 py-24 sm:px-6 sm:py-32 lg:grid-cols-12 lg:px-8">
            <div className="lg:col-span-7">
              <SectionHeading
                eyebrow="Live community hub"
                title="See what nearby parents are asking right now"
                description="A forum-style feed of local conversations, coaching tips and the questions parents keep asking before they book."
              />
              <div className="mt-10">
                <DynamicCommunityPosts />
              </div>
            </div>

            <div className="space-y-10 lg:col-span-5">
              <DynamicFeaturedQA />
              <div>
                <h3 className="font-editorial text-ink text-2xl font-normal">
                  How we keep it useful
                </h3>
                <ul className="mt-5">
                  {SAFETY_POINTS.map(({ icon: Icon, text }) => (
                    <li
                      key={text}
                      className="border-hairline text-ink-body flex items-start gap-3 border-t py-4 text-base leading-relaxed last:border-b"
                    >
                      <Icon
                        className="text-ink mt-1 h-4 w-4 shrink-0"
                        strokeWidth={1.5}
                        aria-hidden
                      />
                      <span>{text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
