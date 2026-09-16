import { CTA } from "@/modules/marketing/components/marketing/CTA";
import { Hero } from "@/modules/marketing/components/marketing/Hero";
import {
  ChildSafety,
  CompanyFacts,
  LiveToday,
  Principles,
  WhatsNext,
  WhoWeAre,
  WhyItsFree,
  WhyWeExist,
} from "@/modules/marketing/components/about/AboutSections";
import { fetchFederations } from "@/modules/federations/services/fetchFederations";
import { fetchPublishedPathways } from "@/modules/pathway/services/fetchGuide";

// ─── /about, the body ────────────────────────────────────────────────────────
//
// An async server component: the "what you can use today" section quotes how
// many pathway guides and federations we actually publish, read from the same
// endpoints /roadmap and /federations render from. Both fetchers fail soft to
// an empty array, and the section hides a count rather than printing a zero, so
// an API outage costs us the number and not the page.
//
// The page reads problem -> what's live -> what we believe -> how we're funded
// -> your child's data -> who we are -> what's next. The order is deliberate:
// a parent's questions arrive roughly in that sequence.

export async function AboutPageContent() {
  const [pathways, federations] = await Promise.all([fetchPublishedPathways(), fetchFederations()]);

  return (
    <main className="overflow-x-hidden">
      <Hero
        variant="page"
        title="The map we wish every parent had"
        subtitle="Our story"
        description="Indian youth sport comes with no instruction manual. We are a small team trying to write one, clear, honest, and built around the parent doing the work."
      />

      <WhyWeExist />
      <LiveToday
        sportNames={pathways.map((guide) => guide.sportName)}
        federationCount={federations.length}
      />
      <Principles />
      <WhyItsFree />
      <ChildSafety />
      <WhoWeAre />
      <WhatsNext />
      <CompanyFacts />

      <CTA
        variant="gradient"
        title="Start with the plan"
        description="Tell us about your child and see the roadmap. It takes a few minutes and costs nothing."
        primaryCTA={{
          label: "Build a Sports Plan",
          href: "/roadmap",
        }}
        secondaryCTA={{
          label: "Contact Us",
          href: "/contact",
        }}
      />
    </main>
  );
}
