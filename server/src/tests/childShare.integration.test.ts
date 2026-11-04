// Shared profiles: making a link, what a person holding it may see, stopping it, and what the logs
// and the limits do with it. Requests go through the real `app`; storage is replaced by a recorder.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";
process.env.FRONTEND_URL = "https://powermysport.test";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const express = require("express");
const mongoose = require("mongoose");
const { MemoryStore } = require("express-rate-limit");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const { app } = require("../app");
const { generateToken } = require("../utils/jwt");
const { User } = require("../client/models/User");
const { Player } = require("../client/models/Player");
const { SeasonPlan } = require("../client/models/SeasonPlan");
const { ChildEvent } = require("../client/models/ChildEvent");
const { ChildAcademicProfile } = require("../client/models/ChildAcademicProfile");
const { ChildVideo } = require("../client/models/ChildVideo");
const { ChildShare } = require("../client/models/ChildShare");
const { deleteDependent } = require("../shared/services/AuthService/dependents");
const { s3Service } = require("../shared/services/S3Service");
const {
  createPublicShareRateLimiter,
  createPublicShareTokenRateLimiter,
} = require("../middleware/rateLimit");
const { redactPath } = require("../utils/redactPath");
const {
  SHARE_VIEW_FIELDS,
  SHARE_ROW_FIELDS,
  SHARE_CHILD_FIELDS,
  SHARE_ACADEMIC_FIELDS,
  SHARE_VIDEO_FIELDS,
  SHARE_STAT_FIELDS,
} = require("../client/services/ChildShareService/serialize");
const {
  CHILD_HISTORY_LIMITS,
  CHILD_SHARE_NOTICE,
  CHILD_SHARE_SECTIONS,
} = require("@powermysport/shared-types");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();
const DAY = 24 * 60 * 60 * 1000;

let mongod: { getUri(): string; stop(): Promise<void> };
const played: unknown[][] = [];
const realPlay = s3Service.generateChildVideoPlaybackUrl;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([ChildShare.init(), ChildVideo.init(), ChildEvent.init()]);
  s3Service.generateChildVideoPlaybackUrl = async (...args: unknown[]) => {
    played.push(args);
    return "https://storage.example/play?sig=abc";
  };
  s3Service.deleteFiles = async () => undefined;
});

after(async () => {
  s3Service.generateChildVideoPlaybackUrl = realPlay;
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  played.length = 0;
  for (const model of [
    ChildShare,
    ChildVideo,
    ChildEvent,
    ChildAcademicProfile,
    SeasonPlan,
    Player,
    User,
  ]) {
    await model.deleteMany({});
  }
  await mongoose.connection.db.collection("playerrankinglinks").deleteMany({});
  await mongoose.connection.db.collection("rankingentries").deleteMany({});
});

let counter = 0;

const SECRET = {
  email: "private.parent.",
  dob: "2011-03-04T00:00:00.000Z",
  tag: "secrettraitword",
  regNo: "REGSECRET99",
  city: "Hiddenville",
};

/** A parent with one child, and in the child's data every kind of thing that must never go out. */
const parentWithChild = async () => {
  const userId = oid();
  counter += 1;
  await User.collection.insertOne({
    _id: userId,
    name: "Parent Person",
    email: `private.parent.${counter}@example.test`,
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
    dob: new Date(SECRET.dob),
    age: 15,
    gender: "FEMALE",
    location: "Maharashtra",
    homeCity: SECRET.city,
    yearsPlaying: 5,
    experienceLevel: "competitive",
    sportsFocus: ["Tennis"],
    personalityTags: [SECRET.tag],
    quiz: { heightCm: 173, agility: "high" },
  });
  const token = generateToken({
    id: userId.toString(),
    email: `private.parent.${counter}@example.test`,
    role: "Parent",
  });
  return {
    userId: userId.toString(),
    childId: childId.toString(),
    token,
    _userId: userId,
    _childId: childId,
  };
};

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const shares = (childId: string, rest = "") => `/api/child-history/${childId}/shares${rest}`;

