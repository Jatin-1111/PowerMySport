"use client";

import { CTA } from "@/modules/marketing/components/marketing/CTA";
import {
  FeatureIcons,
  Features,
} from "@/modules/marketing/components/marketing/Features";
import { Hero } from "@/modules/marketing/components/marketing/Hero";
import { SectionLabel } from "@/modules/marketing/components/marketing/SectionLabel";
import { getCommunityAppUrl } from "@/lib/community/url";
import { motion, Variants, useScroll, useTransform } from "framer-motion";
import { CheckCircle, Play, CreditCard, UserPlus, MapPin } from "lucide-react";
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

/** Step badge pill */
function StepBadge({ label, color }: { label: string; color: string }) {
  return (
    <motion.div
      variants={fadeSlideUp}
      className={`mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white shadow-md ${color}`}
    >
      {label}
    </motion.div>
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
      className="relative h-[420px] w-full overflow-hidden rounded-[2rem] shadow-2xl sm:h-[480px]"
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
  step,
  stepColor,
  badgeBg,
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
        <StepBadge label={`Step ${step}`} color={badgeBg} />
        <motion.h3
          variants={fadeSlideUp}
          className="mb-4 text-3xl font-bold leading-tight text-slate-900 sm:text-4xl"
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
        className="absolute -bottom-4 -left-4 h-20 w-20 rounded-full bg-blue-50 opacity-40 transition-transform duration-700 group-hover:scale-125"
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
  const communityUrl = getCommunityAppUrl();

  const communityFeatures = [
    {
      title: "Ask before booking",
      description:
        "Check with other players and coaches to get practical advice on venues, timing, and setup.",
      icon: FeatureIcons.Users,
    },
    {
      title: "See what people learned",
      description:
        "Use community feedback to avoid surprises and choose options that fit your sport and skill level.",
      icon: FeatureIcons.Star,
    },
    {
      title: "Move from discovery to action",
      description:
        "Turn community guidance into a booking path without leaving the PowerMySport experience.",
      icon: FeatureIcons.Calendar,
    },
  ];

  const playerSteps: StepRowProps[] = [
    {
      step: 1,
      stepColor: "text-orange-500",
      badgeBg: "bg-gradient-to-r from-orange-500 to-orange-400",
      title: "Create Your Account",
      description:
        "Sign up with your email or Google account in under 2 minutes. Choose 'Player' as your role to start browsing venues and coaches.",
      checkItems: [
        {
          text: "Simple registration with email or Google",
          iconColor: "text-orange-400",
        },
        {
          text: "Complete your profile with basic information",
          iconColor: "text-orange-400",
        },
        { text: "Verify your account via email", iconColor: "text-orange-400" },
      ],
      image: {
        src: "https://images.unsplash.com/photo-1511886929837-354d827aae26?auto=format&fit=crop&w=800&q=80",
        alt: "Athlete ready to register",
        clip: "slash-right",
        overlayIcon: <UserPlus size={20} />,
        overlayLabel: "Account Registration",
        accentColor: "from-orange-500/25",
      },
      imageRight: true,
    },
    {
      step: 2,
      stepColor: "text-blue-500",
      badgeBg: "bg-gradient-to-r from-blue-600 to-blue-500",
      title: "Find Your Perfect Venue",
      description:
        "Use our powerful search to find venues by sport type, location, date, and time. See photos, amenities, pricing, and user reviews.",
      checkItems: [
        {
          text: "Filter by sport, city, and neighborhood",
          iconColor: "text-blue-400",
        },
        { text: "Check real-time availability", iconColor: "text-blue-400" },
        {
          text: "View venue details, photos, and amenities",
          iconColor: "text-blue-400",
        },
        {
          text: "See optional coach availability at venues",
          iconColor: "text-blue-400",
        },
      ],
      image: {
        src: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=80",
        alt: "Sports venue overview",
        clip: "slash-left",
        overlayIcon: <MapPin size={20} />,
        overlayLabel: "Search & Discover",
        accentColor: "from-blue-500/25",
      },
      imageRight: false,
    },
    {
      step: 3,
      stepColor: "text-emerald-500",
      badgeBg: "bg-gradient-to-r from-emerald-600 to-emerald-400",
      title: "Book & Pay Securely",
      description:
        "Select your preferred date and time slot. Add optional coach booking if needed. Complete payment securely through our integrated payment system.",
      checkItems: [
        {
          text: "Choose date, time, and duration",
          iconColor: "text-emerald-400",
        },
        { text: "Optionally add coach booking", iconColor: "text-emerald-400" },
        {
          text: "See transparent pricing breakdown",
          iconColor: "text-emerald-400",
        },
        {
          text: "Secure payment with instant confirmation",
          iconColor: "text-emerald-400",
        },
      ],
      image: {
        src: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=800&q=80",
        alt: "Secure payment on mobile",
        clip: "arch",
        overlayIcon: <CreditCard size={20} />,
        overlayLabel: "Secure Payment",
        accentColor: "from-emerald-500/25",
      },
      imageRight: true,
    },
    {
      step: 4,
      stepColor: "text-indigo-500",
      badgeBg: "bg-gradient-to-r from-indigo-600 to-indigo-400",
      title: "Check In & Play",
      description:
        "Receive booking confirmation and reminder updates. Arrive at your venue or coach session on time and manage changes from your dashboard.",
      checkItems: [
        {
          text: "Receive instant booking confirmation email",
          iconColor: "text-indigo-400",
        },
        {
          text: "Get reminder and status notifications",
          iconColor: "text-indigo-400",
        },
        {
          text: "Manage bookings, reviews, and follow-up sessions",
          iconColor: "text-indigo-400",
        },
        { text: "Enjoy your game!", iconColor: "text-indigo-400" },
      ],
      image: {
        // Replaced: photo-1526676037777 was returning a blank placeholder.
        // Using a verified Unsplash shot of footballers on a pitch at dusk.
        src: "https://images.unsplash.com/photo-1543326727-cf6c39e8f84c?auto=format&fit=crop&w=800&q=80",
        alt: "Athletes playing on a pitch",
        clip: "slash-left",
        overlayIcon: <Play size={20} className="fill-white" />,
        overlayLabel: "Play & Enjoy",
        accentColor: "from-indigo-500/25",
      },
      imageRight: false,
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
      title: "Go Live",
      desc: "Get access to your dashboard. Set up slots, pricing, and start accepting bookings immediately.",
    },
  ];

  const coachSteps = [
    { title: "Register", desc: "Sign up as coach with credentials" },
    { title: "Build Profile", desc: "Add certifications, experience, rates" },
    { title: "Set Availability", desc: "Define your schedule & service areas" },
    { title: "Get Clients", desc: "Accept bookings & start coaching" },
  ];

  const faqs = [
    {
      q: "Can I cancel or reschedule a booking?",
      a: "Yes. Bookings can be cancelled or rescheduled according to the venue's cancellation policy. Most venues allow free cancellation up to 24 hours before the booking time.",
    },
    {
      q: "How does payment work?",
      a: "Payments are processed securely through the platform. If you book a coach with a venue, the payment is split automatically using the agreed rates.",
    },
    {
      q: "What if there's an issue with my booking?",
      a: "Our support team is here to help. Reach out right away if you run into a booking issue, and we'll work with you and the venue to resolve it quickly.",
    },
    {
      q: "Are the coaches verified?",
      a: "Yes. We review certifications, experience, and background before coaches are approved to offer services on the platform.",
    },
  ];

  return (
    <main className="overflow-x-hidden">
      {/* ── Hero ── */}
      <Hero
        variant="page"
        title="How It Works"
        subtitle="Getting Started"
        description="Simple, straightforward steps to start booking venues and coaches on PowerMySport"
      />

      {/* ── Community Section ── */}
      <Features
        title="Community Guidance Inside the Booking Journey"
        subtitle="Community System"
        description="You do not have to guess. Community context helps you decide faster before you move into booking and payment."
        features={communityFeatures}
        columns={3}
        variant="centered"
      />

      {/* ── Players Journey ── */}
      <section className="relative overflow-hidden py-20 sm:py-24 lg:py-32">
        {/* Ambient blobs */}
        <AmbientBlob className="h-96 w-96 bg-orange-100/40 -left-48 top-24" />
        <AmbientBlob className="h-80 w-80 bg-blue-100/30 -right-40 top-1/3" />
        <AmbientBlob className="h-72 w-72 bg-indigo-100/30 -left-32 bottom-1/4" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Section header */}
          <motion.div
            variants={orchestratorVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mb-20 text-center lg:mb-28"
          >
            <motion.div
              variants={fadeSlideUp}
              className="mb-5 flex justify-center"
            >
              <SectionLabel label="For Players" color="orange" />
            </motion.div>
            <motion.h2
              variants={fadeSlideUp}
              className="font-title mx-auto max-w-2xl text-4xl font-bold text-slate-900 sm:text-5xl"
            >
              Book Your Game in{" "}
              <span className="relative inline-block">
                4 Easy Steps
                <span
                  aria-hidden
                  className="absolute -bottom-1 left-0 h-1 w-full rounded-full bg-gradient-to-r from-orange-400 to-orange-200"
                />
              </span>
            </motion.h2>
          </motion.div>

          {/* Step rows */}
          <div className="space-y-24 lg:space-y-36">
            {playerSteps.map((step) => (
              <StepRow key={step.step} {...step} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Venue / Academy Owners ── */}
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
              <SectionLabel label="For Venue & Academy Owners" color="blue" />
            </motion.div>
            <motion.h2
              variants={fadeSlideUp}
              className="font-title mx-auto max-w-xl text-4xl font-bold text-slate-900 sm:text-5xl"
            >
              List Your Facility & Start Earning
            </motion.h2>
            <motion.p
              variants={fadeSlideUp}
              className="mx-auto mt-4 max-w-xl text-lg text-slate-500"
            >
              Three steps stand between you and a fully live listing on
              PowerMySport.
            </motion.p>
          </motion.div>

          <motion.div
            variants={orchestratorVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3"
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
              href="/register"
              className="inline-block rounded-2xl bg-slate-900 px-10 py-4 text-base font-semibold text-white shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
            >
              Get Started
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
              <SectionLabel label="For Coaches" color="green" />
            </motion.div>
            <motion.h2
              variants={fadeSlideUp}
              className="font-title mx-auto max-w-xl text-4xl font-bold text-slate-900 sm:text-5xl"
            >
              Become a Certified Coach
            </motion.h2>
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
              className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-4"
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
              Become a Coach
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
        <AmbientBlob className="h-80 w-80 bg-violet-100/40 -right-24 top-16" />

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
              className="font-title text-4xl font-bold text-slate-900 sm:text-5xl"
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
        title="Ready to Get Started?"
        description="Join players, coaches, and venue partners who are already using the community to book smarter."
        primaryCTA={{
          label: "Create Account",
          href: "/register",
        }}
        secondaryCTA={{
          label: "Open Community",
          href: communityUrl,
        }}
      />
    </main>
  );
}
