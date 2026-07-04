import mongoose from "mongoose";
import { Booking } from "../models/Booking";
import Academy from "../../admin/models/Academy";

export interface AcademyEarningsData {
  allTime: { total: number; sessions: number };
  thisMonth: { total: number; sessions: number };
  lastMonth: { total: number; sessions: number };
  pending: { total: number; sessions: number };
  byMonth: Array<{ label: string; total: number; sessions: number }>;
  bySport: Array<{ sport: string; total: number; sessions: number }>;
  recentBookings: any[];
}

export const getAcademyEarnings = async (ownerUserId: string): Promise<AcademyEarningsData> => {
  const empty: AcademyEarningsData = {
    allTime: { total: 0, sessions: 0 }, thisMonth: { total: 0, sessions: 0 },
    lastMonth: { total: 0, sessions: 0 }, pending: { total: 0, sessions: 0 },
    byMonth: [], bySport: [], recentBookings: [],
  };

  const academy = await Academy.findOne({ ownerId: ownerUserId }).select("venueIds coachIds").lean();
  if (!academy) return empty;
  const academyAny = academy as any;

  const venueIds: mongoose.Types.ObjectId[] = academyAny.venueIds ?? [];
  const coachIds: mongoose.Types.ObjectId[] = academyAny.coachIds ?? [];
  if (venueIds.length === 0 && coachIds.length === 0) return empty;

  const now = new Date();
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const query: any = { status: { $nin: ["CANCELLED"] } };
  if (venueIds.length > 0 && coachIds.length > 0) {
    query.$or = [{ venueId: { $in: venueIds } }, { coachId: { $in: coachIds } }];
  } else if (venueIds.length > 0) {
    query.venueId = { $in: venueIds };
  } else {
    query.coachId = { $in: coachIds };
  }

  const completedQuery = { ...query, status: "COMPLETED" };
  const pendingQuery = { ...query, status: { $in: ["CONFIRMED", "IN_PROGRESS"] } };

  const [completedBookings, pendingBookings, recentBookings] = await Promise.all([
    Booking.find(completedQuery).lean(),
    Booking.find(pendingQuery).lean(),
    Booking.find(completedQuery).sort({ date: -1 }).limit(10).populate("userId", "name photoUrl").lean(),
  ]);

  const getAmount = (b: any): number => {
    if (Array.isArray(b.payments)) {
      const p = b.payments.find((p: any) => ["VenueLister", "Coach"].includes(p.userType) && p.status === "PAID");
      if (p) return p.amount;
    }
    return b.totalAmount ?? 0;
  };

  const allTime = { total: completedBookings.reduce((s: number, b: any) => s + getAmount(b), 0), sessions: completedBookings.length };
  const thisMonthB = completedBookings.filter((b: any) => new Date(b.date) >= startOfThisMonth);
  const lastMonthB = completedBookings.filter((b: any) => { const d = new Date(b.date); return d >= startOfLastMonth && d <= endOfLastMonth; });
  const thisMonth = { total: thisMonthB.reduce((s: number, b: any) => s + getAmount(b), 0), sessions: thisMonthB.length };
  const lastMonth = { total: lastMonthB.reduce((s: number, b: any) => s + getAmount(b), 0), sessions: lastMonthB.length };
  const pending = { total: pendingBookings.reduce((s: number, b: any) => s + getAmount(b), 0), sessions: pendingBookings.length };

  const monthMap = new Map<string, { total: number; sessions: number }>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthMap.set(d.toLocaleDateString("en-IN", { month: "short", year: "numeric" }), { total: 0, sessions: 0 });
  }
  completedBookings.filter((b: any) => new Date(b.date) >= sixMonthsAgo).forEach((b: any) => {
    const key = new Date(b.date).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    const e = monthMap.get(key); if (e) { e.total += getAmount(b); e.sessions += 1; }
  });
  const byMonth = Array.from(monthMap.entries()).map(([label, v]) => ({ label, ...v }));

  const sportMap = new Map<string, { total: number; sessions: number }>();
  completedBookings.forEach((b: any) => { const s = b.sport as string; const e = sportMap.get(s) ?? { total: 0, sessions: 0 }; e.total += getAmount(b); e.sessions += 1; sportMap.set(s, e); });
  const bySport = Array.from(sportMap.entries()).map(([sport, v]) => ({ sport, ...v })).sort((a, b) => b.total - a.total);

  return { allTime, thisMonth, lastMonth, pending, byMonth, bySport, recentBookings };
};

export interface AcademyAnalyticsData {
  overview: { totalSessions: number; completedSessions: number; completionRate: number; totalStudents: number; returningStudents: number; retentionRate: number; totalVenues: number; totalCoaches: number; };
  sessionsTrend: Array<{ label: string; count: number }>;
  sportBreakdown: Array<{ sport: string; count: number; percentage: number }>;
  popularHours: Array<{ hour: number; count: number }>;
  studentRetention: { newStudents: number; returningStudents: number };
}

