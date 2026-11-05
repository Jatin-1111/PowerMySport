// Photos of the certificate behind an entry: who may upload, what is checked before a photo counts,
// who may see it, and that every way of deleting an entry, a child or an account removes the file
// too. Storage is replaced by a recorder, so nothing leaves the test; what is checked is what the
// server asked storage to do.
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
const { ChildEvent } = require("../client/models/ChildEvent");
const { removeEventPhotos } = require("../client/services/ChildEventPhotoCleanup");
const { s3Service } = require("../shared/services/S3Service");
const { CHILD_HISTORY_LIMITS } = require("@powermysport/shared-types");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();
const MB = 1024 * 1024;
const { photoMaxBytes, photosPerChild } = CHILD_HISTORY_LIMITS;

let mongod: { getUri(): string; stop(): Promise<void> };

/** What the server asked storage to do, and what storage should answer. */
const calls: Record<string, unknown[][]> = {};
let stored: { sizeBytes: number; contentType: string } | null = null;
let failDelete = false;

const real = {
  upload: s3Service.generateChildPhotoUploadUrl,
  head: s3Service.headChildPhoto,
  view: s3Service.generateChildPhotoViewUrl,
  del: s3Service.deleteFiles,
};

const made = (name: string): unknown[][] => calls[name] ?? [];
const record = (name: string, args: unknown[]) => {
  (calls[name] ??= []).push(args);
};

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await ChildEvent.init();

  s3Service.generateChildPhotoUploadUrl = async (...args: unknown[]) => {
    record("upload", args);
    return `https://storage.example/put?size=${args[2]}&sig=abc`;
  };
  s3Service.headChildPhoto = async (...args: unknown[]) => {
    record("head", args);
    return stored;
  };
  s3Service.generateChildPhotoViewUrl = async (...args: unknown[]) => {
    record("view", args);
    return "https://storage.example/view?sig=abc";
  };
  s3Service.deleteFiles = async (...args: unknown[]) => {
    record("delete", args);
    if (failDelete) throw new Error("storage said no");
  };
});

after(async () => {
  Object.assign(s3Service, {
    generateChildPhotoUploadUrl: real.upload,
    headChildPhoto: real.head,
    generateChildPhotoViewUrl: real.view,
    deleteFiles: real.del,
  });
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  for (const key of Object.keys(calls)) delete calls[key];
  stored = null;
  failDelete = false;
  for (const model of [ChildEvent, Player, User]) await model.deleteMany({});
});

let counter = 0;

const parentWithChild = async () => {
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
  await Player.collection.insertOne({ _id: childId, userId, name: "Anaya", age: 14 });
  const token = generateToken({
    id: userId.toString(),
    email: `${userId}@example.test`,
    role: "Parent",
  });
  return { userId: userId.toString(), childId: childId.toString(), token };
};

type Parent = Awaited<ReturnType<typeof parentWithChild>>;

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const entryFor = async (p: Parent, over: Record<string, unknown> = {}) =>
  ChildEvent.create({
    childId: p.childId,
    userId: p.userId,
    kind: "award",
    title: "State under 14 champion",
    occurredOn: new Date("2026-03-01T00:00:00.000Z"),
    datePrecision: "month",
    ...over,
  });

const url = (p: Parent, eventId: unknown, rest = "") =>
  `/api/child-history/${p.childId}/events/${eventId}/photo${rest}`;

const jpeg = (over: Record<string, unknown> = {}) => ({
  contentType: "image/jpeg",
  sizeBytes: 3 * MB,
  ...over,
});

const start = (p: Parent, eventId: unknown, body: Record<string, unknown> = jpeg()) =>
  request(app).post(url(p, eventId)).set(auth(p.token)).send(body);

/** An entry whose photo has been started and, optionally, finished. */
const withPhoto = async (p: Parent, status: "uploading" | "ready" = "ready") => {
  const event = await entryFor(p);
  const res = await start(p, event._id);
  assert.equal(res.status, 201);
  stored = { sizeBytes: 3 * MB, contentType: "image/jpeg" };
  if (status === "ready") {
    const done = await request(app)
      .post(url(p, event._id, "/complete"))
      .set(auth(p.token));
    assert.equal(done.status, 200);
  }
  return event;
};

