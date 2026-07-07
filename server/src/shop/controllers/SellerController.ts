import { Request, Response } from "express";
import mongoose from "mongoose";
import {
  Product as ProductModel,
  Order as OrderModel,
} from "../models/Ecommerce";
import { User } from "../../client/models/User";
import { ProductService } from "../services/EcommerceService";
import { v4 as uuidv4 } from "uuid";
import { FulfillmentStatus, OrderStatus } from "../../types/ecommerce";

export class SellerController {
  private productService: ProductService;

  constructor() {
    this.productService = new ProductService();
  }

  /**
   * GET /api/v1/seller/products
   * List all products belonging to the logged-in user
   */
  async listSellerProducts(req: Request, res: Response): Promise<void> {
    try {
      const sellerId = (req as any).user?.id;
      if (!sellerId) {
        res.status(401).json({ ok: false, error: { message: "Unauthorized" } });
        return;
      }

      // Find active products for this seller
      const products = await ProductModel.find({
        seller: new mongoose.Types.ObjectId(sellerId),
        isActive: true,
      }).sort({ createdAt: -1 });

      res.json({
        ok: true,
        data: products,
      });
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: { message: error.message },
      });
    }
  }

  /**
   * POST /api/v1/seller/products
   * Create a new marketplace product
   */
  async createSellerProduct(req: Request, res: Response): Promise<void> {
    try {
      const sellerId = (req as any).user?.id;
      if (!sellerId) {
        res.status(401).json({ ok: false, error: { message: "Unauthorized" } });
        return;
      }

      const user = await User.findById(sellerId);
      if (!user) {
        res
          .status(404)
          .json({ ok: false, error: { message: "User profile not found" } });
        return;
      }

      const {
        name,
        description,
        category,
        brand = "GENERIC",
        basePrice,
        salePrice,
        images = [],
        stock = 1,
        condition = "USED",
        attributes = {},
        tags = [],
        ageGroup = "ALL",
        skillLevel = "ALL",
        gender = "UNISEX",
        weight = 0.5,
        dimensions = { length: 1, width: 1, height: 1 },
      } = req.body;

      if (!name || !description || !category || basePrice === undefined) {
        res.status(400).json({
          ok: false,
          error: {
            message: "Name, description, category, and price are required",
          },
        });
        return;
      }

      const finalSku = `PMS-SEL-${uuidv4().slice(0, 8).toUpperCase()}`;
      const variantSku = `PMS-VAR-${uuidv4().slice(0, 8).toUpperCase()}`;

      // Set default images if empty
      const finalImages =
        images.length > 0
          ? images
          : [
              "https://images.unsplash.com/photo-1517649763962-0c623066013b?auto=format&fit=crop&w=800&q=80",
            ];

      // Setup default variant for the P2P item
      const variants = [
        {
          sku: variantSku,
          variantLabel: "Standard",
          attributes: new Map(Object.entries(attributes)),
          price: basePrice,
          stock: Number(stock),
          reorderLevel: 0,
        },
      ];

      const userTypeMap: Record<string, string> = {
        Parent: "PARENT",
        Player: "Player",
        Coach: "Coach",
        Academy: "ACADEMY",
        VenueLister: "MERCHANT",
        Admin: "SYSTEM",
      };

      const finalSellerType = userTypeMap[user.userType] || "Player";

      const productData = {
        sku: finalSku,
        name,
        description,
        category,
        brand,
        basePrice: Number(basePrice),
        salePrice: salePrice ? Number(salePrice) : undefined,
        images: finalImages,
        weight: Number(weight),
        dimensions,
        taxable: false, // P2P items are typically untaxed or handled directly
        taxRate: 0,
        variants,
        totalStock: Number(stock),
        isActive: true,
        seller: new mongoose.Types.ObjectId(sellerId),
        sellerName: user.name,
        sellerType: finalSellerType,
        condition,
        tags,
        ageGroup,
        skillLevel,
        gender,
      };

      const product = await this.productService.createProduct(productData);

      res.status(201).json({
        ok: true,
        data: product,
      });
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: { message: error.message },
      });
    }
  }

  /**
   * PATCH /api/v1/seller/products/:productId
   * Update a product listed by the seller
   */
  async updateSellerProduct(req: Request, res: Response): Promise<void> {
    try {
      const sellerId = (req as any).user?.id;
      const { productId } = req.params;

      if (!sellerId || !productId) {
        res
          .status(400)
          .json({
            ok: false,
            error: { message: "Unauthorized or missing parameters" },
          });
        return;
      }

      const product = await ProductModel.findById(productId);
      if (!product) {
        res
          .status(404)
          .json({ ok: false, error: { message: "Product not found" } });
        return;
      }

      // Check ownership
      if (product.seller?.toString() !== sellerId) {
        res
          .status(403)
          .json({
            ok: false,
            error: { message: "Access denied. You do not own this listing." },
          });
        return;
      }

      const updateFields = req.body;
      // Prevent updating seller or SKU
      delete updateFields.seller;
      delete updateFields.sku;
      delete updateFields.sellerName;
      delete updateFields.sellerType;

      // Handle stock and price updates on the default variant if variants aren't directly provided
      if (
        updateFields.basePrice !== undefined ||
        updateFields.stock !== undefined
      ) {
        if (product.variants && product.variants.length > 0) {
          const mainVariant = product.variants[0];
          if (mainVariant) {
            if (updateFields.basePrice !== undefined) {
              mainVariant.price = Number(updateFields.basePrice);
            }
            if (updateFields.stock !== undefined) {
              mainVariant.stock = Number(updateFields.stock);
              product.totalStock = Number(updateFields.stock);
            }
            updateFields.variants = product.variants;
          }
        }
      }

      const updatedProduct = await this.productService.updateProduct(
        productId as string,
        updateFields,
      );

      res.json({
        ok: true,
        data: updatedProduct,
      });
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: { message: error.message },
      });
    }
  }

  /**
   * DELETE /api/v1/seller/products/:productId
   * Soft delete a product listed by the seller
   */
  async deleteSellerProduct(req: Request, res: Response): Promise<void> {
    try {
      const sellerId = (req as any).user?.id;
      const { productId } = req.params;

      if (!sellerId || !productId) {
        res
          .status(400)
          .json({
            ok: false,
            error: { message: "Unauthorized or missing parameters" },
          });
        return;
      }

      const product = await ProductModel.findById(productId);
      if (!product) {
        res
          .status(404)
          .json({ ok: false, error: { message: "Product not found" } });
        return;
      }

      // Check ownership
      if (product.seller?.toString() !== sellerId) {
        res
          .status(403)
          .json({
            ok: false,
            error: { message: "Access denied. You do not own this listing." },
          });
        return;
      }

      await this.productService.deleteProduct(productId as string);

      res.json({
        ok: true,
        data: { message: "Listing deactivated successfully" },
      });
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: { message: error.message },
      });
    }
  }

  /**
   * GET /api/v1/seller/orders
   * List all orders containing items belonging to the seller
   */
  async listSellerOrders(req: Request, res: Response): Promise<void> {
    try {
      const sellerId = (req as any).user?.id;
      if (!sellerId) {
        res.status(401).json({ ok: false, error: { message: "Unauthorized" } });
        return;
      }

      const orders = await OrderModel.find({
        "items.sellerId": new mongoose.Types.ObjectId(sellerId),
      }).sort({ createdAt: -1 });

      // Format response to show order but only display items belonging to this seller
      const formatted = orders.map((order) => {
        const orderObj = order.toObject();
        orderObj.items = orderObj.items.filter(
          (item: any) => item.sellerId?.toString() === sellerId,
        );
        return orderObj;
      });

      res.json({
        ok: true,
        data: formatted,
      });
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: { message: error.message },
      });
    }
  }

  /**
   * PATCH /api/v1/seller/orders/:orderId/items/:productVariantId/fulfillment
   * Update fulfillment status of a specific item in an order
   */
  async updateSellerOrderItemFulfillment(
    req: Request,
    res: Response,
  ): Promise<void> {
    try {
      const sellerId = (req as any).user?.id;
      const { orderId, productVariantId } = req.params;
      const { fulfillmentStatus, trackingNumber } = req.body;

      if (!sellerId) {
        res.status(401).json({ ok: false, error: { message: "Unauthorized" } });
        return;
      }

      if (!Object.values(FulfillmentStatus).includes(fulfillmentStatus)) {
        res
          .status(400)
          .json({
            ok: false,
            error: { message: "Invalid fulfillment status" },
          });
        return;
      }

      const order = await OrderModel.findById(orderId);
      if (!order) {
        res
          .status(404)
          .json({ ok: false, error: { message: "Order not found" } });
        return;
      }

      const item = order.items.find(
        (i) =>
          i.productVariantId.toString() === productVariantId &&
          i.sellerId?.toString() === sellerId,
      );

      if (!item) {
        res
          .status(403)
          .json({
            ok: false,
            error: {
              message: "Item not found or access denied for this seller",
            },
          });
        return;
      }

      item.fulfillmentStatus = fulfillmentStatus;
      if (trackingNumber !== undefined) {
        item.trackingNumber = trackingNumber;
      }

      // Compute overall order fulfillment status:
      // If all items are delivered -> DELIVERED
      // If any items are processed/shipped/delivered -> PROCESSING/SHIPPED
      // Else -> PENDING
      const allStatuses = order.items.map((i) => i.fulfillmentStatus);
      if (allStatuses.every((s) => s === FulfillmentStatus.DELIVERED)) {
        order.fulfillmentStatus = FulfillmentStatus.DELIVERED;
        order.status = OrderStatus.DELIVERED;
      } else if (
        allStatuses.some((s) =>
          [FulfillmentStatus.SHIPPED, FulfillmentStatus.DELIVERED].includes(s),
        )
      ) {
        order.fulfillmentStatus = FulfillmentStatus.SHIPPED;
        order.status = OrderStatus.SHIPPED;
      } else if (allStatuses.some((s) => s === FulfillmentStatus.PROCESSING)) {
        order.fulfillmentStatus = FulfillmentStatus.PROCESSING;
        order.status = OrderStatus.PROCESSING;
      }

      await order.save();

      res.json({
        ok: true,
        data: order,
      });
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: { message: error.message },
      });
    }
  }
}
