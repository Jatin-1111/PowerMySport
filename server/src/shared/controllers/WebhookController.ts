import { Request, Response } from "express";
import { PaymentService, RefundService } from "../services/PaymentService";
import { OrderService } from "../../shop/services/EcommerceService";
import {
  Order as OrderModel,
  PaymentTransaction as PaymentTransactionModel,
} from "../../shop/models/Ecommerce";
import { PaymentGateway, PaymentStatus } from "../../types/ecommerce";
import { log as __rootLog } from "../../utils/logger";
import { receivePhonePeWebhook } from "../routes/phonepeWebhook";
const log = __rootLog.child("webhook");

// ============ WEBHOOK CONTROLLER ============
//
// PhonePe webhooks for every payment type (booking, coach subscription, shop
// order, wallet top-up, expert session) are handled by one receiver,
// shared/routes/phonepeWebhook.ts: it authenticates the request the way PhonePe
// sends it, stores the event, and the outbox worker reconciles it.
//
// This controller only keeps the shop's older URL, /api/v1/webhooks/phonepe
// (ecommerceRoutes.ts), working for webhooks already registered there. It used to
// carry its own handlers, written for a Razorpay-style scheme (an
// x-phonepe-signature header; payment.captured / refund.created events) that
// PhonePe does not send, so every real delivery was rejected before reaching them.

export class WebhookController {
  /**
   * POST /api/v1/webhooks/phonepe
   * Same receiver as POST /api/payments/phonepe/webhook.
   */
  async handlePhonePeWebhook(req: Request, res: Response): Promise<void> {
    await receivePhonePeWebhook(req, res);
  }
}

// ============ WEBHOOK ERROR RECOVERY ============

/** In-memory store for failed webhook events pending retry */
interface WebhookErrorEntry {
  timestamp: string;
  eventType: string;
  reference: string;
  errorMessage: string;
  payloadSummary: Record<string, any>;
}

export class WebhookRecoveryService {
  /** In-memory log of recent webhook errors (survives until server restart) */
  private static errorLog: Map<string, WebhookErrorEntry & { retryCount: number }> = new Map();

  /**
   * Record a webhook error for potential retry
   * Called by WebhookController.logWebhookError
   */
  static recordError(entry: WebhookErrorEntry): void {
    const key = `${entry.eventType}:${entry.reference}:${entry.timestamp}`;
    WebhookRecoveryService.errorLog.set(key, { ...entry, retryCount: 0 });

    // Keep only the last 500 errors to prevent memory leaks
    if (WebhookRecoveryService.errorLog.size > 500) {
      const firstKey = WebhookRecoveryService.errorLog.keys().next().value;
      if (firstKey) WebhookRecoveryService.errorLog.delete(firstKey);
    }
  }

  /**
   * List all recorded webhook errors (for admin dashboard)
   */
  static listErrors(): Array<WebhookErrorEntry & { retryCount: number; key: string }> {
    return Array.from(WebhookRecoveryService.errorLog.entries()).map(([key, entry]) => ({
      key,
      ...entry,
    }));
  }

  /**
   * Manual webhook retry (for admin dashboard)
   * Re-processes the failed webhook event using a fresh WebhookController context.
   * NOTE: This works for events that are still recoverable from DB state.
   * For a durable solution, persist error logs to a WebhookLog MongoDB model.
   */
  async retryFailedWebhook(errorKey: string): Promise<void> {
    const entry = WebhookRecoveryService.errorLog.get(errorKey);
    if (!entry) {
      throw new Error(`No recorded error found for key: ${errorKey}`);
    }

    log.info(`[WebhookRecovery] Retrying event ${entry.eventType} | ref: ${entry.reference}`);

    // Increment retry count
    entry.retryCount++;
    WebhookRecoveryService.errorLog.set(errorKey, entry);

    // Re-process based on event type using OrderService
    const orderService = new OrderService();

    try {
      if (entry.eventType === "payment.captured") {
        // Re-confirm payment for the order referenced
        const order = await OrderModel.findById(entry.reference);
        if (order && order.paymentGatewayPaymentId) {
          await orderService.confirmPayment(
            entry.reference,
            order.paymentGatewayPaymentId,
            order.paymentGatewayOrderId
          );
          log.info(
            `[WebhookRecovery] Successfully recovered payment.captured for order ${entry.reference}`
          );
        }
      } else if (entry.eventType === "payment.failed") {
        await orderService.handlePaymentFailure(entry.reference);
        log.info(
          `[WebhookRecovery] Successfully recovered payment.failed for order ${entry.reference}`
        );
      } else {
        throw new Error(`No retry handler implemented for event type: ${entry.eventType}`);
      }

      // Remove from error log on successful retry
      WebhookRecoveryService.errorLog.delete(errorKey);
    } catch (retryError) {
      log.error(`[WebhookRecovery] Retry failed for ${errorKey}:`, retryError);
      throw retryError;
    }
  }

