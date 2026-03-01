import { Router } from "express";
import {
  acceptConversationRequest,
  blockUser,
  getBlockedUsers,
  getCommunityProfile,
  getConversationMessages,
  listConversations,
  rejectConversationRequest,
  searchPlayers,
  sendMessage,
  startConversation,
  unblockUser,
  updateCommunityProfile,
} from "../controllers/communityController";
import { authMiddleware } from "../middleware/auth";
import {
  communityBlockSchema,
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

export default router;
