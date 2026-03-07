import express from "express";
import {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  blockUser,
  unblockUser,
  getFriends,
  getPendingRequests,
  searchFriendsForBooking,
  getFriendStatus,
  searchUsers,
  getPendingRequestsCount,
} from "../controllers/friendController";
import { authMiddleware, playerOnlyMiddleware } from "../middleware/auth";

const router = express.Router();

// All friend routes require authentication and player-only access
router.use(authMiddleware);
router.use(playerOnlyMiddleware);

// Friend request management
router.post("/request", sendFriendRequest);
router.post("/accept/:requestId", acceptFriendRequest);
router.post("/decline/:requestId", declineFriendRequest);
router.delete("/:friendId", removeFriend);

// Block/unblock
router.post("/block", blockUser);
router.delete("/unblock/:userId", unblockUser);

// Get friends and requests
router.get("/", getFriends);
router.get("/requests", getPendingRequests);
router.get("/requests/pending-count", getPendingRequestsCount);
router.get("/search", searchFriendsForBooking);
router.get("/search-users", searchUsers);
router.get("/status/:targetId", getFriendStatus);

export default router;
