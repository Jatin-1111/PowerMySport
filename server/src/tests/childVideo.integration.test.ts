// Videos of a child: who may upload, how much, what is checked before a clip counts, and how it is
// played, deleted and cleaned up. Storage is replaced by a recorder, so nothing leaves the test;
// what is checked is what the server asked storage to do.
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
const { ChildVideo } = require("../client/models/ChildVideo");
const { ChildShare } = require("../client/models/ChildShare");
const { ChildVideoService } = require("../client/services/ChildVideoService");
const { s3Service } = require("../shared/services/S3Service");
const { CHILD_HISTORY_LIMITS } = require("@powermysport/shared-types");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();
const MB = 1024 * 1024;
const { videoPartBytes, videoMaxBytes, videosPerChild, videoBytesPerDay } = CHILD_HISTORY_LIMITS;

let mongod: { getUri(): string; stop(): Promise<void> };

/** What the server asked storage to do, and what storage should answer. */
const calls: Record<string, unknown[][]> = {};
let storedSize: number | null = 0;
let failComplete = false;

const real = {
  create: s3Service.createChildVideoUpload,
  presign: s3Service.presignChildVideoPart,
  complete: s3Service.completeChildVideoUpload,
  abort: s3Service.abortChildVideoUpload,
  head: s3Service.headChildVideo,
  play: s3Service.generateChildVideoPlaybackUrl,
  del: s3Service.deleteFiles,
};

const made = (name: string): unknown[][] => calls[name] ?? [];
const record = (name: string, args: unknown[]) => {
  (calls[name] ??= []).push(args);
};

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all([ChildVideo.init(), ChildShare.init()]);

  s3Service.createChildVideoUpload = async (...args: unknown[]) => {
    record("create", args);
    return "upload-1";
  };
  s3Service.presignChildVideoPart = async (...args: unknown[]) => {
    record("presign", args);
    return `https://storage.example/part/${args[2]}?size=${args[3]}`;
  };
  s3Service.completeChildVideoUpload = async (...args: unknown[]) => {
    record("complete", args);
    if (failComplete) throw new Error("storage said no");
  };
  s3Service.abortChildVideoUpload = async (...args: unknown[]) => {
    record("abort", args);
  };
  s3Service.headChildVideo = async (...args: unknown[]) => {
    record("head", args);
    return storedSize === null ? null : { sizeBytes: storedSize };
  };
  s3Service.generateChildVideoPlaybackUrl = async (...args: unknown[]) => {
    record("play", args);
    return "https://storage.example/play?sig=abc";
  };
  s3Service.deleteFiles = async (...args: unknown[]) => {
    record("delete", args);
  };
});

after(async () => {
  Object.assign(s3Service, {
    createChildVideoUpload: real.create,
    presignChildVideoPart: real.presign,
    completeChildVideoUpload: real.complete,
    abortChildVideoUpload: real.abort,
    headChildVideo: real.head,
    generateChildVideoPlaybackUrl: real.play,
    deleteFiles: real.del,
  });
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  for (const key of Object.keys(calls)) delete calls[key];
  storedSize = 0;
  failComplete = false;
  for (const model of [ChildVideo, ChildShare, Player, User]) await model.deleteMany({});
});

let counter = 0;

