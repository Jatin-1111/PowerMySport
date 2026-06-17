import crypto from "crypto";
import { PaymentGateway, PaymentStatus, ApiResponse } from "../../types/ecommerce";
import {
  PaymentTransaction as PaymentTransactionModel,
  PaymentTransactionDocument,
  Order as OrderModel,
} from "../../shop/models/Ecommerce";
import mongoose from "mongoose";
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
            url: result.redirectUrl
          }
        }
      }
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
   * Verify payment from gateway by fetching actual order status via SDK
   */
  async verifyPayment(
    paymentId: string, // This is actually gatewayOrderId
    orderId: string,
    signature: string,
  ): Promise<boolean> {
    const status = await this.getPaymentStatus(paymentId);
    return status === PaymentStatus.CAPTURED;
  }

  /**
   * Initiate refund using PhonePeService SDK
   */
  async initiateRefund(
    paymentId: string,
    amount: number,
    reason: string,
  ): Promise<string> {
    const result = await initiatePhonePeRefund({
      merchantRefundId: `R_${paymentId}_${Date.now()}`,
      originalMerchantOrderId: paymentId,
      amount: amount / 100, // initiatePhonePeRefund expects rupees, but Ecommerce amount is in paise
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

// ============ STRIPE PAYMENT GATEWAY (Stub) ============

export class StripeGatewayService implements IPaymentGatewayService {
  private secretKey: string;

  constructor() {
    this.secretKey = process.env.STRIPE_SECRET_KEY || "";
  }

  private validateCredentials() {
    if (!this.secretKey) {
      throw new Error(
        "Stripe credentials not configured (STRIPE_SECRET_KEY required)",
      );
    }
  }

  async createOrder(
    orderId: string,
    amount: number,
    currency: string = "inr",
    description: string = "",
    customer: { name: string; email: string; phone: string },
  ): Promise<any> {
    this.validateCredentials();
    // Stub - implement Stripe Intent creation
    const mockIntentId = `pi_${Date.now()}`;

    return {
      id: mockIntentId,
      object: "payment_intent",
      amount: amount,
      currency: currency,
      customer: customer,
      description: description,
      status: "requires_payment_method",
      created: Math.floor(Date.now() / 1000),
    };
  }

  async verifyPayment(
    paymentId: string,
    orderId: string,
    signature: string,
  ): Promise<boolean> {
    this.validateCredentials();
    // Stub - implement Stripe signature verification
    return true;
  }

  async initiateRefund(
    paymentId: string,
    amount: number,
    reason: string,
  ): Promise<string> {
    this.validateCredentials();
    // Stub - implement Stripe refund
    const mockRefundId = `re_${Date.now()}`;
    return mockRefundId;
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatus> {
    this.validateCredentials();
    // Stub
    return PaymentStatus.CAPTURED;
  }
}

// ============ PAYMENT SERVICE ============

export class PaymentService {
  private gatewayService: IPaymentGatewayService;

  constructor(gateway: PaymentGateway = PaymentGateway.PHONEPE) {
    if (gateway === PaymentGateway.PHONEPE) {
      this.gatewayService = new PhonePeGatewayService();
    } else if (gateway === PaymentGateway.STRIPE) {
      this.gatewayService = new StripeGatewayService();
    } else {
      throw new Error(`Unsupported payment gateway: ${gateway}`);
    }
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
  ): Promise<PaymentTransactionDocument> {
    // Check for duplicate using idempotency key
    const existingTransaction = await PaymentTransactionModel.findOne({
      idempotencyKey,
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
    const transaction = new PaymentTransactionModel({
      orderId: new mongoose.Types.ObjectId(orderId),
      paymentGateway,
      gatewayOrderId: gatewayOrder.id || gatewayOrder.data?.merchantTransactionId,
      amount,
      currency,
      status: PaymentStatus.PENDING,
      idempotencyKey,
      gatewayResponse: gatewayOrder,
      attemptNumber: 1,
    });

    await transaction.save();

    return transaction;
  }

  /**
   * Verify and confirm payment
   */
  async verifyAndConfirmPayment(
    orderId: string,
    paymentId: string,
    phonepeOrderId: string,
    signature: string,
  ): Promise<PaymentTransactionDocument> {
    // Verify with payment gateway
    const isValid = await this.gatewayService.verifyPayment(
      paymentId,
      phonepeOrderId,
      signature,
    );

    if (!isValid) {
      throw new Error("Payment verification failed");
    }

    // Update transaction
    const transaction = await PaymentTransactionModel.findOneAndUpdate(
      {
        orderId: new mongoose.Types.ObjectId(orderId),
        gatewayOrderId: phonepeOrderId,
      },
      {
        gatewayPaymentId: paymentId,
        status: PaymentStatus.CAPTURED,
      },
      { new: true },
    );

    if (!transaction) {
      throw new Error("Payment transaction not found");
    }

    return transaction;
  }

  /**
   * Handle payment failure
   */
  async recordPaymentFailure(
    orderId: string,
    gatewayOrderId: string,
    failureReason: string,
  ): Promise<PaymentTransactionDocument> {
    const transaction = await PaymentTransactionModel.findOneAndUpdate(
      {
        orderId: new mongoose.Types.ObjectId(orderId),
        gatewayOrderId,
      },
      {
        status: PaymentStatus.FAILED,
        gatewayResponse: { failure_reason: failureReason },
      },
      { new: true },
    );

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
  ): Promise<PaymentTransactionDocument> {
    // Check for duplicate event
    const existingTransaction = await PaymentTransactionModel.findOne({
      idempotencyKey: `webhook-${eventId}`,
    });

    if (existingTransaction) {
      return existingTransaction; // Duplicate event - return existing
    }

    let transaction: PaymentTransactionDocument | null = null;

    if (
      eventType === "payment.authorized" ||
      eventType === "payment.captured"
    ) {
      const payment = payload.payload.payment;

      transaction = await PaymentTransactionModel.findOneAndUpdate(
        {
          gatewayOrderId: payment.order_id,
          gatewayPaymentId: payment.id,
        },
        {
          status: PaymentStatus.CAPTURED,
          webhookData: payload,
          idempotencyKey: `webhook-${eventId}`, // Update idempotency key
        },
        { new: true },
      );

      if (!transaction) {
        throw new Error("Payment transaction not found");
      }
    } else if (eventType === "payment.failed") {
      const payment = payload.payload.payment;

      transaction = await PaymentTransactionModel.findOneAndUpdate(
        {
          gatewayOrderId: payment.order_id,
        },
        {
          status: PaymentStatus.FAILED,
          webhookData: payload,
          idempotencyKey: `webhook-${eventId}`,
        },
        { new: true },
      );

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
   * Initiate refund for an order
   */
  async initiateRefund(
    orderId: string,
    paymentId: string,
    refundAmount: number,
    reason: string,
  ): Promise<string> {
    // Validate order exists
    const order = await OrderModel.findById(orderId);

    if (!order) {
      throw new Error("Order not found");
    }

    if (!paymentId) {
      throw new Error("Payment ID required for refund");
    }

    if (refundAmount <= 0) {
      throw new Error("Refund amount must be positive");
    }

    if (refundAmount > order.totalAmount) {
      throw new Error("Refund amount exceeds order total");
    }

    // Call payment gateway to initiate refund
    const refundId = await new PhonePeGatewayService().initiateRefund(
      paymentId,
      refundAmount,
      reason,
    );

    // Update order status
    order.paymentStatus = PaymentStatus.REFUND_INITIATED;
    await order.save();

    return refundId;
  }

  /**
   * Confirm refund completion
   */
  async confirmRefundCompletion(
    orderId: string,
    refundId: string,
  ): Promise<void> {
    const order = await OrderModel.findById(orderId);

    if (!order) {
      throw new Error("Order not found");
    }

    order.paymentStatus = PaymentStatus.REFUNDED;
    await order.save();
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
    const paymentTransaction = await PaymentTransactionModel.findOne({
      gatewayPaymentId: paymentId,
    });

    if (!paymentTransaction) {
      throw new Error("Payment transaction not found for refund");
    }

    // Find associated order
    const order = await OrderModel.findById(
      paymentTransaction.orderId.toString(),
    );

    if (!order) {
      throw new Error("Order not found for refund");
    }

    // Update order status to refunded
    order.paymentStatus = PaymentStatus.REFUNDED;
    await order.save();

    // Emit notification (implement in NotificationService)
  }
}
