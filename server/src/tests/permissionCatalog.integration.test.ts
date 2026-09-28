/* eslint-disable @typescript-eslint/no-var-requires */
// The admin app renders its permission picker from GET
// /api/admin/permission-catalog instead of keeping its own copy of the list,
// which had drifted (pathways, opportunities and data-sources were missing).
// These tests pin the catalog to ALL_PERMISSIONS so a new permission can't be
// defined without also being grantable from the picker.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";

import assert = require("node:assert/strict");
const { after, before, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const { app } = require("../app");
const { generateToken } = require("../utils/jwt");
const { User } = require("../client/models/User");
const { ALL_PERMISSIONS, PERMISSION_LABELS } = require("../constants/adminPermissions");
const { getPermissionCatalogData } = require("../admin/services/AdminService");
const redis = require("../config/redis").default;

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

describe("permission catalog contents", () => {
  const catalog = getPermissionCatalogData();
  const listed: string[] = catalog.flatMap((m: any) => m.permissions.map((p: any) => p.key));

  it("lists every permission exactly once", () => {
    assert.deepEqual([...listed].sort(), [...ALL_PERMISSIONS].sort());
    assert.equal(new Set(listed).size, listed.length);
  });

  it("gives every permission a real label", () => {
    for (const permission of ALL_PERMISSIONS) {
      assert.ok(PERMISSION_LABELS[permission], `no label for ${permission}`);
    }
  });

  it("gives every module a key and a name", () => {
    for (const permModule of catalog) {
      assert.ok(permModule.key);
      assert.ok(permModule.name);
      assert.ok(permModule.permissions.length > 0, permModule.key);
    }
  });
});

describe("GET /api/admin/permission-catalog", () => {
  const path = "/api/admin/permission-catalog";

  it("refuses anonymous requests", async () => {
    const response = await request(app).get(path);
    assert.equal(response.status, 401);
  });

  it("refuses a signed-in non-admin", async () => {
    const userId = new mongoose.Types.ObjectId();
    const email = `${userId.toString()}@example.test`;
    await User.collection.insertOne({
      _id: userId,
      name: "Test Player",
      email,
      role: "Player",
      isActive: true,
      status: "ACTIVE",
    });
    const token = generateToken({ id: userId.toString(), email, role: "Player" });

    const response = await request(app).get(path).set("Authorization", `Bearer ${token}`);
    assert.equal(response.status, 403);
  });

  it("serves the catalog to an admin", async () => {
    const adminId = new mongoose.Types.ObjectId().toString();
    const token = generateToken({
      id: adminId,
      email: `${adminId}@example.test`,
      role: "SUPPORT_ADMIN",
    });

    const response = await request(app).get(path).set("Authorization", `Bearer ${token}`);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data, getPermissionCatalogData());
  });
});