const parentWithChild = async (consent = true) => {
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
    ...(consent
      ? {
          legalConsents: {
            childVideo: { accepted: true, acceptedAt: new Date(), version: "2026-10" },
          },
        }
      : {}),
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

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
const base = (childId: string, rest = "") => `/api/child-history/${childId}/videos${rest}`;
const clip = (over: Record<string, unknown> = {}) => ({
  contentType: "video/mp4",
  sizeBytes: 20 * MB,
  durationSeconds: 60,
  ...over,
});

const start = (p: { childId: string; token: string }, body: Record<string, unknown> = clip()) =>
  request(app).post(base(p.childId)).set(auth(p.token)).send(body);

describe("agreeing to the video notice", () => {
  it("is required before the first upload, and answers 428 so the screen can ask", async () => {
    const p = await parentWithChild(false);
    const res = await start(p);
    assert.equal(res.status, 428);
    assert.equal(made("create").length, 0, "no upload was opened in storage");
    assert.equal(await ChildVideo.countDocuments({}), 0);
  });

  it("is recorded on the parent with the version, after which uploads are allowed", async () => {
    const p = await parentWithChild(false);
    const agreed = await request(app)
      .post("/api/child-history/video-consent")
      .set(auth(p.token))
      .send({ accepted: true });
    assert.equal(agreed.status, 200);

    const user = await User.findById(p.userId).lean();
    assert.equal(user.legalConsents.childVideo.accepted, true);
    assert.equal(user.legalConsents.childVideo.version, "2026-10");
    assert.equal((await start(p)).status, 201);
  });

  it("is not recorded by anything but an explicit yes", async () => {
    const p = await parentWithChild(false);
    for (const body of [{}, { accepted: false }, { accepted: "yes" }]) {
      const res = await request(app)
        .post("/api/child-history/video-consent")
        .set(auth(p.token))
        .send(body);
      assert.equal(res.status, 400);
    }
    assert.equal((await start(p)).status, 428);
  });

  it("is asked again when the wording changes", async () => {
    const p = await parentWithChild(true);
    await User.collection.updateOne(
      { _id: new mongoose.Types.ObjectId(p.userId) },
      { $set: { "legalConsents.childVideo.version": "2025-01" } }
    );
    assert.equal((await start(p)).status, 428);
  });

  it("is reported on the page so the screen knows whether to ask", async () => {
    const asked = await parentWithChild(false);
    const agreed = await parentWithChild(true);
    const a = await request(app).get(`/api/child-history/${asked.childId}`).set(auth(asked.token));
    const b = await request(app)
      .get(`/api/child-history/${agreed.childId}`)
      .set(auth(agreed.token));
    assert.equal(a.body.data.videoConsent, false);
    assert.equal(b.body.data.videoConsent, true);
  });
});

describe("starting an upload", () => {
  it("opens one upload in storage and hands back one link per part, sized exactly", async () => {
    const p = await parentWithChild();
    const size = 20 * MB;
    const res = await start(p, clip({ sizeBytes: size }));
    assert.equal(res.status, 201);

    const { videoId, partBytes, parts } = res.body.data;
    assert.equal(partBytes, videoPartBytes);
    assert.equal(parts.length, Math.ceil(size / videoPartBytes));
    assert.equal(
      parts.reduce((sum: number, part: { sizeBytes: number }) => sum + part.sizeBytes, 0),
      size,
      "the parts add up to the size agreed, so no more can be stored than that"
    );
    assert.ok(
      parts.slice(0, -1).every((part: { sizeBytes: number }) => part.sizeBytes === videoPartBytes)
    );
    assert.deepEqual(
      parts.map((part: { partNumber: number }) => part.partNumber),
      [1, 2, 3]
    );

    const row = await ChildVideo.findById(videoId).lean();
    assert.equal(row.status, "uploading");
    assert.equal(row.declaredBytes, size);
    assert.equal(row.uploadId, "upload-1");
    assert.equal(row.storageKey, `child-videos/${p.childId}/${videoId}.mp4`);
    assert.equal(made("create").length, 1);
    assert.equal(made("presign").length, 3);
  });

  it("refuses a type that is not a video the browsers play", async () => {
    const p = await parentWithChild();
    for (const contentType of ["video/x-msvideo", "application/pdf", "text/html", "video/mpeg"]) {
      assert.equal((await start(p, clip({ contentType }))).status, 400, contentType);
    }
    assert.equal(made("create").length, 0);
  });

  it("refuses a clip over the size limit and one with nothing in it", async () => {
    const p = await parentWithChild();
    assert.equal((await start(p, clip({ sizeBytes: videoMaxBytes + 1 }))).status, 400);
    assert.equal((await start(p, clip({ sizeBytes: 0 }))).status, 400);
    assert.equal(made("create").length, 0);
  });

  it("refuses a clip the browser says is longer than the limit", async () => {
    const p = await parentWithChild();
    const res = await start(p, clip({ durationSeconds: CHILD_HISTORY_LIMITS.videoMaxSeconds + 1 }));
    assert.equal(res.status, 400);
    assert.match(res.body.message, /shorter clip/);
  });

  it(`holds at most ${videosPerChild} clips for one child`, async () => {
    const p = await parentWithChild();
    for (let i = 0; i < videosPerChild; i += 1) {
      await ChildVideo.create({
        childId: p.childId,
        userId: p.userId,
        status: "ready",
        storageKey: `k${i}`,
        contentType: "video/mp4",
        declaredBytes: MB,
      });
    }
    const res = await start(p);
    assert.equal(res.status, 400);
    assert.match(res.body.message, /up to 5 videos/);
    assert.equal(made("create").length, 0);
  });

  it("stops one account starting more than a day's allowance", async () => {
    const p = await parentWithChild();
    await ChildVideo.create({
      childId: p.childId,
      userId: p.userId,
      status: "failed",
      storageKey: "old",
      contentType: "video/mp4",
      declaredBytes: videoBytesPerDay - MB,
    });
    const res = await start(p, clip({ sizeBytes: 5 * MB }));
    assert.equal(res.status, 429);
  });

  it("will not open an upload for another parent's child", async () => {
    const owner = await parentWithChild();
    const stranger = await parentWithChild();
    const res = await request(app).post(base(owner.childId)).set(auth(stranger.token)).send(clip());
    assert.equal(res.status, 404);
    assert.equal(made("create").length, 0);
  });

  it("will not take a body that names an owner, a key or a bucket", async () => {
    const p = await parentWithChild();
    for (const extra of [{ userId: "x" }, { storageKey: "../../x" }, { bucket: "other" }]) {
      assert.equal((await start(p, clip(extra))).status, 400);
    }
  });

  it("leaves nothing behind when storage cannot make the links", async () => {
    const p = await parentWithChild();
    const original = s3Service.presignChildVideoPart;
    s3Service.presignChildVideoPart = async () => {
      throw new Error("signing failed");
    };
    try {
      const res = await start(p);
      assert.ok(res.status >= 500);
    } finally {
      s3Service.presignChildVideoPart = original;
    }
    assert.equal(await ChildVideo.countDocuments({}), 0, "no row is left pointing at nothing");
    assert.equal(made("abort").length, 1, "the open upload was stopped");
  });

  it("requires a sign-in", async () => {
    const p = await parentWithChild();
    assert.equal((await request(app).post(base(p.childId)).send(clip())).status, 401);
  });
});

describe("finishing an upload", () => {
  const begin = async (p: { childId: string; token: string }, size = 20 * MB) => {
    const res = await start(p, clip({ sizeBytes: size }));
    const parts = res.body.data.parts.map((part: { partNumber: number }) => ({
      partNumber: part.partNumber,
      etag: `"etag-${part.partNumber}"`,
    }));
    return { videoId: res.body.data.videoId as string, parts, size };
  };

  const finish = (p: { childId: string; token: string }, videoId: string, parts: unknown[]) =>
    request(app)
      .post(base(p.childId, `/${videoId}/complete`))
      .set(auth(p.token))
      .send({ parts });

  it("marks the clip ready only after storage confirms the size that was agreed", async () => {
    const p = await parentWithChild();
    const { videoId, parts, size } = await begin(p);
    storedSize = size;

    const res = await finish(p, videoId, parts);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.status, "ready");
    assert.equal(res.body.data.sizeBytes, size);

    const row = await ChildVideo.findById(videoId).lean();
    assert.equal(row.status, "ready");
    assert.equal(row.uploadId, undefined, "the open-upload id is cleared");
    assert.equal(made("complete").length, 1);
  });

  it("removes what arrived and fails the clip when the stored size is not the agreed size", async () => {
    const p = await parentWithChild();
    const { videoId, parts, size } = await begin(p);
    storedSize = size + 1;

    const res = await finish(p, videoId, parts);
    assert.equal(res.status, 400);
    const row = await ChildVideo.findById(videoId).lean();
    assert.equal(row.status, "failed");
    assert.equal(row.failureReason, "size_mismatch");
    assert.deepEqual(made("delete")[0], [[row.storageKey], "childVideos"]);
  });

  it("fails when there is no stored object at all", async () => {
    const p = await parentWithChild();
    const { videoId, parts } = await begin(p);
    storedSize = null;
    assert.equal((await finish(p, videoId, parts)).status, 400);
    assert.equal((await ChildVideo.findById(videoId).lean()).status, "failed");
  });

  it("refuses a list of parts that is missing one, repeats one or numbers one wrongly", async () => {
    const p = await parentWithChild();
    const { videoId, parts } = await begin(p);
    const bad = [
      parts.slice(1),
      [parts[0], parts[0], parts[2]],
      [parts[0], parts[1], { partNumber: 9, etag: "x" }],
    ];
    for (const attempt of bad) {
      assert.equal((await finish(p, videoId, attempt)).status, 400);
    }
    assert.equal(made("complete").length, 0, "storage was never asked to join the parts");
    assert.equal((await ChildVideo.findById(videoId).lean()).status, "uploading");
  });

  it("can be asked twice: a finished clip is returned, not joined again", async () => {
    const p = await parentWithChild();
    const { videoId, parts, size } = await begin(p);
    storedSize = size;
    await finish(p, videoId, parts);
    const again = await finish(p, videoId, parts);
    assert.equal(again.status, 200);
    assert.equal(again.body.data.status, "ready");
    assert.equal(made("complete").length, 1);
  });

  it("keeps the upload open for another try when storage cannot join the parts", async () => {
    const p = await parentWithChild();
    const { videoId, parts } = await begin(p);
    failComplete = true;
    assert.equal((await finish(p, videoId, parts)).status, 502);
    assert.equal((await ChildVideo.findById(videoId).lean()).status, "uploading");
  });

  it("is only for the parent who started it", async () => {
    const owner = await parentWithChild();
    const stranger = await parentWithChild();
    const { videoId, parts } = await begin(owner);
    const res = await request(app)
      .post(base(owner.childId, `/${videoId}/complete`))
      .set(auth(stranger.token))
      .send({ parts });
    assert.equal(res.status, 404);
  });
});

