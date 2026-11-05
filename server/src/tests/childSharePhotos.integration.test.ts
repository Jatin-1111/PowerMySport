// Certificate photos on a shared profile: a photo reaches a coach only when the parent ticked
// "certificates" AND chose that entry's photo for this link, and every later check (stopped link,
// removed photo, deleted entry) takes effect at once. Requests go through the real `app`; storage is
// replaced by a recorder, so nothing leaves the test.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";
process.env.REDIS_ENABLED = "false";
process.env.FRONTEND_URL = "https://powermysport.test";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const { app } = require("../app");
const { generateToken } = require("../utils/jwt");
const { User } = require("../client/models/User");
const { Player } = require("../client/models/Player");
const { ChildEvent } = require("../client/models/ChildEvent");
const { ChildShare } = require("../client/models/ChildShare");
const { s3Service } = require("../shared/services/S3Service");
const { redactPath } = require("../utils/redactPath");
const { SHARE_ROW_FIELDS } = require("../client/services/ChildShareService/serialize");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();

let mongod: { getUri(): string; stop(): Promise<void> };
const viewed: unknown[][] = [];
const removed: unknown[][] = [];
const real = {
  view: s3Service.generateChildPhotoViewUrl,
  del: s3Service.deleteFiles,
};

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([ChildShare.init(), ChildEvent.init()]);
  s3Service.generateChildPhotoViewUrl = async (...args: unknown[]) => {
    viewed.push(args);
    return "https://storage.example/photo?sig=abc";
  };
  s3Service.deleteFiles = async (...args: unknown[]) => {
    removed.push(args);
  };
});

after(async () => {
  Object.assign(s3Service, { generateChildPhotoViewUrl: real.view, deleteFiles: real.del });
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  viewed.length = 0;
  removed.length = 0;
  for (const model of [ChildShare, ChildEvent, Player, User]) await model.deleteMany({});
});

let counter = 0;

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
    age: 15,
    location: "Maharashtra",
    sportsFocus: ["Tennis"],
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

type Parent = Awaited<ReturnType<typeof parentWithChild>>;

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const shares = (childId: string, rest = "") => `/api/child-history/${childId}/shares${rest}`;

/** An entry, optionally with a photo in the given state. */
const entry = (
  p: Parent,
  over: Record<string, unknown> = {},
  photo: "ready" | "uploading" | null = "ready"
) => {
  const _id = oid();
  return ChildEvent.create({
    _id,
    childId: p._childId,
    userId: p._userId,
    kind: "award",
    title: "State champion",
    occurredOn: new Date("2026-03-01T00:00:00.000Z"),
    datePrecision: "month",
    ...(photo
      ? {
          photo: {
            status: photo,
            key: `child-photos/${p.childId}/${_id}-secret-object-name.jpg`,
            contentType: "image/jpeg",
            declaredBytes: 1000,
            ...(photo === "ready" ? { sizeBytes: 1000 } : {}),
            startedAt: new Date(),
          },
        }
      : {}),
    ...over,
  });
};

const make = (p: Parent, body: Record<string, unknown> = {}) =>
  request(app)
    .post(shares(p.childId))
    .set(auth(p.token))
    .send({
      recipientLabel: "Coach Miller, State University",
      sections: ["results", "awards", "certificates"],
      consent: true,
      ...body,
    });

const tokenOf = (url: string): string => url.split("/share/")[1] as string;
const open = (token: string) => request(app).get(`/api/share/${token}`);
const photoUrl = (token: string, entryId: unknown) =>
  request(app).get(`/api/share/${token}/photos/${entryId}`);

/** A parent whose child has two entries with a finished photo, one of each section ticked below. */
const setup = async () => {
  const p = await parentWithChild();
  const award = await entry(p, { kind: "award", title: "State champion" });
  const result = await entry(p, {
    kind: "tournament_result",
    title: "Pune Open",
    occurredOn: new Date("2026-02-01T00:00:00.000Z"),
  });
  const coaching = await entry(
    p,
    {
      kind: "coaching_period",
      title: "Ace Academy",
      occurredOn: new Date("2022-01-01T00:00:00.000Z"),
    },
    "ready"
  );
  return { p, award, result, coaching };
};

