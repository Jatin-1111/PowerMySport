import { Request, Response } from "express";
import { Review as ReviewModel } from "../../../client/models/Review";
import { OrderStatus } from "../../../types/ecommerce";
import {
  Order as OrderModel,
  Product as ProductModel,
  Wishlist as WishlistModel,
} from "../../models/Ecommerce";

export class WishlistReviewsController {
  /**
   * GET /api/v1/wishlist
   */
  async getWishlist(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          ok: false,
          error: { code: "UNAUTHORIZED", message: "User not authenticated" },
        });
        return;
      }
      const wishlist = await WishlistModel.findOne({ userId }).populate("products.productId");
      res.json({ ok: true, data: wishlist?.products || [] });
    } catch (error: any) {
      res.status(500).json({
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
        res.status(400).json({
          ok: false,
          error: { code: "INVALID_REQUEST", message: "Missing params" },
        });
        return;
      }
      let wishlist = await WishlistModel.findOne({ userId });
      if (!wishlist) {
        wishlist = new WishlistModel({ userId, products: [] });
      }
      const idx = wishlist.products.findIndex((p) => p.productId.toString() === productId);
      if (idx > -1) wishlist.products.splice(idx, 1);
      else wishlist.products.push({ productId, addedAt: new Date() } as any);

      await wishlist.save();
      await wishlist.populate("products.productId");
      res.json({ ok: true, data: wishlist.products });
    } catch (error: any) {
      res.status(500).json({
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
        res.status(401).json({
          ok: false,
          error: { code: "UNAUTHORIZED", message: "User not authenticated" },
        });
        return;
      }
      if (!rating || rating < 1 || rating > 5) {
        res.status(400).json({
          ok: false,
          error: {
            code: "INVALID_REQUEST",
            message: "Rating must be between 1 and 5",
          },
        });
        return;
      }

      // Verify the user actually purchased THIS product (a DELIVERED order
      // containing one of this product's variants) before marking the review a
      // verified purchase — previously any delivered order of anything counted.
      const product = await ProductModel.findById(productId).select("variants._id");
      if (!product) {
        res.status(404).json({
          ok: false,
          error: { code: "NOT_FOUND", message: "Product not found" },
        });
        return;
      }
      const variantIds = product.variants.map((v: any) => v._id);
      const hasPurchased = await OrderModel.findOne({
        userId,
        status: OrderStatus.DELIVERED,
        "items.productVariantId": { $in: variantIds },
      });
      const isVerified = !!hasPurchased;

      const existingReview = await ReviewModel.findOne({
        userId,
        targetType: "PRODUCT",
        targetId: productId,
      });
      if (existingReview) {
        res.status(400).json({
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
      const avg = allReviews.reduce((acc, r) => acc + r.rating, 0) / allReviews.length;
      await ProductModel.findByIdAndUpdate(productId, {
        averageRating: avg,
        totalReviews: allReviews.length,
      });

      res.json({ ok: true, data: newReview });
    } catch (error: any) {
      res.status(500).json({
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
        averageRating: reviews.reduce((sum, r) => sum + r.rating, 0) / (reviews.length || 1),
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
      res.status(500).json({
        ok: false,
        error: { code: "INTERNAL_ERROR", message: error.message },
      });
    }
  }
}
