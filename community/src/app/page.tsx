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
  Compass,
  ExternalLink,
  Flag,
  LogOut,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Shield,
  UserCircle2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

// Imported Refactored Modules
import {
  getAvatarCharacter,
  formatUserMeta,
  isWithinMessageEditWindow,
} from "../modules/community/utils/chatUtils";
import { ConversationListItem } from "@/modules/community/components/chat/ConversationListItem";
import { MessageBubble } from "@/modules/community/components/chat/MessageBubble";
import { MobileMessageActions } from "@/modules/community/components/chat/MobileMessageActions";
import { ReportModal } from "@/modules/community/components/chat/ReportModal";

const COMMUNITY_ACTIVE_TAB_KEY = "community:activeSidebarTab";
const COMMUNITY_WORKSPACE_VIEW_KEY = "community:workspaceView";
const COMMUNITY_DIRECTORY_VIEW_KEY = "community:directoryView";
const COMMUNITY_SELECTED_CONVERSATION_KEY = "community:selectedConversationId";
const COMMUNITY_SIDEBAR_MODE_KEY = "community:sidebarMode";
const CONVERSATION_PAGE_SIZE = 25;
const DISCONNECTED_POLL_BASE_MS = 2500;
const DISCONNECTED_POLL_MAX_MS = 30000;

const shellVariants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
};
const panelVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0 },
};

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
): value is "CONTACTS" | "GROUPS" =>
  value === "CONTACTS" || value === "GROUPS";
const isValidGroupToolsMode = (
  value: string | null,
): value is "DISCOVER" | "MANAGE" | "INVITE" =>
  value === "DISCOVER" || value === "MANAGE" || value === "INVITE";

const resolveSidebarQueryState = (value: string | null) => {
  const normalized = value?.trim().toLowerCase() || "";
  if (!normalized) return {};
  if (normalized === "tools") return { mode: "TOOLS" as const };
  if (normalized === "inbox") return { mode: "INBOX" as const };
  if (normalized === "community-overview")
    return { mode: "INBOX" as const, tab: "community-overview" as const };
  if (normalized === "conversations")
    return { mode: "INBOX" as const, tab: "conversations" as const };
  return {};
};

