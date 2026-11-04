/* eslint-disable @typescript-eslint/no-var-requires */
// Tests for the alerts a parent gets about admission and scholarship entries
// they follow. What matters here is what these must never do: tell someone twice
// about the same date, tell someone that a window they watched is "new" when they
// saw it open, or send anything about an entry that is not live.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { User } = require("../client/models/User");
const { ScheduledNotification } = require("../client/models/ScheduledNotification");
const { Opportunity } = require("../shared/models/Opportunity");
const { OpportunityFollow, MAX_FOLLOWS_PER_USER } = require("../shared/models/OpportunityFollow");
const {
  OpportunityAlertService,
  alertsFor,
  alertSummary,
  describeItem,
  longDate,
  entryPath,
} = require("../shared/services/opportunityAlerts");
const {
  followOpportunity,
  listFollows,
  unfollowOpportunity,
} = require("../shared/controller/opportunityFollowController");

let memoryServer: { getUri(): string; stop(): Promise<void> };

// 11:30 in India on 14 October 2026.
const NOW = new Date("2026-10-14T06:00:00Z");
const TODAY = "2026-10-14";
const addDays = (days: number) =>
  new Date(Date.parse(`${TODAY}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

describe("alertsFor", () => {
  const followedLongAgo = { createdAt: new Date("2026-01-01T00:00:00Z") };

  it("says a window opened when the parent was following before it opened", () => {
    const moments = alertsFor(
      { opensOn: addDays(-3), closesOn: addDays(60) },
      followedLongAgo,
      TODAY
    );
    assert.deepEqual(moments, [{ kind: "opened", date: addDays(-3), days: -3 }]);
  });

  it("does not say it opened to someone who followed after it opened", () => {
    const followedLate = { createdAt: new Date(`${addDays(-1)}T06:00:00Z`) };
    assert.deepEqual(
      alertsFor({ opensOn: addDays(-3), closesOn: addDays(60) }, followedLate, TODAY),
      []
    );
  });

  it("does not announce a window that opened more than two weeks ago", () => {
    assert.deepEqual(
      alertsFor({ opensOn: addDays(-20), closesOn: addDays(60) }, followedLongAgo, TODAY),
      []
    );
  });

  it("does not say a window opened if it has already closed", () => {
    assert.deepEqual(
      alertsFor({ opensOn: addDays(-5), closesOn: addDays(-1) }, followedLongAgo, TODAY),
      []
    );
  });

  it("says a window is closing within a week, including today", () => {
    assert.equal(alertsFor({ closesOn: addDays(7) }, followedLongAgo, TODAY)[0]?.days, 7);
    assert.equal(alertsFor({ closesOn: TODAY }, followedLongAgo, TODAY)[0]?.days, 0);
    assert.deepEqual(alertsFor({ closesOn: addDays(8) }, followedLongAgo, TODAY), []);
    assert.deepEqual(alertsFor({ closesOn: addDays(-1) }, followedLongAgo, TODAY), []);
  });

  it("tells a late follower a window is closing, because that is useful whenever it arrives", () => {
    const followedLate = { createdAt: new Date(`${addDays(-1)}T06:00:00Z`) };
    const moments = alertsFor({ opensOn: addDays(-30), closesOn: addDays(2) }, followedLate, TODAY);
    assert.deepEqual(
      moments.map((moment: { kind: string }) => moment.kind),
      ["closing"]
    );
  });

  it("does not repeat a date it already told them, but does for a new date", () => {
    const told = {
      ...followedLongAgo,
      alerted: { opened: addDays(-3), closing: addDays(4) },
    };
    assert.deepEqual(alertsFor({ opensOn: addDays(-3), closesOn: addDays(4) }, told, TODAY), []);
    // The organiser moved the deadline: that is a new date and a new alert.
    assert.equal(alertsFor({ closesOn: addDays(5) }, told, TODAY)[0]?.kind, "closing");
  });

  it("ignores dates that are not real dates", () => {
    assert.deepEqual(
      alertsFor({ opensOn: "soon", closesOn: "2026-13-45" }, followedLongAgo, TODAY),
      []
    );
    assert.deepEqual(alertsFor(undefined, followedLongAgo, TODAY), []);
  });
});

describe("wording", () => {
  const item = (over: Record<string, unknown>) => ({
    slug: "du-sports-quota",
    title: "DU sports quota",
    track: "admission",
    kind: "closing",
    date: "2026-10-20",
    days: 6,
    ...over,
  });

  it("formats dates in full and counts days", () => {
    assert.equal(longDate("2026-10-20"), "20 October 2026");
    assert.match(describeItem(item({})), /close in 6 days, on 20 October 2026/);
    assert.match(describeItem(item({ days: 1 })), /close tomorrow/);
    assert.match(describeItem(item({ days: 0 })), /close today/);
    assert.match(describeItem(item({ kind: "opened", days: -2 })), /opened on 20 October 2026/);
  });

  it("sends a parent to the official page rather than asserting the date", () => {
    assert.match(alertSummary([item({})]).body, /official page/);
    const many = alertSummary([item({}), item({ slug: "b", title: "B" })]);
    assert.match(many.title, /2 updates/);
    assert.match(many.body, /And 1 more/);
  });

  it("builds the public path from the track", () => {
    assert.equal(entryPath("admission", "x"), "/admissions/x");
    assert.equal(entryPath("scholarship", "x"), "/scholarships/x");
  });
});

before(async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());
  await OpportunityFollow.syncIndexes();
});

after(async () => {
  await mongoose.disconnect();
  await memoryServer.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    ScheduledNotification.deleteMany({}),
    Opportunity.deleteMany({}),
    OpportunityFollow.deleteMany({}),
  ]);
});

const seedParent = (name: string, over: Record<string, unknown> = {}) =>
  User.create({
    name,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.test`,
    phone: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
    password: "not-a-real-password",
    role: "Parent",
    ...over,
  });

