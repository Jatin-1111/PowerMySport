/* eslint-disable @typescript-eslint/no-var-requires */
// Every place the database stores a child's id must be in the lifecycle registry.
//
// The registry decides what deleting a child does to each of them. Guidance submissions,
// check-ins and expert sessions were each missed in turn, because the list lived only in
// the head of whoever wrote the delete. This test finds the fields from the models
// themselves, so a feature that starts storing a child's id fails here until someone
// decides what happens to it.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { after, describe, it } = require("node:test");
const mongoose = require("mongoose");

const { CHILD_RECORDS } = require("../shared/services/AuthService/childRecords");
const redis = require("../config/redis").default;

after(() => {
  redis.disconnect();
});

/** Fields that hold a child's id but are not declared with `ref: "Player"`. */
const CHILD_ID_FIELD_NAME = /^(dependent_?id|player_?id|child_?id|participant_?id)$/i;

/** Every file under a `models` directory, so each model registers itself with mongoose. */
const loadEveryModel = (): string[] => {
  const failures: string[] = [];
  const walk = (dir: string, insideModels: boolean) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "tests" || entry.name === "node_modules") continue;
        walk(full, insideModels || entry.name === "models");
      } else if (insideModels && entry.name.endsWith(".js")) {
        try {
          require(full);
        } catch (error: any) {
          failures.push(`${full}: ${error.message}`);
        }
      }
    }
  };
  walk(path.join(__dirname, ".."), false);
  return failures;
};

/** `model.path` for every path in a schema, descending into sub-schemas, that points at a child. */
const childFieldsOf = (schema: any, prefix = ""): string[] => {
  const found: string[] = [];
  for (const [key, type] of Object.entries<any>(schema.paths)) {
    const fullPath = `${prefix}${key}`;
    const ref = type.options?.ref ?? type.caster?.options?.ref;
    if (ref === "Player" || CHILD_ID_FIELD_NAME.test(key.split(".").pop() as string)) {
      found.push(fullPath);
    }
    if (type.schema) found.push(...childFieldsOf(type.schema, `${fullPath}.`));
  }
  return found;
};

describe("the child lifecycle registry", () => {
  const failures = loadEveryModel();
  const registered = new Set(CHILD_RECORDS.map((r: any) => `${r.model}.${r.field}`));

  const discovered: string[] = [];
  for (const name of mongoose.modelNames()) {
    if (name === "Player") continue;
    for (const field of childFieldsOf(mongoose.model(name).schema)) {
      discovered.push(`${name}.${field}`);
    }
  }

  it("could load every model file", () => {
    assert.deepEqual(failures, []);
  });

  it("finds the child fields we already know about, so the scan itself is trusted", () => {
    for (const known of [
      "ExpertSession.playerId",
      "PlanCheckIn.dependentId",
      "GuidanceSubmission.request.dependent_id",
      "Booking.participantId",
    ]) {
      assert.ok(discovered.includes(known), `the scan no longer finds ${known}`);
    }
  });

  it("has a rule for every field that stores a child's id", () => {
    const missing = discovered.filter((f) => !registered.has(f));
    assert.deepEqual(
      missing,
      [],
      `These fields store a child's id but have no rule in CHILD_RECORDS (childRecords.ts): ${missing.join(", ")}. Decide whether the rows are removed, protect the delete, or are kept, and say why.`
    );
  });

  it("has no rule for a field that does not exist", () => {
    const real = new Set(discovered);
    const stale = [...registered].filter((f) => !real.has(f as string));
    assert.deepEqual(stale, []);
  });

  it("has no field registered twice", () => {
    assert.equal(registered.size, CHILD_RECORDS.length);
  });

  it("gives every rule a reason in plain words", () => {
    for (const rule of CHILD_RECORDS) {
      assert.ok(rule.why.length > 20, `${rule.model}.${rule.field} has no real reason`);
    }
  });
});
