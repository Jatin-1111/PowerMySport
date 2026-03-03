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
  role: "PLAYER" | "VENUE_LISTER" | "COACH" | "ADMIN" | "SUPER_ADMIN";
  name: string;
  email: string;
}

export const communityService = {
  async ensureSession(): Promise<AuthBridgeSession> {
    const response =
      await axiosInstance.get<ApiResponse<AuthBridgeSession>>("/auth/bridge");
    return response.data.data;
  },

  async searchPlayers(query: string): Promise<PlayerSearchResult[]> {
    const response = await axiosInstance.get<ApiResponse<PlayerSearchResult[]>>(
      "/community/players/search",
      {
        params: { q: query, limit: 8 },
      },
    );

    return response.data.data;
  },

  async getProfile(): Promise<CommunityProfile> {
    const response =
      await axiosInstance.get<ApiResponse<CommunityProfile>>(
        "/community/profile",
      );
    return response.data.data;
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
    return response.data.data;
  },

  async acceptRequest(conversationId: string): Promise<void> {
    await axiosInstance.post(
      `/community/conversations/${conversationId}/accept`,
    );
  },

  async rejectRequest(conversationId: string): Promise<void> {
    await axiosInstance.post(
      `/community/conversations/${conversationId}/reject`,
    );
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

    return response.data.data;
  },

  async listGroups(query = ""): Promise<CommunityGroupSummary[]> {
    const response = await axiosInstance.get<
      ApiResponse<CommunityGroupSummary[]>
    >("/community/groups", {
      params: { q: query, limit: 20 },
    });
    return response.data.data;
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
    return response.data.data;
  },
};
