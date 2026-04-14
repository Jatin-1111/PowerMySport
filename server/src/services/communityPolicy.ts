export type CommunityRole = "PLAYER" | "COACH";
export type CommunityGroupAudience = "ALL" | "PLAYERS_ONLY" | "COACHES_ONLY";

export type CommunityInteractionPolicy = {
  allowCrossRoleDm: boolean;
  allowCrossRoleGroupMembership: boolean;
  allowCrossRoleQna: boolean;
};

export const ROLE_LABEL: Record<CommunityRole, string> = {
  PLAYER: "player",
  COACH: "coach",
};

const parseBooleanFlag = (
  value: string | undefined,
  defaultValue: boolean,
): boolean => {
  if (typeof value !== "string") {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }

  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }

  return defaultValue;
};

export const getCommunityInteractionPolicy = (
  env: NodeJS.ProcessEnv = process.env,
): CommunityInteractionPolicy => ({
  allowCrossRoleDm: parseBooleanFlag(env.COMMUNITY_ALLOW_CROSS_ROLE_DM, true),
  allowCrossRoleGroupMembership: parseBooleanFlag(
    env.COMMUNITY_ALLOW_CROSS_ROLE_GROUP_MEMBERSHIP,
    true,
  ),
  allowCrossRoleQna: parseBooleanFlag(env.COMMUNITY_ALLOW_CROSS_ROLE_QNA, true),
});

export const COMMUNITY_INTERACTION_POLICY = getCommunityInteractionPolicy();

export const isCrossRoleInteraction = (
  a: CommunityRole,
  b: CommunityRole,
): boolean => a !== b;

export const canJoinGroupAudience = (
  audience: CommunityGroupAudience,
  role: CommunityRole,
): boolean => {
  if (audience === "ALL") {
    return true;
  }

  if (audience === "PLAYERS_ONLY") {
    return role === "PLAYER";
  }

  return role === "COACH";
};
