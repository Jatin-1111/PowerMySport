import { Router, Request, Response, NextFunction } from "express";
import rateLimit from "express-rate-limit";
import {
  acceptConversationRequest,
  addGroupMember,
  blockUser,
  createCommunityAnswer,
  createCommunityPost,
  createGroup,
  deleteMessage,
  deleteCommunityAnswer,
  deleteCommunityPost,
  deleteGroup,
  getCommunityPostDetails,
  getMyCommunityReputation,
  importCommunityFollows,
  listCommunityFollows,
  listCommunityLeaderboard,
  toggleCommunityFollow,
  editMessage,
  getBlockedUsers,
  getCommunityProfile,
  getPlayerProfile,
  getConversationMessages,
  getUnreadConversationCount,
  getGroupInviteCode,
  getGroupMembers,
  getChatImageUploadUrl,
  getGroupImageUploadUrl,
  joinGroup,
  joinGroupByCode,
  leaveGroup,
  listMyCommunityReports,
  listGroups,
  listCommunityPosts,
  listConversations,
  rejectConversationRequest,
  reportCommunityContent,
  searchPlayers,
  sendMessage,
  startConversation,
  updateCommunityAnswer,
  updateCommunityPost,
  unblockUser,
  updateGroup,
  updateGroupSettings,
  updateCommunityProfile,
  voteCommunityTarget,
} from "../controllers/communityController";
import { authMiddleware, optionalAuthMiddleware } from "../../middleware/auth";
import {
  communityBlockSchema,
  communityAddGroupMemberSchema,
  communityCreateAnswerSchema,
  communityCreateGroupSchema,
  communityCreatePostSchema,
  communityFollowImportSchema,
  communityFollowToggleSchema,
  communityReportSchema,
  communityUpdateGroupSchema,
  communityUpdateGroupSettingsSchema,
  communityUpdateMessageSchema,
  communityUpdatePostSchema,
  communitySendMessageSchema,
  communityChatUploadUrlSchema,
  communityGroupUploadUrlSchema,
  communityStartConversationSchema,
  communityUpdateProfileSchema,
  communityVoteSchema,
} from "../../middleware/schemas";
import { validateRequest } from "../../middleware/validation";

const router = Router();

router.get("/profile", authMiddleware, getCommunityProfile);
router.get("/players/search", authMiddleware, searchPlayers);
router.get("/players/:userId/profile", authMiddleware, getPlayerProfile);
router.patch(
  "/profile",
  authMiddleware,
  validateRequest(communityUpdateProfileSchema),
  updateCommunityProfile,
);

router.get("/blocked-users", authMiddleware, getBlockedUsers);
router.post(
  "/block",
  authMiddleware,
  validateRequest(communityBlockSchema),
  blockUser,
);
router.post(
  "/unblock",
  authMiddleware,
  validateRequest(communityBlockSchema),
  unblockUser,
);

router.get("/conversations", authMiddleware, listConversations);
router.get(
  "/conversations/unread-count",
  authMiddleware,
  getUnreadConversationCount,
);
router.post(
  "/conversations/start",
  authMiddleware,
  validateRequest(communityStartConversationSchema),
  startConversation,
);
router.post(
  "/conversations/:conversationId/accept",
  authMiddleware,
  acceptConversationRequest,
);
router.post(
  "/conversations/:conversationId/reject",
  authMiddleware,
  rejectConversationRequest,
);
router.get(
  "/conversations/:conversationId/messages",
  authMiddleware,
  getConversationMessages,
);
router.post(
  "/messages",
  authMiddleware,
  validateRequest(communitySendMessageSchema),
  sendMessage,
);
router.patch(
  "/messages/:messageId",
  authMiddleware,
  validateRequest(communityUpdateMessageSchema),
  editMessage,
);
router.delete("/messages/:messageId", authMiddleware, deleteMessage);

