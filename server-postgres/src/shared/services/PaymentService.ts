import crypto from "crypto";
import {
  PaymentGateway,
  PaymentStatus,
  ApiResponse,
} from "../../types/ecommerce";
import {
  ShopPaymentStatus,
  PaymentGateway as PrismaPaymentGateway,
} from "@prisma/client";
import type { ShopPaymentTransaction } from "@prisma/client";
import prisma from "../../lib/prisma";
import {
  initiatePhonePePayment,
  getPhonePeOrderStatus,
  initiatePhonePeRefund,
} from "./PhonePeService";

// ============ PAYMENT GATEWAY SERVICE INTERFACE ============

export interface IPaymentGatewayService {
  createOrder(
    orderId: string,
    amount: number,
    currency: string,
    description: string,
    customer: {
      name: string;
      email: string;
      phone: string;
    },
  ): Promise<any>;

  verifyPayment(
    paymentId: string,
    orderId: string,
    signature: string,
  ): Promise<boolean>;

  initiateRefund(
    paymentId: string,
    amount: number,
    reason: string,
  ): Promise<string>;

  getPaymentStatus(paymentId: string): Promise<PaymentStatus>;
}

// ============ PHONEPE PAYMENT GATEWAY ============

export class PhonePeGatewayService implements IPaymentGatewayService {
  constructor() {
    // Configuration validation is handled dynamically inside PhonePeService
  }

  /**
   * Create order in PhonePe using the robust PhonePeService SDK
   */
  async createOrder(
    orderId: string,
    amount: number,
    currency: string = "INR",
    description: string = "",
    customer: {
      name: string;
      email: string;
      phone: string;
    },
  ): Promise<any> {
    const merchantOrderId = `O_${orderId}_${Date.now()}`;
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";

    const result = await initiatePhonePePayment({
      merchantOrderId,
      amount: Math.round(amount), // amount is already in paise from Ecommerce system
      redirectUrl: `${frontendUrl}/shop/orders/${orderId}`,
      userPhone: customer.phone,
    });

    return {
      success: true,
      data: {
        merchantTransactionId: result.merchantOrderId,
        instrumentResponse: {
          redirectInfo: {
            url: result.redirectUrl,
          },
        },
      },
    };
  }

  verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string,
  ): boolean {
    return true; // We rely on getPaymentStatus polling for definitive truth
  }

  /**
   * Verify payment from gateway by fetching actual order status via SDK.
   * merchantOrderId must be the merchantOrderId sent to PhonePe (not the PhonePe payment ID).
   */
  async verifyPayment(
    merchantOrderId: string,
    _orderId: string,
    _signature: string,
  ): Promise<boolean> {
    const status = await this.getPaymentStatus(merchantOrderId);
    return status === PaymentStatus.CAPTURED;
  }

  /**
   * Initiate refund using PhonePeService SDK.
   * merchantOrderId must be the merchantOrderId sent during order creation, not the PhonePe payment ID.
   * amount is in paise; this function converts to rupees for the PhonePe SDK.
   */
  async initiateRefund(
    merchantOrderId: string,
    amount: number,
    reason: string,
  ): Promise<string> {
    const result = await initiatePhonePeRefund({
      merchantRefundId: `R_${merchantOrderId}_${Date.now()}`,
      originalMerchantOrderId: merchantOrderId,
      amount: amount / 100, // PhonePe SDK expects rupees; amount here is in paise
    });

    return result.refundId || "";
  }

  /**
   * Get payment status via PhonePeService SDK
   */
  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    try {
      const result = await getPhonePeOrderStatus(paymentId);

      if (result.state === "COMPLETED") return PaymentStatus.CAPTURED;
      if (result.state === "PENDING") return PaymentStatus.PENDING;
      return PaymentStatus.FAILED;
    } catch (error: any) {
      console.error("PhonePe status error:", error.message);
      return PaymentStatus.FAILED;
    }
  }
}

// ============ PAYMENT SERVICE ============

export class PaymentService {
  private gatewayService: IPaymentGatewayService;

  constructor(_gateway: PaymentGateway = PaymentGateway.PHONEPE) {
    this.gatewayService = new PhonePeGatewayService();
  }

  /**
   * Expose the underlying gateway service for advanced operations (e.g., reconciliation)
   */
  getGatewayService(): IPaymentGatewayService {
    return this.gatewayService;
  }

