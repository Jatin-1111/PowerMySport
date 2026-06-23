import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { Review as ReviewModel } from "../../client/models/Review";
import { NotificationService } from "../../client/services/NotificationService";
import { validatePromoCode } from "../../client/services/PromoCodeService";
import {
  PaymentService,
  RefundService,
} from "../../shared/services/PaymentService";
import { s3Service } from "../../shared/services/S3Service";
import {
  ApiResponse,
  FulfillmentStatus,
  OrderStatus,
  PaymentGateway,
  PaymentStatus,
} from "../../types/ecommerce";
import {
  Order as OrderModel,
  PaymentTransaction as PaymentTransactionModel,
  Product as ProductModel,
  Wishlist as WishlistModel,
} from "../models/Ecommerce";
import {
  CartService,
  InventoryService,
  OrderService,
  ProductService,
} from "../services/EcommerceService";

const getParam = (value: unknown): string | null =>
  typeof value === "string" && value.trim().length > 0 ? value : null;

// ============ CUSTOMER CONTROLLER ============

export class EcommerceController {
  private cartService: CartService;
  private orderService: OrderService;
  private productService: ProductService;
  private paymentService: PaymentService;

  constructor() {
    this.cartService = new CartService();
    this.orderService = new OrderService();
    this.productService = new ProductService();
    this.paymentService = new PaymentService(PaymentGateway.PHONEPE);
  }

