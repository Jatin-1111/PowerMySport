/* eslint-disable @typescript-eslint/no-var-requires */
// The planner tour flag lives on the user so it follows a parent across devices.
// What matters: an account that never set it has NOT seen the tour, setting it
// sticks, and it can be turned back off to replay the tour.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.REDIS_ENABLED = "false";

import assert = require("node:assert/strict");
const { after, before, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { User } = require("../client/models/User");
const { hasSeenPlannerTour, setPlannerTourSeen } = require("../client/services/plannerTour");

let memoryServer: { getUri(): string; stop(): Promise<void> };
let counter = 0;

const seedParent = () => {
  counter += 1;
  return User.create({
    name: `Tour Parent ${counter}`,
    email: `tour.parent.${counter}@example.test`,
    phone: `98${String(10000000 + counter)}`,
    password: "not-a-real-password",
    role: "Parent",
  });
};

before(async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await memoryServer.stop();
});

describe("planner tour flag", () => {
  it("reads as not seen for a new account", async () => {
    const parent = await seedParent();
    assert.equal(await hasSeenPlannerTour(String(parent._id)), false);
  });

  it("reads as not seen for an account created before the field existed", async () => {
    const parent = await seedParent();
    await User.collection.updateOne({ _id: parent._id }, { $unset: { plannerTourSeen: "" } });
    assert.equal(await hasSeenPlannerTour(String(parent._id)), false);
  });

  it("stays seen once set, and can be switched off to replay", async () => {
    const parent = await seedParent();
    const id = String(parent._id);

    assert.equal(await setPlannerTourSeen(id, true), true);
    assert.equal(await hasSeenPlannerTour(id), true);

    assert.equal(await setPlannerTourSeen(id, false), false);
    assert.equal(await hasSeenPlannerTour(id), false);
  });

  it("does not touch another parent", async () => {
    const first = await seedParent();
    const second = await seedParent();
    await setPlannerTourSeen(String(first._id), true);
    assert.equal(await hasSeenPlannerTour(String(second._id)), false);
  });

  it("is a 404 for an account that does not exist", async () => {
    const ghost = String(new mongoose.Types.ObjectId());
    await assert.rejects(hasSeenPlannerTour(ghost), { statusCode: 404 });
    await assert.rejects(setPlannerTourSeen(ghost, true), { statusCode: 404 });
  });
});
