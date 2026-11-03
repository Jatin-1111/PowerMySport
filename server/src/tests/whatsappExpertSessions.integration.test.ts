/* eslint-disable @typescript-eslint/no-var-requires */
// What an expert does to a session reaches the parent on WhatsApp, through the
// same consent and the same n8n route as venue and coach bookings, so one switch
// in Settings covers both. These pin which actions send a message and which do
// not: accepting, moving and cancelling do; a booking that has only just been
// paid and is waiting for the expert does not, a parent cancelling their own
// session does not, and a parent who never agreed to WhatsApp gets nothing. The
// n8n side is a local sink; no message leaves the machine.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";

import assert = require("node:assert/strict");
import http = require("node:http");
const { after, afterEach, before, beforeEach, describe, it, mock } = require("node:test");
const mongoose = require("mongoose");
// A replica set: reserving an expert's slot happens in a transaction.
const { MongoMemoryReplSet } = require("mongodb-memory-server");

const PhonePeService = require("../shared/services/PhonePeService");
const ExpertsService = require("../client/services/ExpertsService");
const { ExpertSession } = require("../client/models/ExpertBooking");
const { Expert } = require("../client/models/ExpertProfile");
const { User } = require("../client/models/User");
const { BookingSlotLock } = require("../client/models/BookingSlotLock");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();

let mongod: any;
let sink: http.Server;
let received: Array<{ headers: http.IncomingHttpHeaders; body: any }> = [];
let onMessage: (() => void) | null = null;

before(async () => {
  mongod = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongod.getUri());
  mock.method(PhonePeService, "initiatePhonePePayment", async () => ({
    redirectUrl: "https://phonepe.test/pay",
  }));
  mock.method(PhonePeService, "getPhonePeOrderStatus", async () => ({ state: "COMPLETED" }));

  sink = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      res.end("OK");
      received.push({ headers: req.headers, body: JSON.parse(raw) });
      onMessage?.();
    });
  });
  await new Promise<void>((resolve) => sink.listen(0, "127.0.0.1", resolve));
  const { port } = sink.address() as { port: number };
  process.env.N8N_BOOKING_WEBHOOK_URL = `http://127.0.0.1:${port}/webhook/booking-event`;
  process.env.PMS_SERVER_WEBHOOK_SECRET = "test-shared-secret";
  delete process.env.WHATSAPP_TEMPLATES;
});

after(async () => {
  mock.restoreAll();
  sink.close();
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  received = [];
  onMessage = null;
  await ExpertSession.collection.deleteMany({});
  await Expert.collection.deleteMany({});
  await User.collection.deleteMany({});
  await BookingSlotLock.collection.deleteMany({});
});

afterEach(() => {
  onMessage = null;
});

/** 05:30 UTC is 11:00 IST, which lands on the expert's slot grid. */
const futureSlot = (daysAhead = 30): Date => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  d.setUTCHours(5, 30, 0, 0);
  return d;
};