type Parent = Awaited<ReturnType<typeof parentWithChild>>;

const seedHistory = async (p: Parent) => {
  const now = new Date();
  await ChildEvent.create([
    {
      childId: p._childId,
      userId: p._userId,
      kind: "tournament_result",
      title: "Pune Open",
      resultLabel: "Quarter final",
      occurredOn: new Date("2026-03-01"),
      datePrecision: "month",
      resultUrl: "https://example.org/draw",
    },
    {
      childId: p._childId,
      userId: p._userId,
      kind: "award",
      title: "Club champion",
      occurredOn: new Date("2025-06-01"),
      datePrecision: "month",
    },
    {
      childId: p._childId,
      userId: p._userId,
      kind: "test_score",
      title: "SAT",
      resultLabel: "1380",
      occurredOn: new Date("2026-05-01"),
      datePrecision: "month",
    },
    {
      childId: p._childId,
      userId: p._userId,
      kind: "coaching_period",
      title: "Ace Academy",
      occurredOn: new Date("2022-01-01"),
      datePrecision: "year",
    },
  ]);
  await ChildAcademicProfile.create({
    childId: p._childId,
    userId: p._userId,
    board: "CBSE",
    graduationYear: now.getUTCFullYear() + 3,
    school: "City School",
    intendedField: "Engineering",
  });
  await mongoose.connection.db.collection("playerrankinglinks").insertOne({
    userId: p._userId,
    dependentId: p._childId,
    sportSlug: "tennis",
    federationCode: "AITA",
    regNo: SECRET.regNo,
    verificationMethod: "DOB_CHALLENGE",
    verifiedAt: now,
  });
  await mongoose.connection.db.collection("rankingentries").insertOne({
    sportSlug: "tennis",
    regNo: SECRET.regNo,
    isLatest: true,
    rank: 150,
    fullName: "Anaya Real Surname",
    category: "U14",
    subcategory: "Girls",
    totalPoints: 120,
    asOnDate: new Date("2026-10-20T00:00:00.000Z"),
  });
};

const readyVideo = (p: Parent, over: Record<string, unknown> = {}) =>
  ChildVideo.create({
    childId: p._childId,
    userId: p._userId,
    status: "ready",
    title: "Final set",
    storageKey: `child-videos/${p.childId}/${oid()}.mp4`,
    contentType: "video/mp4",
    declaredBytes: 10_000_000,
    sizeBytes: 10_000_000,
    durationSeconds: 65,
    ...over,
  });

const make = async (p: Parent, body: Record<string, unknown> = {}) =>
  request(app)
    .post(shares(p.childId))
    .set(auth(p.token))
    .send({
      recipientLabel: "Coach Miller, State University",
      sections: [...CHILD_SHARE_SECTIONS],
      consent: true,
      ...body,
    });

const tokenOf = (url: string): string => url.split("/share/")[1] as string;
const open = (token: string) => request(app).get(`/api/share/${token}`);

