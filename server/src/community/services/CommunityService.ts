import {
  User,
} from "../../client/models/User";
import {
  CommunityAnswer,
} from "../models/CommunityAnswer";
import {
  CommunityConversation,
  CommunityConversationDocument,
} from "../models/CommunityConversation";
import {
  CommunityGroup,
} from "../models/CommunityGroup";
import {
  CommunityGroupMember,
} from "../models/CommunityGroupMember";
import {
  CommunityMessage,
} from "../models/CommunityMessage";
import {
  CommunityPost,
} from "../models/CommunityPost";
import {
  CommunityProfile,
} from "../models/CommunityProfile";
import {
  CommunityReport,
} from "../models/CommunityReport";
import {
  addMember,
  countMembers,
  isGroupAdmin,
  isGroupMember,
  listAdminIds,
} from "./communityGroupMembership";
import {
  ROLE_LABEL,
  canJoinGroupAudience,
  type CommunityGroupAudience,
} from "./communityPolicy";
import {
  COMMUNITY_DEFAULT_GROUP_AUDIENCE,
  assertConversationAccess,
  ensureProfile,
  formatParticipant,
  generateInviteCode,
  getCommunityRole,
  resolveUserPhotoUrl,
  sendCommunityNotification,
} from "./communityShared";
import mongoose from "mongoose";
import { communityContributionService } from "./communityContributionService";
import { communitySearchService } from "./communitySearchService";
import { communityFollowService } from "./communityFollowService";
import { communityQnaService } from "./communityQnaService";
import { communityProfileService } from "./communityProfileService";
import { communityGroupService } from "./communityGroupService";
import { communityChatService } from "./communityChatService";

/**
 * The community service, composed from per-domain modules.
 *
 * This was one 4,400-line object literal. The domain modules are spread in, so
 * `CommunityService.sendMessage(...)` and every other call site resolves
 * exactly as before — including `this`, which at call time is this composed
 * object.
 */
