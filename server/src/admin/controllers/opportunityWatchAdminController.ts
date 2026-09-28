import { Request, Response } from "express";
import mongoose from "mongoose";

import { SourceWatch } from "../../shared/models/SourceWatch";
import {
  acknowledgeWatchUrls,
  isWatchRunning,
  listWatches,
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
