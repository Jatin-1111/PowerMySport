/* eslint-disable @typescript-eslint/no-var-requires */
// Integration tests for group membership after it moved out of the embedded
// `members`/`admins` arrays. In-memory MongoDB — local dev points at the live
// cluster, so a test on the default connection would write to production.
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-1234567890";

import assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

const { CommunityGroup } = require("../community/models/CommunityGroup");
const { CommunityGroupMember } = require("../community/models/CommunityGroupMember");
const { CommunityService } = require("../community/services/CommunityService");
const { addMember } = require("../community/services/communityGroupMembership");
const { User } = require("../client/models/User");
const migration26 = require("../migrations/26_extract_community_group_members");

let memoryServer: { getUri(): string; stop(): Promise<void> };

let userSeq = 0;
const createUser = async (name: string, role = "Parent") => {
  userSeq += 1;
  const user = await User.create({
    name,
    email: `group-${userSeq}@example.com`,
    phone: `912000${String(userSeq).padStart(4, "0")}`,
    password: "test-password",
    role,
  });
  return String(user._id);
};

// One in-memory server for the whole file. Mongoose has a single default
// connection, so a second describe opening its own would have the first
// `after` tearing down the connection the second is still using.
before(async () => {
  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri());
});

after(async () => {
  await mongoose.disconnect();
  await memoryServer.stop();
});

