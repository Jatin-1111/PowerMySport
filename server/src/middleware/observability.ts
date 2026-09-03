import { NextFunction, Request, Response } from "express";
import { getRequestContext } from "../utils/requestContext";

interface RouteMetric {
  routeKey: string;
  totalRequests: number;
  totalErrors: number;
  totalLatencyMs: number;
  maxLatencyMs: number;
  lastSeenAt: string;
}

const routeMetrics = new Map<string, RouteMetric>();

/**
 * Collapse high-cardinality segments so unmatched paths (404s, mostly) can't
 * grow the metrics map without bound. `.slice(0, 50)` on read hides the leak
 * from the admin UI but the Map itself keeps every distinct ObjectId forever.
 */
const normalizeSegment = (segment: string): string => {
  if (!segment) return segment;
  if (/^[0-9a-fA-F]{24}$/.test(segment)) return ":id";
  if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(segment))
    return ":id";
  if (/^\d+$/.test(segment)) return ":id";
  return segment;
};

export const normalizePath = (path: string): string =>
  path.split("/").map(normalizeSegment).join("/");

const buildRouteKey = (req: Request): string => {
  // `req.route.path` is only the sub-path within its router (`/:id`), so every
  // router's `/:id` used to collapse into one bucket. The mount prefix lives on
  // `req.baseUrl`.
  const routePath = req.route?.path
    ? `${req.baseUrl || ""}${req.route.path}`
    : normalizePath(req.path || req.url);
  return `${req.method.toUpperCase()} ${routePath || "/"}`;
};

/* ------------------------------------------- lifetime latency histograms */

/**
 * Per-route reservoirs for lifetime p50/p95/p99. Both dimensions are bounded:
 * `LIFETIME_SAMPLE_CAP` samples per route, `MAX_TRACKED_ROUTES` routes total.
 * Percentiles over an unbounded array is how an observability layer becomes
 * the thing that takes the process down.
 */
const LIFETIME_SAMPLE_CAP = 1000;
const MAX_TRACKED_ROUTES = 200;

const lifetimeLatencies = new Map<string, number[]>();

/* ------------------------------------------------------- latency budgets */

/**
 * A route's expected p95 ceiling. Breaching it is what "regression" means here
 * — a route that got slower than we said it may be, rather than a route that is
 * merely slow in absolute terms.
 *
 * `LOG_BUDGETS="GET /api/roadmap/:sport=500,POST /api/bookings=800"`.
 */
const parseBudgets = (): Map<string, number> => {
  const budgets = new Map<string, number>();
  const raw = process.env.LOG_BUDGETS;
  if (!raw) return budgets;

  for (const entry of raw.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const splitAt = trimmed.lastIndexOf("=");
    if (splitAt <= 0) continue;
    const key = trimmed.slice(0, splitAt).trim();
    const ms = Number(trimmed.slice(splitAt + 1).trim());
    if (key && Number.isFinite(ms) && ms > 0) budgets.set(key, ms);
  }
  return budgets;
};

const budgets = parseBudgets();

/** Falls back to `LOG_BUDGET_DEFAULT_MS` when no explicit budget is set. */
export const getBudgetMs = (routeKey: string): number | null => {
  const explicit = budgets.get(routeKey);
  if (explicit !== undefined) return explicit;
  const fallback = Number(process.env.LOG_BUDGET_DEFAULT_MS);
  return Number.isFinite(fallback) && fallback > 0 ? fallback : null;
};

/* ------------------------------------------------- rolling digest window */

const LATENCY_CAP = 2000;

interface WindowRoute {
  count: number;
  latencies: number[];
}

interface Window {
  count: number;
  errors: number;
  latencies: number[];
  perRoute: Map<string, WindowRoute>;
  dbMs: number;
  extMs: number;
  totalMs: number;
}

const freshWindow = (): Window => ({
  count: 0,
  errors: 0,
  latencies: [],
  perRoute: new Map(),
  dbMs: 0,
  extMs: 0,
  totalMs: 0,
});

let windowStore: Window = freshWindow();

/** Ring-buffer push: keep the newest `LATENCY_CAP` samples, bounded memory. */
const pushLatency = (bucket: number[], latencyMs: number): void => {
  if (bucket.length >= LATENCY_CAP) bucket.shift();
  bucket.push(latencyMs);
};

const percentile = (sorted: number[], p: number): number => {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index] ?? 0;
};

export interface WindowRouteSnapshot {
  routeKey: string;
  count: number;
  p95: number;
  /** The configured p95 ceiling, or null when the route has no budget. */
  budgetMs: number | null;
  /** True when this window's p95 breached that ceiling. */
  overBudget: boolean;
}

export interface WindowSnapshot {
  count: number;
  errors: number;
  errorRate: number;
  p50: number;
  p95: number;
  p99: number;
  /** Share of total request time spent in Mongo / third-party HTTP, 0–1. */
  dbShare: number;
  extShare: number;
  routes: WindowRouteSnapshot[];
  breaches: WindowRouteSnapshot[];
}