describe("making a link", () => {
  it("returns the link once, stores only a hash of it, and records what the parent agreed to", async () => {
    const p = await parentWithChild();
    await seedHistory(p);
    const res = await make(p);

    assert.equal(res.status, 201);
    assert.match(res.body.data.url, /^https:\/\/powermysport\.test\/share\/[A-Za-z0-9_-]{43}$/);
    assert.equal(res.headers["cache-control"], "no-store");
    const token = tokenOf(res.body.data.url);

    const stored = await ChildShare.findOne({}).lean();
    assert.ok(!JSON.stringify(stored).includes(token), "the link itself is not stored anywhere");
    assert.match(stored.tokenHash, /^[a-f0-9]{64}$/);
    assert.equal(stored.consentVersion, "2026-10");
    assert.ok(Math.abs(stored.consentAt.getTime() - Date.now()) < 10_000);
    assert.equal(stored.recipientLabel, "Coach Miller, State University");
    assert.ok(Math.abs(stored.expiresAt.getTime() - (Date.now() + 30 * DAY)) < 60_000, "30 days");
    assert.ok(Math.abs(stored.purgeAt.getTime() - (stored.expiresAt.getTime() + 90 * DAY)) < 1000);
  });

  it("will not make a link without an explicit agreement", async () => {
    const p = await parentWithChild();
    for (const consent of [undefined, false, "yes", 1]) {
      const body: Record<string, unknown> = {
        recipientLabel: "Coach",
        sections: ["results"],
      };
      if (consent !== undefined) body.consent = consent;
      const res = await request(app).post(shares(p.childId)).set(auth(p.token)).send(body);
      assert.equal(res.status, 400);
    }
    assert.equal(await ChildShare.countDocuments({}), 0);
  });

  it("refuses an empty or unknown section list, a missing label, and a body that names an owner or a token", async () => {
    const p = await parentWithChild();
    const bad: Array<Record<string, unknown>> = [
      { sections: [] },
      { sections: ["results", "injuries"] },
      { sections: ["medical"] },
      { recipientLabel: "   " },
      { userId: oid().toString() },
      { tokenHash: "abc" },
      { expiresAt: "2099-01-01" },
    ];
    for (const extra of bad)
      assert.equal((await make(p, extra)).status, 400, JSON.stringify(extra));
    assert.equal(await ChildShare.countDocuments({}), 0);
  });

  it("cleans the label to plain text", async () => {
    const p = await parentWithChild();
    const res = await make(p, { recipientLabel: "<b>Coach</b> https://evil.example Miller" });
    assert.equal(res.status, 201);
    assert.ok(!/[<>]|https?:/.test(res.body.data.share.recipientLabel));
  });

  it("is only for the parent's own child, and needs a sign-in", async () => {
    const owner = await parentWithChild();
    const stranger = await parentWithChild();
    assert.equal((await make({ ...owner, token: stranger.token })).status, 404);
    assert.equal((await request(app).post(shares(owner.childId)).send({})).status, 401);
    assert.equal(await ChildShare.countDocuments({}), 0);
  });

  it(`holds at most ${CHILD_HISTORY_LIMITS.activeSharesPerChild} live links for one child`, async () => {
    const p = await parentWithChild();
    const rows = Array.from({ length: CHILD_HISTORY_LIMITS.activeSharesPerChild }, (_, i) => ({
      childId: p._childId,
      userId: p._userId,
      recipientLabel: `Coach ${i}`,
      tokenHash: `hash-${i}`,
      sections: ["results"],
      expiresAt: new Date(Date.now() + DAY),
      purgeAt: new Date(Date.now() + 100 * DAY),
      consentVersion: "2026-10",
      consentAt: new Date(),
    }));
    await ChildShare.collection.insertMany(rows);
    const res = await make(p);
    assert.equal(res.status, 400);
    assert.match(res.body.message, /up to 20 links/);
  });

  it("shares only this child's finished clips, refuses someone else's, and drops an empty videos section", async () => {
    const p = await parentWithChild();
    const other = await parentWithChild();
    const mine = await readyVideo(p);
    const pending = await readyVideo(p, { status: "uploading" });
    const theirs = await readyVideo(other);

    assert.equal(
      (await make(p, { sections: ["results", "videos"], videoIds: [theirs._id.toString()] }))
        .status,
      400
    );
    assert.equal(
      (await make(p, { sections: ["results", "videos"], videoIds: [pending._id.toString()] }))
        .status,
      400
    );

    const ok = await make(p, { sections: ["results", "videos"], videoIds: [mine._id.toString()] });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.data.share.videoCount, 1);

    const none = await parentWithChild();
    const empty = await make(none, { sections: ["results", "videos"] });
    assert.equal(empty.status, 201);
    assert.deepEqual(empty.body.data.share.sections, ["results"], "no clips, so no videos section");
  });

  it("shares every finished clip by default when the videos section is ticked and none are named", async () => {
    const p = await parentWithChild();
    await readyVideo(p);
    await readyVideo(p, { title: "Second" });
    const res = await make(p, { sections: ["videos"] });
    assert.equal(res.body.data.share.videoCount, 2);
  });
});

