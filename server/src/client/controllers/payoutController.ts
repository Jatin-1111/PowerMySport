import { Request, Response } from "express";
import { Coach, IPayoutMethod } from "../../client/models/Coach";
import { Venue } from "../../client/models/Venue";
import { Expert } from "../../client/models/ExpertProfile";

type PayoutMethodRecord = IPayoutMethod & {
  _id?: unknown;
};

const getPayoutMethodId = (method: PayoutMethodRecord): string | undefined => {
  if (method.id) {
    return method.id.toString();
  }

  if (typeof method._id === "string") {
    return method._id;
  }

  if (
    method._id &&
    typeof method._id === "object" &&
    "toString" in method._id
  ) {
    return method._id.toString();
  }

  return undefined;
};

const getPrimaryPayoutMethod = (
  payoutMethods?: IPayoutMethod[],
): IPayoutMethod | null => {
  if (!payoutMethods || payoutMethods.length === 0) {
    return null;
  }

  return (
    payoutMethods.find((method) => method.isDefault) ?? payoutMethods[0] ?? null
  );
};

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

    const coach = await Coach.findOne({ userId })
      .select("payoutMethods")
      .lean();
    if (!coach) {
      res
        .status(404)
        .json({ success: false, message: "Coach profile not found" });
      return;
    }

    res.json({
      success: true,
      message: "Payout method retrieved",
      data: {
        payoutMethod: getPrimaryPayoutMethod(
          coach.payoutMethods as IPayoutMethod[] | undefined,
        ),
      },
    });
  } catch (error) {
    console.error("getCoachPayoutMethod error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to retrieve payout method" });
  }
};

/**
 * GET /api/payouts/coach/my-payout-methods
 * Get all of the current coach's saved payout methods
 */
export const getCoachPayoutMethods = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const coach = await Coach.findOne({ userId })
      .select("payoutMethods")
      .lean();
    if (!coach) {
      res
        .status(404)
        .json({ success: false, message: "Coach profile not found" });
      return;
    }

    res.json({
      success: true,
      message: "Payout methods retrieved",
      data: { payoutMethods: coach.payoutMethods || [] },
    });
  } catch (error) {
    console.error("getCoachPayoutMethods error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to retrieve payout methods" });
  }
};

