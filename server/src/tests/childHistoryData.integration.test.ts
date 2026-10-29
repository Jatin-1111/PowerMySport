// The data layer of the child sporting history: five collections, the migration that indexes
// them, and what deleting a child or an account does to them.
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

const { deleteDependent } = require("../shared/services/AuthService/dependents");
const { cascadeDeleteUserData } = require("../shared/services/AuthService/accountDeletion");
const { Player } = require("../client/models/Player");
const { User } = require("../client/models/User");
const { ChildEvent } = require("../client/models/ChildEvent");
const { ChildAcademicProfile } = require("../client/models/ChildAcademicProfile");
const { ChildVideo } = require("../client/models/ChildVideo");
const { ChildShare } = require("../client/models/ChildShare");
const { ContactRequest } = require("../client/models/ContactRequest");
const { s3Service } = require("../shared/services/S3Service");
const { up, down, CHILD_HISTORY_INDEXES } = require("../migrations/70_child_history_indexes");
const { sourceOf, CHILD_HISTORY_LIMITS } = require("@powermysport/shared-types");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();

const MODELS = [ChildEvent, ChildAcademicProfile, ChildVideo, ChildShare, ContactRequest];

let mongod: any;
let deletedKeys: string[][] = [];
const realDeleteFiles = s3Service.deleteFiles.bind(s3Service);

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all(MODELS.map((model) => model.init()));
  // Storage is not reached in a test; the keys it was asked to delete are what is checked.
  s3Service.deleteFiles = async (keys: string[]) => {
    deletedKeys.push(keys);
  };
});

after(async () => {
  s3Service.deleteFiles = realDeleteFiles;
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  deletedKeys = [];
  for (const model of [...MODELS, Player, User]) await model.deleteMany({});
});

let counter = 0;

const seedParentAndChild = async () => {
  const userId = oid();
  counter += 1;
  await User.collection.insertOne({
    _id: userId,
    name: "Parent Person",
    email: `parent-${userId}@test.com`,
    phone: `8${String(counter).padStart(9, "0")}`,
    role: "Parent",
    isActive: true,
  });
  const childId = oid();
  await Player.collection.insertOne({ _id: childId, userId, name: "Riya", age: 15 });
  return { userId, childId };
};

const seedHistory = async (userId: any, childId: any) => {
  const now = new Date();
  await ChildEvent.create({
    childId,
    userId,
    kind: "tournament_result",
    title: "Pune Open",
    occurredOn: now,
    datePrecision: "month",
  });
  await ChildAcademicProfile.create({ childId, userId, board: "CBSE", graduationYear: 2029 });
  const video = await ChildVideo.create({
    childId,
    userId,
    status: "ready",
    storageKey: `child-videos/${childId}/${oid()}.mp4`,
    contentType: "video/mp4",
    declaredBytes: 1000,
  });
  const share = await ChildShare.create({
    childId,
    userId,
    recipientLabel: "Coach Miller",
    tokenHash: `hash-${oid()}`,
    sections: ["results"],
    videoIds: [video._id],
    expiresAt: new Date(now.getTime() + 86_400_000),
    purgeAt: new Date(now.getTime() + 90 * 86_400_000),
    consentVersion: "2026-10",
    consentAt: now,
  });
  await ContactRequest.create({
    shareId: share._id,
    childId,
    userId,
    name: "Coach Miller",
    email: "Miller@Example.edu",
  });
  return { video };
};

const counts = async (userId: any) => ({
  events: await ChildEvent.countDocuments({ userId }),
  academics: await ChildAcademicProfile.countDocuments({ userId }),
  videos: await ChildVideo.countDocuments({ userId }),
  shares: await ChildShare.countDocuments({ userId }),
  requests: await ContactRequest.countDocuments({ userId }),
});

describe("deleting a child", () => {
  it("removes their history, academics, videos, shares and contact requests, and the video files first", async () => {
    const { userId, childId } = await seedParentAndChild();
    const { video } = await seedHistory(userId, childId);
    assert.deepEqual(await counts(userId), {
      events: 1,
      academics: 1,
      videos: 1,
      shares: 1,
      requests: 1,
    });

    await deleteDependent(userId.toString(), childId.toString());

    assert.deepEqual(await counts(userId), {
      events: 0,
      academics: 0,
      videos: 0,
      shares: 0,
      requests: 0,
    });
    assert.deepEqual(deletedKeys, [[video.storageKey]], "the stored file is deleted too");
  });

  it("leaves another child's history alone", async () => {
    const { userId, childId } = await seedParentAndChild();
    const other = oid();
    await Player.collection.insertOne({ _id: other, userId, name: "Aarav", age: 12 });
    await seedHistory(userId, childId);
    await seedHistory(userId, other);

    await deleteDependent(userId.toString(), childId.toString());

    assert.equal(await ChildEvent.countDocuments({ childId: other }), 1);
    assert.equal(await ChildVideo.countDocuments({ childId: other }), 1);
    assert.equal(await ChildShare.countDocuments({ childId: other }), 1);
  });

  it("does not touch storage when the child has no videos", async () => {
    const { userId, childId } = await seedParentAndChild();
    await deleteDependent(userId.toString(), childId.toString());
    assert.deepEqual(deletedKeys, []);
  });
});

describe("deleting an account", () => {
  it("removes everything the parent owns in the history, and the video files", async () => {
    const { userId, childId } = await seedParentAndChild();
    const { video } = await seedHistory(userId, childId);
    const stranger = await seedParentAndChild();
    await seedHistory(stranger.userId, stranger.childId);

    await cascadeDeleteUserData(userId.toString());

    assert.deepEqual(await counts(userId), {
      events: 0,
      academics: 0,
      videos: 0,
      shares: 0,
      requests: 0,
    });
    assert.deepEqual(deletedKeys, [[video.storageKey]]);
    assert.equal(
      await ChildEvent.countDocuments({ userId: stranger.userId }),
      1,
      "other accounts are untouched"
    );
  });
});

