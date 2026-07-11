import type { Booking, BookingPaymentLeg, Review } from "@prisma/client";
import prisma from "../../lib/prisma";
import { sendDisputeStatusEmail } from "../../utils/email";

/**
 * Automatic dispute resolution based on predefined rules
 * Analyzes booking data and determines recommended action
 */
export interface DisputeAnalysis {
  disputeType: "NO_SHOW" | "POOR_QUALITY" | "PAYMENT_ISSUE" | "OTHER";
  recommendedAction:
    "FULL_REFUND" | "PARTIAL_REFUND" | "NO_REFUND" | "MANUAL_REVIEW";
  refundPercentage: number;
  reasoning: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  requiresManualReview: boolean;
}

// Booking joined with its payment legs (was an embedded array in Mongo).
type BookingWithPayments = Booking & { payments: BookingPaymentLeg[] };

/**
 * Analyze a dispute and provide recommended resolution
 * Uses booking status, reviews, and timing to determine appropriate action
 */
export const analyzeDispute = async (
  bookingId: string,
  disputeType: "NO_SHOW" | "POOR_QUALITY" | "PAYMENT_ISSUE" | "OTHER",
  disputeDetails?: string,
): Promise<DisputeAnalysis> => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { payments: true },
  });

  if (!booking) {
    throw new Error("Booking not found");
  }

  // Check if there's a review for this booking
  const review = await prisma.review.findFirst({ where: { bookingId } });

  // Analyze based on dispute type
  switch (disputeType) {
    case "NO_SHOW":
      return analyzeNoShowDispute(booking, review);

    case "POOR_QUALITY":
      return analyzePoorQualityDispute(booking, review);

    case "PAYMENT_ISSUE":
      return analyzePaymentDispute(booking);

    default:
      return {
        disputeType: "OTHER",
        recommendedAction: "MANUAL_REVIEW",
        refundPercentage: 0,
        reasoning: "Dispute requires manual review by admin",
        confidence: "LOW",
        requiresManualReview: true,
      };
  }
};

/**
 * Open a new dispute and analyze it automatically
 */
export const openDispute = async (
  bookingId: string,
  userId: string,
  disputeType: "NO_SHOW" | "POOR_QUALITY" | "PAYMENT_ISSUE" | "OTHER",
  disputeDetails?: string,
) => {
  const analysis = await analyzeDispute(bookingId, disputeType, disputeDetails);

  const dispute = await prisma.dispute.create({
    data: {
      bookingId,
      userId,
      disputeType,
      ...(disputeDetails !== undefined && { disputeDetails }),
      status: analysis.requiresManualReview ? "OPEN" : "RESOLVED",
      resolutionMethod: "AUTO",
      recommendedAction: analysis.recommendedAction,
      refundPercentage: analysis.refundPercentage,
      reasoning: analysis.reasoning,
      confidence: analysis.confidence,
      requiresManualReview: analysis.requiresManualReview,
    },
  });

  // Notify the user their dispute was logged (fire-and-forget).
  void (async () => {
    try {
      const disputeUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true },
      });
      if (disputeUser?.email) {
        await sendDisputeStatusEmail({
          name: disputeUser.name,
          email: disputeUser.email,
          disputeType,
          status: dispute.status as "OPEN" | "RESOLVED" | "CLOSED",
          bookingId,
        });
      }
    } catch (emailError) {
      console.error("Failed to send dispute email:", emailError);
    }
  })();

  return dispute;
};

/**
 * Analyze no-show disputes
 */
const analyzeNoShowDispute = async (
  booking: any,
  review: any,
): Promise<DisputeAnalysis> => {
  // If booking is marked NO_SHOW, favor venue/coach
  if (booking.status === "NO_SHOW") {
    return {
      disputeType: "NO_SHOW",
      recommendedAction: "NO_REFUND",
      refundPercentage: 0,
      reasoning:
        "Booking marked as NO_SHOW. No refund recommended per cancellation policy.",
      confidence: "HIGH",
      requiresManualReview: false,
    };
  }

  // If booking is COMPLETED with good review, player likely showed up
  // TODO(prisma): the normalized Review model uses a single `rating` field
  // (the old venue-specific `venueRating` was collapsed into it — see
  // SCHEMA_CHANGES). Reads here use `rating` accordingly.
  if (booking.status === "COMPLETED" && review && review.rating >= 4) {
    return {
      disputeType: "NO_SHOW",
      recommendedAction: "NO_REFUND",
      refundPercentage: 0,
      reasoning:
        "Booking completed with positive review. Dispute appears invalid.",
      confidence: "HIGH",
      requiresManualReview: false,
    };
  }

  // If booking is COMPLETED but no review, requires investigation
  if (booking.status === "COMPLETED" && !review) {
    return {
      disputeType: "NO_SHOW",
      recommendedAction: "MANUAL_REVIEW",
      refundPercentage: 0,
      reasoning:
        "Booking completed but no review. Requires manual investigation.",
      confidence: "LOW",
      requiresManualReview: true,
    };
  }

  // Default: manual review
  return {
    disputeType: "NO_SHOW",
    recommendedAction: "MANUAL_REVIEW",
    refundPercentage: 0,
    reasoning: "Unable to determine automatically. Manual review required.",
    confidence: "LOW",
    requiresManualReview: true,
  };
};