  /**
   * Reconcile payment state
   * Queries DB for the order and payment transaction, then checks if the
   * gateway payment status is consistent with the stored order status.
   */
  async reconcileOrderPayment(orderId: string): Promise<boolean> {
    const order = await OrderModel.findById(orderId);
    if (!order) {
      throw new Error(`Order not found: ${orderId}`);
    }

    if (!order.paymentGatewayPaymentId) {
      log.warn(
        `[WebhookRecovery] No gateway payment ID on order ${orderId} — skipping reconciliation`
      );
      return true;
    }

    // Query PhonePe for current payment status via PaymentService
    const paymentService = new PaymentService(PaymentGateway.PHONEPE);
    const gatewayStatus = await paymentService
      .getGatewayService()
      .getPaymentStatus(order.paymentGatewayPaymentId)
      .catch(() => null);

    if (!gatewayStatus) {
      log.warn(
        `[WebhookRecovery] Could not fetch gateway status for payment ${order.paymentGatewayPaymentId}`
      );
      return false;
    }

    const dbPaymentTx = await PaymentTransactionModel.findOne({ orderId });
    const dbStatus = dbPaymentTx?.status;

    if (gatewayStatus === PaymentStatus.CAPTURED && dbStatus !== PaymentStatus.CAPTURED) {
      log.warn(
        `[WebhookRecovery] Discrepancy detected for order ${orderId}: gateway=CAPTURED, db=${dbStatus}. Fixing...`
      );
      const orderService = new OrderService();
      await orderService.confirmPayment(
        orderId,
        order.paymentGatewayPaymentId,
        order.paymentGatewayOrderId
      );
      log.info(`[WebhookRecovery] Fixed payment status for order ${orderId}`);
      return true;
    }

    if (gatewayStatus === PaymentStatus.FAILED && dbStatus !== PaymentStatus.FAILED) {
      log.warn(
        `[WebhookRecovery] Discrepancy for order ${orderId}: gateway=FAILED, db=${dbStatus}. Fixing...`
      );
      const orderService = new OrderService();
      await orderService.handlePaymentFailure(orderId);
      return true;
    }

    log.info(`[WebhookRecovery] Payment status consistent for order ${orderId}: ${dbStatus}`);
    return true;
  }

  /**
   * Reconcile refund state
   * Queries the PaymentTransaction for refund info, then verifies against
   * the gateway refund status and fixes any discrepancies.
   */
  async reconcileOrderRefund(orderId: string): Promise<boolean> {
    const paymentTx = await PaymentTransactionModel.findOne({ orderId });
    if (!paymentTx) {
      throw new Error(`No payment transaction found for order: ${orderId}`);
    }

    if (!paymentTx.gatewayPaymentId) {
      log.warn(
        `[WebhookRecovery] No gateway payment ID for order ${orderId} — skipping refund reconciliation`
      );
      return true;
    }

    // If no refund has been initiated, nothing to reconcile
    if (paymentTx.status !== PaymentStatus.REFUND_INITIATED) {
      log.info(`[WebhookRecovery] No pending refund to reconcile for order ${orderId}`);
      return true;
    }

    // Query PhonePe refund status
    const refundService = new RefundService();
    const refundStatus = await refundService
      .getGatewayRefundStatus(paymentTx.gatewayPaymentId)
      .catch(() => null);

    if (!refundStatus) {
      log.warn(
        `[WebhookRecovery] Could not fetch refund status for payment ${paymentTx.gatewayPaymentId}`
      );
      return false;
    }

    if (
      refundStatus === PaymentStatus.REFUNDED &&
      (paymentTx.status as string) !== PaymentStatus.REFUNDED
    ) {
      log.warn(
        `[WebhookRecovery] Refund discrepancy for order ${orderId}: gateway=REFUNDED, db=${paymentTx.status}. Fixing...`
      );
      paymentTx.status = PaymentStatus.REFUNDED;
      await paymentTx.save();

      const order = await OrderModel.findById(orderId);
      if (order) {
        order.paymentStatus = PaymentStatus.REFUNDED;
        await order.save();
      }

      log.info(`[WebhookRecovery] Fixed refund status for order ${orderId}`);
    } else {
      log.info(
        `[WebhookRecovery] Refund status consistent for order ${orderId}: ${paymentTx.status}`
      );
    }

    return true;
  }
}
