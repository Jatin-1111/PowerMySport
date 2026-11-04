/* eslint-disable @typescript-eslint/no-var-requires */
// The WhatsApp copy of an email verification code: a bad number is never sent to
// Meta, one number cannot be sent more than three codes an hour whatever email
// the requests name, and the endpoint itself is limited per IP. The n8n side is a
// local sink; no message leaves the machine.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
import http = require("node:http");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { sendOtpToWhatsApp } = require("../shared/services/EmailVerificationService");
const { isIndianMobile } = require("../shared/services/WhatsAppNotificationService");
const { RateLimit } = require("../shared/models/RateLimit");
const redis = require("../config/redis").default;

let mongod: any;
let sink: http.Server;
let received: Array<{ body: any }> = [];

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  sink = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      res.end("OK");
      received.push({ body: JSON.parse(raw) });
    });
  });
  await new Promise<void>((resolve) => sink.listen(0, "127.0.0.1", resolve));
  const { port } = sink.address() as { port: number };
  process.env.N8N_OTP_WEBHOOK_URL = `http://127.0.0.1:${port}/webhook/otp`;
  process.env.PMS_SERVER_WEBHOOK_SECRET = "test-shared-secret";
});

after(async () => {
  sink.close();
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  await RateLimit.deleteMany({});
  received = [];
});

/** Lets any posts to the sink arrive. */
const settle = () => new Promise((r) => setTimeout(r, 200));

describe("which numbers count as Indian mobiles", () => {
  it("accepts 91 followed by a 6-9 number, and nothing else", () => {
    assert.equal(isIndianMobile("919876543210"), true);
    assert.equal(isIndianMobile("916000000000"), true);
    assert.equal(isIndianMobile("915876543210"), false);
    assert.equal(isIndianMobile("9198765"), false);
    assert.equal(isIndianMobile("14155550123"), false);
    assert.equal(isIndianMobile(""), false);
  });
});

describe("the WhatsApp copy of a verification code", () => {
  it("sends a valid number the code, in Meta's form", async () => {
    assert.equal(await sendOtpToWhatsApp("98765 43210", "123456", "Aarav"), true);
    await settle();
    assert.equal(received.length, 1);
    assert.equal(received[0]!.body.phone, "919876543210");
    assert.equal(received[0]!.body.otp, "123456");
  });

  it("sends nothing for a missing or malformed number", async () => {
    for (const phone of [undefined, "", "12345", "abcdefghij", "+1 415 555 0123", "5876543210"]) {
      assert.equal(await sendOtpToWhatsApp(phone, "123456", "Aarav"), false, String(phone));
    }
    await settle();
    assert.equal(received.length, 0);
  });

  it("stops after three codes an hour to one number, in any form it is typed", async () => {
    const forms = ["9876543210", "+91 98765 43210", "09876543210", "919876543210"];
    const results = [];
    for (const phone of forms) results.push(await sendOtpToWhatsApp(phone, "123456", "A"));
    assert.deepEqual(results, [true, true, true, false]);
    await settle();
    assert.equal(received.length, 3);
  });

  it("limits each number on its own", async () => {
    for (let i = 0; i < 3; i++) await sendOtpToWhatsApp("9876543210", "111111", "A");
    assert.equal(await sendOtpToWhatsApp("9876543210", "111111", "A"), false);
    assert.equal(await sendOtpToWhatsApp("9876543211", "111111", "A"), true);
  });

  it("lets a number send again once its hour is up", async () => {
    for (let i = 0; i < 3; i++) await sendOtpToWhatsApp("9876543210", "111111", "A");
    assert.equal(await sendOtpToWhatsApp("9876543210", "111111", "A"), false);
    await RateLimit.updateMany(
      { type: "WHATSAPP_OTP" },
      { $set: { resetAt: new Date(Date.now() - 1000) } }
    );
    assert.equal(await sendOtpToWhatsApp("9876543210", "111111", "A"), true);
  });

  it("does not keep the phone number itself", async () => {
    await sendOtpToWhatsApp("9876543210", "123456", "A");
    const stored = await RateLimit.collection.find({}).toArray();
    assert.equal(JSON.stringify(stored).includes("9876543210"), false);
  });
});