function CommunityPageContent() {
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
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(() => {
    if (typeof window === "undefined") return null;
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
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
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
      return [...safeCurrent, incoming];
    });
  };

  const removeMessageById = (messageId: string) => {
    setMessages((current) =>
      (Array.isArray(current) ? current : []).filter((m) => m.id !== messageId),
    );
  };

  const updateMessageById = (
    messageId: string,
    updater: (m: ConversationMessage) => ConversationMessage,
  ) => {
    setMessages((current) =>
      (Array.isArray(current) ? current : []).map((m) =>
        m.id === messageId ? updater(m) : m,
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

  const loadMessages = useCallback(
    async (conversationId: string) => {
      try {
        const response = await communityService.getMessages(conversationId);
        setMessages(Array.isArray(response.messages) ? response.messages : []);
        await refreshConversationsNow();
        const socket = getCommunitySocket();
        if (socket.connected) {
          socket.emit("community:markRead", { conversationId });
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
    if (typeof urlConversationId === "string" && urlConversationId.trim())
      setSelectedConversationId((c) =>
        c === urlConversationId ? c : urlConversationId,
      );
    if (typeof urlQuery === "string" && urlQuery.trim())
      setGroupSearchQuery((c) => (c === urlQuery.trim() ? c : urlQuery.trim()));

    hasHydratedUrlRef.current = true;
    lastAppliedQueryRef.current = currentQuery;
  }, [urlSearchParams]);

  useEffect(() => {
    const params = new URLSearchParams(urlSearchParams.toString());
    params.set("sidebar", sidebarMode.toLowerCase());
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
      setMessages((current) =>
        (Array.isArray(current) ? current : []).map((m) => {
          if (!payload.messageIds.includes(m.id)) return m;
          const readBy = m.readBy || [];
          if (readBy.includes(payload.readerId)) return m;
          return { ...m, readBy: [...readBy, payload.readerId] };
        }),
      );
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

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("community:newMessage", handleNewMessage);
    socket.on("community:messagesRead", handleMessagesRead);
    socket.on("community:conversationUpdated", handleConversationUpdated);
    socket.on("community:messageEdited", handleMessageEdited);
    socket.on("community:messageDeleted", handleMessageDeleted);
    socket.on("community:error", handleCommunityError);
    socket.on("connect_error", handleConnectError);

    if (socket.connected) handleConnect();
    else socket.connect();

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
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
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
      const updatedConversations = await communityService.listConversations(
        1,
        CONVERSATION_PAGE_SIZE,
      );
      applyConversationPage(updatedConversations, { preserveSelection: true });
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
      const updatedConversations = await communityService.listConversations(
        1,
        CONVERSATION_PAGE_SIZE,
      );
      applyConversationPage(updatedConversations, { preserveSelection: true });
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
      toast.error(e instanceof Error ? e.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
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
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <>
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.28 }}
        className="h-full min-h-0 bg-[radial-gradient(circle_at_top,rgba(233,115,22,0.12),transparent_35%),linear-gradient(to_bottom,#f8fafc,#f1f5f9)]"
      >
        <motion.div
          variants={shellVariants}
          initial="hidden"
          animate="show"
          className="mx-auto grid h-full min-h-0 w-full max-w-full gap-0 grid-cols-1"
        >
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
                          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 sm:w-auto"
                        >
                          Open chats
                        </button>
                        <Link
                          href="/q"
                          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 sm:w-auto"
                        >
                          Explore Q&A
                        </Link>
                        <a
                          href={mainAppUrl}
                          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 sm:w-auto"
                        >
                          Switch to Main App <ExternalLink size={16} />
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
                    className="rounded-2xl border border-border/80 bg-white p-4 shadow-xs"
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

          {isConversationsView && (
            <div className="contents">
              <motion.main
                variants={panelVariants}
                className="grid h-full min-h-0 min-w-0 grid-cols-1 lg:grid-cols-[380px_minmax(0,1fr)]"
              >
                {/* DIRECTORY VIEW */}
                <motion.section
                  className={`h-full min-h-0 overflow-y-auto border-r border-slate-200 bg-white p-3.5 pb-24 sm:p-4 lg:pb-4 ${workspaceView === "DIRECTORY" ? "block" : "hidden lg:block"}`}
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
                        className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${sidebarMode === mode ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
                      >
                        {mode === "INBOX" ? "Inbox" : "Tools"}
                      </button>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center gap-2 rounded-xl border border-border bg-slate-50 p-1">
                    <button
                      onClick={() => setDirectoryView("CONTACTS")}
                      className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${directoryView === "CONTACTS" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
                    >
                      <MessageSquare size={14} /> DM
                    </button>
                    <button
                      onClick={() => setDirectoryView("GROUPS")}
                      className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-xs font-semibold transition ${directoryView === "GROUPS" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
                    >
                      <Users size={14} /> Groups
                    </button>
                  </div>

                  {sidebarMode === "TOOLS" ? (
                    <div className="mt-3 flex flex-col gap-3">
                      <div className="rounded-2xl border border-white/80 bg-[linear-gradient(135deg,#fafdff_0%,#eaf4ff_100%)] p-4 shadow-sm relative overflow-hidden">
                        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-sky-300/20 blur-2xl" />
                        <div className="relative z-10 flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-sky-600/80">
                              {directoryView === "GROUPS"
                                ? "Community"
                                : "Direct Messages"}
                            </p>
                            <h3 className="font-title mt-1 text-lg font-bold text-slate-900">
                              {directoryView === "GROUPS"
                                ? "Group Tools"
                                : "Chat Tools"}
                            </h3>
                          </div>
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/60 shadow-sm backdrop-blur-md">
                            {directoryView === "GROUPS" ? (
                              <Users size={20} className="text-sky-600" />
                            ) : (
                              <MessageSquare
                                size={20}
                                className="text-sky-600"
                              />
                            )}
                          </div>
                        </div>
                        <div className="mt-4 flex gap-1">
                          {toolsSteps.map((step) => (
                            <div
                              key={step.id}
                              className="group relative flex-1"
                            >
                              <div
                                className={`h-1.5 w-full rounded-full transition-colors duration-300 ${step.done ? "bg-turf-green" : "bg-white/60 shadow-inner"}`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {directoryView === "CONTACTS" ? (
                        <div className="space-y-3 rounded-2xl border border-slate-200/60 bg-white/80 p-3 shadow-sm backdrop-blur-md">
                          <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm">
                            Search a user and tap their card to instantly create
                            or open a DM thread.
                          </div>
                          <div className="relative">
                            <Search
                              size={14}
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />
                            <input
                              value={playerSearchQuery}
                              onChange={(e) =>
                                setPlayerSearchQuery(e.target.value)
                              }
                              placeholder="Search by name or alias"
                              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm focus:border-power-orange focus:bg-white focus:outline-none focus:ring-2 focus:ring-power-orange/20"
                            />
                          </div>
                          {playerSearchQuery.trim().length >= 2 && (
                            <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-1.5 shadow-inner">
                              {isSearchingPlayers ? (
                                <p className="p-2 text-center text-sm text-slate-500">
                                  Searching...
                                </p>
                              ) : playerSearchResults.length ? (
                                playerSearchResults.map((user) => (
                                  <button
                                    key={user.id}
                                    onClick={() =>
                                      void handleStartConversation(user.id)
                                    }
                                    className="flex w-full items-start gap-3 rounded-lg bg-white px-3 py-2.5 text-left text-sm shadow-sm hover:border-power-orange/30 hover:bg-power-orange/5"
                                  >
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                                      {user.photoUrl ? (
                                        <img
                                          src={user.photoUrl}
                                          alt={user.displayName}
                                          className="h-full w-full object-cover"
                                        />
                                      ) : (
                                        getAvatarCharacter(user.displayName)
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className="truncate font-semibold text-slate-800">
                                          {user.displayName}
                                        </span>
                                      </div>
                                      <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                                        <span>
                                          {user.isIdentityPublic
                                            ? "Public"
                                            : "Anonymous"}
                                        </span>
                                        {formatUserMeta(user) && (
                                          <span>{formatUserMeta(user)}</span>
                                        )}
                                      </div>
                                    </div>
                                  </button>
                                ))
                              ) : (
                                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-center text-sm text-slate-500">
                                  No users found for this search.
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-4 rounded-2xl border border-slate-200/60 bg-white/80 p-3 shadow-sm backdrop-blur-md">
                          <div className="relative flex rounded-xl border border-slate-200/60 bg-slate-100/50 p-1">
                            {[
                              {
                                value: "DISCOVER",
                                label: "Discover",
                                icon: Compass,
                              },
                              {
                                value: "MANAGE",
                                label: "Manage",
                                icon: Settings,
                              },
                              {
                                value: "INVITE",
                                label: "Invite",
                                icon: UserPlus,
                              },
                            ].map((item) => {
                              const isActive = groupToolsMode === item.value;
                              const Icon = item.icon;
                              return (
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
                                  className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] font-semibold transition-colors z-10 ${isActive ? "text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
                                >
                                  {isActive && (
                                    <motion.div
                                      layoutId="groupToolsTab"
                                      className="absolute inset-0 z-0 rounded-lg bg-white shadow-sm border border-slate-200/50"
                                    />
                                  )}
                                  <span className="relative z-10 flex items-center gap-1.5">
                                    <Icon
                                      size={14}
                                      className={
                                        isActive ? "text-power-orange" : ""
                                      }
                                    />
                                    {item.label}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                            <div className="flex gap-1 rounded-lg bg-slate-50 p-1 border border-slate-200/60">
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
                                  className={`rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all ${groupMode === item.value ? "bg-white text-slate-800 shadow-sm border border-slate-200/50" : "text-slate-500 hover:bg-slate-100"}`}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                            <button
                              onClick={() =>
                                setIsCreateGroupOpen(!isCreateGroupOpen)
                              }
                              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold shadow-sm transition ${isCreateGroupOpen ? "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200" : "bg-slate-900 text-white hover:bg-slate-700"}`}
                            >
                              {isCreateGroupOpen ? (
                                <X size={12} />
                              ) : (
                                <Plus size={12} />
                              )}
                              {isCreateGroupOpen ? "Close" : "New Group"}
                            </button>
                          </div>

                          <AnimatePresence>
                            {isCreateGroupOpen && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                              >
                                <div className="rounded-2xl border border-power-orange/20 bg-[linear-gradient(180deg,rgba(233,115,22,0.04),rgba(255,255,255,0.96))] p-4 shadow-sm mb-4">
                                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                    <input
                                      value={newGroupName}
                                      onChange={(e) =>
                                        setNewGroupName(e.target.value)
                                      }
                                      placeholder="Group name"
                                      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/20"
                                    />
                                    <input
                                      value={newGroupSport}
                                      onChange={(e) =>
                                        setNewGroupSport(e.target.value)
                                      }
                                      placeholder="Sport"
                                      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/20"
                                    />
                                  </div>
                                  <div className="mt-4 flex justify-end">
                                    <button
                                      onClick={handleCreateGroup}
                                      disabled={isCreatingGroup}
                                      className="rounded-xl bg-linear-to-r from-power-orange to-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition hover:opacity-90 disabled:opacity-60"
                                    >
                                      {isCreatingGroup
                                        ? "Creating..."
                                        : "Create Group"}
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <div className="relative">
                            <Search
                              size={14}
                              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                            />
                            <input
                              value={groupSearchQuery}
                              onChange={(e) =>
                                setGroupSearchQuery(e.target.value)
                              }
                              placeholder="Search groups"
                              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm focus:border-power-orange focus:outline-none focus:ring-2 focus:ring-power-orange/20"
                            />
                          </div>

                          <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1 pb-2">
                            {isSearchingGroups ? (
                              <div className="py-8 text-center">
                                <Activity className="mx-auto h-6 w-6 animate-pulse text-slate-300" />
                              </div>
                            ) : toolVisibleGroups.length ? (
                              toolVisibleGroups.map((group) => {
                                const groupConversation =
                                  getGroupConversationByGroupId(group.id);
                                return (
                                  <motion.div
                                    layout
                                    key={group.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="group relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm hover:border-power-orange/40"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex min-w-0 items-center gap-3">
                                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-slate-100 to-slate-200 font-title text-base font-bold text-slate-600 shadow-inner">
                                          {group.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0">
                                          <h4 className="truncate font-title text-[14px] font-semibold text-slate-900 leading-tight">
                                            {group.name}
                                          </h4>
                                          <p className="text-[11px] font-medium text-slate-500">
                                            {group.memberCount} members
                                          </p>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-1.5 shrink-0">
                                        {group.isMember ? (
                                          <button
                                            onClick={() => {
                                              if (groupConversation)
                                                handleOpenConversation(
                                                  groupConversation.id,
                                                );
                                              else {
                                                setDirectoryView("GROUPS");
                                                setGroupSearchQuery(group.name);
                                              }
                                            }}
                                            className="rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-700"
                                          >
                                            {groupConversation
                                              ? "Chat"
                                              : "View"}
                                          </button>
                                        ) : (
                                          <>
                                            <button
                                              onClick={() =>
                                                void handleJoinGroup(group.id)
                                              }
                                              className="rounded-lg bg-power-orange px-3 py-1.5 text-[11px] font-semibold text-white hover:opacity-90"
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
                                              className="flex h-7 w-7 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                                            >
                                              <Flag size={12} />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    <AnimatePresence>
                                      {group.isMember &&
                                        groupToolsMode === "MANAGE" && (
                                          <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{
                                              opacity: 1,
                                              height: "auto",
                                            }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="mt-4 border-t border-slate-100 pt-3"
                                          >
                                            <div className="flex items-center gap-2">
                                              <button
                                                onClick={() =>
                                                  void handleLeaveGroup(
                                                    group.id,
                                                  )
                                                }
                                                disabled={
                                                  isLeavingGroupId === group.id
                                                }
                                                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-600 hover:bg-rose-100 disabled:opacity-60"
                                              >
                                                <LogOut size={14} /> Leave Group
                                              </button>
                                              <button
                                                onClick={() =>
                                                  handleOpenReportModal(
                                                    "GROUP",
                                                    group.id,
                                                  )
                                                }
                                                className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-600 hover:bg-slate-100"
                                              >
                                                <Flag size={14} />
                                              </button>
                                            </div>
                                          </motion.div>
                                        )}
                                    </AnimatePresence>
                                    <AnimatePresence>
                                      {group.isMember &&
                                        groupToolsMode === "INVITE" && (
                                          <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{
                                              opacity: 1,
                                              height: "auto",
                                            }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="mt-4 border-t border-slate-100 pt-3"
                                          >
                                            {group.isAdmin && (
                                              <GroupInviteLink
                                                groupId={group.id}
                                                groupName={group.name}
                                              />
                                            )}
                                          </motion.div>
                                        )}
                                    </AnimatePresence>
                                  </motion.div>
                                );
                              })
                            ) : (
                              <p className="text-center text-sm text-slate-500 py-10">
                                No groups found.
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-border bg-slate-50 p-1">
                        {conversationModeOptions.map((item) => (
                          <button
                            key={item.value}
                            onClick={() =>
                              setConversationMode(
                                item.value as "ALL" | "UNREAD" | "REQUESTS",
                              )
                            }
                            className={`rounded-lg px-2 py-1.5 text-xs font-semibold transition ${conversationMode === item.value ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-800"}`}
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>

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
                          <div className="p-4 text-center text-sm text-slate-500">
                            {hasConversationFilters
                              ? "No matches for current filters."
                              : "No conversations yet."}
                          </div>
                        )}
                        {!hasConversationFilters && hasMoreConversations && (
                          <button
                            onClick={() => void handleLoadMoreConversations()}
                            disabled={isLoadingMoreConversations}
                            className="w-full border border-border bg-white px-3 py-2 text-sm font-medium text-slate-700"
                          >
                            {isLoadingMoreConversations
                              ? "Loading..."
                              : "Load more"}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </motion.section>

                {/* CHAT VIEW */}
                <motion.section
                  className={`h-full min-h-0 min-w-0 flex-col overflow-hidden bg-[#efeae2] bg-[radial-gradient(rgba(255,255,255,0.34)_1px,transparent_1px),radial-gradient(rgba(0,0,0,0.03)_1px,transparent_1px)] bg-position-[0_0,11px_11px] bg-size-[22px_22px] ${workspaceView === "CHAT" ? "flex" : "hidden lg:flex"}`}
                >
                  <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-3 py-2 sm:px-4 sm:py-2.5 lg:min-h-15 lg:px-4 lg:py-2">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-linear-to-br from-slate-200 to-slate-300 text-sm font-bold uppercase text-slate-700">
                          {selectedConversationPhotoUrl ? (
                            <img
                              src={selectedConversationPhotoUrl}
                              alt={selectedConversationDisplayName}
                              className="h-full w-full object-cover"
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
                              ? "Group"
                              : "Direct message"}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center justify-end gap-1.5 sm:gap-2">
                        <button
                          onClick={() => {
                            setIsConversationSidebarOpen(true);
                            setSidebarMode("TOOLS");
                            setWorkspaceView("DIRECTORY");
                          }}
                          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 lg:hidden"
                        >
                          <ChevronLeft size={13} /> Back
                        </button>
                        {selectedConversation?.conversationType === "GROUP" && (
                          <button
                            onClick={() =>
                              setShowGroupMembersPanel(!showGroupMembersPanel)
                            }
                            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                          >
                            {showGroupMembersPanel ? (
                              <PanelRightClose size={13} />
                            ) : (
                              <PanelRightOpen size={13} />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                    {selectedConversationIsPending && (
                      <div className="mt-3 rounded-lg border border-power-orange/30 bg-power-orange/8 p-2.5 text-sm text-slate-700">
                        {selectedConversationNeedsMyApproval ? (
                          <>
                            <p className="font-500">Message request pending</p>
                            <div className="mt-2 flex gap-2">
                              <button
                                onClick={handleAcceptRequest}
                                className="rounded-md bg-power-orange px-3 py-1 text-xs font-semibold text-white"
                              >
                                Accept
                              </button>
                              <button
                                onClick={handleRejectRequest}
                                className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700"
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
                  </div>

                  <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-3 pt-3 sm:px-4 sm:pb-4 sm:pt-4">
                    {messages.map((message) => (
                      <MessageBubble
                        key={message.id}
                        message={message}
                        isOwnMessage={message.senderId === profile?.userId}
                        isGroupConversation={
                          selectedConversation?.conversationType === "GROUP"
                        }
                        profileUserId={profile?.userId}
                        onOpenMobileActions={(m) =>
                          setMobileActionMessageId(m.id)
                        }
                        onRetry={retryFailedMessage}
                        onEdit={handleBeginEditMessage}
                        onDelete={handleDeleteMessage}
                        onCopy={handleCopyMessage}
                        isCopied={copiedMessageId === message.id}
                        isEditing={editingMessageId === message.id}
                        isMutating={isMutatingMessageId === message.id}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>

                  {editingMessageId && (
                    <div className="mt-2 shrink-0 border border-power-orange/30 bg-power-orange/8 p-3">
                      <p className="text-xs font-semibold text-power-orange">
                        Editing message
                      </p>
                      <textarea
                        value={editingMessageDraft}
                        onChange={(e) => setEditingMessageDraft(e.target.value)}
                        rows={2}
                        className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-power-orange focus:outline-none"
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={handleSaveEditedMessage}
                          disabled={isMutatingMessageId === editingMessageId}
                          className="rounded-md bg-power-orange px-3 py-1.5 text-xs text-white"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEditMessage}
                          className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="sticky bottom-0 z-20 shrink-0 border-t border-slate-200/80 bg-[#f0f2f5] px-3 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] lg:static">
                    <div className="flex min-w-0 items-end gap-2.5">
                      <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            if (canSendSelectedConversationMessage)
                              handleSendMessage();
                          }
                        }}
                        placeholder={
                          !selectedConversation
                            ? "Select a conversation"
                            : "Type a message..."
                        }
                        disabled={
                          !canSendSelectedConversationMessage || isSending
                        }
                        rows={1}
                        className="max-h-28 flex-1 resize-none rounded-3xl border border-slate-200 bg-white px-4 py-2.5 text-sm focus:border-power-orange focus:outline-none disabled:cursor-not-allowed"
                      />
                      <button
                        disabled={
                          isSending ||
                          !canSendSelectedConversationMessage ||
                          !newMessage.trim()
                        }
                        onClick={handleSendMessage}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-power-orange text-white disabled:opacity-50"
                      >
                        {isSending ? (
                          <RotateCcw size={16} className="animate-spin" />
                        ) : (
                          <MessageSquare size={16} />
                        )}
                      </button>
                    </div>
                  </div>
                </motion.section>

                <AnimatePresence initial={false}>
                  {showGroupInsightsSidebar && selectedConversation?.group && (
                    <>
                      <motion.button
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowGroupMembersPanel(false)}
                        className="fixed inset-0 z-40 bg-slate-900/40 xl:hidden"
                      />
                      <motion.section
                        initial={{ opacity: 0, x: 28 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 24 }}
                        className="fixed inset-y-0 right-0 z-50 w-[92vw] max-w-sm overflow-y-auto border-l border-border bg-white p-4 shadow-xl xl:w-95 xl:max-w-none"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-base font-semibold tracking-tight">
                            Group Sidebar
                          </h3>
                          <button
                            onClick={() => setShowGroupMembersPanel(false)}
                            className="rounded-lg border border-border bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700"
                          >
                            Close
                          </button>
                        </div>
                        <div className="mt-4">
                          <GroupMembersList
                            groupId={selectedConversation.group.id}
                            onMemberClick={handleMemberClick}
                          />
                        </div>
                      </motion.section>
                    </>
                  )}
                </AnimatePresence>

                {isConversationsView && workspaceView !== "CHAT" && (
                  <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/96 backdrop-blur lg:hidden pb-[env(safe-area-inset-bottom)]">
                    <div className="mx-auto grid max-w-lg grid-cols-3 gap-0.5 p-2">
                      <button
                        onClick={() => {
                          setWorkspaceView(
                            selectedConversationId ? "CHAT" : "DIRECTORY",
                          );
                          setSidebarMode("INBOX");
                        }}
                        className={`flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs ${activeMobileDockTab === "CHAT" ? "text-power-orange" : "text-slate-600"}`}
                      >
                        <MessageSquare size={20} /> Chat
                      </button>
                      <button
                        onClick={() => {
                          setSidebarMode("INBOX");
                          setWorkspaceView("DIRECTORY");
                        }}
                        className={`flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs ${activeMobileDockTab === "LIST" ? "text-power-orange" : "text-slate-600"}`}
                      >
                        <Users size={20} /> Chats
                      </button>
                      <button
                        onClick={() => {
                          setSidebarMode("TOOLS");
                          setWorkspaceView("DIRECTORY");
                          setDirectoryView("GROUPS");
                        }}
                        className={`flex flex-col items-center gap-1 rounded-lg px-3 py-2 text-xs ${activeMobileDockTab === "TOOLS" ? "text-power-orange" : "text-slate-600"}`}
                      >
                        <Search size={20} /> Tools
                      </button>
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

      <AnimatePresence>
        {mobileActionMessage && (
          <MobileMessageActions
            message={mobileActionMessage}
            profileUserId={profile?.userId}
            onClose={() => setMobileActionMessageId(null)}
            onCopy={handleCopyMessage}
            onRetry={retryFailedMessage}
            onEdit={handleBeginEditMessage}
            onDelete={handleDeleteMessage}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reportModal && (
          <ReportModal
            targetType={reportModal.targetType}
            targetId={reportModal.targetId}
            isSubmitting={isSubmittingReport}
            onClose={() => setReportModal(null)}
            onSubmit={handleSubmitReportWrapper}
          />
        )}
      </AnimatePresence>
    </>
  );
}

export default function CommunityPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><div className="animate-pulse flex flex-col items-center"><div className="h-8 w-8 rounded-full border-4 border-slate-200 border-t-power-orange animate-spin"></div><p className="mt-4 text-sm text-slate-500">Loading Community...</p></div></div>}>
      <CommunityPageContent />
    </Suspense>
  );
}
