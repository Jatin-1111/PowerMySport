// Integration tests for the shop's product CRUD — ProductService. This is
// the plain create/read/update/delete surface flagged as untested in the
// Phase 4 correctness sweep: every prior test touching shop code exercised a
// narrow security invariant (payment-amount matching, refund gating), not
// ordinary catalog management.
//
// Env must be set BEFORE the app modules are required (several read env at
// load time), so we use require() in source order rather than hoisted imports.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";

import assert = require("node:assert/strict");
const { after, before, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { ProductService } = require("../shop/services/EcommerceService/productService");
const { Product, Inventory } = require("../shop/models/Ecommerce");
const redis = require("../config/redis").default;

let mongod: any;
const productService = new ProductService();

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

let skuCounter = 0;
const nextSku = (prefix: string) => `${prefix}-${(skuCounter++).toString().padStart(4, "0")}`;

const buildProductInput = (overrides: Record<string, unknown> = {}) => {
  const sku = nextSku("BAT");
  return {
    sku,
    name: "Kookaburra English Willow Bat",
    description: "A full-size cricket bat.",
    category: "EQUIPMENT",
    images: ["https://cdn.example.com/bat.jpg"],
    basePrice: 5000,
    weight: 1200,
    dimensions: { length: 90, width: 12, height: 5 },
    taxable: true,
    taxRate: 0.18,
    variants: [
      {
        sku: `${sku}-STD`,
        variantLabel: "Standard",
        attributes: new Map([["size", "Short Handle"]]),
        price: 5000,
        stock: 10,
        reorderLevel: 2,
      },
    ],
    ...overrides,
  };
};

describe("ProductService — create", () => {
  it("creates a product and computes totalStock from its variants", async () => {
    const product = await productService.createProduct(buildProductInput());

    assert.ok(product._id);
    assert.equal(product.name, "Kookaburra English Willow Bat");
    assert.equal(product.totalStock, 10);
    assert.equal(product.isActive, true);
  });

  it("uppercases the SKU on save", async () => {
    const input = buildProductInput({ sku: "lowercase-sku-001" });
    const product = await productService.createProduct(input);
    assert.equal(product.sku, "LOWERCASE-SKU-001");
  });

  it("sums stock across multiple variants into totalStock", async () => {
    const sku = nextSku("MULTI");
    const product = await productService.createProduct(
      buildProductInput({
        sku,
        variants: [
          {
            sku: `${sku}-S`,
            variantLabel: "Small",
            attributes: new Map([["size", "S"]]),
            price: 1000,
            stock: 4,
          },
          {
            sku: `${sku}-M`,
            variantLabel: "Medium",
            attributes: new Map([["size", "M"]]),
            price: 1000,
            stock: 7,
          },
        ],
      })
    );

    assert.equal(product.totalStock, 11);
  });

  it("creates an Inventory record per variant, seeded from variant stock", async () => {
    const product = await productService.createProduct(buildProductInput());
    const variantId = product.variants[0]._id;

    const inventory = await Inventory.findOne({ productVariantId: variantId });
    assert.ok(inventory);
    assert.equal(inventory.quantityOnHand, 10);
    assert.equal(inventory.quantityAvailable, 10);
    assert.equal(inventory.quantityReserved, 0);
  });

  it("rejects a product with no variants", async () => {
    await assert.rejects(() => productService.createProduct(buildProductInput({ variants: [] })));
  });

  it("rejects a duplicate SKU", async () => {
    const sku = nextSku("DUPE");
    await productService.createProduct(buildProductInput({ sku }));
    await assert.rejects(() => productService.createProduct(buildProductInput({ sku })));
  });
});

describe("ProductService — read", () => {
  it("getProductById returns the product", async () => {
    const created = await productService.createProduct(buildProductInput());
    const found = await productService.getProductById(created._id.toString());
    assert.ok(found);
    assert.equal(found!.sku, created.sku);
  });

  it("getProductById returns null for a malformed id instead of throwing", async () => {
    const found = await productService.getProductById("not-a-valid-object-id");
    assert.equal(found, null);
  });

  it("getProductById returns null for a well-formed but nonexistent id", async () => {
    const found = await productService.getProductById(new mongoose.Types.ObjectId().toString());
    assert.equal(found, null);
  });

  it("getProductBySku looks up case-insensitively (SKUs are stored uppercase)", async () => {
    const input = buildProductInput({ sku: "case-test-sku" });
    await productService.createProduct(input);
    const found = await productService.getProductBySku("case-test-sku");
    assert.ok(found);
    assert.equal(found!.sku, "CASE-TEST-SKU");
  });
});

describe("ProductService — update", () => {
  it("persists field updates", async () => {
    const created = await productService.createProduct(buildProductInput());
    const updated = await productService.updateProduct(created._id.toString(), {
      basePrice: 6000,
      name: "Kookaburra English Willow Bat — Pro Edition",
    });

    assert.ok(updated);
    assert.equal(updated!.basePrice, 6000);
    assert.equal(updated!.name, "Kookaburra English Willow Bat — Pro Edition");
  });

  it("returns null for a nonexistent product instead of throwing", async () => {
    const updated = await productService.updateProduct(new mongoose.Types.ObjectId().toString(), {
      basePrice: 1,
    });
    assert.equal(updated, null);
  });

  it("recomputes totalStock and syncs the existing Inventory record when variant stock changes", async () => {
    const created = await productService.createProduct(buildProductInput());
    const variantId = created.variants[0]._id.toString();

    const updated = await productService.updateProduct(created._id.toString(), {
      variants: [
        {
          ...created.variants[0].toObject(),
          _id: variantId,
          stock: 25,
        },
      ],
    });

    assert.equal(updated!.totalStock, 25);
    const inventory = await Inventory.findOne({ productVariantId: variantId });
    assert.equal(inventory.quantityOnHand, 25);
  });

  it("creates a new Inventory record for a variant added on update", async () => {
    const created = await productService.createProduct(buildProductInput());
    const sku = created.sku;

    const updated = await productService.updateProduct(created._id.toString(), {
      variants: [
        created.variants[0].toObject(),
        {
          sku: `${sku}-LH`,
          variantLabel: "Left Handed",
          attributes: new Map([["hand", "left"]]),
          price: 5200,
          stock: 3,
          reorderLevel: 2,
        },
      ],
    });

    assert.equal(updated!.variants.length, 2);
    assert.equal(updated!.totalStock, 13); // 10 (original) + 3 (new variant)

    const newVariantId = updated!.variants[1]._id;
    const inventory = await Inventory.findOne({ productVariantId: newVariantId });
    assert.ok(inventory);
    assert.equal(inventory.quantityOnHand, 3);
  });
});

describe("ProductService — delete (soft)", () => {
  it("marks the product inactive rather than removing it", async () => {
    const created = await productService.createProduct(buildProductInput());
    const deleted = await productService.deleteProduct(created._id.toString());

    assert.ok(deleted);
    assert.equal(deleted!.isActive, false);

    // The record still exists — this is a soft delete.
    const stillThere = await Product.findById(created._id);
    assert.ok(stillThere);
    assert.equal(stillThere.isActive, false);
  });

  it("returns null for a nonexistent product instead of throwing", async () => {
    const deleted = await productService.deleteProduct(new mongoose.Types.ObjectId().toString());
    assert.equal(deleted, null);
  });
});

describe("ProductService — listing", () => {
  it("listProducts only returns active products", async () => {
    const active = await productService.createProduct(
      buildProductInput({ sku: nextSku("ACTIVE") })
    );
    const toDeactivate = await productService.createProduct(
      buildProductInput({ sku: nextSku("INACTIVE") })
    );
    await productService.deleteProduct(toDeactivate._id.toString());

    const result = await productService.listProducts(1, 50);
    const ids = result.products.map((p: any) => p._id.toString());

    assert.ok(ids.includes(active._id.toString()));
    assert.ok(!ids.includes(toDeactivate._id.toString()));
  });

  it("listProducts filters by category", async () => {
    const equipment = await productService.createProduct(
      buildProductInput({ sku: nextSku("EQ"), category: "EQUIPMENT" })
    );
    const apparel = await productService.createProduct(
      buildProductInput({ sku: nextSku("AP"), category: "APPAREL" })
    );

    const result = await productService.listProducts(1, 50, "APPAREL");
    const ids = result.products.map((p: any) => p._id.toString());

    assert.ok(ids.includes(apparel._id.toString()));
    assert.ok(!ids.includes(equipment._id.toString()));
  });

  it("listProducts respects pagination (page/limit/total/pages)", async () => {
    for (let i = 0; i < 3; i++) {
      await productService.createProduct(buildProductInput({ sku: nextSku("PAGE") }));
    }

    const result = await productService.listProducts(1, 2, undefined, "PAGE");
    assert.equal(result.products.length, 2);
    assert.equal(result.page, 1);
    assert.ok(result.total >= 3);
    assert.ok(result.pages >= 2);
  });

  it("listProductsForAdmin includes inactive products", async () => {
    const inactive = await productService.createProduct(
      buildProductInput({ sku: nextSku("ADMIN-INACTIVE") })
    );
    await productService.deleteProduct(inactive._id.toString());

    const result = await productService.listProductsForAdmin(1, 50, { search: "ADMIN-INACTIVE" });
    const ids = result.products.map((p: any) => p._id.toString());
    assert.ok(ids.includes(inactive._id.toString()));
  });
});
