// Atomicity and idempotency of the money paths.
//
// Every test here fires the SAME operation more than once at the same moment
// (Promise.all), because that is what a webhook racing a status poll, a
// double-tapped button, or an outbox retry looks like. The assertion is always
// about money or state that must not double: a balance, a gateway call count, an
// audit event. Gateway calls are mocked and counted. In-memory MongoDB only.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.PHONEPE_WEBHOOK_SECRET = "whsec_test_secret";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { after, before, beforeEach, describe, it, mock } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const { app } = require("../app");
const { generateToken } = require("../utils/jwt");
const PhonePeService = require("../shared/services/PhonePeService");
const emailUtil = require("../utils/email/shared"); // the barrel re-exports via getters, which cannot be mocked
const { NotificationService } = require("../client/services/NotificationService");
const { WalletService } = require("../client/services/WalletService");
const { initiateRefund } = require("../client/services/RefundService");
const { updatePaymentStatus } = require("../client/services/bookingService/lifecycle");
const { Booking } = require("../client/models/Booking");
const { BookingEvent } = require("../client/models/BookingEvent");
const { BookingPaymentTransaction } = require("../client/models/BookingPayment");
const { Wallet } = require("../client/models/Wallet");
const { User } = require("../client/models/User");
const PaymentWebhookEvent = require("../shared/models/PaymentWebhookEvent").default;
const OutboxMessage = require("../shared/models/OutboxMessage").default;
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();
const tick = () => new Promise((resolve) => setImmediate(resolve));

let mongod: { getUri(): string; stop(): Promise<void> };

// What the mocked gateway reports, and how often it was asked to move money.
let orderStatus: Record<string, { state: string; amount: number }> = {};
let refundCalls: Array<Record<string, unknown>> = [];
let refundShouldFail = false;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());

  mock.method(PhonePeService, "getPhonePeOrderStatus", async (merchantOrderId: string) => {
    await tick(); // yield, so concurrent callers genuinely interleave
    const status = orderStatus[merchantOrderId] ?? { state: "PENDING", amount: 0 };
    return { orderId: "OMO1", ...status, raw: status };
  });
  mock.method(PhonePeService, "initiatePhonePeRefund", async (args: Record<string, unknown>) => {
    refundCalls.push(args);
    await tick();
    if (refundShouldFail) throw new Error("gateway down");
    return { refundId: `R_${refundCalls.length}`, state: "INITIATED", raw: {} };
  });
  mock.method(emailUtil, "sendEmail", async () => undefined);
  mock.method(NotificationService, "send", async () => undefined);
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
    "wallets",
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
  orderStatus = {};
  refundCalls = [];
  refundShouldFail = false;
});

// ───────────────────────────── fixtures ─────────────────────────────

const insertUser = async () => {
  const id = oid();
  const email = `${id.toString()}@example.test`;
  await User.collection.insertOne({
    _id: id,
    name: "Payer",
    email,
    phone: `9${id.toString().slice(-9)}`,
    role: "Player",
    isActive: true,
    status: "ACTIVE",
  });
  return { id: id.toString(), email };
};

const tokenFor = (user: { id: string; email: string }) =>
  generateToken({ id: user.id, email: user.email, role: "Player" });

