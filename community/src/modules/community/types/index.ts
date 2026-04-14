export type MessagePrivacy = "EVERYONE" | "REQUEST_ONLY" | "NONE";
export type ConversationType = "DM" | "GROUP";
export type CommunityUserRole = "PLAYER" | "COACH";
export type CommunityGroupAudience = "ALL" | "PLAYERS_ONLY" | "COACHES_ONLY";

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
  audience?: CommunityGroupAudience;
  memberAddPolicy?: "ADMIN_ONLY" | "ANY_MEMBER";
  sport: string;
  city: string;
  memberCount: number;
  isMember?: boolean;
  isAdmin?: boolean;
}

export interface CommunityUserSearchResult {
  id: string;
  displayName: string;
  isIdentityPublic: boolean;
  role?: CommunityUserRole;
  photoUrl?: string | null;
}

export interface CommunityMemberProfile {
  id: string;
  role: CommunityUserRole;
  displayName: string;
  alias: string;
  isIdentityPublic: boolean;
  photoUrl?: string | null;
  sports: string[];
  dob?: string | null;
  createdAt: string;
  lastActiveAt?: string | null;
  messagePrivacy: MessagePrivacy;
  readReceiptsEnabled: boolean;
  lastSeenVisible: boolean;
  lastSeenAt?: string | null;
}

export type PlayerSearchResult = CommunityUserSearchResult;

export interface BlockedUser {
  id: string;
  name: string;
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
  updatedAt?: string;
  editedAt?: string | null;
  isEdited?: boolean;
  isDeleted?: boolean;
  readBy?: string[];
  participantIds?: string[];
  messageStatus?: "SENDING" | "SENT" | "FAILED";
}

export type CommunityFeedSort = "NEW" | "TOP" | "UNANSWERED";

export interface CommunityAuthorSummary {
  id: string;
  displayName: string;
  isIdentityPublic: boolean;
  photoUrl?: string | null;
}

export interface CommunityPost {
  id: string;
  title: string;
  body: string;
  tags: string[];
  sport: string;
  city: string;
  status: "OPEN" | "CLOSED";
  voteScore: number;
  upvoteCount: number;
  downvoteCount: number;
  answerCount: number;
  viewCount: number;
  myVote: -1 | 0 | 1;
  createdAt: string;
  updatedAt: string;
  author: CommunityAuthorSummary;
}

export interface CommunityAnswer {
  id: string;
  postId: string;
  content: string;
  voteScore: number;
  upvoteCount: number;
  downvoteCount: number;
  myVote: -1 | 0 | 1;
  createdAt: string;
  updatedAt: string;
  author: CommunityAuthorSummary;
}

export interface CommunityPostListResponse {
  items: CommunityPost[];
  pagination: {
    total: number;
    page: number;
    totalPages: number;
  };
}

export interface CommunityPostDetailResponse {
  post: CommunityPost;
  answers: CommunityAnswer[];
  pagination: {
    total: number;
    page: number;
    totalPages: number;
  };
}

export interface CommunityReputationSummary {
  userId: string;
  totalPoints: number;
  questionCount: number;
  answerCount: number;
  receivedUpvotes: number;
}

export interface CommunityVoteResult {
  targetType: "POST" | "ANSWER";
  targetId: string;
  postId?: string;
  myVote: -1 | 0 | 1;
  voteScore: number;
  upvoteCount: number;
  downvoteCount: number;
}

export interface CommunityActivityItem {
  id: string;
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
  };
}
