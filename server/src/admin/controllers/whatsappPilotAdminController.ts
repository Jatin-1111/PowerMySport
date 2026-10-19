import { Request, Response } from "express";
import mongoose from "mongoose";

import { asyncHandler } from "../../middleware/asyncHandler";
import {
  MAX_ENTRIES_PER_REQUEST,
  addPilotNumbers,
  getPilotMode,
  listPilotNumbers,
  parsePilotInput,
  removePilotNumber,
  setPilotMode,
} from "../../shared/services/whatsappPilotNumbers";
import { AppError } from "../../utils/AppError";
import { recordAuditLog } from "../services/AuditLogService";

// The WhatsApp pilot allow-list, for the admin screen. Audit entries carry counts
// only: a phone number is personal data and does not belong in the log.

const audit = (
  req: Request,
  action: string,
  metadata?: Record<string, unknown>,
  targetId?: string
) => {
  if (!req.user?.id) return;
  void recordAuditLog({
    adminId: req.user.id,
    adminEmail: req.user.email || "",
    action,
    targetType: "WhatsAppPilot",
    ...(targetId ? { targetId } : {}),
    ...(metadata ? { metadata } : {}),
  });
};

// GET /api/admin/whatsapp-pilot
export const getWhatsAppPilot = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const [mode, numbers] = await Promise.all([getPilotMode(), listPilotNumbers()]);
    res.json({
      success: true,
      data: {
        mode,
        numbers,
        assistantOn: process.env.WHATSAPP_ASSISTANT === "on",
        envListCount: (process.env.WHATSAPP_ALLOWED_NUMBERS ?? "")
          .split(",")
          .filter((e) => e.trim()).length,
      },
    });
  }
);

// POST /api/admin/whatsapp-pilot/numbers   { text }
export const addWhatsAppPilotNumbers = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const text = req.body?.text;
    if (typeof text !== "string" || !text.trim()) {
      throw new AppError("Paste at least one phone number.", 400);
    }
    if (text.length > 100_000) throw new AppError("That is too much text to add at once.", 400);
    if (parsePilotInput(text).entries.length > MAX_ENTRIES_PER_REQUEST) {
      throw new AppError(`Add at most ${MAX_ENTRIES_PER_REQUEST} numbers at a time.`, 400);
    }

    const result = await addPilotNumbers(text, req.user?.id);
    audit(req, "whatsapp-pilot.add", {
      added: result.added,
      alreadyListed: result.alreadyListed,
      invalid: result.invalid.length,
    });
    res.json({ success: true, data: result });
  }
);

// DELETE /api/admin/whatsapp-pilot/numbers/:id
export const removeWhatsAppPilotNumber = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const id = String(req.params.id);
    if (!mongoose.isValidObjectId(id)) throw new AppError("That entry does not exist.", 404);
    if (!(await removePilotNumber(id))) throw new AppError("That entry does not exist.", 404);
    audit(req, "whatsapp-pilot.remove", undefined, id);
    res.json({ success: true });
  }
);

// PUT /api/admin/whatsapp-pilot/mode   { mode: "listed" | "everyone" }
export const setWhatsAppPilotMode = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const mode = req.body?.mode;
    if (mode !== "listed" && mode !== "everyone") {
      throw new AppError('Mode must be "listed" or "everyone".', 400);
    }
    await setPilotMode(mode, req.user?.id);
    audit(req, "whatsapp-pilot.mode", { mode });
    res.json({ success: true, data: { mode } });
  }
);
