import { Router, Request, Response } from "express";
import {
  EcommerceController,
  AdminEcommerceController,
} from "../controllers/EcommerceController";
import { WebhookController } from "../../shared/controllers/WebhookController";
import { joinWaitlist } from "../controllers/WaitlistController";
import { authMiddleware, requirePermission } from "../../middleware/auth";
import { cacheResponse } from "../../middleware/cacheMiddleware";

const router = Router();
const controller = new EcommerceController();
const adminController = new AdminEcommerceController();
const webhookController = new WebhookController();

// ============ PUBLIC CATALOG ROUTES ============

/**
 * GET /api/v1/products
 * List products
 */
router.get("/products", cacheResponse(300), (req: Request, res: Response) =>
  controller.listProducts(req, res),
);

/**
 * POST /api/v1/waitlist
 * Join waitlist for shop
 */
router.post("/waitlist", joinWaitlist);

/**
 * GET /api/v1/products/:id
 * Get product details
 */
router.get("/products/:id", cacheResponse(300), (req: Request, res: Response) =>
  controller.getProduct(req, res),
);

// ============ AUTHENTICATED CUSTOMER ROUTES ============

/**
 * GET /api/v1/cart
 * Get current user's cart
 */
router.get("/cart", authMiddleware, (req: Request, res: Response) =>
  controller.getCart(req, res),
);

/**
 * POST /api/v1/cart/add-item
 * Add item to cart
 */
router.post("/cart/add-item", authMiddleware, (req: Request, res: Response) =>
  controller.addToCart(req, res),
);

/**
 * POST /api/v1/cart/remove-item
 * Remove item from cart
 */
router.post(
  "/cart/remove-item",
  authMiddleware,
  (req: Request, res: Response) => controller.removeFromCart(req, res),
);

/**
 * POST /api/v1/cart/clear
 * Clear entire cart
 */
router.post("/cart/clear", authMiddleware, (req: Request, res: Response) =>
  controller.clearCart(req, res),
);

/**
 * POST /api/v1/cart/apply-promo
 * Apply promo code
 */
router.post(
  "/cart/apply-promo",
  authMiddleware,
  (req: Request, res: Response) => controller.applyPromo(req, res),
);

// ============ CHECKOUT & PAYMENT ROUTES ============

/**
 * POST /api/v1/orders/create-from-cart
 * Create order and initiate payment
 */
router.post(
  "/orders/create-from-cart",
  authMiddleware,
  (req: Request, res: Response) => controller.createOrderFromCart(req, res),
);

/**
 * POST /api/v1/orders/:orderId/verify-payment
 * Verify payment signature and confirm order
 */
router.post(
  "/orders/:orderId/verify-payment",
  authMiddleware,
  (req: Request, res: Response) => controller.verifyPayment(req, res),
);

// ============ ORDER ROUTES ============

/**
 * GET /api/v1/orders/:orderId
 * Get order details
 */
router.get("/orders/:orderId", authMiddleware, (req: Request, res: Response) =>
  controller.getOrder(req, res),
);

/**
 * GET /api/v1/orders
 * List user's orders
 */
router.get("/orders", authMiddleware, (req: Request, res: Response) =>
  controller.listOrders(req, res),
);

/**
 * POST /api/v1/orders/:orderId/cancel
 * Cancel order
 */
router.post(
  "/orders/:orderId/cancel",
  authMiddleware,
  (req: Request, res: Response) => controller.cancelOrder(req, res),
);

// ============ ADMIN PRODUCT MANAGEMENT ROUTES ============

/**
 * POST /api/v1/admin/products
 * Create product
 */
router.post(
  "/admin/products",
  authMiddleware,
  requirePermission("products:create"),
  (req: Request, res: Response) => adminController.createProduct(req, res),
);

/**
 * PATCH /api/v1/admin/products/:productId
 * Update product
 */
router.patch(
  "/admin/products/:productId",
  authMiddleware,
  requirePermission("products:manage"),
  (req: Request, res: Response) => adminController.updateProduct(req, res),
);

/**
 * GET /api/v1/admin/products
 * List all products
 */
router.get(
  "/admin/products",
  authMiddleware,
  requirePermission("products:view"),
  (req: Request, res: Response) => adminController.listAllProducts(req, res),
);

/**
 * DELETE /api/v1/admin/products/:productId
 * Delete product
 */
router.delete(
  "/admin/products/:productId",
  authMiddleware,
  requirePermission("products:manage"),
  (req: Request, res: Response) => adminController.deleteProduct(req, res),
);

// ============ ADMIN ORDER MANAGEMENT ROUTES ============

/**
 * GET /api/v1/admin/orders
 * List all orders with filters
 */
router.get(
  "/admin/orders",
  authMiddleware,
  requirePermission("orders:view"),
  (req: Request, res: Response) => adminController.listAllOrders(req, res),
);

/**
 * PATCH /api/v1/admin/orders/:orderId/fulfillment-status
 * Update order fulfillment status
 */
router.patch(
  "/admin/orders/:orderId/fulfillment-status",
  authMiddleware,
  requirePermission("orders:manage"),
  (req: Request, res: Response) =>
    adminController.updateFulfillmentStatus(req, res),
);

/**
 * POST /api/v1/admin/orders/:orderId/refund
 * Initiate refund
 */
router.post(
  "/admin/orders/:orderId/refund",
  authMiddleware,
  requirePermission("orders:refund"),
  (req: Request, res: Response) => adminController.initiateRefund(req, res),
);

// ============ WEBHOOK ROUTES ============

/**
 * POST /api/v1/webhooks/phonepe
 * PhonePe webhook - NO AUTH required
 */
router.post("/webhooks/phonepe", (req: Request, res: Response) => {
  webhookController.handlePhonePeWebhook(req, res);
});

export default router;
