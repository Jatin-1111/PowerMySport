import { Request, Response } from "express";
import { Coach, IPayoutMethod } from "../../client/models/Coach";
import { Venue } from "../../client/models/Venue";
import { Expert } from "../../client/models/ExpertProfile";
import { encryptValue, decryptValue } from "../../shared/utils/encryption";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AppError } from "../../utils/AppError";

type PayoutMethodRecord = IPayoutMethod & {
  _id?: unknown;
};

/**
 * These endpoints read/write via a mix of `.lean()` queries, `.save()`, and
 * direct `$push`/`updateMany` operations — only `.save()` on a hydrated
 * document runs the models' schema-level getters/pre("save") encryption
 * hook. To stay correct regardless of which write path a given function
 * uses, sensitive fields are encrypted explicitly right where a payout
 * method is constructed, and decrypted explicitly right before every
 * response — not left to those hooks/getters to happen to cover it.
 */
// exactOptionalPropertyTypes forbids assigning `string | undefined` to an
// optional `string` field — only overwrite when there's an actual value.
const encryptPayoutMethodFields = (m: IPayoutMethod): IPayoutMethod => {
  const out: IPayoutMethod = { ...m };
  if (out.accountNumber) out.accountNumber = encryptValue(out.accountNumber);
  if (out.ifscCode) out.ifscCode = encryptValue(out.ifscCode);
  if (out.upiId) out.upiId = encryptValue(out.upiId);
  return out;
};
const decryptPayoutMethod = (m: IPayoutMethod): IPayoutMethod => {
  // `m` is a plain object when it came from a .lean() query, but a live
  // Mongoose subdocument when it came straight off a just-.save()'d document
  // (as in the upsert/delete/set-default responses below) — spreading THAT
  // directly would capture Mongoose's internal bookkeeping ($__, _doc, etc.)
  // as if they were data fields. .toObject() normalizes either case to a
  // clean plain object first.
  const plain =
    typeof (m as unknown as { toObject?: () => IPayoutMethod }).toObject === "function"
      ? (m as unknown as { toObject: () => IPayoutMethod }).toObject()
      : m;
  const out: IPayoutMethod = { ...plain };
  if (out.accountNumber) out.accountNumber = decryptValue(out.accountNumber);
  if (out.ifscCode) out.ifscCode = decryptValue(out.ifscCode);
  if (out.upiId) out.upiId = decryptValue(out.upiId);
  return out;
};

const getPayoutMethodId = (method: PayoutMethodRecord): string | undefined => {
  if (method.id) {
    return method.id.toString();
  }

  if (typeof method._id === "string") {
    return method._id;
  }

  if (method._id && typeof method._id === "object" && "toString" in method._id) {
    return method._id.toString();
  }

  return undefined;
};

const getPrimaryPayoutMethod = (payoutMethods?: IPayoutMethod[]): IPayoutMethod | null => {
  if (!payoutMethods || payoutMethods.length === 0) {
    return null;
  }

  return payoutMethods.find((method) => method.isDefault) ?? payoutMethods[0] ?? null;
};

// ============================================
// COACH PAYOUT METHODS
// ============================================

/**
 * GET /api/payouts/coach/my-payout-method
 * Get the current coach's saved payout method
 */
export const getCoachPayoutMethod = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const coach = await Coach.findOne({ userId }).select("payoutMethods").lean();
    if (!coach) {
      throw new AppError("Coach profile not found", 404);
    }

    const primary = getPrimaryPayoutMethod(coach.payoutMethods as IPayoutMethod[] | undefined);
    res.json({
      success: true,
      message: "Payout method retrieved",
      data: {
        payoutMethod: primary ? decryptPayoutMethod(primary) : null,
      },
    });
  }
);

/**
 * GET /api/payouts/coach/my-payout-methods
 * Get all of the current coach's saved payout methods
 */
export const getCoachPayoutMethods = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const coach = await Coach.findOne({ userId }).select("payoutMethods").lean();
    if (!coach) {
      throw new AppError("Coach profile not found", 404);
    }

    res.json({
      success: true,
      message: "Payout methods retrieved",
      data: {
        payoutMethods: (coach.payoutMethods || []).map((m: IPayoutMethod) =>
          decryptPayoutMethod(m)
        ),
      },
    });
  }
);

/**
 * PUT /api/payouts/coach/my-payout-method
 * Save or update the current coach's payout method (add new or update existing)
 */
