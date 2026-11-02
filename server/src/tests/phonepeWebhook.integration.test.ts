// PhonePe webhooks: authentication as PhonePe sends it, and refund events kept
// apart from payment events.
//
// A refund event names the ORIGINAL order and a COMPLETED/FAILED state, so if it
// reaches a payment reconciler a failed refund reads as a failed payment. These
// tests send the shapes from PhonePe's webhook documentation and assert that the
// payment is left alone and only the refund moves. Gateway calls are mocked;
// in-memory MongoDB only.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.PHONEPE_WEBHOOK_SECRET = "whsec_test_secret";
process.env.PHONEPE_CALLBACK_USERNAME = "hook-user";
process.env.PHONEPE_CALLBACK_PASSWORD = "hook-pass";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { after, before, beforeEach, describe, it, mock } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const { app } = require("../app");
const emailUtil = require("../utils/email/shared");
const { NotificationService } = require("../client/services/NotificationService");
const { reconcileRefundFromWebhookPayload } = require("../client/services/RefundService");
const {
  isPhonePeRefundEvent,
  verifyPhonePeWebhookAuth,
} = require("../shared/services/phonepeWebhookAuth");
const { startOutboxWorker } = require("../shared/services/OutboxService");
const { Booking } = require("../client/models/Booking");
const { BookingPaymentTransaction } = require("../client/models/BookingPayment");
const { User } = require("../client/models/User");
const PaymentWebhookEvent = require("../shared/models/PaymentWebhookEvent").default;
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();
const sha = (text: string) => crypto.createHash("sha256").update(text).digest("hex");
const SHA_AUTH = sha("hook-user:hook-pass");

let mongod: { getUri(): string; stop(): Promise<void> };
let notifications: Array<Record<string, any>> = [];
let alertEmails: Array<Record<string, any>> = [];

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  mock.method(emailUtil, "sendEmail", async (mail: Record<string, any>) => {
    alertEmails.push(mail);
  });
  mock.method(NotificationService, "send", async (message: Record<string, any>) => {
    notifications.push(message);
  });
});

after(async () => {
  mock.restoreAll();
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  for (const name of [
    "users",
    "bookings",
    "bookingevents",
    "bookingpaymenttransactions",
    "paymentwebhookevents",
    "outboxmessages",
  ]) {
    await mongoose.connection.db
      .collection(name)
      .deleteMany({})
      .catch(() => undefined);
  }
  notifications = [];
  alertEmails = [];
});

// ───────────────────────────── fixtures ─────────────────────────────

const insertUser = async () => {
  const id = oid();
  await User.collection.insertOne({
    _id: id,
    name: "Payer",
    email: `${id.toString()}@example.test`,
    phone: `9${id.toString().slice(-9)}`,
    role: "Player",
    isActive: true,
    status: "ACTIVE",
  });
  return id;
};

