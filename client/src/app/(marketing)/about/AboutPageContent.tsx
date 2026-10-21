import { CTA } from "@/modules/marketing/components/marketing/CTA";
import {
  ChildSafety,
  CompanyFacts,
  LiveToday,
  Principles,
  WhatsNext,
  WhoWeAre,
  WhyWeExist,
} from "@/modules/marketing/components/about/AboutSections";
import { fetchFederations } from "@/modules/federations/services/fetchFederations";
import { fetchPublishedPathways } from "@/modules/pathway/services/fetchGuide";
import { PageHeader } from "@/modules/shared/ui/PageHeader";

// ─── /about, the body ────────────────────────────────────────────────────────
//
// An async server component: the "what you can use today" section quotes how
// many pathway guides and federations we actually publish, read from the same
// endpoints /roadmap and /federations render from. Both fetchers fail soft to
// an empty array, and the section hides a count rather than printing a zero, so
// an API outage costs us the number and not the page.
//
// The page reads problem -> what's live -> what we believe
// -> your child's data -> who we are -> what's next. The order is deliberate:
// a parent's questions arrive roughly in that sequence.

export async function AboutPageContent() {
  const [pathways, federations] = await Promise.all([fetchPublishedPathways(), fetchFederations()]);

  return (
    // `overflow-x-clip`, not `overflow-x-hidden`: hidden makes <main> a scroll
    // container that never scrolls, and the `.reveal-on-scroll` view timelines
    // inside then track it instead of the page, freezing part-way transparent.
    <main className="overflow-x-clip">
      <PageHeader
        eyebrow="About PowerMySport"
        title="Every child's sports journey deserves a clearer plan."
        description={[
          "Every child has the potential to discover something they love through sport. But for parents, knowing where to begin, and what to do next, isn't always easy.",
          "Which sport is right for my child? How do I find the right coach or academy? When should my child start competing? What does it take to progress from a beginner to a competitive athlete? And how much time, effort and money will the journey require?",
          "The answers are often scattered across websites, coaches, federations, WhatsApp groups and other parents' experiences.",
          "PowerMySport brings clarity to that journey, helping parents make informed decisions at every stage of their child's sporting development.",
        ]}
      />

      <WhyWeExist />
      <LiveToday
        sportNames={pathways.map((guide) => guide.sportName)}
        federationCount={federations.length}
      />
      <Principles />
      <ChildSafety />
      <WhoWeAre />
      <WhatsNext />
      <CompanyFacts />

      <CTA
        title="Start with the plan"
        description="Tell us about your child and see the roadmap. It takes a few minutes and costs nothing."
        primaryCTA={{
          label: "Build a sports plan",
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
