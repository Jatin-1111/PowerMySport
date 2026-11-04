import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";
import {
  claimForUser,
  PROBLEM_MESSAGE,
  PROBLEM_STATUS,
  previewForToken,
  type ClaimItem,
} from "../../shared/services/whatsappHandoff";

/**
 * Moving what a parent told the WhatsApp assistant onto their profile.
 *
 * Thin on purpose: the token rules, the exactly-once import and the privacy limits live in
 * `whatsappHandoff`, where they can be read in one sitting and tested without HTTP.
 */

/** The link is a credential: never cached, and never passed on to another site. */
const private_ = (res: Response): void => {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
};

// GET /api/whatsapp-notes/preview?token=...   (public: the link is the proof)
export const previewWhatsAppNotes = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    private_(res);
    const token = typeof req.query.token === "string" ? req.query.token : "";
    const result = await previewForToken(token);
    if (!result.ok)
      throw new AppError(PROBLEM_MESSAGE[result.problem], PROBLEM_STATUS[result.problem]);
    res.json({ success: true, data: { children: result.children } });
  }
);

// POST /api/whatsapp-notes/claim
// Body: { token, parentalConsent?, children: [{ key, dob: "YYYY-MM-DD", gender?, relation?, ambition?, experienceLevel? }] }
export const claimWhatsAppNotes = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    private_(res);
    if (!req.user?.id) throw new AppError("Unauthorized", 401);
    const { token, parentalConsent, children } = req.body as {
      token: string;
      parentalConsent?: boolean;
      children: ClaimItem[];
    };
    const result = await claimForUser(req.user.id, token, children, parentalConsent === true);
    res.json({ success: true, data: result });
  }
);
