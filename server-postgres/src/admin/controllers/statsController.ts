import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import prisma from "../../lib/prisma";
import { WebhookRecoveryService } from "../../shared/controllers/WebhookController";
import { getObservabilitySnapshot } from "../../middleware/observability";
import { transformDocuments } from "../../middleware/responseTransform";
import { isUserOnline } from "../../shared/services/UserPresenceService";
import { getAllVenues as getAllVenuesService } from "../../client/services/VenueService";
import { getPaginationParams } from "../../utils/pagination";

type AdminUserRole = "Player" | "Coach" | "VenueLister" | "EXPERT" | "Parent";

type FunnelSource = "WEB" | "MOBILE" | "SERVER";

const USER_ROLE_SET: ReadonlySet<AdminUserRole> = new Set([
  "Player",
  "Coach",
  "VenueLister",
  "EXPERT",
  "Parent",
]);

const FUNNEL_SOURCE_SET: ReadonlySet<FunnelSource> = new Set([
  "WEB",
  "MOBILE",
  "SERVER",
]);

const MONTH_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  year: "numeric",
});

const DAY_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const getRoleFromQuery = (value: unknown): AdminUserRole | null => {
  if (typeof value !== "string") return null;
  return USER_ROLE_SET.has(value as AdminUserRole)
    ? (value as AdminUserRole)
    : null;
};

const getStartOfCurrentMonth = (): Date => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
};

const getTwentyFourHoursAgo = (): Date => {
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
};

const getMonthKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
};

const getMonthLabel = (date: Date): string => {
  return MONTH_FORMATTER.format(date);
};

const getDayKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDayLabel = (date: Date): string => {
  return DAY_FORMATTER.format(date);
};

const buildMonthSeries = (
  months: number,
): Array<{ key: string; label: string }> => {
  const series: Array<{ key: string; label: string }> = [];
  const current = new Date();
  current.setDate(1);
  current.setHours(0, 0, 0, 0);

  for (let index = months - 1; index >= 0; index -= 1) {
    const date = new Date(current.getFullYear(), current.getMonth() - index, 1);
    series.push({ key: getMonthKey(date), label: getMonthLabel(date) });
  }

  return series;
};

const buildDaySeries = (
  days: number,
): Array<{ key: string; label: string }> => {
  const series: Array<{ key: string; label: string }> = [];
  const start = new Date();
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);

  for (let index = 0; index < days; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    series.push({ key: getDayKey(date), label: getDayLabel(date) });
  }

  return series;
};

export const getPublicPlatformStats = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const [totalUsers, roleCounts] = await Promise.all([
      prisma.user.count(),
      prisma.user.groupBy({
        by: ["role"],
        where: { role: { in: ["Player", "Coach", "VenueLister"] } },
        _count: { _all: true },
      }),
    ]);

    const summary = {
      Player: 0,
      Coach: 0,
      VenueLister: 0,
    };

    for (const item of roleCounts) {
      if (item.role in summary) {
        summary[item.role as keyof typeof summary] = item._count._all;
      }
    }

    res.status(200).json({
      success: true,
      message: "Public platform stats retrieved",
      data: {
        totalUsers,
        roleCounts: summary,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get stats",
    });
  }
};

// Get platform statistics
export const getPlatformStats = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const [
      totalUsers,
      totalVenues,
      totalBookings,
      pendingInquiries,
      revenueResult,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.venue.count(),
      prisma.booking.count(),
      prisma.venueInquiry.count({ where: { status: "PENDING" } }),
      prisma.booking.aggregate({
        where: { status: "CONFIRMED" },
        _sum: { totalAmount: true },
      }),
    ]);

    const revenue = revenueResult._sum.totalAmount || 0;

    res.status(200).json({
      success: true,
      message: "Platform stats retrieved",
      data: {
        totalUsers,
        totalVenues,
        totalBookings,
        pendingInquiries,
        revenue,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get stats",
    });
  }
};

// Get all users
export const getAllUsers = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const role = getRoleFromQuery(req.query.role);
    const { page, limit, skip } = getPaginationParams(
      req.query.page,
      req.query.limit,
      15,
      100,
    );

    const where: Prisma.UserWhereInput = role ? { role } : {};
    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          role: true,
          createdAt: true,
          lastActiveAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    // id is already the primary key in Postgres
    const transformedUsers = users.map((user) => ({
      ...user,
      id: user.id,
    }));

    res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      data: transformedUsers,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to get users",
    });
  }
};

