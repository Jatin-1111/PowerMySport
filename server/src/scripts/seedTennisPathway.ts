/**
 * Seed the Tennis pathway from the MVP content blueprint.
 *
 *   npx tsx -r dotenv/config src/scripts/seedTennisPathway.ts            # draft
 *   npx tsx -r dotenv/config src/scripts/seedTennisPathway.ts --publish  # live
 *
 * Draft by default, and that default matters: this database is the live one, so
 * a seed that published itself would put six stages in front of parents the
 * moment it ran. Publishing is a separate, deliberate flag.
 *
 * Idempotent — it upserts on sportSlug and rewrites the stages, so
 * re-running it after an edit to this file republishes the corrected content
 * rather than creating a second Tennis.
 *
 * Every word below is from `PowermySport_Tennis_Pathway_MVP`. Nothing is
 * invented here: where the blueprint lists a question without an answer, the
 * answer is left absent, which is exactly what the format is built to allow.
 */

import mongoose from "mongoose";

import { PathwayGuide } from "../shared/models/PathwayGuide";
import {
  PATHWAY_FORMAT_VERSION,
  parsePathwayGuide,
  type PathwayGuideInput,
} from "../shared/validation/pathwayGuideFormat";

// The chips under "Decisions" — the same set on every stage, because the help a
// parent can reach for does not change with their child's age.
//
// Academies and coaches point into /booking's tabs. The standalone /academies
// and /coaches pages were "launching soon" waitlists and have been removed;
// /booking is the one discovery surface.
//
// No tournament chip. `/tournaments` has no index page, and the tournament
// calendar is reached from the federation band further down the same page —
// a second route to it here was noise.
const TENNIS_CALENDAR = "/federations/aita?tab=calendar";

const HELP_LINKS = [
  { label: "Find academy", href: "/booking?tab=academies" },
  { label: "Find coach", href: "/booking?tab=coaches" },
  { label: "Book expert", href: "/experts" },
  { label: "Equipment", href: "/shop" },
  { label: "Assessment", href: "/guidance" },
];

const SITUATIONAL_LEAD =
  "Your situation decides the step. Pick the line that describes you today.";
const ORDERED_LEAD = "The steps for this stage, in the order they are worth doing.";

