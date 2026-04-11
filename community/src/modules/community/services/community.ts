import axiosInstance from "@/lib/api/axios";
import {
  CommunityGroupSummary,
  CommunityProfile,
  ConversationListResponse,
  ConversationItem,
  ConversationMessage,
  MessagePrivacy,
  PlayerSearchResult,
} from "../types";

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
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

export const communityService = {
  async ensureSession(): Promise<AuthBridgeSession> {
    const response =
      await axiosInstance.get<ApiResponse<AuthBridgeSession>>("/auth/bridge");
    return response.data.data;
  },

  async searchPlayers(query: string): Promise<PlayerSearchResult[]> {
    const normalizedQuery = query.trim().toLowerCase();
    return withRequestCache(
      `players:${normalizedQuery}`,
      async () => {
        const response = await axiosInstance.get<
          ApiResponse<PlayerSearchResult[]>
        >("/community/players/search", {
          params: { q: query, limit: 8 },
        });

        return response.data.data;
      },
      2000,
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
    targetType: "MESSAGE" | "GROUP";
    targetId: string;
    reason: string;
    details?: string;
  }): Promise<{
    id: string;
    status: string;
    targetType: "MESSAGE" | "GROUP";
    createdAt: string;
  }> {
    const response = await axiosInstance.post<
      ApiResponse<{
        id: string;
        status: string;
        targetType: "MESSAGE" | "GROUP";
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
      targetType: "MESSAGE" | "GROUP";
      targetId: string;
      reason: string;
      details?: string;
      status: string;
      resolutionNote?: string;
      createdAt: string;
      reviewedAt?: string | null;
    }>;
    pagination?: {
      total: number;
      page: number;
      totalPages: number;
    };
  }> {
    const response = await axiosInstance.get<
      ApiResponse<
        Array<{
          id: string;
          targetType: "MESSAGE" | "GROUP";
          targetId: string;
          reason: string;
          details?: string;
          status: string;
          resolutionNote?: string;
          createdAt: string;
          reviewedAt?: string | null;
        }>
      >
    >("/community/reports/my", { params: { page, limit } });
    return {
      items: response.data.data,
      pagination: (
        response.data as unknown as {
          pagination?: { total: number; page: number; totalPages: number };
        }
      ).pagination,
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
};