const seedEntry = (
  slug: string,
  cycle: Record<string, unknown>,
  over: Record<string, unknown> = {}
) =>
  Opportunity.create({
    slug,
    track: "scholarship",
    category: "central-government",
    title: `Entry ${slug}`,
    status: "published",
    cycle: { keyDates: [], ...cycle },
    ...over,
  });

const follow = (userId: unknown, slug: string, createdAt = new Date("2026-01-01T00:00:00Z")) =>
  OpportunityFollow.create({ userId, slug, createdAt });

describe("OpportunityAlertService.sweep", () => {
  it("queues one notification per parent covering everything they follow, and stamps the follows", async () => {
    const parent = await seedParent("Asha Rao");
    await seedEntry("a", { opensOn: addDays(-2), closesOn: addDays(60) });
    await seedEntry("b", { closesOn: addDays(3) });
    await follow(parent._id, "a");
    await follow(parent._id, "b");

    const result = await OpportunityAlertService.sweep(NOW);
    assert.deepEqual(result, { queued: 1, followsCovered: 2 });

    const queued = await ScheduledNotification.find({}).lean();
    assert.equal(queued.length, 1);
    const [one] = queued;
    assert.equal(one.type, "OPPORTUNITY_ALERT");
    assert.equal(one.interval, "CUSTOM");
    assert.deepEqual(one.channels, { email: true, inApp: true, push: true });
    assert.equal(one.data.items.length, 2);
    // Closing soonest is the headline.
    assert.equal(one.data.items[0].kind, "closing");
    assert.equal(one.data.items[0].path, "/scholarships/b");
    assert.match(one.data.items[0].text, /Entry b close in 3 days/);

    const stamped = await OpportunityFollow.find({ userId: parent._id }).lean();
    const bySlug = Object.fromEntries(stamped.map((f: { slug: string }) => [f.slug, f]));
    assert.equal(bySlug.a.alerted.opened, addDays(-2));
    assert.equal(bySlug.b.alerted.closing, addDays(3));
  });

  it("is idempotent: a second sweep, or one the next day, sends nothing new", async () => {
    const parent = await seedParent("Asha Rao");
    await seedEntry("b", { closesOn: addDays(3) });
    await follow(parent._id, "b");

    assert.equal((await OpportunityAlertService.sweep(NOW)).queued, 1);
    assert.equal((await OpportunityAlertService.sweep(NOW)).queued, 0);
    const tomorrow = new Date(NOW.getTime() + 86_400_000);
    assert.equal((await OpportunityAlertService.sweep(tomorrow)).queued, 0);
    assert.equal(await ScheduledNotification.countDocuments({}), 1);
  });

  it("sends nothing about entries nobody follows, drafts, or dates that are not near", async () => {
    const parent = await seedParent("Asha Rao");
    await seedEntry("not-followed", { closesOn: addDays(2) });
    await seedEntry("draft", { closesOn: addDays(2) }, { status: "draft" });
    await seedEntry("far", { closesOn: addDays(40) });
    await follow(parent._id, "draft");
    await follow(parent._id, "far");

    assert.deepEqual(await OpportunityAlertService.sweep(NOW), { queued: 0, followsCovered: 0 });
    assert.equal(await ScheduledNotification.countDocuments({}), 0);
  });

  it("sends one notification per parent, not one per follow", async () => {
    const [one, two] = await Promise.all([seedParent("Asha Rao"), seedParent("Ben Das")]);
    await seedEntry("b", { closesOn: addDays(3) });
    await follow(one._id, "b");
    await follow(two._id, "b");

    assert.deepEqual(await OpportunityAlertService.sweep(NOW), { queued: 2, followsCovered: 2 });
  });

  it("leaves out an account being deleted, and one that is inactive", async () => {
    const leaving = await seedParent("Leaving Parent", { pendingDeletion: true });
    const inactive = await seedParent("Inactive Parent", { isActive: false });
    await seedEntry("b", { closesOn: addDays(3) });
    await follow(leaving._id, "b");
    await follow(inactive._id, "b");

    assert.equal((await OpportunityAlertService.sweep(NOW)).queued, 0);
  });

  it("does not tell someone who followed after it opened that it opened, but does tell them it is closing", async () => {
    const parent = await seedParent("Asha Rao");
    await seedEntry("a", { opensOn: addDays(-5), closesOn: addDays(2) });
    await follow(parent._id, "a", new Date(`${addDays(-1)}T06:00:00Z`));

    await OpportunityAlertService.sweep(NOW);
    const [queued] = await ScheduledNotification.find({}).lean();
    assert.deepEqual(
      queued.data.items.map((item: { kind: string }) => item.kind),
      ["closing"]
    );
  });
});

