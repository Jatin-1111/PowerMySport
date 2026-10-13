import { Request, Response } from "express";
import mongoose from "mongoose";

import { SourceWatch } from "../../shared/models/SourceWatch";
import {
  acknowledgeWatchUrls,
  isWatchRunning,
  listWatches,
  recordManualCheck,
  runOpportunityWatch,
} from "../services/opportunityWatch";
import { recordAuditLog } from "../services/AuditLogService";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";
import { log as __rootLog } from "../../utils/logger";

const log = __rootLog.child("opportunity-watch");

// ─── The weekly source watch, for the admin screen ──────────────────────────

// GET /api/admin/opportunity-watch
export const listOpportunityWatches = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    res.json({ success: true, data: { watches: await listWatches(), running: isWatchRunning() } });
  }
);

// POST /api/admin/opportunity-watch/run
// Starts a check now and answers at once: a full run pauses between requests
// and can take a few minutes, longer than a request should be held open.
export const runOpportunityWatchNow = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (isWatchRunning()) throw new AppError("A source check is already running.", 409);
    void runOpportunityWatch().catch((error) => log.error("Manual source check failed:", error));
    if (req.user?.id) {
      void recordAuditLog({
        adminId: req.user.id,
        adminEmail: req.user.email || "",
        action: "opportunity-watch.run",
        targetType: "SourceWatch",
        targetId: "all",
      });
    }
    res.status(202).json({
      success: true,
      message: "Checking every source now. Results appear here in a few minutes.",
    });
  }
);

// POST /api/admin/opportunity-watch/:id/manual-check  { note? }
// "I opened this myself": for a source our server cannot read, the only honest
// check there is. Quiets it and starts the clock to the next one. The source
// keeps only the latest check, so each is also written to the audit log.
export const manualCheckOpportunityWatch = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    if (!id || typeof id !== "string" || !mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid id.", 400);
    }
    const note = typeof req.body?.note === "string" ? req.body.note : undefined;
    if (note && note.trim().length > 300) {
      throw new AppError("Keep the note under 300 characters.", 400);
    }
    const watch = await recordManualCheck(id, req.user?.id, note);
    if (!watch) {
      // Distinguish "no such source" from "this one can be read": a hand check on
      // a readable source would hide a change it has not got round to showing.
      if (await SourceWatch.exists({ _id: id })) {
        throw new AppError(
          "Our server can read this source, so changes to it are flagged automatically. Use Dismiss once you have looked.",
          400
        );
      }
      throw new AppError("Not found.", 404);
    }
    if (req.user?.id) {
      void recordAuditLog({
        adminId: req.user.id,
        adminEmail: req.user.email || "",
        action: "opportunity-watch.manual-check",
        targetType: "SourceWatch",
        targetId: id,
        metadata: { url: watch.url, ...(note?.trim() ? { note: note.trim() } : {}) },
      });
    }
    res.json({
      success: true,
      message: "Recorded. It comes due again in 30 days.",
      data: { lastManualCheckAt: watch.lastManualCheckAt },
    });
  }
);

// POST /api/admin/opportunity-watch/:id/dismiss
// "I've looked at this": quiet it until it changes again.
export const dismissOpportunityWatch = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    if (!id || typeof id !== "string" || !mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid id.", 400);
    }
    const watch = await SourceWatch.findById(id).select("url").lean();
    if (!watch) throw new AppError("Not found.", 404);
    await acknowledgeWatchUrls([watch.url]);
    if (req.user?.id) {
      void recordAuditLog({
        adminId: req.user.id,
        adminEmail: req.user.email || "",
        action: "opportunity-watch.dismiss",
        targetType: "SourceWatch",
        targetId: id,
        metadata: { url: watch.url },
      });
    }
    res.json({ success: true, message: "Dismissed until it changes again." });
  }
);