const makeRoleUsersHandler =
  (role: AdminUserRole) =>
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { page, limit, skip } = getPaginationParams(
        req.query.page,
        req.query.limit,
        15,
        100,
      );
      const [total, users] = await Promise.all([
        prisma.user.count({ where: { role } }),
        prisma.user.findMany({
          where: { role },
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            role: true,
            createdAt: true,
            lastActiveAt: true,
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
      ]);
      const transformedUsers = users.map((user) => ({
        ...user,
        id: user.id,
      }));
      res.status(200).json({
        success: true,
        message: `${role} users retrieved successfully`,
        data: transformedUsers,
        pagination: { total, page, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Failed to get users",
      });
    }
  };

export const getExpertUsers = makeRoleUsersHandler("EXPERT");
export const getParentUsers = makeRoleUsersHandler("Parent");

export const getUserRoleSummary = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const roleCounts = await prisma.user.groupBy({
      by: ["role"],
      where: {
        role: { in: ["Player", "Coach", "VenueLister", "EXPERT", "Parent"] },
      },
      _count: { _all: true },
    });

    const summary = {
      EXPERT: 0,
      Parent: 0,
      Player: 0,
      Coach: 0,
      VenueLister: 0,
    };

    for (const item of roleCounts) {
      if (item.role in summary) {
        summary[item.role as keyof typeof summary] = item._count._all;
      }
    }

    res.status(200).json({
      success: true,
      message: "User role summary retrieved successfully",
      data: summary,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to retrieve user role summary",
    });
  }
};

export const getUserGrowthAnalytics = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const months = Math.min(12, Math.max(3, Number(req.query.months) || 6));
    const start = new Date();
    start.setMonth(start.getMonth() - (months - 1));
    start.setDate(1);
    start.setHours(0, 0, 0, 0);

    // TODO(prisma): verify aggregation SQL — monthly, per-role user signups.
    // Mirrors the Mongo $dateToString('%Y-%m') + $group by { month, role }.
    const growth = await prisma.$queryRaw<
      Array<{ month: string; role: string; count: bigint }>
    >(Prisma.sql`
      SELECT
        to_char(date_trunc('month', "createdAt"), 'YYYY-MM') AS month,
        role::text AS role,
        COUNT(*)::bigint AS count
      FROM users
      WHERE role IN ('Player', 'Coach', 'VenueLister')
        AND "createdAt" >= ${start}
      GROUP BY 1, 2
      ORDER BY 1, 2
    `);

    const monthSeries = buildMonthSeries(months);
    const monthBuckets = new Map(
      monthSeries.map((item) => [
        item.key,
        { ...item, total: 0, Player: 0, Coach: 0, VenueLister: 0 },
      ]),
    );

    for (const row of growth) {
      const bucket = monthBuckets.get(row.month);
      if (!bucket) continue;

      const role = row.role as keyof typeof bucket;
      const count = Number(row.count);
      if (role in bucket && typeof bucket[role] === "number") {
        (bucket[role] as number) += count;
      }
      bucket.total += count;
    }

    res.status(200).json({
      success: true,
      message: "User growth analytics retrieved successfully",
      data: {
        months,
        series: Array.from(monthBuckets.values()),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to retrieve user growth analytics",
    });
  }
};

