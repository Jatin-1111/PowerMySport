import axiosInstance from "@/lib/api/axios";
import {
  BlockedUser,
  CommunityGroupAudience,
  CommunityUserSearchResult,
  CommunityAnswer,
  CommunityGroupSummary,
  CommunityPost,
  CommunityPostDetailResponse,
  CommunityPostListResponse,
  CommunityProfile,
  CommunityMemberProfile,
  CommunityReputationSummary,
  CommunityActivityItem,
  CommunityVoteResult,
  ConversationListResponse,
  ConversationItem,
  ConversationMessage,
  CommunityFeedSort,
  MessagePrivacy,
} from "../types";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

interface PaginatedApiResponse<T, P> extends ApiResponse<T> {
  pagination?: P;
}

interface AuthBridgeSession {
  id: string;
  role:
    | "PLAYER"
    | "VENUE_LISTER"
    | "COACH"
    | "SUPPORT_ADMIN"
    | "OPERATIONS_ADMIN"
    | "FINANCE_ADMIN"
    | "ANALYTICS_ADMIN"
    | "SYSTEM_ADMIN";
  name: string;
  email: string;
}

type CacheEntry<T> = {
  expiresAt: number;
  value: T;
};

const READ_CACHE_TTL_MS = 5000;
const responseCache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

const getCachedValue = <T>(key: string): T | null => {
  const entry = responseCache.get(key);
  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    responseCache.delete(key);
    return null;
  }

  return entry.value as T;
};

const setCachedValue = <T>(
  key: string,
  value: T,
  ttlMs = READ_CACHE_TTL_MS,
) => {
  responseCache.set(key, {
    value,
    expiresAt: Date.now() + Math.max(0, ttlMs),
  });
};

const withRequestCache = async <T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = READ_CACHE_TTL_MS,
): Promise<T> => {
  const cached = getCachedValue<T>(key);
  if (cached !== null) {
    return cached;
  }

  const existingPromise = inFlightRequests.get(key) as Promise<T> | undefined;
  if (existingPromise) {
    return existingPromise;
  }

  const requestPromise = (async () => {
    const value = await fetcher();
    setCachedValue(key, value, ttlMs);
    return value;
  })();

  inFlightRequests.set(key, requestPromise);

  try {
    return await requestPromise;
  } finally {
    inFlightRequests.delete(key);
  }
};

const clearCacheByPrefixes = (prefixes: string[]) => {
  if (!prefixes.length) {
    responseCache.clear();
    inFlightRequests.clear();
    return;
  }

  for (const key of responseCache.keys()) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      responseCache.delete(key);
    }
  }

  for (const key of inFlightRequests.keys()) {
    if (prefixes.some((prefix) => key.startsWith(prefix))) {
      inFlightRequests.delete(key);
    }
  }
};

const buildConversationsKey = (
  page: number,
  limit: number,
  filters?: {
    mode?: "ALL" | "UNREAD" | "REQUESTS";
    type?: "ALL" | "CONTACTS" | "GROUPS";
    q?: string;
  },
) =>
  [
    "conversations",
    String(page),
    String(limit),
    filters?.mode || "",
    filters?.type || "",
    filters?.q || "",
  ].join(":");

const buildMessagesKey = (conversationId: string) =>
  `messages:${conversationId}`;

const buildGroupsKey = (query: string) =>
  `groups:${query.trim().toLowerCase()}`;
const buildPostsKey = (
  page: number,
  limit: number,
  params?: {
    sort?: CommunityFeedSort;
    q?: string;
    tag?: string;
    sport?: string;
    city?: string;
    mine?: boolean;
  },
) =>
  [
    "posts",
    String(page),
    String(limit),
    params?.sort || "",
    params?.q || "",
    params?.tag || "",
    params?.sport || "",
    params?.city || "",
    params?.mine ? "mine" : "all",
  ].join(":");
const buildPostDetailsKey = (postId: string, page: number, limit: number) =>
  `post:${postId}:${page}:${limit}`;
const buildCommunityNotificationsKey = (
  page: number,
  limit: number,
  isRead?: boolean,
) => `community-notifications:${page}:${limit}:${String(isRead)}`;

const BLOCKED_USERS_CACHE_KEY = "blocked-users";