describe("choosing photos for a link", () => {
  it("shares only the photos the parent chose, and names them by entry, never by file", async () => {
    const { p, award, result } = await setup();

    const res = await make(p, { photoEventIds: [award._id.toString()] });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.share.photoCount, 1);
    assert.ok(res.body.data.share.sections.includes("certificates"));
    const stored = await ChildShare.findOne({}).lean();
    assert.deepEqual(stored.photoEventIds.map(String), [award._id.toString()]);

    const seen = await open(tokenOf(res.body.data.url));
    assert.equal(seen.status, 200);
    const rows = seen.body.data.timeline;
    const withPhoto = rows.filter((r: { photoId?: string }) => r.photoId);
    assert.deepEqual(
      withPhoto.map((r: { title: string; photoId: string }) => [r.title, r.photoId]),
      [["State champion", award._id.toString()]]
    );
    // The other entry has a photo too, but was not chosen: nothing about it is shown.
    const other = rows.find((r: { title: string }) => r.title === "Pune Open");
    assert.ok(other && !("photoId" in other));
    assert.ok(!JSON.stringify(seen.body).includes("child-photos/"), "no storage key is sent");
    assert.ok(!JSON.stringify(seen.body).includes("secret-object-name"));
    assert.ok(!JSON.stringify(seen.body).includes(result._id.toString()));
    for (const row of rows) {
      for (const key of Object.keys(row)) assert.ok(SHARE_ROW_FIELDS.includes(key), key);
    }
  });

  it("shows no photo on a link that ticked every section but chose none, and drops the empty section", async () => {
    const { p } = await setup();

    const res = await make(p, {
      sections: ["results", "awards", "coaching", "certificates"],
    });

    assert.equal(res.status, 201);
    assert.equal(res.body.data.share.photoCount, 0);
    assert.ok(!res.body.data.share.sections.includes("certificates"));
    const seen = await open(tokenOf(res.body.data.url));
    assert.ok(seen.body.data.timeline.every((r: { photoId?: string }) => !r.photoId));
    assert.ok(!seen.body.data.sections.includes("certificates"));
  });

  it("refuses a link that was only certificates with none chosen", async () => {
    const { p } = await setup();
    const res = await make(p, { sections: ["certificates"] });
    assert.equal(res.status, 400);
    assert.equal(await ChildShare.countDocuments({}), 0);
  });

  it("refuses photos named without ticking certificates", async () => {
    const { p, award } = await setup();
    const res = await make(p, {
      sections: ["results", "awards"],
      photoEventIds: [award._id.toString()],
    });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /Tick certificates/);
  });

  it("refuses a photo that is not this child's, not finished, or whose entry the link does not show", async () => {
    const { p, award, coaching } = await setup();
    const other = await parentWithChild();
    const theirs = await entry(other);
    const pending = await entry(p, { title: "Still uploading" }, "uploading");
    const bare = await entry(p, { title: "No photo" }, null);

    for (const id of [theirs._id, pending._id, bare._id, oid()]) {
      const res = await make(p, { photoEventIds: [id.toString()] });
      assert.equal(res.status, 400, String(id));
      assert.match(res.body.message, /not available to share/);
    }

    // The coaching entry has a finished photo, but the link does not show coaching.
    const hidden = await make(p, {
      sections: ["results", "awards", "certificates"],
      photoEventIds: [coaching._id.toString()],
    });
    assert.equal(hidden.status, 400);

    // Naming one eligible photo and one that is not refuses the whole link.
    const mixed = await make(p, { photoEventIds: [award._id.toString(), theirs._id.toString()] });
    assert.equal(mixed.status, 400);
    assert.equal(await ChildShare.countDocuments({}), 0);
  });

  it("refuses ids that are not ids, and fields the body should not carry", async () => {
    const { p } = await setup();
    for (const body of [
      { photoEventIds: ["abc"] },
      { photoEventIds: "everything" },
      { photoEventIds: [{ $ne: null }] },
      { photoKeys: ["child-photos/x.jpg"] },
    ]) {
      assert.equal((await make(p, body)).status, 400, JSON.stringify(body));
    }
  });

  it("is only for the parent's own child", async () => {
    const { p, award } = await setup();
    const stranger = await parentWithChild();
    const res = await make(
      { ...p, token: stranger.token },
      { photoEventIds: [award._id.toString()] }
    );
    assert.equal(res.status, 404);
  });

  it("counts photos in the list, and the preview shows exactly what the link then returns", async () => {
    const { p, award } = await setup();
    const body = {
      sections: ["results", "awards", "certificates"],
      photoEventIds: [award._id.toString()],
    };
    const preview = await request(app)
      .post(shares(p.childId, "/preview"))
      .set(auth(p.token))
      .send(body);
    assert.equal(preview.status, 200);
    assert.equal(await ChildShare.countDocuments({}), 0, "a preview creates nothing");

    const created = await make(p, body);
    const seen = await open(tokenOf(created.body.data.url));
    const strip = (view: Record<string, unknown>) => ({ ...view, sharedAt: 0, expiresAt: 0 });
    assert.deepEqual(strip(seen.body.data), strip(preview.body.data));

    const list = await request(app).get(shares(p.childId)).set(auth(p.token));
    assert.equal(list.body.data[0].photoCount, 1);
  });

  it("leaves photos out of the CV, which is text only", async () => {
    const { p, award } = await setup();
    const created = await make(p, { photoEventIds: [award._id.toString()] });
    const res = await request(app)
      .get(`/api/share/${tokenOf(created.body.data.url)}/cv.pdf`)
      .buffer(true)
      .parse((r: NodeJS.ReadableStream, cb: (e: Error | null, b: Buffer) => void) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => cb(null, Buffer.concat(chunks)));
      });
    assert.equal(res.status, 200);
    assert.equal(res.headers["content-type"], "application/pdf");
    assert.equal(viewed.length, 0, "no photo was fetched to draw the CV");
  });
});

