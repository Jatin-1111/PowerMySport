"use client";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { CTA } from "@/modules/marketing/components/marketing/CTA";
import { ExploreGrid } from "@/modules/marketing/components/marketing/ExploreGrid";
import { Hero } from "@/modules/marketing/components/marketing/Hero";
import { JourneySteps } from "@/modules/marketing/components/marketing/JourneySteps";
import { ParentQuestions } from "@/modules/marketing/components/marketing/ParentQuestions";
import { SectionLabel } from "@/modules/marketing/components/marketing/SectionLabel";
import { PathwayPreviewCard } from "@/modules/pathway/components/PathwayPreviewCard";
import { roadmapHref } from "@/modules/pathway/data/sports";
import type { PathwayGuideSummary, TournamentEdition } from "@/modules/pathway/services/pathway";
import { NextTournamentsSection } from "@/modules/tournaments/components/NextTournamentsSection";
import { ArrowRight } from "lucide-react";

import Link from "next/link";

/** "Tennis and Chess", "Tennis, Chess and Golf". */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

const WHATSAPP_HERO_HREF = buildWhatsAppUrl(
  "Hi! I found PowerMySport and would like help with my child's sports journey."
);

// Section reveals use the `.reveal-on-scroll` utility in globals.css. The
// framer-motion stagger this replaced left the homepage's copy at `opacity: 0`
// in the server HTML until hydration ran. The hero keeps its own scroll-linked
// motion — that one is a deliberate effect, not a reveal.

export default function HomeClient({
  pathway,
  coveredSports,
  tournaments,
}: {
  pathway: PathwayGuideSummary | null;
  /** Names of the sports with a published pathway guide, e.g. ["Tennis", "Chess"]. */
  coveredSports: string[];
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

  // Guests, and parents with no child profile yet: WhatsApp is the way in.
  let heroCtaPrompt: string | undefined = firstName
    ? greet("what would you like help with?")
    : undefined;
  let heroPrimaryCTA = { label: "Get guidance on WhatsApp", href: WHATSAPP_HERO_HREF };
  let heroSecondaryCTA: { label: string; href: string } | undefined = {
    label: "Find my child's sport",
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
  // Logged in with no dependents yet: keep the WhatsApp default, greeted by name.

  return (
    <main>
      {/* ── Hero ── */}
      <Hero
        title="Helping Parents Make Confident Sports Decisions"
        titleHighlight="Sports Decisions"
        description="Choosing a sport, a tournament or the next stage? Tell us about your child and we'll help you work out what to do next."
        ctaNote="A PowerMySport team member replies within 24 hours."
        ctaPrompt={heroCtaPrompt}
        primaryCTA={heroPrimaryCTA}
        secondaryCTA={heroSecondaryCTA}
        trustPoints={[
          "No account needed",
          "Personalised to your child",
          ...(coveredSports.length > 0 ? [`Pathway guides for ${joinNames(coveredSports)}`] : []),
        ]}
        stats={heroStats}
      />

      {/* ── Real questions, each opening WhatsApp ── */}
      <ParentQuestions />

      {/* ── From questions to action ── */}
      <JourneySteps />

      {/* ── Everything PMS covers ── */}
      <ExploreGrid />

      {/* ── A real pathway, stage by stage ── */}
      <section className="relative overflow-hidden py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className={`grid items-center gap-12 ${pathway ? "lg:grid-cols-[1fr_1fr]" : ""}`}>
            <div className="reveal-on-scroll">
              <div className="mb-3">
                <SectionLabel label="Pathway guides" color="green" />
              </div>
              <h2 className="font-title mb-4 text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl">
                See what each stage asks of your child
              </h2>
              <p className="mb-8 text-lg text-slate-600">
                Free to read, no account needed.
                {coveredSports.length > 0 &&
                  ` Full guides are live for ${joinNames(coveredSports)}. Ask us about any other sport.`}
              </p>
              <Link
                href="/roadmap"
                className="group inline-flex items-center justify-center gap-1.5 rounded-md bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
              >
                Explore pathways
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            {/* The product itself is the picture; no pathway data (API down), no card. */}
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
        title="Not sure what to do next?"
        description="Tell PowerMySport about your child, what you're trying to achieve, or simply what you're struggling with. We'll help you work out the next step. A team member replies within 24 hours."
        primaryCTA={{ label: "Get guidance on WhatsApp", href: WHATSAPP_HERO_HREF }}
        secondaryCTA={{
          label: user ? "Go to Roadmap" : "Explore Your Roadmap",
          href: "/roadmap",
        }}
      />
    </main>
  );
}
