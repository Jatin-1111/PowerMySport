import { Router } from "express";
import {
  createSupportTicket,
  getMySupportTickets,
  getSupportTicketsForAdmin,
  updateSupportTicketByAdmin,
} from "../controllers/supportTicketController";
import {
  adminMiddleware,
  authMiddleware,
  requirePermission,
} from "../middleware/auth";

const router = Router();

router.post("/", authMiddleware, createSupportTicket);
router.get("/my", authMiddleware, getMySupportTickets);

router.get(
  "/admin",
  authMiddleware,
  adminMiddleware,
  requirePermission("inquiries:view"),
  getSupportTicketsForAdmin,
);
router.patch(
  "/admin/:ticketId",
  authMiddleware,
  adminMiddleware,
  requirePermission("inquiries:manage"),
  updateSupportTicketByAdmin,
);

export default router;
