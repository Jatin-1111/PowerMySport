// A child's sporting history: the timeline, the entries a parent records, and who may touch them.
//
// Requests go through the real `app`, so the real route table, auth middleware, validation and
// write limiter are exercised, not just the service.
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
const request = require("supertest");

const { app } = require("../app");
const { generateToken } = require("../utils/jwt");
const { User } = require("../client/models/User");
const { Player } = require("../client/models/Player");
const { SeasonPlan } = require("../client/models/SeasonPlan");
const { ChildEvent } = require("../client/models/ChildEvent");
const { ChildAcademicProfile } = require("../client/models/ChildAcademicProfile");
const { CHILD_HISTORY_LIMITS } = require("@powermysport/shared-types");
const { buildTimeline, buildStats } = require("../client/services/ChildHistoryService/timeline");
const { plainText, cleanResultUrl } = require("../client/services/ChildHistoryService/text");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();

let mongod: { getUri(): string; stop(): Promise<void> };

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([ChildEvent.init(), ChildAcademicProfile.init()]);
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  for (const model of [ChildEvent, ChildAcademicProfile, SeasonPlan, Player, User]) {
    await model.deleteMany({});
  }
  await mongoose.connection.db.collection("playerrankinglinks").deleteMany({});
  await mongoose.connection.db.collection("rankingentries").deleteMany({});
});

let counter = 0;

/** A real parent row, a real token, and one child, the same triple a signed-in parent has. */
const parentWithChild = async (childFields: Record<string, unknown> = {}) => {
  const userId = oid();
  counter += 1;
  await User.collection.insertOne({
    _id: userId,
    name: "Parent Person",
    email: `${userId}@example.test`,
    phone: `8${String(counter).padStart(9, "0")}`,
    role: "Parent",
    isActive: true,
    status: "ACTIVE",
  });
  const childId = oid();
  await Player.collection.insertOne({
    _id: childId,
    userId,
    name: "Anaya",
    age: 14,
    yearsPlaying: 5,
    sportsFocus: ["Tennis"],
    ...childFields,
  });
  const token = generateToken({
    id: userId.toString(),
    email: `${userId}@example.test`,
    role: "Parent",
  });
  return { userId, childId, token };
};

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const url = (childId: unknown, rest = "") => `/api/child-history/${childId}${rest}`;

const result = {
  kind: "tournament_result",
  title: "Pune Open",
  resultLabel: "Quarter final",
  date: "2026-03-15",
  datePrecision: "month",
};

describe("who may read or change a child's history", () => {
  it("refuses a request with no sign-in", async () => {
    const { childId } = await parentWithChild();
    assert.equal((await request(app).get(url(childId))).status, 401);
    assert.equal((await request(app).post(url(childId, "/events")).send(result)).status, 401);
  });

  it("answers 404 to another parent for every route, and changes nothing", async () => {
    const owner = await parentWithChild();
    const stranger = await parentWithChild();
    const created = await request(app)
      .post(url(owner.childId, "/events"))
      .set(auth(owner.token))
      .send(result);
    assert.equal(created.status, 201);
    const eventId = created.body.data.id;

    const headers = auth(stranger.token);
    assert.equal((await request(app).get(url(owner.childId)).set(headers)).status, 404);
    assert.equal(
      (await request(app).post(url(owner.childId, "/events")).set(headers).send(result)).status,
      404
    );
    assert.equal(
      (
        await request(app)
          .patch(url(owner.childId, `/events/${eventId}`))
          .set(headers)
          .send({ title: "Hijacked" })
      ).status,
      404
    );
    assert.equal(
      (
        await request(app)
          .delete(url(owner.childId, `/events/${eventId}`))
          .set(headers)
      ).status,
      404
    );
    assert.equal(
      (
        await request(app)
          .put(url(owner.childId, "/academics"))
          .set(headers)
          .send({ board: "CBSE" })
      ).status,
      404
    );

    const stored = await ChildEvent.findById(eventId).lean();
    assert.equal(stored.title, "Pune Open");
    assert.equal(await ChildAcademicProfile.countDocuments({}), 0);
  });

  it("will not let the body choose who owns the entry or which child it is on", async () => {
    const owner = await parentWithChild();
    const stranger = await parentWithChild();
    const res = await request(app)
      .post(url(owner.childId, "/events"))
      .set(auth(owner.token))
      .send({
        ...result,
        userId: stranger.userId.toString(),
        childId: stranger.childId.toString(),
      });
    assert.equal(res.status, 400);
    assert.equal(await ChildEvent.countDocuments({}), 0);
  });

  it("does not use another parent's entry id under your own child", async () => {
    const a = await parentWithChild();
    const b = await parentWithChild();
    const created = await request(app)
      .post(url(b.childId, "/events"))
      .set(auth(b.token))
      .send(result);
    const res = await request(app)
      .delete(url(a.childId, `/events/${created.body.data.id}`))
      .set(auth(a.token));
    assert.equal(res.status, 404);
    assert.equal(await ChildEvent.countDocuments({ _id: created.body.data.id }), 1);
  });
});

