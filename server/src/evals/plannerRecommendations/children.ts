import type { SeasonGoal } from "../../client/models/SeasonPlan";

/**
 * The synthetic children the evaluation runs against.
 *
 * Nobody here is real: ages, ranks, states and goals are chosen to put the engine in
 * the situations that decide whether a suggestion is good. Each profile exists for a
 * reason, written beside it, so a failure reads as "this situation went wrong" and not
 * as a row number. Add a profile when a real case surprises us; do not tune the engine
 * to the ones here.
 *
 * Ranks are placed around AITA's one ranking bar (the top 75 of an age group are shut
 * out of Talent Series) and across the range a real list has (the U-14 boys list holds
 * about 1,600 players), because the engine behaves differently on either side of it.
 */

export interface EvalChild {
  id: string;
  /** Why this profile is here. */
  why: string;
  /** "U-12" to "U-18". */
  ageGroup: "U-12" | "U-14" | "U-16" | "U-18";
  /** Null is a child who has played up but has no rank in their own list yet. */
  rank: number | null;
  /** Their registered state, or null where the list does not record one. */
  state: string | null;
  goal: SeasonGoal;
  blockedRanges?: Array<{ from: string; to: string; label?: string }>;
  /**
   * Plan some of the open events, by position in their own-group list (0 is the soonest),
   * so a profile does not depend on a slug that may not exist in a later calendar.
   */
  plannedPositions?: number[];
  /** Events already used earlier this year, to leave a small allowance. */
  playedEarlier?: number;
}

export const EVAL_CHILDREN: EvalChild[] = [
  {
    id: "u12-unranked",
    why: "Played up, no rank in their own list: no ranking bar should apply",
    ageGroup: "U-12",
    rank: null,
    state: "Haryana",
    goal: "points",
  },
  {
    id: "u12-mid-experience",
    why: "Youngest group, wants match experience",
    ageGroup: "U-12",
    rank: 140,
    state: "Maharashtra",
    goal: "experience",
  },
  {
    id: "u12-blocked-planned",
    why: "Blocked dates and one planned event to fit around, in the youngest group",
    ageGroup: "U-12",
    rank: 90,
    state: "Maharashtra",
    goal: "experience",
    blockedRanges: [{ from: "2026-10-20", to: "2026-11-05", label: "Exams" }],
    plannedPositions: [1],
  },
  {
    id: "u14-top-8",
    why: "Top of the list: Talent Series is shut, and the higher rungs are least out of reach",
    ageGroup: "U-14",
    rank: 8,
    state: "Delhi",
    goal: "points",
  },
  {
    id: "u14-rank-75",
    why: "On the bar: the last rank Talent Series is closed to",
    ageGroup: "U-14",
    rank: 75,
    state: "Haryana",
    goal: "points",
  },
  {
    id: "u14-rank-76",
    why: "Just off the bar: Talent Series opens again",
    ageGroup: "U-14",
    rank: 76,
    state: "Haryana",
    goal: "experience",
  },
  {
    id: "u14-mid-points",
    why: "The ordinary case, and the one that exposes the 'higher rung first' problem",
    ageGroup: "U-14",
    rank: 312,
    state: "Haryana",
    goal: "points",
  },
  {
    id: "u14-mid-home",
    why: "Home goal in a state with few events",
    ageGroup: "U-14",
    rank: 312,
    state: "Karnataka",
    goal: "home",
  },
  {
    id: "u14-low-experience",
    why: "Deep in the list, wanting match experience",
    ageGroup: "U-14",
    rank: 900,
    state: "Uttar Pradesh",
    goal: "experience",
  },
  {
    id: "u14-no-state-home",
    why: "Home goal but no state recorded: the goal must fall back, and say so",
    ageGroup: "U-14",
    rank: 400,
    state: null,
    goal: "home",
  },
  {
    id: "u14-busy-plan",
    why: "Three events already planned: new picks must fit around them",
    ageGroup: "U-14",
    rank: 312,
    state: "Haryana",
    goal: "points",
    plannedPositions: [0, 4, 9],
  },
  {
    id: "u14-exam-month",
    why: "A month blocked for exams",
    ageGroup: "U-14",
    rank: 312,
    state: "Haryana",
    goal: "points",
    blockedRanges: [{ from: "2026-11-01", to: "2026-11-30", label: "Exams" }],
  },
  {
    id: "u14-3-left",
    why: "Only three entries left this year",
    ageGroup: "U-14",
    rank: 312,
    state: "Haryana",
    goal: "points",
    playedEarlier: 22,
  },
  {
    id: "u14-none-left",
    why: "The yearly allowance is spent: nothing should be recommended, and it should say why",
    ageGroup: "U-14",
    rank: 312,
    state: "Haryana",
    goal: "points",
    playedEarlier: 25,
  },
  {
    id: "u16-top-20",
    why: "Strong U-16",
    ageGroup: "U-16",
    rank: 20,
    state: "Punjab",
    goal: "points",
  },
  {
    id: "u16-mid",
    why: "Ordinary U-16 in the south",
    ageGroup: "U-16",
    rank: 250,
    state: "Telangana",
    goal: "points",
  },
  {
    id: "u16-far-home",
    why: "Home goal in the far north-east: very few events in state",
    ageGroup: "U-16",
    rank: 500,
    state: "Assam",
    goal: "home",
  },
  {
    id: "u18-mid",
    why: "Oldest group has no Talent Series at all",
    ageGroup: "U-18",
    rank: 200,
    state: "Gujarat",
    goal: "points",
  },
  {
    id: "u18-low-experience",
    why: "Oldest group, deep in the list, wanting match experience",
    ageGroup: "U-18",
    rank: 700,
    state: "Tamil Nadu",
    goal: "experience",
  },
];
