"use client";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { getCommunityAppUrl } from "@/lib/community/url";
import { getDashboardPathByRole } from "@/utils/roleDashboard";

import { CTA } from "@/modules/marketing/components/marketing/CTA";
import {
  FeatureIcons,
  Features,
} from "@/modules/marketing/components/marketing/Features";
import { Hero } from "@/modules/marketing/components/marketing/Hero";
import { Testimonials } from "@/modules/marketing/components/marketing/Testimonials";
import { SectionLabel } from "@/modules/marketing/components/marketing/SectionLabel";
import { Button } from "@/modules/shared/ui/Button";
import {
  Building2,
  Check,
  GraduationCap,
  TicketPercent,
  Trophy,
  User as UserIcon,
  Users,
  Users2,
  Zap,
  ArrowRight,
} from "lucide-react";

import Script from "next/script";
import Link from "next/link";
import Image from "next/image";
import { motion, Variants } from "framer-motion";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://powermysport.com";

// ─── Motion variants ──────────────────────────────────────────────────────────

const sectionVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.08 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 270, damping: 22 },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 28, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 260, damping: 22 },
  },
};

export default function HomePage() {
  const { user } = useAuthStore();
  const communityUrl = getCommunityAppUrl();

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "PowerMySport",
    url: siteUrl,
    logo: `${siteUrl}/icon.svg`,
    sameAs: [],
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "PowerMySport",
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/venues?search={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  const features = [
    {
      label: "Scattered schedules",
      title: "Everything in One Place",
      description:
        "Manage all your kids' sessions, coach chats, and venue bookings from a single dashboard. No more switching between WhatsApp groups and calendar apps.",
      icon: <Users2 className="h-6 w-6" />,
    },
    {
      label: "Unreliable coaches",
      title: "Tested & Trusted Coaches",
      description:
        "Don't guess who is training your child. Read real, verified feedback from other parents in your city before you book any coach.",
      icon: <GraduationCap className="h-6 w-6" />,
    },
    {
      label: "Endless phone calls",
      title: "Book Venues Instantly",
      description:
        "Find and secure top-rated local sports venues instantly. No phone calls, no waiting for confirmations.",
      icon: <Zap className="h-6 w-6" />,
    },
    {
      label: "Hidden costs & surprise fees",
      title: "100% Transparent Pricing",
      description:
        "Compare costs upfront. Pay securely through the platform with a full breakdown—zero hidden charges.",
      icon: FeatureIcons.Shield,
    },
    {
      label: "Missed sessions & last-minute changes",
      title: "Never Miss a Session",
      description:
        "Get instant notifications the moment a coach reschedules a session or a venue updates its availability.",
      icon: FeatureIcons.Lightning,
    },
    {
      label: "Guessing the right sport",
      title: "Smart Sports Plans",
      description:
        "Not sure which sport fits your child best? Our AI creates a personalised plan based on your child's age, interests, and goals.",
      icon: <Trophy className="h-6 w-6" />,
    },
  ];

  const communityFeatures = [
    {
      title: "Talk to Other Parents",
      description:
        "Get recommendations from parents in your city who have already sent their kids to specific venues and coaches.",
      icon: FeatureIcons.Users,
    },
    {
      title: "Read Honest Reviews",
      description:
        "See what other parents are saying about coach quality, training style, and whether a venue is safe.",
      icon: FeatureIcons.Star,
    },
    {
      title: "Help from Real People",
      description:
        "Stop relying on guesswork. Use real community advice to pick the right sport, coach, and venue.",
      icon: FeatureIcons.Calendar,
    },
  ];

  const testimonials = [
    {
      quote:
        "Before PowerMySport I was juggling three WhatsApp groups, two spreadsheets, and constant phone calls just to manage my kids' cricket and badminton training. Now I handle everything from one screen in minutes.",
      author: "Anjali Patel",
      role: "Mother of 2 · Cricket & Badminton",
      rating: 5,
    },
    {
      quote:
        "I was really nervous about hiring a coach online  you never know who you're trusting with your child. Reading detailed parent reviews on PowerMySport gave me the confidence to book. Best decision we made.",
      author: "Meera Krishnan",
      role: "Parent · Bengaluru",
      rating: 5,
    },
    {
      quote:
        "My son wanted to try four different sports before we figured out swimming was his thing. The AI roadmap actually helped me understand what suited his age and temperament. Saved us months of trial and error.",
      author: "Rohit Malhotra",
      role: "Father of 1 · Swimming",
      rating: 5,
    },
  ];

  const getDashboardLink = () => {
    if (!user) return "/register?role=PLAYER";
    return getDashboardPathByRole(user.role);
  };

  return (
    <main>
      <Script
        id="organization-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <Script
        id="website-jsonld"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />

      {/* ── Hero ── */}
      <Hero
        variant="home"
        title="Stop Juggling Apps. Manage Your Kids' Sports in One Place."
        subtitle="Built for Busy Parents"
        description="Tired of tracking down coaches, guessing which venues are safe, and managing scattered schedules? PowerMySport gives you a single dashboard to find vetted coaches, book premium venues, and plan your child's entire sports journey."
        primaryCTA={
          user?.role === "VENUE_LISTER"
            ? { label: "Manage Venues", href: "/venue-lister/inventory" }
            : {
                label: user ? "Go to Dashboard" : "Find a Coach for My Child",
                href: getDashboardLink(),
              }
        }
        secondaryCTA={{
          label: "Explore the Community",
          href: communityUrl,
        }}
        gradient
      />

      {/* ── Features ── */}
      <Features
        title="Real Solutions for Real Parenting Frustrations"
        subtitle="Why Parents Choose Us"
        description="We know how hard it is to manage youth sports. We built PowerMySport to solve the exact problems that make sports logistics a headache."
        features={features}
        columns={3}
        variant="centered"
      />

      {/* ── Community Features ── */}
      <Features
        title="Don't Guess. Ask the Parents Who Know."
        subtitle="Parent-to-Parent Support"
        description="Connect with local parents who have already navigated the sports landscape. Get honest recommendations on the best coaches, safest venues, and right programs for your child's age group."
        features={communityFeatures}
        columns={3}
        variant="centered"
      />

      {/* ── How It Works ── */}
      <section className="relative py-16 sm:py-20 lg:py-24">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 h-72 w-full -translate-x-1/2 bg-gradient-to-b from-orange-50/40 to-transparent" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={sectionVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mb-12 text-center sm:mb-16"
          >
            <motion.div
              variants={itemVariants}
              className="mb-4 flex justify-center"
            >
              <SectionLabel label="Simple Process" color="orange" />
            </motion.div>
            <motion.h2
              variants={itemVariants}
              className="font-title mb-4 text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl"
            >
              Up and Running in 3 Steps
            </motion.h2>
            <motion.p
              variants={itemVariants}
              className="text-lg text-slate-600"
            >
              Get personalised AI guidance and community support before you book your child's first session
            </motion.p>
          </motion.div>

          {/* Steps grid with SVG connecting line */}
          <div className="relative">
            {/* Dashed connector line (desktop only) */}
            <div className="pointer-events-none absolute inset-0 hidden lg:flex items-center justify-center">
              <svg
                viewBox="0 0 800 40"
                className="w-full max-w-2xl"
                aria-hidden
              >
                <motion.line
                  x1="80"
                  y1="20"
                  x2="720"
                  y2="20"
                  stroke="rgba(233,115,22,0.3)"
                  strokeWidth="2"
                  strokeDasharray="6 6"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true, margin: "-80px" }}
                  transition={{ duration: 1.2, ease: "easeInOut", delay: 0.3 }}
                />
              </svg>
            </div>

            <motion.div
              variants={sectionVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              className="grid grid-cols-1 gap-8 md:grid-cols-3"
            >
              {[
                {
                  step: 1,
                  title: "Add Your Child's Profile",
                  desc: "Tell us your child's age, sports interests, and how many hours a week they can commit. Takes 2 minutes.",
                },
                {
                  step: 2,
                  title: "Get an AI Sports Roadmap",
                  desc: "Our AI generates a customised sports roadmap  which sports suit your child, which coaches to look for, and what to prioritise.",
                },
                {
                  step: 3,
                  title: "Ask & Book with Confidence",
                  desc: "Validate your plan with other parents in the community, then book a vetted coach or venue in a few taps.",
                },
              ].map(({ step, title, desc }) => (
                <motion.div
                  key={step}
                  variants={cardVariants}
                  whileHover={{ y: -6, scale: 1.015 }}
                  transition={{ type: "spring", stiffness: 280, damping: 20 }}
                  className="group relative rounded-2xl border border-white/70 bg-white/80 p-8 text-center backdrop-blur-sm premium-shadow will-change-transform hover:border-white/90 hover:bg-white/90"
                >
                  <motion.div
                    className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-power-orange text-2xl font-bold text-white shadow-[0_6px_24px_-4px_rgba(233,115,22,0.45)]"
                    whileHover={{ scale: 1.12, rotate: 3 }}
                    transition={{ type: "spring", stiffness: 300, damping: 16 }}
                  >
                    {step}
                  </motion.div>
                  <h3 className="mb-3 text-lg font-bold text-slate-900">
                    {title}
                  </h3>
                  <p className="text-sm leading-relaxed text-slate-600">
                    {desc}
                  </p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Parent Section: Split with clipped image ── */}
      <section className="relative overflow-hidden py-16 sm:py-20 lg:py-24">
        <div className="pointer-events-none absolute -left-32 top-1/4 h-80 w-80 rounded-full bg-indigo-100/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 bottom-1/4 h-80 w-80 rounded-full bg-amber-100/25 blur-3xl" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1fr]">
            {/* Left: Cards */}
            <motion.div
              variants={sectionVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-100px" }}
            >
              <motion.div variants={itemVariants} className="mb-3">
                <SectionLabel label="For Parents & Guardians" color="blue" />
              </motion.div>
              <motion.h2
                variants={itemVariants}
                className="font-title mb-4 text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl"
              >
                Manage Their Sports Easily
              </motion.h2>
              <motion.p
                variants={itemVariants}
                className="mb-10 text-lg text-slate-600"
              >
                Keep track of all your kids' coaches, venues, and schedules
                from one simple parent dashboard.
              </motion.p>

              <motion.div variants={sectionVariants} className="space-y-4">
                {[
                  {
                    icon: <Users2 size={22} />,
                    title: "Add Multiple Kids",
                    desc: "Add all your kids to one account. Track each child's sports and schedules separately.",
                    color: "bg-indigo-100 text-indigo-600",
                  },
                  {
                    icon: <Trophy size={22} />,
                    title: "Book Venues & Coaches",
                    desc: "Easily book the best venues and find great coaches for your kids to learn from.",
                    color: "bg-orange-100 text-power-orange",
                  },
                  {
                    icon: <Zap size={22} />,
                    title: "Track Sessions",
                    desc: "See all upcoming games, past bookings, and coach reviews in one place.",
                    color: "bg-emerald-100 text-emerald-600",
                  },
                ].map((item) => (
                  <motion.div
                    key={item.title}
                    variants={cardVariants}
                    whileHover={{ y: -4, scale: 1.01 }}
                    transition={{ type: "spring", stiffness: 280, damping: 20 }}
                    className="flex items-start gap-4 rounded-2xl border border-white/70 bg-white/80 p-5 backdrop-blur-sm premium-shadow will-change-transform"
                  >
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.color}`}
                    >
                      {item.icon}
                    </div>
                    <div>
                      <h3 className="mb-1 font-bold text-slate-900">
                        {item.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-slate-600">
                        {item.desc}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>

            {/* Right: Clipped image */}
            <motion.div
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              whileInView={{ opacity: 1, x: 0, scale: 1 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 26,
                delay: 0.15,
              }}
              className="relative hidden h-[520px] lg:block"
            >
              {/* Glow behind */}
              <div className="absolute inset-4 rounded-3xl bg-gradient-to-br from-indigo-400/15 via-transparent to-orange-400/10 blur-2xl" />
              {/* Geometric accent */}
              <svg
                viewBox="0 0 200 200"
                className="pointer-events-none absolute -left-6 -top-6 h-40 w-40 opacity-50"
                aria-hidden
              >
                <polygon
                  points="8,0 200,0 200,192 192,200 0,200 0,8"
                  fill="none"
                  stroke="rgba(99,102,241,0.2)"
                  strokeWidth="1.5"
                />
              </svg>

              <div
                className="relative h-full w-full overflow-hidden rounded-[2.5rem]"
                style={{
                  clipPath:
                    "polygon(8% 0, 100% 0, 100% 92%, 92% 100%, 0 100%, 0 8%)",
                }}
              >
                <Image
                  src="https://images.unsplash.com/photo-1484863137850-59afcfe05386?auto=format&fit=crop&w=900&q=80"
                  alt="Parent managing kids sports activities"
                  fill
                  sizes="(max-width: 1280px) 50vw, 600px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/20 via-transparent to-transparent" />
              </div>

              {/* Floating badge */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  delay: 0.6,
                  type: "spring",
                  stiffness: 260,
                  damping: 20,
                }}
                className="absolute -right-4 bottom-8 flex items-center gap-3 rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-xl backdrop-blur-md"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                  <Users2 size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    Family Dashboard
                  </p>
                  <p className="text-[10px] text-slate-500">
                    Manage all profiles in one place
                  </p>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>



      {/* ── Testimonials ── */}
      <Testimonials
        title="What Our Users Say"
        subtitle="Testimonials"
        testimonials={testimonials}
      />

      {/* ── Multi-Role Join Section ── */}
      {!user && (
        <section className="relative py-16 sm:py-20 lg:py-24">
          <div className="pointer-events-none absolute -right-32 top-0 h-96 w-96 rounded-full bg-orange-100/25 blur-3xl" />
          <div className="pointer-events-none absolute -left-32 bottom-0 h-96 w-96 rounded-full bg-blue-100/20 blur-3xl" />
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <motion.div
              variants={sectionVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              className="mb-12 text-center"
            >
              <motion.div
                variants={itemVariants}
                className="mb-4 flex justify-center"
              >
                <SectionLabel label="Join the platform" color="slate" />
              </motion.div>
              <motion.h2
                variants={itemVariants}
                className="font-title mb-4 text-3xl font-bold text-slate-900 sm:text-4xl"
              >
                Join Other Parents Today
              </motion.h2>
              <motion.p
                variants={itemVariants}
                className="text-lg text-slate-600"
              >
                Whether you&apos;re a parent booking for your kids, a coach finding students, or a venue owner growing bookings  start today.
              </motion.p>
            </motion.div>

            <motion.div
              variants={sectionVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              className="grid grid-cols-1 gap-6 md:grid-cols-3"
            >
              {/* Parent Card  Featured */}
              <motion.div
                variants={cardVariants}
                whileHover={{ y: -6, scale: 1.015 }}
                transition={{ type: "spring", stiffness: 280, damping: 20 }}
                className="group relative flex flex-col rounded-2xl border-2 border-power-orange/60 bg-gradient-to-b from-orange-50/60 to-white/80 p-8 backdrop-blur-md shadow-[0_8px_40px_-8px_rgba(233,115,22,0.25)] will-change-transform scale-100 md:scale-105"
              >
                <div className="absolute right-0 top-0 rounded-bl-lg rounded-tr-xl bg-power-orange px-4 py-1 text-xs font-bold text-white">
                  FOR PARENTS
                </div>
                <motion.div
                  className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-power-orange text-white shadow-[0_6px_24px_-4px_rgba(233,115,22,0.55)]"
                  whileHover={{ scale: 1.1, rotate: 4 }}
                  transition={{ type: "spring", stiffness: 300, damping: 16 }}
                >
                  <Users2 size={30} />
                </motion.div>
                <h3 className="mb-4 text-center text-xl font-bold text-slate-900">
                  Parents & Guardians
                </h3>
                <ul className="mb-8 grow space-y-3 text-sm text-slate-600">
                  {[
                    "Manage all your children's profiles",
                    "Book vetted coaches & premium venues",
                    "AI roadmap for your child's sport journey",
                    "Get smart alerts for every session",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Check
                        size={14}
                        className="mt-0.5 shrink-0 text-power-orange"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register?role=PLAYER"
                  className="block w-full rounded-xl bg-power-orange px-6 py-3 text-center font-semibold text-white transition-colors hover:bg-orange-600"
                >
                  Create a Family Account
                </Link>
              </motion.div>

              {/* Venue Owner Card */}
              <motion.div
                variants={cardVariants}
                whileHover={{ y: -6, scale: 1.015 }}
                transition={{ type: "spring", stiffness: 280, damping: 20 }}
                className="group flex flex-col rounded-2xl border border-white/60 bg-white/80 p-8 backdrop-blur-md premium-shadow will-change-transform"
              >
                <motion.div
                  className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-indigo-600 text-white shadow-[0_6px_28px_-4px_rgba(99,102,241,0.4)]"
                  whileHover={{ scale: 1.1, rotate: 4 }}
                  transition={{ type: "spring", stiffness: 300, damping: 16 }}
                >
                  <Building2 size={30} />
                </motion.div>
                <h3 className="mb-4 text-center text-xl font-bold text-slate-900">
                  Venue Owners
                </h3>
                <ul className="mb-8 grow space-y-3 text-sm text-slate-600">
                  {[
                    "Reach families actively searching for venues",
                    "Automated booking management",
                    "Real-time availability tracking",
                    "Instant payouts & analytics",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Check
                        size={14}
                        className="mt-0.5 shrink-0 text-indigo-600"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register?role=VENUE_LISTER"
                  className="block w-full rounded-xl bg-slate-900 px-6 py-3 text-center font-semibold text-white transition-colors hover:bg-slate-700"
                >
                  List Your Venue
                </Link>
              </motion.div>

              {/* Coach Card */}
              <motion.div
                variants={cardVariants}
                whileHover={{ y: -6, scale: 1.015 }}
                transition={{ type: "spring", stiffness: 280, damping: 20 }}
                className="group flex flex-col rounded-2xl border border-white/60 bg-white/80 p-8 backdrop-blur-md premium-shadow will-change-transform"
              >
                <motion.div
                  className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-turf-green text-white shadow-[0_6px_24px_-4px_rgba(34,197,94,0.4)]"
                  whileHover={{ scale: 1.1, rotate: 4 }}
                  transition={{ type: "spring", stiffness: 300, damping: 16 }}
                >
                  <Trophy size={30} />
                </motion.div>
                <h3 className="mb-4 text-center text-xl font-bold text-slate-900">
                  Coaches & Trainers
                </h3>
                <ul className="mb-8 grow space-y-3 text-sm text-slate-600">
                  {[
                    "Build your coaching profile",
                    "Connect with serious athletes",
                    "Set your own rates & schedule",
                    "Grow your coaching business",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <Check
                        size={14}
                        className="mt-0.5 shrink-0 text-turf-green"
                      />
                      {item}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/register?role=COACH"
                  className="block w-full rounded-xl bg-turf-green px-6 py-3 text-center font-semibold text-white transition-colors hover:bg-green-700"
                >
                  Become a Coach
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>
      )}

      {/* ── Explore Section  photo-backed cards ── */}
      <section className="py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={sectionVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mb-10 text-center"
          >
            <motion.div
              variants={itemVariants}
              className="mb-4 flex justify-center"
            >
              <SectionLabel label="Ready to Explore?" color="orange" />
            </motion.div>
            <motion.h2
              variants={itemVariants}
              className="font-title mb-2 text-3xl font-bold text-slate-900"
            >
              Your Child&apos;s Next Training Session Starts Here
            </motion.h2>
            <motion.p variants={itemVariants} className="text-slate-600">
              Browse venues, academies, and coaches to plan your child&apos;s next session with confidence
            </motion.p>
          </motion.div>

          <motion.div
            variants={sectionVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="grid gap-5 md:grid-cols-3"
          >
            {[
              {
                href: "/venues",
                img: "https://images.unsplash.com/photo-1519861531473-9200262188bf?auto=format&fit=crop&w=900&q=80",
                icon: <Building2 size={22} />,
                title: "Browse Venues",
                sub: "Explore premium sports venues in your area",
                cta: "View All Venues",
                accent: "from-orange-900/70 via-orange-800/40 to-transparent",
                badge: "bg-power-orange",
              },
              {
                href: "/academies",
                img: "https://images.unsplash.com/photo-1555597673-b21d5c935865?auto=format&fit=crop&w=900&q=80",
                icon: <GraduationCap size={22} />,
                title: "Browse Academies",
                sub: "Explore academies built for training, batches, and development",
                cta: "View All Academies",
                accent: "from-indigo-900/70 via-indigo-800/40 to-transparent",
                badge: "bg-indigo-600",
              },
              {
                href: "/coaches",
                img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=900&q=80",
                icon: <Users size={22} />,
                title: "Find Coaches",
                sub: "Discover expert coaches for professional training",
                cta: "View All Coaches",
                accent: "from-emerald-900/70 via-emerald-800/40 to-transparent",
                badge: "bg-turf-green",
              },
            ].map((card) => (
              <motion.div
                key={card.href}
                variants={cardVariants}
                whileHover={{ y: -6, scale: 1.015 }}
                transition={{ type: "spring", stiffness: 280, damping: 20 }}
                className="will-change-transform"
              >
                <Link
                  href={card.href}
                  className="group relative block h-56 overflow-hidden rounded-2xl shadow-lg premium-shadow sm:h-64 md:h-72"
                >
                  {/* Background image */}
                  <Image
                    src={card.img}
                    alt={card.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-106"
                  />
                  {/* Gradient overlay */}
                  <div
                    className={`absolute inset-0 bg-gradient-to-t ${card.accent}`}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                  {/* Content */}
                  <div className="absolute inset-0 flex flex-col justify-end p-5">
                    <div
                      className={`mb-3 inline-flex w-fit items-center gap-1.5 rounded-lg ${card.badge} px-2.5 py-1 text-xs font-bold text-white`}
                    >
                      {card.icon}
                      {card.title}
                    </div>
                    <p className="mb-3 text-sm text-white/85">{card.sub}</p>
                    <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
                      {card.cta}
                      <ArrowRight
                        size={14}
                        className="transition-transform group-hover:translate-x-1"
                      />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <CTA
        variant="gradient"
        title={
          user
            ? "Ready for Your Next Game?"
            : "Ready to Start Your Sports Journey?"
        }
        description={
          user
            ? "Book your next venue or coach session and stay in rhythm."
            : "Join players, coaches, and venue partners who are building better sports experiences with PowerMySport."
        }
        primaryCTA={{
          label: user ? "Go to Dashboard" : "Get Started Free",
          href: getDashboardLink(),
        }}
        secondaryCTA={{ label: "Learn More", href: "/how-it-works" }}
      />
    </main>
  );
}
