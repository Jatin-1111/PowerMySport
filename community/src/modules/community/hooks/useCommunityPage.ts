"use client";

import { getMainAppUrl, redirectToMainLogin } from "@/lib/auth/redirect";
import { isCommunityEligibleRole } from "@/lib/auth/roles";
import { toast } from "@/lib/toast";
import { communityService } from "@/modules/community/services/community";
import { communityFollowStore } from "@/modules/community/lib/followStore";
import {
  CommunityUserSearchResult,
  CommunityGroupSummary,
  CommunityProfile,
  ConversationListResponse,
  ConversationItem,
  ConversationMessage,
} from "@/modules/community/types";
import { getAvatarCharacter } from "@/modules/community/utils/chatUtils";
import {
  COMMUNITY_ACTIVE_TAB_KEY,
  COMMUNITY_WORKSPACE_VIEW_KEY,
  COMMUNITY_DIRECTORY_VIEW_KEY,
  COMMUNITY_SELECTED_CONVERSATION_KEY,
  COMMUNITY_SIDEBAR_MODE_KEY,
  CONVERSATION_PAGE_SIZE,
  isValidDirectoryView,
  isValidGroupToolsMode,
  isValidSidebarTab,
  isValidWorkspaceView,
  resolveSidebarQueryState,
} from "@/modules/community/constants/communityPage";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useReportModal } from "@/modules/community/hooks/useReportModal";
import { useBlockedUsers } from "@/modules/community/hooks/useBlockedUsers";
import { useMemberProfile } from "@/modules/community/hooks/useMemberProfile";
import { useChatEnhancements } from "@/modules/community/hooks/useChatEnhancements";
import { useCommunityMessaging } from "@/modules/community/hooks/useCommunityMessaging";

