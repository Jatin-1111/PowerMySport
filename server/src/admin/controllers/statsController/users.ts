import { Request, Response } from "express";
import { Coach } from "../../../client/models/Coach";
import { User } from "../../../client/models/User";
import { Player } from "../../../client/models/Player";
import { Venue } from "../../../client/models/Venue";
import { areUsersOnline } from "../../../shared/services/UserPresenceService";
import { getPaginationParams } from "../../../utils/pagination";
import { AdminUserRole, getRoleFromQuery, buildMonthSeries } from "./shared";

// Get all users
export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const role = getRoleFromQuery(req.query.role);
    const { page, limit, skip } = getPaginationParams(req.query.page, req.query.limit, 15, 100);

    const query = role ? { role } : {};
    const [total, users] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .select("name email phone role createdAt lastActiveAt")
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

const makeRoleUsersHandler =
  (role: AdminUserRole) =>
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { page, limit, skip } = getPaginationParams(req.query.page, req.query.limit, 15, 100);
      const [total, users] = await Promise.all([
        User.countDocuments({ role }),
        User.find({ role })
          .select("name email phone role createdAt lastActiveAt")
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
      ]);
      const transformedUsers = users.map((user) => ({
        ...user,
        id: user._id.toString(),
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

export const getUserRoleSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const roleCounts = await User.aggregate<{ _id: string; count: number }>([
      {
        $match: {
          role: { $in: ["Player", "Coach", "VenueLister", "EXPERT", "Parent"] },
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
      EXPERT: 0,
      Parent: 0,
      Player: 0,
      Coach: 0,
      VenueLister: 0,
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
      message: error instanceof Error ? error.message : "Failed to retrieve user role summary",
    });
  }
};

export const getUserGrowthAnalytics = async (req: Request, res: Response): Promise<void> => {
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
      ])
    );

    for (const row of growth) {
      const bucket = monthBuckets.get(row._id.month);
      if (!bucket) continue;

      const role = row._id.role as keyof typeof bucket;
      if (role in bucket && typeof bucket[role] === "number") {
        (bucket[role] as number) += row.count;
      }
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
      message: error instanceof Error ? error.message : "Failed to retrieve user growth analytics",
    });
  }
};

export const getPlayersUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query.page, req.query.limit, 15, 100);

    const query = { role: "Player" };
    const [total, users] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .select("name email phone createdAt lastActiveAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    const userIds = users.map((user) => user._id);
    const playerProfiles = await Player.find({
      userId: { $in: userIds },
    }).lean();

    const profilesByUserId = new Map<string, any[]>();
    for (const profile of playerProfiles) {
      const uidStr = profile.userId.toString();
      if (!profilesByUserId.has(uidStr)) {
        profilesByUserId.set(uidStr, []);
      }
      profilesByUserId.get(uidStr)!.push(profile);
    }

    const onlineByUserId = await areUsersOnline(users.map((user) => user._id.toString()));

    const data = users.map((user) => {
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
        isOnlineNow: onlineByUserId.get(user._id.toString()) ?? false,
        sports,
        sportsCount,
        hasSportsProfile,
        dependents,
        dependentsCount,
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
      message: error instanceof Error ? error.message : "Failed to retrieve players",
    });
  }
};

export const getCoachUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query.page, req.query.limit, 15, 100);

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
        "userId sports hourlyRate serviceMode verificationStatus isVerified rating reviewCount"
      )
      .lean();

    const coachByUserId = new Map(
      coachProfiles.map((profile) => [profile.userId.toString(), profile])
    );

    const onlineByUserId = await areUsersOnline(users.map((user) => user._id.toString()));

    const data = users.map((user) => {
      const profile = coachByUserId.get(user._id.toString());
      return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: "Coach",
        createdAt: user.createdAt,
        lastActiveAt: user.lastActiveAt || user.createdAt,
        isOnlineNow: onlineByUserId.get(user._id.toString()) ?? false,
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
      message: error instanceof Error ? error.message : "Failed to retrieve coaches",
    });
  }
};

export const getVenueListerUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { page, limit, skip } = getPaginationParams(req.query.page, req.query.limit, 15, 100);

    const query = { role: "VenueLister" };
    const total = await User.countDocuments(query);
    const users = await User.find(query)
      .select("name email phone createdAt lastActiveAt")
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
              $cond: [{ $in: ["$approvalStatus", ["PENDING", "REVIEW"]] }, 1, 0],
            },
          },
        },
      },
    ]);

    const venueCountByOwnerId = new Map(venueCounts.map((item) => [String(item._id), item]));

    const onlineByUserId = await areUsersOnline(users.map((user) => user._id.toString()));

    const data = users.map((user) => {
      const counts = venueCountByOwnerId.get(user._id.toString());
      return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: "VenueLister",
        createdAt: user.createdAt,
        lastActiveAt: user.lastActiveAt || user.createdAt,
        isOnlineNow: onlineByUserId.get(user._id.toString()) ?? false,
        businessName: "",
        canAddMoreVenues: false,
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
      message: error instanceof Error ? error.message : "Failed to retrieve venue listers",
    });
  }
};
