import mongoose from "mongoose";
import {
  CommunityConversation,
  CommunityConversationDocument,
} from "../models/CommunityConversation";
import {
  CommunityGroup,
  type CommunityGroupVisibility,
} from "../models/CommunityGroup";
import {
  CommunityMessage,
  type CommunityMessageType,
} from "../models/CommunityMessage";
import { CommunityMessageReaction } from "../models/CommunityMessageReaction";
import {
  CommunityMessagePrivacy,
  CommunityProfile,
} from "../models/CommunityProfile";
import { User } from "../../client/models/User";
import { CommunityReport } from "../models/CommunityReport";
import { CommunityPost } from "../models/CommunityPost";
import { CommunityAnswer } from "../models/CommunityAnswer";
import { CommunityAnswerComment } from "../models/CommunityAnswerComment";
import { BlogPost } from "../models/BlogPost";
import { CommunityVote } from "../models/CommunityVote";
import { CommunityReputation } from "../models/CommunityReputation";
import {
  CommunityFollow,
  type CommunityFollowKind,
} from "../models/CommunityFollow";
import { NotificationService } from "../../client/services/NotificationService";
import OutboxMessage from "../../shared/models/OutboxMessage";
import { S3Service } from "../../shared/services/S3Service";
import {
  canJoinGroupAudience,
  COMMUNITY_INTERACTION_POLICY,
  isCrossRoleInteraction,
  ROLE_LABEL,
  type CommunityGroupAudience,
  type CommunityRole,
} from "./communityPolicy";
import { getVoteTransitionDeltas, normalizeTags } from "./communityQnaUtils";
import { resolveCommunityCredentials } from "./communityCredentials";
import {
  addMember,
  countMembers,
  getMemberRole,
  ensureGroupHasAdmin,
  isGroupAdmin,
  isGroupMember,
  listAdminIds,
  listMemberIds,
  membershipMapFor,
  removeAllMembers,
  removeMember,
} from "./communityGroupMembership";
import { CommunityGroupMember } from "../models/CommunityGroupMember";
import { log as __rootLog } from "../../utils/logger";
const log = __rootLog.child("communityShared");

/**
 * Shared building blocks for the community services.
 *
 * These were module-level helpers inside a single 4,400-line CommunityService.
 * Exporting them here lets each domain service own its own file while sharing
 * one definition of "what is this user's role", "may these two interact" and
 * "how do we render an author".
 *
 * Nothing here reaches back into a domain service — that would reintroduce the
 * cycle this split exists to avoid.
 */
export const buildParticipantKey = (a: string, b: string): string =>
  [a, b].sort().join(":");

export const buildGroupParticipantKey = (groupId: string): string =>
  `group:${groupId}`;

export const normalizeOptionalText = (value?: string): string => value?.trim() || "";

/** Blog bodies are Tiptap HTML; a search snippet must not render markup or
 *  leak tag names into the preview text. */
export const stripHtml = (value: string): string =>
  value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();

export const clampForSnippet = (value: string, max = 180): string => {
  const text = stripHtml(value || "");
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}...`;
};

/** A one-line stand-in for a message with no text of its own. Returns "" for
 *  TEXT so callers can fall back to the actual body. Never returns `content`
 *  for the attachment kinds — that field holds the S3 object key. */
/** Mongoose materialises the nested `metadata` path even when nothing was set,
 *  yielding an object of undefined keys. Collapse that to null so clients can
 *  test for presence rather than inspecting every field. */
export const normalizeMessageMetadata = <T extends Record<string, unknown>>(
  metadata?: T | null,
): T | null => {
  if (!metadata) {
    return null;
  }
  const hasValue = Object.values(metadata).some(
    (value) => value !== undefined && value !== null,
  );
  return hasValue ? metadata : null;
};

export const describeNonTextMessage = (
  type: string | undefined,
  metadata?: { fileName?: string; durationMs?: number } | null,
): string => {
  if (type === "IMAGE") {
    return "Photo";
  }
  if (type === "VOICE") {
    const seconds = Math.round((metadata?.durationMs || 0) / 1000);
    return seconds > 0 ? `Voice message (${seconds}s)` : "Voice message";
  }
  if (type === "FILE") {
    return metadata?.fileName || "File";
  }
  return "";
};

export const MAX_FOLLOWS_PER_USER = 200;

/** Topics are free text and must match the tag normalization used when a post
 *  is saved, or `#Tennis` and `#tennis` become two different follows. Groups
 *  are ObjectIds and are validated as such so a junk id cannot be stored. */
