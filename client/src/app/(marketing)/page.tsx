"use client";
import { getCommunityAppUrl } from "@/lib/community/url";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { getDashboardPathByRole } from "@/utils/roleDashboard";

import { CTA } from "@/modules/marketing/components/marketing/CTA";
import { Features } from "@/modules/marketing/components/marketing/Features";
import { Hero } from "@/modules/marketing/components/marketing/Hero";
import { SectionLabel } from "@/modules/marketing/components/marketing/SectionLabel";
import { TrustMarquee } from "@/modules/marketing/components/marketing/TrustMarquee";
import {
  ArrowRight,
  BrainCircuit,
  Building2,
  Check,
  Clock,
  Compass,
  HelpCircle,
  Map,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Users2,
} from "lucide-react";

import { motion, Variants } from "framer-motion";
import Image from "next/image";
import Link from "next/link";

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

  // ── The everyday confusion parents face ──
  const problems = [
    {
      icon: <HelpCircle className="h-5 w-5" />,
      text: "Which sport actually suits my child?",
    },
    {
      icon: <Compass className="h-5 w-5" />,
      text: "Where do we even begin?",
    },
    {
      icon: <Search className="h-5 w-5" />,
      text: "Is this coach or academy any good?",
    },
    {
      icon: <Clock className="h-5 w-5" />,
      text: "Are we wasting time and money?",
    },
  ];

  // ── How the live product solves it (Explore: Roadmap + Guidance) ──
  const features = [
    {
      label: "Which sport is right?",
      title: "A Plan Made for Your Child",
      description:
        "Tell us your child's age, interests, and free time. We build a personalised sports roadmap just for them—no two plans are the same.",
      icon: <Sparkles className="h-6 w-6" />,
      image:
        "https://images.unsplash.com/photo-1505250469679-203ad9ced0cb?auto=format&fit=crop&w=1200&q=80",
    },
    {
      label: "Where do we start?",
      title: "A Clear Step-by-Step Path",
      description:
        "See exactly what to focus on now and what comes next, from the very first session to competing—so you're never guessing the next move.",
      icon: <Map className="h-6 w-6" />,
      image:
        "https://images.unsplash.com/photo-1584415942461-0b87dda9cc2b?auto=format&fit=crop&w=800&q=80",
    },
    {
      label: "Too much conflicting advice",
      title: "Guidance From Real Experts",
      description:
        "Stuck on a decision? Get answers from sports experts and our AI guide, built around your child's goals—not generic internet tips.",
      icon: <BrainCircuit className="h-6 w-6" />,
      image:
        "https://images.unsplash.com/photo-1526232761682-d26e03ac148e?auto=format&fit=crop&w=800&q=80",
    },
    {
      label: "What does 'good' even look like?",
      title: "Know What to Aim For",
      description:
        "Understand the levels, milestones, and tournaments that matter for your child's sport, so progress finally feels clear.",
      icon: <Target className="h-6 w-6" />,
      image:
        "https://images.unsplash.com/photo-1507626614093-a8b16cfbfd00?auto=format&fit=crop&w=800&q=80",
    },
    {
      label: "Everything is scattered",
      title: "It's All in One Place",
      description:
        "Your child's plan, guidance, and next steps live in one simple dashboard—no more juggling WhatsApp groups, notes, and phone calls.",
      icon: <Users2 className="h-6 w-6" />,
      image:
        "https://images.unsplash.com/photo-1531347118459-c3ea7a5ac61e?auto=format&fit=crop&w=800&q=80",
    },
    {
      label: "Costs add up fast",
      title: "Decide Before You Spend",
      description:
        "Get a clear picture of the time and money a sport really takes—so you commit with confidence, not on a hunch.",
      icon: <ShieldCheck className="h-6 w-6" />,
      image:
        "https://images.unsplash.com/photo-1503486579284-2418f27ccaf7?auto=format&fit=crop&w=800&q=80",
    },
  ];

  const getDashboardLink = () => {
    if (!user) return "/register?role=PLAYER";
    return getDashboardPathByRole(user.role);
  };

  return (
    <main>
      <script
        id="organization-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        id="website-jsonld"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />

      {/* ── Hero ── */}
      <Hero
        variant="home"
        title="Your child's gateway to a dream sports career"
        subtitle="Built for Busy Parents"
        description="PowerMySport is a sports guidance platform for parents that helps you understand, plan, and execute your child's sports journey. All this with the help of experts on call."
        primaryCTA={
          user?.role === "VenueLister"
            ? { label: "Manage Venues", href: "/venue-lister/inventory" }
            : {
                label: user ? "Go to Roadmap" : "Build a Sports Plan",
                href: "/roadmap",
              }
        }
        secondaryCTA={{
          label: "Explore the Community",
          href: communityUrl,
        }}
        gradient
      />

      {/* ── The Problem ── */}
      <section className="relative overflow-hidden py-16 sm:py-20 lg:py-24">
        <div className="pointer-events-none absolute left-1/2 top-0 h-72 w-[120%] -translate-x-1/2 bg-gradient-to-b from-slate-100/50 to-transparent" />
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={sectionVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mx-auto max-w-2xl text-center"
          >
            <motion.div
              variants={itemVariants}
              className="mb-4 flex justify-center"
            >
              <SectionLabel label="Sound Familiar?" color="slate" />
            </motion.div>
            <motion.h2
              variants={itemVariants}
              className="font-title mb-4 text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl"
            >
              Youth sports is challenging. You&apos;re not alone.
            </motion.h2>
            <motion.p
              variants={itemVariants}
              className="text-lg text-slate-600"
            >
              Every parent wants the best for their child. But between scattered
              advice, endless options, and no clear path, it&apos;s hard to know
              if you&apos;re making the right call.
            </motion.p>
          </motion.div>

          <motion.div
            variants={sectionVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {problems.map((p) => (
              <motion.div
                key={p.text}
                variants={cardVariants}
                className="flex items-start gap-3 rounded-2xl border border-slate-200/70 bg-white/70 p-5 backdrop-blur-sm"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  {p.icon}
                </span>
                <p className="text-sm font-medium leading-snug text-slate-700">
                  &ldquo;{p.text}&rdquo;
                </p>
              </motion.div>
            ))}
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="mx-auto mt-12 max-w-2xl text-center text-lg font-medium text-slate-800"
          >
            PowerMySport turns that confusion into one{" "}
            <span className="text-power-orange">clear, personalised plan</span>{" "}
            for your child.
          </motion.p>
        </div>
      </section>

      {/* ── How We Solve It (MVP value) ── */}
      <Features
        title="From Guesswork to a Clear Plan"
        subtitle="Why Parents Choose Us"
        description="We built PowerMySport to take the stress out of your child's sports journey. Here's how we make the hardest decisions simple."
        features={features}
        variant="bento"
      />

      {/* ── Available Now: Explore (Roadmap + Guidance) ── */}
      <section className="relative overflow-hidden py-16 sm:py-20 lg:py-24">
        <div className="pointer-events-none absolute -left-32 top-1/4 h-80 w-80 rounded-full bg-orange-100/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 bottom-1/4 h-80 w-80 rounded-full bg-indigo-100/25 blur-3xl" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1fr]">
            {/* Left: copy + capability cards */}
            <motion.div
              variants={sectionVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-100px" }}
            >
              <motion.div variants={itemVariants} className="mb-3">
                <SectionLabel label="Available Now" color="green" />
              </motion.div>
              <motion.h2
                variants={itemVariants}
                className="font-title mb-4 text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl"
              >
                Start with a clear plan—today
              </motion.h2>
              <motion.p
                variants={itemVariants}
                className="mb-8 text-lg text-slate-600"
              >
                Two simple tools, free to use right now. Get your child&apos;s
                personalised roadmap and expert guidance before you commit to
                anything.
              </motion.p>

              <motion.div variants={sectionVariants} className="space-y-4">
                {[
                  {
                    icon: <Map size={22} />,
                    title: "Sports Roadmap",
                    desc: "A step-by-step plan for your child's sport—what to learn, when, and what to aim for.",
                    color: "bg-orange-100 text-power-orange",
                    cta: { label: "Build a Sports Plan", href: "/roadmap" },
                  },
                  {
                    icon: <BrainCircuit size={22} />,
                    title: "Expert Guidance",
                    desc: "Answers to your toughest questions from sports experts and our AI guide—on call, whenever you need.",
                    color: "bg-indigo-100 text-indigo-600",
                    cta: { label: "Get Free Guidance", href: "/guidance" },
                  },
                ].map((item) => (
                  <motion.div
                    key={item.title}
                    variants={cardVariants}
                    whileHover={{ y: -4 }}
                    transition={{ type: "spring", stiffness: 280, damping: 20 }}
                    className="flex flex-col gap-4 rounded-2xl border border-white/70 bg-white/80 p-5 backdrop-blur-sm premium-shadow will-change-transform sm:flex-row sm:items-center"
                  >
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${item.color}`}
                    >
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="mb-1 font-bold text-slate-900">
                        {item.title}
                      </h3>
                      <p className="text-sm leading-relaxed text-slate-600">
                        {item.desc}
                      </p>
                    </div>
                    <Link
                      href={item.cta.href}
                      className="group inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
                    >
                      {item.cta.label}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>

            {/* Right: clipped image */}
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
              <div className="absolute inset-4 rounded-3xl bg-gradient-to-br from-orange-400/15 via-transparent to-indigo-400/10 blur-2xl" />
              <svg
                viewBox="0 0 200 200"
                className="pointer-events-none absolute -left-6 -top-6 h-40 w-40 opacity-50"
                aria-hidden
              >
                <polygon
                  points="8,0 200,0 200,192 192,200 0,200 0,8"
                  fill="none"
                  stroke="rgba(233,115,22,0.2)"
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
                  alt="Parent planning their child's sports journey"
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
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-100 text-power-orange">
                  <Compass size={18} />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-900">
                    Free to start
                  </p>
                  <p className="text-[10px] text-slate-500">
                    No card. No commitment.
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
              Up and Running in 3 Steps
            </motion.h2>
            <motion.p
              variants={itemVariants}
              className="text-lg text-slate-600"
            >
              Go from &ldquo;where do I start?&rdquo; to a clear plan for your
              child in minutes—completely free.
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
                  title: "Tell Us About Your Child",
                  desc: "Share your child's age, sports interests, and how many hours a week they can commit. Takes 2 minutes.",
                },
                {
                  step: 2,
                  title: "Get an AI Sports Roadmap",
                  desc: "We build a personalised roadmap—which sport suits your child, what to focus on first, and what to aim for.",
                },
                {
                  step: 3,
                  title: "Get Guidance on Every Step",
                  desc: "Stuck on a decision? Lean on expert and AI guidance to move forward with confidence—no guesswork.",
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
      <TrustMarquee />

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
                Start Free Today
              </motion.h2>
              <motion.p
                variants={itemVariants}
                className="text-lg text-slate-600"
              >
                Parents can build a plan right now. Coaches and venues can
                register early to get ready for our booking launch.
              </motion.p>
            </motion.div>

            <motion.div
              variants={sectionVariants}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, margin: "-80px" }}
              className="grid grid-cols-1 gap-6 md:grid-cols-3"
            >
              {/* Parent Card — Featured */}
              <motion.div
                variants={cardVariants}
                whileHover={{ y: -6, scale: 1.015 }}
                transition={{ type: "spring", stiffness: 280, damping: 20 }}
                className="group relative flex flex-col rounded-2xl border-2 border-power-orange/60 bg-gradient-to-b from-orange-50/60 to-white/80 p-8 backdrop-blur-md shadow-[0_8px_40px_-8px_rgba(233,115,22,0.25)] will-change-transform scale-100 md:scale-105"
              >
                <div className="absolute right-0 top-0 rounded-bl-lg rounded-tr-xl bg-power-orange px-4 py-1 text-xs font-bold text-white">
                  AVAILABLE NOW
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
                    "A personalised roadmap for your child's sport",
                    "Expert + AI guidance, on call",
                    "Know what to aim for at every age",
                    "Free to start—no card needed",
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
                  href="/roadmap"
                  className="block w-full rounded-xl bg-power-orange px-6 py-3 text-center font-semibold text-white transition-colors hover:bg-orange-600"
                >
                  Build a Sports Plan
                </Link>
              </motion.div>

              {/* Venue Owner Card */}
              <motion.div
                variants={cardVariants}
                whileHover={{ y: -6, scale: 1.015 }}
                transition={{ type: "spring", stiffness: 280, damping: 20 }}
                className="group flex flex-col rounded-2xl border border-white/60 bg-white/80 p-8 backdrop-blur-md premium-shadow will-change-transform"
              >
                <div className="mb-4 flex justify-center">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Coming in Phase 2
                  </span>
                </div>
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
                    "Reach families actively planning their sport",
                    "Be ready the day bookings go live",
                    "Simple availability & listing tools",
                    "Early-partner onboarding support",
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
                  Register Early
                </Link>
              </motion.div>

              {/* Coach Card */}
              <motion.div
                variants={cardVariants}
                whileHover={{ y: -6, scale: 1.015 }}
                transition={{ type: "spring", stiffness: 280, damping: 20 }}
                className="group flex flex-col rounded-2xl border border-white/60 bg-white/80 p-8 backdrop-blur-md premium-shadow will-change-transform"
              >
                <div className="mb-4 flex justify-center">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Coming in Phase 2
                  </span>
                </div>
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
                    "Build your coaching profile now",
                    "Connect with serious families at launch",
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
                  Register Early
                </Link>
              </motion.div>
            </motion.div>
          </div>
        </section>
      )}

      {/* ── Final CTA ── */}
      <CTA
        variant="gradient"
        title={
          user
            ? user.userType === "Parent"
              ? "Ready for Your Child's Next Step?"
              : "Ready for Your Next Step?"
            : "Ready to Build Your Sports Plan?"
        }
        description={
          user
            ? user.userType === "Parent"
              ? "Jump back into your child's roadmap and get guidance on what comes next."
              : "Jump back into your roadmap and get guidance on what comes next."
            : "Get a clear, personalised roadmap and expert guidance—free, in just a few minutes."
        }
        primaryCTA={{
          label: user ? "Go to Roadmap" : "Build a Sports Plan",
          href: "/roadmap",
        }}
        secondaryCTA={{ label: "Get Free Guidance", href: "/guidance" }}
      />
    </main>
  );
}
