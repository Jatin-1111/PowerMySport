import FriendConnection, {
  IFriendConnection,
} from "../models/FriendConnection";
import { User } from "../models/User";
import { CommunityProfile } from "../models/CommunityProfile";
import mongoose from "mongoose";
import { S3Service } from "./S3Service";

type UserWithPhoto = {
  photoUrl?: string;
  photoS3Key?: string;
};

export class FriendService {
  private readonly s3Service = new S3Service();

  private async resolvePhotoUrl(
    user: UserWithPhoto,
  ): Promise<string | undefined> {
    if (!user.photoS3Key) {
      return user.photoUrl;
    }

    try {
      return await this.s3Service.generateDownloadUrl(
        user.photoS3Key,
        "images",
        3600,
      );
    } catch (error) {
      console.error("Failed to regenerate friend photo URL:", error);
      return user.photoUrl;
    }
  }

  /**
   * Send a friend request
   */
  async sendFriendRequest(
    requesterId: string,
    recipientId: string,
  ): Promise<IFriendConnection> {
    // Validate: cannot send request to yourself
    if (requesterId === recipientId) {
      throw new Error("Cannot send friend request to yourself");
    }

    // Check if recipient exists and is a PLAYER
    const recipient = await User.findById(recipientId);
    if (!recipient) {
      throw new Error("User not found");
    }
    if (recipient.role !== "PLAYER") {
      throw new Error("Can only send friend requests to players");
    }

    // Check if requester is a PLAYER
    const requester = await User.findById(requesterId);
    if (!requester || requester.role !== "PLAYER") {
      throw new Error("Only players can send friend requests");
    }

    // Check if recipient has blocked the requester
    const recipientProfile = await CommunityProfile.findOne({
      userId: recipientId,
    });
    if (
      recipientProfile?.blockedUsers?.includes(
        new mongoose.Types.ObjectId(requesterId),
      )
    ) {
      throw new Error("Cannot send friend request to this user");
    }

    // Check for existing connection in either direction
    const existingConnection = await FriendConnection.findOne({
      $or: [
        { requesterId, recipientId },
        { requesterId: recipientId, recipientId: requesterId },
      ],
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
      existingConnection.status = "PENDING";
      existingConnection.requesterId = new mongoose.Types.ObjectId(requesterId);
      existingConnection.recipientId = new mongoose.Types.ObjectId(recipientId);
      return await existingConnection.save();
    }

    // Create new friend request
    const friendRequest = new FriendConnection({
      requesterId: new mongoose.Types.ObjectId(requesterId),
      recipientId: new mongoose.Types.ObjectId(recipientId),
      status: "PENDING",
    });

    return await friendRequest.save();
  }

  /**
   * Accept a friend request
   */
  async acceptFriendRequest(
    userId: string,
    requestId: string,
  ): Promise<IFriendConnection> {
    const friendRequest = await FriendConnection.findById(requestId);

    if (!friendRequest) {
      throw new Error("Friend request not found");
    }

    // Verify the user is the recipient
    if (friendRequest.recipientId.toString() !== userId) {
      throw new Error("Not authorized to accept this request");
    }

    if (friendRequest.status !== "PENDING") {
      throw new Error("Friend request is not pending");
    }

    friendRequest.status = "ACCEPTED";
    return await friendRequest.save();
  }

  /**
   * Decline a friend request
   */
  async declineFriendRequest(
    userId: string,
    requestId: string,
  ): Promise<IFriendConnection> {
    const friendRequest = await FriendConnection.findById(requestId);

    if (!friendRequest) {
      throw new Error("Friend request not found");
    }

    // Verify the user is the recipient
    if (friendRequest.recipientId.toString() !== userId) {
      throw new Error("Not authorized to decline this request");
    }

    if (friendRequest.status !== "PENDING") {
      throw new Error("Friend request is not pending");
    }

    friendRequest.status = "DECLINED";
    return await friendRequest.save();
  }

  /**
   * Remove a friend (unfriend)
   */
  async removeFriend(userId: string, friendId: string): Promise<void> {
    const connection = await FriendConnection.findOne({
      $or: [
        { requesterId: userId, recipientId: friendId },
        { requesterId: friendId, recipientId: userId },
      ],
      status: "ACCEPTED",
    });

    if (!connection) {
      throw new Error("Friend connection not found");
    }

    // Delete the connection
    await FriendConnection.findByIdAndDelete(connection._id);
  }

  /**
   * Block a user
   */
  async blockUser(
    userId: string,
    targetId: string,
  ): Promise<IFriendConnection> {
    if (userId === targetId) {
      throw new Error("Cannot block yourself");
    }

    // Remove any existing friend connection
    await FriendConnection.deleteMany({
      $or: [
        { requesterId: userId, recipientId: targetId },
        { requesterId: targetId, recipientId: userId },
      ],
    });

    // Create or update block status
    const existingBlock = await FriendConnection.findOne({
      requesterId: userId,
      recipientId: targetId,
    });

    if (existingBlock) {
      existingBlock.status = "BLOCKED";
      return await existingBlock.save();
    }

    const block = new FriendConnection({
      requesterId: new mongoose.Types.ObjectId(userId),
      recipientId: new mongoose.Types.ObjectId(targetId),
      status: "BLOCKED",
    });

    // Also add to community profile blocked list
    await CommunityProfile.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      { $addToSet: { blockedUsers: new mongoose.Types.ObjectId(targetId) } },
      { upsert: true },
    );

    return await block.save();
  }

