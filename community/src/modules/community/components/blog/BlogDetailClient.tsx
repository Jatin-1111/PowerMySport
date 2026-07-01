"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  Loader2,
  MessageCircle,
  Pencil,
  Trash2,
  Twitter,
} from "lucide-react";
import { blogService } from "@/modules/community/services/blog";
import { BlogDetail } from "@/modules/community/types";
import { redirectToMainLogin } from "@/lib/auth/redirect";
import { isCommunityEligibleRole } from "@/lib/auth/roles";
import { communityService } from "@/modules/community/services/community";
import { getCommunitySocket } from "@/lib/realtime/socket";
import { toast } from "@/lib/toast";
import { getBlogTopic } from "@/modules/community/constants/blogTopics";
import { formatBlogDate } from "@/modules/community/utils/blogFormat";
import BlogContentRenderer from "./BlogContentRenderer";
import BlogCommentsSidebar from "./BlogCommentsSidebar";
import BlogCoverFallback from "./BlogCoverFallback";
import AuthorAvatar from "./AuthorAvatar";
import LikeButton from "./LikeButton";

const authorHref = (author: BlogDetail["author"]) =>
  author.username
    ? `/blog/writer/${author.username}`
    : `/blog/writer/${author.id}`;

export default function BlogDetailClient({ blogId }: { blogId: string }) {
  const router = useRouter();
  const [blog, setBlog] = useState<BlogDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [likePending, setLikePending] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const session = await communityService.ensureSession();
      if (!isCommunityEligibleRole(session.role)) {
        redirectToMainLogin();
        return;
      }
      const data = await blogService.getBlog(blogId);
      setBlog(data);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load story",
      );
      setBlog(null);
    } finally {
      setIsLoading(false);
    }
  }, [blogId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live like-count sync from other clients.
  useEffect(() => {
    const socket = getCommunitySocket();
    const handleLike = (payload?: {
      targetType?: string;
      targetId?: string;
      likeCount?: number;
    }) => {
      if (
        payload?.targetType === "BLOG" &&
        payload.targetId === blogId &&
        typeof payload.likeCount === "number"
      ) {
        setBlog((current) =>
          current ? { ...current, likeCount: payload.likeCount as number } : current,
        );
      }
    };
    socket.on("community:blogLiked", handleLike);
    if (!socket.connected) socket.connect();
    return () => {
      socket.off("community:blogLiked", handleLike);
    };
  }, [blogId]);

  const handleToggleLike = async () => {
    if (!blog) return;
    setLikePending(true);
    const optimisticLiked = !blog.likedByMe;
    setBlog({
      ...blog,
      likedByMe: optimisticLiked,
      likeCount: Math.max(0, blog.likeCount + (optimisticLiked ? 1 : -1)),
    });
    try {
      const result = await blogService.toggleLike("BLOG", blog.id);
      setBlog((current) =>
        current
          ? { ...current, likedByMe: result.liked, likeCount: result.likeCount }
          : current,
      );
    } catch (error) {
      setBlog((current) =>
        current
          ? { ...current, likedByMe: blog.likedByMe, likeCount: blog.likeCount }
          : current,
      );
      toast.error(error instanceof Error ? error.message : "Failed to react");
    } finally {
      setLikePending(false);
    }
  };

  const handleDelete = async () => {
    if (!blog) return;
    setIsDeleting(true);
    try {
      await blogService.deleteBlog(blog.id);
      toast.success("Blog deleted");
      router.push("/blog");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
      setIsDeleting(false);
    }
  };

  const confirmDelete = () => {
    toast("Delete this blog permanently?", {
      action: { label: "Delete", onClick: () => void handleDelete() },
    });
  };

  const shareOnTwitter = () => {
    if (!blog) return;
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = `${blog.title} — on PowerMySport`;
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      text,
    )}&url=${encodeURIComponent(url)}`;
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  };

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-3xl justify-center px-4 py-16 text-slate-400">
        <Loader2 size={26} className="animate-spin" />
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-slate-700">Story not found.</p>
        <Link
          href="/blog"
          className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Back to Blog
        </Link>
      </div>
    );
  }

  const topic = getBlogTopic(blog.topic);
  const coverUrl = blog.coverImageUrl || "";

  return (
    <div className="relative min-h-[calc(100vh-5.5rem)] bg-[linear-gradient(180deg,#f5f8ff_0%,#ffffff_40%)]">
      <article className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >
            <ChevronLeft size={16} />
            Back to Blog
          </Link>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${topic.accent}`}
          >
            <topic.Icon size={13} />
            {topic.label}
          </span>
        </div>

        {/* Cover */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mt-5 aspect-[16/9] w-full overflow-hidden rounded-3xl border border-slate-200 bg-slate-100"
        >
          {coverUrl ? (
            <img src={coverUrl} alt={blog.title} className="h-full w-full object-cover" />
          ) : (
            <BlogCoverFallback topic={blog.topic} />
          )}
        </motion.div>

        {/* Title */}
        <h1 className="font-title mt-6 text-3xl font-bold leading-tight tracking-tight text-slate-900 sm:text-4xl">
          {blog.title}
        </h1>

        {/* Author + date */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5">
          <Link href={authorHref(blog.author)} className="flex items-center gap-3">
            <AuthorAvatar
              name={blog.author.name}
              photoUrl={blog.author.photoUrl}
              size={44}
            />
            <span>
              <span className="block text-sm font-semibold text-slate-900">
                {blog.author.name}
              </span>
              <span className="block text-xs text-slate-400">
                {blog.author.username ? `@${blog.author.username} · ` : ""}
                Published on {formatBlogDate(blog.createdAt)}
              </span>
            </span>
          </Link>

          {blog.isMine ? (
            <div className="flex items-center gap-2">
              <Link
                href={`/blog/edit/${blog.id}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Pencil size={14} />
                Edit
              </Link>
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          ) : null}
        </div>

        {/* Reactions bar */}
        <div className="mt-4 flex items-center gap-2.5">
          <LikeButton
            liked={blog.likedByMe}
            count={blog.likeCount}
            onToggle={handleToggleLike}
            disabled={likePending}
            size="lg"
          />
          <button
            onClick={() => setCommentsOpen(true)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-sky-200 hover:bg-sky-50/60 hover:text-sky-600"
          >
            <MessageCircle size={18} />
            {blog.commentCount}
          </button>
        </div>

        {/* Content */}
        <div className="mt-7">
          <BlogContentRenderer blocks={blog.content} />
        </div>

        {/* Tags */}
        {blog.tags.length > 0 ? (
          <div className="mt-8 flex flex-wrap gap-2">
            {blog.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600"
              >
                #{tag}
              </span>
            ))}
          </div>
        ) : null}

        {/* Share */}
        <div className="mt-8 flex items-center justify-between gap-3 border-t border-slate-100 pt-6">
          <p className="text-sm text-slate-500">Enjoyed this story? Share it.</p>
          <button
            onClick={shareOnTwitter}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-600"
          >
            <Twitter size={16} />
            Share on Twitter
          </button>
        </div>
      </article>

      <BlogCommentsSidebar
        isOpen={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        blogId={blog.id}
        blogTitle={blog.title}
        onCountChange={(delta) =>
          setBlog((current) =>
            current
              ? {
                  ...current,
                  commentCount: Math.max(0, current.commentCount + delta),
                }
              : current,
          )
        }
      />
    </div>
  );
}
