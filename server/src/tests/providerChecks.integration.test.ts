// Public cards say what was checked (ID, certificate, achievements) from the
// reviewed document types, and never carry the documents themselves.
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
  for (const name of ["users", "coaches", "experts"]) await col(name).deleteMany({});
});

const SECRET_KEY = "coaches/secret-key/documents/id.pdf";
const noFiles = (body: unknown) => {
  const text = JSON.stringify(body);
  assert.ok(!text.includes("verificationDocuments"), "no document list");
  assert.ok(!text.includes(SECRET_KEY), "no storage key");
  assert.ok(!text.includes("s3Key"), "no storage key field");
};

const insertCoach = async (docs: unknown[]) => {
  const userId = oid();
  await col("users").insertOne({
    _id: userId,
    name: "Coach Cards",
    email: "c@example.test",
    role: "Coach",
  });
  const id = oid();
  await col("coaches").insertOne({
    _id: id,
    userId,
    bio: "Junior coach",
    sports: ["Tennis"],
    hourlyRate: 500,
    serviceMode: "FREELANCE",
    verificationStatus: "VERIFIED",
    isVerified: true,
    availability: [],
    verificationDocuments: docs,
  });
  return id;
};

const coachDoc = (type: string) => ({
  type,
  url: "https://example.test/private.pdf",
  s3Key: SECRET_KEY,
  fileName: "private.pdf",
});

describe("coach cards", () => {
  it("list what was checked, and nothing about the files", async () => {
    await insertCoach([coachDoc("ID_PROOF"), coachDoc("CERTIFICATION"), coachDoc("ID_PROOF")]);
    const response = await request(app).get("/api/coaches/discover");
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data.coaches[0].checks, ["ID", "Certificate"]);
    noFiles(response.body);
  });

  it("have an empty list when no documents are on file", async () => {
    await insertCoach([]);
    const response = await request(app).get("/api/coaches/discover");
    assert.deepEqual(response.body.data.coaches[0].checks, []);
  });

  it("show the same on the public profile", async () => {
    const id = await insertCoach([coachDoc("CERTIFICATION"), coachDoc("BACKGROUND_CHECK")]);
    const response = await request(app).get(`/api/coaches/${id.toString()}`);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data.checks, ["Certificate", "Background check"]);
    noFiles(response.body);
  });
});

describe("expert cards", () => {
  const insertExpert = async (extra: Record<string, unknown>) => {
    const userId = oid();
    await col("users").insertOne({
      _id: userId,
      name: "Expert Cards",
      email: "e@example.test",
      role: "EXPERT",
    });
    const id = oid();
    await col("experts").insertOne({
      _id: id,
      userId,
      bio: "Former national player",
      sports: ["Tennis"],
      expertise: ["Serve"],
      sessionFee: 1000,
      verificationStatus: "APPROVED",
      isActive: true,
      ...extra,
    });
    return id;
  };

  it("list ID and achievements when both were reviewed, without the files or the link", async () => {
    const id = await insertExpert({
      verificationDocuments: [
        { type: "ID_PROOF", s3Key: SECRET_KEY, fileName: "id.pdf" },
        { type: "ACHIEVEMENT_PROOF", s3Key: SECRET_KEY, fileName: "a.pdf" },
      ],
      achievementProofLink: "https://example.com/private-ranking",
    });
    const response = await request(app).get(`/api/experts/${id.toString()}`);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data.checks, ["ID", "Achievements"]);
    noFiles(response.body);
    assert.ok(!JSON.stringify(response.body).includes("private-ranking"));
  });

  it("count a public-record link as an achievement check", async () => {
    const id = await insertExpert({
      verificationDocuments: [{ type: "ID_PROOF", s3Key: SECRET_KEY, fileName: "id.pdf" }],
      achievementProofLink: "https://example.com/ranking",
    });
    const response = await request(app).get(`/api/experts/${id.toString()}`);
    assert.deepEqual(response.body.data.checks, ["ID", "Achievements"]);
  });

  it("have an empty list when nothing was submitted", async () => {
    const id = await insertExpert({});
    const response = await request(app).get(`/api/experts/${id.toString()}`);
    assert.deepEqual(response.body.data.checks, []);
  });
});
