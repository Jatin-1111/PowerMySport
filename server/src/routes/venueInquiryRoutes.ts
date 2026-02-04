import { Router } from "express";
import {
  submitInquiry,
  getInquiries,
  getInquiry,
  reviewInquiryRequest,
  removeInquiry,
} from "../controllers/venueInquiryController";
import { authMiddleware, adminMiddleware } from "../middleware/auth";

const router = Router();

// Public route - submit inquiry
router.post("/submit", submitInquiry);

// Admin routes - manage inquiries
router.get("/", authMiddleware, adminMiddleware, getInquiries);
router.get("/:id", authMiddleware, adminMiddleware, getInquiry);
router.put(
  "/:id/review",
  authMiddleware,
  adminMiddleware,
  reviewInquiryRequest,
);
router.delete("/:id", authMiddleware, adminMiddleware, removeInquiry);

export default router;
