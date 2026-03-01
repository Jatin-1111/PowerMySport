export type MessagePrivacy = "EVERYONE" | "REQUEST_ONLY" | "NONE";

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
  unreadCount: number;
  updatedAt: string;
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
  senderId: string;
  senderDisplayName: string;
  content: string;
  createdAt: string;
}
