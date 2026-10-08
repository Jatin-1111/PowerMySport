import type { ReachKind } from "@powermysport/shared-types";
import type { SeasonGoal } from "../../models/SeasonPlan";

/**
 * Season recommendations: what the planner suggests a child plays, and why.
 *
 * ── The rules that shape everything here ────────────────────────────────────
 * 1. The rules decide eligibility. A model never does.
 * 2. Code decides the season. Which events, in which tier, fitting around the plan, the
 *    rest days, the yearly allowance and the budget, is a constraint problem that code
 *    solves exactly (`builder.ts`). A model asked to do it needed its answer repaired.
 * 3. The model only WORDS the season. It is given the chosen events and writes a
 *    sentence for each, and every sentence is checked before a parent reads it
 *    (`validate.ts`). If it fails, the code's own sentence stands in, so the same season
 *    is shown whether or not the model answered.
 * 4. What is realistic is read from what happened. An event whose past draws closed
 *    above the child's rank is a "reach", shown apart from the picks (`reach.ts` in
 *    shared-types).
 */

export const MAX_RECOMMENDED = 6;
export const MAX_CONSIDER = 4;
/** A stretch is worth knowing about, not a list. */
export const MAX_REACH = 3;

/** Per parent, per day. Cached answers do not count. */
export const DAILY_AI_CAP = 10;

/**
 * - recommended: realistic for this child, and fits together with the plan
 * - consider:    realistic and a good option, but not to book alongside the rest
 * - reach:       past events of this kind closed above this rank (or there is no history
 *                and the level is cut by ranking): a stretch, never a pick
 */
export type RecommendationTier = "recommended" | "consider" | "reach";
export type RecommendationSource = "ai" | "rules";

/** Why the answer came from rules and not the model. Said to the parent. */
export type FallbackReason = "ai-unavailable" | "invalid-output" | "daily-limit";

export interface RecommendationItem {
  slug: string;
  tier: RecommendationTier;
  reason: string;
  /** Entries close within a week. */
  urgent?: boolean;
}

export interface RecommendationResult {
  source: RecommendationSource;
  fallbackReason?: FallbackReason;
  generatedAt: string;
  goal: SeasonGoal;
  /** One or two sentences on the shape of the season. */
  summary: string;
  items: RecommendationItem[];
  /** Plain facts about what was left out, e.g. events inside blocked dates. */
  notes: string[];
}

/** What a client receives: the result plus whether the inputs have moved on. */
export interface RecommendationView extends RecommendationResult {
  /** True when the child's list, plan or preferences changed after this was made. */
  stale: boolean;
  /** True when this is the saved answer, asked for again with nothing changed. */
  unchanged?: boolean;
}

export interface RecommendationUsage {
  used: number;
  cap: number;
}

/** An event the child can enter and the recommender may suggest. */
export interface Candidate {
  slug: string;
  name: string;
  startDate: string;
  endDate?: string;
  city?: string;
  state?: string;
  ladder?: string;
  grade?: number;
  /** ISO timestamp, or null when the calendar published none. */
  deadline: string | null;
  /** Whole days from today to the entry deadline, null with none, negative once passed. */
  daysToDeadline: number | null;
  /** True only when the event records a state and it matches the child's. */
  inHomeState: boolean;
  /** From the event's own fact sheet, where we hold one. */
  surface?: string;
  /** Singles entry fee in rupees, where the fact sheet states one. */
  feeSingles?: number;
  /** Would the child have got in, judged by past events. Absent without a verdict. */
  reach?: ReachKind;
  /** The verdict in words, with the figures it rests on. */
  reachText?: string;
  /** In an older age group than the child's own: only ever an option. */
  older?: boolean;
  /** Estimated travel and stay in rupees, when estimated. Never the entry fee. */
  cost?: { low: number; high: number };
}

export interface CommittedEvent {
  slug: string;
  name: string;
  startDate: string;
  endDate?: string;
  cost?: { low: number; high: number };
}

/** Everything the recommender sees, assembled once from the planner's output. */
export interface RecommendationContext {
  /** `YYYY-MM-DD`, UTC. Passed in so a run is reproducible. */
  today: string;
  child: { firstName: string; list: string; rank: number | null; state: string | null };
  goal: SeasonGoal;
  /** The goal actually applied: "home" falls back when no home state is known. */
  effectiveGoal: SeasonGoal;
  /** Yearly entries left, counting everything already on the plan. Null if uncapped. */
  allowanceLeft: number | null;
  /** What the parent wants the season to stay within, in rupees, or null. */
  budget: number | null;
  blockedRanges: Array<{ from: string; to: string; label?: string }>;
  /** Events in the child's own age group they may be suggested. */
  candidates: Candidate[];
  /** Events in an older age group, offered only as options and only when asked for. */
  olderCandidates: Candidate[];
  /** Events already on the plan and still ahead. Fixed points the rest must fit around. */
  committed: CommittedEvent[];
  skipped: { blocked: number; entriesClosed: number; dismissed: number };
}
