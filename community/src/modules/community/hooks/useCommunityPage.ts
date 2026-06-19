"use client";

import { getCommunitySocket } from "@/lib/realtime/socket";
import { getMainAppUrl, redirectToMainLogin } from "@/lib/auth/redirect";
import { isCommunityEligibleRole } from "@/lib/auth/roles";
import { toast } from "@/lib/toast";
import { communityService } from "@/modules/community/services/community";
import { communityFollowStore } from "@/modules/community/lib/followStore";
import { uploadChatImage } from "@/modules/community/hooks/useChatImageUpload";
import { getCachedMessages, setCachedMessages, upsertCachedMessage, deleteCachedMessage } from "@/lib/db/chatDB";
import {
  CommunityUserSearchResult,
  CommunityGroupSummary,
  CommunityProfile,
  CommunityMemberProfile,
  ConversationListResponse,
  ConversationItem,
  ConversationMessage,
} from "@/modules/community/types";
import { GroupMember } from "@/modules/community/components/GroupMembersList";
import { getAvatarCharacter, isWithinMessageEditWindow } from "@/modules/community/utils/chatUtils";
import {
  COMMUNITY_ACTIVE_TAB_KEY,
  COMMUNITY_WORKSPACE_VIEW_KEY,
  COMMUNITY_DIRECTORY_VIEW_KEY,
  COMMUNITY_SELECTED_CONVERSATION_KEY,
  COMMUNITY_SIDEBAR_MODE_KEY,
  CONVERSATION_PAGE_SIZE,
  DISCONNECTED_POLL_BASE_MS,
  DISCONNECTED_POLL_MAX_MS,
  isValidDirectoryView,
  isValidGroupToolsMode,
  isValidSidebarTab,
  isValidWorkspaceView,
  resolveSidebarQueryState,
} from "@/modules/community/constants/communityPage";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

