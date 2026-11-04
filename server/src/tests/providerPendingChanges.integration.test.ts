// After approval, edits to claim fields (what a provider says they coach or have
// achieved, and where a venue is) are held for admin review while the approved
// values stay live. Everything else edits freely.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";
process.env.BANK_ENCRYPTION_KEY = "0123456789abcdef".repeat(4);
process.env.EMAIL_HOST = "127.0.0.1";
process.env.EMAIL_PORT = "1";
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
const { encryptValue } = require("../shared/utils/encryption");
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
  for (const name of ["users", "coaches", "experts", "venues", "admins"]) {
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

const DAY = {
  isOpen: true,
  openTime: "09:00",
  closeTime: "21:00",
  slots: [{ startTime: "09:00", endTime: "21:00" }],
};
const WEEK = Object.fromEntries(
  ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"].map((d) => [
    d,
    DAY,
  ])
);

const insertUser = async (role: string) => {
  const id = oid();
  const email = `${id.toString()}@example.test`;
  await col("users").insertOne({
    _id: id,
    name: "Provider",
    email,
    phone: `+91${id.toString().replace(/\D/g, "").padEnd(10, "1").slice(0, 10)}`,
    role,
    isActive: true,
    status: "ACTIVE",
  });
  return { id, token: generateToken({ id: id.toString(), email, role }) };
};

const insertCoach = async (verified: boolean) => {
  const user = await insertUser("Coach");
  const coachId = oid();
  await col("coaches").insertOne({
    _id: coachId,
    userId: user.id,
    bio: "Original bio",
    sports: ["Tennis"],
    certifications: ["Level 1"],
    hourlyRate: 500,
    serviceMode: "FREELANCE",
    availability: [],
    verificationStatus: verified ? "VERIFIED" : "UNVERIFIED",
    isVerified: verified,
    rating: 0,
    reviewCount: 0,
  });
  return { coachId, token: user.token };
};