/**
 * PUT /api/payouts/coach/my-payout-method
 * Save or update the current coach's payout method (add new or update existing)
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

    const {
      id,
      type,
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
      upiId,
    } = req.body as {
      id?: string;
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
      if (
        !accountHolderName?.trim() ||
        !accountNumber?.trim() ||
        !ifscCode?.trim() ||
        !bankName?.trim()
      ) {
        res.status(400).json({
          success: false,
          message:
            "Bank transfer requires: accountHolderName, accountNumber, ifscCode, bankName",
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

    const payoutMethods = coach.payoutMethods ?? [];

    const payoutMethodData: IPayoutMethod = {
      type,
      addedAt: now,
      updatedAt: now,
      isDefault: !coach.payoutMethods || coach.payoutMethods.length === 0, // First method is default
    };

    if (type === "BANK_TRANSFER") {
      payoutMethodData.accountHolderName = accountHolderName!.trim();
      payoutMethodData.accountNumber = accountNumber!.trim();
      payoutMethodData.ifscCode = ifscCode!.trim().toUpperCase();
      payoutMethodData.bankName = bankName!.trim();
    } else {
      payoutMethodData.upiId = upiId!.trim();
    }

    if (id) {
      // Update existing method
      const methodIndex = payoutMethods.findIndex(
        (method) => getPayoutMethodId(method as PayoutMethodRecord) === id,
      );
      if (methodIndex === -1) {
        res
          .status(404)
          .json({ success: false, message: "Payout method not found" });
        return;
      }
      payoutMethodData.id = id;
      payoutMethodData.addedAt = payoutMethods[methodIndex]!.addedAt;
      payoutMethods[methodIndex] = payoutMethodData;
    } else {
      // Add new method
      payoutMethods.push(payoutMethodData);
    }

    coach.payoutMethods = payoutMethods;

    await coach.save();

    res.json({
      success: true,
      message: "Payout method saved successfully",
      data: { payoutMethods: coach.payoutMethods },
    });
  } catch (error) {
    console.error("upsertCoachPayoutMethod error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to save payout method" });
  }
};

/**
 * DELETE /api/payouts/coach/my-payout-method/:methodId
 * Remove a specific payout method by ID (or all if no ID provided)
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

    const { methodId } = req.params;

    const coach = await Coach.findOne({ userId });
    if (!coach) {
      res
        .status(404)
        .json({ success: false, message: "Coach profile not found" });
      return;
    }

    const payoutMethods = coach.payoutMethods ?? [];

    if (methodId) {
      // Delete specific method
      const initialLength = payoutMethods.length;
      coach.payoutMethods = payoutMethods.filter(
        (method) =>
          getPayoutMethodId(method as PayoutMethodRecord) !== methodId,
      );

      if ((coach.payoutMethods ?? []).length === initialLength) {
        res
          .status(404)
          .json({ success: false, message: "Payout method not found" });
        return;
      }

      // If the deleted method was default and there are remaining methods, set first as default
      if (
        !coach.payoutMethods.some((method) => method.isDefault) &&
        coach.payoutMethods.length > 0
      ) {
        coach.payoutMethods[0]!.isDefault = true;
      }
    } else {
      // Delete all methods
      coach.payoutMethods = [];
    }

    await coach.save();

    res.json({
      success: true,
      message: "Payout method removed",
      data: { payoutMethods: coach.payoutMethods },
    });
  } catch (error) {
    console.error("deleteCoachPayoutMethod error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to remove payout method" });
  }
};

/**
 * PUT /api/payouts/coach/my-payout-method/:methodId/set-default
 * Set a specific payout method as the default
 */
