"use client";

import { CTA } from "@/modules/marketing/components/marketing/CTA";
import {
  FeatureIcons,
  Features,
} from "@/modules/marketing/components/marketing/Features";
import { SectionLabel } from "@/modules/marketing/components/marketing/SectionLabel";
import { getCommunityAppUrl } from "@/lib/community/url";
import { Hero } from "@/modules/marketing/components/marketing/Hero";
import { motion, Variants } from "framer-motion";
import { Check, QrCode, Bell, BarChart3, ArrowRight } from "lucide-react";
import Image from "next/image";

// ─── Design Tokens ────────────────────────────────────────────────────────────

const SPRING_STIFF = { type: "spring", stiffness: 260, damping: 22 } as const;
const SPRING_SOFT = { type: "spring", stiffness: 200, damping: 28 } as const;

// ─── Motion Variants ──────────────────────────────────────────────────────────

const orchestratorVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.11, delayChildren: 0.06 } },
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

// ─── Primitives ───────────────────────────────────────────────────────────────

function AmbientBlob({ className }: { className: string }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute rounded-full blur-3xl will-change-transform ${className}`}
    />
  );
}

function SectionHeader({
  label,
  labelColor,
  title,
  highlight,
  description,
}: {
  label: string;
  labelColor: "orange" | "blue" | "green" | "slate";
  title: string;
  highlight?: string;
  description?: string;
}) {
  return (
    <motion.div
      variants={orchestratorVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      className="mb-14 text-center"
    >
      <motion.div variants={fadeSlideUp} className="mb-5 flex justify-center">
        <SectionLabel label={label} color={labelColor} />
      </motion.div>
      <motion.h2
        variants={fadeSlideUp}
        className="font-title mx-auto max-w-2xl text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl"
      >
        {highlight ? (
          <>
            {title}{" "}
            <span className="relative inline-block">
              {highlight}
              <span
                aria-hidden
                className="absolute -bottom-1 left-0 h-1 w-full rounded-full bg-gradient-to-r from-power-orange to-orange-200"
              />
            </span>
          </>
        ) : (
          title
        )}
      </motion.h2>
      {description && (
        <motion.p
          variants={fadeSlideUp}
          className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-slate-500"
        >
          {description}
        </motion.p>
      )}
    </motion.div>
  );
}

// ─── Player Service Card ──────────────────────────────────────────────────────

function PlayerServiceCard({
  title,
  description,
  icon,
  accentFrom,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  accentFrom: string;
}) {
  return (
    <motion.div
      variants={cardReveal}
      whileHover={{ y: -7, scale: 1.016 }}
      transition={SPRING_STIFF}
      className="group relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-8 shadow-sm will-change-transform hover:shadow-xl"
    >
      {/* Geometric ambient accent */}
      <div
        aria-hidden
        className={`absolute -right-10 -top-10 h-36 w-36 rounded-full ${accentFrom} opacity-50 transition-transform duration-500 group-hover:scale-150`}
      />
      {/* Bottom sweep line */}
      <div className="absolute bottom-0 left-8 right-8 h-px origin-left scale-x-0 rounded-full bg-gradient-to-r from-power-orange/60 to-transparent transition-transform duration-300 ease-out group-hover:scale-x-100" />

      <div className="relative mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-power-orange transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110">
        {icon}
      </div>
      <h3 className="relative mb-3 text-xl font-bold text-slate-900">
        {title}
      </h3>
      <p className="relative text-base leading-relaxed text-slate-500">
        {description}
      </p>
    </motion.div>
  );
}

// ─── Combo Booking Banner ────────────────────────────────────────────────────

function ComboBanner() {
  const steps = [
    "Select Venue",
    "Choose Coach",
    "Single Payment",
    "Start Training!",
  ];
  const checkItems = [
    "Find venues with available coaches",
    "Book both in one transaction",
    "Get specialized training + premium facility",
    "Perfect for beginners & serious athletes",
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={SPRING_SOFT}
      className="relative mb-14 overflow-hidden rounded-[2.5rem] shadow-2xl"
    >
      {/* Backdrop image */}
      <div className="absolute inset-0">
        <Image
          src="https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=1400&q=80"
          alt=""
          fill
          className="object-cover"
          aria-hidden
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/95 via-indigo-900/88 to-orange-900/80" />
      </div>

      {/* Decorative floating polygon */}
      <svg
        aria-hidden
        viewBox="0 0 800 400"
        className="pointer-events-none absolute inset-0 h-full w-full opacity-10"
        preserveAspectRatio="none"
      >
        <polygon points="0,0 500,0 300,400 0,400" fill="white" />
      </svg>

      <div className="relative grid items-center gap-8 p-6 sm:p-8 md:grid-cols-2 md:p-12 lg:p-16">
        {/* Copy */}
        <motion.div
          variants={orchestratorVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
        >
          <motion.div variants={fadeSlideUp} className="mb-2">
            <span className="inline-flex items-center rounded-full bg-white/15 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-white/90 backdrop-blur-sm">
              ⭐ Best Value
            </span>
          </motion.div>
          <motion.h3
            variants={fadeSlideUp}
            className="mb-4 text-2xl font-bold text-white sm:text-3xl lg:text-4xl"
          >
            Premium Combo: Venue + Coach
          </motion.h3>
          <motion.p
            variants={fadeSlideUp}
            className="mb-8 text-lg leading-relaxed text-white/85"
          >
            Book a venue and professional coach in one seamless transaction. Get
            the complete sports experience with facility access and personalized
            training.
          </motion.p>
          <motion.ul variants={orchestratorVariants} className="space-y-3">
            {checkItems.map((item, i) => (
              <motion.li
                key={i}
                variants={fadeSlideUp}
                className="flex items-center gap-3 text-white/90"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white font-bold text-indigo-700">
                  <Check size={13} />
                </span>
                <span className="text-base">{item}</span>
              </motion.li>
            ))}
          </motion.ul>
        </motion.div>

        {/* Flow card */}
        <motion.div
          variants={fadeSlideRight}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="rounded-2xl border border-white/20 bg-white/10 p-8 backdrop-blur-xl"
        >
          <p className="mb-6 text-center text-xs font-bold uppercase tracking-widest text-white/70">
            Combo Booking Flow
          </p>
          <div className="space-y-3">
            {steps.map((step, i) => (
              <div key={i}>
                <div
                  className={`rounded-xl border p-4 text-center text-sm font-semibold backdrop-blur-sm transition-colors ${
                    i === steps.length - 1
                      ? "border-transparent bg-gradient-to-r from-power-orange to-amber-500 text-white shadow-lg shadow-orange-500/30"
                      : "border-white/15 bg-white/10 text-white"
                  }`}
                >
                  {i + 1 < steps.length ? `${i + 1}. ${step}` : step}
                </div>
                {i < steps.length - 1 && (
                  <div className="flex justify-center py-1 text-white/40">
                    <ArrowRight size={14} className="rotate-90" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── Three Ways to Book ───────────────────────────────────────────────────────

const bookingOptions = [
  {
    opt: "Option 1",
    title: "Venue Booking",
    steps: ["Search venues by sport", "Check availability", "Book & play"],
    badgeBg: "bg-gradient-to-br from-orange-500 to-orange-400",
    borderColor: "border-orange-200",
    stepBg: "bg-orange-500",
    glowFrom: "from-orange-50",
  },
  {
    opt: "Option 2",
    title: "Coach Booking",
    steps: [
      "Find coaches near you",
      "Check their availability",
      "Book training session",
    ],
    badgeBg: "bg-gradient-to-br from-emerald-600 to-emerald-500",
    borderColor: "border-emerald-200",
    stepBg: "bg-emerald-500",
    glowFrom: "from-emerald-50",
  },
  {
    opt: "Option 3 ⭐",
    title: "Combo Booking",
    steps: [
      "Search venue + coach",
      "Unified checkout flow",
      "Complete experience",
    ],
    badgeBg: "bg-gradient-to-br from-indigo-600 to-indigo-500",
    borderColor: "border-indigo-200",
    stepBg: "bg-indigo-500",
    glowFrom: "from-indigo-50",
  },
];

function BookingOptionsPanel() {
  return (
    <motion.div
      variants={orchestratorVariants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      className="relative overflow-hidden rounded-[2rem] border border-slate-100 bg-white p-8 shadow-sm md:p-12"
    >
      {/* Decorative skew SVG backdrop */}
      <svg
        viewBox="0 0 600 200"
        className="pointer-events-none absolute inset-0 h-full w-full"
        aria-hidden
        preserveAspectRatio="none"
      >
        <polygon
          points="0,30 600,0 600,170 0,200"
          fill="rgba(249,115,22,0.025)"
        />
        <polygon
          points="0,60 600,30 600,200 0,230"
          fill="rgba(34,197,94,0.018)"
        />
      </svg>

      <motion.h3
        variants={fadeSlideUp}
        className="relative mb-10 text-center text-2xl font-bold text-slate-900"
      >
        Three Ways to Book on PowerMySport
      </motion.h3>

      <div className="relative grid grid-cols-1 gap-6 md:grid-cols-3">
        {bookingOptions.map((method) => (
          <motion.div
            key={method.title}
            variants={cardReveal}
            whileHover={{ y: -7, scale: 1.018 }}
            transition={SPRING_STIFF}
            className={`group relative overflow-hidden rounded-2xl border bg-white p-8 shadow-sm will-change-transform hover:shadow-lg ${method.borderColor}`}
          >
            <div
              aria-hidden
              className={`absolute inset-0 bg-gradient-to-br ${method.glowFrom} to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-60`}
            />
            <div
              className={`relative mb-5 inline-flex items-center rounded-xl px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white ${method.badgeBg}`}
            >
              {method.opt}
            </div>
            <h4 className="relative mb-6 text-xl font-bold text-slate-900">
              {method.title}
            </h4>
            <ul className="relative space-y-4">
              {method.steps.map((step, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 text-sm text-slate-600"
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${method.stepBg}`}
                  >
                    {i + 1}
                  </span>
                  <span className="font-medium">{step}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Coach Feature Card ───────────────────────────────────────────────────────

