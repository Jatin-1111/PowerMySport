import { updatePaymentStatus } from "./BookingService";

export interface MockPaymentPayload {
  userId: string;
  bookingId: string;
  amount: number;
}

/**
 * Process a mock payment (for MVP without real payment gateway)
 * This simulates a successful payment
 */
export const processMockPayment = async (
  payload: MockPaymentPayload,
): Promise<{ success: boolean; message: string }> => {
  try {
    // In a real implementation, this would:
    // 1. Create a payment intent with the payment gateway
    // 2. Return a payment link/session
    // 3. Handle webhook callbacks

    // For now, we just simulate immediate payment success
    await updatePaymentStatus(payload.bookingId, payload.userId, "PAID");

    return {
      success: true,
      message: "Payment processed successfully (mock)",
    };
  } catch (error) {
    return {
      success: false,
      message:
        error instanceof Error ? error.message : "Payment processing failed",
    };
  }
};

/**
 * Handle payment webhook (mock implementation)
 * In production, this would verify webhook signatures and process real payment events
 */
export const handlePaymentWebhook = async (payload: any): Promise<void> => {
  try {
    // Mock webhook payload structure
    const { bookingId, userId, status } = payload;

    if (status === "success" || status === "paid") {
      await updatePaymentStatus(bookingId, userId, "PAID");
    }
  } catch (error) {
    console.error("Webhook processing error:", error);
    throw error;
  }
};

/**
 * Generate payment intent (mock)
 * In production, this would create a real payment session with Stripe/Razorpay
 */
export const createPaymentIntent = async (
  userId: string,
  amount: number,
  bookingId: string,
): Promise<{ paymentLink: string; paymentId: string }> => {
  // Mock payment ID
  const paymentId = `mock_payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Generate mock payment link
  const baseUrl = process.env.API_BASE_URL || "http://localhost:5000";
  const paymentLink = `${baseUrl}/api/payments/mock?userId=${userId}&amount=${amount}&bookingId=${bookingId}&paymentId=${paymentId}`;

  return {
    paymentLink,
    paymentId,
  };
};

/**
 * Verify payment status (mock)
 * In production, this would query the payment gateway
 */
export const verifyPaymentStatus = async (
  paymentId: string,
): Promise<"PENDING" | "PAID" | "FAILED"> => {
  // Mock implementation - always returns PENDING
  // In production, this would check with the payment gateway
  return "PENDING";
};
