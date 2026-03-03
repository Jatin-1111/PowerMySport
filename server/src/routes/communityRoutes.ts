import { Router } from "express";
import {
  acceptConversationRequest,
  addGroupMember,
  blockUser,
  createGroup,
  getBlockedUsers,
  getCommunityProfile,
  getConversationMessages,
  joinGroup,
  leaveGroup,
  listGroups,
  listConversations,
  rejectConversationRequest,
  searchPlayers,
  sendMessage,
  startConversation,
  unblockUser,
  updateGroupSettings,
  updateCommunityProfile,
} from "../controllers/communityController";
import { authMiddleware } from "../middleware/auth";
import {
  communityBlockSchema,
  communityAddGroupMemberSchema,
  communityCreateGroupSchema,
  communityUpdateGroupSettingsSchema,
  communitySendMessageSchema,
  communityStartConversationSchema,
  communityUpdateProfileSchema,
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
router.post("/groups/:groupId/leave", leaveGroup);

export default router;