describe("the preview", () => {
  it("shows exactly what a coach would see, and creates nothing", async () => {
    const p = await parentWithChild();
    await seedHistory(p);
    const res = await request(app)
      .post(shares(p.childId, "/preview"))
      .set(auth(p.token))
      .send({ sections: ["results", "academics"] });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.child.name, "Anaya");
    assert.equal(res.body.data.notice, CHILD_SHARE_NOTICE);
    assert.equal(await ChildShare.countDocuments({}), 0);
  });

  it("matches what the real link then returns", async () => {
    const p = await parentWithChild();
    await seedHistory(p);
    const sections = ["results", "ranking", "academics"];
    const preview = await request(app)
      .post(shares(p.childId, "/preview"))
      .set(auth(p.token))
      .send({ sections });
    const created = await make(p, { sections });
    const seen = await open(tokenOf(created.body.data.url));

    const strip = (view: Record<string, unknown>) => ({ ...view, sharedAt: 0, expiresAt: 0 });
    assert.deepEqual(strip(seen.body.data), strip(preview.body.data));
  });

  it("is only for the parent's own child", async () => {
    const owner = await parentWithChild();
    const stranger = await parentWithChild();
    const res = await request(app)
      .post(shares(owner.childId, "/preview"))
      .set(auth(stranger.token))
      .send({ sections: ["results"] });
    assert.equal(res.status, 404);
  });
});

describe("opening a link without an account", () => {
  it("works with no sign-in, says it is private, and counts the open", async () => {
    const p = await parentWithChild();
    await seedHistory(p);
    const { url } = (await make(p)).body.data;
    const token = tokenOf(url);

    const res = await open(token);
    assert.equal(res.status, 200);
    assert.equal(res.headers["cache-control"], "no-store");
    assert.equal(res.headers["x-robots-tag"], "noindex, nofollow, noarchive");
    assert.equal(res.headers["referrer-policy"], "no-referrer");
    assert.equal(res.body.data.child.name, "Anaya");
    assert.equal(res.body.data.child.state, "Maharashtra");
    assert.equal(res.body.data.notice, CHILD_SHARE_NOTICE);

    await open(token);
    const stored = await ChildShare.findOne({}).lean();
    assert.equal(stored.openCount, 2);
    assert.ok(stored.lastOpenedAt);
  });

  it("answers 404 to a token that was never issued or is not shaped like one", async () => {
    for (const token of ["x", "a".repeat(43), "a".repeat(44)]) {
      const res = await open(token);
      assert.equal(res.status, 404, token);
      assert.equal(res.body.message, "This link was not found.");
    }
    // Paths that are not a single segment never reach the link lookup at all.
    for (const token of ["../../etc/passwd", "%20", "a/b"]) {
      assert.equal((await open(token)).status, 404, token);
    }
  });

  it("says no longer active for a link that is over, and counts nothing for it", async () => {
    const p = await parentWithChild();
    const created = await make(p);
    const token = tokenOf(created.body.data.url);
    await ChildShare.collection.updateOne({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });

    const res = await open(token);
    assert.equal(res.status, 410);
    assert.match(res.body.message, /no longer active/);
    assert.equal((await ChildShare.findOne({}).lean()).openCount, 0);
  });

  it("stops the moment the parent stops it, and the parent's list says so", async () => {
    const p = await parentWithChild();
    const created = await make(p);
    const token = tokenOf(created.body.data.url);
    assert.equal((await open(token)).status, 200);

    const stopped = await request(app)
      .delete(shares(p.childId, `/${created.body.data.share.id}`))
      .set(auth(p.token));
    assert.equal(stopped.status, 200);
    assert.equal(stopped.body.data.status, "revoked");

    assert.equal((await open(token)).status, 410);
    const list = await request(app).get(shares(p.childId)).set(auth(p.token));
    assert.equal(list.body.data[0].status, "revoked");
    assert.equal(list.body.data[0].openCount, 1);
  });

  it("is gone when the child is deleted", async () => {
    const p = await parentWithChild();
    const created = await make(p);
    await deleteDependent(p.userId, p.childId);
    assert.equal((await open(tokenOf(created.body.data.url))).status, 404);
  });

  it("does not depend on Redis: the same answers come back with Redis off", async () => {
    assert.equal(process.env.REDIS_ENABLED, "false");
    const p = await parentWithChild();
    const created = await make(p);
    const token = tokenOf(created.body.data.url);
    assert.equal((await open(token)).status, 200);
    await request(app)
      .delete(shares(p.childId, `/${created.body.data.share.id}`))
      .set(auth(p.token));
    assert.equal((await open(token)).status, 410);
  });
});

