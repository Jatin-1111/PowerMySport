import { Booking } from "../models/Booking";
import { Review } from "../models/Review";

/**
 * Automatic dispute resolution based on predefined rules
 * Analyzes booking data and determines recommended action
 */
export interface DisputeAnalysis {
  disputeType: "NO_SHOW" | "POOR_QUALITY" | "PAYMENT_ISSUE" | "OTHER";
  recommendedAction:
    | "FULL_REFUND"
    | "PARTIAL_REFUND"
    | "NO_REFUND"
    | "MANUAL_REVIEW";
  refundPercentage: number;
  reasoning: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  requiresManualReview: boolean;
}

/**
 * Analyze a dispute and provide recommended resolution
 * Uses booking status, reviews, and timing to determine appropriate action
 */
export const analyzeDispute = async (
  bookingId: string,
  disputeType: "NO_SHOW" | "POOR_QUALITY" | "PAYMENT_ISSUE" | "OTHER",
  disputeDetails?: string,
): Promise<DisputeAnalysis> => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new Error("Booking not found");
  }

  // Check if there's a review for this booking
  const review = await Review.findOne({ bookingId });

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
  if (booking.status === "COMPLETED" && review && review.venueRating >= 4) {
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
  if (review && review.venueRating <= 2) {
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
  if (review && review.venueRating >= 4) {
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
  booking: any,
): Promise<DisputeAnalysis> => {
  // Check if all payments are marked PAID
  const allPaid = booking.payments.every((p: any) => p.status === "PAID");

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
  booking.payments.forEach((p: any) => {
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
  // NOTE: This is a stub - in production, you'd track disputes in a separate collection
  // For now, returning mock structure
  return {
    totalDisputes: 0,
    autoResolved: 0,
    manualReview: 0,
    byType: {
      NO_SHOW: 0,
      POOR_QUALITY: 0,
      PAYMENT_ISSUE: 0,
      OTHER: 0,
    },
  };
};