export const setCoachDefaultPayoutMethod = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { methodId } = req.params;

    const coach = await Coach.findOne({ userId });
    if (!coach) {
      res
        .status(404)
        .json({ success: false, message: "Coach profile not found" });
      return;
    }

    const methods = coach.payoutMethods || [];
    const methodIndex = methods.findIndex(
      (method) => getPayoutMethodId(method as PayoutMethodRecord) === methodId,
    );

    if (methodIndex === -1) {
      res
        .status(404)
        .json({ success: false, message: "Payout method not found" });
      return;
    }

    // Set all to non-default except the one being set
    methods.forEach((m, idx) => {
      m.isDefault = idx === methodIndex;
    });

    await coach.save();

    res.json({
      success: true,
      message: "Default payout method updated",
      data: { payoutMethods: coach.payoutMethods },
    });
  } catch (error) {
    console.error("setCoachDefaultPayoutMethod error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to set default payout method" });
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
      .select("payoutMethods name")
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
      data: {
        payoutMethod: getPrimaryPayoutMethod(
          venue.payoutMethods as IPayoutMethod[] | undefined,
        ),
        venueName: venue.name,
      },
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

    const {
      id,
      type,
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
      upiId,
    } = req.body as {
      id?: string;
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
      if (
        !accountHolderName?.trim() ||
        !accountNumber?.trim() ||
        !ifscCode?.trim() ||
        !bankName?.trim()
      ) {
        res.status(400).json({
          success: false,
          message:
            "Bank transfer requires: accountHolderName, accountNumber, ifscCode, bankName",
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
      .select("payoutMethods");

    if (!existingVenue) {
      res
        .status(404)
        .json({ success: false, message: "No venue found for this account" });
      return;
    }

    const now = new Date();
    const payoutMethodData: IPayoutMethod = {
      type,
      addedAt: now,
      updatedAt: now,
      isDefault:
        !existingVenue.payoutMethods ||
        existingVenue.payoutMethods.length === 0, // First method is default
    };

    if (type === "BANK_TRANSFER") {
      payoutMethodData.accountHolderName = accountHolderName!.trim();
      payoutMethodData.accountNumber = accountNumber!.trim();
      payoutMethodData.ifscCode = ifscCode!.trim().toUpperCase();
      payoutMethodData.bankName = bankName!.trim();
    } else {
      payoutMethodData.upiId = upiId!.trim();
    }

    // Apply to all venues owned by this user
    let update: any = {};
    if (id) {
      // Update existing method - use a more complex update
      // First, update all venues' payout methods
      const venues = await Venue.find({ ownerId: userId });
      for (const venue of venues) {
        const venueMethods = venue.payoutMethods ?? [];
        const methodIndex = venueMethods.findIndex(
          (method) => getPayoutMethodId(method as PayoutMethodRecord) === id,
        );
        if (methodIndex !== -1) {
          payoutMethodData.id = id;
          payoutMethodData.addedAt = venueMethods[methodIndex]!.addedAt;
          venueMethods[methodIndex] = payoutMethodData;
          venue.payoutMethods = venueMethods;
          await venue.save();
        }
      }
    } else {
      // Add new method - append to all venues
      await Venue.updateMany(
        { ownerId: userId },
        { $push: { payoutMethods: payoutMethodData } },
      );
    }

    const updatedVenue = await Venue.findOne({ ownerId: userId })
      .sort({ createdAt: 1 })
      .select("payoutMethods");

    res.json({
      success: true,
      message: "Payout method saved successfully for all your venues",
      data: { payoutMethods: updatedVenue?.payoutMethods || [] },
    });
  } catch (error) {
    console.error("upsertVenuePayoutMethod error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to save payout method" });
  }
};

/**
 * DELETE /api/payouts/venue/my-payout-method/:methodId
 * Remove a specific payout method from all venues (or all if no ID provided)
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

    const { methodId } = req.params;

    if (methodId) {
      // Delete specific method from all venues
      const venues = await Venue.find({ ownerId: userId });
      for (const venue of venues) {
        const venueMethods = venue.payoutMethods ?? [];
        const initialLength = venueMethods.length;
        venue.payoutMethods = venueMethods.filter(
          (method) =>
            getPayoutMethodId(method as PayoutMethodRecord) !== methodId,
        );

        // If the deleted method was default and there are remaining methods, set first as default
        if (
          !venue.payoutMethods.some((method) => method.isDefault) &&
          venue.payoutMethods.length > 0
        ) {
          venue.payoutMethods[0]!.isDefault = true;
        }

        await venue.save();
      }

      const updatedVenue = await Venue.findOne({ ownerId: userId })
        .sort({ createdAt: 1 })
        .select("payoutMethods");

      res.json({
        success: true,
        message: "Payout method removed from all your venues",
        data: { payoutMethods: updatedVenue?.payoutMethods || [] },
      });
    } else {
      // Delete all methods from all venues
      const result = await Venue.updateMany(
        { ownerId: userId },
        { $set: { payoutMethods: [] } },
      );

      if (result.matchedCount === 0) {
        res
          .status(404)
          .json({ success: false, message: "No venue found for this account" });
        return;
      }

      res.json({
        success: true,
        message: "All payout methods removed from your venues",
        data: { payoutMethods: [] },
      });
    }
  } catch (error) {
    console.error("deleteVenuePayoutMethod error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to remove payout method" });
  }
};

/**
 * PUT /api/payouts/venue/my-payout-method/:methodId/set-default
 * Set a specific payout method as the default for all venues
 */
export const setVenueDefaultPayoutMethod = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { methodId } = req.params;

    const venues = await Venue.find({ ownerId: userId });
    if (venues.length === 0) {
      res
        .status(404)
        .json({ success: false, message: "No venue found for this account" });
      return;
    }

    let updated = false;
    for (const venue of venues) {
      const methodIndex = (venue.payoutMethods || []).findIndex(
        (method) =>
          getPayoutMethodId(method as PayoutMethodRecord) === methodId,
      );

      if (methodIndex !== -1) {
        // Set all to non-default except the one being set
        (venue.payoutMethods || []).forEach((m, idx) => {
          m.isDefault = idx === methodIndex;
        });
        await venue.save();
        updated = true;
      }
    }

    if (!updated) {
      res
        .status(404)
        .json({ success: false, message: "Payout method not found" });
      return;
    }

    const updatedVenue = await Venue.findOne({ ownerId: userId })
      .sort({ createdAt: 1 })
      .select("payoutMethods");

    res.json({
      success: true,
      message: "Default payout method updated for all your venues",
      data: { payoutMethods: updatedVenue?.payoutMethods || [] },
    });
  } catch (error) {
    console.error("setVenueDefaultPayoutMethod error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to set default payout method" });
  }
};

