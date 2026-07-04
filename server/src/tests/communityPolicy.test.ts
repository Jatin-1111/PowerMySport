import assert from "node:assert/strict";
import test from "node:test";
import {
  canJoinGroupAudience,
  getCommunityInteractionPolicy,
  isCrossRoleInteraction,
} from "../community/services/communityPolicy";

test("community policy defaults to enabled cross-role interactions", () => {
  const policy = getCommunityInteractionPolicy({});

  assert.equal(policy.allowCrossRoleDm, true);
  assert.equal(policy.allowCrossRoleGroupMembership, true);
  assert.equal(policy.allowCrossRoleQna, true);
});

test("community policy supports explicit disable flags", () => {
  const policy = getCommunityInteractionPolicy({
    COMMUNITY_ALLOW_CROSS_ROLE_DM: "false",
    COMMUNITY_ALLOW_CROSS_ROLE_GROUP_MEMBERSHIP: "0",
    COMMUNITY_ALLOW_CROSS_ROLE_QNA: "off",
  });

  assert.equal(policy.allowCrossRoleDm, false);
  assert.equal(policy.allowCrossRoleGroupMembership, false);
  assert.equal(policy.allowCrossRoleQna, false);
});

test("community policy supports explicit enable flags", () => {
  const policy = getCommunityInteractionPolicy({
    COMMUNITY_ALLOW_CROSS_ROLE_DM: "yes",
    COMMUNITY_ALLOW_CROSS_ROLE_GROUP_MEMBERSHIP: "on",
    COMMUNITY_ALLOW_CROSS_ROLE_QNA: "1",
  });

  assert.equal(policy.allowCrossRoleDm, true);
  assert.equal(policy.allowCrossRoleGroupMembership, true);
  assert.equal(policy.allowCrossRoleQna, true);
});

test("cross-role interaction helper returns expected values", () => {
  assert.equal(isCrossRoleInteraction("Player", "Coach"), true);
  assert.equal(isCrossRoleInteraction("Player", "Player"), false);
});

test("group audience helper enforces audience membership rules", () => {
  assert.equal(canJoinGroupAudience("ALL", "Player"), true);
  assert.equal(canJoinGroupAudience("ALL", "Coach"), true);
  assert.equal(canJoinGroupAudience("PLAYERS_ONLY", "Player"), true);
  assert.equal(canJoinGroupAudience("PLAYERS_ONLY", "Coach"), false);
  assert.equal(canJoinGroupAudience("COACHES_ONLY", "Coach"), true);
  assert.equal(canJoinGroupAudience("COACHES_ONLY", "Player"), false);
});
