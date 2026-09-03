import { Request, Response } from "express";
import { Coach } from "../../../client/models/Coach";
import { User } from "../../../client/models/User";
import { Venue } from "../../../client/models/Venue";
import { getStartOfCurrentMonth, getTwentyFourHoursAgo } from "./shared";

export const getPlayersAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const monthStart = getStartOfCurrentMonth();
    const twentyFourHoursAgo = getTwentyFourHoursAgo();

    const [totalPlayers, newThisMonth, withSportsProfile, withDependents, newAccountsLast24Hours] =
      await Promise.all([
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
      message: error instanceof Error ? error.message : "Failed to retrieve players analytics",
    });
  }
};

export const getCoachesAnalytics = async (req: Request, res: Response): Promise<void> => {
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
      message: error instanceof Error ? error.message : "Failed to retrieve coaches analytics",
    });
  }
};

export const getVenueListersAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const twentyFourHoursAgo = getTwentyFourHoursAgo();

    const [totalVenueListers, newAccountsLast24Hours, venueCountAggregates] = await Promise.all([
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
                $cond: [{ $in: ["$approvalStatus", ["PENDING", "REVIEW"]] }, 1, 0],
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
        error instanceof Error ? error.message : "Failed to retrieve venue listers analytics",
    });
  }
};
