"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { blogService } from "@/modules/community/services/blog";
import { BlogListItem } from "@/modules/community/types";
import { redirectToMainLogin } from "@/lib/auth/redirect";
import { hasAuthToken } from "@/lib/auth/token";
import {
  getCommunitySocket,
  BLOG_FEED_ROOM,
  subscribeToCommunityRoom,
} from "@/lib/realtime/socket";
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
        toast.error(error instanceof Error ? error.message : "Failed to load experiences");
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [topic, q]
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
    const unsubscribe = subscribeToCommunityRoom(BLOG_FEED_ROOM);
    return () => {
      unsubscribe();
      socket.off("community:blogCreated", refresh);
      socket.off("community:blogDeleted", refresh);
    };
  }, []);

  const handleToggleLike = async (blog: BlogListItem) => {
    if (!hasAuthToken()) {
      redirectToMainLogin();
      return;
    }
    // Optimistic update.
    setLikePendingId(blog.id);
    const optimisticLiked = !blog.likedByMe;
    setBlogs((current) =>
      current.map((item) =>
        item.id === blog.id
          ? {
              ...item,
              likedByMe: optimisticLiked,
              likeCount: Math.max(0, item.likeCount + (optimisticLiked ? 1 : -1)),
            }
          : item
      )
    );
    try {
      const result = await blogService.toggleLike("EXPERIENCE", blog.id);
      setBlogs((current) =>
        current.map((item) =>
          item.id === blog.id
            ? { ...item, likedByMe: result.liked, likeCount: result.likeCount }
            : item
        )
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
            : item
        )
      );
      toast.error(error instanceof Error ? error.message : "Failed to react");
    } finally {
      setLikePendingId(null);
    }
  };

  return (
    <div className="bg-paper relative isolate min-h-[calc(100vh-5.5rem)]">
      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-5 sm:px-6 sm:py-8 lg:px-8">
        {/* Blog-tab account access (avatar + username) */}
        <div className="flex justify-end">
          <BlogAccountChip />
        </div>

        <BlogHero totalBlogs={total} />

        <section className="space-y-6 pt-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="font-editorial text-ink text-3xl font-light sm:text-4xl">
                Browse by topic
              </h2>
              <p className="text-ink-body mt-2 text-base">
                Pick the sport or subject you are deciding on.
              </p>
            </div>
            <div className="focus-within:border-ink hover:border-ink/45 relative flex w-full items-center rounded-md border border-[#d9d3c8] bg-white transition-colors duration-200 lg:max-w-md">
              <Search
                size={18}
                className="text-ink-muted pointer-events-none ml-4"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search experiences"
                aria-label="Search experiences"
                className="text-ink placeholder:text-ink-muted h-12 w-full bg-transparent px-3 text-base outline-none"
              />
              {searchInput ? (
                <button
                  type="button"
                  onClick={() => setSearchInput("")}
                  className="text-ink-muted hover:text-ink px-4 text-sm font-semibold transition-colors duration-200"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>
          <BlogTopicStrip activeTopic={topic} onSelect={setTopic} />
        </section>

        <section className="space-y-10 pt-6">
          <BlogGrid
            blogs={blogs}
            isLoading={isLoading}
            onToggleLike={handleToggleLike}
            likePendingId={likePendingId}
            emptyMessage={
              topic || q
                ? "No experiences match this filter yet. Try another topic or clear the search."
                : "Be the first parent to share one."
            }
          />

          {hasMore ? (
            <div className="text-center">
              <button
                onClick={() => void loadBlogs(page + 1, true)}
                disabled={isLoadingMore}
                className="btn-motion border-ink text-ink hover:bg-ink inline-flex min-h-12 items-center gap-2 rounded-md border px-7 text-base font-semibold hover:text-white disabled:opacity-60"
              >
                {isLoadingMore ? "Loading..." : "Load more experiences"}
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
