import {
  User,
} from "../../client/models/User";
import {
  CommunityMessagePrivacy,
  CommunityProfile,
} from "../models/CommunityProfile";
import {
  COMMUNITY_ALLOWED_ROLES,
  calculateAge,
  ensureCommunityUser,
  ensureProfile,
  escapeRegex,
  resolveUserPhotoUrl,
} from "./communityShared";

/**
 * Community profiles, player search and blocking.
 *
 * Split out of CommunityService, which had grown to 4,400 lines. Composed back
 * into that object, so every existing `CommunityService.x()` call site is
 * unchanged.
 */
export const communityProfileService = {
  async searchPlayers(
    userId: string,
    query: string,
    limit = 10,
    roleFilter?: string,
  ) {
    const normalizedQuery = query.trim();
    if (!normalizedQuery && !roleFilter) {
      return [];
    }

    const safeLimit = Math.min(20, Math.max(1, limit));
    // Read-only: this only needs the caller's role (to gate community access)
    // and their existing blockedUsers list, if any — never a reason to
    // create a profile. `ensureProfile`'s upsert-write would otherwise fire
    // on every debounced keystroke of an as-you-type search.
    await ensureCommunityUser(userId);
    const myProfile = await CommunityProfile.findOne({ userId })
      .select("blockedUsers")
      .lean();
    const myBlockedUsers = myProfile?.blockedUsers || [];

    const userMatchCriteria: any = {
      _id: { $ne: userId },
      role: roleFilter ? roleFilter : { $in: COMMUNITY_ALLOWED_ROLES },
    };
    if (normalizedQuery) {
      userMatchCriteria.name = new RegExp(escapeRegex(normalizedQuery), "i");
    }

    const profileMatchCriteria: any = { userId: { $ne: userId } };
    if (normalizedQuery) {
      profileMatchCriteria.anonymousAlias = new RegExp(
        escapeRegex(normalizedQuery),
        "i",
      );
    }

    const [nameMatches, aliasMatches] = await Promise.all([
      User.find(userMatchCriteria)
        .select("_id name photoUrl photoS3Key")
        .limit(safeLimit * 3)
        .lean(),
      normalizedQuery
        ? CommunityProfile.find(profileMatchCriteria)
            .select("userId")
            .limit(safeLimit * 3)
            .lean()
        : Promise.resolve([]),
    ]);

    const candidateIds = new Set<string>();
    for (const user of nameMatches) {
      candidateIds.add(String(user._id));
    }
    for (const match of aliasMatches) {
      candidateIds.add(String(match.userId));
    }

    const ids = Array.from(candidateIds);
    if (!ids.length) {
      return [];
    }

    const [users, profiles] = await Promise.all([
      User.find({ _id: { $in: ids }, role: { $in: COMMUNITY_ALLOWED_ROLES } })
        .select("_id name photoUrl photoS3Key role city dob")
        .lean(),
      CommunityProfile.find({ userId: { $in: ids } })
        .select("userId anonymousAlias isIdentityPublic blockedUsers")
        .lean(),
    ]);

    const blockedByMe = new Set(myBlockedUsers.map((id) => String(id)));
    const profileMap = new Map(profiles.map((p) => [String(p.userId), p]));

    const items = await Promise.all(
      users
        .filter((user) => {
          const candidateId = String(user._id);
          if (blockedByMe.has(candidateId)) {
            return false;
          }

          const candidateProfile = profileMap.get(candidateId);
          const blockedMe = Boolean(
            candidateProfile?.blockedUsers?.some(
              (blockedUserId) => String(blockedUserId) === userId,
            ),
          );

          return !blockedMe;
        })
        .map((user) => {
          const candidateId = String(user._id);
          const candidateProfile = profileMap.get(candidateId);
          const isIdentityPublic = candidateProfile?.isIdentityPublic ?? true;
          const displayName = isIdentityPublic
            ? user.name
            : candidateProfile?.anonymousAlias || "Anonymous Member";
          const sports: string[] = [];

          return {
            id: candidateId,
            displayName,
            isIdentityPublic,
            role: user.role,
            photoUrl: null,
            city: typeof user.city === "string" ? user.city.trim() : null,
            age: calculateAge(user.dob),
            sports,
          };
        })
        .sort((a, b) => a.displayName.localeCompare(b.displayName))
        .slice(0, safeLimit),
    ).then((items) =>
      Promise.all(
        items.map(async (item) => ({
          ...item,
          photoUrl: item.id
            ? await resolveUserPhotoUrl(
                users.find((user) => String(user._id) === item.id),
              )
            : null,
        })),
      ),
    );

    return items;
  },

  async getPlayerProfile(viewerId: string, targetUserId: string) {
    if (!targetUserId) {
      throw new Error("Player not found");
    }

    await ensureProfile(viewerId);

    const [targetUser, targetProfile] = await Promise.all([
      User.findById(targetUserId)
        .select(
          "_id name photoUrl photoS3Key role dob city createdAt lastActiveAt",
        )
        .lean(),
      CommunityProfile.findOne({ userId: targetUserId })
        .select(
          "userId anonymousAlias isIdentityPublic messagePrivacy readReceiptsEnabled lastSeenVisible lastSeenAt blockedUsers",
        )
        .lean(),
    ]);

    const targetRole = targetUser?.role as
      (typeof COMMUNITY_ALLOWED_ROLES)[number] | undefined;

    if (
      !targetUser ||
      !targetRole ||
      !COMMUNITY_ALLOWED_ROLES.includes(targetRole)
    ) {
      throw new Error("Player not found");
    }

    if (
      targetProfile?.blockedUsers?.some(
        (blockedId) => String(blockedId) === viewerId,
      )
    ) {
      throw new Error("Access denied");
    }

    const profile = targetProfile || {
      anonymousAlias: "Anonymous Member",
      isIdentityPublic: true,
      messagePrivacy: "EVERYONE" as const,
      readReceiptsEnabled: true,
      lastSeenVisible: false,
      lastSeenAt: undefined,
    };
    const isSelf = targetUserId === viewerId;
    const isIdentityPublic = isSelf || Boolean(profile.isIdentityPublic);

    return {
      id: String(targetUser._id),
      role: targetUser.role,
      displayName: isIdentityPublic
        ? targetUser.name
        : profile.anonymousAlias || "Anonymous Member",
      alias: profile.anonymousAlias || "Anonymous Member",
      isIdentityPublic,
      photoUrl: await resolveUserPhotoUrl(targetUser),
      sports: [],
      city: typeof targetUser.city === "string" ? targetUser.city.trim() : null,
      age: calculateAge(targetUser.dob),
      dob: isIdentityPublic ? targetUser.dob || null : null,
      createdAt: targetUser.createdAt,
      lastActiveAt:
        isIdentityPublic || Boolean(profile.lastSeenVisible)
          ? targetUser.lastActiveAt || null
          : null,
      messagePrivacy: profile.messagePrivacy,
      readReceiptsEnabled: Boolean(profile.readReceiptsEnabled),
      lastSeenVisible: Boolean(profile.lastSeenVisible),
      lastSeenAt: profile.lastSeenVisible ? profile.lastSeenAt || null : null,
    };
  },

  async getMyProfile(userId: string) {
    const profile = await ensureProfile(userId);
    return profile.toObject();
  },

  async updateMyProfile(
    userId: string,
    payload: {
      isIdentityPublic?: boolean;
      messagePrivacy?: CommunityMessagePrivacy;
      readReceiptsEnabled?: boolean;
      lastSeenVisible?: boolean;
      anonymousAlias?: string;
    },
  ) {
    const profile = await ensureProfile(userId);

    if (typeof payload.isIdentityPublic === "boolean") {
      profile.isIdentityPublic = payload.isIdentityPublic;
    }

    if (payload.messagePrivacy) {
      profile.messagePrivacy = payload.messagePrivacy;
    }

    if (typeof payload.readReceiptsEnabled === "boolean") {
      profile.readReceiptsEnabled = payload.readReceiptsEnabled;
    }

    if (typeof payload.lastSeenVisible === "boolean") {
      profile.lastSeenVisible = payload.lastSeenVisible;
    }

    if (payload.anonymousAlias?.trim()) {
      profile.anonymousAlias = payload.anonymousAlias.trim();
    }

    await profile.save();
    return profile.toObject();
  },

  async blockUser(userId: string, targetUserId: string) {
    if (userId === targetUserId) {
      throw new Error("You cannot block yourself");
    }

    await Promise.all([
      ensureProfile(userId),
      ensureCommunityUser(targetUserId),
    ]);

    await CommunityProfile.updateOne(
      { userId },
      { $addToSet: { blockedUsers: targetUserId } },
    );

    return { blockedUserId: targetUserId };
  },

  async unblockUser(userId: string, targetUserId: string) {
    await ensureProfile(userId);

    await CommunityProfile.updateOne(
      { userId },
      { $pull: { blockedUsers: targetUserId } },
    );

    return { unblockedUserId: targetUserId };
  },

  async getBlockedUsers(userId: string) {
    const profile = await ensureProfile(userId);
    const users = await User.find({ _id: { $in: profile.blockedUsers } })
      .select("_id name photoUrl photoS3Key")
      .lean();

    return Promise.all(
      users.map(async (user) => ({
        id: String(user._id),
        name: user.name,
        photoUrl: await resolveUserPhotoUrl(user),
      })),
    );
  },
};
