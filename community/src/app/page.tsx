"use client";

import { getCommunitySocket } from "@/lib/realtime/socket";
import { getMainAppUrl, redirectToMainLogin } from "@/lib/auth/redirect";
import { toast } from "@/lib/toast";
import { CommunityPageHeader } from "@/modules/community/components/CommunityPageHeader";
import { FeaturedCommunitiesStrip } from "@/modules/community/components/FeaturedCommunitiesStrip";
import { communityService } from "@/modules/community/services/community";
import {
  CommunityGroupSummary,
  CommunityProfile,
  ConversationListResponse,
  ConversationItem,
  ConversationMessage,
  MessagePrivacy,
  PlayerSearchResult,
} from "@/modules/community/types";
import {
  Activity,
  ChevronLeft,
  Clock3,
  ExternalLink,
  MessageSquare,
  Search,
  Shield,
  UserCircle2,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const privacyOptions: Array<{ value: MessagePrivacy; label: string }> = [
  { value: "EVERYONE", label: "Everyone" },
  { value: "REQUEST_ONLY", label: "Request only" },
  { value: "NONE", label: "Nobody" },
];

const shellNavItems = [
  { id: "community-overview", label: "Community", icon: Users },
  { id: "conversations", label: "Conversations", icon: MessageSquare },
  { id: "privacy-settings", label: "Privacy", icon: Shield },
] as const;

const COMMUNITY_ACTIVE_TAB_KEY = "community:activeSidebarTab";
const COMMUNITY_WORKSPACE_VIEW_KEY = "community:workspaceView";
const COMMUNITY_DIRECTORY_VIEW_KEY = "community:directoryView";
const COMMUNITY_SELECTED_CONVERSATION_KEY = "community:selectedConversationId";
const CONVERSATION_PAGE_SIZE = 25;

const isValidSidebarTab = (
  value: string | null,
): value is "community-overview" | "conversations" | "privacy-settings" =>
  value === "community-overview" ||
  value === "conversations" ||
  value === "privacy-settings";

const isValidWorkspaceView = (
  value: string | null,
): value is "CHAT" | "DIRECTORY" | "PRIVACY" =>
  value === "CHAT" || value === "DIRECTORY" || value === "PRIVACY";

const isValidDirectoryView = (
  value: string | null,
): value is "ALL" | "CONTACTS" | "GROUPS" =>
  value === "ALL" || value === "CONTACTS" || value === "GROUPS";

export default function CommunityPage() {
  const [activeSidebarTab, setActiveSidebarTab] = useState<
    "community-overview" | "conversations" | "privacy-settings"
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
  const [conversationFilterQuery, setConversationFilterQuery] = useState("");
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
  const [aliasDraft, setAliasDraft] = useState("");
  const [playerSearchQuery, setPlayerSearchQuery] = useState("");
  const [playerSearchResults, setPlayerSearchResults] = useState<
    PlayerSearchResult[]
  >([]);
  const [isSearchingPlayers, setIsSearchingPlayers] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState("");
  const [groupResults, setGroupResults] = useState<CommunityGroupSummary[]>([]);
  const [isSearchingGroups, setIsSearchingGroups] = useState(false);
  const [directoryToolsView, setDirectoryToolsView] = useState<
    "NONE" | "CONTACTS" | "GROUPS"
  >("NONE");
  const [newGroupName, setNewGroupName] = useState("");
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(false);
  const [inviteGroupId, setInviteGroupId] = useState<string | null>(null);
  const [inviteSearchQuery, setInviteSearchQuery] = useState("");
  const [inviteSearchResults, setInviteSearchResults] = useState<
    PlayerSearchResult[]
  >([]);
  const [isSearchingInvitePlayers, setIsSearchingInvitePlayers] =
    useState(false);
  const [isAddingMemberUserId, setIsAddingMemberUserId] = useState<
    string | null
  >(null);
  const [isUpdatingGroupPolicyId, setIsUpdatingGroupPolicyId] = useState<
    string | null
  >(null);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isSavingAlias, setIsSavingAlias] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedConversationIdRef = useRef<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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
    () => safeConversations.reduce((sum, item) => sum + (item.unreadCount || 0), 0),
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
  const isCommunityView = activeSidebarTab === "community-overview";
  const isConversationsView = activeSidebarTab === "conversations";
  const isPrivacyView = activeSidebarTab === "privacy-settings";
  const workspaceHeading = isPrivacyView
    ? "Privacy Settings"
    : isConversationsView
      ? "Conversations"
      : "Community Dashboard";
  const workspaceSubtitle = isPrivacyView
    ? "Manage your identity visibility and messaging permissions."
    : isConversationsView
      ? "Manage contacts, groups, and active chats."
      : "Anonymous-first player networking and realtime chat.";
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
    conversationMode !== "ALL" ||
    !!conversationFilterQuery.trim();
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

    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  };

  const scrollToSection = (sectionId: string) => {
    if (
      sectionId === "community-overview" ||
      sectionId === "conversations" ||
      sectionId === "privacy-settings"
    ) {
      setActiveSidebarTab(sectionId);
      if (sectionId === "privacy-settings") {
        setWorkspaceView("PRIVACY");
      } else if (sectionId === "conversations") {
        setWorkspaceView("DIRECTORY");
      } else {
        setWorkspaceView("CHAT");
      }
    }

    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const loadBootstrap = useCallback(async () => {
    setError(null);
    setIsLoading(true);
    try {
      const session = await communityService.ensureSession();
      if (session.role !== "PLAYER") {
        toast.error("Community chat is available only for player accounts");
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
    if (!selectedConversationId) {
      setMessages([]);
      return;
    }

    loadMessages(selectedConversationId);
  }, [loadMessages, selectedConversationId]);

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
    if (directoryView === "GROUPS" && conversationMode === "REQUESTS") {
      setConversationMode("ALL");
    }

    if (directoryView !== "GROUPS") {
      setIsCreateGroupOpen(false);
      setInviteGroupId(null);
    }
  }, [conversationMode, directoryView]);

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
    setAliasDraft(profile?.anonymousAlias || "");
  }, [profile?.anonymousAlias]);

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
        const players = await communityService.searchPlayers(query);
        setPlayerSearchResults(players);
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Failed to search players";
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
        const players = await communityService.searchPlayers(query);
        setInviteSearchResults(players);
      } catch (e) {
        const message =
          e instanceof Error ? e.message : "Failed to search players";
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
      if (currentConversationId) {
        socket.emit("community:joinConversation", {
          conversationId: currentConversationId,
        });
      }
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
      socket.off("community:error", handleCommunityError);
      socket.off("connect_error", handleConnectError);

      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
    };
  }, [queueConversationRefresh]);

  useEffect(() => {
    if (!selectedConversationId) {
      return;
    }

    const socket = getCommunitySocket();
    if (socket.connected) {
      socket.emit("community:joinConversation", {
        conversationId: selectedConversationId,
      });
    }
  }, [selectedConversationId, isSocketConnected]);

  useEffect(() => {
    if (isSocketConnected || !selectedConversationId) {
      return;
    }

    const interval = setInterval(async () => {
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
        applyConversationPage(conversationResponse, { preserveSelection: true });
      } catch {
        // no-op: keep retrying while disconnected
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [
    applyConversationPage,
    isSocketConnected,
    refreshConversationsNow,
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

  const handleProfileUpdate = async (payload: {
    isIdentityPublic?: boolean;
    messagePrivacy?: MessagePrivacy;
    readReceiptsEnabled?: boolean;
    lastSeenVisible?: boolean;
    anonymousAlias?: string;
  }) => {
    if (!profile) {
      return;
    }

    const previous = profile;
    const optimistic = { ...previous, ...payload };
    setProfile(optimistic);
    try {
      const updated = await communityService.updateProfile(payload);
      setProfile(updated);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to update settings";
      setError(message);
      toast.error(message);
      setProfile(previous);
    }
  };

  const handleSaveAlias = async () => {
    const trimmed = aliasDraft.trim();
    if (!trimmed || trimmed === profile?.anonymousAlias) {
      return;
    }

    setIsSavingAlias(true);
    try {
      await handleProfileUpdate({ anonymousAlias: trimmed });
      toast.success("Alias updated");
    } finally {
      setIsSavingAlias(false);
    }
  };

  const handleStartConversation = async (targetUserId: string) => {
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
      setDirectoryToolsView("NONE");
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
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      return;
    }

    try {
      const created = await communityService.createGroup({
        name: newGroupName.trim(),
      });
      setNewGroupName("");
      const [updatedConversations, updatedGroups] = await Promise.all([
        communityService.listConversations(1, CONVERSATION_PAGE_SIZE),
        communityService.listGroups(groupSearchQuery.trim()),
      ]);
      applyConversationPage(updatedConversations, { preserveSelection: true });
      setGroupResults(updatedGroups);
      setDirectoryToolsView("NONE");
      setSelectedConversationId(created.conversationId);
      setIsCreateGroupOpen(false);
      setActiveSidebarTab("conversations");
      setWorkspaceView("CHAT");
      toast.success("Group created");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to create group";
      setError(message);
      toast.error(message);
    }
  };

  const handleJoinGroup = async (groupId: string) => {
    try {
      const joined = await communityService.joinGroup(groupId);
      const [updatedConversations, updatedGroups] = await Promise.all([
        communityService.listConversations(1, CONVERSATION_PAGE_SIZE),
        communityService.listGroups(groupSearchQuery.trim()),
      ]);
      applyConversationPage(updatedConversations, { preserveSelection: true });
      setGroupResults(updatedGroups);
      if (joined.conversationId) {
        setDirectoryToolsView("NONE");
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

  const handleAddMemberToGroup = async (groupId: string, targetUserId: string) => {
    try {
      setIsAddingMemberUserId(targetUserId);
      const response = await communityService.addGroupMember(groupId, targetUserId);

      const [updatedConversations, updatedGroups] = await Promise.all([
        communityService.listConversations(1, CONVERSATION_PAGE_SIZE),
        communityService.listGroups(groupSearchQuery.trim()),
      ]);
      applyConversationPage(updatedConversations, { preserveSelection: true });
      setGroupResults(updatedGroups);
      setInviteSearchQuery("");
      setInviteSearchResults([]);

      toast.success(
        response.alreadyMember
          ? "Player is already in this group"
          : "Member added to group",
      );
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to add member";
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

      const updatedGroups = await communityService.listGroups(
        groupSearchQuery.trim(),
      );
      setGroupResults(updatedGroups);
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
      setSelectedConversationId(updated.items.length ? updated.items[0].id : null);
      toast.success("Message request rejected");
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Failed to reject request";
      setError(message);
      toast.error(message);
    }
  };

  const handleOpenConversation = (conversationId: string) => {
    setDirectoryToolsView("NONE");
    setSelectedConversationId(conversationId);
    setActiveSidebarTab("conversations");
    setWorkspaceView("CHAT");
  };

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

  const sendMessageWithTransport = async (
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
  };

  const retryFailedMessage = async (message: ConversationMessage) => {
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
      applyConversationPage(updatedConversations, { preserveSelection: true });
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
  };

  const handleSendMessage = async () => {
    if (!selectedConversation || !newMessage.trim()) {
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
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(233,115,22,0.12),transparent_35%),linear-gradient(to_bottom,#f8fafc,#f1f5f9)] px-4 py-8 sm:px-6 lg:px-10">
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(233,115,22,0.12),transparent_35%),linear-gradient(to_bottom,#f8fafc,#f1f5f9)]">
      <div className="mx-auto grid min-h-screen w-full max-w-480 gap-6 px-3 py-4 sm:px-6 sm:py-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
        <aside className="hidden h-[calc(100vh-3rem)] rounded-3xl border border-border/70 bg-white/85 p-6 shadow-sm backdrop-blur lg:sticky lg:top-6 lg:block">
          <div className="rounded-2xl bg-linear-to-br from-slate-900 to-slate-800 p-5 text-white shadow-sm">
            <p className="text-[11px] uppercase tracking-[0.2em] text-slate-300">
              Community Hub
            </p>
            <h1 className="mt-2 text-2xl font-bold text-white">PowerMySport</h1>
            <p className="mt-1 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-sm text-slate-100">
              <UserCircle2 size={14} />
              {profile?.anonymousAlias}
            </p>
          </div>

          <nav className="mt-6 space-y-2">
            {shellNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => scrollToSection(item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                    activeSidebarTab === item.id
                      ? "border-power-orange/30 bg-power-orange/5 text-slate-900"
                      : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-sm font-semibold tracking-tight">
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="mt-6 rounded-2xl border border-border bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Live status
            </p>
            <p
              className={`mt-2 inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                isSocketConnected
                  ? "bg-turf-green/15 text-turf-green"
                  : "bg-amber-100 text-amber-700"
              }`}
            >
              {isSocketConnected ? "Realtime connected" : "Reconnecting"}
            </p>
            <p className="mt-3 text-sm text-slate-500">
              Keep this page open for instant updates.
            </p>
          </div>
        </aside>

        <main className="flex min-w-0 flex-col rounded-3xl border border-border/70 bg-white/80 shadow-sm backdrop-blur">
          <div className="sticky top-0 z-20 rounded-t-3xl border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                  {workspaceHeading}
                </h2>
                <p className="text-sm text-slate-500">{workspaceSubtitle}</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!isPrivacyView && (
                  <>
                    <div className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                      {safeConversations.length} conversation
                      {safeConversations.length === 1 ? "" : "s"}
                    </div>
                    <div className="rounded-full bg-power-orange/10 px-3 py-1 text-xs font-medium text-power-orange">
                      {totalUnread} unread
                    </div>
                    <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                      {pendingRequestsCount} requests
                    </div>
                  </>
                )}
                <div
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    isSocketConnected
                      ? "bg-turf-green/10 text-turf-green"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {isSocketConnected ? "Live" : "Offline mode"}
                </div>
              </div>
            </div>

            <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
              {shellNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold shadow-xs transition ${
                      activeSidebarTab === item.id
                        ? "border-power-orange/40 bg-power-orange/10 text-power-orange"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                    }`}
                  >
                    <Icon size={14} />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-6 p-4 sm:p-6 lg:p-8">
            {isCommunityView && (
              <>
                <section id="community-overview" className="mb-6 scroll-mt-28">
                  <CommunityPageHeader
                    title="PowerMySport Community"
                    subtitle="Anonymous-first player chat with your privacy controls."
                    badge="Player Network"
                    action={
                      <a
                        href={mainAppUrl}
                        className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
                      >
                        Switch to Player
                        <ExternalLink size={16} />
                      </a>
                    }
                  />
                </section>

                <FeaturedCommunitiesStrip
                  groups={featuredGroups}
                  getActionLabel={getFeaturedGroupActionLabel}
                  onGroupAction={(group) => {
                    void handleFeaturedGroupAction(group);
                  }}
                  onViewAll={() => {
                    setActiveSidebarTab("conversations");
                    setWorkspaceView("DIRECTORY");
                    setDirectoryView("GROUPS");
                  }}
                />

                <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-border/80 bg-white p-4 shadow-xs">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Conversations
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {safeConversations.length}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Active threads
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/80 bg-white p-4 shadow-xs">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Unread
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {totalUnread}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Messages waiting
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/80 bg-white p-4 shadow-xs">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Groups joined
                    </p>
                    <p className="mt-2 text-2xl font-bold text-slate-900">
                      {groupsJoinedCount}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Community circles
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/80 bg-white p-4 shadow-xs">
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
                  </div>
                </section>
              </>
            )}

            {isConversationsView && (
              <section className="xl:hidden">
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-border bg-white p-1">
                  {[
                    { id: "CHAT", label: "Chat" },
                    { id: "DIRECTORY", label: "Contacts" },
                  ].map((view) => (
                    <button
                      key={view.id}
                      onClick={() =>
                        setWorkspaceView(view.id as "CHAT" | "DIRECTORY")
                      }
                      className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                        workspaceView === view.id
                          ? "bg-power-orange text-white"
                          : "text-slate-600 hover:bg-slate-100"
                      }`}
                    >
                      {view.label}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {(isConversationsView || isPrivacyView) && (
              <div
                className={`grid grid-cols-1 gap-4 ${
                  isPrivacyView
                    ? "xl:grid-cols-1"
                    : "xl:grid-cols-[340px_minmax(0,1fr)]"
                }`}
              >
                <section
                  id="privacy-settings"
                  className={`scroll-mt-28 rounded-2xl border border-border/80 bg-white p-5 text-card-foreground shadow-xs ${
                    isPrivacyView ? "block" : "hidden"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Shield size={16} className="text-slate-600" />
                    <h2 className="text-base font-semibold tracking-tight">
                      Privacy Settings
                    </h2>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Control your identity visibility and message preferences.
                  </p>

                  <div className="mt-4 space-y-4">
                    <label className="block text-sm">
                      <span className="mb-1 block text-slate-500">
                        Anonymous alias
                      </span>
                      <div className="flex gap-2">
                        <input
                          value={aliasDraft}
                          onChange={(event) =>
                            setAliasDraft(event.target.value)
                          }
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-power-orange focus:outline-none"
                        />
                        <button
                          onClick={handleSaveAlias}
                          disabled={isSavingAlias || !aliasDraft.trim()}
                          className="rounded-lg bg-power-orange px-3 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                        >
                          {isSavingAlias ? "Saving" : "Save"}
                        </button>
                      </div>
                    </label>

                    <label className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">
                        Show my real identity
                      </span>
                      <input
                        type="checkbox"
                        checked={profile?.isIdentityPublic || false}
                        onChange={(event) =>
                          handleProfileUpdate({
                            isIdentityPublic: event.target.checked,
                          })
                        }
                      />
                    </label>

                    <label className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Read receipts</span>
                      <input
                        type="checkbox"
                        checked={profile?.readReceiptsEnabled || false}
                        onChange={(event) =>
                          handleProfileUpdate({
                            readReceiptsEnabled: event.target.checked,
                          })
                        }
                      />
                    </label>

                    <label className="flex items-center justify-between text-sm">
                      <span className="text-slate-500">Show last seen</span>
                      <input
                        type="checkbox"
                        checked={profile?.lastSeenVisible || false}
                        onChange={(event) =>
                          handleProfileUpdate({
                            lastSeenVisible: event.target.checked,
                          })
                        }
                      />
                    </label>

                    <label className="block text-sm">
                      <span className="mb-1 block text-slate-500">
                        Who can message me
                      </span>
                      <select
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-power-orange focus:outline-none"
                        value={profile?.messagePrivacy || "EVERYONE"}
                        onChange={(event) =>
                          handleProfileUpdate({
                            messagePrivacy: event.target
                              .value as MessagePrivacy,
                          })
                        }
                      >
                        {privacyOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </section>

                <section
                  id="conversations"
                  className={`scroll-mt-28 rounded-2xl border border-border/80 bg-white p-5 text-card-foreground shadow-xs xl:sticky xl:top-28 xl:h-[calc(100vh-8rem)] xl:overflow-y-auto ${
                    !isConversationsView
                      ? "hidden"
                      : workspaceView === "DIRECTORY"
                        ? "block"
                        : "hidden xl:block"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-slate-600" />
                    <h2 className="text-base font-semibold tracking-tight">
                      Conversations
                    </h2>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Search players, discover groups, and select a conversation.
                  </p>

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
                        “{conversationFilterQuery.trim()}”
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

                  <div className="mt-3 rounded-xl border border-border bg-slate-50 p-2">
                    <button
                      onClick={() => {
                        const targetView =
                          directoryView === "GROUPS" ? "GROUPS" : "CONTACTS";
                        setDirectoryToolsView((current) =>
                          current === targetView ? "NONE" : targetView,
                        );
                        setWorkspaceView("CHAT");
                      }}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      {directoryView === "GROUPS" ? (
                        <Users size={14} />
                      ) : (
                        <MessageSquare size={14} />
                      )}
                      {directoryView === "GROUPS"
                        ? "Open group tools"
                        : "Start new chat"}
                    </button>
                  </div>

                  <div className="mt-4 max-h-90 space-y-2 overflow-y-auto pr-1">
                    {managedConversations.map((conversation) => (
                      <button
                        key={conversation.id}
                        onClick={() => handleOpenConversation(conversation.id)}
                        className={`w-full rounded-lg border p-3 text-left transition-all ${
                          conversation.id === selectedConversationId
                            ? "border-power-orange/60 bg-power-orange/5 shadow-xs"
                            : "border-border bg-background hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-start gap-2">
                            <div className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-slate-100 text-[11px] font-semibold uppercase text-slate-600">
                              {(conversation.conversationType === "GROUP"
                                ? conversation.group?.name ||
                                  conversation.otherParticipant.displayName
                                : conversation.otherParticipant.displayName
                              )
                                .slice(0, 2)
                                .toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-900">
                                <span className="truncate">
                                  {conversation.conversationType === "GROUP"
                                    ? conversation.group?.name ||
                                      conversation.otherParticipant.displayName
                                    : conversation.otherParticipant.displayName}
                                </span>
                                <span className="text-[10px] uppercase text-slate-500">
                                  {conversation.conversationType === "GROUP"
                                    ? "Group"
                                    : "DM"}
                                </span>
                                {conversation.status === "PENDING" && (
                                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-700">
                                    Request
                                  </span>
                                )}
                              </div>
                              <div className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                                {conversation.status === "PENDING"
                                  ? "Message request"
                                  : conversation.latestMessage?.content ||
                                    "No messages yet"}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {conversation.latestMessage?.createdAt && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-400">
                                <Clock3 size={11} />
                                {getRelativeTime(
                                  conversation.latestMessage.createdAt,
                                )}
                              </span>
                            )}
                            {conversation.unreadCount > 0 && (
                              <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-power-orange px-2 py-0.5 text-xs font-semibold text-white">
                                {conversation.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
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
                </section>

                <section
                  className={`rounded-2xl border border-border/80 bg-white p-5 text-card-foreground shadow-xs xl:sticky xl:top-28 xl:flex xl:h-[calc(100vh-8rem)] xl:flex-col ${
                    !isConversationsView
                      ? "hidden xl:hidden"
                      : workspaceView === "CHAT"
                        ? "block"
                        : "hidden xl:block"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <MessageSquare size={16} className="text-slate-600" />
                      <h2 className="text-base font-semibold tracking-tight">
                        Chat
                      </h2>
                    </div>
                    <button
                      onClick={() => setWorkspaceView("DIRECTORY")}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 xl:hidden"
                    >
                      <ChevronLeft size={14} />
                      Back to list
                    </button>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Messages stay anonymous unless identity is public.
                  </p>

                  {directoryToolsView !== "NONE" && (
                    <>
                      <button
                        onClick={() => setDirectoryToolsView("NONE")}
                        aria-label="Close tools overlay"
                        className="fixed inset-0 z-30 bg-slate-900/30 xl:hidden"
                      />

                      <div className="fixed inset-x-3 bottom-3 top-20 z-40 overflow-y-auto rounded-2xl border border-border bg-slate-50 p-3 shadow-lg xl:static xl:inset-auto xl:mt-3 xl:rounded-xl xl:shadow-none">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold tracking-tight text-slate-800">
                          {directoryToolsView === "GROUPS"
                            ? "Group tools"
                            : "New direct chat"}
                        </p>
                        <button
                          onClick={() => setDirectoryToolsView("NONE")}
                          className="rounded-md border border-slate-200 bg-white p-1 text-slate-500 transition hover:bg-slate-100"
                          aria-label="Close tools"
                        >
                          <X size={14} />
                        </button>
                      </div>

                      {directoryToolsView === "CONTACTS" ? (
                        <>
                          <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-background px-3">
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
                            <div className="mt-2 max-h-44 space-y-1 overflow-y-auto rounded-lg border border-border bg-background p-2">
                              {isSearchingPlayers ? (
                                <p className="text-sm text-slate-500">
                                  Searching...
                                </p>
                              ) : playerSearchResults.length ? (
                                playerSearchResults.map((player) => (
                                  <button
                                    key={player.id}
                                    onClick={() =>
                                      void handleStartConversation(player.id)
                                    }
                                    className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-muted"
                                  >
                                    <span>{player.displayName}</span>
                                    <span className="text-xs text-slate-500">
                                      {player.isIdentityPublic
                                        ? "Public"
                                        : "Anonymous"}
                                    </span>
                                  </button>
                                ))
                              ) : (
                                <p className="text-sm text-slate-500">
                                  No players found
                                </p>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
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
                            <div className="mt-2 flex gap-2">
                              <input
                                value={newGroupName}
                                onChange={(event) =>
                                  setNewGroupName(event.target.value)
                                }
                                placeholder="Create group name"
                                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-power-orange focus:outline-none"
                              />
                              <button
                                onClick={() => void handleCreateGroup()}
                                className="rounded-lg bg-power-orange px-3 py-2 text-sm font-medium text-white transition hover:opacity-90"
                              >
                                Create
                              </button>
                            </div>
                          )}

                          <input
                            value={groupSearchQuery}
                            onChange={(event) =>
                              setGroupSearchQuery(event.target.value)
                            }
                            placeholder="Search groups by name, sport, city"
                            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-power-orange focus:outline-none"
                          />

                          <div className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
                            {isSearchingGroups ? (
                              <p className="text-sm text-slate-500">
                                Loading groups...
                              </p>
                            ) : visibleGroups.length ? (
                              visibleGroups.map((group) => {
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
                                          {groupConversation
                                            ? "Open"
                                            : "View"}
                                        </button>
                                      ) : (
                                        <button
                                          onClick={() =>
                                            void handleJoinGroup(group.id)
                                          }
                                          className="rounded-md border border-border bg-slate-100 px-2 py-1 text-xs font-medium transition hover:bg-slate-200"
                                        >
                                          Join
                                        </button>
                                      )}
                                    </div>

                                    {group.isMember && (
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
                                                    event.target
                                                      .value as
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

                                        <div className="flex items-center justify-between">
                                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                            Add member
                                          </p>
                                          {canCurrentUserAddMembers ? (
                                            <button
                                              onClick={() => {
                                                if (inviteGroupId === group.id) {
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
                                            Only admins can add members in this
                                            group.
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
                                                  placeholder="Search player to add"
                                                  className="w-full bg-transparent py-1.5 text-xs outline-none"
                                                />
                                              </div>
                                              {inviteSearchQuery.trim().length >=
                                                2 && (
                                                <div className="max-h-28 space-y-1 overflow-y-auto rounded-lg border border-border bg-background p-1.5">
                                                  {isSearchingInvitePlayers ? (
                                                    <p className="text-xs text-slate-500">
                                                      Searching players...
                                                    </p>
                                                  ) : inviteSearchResults.length ? (
                                                    inviteSearchResults.map(
                                                      (player) => (
                                                        <div
                                                          key={player.id}
                                                          className="flex items-center justify-between gap-2 rounded-md px-1.5 py-1"
                                                        >
                                                          <span className="truncate text-xs text-slate-700">
                                                            {player.displayName}
                                                          </span>
                                                          <button
                                                            disabled={
                                                              isAddingMemberUserId ===
                                                              player.id
                                                            }
                                                            onClick={() =>
                                                              void handleAddMemberToGroup(
                                                                group.id,
                                                                player.id,
                                                              )
                                                            }
                                                            className="rounded-md border border-border bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                                                          >
                                                            {isAddingMemberUserId ===
                                                            player.id
                                                              ? "Adding"
                                                              : "Add"}
                                                          </button>
                                                        </div>
                                                      ),
                                                    )
                                                  ) : (
                                                    <p className="text-xs text-slate-500">
                                                      No players found
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
                              <p className="text-sm text-slate-500">
                                No groups found in this filter
                              </p>
                            )}
                          </div>
                        </>
                      )}
                      </div>
                    </>
                  )}

                  {selectedConversationIsPending && (
                    <div className="mt-3 rounded-xl border border-power-orange/40 bg-power-orange/10 p-3 text-sm text-card-foreground">
                      <p className="font-medium">
                        This conversation is pending approval.
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={handleAcceptRequest}
                          className="rounded-md bg-power-orange px-3 py-1 text-white transition hover:opacity-90"
                        >
                          Accept
                        </button>
                        <button
                          onClick={handleRejectRequest}
                          className="rounded-md border border-border bg-background px-3 py-1 transition hover:bg-slate-50"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex items-center justify-between rounded-lg border border-border bg-slate-50 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-slate-700">
                        {selectedConversation
                          ? selectedConversation.conversationType === "GROUP"
                            ? selectedConversation.group?.name ||
                              selectedConversation.otherParticipant.displayName
                            : selectedConversation.otherParticipant.displayName
                          : "No conversation selected"}
                      </p>
                      {!!selectedConversation?.conversationType && (
                        <p className="text-xs text-slate-500">
                          {selectedConversation.conversationType === "GROUP"
                            ? "Group conversation"
                            : "Direct message"}
                        </p>
                      )}
                    </div>
                    <p className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <Activity size={13} />
                      {isSocketConnected ? "Live" : "Syncing"}
                    </p>
                  </div>

                  <div className="mt-3 min-h-80 flex-1 space-y-2 overflow-y-auto rounded-xl border border-border bg-background p-3">
                    {messages.map((message) => {
                      const isOwnMessage = message.senderId === profile?.userId;
                      const isGroupConversation =
                        selectedConversation?.conversationType === "GROUP";
                      const participantIds = Array.isArray(message.participantIds)
                        ? message.participantIds
                        : [];
                      let otherParticipantId: string | undefined;
                      for (const participantId of participantIds) {
                        if (participantId !== profile?.userId) {
                          otherParticipantId = participantId;
                          break;
                        }
                      }
                      const hasBeenSeenByOther = Boolean(
                        isOwnMessage &&
                          otherParticipantId &&
                          message.readBy?.includes(otherParticipantId),
                      );
                      const messageStateLabel = isOwnMessage
                        ? message.messageStatus === "FAILED"
                          ? "Not sent"
                          : message.messageStatus === "SENDING"
                            ? "Sending"
                            : hasBeenSeenByOther
                              ? "Seen"
                              : "Sent"
                        : null;
                      return (
                        <div
                          key={message.id}
                          className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-xs ${
                              isOwnMessage
                                ? "bg-power-orange text-white"
                                : "border border-border bg-white text-slate-800"
                            }`}
                          >
                            {isGroupConversation && (
                              <div
                                className={`text-[11px] ${
                                  isOwnMessage
                                    ? "text-orange-100"
                                    : "text-slate-500"
                                }`}
                              >
                                {message.senderDisplayName}
                              </div>
                            )}
                            <div className="mt-0.5 wrap-break-word">
                              {message.content}
                            </div>
                            <div
                              className={`mt-1 flex items-center justify-end gap-2 text-[10px] ${
                                isOwnMessage
                                  ? "text-orange-100"
                                  : "text-slate-500"
                              }`}
                            >
                              <span>{getMessageTimestamp(message.createdAt)}</span>
                              {messageStateLabel && <span>{messageStateLabel}</span>}
                              {isOwnMessage && message.messageStatus === "FAILED" && (
                                <button
                                  onClick={() => retryFailedMessage(message)}
                                  className="rounded bg-white/20 px-1.5 py-0.5 text-[10px] font-medium text-white transition hover:bg-white/30"
                                >
                                  Retry
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {!selectedConversation && (
                      <div className="rounded-lg border border-dashed border-border bg-slate-50 p-4 text-center text-sm text-slate-500">
                        Choose a conversation to start chatting.
                      </div>
                    )}

                    {!!selectedConversation && !messages.length && (
                      <div className="rounded-lg border border-dashed border-border bg-slate-50 p-4 text-center text-sm text-slate-500">
                        No messages yet. Start the conversation.
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>

                  <div className="mt-3 flex gap-2 rounded-xl border border-border bg-white p-2 xl:sticky xl:bottom-0">
                    <textarea
                      value={newMessage}
                      onChange={(event) => setNewMessage(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" && !event.shiftKey) {
                          event.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder={
                        selectedConversation
                          ? "Type your message"
                          : "Select a conversation to reply"
                      }
                      disabled={!selectedConversation || isSending}
                      rows={1}
                      className="max-h-28 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-power-orange focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
                    />
                    <button
                      disabled={
                        isSending || !selectedConversation || !newMessage.trim()
                      }
                      onClick={handleSendMessage}
                      className="rounded-lg bg-power-orange px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                    >
                      {isSending ? "Sending" : "Send"}
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Press Enter to send, Shift+Enter for a new line.
                  </p>

                  {error && (
                    <p className="mt-2 text-sm text-error-red">{error}</p>
                  )}
                </section>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
