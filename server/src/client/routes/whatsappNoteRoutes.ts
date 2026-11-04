import { Router } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { claimWhatsAppNotes, previewWhatsAppNotes } from "../controllers/whatsappNoteController";
import { authMiddleware } from "../../middleware/auth";
import { createRedisRateLimitStore, dependentsWriteRateLimiter } from "../../middleware/rateLimit";
import { claimWhatsAppNotesSchema } from "../../middleware/schemas";
import { validateRequest } from "../../middleware/validation";

const whatsAppNoteRouter = Router();

/**
 * The preview is public because the link is the proof, so it is limited per address. The token
 * is signed, so a wrong guess costs one HMAC and reveals nothing; this only stops one source
 * from hammering it. Fails open when Redis is down.
 */
const previewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.ip ? ipKeyGenerator(req.ip) : "anon"),
  store: createRedisRateLimitStore("rl:whatsapp-note-preview:"),
  message: { success: false, message: "Too many tries. Please wait a few minutes." },
});

whatsAppNoteRouter.get("/preview", previewLimiter, previewWhatsAppNotes);
// Adding a child is always to the signed-in parent's own account, with the same write limit
// as every other route that creates a child profile.
whatsAppNoteRouter.post(
  "/claim",
  authMiddleware,
  dependentsWriteRateLimiter,
  validateRequest(claimWhatsAppNotesSchema),
  claimWhatsAppNotes
);

export default whatsAppNoteRouter;
