import type { Prisma } from "@prisma/client";
import prisma from "../../lib/prisma";

// NOTE(prisma): the original Mongo service used `.find().lean()` and aggregated
// in JS — no `$aggregate` pipelines — so this is a mechanical query swap. The old
// embedded `payments[]` sub-array is now the `BookingPaymentLeg` child table
// (hydrated via `include: { payments: true }`), and `.populate("userId", ...)` is
// replaced by the user-attach helper below.

/**
 * Replace each booking's `userId` (a String FK) with the populated user object,
 * mirroring the old Mongoose `.populate("userId", "name photoUrl")`.
 * NOTE(prisma): the populated object exposes `id` instead of Mongo's `_id`.
 */
const attachUserToBookings = async (bookings: any[]): Promise<any[]> => {
  const ids = [
    ...new Set(bookings.map((b) => b.userId).filter(Boolean) as string[]),
  ];
  if (ids.length === 0) return bookings;
  const users = await prisma.user.findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true, photoUrl: true },
  });
  const byId = new Map(users.map((u) => [u.id, u]));
  return bookings.map((b) => ({ ...b, userId: byId.get(b.userId) ?? b.userId }));
};

// ── Earnings ─────────────────────────────────────────────────────────────────

export interface MonthlyEarning {
  label: string; // "Jan 2025"
  total: number;
  sessions: number;
}

export interface SportEarning {
  sport: string;
  total: number;
  sessions: number;
}

export interface EarningsData {
  allTime: { total: number; sessions: number };
  thisMonth: { total: number; sessions: number };
  lastMonth: { total: number; sessions: number };
  pending: { total: number; sessions: number };
  byMonth: MonthlyEarning[];
  bySport: SportEarning[];
  recentBookings: any[];
}

export const getCoachEarnings = async (
  coachUserId: string,
): Promise<EarningsData> => {
  const coach = await prisma.coach.findFirst({
    where: { userId: coachUserId },
    select: { id: true },
  });
  if (!coach) throw new Error("Coach profile not found");

  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(
    now.getFullYear(),
    now.getMonth(),
    0,
    23,
    59,
    59,
  );
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [completedBookings, pendingBookings, recentBookingsRaw] =
    await Promise.all([
      prisma.booking.findMany({
        where: { coachId: coach.id, status: "COMPLETED" },
        include: { payments: true },
      }),
      prisma.booking.findMany({
        where: {
          coachId: coach.id,
          status: { in: ["CONFIRMED", "IN_PROGRESS"] },
        },
        include: { payments: true },
      }),
      prisma.booking.findMany({
        where: { coachId: coach.id, status: "COMPLETED" },
        orderBy: { date: "desc" },
        take: 10,
        include: { payments: true },
      }),
    ]);
  const recentBookings = await attachUserToBookings(recentBookingsRaw);

  // Calculate coach share from payments or use totalAmount as fallback
  const getCoachAmount = (b: any): number => {
    if (Array.isArray(b.payments)) {
      const coachPayment = b.payments.find(
        (p: any) => p.userType === "Coach" && p.status === "PAID",
      );
      if (coachPayment) return coachPayment.amount;
    }
    return b.totalAmount ?? 0;
  };

  const allTime = {
    total: completedBookings.reduce(
      (s: number, b: any) => s + getCoachAmount(b),
      0,
    ),
    sessions: completedBookings.length,
  };

  const thisMonthBookings = completedBookings.filter(
    (b: any) => new Date(b.date) >= startOfThisMonth,
  );
  const lastMonthBookings = completedBookings.filter((b: any) => {
    const d = new Date(b.date);
    return d >= startOfLastMonth && d <= endOfLastMonth;
  });

  const thisMonth = {
    total: thisMonthBookings.reduce(
      (s: number, b: any) => s + getCoachAmount(b),
      0,
    ),
    sessions: thisMonthBookings.length,
  };
  const lastMonth = {
    total: lastMonthBookings.reduce(
      (s: number, b: any) => s + getCoachAmount(b),
      0,
    ),
    sessions: lastMonthBookings.length,
  };
  const pending = {
    total: pendingBookings.reduce(
      (s: number, b: any) => s + getCoachAmount(b),
      0,
    ),
    sessions: pendingBookings.length,
  };

  // By month — last 6 months
  const monthMap = new Map<string, { total: number; sessions: number }>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      month: "short",
      year: "numeric",
    });
    monthMap.set(key, { total: 0, sessions: 0 });
  }
  completedBookings
    .filter((b: any) => new Date(b.date) >= sixMonthsAgo)
    .forEach((b: any) => {
      const key = new Date(b.date).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        month: "short",
        year: "numeric",
      });
      const entry = monthMap.get(key);
      if (entry) {
        entry.total += getCoachAmount(b);
        entry.sessions += 1;
      }
    });
  const byMonth: MonthlyEarning[] = Array.from(monthMap.entries()).map(
    ([label, v]) => ({
      label,
      ...v,
    }),
  );

  // By sport
  const sportMap = new Map<string, { total: number; sessions: number }>();
  completedBookings.forEach((b: any) => {
    const sport = b.sport as string;
    const entry = sportMap.get(sport) ?? { total: 0, sessions: 0 };
    entry.total += getCoachAmount(b);
    entry.sessions += 1;
    sportMap.set(sport, entry);
  });
  const bySport: SportEarning[] = Array.from(sportMap.entries())
    .map(([sport, v]) => ({ sport, ...v }))
    .sort((a, b) => b.total - a.total);

  return {
    allTime,
    thisMonth,
    lastMonth,
    pending,
    byMonth,
    bySport,
    recentBookings,
  };
};

