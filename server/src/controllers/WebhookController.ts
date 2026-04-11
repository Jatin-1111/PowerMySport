import { Request, Response } from "express";
import crypto from "crypto";
import { PaymentService, RefundService } from "../services/PaymentService";
import { OrderService } from "../services/EcommerceService";
import { Order as OrderModel } from "../models/Ecommerce";
import { NotificationService } from "../services/NotificationService";

// ============ WEBHOOK CONTROLLER ============

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
   * Verify Razorpay webhook signature (HMAC-SHA256)
   */
  private verifyRazorpaySignature(
    payload: string,
    signature: string,
    secret: string,
  ): boolean {
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(payload)
      .digest("hex");

    return expectedSignature === signature;
  }

  /**
   * POST /api/v1/webhooks/razorpay
   * Handle Razorpay webhook events
   */
  async handleRazorpayWebhook(req: Request, res: Response): Promise<void> {
    try {
      // Get raw body for signature verification
      const rawBody = (req as any).rawBody || JSON.stringify(req.body);
      const signature = req.headers["x-razorpay-signature"] as string;

      if (!signature) {
        res.status(401).json({
          ok: false,
          error: { code: "MISSING_SIGNATURE", message: "Signature missing" },
        });
        return;
      }

      // Verify signature
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
      if (!this.verifyRazorpaySignature(rawBody, signature, webhookSecret)) {
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
      const payload =
        typeof req.body === "string" ? JSON.parse(req.body) : req.body;
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

      // Return success to Razorpay
      res.status(200).json({ ok: true, message: "Webhook processed" });
    } catch (error: any) {
      console.error("[Webhook] Error processing webhook:", error);

      // Return 5xx to trigger Razorpay retry
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
        // Send notification to support team for manual review
        console.error(
          `[Webhook:Refund Failed] Order ${order._id} refund failed:`,
          refund.reason_code,
        );

        // TODO: Emit to support dashboard
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
   */
  private async logWebhookError(
    eventType: string,
    reference: string,
    errorMessage: string,
    payload: any,
  ): Promise<void> {
    // TODO: Implement webhook error logging
    // Could store in a WebhookLog model for dashboard review
    console.error(
      `[Webhook Error] ${eventType} | ${reference} | ${errorMessage}`,
    );
  }
}

// ============ WEBHOOK ERROR RECOVERY ============

export class WebhookRecoveryService {
  /**
   * Manual webhook retry (for admin dashboard)
   * Use when webhook processing fails and needs to be retried
   */
  async retryFailedWebhook(eventId: string): Promise<void> {
    // TODO: Implement webhook retry logic
    // - Fetch webhook from log
    // - Reprocess with fresh context
    // - Update status
  }

  /**
   * Reconcile payment state
   * Use to verify order payment status matches gateway
   */
  async reconcileOrderPayment(orderId: string): Promise<boolean> {
    // TODO: Query Razorpay API for payment status
    // - Compare with DB order status
    // - Fix discrepancies
    // - Flag for manual review if major discrepancy
    return true;
  }

  /**
   * Reconcile refund state
   * Use to verify refund status with gateway
   */
  async reconcileOrderRefund(orderId: string): Promise<boolean> {
    // TODO: Query Razorpay API for refund status
    // - Compare with DB order status
    // - Fix discrepancies
    return true;
  }
}
