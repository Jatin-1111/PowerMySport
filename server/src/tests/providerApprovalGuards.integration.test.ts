// Approval guards for the four provider types, and the public venue detail
// route. A venue row exists from onboarding step 1, so "exists" is not
// "submitted": drafts must not be public, queued or approvable.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";
process.env.BANK_ENCRYPTION_KEY = "0123456789abcdef".repeat(4);

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
  for (const name of ["users", "coaches", "venues", "academies", "experts", "admins"]) {
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

const insertVenue = async (extra: Record<string, unknown> = {}) => {
  const id = oid();
  await col("venues").insertOne({
    _id: id,
    name: "Court One",
    ownerName: "Owner",
    ownerEmail: `${id.toString()}@example.test`,
    ownerPhone: "9876543210",
    address: "1 Test Road",
    location: { type: "Point", coordinates: [76.7, 30.7] },
    sports: ["Tennis"],
    images: [],
    documents: [],
    approvalStatus: "PENDING",
    ...extra,
  });
  return id.toString();
};

describe("venue drafts", () => {
  it("are not public, whatever their status", async () => {
    const pending = await insertVenue({ name: "Pending Name" });
    const rejected = await insertVenue({ approvalStatus: "REJECTED" });
    for (const id of [pending, rejected]) {
      const response = await request(app).get(`/api/venues/${id}`);
      assert.equal(response.status, 404);
    }
  });

  it("still serve an approved venue", async () => {
    const id = await insertVenue({ approvalStatus: "APPROVED" });
    const response = await request(app).get(`/api/venues/${id}`);
    assert.equal(response.status, 200);
  });

  it("stay out of the admin queue until documents are uploaded", async () => {
    const draft = await insertVenue({ name: "Pending Name" });
    const submitted = await insertVenue({
      documents: [
        { type: "OWNERSHIP_PROOF", url: "https://example.test/d.pdf", fileName: "d.pdf" },
      ],
    });
    const response = await request(app)
      .get("/api/venues/onboarding/admin/pending")
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(response.status, 200);
    const text = JSON.stringify(response.body);
    assert.ok(text.includes(submitted));
    assert.ok(!text.includes(draft));
  });

  it("cannot be approved before images and documents exist", async () => {
    const id = await insertVenue({ name: "Pending Name" });
    const response = await request(app)
      .post(`/api/venues/onboarding/admin/${id}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(response.status, 409);
    const stored = await col("venues").findOne({ _id: new mongoose.Types.ObjectId(id) });
    assert.equal(stored?.approvalStatus, "PENDING");
  });
});

describe("approving something never submitted", () => {
  it("is refused for a coach who has not submitted verification", async () => {
    const coachId = oid();
    await col("coaches").insertOne({
      _id: coachId,
      userId: oid(),
      sports: ["Tennis"],
      hourlyRate: 500,
      serviceMode: "FREELANCE",
      verificationStatus: "UNVERIFIED",
      isVerified: false,
    });
    const response = await request(app)
      .post(`/api/admin/coaches/${coachId.toString()}/verify`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(response.status, 409);
    const stored = await col("coaches").findOne({ _id: coachId });
    assert.equal(stored?.verificationStatus, "UNVERIFIED");
    assert.equal(stored?.isVerified, false);
  });

  it("is refused for an expert who has not submitted their profile", async () => {
    const expertId = oid();
    await col("experts").insertOne({
      _id: expertId,
      userId: oid(),
      sessionFee: 1000,
      sports: ["Tennis"],
      verificationStatus: "UNVERIFIED",
      isActive: false,
    });
    const response = await request(app)
      .post(`/api/experts/admin/${expertId.toString()}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.ok(response.status >= 400, `expected an error, got ${response.status}`);
    const stored = await col("experts").findOne({ _id: expertId });
    assert.equal(stored?.verificationStatus, "UNVERIFIED");
    assert.equal(stored?.isActive, false);
  });

  it("is refused for an academy that has not submitted", async () => {
    const academyId = oid();
    await col("academies").insertOne({
      _id: academyId,
      name: "Draft Academy",
      slug: "draft-academy",
      contactEmail: "draft@example.test",
      onboardingCompleted: false,
      isApproved: false,
      isActive: false,
    });
    const response = await request(app)
      .put(`/api/academies/admin/${academyId.toString()}/approve`)
      .set("Authorization", `Bearer ${adminToken}`);
    assert.equal(response.status, 409);
    const stored = await col("academies").findOne({ _id: academyId });
    assert.equal(stored?.isApproved, false);
  });
});