describe("community group membership", () => {
  beforeEach(async () => {
    await CommunityGroup.deleteMany({});
    await CommunityGroupMember.deleteMany({});
    await User.deleteMany({});
  });

  it("makes the creator the first member and an admin", async () => {
    const owner = await createUser("Owner");
    const group = await CommunityService.createGroup(owner, {
      name: "Tennis Parents",
    });

    const rows = await CommunityGroupMember.find({
      groupId: group.id,
    }).lean();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].role, "ADMIN");
    assert.equal(group.memberCount, 1);
  });

  it("keeps memberCount in step with the rows", async () => {
    const owner = await createUser("Owner");
    const joiner = await createUser("Joiner");
    const group = await CommunityService.createGroup(owner, { name: "Squad" });

    await CommunityService.joinGroup(joiner, group.id);

    const stored = await CommunityGroup.findById(group.id).lean();
    const actual = await CommunityGroupMember.countDocuments({
      groupId: group.id,
    });
    assert.equal(stored.memberCount, 2);
    assert.equal(actual, 2);
  });

  it("does not double-count a repeat join", async () => {
    const owner = await createUser("Owner");
    const joiner = await createUser("Joiner");
    const group = await CommunityService.createGroup(owner, { name: "Squad" });

    await CommunityService.joinGroup(joiner, group.id);
    await CommunityService.joinGroup(joiner, group.id);

    const stored = await CommunityGroup.findById(group.id).lean();
    assert.equal(stored.memberCount, 2);
    assert.equal(await CommunityGroupMember.countDocuments({ groupId: group.id }), 2);
  });

  it("counts a membership once even if two admins add the same person", async () => {
    const owner = await createUser("Owner");
    const target = await createUser("Target");
    const group = await CommunityService.createGroup(owner, { name: "Squad" });

    // Straight at the primitive: joinGroup short-circuits on its own
    // membership check, so it never exercises what happens when two writers
    // race to insert the same row. The unique index makes the insert the
    // source of truth and memberCount follows it.
    const first = await addMember(group.id, target);
    const second = await addMember(group.id, target);

    assert.equal(first, true);
    assert.equal(second, false, "second add must report no insert");

    const stored = await CommunityGroup.findById(group.id).lean();
    assert.equal(stored.memberCount, 2);
    assert.equal(await CommunityGroupMember.countDocuments({ groupId: group.id }), 2);
  });

  it("refuses a self-join to an invite-only group", async () => {
    const owner = await createUser("Owner");
    const outsider = await createUser("Outsider");
    const group = await CommunityService.createGroup(owner, {
      name: "Inner Circle",
      visibility: "INVITE_ONLY",
    });

    await assert.rejects(() => CommunityService.joinGroup(outsider, group.id), /invite-only/i);
  });

  it("lets an invite code into a private group", async () => {
    const owner = await createUser("Owner");
    const invitee = await createUser("Invitee");
    const group = await CommunityService.createGroup(owner, {
      name: "Hidden",
      visibility: "PRIVATE",
    });

    const stored = await CommunityGroup.findById(group.id).lean();
    const result = await CommunityService.joinGroupByCode(invitee, stored.inviteCode);

    assert.equal(result.memberCount, 2);
  });

  it("hides private groups from discovery but keeps invite-only listed", async () => {
    const owner = await createUser("Owner");
    const browser = await createUser("Browser");

    await CommunityService.createGroup(owner, { name: "Open Group" });
    await CommunityService.createGroup(owner, {
      name: "Invite Group",
      visibility: "INVITE_ONLY",
    });
    await CommunityService.createGroup(owner, {
      name: "Secret Group",
      visibility: "PRIVATE",
    });

    const listed = await CommunityService.listGroups(browser, "", 50);
    const names = listed.map((group: { name: string }) => group.name).sort();

    assert.deepEqual(names, ["Invite Group", "Open Group"]);
  });

  it("promotes a remaining member when the last admin leaves", async () => {
    const owner = await createUser("Owner");
    const member = await createUser("Member");
    const group = await CommunityService.createGroup(owner, { name: "Squad" });
    await CommunityService.joinGroup(member, group.id);

    await CommunityService.leaveGroup(owner, group.id);

    const rows = await CommunityGroupMember.find({ groupId: group.id }).lean();
    assert.equal(rows.length, 1);
    // Otherwise everyone left is locked out of settings, invites and deletion.
    assert.equal(rows[0].role, "ADMIN");
  });

  it("deletes the group and its memberships when the last member leaves", async () => {
    const owner = await createUser("Owner");
    const group = await CommunityService.createGroup(owner, { name: "Solo" });

    const result = await CommunityService.leaveGroup(owner, group.id);

    assert.equal(result.deletedGroup, true);
    assert.equal(await CommunityGroup.countDocuments({ _id: group.id }), 0);
    assert.equal(await CommunityGroupMember.countDocuments({ groupId: group.id }), 0);
  });

  it("leaves no orphan memberships when a group is deleted", async () => {
    const owner = await createUser("Owner");
    const member = await createUser("Member");
    const group = await CommunityService.createGroup(owner, { name: "Doomed" });
    await CommunityService.joinGroup(member, group.id);

    await CommunityService.deleteGroup(owner, group.id);

    assert.equal(await CommunityGroupMember.countDocuments({ groupId: group.id }), 0);
  });

  it("keeps non-members out of the member list", async () => {
    const owner = await createUser("Owner");
    const outsider = await createUser("Outsider");
    const group = await CommunityService.createGroup(owner, { name: "Squad" });

    await assert.rejects(
      () => CommunityService.getGroupMembers(outsider, group.id),
      /Access denied/
    );
  });

  it("stops a plain member from changing settings", async () => {
    const owner = await createUser("Owner");
    const member = await createUser("Member");
    const group = await CommunityService.createGroup(owner, { name: "Squad" });
    await CommunityService.joinGroup(member, group.id);

    await assert.rejects(
      () => CommunityService.updateGroup(member, group.id, { name: "Hijacked" }),
      /Only group admins/
    );
  });
});

