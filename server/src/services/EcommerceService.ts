import mongoose from "mongoose";
import {
  Cart as CartModel,
  CartDocument,
  CartItemDocument,
  Inventory as InventoryModel,
  InventoryDocument,
  Product as ProductModel,
  ProductDocument,
  Order as OrderModel,
  OrderDocument,
  PaymentTransaction as PaymentTransactionModel,
  PaymentTransactionDocument,
} from "../models/Ecommerce";
import {
  OrderStatus,
  PaymentStatus,
  FulfillmentStatus,
  PaymentGateway,
  ApiResponse,
} from "../types/ecommerce";

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
    const inventoryDoc = await InventoryModel.findOne({
      productVariantId: new mongoose.Types.ObjectId(productVariantId),
    });

    if (!inventoryDoc) {
      throw new Error("Inventory record not found");
    }

    if (inventoryDoc.quantityAvailable < quantity) {
      throw new Error("Insufficient inventory available");
    }

    inventoryDoc.quantityReserved += quantity;
    await inventoryDoc.save();
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
    const inventoryDoc = await InventoryModel.findOne({
      productVariantId: new mongoose.Types.ObjectId(productVariantId),
    });

    if (!inventoryDoc) {
      throw new Error("Inventory record not found");
    }

    inventoryDoc.quantityReserved = Math.max(
      0,
      inventoryDoc.quantityReserved - quantity,
    );
    await inventoryDoc.save();
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
    const inventoryDoc = await InventoryModel.findOne({
      productVariantId: new mongoose.Types.ObjectId(productVariantId),
    });

    if (!inventoryDoc) {
      throw new Error("Inventory record not found");
    }

    if (inventoryDoc.quantityReserved < quantity) {
      throw new Error("Insufficient reserved inventory");
    }

    inventoryDoc.quantityReserved -= quantity;
    inventoryDoc.quantityOnHand -= quantity;
    await inventoryDoc.save();
    return true;
  }

  /**
   * Get available quantity for a variant
   */
  async getAvailableQuantity(productVariantId: string): Promise<number> {
    const inventoryDoc = await InventoryModel.findOne({
      productVariantId: new mongoose.Types.ObjectId(productVariantId),
    });

    return inventoryDoc?.quantityAvailable || 0;
  }

  /**
   * Check if low stock and needs reorder
   */
  async isLowStock(productVariantId: string): Promise<boolean> {
    const inventoryDoc = await InventoryModel.findOne({
      productVariantId: new mongoose.Types.ObjectId(productVariantId),
    });

    if (!inventoryDoc) return false;
    return inventoryDoc.quantityOnHand < inventoryDoc.reorderLevel;
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
  async getOrCreateCart(userId: string): Promise<CartDocument> {
    let cart = await CartModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!cart) {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24-hour TTL
      cart = new CartModel({
        userId: new mongoose.Types.ObjectId(userId),
        items: [],
        subtotal: 0,
        taxAmount: 0,
        discountAmount: 0,
        totalAmount: 0,
        expiresAt,
      });
      await cart.save();
    }

    // Refresh expiration
    cart.expiresAt = new Date();
    cart.expiresAt.setHours(cart.expiresAt.getHours() + 24);
    await cart.save();

    return cart;
  }

  /**
   * Add item to cart
   */
  async addItemToCart(
    userId: string,
    productVariantId: string,
    quantity: number,
  ): Promise<CartDocument> {
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
      (item) =>
        item.productVariantId.toString() === productVariantId.toString(),
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

      existingItem.quantity = newQuantity;
      existingItem.lineTotal = newQuantity * variant.price;
    } else {
      // Add new item
      const newItem = {
        cartId: cart._id,
        productVariantId: new mongoose.Types.ObjectId(productVariantId),
        quantity,
        lineTotal: quantity * variant.price,
        reservedAt: new Date(),
      };
      cart.items.push(newItem as CartItemDocument);
    }

    // Reserve inventory
    await this.inventoryService.reserveInventory(productVariantId, quantity);

    // Recalculate totals
    await this.recalculateCartTotals(cart);
    await cart.save();

    return cart;
  }

  /**
   * Remove item from cart
   */
  async removeItemFromCart(
    userId: string,
    cartItemId: string,
  ): Promise<CartDocument> {
    const cart = await CartModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!cart) {
      throw new Error("Cart not found");
    }

    const itemIndex = cart.items.findIndex(
      (item) => item._id.toString() === cartItemId,
    );

    if (itemIndex === -1) {
      throw new Error("Item not found in cart");
    }

    const item = cart.items[itemIndex];
    if (!item) {
      throw new Error("Item not found in cart");
    }

    // Release reserved inventory
    await this.inventoryService.releaseReservedInventory(
      item.productVariantId.toString(),
      item.quantity,
    );

    // Remove item
    cart.items.splice(itemIndex, 1);

    // Recalculate totals
    await this.recalculateCartTotals(cart);
    await cart.save();

    return cart;
  }

  /**
   * Update cart item quantity
   */
  async updateItemQuantity(
    userId: string,
    cartItemId: string,
    newQuantity: number,
  ): Promise<CartDocument> {
    if (newQuantity < 1) {
      throw new Error("Quantity must be at least 1");
    }

    const cart = await CartModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!cart) {
      throw new Error("Cart not found");
    }

    const item = cart.items.find((i) => i._id.toString() === cartItemId);
    if (!item) {
      throw new Error("Item not found in cart");
    }

    const variant = await this.getProductVariant(
      item.productVariantId.toString(),
    );
    if (!variant) {
      throw new Error("Product variant not found");
    }

    // Handle quantity change (increase or decrease)
    const quantityDifference = newQuantity - item.quantity;

    if (quantityDifference > 0) {
      // Increasing quantity - need to reserve more
      const availableQty = await this.inventoryService.getAvailableQuantity(
        item.productVariantId.toString(),
      );
      if (availableQty < quantityDifference) {
        throw new Error(`Only ${availableQty} additional units available`);
      }
      await this.inventoryService.reserveInventory(
        item.productVariantId.toString(),
        quantityDifference,
      );
    } else {
      // Decreasing quantity - release reserved
      await this.inventoryService.releaseReservedInventory(
        item.productVariantId.toString(),
        Math.abs(quantityDifference),
      );
    }

    item.quantity = newQuantity;
    item.lineTotal = newQuantity * variant.price;

    await this.recalculateCartTotals(cart);
    await cart.save();

    return cart;
  }

  /**
   * Clear entire cart
   */
  async clearCart(userId: string): Promise<void> {
    const cart = await CartModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!cart) {
      return;
    }

    // Release all reserved inventory
    for (const item of cart.items) {
      await this.inventoryService.releaseReservedInventory(
        item.productVariantId.toString(),
        item.quantity,
      );
    }

    // Clear items and reset totals
    cart.items = [];
    cart.subtotal = 0;
    cart.taxAmount = 0;
    cart.discountAmount = 0;
    cart.totalAmount = 0;
    cart.appliedPromoCode = "";

    await cart.save();
  }

  /**
   * Apply promo code to cart
   * This is simplified - actual implementation should validate promo eligibility
   */
  async applyPromoCode(
    userId: string,
    promoCode: string,
    discountAmount: number,
  ): Promise<CartDocument> {
    const cart = await CartModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!cart) {
      throw new Error("Cart not found");
    }

    if (discountAmount < 0 || discountAmount > cart.subtotal) {
      throw new Error("Invalid discount amount");
    }

    cart.appliedPromoCode = promoCode;
    cart.discountAmount = discountAmount;
    cart.totalAmount = cart.subtotal + cart.taxAmount - discountAmount;

    await cart.save();
    return cart;
  }

  /**
   * Remove promo code from cart
   */
  async removePromoCode(userId: string): Promise<CartDocument> {
    const cart = await CartModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!cart) {
      throw new Error("Cart not found");
    }

    cart.appliedPromoCode = "";
    cart.discountAmount = 0;
    cart.totalAmount = cart.subtotal + cart.taxAmount;

    await cart.save();
    return cart;
  }

  /**
   * Recalculate cart totals (subtotal, tax, total)
   * Tax calculation: subtotal * product.taxRate
   */
  private async recalculateCartTotals(cart: CartDocument): Promise<void> {
    let subtotal = 0;
    let taxAmount = 0;

    for (const item of cart.items) {
      subtotal += item.lineTotal;

      // Get product to calculate tax rate snapshot for current cart line.
      const product = await ProductModel.findOne({
        "variants._id": new mongoose.Types.ObjectId(
          item.productVariantId.toString(),
        ),
      });
      if (product && product.taxable) {
        taxAmount += item.lineTotal * product.taxRate;
      }
    }

    cart.subtotal = subtotal;
    cart.taxAmount = Math.round(taxAmount); // Round to nearest paise
    cart.totalAmount =
      cart.subtotal + cart.taxAmount - (cart.discountAmount || 0);
  }

  /**
   * Helper: Get product variant details
   */
  private async getProductVariant(productVariantId: string) {
    const product = await ProductModel.findOne({
      "variants._id": new mongoose.Types.ObjectId(productVariantId),
    });

    if (!product) return null;

    return product.variants.find((v) => v._id.toString() === productVariantId);
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
   * Create order from cart
   */
  async createOrderFromCart(
    userId: string,
    shippingAddress: any,
    paymentMethod: string,
    paymentGateway: PaymentGateway,
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
        (v) => v._id.toString() === cartItem.productVariantId.toString(),
      );

      orderItems.push({
        productVariantId: cartItem.productVariantId,
        productName: variant.name,
        variantLabel: variantDoc?.variantLabel || "",
        quantity: cartItem.quantity,
        unitPrice: variantDoc?.price || 0,
        lineTotal: cartItem.lineTotal,
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
    paymentGatewayOrderId: string,
  ): Promise<OrderDocument> {
    const order = await OrderModel.findById(orderId);

    if (!order) {
      throw new Error("Order not found");
    }

    // Validate state transition
    if (order.status !== OrderStatus.PENDING_PAYMENT) {
      throw new Error(
        `Cannot confirm payment for order in ${order.status} state`,
      );
    }

    // Update order
    order.status = OrderStatus.PAYMENT_CONFIRMED;
    order.paymentStatus = PaymentStatus.CAPTURED;
    order.paymentGatewayPaymentId = paymentGatewayPaymentId;
    order.fulfillmentStatus = FulfillmentStatus.PENDING;

    // Confirm inventory deduction for each item
    for (const item of order.items) {
      await this.inventoryService.confirmInventoryDeduction(
        item.productVariantId.toString(),
        item.quantity,
      );
    }

    await order.save();

    // Clear user's cart after successful order
    await this.cartService.clearCart(order.userId.toString());

    return order;
  }

  /**
   * Handle payment failure
   */
  async handlePaymentFailure(
    orderId: string,
    failureReason?: string,
  ): Promise<OrderDocument> {
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
        item.quantity,
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
        `Cannot cancel order in ${order.status} state. Only PENDING_PAYMENT orders can be cancelled.`,
      );
    }

    // Release reserved inventory
    for (const item of order.items) {
      await this.inventoryService.releaseReservedInventory(
        item.productVariantId.toString(),
        item.quantity,
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
    trackingNumber?: string,
  ): Promise<OrderDocument> {
    const order = await OrderModel.findById(orderId);

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

    order.fulfillmentStatus = fulfillmentStatus;
    if (trackingNumber) {
      order.trackingNumber = trackingNumber;
    }

    await order.save();
    return order;
  }

  /**
   * Get order by ID
   */
  async getOrderById(orderId: string): Promise<OrderDocument | null> {
    return OrderModel.findById(orderId);
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
    const query: any = {
      userId: new mongoose.Types.ObjectId(userId),
    };

    if (status) {
      query.status = status;
    }

    const skip = (page - 1) * limit;

    const orders = await OrderModel.find(query)
      .sort({ createdAt: -1 })
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
    },
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

    const skip = (page - 1) * limit;

    const orders = await OrderModel.find(query)
      .sort({ createdAt: -1 })
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

// ============ PRODUCT SERVICE ============

export class ProductService {
  /**
   * Get product by ID
   */
  async getProductById(productId: string): Promise<ProductDocument | null> {
    return ProductModel.findById(productId);
  }

  /**
   * Get product by SKU
   */
  async getProductBySku(sku: string): Promise<ProductDocument | null> {
    return ProductModel.findOne({ sku: sku.toUpperCase() });
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
  ) {
    const query: any = {
      isActive: true,
    };

    if (category) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { name: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
        { sku: new RegExp(search, "i") },
      ];
    }

    const sortOptions: Record<string, any> = {
      price_asc: { basePrice: 1 },
      price_desc: { basePrice: -1 },
      newest: { createdAt: -1 },
      popularity: { totalStock: -1 }, // Simple popularity metric
    };

    const sortField = sortOptions[sortBy] || sortOptions.newest;

    const skip = (page - 1) * limit;

    const products = await ProductModel.find(query)
      .sort(sortField)
      .skip(skip)
      .limit(limit);

    const total = await ProductModel.countDocuments(query);

    return {
      products,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Create product (admin)
   */
  async createProduct(productData: any): Promise<ProductDocument> {
    const product = new ProductModel(productData);
    await product.save();
    return product;
  }

  /**
   * Update product (admin)
   */
  async updateProduct(
    productId: string,
    updateData: any,
  ): Promise<ProductDocument | null> {
    return ProductModel.findByIdAndUpdate(productId, updateData, {
      new: true,
      runValidators: true,
    });
  }

  /**
   * Soft delete product
   */
  async deleteProduct(productId: string): Promise<ProductDocument | null> {
    return ProductModel.findByIdAndUpdate(
      productId,
      { isActive: false },
      { new: true },
    );
  }
}
