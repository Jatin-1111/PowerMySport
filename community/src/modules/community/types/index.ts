export type MessagePrivacy = "EVERYONE" | "REQUEST_ONLY" | "NONE";
export type ConversationType = "DM" | "GROUP";
export type CommunityUserRole = "Player" | "Coach" | "Parent";
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

/**
 * PUBLIC      — listed in Discover, anyone eligible can join themselves.
 * INVITE_ONLY — listed, but joining needs an invite link or an admin.
 * PRIVATE     — not listed at all; invite link or admin only.
 */
export type CommunityGroupVisibility = "PUBLIC" | "INVITE_ONLY" | "PRIVATE";

export interface CommunityGroupSummary {
  id: string;
  name: string;
  description: string;
  visibility: CommunityGroupVisibility;
  audience?: CommunityGroupAudience;
  memberAddPolicy?: "ADMIN_ONLY" | "ANY_MEMBER";
  sport: string;
  city: string;
  createdBy?: string;
  profilePicture?: string;
  profilePictureKey?: string;
  memberCount: number;
  isMember?: boolean;
  isAdmin?: boolean;
  isOwner?: boolean;
}

export interface CommunityUserSearchResult {
  id: string;
  displayName: string;
  isIdentityPublic: boolean;
  role?: CommunityUserRole;
  photoUrl?: string | null;
  city?: string | null;
  age?: number | null;
  sports: string[];
}