export const upsertCoachPayoutMethod = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const { id, type, accountHolderName, accountNumber, ifscCode, bankName, upiId } = req.body as {
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
      throw new AppError("Invalid payout method type. Must be BANK_TRANSFER or UPI.", 400);
    }

    if (type === "BANK_TRANSFER") {
      if (
        !accountHolderName?.trim() ||
        !accountNumber?.trim() ||
        !ifscCode?.trim() ||
        !bankName?.trim()
      ) {
        throw new AppError(
          "Bank transfer requires: accountHolderName, accountNumber, ifscCode, bankName",
          400
        );
      }
      // Validate IFSC format (basic)
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.toUpperCase().trim())) {
        throw new AppError("Invalid IFSC code format (e.g., SBIN0001234)", 400);
      }
    }

    if (type === "UPI") {
      if (!upiId?.trim()) {
        throw new AppError("UPI method requires a valid UPI ID", 400);
      }
      // Basic UPI ID validation
      if (!/^[\w.\-+]+@[\w]+$/.test(upiId.trim())) {
        throw new AppError("Invalid UPI ID format (e.g., yourname@okaxis)", 400);
      }
    }

    const now = new Date();
    const coach = await Coach.findOne({ userId });
    if (!coach) {
      throw new AppError("Coach profile not found", 404);
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
    const encryptedPayoutMethodData = encryptPayoutMethodFields(payoutMethodData);

    if (id) {
      // Update existing method
      const methodIndex = payoutMethods.findIndex(
        (method) => getPayoutMethodId(method as PayoutMethodRecord) === id
      );
      if (methodIndex === -1) {
        throw new AppError("Payout method not found", 404);
      }
      encryptedPayoutMethodData.id = id;
      encryptedPayoutMethodData.addedAt = payoutMethods[methodIndex]!.addedAt;
      payoutMethods[methodIndex] = encryptedPayoutMethodData;
    } else {
      // Add new method
      payoutMethods.push(encryptedPayoutMethodData);
    }

    coach.payoutMethods = payoutMethods;

    await coach.save();

    res.json({
      success: true,
      message: "Payout method saved successfully",
      data: {
        payoutMethods: (coach.payoutMethods || []).map((m: IPayoutMethod) =>
          decryptPayoutMethod(m)
        ),
      },
    });
  }
);

/**
 * DELETE /api/payouts/coach/my-payout-method/:methodId
 * Remove a specific payout method by ID (or all if no ID provided)
 */
export const deleteCoachPayoutMethod = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const { methodId } = req.params;

    const coach = await Coach.findOne({ userId });
    if (!coach) {
      throw new AppError("Coach profile not found", 404);
    }

    const payoutMethods = coach.payoutMethods ?? [];

    if (methodId) {
      // Delete specific method
      const initialLength = payoutMethods.length;
      coach.payoutMethods = payoutMethods.filter(
        (method) => getPayoutMethodId(method as PayoutMethodRecord) !== methodId
      );

      if ((coach.payoutMethods ?? []).length === initialLength) {
        throw new AppError("Payout method not found", 404);
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
      data: {
        payoutMethods: (coach.payoutMethods || []).map((m: IPayoutMethod) =>
          decryptPayoutMethod(m)
        ),
      },
    });
  }
);

/**
 * PUT /api/payouts/coach/my-payout-method/:methodId/set-default
 * Set a specific payout method as the default
 */
export const setCoachDefaultPayoutMethod = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const { methodId } = req.params;

    const coach = await Coach.findOne({ userId });
    if (!coach) {
      throw new AppError("Coach profile not found", 404);
    }

    const methods = coach.payoutMethods || [];
    const methodIndex = methods.findIndex(
      (method) => getPayoutMethodId(method as PayoutMethodRecord) === methodId
    );

    if (methodIndex === -1) {
      throw new AppError("Payout method not found", 404);
    }

    // Set all to non-default except the one being set
    methods.forEach((m, idx) => {
      m.isDefault = idx === methodIndex;
    });

    await coach.save();

    res.json({
      success: true,
      message: "Default payout method updated",
      data: {
        payoutMethods: (coach.payoutMethods || []).map((m: IPayoutMethod) =>
          decryptPayoutMethod(m)
        ),
      },
    });
  }
);

// ============================================
// VENUE OWNER PAYOUT METHODS
// ============================================

