import { Router, Request, Response } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { authMiddleware, adminMiddleware, requirePermission } from "../../middleware/auth";
import { AppError } from "../../utils/AppError";
import {
  approvePendingChanges,
  listPendingChanges,
  rejectPendingChanges,
  type ProviderKind,
} from "../../shared/services/pendingChanges";
import { recordAuditLog } from "../services/AuditLogService";

/**
 * Claim-field edits made by approved providers, held until an admin decides.
 * Mounted at /api/admin/provider-changes.
 */
const router = Router();

const KINDS: ProviderKind[] = ["coach", "expert", "venue"];

const kindParam = (req: Request): ProviderKind => {
  const kind = (req.params as Record<string, unknown>).kind as string;
  if (!KINDS.includes(kind as ProviderKind)) throw new AppError("Unknown provider type", 400);
  return kind as ProviderKind;
};

// Same permission the matching approval already needs. Experts have no
// dedicated permission; their approvals are gated by the admin role alone.
const permissionFor = (req: Request, res: Response, next: () => void) => {
  const kind = kindParam(req);
  if (kind === "coach") return requirePermission("coaches:verify")(req, res, next);
  if (kind === "venue") return requirePermission("venues:manage")(req, res, next);
  return next();
};

router.get(
  "/",
  authMiddleware,
  adminMiddleware,
  asyncHandler(async (_req: Request, res: Response) => {
    const data = await listPendingChanges();
    res.status(200).json({ success: true, data });
  })
);

const decide = (action: "approve" | "reject") =>
  asyncHandler(async (req: Request, res: Response) => {
    const kind = kindParam(req);
    const id = (req.params as Record<string, unknown>).id as string;
    if (action === "approve") await approvePendingChanges(kind, id);
    else await rejectPendingChanges(kind, id);

    void recordAuditLog({
      adminId: req.user?.id || "",
      adminEmail: req.user?.email || "",
      action: `${kind}.changes.${action}`,
      targetType: kind === "coach" ? "Coach" : kind === "expert" ? "Expert" : "Venue",
      targetId: id,
    });

    res.status(200).json({
      success: true,
      message: action === "approve" ? "Changes approved" : "Changes rejected",
    });
  });

router.post(
  "/:kind/:id/approve",
  authMiddleware,
  adminMiddleware,
  permissionFor,
  decide("approve")
);
router.post("/:kind/:id/reject", authMiddleware, adminMiddleware, permissionFor, decide("reject"));

export default router;
