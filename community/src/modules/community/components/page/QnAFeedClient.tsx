"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  ArrowBigDown,
  ArrowBigUp,
  CheckCircle2,
  MessageCircle,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
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
import { hasAuthToken } from "@/lib/auth/token";
import { getCommunitySocket, QNA_FEED_ROOM, subscribeToCommunityRoom } from "@/lib/realtime/socket";
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

/** A removable filter, in ink on a hairline outline. One look for every kind
 *  of filter: colour here used to code the kind, which only added noise. */
function FilterCapsule({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="border-ink/30 text-ink inline-flex min-h-9 items-center gap-1 rounded-md border pl-3 text-sm font-medium">
      <span className="max-w-[10rem] truncate">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        className="hover:bg-paper-deep flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-200"
        aria-label={`Remove ${label}`}
      >
        <X size={14} aria-hidden="true" />
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
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [activity, setActivity] = useState<CommunityActivityItem[]>([]);
  const [activityUnreadCount, setActivityUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [reputation, setReputation] = useState<CommunityReputationSummary | null>(null);

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
              : item
          )
        );
        void loadActivity();
      },
      onError: (postId, error) => {
        toast.error(error.message || "Failed to vote");
      },
    }
  );

  // Post edit/delete mutation state - replaces isMutatingPostId for close/open/delete
  const postMutations = useMutationState(
    async (
      postId: string,
      payload: { action: "toggle" | "delete"; nextStatus?: "OPEN" | "CLOSED" }
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
            current.map((item) => (item.id === postId ? { ...item, status: result.status } : item))
          );
          toast.success(`Question ${payload.nextStatus === "OPEN" ? "reopened" : "closed"}`);
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
    }
  );
  const [sort, setSort] = useState<CommunityFeedSort>("NEW");
  const [direction, setDirection] = useState<CommunityFeedSortDirection>("DESC");
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [activeTag, setActiveTag] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [sportOptions, setSportOptions] = useState<string[]>([]);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [showAskForm, setShowAskForm] = useState(false);
  // Honour prefers-reduced-motion: the hero blobs loop forever otherwise.
  const reduceMotion = useReducedMotion();
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
      sortParam === "TOP" || sortParam === "UNANSWERED" || sortParam === "ANSWERED"
        ? sortParam
        : "NEW";
    const nextDirection: CommunityFeedSortDirection = dirParam === "ASC" ? "ASC" : "DESC";

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
      // Arriving signed out would open a form that can only fail on submit,
      // after the parent has typed the whole question. The login round trip
      // keeps the full URL, so they land back here with the form open.
      if (!hasAuthToken()) {
        redirectToMainLogin();
        return;
      }
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

        const authed = hasAuthToken();
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
          authed ? communityService.getMyReputation() : Promise.resolve(null),
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
        toast.error(error instanceof Error ? error.message : "Failed to load feed");
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [sort, direction, q, activeTag, selectedSports, selectedCities, categoryFilter, viewMode]
  );

  const loadActivity = useCallback(async () => {
    if (!hasAuthToken()) {
      setActivity([]);
      setActivityUnreadCount(0);
      return;
    }
    try {
      setIsLoadingActivity(true);
      const items = await communityService.listMyKnowledgeActivity(20);
      setActivity(items);
      setActivityUnreadCount(items.reduce((count, item) => (item.isRead ? count : count + 1), 0));
    } catch {
      setActivity([]);
      setActivityUnreadCount(0);
    } finally {
      setIsLoadingActivity(false);
    }
  }, []);

  const handleActivityOpen = useCallback(async (item: CommunityActivityItem) => {
    if (item.isRead) {
      return;
    }

    try {
      await communityService.markCommunityNotificationRead(item.id);
      setActivity((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, isRead: true } : entry))
      );
      setActivityUnreadCount((count) => Math.max(0, count - 1));
    } catch {
      // Keep navigation responsive even if read status update fails.
    }
  }, []);

  const handleMarkAllActivityRead = useCallback(async () => {
    if (!activityUnreadCount || isMarkingActivityRead) {
      return;
    }

    try {
      setIsMarkingActivityRead(true);
      const unreadIds = activity.filter((entry) => !entry.isRead).map((entry) => entry.id);

      await Promise.all(
        unreadIds.map((notificationId) =>
          communityService.markCommunityNotificationRead(notificationId)
        )
      );
      setActivity((current) =>
        current.map((entry) => ({
          ...entry,
          isRead: true,
        }))
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

  // This feed is a shareable public page — resolve who's viewing it (if
  // anyone) without gating render on it, so "mine"/owner actions still work
  // for a logged-in visitor without blocking guests.
  useEffect(() => {
    if (!hasAuthToken()) return;
    communityService
      .ensureSession()
      .then((session) => setCurrentUserId(session.id))
      .catch(() => {});
  }, []);

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
    socket.on("community:qnaAnswerAccepted", refreshFeed);
    socket.on("notification:new", handleNotificationEvent);

    const unsubscribe = subscribeToCommunityRoom(QNA_FEED_ROOM);

    return () => {
      unsubscribe();
      socket.off("community:qnaPostCreated", refreshFeed);
      socket.off("community:qnaPostUpdated", refreshFeed);
      socket.off("community:qnaPostDeleted", refreshFeed);
      socket.off("community:qnaAnswerCreated", refreshFeed);
      socket.off("community:qnaAnswerDeleted", refreshFeed);
      socket.off("community:qnaVoteUpdated", refreshFeed);
      socket.off("community:qnaAnswerAccepted", refreshFeed);
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
    let cancelled = false;
    void communityFollowStore.getIdsByKind("TOPIC").then((ids) => {
      if (!cancelled) {
        setFollowedTopics(ids);
      }
    });
    return () => {
      cancelled = true;
    };
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
    const currentDirection = (urlSearchParams.get("dir") || "").toUpperCase();
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
    if (!hasAuthToken()) {
      redirectToMainLogin();
      return;
    }
    await voting.mutate(post.id, { value });
  };

  const summary = useMemo(
    () => ({
      points: reputation?.totalPoints || 0,
      q: reputation?.questionCount || 0,
      a: reputation?.answerCount || 0,
      upvotes: reputation?.receivedUpvotes || 0,
    }),
    [reputation]
  );

  const spotlight = useMemo(() => {
    const unansweredCount = posts.filter((post) => post.answerCount === 0).length;
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
      const ageInHours = Math.max(1, Date.now() - new Date(post.createdAt).getTime()) / 3600000;
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
    [posts, featuredPost?.id]
  );

  const urgentUnanswered = useMemo(
    () =>
      nonFeaturedPosts
        .filter((post) => post.answerCount === 0)
        .sort((a, b) => b.voteScore - a.voteScore)
        .slice(0, 3),
    [nonFeaturedPosts]
  );

  const toggleSport = (sport: string) => {
    setSelectedSports((current) =>
      current.includes(sport) ? current.filter((item) => item !== sport) : [...current, sport]
    );
  };

  const toggleCity = (city: string) => {
    setSelectedCities((current) =>
      current.includes(city) ? current.filter((item) => item !== city) : [...current, city]
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
    []
  );

  const topicOptions = useMemo(
    () => [
      { value: "", label: "All Topics" },
      ...spotlight.popularTags.map((tag) => ({ value: tag, label: `#${tag}` })),
    ],
    [spotlight.popularTags]
  );

  const toggleTopicFollow = async (topic: string) => {
    const normalized = topic.trim().toLowerCase();
    if (!normalized) {
      return;
    }

    // Following is a per-account action, so a guest gets the login redirect
    // rather than a silent no-op that looks like a broken button.
    if (!hasAuthToken()) {
      redirectToMainLogin();
      return;
    }

    try {
      const result = await communityFollowStore.toggle({
        kind: "TOPIC",
        targetId: normalized,
      });

      setFollowedTopics(await communityFollowStore.getIdsByKind("TOPIC"));
      toast.success(result.following ? `Following #${topic}` : `Unfollowed #${topic}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update follow");
    }
  };

  /** One thread as a ruled row: votes at the left, then a status line, serif
   *  title, excerpt and a byline. The featured thread is the same row on a
   *  wash tint with a larger title, so it reads as emphasis, not a new card. */
  const renderThread = (post: CommunityPost, featured = false, topRule = false) => {
    const authorName = post.isAnonymous ? "Anonymous" : post.author.displayName;
    const place = [post.sport, post.city].filter(Boolean).join(" · ");
    const isOwner = post.author.id === currentUserId;
    const voteBtn =
      "text-ink-muted hover:text-ink flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-200 hover:bg-white/70 disabled:opacity-50";

    return (
      <li key={post.id}>
        <article
          onClick={() => router.push(`/questions/${post.id}`)}
          className={`group flex cursor-pointer gap-4 transition-colors duration-200 sm:gap-6 ${
            featured
              ? "bg-wash my-6 rounded-3xl p-5 sm:p-8"
              : `border-hairline hover:bg-paper-deep/60 -mx-3 border-b px-3 py-7 ${topRule ? "border-t" : ""}`
          }`}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            className="flex w-9 shrink-0 flex-col items-center"
          >
            <button
              type="button"
              onClick={() => void vote(post, 1)}
              disabled={voting.isLoading(post.id)}
              aria-label="Upvote"
              aria-pressed={post.myVote === 1}
              className={`${voteBtn} ${post.myVote === 1 ? "text-power-orange-solid" : ""}`}
            >
              <ArrowBigUp
                size={20}
                strokeWidth={1.5}
                className={post.myVote === 1 ? "fill-power-orange" : ""}
              />
            </button>
            <span className="text-ink text-sm font-semibold tabular-nums">{post.voteScore}</span>
            <button
              type="button"
              onClick={() => void vote(post, -1)}
              disabled={voting.isLoading(post.id)}
              aria-label="Downvote"
              aria-pressed={post.myVote === -1}
              className={`${voteBtn} ${post.myVote === -1 ? "text-ink" : ""}`}
            >
              <ArrowBigDown
                size={20}
                strokeWidth={1.5}
                className={post.myVote === -1 ? "fill-ink" : ""}
              />
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-ink-muted text-sm">
              {featured ? <span className="text-ink font-semibold">Featured · </span> : null}
              {[
                place,
                post.category && post.category !== "General" ? post.category : "",
                post.status === "CLOSED" ? "Closed" : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>

            <Link
              href={`/questions/${post.id}`}
              className={`font-editorial text-ink decoration-ink/30 mt-2 block text-balance font-normal leading-tight underline-offset-4 group-hover:underline ${
                featured ? "text-3xl sm:text-4xl" : "text-2xl"
              }`}
            >
              {post.title}
            </Link>

            <p
              className={`text-ink-body mt-3 max-w-[64ch] text-base leading-relaxed ${
                featured ? "line-clamp-3" : "line-clamp-2"
              }`}
            >
              {post.body}
            </p>

            {post.tags.length > 0 ? (
              <p className="text-ink-muted mt-3 text-sm">
                {post.tags.map((tag) => `#${tag.replace(/^#/, "")}`).join("  ")}
              </p>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <div className="text-ink-body flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 text-sm">
                <AuthorAvatar
                  author={
                    post.isAnonymous ? { displayName: "Anonymous", photoUrl: null } : post.author
                  }
                  size={26}
                />
                <span className="text-ink font-semibold">{authorName}</span>
                {post.author.isVerifiedExpert ? (
                  <span className="text-ink-body">· {post.author.expertTitle} (verified)</span>
                ) : null}
                <span className="text-ink-muted">· {formatPostedDate(post.createdAt)}</span>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <span
                  className="text-ink-muted inline-flex items-center gap-1.5 tabular-nums"
                  title={`${post.answerCount} answers`}
                >
                  <MessageCircle size={15} strokeWidth={1.5} aria-hidden="true" />
                  {post.answerCount}
                </span>
                {post.answerCount === 0 ? (
                  <span className="text-power-orange-solid font-semibold">Needs an answer</span>
                ) : post.acceptedAnswerId ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-green-700">
                    <CheckCircle2 size={14} strokeWidth={1.5} aria-hidden="true" /> Solved
                  </span>
                ) : (
                  <span className="text-ink-muted">Answered</span>
                )}
              </div>
            </div>

            {isOwner ? (
              <div
                onClick={(event) => event.stopPropagation()}
                className="mt-4 flex gap-5 text-sm font-semibold"
              >
                <button
                  type="button"
                  onClick={() => void togglePostStatus(post)}
                  disabled={postMutations.isLoading(post.id)}
                  className="text-ink decoration-ink/30 hover:decoration-ink underline underline-offset-4 disabled:opacity-50"
                >
                  {post.status === "OPEN" ? "Close thread" : "Reopen thread"}
                </button>
                <button
                  type="button"
                  onClick={() => void deletePost(post)}
                  disabled={postMutations.isLoading(post.id)}
                  className="text-red-700 underline decoration-red-700/30 underline-offset-4 hover:decoration-red-700 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            ) : null}
          </div>
        </article>
      </li>
    );
  };

  return (
    <div className="bg-paper relative isolate min-h-[calc(100vh-5.5rem)]">
      <div className="mx-auto w-full max-w-7xl space-y-5 px-3 py-4 sm:space-y-6 sm:px-4 sm:py-6 lg:px-6">
        <section
          aria-labelledby="qna-hero-title"
          className="bg-paper-deep rounded-2xl px-5 py-8 sm:px-10 sm:py-12"
        >
          <p className="text-ink-body inline-flex items-center gap-1.5 text-sm font-medium">
            <Sparkles size={14} strokeWidth={1.5} aria-hidden="true" />
            Community knowledge exchange
          </p>
          <h1
            id="qna-hero-title"
            className="font-editorial text-ink mt-3 text-balance text-4xl font-light leading-[1.08] sm:text-5xl lg:text-6xl"
          >
            Ask better questions.{" "}
            <span className="text-ink-muted italic">Share better answers.</span>
          </h1>
          <p className="text-ink-body mt-4 max-w-[56ch] text-pretty text-base leading-relaxed sm:text-lg">
            Post what you are stuck on and get practical answers from parents who have solved it
            before.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            <button
              type="button"
              aria-haspopup="dialog"
              onClick={() => {
                if (!hasAuthToken()) {
                  redirectToMainLogin();
                  return;
                }
                setShowAskForm((v) => !v);
              }}
              className="btn-motion bg-power-orange-solid inline-flex min-h-12 items-center gap-2 rounded-md px-7 py-3.5 text-base font-semibold text-white hover:bg-indigo-700"
            >
              <Plus size={16} aria-hidden="true" />
              Ask a question
            </button>
            <Link
              href="/contributors"
              className="text-ink decoration-ink/30 hover:decoration-ink inline-flex items-center gap-2 text-base font-semibold underline underline-offset-4 transition-colors duration-200"
            >
              <Trophy size={16} strokeWidth={1.5} aria-hidden="true" />
              Leaderboard
            </Link>
          </div>
        </section>

        <div className="grid gap-12 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)]">
          <div className="space-y-8">
            <AskQuestionModal
              isOpen={showAskForm}
              onClose={() => setShowAskForm(false)}
              onSuccess={() => void handleQuestionSuccess()}
              initialTitle={(urlSearchParams.get("title") || "").trim() || undefined}
              initialSport={(urlSearchParams.get("sport") || "").trim() || undefined}
            />

            <section aria-label="Find a thread" className="space-y-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div
                  role="tablist"
                  aria-label="Threads"
                  className="border-hairline flex gap-8 border-b"
                >
                  {(
                    [
                      { mode: "ALL", label: "All threads" },
                      { mode: "MINE", label: "My posts" },
                    ] as const
                  ).map(({ mode, label }) => (
                    <button
                      key={mode}
                      type="button"
                      role="tab"
                      aria-selected={viewMode === mode}
                      onClick={() => {
                        if (mode === "MINE" && !hasAuthToken()) {
                          redirectToMainLogin();
                          return;
                        }
                        setViewMode(mode);
                      }}
                      className={`-mb-px min-h-12 border-b-2 text-base font-semibold transition-colors duration-200 ${
                        viewMode === mode
                          ? "border-ink text-ink"
                          : "text-ink-muted hover:text-ink border-transparent"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="focus-within:border-ink hover:border-ink/45 flex w-full items-center rounded-md border border-[#d9d3c8] bg-white transition-colors duration-200 lg:max-w-sm">
                  <Search
                    size={18}
                    className="text-ink-muted pointer-events-none ml-4 shrink-0"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Search questions"
                    aria-label="Search questions"
                    className="text-ink placeholder:text-ink-muted h-12 w-full bg-transparent px-3 text-base outline-none"
                  />
                  {searchInput ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchInput("");
                        setQ("");
                      }}
                      aria-label="Clear search"
                      className="text-ink-muted hover:text-ink flex h-12 w-12 shrink-0 items-center justify-center transition-colors duration-200"
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {QUICK_FILTERS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={sort === option.value}
                    onClick={() => setSort(option.value)}
                    className={`btn-motion min-h-10 rounded-md border px-4 text-sm font-medium ${
                      sort === option.value
                        ? "border-ink bg-ink text-white"
                        : "border-hairline text-ink-body hover:border-ink/45 hover:text-ink"
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setShowFilterPanel((v) => !v)}
                  aria-expanded={showFilterPanel}
                  className="text-ink decoration-ink/30 hover:decoration-ink ml-auto inline-flex items-center gap-2 text-base font-semibold underline underline-offset-4 transition-colors duration-200"
                >
                  <SlidersHorizontal size={16} strokeWidth={1.5} aria-hidden="true" />
                  {showFilterPanel ? "Hide filters" : "More filters"}
                  {hasActiveFilters ? (
                    <span className="bg-ink inline-flex h-5 min-w-5 items-center justify-center rounded-sm px-1 text-xs font-semibold text-white">
                      {selectedSports.length +
                        selectedCities.length +
                        (categoryFilter ? 1 : 0) +
                        (activeTag ? 1 : 0)}
                    </span>
                  ) : null}
                </button>
              </div>

              <AnimatePresence onExitComplete={() => setFilterPanelSettled(false)}>
                {showFilterPanel && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2, ease: "easeOut" }}
                    onAnimationComplete={() => setFilterPanelSettled(true)}
                    className={filterPanelSettled ? "overflow-visible" : "overflow-hidden"}
                  >
                    <div className="bg-paper-deep rounded-2xl p-5">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <SelectDropdown
                          label="Sort"
                          options={SORT_DIRECTION_OPTIONS}
                          value={direction}
                          onChange={(value) => setDirection(value as CommunityFeedSortDirection)}
                        />
                        <MultiCheckboxDropdown
                          label="Sport"
                          options={sportOptions}
                          selected={selectedSports}
                          onToggle={toggleSport}
                          emptyHint="No sports tagged yet"
                        />
                        <MultiCheckboxDropdown
                          label="City"
                          options={cityOptions}
                          selected={selectedCities}
                          onToggle={toggleCity}
                          emptyHint="No cities tagged yet"
                        />
                      </div>
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
                                onClick={() => void toggleTopicFollow(value)}
                                className={`shrink-0 rounded-md border px-2.5 py-1.5 text-sm font-semibold transition-colors duration-200 ${
                                  followedTopics.includes(value.toLowerCase())
                                    ? "border-ink bg-ink text-white"
                                    : "border-hairline text-ink-body hover:border-ink/45"
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

              {hasActiveFilters ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-ink-muted text-sm">Filtering by</span>
                  {categoryFilter ? (
                    <FilterCapsule label={categoryFilter} onRemove={() => setCategoryFilter("")} />
                  ) : null}
                  {activeTag ? (
                    <FilterCapsule label={`#${activeTag}`} onRemove={() => setActiveTag("")} />
                  ) : null}
                  {selectedSports.map((sport) => (
                    <FilterCapsule
                      key={`sport-${sport}`}
                      label={sport}
                      onRemove={() => toggleSport(sport)}
                    />
                  ))}
                  {selectedCities.map((city) => (
                    <FilterCapsule
                      key={`city-${city}`}
                      label={city}
                      onRemove={() => toggleCity(city)}
                    />
                  ))}
                  {q ? (
                    <FilterCapsule
                      label={`“${q}”`}
                      onRemove={() => {
                        setSearchInput("");
                        setQ("");
                      }}
                    />
                  ) : null}
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="text-ink decoration-ink/30 hover:decoration-ink ml-1 text-sm font-semibold underline underline-offset-4 transition-colors duration-200"
                  >
                    Clear all
                  </button>
                </div>
              ) : null}
            </section>

            {isLoading ? (
              <div
                aria-busy="true"
                aria-label="Loading questions"
                className="border-hairline border-t"
              >
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="border-hairline space-y-3 border-b py-8">
                    <div className="bg-ink/10 h-3 w-24 animate-pulse rounded-sm" />
                    <div className="bg-ink/10 h-6 w-3/4 animate-pulse rounded-sm" />
                    <div className="bg-ink/10 h-4 w-full animate-pulse rounded-sm" />
                  </div>
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="bg-paper-deep rounded-2xl px-6 py-16 text-center">
                <p className="font-editorial text-ink text-3xl font-light">
                  {viewMode === "MINE" ? "You have not asked anything yet." : "No threads found."}
                </p>
                <p className="text-ink-body mx-auto mt-3 max-w-[44ch] text-base leading-relaxed">
                  {viewMode === "MINE"
                    ? "Your questions will collect here. Start one and parents who have been through it will answer."
                    : hasActiveFilters
                      ? "Nothing matches these filters. Clear them to see every thread, or ask the question yourself."
                      : "Start the first thread and invite answers."}
                </p>
                {hasActiveFilters ? (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="text-ink decoration-ink/30 hover:decoration-ink mt-5 text-base font-semibold underline underline-offset-4 transition-colors duration-200"
                  >
                    Clear all filters
                  </button>
                ) : null}
              </div>
            ) : (
              <section aria-label="Threads">
                <ul className={featuredPost ? "" : "border-hairline border-t"}>
                  {featuredPost ? renderThread(featuredPost, true) : null}
                  {nonFeaturedPosts.map((post, index) =>
                    renderThread(post, false, index === 0 && Boolean(featuredPost))
                  )}
                </ul>

                {hasMore ? (
                  <div className="pt-10 text-center">
                    <button
                      type="button"
                      onClick={() => void loadMore()}
                      disabled={isLoadingMore}
                      className="btn-motion border-ink text-ink hover:bg-ink inline-flex min-h-12 items-center gap-2 rounded-md border px-7 text-base font-semibold hover:text-white disabled:opacity-60"
                    >
                      {isLoadingMore ? "Loading" : "Load more questions"}
                    </button>
                  </div>
                ) : null}
              </section>
            )}
          </div>

          <aside className="space-y-12 xl:sticky xl:top-24 xl:h-fit">
            {urgentUnanswered.length > 0 ? (
              <section aria-labelledby="qna-help-needed" className="bg-wash rounded-3xl p-6 sm:p-8">
                <h3 id="qna-help-needed" className="font-editorial text-ink text-2xl font-normal">
                  These need an answer
                </h3>
                <ul className="mt-4">
                  {urgentUnanswered.map((item) => (
                    <li
                      key={`urgent-${item.id}`}
                      className="border-ink/15 border-t first:border-t-0"
                    >
                      <Link
                        href={`/questions/${item.id}`}
                        className="text-ink hover:text-power-orange-solid block py-3 text-base font-medium transition-colors duration-200"
                      >
                        <span className="line-clamp-2">{item.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {currentUserId ? (
              <>
                <section aria-labelledby="qna-your-numbers">
                  <h3
                    id="qna-your-numbers"
                    className="font-editorial text-ink text-2xl font-normal"
                  >
                    Your numbers
                  </h3>
                  <dl className="border-hairline mt-4 grid grid-cols-2 border-t">
                    {[
                      { label: "Total points", value: summary.points },
                      { label: "Questions", value: summary.q },
                      { label: "Answers", value: summary.a },
                      { label: "Upvotes received", value: summary.upvotes },
                    ].map((stat) => (
                      <div key={stat.label} className="border-hairline border-b py-5 pr-4">
                        <dt className="text-ink-muted text-sm">{stat.label}</dt>
                        <dd className="font-editorial text-ink mt-1 text-4xl font-light tabular-nums">
                          {stat.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <p className="text-ink-body mt-4 text-base leading-relaxed">
                    {spotlight.unansweredCount} questions still need helpful answers.{" "}
                    {spotlight.answeredCount} already have shared solutions.
                  </p>
                </section>

                <section aria-labelledby="qna-activity">
                  <div className="flex items-center justify-between gap-3">
                    <h3 id="qna-activity" className="font-editorial text-ink text-2xl font-normal">
                      Your activity
                      {activityUnreadCount > 0 ? (
                        <span className="text-power-orange-solid ml-2 font-sans text-sm font-semibold">
                          {activityUnreadCount} new
                        </span>
                      ) : null}
                    </h3>
                    <button
                      type="button"
                      onClick={() => void handleMarkAllActivityRead()}
                      disabled={activityUnreadCount === 0 || isMarkingActivityRead}
                      className="text-ink decoration-ink/30 hover:decoration-ink text-sm font-semibold underline underline-offset-4 transition-colors duration-200 disabled:cursor-not-allowed disabled:no-underline disabled:opacity-40"
                    >
                      {isMarkingActivityRead ? "Marking" : "Mark all read"}
                    </button>
                  </div>

                  {isLoadingActivity ? (
                    <p className="text-ink-muted mt-4 text-base">Loading activity</p>
                  ) : activity.length === 0 ? (
                    <p className="text-ink-body mt-4 text-base leading-relaxed">
                      Nothing yet. When someone answers or upvotes your content, it shows up here.
                    </p>
                  ) : (
                    <ul className="border-hairline mt-4 max-h-96 overflow-y-auto border-t">
                      {activity.map((item) => {
                        const postLink = item.data?.postId
                          ? `/questions/${item.data.postId}`
                          : null;
                        return (
                          <li key={item.id} className="border-hairline border-b py-4">
                            <p className="text-ink-muted flex items-center gap-2 text-sm">
                              {!item.isRead ? (
                                <span
                                  className="bg-power-orange-solid h-2 w-2 shrink-0 rounded-full"
                                  aria-label="Unread"
                                />
                              ) : null}
                              <span>{getActivityLabel(item)}</span>
                              <span aria-hidden>·</span>
                              <span>{toRelativeTime(item.createdAt)} ago</span>
                            </p>
                            <p
                              className={`mt-1 text-base leading-relaxed ${
                                item.isRead ? "text-ink-body" : "text-ink font-medium"
                              }`}
                            >
                              {item.message}
                            </p>
                            {postLink ? (
                              <Link
                                href={postLink}
                                onClick={() => {
                                  void handleActivityOpen(item);
                                }}
                                className="text-ink decoration-ink/30 hover:decoration-ink mt-2 inline-block text-sm font-semibold underline underline-offset-4 transition-colors duration-200"
                              >
                                Open thread
                              </Link>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </section>
              </>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}