describe("recording, editing and deleting an entry", () => {
  it("adds an entry that appears on the timeline, labelled as a parent record", async () => {
    const { childId, token } = await parentWithChild();
    const created = await request(app).post(url(childId, "/events")).set(auth(token)).send(result);
    assert.equal(created.status, 201);
    assert.equal(created.body.data.source, "parent");
    assert.equal(created.body.data.editable, true);

    const history = await request(app).get(url(childId)).set(auth(token));
    assert.equal(history.status, 200);
    const titles = history.body.data.timeline.map((row: { title: string }) => row.title);
    assert.ok(titles.includes("Pune Open"));
    assert.equal(history.body.data.usage.events, 1);
  });

  it("stores a month or a year as its first day, so nothing is invented", async () => {
    const { childId, token } = await parentWithChild();
    const month = await request(app)
      .post(url(childId, "/events"))
      .set(auth(token))
      .send({ ...result, date: "2026-03-15", datePrecision: "month" });
    assert.equal(month.body.data.occurredOn, "2026-03-01T00:00:00.000Z");
    const year = await request(app)
      .post(url(childId, "/events"))
      .set(auth(token))
      .send({ ...result, title: "Another", date: "2025-09-20", datePrecision: "year" });
    assert.equal(year.body.data.occurredOn, "2025-01-01T00:00:00.000Z");
  });

  it("marks an entry with a result link as such, and refuses a link that is not https", async () => {
    const { childId, token } = await parentWithChild();
    const withLink = await request(app)
      .post(url(childId, "/events"))
      .set(auth(token))
      .send({ ...result, resultUrl: "https://aitatennis.com/draw/123" });
    assert.equal(withLink.status, 201);
    assert.equal(withLink.body.data.source, "parent_with_link");

    for (const bad of [
      "http://example.org/draw",
      "javascript:alert(1)",
      "https://user:pass@example.org/draw",
      "not a link",
    ]) {
      const res = await request(app)
        .post(url(childId, "/events"))
        .set(auth(token))
        .send({ ...result, title: "Bad link", resultUrl: bad });
      assert.equal(res.status, 400, `${bad} should be refused`);
    }
  });

  it("stores plain text only: markup, links and line breaks are removed", async () => {
    const { childId, token } = await parentWithChild();
    const res = await request(app)
      .post(url(childId, "/events"))
      .set(auth(token))
      .send({
        ...result,
        title: "<script>alert(1)</script>Pune  Open",
        detail: "See https://evil.example for\nmore",
      });
    assert.equal(res.status, 201);
    assert.ok(!/[<>]/.test(res.body.data.title));
    assert.ok(!/https?:/.test(res.body.data.detail));
    assert.ok(!/\n/.test(res.body.data.detail));
  });

  it("refuses a date in the future, a date that does not exist, and an end before the start", async () => {
    const { childId, token } = await parentWithChild();
    const post = (body: Record<string, unknown>) =>
      request(app)
        .post(url(childId, "/events"))
        .set(auth(token))
        .send({ ...result, ...body });

    assert.equal((await post({ date: "2999-01-01", datePrecision: "day" })).status, 400);
    assert.equal((await post({ date: "2026-02-31", datePrecision: "day" })).status, 400);
    assert.equal(
      (
        await post({
          kind: "coaching_period",
          title: "Ace Academy",
          date: "2024-06-01",
          endedOn: "2023-01-01",
        })
      ).status,
      400
    );
    assert.equal((await post({ endedOn: "2026-04-01" })).status, 400, "only coaching has an end");
  });

  it("refuses an unknown kind, including injuries and documents, which are not in this version", async () => {
    const { childId, token } = await parentWithChild();
    for (const kind of ["injury", "document", "medical"]) {
      const res = await request(app)
        .post(url(childId, "/events"))
        .set(auth(token))
        .send({ ...result, kind });
      assert.equal(res.status, 400, kind);
    }
  });

  it("edits fields, clears an optional one with null, and never changes the kind", async () => {
    const { childId, token } = await parentWithChild();
    const created = await request(app)
      .post(url(childId, "/events"))
      .set(auth(token))
      .send({ ...result, detail: "Lost to the top seed", resultUrl: "https://example.org/draw" });
    const id = created.body.data.id;

    const edited = await request(app)
      .patch(url(childId, `/events/${id}`))
      .set(auth(token))
      .send({ resultLabel: "Semi final", detail: null, resultUrl: null });
    assert.equal(edited.status, 200);
    assert.equal(edited.body.data.resultLabel, "Semi final");
    assert.equal(edited.body.data.detail, undefined);
    assert.equal(edited.body.data.source, "parent", "no link left, so no longer 'link provided'");

    const kindChange = await request(app)
      .patch(url(childId, `/events/${id}`))
      .set(auth(token))
      .send({ kind: "award" });
    assert.equal(kindChange.status, 400);
    assert.equal((await ChildEvent.findById(id).lean()).kind, "tournament_result");

    assert.equal(
      (
        await request(app)
          .patch(url(childId, `/events/${id}`))
          .set(auth(token))
          .send({})
      ).status,
      400
    );
  });

  it("deletes an entry", async () => {
    const { childId, token } = await parentWithChild();
    const created = await request(app).post(url(childId, "/events")).set(auth(token)).send(result);
    const id = created.body.data.id;
    assert.equal(
      (
        await request(app)
          .delete(url(childId, `/events/${id}`))
          .set(auth(token))
      ).status,
      200
    );
    assert.equal(await ChildEvent.countDocuments({}), 0);
    assert.equal(
      (
        await request(app)
          .delete(url(childId, `/events/${id}`))
          .set(auth(token))
      ).status,
      404
    );
  });

  it(`holds at most ${CHILD_HISTORY_LIMITS.eventsPerChild} entries for one child`, async () => {
    const { userId, childId, token } = await parentWithChild();
    const rows = Array.from({ length: CHILD_HISTORY_LIMITS.eventsPerChild }, (_, i) => ({
      childId,
      userId,
      kind: "award",
      title: `Award ${i}`,
      occurredOn: new Date("2025-01-01"),
      datePrecision: "year",
    }));
    await ChildEvent.collection.insertMany(rows);
    const res = await request(app)
      .post(url(childId, "/events"))
      .set(auth(token))
      .send({ ...result, kind: "award", title: "One too many" });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /up to 300 entries/);
  });
});

