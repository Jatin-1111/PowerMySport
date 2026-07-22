import { Request, Response } from "express";
import type {
  CoachPayoutMethod,
  VenuePayoutMethod,
  ExpertPayoutMethod,
} from "@prisma/client";
import prisma from "../../lib/prisma";

type AnyPayoutMethod =
  | CoachPayoutMethod
  | VenuePayoutMethod
  | ExpertPayoutMethod;

const getPrimaryPayoutMethod = <T extends { isDefault: boolean }>(
  payoutMethods?: T[],
): T | null => {
  if (!payoutMethods || payoutMethods.length === 0) {
    return null;
  }

  return (
    payoutMethods.find((method) => method.isDefault) ?? payoutMethods[0] ?? null
  );
};

// Fields are genuinely optional per payout type (BANK_TRANSFER vs UPI) and the
// callers pass values typed `string | undefined` from the request body, so the
// properties allow explicit `undefined` (required under exactOptionalPropertyTypes).
type PayoutFieldInput = {
  accountHolderName?: string | undefined;
  accountNumber?: string | undefined;
  ifscCode?: string | undefined;
  bankName?: string | undefined;
  upiId?: string | undefined;
};

/**
 * Builds the type-specific column values for a payout method row. Mirrors the
 * old behaviour of replacing the whole embedded sub-document: fields that do
 * not apply to the chosen type are explicitly nulled out.
 */
