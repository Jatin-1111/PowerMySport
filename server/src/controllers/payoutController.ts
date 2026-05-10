import { Request, Response } from "express";
import { Coach } from "../models/Coach";
import { Venue } from "../models/Venue";

// ============================================
// COACH PAYOUT METHODS
// ============================================

/**
 * GET /api/payouts/coach/my-payout-method
 * Get the current coach's saved payout method
 */
export const getCoachPayoutMethod = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const coach = await Coach.findOne({ userId }).select("payoutMethod").lean();
    if (!coach) {
      res
        .status(404)
        .json({ success: false, message: "Coach profile not found" });
      return;
    }

    res.json({
      success: true,
      message: "Payout method retrieved",
      data: { payoutMethod: coach.payoutMethod ?? null },
    });
  } catch (error) {
    console.error("getCoachPayoutMethod error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to retrieve payout method" });
  }
};

/**
 * PUT /api/payouts/coach/my-payout-method
 * Save or update the current coach's payout method
 */
export const upsertCoachPayoutMethod = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { type, accountHolderName, accountNumber, ifscCode, bankName, upiId } =
      req.body as {
        type: "BANK_TRANSFER" | "UPI";
        accountHolderName?: string;
        accountNumber?: string;
        ifscCode?: string;
        bankName?: string;
        upiId?: string;
      };

    // Basic validation
    if (!type || !["BANK_TRANSFER", "UPI"].includes(type)) {
      res.status(400).json({
        success: false,
        message: "Invalid payout method type. Must be BANK_TRANSFER or UPI.",
      });
      return;
    }

    if (type === "BANK_TRANSFER") {
      if (!accountHolderName?.trim() || !accountNumber?.trim() || !ifscCode?.trim() || !bankName?.trim()) {
        res.status(400).json({
          success: false,
          message: "Bank transfer requires: accountHolderName, accountNumber, ifscCode, bankName",
        });
        return;
      }
      // Validate IFSC format (basic)
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.toUpperCase().trim())) {
        res.status(400).json({
          success: false,
          message: "Invalid IFSC code format (e.g., SBIN0001234)",
        });
        return;
      }
    }

    if (type === "UPI") {
      if (!upiId?.trim()) {
        res.status(400).json({
          success: false,
          message: "UPI method requires a valid UPI ID",
        });
        return;
      }
      // Basic UPI ID validation
      if (!/^[\w.\-+]+@[\w]+$/.test(upiId.trim())) {
        res.status(400).json({
          success: false,
          message: "Invalid UPI ID format (e.g., yourname@okaxis)",
        });
        return;
      }
    }

    const now = new Date();
    const coach = await Coach.findOne({ userId });
    if (!coach) {
      res
        .status(404)
        .json({ success: false, message: "Coach profile not found" });
      return;
    }

    const payoutMethodData: any = {
      type,
      addedAt: coach.payoutMethod?.addedAt ?? now,
      updatedAt: now,
    };

    if (type === "BANK_TRANSFER") {
      payoutMethodData.accountHolderName = accountHolderName!.trim();
      payoutMethodData.accountNumber = accountNumber!.trim();
      payoutMethodData.ifscCode = ifscCode!.trim().toUpperCase();
      payoutMethodData.bankName = bankName!.trim();
      // Clear UPI
      payoutMethodData.upiId = undefined;
    } else {
      payoutMethodData.upiId = upiId!.trim();
      // Clear bank fields
      payoutMethodData.accountHolderName = undefined;
      payoutMethodData.accountNumber = undefined;
      payoutMethodData.ifscCode = undefined;
      payoutMethodData.bankName = undefined;
    }

    coach.payoutMethod = payoutMethodData;
    await coach.save();

    res.json({
      success: true,
      message: "Payout method saved successfully",
      data: { payoutMethod: coach.payoutMethod },
    });
  } catch (error) {
    console.error("upsertCoachPayoutMethod error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to save payout method" });
  }
};

/**
 * DELETE /api/payouts/coach/my-payout-method
 * Remove the current coach's payout method
 */
export const deleteCoachPayoutMethod = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const coach = await Coach.findOneAndUpdate(
      { userId },
      { $unset: { payoutMethod: 1 } },
      { new: true },
    ).select("payoutMethod");

    if (!coach) {
      res
        .status(404)
        .json({ success: false, message: "Coach profile not found" });
      return;
    }

    res.json({
      success: true,
      message: "Payout method removed",
      data: { payoutMethod: null },
    });
  } catch (error) {
    console.error("deleteCoachPayoutMethod error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to remove payout method" });
  }
};

