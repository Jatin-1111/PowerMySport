// The academy dashboard asks one question first: where does my listing stand?
// GET /api/academies/my answers it for the signed-in owner only.
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
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();
const col = (name: string) => mongoose.connection.db.collection(name);

let mongod: { getUri(): string; stop(): Promise<void> };
let ownerId: ReturnType<typeof oid>;
let token: string;

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
  for (const name of ["academies", "users", "venues"]) await col(name).deleteMany({});
  ownerId = oid();
  await col("users").insertOne({
    _id: ownerId,
    name: "Academy Owner",
    email: "owner@example.test",
    phone: "9100000099",
    role: "Academy",
    isActive: true,
  });
  token = generateToken({ id: ownerId.toString(), email: "owner@example.test", role: "Academy" });
});

const insertAcademy = (fields: Record<string, unknown>, owner = ownerId) =>
  col("academies").insertOne({
    _id: oid(),
    name: "Test Academy",
    slug: `test-academy-${oid().toString().slice(-6)}`,
    ownerId: owner,
    sports: ["Tennis"],
    city: "Pune",
    onboardingStep: 0,
    onboardingCompleted: false,
    isApproved: false,
    isActive: false,
    kycVerified: false,
    emailVerified: false,
    academyVenues: [],
    academyCoaches: [],
    // Bank and tax fields must never appear in the summary.
    bankAccountNumber: "should-not-leak",
    panNumber: "ABCDE1234F",
    ...fields,
  });

const getMine = () => request(app).get("/api/academies/my").set("Authorization", `Bearer ${token}`);

describe("GET /api/academies/my", () => {
  it("needs a signed-in user", async () => {
    const res = await request(app).get("/api/academies/my");
    assert.equal(res.status, 401);
  });

  it("returns null before an academy is linked to the account", async () => {
    const res = await getMine();
    assert.equal(res.status, 200);
    assert.equal(res.body.data, null);
  });

  it("is not read as an academy slug", async () => {
    await insertAcademy({ slug: "my-neighbour", ownerId: oid() });
    const res = await getMine();
    assert.equal(res.status, 200);
    assert.equal(res.body.data, null);
  });

  it("reports a draft with the step reached", async () => {
    await insertAcademy({ onboardingStep: 3, venueCount: 99 });
    const { data } = (await getMine()).body;
    assert.equal(data.lifecycle, "DRAFT");
    assert.equal(data.onboardingStep, 3);
    assert.equal(data.onboardingCompleted, false);
    assert.equal(data.name, "Test Academy");
    assert.equal(data.city, "Pune");
  });

  it("reports a submitted academy as waiting for review", async () => {
    await insertAcademy({ onboardingStep: 7, onboardingCompleted: true });
    const { data } = (await getMine()).body;
    assert.equal(data.lifecycle, "SUBMITTED");
    assert.equal(data.rejectionReason, undefined);
  });

  it("gives the owner the rejection reason, and only while rejected", async () => {
    await insertAcademy({
      onboardingStep: 7,
      onboardingCompleted: true,
      rejectionReason: "PAN document is unreadable.",
    });
    const { data } = (await getMine()).body;
    assert.equal(data.lifecycle, "REJECTED");
    assert.equal(data.rejectionReason, "PAN document is unreadable.");
  });

  it("separates approved-but-waiting-on-KYC from live", async () => {
    await insertAcademy({ onboardingCompleted: true, isApproved: true, kycVerified: false });
    assert.equal((await getMine()).body.data.lifecycle, "NEEDS_INFO");

    await col("academies").deleteMany({});
    await insertAcademy({
      onboardingCompleted: true,
      isApproved: true,
      kycVerified: true,
      isActive: true,
      rejectionReason: "An old reason that no longer applies.",
    });
    const { data } = (await getMine()).body;
    assert.equal(data.lifecycle, "APPROVED");
    assert.equal(data.rejectionReason, undefined);
  });

  it("counts the venues and coaches the owner listed", async () => {
    await insertAcademy({
      academyVenues: [{ name: "Court A" }, { name: "Court B" }],
      academyCoaches: [
        { firstName: "Meera", lastName: "Iyer", email: "m@example.test", sports: [] },
      ],
    });
    const { data } = (await getMine()).body;
    assert.equal(data.venueCount, 2);
    assert.equal(data.coachCount, 1);
  });

  it("never returns another owner's academy or any bank or tax field", async () => {
    await insertAcademy({ name: "Someone Else's Academy" }, oid());
    await insertAcademy({ name: "Mine" });
    const res = await getMine();
    assert.equal(res.body.data.name, "Mine");
    const body = JSON.stringify(res.body);
    assert.equal(body.includes("should-not-leak"), false);
    assert.equal(body.includes("ABCDE1234F"), false);
  });
});

describe("GET /api/academies/my/venues", () => {
  const getVenues = () =>
    request(app).get("/api/academies/my/venues").set("Authorization", `Bearer ${token}`);

  it("needs a signed-in user", async () => {
    const res = await request(app).get("/api/academies/my/venues");
    assert.equal(res.status, 401);
  });

  it("works for an academy owner, who is not a venue lister", async () => {
    const res = await getVenues();
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data, []);
  });

  it("returns only the venues linked to the owner's academy, by name", async () => {
    const mine = [oid(), oid()];
    const notMine = oid();
    await col("venues").insertMany([
      { _id: mine[0], name: "Court B", ownerName: "x", address: "private address" },
      { _id: mine[1], name: "Court A", ownerName: "x" },
      { _id: notMine, name: "Someone else's court" },
    ]);
    await insertAcademy({ venueIds: mine });

    const res = await getVenues();
    assert.equal(res.status, 200);
    assert.deepEqual(
      res.body.data.map((v: { name: string }) => v.name),
      ["Court A", "Court B"]
    );
    assert.equal(res.body.data[0].id, mine[1].toString());
    assert.equal(JSON.stringify(res.body).includes("private address"), false);
  });
});
