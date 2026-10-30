// Venue approval creates or links the owner's account. It needs a verified
// email, matches on that email only, and never mails a password.
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
  for (const name of ["users", "venues", "admins"]) await col(name).deleteMany({});
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

const OWNER_EMAIL = "lister@example.test";
const OWNER_PHONE = "9876500001";

const insertSubmittedVenue = async (extra: Record<string, unknown> = {}) => {
  const id = oid();
  await col("venues").insertOne({
    _id: id,
    name: "Court One",
    ownerName: "Venue Owner",
    ownerEmail: OWNER_EMAIL,
    ownerPhone: OWNER_PHONE,
    address: "1 Test Road",
    location: { type: "Point", coordinates: [76.7, 30.7] },
    sports: ["Tennis"],
    pricePerHour: 500,
    images: ["a", "b", "c", "d", "e"].map((n) => `https://example.test/${n}.jpg`),
    documents: [{ type: "OWNERSHIP_PROOF", url: "https://example.test/d.pdf", fileName: "d.pdf" }],
    approvalStatus: "PENDING",
    emailVerified: true,
    ...extra,
  });
  return id;
};

const insertUser = async (extra: Record<string, unknown>) => {
  const id = oid();
  await col("users").insertOne({
    _id: id,
    name: "Existing",
    email: `${id.toString()}@example.test`,
    phone: `9${id.toString().slice(-9)}`,
    role: "Player",
    isActive: true,
    status: "ACTIVE",
    ...extra,
  });
  return id;
};

const approve = (venueId: unknown) =>
  request(app)
    .post(`/api/venues/onboarding/admin/${String(venueId)}/approve`)
    .set("Authorization", `Bearer ${adminToken}`);

describe("venue approval", () => {
  it("is refused while the owner email is unverified", async () => {
    const venueId = await insertSubmittedVenue({ emailVerified: false });
    const response = await approve(venueId);
    assert.equal(response.status, 409);
    assert.equal(await col("users").countDocuments({}), 0);
    assert.equal((await col("venues").findOne({ _id: venueId }))?.approvalStatus, "PENDING");
  });

  it("is refused when the email belongs to an account with another role", async () => {
    const venueId = await insertSubmittedVenue();
    await insertUser({ email: OWNER_EMAIL, role: "Parent" });
    const response = await approve(venueId);
    assert.equal(response.status, 409);
    assert.equal(await col("users").countDocuments({}), 1);
    assert.equal((await col("venues").findOne({ _id: venueId }))?.approvalStatus, "PENDING");
  });

  it("never links to an account by phone number alone", async () => {
    const venueId = await insertSubmittedVenue();
    const other = await insertUser({ phone: OWNER_PHONE, role: "VenueLister" });
    const response = await approve(venueId);
    assert.equal(response.status, 409);
    const stored = await col("venues").findOne({ _id: venueId });
    assert.equal(stored?.approvalStatus, "PENDING");
    assert.notEqual(String(stored?.ownerId ?? ""), other.toString());
  });

  it("creates a lister account with no usable password for a new email", async () => {
    const venueId = await insertSubmittedVenue();
    const response = await approve(venueId);
    assert.equal(response.status, 200);
    const user = await col("users").findOne({ email: OWNER_EMAIL });
    assert.equal(user?.role, "VenueLister");
    assert.ok(user?.password && user.password !== "", "a password hash is stored");
    const stored = await col("venues").findOne({ _id: venueId });
    assert.equal(stored?.approvalStatus, "APPROVED");
    assert.equal(String(stored?.ownerId), String(user?._id));
  });

  it("links an existing lister account that has the same verified email", async () => {
    const venueId = await insertSubmittedVenue();
    const lister = await insertUser({ email: OWNER_EMAIL, role: "VenueLister" });
    const response = await approve(venueId);
    assert.equal(response.status, 200);
    assert.equal(String((await col("venues").findOne({ _id: venueId }))?.ownerId), String(lister));
    assert.equal(await col("users").countDocuments({}), 1);
  });
});

describe("venue onboarding finalize", () => {
  const finalize = (venueId: unknown) =>
    request(app)
      .post("/api/venues/onboarding/step4/finalize")
      .set(
        "Authorization",
        `Bearer ${generateToken({
          id: String(venueId),
          email: OWNER_EMAIL,
          role: "VENUE_ONBOARDING",
        })}`
      )
      .send({
        venueId: String(venueId),
        images: ["a", "b", "c", "d", "e"].map((n) => `https://example.test/${n}.jpg`),
        coverPhotoUrl: "https://example.test/cover.jpg",
        documents: [
          { type: "OWNERSHIP_PROOF", url: "https://example.test/d.pdf", fileName: "d.pdf" },
        ],
      });

  it("is refused until the email is verified", async () => {
    const venueId = await insertSubmittedVenue({ emailVerified: false, documents: [], images: [] });
    const response = await finalize(venueId);
    assert.equal(response.status, 403);
    assert.equal(((await col("venues").findOne({ _id: venueId }))?.documents ?? []).length, 0);
  });

  it("goes through once the email is verified", async () => {
    const venueId = await insertSubmittedVenue({ emailVerified: true, documents: [], images: [] });
    const response = await finalize(venueId);
    assert.equal(response.status, 200);
    assert.equal(((await col("venues").findOne({ _id: venueId }))?.documents ?? []).length, 1);
  });
});