describe("coach edits after verification", () => {
  it("holds sports and certifications, applies the rest, and keeps the old values public", async () => {
    const { coachId, token } = await insertCoach(true);
    const response = await request(app)
      .put(`/api/coaches/${coachId.toString()}`)
      .set(auth(token))
      .send({
        bio: "New bio",
        hourlyRate: 700,
        sports: ["Tennis", "Chess"],
        certifications: ["Level 2"],
      });
    assert.equal(response.status, 200);
    assert.match(response.body.message, /waiting for review/);

    const stored = await col("coaches").findOne({ _id: coachId });
    assert.equal(stored?.bio, "New bio");
    assert.equal(stored?.hourlyRate, 700);
    assert.deepEqual(stored?.sports, ["Tennis"]);
    assert.deepEqual(stored?.certifications, ["Level 1"]);
    assert.deepEqual(stored?.pendingChanges.fields, {
      sports: ["Tennis", "Chess"],
      certifications: ["Level 2"],
    });

    const pub = await request(app).get(`/api/coaches/${coachId.toString()}`);
    assert.equal(pub.status, 200);
    assert.deepEqual(pub.body.data.sports, ["Tennis"]);
    assert.ok(!JSON.stringify(pub.body).includes("pendingChanges"));
  });

  it("does not treat an unchanged value as a change, and clears a reverted one", async () => {
    const { coachId, token } = await insertCoach(true);
    const put = (body: unknown) =>
      request(app).put(`/api/coaches/${coachId.toString()}`).set(auth(token)).send(body);

    await put({ sports: ["Tennis", "Chess"] });
    assert.ok((await col("coaches").findOne({ _id: coachId }))?.pendingChanges?.fields?.sports);

    await put({ sports: ["Tennis"] });
    assert.equal((await col("coaches").findOne({ _id: coachId }))?.pendingChanges ?? null, null);
  });

  it("lets an unverified coach edit sports directly", async () => {
    const { coachId, token } = await insertCoach(false);
    await request(app)
      .put(`/api/coaches/${coachId.toString()}`)
      .set(auth(token))
      .send({ sports: ["Chess"] });
    const stored = await col("coaches").findOne({ _id: coachId });
    assert.deepEqual(stored?.sports, ["Chess"]);
    assert.equal(stored?.pendingChanges ?? null, null);
  });

  it("applies the held values when an admin approves, and drops them on reject", async () => {
    const { coachId, token } = await insertCoach(true);
    await request(app)
      .put(`/api/coaches/${coachId.toString()}`)
      .set(auth(token))
      .send({ sports: ["Chess"] });

    const queue = await request(app).get("/api/admin/provider-changes").set(auth(adminToken));
    assert.equal(queue.status, 200);
    assert.equal(queue.body.data.length, 1);
    assert.equal(queue.body.data[0].kind, "coach");
    assert.deepEqual(queue.body.data[0].changes[0].proposed, ["Chess"]);

    const rejected = await request(app)
      .post(`/api/admin/provider-changes/coach/${coachId.toString()}/reject`)
      .set(auth(adminToken));
    assert.equal(rejected.status, 200);
    let stored = await col("coaches").findOne({ _id: coachId });
    assert.deepEqual(stored?.sports, ["Tennis"]);
    assert.equal(stored?.pendingChanges ?? null, null);

    await request(app)
      .put(`/api/coaches/${coachId.toString()}`)
      .set(auth(token))
      .send({ sports: ["Chess"] });
    const approved = await request(app)
      .post(`/api/admin/provider-changes/coach/${coachId.toString()}/approve`)
      .set(auth(adminToken));
    assert.equal(approved.status, 200);
    stored = await col("coaches").findOne({ _id: coachId });
    assert.deepEqual(stored?.sports, ["Chess"]);
    assert.equal(stored?.pendingChanges ?? null, null);
  });

  it("refuses to approve when nothing is pending", async () => {
    const { coachId } = await insertCoach(true);
    const response = await request(app)
      .post(`/api/admin/provider-changes/coach/${coachId.toString()}/approve`)
      .set(auth(adminToken));
    assert.equal(response.status, 409);
  });

  it("keeps the review routes away from non-admins", async () => {
    const { coachId, token } = await insertCoach(true);
    const response = await request(app)
      .post(`/api/admin/provider-changes/coach/${coachId.toString()}/approve`)
      .set(auth(token));
    assert.equal(response.status, 403);
  });
});

describe("expert edits after approval", () => {
  it("holds achievements and sports, applies the bio, and approval refreshes approvedSports", async () => {
    const user = await insertUser("EXPERT");
    const expertId = oid();
    await col("experts").insertOne({
      _id: expertId,
      userId: user.id,
      bio: "Original bio that is long enough to pass.",
      achievements: "National champion",
      sports: ["Tennis"],
      approvedSports: ["Tennis"],
      expertise: ["Serve"],
      sessionFee: 1500,
      panNumber: encryptValue("ABCDE1234F"),
      verificationStatus: "APPROVED",
      isActive: true,
    });

    const response = await request(app)
      .patch("/api/experts/me")
      .set(auth(user.token))
      .send({
        bio: "A fresh bio that is long enough.",
        achievements: "World champion",
        sports: ["Tennis", "Chess"],
      });
    assert.equal(response.status, 200);
    assert.match(response.body.message, /waiting for review/);

    let stored = await col("experts").findOne({ _id: expertId });
    assert.equal(stored?.bio, "A fresh bio that is long enough.");
    assert.equal(stored?.achievements, "National champion");
    assert.deepEqual(stored?.sports, ["Tennis"]);

    const pub = await request(app).get(`/api/experts/${expertId.toString()}`);
    assert.equal(pub.body.data.achievements, "National champion");
    assert.ok(!JSON.stringify(pub.body).includes("pendingChanges"));

    const approved = await request(app)
      .post(`/api/admin/provider-changes/expert/${expertId.toString()}/approve`)
      .set(auth(adminToken));
    assert.equal(approved.status, 200);
    stored = await col("experts").findOne({ _id: expertId });
    assert.equal(stored?.achievements, "World champion");
    assert.deepEqual(stored?.sports, ["Tennis", "Chess"]);
    assert.deepEqual(stored?.approvedSports, ["Tennis", "Chess"]);
  });
});