/**
 * GET /api/payouts/venue/my-payout-method
 * Get the venue owner's payout method (for their primary venue)
 */
export const getVenuePayoutMethod = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const venue = await Venue.findOne({ ownerId: userId })
      .sort({ createdAt: 1 })
      .select("payoutMethods name")
      .lean();

    if (!venue) {
      throw new AppError("No venue found for this account", 404);
    }

    const primary = getPrimaryPayoutMethod(venue.payoutMethods as IPayoutMethod[] | undefined);
    res.json({
      success: true,
      message: "Payout method retrieved",
      data: {
        payoutMethod: primary ? decryptPayoutMethod(primary) : null,
        venueName: venue.name,
      },
    });
  }
);

/**
 * PUT /api/payouts/venue/my-payout-method
 * Save or update payout method for a venue owner (applies to all their venues)
 */
export const upsertVenuePayoutMethod = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const { id, type, accountHolderName, accountNumber, ifscCode, bankName, upiId } = req.body as {
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
      throw new AppError("Invalid payout method type. Must be BANK_TRANSFER or UPI.", 400);
    }

    if (type === "BANK_TRANSFER") {
      if (
        !accountHolderName?.trim() ||
        !accountNumber?.trim() ||
        !ifscCode?.trim() ||
        !bankName?.trim()
      ) {
        throw new AppError(
          "Bank transfer requires: accountHolderName, accountNumber, ifscCode, bankName",
          400
        );
      }
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.toUpperCase().trim())) {
        throw new AppError("Invalid IFSC code format (e.g., SBIN0001234)", 400);
      }
    }

    if (type === "UPI") {
      if (!upiId?.trim()) {
        throw new AppError("UPI method requires a valid UPI ID", 400);
      }
      if (!/^[\w.\-+]+@[\w]+$/.test(upiId.trim())) {
        throw new AppError("Invalid UPI ID format (e.g., yourname@okaxis)", 400);
      }
    }

    // Find the first venue to get the current addedAt
    const existingVenue = await Venue.findOne({ ownerId: userId })
      .sort({ createdAt: 1 })
      .select("payoutMethods");

    if (!existingVenue) {
      throw new AppError("No venue found for this account", 404);
    }

    const now = new Date();
    const payoutMethodData: IPayoutMethod = {
      type,
      addedAt: now,
      updatedAt: now,
      isDefault: !existingVenue.payoutMethods || existingVenue.payoutMethods.length === 0, // First method is default
    };

    if (type === "BANK_TRANSFER") {
      payoutMethodData.accountHolderName = accountHolderName!.trim();
      payoutMethodData.accountNumber = accountNumber!.trim();
      payoutMethodData.ifscCode = ifscCode!.trim().toUpperCase();
      payoutMethodData.bankName = bankName!.trim();
    } else {
      payoutMethodData.upiId = upiId!.trim();
    }
    // Encrypted once here, up front — the two branches below write via
    // different Mongoose mechanisms (.save() vs. a raw $push/updateMany),
    // and only the former runs the model's schema-level encryption hook.
    const encryptedPayoutMethodData = encryptPayoutMethodFields(payoutMethodData);

    // Apply to all venues owned by this user
    if (id) {
      // Update existing method - use a more complex update
      // First, update all venues' payout methods
      const venues = await Venue.find({ ownerId: userId });
      for (const venue of venues) {
        const venueMethods = venue.payoutMethods ?? [];
        const methodIndex = venueMethods.findIndex(
          (method) => getPayoutMethodId(method as PayoutMethodRecord) === id
        );
        if (methodIndex !== -1) {
          encryptedPayoutMethodData.id = id;
          encryptedPayoutMethodData.addedAt = venueMethods[methodIndex]!.addedAt;
          venueMethods[methodIndex] = encryptedPayoutMethodData;
          venue.payoutMethods = venueMethods;
          await venue.save();
        }
      }
    } else {
      // Add new method - append to all venues
      await Venue.updateMany(
        { ownerId: userId },
        { $push: { payoutMethods: encryptedPayoutMethodData } }
      );
    }

    const updatedVenue = await Venue.findOne({ ownerId: userId })
      .sort({ createdAt: 1 })
      .select("payoutMethods");

    res.json({
      success: true,
      message: "Payout method saved successfully for all your venues",
      data: {
        payoutMethods: (updatedVenue?.payoutMethods || []).map((m: IPayoutMethod) =>
          decryptPayoutMethod(m)
        ),
      },
    });
  }
);

