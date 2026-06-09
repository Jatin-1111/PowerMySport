import { Request, Response } from "express";
import { User, UserDocument } from "../models/User";

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

const normalizeMethods = (
  methods: RefundMethodRecord[] = [],
): RefundMethodRecord[] => {
  if (methods.length === 0) {
    return methods;
  }

  if (methods.some((method) => method.isDefault)) {
    return methods;
  }

  methods[0]!.isDefault = true;
  return methods;
};

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

    const user = await User.findById(userId).select("refundMethods").lean();
    res.json({ success: true, data: user?.refundMethods || [] });
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

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    const methods = normalizeMethods(
      (user.refundMethods || []) as RefundMethodRecord[],
    );
    const nextMethod = toMethodRecord(req.body as Record<string, unknown>);
    nextMethod.isDefault = methods.length === 0;

    user.refundMethods = [...methods, nextMethod] as NonNullable<
      UserDocument["refundMethods"]
    >;
    await user.save();

    res.status(201).json({ success: true, data: user.refundMethods || [] });
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

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    const existing = (user.refundMethods || []).find(
      (method) => method.id === methodId,
    );
    if (!existing) {
      res
        .status(404)
        .json({ success: false, message: "Refund method not found" });
      return;
    }

    const updated = toMethodRecord(
      req.body as Record<string, unknown>,
      existing as RefundMethodRecord,
    );
    updated.isDefault = existing.isDefault ?? false;

    user.refundMethods = (user.refundMethods || []).map((method) =>
      method.id === methodId ? updated : method,
    ) as NonNullable<UserDocument["refundMethods"]>;
    await user.save();

    res.json({ success: true, data: user.refundMethods || [] });
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

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    user.refundMethods = (user.refundMethods || []).filter(
      (method) => method.id !== methodId,
    ) as NonNullable<UserDocument["refundMethods"]>;
    user.refundMethods = normalizeMethods(
      (user.refundMethods || []) as RefundMethodRecord[],
    ) as NonNullable<UserDocument["refundMethods"]>;
    await user.save();

    res.json({ success: true, data: user.refundMethods || [] });
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

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    user.refundMethods = (user.refundMethods || []).map((method) => ({
      ...method,
      isDefault: method.id === methodId,
    })) as NonNullable<UserDocument["refundMethods"]>;
    await user.save();

    res.json({ success: true, data: user.refundMethods || [] });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to set default refund method" });
  }
};
