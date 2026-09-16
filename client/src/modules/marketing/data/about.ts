// ─── /about content ──────────────────────────────────────────────────────────
//
// The copy lives here rather than inline in the page so the claims on it are
// reviewable in one place. That matters more than usual on this page: several
// lines are promises about how we handle a child's data, and each one is
// phrased to match what the Privacy Policy already commits to. If a claim here
// stops being true in the policy, it stops being true here.

/** What a parent can actually use today. Counts are fetched, not written down. */
export interface LiveCapability {
  title: string;
  description: string;
}

export const LIVE_CAPABILITIES: LiveCapability[] = [
  {
    title: "A personalised roadmap",
    description:
      "Tell us about your child and get an age-appropriate plan for their sport, what to focus on now, what comes next, and what it realistically costs.",
  },
  {
    title: "Pathway guides",
    description:
      "How a player actually progresses in India: the levels, the gates between them, and who controls each one.",
  },
  {
    title: "Federations and their calendars",
    description:
      "The governing bodies behind youth sport, who can enter their tournaments, and what is on their official calendars.",
  },
  {
    title: "Rankings, in plain language",
    description:
      "Points tables and ladders rewritten so a parent can read them without needing someone to translate.",
  },
];

/**
 * Three principles, each of which commits us to something.
 *
 * The four they replaced ("Honest and Realistic", "Built for Everyday Parents")
 * were adjectives any sports site could claim without changing a line of its
 * product. These are falsifiable.
 */
export const PRINCIPLES = [
  {
    title: "We'll tell you the discouraging version",
    description:
      "Most kids will not go pro, not every academy is worth its fees, and some sports cost more than families expect. A plan that only tells you good news is not a plan.",
  },
  {
    title: "Sourced, or we don't say it",
    description:
      "Selection rules, entry criteria and calendars come from federations and official sources, and we say where each one came from. When we do not know, we say that too.",
  },
  {
    title: "Written for the parent, not the athlete",
    description:
      "You are the one comparing academies, paying the fees and driving at 5am. The product is written for the person doing that work.",
  },
];

/**
 * Commitments about a child's data.
 *
 * Every line here is held by the Privacy Policy and the Parental Consent &
 * Minor Protection Policy — this section summarises them for a parent who will
 * never open a legal page, and links to both. Do not add a claim here that
 * those documents do not already make.
 */
export const SAFETY_COMMITMENTS = [
  {
    title: "A child is never the account holder",
    description:
      "Under Indian law a child is anyone under 18. They can only be represented here through a dependent profile that you create, control and consent on behalf of.",
  },
  {
    title: "No profiling, no ad targeting",
    description:
      "We do not use a dependent profile's data for behavioural tracking, profiling or targeted advertising.",
  },
  {
    title: "It stays yours",
    description:
      "You can ask for access to what we hold about you or your dependent, have it corrected, or have it deleted.",
  },
];

/** Where the platform goes, in the order we intend to ship it. */
export const PHASES = [
  {
    when: "Now",
    what: "Roadmaps, pathway guides, federation calendars and rankings, free.",
  },
  {
    when: "Next",
    what: "A community where parents compare notes on academies, coaches and tournaments honestly.",
  },
  {
    when: "After that",
    what: "Booking coaches and venues, and a gear shop that will not upsell you equipment a nine-year-old does not need.",
  },
];

/**
 * The team, described by what they build rather than by job title.
 *
 * The section this replaced was headlined "Built by Sports Enthusiasts" over
 * three engineers, which promised a sports pedigree the page could not show.
 * Saying plainly what we are is the more credible version of the same section.
 */
export const TEAM = [
  {
    name: "Jatin",
    role: "Platform and infrastructure",
    desc: "Builds the roadmap engine and keeps the thing running.",
  },
  {
    name: "Rakshak Phogat",
    role: "Product and interfaces",
    desc: "Turns federation documents into screens a parent can act on.",
  },
  {
    name: "Vanshika Narang",
    role: "Full stack and deployments",
    desc: "Builds features end to end and ships them safely.",
  },
];
