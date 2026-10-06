"use client";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { AskSection } from "@/modules/marketing/components/marketing/AskSection";
import { CTA } from "@/modules/marketing/components/marketing/CTA";
import { FeaturesShowcase } from "@/modules/marketing/components/marketing/FeaturesShowcase";
import { Hero } from "@/modules/marketing/components/marketing/Hero";
import { SectionLabel } from "@/modules/marketing/components/marketing/SectionLabel";
import { PathwayPreviewCard } from "@/modules/pathway/components/PathwayPreviewCard";
import { roadmapHref } from "@/modules/pathway/data/sports";
import type { PathwayGuideSummary, TournamentEdition } from "@/modules/pathway/services/pathway";
import { NextTournamentsSection } from "@/modules/tournaments/components/NextTournamentsSection";
import {
  ArrowRight,
  Building2,
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

import Link from "next/link";

// Section reveals use the `.reveal-on-scroll` utility in globals.css. The
// framer-motion stagger this replaced left the homepage's copy at `opacity: 0`
// in the server HTML until hydration ran. The hero keeps its own scroll-linked
// motion — that one is a deliberate effect, not a reveal.

export default function HomeClient({
  pathway,
  tournaments,
}: {
  pathway: PathwayGuideSummary | null;
  tournaments: { editions: TournamentEdition[]; sportSlug: string; sportLabel: string };
}) {
  const { user } = useAuthStore();

  // ── Personalize the hero for a logged-in parent ──
  // Guests (and the loading/unhydrated state) fall through to the original
  // generic hero below — only a real `user` changes any of this.
  const isVenueLister = user?.role === "VenueLister";
  const firstName = user?.name?.split(" ")[0];
  const dependents = user?.dependents ?? [];
  // Most relevant child: one who's already picked a sport (via the assessment
  // results screen, `chosenSport`) or already told us what they play (via the
  // profile's "Sport & setup" step, `sportsFocus`) — either counts as "knows
  // their sport" for the hero. Else one with finished assessment results,
  // else just the first profile on the account.
  const primaryDependent =
    dependents.find((d) => d.sport?.chosenSport || d.sport?.sportsFocus?.length) ??
    dependents.find((d) => d.sport?.wizardCompletedAt) ??
    dependents[0];
  // `chosenSport` is the assessment's own pick; `sportsFocus[0]` is what the
  // parent told us directly. Either is "the sport" for hero purposes.
  const effectiveSport =
    primaryDependent?.sport?.chosenSport || primaryDependent?.sport?.sportsFocus?.[0];
  const chosenMatch = primaryDependent?.sport?.sportMatches?.find(
    (m) => m.sport === primaryDependent.sport?.chosenSport
  );
  // The greeting rides on the CTA prompt line rather than a separate badge —
  // "Jatin, ready to find Aarav's sport?" instead of "Does your child...".
  // `sentence` is always lowercase-first so it reads naturally either way.
  const greet = (sentence: string) =>
    firstName ? `${firstName}, ${sentence}` : sentence.charAt(0).toUpperCase() + sentence.slice(1);

  let heroCtaPrompt: string | undefined = greet("does your child already play a sport?");
  let heroPrimaryCTA = { label: "Yes, help me navigate", href: "/sport-profile" };
  let heroSecondaryCTA: { label: string; href: string } | undefined = {
    label: "No, help me find a sport",
    href: "/assessment/discover",
  };
  let heroStats: Array<{ label: string; value: string; helper?: string }> | undefined;

  if (isVenueLister) {
    heroCtaPrompt = firstName ? `Welcome back, ${firstName}` : undefined;
    heroPrimaryCTA = { label: "Manage Venues", href: "/venue-lister/inventory" };
    heroSecondaryCTA = undefined;
  } else if (user && primaryDependent && effectiveSport) {
    // Already knows the sport — either chosen via the assessment or told to
    // us directly — get them back to it, not a pitch.
    heroCtaPrompt = greet("let's continue where you left off");
    heroPrimaryCTA = {
      label: `Continue ${primaryDependent.name}'s ${effectiveSport} Journey`,
      href: roadmapHref(effectiveSport),
    };
    heroSecondaryCTA = { label: "Manage Sport Profile", href: "/sport-profile" };
    heroStats = [
      { label: "Sport", value: effectiveSport },
      ...(chosenMatch ? [{ label: "Fit", value: chosenMatch.fitLabel }] : []),
    ];
  } else if (user && primaryDependent?.sport?.wizardCompletedAt) {
    // Assessment done, no decision yet — surface the matches, not the funnel question.
    heroCtaPrompt = greet(`${primaryDependent.name}'s sport matches are ready`);
    heroPrimaryCTA = {
      label: `View ${primaryDependent.name}'s Matches`,
      href: "/assessment/discover",
    };
    heroSecondaryCTA = { label: "Explore Roadmaps", href: "/roadmap" };
    if (primaryDependent.sport.sportMatches?.length) {
      heroStats = [
        { label: "Matches Found", value: String(primaryDependent.sport.sportMatches.length) },
        { label: "Top Fit", value: primaryDependent.sport.sportMatches[0].sport },
      ];
    }
  } else if (user && primaryDependent) {
    // Profile started, assessment not finished.
    heroCtaPrompt = greet(`ready to find ${primaryDependent.name}'s sport?`);
    heroPrimaryCTA = { label: "Continue Assessment", href: "/assessment/discover" };
    heroSecondaryCTA = { label: "Explore Roadmaps", href: "/roadmap" };
  }
  // Logged in with no dependents yet: keep the default Yes/No fork —
  // we genuinely don't know their situation, just greet them for it.

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
  const expertStep = {
    label: "Still have questions?",
    title: "Consult an Expert",
    description:
      "Talk to a real sports expert, or reach out to our team directly for hands-on assistance. Free, and no hard sell.",
    icon: <MessageCircle className="h-6 w-6" />,
    stat: "Free, no commitment",
    visual: "chat",
    theme: "teal",
  };
  const trialClassStep = {
    label: "Ready to get started?",
    title: "Try a Trial Class",
    description:
      "Once you know which sport suits your child, let them try it before you commit. Our team can help you find a trial class to start with.",
    icon: <Building2 className="h-6 w-6" />,
    stat: "Try before you commit",
    visual: "trial",
    theme: "emerald",
  };

  const discoverFeatures = [
    {
      label: "Not sure which sport?",
      title: "Do the Profile Assessment",
      description:
        "Answer a few quick questions about your child's age, personality, and physical traits. If you don't already know which sport fits best, our assessment finds it for you.",
      icon: <Sparkles className="h-6 w-6" />,
      stat: "Takes about 5 minutes",
      visual: "roadmap",
      theme: "orange",
    },
    expertStep,
    trialClassStep,
  ];

  const knownSportFeatures = [
    {
      label: "Already know it?",
      title: "Build the Sport Profile",
      description:
        "Tell us your child's sport, age, and experience level. We personalise everything downstream around exactly where they are today.",
      icon: <CheckCircle2 className="h-6 w-6" />,
      stat: "Takes about 5 minutes",
      visual: "roadmap",
      theme: "orange",
    },
    expertStep,
    trialClassStep,
  ];

  return (
    <main>
      {/* ── Hero ── */}
      <Hero
        title="Helping Parents Make Confident Sports Decisions"
        titleHighlight="Sports Decisions"
        description="Understand the journey. Learn from parents and experts who've been there. Make better decisions for your child."
        ctaPrompt={heroCtaPrompt}
        primaryCTA={heroPrimaryCTA}
        secondaryCTA={heroSecondaryCTA}
        stats={heroStats}
      />

      {/* ── The Problem ── */}
      <section className="relative overflow-hidden py-16 sm:py-20 lg:py-24">
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="reveal-on-scroll mx-auto max-w-2xl text-center">
            <div className="mb-4 flex justify-center">
              <SectionLabel label="Sound Familiar?" color="slate" />
            </div>
            <h2 className="font-title mb-4 text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl">
              Youth sports is challenging. You&apos;re not alone.
            </h2>
            <p className="text-lg text-slate-600">
              Every parent wants the best for their child. But between scattered advice, endless
              options, and no clear path, it&apos;s hard to know if you&apos;re making the right
              call.
            </p>
          </div>

          <div className="reveal-on-scroll mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {problems.map((p) => (
              <div
                key={p.text}
                className="flex items-start gap-3 rounded-lg border border-slate-200/60 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500">
                  {p.icon}
                </span>
                <p className="text-sm font-medium leading-snug text-slate-700">
                  &ldquo;{p.text}&rdquo;
                </p>
              </div>
            ))}
          </div>

          <p className="reveal-on-scroll mx-auto mt-12 max-w-2xl text-center text-lg font-medium text-slate-800">
            PowerMySport turns that confusion into one{" "}
            <span className="text-power-orange-solid">clear, personalised plan</span> for your
            child.
          </p>
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

      {/* ── Ask the assistant ── */}
      <AskSection />

      {/* ── Available Now: Explore (Roadmap + Guidance) ── */}
      <section className="relative overflow-hidden py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className={`grid items-center gap-12 ${pathway ? "lg:grid-cols-[1fr_1fr]" : ""}`}>
            {/* Left: copy + capability cards */}
            <div className="reveal-on-scroll">
              <div className="mb-3">
                <SectionLabel label="Knowledge Centre" color="green" />
              </div>
              <h2 className="font-title mb-4 text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl">
                Know more before you decide
              </h2>
              <p className="mb-8 text-lg text-slate-600">
                Free resources to explore right now, no commitment, no account needed.
              </p>

              <div className="space-y-4">
                {[
                  {
                    icon: <Map size={22} />,
                    title: "Understand Sports Pathways",
                    desc: "See the step-by-step roadmap for any sport: milestones, timelines, and what it takes to go further.",
                    color: "bg-orange-50 text-power-orange ring-1 ring-orange-200/60",
                    cta: { label: "Explore", href: "/roadmap" },
                  },
                  {
                    icon: <Users2 size={22} />,
                    title: "Learn from Other Parents",
                    desc: "Real questions, real experiences. See how other families navigated the same decisions.",
                    color: "bg-teal-50 text-teal-600 ring-1 ring-teal-200/60",
                    cta: { label: "Community", href: "/community" },
                  },
                ].map((item) => (
                  <div
                    key={item.title}
                    className="flex flex-col gap-4 rounded-lg border border-slate-200/60 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center"
                  >
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md ${item.color}`}
                    >
                      {item.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="mb-1 font-bold text-slate-900">{item.title}</h3>
                      <p className="text-sm leading-relaxed text-slate-600">{item.desc}</p>
                    </div>
                    <Link
                      href={item.cta.href}
                      className="group inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
                    >
                      {item.cta.label}
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: a real pathway, stage by stage. This was an iStock preview
                photo hot-linked without a licence; the product itself is the
                honest picture. No pathway data (API down), no card. */}
            {pathway && (
              <div className="reveal-on-scroll mx-auto w-full max-w-[612px]">
                <PathwayPreviewCard pathway={pathway} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── Next tournaments ── */}
      <NextTournamentsSection
        editions={tournaments.editions}
        sportSlug={tournaments.sportSlug}
        sportLabel={tournaments.sportLabel}
      />

      {/* ── Final CTA ── */}
      <CTA
        title="All Set to Play?"
        description="Not sure what comes next? Our team can help you work out the next step for your child, from choosing a sport to finding a trial class."
        primaryCTA={{
          label: user ? "Go to Roadmap" : "Explore Your Roadmap",
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
