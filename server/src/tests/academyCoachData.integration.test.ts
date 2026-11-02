// An academy's coaches are people who have not agreed to be listed, so only a
// name, an email and the sports are kept, and the step is optional.
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
let academyId: string;

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
  for (const name of ["academies", "admins"]) await col(name).deleteMany({});
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
  const id = oid();
  await col("academies").insertOne({
    _id: id,
    name: "Coach Data Academy",
    slug: "coach-data",
    contactEmail: "owner@example.com",
    onboardingStep: 4,
    academyCoaches: [],
  });
  academyId = id.toString();
});

const saveStep5 = (body: unknown) =>
  request(app)
    .put(`/api/academies/onboarding/${academyId}/step/5`)
    .set("Authorization", `Bearer ${adminToken}`)
    .send(body);

const stored = async () =>
  (await col("academies").findOne({ _id: new mongoose.Types.ObjectId(academyId) }))?.academyCoaches;

describe("academy coaches step", () => {
  it("keeps only name, email and sports, and drops everything else sent", async () => {
    const response = await saveStep5({
      academyCoaches: [
        {
          firstName: "  Asha ",
          lastName: "Rao",
          email: "  Asha.Rao@Example.COM ",
          sports: ["Tennis"],
          phone: "+919876543210",
          bio: "A long personal bio that should never be stored.",
          hourlyRate: 900,
          sportPricing: { Tennis: 900 },
          serviceMode: "FREELANCE",
          certifications: ["Level 2"],
          ownVenueDetails: { name: "Her court", address: "12 Private Lane" },
          profilePhotoUrl: "https://example.test/p.jpg",
        },
      ],
    });
    assert.equal(response.status, 200);

    const coaches = await stored();
    assert.equal(coaches.length, 1);
    assert.deepEqual(coaches[0], {
      firstName: "Asha",
      lastName: "Rao",
      email: "asha.rao@example.com",
      sports: ["Tennis"],
    });
  });

  it("accepts no coaches at all", async () => {
    assert.equal((await saveStep5({ academyCoaches: [] })).status, 200);
    assert.deepEqual(await stored(), []);
    assert.equal((await saveStep5({})).status, 200);
  });

  it("refuses a coach without a valid email or a sport", async () => {
    const noSport = await saveStep5({
      academyCoaches: [{ firstName: "Asha", lastName: "Rao", email: "a@example.com", sports: [] }],
    });
    assert.equal(noSport.status, 400);
    const badEmail = await saveStep5({
      academyCoaches: [
        { firstName: "Asha", lastName: "Rao", email: "not-an-email", sports: ["Tennis"] },
      ],
    });
    assert.equal(badEmail.status, 400);
    assert.deepEqual(await stored(), []);
  });
});