// ── Analytics ─────────────────────────────────────────────────────────────────

export interface AnalyticsOverview {
  totalSessions: number;
  completedSessions: number;
  completionRate: number;
  totalClients: number;
  returningClients: number;
  retentionRate: number;
  avgRating: number;
  reviewCount: number;
}

export interface TrendPoint {
  label: string;
  count: number;
}

export interface SportBreakdown {
  sport: string;
  count: number;
  percentage: number;
}

export interface AnalyticsData {
  overview: AnalyticsOverview;
  sessionsTrend: TrendPoint[];
  sportBreakdown: SportBreakdown[];
  popularHours: Array<{ hour: number; count: number }>;
  clientRetention: { newClients: number; returningClients: number };
}

export const getCoachAnalytics = async (
  coachUserId: string,
): Promise<AnalyticsData> => {
  const coach = await prisma.coach.findFirst({
    where: { userId: coachUserId },
    select: { id: true, rating: true, reviewCount: true },
  });
  if (!coach) throw new Error("Coach profile not found");

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const baseWhere: Prisma.BookingWhereInput = {
    coachId: coach.id,
    status: { not: "CANCELLED" },
  };

  const [allBookings, recentBookings] = await Promise.all([
    prisma.booking.findMany({
      where: baseWhere,
      select: {
        userId: true,
        sport: true,
        date: true,
        startTime: true,
        status: true,
      },
    }),
    prisma.booking.findMany({
      where: { ...baseWhere, date: { gte: thirtyDaysAgo } },
      select: { date: true, status: true },
    }),
  ]);

  const completed = allBookings.filter((b: any) => b.status === "COMPLETED");
  const terminal = allBookings.filter((b: any) =>
    ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(b.status),
  );
  const completionRate =
    terminal.length > 0
      ? Math.round((completed.length / terminal.length) * 100)
      : 0;

  // Unique clients
  const allClientIds = [
    ...new Set(allBookings.map((b: any) => b.userId.toString())),
  ];
  const returningClientIds = new Set<string>();
  const countMap = new Map<string, number>();
  allBookings.forEach((b: any) => {
    const id = b.userId.toString();
    countMap.set(id, (countMap.get(id) ?? 0) + 1);
  });
  countMap.forEach((count, id) => {
    if (count > 1) returningClientIds.add(id);
  });

  const retentionRate =
    allClientIds.length > 0
      ? Math.round((returningClientIds.size / allClientIds.length) * 100)
      : 0;

  // Sessions trend — last 30 days, grouped by day
  const trendMap = new Map<string, number>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    trendMap.set(d.toISOString().split("T")[0] ?? "", 0);
  }
  recentBookings.forEach((b: any) => {
    const key = new Date(b.date).toISOString().split("T")[0] ?? "";
    if (key && trendMap.has(key))
      trendMap.set(key, (trendMap.get(key) ?? 0) + 1);
  });
  const sessionsTrend: TrendPoint[] = Array.from(trendMap.entries()).map(
    ([date, count]) => ({
      label: new Date(date).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
      }),
      count,
    }),
  );

  // Sport breakdown
  const sportCountMap = new Map<string, number>();
  allBookings.forEach((b: any) => {
    const s = b.sport as string;
    sportCountMap.set(s, (sportCountMap.get(s) ?? 0) + 1);
  });
  const totalSportBookings = allBookings.length;
  const sportBreakdown: SportBreakdown[] = Array.from(sportCountMap.entries())
    .map(([sport, count]) => ({
      sport,
      count,
      percentage:
        totalSportBookings > 0
          ? Math.round((count / totalSportBookings) * 100)
          : 0,
    }))
    .sort((a, b) => b.count - a.count);

  // Popular hours
  const hourMap = new Map<number, number>();
  for (let h = 6; h <= 21; h++) hourMap.set(h, 0);
  allBookings.forEach((b: any) => {
    if (b.startTime) {
      const h = parseInt((b.startTime as string).split(":")[0] ?? "0");
      if (hourMap.has(h)) hourMap.set(h, (hourMap.get(h) ?? 0) + 1);
    }
  });
  const popularHours = Array.from(hourMap.entries())
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => a.hour - b.hour);

  return {
    overview: {
      totalSessions: allBookings.length,
      completedSessions: completed.length,
      completionRate,
      totalClients: allClientIds.length,
      returningClients: returningClientIds.size,
      retentionRate,
      avgRating: (coach as any).rating ?? 0,
      reviewCount: (coach as any).reviewCount ?? 0,
    },
    sessionsTrend,
    sportBreakdown,
    popularHours,
    clientRetention: {
      newClients: allClientIds.length - returningClientIds.size,
      returningClients: returningClientIds.size,
    },
  };
};