/**
 * DELETE /api/payouts/venue/my-payout-method/:methodId
 * Remove a specific payout method from all venues (or all if no ID provided)
 */
export const deleteVenuePayoutMethod = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const { methodId } = req.params;

    if (methodId) {
      // Delete specific method from all venues
      const venues = await Venue.find({ ownerId: userId });
      for (const venue of venues) {
        const venueMethods = venue.payoutMethods ?? [];
        const initialLength = venueMethods.length;
        venue.payoutMethods = venueMethods.filter(
          (method) => getPayoutMethodId(method as PayoutMethodRecord) !== methodId
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
        data: {
          payoutMethods: (updatedVenue?.payoutMethods || []).map((m: IPayoutMethod) =>
            decryptPayoutMethod(m)
          ),
        },
      });
    } else {
      // Delete all methods from all venues
      const result = await Venue.updateMany({ ownerId: userId }, { $set: { payoutMethods: [] } });

      if (result.matchedCount === 0) {
        throw new AppError("No venue found for this account", 404);
      }

      res.json({
        success: true,
        message: "All payout methods removed from your venues",
        data: { payoutMethods: [] },
      });
    }
  }
);

/**
 * PUT /api/payouts/venue/my-payout-method/:methodId/set-default
 * Set a specific payout method as the default for all venues
 */
export const setVenueDefaultPayoutMethod = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const { methodId } = req.params;

    const venues = await Venue.find({ ownerId: userId });
    if (venues.length === 0) {
      throw new AppError("No venue found for this account", 404);
    }

    let updated = false;
    for (const venue of venues) {
      const methodIndex = (venue.payoutMethods || []).findIndex(
        (method) => getPayoutMethodId(method as PayoutMethodRecord) === methodId
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
      throw new AppError("Payout method not found", 404);
    }

    const updatedVenue = await Venue.findOne({ ownerId: userId })
      .sort({ createdAt: 1 })
      .select("payoutMethods");

    res.json({
      success: true,
      message: "Default payout method updated for all your venues",
      data: {
        payoutMethods: (updatedVenue?.payoutMethods || []).map((m: IPayoutMethod) =>
          decryptPayoutMethod(m)
        ),
      },
    });
  }
);

// ============================================
// EXPERT PAYOUT METHODS
// ============================================

/**
 * GET /api/payouts/expert/my-payout-method
 * Get the current expert's saved payout method
 */
export const getExpertPayoutMethod = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const expert = await Expert.findOne({ userId }).select("payoutMethods").lean();
    if (!expert) {
      throw new AppError("Expert profile not found", 404);
    }

    const primary = getPrimaryPayoutMethod(expert.payoutMethods as IPayoutMethod[] | undefined);
    res.json({
      success: true,
      message: "Payout method retrieved",
      data: {
        payoutMethod: primary ? decryptPayoutMethod(primary) : null,
      },
    });
  }
);

/**
 * GET /api/payouts/expert/my-payout-methods
 * Get all of the current expert's saved payout methods
 */
export const getExpertPayoutMethods = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const expert = await Expert.findOne({ userId }).select("payoutMethods").lean();
    if (!expert) {
      throw new AppError("Expert profile not found", 404);
    }

    res.json({
      success: true,
      message: "Payout methods retrieved",
      data: {
        payoutMethods: (expert.payoutMethods || []).map((m: IPayoutMethod) =>
          decryptPayoutMethod(m)
        ),
      },
    });
  }
);

/**
 * PUT /api/payouts/expert/my-payout-method
 * Save or update the current expert's payout method (add new or update existing)
 */
