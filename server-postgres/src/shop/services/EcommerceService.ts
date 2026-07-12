import prisma from "../../lib/prisma";
import {
  Prisma,
  OrderStatus,
  FulfillmentStatus,
  ProductCategory,
  ProductCondition,
  ProductSellerType,
  PaymentGateway,
  ShopPaymentStatus as PaymentStatus,
} from "@prisma/client";
import { getPhonePeOrderStatus } from "../../shared/services/PhonePeService";
import { buildSafeSearchRegexSource } from "../../utils/regex";

// Prisma payload types replacing the old Mongoose *Document return shapes.
type CartWithItems = Prisma.CartGetPayload<{ include: { items: true } }>;
type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;
type ProductWithVariants = Prisma.ProductGetPayload<{
  include: { variants: true };
}>;
type OrderCustomer = { id: string; name: string; email: string } | null;
type OrderWithItemsAndUser = OrderWithItems & { user: OrderCustomer };

// ============ INVENTORY SERVICE ============

export class InventoryService {
  /**
   * Reserve inventory for a cart item
   * Called when item is added to cart
   */
  async reserveInventory(
    productVariantId: string,
    quantity: number,
  ): Promise<boolean> {
    const inventory = await prisma.inventory.findUnique({
      where: { productVariantId },
    });

    if (!inventory) {
      throw new Error("Inventory record not found");
    }

    if (inventory.quantityAvailable < quantity) {
      throw new Error("Insufficient inventory available");
    }

    // quantityAvailable is DERIVED (= onHand - reserved); compute it here since
    // the old Mongoose pre-save hook no longer runs.
    const quantityReserved = inventory.quantityReserved + quantity;
    await prisma.inventory.update({
      where: { productVariantId },
      data: {
        quantityReserved,
        quantityAvailable: inventory.quantityOnHand - quantityReserved,
      },
    });
    return true;
  }

  /**
   * Release reserved inventory
   * Called when cart item is removed or checkout cancelled
   */
  async releaseReservedInventory(
    productVariantId: string,
    quantity: number,
  ): Promise<boolean> {
    const inventory = await prisma.inventory.findUnique({
      where: { productVariantId },
    });

    if (!inventory) {
      throw new Error("Inventory record not found");
    }

    const quantityReserved = Math.max(0, inventory.quantityReserved - quantity);
    await prisma.inventory.update({
      where: { productVariantId },
      data: {
        quantityReserved,
        quantityAvailable: inventory.quantityOnHand - quantityReserved,
      },
    });
    return true;
  }

  /**
   * Confirm inventory deduction (move from reserved to sold)
   * Called after successful payment
   */
  async confirmInventoryDeduction(
    productVariantId: string,
    quantity: number,
  ): Promise<boolean> {
    const inventory = await prisma.inventory.findUnique({
      where: { productVariantId },
    });

    if (!inventory) {
      throw new Error("Inventory record not found");
    }

    if (inventory.quantityReserved < quantity) {
      throw new Error("Insufficient reserved inventory");
    }

    const quantityReserved = inventory.quantityReserved - quantity;
    const quantityOnHand = inventory.quantityOnHand - quantity;

    await prisma.$transaction(async (tx) => {
      await tx.inventory.update({
        where: { productVariantId },
        data: {
          quantityReserved,
          quantityOnHand,
          // quantityAvailable DERIVED = onHand - reserved
          quantityAvailable: quantityOnHand - quantityReserved,
        },
      });

      // Sync back to ProductVariant.stock and recompute Product.totalStock
      // (totalStock was a Mongoose pre-save hook = sum of variant stocks).
      const variant = await tx.productVariant.findUnique({
        where: { id: productVariantId },
      });

      if (variant) {
        await tx.productVariant.update({
          where: { id: productVariantId },
          data: { stock: quantityOnHand },
        });

        const siblings = await tx.productVariant.findMany({
          where: { productId: variant.productId },
        });
        const totalStock = siblings.reduce(
          (sum, v) => sum + (v.id === productVariantId ? quantityOnHand : v.stock),
          0,
        );
        await tx.product.update({
          where: { id: variant.productId },
          data: { totalStock },
        });
      }
    });

    return true;
  }

  /**
   * Get available quantity for a variant
   */
  async getAvailableQuantity(productVariantId: string): Promise<number> {
    const inventory = await prisma.inventory.findUnique({
      where: { productVariantId },
    });

    return inventory?.quantityAvailable || 0;
  }