const buildPayoutFields = (
  type: "BANK_TRANSFER" | "UPI",
  input: PayoutFieldInput,
) => {
  if (type === "BANK_TRANSFER") {
    return {
      type,
      accountHolderName: input.accountHolderName!.trim(),
      accountNumber: input.accountNumber!.trim(),
      ifscCode: input.ifscCode!.trim().toUpperCase(),
      bankName: input.bankName!.trim(),
      upiId: null,
    };
  }

  return {
    type,
    upiId: input.upiId!.trim(),
    accountHolderName: null,
    accountNumber: null,
    ifscCode: null,
    bankName: null,
  };
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

    const coach = await prisma.coach.findUnique({
      where: { userId },
      include: { payoutMethods: { orderBy: { addedAt: "asc" } } },
    });
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
        payoutMethod: getPrimaryPayoutMethod(coach.payoutMethods),
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

    const coach = await prisma.coach.findUnique({
      where: { userId },
      include: { payoutMethods: { orderBy: { addedAt: "asc" } } },
    });
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

    const coach = await prisma.coach.findUnique({
      where: { userId },
      include: { payoutMethods: { orderBy: { addedAt: "asc" } } },
    });
    if (!coach) {
      res
        .status(404)
        .json({ success: false, message: "Coach profile not found" });
      return;
    }

    const fields = buildPayoutFields(type, {
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
      upiId,
    });

    if (id) {
      // Update existing method
      const existing = coach.payoutMethods.find((method) => method.id === id);
      if (!existing) {
        res
          .status(404)
          .json({ success: false, message: "Payout method not found" });
        return;
      }
      // addedAt is preserved automatically (we do not touch it on update).
      await prisma.coachPayoutMethod.update({
        where: { id },
        data: fields,
      });
    } else {
      // Add new method — first method is default.
      await prisma.coachPayoutMethod.create({
        data: {
          coachId: coach.id,
          ...fields,
          isDefault: coach.payoutMethods.length === 0,
        },
      });
    }

    const payoutMethods = await prisma.coachPayoutMethod.findMany({
      where: { coachId: coach.id },
      orderBy: { addedAt: "asc" },
    });

    res.json({
      success: true,
      message: "Payout method saved successfully",
      data: { payoutMethods },
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

    const coach = await prisma.coach.findUnique({
      where: { userId },
      include: { payoutMethods: { orderBy: { addedAt: "asc" } } },
    });
    if (!coach) {
      res
        .status(404)
        .json({ success: false, message: "Coach profile not found" });
      return;
    }

    if (methodId) {
      // Delete specific method
      const existing = coach.payoutMethods.find(
        (method) => method.id === methodId,
      );
      if (!existing) {
        res
          .status(404)
          .json({ success: false, message: "Payout method not found" });
        return;
      }

      await prisma.coachPayoutMethod.delete({ where: { id: String(methodId) } });

      // If the deleted method was default and there are remaining methods, set first as default
      const remaining = await prisma.coachPayoutMethod.findMany({
        where: { coachId: coach.id },
        orderBy: { addedAt: "asc" },
      });
      if (remaining.length > 0 && !remaining.some((m) => m.isDefault)) {
        await prisma.coachPayoutMethod.update({
          where: { id: remaining[0]!.id },
          data: { isDefault: true },
        });
      }
    } else {
      // Delete all methods
      await prisma.coachPayoutMethod.deleteMany({
        where: { coachId: coach.id },
      });
    }

    const payoutMethods = await prisma.coachPayoutMethod.findMany({
      where: { coachId: coach.id },
      orderBy: { addedAt: "asc" },
    });

    res.json({
      success: true,
      message: "Payout method removed",
      data: { payoutMethods },
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

    const coach = await prisma.coach.findUnique({
      where: { userId },
      include: { payoutMethods: true },
    });
    if (!coach) {
      res
        .status(404)
        .json({ success: false, message: "Coach profile not found" });
      return;
    }

    const existing = coach.payoutMethods.find(
      (method) => method.id === methodId,
    );
    if (!existing) {
      res
        .status(404)
        .json({ success: false, message: "Payout method not found" });
      return;
    }

    // Set all to non-default except the one being set
    await prisma.coachPayoutMethod.updateMany({
      where: { coachId: coach.id },
      data: { isDefault: false },
    });
    await prisma.coachPayoutMethod.update({
      where: { id: String(methodId) },
      data: { isDefault: true },
    });

    const payoutMethods = await prisma.coachPayoutMethod.findMany({
      where: { coachId: coach.id },
      orderBy: { addedAt: "asc" },
    });

    res.json({
      success: true,
      message: "Default payout method updated",
      data: { payoutMethods },
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

    const venue = await prisma.venue.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: "asc" },
      include: { payoutMethods: { orderBy: { addedAt: "asc" } } },
    });

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
        payoutMethod: getPrimaryPayoutMethod(venue.payoutMethods),
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

    // Find the first venue to determine the default flag for a new method
    const existingVenue = await prisma.venue.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: "asc" },
      include: { payoutMethods: true },
    });

    if (!existingVenue) {
      res
        .status(404)
        .json({ success: false, message: "No venue found for this account" });
      return;
    }

    const fields = buildPayoutFields(type, {
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
      upiId,
    });
    const isDefault = existingVenue.payoutMethods.length === 0; // First method is default

    // Apply to all venues owned by this user
    if (id) {
      // Update existing method — only the venue that actually holds this row is
      // affected (method ids are unique per venue, matching the old per-doc ids).
      const venues = await prisma.venue.findMany({
        where: { ownerId: userId },
        include: { payoutMethods: true },
      });
      for (const venue of venues) {
        const existing = venue.payoutMethods.find(
          (method) => method.id === id,
        );
        if (existing) {
          await prisma.venuePayoutMethod.update({
            where: { id },
            data: { ...fields, isDefault },
          });
        }
      }
    } else {
      // Add new method — append to all venues
      const venues = await prisma.venue.findMany({
        where: { ownerId: userId },
        select: { id: true },
      });
      await prisma.venuePayoutMethod.createMany({
        data: venues.map((venue) => ({
          venueId: venue.id,
          ...fields,
          isDefault,
        })),
      });
    }

    const updatedVenue = await prisma.venue.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: "asc" },
      include: { payoutMethods: { orderBy: { addedAt: "asc" } } },
    });

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
      const venues = await prisma.venue.findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: "asc" },
        include: { payoutMethods: { orderBy: { addedAt: "asc" } } },
      });

      for (const venue of venues) {
        const target = venue.payoutMethods.find(
          (method) => method.id === methodId,
        );
        if (target) {
          await prisma.venuePayoutMethod.delete({
            where: { id: String(methodId) },
          });
        }

        // If the deleted method was default and there are remaining methods, set first as default
        const remaining = venue.payoutMethods.filter(
          (method) => method.id !== methodId,
        );
        if (remaining.length > 0 && !remaining.some((m) => m.isDefault)) {
          await prisma.venuePayoutMethod.update({
            where: { id: remaining[0]!.id },
            data: { isDefault: true },
          });
        }
      }

      const updatedVenue = await prisma.venue.findFirst({
        where: { ownerId: userId },
        orderBy: { createdAt: "asc" },
        include: { payoutMethods: { orderBy: { addedAt: "asc" } } },
      });

      res.json({
        success: true,
        message: "Payout method removed from all your venues",
        data: { payoutMethods: updatedVenue?.payoutMethods || [] },
      });
    } else {
      // Delete all methods from all venues
      const matchCount = await prisma.venue.count({
        where: { ownerId: userId },
      });

      if (matchCount === 0) {
        res
          .status(404)
          .json({ success: false, message: "No venue found for this account" });
        return;
      }

      await prisma.venuePayoutMethod.deleteMany({
        where: { venue: { ownerId: userId } },
      });

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

    const venues = await prisma.venue.findMany({
      where: { ownerId: userId },
      include: { payoutMethods: true },
    });
    if (venues.length === 0) {
      res
        .status(404)
        .json({ success: false, message: "No venue found for this account" });
      return;
    }

    let updated = false;
    for (const venue of venues) {
      const hasMethod = venue.payoutMethods.some(
        (method) => method.id === methodId,
      );

      if (hasMethod) {
        // Set all to non-default except the one being set
        await prisma.venuePayoutMethod.updateMany({
          where: { venueId: venue.id },
          data: { isDefault: false },
        });
        await prisma.venuePayoutMethod.update({
          where: { id: String(methodId) },
          data: { isDefault: true },
        });
        updated = true;
      }
    }

    if (!updated) {
      res
        .status(404)
        .json({ success: false, message: "Payout method not found" });
      return;
    }

    const updatedVenue = await prisma.venue.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: "asc" },
      include: { payoutMethods: { orderBy: { addedAt: "asc" } } },
    });

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

    const expert = await prisma.expert.findUnique({
      where: { userId },
      include: { payoutMethods: { orderBy: { addedAt: "asc" } } },
    });
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
        payoutMethod: getPrimaryPayoutMethod(expert.payoutMethods),
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

    const expert = await prisma.expert.findUnique({
      where: { userId },
      include: { payoutMethods: { orderBy: { addedAt: "asc" } } },
    });
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

    const expert = await prisma.expert.findUnique({
      where: { userId },
      include: { payoutMethods: { orderBy: { addedAt: "asc" } } },
    });
    if (!expert) {
      res
        .status(404)
        .json({ success: false, message: "Expert profile not found" });
      return;
    }

    const fields = buildPayoutFields(type, {
      accountHolderName,
      accountNumber,
      ifscCode,
      bankName,
      upiId,
    });

    if (id) {
      // Update existing method
      const existing = expert.payoutMethods.find((method) => method.id === id);
      if (!existing) {
        res
          .status(404)
          .json({ success: false, message: "Payout method not found" });
        return;
      }
      await prisma.expertPayoutMethod.update({
        where: { id },
        data: fields,
      });
    } else {
      // Add new method — first method is default.
      await prisma.expertPayoutMethod.create({
        data: {
          expertId: expert.id,
          ...fields,
          isDefault: expert.payoutMethods.length === 0,
        },
      });
    }

    const payoutMethods = await prisma.expertPayoutMethod.findMany({
      where: { expertId: expert.id },
      orderBy: { addedAt: "asc" },
    });

    res.json({
      success: true,
      message: "Payout method saved successfully",
      data: { payoutMethods },
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

    const expert = await prisma.expert.findUnique({
      where: { userId },
      include: { payoutMethods: { orderBy: { addedAt: "asc" } } },
    });
    if (!expert) {
      res
        .status(404)
        .json({ success: false, message: "Expert profile not found" });
      return;
    }

    if (methodId) {
      // Delete specific method
      const existing = expert.payoutMethods.find(
        (method) => method.id === methodId,
      );
      if (!existing) {
        res
          .status(404)
          .json({ success: false, message: "Payout method not found" });
        return;
      }

      await prisma.expertPayoutMethod.delete({
        where: { id: String(methodId) },
      });

      // If the deleted method was default and there are remaining methods, set first as default
      const remaining = await prisma.expertPayoutMethod.findMany({
        where: { expertId: expert.id },
        orderBy: { addedAt: "asc" },
      });
      if (remaining.length > 0 && !remaining.some((m) => m.isDefault)) {
        await prisma.expertPayoutMethod.update({
          where: { id: remaining[0]!.id },
          data: { isDefault: true },
        });
      }
    } else {
      // Delete all methods
      await prisma.expertPayoutMethod.deleteMany({
        where: { expertId: expert.id },
      });
    }

    const payoutMethods = await prisma.expertPayoutMethod.findMany({
      where: { expertId: expert.id },
      orderBy: { addedAt: "asc" },
    });

    res.json({
      success: true,
      message: "Payout method removed",
      data: { payoutMethods },
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

    const expert = await prisma.expert.findUnique({
      where: { userId },
      include: { payoutMethods: true },
    });
    if (!expert) {
      res
        .status(404)
        .json({ success: false, message: "Expert profile not found" });
      return;
    }

    const existing = expert.payoutMethods.find(
      (method) => method.id === methodId,
    );
    if (!existing) {
      res
        .status(404)
        .json({ success: false, message: "Payout method not found" });
      return;
    }

    // Set all to non-default except the one being set
    await prisma.expertPayoutMethod.updateMany({
      where: { expertId: expert.id },
      data: { isDefault: false },
    });
    await prisma.expertPayoutMethod.update({
      where: { id: String(methodId) },
      data: { isDefault: true },
    });

    const payoutMethods = await prisma.expertPayoutMethod.findMany({
      where: { expertId: expert.id },
      orderBy: { addedAt: "asc" },
    });

    res.json({
      success: true,
      message: "Default payout method updated",
      data: { payoutMethods },
    });
  } catch (error) {
    console.error("setExpertDefaultPayoutMethod error:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to set default payout method" });
  }
};

// AnyPayoutMethod is exported implicitly via the generic helper above; the
// named union is retained for potential local typing needs.
export type { AnyPayoutMethod };
