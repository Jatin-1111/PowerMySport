import { createHash } from "crypto";
import redis from "../../../config/redis";
import { AppError } from "../../../utils/AppError";
import { log as __rootLog } from "../../../utils/logger";
import { PlannerService, type PlannerOverview } from "../PlannerService";
import { buildSeason } from "./builder";
import { buildContext, withCosts } from "./candidates";
import { callPlannerModel, type PlannerModel } from "./gemini";
import { noMetrics, redisMetrics, type PlannerMetrics } from "./metrics";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import {
  DAILY_AI_CAP,
  type RecommendationContext,
  type RecommendationResult,
  type RecommendationUsage,
  type RecommendationView,
} from "./types";
import { hasWordableItems, inspectModelOutput } from "./validate";
const log = __rootLog.child("plannerRecommendations");

/**
 * Season recommendations for one child: cached, rate-limited, and never empty.
 *
 * ── The three things this guarantees ────────────────────────────────────────
 * 1. A parent always gets an answer. If the model is down, over its limit, or
 *    returns something that fails validation, the rule-based answer is returned
 *    with the reason, so the planner never dead-ends.
 * 2. The model is called only on a deliberate request, and only when something
 *    has changed or the parent asks again. Opening the page never spends a call,
 *    and a repeat of the same question is answered from the cache for free.
 * 3. A parent gets {@link DAILY_AI_CAP} fresh answers a day. A call that fails on
 *    our side is refunded, so the limit measures answers received.
 *
 * ── Why the chat can quote these ────────────────────────────────────────────
 * The result is cached against a hash of everything it was built from. The
 * assistant chat reads it only while that hash still matches, so it repeats what
 * the page showed and never asks the model again on a parent's allowance.
 */

const CACHE_TTL_SECONDS = 24 * 60 * 60;

export interface StoredRecommendation {
  /** Fingerprint of the inputs this answer was built from. */
  inputHash: string;
  result: RecommendationResult;
}

export interface RecommendationStore {
  get(key: string): Promise<StoredRecommendation | null>;
  set(key: string, value: StoredRecommendation, ttlSeconds: number): Promise<void>;
}

export interface DailyCounter {
  get(userId: string): Promise<number>;
  /** Reserve one answer. Returns the new count. */
  increment(userId: string): Promise<number>;
  decrement(userId: string): Promise<void>;
}

export interface RecommendationDeps {
  model: PlannerModel;
  store: RecommendationStore;
  counter: DailyCounter;
  now: () => Date;
  /** Loads the planner's verdicts. A seam so a test need not seed a database. */
  loadOverview: (userId: string, dependentId: string) => Promise<PlannerOverview>;
  /** Daily counters. Optional: a test that does not care need not pass one. */
  metrics?: PlannerMetrics;
  /**
   * Estimated travel and stay for events, by slug, in rupees. Used only to keep a season
   * inside the parent's budget and to rank by cost for the home goal, and only asked for
   * when one of those applies. Optional: without it the season is chosen without costs.
   */
  loadCosts?: (
    userId: string,
    dependentId: string,
    slugs: string[]
  ) => Promise<Record<string, { low: number; high: number }>>;
}

// ─── Defaults: Redis, failing open like every other Redis feature here ────────

const istDateKey = (now: Date): string =>
  new Date(now.getTime() + 5.5 * 60 * 60 * 1000).toISOString().slice(0, 10);