function CoachFeatureCard({
  title,
  description,
  index,
}: {
  title: string;
  description: string;
  index: number;
}) {
  return (
    <motion.div
      variants={cardReveal}
      whileHover={{ y: -7, scale: 1.016 }}
      transition={SPRING_STIFF}
      className="group relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-8 shadow-sm will-change-transform hover:shadow-xl"
    >
      {/* Geometric circle accent */}
      <div
        aria-hidden
        className="absolute -bottom-8 -right-8 h-32 w-32 rounded-full bg-emerald-50 opacity-60 transition-transform duration-500 group-hover:scale-150"
      />
      {/* Bottom sweep */}
      <div className="absolute bottom-0 left-8 right-8 h-px origin-left scale-x-0 rounded-full bg-gradient-to-r from-emerald-400/60 to-transparent transition-transform duration-300 ease-out group-hover:scale-x-100" />

      <div className="relative mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110">
        <span className="text-xl font-bold">{index + 1}</span>
      </div>
      <h3 className="relative mb-3 text-xl font-bold text-slate-900">
        {title}
      </h3>
      <p className="relative text-base leading-relaxed text-slate-500">
        {description}
      </p>
    </motion.div>
  );
}

// ─── Additional Feature Card ──────────────────────────────────────────────────

function AdditionalFeatureCard({
  icon,
  title,
  desc,
  iconBg,
  glowColor,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  iconBg: string;
  glowColor: string;
}) {
  return (
    <motion.div
      variants={cardReveal}
      whileHover={{ y: -7, scale: 1.018 }}
      transition={SPRING_STIFF}
      className="group relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-sm will-change-transform hover:shadow-xl"
    >
      <div
        aria-hidden
        className={`absolute inset-0 bg-gradient-to-br ${glowColor} to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-70`}
      />
      <div
        className={`relative mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:rotate-6 group-hover:scale-110 ${iconBg}`}
      >
        {icon}
      </div>
      <h3 className="relative mb-3 text-xl font-bold text-slate-900">
        {title}
      </h3>
      <p className="relative text-sm leading-relaxed text-slate-500">{desc}</p>
    </motion.div>
  );
}

