// The admin review queue (everyone waiting, across all four provider types) and
// the academy rule: the KYC check comes first, then one Approve makes it live.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";
process.env.BANK_ENCRYPTION_KEY = "0123456789abcdef".repeat(4);
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
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

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
  for (const name of ["users", "coaches", "experts", "venues", "academies", "admins"]) {
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

const user = async (name: string, role: string) => {
  const id = oid();
  await col("users").insertOne({ _id: id, name, email: `${id.toString()}@example.test`, role });
  return id;
};

const queue = async () => {
  const response = await request(app).get("/api/admin/review-queue").set(auth(adminToken));
  assert.equal(response.status, 200);
  return response.body;
};

describe("review queue", () => {
  it("lists everyone waiting across the four types, oldest first, with overdue flagged", async () => {
    const coachUser = await user("Coach Waiting", "Coach");
    const expertUser = await user("Expert Waiting", "EXPERT");
    await col("coaches").insertOne({
      _id: oid(),
      userId: coachUser,
      lifecycle: "SUBMITTED",
      verificationSubmittedAt: daysAgo(8),
      updatedAt: daysAgo(1),
    });
    await col("experts").insertOne({
      _id: oid(),
      userId: expertUser,
      lifecycle: "SUBMITTED",
      updatedAt: daysAgo(2),
    });
    await col("venues").insertOne({
      _id: oid(),
      name: "Venue Waiting",
      lifecycle: "NEEDS_INFO",
      updatedAt: daysAgo(5),
    });
    await col("academies").insertOne({
      _id: oid(),
      name: "Academy Waiting",
      lifecycle: "SUBMITTED",
      updatedAt: daysAgo(0),
    });

    const body = await queue();
    assert.deepEqual(
      body.data.map((r: { name: string }) => r.name),
      ["Coach Waiting", "Venue Waiting", "Expert Waiting", "Academy Waiting"]
    );
    assert.equal(body.overdueAfterDays, 5);

    const byName = (n: string) => body.data.find((r: { name: string }) => r.name === n);
    assert.equal(byName("Coach Waiting").ageDays, 8);
    assert.equal(byName("Coach Waiting").overdue, true);
    assert.equal(byName("Venue Waiting").ageDays, 5);
    assert.equal(byName("Venue Waiting").overdue, false);
    assert.equal(byName("Venue Waiting").waitingOn, "More information from the provider");
    assert.equal(byName("Expert Waiting").overdue, false);
    assert.equal(byName("Academy Waiting").kind, "academy");
  });

  it("leaves out drafts, approved, rejected and suspended records", async () => {
    // Distinct users: the coaches collection has a unique index on userId.
    const states = ["DRAFT", "APPROVED", "REJECTED", "SUSPENDED"];
    const users = await Promise.all(states.map((state) => user(`Coach ${state}`, "Coach")));
    await col("coaches").insertMany(
      states.map((lifecycle, i) => ({
        _id: oid(),
        userId: users[i],
        lifecycle,
        updatedAt: daysAgo(10),
      }))
    );
    assert.deepEqual((await queue()).data, []);
  });

  it("names an unfinished venue by its owner, not the placeholder", async () => {
    await col("venues").insertOne({
      _id: oid(),
      name: "Pending Name",
      ownerName: "Real Owner",
      lifecycle: "SUBMITTED",
      updatedAt: daysAgo(1),
    });
    assert.equal((await queue()).data[0].name, "Real Owner");
  });

  it("is for admins only", async () => {
    const plain = await user("Parent", "Parent");
    const token = generateToken({ id: plain.toString(), email: "p@example.test", role: "Parent" });
    const response = await request(app).get("/api/admin/review-queue").set(auth(token));
    assert.equal(response.status, 403);
    const anonymous = await request(app).get("/api/admin/review-queue");
    assert.equal(anonymous.status, 401);
  });

  it("follows a real submission: a coach appears when submitted and leaves when approved", async () => {
    const coachUser = await user("Flow Coach", "Coach");
    const coachId = oid();
    await col("coaches").insertOne({
      _id: coachId,
      userId: coachUser,
      sports: ["Tennis"],
      hourlyRate: 500,
      serviceMode: "FREELANCE",
      verificationStatus: "UNVERIFIED",
      isVerified: false,
    });
    const mongooseModel = require("../client/models/Coach").Coach;
    await mongooseModel.findByIdAndUpdate(coachId, { verificationStatus: "PENDING" });
    assert.equal((await queue()).data.length, 1);

    const approved = await request(app)
      .post(`/api/admin/coaches/${coachId.toString()}/verify`)
      .set(auth(adminToken));
    assert.equal(approved.status, 200);
    assert.equal((await queue()).data.length, 0);
  });
});

describe("academy approval order", () => {
  const submittedAcademy = async (extra: Record<string, unknown> = {}) => {
    const id = oid();
    await col("academies").insertOne({
      _id: id,
      name: "Order Academy",
      slug: `order-${id.toString()}`,
      contactEmail: "owner@example.com",
      onboardingCompleted: true,
      emailVerified: true,
      isApproved: false,
      isActive: false,
      kycVerified: false,
      ...extra,
    });
    return id;
  };
  const approve = (id: unknown) =>
    request(app)
      .put(`/api/academies/admin/${String(id)}/approve`)
      .set(auth(adminToken));
  const kyc = (id: unknown) =>
    request(app)
      .put(`/api/academies/admin/${String(id)}/kyc-verify`)
      .set(auth(adminToken));

  it("refuses Approve until the KYC check is done", async () => {
    const id = await submittedAcademy();
    const response = await approve(id);
    assert.equal(response.status, 409);
    assert.match(response.body.message, /KYC/);
    const stored = await col("academies").findOne({ _id: id });
    assert.equal(stored?.isApproved, false);
    assert.equal(stored?.isActive, false);
  });

  it("does not list an academy on the KYC check alone", async () => {
    const id = await submittedAcademy();
    assert.equal((await kyc(id)).status, 200);
    const stored = await col("academies").findOne({ _id: id });
    assert.equal(stored?.kycVerified, true);
    assert.equal(stored?.isActive, false);
    assert.equal(stored?.lifecycle, "SUBMITTED");
  });

  it("goes live with one Approve once KYC is done", async () => {
    const id = await submittedAcademy();
    await kyc(id);
    assert.equal((await approve(id)).status, 200);
    const stored = await col("academies").findOne({ _id: id });
    assert.equal(stored?.isApproved, true);
    assert.equal(stored?.isActive, true);
    assert.equal(stored?.lifecycle, "APPROVED");
  });

  it("takes an already approved academy live when the KYC check is finally done", async () => {
    const id = await submittedAcademy({ isApproved: true, isActive: false });
    await kyc(id);
    const stored = await col("academies").findOne({ _id: id });
    assert.equal(stored?.isActive, true);
    assert.equal(stored?.lifecycle, "APPROVED");
  });
});
