// `lifecycle` stays in step with the status fields on every write that goes
// through Mongoose, including the real admin flows.
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
const { Coach } = require("../client/models/Coach");
const { Expert } = require("../client/models/ExpertProfile");
const { Venue } = require("../client/models/Venue");
const Admin = require("../admin/models/Admin").default;
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();
const col = (name: string) => mongoose.connection.db.collection(name);
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const lifecycleOf = async (name: string, id: unknown) =>
  (await col(name).findOne({ _id: id }))?.lifecycle;

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

// Raw insert on purpose: it skips the hooks, like a record from before the field existed.
const rawCoach = async (verificationStatus: string) => {
  const id = oid();
  await col("coaches").insertOne({
    _id: id,
    userId: oid(),
    sports: ["Tennis"],
    hourlyRate: 500,
    serviceMode: "FREELANCE",
    verificationStatus,
    isVerified: verificationStatus === "VERIFIED",
  });
  return id;
};

describe("hooks", () => {
  it("set lifecycle on save", async () => {
    const coach = new Coach({
      userId: oid(),
      sports: ["Tennis"],
      hourlyRate: 500,
      serviceMode: "FREELANCE",
      verificationStatus: "PENDING",
    });
    await coach.save();
    assert.equal(await lifecycleOf("coaches", coach._id), "SUBMITTED");
  });

  it("follow findByIdAndUpdate, findOneAndUpdate and updateOne by id", async () => {
    const id = await rawCoach("UNVERIFIED");
    assert.equal(await lifecycleOf("coaches", id), undefined);

    await Coach.findByIdAndUpdate(id, { verificationStatus: "PENDING" });
    assert.equal(await lifecycleOf("coaches", id), "SUBMITTED");

    await Coach.findOneAndUpdate({ _id: id }, { verificationStatus: "REVIEW" });
    assert.equal(await lifecycleOf("coaches", id), "NEEDS_INFO");

    await Coach.updateOne({ _id: id }, { $set: { verificationStatus: "VERIFIED" } });
    assert.equal(await lifecycleOf("coaches", id), "APPROVED");
  });

  it("follow an expert being switched off and a venue gaining documents", async () => {
    const expertId = oid();
    await col("experts").insertOne({
      _id: expertId,
      userId: oid(),
      sessionFee: 1000,
      verificationStatus: "APPROVED",
      isActive: true,
    });
    await Expert.findByIdAndUpdate(expertId, { isActive: false });
    assert.equal(await lifecycleOf("experts", expertId), "SUSPENDED");

    const venueId = oid();
    await col("venues").insertOne({ _id: venueId, approvalStatus: "PENDING", documents: [] });
    await Venue.findByIdAndUpdate(venueId, {
      $set: {
        documents: [
          { type: "OWNERSHIP_PROOF", url: "https://example.test/d.pdf", fileName: "d.pdf" },
        ],
      },
    });
    assert.equal(await lifecycleOf("venues", venueId), "SUBMITTED");
  });

  it("leave the lifecycle right after an unrelated edit", async () => {
    const id = await rawCoach("UNVERIFIED");
    await Coach.updateOne({ _id: id }, { $set: { bio: "A new bio" } });
    assert.equal(await lifecycleOf("coaches", id), "DRAFT");
  });
});

describe("admin flows", () => {
  it("approve and reject a coach", async () => {
    const id = await rawCoach("PENDING");
    const approved = await request(app)
      .post(`/api/admin/coaches/${id.toString()}/verify`)
      .set(auth(adminToken));
    assert.equal(approved.status, 200);
    assert.equal(await lifecycleOf("coaches", id), "APPROVED");

    const other = await rawCoach("PENDING");
    const rejected = await request(app)
      .post(`/api/admin/coaches/${other.toString()}/reject`)
      .set(auth(adminToken))
      .send({ reason: "Documents are unreadable" });
    assert.equal(rejected.status, 200);
    assert.equal(await lifecycleOf("coaches", other), "REJECTED");
  });

  it("approve then suspend an expert", async () => {
    const id = oid();
    await col("experts").insertOne({
      _id: id,
      userId: oid(),
      sessionFee: 1000,
      verificationStatus: "PENDING",
      isActive: false,
    });
    await request(app).post(`/api/experts/admin/${id.toString()}/approve`).set(auth(adminToken));
    assert.equal(await lifecycleOf("experts", id), "APPROVED");

    await request(app)
      .patch(`/api/experts/admin/${id.toString()}/active`)
      .set(auth(adminToken))
      .send({ isActive: false });
    assert.equal(await lifecycleOf("experts", id), "SUSPENDED");
  });

  it("reject an academy, and clear the rejection when it is resubmitted", async () => {
    const id = oid();
    await col("academies").insertOne({
      _id: id,
      name: "Lifecycle Academy",
      slug: "lifecycle-academy",
      contactEmail: "a@example.com",
      onboardingCompleted: true,
      onboardingStep: 7,
      emailVerified: true,
      isApproved: false,
      isActive: false,
      kycVerified: false,
      panNumber: "ABCDE1234F",
      panDocumentUrl: "https://example.test/pan.pdf",
      upiId: "a@upi",
    });
    const rejected = await request(app)
      .put(`/api/academies/admin/${id.toString()}/reject`)
      .set(auth(adminToken))
      .send({ rejectionReason: "Photos are missing" });
    assert.equal(rejected.status, 200);
    assert.equal(await lifecycleOf("academies", id), "REJECTED");

    // The rejection sends the owner back a step; they finish it and hand it in again.
    await col("academies").updateOne({ _id: id }, { $set: { onboardingStep: 7 } });
    const resubmitted = await request(app)
      .post(`/api/academies/onboarding/${id.toString()}/submit`)
      .set(auth(adminToken));
    assert.equal(resubmitted.status, 200);
    assert.equal(await lifecycleOf("academies", id), "SUBMITTED");
  });
});
