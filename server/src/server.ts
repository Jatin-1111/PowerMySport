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
import bookingRoutes from "./routes/bookingRoutes";
import coachRoutes from "./routes/coachRoutes";
import venueInquiryRoutes from "./routes/venueInquiryRoutes";
import adminRoutes from "./routes/adminRoutes";
import statsRoutes from "./routes/statsRoutes";

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

// Connect to Database
connectDB().catch((error) => {
  console.error("Failed to connect to database:", error);
  process.exit(1);
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/venues", venueRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/coaches", coachRoutes);
app.use("/api/venue-inquiries", venueInquiryRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/stats", statsRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
  });
});

// Error logging middleware (before error handler in development)
if (process.env.NODE_ENV === "development") {
  app.use(errorLogger);
}

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`\n✅ Server is running on http://localhost:${PORT}`);
  console.log(`📝 API Documentation:`);
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
  console.log(`   - GET    /api/bookings/verify/:token (NEW: QR verification)`);
  console.log(`   - GET    /api/bookings/my-bookings`);
  console.log(`   - GET    /api/bookings/availability/:venueId`);
  console.log(`   - DELETE /api/bookings/:bookingId\n`);

  // Start booking expiration job
  startExpirationJob();
  console.log(`⏰ Booking expiration job started\n`);
});

export default app;