describe("what a link shows", () => {
  it("shows only the ticked sections, and only the figures behind them", async () => {
    const p = await parentWithChild();
    await seedHistory(p);
    const { url } = (await make(p, { sections: ["awards"] })).body.data;
    const { data } = (await open(tokenOf(url))).body;

    assert.deepEqual(
      data.timeline.map((r: { section: string }) => r.section),
      ["awards"]
    );
    assert.equal(data.stats.awards, 1);
    assert.equal(
      data.stats.tournaments,
      undefined,
      "tournaments belong to Results, which was not shared"
    );
    assert.equal(data.academics, null);
    assert.equal(data.child.classYear, null);
    assert.deepEqual(data.videos, []);
  });

  it("shows class year, board, school and field only when academics is ticked", async () => {
    const p = await parentWithChild();
    await seedHistory(p);
    const without = (await open(tokenOf((await make(p, { sections: ["results"] })).body.data.url)))
      .body.data;
    assert.equal(without.child.classYear, null);
    assert.equal(without.academics, null);
    assert.ok(!without.timeline.some((r: { section: string }) => r.section === "academics"));

    const withAcademics = (
      await open(tokenOf((await make(p, { sections: ["academics"] })).body.data.url))
    ).body.data;
    assert.equal(withAcademics.child.classYear, new Date().getUTCFullYear() + 3);
    assert.deepEqual(withAcademics.academics, {
      board: "CBSE",
      school: "City School",
      intendedField: "Engineering",
    });
    assert.deepEqual(
      withAcademics.timeline.map((r: { title: string }) => r.title),
      ["SAT"]
    );
  });

  it("labels every row with where it came from, and the federation row with the ranking list", async () => {
    const p = await parentWithChild();
    await seedHistory(p);
    const { data } = (
      await open(tokenOf((await make(p, { sections: ["results", "ranking"] })).body.data.url))
    ).body;
    const bySource = Object.fromEntries(
      data.timeline.map((r: { title: string; source: string }) => [r.title, r.source])
    );
    assert.equal(bySource["Pune Open"], "parent_with_link");
    assert.equal(bySource["Ranked 150 in U14 Girls"], "federation");
  });

  it("lists only the clips ticked for this link, not a later one, and never storage details", async () => {
    const p = await parentWithChild();
    const shown = await readyVideo(p);
    const created = await make(p, { sections: ["videos"], videoIds: [shown._id.toString()] });
    await readyVideo(p, { title: "Added later" });

    const { data } = (await open(tokenOf(created.body.data.url))).body;
    assert.deepEqual(data.videos, [
      { id: shown._id.toString(), title: "Final set", durationSeconds: 65, sizeBytes: 10_000_000 },
    ]);
  });

  it("leaves out a clip that was removed after the link was made", async () => {
    const p = await parentWithChild();
    const shown = await readyVideo(p);
    const created = await make(p, { sections: ["videos"] });
    await ChildVideo.deleteOne({ _id: shown._id });
    const { data } = (await open(tokenOf(created.body.data.url))).body;
    assert.deepEqual(data.videos, []);
  });
});