describe("playing, listing and removing a clip", () => {
  const readyClip = async (p: { childId: string; userId: string }, over = {}) =>
    ChildVideo.create({
      childId: p.childId,
      userId: p.userId,
      status: "ready",
      storageKey: `child-videos/${p.childId}/clip.mp4`,
      contentType: "video/mp4",
      declaredBytes: 10 * MB,
      sizeBytes: 10 * MB,
      ...over,
    });

  it("gives the owner a short link with a fixed type, and tells caches not to keep it", async () => {
    const p = await parentWithChild();
    const video = await readyClip(p);
    const res = await request(app)
      .get(base(p.childId, `/${video._id}/playback`))
      .set(auth(p.token));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.url, "https://storage.example/play?sig=abc");
    assert.equal(res.body.data.expiresInSeconds, 600);
    assert.equal(res.headers["cache-control"], "no-store");
    assert.deepEqual(made("play")[0], [video.storageKey, "video/mp4", 600]);
  });

  it("gives no link for a clip that is not ready, or to anyone else", async () => {
    const owner = await parentWithChild();
    const stranger = await parentWithChild();
    const pending = await readyClip(owner, { status: "uploading" });
    const ready = await readyClip(owner);

    assert.equal(
      (
        await request(app)
          .get(base(owner.childId, `/${pending._id}/playback`))
          .set(auth(owner.token))
      ).status,
      409
    );
    assert.equal(
      (
        await request(app)
          .get(base(owner.childId, `/${ready._id}/playback`))
          .set(auth(stranger.token))
      ).status,
      404
    );
    assert.equal(
      (
        await request(app)
          .get(base(stranger.childId, `/${ready._id}/playback`))
          .set(auth(stranger.token))
      ).status,
      404,
      "an owner's clip id under your own child does not work either"
    );
    assert.equal(made("play").length, 0);
  });

  it("lists finished clips and recent uploads on the page, never storage keys", async () => {
    const p = await parentWithChild();
    await readyClip(p, { title: "Final set" });
    await readyClip(p, { status: "uploading", storageKey: "u1" });
    await readyClip(p, {
      status: "uploading",
      storageKey: "u2",
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    });
    await readyClip(p, { status: "failed", storageKey: "f1" });

    const res = await request(app).get(`/api/child-history/${p.childId}`).set(auth(p.token));
    assert.equal(res.body.data.videos.length, 2, "ready and one recent upload only");
    assert.ok(res.body.data.videos.some((v: { title?: string }) => v.title === "Final set"));
    assert.ok(!JSON.stringify(res.body).includes("child-videos/"));
    assert.ok(!JSON.stringify(res.body).includes("storageKey"));
  });

  it("deletes the file, the row and the clip's place in any share", async () => {
    const p = await parentWithChild();
    const video = await readyClip(p);
    const other = oid();
    await ChildShare.create({
      childId: p.childId,
      userId: p.userId,
      recipientLabel: "Coach",
      tokenHash: "h1",
      videoIds: [video._id, other],
      expiresAt: new Date(Date.now() + 1000),
      purgeAt: new Date(Date.now() + 1000),
      consentVersion: "2026-10",
      consentAt: new Date(),
    });

    const res = await request(app)
      .delete(base(p.childId, `/${video._id}`))
      .set(auth(p.token));
    assert.equal(res.status, 200);
    assert.deepEqual(made("delete")[0], [[video.storageKey], "childVideos"]);
    assert.equal(await ChildVideo.countDocuments({}), 0);
    const share = await ChildShare.findOne({ tokenHash: "h1" }).lean();
    assert.deepEqual(share.videoIds.map(String), [String(other)]);
  });

  it("cancels an upload still open by stopping it in storage", async () => {
    const p = await parentWithChild();
    const video = await readyClip(p, { status: "uploading", uploadId: "up-9" });
    await request(app)
      .delete(base(p.childId, `/${video._id}`))
      .set(auth(p.token));
    assert.deepEqual(made("abort")[0], [video.storageKey, "up-9"]);
    assert.equal(await ChildVideo.countDocuments({}), 0);
  });

  it("will not delete another parent's clip", async () => {
    const owner = await parentWithChild();
    const stranger = await parentWithChild();
    const video = await readyClip(owner);
    const res = await request(app)
      .delete(base(owner.childId, `/${video._id}`))
      .set(auth(stranger.token));
    assert.equal(res.status, 404);
    assert.equal(await ChildVideo.countDocuments({}), 1);
    assert.equal(made("delete").length, 0);
  });
});