  /**
   * Initiate payment with idempotency
   */
  async initiatePayment(
    orderId: string,
    amount: number,
    currency: string,
    idempotencyKey: string,
    paymentGateway: PaymentGateway,
    customer: {
      name: string;
      email: string;
      phone: string;
    },
  ): Promise<ShopPaymentTransaction> {
    // Check for duplicate using idempotency key (unique field).
    const existingTransaction = await prisma.shopPaymentTransaction.findUnique({
      where: { idempotencyKey },
    });

    if (existingTransaction) {
      return existingTransaction;
    }

    // Create order in payment gateway
    const gatewayOrder = await this.gatewayService.createOrder(
      orderId,
      amount,
      currency,
      `Order #${orderId}`,
      customer,
    );

    // Record transaction
    const transaction = await prisma.shopPaymentTransaction.create({
      data: {
        orderId, // String FK — Mongo used a new ObjectId(orderId)
        // TODO(prisma): types/ecommerce PaymentGateway and the generated Prisma
        // PaymentGateway enum are string-identical (PHONEPE only); the cast
        // reconciles the two nominal enum types.
        paymentGateway: paymentGateway as unknown as PrismaPaymentGateway,
        gatewayOrderId:
          gatewayOrder.id || gatewayOrder.data?.merchantTransactionId,
        amount,
        currency,
        status: ShopPaymentStatus.PENDING,
        idempotencyKey,
        gatewayResponse: gatewayOrder,
        attemptNumber: 1,
      },
    });

    return transaction;
  }

  /**
   * Verify and confirm payment
   */
  async verifyAndConfirmPayment(
    orderId: string,
    paymentId: string,
    _phonepeOrderId: string,
    _signature: string,
  ): Promise<ShopPaymentTransaction> {
    // SECURITY: the client-supplied phonepeOrderId/signature are NOT trusted.
    // We locate the transaction by our own orderId link, then re-poll PhonePe
    // using the merchantOrderId WE stored at order creation, and require BOTH a
    // COMPLETED state AND an exact amount match (paise) before confirming.
    const transaction = await prisma.shopPaymentTransaction.findFirst({
      where: { orderId },
      orderBy: { createdAt: "desc" },
    });

    if (!transaction) {
      throw new Error("Payment transaction not found");
    }

    const gatewayStatus = await getPhonePeOrderStatus(
      transaction.gatewayOrderId,
    );

    if (gatewayStatus.state !== "COMPLETED") {
      throw new Error("Payment not completed");
    }

    if (
      typeof gatewayStatus.amount !== "number" ||
      gatewayStatus.amount !== transaction.amount
    ) {
      throw new Error("Payment amount mismatch");
    }

    const updated = await prisma.shopPaymentTransaction.update({
      where: { id: transaction.id },
      data: {
        gatewayPaymentId: paymentId,
        status: ShopPaymentStatus.CAPTURED,
      },
    });

    return updated || transaction;
  }

  /**
   * Handle payment failure
   */
  async recordPaymentFailure(
    orderId: string,
    gatewayOrderId: string,
    failureReason: string,
  ): Promise<ShopPaymentTransaction> {
    // Mongo findOneAndUpdate on a non-unique (orderId, gatewayOrderId) filter.
    // Prisma has no atomic find-and-update on non-unique keys, so read then
    // update by id inside a transaction to keep the two writes ordered.
    const transaction = await prisma.$transaction(async (tx) => {
      const found = await tx.shopPaymentTransaction.findFirst({
        where: { orderId, gatewayOrderId },
      });
      if (!found) return null;
      return tx.shopPaymentTransaction.update({
        where: { id: found.id },
        data: {
          status: ShopPaymentStatus.FAILED,
          gatewayResponse: { failure_reason: failureReason },
        },
      });
    });

    if (!transaction) {
      throw new Error("Payment transaction not found");
    }

    return transaction;
  }

