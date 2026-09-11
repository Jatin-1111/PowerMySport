"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  Flag,
  Link as LinkIcon,
  Loader2,
  MessageCircle,
  Pencil,
  Trash2,
  Twitter,
} from "lucide-react";
import { blogService } from "@/modules/community/services/blog";
import { BlogDetail } from "@/modules/community/types";
import { redirectToMainLogin } from "@/lib/auth/redirect";
import { hasAuthToken } from "@/lib/auth/token";
import { getCommunitySocket, blogRoom, subscribeToCommunityRoom } from "@/lib/realtime/socket";
import { toast } from "@/lib/toast";
import { getTopicMeta } from "@/modules/community/constants/experienceTaxonomy";
import { formatBlogDate } from "@/modules/community/utils/blogFormat";
import { useReportModal } from "@/modules/community/hooks/useReportModal";
import { ReportModal } from "@/modules/community/components/chat/ReportModal";
import BlogContentRenderer from "./BlogContentRenderer";
import BlogCommentsSidebar from "./BlogCommentsSidebar";
import BlogCoverFallback from "./BlogCoverFallback";
import AuthorAvatar from "./AuthorAvatar";
import LikeButton from "./LikeButton";
import SubjectReplyBand from "./SubjectReplyBand";

const authorHref = (author: BlogDetail["author"]) =>
  author.username ? `/experiences/by/${author.username}` : `/experiences/by/${author.id}`;

export default function BlogDetailClient({
  blogId,
  initialBlog = null,
}: {
  blogId: string;
  /** Already fetched by the page for its metadata, so passing it down puts the
   *  story in the SSR HTML instead of shipping a loading message to crawlers. */
  initialBlog?: BlogDetail | null;
}) {
  const router = useRouter();
  const [blog, setBlog] = useState<BlogDetail | null>(initialBlog);
  const [isLoading, setIsLoading] = useState(!initialBlog);
  const [likePending, setLikePending] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { reportModal, handleOpenReportModal, setReportModal, isSubmittingReport, handleSubmitReportWrapper } = // prettier-ignore
    useReportModal();

  // Never swap rendered content back to a loading state on refresh — that
  // would undo the server render the moment the client hydrates.
  const hasContentRef = useRef(Boolean(initialBlog));

  const load = useCallback(async () => {
    try {
      if (!hasContentRef.current) {
        setIsLoading(true);
      }
      // This page is a shareable public link — no session required to read it.
      const data = await blogService.getBlog(blogId);
      setBlog(data);
      hasContentRef.current = true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load experience");
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
          current ? { ...current, likeCount: payload.likeCount as number } : current
        );
      }
    };
    socket.on("community:blogLiked", handleLike);
    const unsubscribe = subscribeToCommunityRoom(blogRoom(blogId));
    return () => {
      unsubscribe();
      socket.off("community:blogLiked", handleLike);
    };
  }, [blogId]);

  const handleToggleLike = async () => {
    if (!blog) return;
    if (!hasAuthToken()) {
      redirectToMainLogin();
      return;
    }
    setLikePending(true);
    const optimisticLiked = !blog.likedByMe;
    setBlog({
      ...blog,
      likedByMe: optimisticLiked,
      likeCount: Math.max(0, blog.likeCount + (optimisticLiked ? 1 : -1)),
    });
    try {
      const result = await blogService.toggleLike("EXPERIENCE", blog.id);
      setBlog((current) =>
        current ? { ...current, likedByMe: result.liked, likeCount: result.likeCount } : current
      );
    } catch (error) {
      setBlog((current) =>
        current ? { ...current, likedByMe: blog.likedByMe, likeCount: blog.likeCount } : current
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
      toast.success("Experience deleted");
      router.push("/experiences");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
      setIsDeleting(false);
    }
  };

  const confirmDelete = () => {
    toast("Delete this experience permanently?", {
      action: { label: "Delete", onClick: () => void handleDelete() },
    });
  };

  const shareOnTwitter = () => {
    if (!blog) return;
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = `${blog.title} — on PowerMySport`;
    const shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      text
    )}&url=${encodeURIComponent(url)}`;
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  };

  const copyLink = async () => {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied");
    } catch {
      toast.error("Failed to copy link");
    }
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
        <p className="text-slate-700">Experience not found.</p>
        <Link
          href="/experiences"
          className="mt-4 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
        >
          Back to Experiences
        </Link>
      </div>
    );
  }

  const topic = getTopicMeta(blog.topic);
  const coverUrl = blog.coverImageUrl || "";

  return (
    <div className="relative min-h-[calc(100vh-5.5rem)] bg-[linear-gradient(180deg,#f5f8ff_0%,#ffffff_40%)]">
      <article className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/experiences"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
          >
            <ChevronLeft size={16} />
            Back to Experiences
          </Link>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${topic.accent}`}
          >
            <topic.Icon size={13} />
            {topic.label}
          </span>
        </div>

        {/* Cover — shown whole, not cropped to a banner.
            A 16/9 box with object-cover cut the bottom off anything portrait,
            which for the documents people actually post (certificates, result
            sheets) removed the part they uploaded it for. The fallback keeps a
            fixed ratio because it is generated art with nothing to lose. */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className={`mt-5 w-full overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 ${
            coverUrl ? "" : "aspect-[16/9]"
          }`}
        >
          {coverUrl ? (
            <img
              src={coverUrl}
              alt={blog.title}
              width={blog.coverImageWidth ?? undefined}
              height={blog.coverImageHeight ?? undefined}
              className="mx-auto block h-auto max-h-[80vh] w-auto max-w-full"
            />
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
            <AuthorAvatar name={blog.author.name} photoUrl={blog.author.photoUrl} size={44} />
            <span>
              <span className="block text-sm font-semibold text-slate-900">{blog.author.name}</span>
              <span className="block text-xs text-slate-400">
                {blog.author.username ? `@${blog.author.username} · ` : ""}
                Published on {formatBlogDate(blog.createdAt)}
              </span>
            </span>
          </Link>

          {blog.isMine ? (
            <div className="flex items-center gap-2">
              <Link
                href={`/experiences/${blog.id}/edit`}
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
          ) : (
            <button
              onClick={() => handleOpenReportModal("EXPERIENCE", blog.id)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
            >
              <Flag size={13} />
              Report
            </button>
          )}
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
          <BlogContentRenderer content={blog.content} />
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

        {/* Right of reply — a coach or expert named in `subject` can post one
            response to what was written about them. */}
        {blog.subject ? (
          <SubjectReplyBand
            blog={blog}
            onReplyPosted={(reply) => setBlog((current) => (current ? { ...current, subjectReply: reply } : current))} // prettier-ignore
          />
        ) : null}

        {/* Share */}
        <div className="mt-8 flex items-center justify-between gap-3 border-t border-slate-100 pt-6">
          <p className="text-sm text-slate-500">Useful to another parent? Share it.</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void copyLink()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            >
              <LinkIcon size={16} />
              Copy Link
            </button>
            <button
              onClick={shareOnTwitter}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-600"
            >
              <Twitter size={16} />
              Share on Twitter
            </button>
          </div>
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
              : current
          )
        }
      />

      {reportModal ? (
        <ReportModal
          targetType={reportModal.targetType}
          targetId={reportModal.targetId}
          isSubmitting={isSubmittingReport}
          onClose={() => setReportModal(null)}
          onSubmit={handleSubmitReportWrapper}
        />
      ) : null}
    </div>
  );
}
