// One search box on the venue and academy discovery pages: free text matches
// name, city or address, and sport. Unapproved records never appear.
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
  for (const name of ["venues", "academies"]) await col(name).deleteMany({});
});

const venue = (extra: Record<string, unknown>) => ({
  _id: oid(),
  name: "Court",
  ownerName: "Owner",
  ownerEmail: "owner@example.com",
  ownerPhone: "9876543210",
  address: "1 Test Road, Pune",
  location: { type: "Point", coordinates: [73.8, 18.5] },
  sports: ["Tennis"],
  pricePerHour: 500,
  images: [],
  documents: [],
  approvalStatus: "APPROVED",
  ...extra,
});

const names = (body: { data: { venues: { name: string }[] } }) =>
  body.data.venues.map((v) => v.name).sort();

describe("venue discovery search", () => {
  it("matches name, address and sport, and nothing unapproved", async () => {
    await col("venues").insertMany([
      venue({ name: "Riverside Courts", address: "5 Lake Road, Mumbai", sports: ["Squash"] }),
      venue({ name: "Hilltop Arena", address: "9 Hill Road, Pune", sports: ["Badminton"] }),
      venue({
        name: "Riverside Draft",
        address: "2 Lake Road, Mumbai",
        sports: ["Squash"],
        approvalStatus: "PENDING",
      }),
    ]);

    const byName = await request(app).get("/api/venues/discover").query({ search: "riverside" });
    assert.equal(byName.status, 200);
    assert.deepEqual(names(byName.body), ["Riverside Courts"]);

    const byCity = await request(app).get("/api/venues/discover").query({ search: "pune" });
    assert.deepEqual(names(byCity.body), ["Hilltop Arena"]);

    const bySport = await request(app).get("/api/venues/discover").query({ search: "badminton" });
    assert.deepEqual(names(bySport.body), ["Hilltop Arena"]);

    const none = await request(app).get("/api/venues/discover").query({ search: "nowhere" });
    assert.deepEqual(names(none.body), []);
  });

  it("treats regex characters in the search as plain text", async () => {
    await col("venues").insertOne(venue({ name: "Plain Court" }));
    const response = await request(app).get("/api/venues/discover").query({ search: ".*" });
    assert.equal(response.status, 200);
    assert.deepEqual(names(response.body), []);
  });
});

describe("academy discovery search", () => {
  const academy = (extra: Record<string, unknown>) => ({
    _id: oid(),
    name: "Academy",
    slug: `a-${oid().toString()}`,
    city: "Pune",
    sports: ["Tennis"],
    isApproved: true,
    kycVerified: true,
    isActive: true,
    rating: 4,
    ...extra,
  });

  it("matches name, city and sport, and only live academies", async () => {
    await col("academies").insertMany([
      academy({ name: "Ace Tennis Academy", city: "Mumbai", sports: ["Tennis"] }),
      academy({ name: "Swish Hoops", city: "Pune", sports: ["Basketball"] }),
      academy({ name: "Ace Draft", city: "Mumbai", isActive: false }),
    ]);

    const list = async (search: string) => {
      const response = await request(app).get("/api/academies").query({ search });
      assert.equal(response.status, 200);
      return response.body.data.academies.map((a: { name: string }) => a.name).sort();
    };

    assert.deepEqual(await list("ace"), ["Ace Tennis Academy"]);
    assert.deepEqual(await list("pune"), ["Swish Hoops"]);
    assert.deepEqual(await list("basketball"), ["Swish Hoops"]);
    assert.deepEqual(await list("zzz"), []);
  });
});