export const getPlayersUsers = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(
      req.query.page,
      req.query.limit,
      15,
      100,
    );

    const [total, users] = await Promise.all([
      prisma.user.count({ where: { role: "Player" } }),
      prisma.user.findMany({
        where: { role: "Player" },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          createdAt: true,
          lastActiveAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    const userIds = users.map((user) => user.id);
    const playerProfiles = await prisma.player.findMany({
      where: { userId: { in: userIds } },
    });

    const profilesByUserId = new Map<string, typeof playerProfiles>();
    for (const profile of playerProfiles) {
      const uidStr = profile.userId;
      if (!profilesByUserId.has(uidStr)) {
        profilesByUserId.set(uidStr, []);
      }
      profilesByUserId.get(uidStr)!.push(profile);
    }

    const data = await Promise.all(
      users.map(async (user) => {
        const userProfiles = profilesByUserId.get(user.id) || [];

        const selfProfile = userProfiles.find((p) => p.type === "SELF");
        const dependentsProfiles = userProfiles.filter(
          (p) => p.type === "DEPENDENT",
        );

        const sports = selfProfile?.sportsFocus || [];
        const sportsCount = sports.length;
        const dependentsCount = dependentsProfiles.length;
        const hasSportsProfile = sportsCount > 0;

        const dependents = dependentsProfiles.map((d) => ({
          id: d.id,
          name: d.name,
          age: d.age,
          gender: d.gender,
          sports: d.sportsFocus || [],
          skillLevel: d.skillLevel,
        }));

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: "Player",
          createdAt: user.createdAt,
          lastActiveAt: user.lastActiveAt || user.createdAt,
          isOnlineNow: await isUserOnline(user.id),
          sports,
          sportsCount,
          hasSportsProfile,
          dependents,
          dependentsCount,
        };
      }),
    );

    res.status(200).json({
      success: true,
      message: "Players retrieved successfully",
      data,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to retrieve players",
    });
  }
};

export const getCoachUsers = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(
      req.query.page,
      req.query.limit,
      15,
      100,
    );

    const total = await prisma.user.count({ where: { role: "Coach" } });
    const users = await prisma.user.findMany({
      where: { role: "Coach" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        lastActiveAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    const userIds = users.map((user) => user.id);
    const coachProfiles = await prisma.coach.findMany({
      where: { userId: { in: userIds } },
      select: {
        userId: true,
        sports: true,
        hourlyRate: true,
        serviceMode: true,
        verificationStatus: true,
        isVerified: true,
        rating: true,
        reviewCount: true,
      },
    });

    const coachByUserId = new Map(
      coachProfiles.map((profile) => [profile.userId, profile]),
    );

    const data = await Promise.all(
      users.map(async (user) => {
        const profile = coachByUserId.get(user.id);
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: "Coach",
          createdAt: user.createdAt,
          lastActiveAt: user.lastActiveAt || user.createdAt,
          isOnlineNow: await isUserOnline(user.id),
          sports: profile?.sports || [],
          hourlyRate: profile?.hourlyRate ?? null,
          serviceMode: profile?.serviceMode ?? null,
          verificationStatus: profile?.verificationStatus ?? "UNVERIFIED",
          isVerified: profile?.isVerified ?? false,
          rating: profile?.rating ?? 0,
          reviewCount: profile?.reviewCount ?? 0,
          profileIncomplete: !profile,
        };
      }),
    );

    res.status(200).json({
      success: true,
      message: "Coaches retrieved successfully",
      data,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to retrieve coaches",
    });
  }
};

export const getVenueListerUsers = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(
      req.query.page,
      req.query.limit,
      15,
      100,
    );

    const total = await prisma.user.count({ where: { role: "VenueLister" } });
    const users = await prisma.user.findMany({
      where: { role: "VenueLister" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        createdAt: true,
        lastActiveAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    const ownerIds = users.map((user) => user.id);
    // The Mongo $group-with-$cond over ownerId is expressed here as a bounded
    // fetch (owners are a single page) with the counts computed in code.
    const venues = await prisma.venue.findMany({
      where: { ownerId: { in: ownerIds } },
      select: { ownerId: true, approvalStatus: true },
    });

    const venueCountByOwnerId = new Map<
      string,
      {
        venueCount: number;
        approvedVenueCount: number;
        pendingVenueCount: number;
      }
    >();
    for (const venue of venues) {
      if (!venue.ownerId) continue;
      const counts = venueCountByOwnerId.get(venue.ownerId) ?? {
        venueCount: 0,
        approvedVenueCount: 0,
        pendingVenueCount: 0,
      };
      counts.venueCount += 1;
      if (venue.approvalStatus === "APPROVED") {
        counts.approvedVenueCount += 1;
      }
      if (
        venue.approvalStatus === "PENDING" ||
        venue.approvalStatus === "REVIEW"
      ) {
        counts.pendingVenueCount += 1;
      }
      venueCountByOwnerId.set(venue.ownerId, counts);
    }

    const data = await Promise.all(
      users.map(async (user) => {
        const counts = venueCountByOwnerId.get(user.id);
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: "VenueLister",
          createdAt: user.createdAt,
          lastActiveAt: user.lastActiveAt || user.createdAt,
          isOnlineNow: await isUserOnline(user.id),
          businessName: "",
          canAddMoreVenues: false,
          venueCount: counts?.venueCount ?? 0,
          approvedVenueCount: counts?.approvedVenueCount ?? 0,
          pendingVenueCount: counts?.pendingVenueCount ?? 0,
        };
      }),
    );

    res.status(200).json({
      success: true,
      message: "Venue listers retrieved successfully",
      data,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to retrieve venue listers",
    });
  }
};

export const getPlayersAnalytics = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const monthStart = getStartOfCurrentMonth();
    const twentyFourHoursAgo = getTwentyFourHoursAgo();

    // NOTE: the Mongo version read embedded `playerProfile.sports` / `dependents`
    // off the User doc. Those are now the normalized Player table, so
    // withSportsProfile = SELF players with a non-empty sportsFocus and
    // withDependents = distinct users owning at least one DEPENDENT player.
    const [
      totalPlayers,
      newThisMonth,
      withSportsProfile,
      withDependents,
      newAccountsLast24Hours,
    ] = await Promise.all([
      prisma.user.count({ where: { role: "Player" } }),
      prisma.user.count({
        where: { role: "Player", createdAt: { gte: monthStart } },
      }),
      prisma.player.count({
        where: { type: "SELF", sportsFocus: { isEmpty: false } },
      }),
      prisma.player
        .groupBy({ by: ["userId"], where: { type: "DEPENDENT" } })
        .then((rows) => rows.length),
      prisma.user.count({
        where: { role: "Player", createdAt: { gte: twentyFourHoursAgo } },
      }),
    ]);

    res.status(200).json({
      success: true,
      message: "Players analytics retrieved successfully",
      data: {
        totalPlayers,
        newThisMonth,
        withSportsProfile,
        withDependents,
        newAccountsLast24Hours,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to retrieve players analytics",
    });
  }
};

