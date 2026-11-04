import { Router } from "express";
import {
  createSupportTicket,
  createPublicSupportTicket,
  getMySupportTickets,
  getSupportTicketsForAdmin,
  updateSupportTicketByAdmin,
} from "../controllers/supportTicketController";
import { publicSupportTicketRateLimiter } from "../../middleware/rateLimit";
import { adminMiddleware, authMiddleware, requirePermission } from "../../middleware/auth";

const router = Router();

router.post("/public", publicSupportTicketRateLimiter, createPublicSupportTicket);
router.post("/", authMiddleware, createSupportTicket);
router.get("/my", authMiddleware, getMySupportTickets);

router.get(
  "/admin",
  authMiddleware,
  adminMiddleware,
  requirePermission("inquiries:view"),
  getSupportTicketsForAdmin
);
router.patch(
  "/admin/:ticketId",
  authMiddleware,
  adminMiddleware,
  requirePermission("inquiries:manage"),
  updateSupportTicketByAdmin
);

export default router;
