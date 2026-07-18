import { Request, Response } from "express";
import type { PayoutMethodType } from "@prisma/client";
import prisma from "../../lib/prisma";

/**
 * Builds the scalar column data for a payout method row from a request body.
 * Every column is set explicitly (unused fields -> null) so an UPDATE fully
 * replaces the row, mirroring the Mongo behaviour where the embedded method
 * object was swapped wholesale when the type changed.
 */
const buildMethodData = (
  body: Record<string, unknown>,
): {
  type: PayoutMethodType;
  accountHolderName: string | null;
  accountNumber: string | null;
  ifscCode: string | null;
  bankName: string | null;
  upiId: string | null;
} => {
  const type: PayoutMethodType =
    body.type === "UPI" ? "UPI" : "BANK_TRANSFER";

  if (type === "UPI") {
    return {
      type,
      accountHolderName: null,
      accountNumber: null,
      ifscCode: null,
      bankName: null,
      upiId: String(body.upiId || "").trim() || null,
    };
  }

  return {
    type,
    accountHolderName: String(body.accountHolderName || "").trim() || null,
    accountNumber: String(body.accountNumber || "").trim() || null,
    ifscCode: String(body.ifscCode || "").trim().toUpperCase() || null,
    bankName: String(body.bankName || "").trim() || null,
    upiId: null,
  };
};

const validateMethodPayload = (
  type: "BANK_TRANSFER" | "UPI",
  body: Record<string, unknown>,
): string | null => {
  if (type === "BANK_TRANSFER") {
    const accountHolderName = String(body.accountHolderName || "").trim();
    const accountNumber = String(body.accountNumber || "").trim();
    const ifscCode = String(body.ifscCode || "").trim();
    const bankName = String(body.bankName || "").trim();

    if (!accountHolderName || !accountNumber || !ifscCode || !bankName) {
      return "Bank transfer requires accountHolderName, accountNumber, ifscCode and bankName";
    }

    if (!/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(ifscCode.toUpperCase())) {
      return "Invalid IFSC code format";
    }
  }

  if (type === "UPI") {
    const upiId = String(body.upiId || "").trim();
    if (!upiId) {
      return "UPI transfer requires a valid UPI ID";
    }

    if (!/^[\w.\-+]+@[\w]+$/.test(upiId)) {
      return "Invalid UPI ID format";
    }
  }

  return null;
};

/**
 * If no coach payout method is marked default, promote the oldest one. Mirrors
 * the old `ensureDefaultMethod` helper that ran over the embedded array.
 */
const ensureCoachDefault = async (coachId: string): Promise<void> => {
  const methods = await prisma.coachPayoutMethod.findMany({
    where: { coachId },
    orderBy: { addedAt: "asc" },
  });
  if (methods.length === 0) {
    return;
  }
  if (methods.some((method) => method.isDefault)) {
    return;
  }
  await prisma.coachPayoutMethod.update({
    where: { id: methods[0]!.id },
    data: { isDefault: true },
  });
};

const ensureVenueDefault = async (venueId: string): Promise<void> => {
  const methods = await prisma.venuePayoutMethod.findMany({
    where: { venueId },
    orderBy: { addedAt: "asc" },
  });
  if (methods.length === 0) {
    return;
  }
  if (methods.some((method) => method.isDefault)) {
    return;
  }
  await prisma.venuePayoutMethod.update({
    where: { id: methods[0]!.id },
    data: { isDefault: true },
  });
};

const listCoachMethods = (coachId: string) =>
  prisma.coachPayoutMethod.findMany({
    where: { coachId },
    orderBy: { addedAt: "asc" },
  });

const listVenueMethods = (venueId: string) =>
  prisma.venuePayoutMethod.findMany({
    where: { venueId },
    orderBy: { addedAt: "asc" },
  });

/** Payout methods of the caller's primary (oldest) venue. */
const primaryVenueMethods = async (userId: string) => {
  const venue = await prisma.venue.findFirst({
    where: { ownerId: userId },
    orderBy: { createdAt: "asc" },
    select: { payoutMethods: { orderBy: { addedAt: "asc" } } },
  });
  return venue?.payoutMethods || [];
};

export const listCoachPayoutMethods = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const coach = await prisma.coach.findFirst({
      where: { userId },
      select: { payoutMethods: { orderBy: { addedAt: "asc" } } },
    });
    res.json({ success: true, data: coach?.payoutMethods || [] });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to load payout methods" });
  }
};

export const addCoachPayoutMethod = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const type = req.body.type === "UPI" ? "UPI" : "BANK_TRANSFER";
    const validationError = validateMethodPayload(
      type,
      req.body as Record<string, unknown>,
    );
    if (validationError) {
      res.status(400).json({ success: false, message: validationError });
      return;
    }

    const coach = await prisma.coach.findFirst({
      where: { userId },
      include: { payoutMethods: true },
    });
    if (!coach) {
      res
        .status(404)
        .json({ success: false, message: "Coach profile not found" });
      return;
    }

    const data = buildMethodData(req.body as Record<string, unknown>);
    const isDefault = (coach.payoutMethods || []).length === 0;

    await prisma.coachPayoutMethod.create({
      data: { ...data, coachId: coach.id, isDefault },
    });
    await ensureCoachDefault(coach.id);

    res.status(201).json({ success: true, data: await listCoachMethods(coach.id) });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to add payout method" });
  }
};

