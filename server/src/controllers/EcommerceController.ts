import { Request, Response } from "express";
import {
  CartService,
  OrderService,
  ProductService,
  InventoryService,
} from "../services/EcommerceService";
import { PaymentService, RefundService } from "../services/PaymentService";
import {
  OrderStatus,
  PaymentGateway,
  FulfillmentStatus,
  ApiResponse,
} from "../types/ecommerce";
import { v4 as uuidv4 } from "uuid";
import { validatePromoCode } from "../services/PromoCodeService";

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
    this.paymentService = new PaymentService(PaymentGateway.RAZORPAY);
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
      } = req.query;

      const result = await this.productService.listProducts(
        Number(page),
        Number(limit),
        category as string,
        search as string,
        sortBy as string,
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
        PaymentGateway.RAZORPAY,
      );

      // Initiate payment
      const idempotencyKey = uuidv4();
      const paymentTx = await this.paymentService.initiatePayment(
        order._id.toString(),
        order.totalAmount,
        "INR",
        idempotencyKey,
        PaymentGateway.RAZORPAY,
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
          paymentConfig: {
            razorpayOrderId: paymentTx.gatewayOrderId,
            amount: order.totalAmount,
            currency: "INR",
            key: process.env.RAZORPAY_KEY_ID,
            description: `Order ${order.orderNumber} - PowerMySport`,
            prefill: {
              name: shippingAddress.fullName,
              email: shippingAddress.email,
              contact: shippingAddress.phone,
            },
          },
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
      const { razorpay_payment_id, razorpay_order_id, razorpay_signature } =
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

      if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
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
        razorpay_payment_id,
        razorpay_order_id,
        razorpay_signature,
      );

      // Confirm order payment
      const order = await this.orderService.confirmPayment(
        orderId,
        razorpay_payment_id,
        razorpay_order_id,
      );

      // TODO: Emit notification via NotificationService

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

      // TODO: Get paymentId from order
      const paymentId = "mock_payment_id";

      const refundId = await this.refundService.initiateRefund(
        orderId,
        paymentId,
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
