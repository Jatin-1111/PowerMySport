import { CTA } from "@/modules/marketing/components/marketing/CTA";
import { Hero } from "@/modules/marketing/components/marketing/Hero";
import { SectionLabel } from "@/modules/marketing/components/marketing/SectionLabel";
import { Timeline, type TimelineEntry } from "@/modules/marketing/components/marketing/Timeline";
import { cn } from "@/utils/cn";
import {
  CalendarRange,
  CheckCircle,
  type LucideIcon,
  Map,
  Target,
  Trophy,
  Users,
  Wallet,
  X,
} from "lucide-react";
import Image from "next/image";

// ─── Scroll reveal ────────────────────────────────────────────────────────────
//
// Sections reveal with the `.reveal-on-scroll` utility in globals.css rather
// than framer-motion `whileInView`. The variants this page used before left
// 43 `opacity: 0` wrappers in the server HTML, so the whole page — including
// the h1 — was painted invisible until hydration ran a frame. The CSS version
// defaults to visible and animates only where scroll-driven animations are
// supported and the reader has not asked for reduced motion.

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Floating ambient blob for atmospheric depth */
function AmbientBlob({ className }: { className: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute rounded-full blur-3xl will-change-transform ${className}`}
    />
  );
}

/** Checklist item */
function CheckItem({ text, iconColor }: { text: string; iconColor: string }) {
  return (
    <li className="flex items-start gap-3 text-slate-700">
      <CheckCircle size={20} className={`mt-0.5 shrink-0 ${iconColor}`} />
      <span className="text-base leading-relaxed">{text}</span>
    </li>
  );
}

// ─── Image Frame ──────────────────────────────────────────────────────────────

interface AssetFrameProps {
  src: string;
  alt: string;
  overlayIcon: React.ReactNode;
  overlayLabel: string;
  overlayCaption?: string;
  accentColor?: string;
  backdropTint?: string;
  step?: number;
}

function AssetFrame({
  src,
  alt,
  overlayIcon,
  overlayLabel,
  overlayCaption,
  accentColor = "from-orange-500/25",
  backdropTint = "from-orange-100/70 via-orange-50/40 to-transparent",
  step,
}: AssetFrameProps) {
  return (
    <div className="relative">
      {/* Offset tinted backdrop panel */}
      <div
        aria-hidden
        className={`absolute -inset-x-5 -bottom-5 top-8 rounded-xl bg-gradient-to-br ${backdropTint}`}
      />
      {/* Dotted accent */}
      <div
        aria-hidden
        className="absolute -right-6 -top-6 h-24 w-24 opacity-50"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(15,23,42,0.25) 1.5px, transparent 1.5px)",
          backgroundSize: "13px 13px",
        }}
      />

      <div className="relative h-[280px] w-full overflow-hidden rounded-xl shadow-2xl shadow-slate-900/15 ring-1 ring-slate-900/5 sm:h-[420px] lg:h-[480px]">
        {/* Main image */}
        <Image
          src={src}
          alt={alt}
          fill
          className="object-cover transition-transform duration-700 will-change-transform group-hover:scale-[1.04]"
          sizes="(max-width: 768px) 100vw, 50vw"
        />

        {/* Legibility gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/15 to-transparent" />

        {/* Diagonal color accent overlay */}
        <div
          aria-hidden
          className={`absolute inset-0 bg-gradient-to-br ${accentColor} via-transparent to-transparent opacity-50`}
        />

        {/* Inset hairline frame */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-3 rounded-sm ring-1 ring-white/20"
        />

        {/* Step chip — glass, top-left */}
        {step !== undefined && (
          <div className="absolute left-5 top-5 rounded-sm border border-white/20 bg-white/10 px-3.5 py-1.5 backdrop-blur-xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/90">
              Step 0{step}
            </p>
          </div>
        )}

        {/* Floating glass overlay card */}
        <div className="absolute bottom-5 left-5 right-5 flex items-center gap-3 rounded-md border border-white/15 bg-white/10 px-5 py-3.5 backdrop-blur-xl transition-colors duration-300 group-hover:bg-white/15">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white/15 text-white">
            {overlayIcon}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">{overlayLabel}</p>
            {overlayCaption && (
              <p className="truncate text-[11px] text-white/60">{overlayCaption}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Step Row ─────────────────────────────────────────────────────────────────

interface StepRowProps {
  step: number;
  stepColor: string;
  badgeBg: string;
  title: string;
  description: string;
  checkItems: { text: string; iconColor: string }[];
  image: AssetFrameProps;
  imageRight?: boolean;
}

function StepRow({
  step,
  title,
  description,
  checkItems,
  image,
  imageRight = false,
}: StepRowProps) {
  return (
    <div className="group grid items-center gap-10 lg:grid-cols-2 lg:gap-20">
      {/* Copy block */}
      <div className={`reveal-on-scroll ${imageRight ? "order-2 lg:order-1" : "order-2"}`}>
        <h3 className="mb-4 text-2xl font-bold leading-tight text-slate-900 sm:text-3xl lg:text-4xl">
          {title}
        </h3>
        <p className="mb-8 text-lg leading-relaxed text-slate-600">{description}</p>
        <ul className="space-y-3">
          {checkItems.map((item, i) => (
            <CheckItem key={i} text={item.text} iconColor={item.iconColor} />
          ))}
        </ul>
      </div>

      {/* Image frame */}
      <div
        className={`reveal-on-scroll transition-transform duration-300 hover:-translate-y-1 hover:scale-[1.015] ${imageRight ? "order-1 lg:order-2" : "order-1"}`}
      >
        <AssetFrame {...image} step={step} />
      </div>
    </div>
  );
}

// ─── Deliverable Card ─────────────────────────────────────────────────────────

function DeliverableCard({
  icon: Icon,
  title,
  desc,
  accent,
  glow,
}: {
  icon: LucideIcon;
  title: string;
  desc: string;
  accent: string;
  glow: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-slate-200/60 bg-white p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-transform duration-300 will-change-transform hover:-translate-y-1.5 hover:shadow-xl hover:shadow-slate-200/70 sm:p-8">
      {/* Soft corner glow */}
      <div
        aria-hidden
        className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-bl ${glow} to-transparent opacity-70 blur-2xl transition-transform duration-500 group-hover:scale-125`}
      />

      <div
        className={`relative mb-5 flex h-12 w-12 items-center justify-center rounded-md ring-1 transition-transform duration-300 group-hover:scale-105 ${accent}`}
      >
        <Icon className="h-[22px] w-[22px]" />
      </div>
      <h3 className="relative mb-2.5 text-lg font-bold text-slate-900">{title}</h3>
      <p className="relative text-sm leading-relaxed text-slate-500 sm:text-base">{desc}</p>
    </div>
  );
}