const GUIDE: PathwayGuideInput = {
  formatVersion: PATHWAY_FORMAT_VERSION,
  sport: { slug: "tennis", name: "Tennis" },
  intro: {
    eyebrow: "Tennis pathway · for parents",
    headline: "Understand. Question. Observe. Decide. Act.",
    description:
      "Six stages, each answering five things: where you are, what you are probably worried about, what to watch for, what you may have to choose, and what to do now.",
  },
  sportIntro: [
    "Tennis is an individual Olympic sport that develops fitness, coordination, agility, discipline and the ability to make decisions independently.",
    "It can be enjoyed as a lifelong recreational sport or pursued through a competitive pathway, from local tournaments to national and international competition.",
    "For committed players, tennis can also open doors to college tennis, international opportunities and potentially a professional career.",
  ],
  stages: [
    // ── 1 ──────────────────────────────────────────────────────────────────
    {
      key: "discover-tennis",
      name: "Discover Tennis",
      ageRange: "~5–7",
      coreQuestion: "Should my child try tennis?",
      overview:
        "Your child is discovering tennis and building a first relationship with the sport. The priority is enjoyment, basic movement, age-appropriate exposure and discovering whether the child wants to keep playing.",
      questions: [
        {
          question: "Is tennis suitable for my child?",
          answer:
            "Tennis can be a great sport for children who enjoy movement, learning new skills and challenges. At this age, interest and enjoyment matter more than talent.",
        },
        {
          question: "How do I introduce tennis?",
          answer:
            "Start with a fun, age-appropriate programme using smaller courts, suitable balls and plenty of games. The first goal is to make your child enjoy being on court.",
        },
        {
          question: "What should the first 3–6 months look like?",
          answer:
            "Focus on familiarity, basic movement, coordination, racket skills and enjoyment. Don't worry about performance at this stage.",
        },
        {
          question: "How often should my child play?",
          answer:
            "Start with a frequency that your child can enjoy consistently. Regular exposure is more important than intensive training in the early years.",
        },
        {
          question: "What equipment is required?",
          answer:
            "A suitably sized racket, appropriate tennis shoes, comfortable sportswear and age-appropriate balls are the essentials. Avoid overspending initially.",
        },
        {
          question: "What should I expect from a coach?",
          answer:
            "A good coach should create a safe, positive and engaging environment, use age-appropriate activities, develop fundamentals and encourage the child rather than create unnecessary pressure.",
        },
        {
          question: "Is my child showing interest?",
          answer:
            "Look for whether your child looks forward to tennis, wants to play, enjoys learning and keeps trying when things are difficult. These signals matter more than early performance.",
        },
        {
          question: "Should we try other sports too?",
          answer:
            "Yes. At 5–7, children can benefit from exploring multiple sports. Tennis doesn't have to be the only sport; the goal is to discover what your child enjoys and where they want to develop.",
        },
      ],
      signals: [
        { title: "Enjoyment and willingness to return" },
        { title: "Coordination and movement improving" },
        { title: "Positive response to coach and environment" },
        { title: "Interest in playing outside coaching" },
        { title: "Ability to handle small challenges and mistakes" },
      ],
      decisions: [
        { title: "Which academy or coach?" },
        { title: "How frequently should we play?" },
        { title: "Should tennis be one sport among several?" },
        { title: "When should structured competition be introduced?" },
      ],
      nextStepLead: SITUATIONAL_LEAD,
      nextSteps: [
        { when: "Not started", action: "Find 2–3 age-appropriate trial options." },
        {
          when: "Just started",
          action:
            "Follow a 3–6 month starter period and observe enjoyment and progress.",
        },
        {
          when: "Enjoying tennis",
          action: "Discuss a simple development plan with the coach.",
        },
        { when: "Unsure", action: "Speak with an expert or experienced parent." },
        {
          when: "Not enjoying tennis",
          action: "Understand why and explore another sport.",
        },
      ],
      primaryAction: {
        label: "Find trial options near you",
        href: "/booking?tab=academies",
      },
      helpLinks: HELP_LINKS,
    },

    // ── 2 ──────────────────────────────────────────────────────────────────
    {
      key: "start-and-develop",
      name: "Start & Develop",
      ageRange: "~7–11",
      coreQuestion: "Is my child enjoying and developing?",
      overview:
        "The child moves from initial exposure to a consistent tennis habit. The focus is fundamentals, quality of the coach and academy, gradual development and deciding whether tennis should remain recreational or become competitive.",
      questions: [
        { question: "Is the coach or academy right?" },
        { question: "Is my child progressing?" },
        { question: "How much should we train?" },
        { question: "When should my child start competing?" },
        { question: "Should we change academy?" },
        { question: "What should parents do?" },
      ],
      // The blueprint expands this stage's signals and decisions into full
      // paragraphs later in the document; both are carried through here.
      signals: [
        {
          title: "Technical and movement development",
          detail:
            "Is your child gradually becoming more comfortable with the racket, ball and court? Look for improving coordination, movement and basic tennis skills rather than perfect technique.",
        },
        {
          title: "Increasing confidence and consistency",
          detail:
            "Does your child feel more comfortable on court and participate with greater confidence? Consistency in attendance, effort and basic skills is an encouraging sign.",
        },
        {
          title: "Enjoyment and motivation",
          detail:
            "Does your child look forward to tennis and want to play? Genuine enjoyment and willingness to learn are often more meaningful at this stage than performance.",
        },
        {
          title: "Coach and academy quality",
          detail:
            "Is the environment positive, age-appropriate and engaging? A good coach should encourage learning, keep children active and communicate constructively with parents.",
        },
        {
          title: "Response to challenge and competition",
          detail:
            "How does your child react when things don't go their way? Learning to handle mistakes, challenges, winning and losing positively is an important part of development.",
        },
      ],
      decisions: [
        {
          title: "Is my child progressing?",
          detail:
            "Look beyond rankings. Consider improvements in skills, movement, confidence, consistency, competitiveness and overall enjoyment.",
        },
        {
          title: "Should we start competing?",
          detail:
            "Introduce competition when your child has the basic skills, interest and emotional readiness to enjoy the experience and learn from both winning and losing.",
        },
        {
          title: "Is the academy still right?",
          detail:
            "Review whether the coach, training environment, level of challenge and development opportunities continue to match your child's needs.",
        },
        {
          title: "Should tennis remain recreational or become more serious?",
          detail:
            "Base the decision on your child's interest, ability, motivation and progression — not parental expectations or comparison with other children.",
        },
      ],
      nextStepLead: SITUATIONAL_LEAD,
      nextSteps: [
        { when: "Continue", action: "Review progress periodically." },
        {
          when: "Progressing and interested",
          action: "Introduce age-appropriate competition.",
        },
        { when: "Plateaued", action: "Conduct a coach and academy review." },
        {
          when: "Strong interest",
          action: "Discuss a structured development pathway.",
        },
      ],
      primaryAction: {
        label: "Review the academy and coach",
        href: "/booking?tab=academies",
      },
      helpLinks: HELP_LINKS,
    },

    // ── 3 ──────────────────────────────────────────────────────────────────
    {
      key: "compete-and-assess",
      name: "Compete & Assess",
      ageRange: "~10–14",
      coreQuestion: "Should we become more serious?",
      overview:
        "Competition becomes a meaningful part of the journey. Parents begin to understand tournaments, rankings, performance against peers and the difference between playing tennis and pursuing competitive tennis.",
      questions: [
        { question: "Which competitions should my child play?" },
        { question: "When does ranking matter?" },
        { question: "How should we plan tournaments?" },
        { question: "Is my child genuinely competitive?" },
        { question: "How much should we invest?" },
      ],
      signals: [
        { title: "Quality of performance and wins" },
        { title: "Ranking trajectory" },
        { title: "Competitiveness and consistency" },
        { title: "Response to pressure" },
        { title: "Enjoyment of competition" },
        { title: "Coach assessment" },
      ],
      decisions: [
        { title: "Is my child competitive relative to peers?" },
        { title: "Which tournaments are worth playing?" },
        { title: "Is the ranking trajectory encouraging?" },
        { title: "Is the investment justified?" },
        { title: "How seriously should we pursue tennis?" },
      ],
      nextStepLead: ORDERED_LEAD,
      nextSteps: [
        { when: "Step 1", action: "Create a 12-month competition calendar." },
        {
          when: "Step 2",
          action: "Track performance and quality of wins, not only ranking.",
        },
        { when: "Step 3", action: "Review coach and academy fit." },
        { when: "Step 4", action: "Conduct a parent–coach–player review." },
        {
          when: "Step 5",
          action:
            "Decide whether to move towards a serious competitive pathway.",
        },
      ],
      primaryAction: {
        label: "Build a 12-month competition calendar",
        href: TENNIS_CALENDAR,
      },
      helpLinks: HELP_LINKS,
    },

    // ── 4 ──────────────────────────────────────────────────────────────────
    {
      key: "performance-and-decide",
      name: "Performance & Decide",
      ageRange: "~13–16",
      coreQuestion: "How far can my child take tennis?",
      overview:
        "The pathway becomes deliberate. Technical development is joined by physical preparation, recovery, mental skills, competition planning and academic balance.",
      questions: [
        { question: "Should my child specialise?" },
        { question: "What level should we target?" },
        { question: "Should we pursue national or international competition?" },
        { question: "What support team is required?" },
        { question: "How do we manage recovery and education?" },
      ],
      signals: [
        { title: "Performance trajectory" },
        { title: "Quality of wins" },
        { title: "Physical development" },
        { title: "Motivation and resilience" },
        { title: "Injury and recovery status" },
        { title: "Academic balance" },
        { title: "Coach assessment" },
      ],
      decisions: [
        { title: "Is high-performance tennis right for my child?" },
        { title: "What level is realistic?" },
        { title: "Should we pursue ITF Juniors?" },
        { title: "Is the academy or coach sufficient?" },
        { title: "How much should the family invest?" },
        { title: "How do we balance tennis and academics?" },
      ],
      nextStepLead: ORDERED_LEAD,
      nextSteps: [
        {
          when: "Step 1",
          action: "Conduct a comprehensive high-performance review.",
        },
        {
          when: "Step 2",
          action: "Create a 12-month training and competition plan.",
        },
        {
          when: "Step 3",
          action: "Assess physical, mental and recovery support.",
        },
        {
          when: "Step 4",
          action: "Map national and international competition options.",
        },
        { when: "Step 5", action: "Begin discussing future pathways early." },
      ],
      primaryAction: { label: "Start a high-performance review", href: "/experts" },
      helpLinks: HELP_LINKS,
    },

    // ── 5 ──────────────────────────────────────────────────────────────────
    {
      key: "pathway",
      name: "Pathway",
      ageRange: "~15–18",
      coreQuestion: "What is the right future pathway?",
      overview:
        "The player connects tennis performance to life after school. Options include professional tennis, college tennis in India or abroad, scholarships and other education or sport-related opportunities.",
      questions: [
        { question: "Is professional tennis realistic?" },
        { question: "Should we pursue college tennis?" },
        { question: "Which college level is realistic?" },
        { question: "When should recruitment planning begin?" },
        { question: "What about Indian universities?" },
        { question: "How much should we invest?" },
      ],
      signals: [
        { title: "Tennis trajectory" },
        { title: "Ranking and competitive level" },
        { title: "Academic performance" },
        { title: "Player aspirations" },
        { title: "Financial realities" },
        { title: "Physical and mental readiness" },
      ],
      decisions: [
        { title: "Professional or college?" },
        { title: "India or abroad?" },
        { title: "Which college level?" },
        { title: "What academic pathway fits?" },
        { title: "What tennis profile is needed?" },
        { title: "What should the next 12–24 months look like?" },
      ],
      nextStepLead: ORDERED_LEAD,
      nextSteps: [
        {
          when: "Step 1",
          action: "Build a college or professional pathway assessment.",
        },
        {
          when: "Step 2",
          action: "Map suitable universities and competition levels.",
        },
        {
          when: "Step 3",
          action: "Prepare the player's tennis and academic profile.",
        },
        {
          when: "Step 4",
          action: "Start coach and recruitment conversations where appropriate.",
        },
        { when: "Step 5", action: "Create a 12–24 month pathway plan." },
      ],
      primaryAction: { label: "Start a pathway assessment", href: "/guidance" },
      helpLinks: HELP_LINKS,
    },

    // ── 6 ──────────────────────────────────────────────────────────────────
    {
      key: "transition-and-beyond",
      name: "Transition & Beyond",
      ageRange: "18+",
      coreQuestion: "Where can tennis take me next?",
      overview:
        "Tennis does not have to end when junior competition ends. The next chapter may involve professional or college playing, club tennis, coaching, sports science, sports management, technology, media, entrepreneurship or other careers connected to sport.",
      questions: [
        { question: "Can I continue playing?" },
        { question: "What careers exist in tennis and sport?" },
        { question: "How can my tennis experience help my career?" },
        { question: "How do I transition well?" },
      ],
      signals: [
        { title: "Continuing interest in playing" },
        { title: "Skills and qualifications" },
        { title: "Academic and career interests" },
        { title: "Networks and opportunities" },
        { title: "Wellbeing and long-term goals" },
      ],
      decisions: [
        { title: "Do I continue playing?" },
        { title: "Do I want a career in sport?" },
        { title: "What education or qualification should I pursue?" },
        { title: "How do I use my tennis experience and network?" },
      ],
      nextStepLead: ORDERED_LEAD,
      nextSteps: [
        {
          when: "Step 1",
          action: "Identify the preferred playing or career direction.",
        },
        {
          when: "Step 2",
          action: "Map education, qualifications and experience needed.",
        },
        {
          when: "Step 3",
          action: "Connect with relevant experts and professionals.",
        },
        { when: "Step 4", action: "Build a 2–3 year transition plan." },
      ],
      primaryAction: { label: "Explore career directions", href: "/experts" },
      helpLinks: HELP_LINKS,
    },
  ],
};