export const getFunnelTrends = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const days = Math.min(90, Math.max(7, Number(req.query.days) || 30));
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));
    start.setHours(0, 0, 0, 0);

    // TODO(prisma): verify aggregation SQL — daily analytics events per source.
    // Mirrors the Mongo $dateToString('%Y-%m-%d') + $group by { day, source }.
    const trendRows = await prisma.$queryRaw<
      Array<{ day: string; source: string; count: bigint }>
    >(Prisma.sql`
      SELECT
        to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day,
        source::text AS source,
        COUNT(*)::bigint AS count
      FROM analytics_events
      WHERE "createdAt" >= ${start}
        AND source IN ('WEB', 'MOBILE', 'SERVER')
      GROUP BY 1, 2
      ORDER BY 1, 2
    `);

    const daySeries = buildDaySeries(days);
    const dayBuckets = new Map(
      daySeries.map((item) => [
        item.key,
        { ...item, total: 0, WEB: 0, MOBILE: 0, SERVER: 0 },
      ]),
    );

    const sourceTotals: Record<FunnelSource, number> = {
      WEB: 0,
      MOBILE: 0,
      SERVER: 0,
    };

    for (const row of trendRows) {
      const bucket = dayBuckets.get(row.day);
      if (!bucket) continue;

      const source = row.source as FunnelSource;
      if (!FUNNEL_SOURCE_SET.has(source)) continue;
      const count = Number(row.count);
      bucket[source] += count;
      bucket.total += count;
      sourceTotals[source] += count;
    }

    res.status(200).json({
      success: true,
      message: "Funnel trends retrieved successfully",
      data: {
        days,
        dailyActivity: Array.from(dayBuckets.values()),
        sourceBreakdown: (Object.keys(sourceTotals) as FunnelSource[]).map(
          (source) => ({
            source,
            count: sourceTotals[source],
          }),
        ),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to retrieve funnel trends",
    });
  }
};

export const getCoachesAnalytics = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const twentyFourHoursAgo = getTwentyFourHoursAgo();

    const [
      totalCoaches,
      verifiedCount,
      pendingOrReviewCount,
      ratingAggregate,
      newAccountsLast24Hours,
    ] = await Promise.all([
      prisma.user.count({ where: { role: "Coach" } }),
      prisma.coach.count({ where: { isVerified: true } }),
      prisma.coach.count({
        where: { verificationStatus: { in: ["PENDING", "REVIEW"] } },
      }),
      prisma.coach.aggregate({ _avg: { rating: true } }),
      prisma.user.count({
        where: { role: "Coach", createdAt: { gte: twentyFourHoursAgo } },
      }),
    ]);

    res.status(200).json({
      success: true,
      message: "Coaches analytics retrieved successfully",
      data: {
        totalCoaches,
        verifiedCount,
        pendingOrReviewCount,
        avgRating: Number((ratingAggregate._avg.rating ?? 0).toFixed(2)),
        newAccountsLast24Hours,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to retrieve coaches analytics",
    });
  }
};

