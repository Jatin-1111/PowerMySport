// An expert cannot submit for review without evidence: an ID document and one
// achievement proof (an uploaded file or a public-record link). Proof files must
// sit under the expert's own storage folder.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";
process.env.BANK_ENCRYPTION_KEY = "0123456789abcdef".repeat(4);
process.env.EMAIL_HOST = "127.0.0.1";
process.env.EMAIL_PORT = "1";
// Link signing is offline; fake credentials make sure nothing real is reachable.
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
  for (const name of ["users", "experts"]) await col(name).deleteMany({});
});

const setup = async (extra: Record<string, unknown> = {}) => {
  const userId = oid();
  const email = `${userId.toString()}@example.test`;
  await col("users").insertOne({
    _id: userId,
    name: "Expert Proof",
    email,
    phone: "+919876500004",
    role: "EXPERT",
    isActive: true,
    status: "ACTIVE",
  });
  const expertId = oid();
  await col("experts").insertOne({
    _id: expertId,
    userId,
    bio: "Former national level player with many years of experience.",
    achievements: "National champion",
    sports: ["Tennis"],
    expertise: ["Serve"],
    sessionFee: 1500,
    sessionMode: "ONLINE",
    panNumber: encryptValue("ABCDE1234F"),
    payoutMethods: [{ id: "p1", type: "UPI", upiId: encryptValue("a@upi"), isDefault: true }],
    verificationStatus: "UNVERIFIED",
    isActive: false,
    ...extra,
  });
  const token = generateToken({ id: userId.toString(), email, role: "EXPERT" });
  return { expertId, token };
};

const key = (expertId: unknown, name: string) => `experts/${String(expertId)}/documents/${name}`;
const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const idFile = { type: "ID_PROOF", s3Key: "experts/x/documents/id.pdf", fileName: "id.pdf" };

describe("expert submit for review", () => {
  it("is refused without an ID document", async () => {
    const { token } = await setup({ achievementProofLink: "https://example.com/ranking" });
    const response = await request(app).post("/api/experts/me/review").set(auth(token));
    assert.equal(response.status, 400);
    assert.match(response.body.message, /ID document/);
  });

  it("is refused without achievement proof", async () => {
    const { token } = await setup({ verificationDocuments: [idFile] });
    const response = await request(app).post("/api/experts/me/review").set(auth(token));
    assert.equal(response.status, 400);
    assert.match(response.body.message, /achievements/);
  });

  it("goes to review with an ID document and a link", async () => {
    const { expertId, token } = await setup({
      verificationDocuments: [idFile],
      achievementProofLink: "https://example.com/ranking",
    });
    const response = await request(app).post("/api/experts/me/review").set(auth(token));
    assert.equal(response.status, 200);
    assert.equal((await col("experts").findOne({ _id: expertId }))?.verificationStatus, "PENDING");
  });

  it("goes to review with an ID document and an uploaded achievement file", async () => {
    const { token } = await setup({
      verificationDocuments: [
        idFile,
        { type: "ACHIEVEMENT_PROOF", s3Key: "experts/x/documents/a.pdf", fileName: "a.pdf" },
      ],
    });
    const response = await request(app).post("/api/experts/me/review").set(auth(token));
    assert.equal(response.status, 200);
  });
});

describe("saving proof", () => {
  it("stores documents under the expert's own folder and a valid link", async () => {
    const { expertId, token } = await setup();
    const response = await request(app)
      .put("/api/experts/me/verification")
      .set(auth(token))
      .send({
        documents: [{ type: "ID_PROOF", s3Key: key(expertId, "id.pdf"), fileName: "id.pdf" }],
        achievementProofLink: "https://example.com/ranking",
      });
    assert.equal(response.status, 200);
    const stored = await col("experts").findOne({ _id: expertId });
    assert.equal(stored?.verificationDocuments.length, 1);
    assert.equal(stored?.achievementProofLink, "https://example.com/ranking");
    // The owner gets a signed link, not just the key.
    assert.ok(response.body.data.verificationDocuments[0].url.startsWith("https://"));
  });

  it("refuses a key from another expert's folder", async () => {
    const { token } = await setup();
    const response = await request(app)
      .put("/api/experts/me/verification")
      .set(auth(token))
      .send({
        documents: [{ type: "ID_PROOF", s3Key: key(oid(), "id.pdf"), fileName: "id.pdf" }],
      });
    assert.equal(response.status, 400);
  });

  it("refuses an unknown type and a non-http link", async () => {
    const { expertId, token } = await setup();
    const badType = await request(app)
      .put("/api/experts/me/verification")
      .set(auth(token))
      .send({ documents: [{ type: "OTHER", s3Key: key(expertId, "x.pdf"), fileName: "x.pdf" }] });
    assert.equal(badType.status, 400);
    const badLink = await request(app)
      .put("/api/experts/me/verification")
      .set(auth(token))
      .send({ achievementProofLink: "javascript:alert(1)" });
    assert.equal(badLink.status, 400);
  });

  it("is locked while under review or after approval", async () => {
    const { token } = await setup({ verificationStatus: "PENDING" });
    const response = await request(app)
      .put("/api/experts/me/verification")
      .set(auth(token))
      .send({ achievementProofLink: "https://example.com/x" });
    assert.equal(response.status, 400);
  });

  it("keeps proof out of the public expert view", async () => {
    const { expertId } = await setup({
      verificationStatus: "APPROVED",
      isActive: true,
      verificationDocuments: [idFile],
      achievementProofLink: "https://example.com/ranking",
    });
    const response = await request(app).get(`/api/experts/${String(expertId)}`);
    assert.equal(response.status, 200);
    const text = JSON.stringify(response.body);
    assert.ok(!text.includes("verificationDocuments"));
    assert.ok(!text.includes("id.pdf"));
    assert.ok(!text.includes("achievementProofLink"));
  });

  it("validates the upload request", async () => {
    const { token } = await setup();
    const badType = await request(app)
      .post("/api/experts/me/verification/upload-url")
      .set(auth(token))
      .send({ fileName: "a.pdf", contentType: "application/pdf", documentType: "OTHER" });
    assert.equal(badType.status, 400);
    const badContent = await request(app)
      .post("/api/experts/me/verification/upload-url")
      .set(auth(token))
      .send({
        fileName: "a.exe",
        contentType: "application/x-msdownload",
        documentType: "ID_PROOF",
      });
    assert.equal(badContent.status, 400);
  });
});