async function main(): Promise<void> {
  const publish = process.argv.includes("--publish");
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!uri) throw new Error("Set MONGO_URI (or MONGODB_URI) before running this.");

  // Validated before the connection is even opened: a content mistake should
  // fail as a list of pathed errors, not as a half-written document.
  const parsed = parsePathwayGuide(GUIDE);
  if (!parsed.ok) {
    console.error("The Tennis guide does not match the format:");
    for (const error of parsed.errors) console.error(`  ${error}`);
    process.exitCode = 1;
    return;
  }
  const guide = parsed.guide;

  await mongoose.connect(uri);
  try {
    const saved = await PathwayGuide.findOneAndUpdate(
      { sportSlug: guide.sport.slug },
      {
        $set: {
          sportSlug: guide.sport.slug,
          sportName: guide.sport.name,
          formatVersion: guide.formatVersion,
          intro: guide.intro,
          sportIntro: guide.sportIntro,
          stages: guide.stages.map((stage, index) => ({
            ...stage,
            order: index + 1,
          })),
          status: publish ? "published" : "draft",
          publishedAt: publish ? new Date() : null,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    ).lean();

    console.log(
      `Seeded ${saved?.sportName} — ${saved?.stages?.length} stages, status "${saved?.status}".`,
    );
    if (!publish) {
      console.log("Saved as a DRAFT: it is not visible to parents.");
      console.log("Re-run with --publish, or publish it from Admin → Content → Pathways.");
    }
  } finally {
    await mongoose.disconnect();
  }
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