export const updateCoachPayoutMethod = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { methodId } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const coach = await prisma.coach.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (!coach) {
      res
        .status(404)
        .json({ success: false, message: "Coach profile not found" });
      return;
    }

    const existing = await prisma.coachPayoutMethod.findFirst({
      where: { id: methodId, coachId: coach.id },
    });
    if (!existing) {
      res
        .status(404)
        .json({ success: false, message: "Payout method not found" });
      return;
    }

    const validationError = validateMethodPayload(
      req.body.type === "UPI" ? "UPI" : "BANK_TRANSFER",
      req.body as Record<string, unknown>,
    );
    if (validationError) {
      res.status(400).json({ success: false, message: validationError });
      return;
    }

    // isDefault is intentionally not in the update payload -> it is preserved.
    const data = buildMethodData(req.body as Record<string, unknown>);
    await prisma.coachPayoutMethod.update({
      where: { id: methodId },
      data,
    });
    await ensureCoachDefault(coach.id);

    res.json({ success: true, data: await listCoachMethods(coach.id) });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to update payout method" });
  }
};

export const deleteCoachPayoutMethod = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { methodId } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const coach = await prisma.coach.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (!coach) {
      res
        .status(404)
        .json({ success: false, message: "Coach profile not found" });
      return;
    }

    await prisma.coachPayoutMethod.deleteMany({
      where: { id: methodId, coachId: coach.id },
    });
    await ensureCoachDefault(coach.id);

    res.json({ success: true, data: await listCoachMethods(coach.id) });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to delete payout method" });
  }
};

export const setDefaultCoachPayoutMethod = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { methodId } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const coach = await prisma.coach.findFirst({
      where: { userId },
      select: { id: true },
    });
    if (!coach) {
      res
        .status(404)
        .json({ success: false, message: "Coach profile not found" });
      return;
    }

    await prisma.$transaction([
      prisma.coachPayoutMethod.updateMany({
        where: { coachId: coach.id },
        data: { isDefault: false },
      }),
      prisma.coachPayoutMethod.updateMany({
        where: { coachId: coach.id, id: methodId },
        data: { isDefault: true },
      }),
    ]);

    res.json({ success: true, data: await listCoachMethods(coach.id) });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to set default payout method" });
  }
};

export const listVenuePayoutMethods = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    res.json({ success: true, data: await primaryVenueMethods(userId) });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to load payout methods" });
  }
};

export const addVenuePayoutMethod = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const type = req.body.type === "UPI" ? "UPI" : "BANK_TRANSFER";
    const validationError = validateMethodPayload(
      type,
      req.body as Record<string, unknown>,
    );
    if (validationError) {
      res.status(400).json({ success: false, message: validationError });
      return;
    }

    // A lister can own several venues; the payout method is duplicated onto each
    // (one row per venue), preserving the old multi-venue write behaviour.
    const venues = await prisma.venue.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "asc" },
      include: { payoutMethods: true },
    });
    if (venues.length === 0) {
      res
        .status(404)
        .json({ success: false, message: "No venues found for this account" });
      return;
    }

    const data = buildMethodData(req.body as Record<string, unknown>);
    const primaryVenue = venues[0]!;
    const isDefault = (primaryVenue.payoutMethods || []).length === 0;

    for (const venue of venues) {
      await prisma.venuePayoutMethod.create({
        data: { ...data, venueId: venue.id, isDefault },
      });
      await ensureVenueDefault(venue.id);
    }

    res.status(201).json({ success: true, data: await primaryVenueMethods(userId) });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to add payout method" });
  }
};

export const updateVenuePayoutMethod = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { methodId } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const venues = await prisma.venue.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (venues.length === 0) {
      res
        .status(404)
        .json({ success: false, message: "No venues found for this account" });
      return;
    }

    for (const venue of venues) {
      const existing = await prisma.venuePayoutMethod.findFirst({
        where: { id: methodId, venueId: venue.id },
      });
      if (!existing) {
        continue;
      }

      const validationError = validateMethodPayload(
        req.body.type === "UPI" ? "UPI" : "BANK_TRANSFER",
        req.body as Record<string, unknown>,
      );
      if (validationError) {
        res.status(400).json({ success: false, message: validationError });
        return;
      }

      const data = buildMethodData(req.body as Record<string, unknown>);
      await prisma.venuePayoutMethod.update({
        where: { id: methodId },
        data,
      });
      await ensureVenueDefault(venue.id);
    }

    res.json({ success: true, data: await primaryVenueMethods(userId) });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to update payout method" });
  }
};

export const deleteVenuePayoutMethod = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { methodId } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const venues = await prisma.venue.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (venues.length === 0) {
      res
        .status(404)
        .json({ success: false, message: "No venues found for this account" });
      return;
    }

    for (const venue of venues) {
      await prisma.venuePayoutMethod.deleteMany({
        where: { id: methodId, venueId: venue.id },
      });
      await ensureVenueDefault(venue.id);
    }

    res.json({ success: true, data: await primaryVenueMethods(userId) });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to delete payout method" });
  }
};

export const setDefaultVenuePayoutMethod = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = req.user?.id;
    const { methodId } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const venues = await prisma.venue.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    if (venues.length === 0) {
      res
        .status(404)
        .json({ success: false, message: "No venues found for this account" });
      return;
    }

    for (const venue of venues) {
      await prisma.$transaction([
        prisma.venuePayoutMethod.updateMany({
          where: { venueId: venue.id },
          data: { isDefault: false },
        }),
        prisma.venuePayoutMethod.updateMany({
          where: { venueId: venue.id, id: methodId },
          data: { isDefault: true },
        }),
      ]);
    }

    res.json({ success: true, data: await primaryVenueMethods(userId) });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to set default payout method" });
  }
};
