/* eslint-disable @typescript-eslint/no-var-requires */
// Integration tests for the DB-dependent security fixes. Uses an in-memory
// MongoDB and stubs the PhonePe gateway, so nothing external is touched.
//
// Env must be set BEFORE the app modules are required (several read env at load
// time), so we use require() in source order rather than hoisted imports.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";

import assert = require("node:assert/strict");
const { after, before, describe, it, mock } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const PhonePeService = require("../shared/services/PhonePeService");
const { cancelBooking } = require("../client/services/BookingService");
const { updateVenue, deleteVenue } = require("../client/services/VenueService");
const { WalletService } = require("../client/services/WalletService");
const { OrderService } = require("../shop/services/EcommerceService");
const { RefundService } = require("../shared/services/PaymentService");
const { OrderStatus, PaymentStatus } = require("../types/ecommerce");
const { Booking } = require("../client/models/Booking");
const { Venue } = require("../client/models/Venue");
const { Wallet } = require("../client/models/Wallet");
const { Order, PaymentTransaction } = require("../shop/models/Ecommerce");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();

// Mutable PhonePe stubs (behaviour set per-test).
let statusStub: any = { state: "PENDING" };
let refundStub: any = { refundId: "R_TEST" };

let mongod: any;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  mock.method(PhonePeService, "getPhonePeOrderStatus", async () => statusStub);
  mock.method(PhonePeService, "initiatePhonePeRefund", async () => refundStub);
});

