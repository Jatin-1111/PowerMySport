/* eslint-disable @typescript-eslint/no-var-requires */
// What is removed when a child, or a whole account, is deleted.
//
// Deleting a dependent used to remove the profile, the ranking link and the
// season plan only. The pathway profile, the check-ins (and the queued emails
// behind them, which kept asking how a deleted child's sport was going), the
// guidance submissions with the child's age and the parent's words, and the
// screening requests all stayed. Account deletion missed the site assistant's
// chats and the screening requests.
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
const { finalizeAccountDeletion } = require("../shared/services/AuthService/accountDeletion");
const { Player } = require("../client/models/Player");
const { User } = require("../client/models/User");
const { UserPathwayProfile } = require("../shared/models/UserPathwayProfile");
const { PlanCheckIn } = require("../shared/models/PlanCheckIn");
const { ScheduledNotification } = require("../client/models/ScheduledNotification");
const { GuidanceSubmission } = require("../client/models/GuidanceSubmission");
const { GuidanceChatSession } = require("../client/models/GuidanceChatSession");
const { ScreeningRequest } = require("../client/models/ScreeningRequest");
const { AssistantChatSession } = require("../client/models/AssistantChatSession");
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();

let mongod: any;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

const COLLECTIONS = [
  Player,
  User,
  UserPathwayProfile,
  PlanCheckIn,
  ScheduledNotification,
  GuidanceSubmission,
  GuidanceChatSession,
  ScreeningRequest,
  AssistantChatSession,
];

beforeEach(async () => {
  for (const model of COLLECTIONS) await model.collection.deleteMany({});
});

let counter = 0;

const seedParent = async () => {
  const userId = oid();
  counter += 1;
  await User.collection.insertOne({
    _id: userId,
    name: "Parent Person",
    email: `parent-${userId}@test.com`,
    phone: `9${String(counter).padStart(9, "0")}`,
    role: "Parent",
    isActive: true,
  });
  return userId;
};

const seedChild = async (userId: any, name: string) => {
  const childId = oid();
  await Player.collection.insertOne({ _id: childId, userId, type: "DEPENDENT", name, age: 11 });
  return childId;
};

/** One of everything that names a child, for this child. */
const seedChildRecords = async (userId: any, childId: any, label: string) => {
  await UserPathwayProfile.collection.insertOne({ userId, dependentId: childId });

  const checkInId = oid();
  await PlanCheckIn.collection.insertOne({
    _id: checkInId,
    userId,
    dependentId: childId,
    source: "find_sport_trial",
    sport: "Tennis",
    status: "active",
    checkInDueAt: new Date(Date.now() + 86_400_000),
    createdAt: new Date(),
  });
  await ScheduledNotification.collection.insertOne({
    userId,
    type: "PLAN_CHECKIN",
    status: "PENDING",
    scheduledFor: new Date(Date.now() + 86_400_000),
    title: `How's Tennis going? (${label})`,
    data: { checkInId: checkInId.toString() },
  });

  const submissionId = oid();
  await GuidanceSubmission.collection.insertOne({
    _id: submissionId,
    userId,
    request: { dependent_id: childId, child_age: 11 },
    response: {},
  });
  await GuidanceChatSession.collection.insertOne({
    submissionId,
    userId,
    messages: [],
    totalMessageCount: 0,
  });

  await ScreeningRequest.collection.insertOne({
    parentId: userId,
    dependentId: childId,
    dependentName: label,
    phone: "9876543210",
    status: "requested",
  });
};

const countsFor = async (childId: any) => ({
  pathway: await UserPathwayProfile.collection.countDocuments({ dependentId: childId }),
  checkIns: await PlanCheckIn.collection.countDocuments({ dependentId: childId }),
  submissions: await GuidanceSubmission.collection.countDocuments({
    "request.dependent_id": childId,
  }),
  screenings: await ScreeningRequest.collection.countDocuments({ dependentId: childId }),
});

describe("deleteDependent", () => {
  it("removes everything that names the child and leaves a sibling's records alone", async () => {
    const userId = await seedParent();
    const aarav = await seedChild(userId, "Aarav");
    const meera = await seedChild(userId, "Meera");
    await seedChildRecords(userId, aarav, "Aarav");
    await seedChildRecords(userId, meera, "Meera");

    await deleteDependent(String(userId), String(aarav));

    assert.deepEqual(await countsFor(aarav), {
      pathway: 0,
      checkIns: 0,
      submissions: 0,
      screenings: 0,
    });
    assert.deepEqual(await countsFor(meera), {
      pathway: 1,
      checkIns: 1,
      submissions: 1,
      screenings: 1,
    });
  });

  it("removes the queued check-in email, not only the check-in", async () => {
    const userId = await seedParent();
    const aarav = await seedChild(userId, "Aarav");
    const meera = await seedChild(userId, "Meera");
    await seedChildRecords(userId, aarav, "Aarav");
    await seedChildRecords(userId, meera, "Meera");

    await deleteDependent(String(userId), String(aarav));

    const remaining = await ScheduledNotification.collection
      .find({ type: "PLAN_CHECKIN" })
      .toArray();
    assert.equal(remaining.length, 1);
    assert.match(remaining[0].title, /Meera/);
  });

  it("removes the follow-up chat on the child's guidance, and only that child's", async () => {
    const userId = await seedParent();
    const aarav = await seedChild(userId, "Aarav");
    const meera = await seedChild(userId, "Meera");
    await seedChildRecords(userId, aarav, "Aarav");
    await seedChildRecords(userId, meera, "Meera");

    await deleteDependent(String(userId), String(aarav));

    assert.equal(await GuidanceChatSession.collection.countDocuments({}), 1);
  });
});

describe("finalizeAccountDeletion", () => {
  it("removes the site assistant's chats and the screening requests", async () => {
    const userId = await seedParent();
    const other = await seedParent();
    for (const owner of [userId, other]) {
      await AssistantChatSession.collection.insertOne({
        userId: owner,
        title: null,
        messages: [{ role: "user", content: "My 11 year old plays tennis", createdAt: new Date() }],
        totalMessageCount: 1,
      });
      await ScreeningRequest.collection.insertOne({
        parentId: owner,
        dependentName: "Child",
        phone: "9876543210",
        status: "requested",
      });
    }

    await finalizeAccountDeletion(String(userId));

    assert.equal(await AssistantChatSession.collection.countDocuments({ userId }), 0);
    assert.equal(await ScreeningRequest.collection.countDocuments({ parentId: userId }), 0);
    // Another parent's data is untouched.
    assert.equal(await AssistantChatSession.collection.countDocuments({ userId: other }), 1);
    assert.equal(await ScreeningRequest.collection.countDocuments({ parentId: other }), 1);
  });
});
