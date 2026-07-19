"use client";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { CTA } from "@/modules/marketing/components/marketing/CTA";
import { FeaturesShowcase } from "@/modules/marketing/components/marketing/FeaturesShowcase";
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
  MessageCircle,
  Search,
  Sparkles,
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

  // ── Why Parents Choose Us: the 3-step journey ──
  const features = [
    {
      label: "Not sure which sport?",
      title: "Do the Profile Assessment",
      description:
        "Answer a few quick questions about your child's age, personality, and physical traits. If you don't already know which sport fits best, our assessment finds it for you.",
      icon: <Sparkles className="h-6 w-6" />,
      stat: "Takes about 5 minutes",
    },
    {
      label: "Where do we start?",
      title: "Discover Pathways",
      description:
        "Get a clear, personalised roadmap for that sport—what to focus on now, the milestones that matter, and exactly what comes next.",
      icon: <Map className="h-6 w-6" />,
      stat: "Built in 2 minutes",
    },
    {
      label: "Still have questions?",
      title: "Consult an Expert",
      description:
        "Talk to a real sports expert, or reach out to our team directly for hands-on assistance—free, no hard sell.",
      icon: <MessageCircle className="h-6 w-6" />,
      stat: "Free, no commitment",
    },
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
        title="Discover the Right Sport for your child"
        titleHighlight="Right Sport"
        description="AI-powered guidance, trusted experts and a community that helps parents make better sports decisions."
        primaryCTA={
          user?.role === "VenueLister"
            ? { label: "Manage Venues", href: "/venue-lister/inventory" }
            : { label: "Start Assessment", href: "/assessment" }
        }
        secondaryCTA={{
          label: "Sports Pathways",
          href: "/roadmap",
        }}
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

      {/* ── Why Parents Choose Us ── */}
      <FeaturesShowcase
        title="From Guesswork to a Clear Plan"
        subtitle="Why Parents Choose Us"
        description="Three simple steps take you from not knowing where to start, to a clear plan for your child's sports journey."
        features={features}
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
                    cta: { label: "Chat on WhatsApp", href: "https://wa.me/918968582443?text=Hi%21%20I%20found%20PowerMySport%20and%20would%20like%20to%20know%20more%20about%20sports%20guidance%20for%20my%20child." },
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
              className="relative hidden w-full max-w-[612px] aspect-[3/2] mx-auto lg:block"
            >
              <div className="absolute inset-4 rounded-3xl bg-orange-100/25 blur-2xl" />
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
                  src="https://media.istockphoto.com/id/1496936307/photo/young-boy-watching-british-indian-mother-working-at-home.jpg?s=612x612&w=0&k=20&c=KOg86wvMpgJe42K-2i3UKdcuOD7egEWcxHO1n3WHtl8="
                  alt="Parent planning their child's sports journey"
                  fill
                  sizes="(max-width: 1280px) 50vw, 600px"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-slate-900/10" />
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

      {/* ── Testimonials ── */}
      <TrustMarquee />

      {/* ── Final CTA ── */}
      <CTA
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
        secondaryCTA={{ label: "Chat on WhatsApp", href: "https://wa.me/918968582443?text=Hi%21%20I%20found%20PowerMySport%20and%20would%20like%20to%20know%20more%20about%20sports%20guidance%20for%20my%20child." }}
      />
    </main>
  );
}
