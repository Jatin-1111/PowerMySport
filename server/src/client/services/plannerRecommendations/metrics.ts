import redis from "../../../config/redis";

/**
 * Daily counters for the recommender, so quality drift and real use are visible.
 *
 * ── Why counters and not events ─────────────────────────────────────────────
 * Nothing here identifies anyone: a counter says "37 suggestions were asked for today",
 * not who asked. That is the point. It answers the questions that decide whether the
 * recommender is working (how often is the model used, how often does it fail, how often
 * does a parent add what was suggested) without recording any child's behaviour, which is
 * a different and heavier matter (see docs/planner-learning-plan.md, section 6). When
 * per-child records are wanted they need consent first; these do not.
 *
 * One Redis hash per day (IST, the parents' day), kept 90 days. Like every other Redis
 * feature here it fails open: a counter that cannot be written is dropped, never an error.
 */

export type MetricName =
  /** A request to make suggestions, whatever came of it. */
  | "asked"
  /** Answered from the cache: free, no model call. */
  | "cache_hit"
  /** The parent pressed "suggest again". */
  | "forced"
  /** Nothing to choose from, answered by the rules with no model call. */
  | "no_candidates"
  /** Over the parent's daily allowance, answered by the rules. */
  | "daily_limit"
  /** A model call was made. */
  | "model_called"
  /** The model's answer was used. */
  | "answered_by_model"
  /** The rules answered because the model failed, by why. */
  | "fallback_ai-unavailable"
  | "fallback_invalid-output"
  /** What validation repaired, summed over answers. */
  | "model_picks"
  | "model_dropped"
  | "model_demoted"
  | "model_reasons_replaced"
  | "model_foreign_names"
  /** A parent added an event to a plan, and whether it was one we had suggested. */
  | "added_from_suggestion"
  | "added_other";

export interface PlannerMetrics {
  increment(name: MetricName, by?: number): Promise<void>;
}

/** For tests, and for any caller that does not want counting. */
export const noMetrics: PlannerMetrics = { increment: async () => {} };

/** The parents' day: the date in IST. */
export const istDay = (now: Date): string =>
  new Date(now.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);

export const metricsKey = (day: string): string => `planner:metrics:${day}`;
const KEEP_SECONDS = 90 * 24 * 60 * 60;

export const redisMetrics = (now: () => Date = () => new Date()): PlannerMetrics => ({
  async increment(name, by = 1) {
    if (by === 0) return;
    try {
      const key = metricsKey(istDay(now()));
      await redis.hincrby(key, name, by);
      await redis.expire(key, KEEP_SECONDS);
    } catch {
      // A missed count is not worth a failed request.
    }
  },
});

/** Read-only: one day's counters, for the report script. */
export async function readMetrics(day: string): Promise<Record<string, number>> {
  const raw = await redis.hgetall(metricsKey(day));
  return Object.fromEntries(Object.entries(raw).map(([name, value]) => [name, Number(value)]));
}
