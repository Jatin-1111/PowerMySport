/* eslint-disable @typescript-eslint/no-var-requires */
// Integration tests for linking a player profile to a federation ranking row.
// In-memory MongoDB — local dev points at the live cluster, so a test on the
// default connection would write to production.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
// The per-registration-number lockout is Redis-backed and fails open by design.
// Disabling Redis here exercises that fail-open path rather than waiting on a
// connection that does not exist in CI; what the lockout does when Redis IS
// present is a property of `middleware/rateLimit.ts`, not of this service.
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { Player } = require("../client/models/Player");
const { User } = require("../client/models/User");
const { PlayerRankingLink } = require("../client/models/PlayerRankingLink");
const { RankingEntry } = require("../shared/models/RankingEntry");
const { RankingClaimService } = require("../client/services/RankingClaimService");
const { deleteDependent } = require("../shared/services/AuthService/dependents");

let memoryServer: { getUri(): string; stop(): Promise<void> };

/**
 * What these tests are pinning, in order of how badly it would hurt to lose it:
 *
 *   1. A failed claim says the same thing whether the registration number does
 *      not exist or the date of birth is wrong. The moment those diverge, the
 *      endpoint becomes a way to confirm that a given child is ranked, and then
 *      to walk their date of birth.
 *   2. No response ever carries a date of birth.
 *   3. One ranked player belongs to exactly one account.
 *   4. Deleting a profile takes its link with it.
 */

const DOB = new Date(Date.UTC(2012, 4, 17)); // 2012-05-17
const DOB_INPUT = "2012-05-17";