const insertWallet = async (userId: string, balance: number, transactions: unknown[] = []) => {
  await Wallet.collection.insertOne({
    userId: new mongoose.Types.ObjectId(userId),
    balance,
    currency: "INR",
    transactions,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
};

const walletOf = (userId: string) =>
  Wallet.collection.findOne({ userId: new mongoose.Types.ObjectId(userId) });

/** A booking with a Player share per payer and one venue payee row. */
const insertBooking = async (payers: Array<{ id: string; amount: number }>) => {
  const bookingId = oid();
  const owner = oid();
  await Booking.collection.insertOne({
    _id: bookingId,
    userId: new mongoose.Types.ObjectId(payers[0]!.id),
    organizerId: new mongoose.Types.ObjectId(payers[0]!.id),
    bookingType: payers.length > 1 ? "GROUP" : "INDIVIDUAL",
    paymentType: payers.length > 1 ? "SPLIT" : "SINGLE",
    providerType: "VENUE",
    venueId: oid(),
    sport: "Tennis",
    date: new Date(Date.now() + 86_400_000),
    startTime: "10:00",
    endTime: "11:00",
    totalAmount: payers.reduce((sum, p) => sum + p.amount, 0),
    status: "AWAITING_PAYMENT",
    participantName: "Payer",
    payments: [
      ...payers.map((p) => ({
        userId: new mongoose.Types.ObjectId(p.id),
        userType: "Player",
        amount: p.amount,
        status: "PENDING",
      })),
      { userId: owner, userType: "VenueLister", amount: 80, status: "PENDING" },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return bookingId.toString();
};

const bookingOf = (id: string) =>
  Booking.collection.findOne({ _id: new mongoose.Types.ObjectId(id) });
const eventCount = (bookingId: string, type: string) =>
  BookingEvent.collection.countDocuments({
    subjectId: new mongoose.Types.ObjectId(bookingId),
    type,
  });
const shareOf = (booking: any, userId: string) =>
  booking.payments.find((p: any) => String(p.userId) === userId && p.userType === "Player");

const callPaid = (bookingId: string, userId: string) =>
  updatePaymentStatus(bookingId, userId, "PAID", undefined, {
    actorType: "GATEWAY",
    channel: "WEBHOOK",
  });

// ───────────────────────── updatePaymentStatus ─────────────────────────

describe("updatePaymentStatus", () => {
  it("confirms and records once however many times PAID arrives at the same moment", async () => {
    const payer = await insertUser();
    const bookingId = await insertBooking([{ id: payer.id, amount: 100 }]);

    await Promise.all(Array.from({ length: 6 }, () => callPaid(bookingId, payer.id)));

    const booking = await bookingOf(bookingId);
    assert.equal(shareOf(booking, payer.id).status, "PAID");
    assert.equal(booking.status, "AWAITING_PROVIDER");
    assert.ok(booking.paymentConfirmedAt, "fully paid");
    assert.equal(await eventCount(bookingId, "PAYMENT_CONFIRMED"), 1, "one audit event, not six");
  });

  it("does not lose a share when two payers pay at the same moment", async () => {
    for (let round = 0; round < 8; round++) {
      const a = await insertUser();
      const b = await insertUser();
      const bookingId = await insertBooking([
        { id: a.id, amount: 60 },
        { id: b.id, amount: 40 },
      ]);

      await Promise.all([callPaid(bookingId, a.id), callPaid(bookingId, b.id)]);

      const booking = await bookingOf(bookingId);
      assert.equal(shareOf(booking, a.id).status, "PAID", `round ${round}: first share`);
      assert.equal(shareOf(booking, b.id).status, "PAID", `round ${round}: second share`);
      assert.ok(booking.paymentConfirmedAt, `round ${round}: confirmed once both are paid`);
      assert.equal(booking.status, "AWAITING_PROVIDER");
    }
  });

  it("leaves the booking awaiting payment until every player share is paid", async () => {
    const a = await insertUser();
    const b = await insertUser();
    const bookingId = await insertBooking([
      { id: a.id, amount: 60 },
      { id: b.id, amount: 40 },
    ]);

    await callPaid(bookingId, a.id);

    const booking = await bookingOf(bookingId);
    assert.equal(shareOf(booking, a.id).status, "PAID");
    assert.equal(shareOf(booking, b.id).status, "PENDING");
    assert.ok(!booking.paymentConfirmedAt);
    assert.equal(booking.status, "AWAITING_PAYMENT");
  });

  it("ignores a FAILED report for a share that is already PAID, and keeps the booking", async () => {
    const payer = await insertUser();
    const bookingId = await insertBooking([{ id: payer.id, amount: 100 }]);
    await callPaid(bookingId, payer.id);

    // A late failure from an earlier attempt must not delete a paid booking.
    await updatePaymentStatus(bookingId, payer.id, "FAILED", undefined, {
      actorType: "GATEWAY",
      channel: "WEBHOOK",
    });

    const booking = await bookingOf(bookingId);
    assert.ok(booking, "the paid booking still exists");
    assert.equal(shareOf(booking, payer.id).status, "PAID");
  });
});

// ───────────────────────────── wallet ─────────────────────────────

describe("wallet credit and debit", () => {
  it("credits once per reference, however often it is asked", async () => {
    const user = await insertUser();
    await insertWallet(user.id, 0);

    await Promise.all(
      Array.from({ length: 5 }, () =>
        WalletService.creditWallet(user.id, 50, "Booking Refund", "TXN-1")
      )
    );

    const wallet = await walletOf(user.id);
    assert.equal(wallet.balance, 50);
    assert.equal(wallet.transactions.filter((t: any) => t.referenceId === "TXN-1").length, 1);
  });

  it("credits distinct references independently", async () => {
    const user = await insertUser();
    await insertWallet(user.id, 0);

    await WalletService.creditWallet(user.id, 50, "Booking Refund", "TXN-1");
    await WalletService.creditWallet(user.id, 30, "Booking Refund", "TXN-2");

    assert.equal((await walletOf(user.id)).balance, 80);
  });

  it("debits once per reference, and returns the original debit on a repeat", async () => {
    const user = await insertUser();
    await insertWallet(user.id, 100);

    const results = await Promise.all(
      Array.from({ length: 4 }, () => WalletService.debitWallet(user.id, 60, "Booking", "B-1"))
    );

    const wallet = await walletOf(user.id);
    assert.equal(wallet.balance, 40, "debited once");
    assert.equal(wallet.transactions.filter((t: any) => t.referenceId === "B-1").length, 1);
    assert.equal(new Set(results.map((r: any) => r.transaction.id)).size, 1, "same transaction");
  });

  it("never overdraws when different debits race for the same balance", async () => {
    const user = await insertUser();
    await insertWallet(user.id, 100);

    const results = await Promise.allSettled([
      WalletService.debitWallet(user.id, 60, "A", "A-1"),
      WalletService.debitWallet(user.id, 60, "B", "B-1"),
    ]);

    assert.equal(results.filter((r: any) => r.status === "fulfilled").length, 1);
    assert.equal((await walletOf(user.id)).balance, 40);
  });

  it("still refuses a debit larger than the balance", async () => {
    const user = await insertUser();
    await insertWallet(user.id, 10);

    await assert.rejects(() => WalletService.debitWallet(user.id, 60, "A", "A-1"), /Insufficient/);
    assert.equal((await walletOf(user.id)).balance, 10);
  });
});

describe("wallet top-up", () => {
  const pendingTopUp = (id: string, orderId: string, amount: number) => ({
    id,
    type: "CREDIT",
    amount,
    status: "PENDING",
    reason: "Wallet Top Up",
    referenceId: orderId,
    createdAt: new Date(),
  });

  it("credits once when verify is called twice at the same moment, even with an abandoned top-up", async () => {
    const user = await insertUser();
    await insertWallet(user.id, 0, [
      pendingTopUp("T-REAL", "WTOPUP-REAL", 500),
      pendingTopUp("T-ABANDONED", "WTOPUP-OLD", 200), // never paid, still PENDING
    ]);
    orderStatus["WTOPUP-REAL"] = { state: "COMPLETED", amount: 50000 };

    await Promise.all([
      WalletService.verifyTopUp(user.id, "WTOPUP-REAL"),
      WalletService.verifyTopUp(user.id, "WTOPUP-REAL"),
      WalletService.verifyTopUp(user.id, "WTOPUP-REAL"),
    ]);

    const wallet = await walletOf(user.id);
    assert.equal(wallet.balance, 500, "credited exactly once");
    assert.equal(wallet.transactions.find((t: any) => t.id === "T-REAL").status, "COMPLETED");
    assert.equal(
      wallet.transactions.find((t: any) => t.id === "T-ABANDONED").status,
      "PENDING",
      "the other top-up is untouched"
    );
  });

  it("refuses to credit when the gateway amount differs", async () => {
    const user = await insertUser();
    await insertWallet(user.id, 0, [pendingTopUp("T1", "WTOPUP-1", 500)]);
    orderStatus["WTOPUP-1"] = { state: "COMPLETED", amount: 100 };

    await assert.rejects(() => WalletService.verifyTopUp(user.id, "WTOPUP-1"), /mismatch/);
    assert.equal((await walletOf(user.id)).balance, 0);
  });

  it("does not turn a completed top-up into a failed one", async () => {
    const user = await insertUser();
    await insertWallet(user.id, 500, [
      { ...pendingTopUp("T1", "WTOPUP-1", 500), status: "COMPLETED" },
    ]);
    orderStatus["WTOPUP-1"] = { state: "FAILED", amount: 50000 };

    await WalletService.verifyTopUp(user.id, "WTOPUP-1");

    const wallet = await walletOf(user.id);
    assert.equal(wallet.transactions[0].status, "COMPLETED");
    assert.equal(wallet.balance, 500);
  });

  it("credits from the webhook alone, when the user never comes back to verify", async () => {
    const user = await insertUser();
    await insertWallet(user.id, 0, [pendingTopUp("T1", "WTOPUP-WH", 500)]);
    orderStatus["WTOPUP-WH"] = { state: "COMPLETED", amount: 50000 };
    const { reconcileWalletTopUpFromWebhookPayload } = require("../client/services/WalletService");

    const payload = {
      event: "checkout.order.completed",
      payload: { merchantOrderId: "WTOPUP-WH", state: "COMPLETED" },
    };
    await reconcileWalletTopUpFromWebhookPayload(payload);
    await reconcileWalletTopUpFromWebhookPayload(payload); // outbox retry

    const wallet = await walletOf(user.id);
    assert.equal(wallet.balance, 500, "credited once");
    // and the user's own verify afterwards does not credit again
    await WalletService.verifyTopUp(user.id, "WTOPUP-WH");
    assert.equal((await walletOf(user.id)).balance, 500);
  });

  it("ignores webhooks for other kinds of payment", async () => {
    const { reconcileWalletTopUpFromWebhookPayload } = require("../client/services/WalletService");
    const result = await reconcileWalletTopUpFromWebhookPayload({
      payload: { merchantOrderId: "bk_123", state: "COMPLETED" },
    });
    assert.equal(result, null);
  });
});

// ─────────────────────── paying a booking with the wallet ───────────────────────

describe("POST /api/bookings/:id/wallet/pay", () => {
  const pay = (bookingId: string, user: { id: string; email: string }) =>
    request(app)
      .post(`/api/bookings/${bookingId}/wallet/pay`)
      .set("Authorization", `Bearer ${tokenFor(user)}`);

  it("debits once when the request arrives twice at the same moment", async () => {
    const payer = await insertUser();
    await insertWallet(payer.id, 500);
    const bookingId = await insertBooking([{ id: payer.id, amount: 200 }]);

    const responses = await Promise.all([
      pay(bookingId, payer),
      pay(bookingId, payer),
      pay(bookingId, payer),
    ]);

    for (const response of responses)
      assert.equal(response.status, 200, JSON.stringify(response.body));
    const wallet = await walletOf(payer.id);
    assert.equal(wallet.balance, 300, "charged once");
    assert.equal(wallet.transactions.filter((t: any) => t.type === "DEBIT").length, 1);
    assert.equal(
      await BookingPaymentTransaction.countDocuments({ bookingId }),
      1,
      "one payment record"
    );
    const booking = await bookingOf(bookingId);
    assert.equal(shareOf(booking, payer.id).status, "PAID");
    assert.equal(booking.status, "AWAITING_PROVIDER");
    assert.equal(await eventCount(bookingId, "PAYMENT_CONFIRMED"), 1);
  });

  it("charges nothing and leaves the booking alone when the balance is too low", async () => {
    const payer = await insertUser();
    await insertWallet(payer.id, 50);
    const bookingId = await insertBooking([{ id: payer.id, amount: 200 }]);

    const response = await pay(bookingId, payer);

    assert.notEqual(response.status, 200);
    assert.equal((await walletOf(payer.id)).balance, 50);
    assert.equal(await BookingPaymentTransaction.countDocuments({ bookingId }), 0);
    assert.equal(shareOf(await bookingOf(bookingId), payer.id).status, "PENDING");
  });

  it("finishes the booking on a retry without charging again after a half-completed attempt", async () => {
    const payer = await insertUser();
    const bookingId = await insertBooking([{ id: payer.id, amount: 200 }]);
    // The wallet was already debited for this booking, then the process died.
    await insertWallet(payer.id, 300, [
      {
        id: "TXN-DONE",
        type: "DEBIT",
        amount: 200,
        status: "COMPLETED",
        reason: `Booking Payment: ${bookingId}`,
        referenceId: bookingId,
        createdAt: new Date(),
      },
    ]);

    const response = await pay(bookingId, payer);

    assert.equal(response.status, 200, JSON.stringify(response.body));
    assert.equal((await walletOf(payer.id)).balance, 300, "not charged a second time");
    assert.equal(shareOf(await bookingOf(bookingId), payer.id).status, "PAID");
  });

  it("treats a repeat of a payment that already went through as a success, and charges nothing", async () => {
    const payer = await insertUser();
    await insertWallet(payer.id, 500);
    const bookingId = await insertBooking([{ id: payer.id, amount: 200 }]);
    assert.equal((await pay(bookingId, payer)).status, 200);

    // Sequential, so this arrives after the booking has moved on to AWAITING_PROVIDER.
    const again = await pay(bookingId, payer);

    assert.equal(again.status, 200, JSON.stringify(again.body));
    assert.equal((await walletOf(payer.id)).balance, 300, "charged once, not twice");
    assert.equal(await BookingPaymentTransaction.countDocuments({ bookingId }), 1);
  });

  it("refuses a share that was already paid some other way, and charges nothing", async () => {
    const payer = await insertUser();
    await insertWallet(payer.id, 500);
    const bookingId = await insertBooking([{ id: payer.id, amount: 200 }]);
    await callPaid(bookingId, payer.id); // paid by card: no wallet payment record

    const response = await pay(bookingId, payer);

    assert.equal(response.status, 400);
    assert.equal((await walletOf(payer.id)).balance, 500);
  });

  it("returns the money to the wallet if the booking disappears after the debit", async () => {
    const payer = await insertUser();
    await insertWallet(payer.id, 500);
    const bookingId = await insertBooking([{ id: payer.id, amount: 200 }]);

    // The booking is cleaned up in the gap between the debit and the update.
    const original = BookingPaymentTransaction.updateOne.bind(BookingPaymentTransaction);
    const spy = mock.method(BookingPaymentTransaction, "updateOne", async (...args: unknown[]) => {
      spy.mock.restore();
      await Booking.collection.deleteOne({ _id: new mongoose.Types.ObjectId(bookingId) });
      return (original as (...a: unknown[]) => unknown)(...args);
    });

    const response = await pay(bookingId, payer);

    assert.equal(response.status, 409, JSON.stringify(response.body));
    const wallet = await walletOf(payer.id);
    assert.equal(wallet.balance, 500, "the debit was reversed");
    assert.equal(wallet.transactions.filter((t: any) => t.type === "CREDIT").length, 1);
    const record = await BookingPaymentTransaction.findOne({ bookingId });
    assert.equal(record.status, "FAILED", "the payment record no longer claims it was paid");
  });
});

// ───────────────────────────── refunds ─────────────────────────────

describe("initiateRefund", () => {
  const insertTransaction = async (overrides: Record<string, unknown> = {}) => {
    const user = await insertUser();
    const bookingId = oid();
    const txId = oid();
    await BookingPaymentTransaction.collection.insertOne({
      _id: txId,
      bookingId,
      userId: new mongoose.Types.ObjectId(user.id),
      merchantOrderId: `bk_${txId.toString()}`,
      amount: 50000, // paise
      status: "COMPLETED",
      state: "COMPLETED",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    });
    return { user, txId: txId.toString() };
  };

  it("sends one gateway refund when two refunds are initiated at the same moment", async () => {
    const { txId } = await insertTransaction();

    const results = await Promise.allSettled([
      initiateRefund({ bookingPaymentTransactionId: txId, amount: 50000 }),
      initiateRefund({ bookingPaymentTransactionId: txId, amount: 50000 }),
      initiateRefund({ bookingPaymentTransactionId: txId, amount: 50000 }),
    ]);

    assert.equal(refundCalls.length, 1, "the gateway was asked to refund once");
    assert.equal(results.filter((r: any) => r.status === "fulfilled").length, 1);
    for (const r of results.filter((x: any) => x.status === "rejected")) {
      assert.match(String((r as any).reason?.message), /already/i);
    }
  });

  it("allows a retry after a failed gateway call", async () => {
    const { txId } = await insertTransaction();
    refundShouldFail = true;
    await assert.rejects(() =>
      initiateRefund({ bookingPaymentTransactionId: txId, amount: 50000 })
    );

    refundShouldFail = false;
    const retried = await initiateRefund({ bookingPaymentTransactionId: txId, amount: 50000 });

    assert.equal(retried.state, "INITIATED");
    assert.equal(refundCalls.length, 2);
  });

  it("credits the wallet once when store-credit refunds race", async () => {
    const { user, txId } = await insertTransaction();
    await insertWallet(user.id, 0);

    await Promise.allSettled([
      initiateRefund({
        bookingPaymentTransactionId: txId,
        amount: 50000,
        refundMethod: "STORE_CREDIT",
      }),
      initiateRefund({
        bookingPaymentTransactionId: txId,
        amount: 50000,
        refundMethod: "STORE_CREDIT",
      }),
    ]);

    assert.equal((await walletOf(user.id)).balance, 500, "₹500 credited once");
  });

  it("returns a wallet payment to the wallet, not to a card that was never charged", async () => {
    const { user, txId } = await insertTransaction({ merchantOrderId: "WALLET-1700000000-abc" });
    await insertWallet(user.id, 0);

    const result = await initiateRefund({ bookingPaymentTransactionId: txId, amount: 50000 });

    assert.equal(refundCalls.length, 0, "no gateway call for a wallet payment");
    assert.equal(result.method, "STORE_CREDIT");
    assert.equal(result.state, "COMPLETED");
    assert.equal((await walletOf(user.id)).balance, 500);
  });

  it("still refuses a refund larger than the payment", async () => {
    const { txId } = await insertTransaction();
    await assert.rejects(
      () => initiateRefund({ bookingPaymentTransactionId: txId, amount: 60000 }),
      /cannot exceed/
    );
    assert.equal(refundCalls.length, 0);
  });
});

// ─────────────────────────── webhook route ───────────────────────────

describe("POST /api/payments/phonepe/webhook", () => {
  const send = (body: unknown) => {
    const raw = JSON.stringify(body);
    const signature = crypto
      .createHmac("sha256", process.env.PHONEPE_WEBHOOK_SECRET)
      .update(raw)
      .digest("hex");
    return request(app)
      .post("/api/payments/phonepe/webhook")
      .set("Content-Type", "application/json")
      .set("x-phonepe-signature", signature)
      .send(raw);
  };

  it("keeps both events when a payment's state changes under the same transaction id", async () => {
    // Same transactionId, different state: the second is a new fact, not a duplicate.
    await send({ data: { transactionId: "TX-1", merchantOrderId: "bk_1", state: "PENDING" } });
    await send({ data: { transactionId: "TX-1", merchantOrderId: "bk_1", state: "COMPLETED" } });

    assert.equal(await PaymentWebhookEvent.countDocuments(), 2);
    assert.equal(await OutboxMessage.countDocuments({ type: "process_payment_webhook" }), 2);
  });

  it("stores a redelivered identical event once", async () => {
    const body = {
      event: "checkout.order.completed",
      payload: { merchantOrderId: "bk_2", state: "COMPLETED" },
    };

    const responses = await Promise.all([send(body), send(body), send(body)]);

    for (const response of responses) assert.equal(response.status, 200);
    assert.equal(await PaymentWebhookEvent.countDocuments(), 1);
    assert.equal(await OutboxMessage.countDocuments({ type: "process_payment_webhook" }), 1);
  });

  it("still honours an explicit event id from the gateway", async () => {
    await send({ eventId: "EVT-9", payload: { merchantOrderId: "bk_3", state: "COMPLETED" } });
    await send({
      eventId: "EVT-9",
      payload: { merchantOrderId: "bk_3", state: "COMPLETED", retry: 1 },
    });

    assert.equal(await PaymentWebhookEvent.countDocuments(), 1);
  });
});
