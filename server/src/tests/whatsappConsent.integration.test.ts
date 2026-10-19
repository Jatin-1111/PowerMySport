/* eslint-disable @typescript-eslint/no-var-requires */
// WhatsApp consent: it is recorded with a date and a source, it can be changed
// from settings, signing up with the box ticked records it, and replying STOP on
// WhatsApp withdraws it whatever form the phone number was saved in.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const { app } = require("../app");
const { generateToken } = require("../utils/jwt");
const { User } = require("../client/models/User");
const redis = require("../config/redis").default;
const {
  getWhatsAppConsent,
  hasWhatsAppConsent,
  setWhatsAppConsent,
  withdrawConsentForPhone,
} = require("../shared/services/whatsappConsent");
const { answerWhatsAppMessage } = require("../shared/services/whatsappAssistantService");

const oid = () => new mongoose.Types.ObjectId();
let mongod: any;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  await User.collection.deleteMany({});
});

const seed = async (phone: string) => {
  const _id = oid();
  const email = `${_id}@example.test`;
  await User.collection.insertOne({
    _id,
    name: "Aarav Sharma",
    email,
    phone,
    role: "Parent",
    isActive: true,
    status: "ACTIVE",
  });
  return {
    id: _id.toString(),
    token: generateToken({ id: _id.toString(), email, role: "Parent" }),
  };
};

const consentOf = async (id: string) =>
  (await User.collection.findOne({ _id: new mongoose.Types.ObjectId(id) })).whatsappConsent;

describe("recording consent", () => {
  it("is a no until the person says yes", async () => {
    const { id } = await seed("9876543210");
    assert.equal((await getWhatsAppConsent(id)).granted, false);
    assert.equal(hasWhatsAppConsent(await User.findById(id).lean()), false);
  });

  it("keeps the date and the place a yes was given, and the first date if asked again", async () => {
    const { id } = await seed("9876543210");
    const first = await setWhatsAppConsent(id, true, "settings");
    assert.equal(first.granted, true);
    assert.equal((await consentOf(id)).source, "settings");

    const again = await setWhatsAppConsent(id, true, "booking");
    assert.equal(again.at.getTime(), first.at.getTime());
    assert.equal((await consentOf(id)).source, "settings");
  });

  it("records a withdrawal and lets a later yes replace it", async () => {
    const { id } = await seed("9876543210");
    await setWhatsAppConsent(id, true, "settings");
    await setWhatsAppConsent(id, false, "settings");
    const off = await consentOf(id);
    assert.equal(off.granted, false);
    assert.ok(off.withdrawnAt);

    await setWhatsAppConsent(id, true, "booking");
    const on = await consentOf(id);
    assert.equal(on.granted, true);
    assert.equal(on.withdrawnAt, undefined);
  });
});

describe("the settings endpoints", () => {
  it("refuses a signed-out caller", async () => {
    assert.equal((await request(app).get("/api/auth/whatsapp-consent")).status, 401);
    assert.equal(
      (await request(app).put("/api/auth/whatsapp-consent").send({ granted: true })).status,
      401
    );
  });

  it("reads and changes the caller's own consent", async () => {
    const { id, token } = await seed("9876543210");
    const auth = { Authorization: `Bearer ${token}` };

    const before = await request(app).get("/api/auth/whatsapp-consent").set(auth);
    assert.equal(before.status, 200);
    assert.equal(before.body.data.granted, false);

    const on = await request(app)
      .put("/api/auth/whatsapp-consent")
      .set(auth)
      .send({ granted: true });
    assert.equal(on.status, 200);
    assert.equal(on.body.data.granted, true);
    assert.equal((await consentOf(id)).source, "settings");

    const off = await request(app)
      .put("/api/auth/whatsapp-consent")
      .set(auth)
      .send({ granted: false });
    assert.equal(off.body.data.granted, false);
  });

  it("rejects anything that is not true or false", async () => {
    const { token } = await seed("9876543210");
    const res = await request(app)
      .put("/api/auth/whatsapp-consent")
      .set({ Authorization: `Bearer ${token}` })
      .send({ granted: "yes" });
    assert.equal(res.status, 400);
  });
});

describe("signing up", () => {
  const body = (extra: Record<string, unknown>) => ({
    name: "Meera Rao",
    email: `meera-${oid()}@example.test`,
    phone: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
    password: "a-long-enough-password",
    acceptedTerms: true,
    acceptedPrivacy: true,
    role: "Parent",
    ...extra,
  });

  it("records consent when the box was ticked", async () => {
    const payload = body({ whatsappConsent: true });
    const res = await request(app).post("/api/auth/register").send(payload);
    assert.equal(res.status, 201);
    const stored = (await User.collection.findOne({ email: payload.email })).whatsappConsent;
    assert.equal(stored.granted, true);
    assert.equal(stored.source, "signup");
  });

  it("records nothing when it was not", async () => {
    const payload = body({});
    const res = await request(app).post("/api/auth/register").send(payload);
    assert.equal(res.status, 201);
    const stored = (await User.collection.findOne({ email: payload.email })).whatsappConsent;
    assert.ok(!stored || stored.granted !== true);
  });
});

describe("replying STOP on WhatsApp", () => {
  it("withdraws consent for the account, whatever form the phone was saved in", async () => {
    const a = await seed("9876543210");
    const b = await seed("+91 98765 43211");
    const other = await seed("9000000000");
    for (const u of [a, b, other]) await setWhatsAppConsent(u.id, true, "settings");

    assert.equal(await withdrawConsentForPhone("919876543210"), 1);
    assert.equal((await consentOf(a.id)).granted, false);
    assert.equal((await consentOf(b.id)).granted, true);
    assert.equal((await consentOf(other.id)).granted, true);

    assert.equal(await withdrawConsentForPhone("919876543211"), 1);
    assert.equal((await consentOf(b.id)).granted, false);
    assert.equal((await consentOf(other.id)).granted, true);
  });

  it("is what the assistant does when someone sends STOP", async () => {
    const { id } = await seed("9876543210");
    await setWhatsAppConsent(id, true, "settings");
    const answer = await answerWhatsAppMessage({
      id: "wamid.test",
      from: "919876543210",
      type: "text",
      text: "STOP",
    });
    assert.match(answer.reply, /deleted this chat/);
    assert.equal((await consentOf(id)).granted, false);
  });
});
