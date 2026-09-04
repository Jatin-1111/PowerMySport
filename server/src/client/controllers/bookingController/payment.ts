import { Request, Response } from "express";
import { Booking } from "../../models/Booking";
import { User } from "../../models/User";
import { BookingPaymentTransaction } from "../../models/BookingPayment";
import { recordBookingEventFor } from "../../services/BookingEventService";
import { WalletService } from "../../services/WalletService";
import { updatePaymentStatus } from "../../services/BookingService";
import {
  getPhonePeOrderStatus,
  initiatePhonePePayment,
  validatePhonePeCallback,
} from "../../../shared/services/PhonePeService";
import { asyncHandler } from "../../../middleware/asyncHandler";
import { AppError } from "../../../utils/AppError";

const getBookingPaymentAmount = (booking: any, userId: string): number => {
  if (booking.payments && booking.payments.length > 0) {
    const userPayment = booking.payments.find(
      (payment: any) => payment.userId.toString() === userId
    );

    if (!userPayment) {
      throw new Error("No payment share found for this user");
    }

    if (userPayment.status === "PAID") {
      throw new Error("Payment is already completed for this booking");
    }

    return userPayment.amount;
  }

  if (booking.paymentConfirmedAt) {
    throw new Error("Payment is already completed for this booking");
  }

  return booking.totalAmount || 0;
};

/**
 * Initiate PhonePe payment for a booking
 * POST /api/bookings/:bookingId/phonepe/initiate
 */
export const initiatePhonePePaymentForBooking = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const authUser = req.user;
    if (!authUser?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const userId = authUser.id;

    const bookingId = (req.params as Record<string, unknown>).bookingId as string;
    const booking = await Booking.findById(bookingId).select(
      "userId totalAmount payments bookingType paymentType status paymentConfirmedAt"
    );

    if (!booking) {
      throw new AppError("Booking not found", 404);
    }

    if (booking.status === "CANCELLED") {
      throw new AppError("Cannot initiate payment for a cancelled booking", 400);
    }

    const isOrganizer = booking.userId.toString() === userId;
    const isSplitPayer =
      booking.paymentType === "SPLIT" &&
      booking.payments?.some((payment) => payment.userId.toString() === userId);

    if (!isOrganizer && !isSplitPayer) {
      throw new AppError("You are not authorized to pay for this booking", 403);
    }

    const amount = getBookingPaymentAmount(booking, userId);
    const amountInPaise = Math.round(amount * 100);

    if (amountInPaise < 100) {
      throw new AppError("Payment amount must be at least 1 INR", 400);
    }

    const merchantOrderId = `bk_${bookingId}_${Date.now()}`;
    const redirectBase =
      process.env.FRONTEND_URL || process.env.PHONEPE_REDIRECT_URL_BASE || "http://localhost:3000";
    const redirectUrl = new URL("/payment", redirectBase);
    redirectUrl.searchParams.set("status", "pending");
    redirectUrl.searchParams.set("bookingId", bookingId);
    redirectUrl.searchParams.set("merchantOrderId", merchantOrderId);
    if (req.body?.type === "coach" || req.body?.type === "venue") {
      redirectUrl.searchParams.set("type", req.body.type);
    }

    const payer = await User.findById(userId).select("phone");

    const transaction = await BookingPaymentTransaction.create({
      bookingId: booking._id,
      userId,
      merchantOrderId,
      amount: amountInPaise,
      status: "PENDING",
    });

    await recordBookingEventFor(booking, {
      type: "PAYMENT_INITIATED",
      toStatus: booking.status,
      actorType: "USER",
      actorUserId: userId,
      channel: "CLIENT_WEB",
      amountPaise: amountInPaise,
      summary: "PhonePe payment initiated",
      metadata: {
        merchantOrderId,
        method: "PHONEPE",
        transactionId: transaction._id.toString(),
        isSplitPayer: isSplitPayer && !isOrganizer,
      },
    });

    const paymentPayload: {
      merchantOrderId: string;
      amount: number;
      redirectUrl: string;
      userPhone?: string;
      metaInfo?: Record<string, string>;
    } = {
      merchantOrderId,
      amount: amountInPaise,
      redirectUrl: redirectUrl.toString(),
      metaInfo: {
        udf1: bookingId,
        udf2: userId,
      },
    };

    if (payer?.phone) {
      paymentPayload.userPhone = payer.phone;
    }

    const initResult = await initiatePhonePePayment(paymentPayload);

    if (initResult.orderId) {
      transaction.phonepeOrderId = initResult.orderId;
    }
    transaction.redirectUrl = initResult.redirectUrl;
    transaction.state = initResult.state || "PENDING";
    await transaction.save();

    res.status(200).json({
      success: true,
      message: "PhonePe payment initiated",
      data: {
        redirectUrl: initResult.redirectUrl,
        merchantOrderId,
        state: initResult.state,
      },
    });
  }
);

