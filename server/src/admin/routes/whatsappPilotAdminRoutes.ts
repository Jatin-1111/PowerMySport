import { Router } from "express";

import {
  addWhatsAppPilotNumbers,
  getWhatsAppPilot,
  removeWhatsAppPilotNumber,
  setWhatsAppPilotMode,
} from "../controllers/whatsappPilotAdminController";
import { adminMiddleware, authMiddleware, requirePermission } from "../../middleware/auth";

const router = Router();

router.use(authMiddleware, adminMiddleware);

// Reuses the notifications permissions: this decides who gets WhatsApp messages
// from us, and a new permission would need a backfill for every existing admin.
router.get("/", requirePermission("notifications:view"), getWhatsAppPilot);
router.post("/numbers", requirePermission("notifications:manage"), addWhatsAppPilotNumbers);
router.delete("/numbers/:id", requirePermission("notifications:manage"), removeWhatsAppPilotNumber);
router.put("/mode", requirePermission("notifications:manage"), setWhatsAppPilotMode);

export default router;
