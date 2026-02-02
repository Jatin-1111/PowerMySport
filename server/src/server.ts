import "dotenv/config";
import express, { Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { connectDB } from "./config/database";
import { errorHandler } from "./middleware/errorHandler";

// Import routes
import authRoutes from "./routes/authRoutes";
import venueRoutes from "./routes/venueRoutes";
import bookingRoutes from "./routes/bookingRoutes";

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

// Connect to Database
connectDB().catch((error) => {
  console.error("Failed to connect to database:", error);
  process.exit(1);
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/venues", venueRoutes);
app.use("/api/bookings", bookingRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running",
  });
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`\n✅ Server is running on http://localhost:${PORT}`);
  console.log(`📝 API Documentation:`);
  console.log(`   - POST   /api/auth/register`);
  console.log(`   - POST   /api/auth/login`);
  console.log(`   - POST   /api/auth/logout`);
  console.log(`   - GET    /api/auth/profile`);
  console.log(`   - POST   /api/venues`);
  console.log(`   - GET    /api/venues/search`);
  console.log(`   - GET    /api/venues/my-venues`);
  console.log(`   - GET    /api/venues/:venueId`);
  console.log(`   - PUT    /api/venues/:venueId`);
  console.log(`   - DELETE /api/venues/:venueId`);
  console.log(`   - POST   /api/bookings`);
  console.log(`   - GET    /api/bookings/my-bookings`);
  console.log(`   - GET    /api/bookings/availability/:venueId`);
  console.log(`   - DELETE /api/bookings/:bookingId\n`);
});

export default app;
