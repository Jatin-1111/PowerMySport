import { IPayment } from "../types";

/**
 * Calculate split payment amounts for venue and optional coach
 * @param venuePrice - Price charged by the venue
 * @param coachPrice - Optional price charged by the coach
 * @param venueOwnerId - User ID of the venue owner
 * @param coachUserId - Optional user ID of the coach
 * @returns Array of payment objects
 */
export const calculateSplitAmounts = (
  venuePrice: number,
  venueOwnerId: string,
  coachPrice?: number,
  coachUserId?: string,
): IPayment[] => {
  const payments: IPayment[] = [
    {
      userId: venueOwnerId,
      userType: "VENUE_LISTER",
      amount: venuePrice,
      status: "PENDING",
    },
  ];

  if (coachPrice && coachUserId) {
    payments.push({
      userId: coachUserId,
      userType: "COACH",
      amount: coachPrice,
      status: "PENDING",
    });
  }

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