// ============================================
// EXPERT PAYOUT METHODS
// ============================================

/**
 * GET /api/payouts/expert/my-payout-method
 * Get the current expert's saved payout method
 */
export const getExpertPayoutMethod = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const expert = await Expert.findOne({ userId })
      .select("payoutMethods")
      .lean();
    if (!expert) {
      res
        .status(404)
        .json({ success: false, message: "Expert profile not found" });
      return;
    }

    res.json({
      success: true,
      message: "Payout method retrieved",
      data: {
        payoutMethod: getPrimaryPayoutMethod(
          expert.payoutMethods as IPayoutMethod[] | undefined,
        ),
      },
    });
  } catch (error) {
    console.error("getExpertPayoutMethod error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to retrieve payout method" });
  }
};

/**
 * GET /api/payouts/expert/my-payout-methods
 * Get all of the current expert's saved payout methods
 */
export const getExpertPayoutMethods = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const expert = await Expert.findOne({ userId })
      .select("payoutMethods")
      .lean();
    if (!expert) {
      res
        .status(404)
        .json({ success: false, message: "Expert profile not found" });
      return;
    }

    res.json({
      success: true,
      message: "Payout methods retrieved",
      data: { payoutMethods: expert.payoutMethods || [] },
    });
  } catch (error) {
    console.error("getExpertPayoutMethods error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to retrieve payout methods" });
  }
};

/**
 * PUT /api/payouts/expert/my-payout-method
 * Save or update the current expert's payout method (add new or update existing)
 */
