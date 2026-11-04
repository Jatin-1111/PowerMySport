// A coach cannot submit for verification without evidence on file: an ID proof
// and at least one certification. Other document types stay optional.
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
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();
const col = (name: string) => mongoose.connection.db.collection(name);

let mongod: { getUri(): string; stop(): Promise<void> };

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
  for (const name of ["users", "coaches"]) await col(name).deleteMany({});
});

const doc = (type: string) => ({
  type,
  url: `https://example.test/${type}.pdf`,
  fileName: `${type}.pdf`,
});

const setup = async () => {
  const userId = oid();
  const email = `${userId.toString()}@example.test`;
  await col("users").insertOne({
    _id: userId,
    name: "Coach Proof",
    email,
    phone: "+919876500003",
    photoUrl: "https://example.test/me.jpg",
    role: "Coach",
    isActive: true,
    status: "ACTIVE",
  });
  const coachId = oid();
  await col("coaches").insertOne({
    _id: coachId,
    userId,
    bio: "Junior tennis coach",
    sports: ["Tennis"],
    hourlyRate: 500,
    serviceMode: "FREELANCE",
    verificationStatus: "UNVERIFIED",
    isVerified: false,
    availability: [],
  });
  return { coachId, token: generateToken({ id: userId.toString(), email, role: "Coach" }) };
};

const submit = (token: string, documents: unknown[]) =>
  request(app)
    .post("/api/coaches/verification/step3")
    .set("Authorization", `Bearer ${token}`)
    .send({ documents });

describe("coach verification submit", () => {
  it("is refused with no documents", async () => {
    const { coachId, token } = await setup();
    const response = await submit(token, []);
    assert.equal(response.status, 400);
    assert.equal(
      (await col("coaches").findOne({ _id: coachId }))?.verificationStatus,
      "UNVERIFIED"
    );
  });

  it("is refused with an ID proof but no certification", async () => {
    const { token } = await setup();
    assert.equal((await submit(token, [doc("ID_PROOF")])).status, 400);
  });

  it("is refused with a certification but no ID proof", async () => {
    const { token } = await setup();
    assert.equal((await submit(token, [doc("CERTIFICATION"), doc("INSURANCE")])).status, 400);
  });

  it("goes to review with an ID proof and a certification", async () => {
    const { coachId, token } = await setup();
    const response = await submit(token, [
      doc("ID_PROOF"),
      doc("CERTIFICATION"),
      doc("BACKGROUND_CHECK"),
    ]);
    assert.equal(response.status, 200);
    const stored = await col("coaches").findOne({ _id: coachId });
    assert.equal(stored?.verificationStatus, "PENDING");
    assert.equal(stored?.verificationDocuments.length, 3);
  });

  it("lets an admin submit on a coach's behalf with fewer documents", async () => {
    const { coachId } = await setup();
    const { Admin } = { Admin: require("../admin/models/Admin").default };
    const adminId = oid();
    await Admin.collection.insertOne({
      _id: adminId,
      name: "Admin",
      email: "admin@example.test",
      role: "SYSTEM_ADMIN",
      permissions: [],
      isActive: true,
    });
    const adminToken = generateToken({
      id: adminId.toString(),
      email: "admin@example.test",
      role: "SYSTEM_ADMIN",
    });
    const response = await request(app)
      .post(`/api/admin/coaches/${coachId.toString()}/verification/submit`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ documents: [doc("OTHER")] });
    assert.equal(response.status, 200);
    assert.equal((await col("coaches").findOne({ _id: coachId }))?.verificationStatus, "PENDING");
  });
});
