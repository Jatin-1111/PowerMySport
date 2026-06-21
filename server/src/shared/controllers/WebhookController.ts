import { Request, Response } from "express";
import crypto from "crypto";
import { PaymentService, RefundService } from "../services/PaymentService";
import { OrderService } from "../../shop/services/EcommerceService";
import { Order as OrderModel, PaymentTransaction as PaymentTransactionModel } from "../../shop/models/Ecommerce";
import { NotificationService } from "../../client/services/NotificationService";
import { sendEmail } from "../../utils/email";
import { PaymentGateway, PaymentStatus } from "../../types/ecommerce";

// ============ WEBHOOK CONTROLLER ============
//
// SCOPE: This controller handles PhonePe webhooks for **e-commerce (shop) orders** only.
// It is mounted at /api/v1/webhooks/phonepe via ecommerceRoutes.ts.
//
// BOOKING PAYMENTS and COACH SUBSCRIPTION PAYMENTS are handled by a separate
// pipeline: shared/routes/phonepeWebhook.ts → OutboxService → reconciliation
// functions in BookingService and CoachSubscriptionPaymentService.
//
// The event shapes handled here (payment.captured, payment.failed, refund.created)
// follow the e-commerce order payment flow. Do NOT add booking or subscription
// logic to this controller.

export class WebhookController {
  private paymentService: PaymentService;
  private orderService: OrderService;
  private refundService: RefundService;

  constructor() {
    this.paymentService = new PaymentService();
    this.orderService = new OrderService();
    this.refundService = new RefundService();
  }

  /**
   * Verify PhonePe webhook signature (HMAC-SHA256)
   */
  private verifyPhonePeSignature(
    payload: string | Buffer,
    signature: string,
    secret: string,
  ): boolean {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "utf8");
    const signatureBuffer = Buffer.from(signature, "utf8");

    if (expectedBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
  }

  /**
   * POST /api/v1/webhooks/phonepe
   * Handle PhonePe webhook events
   */
  async handlePhonePeWebhook(req: Request, res: Response): Promise<void> {
    try {
      // Get raw body for signature verification
      const rawBody = Buffer.isBuffer(req.body)
        ? req.body
        : (req as any).rawBody || JSON.stringify(req.body);
      const signature = req.headers["x-phonepe-signature"] as string;

      if (!signature) {
        res.status(401).json({
          ok: false,
          error: { code: "MISSING_SIGNATURE", message: "Signature missing" },
        });
        return;
      }

      // Verify signature
      const webhookSecret = process.env.PHONEPE_WEBHOOK_SECRET || "";
      if (!this.verifyPhonePeSignature(rawBody, signature, webhookSecret)) {
        res.status(401).json({
          ok: false,
          error: {
            code: "INVALID_SIGNATURE",
            message: "Webhook signature invalid",
          },
        });
        return;
      }

      // Parse payload
      const payloadText = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : req.body;
      const payload = typeof payloadText === "string" ? JSON.parse(payloadText) : payloadText;
      const { event, created_at, payload: eventPayload } = payload;

      console.log(
        `[Webhook] Processing event: ${event} at ${new Date(created_at * 1000).toISOString()}`,
      );

      // Process based on event type
      switch (event) {
        case "payment.authorized":
          await this.handlePaymentAuthorized(eventPayload);
          break;

        case "payment.captured":
          await this.handlePaymentCaptured(eventPayload);
          break;

        case "payment.failed":
          await this.handlePaymentFailed(eventPayload);
          break;

        case "refund.created":
          await this.handleRefundCreated(eventPayload);
          break;

        case "refund.failed":
          await this.handleRefundFailed(eventPayload);
          break;

        default:
          console.log(`[Webhook] Unhandled event type: ${event}`);
      }

      // Return success to PhonePe
      res.status(200).json({ ok: true, message: "Webhook processed" });
    } catch (error: any) {
      console.error("[Webhook] Error processing webhook:", error);

      // Return 5xx to trigger PhonePe retry
      res.status(500).json({
        ok: false,
        error: {
          code: "WEBHOOK_ERROR",
          message: error.message,
        },
      });
    }
  }