  /**
   * Process webhook payment event
   * Idempotency is ensured by webhook event ID as idempotency key
   */
  async processWebhookPaymentEvent(
    eventId: string,
    eventType: string,
    payload: any,
  ): Promise<ShopPaymentTransaction> {
    // Check for duplicate event (idempotencyKey is unique).
    const existingTransaction = await prisma.shopPaymentTransaction.findUnique({
      where: { idempotencyKey: `webhook-${eventId}` },
    });

    if (existingTransaction) {
      return existingTransaction; // Duplicate event - return existing
    }

    let transaction: ShopPaymentTransaction | null = null;

    if (
      eventType === "payment.authorized" ||
      eventType === "payment.captured"
    ) {
      const payment = payload.payload.payment;

      transaction = await prisma.$transaction(async (tx) => {
        const found = await tx.shopPaymentTransaction.findFirst({
          where: {
            gatewayOrderId: payment.order_id,
            gatewayPaymentId: payment.id,
          },
        });
        if (!found) return null;
        return tx.shopPaymentTransaction.update({
          where: { id: found.id },
          data: {
            status: ShopPaymentStatus.CAPTURED,
            webhookData: payload,
            idempotencyKey: `webhook-${eventId}`, // Update idempotency key
          },
        });
      });

      if (!transaction) {
        throw new Error("Payment transaction not found");
      }
    } else if (eventType === "payment.failed") {
      const payment = payload.payload.payment;

      transaction = await prisma.$transaction(async (tx) => {
        const found = await tx.shopPaymentTransaction.findFirst({
          where: { gatewayOrderId: payment.order_id },
        });
        if (!found) return null;
        return tx.shopPaymentTransaction.update({
          where: { id: found.id },
          data: {
            status: ShopPaymentStatus.FAILED,
            webhookData: payload,
            idempotencyKey: `webhook-${eventId}`,
          },
        });
      });

      if (!transaction) {
        throw new Error("Payment transaction not found");
      }
    } else {
      throw new Error(`Unknown webhook event type: ${eventType}`);
    }

    if (!transaction) {
      throw new Error("Payment transaction not found");
    }

    return transaction;
  }
}

// ============ REFUND SERVICE ============

export class RefundService {
  private paymentService: PaymentService;

  constructor() {
    // Use PhonePe as default gateway for refunds
    this.paymentService = new PaymentService(PaymentGateway.PHONEPE);
  }

  /**
   * Initiate refund for an order.
   * merchantOrderId must be the gatewayOrderId stored on the PaymentTransaction
   * (the merchantOrderId sent to PhonePe at order creation), NOT the gatewayPaymentId.
   */
  async initiateRefund(
    orderId: string,
    merchantOrderId: string,
    refundAmount: number,
    reason: string,
  ): Promise<string> {
    // Validate order exists
    const order = await prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      throw new Error("Order not found");
    }

    // Only a CAPTURED order can be refunded. This also blocks repeat refunds:
    // the first refund flips paymentStatus to REFUND_INITIATED, so a second
    // call no longer sees CAPTURED and is rejected (prevents over-refunding
    // beyond the amount actually collected).
    if (order.paymentStatus !== ShopPaymentStatus.CAPTURED) {
      throw new Error("Order is not in a refundable (captured) state");
    }

    if (!merchantOrderId) {
      throw new Error("Merchant order ID required for refund");
    }

    if (refundAmount <= 0) {
      throw new Error("Refund amount must be positive");
    }

    if (refundAmount > order.totalAmount) {
      throw new Error("Refund amount exceeds order total");
    }

    // Call payment gateway to initiate refund
    const refundId = await new PhonePeGatewayService().initiateRefund(
      merchantOrderId,
      refundAmount,
      reason,
    );

    // Update order status
    await prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: ShopPaymentStatus.REFUND_INITIATED },
    });

    return refundId;
  }

  /**
   * Confirm refund completion
   */
  async confirmRefundCompletion(
    orderId: string,
    refundId: string,
  ): Promise<void> {
    const order = await prisma.order.findUnique({ where: { id: orderId } });

    if (!order) {
      throw new Error("Order not found");
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { paymentStatus: ShopPaymentStatus.REFUNDED },
    });
  }

  /**
   * Query the payment gateway for the current refund/payment status
   * Used by WebhookRecoveryService.reconcileOrderRefund for discrepancy detection
   */
  async getGatewayRefundStatus(paymentId: string): Promise<PaymentStatus> {
    return new PhonePeGatewayService().getPaymentStatus(paymentId);
  }

  /**
   * Handle refund.created webhook event
   */
  async handleRefundWebhookEvent(payload: any): Promise<void> {
    const refund = payload.payload.refund;
    const paymentId = refund.payment_id;

    // Find order by payment ID
    const paymentTransaction = await prisma.shopPaymentTransaction.findFirst({
      where: { gatewayPaymentId: paymentId },
    });

    if (!paymentTransaction) {
      throw new Error("Payment transaction not found for refund");
    }

    // Find associated order
    const order = await prisma.order.findUnique({
      where: { id: paymentTransaction.orderId },
    });

    if (!order) {
      throw new Error("Order not found for refund");
    }

    // Update order status to refunded
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: ShopPaymentStatus.REFUNDED },
    });

    // Emit notification (implement in NotificationService)
  }
}
