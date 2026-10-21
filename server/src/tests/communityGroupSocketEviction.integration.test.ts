/* eslint-disable @typescript-eslint/no-var-requires */
// Leaving or deleting a group must also take the sockets out of the group's
// rooms. Room membership lives on the socket, not on the database row, so
// removing the participant alone left an ex-member's open tab receiving every
// new message of a private group until it reconnected.
// In-memory MongoDB: local dev points at the live cluster, so a test on the
// default connection would write to production.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { CommunityConversation } = require("../community/models/CommunityConversation");
const { CommunityGroup } = require("../community/models/CommunityGroup");
const { CommunityGroupMember } = require("../community/models/CommunityGroupMember");
const { CommunityService } = require("../community/services/CommunityService");
const {
  setCommunityRealtimeSocketInstance,
} = require("../community/services/CommunityRealtimeService");
const { User } = require("../client/models/User");

let memoryServer: { getUri(): string; stop(): Promise<void> };

let userSeq = 0;
const createUser = async (name: string) => {
  userSeq += 1;
  const user = await User.create({
    name,
    email: `evict-${userSeq}@example.com`,
    phone: `913000${String(userSeq).padStart(4, "0")}`,
    password: "test-password",
    role: "Parent",
  });
  return String(user._id);
};

type SocketsLeaveCall = { target: string | string[]; rooms: string | string[] };

/** Stand-in for the socket.io Server that records every `.in(x).socketsLeave(y)`. */
const installFakeIo = () => {
  const calls: SocketsLeaveCall[] = [];
  const namespace = {
    in: (target: string | string[]) => ({
      socketsLeave: (rooms: string | string[]) => void calls.push({ target, rooms }),
    }),
    to: () => ({ emit() {} }),
  };
  setCommunityRealtimeSocketInstance({ of: () => namespace });
  return calls;
};

before(async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());
});

after(async () => {
  setCommunityRealtimeSocketInstance(null);
  await mongoose.disconnect();
  await memoryServer.stop();
});

describe("group membership and live rooms", () => {
  beforeEach(async () => {
    await CommunityGroup.deleteMany({});
    await CommunityGroupMember.deleteMany({});
    await CommunityConversation.deleteMany({});
    await User.deleteMany({});
  });

  const setup = async () => {
    const owner = await createUser("Owner");
    const member = await createUser("Member");
    const group = await CommunityService.createGroup(owner, {
      name: "Tennis Parents",
      visibility: "PUBLIC",
    });
    const joined = await CommunityService.joinGroup(member, group.id);
    return {
      owner,
      member,
      groupId: String(group.id),
      conversationId: String(joined.conversationId),
    };
  };

  it("removes a member's sockets from the group's rooms when they leave", async () => {
    const { member, groupId, conversationId } = await setup();
    const calls = installFakeIo();

    await CommunityService.leaveGroup(member, groupId);

    const evicted = calls.find((call) => call.target === `user:${member}`);
    assert.ok(evicted, "the leaver's own user room was used to find their sockets");
    assert.deepEqual(evicted.rooms, [`conversation:${conversationId}`, `group:${groupId}`]);
  });

  it("does not touch anyone else's sockets when one member leaves", async () => {
    const { owner, member, groupId } = await setup();
    const calls = installFakeIo();

    await CommunityService.leaveGroup(member, groupId);

    assert.ok(!calls.some((call) => call.target === `user:${owner}`));
  });

  it("empties the group's rooms for everyone when the group is deleted", async () => {
    const { owner, groupId, conversationId } = await setup();
    const calls = installFakeIo();

    await CommunityService.deleteGroup(owner, groupId);

    const closed = calls.find(
      (call) => Array.isArray(call.target) && call.target.includes(`conversation:${conversationId}`)
    );
    assert.ok(closed, "the conversation room was emptied");
    assert.deepEqual(closed.target, [`conversation:${conversationId}`, `group:${groupId}`]);
    assert.deepEqual(closed.rooms, closed.target);
  });

  it("evicts the last member too, even though the conversation is deleted", async () => {
    const owner = await createUser("Solo");
    const group = await CommunityService.createGroup(owner, { name: "Solo", visibility: "PUBLIC" });
    const joined = await CommunityService.joinGroup(owner, group.id);
    const calls = installFakeIo();

    await CommunityService.leaveGroup(owner, String(group.id));

    assert.ok(
      calls.some(
        (call) =>
          call.target === `user:${owner}` &&
          Array.isArray(call.rooms) &&
          call.rooms.includes(`conversation:${joined.conversationId}`)
      )
    );
  });
});
