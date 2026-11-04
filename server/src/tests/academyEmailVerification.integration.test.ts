// Academy sign-up is public. It must not link anyone's account, must not let an
// unconfirmed email lock the real owner out, and needs a confirmed email before
// the academy can be submitted. The owner account is linked at approval, by the
// verified email only.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";
process.env.BANK_ENCRYPTION_KEY = "0123456789abcdef".repeat(4);
// Mail must never leave the machine from a test: dotenv does not overwrite these.
process.env.EMAIL_HOST = "127.0.0.1";
process.env.EMAIL_PORT = "1";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const { app } = require("../app");
const { generateToken } = require("../utils/jwt");
const Admin = require("../admin/models/Admin").default;
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();
const col = (name: string) => mongoose.connection.db.collection(name);

let mongod: { getUri(): string; stop(): Promise<void> };
let adminToken: string;

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
  for (const name of ["users", "academies", "admins", "emailverifications", "ratelimits"]) {
    await col(name).deleteMany({});
  }
  const adminId = oid();
  await Admin.collection.insertOne({
    _id: adminId,
    name: "Admin",
    email: "admin@example.test",
    role: "SYSTEM_ADMIN",
    permissions: [],
    isActive: true,
  });
  adminToken = generateToken({
    id: adminId.toString(),
    email: "admin@example.test",
    role: "SYSTEM_ADMIN",
  });
});

const EMAIL = "owner@example.com";
const PHONE = "+919876500002";

const startBody = (extra: Record<string, unknown> = {}) => ({
  ownerName: "Academy Owner",
  ownerEmail: EMAIL,
  ownerPhone: PHONE,
  name: "Test Academy",
  legalName: "Test Academy Pvt Ltd",
  sports: ["Tennis"],
  ageGroups: ["kids"],
  description: "A tennis academy for juniors.",
  ...extra,
});

const start = async (extra: Record<string, unknown> = {}) => {
  const response = await request(app)
    .post("/api/academies/onboarding/start")
    .send(startBody(extra));
  return {
    status: response.status,
    id: response.body?.data?.academyId as string,
    token: response.body?.data?.onboardingToken as string,
  };
};

const insertUser = async (extra: Record<string, unknown>) => {
  const id = oid();
  await col("users").insertOne({
    _id: id,
    name: "Existing",
    email: `${id.toString()}@example.test`,
    phone: `+91${id.toString().replace(/\D/g, "").padEnd(10, "1").slice(0, 10)}`,
    role: "Player",
    isActive: true,
    status: "ACTIVE",
    ...extra,
  });
  return id;
};

const TOKEN_HEADER = "x-academy-onboarding-token";

describe("academy start", () => {
  it("does not link an existing account by email or phone", async () => {
    await insertUser({ email: EMAIL, role: "Parent" });
    await insertUser({ phone: PHONE, role: "Parent" });
    const started = await start();
    assert.equal(started.status, 201);
    const stored = await col("academies").findOne({ _id: new mongoose.Types.ObjectId(started.id) });
    assert.equal(stored?.ownerId ?? null, null);
    assert.equal(stored?.emailVerified, false);
  });

  it("is not blocked by an unconfirmed draft for the same email", async () => {
    assert.equal((await start()).status, 201);
    assert.equal((await start({ name: "Second Academy" })).status, 201);
  });

  it("is blocked by a draft whose email was confirmed", async () => {
    const first = await start();
    await col("academies").updateOne(
      { _id: new mongoose.Types.ObjectId(first.id) },
      { $set: { emailVerified: true } }
    );
    const second = await start({ name: "Second Academy" });
    assert.ok(second.status >= 400);
  });
});

describe("academy email confirmation", () => {
  it("blocks submission until the email is confirmed", async () => {
    const started = await start();
    const response = await request(app)
      .post(`/api/academies/onboarding/${started.id}/submit`)
      .set(TOKEN_HEADER, started.token);
    assert.equal(response.status, 403);
  });

  it("confirms with the emailed code, and rejects a wrong one", async () => {
    const started = await start();
    const sent = await request(app)
      .post(`/api/academies/onboarding/${started.id}/send-verification`)
      .set(TOKEN_HEADER, started.token);
    assert.equal(sent.status, 200);

    const record = await col("emailverifications").findOne({ email: EMAIL });
    assert.ok(record?.code, "a code was stored for the contact email");

    const wrongCode = record.code === "000000" ? "111111" : "000000";
    const wrong = await request(app)
      .post(`/api/academies/onboarding/${started.id}/verify-email`)
      .set(TOKEN_HEADER, started.token)
      .send({ code: wrongCode });
    assert.equal(wrong.status, 400);

    const right = await request(app)
      .post(`/api/academies/onboarding/${started.id}/verify-email`)
      .set(TOKEN_HEADER, started.token)
      .send({ code: record.code });
    assert.equal(right.status, 200);
    const stored = await col("academies").findOne({ _id: new mongoose.Types.ObjectId(started.id) });
    assert.equal(stored?.emailVerified, true);
  });

  it("needs the onboarding token", async () => {
    const started = await start();
    const response = await request(app).post(
      `/api/academies/onboarding/${started.id}/send-verification`
    );
    assert.equal(response.status, 404);
  });
});

describe("academy approval links the owner", () => {
  const submitted = async () => {
    const started = await start();
    await col("academies").updateOne(
      { _id: new mongoose.Types.ObjectId(started.id) },
      { $set: { onboardingCompleted: true, emailVerified: true, kycVerified: true } }
    );
    return new mongoose.Types.ObjectId(started.id);
  };
  const approve = (id: unknown) =>
    request(app)
      .put(`/api/academies/admin/${String(id)}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);

  it("links an Academy account with the same email", async () => {
    const id = await submitted();
    const owner = await insertUser({ email: EMAIL, role: "Academy" });
    const response = await approve(id);
    assert.equal(response.status, 200);
    assert.equal(String((await col("academies").findOne({ _id: id }))?.ownerId), String(owner));
  });

  it("is refused when that email belongs to another role", async () => {
    const id = await submitted();
    await insertUser({ email: EMAIL, role: "Parent" });
    const response = await approve(id);
    assert.equal(response.status, 409);
    assert.equal((await col("academies").findOne({ _id: id }))?.isApproved, false);
  });
});
