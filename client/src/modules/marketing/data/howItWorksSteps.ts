/**
 * The five steps from the 20 and 21 Oct reviews, shown by the homepage "How it works" band.
 * Titles and descriptions are the review's own words.
 *
 * Step 5 ("Learns") says the outcome makes future recommendations more relevant. That is
 * NOT built: decisions and check-ins are kept with the child's journey, but nothing reads
 * them back to change a recommendation yet. It is live copy by the owner's decision on
 * 21 Oct 2026, after being told so; reword it if that stops being the plan.
 */

export interface HowStep {
  title: string;
  body: string;
}

export const HOW_STEPS: HowStep[] = [
  {
    title: "Select",
    body: "The parent selects a suggested question or describes a goal.",
  },
  {
    title: "Understands",
    body: "PMS asks relevant follow-up questions about the child, goals, current level and constraints.",
  },
  {
    title: "Recommends",
    body: "It combines the child's context with relevant sports knowledge and explains the recommended next step.",
  },
  {
    title: "Execute",
    body: "PMS helps the parent find options, connect with experts, plan, book or complete the relevant action.",
  },
  {
    title: "Learns",
    body: "The outcome updates the child's journey, making PMS future recommendations more relevant.",
  },
];