  /**
   * Check if low stock and needs reorder
   */
  async isLowStock(productVariantId: string): Promise<boolean> {
    const inventory = await prisma.inventory.findUnique({
      where: { productVariantId },
    });

    if (!inventory) return false;
    return inventory.quantityOnHand < inventory.reorderLevel;
  }
}

// ============ CART SERVICE ============

export class CartService {
  private inventoryService: InventoryService;

  constructor() {
    this.inventoryService = new InventoryService();
  }

  /**
   * Get or create cart for user
   */
  async getOrCreateCart(userId: string): Promise<CartWithItems> {
    let cart = await prisma.cart.findFirst({
      where: { userId },
      include: { items: true },
    });

    if (!cart) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24-hour TTL
      cart = await prisma.cart.create({
        data: {
          userId,
          subtotal: 0,
          taxAmount: 0,
          discountAmount: 0,
          totalAmount: 0,
          expiresAt,
        },
        include: { items: true },
      });
    }

    // Refresh expiration (swept by cron; see shopScheduledJobs / ttlSweeper).
    const refreshedExpiresAt = new Date();
    refreshedExpiresAt.setHours(refreshedExpiresAt.getHours() + 24);
    cart = await prisma.cart.update({
      where: { id: cart.id },
      data: { expiresAt: refreshedExpiresAt },
      include: { items: true },
    });