describe("the sweep", () => {
  const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

  it("removes an upload nobody finished, and stops it in storage", async () => {
    const p = await parentWithChild();
    const stale = await ChildVideo.create({
      childId: p.childId,
      userId: p.userId,
      status: "uploading",
      storageKey: "stale",
      contentType: "video/mp4",
      declaredBytes: MB,
      uploadId: "up-old",
    });
    await ChildVideo.collection.updateOne({ _id: stale._id }, { $set: { createdAt: old } });
    const fresh = await ChildVideo.create({
      childId: p.childId,
      userId: p.userId,
      status: "uploading",
      storageKey: "fresh",
      contentType: "video/mp4",
      declaredBytes: MB,
      uploadId: "up-new",
    });

    const result = await ChildVideoService.sweep();
    assert.equal(result.abandoned, 1);
    assert.deepEqual(made("abort")[0], ["stale", "up-old"]);
    assert.equal(await ChildVideo.countDocuments({ _id: stale._id }), 0);
    assert.equal(
      await ChildVideo.countDocuments({ _id: fresh._id }),
      1,
      "a recent upload is left alone"
    );
  });

  it("clears a clip that failed a day ago and keeps a ready one of any age", async () => {
    const p = await parentWithChild();
    const failed = await ChildVideo.create({
      childId: p.childId,
      userId: p.userId,
      status: "failed",
      storageKey: "failed",
      contentType: "video/mp4",
      declaredBytes: MB,
    });
    const ready = await ChildVideo.create({
      childId: p.childId,
      userId: p.userId,
      status: "ready",
      storageKey: "ready",
      contentType: "video/mp4",
      declaredBytes: MB,
      sizeBytes: MB,
    });
    await ChildVideo.collection.updateMany(
      { _id: { $in: [failed._id, ready._id] } },
      { $set: { createdAt: old } }
    );

    const result = await ChildVideoService.sweep();
    assert.equal(result.failed, 1);
    assert.equal(await ChildVideo.countDocuments({ _id: ready._id }), 1);
  });

  it("removes clips whose child no longer exists, with their files", async () => {
    const p = await parentWithChild();
    const gone = oid();
    await ChildVideo.create({
      childId: gone,
      userId: p.userId,
      status: "ready",
      storageKey: "orphan",
      contentType: "video/mp4",
      declaredBytes: MB,
      sizeBytes: MB,
    });
    await ChildVideo.create({
      childId: p.childId,
      userId: p.userId,
      status: "ready",
      storageKey: "kept",
      contentType: "video/mp4",
      declaredBytes: MB,
      sizeBytes: MB,
    });

    const result = await ChildVideoService.sweep();
    assert.equal(result.orphaned, 1);
    assert.deepEqual(made("delete")[0], [["orphan"], "childVideos"]);
    assert.equal(await ChildVideo.countDocuments({ storageKey: "kept" }), 1);
  });
});