const seedExpert = async () => {
  const expertUserId = oid();
  await User.collection.insertOne({
    _id: expertUserId,
    name: "Arjun Rao",
    email: `expert-${expertUserId}@test.com`,
    phone: "9000000001",
    role: "EXPERT",
    password: "x",
  });
  const expertId = oid();
  await Expert.collection.insertOne({
    _id: expertId,
    userId: expertUserId,
    bio: "",
    sports: ["Tennis"],
    expertise: [],
    sessionFee: 1000,
    sessionMode: "BOTH",
    sessionDurationMinutes: 60,
    timezone: "Asia/Kolkata",
    weeklyAvailability: [0, 1, 2, 3, 4, 5, 6].map((dayOfWeek) => ({
      dayOfWeek,
      start: "00:00",
      end: "23:59",
    })),
    blackoutDates: [],
    isActive: true,
    verificationStatus: "APPROVED",
    rating: 0,
    reviewCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { expertId: expertId.toString(), expertUserId: expertUserId.toString() };
};

const seedParent = async (opts: { consent?: boolean; phone?: string | null } = {}) => {
  const { consent = true, phone = "9876543210" } = opts;
  const userId = oid();
  await User.collection.insertOne({
    _id: userId,
    name: "Meera Iyer",
    email: `parent-${userId}@test.com`,
    ...(phone ? { phone } : {}),
    role: "Parent",
    password: "x",
    ...(consent ? { whatsappConsent: { granted: true, at: new Date(), source: "settings" } } : {}),
  });
  return userId.toString();
};

/** A paid session at 11:00 IST in 30 days, waiting for the expert. */
const paidSession = async (parentOpts: { consent?: boolean; phone?: string | null } = {}) => {
  const { expertId, expertUserId } = await seedExpert();
  const userId = await seedParent(parentOpts);
  const scheduledAt = futureSlot();
  const created = await ExpertsService.initiateExpertSession({
    expertId,
    userId,
    scheduledAt: scheduledAt.toISOString(),
    mode: "ONLINE",
  });
  await ExpertsService.reconcileExpertSession({ sessionId: created.sessionId, userId });
  return { sessionId: created.sessionId, expertUserId, userId, scheduledAt };
};

/** Resolves true when the sink has a message, or false after `ms`. */
const nextMessage = (ms: number): Promise<boolean> =>
  new Promise((resolve) => {
    if (received.length > 0) return resolve(true);
    const timer = setTimeout(() => resolve(false), ms);
    onMessage = () => {
      clearTimeout(timer);
      resolve(true);
    };
  });

describe("WhatsApp messages for expert sessions", () => {
  it("says nothing when a booking is paid and is still waiting for the expert", async () => {
    await paidSession();
    assert.equal(await nextMessage(500), false);
  });

  it("tells the parent when the expert accepts the time", async () => {
    const { sessionId, expertUserId, scheduledAt } = await paidSession();
    await ExpertsService.respondToExpertSession({
      sessionId,
      expertUserId,
      action: "ACCEPT",
    });

    assert.equal(await nextMessage(3000), true);
    assert.equal(received.length, 1);
    const sent = received[0]!.body;
    assert.equal(sent.event, "BOOKING_CONFIRMED");
    assert.equal(sent.playerPhone, "919876543210");
    assert.equal(sent.playerName, "Meera Iyer");
    assert.equal(sent.coachName, "Arjun Rao");
    assert.equal(sent.sport, "Tennis");
    assert.equal(sent.dateTime, scheduledAt.toISOString());
    assert.equal(sent.where, "Expert: Arjun Rao. Online.");
    assert.ok(received[0]!.headers["x-pms-signature"]);
  });

  it("tells the parent when the expert declines, and that a refund is owed", async () => {
    const { sessionId, expertUserId } = await paidSession();
    await ExpertsService.respondToExpertSession({
      sessionId,
      expertUserId,
      action: "DECLINE",
    });

    assert.equal(await nextMessage(3000), true);
    assert.equal(received[0]!.body.event, "BOOKING_CANCELLED");
    assert.equal(received[0]!.body.refundAmount, 1000);
  });

  it("tells the parent when the expert moves the session, from the old time to the new", async () => {
    const { sessionId, expertUserId, scheduledAt } = await paidSession();
    const moved = futureSlot(31);
    await ExpertsService.respondToExpertSession({
      sessionId,
      expertUserId,
      action: "RESCHEDULE",
      scheduledAt: moved.toISOString(),
    });

    assert.equal(await nextMessage(3000), true);
    const sent = received[0]!.body;
    assert.equal(sent.event, "BOOKING_RESCHEDULED");
    assert.equal(sent.dateTime, scheduledAt.toISOString());
    assert.equal(sent.newDateTime, moved.toISOString());
  });

  it("tells the parent when the expert cancels, with the refund", async () => {
    const { sessionId, expertUserId } = await paidSession();
    await ExpertsService.cancelExpertSession({ sessionId, actorUserId: expertUserId });

    assert.equal(await nextMessage(3000), true);
    assert.equal(received[0]!.body.event, "BOOKING_CANCELLED");
    assert.equal(received[0]!.body.refundAmount, 1000);
  });

  it("does not promise a refund when an admin cancels", async () => {
    const { sessionId } = await paidSession();
    await ExpertsService.cancelExpertSession({
      sessionId,
      actorUserId: oid().toString(),
      role: "Admin",
    });

    assert.equal(await nextMessage(3000), true);
    assert.equal(received[0]!.body.event, "BOOKING_CANCELLED");
    assert.equal("refundAmount" in received[0]!.body, false);
  });

  it("does not message a parent about their own cancellation", async () => {
    const { sessionId, userId } = await paidSession();
    await ExpertsService.cancelExpertSession({ sessionId, actorUserId: userId });
    assert.equal(await nextMessage(500), false);
  });

  it("says nothing to a parent who never agreed to WhatsApp messages", async () => {
    const { sessionId, expertUserId } = await paidSession({ consent: false });
    await ExpertsService.respondToExpertSession({ sessionId, expertUserId, action: "ACCEPT" });
    assert.equal(await nextMessage(500), false);
  });

  it("says nothing to a parent with no phone number", async () => {
    const { sessionId, expertUserId } = await paidSession({ phone: null });
    await ExpertsService.respondToExpertSession({ sessionId, expertUserId, action: "ACCEPT" });
    assert.equal(await nextMessage(500), false);
  });
});
