import type {
  CoachSubscription,
  SubscriptionFrequency,
} from "@prisma/client";
import prisma from "../../lib/prisma";
import {
  sendCoachSubscriptionPurchasedEmail,
  sendCoachSubscriptionCancelledEmail,
} from "../../utils/email";

// Legacy alias — the Mongoose document type is replaced by the Prisma row type.
type CoachSubscriptionDocument = CoachSubscription;

const DEFAULT_GRACE_DAYS = 7;

const addBillingPeriod = (
  startDate: Date,
  frequency: SubscriptionFrequency,
): Date => {
  const next = new Date(startDate);
  switch (frequency) {
    case "YEARLY":
      next.setFullYear(next.getFullYear() + 1);
      break;
    case "QUARTERLY":
      next.setMonth(next.getMonth() + 3);
      break;
    case "MONTHLY":
    default:
      next.setMonth(next.getMonth() + 1);
      break;
  }
  return next;
};

const addGracePeriod = (startDate: Date, days: number): Date => {
  const next = new Date(startDate);
  next.setDate(next.getDate() + days);
  return next;
};

// TODO(prisma): mongoose.Types.ObjectId.isValid() is gone (Postgres cuids).
// Keep a truthiness guard so callers still get "Invalid ID format" on empty ids.
const ensureId = (id: string): string => {
  if (!id || typeof id !== "string") {
    throw new Error("Invalid ID format");
  }
  return id;
};

const syncCoachSubscriptionSummary = async (params: {
  coachId: string;
  subscriptionId?: string | null;
  subscriptionStatus: "NONE" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "EXPIRED";
  subscriptionExpiresAt?: Date | null;
}): Promise<void> => {
  await prisma.coach.update({
    where: { id: params.coachId },
    data: {
      activeSubscriptionId: params.subscriptionId || null,
      subscriptionStatus: params.subscriptionStatus,
      subscriptionExpiresAt: params.subscriptionExpiresAt || null,
    },
  });
};

// String-FK populate helpers (no Prisma relations on these ref fields).
const attachPackages = async <T extends { packageId: string }>(
  subs: T[],
): Promise<T[]> => {
  const ids = [...new Set(subs.map((s) => s.packageId))];
  const pkgs = await prisma.coachSubscriptionPackage.findMany({
    where: { id: { in: ids } },
  });
  const map = new Map(pkgs.map((p) => [p.id, p]));
  return subs.map(
    (s) => ({ ...s, packageId: map.get(s.packageId) ?? s.packageId }) as T,
  );
};

const attachCoachSummary = async <T extends { coachId: string }>(
  subs: T[],
): Promise<T[]> => {
  const ids = [...new Set(subs.map((s) => s.coachId))];
  const coaches = await prisma.coach.findMany({
    where: { id: { in: ids } },
    select: { id: true, bio: true, sports: true, rating: true, reviewCount: true },
  });
  const map = new Map(coaches.map((c) => [c.id, c]));
  return subs.map(
    (s) => ({ ...s, coachId: map.get(s.coachId) ?? s.coachId }) as T,
  );
};

const attachSubscriberSummary = async <T extends { userId: string }>(
  subs: T[],
): Promise<T[]> => {
  const ids = [...new Set(subs.map((s) => s.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, email: true },
  });
  const map = new Map(users.map((u) => [u.id, u]));
  return subs.map(
    (s) => ({ ...s, userId: map.get(s.userId) ?? s.userId }) as T,
  );
};

/**
 * New method: Subscribe user to a coach's subscription package
 */
