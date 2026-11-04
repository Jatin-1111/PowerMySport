/* eslint-disable @typescript-eslint/no-var-requires */
// Migration 49 against an in-memory Mongo: it must grant exactly the
// notifications permissions each role template owes, and nothing else.
import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const migration: typeof import("../migrations/49_backfill_notifications_permissions") = require("../migrations/49_backfill_notifications_permissions");
const { up, down } = migration;

let mongod: any;
const admins = () => mongoose.connection.db.collection("admins");
const permsOf = async (email: string) =>
  ((await admins().findOne({ email }))?.permissions ?? []).slice().sort();

// Quiet the migration's progress logging for the test output.
const quietly = async <T>(fn: () => Promise<T>): Promise<T> => {
  const log = console.log;
  console.log = () => undefined;
  try {
    return await fn();
  } finally {
    console.log = log;
  }
};

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await admins().deleteMany({});
  await admins().insertMany([
    {
      email: "support@x.test",
      role: "SUPPORT_ADMIN",
      permissions: ["inquiries:view"],
      isActive: true,
    },
    // A customised ops admin: products:manage was removed on purpose and must stay removed.
    { email: "ops@x.test", role: "OPERATIONS_ADMIN", permissions: ["venues:view"], isActive: true },
    {
      email: "finance@x.test",
      role: "FINANCE_ADMIN",
      permissions: ["bookings:view"],
      isActive: true,
    },
    { email: "system@x.test", role: "SYSTEM_ADMIN", permissions: [], isActive: true },
    {
      email: "gone@x.test",
      role: "OPERATIONS_ADMIN",
      permissions: ["venues:view"],
      isActive: false,
    },
    { email: "odd@x.test", role: "LEGACY_ROLE", permissions: ["users:view"], isActive: true },
  ]);
});

describe("migration 49 up", () => {
  it("writes nothing on a dry run", async () => {
    const summary = await quietly(() => up());
    assert.equal(summary.changed, 3);
    assert.deepEqual(await permsOf("support@x.test"), ["inquiries:view"]);
    assert.deepEqual(await permsOf("ops@x.test"), ["venues:view"]);
  });

  it("grants only the notifications permissions each template owes", async () => {
    await quietly(() => up({ apply: true }));

    assert.deepEqual(await permsOf("support@x.test"), ["inquiries:view", "notifications:view"]);
    // Only notifications:* is added; the rest of the customised set is untouched.
    assert.deepEqual(await permsOf("ops@x.test"), [
      "notifications:manage",
      "notifications:view",
      "venues:view",
    ]);
    assert.deepEqual(await permsOf("finance@x.test"), ["bookings:view"]);
    // System admins pass every check by role anyway; their stored list is
    // kept in line with their template, which includes everything.
    assert.deepEqual(await permsOf("system@x.test"), [
      "notifications:manage",
      "notifications:view",
    ]);
    // An unknown role has no template, so it is owed nothing.
    assert.deepEqual(await permsOf("odd@x.test"), ["users:view"]);
  });

  it("skips deactivated admins unless asked", async () => {
    await quietly(() => up({ apply: true }));
    assert.deepEqual(await permsOf("gone@x.test"), ["venues:view"]);

    await quietly(() => up({ apply: true, includeInactive: true }));
    assert.deepEqual(await permsOf("gone@x.test"), [
      "notifications:manage",
      "notifications:view",
      "venues:view",
    ]);
  });

  it("is idempotent", async () => {
    await quietly(() => up({ apply: true }));
    const second = await quietly(() => up({ apply: true }));
    assert.equal(second.changed, 0);
    assert.deepEqual(await permsOf("support@x.test"), ["inquiries:view", "notifications:view"]);
  });
});

describe("migration 49 down", () => {
  it("dry-runs by default, then removes only notifications permissions", async () => {
    await quietly(() => up({ apply: true }));

    await quietly(() => down());
    assert.deepEqual(await permsOf("support@x.test"), ["inquiries:view", "notifications:view"]);

    await quietly(() => down({ apply: true }));
    assert.deepEqual(await permsOf("support@x.test"), ["inquiries:view"]);
    assert.deepEqual(await permsOf("ops@x.test"), ["venues:view"]);
  });
});
