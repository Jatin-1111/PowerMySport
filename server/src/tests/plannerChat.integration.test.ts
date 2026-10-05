/* eslint-disable @typescript-eslint/no-var-requires */
// The assistant chat and the planner page must give one answer.
//
// The failure this exists to prevent is specific: the chat naming an event as a
// good option for a child while the planner page shows it closed to them. So the
// property under test is that both read the same verdicts, plus the boundaries
// that keep a personal answer from leaking or misleading: off by default, never
// for someone else's child, and never for a channel with no account behind it.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, afterEach, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { Player } = require("../client/models/Player");
const { User } = require("../client/models/User");
const { PlayerRankingLink } = require("../client/models/PlayerRankingLink");
const { RankingEntry } = require("../shared/models/RankingEntry");
const { TournamentEdition } = require("../shared/models/TournamentEdition");
const { PlannerService } = require("../client/services/PlannerService");
const {
  summarizePlanner,
  formatPlannerForPrompt,
  loadPlannerChatContext,
} = require("../client/services/PlannerChatContext");
const { ASSISTANT_CHAT_TOOLS } = require("../shared/services/chatToolsService");
const { buildRoadmapChatSystemPrompt } = require("../shared/services/roadmapChatService");

let memoryServer: { getUri(): string; stop(): Promise<void> };

const DAY = 24 * 60 * 60 * 1000;
const inDays = (days: number) => new Date(Date.now() + days * DAY);

const tool = ASSISTANT_CHAT_TOOLS.find(
  (candidate: { name: string }) => candidate.name === "get_upcoming_tournaments"
);

const seedParent = (name: string) =>
  User.create({
    name,
    email: `${name.toLowerCase().replace(/\s+/g, ".")}@example.test`,
    phone: `9${Math.floor(100000000 + Math.random() * 899999999)}`,
    password: "not-a-real-password",
    role: "Parent",
  });

const seedChild = (parentId: unknown, name: string) =>
  Player.create({ userId: parentId, type: "DEPENDENT", name });

const linkedChild = async (parentId: unknown, name: string, regNo: string, rank: number) => {
  const child = await seedChild(parentId, name);
  await RankingEntry.create({
    snapshot: new mongoose.Types.ObjectId(),
    sportSlug: "tennis",
    federationCode: "AITA",
    category: "Boys",
    subcategory: "U-14",
    asOnDate: new Date(Date.UTC(2026, 8, 7)),
    isLatest: true,
    rank,
    regNo,
    givenName: name,
    familyName: "Test",
    fullName: `${name} Test`,
    nameSearch: `${name} test`.toLowerCase(),
    dob: new Date(Date.UTC(2012, 4, 17)),
    birthYear: 2012,
    totalPoints: 100,
  });
  await PlayerRankingLink.create({ userId: parentId, dependentId: child._id, regNo });
  return child;
};

let counter = 0;
const seedEdition = (name: string, ladder: string, startInDays = 10) => {
  counter += 1;
  return TournamentEdition.create({
    sportSlug: "tennis",
    name,
    slug: `chat-edition-${counter}`,
    editionYear: 2026,
    startDate: inDays(startInDays + counter),
    sourceUrl: "https://example.test",
    city: "Sonipat",
    ageGroups: ["Under-14"],
    ladder,
    grade: 7,
    kind: "junior-ladder",
  });
};

before(async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());
  await PlayerRankingLink.syncIndexes();
});

after(async () => {
  await mongoose.disconnect();
  await memoryServer.stop();
});

beforeEach(async () => {
  counter = 0;
  process.env.PLANNER_CHAT = "on";
  await Promise.all([
    User.deleteMany({}),
    Player.deleteMany({}),
    PlayerRankingLink.deleteMany({}),
    RankingEntry.deleteMany({}),
    TournamentEdition.deleteMany({}),
  ]);
});

afterEach(() => {
  delete process.env.PLANNER_CHAT;
});

