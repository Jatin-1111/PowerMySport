import mongoose from "mongoose";
import {
  CartDocument,
  CartItemDocument,
  Cart as CartModel,
  Product as ProductModel,
} from "../../models/Ecommerce";
import { InventoryService } from "./inventoryService";

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
    quantity: number
  ): Promise<CartDocument> {
    // Validate variant exists and has stock
    const variant = await this.getProductVariant(productVariantId);
    if (!variant) {
      throw new Error("Product variant not found");
    }

    // Check inventory availability
    const availableQty = await this.inventoryService.getAvailableQuantity(productVariantId);
    if (availableQty < quantity) {
      throw new Error(`Only ${availableQty} units available for this product`);
    }

    // Get or create cart
    const cart = await this.getOrCreateCart(userId);

    // Check if item already in cart
    const existingItem = cart.items.find(
      (item) => item.productVariantId.toString() === productVariantId.toString()
    );

    if (existingItem) {
      // Update quantity and line total
      const newQuantity = existingItem.quantity + quantity;

      // Verify we have enough for new total
      if (availableQty < newQuantity) {
        throw new Error(`Only ${availableQty} units available for this product`);
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
  async removeItemFromCart(userId: string, cartItemId: string): Promise<CartDocument> {
    const cart = await CartModel.findOne({
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!cart) {
      throw new Error("Cart not found");
    }

    const itemIndex = cart.items.findIndex((item) => item._id.toString() === cartItemId);

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
      item.quantity
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
    newQuantity: number
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

    const variant = await this.getProductVariant(item.productVariantId.toString());
    if (!variant) {
      throw new Error("Product variant not found");
    }

    // Handle quantity change (increase or decrease)
    const quantityDifference = newQuantity - item.quantity;

    if (quantityDifference > 0) {
      // Increasing quantity - need to reserve more
      const availableQty = await this.inventoryService.getAvailableQuantity(
        item.productVariantId.toString()
      );
      if (availableQty < quantityDifference) {
        throw new Error(`Only ${availableQty} additional units available`);
      }
      await this.inventoryService.reserveInventory(
        item.productVariantId.toString(),
        quantityDifference
      );
    } else {
      // Decreasing quantity - release reserved
      await this.inventoryService.releaseReservedInventory(
        item.productVariantId.toString(),
        Math.abs(quantityDifference)
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
        item.quantity
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
    discountAmount: number
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
        "variants._id": new mongoose.Types.ObjectId(item.productVariantId.toString()),
      });
      if (product && product.taxable) {
        taxAmount += item.lineTotal * product.taxRate;
      }
    }

    cart.subtotal = subtotal;
    cart.taxAmount = Math.round(taxAmount); // Round to nearest paise
    cart.totalAmount = cart.subtotal + cart.taxAmount - (cart.discountAmount || 0);
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
