"use client";

import { getCommunitySocket } from "@/lib/realtime/socket";
import { getMainAppUrl, redirectToMainLogin } from "@/lib/auth/redirect";
import { isCommunityEligibleRole } from "@/lib/auth/roles";
import { toast } from "@/lib/toast";
import { CommunityPageHeader } from "@/modules/community/components/CommunityPageHeader";
import { FeaturedCommunitiesStrip } from "@/modules/community/components/FeaturedCommunitiesStrip";
import {
  GroupMembersList,
  GroupMember,
} from "@/modules/community/components/GroupMembersList";
import { CommunityMemberProfileModal } from "@/modules/community/components/CommunityMemberProfileModal";
import { GroupInviteLink } from "@/modules/community/components/GroupInviteLink";
import { communityService } from "@/modules/community/services/community";
import { communityFollowStore } from "@/modules/community/lib/followStore";
import {
  CommunityUserSearchResult,
  CommunityGroupSummary,
  CommunityProfile,
  CommunityMemberProfile,
  ConversationListResponse,
  ConversationItem,
  ConversationMessage,
} from "@/modules/community/types";
import {
  Activity,
  ChevronLeft,
  Check,
  CheckCheck,
  Copy,
  ExternalLink,
  Flag,
  MessageSquare,
  Pencil,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Search,
  Trash2,
  UserCircle2,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

const COMMUNITY_ACTIVE_TAB_KEY = "community:activeSidebarTab";
const COMMUNITY_WORKSPACE_VIEW_KEY = "community:workspaceView";
const COMMUNITY_DIRECTORY_VIEW_KEY = "community:directoryView";
const COMMUNITY_SELECTED_CONVERSATION_KEY = "community:selectedConversationId";
const COMMUNITY_SIDEBAR_MODE_KEY = "community:sidebarMode";
const CONVERSATION_PAGE_SIZE = 25;
const DISCONNECTED_POLL_BASE_MS = 2500;
const DISCONNECTED_POLL_MAX_MS = 30000;
const MESSAGE_EDIT_DELETE_WINDOW_MS = 30 * 60 * 1000;

const messageTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

const shellVariants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

const panelVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

const getRelativeTime = (value?: string | null) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000));
  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
};

const getMessageTimestamp = (value?: string | null) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return messageTimeFormatter.format(date);
};

const getAvatarCharacter = (value?: string | null): string => {
  const normalized = (value || "").trim();
  if (!normalized) {
    return "?";
  }

  return normalized.charAt(0).toUpperCase();
};

const isWithinMessageEditWindow = (createdAt?: string | null): boolean => {
  if (!createdAt) {
    return false;
  }

  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) {
    return false;
  }

  return Date.now() - created <= MESSAGE_EDIT_DELETE_WINDOW_MS;
};

type ConversationListItemProps = {
  conversation: ConversationItem;
  isSelected: boolean;
  onOpenConversation: (conversationId: string) => void;
};

