import {
  CoachSubscriptionPaymentDocument,
  CoachSubscriptionPaymentTransaction,
} from "../models/CoachSubscriptionPayment";
import { subscribeToCoachPackage } from "./CoachSubscriptionService";

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

const applySubscriptionActivation = async (
  transaction: CoachSubscriptionPaymentDocument,
): Promise<void> => {
  if (transaction.linkedSubscriptionId) {
    return;
  }

  const subscription = await subscribeToCoachPackage({
    userId: transaction.userId.toString(),
    ...(transaction.dependentId ? { dependentId: transaction.dependentId.toString() } : {}),
    coachId: transaction.coachId.toString(),
    packageId: transaction.packageId.toString(),
  });

  transaction.linkedSubscriptionId = subscription._id;
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

  const query = merchantOrderId ? { merchantOrderId } : { phonepeOrderId };
  const transaction = await CoachSubscriptionPaymentTransaction.findOne(query);
  if (!transaction) {
    return null;
  }

  if (params.callbackPayload) {
    transaction.callbackPayload = params.callbackPayload;
  }

  const state = normalizeState(params.state);
  transaction.state = state;

  if (state === "COMPLETED") {
    transaction.status = "COMPLETED";

    if (params.allowActivation) {
      await applySubscriptionActivation(transaction);
    }
  } else if (state === "FAILED") {
    transaction.status = "FAILED";
  }

  await transaction.save();
  return transaction;
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