/** Every key of an object must be on its list. */
const onlyListed = (value: Record<string, unknown>, allowed: readonly string[], where: string) => {
  const extra = Object.keys(value).filter((key) => !allowed.includes(key));
  assert.deepEqual(
    extra,
    [],
    `${where} carries a field that is not on its list: ${extra.join(", ")}`
  );
};

describe("nothing private reaches the person holding a link", () => {
  it("carries only the listed fields, at every level, with every section ticked", async () => {
    const p = await parentWithChild();
    await seedHistory(p);
    await readyVideo(p);
    const { url } = (await make(p)).body.data;
    const { data } = (await open(tokenOf(url))).body;

    onlyListed(data, SHARE_VIEW_FIELDS, "the response");
    onlyListed(data.child, SHARE_CHILD_FIELDS, "child");
    onlyListed(data.stats, SHARE_STAT_FIELDS, "stats");
    onlyListed(data.academics, SHARE_ACADEMIC_FIELDS, "academics");
    for (const row of data.timeline) onlyListed(row, SHARE_ROW_FIELDS, `row "${row.title}"`);
    for (const video of data.videos) onlyListed(video, SHARE_VIDEO_FIELDS, "video");
    assert.ok(data.timeline.length >= 5, "the check ran over real rows");
    assert.ok(data.videos.length === 1);
  });

  it("contains none of the private values planted in the child's data", async () => {
    const p = await parentWithChild();
    await seedHistory(p);
    const video = await readyVideo(p);
    const { url } = (await make(p)).body.data;
    const body = JSON.stringify((await open(tokenOf(url))).body);

    const forbidden: Record<string, string> = {
      "the date of birth": "2011-03-04",
      "the parent's email": SECRET.email,
      "the parent's phone": "8000000",
      "a personality tag": SECRET.tag,
      "a home city": SECRET.city,
      "a registration number": SECRET.regNo,
      "the ranking list's surname": "Real Surname",
      "the child's id": p.childId,
      "the parent's id": p.userId,
      "a storage key": "child-videos/",
      "the stored file name": String(video.storageKey),
      "the token hash": (await ChildShare.findOne({}).lean()).tokenHash,
      "the age": '"age"',
      "the gender": "FEMALE",
      "quiz answers": "agility",
      "the open-upload id": "uploadId",
    };
    for (const [what, value] of Object.entries(forbidden)) {
      assert.ok(!body.includes(value), `${what} (${value}) appears in what a link shows`);
    }
  });
});

