import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";

import {
  ADMIN_AUTH_TTL_MS,
  cacheAdminAuth,
  getCachedAdminAuth,
  invalidateAdminAuth,
  type AdminAuthRecord,
} from "../utils/adminAuthCache";

const record = (isActive = true): AdminAuthRecord => ({
  role: "SUPPORT_ADMIN",
  permissions: ["opportunities:view"],
  isActive,
});

beforeEach(() => invalidateAdminAuth());

test("a cached admin is returned until the TTL passes", () => {
  cacheAdminAuth("a1", record(), 1_000);
  assert.deepEqual(getCachedAdminAuth("a1", 1_000 + ADMIN_AUTH_TTL_MS - 1), record());
  assert.equal(getCachedAdminAuth("a1", 1_000 + ADMIN_AUTH_TTL_MS), null);
});

test("an unknown admin is a miss", () => {
  assert.equal(getCachedAdminAuth("nobody"), null);
});

test("invalidating one admin leaves the others", () => {
  cacheAdminAuth("a1", record());
  cacheAdminAuth("a2", record());
  invalidateAdminAuth("a1");
  assert.equal(getCachedAdminAuth("a1"), null);
  assert.deepEqual(getCachedAdminAuth("a2"), record());
});

test("invalidating with no id clears everyone", () => {
  cacheAdminAuth("a1", record());
  cacheAdminAuth("a2", record());
  invalidateAdminAuth();
  assert.equal(getCachedAdminAuth("a1"), null);
  assert.equal(getCachedAdminAuth("a2"), null);
});

test("a deactivated admin is served as inactive from cache, then re-read after invalidation", () => {
  cacheAdminAuth("a1", record(false));
  assert.equal(getCachedAdminAuth("a1")?.isActive, false);
  invalidateAdminAuth("a1");
  assert.equal(getCachedAdminAuth("a1"), null);
});