export const communityService = {
  async ensureSession(): Promise<AuthBridgeSession> {
    const response =
      await axiosInstance.get<ApiResponse<AuthBridgeSession>>("/auth/bridge");
    return response.data.data;
  },

  async searchCommunityUsers(
    query: string,
  ): Promise<CommunityUserSearchResult[]> {
    const normalizedQuery = query.trim().toLowerCase();
    return withRequestCache(
      `players:${normalizedQuery}`,
      async () => {
        const response = await axiosInstance.get<
          ApiResponse<CommunityUserSearchResult[]>
        >("/community/players/search", {
          params: { q: query, limit: 8 },
        });

        return response.data.data;
      },
      2000,
    );
  },

  async searchPlayers(query: string): Promise<CommunityUserSearchResult[]> {
    return this.searchCommunityUsers(query);
  },

  async getPlayerProfile(userId: string): Promise<CommunityMemberProfile> {
    return withRequestCache(
      `player-profile:${userId}`,
      async () => {
        const response = await axiosInstance.get<
          ApiResponse<CommunityMemberProfile>
        >(`/community/players/${userId}/profile`);
        return response.data.data;
      },
      5000,
    );
  },

  async getProfile(): Promise<CommunityProfile> {
    return withRequestCache("profile", async () => {
      const response =
        await axiosInstance.get<ApiResponse<CommunityProfile>>(
          "/community/profile",
        );
      return response.data.data;
    });
  },

  async updateProfile(payload: {
    isIdentityPublic?: boolean;
    messagePrivacy?: MessagePrivacy;
    readReceiptsEnabled?: boolean;
    lastSeenVisible?: boolean;
    anonymousAlias?: string;
  }): Promise<CommunityProfile> {
    const response = await axiosInstance.patch<ApiResponse<CommunityProfile>>(
      "/community/profile",
      payload,
    );
    clearCacheByPrefixes(["profile"]);
    return response.data.data;
  },

  async getBlockedUsers(): Promise<BlockedUser[]> {
    return withRequestCache(
      BLOCKED_USERS_CACHE_KEY,
      async () => {
        const response = await axiosInstance.get<ApiResponse<BlockedUser[]>>(
          "/community/blocked-users",
        );
        return response.data.data;
      },
      3000,
    );
  },

  async blockUser(targetUserId: string): Promise<{ blockedUserId: string }> {
    const response = await axiosInstance.post<
      ApiResponse<{ blockedUserId: string }>
    >("/community/block", {
      targetUserId,
    });
    clearCacheByPrefixes([
      BLOCKED_USERS_CACHE_KEY,
      "conversations",
      "messages:",
    ]);
    return response.data.data;
  },

  async unblockUser(
    targetUserId: string,
  ): Promise<{ unblockedUserId: string }> {
    const response = await axiosInstance.post<
      ApiResponse<{ unblockedUserId: string }>
    >("/community/unblock", {
      targetUserId,
    });
    clearCacheByPrefixes([
      BLOCKED_USERS_CACHE_KEY,
      "conversations",
      "messages:",
    ]);
    return response.data.data;
  },

  async listConversations(
    page = 1,
    limit = 25,
    filters?: {
      mode?: "ALL" | "UNREAD" | "REQUESTS";
      type?: "ALL" | "CONTACTS" | "GROUPS";
      q?: string;
    },
  ): Promise<ConversationListResponse> {
    const cacheKey = buildConversationsKey(page, limit, filters);

    return withRequestCache(cacheKey, async () => {
      const response = await axiosInstance.get<
        ApiResponse<ConversationListResponse | ConversationItem[]>
      >("/community/conversations", {
        params: {
          page,
          limit,
          ...(filters?.mode ? { mode: filters.mode } : {}),
          ...(filters?.type ? { type: filters.type } : {}),
          ...(filters?.q ? { q: filters.q } : {}),
        },
      });

      const raw = response.data.data;
      if (Array.isArray(raw)) {
        return {
          items: raw,
          pagination: {
            page,
            limit,
            total: raw.length,
            hasMore: raw.length >= limit,
          },
        };
      }

      return {
        items: Array.isArray(raw?.items) ? raw.items : [],
        pagination: {
          page: raw?.pagination?.page || page,
          limit: raw?.pagination?.limit || limit,
          total: raw?.pagination?.total || 0,
          hasMore: Boolean(raw?.pagination?.hasMore),
        },
      };
    });
  },

  async listConversationsItems(
    page = 1,
    limit = 25,
    filters?: {
      mode?: "ALL" | "UNREAD" | "REQUESTS";
      type?: "ALL" | "CONTACTS" | "GROUPS";
      q?: string;
    },
  ): Promise<ConversationItem[]> {
    const response = await this.listConversations(page, limit, filters);
    return response.items;
  },

  async startConversation(targetUserId: string): Promise<{
    id: string;
    status: "PENDING" | "ACTIVE";
    requestedBy: string;
  }> {
    const response = await axiosInstance.post<
      ApiResponse<{
        id: string;
        status: "PENDING" | "ACTIVE";
        requestedBy: string;
      }>
    >("/community/conversations/start", {
      targetUserId,
    });
    clearCacheByPrefixes(["conversations", "groups"]);
    return response.data.data;
  },

  async acceptRequest(conversationId: string): Promise<void> {
    await axiosInstance.post(
      `/community/conversations/${conversationId}/accept`,
    );
    clearCacheByPrefixes(["conversations", buildMessagesKey(conversationId)]);
  },

  async rejectRequest(conversationId: string): Promise<void> {
    await axiosInstance.post(
      `/community/conversations/${conversationId}/reject`,
    );
    clearCacheByPrefixes(["conversations", buildMessagesKey(conversationId)]);
  },

  async getMessages(conversationId: string): Promise<{
    conversation: {
      id: string;
      conversationType?: "DM" | "GROUP";
      status: "PENDING" | "ACTIVE";
      requestedBy: string;
      group?: CommunityGroupSummary | null;
    };
    messages: ConversationMessage[];
  }> {
    return withRequestCache(
      buildMessagesKey(conversationId),
      async () => {
        const response = await axiosInstance.get<
          ApiResponse<{
            conversation: {
              id: string;
              conversationType?: "DM" | "GROUP";
              status: "PENDING" | "ACTIVE";
              requestedBy: string;
              group?: CommunityGroupSummary | null;
            };
            messages: ConversationMessage[];
          }>
        >(`/community/conversations/${conversationId}/messages`);
        return response.data.data;
      },
      3000,
    );
  },

  async sendMessage(
    conversationId: string,
    content: string,
  ): Promise<ConversationMessage> {
    const response = await axiosInstance.post<ApiResponse<ConversationMessage>>(
      "/community/messages",
      {
        conversationId,
        content,
      },
    );
    clearCacheByPrefixes(["conversations", buildMessagesKey(conversationId)]);
    return response.data.data;
  },

  async editMessage(
    messageId: string,
    content: string,
  ): Promise<ConversationMessage> {
    const response = await axiosInstance.patch<
      ApiResponse<ConversationMessage>
    >(`/community/messages/${messageId}`, { content });
    clearCacheByPrefixes(["conversations", "messages:"]);
    return response.data.data;
  },

  async deleteMessage(messageId: string): Promise<ConversationMessage> {
    const response = await axiosInstance.delete<
      ApiResponse<ConversationMessage>
    >(`/community/messages/${messageId}`);
    clearCacheByPrefixes(["conversations", "messages:"]);
    return response.data.data;
  },

  async listGroups(query = ""): Promise<CommunityGroupSummary[]> {
    return withRequestCache(
      buildGroupsKey(query),
      async () => {
        const response = await axiosInstance.get<
          ApiResponse<CommunityGroupSummary[]>
        >("/community/groups", {
          params: { q: query, limit: 20 },
        });
        return response.data.data;
      },
      5000,
    );
  },

  async createGroup(payload: {
    name: string;
    description?: string;
    sport?: string;
    city?: string;
    audience?: CommunityGroupAudience;
  }): Promise<CommunityGroupSummary & { conversationId: string }> {
    const response = await axiosInstance.post<
      ApiResponse<CommunityGroupSummary & { conversationId: string }>
    >("/community/groups", payload);
    clearCacheByPrefixes(["groups", "conversations"]);
    return response.data.data;
  },

  async joinGroup(groupId: string): Promise<{
    groupId: string;
    conversationId: string;
    memberCount: number;
  }> {
    const response = await axiosInstance.post<
      ApiResponse<{
        groupId: string;
        conversationId: string;
        memberCount: number;
      }>
    >(`/community/groups/${groupId}/join`);
    clearCacheByPrefixes(["groups", "conversations"]);
    return response.data.data;
  },

  async leaveGroup(groupId: string): Promise<{
    groupId: string;
    removed: boolean;
    deletedGroup?: boolean;
  }> {
    const response = await axiosInstance.post<
      ApiResponse<{
        groupId: string;
        removed: boolean;
        deletedGroup?: boolean;
      }>
    >(`/community/groups/${groupId}/leave`);
    clearCacheByPrefixes(["groups", "conversations"]);
    return response.data.data;
  },

  async addGroupMember(
    groupId: string,
    targetUserId: string,
  ): Promise<{
    groupId: string;
    conversationId: string;
    memberCount: number;
    addedUserId: string;
    alreadyMember?: boolean;
  }> {
    const response = await axiosInstance.post<
      ApiResponse<{
        groupId: string;
        conversationId: string;
        memberCount: number;
        addedUserId: string;
        alreadyMember?: boolean;
      }>
    >(`/community/groups/${groupId}/members`, {
      targetUserId,
    });
    clearCacheByPrefixes(["groups", "conversations"]);
    return response.data.data;
  },

  async updateGroupSettings(
    groupId: string,
    payload: { memberAddPolicy: "ADMIN_ONLY" | "ANY_MEMBER" },
  ): Promise<{
    groupId: string;
    memberAddPolicy: "ADMIN_ONLY" | "ANY_MEMBER";
  }> {
    const response = await axiosInstance.patch<
      ApiResponse<{
        groupId: string;
        memberAddPolicy: "ADMIN_ONLY" | "ANY_MEMBER";
      }>
    >(`/community/groups/${groupId}/settings`, payload);
    clearCacheByPrefixes(["groups"]);
    return response.data.data;
  },

  async reportContent(payload: {
    targetType: "MESSAGE" | "GROUP" | "POST" | "ANSWER";
    targetId: string;
    reason: string;
    details?: string;
  }): Promise<{
    id: string;
    status: string;
    targetType: "MESSAGE" | "GROUP" | "POST" | "ANSWER";
    createdAt: string;
  }> {
    const response = await axiosInstance.post<
      ApiResponse<{
        id: string;
        status: string;
        targetType: "MESSAGE" | "GROUP" | "POST" | "ANSWER";
        createdAt: string;
      }>
    >("/community/reports", payload);
    return response.data.data;
  },

  async listMyReports(
    page = 1,
    limit = 20,
  ): Promise<{
    items: Array<{
      id: string;
      targetType: "MESSAGE" | "GROUP" | "POST" | "ANSWER";
      targetId: string;
      reason: string;
      details?: string;
      status: string;
      resolutionNote?: string;
      createdAt: string;
      reviewedAt?: string | null;
      messageAudit?: {
        senderId?: string;
        createdAt?: string | null;
        updatedAt?: string | null;
        editedAt?: string | null;
        deletedAt?: string | null;
        wasEdited: boolean;
        wasDeleted: boolean;
      };
    }>;
    pagination?: {
      total: number;
      page: number;
      totalPages: number;
    };
  }> {
    const response = await axiosInstance.get<
      PaginatedApiResponse<
        Array<{
          id: string;
          targetType: "MESSAGE" | "GROUP" | "POST" | "ANSWER";
          targetId: string;
          reason: string;
          details?: string;
          status: string;
          resolutionNote?: string;
          createdAt: string;
          reviewedAt?: string | null;
          messageAudit?: {
            senderId?: string;
            createdAt?: string | null;
            updatedAt?: string | null;
            editedAt?: string | null;
            deletedAt?: string | null;
            wasEdited: boolean;
            wasDeleted: boolean;
          };
        }>,
        { total: number; page: number; totalPages: number }
      >
    >("/community/reports/my", { params: { page, limit } });
    return {
      items: response.data.data,
      pagination: response.data.pagination,
    };
  },

  async getGroupMembers(groupId: string): Promise<
    Array<{
      id: string;
      name: string;
      displayName: string;
      photoUrl?: string | null;
      isIdentityPublic: boolean;
      alias: string;
    }>
  > {
    const response = await axiosInstance.get<
      ApiResponse<
        Array<{
          id: string;
          name: string;
          displayName: string;
          photoUrl?: string | null;
          isIdentityPublic: boolean;
          alias: string;
        }>
      >
    >(`/community/groups/${groupId}/members`);
    return response.data.data;
  },

  async joinGroupByCode(inviteCode: string): Promise<{
    groupId: string;
    conversationId: string;
    memberCount: number;
  }> {
    const response = await axiosInstance.post<
      ApiResponse<{
        groupId: string;
        conversationId: string;
        memberCount: number;
      }>
    >(`/community/groups/join-by-code/${inviteCode}`);
    clearCacheByPrefixes(["groups", "conversations"]);
    return response.data.data;
  },

  async getGroupInviteCode(groupId: string): Promise<{
    groupId: string;
    inviteCode: string;
  }> {
    const response = await axiosInstance.get<
      ApiResponse<{
        groupId: string;
        inviteCode: string;
      }>
    >(`/community/groups/${groupId}/invite-code`);
    return response.data.data;
  },

  async getMyReputation(): Promise<CommunityReputationSummary> {
    return withRequestCache(
      "reputation:me",
      async () => {
        const response = await axiosInstance.get<
          ApiResponse<CommunityReputationSummary>
        >("/community/reputation");
        return response.data.data;
      },
      5000,
    );
  },

  async listPosts(
    page = 1,
    limit = 20,
    params?: {
      sort?: CommunityFeedSort;
      q?: string;
      tag?: string;
      sport?: string;
      city?: string;
      mine?: boolean;
    },
  ): Promise<CommunityPostListResponse> {
    const cacheKey = buildPostsKey(page, limit, params);
    return withRequestCache(cacheKey, async () => {
      const response = await axiosInstance.get<
        ApiResponse<CommunityPostListResponse>
      >("/community/posts", {
        params: {
          page,
          limit,
          ...(params?.sort ? { sort: params.sort } : {}),
          ...(params?.q ? { q: params.q } : {}),
          ...(params?.tag ? { tag: params.tag } : {}),
          ...(params?.sport ? { sport: params.sport } : {}),
          ...(params?.city ? { city: params.city } : {}),
          ...(params?.mine ? { mine: true } : {}),
        },
      });
      return response.data.data;
    });
  },

  async listMyKnowledgeActivity(limit = 20): Promise<CommunityActivityItem[]> {
    return withRequestCache(`qna-activity:${limit}`, async () => {
      const notifications = await this.listCommunityNotifications(1, limit);
      return notifications.items.filter(
        (item) =>
          item.data?.event === "COMMUNITY_ANSWER_CREATED" ||
          item.data?.event === "COMMUNITY_UPVOTE_RECEIVED",
      );
    });
  },

  async listCommunityNotifications(
    page = 1,
    limit = 25,
    isRead?: boolean,
  ): Promise<{
    items: CommunityActivityItem[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  }> {
    const cacheKey = buildCommunityNotificationsKey(page, limit, isRead);
    return withRequestCache(cacheKey, async () => {
      const response = await axiosInstance.get<{
        success: boolean;
        data: Array<{
          _id: string;
          title: string;
          message: string;
          isRead: boolean;
          createdAt: string;
          data?: {
            event?: string;
            postId?: string;
            targetId?: string;
            targetType?: "POST" | "ANSWER";
            actorUserId?: string;
            conversationId?: string;
            messageId?: string;
            groupId?: string;
            conversationType?: "DM" | "GROUP";
          };
        }>;
        pagination?: {
          page?: number;
          limit?: number;
          total?: number;
          pages?: number;
        };
      }>("/notifications", {
        params: {
          category: "COMMUNITY",
          page,
          limit,
          ...(typeof isRead === "boolean" ? { isRead } : {}),
        },
      });

      const items = (response.data.data || []).map((item) => ({
        id: item._id,
        title: item.title,
        message: item.message,
        isRead: item.isRead,
        createdAt: item.createdAt,
        data: item.data,
      }));

      return {
        items,
        pagination: {
          page: response.data.pagination?.page || page,
          limit: response.data.pagination?.limit || limit,
          total: response.data.pagination?.total || 0,
          pages: response.data.pagination?.pages || 0,
        },
      };
    });
  },

  async getCommunityUnreadNotificationCount(): Promise<number> {
    return withRequestCache("community-unread-count", async () => {
      const response = await axiosInstance.get<{
        success: boolean;
        count: number;
      }>("/notifications/unread-count", {
        params: {
          category: "COMMUNITY",
        },
      });
      return response.data.count || 0;
    });
  },

  async markCommunityNotificationRead(notificationId: string): Promise<void> {
    await axiosInstance.patch(`/notifications/${notificationId}/read`);
    clearCacheByPrefixes([
      "qna-activity",
      "community-notifications",
      "community-unread-count",
    ]);
  },

  async markAllCommunityNotificationsRead(): Promise<number> {
    let totalMarked = 0;
    let page = 1;
    const limit = 100;

    while (true) {
      const unread = await this.listCommunityNotifications(page, limit, false);
      const ids = unread.items.map((item) => item.id);

      if (!ids.length) {
        break;
      }

      await Promise.all(
        ids.map((id) => axiosInstance.patch(`/notifications/${id}/read`)),
      );

      totalMarked += ids.length;

      if (ids.length < limit) {
        break;
      }

      page += 1;
    }

    clearCacheByPrefixes([
      "qna-activity",
      "community-notifications",
      "community-unread-count",
    ]);

    return totalMarked;
  },

  async getPostDetails(
    postId: string,
    page = 1,
    limit = 30,
  ): Promise<CommunityPostDetailResponse> {
    return withRequestCache(
      buildPostDetailsKey(postId, page, limit),
      async () => {
        const response = await axiosInstance.get<
          ApiResponse<CommunityPostDetailResponse>
        >(`/community/posts/${postId}`, {
          params: { page, limit },
        });
        return response.data.data;
      },
    );
  },

  async createPost(payload: {
    title: string;
    body: string;
    tags?: string[];
    sport?: string;
    city?: string;
  }): Promise<CommunityPost> {
    const response = await axiosInstance.post<ApiResponse<CommunityPost>>(
      "/community/posts",
      payload,
    );
    clearCacheByPrefixes(["posts", "reputation:me", "qna-activity"]);
    return response.data.data;
  },

  async updatePost(
    postId: string,
    payload: {
      title?: string;
      body?: string;
      tags?: string[];
      status?: "OPEN" | "CLOSED";
      sport?: string;
      city?: string;
    },
  ): Promise<CommunityPost> {
    const response = await axiosInstance.patch<ApiResponse<CommunityPost>>(
      `/community/posts/${postId}`,
      payload,
    );
    clearCacheByPrefixes(["posts", `post:${postId}:`, "qna-activity"]);
    return response.data.data;
  },

  async deletePost(postId: string): Promise<{ id: string; deleted: boolean }> {
    const response = await axiosInstance.delete<
      ApiResponse<{ id: string; deleted: boolean }>
    >(`/community/posts/${postId}`);
    clearCacheByPrefixes([
      "posts",
      `post:${postId}:`,
      "reputation:me",
      "qna-activity",
    ]);
    return response.data.data;
  },

  async createAnswer(
    postId: string,
    content: string,
  ): Promise<CommunityAnswer> {
    const response = await axiosInstance.post<ApiResponse<CommunityAnswer>>(
      `/community/posts/${postId}/answers`,
      { content },
    );
    clearCacheByPrefixes([
      "posts",
      `post:${postId}:`,
      "reputation:me",
      "qna-activity",
    ]);
    return response.data.data;
  },

  async updateAnswer(
    answerId: string,
    content: string,
  ): Promise<CommunityAnswer> {
    const response = await axiosInstance.patch<ApiResponse<CommunityAnswer>>(
      `/community/answers/${answerId}`,
      { content },
    );
    clearCacheByPrefixes(["posts", "post:", "qna-activity"]);
    return response.data.data;
  },

  async deleteAnswer(
    answerId: string,
  ): Promise<{ id: string; postId: string; deleted: boolean }> {
    const response = await axiosInstance.delete<
      ApiResponse<{ id: string; postId: string; deleted: boolean }>
    >(`/community/answers/${answerId}`);
    clearCacheByPrefixes(["posts", "post:", "qna-activity"]);
    return response.data.data;
  },

  async vote(payload: {
    targetType: "POST" | "ANSWER";
    targetId: string;
    value: 1 | -1;
  }): Promise<CommunityVoteResult> {
    const response = await axiosInstance.post<ApiResponse<CommunityVoteResult>>(
      "/community/votes",
      payload,
    );
    clearCacheByPrefixes(["posts", "post:", "reputation:me", "qna-activity"]);
    return response.data.data;
  },
};
