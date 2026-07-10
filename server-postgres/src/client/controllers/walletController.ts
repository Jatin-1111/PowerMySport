import { Request, Response } from "express";
import { WalletService } from "../services/WalletService";

export const getWallet = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const wallet = await WalletService.getWallet(req.user.id);
    res.status(200).json({ success: true, data: wallet });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get wallet",
    });
  }
};

export const topUpWallet = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const { amount } = req.body;
    if (!amount || amount < 1) {
      res
        .status(400)
        .json({ success: false, message: "Invalid top-up amount" });
      return;
    }
    const result = await WalletService.initiateTopUp(req.user.id, amount);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to initiate top-up",
    });
  }
};

export const verifyTopUp = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!req.user?.id) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const { merchantOrderId } = req.body;
    if (!merchantOrderId) {
      res
        .status(400)
        .json({ success: false, message: "Missing merchantOrderId" });
      return;
    }
    const result = await WalletService.verifyTopUp(
      req.user.id,
      merchantOrderId,
    );
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to verify top-up",
    });
  }
};
