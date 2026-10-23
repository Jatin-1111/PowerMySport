// Putting a tournament on a child's season plan from WhatsApp: finding the one event, the
// planner's say on whether the child can enter, the yes, the daily limit and the switch.
// Real (in-memory) MongoDB; the planner's ranking-based verdicts are stubbed, so no ranking data
// and no network are needed.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";
process.env.FRONTEND_URL = "https://site.example.test";

import assert = require("node:assert/strict");
const { after, afterEach, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { User } = require("../client/models/User");
const { Player } = require("../client/models/Player");
const { SeasonPlan } = require("../client/models/SeasonPlan");
const { WhatsAppConversation } = require("../client/models/WhatsAppConversation");
const { TournamentEdition } = require("../shared/models/TournamentEdition");
const { PlannerService } = require("../client/services/PlannerService");
const { SeasonPlanService } = require("../client/services/SeasonPlanService");
const { ASSISTANT_CHAT_TOOLS } = require("../shared/services/chatToolsService");
const { isAffirmative } = require("../shared/services/whatsappPendingAction");
const {
  answerWhatsAppMessage,
  hashPhone,
  identityAddendum,
} = require("../shared/services/whatsappAssistantService");
const redis = require("../config/redis").default;

let mongod: { getUri(): string; stop(): Promise<void> };
const realForDependent = PlannerService.forDependent;
const realAddEntry = SeasonPlanService.addEntry;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

after(async () => {
  PlannerService.forDependent = realForDependent;
  SeasonPlanService.addEntry = realAddEntry;
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  process.env.WHATSAPP_SEASON_PLAN = "on";
  await Promise.all([
    User.collection.deleteMany({}),
    Player.deleteMany({}),
    SeasonPlan.deleteMany({}),
    WhatsAppConversation.deleteMany({}),
    TournamentEdition.deleteMany({}),
  ]);
  // The default: no ranking is linked, which is what a real child without one gets.
  PlannerService.forDependent = async () => ({ linkState: "not-linked", shortlist: null });
});

afterEach(() => {
  delete process.env.WHATSAPP_SEASON_PLAN;
  PlannerService.forDependent = realForDependent;
  SeasonPlanService.addEntry = realAddEntry;
});

const HASH = "hash-season-parent";
const oid = () => new mongoose.Types.ObjectId();
const tool = (name: string) => ASSISTANT_CHAT_TOOLS.find((t: { name: string }) => t.name === name);

const parentWith = async (...names: string[]) => {
  const _id = oid();
  await User.collection.insertOne({
    _id,
    name: "Meera Kapoor",
    email: `${_id}@example.test`,
    phone: `98${Math.floor(10000000 + Math.random() * 89999999)}`,
    role: "Parent",
    isActive: true,
    status: "ACTIVE",
  });
  const children = [];
  for (const name of names.length ? names : ["Aarav Kapoor"]) {
    children.push(
      await Player.create({
        userId: _id,
        name,
        sportsFocus: ["Tennis"],
        chosenSport: "Tennis",
        dob: new Date("2012-12-01T00:00:00Z"),
      })
    );
  }
  return { userId: String(_id), children };
};

let seq = 0;
const seedEdition = (slug: string, name: string, over: Record<string, unknown> = {}) => {
  seq += 1;
  return TournamentEdition.create({
    sportSlug: "tennis",
    name,
    slug,
    editionYear: 2027,
    startDate: new Date(Date.now() + (20 + seq) * 24 * 3600 * 1000),
    sourceUrl: "https://example.test/calendar",
    city: "Pune",
    state: "Maharashtra",
    ...over,
  });
};

const ctx = (userId: string, userMessage = "add it") => ({ userId, phoneHash: HASH, userMessage });
const prepare = (c: Record<string, unknown>, args: Record<string, unknown> = {}) =>
  tool("prepare_season_plan_entry").execute(args, c);
const confirm = (c: Record<string, unknown>) => tool("confirm_pending_action").execute({}, c);
const nextTurn = () =>
  WhatsAppConversation.updateOne({ phoneHash: HASH }, { $inc: { totalMessageCount: 1 } });
const pendingOf = async () =>
  (await WhatsAppConversation.findOne({ phoneHash: HASH }).lean())?.pendingAction;
const planOf = (userId: string) => SeasonPlan.findOne({ userId }).lean();

const entry = (slug: string, name: string, over: Record<string, unknown> = {}) => ({
  edition: { slug, name },
  status: "open",
  reason: "Open to enter.",
  playingUp: false,
  notes: [],
  ...over,
});
const stubVerdicts = (
  lists: Partial<Record<"ownGroup" | "playingUp" | "unknown" | "closed", unknown[]>>
) => {
  PlannerService.forDependent = async () => ({
    linkState: "ready",
    shortlist: { ownGroup: [], playingUp: [], unknown: [], closed: [], ...lists },
  });
};

describe("the yes-check takes 'add'", () => {
  it("accepts 'yes add it' and 'add it, yes', and still refuses 'add' alone or 'yes add cricket'", () => {
    assert.equal(isAffirmative("yes add it"), true);
    assert.equal(isAffirmative("yes, add it please"), true);
    assert.equal(isAffirmative("add it"), false, "no yes in it");
    assert.equal(isAffirmative("add"), false);
    assert.equal(isAffirmative("yes add cricket"), false);
  });
});

describe("the switch and the account", () => {
  it("declines while the switch is off, and for a number with no account", async () => {
    const { userId } = await parentWith();
    delete process.env.WHATSAPP_SEASON_PLAN;
    const off = await prepare(ctx(userId), { tournament: "Pune" });
    assert.equal(off.available, false);
    assert.match(off.instruction, /not switched on yet/);

    process.env.WHATSAPP_SEASON_PLAN = "on";
    const none = await prepare({ phoneHash: HASH, userMessage: "x" }, { tournament: "Pune" });
    assert.equal(none.reason, "number_not_linked");
    assert.equal(await pendingOf(), undefined);
  });
});

describe("finding the event", () => {
  it("finds the one event, stores it to add, and adds nothing yet", async () => {
    const { userId } = await parentWith();
    await seedEdition("aita-cs7-pune", "AITA CS7 (Pune)");

    const out = await prepare(ctx(userId), { tournament: "Pune" });
    assert.equal(out.ready, true);
    assert.equal(out.event.name, "AITA CS7 (Pune)");
    assert.match(out.instruction, /only shortlists/);
    assert.match(out.instruction, /Do NOT call confirm_pending_action/);

    const pending = await pendingOf();
    assert.equal(pending.kind, "season_entry");
    assert.equal(pending.payload.editionSlug, "aita-cs7-pune");
    assert.equal(await planOf(userId), null, "nothing is on the plan yet");
  });

  it("asks which when several match, and takes the slug of the one they choose", async () => {
    const { userId } = await parentWith();
    await seedEdition("aita-cs7-pune", "AITA CS7 (Pune)");
    await seedEdition("aita-ts-pune", "AITA TS (Pune)");

    const which = await prepare(ctx(userId), { tournament: "Pune" });
    assert.equal(which.ready, false);
    assert.equal(which.reason, "which_event");
    assert.deepEqual(which.options.map((o: { slug: string }) => o.slug).sort(), [
      "aita-cs7-pune",
      "aita-ts-pune",
    ]);
    assert.equal(await pendingOf(), undefined);

    const chosen = await prepare(ctx(userId), { tournament: "aita-ts-pune" });
    assert.equal(chosen.ready, true);
    assert.equal(chosen.event.name, "AITA TS (Pune)");
  });

  it("says so when nothing matches, or when the event has already finished", async () => {
    const { userId } = await parentWith();
    await seedEdition("aita-old-pune", "AITA Old (Pune)", {
      startDate: new Date(Date.now() - 40 * 24 * 3600 * 1000),
    });
    for (const tournament of ["Nowhere", "Pune", ""]) {
      const out = await prepare(ctx(userId), { tournament });
      assert.equal(out.ready, false, tournament);
    }
    assert.equal((await prepare(ctx(userId), { tournament: "Nowhere" })).reason, "not_found");
  });

  it("says plainly when the event is already on the plan", async () => {
    const { userId, children } = await parentWith();
    const edition = await seedEdition("aita-cs7-pune", "AITA CS7 (Pune)");
    await SeasonPlanService.addEntry({
      userId,
      dependentId: String(children[0]._id),
      editionSlug: edition.slug,
    });
    const out = await prepare(ctx(userId), { tournament: "Pune" });
    assert.equal(out.reason, "already_on_plan");
    assert.equal(await pendingOf(), undefined);
  });

  it("searches the plan's own sport, so an event in another sport is not found for it", async () => {
    const { userId, children } = await parentWith();
    const tennis = await seedEdition("aita-cs7-pune", "AITA CS7 (Pune)");
    await SeasonPlanService.addEntry({
      userId,
      dependentId: String(children[0]._id),
      editionSlug: tennis.slug,
    });
    await seedEdition("state-cricket-pune", "State Cricket Cup (Pune)", { sportSlug: "cricket" });

    const out = await prepare(ctx(userId), { tournament: "Cricket" });
    assert.equal(out.reason, "not_found", "the plan's sport narrows the search");
  });

  it("asks which child when there are several, and cannot reach another parent's child", async () => {
    const { userId } = await parentWith("Aarav Kapoor", "Riya Kapoor");
    await parentWith("Zoya Other");
    await seedEdition("aita-cs7-pune", "AITA CS7 (Pune)");

    assert.equal((await prepare(ctx(userId), { tournament: "Pune" })).reason, "which_child");
    const wrong = await prepare(ctx(userId), { tournament: "Pune", childName: "Zoya" });
    assert.equal(wrong.reason, "child_not_on_account");
    assert.ok(!JSON.stringify(wrong).includes("Zoya Other"));
    assert.equal(
      (await prepare(ctx(userId), { tournament: "Pune", childName: "Riya" })).ready,
      true
    );
  });

  it("keeps a note, as plain text", async () => {
    const { userId } = await parentWith();
    await seedEdition("aita-cs7-pune", "AITA CS7 (Pune)");
    await prepare(ctx(userId), {
      tournament: "Pune",
      note: "Travel by <b>train</b> https://evil.example",
    });
    const note = (await pendingOf()).payload.note;
    assert.ok(!note.includes("evil.example"));
    assert.ok(!note.includes("<"));
  });
});

describe("what the planner says", () => {
  it("refuses an event the child cannot enter, with the planner's reason", async () => {
    const { userId } = await parentWith();
    await seedEdition("aita-cs7-pune", "AITA CS7 (Pune)");
    stubVerdicts({
      closed: [
        entry("aita-cs7-pune", "AITA CS7 (Pune)", {
          status: "closed",
          reason: "Entries closed on 5 Oct.",
        }),
      ],
    });
    const out = await prepare(ctx(userId), { tournament: "Pune" });
    assert.equal(out.ready, false);
    assert.equal(out.reason, "cannot_enter");
    assert.match(out.instruction, /Entries closed on 5 Oct/);
    assert.equal(await pendingOf(), undefined);
  });

  it("allows playing up, and says it is an older group", async () => {
    const { userId } = await parentWith();
    await seedEdition("aita-cs7-pune", "AITA CS7 (Pune)");
    stubVerdicts({ playingUp: [entry("aita-cs7-pune", "AITA CS7 (Pune)", { playingUp: true })] });
    const out = await prepare(ctx(userId), { tournament: "Pune" });
    assert.equal(out.ready, true);
    assert.match(out.caveats[0], /older age group/);
  });

  it("allows an event that needs a fact-sheet check, and says what to check", async () => {
    const { userId } = await parentWith();
    await seedEdition("aita-cs7-pune", "AITA CS7 (Pune)");
    stubVerdicts({
      unknown: [
        entry("aita-cs7-pune", "AITA CS7 (Pune)", {
          status: "unknown",
          reason: "Deadline not published.",
        }),
      ],
    });
    const out = await prepare(ctx(userId), { tournament: "Pune" });
    assert.equal(out.ready, true);
    assert.deepEqual(out.caveats, ["Deadline not published."]);
  });

  it("allows an event that is open to the child, with no caveat", async () => {
    const { userId } = await parentWith();
    await seedEdition("aita-cs7-pune", "AITA CS7 (Pune)");
    stubVerdicts({ ownGroup: [entry("aita-cs7-pune", "AITA CS7 (Pune)")] });
    const out = await prepare(ctx(userId), { tournament: "Pune" });
    assert.equal(out.ready, true);
    assert.deepEqual(out.caveats, []);
  });

  it("allows an event the planner has not judged, saying to check its rules", async () => {
    const { userId } = await parentWith();
    await seedEdition("aita-cs7-pune", "AITA CS7 (Pune)");
    stubVerdicts({ ownGroup: [entry("some-other-event", "Other")] });
    const out = await prepare(ctx(userId), { tournament: "Pune" });
    assert.equal(out.ready, true);
    assert.match(out.caveats[0], /not on Aarav's list/);
  });

  it("allows it and says eligibility could not be checked when no ranking is linked", async () => {
    const { userId } = await parentWith();
    await seedEdition("aita-cs7-pune", "AITA CS7 (Pune)");
    const out = await prepare(ctx(userId), { tournament: "Pune" });
    assert.equal(out.ready, true);
    assert.match(out.caveats[0], /could not check whether Aarav can enter/);
  });

  it("still prepares when the planner itself fails", async () => {
    const { userId } = await parentWith();
    await seedEdition("aita-cs7-pune", "AITA CS7 (Pune)");
    PlannerService.forDependent = async () => {
      throw new Error("planner down");
    };
    assert.equal((await prepare(ctx(userId), { tournament: "Pune" })).ready, true);
  });
});

describe("adding it, after the yes", () => {
  const prepared = async () => {
    const parent = await parentWith();
    await seedEdition("aita-cs7-pune", "AITA CS7 (Pune)");
    await prepare(ctx(parent.userId), { tournament: "Pune", note: "By train" });
    await nextTurn();
    return parent;
  };

  it("adds nothing when the message is not a clear yes, or in the same turn, and keeps it waiting", async () => {
    const { userId } = await parentWith();
    await seedEdition("aita-cs7-pune", "AITA CS7 (Pune)");
    await prepare(ctx(userId), { tournament: "Pune" });

    // Same turn: the model is trying to prepare and confirm in one reply.
    assert.equal((await confirm(ctx(userId, "yes"))).reason, "not_confirmed");

    await nextTurn();
    for (const text of ["tell me more", "yes but also the Delhi one", "no"]) {
      assert.equal((await confirm(ctx(userId, text))).done, false, text);
    }
    assert.ok(await pendingOf());
    assert.equal(await planOf(userId), null);
  });

  it("shortlists the event after a yes, with its note, and gives the planner link", async () => {
    const { userId } = await prepared();
    const out = await confirm(ctx(userId, "Yes add it"));

    assert.equal(out.done, true);
    assert.equal(out.added, true);
    assert.equal(out.status, "shortlisted");
    assert.equal(out.link, "https://site.example.test/planner");
    assert.match(out.instruction, /entering is done on the website/);

    const plan = await planOf(userId);
    assert.equal(plan.sportSlug, "tennis");
    assert.equal(plan.entries.length, 1);
    assert.equal(plan.entries[0].editionSlug, "aita-cs7-pune");
    assert.equal(plan.entries[0].status, "shortlisted", "never entered or played");
    assert.equal(plan.entries[0].note, "By train");
    assert.equal(await pendingOf(), undefined);
  });

  it("adds it once when two yeses arrive together", async () => {
    const { userId } = await prepared();
    const [a, b] = await Promise.all([confirm(ctx(userId, "yes")), confirm(ctx(userId, "yes"))]);
    assert.equal([a, b].filter((r) => r.added === true).length, 1);
    assert.equal((await planOf(userId)).entries.length, 1);
  });

  it("refuses after fifteen minutes, and when nothing is waiting", async () => {
    const { userId } = await prepared();
    await WhatsAppConversation.updateOne(
      { phoneHash: HASH },
      { $set: { "pendingAction.createdAt": new Date(Date.now() - 16 * 60_000) } }
    );
    assert.equal((await confirm(ctx(userId, "yes"))).reason, "nothing_pending");
    assert.equal(await planOf(userId), null);
  });

  it("does not retry an event the planner refuses at that point, such as one that left the calendar", async () => {
    const { userId } = await prepared();
    await TournamentEdition.deleteOne({ slug: "aita-cs7-pune" });

    const out = await confirm(ctx(userId, "yes"));
    assert.equal(out.done, false);
    assert.equal(out.reason, "refused");
    assert.match(out.instruction, /not on the calendar/);
    assert.equal(await pendingOf(), undefined, "trying again would not help");
  });

  it("keeps it waiting for a retry when something unexpected fails", async () => {
    const { userId } = await prepared();
    SeasonPlanService.addEntry = async () => {
      throw new Error("database down");
    };
    const out = await confirm(ctx(userId, "yes"));
    assert.equal(out.done, false);
    assert.equal(out.reason, "unavailable");
    assert.ok(await pendingOf(), "put back");
    assert.equal(await planOf(userId), null);

    SeasonPlanService.addEntry = realAddEntry;
    await nextTurn();
    assert.equal((await confirm(ctx(userId, "yes"))).added, true);
  });

  it("declines to add anything when the switch is turned off after preparing", async () => {
    const { userId } = await prepared();
    delete process.env.WHATSAPP_SEASON_PLAN;
    const out = await confirm(ctx(userId, "yes"));
    assert.equal(out.available, false);
    assert.equal(await planOf(userId), null);
  });
});

describe("the daily limit", () => {
  const fillPlan = async (userId: string, dependentId: unknown, count: number, addedAt: Date) => {
    const entries = [];
    for (let i = 0; i < count; i += 1) {
      entries.push({
        editionSlug: `filler-${i}`,
        name: `Filler ${i}`,
        startDate: new Date(Date.now() + 40 * 24 * 3600 * 1000),
        status: "shortlisted",
        addedAt,
      });
    }
    await SeasonPlan.create({ userId, dependentId, sportSlug: "tennis", entries });
  };

  it("allows ten events a day an account, counting the website's adds too", async () => {
    const { userId, children } = await parentWith();
    await seedEdition("aita-cs7-pune", "AITA CS7 (Pune)");
    await fillPlan(userId, children[0]._id, 10, new Date());

    const out = await prepare(ctx(userId), { tournament: "Pune" });
    assert.equal(out.reason, "daily_limit");
    assert.match(out.instruction, /10 events a day/);
    assert.equal(await pendingOf(), undefined);
  });

  it("does not count events added more than a day ago", async () => {
    const { userId, children } = await parentWith();
    await seedEdition("aita-cs7-pune", "AITA CS7 (Pune)");
    await fillPlan(userId, children[0]._id, 10, new Date(Date.now() - 26 * 3600_000));
    assert.equal((await prepare(ctx(userId), { tournament: "Pune" })).ready, true);
  });

  it("checks again at the yes, in case events were added in between", async () => {
    const { userId, children } = await parentWith();
    await seedEdition("aita-cs7-pune", "AITA CS7 (Pune)");
    await prepare(ctx(userId), { tournament: "Pune" });
    await nextTurn();
    await fillPlan(userId, children[0]._id, 10, new Date());

    const out = await confirm(ctx(userId, "yes"));
    assert.equal(out.done, false);
    assert.equal(out.reason, "daily_limit");
  });
});

describe("in the WhatsApp assistant", () => {
  const PHONE = "919822222222";

  it("tells a known parent's assistant how to add an event, and not an unknown number's", () => {
    const known = identityAddendum(true, null, []);
    assert.match(known, /Adding a tournament to a season plan/);
    assert.match(known, /prepare_season_plan_entry/);
    assert.match(
      known,
      /Never say an event is added until confirm_pending_action returns done: true/
    );
    assert.ok(!identityAddendum(false, null, []).includes("Adding a tournament"));
  });

  it("deletes a waiting event with the chat on STOP", async () => {
    const { userId } = await parentWith();
    await seedEdition("aita-cs7-pune", "AITA CS7 (Pune)");
    const phoneHash = hashPhone(PHONE);
    await prepare({ userId, phoneHash, userMessage: "add it" }, { tournament: "Pune" });
    assert.ok((await WhatsAppConversation.findOne({ phoneHash }).lean())?.pendingAction);

    await answerWhatsAppMessage(
      { id: "wamid.9", from: PHONE, type: "text", text: "STOP" },
      async function* () {
        yield "never used";
      }
    );
    assert.equal(await WhatsAppConversation.countDocuments({}), 0);
  });

  it("one waiting action at a time: preparing a second replaces the first", async () => {
    const { userId } = await parentWith();
    await seedEdition("aita-cs7-pune", "AITA CS7 (Pune)");
    await seedEdition("aita-ts-pune", "AITA TS (Pune)");
    await prepare(ctx(userId), { tournament: "aita-cs7-pune" });
    await prepare(ctx(userId), { tournament: "aita-ts-pune" });
    assert.equal((await pendingOf()).payload.editionSlug, "aita-ts-pune");
  });

  it("registers the tool, described to the model, and the confirm tool covers it", () => {
    assert.ok(tool("prepare_season_plan_entry"));
    assert.match(tool("prepare_season_plan_entry").description, /only ever shortlists/);
    assert.match(tool("confirm_pending_action").description, /season-plan entry/);
  });
});
