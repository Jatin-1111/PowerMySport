"use client";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { getCommunityAppUrl } from "@/lib/community/url";
import { getDashboardPathByRole } from "@/utils/roleDashboard";
import api from "@/lib/api/client";

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
import { useEffect, useMemo, useState } from "react";
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
  const [platformUsers, setPlatformUsers] = useState<number | null>(null);
  const [roleCounts, setRoleCounts] = useState({
    PLAYER: 0,
    COACH: 0,
    VENUE_LISTER: 0,
  });

  useEffect(() => {
    let isActive = true;
    const loadPlatformUsers = async () => {
      try {
        const response = await api.get("/stats/public");
        if (!isActive) return;
        setPlatformUsers(response.data?.data?.totalUsers ?? null);
        setRoleCounts({
          PLAYER: response.data?.data?.roleCounts?.PLAYER ?? 0,
          COACH: response.data?.data?.roleCounts?.COACH ?? 0,
          VENUE_LISTER: response.data?.data?.roleCounts?.VENUE_LISTER ?? 0,
        });
      } catch {
        if (isActive) {
          setPlatformUsers(null);
          setRoleCounts({ PLAYER: 0, COACH: 0, VENUE_LISTER: 0 });
        }
      }
    };
    void loadPlatformUsers();
    return () => {
      isActive = false;
    };
  }, []);

  const formattedPlatformUsers = useMemo(() => {
    if (platformUsers === null) return "—";
    return new Intl.NumberFormat(undefined, { notation: "compact" }).format(
      platformUsers,
    );
  }, [platformUsers]);

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
      title: "Zero commission launch",
      description:
        "0% platform commission on coach and venue bookings for a limited time. Subscription purchases are charged separately.",
      icon: <TicketPercent className="h-6 w-6" />,
    },
    {
      title: "Book Premium Venues",
      description:
        "Discover top-rated venues with live availability. From badminton courts to cricket grounds, book the right space near you in minutes.",
      icon: FeatureIcons.Location,
    },
    {
      title: "Professional Coach Booking",
      description:
        "Connect with certified coaches for personalized training plans. Book coaching and venue sessions together for a seamless routine.",
      icon: FeatureIcons.Users,
    },
    {
      title: "Manage Your Kids' Sports",
      description:
        "Keep every child profile in one dashboard. Manage dependents, schedules, and sessions without juggling multiple apps.",
      icon: FeatureIcons.Users,
    },
    {
      title: "Secure Payment System",
      description:
        "Pay securely with transparent pricing and no hidden charges. Get instant confirmations, booking summaries, and payment status updates.",
      icon: FeatureIcons.Shield,
    },
    {
      title: "Smart Alerts & Reminders",
      description:
        "Stay on schedule with booking notifications, reminder preferences, and real-time updates when sessions change.",
      icon: FeatureIcons.Lightning,
    },
    {
      title: "Flexible & Transparent Pricing",
      description:
        "Compare pricing across venues and coaches before you book. Choose options that match your budget and schedule.",
      icon: FeatureIcons.CreditCard,
    },
  ];

  const communityFeatures = [
    {
      title: "Ask before you book",
      description:
        "Get recommendations from players and coaches who know the venue, sport, and training setup already.",
      icon: FeatureIcons.Users,
    },
    {
      title: "Read real feedback",
      description:
        "See what local players are saying about venue quality, coaching style, and the overall experience.",
      icon: FeatureIcons.Star,
    },
    {
      title: "Built for every role",
      description:
        "Players, parents, coaches, and venue partners all participate in the same connected sports community.",
      icon: FeatureIcons.Calendar,
    },
  ];

  const testimonials = [
    {
      quote:
        "PowerMySport made training logistics simple for our family. I manage both my son and daughter's schedules, and coach bookings happen in the same flow.",
      author: "Anjali Patel",
      role: "Parent & Player",
      rating: 5,
    },
    {
      quote:
        "As a venue owner, this platform transformed our operations. Real-time visibility and smoother bookings helped us grow revenue significantly.",
      author: "Priya Sharma",
      role: "Venue Owner",
      rating: 5,
    },
    {
      quote:
        "I scaled from a few students to a full weekly roster through PowerMySport. Managing availability and connecting with committed athletes is now effortless.",
      author: "Vikram Singh",
      role: "Professional Coach",
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
        title="The Complete Sports Ecosystem for Your Kids"
        subtitle="Community-First Approach"
        description="Connect with other parents, discuss local coaches and venues, and build the perfect sports roadmap for your children before you book."
        primaryCTA={{
          label: "Join the Community",
          href: communityUrl,
        }}
        secondaryCTA={
          user?.role === "VENUE_LISTER"
            ? { label: "Manage Venues", href: "/venue-lister/inventory" }
            : {
                label: user ? "Go to Dashboard" : "Start Booking Now",
                href: getDashboardLink(),
              }
        }
        gradient
      />

      {/* ── Zero Commission Banner (with image panel) ── */}
      <section className="relative py-10 sm:py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl border border-amber-100/80 bg-[linear-gradient(120deg,#fff7e7_0%,#fffdf4_40%,#f3f9ff_100%)] shadow-sm">
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-amber-200/40 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 left-10 h-44 w-44 rounded-full bg-sky-200/35 blur-3xl" />

            <div className="relative grid gap-8 p-6 sm:p-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
              <motion.div
                variants={sectionVariants}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-80px" }}
              >
                <motion.div variants={itemVariants} className="mb-3">
                  <SectionLabel
                    label="Limited-time zero commission"
                    color="orange"
                  />
                </motion.div>
                <motion.h2
                  variants={itemVariants}
                  className="font-title mt-3 text-2xl font-bold text-slate-900 sm:text-3xl lg:text-4xl"
                >
                  0% platform commission on coach and venue bookings
                </motion.h2>
                <motion.p
                  variants={itemVariants}
                  className="mt-3 text-base text-slate-700 sm:text-lg"
                >
                  Pay only the venue or coach rate plus taxes on bookings.
                  Subscription plans are billed separately with platform fees
                  and applicable taxes.
                </motion.p>
                <motion.div
                  variants={itemVariants}
                  className="mt-6 flex flex-col gap-3 sm:flex-row"
                >
                  <Link href={getDashboardLink()} className="w-full sm:w-auto">
                    <motion.div
                      whileHover={{ y: -2, scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 20,
                      }}
                    >
                      <Button
                        variant="primary"
                        size="lg"
                        className="w-full rounded-xl"
                      >
                        Start booking now
                      </Button>
                    </motion.div>
                  </Link>
                  <Link href="/venues" className="w-full sm:w-auto">
                    <Button
                      variant="outline"
                      size="lg"
                      className="w-full rounded-xl"
                    >
                      Browse venues
                    </Button>
                  </Link>
                </motion.div>
              </motion.div>

              <motion.div
                variants={sectionVariants}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-80px" }}
                className="grid gap-3 sm:grid-cols-2"
              >
                {[
                  {
                    label: "Platform fee",
                    value: "₹0",
                    sub: "On coach and venue bookings",
                  },
                  {
                    label: "Transparent totals",
                    value: "100%",
                    sub: "Venue + coach rates",
                  },
                  {
                    label: "Instant confirmation",
                    value: "Live",
                    sub: "Real-time availability",
                  },
                  {
                    label: "Trust & safety",
                    value: "Secure",
                    sub: "Protected payments",
                  },
                ].map((item, i) => (
                  <motion.div
                    key={item.label}
                    variants={cardVariants}
                    whileHover={{ y: -3, scale: 1.02 }}
                    transition={{ type: "spring", stiffness: 280, damping: 20 }}
                    className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm will-change-transform"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-2 text-3xl font-bold text-power-orange">
                      {item.value}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{item.sub}</p>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Platform Snapshot ── */}
      <section className="relative py-12 sm:py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl border border-slate-200/70 bg-white/85 p-6 shadow-sm backdrop-blur-sm sm:p-8">
            <motion.div
              variants={sectionVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
            >
              <motion.div
                variants={itemVariants}
                className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"
              >
                <div>
                  <SectionLabel label="Platform Snapshot" color="slate" />
                  <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                    PowerMySport Community by Role
                  </h2>
                </div>
                <p className="text-sm text-slate-600">
                  Total users:{" "}
                  <span className="font-bold text-slate-900">
                    {formattedPlatformUsers}
                  </span>
                </p>
              </motion.div>

              <motion.div
                variants={sectionVariants}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, margin: "-80px" }}
                className="mt-6 grid gap-4 sm:grid-cols-3"
              >
                {[
                  {
                    label: "Players",
                    count: roleCounts.PLAYER,
                    color: "text-power-orange",
                  },
                  {
                    label: "Coaches",
                    count: roleCounts.COACH,
                    color: "text-turf-green",
                  },
                  {
                    label: "Venues",
                    count: roleCounts.VENUE_LISTER,
                    color: "text-blue-600",
                  },
                ].map((item) => (
                  <motion.div
                    key={item.label}
                    variants={cardVariants}
                    whileHover={{ y: -4, scale: 1.015 }}
                    transition={{ type: "spring", stiffness: 280, damping: 20 }}
                    className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 will-change-transform"
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                      {item.label}
                    </p>
                    <p className={`mt-2 text-3xl font-bold ${item.color}`}>
                      {new Intl.NumberFormat(undefined, {
                        notation: "compact",
                      }).format(item.count)}
                    </p>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <Features
        title="Everything You Need To Train, Play, and Improve"
        subtitle="Why Choose PowerMySport"
        description="Built for players, parents, coaches, and venue partners who want speed, clarity, and reliability in every booking."
        features={features}
        columns={3}
        variant="centered"
      />

      {/* ── Community Features ── */}
      <Features
        title="A Community System That Helps You Decide Faster"
        subtitle="Community System"
        description="PowerMySport connects discovery, reviews, and discussion so you can make better sporting decisions with local context instead of guesswork."
        features={communityFeatures}
        columns={3}
        variant="centered"
      />

      <CTA
        variant="gradient"
        title="Join the community before you book"
        description="Check what other players, parents, coaches, and venue owners are discussing, then move into booking with more confidence."
        primaryCTA={{ label: "Open Community", href: communityUrl }}
        secondaryCTA={{
          label: user ? "Go to Dashboard" : "Start Booking Now",
          href: getDashboardLink(),
        }}
      />

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
                Manage Your Kids&apos; Sports Journey
              </motion.h2>
              <motion.p
                variants={itemVariants}
                className="mb-10 text-lg text-slate-600"
              >
                Add multiple child profiles and handle bookings, training plans,
                and progress tracking from one simple parent dashboard.
              </motion.p>

              <motion.div variants={sectionVariants} className="space-y-4">
                {[
                  {
                    icon: <Users2 size={22} />,
                    title: "Add Multiple Kids",
                    desc: "Add unlimited dependents to your account. Track each child's age, sports interests, and training needs separately.",
                    color: "bg-indigo-100 text-indigo-600",
                  },
                  {
                    icon: <Trophy size={22} />,
                    title: "Book Venues & Coaches",
                    desc: "Book premium venues for your kids and connect them with professional coaches for specialized training.",
                    color: "bg-orange-100 text-power-orange",
                  },
                  {
                    icon: <Zap size={22} />,
                    title: "Track Sessions",
                    desc: "Monitor upcoming sessions, booking history, and review-ready completed bookings from one dashboard.",
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
              How It Works
            </motion.h2>
            <motion.p
              variants={itemVariants}
              className="text-lg text-slate-600"
            >
              Get personalized AI guidance and community support before you book
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
                  title: "Add Child Profile",
                  desc: "Provide basic details about your child like age, interests, and weekly commitment goals.",
                },
                {
                  step: 2,
                  title: "Get AI Sports Roadmap",
                  desc: "Our AI generates a customized sports roadmap and actionable guidance based on your child's data.",
                },
                {
                  step: 3,
                  title: "Ask the Community",
                  desc: "Have questions left? Talk to other parents and experienced coaches in our community forum.",
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
                Join PowerMySport
              </motion.h2>
              <motion.p
                variants={itemVariants}
                className="text-lg text-slate-600"
              >
                Choose your role and unlock better training and booking
                experiences
              </motion.p>
            </motion.div>

            <motion.div
              variants={sectionVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              className="grid grid-cols-1 gap-6 md:grid-cols-3"
            >
              {/* Player Card */}
              <motion.div
                variants={cardVariants}
                whileHover={{ y: -6, scale: 1.015 }}
                transition={{ type: "spring", stiffness: 280, damping: 20 }}
                className="group flex flex-col rounded-2xl border border-white/60 bg-white/80 p-8 backdrop-blur-md premium-shadow will-change-transform"
              >
                <motion.div
                  className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-power-orange text-white shadow-[0_6px_24px_-4px_rgba(233,115,22,0.4)]"
                  whileHover={{ scale: 1.1, rotate: 4 }}
                  transition={{ type: "spring", stiffness: 300, damping: 16 }}
                >
                  <UserIcon size={30} />
                </motion.div>
                <h3 className="mb-4 text-center text-xl font-bold text-slate-900">
                  Players & Parents
                </h3>
                <ul className="mb-8 grow space-y-3 text-sm text-slate-600">
                  {[
                    "Book premium venues instantly",
                    "Find & book professional coaches",
                    "Manage kids' sports activities",
                    "Booking reminders & notifications",
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
                  className="block w-full rounded-xl bg-slate-900 px-6 py-3 text-center font-semibold text-white transition-colors hover:bg-slate-700"
                >
                  Start Booking Now
                </Link>
              </motion.div>

              {/* Venue Owner Card — Featured */}
              <motion.div
                variants={cardVariants}
                whileHover={{ y: -6, scale: 1.015 }}
                transition={{ type: "spring", stiffness: 280, damping: 20 }}
                className="group relative flex flex-col rounded-2xl border-2 border-power-orange/60 bg-gradient-to-b from-orange-50/60 to-white/80 p-8 backdrop-blur-md shadow-[0_8px_40px_-8px_rgba(233,115,22,0.25)] will-change-transform scale-100 md:scale-105"
              >
                <div className="absolute right-0 top-0 rounded-bl-lg rounded-tr-xl bg-power-orange px-4 py-1 text-xs font-bold text-white">
                  FEATURED
                </div>
                <motion.div
                  className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-power-orange text-white shadow-[0_6px_28px_-4px_rgba(233,115,22,0.55)]"
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
                    "Reach players actively searching for venues",
                    "Automated booking management",
                    "Real-time availability tracking",
                    "Instant payouts & analytics",
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
                  href="/register?role=VENUE_LISTER"
                  className="block w-full rounded-xl bg-power-orange px-6 py-3 text-center font-semibold text-white transition-colors hover:bg-orange-600"
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

      {/* ── Explore Section — photo-backed cards ── */}
      <section className="py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={sectionVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mb-10 text-center"
          >
            <motion.h2
              variants={itemVariants}
              className="font-title mb-2 text-3xl font-bold text-slate-900"
            >
              Start Exploring
            </motion.h2>
            <motion.p variants={itemVariants} className="text-slate-600">
              Browse venues, academies, and coaches to plan your next session
              with confidence
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
