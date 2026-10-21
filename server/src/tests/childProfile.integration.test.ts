/* eslint-disable @typescript-eslint/no-var-requires */
// Saving and managing a child's profile.
//
// Covers four defects found in the 2026-10-21 child-profile audit: the update
// path dropped eyesight and agility and could not clear a field; the stored
// `age` went stale and gated bookings; and nothing bounded what a child
// payload could contain.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { addDependent, updateDependent } = require("../shared/services/AuthService/dependents");
const { Player } = require("../client/models/Player");
const { User } = require("../client/models/User");
const { resolveChildAge } = require("../utils/childAge");
const {
  addDependentSchema,
  updateDependentSchema,
  MAX_DEPENDENTS_PER_PARENT,
} = require("../middleware/schemas");
const { PARENTAL_CONSENT_VERSION } = require("../shared/services/AuthService/shared");
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

beforeEach(async () => {
  await Player.collection.deleteMany({});
  await User.collection.deleteMany({});
});

const seedParent = async (consent: boolean | "old" = true) => {
  const _id = new mongoose.Types.ObjectId();
  await User.collection.insertOne({
    _id,
    name: "Parent Person",
    email: `parent-${_id}@test.com`,
    phone: `9${String(Date.now()).slice(-9)}`,
    role: "Parent",
    isActive: true,
    ...(consent
      ? {
          legalConsents: {
            parentalConsent: {
              accepted: true,
              acceptedAt: new Date(),
              version: consent === "old" ? "2020-01" : PARENTAL_CONSENT_VERSION,
            },
          },
        }
      : {}),
  });
  return _id.toString();
};

const yearsAgo = (years: number, extraDays = 0) => {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() - years);
  d.setUTCDate(d.getUTCDate() - extraDays);
  return d.toISOString().slice(0, 10);
};

describe("updating a child", () => {
  it("saves the quiz answers, eyesight and agility included", async () => {
    const parent = await seedParent();
    const child = await addDependent(parent, { name: "Riya", dob: yearsAgo(10) });

    await updateDependent(parent, child._id.toString(), {
      quiz: { eyesight: "corrected", agility: "high", energyType: "explosive" },
    });

    const stored = await Player.findById(child._id).lean();
    assert.equal(stored.quiz.eyesight, "corrected");
    assert.equal(stored.quiz.agility, "high");
  });

  it("merges new quiz answers over the stored ones, and clears them with null", async () => {
    const parent = await seedParent();
    const child = await addDependent(parent, {
      name: "Riya",
      dob: yearsAgo(10),
      quiz: { eyesight: "sharp", waterComfort: "comfortable" },
    });

    await updateDependent(parent, child._id.toString(), { quiz: { agility: "low" } });
    let stored = await Player.findById(child._id).lean();
    assert.deepEqual(stored.quiz, {
      eyesight: "sharp",
      waterComfort: "comfortable",
      agility: "low",
    });

    await updateDependent(parent, child._id.toString(), { quiz: null });
    stored = await Player.findById(child._id).lean();
    assert.equal(stored.quiz, undefined);
  });

  it("leaves the quiz alone when an edit does not mention it", async () => {
    const parent = await seedParent();
    const child = await addDependent(parent, {
      name: "Riya",
      dob: yearsAgo(10),
      quiz: { eyesight: "sharp" },
    });

    await updateDependent(parent, child._id.toString(), { location: "Delhi" });

    const stored = await Player.findById(child._id).lean();
    assert.equal(stored.quiz.eyesight, "sharp");
  });

  it("clears a field when it is sent empty", async () => {
    const parent = await seedParent();
    const child = await addDependent(parent, {
      name: "Riya",
      dob: yearsAgo(10),
      gender: "FEMALE",
      relation: "Mother",
    });

    await updateDependent(parent, child._id.toString(), {
      gender: "",
      relation: "",
    });

    const stored = await Player.findById(child._id).lean();
    assert.equal(stored.gender, undefined);
    assert.equal(stored.relation, undefined);
  });
});

describe("a child's age", () => {
  it("is worked out from the date of birth, not read from a stored number", () => {
    // Stored as 17 long ago; the date of birth says 19 today.
    assert.equal(resolveChildAge({ dob: yearsAgo(19, 5), age: 17 }), 19);
  });

  it("falls back to the stored age only when there is no date of birth", () => {
    assert.equal(resolveChildAge({ age: 9 }), 9);
    assert.equal(resolveChildAge({}), null);
  });

  it("is not stored when a date of birth is given", async () => {
    const parent = await seedParent();
    const child = await addDependent(parent, { name: "Riya", dob: yearsAgo(10), age: 3 });

    const stored = await Player.findById(child._id).lean();
    assert.equal(stored.age, undefined);
    assert.equal(resolveChildAge(stored), 10);
  });

  it("keeps a typed age for a profile with no date of birth", async () => {
    const parent = await seedParent();
    const child = await addDependent(parent, { name: "Riya", age: 9 });

    const stored = await Player.findById(child._id).lean();
    assert.equal(stored.age, 9);
  });
});