describe("starting a photo upload", () => {
  it("hands back one signed link for exactly the declared size and type, and records the key", async () => {
    const p = await parentWithChild();
    const event = await entryFor(p);

    const res = await start(p, event._id);

    assert.equal(res.status, 201);
    assert.equal(res.body.data.upload.method, "PUT");
    assert.equal(res.body.data.upload.headers["Content-Type"], "image/jpeg");
    assert.match(res.body.data.upload.url, /^https:\/\/storage\.example\/put/);
    assert.equal(res.headers["cache-control"], "no-store");

    const [key, contentType, sizeBytes] = made("upload")[0] as [string, string, number];
    assert.match(key, new RegExp(`^child-photos/${p.childId}/${event._id}-[0-9a-f-]{36}\\.jpg$`));
    assert.equal(contentType, "image/jpeg");
    assert.equal(sizeBytes, 3 * MB);

    // The key is stored from the start, so a delete can always find the object.
    const row = await ChildEvent.findById(event._id).lean();
    assert.equal(row.photo.status, "uploading");
    assert.equal(row.photo.key, key);
    assert.equal(row.photo.declaredBytes, 3 * MB);
  });

  it("refuses a type that is not a photo, an empty or oversize file, and unknown fields", async () => {
    const p = await parentWithChild();
    const event = await entryFor(p);

    for (const body of [
      jpeg({ contentType: "application/pdf" }),
      jpeg({ contentType: "image/svg+xml" }),
      jpeg({ contentType: "text/html" }),
      jpeg({ sizeBytes: 0 }),
      jpeg({ sizeBytes: photoMaxBytes + 1 }),
      jpeg({ sizeBytes: 1.5 }),
      { ...jpeg(), key: "child-photos/other/abc.jpg" },
      { ...jpeg(), childId: oid().toString() },
      {},
    ]) {
      const res = await start(p, event._id, body);
      assert.equal(res.status, 400, JSON.stringify(body));
    }
    assert.equal(made("upload").length, 0);
    assert.equal((await ChildEvent.findById(event._id).lean()).photo, undefined);
  });

  it("accepts the largest allowed photo and each allowed type", async () => {
    const p = await parentWithChild();
    for (const [contentType, ext] of [
      ["image/jpeg", "jpg"],
      ["image/png", "png"],
      ["image/webp", "webp"],
    ]) {
      const event = await entryFor(p, { title: `Entry ${ext}` });
      const res = await start(p, event._id, { contentType, sizeBytes: photoMaxBytes });
      assert.equal(res.status, 201, contentType);
      const key = (made("upload").at(-1) as [string])[0];
      assert.ok(key.endsWith(`.${ext}`), key);
    }
  });

  it("needs a signed-in parent, and an entry that belongs to this child", async () => {
    const p = await parentWithChild();
    const event = await entryFor(p);

    assert.equal((await request(app).post(url(p, event._id)).send(jpeg())).status, 401);

    const other = await parentWithChild();
    // Another parent, naming my child and my entry.
    assert.equal((await start({ ...p, token: other.token }, event._id)).status, 404);
    // Another parent's child with my entry id.
    assert.equal((await start({ ...other }, event._id)).status, 404);
    // Not an id at all, and an id that is nobody's.
    assert.equal((await start(p, "not-an-id")).status, 404);
    assert.equal((await start(p, oid())).status, 404);
    assert.equal(made("upload").length, 0);
  });

  it("allows one photo per entry: a finished photo must be removed first", async () => {
    const p = await parentWithChild();
    const event = await withPhoto(p, "ready");
    calls.upload = [];

    const res = await start(p, event._id);

    assert.equal(res.status, 409);
    assert.equal(made("upload").length, 0);
  });

  it("replaces an upload that never finished, removing the old object first", async () => {
    const p = await parentWithChild();
    const event = await entryFor(p);
    await start(p, event._id);
    const oldKey = (await ChildEvent.findById(event._id).lean()).photo.key;

    const res = await start(p, event._id, { contentType: "image/png", sizeBytes: 2 * MB });

    assert.equal(res.status, 201);
    assert.deepEqual(made("delete")[0], [[oldKey], "childVideos"]);
    const row = await ChildEvent.findById(event._id).lean();
    assert.notEqual(row.photo.key, oldKey);
    assert.equal(row.photo.contentType, "image/png");
  });

  it("stops at the per-child ceiling", async () => {
    const p = await parentWithChild();
    const rows = Array.from({ length: photosPerChild }, (_, i) => ({
      childId: p.childId,
      userId: p.userId,
      kind: "award",
      title: `Award ${i}`,
      occurredOn: new Date("2026-03-01T00:00:00.000Z"),
      datePrecision: "month",
      photo: {
        status: "ready",
        key: `child-photos/${p.childId}/x${i}.jpg`,
        contentType: "image/jpeg",
        declaredBytes: MB,
        sizeBytes: MB,
        startedAt: new Date(),
      },
    }));
    await ChildEvent.insertMany(rows);
    const event = await entryFor(p, { title: "One too many" });

    const res = await start(p, event._id);

    assert.equal(res.status, 400);
    assert.match(res.body.message, /up to 60 photos/);
    assert.equal(made("upload").length, 0);
  });
});