export const subscribeToCoachPackage = async (params: {
  userId: string;
  dependentId?: string;
  coachId: string;
  packageId: string;
}): Promise<CoachSubscriptionDocument> => {
  const packageDoc = await prisma.coachSubscriptionPackage.findUnique({
    where: { id: ensureId(params.packageId) },
  });

  if (!packageDoc || !packageDoc.isActive) {
    throw new Error("Selected package is not available");
  }

  if (packageDoc.coachId !== params.coachId) {
    throw new Error("Package does not belong to this coach");
  }

  const now = new Date();
  const periodEnd = addBillingPeriod(now, packageDoc.frequency);

  const where: {
    coachId: string;
    userId: string;
    status: { in: ("ACTIVE" | "PAST_DUE")[] };
    dependentId?: string | null;
  } = {
    coachId: ensureId(params.coachId),
    userId: ensureId(params.userId),
    status: { in: ["ACTIVE", "PAST_DUE"] },
  };

  if (params.dependentId) {
    where.dependentId = ensureId(params.dependentId);
  } else {
    where.dependentId = null;
  }

  // Check for existing active subscription from this user to this coach
  const existingActive = await prisma.coachSubscription.findFirst({
    where,
    orderBy: { createdAt: "desc" },
  });

  if (
    existingActive &&
    existingActive.packageId === params.packageId &&
    existingActive.status === "ACTIVE"
  ) {
    const renewalStart =
      existingActive.currentPeriodEnd > now
        ? existingActive.currentPeriodEnd
        : now;

    const currentPeriodStart = existingActive.currentPeriodStart || now;
    const currentPeriodEnd = addBillingPeriod(
      renewalStart,
      packageDoc.frequency,
    );

    const updated = await prisma.coachSubscription.update({
      where: { id: existingActive.id },
      data: {
        currentPeriodStart,
        currentPeriodEnd,
        nextBillingDate: currentPeriodEnd,
        autoRenew: true,
        status: "ACTIVE",
      },
    });

    await syncCoachSubscriptionSummary({
      coachId: params.coachId,
      subscriptionId: updated.id,
      subscriptionStatus: "ACTIVE",
      subscriptionExpiresAt: updated.currentPeriodEnd,
    });
    return updated;
  }

  if (existingActive) {
    await prisma.coachSubscription.update({
      where: { id: existingActive.id },
      data: {
        status: "CANCELLED",
        autoRenew: false,
        cancelledAt: now,
        cancellationReason: "Switched to different package",
      },
    });
  }

  const newSubscription = await prisma.coachSubscription.create({
    data: {
      coachId: ensureId(params.coachId),
      userId: ensureId(params.userId),
      ...(params.dependentId
        ? { dependentId: ensureId(params.dependentId) }
        : {}),
      packageId: packageDoc.id,
      status: "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      nextBillingDate: periodEnd,
      autoRenew: true,
    },
  });

  // Preserve the old .populate("packageId") return shape.
  const populated = {
    ...newSubscription,
    packageId: packageDoc,
  } as unknown as CoachSubscriptionDocument;

  await syncCoachSubscriptionSummary({
    coachId: params.coachId,
    subscriptionId: newSubscription.id,
    subscriptionStatus: "ACTIVE",
    subscriptionExpiresAt: newSubscription.currentPeriodEnd,
  });

  // Notify both parties of the new subscription (fire-and-forget).
  void (async () => {
    try {
      const player = await prisma.user.findUnique({
        where: { id: params.userId },
        select: { name: true, email: true },
      });
      const coach = await prisma.coach.findUnique({
        where: { id: params.coachId },
        select: { userId: true },
      });
      const coachUser = coach
        ? await prisma.user.findUnique({
            where: { id: coach.userId },
            select: { name: true, email: true },
          })
        : null;
      const priceRupees = (packageDoc.price || 0) / 100;
      if (player?.email) {
        await sendCoachSubscriptionPurchasedEmail({
          name: player.name,
          email: player.email,
          packageName: packageDoc.name,
          price: priceRupees,
          counterpartName: coachUser?.name || "your coach",
          recipientRole: "Player",
        });
      }
      if (coachUser?.email) {
        await sendCoachSubscriptionPurchasedEmail({
          name: coachUser.name,
          email: coachUser.email,
          packageName: packageDoc.name,
          price: priceRupees,
          counterpartName: player?.name || "A player",
          recipientRole: "Coach",
        });
      }
    } catch (emailError) {
      console.error("Failed to send subscription purchased email:", emailError);
    }
  })();

  return populated;
};

/**
 * Get user's subscriptions to a specific coach
 */
