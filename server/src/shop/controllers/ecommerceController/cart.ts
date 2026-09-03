import { Request, Response } from "express";
import { validatePromoCode } from "../../../client/services/PromoCodeService";
import { ApiResponse } from "../../../types/ecommerce";
import { CartService } from "../../services/EcommerceService";

export class CartController {
  private cartService: CartService;

  constructor() {
    this.cartService = new CartService();
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

      const cart = await this.cartService.addItemToCart(userId, productVariantId, quantity);

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

      const cart = await this.cartService.removeItemFromCart(userId, cartItemId);

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

      const promoValidation = await validatePromoCode(promoCode, userId, cart.subtotal, {
        context: "MERCHANDISE",
      });

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
        promoValidation.discountAmount
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
}
