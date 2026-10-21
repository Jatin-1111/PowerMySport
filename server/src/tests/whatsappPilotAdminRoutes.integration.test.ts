/* eslint-disable @typescript-eslint/no-var-requires */
// HTTP-level tests for the WhatsApp pilot allow-list screen. The list decides who
// gets messages from us, so every route is checked for who may call it, and the
// responses are checked for never handing a phone number back.
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
const { WhatsAppPilotNumber } = require("../shared/models/WhatsAppPilotNumber");

const oid = () => new mongoose.Types.ObjectId();
const BASE = "/api/admin/whatsapp-pilot";

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
  for (const name of ["users", "admins", "whatsapppilotnumbers", "whatsapppilotsettings"]) {
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

const signedInAdmin = async (permissions: string[]) => {
  const adminId = oid();
  const email = `${adminId.toString()}@example.test`;
  await Admin.collection.insertOne({
    _id: adminId,
    name: "Test admin",
    email,
    password: "not-a-real-hash",
    role: "OPERATIONS_ADMIN",
    permissions,
    isActive: true,
  });
  return generateToken({ id: adminId.toString(), email, role: "OPERATIONS_ADMIN" });
};

const call = (method: string, path: string, token?: string, body?: unknown) => {
  const req = (request(app) as any)[method](path);
  if (token) req.set("Authorization", `Bearer ${token}`);
  if (body !== undefined) req.send(body);
  return req;
};

const ROUTES: Array<[string, string, unknown?]> = [
  ["get", BASE],
  ["post", `${BASE}/numbers`, { text: "9876543210" }],
  ["delete", `${BASE}/numbers/${oid().toString()}`],
  ["put", `${BASE}/mode`, { mode: "everyone" }],
];

describe("who may reach the pilot list", () => {
  for (const [method, path, body] of ROUTES) {
    it(`anonymous gets 401 on ${method.toUpperCase()} ${path.replace(BASE, "")}`, async () => {
      assert.equal((await call(method, path, undefined, body)).status, 401);
    });

    it(`a player gets 403 on ${method.toUpperCase()} ${path.replace(BASE, "")}`, async () => {
      const token = await signedInUser("Player");
      assert.equal((await call(method, path, token, body)).status, 403);
    });
  }

  it("notifications:view can read the list but not change it", async () => {
    const token = await signedInAdmin(["notifications:view"]);
    assert.equal((await call("get", BASE, token)).status, 200);
    for (const [method, path, body] of ROUTES.slice(1)) {
      assert.equal((await call(method, path, token, body)).status, 403, path);
    }
  });

  it("an admin without notifications permissions is refused everywhere", async () => {
    const token = await signedInAdmin(["analytics:view"]);
    for (const [method, path, body] of ROUTES) {
      assert.equal((await call(method, path, token, body)).status, 403, path);
    }
  });
});

describe("managing the list", () => {
  it("starts closed, adds numbers, and never returns a phone number", async () => {
    const token = await signedInAdmin(["notifications:manage"]);

    const first = await call("get", BASE, token);
    assert.equal(first.body.data.mode, "listed");
    assert.deepEqual(first.body.data.numbers, []);

    const added = await call("post", `${BASE}/numbers`, token, {
      text: "9876543210, Coach Ravi\n+91 98765 43211\nnope",
    });
    assert.equal(added.status, 200);
    assert.deepEqual(added.body.data, { added: 2, alreadyListed: 0, invalid: ["nope"] });

    const list = await call("get", BASE, token);
    assert.equal(list.body.data.numbers.length, 2);
    const serialized = JSON.stringify(list.body);
    assert.equal(serialized.includes("9876543210"), false);
    assert.equal(serialized.includes("98765 43211"), false);
    assert.ok(
      list.body.data.numbers.some((n: any) => n.label === "Coach Ravi" && n.lastFour === "3210")
    );
  });

  it("removes an entry, and says so when it is not there", async () => {
    const token = await signedInAdmin(["notifications:manage"]);
    await call("post", `${BASE}/numbers`, token, { text: "9876543210" });
    const [doc] = await WhatsAppPilotNumber.find().lean();

    assert.equal((await call("delete", `${BASE}/numbers/${doc._id}`, token)).status, 200);
    assert.equal(await WhatsAppPilotNumber.countDocuments(), 0);
    assert.equal((await call("delete", `${BASE}/numbers/${doc._id}`, token)).status, 404);
    assert.equal((await call("delete", `${BASE}/numbers/not-an-id`, token)).status, 404);
  });

  it("rejects empty input and an unknown mode", async () => {
    const token = await signedInAdmin(["notifications:manage"]);
    assert.equal((await call("post", `${BASE}/numbers`, token, { text: "  " })).status, 400);
    assert.equal((await call("post", `${BASE}/numbers`, token, {})).status, 400);
    assert.equal((await call("put", `${BASE}/mode`, token, { mode: "open" })).status, 400);
  });

  it("switches between listed numbers and everyone", async () => {
    const token = await signedInAdmin(["notifications:manage"]);
    assert.equal((await call("put", `${BASE}/mode`, token, { mode: "everyone" })).status, 200);
    assert.equal((await call("get", BASE, token)).body.data.mode, "everyone");
    assert.equal((await call("put", `${BASE}/mode`, token, { mode: "listed" })).status, 200);
    assert.equal((await call("get", BASE, token)).body.data.mode, "listed");
  });
});
