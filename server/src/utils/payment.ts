import { IPayment } from "../types/index";

/**
 * Calculate split payment amounts for venue, optional coach and optional academy
 * @param venuePrice - Price charged by the venue
 * @param venueOwnerId - User ID of the venue owner
 * @param coachPrice - Optional price charged by the coach
 * @param coachUserId - Optional user ID of the coach
 * @param payerUserId - User ID of the paying player/parent
 * @param totalAmount - Full booking total the payer is charged
 * @param academyPrice - Optional price charged by the academy
 * @param academyOwnerUserId - Optional user ID of the academy owner
 * @returns Array of payment objects
 */
export const calculateSplitAmounts = (
  venuePrice: number,
  venueOwnerId: string,
  coachPrice?: number,
  coachUserId?: string,
  payerUserId?: string,
  totalAmount?: number,
  academyPrice?: number,
  academyOwnerUserId?: string,
): IPayment[] => {
  const payments: IPayment[] = [];

  if (venueOwnerId) {
    payments.push({
      userId: venueOwnerId,
      userType: "VenueLister",
      amount: venuePrice,
      status: "PENDING",
    });
  }

  if (coachPrice && coachUserId) {
    payments.push({
      userId: coachUserId,
      userType: "Coach",
      amount: coachPrice,
      status: "PENDING",
    });
  }

  // Academy payee. Without this entry an academy booking collects the full
  // amount from the parent and releaseCompletedBookingPayments() has nothing
  // to release — money in, nothing owed out.
  if (academyPrice && academyOwnerUserId) {
    payments.push({
      userId: academyOwnerUserId,
      userType: "Academy",
      amount: academyPrice,
      status: "PENDING",
    });
  }

  // Add the player (payer) entry so that getBookingPaymentAmount()
  // and updatePaymentStatus() can locate the payer by userId.
  // For single bookings the player pays the full totalAmount.
  if (payerUserId) {
    payments.push({
      userId: payerUserId,
      userType: "Player",
      amount:
        totalAmount ?? venuePrice + (coachPrice || 0) + (academyPrice || 0),
      status: "PENDING",
    });
  }

  return payments;
};

/**
 * Calculate split payment amounts for group booking (equal split among players)
 * @param totalAmount - Total booking amount including fees
 * @param venuePrice - Price charged by the venue (for venue owner payment)
 * @param coachPrice - Optional price charged by the coach
 * @param venueOwnerId - User ID of the venue owner
 * @param coachUserId - Optional user ID of the coach
 * @param participantIds - Array of participant user IDs (including organizer)
 * @returns Array of payment objects (venue/coach + player splits)
 */
export const calculateGroupPaymentSplits = (
  totalAmount: number,
  venuePrice: number,
  venueOwnerId: string,
  participantIds: string[],
  coachPrice?: number,
  coachUserId?: string,
): IPayment[] => {
  const payments: IPayment[] = [];

  // Add venue owner payment
  payments.push({
    userId: venueOwnerId,
    userType: "VenueLister",
    amount: venuePrice,
    status: "PENDING",
  });

  // Add coach payment if applicable
  if (coachPrice && coachUserId) {
    payments.push({
      userId: coachUserId,
      userType: "Coach",
      amount: coachPrice,
      status: "PENDING",
    });
  }

  // Calculate equal split among participants
  const numParticipants = participantIds.length;
  if (numParticipants === 0) {
    throw new Error("At least one participant is required");
  }

  // Split total amount equally
  const amountPerPerson =
    Math.round((totalAmount / numParticipants) * 100) / 100;

  // Handle rounding - last person pays the difference
  const sumOfSplits = amountPerPerson * (numParticipants - 1);
  const lastPersonAmount = Math.round((totalAmount - sumOfSplits) * 100) / 100;

  // Add player payment splits
  participantIds.forEach((userId, index) => {
    payments.push({
      userId,
      userType: "Player",
      amount:
        index === numParticipants - 1 ? lastPersonAmount : amountPerPerson,
      status: "PENDING",
    });
  });

  return payments;
};

/**
 * Check if all payments in a booking are paid
 * @param payments - Array of payment objects
 * @returns True if all payments are PAID, false otherwise
 */
export const validatePaymentStatus = (payments: IPayment[]): boolean => {
  if (payments.length === 0) {
    return false;
  }

  return payments.every((payment) => payment.status === "PAID");
};