export const getUserCoachSubscriptions = async (params: {
  userId: string;
  coachId?: string;
  status?: string;
}): Promise<CoachSubscriptionDocument[]> => {
  const where: {
    userId: string;
    coachId?: string;
    status?: any;
  } = {
    userId: ensureId(params.userId),
  };

  if (params.coachId) {
    where.coachId = ensureId(params.coachId);
  }

  if (params.status) {
    where.status = params.status;
  }

  const subs = await prisma.coachSubscription.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  const withPackages = await attachPackages(subs);
  const withCoaches = await attachCoachSummary(withPackages);
  return withCoaches as unknown as CoachSubscriptionDocument[];
};

export const cancelCoachSubscriptionByUser = async (params: {
  subscriptionId: string;
  reason?: string;
  userId?: string;
  userRole?: string;
}): Promise<CoachSubscriptionDocument> => {
  const subscription = await prisma.coachSubscription.findUnique({
    where: { id: ensureId(params.subscriptionId) },
  });

  if (!subscription) {
    throw new Error("Subscription not found");
  }

  if (subscription.status === "CANCELLED") {
    throw new Error("Subscription is already cancelled");
  }

  if (params.userId) {
    const userRole = typeof params.userRole === "string" ? params.userRole : "";

    if (userRole === "Player") {
      if (subscription.userId !== params.userId) {
        throw new Error("You are not authorized to cancel this subscription");
      }
    } else if (userRole === "Coach") {
      const coach = await prisma.coach.findFirst({
        where: { userId: params.userId },
        select: { id: true },
      });
      if (!coach || coach.id !== subscription.coachId) {
        throw new Error("You are not authorized to cancel this subscription");
      }
    }
  }

  const updated = await prisma.coachSubscription.update({
    where: { id: subscription.id },
    data: {
      status: "CANCELLED",
      autoRenew: false,
      cancelledAt: new Date(),
      cancellationReason: params.reason?.trim() || "Cancelled by user",
    },
  });

  await syncCoachSubscriptionSummary({
    coachId: subscription.coachId,
    subscriptionId: null,
    subscriptionStatus: "CANCELLED",
    subscriptionExpiresAt: subscription.currentPeriodEnd,
  });

  // Notify the subscriber their plan was cancelled (fire-and-forget).
  void (async () => {
    try {
      const player = await prisma.user.findUnique({
        where: { id: subscription.userId },
        select: { name: true, email: true },
      });
      const coach = await prisma.coach.findUnique({
        where: { id: subscription.coachId },
        select: { userId: true },
      });
      const coachUser = coach
        ? await prisma.user.findUnique({
            where: { id: coach.userId },
            select: { name: true },
          })
        : null;
      const pkg = await prisma.coachSubscriptionPackage.findUnique({
        where: { id: subscription.packageId },
        select: { name: true },
      });
      if (player?.email) {
        await sendCoachSubscriptionCancelledEmail({
          name: player.name,
          email: player.email,
          packageName: pkg?.name || "coaching plan",
          counterpartName: coachUser?.name || "your coach",
          recipientRole: "Player",
        });
      }
    } catch (emailError) {
      console.error("Failed to send subscription cancelled email:", emailError);
    }
  })();

  return updated;
};

/**
 * Cancel all active subscriptions from a user to a coach
 */
export const cancelAllUserCoachSubscriptions = async (params: {
  userId: string;
  coachId: string;
  reason?: string;
}): Promise<CoachSubscriptionDocument[]> => {
  const result = await prisma.coachSubscription.updateMany({
    where: {
      userId: ensureId(params.userId),
      coachId: ensureId(params.coachId),
      status: { in: ["ACTIVE", "PAST_DUE"] },
    },
    data: {
      status: "CANCELLED",
      autoRenew: false,
      cancelledAt: new Date(),
      cancellationReason: params.reason?.trim() || "Cancelled by user",
    },
  });

  return prisma.coachSubscription.findMany({
    where: {
      userId: ensureId(params.userId),
      coachId: ensureId(params.coachId),
      status: "CANCELLED",
    },
    orderBy: { updatedAt: "desc" },
    take: result.count,
  });
};