describe("migration 26: extract group members", () => {
  beforeEach(async () => {
    await CommunityGroup.deleteMany({});
    await CommunityGroupMember.deleteMany({});
  });

  /** Writes a group in the pre-migration shape, bypassing the schema — which
   *  no longer declares members/admins. */
  const seedLegacyGroup = async (members: string[], admins: string[], name = "Legacy Group") => {
    const result = await CommunityGroup.collection.insertOne({
      name,
      description: "",
      visibility: "PUBLIC",
      memberAddPolicy: "ADMIN_ONLY",
      audience: "ALL",
      createdBy: new mongoose.Types.ObjectId(),
      members: members.map((id) => new mongoose.Types.ObjectId(id)),
      admins: admins.map((id) => new mongoose.Types.ObjectId(id)),
      inviteCode: Math.random().toString(36).slice(2, 12),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return String(result.insertedId);
  };

  it("writes nothing on a dry run", async () => {
    const a = new mongoose.Types.ObjectId().toString();
    await seedLegacyGroup([a], [a]);

    await migration26.up({});

    assert.equal(await CommunityGroupMember.countDocuments({}), 0);
  });

  it("copies members and admins into rows with the right roles", async () => {
    const admin = new mongoose.Types.ObjectId().toString();
    const member = new mongoose.Types.ObjectId().toString();
    const groupId = await seedLegacyGroup([admin, member], [admin]);

    await migration26.up({ apply: true });

    const rows = await CommunityGroupMember.find({ groupId }).lean();
    assert.equal(rows.length, 2);
    const byUser = new Map(
      rows.map((row: { userId: unknown; role: string }) => [String(row.userId), row.role])
    );
    assert.equal(byUser.get(admin), "ADMIN");
    assert.equal(byUser.get(member), "MEMBER");

    const group = await CommunityGroup.findById(groupId).lean();
    assert.equal(group.memberCount, 2);
  });

  it("rescues an admin who was missing from the members array", async () => {
    const ghostAdmin = new mongoose.Types.ObjectId().toString();
    const member = new mongoose.Types.ObjectId().toString();
    // Legacy inconsistency: in `admins` but never added to `members`.
    const groupId = await seedLegacyGroup([member], [ghostAdmin]);

    await migration26.up({ apply: true });

    const rows = await CommunityGroupMember.find({ groupId }).lean();
    assert.equal(rows.length, 2);
    const roles = new Map(
      rows.map((row: { userId: unknown; role: string }) => [String(row.userId), row.role])
    );
    assert.equal(roles.get(ghostAdmin), "ADMIN");
  });

  it("converges rather than doubling when run twice", async () => {
    const admin = new mongoose.Types.ObjectId().toString();
    const member = new mongoose.Types.ObjectId().toString();
    const groupId = await seedLegacyGroup([admin, member], [admin]);

    await migration26.up({ apply: true });
    await migration26.up({ apply: true });

    assert.equal(await CommunityGroupMember.countDocuments({ groupId }), 2);
    const group = await CommunityGroup.findById(groupId).lean();
    assert.equal(group.memberCount, 2);
  });

  it("only unsets the legacy arrays when asked", async () => {
    const admin = new mongoose.Types.ObjectId().toString();
    const groupId = await seedLegacyGroup([admin], [admin]);

    await migration26.up({ apply: true });
    let raw = await CommunityGroup.collection.findOne({
      _id: new mongoose.Types.ObjectId(groupId),
    });
    // Additive pass leaves the arrays alone so already-running old code keeps
    // working until the new build is live.
    assert.ok(Array.isArray(raw.members));

    await migration26.up({ apply: true, dropArrays: true });
    raw = await CommunityGroup.collection.findOne({
      _id: new mongoose.Types.ObjectId(groupId),
    });
    assert.equal(raw.members, undefined);
    assert.equal(raw.admins, undefined);
  });

  it("rebuilds the arrays on down", async () => {
    const admin = new mongoose.Types.ObjectId().toString();
    const member = new mongoose.Types.ObjectId().toString();
    const groupId = await seedLegacyGroup([admin, member], [admin]);

    await migration26.up({ apply: true, dropArrays: true });
    await migration26.down({ apply: true });

    const raw = await CommunityGroup.collection.findOne({
      _id: new mongoose.Types.ObjectId(groupId),
    });
    assert.equal(raw.members.length, 2);
    assert.equal(raw.admins.length, 1);
    assert.equal(String(raw.admins[0]), admin);
    assert.equal(await CommunityGroupMember.countDocuments({}), 0);
  });
});
