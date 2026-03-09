import { Request, Response, NextFunction } from "express";
import friendService from "../services/FriendService";
import { z } from "zod";
import { NotificationService } from "../services/NotificationService";
import {
  sendFriendRequestEmail,
  sendFriendRequestAcceptedEmail,
} from "../utils/email";
import { User } from "../models/User";

// Validation schemas
const sendRequestSchema = z.object({
  recipientId: z.string().min(1, "Recipient ID is required"),
});

const searchFriendsSchema = z.object({
  q: z.string().optional(),
});

const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 20)),
});

const requestTypeSchema = z.object({
  type: z.enum(["SENT", "RECEIVED"]).optional().default("RECEIVED"),
});

/**
 * Send a friend request
 */
export const sendFriendRequest = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { recipientId } = sendRequestSchema.parse(req.body);
    const userId = req.user!.id;

    const friendRequest = await friendService.sendFriendRequest(
      userId,
      recipientId,
    );

    // Get user details for notifications
    const [requester, recipient] = await Promise.all([
      User.findById(userId).select("name email photoUrl"),
      User.findById(recipientId).select("name email photoUrl"),
    ]);

    if (requester && recipient) {
      // Send notification via NotificationService (socket + email + persist to DB)
      await NotificationService.send(
        {
          userId: recipientId,
          type: "FRIEND_REQUEST",
          title: "New Friend Request",
          message: `${requester.name} sent you a friend request`,
          data: {
            requestId: friendRequest._id.toString(),
            requesterId: requester._id.toString(),
            requesterName: requester.name,
            requesterEmail: requester.email,
            requesterPhotoUrl: requester.photoUrl,
          },
        },
        {
          persistToDb: true,
          sendSocket: true,
          sendEmail: true,
        },
      );

      // Send detailed email notification using existing template (async, don't wait)
      sendFriendRequestEmail({
        recipientName: recipient.name,
        recipientEmail: recipient.email,
        requesterName: requester.name,
        ...(requester.photoUrl && { requesterPhotoUrl: requester.photoUrl }),
      }).catch((err) =>
        console.error("Failed to send friend request email:", err),
      );
    }

    res.status(201).json({
      success: true,
      message: "Friend request sent successfully",
      data: friendRequest,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.issues,
      });
    } else {
      next(error);
    }
  }
};

/**
 * Accept a friend request
 */
export const acceptFriendRequest = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const requestId = req.params.requestId as string;
    const userId = req.user!.id;

    const connection = await friendService.acceptFriendRequest(
      userId,
      requestId,
    );

    // Get user details for notification
    const acceptedBy = await User.findById(userId);
    const requester = await User.findById(connection.requesterId);

    if (!acceptedBy || !requester) {
      throw new Error("User not found");
    }

    // Send notification via NotificationService (socket + email + persist to DB)
    await NotificationService.send(
      {
        userId: connection.requesterId.toString(),
        type: "FRIEND_REQUEST_ACCEPTED",
        title: "Friend Request Accepted",
        message: `${acceptedBy.name} accepted your friend request`,
        data: {
          connectionId: connection._id.toString(),
          acceptedById: acceptedBy._id.toString(),
          acceptedByName: acceptedBy.name,
          acceptedByEmail: acceptedBy.email,
          acceptedByPhotoUrl: acceptedBy.photoUrl,
        },
      },
      {
        persistToDb: true,
        sendSocket: true,
        sendEmail: true,
      },
    );

    // Send detailed email notification using existing template (async, don't wait)
    sendFriendRequestAcceptedEmail({
      requesterName: requester.name,
      requesterEmail: requester.email,
      acceptedByName: acceptedBy.name,
      ...(acceptedBy.photoUrl && { acceptedByPhotoUrl: acceptedBy.photoUrl }),
    }).catch((err) =>
      console.error("Failed to send friend accepted email:", err),
    );

    res.json({
      success: true,
      message: "Friend request accepted",
      data: connection,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Decline a friend request
 */
export const declineFriendRequest = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const requestId = req.params.requestId as string;
    const userId = req.user!.id;

    const connection = await friendService.declineFriendRequest(
      userId,
      requestId,
    );

    res.json({
      success: true,
      message: "Friend request declined",
      data: connection,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Remove a friend (unfriend)
 */
export const removeFriend = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const friendId = req.params.friendId as string;
    const userId = req.user!.id;

    await friendService.removeFriend(userId, friendId);

    res.json({
      success: true,
      message: "Friend removed successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Block a user
 */
export const blockUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { userId: targetId } = req.body;
    const userId = req.user!.id;

    if (!targetId) {
      res.status(400).json({
        success: false,
        message: "User ID is required",
      });
      return;
    }

    const connection = await friendService.blockUser(userId, targetId);

    res.json({
      success: true,
      message: "User blocked successfully",
      data: connection,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Unblock a user
 */
export const unblockUser = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const targetId = req.params.userId as string;
    const userId = req.user!.id;

    await friendService.unblockUser(userId, targetId);

    res.json({
      success: true,
      message: "User unblocked successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get all friends (paginated)
 */
export const getFriends = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const userId = req.user!.id;

    const result = await friendService.getFriends(userId, page, limit);

    res.json({
      success: true,
      message: "Friends retrieved successfully",
      data: result,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.issues,
      });
    } else {
      next(error);
    }
  }
};

/**
 * Get pending friend requests
 */
export const getPendingRequests = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { type } = requestTypeSchema.parse(req.query);
    const userId = req.user!.id;

    const requests = await friendService.getPendingRequests(userId, type);

    res.json({
      success: true,
      message: "Pending requests retrieved successfully",
      data: requests,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.issues,
      });
    } else {
      next(error);
    }
  }
};

/**
 * Search friends for booking
 */
export const searchFriendsForBooking = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { q } = searchFriendsSchema.parse(req.query);
    const userId = req.user!.id;

    const friends = await friendService.searchFriendsForBooking(userId, q);

    res.json({
      success: true,
      message: "Friends retrieved successfully",
      data: friends,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.issues,
      });
    } else {
      next(error);
    }
  }
};

/**
 * Get friend status with another user
 */
export const getFriendStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const targetId = req.params.targetId as string;
    const userId = req.user!.id;

    const status = await friendService.getFriendStatus(userId, targetId);

    res.json({
      success: true,
      data: { status },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Search for users to add as friends
 */
export const searchUsers = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { q } = searchFriendsSchema.parse(req.query);
    const userId = req.user!.id;

    if (!q || q.trim().length < 2) {
      res.status(400).json({
        success: false,
        message: "Search query must be at least 2 characters",
      });
      return;
    }

    const users = await friendService.searchUsers(userId, q);

    res.json({
      success: true,
      message: "Users found",
      data: users,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.issues,
      });
    } else {
      next(error);
    }
  }
};

/**
 * Get count of pending friend requests (received)
 */
export const getPendingRequestsCount = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user!.id;
    const requests = await friendService.getPendingRequests(userId, "RECEIVED");

    res.json({
      success: true,
      data: { count: requests.length },
    });
  } catch (error) {
    next(error);
  }
};
