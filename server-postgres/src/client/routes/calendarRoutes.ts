import { Router } from "express";
import {
  getCalendarBookings,
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from "../controllers/calendarController";
import { authMiddleware } from "../../middleware/auth";

const router = Router();

router.get("/bookings", authMiddleware, getCalendarBookings);
router.get("/events", authMiddleware, getCalendarEvents);
router.post("/events", authMiddleware, createCalendarEvent);
router.put("/events/:id", authMiddleware, updateCalendarEvent);
router.delete("/events/:id", authMiddleware, deleteCalendarEvent);

export default router;