    return cart;
  }

  /**
   * Add item to cart
   */
  async addItemToCart(
    userId: string,
    productVariantId: string,
    quantity: number,
  ): Promise<CartWithItems> {
    // Validate variant exists and has stock
    const variant = await this.getProductVariant(productVariantId);
    if (!variant) {
      throw new Error("Product variant not found");
    }

    // Check inventory availability
    const availableQty =
      await this.inventoryService.getAvailableQuantity(productVariantId);
    if (availableQty < quantity) {
      throw new Error(`Only ${availableQty} units available for this product`);
    }

    // Get or create cart
    const cart = await this.getOrCreateCart(userId);

    // Check if item already in cart
    const existingItem = cart.items.find(
      (item) => item.productVariantId === productVariantId,
    );

    if (existingItem) {
      // Update quantity and line total
      const newQuantity = existingItem.quantity + quantity;

      // Verify we have enough for new total
      if (availableQty < newQuantity) {
        throw new Error(
          `Only ${availableQty} units available for this product`,
        );
      }

      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: newQuantity,
          lineTotal: newQuantity * variant.price,
        },
      });
    } else {
      // Add new item
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productVariantId,
          quantity,
          lineTotal: quantity * variant.price,
          reservedAt: new Date(),
        },
      });
    }

    // Reserve inventory
    await this.inventoryService.reserveInventory(productVariantId, quantity);

    // Recalculate totals (persists and returns the fresh cart)
    return this.recalculateCartTotals(cart.id);
  }

  /**
   * Remove item from cart
   */
  async removeItemFromCart(
    userId: string,
    cartItemId: string,
  ): Promise<CartWithItems> {
    const cart = await prisma.cart.findFirst({
      where: { userId },
      include: { items: true },
    });

    if (!cart) {
      throw new Error("Cart not found");
    }

    const item = cart.items.find((i) => i.id === cartItemId);

    if (!item) {
      throw new Error("Item not found in cart");
    }

    // Release reserved inventory
    await this.inventoryService.releaseReservedInventory(
      item.productVariantId,
      item.quantity,
    );

    // Remove item
    await prisma.cartItem.delete({ where: { id: item.id } });

    // Recalculate totals
    return this.recalculateCartTotals(cart.id);
  }

  /**
   * Update cart item quantity
   */
  async updateItemQuantity(
    userId: string,
    cartItemId: string,
    newQuantity: number,
  ): Promise<CartWithItems> {
    if (newQuantity < 1) {
      throw new Error("Quantity must be at least 1");
    }

    const cart = await prisma.cart.findFirst({
      where: { userId },
      include: { items: true },
    });

    if (!cart) {
      throw new Error("Cart not found");
    }

    const item = cart.items.find((i) => i.id === cartItemId);
    if (!item) {
      throw new Error("Item not found in cart");
    }

    const variant = await this.getProductVariant(item.productVariantId);
    if (!variant) {
      throw new Error("Product variant not found");
    }

    // Handle quantity change (increase or decrease)
    const quantityDifference = newQuantity - item.quantity;

    if (quantityDifference > 0) {
      // Increasing quantity - need to reserve more
      const availableQty = await this.inventoryService.getAvailableQuantity(
        item.productVariantId,
      );
      if (availableQty < quantityDifference) {
        throw new Error(`Only ${availableQty} additional units available`);
      }
      await this.inventoryService.reserveInventory(
        item.productVariantId,
        quantityDifference,
      );
    } else {
      // Decreasing quantity - release reserved
      await this.inventoryService.releaseReservedInventory(
        item.productVariantId,
        Math.abs(quantityDifference),
      );
    }

    await prisma.cartItem.update({
      where: { id: item.id },
      data: {
        quantity: newQuantity,
        lineTotal: newQuantity * variant.price,
      },
    });

    return this.recalculateCartTotals(cart.id);
  }

  /**
   * Clear entire cart
   */
  async clearCart(userId: string): Promise<void> {
    const cart = await prisma.cart.findFirst({
      where: { userId },
      include: { items: true },
    });

    if (!cart) {
      return;
    }

    // Release all reserved inventory
    for (const item of cart.items) {
      await this.inventoryService.releaseReservedInventory(
        item.productVariantId,
        item.quantity,
      );
    }

    // Clear items and reset totals
    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    await prisma.cart.update({
      where: { id: cart.id },
      data: {
        subtotal: 0,
        taxAmount: 0,
        discountAmount: 0,
        totalAmount: 0,
        appliedPromoCode: "",
      },
    });
  }

  /**
   * Apply promo code to cart
   * This is simplified - actual implementation should validate promo eligibility
   */
  async applyPromoCode(
    userId: string,
    promoCode: string,
    discountAmount: number,
  ): Promise<CartWithItems> {
    const cart = await prisma.cart.findFirst({ where: { userId } });

    if (!cart) {
      throw new Error("Cart not found");
    }

    if (discountAmount < 0 || discountAmount > cart.subtotal) {
      throw new Error("Invalid discount amount");
    }

    return prisma.cart.update({
      where: { id: cart.id },
      data: {
        appliedPromoCode: promoCode,
        discountAmount,
        totalAmount: cart.subtotal + cart.taxAmount - discountAmount,
      },
      include: { items: true },
    });
  }

  /**
   * Remove promo code from cart
   */
  async removePromoCode(userId: string): Promise<CartWithItems> {
    const cart = await prisma.cart.findFirst({ where: { userId } });

    if (!cart) {
      throw new Error("Cart not found");
    }

    return prisma.cart.update({
      where: { id: cart.id },
      data: {
        appliedPromoCode: "",
        discountAmount: 0,
        totalAmount: cart.subtotal + cart.taxAmount,
      },
      include: { items: true },
    });
  }

  /**
   * Recalculate cart totals (subtotal, tax, total)
   * Tax calculation: subtotal * product.taxRate
   * Reads the cart's current items from the DB, computes totals, and persists.
   */
  private async recalculateCartTotals(
    cartId: string,
  ): Promise<CartWithItems> {
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: { items: true },
    });
    if (!cart) {
      throw new Error("Cart not found");
    }

    let subtotal = 0;
    let taxAmount = 0;

    for (const item of cart.items) {
      subtotal += item.lineTotal;

      // Get product to calculate tax rate snapshot for current cart line.
      const variant = await prisma.productVariant.findUnique({
        where: { id: item.productVariantId },
        include: { product: true },
      });
      if (variant?.product && variant.product.taxable) {
        taxAmount += item.lineTotal * variant.product.taxRate;
      }
    }

    return prisma.cart.update({
      where: { id: cartId },
      data: {
        subtotal,
        taxAmount: Math.round(taxAmount), // Round to nearest paise
        totalAmount:
          subtotal + Math.round(taxAmount) - (cart.discountAmount || 0),
      },
      include: { items: true },
    });
  }

  /**
   * Helper: Get product variant details
   */
  private async getProductVariant(productVariantId: string) {
    return prisma.productVariant.findUnique({
      where: { id: productVariantId },
    });
  }
}