describe("a played tournament", () => {
  const playPlan = (userId: unknown, childId: unknown) =>
    SeasonPlan.collection.insertOne({
      userId,
      dependentId: childId,
      sportSlug: "tennis",
      entries: [
        {
          editionSlug: "pune-open-2026",
          name: "Pune Open",
          startDate: new Date("2026-03-10T00:00:00.000Z"),
          status: "played",
          addedAt: new Date(),
        },
        {
          editionSlug: "mumbai-cup-2026",
          name: "Mumbai Cup",
          startDate: new Date("2026-05-10T00:00:00.000Z"),
          status: "entered",
          addedAt: new Date(),
        },
      ],
    });

  it("is on the timeline without any stored entry, with an offer to add a result", async () => {
    const { userId, childId, token } = await parentWithChild();
    await playPlan(userId, childId);

    const history = await request(app).get(url(childId)).set(auth(token));
    const rows = history.body.data.timeline;
    assert.equal(rows.length, 1, "only the played tournament, not the one merely entered");
    assert.equal(rows[0].title, "Pune Open");
    assert.equal(rows[0].canAddResult, true);
    assert.equal(rows[0].editable, false);
    assert.equal(history.body.data.stats.tournaments, 1);
    assert.equal(await ChildEvent.countDocuments({}), 0, "nothing was written to show it");
  });

  it("is replaced by the stored result once one is added, and is counted once", async () => {
    const { userId, childId, token } = await parentWithChild();
    await playPlan(userId, childId);

    const added = await request(app)
      .post(url(childId, "/events"))
      .set(auth(token))
      .send({ ...result, editionSlug: "pune-open-2026" });
    assert.equal(added.status, 201);

    const history = await request(app).get(url(childId)).set(auth(token));
    const rows = history.body.data.timeline;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].origin, "stored");
    assert.equal(rows[0].resultLabel, "Quarter final");
    assert.equal(rows[0].canAddResult, false);
    assert.equal(history.body.data.stats.tournaments, 1);
  });

  it("is edited, not duplicated, when its result is added a second time", async () => {
    const { userId, childId, token } = await parentWithChild();
    await playPlan(userId, childId);
    const body = { ...result, editionSlug: "pune-open-2026" };

    await request(app).post(url(childId, "/events")).set(auth(token)).send(body);
    const again = await request(app)
      .post(url(childId, "/events"))
      .set(auth(token))
      .send({ ...body, resultLabel: "Semi final" });
    assert.equal(again.status, 201);
    assert.equal(await ChildEvent.countDocuments({ childId }), 1);
    assert.equal(again.body.data.resultLabel, "Semi final");
  });

  it("will not take a result for a tournament that was not marked played, or on another kind", async () => {
    const { userId, childId, token } = await parentWithChild();
    await playPlan(userId, childId);
    const post = (body: Record<string, unknown>) =>
      request(app)
        .post(url(childId, "/events"))
        .set(auth(token))
        .send({ ...result, ...body });

    assert.equal((await post({ editionSlug: "mumbai-cup-2026" })).status, 400);
    assert.equal((await post({ editionSlug: "never-heard-of-it" })).status, 400);
    assert.equal((await post({ kind: "award", editionSlug: "pune-open-2026" })).status, 400);
  });

  it("is not offered to another parent's child", async () => {
    const owner = await parentWithChild();
    const stranger = await parentWithChild();
    await playPlan(owner.userId, owner.childId);
    const res = await request(app)
      .post(url(stranger.childId, "/events"))
      .set(auth(stranger.token))
      .send({ ...result, editionSlug: "pune-open-2026" });
    assert.equal(res.status, 400, "the other child never played it");
  });
});

