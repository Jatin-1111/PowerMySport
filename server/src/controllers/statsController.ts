import { Request, Response } from "express";
import { Booking } from "../models/Booking";
import { Coach } from "../models/Coach";
import { AnalyticsEvent } from "../models/AnalyticsEvent";
import { User } from "../models/User";
import { Venue } from "../models/Venue";
import VenueInquiry from "../models/VenueInquiry";
import { getObservabilitySnapshot } from "../middleware/observability";
import { transformDocuments } from "../middleware/responseTransform";
import { isUserOnline } from "../services/UserPresenceService";
import { getAllVenues as getAllVenuesService } from "../services/VenueService";
import { getPaginationParams } from "../utils/pagination";

type AdminUserRole = "PLAYER" | "COACH" | "VENUE_LISTER";

type FunnelSource = "WEB" | "MOBILE" | "SERVER";

const USER_ROLE_SET: ReadonlySet<AdminUserRole> = new Set([
  "PLAYER",
  "COACH",
  "VENUE_LISTER",
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
          "name email phone role createdAt lastActiveAt playerProfile.sports dependents venueListerProfile.businessDetails.name venueListerProfile.canAddMoreVenues",
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
          role: { $in: ["PLAYER", "COACH", "VENUE_LISTER"] },
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
          role: { $in: ["PLAYER", "COACH", "VENUE_LISTER"] },
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
        { ...item, total: 0, PLAYER: 0, COACH: 0, VENUE_LISTER: 0 },
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

    const query = { role: "PLAYER" };
    const [total, users] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .select(
          "name email phone createdAt lastActiveAt playerProfile.sports dependents",
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const data = users.map((user) => {
      const sports = user.playerProfile?.sports || [];
      const dependents = Array.isArray(user.dependents) ? user.dependents : [];

      return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: "PLAYER",
        createdAt: user.createdAt,
        lastActiveAt: user.lastActiveAt || user.createdAt,
        isOnlineNow: isUserOnline(user._id.toString()),
      };
    });

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

    const query = { role: "COACH" };
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

    const data = users.map((user) => {
      const profile = coachByUserId.get(user._id.toString());

      return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: "COACH",
        createdAt: user.createdAt,
        lastActiveAt: user.lastActiveAt || user.createdAt,
        isOnlineNow: isUserOnline(user._id.toString()),
        sports: profile?.sports || [],
        hourlyRate: profile?.hourlyRate ?? null,
        serviceMode: profile?.serviceMode ?? null,
        verificationStatus: profile?.verificationStatus ?? "UNVERIFIED",
        isVerified: profile?.isVerified ?? false,
        rating: profile?.rating ?? 0,
        reviewCount: profile?.reviewCount ?? 0,
        profileIncomplete: !profile,
      };
    });

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

    const query = { role: "VENUE_LISTER" };
    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select(
        "name email phone createdAt lastActiveAt venueListerProfile.businessDetails.name venueListerProfile.canAddMoreVenues",
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

    const data = users.map((user) => {
      const counts = venueCountByOwnerId.get(user._id.toString());

      return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: "VENUE_LISTER",
        createdAt: user.createdAt,
        lastActiveAt: user.lastActiveAt || user.createdAt,
        isOnlineNow: isUserOnline(user._id.toString()),
        businessName: user.venueListerProfile?.businessDetails?.name ?? "",
        canAddMoreVenues: user.venueListerProfile?.canAddMoreVenues ?? false,
        venueCount: counts?.venueCount ?? 0,
        approvedVenueCount: counts?.approvedVenueCount ?? 0,
        pendingVenueCount: counts?.pendingVenueCount ?? 0,
      };
    });

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
      User.countDocuments({ role: "PLAYER" }),
      User.countDocuments({
        role: "PLAYER",
        createdAt: { $gte: monthStart },
      }),
      User.countDocuments({
        role: "PLAYER",
        "playerProfile.sports.0": { $exists: true },
      }),
      User.countDocuments({
        role: "PLAYER",
        "dependents.0": { $exists: true },
      }),
      User.countDocuments({
        role: "PLAYER",
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
      User.countDocuments({ role: "COACH" }),
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
        role: "COACH",
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
        User.countDocuments({ role: "VENUE_LISTER" }),
        User.countDocuments({
          role: "VENUE_LISTER",
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

    // Using the service method matching the new signature
    const result = await getAllVenuesService({}, page, limit);

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
      .populate("userId venueId coachId")
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

      return {
        ...plain,
        id: toId(booking),
        userId: toId(plain.userId),
        venueId: normalizeEntity(plain.venueId),
        coachId: normalizeEntity(plain.coachId),
        playerName: playerRecord?.name || playerRecord?.email || "",
        venueName: venueRecord?.name || "",
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