export const upsertExpertPayoutMethod = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const { id, type, accountHolderName, accountNumber, ifscCode, bankName, upiId } = req.body as {
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
      throw new AppError("Invalid payout method type. Must be BANK_TRANSFER or UPI.", 400);
    }

    if (type === "BANK_TRANSFER") {
      if (
        !accountHolderName?.trim() ||
        !accountNumber?.trim() ||
        !ifscCode?.trim() ||
        !bankName?.trim()
      ) {
        throw new AppError(
          "Bank transfer requires: accountHolderName, accountNumber, ifscCode, bankName",
          400
        );
      }
      // Validate IFSC format (basic)
      if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.toUpperCase().trim())) {
        throw new AppError("Invalid IFSC code format (e.g., SBIN0001234)", 400);
      }
    }

    if (type === "UPI") {
      if (!upiId?.trim()) {
        throw new AppError("UPI method requires a valid UPI ID", 400);
      }
      // Basic UPI ID validation
      if (!/^[\w.\-+]+@[\w]+$/.test(upiId.trim())) {
        throw new AppError("Invalid UPI ID format (e.g., yourname@okaxis)", 400);
      }
    }

    const now = new Date();
    const expert = await Expert.findOne({ userId });
    if (!expert) {
      throw new AppError("Expert profile not found", 404);
    }
    // Payout details can be captured while onboarding (UNVERIFIED/REJECTED,
    // so an admin has something concrete to review alongside the rest of the
    // profile — see the Tax & Payout onboarding step) or edited freely once
    // APPROVED via the dashboard. The one state that must stay locked is
    // PENDING: the expert has already submitted for review and every other
    // field is frozen until an admin acts (see submitExpertForReview).
    if (expert.verificationStatus === "PENDING") {
      throw new AppError(
        "Your profile is awaiting review — payout details can't be changed until it's reviewed.",
        403
      );
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
    const encryptedPayoutMethodData = encryptPayoutMethodFields(payoutMethodData);

    if (id) {
      // Update existing method
      const methodIndex = payoutMethods.findIndex(
        (method: IPayoutMethod) => getPayoutMethodId(method as PayoutMethodRecord) === id
      );
      if (methodIndex === -1) {
        throw new AppError("Payout method not found", 404);
      }
      encryptedPayoutMethodData.id = id;
      encryptedPayoutMethodData.addedAt = payoutMethods[methodIndex]!.addedAt;
      payoutMethods[methodIndex] = encryptedPayoutMethodData;
    } else {
      // Add new method
      payoutMethods.push(encryptedPayoutMethodData);
    }

    expert.payoutMethods = payoutMethods;

    await expert.save();

    res.json({
      success: true,
      message: "Payout method saved successfully",
      data: {
        payoutMethods: (expert.payoutMethods || []).map((m: IPayoutMethod) =>
          decryptPayoutMethod(m)
        ),
      },
    });
  }
);

/**
 * DELETE /api/payouts/expert/my-payout-method/:methodId
 * Remove a specific payout method by ID (or all if no ID provided)
 */
export const deleteExpertPayoutMethod = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const { methodId } = req.params;

    const expert = await Expert.findOne({ userId });
    if (!expert) {
      throw new AppError("Expert profile not found", 404);
    }

    const payoutMethods = expert.payoutMethods ?? [];

    if (methodId) {
      // Delete specific method
      const initialLength = payoutMethods.length;
      expert.payoutMethods = payoutMethods.filter(
        (method: IPayoutMethod) => getPayoutMethodId(method as PayoutMethodRecord) !== methodId
      );

      if ((expert.payoutMethods ?? []).length === initialLength) {
        throw new AppError("Payout method not found", 404);
      }

      // If the deleted method was default and there are remaining methods, set first as default
      if (
        !expert.payoutMethods.some((method: IPayoutMethod) => method.isDefault) &&
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
      data: {
        payoutMethods: (expert.payoutMethods || []).map((m: IPayoutMethod) =>
          decryptPayoutMethod(m)
        ),
      },
    });
  }
);

/**
 * PUT /api/payouts/expert/my-payout-method/:methodId/set-default
 * Set a specific payout method as the default
 */
export const setExpertDefaultPayoutMethod = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const { methodId } = req.params;

    const expert = await Expert.findOne({ userId });
    if (!expert) {
      throw new AppError("Expert profile not found", 404);
    }

    const methods = expert.payoutMethods || [];
    const methodIndex = methods.findIndex(
      (method: IPayoutMethod) => getPayoutMethodId(method as PayoutMethodRecord) === methodId
    );

    if (methodIndex === -1) {
      throw new AppError("Payout method not found", 404);
    }

    // Set all to non-default except the one being set
    methods.forEach((m: IPayoutMethod, idx: number) => {
      m.isDefault = idx === methodIndex;
    });

    await expert.save();

    res.json({
      success: true,
      message: "Default payout method updated",
      data: {
        payoutMethods: (expert.payoutMethods || []).map((m: IPayoutMethod) =>
          decryptPayoutMethod(m)
        ),
      },
    });
  }
);
