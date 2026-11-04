import { Request, Response } from "express";
import mongoose from "mongoose";

import { OpportunityLead } from "../../shared/models/OpportunityLead";
import { isDiscoveryRunning, runOpportunityDiscovery } from "../services/opportunityDiscovery";
import { isTriageRunning, runLeadTriage } from "../services/opportunityLeadTriage";
import { draftFromLead } from "../services/opportunityLeadDraft";
import { recordAuditLog } from "../services/AuditLogService";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";
import { log as __rootLog } from "../../utils/logger";

const log = __rootLog.child("opportunity-discovery");

// ─── Leads from AI web search, for the admin screen ─────────────────────────
// A lead is read through the normal source review (createOpportunitySource
// with `leadId`), which is also what marks it read.

// GET /api/admin/opportunity-leads?status=new
export const listOpportunityLeads = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const status = typeof req.query.status === "string" ? req.query.status : "new";
    if (!["new", "read", "dismissed"].includes(status)) throw new AppError("Unknown status.", 400);
    // `autoDismissed=true` lists only what triage dismissed, so it can be reviewed.
    const autoOnly = status === "dismissed" && req.query.autoDismissed === "true";
    const leads = await OpportunityLead.find({
      status,
      ...(autoOnly ? { autoDismissed: true } : {}),
    })
      .sort({ lastFoundAt: -1 })
      .limit(200)
      .lean();
    res.json({
      success: true,
      data: { leads, running: isDiscoveryRunning(), triaging: isTriageRunning() },
    });
  }
);

// POST /api/admin/opportunity-leads/run
// Starts a search now and answers at once: it makes a dozen AI calls in a row.
export const runOpportunityDiscoveryNow = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (isDiscoveryRunning()) throw new AppError("A search for new leads is already running.", 409);
    void runOpportunityDiscovery().catch((error) => log.error("Manual lead search failed:", error));
    if (req.user?.id) {
      void recordAuditLog({
        adminId: req.user.id,
        adminEmail: req.user.email || "",
        action: "opportunity-leads.run",
        targetType: "OpportunityLead",
        targetId: "all",
      });
    }
    res.status(202).json({
      success: true,
      message: "Searching for new leads. They appear here in a few minutes.",
    });
  }
);

// POST /api/admin/opportunity-leads/triage
// Sorts the leads not yet looked at. Answers at once: it makes several AI calls.
// An admin pressing the button is an explicit request, so it ignores the
// OPPORTUNITY_LEAD_TRIAGE switch that gates the unattended run.
export const triageOpportunityLeadsNow = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (isTriageRunning()) throw new AppError("Triage is already running.", 409);
    void runLeadTriage().catch((error) => log.error("Manual lead triage failed:", error));
    if (req.user?.id) {
      void recordAuditLog({
        adminId: req.user.id,
        adminEmail: req.user.email || "",
        action: "opportunity-leads.triage",
        targetType: "OpportunityLead",
        targetId: "all",
      });
    }
    res.status(202).json({
      success: true,
      message: "Sorting the leads. Results appear here in a minute or two.",
    });
  }
);

// POST /api/admin/opportunity-leads/:id/restore
// Undo an automatic dismissal. The lead is locked so triage never dismisses it again.
export const restoreOpportunityLead = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    if (!id || typeof id !== "string" || !mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid id.", 400);
    }
    const lead = await OpportunityLead.findOneAndUpdate(
      { _id: id, status: "dismissed", autoDismissed: true },
      {
        $set: { status: "new", triageLocked: true },
        $unset: { autoDismissed: "", dismissReason: "" },
      },
      { new: true }
    ).lean();
    if (!lead)
      throw new AppError("Only a lead that was dismissed automatically can be restored.", 404);
    if (req.user?.id) {
      void recordAuditLog({
        adminId: req.user.id,
        adminEmail: req.user.email || "",
        action: "opportunity-leads.restore",
        targetType: "OpportunityLead",
        targetId: id,
        metadata: { url: lead.url },
      });
    }
    res.json({ success: true, message: "Restored. Triage will leave it alone." });
  }
);

// POST /api/admin/opportunity-leads/:id/draft  { force? }
// Read the lead and write what it says into a new draft entry. Answers at once;
// the reading runs in the background and the draft appears in the list when done.
export const draftOpportunityLead = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    if (!id || typeof id !== "string" || !mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid id.", 400);
    }
    if (!req.user?.id) throw new AppError("Unauthorized", 401);
    const submission = await draftFromLead(id, req.user.id, { force: req.body?.force === true });
    res.status(202).json({
      success: true,
      message: "Reading it. The draft will appear in the list in a few minutes.",
      data: { submissionId: String(submission._id) },
    });
  }
);

// POST /api/admin/opportunity-leads/:id/dismiss  { reason? }
export const dismissOpportunityLead = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { id } = req.params;
    if (!id || typeof id !== "string" || !mongoose.isValidObjectId(id)) {
      throw new AppError("Invalid id.", 400);
    }
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 300) : "";
    const lead = await OpportunityLead.findByIdAndUpdate(
      id,
      { $set: { status: "dismissed", ...(reason ? { dismissReason: reason } : {}) } },
      { new: true }
    ).lean();
    if (!lead) throw new AppError("Not found.", 404);
    if (req.user?.id) {
      void recordAuditLog({
        adminId: req.user.id,
        adminEmail: req.user.email || "",
        action: "opportunity-leads.dismiss",
        targetType: "OpportunityLead",
        targetId: id,
        metadata: { url: lead.url, reason },
      });
    }
    res.json({ success: true, message: "Dismissed. It will not come back." });
  }
);
