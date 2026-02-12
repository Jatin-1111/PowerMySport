import "dotenv/config";
import express, { Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { connectDB } from "./config/database";
import { errorHandler } from "./middleware/errorHandler";
import { requestLogger, errorLogger } from "./middleware/logger";
import { startExpirationJob } from "./utils/timer";

// Import routes
import authRoutes from "./routes/authRoutes";
import venueRoutes from "./routes/venueRoutes";
import venueOnboardingRoutes from "./routes/venueOnboardingRoutes";
import bookingRoutes from "./routes/bookingRoutes";
import coachRoutes from "./routes/coachRoutes";
import adminRoutes from "./routes/adminRoutes";
import statsRoutes from "./routes/statsRoutes";
import geoRoutes from "./routes/geoRoutes";

const app: Express = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Development logging middleware
if (process.env.NODE_ENV === "development") {
  app.use(requestLogger);
}

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/venues", venueRoutes);
app.use("/api/venues/onboarding", venueOnboardingRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/coaches", coachRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/geo", geoRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
  });
});

// Error logging middleware (for development)
if (process.env.NODE_ENV === "development") {
  app.use(errorLogger);
}

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server function
const startServer = async () => {
  try {
    // Connect to Database
    await connectDB();

    const server = app.listen(PORT, () => {
      console.log(`\n✅ Server is running on http://localhost:${PORT}`);
      console.log(`📝 API Documentation:`);
      // ... (keep existing logs if desired, or shorten them) ...
      console.log(`   AUTH:`);
      console.log(`   - POST   /api/auth/register`);
      console.log(`   - POST   /api/auth/login`);
      console.log(`   - POST   /api/auth/logout`);
      console.log(`   - GET    /api/auth/profile`);
      console.log(`   VENUES:`);
      console.log(`   - POST   /api/venues`);
      console.log(`   - GET    /api/venues/discover (NEW: venues + coaches)`);
      console.log(`   - GET    /api/venues/search`);
      console.log(`   - GET    /api/venues/my-venues`);
      console.log(`   - GET    /api/venues/:venueId`);
      console.log(`   - PUT    /api/venues/:venueId`);
      console.log(`   - DELETE /api/venues/:venueId`);
      console.log(`   VENUE ONBOARDING (NEW: 3-Step Process):`);
      console.log(`   - POST   /api/venues/onboarding/step1 (Create venue)`);
      console.log(
        `   - POST   /api/venues/onboarding/step2/upload-urls (Get image upload URLs)`,
      );
      console.log(
        `   - POST   /api/venues/onboarding/step2/confirm (Confirm images)`,
      );
      console.log(
        `   - POST   /api/venues/onboarding/step3/upload-urls (Get document upload URLs)`,
      );
      console.log(
        `   - POST   /api/venues/onboarding/step3/finalize (Finalize onboarding)`,
      );
      console.log(
        `   - DELETE /api/venues/onboarding/:venueId (Cancel onboarding)`,
      );
      console.log(`   ADMIN VENUE MANAGEMENT (NEW):`);
      console.log(
        `   - GET    /api/venues/onboarding/admin/pending (List pending venues)`,
      );
      console.log(
        `   - GET    /api/venues/onboarding/admin/:venueId (Get venue details)`,
      );
      console.log(
        `   - POST   /api/venues/onboarding/admin/:venueId/approve (Approve venue)`,
      );
      console.log(
        `   - POST   /api/venues/onboarding/admin/:venueId/reject (Reject venue)`,
      );
      console.log(
        `   - POST   /api/venues/onboarding/admin/:venueId/mark-review (Mark for review)`,
      );
      console.log(`   COACHES:`);
      console.log(`   - POST   /api/coaches`);
      console.log(`   - GET    /api/coaches/my-profile`);
      console.log(`   - GET    /api/coaches/:coachId`);
      console.log(`   - PUT    /api/coaches/:coachId`);
      console.log(`   - DELETE /api/coaches/:coachId`);
      console.log(`   - GET    /api/coaches/availability/:coachId`);
      console.log(`   BOOKINGS:`);
      console.log(`   - POST   /api/bookings/initiate (NEW: split payments)`);
      console.log(`   - POST   /api/bookings/mock-payment (NEW: testing)`);
      console.log(`   - POST   /api/bookings/webhook (NEW: payment webhook)`);
      console.log(
        `   - GET    /api/bookings/verify/:token (NEW: QR verification)`,
      );
      console.log(`   - GET    /api/bookings/my-bookings`);
      console.log(`   - GET    /api/bookings/availability/:venueId`);
      console.log(`   - DELETE /api/bookings/:bookingId\n`);
      console.log(`   GEO:`);
      console.log(`   - GET    /api/geo/autocomplete?q=...`);
      console.log(`   - GET    /api/geo/geocode?address=...`);
      console.log(`   - GET    /api/geo/reverse?lat=...&lon=...`);

      // Start booking expiration job
      startExpirationJob();
      console.log(`⏰ Booking expiration job started\n`);
    });

    // Graceful shutdown
    const shutdown = async () => {
      console.log("\n🛑 Shutting down server...");
      server.close(async () => {
        console.log("🛑 HTTP server closed");
        // process.exit(0); // database.ts handles mongo connection close on SIGINT, but we can double check or trigger it here if needed.
        // Since database.ts has process.on('SIGINT'), it might catch it first or parallel.
        // Ideally we coordinate. For now, we'll let existing listeners handle their parts.
      });
    };

    process.on("SIGTERM", shutdown);
    // SIGINT is already handled in database.ts which calls process.exit,
    // so we might not need to duplicate it here unless we want to close server first within that handler.
    // But since server.close takes a callback, asynchronous coordination is tricky with multiple listeners.
    // For this step, I'll just keep the server variable assignment so we *could* close it.
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
};

// Start the server
startServer();

export default app;
