import { Request, Response } from "express";
import { Coach, IPayoutMethod } from "../../client/models/Coach";
import { Venue } from "../../client/models/Venue";

const getPrimaryMethod = (
  payoutMethods?: IPayoutMethod[],
): IPayoutMethod | null => {
  if (!payoutMethods || payoutMethods.length === 0) {
    return null;
  }

  return (
    payoutMethods.find((method) => method.isDefault) ?? payoutMethods[0] ?? null
  );
};

const normalizeBankMethod = (
  methodId: string | undefined,
  payload: {
    accountHolderName?: string;
    accountNumber?: string;
    ifscCode?: string;
    bankName?: string;
  },
  existing?: IPayoutMethod,
): IPayoutMethod => {
  const now = new Date();
  const method = {
    type: "BANK_TRANSFER",
    addedAt: existing?.addedAt ?? now,
    updatedAt: now,
    isDefault: existing?.isDefault ?? false,
  } as IPayoutMethod;

  const accountHolderName = payload.accountHolderName?.trim();
  const accountNumber = payload.accountNumber?.trim();
  const ifscCode = payload.ifscCode?.trim().toUpperCase();
  const bankName = payload.bankName?.trim();

  if (accountHolderName) {
    method.accountHolderName = accountHolderName;
  }
  if (accountNumber) {
    method.accountNumber = accountNumber;
  }
  if (ifscCode) {
    method.ifscCode = ifscCode;
  }
  if (bankName) {
    method.bankName = bankName;
  }

  if (methodId) {
    method.id = methodId;
  }

  return method;
};

