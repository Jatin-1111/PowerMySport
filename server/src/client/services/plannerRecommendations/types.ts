import type { SeasonGoal } from "../../models/SeasonPlan";

/**
 * Season recommendations: what the planner suggests a child plays, and why.
 *
 * ── The one rule that shapes everything here ────────────────────────────────
 * The model may only CHOOSE among events the entry rules already allow. It never
 * decides eligibility, never adds an event, and never supplies a fact. Every
 * name, date and deadline a parent reads came from the calendar; the model's
 * contribution is the ordering, the grouping and the sentence of reasoning. That
 * is what makes a recommendation safe to act on, and it is enforced in code
 * (`validate.ts`), not left to the prompt.
 */

export const MAX_RECOMMENDED = 6;
export const MAX_CONSIDER = 4;

/** Per parent, per day. Cached answers do not count. */
export const DAILY_AI_CAP = 10;

export type RecommendationTier = "recommended" | "consider";
export type RecommendationSource = "ai" | "rules";

/** Why the answer came from rules and not the model. Said to the parent. */
export type FallbackReason = "ai-unavailable" | "invalid-output" | "daily-limit";

export interface RecommendationItem {
  slug: string;
  tier: RecommendationTier;
  reason: string;
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
  /** True only when the event records a state and it matches the child's. */
  inHomeState: boolean;
}

export interface CommittedEvent {
  slug: string;
  name: string;
  startDate: string;
  endDate?: string;
}

/** Everything the recommender sees, assembled once from the planner's output. */
export interface RecommendationContext {
  /** `YYYY-MM-DD`, UTC. Passed in so a run is reproducible. */
  today: string;
  child: { firstName: string; list: string; rank: number; state: string | null };
  goal: SeasonGoal;
  /** The goal actually applied: "home" falls back when no home state is known. */
  effectiveGoal: SeasonGoal;
  /** Yearly entries left, counting everything already on the plan. Null if uncapped. */
  allowanceLeft: number | null;
  blockedRanges: Array<{ from: string; to: string; label?: string }>;
  candidates: Candidate[];
  /** Events already on the plan and still ahead. Fixed points the rest must fit around. */
  committed: CommittedEvent[];
  skipped: { blocked: number; entriesClosed: number };
}
