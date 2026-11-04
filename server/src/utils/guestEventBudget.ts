import { NextFunction, Request, Response } from "express";
import redis from "../config/redis";
import { log as __rootLog } from "./logger";
const log = __rootLog.child("guestEventBudget");

/**
 * A byte budget for the public guest-analytics ingest.
 *
 * The request rate limiter counts REQUESTS, but what fills a 512 MB cluster is
 * BYTES: 60 requests a minute of 50 events each is a lot of documents no matter
 * how few the requests are. So every accepted batch is charged by the size of
 * what will be stored, against two budgets:
 *   • per IP per hour, so one source cannot dominate;
 *   • one global budget per day, so a distributed flood still cannot refill the
 *     cluster faster than the retention TTL clears it.
 *
 * Real traffic is tiny. At the 2026-10-04 probe there were 19,782 guest events
 * in about four months, roughly 50 KB a day, so the defaults leave three orders
 * of magnitude of headroom. They are env knobs for when that changes.
 *
 * The counters live in Redis, but this does NOT fail open when Redis is down
 * (the request limiter next to it does, which would have left nothing guarding
 * the collection through a Redis outage). It falls back to a per-process counter
 * instead. That is weaker across several instances and resets on restart, but a
 * bounded fallback beats none.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const envBytes = (name: string, fallback: number): number => {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

export interface GuestEventBudgetLimits {
  perIpHourBytes: number;
  globalDayBytes: number;
}

const defaultLimits = (): GuestEventBudgetLimits => ({
  perIpHourBytes: envBytes("GUEST_EVENTS_IP_HOURLY_BYTES", 2 * 1024 * 1024),
  globalDayBytes: envBytes("GUEST_EVENTS_GLOBAL_DAILY_BYTES", 15 * 1024 * 1024),
});

let limits: GuestEventBudgetLimits = defaultLimits();

/** Test hook: override the limits. Pass nothing to restore the env defaults. */
export const configureGuestEventBudget = (override?: Partial<GuestEventBudgetLimits>): void => {
  limits = { ...defaultLimits(), ...(override ?? {}) };
};

// ── fallback counter, used only when Redis cannot be reached ─────────────────
const local = new Map<string, { used: number; expiresAt: number }>();

const consumeLocal = (key: string, cost: number, windowMs: number, now: number): number => {
  if (local.size > 5000) {
    for (const [k, v] of local) if (v.expiresAt <= now) local.delete(k);
  }
  const entry = local.get(key);
  if (!entry || entry.expiresAt <= now) {
    local.set(key, { used: cost, expiresAt: now + windowMs });
    return cost;
  }
  entry.used += cost;
  return entry.used;
};

/** Test hook: forget every counter. */
export const resetGuestEventBudget = (): void => {
  local.clear();
};

/** Adds `cost` to a counter and returns the new total for its window. */
const consume = async (
  key: string,
  cost: number,
  windowMs: number,
  now: number
): Promise<number> => {
  try {
    const results = await redis
      .multi()
      .incrby(`guest-budget:${key}`, cost)
      .pexpire(`guest-budget:${key}`, windowMs + 60_000)
      .exec();
    const total = Number(results?.[0]?.[1]);
    if (Number.isFinite(total)) return total;
    throw new Error("unexpected Redis reply");
  } catch {
    return consumeLocal(key, cost, windowMs, now);
  }
};

/**
 * Express middleware. Runs after body validation, so `req.body.events` is the
 * validated batch. Charges the batch's serialized size; over budget gets a 429
 * and nothing is stored.
 */
export const guestEventBudget = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const events = (req.body as { events?: unknown })?.events ?? [];
    const cost = Buffer.byteLength(JSON.stringify(events), "utf8");
    const now = Date.now();
    const hourBucket = Math.floor(now / HOUR_MS);
    const dayBucket = Math.floor(now / DAY_MS);

    const ip = req.ip || "unknown";
    const [ipUsed, globalUsed] = await Promise.all([
      consume(`ip:${ip}:${hourBucket}`, cost, HOUR_MS, now),
      consume(`global:${dayBucket}`, cost, DAY_MS, now),
    ]);

    if (ipUsed > limits.perIpHourBytes || globalUsed > limits.globalDayBytes) {
      const overGlobal = globalUsed > limits.globalDayBytes;
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil(
          ((overGlobal ? (dayBucket + 1) * DAY_MS : (hourBucket + 1) * HOUR_MS) - now) / 1000
        )
      );
      log.warn(
        overGlobal ? "guest event daily budget exhausted" : "guest event hourly budget exhausted",
        { ip: overGlobal ? undefined : ip }
      );
      res.setHeader("Retry-After", String(retryAfterSeconds));
      res.status(429).json({ success: false, message: "Too many events." });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};
