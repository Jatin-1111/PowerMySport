import { Request, Response } from "express";
import {
  createPromoCode,
  deactivatePromoCode,
  getAllPromoCodes,
  getPromoCodeStats,
} from "../services/PromoCodeService";

export const createPromoCodeHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
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
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to create promo",
    });
  }
};

export const listPromoCodesHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const data = await getAllPromoCodes();
    res.status(200).json({
      success: true,
      message: "Promo codes fetched",
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch promo codes",
    });
  }
};

export const deactivatePromoCodeHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const codeId = String(req.params.codeId || "");
    const promo = await deactivatePromoCode(codeId);

    if (!promo) {
      res.status(404).json({ success: false, message: "Promo code not found" });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Promo code deactivated",
      data: promo,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to deactivate promo",
    });
  }
};

export const promoCodeStatsHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const codeId = String(req.params.codeId || "");
    const data = await getPromoCodeStats(codeId);
    res.status(200).json({
      success: true,
      message: "Promo code stats fetched",
      data,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch promo stats",
    });
  }
};
