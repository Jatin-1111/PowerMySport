import { Request, Response } from "express";
import {
  createPromoCode,
  deactivatePromoCode,
  getAllPromoCodes,
  getPromoCodeStats,
} from "../services/PromoCodeService";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

export const createPromoCodeHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const payload = {
      ...req.body,
      validFrom: new Date(req.body.validFrom),
      validUntil: new Date(req.body.validUntil),
      createdBy: req.user.id,
    };

    const promo = await createPromoCode(payload);
    res.status(201).json({
      success: true,
      message: "Promo code created",
      data: promo,
    });
  }
);

export const listPromoCodesHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const data = await getAllPromoCodes();
    res.status(200).json({
      success: true,
      message: "Promo codes fetched",
      data,
    });
  }
);

export const deactivatePromoCodeHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const codeId = String(req.params.codeId || "");
    const promo = await deactivatePromoCode(codeId);

    if (!promo) {
      throw new AppError("Promo code not found", 404);
    }

    res.status(200).json({
      success: true,
      message: "Promo code deactivated",
      data: promo,
    });
  }
);

export const promoCodeStatsHandler = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const codeId = String(req.params.codeId || "");
    const data = await getPromoCodeStats(codeId);
    res.status(200).json({
      success: true,
      message: "Promo code stats fetched",
      data,
    });
  }
);
