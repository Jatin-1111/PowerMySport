import { Request, Response } from "express";
import { Coach } from "../../../client/models/Coach";
import { Player } from "../../../client/models/Player";
import { User } from "../../../client/models/User";
import { Venue } from "../../../client/models/Venue";
import { getStartOfCurrentMonth, getTwentyFourHoursAgo } from "./shared";
import { asyncHandler } from "../../../middleware/asyncHandler";

export const getPlayersAnalytics = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const monthStart = getStartOfCurrentMonth();
    const twentyFourHoursAgo = getTwentyFourHoursAgo();

    // `withSportsProfile`/`withDependents` count through the Player collection,
    // not through the user document. Migration 14 moved both off User — the
    // fields these once matched (`playerProfile.sports`, `dependents`) no
    // longer exist on the schema, so counting them there reported a flat zero.
    const countPlayerOwners = (match: Record<string, unknown>) =>
      Player.aggregate<{ owners: number }>([
        { $match: match },
        { $group: { _id: "$userId" } },
        {
          $lookup: {
            from: User.collection.name,
            localField: "_id",
            foreignField: "_id",
            as: "user",
          },
        },
        { $match: { "user.role": "Player" } },
        { $count: "owners" },
      ]);

    const [
      totalPlayers,
      newThisMonth,
      sportsProfileOwners,
      dependentOwners,
      newAccountsLast24Hours,
    ] = await Promise.all([
      User.countDocuments({ role: "Player" }),
      User.countDocuments({
        role: "Player",
        createdAt: { $gte: monthStart },
      }),
      countPlayerOwners({ type: "SELF", "sportsFocus.0": { $exists: true } }),
      countPlayerOwners({ type: "DEPENDENT" }),
      User.countDocuments({
        role: "Player",
        createdAt: { $gte: twentyFourHoursAgo },
      }),
    ]);

    const withSportsProfile = sportsProfileOwners[0]?.owners ?? 0;
    const withDependents = dependentOwners[0]?.owners ?? 0;

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
  }
);

export const getCoachesAnalytics = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
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
  }
);

export const getVenueListersAnalytics = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
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
  }
);
