/* eslint-disable @typescript-eslint/no-var-requires */
// HTTP-level tests for the reminder scheduler's operational routes.
//
// These used to sit on /api/reminders behind plain user auth, so any signed-in
// user could read other users' failed reminders (names + emails) and trigger
// real sends and retries. They now live on /api/admin/reminders. Every request
// goes through the real `app`, so the mounted route table and real auth
// middleware are what is under test. Nothing here reaches a handler that
// sends anything: every write is expected to be refused before it runs.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const { app } = require("../app");
const { generateToken } = require("../utils/jwt");
const { User } = require("../client/models/User");
const Admin = require("../admin/models/Admin").default;
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();

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

beforeEach(async () => {
  for (const name of ["users", "admins", "schedulednotifications"]) {
    await mongoose.connection.db.collection(name).deleteMany({});
  }
});

const signedInUser = async (role: string) => {
  const userId = oid();
  const email = `${userId.toString()}@example.test`;
  await User.collection.insertOne({
    _id: userId,
    name: `Test ${role}`,
    email,
    role,
    isActive: true,
    status: "ACTIVE",
  });
  return generateToken({ id: userId.toString(), email, role });
};

const signedInAdmin = async (role: string, permissions: string[]) => {
  const adminId = oid();
  const email = `${adminId.toString()}@example.test`;
  await Admin.collection.insertOne({
    _id: adminId,
    name: `Test ${role}`,
    email,
    password: "not-a-real-hash",
    role,
    permissions,
    isActive: true,
  });
  return generateToken({ id: adminId.toString(), email, role });
};

const READ_ROUTES: Array<[string, string]> = [
  ["get", "/api/admin/reminders/monitoring/stats"],
  ["get", "/api/admin/reminders/monitoring/health"],
  ["get", "/api/admin/reminders/monitoring/failed"],
];

const WRITE_ROUTES: Array<[string, string]> = [
  ["post", "/api/admin/reminders/process"],
  ["post", "/api/admin/reminders/monitoring/health-check"],
  ["post", "/api/admin/reminders/monitoring/send-summary"],
  ["post", `/api/admin/reminders/monitoring/retry/${oid().toString()}`],
  ["post", "/api/admin/reminders/monitoring/retry-batch"],
];

const ALL_ROUTES = [...READ_ROUTES, ...WRITE_ROUTES];

const call = (method: string, path: string, token?: string) => {
  const req = (request(app) as any)[method](path);
  if (token) req.set("Authorization", `Bearer ${token}`);
  if (method === "post") req.send({ reminderIds: [oid().toString()] });
  return req;
};

describe("reminder operational routes refuse non-admins", () => {
  for (const role of ["Player", "Coach", "VenueLister"]) {
    for (const [method, path] of ALL_ROUTES) {
      it(`${role} gets 403 on ${method.toUpperCase()} ${path}`, async () => {
        const token = await signedInUser(role);
        const response = await call(method, path, token);
        assert.equal(response.status, 403);
      });
    }
  }

  for (const [method, path] of ALL_ROUTES) {
    it(`anonymous gets 401 on ${method.toUpperCase()} ${path}`, async () => {
      const response = await call(method, path);
      assert.equal(response.status, 401);
    });
  }
});

describe("the old user-facing paths are gone", () => {
  const OLD_ROUTES = ALL_ROUTES.map(([m, p]) => [
    m,
    p.replace("/api/admin/reminders", "/api/reminders"),
  ]);

  for (const [method, path] of OLD_ROUTES) {
    it(`a signed-in user cannot reach ${method!.toUpperCase()} ${path}`, async () => {
      const token = await signedInUser("Player");
      const response = await call(method!, path!, token);
      assert.equal(response.status, 404);
    });
  }
});

describe("admin tiers", () => {
  it("an admin without analytics:view gets 403 on every read", async () => {
    const token = await signedInAdmin("SUPPORT_ADMIN", ["inquiries:view", "users:view"]);
    for (const [method, path] of READ_ROUTES) {
      const response = await call(method, path, token);
      assert.equal(response.status, 403, path);
    }
  });

  it("an admin with analytics:view can read failed reminders", async () => {
    const token = await signedInAdmin("ANALYTICS_ADMIN", ["analytics:view"]);
    const response = await call("get", "/api/admin/reminders/monitoring/failed", token);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data, []);
  });

  it("a non-System admin gets 403 on every write, even with analytics:view", async () => {
    const token = await signedInAdmin("ANALYTICS_ADMIN", ["analytics:view", "analytics:export"]);
    for (const [method, path] of WRITE_ROUTES) {
      const response = await call(method, path, token);
      assert.equal(response.status, 403, path);
    }
  });
});

describe("user-facing reminder routes still work", () => {
  it("a signed-in user can still reach their own reminder stats", async () => {
    const token = await signedInUser("Player");
    const response = await call("get", "/api/reminders/stats", token);
    assert.notEqual(response.status, 403);
    assert.notEqual(response.status, 404);
  });
});