describe("finishing an upload", () => {
  it("counts the photo only after the stored object matches what was agreed", async () => {
    const p = await parentWithChild();
    const event = await withPhoto(p, "ready");

    const row = await ChildEvent.findById(event._id).lean();
    assert.equal(row.photo.status, "ready");
    assert.equal(row.photo.sizeBytes, 3 * MB);
    assert.equal(made("head").length, 1);

    const page = await request(app).get(`/api/child-history/${p.childId}`).set(auth(p.token));
    const shown = page.body.data.timeline.find((r: { id: string }) => r.id === String(event._id));
    assert.equal(shown.hasPhoto, true);
    // The storage key is never sent to the phone.
    assert.ok(!JSON.stringify(page.body).includes("child-photos/"));
  });

  it("is safe to call twice", async () => {
    const p = await parentWithChild();
    const event = await withPhoto(p, "ready");
    calls.head = [];

    const again = await request(app)
      .post(url(p, event._id, "/complete"))
      .set(auth(p.token));

    assert.equal(again.status, 200);
    assert.equal(made("head").length, 0);
  });

  it("removes a photo whose size is not the size agreed", async () => {
    const p = await parentWithChild();
    const event = await entryFor(p);
    await start(p, event._id);
    const key = (await ChildEvent.findById(event._id).lean()).photo.key;
    stored = { sizeBytes: 3 * MB + 1, contentType: "image/jpeg" };

    const res = await request(app)
      .post(url(p, event._id, "/complete"))
      .set(auth(p.token));

    assert.equal(res.status, 400);
    assert.deepEqual(made("delete")[0], [[key], "childVideos"]);
    assert.equal((await ChildEvent.findById(event._id).lean()).photo, undefined);
  });

  it("removes a photo whose type is not the type agreed", async () => {
    const p = await parentWithChild();
    const event = await entryFor(p);
    await start(p, event._id);
    stored = { sizeBytes: 3 * MB, contentType: "text/html" };

    const res = await request(app)
      .post(url(p, event._id, "/complete"))
      .set(auth(p.token));

    assert.equal(res.status, 400);
    assert.equal((await ChildEvent.findById(event._id).lean()).photo, undefined);
  });

  it("says so when nothing arrived, and keeps the upload open to retry", async () => {
    const p = await parentWithChild();
    const event = await entryFor(p);
    await start(p, event._id);
    stored = null;

    const res = await request(app)
      .post(url(p, event._id, "/complete"))
      .set(auth(p.token));

    assert.equal(res.status, 400);
    assert.equal((await ChildEvent.findById(event._id).lean()).photo.status, "uploading");
  });

  it("refuses to finish an upload that was never started, and one that is not yours", async () => {
    const p = await parentWithChild();
    const event = await entryFor(p);
    assert.equal(
      (
        await request(app)
          .post(url(p, event._id, "/complete"))
          .set(auth(p.token))
      ).status,
      409
    );

    await start(p, event._id);
    stored = { sizeBytes: 3 * MB, contentType: "image/jpeg" };
    const other = await parentWithChild();
    const res = await request(app)
      .post(url(p, event._id, "/complete"))
      .set(auth(other.token));
    assert.equal(res.status, 404);
    assert.equal((await ChildEvent.findById(event._id).lean()).photo.status, "uploading");
  });
});

describe("seeing a photo", () => {
  it("gives the parent a short-lived link that no cache may keep", async () => {
    const p = await parentWithChild();
    const event = await withPhoto(p, "ready");

    const res = await request(app).get(url(p, event._id)).set(auth(p.token));

    assert.equal(res.status, 200);
    assert.equal(res.body.data.url, "https://storage.example/view?sig=abc");
    assert.equal(res.body.data.expiresInSeconds, 600);
    assert.equal(res.headers["cache-control"], "no-store");
    const [, contentType, expires] = made("view")[0] as [string, string, number];
    assert.equal(contentType, "image/jpeg");
    assert.equal(expires, 600);
  });

  it("is for the owner only, and only once the photo is finished", async () => {
    const p = await parentWithChild();
    const event = await withPhoto(p, "ready");
    const other = await parentWithChild();

    assert.equal((await request(app).get(url(p, event._id))).status, 401);
    assert.equal((await request(app).get(url(p, event._id)).set(auth(other.token))).status, 404);

    const pending = await withPhoto(p, "uploading");
    assert.equal((await request(app).get(url(p, pending._id)).set(auth(p.token))).status, 404);
    const bare = await entryFor(p, { title: "No photo" });
    assert.equal((await request(app).get(url(p, bare._id)).set(auth(p.token))).status, 404);
  });
});

