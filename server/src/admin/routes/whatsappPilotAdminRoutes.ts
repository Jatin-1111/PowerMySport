import { Router } from "express";

import {
  addWhatsAppPilotNumbers,
  getWhatsAppPilot,
  removeWhatsAppPilotNumber,
  setWhatsAppPilotMode,
} from "../controllers/whatsappPilotAdminController";
import {
  exportWhatsAppEnquiries,
  getWhatsAppEnquiry,
  getWhatsAppEnquirySummary,
  listWhatsAppEnquiries,
  revealWhatsAppEnquiryContact,
  updateWhatsAppEnquiry,
} from "../controllers/whatsappEnquiryAdminController";
import { adminMiddleware, authMiddleware, requirePermission } from "../../middleware/auth";

const router = Router();

router.use(authMiddleware, adminMiddleware);

// Reuses the notifications permissions: this decides who gets WhatsApp messages
// from us, and a new permission would need a backfill for every existing admin.
router.get("/", requirePermission("notifications:view"), getWhatsAppPilot);
router.post("/numbers", requirePermission("notifications:manage"), addWhatsAppPilotNumbers);
router.delete("/numbers/:id", requirePermission("notifications:manage"), removeWhatsAppPilotNumber);
router.put("/mode", requirePermission("notifications:manage"), setWhatsAppPilotMode);

// What parents asked and how it ended. The fixed paths come before `/:id`.
router.get("/enquiries", requirePermission("notifications:view"), listWhatsAppEnquiries);
router.get(
  "/enquiries/summary",
  requirePermission("notifications:view"),
  getWhatsAppEnquirySummary
);
router.get(
  "/enquiries/export.csv",
  requirePermission("notifications:view"),
  exportWhatsAppEnquiries
);
router.get("/enquiries/:id", requirePermission("notifications:view"), getWhatsAppEnquiry);
router.patch("/enquiries/:id", requirePermission("notifications:manage"), updateWhatsAppEnquiry);
router.post(
  "/enquiries/:id/reveal-contact",
  requirePermission("notifications:manage"),
  revealWhatsAppEnquiryContact
);

export default router;