export const getVenueListersAnalytics = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const twentyFourHoursAgo = getTwentyFourHoursAgo();

    // withAtLeastOneVenue = number of distinct owners (any venue); the approved
    // and pending totals are simple counts across every venue, matching the
    // two-stage Mongo $group.
    const [
      totalVenueListers,
      newAccountsLast24Hours,
      ownerGroups,
      approvedVenuesCount,
      pendingVenuesCount,
    ] = await Promise.all([
      prisma.user.count({ where: { role: "VenueLister" } }),
      prisma.user.count({
        where: {
          role: "VenueLister",
          createdAt: { gte: twentyFourHoursAgo },
        },
      }),
      prisma.venue.groupBy({ by: ["ownerId"] }),
      prisma.venue.count({ where: { approvalStatus: "APPROVED" } }),
      prisma.venue.count({
        where: { approvalStatus: { in: ["PENDING", "REVIEW"] } },
      }),
    ]);

    res.status(200).json({
      success: true,
      message: "Venue listers analytics retrieved successfully",
      data: {
        totalVenueListers,
        newAccountsLast24Hours,
        withAtLeastOneVenue: ownerGroups.length,
        approvedVenuesCount,
        pendingVenuesCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to retrieve venue listers analytics",
    });
  }
};

// Get all venues
export const getAllVenues = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { page, limit } = getPaginationParams(
      req.query.page,
      req.query.limit,
      20,
      100,
    );
    const search =
      typeof req.query.search === "string" ? req.query.search : undefined;

    // Using the service method matching the new signature
    const result = await getAllVenuesService(
      search ? { search } : {},
      page,
      limit,
    );

    res.status(200).json({
      success: true,
      message: "All venues retrieved successfully",
      data: transformDocuments(result.venues),
      pagination: {
        total: result.total,
        page: result.page,
        totalPages: result.totalPages,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch venues",
    });
  }
};

export const getAllBookings = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(
      req.query.page,
      req.query.limit,
      20,
      100,
    );

    const total = await prisma.booking.count();
    const bookings = await prisma.booking.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    });

    // No Prisma relations exist for the userId / venueId / coachId String FKs,
    // so batch-load each referenced entity and join in code to reproduce the
    // populated response the admin bookings table expects.
    const userIds = bookings.map((booking) => booking.userId).filter(Boolean);
    const venueIds = bookings
      .map((booking) => booking.venueId)
      .filter((value): value is string => Boolean(value));
    const coachIds = bookings
      .map((booking) => booking.coachId)
      .filter((value): value is string => Boolean(value));

    const [players, venues, coaches] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, name: true, email: true },
      }),
      prisma.venue.findMany({ where: { id: { in: venueIds } } }),
      prisma.coach.findMany({ where: { id: { in: coachIds } } }),
    ]);

    const coachUserIds = coaches.map((coach) => coach.userId);
    const coachUsers = await prisma.user.findMany({
      where: { id: { in: coachUserIds } },
      select: { id: true, name: true, email: true },
    });

    const playerById = new Map(players.map((player) => [player.id, player]));
    const venueById = new Map(venues.map((venue) => [venue.id, venue]));
    const coachById = new Map(coaches.map((coach) => [coach.id, coach]));
    const coachUserById = new Map(
      coachUsers.map((coachUser) => [coachUser.id, coachUser]),
    );

    const transformedBookings = bookings.map((booking) => {
      const player = playerById.get(booking.userId) ?? null;
      const venue = booking.venueId
        ? (venueById.get(booking.venueId) ?? null)
        : null;
      const coach = booking.coachId
        ? (coachById.get(booking.coachId) ?? null)
        : null;
      const coachUser = coach
        ? (coachUserById.get(coach.userId) ?? null)
        : null;

      return {
        ...booking,
        id: booking.id,
        userId: booking.userId,
        venueId: venue ? { ...venue, id: venue.id } : booking.venueId,
        coachId: coach
          ? { ...coach, id: coach.id, userId: coachUser ?? coach.userId }
          : booking.coachId,
        playerName: player?.name || player?.email || "",
        venueName: venue?.name || "",
        coachName: coachUser?.name || coachUser?.email || "",
      };
    });

    res.status(200).json({
      success: true,
      message: "All bookings retrieved successfully",
      data: transformedBookings,
      pagination: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to fetch bookings",
    });
  }
};

export const trackFunnelEvent = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { eventName, entityType, entityId, metadata, source } = req.body as {
      eventName: string;
      entityType?: string;
      entityId?: string;
      metadata?: Record<string, unknown>;
      source?: "WEB" | "MOBILE" | "SERVER";
    };

    const data: Prisma.AnalyticsEventCreateInput = {
      eventName,
      source: source || "WEB",
    };
    if (req.user?.id) data.userId = req.user.id;
    if (entityType) data.entityType = entityType;
    if (entityId) data.entityId = entityId;
    if (metadata) data.metadata = metadata as Prisma.InputJsonValue;

    await prisma.analyticsEvent.create({ data });

    res.status(201).json({
      success: true,
      message: "Funnel event tracked",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to track event",
    });
  }
};