// ─── Venue Owner Image Feature Row ───────────────────────────────────────────

function VenueOwnerShowcase() {
  return (
    <div className="mb-14 grid items-center gap-10 lg:grid-cols-2 lg:gap-20">
      {/* Image frame */}
      <motion.div
        variants={fadeSlideLeft}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-100px" }}
        whileHover={{ scale: 1.015, y: -4 }}
        transition={SPRING_SOFT}
        className="group"
      >
        <div
          className="relative h-[280px] w-full overflow-hidden rounded-[2.5rem] shadow-2xl sm:h-[440px] lg:h-[500px]"
          style={{
            clipPath: "polygon(0 0, 92% 0, 100% 8%, 100% 100%, 8% 100%, 0 92%)",
          }}
        >
          <Image
            src="https://images.unsplash.com/photo-1553778263-73a83bab9b0c?auto=format&fit=crop&w=800&q=80"
            alt="Sports facility management dashboard"
            fill
            className="object-cover transition-transform duration-700 will-change-transform group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-slate-950/15 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 via-transparent to-transparent" />
          {/* Glass overlay card */}
          <div className="absolute bottom-5 left-5 right-5 flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-5 py-4 backdrop-blur-xl">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white">
              <BarChart3 size={20} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">
                Real-time Dashboard
              </p>
              <p className="text-xs text-white/70">
                Live occupancy & revenue tracking
              </p>
            </div>
          </div>
          {/* Decorative circles */}
          <div
            aria-hidden
            className="absolute right-5 top-5 h-14 w-14 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm"
          />
          <div
            aria-hidden
            className="absolute right-9 top-9 h-5 w-5 rounded-full bg-white/25"
          />
        </div>
      </motion.div>

      {/* Stat pills + copy */}
      <motion.div
        variants={orchestratorVariants}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-100px" }}
      >
        <motion.div variants={fadeSlideUp} className="mb-5">
          <SectionLabel label="For Venue & Academy Owners" color="blue" />
        </motion.div>
        <motion.h2
          variants={fadeSlideUp}
          className="font-title mb-4 text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl"
        >
          Streamline Your{" "}
          <span className="relative inline-block">
            Facility Operations
            <span
              aria-hidden
              className="absolute -bottom-1 left-0 h-1 w-full rounded-full bg-gradient-to-r from-blue-400 to-blue-200"
            />
          </span>
        </motion.h2>
        <motion.p
          variants={fadeSlideUp}
          className="mb-8 text-lg leading-relaxed text-slate-500"
        >
          Powerful tools to manage bookings, increase revenue, and grow your
          sports facility or academy.
        </motion.p>
        {/* Stat pills */}
        <motion.div
          variants={orchestratorVariants}
          className="mb-8 flex flex-wrap gap-3"
        >
          {[
            { stat: "48h", label: "Approval time" },
            { stat: "0%", label: "Platform commission" },
            { stat: "∞", label: "Court slots" },
          ].map((s) => (
            <motion.div
              key={s.stat}
              variants={fadeSlideUp}
              className="flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-2"
            >
              <span className="text-lg font-bold text-blue-700">{s.stat}</span>
              <span className="text-sm text-blue-500">{s.label}</span>
            </motion.div>
          ))}
        </motion.div>
        <motion.div variants={fadeSlideUp}>
          <a
            href="/register"
            className="inline-block rounded-2xl bg-slate-900 px-8 py-4 text-base font-semibold text-white shadow-lg transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
          >
            Get Started Today
          </a>
        </motion.div>
      </motion.div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ServicesPage() {
  const communityUrl = getCommunityAppUrl();

  const playerServices = [
    {
      title: "Premium Venue Booking",
      description:
        "Browse and instantly book verified sports venues nationwide. Real-time availability, transparent pricing, and verified facility details. Book badminton courts, cricket grounds, football fields, and more.",
      icon: FeatureIcons.Location,
      accentFrom: "bg-orange-100",
    },
    {
      title: "Professional Coach Booking",
      description:
        "Connect with certified coaches offering personalized training. Book coaching lessons at your chosen venue or their facility. Add coaches to your venue booking for integrated sessions.",
      icon: FeatureIcons.Users,
      accentFrom: "bg-amber-100",
    },
    {
      title: "Manage Kids' Sports Activities",
      description:
        "Add unlimited dependents (children) to your account. Manage each child's profile, sports interests, and bookings separately. Track progress and coordinate all their training sessions in one place.",
      icon: FeatureIcons.Users,
      accentFrom: "bg-rose-100",
    },
    {
      title: "Secure Integrated Payments",
      description:
        "Pay securely with transparent totals, promo support, and group booking payment options (single payer or split). Limited-time zero platform commission applies automatically.",
      icon: FeatureIcons.CreditCard,
      accentFrom: "bg-violet-100",
    },
  ];

  const venueOwnerFeatures = [
    {
      title: "Booking Management Dashboard",
      description:
        "Comprehensive real-time dashboard showing all bookings, occupancy rates, and revenue. Manage slots, set dynamic pricing, and track facility utilization across all courts/fields.",
      icon: FeatureIcons.Chart,
    },
    {
      title: "Coach Integration Programs",
      description:
        "List certified coaches on your venue profile. Enable combo bookings (venue + coach) to attract more players and increase average revenue per booking.",
      icon: FeatureIcons.Lightning,
    },
    {
      title: "Automated Payment System",
      description:
        "Receive instant payouts after each booking. Automatic settlement with transparent breakdowns. No payment delays or manual processing needed.",
      icon: FeatureIcons.Shield,
    },
    {
      title: "Marketing & Visibility",
      description:
        "Get discovered by players searching on PowerMySport. Featured listings, reviews, and ratings help you stand out and attract more bookings.",
      icon: FeatureIcons.Star,
    },
  ];

  const coachFeatures = [
    {
      title: "Professional Coaching Profile",
      description:
        "Showcase your credentials, experience, certifications, and specialties. Set your coaching rates, availability, and service areas to attract serious students.",
    },
    {
      title: "Venue Partnership Integration",
      description:
        "Partner with premium venues to offer coaching sessions. Tap into venues' existing player base and increase your client reach exponentially.",
    },
    {
      title: "Session Management System",
      description:
        "Manage all coaching sessions, track student progress, maintain learning history, and schedule follow-ups all in one platform.",
    },
    {
      title: "Automated Revenue Tracking",
      description:
        "Monitor earnings in real-time with detailed reports. Get paid automatically after each coaching session with transparent payout tracking and launch-period zero commission on coach bookings.",
    },
  ];

  const communityFeatures = [
    {
      title: "Ask the community",
      description:
        "Let players and coaches help you choose the right venue, sport setup, or training option before you commit.",
      icon: FeatureIcons.Users,
    },
    {
      title: "Learn from real feedback",
      description:
        "Use reviews and discussions to understand what works well for different sports, locations, and skill levels.",
      icon: FeatureIcons.Star,
    },
    {
      title: "Connect every service",
      description:
        "Keep bookings, coaching, and community advice in one flow so discovery feels connected instead of fragmented.",
      icon: FeatureIcons.Calendar,
    },
  ];

  const additionalFeatures = [
    {
      icon: <QrCode size={28} className="text-indigo-600" />,
      title: "Group Booking Invites",
      desc: "Invite friends, track acceptance, and confirm shared sessions from one flow.",
      iconBg: "bg-indigo-50 text-indigo-600",
      glowColor: "from-indigo-50",
    },
    {
      icon: <Bell size={28} className="text-orange-500" />,
      title: "Smart Notifications",
      desc: "Booking reminders, payment updates, social invites, and community activity alerts.",
      iconBg: "bg-orange-50 text-orange-500",
      glowColor: "from-orange-50",
    },
    {
      icon: <BarChart3 size={28} className="text-emerald-600" />,
      title: "Community & Reviews",
      desc: "Learn from player discussions and leave verified reviews after completed sessions.",
      iconBg: "bg-emerald-50 text-emerald-600",
      glowColor: "from-emerald-50",
    },
  ];

  return (
    <main className="overflow-x-hidden">
      {/* ── Hero ── */}
      <Hero
        variant="page"
        title="Our Services"
        subtitle="What We Offer"
        description="Comprehensive solutions for players, venue owners, and coaches. Everything you need to power your sports experience."
      />

      {/* ── Community ── */}
      <Features
        title="Community Support Built Into Every Service"
        subtitle="Community System"
        description="PowerMySport combines booking and conversation so you can validate options with people who already play, coach, or manage venues."
        features={communityFeatures}
        columns={3}
        variant="centered"
      />

      {/* ── For Players ── */}
      <section className="relative overflow-hidden py-20 sm:py-24 lg:py-32">
        <AmbientBlob className="h-96 w-96 bg-orange-100/45 -left-40 top-16" />
        <AmbientBlob className="h-72 w-72 bg-violet-100/30 -right-32 top-1/2" />
        <AmbientBlob className="h-64 w-64 bg-amber-100/30 -left-20 bottom-20" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            label="For Players"
            labelColor="orange"
            title="Book Venues & Coaches"
            highlight="Instantly"
            description="Everything you need to play your favorite sports and improve your skills."
          />

          {/* 2×2 Service cards */}
          <motion.div
            variants={orchestratorVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mb-14 grid grid-cols-1 gap-6 md:grid-cols-2"
          >
            {playerServices.map((service, i) => (
              <PlayerServiceCard
                key={i}
                title={service.title}
                description={service.description}
                icon={service.icon}
                accentFrom={service.accentFrom}
              />
            ))}
          </motion.div>

          {/* Combo banner */}
          <ComboBanner />

          {/* Three ways panel */}
          <BookingOptionsPanel />
        </div>
      </section>

      {/* ── For Venue & Academy Owners ── */}
      <section className="relative overflow-hidden bg-slate-50 py-20 sm:py-24 lg:py-32">
        {/* Dot grid texture */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #0f172a 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <AmbientBlob className="h-96 w-96 bg-blue-100/50 -right-32 top-20" />
        <AmbientBlob className="h-72 w-72 bg-sky-100/35 -left-24 bottom-16" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Asymmetric showcase row */}
          <VenueOwnerShowcase />

          {/* Feature grid */}
          <Features
            features={venueOwnerFeatures}
            columns={2}
            variant="default"
          />
        </div>
      </section>

      {/* ── For Coaches ── */}
      <section className="relative overflow-hidden py-20 sm:py-24 lg:py-32">
        <AmbientBlob className="h-96 w-96 bg-emerald-100/45 -left-40 top-20" />
        <AmbientBlob className="h-72 w-72 bg-teal-100/30 -right-32 bottom-20" />

        {/* Dot grid */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.02]"
          style={{
            backgroundImage:
              "linear-gradient(0deg, #0f172a 1px, transparent 1px), linear-gradient(90deg, #0f172a 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Header + image row */}
          <div className="mb-14 grid items-center gap-10 lg:grid-cols-2 lg:gap-20">
            {/* Copy */}
            <motion.div
              variants={orchestratorVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-100px" }}
            >
              <motion.div variants={fadeSlideUp} className="mb-5">
                <SectionLabel label="For Coaches" color="green" />
              </motion.div>
              <motion.h2
                variants={fadeSlideUp}
                className="font-title mb-4 text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl"
              >
                Grow Your{" "}
                <span className="relative inline-block">
                  Coaching Business
                  <span
                    aria-hidden
                    className="absolute -bottom-1 left-0 h-1 w-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-200"
                  />
                </span>
              </motion.h2>
              <motion.p
                variants={fadeSlideUp}
                className="mb-8 text-lg leading-relaxed text-slate-500"
              >
                Connect with serious athletes and manage your coaching practice
                efficiently. Zero commission during launch.
              </motion.p>
              {/* Benefit pills */}
              <motion.div
                variants={orchestratorVariants}
                className="mb-8 flex flex-wrap gap-3"
              >
                {[
                  { stat: "0%", label: "Coach commission" },
                  { stat: "24/7", label: "Booking access" },
                  { stat: "⭐", label: "Verified badge" },
                ].map((s) => (
                  <motion.div
                    key={s.stat}
                    variants={fadeSlideUp}
                    className="flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-4 py-2"
                  >
                    <span className="text-lg font-bold text-emerald-700">
                      {s.stat}
                    </span>
                    <span className="text-sm text-emerald-500">{s.label}</span>
                  </motion.div>
                ))}
              </motion.div>
              <motion.div variants={fadeSlideUp}>
                <a
                  href="/register?role=COACH"
                  className="inline-block rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-8 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
                >
                  Become a Coach
                </a>
              </motion.div>
            </motion.div>

            {/* Coach image frame */}
            <motion.div
              variants={fadeSlideRight}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-100px" }}
              whileHover={{ scale: 1.015, y: -4 }}
              transition={SPRING_SOFT}
              className="group"
            >
              <div
                className="relative h-[280px] w-full overflow-hidden rounded-[2.5rem] shadow-2xl sm:h-[440px] lg:h-[500px]"
                style={{
                  clipPath:
                    "polygon(8% 0, 100% 0, 100% 92%, 92% 100%, 0 100%, 0 8%)",
                }}
              >
                <Image
                  src="https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=800&q=80"
                  alt="Coach training athlete"
                  fill
                  className="object-cover transition-transform duration-700 will-change-transform group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-slate-950/10 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 via-transparent to-transparent" />
                <div className="absolute bottom-5 left-5 right-5 flex items-center gap-3 rounded-2xl border border-white/20 bg-white/10 px-5 py-4 backdrop-blur-xl">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white">
                    <Check size={20} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">
                      Certified Coaches
                    </p>
                    <p className="text-xs text-white/70">
                      Verified credentials & experience
                    </p>
                  </div>
                </div>
                <div
                  aria-hidden
                  className="absolute right-5 top-5 h-14 w-14 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm"
                />
                <div
                  aria-hidden
                  className="absolute right-9 top-9 h-5 w-5 rounded-full bg-white/25"
                />
              </div>
            </motion.div>
          </div>

          {/* Coach feature cards */}
          <motion.div
            variants={orchestratorVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mx-auto grid max-w-5xl grid-cols-1 gap-6 sm:grid-cols-2"
          >
            {coachFeatures.map((feature, i) => (
              <CoachFeatureCard
                key={i}
                index={i}
                title={feature.title}
                description={feature.description}
              />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Additional Features ── */}
      <section className="relative overflow-hidden bg-slate-50 py-20 sm:py-24 lg:py-32">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "radial-gradient(circle, #0f172a 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />
        <AmbientBlob className="h-80 w-80 bg-violet-100/40 -right-24 top-16" />
        <AmbientBlob className="h-64 w-64 bg-indigo-100/30 -left-20 bottom-20" />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeader
            label="Platform Features"
            labelColor="slate"
            title="More Ways We Add"
            highlight="Value"
            description="Built-in extras that make every booking, session, and community interaction better."
          />

          <motion.div
            variants={orchestratorVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="grid grid-cols-1 gap-6 md:grid-cols-3"
          >
            {additionalFeatures.map((f, i) => (
              <AdditionalFeatureCard key={i} {...f} />
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <CTA
        variant="gradient"
        title="Ready to Experience These Services?"
        description="Join PowerMySport today and see how seamless sports booking and community support can feel."
        primaryCTA={{ label: "Get Started Free", href: "/register" }}
        secondaryCTA={{ label: "Open Community", href: communityUrl }}
      />
    </main>
  );
}
