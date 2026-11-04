import { getPhonePeOrderStatus } from "../../../shared/services/PhonePeService";
import { PaymentStatus } from "../../../types/ecommerce";
import { PaymentTransaction as PaymentTransactionModel } from "../../models/Ecommerce";
import { OrderService } from "./orderService";
import { log as __rootLog } from "../../../utils/logger";
const log = __rootLog.child("ecommerce");

const pickStr = (...values: unknown[]): string | undefined => {
  for (const v of values) {
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
};

const asObj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" ? (v as Record<string, unknown>) : {};

/**
 * Reconcile an e-commerce order payment from a raw PhonePe webhook payload.
 * Called by the outbox worker alongside booking and coach-subscription reconciliation.
 *
 * Only acts on merchantOrderIds that start with "O_" (e-commerce prefix).
 * Returns true if the order was updated, false/null if not applicable.
 */
export async function reconcileEcommerceOrderFromWebhookPayload(
  rawPayload: unknown
): Promise<boolean | null> {
  const payload = asObj(rawPayload);
  const inner = asObj(payload.payload);
  const data = asObj(payload.data);

  const merchantOrderId = pickStr(
    payload.originalMerchantOrderId,
    payload.merchantOrderId,
    inner.originalMerchantOrderId,
    inner.merchantOrderId,
    data.originalMerchantOrderId,
    data.merchantOrderId,
    asObj(inner.paymentDetails).merchantOrderId,
    asObj(data.paymentDetails).merchantOrderId
  );

  if (!merchantOrderId || !merchantOrderId.startsWith("O_")) {
    return null;
  }

  const paymentTx = await PaymentTransactionModel.findOne({
    gatewayOrderId: merchantOrderId,
  });

  if (!paymentTx) {
    return null;
  }

  if (paymentTx.status === PaymentStatus.CAPTURED) {
    return false;
  }

  try {
    const result = await getPhonePeOrderStatus(merchantOrderId);
    if (result.state !== "COMPLETED") {
      return false;
    }
  } catch {
    return false;
  }

  const orderService = new OrderService();
  await orderService.confirmPayment(
    paymentTx.orderId.toString(),
    paymentTx.gatewayPaymentId || merchantOrderId,
    merchantOrderId
  );

  log.info("[ecommerce-reconcile] order confirmed from webhook", {
    merchantOrderId,
    orderId: paymentTx.orderId,
  });

  return true;
}
