import { Router } from "express";
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
  getCommunityPostDetails,
  getMyCommunityReputation,
  editMessage,
  getBlockedUsers,
  getCommunityProfile,
  getConversationMessages,
  getGroupInviteCode,
  getGroupMembers,
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
  updateGroupSettings,
  updateCommunityProfile,
  voteCommunityTarget,
} from "../controllers/communityController";
import { authMiddleware } from "../middleware/auth";
import {
  communityBlockSchema,
  communityAddGroupMemberSchema,
  communityCreateAnswerSchema,
  communityCreateGroupSchema,
  communityCreatePostSchema,
  communityReportSchema,
  communityUpdateGroupSettingsSchema,
  communityUpdateMessageSchema,
  communityUpdatePostSchema,
  communitySendMessageSchema,
  communityStartConversationSchema,
  communityUpdateProfileSchema,
  communityVoteSchema,
} from "../middleware/schemas";
import { validateRequest } from "../middleware/validation";

const router = Router();

router.use(authMiddleware);

router.get("/profile", getCommunityProfile);
router.get("/players/search", searchPlayers);
router.patch(
  "/profile",
  validateRequest(communityUpdateProfileSchema),
  updateCommunityProfile,
);

router.get("/blocked-users", getBlockedUsers);
router.post("/block", validateRequest(communityBlockSchema), blockUser);
router.post("/unblock", validateRequest(communityBlockSchema), unblockUser);

router.get("/conversations", listConversations);
router.post(
  "/conversations/start",
  validateRequest(communityStartConversationSchema),
  startConversation,
);
router.post("/conversations/:conversationId/accept", acceptConversationRequest);
router.post("/conversations/:conversationId/reject", rejectConversationRequest);
router.get("/conversations/:conversationId/messages", getConversationMessages);
router.post(
  "/messages",
  validateRequest(communitySendMessageSchema),
  sendMessage,
);
router.patch(
  "/messages/:messageId",
  validateRequest(communityUpdateMessageSchema),
  editMessage,
);
router.delete("/messages/:messageId", deleteMessage);

router.get("/groups", listGroups);
router.post(
  "/groups",
  validateRequest(communityCreateGroupSchema),
  createGroup,
);
router.post(
  "/groups/:groupId/members",
  validateRequest(communityAddGroupMemberSchema),
  addGroupMember,
);
router.patch(
  "/groups/:groupId/settings",
  validateRequest(communityUpdateGroupSettingsSchema),
  updateGroupSettings,
);
router.post("/groups/:groupId/join", joinGroup);
router.post("/groups/join-by-code/:inviteCode", joinGroupByCode);
router.get("/groups/:groupId/members", getGroupMembers);
router.get("/groups/:groupId/invite-code", getGroupInviteCode);
router.post("/groups/:groupId/leave", leaveGroup);
router.post(
  "/reports",
  validateRequest(communityReportSchema),
  reportCommunityContent,
);
router.get("/reports/my", listMyCommunityReports);

router.get("/reputation", getMyCommunityReputation);
router.get("/posts", listCommunityPosts);
router.get("/posts/:postId", getCommunityPostDetails);
router.post(
  "/posts",
  validateRequest(communityCreatePostSchema),
  createCommunityPost,
);
router.patch(
  "/posts/:postId",
  validateRequest(communityUpdatePostSchema),
  updateCommunityPost,
);
router.delete("/posts/:postId", deleteCommunityPost);
router.post(
  "/posts/:postId/answers",
  validateRequest(communityCreateAnswerSchema),
  createCommunityAnswer,
);
router.patch(
  "/answers/:answerId",
  validateRequest(communityCreateAnswerSchema),
  updateCommunityAnswer,
);
router.delete("/answers/:answerId", deleteCommunityAnswer);
router.post(
  "/votes",
  validateRequest(communityVoteSchema),
  voteCommunityTarget,
);

export default router;