describe("the page header, tiles and derived rows", () => {
  it("shows the sport, level and the year they started, and real tile numbers", async () => {
    const { userId, childId, token } = await parentWithChild({ experienceLevel: "competitive" });
    await ChildEvent.collection.insertMany([
      {
        childId,
        userId,
        kind: "award",
        title: "Club champion",
        occurredOn: new Date("2025-06-01"),
        datePrecision: "month",
      },
      {
        childId,
        userId,
        kind: "tournament_result",
        title: "Club open",
        occurredOn: new Date("2025-07-01"),
        datePrecision: "month",
      },
    ]);
    const { body } = await request(app).get(url(childId)).set(auth(token));
    assert.equal(body.data.child.sport, "Tennis");
    assert.equal(body.data.child.level, "competitive");
    assert.equal(body.data.child.sinceYear, new Date().getUTCFullYear() - 5);
    assert.deepEqual(body.data.stats, { yearsInSport: 5, tournaments: 1, awards: 1 });
  });

  it("has no invented numbers for a child with nothing recorded", async () => {
    const { childId, token } = await parentWithChild({ yearsPlaying: undefined });
    const { body } = await request(app).get(url(childId)).set(auth(token));
    assert.deepEqual(body.data.stats, { yearsInSport: null, tournaments: 0, awards: 0 });
    assert.deepEqual(body.data.timeline, []);
    assert.equal(body.data.academics, null);
    assert.equal(body.data.child.sinceYear, null);
  });

  it("shows the sport the family chose as one row", async () => {
    const { childId, token } = await parentWithChild({
      chosenSport: "Tennis",
      chosenSportAt: new Date("2026-02-01T00:00:00.000Z"),
    });
    const { body } = await request(app).get(url(childId)).set(auth(token));
    assert.equal(body.data.timeline.length, 1);
    assert.equal(body.data.timeline[0].title, "Chose Tennis");
  });

  it("shows a ranking read live, labelled as from the ranking list, with no registration number", async () => {
    const { userId, childId, token } = await parentWithChild();
    const db = mongoose.connection.db;
    await db.collection("playerrankinglinks").insertOne({
      userId,
      dependentId: childId,
      sportSlug: "tennis",
      federationCode: "AITA",
      regNo: "REG123",
      verificationMethod: "DOB_CHALLENGE",
      verifiedAt: new Date("2026-01-01"),
    });
    await db.collection("rankingentries").insertOne({
      sportSlug: "tennis",
      regNo: "REG123",
      isLatest: true,
      rank: 150,
      fullName: "Anaya S",
      category: "U14",
      subcategory: "Girls",
      totalPoints: 120,
      asOnDate: new Date("2026-10-20T00:00:00.000Z"),
    });

    const { body } = await request(app).get(url(childId)).set(auth(token));
    const row = body.data.timeline.find((r: { origin: string }) => r.origin === "ranking");
    assert.equal(row.title, "Ranked 150 in U14 Girls");
    assert.equal(row.source, "federation");
    assert.equal(row.editable, false);
    assert.ok(!JSON.stringify(body).includes("REG123"), "the registration number is not sent");
  });
});