describe("venue edits after approval", () => {
  const insertVenue = async (ownerId: unknown, approvalStatus = "APPROVED") => {
    const id = oid();
    await col("venues").insertOne({
      _id: id,
      ownerId,
      name: "Court One",
      ownerName: "Owner",
      ownerEmail: "owner@example.com",
      ownerPhone: "9876543210",
      address: "1 Test Road",
      location: { type: "Point", coordinates: [76.7, 30.7] },
      sports: ["Tennis"],
      pricePerHour: 500,
      images: [],
      documents: [],
      approvalStatus,
      emailVerified: true,
    });
    return id;
  };

  it("holds name, address and location, applies the rest, and keeps the old name public", async () => {
    const owner = await insertUser("VenueLister");
    const venueId = await insertVenue(owner.id);
    const response = await request(app)
      .put(`/api/venues/${venueId.toString()}`)
      .set(auth(owner.token))
      .send({ name: "Court Two", address: "2 New Road", description: "Floodlit courts" });
    assert.equal(response.status, 200);
    assert.match(response.body.message, /waiting for review/);

    const stored = await col("venues").findOne({ _id: venueId });
    assert.equal(stored?.name, "Court One");
    assert.equal(stored?.address, "1 Test Road");
    assert.equal(stored?.description, "Floodlit courts");
    assert.equal(stored?.pendingChanges.fields.name, "Court Two");

    const pub = await request(app).get(`/api/venues/${venueId.toString()}`);
    assert.equal(pub.body.data.name, "Court One");
    assert.ok(!JSON.stringify(pub.body).includes("pendingChanges"));

    const approved = await request(app)
      .post(`/api/admin/provider-changes/venue/${venueId.toString()}/approve`)
      .set(auth(adminToken));
    assert.equal(approved.status, 200);
    const after = await col("venues").findOne({ _id: venueId });
    assert.equal(after?.name, "Court Two");
    assert.equal(after?.address, "2 New Road");
  });

  it("refuses to rewrite an approved venue through the onboarding token", async () => {
    const owner = await insertUser("VenueLister");
    const venueId = await insertVenue(owner.id);
    const onboardingToken = generateToken({
      id: venueId.toString(),
      email: "owner@example.com",
      role: "VENUE_ONBOARDING",
    });
    const response = await request(app)
      .post("/api/venues/onboarding/step2")
      .set(auth(onboardingToken))
      .send({
        venueId: venueId.toString(),
        name: "Hijacked",
        address: "Elsewhere",
        location: { type: "Point", coordinates: [77, 31] },
        sports: ["Tennis"],
        pricePerHour: 100,
        amenities: [],
        openingHours: WEEK,
        description: "A description long enough to pass validation.",
        allowExternalCoaches: true,
      });
    assert.equal(response.status, 409);
    assert.equal((await col("venues").findOne({ _id: venueId }))?.name, "Court One");
  });

  it("does not hold edits for a venue that is not yet approved", async () => {
    const owner = await insertUser("VenueLister");
    const venueId = await insertVenue(owner.id, "PENDING");
    await request(app)
      .put(`/api/venues/${venueId.toString()}`)
      .set(auth(owner.token))
      .send({ name: "Renamed" });
    const stored = await col("venues").findOne({ _id: venueId });
    assert.equal(stored?.name, "Renamed");
    assert.equal(stored?.pendingChanges ?? null, null);
  });
});