export const upsertExpertPayoutMethod = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const {
      id,
      type,
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
      upiId,
    } = req.body as {
      id?: string;
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
      if (
        !accountHolderName?.trim() ||
        !accountNumber?.trim() ||
        !ifscCode?.trim() ||
        !bankName?.trim()
      ) {
        res.status(400).json({
          success: false,
          message:
            "Bank transfer requires: accountHolderName, accountNumber, ifscCode, bankName",
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
    const expert = await Expert.findOne({ userId });
    if (!expert) {
      res
        .status(404)
        .json({ success: false, message: "Expert profile not found" });
      return;
    }
    // Adding real bank/UPI details shouldn't be possible before an admin has
    // actually vetted this expert — otherwise a brand-new, never-reviewed
    // signup could pre-stage financial details with zero identity checks.
    if (expert.verificationStatus !== "APPROVED") {
      res.status(403).json({
        success: false,
        message:
          "Your expert profile must be approved before adding a payout method",
      });
      return;
    }

    const payoutMethods = expert.payoutMethods ?? [];

    const payoutMethodData: IPayoutMethod = {
      type,
      addedAt: now,
      updatedAt: now,
      isDefault: !expert.payoutMethods || expert.payoutMethods.length === 0, // First method is default
    };

    if (type === "BANK_TRANSFER") {
      payoutMethodData.accountHolderName = accountHolderName!.trim();
      payoutMethodData.accountNumber = accountNumber!.trim();
      payoutMethodData.ifscCode = ifscCode!.trim().toUpperCase();
      payoutMethodData.bankName = bankName!.trim();
    } else {
      payoutMethodData.upiId = upiId!.trim();
    }

    if (id) {
      // Update existing method
      const methodIndex = payoutMethods.findIndex(
        (method: IPayoutMethod) =>
          getPayoutMethodId(method as PayoutMethodRecord) === id,
      );
      if (methodIndex === -1) {
        res
          .status(404)
          .json({ success: false, message: "Payout method not found" });
        return;
      }
      payoutMethodData.id = id;
      payoutMethodData.addedAt = payoutMethods[methodIndex]!.addedAt;
      payoutMethods[methodIndex] = payoutMethodData;
    } else {
      // Add new method
      payoutMethods.push(payoutMethodData);
    }

    expert.payoutMethods = payoutMethods;

    await expert.save();

    res.json({
      success: true,
      message: "Payout method saved successfully",
      data: { payoutMethods: expert.payoutMethods },
    });
  } catch (error) {
    console.error("upsertExpertPayoutMethod error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to save payout method" });
  }
};

/**
 * DELETE /api/payouts/expert/my-payout-method/:methodId
 * Remove a specific payout method by ID (or all if no ID provided)
 */
export const deleteExpertPayoutMethod = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { methodId } = req.params;

    const expert = await Expert.findOne({ userId });
    if (!expert) {
      res
        .status(404)
        .json({ success: false, message: "Expert profile not found" });
      return;
    }

    const payoutMethods = expert.payoutMethods ?? [];

    if (methodId) {
      // Delete specific method
      const initialLength = payoutMethods.length;
      expert.payoutMethods = payoutMethods.filter(
        (method: IPayoutMethod) =>
          getPayoutMethodId(method as PayoutMethodRecord) !== methodId,
      );

      if ((expert.payoutMethods ?? []).length === initialLength) {
        res
          .status(404)
          .json({ success: false, message: "Payout method not found" });
        return;
      }

      // If the deleted method was default and there are remaining methods, set first as default
      if (
        !expert.payoutMethods.some(
          (method: IPayoutMethod) => method.isDefault,
        ) &&
        expert.payoutMethods.length > 0
      ) {
        expert.payoutMethods[0]!.isDefault = true;
      }
    } else {
      // Delete all methods
      expert.payoutMethods = [];
    }

    await expert.save();

    res.json({
      success: true,
      message: "Payout method removed",
      data: { payoutMethods: expert.payoutMethods },
    });
  } catch (error) {
    console.error("deleteExpertPayoutMethod error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to remove payout method" });
  }
};

/**
 * PUT /api/payouts/expert/my-payout-method/:methodId/set-default
 * Set a specific payout method as the default
 */
export const setExpertDefaultPayoutMethod = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const { methodId } = req.params;

    const expert = await Expert.findOne({ userId });
    if (!expert) {
      res
        .status(404)
        .json({ success: false, message: "Expert profile not found" });
      return;
    }

    const methods = expert.payoutMethods || [];
    const methodIndex = methods.findIndex(
      (method: IPayoutMethod) =>
        getPayoutMethodId(method as PayoutMethodRecord) === methodId,
    );

    if (methodIndex === -1) {
      res
        .status(404)
        .json({ success: false, message: "Payout method not found" });
      return;
    }

    // Set all to non-default except the one being set
    methods.forEach((m: IPayoutMethod, idx: number) => {
      m.isDefault = idx === methodIndex;
    });

    await expert.save();

    res.json({
      success: true,
      message: "Default payout method updated",
      data: { payoutMethods: expert.payoutMethods },
    });
  } catch (error) {
    console.error("setExpertDefaultPayoutMethod error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to set default payout method" });
  }
};