export const normalizeFollowTargetId = (
  kind: CommunityFollowKind,
  rawTargetId: string,
): string => {
  const value = String(rawTargetId || "").trim();

  if (kind === "GROUP") {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new Error("Invalid group id");
    }
    return value;
  }

  const topic = value.toLowerCase();
  if (!topic || topic.length > 40) {
    throw new Error("Invalid topic");
  }
  return topic;
};

// Supports multi-select filters sent as a comma-separated list (e.g. "Tennis,Cricket").
export const splitCsvValues = (value?: string): string[] => {
  if (!value) return [];
  return Array.from(
    new Set(
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
};

export const escapeRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const MESSAGE_EDIT_DELETE_WINDOW_MS = 30 * 60 * 1000;
export const COMMUNITY_ALLOWED_ROLES = ["Parent"] as const;
export const COMMUNITY_DEFAULT_GROUP_AUDIENCE = "ALL" as const;
export const COMMUNITY_POINTS = {
  CREATE_POST: 5,
  CREATE_ANSWER: 8,
  RECEIVE_UPVOTE: 2,
  ANSWER_ACCEPTED: 15,
} as const;

export const s3Service = new S3Service();

export const resolveUserPhotoUrl = async (user?: {
  photoUrl?: string | null;
  photoS3Key?: string | null;
}): Promise<string | null> => {
  if (!user) {
    return null;
  }

  if (!user.photoS3Key) {
    return user.photoUrl || null;
  }

  try {
    return await s3Service.generateDownloadUrl(
      user.photoS3Key,
      "images",
      604800,
    );
  } catch (error) {
    log.error("Failed to refresh community photo URL:", error);
    return user.photoUrl || null;
  }
};

export const resolveGroupPhotoUrl = async (group: {
  profilePicture?: string | null;
  profilePictureKey?: string | null;
}): Promise<string> => {
  if (!group.profilePictureKey) {
    return group.profilePicture || "";
  }

  try {
    return await s3Service.generateDownloadUrl(
      group.profilePictureKey,
      "images",
      604800,
    );
  } catch (error) {
    log.error("Failed to refresh community group photo URL:", error);
    return group.profilePicture || "";
  }
};

export const calculateAge = (dob?: Date | string | null): number | null => {
  if (!dob) {
    return null;
  }

  const birthDate = new Date(dob);
  if (Number.isNaN(birthDate.getTime())) {
    return null;
  }

  const ageDate = new Date(Date.now() - birthDate.getTime());
  return Math.abs(ageDate.getUTCFullYear() - 1970);
};

export const makeDefaultAlias = (name?: string): string => {
  const seed = Math.floor(1000 + Math.random() * 9000);
  const safeName = name?.trim().split(" ")[0] || "Member";
  return `${safeName}-${seed}`;
};

export const generateInviteCode = (): string => {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let code = "";
  for (let i = 0; i < 12; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export const getCommunityRole = async (userId: string): Promise<CommunityRole> => {
  const user = await ensureCommunityUser(userId);
  return user.role as CommunityRole;
};

export const ensurePolicyAllowed = (policyEnabled: boolean, message: string): void => {
  if (!policyEnabled) {
    throw new Error(message);
  }
};

export const trackCommunityRoleMixEvent = (
  event: string,
  payload: Record<string, unknown>,
) => {
  // Phase-3 telemetry hook: swap with analytics sink when available.
  log.info("[community-role-mix]", event, payload);
};

/** Accepted-answer points, applied in both directions so un-accepting and
 *  re-accepting cannot be farmed. Floors at zero — a historical accept that
 *  predates this counter must not push someone negative. */
export const adjustAcceptedAnswerReputation = async (
  userId: string,
  direction: 1 | -1,
): Promise<void> => {
  const delta = direction * COMMUNITY_POINTS.ANSWER_ACCEPTED;

  if (delta < 0) {
    const current = await CommunityReputation.findOne({ userId })
      .select("totalPoints")
      .lean();
    const safeDelta = Math.max(delta, -(current?.totalPoints || 0));
    if (safeDelta === 0) {
      return;
    }
    await CommunityReputation.updateOne(
      { userId },
      { $inc: { totalPoints: safeDelta } },
    );
    return;
  }

  await CommunityReputation.updateOne(
    { userId },
    {
      $setOnInsert: { questionCount: 0, answerCount: 0, receivedUpvotes: 0 },
      $inc: { totalPoints: delta },
    },
    { upsert: true },
  );
};

export const sendCommunityNotification = (
  userId: string,
  title: string,
  message: string,
  data: Record<string, unknown>,
) => {
  NotificationService.send({
    userId,
    type: "MESSAGE_RECEIVED",
    title,
    message,
    data,
  }).catch((error: unknown) => {
    log.error("Failed to send community notification:", error);
  });
};

export const ensureQnaAllowedForRole = (role: CommunityRole): void => {
  ensurePolicyAllowed(
    COMMUNITY_INTERACTION_POLICY.allowCrossRoleQna,
    `Q&A participation is currently disabled for ${ROLE_LABEL[role]} accounts`,
  );
};

export const ensureCommunityUser = async (userId: string) => {
  const user = await User.findById(userId).select("_id role name").lean();
  if (!user) {
    throw new Error("User not found");
  }

  if (
    !COMMUNITY_ALLOWED_ROLES.includes(
      user.role as (typeof COMMUNITY_ALLOWED_ROLES)[number],
    )
  ) {
    throw new Error(
      "Community is available only for parent accounts",
    );
  }

  return user;
};

export const isDuplicateKeyError = (error: unknown): boolean =>
  Boolean((error as { code?: number })?.code === 11000);

export const ensureProfile = async (userId: string) => {
  const user = await ensureCommunityUser(userId);

  try {
    const profile = await CommunityProfile.findOneAndUpdate(
      { userId },
      {
        $setOnInsert: {
          userId,
          anonymousAlias: makeDefaultAlias(user.name),
        },
      },
      { upsert: true, new: true },
    );

    if (!profile) {
      throw new Error("Failed to initialize community profile");
    }

    return profile;
  } catch (error) {
    if (!isDuplicateKeyError(error)) {
      throw error;
    }

    const existingProfile = await CommunityProfile.findOne({ userId });
    if (existingProfile) {
      return existingProfile;
    }

    throw new Error("Failed to initialize community profile");
  }
};

/**
 * Public read endpoints run behind optionalAuthMiddleware, which only verifies
 * the JWT signature — it never checks that the user still exists or that their
 * role can use the community. A stale token (deleted account, token minted
 * against another database) or a non-community role (Admin, VenueLister,
 * Expert…) would otherwise make ensureProfile throw and blank out a page that
 * is meant to render for guests. Downgrade those viewers to guest instead.
 */
export const resolvePublicViewerId = async (
  userId: string | undefined,
): Promise<string | undefined> => {
  if (!userId) {
    return undefined;
  }

  try {
    await ensureProfile(userId);
    return userId;
  } catch {
    return undefined;
  }
};

export const isBlockedBetween = async (
  userA: string,
  userB: string,
): Promise<boolean> => {
  const [a, b] = await Promise.all([
    CommunityProfile.findOne({ userId: userA }).select("blockedUsers"),
    CommunityProfile.findOne({ userId: userB }).select("blockedUsers"),
  ]);

  const aBlockedB = Boolean(
    a?.blockedUsers?.some((blocked) => String(blocked) === userB),
  );
  const bBlockedA = Boolean(
    b?.blockedUsers?.some((blocked) => String(blocked) === userA),
  );

  return aBlockedB || bBlockedA;
};

/**
 * Every read or write inside a conversation goes through this.
 */
export const assertConversationAccess = async (
  userId: string,
  conversationId: string,
) => {
  const conversation = await CommunityConversation.findById(conversationId);
  if (!conversation) {
    throw new Error("Conversation not found");
  }

  const isParticipant = conversation.participants.some(
    (participantId) => String(participantId) === userId,
  );
  if (!isParticipant) {
    throw new Error("Access denied");
  }

  return conversation;
};

export const formatParticipant = (
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
) => {
  const profile = participant.profile;
  const isSelf = String(participant._id) === selfId;

  return {
    id: String(participant._id),
    displayName: isSelf
      ? participant.name
      : profile?.isIdentityPublic
        ? participant.name
        : profile?.anonymousAlias || "Anonymous Member",
    isIdentityPublic: profile?.isIdentityPublic ?? true,
    photoUrl:
      !isSelf && profile?.isIdentityPublic ? participant.photoUrl : null,
    lastSeenAt: profile?.lastSeenVisible ? profile?.lastSeenAt || null : null,
  };
};
