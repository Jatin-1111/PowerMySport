import { Request, Response } from "express";
import { ApiResponse } from "../../../types/ecommerce";
import { ProductService } from "../../services/EcommerceService";
import { getParam } from "./shared";

export class ProductsController {
  private productService: ProductService;

  constructor() {
    this.productService = new ProductService();
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
        sellerType as string
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
}
