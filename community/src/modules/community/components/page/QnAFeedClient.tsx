"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowBigDown,
  ArrowBigUp,
  CalendarDays,
  Dumbbell,
  Filter,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import { communityService } from "@/modules/community/services/community";
import {
  COMMUNITY_POST_CATEGORIES,
  CommunityActivityItem,
  CommunityFeedSort,
  CommunityFeedSortDirection,
  CommunityPost,
  CommunityReputationSummary,
} from "@/modules/community/types";
import { redirectToMainLogin } from "@/lib/auth/redirect";
import { isCommunityEligibleRole } from "@/lib/auth/roles";
import { getCommunitySocket } from "@/lib/realtime/socket";
import { communityFollowStore } from "@/modules/community/lib/followStore";
import { toast } from "@/lib/toast";
import { useMutationState } from "@/lib/hooks/useMutationState";
import AskQuestionModal from "@/modules/community/components/page/AskQuestionModal";
import AuthorAvatar from "@/modules/community/components/page/AuthorAvatar";
import {
  MultiCheckboxDropdown,
  SelectDropdown,
} from "@/modules/community/components/page/FilterControls";

const QUICK_FILTERS: Array<{ value: CommunityFeedSort; label: string }> = [
  { value: "NEW", label: "New" },
  { value: "UNANSWERED", label: "Unanswered" },
  { value: "ANSWERED", label: "Answered" },
];

const SORT_DIRECTION_OPTIONS: Array<{
  value: CommunityFeedSortDirection;
  label: string;
}> = [
  { value: "DESC", label: "Newest to Oldest" },
  { value: "ASC", label: "Oldest to Newest" },
];

const toRelativeTime = (value: string): string => {
  const at = new Date(value).getTime();
  if (Number.isNaN(at)) return "";
  const diffMin = Math.max(1, Math.floor((Date.now() - at) / 60000));
  if (diffMin < 60) return `${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  return `${Math.floor(diffH / 24)}d`;
};

const formatPostedDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const getActivityLabel = (item: CommunityActivityItem): string => {
  const event = item.data?.event || "";

  if (event === "COMMUNITY_ANSWER_CREATED") {
    return "New answer on your question";
  }

  if (event === "COMMUNITY_UPVOTE_RECEIVED") {
    return item.data?.targetType === "POST"
      ? "Your question received an upvote"
      : "Your answer received an upvote";
  }

  return "Community activity";
};

const CAPSULE_TONES = {
  violet: "border-violet-200 bg-violet-50 text-violet-700",
  orange: "border-power-orange/30 bg-power-orange/10 text-power-orange",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  rose: "border-rose-200 bg-rose-50 text-rose-700",
  slate: "border-slate-200 bg-slate-100 text-slate-700",
} as const;

function FilterCapsule({
  label,
  onRemove,
  tone = "slate",
}: {
  label: string;
  onRemove: () => void;
  tone?: keyof typeof CAPSULE_TONES;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${CAPSULE_TONES[tone]}`}
    >
      <span className="max-w-[10rem] truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-0.5 transition hover:bg-black/10"
        title={`Remove ${label}`}
      >
        <X size={12} />
      </button>
    </span>
  );
}

