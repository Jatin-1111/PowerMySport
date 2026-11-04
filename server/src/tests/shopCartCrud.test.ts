// Integration tests for the shop's cart CRUD — CartService. Same untested
// surface as shopProductCrud.test.ts: the cart is where inventory reservation
// actually happens (add/remove/update all move stock between "available" and
// "reserved"), and none of it had coverage before this.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";

import assert = require("node:assert/strict");
const { after, before, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { CartService } = require("../shop/services/EcommerceService/cartService");
const { ProductService } = require("../shop/services/EcommerceService/productService");
const { Inventory } = require("../shop/models/Ecommerce");
const redis = require("../config/redis").default;

let mongod: any;
const cartService = new CartService();
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
const nextSku = () => `CART-SKU-${(skuCounter++).toString().padStart(4, "0")}`;
const userId = () => new mongoose.Types.ObjectId().toString();

/** A product with one variant, price 1000 paise, taxRate 10%, given stock. */
const seedProduct = async (stock = 10, price = 1000) => {
  const sku = nextSku();
  const product = await productService.createProduct({
    sku,
    name: "Test Racket",
    description: "A test product.",
    category: "EQUIPMENT",
    images: ["https://cdn.example.com/racket.jpg"],
    basePrice: price,
    weight: 300,
    dimensions: { length: 68, width: 25, height: 3 },
    taxable: true,
    taxRate: 0.1,
    variants: [
      {
        sku: `${sku}-STD`,
        variantLabel: "Standard",
        attributes: new Map([["size", "27in"]]),
        price,
        stock,
        reorderLevel: 2,
      },
    ],
  });
  return { product, variantId: product.variants[0]._id.toString() };
};

describe("CartService — add item", () => {
  it("creates a cart and adds the item with a computed lineTotal", async () => {
    const { variantId } = await seedProduct(10, 1000);
    const uid = userId();

    const cart = await cartService.addItemToCart(uid, variantId, 2);

    assert.equal(cart.items.length, 1);
    assert.equal(cart.items[0].quantity, 2);
    assert.equal(cart.items[0].lineTotal, 2000);
    assert.equal(cart.subtotal, 2000);
    assert.equal(cart.taxAmount, 200); // 10% of 2000
    assert.equal(cart.totalAmount, 2200);
  });

  it("reserves inventory, reducing available quantity for subsequent adds", async () => {
    const { variantId } = await seedProduct(5, 1000);
    const uid = userId();

    await cartService.addItemToCart(uid, variantId, 3);

    const inventory = await Inventory.findOne({ productVariantId: variantId });
    assert.equal(inventory.quantityReserved, 3);
    assert.equal(inventory.quantityAvailable, 2);
  });

  it("adding the same variant again increments quantity instead of duplicating the line", async () => {
    const { variantId } = await seedProduct(10, 1000);
    const uid = userId();

    await cartService.addItemToCart(uid, variantId, 2);
    const cart = await cartService.addItemToCart(uid, variantId, 3);

    assert.equal(cart.items.length, 1);
    assert.equal(cart.items[0].quantity, 5);
    assert.equal(cart.items[0].lineTotal, 5000);
  });

  it("rejects a nonexistent product variant", async () => {
    const uid = userId();
    await assert.rejects(
      () => cartService.addItemToCart(uid, new mongoose.Types.ObjectId().toString(), 1),
      /not found/i
    );
  });

  it("rejects a quantity beyond what's available", async () => {
    const { variantId } = await seedProduct(2, 1000);
    const uid = userId();

    await assert.rejects(
      () => cartService.addItemToCart(uid, variantId, 3),
      /only 2 units available/i
    );
  });

  it("rejects growing an existing line past what's available", async () => {
    const { variantId } = await seedProduct(3, 1000);
    const uid = userId();

    await cartService.addItemToCart(uid, variantId, 2);
    // 1 unit remains available; asking for 2 more should fail without
    // reserving anything further.
    await assert.rejects(() => cartService.addItemToCart(uid, variantId, 2), /only 1 units/i);

    const inventory = await Inventory.findOne({ productVariantId: variantId });
    assert.equal(inventory.quantityReserved, 2);
  });
});

describe("CartService — remove item", () => {
  it("removes the item, releases reserved inventory, and recalculates totals", async () => {
    const { variantId } = await seedProduct(5, 1000);
    const uid = userId();

    const cart = await cartService.addItemToCart(uid, variantId, 2);
    const itemId = cart.items[0]._id.toString();

    const updated = await cartService.removeItemFromCart(uid, itemId);
    assert.equal(updated.items.length, 0);
    assert.equal(updated.subtotal, 0);
    assert.equal(updated.totalAmount, 0);

    const inventory = await Inventory.findOne({ productVariantId: variantId });
    assert.equal(inventory.quantityReserved, 0);
    assert.equal(inventory.quantityAvailable, 5);
  });

  it("throws when the user has no cart", async () => {
    await assert.rejects(
      () => cartService.removeItemFromCart(userId(), new mongoose.Types.ObjectId().toString()),
      /cart not found/i
    );
  });

  it("throws when the item isn't in the cart", async () => {
    const { variantId } = await seedProduct(5, 1000);
    const uid = userId();
    await cartService.addItemToCart(uid, variantId, 1);

    await assert.rejects(
      () => cartService.removeItemFromCart(uid, new mongoose.Types.ObjectId().toString()),
      /item not found/i
    );
  });
});

describe("CartService — update quantity", () => {
  it("increases quantity and reserves the additional units", async () => {
    const { variantId } = await seedProduct(10, 1000);
    const uid = userId();
    const cart = await cartService.addItemToCart(uid, variantId, 2);

    const updated = await cartService.updateItemQuantity(uid, cart.items[0]._id.toString(), 5);
    assert.equal(updated.items[0].quantity, 5);
    assert.equal(updated.items[0].lineTotal, 5000);

    const inventory = await Inventory.findOne({ productVariantId: variantId });
    assert.equal(inventory.quantityReserved, 5);
  });

  it("decreases quantity and releases the difference", async () => {
    const { variantId } = await seedProduct(10, 1000);
    const uid = userId();
    const cart = await cartService.addItemToCart(uid, variantId, 5);

    const updated = await cartService.updateItemQuantity(uid, cart.items[0]._id.toString(), 2);
    assert.equal(updated.items[0].quantity, 2);

    const inventory = await Inventory.findOne({ productVariantId: variantId });
    assert.equal(inventory.quantityReserved, 2);
    assert.equal(inventory.quantityAvailable, 8);
  });

  it("rejects a quantity below 1", async () => {
    const { variantId } = await seedProduct(10, 1000);
    const uid = userId();
    const cart = await cartService.addItemToCart(uid, variantId, 2);

    await assert.rejects(
      () => cartService.updateItemQuantity(uid, cart.items[0]._id.toString(), 0),
      /at least 1/i
    );
  });

  it("rejects increasing past available stock", async () => {
    const { variantId } = await seedProduct(3, 1000);
    const uid = userId();
    const cart = await cartService.addItemToCart(uid, variantId, 2);

    await assert.rejects(
      () => cartService.updateItemQuantity(uid, cart.items[0]._id.toString(), 10),
      /additional units available/i
    );
  });
});

describe("CartService — clear", () => {
  it("empties the cart and releases all reserved inventory", async () => {
    const { variantId } = await seedProduct(10, 1000);
    const uid = userId();
    await cartService.addItemToCart(uid, variantId, 4);

    await cartService.clearCart(uid);

    const cart = await cartService.getOrCreateCart(uid);
    assert.equal(cart.items.length, 0);
    assert.equal(cart.subtotal, 0);
    assert.equal(cart.totalAmount, 0);

    const inventory = await Inventory.findOne({ productVariantId: variantId });
    assert.equal(inventory.quantityReserved, 0);
  });

  it("is a no-op for a user with no cart yet", async () => {
    await assert.doesNotReject(() => cartService.clearCart(userId()));
  });
});

describe("CartService — promo codes", () => {
  it("applies a promo code and recomputes totalAmount", async () => {
    const { variantId } = await seedProduct(10, 1000);
    const uid = userId();
    await cartService.addItemToCart(uid, variantId, 2); // subtotal 2000, tax 200

    const cart = await cartService.applyPromoCode(uid, "SAVE100", 100);
    assert.equal(cart.appliedPromoCode, "SAVE100");
    assert.equal(cart.discountAmount, 100);
    assert.equal(cart.totalAmount, 2000 + 200 - 100);
  });

  it("rejects a discount larger than the subtotal", async () => {
    const { variantId } = await seedProduct(10, 1000);
    const uid = userId();
    await cartService.addItemToCart(uid, variantId, 1); // subtotal 1000

    await assert.rejects(
      () => cartService.applyPromoCode(uid, "TOO-BIG", 5000),
      /invalid discount/i
    );
  });

  it("removes a promo code and restores totalAmount", async () => {
    const { variantId } = await seedProduct(10, 1000);
    const uid = userId();
    await cartService.addItemToCart(uid, variantId, 2);
    await cartService.applyPromoCode(uid, "SAVE100", 100);

    const cart = await cartService.removePromoCode(uid);
    assert.equal(cart.appliedPromoCode, "");
    assert.equal(cart.discountAmount, 0);
    assert.equal(cart.totalAmount, 2000 + 200);
  });
});