describe("a coach opening a chosen photo", () => {
  it("gets a short-lived link that no cache may keep, built from the stored type", async () => {
    const { p, award } = await setup();
    const token = tokenOf((await make(p, { photoEventIds: [award._id.toString()] })).body.data.url);

    const res = await photoUrl(token, award._id);

    assert.equal(res.status, 200);
    assert.equal(res.body.data.url, "https://storage.example/photo?sig=abc");
    assert.equal(res.body.data.expiresInSeconds, 600);
    assert.equal(res.headers["cache-control"], "no-store");
    assert.equal(res.headers["referrer-policy"], "no-referrer");
    const [key, contentType, expires] = viewed[0] as [string, string, number];
    assert.match(key, /^child-photos\//);
    assert.equal(contentType, "image/jpeg");
    assert.equal(expires, 600);
  });

  it("refuses a photo that was not chosen for this link, even one that exists", async () => {
    const { p, award, result } = await setup();
    const token = tokenOf((await make(p, { photoEventIds: [award._id.toString()] })).body.data.url);

    assert.equal((await photoUrl(token, result._id)).status, 404);
    assert.equal((await photoUrl(token, oid())).status, 404);
    assert.equal((await photoUrl(token, "not-an-id")).status, 404);
    assert.equal(viewed.length, 0);
  });

  it("refuses every photo on a link that did not tick certificates", async () => {
    const { p, award } = await setup();
    const token = tokenOf((await make(p, { sections: ["results", "awards"] })).body.data.url);
    assert.equal((await photoUrl(token, award._id)).status, 404);
  });

  it("does not take a photo from another child through someone else's link", async () => {
    const { p, award } = await setup();
    const other = await setup();
    const token = tokenOf((await make(p, { photoEventIds: [award._id.toString()] })).body.data.url);
    assert.equal((await photoUrl(token, other.award._id)).status, 404);
  });

  it("stops at once when the link is stopped, over, or never existed", async () => {
    const { p, award } = await setup();
    const created = await make(p, { photoEventIds: [award._id.toString()] });
    const token = tokenOf(created.body.data.url);
    assert.equal((await photoUrl(token, award._id)).status, 200);

    await request(app)
      .delete(shares(p.childId, `/${created.body.data.share.id}`))
      .set(auth(p.token));
    assert.equal((await photoUrl(token, award._id)).status, 410);

    const again = tokenOf((await make(p, { photoEventIds: [award._id.toString()] })).body.data.url);
    await ChildShare.collection.updateMany(
      {},
      { $set: { expiresAt: new Date(Date.now() - 1000) } }
    );
    assert.equal((await photoUrl(again, award._id)).status, 410);

    assert.equal((await photoUrl("a".repeat(43), award._id)).status, 404);
  });

  it("stops showing a photo the parent removes, from the link and from the page", async () => {
    const { p, award } = await setup();
    const token = tokenOf((await make(p, { photoEventIds: [award._id.toString()] })).body.data.url);
    assert.equal((await photoUrl(token, award._id)).status, 200);

    const gone = await request(app)
      .delete(`/api/child-history/${p.childId}/events/${award._id}/photo`)
      .set(auth(p.token));
    assert.equal(gone.status, 200);

    assert.equal((await photoUrl(token, award._id)).status, 404);
    const stored = await ChildShare.findOne({}).lean();
    assert.deepEqual(stored.photoEventIds, [], "the link no longer lists it");
    const seen = await open(token);
    assert.ok(seen.body.data.timeline.every((r: { photoId?: string }) => !r.photoId));
  });

  it("stops showing the photo of an entry the parent deletes", async () => {
    const { p, award } = await setup();
    const token = tokenOf((await make(p, { photoEventIds: [award._id.toString()] })).body.data.url);

    const del = await request(app)
      .delete(`/api/child-history/${p.childId}/events/${award._id}`)
      .set(auth(p.token));
    assert.equal(del.status, 200);

    assert.equal((await photoUrl(token, award._id)).status, 404);
    assert.deepEqual((await ChildShare.findOne({}).lean()).photoEventIds, []);
  });

  it("never lists a photo that was replaced by one still uploading", async () => {
    const { p, award } = await setup();
    const token = tokenOf((await make(p, { photoEventIds: [award._id.toString()] })).body.data.url);
    // Remove, then a new upload starts but has not finished.
    await request(app)
      .delete(`/api/child-history/${p.childId}/events/${award._id}/photo`)
      .set(auth(p.token));
    await ChildEvent.updateOne(
      { _id: award._id },
      {
        $set: {
          photo: {
            status: "uploading",
            key: `child-photos/${p.childId}/${award._id}-new.jpg`,
            contentType: "image/jpeg",
            declaredBytes: 10,
            startedAt: new Date(),
          },
        },
      }
    );
    assert.equal((await photoUrl(token, award._id)).status, 404);
  });
});

describe("what the logs keep", () => {
  it("replaces the link's token in the photo path", () => {
    const token = "a".repeat(43);
    const logged = redactPath(`/api/share/${token}/photos/${oid()}`);
    assert.ok(!logged.includes(token));
    assert.match(logged, /^\/api\/share\/:token\/photos\//);
  });
});