// ============================================
// VENUE OWNER PAYOUT METHODS
// ============================================

/**
 * GET /api/payouts/venue/my-payout-method
 * Get the venue owner's payout method (for their primary venue)
 */
export const getVenuePayoutMethod = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const venue = await Venue.findOne({ ownerId: userId })
      .sort({ createdAt: 1 })
      .select("payoutMethod name")
      .lean();

    if (!venue) {
      res
        .status(404)
        .json({ success: false, message: "No venue found for this account" });
      return;
    }

    res.json({
      success: true,
      message: "Payout method retrieved",
      data: { payoutMethod: venue.payoutMethod ?? null, venueName: venue.name },
    });
  } catch (error) {
    console.error("getVenuePayoutMethod error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to retrieve payout method" });
  }
};

/**
 * PUT /api/payouts/venue/my-payout-method
 * Save or update payout method for a venue owner (applies to all their venues)
 */
export const upsertVenuePayoutMethod = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { type, accountHolderName, accountNumber, ifscCode, bankName, upiId } =
      req.body as {
        type: "BANK_TRANSFER" | "UPI";
        accountHolderName?: string;
        accountNumber?: string;
        ifscCode?: string;
        bankName?: string;
        upiId?: string;
      };

    // Basic validation
    if (!type || !["BANK_TRANSFER", "UPI"].includes(type)) {
      res.status(400).json({
        success: false,
        message: "Invalid payout method type. Must be BANK_TRANSFER or UPI.",
      });
      return;
    }

    if (type === "BANK_TRANSFER") {
      if (!accountHolderName?.trim() || !accountNumber?.trim() || !ifscCode?.trim() || !bankName?.trim()) {
        res.status(400).json({
          success: false,
          message: "Bank transfer requires: accountHolderName, accountNumber, ifscCode, bankName",
        });
        return;
      }
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.toUpperCase().trim())) {
        res.status(400).json({
          success: false,
          message: "Invalid IFSC code format (e.g., SBIN0001234)",
        });
        return;
      }
    }

    if (type === "UPI") {
      if (!upiId?.trim()) {
        res.status(400).json({
          success: false,
          message: "UPI method requires a valid UPI ID",
        });
        return;
      }
      if (!/^[\w.\-+]+@[\w]+$/.test(upiId.trim())) {
        res.status(400).json({
          success: false,
          message: "Invalid UPI ID format (e.g., yourname@okaxis)",
        });
        return;
      }
    }

    // Find the first venue to get the current addedAt
    const existingVenue = await Venue.findOne({ ownerId: userId })
      .sort({ createdAt: 1 })
      .select("payoutMethod");

    if (!existingVenue) {
      res
        .status(404)
        .json({ success: false, message: "No venue found for this account" });
      return;
    }

    const now = new Date();
    const payoutMethodData: any = {
      type,
      addedAt: existingVenue.payoutMethod?.addedAt ?? now,
      updatedAt: now,
    };

    if (type === "BANK_TRANSFER") {
      payoutMethodData.accountHolderName = accountHolderName!.trim();
      payoutMethodData.accountNumber = accountNumber!.trim();
      payoutMethodData.ifscCode = ifscCode!.trim().toUpperCase();
      payoutMethodData.bankName = bankName!.trim();
      payoutMethodData.upiId = undefined;
    } else {
      payoutMethodData.upiId = upiId!.trim();
      payoutMethodData.accountHolderName = undefined;
      payoutMethodData.accountNumber = undefined;
      payoutMethodData.ifscCode = undefined;
      payoutMethodData.bankName = undefined;
    }

    // Apply to all venues owned by this user
    await Venue.updateMany(
      { ownerId: userId },
      { $set: { payoutMethod: payoutMethodData } },
    );

    res.json({
      success: true,
      message: "Payout method saved successfully for all your venues",
      data: { payoutMethod: payoutMethodData },
    });
  } catch (error) {
    console.error("upsertVenuePayoutMethod error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to save payout method" });
  }
};

/**
 * DELETE /api/payouts/venue/my-payout-method
 * Remove the payout method from all venues owned by this user
 */
export const deleteVenuePayoutMethod = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const result = await Venue.updateMany(
      { ownerId: userId },
      { $unset: { payoutMethod: 1 } },
    );

    if (result.matchedCount === 0) {
      res
        .status(404)
        .json({ success: false, message: "No venue found for this account" });
      return;
    }

    res.json({
      success: true,
      message: "Payout method removed from all your venues",
      data: { payoutMethod: null },
    });
  } catch (error) {
    console.error("deleteVenuePayoutMethod error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to remove payout method" });
  }
};
