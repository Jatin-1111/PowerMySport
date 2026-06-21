import cookieParser from "cookie-parser";
import cors, { CorsOptions } from "cors";
import "dotenv/config";
import express, { Express } from "express";
import { hostname as osHostname } from "os";
import mongoose from "mongoose";
import redis from "./config/redis";
import { authMiddleware, adminMiddleware } from "./middleware/auth";
import { errorHandler } from "./middleware/errorHandler";
import { errorLogger, requestLogger } from "./middleware/logger";
import { observabilityMiddleware } from "./middleware/observability";
import {
  apiRateLimitMiddleware,
  securityHeadersMiddleware,
} from "./middleware/security";
import { initializeScheduledJobs } from "./utils/scheduledJobs";

import academyOnboardingRoutes from "./admin/routes/academyOnboardingRoutes";
import adminRoutes from "./admin/routes/adminRoutes";
import payoutMethodsRoutes from "./admin/routes/payoutMethodsRoutes";
import statsRoutes from "./admin/routes/statsRoutes";
import bookingRoutes from "./client/routes/bookingRoutes";
import coachRoutes from "./client/routes/coachRoutes";
import friendRoutes from "./client/routes/friendRoutes";
import guidanceRoutes from "./client/routes/guidanceRoutes";
import pathwayProfileRoutes from "./client/routes/pathwayProfileRoutes";
import notificationRoutes from "./client/routes/notificationRoutes";
import payoutRoutes from "./client/routes/payoutRoutes";
import refundMethodRoutes from "./client/routes/refundMethodRoutes";
import reminderRoutes from "./client/routes/reminderRoutes";
import reviewRoutes from "./client/routes/reviewRoutes";
import supportTicketRoutes from "./client/routes/supportTicketRoutes";
import venueInquiryRoutes from "./client/routes/venueInquiryRoutes";
import venueOnboardingRoutes from "./client/routes/venueOnboardingRoutes";
import venueRoutes from "./client/routes/venueRoutes";
import walletRoutes from "./client/routes/walletRoutes";
import communityRoutes from "./community/routes/communityRoutes";
import authRoutes from "./shared/routes/authRoutes";
import geoRoutes from "./shared/routes/geoRoutes";
import phonepeWebhook from "./shared/routes/phonepeWebhook";
import sportsRoutes from "./shared/routes/sportsRoutes";
import pathwayRoutes from "./shared/routes/pathwayRoutes";
import conciergeRoutes from "./shared/routes/conciergeRoutes";
import ecommerceRoutes from "./shop/routes/ecommerceRoutes";

export const app: Express = express();

/**
 * Trust the first proxy hop (the ALB) so that req.ip returns the real
 * client IP from the X-Forwarded-For header instead of the ALB's internal
 * IP. Without this, the Redis-backed rate limiter would see all traffic
 * as coming from a single IP and block legitimate users.
 */
app.set("trust proxy", 1);

// Initialize scheduled cleanup jobs
initializeScheduledJobs();

const normalizeOrigin = (origin: string): string =>
  origin.trim().replace(/\/$/, "").toLowerCase();

const configuredOrigins = [
  process.env.FRONTEND_URLS,
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "https://powermysport.com",
  "https://www.powermysport.com",
  "https://admin.powermysport.com",
  "https://community.powermysport.com",
]
  .filter(Boolean)
  .flatMap((value) => (value as string).split(","))
  .map((origin) => normalizeOrigin(origin))
  .filter(Boolean);

const allowedOrigins = new Set(configuredOrigins);
const allowedOriginPatterns = [
  /^https:\/\/([a-z0-9-]+\.)*powermysport\.com$/i,
  /^http:\/\/localhost:\d+$/i,
];

const isOriginAllowed = (origin: string): boolean => {
  const normalizedOrigin = normalizeOrigin(origin);

  if (allowedOrigins.has(normalizedOrigin)) {
    return true;
  }

  return allowedOriginPatterns.some((pattern) =>
    pattern.test(normalizedOrigin),
  );
};

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || isOriginAllowed(origin)) {
      callback(null, true);
      return;
    }

    if (process.env.NODE_ENV === "development") {
      console.warn(`CORS blocked for origin: ${origin}`);
    }

    callback(null, false);
  },
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "Idempotency-Key",
  ],
  maxAge: 86400,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.use(observabilityMiddleware);
