import cookieParser from "cookie-parser";
import cors, { CorsOptions } from "cors";
import "dotenv/config";
import express, { Express } from "express";
import { errorHandler } from "./middleware/errorHandler";
import { errorLogger, requestLogger } from "./middleware/logger";
import { observabilityMiddleware } from "./middleware/observability";
import {
  apiRateLimitMiddleware,
  securityHeadersMiddleware,
} from "./middleware/security";
import { initializeScheduledJobs } from "./utils/scheduledJobs";

import adminRoutes from "./routes/adminRoutes";
import authRoutes from "./routes/authRoutes";
import bookingRoutes from "./routes/bookingRoutes";
import coachRoutes from "./routes/coachRoutes";
import communityRoutes from "./routes/communityRoutes";
import friendRoutes from "./routes/friendRoutes";
import geoRoutes from "./routes/geoRoutes";
import notificationRoutes from "./routes/notificationRoutes";
import reminderRoutes from "./routes/reminderRoutes";
import sportsRoutes from "./routes/sportsRoutes";
import statsRoutes from "./routes/statsRoutes";
import supportTicketRoutes from "./routes/supportTicketRoutes";
import venueInquiryRoutes from "./routes/venueInquiryRoutes";
import venueOnboardingRoutes from "./routes/venueOnboardingRoutes";
import venueRoutes from "./routes/venueRoutes";
import reviewRoutes from "./routes/reviewRoutes";

export const app: Express = express();

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
  ],
  maxAge: 86400,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.use(observabilityMiddleware);
app.use(securityHeadersMiddleware);
app.use(apiRateLimitMiddleware);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

if (process.env.NODE_ENV === "development") {
  app.use(requestLogger);
}

app.use("/api/auth", authRoutes);
app.use("/api/venues", venueRoutes);
app.use("/api/venues/onboarding", venueOnboardingRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/coaches", coachRoutes);
app.use("/api/community", communityRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/reminders", reminderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/geo", geoRoutes);
app.use("/api/sports", sportsRoutes);
app.use("/api/venue-inquiries", venueInquiryRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/support-tickets", supportTicketRoutes);

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
  });
});

if (process.env.NODE_ENV === "development") {
  app.use(errorLogger);
}

app.use(errorHandler);

export default app;
