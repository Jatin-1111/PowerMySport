import { AsyncLocalStorage } from "async_hooks";
import { randomUUID } from "crypto";
import type { NextFunction, Request, Response } from "express";

/**
 * Per-request context, carried implicitly through the whole async call tree.
 *
 * The point is correlation: any log line emitted anywhere during a request —
 * ten service calls deep, inside a `.catch()`, from a helper that has no idea
 * it's running inside HTTP — automatically carries the same request id. Without
 * this, concurrent requests interleave in the terminal and there is no way to
 * tell which of 200 lines belong to the checkout that failed.
 *
 * Nothing has to be threaded through function signatures to get this.
 */
/**
 * Where a request's wall-clock actually went.
 *
 * Mutated in place by the instrumentation in `timings.ts`. "handler" time is
 * never measured directly — it is whatever total latency is left once db and
 * ext are subtracted, which is the only honest way to compute it.
 */
export interface RequestSpans {
  dbMs: number;
  dbCount: number;
  extMs: number;
  extCount: number;
}

export interface RequestContext {
  /** Echoed from an inbound `x-request-id`, or freshly generated. */
  requestId: string;
  method: string;
  /** Path only (no query string). */
  path: string;
  /** High-resolution start, for latency. */
  startedAt: bigint;
  /** Mutable time attribution, accumulated as the request runs. */
  spans: RequestSpans;
}

const freshSpans = (): RequestSpans => ({
  dbMs: 0,
  dbCount: 0,
  extMs: 0,
  extCount: 0,
});

const storage = new AsyncLocalStorage<RequestContext>();

/** The context of the in-flight request, or undefined outside one (cron, boot, scripts). */
export const getRequestContext = (): RequestContext | undefined =>
  storage.getStore();

/** Short form used in log lines — full uuids make every line unreadable. */
export const getShortRequestId = (): string | undefined =>
  storage.getStore()?.requestId.slice(0, 8);

/**
 * Add a measured span to the in-flight request. A no-op outside a request —
 * a cron job hitting the same service code must not throw or leak into
 * whatever request happens to be running.
 */
export const recordSpan = (kind: "db" | "ext", ms: number): void => {
  const store = storage.getStore();
  if (!store) return;
  if (kind === "db") {
    store.spans.dbMs += ms;
    store.spans.dbCount += 1;
  } else {
    store.spans.extMs += ms;
    store.spans.extCount += 1;
  }
};

/**
 * Run `fn` inside a fresh request context. Exposed for non-HTTP entry points
 * (cron jobs, socket handlers, workers) that want the same correlation.
 */
export const runWithRequestContext = <T>(
  context: Partial<RequestContext> & { method: string; path: string },
  fn: () => T,
): T =>
  storage.run(
    {
      requestId: context.requestId || randomUUID(),
      method: context.method,
      path: context.path,
      startedAt: context.startedAt ?? process.hrtime.bigint(),
      spans: freshSpans(),
    },
    fn,
  );

/**
 * Mount this FIRST in the middleware chain — before cors, before anything that
 * can short-circuit — so even a rejected preflight or a rate-limited request
 * has an id to log against.
 */
export const requestContextMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const inbound = (req.headers["x-request-id"] as string | undefined)?.trim();

  const context: RequestContext = {
    // Cap the inbound value: it is attacker-controlled and ends up in log
    // lines and a response header.
    requestId: inbound?.slice(0, 64) || randomUUID(),
    method: req.method.toUpperCase(),
    path: req.path,
    startedAt: process.hrtime.bigint(),
    spans: freshSpans(),
  };

  res.setHeader("x-request-id", context.requestId);

  storage.run(context, () => next());
};
