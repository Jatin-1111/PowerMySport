import { buildSeason } from "./builder";

/**
 * The recommender without the model.
 *
 * ── Why this is the whole answer, not a fallback of lesser quality ───────────
 * Code builds the season (`builder.ts`) and the model only words it. So when the model is
 * unavailable, over its limit, or returns something that fails validation, the parent
 * sees the same events in the same tiers, with sentences from the code. Nothing is
 * chosen worse and nothing is empty. This is also the yardstick the evaluation harness
 * holds the model's wording against.
 */
export { buildSeason as baselineRecommend };
export { conflictBetween, notesFor, reasonFor, summaryFor } from "./builder";
