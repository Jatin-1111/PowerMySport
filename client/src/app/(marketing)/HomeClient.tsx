"use client";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { useAuthStore } from "@/modules/auth/store/authStore";
import { ExploreGrid } from "@/modules/marketing/components/marketing/ExploreGrid";
import { HeroAsk } from "@/modules/marketing/components/marketing/HeroAsk";
import { HowItWorks } from "@/modules/marketing/components/marketing/HowItWorks";
import { MyChildCard } from "@/modules/marketing/components/marketing/MyChildCard";
import { ParentQuestions } from "@/modules/marketing/components/marketing/ParentQuestions";
import { HomeClosing } from "@/modules/marketing/components/marketing/HomeClosing";
import {
  SECTION_HEADING,
  SECTION_LEAD,
  SectionKicker,
} from "@/modules/marketing/components/marketing/SectionKicker";
import { PhotoBand } from "@/modules/marketing/components/marketing/PhotoBand";
import { PathwayPreviewCard } from "@/modules/pathway/components/PathwayPreviewCard";
import { roadmapHref } from "@/modules/pathway/data/sports";
import type { PathwayGuideSummary } from "@/modules/pathway/services/pathway";
import type { BoardEdition } from "@/modules/tournaments/components/FlipBoard";
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
  tournaments: { editions: BoardEdition[]; sportSlug: string; sportLabel: string };
}) {
  const { user } = useAuthStore();

  return (
    <main className="bg-paper">
      {/* ── Hero ── */}
      <HeroAsk />

      {/* ── Real questions, each opening WhatsApp. Straight after the hero: the
          parent's first move is to ask, so the questions come before anything
          that explains or lists. ── */}
      <ParentQuestions />

      {/* ── From questions to action ── */}
      <HowItWorks />

      {/* ── My Child: what PMS keeps about a child, shown with an invented, labelled example ── */}
      <MyChildCard />

      {/* ── Everything PMS covers ── */}
      <ExploreGrid />

      {/* ── Next tournaments ── */}
      <NextTournamentsSection
        editions={tournaments.editions}
        sportSlug={tournaments.sportSlug}
        sportLabel={tournaments.sportLabel}
      />

      {/* ── One campaign moment: the page's only edge-to-edge photograph ── */}
      <PhotoBand
        title="From first trial to national rankings, one stage at a time."
        description="Every sport has a ladder. See what each rung asks of your child before you climb it."
        cta={{ label: "Explore pathways", href: "/roadmap" }}
        image={{
          src: "https://images.unsplash.com/photo-1451481454041-104482d8e284?fm=jpg&q=75&w=2400&auto=format&fit=crop",
          alt: "Three young boys running together through a field",
          position: "object-[50%_55%]",
        }}
      />

      {/* ── One real pathway, opened up. The photo band above already makes the
          pitch and links to /roadmap, so this only shows when there is a guide to
          show: with no pathway data (API down) there is nothing to add. ── */}
      {pathway && (pathway.stages?.length ?? 0) > 0 && (
        <section className="bg-paper-deep relative overflow-hidden py-16 sm:py-24 lg:py-28">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-[1fr_1fr]">
              <div className="reveal-on-scroll">
                <SectionKicker label="One guide, opened up" />
                <h2 className={`${SECTION_HEADING} mb-6`}>
                  What a {pathway.sportName} guide tells you
                </h2>
                <p className={`${SECTION_LEAD} mb-10`}>
                  Each stage lists the ages it covers and the question parents ask there. Free to
                  read, no account needed.
                  {coveredSports.length > 1 &&
                    ` Full guides are live for ${joinNames(coveredSports)}. Ask us about any other sport.`}
                </p>
                <Link
                  href={roadmapHref(pathway.sportName)}
                  className="btn-motion bg-ink hover:bg-ink-hover focus-visible:ring-ink focus-visible:ring-offset-paper-deep group inline-flex items-center justify-center gap-1.5 rounded-md px-6 py-3.5 text-base font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                >
                  Read the {pathway.sportName} guide
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>

              <div className="reveal-on-scroll mx-auto w-full max-w-[612px]">
                <PathwayPreviewCard pathway={pathway} />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ── Final CTA ── */}
      <HomeClosing
        title="Not sure what to do next?"
        description="Tell PowerMySport about your child, what you're trying to achieve, or simply what you're struggling with. We'll help you work out the next step. A team member replies within 24 hours."
        primaryCTA={{ label: "Talk to PMS on WhatsApp", href: WHATSAPP_HERO_HREF }}
        secondaryCTA={{
          label: user ? "Go to Roadmap" : "Explore Your Roadmap",
          href: "/roadmap",
        }}
      />
    </main>
  );
}
