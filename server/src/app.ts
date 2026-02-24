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
import venueOnboardingRoutes from "./routes/venueOnboardingRoutes";
import venueRoutes from "./routes/venueRoutes";

export const app: Express = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
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