// ─── FAQ Item ────────────────────────────────────────────────────────────────

function FAQItem({ q, a }: { q: string; a: string }) {
  return (
    <div className="group relative overflow-hidden rounded-lg border border-slate-200/60 bg-white p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-transform duration-300 will-change-transform hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-200/70">
      {/* Accent left border stripe */}
      <div
        aria-hidden
        className="from-power-orange absolute bottom-0 left-0 top-0 w-1 rounded-l-lg bg-gradient-to-b to-orange-300 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
      <h3 className="mb-3 text-lg font-bold text-slate-900">{q}</h3>
      <p className="text-base leading-relaxed text-slate-500">{a}</p>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HowItWorksPage() {
  const playerSteps: StepRowProps[] = [
    {
      step: 1,
      stepColor: "text-power-orange",
      badgeBg: "bg-gradient-to-r from-orange-500 to-orange-400",
      title: "Roadmap: See the Whole Road",
      description:
        "Every sport we cover has a pathway guide, stage by stage and by age: what matters now, what parents usually ask, the decisions coming up, and what to actually do next.",
      checkItems: [
        {
          text: "Pathway guides for each sport, stage by stage",
          iconColor: "text-orange-400",
        },
        {
          text: "A short list of sports worth trying, if you are still choosing",
          iconColor: "text-orange-400",
        },
        {
          text: "Free to read, no card required",
          iconColor: "text-orange-400",
        },
      ],
      image: {
        src: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1000&q=80",
        alt: "Athlete set at the starting blocks on a running track",
        overlayIcon: <Map size={20} />,
        overlayLabel: "Roadmap",
        overlayCaption: "The starting line, mapped to the finish",
        accentColor: "from-orange-500/25",
        backdropTint: "from-orange-100/70 via-orange-50/40 to-transparent",
      },
      imageRight: true,
    },
    {
      step: 2,
      stepColor: "text-teal-600",
      badgeBg: "bg-gradient-to-r from-blue-600 to-blue-500",
      title: "Community: Ask Parents Who Have Done It",
      description:
        "Some questions only another parent can answer. Ask yours in the community, read the experiences families have written, and message parents directly.",
      checkItems: [
        {
          text: "Ask a question, get answers from other parents",
          iconColor: "text-teal-400",
        },
        {
          text: "Read real experiences from families a few years ahead",
          iconColor: "text-teal-400",
        },
        {
          text: "Post anonymously when a question feels personal",
          iconColor: "text-teal-400",
        },
      ],
      image: {
        src: "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1000&q=80",
        alt: "Coach guiding a team of young football players",
        overlayIcon: <Users size={20} />,
        overlayLabel: "Community",
        overlayCaption: "Parents answering parents",
        accentColor: "from-blue-500/25",
        backdropTint: "from-blue-100/60 via-cyan-50/40 to-transparent",
      },
      imageRight: false,
    },
    {
      step: 3,
      stepColor: "text-emerald-600",
      badgeBg: "bg-gradient-to-r from-emerald-600 to-emerald-400",
      title: "Execution Support: Help Doing It",
      description:
        "A plan only helps once it is carried out. Connect with an expert who has taken a child down this road, find the tournaments on your child's calendar, and understand where they stand.",
      checkItems: [
        {
          text: "Connect with a verified expert",
          iconColor: "text-emerald-400",
        },
        {
          text: "Federation calendars and the tournaments in them",
          iconColor: "text-emerald-400",
        },
        {
          text: "Rankings explained in plain language",
          iconColor: "text-emerald-400",
        },
      ],
      image: {
        src: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1000&q=80",
        alt: "Young player mid-swing on a tennis court",
        overlayIcon: <Trophy size={20} />,
        overlayLabel: "Execution Support",
        overlayCaption: "Experts, calendars and rankings",
        accentColor: "from-emerald-500/25",
        backdropTint: "from-emerald-100/60 via-teal-50/40 to-transparent",
      },
      imageRight: true,
    },
  ];

  const deliverables = [
    {
      icon: Target,
      title: "The right sport, not a guess",
      desc: "A match from 50+ sports based on your child's age, personality, and physical traits, with the reasons behind every pick.",
      accent: "bg-orange-50 text-power-orange ring-orange-200/60",
      glow: "from-orange-400/25",
    },
    {
      icon: CalendarRange,
      title: "Milestones that fit their age",
      desc: "What to focus on now and when to level up, because a 7-year-old and a 14-year-old need very different plans.",
      accent: "bg-blue-50 text-blue-600 ring-blue-200/60",
      glow: "from-blue-400/20",
    },
    {
      icon: Wallet,
      title: "Real costs, in rupees",
      desc: "Know what training actually costs each month before you commit, from the first trial session to serious competition.",
      accent: "bg-emerald-50 text-emerald-600 ring-emerald-200/60",
      glow: "from-emerald-400/20",
    },
    {
      icon: Trophy,
      title: "The competition ladder, mapped",
      desc: "District to state to nationals. See the real tournaments and federations on your child's path, and what it takes to get there.",
      accent: "bg-teal-50 text-teal-600 ring-teal-200/60",
      glow: "from-teal-400/20",
    },
  ];

  const faqs = [
    {
      q: "What can I use right now?",
      a: "Three things. The roadmap: a pathway guide for each sport we cover, stage by stage. The community: ask other parents and read their experiences. And execution support: connect with an expert, follow federation calendars and read the rankings.",
    },
    {
      q: "Is it really free?",
      a: "The roadmap, the community, federation calendars and rankings are free, with no card required. A session with an expert is booked separately, and you see what it costs before you book.",
    },
    {
      q: "What's coming next?",
      a: "Booking coaches and venues, then our gear shop. Each one ships when it is genuinely useful, and we will let you know the moment it goes live.",
    },
    {
      q: "Do I need to know which sport my child should play?",
      a: "Not at all. Tell us your child's age, interests and time, and we'll suggest a few sports worth trying. Then the pathway guide for that sport shows the road ahead.",
    },
  ];

  return (
    <main className="overflow-x-hidden">
      {/* ── Hero ── */}
      <Hero
        variant="page"
        title="How It Works"
        subtitle="Getting Started"
        description="What PowerMySport does for you today: a roadmap for your child's sport, a community of parents who have been there, and support in carrying the plan out."
        imageSrc="https://images.unsplash.com/photo-1594470117722-de4b9a02ebed?auto=format&fit=crop&w=2000&q=80"
        imageAlt="A floodlit cricket stadium in India packed with spectators"
      />

      {/* ── Players Journey ── */}
      <section className="relative overflow-hidden py-20 sm:py-24 lg:py-32">
        {/* Ambient blobs */}
        <AmbientBlob className="-left-48 top-24 h-96 w-96 bg-orange-100/40" />
        <AmbientBlob className="-right-40 top-1/3 h-80 w-80 bg-slate-200/40" />
        <AmbientBlob className="-left-32 bottom-1/4 h-72 w-72 bg-slate-200/40" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Section header */}
          <div className="reveal-on-scroll mb-12 text-center lg:mb-28">
            <div className="mb-5 flex justify-center">
              <SectionLabel label="What We Do Today" color="orange" />
            </div>
            <h2 className="font-title mx-auto max-w-2xl text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl">
              Roadmap, Community and{" "}
              <span className="relative inline-block">
                Execution Support
                <span
                  aria-hidden
                  className="absolute -bottom-1 left-0 h-1 w-full rounded-full bg-gradient-to-r from-orange-400 to-orange-200"
                />
              </span>
            </h2>
          </div>

          {/* Step timeline: sticky step numbers + scroll-tracking beam */}
          <Timeline
            data={playerSteps.map<TimelineEntry>((step) => ({
              title: <span className={cn("font-title", step.stepColor)}>{step.step}</span>,
              content: <StepRow {...step} />,
            }))}
          />
        </div>
      </section>

      {/* ── What you walk away with ── */}
      <section className="relative overflow-hidden bg-slate-50 py-20 sm:py-24 lg:py-32">
        {/* Decorative SVG grid pattern */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: "radial-gradient(circle, #0f172a 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <AmbientBlob className="-right-32 top-20 h-96 w-96 bg-orange-100/50" />
        <AmbientBlob className="-left-24 bottom-16 h-72 w-72 bg-sky-100/40" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="reveal-on-scroll mb-14 text-center">
            <div className="mb-5 flex justify-center">
              <SectionLabel label="What You Walk Away With" color="orange" />
            </div>
            <h2 className="font-title mx-auto max-w-xl text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl">
              Not Vague Advice. A Real Plan.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-500">
              Here&apos;s what you&apos;ll actually have in hand, for your child&apos;s age and
              sport.
            </p>
          </div>

          <div className="reveal-on-scroll mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2">
            {deliverables.map((d) => (
              <DeliverableCard key={d.title} {...d} />
            ))}
          </div>
        </div>
      </section>

      {/* ── The old way vs the clear way ── */}
      <section className="relative overflow-hidden py-20 sm:py-24 lg:py-32">
        <AmbientBlob className="-right-40 top-24 h-96 w-96 bg-orange-100/40" />
        <AmbientBlob className="-left-32 bottom-16 h-72 w-72 bg-slate-200/40" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="reveal-on-scroll mb-14 text-center">
            <div className="mb-5 flex justify-center">
              <SectionLabel label="The Difference" color="orange" />
            </div>
            <h2 className="font-title mx-auto max-w-xl text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl">
              Guesswork Out. Clarity In.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg text-slate-500">
              Most parents piece it together from contradicting advice. Here&apos;s what changes
              when there&apos;s an actual plan.
            </p>
          </div>

          <div className="reveal-on-scroll mx-auto grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Old way */}
            <div className="relative overflow-hidden rounded-xl border border-slate-200/60 bg-slate-50/80 p-7 sm:p-8">
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Without a plan
              </p>
              <h3 className="mb-6 text-xl font-bold text-slate-700">Figuring it out alone</h3>
              <ul className="space-y-4">
                {[
                  "Advice from WhatsApp groups that contradicts itself",
                  "Trial-and-error academies, fees lost with every switch",
                  "No idea what it should cost, until the bill arrives",
                  "One-size-fits-all training that ignores your child's age",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200/80 text-slate-400">
                      <X size={13} strokeWidth={2.5} />
                    </span>
                    <span className="text-base leading-relaxed text-slate-500">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* With PowerMySport */}
            <div className="relative overflow-hidden rounded-xl border border-orange-200/70 bg-white p-7 shadow-xl shadow-orange-100/60 sm:p-8">
              {/* Corner glow */}
              <div
                aria-hidden
                className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-bl from-orange-400/20 to-transparent blur-2xl"
              />
              <p className="text-power-orange mb-1 text-[11px] font-bold uppercase tracking-[0.16em]">
                With PowerMySport
              </p>
              <h3 className="mb-6 text-xl font-bold text-slate-900">
                One clear plan, from day one
              </h3>
              <ul className="space-y-4">
                {[
                  "One assessment, a data-backed sport match",
                  "A roadmap built for your child's age and goals",
                  "Costs in rupees upfront, before you commit to anything",
                  "Experts and real parents to lean on at every step",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/70">
                      <CheckCircle size={13} strokeWidth={2.5} />
                    </span>
                    <span className="text-base leading-relaxed text-slate-700">{item}</span>
                  </li>
                ))}
              </ul>
              <a
                href="/assessment"
                className="text-power-orange group mt-7 inline-flex items-center gap-1.5 text-sm font-bold transition-colors hover:text-orange-600"
              >
                Start free. It takes 10 minutes
                <span className="transition-transform duration-200 group-hover:translate-x-0.5">
                  →
                </span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="relative overflow-hidden bg-slate-50 py-20 sm:py-24 lg:py-32">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "linear-gradient(0deg, #0f172a 1px, transparent 1px), linear-gradient(90deg, #0f172a 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <AmbientBlob className="-right-24 top-16 h-80 w-80 bg-slate-200/50" />

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="reveal-on-scroll mb-12 text-center">
            <div className="mb-5 flex justify-center">
              <SectionLabel label="Common Questions" color="slate" />
            </div>
            <h2 className="font-title text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="reveal-on-scroll space-y-4">
            {faqs.map((faq, i) => (
              <FAQItem key={i} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <CTA
        variant="gradient"
        title="Ready to Build Your Child's Plan?"
        description="It takes a few minutes and it's completely free. Get a clear roadmap and expert guidance for your child today."
        primaryCTA={{
          label: "Build a Sports Plan",
          href: "/roadmap",
        }}
        secondaryCTA={{
          label: "Chat on WhatsApp",
          href: "https://wa.me/918968582443?text=Hi%21%20I%20found%20PowerMySport%20and%20would%20like%20to%20know%20more%20about%20sports%20guidance%20for%20my%20child.",
        }}
      />
    </main>
  );
}
