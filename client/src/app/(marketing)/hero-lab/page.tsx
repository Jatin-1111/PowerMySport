import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { Hero } from "@/modules/marketing/components/marketing/Hero";
import {
  HeroCircleSplit,
  HeroPlateSplit,
  HeroWidePlate,
} from "@/modules/marketing/components/marketing/HeroVariants";
import {
  HeroAskFirst,
  HeroEdgePhoto,
  HeroSerifStatement,
} from "@/modules/marketing/components/marketing/HeroVariantsMore";
import {
  HeroChatPreview,
  HeroChooser,
  HeroEdgeChooser,
  HeroQuestionTags,
} from "@/modules/marketing/components/marketing/HeroVariantsThird";
import type { Metadata } from "next";

// Review page for the hero experiments. Not linked from anywhere and kept out of
// search; delete it once a hero is chosen.
export const metadata: Metadata = {
  title: "Hero lab",
  robots: { index: false, follow: false },
};

const CTA_HREF = buildWhatsAppUrl(
  "Hi! I found PowerMySport and would like help with my child's sports journey."
);

function Label({ children }: { children: string }) {
  return (
    <p className="bg-ink px-4 py-2 text-center text-xs font-medium tracking-wide text-white">
      {children}
    </p>
  );
}

export default function HeroLabPage() {
  return (
    <main className="bg-paper">
      <Label>A. Circle photo, as in the review</Label>
      <HeroCircleSplit ctaHref={CTA_HREF} />

      <Label>B. Tall rounded photo, note on the corner</Label>
      <HeroPlateSplit ctaHref={CTA_HREF} />

      <Label>C. Text first, wide photo below</Label>
      <HeroWidePlate ctaHref={CTA_HREF} />

      <Label>E. Oversized serif statement, square photo (Oura)</Label>
      <HeroSerifStatement ctaHref={CTA_HREF} />

      <Label>F. Photo runs off the screen edge (Nike)</Label>
      <HeroEdgePhoto ctaHref={CTA_HREF} />

      <Label>G. One field is the way in, centred (Airbnb)</Label>
      <HeroAskFirst />

      <Label>H. Photo with an example chat laid over it (Intercom)</Label>
      <HeroChatPreview ctaHref={CTA_HREF} />

      <Label>I. Parents&apos; questions as tags on the photo (Pinterest)</Label>
      <HeroQuestionTags ctaHref={CTA_HREF} />

      <Label>J. Headline beside a card you can use (Wise)</Label>
      <HeroChooser />

      <Label>K. Combined: edge photo (Nike) + card (Wise) + what happens next (Intercom)</Label>
      <HeroEdgeChooser />

      <Label>D. Current hero (tennis photo) with the review's words</Label>
      <Hero
        title="Helping Parents Make Confident Sports Decisions"
        titleHighlight="Sports Decisions"
        description="From discovering the right sport to navigating competition and future pathways, PMS helps you understand your child's options, decide what to do next, and take action."
        ctaNote="A PowerMySport team member replies within 24 hours."
        primaryCTA={{ label: "Talk to PMS", href: CTA_HREF }}
      />
    </main>
  );
}
