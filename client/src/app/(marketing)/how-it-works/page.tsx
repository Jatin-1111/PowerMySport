"use client";

import { CTA } from "@/modules/marketing/components/marketing/CTA";
import { Hero } from "@/modules/marketing/components/marketing/Hero";
import { SectionLabel } from "@/modules/marketing/components/marketing/SectionLabel";
import {
    Timeline,
    type TimelineEntry,
} from "@/modules/marketing/components/marketing/Timeline";
import { cn } from "@/utils/cn";
import { motion, Variants } from "framer-motion";
import {
    BrainCircuit,
    CalendarRange,
    CheckCircle,
    type LucideIcon,
    Map,
    Target,
    Trophy,
    UserPlus,
    Wallet,
    X,
} from "lucide-react";
import Image from "next/image";
import { useRef } from "react";

// ─── Design Tokens ────────────────────────────────────────────────────────────

const SPRING_STIFF = { type: "spring", stiffness: 260, damping: 22 } as const;
const SPRING_SOFT = { type: "spring", stiffness: 200, damping: 28 } as const;

// ─── Motion Variants ──────────────────────────────────────────────────────────

const orchestratorVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.11, delayChildren: 0.06 },
  },
};

const fadeSlideUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: SPRING_STIFF },
};

const fadeSlideLeft: Variants = {
  hidden: { opacity: 0, x: -36, scale: 0.96 },
  show: { opacity: 1, x: 0, scale: 1, transition: SPRING_SOFT },
};

const fadeSlideRight: Variants = {
  hidden: { opacity: 0, x: 36, scale: 0.96 },
  show: { opacity: 1, x: 0, scale: 1, transition: SPRING_SOFT },
};