describe("the chat and the planner page agree", () => {
  it("offers exactly the events the planner shows as open, and none it shows as closed", async () => {
    const parent = await seedParent("Rahul Chat");
    // Rank 40 is inside the top 75, so Talent Series is closed to this child.
    const child = await linkedChild(parent._id, "Aarav", "550001", 40);
    await seedEdition("AITA CS7 (Sonipat)", "Championship Series");
    await seedEdition("AITA TS (Pune)", "Talent Series");

    const page = await PlannerService.forDependent(String(parent._id), String(child._id));
    const result = await tool.execute({ sportSlug: "tennis" }, { userId: String(parent._id) });

    assert.equal(result.personalised, true);
    const offered = result.children[0].openToEnter.map((event: { name: string }) => event.name);
    const open = page.shortlist.ownGroup.map(
      (entry: { edition: { name: string } }) => entry.edition.name
    );
    assert.deepEqual(offered, open);

    const refused = result.children[0].cannotEnter.map((event: { name: string }) => event.name);
    const closed = page.shortlist.closed.map(
      (entry: { edition: { name: string } }) => entry.edition.name
    );
    assert.deepEqual(refused, closed);
    assert.ok(!offered.includes("AITA TS (Pune)"));
  });

  it("puts the same verdicts in the roadmap chat prompt, in place of the general list", async () => {
    const parent = await seedParent("Rahul Prompt");
    await linkedChild(parent._id, "Aarav", "550002", 40);
    await seedEdition("AITA CS7 (Sonipat)", "Championship Series");
    await seedEdition("AITA TS (Pune)", "Talent Series");

    const summaries = await loadPlannerChatContext(String(parent._id), "tennis");
    const prompt = buildRoadmapChatSystemPrompt(
      { sportName: "Tennis", stages: [{ key: "a", order: 1, name: "A", buckets: [] }] },
      undefined,
      [
        {
          name: "General list event",
          startDate: new Date(),
          sourceUrl: "x",
          lastCheckedAt: new Date(),
        },
      ],
      formatPlannerForPrompt(summaries)
    );

    assert.match(prompt, /AITA CS7 \(Sonipat\)/);
    assert.match(prompt, /Talent Series is closed at rank 40/);
    // The general list must not ride along: two lists is the contradiction.
    assert.doesNotMatch(prompt, /General list event/);
  });
});

describe("when a personal answer is not allowed or not possible", () => {
  it("is off unless PLANNER_CHAT is on, and falls back to the general calendar", async () => {
    delete process.env.PLANNER_CHAT;
    const parent = await seedParent("Rahul Off");
    await linkedChild(parent._id, "Aarav", "550003", 312);
    await seedEdition("AITA CS7 (Sonipat)", "Championship Series");

    const result = await tool.execute({ sportSlug: "tennis" }, { userId: String(parent._id) });

    assert.equal(result.personalised, false);
    assert.match(result.note, /not filtered for any child/);
  });

  it("answers from the general calendar, and says so, when there is no account behind it", async () => {
    await seedEdition("AITA CS7 (Sonipat)", "Championship Series");

    const result = await tool.execute({ sportSlug: "tennis" }, {});

    assert.equal(result.personalised, false);
    assert.match(result.note, /linking a ranking/);
    assert.equal(result.tournaments.length, 1);
  });

  it("falls back for a parent whose child has no linked ranking", async () => {
    const parent = await seedParent("Rahul Unlinked");
    await seedChild(parent._id, "Diya");
    await seedEdition("AITA CS7 (Sonipat)", "Championship Series");

    const result = await tool.execute({ sportSlug: "tennis" }, { userId: String(parent._id) });

    assert.equal(result.personalised, false);
  });

  it("never includes another parent's child", async () => {
    const mine = await seedParent("Rahul Mine");
    const theirs = await seedParent("Priya Theirs");
    await linkedChild(theirs._id, "Neha", "550004", 200);
    await seedEdition("AITA CS7 (Sonipat)", "Championship Series");

    const result = await tool.execute({ sportSlug: "tennis" }, { userId: String(mine._id) });

    assert.equal(result.personalised, false);
    assert.doesNotMatch(JSON.stringify(result), /Neha/);
  });

  it("narrows to the named child by first name", async () => {
    const parent = await seedParent("Rahul Two Kids");
    await linkedChild(parent._id, "Aarav", "550005", 312);
    await linkedChild(parent._id, "Diya", "550006", 90);
    await seedEdition("AITA CS7 (Sonipat)", "Championship Series");

    const result = await tool.execute(
      { sportSlug: "tennis", childName: "diya" },
      { userId: String(parent._id) }
    );

    assert.equal(result.children.length, 1);
    assert.equal(result.children[0].child, "Diya");
  });
});

