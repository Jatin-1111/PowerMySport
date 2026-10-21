/* eslint-disable @typescript-eslint/no-var-requires */
// The booking WhatsApp messages hang off `sendBookingLifecycleEmails`, which every
// path that emails a player goes through. These pin which states send one: a
// confirmed booking and a cancelled one do, a booking still waiting on its
// provider does not (it is not confirmed yet), and a player with no phone gets
// nothing. The n8n side is a local sink; no message leaves the machine.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";

import assert = require("node:assert/strict");
import http = require("node:http");
const { after, afterEach, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { User } = require("../client/models/User");
const { sendBookingLifecycleEmails } = require("../client/services/bookingService/notifications");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();

let mongod: any;
let sink: http.Server;
let received: Array<{ headers: http.IncomingHttpHeaders; body: any }> = [];
let onMessage: (() => void) | null = null;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
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
});

after(async () => {
  sink.close();
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  await User.collection.deleteMany({});
  received = [];
  onMessage = null;
});

afterEach(() => {
  onMessage = null;
});

const seedPlayer = async (phone?: string, consent = true) => {
  const _id = oid();
  await User.collection.insertOne({
    _id,
    name: "Aarav Sharma",
    email: `aarav-${_id}@example.test`,
    role: "Player",
    ...(phone ? { phone } : {}),
    ...(consent ? { whatsappConsent: { granted: true, at: new Date(), source: "settings" } } : {}),
  });
  return _id;
};

const booking = (userId: unknown) =>
  ({
    _id: oid(),
    userId,
    venueId: oid(),
    sport: "Tennis",
    // UTC midnight of the booking day; the times are IST wall-clock.
    date: new Date("2026-10-20T00:00:00.000Z"),
    startTime: "18:00",
    endTime: "19:00",
    totalAmount: 500,
  }) as any;

/** Resolves when n8n has received one message, or false after `ms`. */
const nextMessage = (ms: number): Promise<boolean> =>
  new Promise((resolve) => {
    if (received.length > 0) return resolve(true);
    const timer = setTimeout(() => resolve(false), ms);
    onMessage = () => {
      clearTimeout(timer);
      resolve(true);
    };
  });

describe("booking WhatsApp messages by state", () => {
  it("tells the player a booking is confirmed, with the real IST start", async () => {
    const userId = await seedPlayer("9876543210");
    await sendBookingLifecycleEmails(booking(userId), "CONFIRMED");

    assert.equal(await nextMessage(3000), true);
    assert.equal(received.length, 1);
    const sent = received[0]!.body;
    assert.equal(sent.event, "BOOKING_CONFIRMED");
    assert.equal(sent.playerPhone, "919876543210");
    assert.equal(sent.playerName, "Aarav Sharma");
    assert.equal(sent.sport, "Tennis");
    // 18:00 IST is 12:30 UTC.
    assert.equal(sent.dateTime, "2026-10-20T12:30:00.000Z");
    assert.equal("refundAmount" in sent, false);
    assert.ok(received[0]!.headers["x-pms-signature"]);
  });

  it("tells the player a booking is cancelled, with the refund", async () => {
    const userId = await seedPlayer("9876543210");
    await sendBookingLifecycleEmails(booking(userId), "CANCELLED", { refundAmount: 400 });

    assert.equal(await nextMessage(3000), true);
    assert.equal(received[0]!.body.event, "BOOKING_CANCELLED");
    assert.equal(received[0]!.body.refundAmount, 400);
  });

  it("says nothing while the booking is still waiting on its provider", async () => {
    const userId = await seedPlayer("9876543210");
    await sendBookingLifecycleEmails(booking(userId), "AWAITING_PROVIDER");
    assert.equal(await nextMessage(400), false);
    assert.equal(received.length, 0);
  });

  it("says nothing to a player who never agreed to WhatsApp messages", async () => {
    const userId = await seedPlayer("9876543210", false);
    await sendBookingLifecycleEmails(booking(userId), "CONFIRMED");
    assert.equal(await nextMessage(400), false);
    assert.equal(received.length, 0);
  });

  it("says nothing to a player who has withdrawn", async () => {
    const userId = await seedPlayer("9876543210");
    await User.collection.updateOne(
      { _id: userId },
      { $set: { "whatsappConsent.granted": false, "whatsappConsent.withdrawnAt": new Date() } }
    );
    await sendBookingLifecycleEmails(booking(userId), "CANCELLED", { refundAmount: 400 });
    assert.equal(await nextMessage(400), false);
    assert.equal(received.length, 0);
  });

  it("says nothing to a player with no phone number", async () => {
    const userId = await seedPlayer();
    await sendBookingLifecycleEmails(booking(userId), "CONFIRMED");
    assert.equal(await nextMessage(400), false);
    assert.equal(received.length, 0);
  });
});