const cardReveal: Variants = {
  hidden: { opacity: 0, y: 32, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: SPRING_STIFF },
};

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
    <motion.li
      variants={fadeSlideUp}
      className="flex items-start gap-3 text-slate-700"
    >
      <CheckCircle size={20} className={`mt-0.5 shrink-0 ${iconColor}`} />
      <span className="text-base leading-relaxed">{text}</span>
    </motion.li>
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
        className={`absolute -inset-x-5 -bottom-5 top-8 rounded-[2.5rem] bg-gradient-to-br ${backdropTint}`}
      />
      {/* Dotted accent */}
      <div
        aria-hidden
        className="absolute -right-6 -top-6 h-24 w-24 opacity-50"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(15,23,42,0.25) 1.5px, transparent 1.5px)",
          backgroundSize: "13px 13px",
        }}
      />

      <div className="relative h-[280px] w-full overflow-hidden rounded-[2rem] shadow-2xl shadow-slate-900/15 ring-1 ring-slate-900/5 sm:h-[420px] lg:h-[480px]">
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
          className="pointer-events-none absolute inset-3 rounded-[1.5rem] ring-1 ring-white/20"
        />

        {/* Step chip — glass, top-left */}
        {step !== undefined && (
          <div className="absolute left-5 top-5 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 backdrop-blur-xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/90">
              Step 0{step}
            </p>
          </div>
        )}

        {/* Floating glass overlay card */}
        <div className="absolute bottom-5 left-5 right-5 flex items-center gap-3 rounded-2xl border border-white/15 bg-white/10 px-5 py-3.5 backdrop-blur-xl transition-colors duration-300 group-hover:bg-white/15">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 text-white">
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
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="group grid items-center gap-10 lg:grid-cols-2 lg:gap-20"
    >
      {/* Copy block */}
      <motion.div
        variants={orchestratorVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-100px" }}
        className={imageRight ? "order-2 lg:order-1" : "order-2"}
      >
        <motion.h3
          variants={fadeSlideUp}
          className="mb-4 text-2xl font-bold leading-tight text-slate-900 sm:text-3xl lg:text-4xl"
        >
          {title}
        </motion.h3>
        <motion.p
          variants={fadeSlideUp}
          className="mb-8 text-lg leading-relaxed text-slate-600"
        >
          {description}
        </motion.p>
        <motion.ul variants={orchestratorVariants} className="space-y-3">
          {checkItems.map((item, i) => (
            <CheckItem key={i} text={item.text} iconColor={item.iconColor} />
          ))}
        </motion.ul>
      </motion.div>

      {/* Image frame */}
      <motion.div
        variants={imageRight ? fadeSlideRight : fadeSlideLeft}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-100px" }}
        whileHover={{ scale: 1.015, y: -4 }}
        transition={SPRING_SOFT}
        className={imageRight ? "order-1 lg:order-2" : "order-1"}
      >
        <AssetFrame {...image} step={step} />
      </motion.div>
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
    <motion.div
      variants={cardReveal}
      whileHover={{ y: -6 }}
      transition={SPRING_STIFF}
      className="group relative overflow-hidden rounded-3xl border border-slate-200/60 bg-white p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04)] will-change-transform hover:shadow-xl hover:shadow-slate-200/70 sm:p-8"
    >
      {/* Soft corner glow */}
      <div
        aria-hidden
        className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-bl ${glow} to-transparent blur-2xl opacity-70 transition-transform duration-500 group-hover:scale-125`}
      />

      <div
        className={`relative mb-5 flex h-12 w-12 items-center justify-center rounded-2xl ring-1 transition-transform duration-300 group-hover:scale-105 ${accent}`}
      >
        <Icon className="h-[22px] w-[22px]" />
      </div>
      <h3 className="relative mb-2.5 text-lg font-bold text-slate-900">
        {title}
      </h3>
      <p className="relative text-sm leading-relaxed text-slate-500 sm:text-base">
        {desc}
      </p>
    </motion.div>
  );
}

// ─── FAQ Item ────────────────────────────────────────────────────────────────

function FAQItem({ q, a }: { q: string; a: string }) {
  return (
    <motion.div
      variants={cardReveal}
      whileHover={{ y: -3 }}
      transition={SPRING_SOFT}
      className="group relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white p-7 shadow-[0_1px_2px_rgba(15,23,42,0.04)] will-change-transform hover:shadow-lg hover:shadow-slate-200/70"
    >
      {/* Accent left border stripe */}
      <div
        aria-hidden
        className="absolute bottom-0 left-0 top-0 w-1 rounded-l-2xl bg-gradient-to-b from-power-orange to-orange-300 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
      />
      <h3 className="mb-3 text-lg font-bold text-slate-900">{q}</h3>
      <p className="text-base leading-relaxed text-slate-500">{a}</p>
    </motion.div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function HowItWorksPage() {
  const playerSteps: StepRowProps[] = [
    {
      step: 1,
      stepColor: "text-power-orange",
      badgeBg: "bg-gradient-to-r from-orange-500 to-orange-400",
      title: "Tell Us About Your Child",
      description:
        "Share your child's age, sports interests, and how much time they can give each week. It takes about two minutes—no jargon, no pressure.",
      checkItems: [
        {
          text: "Simple questions, plain language",
          iconColor: "text-orange-400",
        },
        {
          text: "Add more than one child if you need to",
          iconColor: "text-orange-400",
        },
        {
          text: "Free to start—no card required",
          iconColor: "text-orange-400",
        },
      ],
      image: {
        src: "https://images.unsplash.com/photo-1622279457486-62dcc4a431d6?auto=format&fit=crop&w=1000&q=80",
        alt: "Young player mid-swing on a tennis court",
        overlayIcon: <UserPlus size={20} />,
        overlayLabel: "Your Child's Profile",
        overlayCaption: "Age, interests, time — that's all we need",
        accentColor: "from-orange-500/25",
        backdropTint: "from-orange-100/70 via-orange-50/40 to-transparent",
      },
      imageRight: true,
    },
    {
      step: 2,
      stepColor: "text-indigo-500",
      badgeBg: "bg-gradient-to-r from-blue-600 to-blue-500",
      title: "Get an AI Sports Roadmap",
      description:
        "We build a personalised roadmap for your child—which sport suits them, what to focus on first, and the milestones to aim for along the way.",
      checkItems: [
        {
          text: "Know which sport fits your child best",
          iconColor: "text-indigo-400",
        },
        {
          text: "See the time and cost it really takes",
          iconColor: "text-indigo-400",
        },
        {
          text: "Clear next steps, not vague advice",
          iconColor: "text-indigo-400",
        },
      ],
      image: {
        src: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1000&q=80",
        alt: "Athlete set at the starting blocks on a running track",
        overlayIcon: <Map size={20} />,
        overlayLabel: "AI Roadmap",
        overlayCaption: "The starting line, mapped to the finish",
        accentColor: "from-blue-500/25",
        backdropTint: "from-blue-100/60 via-indigo-50/40 to-transparent",
      },
      imageRight: false,
    },
    {
      step: 3,
      stepColor: "text-emerald-600",
      badgeBg: "bg-gradient-to-r from-emerald-600 to-emerald-400",
      title: "Get Guidance on Every Step",
      description:
        "Not sure what to do next? Lean on sports experts and our AI guide for answers built around your child's goals—so every decision feels clear.",
      checkItems: [
        {
          text: "Ask questions, get clear answers",
          iconColor: "text-emerald-400",
        },
        {
          text: "Guidance built around your child's goals",
          iconColor: "text-emerald-400",
        },
        {
          text: "Move forward with confidence, not guesswork",
          iconColor: "text-emerald-400",
        },
      ],
      image: {
        src: "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=1000&q=80",
        alt: "Coach guiding a team of young football players",
        overlayIcon: <BrainCircuit size={20} />,
        overlayLabel: "Expert Guidance",
        overlayCaption: "Real coaches. Real answers.",
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
      desc: "A match from 50+ sports based on your child's age, personality, and physical traits—with the reasons behind every pick.",
      accent: "bg-orange-50 text-power-orange ring-orange-200/60",
      glow: "from-orange-400/25",
    },
    {
      icon: CalendarRange,
      title: "Milestones that fit their age",
      desc: "What to focus on now and when to level up—because a 7-year-old and a 14-year-old need very different plans.",
      accent: "bg-blue-50 text-blue-600 ring-blue-200/60",
      glow: "from-blue-400/20",
    },
    {
      icon: Wallet,
      title: "Real costs, in rupees",
      desc: "Know what training actually costs each month before you commit—from the first trial session to serious competition.",
      accent: "bg-emerald-50 text-emerald-600 ring-emerald-200/60",
      glow: "from-emerald-400/20",
    },
    {
      icon: Trophy,
      title: "The competition ladder, mapped",
      desc: "District to state to nationals—see the real tournaments and federations on your child's path, and what it takes to get there.",
      accent: "bg-violet-50 text-violet-600 ring-violet-200/60",
      glow: "from-violet-400/20",
    },
  ];

  const faqs = [
    {
      q: "What can I use right now?",
      a: "Today you can build a personalised sports roadmap for your child and get guidance from sports experts and our AI guide. Both are free to use—no card required.",
    },
    {
      q: "Is it really free?",
      a: "Yes. Creating your child's profile, building a roadmap, and getting guidance are free. There's nothing to pay to get a clear plan for your child.",
    },
    {
      q: "When will booking and community launch?",
      a: "We're rolling out in phases. Community comes next, followed by booking coaches and venues, and then our gear shop. Build your plan now and we'll let you know the moment each one goes live.",
    },
    {
      q: "Do I need to know which sport my child should play?",
      a: "Not at all. That's exactly what the roadmap helps with. Tell us about your child's age, interests, and time, and we'll suggest sports that genuinely fit—then map out the path.",
    },
  ];

  return (
    <main className="overflow-x-hidden">
      {/* ── Hero ── */}
      <Hero
        variant="page"
        title="How It Works"
        subtitle="Getting Started"
        description="See how PowerMySport turns the confusion of youth sports into one clear, personalised plan for your child—starting today, for free."
        imageSrc="https://images.unsplash.com/photo-1594470117722-de4b9a02ebed?auto=format&fit=crop&w=2000&q=80"
        imageAlt="A floodlit cricket stadium in India packed with spectators"
      />

      {/* ── Players Journey ── */}
      <section className="relative overflow-hidden py-20 sm:py-24 lg:py-32">
        {/* Ambient blobs */}
        <AmbientBlob className="h-96 w-96 bg-orange-100/40 -left-48 top-24" />
        <AmbientBlob className="h-80 w-80 bg-indigo-100/30 -right-40 top-1/3" />
        <AmbientBlob className="h-72 w-72 bg-indigo-100/30 -left-32 bottom-1/4" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Section header */}
          <motion.div
            variants={orchestratorVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mb-12 text-center lg:mb-28"
          >
            <motion.div
              variants={fadeSlideUp}
              className="mb-5 flex justify-center"
            >
              <SectionLabel label="For Parents & Guardians" color="orange" />
            </motion.div>
            <motion.h2
              variants={fadeSlideUp}
              className="font-title mx-auto max-w-2xl text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl"
            >
              Plan Their Journey in{" "}
              <span className="relative inline-block">
                3 Simple Steps
                <span
                  aria-hidden
                  className="absolute -bottom-1 left-0 h-1 w-full rounded-full bg-gradient-to-r from-orange-400 to-orange-200"
                />
              </span>
            </motion.h2>
          </motion.div>

          {/* Step timeline: sticky step numbers + scroll-tracking beam */}
          <Timeline
            data={playerSteps.map<TimelineEntry>((step) => ({
              title: (
                <span className={cn("font-title", step.stepColor)}>
                  {step.step}
                </span>
              ),
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
            backgroundImage:
              "radial-gradient(circle, #0f172a 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <AmbientBlob className="h-96 w-96 bg-orange-100/50 -right-32 top-20" />
        <AmbientBlob className="h-72 w-72 bg-sky-100/40 -left-24 bottom-16" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={orchestratorVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mb-14 text-center"
          >
            <motion.div
              variants={fadeSlideUp}
              className="mb-5 flex justify-center"
            >
              <SectionLabel label="What You Walk Away With" color="orange" />
            </motion.div>
            <motion.h2
              variants={fadeSlideUp}
              className="font-title mx-auto max-w-xl text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl"
            >
              Not Vague Advice. A Real Plan.
            </motion.h2>
            <motion.p
              variants={fadeSlideUp}
              className="mx-auto mt-4 max-w-xl text-lg text-slate-500"
            >
              Every plan is built for your child specifically—here&apos;s what
              you&apos;ll actually have in hand after those three steps.
            </motion.p>
          </motion.div>

          <motion.div
            variants={orchestratorVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2"
          >
            {deliverables.map((d) => (
              <DeliverableCard key={d.title} {...d} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── The old way vs the clear way ── */}
      <section className="relative overflow-hidden py-20 sm:py-24 lg:py-32">
        <AmbientBlob className="h-96 w-96 bg-orange-100/40 -right-40 top-24" />
        <AmbientBlob className="h-72 w-72 bg-indigo-100/30 -left-32 bottom-16" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={orchestratorVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mb-14 text-center"
          >
            <motion.div
              variants={fadeSlideUp}
              className="mb-5 flex justify-center"
            >
              <SectionLabel label="The Difference" color="orange" />
            </motion.div>
            <motion.h2
              variants={fadeSlideUp}
              className="font-title mx-auto max-w-xl text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl"
            >
              Guesswork Out. Clarity In.
            </motion.h2>
            <motion.p
              variants={fadeSlideUp}
              className="mx-auto mt-4 max-w-xl text-lg text-slate-500"
            >
              Most parents piece it together from contradicting advice.
              Here&apos;s what changes when there&apos;s an actual plan.
            </motion.p>
          </motion.div>

          <motion.div
            variants={orchestratorVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mx-auto grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2"
          >
            {/* Old way */}
            <motion.div
              variants={cardReveal}
              className="relative overflow-hidden rounded-3xl border border-slate-200/60 bg-slate-50/80 p-7 sm:p-8"
            >
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                Without a plan
              </p>
              <h3 className="mb-6 text-xl font-bold text-slate-700">
                Figuring it out alone
              </h3>
              <ul className="space-y-4">
                {[
                  "Advice from WhatsApp groups that contradicts itself",
                  "Trial-and-error academies—fees lost with every switch",
                  "No idea what it should cost, until the bill arrives",
                  "One-size-fits-all training that ignores your child's age",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200/80 text-slate-400">
                      <X size={13} strokeWidth={2.5} />
                    </span>
                    <span className="text-base leading-relaxed text-slate-500">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </motion.div>

            {/* With PowerMySport */}
            <motion.div
              variants={cardReveal}
              className="relative overflow-hidden rounded-3xl border border-orange-200/70 bg-white p-7 shadow-xl shadow-orange-100/60 sm:p-8"
            >
              {/* Corner glow */}
              <div
                aria-hidden
                className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gradient-to-bl from-orange-400/20 to-transparent blur-2xl"
              />
              <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.16em] text-power-orange">
                With PowerMySport
              </p>
              <h3 className="mb-6 text-xl font-bold text-slate-900">
                One clear plan, from day one
              </h3>
              <ul className="space-y-4">
                {[
                  "One assessment, a data-backed sport match",
                  "A roadmap built for your child's age and goals",
                  "Costs in rupees upfront—before you commit to anything",
                  "Experts and real parents to lean on at every step",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/70">
                      <CheckCircle size={13} strokeWidth={2.5} />
                    </span>
                    <span className="text-base leading-relaxed text-slate-700">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
              <a
                href="/assessment"
                className="group mt-7 inline-flex items-center gap-1.5 text-sm font-bold text-power-orange transition-colors hover:text-orange-600"
              >
                Start free — it takes 10 minutes
                <span className="transition-transform duration-200 group-hover:translate-x-0.5">
                  →
                </span>
              </a>
            </motion.div>
          </motion.div>
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
        <AmbientBlob className="h-80 w-80 bg-indigo-100/40 -right-24 top-16" />

        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={orchestratorVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mb-12 text-center"
          >
            <motion.div
              variants={fadeSlideUp}
              className="mb-5 flex justify-center"
            >
              <SectionLabel label="Common Questions" color="slate" />
            </motion.div>
            <motion.h2
              variants={fadeSlideUp}
              className="font-title text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl"
            >
              Frequently Asked Questions
            </motion.h2>
          </motion.div>

          <motion.div
            variants={orchestratorVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="space-y-4"
          >
            {faqs.map((faq, i) => (
              <FAQItem key={i} q={faq.q} a={faq.a} />
            ))}
          </motion.div>
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
