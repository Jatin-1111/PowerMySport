export type MessagePrivacy = "EVERYONE" | "REQUEST_ONLY" | "NONE";
export type ConversationType = "DM" | "GROUP";

export interface CommunityProfile {
  _id: string;
  userId: string;
  anonymousAlias: string;
  isIdentityPublic: boolean;
  messagePrivacy: MessagePrivacy;
  readReceiptsEnabled: boolean;
  lastSeenVisible: boolean;
  blockedUsers: string[];
  lastSeenAt?: string;
}

export interface ConversationItem {
  id: string;
  conversationType?: ConversationType;
  status: "PENDING" | "ACTIVE";
  requestedBy: string;
  otherParticipant: {
    id: string;
    displayName: string;
    isIdentityPublic: boolean;
    photoUrl?: string | null;
    lastSeenAt?: string | null;
  };
  latestMessage?: {
    content: string;
    createdAt: string;
    senderId: string;
  } | null;
  group?: CommunityGroupSummary | null;
  unreadCount: number;
  updatedAt: string;
}

export interface ConversationListResponse {
  items: ConversationItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    hasMore: boolean;
  };
}

export interface CommunityGroupSummary {
  id: string;
  name: string;
  description: string;
  visibility: "PUBLIC";
  memberAddPolicy?: "ADMIN_ONLY" | "ANY_MEMBER";
  sport: string;
  city: string;
  memberCount: number;
  isMember?: boolean;
  isAdmin?: boolean;
}

export interface PlayerSearchResult {
  id: string;
  displayName: string;
  isIdentityPublic: boolean;
  photoUrl?: string | null;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  conversationType?: ConversationType;
  senderId: string;
  senderDisplayName: string;
  content: string;
  createdAt: string;
  readBy?: string[];
  participantIds?: string[];
  messageStatus?: "SENDING" | "SENT" | "FAILED";
}