export const markPastDueSubscription = async (subscriptionId: string) => {
  const subscription = await prisma.coachSubscription.findUnique({
    where: { id: ensureId(subscriptionId) },
  });
  if (!subscription) {
    throw new Error("Subscription not found");
  }

  const gracePeriodEndsAt = addGracePeriod(
    new Date(),
    parseInt(
      process.env.COACH_SUBSCRIPTION_GRACE_PERIOD_DAYS ||
        String(DEFAULT_GRACE_DAYS),
      10,
    ),
  );

  const updated = await prisma.coachSubscription.update({
    where: { id: subscription.id },
    data: {
      status: "PAST_DUE",
      gracePeriodEndsAt,
    },
  });

  await syncCoachSubscriptionSummary({
    coachId: subscription.coachId,
    subscriptionId: subscription.id,
    subscriptionStatus: "PAST_DUE",
    subscriptionExpiresAt: subscription.currentPeriodEnd,
  });

  return updated;
};

export const cleanupExpiredCoachSubscriptions = async (): Promise<number> => {
  const now = new Date();
  const expired = await prisma.coachSubscription.findMany({
    where: {
      OR: [
        { status: "ACTIVE", currentPeriodEnd: { lte: now } },
        { status: "PAST_DUE", gracePeriodEndsAt: { lte: now } },
      ],
    },
  });

  if (expired.length === 0) {
    return 0;
  }

  const coachIds = new Set<string>();

  for (const subscription of expired) {
    await prisma.coachSubscription.update({
      where: { id: subscription.id },
      data: {
        status: "EXPIRED",
        autoRenew: false,
        cancelledAt: subscription.cancelledAt || now,
        cancellationReason:
          subscription.cancellationReason || "Subscription expired",
      },
    });
    coachIds.add(subscription.coachId);
  }

  for (const coachId of coachIds) {
    const activeSubscription = await prisma.coachSubscription.findFirst({
      where: {
        coachId,
        status: "ACTIVE",
      },
      orderBy: { currentPeriodEnd: "desc" },
    });

    await syncCoachSubscriptionSummary({
      coachId,
      subscriptionId: activeSubscription?.id ?? null,
      subscriptionStatus: activeSubscription ? "ACTIVE" : "EXPIRED",
      subscriptionExpiresAt: activeSubscription?.currentPeriodEnd ?? null,
    });
  }

  return expired.length;
};

/**
 * Get active subscriptions for a coach
 */
export const getCoachActiveSubscriptions = async (coachId: string) => {
  const subs = await prisma.coachSubscription.findMany({
    where: {
      coachId: ensureId(coachId),
      status: "ACTIVE",
    },
    orderBy: { createdAt: "desc" },
  });

  const withUsers = await attachSubscriberSummary(subs);
  const withPackages = await attachPackages(withUsers);
  return withPackages as unknown as CoachSubscriptionDocument[];
};

/**
 * Get subscription revenue for a coach
 */
export const getCoachSubscriptionRevenue = async (params: {
  coachId: string;
  startDate?: Date;
  endDate?: Date;
}): Promise<{
  total: number;
  count: number;
  byFrequency: Record<string, number>;
}> => {
  const where: {
    coachId: string;
    status: "ACTIVE";
    createdAt?: { gte?: Date; lte?: Date };
  } = {
    coachId: ensureId(params.coachId),
    status: "ACTIVE",
  };

  if (params.startDate || params.endDate) {
    where.createdAt = {};
    if (params.startDate) {
      where.createdAt.gte = params.startDate;
    }
    if (params.endDate) {
      where.createdAt.lte = params.endDate;
    }
  }

  const subscriptions = await prisma.coachSubscription.findMany({ where });

  const packageIds = [...new Set(subscriptions.map((s) => s.packageId))];
  const packages = await prisma.coachSubscriptionPackage.findMany({
    where: { id: { in: packageIds } },
    select: { id: true, price: true, frequency: true },
  });
  const pkgMap = new Map(packages.map((p) => [p.id, p]));

  let total = 0;
  const byFrequency: Record<string, number> = {
    MONTHLY: 0,
    QUARTERLY: 0,
    YEARLY: 0,
  };

  for (const sub of subscriptions) {
    const pkg = pkgMap.get(sub.packageId);
    if (pkg && pkg.price) {
      total += pkg.price;
      byFrequency[pkg.frequency] =
        (byFrequency[pkg.frequency] || 0) + pkg.price;
    }
  }

  return {
    total,
    count: subscriptions.length,
    byFrequency,
  };
};

export type { CoachSubscriptionDocument };
