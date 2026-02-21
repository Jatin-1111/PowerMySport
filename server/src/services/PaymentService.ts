import Stripe from "stripe";
import { Booking, BookingDocument } from "../models/Booking";
import { User } from "../models/User";
import { updatePaymentStatus } from "./BookingService";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey) {
  throw new Error("STRIPE_SECRET_KEY is not configured");
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2024-04-10",
});

interface StripeCheckoutPayload {
  booking: BookingDocument;
  customerEmail?: string;
  venueName?: string;
}

const getFrontendUrl = (): string => {
  return process.env.FRONTEND_URL || "http://localhost:3000";
};

const buildSuccessUrl = (bookingId: string): string => {
  return (
    process.env.STRIPE_SUCCESS_URL ||
    `${getFrontendUrl()}/payment?status=success&bookingId=${bookingId}&session_id={CHECKOUT_SESSION_ID}`
  );
};

const buildCancelUrl = (bookingId: string): string => {
  return (
    process.env.STRIPE_CANCEL_URL ||
    `${getFrontendUrl()}/payment?status=cancel&bookingId=${bookingId}`
  );
};

export const createStripeCheckoutSession = async (
  payload: StripeCheckoutPayload,
): Promise<Stripe.Checkout.Session> => {
  const { booking, customerEmail, venueName } = payload;
  const unitAmount = Math.round(booking.totalAmount * 100);

  if (unitAmount <= 0) {
    throw new Error("Booking amount must be greater than zero");
  }

  const sessionConfig: Stripe.Checkout.SessionCreateParams = {
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "inr",
          unit_amount: unitAmount,
          product_data: {
            name: venueName || "Venue booking",
          },
        },
        quantity: 1,
      },
    ],
    success_url: buildSuccessUrl(booking._id.toString()),
    cancel_url: buildCancelUrl(booking._id.toString()),
    metadata: {
      bookingId: booking._id.toString(),
      userId: booking.userId.toString(),
    },
    payment_intent_data: {
      metadata: {
        bookingId: booking._id.toString(),
        userId: booking.userId.toString(),
      },
      transfer_group: `booking_${booking._id.toString()}`,
    },
  };

  if (customerEmail) {
    sessionConfig.customer_email = customerEmail;
  }

  const session = await stripe.checkout.sessions.create(sessionConfig);

  return session;
};

const createTransfersForBooking = async (
  booking: BookingDocument,
): Promise<void> => {
  for (const payment of booking.payments) {
    const user = await User.findById(payment.userId).select("stripeAccountId");
    if (!user?.stripeAccountId) {
      continue;
    }

    const transferAmount = Math.round(payment.amount * 100);
    if (transferAmount <= 0) {
      continue;
    }

    await stripe.transfers.create({
      amount: transferAmount,
      currency: "inr",
      destination: user.stripeAccountId,
      transfer_group: `booking_${booking._id.toString()}`,
    });
  }
};

export const handleStripeWebhookEvent = async (
  payload: Buffer,
  signature?: string,
): Promise<void> => {
  if (!signature) {
    throw new Error("Missing Stripe webhook signature");
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("Invalid webhook signature");
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const bookingId = session.metadata?.bookingId;

    if (!bookingId) {
      return;
    }

    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return;
    }

    if (booking.status === "CONFIRMED") {
      return;
    }

    booking.paymentProvider = "stripe";
    booking.stripeCheckoutSessionId = session.id;
    if (typeof session.payment_intent === "string") {
      booking.stripePaymentIntentId = session.payment_intent;
    }
    await booking.save();

    await updatePaymentStatus(bookingId, booking.userId.toString(), "PAID");
    await createTransfersForBooking(booking);
  }
};
