/**
 * The five steps from the 20 Oct review, shared by the "How it works" layouts.
 *
 * The titles and the first four steps follow the review. The last step says
 * "remembers" where the review says "learns", and does not promise that outcomes
 * change future recommendations: outcomes are kept (decisions, check-ins) but
 * nothing reads them back yet. Change it when that is built.
 *
 * Every line under a step names something that exists today, and the links in step
 * four are real pages. Where a feature is tennis-first the line says so.
 */

export interface HowStep {
  title: string;
  /** The review's one-line description. */
  body: string;
  listLabel: string;
  items: Array<string | { label: string; href: string }>;
}

export const HOW_STEPS: HowStep[] = [
  {
    title: "Choose a question",
    body: "Pick a suggested question, or describe what you want for your child.",
    listLabel: "Questions parents start with",
    items: [
      "Which sport is right for my 8-year-old?",
      "Which tournaments should my son play?",
      "Is my child ready to start competing?",
    ],
  },
  {
    title: "PMS understands",
    body: "We ask about your child, your goals, their current level and anything that limits you.",
    listLabel: "What we ask about",
    items: [
      "Your child's age and the sport they play",
      "Their current level and how long they have played",
      "What you want from this season",
      "Time, budget and travel limits",
    ],
  },
  {
    title: "PMS recommends",
    body: "Your child's situation is combined with what we know about the sport, and the next step is explained.",
    listLabel: "What you get",
    items: [
      "Sport matches, and a pathway for each stage",
      "Tournaments they can enter, starting with tennis",
      "A season planned around exams and budget",
    ],
  },
  {
    title: "PMS helps execute",
    body: "Find the options, connect with experts, plan the season, book or complete the step.",
    listLabel: "Where to go next",
    items: [
      { label: "Tournaments and entry dates", href: "/tournaments" },
      { label: "Plan the season", href: "/planner" },
      { label: "Book an expert", href: "/booking" },
      { label: "Admissions and scholarships", href: "/admissions" },
    ],
  },
  {
    title: "PMS remembers",
    body: "Your decisions and check-ins are kept with your child's journey, so you can pick up where you left off.",
    listLabel: "What is kept",
    items: [
      "Choices you make, like a chosen sport or a shortlisted event",
      "Check-ins on how it is going",
      "All of it under My Child, which you can delete any time",
    ],
  },
];
