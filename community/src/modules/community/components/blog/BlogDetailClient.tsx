"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Flag,
  Link as LinkIcon,
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
    const text = `${blog.title} on PowerMySport`;
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
      <div
        aria-busy="true"
        aria-label="Loading experience"
        className="mx-auto w-full max-w-3xl space-y-4 px-4 py-12 sm:px-6"
      >
        <div className="bg-ink/10 h-3 w-28 animate-pulse rounded-sm" />
        <div className="bg-ink/10 h-12 w-4/5 animate-pulse rounded-sm" />
        <div className="bg-ink/10 mt-8 aspect-[16/9] animate-pulse rounded-2xl" />
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <div className="bg-paper-deep rounded-3xl px-6 py-16 text-center">
          <p className="font-editorial text-ink text-4xl font-light">Experience not found.</p>
          <p className="text-ink-body mx-auto mt-3 max-w-[44ch] text-base leading-relaxed">
            It may have been deleted, or the link may be wrong.
          </p>
          <Link
            href="/experiences"
            className="btn-motion bg-power-orange-solid mt-7 inline-flex min-h-11 items-center rounded-md px-6 text-base font-semibold text-white hover:bg-indigo-700"
          >
            Back to experiences
          </Link>
        </div>
      </div>
    );
  }

  const topic = getTopicMeta(blog.topic);
  const coverUrl = blog.coverImageUrl || "";
  const textLink =
    "text-ink decoration-ink/30 hover:decoration-ink inline-flex min-h-11 items-center gap-1.5 text-base font-semibold underline underline-offset-4 transition-colors duration-200 disabled:opacity-50";

  return (
    <div className="bg-paper relative min-h-[calc(100vh-5.5rem)]">
      <article className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <Link
          href="/experiences"
          className="text-ink-body hover:text-ink inline-flex min-h-11 items-center gap-1.5 text-base font-medium transition-colors duration-200"
        >
          <ChevronLeft size={18} strokeWidth={1.5} aria-hidden="true" />
          All experiences
        </Link>

        <header className="mt-6">
          <p className="text-ink-muted inline-flex items-center gap-1.5 text-sm font-medium">
            <topic.Icon size={14} strokeWidth={1.5} aria-hidden="true" />
            {topic.label}
          </p>
          <h1 className="font-editorial text-ink mt-3 text-balance text-4xl font-light leading-[1.08] sm:text-5xl lg:text-6xl">
            {blog.title}
          </h1>

          <div className="border-hairline mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-y py-5">
            <Link href={authorHref(blog.author)} className="flex items-center gap-3">
              <AuthorAvatar name={blog.author.name} photoUrl={blog.author.photoUrl} size={44} />
              <span>
                <span className="text-ink block text-base font-semibold">{blog.author.name}</span>
                <span className="text-ink-muted block text-sm">
                  {blog.author.username ? `@${blog.author.username} · ` : ""}
                  {formatBlogDate(blog.createdAt)}
                </span>
              </span>
            </Link>

            {blog.isMine ? (
              <div className="flex items-center gap-5">
                <Link href={`/experiences/${blog.id}/edit`} className={textLink}>
                  <Pencil size={14} strokeWidth={1.5} aria-hidden="true" />
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="inline-flex min-h-11 items-center gap-1.5 text-base font-semibold text-red-700 underline decoration-red-700/30 underline-offset-4 transition-colors duration-200 hover:decoration-red-700 disabled:opacity-50"
                >
                  <Trash2 size={14} strokeWidth={1.5} aria-hidden="true" />
                  Delete
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => handleOpenReportModal("EXPERIENCE", blog.id)}
                className="text-ink-muted hover:text-ink inline-flex min-h-11 items-center gap-1.5 text-sm font-medium transition-colors duration-200"
              >
                <Flag size={14} strokeWidth={1.5} aria-hidden="true" />
                Report
              </button>
            )}
          </div>
        </header>

        {/* Cover, shown whole rather than cropped to a banner. A 16/9 box with
            object-cover cut the bottom off anything portrait, which for the
            documents people actually post (certificates, result sheets) removed
            the part they uploaded it for. The fallback keeps a fixed ratio
            because it is generated art with nothing to lose. */}
        <div
          className={`bg-paper-deep mt-8 w-full overflow-hidden rounded-2xl ${
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
        </div>

        <div className="mt-10">
          <BlogContentRenderer content={blog.content} />
        </div>

        {blog.tags.length > 0 ? (
          <p className="text-ink-muted mt-10 text-sm">
            {blog.tags.map((tag) => `#${tag}`).join(" ")}
          </p>
        ) : null}

        {/* Right of reply: a coach or expert named in `subject` can post one
            response to what was written about them. */}
        {blog.subject ? (
          <SubjectReplyBand
            blog={blog}
            onReplyPosted={(reply) => setBlog((current) => (current ? { ...current, subjectReply: reply } : current))} // prettier-ignore
          />
        ) : null}

        <div className="border-hairline mt-12 flex flex-wrap items-center justify-between gap-x-6 gap-y-4 border-t pt-6">
          <div className="flex items-center gap-3">
            <LikeButton
              liked={blog.likedByMe}
              count={blog.likeCount}
              onToggle={handleToggleLike}
              disabled={likePending}
              size="lg"
            />
            <button
              type="button"
              onClick={() => setCommentsOpen(true)}
              className="btn-motion text-ink-muted hover:bg-paper-deep hover:text-ink inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold tabular-nums"
            >
              <MessageCircle size={18} strokeWidth={1.5} aria-hidden="true" />
              {blog.commentCount} {blog.commentCount === 1 ? "comment" : "comments"}
            </button>
          </div>

          <div className="flex items-center gap-5">
            <button type="button" onClick={() => void copyLink()} className={textLink}>
              <LinkIcon size={15} strokeWidth={1.5} aria-hidden="true" />
              Copy link
            </button>
            <button type="button" onClick={shareOnTwitter} className={textLink}>
              <Twitter size={15} strokeWidth={1.5} aria-hidden="true" />
              Share on X
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