/** A paid booking whose card payment has a refund in flight. */
const insertRefundedPayment = async (overrides: Record<string, unknown> = {}) => {
  const userId = await insertUser();
  const bookingId = oid();
  const txId = oid();
  const merchantOrderId = `bk_${txId.toString()}`;
  await Booking.collection.insertOne({
    _id: bookingId,
    userId,
    organizerId: userId,
    status: "CANCELLED",
    refundStatus: "PENDING",
    payments: [{ userId, userType: "Player", amount: 500, status: "PAID" }],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await BookingPaymentTransaction.collection.insertOne({
    _id: txId,
    bookingId,
    userId,
    merchantOrderId,
    amount: 50000,
    status: "COMPLETED",
    state: "COMPLETED",
    // PhonePe answers an initiation with PENDING, and that is what gets stored.
    refundState: "PENDING",
    refundAmount: 50000,
    refundMerchantId: "REFUND-1",
    refundId: "OMR2607082001267376331042V",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });
  return { merchantOrderId, bookingId, txId };
};

const txOf = (id: unknown) => BookingPaymentTransaction.collection.findOne({ _id: id });
const bookingOf = (id: unknown) => Booking.collection.findOne({ _id: id });

/** The refund body PhonePe documents for a UPI original payment. */
const refundBody = (
  event: "pg.refund.completed" | "pg.refund.failed",
  merchantOrderId: string,
  extra: Record<string, unknown> = {}
) => ({
  event,
  payload: {
    originalMerchantOrderId: merchantOrderId,
    refundId: "OMR2607082001267376331042V",
    amount: 50000,
    state: event === "pg.refund.completed" ? "COMPLETED" : "FAILED",
    timestamp: 1730869961754,
    ...extra,
  },
});

const postWebhook = (path: string, body: unknown, authorization: string | null = SHA_AUTH) => {
  const call = request(app).post(path).set("Content-Type", "application/json");
  if (authorization !== null) call.set("Authorization", authorization);
  return call.send(JSON.stringify(body));
};

const until = async (check: () => Promise<boolean>, ms = 12_000) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("timed out waiting for the outbox worker");
};

// ─────────────────────────── authentication ───────────────────────────

describe("verifyPhonePeWebhookAuth", () => {
  const raw = '{"event":"checkout.order.completed"}';
  const hmac = (secret: string) => crypto.createHmac("sha256", secret).update(raw).digest("hex");

  it("accepts the SHA Authorization header PhonePe documents", () => {
    assert.deepEqual(verifyPhonePeWebhookAuth({ authorization: SHA_AUTH }, raw), {
      ok: true,
      scheme: "SHA",
    });
  });

  it("rejects a wrong SHA header", () => {
    const wrong = sha("hook-user:other");
    assert.deepEqual(verifyPhonePeWebhookAuth({ authorization: wrong }, raw), {
      ok: false,
      reason: "INVALID",
    });
  });

  it("accepts the documented checksum-signature header for HMAC", () => {
    const headers = {
      "x-phonepe-checksum-key-id": "key-1",
      "x-phonepe-checksum-signature": hmac("whsec_test_secret"),
    };
    assert.deepEqual(verifyPhonePeWebhookAuth(headers, raw), { ok: true, scheme: "HMAC" });
  });

  it("still accepts the legacy signature header, and rejects a bad one", () => {
    assert.equal(
      verifyPhonePeWebhookAuth({ "x-phonepe-signature": hmac("whsec_test_secret") }, raw).ok,
      true
    );
    assert.equal(
      verifyPhonePeWebhookAuth({ "x-phonepe-signature": hmac("some-other-secret") }, raw).ok,
      false
    );
  });

  it("rejects a request that carries no credentials", () => {
    assert.deepEqual(verifyPhonePeWebhookAuth({}, raw), {
      ok: false,
      reason: "MISSING_CREDENTIALS",
    });
  });

  it("reports a server with no credentials configured, rather than a bad signature", () => {
    const saved = { ...process.env };
    delete process.env.PHONEPE_CALLBACK_USERNAME;
    delete process.env.PHONEPE_CALLBACK_PASSWORD;
    delete process.env.PHONEPE_WEBHOOK_SECRET;
    try {
      assert.deepEqual(verifyPhonePeWebhookAuth({ authorization: SHA_AUTH }, raw), {
        ok: false,
        reason: "NOT_CONFIGURED",
      });
    } finally {
      Object.assign(process.env, saved);
    }
  });
});

describe("isPhonePeRefundEvent", () => {
  it("recognises refund events by name and by refund id", () => {
    assert.equal(isPhonePeRefundEvent({ event: "pg.refund.failed", payload: {} }), true);
    assert.equal(isPhonePeRefundEvent({ payload: { refundId: "OMR1", state: "FAILED" } }), true);
  });

  it("does not mistake an order event for one", () => {
    assert.equal(
      isPhonePeRefundEvent({
        event: "checkout.order.completed",
        payload: { merchantOrderId: "bk_1", state: "COMPLETED" },
      }),
      false
    );
  });
});

describe("the webhook URLs", () => {
  for (const path of ["/api/payments/phonepe/webhook", "/api/v1/webhooks/phonepe"]) {
    it(`${path} accepts a SHA-authenticated delivery and rejects a forged one`, async () => {
      const body = {
        event: "checkout.order.completed",
        payload: { merchantOrderId: "bk_x", state: "COMPLETED" },
      };

      const accepted = await postWebhook(path, body);
      assert.equal(accepted.status, 200);
      assert.equal(await PaymentWebhookEvent.countDocuments(), 1);

      const forged = await postWebhook(path, { ...body, forged: true }, sha("hook-user:nope"));
      assert.equal(forged.status, 401);
      const anonymous = await postWebhook(path, { ...body, forged: 2 }, null);
      assert.equal(anonymous.status, 401);
      assert.equal(await PaymentWebhookEvent.countDocuments(), 1, "nothing stored for either");
    });
  }
});

// ───────────────────── refund events never touch the payment ─────────────────────

describe("refund webhooks, end to end through the outbox", () => {
  let stopWorker: () => void;
  before(() => {
    stopWorker = startOutboxWorker();
  });
  after(() => stopWorker());

  const deliver = async (body: unknown) => {
    const response = await postWebhook("/api/payments/phonepe/webhook", body);
    assert.equal(response.status, 200);
    await until(async () => (await PaymentWebhookEvent.countDocuments({ status: "DONE" })) === 1);
  };

  it("a failed refund fails the refund, not the paid payment, and finance is told", async () => {
    const { merchantOrderId, txId, bookingId } = await insertRefundedPayment();

    await deliver(refundBody("pg.refund.failed", merchantOrderId, { errorCode: "UPI_ERR" }));

    const tx = await txOf(txId);
    assert.equal(tx.refundState, "FAILED", "released for retry");
    assert.equal(tx.status, "COMPLETED", "the payment is still a completed payment");
    assert.equal(tx.state, "COMPLETED");
    const booking = await bookingOf(bookingId);
    assert.equal(booking.payments[0].status, "PAID", "the share was not un-paid");
    assert.equal(alertEmails.length, 1, "finance alerted once");
    assert.match(String(alertEmails[0]?.subject), /refund failed/i);
  });

  it("a completed refund completes the refund, marks the booking processed, notifies once", async () => {
    const { merchantOrderId, txId, bookingId } = await insertRefundedPayment();
    const body = refundBody("pg.refund.completed", merchantOrderId);

    await deliver(body);

    const tx = await txOf(txId);
    assert.equal(tx.refundState, "COMPLETED");
    assert.equal(tx.status, "COMPLETED");
    assert.equal((await bookingOf(bookingId)).refundStatus, "PROCESSED");
    assert.equal(notifications.length, 1);

    // The same refund arriving again, or the poller finding it done, is a no-op.
    await reconcileRefundFromWebhookPayload(body);
    assert.equal(notifications.length, 1, "no second notification");
  });
});

describe("reconcileRefundFromWebhookPayload", () => {
  it("never walks a completed refund back to failed", async () => {
    const { merchantOrderId, txId } = await insertRefundedPayment({ refundState: "COMPLETED" });

    await reconcileRefundFromWebhookPayload(refundBody("pg.refund.failed", merchantOrderId));

    assert.equal((await txOf(txId)).refundState, "COMPLETED");
    assert.equal(alertEmails.length, 0);
  });

  it("finds the refund by the original order when no refund id matches, but only while in flight", async () => {
    const { merchantOrderId, txId } = await insertRefundedPayment({
      refundId: undefined,
      refundMerchantId: undefined,
    });

    await reconcileRefundFromWebhookPayload(
      refundBody("pg.refund.completed", merchantOrderId, { refundId: "OMR-UNSEEN" })
    );
    const tx = await txOf(txId);
    assert.equal(tx.refundState, "COMPLETED");
    assert.equal(tx.refundId, "OMR-UNSEEN", "the gateway id is recorded");
  });

  it("ignores a refund that is merely accepted or pending", async () => {
    const { merchantOrderId, txId } = await insertRefundedPayment();

    const result = await reconcileRefundFromWebhookPayload(
      refundBody("pg.refund.completed", merchantOrderId, { state: "PENDING" })
    );

    assert.equal(result, null);
    assert.equal((await txOf(txId)).refundState, "PENDING");
  });
});

// ───────────────────────── the booking callback URL ─────────────────────────

describe("POST /api/bookings/phonepe/callback", () => {
  const callback = (body: unknown, authorization: string | null = SHA_AUTH) => {
    const call = request(app)
      .post("/api/bookings/phonepe/callback")
      .set("Content-Type", "application/json");
    if (authorization !== null) call.set("Authorization", authorization);
    return call.send(JSON.stringify(body));
  };

  const insertUnpaid = async () => {
    const userId = await insertUser();
    const bookingId = oid();
    const txId = oid();
    const merchantOrderId = `bk_${txId.toString()}`;
    await Booking.collection.insertOne({
      _id: bookingId,
      userId,
      organizerId: userId,
      bookingType: "INDIVIDUAL",
      paymentType: "SINGLE",
      providerType: "VENUE",
      venueId: oid(),
      sport: "Tennis",
      date: new Date(Date.now() + 86_400_000),
      startTime: "10:00",
      endTime: "11:00",
      totalAmount: 500,
      status: "AWAITING_PAYMENT",
      participantName: "Payer",
      payments: [
        { userId, userType: "Player", amount: 500, status: "PENDING" },
        { userId: oid(), userType: "VenueLister", amount: 80, status: "PENDING" },
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await BookingPaymentTransaction.collection.insertOne({
      _id: txId,
      bookingId,
      userId,
      merchantOrderId,
      amount: 50000,
      status: "PENDING",
      state: "PENDING",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { merchantOrderId, txId, bookingId };
  };

  it("confirms the payment from an order callback, which carries merchantOrderId", async () => {
    const { merchantOrderId, txId } = await insertUnpaid();

    const response = await callback({
      event: "checkout.order.completed",
      payload: {
        orderId: "OMO2403282020198641071317",
        merchantId: "merchantId",
        merchantOrderId,
        state: "COMPLETED",
        amount: 50000,
        paymentDetails: [],
      },
    });

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal((await txOf(txId)).status, "COMPLETED");
  });

  it("treats a refund callback as a refund: the paid payment stays paid, the refund fails", async () => {
    const { merchantOrderId, txId, bookingId } = await insertRefundedPayment();

    const response = await callback(refundBody("pg.refund.failed", merchantOrderId));

    assert.equal(response.status, 200, JSON.stringify(response.body));
    const tx = await txOf(txId);
    assert.equal(tx.status, "COMPLETED");
    assert.equal(tx.refundState, "FAILED");
    assert.equal((await bookingOf(bookingId)).payments[0].status, "PAID");
  });

  it("rejects a callback with the wrong credentials", async () => {
    const { merchantOrderId } = await insertUnpaid();
    const response = await callback(
      { event: "checkout.order.completed", payload: { merchantOrderId, state: "COMPLETED" } },
      sha("hook-user:wrong")
    );
    assert.notEqual(response.status, 200);
  });
});