// ─── The follow endpoints ───────────────────────────────────────────────────

const call = async (
  handler: (req: unknown, res: unknown, next: (error?: unknown) => void) => unknown,
  userId: string,
  slug?: string
) => {
  let body: any;
  let error: any;
  const res = {
    status() {
      return res;
    },
    json(value: unknown) {
      body = value;
      return res;
    },
  };
  await new Promise<void>((resolve) => {
    const next = (err?: unknown) => {
      error = err;
      resolve();
    };
    const result = handler({ user: { id: userId }, params: { slug } }, res, next) as Promise<void>;
    Promise.resolve(result).then(() => resolve());
  });
  return { body, error };
};

describe("follow endpoints", () => {
  it("follows a published entry, and following again changes nothing", async () => {
    const parent = await seedParent("Asha Rao");
    await seedEntry("a", {});

    const first = await call(followOpportunity, String(parent._id), "A");
    assert.equal(first.body.data.following, true);
    await call(followOpportunity, String(parent._id), "a");
    assert.equal(await OpportunityFollow.countDocuments({ userId: parent._id }), 1);

    const listed = await call(listFollows, String(parent._id));
    assert.deepEqual(listed.body.data.slugs, ["a"]);
  });

  it("refuses an entry that is a draft or does not exist", async () => {
    const parent = await seedParent("Asha Rao");
    await seedEntry("draft", {}, { status: "draft" });

    assert.equal(
      (await call(followOpportunity, String(parent._id), "draft")).error?.statusCode,
      404
    );
    assert.equal(
      (await call(followOpportunity, String(parent._id), "nope")).error?.statusCode,
      404
    );
    assert.equal(await OpportunityFollow.countDocuments({}), 0);
  });

  it("keeps each parent's follows to themselves", async () => {
    const [one, two] = await Promise.all([seedParent("Asha Rao"), seedParent("Ben Das")]);
    await seedEntry("a", {});
    await call(followOpportunity, String(one._id), "a");

    assert.deepEqual((await call(listFollows, String(two._id))).body.data.slugs, []);
    await call(unfollowOpportunity, String(two._id), "a");
    assert.equal(await OpportunityFollow.countDocuments({ userId: one._id }), 1);
  });

  it("unfollows, and unfollowing again is fine", async () => {
    const parent = await seedParent("Asha Rao");
    await seedEntry("a", {});
    await call(followOpportunity, String(parent._id), "a");

    assert.equal(
      (await call(unfollowOpportunity, String(parent._id), "a")).body.data.following,
      false
    );
    assert.equal((await call(unfollowOpportunity, String(parent._id), "a")).error, undefined);
    assert.equal(await OpportunityFollow.countDocuments({}), 0);
  });

  it("stops at the cap", async () => {
    const parent = await seedParent("Asha Rao");
    await seedEntry("extra", {});
    await OpportunityFollow.insertMany(
      Array.from({ length: MAX_FOLLOWS_PER_USER }, (_, index) => ({
        userId: parent._id,
        slug: `filler-${index}`,
      }))
    );

    assert.equal(
      (await call(followOpportunity, String(parent._id), "extra")).error?.statusCode,
      400
    );
    assert.equal(
      await OpportunityFollow.countDocuments({ userId: parent._id }),
      MAX_FOLLOWS_PER_USER
    );
  });
});
