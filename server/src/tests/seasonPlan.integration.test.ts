/* eslint-disable @typescript-eslint/no-var-requires */
// Integration tests for a child's tournament plan.
//
// The plan is a record of decisions a parent made, so the properties worth
// pinning are the ones that would quietly corrupt that record: an entry whose
// title came from the request rather than the calendar, a plan that outlives
// the child it belongs to, or a tournament planned against someone else's profile.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { Player } = require("../client/models/Player");
const { User } = require("../client/models/User");
const { SeasonPlan } = require("../client/models/SeasonPlan");
const { SeasonPlanService } = require("../client/services/SeasonPlanService");
const { TournamentEdition } = require("../shared/models/TournamentEdition");
const { deleteDependent } = require("../shared/services/AuthService/dependents");

let memoryServer: { getUri(): string; stop(): Promise<void> };

const START = new Date(Date.UTC(2026, 9, 5));

const seedParent = async (name: string) =>
  User.create({
    name,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.test`,
    phone: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
    password: "not-a-real-password",
    role: "Parent",
  });

const seedChild = (parentId: unknown, name = "Aarav") =>
  Player.create({ userId: parentId, type: "DEPENDENT", name });

const seedEdition = (
  slug: string,
  options: { name?: string; sportSlug?: string; startDate?: Date; mergedInto?: string } = {}
) =>
  TournamentEdition.create({
    sportSlug: options.sportSlug ?? "tennis",
    name: options.name ?? "AITA CS7 (Sonipat)",
    slug,
    editionYear: 2026,
    startDate: options.startDate ?? START,
    sourceUrl: "https://example.test",
    ...(options.mergedInto ? { mergedInto: options.mergedInto } : {}),
  });

before(async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());
  await SeasonPlan.syncIndexes();
});

after(async () => {
  await mongoose.disconnect();
  await memoryServer.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Player.deleteMany({}),
    SeasonPlan.deleteMany({}),
    TournamentEdition.deleteMany({}),
  ]);
});

describe("building a plan", () => {
  it("reads the name and date from the calendar, not from the caller", async () => {
    const parent = await seedParent("Rahul One");
    const child = await seedChild(parent._id);
    await seedEdition("aita-cs7-sonipat-2026-10-05", { name: "AITA CS7 (Sonipat)" });

    const plan = await SeasonPlanService.addEntry({
      userId: String(parent._id),
      dependentId: String(child._id),
      editionSlug: "aita-cs7-sonipat-2026-10-05",
    });

    assert.equal(plan.entries.length, 1);
    // A record of a decision has to be accurate about what was decided, so the
    // title cannot be something a client posted.
    assert.equal(plan.entries[0].name, "AITA CS7 (Sonipat)");
    assert.equal(new Date(plan.entries[0].startDate).getTime(), START.getTime());
    assert.equal(plan.entries[0].status, "shortlisted");
  });

  it("is idempotent — adding the same tournament twice changes nothing", async () => {
    const parent = await seedParent("Rahul Two");
    const child = await seedChild(parent._id);
    await seedEdition("cs7-a");

    await SeasonPlanService.addEntry({
      userId: String(parent._id),
      dependentId: String(child._id),
      editionSlug: "cs7-a",
    });
    const plan = await SeasonPlanService.addEntry({
      userId: String(parent._id),
      dependentId: String(child._id),
      editionSlug: "cs7-a",
    });

    assert.equal(plan.entries.length, 1);
    assert.equal(await SeasonPlan.countDocuments({}), 1);
  });

  it("orders the plan by when the tournaments happen", async () => {
    const parent = await seedParent("Rahul Three");
    const child = await seedChild(parent._id);
    await seedEdition("later", { startDate: new Date(Date.UTC(2026, 10, 1)) });
    await seedEdition("sooner", { startDate: new Date(Date.UTC(2026, 8, 20)) });

    await SeasonPlanService.addEntry({
      userId: String(parent._id),
      dependentId: String(child._id),
      editionSlug: "later",
    });
    const plan = await SeasonPlanService.addEntry({
      userId: String(parent._id),
      dependentId: String(child._id),
      editionSlug: "sooner",
    });

    assert.deepEqual(
      plan.entries.map((entry: { editionSlug: string }) => entry.editionSlug),
      ["sooner", "later"]
    );
  });

  it("refuses a tournament that is not on the calendar", async () => {
    const parent = await seedParent("Rahul Four");
    const child = await seedChild(parent._id);

    const error = await SeasonPlanService.addEntry({
      userId: String(parent._id),
      dependentId: String(child._id),
      editionSlug: "not-a-real-tournament",
    }).catch((e: Error & { statusCode?: number }) => e);

    assert.equal(error.statusCode, 404);
  });

  it("refuses a merged duplicate, which only exists to redirect", async () => {
    const parent = await seedParent("Rahul Five");
    const child = await seedChild(parent._id);
    await seedEdition("dupe", { mergedInto: "survivor" });

    const error = await SeasonPlanService.addEntry({
      userId: String(parent._id),
      dependentId: String(child._id),
      editionSlug: "dupe",
    }).catch((e: Error & { statusCode?: number }) => e);

    assert.equal(error.statusCode, 409);
  });

  it("refuses a profile belonging to another account", async () => {
    const owner = await seedParent("Owner Parent");
    const stranger = await seedParent("Stranger Parent");
    const child = await seedChild(owner._id);
    await seedEdition("cs7-a");

    const error = await SeasonPlanService.addEntry({
      userId: String(stranger._id),
      dependentId: String(child._id),
      editionSlug: "cs7-a",
    }).catch((e: Error & { statusCode?: number }) => e);

    assert.equal(error.statusCode, 404);
    assert.equal(await SeasonPlan.countDocuments({}), 0);
  });

  it("keeps a plan to one sport", async () => {
    const parent = await seedParent("Rahul Six");
    const child = await seedChild(parent._id);
    await seedEdition("tennis-one");
    await seedEdition("chess-one", { sportSlug: "chess" });

    await SeasonPlanService.addEntry({
      userId: String(parent._id),
      dependentId: String(child._id),
      editionSlug: "tennis-one",
    });
    const error = await SeasonPlanService.addEntry({
      userId: String(parent._id),
      dependentId: String(child._id),
      editionSlug: "chess-one",
    }).catch((e: Error & { statusCode?: number }) => e);

    assert.equal(error.statusCode, 400);
  });
});

describe("living with a plan", () => {
  it("returns an empty plan rather than a 404 for a child who has none", async () => {
    const parent = await seedParent("Rahul Seven");
    const child = await seedChild(parent._id);

    const plan = await SeasonPlanService.get(String(parent._id), String(child._id));
    assert.deepEqual(plan.entries, []);
  });

  it("moves an entry along and edits its note", async () => {
    const parent = await seedParent("Rahul Eight");
    const child = await seedChild(parent._id);
    await seedEdition("cs7-a");
    await SeasonPlanService.addEntry({
      userId: String(parent._id),
      dependentId: String(child._id),
      editionSlug: "cs7-a",
    });

    const entered = await SeasonPlanService.updateEntry({
      userId: String(parent._id),
      dependentId: String(child._id),
      editionSlug: "cs7-a",
      status: "entered",
      note: "Entry sent 12 Sep",
    });
    assert.equal(entered.entries[0].status, "entered");
    assert.equal(entered.entries[0].note, "Entry sent 12 Sep");

    const cleared = await SeasonPlanService.updateEntry({
      userId: String(parent._id),
      dependentId: String(child._id),
      editionSlug: "cs7-a",
      note: "",
    });
    assert.equal(cleared.entries[0].note, undefined);
    // Clearing a note must not disturb the status beside it.
    assert.equal(cleared.entries[0].status, "entered");
  });

  it("refuses a status it does not recognise", async () => {
    const parent = await seedParent("Rahul Nine");
    const child = await seedChild(parent._id);
    await seedEdition("cs7-a");
    await SeasonPlanService.addEntry({
      userId: String(parent._id),
      dependentId: String(child._id),
      editionSlug: "cs7-a",
    });

    const error = await SeasonPlanService.updateEntry({
      userId: String(parent._id),
      dependentId: String(child._id),
      editionSlug: "cs7-a",
      status: "won",
    }).catch((e: Error & { statusCode?: number }) => e);

    assert.equal(error.statusCode, 400);
  });

  it("keeps a played tournament even after it leaves the calendar", async () => {
    // The point of the snapshot: an edition can be pruned or merged away, and a
    // parent's record of what their child played must not go with it.
    const parent = await seedParent("Rahul Ten");
    const child = await seedChild(parent._id);
    await seedEdition("cs7-a", { name: "AITA CS7 (Sonipat)" });
    await SeasonPlanService.addEntry({
      userId: String(parent._id),
      dependentId: String(child._id),
      editionSlug: "cs7-a",
    });
    await SeasonPlanService.updateEntry({
      userId: String(parent._id),
      dependentId: String(child._id),
      editionSlug: "cs7-a",
      status: "played",
    });

    await TournamentEdition.deleteMany({});

    const plan = await SeasonPlanService.get(String(parent._id), String(child._id));
    assert.equal(plan.entries.length, 1);
    assert.equal(plan.entries[0].name, "AITA CS7 (Sonipat)");
    assert.equal(plan.entries[0].status, "played");
  });

  it("removes an entry, and refuses to remove one twice", async () => {
    const parent = await seedParent("Rahul Eleven");
    const child = await seedChild(parent._id);
    await seedEdition("cs7-a");
    await SeasonPlanService.addEntry({
      userId: String(parent._id),
      dependentId: String(child._id),
      editionSlug: "cs7-a",
    });

    const plan = await SeasonPlanService.removeEntry(
      String(parent._id),
      String(child._id),
      "cs7-a"
    );
    assert.equal(plan.entries.length, 0);

    const error = await SeasonPlanService.removeEntry(
      String(parent._id),
      String(child._id),
      "cs7-a"
    ).catch((e: Error & { statusCode?: number }) => e);
    assert.equal(error.statusCode, 404);
  });

  it("goes with the profile when the profile is deleted", async () => {
    const parent = await seedParent("Rahul Twelve");
    const child = await seedChild(parent._id);
    await seedEdition("cs7-a");
    await SeasonPlanService.addEntry({
      userId: String(parent._id),
      dependentId: String(child._id),
      editionSlug: "cs7-a",
    });

    await deleteDependent(String(parent._id), String(child._id));
    assert.equal(await SeasonPlan.countDocuments({}), 0);
  });
});
