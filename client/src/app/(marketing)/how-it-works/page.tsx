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
import { BrainCircuit, CheckCircle, Map, UserPlus } from "lucide-react";
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

// ─── Clipped Image Frame Variants ─────────────────────────────────────────────

type ClipShape = "slash-right" | "slash-left" | "arch" | "rect";

const clipPaths: Record<ClipShape, string> = {
  "slash-right": "polygon(0 0, 92% 0, 100% 8%, 100% 100%, 8% 100%, 0 92%)",
  "slash-left": "polygon(8% 0, 100% 0, 100% 92%, 92% 100%, 0 100%, 0 8%)",
  arch: "polygon(0 6%, 6% 0, 94% 0, 100% 6%, 100% 94%, 94% 100%, 6% 100%, 0 94%)",
  rect: "none",
};

interface AssetFrameProps {
  src: string;
  alt: string;
  clip?: ClipShape;
  overlayIcon: React.ReactNode;
  overlayLabel: string;
  accentColor?: string;
  parallaxRef?: React.RefObject<HTMLElement>;
}

function AssetFrame({
  src,
  alt,
  clip = "rect",
  overlayIcon,
  overlayLabel,
  accentColor = "from-orange-500/30",
}: AssetFrameProps) {
  const style = clip !== "rect" ? { clipPath: clipPaths[clip] } : {};

  return (
    <div
      className="relative h-[280px] w-full overflow-hidden rounded-[2rem] shadow-2xl sm:h-[420px] lg:h-[480px]"
      style={style}
    >
      {/* Main image */}
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover transition-transform duration-700 will-change-transform group-hover:scale-105"
        sizes="(max-width: 768px) 100vw, 50vw"
      />

      {/* Gradient overlay */}
      <div
        className={`absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/20 to-transparent`}
      />

      {/* Diagonal color accent overlay */}
      <div
        aria-hidden
        className={`absolute inset-0 bg-gradient-to-br ${accentColor} via-transparent to-transparent opacity-60`}
      />

      {/* Floating glass overlay card */}
      <div className="absolute bottom-5 left-5 right-5 flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-5 py-3 backdrop-blur-xl">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white">
          {overlayIcon}
        </div>
        <p className="text-sm font-semibold text-white">{overlayLabel}</p>
      </div>

      {/* Geometric decorative corner accent */}
      <div
        aria-hidden
        className="absolute right-4 top-4 h-16 w-16 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm"
      />
      <div
        aria-hidden
        className="absolute right-9 top-9 h-6 w-6 rounded-full bg-white/20"
      />
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
        <AssetFrame {...image} />
      </motion.div>
    </div>
  );
}

// ─── Owner Card ───────────────────────────────────────────────────────────────

function OwnerStepCard({
  index,
  title,
  desc,
}: {
  index: number;
  title: string;
  desc: string;
}) {
  return (
    <motion.div
      variants={cardReveal}
      whileHover={{ y: -8, scale: 1.018 }}
      transition={SPRING_STIFF}
      className="group relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-sm will-change-transform hover:shadow-xl"
    >
      {/* Decorative geometric backdrop */}
      <div
        aria-hidden
        className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-orange-50 opacity-60 transition-transform duration-500 group-hover:scale-150"
      />
      <div
        aria-hidden
        className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-indigo-50 opacity-40 transition-transform duration-700 group-hover:scale-125"
      />

      <div className="relative mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 text-2xl font-bold text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
        {index + 1}
      </div>
      <h3 className="relative mb-3 text-xl font-bold text-slate-900">
        {title}
      </h3>
      <p className="relative text-base leading-relaxed text-slate-500">
        {desc}
      </p>
    </motion.div>
  );
}

// ─── Coach Card ───────────────────────────────────────────────────────────────

function CoachStepCard({
  index,
  title,
  desc,
}: {
  index: number;
  title: string;
  desc: string;
}) {
  return (
    <motion.div
      variants={cardReveal}
      whileHover={{ y: -8, scale: 1.02 }}
      transition={SPRING_STIFF}
      className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm will-change-transform hover:shadow-xl"
    >
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-br from-emerald-50/60 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
      />
      <div className="relative mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-xl font-bold text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-2">
        {index + 1}
      </div>
      <h3 className="relative mb-2 font-bold text-slate-900">{title}</h3>
      <p className="relative text-sm leading-relaxed text-slate-500">{desc}</p>
    </motion.div>
  );
}

// ─── FAQ Item ────────────────────────────────────────────────────────────────

