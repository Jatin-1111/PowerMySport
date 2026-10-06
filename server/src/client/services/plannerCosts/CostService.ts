import { dayNumber, type PlannerEdition } from "@powermysport/shared-types";
import redis from "../../../config/redis";
import { log as __rootLog } from "../../../utils/logger";
import { PlannerService, type PlannerOverview } from "../PlannerService";
import { callPlannerModel, type PlannerModel } from "../plannerRecommendations/gemini";
import { redisCounter, type DailyCounter } from "../plannerRecommendations/RecommendationService";
import { resolveOrigin } from "./origin";
import { buildCostPrompt, COST_SYSTEM_PROMPT } from "./prompt";
import { routeFor } from "./routes";
import {
  DAILY_COST_CALL_CAP,
  MAX_EVENTS_PER_REQUEST,
  type BudgetStatus,
  type CostResponse,
  type EventCostView,
  type Origin,
  type PartView,
  type Range,
  type Route,
  type RouteEstimate,
  type SeasonCostSummary,
} from "./types";
import { roughFor, validateCostOutput } from "./validate";
const log = __rootLog.child("plannerCosts");

/**
 * Travel and stay for the events on a child's plan and the ones suggested to them.
 *
 * ── Estimated by route, not by parent ───────────────────────────────────────
 * An estimate belongs to a trip (home, venue, length, month), so it is cached by
 * trip and shared. The first parent to ask about Pune to Chennai pays for the
 * model call and every later one is answered from the cache, which keeps the cost
 * of this feature near zero as it grows and means two parents are never told
 * different numbers for the same journey.
 *
 * ── Bounded, and never empty ────────────────────────────────────────────────
 * Model calls are limited per parent per day. Past the limit, or on any failure,
 * a route is priced from the rough table and labelled so. A rough figure is never
 * cached, so the next request can replace it with a real estimate.
 *
 * ── The parent's figures win ────────────────────────────────────────────────
 * Anything a parent has typed for an event replaces our estimate for that part,
 * and is shown as theirs. Entry fees exist only as their figure.
 */

const ROUTE_TTL_SECONDS = 30 * 24 * 60 * 60;
/** Routes per model call: enough to price a season in one, few enough to stay focused. */
const ROUTES_PER_CALL = 25;

export interface RouteStore {
  get(key: string): Promise<RouteEstimate | null>;
  set(key: string, estimate: RouteEstimate, ttlSeconds: number): Promise<void>;
}

export interface CostDeps {
  model: PlannerModel;
  store: RouteStore;
  counter: DailyCounter;
  now: () => Date;
  loadOverview: (userId: string, dependentId: string) => Promise<PlannerOverview>;
  resolveOrigin: (userId: string, registeredState: string | null) => Promise<Origin>;
}

const storeKey = (key: string): string => `planner:cost:v1:${key}`;

export const redisRouteStore: RouteStore = {
  async get(key) {
    try {
      const raw = await redis.get(storeKey(key));
      return raw ? (JSON.parse(raw) as RouteEstimate) : null;
    } catch {
      return null;
    }
  },
  async set(key, estimate, ttlSeconds) {
    try {
      await redis.set(storeKey(key), JSON.stringify(estimate), "EX", ttlSeconds);
    } catch {
      // A missed write costs one extra model call later, not a failed request.
    }
  },
};

const sum = (a: Range, b: Range): Range => ({ low: a.low + b.low, high: a.high + b.high });

export function budgetStatus(total: Range | null, budget: number | null): BudgetStatus {
  if (!total || budget === null) return "none";
  if (total.high <= budget) return "within";
  return total.low <= budget ? "may-exceed" : "over";
}

interface EventInfo {
  slug: string;
  startDate: string;
  endDate?: string | undefined;
  city?: string | null | undefined;
  state?: string | null | undefined;
  /** AITA's published entry fee for the event, when we have read it. */
  officialFee?: { singles: number; source: "factSheet" | "rules" } | undefined;
}

type PlanEntry = PlannerOverview["plan"]["entries"][number];