const seedParent = async (name: string) => {
  const user = await User.create({
    name,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.test`,
    phone: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
    password: "not-a-real-password",
    role: "Parent",
  });
  return user;
};

const seedChild = (parentId: unknown, fields: { name?: string; dob?: Date | null } = {}) =>
  Player.create({
    userId: parentId,
    type: "DEPENDENT",
    name: fields.name ?? "Aarav",
    ...(fields.dob === null ? {} : { dob: fields.dob ?? DOB }),
  });

/** One row of one published list. `dob` is `select: false`, so it is written
 * here and must never come back out of anything the service returns. */
const seedRankedPlayer = (
  regNo: string,
  overrides: { dob?: Date; rank?: number; prevRank?: number } = {}
) =>
  RankingEntry.create({
    snapshot: new mongoose.Types.ObjectId(),
    sportSlug: "tennis",
    federationCode: "AITA",
    category: "Boys",
    subcategory: "U-14",
    asOnDate: new Date(Date.UTC(2026, 8, 7)),
    isLatest: true,
    rank: overrides.rank ?? 312,
    prevRank: overrides.prevRank,
    regNo,
    givenName: "Aarav",
    familyName: "Khandelwal",
    fullName: "Aarav Khandelwal",
    nameSearch: "aarav khandelwal",
    dob: overrides.dob ?? DOB,
    birthYear: (overrides.dob ?? DOB).getUTCFullYear(),
    state: "Maharashtra",
    stateCode: "MH",
    totalPoints: 148,
  });

before(async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());
  // The unique indexes are the actual guard, not the service's pre-check, so
  // the tests that cover them need the indexes to exist before the first write.
  await PlayerRankingLink.syncIndexes();
});

after(async () => {
  await mongoose.disconnect();
  await memoryServer.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Player.deleteMany({}),
    PlayerRankingLink.deleteMany({}),
    RankingEntry.deleteMany({}),
  ]);
});

describe("claiming a ranked player", () => {
  it("links the profile when the date of birth matches", async () => {
    const parent = await seedParent("Rahul Khandelwal");
    const child = await seedChild(parent._id);
    await seedRankedPlayer("440090", { rank: 312, prevRank: 330 });

    const claim = await RankingClaimService.claim({
      userId: String(parent._id),
      dependentId: String(child._id),
      regNo: "440090",
      dob: DOB_INPUT,
    });

    assert.equal(claim.regNo, "440090");
    assert.equal(claim.dependentName, "Aarav");
    assert.equal(claim.sportSlug, "tennis");
    assert.equal(claim.federationCode, "AITA");
    assert.equal(claim.standings.length, 1);
    assert.equal(claim.standings[0].rank, 312);
    // 330 -> 312 is eighteen places gained, and the sign must read as "up".
    assert.equal(claim.standings[0].rankDelta, 18);

    const stored = await PlayerRankingLink.findOne({ regNo: "440090" }).lean();
    assert.ok(stored);
    assert.equal(stored.verificationMethod, "DOB_CHALLENGE");
    assert.ok(stored.verifiedAt instanceof Date);
  });

  it("returns an identical message for a wrong date and an unknown number", async () => {
    const parent = await seedParent("Rahul Two");
    const child = await seedChild(parent._id, { dob: null });
    await seedRankedPlayer("440090");

    const wrongDate = await RankingClaimService.claim({
      userId: String(parent._id),
      dependentId: String(child._id),
      regNo: "440090",
      dob: "2012-05-18",
    }).catch((error: Error & { statusCode?: number }) => error);

    const unknownNumber = await RankingClaimService.claim({
      userId: String(parent._id),
      dependentId: String(child._id),
      regNo: "999999",
      dob: DOB_INPUT,
    }).catch((error: Error & { statusCode?: number }) => error);

    assert.equal(wrongDate.statusCode, 400);
    assert.equal(unknownNumber.statusCode, 400);
    // The whole point: these two must be indistinguishable to a caller.
    assert.equal(wrongDate.message, unknownNumber.message);
    assert.ok(!/not found|no such|unknown/i.test(wrongDate.message));

    assert.equal(await PlayerRankingLink.countDocuments({}), 0);
  });

  it("never returns a date of birth", async () => {
    const parent = await seedParent("Rahul Three");
    const child = await seedChild(parent._id);
    await seedRankedPlayer("440090");

    const claim = await RankingClaimService.claim({
      userId: String(parent._id),
      dependentId: String(child._id),
      regNo: "440090",
      dob: DOB_INPUT,
    });
    const listed = await RankingClaimService.list(String(parent._id));

    for (const payload of [claim, listed]) {
      const serialised = JSON.stringify(payload);
      assert.ok(!/"dob"/.test(serialised), "a dob field reached the response");
      // The year alone is public (it is implied by the age category); the exact
      // date is not, in any format.
      assert.ok(!serialised.includes("2012-05-17"), "an exact date of birth reached the response");
    }
    assert.equal(claim.standings[0].birthYear, 2012);
  });

  it("refuses a date that disagrees with the profile on file", async () => {
    const parent = await seedParent("Rahul Four");
    // The child on file was born a year earlier than the ranked player.
    const child = await seedChild(parent._id, { dob: new Date(Date.UTC(2011, 4, 17)) });
    await seedRankedPlayer("440090");

    const error = await RankingClaimService.claim({
      userId: String(parent._id),
      dependentId: String(child._id),
      regNo: "440090",
      dob: DOB_INPUT,
    }).catch((e: Error & { statusCode?: number }) => e);

    assert.equal(error.statusCode, 400);
    assert.match(error.message, /profile/i);
    assert.equal(await PlayerRankingLink.countDocuments({}), 0);
  });

  it("lets exactly one account claim a given ranked player", async () => {
    const first = await seedParent("First Parent");
    const second = await seedParent("Second Parent");
    const firstChild = await seedChild(first._id);
    const secondChild = await seedChild(second._id, { name: "Someone Else" });
    await seedRankedPlayer("440090");

    await RankingClaimService.claim({
      userId: String(first._id),
      dependentId: String(firstChild._id),
      regNo: "440090",
      dob: DOB_INPUT,
    });

    const error = await RankingClaimService.claim({
      userId: String(second._id),
      dependentId: String(secondChild._id),
      regNo: "440090",
      dob: DOB_INPUT,
    }).catch((e: Error & { statusCode?: number }) => e);

    assert.equal(error.statusCode, 409);
    // The conflict must not say who holds it.
    assert.ok(!error.message.includes("First Parent"));
    assert.equal(await PlayerRankingLink.countDocuments({}), 1);
  });

  it("refuses a profile belonging to another account", async () => {
    const owner = await seedParent("Owner Parent");
    const stranger = await seedParent("Stranger Parent");
    const child = await seedChild(owner._id);
    await seedRankedPlayer("440090");

    const error = await RankingClaimService.claim({
      userId: String(stranger._id),
      dependentId: String(child._id),
      regNo: "440090",
      dob: DOB_INPUT,
    }).catch((e: Error & { statusCode?: number }) => e);

    assert.equal(error.statusCode, 404);
    assert.equal(await PlayerRankingLink.countDocuments({}), 0);
  });

  it("rejects a malformed registration number without touching the mirror", async () => {
    const parent = await seedParent("Rahul Five");
    const child = await seedChild(parent._id);

    const error = await RankingClaimService.claim({
      userId: String(parent._id),
      dependentId: String(child._id),
      regNo: "12",
      dob: DOB_INPUT,
    }).catch((e: Error & { statusCode?: number }) => e);

    assert.equal(error.statusCode, 400);
    assert.match(error.message, /4 to 8 digits/);
  });
});

describe("living with a link", () => {
  it("lists links with the player's current standing attached", async () => {
    const parent = await seedParent("Rahul Six");
    const child = await seedChild(parent._id);
    await seedRankedPlayer("440090", { rank: 12 });

    await RankingClaimService.claim({
      userId: String(parent._id),
      dependentId: String(child._id),
      regNo: "440090",
      dob: DOB_INPUT,
    });

    const claims = await RankingClaimService.list(String(parent._id));
    assert.equal(claims.length, 1);
    assert.equal(claims[0].standings[0].rank, 12);
    assert.equal(claims[0].standings[0].subcategory, "U-14");
  });

  it("survives a player who has dropped off every list", async () => {
    const parent = await seedParent("Rahul Seven");
    const child = await seedChild(parent._id);
    await seedRankedPlayer("440090");

    await RankingClaimService.claim({
      userId: String(parent._id),
      dependentId: String(child._id),
      regNo: "440090",
      dob: DOB_INPUT,
    });
    // Aged out of the list they were ranked in, and not yet in the next one.
    await RankingEntry.updateMany({ regNo: "440090" }, { $set: { isLatest: false } });

    const claims = await RankingClaimService.list(String(parent._id));
    assert.equal(claims.length, 1);
    assert.deepEqual(claims[0].standings, []);
  });

  it("unlinks only the owner's own link, and frees the number for a re-claim", async () => {
    const parent = await seedParent("Rahul Eight");
    const stranger = await seedParent("Stranger Eight");
    const child = await seedChild(parent._id);
    await seedRankedPlayer("440090");

    const claim = await RankingClaimService.claim({
      userId: String(parent._id),
      dependentId: String(child._id),
      regNo: "440090",
      dob: DOB_INPUT,
    });

    const denied = await RankingClaimService.remove(String(stranger._id), claim.id).catch(
      (e: Error & { statusCode?: number }) => e
    );
    assert.equal(denied.statusCode, 404);
    assert.equal(await PlayerRankingLink.countDocuments({}), 1);

    await RankingClaimService.remove(String(parent._id), claim.id);
    assert.equal(await PlayerRankingLink.countDocuments({}), 0);

    // A hard delete rather than a revoked flag, so the unique index does not
    // hold the number against a legitimate re-claim.
    const again = await RankingClaimService.claim({
      userId: String(parent._id),
      dependentId: String(child._id),
      regNo: "440090",
      dob: DOB_INPUT,
    });
    assert.equal(again.regNo, "440090");
  });

  it("takes the link with the profile when the profile is deleted", async () => {
    const parent = await seedParent("Rahul Nine");
    const child = await seedChild(parent._id);
    await seedRankedPlayer("440090");

    await RankingClaimService.claim({
      userId: String(parent._id),
      dependentId: String(child._id),
      regNo: "440090",
      dob: DOB_INPUT,
    });

    await deleteDependent(String(parent._id), String(child._id));

    assert.equal(await PlayerRankingLink.countDocuments({}), 0);
  });
});