describe("playing a clip from a link", () => {
  const setup = async () => {
    const p = await parentWithChild();
    const shown = await readyVideo(p);
    const hidden = await readyVideo(p, { title: "Not shared" });
    const created = await make(p, { sections: ["videos"], videoIds: [shown._id.toString()] });
    return {
      p,
      shown,
      hidden,
      token: tokenOf(created.body.data.url),
      shareId: created.body.data.share.id,
    };
  };
  const play = (token: string, id: unknown) =>
    request(app).get(`/api/share/${token}/videos/${id}/playback`);

  it("gives a short link for a clip ticked for this link, with a fixed type, uncacheable", async () => {
    const { shown, token } = await setup();
    const res = await play(token, shown._id);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.url, "https://storage.example/play?sig=abc");
    assert.equal(res.body.data.expiresInSeconds, 600);
    assert.equal(res.headers["cache-control"], "no-store");
    assert.deepEqual(played[0], [shown.storageKey, "video/mp4", 600]);
  });

  it("gives nothing for a clip of the same child that was not ticked, or one that does not exist", async () => {
    const { hidden, token } = await setup();
    assert.equal((await play(token, hidden._id)).status, 404);
    assert.equal((await play(token, oid())).status, 404);
    assert.equal((await play(token, "not-an-id")).status, 404);
    assert.equal(played.length, 0);
  });

  it("gives nothing for another family's clip, even by id", async () => {
    const { token } = await setup();
    const other = await parentWithChild();
    const theirs = await readyVideo(other);
    assert.equal((await play(token, theirs._id)).status, 404);
    assert.equal(played.length, 0);
  });

  it("stops with the link", async () => {
    const { p, shown, token, shareId } = await setup();
    await request(app)
      .delete(shares(p.childId, `/${shareId}`))
      .set(auth(p.token));
    assert.equal((await play(token, shown._id)).status, 410);
    assert.equal(played.length, 0);
  });

  it("is not available for a link that did not include the videos section", async () => {
    const p = await parentWithChild();
    const video = await readyVideo(p);
    const created = await make(p, { sections: ["results"] });
    assert.equal((await play(tokenOf(created.body.data.url), video._id)).status, 404);
  });
});

describe("the parent's list of links", () => {
  it("shows the state, count and last open of each, newest first, and never a link or a hash", async () => {
    const p = await parentWithChild();
    const a = await make(p, { recipientLabel: "First" });
    await make(p, { recipientLabel: "Second" });
    await ChildShare.collection.updateOne(
      { recipientLabel: "First" },
      { $set: { expiresAt: new Date(Date.now() - DAY) } }
    );

    const list = await request(app).get(shares(p.childId)).set(auth(p.token));
    assert.deepEqual(
      list.body.data.map((s: { recipientLabel: string; status: string }) => [
        s.recipientLabel,
        s.status,
      ]),
      [
        ["Second", "active"],
        ["First", "expired"],
      ]
    );
    const text = JSON.stringify(list.body);
    assert.ok(!text.includes("tokenHash") && !text.includes("/share/"));
    assert.ok(!text.includes(tokenOf(a.body.data.url)));
  });

  it("is only for the parent's own child", async () => {
    const owner = await parentWithChild();
    const stranger = await parentWithChild();
    await make(owner);
    assert.equal(
      (await request(app).get(shares(owner.childId)).set(auth(stranger.token))).status,
      404
    );
  });

  it("will not let one parent stop another's link", async () => {
    const owner = await parentWithChild();
    const stranger = await parentWithChild();
    const created = await make(owner);
    const id = created.body.data.share.id;
    assert.equal(
      (
        await request(app)
          .delete(shares(owner.childId, `/${id}`))
          .set(auth(stranger.token))
      ).status,
      404
    );
    assert.equal(
      (
        await request(app)
          .delete(shares(stranger.childId, `/${id}`))
          .set(auth(stranger.token))
      ).status,
      404,
      "the owner's link id under your own child does not work either"
    );
    assert.equal((await open(tokenOf(created.body.data.url))).status, 200);
  });

  it("stopping a link twice is harmless", async () => {
    const p = await parentWithChild();
    const created = await make(p);
    const id = created.body.data.share.id;
    assert.equal(
      (
        await request(app)
          .delete(shares(p.childId, `/${id}`))
          .set(auth(p.token))
      ).status,
      200
    );
    assert.equal(
      (
        await request(app)
          .delete(shares(p.childId, `/${id}`))
          .set(auth(p.token))
      ).status,
      200
    );
  });
});

