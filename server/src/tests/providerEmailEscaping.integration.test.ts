// Text a provider typed (academy name, venue name, owner name) and text an admin
// typed (rejection reasons) must reach the email body as text, never as markup.
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
const nodemailer = require("nodemailer");

// Capture mail instead of sending it. Installed before the app loads its mailer.
const sent: { to: string; subject: string; html: string }[] = [];
nodemailer.createTransport = () => ({
  sendMail: async (options: { to: string; subject: string; html: string }) => {
    sent.push(options);
    return { messageId: "test", rejected: [] };
  },
});

const { app } = require("../app");
const { generateToken } = require("../utils/jwt");
const Admin = require("../admin/models/Admin").default;
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();
const col = (name: string) => mongoose.connection.db.collection(name);

const PAYLOAD = '<script>alert(1)</script>"x"';
const ESCAPED = "&lt;script&gt;alert(1)&lt;/script&gt;";

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
  sent.length = 0;
  for (const name of ["users", "venues", "academies", "admins"]) await col(name).deleteMany({});
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

const lastMail = () => sent[sent.length - 1];

describe("provider emails", () => {
  it("escape the academy name and the rejection reason", async () => {
    const id = oid();
    await col("academies").insertOne({
      _id: id,
      name: PAYLOAD,
      slug: "x-academy",
      contactEmail: "owner@example.com",
      onboardingCompleted: true,
      isApproved: false,
      isActive: false,
    });
    const response = await request(app)
      .put(`/api/academies/admin/${id.toString()}/reject`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ rejectionReason: PAYLOAD });
    assert.equal(response.status, 200);
    const mail = lastMail();
    assert.ok(mail, "a rejection email was sent");
    assert.ok(mail.html.includes(ESCAPED));
    assert.ok(!mail.html.includes("<script>"));
  });

  it("escape the venue name, owner name and rejection reason", async () => {
    const id = oid();
    await col("venues").insertOne({
      _id: id,
      name: PAYLOAD,
      ownerName: PAYLOAD,
      ownerEmail: "owner@example.com",
      ownerPhone: "9876543210",
      address: "1 Test Road",
      location: { type: "Point", coordinates: [76.7, 30.7] },
      sports: ["Tennis"],
      pricePerHour: 500,
      images: [],
      documents: [],
      approvalStatus: "PENDING",
      emailVerified: true,
    });
    const response = await request(app)
      .post(`/api/venues/onboarding/admin/${id.toString()}/reject`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ venueId: id.toString(), reason: PAYLOAD });
    assert.equal(response.status, 200);
    const mail = lastMail();
    assert.ok(mail, "a rejection email was sent");
    assert.ok(mail.html.includes(ESCAPED));
    assert.ok(!mail.html.includes("<script>"));
  });
});