  /**
   * Handle payment.authorized event
   * Called when payment is authorized but not yet captured
   */
  private async handlePaymentAuthorized(payload: any): Promise<void> {
    const payment = payload.payment;
    const orderId = payment.notes?.orderId;

    console.log(
      `[Webhook:Authorized] Payment ${payment.id} for order ${orderId}`,
    );

    if (!orderId) {
      console.warn("[Webhook:Authorized] Order ID not found in payment notes");
      return;
    }

    // Update payment transaction in DB
    // Payment will be marked as CAPTURED when payment.captured event arrives
  }

  /**
   * Handle payment.captured event
   * Called when payment is successfully captured
   */
  private async handlePaymentCaptured(payload: any): Promise<void> {
    const payment = payload.payment;
    const orderId = payment.notes?.orderId;

    console.log(
      `[Webhook:Captured] Payment ${payment.id} for order ${orderId}`,
    );

    if (!orderId) {
      console.warn("[Webhook:Captured] Order ID not found in payment notes");
      return;
    }

    try {
      // Confirm payment in order service
      const order = await this.orderService.confirmPayment(
        orderId,
        payment.id,
        payment.order_id,
      );

      console.log(`[Webhook:Captured] Order ${orderId} payment confirmed`);

      // Emit notification
      await NotificationService.send({
        userId: order.userId.toString(),
        type: "PAYMENT_CONFIRMED",
        title: "Payment Confirmed",
        message: `Your payment for order ${order.orderNumber} has been confirmed.`,
        data: { orderId: order._id.toString(), orderNumber: order.orderNumber },
      });

      // Emit socket event to user
      // io.to(`user:${order.userId}`).emit("order_payment_confirmed", {
      //   orderId: order._id,
      //   orderNumber: order.orderNumber,
      //   status: order.status,
      // });
    } catch (error: any) {
      console.error(
        `[Webhook:Captured] Error confirming payment for order ${orderId}:`,
        error,
      );

      // Log for manual review
      await this.logWebhookError(
        "payment.captured",
        orderId,
        error.message,
        payload,
      );
    }
  }

  /**
   * Handle payment.failed event
   * Called when payment fails
   */
  private async handlePaymentFailed(payload: any): Promise<void> {
    const payment = payload.payment;
    const orderId = payment.notes?.orderId;

    console.log(
      `[Webhook:Failed] Payment ${payment.id} failed for order ${orderId}`,
    );

    if (!orderId) {
      console.warn("[Webhook:Failed] Order ID not found in payment notes");
      return;
    }

    try {
      // Update order with payment failure
      const order = await this.orderService.handlePaymentFailure(
        orderId,
        payment.reason || payment.error_code,
      );

      console.log(`[Webhook:Failed] Order ${orderId} marked as payment failed`);

      // Emit notification
      await NotificationService.send({
        userId: order.userId.toString(),
        type: "PAYMENT_FAILED",
        title: "Payment Failed",
        message: `Payment failed for order ${order.orderNumber}. ${payment.error_description || "Please try again."}`,
        data: { orderId: order._id.toString(), orderNumber: order.orderNumber },
      });

      // Emit socket event
      // io.to(`user:${order.userId}`).emit("order_payment_failed", {
      //   orderId: order._id,
      //   orderNumber: order.orderNumber,
      //   reason: payment.reason,
      // });
    } catch (error: any) {
      console.error(
        `[Webhook:Failed] Error handling payment failure for order ${orderId}:`,
        error,
      );

      await this.logWebhookError(
        "payment.failed",
        orderId,
        error.message,
        payload,
      );
    }
  }

  /**
   * Handle refund.created event
   * Called when refund is processed
   */
  private async handleRefundCreated(payload: any): Promise<void> {
    const refund = payload.refund;
    const paymentId = refund.payment_id;

    console.log(
      `[Webhook:Refund] Refund ${refund.id} for payment ${paymentId}`,
    );

    try {
      // Find order by payment ID and mark as refunded
      const order = await OrderModel.findOne({
        paymentGatewayPaymentId: paymentId,
      });

      if (!order) {
        console.warn(
          `[Webhook:Refund] Order not found for payment ${paymentId}`,
        );
        return;
      }

      // Update order status
      await this.refundService.confirmRefundCompletion(
        order._id.toString(),
        refund.id,
      );

      console.log(`[Webhook:Refund] Order ${order._id} marked as refunded`);

      // Emit notification
      await NotificationService.send({
        userId: order.userId.toString(),
        type: "PAYMENT_REFUND",
        title: "Refund Processed",
        message: `Refund of INR ${refund.amount / 100} has been processed for order ${order.orderNumber}.`,
        data: { orderId: order._id.toString(), orderNumber: order.orderNumber },
      });

      // Emit socket event
      // io.to(`user:${order.userId}`).emit("order_refunded", {
      //   orderId: order._id,
      //   orderNumber: order.orderNumber,
      //   refundAmount: refund.amount / 100,
      // });
    } catch (error: any) {
      console.error(
        `[Webhook:Refund] Error processing refund ${refund.id}:`,
        error,
      );

      await this.logWebhookError(
        "refund.created",
        paymentId,
        error.message,
        payload,
      );
    }
  }