describe("the limits", () => {
  const limited = (max: number, kind: "ip" | "token") => {
    const server = express();
    const limiter =
      kind === "ip"
        ? createPublicShareRateLimiter(new MemoryStore(), max)
        : createPublicShareTokenRateLimiter(new MemoryStore(), max);
    server.get("/api/share/:token", limiter, (_req: unknown, res: { json(b: unknown): void }) =>
      res.json({ ok: true })
    );
    return server;
  };

  it("stops one source after its allowance, whatever tokens it tries", async () => {
    const server = limited(3, "ip");
    const statuses = [];
    for (let i = 0; i < 5; i += 1)
      statuses.push((await request(server).get(`/api/share/t${i}`)).status);
    assert.deepEqual(statuses, [200, 200, 200, 429, 429]);
  });

  it("stops one link being opened in a loop, from anywhere, without touching other links", async () => {
    const server = limited(2, "token");
    const hit = (token: string) => request(server).get(`/api/share/${token}`);
    assert.equal((await hit("busy")).status, 200);
    assert.equal((await hit("busy")).status, 200);
    assert.equal((await hit("busy")).status, 429);
    assert.equal((await hit("quiet")).status, 200);
  });

  it("is applied to the real public routes", async () => {
    const {
      publicShareRateLimiter,
      publicShareTokenRateLimiter,
    } = require("../middleware/rateLimit");
    assert.equal(typeof publicShareRateLimiter, "function");
    assert.equal(typeof publicShareTokenRateLimiter, "function");
    const stack = (
      require("../client/routes/childShareRoutes").default.stack as Array<{
        route?: { path: string; stack: Array<{ handle: unknown }> };
      }>
    ).filter((layer) => layer.route);
    for (const layer of stack) {
      const handles = layer.route!.stack.map((s) => s.handle);
      assert.ok(handles.includes(publicShareRateLimiter), `${layer.route!.path} has the IP limit`);
      assert.ok(
        handles.includes(publicShareTokenRateLimiter),
        `${layer.route!.path} has the link limit`
      );
    }
  });
});

describe("the link is kept out of logs", () => {
  it("hides the token from every URL the loggers print, whatever follows it", () => {
    const token = "A".repeat(43);
    assert.equal(redactPath(`/api/share/${token}`), "/api/share/:token");
    assert.equal(redactPath(`/api/share/${token}?x=1`), "/api/share/:token?x=1");
    assert.equal(
      redactPath(`/api/share/${token}/videos/abc/playback`),
      "/api/share/:token/videos/abc/playback"
    );
  });

  it("leaves every other URL as it was", () => {
    for (const url of ["/api/child-history/abc", "/api/shares", "/share/abc", "/api/health", ""]) {
      assert.equal(redactPath(url), url);
    }
  });

  it("never lets a real token reach anything written during real requests", async () => {
    const p = await parentWithChild();
    const created = await make(p);
    const token = tokenOf(created.body.data.url);

    const lines: string[] = [];
    const capture = (...args: unknown[]) => {
      lines.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
    };
    const original = {
      write: process.stdout.write.bind(process.stdout),
      errWrite: process.stderr.write.bind(process.stderr),
      log: console.log,
      info: console.info,
      warn: console.warn,
      error: console.error,
    };
    process.stdout.write = ((chunk: unknown) => (capture(String(chunk)), true)) as never;
    process.stderr.write = ((chunk: unknown) => (capture(String(chunk)), true)) as never;
    console.log = console.info = console.warn = console.error = capture;
    try {
      await open(token); // 200
      await open("b".repeat(43)); // 404
      await ChildShare.collection.updateOne(
        {},
        { $set: { expiresAt: new Date(Date.now() - 1000) } }
      );
      await open(token); // 410
    } finally {
      process.stdout.write = original.write as never;
      process.stderr.write = original.errWrite as never;
      console.log = original.log;
      console.info = original.info;
      console.warn = original.warn;
      console.error = original.error;
    }

    const output = lines.join("\n");
    assert.ok(output.includes("/api/share/"), "the request logger did write something to inspect");
    assert.ok(!output.includes(token), "the real token appears in the logs");
    assert.ok(!output.includes("b".repeat(43)), "a guessed token appears in the logs");
  });
});