export const getFunnelSummary = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 30));
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // TODO(prisma): verify aggregation SQL — per-event counts + unique users.
    // Mirrors the Mongo $group by eventName with $addToSet(userId) -> $size.
    const grouped = await prisma.$queryRaw<
      Array<{ eventName: string; count: bigint; uniqueUsers: bigint }>
    >(Prisma.sql`
      SELECT
        "eventName" AS "eventName",
        COUNT(*)::bigint AS count,
        COUNT(DISTINCT "userId")::bigint AS "uniqueUsers"
      FROM analytics_events
      WHERE "createdAt" >= ${start}
      GROUP BY "eventName"
      ORDER BY count DESC
    `);

    res.status(200).json({
      success: true,
      message: "Funnel summary retrieved",
      data: {
        days,
        events: grouped.map((entry) => ({
          eventName: entry.eventName,
          count: Number(entry.count),
          uniqueUsers: Number(entry.uniqueUsers),
        })),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to fetch funnel summary",
    });
  }
};

export const getFinanceReconciliation = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    // Run entirely in Postgres — payments are now the normalized
    // booking_payment_legs table, summed per booking and compared to totalAmount.
    const [summaryRows, mismatchRows] = await Promise.all([
      // TODO(prisma): verify aggregation SQL — reconciliation summary totals.
      prisma.$queryRaw<
        Array<{ total: bigint; matched: bigint; mismatched: bigint }>
      >(Prisma.sql`
        WITH paid AS (
          SELECT
            b.id,
            b."totalAmount",
            COALESCE(
              SUM(CASE WHEN l.status = 'PAID' THEN l.amount ELSE 0 END),
              0
            ) AS paid_amount
          FROM bookings b
          LEFT JOIN booking_payment_legs l ON l."bookingId" = b.id
          WHERE b.status IN ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW')
          GROUP BY b.id, b."totalAmount"
        )
        SELECT
          COUNT(*)::bigint AS total,
          COUNT(*) FILTER (WHERE ABS("totalAmount" - paid_amount) <= 1)::bigint AS matched,
          COUNT(*) FILTER (WHERE ABS("totalAmount" - paid_amount) > 1)::bigint AS mismatched
        FROM paid
      `),
      // TODO(prisma): verify aggregation SQL — sample of mismatched bookings.
      prisma.$queryRaw<
        Array<{
          bookingId: string;
          expected: number;
          paid: number;
          status: string;
        }>
      >(Prisma.sql`
        WITH paid AS (
          SELECT
            b.id,
            b."totalAmount",
            b.status,
            b."createdAt",
            COALESCE(
              SUM(CASE WHEN l.status = 'PAID' THEN l.amount ELSE 0 END),
              0
            ) AS paid_amount
          FROM bookings b
          LEFT JOIN booking_payment_legs l ON l."bookingId" = b.id
          WHERE b.status IN ('CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW')
          GROUP BY b.id, b."totalAmount", b.status, b."createdAt"
        )
        SELECT
          id AS "bookingId",
          "totalAmount" AS expected,
          paid_amount::int AS paid,
          status::text AS status
        FROM paid
        WHERE ABS("totalAmount" - paid_amount) > 1
        ORDER BY "createdAt" DESC
        LIMIT 25
      `),
    ]);

    const summary = summaryRows[0] ?? {
      total: BigInt(0),
      matched: BigInt(0),
      mismatched: BigInt(0),
    };
    const totalsTotal = Number(summary.total);
    const totalsMatched = Number(summary.matched);
    const totalsMismatched = Number(summary.mismatched);

    res.status(200).json({
      success: true,
      message: "Finance reconciliation generated",
      data: {
        totalBookingsChecked: totalsTotal,
        matched: totalsMatched,
        mismatched: totalsMismatched,
        mismatchRate:
          totalsTotal > 0
            ? Number((totalsMismatched / totalsTotal).toFixed(4))
            : 0,
        sampleMismatches: mismatchRows,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to generate reconciliation",
    });
  }
};

export const getObservabilityStats = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    res.status(200).json({
      success: true,
      message: "Observability snapshot retrieved",
      data: getObservabilitySnapshot(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to retrieve observability stats",
    });
  }
};

// ─── Guest (anonymous visitor) analytics ──────────────────────────────────────

// Only events carrying a guestId — i.e. activity from not-signed-in visitors.
// Expressed inline in the SQL below as: "guestId" IS NOT NULL AND "guestId" <> ''

/**
 * Public, unauthenticated ingest for anonymous visitor activity.
 *
 * Privacy: we ONLY persist what the schema allows — a random client-generated
 * guestId plus event names/paths/metadata. No IP, no headers, no personal data
 * is stored here.
 */