export const getAcademyAnalytics = async (ownerUserId: string): Promise<AcademyAnalyticsData> => {
  const emptyOverview = { totalSessions: 0, completedSessions: 0, completionRate: 0, totalStudents: 0, returningStudents: 0, retentionRate: 0, totalVenues: 0, totalCoaches: 0 };
  const empty: AcademyAnalyticsData = { overview: emptyOverview, sessionsTrend: [], sportBreakdown: [], popularHours: [], studentRetention: { newStudents: 0, returningStudents: 0 } };

  const academy = await Academy.findOne({ ownerId: ownerUserId }).select("venueIds coachIds").lean();
  if (!academy) return empty;
  const academyAny = academy as any;

  const venueIds: mongoose.Types.ObjectId[] = academyAny.venueIds ?? [];
  const coachIds: mongoose.Types.ObjectId[] = academyAny.coachIds ?? [];
  if (venueIds.length === 0 && coachIds.length === 0) return { ...empty, overview: { ...emptyOverview, totalVenues: venueIds.length, totalCoaches: coachIds.length } };

  const query: any = { status: { $nin: ["CANCELLED"] } };
  if (venueIds.length > 0 && coachIds.length > 0) { query.$or = [{ venueId: { $in: venueIds } }, { coachId: { $in: coachIds } }]; }
  else if (venueIds.length > 0) { query.venueId = { $in: venueIds }; }
  else { query.coachId = { $in: coachIds }; }

  const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const [allBookings, recentBookings] = await Promise.all([
    Booking.find(query).select("userId sport date startTime status").lean(),
    Booking.find({ ...query, date: { $gte: thirtyDaysAgo } }).select("date status").lean(),
  ]);

  const completed = allBookings.filter((b: any) => b.status === "COMPLETED");
  const terminal = allBookings.filter((b: any) => ["COMPLETED", "CANCELLED", "NO_SHOW"].includes(b.status));
  const completionRate = terminal.length > 0 ? Math.round((completed.length / terminal.length) * 100) : 0;

  const studentIds = [...new Set(allBookings.map((b: any) => b.userId.toString()))];
  const countMap = new Map<string, number>();
  allBookings.forEach((b: any) => { const id = b.userId.toString(); countMap.set(id, (countMap.get(id) ?? 0) + 1); });
  const returningSet = new Set<string>(); countMap.forEach((c, id) => { if (c > 1) returningSet.add(id); });
  const retentionRate = studentIds.length > 0 ? Math.round((returningSet.size / studentIds.length) * 100) : 0;

  const trendMap = new Map<string, number>();
  for (let i = 29; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); trendMap.set(d.toISOString().split("T")[0] ?? "", 0); }
  recentBookings.forEach((b: any) => { const key = new Date(b.date).toISOString().split("T")[0] ?? ""; if (key && trendMap.has(key)) trendMap.set(key, (trendMap.get(key) ?? 0) + 1); });
  const sessionsTrend = Array.from(trendMap.entries()).map(([date, count]) => ({ label: new Date(date).toLocaleDateString("en-IN", { day: "numeric", month: "short" }), count }));

  const sportCountMap = new Map<string, number>();
  allBookings.forEach((b: any) => { const s = b.sport as string; sportCountMap.set(s, (sportCountMap.get(s) ?? 0) + 1); });
  const total = allBookings.length;
  const sportBreakdown = Array.from(sportCountMap.entries()).map(([sport, count]) => ({ sport, count, percentage: total > 0 ? Math.round((count / total) * 100) : 0 })).sort((a, b) => b.count - a.count);

  const hourMap = new Map<number, number>();
  for (let h = 6; h <= 21; h++) hourMap.set(h, 0);
  allBookings.forEach((b: any) => { if (b.startTime) { const h = parseInt((b.startTime as string).split(":")[0] ?? "0"); if (hourMap.has(h)) hourMap.set(h, (hourMap.get(h) ?? 0) + 1); } });
  const popularHours = Array.from(hourMap.entries()).map(([hour, count]) => ({ hour, count })).sort((a, b) => a.hour - b.hour);

  return {
    overview: { totalSessions: allBookings.length, completedSessions: completed.length, completionRate, totalStudents: studentIds.length, returningStudents: returningSet.size, retentionRate, totalVenues: venueIds.length, totalCoaches: coachIds.length },
    sessionsTrend, sportBreakdown, popularHours,
    studentRetention: { newStudents: studentIds.length - returningSet.size, returningStudents: returningSet.size },
  };
};
