import mongoose from "mongoose";
import { Inventory as InventoryModel, Product as ProductModel } from "../../models/Ecommerce";

export class InventoryService {
  /**
   * Reserve inventory for a cart item
   * Called when item is added to cart
   */
  async reserveInventory(productVariantId: string, quantity: number): Promise<boolean> {
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
  async releaseReservedInventory(productVariantId: string, quantity: number): Promise<boolean> {
    const inventoryDoc = await InventoryModel.findOne({
      productVariantId: new mongoose.Types.ObjectId(productVariantId),
    });

    if (!inventoryDoc) {
      throw new Error("Inventory record not found");
    }

    inventoryDoc.quantityReserved = Math.max(0, inventoryDoc.quantityReserved - quantity);
    await inventoryDoc.save();
    return true;
  }

  /**
   * Confirm inventory deduction (move from reserved to sold)
   * Called after successful payment
   */
  async confirmInventoryDeduction(productVariantId: string, quantity: number): Promise<boolean> {
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

    // Sync back to Product.variants[].stock
    const product = await ProductModel.findOne({
      "variants._id": new mongoose.Types.ObjectId(productVariantId),
    });

    if (product) {
      const variant = product.variants.find((v) => v._id.toString() === productVariantId);
      if (variant) {
        variant.stock = inventoryDoc.quantityOnHand;
        await product.save();
      }
    }

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