/**
 * Handle PhonePe callback
 * POST /api/bookings/phonepe/callback
 */
export const handlePhonePeCallback = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const authorizationHeader = req.headers["authorization"] as string;
    if (!authorizationHeader) {
      throw new AppError("Missing PhonePe authorization header", 401);
    }

    const rawBody = (req as any).rawBody || JSON.stringify(req.body);
    const callback = validatePhonePeCallback(authorizationHeader, rawBody);
    const payload = callback.payload || {};

    const merchantOrderId = payload.originalMerchantOrderId;
    if (!merchantOrderId) {
      throw new AppError("Missing merchant order id in callback", 400);
    }

    const transaction = await BookingPaymentTransaction.findOne({
      merchantOrderId,
    });
    if (!transaction) {
      throw new AppError("Payment transaction not found", 404);
    }

    transaction.callbackPayload = callback as any;
    transaction.phonepeOrderId = payload.orderId || transaction.phonepeOrderId;
    transaction.state = payload.state || transaction.state;

    if (payload.state === "COMPLETED") {
      transaction.status = "COMPLETED";
      await updatePaymentStatus(
        transaction.bookingId.toString(),
        transaction.userId.toString(),
        "PAID",
        undefined,
        {
          actorType: "GATEWAY",
          channel: "WEBHOOK",
          metadata: {
            merchantOrderId: transaction.merchantOrderId,
            gatewayState: payload.state,
            source: "phonepe_callback",
          },
        }
      );
    } else if (payload.state === "FAILED") {
      transaction.status = "FAILED";
      await updatePaymentStatus(
        transaction.bookingId.toString(),
        transaction.userId.toString(),
        "FAILED",
        undefined,
        {
          actorType: "GATEWAY",
          channel: "WEBHOOK",
          metadata: {
            merchantOrderId: transaction.merchantOrderId,
            gatewayState: payload.state,
            source: "phonepe_callback",
          },
        }
      );
    }

    await transaction.save();

    res.status(200).json({
      success: true,
      message: "PhonePe callback processed",
    });
  }
);

/**
 * Verify PhonePe order status
 * GET /api/bookings/phonepe/status/:merchantOrderId
 */
export const verifyPhonePeOrderStatus = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user?.id) {
      throw new AppError("Unauthorized", 401);
    }

    const merchantOrderIdParam = Array.isArray(req.params.merchantOrderId)
      ? req.params.merchantOrderId[0]
      : req.params.merchantOrderId;
    if (!merchantOrderIdParam) {
      throw new AppError("merchantOrderId is required", 400);
    }

    const merchantOrderId = merchantOrderIdParam;

    const transaction = await BookingPaymentTransaction.findOne({
      merchantOrderId,
    });

    if (!transaction) {
      throw new AppError("Payment transaction not found", 404);
    }

    if (transaction.userId.toString() !== req.user.id) {
      throw new AppError("You are not authorized to access this payment", 403);
    }

    const status = await getPhonePeOrderStatus(merchantOrderId);
    transaction.lastStatusPayload = status.raw;
    transaction.state = status.state || transaction.state || "PENDING";

    if (status.state === "COMPLETED" && transaction.status !== "COMPLETED") {
      transaction.status = "COMPLETED";
      await updatePaymentStatus(
        transaction.bookingId.toString(),
        transaction.userId.toString(),
        "PAID",
        undefined,
        {
          actorType: "GATEWAY",
          channel: "CLIENT_WEB",
          metadata: {
            merchantOrderId,
            gatewayState: status.state,
            // The user's browser polled this after returning from PhonePe,
            // rather than the webhook arriving first.
            source: "phonepe_status_poll",
          },
        }
      );
    } else if (status.state === "FAILED" && transaction.status !== "FAILED") {
      transaction.status = "FAILED";
      await updatePaymentStatus(
        transaction.bookingId.toString(),
        transaction.userId.toString(),
        "FAILED",
        undefined,
        {
          actorType: "GATEWAY",
          channel: "CLIENT_WEB",
          metadata: {
            merchantOrderId,
            gatewayState: status.state,
            source: "phonepe_status_poll",
          },
        }
      );
    }

    await transaction.save();

    res.status(200).json({
      success: true,
      message: "PhonePe order status retrieved",
      data: {
        state: status.state,
        merchantOrderId,
      },
    });
  }
);

