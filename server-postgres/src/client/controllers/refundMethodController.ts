import { Request, Response } from "express";
import prisma from "../../lib/prisma";
import type { RefundMethod } from "@prisma/client";

type RefundMethodType = "ORIGINAL_CARD" | "BANK_ACCOUNT" | "STORE_CREDIT";

interface RefundMethodRecord {
  id?: string;
  type: RefundMethodType;
  accountHolderName?: string;
  accountNumber?: string;
  ifscCode?: string;
  bankName?: string;
  isDefault?: boolean;
  addedAt?: Date;
  updatedAt?: Date;
}

const toMethodRecord = (
  payload: Record<string, unknown>,
  existing?: RefundMethodRecord,
): RefundMethodRecord => {
  const now = new Date();
  const type =
    payload.type === "STORE_CREDIT"
      ? "STORE_CREDIT"
      : payload.type === "BANK_ACCOUNT"
        ? "BANK_ACCOUNT"
        : "ORIGINAL_CARD";

  const method: RefundMethodRecord = {
    type,
    addedAt: existing?.addedAt ?? now,
    updatedAt: now,
    isDefault: existing?.isDefault ?? false,
  };

  if (type === "BANK_ACCOUNT") {
    method.accountHolderName = String(payload.accountHolderName || "").trim();
    method.accountNumber = String(payload.accountNumber || "").trim();
    method.ifscCode = String(payload.ifscCode || "")
      .trim()
      .toUpperCase();
    method.bankName = String(payload.bankName || "").trim();
  }

  if (payload.id && typeof payload.id === "string") {
    method.id = payload.id;
  } else if (existing?.id) {
    method.id = existing.id;
  }

  return method;
};

const validateRefundMethod = (body: Record<string, unknown>): string | null => {
  const type =
    body.type === "STORE_CREDIT"
      ? "STORE_CREDIT"
      : body.type === "BANK_ACCOUNT"
        ? "BANK_ACCOUNT"
        : body.type === "ORIGINAL_CARD"
          ? "ORIGINAL_CARD"
          : null;

  if (!type) {
    return "type must be ORIGINAL_CARD, BANK_ACCOUNT, or STORE_CREDIT";
  }

  if (type === "BANK_ACCOUNT") {
    const accountHolderName = String(body.accountHolderName || "").trim();
    const accountNumber = String(body.accountNumber || "").trim();
    const ifscCode = String(body.ifscCode || "").trim();

    if (!accountHolderName || !accountNumber || !ifscCode) {
      return "BANK_ACCOUNT requires accountHolderName, accountNumber and ifscCode";
    }

    if (!/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(ifscCode.toUpperCase())) {
      return "Invalid IFSC code format";
    }
  }

  return null;
};

const getUserId = (req: Request): string | undefined => req.user?.id;

const listMethods = (userId: string): Promise<RefundMethod[]> =>
  prisma.refundMethod.findMany({
    where: { userId },
    orderBy: { addedAt: "asc" },
  });

export const listRefundMethods = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const methods = await listMethods(userId);
    res.json({ success: true, data: methods });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to load refund methods" });
  }
};

export const addRefundMethod = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const validationError = validateRefundMethod(
      req.body as Record<string, unknown>,
    );
    if (validationError) {
      res.status(400).json({ success: false, message: validationError });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    const existing = await listMethods(userId);
    const nextMethod = toMethodRecord(req.body as Record<string, unknown>);
    const makeDefault = existing.length === 0;

    await prisma.$transaction(async (tx) => {
      // normalizeMethods(): guarantee an existing default before appending.
      if (existing.length > 0 && !existing.some((m) => m.isDefault)) {
        await tx.refundMethod.update({
          where: { id: existing[0]!.id },
          data: { isDefault: true },
        });
      }

      await tx.refundMethod.create({
        data: {
          userId,
          type: nextMethod.type,
          accountHolderName: nextMethod.accountHolderName ?? null,
          accountNumber: nextMethod.accountNumber ?? null,
          ifscCode: nextMethod.ifscCode ?? null,
          bankName: nextMethod.bankName ?? null,
          isDefault: makeDefault,
        },
      });
    });

    const methods = await listMethods(userId);
    res.status(201).json({ success: true, data: methods });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to add refund method" });
  }
};

export const updateRefundMethod = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req);
    const { methodId } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const validationError = validateRefundMethod(
      req.body as Record<string, unknown>,
    );
    if (validationError) {
      res.status(400).json({ success: false, message: validationError });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    const existing = await prisma.refundMethod.findFirst({
      where: { id: methodId, userId },
    });
    if (!existing) {
      res
        .status(404)
        .json({ success: false, message: "Refund method not found" });
      return;
    }

    const updated = toMethodRecord(
      req.body as Record<string, unknown>,
      existing as unknown as RefundMethodRecord,
    );
    updated.isDefault = existing.isDefault ?? false;

    await prisma.refundMethod.update({
      where: { id: methodId },
      data: {
        type: updated.type,
        accountHolderName: updated.accountHolderName ?? null,
        accountNumber: updated.accountNumber ?? null,
        ifscCode: updated.ifscCode ?? null,
        bankName: updated.bankName ?? null,
        isDefault: updated.isDefault,
      },
    });

    const methods = await listMethods(userId);
    res.json({ success: true, data: methods });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to update refund method" });
  }
};

export const deleteRefundMethod = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req);
    const { methodId } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    await prisma.$transaction(async (tx) => {
      await tx.refundMethod.deleteMany({ where: { id: methodId, userId } });

      // normalizeMethods(): if any remain but none is default, promote the first.
      const remaining = await tx.refundMethod.findMany({
        where: { userId },
        orderBy: { addedAt: "asc" },
      });
      if (remaining.length > 0 && !remaining.some((m) => m.isDefault)) {
        await tx.refundMethod.update({
          where: { id: remaining[0]!.id },
          data: { isDefault: true },
        });
      }
    });

    const methods = await listMethods(userId);
    res.json({ success: true, data: methods });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to delete refund method" });
  }
};

export const setDefaultRefundMethod = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const userId = getUserId(req);
    const { methodId } = req.params;

    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    // Setting a new default → unset every other method, then set the target.
    await prisma.$transaction([
      prisma.refundMethod.updateMany({
        where: { userId, id: { not: methodId } },
        data: { isDefault: false },
      }),
      prisma.refundMethod.updateMany({
        where: { userId, id: methodId },
        data: { isDefault: true },
      }),
    ]);

    const methods = await listMethods(userId);
    res.json({ success: true, data: methods });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to set default refund method" });
  }
};
