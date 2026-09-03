import { Request, Response } from "express";
import { ProductsController } from "./ecommerceController/products";
import { CartController } from "./ecommerceController/cart";
import { OrdersController } from "./ecommerceController/orders";
import { WishlistReviewsController } from "./ecommerceController/wishlistReviews";
import { AdminProductsController } from "./ecommerceController/adminProducts";
import { AdminOrdersController } from "./ecommerceController/adminOrders";

// This file used to hold ~1680 lines of method bodies directly. The
// implementation was split (2026-09) out into src/shop/controllers/ecommerceController/
// — one class per concern (products, cart, orders, wishlistReviews,
// adminProducts, adminOrders) — to keep it reviewable. `EcommerceController`
// and `AdminEcommerceController` below are now thin delegators that compose
// those classes, so every method call, `new EcommerceController()` /
// `new AdminEcommerceController()` in ecommerceRoutes.ts, and route wiring
// keep working unchanged.

// ============ CUSTOMER CONTROLLER ============

export class EcommerceController {
  private products = new ProductsController();
  private cart = new CartController();
  private orders = new OrdersController();
  private wishlistReviews = new WishlistReviewsController();

  async listProducts(req: Request, res: Response): Promise<void> {
    return this.products.listProducts(req, res);
  }

  async getProduct(req: Request, res: Response): Promise<void> {
    return this.products.getProduct(req, res);
  }

  async getRelatedProducts(req: Request, res: Response): Promise<void> {
    return this.products.getRelatedProducts(req, res);
  }

  async getCart(req: Request, res: Response): Promise<void> {
    return this.cart.getCart(req, res);
  }

  async addToCart(req: Request, res: Response): Promise<void> {
    return this.cart.addToCart(req, res);
  }

  async removeFromCart(req: Request, res: Response): Promise<void> {
    return this.cart.removeFromCart(req, res);
  }

  async clearCart(req: Request, res: Response): Promise<void> {
    return this.cart.clearCart(req, res);
  }

  async applyPromo(req: Request, res: Response): Promise<void> {
    return this.cart.applyPromo(req, res);
  }

  async createOrderFromCart(req: Request, res: Response): Promise<void> {
    return this.orders.createOrderFromCart(req, res);
  }

  async verifyPayment(req: Request, res: Response): Promise<void> {
    return this.orders.verifyPayment(req, res);
  }

  async syncPayment(req: Request, res: Response): Promise<void> {
    return this.orders.syncPayment(req, res);
  }

  async getOrder(req: Request, res: Response): Promise<void> {
    return this.orders.getOrder(req, res);
  }

  async listOrders(req: Request, res: Response): Promise<void> {
    return this.orders.listOrders(req, res);
  }

  async cancelOrder(req: Request, res: Response): Promise<void> {
    return this.orders.cancelOrder(req, res);
  }

  async downloadOrderInvoice(req: Request, res: Response): Promise<void> {
    return this.orders.downloadOrderInvoice(req, res);
  }

  async getWishlist(req: Request, res: Response): Promise<void> {
    return this.wishlistReviews.getWishlist(req, res);
  }

  async toggleWishlist(req: Request, res: Response): Promise<void> {
    return this.wishlistReviews.toggleWishlist(req, res);
  }

  async submitProductReview(req: Request, res: Response): Promise<void> {
    return this.wishlistReviews.submitProductReview(req, res);
  }

  async getProductReviews(req: Request, res: Response): Promise<void> {
    return this.wishlistReviews.getProductReviews(req, res);
  }
}

// ============ ADMIN CONTROLLER ============

export class AdminEcommerceController {
  private adminProducts = new AdminProductsController();
  private adminOrders = new AdminOrdersController();

  async createProduct(req: Request, res: Response): Promise<void> {
    return this.adminProducts.createProduct(req, res);
  }

  async updateProduct(req: Request, res: Response): Promise<void> {
    return this.adminProducts.updateProduct(req, res);
  }

  async listAllProducts(req: Request, res: Response): Promise<void> {
    return this.adminProducts.listAllProducts(req, res);
  }

  async generateImageUploadUrl(req: Request, res: Response): Promise<void> {
    return this.adminProducts.generateImageUploadUrl(req, res);
  }

  async deleteProduct(req: Request, res: Response): Promise<void> {
    return this.adminProducts.deleteProduct(req, res);
  }

  async listAllOrders(req: Request, res: Response): Promise<void> {
    return this.adminOrders.listAllOrders(req, res);
  }

  async getOrderDetail(req: Request, res: Response): Promise<void> {
    return this.adminOrders.getOrderDetail(req, res);
  }

  async updateFulfillmentStatus(req: Request, res: Response): Promise<void> {
    return this.adminOrders.updateFulfillmentStatus(req, res);
  }

  async initiateRefund(req: Request, res: Response): Promise<void> {
    return this.adminOrders.initiateRefund(req, res);
  }
}
