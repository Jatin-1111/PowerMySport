/**
 * The five steps from the 20 Oct review, shown by the homepage "How it works" band.
 *
 * The titles and the first four descriptions follow the review. The last step says
 * "remembers" where the review says "learns", and does not promise that outcomes
 * change future recommendations: outcomes are kept (decisions, check-ins) but
 * nothing reads them back yet. Change it when that is built.
 */

export interface HowStep {
  title: string;
  body: string;
}

export const HOW_STEPS: HowStep[] = [
  {
    title: "Choose a question",
    body: "Pick a suggested question, or describe what you want for your child.",
  },
  {
    title: "PMS understands",
    body: "We ask about your child, your goals, their current level and anything that limits you.",
  },
  {
    title: "PMS recommends",
    body: "Your child's situation is combined with what we know about the sport, and the next step is explained.",
  },
  {
    title: "PMS helps execute",
    body: "Find the options, connect with experts, plan the season, book or complete the step.",
  },
  {
    title: "PMS remembers",
    body: "Your decisions and check-ins are kept with your child's journey, so you can pick up where you left off.",
  },
];
