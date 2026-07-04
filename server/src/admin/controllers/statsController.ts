import { Request, Response } from "express";
import { Booking } from "../../client/models/Booking";
import { Coach } from "../../client/models/Coach";
import { AnalyticsEvent } from "../models/AnalyticsEvent";
import { User } from "../../client/models/User";
import { Player } from "../../client/models/Player";
import { Venue } from "../../client/models/Venue";
import VenueInquiry from "../../client/models/VenueInquiry";
import { Dispute } from "../../client/models/Dispute";
import { SupportTicket } from "../../client/models/SupportTicket";
import { CommunityReport } from "../../community/models/CommunityReport";
import { ConciergeRequest } from "../../shared/models/ConciergeRequest";
import Academy from "../models/Academy";
import { WebhookRecoveryService } from "../../shared/controllers/WebhookController";
import { getObservabilitySnapshot } from "../../middleware/observability";
import { transformDocuments } from "../../middleware/responseTransform";
import { isUserOnline } from "../../shared/services/UserPresenceService";
import { getAllVenues as getAllVenuesService } from "../../client/services/VenueService";
import { getPaginationParams } from "../../utils/pagination";

type AdminUserRole = "Player" | "Coach" | "VenueLister";

type FunnelSource = "WEB" | "MOBILE" | "SERVER";