app.use(securityHeadersMiddleware);
app.use(apiRateLimitMiddleware);
app.use("/api/payments/phonepe", express.raw({ type: "application/json" }));
app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = buf.toString();
    },
  }),
);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (process.env.NODE_ENV === "development") {
  app.use(requestLogger);
}

// Shared Domain
app.use("/api/auth", authRoutes);
app.use("/api/geo", geoRoutes);
app.use("/api/sports", sportsRoutes);
app.use("/api/pathways", pathwayRoutes);
app.use("/api/concierge", conciergeRoutes);
// PhonePe webhook route (use raw body captured above for HMAC verification)
app.use("/api/payments/phonepe", phonepeWebhook);

// Client Domain
app.use("/api/venues", venueRoutes);
app.use("/api/venues/onboarding", venueOnboardingRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/coaches", coachRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reminders", reminderRoutes);
app.use("/api/venue-inquiries", venueInquiryRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/support-tickets", supportTicketRoutes);
app.use("/api/refund-methods", refundMethodRoutes);
app.use("/api/payouts", payoutRoutes);
app.use("/api/guidance", guidanceRoutes);
app.use("/api/pathway-profile", pathwayProfileRoutes);
app.use("/api/wallet", walletRoutes);
// Community Domain
app.use("/api/community", communityRoutes);

// Admin Domain
app.use("/api/admin", adminRoutes);
app.use("/api/academies", academyOnboardingRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/payout-methods", payoutMethodsRoutes);

// Shop Domain
app.use("/api/v1", ecommerceRoutes);

const getDetailedHealthPayload = async () => {
  const dbReadyState = mongoose.connection.readyState;
  const dbStateMap: Record<number, string> = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };
  const dbStatus = dbStateMap[dbReadyState] ?? "unknown";

  // Live Redis ping with a 500ms timeout so a busy Redis under load
  // never blocks the ALB health check and causes a false-positive Severe state.
  let redisStatus = "disconnected";
  let redisPingMs: number | null = null;
  try {
    const t0 = Date.now();
    await Promise.race([
      redis.ping(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("ping timeout")), 500),
      ),
    ]);
    redisPingMs = Date.now() - t0;
    redisStatus = "connected";
  } catch (err: any) {
    redisStatus = err?.message === "ping timeout" ? "timeout" : "error";
  }

  const memoryUsage = process.memoryUsage();
  const uptimeSec = Math.round(process.uptime());
  const dbHealthy = dbStatus === "connected";
  const redisHealthy = redisStatus === "connected";
  const allHealthy = dbHealthy && redisHealthy;

  return {
    success: allHealthy,
    status: allHealthy ? "healthy" : "degraded",
    message: allHealthy
      ? "All systems operational"
      : `Degraded: ${[!dbHealthy && "database", !redisHealthy && "redis"].filter(Boolean).join(", ")}`,
    timestamp: new Date().toISOString(),
    uptime: `${uptimeSec}s`,
    environment: process.env.NODE_ENV || "development",
    services: {
      database: {
        status: dbStatus,
        provider: "MongoDB Atlas",
      },
      redis: {
        status: redisStatus,
        pingMs: redisPingMs,
        provider: "AWS ElastiCache",
      },
      rateLimiter: {
        backend: "redis",
        sharedAcrossInstances: true,
      },
    },
    system: {
      memory: {
        rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
        external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`,
      },
      nodeVersion: process.version,
      platform: process.platform,
      pid: process.pid,
      hostname: osHostname(),
    },
  };
};

app.get("/api/health", async (_req, res) => {
  const detailed = await getDetailedHealthPayload();

  /**
   * IMPORTANT: Always return HTTP 200.
   *
   * If we return 503, the ALB marks the instance as unhealthy → EB goes
   * Severe. A transient Redis ping timeout under load is NOT a reason to
   * pull the instance out of rotation. Service degradation is surfaced in
   * the JSON body (status / services fields) for monitoring dashboards
   * and alerting tools.
   */
  res.status(200).json({
    success: detailed.success,
    status: detailed.status,
    timestamp: detailed.timestamp,
  });
});

app.get(
  "/api/admin/health/detail",
  authMiddleware,
  adminMiddleware,
  async (_req, res) => {
    const detailed = await getDetailedHealthPayload();
    res.status(200).json(detailed);
  },
);

if (process.env.NODE_ENV === "development") {
  app.use(errorLogger);
}

app.use(errorHandler);

export default app;
