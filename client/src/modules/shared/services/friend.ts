import api from "@/lib/api/client";
import { clearRequestCache, withRequestCache } from "@/lib/api/requestCache";

const FRIEND_COUNTS_TTL_MS = 5000;
const FRIEND_LIST_TTL_MS = 10000;
const FRIEND_USER_SEARCH_TTL_MS = 10000;

export interface Friend {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
  friendsSince: string;
  connectionId: string;
}

export interface SearchUserResult {
  id: string;
  name: string;
  email: string;
  photoUrl?: string;
  friendStatus: "FRIENDS" | "PENDING_SENT" | "PENDING_RECEIVED" | "NONE";
}

export interface FriendRequest {
  id: string;
  requester: {
    id: string;
    name: string;
    email: string;
    photoUrl?: string;
  };
  recipient: {
    id: string;
    name: string;
    email: string;
    photoUrl?: string;
  };
  status: string;
  createdAt: string;
}

export interface FriendsResponse {
  friends: Friend[];
  total: number;
  page: number;
  totalPages: number;
}

export const friendService = {
  /**
   * Send a friend request
   */
  async sendFriendRequest(recipientId: string): Promise<any> {
    const response = await api.post("/friends/request", { recipientId });
    clearRequestCache([
      "friends:pending-count",
      "friends:pending:",
      "friends:search-users:",
    ]);
    return response.data;
  },

  /**
   * Accept a friend request
   */
  async acceptFriendRequest(requestId: string): Promise<any> {
    const response = await api.post(`/friends/accept/${requestId}`);
    clearRequestCache([
      "friends:pending-count",
      "friends:pending:",
      "friends:list:",
      "friends:search-users:",
    ]);
    return response.data;
  },

  /**
   * Decline a friend request
   */
  async declineFriendRequest(requestId: string): Promise<any> {
    const response = await api.post(`/friends/decline/${requestId}`);
    clearRequestCache([
      "friends:pending-count",
      "friends:pending:",
      "friends:search-users:",
    ]);
    return response.data;
  },

  /**
   * Remove a friend (unfriend)
   */
  async removeFriend(friendId: string): Promise<void> {
    await api.delete(`/friends/${friendId}`);
    clearRequestCache(["friends:list:", "friends:search-users:"]);
  },

  /**
   * Block a user
   */
  async blockUser(userId: string): Promise<any> {
    const response = await api.post("/friends/block", { userId });
    clearRequestCache(["friends:list:", "friends:search-users:"]);
    return response.data;
  },

  /**
   * Unblock a user
   */
  async unblockUser(userId: string): Promise<void> {
    await api.delete(`/friends/unblock/${userId}`);
  },

  /**
   * Get all friends (paginated)
   */
  async getFriends(
    page: number = 1,
    limit: number = 20,
  ): Promise<FriendsResponse> {
    return withRequestCache(
      `friends:list:${page}:${limit}`,
      async () => {
        const response = await api.get("/friends", {
          params: { page, limit },
        });
        return response.data.data;
      },
      FRIEND_LIST_TTL_MS,
    );
  },

  /**
   * Get pending friend requests (sent or received)
   */
  async getPendingRequests(
    type: "SENT" | "RECEIVED" = "RECEIVED",
  ): Promise<FriendRequest[]> {
    return withRequestCache(
      `friends:pending:${type}`,
      async () => {
        const response = await api.get("/friends/requests", {
          params: { type },
        });
        return response.data.data;
      },
      FRIEND_COUNTS_TTL_MS,
    );
  },

  /**
   * Search friends for booking
   */
  async searchFriendsForBooking(query?: string): Promise<Friend[]> {
    const response = await api.get("/friends/search", {
      params: { q: query },
    });
    return response.data.data;
  },

  /**
   * Search for users to add as friends
   */
  async searchUsers(
    query: string,
    options?: { signal?: AbortSignal },
  ): Promise<SearchUserResult[]> {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery.length < 2) {
      return [];
    }

    return withRequestCache(
      `friends:search-users:${encodeURIComponent(normalizedQuery)}`,
      async () => {
        const response = await api.get("/friends/search-users", {
          params: { q: normalizedQuery },
          signal: options?.signal,
        });
        return response.data.data;
      },
      FRIEND_USER_SEARCH_TTL_MS,
    );
  },

  /**
   * Get friend status with another user
   */
  async getFriendStatus(targetId: string): Promise<string> {
    const response = await api.get(`/friends/status/${targetId}`);
    return response.data.data.status;
  },

  /**
   * Get count of pending friend requests (received)
   */
  async getPendingRequestsCount(): Promise<{ count: number }> {
    return withRequestCache(
      "friends:pending-count",
      async () => {
        const response = await api.get("/friends/requests/pending-count");
        return response.data.data;
      },
      FRIEND_COUNTS_TTL_MS,
    );
  },
};