describe("academics", () => {
  it("saves board, class year, school and field, then updates and clears them", async () => {
    const { childId, token } = await parentWithChild();
    const year = new Date().getUTCFullYear() + 3;

    const saved = await request(app)
      .put(url(childId, "/academics"))
      .set(auth(token))
      .send({
        board: "CBSE",
        graduationYear: year,
        school: "City School",
        intendedField: "Engineering",
      });
    assert.equal(saved.status, 200);

    const history = await request(app).get(url(childId)).set(auth(token));
    assert.deepEqual(history.body.data.academics, {
      board: "CBSE",
      graduationYear: year,
      school: "City School",
      intendedField: "Engineering",
    });

    await request(app)
      .put(url(childId, "/academics"))
      .set(auth(token))
      .send({ school: null, board: "ICSE" });
    const after = await request(app).get(url(childId)).set(auth(token));
    assert.equal(after.body.data.academics.board, "ICSE");
    assert.equal(after.body.data.academics.school, undefined);
    assert.equal(await ChildAcademicProfile.countDocuments({}), 1, "one profile per child");
  });

  it("refuses a board that is not on the list and a class year that makes no sense", async () => {
    const { childId, token } = await parentWithChild();
    const put = (body: Record<string, unknown>) =>
      request(app).put(url(childId, "/academics")).set(auth(token)).send(body);
    assert.equal((await put({ board: "MADE_UP" })).status, 400);
    assert.equal((await put({ graduationYear: 1999 })).status, 400);
    assert.equal((await put({ graduationYear: 2099 })).status, 400);
    assert.equal((await put({})).status, 400);
  });

  it("shows academic results and test scores on the timeline as a parent record", async () => {
    const { childId, token } = await parentWithChild();
    const post = (body: Record<string, unknown>) =>
      request(app).post(url(childId, "/events")).set(auth(token)).send(body);
    const score = await post({
      kind: "test_score",
      title: "SAT",
      resultLabel: "1380",
      date: "2026-05-01",
      datePrecision: "month",
    });
    const grade = await post({
      kind: "academic_result",
      title: "Class 10 board result",
      resultLabel: "92%",
      date: "2025-05-20",
      datePrecision: "month",
    });
    assert.equal(score.body.data.section, "academics");
    assert.equal(grade.body.data.section, "academics");
    assert.equal(score.body.data.source, "parent");
  });
});

describe("the timeline builder", () => {
  const stored = (over: Record<string, unknown>) => ({
    _id: oid(),
    kind: "award",
    title: "x",
    occurredOn: new Date("2026-01-01T00:00:00.000Z"),
    datePrecision: "day",
    ...over,
  });

  it("puts the newest first and breaks ties the same way every time", () => {
    const rows = buildTimeline({
      stored: [
        stored({ title: "old", occurredOn: new Date("2024-01-01T00:00:00.000Z") }),
        stored({ title: "new", occurredOn: new Date("2026-06-01T00:00:00.000Z") }),
      ],
      played: [],
      standings: [],
    });
    assert.deepEqual(
      rows.map((r: { title: string }) => r.title),
      ["new", "old"]
    );
  });

  it("counts a tournament once when it is both played and has a stored result", () => {
    const input = {
      stored: [
        stored({ kind: "tournament_result", editionSlug: "a" }),
        stored({ kind: "tournament_result" }),
      ],
      played: [
        { editionSlug: "a", name: "A", startDate: new Date("2026-01-01T00:00:00.000Z") },
        { editionSlug: "b", name: "B", startDate: new Date("2026-02-01T00:00:00.000Z") },
      ],
      standings: [],
    };
    assert.equal(buildStats(input, 3).tournaments, 3, "a, the unlinked result, and b");
  });
});

describe("text cleaning", () => {
  it("cuts to the limit and returns nothing for an empty value", () => {
    assert.equal(plainText("a".repeat(500), 10)?.length, 10);
    assert.equal(plainText("   ", 10), undefined);
    assert.equal(plainText(42, 10), undefined);
  });

  it("treats an empty result link as no link, and keeps a good one", () => {
    assert.equal(cleanResultUrl(""), undefined);
    assert.equal(cleanResultUrl("https://example.org/a"), "https://example.org/a");
  });
});