const normalizeUpiMethod = (
  methodId: string | undefined,
  payload: { upiId?: string },
  existing?: IPayoutMethod,
): IPayoutMethod => {
  const now = new Date();
  const method = {
    type: "UPI",
    addedAt: existing?.addedAt ?? now,
    updatedAt: now,
    isDefault: existing?.isDefault ?? false,
  } as IPayoutMethod;

  const upiId = payload.upiId?.trim();
  if (upiId) {
    method.upiId = upiId;
  }

  if (methodId) {
    method.id = methodId;
  }

  return method;
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

const buildMethodFromBody = (
  body: Record<string, unknown>,
  existing?: IPayoutMethod,
): IPayoutMethod => {
  const type = body.type === "UPI" ? "UPI" : "BANK_TRANSFER";

  if (type === "UPI") {
    return normalizeUpiMethod(
      existing?.id,
      { upiId: String(body.upiId || "") },
      existing,
    );
  }

  return normalizeBankMethod(
    existing?.id,
    {
      accountHolderName: String(body.accountHolderName || ""),
      accountNumber: String(body.accountNumber || ""),
      ifscCode: String(body.ifscCode || ""),
      bankName: String(body.bankName || ""),
    },
    existing,
  );
};

const ensureDefaultMethod = (methods: IPayoutMethod[]): IPayoutMethod[] => {
  if (methods.length === 0) {
    return methods;
  }

  const hasDefault = methods.some((method) => method.isDefault);
  if (hasDefault) {
    return methods;
  }

  methods[0]!.isDefault = true;
  return methods;
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

    const coach = await Coach.findOne({ userId })
      .select("payoutMethods")
      .lean();
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

    const coach = await Coach.findOne({ userId });
    if (!coach) {
      res
        .status(404)
        .json({ success: false, message: "Coach profile not found" });
      return;
    }

    const methods = ensureDefaultMethod(coach.payoutMethods || []);
    const nextMethod = buildMethodFromBody(req.body as Record<string, unknown>);
    nextMethod.isDefault = methods.length === 0;

    coach.payoutMethods = [...methods, nextMethod] as IPayoutMethod[];
    await coach.save();

    res.status(201).json({ success: true, data: coach.payoutMethods });
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

    const coach = await Coach.findOne({ userId });
    if (!coach) {
      res
        .status(404)
        .json({ success: false, message: "Coach profile not found" });
      return;
    }

    const existing = (coach.payoutMethods || []).find(
      (method) => method.id === methodId,
    );
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

    const updated = buildMethodFromBody(
      req.body as Record<string, unknown>,
      existing,
    );
    updated.isDefault = existing.isDefault ?? false;

    coach.payoutMethods = (coach.payoutMethods || []).map((method) =>
      method.id === methodId ? updated : method,
    );
    coach.payoutMethods = ensureDefaultMethod(coach.payoutMethods);
    await coach.save();

    res.json({ success: true, data: coach.payoutMethods });
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

    const coach = await Coach.findOne({ userId });
    if (!coach) {
      res
        .status(404)
        .json({ success: false, message: "Coach profile not found" });
      return;
    }

    coach.payoutMethods = (coach.payoutMethods || []).filter(
      (method) => method.id !== methodId,
    );
    coach.payoutMethods = ensureDefaultMethod(coach.payoutMethods);
    await coach.save();

    res.json({ success: true, data: coach.payoutMethods });
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

    const coach = await Coach.findOne({ userId });
    if (!coach) {
      res
        .status(404)
        .json({ success: false, message: "Coach profile not found" });
      return;
    }

    coach.payoutMethods = (coach.payoutMethods || []).map((method) => ({
      ...method,
      isDefault: method.id === methodId,
    }));
    await coach.save();

    res.json({ success: true, data: coach.payoutMethods });
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

    const venue = await Venue.findOne({ ownerId: userId })
      .sort({ createdAt: 1 })
      .select("payoutMethods")
      .lean();
    res.json({ success: true, data: venue?.payoutMethods || [] });
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

    const venues = await Venue.find({ ownerId: userId }).sort({ createdAt: 1 });
    if (venues.length === 0) {
      res
        .status(404)
        .json({ success: false, message: "No venues found for this account" });
      return;
    }

    const nextMethod = buildMethodFromBody(req.body as Record<string, unknown>);
    const primaryVenue = venues[0]!;
    nextMethod.isDefault = (primaryVenue.payoutMethods || []).length === 0;

    await Promise.all(
      venues.map(async (venue) => {
        venue.payoutMethods = [...(venue.payoutMethods || []), nextMethod];
        venue.payoutMethods = ensureDefaultMethod(venue.payoutMethods);
        await venue.save();
      }),
    );

    res.status(201).json({ success: true, data: primaryVenue.payoutMethods });
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

    const venues = await Venue.find({ ownerId: userId });
    if (venues.length === 0) {
      res
        .status(404)
        .json({ success: false, message: "No venues found for this account" });
      return;
    }

    for (const venue of venues) {
      const existing = (venue.payoutMethods || []).find(
        (method) => method.id === methodId,
      );
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

      const updated = buildMethodFromBody(
        req.body as Record<string, unknown>,
        existing,
      );
      updated.isDefault = existing.isDefault ?? false;

      venue.payoutMethods = (venue.payoutMethods || []).map((method) =>
        method.id === methodId ? updated : method,
      );
      venue.payoutMethods = ensureDefaultMethod(venue.payoutMethods);
      await venue.save();
    }

    res.json({
      success: true,
      data:
        (
          await Venue.findOne({ ownerId: userId })
            .sort({ createdAt: 1 })
            .select("payoutMethods")
            .lean()
        )?.payoutMethods || [],
    });
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

    const venues = await Venue.find({ ownerId: userId });
    if (venues.length === 0) {
      res
        .status(404)
        .json({ success: false, message: "No venues found for this account" });
      return;
    }

    for (const venue of venues) {
      venue.payoutMethods = (venue.payoutMethods || []).filter(
        (method) => method.id !== methodId,
      );
      venue.payoutMethods = ensureDefaultMethod(venue.payoutMethods);
      await venue.save();
    }

    res.json({
      success: true,
      data:
        (
          await Venue.findOne({ ownerId: userId })
            .sort({ createdAt: 1 })
            .select("payoutMethods")
            .lean()
        )?.payoutMethods || [],
    });
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

    const venues = await Venue.find({ ownerId: userId });
    if (venues.length === 0) {
      res
        .status(404)
        .json({ success: false, message: "No venues found for this account" });
      return;
    }

    for (const venue of venues) {
      venue.payoutMethods = (venue.payoutMethods || []).map((method) => ({
        ...method,
        isDefault: method.id === methodId,
      }));
      await venue.save();
    }

    res.json({
      success: true,
      data:
        (
          await Venue.findOne({ ownerId: userId })
            .sort({ createdAt: 1 })
            .select("payoutMethods")
            .lean()
        )?.payoutMethods || [],
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to set default payout method" });
  }
};
