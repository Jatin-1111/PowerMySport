import { Request, Response, NextFunction } from "express";
import redis from "../config/redis";

/**
 * Middleware to cache HTTP responses in Redis.
 * Only caches 200 OK responses.
 *
 * @param ttlSeconds Time-to-live in Redis in seconds (default: 300)
 */
export const cacheResponse = (ttlSeconds: number = 300) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    // Construct a safe, unique cache key based on URL and query params
    const cacheKey = `cache:${req.originalUrl || req.url}`;

    try {
      // 1. Check if we have a cached response
      const cachedData = await redis.get(cacheKey);
      if (cachedData) {
        res.setHeader("X-Cache", "HIT");
        return res.status(200).json(JSON.parse(cachedData));
      }

      // 2. If not cached, override res.json to intercept the response payload
      res.setHeader("X-Cache", "MISS");
      const originalJson = res.json.bind(res);

      res.json = (body: any) => {
        // Only cache successful 2xx responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          redis.set(cacheKey, JSON.stringify(body), "EX", ttlSeconds).catch((err) => {
            console.error("Redis Cache Set Error:", err);
          });
        }
        return originalJson(body);
      };

      next();
    } catch (err) {
      console.error("Redis Cache Middleware Error:", err);
      // Fail open: if Redis is down, just skip cache and continue
      next();
    }
  };
};