const ConversationListItem = memo(function ConversationListItem({
  conversation,
  isSelected,
  onOpenConversation,
}: ConversationListItemProps) {
  const conversationName =
    conversation.conversationType === "GROUP"
      ? conversation.group?.name || conversation.otherParticipant.displayName
      : conversation.otherParticipant.displayName;
  const conversationPhotoUrl =
    conversation.conversationType === "GROUP"
      ? null
      : (conversation.otherParticipant.photoUrl ?? null);
  const conversationAvatarChar = getAvatarCharacter(conversationName);

  return (
    <motion.button
      onClick={() => onOpenConversation(conversation.id)}
      whileTap={{ scale: 0.995 }}
      className={`w-full min-h-18 border-b border-slate-100 px-3.5 py-2.5 text-left transition-all last:border-b-0 ${
        isSelected ? "bg-power-orange/10" : "bg-white hover:bg-slate-50"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {/* WhatsApp-style avatar */}
          <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-slate-200 to-slate-300 text-sm font-bold uppercase text-slate-700 shadow-sm">
            {conversationPhotoUrl ? (
              <img
                src={conversationPhotoUrl}
                alt={conversationName}
                className="h-full w-full object-cover"
                loading="lazy"
              />
            ) : (
              conversationAvatarChar
            )}
          </div>
          <div className="min-w-0 flex-1">
            {/* Name with status badge */}
            <div className="flex items-center gap-2">
              <p className="truncate text-[15px] font-500 text-slate-900">
                {conversationName}
              </p>
              {conversation.status === "PENDING" && (
                <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                  Pending
                </span>
              )}
            </div>
            {/* Message preview */}
            <p className="mt-1 line-clamp-1 text-sm text-slate-500">
              {conversation.status === "PENDING"
                ? "Message request"
                : conversation.latestMessage?.content || "No messages yet"}
            </p>
          </div>
        </div>
        {/* Time and unread badge */}
        <div className="flex shrink-0 flex-col items-end gap-1">
          {conversation.latestMessage?.createdAt && (
            <span className="text-[11px] font-normal leading-none tabular-nums text-slate-400">
              {getRelativeTime(conversation.latestMessage.createdAt)}
            </span>
          )}
          {conversation.unreadCount > 0 && (
            <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-power-orange px-1.5 py-0.5 text-[11px] font-bold text-white">
              {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </motion.button>
  );
});

type MessageBubbleProps = {
  message: ConversationMessage;
  isOwnMessage: boolean;
  isGroupConversation: boolean;
  profileUserId?: string;
  onOpenMobileActions?: (message: ConversationMessage) => void;
  onRetry: (message: ConversationMessage) => void;
  onEdit: (message: ConversationMessage) => void;
  onDelete: (message: ConversationMessage) => void;
  onCopy: (message: ConversationMessage) => void;
  isCopied: boolean;
  isEditing: boolean;
  isMutating: boolean;
};

const MessageBubble = memo(function MessageBubble({
  message,
  isOwnMessage,
  isGroupConversation,
  profileUserId,
  onOpenMobileActions,
  onRetry,
  onEdit,
  onDelete,
  onCopy,
  isCopied,
  isEditing,
  isMutating,
}: MessageBubbleProps) {
  const participantIds = Array.isArray(message.participantIds)
    ? message.participantIds
    : [];

  let otherParticipantId: string | undefined;
  for (const participantId of participantIds) {
    if (participantId !== profileUserId) {
      otherParticipantId = participantId;
      break;
    }
  }

  const hasBeenSeenByOther = Boolean(
    isOwnMessage &&
    otherParticipantId &&
    message.readBy?.includes(otherParticipantId),
  );
  const canMutateMessage =
    isOwnMessage &&
    !message.isDeleted &&
    message.messageStatus !== "FAILED" &&
    isWithinMessageEditWindow(message.createdAt);
  const bubbleShapeClass = isOwnMessage
    ? "rounded-2xl rounded-br-[5px]"
    : "rounded-2xl rounded-bl-[5px]";
  const canOpenMobileActions =
    (isOwnMessage && message.messageStatus === "FAILED") ||
    !message.isDeleted ||
    (isOwnMessage &&
      !message.isDeleted &&
      message.messageStatus !== "FAILED" &&
      canMutateMessage);
  const senderAvatarChar = getAvatarCharacter(message.senderDisplayName);
  const longPressTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const clearLongPressTimeout = useCallback(() => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }, []);

  const openMobileActions = useCallback(() => {
    if (!onOpenMobileActions || !canOpenMobileActions) {
      return;
    }

    onOpenMobileActions(message);
  }, [canOpenMobileActions, message, onOpenMobileActions]);

  const startLongPress = useCallback(() => {
    if (!onOpenMobileActions || !canOpenMobileActions) {
      return;
    }

    if (typeof window !== "undefined") {
      const isMobileViewport = window.matchMedia("(max-width: 639px)").matches;
      if (!isMobileViewport) {
        return;
      }
    }

    clearLongPressTimeout();
    longPressTimeoutRef.current = setTimeout(() => {
      openMobileActions();
      clearLongPressTimeout();
    }, 380);
  }, [
    canOpenMobileActions,
    clearLongPressTimeout,
    onOpenMobileActions,
    openMobileActions,
  ]);

  useEffect(() => {
    return () => {
      clearLongPressTimeout();
    };
  }, [clearLongPressTimeout]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className={`flex gap-2 ${isOwnMessage ? "justify-end" : "justify-start"}`}
    >
      {/* Avatar for group incoming messages */}
      {!isOwnMessage && isGroupConversation && (
        <div className="mt-auto inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-bold uppercase text-slate-700">
          {senderAvatarChar}
        </div>
      )}

      <div
        className={`max-w-[84%] ${bubbleShapeClass} px-3 py-1.5 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.1)] sm:max-w-[78%] sm:px-3.5 sm:py-2 sm:text-sm lg:max-w-[65%] ${
          isOwnMessage
            ? "bg-[linear-gradient(135deg,#E97316,#F59E0B)] text-white"
            : "border border-slate-200 bg-white text-slate-800"
        }`}
        onTouchStart={startLongPress}
        onTouchEnd={clearLongPressTimeout}
        onTouchCancel={clearLongPressTimeout}
        onMouseDown={startLongPress}
        onMouseUp={clearLongPressTimeout}
        onMouseLeave={clearLongPressTimeout}
        onContextMenu={(event) => {
          if (typeof window !== "undefined") {
            const isMobileViewport =
              window.matchMedia("(max-width: 639px)").matches;
            if (isMobileViewport && canOpenMobileActions) {
              event.preventDefault();
              openMobileActions();
            }
          }
        }}
      >
        {/* Sender name for group messages */}
        {isGroupConversation && !isOwnMessage && (
          <div className="mb-0.5 text-[12px] font-600 text-power-orange">
            {message.senderDisplayName}
          </div>
        )}

        {/* Message content */}
        <div className="whitespace-pre-wrap wrap-break-word leading-5 sm:leading-6">
          {message.content}
        </div>

        {/* Message metadata footer - WhatsApp style */}
        <div
          className={`mt-1 flex flex-wrap items-center gap-1.5 text-[11px] sm:gap-2 sm:text-xs ${
            isOwnMessage ? "justify-end" : "justify-start"
          } ${isOwnMessage ? "text-orange-100/90" : "text-slate-500"}`}
        >
          {message.isDeleted && (
            <span className="italic opacity-75">Deleted</span>
          )}
          {message.isEdited && !message.isDeleted && (
            <span className="opacity-75">(edited)</span>
          )}
          <span className="font-normal leading-none tracking-[0.01em] tabular-nums opacity-90">
            {getMessageTimestamp(message.createdAt)}
          </span>
          {isOwnMessage &&
            (message.messageStatus === "FAILED" ? (
              <span className="font-medium text-red-100/95">!</span>
            ) : message.messageStatus === "SENDING" ? (
              <span className="font-medium opacity-80">...</span>
            ) : hasBeenSeenByOther ? (
              <span
                aria-label="Seen"
                title="Seen"
                className="inline-flex items-center text-sky-200"
              >
                <CheckCheck size={14} strokeWidth={2.2} />
              </span>
            ) : (
              <span
                aria-label="Sent"
                title="Sent"
                className="inline-flex items-center opacity-85"
              >
                <Check size={13} strokeWidth={2.2} />
              </span>
            ))}
        </div>

        {/* Desktop action buttons */}
        <div
          className={`mt-1.5 hidden flex-wrap items-center gap-1 sm:mt-2 sm:flex sm:gap-1.5 ${
            isOwnMessage ? "justify-end" : "justify-start"
          }`}
        >
          {isOwnMessage && message.messageStatus === "FAILED" && (
            <button
              onClick={() => onRetry(message)}
              aria-label="Retry sending message"
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition hover:opacity-80 ${
                isOwnMessage ? "text-orange-100/90" : "text-slate-600"
              }`}
              title="Retry"
            >
              <RotateCcw size={12} />
              <span>Retry</span>
            </button>
          )}
          {!message.isDeleted && (
            <button
              onClick={() => onCopy(message)}
              title={isCopied ? "Copied!" : "Copy"}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition hover:opacity-80 ${
                isOwnMessage ? "text-orange-100/90" : "text-slate-600"
              }`}
            >
              {isCopied ? (
                <>
                  <Check size={12} />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
          {isOwnMessage &&
            !message.isDeleted &&
            message.messageStatus !== "FAILED" && (
              <>
                <button
                  onClick={() => onEdit(message)}
                  disabled={isMutating || !canMutateMessage}
                  title="Edit message"
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isOwnMessage ? "text-orange-100/90" : "text-slate-600"
                  }`}
                >
                  <Pencil size={12} />
                  <span>{isEditing ? "Editing..." : "Edit"}</span>
                </button>
                <button
                  onClick={() => onDelete(message)}
                  disabled={isMutating || !canMutateMessage}
                  title="Delete message"
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isOwnMessage ? "text-orange-100/90" : "text-red-600"
                  }`}
                >
                  <Trash2 size={12} />
                  <span>Delete</span>
                </button>
              </>
            )}
        </div>
      </div>
    </motion.div>
  );
});

const isValidSidebarTab = (
  value: string | null,
): value is "community-overview" | "conversations" =>
  value === "community-overview" || value === "conversations";

const isValidWorkspaceView = (
  value: string | null,
): value is "CHAT" | "DIRECTORY" | "PRIVACY" =>
  value === "CHAT" || value === "DIRECTORY" || value === "PRIVACY";

const isValidDirectoryView = (
  value: string | null,
): value is "ALL" | "CONTACTS" | "GROUPS" =>
  value === "ALL" || value === "CONTACTS" || value === "GROUPS";

const isValidGroupToolsMode = (
  value: string | null,
): value is "DISCOVER" | "MANAGE" | "INVITE" =>
  value === "DISCOVER" || value === "MANAGE" || value === "INVITE";

const resolveSidebarQueryState = (
  value: string | null,
): {
  mode?: "INBOX" | "TOOLS";
  tab?: "community-overview" | "conversations";
} => {
  const normalized = value?.trim().toLowerCase() || "";

  if (!normalized) {
    return {};
  }

  if (normalized === "tools") {
    return { mode: "TOOLS" };
  }

  if (normalized === "inbox") {
    return { mode: "INBOX" };
  }

  // Backward compatibility for historical deep-links.
  if (normalized === "community-overview") {
    return { mode: "INBOX", tab: "community-overview" };
  }

  if (normalized === "conversations") {
    return { mode: "INBOX", tab: "conversations" };
  }

  return {};
};

export default function CommunityPage() {
  const prefersReducedMotion = useReducedMotion();
  const router = useRouter();
  const pathname = usePathname();
  const urlSearchParams = useSearchParams();
  const [searchQuery, setSearchQuery] = useState("");
  const lastAppliedQueryRef = useRef(searchQuery);
  const hasHydratedUrlRef = useRef(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<
    "community-overview" | "conversations"
  >(() => {
    if (typeof window === "undefined") {
      return "community-overview";
    }

    const stored = window.localStorage.getItem(COMMUNITY_ACTIVE_TAB_KEY);
    return isValidSidebarTab(stored) ? stored : "community-overview";
  });
  const [workspaceView, setWorkspaceView] = useState<
    "CHAT" | "DIRECTORY" | "PRIVACY"
  >(() => {
    if (typeof window === "undefined") {
      return "CHAT";
    }

    const stored = window.localStorage.getItem(COMMUNITY_WORKSPACE_VIEW_KEY);
    return isValidWorkspaceView(stored) ? stored : "CHAT";
  });
  const [directoryView, setDirectoryView] = useState<"CONTACTS" | "GROUPS">(
    () => {
      if (typeof window === "undefined") {
        return "CONTACTS";
      }

      const stored = window.localStorage.getItem(COMMUNITY_DIRECTORY_VIEW_KEY);
      if (!isValidDirectoryView(stored)) {
        return "CONTACTS";
      }

      return stored === "GROUPS" ? "GROUPS" : "CONTACTS";
    },
  );
  const [conversationMode, setConversationMode] = useState<
    "ALL" | "UNREAD" | "REQUESTS"
  >("ALL");
  const [groupMode, setGroupMode] = useState<"ALL" | "JOINED" | "DISCOVER">(
    "ALL",
  );
  const [groupToolsMode, setGroupToolsMode] = useState<
    "DISCOVER" | "MANAGE" | "INVITE"
  >("DISCOVER");
  const [conversationFilterQuery, setConversationFilterQuery] = useState("");
  const [sidebarMode, setSidebarMode] = useState<"INBOX" | "TOOLS">(() => {
    if (typeof window === "undefined") {
      return "INBOX";
    }

    return window.localStorage.getItem(COMMUNITY_SIDEBAR_MODE_KEY) === "TOOLS"
      ? "TOOLS"
      : "INBOX";
  });
  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [conversationPage, setConversationPage] = useState(1);
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [isLoadingMoreConversations, setIsLoadingMoreConversations] =
    useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return window.localStorage.getItem(COMMUNITY_SELECTED_CONVERSATION_KEY);
  });
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");
  const [playerSearchResults, setPlayerSearchResults] = useState<
    CommunityUserSearchResult[]
  >([]);
  const [isSearchingPlayers, setIsSearchingPlayers] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [groupResults, setGroupResults] = useState<CommunityGroupSummary[]>([]);
  const [followedGroupIds, setFollowedGroupIds] = useState<string[]>([]);
  const [isSearchingGroups, setIsSearchingGroups] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [newGroupSport, setNewGroupSport] = useState("");
  const [newGroupCity, setNewGroupCity] = useState("");
  const [newGroupAudience, setNewGroupAudience] = useState<
    "ALL" | "PLAYERS_ONLY" | "COACHES_ONLY"
  >("ALL");
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [inviteGroupId, setInviteGroupId] = useState<string | null>(null);
  const [inviteSearchQuery, setInviteSearchQuery] = useState("");
  const [inviteSearchResults, setInviteSearchResults] = useState<
    CommunityUserSearchResult[]
  >([]);
  const [isSearchingInvitePlayers, setIsSearchingInvitePlayers] =
    useState(false);
  const [isAddingMemberUserId, setIsAddingMemberUserId] = useState<
    string | null
  >(null);
  const [isUpdatingGroupPolicyId, setIsUpdatingGroupPolicyId] = useState<
    string | null
  >(null);
  const [isLeavingGroupId, setIsLeavingGroupId] = useState<string | null>(null);
  const [reportModal, setReportModal] = useState<{
    targetType: "MESSAGE" | "GROUP";
    targetId: string;
  } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingMessageDraft, setEditingMessageDraft] = useState("");
  const [isMutatingMessageId, setIsMutatingMessageId] = useState<string | null>(
    null,
  );
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [mobileActionMessageId, setMobileActionMessageId] = useState<
    string | null
  >(null);
  const [isTogglingBlockUser, setIsTogglingBlockUser] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConversationSidebarOpen, setIsConversationSidebarOpen] =
    useState(true);
  const [showGroupMembersPanel, setShowGroupMembersPanel] = useState(false);
  const [isMemberProfileOpen, setIsMemberProfileOpen] = useState(false);
  const [isLoadingMemberProfile, setIsLoadingMemberProfile] = useState(false);
  const [memberProfileError, setMemberProfileError] = useState<string | null>(
    null,
  );
  const [selectedMemberProfile, setSelectedMemberProfile] =
    useState<CommunityMemberProfile | null>(null);
  const selectedConversationIdRef = useRef<string | null>(null);
  const memberProfileRequestIdRef = useRef<string | null>(null);
  const copyFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectedPollDelayRef = useRef(DISCONNECTED_POLL_BASE_MS);
  const isRefreshingConversationsRef = useRef(false);
  const shouldRefreshConversationsRef = useRef(false);

  useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current) {
        clearTimeout(copyFeedbackTimeoutRef.current);
      }
    };
  }, []);

  const safeConversations = useMemo(
    () => (Array.isArray(conversations) ? conversations : []),
    [conversations],
  );
  const safeGroupResults = useMemo(
    () => (Array.isArray(groupResults) ? groupResults : []),
    [groupResults],
  );
  const getConversationById = useCallback(
    (conversationId: string | null) => {
      if (!conversationId) {
        return null;
      }

      for (const conversation of safeConversations) {
        if (conversation.id === conversationId) {
          return conversation;
        }
      }

      return null;
    },
    [safeConversations],
  );
  const getGroupConversationByGroupId = useCallback(
    (groupId: string) => {
      for (const conversation of safeConversations) {
        if (conversation.group?.id === groupId) {
          return conversation;
        }
      }

      return null;
    },
    [safeConversations],
  );

  const selectedConversation = useMemo(
    () => getConversationById(selectedConversationId),
    [getConversationById, selectedConversationId],
  );
  const mobileActionMessage = useMemo(() => {
    if (!mobileActionMessageId) {
      return null;
    }

    return (
      messages.find((message) => message.id === mobileActionMessageId) || null
    );
  }, [messages, mobileActionMessageId]);

  const appendMessage = (incoming: ConversationMessage) => {
    setMessages((current) => {
      const safeCurrent = Array.isArray(current) ? current : [];
      const exists = safeCurrent.some((message) => message.id === incoming.id);
      if (exists) {
        return safeCurrent;
      }
      return [...safeCurrent, incoming];
    });
  };

  const removeMessageById = (messageId: string) => {
    setMessages((current) =>
      (Array.isArray(current) ? current : []).filter(
        (message) => message.id !== messageId,
      ),
    );
  };

  const updateMessageById = (
    messageId: string,
    updater: (message: ConversationMessage) => ConversationMessage,
  ) => {
    setMessages((current) =>
      (Array.isArray(current) ? current : []).map((message) =>
        message.id === messageId ? updater(message) : message,
      ),
    );
  };

  const totalUnread = useMemo(
    () =>
      safeConversations.reduce((sum, item) => sum + (item.unreadCount || 0), 0),
    [safeConversations],
  );
  const pendingRequestsCount = useMemo(
    () =>
      safeConversations.filter(
        (conversation) =>
          conversation.status === "PENDING" &&
          conversation.conversationType !== "GROUP",
      ).length,
    [safeConversations],
  );

  const mainAppUrl = useMemo(() => getMainAppUrl(), []);
  const selectedConversationIsPending =
    selectedConversation?.status === "PENDING" &&
    selectedConversation?.conversationType !== "GROUP";
  const selectedConversationIsBlocked =
    selectedConversation?.conversationType !== "GROUP" &&
    !!selectedConversation?.otherParticipant?.id &&
    (profile?.blockedUsers || []).includes(
      selectedConversation.otherParticipant.id,
    );
  const selectedConversationRequestedByMe =
    selectedConversation?.requestedBy === profile?.userId;
  const selectedConversationNeedsMyApproval =
    selectedConversationIsPending && !selectedConversationRequestedByMe;
  const canSendSelectedConversationMessage =
    Boolean(selectedConversation) &&
    !selectedConversationNeedsMyApproval &&
    !selectedConversationIsBlocked;
  const isCommunityView = activeSidebarTab === "community-overview";
  const isConversationsView = activeSidebarTab === "conversations";
  const showGroupInsightsSidebar =
    isConversationsView &&
    showGroupMembersPanel &&
    selectedConversation?.conversationType === "GROUP";
  const selectedConversationDisplayName = selectedConversation
    ? selectedConversation.conversationType === "GROUP"
      ? selectedConversation.group?.name ||
        selectedConversation.otherParticipant.displayName
      : selectedConversation.otherParticipant.displayName
    : "No conversation selected";
  const selectedConversationPhotoUrl =
    selectedConversation?.conversationType === "GROUP"
      ? null
      : (selectedConversation?.otherParticipant?.photoUrl ?? null);
  const selectedConversationAvatarChar = getAvatarCharacter(
    selectedConversationDisplayName,
  );
  const activeMobileDockTab: "CHAT" | "LIST" | "TOOLS" =
    sidebarMode === "TOOLS"
      ? "TOOLS"
      : workspaceView === "CHAT"
        ? "CHAT"
        : "LIST";
  const groupsJoinedCount = useMemo(
    () => safeGroupResults.filter((group) => group.isMember).length,
    [safeGroupResults],
  );
  const contactConversations = useMemo(
    () =>
      safeConversations.filter(
        (conversation) => conversation.conversationType !== "GROUP",
      ),
    [safeConversations],
  );
  const groupConversations = useMemo(
    () =>
      safeConversations.filter(
        (conversation) => conversation.conversationType === "GROUP",
      ),
    [safeConversations],
  );
  const visibleConversations = useMemo(() => {
    const source =
      directoryView === "GROUPS" ? groupConversations : contactConversations;

    const query = conversationFilterQuery.trim().toLowerCase();
    if (!query) {
      return source;
    }

    return source.filter((conversation) => {
      const displayName =
        conversation.otherParticipant.displayName?.toLowerCase() || "";
      const latestMessage =
        conversation.latestMessage?.content?.toLowerCase() || "";
      return displayName.includes(query) || latestMessage.includes(query);
    });
  }, [
    directoryView,
    contactConversations,
    groupConversations,
    conversationFilterQuery,
  ]);
  const managedConversations = useMemo(() => {
    const byMode =
      conversationMode === "UNREAD"
        ? visibleConversations.filter(
            (conversation) => conversation.unreadCount > 0,
          )
        : conversationMode === "REQUESTS"
          ? visibleConversations.filter(
              (conversation) =>
                conversation.status === "PENDING" &&
                conversation.conversationType !== "GROUP",
            )
          : visibleConversations;

    return [...byMode].sort((a, b) => {
      if (a.status === "PENDING" && b.status !== "PENDING") {
        return -1;
      }
      if (a.status !== "PENDING" && b.status === "PENDING") {
        return 1;
      }
      if ((a.unreadCount || 0) !== (b.unreadCount || 0)) {
        return (b.unreadCount || 0) - (a.unreadCount || 0);
      }

      const aTime = a.latestMessage?.createdAt
        ? new Date(a.latestMessage.createdAt).getTime()
        : 0;
      const bTime = b.latestMessage?.createdAt
        ? new Date(b.latestMessage.createdAt).getTime()
        : 0;
      return bTime - aTime;
    });
  }, [visibleConversations, conversationMode]);
  const hasConversationFilters =
    conversationMode !== "ALL" || !!conversationFilterQuery.trim();
  const isGroupsDirectory = directoryView === "GROUPS";
  const conversationModeOptions: Array<{
    value: "ALL" | "UNREAD" | "REQUESTS";
    label: string;
  }> = isGroupsDirectory
    ? [
        { value: "ALL", label: "All" },
        { value: "UNREAD", label: "Unread" },
      ]
    : [
        { value: "ALL", label: "All" },
        { value: "UNREAD", label: "Unread" },
        { value: "REQUESTS", label: "Requests" },
      ];
  const visibleGroups = useMemo(() => {
    if (groupMode === "JOINED") {
      return safeGroupResults.filter((group) => group.isMember);
    }
    if (groupMode === "DISCOVER") {
      return safeGroupResults.filter((group) => !group.isMember);
    }
    return safeGroupResults;
  }, [safeGroupResults, groupMode]);
  const toolVisibleGroups = useMemo(
    () =>
      visibleGroups.filter((group) => {
        if (groupToolsMode === "DISCOVER") {
          return !group.isMember;
        }

        return !!group.isMember;
      }),
    [visibleGroups, groupToolsMode],
  );
  const toolsSteps = useMemo(() => {
    if (directoryView === "CONTACTS") {
      return [
        { id: "search", label: "Search users", done: true },
        {
          id: "start",
          label: "Start conversation",
          done: Boolean(selectedConversation),
        },
      ];
    }

    return [
      {
        id: "discover",
        label: "Discover",
        done: groupToolsMode !== "DISCOVER",
      },
      {
        id: "manage",
        label: "Manage",
        done: groupToolsMode === "INVITE",
      },
      {
        id: "invite",
        label: "Invite",
        done:
          Boolean(inviteGroupId) ||
          (selectedConversation?.conversationType === "GROUP" &&
            Boolean(selectedConversation.group?.isAdmin)),
      },
    ];
  }, [directoryView, selectedConversation, groupToolsMode, inviteGroupId]);
  const applyConversationPage = useCallback(
    (
      response: ConversationListResponse,
      options?: {
        append?: boolean;
        preserveSelection?: boolean;
      },
    ) => {
      const append = options?.append || false;
      const preserveSelection = options?.preserveSelection ?? true;
      const safeItems = Array.isArray(response.items) ? response.items : [];
      const safePagination = response.pagination || {
        page: 1,
        limit: CONVERSATION_PAGE_SIZE,
        total: safeItems.length,
        hasMore: false,
      };

      setConversations((current) => {
        const safeCurrent = Array.isArray(current) ? current : [];
        if (!append) {
          return safeItems;
        }

        const existingIds = new Set(
          safeCurrent.map((conversation) => conversation.id),
        );
        const nextItems = safeItems.filter(
          (conversation) => !existingIds.has(conversation.id),
        );
        return [...safeCurrent, ...nextItems];
      });

      setConversationPage(safePagination.page);
      setHasMoreConversations(safePagination.hasMore);

      if (!append) {
        setSelectedConversationId((current) => {
          if (!safeItems.length) {
            return null;
          }

          if (
            preserveSelection &&
            current &&
            safeItems.some((conversation) => conversation.id === current)
          ) {
            return current;
          }

          return safeItems[0].id;
        });
      }
    },
    [],
  );

  const refreshConversationsNow = useCallback(async () => {
    if (isRefreshingConversationsRef.current) {
      shouldRefreshConversationsRef.current = true;
      return;
    }

    isRefreshingConversationsRef.current = true;
    try {
      const updated = await communityService.listConversations(
        1,
        CONVERSATION_PAGE_SIZE,
      );
      applyConversationPage(updated, { preserveSelection: true });
    } catch {
      // no-op: non-critical refresh path should not interrupt UX flow
    } finally {
      isRefreshingConversationsRef.current = false;
      if (shouldRefreshConversationsRef.current) {
        shouldRefreshConversationsRef.current = false;
        void refreshConversationsNow();
      }
    }
  }, [applyConversationPage]);

  const queueConversationRefresh = useCallback(
    (delayMs = 180) => {
      if (refreshTimeoutRef.current) {
        return;
      }

      refreshTimeoutRef.current = setTimeout(() => {
        refreshTimeoutRef.current = null;
        void refreshConversationsNow();
      }, delayMs);
    },
    [refreshConversationsNow],
  );
  const featuredGroups = useMemo(() => {
    return [...safeGroupResults]
      .sort((a, b) => {
        if (!!a.isMember !== !!b.isMember) {
          return a.isMember ? 1 : -1;
        }
        return (b.memberCount || 0) - (a.memberCount || 0);
      })
      .slice(0, 6);
  }, [safeGroupResults]);

  const loadBootstrap = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const session = await communityService.ensureSession();
      if (!isCommunityEligibleRole(session.role)) {
        toast.error(
          "Community chat is available only for player and coach accounts",
        );
        redirectToMainLogin();
        return;
      }

      const [profileData, conversationData, groupData] = await Promise.all([
        communityService.getProfile(),
        communityService.listConversations(1, CONVERSATION_PAGE_SIZE),
        communityService.listGroups(),
      ]);
      setProfile(profileData);
      applyConversationPage(conversationData, { preserveSelection: true });
      setGroupResults(groupData);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to load community";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [applyConversationPage]);

  const loadMessages = useCallback(
    async (conversationId: string) => {
      try {
        const response = await communityService.getMessages(conversationId);
        setMessages(Array.isArray(response.messages) ? response.messages : []);
        await refreshConversationsNow();

        const socket = getCommunitySocket();
        if (socket.connected) {
          socket.emit("community:markRead", {
            conversationId,
          });
        }
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Failed to load messages";
        setError(message);
        toast.error(message);
      }
    },
    [refreshConversationsNow],
  );

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    const followed = communityFollowStore
      .getByKind("group")
      .map((item) => item.id);
    setFollowedGroupIds(followed);
  }, []);

  useEffect(() => {
    if (!selectedConversationId || !selectedConversation) {
      setMessages([]);
      return;
    }

    loadMessages(selectedConversationId);
  }, [loadMessages, selectedConversation, selectedConversationId]);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(COMMUNITY_ACTIVE_TAB_KEY, activeSidebarTab);
  }, [activeSidebarTab]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(COMMUNITY_WORKSPACE_VIEW_KEY, workspaceView);
  }, [workspaceView]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(COMMUNITY_DIRECTORY_VIEW_KEY, directoryView);
  }, [directoryView]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(COMMUNITY_SIDEBAR_MODE_KEY, sidebarMode);
  }, [sidebarMode]);

  useEffect(() => {
    setSearchQuery(urlSearchParams.toString());
  }, [urlSearchParams]);

  useEffect(() => {
    if (
      hasHydratedUrlRef.current &&
      searchQuery === lastAppliedQueryRef.current
    ) {
      return;
    }

    const queryParams = new URLSearchParams(searchQuery);
    const sidebarState = resolveSidebarQueryState(queryParams.get("sidebar"));
    const urlDirectoryView =
      queryParams.get("directory")?.toUpperCase() || null;
    const urlGroupToolsMode = queryParams.get("panel")?.toUpperCase() || null;
    const urlConversationId = queryParams.get("conversation") || null;
    const urlQuery = queryParams.get("q") || null;

    if (sidebarState.mode && sidebarState.mode !== sidebarMode) {
      setSidebarMode(sidebarState.mode);
    }

    if (sidebarState.tab && sidebarState.tab !== activeSidebarTab) {
      setActiveSidebarTab(sidebarState.tab);
    }

    if (
      isValidDirectoryView(urlDirectoryView) &&
      (urlDirectoryView === "CONTACTS" || urlDirectoryView === "GROUPS") &&
      urlDirectoryView !== directoryView
    ) {
      setDirectoryView(urlDirectoryView);
    }

    if (
      isValidGroupToolsMode(urlGroupToolsMode) &&
      urlGroupToolsMode !== groupToolsMode
    ) {
      setGroupToolsMode(urlGroupToolsMode);
    }

    if (
      typeof urlConversationId === "string" &&
      urlConversationId.trim() &&
      urlConversationId !== selectedConversationId
    ) {
      setSelectedConversationId(urlConversationId);
    }

    if (
      typeof urlQuery === "string" &&
      urlQuery.trim() &&
      urlQuery !== groupSearchQuery
    ) {
      setGroupSearchQuery(urlQuery.trim());
    }

    hasHydratedUrlRef.current = true;
    lastAppliedQueryRef.current = searchQuery;
  }, [
    searchQuery,
    sidebarMode,
    activeSidebarTab,
    directoryView,
    groupToolsMode,
    selectedConversationId,
    groupSearchQuery,
  ]);

  useEffect(() => {
    const params = new URLSearchParams(searchQuery);
    params.set("sidebar", sidebarMode.toLowerCase());
    params.set("directory", directoryView.toLowerCase());

    if (sidebarMode === "TOOLS" && directoryView === "GROUPS") {
      params.set("panel", groupToolsMode.toLowerCase());
    } else {
      params.delete("panel");
    }

    if (selectedConversationId) {
      params.set("conversation", selectedConversationId);
    } else {
      params.delete("conversation");
    }

    const nextQuery = params.toString();
    if (nextQuery !== lastAppliedQueryRef.current) {
      lastAppliedQueryRef.current = nextQuery;
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
        scroll: false,
      });
    }
  }, [
    searchQuery,
    sidebarMode,
    directoryView,
    groupToolsMode,
    selectedConversationId,
    router,
    pathname,
  ]);

  useEffect(() => {
    if (directoryView === "GROUPS" && conversationMode === "REQUESTS") {
      setConversationMode("ALL");
    }

    if (directoryView !== "GROUPS") {
      setGroupToolsMode("DISCOVER");
    }

    if (directoryView !== "GROUPS") {
      setIsCreateGroupOpen(false);
      setInviteGroupId(null);
    }
  }, [conversationMode, directoryView]);

  useEffect(() => {
    if (activeSidebarTab === "community-overview") {
      if (sidebarMode !== "INBOX") {
        setSidebarMode("INBOX");
      }
      if (workspaceView !== "CHAT") {
        setWorkspaceView("CHAT");
      }
      return;
    }

    if (sidebarMode !== "TOOLS") {
      return;
    }

    if (activeSidebarTab !== "conversations") {
      setActiveSidebarTab("conversations");
    }
    if (workspaceView !== "DIRECTORY") {
      setWorkspaceView("DIRECTORY");
    }
    if (!isConversationSidebarOpen) {
      setIsConversationSidebarOpen(true);
    }
  }, [sidebarMode, activeSidebarTab, workspaceView, isConversationSidebarOpen]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const isMobileViewport = window.matchMedia("(max-width: 1279px)").matches;
    if (!isMobileViewport || !isConversationsView || selectedConversationId) {
      return;
    }

    // WhatsApp-style mobile entry: open chat list first when no chat is selected.
    if (workspaceView !== "DIRECTORY") {
      setWorkspaceView("DIRECTORY");
    }
    if (sidebarMode !== "INBOX") {
      setSidebarMode("INBOX");
    }
    if (!isConversationSidebarOpen) {
      setIsConversationSidebarOpen(true);
    }
  }, [
    isConversationSidebarOpen,
    isConversationsView,
    selectedConversationId,
    sidebarMode,
    workspaceView,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (selectedConversationId) {
      window.localStorage.setItem(
        COMMUNITY_SELECTED_CONVERSATION_KEY,
        selectedConversationId,
      );
      return;
    }

    window.localStorage.removeItem(COMMUNITY_SELECTED_CONVERSATION_KEY);
  }, [selectedConversationId]);

  useEffect(() => {
    if (selectedConversation?.conversationType !== "GROUP") {
      setShowGroupMembersPanel(false);
    }
  }, [selectedConversation?.conversationType]);

  useEffect(() => {
    const query = playerSearchQuery.trim();

    if (query.length < 2) {
      setPlayerSearchResults([]);
      setIsSearchingPlayers(false);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        setIsSearchingPlayers(true);
        const users = await communityService.searchCommunityUsers(query);
        setPlayerSearchResults(users);
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Failed to search users";
        setError(message);
        toast.error(message);
      } finally {
        setIsSearchingPlayers(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [playerSearchQuery]);

  useEffect(() => {
    const timeout = setTimeout(async () => {
      try {
        setIsSearchingGroups(true);
        const groups = await communityService.listGroups(
          groupSearchQuery.trim(),
        );
        setGroupResults(groups);
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Failed to load groups";
        setError(message);
      } finally {
        setIsSearchingGroups(false);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [groupSearchQuery]);

  useEffect(() => {
    if (!inviteGroupId) {
      setInviteSearchResults([]);
      setInviteSearchQuery("");
      setIsSearchingInvitePlayers(false);
      return;
    }

    const query = inviteSearchQuery.trim();
    if (query.length < 2) {
      setInviteSearchResults([]);
      setIsSearchingInvitePlayers(false);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        setIsSearchingInvitePlayers(true);
        const users = await communityService.searchCommunityUsers(query);
        setInviteSearchResults(users);
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Failed to search users";
        setError(message);
        toast.error(message);
      } finally {
        setIsSearchingInvitePlayers(false);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [inviteGroupId, inviteSearchQuery]);

  useEffect(() => {
    const socket = getCommunitySocket();

    const handleConnect = () => {
      setIsSocketConnected(true);
      const currentConversationId = selectedConversationIdRef.current;
      if (currentConversationId && getConversationById(currentConversationId)) {
        socket.emit("community:joinConversation", {
          conversationId: currentConversationId,
        });

        void loadMessages(currentConversationId);
      }

      void refreshConversationsNow();
    };

    const handleDisconnect = () => {
      setIsSocketConnected(false);
    };

    const handleNewMessage = (message: ConversationMessage) => {
      if (message.conversationId === selectedConversationIdRef.current) {
        appendMessage(message);

        socket.emit("community:markRead", {
          conversationId: message.conversationId,
        });
      }

      queueConversationRefresh();
    };

    const handleMessagesRead = (payload: {
      conversationId: string;
      readerId: string;
      messageIds: string[];
    }) => {
      if (payload.conversationId !== selectedConversationIdRef.current) {
        return;
      }

      setMessages((current) =>
        (Array.isArray(current) ? current : []).map((message) => {
          if (!payload.messageIds.includes(message.id)) {
            return message;
          }

          const readBy = message.readBy || [];
          if (readBy.includes(payload.readerId)) {
            return message;
          }

          return {
            ...message,
            readBy: [...readBy, payload.readerId],
          };
        }),
      );
    };

    const handleConversationUpdated = (payload?: {
      conversationId?: string;
    }) => {
      const conversationId = payload?.conversationId;
      if (conversationId && socket.connected) {
        socket.emit("community:joinConversation", {
          conversationId,
        });
      }

      queueConversationRefresh(100);
    };

    const handleMessageEdited = (message: ConversationMessage) => {
      if (message.conversationId !== selectedConversationIdRef.current) {
        queueConversationRefresh();
        return;
      }

      updateMessageById(message.id, (current) => ({
        ...current,
        ...message,
      }));
      queueConversationRefresh(120);
    };

    const handleMessageDeleted = (message: ConversationMessage) => {
      if (message.conversationId !== selectedConversationIdRef.current) {
        queueConversationRefresh();
        return;
      }

      updateMessageById(message.id, (current) => ({
        ...current,
        ...message,
      }));
      queueConversationRefresh(120);
    };

    const handleCommunityError = (payload: { message: string }) => {
      setError(payload.message);
    };

    const handleConnectError = (connectError: Error) => {
      setIsSocketConnected(false);
      if (/unauthorized|authentication/i.test(connectError.message)) {
        redirectToMainLogin();
      }
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("community:newMessage", handleNewMessage);
    socket.on("community:messagesRead", handleMessagesRead);
    socket.on("community:conversationUpdated", handleConversationUpdated);
    socket.on("community:messageEdited", handleMessageEdited);
    socket.on("community:messageDeleted", handleMessageDeleted);
    socket.on("community:error", handleCommunityError);
    socket.on("connect_error", handleConnectError);

    if (socket.connected) {
      handleConnect();
    } else {
      socket.connect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("community:newMessage", handleNewMessage);
      socket.off("community:messagesRead", handleMessagesRead);
      socket.off("community:conversationUpdated", handleConversationUpdated);
      socket.off("community:messageEdited", handleMessageEdited);
      socket.off("community:messageDeleted", handleMessageDeleted);
      socket.off("community:error", handleCommunityError);
      socket.off("connect_error", handleConnectError);

      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
  }, [
    queueConversationRefresh,
    loadMessages,
    refreshConversationsNow,
    getConversationById,
  ]);

  useEffect(() => {
    if (!selectedConversationId || !selectedConversation) {
      return;
    }

    const socket = getCommunitySocket();
    if (socket.connected) {
      socket.emit("community:joinConversation", {
        conversationId: selectedConversationId,
      });
    }
  }, [selectedConversationId, selectedConversation, isSocketConnected]);

  useEffect(() => {
    setMobileActionMessageId(null);
  }, [selectedConversationId]);

  useEffect(() => {
    if (isSocketConnected || !selectedConversationId || !selectedConversation) {
      disconnectedPollDelayRef.current = DISCONNECTED_POLL_BASE_MS;
      return;
    }

    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
    let isStopped = false;

    const scheduleNext = (delayMs: number) => {
      if (isStopped) {
        return;
      }

      timeoutHandle = setTimeout(async () => {
        try {
          const [messageResponse, conversationResponse] = await Promise.all([
            communityService.getMessages(selectedConversationId),
            communityService.listConversations(1, CONVERSATION_PAGE_SIZE),
          ]);
          setMessages(
            Array.isArray(messageResponse.messages)
              ? messageResponse.messages
              : [],
          );
          applyConversationPage(conversationResponse, {
            preserveSelection: true,
          });

          // Successful fallback sync can return to baseline polling cadence.
          disconnectedPollDelayRef.current = DISCONNECTED_POLL_BASE_MS;
        } catch {
          // Back off progressively while disconnected to avoid hammering the API.
          disconnectedPollDelayRef.current = Math.min(
            DISCONNECTED_POLL_MAX_MS,
            Math.ceil(disconnectedPollDelayRef.current * 1.8),
          );
        } finally {
          const jitter = Math.floor(Math.random() * 500);
          scheduleNext(disconnectedPollDelayRef.current + jitter);
        }
      }, delayMs);
    };

    scheduleNext(disconnectedPollDelayRef.current);

    return () => {
      isStopped = true;
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    };
  }, [
    applyConversationPage,
    isSocketConnected,
    selectedConversation,
    selectedConversationId,
  ]);

  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, selectedConversationId]);

  const handleStartConversation = useCallback(
    async (targetUserId: string) => {
      if (!targetUserId.trim()) {
        return;
      }

      setError(null);
      try {
        const conversation = await communityService.startConversation(
          targetUserId.trim(),
        );
        setPlayerSearchQuery("");
        setPlayerSearchResults([]);
        const updated = await communityService.listConversations(
          1,
          CONVERSATION_PAGE_SIZE,
        );
        applyConversationPage(updated, { preserveSelection: true });
        setSelectedConversationId(conversation.id);
        setActiveSidebarTab("conversations");
        setWorkspaceView("CHAT");
        toast.success(
          conversation.status === "PENDING"
            ? "Message request sent"
            : "Conversation started",
        );
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Failed to start conversation";
        setError(message);
        toast.error(message);
      }
    },
    [applyConversationPage],
  );

  const refreshGroupDirectoryState = useCallback(
    async (options?: { refreshConversations?: boolean }) => {
      const shouldRefreshConversations = options?.refreshConversations ?? true;
      const groupQuery = groupSearchQuery.trim();

      if (shouldRefreshConversations) {
        const [updatedConversations, updatedGroups] = await Promise.all([
          communityService.listConversations(1, CONVERSATION_PAGE_SIZE),
          communityService.listGroups(groupQuery),
        ]);
        applyConversationPage(updatedConversations, {
          preserveSelection: true,
        });
        setGroupResults(updatedGroups);
        return;
      }

      const updatedGroups = await communityService.listGroups(groupQuery);
      setGroupResults(updatedGroups);
    },
    [applyConversationPage, groupSearchQuery],
  );

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      toast.error("Add a group name to continue.");
      return;
    }

    setIsCreatingGroup(true);
    try {
      const created = await communityService.createGroup({
        name: newGroupName.trim(),
        description: newGroupDescription.trim() || undefined,
        sport: newGroupSport.trim() || undefined,
        city: newGroupCity.trim() || undefined,
        audience: newGroupAudience,
      });
      setNewGroupName("");
      setNewGroupDescription("");
      setNewGroupSport("");
      setNewGroupCity("");
      setNewGroupAudience("ALL");
      await refreshGroupDirectoryState();
      setSelectedConversationId(created.conversationId);
      setIsCreateGroupOpen(false);
      setActiveSidebarTab("conversations");
      setWorkspaceView("CHAT");
      toast.success("Group created");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to create group";
      setError(message);
      toast.error(message);
    } finally {
      setIsCreatingGroup(false);
    }
  };

  const handleJoinGroup = async (groupId: string) => {
    try {
      const joined = await communityService.joinGroup(groupId);
      await refreshGroupDirectoryState();
      if (joined.conversationId) {
        setSelectedConversationId(joined.conversationId);
        setActiveSidebarTab("conversations");
        setWorkspaceView("CHAT");
      }
      toast.success("Joined group");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to join group";
      setError(message);
      toast.error(message);
    }
  };

  const handleLeaveGroup = async (groupId: string) => {
    try {
      setIsLeavingGroupId(groupId);
      await communityService.leaveGroup(groupId);
      await refreshGroupDirectoryState();
      if (selectedConversation?.group?.id === groupId) {
        setSelectedConversationId(null);
        setWorkspaceView("DIRECTORY");
      }
      toast.success("Left group");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to leave group";
      toast.error(message);
    } finally {
      setIsLeavingGroupId(null);
    }
  };

  const handleOpenReportModal = (
    targetType: "MESSAGE" | "GROUP",
    targetId: string,
  ) => {
    setReportReason("");
    setReportDetails("");
    setReportModal({ targetType, targetId });
  };

  const handleSubmitReport = async () => {
    if (!reportModal || !reportReason) return;
    try {
      setIsSubmittingReport(true);
      await communityService.reportContent({
        targetType: reportModal.targetType,
        targetId: reportModal.targetId,
        reason: reportReason,
        details: reportDetails || undefined,
      });
      setReportModal(null);
      toast.success("Report submitted");
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to submit report";
      toast.error(message);
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const handleAddMemberToGroup = async (
    groupId: string,
    targetUserId: string,
  ) => {
    try {
      setIsAddingMemberUserId(targetUserId);
      const response = await communityService.addGroupMember(
        groupId,
        targetUserId,
      );

      await refreshGroupDirectoryState({ refreshConversations: false });
      setInviteSearchQuery("");
      setInviteSearchResults([]);

      toast.success(
        response.alreadyMember
          ? "User is already in this group"
          : "Member added to group",
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to add member";
      setError(message);
      toast.error(message);
    } finally {
      setIsAddingMemberUserId(null);
    }
  };

  const handleUpdateGroupMemberAddPolicy = async (
    groupId: string,
    memberAddPolicy: "ADMIN_ONLY" | "ANY_MEMBER",
  ) => {
    try {
      setIsUpdatingGroupPolicyId(groupId);
      await communityService.updateGroupSettings(groupId, {
        memberAddPolicy,
      });

      await refreshGroupDirectoryState({ refreshConversations: false });
      toast.success("Group settings updated");
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to update group settings";
      setError(message);
      toast.error(message);
    } finally {
      setIsUpdatingGroupPolicyId(null);
    }
  };

  const getFeaturedGroupActionLabel = (group: CommunityGroupSummary) => {
    if (!group.isMember) {
      return "Join";
    }

    const groupConversation = getGroupConversationByGroupId(group.id);

    return groupConversation ? "Open chat" : "View groups";
  };

  const handleFeaturedGroupAction = async (group: CommunityGroupSummary) => {
    if (!group.isMember) {
      await handleJoinGroup(group.id);
      return;
    }

    const groupConversation = getGroupConversationByGroupId(group.id);

    setActiveSidebarTab("conversations");
    if (groupConversation) {
      setSelectedConversationId(groupConversation.id);
      setWorkspaceView("CHAT");
      return;
    }

    setWorkspaceView("DIRECTORY");
    setDirectoryView("GROUPS");
    setGroupSearchQuery(group.name);
  };

  const handleAcceptRequest = async () => {
    if (!selectedConversation) {
      return;
    }

    try {
      await communityService.acceptRequest(selectedConversation.id);
      const updated = await communityService.listConversations(
        1,
        CONVERSATION_PAGE_SIZE,
      );
      applyConversationPage(updated, { preserveSelection: true });
      await loadMessages(selectedConversation.id);
      toast.success("Message request accepted");
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to accept request";
      setError(message);
      toast.error(message);
    }
  };

  const handleRejectRequest = async () => {
    if (!selectedConversation) {
      return;
    }

    try {
      await communityService.rejectRequest(selectedConversation.id);
      const updated = await communityService.listConversations(
        1,
        CONVERSATION_PAGE_SIZE,
      );
      applyConversationPage(updated, { preserveSelection: true });
      setSelectedConversationId(
        updated.items.length ? updated.items[0].id : null,
      );
      toast.success("Message request rejected");
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to reject request";
      setError(message);
      toast.error(message);
    }
  };

  const handleToggleConversationBlock = async () => {
    const targetUserId = selectedConversation?.otherParticipant?.id;
    if (!targetUserId) {
      return;
    }

    const currentlyBlocked = (profile?.blockedUsers || []).includes(
      targetUserId,
    );
    const actionLabel = currentlyBlocked ? "unblock" : "block";

    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Are you sure you want to ${actionLabel} this user for direct messages?`,
      )
    ) {
      return;
    }

    setIsTogglingBlockUser(true);
    setError(null);
    try {
      if (currentlyBlocked) {
        await communityService.unblockUser(targetUserId);
        setProfile((current) => {
          if (!current) {
            return current;
          }

          return {
            ...current,
            blockedUsers: (current.blockedUsers || []).filter(
              (id) => id !== targetUserId,
            ),
          };
        });
        toast.success("User unblocked");
      } else {
        await communityService.blockUser(targetUserId);
        setProfile((current) => {
          if (!current) {
            return current;
          }

          const blockedUsers = current.blockedUsers || [];
          if (blockedUsers.includes(targetUserId)) {
            return current;
          }

          return {
            ...current,
            blockedUsers: [...blockedUsers, targetUserId],
          };
        });
        toast.success("User blocked");
      }

      const updatedConversations = await communityService.listConversations(
        1,
        CONVERSATION_PAGE_SIZE,
      );
      applyConversationPage(updatedConversations, { preserveSelection: true });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : `Failed to ${actionLabel} user`;
      setError(message);
      toast.error(message);
    } finally {
      setIsTogglingBlockUser(false);
    }
  };

  const handleOpenConversation = useCallback((conversationId: string) => {
    setSelectedConversationId(conversationId);
    setActiveSidebarTab("conversations");
    setWorkspaceView("CHAT");
    setSidebarMode("INBOX");
  }, []);

  const handleCloseMemberProfile = useCallback(() => {
    memberProfileRequestIdRef.current = null;
    setIsMemberProfileOpen(false);
    setIsLoadingMemberProfile(false);
    setMemberProfileError(null);
    setSelectedMemberProfile(null);
  }, []);

  const handleOpenMemberProfile = useCallback(async (memberId: string) => {
    memberProfileRequestIdRef.current = memberId;
    setIsMemberProfileOpen(true);
    setIsLoadingMemberProfile(true);
    setMemberProfileError(null);
    setSelectedMemberProfile(null);

    try {
      const profile = await communityService.getPlayerProfile(memberId);
      if (memberProfileRequestIdRef.current !== memberId) {
        return;
      }

      setSelectedMemberProfile(profile);
    } catch (e) {
      if (memberProfileRequestIdRef.current !== memberId) {
        return;
      }

      const message =
        e instanceof Error ? e.message : "Failed to load player profile";
      setMemberProfileError(message);
      toast.error(message);
    } finally {
      if (memberProfileRequestIdRef.current === memberId) {
        setIsLoadingMemberProfile(false);
      }
    }
  }, []);

  const handleMemberClick = (member: GroupMember) => {
    router.push(`/members/${member.id}`);
  };

  const handleMessageSelectedMember = useCallback(() => {
    if (!selectedMemberProfile) {
      return;
    }

    handleCloseMemberProfile();
    void handleStartConversation(selectedMemberProfile.id);
  }, [
    handleCloseMemberProfile,
    handleStartConversation,
    selectedMemberProfile,
  ]);

  const handleLoadMoreConversations = async () => {
    if (isLoadingMoreConversations || !hasMoreConversations) {
      return;
    }

    setIsLoadingMoreConversations(true);
    try {
      const nextPage = conversationPage + 1;
      const next = await communityService.listConversations(
        nextPage,
        CONVERSATION_PAGE_SIZE,
      );
      applyConversationPage(next, {
        append: true,
      });
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to load more conversations";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoadingMoreConversations(false);
    }
  };

  const sendMessageWithTransport = useCallback(
    async (
      conversationId: string,
      content: string,
    ): Promise<ConversationMessage> => {
      const socket = getCommunitySocket();

      if (socket.connected) {
        const payload = {
          conversationId,
          content,
        };

        const ack = await new Promise<
          | { success: true; data: ConversationMessage }
          | { success: false; message?: string }
        >((resolve) => {
          const timeoutId = setTimeout(() => {
            resolve({ success: false, message: "Message send timed out" });
          }, 8000);

          socket.emit("community:sendMessage", payload, (result: unknown) => {
            clearTimeout(timeoutId);
            resolve(
              (result as
                | { success: true; data: ConversationMessage }
                | { success: false; message?: string }) || {
                success: false,
                message: "Invalid server response",
              },
            );
          });
        });

        if (!ack.success) {
          throw new Error(ack.message || "Failed to send message");
        }

        return {
          ...ack.data,
          messageStatus: "SENT",
        };
      }

      const fallbackMessage = await communityService.sendMessage(
        conversationId,
        content,
      );

      return {
        ...fallbackMessage,
        messageStatus: "SENT",
      };
    },
    [],
  );

  const editMessageWithTransport = useCallback(
    async (
      messageId: string,
      content: string,
    ): Promise<ConversationMessage> => {
      const socket = getCommunitySocket();

      if (socket.connected) {
        const ack = await new Promise<
          | { success: true; data: ConversationMessage }
          | { success: false; message?: string }
        >((resolve) => {
          const timeoutId = setTimeout(() => {
            resolve({ success: false, message: "Message edit timed out" });
          }, 8000);

          socket.emit(
            "community:editMessage",
            { messageId, content },
            (result: unknown) => {
              clearTimeout(timeoutId);
              resolve(
                (result as
                  | { success: true; data: ConversationMessage }
                  | { success: false; message?: string }) || {
                  success: false,
                  message: "Invalid server response",
                },
              );
            },
          );
        });

        if (!ack.success) {
          throw new Error(ack.message || "Failed to edit message");
        }

        return ack.data;
      }

      return communityService.editMessage(messageId, content);
    },
    [],
  );

  const deleteMessageWithTransport = useCallback(
    async (messageId: string): Promise<ConversationMessage> => {
      const socket = getCommunitySocket();

      if (socket.connected) {
        const ack = await new Promise<
          | { success: true; data: ConversationMessage }
          | { success: false; message?: string }
        >((resolve) => {
          const timeoutId = setTimeout(() => {
            resolve({ success: false, message: "Message delete timed out" });
          }, 8000);

          socket.emit(
            "community:deleteMessage",
            { messageId },
            (result: unknown) => {
              clearTimeout(timeoutId);
              resolve(
                (result as
                  | { success: true; data: ConversationMessage }
                  | { success: false; message?: string }) || {
                  success: false,
                  message: "Invalid server response",
                },
              );
            },
          );
        });

        if (!ack.success) {
          throw new Error(ack.message || "Failed to delete message");
        }

        return ack.data;
      }

      return communityService.deleteMessage(messageId);
    },
    [],
  );

  const retryFailedMessage = useCallback(
    async (message: ConversationMessage) => {
      if (!message.content?.trim()) {
        return;
      }

      updateMessageById(message.id, (current) => ({
        ...current,
        messageStatus: "SENDING",
      }));

      setIsSending(true);
      setError(null);
      try {
        const confirmedMessage = await sendMessageWithTransport(
          message.conversationId,
          message.content,
        );

        updateMessageById(message.id, (current) => ({
          ...current,
          ...confirmedMessage,
        }));

        const updatedConversations = await communityService.listConversations(
          1,
          CONVERSATION_PAGE_SIZE,
        );
        applyConversationPage(updatedConversations, {
          preserveSelection: true,
        });
      } catch (e) {
        updateMessageById(message.id, (current) => ({
          ...current,
          messageStatus: "FAILED",
        }));
        const errorMessage =
          e instanceof Error ? e.message : "Failed to resend message";
        setError(errorMessage);
        toast.error(errorMessage);
      } finally {
        setIsSending(false);
      }
    },
    [applyConversationPage, sendMessageWithTransport],
  );

  const handleBeginEditMessage = (message: ConversationMessage) => {
    if (
      message.senderId !== profile?.userId ||
      message.isDeleted ||
      !isWithinMessageEditWindow(message.createdAt)
    ) {
      return;
    }

    setEditingMessageId(message.id);
    setEditingMessageDraft(message.content);
  };

  const handleCancelEditMessage = () => {
    setEditingMessageId(null);
    setEditingMessageDraft("");
  };

  const handleSaveEditedMessage = async () => {
    if (!editingMessageId) {
      return;
    }

    const nextContent = editingMessageDraft.trim();
    if (!nextContent) {
      toast.error("Message content cannot be empty");
      return;
    }

    setIsMutatingMessageId(editingMessageId);
    setError(null);
    try {
      const updated = await editMessageWithTransport(
        editingMessageId,
        nextContent,
      );

      updateMessageById(editingMessageId, (current) => ({
        ...current,
        ...updated,
      }));

      setEditingMessageId(null);
      setEditingMessageDraft("");

      const updatedConversations = await communityService.listConversations(
        1,
        CONVERSATION_PAGE_SIZE,
      );
      applyConversationPage(updatedConversations, { preserveSelection: true });
      toast.success("Message updated");
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to update message";
      setError(message);
      toast.error(message);
    } finally {
      setIsMutatingMessageId(null);
    }
  };

  const handleDeleteMessage = async (message: ConversationMessage) => {
    if (
      message.senderId !== profile?.userId ||
      message.isDeleted ||
      !isWithinMessageEditWindow(message.createdAt)
    ) {
      return;
    }

    if (
      typeof window !== "undefined" &&
      !window.confirm("Delete this message for everyone?")
    ) {
      return;
    }

    setIsMutatingMessageId(message.id);
    setError(null);
    try {
      const deleted = await deleteMessageWithTransport(message.id);
      updateMessageById(message.id, (current) => ({
        ...current,
        ...deleted,
      }));

      if (editingMessageId === message.id) {
        setEditingMessageId(null);
        setEditingMessageDraft("");
      }

      const updatedConversations = await communityService.listConversations(
        1,
        CONVERSATION_PAGE_SIZE,
      );
      applyConversationPage(updatedConversations, { preserveSelection: true });
      toast.success("Message deleted");
    } catch (e) {
      const errorMessage =
        e instanceof Error ? e.message : "Failed to delete message";
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsMutatingMessageId(null);
    }
  };

  const handleCopyMessage = (message: ConversationMessage) => {
    if (!message.content || message.isDeleted) {
      return;
    }

    navigator.clipboard
      .writeText(message.content)
      .then(() => {
        if (copyFeedbackTimeoutRef.current) {
          clearTimeout(copyFeedbackTimeoutRef.current);
        }

        setCopiedMessageId(message.id);
        copyFeedbackTimeoutRef.current = setTimeout(() => {
          setCopiedMessageId((current) =>
            current === message.id ? null : current,
          );
          copyFeedbackTimeoutRef.current = null;
        }, 1600);
        toast.success("Message copied to clipboard");
      })
      .catch(() => {
        toast.error("Failed to copy message");
      });
  };

  const handleSendMessage = async () => {
    if (!selectedConversation || !newMessage.trim()) {
      return;
    }

    if (selectedConversationNeedsMyApproval) {
      const pendingError =
        "Accept this message request before sending a reply.";
      setError(pendingError);
      toast.error(pendingError);
      return;
    }

    const content = newMessage.trim();
    const optimisticMessageId = `temp-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const optimisticMessage: ConversationMessage = {
      id: optimisticMessageId,
      conversationId: selectedConversation.id,
      conversationType: selectedConversation.conversationType,
      senderId: profile?.userId || "me",
      senderDisplayName: "You",
      content,
      createdAt: new Date().toISOString(),
      messageStatus: "SENDING",
      readBy: profile?.userId ? [profile.userId] : [],
      participantIds: [
        profile?.userId || "me",
        selectedConversation.otherParticipant.id,
      ],
    };

    appendMessage(optimisticMessage);
    setNewMessage("");

    setIsSending(true);
    setError(null);
    try {
      const confirmedMessage = await sendMessageWithTransport(
        selectedConversation.id,
        content,
      );

      removeMessageById(optimisticMessageId);

      if (confirmedMessage.conversationId === selectedConversation.id) {
        appendMessage(confirmedMessage);
      }

      const updatedConversations = await communityService.listConversations(
        1,
        CONVERSATION_PAGE_SIZE,
      );
      applyConversationPage(updatedConversations, { preserveSelection: true });
    } catch (e) {
      updateMessageById(optimisticMessageId, (message) => ({
        ...message,
        messageStatus: "FAILED",
      }));
      const message = e instanceof Error ? e.message : "Failed to send message";
      setError(message);
      toast.error(message);
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(233,115,22,0.12),transparent_35%),linear-gradient(to_bottom,#f8fafc,#f1f5f9)] px-4 py-8 sm:px-6 lg:px-10"
      >
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <div className="hidden rounded-3xl border border-border/70 bg-white/85 p-6 shadow-sm backdrop-blur lg:block">
            <div className="h-6 w-28 animate-pulse rounded bg-slate-200" />
            <div className="mt-3 h-10 w-40 animate-pulse rounded bg-slate-200" />
            <div className="mt-8 space-y-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-12 animate-pulse rounded-xl bg-slate-100"
                />
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-border/70 bg-white/90 p-6 shadow-sm backdrop-blur sm:p-8">
            <div className="h-7 w-52 animate-pulse rounded bg-slate-200" />
            <div className="mt-4 h-20 animate-pulse rounded-2xl bg-slate-100" />
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-24 animate-pulse rounded-2xl bg-slate-100"
                />
              ))}
            </div>
            <p className="mt-6 text-sm font-medium text-slate-500">
              Loading your community dashboard...
            </p>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <>
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0 }}
        animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1 }}
        transition={{ duration: 0.28 }}
        className="h-full min-h-0 bg-[radial-gradient(circle_at_top,rgba(233,115,22,0.12),transparent_35%),linear-gradient(to_bottom,#f8fafc,#f1f5f9)]"
      >
        {/* Main Layout */}
        <motion.div
          variants={shellVariants}
          initial="hidden"
          animate="show"
          className={`mx-auto grid h-full min-h-0 w-full max-w-full gap-0 ${
            isCommunityView
              ? "grid-cols-1"
              : isConversationsView
                ? "grid-cols-1"
                : "grid-cols-1"
          }`}
        >
          {/* Community View - Full Width */}
          {isCommunityView && (
            <motion.main
              variants={panelVariants}
              className="flex min-h-full min-w-0 flex-col overflow-y-auto lg:h-full"
            >
              <div className="space-y-5 p-4 sm:space-y-6 sm:p-6 lg:p-8">
                <section id="community-overview" className="mb-6 scroll-mt-28">
                  <CommunityPageHeader
                    title="PowerMySport Community"
                    subtitle="Anonymous-first community chat with your privacy controls."
                    badge="Community Network"
                    action={
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSidebarTab("conversations");
                            setSidebarMode("INBOX");
                            setWorkspaceView("DIRECTORY");
                            setDirectoryView("CONTACTS");
                          }}
                          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 sm:w-auto sm:px-4"
                        >
                          Open chats
                        </button>
                        <Link
                          href="/q"
                          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 sm:w-auto sm:px-4"
                        >
                          Explore Q&A
                        </Link>
                        <a
                          href={mainAppUrl}
                          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 sm:w-auto sm:px-4"
                        >
                          Switch to Main App
                          <ExternalLink size={16} />
                        </a>
                      </div>
                    }
                  />
                </section>

                <FeaturedCommunitiesStrip
                  groups={featuredGroups}
                  getActionLabel={getFeaturedGroupActionLabel}
                  onGroupAction={(group) => {
                    void handleFeaturedGroupAction(group);
                  }}
                  isGroupFollowed={(groupId) =>
                    followedGroupIds.includes(groupId)
                  }
                  onToggleGroupFollow={(group) => {
                    const result = communityFollowStore.toggle({
                      kind: "group",
                      id: group.id,
                      label: group.name,
                      href: `/`,
                    });
                    setFollowedGroupIds(
                      communityFollowStore
                        .getByKind("group")
                        .map((item) => item.id),
                    );
                    toast.success(
                      result.following
                        ? `Following ${group.name}`
                        : `Unfollowed ${group.name}`,
                    );
                  }}
                  onViewAll={() => {
                    setActiveSidebarTab("conversations");
                    setWorkspaceView("DIRECTORY");
                    setDirectoryView("GROUPS");
                  }}
                />

                <motion.section
                  variants={shellVariants}
                  initial="hidden"
                  animate="show"
                  className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
                >
                  <motion.div
                    variants={panelVariants}
                    whileHover={{ y: -3 }}
                    className="rounded-2xl border border-border/80 bg-white p-4 shadow-xs"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Conversations
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {safeConversations.length}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Active threads
                    </p>
                  </motion.div>
                  <motion.div
                    variants={panelVariants}
                    whileHover={{ y: -3 }}
                    className="rounded-2xl border border-white/70 bg-white p-4 shadow-sm"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Unread
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {totalUnread}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Messages waiting
                    </p>
                  </motion.div>
                  <motion.div
                    variants={panelVariants}
                    whileHover={{ y: -3 }}
                    className="rounded-2xl border border-border/80 bg-white p-4 shadow-xs"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Groups joined
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {groupsJoinedCount}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Community circles
                    </p>
                  </motion.div>
                  <motion.div
                    variants={panelVariants}
                    whileHover={{ y: -3 }}
                    className="rounded-2xl border border-border/80 bg-white p-4 shadow-xs"
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Connection
                    </p>
                    <p className="mt-2 text-lg font-semibold text-slate-900">
                      {isSocketConnected ? "Realtime" : "Polling"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {isSocketConnected
                        ? "Instant updates"
                        : "Auto-refreshing"}
                    </p>
                  </motion.div>
                </motion.section>
              </div>
            </motion.main>
          )}

          {/* Conversations View Layout */}
          {isConversationsView && (
            <div className="contents">
              {/* Main Chat Area */}
              <motion.main
                variants={panelVariants}
                className="grid h-full min-h-0 min-w-0 grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)]"
              >
                <motion.section
                  className={`h-full min-h-0 overflow-y-auto border-r border-slate-200 bg-white p-3.5 pb-24 sm:p-4 lg:pb-4 ${
                    workspaceView === "DIRECTORY" ? "block" : "hidden lg:block"
                  }`}
                >
                  <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-3 sm:px-3.5 sm:py-3.5">
                    <Users size={16} className="text-slate-600" />
                    <h2 className="text-base font-semibold tracking-tight">
                      Conversations
                    </h2>
                  </div>
                  <p className="px-3 py-2 text-sm text-slate-500 sm:px-3.5">
                    Search users, discover groups, and select a conversation.
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-border bg-slate-50 p-1">
                    {["INBOX", "TOOLS"].map((mode) => (
                      <button
                        key={mode}
                        onClick={() =>
                          setSidebarMode(mode as "INBOX" | "TOOLS")
                        }
                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${
                          sidebarMode === mode
                            ? "bg-white text-slate-900 shadow-xs"
                            : "text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        {mode === "INBOX" ? "Inbox" : "Tools"}
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-slate-50 p-1">
                    <button
                      onClick={() => setDirectoryView("CONTACTS")}
                      title="DM chats"
                      aria-label="DM chats"
                      className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                        directoryView === "CONTACTS"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <MessageSquare size={14} />
                      DM
                    </button>
                    <button
                      onClick={() => setDirectoryView("GROUPS")}
                      title="Group chats"
                      aria-label="Group chats"
                      className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                        directoryView === "GROUPS"
                          ? "bg-white text-slate-900 shadow-xs"
                          : "text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <Users size={14} />
                      Groups
                    </button>
                  </div>

                  {sidebarMode === "TOOLS" ? (
                    <div className="mt-3 space-y-3 rounded-xl border border-border bg-slate-50 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {directoryView === "GROUPS"
                          ? "Group tools"
                          : "Direct chat tools"}
                      </p>

                      <div className="rounded-lg border border-border bg-white p-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Workflow
                        </p>
                        <div className="mt-2 grid gap-1">
                          {toolsSteps.map((step, index) => (
                            <div
                              key={step.id}
                              className="flex items-center gap-2 text-xs"
                            >
                              <span
                                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${
                                  step.done
                                    ? "bg-turf-green/15 text-turf-green"
                                    : "bg-slate-100 text-slate-500"
                                }`}
                              >
                                {index + 1}
                              </span>
                              <span
                                className={
                                  step.done
                                    ? "font-medium text-slate-800"
                                    : "text-slate-500"
                                }
                              >
                                {step.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {directoryView === "CONTACTS" ? (
                        <>
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                            Search a user and tap their card to instantly create
                            or open a DM thread.
                          </div>
                          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3">
                            <Search size={14} className="text-slate-400" />
                            <input
                              value={playerSearchQuery}
                              onChange={(event) =>
                                setPlayerSearchQuery(event.target.value)
                              }
                              placeholder="Search by name or alias"
                              className="w-full bg-transparent py-2 text-sm outline-none"
                            />
                          </div>
                          {playerSearchQuery.trim().length >= 2 && (
                            <div className="max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border bg-background p-2">
                              {isSearchingPlayers ? (
                                <p className="text-sm text-slate-500">
                                  Searching...
                                </p>
                              ) : playerSearchResults.length ? (
                                playerSearchResults.map((user) => (
                                  <button
                                    key={user.id}
                                    onClick={() =>
                                      void handleStartConversation(user.id)
                                    }
                                    className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-muted"
                                  >
                                    <span>{user.displayName}</span>
                                    <span className="flex items-center gap-1.5 text-xs text-slate-500">
                                      <span>
                                        {user.isIdentityPublic
                                          ? "Public"
                                          : "Anonymous"}
                                      </span>
                                      {user.role && (
                                        <span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                                          {user.role === "COACH"
                                            ? "Coach"
                                            : "Player"}
                                        </span>
                                      )}
                                    </span>
                                  </button>
                                ))
                              ) : (
                                <div className="rounded-lg border border-dashed border-border bg-white p-3 text-sm text-slate-500">
                                  No users found for this search. Try a
                                  different name or alias.
                                </div>
                              )}
                            </div>
                          )}
                          {playerSearchQuery.trim().length < 2 && (
                            <div className="rounded-lg border border-dashed border-border bg-white p-3 text-xs text-slate-500">
                              Start typing at least 2 characters to find users.
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                            Use Discover to join groups, Manage for policy and
                            controls, and Invite to share group access.
                          </div>
                          <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-white p-1">
                            {[
                              { value: "DISCOVER", label: "Discover" },
                              { value: "MANAGE", label: "Manage" },
                              { value: "INVITE", label: "Invite" },
                            ].map((item) => (
                              <button
                                key={item.value}
                                onClick={() =>
                                  setGroupToolsMode(
                                    item.value as
                                      | "DISCOVER"
                                      | "MANAGE"
                                      | "INVITE",
                                  )
                                }
                                className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                                  groupToolsMode === item.value
                                    ? "bg-slate-900 text-white"
                                    : "text-slate-500 hover:bg-slate-100"
                                }`}
                              >
                                {item.label}
                              </button>
                            ))}
                          </div>

                          <div className="flex flex-wrap items-center gap-2">
                            <div className="grid grow grid-cols-3 gap-1 rounded-lg border border-border bg-white p-1">
                              {[
                                { value: "ALL", label: "All" },
                                { value: "JOINED", label: "Joined" },
                                { value: "DISCOVER", label: "Discover" },
                              ].map((item) => (
                                <button
                                  key={item.value}
                                  onClick={() =>
                                    setGroupMode(
                                      item.value as
                                        | "ALL"
                                        | "JOINED"
                                        | "DISCOVER",
                                    )
                                  }
                                  className={`rounded-md px-2 py-1 text-[11px] font-semibold transition ${
                                    groupMode === item.value
                                      ? "bg-slate-900 text-white"
                                      : "text-slate-500 hover:bg-slate-100"
                                  }`}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                            <button
                              onClick={() =>
                                setIsCreateGroupOpen((current) => !current)
                              }
                              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-100"
                            >
                              {isCreateGroupOpen ? "Close" : "New group"}
                            </button>
                          </div>

                          {isCreateGroupOpen && (
                            <div className="rounded-2xl border border-power-orange/15 bg-[linear-gradient(180deg,rgba(233,115,22,0.06),rgba(255,255,255,0.96))] p-4 shadow-xs">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-power-orange">
                                    Create a new circle
                                  </p>
                                  <p className="mt-1 text-sm text-slate-600">
                                    Add a few details so people know what the
                                    group is for.
                                  </p>
                                </div>
                                <button
                                  onClick={() => {
                                    setIsCreateGroupOpen(false);
                                  }}
                                  className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                                >
                                  Close
                                </button>
                              </div>

                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <input
                                  value={newGroupName}
                                  onChange={(event) =>
                                    setNewGroupName(event.target.value)
                                  }
                                  placeholder="Group name"
                                  className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:border-power-orange focus:outline-none"
                                />
                                <input
                                  value={newGroupSport}
                                  onChange={(event) =>
                                    setNewGroupSport(event.target.value)
                                  }
                                  placeholder="Sport e.g. Cricket"
                                  className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:border-power-orange focus:outline-none"
                                />
                                <input
                                  value={newGroupCity}
                                  onChange={(event) =>
                                    setNewGroupCity(event.target.value)
                                  }
                                  placeholder="City or area"
                                  className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:border-power-orange focus:outline-none"
                                />
                                <select
                                  value={newGroupAudience}
                                  onChange={(event) =>
                                    setNewGroupAudience(
                                      event.target.value as
                                        | "ALL"
                                        | "PLAYERS_ONLY"
                                        | "COACHES_ONLY",
                                    )
                                  }
                                  className="rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:border-power-orange focus:outline-none"
                                >
                                  <option value="ALL">Open to all</option>
                                  <option value="PLAYERS_ONLY">
                                    Players only
                                  </option>
                                  <option value="COACHES_ONLY">
                                    Coaches only
                                  </option>
                                </select>
                              </div>

                              <textarea
                                value={newGroupDescription}
                                onChange={(event) =>
                                  setNewGroupDescription(event.target.value)
                                }
                                placeholder="Short description"
                                rows={3}
                                className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:border-power-orange focus:outline-none"
                              />

                              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                                <p className="text-xs text-slate-500">
                                  Keep it short and specific. You can adjust
                                  settings later.
                                </p>
                                <button
                                  onClick={() => void handleCreateGroup()}
                                  disabled={isCreatingGroup}
                                  className="inline-flex items-center gap-2 rounded-xl bg-power-orange px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {isCreatingGroup
                                    ? "Creating..."
                                    : "Create group"}
                                </button>
                              </div>
                            </div>
                          )}

                          <input
                            value={groupSearchQuery}
                            onChange={(event) =>
                              setGroupSearchQuery(event.target.value)
                            }
                            placeholder="Search groups by name, sport, city"
                            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-power-orange focus:outline-none"
                          />

                          {selectedConversation?.conversationType === "GROUP" &&
                            selectedConversation.group && (
                              <div className="rounded-xl border border-border bg-white p-2">
                                <GroupInviteLink
                                  groupId={selectedConversation.group.id}
                                  groupName={selectedConversation.group.name}
                                />
                              </div>
                            )}

                          <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                            {isSearchingGroups ? (
                              <p className="text-sm text-slate-500">
                                Loading groups...
                              </p>
                            ) : toolVisibleGroups.length ? (
                              toolVisibleGroups.map((group) => {
                                const memberAddPolicy =
                                  group.memberAddPolicy || "ADMIN_ONLY";
                                const canCurrentUserAddMembers =
                                  memberAddPolicy === "ANY_MEMBER" ||
                                  !!group.isAdmin;
                                const groupConversation =
                                  getGroupConversationByGroupId(group.id);

                                return (
                                  <div
                                    key={group.id}
                                    className="space-y-2 rounded-lg border border-border bg-white px-2 py-2"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <div>
                                        <p className="text-sm font-medium">
                                          {group.name}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                          {group.memberCount} members
                                        </p>
                                      </div>
                                      {group.isMember ? (
                                        <button
                                          onClick={() => {
                                            if (groupConversation) {
                                              handleOpenConversation(
                                                groupConversation.id,
                                              );
                                              return;
                                            }

                                            setDirectoryView("GROUPS");
                                            setGroupSearchQuery(group.name);
                                          }}
                                          className="rounded-md border border-border bg-slate-100 px-2 py-1 text-xs font-medium transition hover:bg-slate-200"
                                        >
                                          {groupConversation ? "Open" : "View"}
                                        </button>
                                      ) : (
                                        <div className="flex items-center gap-1">
                                          <button
                                            onClick={() =>
                                              void handleJoinGroup(group.id)
                                            }
                                            className="rounded-md border border-border bg-slate-100 px-2 py-1 text-xs font-medium transition hover:bg-slate-200"
                                          >
                                            Join
                                          </button>
                                          <button
                                            onClick={() =>
                                              handleOpenReportModal(
                                                "GROUP",
                                                group.id,
                                              )
                                            }
                                            title="Report group"
                                            className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-100"
                                          >
                                            <Flag
                                              size={11}
                                              className="inline-block"
                                            />
                                          </button>
                                        </div>
                                      )}
                                    </div>

                                    {group.isMember &&
                                      groupToolsMode === "MANAGE" && (
                                        <div className="space-y-2 border-t border-border pt-2">
                                          <div className="rounded-md border border-border bg-slate-50 p-2">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                              Group settings
                                            </p>
                                            <div className="mt-1 flex items-center justify-between gap-2">
                                              <span className="text-xs text-slate-600">
                                                Who can add members
                                              </span>
                                              {group.isAdmin ? (
                                                <select
                                                  value={memberAddPolicy}
                                                  onChange={(event) =>
                                                    void handleUpdateGroupMemberAddPolicy(
                                                      group.id,
                                                      event.target.value as
                                                        | "ADMIN_ONLY"
                                                        | "ANY_MEMBER",
                                                    )
                                                  }
                                                  disabled={
                                                    isUpdatingGroupPolicyId ===
                                                    group.id
                                                  }
                                                  className="rounded-md border border-border bg-white px-2 py-1 text-xs focus:border-power-orange focus:outline-none disabled:opacity-50"
                                                >
                                                  <option value="ADMIN_ONLY">
                                                    Admins only
                                                  </option>
                                                  <option value="ANY_MEMBER">
                                                    Any member
                                                  </option>
                                                </select>
                                              ) : (
                                                <span className="text-xs font-medium text-slate-600">
                                                  {memberAddPolicy ===
                                                  "ANY_MEMBER"
                                                    ? "Any member"
                                                    : "Admins only"}
                                                </span>
                                              )}
                                            </div>
                                          </div>

                                          <div className="flex items-center gap-2">
                                            <button
                                              onClick={() =>
                                                void handleLeaveGroup(group.id)
                                              }
                                              disabled={
                                                isLeavingGroupId === group.id
                                              }
                                              className="flex-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs font-medium text-rose-600 transition hover:bg-rose-100 disabled:opacity-60"
                                            >
                                              {isLeavingGroupId === group.id
                                                ? "Leaving..."
                                                : "Leave group"}
                                            </button>
                                            <button
                                              onClick={() =>
                                                handleOpenReportModal(
                                                  "GROUP",
                                                  group.id,
                                                )
                                              }
                                              title="Report group"
                                              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                                            >
                                              <Flag
                                                size={12}
                                                className="inline-block"
                                              />
                                            </button>
                                          </div>

                                          <div className="flex items-center justify-between">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                              Add member
                                            </p>
                                            {canCurrentUserAddMembers ? (
                                              <button
                                                onClick={() => {
                                                  if (
                                                    inviteGroupId === group.id
                                                  ) {
                                                    setInviteGroupId(null);
                                                    setInviteSearchQuery("");
                                                    setInviteSearchResults([]);
                                                    return;
                                                  }

                                                  setInviteGroupId(group.id);
                                                  setInviteSearchQuery("");
                                                  setInviteSearchResults([]);
                                                }}
                                                className="text-xs font-medium text-slate-600 transition hover:text-slate-900"
                                              >
                                                {inviteGroupId === group.id
                                                  ? "Close"
                                                  : "Add"}
                                              </button>
                                            ) : (
                                              <span className="text-[11px] text-slate-500">
                                                Admin-only action
                                              </span>
                                            )}
                                          </div>

                                          {!canCurrentUserAddMembers && (
                                            <p className="text-xs text-slate-500">
                                              Only admins can add members in
                                              this group.
                                            </p>
                                          )}

                                          {canCurrentUserAddMembers &&
                                            inviteGroupId === group.id && (
                                              <>
                                                <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2">
                                                  <Search
                                                    size={13}
                                                    className="text-slate-400"
                                                  />
                                                  <input
                                                    value={inviteSearchQuery}
                                                    onChange={(event) =>
                                                      setInviteSearchQuery(
                                                        event.target.value,
                                                      )
                                                    }
                                                    placeholder="Search user to add"
                                                    className="w-full bg-transparent py-1.5 text-xs outline-none"
                                                  />
                                                </div>
                                                {inviteSearchQuery.trim()
                                                  .length >= 2 && (
                                                  <div className="max-h-28 space-y-1 overflow-y-auto rounded-lg border border-border bg-background p-1.5">
                                                    {isSearchingInvitePlayers ? (
                                                      <p className="text-xs text-slate-500">
                                                        Searching users...
                                                      </p>
                                                    ) : inviteSearchResults.length ? (
                                                      inviteSearchResults.map(
                                                        (user) => (
                                                          <div
                                                            key={user.id}
                                                            className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1"
                                                          >
                                                            <div className="min-w-0">
                                                              <span className="truncate text-xs text-slate-700">
                                                                {
                                                                  user.displayName
                                                                }
                                                              </span>
                                                              {user.role && (
                                                                <span className="ml-1 inline-flex rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                                                                  {user.role ===
                                                                  "COACH"
                                                                    ? "Coach"
                                                                    : "Player"}
                                                                </span>
                                                              )}
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                              <button
                                                                onClick={() =>
                                                                  void handleOpenMemberProfile(
                                                                    user.id,
                                                                  )
                                                                }
                                                                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-100"
                                                              >
                                                                View
                                                              </button>
                                                              <button
                                                                disabled={
                                                                  isAddingMemberUserId ===
                                                                  user.id
                                                                }
                                                                onClick={() =>
                                                                  void handleAddMemberToGroup(
                                                                    group.id,
                                                                    user.id,
                                                                  )
                                                                }
                                                                className="rounded-md border border-border bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                                                              >
                                                                {isAddingMemberUserId ===
                                                                user.id
                                                                  ? "Adding"
                                                                  : "Add"}
                                                              </button>
                                                            </div>
                                                          </div>
                                                        ),
                                                      )
                                                    ) : (
                                                      <p className="text-xs text-slate-500">
                                                        No users found
                                                      </p>
                                                    )}
                                                  </div>
                                                )}
                                              </>
                                            )}
                                        </div>
                                      )}

                                    {group.isMember &&
                                      groupToolsMode === "INVITE" && (
                                        <div className="space-y-2 border-t border-border pt-2">
                                          {group.isAdmin && (
                                            <div className="rounded-xl border border-border bg-slate-50 p-2">
                                              <GroupInviteLink
                                                groupId={group.id}
                                                groupName={group.name}
                                              />
                                            </div>
                                          )}

                                          <div className="flex items-center justify-between">
                                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                              Add member
                                            </p>
                                            {canCurrentUserAddMembers ? (
                                              <button
                                                onClick={() => {
                                                  if (
                                                    inviteGroupId === group.id
                                                  ) {
                                                    setInviteGroupId(null);
                                                    setInviteSearchQuery("");
                                                    setInviteSearchResults([]);
                                                    return;
                                                  }

                                                  setInviteGroupId(group.id);
                                                  setInviteSearchQuery("");
                                                  setInviteSearchResults([]);
                                                }}
                                                className="text-xs font-medium text-slate-600 transition hover:text-slate-900"
                                              >
                                                {inviteGroupId === group.id
                                                  ? "Close"
                                                  : "Add"}
                                              </button>
                                            ) : (
                                              <span className="text-[11px] text-slate-500">
                                                Admin-only action
                                              </span>
                                            )}
                                          </div>

                                          {!canCurrentUserAddMembers && (
                                            <p className="text-xs text-slate-500">
                                              Only admins can add members in
                                              this group.
                                            </p>
                                          )}

                                          {canCurrentUserAddMembers &&
                                            inviteGroupId === group.id && (
                                              <>
                                                <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-2">
                                                  <Search
                                                    size={13}
                                                    className="text-slate-400"
                                                  />
                                                  <input
                                                    value={inviteSearchQuery}
                                                    onChange={(event) =>
                                                      setInviteSearchQuery(
                                                        event.target.value,
                                                      )
                                                    }
                                                    placeholder="Search user to add"
                                                    className="w-full bg-transparent py-1.5 text-xs outline-none"
                                                  />
                                                </div>
                                                {inviteSearchQuery.trim()
                                                  .length >= 2 && (
                                                  <div className="max-h-28 space-y-1 overflow-y-auto rounded-lg border border-border bg-background p-1.5">
                                                    {isSearchingInvitePlayers ? (
                                                      <p className="text-xs text-slate-500">
                                                        Searching users...
                                                      </p>
                                                    ) : inviteSearchResults.length ? (
                                                      inviteSearchResults.map(
                                                        (user) => (
                                                          <div
                                                            key={user.id}
                                                            className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1"
                                                          >
                                                            <div className="min-w-0">
                                                              <span className="truncate text-xs text-slate-700">
                                                                {
                                                                  user.displayName
                                                                }
                                                              </span>
                                                              {user.role && (
                                                                <span className="ml-1 inline-flex rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                                                                  {user.role ===
                                                                  "COACH"
                                                                    ? "Coach"
                                                                    : "Player"}
                                                                </span>
                                                              )}
                                                            </div>
                                                            <div className="flex items-center gap-1.5">
                                                              <button
                                                                onClick={() =>
                                                                  void handleOpenMemberProfile(
                                                                    user.id,
                                                                  )
                                                                }
                                                                className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-100"
                                                              >
                                                                View
                                                              </button>
                                                              <button
                                                                disabled={
                                                                  isAddingMemberUserId ===
                                                                  user.id
                                                                }
                                                                onClick={() =>
                                                                  void handleAddMemberToGroup(
                                                                    group.id,
                                                                    user.id,
                                                                  )
                                                                }
                                                                className="rounded-md border border-border bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                                                              >
                                                                {isAddingMemberUserId ===
                                                                user.id
                                                                  ? "Adding"
                                                                  : "Add"}
                                                              </button>
                                                            </div>
                                                          </div>
                                                        ),
                                                      )
                                                    ) : (
                                                      <p className="text-xs text-slate-500">
                                                        No users found
                                                      </p>
                                                    )}
                                                  </div>
                                                )}
                                              </>
                                            )}
                                        </div>
                                      )}
                                  </div>
                                );
                              })
                            ) : (
                              <div className="rounded-lg border border-dashed border-border bg-white p-3 text-sm text-slate-500">
                                {groupToolsMode === "DISCOVER"
                                  ? "No discoverable groups right now. Try changing search or switch to All mode."
                                  : groupToolsMode === "MANAGE"
                                    ? "No joined groups to manage yet. Join a group from Discover first."
                                    : "No group available for invites. Join or open a group first."}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                          {managedConversations.length} result
                          {managedConversations.length === 1 ? "" : "s"}
                        </span>
                        <span className="rounded-full bg-power-orange/10 px-3 py-1 text-xs font-medium text-power-orange">
                          {pendingRequestsCount} request
                          {pendingRequestsCount === 1 ? "" : "s"}
                        </span>
                        {!!conversationFilterQuery.trim() && (
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
                            &ldquo;{conversationFilterQuery.trim()}&rdquo;
                          </span>
                        )}
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-border bg-slate-50 p-1">
                        {conversationModeOptions.map((item) => (
                          <button
                            key={item.value}
                            onClick={() =>
                              setConversationMode(
                                item.value as "ALL" | "UNREAD" | "REQUESTS",
                              )
                            }
                            className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition ${
                              conversationMode === item.value
                                ? "bg-white text-slate-900 shadow-xs"
                                : "text-slate-500 hover:text-slate-800"
                            }`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>

                      <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-background px-3">
                        <Search size={14} className="text-slate-400" />
                        <input
                          value={conversationFilterQuery}
                          onChange={(event) =>
                            setConversationFilterQuery(event.target.value)
                          }
                          placeholder={
                            directoryView === "GROUPS"
                              ? "Filter group chats"
                              : "Filter DM chats"
                          }
                          className="w-full bg-transparent py-2 text-sm outline-none"
                        />
                        {!!conversationFilterQuery.trim() && (
                          <button
                            onClick={() => setConversationFilterQuery("")}
                            className="text-slate-400 transition hover:text-slate-600"
                            aria-label="Clear conversation filter"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>

                      {hasConversationFilters && (
                        <div className="mt-2 flex justify-end">
                          <button
                            onClick={() => {
                              setConversationMode("ALL");
                              setConversationFilterQuery("");
                            }}
                            className="text-xs font-medium text-slate-500 transition hover:text-slate-700"
                          >
                            Reset conversation filters
                          </button>
                        </div>
                      )}

                      <div className="mt-4 max-h-90 overflow-y-auto rounded-xl border border-slate-200 bg-white xl:max-h-none xl:flex-1">
                        {managedConversations.map((conversation) => (
                          <ConversationListItem
                            key={conversation.id}
                            conversation={conversation}
                            isSelected={
                              conversation.id === selectedConversationId
                            }
                            onOpenConversation={handleOpenConversation}
                          />
                        ))}
                        {!managedConversations.length && (
                          <div className="rounded-lg border border-dashed border-border bg-slate-50 p-4 text-center text-sm text-slate-500">
                            {hasConversationFilters
                              ? "No matches for current filters. Reset filters to see all conversations."
                              : "No conversations yet. Start a new contact chat or join a group."}
                          </div>
                        )}

                        {!hasConversationFilters && hasMoreConversations && (
                          <button
                            onClick={() => void handleLoadMoreConversations()}
                            disabled={isLoadingMoreConversations}
                            className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                          >
                            {isLoadingMoreConversations
                              ? "Loading more..."
                              : "Load more conversations"}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </motion.section>
                <motion.section
                  className={`h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[#efeae2] bg-[radial-gradient(rgba(255,255,255,0.34)_1px,transparent_1px),radial-gradient(rgba(0,0,0,0.03)_1px,transparent_1px)] bg-position-[0_0,11px_11px] bg-size-[22px_22px] ${
                    workspaceView === "CHAT" ? "flex" : "hidden lg:flex"
                  }`}
                >
                  <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-3 py-2 sm:px-4 sm:py-2.5 lg:min-h-15 lg:px-4 lg:py-2">
                    {/* WhatsApp-style chat header */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {/* Avatar and name */}
                        <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-slate-200 to-slate-300 text-sm font-bold uppercase text-slate-700">
                          {selectedConversationPhotoUrl ? (
                            <img
                              src={selectedConversationPhotoUrl}
                              alt={selectedConversationDisplayName}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            selectedConversationAvatarChar
                          )}
                        </div>
                        <div className="min-w-0">
                          <h2 className="truncate text-[15px] font-500 text-slate-900">
                            {selectedConversationDisplayName}
                          </h2>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {selectedConversation?.conversationType === "GROUP"
                              ? `Group · ${selectedConversation?.group?.memberCount || 0} members`
                              : "Direct message"}
                          </p>
                        </div>
                      </div>
                      {/* Action buttons */}
                      <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
                        <button
                          onClick={() => {
                            setIsConversationSidebarOpen(true);
                            setSidebarMode("TOOLS");
                            if (window.innerWidth < 1280) {
                              setWorkspaceView("DIRECTORY");
                            }
                          }}
                          className="hidden items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 sm:inline-flex"
                        >
                          <Users size={13} />
                          Tools
                        </button>
                        <button
                          onClick={() => {
                            setIsConversationSidebarOpen(true);
                            setSidebarMode("TOOLS");
                            setWorkspaceView("DIRECTORY");
                          }}
                          className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 sm:hidden"
                          aria-label="Open tools"
                        >
                          <Users size={13} />
                        </button>
                        <span className="hidden items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 sm:inline-flex">
                          <Activity size={12} />
                          {isSocketConnected ? "Live" : "Syncing"}
                        </span>
                        {selectedConversation?.conversationType !== "GROUP" &&
                          selectedConversation && (
                            <button
                              onClick={handleToggleConversationBlock}
                              disabled={isTogglingBlockUser}
                              className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                selectedConversationIsBlocked
                                  ? "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                                  : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                              }`}
                            >
                              {selectedConversationIsBlocked
                                ? "Unblock"
                                : "Block"}
                            </button>
                          )}
                        {selectedConversation?.conversationType === "GROUP" && (
                          <button
                            onClick={() =>
                              setShowGroupMembersPanel((current) => !current)
                            }
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                            aria-label={
                              showGroupMembersPanel
                                ? "Hide group members"
                                : "Show group members"
                            }
                          >
                            {showGroupMembersPanel ? (
                              <PanelRightClose size={13} />
                            ) : (
                              <PanelRightOpen size={13} />
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => setWorkspaceView("DIRECTORY")}
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 sm:hidden"
                        >
                          <ChevronLeft size={13} />
                        </button>
                      </div>
                    </div>
                    {/* Status messages */}
                    {selectedConversationIsPending && (
                      <div className="mt-3 rounded-lg border border-power-orange/30 bg-power-orange/8 p-2.5 text-sm text-slate-700">
                        {selectedConversationNeedsMyApproval ? (
                          <>
                            <p className="font-500">
                              Message request pending approval
                            </p>
                            <div className="mt-2 flex gap-2">
                              <button
                                onClick={handleAcceptRequest}
                                className="rounded-md bg-power-orange px-3 py-1 text-xs font-semibold text-white transition hover:opacity-90"
                              >
                                Accept
                              </button>
                              <button
                                onClick={handleRejectRequest}
                                className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                              >
                                Reject
                              </button>
                            </div>
                          </>
                        ) : (
                          <p className="text-xs">
                            Request sent. Message while waiting.
                          </p>
                        )}
                      </div>
                    )}
                    {selectedConversationIsBlocked && (
                      <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700">
                        Conversation blocked. Unblock to send messages.
                      </div>
                    )}
                  </div>

                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4">
                    {messages.map((message) => {
                      const isOwnMessage = message.senderId === profile?.userId;
                      const isGroupConversation =
                        selectedConversation?.conversationType === "GROUP";

                      return (
                        <MessageBubble
                          key={message.id}
                          message={message}
                          isOwnMessage={isOwnMessage}
                          isGroupConversation={!!isGroupConversation}
                          profileUserId={profile?.userId}
                          onOpenMobileActions={(selectedMessage) =>
                            setMobileActionMessageId(selectedMessage.id)
                          }
                          onRetry={retryFailedMessage}
                          onEdit={handleBeginEditMessage}
                          onDelete={handleDeleteMessage}
                          onCopy={handleCopyMessage}
                          isCopied={copiedMessageId === message.id}
                          isEditing={editingMessageId === message.id}
                          isMutating={isMutatingMessageId === message.id}
                        />
                      );
                    })}
                    {!selectedConversation && (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
                        Select a conversation to start messaging
                      </div>
                    )}

                    {!!selectedConversation && !messages.length && (
                      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm text-slate-500">
                        No messages yet. Start the conversation!
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>

                  {editingMessageId && (
                    <div className="mt-2 shrink-0 rounded-lg border border-power-orange/30 bg-power-orange/8 p-3">
                      <p className="text-xs font-semibold text-power-orange">
                        Editing message
                      </p>
                      <textarea
                        value={editingMessageDraft}
                        onChange={(event) =>
                          setEditingMessageDraft(event.target.value)
                        }
                        rows={2}
                        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-power-orange focus:outline-none"
                      />
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          onClick={handleSaveEditedMessage}
                          disabled={
                            isMutatingMessageId === editingMessageId ||
                            !editingMessageDraft.trim()
                          }
                          className="rounded-md bg-power-orange px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isMutatingMessageId === editingMessageId
                            ? "Saving"
                            : "Save"}
                        </button>
                        <button
                          onClick={handleCancelEditMessage}
                          disabled={isMutatingMessageId === editingMessageId}
                          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* WhatsApp-style composer */}
                  <div className="sticky bottom-0 z-20 shrink-0 border-t border-slate-200/80 bg-[#f0f2f5] px-3 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:px-4 sm:pt-2.5 sm:pb-[calc(0.875rem+env(safe-area-inset-bottom))] lg:static">
                    <div className="flex min-w-0 items-end gap-2.5">
                      <textarea
                        value={newMessage}
                        onChange={(event) => setNewMessage(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            if (canSendSelectedConversationMessage) {
                              handleSendMessage();
                            }
                          }
                        }}
                        placeholder={
                          !selectedConversation
                            ? "Select a conversation"
                            : selectedConversationIsBlocked
                              ? "Conversation blocked"
                              : selectedConversationNeedsMyApproval
                                ? "Accept request first"
                                : "Type a message..."
                        }
                        disabled={
                          !canSendSelectedConversationMessage || isSending
                        }
                        rows={1}
                        className="max-h-28 min-w-0 flex-1 resize-none rounded-3xl border border-slate-200 bg-white px-4 py-2.5 text-sm leading-6 placeholder-slate-400 focus:border-power-orange focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
                      />
                      <button
                        disabled={
                          isSending ||
                          !canSendSelectedConversationMessage ||
                          !newMessage.trim()
                        }
                        onClick={handleSendMessage}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-power-orange text-white transition hover:opacity-90 active:scale-95 disabled:opacity-50"
                        aria-label={isSending ? "Sending" : "Send message"}
                      >
                        {isSending ? (
                          <RotateCcw size={16} className="animate-spin" />
                        ) : (
                          <MessageSquare size={16} />
                        )}
                      </button>
                    </div>
                    <p className="mt-1 hidden text-[11px] text-slate-500 sm:block">
                      Enter to send • Shift+Enter for new line
                    </p>
                  </div>

                  {error && (
                    <p className="mt-2 shrink-0 px-3 pb-2 text-xs font-medium text-red-600 sm:px-4">
                      {error}
                    </p>
                  )}
                </motion.section>

                <AnimatePresence initial={false}>
                  {showGroupInsightsSidebar && selectedConversation?.group ? (
                    <>
                      <motion.button
                        key="group-sidebar-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        onClick={() => setShowGroupMembersPanel(false)}
                        className="fixed inset-0 z-40 bg-slate-900/40 xl:hidden"
                        aria-label="Close member sidebar"
                      />
                      <motion.section
                        key="group-sidebar-panel"
                        initial={{ opacity: 0, x: 28 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 24 }}
                        transition={{ duration: 0.24, ease: "easeOut" }}
                        className="fixed inset-y-0 right-0 z-50 w-[92vw] max-w-sm overflow-y-auto border-l border-border bg-white p-4 shadow-xl xl:w-95 xl:max-w-none"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <UserCircle2 size={16} className="text-slate-600" />
                            <h3 className="text-base font-semibold tracking-tight">
                              Group Sidebar
                            </h3>
                          </div>
                          <button
                            onClick={() => setShowGroupMembersPanel(false)}
                            className="inline-flex items-center gap-1 rounded-lg border border-border bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                          >
                            <PanelRightClose size={14} />
                            Close
                          </button>
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          Members, quick profile access, and invite tools.
                        </p>

                        <div className="mt-4 space-y-3">
                          <GroupMembersList
                            groupId={selectedConversation.group.id}
                            onMemberClick={handleMemberClick}
                          />
                        </div>
                      </motion.section>
                    </>
                  ) : null}
                </AnimatePresence>

                {isConversationsView && workspaceView !== "CHAT" && (
                  <nav
                    className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/96 backdrop-blur lg:hidden"
                    style={{
                      paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
                    }}
                  >
                    <div className="mx-auto grid max-w-lg grid-cols-3 gap-0.5 p-2">
                      {/* Chat Tab */}
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          if (selectedConversationId) {
                            setWorkspaceView("CHAT");
                          } else {
                            setWorkspaceView("DIRECTORY");
                          }
                          setSidebarMode("INBOX");
                        }}
                        className={`relative inline-flex flex-col items-center justify-center gap-1 rounded-lg px-3 py-2.5 text-xs font-500 transition ${
                          activeMobileDockTab === "CHAT"
                            ? "text-white"
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {activeMobileDockTab === "CHAT" && (
                          <motion.div
                            layoutId="mobile-dock-pill"
                            className="absolute inset-0 rounded-lg bg-power-orange"
                            transition={{
                              type: "spring",
                              stiffness: 380,
                              damping: 30,
                            }}
                          />
                        )}
                        <span className="relative z-10 inline-flex items-center justify-center">
                          <MessageSquare size={20} />
                        </span>
                        <span className="relative z-10 text-[11px]">Chat</span>
                      </motion.button>

                      {/* List Tab */}
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          setSidebarMode("INBOX");
                          setWorkspaceView("DIRECTORY");
                        }}
                        className={`relative inline-flex flex-col items-center justify-center gap-1 rounded-lg px-3 py-2.5 text-xs font-500 transition ${
                          activeMobileDockTab === "LIST"
                            ? "text-white"
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {activeMobileDockTab === "LIST" && (
                          <motion.div
                            layoutId="mobile-dock-pill"
                            className="absolute inset-0 rounded-lg bg-power-orange"
                            transition={{
                              type: "spring",
                              stiffness: 380,
                              damping: 30,
                            }}
                          />
                        )}
                        <span className="relative z-10 inline-flex items-center justify-center">
                          <Users size={20} />
                        </span>
                        <span className="relative z-10 text-[11px]">Chats</span>
                      </motion.button>

                      {/* Tools Tab */}
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={() => {
                          setSidebarMode("TOOLS");
                          setWorkspaceView("DIRECTORY");
                          setDirectoryView("GROUPS");
                        }}
                        className={`relative inline-flex flex-col items-center justify-center gap-1 rounded-lg px-3 py-2.5 text-xs font-500 transition ${
                          activeMobileDockTab === "TOOLS"
                            ? "text-white"
                            : "text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        {activeMobileDockTab === "TOOLS" && (
                          <motion.div
                            layoutId="mobile-dock-pill"
                            className="absolute inset-0 rounded-lg bg-power-orange"
                            transition={{
                              type: "spring",
                              stiffness: 380,
                              damping: 30,
                            }}
                          />
                        )}
                        <span className="relative z-10 inline-flex items-center justify-center">
                          <Search size={20} />
                        </span>
                        <span className="relative z-10 text-[11px]">Tools</span>
                      </motion.button>
                    </div>
                  </nav>
                )}
              </motion.main>
            </div>
          )}
        </motion.div>
      </motion.div>

      <CommunityMemberProfileModal
        isOpen={isMemberProfileOpen}
        isLoading={isLoadingMemberProfile}
        error={memberProfileError}
        profile={selectedMemberProfile}
        onClose={handleCloseMemberProfile}
        onMessage={handleMessageSelectedMember}
      />

      {mobileActionMessage && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-60 flex items-end bg-slate-900/40 p-0 sm:hidden"
          onClick={() => setMobileActionMessageId(null)}
        >
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full rounded-t-3xl border-t border-slate-200 bg-white px-4 pb-8 pt-4 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Handle indicator */}
            <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-slate-300" />

            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Message options
            </p>

            {/* WhatsApp-style action buttons */}
            <div className="mt-4 space-y-2.5">
              {!mobileActionMessage.isDeleted && (
                <button
                  onClick={() => {
                    handleCopyMessage(mobileActionMessage);
                    setMobileActionMessageId(null);
                  }}
                  className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-500 text-slate-800 transition hover:bg-slate-50 active:bg-slate-100"
                >
                  <Copy size={18} className="text-slate-600" />
                  Copy message
                </button>
              )}

              {mobileActionMessage.senderId === profile?.userId &&
                mobileActionMessage.messageStatus === "FAILED" && (
                  <button
                    onClick={() => {
                      void retryFailedMessage(mobileActionMessage);
                      setMobileActionMessageId(null);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-500 text-slate-800 transition hover:bg-slate-50 active:bg-slate-100"
                  >
                    <RotateCcw size={18} className="text-slate-600" />
                    Retry sending
                  </button>
                )}

              {mobileActionMessage.senderId === profile?.userId &&
                !mobileActionMessage.isDeleted &&
                mobileActionMessage.messageStatus !== "FAILED" && (
                  <>
                    <button
                      onClick={() => {
                        handleBeginEditMessage(mobileActionMessage);
                        setMobileActionMessageId(null);
                      }}
                      disabled={
                        !isWithinMessageEditWindow(
                          mobileActionMessage.createdAt,
                        )
                      }
                      className="flex w-full items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-500 text-slate-800 transition hover:bg-slate-50 active:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Pencil size={18} className="text-slate-600" />
                      Edit message
                    </button>
                    <button
                      onClick={() => {
                        void handleDeleteMessage(mobileActionMessage);
                        setMobileActionMessageId(null);
                      }}
                      disabled={
                        !isWithinMessageEditWindow(
                          mobileActionMessage.createdAt,
                        )
                      }
                      className="flex w-full items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-500 text-red-700 transition hover:bg-red-100 active:bg-red-200 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 size={18} className="text-red-600" />
                      Delete message
                    </button>
                  </>
                )}
            </div>

            <button
              onClick={() => setMobileActionMessageId(null)}
              className="mt-3 w-full rounded-lg border border-slate-200 bg-slate-100 px-4 py-3 text-sm font-500 text-slate-800 transition hover:bg-slate-200 active:bg-slate-300"
            >
              Done
            </button>
          </motion.div>
        </motion.div>
      )}

      {/* Report Content Modal */}
      {reportModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setReportModal(null);
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.24, ease: "easeOut" }}
            className="w-full max-w-md rounded-2xl border border-border bg-white p-6 shadow-xl"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Flag size={18} className="text-red-500" />
                <h3 className="text-base font-semibold text-slate-900">
                  Report{" "}
                  {reportModal.targetType === "GROUP" ? "Group" : "Message"}
                </h3>
              </div>
              <button
                onClick={() => setReportModal(null)}
                className="rounded-lg border border-border p-1.5 text-slate-500 transition hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Reason <span className="text-red-500">*</span>
                </label>
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-power-orange focus:outline-none"
                >
                  <option value="">Select a reason</option>
                  <option value="Spam">Spam</option>
                  <option value="Harassment">Harassment</option>
                  <option value="Hate speech">Hate speech</option>
                  <option value="Inappropriate content">
                    Inappropriate content
                  </option>
                  <option value="Fake information">Fake information</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Additional details (optional)
                </label>
                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  placeholder="Provide any additional context"
                  rows={3}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-power-orange focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setReportModal(null)}
                className="flex-1 rounded-lg border border-border bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSubmitReport()}
                disabled={isSubmittingReport || !reportReason}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {isSubmittingReport ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </>
  );
}