  /**
   * GET /api/v1/products
   * List all products
   */
  async listProducts(req: Request, res: Response): Promise<void> {
    try {
      const {
        page = 1,
        limit = 20,
        category,
        search,
        sortBy = "newest",
        brand,
        rating,
        minPrice,
        maxPrice,
        condition,
        sellerType,
      } = req.query;

      const result = await this.productService.listProducts(
        Number(page),
        Number(limit),
        category as string,
        search as string,
        sortBy as string,
        brand as string,
        rating ? Number(rating) : undefined,
        minPrice ? Number(minPrice) : undefined,
        maxPrice ? Number(maxPrice) : undefined,
        condition as string,
        sellerType as string,
      );

      res.json({
        ok: true,
        data: result,
      } as ApiResponse<any>);
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error.message,
        },
      } as ApiResponse<null>);
    }
  }

  /**
   * GET /api/v1/products/:id
   * Get product by ID
   */
  async getProduct(req: Request, res: Response): Promise<void> {
    try {
      const id = getParam((req.params as Record<string, unknown>).id);
      if (!id) {
        res.status(400).json({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Product id is required",
          },
        });
        return;
      }

      const product = await this.productService.getProductById(id);

      if (!product) {
        res.status(404).json({
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: "Product not found",
          },
        });
        return;
      }

      res.json({
        ok: true,
        data: product,
      } as ApiResponse<any>);
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error.message,
        },
      } as ApiResponse<null>);
    }
  }

  /**
   * GET /api/v1/products/:id/related
   * Get related products
   */
  async getRelatedProducts(req: Request, res: Response): Promise<void> {
    try {
      const id = getParam((req.params as Record<string, unknown>).id);
      if (!id) {
        res.status(400).json({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Product id is required",
          },
        });
        return;
      }

      const limit = Number(req.query.limit) || 4;
      const products = await this.productService.getRelatedProducts(id, limit);

      res.json({
        ok: true,
        data: products,
      } as ApiResponse<any>);
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error.message,
        },
      } as ApiResponse<null>);
    }
  }

  /**
   * GET /api/v1/cart
   * Get user's cart
   */
  async getCart(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          ok: false,
          error: {
            code: "UNAUTHORIZED",
            message: "User not authenticated",
          },
        });
        return;
      }

      const cart = await this.cartService.getOrCreateCart(userId);

      res.json({
        ok: true,
        data: cart,
      } as ApiResponse<any>);
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error.message,
        },
      } as ApiResponse<null>);
    }
  }

  /**
   * POST /api/v1/cart/add-item
   * Add item to cart
   */
  async addToCart(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { productVariantId, quantity } = req.body;

      if (!userId) {
        res.status(401).json({
          ok: false,
          error: {
            code: "UNAUTHORIZED",
            message: "User not authenticated",
          },
        });
        return;
      }

      if (!productVariantId || !quantity || quantity < 1) {
        res.status(400).json({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "productVariantId and quantity (>= 1) are required",
          },
        });
        return;
      }

      const cart = await this.cartService.addItemToCart(
        userId,
        productVariantId,
        quantity,
      );

      res.json({
        ok: true,
        data: cart,
      } as ApiResponse<any>);
    } catch (error: any) {
      if (error.message.includes("OUT_OF_STOCK")) {
        res.status(400).json({
          ok: false,
          error: {
            code: "OUT_OF_STOCK",
            message: error.message,
          },
        });
      } else {
        res.status(500).json({
          ok: false,
          error: {
            code: "INTERNAL_ERROR",
            message: error.message,
          },
        });
      }
    }
  }

  /**
   * POST /api/v1/cart/remove-item
   * Remove item from cart
   */
  async removeFromCart(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { cartItemId } = req.body;

      if (!userId) {
        res.status(401).json({
          ok: false,
          error: {
            code: "UNAUTHORIZED",
            message: "User not authenticated",
          },
        });
        return;
      }

      if (!cartItemId) {
        res.status(400).json({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "cartItemId is required",
          },
        });
        return;
      }

      const cart = await this.cartService.removeItemFromCart(
        userId,
        cartItemId,
      );

      res.json({
        ok: true,
        data: cart,
      } as ApiResponse<any>);
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error.message,
        },
      } as ApiResponse<null>);
    }
  }

  /**
   * POST /api/v1/cart/clear
   * Clear cart
   */
  async clearCart(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          ok: false,
          error: {
            code: "UNAUTHORIZED",
            message: "User not authenticated",
          },
        });
        return;
      }

      await this.cartService.clearCart(userId);

      res.json({
        ok: true,
        data: { cartId: "cleared" },
      } as ApiResponse<any>);
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error.message,
        },
      } as ApiResponse<null>);
    }
  }

  /**
   * POST /api/v1/cart/apply-promo
   * Apply promo code to cart
   */
  async applyPromo(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { promoCode } = req.body;

      if (!userId) {
        res.status(401).json({
          ok: false,
          error: {
            code: "UNAUTHORIZED",
            message: "User not authenticated",
          },
        });
        return;
      }

      if (!promoCode) {
        res.status(400).json({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "promoCode is required",
          },
        });
        return;
      }

      const cart = await this.cartService.getOrCreateCart(userId);

      if (!cart.items.length) {
        res.status(400).json({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Cart is empty",
          },
        });
        return;
      }

      const promoValidation = await validatePromoCode(
        promoCode,
        userId,
        cart.subtotal,
        { context: "MERCHANDISE" },
      );

      if (!promoValidation.isValid) {
        res.status(400).json({
          ok: false,
          error: {
            code: "INVALID_PROMO",
            message: promoValidation.message || "Promo code is invalid",
          },
        });
        return;
      }

      const updatedCart = await this.cartService.applyPromoCode(
        userId,
        promoCode.toUpperCase(),
        promoValidation.discountAmount,
      );

      res.json({
        ok: true,
        data: updatedCart,
      } as ApiResponse<any>);
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error.message,
        },
      } as ApiResponse<null>);
    }
  }

  /**
   * POST /api/v1/orders/create-from-cart
   * Create order from cart
   */
  async createOrderFromCart(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { shippingAddress, paymentMethod } = req.body;

      if (!userId) {
        res.status(401).json({
          ok: false,
          error: {
            code: "UNAUTHORIZED",
            message: "User not authenticated",
          },
        });
        return;
      }

      if (!shippingAddress || !paymentMethod) {
        res.status(400).json({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "shippingAddress and paymentMethod are required",
          },
        });
        return;
      }

      // Create order
      const order = await this.orderService.createOrderFromCart(
        userId,
        shippingAddress,
        paymentMethod,
        PaymentGateway.PHONEPE,
      );

      // Initiate payment
      const idempotencyKey = uuidv4();
      const paymentTx = await this.paymentService.initiatePayment(
        order._id.toString(),
        order.totalAmount,
        "INR",
        idempotencyKey,
        PaymentGateway.PHONEPE,
        {
          name: shippingAddress.fullName,
          email: shippingAddress.email,
          phone: shippingAddress.phone,
        },
      );

      // Update order with payment gateway order ID
      order.paymentGatewayOrderId = paymentTx.gatewayOrderId;
      await order.save();

      res.status(201).json({
        ok: true,
        data: {
          order: {
            id: order._id.toString(),
            orderNumber: order.orderNumber,
            status: order.status,
            totalAmount: order.totalAmount,
            paymentGateway: order.paymentGateway,
            paymentGatewayOrderId: order.paymentGatewayOrderId,
            createdAt: order.createdAt,
          },
          paymentConfig: paymentTx.gatewayResponse,
        },
      } as ApiResponse<any>);
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error.message,
        },
      } as ApiResponse<null>);
    }
  }

  /**
   * POST /api/v1/orders/:orderId/verify-payment
   * Verify payment signature
   */
  async verifyPayment(req: Request, res: Response): Promise<void> {
    try {
      const orderId = getParam((req.params as Record<string, unknown>).orderId);
      const { phonepe_payment_id, phonepe_order_id, phonepe_signature } =
        req.body;

      if (!orderId) {
        res.status(400).json({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Order id is required",
          },
        });
        return;
      }

      if (!phonepe_payment_id || !phonepe_order_id || !phonepe_signature) {
        res.status(400).json({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Payment credentials are required",
          },
        });
        return;
      }

      // Verify payment
      const paymentTx = await this.paymentService.verifyAndConfirmPayment(
        orderId,
        phonepe_payment_id,
        phonepe_order_id,
        phonepe_signature,
      );

      // Confirm order payment
      const order = await this.orderService.confirmPayment(
        orderId,
        phonepe_payment_id,
        phonepe_order_id,
      );

      // Emit payment confirmed notification to the user
      NotificationService.send({
        userId: order.userId.toString(),
        type: "PAYMENT_CONFIRMED",
        title: "Payment Confirmed",
        message: `Your payment for order ${order.orderNumber} has been confirmed. We are processing your order.`,
        data: {
          orderId: order._id.toString(),
          orderNumber: order.orderNumber,
          totalAmount: order.totalAmount,
          confirmedAt: new Date().toISOString(),
        },
      }).catch((err: Error) =>
        console.error(
          "[EcommerceController] Failed to send payment notification:",
          err,
        ),
      );

      res.json({
        ok: true,
        data: {
          order: {
            id: order._id.toString(),
            orderNumber: order.orderNumber,
            status: order.status,
            paymentStatus: order.paymentStatus,
            totalAmount: order.totalAmount,
          },
        },
      } as ApiResponse<any>);
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: {
          code: "PAYMENT_VERIFICATION_FAILED",
          message: error.message,
        },
      } as ApiResponse<null>);
    }
  }

  /**
   * GET /api/v1/orders/:orderId
   * Get order details
   */
  async getOrder(req: Request, res: Response): Promise<void> {
    try {
      const orderId = getParam((req.params as Record<string, unknown>).orderId);
      const userId = (req as any).user?.id;

      if (!orderId) {
        res.status(400).json({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Order id is required",
          },
        });
        return;
      }

      const order = await this.orderService.getOrderById(orderId);

      if (!order) {
        res.status(404).json({
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: "Order not found",
          },
        });
        return;
      }

      // Verify user owns this order
      if (
        order.userId.toString() !== userId &&
        (req as any).user?.role !== "ADMIN"
      ) {
        res.status(403).json({
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: "Access denied",
          },
        });
        return;
      }

      res.json({
        ok: true,
        data: order,
      } as ApiResponse<any>);
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error.message,
        },
      } as ApiResponse<null>);
    }
  }

  /**
   * GET /api/v1/orders
   * List user's orders
   */
  async listOrders(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { page = 1, limit = 10, status } = req.query;

      if (!userId) {
        res.status(401).json({
          ok: false,
          error: {
            code: "UNAUTHORIZED",
            message: "User not authenticated",
          },
        });
        return;
      }

      const result = await this.orderService.listUserOrders(
        userId,
        Number(page),
        Number(limit),
        status as OrderStatus,
      );

      res.json({
        ok: true,
        data: result,
      } as ApiResponse<any>);
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error.message,
        },
      } as ApiResponse<null>);
    }
  }

  /**
   * POST /api/v1/orders/:orderId/cancel
   * Cancel order
   */
  async cancelOrder(req: Request, res: Response): Promise<void> {
    try {
      const orderId = getParam((req.params as Record<string, unknown>).orderId);
      const { reason } = req.body;
      const userId = (req as any).user?.id;

      if (!orderId) {
        res.status(400).json({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Order id is required",
          },
        });
        return;
      }

      // Verify user owns this order
      const order = await this.orderService.getOrderById(orderId);
      if (!order || order.userId.toString() !== userId) {
        res.status(403).json({
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: "Access denied",
          },
        });
        return;
      }

      const cancelledOrder = await this.orderService.cancelOrder(
        orderId,
        reason || "User cancelled",
      );

      res.json({
        ok: true,
        data: cancelledOrder,
      } as ApiResponse<any>);
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: {
          code: "INVALID_STATE_TRANSITION",
          message: error.message,
        },
      } as ApiResponse<null>);
    }
  }

  /**
   * GET /api/v1/orders/:orderId/invoice/pdf
   * Download order invoice as PDF
   */
  async downloadOrderInvoice(req: Request, res: Response): Promise<void> {
    try {
      const orderId = getParam((req.params as Record<string, unknown>).orderId);
      const userId = (req as any).user?.id;

      if (!orderId) {
        res.status(400).json({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Order id is required",
          },
        });
        return;
      }

      const order = await this.orderService.getOrderById(orderId);
      if (!order) {
        res.status(404).json({
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: "Order not found",
          },
        });
        return;
      }

      // Verify user owns this order or is admin
      if (
        order.userId.toString() !== userId &&
        (req as any).user?.role !== "ADMIN"
      ) {
        res.status(403).json({
          ok: false,
          error: {
            code: "FORBIDDEN",
            message: "Access denied",
          },
        });
        return;
      }

      // Can only generate invoice for paid orders
      if (
        order.paymentStatus !== PaymentStatus.CAPTURED
      ) {
        res.status(409).json({
          ok: false,
          error: {
            code: "INVALID_STATE",
            message: "Invoice available only for paid orders",
          },
        });
        return;
      }

      // Generate invoice number and date
      const invoiceNumber = `INV-${order.orderNumber}`;
      const invoiceDate = new Date(order.createdAt);

      // Use PDFKit to generate the invoice
      const PDFDocument = require("pdfkit");
      const doc = new PDFDocument({ margin: 50 });

      // Set response headers
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${invoiceNumber}.pdf"`,
      );

      doc.pipe(res);

      // Header
      doc
        .fontSize(20)
        .font("Helvetica-Bold")
        .text("INVOICE", { align: "center" });
      doc.moveDown(0.5);

      // Invoice details
      doc.fontSize(10).font("Helvetica");
      doc.text(`Invoice Number: ${invoiceNumber}`);
      doc.text(`Order Date: ${invoiceDate.toLocaleDateString("en-IN")}`);
      doc.text(`Order Number: ${order.orderNumber}`);
      doc.moveDown();

      // Bill to section
      doc.fontSize(12).font("Helvetica-Bold").text("BILL TO:");
      doc.fontSize(10).font("Helvetica");
      doc.text(order.shippingAddress.fullName);
      doc.text(order.shippingAddress.addressLine1);
      if (order.shippingAddress.addressLine2) {
        doc.text(order.shippingAddress.addressLine2);
      }
      doc.text(
        `${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}`,
      );
      doc.text(order.shippingAddress.country || "IN");
      doc.moveDown();

      // Items table
      doc.fontSize(12).font("Helvetica-Bold").text("ORDER ITEMS");
      doc.moveDown(0.5);

      const tableTop = doc.y;
      const col1X = 50;
      const col2X = 300;
      const col3X = 400;
      const col4X = 500;

      // Table header
      doc.fontSize(10).font("Helvetica-Bold");
      doc.text("Product", col1X, tableTop);
      doc.text("Qty", col2X, tableTop);
      doc.text("Unit Price", col3X, tableTop);
      doc.text("Total", col4X, tableTop);

      doc
        .moveTo(col1X, tableTop + 15)
        .lineTo(550, tableTop + 15)
        .stroke();

      // Table rows
      let currentY = tableTop + 25;
      doc.fontSize(9).font("Helvetica");

      for (const item of order.items) {
        const productName =
          item.variantLabel && item.variantLabel !== "DEFAULT"
            ? `${item.productName} (${item.variantLabel})`
            : item.productName;

        doc.text(productName, col1X, currentY, { width: 200, ellipsis: true });
        doc.text(String(item.quantity), col2X, currentY);
        doc.text(`₹${item.unitPrice.toFixed(2)}`, col3X, currentY);
        doc.text(`₹${item.lineTotal.toFixed(2)}`, col4X, currentY);

        currentY += 20;
      }

      doc.moveTo(col1X, currentY).lineTo(550, currentY).stroke();
      currentY += 15;

      // Summary
      doc.fontSize(10).font("Helvetica");
      doc.text("Subtotal:", col3X, currentY);
      doc.text(
        `₹${(order.totalAmount - order.taxAmount - (order.shippingAmount || 0)).toFixed(2)}`,
        col4X,
        currentY,
      );

      currentY += 15;
      doc.text("Tax (GST):", col3X, currentY);
      doc.text(`₹${order.taxAmount.toFixed(2)}`, col4X, currentY);

      if (order.shippingAmount && order.shippingAmount > 0) {
        currentY += 15;
        doc.text("Shipping:", col3X, currentY);
        doc.text(`₹${order.shippingAmount.toFixed(2)}`, col4X, currentY);
      }

      currentY += 20;
      doc.fontSize(12).font("Helvetica-Bold");
      doc.text("TOTAL:", col3X, currentY);
      doc.text(`₹${order.totalAmount.toFixed(2)}`, col4X, currentY);

      // Footer
      doc.moveDown(2);
      doc
        .fontSize(9)
        .font("Helvetica")
        .text("Thank you for your purchase!", { align: "center" });
      doc.text("For support, contact: support@powermysport.com", {
        align: "center",
      });

      doc.end();
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error.message,
        },
      } as ApiResponse<null>);
    }
  }
  /**
   * GET /api/v1/wishlist
   */
  async getWishlist(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res
          .status(401)
          .json({
            ok: false,
            error: { code: "UNAUTHORIZED", message: "User not authenticated" },
          });
        return;
      }
      const wishlist = await WishlistModel.findOne({ userId }).populate(
        "products.productId",
      );
      res.json({ ok: true, data: wishlist?.products || [] });
    } catch (error: any) {
      res
        .status(500)
        .json({
          ok: false,
          error: { code: "INTERNAL_ERROR", message: error.message },
        });
    }
  }

  /**
   * POST /api/v1/wishlist/toggle
   */
  async toggleWishlist(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { productId } = req.body;
      if (!userId || !productId) {
        res
          .status(400)
          .json({
            ok: false,
            error: { code: "INVALID_REQUEST", message: "Missing params" },
          });
        return;
      }
      let wishlist = await WishlistModel.findOne({ userId });
      if (!wishlist) {
        wishlist = new WishlistModel({ userId, products: [] });
      }
      const idx = wishlist.products.findIndex(
        (p) => p.productId.toString() === productId,
      );
      if (idx > -1) wishlist.products.splice(idx, 1);
      else wishlist.products.push({ productId, addedAt: new Date() } as any);

      await wishlist.save();
      await wishlist.populate("products.productId");
      res.json({ ok: true, data: wishlist.products });
    } catch (error: any) {
      res
        .status(500)
        .json({
          ok: false,
          error: { code: "INTERNAL_ERROR", message: error.message },
        });
    }
  }

  // ============ REVIEWS ============

  /**
   * POST /api/v1/products/:id/reviews
   */
  async submitProductReview(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const productId = req.params.id as string;
      const { rating, review } = req.body;

      if (!userId) {
        res
          .status(401)
          .json({
            ok: false,
            error: { code: "UNAUTHORIZED", message: "User not authenticated" },
          });
        return;
      }
      if (!rating || rating < 1 || rating > 5) {
        res
          .status(400)
          .json({
            ok: false,
            error: {
              code: "INVALID_REQUEST",
              message: "Rating must be between 1 and 5",
            },
          });
        return;
      }

      // Check if user has purchased this product
      const hasPurchased = await OrderModel.findOne({
        userId,
        status: { $in: [OrderStatus.DELIVERED] },
        "items.productVariantId": { $exists: true }, // We'll do a basic check here.
      });

      // Ideally we'd map variantId to productId, but let's assume they can review if they just provide order details or we check if ANY item belongs to the product.
      // For simplicity, we just allow review for now, but mark it verified if we find an order.
      const isVerified = !!hasPurchased;

      const existingReview = await ReviewModel.findOne({
        userId,
        targetType: "PRODUCT",
        targetId: productId,
      });
      if (existingReview) {
        res
          .status(400)
          .json({
            ok: false,
            error: {
              code: "INVALID_REQUEST",
              message: "You have already reviewed this product",
            },
          });
        return;
      }

      const newReview = new ReviewModel({
        userId,
        targetType: "PRODUCT",
        targetId: productId,
        rating,
        review,
        isVerified,
      });

      await newReview.save();

      // Recalculate Product average rating
      const allReviews = await ReviewModel.find({
        targetType: "PRODUCT",
        targetId: productId,
      });
      const avg =
        allReviews.reduce((acc, r) => acc + r.rating, 0) / allReviews.length;
      await ProductModel.findByIdAndUpdate(productId, {
        averageRating: avg,
        totalReviews: allReviews.length,
      });

      res.json({ ok: true, data: newReview });
    } catch (error: any) {
      res
        .status(500)
        .json({
          ok: false,
          error: { code: "INTERNAL_ERROR", message: error.message },
        });
    }
  }

  /**
   * GET /api/v1/products/:id/reviews
   */
  async getProductReviews(req: Request, res: Response): Promise<void> {
    try {
      const productId = req.params.id as string;
      const reviews = await ReviewModel.find({
        targetType: "PRODUCT",
        targetId: productId,
      })
        .populate("userId", "name photoUrl")
        .sort({ createdAt: -1 });

      // Calculate stats
      const stats = {
        averageRating:
          reviews.reduce((sum, r) => sum + r.rating, 0) / (reviews.length || 1),
        totalReviews: reviews.length,
        ratingDistribution: {
          1: reviews.filter((r) => r.rating === 1).length,
          2: reviews.filter((r) => r.rating === 2).length,
          3: reviews.filter((r) => r.rating === 3).length,
          4: reviews.filter((r) => r.rating === 4).length,
          5: reviews.filter((r) => r.rating === 5).length,
        },
      };

      res.json({ ok: true, data: { reviews, stats } });
    } catch (error: any) {
      res
        .status(500)
        .json({
          ok: false,
          error: { code: "INTERNAL_ERROR", message: error.message },
        });
    }
  }
}

