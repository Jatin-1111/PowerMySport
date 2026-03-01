import axiosInstance from "@/lib/api/axios";
import {
  CommunityProfile,
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

  async listConversations(): Promise<ConversationItem[]> {
    const response = await axiosInstance.get<ApiResponse<ConversationItem[]>>(
      "/community/conversations",
    );
    return response.data.data;
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
      status: "PENDING" | "ACTIVE";
      requestedBy: string;
    };
    messages: ConversationMessage[];
  }> {
    const response = await axiosInstance.get<
      ApiResponse<{
        conversation: {
          id: string;
          status: "PENDING" | "ACTIVE";
          requestedBy: string;
        };
        messages: ConversationMessage[];
      }>
    >(`/community/conversations/${conversationId}/messages`);
    return response.data.data;
  },

  async sendMessage(conversationId: string, content: string): Promise<void> {
    await axiosInstance.post("/community/messages", {
      conversationId,
      content,
    });
  },
};