const USER_ROLE_SET: ReadonlySet<AdminUserRole> = new Set([
  "Player",
  "Coach",
  "VenueLister",
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
      User.countDocuments(),
      User.aggregate<{ _id: string; count: number }>([
        {
          $match: {
            role: { $in: ["Player", "Coach", "VenueLister"] },
          },
        },
        {
          $group: {
            _id: "$role",
            count: { $sum: 1 },
          },
        },
      ]),
    ]);

    const summary = {
      PLAYER: 0,
      COACH: 0,
      VENUE_LISTER: 0,
    };

    for (const item of roleCounts) {
      if (item._id in summary) {
        summary[item._id as keyof typeof summary] = item.count;
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
      User.countDocuments(),
      Venue.countDocuments(),
      Booking.countDocuments(),
      VenueInquiry.countDocuments({ status: "PENDING" }),
      Booking.aggregate([
        { $match: { status: "CONFIRMED" } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$totalAmount" },
          },
        },
      ]),
    ]);

    const revenue = revenueResult[0]?.totalRevenue || 0;

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

    const query = role ? { role } : {};
    const [total, users] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .select(
          "name email phone role createdAt lastActiveAt",
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    // Transform _id to id for frontend
    const transformedUsers = users.map((user) => ({
      ...user,
      id: user._id.toString(),
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

export const getUserRoleSummary = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const roleCounts = await User.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          role: { $in: ["Player", "Coach", "VenueLister"] },
        },
      },
      {
        $group: {
          _id: "$role",
          count: { $sum: 1 },
        },
      },
    ]);

    const summary = {
      PLAYER: 0,
      COACH: 0,
      VENUE_LISTER: 0,
    };

    for (const item of roleCounts) {
      if (item._id in summary) {
        summary[item._id as keyof typeof summary] = item.count;
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

    const growth = await User.aggregate<{
      _id: { month: string; role: AdminUserRole };
      count: number;
    }>([
      {
        $match: {
          role: { $in: ["Player", "Coach", "VenueLister"] },
          createdAt: { $gte: start },
        },
      },
      {
        $group: {
          _id: {
            month: {
              $dateToString: {
                format: "%Y-%m",
                date: "$createdAt",
              },
            },
            role: "$role",
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          "_id.month": 1,
          "_id.role": 1,
        },
      },
    ]);

    const monthSeries = buildMonthSeries(months);
    const monthBuckets = new Map(
      monthSeries.map((item) => [
        item.key,
        { ...item, total: 0, Player: 0, Coach: 0, VenueLister: 0 },
      ]),
    );

    for (const row of growth) {
      const bucket = monthBuckets.get(row._id.month);
      if (!bucket) continue;

      bucket[row._id.role] += row.count;
      bucket.total += row.count;
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

    const query = { role: "Player" };
    const [total, users] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .select(
          "name email phone createdAt lastActiveAt",
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const userIds = users.map((user) => user._id);
    const playerProfiles = await Player.find({ userId: { $in: userIds } }).lean();

    const profilesByUserId = new Map<string, any[]>();
    for (const profile of playerProfiles) {
      const uidStr = profile.userId.toString();
      if (!profilesByUserId.has(uidStr)) {
        profilesByUserId.set(uidStr, []);
      }
      profilesByUserId.get(uidStr)!.push(profile);
    }

    const data = await Promise.all(
      users.map(async (user) => {
        const userProfiles = profilesByUserId.get(user._id.toString()) || [];
        
        const selfProfile = userProfiles.find((p) => p.type === "SELF");
        const dependentsProfiles = userProfiles.filter((p) => p.type === "DEPENDENT");

        const sports = selfProfile?.sportsFocus || [];
        const sportsCount = sports.length;
        const dependentsCount = dependentsProfiles.length;
        const hasSportsProfile = sportsCount > 0;

        const dependents = dependentsProfiles.map((d) => ({
          id: d._id.toString(),
          name: d.name,
          age: d.age,
          gender: d.gender,
          sports: d.sportsFocus || [],
          skillLevel: d.skillLevel,
        }));

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: "Player",
          createdAt: user.createdAt,
          lastActiveAt: user.lastActiveAt || user.createdAt,
          isOnlineNow: await isUserOnline(user._id.toString()),
          sports,
          sportsCount,
          hasSportsProfile,
          dependents,
          dependentsCount,
        };
      })
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

    const query = { role: "Coach" };
    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select("name email phone createdAt lastActiveAt")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const userIds = users.map((user) => user._id);
    const coachProfiles = await Coach.find({ userId: { $in: userIds } })
      .select(
        "userId sports hourlyRate serviceMode verificationStatus isVerified rating reviewCount",
      )
      .lean();

    const coachByUserId = new Map(
      coachProfiles.map((profile) => [profile.userId.toString(), profile]),
    );

    const data = await Promise.all(
      users.map(async (user) => {
        const profile = coachByUserId.get(user._id.toString());
        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: "Coach",
          createdAt: user.createdAt,
          lastActiveAt: user.lastActiveAt || user.createdAt,
          isOnlineNow: await isUserOnline(user._id.toString()),
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

    const query = { role: "VenueLister" };
    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select(
        "name email phone createdAt lastActiveAt",
      )
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const ownerIds = users.map((user) => user._id);
    const venueCounts = await Venue.aggregate<{
      _id: unknown;
      venueCount: number;
      approvedVenueCount: number;
      pendingVenueCount: number;
    }>([
      {
        $match: {
          ownerId: { $in: ownerIds },
        },
      },
      {
        $group: {
          _id: "$ownerId",
          venueCount: { $sum: 1 },
          approvedVenueCount: {
            $sum: {
              $cond: [{ $eq: ["$approvalStatus", "APPROVED"] }, 1, 0],
            },
          },
          pendingVenueCount: {
            $sum: {
              $cond: [
                { $in: ["$approvalStatus", ["PENDING", "REVIEW"]] },
                1,
                0,
              ],
            },
          },
        },
      },
    ]);

    const venueCountByOwnerId = new Map(
      venueCounts.map((item) => [String(item._id), item]),
    );

    const data = await Promise.all(
      users.map(async (user) => {
        const counts = venueCountByOwnerId.get(user._id.toString());
        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: "VenueLister",
          createdAt: user.createdAt,
          lastActiveAt: user.lastActiveAt || user.createdAt,
          isOnlineNow: await isUserOnline(user._id.toString()),
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

    const [
      totalPlayers,
      newThisMonth,
      withSportsProfile,
      withDependents,
      newAccountsLast24Hours,
    ] = await Promise.all([
      User.countDocuments({ role: "Player" }),
      User.countDocuments({
        role: "Player",
        createdAt: { $gte: monthStart },
      }),
      User.countDocuments({
        role: "Player",
        "playerProfile.sports.0": { $exists: true },
      }),
      User.countDocuments({
        role: "Player",
        "dependents.0": { $exists: true },
      }),
      User.countDocuments({
        role: "Player",
        createdAt: { $gte: twentyFourHoursAgo },
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

    const trendRows = await AnalyticsEvent.aggregate<{
      _id: { day: string; source: FunnelSource };
      count: number;
    }>([
      {
        $match: {
          createdAt: { $gte: start },
          source: { $in: Array.from(FUNNEL_SOURCE_SET) },
        },
      },
      {
        $group: {
          _id: {
            day: {
              $dateToString: {
                format: "%Y-%m-%d",
                date: "$createdAt",
              },
            },
            source: "$source",
          },
          count: { $sum: 1 },
        },
      },
      {
        $sort: {
          "_id.day": 1,
          "_id.source": 1,
        },
      },
    ]);

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
      const bucket = dayBuckets.get(row._id.day);
      if (!bucket) continue;

      bucket[row._id.source] += row.count;
      bucket.total += row.count;
      sourceTotals[row._id.source] += row.count;
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
      User.countDocuments({ role: "Coach" }),
      Coach.countDocuments({ isVerified: true }),
      Coach.countDocuments({
        verificationStatus: { $in: ["PENDING", "REVIEW"] },
      }),
      Coach.aggregate<{ _id: null; avgRating: number }>([
        {
          $group: {
            _id: null,
            avgRating: { $avg: "$rating" },
          },
        },
      ]),
      User.countDocuments({
        role: "Coach",
        createdAt: { $gte: twentyFourHoursAgo },
      }),
    ]);

    res.status(200).json({
      success: true,
      message: "Coaches analytics retrieved successfully",
      data: {
        totalCoaches,
        verifiedCount,
        pendingOrReviewCount,
        avgRating: Number((ratingAggregate[0]?.avgRating ?? 0).toFixed(2)),
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

    const [totalVenueListers, newAccountsLast24Hours, venueCountAggregates] =
      await Promise.all([
        User.countDocuments({ role: "VenueLister" }),
        User.countDocuments({
          role: "VenueLister",
          createdAt: { $gte: twentyFourHoursAgo },
        }),
        Venue.aggregate<{
          _id: null;
          withAtLeastOneVenue: number;
          approvedVenuesCount: number;
          pendingVenuesCount: number;
        }>([
          {
            $group: {
              _id: "$ownerId",
              venueCount: { $sum: 1 },
              approvedVenuesCount: {
                $sum: {
                  $cond: [{ $eq: ["$approvalStatus", "APPROVED"] }, 1, 0],
                },
              },
              pendingVenuesCount: {
                $sum: {
                  $cond: [
                    { $in: ["$approvalStatus", ["PENDING", "REVIEW"]] },
                    1,
                    0,
                  ],
                },
              },
            },
          },
          {
            $group: {
              _id: null,
              withAtLeastOneVenue: { $sum: 1 },
              approvedVenuesCount: { $sum: "$approvedVenuesCount" },
              pendingVenuesCount: { $sum: "$pendingVenuesCount" },
            },
          },
        ]),
      ]);

    const aggregates = venueCountAggregates[0];

    res.status(200).json({
      success: true,
      message: "Venue listers analytics retrieved successfully",
      data: {
        totalVenueListers,
        newAccountsLast24Hours,
        withAtLeastOneVenue: aggregates?.withAtLeastOneVenue ?? 0,
        approvedVenuesCount: aggregates?.approvedVenuesCount ?? 0,
        pendingVenuesCount: aggregates?.pendingVenuesCount ?? 0,
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

    const total = await Booking.countDocuments();
    const bookings = await Booking.find()
      .populate("userId venueId")
      .populate({
        path: "coachId",
        populate: { path: "userId", select: "name email" },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const toId = (value: unknown): string => {
      if (!value) return "";
      if (typeof value === "string") return value;
      if (typeof value === "object") {
        const candidate = value as { _id?: unknown; id?: unknown };
        if (typeof candidate.id === "string") return candidate.id;
        if (
          candidate._id &&
          typeof (candidate._id as { toString?: () => string }).toString ===
            "function"
        ) {
          return (candidate._id as { toString: () => string }).toString();
        }
      }
      return "";
    };

    const normalizeEntity = (value: unknown): unknown => {
      if (!value || typeof value === "string") {
        return value;
      }

      if (typeof value === "object") {
        const plain = value as Record<string, unknown>;
        return {
          ...plain,
          id: toId(value),
        };
      }

      return value;
    };

    const transformedBookings = bookings.map((booking) => {
      const plain = booking as unknown as Record<string, unknown>;

      const playerRecord =
        plain.userId && typeof plain.userId === "object"
          ? (plain.userId as { name?: string; email?: string })
          : null;
      const venueRecord =
        plain.venueId && typeof plain.venueId === "object"
          ? (plain.venueId as { name?: string })
          : null;
      const coachRecord =
        plain.coachId && typeof plain.coachId === "object"
          ? (plain.coachId as { userId?: unknown; name?: string })
          : null;
      const coachUserRecord =
        coachRecord?.userId && typeof coachRecord.userId === "object"
          ? (coachRecord.userId as { name?: string; email?: string })
          : null;

      return {
        ...plain,
        id: toId(booking),
        userId: toId(plain.userId),
        venueId: normalizeEntity(plain.venueId),
        coachId: normalizeEntity(plain.coachId),
        playerName: playerRecord?.name || playerRecord?.email || "",
        venueName: venueRecord?.name || "",
        coachName:
          coachUserRecord?.name ||
          coachUserRecord?.email ||
          coachRecord?.name ||
          "",
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

    await AnalyticsEvent.create({
      ...(req.user?.id ? { userId: req.user.id } : {}),
      eventName,
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...(metadata ? { metadata } : {}),
      source: source || "WEB",
    });

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

    const grouped = await AnalyticsEvent.aggregate<{
      _id: string;
      count: number;
      uniqueUsers: number;
    }>([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: "$eventName",
          count: { $sum: 1 },
          users: { $addToSet: "$userId" },
        },
      },
      {
        $project: {
          count: 1,
          uniqueUsers: { $size: "$users" },
        },
      },
      { $sort: { count: -1 } },
    ]);

    res.status(200).json({
      success: true,
      message: "Funnel summary retrieved",
      data: {
        days,
        events: grouped.map((entry) => ({
          eventName: entry._id,
          count: entry.count,
          uniqueUsers: entry.uniqueUsers,
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
    // Run entirely in MongoDB – no data pulled into Node memory
    const [summary, mismatches] = await Promise.all([
      Booking.aggregate<{
        total: number;
        matched: number;
        mismatched: number;
      }>([
        {
          $match: {
            status: {
              $in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED", "NO_SHOW"],
            },
          },
        },
        {
          $addFields: {
            paidAmount: {
              $reduce: {
                input: {
                  $filter: {
                    input: { $ifNull: ["$payments", []] },
                    cond: { $eq: ["$$this.status", "PAID"] },
                  },
                },
                initialValue: 0,
                in: { $add: ["$$value", { $ifNull: ["$$this.amount", 0] }] },
              },
            },
          },
        },
        {
          $addFields: {
            delta: { $abs: { $subtract: ["$totalAmount", "$paidAmount"] } },
          },
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            matched: { $sum: { $cond: [{ $lte: ["$delta", 1] }, 1, 0] } },
            mismatched: { $sum: { $cond: [{ $gt: ["$delta", 1] }, 1, 0] } },
          },
        },
      ]),
      Booking.aggregate<{
        bookingId: string;
        expected: number;
        paid: number;
        status: string;
      }>([
        {
          $match: {
            status: {
              $in: ["CONFIRMED", "IN_PROGRESS", "COMPLETED", "NO_SHOW"],
            },
          },
        },
        {
          $addFields: {
            paidAmount: {
              $reduce: {
                input: {
                  $filter: {
                    input: { $ifNull: ["$payments", []] },
                    cond: { $eq: ["$$this.status", "PAID"] },
                  },
                },
                initialValue: 0,
                in: { $add: ["$$value", { $ifNull: ["$$this.amount", 0] }] },
              },
            },
          },
        },
        {
          $addFields: {
            delta: { $abs: { $subtract: ["$totalAmount", "$paidAmount"] } },
          },
        },
        { $match: { delta: { $gt: 1 } } },
        { $sort: { createdAt: -1 } },
        { $limit: 25 },
        {
          $project: {
            bookingId: { $toString: "$_id" },
            expected: "$totalAmount",
            paid: "$paidAmount",
            status: 1,
          },
        },
      ]),
    ]);

    const totals = summary[0] ?? { total: 0, matched: 0, mismatched: 0 };

    res.status(200).json({
      success: true,
      message: "Finance reconciliation generated",
      data: {
        totalBookingsChecked: totals.total,
        matched: totals.matched,
        mismatched: totals.mismatched,
        mismatchRate:
          totals.total > 0
            ? Number((totals.mismatched / totals.total).toFixed(4))
            : 0,
        sampleMismatches: mismatches,
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
const GUEST_EVENT_MATCH = { guestId: { $exists: true, $nin: [null, ""] } };

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
      ...(event.metadata ? { metadata: event.metadata } : {}),
      source: "WEB" as const,
    }));

    await AnalyticsEvent.insertMany(docs, { ordered: false });

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
    const match = { ...GUEST_EVENT_MATCH, createdAt: { $gte: start } };

    const [totalsAgg, topPages, topEvents, dailyAgg, engagementAgg] =
      await Promise.all([
        AnalyticsEvent.aggregate<{
          events: number;
          uniqueGuests: number;
          pageViews: number;
        }>([
          { $match: match },
          {
            $group: {
              _id: null,
              events: { $sum: 1 },
              guests: { $addToSet: "$guestId" },
              pageViews: {
                $sum: { $cond: [{ $eq: ["$eventName", "page_view"] }, 1, 0] },
              },
            },
          },
          {
            $project: {
              _id: 0,
              events: 1,
              pageViews: 1,
              uniqueGuests: { $size: "$guests" },
            },
          },
        ]),
        AnalyticsEvent.aggregate<{
          path: string;
          views: number;
          uniqueGuests: number;
        }>([
          { $match: { ...match, eventName: "page_view" } },
          {
            $group: {
              _id: "$entityId",
              views: { $sum: 1 },
              guests: { $addToSet: "$guestId" },
            },
          },
          {
            $project: {
              _id: 0,
              path: { $ifNull: ["$_id", "(unknown)"] },
              views: 1,
              uniqueGuests: { $size: "$guests" },
            },
          },
          { $sort: { views: -1 } },
          { $limit: 20 },
        ]),
        AnalyticsEvent.aggregate<{
          eventName: string;
          count: number;
          uniqueGuests: number;
        }>([
          { $match: match },
          {
            $group: {
              _id: "$eventName",
              count: { $sum: 1 },
              guests: { $addToSet: "$guestId" },
            },
          },
          {
            $project: {
              _id: 0,
              eventName: "$_id",
              count: 1,
              uniqueGuests: { $size: "$guests" },
            },
          },
          { $sort: { count: -1 } },
          { $limit: 20 },
        ]),
        AnalyticsEvent.aggregate<{
          day: string;
          views: number;
          uniqueGuests: number;
        }>([
          { $match: { ...match, eventName: "page_view" } },
          {
            $group: {
              _id: {
                $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
              },
              views: { $sum: 1 },
              guests: { $addToSet: "$guestId" },
            },
          },
          {
            $project: {
              _id: 0,
              day: "$_id",
              views: 1,
              uniqueGuests: { $size: "$guests" },
            },
          },
          { $sort: { day: 1 } },
        ]),
        AnalyticsEvent.aggregate<{ avgScroll: number; avgTime: number }>([
          { $match: { ...match, eventName: "page_exit" } },
          {
            $group: {
              _id: null,
              avgScroll: { $avg: "$metadata.scrollDepthPct" },
              avgTime: { $avg: "$metadata.durationMs" },
            },
          },
        ]),
      ]);

    const totals = totalsAgg[0] ?? {
      events: 0,
      uniqueGuests: 0,
      pageViews: 0,
    };
    const engagement = engagementAgg[0] ?? { avgScroll: 0, avgTime: 0 };

    const daySeries = buildDaySeries(days);
    const dayMap = new Map(dailyAgg.map((row) => [row.day, row]));
    const daily = daySeries.map((point) => {
      const row = dayMap.get(point.key);
      return {
        label: point.label,
        views: row?.views ?? 0,
        uniqueGuests: row?.uniqueGuests ?? 0,
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
    const result = await AnalyticsEvent.deleteMany({});
    res.status(200).json({
      success: true,
      message: "Analytics data cleared",
      data: { deletedCount: result.deletedCount ?? 0 },
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
      Academy.countDocuments({ onboardingCompleted: true, isApproved: false }),
      Coach.countDocuments({ verificationStatus: "PENDING" }),
      Venue.countDocuments({ approvalStatus: "PENDING" }),
      CommunityReport.countDocuments({ status: "OPEN" }),
      Dispute.countDocuments({ status: "OPEN" }),
      SupportTicket.countDocuments({ status: "OPEN" }),
      ConciergeRequest.countDocuments({ status: "pending" }),
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