/** Returns the current window's numbers **and resets it**. */
export const takeWindowSnapshot = (): WindowSnapshot => {
  const current = windowStore;
  windowStore = freshWindow();

  const sorted = [...current.latencies].sort((a, b) => a - b);
  const routes = Array.from(current.perRoute.entries())
    .map(([routeKey, entry]) => {
      const p95 = percentile(
        [...entry.latencies].sort((a, b) => a - b),
        95
      );
      const budgetMs = getBudgetMs(routeKey);
      return {
        routeKey,
        count: entry.count,
        p95,
        budgetMs,
        overBudget: budgetMs !== null && p95 > budgetMs,
      };
    })
    .sort((a, b) => b.p95 - a.p95);

  return {
    count: current.count,
    errors: current.errors,
    errorRate: current.count > 0 ? current.errors / current.count : 0,
    p50: percentile(sorted, 50),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    dbShare: current.totalMs > 0 ? current.dbMs / current.totalMs : 0,
    extShare: current.totalMs > 0 ? current.extMs / current.totalMs : 0,
    routes,
    breaches: routes.filter((route) => route.overBudget),
  };
};

/* ------------------------------------------------------ latency profiles */

export interface LatencyProfile {
  routeKey: string;
  samples: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  budgetMs: number | null;
  overBudget: boolean;
}

/**
 * Lifetime per-route percentiles. Kept separate from
 * `getObservabilitySnapshot()` so that function's shape stays frozen for the
 * admin Server tab.
 */
export const getLatencyProfiles = (): LatencyProfile[] =>
  Array.from(lifetimeLatencies.entries())
    .map(([routeKey, samples]) => {
      const sorted = [...samples].sort((a, b) => a - b);
      const p95 = percentile(sorted, 95);
      const budgetMs = getBudgetMs(routeKey);
      return {
        routeKey,
        samples: sorted.length,
        p50: percentile(sorted, 50),
        p95,
        p99: percentile(sorted, 99),
        max: sorted[sorted.length - 1] ?? 0,
        budgetMs,
        overBudget: budgetMs !== null && p95 > budgetMs,
      };
    })
    .sort((a, b) => b.p95 - a.p95);

/* ----------------------------------------------------------- middleware */

export const observabilityMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  // Captured here, not inside `finish`: the finish event is emitted from the
  // socket's async context, where the request's AsyncLocalStorage store is not
  // reachable. The spans object is mutated in place, so holding the reference
  // still yields the final numbers.
  const context = getRequestContext();

  res.on("finish", () => {
    const latencyMs = Date.now() - start;
    const routeKey = buildRouteKey(req);
    const isError = res.statusCode >= 400;

    const existing = routeMetrics.get(routeKey) || {
      routeKey,
      totalRequests: 0,
      totalErrors: 0,
      totalLatencyMs: 0,
      maxLatencyMs: 0,
      lastSeenAt: new Date().toISOString(),
    };

    existing.totalRequests += 1;
    existing.totalLatencyMs += latencyMs;
    existing.maxLatencyMs = Math.max(existing.maxLatencyMs, latencyMs);
    existing.lastSeenAt = new Date().toISOString();

    if (isError) {
      existing.totalErrors += 1;
    }

    routeMetrics.set(routeKey, existing);

    // Lifetime reservoir for p50/p95/p99. New routes stop being tracked once
    // the cap is reached — bounded memory beats perfect coverage.
    let reservoir = lifetimeLatencies.get(routeKey);
    if (!reservoir && lifetimeLatencies.size < MAX_TRACKED_ROUTES) {
      reservoir = [];
      lifetimeLatencies.set(routeKey, reservoir);
    }
    if (reservoir) {
      if (reservoir.length >= LIFETIME_SAMPLE_CAP) reservoir.shift();
      reservoir.push(latencyMs);
    }

    // Rolling window for the periodic digest.
    windowStore.count += 1;
    if (isError) windowStore.errors += 1;
    pushLatency(windowStore.latencies, latencyMs);

    const spans = context?.spans;
    if (spans) {
      windowStore.dbMs += spans.dbMs;
      windowStore.extMs += spans.extMs;
    }
    windowStore.totalMs += latencyMs;

    const windowRoute = windowStore.perRoute.get(routeKey) || {
      count: 0,
      latencies: [],
    };
    windowRoute.count += 1;
    pushLatency(windowRoute.latencies, latencyMs);
    windowStore.perRoute.set(routeKey, windowRoute);
  });

  next();
};

export const getObservabilitySnapshot = () => {
  const metrics = Array.from(routeMetrics.values())
    .map((metric) => ({
      routeKey: metric.routeKey,
      totalRequests: metric.totalRequests,
      totalErrors: metric.totalErrors,
      errorRate:
        metric.totalRequests > 0
          ? Number((metric.totalErrors / metric.totalRequests).toFixed(4))
          : 0,
      avgLatencyMs:
        metric.totalRequests > 0
          ? Number((metric.totalLatencyMs / metric.totalRequests).toFixed(2))
          : 0,
      maxLatencyMs: metric.maxLatencyMs,
      lastSeenAt: metric.lastSeenAt,
    }))
    .sort((a, b) => b.totalRequests - a.totalRequests)
    .slice(0, 50);

  const totals = metrics.reduce(
    (acc, metric) => {
      acc.requests += metric.totalRequests;
      acc.errors += metric.totalErrors;
      return acc;
    },
    { requests: 0, errors: 0 }
  );

  return {
    totals: {
      requests: totals.requests,
      errors: totals.errors,
      errorRate: totals.requests > 0 ? Number((totals.errors / totals.requests).toFixed(4)) : 0,
    },
    routes: metrics,
    generatedAt: new Date().toISOString(),
  };
};
