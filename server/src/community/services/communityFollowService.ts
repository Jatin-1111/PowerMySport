import {
  CommunityFollow,
  type CommunityFollowKind,
} from "../models/CommunityFollow";
import {
  CommunityGroup,
} from "../models/CommunityGroup";
import {
  MAX_FOLLOWS_PER_USER,
  ensureProfile,
  normalizeFollowTargetId,
} from "./communityShared";
import mongoose from "mongoose";
import { log as __rootLog } from "../../utils/logger";
const log = __rootLog.child("communityFollow");

/**
 * Followed groups and topics.
 *
 * Split out of CommunityService, which had grown to 4,400 lines. Composed back
 * into that object, so every existing `CommunityService.x()` call site is
 * unchanged.
 */
export const communityFollowService = {
  async listFollows(userId: string) {
    const follows = await CommunityFollow.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    const groupIds = follows
      .filter((follow) => follow.kind === "GROUP")
      .map((follow) => follow.targetId)
      .filter((id) => mongoose.Types.ObjectId.isValid(id));

    const groups = groupIds.length
      ? await CommunityGroup.find({ _id: { $in: groupIds } })
          .select("_id name")
          .lean()
      : [];

    const groupNameById = new Map(
      groups.map((group) => [String(group._id), group.name]),
    );

    const items: {
      kind: CommunityFollowKind;
      targetId: string;
      label: string;
      href: string;
      createdAt: string;
    }[] = [];
    const staleIds: mongoose.Types.ObjectId[] = [];

    for (const follow of follows) {
      if (follow.kind === "TOPIC") {
        items.push({
          kind: "TOPIC",
          targetId: follow.targetId,
          label: `#${follow.targetId}`,
          href: `/questions?tag=${encodeURIComponent(follow.targetId)}`,
          createdAt: follow.createdAt.toISOString(),
        });
        continue;
      }

      const name = groupNameById.get(follow.targetId);
      if (!name) {
        // The group was deleted out from under the follow. Drop the row rather
        // than render a tile that goes nowhere.
        staleIds.push(follow._id as mongoose.Types.ObjectId);
        continue;
      }

      items.push({
        kind: "GROUP",
        targetId: follow.targetId,
        label: name,
        href: "/discover?tab=COMMUNITIES",
        createdAt: follow.createdAt.toISOString(),
      });
    }

    if (staleIds.length) {
      void CommunityFollow.deleteMany({ _id: { $in: staleIds } }).catch(
        (error: unknown) => {
          log.error("Failed to prune stale community follows:", error);
        },
      );
    }

    return { items };
  },

  async toggleFollow(
    userId: string,
    payload: { kind: CommunityFollowKind; targetId: string },
  ): Promise<{ following: boolean }> {
    await ensureProfile(userId);

    const targetId = normalizeFollowTargetId(payload.kind, payload.targetId);

    const existing = await CommunityFollow.findOneAndDelete({
      userId,
      kind: payload.kind,
      targetId,
    });

    if (existing) {
      return { following: false };
    }

    const total = await CommunityFollow.countDocuments({ userId });
    if (total >= MAX_FOLLOWS_PER_USER) {
      throw new Error(
        `You can follow at most ${MAX_FOLLOWS_PER_USER} groups and topics`,
      );
    }

    await CommunityFollow.updateOne(
      { userId, kind: payload.kind, targetId },
      { $setOnInsert: { userId, kind: payload.kind, targetId } },
      { upsert: true },
    );

    return { following: true };
  },

  /**
   * One-shot import of the follows a user accumulated in localStorage before
   * follows were persisted. Idempotent, so a client that retries — or a user
   * with two browsers — merges rather than duplicates.
   */
  async importFollows(
    userId: string,
    items: { kind: CommunityFollowKind; targetId: string }[],
  ): Promise<{ imported: number }> {
    await ensureProfile(userId);

    const existingCount = await CommunityFollow.countDocuments({ userId });
    const room = Math.max(0, MAX_FOLLOWS_PER_USER - existingCount);
    if (room === 0) {
      return { imported: 0 };
    }

    const seen = new Set<string>();
    const operations: Parameters<typeof CommunityFollow.bulkWrite>[0] = [];

    for (const item of items) {
      let targetId: string;
      try {
        targetId = normalizeFollowTargetId(item.kind, item.targetId);
      } catch {
        // A single bad row from an old client must not fail the whole import.
        continue;
      }

      const key = `${item.kind}:${targetId}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      operations.push({
        updateOne: {
          filter: { userId, kind: item.kind, targetId },
          update: { $setOnInsert: { userId, kind: item.kind, targetId } },
          upsert: true,
        },
      });

      if (operations.length >= room) {
        break;
      }
    }

    if (operations.length === 0) {
      return { imported: 0 };
    }

    const result = await CommunityFollow.bulkWrite(operations, {
      ordered: false,
    });

    return { imported: result.upsertedCount || 0 };
  },
};
