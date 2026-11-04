import { Request, Response } from "express";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";
import { RankingClaimService } from "../services/RankingClaimService";

/**
 * Linking a player profile to a federation ranking row.
 *
 * Thin on purpose: every rule that matters — the single failure message, the
 * per-registration-number lockout, the fact that the submitted date of birth is
 * compared and discarded rather than stored — lives in `RankingClaimService`,
 * where it can be read in one sitting and tested without HTTP. This file only
 * converts between the wire and that service.
 *
 * The one rule it holds itself: nothing here reads `req.body.dob` for any
 * purpose other than handing it to the service. It must not reach a log line,
 * an error message or the response.
 */

/**
 * POST /api/ranking-claims
 * Body: { dependentId, regNo, dob: "YYYY-MM-DD", sportSlug? }
 */
export const createRankingClaim = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }

    const { dependentId, regNo, dob, sportSlug } = req.body ?? {};
    const claim = await RankingClaimService.claim({
      userId: req.user.id,
      dependentId: String(dependentId ?? ""),
      regNo: String(regNo ?? ""),
      dob: String(dob ?? ""),
      ...(typeof sportSlug === "string" ? { sportSlug } : {}),
    });

    res.status(201).json({ success: true, data: claim });
  }
);

/** GET /api/ranking-claims — this account's links, with live standings. */
export const listRankingClaims = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }
    const claims = await RankingClaimService.list(req.user.id);
    res.json({ success: true, data: claims });
  }
);

/** DELETE /api/ranking-claims/:id — unlink. */
export const deleteRankingClaim = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new AppError("Unauthorized", 401);
    }
    await RankingClaimService.remove(req.user.id, String(req.params.id ?? ""));
    res.json({ success: true, message: "Ranking unlinked." });
  }
);
