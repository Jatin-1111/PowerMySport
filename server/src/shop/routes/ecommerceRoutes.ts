import { Router, Request, Response } from "express";
import {
  EcommerceController,
  AdminEcommerceController,
} from "../controllers/EcommerceController";
import { SellerController } from "../controllers/SellerController";
import { WebhookController } from "../../shared/controllers/WebhookController";
import { joinWaitlist } from "../controllers/WaitlistController";
import { authMiddleware, requirePermission } from "../../middleware/auth";
import { cacheResponse } from "../../middleware/cacheMiddleware";

const router = Router();
const controller = new EcommerceController();
const adminController = new AdminEcommerceController();
const sellerController = new SellerController();
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

/**
 * GET /api/v1/products/:id/related
 * Get related products
 */
router.get("/products/:id/related", cacheResponse(300), (req: Request, res: Response) =>
  controller.getRelatedProducts(req, res),
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

// ============ REVIEWS ROUTES ============

router.get("/products/:id/reviews", cacheResponse(300), (req: Request, res: Response) =>
  controller.getProductReviews(req, res),
);

router.post("/products/:id/reviews", authMiddleware, (req: Request, res: Response) =>
  controller.submitProductReview(req, res),
);

// ============ WISHLIST ROUTES ============

router.get("/wishlist", authMiddleware, (req: Request, res: Response) =>
  controller.getWishlist(req, res),
);

router.post("/wishlist/toggle", authMiddleware, (req: Request, res: Response) =>
  controller.toggleWishlist(req, res),
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
 * POST /api/v1/admin/products/upload-url
 * Generate presigned URL for image upload
 */
router.post(
  "/admin/products/upload-url",
  authMiddleware,
  requirePermission("products:create"),
  (req: Request, res: Response) => adminController.generateImageUploadUrl(req, res),
);

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

// ============ SELLER/MARKETPLACE ROUTES ============

/**
 * GET /api/v1/seller/products
 * List logged-in seller's products
 */
router.get("/seller/products", authMiddleware, (req: Request, res: Response) =>
  sellerController.listSellerProducts(req, res)
);

/**
 * POST /api/v1/seller/products
 * List a new product for sale (merchant or P2P)
 */
router.post("/seller/products", authMiddleware, (req: Request, res: Response) =>
  sellerController.createSellerProduct(req, res)
);

/**
 * PATCH /api/v1/seller/products/:productId
 * Update a seller's product listing
 */
router.patch("/seller/products/:productId", authMiddleware, (req: Request, res: Response) =>
  sellerController.updateSellerProduct(req, res)
);

/**
 * DELETE /api/v1/seller/products/:productId
 * Deactivate a seller's product listing
 */
router.delete("/seller/products/:productId", authMiddleware, (req: Request, res: Response) =>
  sellerController.deleteSellerProduct(req, res)
);

/**
 * GET /api/v1/seller/orders
 * List orders received for seller's items
 */
router.get("/seller/orders", authMiddleware, (req: Request, res: Response) =>
  sellerController.listSellerOrders(req, res)
);

/**
 * PATCH /api/v1/seller/orders/:orderId/items/:productVariantId/fulfillment
 * Update fulfillment status/tracking of a seller's order item
 */
router.patch(
  "/seller/orders/:orderId/items/:productVariantId/fulfillment",
  authMiddleware,
  (req: Request, res: Response) =>
    sellerController.updateSellerOrderItemFulfillment(req, res)
);

export default router;