describe("the child payload schema", () => {
  const ok = { name: "Riya", dob: yearsAgo(10) };

  it("accepts a normal quick-add payload", () => {
    assert.equal(
      addDependentSchema.safeParse({ ...ok, gender: "FEMALE", relation: "Daughter" }).success,
      true
    );
  });

  it("rejects a date of birth in the future", () => {
    const future = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    assert.equal(addDependentSchema.safeParse({ ...ok, dob: future }).success, false);
  });

  it("rejects a new child who is over 18, but lets an existing profile be edited", () => {
    assert.equal(addDependentSchema.safeParse({ ...ok, dob: yearsAgo(20) }).success, false);
    assert.equal(
      updateDependentSchema.safeParse({ dob: yearsAgo(20), location: "Delhi" }).success,
      true
    );
  });

  it("bounds text and lists", () => {
    assert.equal(
      addDependentSchema.safeParse({ ...ok, personalityTags: Array(21).fill("calm") }).success,
      false
    );
    assert.equal(
      addDependentSchema.safeParse({ ...ok, sportsFocus: Array(11).fill("Tennis") }).success,
      false
    );
    assert.equal(addDependentSchema.safeParse({ ...ok, name: "n".repeat(101) }).success, false);
  });

  it("rejects an unknown enum value and accepts an empty one as 'not answered'", () => {
    assert.equal(updateDependentSchema.safeParse({ quiz: { eyesight: "superb" } }).success, false);
    assert.equal(updateDependentSchema.safeParse({ quiz: { eyesight: "" } }).success, true);
    assert.equal(updateDependentSchema.safeParse({ quiz: { teamIndividual: 9 } }).success, false);
  });
});

describe("how many children a parent can add", () => {
  it(`stops at ${MAX_DEPENDENTS_PER_PARENT}`, async () => {
    const parent = await seedParent();
    for (let i = 0; i < MAX_DEPENDENTS_PER_PARENT; i += 1) {
      await addDependent(parent, { name: `Child ${i}`, dob: yearsAgo(8) });
    }
    await assert.rejects(addDependent(parent, { name: "One too many", dob: yearsAgo(8) }), {
      statusCode: 400,
    });
    assert.equal(
      await Player.countDocuments({ userId: parent, type: "DEPENDENT" }),
      MAX_DEPENDENTS_PER_PARENT
    );
  });
});

describe("the parent's consent to add a child", () => {
  const consentOf = async (parent: string) =>
    (await User.findById(parent).lean()).legalConsents?.parentalConsent;

  it("refuses to add a child until the parent has agreed, with 428", async () => {
    const parent = await seedParent(false);

    await assert.rejects(addDependent(parent, { name: "Riya", dob: yearsAgo(10) }), {
      statusCode: 428,
    });
    assert.equal(await Player.countDocuments({ userId: parent }), 0);
    assert.equal(await consentOf(parent), undefined);
  });

  it("records the agreement with the date and policy version when the box is ticked", async () => {
    const parent = await seedParent(false);

    await addDependent(parent, { name: "Riya", dob: yearsAgo(10), parentalConsent: true });

    const consent = await consentOf(parent);
    assert.equal(consent.accepted, true);
    assert.equal(consent.version, PARENTAL_CONSENT_VERSION);
    assert.ok(consent.acceptedAt);
  });

  it("does not ask again for the same policy version", async () => {
    const parent = await seedParent(false);
    await addDependent(parent, { name: "Riya", dob: yearsAgo(10), parentalConsent: true });

    await addDependent(parent, { name: "Arjun", dob: yearsAgo(8) });

    assert.equal(await Player.countDocuments({ userId: parent, type: "DEPENDENT" }), 2);
  });

  it("asks again when the policy version has changed", async () => {
    const parent = await seedParent("old");

    await assert.rejects(addDependent(parent, { name: "Riya", dob: yearsAgo(10) }), {
      statusCode: 428,
    });
  });

  it("records the agreement from an edit, and never blocks an edit that lacks it", async () => {
    const parent = await seedParent(false);
    const child = await Player.create({ userId: parent, type: "DEPENDENT", name: "Riya" });

    await updateDependent(parent, child._id.toString(), { location: "Delhi" });
    assert.equal(await consentOf(parent), undefined);

    await updateDependent(parent, child._id.toString(), { parentalConsent: true });
    assert.equal((await consentOf(parent)).version, PARENTAL_CONSENT_VERSION);
  });

  it("only treats the boolean true as agreement", () => {
    assert.equal(
      addDependentSchema.safeParse({ name: "Riya", parentalConsent: "yes" }).success,
      false
    );
  });
});