/**
 * Pay for a booking using Wallet Balance
 * POST /api/bookings/:bookingId/wallet/pay
 */
export const payBookingWithWallet = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const bookingId = req.params.bookingId as string;
    const user = req.user;

    if (!user) {
      throw new AppError("Unauthorized", 401);
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      throw new AppError("Booking not found", 404);
    }

    // Only a booking still awaiting payment can be paid for. AWAITING_PROVIDER
    // means the money already landed, so accepting another payment there would
    // charge the customer twice.
    if (booking.status !== "AWAITING_PAYMENT" && booking.status !== "PENDING_INVITES") {
      throw new AppError("Booking cannot be paid for in its current state", 400);
    }

    // Verify user is part of the booking (organizer or participant)
    if (booking.userId.toString() !== user.id && booking.organizerId?.toString() !== user.id) {
      // Find if they are a participant
      const isParticipant = booking.payments?.some((p) => p.userId.toString() === user.id);
      if (!isParticipant) {
        throw new AppError("Not authorized to pay for this booking", 403);
      }
    }

    // Calculate user's share
    const paymentShare = booking.payments?.find((p) => p.userId.toString() === user.id);

    const amount = paymentShare ? paymentShare.amount : booking.totalAmount;

    if (paymentShare && paymentShare.status === "PAID") {
      throw new AppError("Your share of this booking is already paid", 400);
    }

    if (!paymentShare && booking.paymentConfirmedAt) {
      throw new AppError("Booking is already paid", 400);
    }

    // Deduct from wallet
    await WalletService.debitWallet(user.id, amount, `Booking Payment: ${bookingId}`, bookingId);

    const merchantOrderId = `WALLET-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Create payment transaction.
    // BookingPaymentTransaction.amount is denominated in PAISE — the PhonePe
    // path stores Math.round(amount * 100), and every downstream reader
    // (RefundService.initiateRefund, timer.ts expireOldBookings, the refund
    // retry job in scheduledJobs.ts) divides by 100 to get rupees. Storing
    // the raw rupee figure here made wallet-paid bookings refund and report
    // 100x too small.
    await BookingPaymentTransaction.create({
      bookingId: booking._id,
      userId: user.id,
      merchantOrderId,
      amount: Math.round(amount * 100),
      status: "COMPLETED",
      state: "COMPLETED",
    });

    await recordBookingEventFor(booking, {
      type: "PAYMENT_INITIATED",
      toStatus: booking.status,
      actorType: "USER",
      actorUserId: user.id,
      channel: "CLIENT_WEB",
      amountPaise: Math.round(amount * 100),
      summary: "Wallet debited for booking payment",
      metadata: { merchantOrderId, method: "WALLET" },
    });

    // Update booking status
    await updatePaymentStatus(bookingId, user.id, "PAID", undefined, {
      actorType: "USER",
      actorUserId: user.id,
      channel: "CLIENT_WEB",
      metadata: { merchantOrderId, method: "WALLET" },
    });

    res.status(200).json({
      success: true,
      message: "Paid via wallet successfully",
    });
  }
);