export function useCommunityPage(options?: { forceView?: "community-overview" | "conversations" }) {
  const prefersReducedMotion = useReducedMotion();
  const router = useRouter();
  const pathname = usePathname();
  const urlSearchParams = useSearchParams();
  // const [searchQuery, setSearchQuery] = useState("");
  const lastAppliedQueryRef = useRef("");
  const hasHydratedUrlRef = useRef(false);

  const [activeSidebarTab, setActiveSidebarTab] = useState<"community-overview" | "conversations">(
    () => {
      if (typeof window === "undefined") return "community-overview";
      const stored = window.localStorage.getItem(COMMUNITY_ACTIVE_TAB_KEY);
      return isValidSidebarTab(stored) ? stored : "community-overview";
    }
  );
  const [workspaceView, setWorkspaceView] = useState<"CHAT" | "DIRECTORY" | "PRIVACY">(() => {
    if (typeof window === "undefined") return "CHAT";
    const stored = window.localStorage.getItem(COMMUNITY_WORKSPACE_VIEW_KEY);
    return isValidWorkspaceView(stored) ? stored : "CHAT";
  });
  const [directoryView, setDirectoryView] = useState<"CONTACTS" | "GROUPS">(() => {
    if (typeof window === "undefined") return "CONTACTS";
    const stored = window.localStorage.getItem(COMMUNITY_DIRECTORY_VIEW_KEY);
    return isValidDirectoryView(stored)
      ? stored === "GROUPS"
        ? "GROUPS"
        : "CONTACTS"
      : "CONTACTS";
  });
  const [sidebarMode, setSidebarMode] = useState<"INBOX" | "TOOLS">(() => {
    if (typeof window === "undefined") return "INBOX";
    return window.localStorage.getItem(COMMUNITY_SIDEBAR_MODE_KEY) === "TOOLS" ? "TOOLS" : "INBOX";
  });

  const [conversationMode, setConversationMode] = useState<"ALL" | "UNREAD" | "REQUESTS">("ALL");
  const [groupMode, setGroupMode] = useState<"ALL" | "JOINED" | "DISCOVER">("ALL");
  const [groupToolsMode, setGroupToolsMode] = useState<"DISCOVER" | "MANAGE" | "INVITE">(
    "DISCOVER"
  );
  const [conversationFilterQuery, setConversationFilterQuery] = useState("");

  const [profile, setProfile] = useState<CommunityProfile | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [conversationPage, setConversationPage] = useState(1);
  const [hasMoreConversations, setHasMoreConversations] = useState(false);
  const [isLoadingMoreConversations, setIsLoadingMoreConversations] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");
  const [playerSearchResults, setPlayerSearchResults] = useState<CommunityUserSearchResult[]>([]);
  const [isSearchingPlayers, setIsSearchingPlayers] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [groupResults, setGroupResults] = useState<CommunityGroupSummary[]>([]);
  const [followedGroupIds, setFollowedGroupIds] = useState<string[]>([]);
  const [isSearchingGroups, setIsSearchingGroups] = useState(false);

  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupDescription, setNewGroupDescription] = useState("");
  const [newGroupSport, setNewGroupSport] = useState("");
  const [newGroupCity, setNewGroupCity] = useState("");
  const [newGroupAudience, setNewGroupAudience] = useState<"ALL">("ALL");
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  const [inviteGroupId, setInviteGroupId] = useState<string | null>(null);
  const [inviteSearchQuery, setInviteSearchQuery] = useState("");
  const [inviteSearchResults, setInviteSearchResults] = useState<CommunityUserSearchResult[]>([]);
  const [isSearchingInvitePlayers, setIsSearchingInvitePlayers] = useState(false);
  const [isAddingMemberUserId, setIsAddingMemberUserId] = useState<string | null>(null);
  const [isUpdatingGroupPolicyId, setIsUpdatingGroupPolicyId] = useState<string | null>(null);
  const [isLeavingGroupId, setIsLeavingGroupId] = useState<string | null>(null);
  const [isDeletingGroupId, setIsDeletingGroupId] = useState<string | null>(null);

  const {
    reportModal,
    setReportModal,
    isSubmittingReport,
    handleOpenReportModal,
    handleSubmitReportWrapper,
  } = useReportModal();

  const [isLoading, setIsLoading] = useState(true);
  const [isTogglingBlockUser, setIsTogglingBlockUser] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [isConversationSidebarOpen, setIsConversationSidebarOpen] = useState(true);
  const [showGroupMembersPanel, setShowGroupMembersPanel] = useState(false);

  const [showChatDetailsSidebar, setShowChatDetailsSidebar] = useState(false);

  const [showAddChatModal, setShowAddChatModal] = useState(false);

  const {
    blockedUsersList,
    isLoadingBlockedUsers,
    showBlockedUsersModal,
    setShowBlockedUsersModal,
    handleUnblockUserById,
  } = useBlockedUsers(setProfile);

  /**
   * Pins a message for the whole group. This used to write to localStorage, so
   * a "pinned" message was visible only to the person who pinned it — the
   * opposite of what a pin is for. Admin-only, enforced server-side.
   */
  const pinGroupMessage = async (messageId: string) => {
    try {
      const result = await communityService.pinGroupMessage(messageId);
      setSelectedConversationPinnedId(result.pinnedMessageId);
      queueConversationRefresh();
      toast.success(result.pinned ? "Message pinned" : "Message unpinned");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to pin message");
    }
  };

  const selectedConversationIdRef = useRef<string | null>(null);
  const [selectedConversationPinnedId, setSelectedConversationPinnedId] = useState<string | null>(
    null
  );
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isRefreshingConversationsRef = useRef(false);
  const shouldRefreshConversationsRef = useRef(false);

  const safeConversations = useMemo(
    () => (Array.isArray(conversations) ? conversations : []),
    [conversations]
  );
  const safeConversationsRef = useRef(safeConversations);
  useEffect(() => {
    safeConversationsRef.current = safeConversations;
  }, [safeConversations]);
  const safeGroupResults = useMemo(
    () => (Array.isArray(groupResults) ? groupResults : []),
    [groupResults]
  );

  const getConversationById = useCallback(
    (conversationId: string | null) => {
      if (!conversationId) return null;
      return safeConversations.find((c) => c.id === conversationId) || null;
    },
    [safeConversations]
  );

  const getGroupConversationByGroupId = useCallback(
    (groupId: string) => {
      return safeConversations.find((c) => c.group?.id === groupId) || null;
    },
    [safeConversations]
  );

  const selectedConversation = useMemo(
    () => getConversationById(selectedConversationId),
    [getConversationById, selectedConversationId]
  );

  const {
    pinnedConversationIds,
    mutedConversationIds,
    mutedConversationIdsRef,
    conversationSearchQuery,
    setConversationSearchQuery,
    showEmojiPicker,
    setShowEmojiPicker,
    selectChatsMode,
    setSelectChatsMode,
    selectedChatIds,
    toggleChatSelection,
    clearChatSelection,
    handleTogglePinConversation,
    handleToggleMuteConversation,
    handleMarkAllAsRead,
    handleMarkConversationAsUnread,
    handleClearChat,
    handleDeleteChat,
  } = useChatEnhancements(
    selectedConversationId,
    selectedConversation,
    setSelectedConversationId,
    setMessages,
    setConversations
  );

  const totalUnread = useMemo(
    () => safeConversations.reduce((sum, item) => sum + (item.unreadCount || 0), 0),
    [safeConversations]
  );
  const pendingRequestsCount = useMemo(
    () =>
      safeConversations.filter((c) => c.status === "PENDING" && c.conversationType !== "GROUP")
        .length,
    [safeConversations]
  );

  const mainAppUrl = useMemo(() => getMainAppUrl(), []);
  const selectedConversationIsPending =
    selectedConversation?.status === "PENDING" &&
    selectedConversation?.conversationType !== "GROUP";
  const selectedConversationIsBlocked =
    selectedConversation?.conversationType !== "GROUP" &&
    !!selectedConversation?.otherParticipant?.id &&
    (profile?.blockedUsers || []).includes(selectedConversation.otherParticipant.id);
  const selectedConversationRequestedByMe = selectedConversation?.requestedBy === profile?.userId;
  const selectedConversationNeedsMyApproval =
    selectedConversationIsPending && !selectedConversationRequestedByMe;
  const canSendSelectedConversationMessage =
    Boolean(selectedConversation) &&
    !selectedConversationNeedsMyApproval &&
    !selectedConversationIsBlocked &&
    // Announcement groups: read for everyone, post for admins. The server
    // enforces this too — the flag exists so the composer can be disabled
    // rather than accepting text that is then rejected.
    selectedConversation?.group?.canPost !== false;

  const activeSidebarTabToUse = options?.forceView || activeSidebarTab;
  const isCommunityView = activeSidebarTabToUse === "community-overview";
  const isConversationsView = activeSidebarTabToUse === "conversations";
  const showGroupInsightsSidebar =
    isConversationsView &&
    showGroupMembersPanel &&
    selectedConversation?.conversationType === "GROUP";
  const selectedConversationDisplayName = selectedConversation
    ? selectedConversation.conversationType === "GROUP"
      ? selectedConversation.group?.name || selectedConversation.otherParticipant.displayName
      : selectedConversation.otherParticipant.displayName
    : "No conversation selected";
  const selectedConversationPhotoUrl =
    selectedConversation?.conversationType === "GROUP"
      ? null
      : (selectedConversation?.otherParticipant?.photoUrl ?? null);
  const selectedConversationAvatarChar = getAvatarCharacter(selectedConversationDisplayName);
  const activeMobileDockTab: "CHAT" | "LIST" | "TOOLS" =
    sidebarMode === "TOOLS" ? "TOOLS" : workspaceView === "CHAT" ? "CHAT" : "LIST";
  const groupsJoinedCount = useMemo(
    () => safeGroupResults.filter((g) => g.isMember).length,
    [safeGroupResults]
  );
  const contactConversations = useMemo(
    () => safeConversations.filter((c) => c.conversationType !== "GROUP"),
    [safeConversations]
  );
  const groupConversations = useMemo(
    () => safeConversations.filter((c) => c.conversationType === "GROUP"),
    [safeConversations]
  );
  const visibleConversations = useMemo(() => {
    const source = directoryView === "GROUPS" ? groupConversations : contactConversations;
    // Apply both the old filter query and the new search query
    const oldQuery = conversationFilterQuery.trim().toLowerCase();
    const searchQuery = conversationSearchQuery.trim().toLowerCase();
    const query = searchQuery || oldQuery;
    if (!query) return source;
    return source.filter((c) => {
      const displayName = c.otherParticipant.displayName?.toLowerCase() || "";
      const groupName = c.group?.name?.toLowerCase() || "";
      const latestMessage = c.latestMessage?.content?.toLowerCase() || "";
      return (
        displayName.includes(query) || groupName.includes(query) || latestMessage.includes(query)
      );
    });
  }, [
    directoryView,
    contactConversations,
    groupConversations,
    conversationFilterQuery,
    conversationSearchQuery,
  ]);

  const managedConversations = useMemo(() => {
    const byMode =
      conversationMode === "UNREAD"
        ? visibleConversations.filter((c) => c.unreadCount > 0)
        : conversationMode === "REQUESTS"
          ? visibleConversations.filter(
              (c) => c.status === "PENDING" && c.conversationType !== "GROUP"
            )
          : visibleConversations;

    return [...byMode].sort((a, b) => {
      // Pinned conversations always come first
      const aPinned = pinnedConversationIds.includes(a.id);
      const bPinned = pinnedConversationIds.includes(b.id);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      if (a.status === "PENDING" && b.status !== "PENDING") return -1;
      if (a.status !== "PENDING" && b.status === "PENDING") return 1;
      if ((a.unreadCount || 0) !== (b.unreadCount || 0))
        return (b.unreadCount || 0) - (a.unreadCount || 0);
      const aTime = a.latestMessage?.createdAt ? new Date(a.latestMessage.createdAt).getTime() : 0;
      const bTime = b.latestMessage?.createdAt ? new Date(b.latestMessage.createdAt).getTime() : 0;
      return bTime - aTime;
    });
  }, [visibleConversations, conversationMode, pinnedConversationIds]);

  const hasConversationFilters = conversationMode !== "ALL" || !!conversationFilterQuery.trim();
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
    if (groupMode === "JOINED") return safeGroupResults.filter((g) => g.isMember);
    if (groupMode === "DISCOVER") return safeGroupResults.filter((g) => !g.isMember);
    return safeGroupResults;
  }, [safeGroupResults, groupMode]);

  const toolVisibleGroups = useMemo(
    () => visibleGroups.filter((g) => (groupToolsMode === "DISCOVER" ? !g.isMember : !!g.isMember)),
    [visibleGroups, groupToolsMode]
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
      options?: { append?: boolean; preserveSelection?: boolean }
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
        const processedItems = safeItems.map((c) =>
          c.id === selectedConversationIdRef.current && c.unreadCount !== 0
            ? { ...c, unreadCount: 0 }
            : c
        );
        if (!append) return processedItems;
        const existingIds = new Set(safeCurrent.map((c) => c.id));
        const nextItems = processedItems.filter((c) => !existingIds.has(c.id));
        return [...safeCurrent, ...nextItems];
      });

      setConversationPage(safePagination.page);
      setHasMoreConversations(safePagination.hasMore);

      if (!append) {
        setSelectedConversationId((current) => {
          if (!safeItems.length) return null;
          if (preserveSelection && current && safeItems.some((c) => c.id === current))
            return current;
          return null;
        });
      }
    },
    []
  );

  const refreshConversationsNow = useCallback(async () => {
    if (isRefreshingConversationsRef.current) {
      shouldRefreshConversationsRef.current = true;
      return;
    }
    isRefreshingConversationsRef.current = true;
    try {
      const updated = await communityService.listConversations(1, CONVERSATION_PAGE_SIZE);
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
    [refreshConversationsNow]
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
        toast.error("Community chat is unavailable for this account");
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
      const message = e instanceof Error ? e.message : "Failed to load community";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [applyConversationPage]);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);
  useEffect(() => {
    let cancelled = false;
    void communityFollowStore.getIdsByKind("GROUP").then((ids) => {
      if (!cancelled) {
        setFollowedGroupIds(ids);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

    if (hasHydratedUrlRef.current && currentQuery === lastAppliedQueryRef.current) {
      return;
    }

    const queryParams = new URLSearchParams(currentQuery);
    const sidebarState = resolveSidebarQueryState(queryParams.get("sidebar"));
    const urlDirectoryView = queryParams.get("directory")?.toUpperCase() || null;
    const urlGroupToolsMode = queryParams.get("panel")?.toUpperCase() || null;
    const urlConversationId = queryParams.get("conversation") || null;
    const urlQuery = queryParams.get("q") || null;

    if (sidebarState.mode)
      setSidebarMode((c) => (c === sidebarState.mode ? c : sidebarState.mode!));
    if (sidebarState.tab)
      setActiveSidebarTab((c) => (c === sidebarState.tab ? c : sidebarState.tab!));
    if (isValidDirectoryView(urlDirectoryView))
      setDirectoryView((c) => (c === urlDirectoryView ? c : urlDirectoryView));
    if (isValidGroupToolsMode(urlGroupToolsMode))
      setGroupToolsMode((c) => (c === urlGroupToolsMode ? c : urlGroupToolsMode));
    if (typeof urlConversationId === "string" && urlConversationId.trim()) {
      setSelectedConversationId((c) => (c === urlConversationId ? c : urlConversationId));
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
    if (selectedConversationId) params.set("conversation", selectedConversationId);
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
    if (activeSidebarTab !== "conversations") setActiveSidebarTab("conversations");
    if (workspaceView !== "DIRECTORY") setWorkspaceView("DIRECTORY");
    if (!isConversationSidebarOpen) setIsConversationSidebarOpen(true);
  }, [sidebarMode, activeSidebarTab, workspaceView, isConversationSidebarOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobileViewport = window.matchMedia("(max-width: 1279px)").matches;
    if (!isMobileViewport || !isConversationsView || selectedConversationId) return;
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
      window.localStorage.setItem(COMMUNITY_SELECTED_CONVERSATION_KEY, selectedConversationId);
    else window.localStorage.removeItem(COMMUNITY_SELECTED_CONVERSATION_KEY);
  }, [selectedConversationId]);

  useEffect(() => {
    if (selectedConversation?.conversationType !== "GROUP") setShowGroupMembersPanel(false);
  }, [selectedConversation?.conversationType]);

  useEffect(() => {
    if (selectedConversation) {
      const isGroup = selectedConversation.conversationType === "GROUP";
      setDirectoryView(isGroup ? "GROUPS" : "CONTACTS");
    }
  }, [selectedConversation?.id, selectedConversation?.conversationType]);

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
        const groups = await communityService.listGroups(groupSearchQuery.trim());
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

  const {
    loadMessages,
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
    isSocketConnected,
    isUploadingImage,
    typingUsers,
    messagesEndRef,
    scrollContainerRef,
    hasMoreMessages,
    isLoadingMoreMessages,
    loadMoreMessages,
    retryFailedMessage,
    handleBeginEditMessage,
    handleCancelEditMessage,
    handleSaveEditedMessage,
    handleDeleteMessage,
    handleCopyMessage,
    handleSendMessage,
    handleReactToMessage,
    handleSendAttachment,
    isRecording,
    toggleVoiceRecording,
    replyingTo,
    setReplyingTo,
    handleSendImageMessage,
    pendingImageFile,
    setPendingImageFile,
    imageInputRef,
    forwardingMessages,
    setForwardingMessages,
    handleForwardMessages,
    messageToDelete,
    setMessageToDelete,
    confirmDeleteMessage,
  } = useCommunityMessaging({
    selectedConversationId,
    selectedConversation,
    selectedConversationIdRef,
    safeConversationsRef,
    mutedConversationIdsRef,
    profile,
    messages,
    setMessages,
    setError,
    setConversations,
    applyConversationPage,
    refreshConversationsNow,
    queueConversationRefresh,
  });

  const handleStartConversation = useCallback(
    async (targetUserId: string) => {
      if (!targetUserId.trim()) return;
      setError(null);
      try {
        const conversation = await communityService.startConversation(targetUserId.trim());
        setPlayerSearchQuery("");
        setPlayerSearchResults([]);
        const updated = await communityService.listConversations(1, CONVERSATION_PAGE_SIZE);
        applyConversationPage(updated, { preserveSelection: true });
        setSelectedConversationId(conversation.id);
        setActiveSidebarTab("conversations");
        setWorkspaceView("CHAT");
        toast.success(
          conversation.status === "PENDING" ? "Message request sent" : "Conversation started"
        );
      } catch (e) {
        const message = e instanceof Error ? e.message : "Failed to start conversation";
        setError(message);
        toast.error(message);
      }
    },
    [applyConversationPage]
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
    [applyConversationPage, groupSearchQuery]
  );

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      toast.error("Group name is required");
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

  const handleAddMemberToGroup = async (groupId: string, targetUserId: string) => {
    try {
      setIsAddingMemberUserId(targetUserId);
      const response = await communityService.addGroupMember(groupId, targetUserId);
      await refreshGroupDirectoryState({ refreshConversations: false });
      setInviteSearchQuery("");
      setInviteSearchResults([]);
      toast.success(
        response.alreadyMember ? "User is already in this group" : "Member added to group"
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add member");
    } finally {
      setIsAddingMemberUserId(null);
    }
  };

  const handleUpdateGroupMemberAddPolicy = async (
    groupId: string,
    memberAddPolicy: "ADMIN_ONLY" | "ANY_MEMBER"
  ) => {
    try {
      setIsUpdatingGroupPolicyId(groupId);
      await communityService.updateGroupSettings(groupId, { memberAddPolicy });
      await refreshGroupDirectoryState({ refreshConversations: false });
      toast.success("Group settings updated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update group settings");
    } finally {
      setIsUpdatingGroupPolicyId(null);
    }
  };

  const getFeaturedGroupActionLabel = (group: CommunityGroupSummary) => {
    if (!group.isMember) return "Join";
    return getGroupConversationByGroupId(group.id) ? "Open chat" : "View groups";
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
      const updated = await communityService.listConversations(1, CONVERSATION_PAGE_SIZE);
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
      const updated = await communityService.listConversations(1, CONVERSATION_PAGE_SIZE);
      applyConversationPage(updated, { preserveSelection: true });
      setSelectedConversationId(updated.items.length ? updated.items[0].id : null);
      toast.success("Message request rejected");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to reject request");
    }
  };

  const handleToggleConversationBlock = async () => {
    const targetUserId = selectedConversation?.otherParticipant?.id;
    if (!targetUserId) return;
    const currentlyBlocked = (profile?.blockedUsers || []).includes(targetUserId);
    const actionLabel = currentlyBlocked ? "unblock" : "block";

    setIsTogglingBlockUser(true);
    try {
      if (currentlyBlocked) {
        await communityService.unblockUser(targetUserId);
        setProfile((current) =>
          current
            ? {
                ...current,
                blockedUsers: (current.blockedUsers || []).filter((id) => id !== targetUserId),
              }
            : current
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
            : current
        );
        toast.success("User blocked");
      }
      const updatedConversations = await communityService.listConversations(
        1,
        CONVERSATION_PAGE_SIZE
      );
      applyConversationPage(updatedConversations, { preserveSelection: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Failed to ${actionLabel} user`);
    } finally {
      setIsTogglingBlockUser(false);
    }
  };

  const {
    isMemberProfileOpen,
    isLoadingMemberProfile,
    memberProfileError,
    selectedMemberProfile,
    resetMemberProfile,
    handleCloseMemberProfile,
    handleOpenMemberProfile,
    handleMemberClick,
    handleMessageSelectedMember,
  } = useMemberProfile(router, handleStartConversation, setShowChatDetailsSidebar);

  const handleOpenConversation = useCallback(
    (conversationId: string) => {
      setSelectedConversationId(conversationId);
      setActiveSidebarTab("conversations");
      setWorkspaceView("CHAT");
      setSidebarMode("INBOX");
      setShowChatDetailsSidebar(false);
      resetMemberProfile();
    },
    [resetMemberProfile]
  );

  const handleLoadMoreConversations = async () => {
    if (isLoadingMoreConversations || !hasMoreConversations) return;
    setIsLoadingMoreConversations(true);
    try {
      const next = await communityService.listConversations(
        conversationPage + 1,
        CONVERSATION_PAGE_SIZE
      );
      applyConversationPage(next, { append: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load more conversations");
    } finally {
      setIsLoadingMoreConversations(false);
    }
  };

  const showDetailsSidebar =
    isConversationsView && showChatDetailsSidebar && !!selectedConversation;

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
    blockedUsersList,
    isLoadingBlockedUsers,
    handleUnblockUserById,
    pinGroupMessage,
    selectedConversationPinnedId,
    setSelectedConversationPinnedId,
    selectChatsMode,
    setSelectChatsMode,
    selectedChatIds,
    toggleChatSelection,
    clearChatSelection,
    showBlockedUsersModal,
    setShowBlockedUsersModal,
    showAddChatModal,
    setShowAddChatModal,
    forwardingMessages,
    setForwardingMessages,
    handleForwardMessages,
    messageToDelete,
    setMessageToDelete,
    confirmDeleteMessage,
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
    handleReactToMessage,
    handleSendAttachment,
    isRecording,
    toggleVoiceRecording,
    replyingTo,
    setReplyingTo,
    handleSendImageMessage,
    pendingImageFile,
    setPendingImageFile,
    imageInputRef,
    // Chat Enhancement State
    pinnedConversationIds,
    mutedConversationIds,
    conversationSearchQuery,
    setConversationSearchQuery,
    handleMarkAllAsRead,
    handleMarkConversationAsUnread,
    showChatDetailsSidebar,
    setShowChatDetailsSidebar,
    showDetailsSidebar,
    showEmojiPicker,
    setShowEmojiPicker,
    handleTogglePinConversation,
    handleToggleMuteConversation,
    handleClearChat,
    handleDeleteChat,
  };
}

export type CommunityPageViewModel = ReturnType<typeof useCommunityPage>;
