import { Request, Response } from "express";
import { s3Service } from "../../../shared/services/S3Service";
import { ApiResponse } from "../../../types/ecommerce";
import { ProductService } from "../../services/EcommerceService";
import { getParam } from "./shared";

export class AdminProductsController {
  private productService: ProductService;

  constructor() {
    this.productService = new ProductService();
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
      const productId = getParam((req.params as Record<string, unknown>).productId);
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

      const product = await this.productService.updateProduct(productId, updateData);

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
      const { page = 1, limit = 20, search, isActive, sortBy, sortOrder } = req.query;

      const options: {
        search?: string;
        isActive?: boolean;
        sortBy?: "name" | "basePrice" | "totalStock" | "createdAt";
        sortOrder?: "asc" | "desc";
      } = {};

      if (typeof search === "string") {
        options.search = search;
      }
      if (isActive === "true") {
        options.isActive = true;
      } else if (isActive === "false") {
        options.isActive = false;
      }
      if (
        sortBy === "name" ||
        sortBy === "basePrice" ||
        sortBy === "totalStock" ||
        sortBy === "createdAt"
      ) {
        options.sortBy = sortBy;
      }
      if (sortOrder === "asc" || sortOrder === "desc") {
        options.sortOrder = sortOrder;
      }

      const result = await this.productService.listProductsForAdmin(
        Number(page),
        Number(limit),
        options
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

      const result = await s3Service.generateProductImageUploadUrl(fileName, contentType);

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
      const productId = getParam((req.params as Record<string, unknown>).productId);

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
}
