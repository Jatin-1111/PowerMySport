import cookieParser from "cookie-parser";
import cors from "cors";
import "dotenv/config";
import express, { Express } from "express";
import { errorHandler } from "./middleware/errorHandler";
import { errorLogger, requestLogger } from "./middleware/logger";

import adminRoutes from "./routes/adminRoutes";
import authRoutes from "./routes/authRoutes";
import bookingRoutes from "./routes/bookingRoutes";
import coachRoutes from "./routes/coachRoutes";
import geoRoutes from "./routes/geoRoutes";
import sportsRoutes from "./routes/sportsRoutes";
import statsRoutes from "./routes/statsRoutes";
import venueInquiryRoutes from "./routes/venueInquiryRoutes";
import venueOnboardingRoutes from "./routes/venueOnboardingRoutes";
import venueRoutes from "./routes/venueRoutes";

export const app: Express = express();

const configuredOrigins = [
  process.env.FRONTEND_URLS,
  process.env.FRONTEND_URL,
  "http://localhost:3000",
  "http://localhost:3001",
]
  .filter(Boolean)
  .flatMap((value) => (value as string).split(","))
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set(configuredOrigins);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  }),
);
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
app.use("/api/admin", adminRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/geo", geoRoutes);
app.use("/api/sports", sportsRoutes);
app.use("/api/venue-inquiries", venueInquiryRoutes);

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
