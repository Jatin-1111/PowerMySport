import { Prisma } from "@prisma/client";
import type { PromoCode } from "@prisma/client";
import prisma from "../../lib/prisma";

export interface CreatePromoCodePayload {
  code: string;
  description: string;
  discountType: "PERCENTAGE" | "FIXED_AMOUNT";
  discountValue: number;
  applicableTo?: "ALL" | "VENUE_ONLY" | "COACH_ONLY" | "MERCHANDISE_ONLY";
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
): Promise<PromoCode> => {
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
  const existing = await prisma.promoCode.findUnique({
    where: { code: payload.code.toUpperCase() },
  });
  if (existing) {
    throw new Error("Promo code already exists");
  }

  // Codes are stored uppercased (was a Mongoose uppercase setter); all lookups
  // normalize via toUpperCase() to match.
  const promoCode = await prisma.promoCode.create({
    data: {
      ...payload,
      code: payload.code.toUpperCase(),
    },
  });

  return promoCode;
};

/**
 * Validate and apply a promo code to a booking
 * Returns the discount amount
 */
export const validatePromoCode = async (
  code: string,
  userId: string,
  amount: number,
  options?: {
    hasCoach?: boolean;
    context?: "BOOKING" | "MERCHANDISE";
  },
): Promise<{
  isValid: boolean;
  discountAmount: number;
  message?: string;
}> => {
  const hasCoach = options?.hasCoach ?? false;
  const context = options?.context ?? "BOOKING";

  const promoCode = await prisma.promoCode.findUnique({
    where: { code: code.toUpperCase() },
  });

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
  if (promoCode.minBookingAmount && amount < promoCode.minBookingAmount) {
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

  // Check per-user usage limit (usedBy is now the normalized PromoCodeUsage table)
  const userUsageCount = await prisma.promoCodeUsage.count({
    where: { promoCodeId: promoCode.id, userId },
  });

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

  if (
    promoCode.applicableTo === "MERCHANDISE_ONLY" &&
    context !== "MERCHANDISE"
  ) {
    return {
      isValid: false,
      discountAmount: 0,
      message: "This promo code only applies to merchandise orders",
    };
  }

  if (
    context === "MERCHANDISE" &&
    (promoCode.applicableTo === "COACH_ONLY" ||
      promoCode.applicableTo === "VENUE_ONLY")
  ) {
    return {
      isValid: false,
      discountAmount: 0,
      message: "This promo code is valid only for booking flows",
    };
  }

  // Calculate discount
  let discountAmount = 0;
  if (promoCode.discountType === "PERCENTAGE") {
    discountAmount = (amount * promoCode.discountValue) / 100;

    // Apply max discount cap if set
    if (
      promoCode.maxDiscountAmount &&
      discountAmount > promoCode.maxDiscountAmount
    ) {
      discountAmount = promoCode.maxDiscountAmount;
    }
  } else {
    discountAmount = Math.min(promoCode.discountValue, amount);
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
  bookingId: string | null,
  orderId: string | null,
  discountApplied: number,
): Promise<void> => {
  const usagePayload: {
    userId: string;
    discountApplied: number;
    usedAt: Date;
    bookingId?: string;
    orderId?: string;
  } = {
    userId,
    discountApplied,
    usedAt: new Date(),
  };

  if (bookingId) {
    usagePayload.bookingId = bookingId;
  }
  if (orderId) {
    usagePayload.orderId = orderId;
  }

  // $inc -> { increment }; $push -> nested create on the PromoCodeUsage child.
  // Single atomic update over the parent + its new usage row. If the code no
  // longer exists this throws P2025 (was a silent no-op with findOneAndUpdate);
  // applyPromoCode is always called after a successful validate, so the code
  // exists in practice.
  await prisma.promoCode.update({
    where: { code: code.toUpperCase() },
    data: {
      currentUsageCount: { increment: 1 },
      usedBy: {
        create: usagePayload,
      },
    },
  });
};

/**
 * Get all promo codes (admin only)
 */
export const getAllPromoCodes = async (): Promise<PromoCode[]> => {
  return prisma.promoCode.findMany({ orderBy: { createdAt: "desc" } });
};

/**
 * Get active promo codes for users
 */
export const getActivePromoCodes = async (): Promise<PromoCode[]> => {
  const now = new Date();

  // TODO(prisma): the old query used $expr to compare two columns
  // (currentUsageCount < maxUsageTotal). Prisma has no column-to-column
  // comparison in `where`, so filter the usage-limit condition in app code.
  const candidates = await prisma.promoCode.findMany({
    where: {
      isActive: true,
      validFrom: { lte: now },
      validUntil: { gte: now },
    },
    orderBy: { createdAt: "desc" },
  });

  return candidates.filter(
    (p) => p.maxUsageTotal == null || p.currentUsageCount < p.maxUsageTotal,
  );
};

/**
 * Deactivate a promo code
 */
export const deactivatePromoCode = async (
  codeId: string,
): Promise<PromoCode | null> => {
  try {
    return await prisma.promoCode.update({
      where: { id: codeId },
      data: { isActive: false },
    });
  } catch (error) {
    // Preserve findByIdAndUpdate semantics: return null when not found.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return null;
    }
    throw error;
  }
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
    userName: string;
    userEmail: string;
    discountApplied: number;
    usedAt: Date;
  }>;
}> => {
  const promoCode = await prisma.promoCode.findUnique({
    where: { id: codeId },
    include: { usedBy: { orderBy: { usedAt: "asc" } } },
  });

  if (!promoCode) {
    throw new Error("Promo code not found");
  }

  const totalDiscountGiven = promoCode.usedBy.reduce(
    (sum, usage) => sum + usage.discountApplied,
    0,
  );

  const uniqueUsers = new Set(promoCode.usedBy.map((u) => u.userId.toString()))
    .size;

  const recentRaw = promoCode.usedBy.slice(-10).reverse();

  const users = await prisma.user.findMany({
    where: { id: { in: recentRaw.map((usage) => usage.userId) } },
    select: { id: true, name: true, email: true },
  });
  const userById = new Map(users.map((user) => [String(user.id), user]));

  const recentUsages = recentRaw.map((usage) => {
    const user = userById.get(usage.userId.toString());
    return {
      userId: usage.userId.toString(),
      userName: user?.name || "Unknown user",
      userEmail: user?.email || "",
      discountApplied: usage.discountApplied,
      usedAt: usage.usedAt,
    };
  });

  return {
    code: promoCode.code,
    totalUsage: promoCode.currentUsageCount,
    totalDiscountGiven,
    uniqueUsers,
    recentUsages,
  };
};