export const CommunityService = {
  ...communityContributionService,
  ...communitySearchService,
  ...communityFollowService,
  ...communityQnaService,
  ...communityProfileService,
  ...communityGroupService,
  ...communityChatService,

  async createReport(
    userId: string,
    payload: {
      targetType: "MESSAGE" | "GROUP" | "POST" | "ANSWER";
      targetId: string;
      reason: string;
      details?: string;
    },
  ) {
    await ensureProfile(userId);

    let messageAudit:
      | {
          senderId?: string;
          createdAt?: Date;
          updatedAt?: Date;
          editedAt?: Date | null;
          deletedAt?: Date | null;
          wasEdited: boolean;
          wasDeleted: boolean;
        }
      | undefined;

    if (payload.targetType === "MESSAGE") {
      const message = await CommunityMessage.findById(payload.targetId)
        .select("_id senderId createdAt updatedAt editedAt deletedAt isDeleted")
        .lean();
      if (!message) {
        throw new Error("message not found");
      }

      messageAudit = {
        senderId: String(message.senderId),
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
        editedAt: message.editedAt || null,
        deletedAt: message.deletedAt || null,
        wasEdited: Boolean(message.editedAt),
        wasDeleted: Boolean(message.isDeleted),
      };
    } else if (payload.targetType === "GROUP") {
      const group = await CommunityGroup.findById(payload.targetId)
        .select("_id")
        .lean();
      if (!group) {
        throw new Error("group not found");
      }
    } else if (payload.targetType === "POST") {
      const post = await CommunityPost.findById(payload.targetId)
        .select("_id")
        .lean();
      if (!post) {
        throw new Error("post not found");
      }
    } else {
      const answer = await CommunityAnswer.findById(payload.targetId)
        .select("_id")
        .lean();
      if (!answer) {
        throw new Error("answer not found");
      }
    }

    const report = await CommunityReport.create({
      reporterUserId: userId,
      targetType: payload.targetType,
      targetId: payload.targetId,
      reason: payload.reason.trim(),
      details: payload.details?.trim() || "",
      ...(messageAudit ? { messageAudit } : {}),
      status: "OPEN",
    });

    return {
      id: String(report._id),
      status: report.status,
      targetType: report.targetType,
      createdAt: report.createdAt,
    };
  },

  async listMyReports(userId: string, page = 1, limit = 20) {
    await ensureProfile(userId);

    const safePage = Math.max(1, page);
    const safeLimit = Math.min(100, Math.max(1, limit));
    const skip = (safePage - 1) * safeLimit;

    const [items, total] = await Promise.all([
      CommunityReport.find({ reporterUserId: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(safeLimit)
        .lean(),
      CommunityReport.countDocuments({ reporterUserId: userId }),
    ]);

    return {
      items: items.map((item) => ({
        id: String(item._id),
        targetType: item.targetType,
        targetId: String(item.targetId),
        reason: item.reason,
        details: item.details || "",
        status: item.status,
        resolutionNote: item.resolutionNote || "",
        createdAt: item.createdAt,
        reviewedAt: item.reviewedAt || null,
        messageAudit: item.messageAudit
          ? {
              senderId: item.messageAudit.senderId
                ? String(item.messageAudit.senderId)
                : undefined,
              createdAt: item.messageAudit.createdAt || null,
              updatedAt: item.messageAudit.updatedAt || null,
              editedAt: item.messageAudit.editedAt || null,
              deletedAt: item.messageAudit.deletedAt || null,
              wasEdited: Boolean(item.messageAudit.wasEdited),
              wasDeleted: Boolean(item.messageAudit.wasDeleted),
            }
          : undefined,
      })),
      pagination: {
        total,
        page: safePage,
        totalPages: Math.ceil(total / safeLimit),
      },
    };
  },

  async touchLastSeen(userId: string) {
    await CommunityProfile.updateOne(
      { userId },
      { $set: { lastSeenAt: new Date() } },
      { upsert: true },
    );
  },

  // Implementation lives in communityShared so the chat module can call it
  // without importing this file back — that would be a cycle. Kept exposed
  // here because controllers and the socket call it on the service.
  assertConversationAccess,

  formatSocketParticipant(
    selfId: string,
    participant: {
      _id: mongoose.Types.ObjectId;
      name: string;
      photoUrl?: string;
      profile?: {
        anonymousAlias: string;
        isIdentityPublic: boolean;
        lastSeenVisible: boolean;
        lastSeenAt?: Date;
      };
    },
  ) {
    return formatParticipant(selfId, participant);
  },

  async getParticipantIds(conversation: CommunityConversationDocument) {
    return conversation.participants.map((participantId) =>
      String(participantId),
    );
  },

  async getGroupMembers(userId: string, groupId: string) {
    await ensureProfile(userId);

    const group = await CommunityGroup.findById(groupId).select("_id").lean();
    if (!group) {
      throw new Error("Group not found");
    }

    if (!(await isGroupMember(groupId, userId))) {
      throw new Error("Access denied");
    }

    const memberRows = await CommunityGroupMember.find({ groupId })
      .select("userId role")
      .sort({ createdAt: 1 })
      .lean();

    const memberIds = memberRows.map((row) => String(row.userId));

    const [users, memberProfiles] = await Promise.all([
      User.find({ _id: { $in: memberIds } })
        .select("_id name photoUrl photoS3Key")
        .lean(),
      CommunityProfile.find({ userId: { $in: memberIds } })
        .select(
          "userId anonymousAlias isIdentityPublic photoUrl photoS3Key lastSeenAt",
        )
        .lean(),
    ]);

    const userMap = new Map(users.map((user) => [String(user._id), user]));
    const profileMap = new Map(
      memberProfiles.map((profile) => [String(profile.userId), profile]),
    );

    return Promise.all(
      memberRows.map(async (row) => {
        const memberId = String(row.userId);
        const member = userMap.get(memberId);
        const profile = profileMap.get(memberId);
        const isIdentityPublic = profile?.isIdentityPublic ?? true;

        return {
          id: memberId,
          name: member?.name || "Unknown",
          displayName: isIdentityPublic
            ? member?.name || "Unknown"
            : profile?.anonymousAlias || "Anonymous",
          photoUrl:
            isIdentityPublic && member
              ? await resolveUserPhotoUrl(member)
              : null,
          isIdentityPublic,
          alias: profile?.anonymousAlias || "Anonymous",
          role: row.role,
        };
      }),
    );
  },

  async joinGroupByCode(userId: string, inviteCode: string) {
    await ensureProfile(userId);
    const userRole = await getCommunityRole(userId);

    const group = await CommunityGroup.findOne({
      inviteCode: inviteCode.trim(),
    });

    if (!group) {
      throw new Error("Invalid invite code");
    }

    const groupAudience =
      (group.audience as CommunityGroupAudience | undefined) ||
      COMMUNITY_DEFAULT_GROUP_AUDIENCE;
    if (!canJoinGroupAudience(groupAudience, userRole)) {
      const userRoleLabel = ROLE_LABEL[userRole] || userRole;
      const audienceLabel =
        groupAudience === "PLAYERS_ONLY" ? "players" : "coaches";
      throw new Error(
        `This group is for ${audienceLabel} only. As a ${userRoleLabel}, you cannot join this group.`,
      );
    }

    const groupId = String(group._id);
    const alreadyMember = await isGroupMember(groupId, userId);
    if (alreadyMember) {
      // Already a member, just return the group info
      const conversation = await CommunityConversation.findOne({
        conversationType: "GROUP",
        groupId: group._id,
      });

      return {
        groupId,
        conversationId: String(conversation?._id || ""),
        memberCount: await countMembers(groupId),
      };
    }

    // An invite code is the way into an INVITE_ONLY or PRIVATE group, so no
    // visibility check here — holding the code is the permission.
    await addMember(groupId, userId);

    const conversation = await CommunityConversation.findOneAndUpdate(
      { conversationType: "GROUP", groupId: group._id },
      {
        $setOnInsert: {
          conversationType: "GROUP",
          groupId: group._id,
          status: "ACTIVE",
          requestedBy: group.createdBy,
          lastMessageAt: new Date(),
        },
        $addToSet: {
          participants: new mongoose.Types.ObjectId(userId),
        },
      },
      { upsert: true, new: true },
    );

    const adminIds = (await listAdminIds(groupId)).filter(
      (adminId) => adminId !== userId,
    );

    for (const adminId of adminIds) {
      sendCommunityNotification(
        adminId,
        "New member joined via invite",
        `A member joined ${group.name} using an invite code.`,
        {
          event: "COMMUNITY_GROUP_JOINED",
          groupId: String(group._id),
          conversationId: String(conversation?._id || ""),
          actorUserId: userId,
        },
      );
    }

    return {
      groupId,
      conversationId: String(conversation?._id || ""),
      memberCount: await countMembers(groupId),
    };
  },

  async getGroupInviteCode(userId: string, groupId: string) {
    await ensureProfile(userId);

    const group = await CommunityGroup.findById(groupId);

    if (!group) {
      throw new Error("Group not found");
    }

    if (!(await isGroupAdmin(groupId, userId))) {
      throw new Error("Only group admins can get invite code");
    }

    let inviteCode =
      typeof group.inviteCode === "string" ? group.inviteCode.trim() : "";
    if (!inviteCode) {
      do {
        inviteCode = generateInviteCode();
      } while (await CommunityGroup.exists({ inviteCode }));

      group.inviteCode = inviteCode;
      await group.save();
    }

    return {
      groupId: String(group._id),
      inviteCode,
    };
  },

  async getCommunityPulseStats() {
    const [postsCount, groupsCount] = await Promise.all([
      CommunityPost.countDocuments(),
      CommunityGroup.countDocuments(),
    ]);
    const totalActivity = postsCount + groupsCount * 12;
    return totalActivity > 0 ? totalActivity : 1280;
  },
};
