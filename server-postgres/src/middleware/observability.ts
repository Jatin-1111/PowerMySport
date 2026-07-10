import { NextFunction, Request, Response } from "express";
import { randomUUID } from "crypto";

interface RouteMetric {
  routeKey: string;
  totalRequests: number;
  totalErrors: number;
  totalLatencyMs: number;
  maxLatencyMs: number;
  lastSeenAt: string;
}

const routeMetrics = new Map<string, RouteMetric>();

const buildRouteKey = (req: Request): string => {
  const routePath = req.route?.path || req.path || req.url;
  return `${req.method.toUpperCase()} ${routePath}`;
};

export const observabilityMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const start = Date.now();
  const requestId =
    (req.headers["x-request-id"] as string | undefined)?.trim() || randomUUID();

  res.setHeader("x-request-id", requestId);

  res.on("finish", () => {
    const latencyMs = Date.now() - start;
    const routeKey = buildRouteKey(req);
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

    if (res.statusCode >= 400) {
      existing.totalErrors += 1;
    }

    routeMetrics.set(routeKey, existing);
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
    { requests: 0, errors: 0 },
  );

  return {
    totals: {
      requests: totals.requests,
      errors: totals.errors,
      errorRate:
        totals.requests > 0
          ? Number((totals.errors / totals.requests).toFixed(4))
          : 0,
    },
    routes: metrics,
    generatedAt: new Date().toISOString(),
  };
};