export function useCommunityPage(options?: { forceView?: "community-overview" | "conversations" }) {
  const prefersReducedMotion = useReducedMotion();
  const router = useRouter();
  const pathname = usePathname();
  const urlSearchParams = useSearchParams();
  // const [searchQuery, setSearchQuery] = useState("");
  const lastAppliedQueryRef = useRef("");
  const hasHydratedUrlRef = useRef(false);

  const [activeSidebarTab, setActiveSidebarTab] = useState<
    "community-overview" | "conversations"
  >(() => {
    if (typeof window === "undefined") return "community-overview";
    const stored = window.localStorage.getItem(COMMUNITY_ACTIVE_TAB_KEY);
    return isValidSidebarTab(stored) ? stored : "community-overview";
  });
  const [workspaceView, setWorkspaceView] = useState<
    "CHAT" | "DIRECTORY" | "PRIVACY"
  >(() => {
    if (typeof window === "undefined") return "CHAT";
    const stored = window.localStorage.getItem(COMMUNITY_WORKSPACE_VIEW_KEY);
    return isValidWorkspaceView(stored) ? stored : "CHAT";
  });
  const [directoryView, setDirectoryView] = useState<"CONTACTS" | "GROUPS">(
    () => {
      if (typeof window === "undefined") return "CONTACTS";
      const stored = window.localStorage.getItem(COMMUNITY_DIRECTORY_VIEW_KEY);
      return isValidDirectoryView(stored)
        ? stored === "GROUPS"
          ? "GROUPS"
          : "CONTACTS"
        : "CONTACTS";
    },
  );
  const [sidebarMode, setSidebarMode] = useState<"INBOX" | "TOOLS">(() => {
    if (typeof window === "undefined") return "INBOX";
    return window.localStorage.getItem(COMMUNITY_SIDEBAR_MODE_KEY) === "TOOLS"
      ? "TOOLS"
      : "INBOX";
  });

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

  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [conversationPage, setConversationPage] = useState(1);
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [isLoadingMoreConversations, setIsLoadingMoreConversations] =
    useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [messagePage, setMessagePage] = useState(1);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
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
  const [isDeletingGroupId, setIsDeletingGroupId] = useState<string | null>(null);

  const [reportModal, setReportModal] = useState<{
    targetType: "MESSAGE" | "GROUP";
    targetId: string;
  } | null>(null);
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
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
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
  const [typingUsers, setTypingUsers] = useState<Record<string, string[]>>({});

  const selectedConversationIdRef = useRef<string | null>(null);
  const typingTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const memberProfileRequestIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isInitialMessageLoadRef = useRef<boolean>(false);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const disconnectedPollDelayRef = useRef(DISCONNECTED_POLL_BASE_MS);
  const isRefreshingConversationsRef = useRef(false);
  const shouldRefreshConversationsRef = useRef(false);

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
      if (!conversationId) return null;
      return safeConversations.find((c) => c.id === conversationId) || null;
    },
    [safeConversations],
  );

  const getGroupConversationByGroupId = useCallback(
    (groupId: string) => {
      return safeConversations.find((c) => c.group?.id === groupId) || null;
    },
    [safeConversations],
  );

  const selectedConversation = useMemo(
    () => getConversationById(selectedConversationId),
    [getConversationById, selectedConversationId],
  );
  const mobileActionMessage = useMemo(() => {
    if (!mobileActionMessageId) return null;
    return messages.find((m) => m.id === mobileActionMessageId) || null;
  }, [messages, mobileActionMessageId]);

  const appendMessage = (incoming: ConversationMessage) => {
    setMessages((current) => {
      const safeCurrent = Array.isArray(current) ? current : [];
      if (safeCurrent.some((m) => m.id === incoming.id)) return safeCurrent;
      const newMessages = [...safeCurrent, incoming];
      void setCachedMessages(incoming.conversationId, newMessages);
      return newMessages;
    });
  };

  const removeMessageById = (messageId: string) => {
    setMessages((current) => {
      const safeCurrent = Array.isArray(current) ? current : [];
      const updated = safeCurrent.filter((m) => m.id !== messageId);
      if (selectedConversationIdRef.current) {
        void setCachedMessages(selectedConversationIdRef.current, updated);
      }
      return updated;
    });
  };

  const updateMessageById = (
    messageId: string,
    updater: (m: ConversationMessage) => ConversationMessage,
  ) => {
    setMessages((current) => {
      const safeCurrent = Array.isArray(current) ? current : [];
      const updated = safeCurrent.map((m) =>
        m.id === messageId ? updater(m) : m,
      );
      if (selectedConversationIdRef.current) {
        void setCachedMessages(selectedConversationIdRef.current, updated);
      }
      return updated;
    });
  };

  const totalUnread = useMemo(
    () =>
      safeConversations.reduce((sum, item) => sum + (item.unreadCount || 0), 0),
    [safeConversations],
  );
  const pendingRequestsCount = useMemo(
    () =>
      safeConversations.filter(
        (c) => c.status === "PENDING" && c.conversationType !== "GROUP",
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

  const activeSidebarTabToUse = options?.forceView || activeSidebarTab;
  const isCommunityView = activeSidebarTabToUse === "community-overview";
  const isConversationsView = activeSidebarTabToUse === "conversations";
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
    () => safeGroupResults.filter((g) => g.isMember).length,
    [safeGroupResults],
  );
  const contactConversations = useMemo(
    () => safeConversations.filter((c) => c.conversationType !== "GROUP"),
    [safeConversations],
  );
  const groupConversations = useMemo(
    () => safeConversations.filter((c) => c.conversationType === "GROUP"),
    [safeConversations],
  );
  const visibleConversations = useMemo(() => {
    const source =
      directoryView === "GROUPS" ? groupConversations : contactConversations;
    const query = conversationFilterQuery.trim().toLowerCase();
    if (!query) return source;
    return source.filter((c) => {
      const displayName = c.otherParticipant.displayName?.toLowerCase() || "";
      const latestMessage = c.latestMessage?.content?.toLowerCase() || "";
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
        ? visibleConversations.filter((c) => c.unreadCount > 0)
        : conversationMode === "REQUESTS"
          ? visibleConversations.filter(
            (c) => c.status === "PENDING" && c.conversationType !== "GROUP",
          )
          : visibleConversations;

    return [...byMode].sort((a, b) => {
      if (a.status === "PENDING" && b.status !== "PENDING") return -1;
      if (a.status !== "PENDING" && b.status === "PENDING") return 1;
      if ((a.unreadCount || 0) !== (b.unreadCount || 0))
        return (b.unreadCount || 0) - (a.unreadCount || 0);
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
    if (groupMode === "JOINED")
      return safeGroupResults.filter((g) => g.isMember);
    if (groupMode === "DISCOVER")
      return safeGroupResults.filter((g) => !g.isMember);
    return safeGroupResults;
  }, [safeGroupResults, groupMode]);

  const toolVisibleGroups = useMemo(
    () =>
      visibleGroups.filter((g) =>
        groupToolsMode === "DISCOVER" ? !g.isMember : !!g.isMember,
      ),
    [visibleGroups, groupToolsMode],
  );

  const toolsSteps = useMemo(() => {
    if (directoryView === "CONTACTS")
      return [
        { id: "search", label: "Search users", done: true },
        {
          id: "start",
          label: "Start conversation",
          done: Boolean(selectedConversation),
        },
      ];
    return [
      {
        id: "discover",
        label: "Discover",
        done: groupToolsMode !== "DISCOVER",
      },
      { id: "manage", label: "Manage", done: groupToolsMode === "INVITE" },
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
      options?: { append?: boolean; preserveSelection?: boolean },
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
        if (!append) return safeItems;
        const existingIds = new Set(safeCurrent.map((c) => c.id));
        const nextItems = safeItems.filter((c) => !existingIds.has(c.id));
        return [...safeCurrent, ...nextItems];
      });

      setConversationPage(safePagination.page);
      setHasMoreConversations(safePagination.hasMore);

      if (!append) {
        setSelectedConversationId((current) => {
          if (!safeItems.length) return null;
          if (
            preserveSelection &&
            current &&
            safeItems.some((c) => c.id === current)
          )
            return current;
          return null;
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
      if (refreshTimeoutRef.current) return;
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
        if (!!a.isMember !== !!b.isMember) return a.isMember ? 1 : -1;
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

  const markNotificationsForConversationAsRead = useCallback(
    async (conversationId: string) => {
      try {
        const allNotifications = await communityService.listCommunityNotifications(
          1,
          100,
          false, // unread only
        );

        const relatedNotifications = allNotifications.items.filter(
          (item) => item.data?.conversationId === conversationId && !item.isRead,
        );

        await Promise.all(
          relatedNotifications.map((notification) =>
            communityService.markCommunityNotificationRead(notification.id),
          ),
        );
      } catch (error) {
        console.debug("Failed to mark notifications as read:", error);
      }
    },
    [],
  );

  const loadMessages = useCallback(
    async (conversationId: string) => {
      try {
        // Signal that this is a fresh load — auto-scroll to bottom on first render
        isInitialMessageLoadRef.current = true;

        // Optimistically load from IndexedDB
        const cached = await getCachedMessages(conversationId);
        if (cached && cached.length > 0) {
          setMessages(cached);
        }

        const response = await communityService.getMessages(conversationId, 1);
        const serverMessages = Array.isArray(response.messages) ? response.messages : [];
        setMessages(serverMessages);
        void setCachedMessages(conversationId, serverMessages);
        
        setMessagePage(1);
        if (response.pagination) {
          setHasMoreMessages(response.pagination.page < response.pagination.totalPages);
        } else {
          setHasMoreMessages(false);
        }

        // Mark related notifications as read
        await markNotificationsForConversationAsRead(conversationId);

        // Optimistically clear unread count for immediate sidebar UI update
        setConversations((current) =>
          Array.isArray(current)
            ? current.map((c) =>
                c.id === conversationId ? { ...c, unreadCount: 0 } : c
              )
            : current
        );

        const socket = getCommunitySocket();
        if (socket.connected) {
          socket.emit("community:markRead", { conversationId });
        }

        // Defer refresh to allow backend to process markRead
        setTimeout(() => refreshConversationsNow(), 500);
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Failed to load messages";
        setError(message);
        toast.error(message);
      }
    },
    [refreshConversationsNow, markNotificationsForConversationAsRead],
  );

  const loadMoreMessages = useCallback(async () => {
    if (!selectedConversationId || isLoadingMoreMessages || !hasMoreMessages) return;
    setIsLoadingMoreMessages(true);
    try {
      const nextPage = messagePage + 1;
      const response = await communityService.getMessages(selectedConversationId, nextPage);
      
      const newMessages = Array.isArray(response.messages) ? response.messages : [];
      setMessages((current) => {
        // Prepend new messages, filtering out any duplicates
        const currentIds = new Set(current.map(m => m.id));
        const filteredNew = newMessages.filter(m => !currentIds.has(m.id));
        const updated = [...filteredNew, ...current];
        void setCachedMessages(selectedConversationId, updated);
        return updated;
      });
      
      setMessagePage(nextPage);
      if (response.pagination) {
        setHasMoreMessages(response.pagination.page < response.pagination.totalPages);
      } else {
        setHasMoreMessages(false);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load older messages");
    } finally {
      setIsLoadingMoreMessages(false);
    }
  }, [selectedConversationId, messagePage, hasMoreMessages, isLoadingMoreMessages]);

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
    if (typeof window !== "undefined")
      window.localStorage.setItem(COMMUNITY_ACTIVE_TAB_KEY, activeSidebarTab);
  }, [activeSidebarTab]);
  useEffect(() => {
    if (typeof window !== "undefined")
      window.localStorage.setItem(COMMUNITY_WORKSPACE_VIEW_KEY, workspaceView);
  }, [workspaceView]);
  useEffect(() => {
    if (typeof window !== "undefined")
      window.localStorage.setItem(COMMUNITY_DIRECTORY_VIEW_KEY, directoryView);
  }, [directoryView]);
  useEffect(() => {
    if (typeof window !== "undefined")
      window.localStorage.setItem(COMMUNITY_SIDEBAR_MODE_KEY, sidebarMode);
  }, [sidebarMode]);
  // useEffect(() => {
  //   setSearchQuery(urlSearchParams.toString());
  // }, [urlSearchParams]);

  useEffect(() => {
    const currentQuery = urlSearchParams.toString();

    if (
      hasHydratedUrlRef.current &&
      currentQuery === lastAppliedQueryRef.current
    ) {
      return;
    }

    const queryParams = new URLSearchParams(currentQuery);
    const sidebarState = resolveSidebarQueryState(queryParams.get("sidebar"));
    const urlDirectoryView =
      queryParams.get("directory")?.toUpperCase() || null;
    const urlGroupToolsMode = queryParams.get("panel")?.toUpperCase() || null;
    const urlConversationId = queryParams.get("conversation") || null;
    const urlQuery = queryParams.get("q") || null;

    if (sidebarState.mode)
      setSidebarMode((c) => (c === sidebarState.mode ? c : sidebarState.mode!));
    if (sidebarState.tab)
      setActiveSidebarTab((c) =>
        c === sidebarState.tab ? c : sidebarState.tab!,
      );
    if (isValidDirectoryView(urlDirectoryView))
      setDirectoryView((c) => (c === urlDirectoryView ? c : urlDirectoryView));
    if (isValidGroupToolsMode(urlGroupToolsMode))
      setGroupToolsMode((c) =>
        c === urlGroupToolsMode ? c : urlGroupToolsMode,
      );
    if (typeof urlConversationId === "string" && urlConversationId.trim()) {
      setSelectedConversationId((c) =>
        c === urlConversationId ? c : urlConversationId,
      );
      setActiveSidebarTab("conversations");
      setWorkspaceView("CHAT");
    }
    if (typeof urlQuery === "string" && urlQuery.trim())
      setGroupSearchQuery((c) => (c === urlQuery.trim() ? c : urlQuery.trim()));

    hasHydratedUrlRef.current = true;
    lastAppliedQueryRef.current = currentQuery;
  }, [urlSearchParams]);

  useEffect(() => {
    const params = new URLSearchParams(urlSearchParams.toString());
    if (sidebarMode === "TOOLS") {
      params.set("sidebar", "tools");
    } else {
      if (activeSidebarTab === "conversations") {
        params.set("sidebar", "conversations");
      } else {
        params.set("sidebar", "community-overview");
      }
    }
    params.set("directory", directoryView.toLowerCase());
    if (sidebarMode === "TOOLS" && directoryView === "GROUPS")
      params.set("panel", groupToolsMode.toLowerCase());
    else params.delete("panel");
    if (selectedConversationId)
      params.set("conversation", selectedConversationId);
    else params.delete("conversation");

    const nextQuery = params.toString();
    const currentQuery = urlSearchParams.toString();

    if (nextQuery === currentQuery) {
      lastAppliedQueryRef.current = nextQuery;
      return;
    }
    if (nextQuery !== lastAppliedQueryRef.current) {
      lastAppliedQueryRef.current = nextQuery;
      router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
        scroll: false,
      });
    }
  }, [
    urlSearchParams,
    sidebarMode,
    activeSidebarTab,
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
      if (groupToolsMode !== "DISCOVER") {
        setGroupToolsMode("DISCOVER");
      }

      setIsCreateGroupOpen(false);
      setInviteGroupId(null);
    }
  }, [conversationMode, directoryView, groupToolsMode]);

  useEffect(() => {
    if (activeSidebarTab === "community-overview") {
      if (sidebarMode !== "INBOX") setSidebarMode("INBOX");
      if (workspaceView !== "CHAT") setWorkspaceView("CHAT");
      return;
    }
    if (sidebarMode !== "TOOLS") return;
    if (activeSidebarTab !== "conversations")
      setActiveSidebarTab("conversations");
    if (workspaceView !== "DIRECTORY") setWorkspaceView("DIRECTORY");
    if (!isConversationSidebarOpen) setIsConversationSidebarOpen(true);
  }, [sidebarMode, activeSidebarTab, workspaceView, isConversationSidebarOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobileViewport = window.matchMedia("(max-width: 1279px)").matches;
    if (!isMobileViewport || !isConversationsView || selectedConversationId)
      return;
    if (workspaceView !== "DIRECTORY") setWorkspaceView("DIRECTORY");
    if (sidebarMode !== "INBOX") setSidebarMode("INBOX");
    if (!isConversationSidebarOpen) setIsConversationSidebarOpen(true);
  }, [
    isConversationSidebarOpen,
    isConversationsView,
    selectedConversationId,
    sidebarMode,
    workspaceView,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (selectedConversationId)
      window.localStorage.setItem(
        COMMUNITY_SELECTED_CONVERSATION_KEY,
        selectedConversationId,
      );
    else window.localStorage.removeItem(COMMUNITY_SELECTED_CONVERSATION_KEY);
  }, [selectedConversationId]);

  useEffect(() => {
    if (selectedConversation?.conversationType !== "GROUP")
      setShowGroupMembersPanel(false);
  }, [selectedConversation?.conversationType]);

  useEffect(() => {
    if (selectedConversation) {
      const isGroup = selectedConversation.conversationType === "GROUP";
      setDirectoryView(isGroup ? "GROUPS" : "CONTACTS");
    }
  }, [selectedConversation]);

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
        toast.error(e instanceof Error ? e.message : "Failed to search users");
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
        setError(e instanceof Error ? e.message : "Failed to load groups");
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
        toast.error(e instanceof Error ? e.message : "Failed to search users");
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
    const handleDisconnect = () => setIsSocketConnected(false);
    const handleNewMessage = (message: ConversationMessage) => {
      if (message.senderId !== profile?.userId) {
        socket.emit("community:markConversationAsDelivered", {
          conversationId: message.conversationId,
        });
      }

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
      if (payload.conversationId !== selectedConversationIdRef.current) return;
      setMessages((current) => {
        const updated = (Array.isArray(current) ? current : []).map((m) => {
          if (!payload.messageIds.includes(m.id)) return m;
          const readBy = m.readBy || [];
          if (readBy.includes(payload.readerId)) return m;
          return { ...m, readBy: [...readBy, payload.readerId] };
        });
        void setCachedMessages(payload.conversationId, updated);
        return updated;
      });
    };
    const handleMessagesDelivered = (payload: {
      conversationId: string;
      readerId: string;
      messageIds: string[];
    }) => {
      if (payload.conversationId !== selectedConversationIdRef.current) return;
      setMessages((current) => {
        const updated = (Array.isArray(current) ? current : []).map((m) => {
          if (!payload.messageIds.includes(m.id)) return m;
          const deliveredTo = m.deliveredTo || [];
          if (deliveredTo.includes(payload.readerId)) return m;
          return { ...m, deliveredTo: [...deliveredTo, payload.readerId] };
        });
        void setCachedMessages(payload.conversationId, updated);
        return updated;
      });
    };
    const handleConversationUpdated = (payload?: {
      conversationId?: string;
    }) => {
      if (payload?.conversationId && socket.connected) {
        socket.emit("community:joinConversation", {
          conversationId: payload.conversationId,
        });
      }
      queueConversationRefresh(100);
    };
    const handleMessageEdited = (message: ConversationMessage) => {
      if (message.conversationId !== selectedConversationIdRef.current) {
        queueConversationRefresh();
        return;
      }
      updateMessageById(message.id, (current) => ({ ...current, ...message }));
      queueConversationRefresh(120);
    };
    const handleMessageDeleted = (message: ConversationMessage) => {
      if (message.conversationId !== selectedConversationIdRef.current) {
        queueConversationRefresh();
        return;
      }
      updateMessageById(message.id, (current) => ({ ...current, ...message }));
      queueConversationRefresh(120);
    };
    const handleCommunityError = (payload: { message: string }) =>
      setError(payload.message);
    const handleConnectError = (connectError: Error) => {
      setIsSocketConnected(false);
      if (/unauthorized|authentication/i.test(connectError.message))
        redirectToMainLogin();
    };

    const handleUserTyping = (payload: { conversationId: string; userId: string; isTyping: boolean }) => {
      const { conversationId, userId, isTyping } = payload;
      if (userId === profile?.userId) return;

      setTypingUsers((current) => {
        const users = current[conversationId] || [];
        const newUsers = isTyping 
          ? Array.from(new Set([...users, userId]))
          : users.filter((id) => id !== userId);
        return { ...current, [conversationId]: newUsers };
      });

      const timeoutKey = `${conversationId}_${userId}`;
      if (typingTimeoutsRef.current[timeoutKey]) {
        clearTimeout(typingTimeoutsRef.current[timeoutKey]);
      }

      if (isTyping) {
        typingTimeoutsRef.current[timeoutKey] = setTimeout(() => {
          setTypingUsers((current) => {
            const users = current[conversationId] || [];
            return {
              ...current,
              [conversationId]: users.filter((id) => id !== userId),
            };
          });
        }, 5000);
      }
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("community:newMessage", handleNewMessage);
    socket.on("community:messagesRead", handleMessagesRead);
    socket.on("community:messagesDelivered", handleMessagesDelivered);
    socket.on("community:conversationUpdated", handleConversationUpdated);
    socket.on("community:messageEdited", handleMessageEdited);
    socket.on("community:messageDeleted", handleMessageDeleted);
    socket.on("community:error", handleCommunityError);
    socket.on("connect_error", handleConnectError);
    socket.on("community:userTyping", handleUserTyping);

    if (socket.connected) handleConnect();
    else socket.connect();

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("community:newMessage", handleNewMessage);
      socket.off("community:messagesRead", handleMessagesRead);
      socket.off("community:messagesDelivered", handleMessagesDelivered);
      socket.off("community:conversationUpdated", handleConversationUpdated);
      socket.off("community:messageEdited", handleMessageEdited);
      socket.off("community:messageDeleted", handleMessageDeleted);
      socket.off("community:error", handleCommunityError);
      socket.off("connect_error", handleConnectError);
      socket.off("community:userTyping", handleUserTyping);
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
    if (!selectedConversationId || !selectedConversation) return;
    const socket = getCommunitySocket();
    if (socket.connected)
      socket.emit("community:joinConversation", {
        conversationId: selectedConversationId,
      });
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
      if (isStopped) return;
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
          disconnectedPollDelayRef.current = DISCONNECTED_POLL_BASE_MS;
        } catch {
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
      if (timeoutHandle) clearTimeout(timeoutHandle);
    };
  }, [
    applyConversationPage,
    isSocketConnected,
    selectedConversation,
    selectedConversationId,
  ]);

  useEffect(() => {
    if (!selectedConversationId) return;

    const container = scrollContainerRef.current;

    // On initial load of a conversation, always jump to the bottom instantly
    if (isInitialMessageLoadRef.current) {
      isInitialMessageLoadRef.current = false;
      messagesEndRef.current?.scrollIntoView({ behavior: "instant", block: "end" });
      return;
    }

    // On new messages: only auto-scroll if the user is already near the bottom (within 120px)
    if (container) {
      const distanceFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      if (distanceFromBottom < 120) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    }
  }, [messages, selectedConversationId]);

  const handleStartConversation = useCallback(
    async (targetUserId: string) => {
      if (!targetUserId.trim()) return;
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
      setError(e instanceof Error ? e.message : "Failed to create group");
      toast.error(e instanceof Error ? e.message : "Failed to create group");
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
      toast.error(e instanceof Error ? e.message : "Failed to join group");
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
      toast.error(e instanceof Error ? e.message : "Failed to leave group");
    } finally {
      setIsLeavingGroupId(null);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    try {
      setIsDeletingGroupId(groupId);
      await communityService.deleteGroup(groupId);
      await refreshGroupDirectoryState();
      if (selectedConversation?.group?.id === groupId) {
        setSelectedConversationId(null);
        setWorkspaceView("DIRECTORY");
      }
      toast.success("Group deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete group");
    } finally {
      setIsDeletingGroupId(null);
    }
  };

  const handleOpenReportModal = (
    targetType: "MESSAGE" | "GROUP",
    targetId: string,
  ) => {
    setReportModal({ targetType, targetId });
  };

  const handleSubmitReportWrapper = async (reason: string, details: string) => {
    if (!reportModal || !reason) return;
    try {
      setIsSubmittingReport(true);
      await communityService.reportContent({
        targetType: reportModal.targetType,
        targetId: reportModal.targetId,
        reason,
        details: details || undefined,
      });
      setReportModal(null);
      toast.success("Report submitted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit report");
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
      toast.error(e instanceof Error ? e.message : "Failed to add member");
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
      await communityService.updateGroupSettings(groupId, { memberAddPolicy });
      await refreshGroupDirectoryState({ refreshConversations: false });
      toast.success("Group settings updated");
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to update group settings",
      );
    } finally {
      setIsUpdatingGroupPolicyId(null);
    }
  };

  const getFeaturedGroupActionLabel = (group: CommunityGroupSummary) => {
    if (!group.isMember) return "Join";
    return getGroupConversationByGroupId(group.id)
      ? "Open chat"
      : "View groups";
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
    if (!selectedConversation) return;
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
      toast.error(e instanceof Error ? e.message : "Failed to accept request");
    }
  };

  const handleRejectRequest = async () => {
    if (!selectedConversation) return;
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
      toast.error(e instanceof Error ? e.message : "Failed to reject request");
    }
  };

  const handleToggleConversationBlock = async () => {
    const targetUserId = selectedConversation?.otherParticipant?.id;
    if (!targetUserId) return;
    const currentlyBlocked = (profile?.blockedUsers || []).includes(
      targetUserId,
    );
    const actionLabel = currentlyBlocked ? "unblock" : "block";

    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `Are you sure you want to ${actionLabel} this user for direct messages?`,
      )
    )
      return;

    setIsTogglingBlockUser(true);
    try {
      if (currentlyBlocked) {
        await communityService.unblockUser(targetUserId);
        setProfile((current) =>
          current
            ? {
              ...current,
              blockedUsers: (current.blockedUsers || []).filter(
                (id) => id !== targetUserId,
              ),
            }
            : current,
        );
        toast.success("User unblocked");
      } else {
        await communityService.blockUser(targetUserId);
        setProfile((current) =>
          current
            ? {
              ...current,
              blockedUsers: [...(current.blockedUsers || []), targetUserId],
            }
            : current,
        );
        toast.success("User blocked");
      }
      const updatedConversations = await communityService.listConversations(
        1,
        CONVERSATION_PAGE_SIZE,
      );
      applyConversationPage(updatedConversations, { preserveSelection: true });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : `Failed to ${actionLabel} user`,
      );
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
      const profileData = await communityService.getPlayerProfile(memberId);
      if (memberProfileRequestIdRef.current === memberId)
        setSelectedMemberProfile(profileData);
    } catch (e) {
      if (memberProfileRequestIdRef.current === memberId) {
        setMemberProfileError(
          e instanceof Error ? e.message : "Failed to load profile",
        );
        toast.error(e instanceof Error ? e.message : "Failed to load profile");
      }
    } finally {
      if (memberProfileRequestIdRef.current === memberId)
        setIsLoadingMemberProfile(false);
    }
  }, []);

  const handleMemberClick = (member: GroupMember) =>
    router.push(`/members/${member.id}`);

  const handleMessageSelectedMember = useCallback(() => {
    if (!selectedMemberProfile) return;
    handleCloseMemberProfile();
    void handleStartConversation(selectedMemberProfile.id);
  }, [
    handleCloseMemberProfile,
    handleStartConversation,
    selectedMemberProfile,
  ]);

  const handleLoadMoreConversations = async () => {
    if (isLoadingMoreConversations || !hasMoreConversations) return;
    setIsLoadingMoreConversations(true);
    try {
      const next = await communityService.listConversations(
        conversationPage + 1,
        CONVERSATION_PAGE_SIZE,
      );
      applyConversationPage(next, { append: true });
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Failed to load more conversations",
      );
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
        const ack = await new Promise<
          | { success: true; data: ConversationMessage }
          | { success: false; message?: string }
        >((resolve) => {
          const timeoutId = setTimeout(
            () =>
              resolve({ success: false, message: "Message send timed out" }),
            8000,
          );
          socket.emit(
            "community:sendMessage",
            { conversationId, content },
            (result: unknown) => {
              clearTimeout(timeoutId);
              resolve(
                (result as any) || {
                  success: false,
                  message: "Invalid server response",
                },
              );
            },
          );
        });
        if (!ack.success)
          throw new Error(ack.message || "Failed to send message");
        return { ...ack.data, messageStatus: "SENT" };
      }
      return {
        ...(await communityService.sendMessage(conversationId, content)),
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
          const timeoutId = setTimeout(
            () =>
              resolve({ success: false, message: "Message edit timed out" }),
            8000,
          );
          socket.emit(
            "community:editMessage",
            { messageId, content },
            (result: unknown) => {
              clearTimeout(timeoutId);
              resolve(
                (result as any) || {
                  success: false,
                  message: "Invalid server response",
                },
              );
            },
          );
        });
        if (!ack.success)
          throw new Error(ack.message || "Failed to edit message");
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
          const timeoutId = setTimeout(
            () =>
              resolve({ success: false, message: "Message delete timed out" }),
            8000,
          );
          socket.emit(
            "community:deleteMessage",
            { messageId },
            (result: unknown) => {
              clearTimeout(timeoutId);
              resolve(
                (result as any) || {
                  success: false,
                  message: "Invalid server response",
                },
              );
            },
          );
        });
        if (!ack.success)
          throw new Error(ack.message || "Failed to delete message");
        return ack.data;
      }
      return communityService.deleteMessage(messageId);
    },
    [],
  );

  const retryFailedMessage = useCallback(
    async (message: ConversationMessage) => {
      if (!message.content?.trim()) return;
      updateMessageById(message.id, (current) => ({
        ...current,
        messageStatus: "SENDING",
      }));
      setIsSending(true);
      try {
        const confirmedMessage = await sendMessageWithTransport(
          message.conversationId,
          message.content,
        );
        updateMessageById(message.id, (current) => ({
          ...current,
          ...confirmedMessage,
        }));
        queueConversationRefresh();
      } catch (e) {
        updateMessageById(message.id, (current) => ({
          ...current,
          messageStatus: "FAILED",
        }));
        toast.error(
          e instanceof Error ? e.message : "Failed to resend message",
        );
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
    )
      return;
    setEditingMessageId(message.id);
    setEditingMessageDraft(message.content);
  };

  const handleCancelEditMessage = () => {
    setEditingMessageId(null);
    setEditingMessageDraft("");
  };

  const handleSaveEditedMessage = async () => {
    if (!editingMessageId) return;
    const nextContent = editingMessageDraft.trim();
    if (!nextContent) return toast.error("Message content cannot be empty");
    setIsMutatingMessageId(editingMessageId);
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
      queueConversationRefresh();
      toast.success("Message updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update message");
    } finally {
      setIsMutatingMessageId(null);
    }
  };

  const handleDeleteMessage = async (message: ConversationMessage) => {
    if (
      message.senderId !== profile?.userId ||
      message.isDeleted ||
      !isWithinMessageEditWindow(message.createdAt)
    )
      return;
    if (
      typeof window !== "undefined" &&
      !window.confirm("Delete this message for everyone?")
    )
      return;
    setIsMutatingMessageId(message.id);
    try {
      const deleted = await deleteMessageWithTransport(message.id);
      updateMessageById(message.id, (current) => ({ ...current, ...deleted }));
      if (editingMessageId === message.id) {
        setEditingMessageId(null);
        setEditingMessageDraft("");
      }
      queueConversationRefresh();
      toast.success("Message deleted");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete message");
    } finally {
      setIsMutatingMessageId(null);
    }
  };

  const handleCopyMessage = (message: ConversationMessage) => {
    if (!message.content || message.isDeleted) return;
    navigator.clipboard
      .writeText(message.content)
      .then(() => {
        setCopiedMessageId(message.id);
        setTimeout(() => setCopiedMessageId(null), 1600);
        toast.success("Message copied");
      })
      .catch(() => toast.error("Failed to copy"));
  };

  const handleSendMessage = async () => {
    if (!selectedConversation || !newMessage.trim()) return;
    if (selectedConversationNeedsMyApproval)
      return toast.error("Accept this message request before sending a reply.");

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
    try {
      const confirmedMessage = await sendMessageWithTransport(
        selectedConversation.id,
        content,
      );
      removeMessageById(optimisticMessageId);
      if (confirmedMessage.conversationId === selectedConversation.id)
        appendMessage(confirmedMessage);
      queueConversationRefresh();
    } catch (e) {
      updateMessageById(optimisticMessageId, (message) => ({
        ...message,
        messageStatus: "FAILED",
      }));
      toast.error(e instanceof Error ? e.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  /**
   * Send an image message. Flow:
   * 1. Immediately show an optimistic bubble with a local blob preview
   * 2. Upload the file to S3 via presigned POST
   * 3. Send the IMAGE message record to the server (socket or HTTP fallback)
   * 4. Swap in the confirmed message; revoke the blob URL
   * 5. On any failure: mark the optimistic message as FAILED
   */
  const handleSendImageMessage = async (file: File, caption?: string) => {
    if (!selectedConversation || isUploadingImage) return;

    setNewMessage("");
    
    const optimisticId = `temp-img-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    // Create a local preview URL so the user sees the image immediately
    const localPreviewUrl = URL.createObjectURL(file);

    const optimisticMessage = {
      id: optimisticId,
      conversationId: selectedConversation.id,
      conversationType: selectedConversation.conversationType,
      senderId: profile?.userId || "me",
      senderDisplayName: "You",
      content: "", // real key arrives after upload
      type: "IMAGE" as const,
      metadata: caption ? { caption } : undefined,
      localPreviewUrl,
      createdAt: new Date().toISOString(),
      messageStatus: "SENDING" as const,
      readBy: profile?.userId ? [profile.userId] : [],
      participantIds: [
        profile?.userId || "me",
        selectedConversation.otherParticipant.id,
      ],
    };

    appendMessage(optimisticMessage);
    setIsUploadingImage(true);

    try {
      const { s3Key, width, height } = await uploadChatImage(
        file,
        selectedConversation.id,
      );

      const socket = getCommunitySocket();
      let confirmedMessage;
      if (socket.connected) {
        const ack = await new Promise<
          | { success: true; data: import("@/modules/community/types").ConversationMessage }
          | { success: false; message?: string }
        >((resolve) => {
          const timeoutId = setTimeout(
            () => resolve({ success: false, message: "Image send timed out" }),
            12000,
          );
          socket.emit(
            "community:sendMessage",
            {
              conversationId: selectedConversation.id,
              content: s3Key,
              type: "IMAGE",
              metadata: { width, height, caption },
            },
            (result: unknown) => {
              clearTimeout(timeoutId);
              resolve(
                (result as any) || {
                  success: false,
                  message: "Invalid server response",
                },
              );
            },
          );
        });
        if (!ack.success) throw new Error(ack.message || "Failed to send image");
        confirmedMessage = { ...ack.data, messageStatus: "SENT" as const };
      } else {
        const sent = await communityService.sendImageMessage(
          selectedConversation.id,
          s3Key,
          { width, height, caption },
        );
        confirmedMessage = { ...sent, messageStatus: "SENT" as const };
      }

      // Swap out optimistic for confirmed; revoke the temporary blob URL
      removeMessageById(optimisticId);
      URL.revokeObjectURL(localPreviewUrl);
      if (confirmedMessage.conversationId === selectedConversation.id) {
        appendMessage(confirmedMessage);
      }

      queueConversationRefresh();
    } catch (e) {
      updateMessageById(optimisticId, (msg) => ({
        ...msg,
        messageStatus: "FAILED" as const,
      }));
      toast.error(
        e instanceof Error ? e.message : "Failed to send image",
      );
    } finally {
      setIsUploadingImage(false);
    }
  };

  return {
    prefersReducedMotion,
    router,
    mainAppUrl,
    isLoading,
    isCommunityView,
    isConversationsView,
    activeSidebarTab,
    setActiveSidebarTab,
    workspaceView,
    setWorkspaceView,
    directoryView,
    setDirectoryView,
    sidebarMode,
    setSidebarMode,
    conversationMode,
    setConversationMode,
    groupMode,
    setGroupMode,
    groupToolsMode,
    setGroupToolsMode,
    conversationFilterQuery,
    setConversationFilterQuery,
    profile,
    conversations: safeConversations,
    selectedConversationId,
    setSelectedConversationId,
    messages,
    playerSearchQuery,
    setPlayerSearchQuery,
    playerSearchResults,
    isSearchingPlayers,
    groupSearchQuery,
    setGroupSearchQuery,
    groupResults: safeGroupResults,
    followedGroupIds,
    setFollowedGroupIds,
    isSearchingGroups,
    newGroupName,
    setNewGroupName,
    newGroupDescription,
    setNewGroupDescription,
    newGroupSport,
    setNewGroupSport,
    newGroupCity,
    setNewGroupCity,
    newGroupAudience,
    setNewGroupAudience,
    isCreateGroupOpen,
    setIsCreateGroupOpen,
    isCreatingGroup,
    inviteGroupId,
    setInviteGroupId,
    inviteSearchQuery,
    setInviteSearchQuery,
    inviteSearchResults,
    isSearchingInvitePlayers,
    isAddingMemberUserId,
    isUpdatingGroupPolicyId,
    isLeavingGroupId,
    reportModal,
    setReportModal,
    isSubmittingReport,
    newMessage,
    setNewMessage,
    isSending,
    editingMessageId,
    editingMessageDraft,
    setEditingMessageDraft,
    isMutatingMessageId,
    copiedMessageId,
    mobileActionMessageId,
    setMobileActionMessageId,
    mobileActionMessage,
    isTogglingBlockUser,
    isSocketConnected,
    isUploadingImage,
    isConversationSidebarOpen,
    setIsConversationSidebarOpen,
    showGroupMembersPanel,
    setShowGroupMembersPanel,
    isMemberProfileOpen,
    isLoadingMemberProfile,
    memberProfileError,
    selectedMemberProfile,
    messagesEndRef,
    scrollContainerRef,
    hasMoreMessages,
    isLoadingMoreMessages,
    loadMoreMessages,
    selectedConversation,
    typingUsers,
    totalUnread,
    pendingRequestsCount,
    selectedConversationIsPending,
    selectedConversationNeedsMyApproval,
    selectedConversationIsBlocked,
    canSendSelectedConversationMessage,
    showGroupInsightsSidebar,
    selectedConversationDisplayName,
    selectedConversationPhotoUrl,
    selectedConversationAvatarChar,
    activeMobileDockTab,
    groupsJoinedCount,
    managedConversations,
    hasConversationFilters,
    hasMoreConversations,
    isLoadingMoreConversations,
    conversationModeOptions,
    toolsSteps,
    toolVisibleGroups,
    featuredGroups,
    getFeaturedGroupActionLabel,
    getGroupConversationByGroupId,
    handleFeaturedGroupAction,
    handleStartConversation,
    handleCreateGroup,
    handleJoinGroup,
    handleLeaveGroup,
    isDeletingGroupId,
    handleDeleteGroup,
    handleOpenReportModal,
    handleSubmitReportWrapper,
    handleAddMemberToGroup,
    handleUpdateGroupMemberAddPolicy,
    handleAcceptRequest,
    handleRejectRequest,
    handleToggleConversationBlock,
    handleOpenConversation,
    handleCloseMemberProfile,
    handleOpenMemberProfile,
    handleMemberClick,
    handleMessageSelectedMember,
    handleLoadMoreConversations,
    retryFailedMessage,
    handleBeginEditMessage,
    handleCancelEditMessage,
    handleSaveEditedMessage,
    handleDeleteMessage,
    handleCopyMessage,
    handleSendMessage,
    handleSendImageMessage,
    pendingImageFile,
    setPendingImageFile,
    imageInputRef,
  };
}

export type CommunityPageViewModel = ReturnType<typeof useCommunityPage>;