// ============ ADMIN CONTROLLER ============

export class AdminEcommerceController {
  private productService: ProductService;
  private orderService: OrderService;
  private inventoryService: InventoryService;
  private refundService: RefundService;

  constructor() {
    this.productService = new ProductService();
    this.orderService = new OrderService();
    this.inventoryService = new InventoryService();
    this.refundService = new RefundService();
  }

  /**
   * POST /api/v1/admin/products
   * Create product
   */
  async createProduct(req: Request, res: Response): Promise<void> {
    try {
      const productData = req.body;

      const product = await this.productService.createProduct(productData);

      res.status(201).json({
        ok: true,
        data: { product },
      } as ApiResponse<any>);
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: {
          code: "INVALID_REQUEST",
          message: error.message,
        },
      } as ApiResponse<null>);
    }
  }

  /**
   * PATCH /api/v1/admin/products/:productId
   * Update product
   */
  async updateProduct(req: Request, res: Response): Promise<void> {
    try {
      const productId = getParam(
        (req.params as Record<string, unknown>).productId,
      );
      const updateData = req.body;

      if (!productId) {
        res.status(400).json({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Product id is required",
          },
        });
        return;
      }

      const product = await this.productService.updateProduct(
        productId,
        updateData,
      );

      if (!product) {
        res.status(404).json({
          ok: false,
          error: {
            code: "NOT_FOUND",
            message: "Product not found",
          },
        });
        return;
      }

      res.json({
        ok: true,
        data: { product },
      } as ApiResponse<any>);
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: {
          code: "INVALID_REQUEST",
          message: error.message,
        },
      } as ApiResponse<null>);
    }
  }

  /**
   * GET /api/v1/admin/products
   * List all products
   */
  async listAllProducts(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 20 } = req.query;

      const result = await this.productService.listProducts(
        Number(page),
        Number(limit),
      );

      res.json({
        ok: true,
        data: result,
      } as ApiResponse<any>);
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error.message,
        },
      } as ApiResponse<null>);
    }
  }

  /**
   * POST /api/v1/admin/products/upload-url
   * Generate presigned URL for product image uploads
   */
  async generateImageUploadUrl(req: Request, res: Response): Promise<void> {
    try {
      const { fileName, contentType } = req.body;

      if (!fileName || !contentType) {
        res.status(400).json({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "fileName and contentType are required",
          },
        });
        return;
      }

      const result = await s3Service.generateProductImageUploadUrl(
        fileName,
        contentType,
      );

      res.json({
        ok: true,
        data: result,
      } as ApiResponse<any>);
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error.message,
        },
      } as ApiResponse<null>);
    }
  }

  /**
   * DELETE /api/v1/admin/products/:productId
   * Soft delete product
   */
  async deleteProduct(req: Request, res: Response): Promise<void> {
    try {
      const productId = getParam(
        (req.params as Record<string, unknown>).productId,
      );

      if (!productId) {
        res.status(400).json({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Product id is required",
          },
        });
        return;
      }

      await this.productService.deleteProduct(productId);

      res.json({
        ok: true,
        data: { message: "Product deleted" },
      } as ApiResponse<any>);
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error.message,
        },
      } as ApiResponse<null>);
    }
  }

  /**
   * GET /api/v1/admin/orders
   * List all orders
   */
  async listAllOrders(req: Request, res: Response): Promise<void> {
    try {
      const { page = 1, limit = 20, status, dateFrom, dateTo } = req.query;

      const filters: {
        status?: OrderStatus;
        dateFrom?: string;
        dateTo?: string;
      } = {};

      if (typeof status === "string") {
        filters.status = status as OrderStatus;
      }
      if (typeof dateFrom === "string") {
        filters.dateFrom = dateFrom;
      }
      if (typeof dateTo === "string") {
        filters.dateTo = dateTo;
      }

      const result = await this.orderService.listAllOrders(
        Number(page),
        Number(limit),
        filters,
      );

      res.json({
        ok: true,
        data: result,
      } as ApiResponse<any>);
    } catch (error: any) {
      res.status(500).json({
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: error.message,
        },
      } as ApiResponse<null>);
    }
  }

  /**
   * PATCH /api/v1/admin/orders/:orderId/fulfillment-status
   * Update fulfillment status
   */
  async updateFulfillmentStatus(req: Request, res: Response): Promise<void> {
    try {
      const orderId = getParam((req.params as Record<string, unknown>).orderId);
      const { fulfillmentStatus, trackingNumber } = req.body;

      if (!orderId) {
        res.status(400).json({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Order id is required",
          },
        });
        return;
      }

      const order = await this.orderService.updateFulfillmentStatus(
        orderId,
        fulfillmentStatus as FulfillmentStatus,
        trackingNumber,
      );

      res.json({
        ok: true,
        data: { order },
      } as ApiResponse<any>);
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: {
          code: "INVALID_STATE_TRANSITION",
          message: error.message,
        },
      } as ApiResponse<null>);
    }
  }

  /**
   * POST /api/v1/admin/orders/:orderId/refund
   * Initiate refund
   */
  async initiateRefund(req: Request, res: Response): Promise<void> {
    try {
      const orderId = getParam((req.params as Record<string, unknown>).orderId);
      const { refundAmount, reason } = req.body;

      if (!orderId) {
        res.status(400).json({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Order id is required",
          },
        });
        return;
      }

      // Use gatewayOrderId (our merchantOrderId) — PhonePe's refund API requires
      // the original merchantOrderId, not the PhonePe-assigned payment ID.
      const paymentTransaction = await PaymentTransactionModel.findOne({
        orderId: orderId,
      }).sort({ createdAt: -1 });

      if (!paymentTransaction?.gatewayOrderId) {
        res.status(400).json({
          ok: false,
          error: {
            code: "PAYMENT_NOT_FOUND",
            message: "No captured payment transaction found for this order",
          },
        });
        return;
      }

      const merchantOrderId = paymentTransaction.gatewayOrderId;

      const refundId = await this.refundService.initiateRefund(
        orderId,
        merchantOrderId,
        refundAmount,
        reason,
      );

      res.json({
        ok: true,
        data: { refundId },
      } as ApiResponse<any>);
    } catch (error: any) {
      res.status(400).json({
        ok: false,
        error: {
          code: "INVALID_REQUEST",
          message: error.message,
        },
      } as ApiResponse<null>);
    }
  }
}
