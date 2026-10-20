/* eslint-disable @typescript-eslint/no-var-requires */
// The unauthenticated expert endpoints must expose an explicit allow-list of
// public fields and nothing else. GET /api/experts and GET /api/experts/:id
// used to return the expert's login email (plus verificationStatus and
// createdAt) because the public serializer was also the base of the owner view.
//
// These go through the real `app`, so the real routes and caching middleware
// are in the path. The owner (/me) and admin (/admin/all) views are asserted
// too, since they must keep the fields the public view lost.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
// No Redis in tests: every Redis-backed path (including the 60s response cache on
// these routes) fails open immediately, so each request hits the real handler.
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const { app } = require("../app");
const { generateToken } = require("../utils/jwt");
const { User } = require("../client/models/User");
const { Expert } = require("../client/models/ExpertProfile");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();

// Exactly the fields a visitor may see. Anything else on the response is a leak.
const PUBLIC_KEYS = [
  "_id",
  "achievements",
  "bio",
  "city",
  "expertise",
  "hasAvailability",
  "id",
  "isActive",
  "languages",
  "name",
  "photoUrl",
  "rating",
  "reviewCount",
  "sessionDurationMinutes",
  "sessionFee",
  "sessionMode",
  "sports",
  "timezone",
].sort();

const PRIVATE_KEYS = [
  "email",
  "phone",
  "userId",
  "verificationStatus",
  "createdAt",
  "updatedAt",
  "inPersonAddress",
  "panNumber",
  "gstNumber",
  "payoutMethods",
  "photoKey",
  "weeklyAvailability",
  "blackoutDates",
  "rejectionReason",
  "approvedSports",
  "createdBy",
];

const EXPERT_EMAIL = "private.expert@example.test";
const EXPERT_PHONE = "9123456789";

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

const insertUser = async (role: string, overrides: Record<string, unknown> = {}) => {
  const id = oid();
  await User.collection.insertOne({
    _id: id,
    name: `Test ${role}`,
    email: `${id.toString()}@example.test`,
    phone: `9${id.toString().slice(-9)}`,
    role,
    isActive: true,
    status: "ACTIVE",
    ...overrides,
  });
  return { id, token: generateToken({ id: id.toString(), email: `${id}@example.test`, role }) };
};

let activeExpertId: any;
let expertToken: string;

beforeEach(async () => {
  for (const name of ["users", "experts"]) {
    await mongoose.connection.db.collection(name).deleteMany({});
  }
  const expertUser = await insertUser("EXPERT", {
    name: "Public Expert",
    email: EXPERT_EMAIL,
    phone: EXPERT_PHONE,
  });
  expertToken = expertUser.token;
  activeExpertId = oid();
  await Expert.collection.insertOne({
    _id: activeExpertId,
    userId: expertUser.id,
    bio: "Former national player",
    sports: ["Tennis"],
    expertise: ["Technique"],
    achievements: "National semi-finalist",
    sessionFee: 1500,
    sessionMode: "BOTH",
    sessionDurationMinutes: 45,
    timezone: "Asia/Kolkata",
    weeklyAvailability: [{ dayOfWeek: 1, start: "09:00", end: "12:00" }],
    blackoutDates: ["2030-01-01"],
    city: "Bengaluru",
    languages: ["English"],
    photoUrl: "https://example.test/p.jpg",
    photoKey: "experts/p.jpg",
    inPersonAddress: "12 Private Lane, Bengaluru",
    isActive: true,
    verificationStatus: "APPROVED",
    approvedSports: ["Tennis"],
    rating: 4.5,
    reviewCount: 3,
    panNumber: "ABCDE1234F",
    gstNumber: "29ABCDE1234F1Z5",
    payoutMethods: [{ type: "UPI", upiId: "secret@upi" }],
    createdBy: oid(),
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  // An inactive expert must be absent from the list and 404 on detail.
  const hiddenUser = await insertUser("EXPERT", { name: "Hidden Expert" });
  await Expert.collection.insertOne({
    _id: oid(),
    userId: hiddenUser.id,
    bio: "Not live",
    sports: ["Tennis"],
    expertise: [],
    sessionFee: 1000,
    sessionMode: "ONLINE",
    isActive: false,
    verificationStatus: "PENDING",
    rating: 0,
    reviewCount: 0,
    payoutMethods: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
});

const assertPublicShape = (expert: Record<string, unknown>) => {
  assert.deepEqual(Object.keys(expert).sort(), PUBLIC_KEYS);
  for (const key of PRIVATE_KEYS) {
    assert.equal(key in expert, false, `public expert response leaked "${key}"`);
  }
};

describe("public expert list", () => {
  it("returns only the allow-listed fields", async () => {
    const res = await request(app).get("/api/experts?limit=200");
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
    assertPublicShape(res.body.data[0]);
    assert.equal(res.body.data[0].name, "Public Expert");
    assert.equal(res.body.data[0].sessionFee, 1500);
    assert.equal(res.body.data[0].hasAvailability, true);
  });

  it("does not contain the email, phone or payout values anywhere in the body", async () => {
    const res = await request(app).get("/api/experts?limit=200");
    for (const secret of [
      EXPERT_EMAIL,
      EXPERT_PHONE,
      "secret@upi",
      "ABCDE1234F",
      "12 Private Lane",
    ]) {
      assert.equal(res.text.includes(secret), false, `body contained "${secret}"`);
    }
  });

  it("does not leak through a search either", async () => {
    const res = await request(app).get("/api/experts?search=Public");
    assert.equal(res.status, 200);
    assert.equal(res.body.data.length, 1);
    assertPublicShape(res.body.data[0]);
  });
});

describe("public expert detail", () => {
  it("returns only the allow-listed fields", async () => {
    const res = await request(app).get(`/api/experts/${activeExpertId}`);
    assert.equal(res.status, 200);
    assertPublicShape(res.body.data);
    assert.equal(res.text.includes(EXPERT_EMAIL), false);
  });

  it("404s for an inactive expert", async () => {
    const hidden = await Expert.collection.findOne({ isActive: false });
    const res = await request(app).get(`/api/experts/${hidden._id}`);
    assert.equal(res.status, 404);
  });
});

describe("owner and admin views keep the private fields", () => {
  it("the expert's own profile still includes email and payout details", async () => {
    const res = await request(app)
      .get("/api/experts/me")
      .set("Authorization", `Bearer ${expertToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.email, EXPERT_EMAIL);
    assert.equal(res.body.data.verificationStatus, "APPROVED");
    assert.equal(res.body.data.inPersonAddress, "12 Private Lane, Bengaluru");
    assert.ok(Array.isArray(res.body.data.payoutMethods));
  });

  it("the admin list still includes email and verificationStatus", async () => {
    const admin = await insertUser("Admin");
    const res = await request(app)
      .get("/api/experts/admin/all")
      .set("Authorization", `Bearer ${admin.token}`);
    assert.equal(res.status, 200);
    const row = res.body.data.find((e: any) => e.email === EXPERT_EMAIL);
    assert.ok(row, "admin list should include the expert's email");
    assert.equal(row.verificationStatus, "APPROVED");
  });
});
