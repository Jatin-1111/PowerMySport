"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { blogService } from "@/modules/community/services/blog";
import { BlogListItem } from "@/modules/community/types";
import { redirectToMainLogin } from "@/lib/auth/redirect";
import { isCommunityEligibleRole } from "@/lib/auth/roles";
import { communityService } from "@/modules/community/services/community";
import { getCommunitySocket } from "@/lib/realtime/socket";
import { toast } from "@/lib/toast";
import { Search } from "lucide-react";
import BlogHero from "./BlogHero";
import BlogTopicStrip from "./BlogTopicStrip";
import BlogGrid from "./BlogGrid";
import BlogAccountChip from "./BlogAccountChip";

const PAGE_SIZE = 12;

export default function BlogLandingClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [blogs, setBlogs] = useState<BlogListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [topic, setTopic] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");
  const [likePendingId, setLikePendingId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate filters from the URL once.
  useEffect(() => {
    const topicParam = (searchParams.get("topic") || "").trim();
    const qParam = (searchParams.get("q") || "").trim();
    setTopic(topicParam);
    setSearchInput(qParam);
    setQ(qParam);
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadBlogs = useCallback(
    async (targetPage = 1, append = false) => {
      try {
        if (append) setIsLoadingMore(true);
        else setIsLoading(true);

        const session = await communityService.ensureSession();
        if (!isCommunityEligibleRole(session.role)) {
          redirectToMainLogin();
          return;
        }

        const data = await blogService.listBlogs(targetPage, PAGE_SIZE, {
          topic: topic || undefined,
          q: q || undefined,
        });
        const items = data.items || [];
        setBlogs((current) => (append ? [...current, ...items] : items));
        setTotal(data.pagination?.total || 0);
        setPage(targetPage);
        setHasMore(targetPage < (data.pagination?.totalPages || 0));
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Failed to load stories",
        );
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [topic, q],
  );

  useEffect(() => {
    if (!hydrated) return;
    void loadBlogs(1, false);
  }, [hydrated, loadBlogs]);

  // Debounce search input into the applied query.
  useEffect(() => {
    const handle = setTimeout(() => setQ(searchInput.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // Keep the URL in sync with filters.
  useEffect(() => {
    if (!hydrated) return;
    const params = new URLSearchParams();
    if (topic) params.set("topic", topic);
    if (q) params.set("q", q);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, {
      scroll: false,
    });
  }, [topic, q, hydrated, pathname, router]);

  // Refresh when other clients publish/like.
  const loadRef = useRef(loadBlogs);
  loadRef.current = loadBlogs;
  useEffect(() => {
    const socket = getCommunitySocket();
    const refresh = () => void loadRef.current(1, false);
    socket.on("community:blogCreated", refresh);
    socket.on("community:blogDeleted", refresh);
    if (!socket.connected) socket.connect();
    return () => {
      socket.off("community:blogCreated", refresh);
      socket.off("community:blogDeleted", refresh);
    };
  }, []);

  const handleToggleLike = async (blog: BlogListItem) => {
    // Optimistic update.
    setLikePendingId(blog.id);
    const optimisticLiked = !blog.likedByMe;
    setBlogs((current) =>
      current.map((item) =>
        item.id === blog.id
          ? {
              ...item,
              likedByMe: optimisticLiked,
              likeCount: Math.max(
                0,
                item.likeCount + (optimisticLiked ? 1 : -1),
              ),
            }
          : item,
      ),
    );
    try {
      const result = await blogService.toggleLike("BLOG", blog.id);
      setBlogs((current) =>
        current.map((item) =>
          item.id === blog.id
            ? { ...item, likedByMe: result.liked, likeCount: result.likeCount }
            : item,
        ),
      );
    } catch (error) {
      // Roll back.
      setBlogs((current) =>
        current.map((item) =>
          item.id === blog.id
            ? {
                ...item,
                likedByMe: blog.likedByMe,
                likeCount: blog.likeCount,
              }
            : item,
        ),
      );
      toast.error(error instanceof Error ? error.message : "Failed to react");
    } finally {
      setLikePendingId(null);
    }
  };

  return (
    <div className="relative isolate min-h-[calc(100vh-5.5rem)] bg-[linear-gradient(180deg,#eef4ff_0%,#f4f8ff_42%,#fff6e9_100%)]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute left-[-12%] top-[-8%] h-136 w-136 rounded-full bg-sky-300/25 blur-3xl" />
        <div className="absolute right-[-16%] top-[14%] h-124 w-124 rounded-full bg-amber-200/25 blur-3xl" />
      </div>

      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        {/* Blog-tab account access (avatar + username) */}
        <div className="flex justify-end">
          <BlogAccountChip />
        </div>

        <BlogHero totalBlogs={total} />

        <section className="space-y-4">
          {/* Search bar above the topics */}
          <div className="mx-auto flex w-full max-w-2xl items-center gap-2 rounded-2xl border border-white/70 bg-white/85 px-4 py-3 shadow-sm backdrop-blur-sm focus-within:border-power-orange/40 focus-within:bg-white">
            <Search size={18} className="text-slate-400" />
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search stories, topics, tags..."
              className="w-full bg-transparent text-sm text-slate-800 placeholder:text-slate-400 outline-none"
            />
            {searchInput ? (
              <button
                onClick={() => setSearchInput("")}
                className="text-xs font-semibold text-slate-400 transition hover:text-slate-600"
              >
                Clear
              </button>
            ) : null}
          </div>

          <div>
            <h2 className="font-title text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Explore trending topics
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              Browse stories by the sport or theme you care about.
            </p>
          </div>
          <BlogTopicStrip activeTopic={topic} onSelect={setTopic} />
        </section>

        <section className="space-y-4">
          <BlogGrid
            blogs={blogs}
            isLoading={isLoading}
            onToggleLike={handleToggleLike}
            likePendingId={likePendingId}
            emptyMessage={
              topic || q
                ? "No stories match this filter yet. Try another topic."
                : "No stories here yet. Be the first to publish one."
            }
          />

          {hasMore ? (
            <div className="pt-2 text-center">
              <button
                onClick={() => void loadBlogs(page + 1, true)}
                disabled={isLoadingMore}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
              >
                {isLoadingMore ? "Loading..." : "Load more stories"}
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
