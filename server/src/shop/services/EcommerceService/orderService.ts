import mongoose from "mongoose";
import { User as UserModel } from "../../../client/models/User";
import OutboxMessage from "../../../shared/models/OutboxMessage";
import { getPhonePeOrderStatus } from "../../../shared/services/PhonePeService";
import { buildSafeSearchRegexSource } from "../../../utils/regex";
import {
  FulfillmentStatus,
  OrderStatus,
  PaymentGateway,
  PaymentStatus,
} from "../../../types/ecommerce";
import {
  OrderDocument,
  Order as OrderModel,
  PaymentTransaction as PaymentTransactionModel,
  Product as ProductModel,
} from "../../models/Ecommerce";
import { CartService } from "./cartService";
import { InventoryService } from "./inventoryService";
import { log as __rootLog } from "../../../utils/logger";
const log = __rootLog.child("ecommerce");

export class OrderService {
  private cartService: CartService;
  private inventoryService: InventoryService;

  constructor() {
    this.cartService = new CartService();
    this.inventoryService = new InventoryService();
  }

  /**
   * Generate unique order number
   */
  private generateOrderNumber(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, "");
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(5, "0");
    return `ORD-${dateStr}-${random}`;
  }

  /**
   * Create order from cart
   */
  async createOrderFromCart(
    userId: string,
    shippingAddress: any,
    paymentMethod: string,
    paymentGateway: PaymentGateway
  ): Promise<OrderDocument> {
    // Get cart
    const cart = await this.cartService.getOrCreateCart(userId);

    if (cart.items.length === 0) {
      throw new Error("Cart is empty");
    }

    // Create order items from cart
    const orderItems = [];
    for (const cartItem of cart.items) {
      const variant = await ProductModel.findOne({
        "variants._id": cartItem.productVariantId,
      });

      if (!variant) {
        throw new Error("Product variant not found");
      }

      const variantDoc = variant.variants.find(
        (v) => v._id.toString() === cartItem.productVariantId.toString()
      );

      orderItems.push({
        productVariantId: cartItem.productVariantId,
        productName: variant.name,
        variantLabel: variantDoc?.variantLabel || "",
        quantity: cartItem.quantity,
        unitPrice: variantDoc?.price || 0,
        lineTotal: cartItem.lineTotal,
        sellerId: variant.seller || null,
        condition: variant.condition || "NEW",
        fulfillmentStatus: FulfillmentStatus.PENDING,
      });
    }

    // Create order
    const order = new OrderModel({
      orderNumber: this.generateOrderNumber(),
      userId: new mongoose.Types.ObjectId(userId),
      items: orderItems,
      subtotal: cart.subtotal,
      taxAmount: cart.taxAmount,
      shippingAmount: 0, // Reserved for future
      discountAmount: cart.discountAmount,
      totalAmount: cart.totalAmount,
      status: OrderStatus.PENDING_PAYMENT,
      paymentMethod,
      paymentGateway,
      paymentStatus: PaymentStatus.PENDING,
      shippingAddress,
      fulfillmentStatus: FulfillmentStatus.PENDING,
      appliedPromoCode: cart.appliedPromoCode,
      promoDiscountAmount: cart.discountAmount,
    });

    await order.save();

    // Inventory already reserved in cart, just need to track order-payment link
    return order;
  }

  /**
   * Confirm payment and update order status
   */
  async confirmPayment(
    orderId: string,
    paymentGatewayPaymentId: string,
    paymentGatewayOrderId: string
  ): Promise<OrderDocument> {
    const order = await OrderModel.findById(orderId);

    if (!order) {
      throw new Error("Order not found");
    }

    // Idempotency guard: confirmPayment can be invoked by both the PhonePe
    // webhook reconciler and the client-side payment sync. If the order is
    // already confirmed (or no longer awaiting payment), return it as-is
    // instead of throwing — re-running the side effects would double-deduct
    // inventory and re-send emails.
    if (
      order.paymentStatus === PaymentStatus.CAPTURED ||
      order.status !== OrderStatus.PENDING_PAYMENT
    ) {
      return order;
    }

    // SECURITY: independently verify with PhonePe (using the merchantOrderId WE
    // stored, not any client/webhook-supplied value) that this order was
    // actually captured for the EXACT order amount before confirming. This is
    // the single chokepoint every confirmation path flows through (client
    // verify, sync, webhook, recovery), so it guards them all against
    // confirming an unpaid or underpaid order.
    const paymentTx = await PaymentTransactionModel.findOne({
      orderId: order._id,
    }).sort({ createdAt: -1 });

    if (!paymentTx?.gatewayOrderId) {
      throw new Error("Payment transaction not found for order");
    }

    const gatewayStatus = await getPhonePeOrderStatus(paymentTx.gatewayOrderId);
    if (gatewayStatus.state !== "COMPLETED") {
      throw new Error("Payment not completed at gateway");
    }
    if (typeof gatewayStatus.amount !== "number" || gatewayStatus.amount !== order.totalAmount) {
      throw new Error("Payment amount mismatch");
    }

    // 1) Persist the payment confirmation FIRST so the status is durable even
    // if a downstream side effect (inventory/cart/email) fails.
    order.status = OrderStatus.PAYMENT_CONFIRMED;
    order.paymentStatus = PaymentStatus.CAPTURED;
    if (paymentGatewayPaymentId) {
      order.paymentGatewayPaymentId = paymentGatewayPaymentId;
    }
    order.fulfillmentStatus = FulfillmentStatus.PENDING;
    await order.save();

    // 2) Confirm inventory deduction for each item (best effort — a reservation
    // mismatch must never roll back a confirmed payment).
    for (const item of order.items) {
      try {
        await this.inventoryService.confirmInventoryDeduction(
          item.productVariantId.toString(),
          item.quantity
        );
      } catch (err) {
        log.error("[order] inventory deduction failed (non-fatal)", {
          orderId,
          productVariantId: item.productVariantId.toString(),
          error: (err as Error)?.message || String(err),
        });
      }
    }

    // 3) Clear user's cart after successful order (best effort).
    try {
      await this.cartService.clearCart(order.userId.toString());
    } catch (err) {
      log.error("[order] cart clear failed (non-fatal)", {
        orderId,
        error: (err as Error)?.message || String(err),
      });
    }

    // 4) Queue order confirmation email via the outbox worker (best effort).
    try {
      await this.queueOrderConfirmationEmail(order);
    } catch (err) {
      log.error("[order] failed to queue confirmation email (non-fatal)", {
        orderId,
        error: (err as Error)?.message || String(err),
      });
    }

    return order;
  }

  /**
   * Build and enqueue the order confirmation email for the outbox worker.
   * Kept separate so checkout flows never fail on email-side errors.
   */
  private async queueOrderConfirmationEmail(order: OrderDocument): Promise<void> {
    const user = await UserModel.findById(order.userId);
    if (user && user.email) {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 5px;">
            <h2 style="color: #ff5722;">Order Confirmation</h2>
            <p>Hi ${user.name || "Customer"},</p>
            <p>Thank you for your order! We're thrilled to have you with us.</p>
            
            <h3>Order Details</h3>
            <p><strong>Order Number:</strong> ${order.orderNumber}</p>
            <p><strong>Order Date:</strong> ${new Date().toLocaleDateString()}</p>
            <p><strong>Total Amount:</strong> ₹${(order.totalAmount / 100).toFixed(2)}</p>
            
            <h3>Items Ordered</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <thead><tr style="background-color: #f5f5f5;"><th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Product</th><th style="padding: 8px; text-align: right; border: 1px solid #ddd;">Qty</th><th style="padding: 8px; text-align: right; border: 1px solid #ddd;">Price</th></tr></thead>
              <tbody>
                ${order.items
                  .map(
                    (item) => `
                  <tr>
                    <td style="padding: 8px; border: 1px solid #ddd;">${item.productName}${item.variantLabel ? ` (${item.variantLabel})` : ""}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${item.quantity}</td>
                    <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">₹${(item.lineTotal / 100).toFixed(2)}</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
            </table>
            
            <h3>Shipping Address</h3>
            <p>
              ${order.shippingAddress.fullName}<br/>
              ${order.shippingAddress.addressLine1}<br/>
              ${order.shippingAddress.addressLine2 ? order.shippingAddress.addressLine2 + "<br/>" : ""}
              ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}<br/>
              ${order.shippingAddress.country || "IN"}
            </p>
            
            <h3>What's Next?</h3>
            <p>Your order is being processed and will be shipped shortly. You'll receive tracking updates via email.</p>
            
            <p style="color: #666; font-size: 12px; margin-top: 20px;">
              If you have any questions, please contact our support team at support@powermysport.com
            </p>
          </div>
        </body>
        </html>
      `;

      await OutboxMessage.create({
        type: "send_email",
        payload: {
          to: user.email,
          subject: `Order Confirmation - ${order.orderNumber}`,
          html: emailHtml,
        },
        status: "PENDING",
        attempts: 0,
      });
      log.info("[order] queued confirmation email for", {
        orderId: order._id.toString(),
        email: user.email,
      });
    }
  }

  /**
   * Handle payment failure
   */
  async handlePaymentFailure(orderId: string, failureReason?: string): Promise<OrderDocument> {
    const order = await OrderModel.findById(orderId);

    if (!order) {
      throw new Error("Order not found");
    }

    // Update payment status
    order.paymentStatus = PaymentStatus.FAILED;

    // Release reserved inventory
    for (const item of order.items) {
      await this.inventoryService.releaseReservedInventory(
        item.productVariantId.toString(),
        item.quantity
      );
    }

    await order.save();
    return order;
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string, reason: string): Promise<OrderDocument> {
    const order = await OrderModel.findById(orderId);

    if (!order) {
      throw new Error("Order not found");
    }

    // Can only cancel PENDING_PAYMENT orders
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new Error(
        `Cannot cancel order in ${order.status} state. Only PENDING_PAYMENT orders can be cancelled.`
      );
    }

    // Release reserved inventory
    for (const item of order.items) {
      await this.inventoryService.releaseReservedInventory(
        item.productVariantId.toString(),
        item.quantity
      );
    }

    // Update order
    order.status = OrderStatus.CANCELLED;
    order.cancelledAt = new Date();
    order.cancelReason = reason;

    await order.save();
    return order;
  }

  /**
   * Update fulfillment status
   */
  async updateFulfillmentStatus(
    orderId: string,
    fulfillmentStatus: FulfillmentStatus,
    trackingNumber?: string
  ): Promise<OrderDocument> {
    const order = await OrderModel.findById(orderId);

    if (!order) {
      throw new Error("Order not found");
    }

    // Validate state transition
    const validTransitions: Record<FulfillmentStatus, FulfillmentStatus[]> = {
      [FulfillmentStatus.PENDING]: [FulfillmentStatus.PROCESSING, FulfillmentStatus.CANCELLED],
      [FulfillmentStatus.PROCESSING]: [FulfillmentStatus.SHIPPED, FulfillmentStatus.CANCELLED],
      [FulfillmentStatus.SHIPPED]: [FulfillmentStatus.DELIVERED],
      [FulfillmentStatus.DELIVERED]: [],
      [FulfillmentStatus.CANCELLED]: [],
    };

    if (!validTransitions[order.fulfillmentStatus].includes(fulfillmentStatus)) {
      throw new Error(`Cannot transition from ${order.fulfillmentStatus} to ${fulfillmentStatus}`);
    }

    order.fulfillmentStatus = fulfillmentStatus;
    if (trackingNumber) {
      order.trackingNumber = trackingNumber;
    }

    await order.save();
    await order.populate("userId", "name email");
    return order;
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string): Promise<OrderDocument | null> {
    return OrderModel.findById(orderId);
  }

  /**
   * Get order by ID with customer populated, for the admin detail drill-down.
   * Separate from getOrderById() because callers of that method compare
   * order.userId as a raw ObjectId string — populating there would break them.
   */
  async getOrderByIdForAdmin(orderId: string): Promise<OrderDocument | null> {
    return OrderModel.findById(orderId).populate("userId", "name email");
  }

  /**
   * List user's orders
   */
  async listUserOrders(userId: string, page: number = 1, limit: number = 10, status?: OrderStatus) {
    const query: any = {
      userId: new mongoose.Types.ObjectId(userId),
    };

    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const orders = await OrderModel.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit);

    const total = await OrderModel.countDocuments(query);

    return {
      orders,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * List all orders for admin dashboard with optional filters
   */
  async listAllOrders(
    page: number = 1,
    limit: number = 20,
    options?: {
      status?: OrderStatus;
      dateFrom?: string;
      dateTo?: string;
      search?: string;
      sortBy?: "createdAt" | "totalAmount" | "orderNumber";
      sortOrder?: "asc" | "desc";
    }
  ) {
    const query: any = {};

    if (options?.status) {
      query.status = options.status;
    }

    if (options?.dateFrom || options?.dateTo) {
      query.createdAt = {};
      if (options.dateFrom) {
        query.createdAt.$gte = new Date(options.dateFrom);
      }
      if (options.dateTo) {
        query.createdAt.$lte = new Date(options.dateTo);
      }
    }

    if (options?.search) {
      query.orderNumber = {
        $regex: buildSafeSearchRegexSource(options.search),
        $options: "i",
      };
    }

    const skip = (page - 1) * limit;
    const sortField = options?.sortBy || "createdAt";
    const sortDir = options?.sortOrder === "asc" ? 1 : -1;

    const orders = await OrderModel.find(query)
      .populate("userId", "name email")
      .sort({ [sortField]: sortDir })
      .skip(skip)
      .limit(limit);

    const total = await OrderModel.countDocuments(query);

    return {
      orders,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }
}
