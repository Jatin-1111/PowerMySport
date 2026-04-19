"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowBigDown,
  ArrowBigUp,
  LoaderCircle,
  MessageCircle,
  Plus,
  Search,
  Trophy,
} from "lucide-react";
import { communityService } from "@/modules/community/services/community";
import {
  CommunityActivityItem,
  CommunityFeedSort,
  CommunityPost,
  CommunityReputationSummary,
} from "@/modules/community/types";
import { redirectToMainLogin } from "@/lib/auth/redirect";
import { isCommunityEligibleRole } from "@/lib/auth/roles";
import { getCommunitySocket } from "@/lib/realtime/socket";
import { communityFollowStore } from "@/modules/community/lib/followStore";
import { toast } from "@/lib/toast";

const SORT_OPTIONS: Array<{ value: CommunityFeedSort; label: string }> = [
  { value: "NEW", label: "New" },
  { value: "TOP", label: "Top" },
  { value: "UNANSWERED", label: "Unanswered" },
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
  const [isMutatingPostId, setIsMutatingPostId] = useState<string | null>(null);
  const [isVotingKey, setIsVotingKey] = useState<string | null>(null);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [activity, setActivity] = useState<CommunityActivityItem[]>([]);
  const [activityUnreadCount, setActivityUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [reputation, setReputation] =
    useState<CommunityReputationSummary | null>(null);
  const [sort, setSort] = useState<CommunityFeedSort>("NEW");
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [activeTag, setActiveTag] = useState<string>("");
  const [sportFilterInput, setSportFilterInput] = useState("");
  const [cityFilterInput, setCityFilterInput] = useState("");
  const [sportFilter, setSportFilter] = useState("");
  const [cityFilter, setCityFilter] = useState("");
  const [showAskForm, setShowAskForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [sport, setSport] = useState("");
  const [city, setCity] = useState("");
  const [isUrlHydrated, setIsUrlHydrated] = useState(false);
  const [followedTopics, setFollowedTopics] = useState<string[]>([]);

  useEffect(() => {
    const qParam = (urlSearchParams.get("q") || "").trim();
    const tagParam = (urlSearchParams.get("tag") || "").trim();
    const sportParam = (urlSearchParams.get("sport") || "").trim();
    const cityParam = (urlSearchParams.get("city") || "").trim();
    const askParam = urlSearchParams.get("ask") === "1";
    const sortParam = (urlSearchParams.get("sort") || "").toUpperCase();
    const mineParam = urlSearchParams.get("mine") === "1";

    const nextSort: CommunityFeedSort =
      sortParam === "TOP" || sortParam === "UNANSWERED" ? sortParam : "NEW";

    setSearchInput(qParam);
    setQ(qParam);
    setActiveTag(tagParam);
    setSportFilterInput(sportParam);
    setSportFilter(sportParam);
    setCityFilterInput(cityParam);
    setCityFilter(cityParam);
    setSort(nextSort);
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
            q,
            tag: activeTag || undefined,
            sport: sportFilter || undefined,
            city: cityFilter || undefined,
            mine: viewMode === "MINE",
          }),
          communityService.getMyReputation(),
        ]);

        const items = postData.items || [];
        setPosts((current) => (append ? [...current, ...items] : items));
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
    [sort, q, activeTag, sportFilter, cityFilter, viewMode],
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
    const handle = setTimeout(() => {
      setSportFilter(sportFilterInput.trim());
      setCityFilter(cityFilterInput.trim());
    }, 260);

    return () => clearTimeout(handle);
  }, [sportFilterInput, cityFilterInput]);

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
    const currentMine = urlSearchParams.get("mine") === "1" ? "MINE" : "ALL";

    const desiredQ = q.trim();
    const desiredTag = activeTag.trim();
    const desiredSport = sportFilter.trim();
    const desiredCity = cityFilter.trim();
    const desiredSort = sort;
    const desiredMine = viewMode;

    if (
      currentQ === desiredQ &&
      currentTag === desiredTag &&
      currentSport === desiredSport &&
      currentCity === desiredCity &&
      (currentSort || "NEW") === desiredSort &&
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
    if (desiredMine === "MINE") nextParams.set("mine", "1");

    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, {
      scroll: false,
    });
  }, [
    activeTag,
    cityFilter,
    isUrlHydrated,
    pathname,
    q,
    router,
    sort,
    sportFilter,
    urlSearchParams,
    viewMode,
  ]);

  const handleCreatePost = async () => {
    if (title.trim().length < 10 || body.trim().length < 20) {
      toast.error("Title/body are too short for a quality question");
      return;
    }

    try {
      setIsSubmitting(true);
      await communityService.createPost({
        title: title.trim(),
        body: body.trim(),
        tags: tags
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        sport: sport.trim() || undefined,
        city: city.trim() || undefined,
      });

      setTitle("");
      setBody("");
      setTags("");
      setSport("");
      setCity("");
      setShowAskForm(false);
      toast.success("Question posted");
      await loadFeed(1, false);
      await loadActivity();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to post question",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const loadMore = async () => {
    if (!hasMore || isLoadingMore) {
      return;
    }

    await loadFeed(page + 1, true);
  };

  const togglePostStatus = async (post: CommunityPost) => {
    const nextStatus = post.status === "OPEN" ? "CLOSED" : "OPEN";
    try {
      setIsMutatingPostId(post.id);
      const updated = await communityService.updatePost(post.id, {
        status: nextStatus,
      });

      setPosts((current) =>
        current.map((item) =>
          item.id === post.id ? { ...item, status: updated.status } : item,
        ),
      );
      toast.success(
        `Question ${nextStatus === "OPEN" ? "reopened" : "closed"}`,
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update question",
      );
    } finally {
      setIsMutatingPostId(null);
    }
  };

  const deletePost = async (post: CommunityPost) => {
    const confirmed = window.confirm(
      "Delete this question? This will hide it from the knowledge feed.",
    );
    if (!confirmed) {
      return;
    }

    try {
      setIsMutatingPostId(post.id);
      await communityService.deletePost(post.id);
      setPosts((current) => current.filter((item) => item.id !== post.id));
      toast.success("Question deleted");
      await loadActivity();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete question",
      );
    } finally {
      setIsMutatingPostId(null);
    }
  };

  const vote = async (post: CommunityPost, value: 1 | -1) => {
    const key = `POST:${post.id}`;
    try {
      setIsVotingKey(key);
      const result = await communityService.vote({
        targetType: "POST",
        targetId: post.id,
        value,
      });

      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
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
      await loadActivity();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to vote");
    } finally {
      setIsVotingKey(null);
    }
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
        <section className="relative overflow-hidden rounded-3xl border border-white/80 bg-[linear-gradient(125deg,#fafdff_0%,#eaf4ff_36%,#fff1dc_100%)] px-4 py-7 text-slate-900 shadow-sm sm:rounded-4xl sm:px-10 sm:py-12">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-sky-300/25 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 left-0 h-72 w-72 rounded-full bg-amber-200/30 blur-3xl" />

          <div className="relative flex flex-wrap items-start justify-between gap-6">
            <div className="max-w-3xl">
              <p className="inline-flex rounded-full border border-slate-200 bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                Community Knowledge Exchange
              </p>
              <h1 className="font-title mt-4 text-3xl font-semibold leading-[1.08] tracking-tight sm:text-4xl lg:text-5xl">
                Ask Better Questions. Share Better Answers.
              </h1>
              <p className="mt-4 max-w-2xl text-sm text-slate-700 sm:text-base">
                A player-to-player learning space where practical advice wins.
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-semibold text-slate-700">
                  {posts.length} live threads
                </span>
                <span className="rounded-full border border-amber-200 bg-amber-50/90 px-3 py-1 text-xs font-semibold text-amber-700">
                  {spotlight.unansweredCount} unanswered
                </span>
                <span className="rounded-full border border-emerald-200 bg-emerald-50/90 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {spotlight.answeredCount} solved
                </span>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-end sm:gap-3">
              <Link
                href="/"
                className="rounded-xl border border-slate-200 bg-white/85 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-white"
              >
                Back to Chat
              </Link>
              <button
                onClick={() => setShowAskForm((v) => !v)}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700"
              >
                <Plus size={16} />
                Ask Question
              </button>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)]">
          <div className="space-y-6">
            <AnimatePresence initial={false}>
              {showAskForm && (
                <motion.section
                  key="ask-form"
                  initial={{ opacity: 0, height: 0, y: -8 }}
                  animate={{ opacity: 1, height: "auto", y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -8 }}
                  transition={{ duration: 0.28, ease: "easeOut" }}
                  className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-5 sm:p-6 shadow-lg"
                >
                  <div className="relative">
                    <h2 className="font-title text-xl font-bold text-slate-900">
                      Start a New Question
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Be specific and clear so others can help you quickly.
                      Include what you tried and what you want to achieve.
                    </p>

                    <div className="mt-5 space-y-4">
                      <div>
                        <label
                          htmlFor="q-title"
                          className="block text-xs font-semibold uppercase text-slate-500 mb-1.5"
                        >
                          Question Title
                        </label>
                        <input
                          id="q-title"
                          value={title}
                          onChange={(event) => setTitle(event.target.value)}
                          placeholder="What's your question? (min 10 characters)"
                          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-900 placeholder-slate-500 focus:border-power-orange focus:outline-none focus:ring-1 focus:ring-power-orange"
                        />
                        <p className="mt-1 text-xs text-slate-500">
                          {title.length} / 500 characters
                        </p>
                      </div>

                      <div>
                        <label
                          htmlFor="q-body"
                          className="block text-xs font-semibold uppercase text-slate-500 mb-1.5"
                        >
                          Details & Context
                        </label>
                        <textarea
                          id="q-body"
                          value={body}
                          onChange={(event) => setBody(event.target.value)}
                          placeholder="Describe: what's your situation? What have you already tried? What result do you want? (min 20 characters)"
                          rows={6}
                          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-500 focus:border-power-orange focus:outline-none focus:ring-1 focus:ring-power-orange"
                        />
                        <p className="mt-1 text-xs text-slate-500">
                          {body.length} / 2000 characters
                        </p>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-500 mb-2">
                          Additional Info
                        </label>
                        <div className="grid gap-3 lg:grid-cols-3">
                          <input
                            value={tags}
                            onChange={(event) => setTags(event.target.value)}
                            placeholder="Tags (e.g., badminton, fitness)"
                            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-power-orange focus:outline-none"
                          />
                          <input
                            value={sport}
                            onChange={(event) => setSport(event.target.value)}
                            placeholder="Sport (optional)"
                            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-power-orange focus:outline-none"
                          />
                          <input
                            value={city}
                            onChange={(event) => setCity(event.target.value)}
                            placeholder="City (optional)"
                            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-900 placeholder-slate-500 focus:border-power-orange focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                        <button
                          onClick={() => void handleCreatePost()}
                          disabled={isSubmitting}
                          className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-60"
                        >
                          {isSubmitting ? "Publishing..." : "Publish Question"}
                        </button>
                        <button
                          onClick={() => setShowAskForm(false)}
                          className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-50 p-1">
                  <button
                    onClick={() => setViewMode("ALL")}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                      viewMode === "ALL"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-600 hover:bg-white"
                    }`}
                  >
                    All Threads
                  </button>
                  <button
                    onClick={() => setViewMode("MINE")}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                      viewMode === "MINE"
                        ? "bg-slate-900 text-white shadow-sm"
                        : "text-slate-600 hover:bg-white"
                    }`}
                  >
                    My Posts
                  </button>
                </div>

                <div className="grid w-full gap-2 lg:w-auto lg:grid-cols-3">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2">
                    <Search size={16} className="text-slate-500" />
                    <input
                      value={searchInput}
                      onChange={(event) => setSearchInput(event.target.value)}
                      placeholder="Search questions"
                      className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none sm:w-52"
                    />
                  </div>
                  <input
                    value={sportFilterInput}
                    onChange={(event) =>
                      setSportFilterInput(event.target.value)
                    }
                    placeholder="Filter sport"
                    className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-power-orange focus:bg-white focus:outline-none"
                  />
                  <input
                    value={cityFilterInput}
                    onChange={(event) => setCityFilterInput(event.target.value)}
                    placeholder="Filter city"
                    className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-power-orange focus:bg-white focus:outline-none"
                  />
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:justify-end">
                  {SORT_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSort(option.value)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
                        sort === option.value
                          ? "border-power-orange/50 bg-power-orange/10 text-power-orange"
                          : "border-slate-300 bg-slate-50 text-slate-700 hover:bg-white"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {spotlight.popularTags.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Popular Topics
                  </span>
                  <button
                    onClick={() => setActiveTag("")}
                    className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                      !activeTag
                        ? "border-power-orange/40 bg-power-orange/10 text-power-orange"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    All
                  </button>
                  {spotlight.popularTags.map((tag) => (
                    <div key={tag} className="inline-flex items-center gap-1">
                      <button
                        onClick={() => setActiveTag(tag)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                          activeTag === tag
                            ? "border-power-orange/40 bg-power-orange/10 text-power-orange"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                        }`}
                      >
                        #{tag}
                      </button>
                      <button
                        onClick={() => toggleTopicFollow(tag)}
                        className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${
                          followedTopics.includes(tag.toLowerCase())
                            ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-white text-slate-500 hover:bg-slate-100"
                        }`}
                      >
                        {followedTopics.includes(tag.toLowerCase())
                          ? "Following"
                          : "Follow"}
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
                {urgentUnanswered.length > 0 ? (
                  <div className="grid gap-3 xl:grid-cols-[1.35fr_minmax(0,1fr)]">
                    <div className="rounded-2xl border border-amber-200/80 bg-[linear-gradient(120deg,#fff9ed_0%,#fff3dc_100%)] p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                        Help Needed Now
                      </p>
                      <div className="mt-2 space-y-2">
                        {urgentUnanswered.map((item) => (
                          <Link
                            key={`urgent-${item.id}`}
                            href={`/q/${item.id}`}
                            className="block rounded-xl border border-amber-200/60 bg-white/90 px-3 py-2 text-sm font-medium text-slate-800 transition hover:border-amber-300 hover:bg-white"
                          >
                            <span className="line-clamp-1">{item.title}</span>
                            <span className="mt-1 inline-flex items-center gap-2 text-xs font-semibold text-amber-700">
                              <MessageCircle size={12} /> 0 answers
                            </span>
                          </Link>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-sky-200/70 bg-[linear-gradient(125deg,#eef6ff_0%,#e4f0ff_100%)] p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">
                        Your Knowledge Impact
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="rounded-xl bg-white/85 p-3">
                          <p className="text-[11px] text-slate-500">Points</p>
                          <p className="text-lg font-bold text-slate-900">
                            {summary.points}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white/85 p-3">
                          <p className="text-[11px] text-slate-500">Upvotes</p>
                          <p className="text-lg font-bold text-slate-900">
                            {summary.upvotes}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white/85 p-3">
                          <p className="text-[11px] text-slate-500">
                            Questions
                          </p>
                          <p className="text-lg font-bold text-slate-900">
                            {summary.q}
                          </p>
                        </div>
                        <div className="rounded-xl bg-white/85 p-3">
                          <p className="text-[11px] text-slate-500">Answers</p>
                          <p className="text-lg font-bold text-slate-900">
                            {summary.a}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}

                {featuredPost ? (
                  <article className="group relative flex gap-0 overflow-hidden rounded-xl border-2 border-power-orange/30 bg-linear-to-br from-power-orange/5 via-white to-white shadow-lg transition-all hover:border-power-orange/50 hover:shadow-xl">
                    {/* Voting Sidebar */}
                    <div className="flex w-16 shrink-0 flex-col items-center gap-0.5 border-r-2 border-power-orange/20 bg-power-orange/5 px-2.5 py-4 group-hover:bg-power-orange/10">
                      <button
                        onClick={() => void vote(featuredPost, 1)}
                        disabled={isVotingKey === `POST:${featuredPost.id}`}
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
                        disabled={isVotingKey === `POST:${featuredPost.id}`}
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
                        <div className="flex items-center gap-3 text-xs text-slate-600">
                          <span className="font-semibold text-slate-900">
                            {featuredPost.author.displayName}
                          </span>
                          <span className="text-slate-500">
                            {toRelativeTime(featuredPost.createdAt)} ago
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
                    const voteKey = `POST:${post.id}`;
                    return (
                      <article
                        key={post.id}
                        className="group relative flex gap-0 overflow-hidden rounded-lg border border-slate-200 bg-white transition-all hover:border-slate-300 hover:shadow-md"
                      >
                        {/* Voting Sidebar - Reddit Style */}
                        <div className="flex w-16 shrink-0 flex-col items-center gap-0.5 border-r border-slate-200 bg-slate-50 px-2.5 py-3 group-hover:bg-slate-100">
                          <button
                            onClick={() => void vote(post, 1)}
                            disabled={isVotingKey === voteKey}
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
                            disabled={isVotingKey === voteKey}
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
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                              <span className="font-medium text-slate-700">
                                {post.author.displayName}
                              </span>
                              <span className="text-slate-400">
                                {toRelativeTime(post.createdAt)} ago
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
                                disabled={isMutatingPostId === post.id}
                                className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50"
                              >
                                {post.status === "OPEN" ? "Close" : "Reopen"}
                              </button>
                              <button
                                onClick={() => void deletePost(post)}
                                disabled={isMutatingPostId === post.id}
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
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl border border-white/85 bg-white/92 p-4 shadow-sm backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Total Points
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {summary.points}
                </p>
              </div>
              <div className="rounded-2xl border border-white/85 bg-white/92 p-4 shadow-sm backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Questions
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {summary.q}
                </p>
              </div>
              <div className="rounded-2xl border border-white/85 bg-white/92 p-4 shadow-sm backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Answers
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {summary.a}
                </p>
              </div>
              <div className="rounded-2xl border border-white/85 bg-white/92 p-4 shadow-sm backdrop-blur-sm">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Received Upvotes
                </p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  {summary.upvotes}
                </p>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-2xl border border-blue-200 bg-blue-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  Knowledge Opportunities
                </p>
                <p className="mt-1 text-sm text-blue-900">
                  {spotlight.unansweredCount} questions still need helpful
                  answers.
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Solved Discussions
                </p>
                <p className="mt-1 text-sm text-emerald-900">
                  {spotlight.answeredCount} questions already have shared
                  solutions.
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-white/90 bg-white/90 p-4 shadow-sm backdrop-blur-md sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="font-title text-lg font-semibold text-slate-900">
                  Activity On Your Knowledge
                </h3>
                <div className="flex items-center gap-2">
                  {activityUnreadCount > 0 ? (
                    <span className="rounded-full bg-power-orange/10 px-2.5 py-1 text-[11px] font-semibold text-power-orange">
                      {activityUnreadCount} unread
                    </span>
                  ) : null}
                  <button
                    onClick={() => void loadActivity()}
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Refresh
                  </button>
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
                <div className="space-y-2">
                  {activity.map((item, index) => {
                    const postLink = item.data?.postId
                      ? `/q/${item.data.postId}`
                      : null;

                    return (
                      <div
                        key={item.id}
                        className={`rounded-2xl border p-3 ${
                          index % 2 === 0 ? "xl:mr-3" : "xl:ml-3"
                        } ${
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
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