describe("removing a photo", () => {
  it("deletes the file and clears the entry, and is quiet when there is nothing to remove", async () => {
    const p = await parentWithChild();
    const event = await withPhoto(p, "ready");
    const key = (await ChildEvent.findById(event._id).lean()).photo.key;
    calls.delete = [];

    const res = await request(app).delete(url(p, event._id)).set(auth(p.token));

    assert.equal(res.status, 200);
    assert.deepEqual(made("delete")[0], [[key], "childVideos"]);
    assert.equal((await ChildEvent.findById(event._id).lean()).photo, undefined);

    const again = await request(app).delete(url(p, event._id)).set(auth(p.token));
    assert.equal(again.status, 200);
    assert.equal(made("delete").length, 1);
  });

  it("keeps the photo on the entry when storage refuses, so it can be retried", async () => {
    const p = await parentWithChild();
    const event = await withPhoto(p, "ready");
    failDelete = true;

    const res = await request(app).delete(url(p, event._id)).set(auth(p.token));

    assert.equal(res.status, 502);
    assert.equal((await ChildEvent.findById(event._id).lean()).photo.status, "ready");
  });

  it("is refused for another parent", async () => {
    const p = await parentWithChild();
    const event = await withPhoto(p, "ready");
    const other = await parentWithChild();

    const res = await request(app).delete(url(p, event._id)).set(auth(other.token));

    assert.equal(res.status, 404);
    assert.equal((await ChildEvent.findById(event._id).lean()).photo.status, "ready");
  });
});

describe("deleting what a photo belongs to", () => {
  it("deleting the entry removes the file first", async () => {
    const p = await parentWithChild();
    const event = await withPhoto(p, "ready");
    const key = (await ChildEvent.findById(event._id).lean()).photo.key;
    calls.delete = [];

    const res = await request(app)
      .delete(`/api/child-history/${p.childId}/events/${event._id}`)
      .set(auth(p.token));

    assert.equal(res.status, 200);
    assert.deepEqual(made("delete")[0], [[key], "childVideos"]);
    assert.equal(await ChildEvent.countDocuments({ _id: event._id }), 0);
  });

  it("deleting an entry whose photo is still uploading removes that object too", async () => {
    const p = await parentWithChild();
    const event = await withPhoto(p, "uploading");
    const key = (await ChildEvent.findById(event._id).lean()).photo.key;
    calls.delete = [];

    await request(app)
      .delete(`/api/child-history/${p.childId}/events/${event._id}`)
      .set(auth(p.token));

    assert.deepEqual(made("delete")[0], [[key], "childVideos"]);
  });

  it("deleting an entry keeps it when storage refuses, so the file is never orphaned", async () => {
    const p = await parentWithChild();
    const event = await withPhoto(p, "ready");
    failDelete = true;

    const res = await request(app)
      .delete(`/api/child-history/${p.childId}/events/${event._id}`)
      .set(auth(p.token));

    assert.equal(res.status, 502);
    assert.equal(await ChildEvent.countDocuments({ _id: event._id }), 1);
  });

  it("an entry with no photo deletes without touching storage", async () => {
    const p = await parentWithChild();
    const event = await entryFor(p);

    const res = await request(app)
      .delete(`/api/child-history/${p.childId}/events/${event._id}`)
      .set(auth(p.token));

    assert.equal(res.status, 200);
    assert.equal(made("delete").length, 0);
  });

  it("the shared cleanup finds every photo of a child or of an account, and no one else's", async () => {
    const a = await parentWithChild();
    const b = await parentWithChild();
    const a1 = await withPhoto(a, "ready");
    const a2 = await withPhoto(a, "uploading");
    const b1 = await withPhoto(b, "ready");
    const keyOf = async (e: { _id: unknown }) =>
      (await ChildEvent.findById(e._id).lean()).photo.key;
    const [ka1, ka2, kb1] = [await keyOf(a1), await keyOf(a2), await keyOf(b1)];
    calls.delete = [];

    assert.equal(await removeEventPhotos({ childId: a.childId }), 2);
    const [deleted] = made("delete")[0] as [string[]];
    assert.deepEqual([...deleted].sort(), [ka1, ka2].sort());

    calls.delete = [];
    assert.equal(await removeEventPhotos({ userId: b.userId }), 1);
    assert.deepEqual(made("delete")[0], [[kb1], "childVideos"]);

    calls.delete = [];
    assert.equal(await removeEventPhotos({ childId: oid().toString() }), 0);
    assert.equal(made("delete").length, 0);
  });
});