export const redisStore: RecommendationStore = {
  async get(key) {
    try {
      const raw = await redis.get(key);
      return raw ? (JSON.parse(raw) as StoredRecommendation) : null;
    } catch {
      return null;
    }
  },
  async set(key, value, ttlSeconds) {
    try {
      await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch {
      // A missed cache write costs one extra answer, not a failed request.
    }
  },
};

/** `prefix` keeps each feature's daily allowance separate from the others. */
export const redisCounter = (now: () => Date, prefix = "planner:ai:daily"): DailyCounter => {
  const key = (userId: string) => `${prefix}:${userId}:${istDateKey(now())}`;
  return {
    async get(userId) {
      try {
        const value = await redis.get(key(userId));
        return value ? parseInt(value, 10) : 0;
      } catch {
        return 0;
      }
    },
    async increment(userId) {
      try {
        const count = await redis.incr(key(userId));
        // The date in the key already rotates daily; this only tidies up.
        if (count === 1) await redis.expire(key(userId), 48 * 60 * 60);
        return count;
      } catch {
        return 1;
      }
    },
    async decrement(userId) {
      try {
        await redis.decr(key(userId));
      } catch {
        // fail open
      }
    },
  };
};

const cacheKey = (userId: string, dependentId: string): string =>
  `planner:rec:${userId}:${dependentId}`;

/**
 * What the answer depends on. When any of it changes the cached answer is stale:
 * a new ranking list, an event added to the plan, a preference edited, or an
 * event dropping off the calendar. Today's date is left out on purpose, or every
 * answer would go stale at midnight.
 */
export function inputHashOf(context: RecommendationContext): string {
  const fingerprint = {
    goal: context.goal,
    effectiveGoal: context.effectiveGoal,
    rank: context.child.rank,
    list: context.child.list,
    allowanceLeft: context.allowanceLeft,
    budget: context.budget,
    blockedRanges: context.blockedRanges,
    candidates: context.candidates.map((c) => [
      c.slug,
      c.startDate,
      c.deadline,
      c.inHomeState,
      c.reach ?? null,
    ]),
    older: context.olderCandidates.map((c) => c.slug),
    committed: context.committed.map((c) => [c.slug, c.startDate]),
  };
  return createHash("sha1").update(JSON.stringify(fingerprint)).digest("hex");
}

export function createRecommendationService(deps: RecommendationDeps) {
  const metrics = deps.metrics ?? noMetrics;
  /** Count and move on: a counter that fails must not fail, or even slow, a request. */
  const count = (name: Parameters<PlannerMetrics["increment"]>[0], by?: number): void => {
    Promise.resolve()
      .then(() => metrics.increment(name, by))
      .catch(() => undefined);
  };
  /** Drop suggestions that are no longer candidates, so a stale answer cannot name a closed event. */
  const stillValid = (
    result: RecommendationResult,
    context: RecommendationContext
  ): RecommendationResult => {
    const live = new Set(
      [...context.candidates, ...context.olderCandidates].map((candidate) => candidate.slug)
    );
    return { ...result, items: result.items.filter((item) => live.has(item.slug)) };
  };

  /**
   * The context with estimated travel and stay filled in, but only when something will use
   * them: a budget to keep within, or "close to home" to rank by. Asking costs a model call
   * on a route nobody has priced, so it is not done for a parent who has set neither. A
   * failure leaves the season chosen without costs, which the notes say.
   */
  const priced = async (
    userId: string,
    dependentId: string,
    context: RecommendationContext
  ): Promise<RecommendationContext> => {
    if (!deps.loadCosts) return context;
    if (context.budget === null && context.effectiveGoal !== "home") return context;
    const slugs = [...context.candidates, ...context.committed].map((event) => event.slug);
    try {
      return withCosts(context, await deps.loadCosts(userId, dependentId, slugs));
    } catch (error) {
      log.warn("Could not price the season", error instanceof Error ? error.message : error);
      return context;
    }
  };

  const usageFor = async (userId: string): Promise<RecommendationUsage> => ({
    used: Math.min(await deps.counter.get(userId), DAILY_AI_CAP),
    cap: DAILY_AI_CAP,
  });

  const viewOf = (
    stored: StoredRecommendation,
    context: RecommendationContext
  ): RecommendationView => {
    const stale = stored.inputHash !== inputHashOf(context);
    return { ...(stale ? stillValid(stored.result, context) : stored.result), stale };
  };

  return {
    /**
     * The saved answer, if any, and whether it still matches the child's
     * situation. Never calls the model and never spends the daily allowance.
     */
    async get(userId: string, dependentId: string) {
      const overview = await deps.loadOverview(userId, dependentId);
      const context = buildContext(overview, deps.now());
      const usage = await usageFor(userId);
      if (!context) return { ready: false, recommendations: null, usage };

      const stored = await deps.store.get(cacheKey(userId, dependentId));
      return {
        ready: true,
        recommendations: stored ? viewOf(stored, context) : null,
        usage,
      };
    },

    /**
     * Make (or reuse) the recommendations. Reuses the cached answer when nothing
     * has changed and the parent did not ask for a fresh one.
     */
    async generate(userId: string, dependentId: string, options: { force?: boolean } = {}) {
      const overview = await deps.loadOverview(userId, dependentId);
      const now = deps.now();
      const context = buildContext(overview, now);
      if (!context) {
        throw new AppError("Link a ranking first, so there is a list to plan against.", 409);
      }
      count("asked");
      if (options.force) count("forced");

      const key = cacheKey(userId, dependentId);
      const inputHash = inputHashOf(context);
      const save = async (result: RecommendationResult) => {
        await deps.store.set(key, { inputHash, result }, CACHE_TTL_SECONDS);
        return result;
      };

      const cached = await deps.store.get(key);
      if (cached && cached.inputHash === inputHash) {
        if (!options.force) {
          count("cache_hit");
        } else {
          // Asked again with nothing changed. The season is chosen by code, so a fresh
          // answer would be the same events in different words: not worth an allowance.
          count("unchanged");
        }
        return {
          ready: true,
          recommendations: {
            ...cached.result,
            stale: false,
            ...(options.force ? { unchanged: true } : {}),
          },
          usage: await usageFor(userId),
        };
      }

      // The season is built from the context with costs, if any are wanted. The cache key
      // is not: a re-estimate must not make a saved answer look stale.
      const costed = await priced(userId, dependentId, context);
      const season = buildSeason(costed, now);

      // Nothing to choose from, or nothing for a model to say: the code can answer
      // without a model call, and without spending an allowance.
      if (!hasWordableItems(season.items, costed)) {
        count("no_candidates");
        const result = await save(season);
        return {
          ready: true,
          recommendations: { ...result, stale: false },
          usage: await usageFor(userId),
        };
      }

      const used = await deps.counter.increment(userId);
      if (used > DAILY_AI_CAP) {
        await deps.counter.decrement(userId);
        count("daily_limit");
        // Not cached: tomorrow's allowance should be able to replace it.
        const result = buildSeason(costed, now, "daily-limit");
        return {
          ready: true,
          recommendations: { ...result, stale: false },
          usage: await usageFor(userId),
        };
      }

      let result: RecommendationResult | null = null;
      let fallback: "ai-unavailable" | "invalid-output" = "ai-unavailable";
      let repairs = "";
      const startedAt = Date.now();
      count("model_called");
      try {
        const raw = await deps.model(SYSTEM_PROMPT, buildUserPrompt(costed, now), {
          slugs: season.items.map((item) => item.slug),
        });
        const inspected = inspectModelOutput(raw, costed, now);
        result = inspected.result;
        const stats = inspected.stats;
        count("model_picks", stats.picks);
        count("model_dropped", stats.dropped);
        count("model_reasons_missing", stats.reasonsMissing);
        count("model_reasons_replaced", stats.reasonsReplaced);
        count("model_foreign_names", stats.foreignNames);
        repairs = `picks=${stats.picks} dropped=${stats.dropped} reasonsMissing=${stats.reasonsMissing} reasonsReplaced=${stats.reasonsReplaced} foreignNames=${stats.foreignNames} summaryReplaced=${stats.summaryReplaced}`;
        if (!result) fallback = "invalid-output";
      } catch (error) {
        log.warn("Planner model call failed", error instanceof Error ? error.message : error);
      }

      // One line per model call, with no identifiers: enough to watch cost,
      // latency and how often the validator has to repair the model's answer.
      log.info(
        `suggest outcome=${result ? "ai" : fallback} candidates=${context.candidates.length} force=${options.force === true} ms=${Date.now() - startedAt} ${repairs}`.trim()
      );

      if (!result) {
        count(
          fallback === "invalid-output" ? "fallback_invalid-output" : "fallback_ai-unavailable"
        );
        // Our failure, not the parent's: give the answer back.
        await deps.counter.decrement(userId);
        const rules = buildSeason(costed, now, fallback);
        return {
          ready: true,
          recommendations: { ...rules, stale: false },
          usage: await usageFor(userId),
        };
      }

      count("answered_by_model");
      await save(result);
      return {
        ready: true,
        recommendations: { ...result, stale: false },
        usage: await usageFor(userId),
      };
    },

    /**
     * A parent added an event to a plan: was it one we had suggested? Counted, not
     * recorded, so it says nothing about who. Reads the saved answer whether or not it
     * is still current: a parent who adds from a slightly stale list still acted on it.
     */
    async noteAdded(userId: string, dependentId: string, slug: string): Promise<void> {
      try {
        const stored = await deps.store.get(cacheKey(userId, dependentId));
        const suggested = stored?.result.items.some((item) => item.slug === slug) ?? false;
        await metrics.increment(suggested ? "added_from_suggestion" : "added_other");
      } catch {
        // Counting must never get in the way of adding.
      }
    },

    /**
     * The parent marked a suggested event "not for us". Counted, not recorded. When the
     * saved answer is named, it is re-saved without that event and against the new
     * candidates: leaving it would make the parent's own choice read as "your situation
     * has changed" and invite an update they do not need.
     */
    async noteDismissed(userId?: string, dependentId?: string, slug?: string): Promise<void> {
      try {
        await metrics.increment("dismissed");
      } catch {
        // Counting must never get in the way of the dismissal.
      }
      if (!userId || !dependentId || !slug) return;
      try {
        const key = cacheKey(userId, dependentId);
        const stored = await deps.store.get(key);
        if (!stored) return;
        const context = buildContext(await deps.loadOverview(userId, dependentId), deps.now());
        if (!context) return;
        await deps.store.set(
          key,
          {
            inputHash: inputHashOf(context),
            result: {
              ...stored.result,
              items: stored.result.items.filter((item) => item.slug !== slug),
            },
          },
          CACHE_TTL_SECONDS
        );
      } catch {
        // The worst case is the old banner, which is harmless.
      }
    },

    /**
     * The saved answer only while it is still current, for the assistant chat.
     * Reads the overview the caller already has, and never generates.
     */
    async peekFresh(
      userId: string,
      overview: PlannerOverview
    ): Promise<RecommendationResult | null> {
      const context = buildContext(overview, deps.now());
      if (!context) return null;
      const stored = await deps.store.get(cacheKey(userId, overview.dependentId));
      return stored && stored.inputHash === inputHashOf(context) ? stored.result : null;
    },
  };
}

const defaultNow = () => new Date();

export const RecommendationService = createRecommendationService({
  model: callPlannerModel,
  store: redisStore,
  counter: redisCounter(defaultNow),
  now: defaultNow,
  metrics: redisMetrics(defaultNow),
  loadOverview: (userId, dependentId) => PlannerService.forDependent(userId, dependentId),
  loadCosts: async (userId, dependentId, slugs) => {
    // Imported here: the cost service shares this file's daily counter, so importing it
    // at the top would make the two files import each other.
    const { CostService } = await import("../plannerCosts/CostService");
    const { events } = await CostService.estimate(userId, dependentId, slugs.slice(0, 40));
    return Object.fromEntries(
      Object.entries(events).flatMap(([slug, view]) =>
        view.total ? [[slug, { low: view.total.low, high: view.total.high }]] : []
      )
    );
  },
});
