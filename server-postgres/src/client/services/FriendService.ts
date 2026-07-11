import prisma from "../../lib/prisma";
import type { FriendConnection } from "@prisma/client";
import { S3Service } from "../../shared/services/S3Service";
import { buildSafeSearchRegexSource } from "../../utils/regex";

type UserWithPhoto = {
  photoUrl?: string | null;
  photoS3Key?: string | null;
};

export class FriendService {
  private readonly s3Service = new S3Service();

  private async resolvePhotoUrl(
    user: UserWithPhoto,
  ): Promise<string | undefined> {
    if (!user.photoS3Key) {
      return user.photoUrl ?? undefined;
    }

    try {
      return await this.s3Service.generateDownloadUrl(
        user.photoS3Key,
        "images",
        3600,
      );
    } catch (error) {
      console.error("Failed to regenerate friend photo URL:", error);
      return user.photoUrl ?? undefined;
    }
  }

  /**
   * Send a friend request
   */
  async sendFriendRequest(
    requesterId: string,
    recipientId: string,
  ): Promise<FriendConnection> {
    // No-self-friend guard (was a Mongoose pre-save hook).
    if (requesterId === recipientId) {
      throw new Error("Cannot send friend request to yourself");
    }

    // Check if recipient exists and is a PLAYER
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
    });
    if (!recipient) {
      throw new Error("User not found");
    }
    if (recipient.role !== "Player") {
      throw new Error("Can only send friend requests to players");
    }

    // Check if requester is a PLAYER
    const requester = await prisma.user.findUnique({
      where: { id: requesterId },
    });
    if (!requester || requester.role !== "Player") {
      throw new Error("Only players can send friend requests");
    }

    // Check if recipient has blocked the requester
    const recipientProfile = await prisma.communityProfile.findUnique({
      where: { userId: recipientId },
      include: { blockedUsers: true },
    });
    if (
      recipientProfile?.blockedUsers?.some(
        (b) => b.blockedUserId === requesterId,
      )
    ) {
      throw new Error("Cannot send friend request to this user");
    }

    // Check for existing connection in either direction
    const existingConnection = await prisma.friendConnection.findFirst({
      where: {
        OR: [
          { requesterId, recipientId },
          { requesterId: recipientId, recipientId: requesterId },
        ],
      },
    });

    if (existingConnection) {
      if (existingConnection.status === "ACCEPTED") {
        throw new Error("Already friends with this user");
      }
      if (existingConnection.status === "PENDING") {
        throw new Error("Friend request already sent");
      }
      if (existingConnection.status === "BLOCKED") {
        throw new Error("Cannot send friend request to this user");
      }
      // If declined, allow sending a new request by updating existing
      return prisma.friendConnection.update({
        where: { id: existingConnection.id },
        data: {
          status: "PENDING",
          requesterId,
          recipientId,
        },
      });
    }

    // Create new friend request
    return prisma.friendConnection.create({
      data: {
        requesterId,
        recipientId,
        status: "PENDING",
      },
    });
  }

  /**
   * Accept a friend request
   */
  async acceptFriendRequest(
    userId: string,
    requestId: string,
  ): Promise<FriendConnection> {
    const friendRequest = await prisma.friendConnection.findUnique({
      where: { id: requestId },
    });

    if (!friendRequest) {
      throw new Error("Friend request not found");
    }

    // Verify the user is the recipient
    if (friendRequest.recipientId !== userId) {
      throw new Error("Not authorized to accept this request");
    }

    if (friendRequest.status !== "PENDING") {
      throw new Error("Friend request is not pending");
    }

    return prisma.friendConnection.update({
      where: { id: requestId },
      data: { status: "ACCEPTED" },
    });
  }

  /**
   * Decline a friend request
   */
  async declineFriendRequest(
    userId: string,
    requestId: string,
  ): Promise<FriendConnection> {
    const friendRequest = await prisma.friendConnection.findUnique({
      where: { id: requestId },
    });

    if (!friendRequest) {
      throw new Error("Friend request not found");
    }

    // Verify the user is the recipient
    if (friendRequest.recipientId !== userId) {
      throw new Error("Not authorized to decline this request");
    }

    if (friendRequest.status !== "PENDING") {
      throw new Error("Friend request is not pending");
    }

    return prisma.friendConnection.update({
      where: { id: requestId },
      data: { status: "DECLINED" },
    });
  }

  /**
   * Remove a friend (unfriend)
   */
  async removeFriend(userId: string, friendId: string): Promise<void> {
    const connection = await prisma.friendConnection.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: userId, recipientId: friendId },
          { requesterId: friendId, recipientId: userId },
        ],
      },
    });

    if (!connection) {
      throw new Error("Friend connection not found");
    }

    // Delete the connection
    await prisma.friendConnection.delete({ where: { id: connection.id } });
  }

  /**
   * Block a user
   */
  async blockUser(
    userId: string,
    targetId: string,
  ): Promise<FriendConnection> {
    // No-self guard (was a Mongoose pre-save hook).
    if (userId === targetId) {
      throw new Error("Cannot block yourself");
    }

    // Remove any existing friend connection
    await prisma.friendConnection.deleteMany({
      where: {
        OR: [
          { requesterId: userId, recipientId: targetId },
          { requesterId: targetId, recipientId: userId },
        ],
      },
    });

    // Create or update block status
    const existingBlock = await prisma.friendConnection.findFirst({
      where: { requesterId: userId, recipientId: targetId },
    });

    if (existingBlock) {
      return prisma.friendConnection.update({
        where: { id: existingBlock.id },
        data: { status: "BLOCKED" },
      });
    }

    // Also add to community profile blocked list (normalized child table now;
    // the old embedded array + $addToSet became CommunityBlockedUser rows).
    // TODO(prisma): CommunityProfile.anonymousAlias has no DB default — the
    // Mongo upsert relied on schema defaults. If no profile exists we create a
    // minimal one with a fallback alias; align this with CommunityService's
    // alias generator if provisioning a profile here matters.
    const profile = await prisma.communityProfile.upsert({
      where: { userId },
      update: {},
      create: { userId, anonymousAlias: `user-${userId.slice(0, 8)}` },
    });
    await prisma.communityBlockedUser.upsert({
      where: {
        profileId_blockedUserId: {
          profileId: profile.id,
          blockedUserId: targetId,
        },
      },
      update: {},
      create: { profileId: profile.id, blockedUserId: targetId },
    });

    return prisma.friendConnection.create({
      data: {
        requesterId: userId,
        recipientId: targetId,
        status: "BLOCKED",
      },
    });
  }

  /**
   * Unblock a user
   */
  async unblockUser(userId: string, targetId: string): Promise<void> {
    await prisma.friendConnection.deleteMany({
      where: {
        requesterId: userId,
        recipientId: targetId,
        status: "BLOCKED",
      },
    });

    // Remove from community profile blocked list
    const profile = await prisma.communityProfile.findUnique({
      where: { userId },
    });
    if (profile) {
      await prisma.communityBlockedUser.deleteMany({
        where: { profileId: profile.id, blockedUserId: targetId },
      });
    }
  }

  /**
   * Get all friends for a user (accepted connections)
   */
  async getFriends(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<{
    friends: any[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;

    const whereAccepted = {
      status: "ACCEPTED" as const,
      OR: [{ requesterId: userId }, { recipientId: userId }],
    };

    // Find all accepted connections involving this user
    const connections = await prisma.friendConnection.findMany({
      where: whereAccepted,
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
    });

    const total = await prisma.friendConnection.count({
      where: whereAccepted,
    });

    // String-FK "populate": batch-load both sides and join in code.
    const userIds = [
      ...new Set(connections.flatMap((c) => [c.requesterId, c.recipientId])),
    ];
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            name: true,
            email: true,
            photoUrl: true,
            photoS3Key: true,
          },
        })
      : [];
    const userById = new Map(users.map((u) => [u.id, u]));

    // Filter out connections where either user was deleted
    const validConnections = connections.filter(
      (conn) => userById.get(conn.requesterId) && userById.get(conn.recipientId),
    );

    // Extract the friend user object (the one that's not the current user)
    const friends = await Promise.all(
      validConnections.map(async (conn) => {
        const friend =
          conn.requesterId === userId
            ? userById.get(conn.recipientId)!
            : userById.get(conn.requesterId)!;

        return {
          id: friend.id,
          name: friend.name,
          email: friend.email,
          photoUrl: await this.resolvePhotoUrl(friend),
          friendsSince: conn.updatedAt,
          connectionId: conn.id,
        };
      }),
    );

    return {
      friends,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get pending friend requests (received)
   */
  async getPendingRequests(
    userId: string,
    type: "SENT" | "RECEIVED" = "RECEIVED",
  ): Promise<any[]> {
    const where =
      type === "RECEIVED"
        ? { recipientId: userId, status: "PENDING" as const }
        : { requesterId: userId, status: "PENDING" as const };

    const requests = await prisma.friendConnection.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    const userIds = [
      ...new Set(requests.flatMap((r) => [r.requesterId, r.recipientId])),
    ];
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            name: true,
            email: true,
            photoUrl: true,
            photoS3Key: true,
          },
        })
      : [];
    const userById = new Map(users.map((u) => [u.id, u]));

    const validRequests = requests.filter(
      (req) => userById.get(req.requesterId) && userById.get(req.recipientId),
    );

    return await Promise.all(
      validRequests.map(async (req) => {
        const requester = userById.get(req.requesterId)!;
        const recipient = userById.get(req.recipientId)!;
        return {
          id: req.id,
          requester: {
            id: requester.id,
            name: requester.name,
            email: requester.email,
            photoUrl: await this.resolvePhotoUrl(requester),
          },
          recipient: {
            id: recipient.id,
            name: recipient.name,
            email: recipient.email,
            photoUrl: await this.resolvePhotoUrl(recipient),
          },
          status: req.status,
          createdAt: req.createdAt,
        };
      }),
    );
  }

  /**
   * Search friends for booking (with optional query filter)
   */
  async searchFriendsForBooking(
    userId: string,
    query?: string,
  ): Promise<any[]> {
    // Get all accepted friends
    const connections = await prisma.friendConnection.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: userId }, { recipientId: userId }],
      },
    });

    const userIds = [
      ...new Set(connections.flatMap((c) => [c.requesterId, c.recipientId])),
    ];
    const users = userIds.length
      ? await prisma.user.findMany({
          where: { id: { in: userIds } },
          select: {
            id: true,
            name: true,
            email: true,
            photoUrl: true,
            photoS3Key: true,
          },
        })
      : [];
    const userById = new Map(users.map((u) => [u.id, u]));

    // Extract friend user objects and filter out nulls
    let friends = connections
      .filter(
        (conn) =>
          userById.get(conn.requesterId) && userById.get(conn.recipientId),
      )
      .map((conn) =>
        conn.requesterId === userId
          ? userById.get(conn.recipientId)!
          : userById.get(conn.requesterId)!,
      );

    // Filter by query if provided
    if (query) {
      const lowerQuery = query.toLowerCase();
      friends = friends.filter(
        (friend) =>
          friend.name.toLowerCase().includes(lowerQuery) ||
          friend.email.toLowerCase().includes(lowerQuery),
      );
    }

    // Map to final format and resolve S3 URLs ONLY for the filtered subset
    return Promise.all(
      friends.map(async (friend) => ({
        id: friend.id,
        name: friend.name,
        email: friend.email,
        photoUrl: await this.resolvePhotoUrl(friend),
      })),
    );
  }

  /**
   * Search for users to add as friends (not existing friends)
   */
  async searchUsers(
    userId: string,
    query: string,
  ): Promise<
    Array<{
      id: string;
      name: string;
      email: string;
      photoUrl?: string;
      friendStatus:
        | "FRIENDS"
        | "PENDING_SENT"
        | "PENDING_RECEIVED"
        | "BLOCKED"
        | "NONE";
    }>
  > {
    if (!query || query.trim().length < 2) {
      return [];
    }

    // The Mongo version built a sanitized RegExp to guard against ReDoS. Postgres
    // `contains` compiles to a parameterized ILIKE (no regex engine to attack);
    // we still reuse the helper for its length-cap/trim, then strip the regex
    // escaping and pass the plain term. `%`/`_` are literal in `contains`.
    const term = buildSafeSearchRegexSource(query.toLowerCase())
      .replace(/\\/g, "")
      .slice(0, 100);

    // Search for players by name or email (case-insensitive)
    const users = await prisma.user.findMany({
      where: {
        role: "Player",
        id: { not: userId }, // Exclude current user
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { email: { contains: term, mode: "insensitive" } },
        ],
      },
      take: 20,
      select: {
        id: true,
        name: true,
        email: true,
        photoUrl: true,
        photoS3Key: true,
      },
    });

    // Get friend status for each user
    const usersWithStatus = await Promise.all(
      users.map(async (user) => {
        const status = await this.getFriendStatus(userId, user.id);
        const photoUrl = await this.resolvePhotoUrl(user);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          ...(photoUrl && { photoUrl }),
          friendStatus: status,
        };
      }),
    );

    return usersWithStatus;
  }

  /**
   * Check if two users are friends
   */
  async areFriends(userId1: string, userId2: string): Promise<boolean> {
    const connection = await prisma.friendConnection.findFirst({
      where: {
        status: "ACCEPTED",
        OR: [
          { requesterId: userId1, recipientId: userId2 },
          { requesterId: userId2, recipientId: userId1 },
        ],
      },
    });

    return !!connection;
  }

  /**
   * Get friend connection status between two users
   */
  async getFriendStatus(
    userId: string,
    targetId: string,
  ): Promise<
    "FRIENDS" | "PENDING_SENT" | "PENDING_RECEIVED" | "BLOCKED" | "NONE"
  > {
    const connection = await prisma.friendConnection.findFirst({
      where: {
        OR: [
          { requesterId: userId, recipientId: targetId },
          { requesterId: targetId, recipientId: userId },
        ],
      },
    });

    if (!connection) return "NONE";

    if (connection.status === "ACCEPTED") return "FRIENDS";
    if (connection.status === "BLOCKED") return "BLOCKED";
    if (connection.status === "PENDING") {
      return connection.requesterId === userId
        ? "PENDING_SENT"
        : "PENDING_RECEIVED";
    }

    return "NONE";
  }
}

export default new FriendService();