  /**
   * Handle refund.failed event
   * Called when refund fails
   */
  private async handleRefundFailed(payload: any): Promise<void> {
    const refund = payload.refund;
    const paymentId = refund.payment_id;

    console.log(
      `[Webhook:Refund Failed] Refund ${refund.id} failed for payment ${paymentId}`,
    );

    try {
      // Find order and log failure for manual review
      const order = await OrderModel.findOne({
        paymentGatewayPaymentId: paymentId,
      });

      if (order) {
        // Log the failure with full context
        console.error(
          `[Webhook:Refund Failed] Order ${order._id} refund failed:`,
          refund.reason_code,
        );

        // Alert support team via email
        try {
          await sendEmail({
            to: process.env.EMAIL_FROM || "teams@powermysport.com",
            subject: `[Alert] Refund Failed — Order ${order.orderNumber}`,
            html: `
              <!DOCTYPE html><html><body style="font-family:Arial,sans-serif;padding:20px;">
              <h2 style="color:#ef4444;">&#x274c; Refund Failed</h2>
              <p>A refund has failed and requires manual review by the support team.</p>
              <table style="border-collapse:collapse;width:100%;">
                <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;">Order ID</td><td style="padding:8px;border:1px solid #e5e7eb;">${order._id}</td></tr>
                <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;">Order Number</td><td style="padding:8px;border:1px solid #e5e7eb;">${order.orderNumber}</td></tr>
                <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;">Refund ID</td><td style="padding:8px;border:1px solid #e5e7eb;">${refund.id}</td></tr>
                <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;">Payment ID</td><td style="padding:8px;border:1px solid #e5e7eb;">${paymentId}</td></tr>
                <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;">Failure Reason</td><td style="padding:8px;border:1px solid #e5e7eb;">${refund.reason_code || 'Unknown'}</td></tr>
                <tr><td style="padding:8px;border:1px solid #e5e7eb;font-weight:bold;">Failed At</td><td style="padding:8px;border:1px solid #e5e7eb;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</td></tr>
              </table>
              <p style="color:#6b7280;font-size:12px;margin-top:24px;">Please investigate and process the refund manually if required.</p>
              </body></html>
            `,
          });
        } catch (emailError) {
          console.error("[Webhook:Refund Failed] Failed to send support alert email:", emailError);
        }

        // Notify the order owner of the failure
        try {
          await NotificationService.send({
            userId: order.userId.toString(),
            type: "PAYMENT_REFUND",
            title: "Refund Failed",
            message: `Unfortunately, the refund for order ${order.orderNumber} could not be processed automatically. Our support team has been notified and will resolve this within 1-2 business days.`,
            data: {
              orderId: order._id.toString(),
              orderNumber: order.orderNumber,
              refundId: refund.id,
              reasonCode: refund.reason_code,
            },
          });
        } catch (notifError) {
          console.error("[Webhook:Refund Failed] Failed to notify order owner:", notifError);
        }
      }
    } catch (error: any) {
      console.error(
        `[Webhook:Refund Failed] Error handling refund failure:`,
        error,
      );
    }
  }

