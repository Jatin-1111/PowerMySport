// The admin lists carry what the shared status badge needs: `lifecycle`, and for
// academies the live and rejection fields that the old list left out. The public
// expert view carries none of it.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";
process.env.BANK_ENCRYPTION_KEY = "0123456789abcdef".repeat(4);
process.env.AWS_ACCESS_KEY_ID = "test";
process.env.AWS_SECRET_ACCESS_KEY = "test";
process.env.AWS_REGION = "ap-south-1";

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
  for (const name of ["users", "experts", "academies", "admins"]) await col(name).deleteMany({});
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

describe("academy admin list", () => {
  it("carries lifecycle, isActive and the rejection reason", async () => {
    await col("academies").insertMany([
      {
        _id: oid(),
        name: "Live Academy",
        slug: "live",
        contactEmail: "a@example.com",
        onboardingCompleted: true,
        isApproved: true,
        isActive: true,
        kycVerified: true,
        lifecycle: "APPROVED",
      },
      {
        _id: oid(),
        name: "Rejected Academy",
        slug: "rejected",
        contactEmail: "b@example.com",
        onboardingCompleted: true,
        isApproved: false,
        isActive: false,
        kycVerified: false,
        rejectionReason: "Photos are missing",
        lifecycle: "REJECTED",
      },
    ]);

    const response = await request(app)
      .get("/api/academies/admin/pending?filter=all")
      .set(auth(adminToken));
    assert.equal(response.status, 200);
    const byName = (n: string) =>
      response.body.data.academies.find((a: { name: string }) => a.name === n);

    assert.equal(byName("Live Academy").lifecycle, "APPROVED");
    assert.equal(byName("Live Academy").isActive, true);
    assert.equal(byName("Rejected Academy").lifecycle, "REJECTED");
    assert.equal(byName("Rejected Academy").rejectionReason, "Photos are missing");
  });
});

describe("expert payloads", () => {
  it("give admins the lifecycle and keep it out of the public view", async () => {
    const userId = oid();
    await col("users").insertOne({
      _id: userId,
      name: "Expert",
      email: "e@example.test",
      role: "EXPERT",
    });
    const expertId = oid();
    await col("experts").insertOne({
      _id: expertId,
      userId,
      bio: "Former national player",
      sports: ["Tennis"],
      expertise: ["Serve"],
      sessionFee: 1000,
      verificationStatus: "APPROVED",
      isActive: true,
      lifecycle: "APPROVED",
    });

    const admin = await request(app).get("/api/experts/admin/all").set(auth(adminToken));
    assert.equal(admin.status, 200);
    assert.equal(admin.body.data[0].lifecycle, "APPROVED");

    const pub = await request(app).get(`/api/experts/${expertId.toString()}`);
    assert.equal(pub.status, 200);
    assert.ok(!JSON.stringify(pub.body).includes("lifecycle"));
  });
});