/**
 * Analyze poor quality disputes
 */
const analyzePoorQualityDispute = async (
  booking: any,
  review: any,
): Promise<DisputeAnalysis> => {
  // If there's a review with low rating, likely legitimate complaint
  // TODO(prisma): `rating` replaces the old `venueRating` (see analyzeNoShow).
  if (review && review.rating <= 2) {
    return {
      disputeType: "POOR_QUALITY",
      recommendedAction: "PARTIAL_REFUND",
      refundPercentage: 50,
      reasoning:
        "Low rating review supports quality complaint. 50% refund recommended.",
      confidence: "MEDIUM",
      requiresManualReview: true, // Still needs admin confirmation
    };
  }

  // If high rating, dispute seems questionable
  if (review && review.rating >= 4) {
    return {
      disputeType: "POOR_QUALITY",
      recommendedAction: "NO_REFUND",
      refundPercentage: 0,
      reasoning:
        "High rating review contradicts quality complaint. No refund recommended.",
      confidence: "MEDIUM",
      requiresManualReview: true,
    };
  }

  // No review or mid-range rating - needs investigation
  return {
    disputeType: "POOR_QUALITY",
    recommendedAction: "MANUAL_REVIEW",
    refundPercentage: 0,
    reasoning:
      "Insufficient data to auto-resolve. Requires manual review with evidence.",
    confidence: "LOW",
    requiresManualReview: true,
  };
};

/**
 * Analyze payment disputes
 */
const analyzePaymentDispute = async (
  booking: BookingWithPayments,
): Promise<DisputeAnalysis> => {
  // Check if all payments are marked PAID
  const allPaid = booking.payments.every((p) => p.status === "PAID");

  if (!allPaid) {
    return {
      disputeType: "PAYMENT_ISSUE",
      recommendedAction: "MANUAL_REVIEW",
      refundPercentage: 0,
      reasoning:
        "Payment records show incomplete payments. Requires manual investigation.",
      confidence: "HIGH",
      requiresManualReview: true,
    };
  }

  // Check for duplicate payments (same user, multiple PAID records)
  const paymentCounts = new Map<string, number>();
  booking.payments.forEach((p) => {
    const key = p.userId.toString();
    paymentCounts.set(key, (paymentCounts.get(key) || 0) + 1);
  });

  const hasDuplicates = Array.from(paymentCounts.values()).some(
    (count) => count > 1,
  );

  if (hasDuplicates) {
    return {
      disputeType: "PAYMENT_ISSUE",
      recommendedAction: "FULL_REFUND",
      refundPercentage: 100,
      reasoning:
        "Duplicate payment detected. Full refund of duplicate payment recommended.",
      confidence: "HIGH",
      requiresManualReview: true, // Confirm before processing
    };
  }

  // Default case
  return {
    disputeType: "PAYMENT_ISSUE",
    recommendedAction: "MANUAL_REVIEW",
    refundPercentage: 0,
    reasoning: "Payment issue requires detailed investigation.",
    confidence: "LOW",
    requiresManualReview: true,
  };
};

/**
 * Get dispute statistics for admin dashboard
 */
export const getDisputeStats = async (): Promise<{
  totalDisputes: number;
  autoResolved: number;
  manualReview: number;
  byType: {
    NO_SHOW: number;
    POOR_QUALITY: number;
    PAYMENT_ISSUE: number;
    OTHER: number;
  };
}> => {
  const [
    totalDisputes,
    autoResolved,
    manualReview,
    noShowDisputes,
    poorQualityDisputes,
    paymentIssueDisputes,
    otherDisputes,
  ] = await Promise.all([
    prisma.dispute.count(),
    prisma.dispute.count({
      where: { resolutionMethod: "AUTO", status: "RESOLVED" },
    }),
    prisma.dispute.count({ where: { requiresManualReview: true } }),
    prisma.dispute.count({ where: { disputeType: "NO_SHOW" } }),
    prisma.dispute.count({ where: { disputeType: "POOR_QUALITY" } }),
    prisma.dispute.count({ where: { disputeType: "PAYMENT_ISSUE" } }),
    prisma.dispute.count({ where: { disputeType: "OTHER" } }),
  ]);

  return {
    totalDisputes,
    autoResolved,
    manualReview,
    byType: {
      NO_SHOW: noShowDisputes,
      POOR_QUALITY: poorQualityDisputes,
      PAYMENT_ISSUE: paymentIssueDisputes,
      OTHER: otherDisputes,
    },
  };
};