export interface CommunityMemberProfile {
  id: string;
  role: CommunityUserRole;
  displayName: string;
  alias: string;
  isIdentityPublic: boolean;
  photoUrl?: string | null;
  sports: string[];
  city?: string | null;
  age?: number | null;
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

/** The message a reply quotes. Resolved live rather than snapshotted, so an
 *  edit shows through and a deletion is visible instead of leaving stale text
 *  quoted. Null when the original has been hard-removed. */
export interface ConversationReplyPreview {
  id: string;
  senderId: string;
  senderDisplayName: string;
  type: "TEXT" | "IMAGE";
  /** Already clamped and, for images, replaced with a label — never the S3 key. */
  content: string;
  isDeleted: boolean;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  reactedByMe: boolean;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  conversationType?: ConversationType;
  senderId: string;
  senderDisplayName: string;
  /** TEXT: the message text. IMAGE: the S3 object key (never the full URL). */
  content: string;
  /** 'IMAGE' when the message is a shared image, 'TEXT' (default) otherwise. */
  type?: "TEXT" | "IMAGE";
  /** Present for IMAGE messages — pixel dimensions to prevent layout shift. */
  metadata?: {
    width?: number;
    height?: number;
    caption?: string;
  } | null;
  replyTo?: ConversationReplyPreview | null;
  reactions?: MessageReaction[];
  createdAt: string;
  updatedAt?: string;
  editedAt?: string | null;
  isEdited?: boolean;
  isDeleted?: boolean;
  readBy?: string[];
  deliveredTo?: string[];
  participantIds?: string[];
  messageStatus?: "SENDING" | "SENT" | "FAILED";
  /** Local blob URL for optimistic IMAGE preview before S3 upload completes. */
  localPreviewUrl?: string;
}

export type CommunityFeedSort = "NEW" | "TOP" | "UNANSWERED" | "ANSWERED";
export type CommunityFeedSortDirection = "ASC" | "DESC";

export const COMMUNITY_POST_CATEGORIES = [
  "General",
  "Equipment",
  "Coaching",
  "Injury & Recovery",
  "Nutrition",
  "Training",
  "Tournaments",
  "Academics",
] as const;

export type CommunityPostCategory = (typeof COMMUNITY_POST_CATEGORIES)[number];

export interface CommunityAuthorSummary {
  id: string;
  displayName: string;
  isIdentityPublic: boolean;
  photoUrl?: string | null;
  isVerifiedExpert?: boolean;
  /** Server-supplied badge text, so the wording cannot drift between the feed,
   *  the thread and the JSON-LD. Absent when the author is not verified. */
  expertTitle?: string;
  credentialKind?: "VERIFIED_EXPERT" | "VERIFIED_COACH";
}

export interface CommunityPost {
  id: string;
  title: string;
  body: string;
  tags: string[];
  sport: string;
  city: string;
  category: CommunityPostCategory;
  isAnonymous: boolean;
  status: "OPEN" | "CLOSED";
  voteScore: number;
  upvoteCount: number;
  downvoteCount: number;
  answerCount: number;
  viewCount: number;
  myVote: -1 | 0 | 1;
  /** The answer the asker marked as the solution, if they have picked one. */
  acceptedAnswerId?: string | null;
  /** True only for the asker — including on their own anonymous post. */
  canAccept?: boolean;
  createdAt: string;
  updatedAt: string;
  author: CommunityAuthorSummary;
}

export interface CommunityAnswerComment {
  id: string;
  answerId: string;
  postId: string;
  content: string;
  isAnonymous: boolean;
  createdAt: string;
  /** True for the comment's author and for whoever asked the question. */
  canDelete: boolean;
  author: CommunityAuthorSummary;
}

export interface CommunityAnswer {
  id: string;
  postId: string;
  content: string;
  isAnonymous: boolean;
  voteScore: number;
  upvoteCount: number;
  downvoteCount: number;
  myVote: -1 | 0 | 1;
  isAccepted?: boolean;
  comments?: CommunityAnswerComment[];
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

// ─── Blog ─────────────────────────────────────────────────────────────────
export interface SocialLinks {
  youtube?: string;
  instagram?: string;
  facebook?: string;
  twitter?: string;
  github?: string;
  website?: string;
}

export interface BlogAuthorSummary {
  id: string;
  name: string;
  username: string;
  photoUrl: string | null;
}

export interface BlogListItem {
  id: string;
  title: string;
  excerpt: string;
  coverImageKey: string | null;
  coverImageUrl: string | null;
  topic: string;
  tags: string[];
  status: "PUBLISHED" | "DRAFT";
  likeCount: number;
  commentCount: number;
  viewCount: number;
  likedByMe: boolean;
  createdAt: string;
  author: BlogAuthorSummary;
}

export interface BlogDetail extends BlogListItem {
  /** Sanitized rich-text HTML produced by the Tiptap editor. */
  content: string;
  updatedAt: string;
  isMine: boolean;
}

export interface BlogComment {
  id: string;
  blogId: string;
  content: string;
  parentId: string | null;
  likeCount: number;
  likedByMe: boolean;
  createdAt: string;
  author: BlogAuthorSummary;
  replies: BlogComment[];
  isMine: boolean;
}

export interface BlogAuthorProfile {
  userId: string;
  username: string;
  name: string;
  photoUrl: string | null;
  bio: string;
  socialLinks: SocialLinks;
  joinedAt: string;
  blogCount: number;
  totalLikes: number;
  isMe: boolean;
}

export interface BlogListResponse {
  items: BlogListItem[];
  pagination: { total: number; page: number; totalPages: number };
}

export interface BlogCommentListResponse {
  items: BlogComment[];
  pagination: { total: number; page: number; totalPages: number };
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
    conversationId?: string;
    messageId?: string;
    groupId?: string;
    conversationType?: "DM" | "GROUP";
    // Conversation/group lifecycle events
    // COMMUNITY_CONVERSATION_REQUESTED | COMMUNITY_CONVERSATION_ACCEPTED | COMMUNITY_CONVERSATION_REJECTED
    // COMMUNITY_GROUP_JOINED | COMMUNITY_GROUP_LEFT
  };
}

export type CommunityFollowKind = "GROUP" | "TOPIC";

/** As returned by the server: `label` and `href` are resolved from the group or
 *  tag at read time, never stored, so a renamed group shows its current name. */
export interface CommunityFollowRecord {
  kind: CommunityFollowKind;
  targetId: string;
  label: string;
  href: string;
  createdAt: string;
}

export interface CommunityLeaderboardEntry {
  /** Empty when the member keeps their identity private — there is no profile
   *  to open, so the row renders as a name without a link. */
  id: string;
  name: string;
  photoUrl?: string | null;
  isIdentityPublic: boolean;
  rank: number;
  posts: number;
  answers: number;
  upvotes: number;
  score: number;
}

export interface CommunityLeaderboardResponse {
  items: CommunityLeaderboardEntry[];
  /** The caller's own standing, present even when they rank outside the page. */
  me: CommunityLeaderboardEntry | null;
}

export interface CommunitySearchItem {
  kind: "POST" | "BLOG";
  id: string;
  title: string;
  snippet: string;
  href: string;
  sport: string;
  tags: string[];
  answerCount: number;
  isSolved: boolean;
  createdAt: string;
  /** 0-1, normalized per collection so questions and stories rank together. */
  relevance: number;
}

export interface CommunitySearchResponse {
  items: CommunitySearchItem[];
  query: string;
}