  /**
   * Log webhook errors for manual review
   * Logs with full structured context for observability.
   * A persistent WebhookLog DB model can be added in future for dashboard queries.
   */
  private async logWebhookError(
    eventType: string,
    reference: string,
    errorMessage: string,
    payload: any,
  ): Promise<void> {
    const logEntry = {
      timestamp: new Date().toISOString(),
      eventType,
      reference,
      errorMessage,
      payloadSummary: {
        event: payload?.event,
        created_at: payload?.created_at,
        entityId: payload?.payload?.payment?.id ||
                  payload?.payload?.refund?.id ||
                  payload?.id ||
                  "unknown",
      },
    };

    // Structured error log (picked up by log aggregators like Datadog/CloudWatch)
    console.error("[WebhookError]", JSON.stringify(logEntry, null, 2));

    // Store error in the WebhookRecoveryService's in-memory log for retry capability
    WebhookRecoveryService.recordError(logEntry);
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

    console.log(`[WebhookRecovery] Retrying event ${entry.eventType} | ref: ${entry.reference}`);

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
            order.paymentGatewayOrderId,
          );
          console.log(`[WebhookRecovery] Successfully recovered payment.captured for order ${entry.reference}`);
        }
      } else if (entry.eventType === "payment.failed") {
        await orderService.handlePaymentFailure(entry.reference);
        console.log(`[WebhookRecovery] Successfully recovered payment.failed for order ${entry.reference}`);
      } else {
        throw new Error(`No retry handler implemented for event type: ${entry.eventType}`);
      }

      // Remove from error log on successful retry
      WebhookRecoveryService.errorLog.delete(errorKey);
    } catch (retryError) {
      console.error(`[WebhookRecovery] Retry failed for ${errorKey}:`, retryError);
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
      console.warn(`[WebhookRecovery] No gateway payment ID on order ${orderId} — skipping reconciliation`);
      return true;
    }

    // Query PhonePe for current payment status via PaymentService
    const paymentService = new PaymentService(PaymentGateway.PHONEPE);
    const gatewayStatus = await paymentService
      .getGatewayService()
      .getPaymentStatus(order.paymentGatewayPaymentId)
      .catch(() => null);

    if (!gatewayStatus) {
      console.warn(`[WebhookRecovery] Could not fetch gateway status for payment ${order.paymentGatewayPaymentId}`);
      return false;
    }

    const dbPaymentTx = await PaymentTransactionModel.findOne({ orderId });
    const dbStatus = dbPaymentTx?.status;

    if (gatewayStatus === PaymentStatus.CAPTURED && dbStatus !== PaymentStatus.CAPTURED) {
      console.warn(`[WebhookRecovery] Discrepancy detected for order ${orderId}: gateway=CAPTURED, db=${dbStatus}. Fixing...`);
      const orderService = new OrderService();
      await orderService.confirmPayment(
        orderId,
        order.paymentGatewayPaymentId,
        order.paymentGatewayOrderId,
      );
      console.log(`[WebhookRecovery] Fixed payment status for order ${orderId}`);
      return true;
    }

    if (gatewayStatus === PaymentStatus.FAILED && dbStatus !== PaymentStatus.FAILED) {
      console.warn(`[WebhookRecovery] Discrepancy for order ${orderId}: gateway=FAILED, db=${dbStatus}. Fixing...`);
      const orderService = new OrderService();
      await orderService.handlePaymentFailure(orderId);
      return true;
    }

    console.log(`[WebhookRecovery] Payment status consistent for order ${orderId}: ${dbStatus}`);
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
      console.warn(`[WebhookRecovery] No gateway payment ID for order ${orderId} — skipping refund reconciliation`);
      return true;
    }

    // If no refund has been initiated, nothing to reconcile
    if (paymentTx.status !== PaymentStatus.REFUND_INITIATED) {
      console.log(`[WebhookRecovery] No pending refund to reconcile for order ${orderId}`);
      return true;
    }

    // Query PhonePe refund status
    const refundService = new RefundService();
    const refundStatus = await refundService
      .getGatewayRefundStatus(paymentTx.gatewayPaymentId)
      .catch(() => null);

    if (!refundStatus) {
      console.warn(`[WebhookRecovery] Could not fetch refund status for payment ${paymentTx.gatewayPaymentId}`);
      return false;
    }

    if (refundStatus === PaymentStatus.REFUNDED && (paymentTx.status as string) !== PaymentStatus.REFUNDED) {
      console.warn(`[WebhookRecovery] Refund discrepancy for order ${orderId}: gateway=REFUNDED, db=${paymentTx.status}. Fixing...`);
      paymentTx.status = PaymentStatus.REFUNDED;
      await paymentTx.save();

      const order = await OrderModel.findById(orderId);
      if (order) {
        order.paymentStatus = PaymentStatus.REFUNDED;
        await order.save();
      }

      console.log(`[WebhookRecovery] Fixed refund status for order ${orderId}`);
    } else {
      console.log(`[WebhookRecovery] Refund status consistent for order ${orderId}: ${paymentTx.status}`);
    }

    return true;
  }
}
