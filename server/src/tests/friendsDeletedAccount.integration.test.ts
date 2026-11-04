/* eslint-disable @typescript-eslint/no-var-requires */
// GET /api/friends when a friend's account no longer exists.
//
// The dashboard rendered "2 connections." directly above "No connections yet".
// Both numbers came from the same response: `total` was a countDocuments over
// every ACCEPTED row, while the list dropped rows whose counterpart had been
// deleted. A connection to a deleted account counted toward the total and
// produced nobody to show.
//
// Account deletion does clear these rows, so a dangling row means some other
// path removed the user. That is exactly why the read has to filter rather
// than trust the data: pinning it here keeps the two halves of the response
// derived from one set.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";
process.env.PHONEPE_CLIENT_ID = "test-client";
process.env.PHONEPE_CLIENT_SECRET = "test-secret";
process.env.PHONEPE_CLIENT_VERSION = "1";
process.env.PHONEPE_ENV = "SANDBOX";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const request = require("supertest");

const { app } = require("../app");
const { generateToken } = require("../utils/jwt");
const { User } = require("../client/models/User");
const FriendConnection = require("../client/models/FriendConnection").default;
const redis = require("../config/redis").default;

const oid = () => new mongoose.Types.ObjectId();

let mongod: any;
let userCounter = 0;

before(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await mongod.stop();
  redis.disconnect();
});

beforeEach(async () => {
  for (const name of ["users", "friendconnections"]) {
    await mongoose.connection.db.collection(name).deleteMany({});
  }
});

const makeUser = async (role = "Parent") => {
  const userId = oid();
  userCounter += 1;
  await User.collection.insertOne({
    _id: userId,
    name: `Test ${role} ${userCounter}`,
    email: `${userId.toString()}@example.test`,
    // `phone` carries a non-sparse unique index — distinct values or inserts collide.
    phone: `9${userId.toString().slice(-9)}`,
    role,
    isActive: true,
    status: "ACTIVE",
  });
  return userId;
};

const signedInAs = async (role = "Parent") => {
  const userId = await makeUser(role);
  const token = generateToken({
    id: userId.toString(),
    email: `${userId.toString()}@example.test`,
    role,
  });
  return { userId, token };
};

const befriend = async (a: any, b: any) => {
  await FriendConnection.create({ requesterId: a, recipientId: b, status: "ACCEPTED" });
};

const listFriends = (token: string, query = "") =>
  request(app).get(`/api/friends${query}`).set("Authorization", `Bearer ${token}`);

describe("GET /api/friends with deleted counterparts", () => {
  it("counts only friends who still exist", async () => {
    const me = await signedInAs();
    const alive = await makeUser();
    const departed = await makeUser();
    await befriend(me.userId, alive);
    await befriend(me.userId, departed);

    // The friend deletes their account; the connection row outlives them.
    await User.deleteOne({ _id: departed });

    const response = await listFriends(me.token);

    assert.equal(response.status, 200);
    // The regression: this used to be 2 while `friends` held a single entry.
    assert.equal(response.body.data.total, 1, "total must not count a deleted account");
    assert.equal(response.body.data.friends.length, 1);
    assert.equal(String(response.body.data.friends[0].id), String(alive));
  });

  it("reports zero, not a phantom count, when every friend is gone", async () => {
    const me = await signedInAs();
    const departed = await makeUser();
    await befriend(me.userId, departed);
    await User.deleteOne({ _id: departed });

    const response = await listFriends(me.token);

    assert.equal(response.body.data.total, 0);
    assert.equal(response.body.data.friends.length, 0);
    assert.equal(response.body.data.totalPages, 0);
  });

  /**
   * Paging used to skip/limit before dropping dead rows, so a page could come
   * back short while later pages still held real friends.
   */
  it("fills a page with live friends even when dead rows sort first", async () => {
    const me = await signedInAs();
    const departed = await makeUser();
    await befriend(me.userId, departed);
    const living = [];
    for (let i = 0; i < 3; i++) {
      const friend = await makeUser();
      living.push(String(friend));
      await befriend(me.userId, friend);
    }
    await User.deleteOne({ _id: departed });

    const response = await listFriends(me.token, "?page=1&limit=3");

    assert.equal(response.body.data.total, 3);
    assert.equal(
      response.body.data.friends.length,
      3,
      "a dead row must not consume a slot on the page"
    );
    for (const friend of response.body.data.friends) {
      assert.ok(living.includes(String(friend.id)), "only living friends should be returned");
    }
  });

  it("still returns both sides of a healthy connection", async () => {
    const me = await signedInAs();
    const other = await makeUser();
    // Stored with the other user as requester, to prove the counterpart is
    // resolved from whichever side the current user is not on.
    await befriend(other, me.userId);

    const response = await listFriends(me.token);

    assert.equal(response.body.data.total, 1);
    assert.equal(String(response.body.data.friends[0].id), String(other));
  });
});