/** The figures a parent has typed, or the estimate, for one part of one event. */
const partFor = (yours: number | undefined, estimated: Range | null): PartView | null => {
  if (yours !== undefined) return { low: yours, high: yours, basis: "yours" };
  return estimated ? { ...estimated, basis: "estimate" } : null;
};

export function viewFor(
  event: EventInfo,
  entry: PlanEntry | undefined,
  origin: Origin,
  estimate: RouteEstimate | null
): EventCostView {
  const yours = entry?.costs;
  const travel = partFor(yours?.travel, estimate?.travel ?? null);
  const stay = partFor(yours?.stay, estimate?.stay ?? null);
  // The parent's own figure always wins. Next best is what AITA prints for this
  // event, which is a fact and not an estimate; the model is never asked for one.
  const entryFee = yours?.entryFee ?? event.officialFee?.singles ?? null;
  const entryFeeBasis: EventCostView["entryFeeBasis"] =
    yours?.entryFee !== undefined
      ? "yours"
      : event.officialFee
        ? event.officialFee.source === "factSheet"
          ? "fact-sheet"
          : "rules"
        : null;

  // A total needs both halves of the trip. Half a trip priced would read as the
  // whole of it.
  let total: Range | null = null;
  if (travel && stay) {
    total = sum(travel, stay);
    if (entryFee !== null) total = sum(total, { low: entryFee, high: entryFee });
  }

  let note: string | null = null;
  if (!total) {
    note =
      origin.kind === "none"
        ? "Add your city to estimate travel and stay."
        : !event.city && !event.state
          ? "No venue is published for this event, so travel and stay cannot be estimated."
          : null;
  }

  return {
    slug: event.slug,
    source: estimate?.source ?? null,
    assumptions: estimate?.assumptions ?? null,
    travel,
    stay,
    entryFee,
    entryFeeBasis,
    total,
    entryFeeMissing: entryFee === null,
    note,
  };
}

export function summarizeSeason(views: EventCostView[], budget: number | null): SeasonCostSummary {
  let total: Range | null = null;
  for (const view of views) {
    if (view.total) total = total ? sum(total, view.total) : { ...view.total };
  }
  return {
    events: views.length,
    withoutFigures: views.filter((view) => !view.total).length,
    total,
    budget,
    status: budgetStatus(total, budget),
    missingEntryFees: views.filter((view) => view.entryFeeMissing).length,
  };
}