export const trackGuestEvents = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { guestId, events } = req.body as {
      guestId: string;
      events: Array<{
        eventName: string;
        entityType?: string;
        entityId?: string;
        metadata?: Record<string, unknown>;
      }>;
    };

    const docs = events.map((event) => ({
      guestId,
      eventName: event.eventName,
      ...(event.entityType ? { entityType: event.entityType } : {}),
      ...(event.entityId ? { entityId: event.entityId } : {}),
      ...(event.metadata
        ? { metadata: event.metadata as Prisma.InputJsonValue }
        : {}),
      source: "WEB" as const,
    }));

    await prisma.analyticsEvent.createMany({
      data: docs as Prisma.AnalyticsEventCreateManyInput[],
    });

    res.status(201).json({
      success: true,
      message: "Guest events tracked",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to track guest events",
    });
  }
};

export const getGuestActivity = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 30));
    const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [totalsAgg, topPagesRaw, topEventsRaw, dailyAgg, engagementAgg] =
      await Promise.all([
        // TODO(prisma): verify aggregation SQL — guest totals (events, unique
        // guests, page views).
        prisma.$queryRaw<
          Array<{ events: bigint; uniqueGuests: bigint; pageViews: bigint }>
        >(Prisma.sql`
          SELECT
            COUNT(*)::bigint AS events,
            COUNT(DISTINCT "guestId")::bigint AS "uniqueGuests",
            COUNT(*) FILTER (WHERE "eventName" = 'page_view')::bigint AS "pageViews"
          FROM analytics_events
          WHERE "guestId" IS NOT NULL AND "guestId" <> ''
            AND "createdAt" >= ${start}
        `),
        // TODO(prisma): verify aggregation SQL — top pages by page_view.
        prisma.$queryRaw<
          Array<{ path: string; views: bigint; uniqueGuests: bigint }>
        >(Prisma.sql`
          SELECT
            COALESCE("entityId", '(unknown)') AS path,
            COUNT(*)::bigint AS views,
            COUNT(DISTINCT "guestId")::bigint AS "uniqueGuests"
          FROM analytics_events
          WHERE "guestId" IS NOT NULL AND "guestId" <> ''
            AND "createdAt" >= ${start}
            AND "eventName" = 'page_view'
          GROUP BY "entityId"
          ORDER BY views DESC
          LIMIT 20
        `),
        // TODO(prisma): verify aggregation SQL — top events by count.
        prisma.$queryRaw<
          Array<{ eventName: string; count: bigint; uniqueGuests: bigint }>
        >(Prisma.sql`
          SELECT
            "eventName" AS "eventName",
            COUNT(*)::bigint AS count,
            COUNT(DISTINCT "guestId")::bigint AS "uniqueGuests"
          FROM analytics_events
          WHERE "guestId" IS NOT NULL AND "guestId" <> ''
            AND "createdAt" >= ${start}
          GROUP BY "eventName"
          ORDER BY count DESC
          LIMIT 20
        `),
        // TODO(prisma): verify aggregation SQL — daily page views.
        prisma.$queryRaw<
          Array<{ day: string; views: bigint; uniqueGuests: bigint }>
        >(Prisma.sql`
          SELECT
            to_char(date_trunc('day', "createdAt"), 'YYYY-MM-DD') AS day,
            COUNT(*)::bigint AS views,
            COUNT(DISTINCT "guestId")::bigint AS "uniqueGuests"
          FROM analytics_events
          WHERE "guestId" IS NOT NULL AND "guestId" <> ''
            AND "createdAt" >= ${start}
            AND "eventName" = 'page_view'
          GROUP BY 1
          ORDER BY 1
        `),
        // TODO(prisma): verify aggregation SQL — page_exit engagement averages
        // read from the metadata JSONB blob.
        prisma.$queryRaw<Array<{ avgScroll: number | null; avgTime: number | null }>>(
          Prisma.sql`
            SELECT
              AVG(("metadata"->>'scrollDepthPct')::float) AS "avgScroll",
              AVG(("metadata"->>'durationMs')::float) AS "avgTime"
            FROM analytics_events
            WHERE "guestId" IS NOT NULL AND "guestId" <> ''
              AND "createdAt" >= ${start}
              AND "eventName" = 'page_exit'
          `,
        ),
      ]);

    const totals = totalsAgg[0]
      ? {
          events: Number(totalsAgg[0].events),
          uniqueGuests: Number(totalsAgg[0].uniqueGuests),
          pageViews: Number(totalsAgg[0].pageViews),
        }
      : { events: 0, uniqueGuests: 0, pageViews: 0 };
    const engagement = engagementAgg[0] ?? { avgScroll: 0, avgTime: 0 };

    const topPages = topPagesRaw.map((row) => ({
      path: row.path,
      views: Number(row.views),
      uniqueGuests: Number(row.uniqueGuests),
    }));
    const topEvents = topEventsRaw.map((row) => ({
      eventName: row.eventName,
      count: Number(row.count),
      uniqueGuests: Number(row.uniqueGuests),
    }));

    const daySeries = buildDaySeries(days);
    const dayMap = new Map(dailyAgg.map((row) => [row.day, row]));
    const daily = daySeries.map((point) => {
      const row = dayMap.get(point.key);
      return {
        label: point.label,
        views: row ? Number(row.views) : 0,
        uniqueGuests: row ? Number(row.uniqueGuests) : 0,
      };
    });

    res.status(200).json({
      success: true,
      message: "Guest activity retrieved",
      data: {
        days,
        totals: {
          events: totals.events,
          uniqueGuests: totals.uniqueGuests,
          pageViews: totals.pageViews,
          avgScrollPct: Math.round(engagement.avgScroll ?? 0),
          avgTimeOnPageSec: Math.round((engagement.avgTime ?? 0) / 1000),
        },
        topPages,
        topEvents,
        daily,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to retrieve guest activity",
    });
  }
};