  /**
   * Unblock a user
   */
  async unblockUser(userId: string, targetId: string): Promise<void> {
    await FriendConnection.deleteOne({
      requesterId: userId,
      recipientId: targetId,
      status: "BLOCKED",
    });

    // Remove from community profile blocked list
    await CommunityProfile.findOneAndUpdate(
      { userId: new mongoose.Types.ObjectId(userId) },
      { $pull: { blockedUsers: new mongoose.Types.ObjectId(targetId) } },
    );
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

    // Find all accepted connections involving this user
    const connections = await FriendConnection.find({
      $or: [{ requesterId: userId }, { recipientId: userId }],
      status: "ACCEPTED",
    })
      .skip(skip)
      .limit(limit)
      .populate("requesterId", "name email photoUrl photoS3Key")
      .populate("recipientId", "name email photoUrl photoS3Key")
      .sort({ updatedAt: -1 });

    const total = await FriendConnection.countDocuments({
      $or: [{ requesterId: userId }, { recipientId: userId }],
      status: "ACCEPTED",
    });

    // Extract the friend user object (the one that's not the current user)
    const friends = await Promise.all(
      connections.map(async (conn: any) => {
        const friend =
          conn.requesterId._id.toString() === userId
            ? conn.recipientId
            : conn.requesterId;

        return {
          id: friend._id,
          name: friend.name,
          email: friend.email,
          photoUrl: await this.resolvePhotoUrl(friend),
          friendsSince: conn.updatedAt,
          connectionId: conn._id,
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
    const query =
      type === "RECEIVED"
        ? { recipientId: userId, status: "PENDING" }
        : { requesterId: userId, status: "PENDING" };

    const requests = await FriendConnection.find(query)
      .populate("requesterId", "name email photoUrl photoS3Key")
      .populate("recipientId", "name email photoUrl photoS3Key")
      .sort({ createdAt: -1 });

    return await Promise.all(
      requests.map(async (req: any) => ({
        id: req._id,
        requester: {
          id: req.requesterId._id,
          name: req.requesterId.name,
          email: req.requesterId.email,
          photoUrl: await this.resolvePhotoUrl(req.requesterId),
        },
        recipient: {
          id: req.recipientId._id,
          name: req.recipientId.name,
          email: req.recipientId.email,
          photoUrl: await this.resolvePhotoUrl(req.recipientId),
        },
        status: req.status,
        createdAt: req.createdAt,
      })),
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
    const connections = await FriendConnection.find({
      $or: [{ requesterId: userId }, { recipientId: userId }],
      status: "ACCEPTED",
    })
      .populate("requesterId", "name email photoUrl photoS3Key")
      .populate("recipientId", "name email photoUrl photoS3Key");

    // Extract friend user objects
    let friends = await Promise.all(
      connections.map(async (conn: any) => {
        const friend =
          conn.requesterId._id.toString() === userId
            ? conn.recipientId
            : conn.requesterId;

        return {
          id: friend._id,
          name: friend.name,
          email: friend.email,
          photoUrl: await this.resolvePhotoUrl(friend),
        };
      }),
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

    return friends;
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

    const lowerQuery = query.toLowerCase();

    // Search for players by name or email (case-insensitive)
    const users = await User.find({
      role: "PLAYER",
      _id: { $ne: userId }, // Exclude current user
      $or: [
        { name: { $regex: lowerQuery, $options: "i" } },
        { email: { $regex: lowerQuery, $options: "i" } },
      ],
    })
      .limit(20)
      .select("_id name email photoUrl photoS3Key");

    // Get friend status for each user
    const usersWithStatus = await Promise.all(
      users.map(async (user) => {
        const status = await this.getFriendStatus(userId, user._id.toString());
        const photoUrl = await this.resolvePhotoUrl(user);

        return {
          id: user._id.toString(),
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
    const connection = await FriendConnection.findOne({
      $or: [
        { requesterId: userId1, recipientId: userId2 },
        { requesterId: userId2, recipientId: userId1 },
      ],
      status: "ACCEPTED",
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
    const connection = await FriendConnection.findOne({
      $or: [
        { requesterId: userId, recipientId: targetId },
        { requesterId: targetId, recipientId: userId },
      ],
    });

    if (!connection) return "NONE";

    if (connection.status === "ACCEPTED") return "FRIENDS";
    if (connection.status === "BLOCKED") return "BLOCKED";
    if (connection.status === "PENDING") {
      return connection.requesterId.toString() === userId
        ? "PENDING_SENT"
        : "PENDING_RECEIVED";
    }

    return "NONE";
  }
}

export default new FriendService();
