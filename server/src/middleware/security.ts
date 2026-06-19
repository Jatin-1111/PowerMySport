import { NextFunction, Request, Response } from "express";
import redis from "../config/redis";

const ONE_MINUTE_MS = 60 * 1000;

export const securityHeadersMiddleware = (
  _req: Request,
  res: Response,
  next: NextFunction,
): void => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https://*.amazonaws.com https://*.powermysport.com",
      "connect-src 'self' https://api.phonepe.com https://*.amazonaws.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );
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
  const windowSec = Math.ceil(
    parseInt(
      process.env.API_RATE_LIMIT_WINDOW_MS || String(ONE_MINUTE_MS),
      10,
    ) / 1000,
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
      res.setHeader(
        "X-RateLimit-Remaining",
        String(Math.max(0, maxRequestsPerWindow - count)),
      );

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
