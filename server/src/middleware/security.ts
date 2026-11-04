import { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import redis from "../config/redis";

const ONE_MINUTE_MS = 60 * 1000;

/**
 * Same header set the hand-rolled middleware set, now sourced from helmet —
 * plus whatever else helmet enables by default (X-DNS-Prefetch-Control,
 * X-Download-Options, X-Permitted-Cross-Domain-Policies, Origin-Agent-Cluster,
 * Cross-Origin-Opener-Policy, X-Powered-By removal), all of which only add
 * restrictions, never loosen the previous policy.
 *
 * Three things helmet does not cover, kept as before:
 *  - Permissions-Policy has no helmet default (the spec never stabilised
 *    enough for one) — set manually below.
 *  - X-Robots-Tag is product-specific, not a general security header — see
 *    the comment below.
 *  - Strict-Transport-Security must stay off outside production — helmet
 *    would otherwise send it unconditionally.
 */
export const securityHeadersMiddleware = helmet({
  contentSecurityPolicy: {
    // Without this, helmet merges its own defaults (a looser font-src,
    // object-src, script-src-attr, upgrade-insecure-requests) on top of the
    // directives below rather than being fully replaced by them.
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://*.amazonaws.com", "https://*.powermysport.com"],
      connectSrc: ["'self'", "https://api.phonepe.com", "https://*.amazonaws.com"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
  frameguard: { action: "deny" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  crossOriginResourcePolicy: { policy: "same-site" },
  // Sent conditionally below instead — see productionOnlyHstsMiddleware.
  hsts: false,
});

/** helmet's `hsts` option has no "only in production" mode, so this replaces
 *  it separately — dev/staging traffic is often plain HTTP, where forcing
 *  HTTPS via HSTS would be actively wrong. */
export const productionOnlyHstsMiddleware = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  next();
};

export const permissionsPolicyMiddleware = (
  _req: Request,
  res: Response,
  next: NextFunction
): void => {
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
};

/**
 * api.powermysport.com falls inside the powermysport.com *domain* property in
 * Search Console, so Googlebot crawls it and reports what it finds. Nothing
 * the API serves should ever be a search result. We send `noindex` rather
 * than blocking the host in robots.txt: a blocked URL still gets reported
 * (as "Blocked by robots.txt") and can linger in the index URL-only, whereas
 * a crawlable `noindex` gets it dropped permanently and silently.
 */
export const robotsTagMiddleware = (_req: Request, res: Response, next: NextFunction): void => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  next();
};

/**
 * Redis-backed rate limiter — shared across all auto-scaled instances.
 *
 * Uses atomic INCR + EXPIRE so there are no race conditions.
 * Falls back to allowing the request if Redis is unavailable,
 * so a Redis hiccup never takes down the API.
 *
 * Fix: replaced the local in-memory Map (defaultRateLimitStore) that caused
 * "amnesia scaling" — each EB instance had its own counter, so the ALB
 * routing a user to a different instance would reset their rate-limit window.
 */
export const apiRateLimitMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  if (req.path === "/api/health") {
    next();
    return;
  }

  // Temporarily disable the rate limiter if explicitly set to "false"
  if (process.env.ENABLE_RATE_LIMIT === "false") {
    next();
    return;
  }

  const maxRequestsPerWindow = parseInt(process.env.API_RATE_LIMIT_MAX_REQUESTS || "120", 10);
  const windowSec = Math.ceil(
    parseInt(process.env.API_RATE_LIMIT_WINDOW_MS || String(ONE_MINUTE_MS), 10) / 1000
  );

  // req.ip is now the real user IP because app.set("trust proxy", 1) is set in app.ts
  const ip = req.ip || "unknown";
  const key = `rl:${ip}`;

  redis
    .incr(key)
    .then((count) => {
      // Set the TTL only on the first request in this window
      if (count === 1) {
        redis.expire(key, windowSec).catch(() => {});
      }

      res.setHeader("X-RateLimit-Limit", String(maxRequestsPerWindow));
      res.setHeader("X-RateLimit-Remaining", String(Math.max(0, maxRequestsPerWindow - count)));

      if (count > maxRequestsPerWindow) {
        res.setHeader("Retry-After", String(windowSec));
        res.status(429).json({
          success: false,
          message: "Too many requests. Please try again shortly.",
        });
        return;
      }

      next();
    })
    .catch(() => {
      // Redis unavailable — fail open so the API stays alive
      next();
    });
};
