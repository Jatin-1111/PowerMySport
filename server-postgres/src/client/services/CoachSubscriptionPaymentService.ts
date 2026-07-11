import type { CoachSubscriptionPaymentTransaction } from "@prisma/client";
import { Prisma } from "@prisma/client";
import prisma from "../../lib/prisma";
import { subscribeToCoachPackage } from "./CoachSubscriptionService";

// Legacy alias — the Mongoose document type is replaced by the Prisma row type.
type CoachSubscriptionPaymentDocument = CoachSubscriptionPaymentTransaction;

type PaymentState = "PENDING" | "COMPLETED" | "FAILED";

const normalizeState = (value: unknown): PaymentState => {
  if (typeof value !== "string") {
    return "PENDING";
  }

  const upper = value.toUpperCase();
  if (upper === "COMPLETED") {
    return "COMPLETED";
  }
  if (upper === "FAILED") {
    return "FAILED";
  }

  return "PENDING";
};

const asRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== "object") {
    return {};
  }

  return value as Record<string, unknown>;
};

const pickFirstString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
};

const readStateFromPayload = (
  payload: Record<string, unknown>,
): PaymentState => {
  return normalizeState(
    pickFirstString(
      payload.state,
      asRecord(payload.payload).state,
      asRecord(payload.data).state,
      asRecord(payload.event).state,
      asRecord(asRecord(payload.payload).paymentDetails).state,
      asRecord(asRecord(payload.data).paymentDetails).state,
    ),
  );
};

const readMerchantOrderIdFromPayload = (
  payload: Record<string, unknown>,
): string | undefined => {
  return pickFirstString(
    payload.originalMerchantOrderId,
    payload.merchantOrderId,
    asRecord(payload.payload).originalMerchantOrderId,
    asRecord(payload.payload).merchantOrderId,
    asRecord(payload.data).originalMerchantOrderId,
    asRecord(payload.data).merchantOrderId,
    asRecord(asRecord(payload.payload).paymentDetails).merchantOrderId,
    asRecord(asRecord(payload.data).paymentDetails).merchantOrderId,
  );
};

const readPhonePeOrderIdFromPayload = (
  payload: Record<string, unknown>,
): string | undefined => {
  return pickFirstString(
    payload.orderId,
    asRecord(payload.payload).orderId,
    asRecord(payload.data).orderId,
    asRecord(asRecord(payload.payload).paymentDetails).orderId,
    asRecord(asRecord(payload.data).paymentDetails).orderId,
  );
};

/**
 * Activate the coach subscription tied to a completed payment transaction.
 * Returns the id of the linked subscription (idempotent — if the transaction
 * is already linked it returns the existing id without re-subscribing).
 */
const applySubscriptionActivation = async (
  transaction: CoachSubscriptionPaymentDocument,
): Promise<string> => {
  if (transaction.linkedSubscriptionId) {
    return transaction.linkedSubscriptionId;
  }

  const subscription = await subscribeToCoachPackage({
    userId: transaction.userId,
    ...(transaction.dependentId
      ? { dependentId: transaction.dependentId }
      : {}),
    coachId: transaction.coachId,
    packageId: transaction.packageId,
  });

  return subscription.id;
};

export const reconcileCoachSubscriptionPaymentByIdentifiers = async (params: {
  merchantOrderId?: string;
  phonepeOrderId?: string;
  state?: unknown;
  callbackPayload?: Record<string, unknown>;
  allowActivation?: boolean;
}) => {
  const merchantOrderId =
    typeof params.merchantOrderId === "string"
      ? params.merchantOrderId.trim()
      : "";
  const phonepeOrderId =
    typeof params.phonepeOrderId === "string"
      ? params.phonepeOrderId.trim()
      : "";

  if (!merchantOrderId && !phonepeOrderId) {
    return null;
  }

  const where = merchantOrderId ? { merchantOrderId } : { phonepeOrderId };
  const transaction =
    await prisma.coachSubscriptionPaymentTransaction.findFirst({ where });
  if (!transaction) {
    return null;
  }

  const data: Prisma.CoachSubscriptionPaymentTransactionUpdateInput = {};

  if (params.callbackPayload) {
    data.callbackPayload = params.callbackPayload as Prisma.InputJsonValue;
  }

  const state = normalizeState(params.state);
  data.state = state;

  if (state === "COMPLETED") {
    data.status = "COMPLETED";

    if (params.allowActivation) {
      data.linkedSubscriptionId = await applySubscriptionActivation(transaction);
    }
  } else if (state === "FAILED") {
    data.status = "FAILED";
  }

  return prisma.coachSubscriptionPaymentTransaction.update({
    where: { id: transaction.id },
    data,
  });
};

export const reconcileCoachSubscriptionPaymentFromWebhookPayload = async (
  rawPayload: unknown,
) => {
  const payload = asRecord(rawPayload);
  const merchantOrderId = readMerchantOrderIdFromPayload(payload);
  const phonepeOrderId = readPhonePeOrderIdFromPayload(payload);
  const state = readStateFromPayload(payload);

  if (!merchantOrderId && !phonepeOrderId) {
    return null;
  }

  const reconcileParams: {
    merchantOrderId?: string;
    phonepeOrderId?: string;
    state?: unknown;
    callbackPayload?: Record<string, unknown>;
    allowActivation?: boolean;
  } = {
    state,
    callbackPayload: payload,
    allowActivation: true,
  };

  if (merchantOrderId) {
    reconcileParams.merchantOrderId = merchantOrderId;
  }
  if (phonepeOrderId) {
    reconcileParams.phonepeOrderId = phonepeOrderId;
  }

  return reconcileCoachSubscriptionPaymentByIdentifiers(reconcileParams);
};

export type { CoachSubscriptionPaymentDocument };
