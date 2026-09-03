import { Request, Response } from "express";
import { Booking } from "../../../client/models/Booking";
import { Coach } from "../../../client/models/Coach";
import { AnalyticsEvent } from "../../models/AnalyticsEvent";
import { User } from "../../../client/models/User";
import { Venue } from "../../../client/models/Venue";
import VenueInquiry from "../../../client/models/VenueInquiry";
import { Dispute } from "../../../client/models/Dispute";
import { SupportTicket } from "../../../client/models/SupportTicket";
import { CommunityReport } from "../../../community/models/CommunityReport";
import { ConciergeRequest } from "../../../shared/models/ConciergeRequest";
import Academy from "../../models/Academy";
import { DataSourceSubmission } from "../../../shared/models/DataSourceSubmission";
import { WebhookRecoveryService } from "../../../shared/controllers/WebhookController";
import { getLatencyProfiles, getObservabilitySnapshot } from "../../../middleware/observability";

export const getPublicPlatformStats = async (req: Request, res: Response): Promise<void> => {
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
export const getPlatformStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const [totalUsers, totalVenues, totalBookings, pendingInquiries, revenueResult] =
      await Promise.all([
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

export const getFinanceReconciliation = async (req: Request, res: Response): Promise<void> => {
  try {
    // Run entirely in MongoDB – no data pulled into Node memory. Both the
    // summary counts and the sample mismatches need the same
    // paidAmount/delta computation over the same document set, so a single
    // $facet does that work once instead of twice.
    const [result] = await Booking.aggregate<{
      summary: Array<{ total: number; matched: number; mismatched: number }>;
      mismatches: Array<{
        bookingId: string;
        expected: number;
        paid: number;
        status: string;
      }>;
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
        $facet: {
          summary: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                matched: { $sum: { $cond: [{ $lte: ["$delta", 1] }, 1, 0] } },
                mismatched: { $sum: { $cond: [{ $gt: ["$delta", 1] }, 1, 0] } },
              },
            },
          ],
          mismatches: [
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
          ],
        },
      },
    ]);

    const totals = result?.summary[0] ?? { total: 0, matched: 0, mismatched: 0 };
    const mismatches = result?.mismatches ?? [];

    res.status(200).json({
      success: true,
      message: "Finance reconciliation generated",
      data: {
        totalBookingsChecked: totals.total,
        matched: totals.matched,
        mismatched: totals.mismatched,
        mismatchRate: totals.total > 0 ? Number((totals.mismatched / totals.total).toFixed(4)) : 0,
        sampleMismatches: mismatches,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to generate reconciliation",
    });
  }
};

export const getObservabilityStats = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json({
      success: true,
      message: "Observability snapshot retrieved",
      data: getObservabilitySnapshot(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to retrieve observability stats",
    });
  }
};

/**
 * Lifetime per-route p50/p95/p99 plus budget status. Kept separate from
 * getObservabilityStats so that payload's shape stays frozen for the
 * existing admin Server tab.
 */
export const getLatencyProfileStats = async (req: Request, res: Response): Promise<void> => {
  try {
    res.status(200).json({
      success: true,
      message: "Latency profiles retrieved",
      data: {
        profiles: getLatencyProfiles(),
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to retrieve latency profiles",
    });
  }
};

/**
 * Lightweight actionable-item counts for admin nav badges. Each count mirrors
 * the exact filter its own list page treats as "still needs admin action".
 */
export const getPendingCounts = async (req: Request, res: Response): Promise<void> => {
  try {
    const [
      academyOnboarding,
      coachVerification,
      venueApprovals,
      communityReports,
      disputes,
      supportTickets,
      conciergeRequests,
      dataSourcesPending,
    ] = await Promise.all([
      Academy.countDocuments({ onboardingCompleted: true, isApproved: false }),
      Coach.countDocuments({ verificationStatus: "PENDING" }),
      Venue.countDocuments({ approvalStatus: "PENDING" }),
      CommunityReport.countDocuments({ status: "OPEN" }),
      Dispute.countDocuments({ status: "OPEN" }),
      SupportTicket.countDocuments({ status: "OPEN" }),
      ConciergeRequest.countDocuments({ status: "pending" }),
      DataSourceSubmission.countDocuments({ status: "PENDING_REVIEW" }),
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
        dataSourcesPending,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Failed to retrieve pending counts",
    });
  }
};

/**
 * GET /admin/stats/unsupported-sports
 * Returns the top unsupported sports searched by users, ranked by frequency.
 */
export const getUnsupportedSportsStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const days = Math.min(365, Math.max(7, Number(req.query.days) || 30));
    const since = new Date();
    since.setDate(since.getDate() - days);

    const rows = await AnalyticsEvent.aggregate<{
      sport: string;
      count: number;
      lastSearched: Date;
      sources: string[];
    }>([
      {
        $match: {
          eventName: "unsupported_sport_search",
          createdAt: { $gte: since },
        },
      },
      {
        $group: {
          _id: { $toLower: "$metadata.sport" },
          count: { $sum: 1 },
          lastSearched: { $max: "$createdAt" },
          sources: { $addToSet: "$metadata.source" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 25 },
      {
        $project: {
          _id: 0,
          sport: "$_id",
          count: 1,
          lastSearched: 1,
          sources: 1,
        },
      },
    ]);

    const totalSearches = rows.reduce((sum, r) => sum + r.count, 0);

    res.status(200).json({
      success: true,
      data: { rows, totalSearches, days },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message:
        error instanceof Error ? error.message : "Failed to retrieve unsupported sports stats",
    });
  }
};