function FAQItem({ q, a }: { q: string; a: string }) {
  return (
    <motion.div
      variants={cardReveal}
      whileHover={{ y: -3, scale: 1.008 }}
      transition={SPRING_SOFT}
      className="group relative overflow-hidden rounded-2xl border border-slate-100 bg-white p-7 shadow-sm will-change-transform hover:shadow-md"
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
        src: "https://images.unsplash.com/photo-1511886929837-354d827aae26?auto=format&fit=crop&w=800&q=80",
        alt: "Parent setting up their child's sports profile",
        clip: "slash-right",
        overlayIcon: <UserPlus size={20} />,
        overlayLabel: "Your Child's Profile",
        accentColor: "from-orange-500/25",
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
        src: "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=800&q=80",
        alt: "Young athletes training with a coach",
        clip: "slash-left",
        overlayIcon: <Map size={20} />,
        overlayLabel: "AI Roadmap",
        accentColor: "from-blue-500/25",
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
        src: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=800&q=80",
        alt: "Coach giving guidance to a young athlete",
        clip: "arch",
        overlayIcon: <BrainCircuit size={20} />,
        overlayLabel: "Expert Guidance",
        accentColor: "from-emerald-500/25",
      },
      imageRight: true,
    },
  ];

  const ownerSteps = [
    {
      title: "Submit Inquiry",
      desc: "Fill out our simple onboarding form with your facility details and contact information.",
    },
    {
      title: "Approval Process",
      desc: "Our team reviews your submission and reaches out within 48 hours to verify details.",
    },
    {
      title: "Get Set Up",
      desc: "Access your dashboard and add your slots, pricing, and photos—so you're ready to accept bookings the day we launch.",
    },
  ];

  const coachSteps = [
    { title: "Register", desc: "Sign up as a coach with your credentials" },
    { title: "Build Profile", desc: "Add certifications, experience, rates" },
    { title: "Set Availability", desc: "Define your schedule & service areas" },
    { title: "Be Ready", desc: "Go live with families the day bookings open" },
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

      {/* ── Venue / Academy Owners (Phase 2 early access) ── */}
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
              <SectionLabel
                label="For Venue & Academy Owners · Phase 2"
                color="blue"
              />
            </motion.div>
            <motion.h2
              variants={fadeSlideUp}
              className="font-title mx-auto max-w-xl text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl"
            >
              Get Listed Before Bookings Go Live
            </motion.h2>
            <motion.p
              variants={fadeSlideUp}
              className="mx-auto mt-4 max-w-xl text-lg text-slate-500"
            >
              Bookings launch in Phase 2. Set up your listing now so families
              can find and book you the moment we open.
            </motion.p>
          </motion.div>

          <motion.div
            variants={orchestratorVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-3"
          >
            {ownerSteps.map((step, i) => (
              <OwnerStepCard
                key={i}
                index={i}
                title={step.title}
                desc={step.desc}
              />
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={SPRING_STIFF}
            className="mt-14 text-center"
          >
            <a
              href="/register?role=VENUE_LISTER"
              className="inline-block rounded-2xl bg-slate-900 px-10 py-4 text-base font-semibold text-white shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
            >
              Register Early
            </a>
          </motion.div>
        </div>
      </section>

      {/* ── Coaches ── */}
      <section className="relative overflow-hidden py-20 sm:py-24 lg:py-32">
        <AmbientBlob className="h-96 w-96 bg-emerald-100/40 -left-40 top-20" />
        <AmbientBlob className="h-72 w-72 bg-teal-100/30 -right-32 bottom-20" />

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
              <SectionLabel label="For Coaches · Phase 2" color="green" />
            </motion.div>
            <motion.h2
              variants={fadeSlideUp}
              className="font-title mx-auto max-w-xl text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl"
            >
              Build Your Profile, Be Ready for Launch
            </motion.h2>
            <motion.p
              variants={fadeSlideUp}
              className="mx-auto mt-4 max-w-xl text-lg text-slate-500"
            >
              Coach bookings open in Phase 2. Set up your profile now and
              connect with serious families from day one.
            </motion.p>
          </motion.div>

          {/* Connecting progress line (desktop) */}
          <div className="relative">
            <div
              aria-hidden
              className="absolute left-1/2 top-7 hidden h-px w-[72%] -translate-x-1/2 bg-gradient-to-r from-transparent via-emerald-200 to-transparent md:block"
            />
            <motion.div
              variants={orchestratorVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              className="mx-auto grid max-w-6xl grid-cols-2 gap-6 sm:grid-cols-4"
            >
              {coachSteps.map((step, i) => (
                <CoachStepCard
                  key={i}
                  index={i}
                  title={step.title}
                  desc={step.desc}
                />
              ))}
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={SPRING_STIFF}
            className="mt-14 text-center"
          >
            <a
              href="/register?role=COACH"
              className="inline-block rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-10 py-4 text-base font-semibold text-white shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
            >
              Register Early
            </a>
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
          label: "Get Free Guidance",
          href: "/guidance",
        }}
      />
    </main>
  );
}