export function createCostService(deps: CostDeps) {
  /** Price the routes the cache does not hold. Never throws; falls back to rough. */
  const fill = async (
    userId: string,
    routes: Map<string, Route>
  ): Promise<Map<string, RouteEstimate>> => {
    const found = new Map<string, RouteEstimate>();
    const startedAt = Date.now();
    let modelCalls = 0;

    const cached = await Promise.all(
      [...routes.keys()].map(async (key) => [key, await deps.store.get(key)] as const)
    );
    for (const [key, estimate] of cached) if (estimate) found.set(key, estimate);
    const fromCache = found.size;

    const missing = [...routes.values()].filter((route) => !found.has(route.key));
    for (let i = 0; i < missing.length; i += ROUTES_PER_CALL) {
      const batch = missing.slice(i, i + ROUTES_PER_CALL);

      const used = await deps.counter.increment(userId);
      if (used > DAILY_COST_CALL_CAP) {
        await deps.counter.decrement(userId);
        break; // Over the day's limit: the rest are priced from the rough table.
      }

      let accepted: Map<string, RouteEstimate> | null = null;
      modelCalls += 1;
      try {
        const { prompt, byId } = buildCostPrompt(batch);
        accepted = validateCostOutput(await deps.model(COST_SYSTEM_PROMPT, prompt), byId);
      } catch (error) {
        log.warn("Cost model call failed", error instanceof Error ? error.message : error);
      }

      if (!accepted || accepted.size === 0) {
        // Our failure, not the parent's: give the call back.
        await deps.counter.decrement(userId);
        continue;
      }
      for (const [key, estimate] of accepted) {
        found.set(key, estimate);
        await deps.store.set(key, estimate, ROUTE_TTL_SECONDS);
      }
    }

    // Anything still unpriced gets the rough table, uncached.
    const fromModel = found.size - fromCache;
    for (const route of routes.values()) {
      if (!found.has(route.key)) found.set(route.key, roughFor(route));
    }

    // One line per request that did any work beyond the cache: the rate of rough
    // fallbacks is the signal that the model is failing or being refused.
    if (modelCalls > 0 || found.size - fromCache - fromModel > 0) {
      log.info(
        `costs routes=${routes.size} cached=${fromCache} priced=${fromModel} rough=${found.size - fromCache - fromModel} modelCalls=${modelCalls} ms=${Date.now() - startedAt}`
      );
    }
    return found;
  };

  return {
    /**
     * Costs for the events on a child's plan plus any others asked about (the
     * suggestions on screen). Slugs the child's planner does not know are ignored,
     * so this can only ever price events the page could itself show.
     */
    async estimate(
      userId: string,
      dependentId: string,
      requestedSlugs: string[] = []
    ): Promise<CostResponse> {
      const overview = await deps.loadOverview(userId, dependentId);
      const now = deps.now();
      const today = now.toISOString().slice(0, 10);

      const calendar = new Map<string, PlannerEdition>();
      for (const bucket of [
        overview.shortlist?.ownGroup,
        overview.shortlist?.playingUp,
        overview.shortlist?.unknown,
        overview.shortlist?.closed,
      ]) {
        for (const entry of bucket ?? []) {
          if (entry.edition.slug) calendar.set(entry.edition.slug, entry.edition);
        }
      }

      const entries = new Map(overview.plan.entries.map((entry) => [entry.editionSlug, entry]));
      const upcomingPlan = overview.plan.entries.filter(
        (entry) =>
          entry.status !== "played" &&
          dayNumber(new Date(entry.startDate).toISOString()) >= dayNumber(today)
      );

      const slugs = [
        ...new Set([...upcomingPlan.map((entry) => entry.editionSlug), ...requestedSlugs]),
      ]
        .filter((slug) => calendar.has(slug) || entries.has(slug))
        .slice(0, MAX_EVENTS_PER_REQUEST);

      const origin = await deps.resolveOrigin(userId, overview.standing?.state ?? null);

      const infoFor = (slug: string): EventInfo => {
        const live = calendar.get(slug);
        const entry = entries.get(slug);
        return {
          slug,
          startDate: live?.startDate ?? new Date(entry!.startDate).toISOString(),
          endDate: live?.endDate,
          city: live?.city,
          state: live?.state,
          officialFee:
            typeof live?.official?.feeSingles === "number"
              ? { singles: live.official.feeSingles, source: live.official.source }
              : undefined,
        };
      };

      const routes = new Map<string, Route>();
      const routeOf = new Map<string, Route | null>();
      for (const slug of slugs) {
        const route = routeFor(origin, infoFor(slug));
        routeOf.set(slug, route);
        if (route) routes.set(route.key, route);
      }

      const estimates = routes.size > 0 ? await fill(userId, routes) : new Map();

      const events: Record<string, EventCostView> = {};
      for (const slug of slugs) {
        const route = routeOf.get(slug);
        events[slug] = viewFor(
          infoFor(slug),
          entries.get(slug),
          origin,
          route ? (estimates.get(route.key) ?? null) : null
        );
      }

      const planViews = upcomingPlan
        .map((entry) => events[entry.editionSlug])
        .filter((view): view is EventCostView => Boolean(view));

      return {
        origin,
        events,
        season: summarizeSeason(planViews, overview.plan.preferences.budget),
      };
    },
  };
}

const defaultNow = () => new Date();

export const CostService = createCostService({
  model: callPlannerModel,
  store: redisRouteStore,
  counter: redisCounter(defaultNow, "planner:cost:daily"),
  now: defaultNow,
  loadOverview: (userId, dependentId) => PlannerService.forDependent(userId, dependentId),
  resolveOrigin,
});
