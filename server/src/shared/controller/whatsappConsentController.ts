import { Request, Response } from "express";

import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";
import { getWhatsAppConsent, setWhatsAppConsent } from "../services/whatsappConsent";

// GET /api/auth/whatsapp-consent
export const getWhatsAppConsentHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) throw new AppError("Unauthorized", 401);
    res.json({ success: true, data: await getWhatsAppConsent(req.user.id) });
  }
);

// PUT /api/auth/whatsapp-consent   { granted: boolean, source?: "settings" | "booking" }
export const setWhatsAppConsentHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) throw new AppError("Unauthorized", 401);
    const { granted, source } = req.body ?? {};
    if (typeof granted !== "boolean") throw new AppError("granted must be true or false.", 400);
    // "signup" is only ever set while registering; here it is the settings page or a booking form.
    const where = source === "booking" ? "booking" : "settings";
    res.json({ success: true, data: await setWhatsAppConsent(req.user.id, granted, where) });
  }
);