// ============ ORDER SERVICE ============

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
   * Attach the customer (name/email) to a set of orders — replaces the old
   * Mongoose .populate("userId","name email") for the String-FK reference.
   */
  private async attachUsers(
    orders: OrderWithItems[],
  ): Promise<OrderWithItemsAndUser[]> {
    const ids = [...new Set(orders.map((o) => o.userId))];
    const users = await prisma.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, email: true },
    });
    const byId = new Map(users.map((u) => [u.id, u]));
    return orders.map((o) => ({ ...o, user: byId.get(o.userId) ?? null }));
  }

  private async attachUser(
    order: OrderWithItems,
  ): Promise<OrderWithItemsAndUser> {
    const user = await prisma.user.findUnique({
      where: { id: order.userId },
      select: { id: true, name: true, email: true },
    });
    return { ...order, user: user ?? null };
  }

  /**
   * Create order from cart
   */
  async createOrderFromCart(
    userId: string,
    shippingAddress: any,
    paymentMethod: string,
    paymentGateway: PaymentGateway,
  ): Promise<OrderWithItems> {
    // Get cart
    const cart = await this.cartService.getOrCreateCart(userId);

    if (cart.items.length === 0) {
      throw new Error("Cart is empty");
    }

    // Create order items from cart
    const orderItems: Prisma.OrderItemCreateWithoutOrderInput[] = [];
    for (const cartItem of cart.items) {
      const variant = await prisma.productVariant.findUnique({
        where: { id: cartItem.productVariantId },
        include: { product: true },
      });

      if (!variant || !variant.product) {
        throw new Error("Product variant not found");
      }

      orderItems.push({
        productVariantId: cartItem.productVariantId,
        productName: variant.product.name,
        variantLabel: variant.variantLabel || "",
        quantity: cartItem.quantity,
        unitPrice: variant.price || 0,
        lineTotal: cartItem.lineTotal,
        sellerId: variant.product.seller || null,
        condition: variant.product.condition || ProductCondition.NEW,
        fulfillmentStatus: FulfillmentStatus.PENDING,
      });
    }

    // Create order + items atomically (nested create). Inventory is already
    // reserved in the cart, so no stock decrement happens here — only the
    // order-payment link is tracked (deduction happens on confirmPayment).
    const order = await prisma.order.create({
      data: {
        orderNumber: this.generateOrderNumber(),
        userId,
        subtotal: cart.subtotal,
        taxAmount: cart.taxAmount,
        shippingAmount: 0, // Reserved for future
        discountAmount: cart.discountAmount,
        totalAmount: cart.totalAmount,
        status: OrderStatus.PENDING_PAYMENT,
        paymentMethod,
        paymentGateway,
        paymentStatus: PaymentStatus.PENDING,
        // shippingAddress (embedded) flattened to ship* columns
        shipFullName: shippingAddress?.fullName ?? null,
        shipEmail: shippingAddress?.email ?? null,
        shipPhone: shippingAddress?.phone ?? null,
        shipAddressLine1: shippingAddress?.addressLine1 ?? null,
        shipAddressLine2: shippingAddress?.addressLine2 ?? null,
        shipCity: shippingAddress?.city ?? null,
        shipState: shippingAddress?.state ?? null,
        shipPostalCode: shippingAddress?.postalCode ?? null,
        shipCountry: shippingAddress?.country ?? undefined,
        fulfillmentStatus: FulfillmentStatus.PENDING,
        appliedPromoCode: cart.appliedPromoCode,
        promoDiscountAmount: cart.discountAmount,
        items: { create: orderItems },
      },
      include: { items: true },
    });

    return order;
  }

  /**
   * Confirm payment and update order status
   */
  async confirmPayment(
    orderId: string,
    paymentGatewayPaymentId: string,
    paymentGatewayOrderId: string,
  ): Promise<OrderWithItems> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

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
    const paymentTx = await prisma.shopPaymentTransaction.findFirst({
      where: { orderId: order.id },
      orderBy: { createdAt: "desc" },
    });

    if (!paymentTx?.gatewayOrderId) {
      throw new Error("Payment transaction not found for order");
    }

    const gatewayStatus = await getPhonePeOrderStatus(paymentTx.gatewayOrderId);
    if (gatewayStatus.state !== "COMPLETED") {
      throw new Error("Payment not completed at gateway");
    }
    if (
      typeof gatewayStatus.amount !== "number" ||
      gatewayStatus.amount !== order.totalAmount
    ) {
      throw new Error("Payment amount mismatch");
    }

    // 1) Persist the payment confirmation FIRST so the status is durable even
    // if a downstream side effect (inventory/cart/email) fails. This is
    // deliberately NOT wrapped in a transaction with the side effects below —
    // a reservation mismatch or email failure must never roll back a confirmed
    // payment.
    const confirmedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.PAYMENT_CONFIRMED,
        paymentStatus: PaymentStatus.CAPTURED,
        ...(paymentGatewayPaymentId ? { paymentGatewayPaymentId } : {}),
        fulfillmentStatus: FulfillmentStatus.PENDING,
      },
      include: { items: true },
    });

    // 2) Confirm inventory deduction for each item (best effort — a reservation
    // mismatch must never roll back a confirmed payment).
    for (const item of confirmedOrder.items) {
      try {
        await this.inventoryService.confirmInventoryDeduction(
          item.productVariantId,
          item.quantity,
        );
      } catch (err) {
        console.error("[order] inventory deduction failed (non-fatal)", {
          orderId,
          productVariantId: item.productVariantId,
          error: (err as Error)?.message || String(err),
        });
      }
    }

    // 3) Clear user's cart after successful order (best effort).
    try {
      await this.cartService.clearCart(confirmedOrder.userId);
    } catch (err) {
      console.error("[order] cart clear failed (non-fatal)", {
        orderId,
        error: (err as Error)?.message || String(err),
      });
    }

    // 4) Queue order confirmation email via the outbox worker (best effort).
    try {
      await this.queueOrderConfirmationEmail(confirmedOrder);
    } catch (err) {
      console.error("[order] failed to queue confirmation email (non-fatal)", {
        orderId,
        error: (err as Error)?.message || String(err),
      });
    }

    return confirmedOrder;
  }

  /**
   * Build and enqueue the order confirmation email for the outbox worker.
   * Kept separate so checkout flows never fail on email-side errors.
   */
  private async queueOrderConfirmationEmail(
    order: OrderWithItems,
  ): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: order.userId } });
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
                `,
                  )
                  .join("")}
              </tbody>
            </table>

            <h3>Shipping Address</h3>
            <p>
              ${order.shipFullName}<br/>
              ${order.shipAddressLine1}<br/>
              ${order.shipAddressLine2 ? order.shipAddressLine2 + "<br/>" : ""}
              ${order.shipCity}, ${order.shipState} ${order.shipPostalCode}<br/>
              ${order.shipCountry || "IN"}
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

      await prisma.outboxMessage.create({
        data: {
          type: "send_email",
          payload: {
            to: user.email,
            subject: `Order Confirmation - ${order.orderNumber}`,
            html: emailHtml,
          },
          status: "PENDING",
          attempts: 0,
        },
      });
      console.info("[order] queued confirmation email for", {
        orderId: order.id,
        email: user.email,
      });
    }
  }

  /**
   * Handle payment failure
   */
  async handlePaymentFailure(
    orderId: string,
    failureReason?: string,
  ): Promise<OrderWithItems> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new Error("Order not found");
    }

    // Release reserved inventory
    for (const item of order.items) {
      await this.inventoryService.releaseReservedInventory(
        item.productVariantId,
        item.quantity,
      );
    }

    // Update payment status
    return prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: PaymentStatus.FAILED },
      include: { items: true },
    });
  }

  /**
   * Cancel order
   */
  async cancelOrder(orderId: string, reason: string): Promise<OrderWithItems> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new Error("Order not found");
    }

    // Can only cancel PENDING_PAYMENT orders
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new Error(
        `Cannot cancel order in ${order.status} state. Only PENDING_PAYMENT orders can be cancelled.`,
      );
    }

    // Release reserved inventory
    for (const item of order.items) {
      await this.inventoryService.releaseReservedInventory(
        item.productVariantId,
        item.quantity,
      );
    }

    // Update order
    return prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: reason,
      },
      include: { items: true },
    });
  }

  /**
   * Update fulfillment status
   */
  async updateFulfillmentStatus(
    orderId: string,
    fulfillmentStatus: FulfillmentStatus,
    trackingNumber?: string,
  ): Promise<OrderWithItemsAndUser> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) {
      throw new Error("Order not found");
    }

    // Validate state transition
    const validTransitions: Record<FulfillmentStatus, FulfillmentStatus[]> = {
      [FulfillmentStatus.PENDING]: [
        FulfillmentStatus.PROCESSING,
        FulfillmentStatus.CANCELLED,
      ],
      [FulfillmentStatus.PROCESSING]: [
        FulfillmentStatus.SHIPPED,
        FulfillmentStatus.CANCELLED,
      ],
      [FulfillmentStatus.SHIPPED]: [FulfillmentStatus.DELIVERED],
      [FulfillmentStatus.DELIVERED]: [],
      [FulfillmentStatus.CANCELLED]: [],
    };

    if (
      !validTransitions[order.fulfillmentStatus].includes(fulfillmentStatus)
    ) {
      throw new Error(
        `Cannot transition from ${order.fulfillmentStatus} to ${fulfillmentStatus}`,
      );
    }

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        fulfillmentStatus,
        ...(trackingNumber ? { trackingNumber } : {}),
      },
      include: { items: true },
    });

    // Was .populate("userId","name email") — join the customer in code.
    return this.attachUser(updated);
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string): Promise<OrderWithItems | null> {
    return prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
  }

  /**
   * Get order by ID with customer populated, for the admin detail drill-down.
   * Separate from getOrderById() because callers of that method compare
   * order.userId as a raw id string — populating there would break them.
   */
  async getOrderByIdForAdmin(
    orderId: string,
  ): Promise<OrderWithItemsAndUser | null> {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (!order) return null;
    return this.attachUser(order);
  }

  /**
   * List user's orders
   */
  async listUserOrders(
    userId: string,
    page: number = 1,
    limit: number = 10,
    status?: OrderStatus,
  ) {
    const where: Prisma.OrderWhereInput = { userId };

    if (status) {
      where.status = status;
    }

    const skip = (page - 1) * limit;

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: { items: true },
    });

    const total = await prisma.order.count({ where });

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
    },
  ) {
    const where: Prisma.OrderWhereInput = {};

    if (options?.status) {
      where.status = options.status;
    }

    if (options?.dateFrom || options?.dateTo) {
      const createdAt: Prisma.DateTimeFilter = {};
      if (options.dateFrom) {
        createdAt.gte = new Date(options.dateFrom);
      }
      if (options.dateTo) {
        createdAt.lte = new Date(options.dateTo);
      }
      where.createdAt = createdAt;
    }

    if (options?.search) {
      const term = buildSafeSearchRegexSource(options.search)
        .replace(/\\/g, "")
        .slice(0, 100);
      where.orderNumber = { contains: term, mode: "insensitive" };
    }

    const skip = (page - 1) * limit;
    const sortField = options?.sortBy || "createdAt";
    const sortDir: Prisma.SortOrder =
      options?.sortOrder === "asc" ? "asc" : "desc";

    const rawOrders = await prisma.order.findMany({
      where,
      orderBy: { [sortField]: sortDir },
      skip,
      take: limit,
      include: { items: true },
    });

    const orders = await this.attachUsers(rawOrders);

    const total = await prisma.order.count({ where });

    return {
      orders,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }
}

// ============ PRODUCT SERVICE ============

export class ProductService {
  /**
   * Get product by ID
   */
  async getProductById(
    productId: string,
  ): Promise<ProductWithVariants | null> {
    return prisma.product.findUnique({
      where: { id: productId },
      include: { variants: true },
    });
  }

  /**
   * Get product by SKU
   */
  async getProductBySku(
    sku: string,
  ): Promise<ProductWithVariants | null> {
    return prisma.product.findUnique({
      where: { sku: sku.toUpperCase() },
      include: { variants: true },
    });
  }

  /**
   * List products with filters and pagination
   */
  async listProducts(
    page: number = 1,
    limit: number = 20,
    category?: string,
    search?: string,
    sortBy: string = "newest",
    brand?: string,
    rating?: number,
    minPrice?: number,
    maxPrice?: number,
    condition?: string,
    sellerType?: string,
  ) {
    const where: Prisma.ProductWhereInput = {
      isActive: true,
    };

    if (category) {
      where.category = category as ProductCategory;
    }

    if (brand) {
      where.brand = { equals: brand, mode: "insensitive" };
    }

    if (rating !== undefined) {
      where.averageRating = { gte: rating };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      const priceFilter: Prisma.IntFilter = {};
      if (minPrice !== undefined) priceFilter.gte = minPrice;
      if (maxPrice !== undefined) priceFilter.lte = maxPrice;
      where.basePrice = priceFilter;
    }

    if (condition) {
      where.condition = condition as ProductCondition;
    }

    if (sellerType) {
      where.sellerType = sellerType as ProductSellerType;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
        { sku: { contains: search, mode: "insensitive" } },
      ];
    }

    const sortOptions: Record<
      string,
      Prisma.ProductOrderByWithRelationInput
    > = {
      price_asc: { basePrice: "asc" },
      price_desc: { basePrice: "desc" },
      newest: { createdAt: "desc" },
      popularity: { totalStock: "desc" }, // Simple popularity metric
    };

    const orderBy = sortOptions[sortBy] || sortOptions.newest;

    const skip = (page - 1) * limit;

    const products = await prisma.product.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: { variants: true },
    });

    const total = await prisma.product.count({ where });

    // Facets power the filter sidebar. Categories are computed across the whole
    // active catalog (never scoped by the current category) so the shopper can
    // always switch between categories; brands and price range reflect the
    // current category/condition/seller context. This replaces the old Mongo
    // $facet aggregation with equivalent groupBy/aggregate queries.
    const scopedWhere: Prisma.ProductWhereInput = {
      isActive: true,
      ...(category ? { category: category as ProductCategory } : {}),
      ...(condition ? { condition: condition as ProductCondition } : {}),
      ...(sellerType ? { sellerType: sellerType as ProductSellerType } : {}),
    };

    const [categoryGroups, brandGroups, priceAgg] = await Promise.all([
      prisma.product.groupBy({
        by: ["category"],
        where: { isActive: true },
      }),
      prisma.product.groupBy({
        by: ["brand"],
        where: scopedWhere,
      }),
      prisma.product.aggregate({
        where: scopedWhere,
        _min: { basePrice: true },
        _max: { basePrice: true },
      }),
    ]);

    const availableFacets = {
      categories: categoryGroups
        .map((entry) => entry.category as string)
        .filter(Boolean)
        .sort(),
      brands: brandGroups
        .map((entry) => entry.brand as string | null)
        .filter((b): b is string => Boolean(b))
        .sort(),
      minPrice: priceAgg._min.basePrice || 0,
      maxPrice: priceAgg._max.basePrice || 10000,
    };

    return {
      products,
      total,
      page,
      pages: Math.ceil(total / limit),
      facets: availableFacets,
    };
  }

  /**
   * List products for the admin catalog view — unlike listProducts(), this
   * includes inactive products and supports admin-relevant search/sort.
   */
  async listProductsForAdmin(
    page: number = 1,
    limit: number = 20,
    options?: {
      search?: string;
      isActive?: boolean;
      sortBy?: "name" | "basePrice" | "totalStock" | "createdAt";
      sortOrder?: "asc" | "desc";
    },
  ) {
    const where: Prisma.ProductWhereInput = {};

    if (typeof options?.isActive === "boolean") {
      where.isActive = options.isActive;
    }

    if (options?.search) {
      const term = buildSafeSearchRegexSource(options.search)
        .replace(/\\/g, "")
        .slice(0, 100);
      where.OR = [
        { name: { contains: term, mode: "insensitive" } },
        { sku: { contains: term, mode: "insensitive" } },
      ];
    }

    const sortField = options?.sortBy || "createdAt";
    const sortDir: Prisma.SortOrder =
      options?.sortOrder === "asc" ? "asc" : "desc";
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy: { [sortField]: sortDir },
        skip,
        take: limit,
        include: { variants: true },
      }),
      prisma.product.count({ where }),
    ]);

    return {
      products,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get related products based on category and tags
   */
  async getRelatedProducts(
    productId: string,
    limit: number = 4,
  ): Promise<ProductWithVariants[]> {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) return [];

    // Find products in the same category or with intersecting tags, excluding the current product
    const related = await prisma.product.findMany({
      where: {
        id: { not: product.id },
        isActive: true,
        OR: [
          { category: product.category },
          { tags: { hasSome: product.tags } },
        ],
      },
      orderBy: [{ averageRating: "desc" }, { totalReviews: "desc" }], // Show best rated first
      take: limit,
      include: { variants: true },
    });

    return related;
  }

  /**
   * Create product (admin)
   */
  async createProduct(productData: any): Promise<ProductWithVariants> {
    const { dimensions, variants, ...rest } = productData;

    const variantsInput = (variants || []).map((v: any) => ({
      sku: v.sku,
      variantLabel: v.variantLabel ?? "",
      attributes: v.attributes ?? {},
      price: v.price,
      stock: v.stock ?? 0,
      reorderLevel: v.reorderLevel ?? 10,
    }));

    // totalStock is DERIVED (= sum of variant stocks) — was a pre-save hook.
    const totalStock = variantsInput.reduce(
      (sum: number, v: { stock: number }) => sum + (v.stock || 0),
      0,
    );

    return prisma.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...rest,
          // dimensions (embedded) flattened to dim* columns
          dimLength: dimensions?.length ?? 0,
          dimWidth: dimensions?.width ?? 0,
          dimHeight: dimensions?.height ?? 0,
          totalStock,
          variants: { create: variantsInput },
        },
        include: { variants: true },
      });

      // Create inventory records for each variant
      // (quantityAvailable DERIVED = onHand - reserved).
      for (const variant of product.variants) {
        await tx.inventory.create({
          data: {
            productVariantId: variant.id,
            quantityOnHand: variant.stock,
            quantityReserved: 0,
            quantityAvailable: variant.stock,
            reorderLevel: variant.reorderLevel,
          },
        });
      }

      return product;
    });
  }

  /**
   * Update product (admin)
   */
  async updateProduct(
    productId: string,
    updateData: any,
  ): Promise<ProductWithVariants | null> {
    const existing = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!existing) return null;

    const { dimensions, variants: variantUpdates, ...rest } = updateData;

    return prisma.$transaction(async (tx) => {
      const scalarData: Prisma.ProductUpdateInput = { ...rest };
      if (dimensions) {
        scalarData.dimLength = dimensions.length;
        scalarData.dimWidth = dimensions.width;
        scalarData.dimHeight = dimensions.height;
      }
      await tx.product.update({ where: { id: productId }, data: scalarData });

      // TODO(prisma): variant array handling. The Mongo original replaced the
      // embedded variants array wholesale via Object.assign. With normalized
      // ProductVariant rows we update existing variants by id here; adding or
      // removing variants through this path is NOT handled (was implicit in
      // Mongo). Revisit if the admin edit UI supports add/remove of variants.
      if (Array.isArray(variantUpdates)) {
        for (const v of variantUpdates) {
          if (!v?.id) continue;
          await tx.productVariant.update({
            where: { id: v.id },
            data: {
              ...(v.sku !== undefined ? { sku: v.sku } : {}),
              ...(v.variantLabel !== undefined
                ? { variantLabel: v.variantLabel }
                : {}),
              ...(v.attributes !== undefined
                ? { attributes: v.attributes }
                : {}),
              ...(v.price !== undefined ? { price: v.price } : {}),
              ...(v.stock !== undefined ? { stock: v.stock } : {}),
              ...(v.reorderLevel !== undefined
                ? { reorderLevel: v.reorderLevel }
                : {}),
            },
          });
        }
      }

      // Recompute derived totalStock (was pre-save hook).
      const currentVariants = await tx.productVariant.findMany({
        where: { productId },
      });
      const totalStock = currentVariants.reduce(
        (sum, v) => sum + (v.stock || 0),
        0,
      );
      await tx.product.update({
        where: { id: productId },
        data: { totalStock },
      });

      // Sync inventory per variant (upsert). quantityAvailable DERIVED.
      for (const variant of currentVariants) {
        const inventory = await tx.inventory.findUnique({
          where: { productVariantId: variant.id },
        });
        if (inventory) {
          await tx.inventory.update({
            where: { productVariantId: variant.id },
            data: {
              quantityOnHand: variant.stock,
              reorderLevel: variant.reorderLevel,
              quantityAvailable: variant.stock - inventory.quantityReserved,
            },
          });
        } else {
          await tx.inventory.create({
            data: {
              productVariantId: variant.id,
              quantityOnHand: variant.stock,
              quantityReserved: 0,
              quantityAvailable: variant.stock,
              reorderLevel: variant.reorderLevel,
            },
          });
        }
      }

      return tx.product.findUnique({
        where: { id: productId },
        include: { variants: true },
      });
    });
  }

  /**
   * Soft delete product
   */
  async deleteProduct(
    productId: string,
  ): Promise<ProductWithVariants | null> {
    const existing = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!existing) return null;

    return prisma.product.update({
      where: { id: productId },
      data: { isActive: false },
      include: { variants: true },
    });
  }
}

// ============ ECOMMERCE WEBHOOK RECONCILIATION ============

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
  rawPayload: unknown,
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
    asObj(data.paymentDetails).merchantOrderId,
  );

  if (!merchantOrderId || !merchantOrderId.startsWith("O_")) {
    return null;
  }

  const paymentTx = await prisma.shopPaymentTransaction.findFirst({
    where: { gatewayOrderId: merchantOrderId },
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
    paymentTx.orderId,
    paymentTx.gatewayPaymentId || merchantOrderId,
    merchantOrderId,
  );

  console.info("[ecommerce-reconcile] order confirmed from webhook", {
    merchantOrderId,
    orderId: paymentTx.orderId,
  });

  return true;
}
