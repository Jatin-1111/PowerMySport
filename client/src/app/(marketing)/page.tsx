"use client";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { CTA } from "@/modules/marketing/components/marketing/CTA";
import { FeaturesShowcase } from "@/modules/marketing/components/marketing/FeaturesShowcase";
import { Hero } from "@/modules/marketing/components/marketing/Hero";
import { SectionLabel } from "@/modules/marketing/components/marketing/SectionLabel";
import { TrustMarquee } from "@/modules/marketing/components/marketing/TrustMarquee";
import {
  Activity,
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  Compass,
  HelpCircle,
  Map,
  MessageCircle,
  Search,
  Sparkles,
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

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "PowerMySport",
    url: siteUrl,
    logo: `${siteUrl}/icon.svg`,
    description:
      "PowerMySport helps parents plan their child's sports journey with AI-powered pathways, personalised guidance, and verified expert sessions across India.",
    foundingDate: "2024",
    areaServed: "IN",
    audience: {
      "@type": "Audience",
      audienceType: "Parents of young athletes in India",
    },
    sameAs: [],
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "PowerMySport",
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/roadmap?sport={search_term_string}`,
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

  // ── Why Parents Choose Us: two journeys, depending on where you're starting from ──
  const pathwaysStep = {
    label: "Where do we start?",
    title: "Discover Pathways",
    description:
      "Get a clear, personalised roadmap for that sport—what to focus on now, the milestones that matter, and exactly what comes next.",
    icon: <Map className="h-6 w-6" />,
    stat: "Built in 2 minutes",
  };
  const expertStep = {
    label: "Still have questions?",
    title: "Consult an Expert",
    description:
      "Talk to a real sports expert, or reach out to our team directly for hands-on assistance—free, no hard sell.",
    icon: <MessageCircle className="h-6 w-6" />,
    stat: "Free, no commitment",
  };
  const screeningStep = {
    label: "Ready for the next step?",
    title: "Book a Physical Screening",
    description:
      "Bring your child in for a hands-on session with a certified coach—we validate the online result against real movement, strength, and coordination.",
    icon: <Activity className="h-6 w-6" />,
    stat: "Book anytime after your results",
  };

  const discoverFeatures = [
    {
      label: "Not sure which sport?",
      title: "Do the Profile Assessment",
      description:
        "Answer a few quick questions about your child's age, personality, and physical traits. If you don't already know which sport fits best, our assessment finds it for you.",
      icon: <Sparkles className="h-6 w-6" />,
      stat: "Takes about 5 minutes",
    },
    screeningStep,
    pathwaysStep,
    expertStep,
  ];

  const knownSportFeatures = [
    {
      label: "Already know it?",
      title: "Build the Sport Profile",
      description:
        "Tell us your child's sport, age, and experience level—we personalise everything downstream around exactly where they are today.",
      icon: <CheckCircle2 className="h-6 w-6" />,
      stat: "Takes about 5 minutes",
    },
    pathwaysStep,
    expertStep,
  ];

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
        title="Guiding Your Child's Sporting Journey"
        titleHighlight="Sporting Journey"
        description="AI-powered guidance, trusted experts and a community that helps parents make better sports decisions."
        ctaPrompt={
          user?.role === "VenueLister"
            ? undefined
            : "Does your child already play a sport?"
        }
        primaryCTA={
          user?.role === "VenueLister"
            ? { label: "Manage Venues", href: "/venue-lister/inventory" }
            : { label: "Yes, build their profile", href: "/sport-profile" }
        }
        secondaryCTA={
          user?.role === "VenueLister"
            ? undefined
            : { label: "Not yet, help me find one", href: "/assessment/discover" }
        }
      />

      {/* ── The Problem ── */}
      <section className="relative overflow-hidden py-16 sm:py-20 lg:py-24">
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
                className="group flex items-start gap-3 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-200/70"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition-colors duration-300 group-hover:bg-power-orange/10 group-hover:text-power-orange">
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

      {/* ── Why Parents Choose Us ── */}
      <FeaturesShowcase
        title="From Guesswork to a Clear Plan"
        subtitle="Why Parents Choose Us"
        description="Whether you're still deciding or already know the sport, here's exactly what happens next."
        tracks={[
          { key: "discover", label: "Not sure which sport?", features: discoverFeatures },
          { key: "known", label: "Already know the sport?", features: knownSportFeatures },
        ]}
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
                <SectionLabel label="Knowledge Centre" color="green" />
              </motion.div>
              <motion.h2
                variants={itemVariants}
                className="font-title mb-4 text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl"
              >
                Know more before you decide
              </motion.h2>
              <motion.p
                variants={itemVariants}
                className="mb-8 text-lg text-slate-600"
              >
                Free resources to explore right now—no commitment, no account
                needed.
              </motion.p>

              <motion.div variants={sectionVariants} className="space-y-4">
                {[
                  {
                    icon: <Map size={22} />,
                    title: "Understand Sports Pathways",
                    desc: "See the step-by-step roadmap for any sport—milestones, timelines, and what it takes to go further.",
                    color: "bg-orange-50 text-power-orange ring-1 ring-orange-200/60",
                    cta: { label: "Explore", href: "/roadmap" },
                  },
                  {
                    icon: <Users2 size={22} />,
                    title: "Learn from Other Parents",
                    desc: "Real questions, real experiences—see how other families navigated the same decisions.",
                    color: "bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200/60",
                    cta: { label: "Community", href: "/community" },
                  },
                ].map((item) => (
                  <motion.div
                    key={item.title}
                    variants={cardVariants}
                    whileHover={{ y: -4 }}
                    transition={{ type: "spring", stiffness: 280, damping: 20 }}
                    className="flex flex-col gap-4 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-shadow duration-300 will-change-transform hover:shadow-xl hover:shadow-slate-200/60 sm:flex-row sm:items-center"
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

            {/* Right: layered image composition */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 26,
                delay: 0.15,
              }}
              className="relative hidden w-full max-w-[612px] mx-auto lg:block"
            >
              {/* Offset backdrop panel */}
              <div
                aria-hidden
                className="absolute -inset-x-6 -bottom-6 top-10 rounded-[2.5rem] bg-gradient-to-br from-orange-100/50 via-orange-50/30 to-indigo-50/40"
              />
              {/* Dotted accent */}
              <div
                aria-hidden
                className="absolute -right-7 -top-7 h-28 w-28 opacity-50"
                style={{
                  backgroundImage:
                    "radial-gradient(circle, rgba(233,115,22,0.35) 1.5px, transparent 1.5px)",
                  backgroundSize: "14px 14px",
                }}
              />

              <div className="group relative aspect-[3/2] overflow-hidden rounded-[2rem] shadow-2xl shadow-slate-900/10 ring-1 ring-slate-900/5">
                <Image
                  src="https://media.istockphoto.com/id/1496936307/photo/young-boy-watching-british-indian-mother-working-at-home.jpg?s=612x612&w=0&k=20&c=KOg86wvMpgJe42K-2i3UKdcuOD7egEWcxHO1n3WHtl8="
                  alt="Parent planning their child's sports journey"
                  fill
                  sizes="(max-width: 1280px) 50vw, 600px"
                  className="object-cover transition-transform duration-700 will-change-transform group-hover:scale-[1.04]"
                />
                {/* Legibility gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-slate-950/10 to-transparent" />
                {/* Inset hairline frame */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-3 rounded-[1.5rem] ring-1 ring-white/20"
                />

                {/* Glass caption — single, integrated overlay */}
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/10 px-4 py-3.5 backdrop-blur-xl transition-colors duration-300 group-hover:bg-white/15">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-power-orange text-white shadow-lg shadow-orange-950/40">
                      <Map size={17} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white">
                        Learn before you decide
                      </p>
                      <p className="text-[11px] text-white/60">
                        Pathways · Community
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-300/25 bg-emerald-400/15 px-3 py-1.5 text-[11px] font-semibold text-emerald-200">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                    Free to start
                  </span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <TrustMarquee />

      {/* ── Final CTA ── */}
      <CTA
        title="All Set to Play?"
        description="From booking a trial class to finding the right academy—our team can help with any sports service your child needs, every step of the way."
        primaryCTA={{
          label: user ? "Go to Roadmap" : "Explore Your Roadmap",
          href: "/roadmap",
        }}
        secondaryCTA={{ label: "Chat on WhatsApp", href: "https://wa.me/918968582443?text=Hi%21%20I%20found%20PowerMySport%20and%20would%20like%20to%20know%20more%20about%20sports%20guidance%20for%20my%20child." }}
      />
    </main>
  );
}
