/* eslint-disable @typescript-eslint/no-var-requires */
// Integration tests for the child summaries on a community profile. In-memory
// MongoDB — local dev points at the live cluster, so a test on the default
// connection would write to production.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { Player } = require("../client/models/Player");
const { User } = require("../client/models/User");
const { CommunityProfile } = require("../community/models/CommunityProfile");
const { CommunityService } = require("../community/services/CommunityService");

let memoryServer: { getUri(): string; stop(): Promise<void> };

/**
 * A parent's community profile is built from their CHILDREN, not from their own
 * user row — a parent has no sport, usually no city and no date of birth, which
 * is why every parent card used to read "N/A · N/A".
 *
 * These tests pin the two things that are easy to break without noticing:
 * the shape published about a minor, and the fact that siblings are not
 * collapsed into one.
 */

const seedParent = async (name: string, city?: string) => {
  const user = await User.create({
    name,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.test`,
    phone: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
    password: "not-a-real-password",
    role: "Parent",
    ...(city ? { city } : {}),
  });
  await CommunityProfile.create({ userId: user._id, anonymousAlias: `${name}-alias` });
  return user;
};

/** `dob` rather than `age`: the stored age goes stale and the reader prefers dob. */
const dobForAge = (age: number) => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear() - age, now.getUTCMonth(), now.getUTCDate() - 1));
};

const seedChild = (
  parentId: unknown,
  fields: { age: number; sport?: string; gender?: string; wizardCity?: string; name?: string }
) =>
  Player.create({
    userId: parentId,
    type: "DEPENDENT",
    name: fields.name ?? "Child",
    dob: dobForAge(fields.age),
    ...(fields.gender ? { gender: fields.gender } : {}),
    ...(fields.sport ? { chosenSport: fields.sport } : {}),
    ...(fields.wizardCity ? { wizardCity: fields.wizardCity } : {}),
  });

before(async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await memoryServer.stop();
});

beforeEach(async () => {
  await Promise.all([User.deleteMany({}), Player.deleteMany({}), CommunityProfile.deleteMany({})]);
});

describe("a parent's profile is built from their children", () => {
  it("publishes sport, category and city — and nothing that identifies the child", async () => {
    const viewer = await seedParent("Viewer One");
    const parent = await seedParent("Rahul Khandelwal");
    await seedChild(parent._id, {
      name: "Aarav",
      age: 13,
      sport: "Tennis",
      gender: "MALE",
      wizardCity: "Chandigarh",
    });

    const profile = await CommunityService.getPlayerProfile(String(viewer._id), String(parent._id));

    assert.deepEqual(profile.dependents, [
      { sport: "Tennis", ageBand: "U-14", gender: "Boy", city: "Chandigarh" },
    ]);

    // The bar for this shape: could a stranger pick this specific child out?
    const serialized = JSON.stringify(profile.dependents);
    assert.ok(!serialized.includes("Aarav"), "the child's name must never be published");
    assert.ok(!serialized.includes("13"), "the child's exact age must never be published");
  });

  it("keeps siblings separate instead of collapsing them into one", async () => {
    const viewer = await seedParent("Viewer Two");
    const parent = await seedParent("Two Kids");
    await seedChild(parent._id, { age: 13, sport: "Tennis", gender: "MALE", wizardCity: "Mohali" });
    await seedChild(parent._id, {
      age: 9,
      sport: "Badminton",
      gender: "FEMALE",
      wizardCity: "Chandigarh",
    });

    const profile = await CommunityService.getPlayerProfile(String(viewer._id), String(parent._id));

    assert.equal(profile.dependents.length, 2);
    // Each child keeps their own sport's ladder: tennis is even, badminton odd.
    assert.deepEqual(
      profile.dependents.map((d: { ageBand: string }) => d.ageBand),
      ["U-14", "U-11"]
    );
    assert.deepEqual(profile.sports, ["Tennis", "Badminton"]);
  });

  it("leaves a member with no children on file with an empty list, not a broken one", async () => {
    const viewer = await seedParent("Viewer Three");
    const parent = await seedParent("No Kids Yet", "Delhi");

    const profile = await CommunityService.getPlayerProfile(String(viewer._id), String(parent._id));

    assert.deepEqual(profile.dependents, []);
    assert.deepEqual(profile.sports, []);
    // Falls back to the parent's own city rather than showing nothing.
    assert.equal(profile.city, "Delhi");
  });
});

describe("search results carry the same summaries", () => {
  it("lists every city a family trains in, so a sibling's city is still findable", async () => {
    const viewer = await seedParent("Viewer Four");
    const parent = await seedParent("Split City");
    await seedChild(parent._id, { age: 13, sport: "Tennis", wizardCity: "Chandigarh" });
    await seedChild(parent._id, { age: 9, sport: "Badminton", wizardCity: "Mohali" });

    const [result] = await CommunityService.searchPlayers(String(viewer._id), "Split City");

    // A scalar city made this family unfindable under the second child's — the
    // Discover city filter matches on this list.
    assert.deepEqual(result.cities.sort(), ["Chandigarh", "Mohali"]);
    assert.deepEqual(result.sports.sort(), ["Badminton", "Tennis"]);
    assert.equal(result.dependents.length, 2);
  });

  it("honours the limit, and looks up children only for the rows it returns", async () => {
    const viewer = await seedParent("Viewer Five");
    for (let i = 0; i < 5; i += 1) {
      const parent = await seedParent(`Searchable Parent ${i}`);
      await seedChild(parent._id, { age: 10, sport: "Chess", wizardCity: "Pune" });
    }

    const results = await CommunityService.searchPlayers(String(viewer._id), "Searchable", 2);

    // The candidate set is deliberately over-fetched (limit * 3 by name, the
    // same again by alias) so blocking can remove rows without under-filling the
    // page. Summarising before that narrowing scanned children for up to six
    // times as many parents as the search ever shows.
    assert.equal(results.length, 2);
    for (const row of results) {
      assert.equal(row.dependents.length, 1, "a returned row still carries its children");
      assert.deepEqual(row.sports, ["Chess"]);
    }
  });
});
