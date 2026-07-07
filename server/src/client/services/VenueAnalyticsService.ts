import mongoose from "mongoose";
import { Booking } from "../models/Booking";
import { Venue } from "../models/Venue";

// ── Earnings ──────────────────────────────────────────────────────────────────

export interface VenueEarningsData {
  allTime: { total: number; sessions: number };
  thisMonth: { total: number; sessions: number };
  lastMonth: { total: number; sessions: number };
  pending: { total: number; sessions: number };
  byMonth: Array<{ label: string; total: number; sessions: number }>;
  bySport: Array<{ sport: string; total: number; sessions: number }>;
  recentBookings: any[];
}

export const getVenueEarnings = async (
  ownerUserId: string,
): Promise<VenueEarningsData> => {
  // Find all venues owned by this user
  const venues = await Venue.find({ ownerId: ownerUserId })
    .select("_id")
    .lean();
  if (venues.length === 0) {
    // Return empty data structure
    return {
      allTime: { total: 0, sessions: 0 },
      thisMonth: { total: 0, sessions: 0 },
      lastMonth: { total: 0, sessions: 0 },
      pending: { total: 0, sessions: 0 },
      byMonth: [],
      bySport: [],
      recentBookings: [],
    };
  }
  const venueIds = venues.map((v: any) => v._id);

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

  const [completedBookings, pendingBookings, recentBookings] =
    await Promise.all([
      Booking.find({ venueId: { $in: venueIds }, status: "COMPLETED" }).lean(),
      Booking.find({
        venueId: { $in: venueIds },
        status: { $in: ["CONFIRMED", "IN_PROGRESS"] },
      }).lean(),
      Booking.find({ venueId: { $in: venueIds }, status: "COMPLETED" })
        .sort({ date: -1 })
        .limit(10)
        .populate("userId", "name photoUrl")
        .lean(),
    ]);

  const getVenueAmount = (b: any): number => {
    if (Array.isArray(b.payments)) {
      const vp = b.payments.find(
        (p: any) => p.userType === "VenueLister" && p.status === "PAID",
      );
      if (vp) return vp.amount;
    }
    return b.totalAmount ?? 0;
  };

  const allTime = {
    total: completedBookings.reduce(
      (s: number, b: any) => s + getVenueAmount(b),
      0,
    ),
    sessions: completedBookings.length,
  };
  const thisMonthB = completedBookings.filter(
    (b: any) => new Date(b.date) >= startOfThisMonth,
  );
  const lastMonthB = completedBookings.filter((b: any) => {
    const d = new Date(b.date);
    return d >= startOfLastMonth && d <= endOfLastMonth;
  });
  const thisMonth = {
    total: thisMonthB.reduce((s: number, b: any) => s + getVenueAmount(b), 0),
    sessions: thisMonthB.length,
  };
  const lastMonth = {
    total: lastMonthB.reduce((s: number, b: any) => s + getVenueAmount(b), 0),
    sessions: lastMonthB.length,
  };
  const pending = {
    total: pendingBookings.reduce(
      (s: number, b: any) => s + getVenueAmount(b),
      0,
    ),
    sessions: pendingBookings.length,
  };

  const monthMap = new Map<string, { total: number; sessions: number }>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthMap.set(
      d.toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        month: "short",
        year: "numeric",
      }),
      { total: 0, sessions: 0 },
    );
  }
  completedBookings
    .filter((b: any) => new Date(b.date) >= sixMonthsAgo)
    .forEach((b: any) => {
      const key = new Date(b.date).toLocaleDateString("en-IN", {
        timeZone: "Asia/Kolkata",
        month: "short",
        year: "numeric",
      });
      const e = monthMap.get(key);
      if (e) {
        e.total += getVenueAmount(b);
        e.sessions += 1;
      }
    });
  const byMonth = Array.from(monthMap.entries()).map(([label, v]) => ({
    label,
    ...v,
  }));

  const sportMap = new Map<string, { total: number; sessions: number }>();
  completedBookings.forEach((b: any) => {
    const sport = b.sport as string;
    const e = sportMap.get(sport) ?? { total: 0, sessions: 0 };
    e.total += getVenueAmount(b);
    e.sessions += 1;
    sportMap.set(sport, e);
  });
  const bySport = Array.from(sportMap.entries())
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

