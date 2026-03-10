import { NextFunction, Request, Response } from "express";

type RateLimitStoreEntry = {
  count: number;
  resetAt: number;
};

const ONE_MINUTE_MS = 60 * 1000;
const MAX_RATE_LIMIT_ENTRIES = parseInt(
  process.env.API_RATE_LIMIT_MAX_ENTRIES || "50000",
  10,
);

const defaultRateLimitStore = new Map<string, RateLimitStoreEntry>();

const pruneRateLimitStore = (now: number) => {
  for (const [key, value] of defaultRateLimitStore.entries()) {
    if (value.resetAt <= now) {
      defaultRateLimitStore.delete(key);
    }
  }

  if (defaultRateLimitStore.size <= MAX_RATE_LIMIT_ENTRIES) {
    return;
  }

  // Map iteration order is insertion order; evict oldest entries to stay bounded.
  const overflowCount = defaultRateLimitStore.size - MAX_RATE_LIMIT_ENTRIES;
  let deleted = 0;
  for (const key of defaultRateLimitStore.keys()) {
    defaultRateLimitStore.delete(key);
    deleted += 1;
    if (deleted >= overflowCount) {
      break;
    }
  }
};

setInterval(() => {
  pruneRateLimitStore(Date.now());
}, ONE_MINUTE_MS).unref();

export const securityHeadersMiddleware = (
  _req: Request,
  res: Response,
  next: NextFunction,
): void => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");

  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }

  next();
};

export const apiRateLimitMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (req.path === "/api/health") {
    next();
    return;
  }

  const maxRequestsPerWindow = parseInt(
    process.env.API_RATE_LIMIT_MAX_REQUESTS || "120",
    10,
  );
  const windowMs = parseInt(
    process.env.API_RATE_LIMIT_WINDOW_MS || String(ONE_MINUTE_MS),
    10,
  );

  const ip = req.ip || "unknown";
  const now = Date.now();
  const key = `${ip}:${Math.floor(now / windowMs)}`;

  const existing = defaultRateLimitStore.get(key);

  if (!existing) {
    pruneRateLimitStore(now);
    defaultRateLimitStore.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    next();
    return;
  }

  existing.count += 1;

  if (existing.count > maxRequestsPerWindow) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.resetAt - now) / 1000),
    );
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(429).json({
      success: false,
      message: "Too many requests. Please try again shortly.",
    });
    return;
  }

  next();
};
