import mongoose from "mongoose";
import { buildSafeSearchRegexSource } from "../../../utils/regex";
import {
  Inventory as InventoryModel,
  ProductDocument,
  Product as ProductModel,
} from "../../models/Ecommerce";

export class ProductService {
  /**
   * Get product by ID
   */
  async getProductById(productId: string): Promise<ProductDocument | null> {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return null;
    }
    return ProductModel.findById(productId);
  }

  /**
   * Get product by SKU
   */
  async getProductBySku(sku: string): Promise<ProductDocument | null> {
    return ProductModel.findOne({ sku: sku.toUpperCase() });
  }

  /**
   * List products with filters and pagination
   */
  async listProducts(
    page: number = 1,
    limit: number = 20,
    category?: string,
    search?: string,
    sortBy: string = "newest",
    brand?: string,
    rating?: number,
    minPrice?: number,
    maxPrice?: number,
    condition?: string,
    sellerType?: string
  ) {
    const query: any = {
      isActive: true,
    };

    if (category) {
      query.category = category;
    }

    if (brand) {
      query.brand = { $regex: new RegExp(`^${brand}$`, "i") };
    }

    if (rating !== undefined) {
      query.averageRating = { $gte: rating };
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      query.basePrice = {};
      if (minPrice !== undefined) query.basePrice.$gte = minPrice;
      if (maxPrice !== undefined) query.basePrice.$lte = maxPrice;
    }

    if (condition) {
      query.condition = condition;
    }

    if (sellerType) {
      query.sellerType = sellerType;
    }

    if (search) {
      query.$or = [
        { name: new RegExp(search, "i") },
        { description: new RegExp(search, "i") },
        { sku: new RegExp(search, "i") },
      ];
    }

    const sortOptions: Record<string, any> = {
      price_asc: { basePrice: 1 },
      price_desc: { basePrice: -1 },
      newest: { createdAt: -1 },
      popularity: { totalStock: -1 }, // Simple popularity metric
    };

    const sortField = sortOptions[sortBy] || sortOptions.newest;

    const skip = (page - 1) * limit;

    const products = await ProductModel.find(query).sort(sortField).skip(skip).limit(limit);

    const total = await ProductModel.countDocuments(query);

    // Facets power the filter sidebar. Categories are computed across the whole
    // active catalog (never scoped by the current category) so the shopper can
    // always switch between categories; brands and price range reflect the
    // current category/condition/seller context.
    const facetResult = await ProductModel.aggregate([
      { $match: { isActive: true } },
      {
        $facet: {
          categories: [{ $group: { _id: "$category" } }, { $sort: { _id: 1 } }],
          scoped: [
            {
              $match: {
                ...(category ? { category } : {}),
                ...(condition ? { condition } : {}),
                ...(sellerType ? { sellerType } : {}),
              },
            },
            {
              $group: {
                _id: null,
                brands: { $addToSet: "$brand" },
                minPrice: { $min: "$basePrice" },
                maxPrice: { $max: "$basePrice" },
              },
            },
          ],
        },
      },
    ]);

    const facetData = facetResult[0] || { categories: [], scoped: [] };
    const scopedFacets = facetData.scoped?.[0] || {};
    const availableFacets = {
      categories: (facetData.categories || [])
        .map((entry: { _id: string }) => entry._id)
        .filter(Boolean)
        .sort(),
      brands: (scopedFacets.brands || []).filter(Boolean).sort(),
      minPrice: scopedFacets.minPrice || 0,
      maxPrice: scopedFacets.maxPrice || 10000,
    };

    return {
      products,
      total,
      page,
      pages: Math.ceil(total / limit),
      facets: availableFacets,
    };
  }

  /**
   * List products for the admin catalog view — unlike listProducts(), this
   * includes inactive products and supports admin-relevant search/sort.
   */
  async listProductsForAdmin(
    page: number = 1,
    limit: number = 20,
    options?: {
      search?: string;
      isActive?: boolean;
      sortBy?: "name" | "basePrice" | "totalStock" | "createdAt";
      sortOrder?: "asc" | "desc";
    }
  ) {
    const query: any = {};

    if (typeof options?.isActive === "boolean") {
      query.isActive = options.isActive;
    }

    if (options?.search) {
      const safeSearch = buildSafeSearchRegexSource(options.search);
      query.$or = [
        { name: { $regex: safeSearch, $options: "i" } },
        { sku: { $regex: safeSearch, $options: "i" } },
      ];
    }

    const sortField = options?.sortBy || "createdAt";
    const sortDir = options?.sortOrder === "asc" ? 1 : -1;
    const skip = (page - 1) * limit;

    const [products, total] = await Promise.all([
      ProductModel.find(query)
        .sort({ [sortField]: sortDir })
        .skip(skip)
        .limit(limit),
      ProductModel.countDocuments(query),
    ]);

    return {
      products,
      total,
      page,
      pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get related products based on category and tags
   */
  async getRelatedProducts(productId: string, limit: number = 4): Promise<ProductDocument[]> {
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return [];
    }
    const product = await ProductModel.findById(productId);
    if (!product) return [];

    // Find products in the same category or with intersecting tags, excluding the current product
    const related = await ProductModel.find({
      _id: { $ne: product._id },
      isActive: true,
      $or: [{ category: product.category }, { tags: { $in: product.tags } }],
    })
      .sort({ averageRating: -1, totalReviews: -1 }) // Show best rated first
      .limit(limit);

    return related;
  }

  /**
   * Create product (admin)
   */
  async createProduct(productData: any): Promise<ProductDocument> {
    const product = new ProductModel(productData);
    await product.save();

    // Create inventory records for each variant
    for (const variant of product.variants) {
      const inventory = new InventoryModel({
        productVariantId: variant._id,
        quantityOnHand: variant.stock,
        quantityReserved: 0,
        quantityAvailable: variant.stock,
        reorderLevel: variant.reorderLevel,
      });
      await inventory.save();
    }

    return product;
  }

  /**
   * Update product (admin)
   */
  async updateProduct(productId: string, updateData: any): Promise<ProductDocument | null> {
    const product = await ProductModel.findById(productId);
    if (!product) return null;

    // Apply updates
    Object.assign(product, updateData);

    // Save product (which runs validation & pre-save hook for totalStock)
    await product.save();

    for (const variant of product.variants) {
      let inventory = await InventoryModel.findOne({
        productVariantId: variant._id,
      });
      if (inventory) {
        inventory.quantityOnHand = variant.stock;
        inventory.reorderLevel = variant.reorderLevel;
        await inventory.save();
      } else {
        inventory = new InventoryModel({
          productVariantId: variant._id,
          quantityOnHand: variant.stock,
          quantityReserved: 0,
          quantityAvailable: variant.stock,
          reorderLevel: variant.reorderLevel,
        });
        await inventory.save();
      }
    }

    return product;
  }

  /**
   * Soft delete product
   */
  async deleteProduct(productId: string): Promise<ProductDocument | null> {
    return ProductModel.findByIdAndUpdate(productId, { isActive: false }, { new: true });
  }
}
