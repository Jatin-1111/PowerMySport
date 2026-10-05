/**
 * What a season costs, as far as we can honestly say.
 *
 * ── What is estimated, and what is not ──────────────────────────────────────
 * Travel and stay are ESTIMATED, as ranges, from the child's home to the venue.
 * Entry fees are NOT: the federation's calendar does not publish them, and the
 * fact sheets that would are temporary signed links that have already expired, so
 * any number we showed would be a guess dressed as data. Entry fees are a figure
 * the parent types in, and a total says plainly when fees are not in it.
 *
 * Every estimate carries its assumptions and is labelled an estimate wherever it
 * appears. A parent's own figure always replaces ours.
 */

export interface Range {
  low: number;
  high: number;
}

/** Where a range came from. "rough" is the rule-of-thumb table, not the model. */
export type CostSource = "ai" | "rough";

/** One route's estimate, for the child and one parent travelling together. */
export interface RouteEstimate {
  travel: Range;
  stay: Range;
  source: CostSource;
  /** One line a parent can read to see what the numbers assume. */
  assumptions: string;
}

/** Where the trip starts. */
export interface Origin {
  kind: "city" | "state" | "none";
  city?: string;
  state?: string;
  /** What the page says: "Pune", "Haryana", or null. */
  label: string | null;
}

/** How the destination relates to home, when that is known. */
export type Relation = "same-city" | "same-state" | "other-state" | "unknown";

/** A trip the estimator is asked about. Several events can share one. */
export interface Route {
  /** Stable key: the same trip always maps to the same cache entry. */
  key: string;
  origin: Origin;
  destinationCity: string | null;
  destinationState: string | null;
  /** Days the event runs, capped. Nights away follow from it. */
  eventDays: number;
  /** 1 to 12. Seasonality affects fares and rooms. */
  month: number;
  relation: Relation;
}

export type Basis = "estimate" | "yours";

export interface PartView {
  low: number;
  high: number;
  basis: Basis;
}

export interface EventCostView {
  slug: string;
  /** Null when the planner has nothing to estimate from (no home, or no venue). */
  source: CostSource | null;
  assumptions: string | null;
  travel: PartView | null;
  stay: PartView | null;
  /** Only ever the parent's own figure. */
  entryFee: number | null;
  /** Travel and stay plus the fee if given. Null when there is no figure at all. */
  total: Range | null;
  /** True while no entry fee has been entered, so the total is not the whole cost. */
  entryFeeMissing: boolean;
  /** Why there is no estimate, in words. Null when there is one. */
  note: string | null;
}

export type BudgetStatus = "within" | "may-exceed" | "over" | "none";

export interface SeasonCostSummary {
  /** Events on the plan, still ahead, that the figures cover. */
  events: number;
  /** How many of them have no total at all. */
  withoutFigures: number;
  total: Range | null;
  budget: number | null;
  status: BudgetStatus;
  /** Events whose entry fee has not been entered. */
  missingEntryFees: number;
}

export interface CostResponse {
  origin: Origin;
  events: Record<string, EventCostView>;
  season: SeasonCostSummary;
}

/** Model calls for cost estimates, per parent per day. Cached routes do not count. */
export const DAILY_COST_CALL_CAP = 20;

/** Most events a single request will price. */
export const MAX_EVENTS_PER_REQUEST = 40;
