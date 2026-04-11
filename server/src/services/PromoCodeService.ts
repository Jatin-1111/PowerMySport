import { PromoCode, PromoCodeDocument } from "../models/PromoCode";

export interface CreatePromoCodePayload {
  code: string;
  description: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  applicableTo?: "ALL" | "VENUE_ONLY" | "COACH_ONLY";
  minBookingAmount?: number;
  maxDiscountAmount?: number;
  validFrom: Date;
  validUntil: Date;
  maxUsageTotal?: number;
  maxUsagePerUser?: number;
  createdBy: string;
}

/**
 * Create a new promo code (admin only)
 */
export const createPromoCode = async (
  payload: CreatePromoCodePayload,
): Promise<PromoCodeDocument> => {
  // Validate discount value
  if (payload.discountType === "PERCENTAGE") {
    if (payload.discountValue < 0 || payload.discountValue > 100) {
      throw new Error("Percentage discount must be between 0 and 100");
    }
  } else {
    if (payload.discountValue < 0) {
      throw new Error("Fixed discount amount must be positive");
    }
  }

  // Check if code already exists
  const existing = await PromoCode.findOne({
    code: payload.code.toUpperCase(),
  });
  if (existing) {
    throw new Error("Promo code already exists");
  }

  const promoCode = new PromoCode(payload);
  await promoCode.save();

  return promoCode;
};

/**
 * Validate and apply a promo code to a booking
 * Returns the discount amount
 */
export const validatePromoCode = async (
  code: string,
  userId: string,
  bookingAmount: number,
  hasCoach: boolean,
): Promise<{
  isValid: boolean;
  discountAmount: number;
  message?: string;
}> => {
  const promoCode = await PromoCode.findOne({ code: code.toUpperCase() });

  if (!promoCode) {
    return { isValid: false, discountAmount: 0, message: "Invalid promo code" };
  }

  // Check if active
  if (!promoCode.isActive) {
    return {
      isValid: false,
      discountAmount: 0,
      message: "Promo code is inactive",
    };
  }

  // Check validity dates
  const now = new Date();
  if (now < promoCode.validFrom) {
    return {
      isValid: false,
      discountAmount: 0,
      message: "Promo code not yet valid",
    };
  }
  if (now > promoCode.validUntil) {
    return {
      isValid: false,
      discountAmount: 0,
      message: "Promo code has expired",
    };
  }

  // Check minimum booking amount
  if (
    promoCode.minBookingAmount &&
    bookingAmount < promoCode.minBookingAmount
  ) {
    return {
      isValid: false,
      discountAmount: 0,
      message: `Minimum booking amount is ₹${promoCode.minBookingAmount}`,
    };
  }

  // Check total usage limit
  if (
    promoCode.maxUsageTotal &&
    promoCode.currentUsageCount >= promoCode.maxUsageTotal
  ) {
    return {
      isValid: false,
      discountAmount: 0,
      message: "Promo code usage limit reached",
    };
  }

  // Check per-user usage limit
  const userUsageCount = promoCode.usedBy.filter(
    (usage) => usage.userId.toString() === userId,
  ).length;

  if (
    promoCode.maxUsagePerUser &&
    userUsageCount >= promoCode.maxUsagePerUser
  ) {
    return {
      isValid: false,
      discountAmount: 0,
      message: "You've already used this promo code",
    };
  }

  // Check applicability (venue-only vs coach-only)
  if (promoCode.applicableTo === "COACH_ONLY" && !hasCoach) {
    return {
      isValid: false,
      discountAmount: 0,
      message: "This promo code only applies to coach bookings",
    };
  }

  // Calculate discount
  let discountAmount = 0;
  if (promoCode.discountType === "PERCENTAGE") {
    discountAmount = (bookingAmount * promoCode.discountValue) / 100;

    // Apply max discount cap if set
    if (
      promoCode.maxDiscountAmount &&
      discountAmount > promoCode.maxDiscountAmount
    ) {
      discountAmount = promoCode.maxDiscountAmount;
    }
  } else {
    discountAmount = Math.min(promoCode.discountValue, bookingAmount);
  }

  return {
    isValid: true,
    discountAmount: Math.round(discountAmount),
    message: `Discount of ₹${Math.round(discountAmount)} applied`,
  };
};

/**
 * Apply promo code to a booking
 * Records usage and updates counters
 */
export const applyPromoCode = async (
  code: string,
  userId: string,
  bookingId: string,
  discountApplied: number,
): Promise<void> => {
  await PromoCode.findOneAndUpdate(
    { code: code.toUpperCase() },
    {
      $inc: { currentUsageCount: 1 },
      $push: {
        usedBy: {
          userId,
          bookingId,
          discountApplied,
          usedAt: new Date(),
        },
      },
    },
  );
};

/**
 * Get all promo codes (admin only)
 */
export const getAllPromoCodes = async (): Promise<PromoCodeDocument[]> => {
  return PromoCode.find().sort({ createdAt: -1 });
};

/**
 * Get active promo codes for users
 */
export const getActivePromoCodes = async (): Promise<PromoCodeDocument[]> => {
  const now = new Date();

  return PromoCode.find({
    isActive: true,
    validFrom: { $lte: now },
    validUntil: { $gte: now },
    $or: [
      { maxUsageTotal: { $exists: false } },
      { $expr: { $lt: ["$currentUsageCount", "$maxUsageTotal"] } },
    ],
  }).sort({ createdAt: -1 });
};

/**
 * Deactivate a promo code
 */
export const deactivatePromoCode = async (
  codeId: string,
): Promise<PromoCodeDocument | null> => {
  return PromoCode.findByIdAndUpdate(
    codeId,
    { isActive: false },
    { new: true },
  );
};

/**
 * Get promo code usage statistics
 */
export const getPromoCodeStats = async (
  codeId: string,
): Promise<{
  code: string;
  totalUsage: number;
  totalDiscountGiven: number;
  uniqueUsers: number;
  recentUsages: Array<{
    userId: string;
    discountApplied: number;
    usedAt: Date;
  }>;
}> => {
  const promoCode = await PromoCode.findById(codeId);

  if (!promoCode) {
    throw new Error("Promo code not found");
  }

  const totalDiscountGiven = promoCode.usedBy.reduce(
    (sum, usage) => sum + usage.discountApplied,
    0,
  );

  const uniqueUsers = new Set(promoCode.usedBy.map((u) => u.userId.toString()))
    .size;

  const recentUsages = promoCode.usedBy
    .slice(-10)
    .reverse()
    .map((usage) => ({
      userId: usage.userId.toString(),
      discountApplied: usage.discountApplied,
      usedAt: usage.usedAt,
    }));

  return {
    code: promoCode.code,
    totalUsage: promoCode.currentUsageCount,
    totalDiscountGiven,
    uniqueUsers,
    recentUsages,
  };
};