describe("what the collections enforce", () => {
  it("keeps one stored result per child and tournament, but any number without a tournament", async () => {
    const { userId, childId } = await seedParentAndChild();
    const base = { childId, userId, kind: "tournament_result", occurredOn: new Date() };
    await ChildEvent.create({ ...base, title: "Pune Open", editionSlug: "pune-open-2026" });
    await assert.rejects(
      ChildEvent.create({ ...base, title: "Pune Open again", editionSlug: "pune-open-2026" }),
      /E11000/
    );
    await ChildEvent.create({ ...base, title: "Club match" });
    await ChildEvent.create({ ...base, title: "Another club match" });
    assert.equal(await ChildEvent.countDocuments({ childId }), 3);
  });

  it("keeps one academic profile per child", async () => {
    const { userId, childId } = await seedParentAndChild();
    await ChildAcademicProfile.create({ childId, userId, board: "CBSE" });
    await assert.rejects(ChildAcademicProfile.create({ childId, userId, board: "ICSE" }), /E11000/);
  });

  it("keeps a token hash unique, so one link cannot open two profiles", async () => {
    const { userId, childId } = await seedParentAndChild();
    const fields = {
      childId,
      userId,
      recipientLabel: "Coach",
      tokenHash: "same",
      expiresAt: new Date(),
      purgeAt: new Date(),
      consentVersion: "2026-10",
      consentAt: new Date(),
    };
    await ChildShare.create(fields);
    await assert.rejects(ChildShare.create(fields), /E11000/);
  });

  it("refuses a title, an unknown kind and a date precision that is not one of the three", async () => {
    const { userId, childId } = await seedParentAndChild();
    const base = { childId, userId, kind: "award", title: "Medal", occurredOn: new Date() };
    await assert.rejects(
      ChildEvent.create({ ...base, title: "x".repeat(CHILD_HISTORY_LIMITS.titleChars + 1) })
    );
    await assert.rejects(ChildEvent.create({ ...base, kind: "injury" }));
    await assert.rejects(ChildEvent.create({ ...base, datePrecision: "hour" }));
  });

  it("lower-cases a coach's email on a contact request", async () => {
    const { userId, childId } = await seedParentAndChild();
    await seedHistory(userId, childId);
    const request = await ContactRequest.findOne({ childId }).lean();
    assert.equal(request.email, "miller@example.edu");
  });
});

describe("sourceOf", () => {
  it("is a parent record, and a parent record with a link once a result link is attached", () => {
    assert.equal(sourceOf({}), "parent");
    assert.equal(sourceOf({ resultUrl: "" }), "parent");
    assert.equal(sourceOf({ resultUrl: "https://example.org/draw" }), "parent_with_link");
  });
});

describe("migration 70 (indexes)", () => {
  const names = async (collection: string): Promise<string[]> => {
    const exists =
      (await mongoose.connection.db.listCollections({ name: collection }).toArray()).length > 0;
    if (!exists) return [];
    return (await mongoose.connection.db.collection(collection).indexes()).map(
      (i: { name: string }) => i.name
    );
  };

  it("matches every model's own indexes, so the two cannot drift", () => {
    for (const model of MODELS) {
      const collection = model.collection.name;
      const specs = CHILD_HISTORY_INDEXES.filter(
        (s: { collection: string }) => s.collection === collection
      );
      assert.ok(specs.length > 0, `migration 70 has no indexes for ${collection}`);

      const fromModel = model.schema.indexes();
      assert.equal(fromModel.length, specs.length, `${collection}: index count differs`);
      for (const [key, options] of fromModel) {
        const spec = specs.find((s: { name: string }) => s.name === options.name);
        assert.ok(spec, `${collection}.${options.name} is in the model but not the migration`);
        assert.deepEqual(spec.key, key, `${collection}.${options.name}: key differs`);
        assert.equal(Boolean(spec.options.unique), Boolean(options.unique));
        assert.equal(spec.options.expireAfterSeconds, options.expireAfterSeconds);
        assert.deepEqual(spec.options.partialFilterExpression, options.partialFilterExpression);
      }
    }
  });

  it("keeps the promises made on the share page: contact requests for 90 days, links purged by date", () => {
    const requests = CHILD_HISTORY_INDEXES.find(
      (s: { collection: string; name: string }) =>
        s.collection === "contactrequests" && s.name === "createdAt_1"
    );
    assert.equal(requests.options.expireAfterSeconds, 90 * 24 * 60 * 60);
    const shares = CHILD_HISTORY_INDEXES.find(
      (s: { collection: string; name: string }) =>
        s.collection === "childshares" && s.name === "purgeAt_1"
    );
    assert.equal(shares.options.expireAfterSeconds, 0);
  });

  it("creates nothing on a dry run, creates every index on apply, runs twice harmlessly, and reverts", async () => {
    const db = mongoose.connection.db;
    for (const model of MODELS) await model.collection.drop().catch(() => undefined);

    await up({}, db);
    for (const model of MODELS) {
      assert.deepEqual(
        await names(model.collection.name),
        [],
        "a dry run must not create anything"
      );
    }

    await up({ apply: true }, db);
    await up({ apply: true }, db);
    for (const spec of CHILD_HISTORY_INDEXES) {
      assert.ok(
        (await names(spec.collection)).includes(spec.name),
        `${spec.collection}.${spec.name}`
      );
    }

    await down({ apply: true }, db);
    for (const spec of CHILD_HISTORY_INDEXES) {
      assert.ok(!(await names(spec.collection)).includes(spec.name));
    }
  });
});