/**
 * Permanently delete every analytics event. Destructive and irreversible —
 * gated behind admin auth and a confirmation step in the admin UI.
 */
export const clearAnalyticsData = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const result = await prisma.analyticsEvent.deleteMany({});
    res.status(200).json({
      success: true,
      message: "Analytics data cleared",
      data: { deletedCount: result.count ?? 0 },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to clear analytics data",
    });
  }
};

/**
 * Lightweight actionable-item counts for admin nav badges. Each count mirrors
 * the exact filter its own list page treats as "still needs admin action".
 */
export const getPendingCounts = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const [
      academyOnboarding,
      coachVerification,
      venueApprovals,
      communityReports,
      disputes,
      supportTickets,
      conciergeRequests,
    ] = await Promise.all([
      prisma.academy.count({
        where: { onboardingCompleted: true, isApproved: false },
      }),
      prisma.coach.count({ where: { verificationStatus: "PENDING" } }),
      prisma.venue.count({ where: { approvalStatus: "PENDING" } }),
      prisma.communityReport.count({ where: { status: "OPEN" } }),
      prisma.dispute.count({ where: { status: "OPEN" } }),
      prisma.supportTicket.count({ where: { status: "OPEN" } }),
      prisma.conciergeRequest.count({ where: { status: "pending" } }),
    ]);

    res.status(200).json({
      success: true,
      message: "Pending counts retrieved",
      data: {
        academyOnboarding,
        coachVerification,
        venueApprovals,
        communityReports,
        disputes,
        supportTickets,
        conciergeRequests,
        webhookErrors: WebhookRecoveryService.listErrors().length,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to retrieve pending counts",
    });
  }
};

/**
 * GET /admin/stats/unsupported-sports
 * Returns the top unsupported sports searched by users, ranked by frequency.
 */
export const getUnsupportedSportsStats = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const days = Math.min(365, Math.max(7, Number(req.query.days) || 30));
    const since = new Date();
    since.setDate(since.getDate() - days);

    // TODO(prisma): verify aggregation SQL — top unsupported sports searched,
    // grouped on lower(metadata.sport) with the distinct source list.
    const rows = await prisma.$queryRaw<
      Array<{
        sport: string;
        count: bigint;
        lastSearched: Date;
        sources: string[];
      }>
    >(Prisma.sql`
      SELECT
        lower("metadata"->>'sport') AS sport,
        COUNT(*)::bigint AS count,
        MAX("createdAt") AS "lastSearched",
        ARRAY_AGG(DISTINCT "metadata"->>'source') AS sources
      FROM analytics_events
      WHERE "eventName" = 'unsupported_sport_search'
        AND "createdAt" >= ${since}
      GROUP BY lower("metadata"->>'sport')
      ORDER BY count DESC
      LIMIT 25
    `);

    const mapped = rows.map((row) => ({
      sport: row.sport,
      count: Number(row.count),
      lastSearched: row.lastSearched,
      sources: row.sources,
    }));

    const totalSearches = mapped.reduce((sum, r) => sum + r.count, 0);

    res.status(200).json({
      success: true,
      data: { rows: mapped, totalSearches, days },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to retrieve unsupported sports stats",
    });
  }
};