// Public — powers the Discover page's community/group directory for guests.
router.get("/groups", optionalAuthMiddleware, listGroups);
router.post(
  "/groups/upload-url",
  authMiddleware,
  validateRequest(communityGroupUploadUrlSchema),
  getGroupImageUploadUrl,
);
router.post(
  "/groups",
  authMiddleware,
  validateRequest(communityCreateGroupSchema),
  createGroup,
);
router.post(
  "/groups/:groupId/members",
  authMiddleware,
  validateRequest(communityAddGroupMemberSchema),
  addGroupMember,
);
router.patch(
  "/groups/:groupId",
  authMiddleware,
  validateRequest(communityUpdateGroupSchema),
  updateGroup,
);
router.patch(
  "/groups/:groupId/settings",
  authMiddleware,
  validateRequest(communityUpdateGroupSettingsSchema),
  updateGroupSettings,
);
router.post("/groups/:groupId/join", authMiddleware, joinGroup);
router.post(
  "/groups/join-by-code/:inviteCode",
  authMiddleware,
  joinGroupByCode,
);
router.get("/groups/:groupId/members", authMiddleware, getGroupMembers);
router.get("/groups/:groupId/invite-code", authMiddleware, getGroupInviteCode);
router.post("/groups/:groupId/leave", authMiddleware, leaveGroup);
router.delete("/groups/:groupId", authMiddleware, deleteGroup);
router.post(
  "/reports",
  authMiddleware,
  validateRequest(communityReportSchema),
  reportCommunityContent,
);
router.get("/reports/my", authMiddleware, listMyCommunityReports);

router.get("/reputation", authMiddleware, getMyCommunityReputation);
router.get("/leaderboard", authMiddleware, listCommunityLeaderboard);

router.get("/follows", authMiddleware, listCommunityFollows);
router.post(
  "/follows/toggle",
  authMiddleware,
  validateRequest(communityFollowToggleSchema),
  toggleCommunityFollow,
);
router.post(
  "/follows/import",
  authMiddleware,
  validateRequest(communityFollowImportSchema),
  importCommunityFollows,
);
// Public — Q&A list/detail feed the community landing page, shared post
// links, and the sitemap generator.
router.get("/posts", optionalAuthMiddleware, listCommunityPosts);
router.get("/posts/:postId", optionalAuthMiddleware, getCommunityPostDetails);
router.post(
  "/posts",
  authMiddleware,
  validateRequest(communityCreatePostSchema),
  createCommunityPost,
);
router.patch(
  "/posts/:postId",
  authMiddleware,
  validateRequest(communityUpdatePostSchema),
  updateCommunityPost,
);
router.delete("/posts/:postId", authMiddleware, deleteCommunityPost);
router.post(
  "/posts/:postId/answers",
  authMiddleware,
  validateRequest(communityCreateAnswerSchema),
  createCommunityAnswer,
);
router.patch(
  "/answers/:answerId",
  authMiddleware,
  validateRequest(communityCreateAnswerSchema),
  updateCommunityAnswer,
);
router.delete("/answers/:answerId", authMiddleware, deleteCommunityAnswer);
router.post(
  "/votes",
  authMiddleware,
  validateRequest(communityVoteSchema),
  voteCommunityTarget,
);

/**
 * Rate limiter for chat image upload URL generation.
 * Keyed per user ID (extracted from req.user after authMiddleware).
 * Allows 5 presigned URL requests per 60 seconds per user.
 */
const chatUploadRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  keyGenerator: (req: Request) => req.user?.id || "anonymous",
  handler: (_req: Request, res: Response, _next: NextFunction) => {
    res.status(429).json({
      success: false,
      message:
        "Too many upload requests. Please wait a moment before uploading another image.",
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  "/chat/upload-url",
  authMiddleware,
  chatUploadRateLimit,
  validateRequest(communityChatUploadUrlSchema),
  getChatImageUploadUrl,
);

export default router;