describe("what the model is given", () => {
  it("carries a first name, the list and the rank, and no identifiers", async () => {
    const parent = await seedParent("Rahul Privacy");
    const child = await linkedChild(parent._id, "Aarav Khandelwal", "550007", 312);
    await seedEdition("AITA CS7 (Sonipat)", "Championship Series");

    const overview = await PlannerService.forDependent(String(parent._id), String(child._id));
    const text = JSON.stringify(summarizePlanner(overview));

    assert.match(text, /"child":"Aarav"/);
    assert.doesNotMatch(text, /Khandelwal/);
    assert.doesNotMatch(text, /550007/);
    assert.doesNotMatch(text, /dob|birth/i);
  });

  it("says a missing entry deadline is not published, rather than leaving it out", async () => {
    const parent = await seedParent("Rahul Deadline");
    const child = await linkedChild(parent._id, "Aarav", "550008", 312);
    await seedEdition("AITA CS7 (Sonipat)", "Championship Series");

    const overview = await PlannerService.forDependent(String(parent._id), String(child._id));
    const summary = summarizePlanner(overview);

    assert.equal(summary.openToEnter[0].entryDeadline, "not published");
  });

  it("gives nothing to say for a child with no verdicts", () => {
    const summary = summarizePlanner({
      linkState: "not-linked",
      standing: null,
      shortlist: null,
      dependentName: "Diya",
      plan: { entries: [] },
    });
    assert.equal(summary, null);
  });
});

describe("the season the chat quotes", () => {
  const suggestion = (slug: string) => ({
    source: "ai",
    generatedAt: new Date().toISOString(),
    goal: "points",
    summary: "Two events across the weeks ahead.",
    items: [{ slug, tier: "recommended", reason: "A good fit for this child." }],
    notes: [],
  });

  it("includes the saved suggestion by event name, and says how it was made", async () => {
    const parent = await seedParent("Rahul Season");
    const child = await linkedChild(parent._id, "Aarav", "550010", 312);
    const edition = await seedEdition("AITA CS7 (Sonipat)", "Championship Series");
    const overview = await PlannerService.forDependent(String(parent._id), String(child._id));

    const summary = summarizePlanner(overview, suggestion(edition.slug));

    assert.equal(summary.suggestedSeason.picks[0].name, "AITA CS7 (Sonipat)");
    assert.equal(summary.suggestedSeason.picks[0].advice, "recommended");
    assert.match(summary.suggestedSeason.madeBy, /AI model, checked against the entry rules/);
  });

  it("leaves it out when there is no saved suggestion, so the chat does not invent one", async () => {
    const parent = await seedParent("Rahul NoSeason");
    const child = await linkedChild(parent._id, "Aarav", "550011", 312);
    await seedEdition("AITA CS7 (Sonipat)", "Championship Series");
    const overview = await PlannerService.forDependent(String(parent._id), String(child._id));

    assert.equal(summarizePlanner(overview, null).suggestedSeason, undefined);
    assert.match(
      formatPlannerForPrompt([summarizePlanner(overview, null)]),
      /do not invent a season plan/
    );
  });

  it("never names an event the child can no longer enter", async () => {
    const parent = await seedParent("Rahul Closed");
    const child = await linkedChild(parent._id, "Aarav", "550012", 40);
    const talent = await seedEdition("AITA TS (Pune)", "Talent Series");
    const overview = await PlannerService.forDependent(String(parent._id), String(child._id));

    // A stale suggestion naming an event that has since closed to them.
    const summary = summarizePlanner(overview, suggestion(talent.slug));

    assert.equal(summary.suggestedSeason.picks.length, 0);
  });

  it("does not spend the parent's allowance: loading the chat context never calls the model", async () => {
    const parent = await seedParent("Rahul NoSpend");
    await linkedChild(parent._id, "Aarav", "550013", 312);
    await seedEdition("AITA CS7 (Sonipat)", "Championship Series");

    const summaries = await loadPlannerChatContext(String(parent._id), "tennis");

    assert.equal(summaries[0].suggestedSeason, undefined);
  });
});
