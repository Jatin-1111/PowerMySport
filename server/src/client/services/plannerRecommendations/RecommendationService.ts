import { createHash } from "crypto";
import redis from "../../../config/redis";
import { AppError } from "../../../utils/AppError";
import { log as __rootLog } from "../../../utils/logger";
import { PlannerService, type PlannerOverview } from "../PlannerService";
import { baselineRecommend } from "./baseline";
import { buildContext } from "./candidates";
import { callPlannerModel, type PlannerModel } from "./gemini";
import { SYSTEM_PROMPT, buildUserPrompt } from "./prompt";
import {
  DAILY_AI_CAP,
  type RecommendationContext,
  type RecommendationResult,
  type RecommendationUsage,
  type RecommendationView,
} from "./types";
import { validateModelOutput } from "./validate";
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

export const redisCounter = (now: () => Date): DailyCounter => {
  const key = (userId: string) => `planner:ai:daily:${userId}:${istDateKey(now())}`;
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
    blockedRanges: context.blockedRanges,
    candidates: context.candidates.map((c) => [c.slug, c.startDate, c.deadline, c.inHomeState]),
    committed: context.committed.map((c) => [c.slug, c.startDate]),
  };
  return createHash("sha1").update(JSON.stringify(fingerprint)).digest("hex");
}

export function createRecommendationService(deps: RecommendationDeps) {
  /** Drop suggestions that are no longer candidates, so a stale answer cannot name a closed event. */
  const stillValid = (
    result: RecommendationResult,
    context: RecommendationContext
  ): RecommendationResult => {
    const live = new Set(context.candidates.map((candidate) => candidate.slug));
    return { ...result, items: result.items.filter((item) => live.has(item.slug)) };
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

      const key = cacheKey(userId, dependentId);
      const inputHash = inputHashOf(context);
      const save = async (result: RecommendationResult) => {
        await deps.store.set(key, { inputHash, result }, CACHE_TTL_SECONDS);
        return result;
      };

      const cached = await deps.store.get(key);
      if (cached && cached.inputHash === inputHash && !options.force) {
        return {
          ready: true,
          recommendations: { ...cached.result, stale: false },
          usage: await usageFor(userId),
        };
      }

      // Nothing to choose from: the rules can say so without a model call.
      if (context.candidates.length === 0) {
        const result = await save(baselineRecommend(context, now));
        return {
          ready: true,
          recommendations: { ...result, stale: false },
          usage: await usageFor(userId),
        };
      }

      const used = await deps.counter.increment(userId);
      if (used > DAILY_AI_CAP) {
        await deps.counter.decrement(userId);
        // Not cached: tomorrow's allowance should be able to replace it.
        const result = baselineRecommend(context, now, "daily-limit");
        return {
          ready: true,
          recommendations: { ...result, stale: false },
          usage: await usageFor(userId),
        };
      }

      let result: RecommendationResult | null = null;
      let fallback: "ai-unavailable" | "invalid-output" = "ai-unavailable";
      try {
        const raw = await deps.model(SYSTEM_PROMPT, buildUserPrompt(context));
        result = validateModelOutput(raw, context, now);
        if (!result) fallback = "invalid-output";
      } catch (error) {
        log.warn("Planner model call failed", error instanceof Error ? error.message : error);
      }

      if (!result) {
        // Our failure, not the parent's: give the answer back.
        await deps.counter.decrement(userId);
        const rules = baselineRecommend(context, now, fallback);
        return {
          ready: true,
          recommendations: { ...rules, stale: false },
          usage: await usageFor(userId),
        };
      }

      await save(result);
      return {
        ready: true,
        recommendations: { ...result, stale: false },
        usage: await usageFor(userId),
      };
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
  loadOverview: (userId, dependentId) => PlannerService.forDependent(userId, dependentId),
});