export default function QnAFeedClient() {
  const router = useRouter();
  const pathname = usePathname();
  const urlSearchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<"ALL" | "MINE">("ALL");
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingActivity, setIsLoadingActivity] = useState(false);
  const [isMarkingActivityRead, setIsMarkingActivityRead] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [activity, setActivity] = useState<CommunityActivityItem[]>([]);
  const [activityUnreadCount, setActivityUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [reputation, setReputation] =
    useState<CommunityReputationSummary | null>(null);

  // Unified voting mutation state - replaces isMutatingPostId and isVotingKey
  const voting = useMutationState(
    async (postId: string, payload: { value: 1 | -1 }) => {
      return await communityService.vote({
        targetType: "POST",
        targetId: postId,
        value: payload.value,
      });
    },
    {
      onSuccess: (postId, result) => {
        setPosts((current) =>
          current.map((item) =>
            item.id === postId
              ? {
                  ...item,
                  myVote: result.myVote,
                  voteScore: result.voteScore,
                  upvoteCount: result.upvoteCount,
                  downvoteCount: result.downvoteCount,
                }
              : item,
          ),
        );
        void loadActivity();
      },
      onError: (postId, error) => {
        toast.error(error.message || "Failed to vote");
      },
    },
  );

  // Post edit/delete mutation state - replaces isMutatingPostId for close/open/delete
  const postMutations = useMutationState(
    async (
      postId: string,
      payload: { action: "toggle" | "delete"; nextStatus?: "OPEN" | "CLOSED" },
    ) => {
      if (payload.action === "toggle") {
        return await communityService.updatePost(postId, {
          status: payload.nextStatus,
        });
      } else {
        await communityService.deletePost(postId);
        return null;
      }
    },
    {
      onSuccess: (postId, result, payload) => {
        if (payload.action === "toggle" && result) {
          setPosts((current) =>
            current.map((item) =>
              item.id === postId ? { ...item, status: result.status } : item,
            ),
          );
          toast.success(
            `Question ${payload.nextStatus === "OPEN" ? "reopened" : "closed"}`,
          );
        } else if (payload.action === "delete") {
          setPosts((current) => current.filter((item) => item.id !== postId));
          toast.success("Question deleted");
          void loadActivity();
        }
      },
      onError: (postId, error, payload) => {
        const action = payload.action === "toggle" ? "update" : "delete";
        toast.error(error.message || `Failed to ${action} question`);
      },
    },
  );
  const [sort, setSort] = useState<CommunityFeedSort>("NEW");
  const [direction, setDirection] =
    useState<CommunityFeedSortDirection>("DESC");
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [activeTag, setActiveTag] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [sportOptions, setSportOptions] = useState<string[]>([]);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [showAskForm, setShowAskForm] = useState(false);
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterPanelSettled, setFilterPanelSettled] = useState(false);
  const [isUrlHydrated, setIsUrlHydrated] = useState(false);
  const [followedTopics, setFollowedTopics] = useState<string[]>([]);

  useEffect(() => {
    const qParam = (urlSearchParams.get("q") || "").trim();
    const tagParam = (urlSearchParams.get("tag") || "").trim();
    const sportParam = (urlSearchParams.get("sport") || "").trim();
    const cityParam = (urlSearchParams.get("city") || "").trim();
    const askParam = urlSearchParams.get("ask") === "1";
    const sortParam = (urlSearchParams.get("sort") || "").toUpperCase();
    const dirParam = (urlSearchParams.get("dir") || "").toUpperCase();
    const mineParam = urlSearchParams.get("mine") === "1";

    const nextSort: CommunityFeedSort =
      sortParam === "TOP" ||
      sortParam === "UNANSWERED" ||
      sortParam === "ANSWERED"
        ? sortParam
        : "NEW";
    const nextDirection: CommunityFeedSortDirection =
      dirParam === "ASC" ? "ASC" : "DESC";

    const parseCsv = (value: string): string[] =>
      value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

    setSearchInput(qParam);
    setQ(qParam);
    setActiveTag(tagParam);
    setSelectedSports(parseCsv(sportParam));
    setSelectedCities(parseCsv(cityParam));
    setSort(nextSort);
    setDirection(nextDirection);
    setViewMode(mineParam ? "MINE" : "ALL");
    if (askParam) {
      setShowAskForm(true);
    }
    setIsUrlHydrated(true);
  }, [urlSearchParams]);

  const loadFeed = useCallback(
    async (targetPage = 1, append = false) => {
      try {
        if (append) {
          setIsLoadingMore(true);
        } else {
          setIsLoading(true);
        }

        const session = await communityService.ensureSession();
        if (!isCommunityEligibleRole(session.role)) {
          redirectToMainLogin();
          return;
        }
        setCurrentUserId(session.id);

        const [postData, rep] = await Promise.all([
          communityService.listPosts(targetPage, 20, {
            sort,
            direction,
            q,
            tag: activeTag || undefined,
            sport: selectedSports.length ? selectedSports.join(",") : undefined,
            city: selectedCities.length ? selectedCities.join(",") : undefined,
            category: categoryFilter || undefined,
            mine: viewMode === "MINE",
          }),
          communityService.getMyReputation(),
        ]);

        const items = postData.items || [];
        setPosts((current) => (append ? [...current, ...items] : items));

        // Accumulate sport/city options so the filter dropdowns stay populated
        // even after a filter narrows the visible posts.
        setSportOptions((current) => {
          const merged = new Set(current);
          for (const item of items) {
            if (item.sport) merged.add(item.sport);
          }
          return [...merged].sort((a, b) => a.localeCompare(b));
        });
        setCityOptions((current) => {
          const merged = new Set(current);
          for (const item of items) {
            if (item.city) merged.add(item.city);
          }
          return [...merged].sort((a, b) => a.localeCompare(b));
        });
        setReputation(rep);
        setPage(targetPage);
        setHasMore(targetPage < (postData.pagination?.totalPages || 0));
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to load feed",
        );
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [
      sort,
      direction,
      q,
      activeTag,
      selectedSports,
      selectedCities,
      categoryFilter,
      viewMode,
    ],
  );

  const loadActivity = useCallback(async () => {
    try {
      setIsLoadingActivity(true);
      const items = await communityService.listMyKnowledgeActivity(20);
      setActivity(items);
      setActivityUnreadCount(
        items.reduce((count, item) => (item.isRead ? count : count + 1), 0),
      );
    } catch {
      setActivity([]);
      setActivityUnreadCount(0);
    } finally {
      setIsLoadingActivity(false);
    }
  }, []);

  const handleActivityOpen = useCallback(
    async (item: CommunityActivityItem) => {
      if (item.isRead) {
        return;
      }

      try {
        await communityService.markCommunityNotificationRead(item.id);
        setActivity((current) =>
          current.map((entry) =>
            entry.id === item.id ? { ...entry, isRead: true } : entry,
          ),
        );
        setActivityUnreadCount((count) => Math.max(0, count - 1));
      } catch {
        // Keep navigation responsive even if read status update fails.
      }
    },
    [],
  );

  const handleMarkAllActivityRead = useCallback(async () => {
    if (!activityUnreadCount || isMarkingActivityRead) {
      return;
    }

    try {
      setIsMarkingActivityRead(true);
      const unreadIds = activity
        .filter((entry) => !entry.isRead)
        .map((entry) => entry.id);

      await Promise.all(
        unreadIds.map((notificationId) =>
          communityService.markCommunityNotificationRead(notificationId),
        ),
      );
      setActivity((current) =>
        current.map((entry) => ({
          ...entry,
          isRead: true,
        })),
      );
      setActivityUnreadCount(0);
      toast.success("Activity marked as read");
    } catch {
      toast.error("Failed to mark activity as read");
    } finally {
      setIsMarkingActivityRead(false);
    }
  }, [activity, activityUnreadCount, isMarkingActivityRead]);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    void loadActivity();
  }, [loadActivity]);

  useEffect(() => {
    const socket = getCommunitySocket();

    const refreshFeed = () => {
      void loadFeed(1, false);
      void loadActivity();
    };

    const handleNotificationEvent = () => {
      void loadActivity();
    };

    socket.on("community:qnaPostCreated", refreshFeed);
    socket.on("community:qnaPostUpdated", refreshFeed);
    socket.on("community:qnaPostDeleted", refreshFeed);
    socket.on("community:qnaAnswerCreated", refreshFeed);
    socket.on("community:qnaAnswerDeleted", refreshFeed);
    socket.on("community:qnaVoteUpdated", refreshFeed);
    socket.on("notification:new", handleNotificationEvent);

    if (!socket.connected) {
      socket.connect();
    }

    return () => {
      socket.off("community:qnaPostCreated", refreshFeed);
      socket.off("community:qnaPostUpdated", refreshFeed);
      socket.off("community:qnaPostDeleted", refreshFeed);
      socket.off("community:qnaAnswerCreated", refreshFeed);
      socket.off("community:qnaAnswerDeleted", refreshFeed);
      socket.off("community:qnaVoteUpdated", refreshFeed);
      socket.off("notification:new", handleNotificationEvent);
    };
  }, [loadFeed, loadActivity]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setQ(searchInput.trim());
    }, 260);

    return () => clearTimeout(handle);
  }, [searchInput]);

  useEffect(() => {
    const followed = communityFollowStore
      .getByKind("topic")
      .map((item) => item.id.toLowerCase());
    setFollowedTopics(followed);
  }, []);

  useEffect(() => {
    if (!isUrlHydrated) {
      return;
    }

    const currentQ = (urlSearchParams.get("q") || "").trim();
    const currentTag = (urlSearchParams.get("tag") || "").trim();
    const currentSport = (urlSearchParams.get("sport") || "").trim();
    const currentCity = (urlSearchParams.get("city") || "").trim();
    const currentSort = (urlSearchParams.get("sort") || "").toUpperCase();
    const currentDirection = (
      urlSearchParams.get("dir") || ""
    ).toUpperCase();
    const currentMine = urlSearchParams.get("mine") === "1" ? "MINE" : "ALL";

    const desiredQ = q.trim();
    const desiredTag = activeTag.trim();
    const desiredSport = selectedSports.join(",");
    const desiredCity = selectedCities.join(",");
    const desiredSort = sort;
    const desiredDirection = direction;
    const desiredMine = viewMode;

    if (
      currentQ === desiredQ &&
      currentTag === desiredTag &&
      currentSport === desiredSport &&
      currentCity === desiredCity &&
      (currentSort || "NEW") === desiredSort &&
      (currentDirection || "DESC") === desiredDirection &&
      currentMine === desiredMine
    ) {
      return;
    }

    const nextParams = new URLSearchParams();
    if (desiredQ) nextParams.set("q", desiredQ);
    if (desiredTag) nextParams.set("tag", desiredTag);
    if (desiredSport) nextParams.set("sport", desiredSport);
    if (desiredCity) nextParams.set("city", desiredCity);
    if (desiredSort !== "NEW") nextParams.set("sort", desiredSort);
    if (desiredDirection !== "DESC") nextParams.set("dir", desiredDirection);
    if (desiredMine === "MINE") nextParams.set("mine", "1");

    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }, [
    activeTag,
    selectedCities,
    isUrlHydrated,
    pathname,
    q,
    router,
    sort,
    direction,
    selectedSports,
    urlSearchParams,
    viewMode,
  ]);

  const handleQuestionSuccess = async () => {
    toast.success("Question posted");
    await loadFeed(1, false);
    await loadActivity();
  };

  const loadMore = async () => {
    if (!hasMore || isLoadingMore) {
      return;
    }

    await loadFeed(page + 1, true);
  };

  const togglePostStatus = async (post: CommunityPost) => {
    const nextStatus = post.status === "OPEN" ? "CLOSED" : "OPEN";
    await postMutations.mutate(post.id, {
      action: "toggle",
      nextStatus,
    });
  };

  const deletePost = async (post: CommunityPost) => {
    void postMutations.mutate(post.id, { action: "delete" });
  };

  const vote = async (post: CommunityPost, value: 1 | -1) => {
    await voting.mutate(post.id, { value });
  };

  const summary = useMemo(
    () => ({
      points: reputation?.totalPoints || 0,
      q: reputation?.questionCount || 0,
      a: reputation?.answerCount || 0,
      upvotes: reputation?.receivedUpvotes || 0,
    }),
    [reputation],
  );

  const spotlight = useMemo(() => {
    const unansweredCount = posts.filter(
      (post) => post.answerCount === 0,
    ).length;
    const answeredCount = posts.length - unansweredCount;
    const tagCounts = new Map<string, number>();

    for (const post of posts) {
      for (const tag of post.tags) {
        const normalizedTag = tag.trim();
        if (!normalizedTag) continue;
        tagCounts.set(normalizedTag, (tagCounts.get(normalizedTag) || 0) + 1);
      }
    }

    const popularTags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([tag]) => tag);

    return {
      unansweredCount,
      answeredCount,
      popularTags,
    };
  }, [posts]);

  const featuredPost = useMemo(() => {
    if (!posts.length) {
      return null;
    }

    // Blend recency, traction, and unanswered urgency for a smarter hero pick.
    const scored = posts.map((post) => {
      const ageInHours =
        Math.max(1, Date.now() - new Date(post.createdAt).getTime()) / 3600000;
      const recencyWeight = Math.max(1, 24 / ageInHours);
      const unresolvedBoost = post.answerCount === 0 ? 2.5 : 0;
      const score =
        post.voteScore * 3 +
        post.answerCount * 1.7 +
        post.upvoteCount * 0.8 +
        recencyWeight +
        unresolvedBoost;

      return { post, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.post || null;
  }, [posts]);

  const nonFeaturedPosts = useMemo(
    () => posts.filter((post) => post.id !== featuredPost?.id),
    [posts, featuredPost?.id],
  );

  const urgentUnanswered = useMemo(
    () =>
      nonFeaturedPosts
        .filter((post) => post.answerCount === 0)
        .sort((a, b) => b.voteScore - a.voteScore)
        .slice(0, 3),
    [nonFeaturedPosts],
  );

  const toggleSport = (sport: string) => {
    setSelectedSports((current) =>
      current.includes(sport)
        ? current.filter((item) => item !== sport)
        : [...current, sport],
    );
  };

  const toggleCity = (city: string) => {
    setSelectedCities((current) =>
      current.includes(city)
        ? current.filter((item) => item !== city)
        : [...current, city],
    );
  };

  const hasActiveFilters =
    selectedSports.length > 0 ||
    selectedCities.length > 0 ||
    Boolean(categoryFilter) ||
    Boolean(activeTag) ||
    Boolean(q);

  const clearAllFilters = () => {
    setSelectedSports([]);
    setSelectedCities([]);
    setCategoryFilter("");
    setActiveTag("");
    setQ("");
    setSearchInput("");
  };

  const categoryOptions = useMemo(
    () => [
      { value: "", label: "All Categories" },
      ...COMMUNITY_POST_CATEGORIES.map((cat) => ({ value: cat, label: cat })),
    ],
    [],
  );

  const topicOptions = useMemo(
    () => [
      { value: "", label: "All Topics" },
      ...spotlight.popularTags.map((tag) => ({ value: tag, label: `#${tag}` })),
    ],
    [spotlight.popularTags],
  );

  const toggleTopicFollow = (topic: string) => {
    const normalized = topic.trim().toLowerCase();
    if (!normalized) {
      return;
    }

    const result = communityFollowStore.toggle({
      kind: "topic",
      id: normalized,
      label: `#${topic}`,
      href: `/q?tag=${encodeURIComponent(normalized)}`,
    });

    setFollowedTopics(
      communityFollowStore.getByKind("topic").map((item) => item.id),
    );
    toast.success(
      result.following ? `Following #${topic}` : `Unfollowed #${topic}`,
    );
  };

  return (
    <div className="relative isolate min-h-[calc(100vh-5.5rem)] bg-[linear-gradient(180deg,#eef4ff_0%,#f4f8ff_42%,#fff6e9_100%)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute left-[-12%] top-[-8%] h-136 w-136 rounded-full bg-sky-300/30 blur-3xl" />
        <div className="absolute right-[-16%] top-[14%] h-124 w-124 rounded-full bg-amber-200/28 blur-3xl" />
        <div className="absolute left-[24%] top-[48%] h-64 w-64 rounded-full bg-indigo-200/18 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.14)_1px,transparent_1px)] bg-size-[42px_42px] opacity-40" />
      </div>

      <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-5 sm:space-y-6 sm:px-6 sm:py-8 lg:px-8">
        <motion.section
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: "easeOut" }}
          className="relative overflow-hidden rounded-3xl border border-white/80 bg-[linear-gradient(125deg,#fafdff_0%,#eaf4ff_36%,#fff1dc_100%)] px-4 py-8 text-slate-900 shadow-sm sm:rounded-4xl sm:px-10 sm:py-14"
        >
          <motion.div
            aria-hidden="true"
            animate={{ x: [0, -10, 0], y: [0, 10, 0] }}
            transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sky-300/25 blur-3xl"
          />
          <motion.div
            aria-hidden="true"
            animate={{ x: [0, 12, 0], y: [0, -8, 0] }}
            transition={{ duration: 17, repeat: Infinity, ease: "easeInOut" }}
            className="pointer-events-none absolute -bottom-24 left-0 h-72 w-72 rounded-full bg-amber-200/30 blur-3xl"
          />

          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-3xl">
              <p className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                <Sparkles size={12} className="text-power-orange" />
                Community Knowledge Exchange
              </p>
              <h1 className="font-title mt-4 text-3xl font-semibold leading-[1.08] tracking-tight sm:text-4xl lg:text-5xl">
                Ask Better Questions. Share Better Answers.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-relaxed text-slate-700 sm:text-base">
                A player-to-player learning space where practical advice wins.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-end sm:gap-3">
              <Link
                href="/contributors"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white/85 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
              >
                <Trophy size={16} className="text-amber-500" />
                Leaderboard
              </Link>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setShowAskForm((v) => !v)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
              >
                <Plus size={16} />
                Ask Question
              </motion.button>
            </div>
          </div>
        </motion.section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)]">
          <div className="space-y-6">
            <AskQuestionModal
              isOpen={showAskForm}
              onClose={() => setShowAskForm(false)}
              onSuccess={() => void handleQuestionSuccess()}
            />

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              {/* Row 1: View toggle + Search + Filter button */}
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
                <div className="inline-flex items-center self-start rounded-xl border border-slate-200 bg-slate-50 p-1 shrink-0">
                  <button
                    onClick={() => setViewMode("ALL")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                      viewMode === "ALL"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-600 hover:bg-white"
                    }`}
                  >
                    All Threads
                  </button>
                  <button
                    onClick={() => setViewMode("MINE")}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                      viewMode === "MINE"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-600 hover:bg-white"
                    }`}
                  >
                    My Posts
                  </button>
                </div>

                <div className="flex flex-1 items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 transition focus-within:border-power-orange focus-within:bg-white focus-within:shadow-sm">
                  <Search size={16} className="shrink-0 text-slate-500" />
                  <input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Search questions, keywords, topics…"
                    className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none"
                  />
                  <AnimatePresence>
                    {searchInput ? (
                      <motion.button
                        initial={{ opacity: 0, scale: 0.6 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.6 }}
                        onClick={() => {
                          setSearchInput("");
                          setQ("");
                        }}
                        className="shrink-0 rounded-full p-0.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600"
                        title="Clear search"
                      >
                        <X size={14} />
                      </motion.button>
                    ) : null}
                  </AnimatePresence>
                </div>

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setShowFilterPanel((v) => !v)}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide transition ${
                    showFilterPanel || hasActiveFilters
                      ? "border-power-orange/50 bg-power-orange/10 text-power-orange"
                      : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-white"
                  }`}
                >
                  <motion.span
                    animate={showFilterPanel ? { rotate: 180 } : { rotate: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <Filter size={16} />
                  </motion.span>
                  <span className="hidden sm:inline">Filters</span>
                  {hasActiveFilters && (
                    <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-power-orange px-1 text-[9px] font-bold text-white">
                      {selectedSports.length +
                        selectedCities.length +
                        (categoryFilter ? 1 : 0) +
                        (activeTag ? 1 : 0)}
                    </span>
                  )}
                </motion.button>
              </div>

              {/* Row 2: Quick filter capsules */}
              <div className="mt-4 flex flex-wrap items-center gap-1.5">
                {QUICK_FILTERS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setSort(option.value)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition ${
                      sort === option.value
                        ? "border-power-orange/50 bg-power-orange/10 text-power-orange"
                        : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-white"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {/* Collapsible advanced filter panel */}
              <AnimatePresence onExitComplete={() => setFilterPanelSettled(false)}>
                {showFilterPanel && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                    animate={{ opacity: 1, height: "auto", marginTop: 12 }}
                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                    transition={{ type: "spring", damping: 26, stiffness: 300 }}
                    onAnimationComplete={() => setFilterPanelSettled(true)}
                    className={filterPanelSettled ? "overflow-visible" : "overflow-hidden"}
                  >
                    <div className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
                      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                        <SelectDropdown
                          label="Sort"
                          icon={<SlidersHorizontal size={14} className="text-slate-500" />}
                          options={SORT_DIRECTION_OPTIONS}
                          value={direction}
                          onChange={(value) =>
                            setDirection(value as CommunityFeedSortDirection)
                          }
                        />
                        <MultiCheckboxDropdown
                          label="Sport"
                          icon={<Dumbbell size={15} className="text-blue-500" />}
                          options={sportOptions}
                          selected={selectedSports}
                          onToggle={toggleSport}
                          emptyHint="No sports tagged yet"
                        />
                        <MultiCheckboxDropdown
                          label="City"
                          icon={<MapPin size={15} className="text-rose-500" />}
                          options={cityOptions}
                          selected={selectedCities}
                          onToggle={toggleCity}
                          emptyHint="No cities tagged yet"
                        />
                      </div>
                      <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                        <SelectDropdown
                          label="Category"
                          options={categoryOptions}
                          value={categoryFilter}
                          onChange={setCategoryFilter}
                        />
                        <SelectDropdown
                          label="Topic"
                          options={topicOptions}
                          value={activeTag}
                          onChange={setActiveTag}
                          renderSuffix={(value) =>
                            value ? (
                              <button
                                type="button"
                                onClick={() => toggleTopicFollow(value)}
                                className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${
                                  followedTopics.includes(value.toLowerCase())
                                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                                    : "border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                                }`}
                              >
                                {followedTopics.includes(value.toLowerCase())
                                  ? "Following"
                                  : "Follow"}
                              </button>
                            ) : null
                          }
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Active filter capsules + Clear all */}
              {hasActiveFilters ? (
                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    Active
                  </span>
                  {categoryFilter ? (
                    <FilterCapsule
                      label={categoryFilter}
                      onRemove={() => setCategoryFilter("")}
                      tone="violet"
                    />
                  ) : null}
                  {activeTag ? (
                    <FilterCapsule
                      label={`#${activeTag}`}
                      onRemove={() => setActiveTag("")}
                      tone="orange"
                    />
                  ) : null}
                  {selectedSports.map((sport) => (
                    <FilterCapsule
                      key={`sport-${sport}`}
                      label={sport}
                      onRemove={() => toggleSport(sport)}
                      tone="blue"
                    />
                  ))}
                  {selectedCities.map((city) => (
                    <FilterCapsule
                      key={`city-${city}`}
                      label={city}
                      onRemove={() => toggleCity(city)}
                      tone="rose"
                    />
                  ))}
                  {q ? (
                    <FilterCapsule
                      label={`“${q}”`}
                      onRemove={() => {
                        setSearchInput("");
                        setQ("");
                      }}
                      tone="slate"
                    />
                  ) : null}
                  <button
                    onClick={clearAllFilters}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-semibold text-red-600 transition hover:bg-red-100"
                  >
                    <Trash2 size={13} />
                    Clear all
                  </button>
                </div>
              ) : null}
            </section>

            {isLoading ? (
              <div className="rounded-3xl border border-white/90 bg-white/90 p-12 text-center text-slate-500 shadow-sm backdrop-blur-md">
                Loading questions...
              </div>
            ) : posts.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border bg-white/82 p-12 text-center text-slate-600 shadow-sm backdrop-blur-sm">
                {viewMode === "MINE"
                  ? "You have not posted a question yet. Start your first knowledge thread."
                  : "No knowledge threads found. Start one and invite answers."}
              </div>
            ) : (
              <section className="space-y-4">
                {featuredPost ? (
                  <article className="group relative flex gap-0 overflow-hidden rounded-xl border-2 border-power-orange/30 bg-linear-to-br from-power-orange/5 via-white to-white shadow-lg transition-all hover:border-power-orange/50 hover:shadow-xl">
                    {/* Voting Sidebar */}
                    <div className="flex w-16 shrink-0 flex-col items-center gap-0.5 border-r-2 border-power-orange/20 bg-power-orange/5 px-2.5 py-4 group-hover:bg-power-orange/10">
                      <button
                        onClick={() => void vote(featuredPost, 1)}
                        disabled={voting.isLoading(featuredPost.id)}
                        className={`rounded-md p-1.5 transition-colors ${
                          featuredPost.myVote === 1
                            ? "bg-orange-100 text-power-orange"
                            : "text-slate-400 hover:text-power-orange"
                        } disabled:opacity-50`}
                        title="Upvote"
                      >
                        <ArrowBigUp size={18} />
                      </button>
                      <span className="text-xs font-bold text-slate-700">
                        {featuredPost.voteScore}
                      </span>
                      <button
                        onClick={() => void vote(featuredPost, -1)}
                        disabled={voting.isLoading(featuredPost.id)}
                        className={`rounded-md p-1.5 transition-colors ${
                          featuredPost.myVote === -1
                            ? "bg-red-100 text-red-600"
                            : "text-slate-400 hover:text-red-600"
                        } disabled:opacity-50`}
                        title="Downvote"
                      >
                        <ArrowBigDown size={18} />
                      </button>
                    </div>

                    {/* Featured Content */}
                    <div className="flex-1 p-5 sm:p-6">
                      <div className="inline-flex gap-2 items-center rounded-full border-2 border-power-orange/30 bg-power-orange/10 px-3 py-1.5 mb-3">
                        <Trophy
                          size={14}
                          className="text-power-orange font-bold"
                        />
                        <span className="text-xs font-bold uppercase tracking-wide text-power-orange">
                          Featured Thread
                        </span>
                      </div>

                      <Link
                        href={`/q/${featuredPost.id}`}
                        className="block font-title text-2xl font-bold leading-tight text-slate-900 transition-colors hover:text-power-orange"
                      >
                        {featuredPost.title}
                      </Link>

                      <p className="mt-2.5 line-clamp-3 text-sm leading-relaxed text-slate-700">
                        {featuredPost.body}
                      </p>

                      {/* Tags */}
                      <div className="mt-4 flex flex-wrap items-center gap-2">
                        {featuredPost.tags.map((tag) => (
                          <span
                            key={`${featuredPost.id}-${tag}`}
                            className="inline-flex rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                          >
                            {tag}
                          </span>
                        ))}
                        {featuredPost.sport ? (
                          <span className="inline-flex rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                            {featuredPost.sport}
                          </span>
                        ) : null}
                        {featuredPost.city ? (
                          <span className="inline-flex rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                            {featuredPost.city}
                          </span>
                        ) : null}
                      </div>

                      {/* Footer */}
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/50 pt-4">
                        <div className="flex items-center gap-2 text-xs text-slate-600">
                          <AuthorAvatar author={featuredPost.isAnonymous ? { displayName: "Anonymous", photoUrl: null } : featuredPost.author} size={32} />
                          <span className="font-semibold text-slate-900">
                            {featuredPost.isAnonymous ? "Anonymous" : featuredPost.author.displayName}
                          </span>
                          {featuredPost.author.isVerifiedExpert ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                              ★{" "}
                              {featuredPost.author.expertTitle ||
                                "Verified Coach"}
                            </span>
                          ) : null}
                          <span className="inline-flex items-center gap-1 text-slate-500">
                            <CalendarDays
                              size={12}
                              className="text-slate-400"
                            />
                            {formatPostedDate(featuredPost.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                            <MessageCircle size={13} />{" "}
                            {featuredPost.answerCount}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                            <Trophy size={13} /> {featuredPost.upvoteCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                ) : null}

                <div className="space-y-2">
                  {nonFeaturedPosts.map((post) => {
                    return (
                      <article
                        key={post.id}
                        className="group relative flex gap-0 overflow-hidden rounded-lg border border-slate-200 bg-white transition-all hover:border-slate-300 hover:shadow-md"
                      >
                        {/* Voting Sidebar - Reddit Style */}
                        <div className="flex w-16 shrink-0 flex-col items-center gap-0.5 border-r border-slate-200 bg-slate-50 px-2.5 py-3 group-hover:bg-slate-100">
                          <button
                            onClick={() => void vote(post, 1)}
                            disabled={voting.isLoading(post.id)}
                            title="Upvote"
                            className={`rounded-md p-1.5 transition-colors ${
                              post.myVote === 1
                                ? "bg-orange-100 text-power-orange"
                                : "text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                            } disabled:opacity-50`}
                          >
                            <ArrowBigUp size={16} />
                          </button>
                          <span className="text-xs font-bold text-slate-700">
                            {post.voteScore}
                          </span>
                          <button
                            onClick={() => void vote(post, -1)}
                            disabled={voting.isLoading(post.id)}
                            title="Downvote"
                            className={`rounded-md p-1.5 transition-colors ${
                              post.myVote === -1
                                ? "bg-red-100 text-red-600"
                                : "text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                            } disabled:opacity-50`}
                          >
                            <ArrowBigDown size={16} />
                          </button>
                        </div>

                        {/* Main Content Area */}
                        <div className="flex-1 overflow-hidden p-4 sm:p-5">
                          {/* Title */}
                          <Link
                            href={`/q/${post.id}`}
                            className="block font-title text-lg font-semibold text-slate-900 transition-colors hover:text-power-orange"
                          >
                            {post.title}
                          </Link>

                          {/* Excerpt */}
                          <p className="mt-1.5 line-clamp-2 text-sm text-slate-600">
                            {post.body}
                          </p>

                          {/* Tags & Status */}
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            {post.category && post.category !== "General" ? (
                              <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
                                {post.category}
                              </span>
                            ) : null}
                            {post.tags.map((tag) => (
                              <span
                                key={`${post.id}-${tag}`}
                                className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100"
                              >
                                {tag}
                              </span>
                            ))}
                            {post.sport ? (
                              <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
                                {post.sport}
                              </span>
                            ) : null}
                            {post.city ? (
                              <span className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                                {post.city}
                              </span>
                            ) : null}
                            {post.status === "CLOSED" ? (
                              <span className="inline-flex rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                                Closed
                              </span>
                            ) : null}
                          </div>

                          {/* Footer - Metadata & Actions */}
                          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <AuthorAvatar author={post.isAnonymous ? { displayName: "Anonymous", photoUrl: null } : post.author} size={26} />
                              <span className="font-medium text-slate-700">
                                {post.isAnonymous ? "Anonymous" : post.author.displayName}
                              </span>
                              {post.author.isVerifiedExpert ? (
                                <span className="inline-flex items-center gap-0.5 rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">
                                  ★{" "}
                                  {post.author.expertTitle || "Verified Coach"}
                                </span>
                              ) : null}
                              <span className="inline-flex items-center gap-1 text-slate-400">
                                <CalendarDays size={12} />
                                {formatPostedDate(post.createdAt)}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                                <MessageCircle size={13} /> {post.answerCount}
                              </span>
                              <span className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">
                                <Trophy size={13} /> {post.upvoteCount}
                              </span>
                              {post.answerCount === 0 ? (
                                <span className="inline-flex rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                                  Unanswered
                                </span>
                              ) : (
                                <span className="inline-flex rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                  Answered
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Owner Actions */}
                          {post.author.id === currentUserId ? (
                            <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                              <button
                                onClick={() => void togglePostStatus(post)}
                                disabled={postMutations.isLoading(post.id)}
                                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50"
                              >
                                {post.status === "OPEN" ? "Close" : "Reopen"}
                              </button>
                              <button
                                onClick={() => void deletePost(post)}
                                disabled={postMutations.isLoading(post.id)}
                                className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 hover:border-red-300 disabled:opacity-50"
                              >
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </div>
                      </article>
                    );
                  })}
                </div>

                {hasMore ? (
                  <div className="pt-2 text-center">
                    <button
                      onClick={() => void loadMore()}
                      disabled={isLoadingMore}
                      className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                    >
                      {isLoadingMore ? (
                        <>
                          <LoaderCircle size={15} className="animate-spin" />
                          Loading...
                        </>
                      ) : (
                        "Load more questions"
                      )}
                    </button>
                  </div>
                ) : null}
              </section>
            )}
          </div>

          <aside className="space-y-4 xl:sticky xl:top-24 xl:h-fit">
            {/* Stat tiles — 2x2 grid */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="grid grid-cols-2 gap-3"
            >
              {[
                { label: "Total Points", value: summary.points },
                { label: "Questions", value: summary.q },
                { label: "Answers", value: summary.a },
                { label: "Received Upvotes", value: summary.upvotes },
              ].map((stat) => (
                <motion.div
                  key={stat.label}
                  whileHover={{ y: -3 }}
                  transition={{ duration: 0.18 }}
                  className="rounded-2xl border border-white/85 bg-white/92 p-4 shadow-sm backdrop-blur-sm"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    {stat.label}
                  </p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {stat.value}
                  </p>
                </motion.div>
              ))}
            </motion.section>

            {/* Your Activity — scrollable feed */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
              className="rounded-3xl border border-white/90 bg-white/90 p-4 shadow-sm backdrop-blur-md sm:p-5"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="font-title text-lg font-semibold text-slate-900">
                  Your Activity
                </h3>
                <div className="flex items-center gap-2">
                  <AnimatePresence>
                    {activityUnreadCount > 0 ? (
                      <motion.span
                        initial={{ opacity: 0, scale: 0.7 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.7 }}
                        className="rounded-full bg-power-orange/10 px-2.5 py-1 text-[11px] font-semibold text-power-orange"
                      >
                        {activityUnreadCount} unread
                      </motion.span>
                    ) : null}
                  </AnimatePresence>
                  <button
                    onClick={() => void handleMarkAllActivityRead()}
                    disabled={
                      activityUnreadCount === 0 || isMarkingActivityRead
                    }
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isMarkingActivityRead ? "Marking..." : "Mark all read"}
                  </button>
                </div>
              </div>

              {isLoadingActivity ? (
                <p className="text-sm text-slate-500">Loading activity...</p>
              ) : activity.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No recent activity yet. When players answer or upvote your
                  content, it will show up here.
                </p>
              ) : (
                <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
                  <AnimatePresence initial={false}>
                    {activity.map((item) => {
                      const postLink = item.data?.postId
                        ? `/q/${item.data.postId}`
                        : null;

                      return (
                        <motion.div
                          key={item.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className={`rounded-2xl border p-3 ${
                            item.isRead
                              ? "border-slate-200 bg-white"
                              : "border-power-orange/30 bg-power-orange/5"
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              {getActivityLabel(item)}
                            </p>
                            <span className="text-xs text-slate-500">
                              {toRelativeTime(item.createdAt)} ago
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-slate-700">
                            {item.message}
                          </p>
                          {postLink ? (
                            <Link
                              href={postLink}
                              onClick={() => {
                                void handleActivityOpen(item);
                              }}
                              className="mt-2 inline-flex text-xs font-semibold text-power-orange hover:underline"
                            >
                              Open thread
                            </Link>
                          ) : null}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </motion.section>

            {/* Help Needed Now — highlighted, urgent */}
            <AnimatePresence>
              {urgentUnanswered.length > 0 ? (
                <motion.section
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
                  className="relative overflow-hidden rounded-3xl border-2 border-amber-300/70 bg-[linear-gradient(135deg,#fff9ed_0%,#fff2d8_100%)] p-4 shadow-md sm:p-5"
                >
                  <motion.div
                    aria-hidden="true"
                    animate={{ opacity: [0.25, 0.5, 0.25] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-amber-300/30 blur-2xl"
                  />
                  <div className="relative mb-2 flex items-center gap-1.5">
                    <motion.span
                      animate={{ scale: [1, 1.15, 1] }}
                      transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-400/25 text-amber-700"
                    >
                      <AlertTriangle size={13} />
                    </motion.span>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-amber-800">
                      Help Needed Now
                    </p>
                  </div>
                  <div className="relative space-y-2">
                    {urgentUnanswered.map((item) => (
                      <Link
                        key={`urgent-${item.id}`}
                        href={`/q/${item.id}`}
                        className="block rounded-xl border border-amber-200/70 bg-white/90 px-3 py-2 text-sm font-medium text-slate-800 transition hover:-translate-y-0.5 hover:border-amber-300 hover:bg-white hover:shadow-sm"
                      >
                        <span className="line-clamp-1">{item.title}</span>
                        <span className="mt-1 inline-flex items-center gap-2 text-xs font-semibold text-amber-700">
                          <MessageCircle size={12} /> 0 answers
                        </span>
                      </Link>
                    ))}
                  </div>
                </motion.section>
              ) : null}
            </AnimatePresence>

            {/* Knowledge Opportunities + Solved Discussions */}
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <motion.div
                whileHover={{ y: -3 }}
                className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  Knowledge Opportunities
                </p>
                <p className="mt-1 text-sm text-blue-900">
                  {spotlight.unansweredCount} questions still need helpful
                  answers.
                </p>
              </motion.div>
              <motion.div
                whileHover={{ y: -3 }}
                className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Solved Discussions
                </p>
                <p className="mt-1 text-sm text-emerald-900">
                  {spotlight.answeredCount} questions already have shared
                  solutions.
                </p>
              </motion.div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