after(async () => {
  mock.restoreAll();
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

// ───────────────── C4: booking-cancel IDOR ─────────────────
describe("C4 — only the booking organizer can cancel", () => {
  const future = new Date(Date.now() + 1000 * 60 * 60 * 24 * 5); // +5 days

  const makeBooking = async (organizerId: any) => {
    const _id = oid();
    await Booking.collection.insertOne({
      _id,
      organizerId,
      venueId: oid(), // no Venue doc → notification block is skipped
      sport: "Badminton",
      date: future,
      startTime: "10:00",
      endTime: "11:00",
      totalAmount: 1000,
      status: "CONFIRMED",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return _id;
  };

  it("rejects a cancel by a non-owner and leaves the booking intact", async () => {
    const owner = oid();
    const attacker = oid();
    const id = await makeBooking(owner);

    await assert.rejects(
      cancelBooking(id.toString(), attacker.toString()),
      /not found or already cancelled/i,
    );

    const after = await Booking.collection.findOne({ _id: id });
    assert.equal(after.status, "CONFIRMED"); // unchanged
  });

  it("allows the owner to cancel", async () => {
    const owner = oid();
    const id = await makeBooking(owner);

    try {
      await cancelBooking(id.toString(), owner.toString());
    } catch {
      // ignore best-effort notification side effects in the test env
    }

    const after = await Booking.collection.findOne({ _id: id });
    assert.equal(after.status, "CANCELLED");
  });
});

// ───────────────── C5: venue edit/delete IDOR + field strip ─────────────────
describe("C5 — venue update/delete scoped to owner + protected fields stripped", () => {
  const makeVenue = async (ownerId: any) => {
    const _id = oid();
    await Venue.collection.insertOne({
      _id,
      ownerId,
      name: "Original Name",
      approvalStatus: "PENDING",
      isVerified: false,
      commissionRate: 10,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return _id;
  };

  it("does not let a non-owner update or delete a venue", async () => {
    const owner = oid();
    const attacker = oid();
    const id = await makeVenue(owner);

    const updated = await updateVenue(id.toString(), attacker.toString(), {
      name: "Hacked",
    });
    assert.equal(updated, null);

    const deleted = await deleteVenue(id.toString(), attacker.toString());
    assert.equal(deleted, null);

    const still = await Venue.collection.findOne({ _id: id });
    assert.equal(still.name, "Original Name");
  });

  it("lets the owner update allowed fields but strips protected ones", async () => {
    const owner = oid();
    const evil = oid();
    const id = await makeVenue(owner);

    const res = await updateVenue(id.toString(), owner.toString(), {
      name: "New Name",
      ownerId: evil, // must be ignored
      approvalStatus: "APPROVED", // must be ignored
      isVerified: true, // must be ignored
      commissionRate: 0, // must be ignored
    } as any);

    assert.ok(res, "owner update should succeed");
    assert.equal(res.name, "New Name"); // allowed field updated
    assert.equal(res.ownerId.toString(), owner.toString()); // NOT transferred to evil
    assert.equal(res.approvalStatus, "PENDING"); // protected field unchanged

    // Confirm the protected fields were stripped at the DB level too.
    const raw = await Venue.collection.findOne({ _id: id });
    assert.equal(raw.ownerId.toString(), owner.toString());
    assert.equal(raw.approvalStatus, "PENDING");
    assert.equal(raw.commissionRate, 10);
  });
});

// ───────────────── C3: wallet top-up amount verification ─────────────────
describe("C3 — wallet top-up only credits the amount actually paid", () => {
  const makeWallet = async (userId: any, ref: string, amountRupees: number) => {
    await Wallet.collection.insertOne({
      userId,
      balance: 0,
      transactions: [
        {
          id: "txn-" + ref,
          amount: amountRupees,
          status: "PENDING",
          reason: "Wallet Top Up",
          referenceId: ref,
        },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  it("rejects crediting when the settled amount differs", async () => {
    const userId = oid();
    await makeWallet(userId, "M_MISMATCH", 100); // expects 10000 paise
    statusStub = { state: "COMPLETED", amount: 9900 }; // underpaid

    await assert.rejects(
      WalletService.verifyTopUp(userId.toString(), "M_MISMATCH"),
      /amount mismatch/i,
    );

    const w = await Wallet.collection.findOne({ userId });
    assert.equal(w.balance, 0); // not credited
  });

  it("credits when the settled amount matches", async () => {
    const userId = oid();
    await makeWallet(userId, "M_OK", 100); // expects 10000 paise
    statusStub = { state: "COMPLETED", amount: 10000 };

    const res = await WalletService.verifyTopUp(userId.toString(), "M_OK");
    assert.equal(res.status, "COMPLETED");

    const w = await Wallet.collection.findOne({ userId });
    assert.equal(w.balance, 100);
  });
});

// ───────────────── C6/C2: order confirmation amount verification ─────────────
describe("C6 — order payment is confirmed only for the exact amount", () => {
  const makeOrderWithTxn = async (totalAmount: number, gw: string) => {
    const orderId = oid();
    await Order.collection.insertOne({
      _id: orderId,
      orderNumber: "ORD-" + gw,
      userId: oid(),
      items: [],
      totalAmount,
      status: OrderStatus.PENDING_PAYMENT,
      paymentStatus: PaymentStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await PaymentTransaction.collection.insertOne({
      orderId,
      gatewayOrderId: gw,
      amount: totalAmount,
      status: PaymentStatus.PENDING,
      createdAt: new Date(),
    });
    return orderId;
  };

  it("rejects confirmation when gateway amount is less than the order total", async () => {
    const svc = new OrderService();
    const orderId = await makeOrderWithTxn(5000, "O_UNDER");
    statusStub = { state: "COMPLETED", amount: 4000 }; // underpaid

    await assert.rejects(
      svc.confirmPayment(orderId.toString(), "pay1", "O_UNDER"),
      /amount mismatch/i,
    );

    const o = await Order.collection.findOne({ _id: orderId });
    assert.equal(o.paymentStatus, PaymentStatus.PENDING); // not confirmed
  });

  it("rejects confirmation when the gateway has not completed", async () => {
    const svc = new OrderService();
    const orderId = await makeOrderWithTxn(5000, "O_PENDING");
    statusStub = { state: "PENDING" };

    await assert.rejects(
      svc.confirmPayment(orderId.toString(), "pay1", "O_PENDING"),
      /not completed/i,
    );
  });
});

// ───────────────── H7: refund requires CAPTURED ─────────────────
describe("H7 — refunds only on a captured order (blocks repeat refunds)", () => {
  it("rejects a refund when the order is not CAPTURED", async () => {
    const orderId = oid();
    await Order.collection.insertOne({
      _id: orderId,
      orderNumber: "ORD-REFUND",
      userId: oid(),
      items: [],
      totalAmount: 5000,
      status: OrderStatus.PENDING_PAYMENT,
      paymentStatus: PaymentStatus.PENDING, // not captured
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const svc = new RefundService();
    await assert.rejects(
      svc.initiateRefund(orderId.toString(), "O_REFUND", 100, "test"),
      /refundable \(captured\) state/i,
    );
  });
});
