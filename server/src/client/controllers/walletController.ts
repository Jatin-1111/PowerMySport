import { Request, Response } from "express";
import { WalletService } from "../services/WalletService";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

export const getWallet = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.id) {
    throw new AppError("Unauthorized", 401);
  }
  const wallet = await WalletService.getWallet(req.user.id);
  res.status(200).json({ success: true, data: wallet });
});

export const topUpWallet = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.id) {
    throw new AppError("Unauthorized", 401);
  }
  const { amount } = req.body;
  if (!amount || amount < 1) {
    throw new AppError("Invalid top-up amount", 400);
  }
  const result = await WalletService.initiateTopUp(req.user.id, amount);
  res.status(200).json({ success: true, data: result });
});

export const verifyTopUp = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  if (!req.user?.id) {
    throw new AppError("Unauthorized", 401);
  }
  const { merchantOrderId } = req.body;
  if (!merchantOrderId) {
    throw new AppError("Missing merchantOrderId", 400);
  }
  const result = await WalletService.verifyTopUp(req.user.id, merchantOrderId);
  res.status(200).json({ success: true, data: result });
});