export interface VenueAnalyticsData {
  overview: {
    totalSessions: number;
    completedSessions: number;
    completionRate: number;
    totalCustomers: number;
    returningCustomers: number;
    retentionRate: number;
    avgRating: number;
    reviewCount: number;
  };
  sessionsTrend: Array<{ label: string; count: number }>;
  sportBreakdown: Array<{ sport: string; count: number; percentage: number }>;
  popularHours: Array<{ hour: number; count: number }>;
  customerRetention: { newCustomers: number; returningCustomers: number };
}

export const getVenueAnalytics = async (
  ownerUserId: string,
): Promise<VenueAnalyticsData> => {
  const venues = await Venue.find({ ownerId: ownerUserId })
    .select("_id rating reviewCount")
    .lean();
  if (venues.length === 0) {
    return {
      overview: {
        totalSessions: 0,
        completedSessions: 0,
        completionRate: 0,
        totalCustomers: 0,
        returningCustomers: 0,
        retentionRate: 0,
        avgRating: 0,
        reviewCount: 0,
      },
      sessionsTrend: [],
      sportBreakdown: [],
      popularHours: [],
      customerRetention: { newCustomers: 0, returningCustomers: 0 },
    };
  }
  const venueIds = venues.map((v: any) => v._id);
  const avgRating =
    venues.reduce((s: number, v: any) => s + (v.rating ?? 0), 0) /
    venues.length;
  const reviewCount = venues.reduce(
    (s: number, v: any) => s + (v.reviewCount ?? 0),
    0,
  );

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [allBookings, recentBookings] = await Promise.all([
    Booking.find({
      venueId: { $in: venueIds },
      status: { $nin: ["CANCELLED"] },
    })
      .select("userId sport date startTime status")
      .lean(),
    Booking.find({
      venueId: { $in: venueIds },
      status: { $nin: ["CANCELLED"] },
      date: { $gte: thirtyDaysAgo },
    })
      .select("date status")
      .lean(),
  ]);

  const completed = allBookings.filter((b: any) => b.status === "COMPLETED");
  const terminal = allBookings.filter((b: any) =>
    ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(b.status),
  );
  const completionRate =
    terminal.length > 0
      ? Math.round((completed.length / terminal.length) * 100)
      : 0;

  const allCustomerIds = [
    ...new Set(allBookings.map((b: any) => b.userId.toString())),
  ];
  const countMap = new Map<string, number>();
  allBookings.forEach((b: any) => {
    const id = b.userId.toString();
    countMap.set(id, (countMap.get(id) ?? 0) + 1);
  });
  const returningSet = new Set<string>();
  countMap.forEach((c, id) => {
    if (c > 1) returningSet.add(id);
  });
  const retentionRate =
    allCustomerIds.length > 0
      ? Math.round((returningSet.size / allCustomerIds.length) * 100)
      : 0;

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
  const sessionsTrend = Array.from(trendMap.entries()).map(([date, count]) => ({
    label: new Date(date).toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
    }),
    count,
  }));

  const sportCountMap = new Map<string, number>();
  allBookings.forEach((b: any) => {
    const s = b.sport as string;
    sportCountMap.set(s, (sportCountMap.get(s) ?? 0) + 1);
  });
  const total = allBookings.length;
  const sportBreakdown = Array.from(sportCountMap.entries())
    .map(([sport, count]) => ({
      sport,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

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
      totalCustomers: allCustomerIds.length,
      returningCustomers: returningSet.size,
      retentionRate,
      avgRating: Math.round(avgRating * 10) / 10,
      reviewCount,
    },
    sessionsTrend,
    sportBreakdown,
    popularHours,
    customerRetention: {
      newCustomers: allCustomerIds.length - returningSet.size,
      returningCustomers: returningSet.size,
    },
  };
};
