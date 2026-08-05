// ─── The predefined goal catalogue ───────────────────────────────────────────
//
// A closed catalogue, but each sport declares which of it they actually reach.
// Closed so a parent comparing two sports is comparing like with like; a subset
// per sport because forcing all six on every map produced destinations that
// don't exist. Tennis in India has no state-colours system worth chasing — AITA
// grades its tournaments nationally and state bodies simply host them — so a
// "State Colours" terminal on the tennis map was inventing an outcome.
//
// "job" is here because it is the outcome the largest number of committed
// players actually reach. Coaching, officiating, academy work and sports
// management are careers built on the sport by people who never turned pro, and
// leaving them off implied that not turning pro means the years were wasted.

import { GoalId, PathwayGoal } from "./types";
import { RoadmapPersona } from "../utils/persona";

export const GOALS: Record<GoalId, PathwayGoal> = {
  pro: {
    id: "pro",
    label: "Turn Professional",
    short: "Pro",
    blurb:
      "Earn a living from the sport — world ranking, prize money, sponsorship.",
    icon: "crown",
    accent: { hex: "#e11d48", soft: "#fff1f2", ring: "#ffe4e6", dark: "#9f1239" },
  },
  national: {
    id: "national",
    label: "Represent India",
    short: "National",
    blurb:
      "Wear national colours — a national title, or selection for an India squad.",
    icon: "national",
    accent: { hex: "#7c3aed", soft: "#f5f3ff", ring: "#ede9fe", dark: "#5b21b6" },
  },
  college: {
    id: "college",
    label: "College on a Sports Scholarship",
    short: "College",
    blurb:
      "A university seat and funded education earned through the sport, in India or abroad.",
    icon: "college",
    accent: { hex: "#2563eb", soft: "#eff6ff", ring: "#dbeafe", dark: "#1e40af" },
  },
  job: {
    id: "job",
    label: "A Job in the Sport",
    short: "A job",
    blurb:
      "A salaried career built on the sport — coaching, officiating, running an academy or sports management.",
    icon: "briefcase",
    accent: { hex: "#0d9488", soft: "#f0fdfa", ring: "#ccfbf1", dark: "#115e59" },
  },
  state: {
    id: "state",
    label: "State Colours & Recognition",
    short: "State",
    blurb:
      "Represent the state, with the quota and job-reservation benefits that carry.",
    icon: "state",
    accent: { hex: "#ea580c", soft: "#fff7ed", ring: "#ffedd5", dark: "#9a3412" },
  },
  thrive: {
    id: "thrive",
    label: "A Lifelong Sport",
    short: "Play for life",
    blurb:
      "Fitness, friends and a game they keep playing into adulthood. A complete outcome, not a fallback.",
    icon: "heart",
    accent: { hex: "#059669", soft: "#ecfdf5", ring: "#d1fae5", dark: "#065f46" },
  },
};

/** Rail order — most ambitious first, so the goal rail reads as a ladder. */
export const GOAL_ORDER: GoalId[] = [
  "pro",
  "national",
  "college",
  "job",
  "state",
  "thrive",
];

export function sortGoals(ids: GoalId[]): GoalId[] {
  return GOAL_ORDER.filter((g) => ids.includes(g));
}

/**
 * The family's stated ambition → the goal to preselect on the rail.
 *
 * "fun" maps to `thrive` rather than to nothing, so a family who told us they
 * just want their child to enjoy it doesn't land on a pro-tour map by default.
 * There's deliberately no ambition that maps to `college` — it cuts across all
 * of them and is almost always under-considered, so it stays opt-in.
 */
export function goalForAmbition(
  ambition: RoadmapPersona["ambition"],
): GoalId | null {
  switch (ambition) {
    case "professional":
      return "pro";
    case "national":
      return "national";
    case "competitive":
      return "state";
    case "fun":
      return "thrive";
    default:
      return null;
  }
}

/**
 * The same question, resolved against the goals a particular sport declares.
 *
 * `goalForAmbition` names the ideal match; a sport may not offer it. Tennis has
 * no state terminal, so a family who said "competitive" would otherwise get no
 * goal preselected at all — the badge silently vanishes and the map opens with
 * nothing highlighted. Each ambition therefore carries a fallback chain, and the
 * first destination the sport actually reaches wins.
 */
const AMBITION_FALLBACKS: Record<string, GoalId[]> = {
  professional: ["pro", "national"],
  national: ["national", "pro"],
  competitive: ["state", "national", "job"],
  fun: ["thrive", "job", "college"],
};

export function resolveAmbitionGoal(
  ambition: RoadmapPersona["ambition"],
  available: GoalId[],
): GoalId | null {
  const ideal = goalForAmbition(ambition);
  if (!ideal) return null;
  if (available.includes(ideal)) return ideal;
  const chain = AMBITION_FALLBACKS[ambition ?? ""] ?? [];
  return chain.find((g) => available.includes(g)) ?? null;
}
