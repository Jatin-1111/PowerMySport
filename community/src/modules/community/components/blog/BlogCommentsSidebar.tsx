"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { blogService } from "@/modules/community/services/blog";
import { BlogComment } from "@/modules/community/types";
import { toast } from "@/lib/toast";
import { redirectToMainLogin } from "@/lib/auth/redirect";
import { hasAuthToken } from "@/lib/auth/token";
import CommentItem from "./CommentItem";
import EmojiPicker from "./EmojiPicker";

interface BlogCommentsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  blogId: string;
  blogTitle: string;
  onCountChange: (delta: number) => void;
}

// Recursively update a comment (top-level or reply) by id.
const patchComment = (
  comments: BlogComment[],
  id: string,
  patch: (comment: BlogComment) => BlogComment
): BlogComment[] =>
  comments.map((comment) => {
    if (comment.id === id) return patch(comment);
    if (comment.replies?.length) {
      return { ...comment, replies: patchComment(comment.replies, id, patch) };
    }
    return comment;
  });

export default function BlogCommentsSidebar({
  isOpen,
  onClose,
  blogId,
  blogTitle,
  onCountChange,
}: BlogCommentsSidebarProps) {
  const [comments, setComments] = useState<BlogComment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setMounted(true), []);

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await blogService.listComments(blogId, 1, 50);
      setComments(data.items || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We could not load the comments");
    } finally {
      setIsLoading(false);
    }
  }, [blogId]);

  useEffect(() => {
    if (isOpen) void load();
  }, [isOpen, load]);

  const submitComment = async () => {
    const value = draft.trim();
    if (!value) return;
    if (!hasAuthToken()) {
      redirectToMainLogin();
      return;
    }
    setSubmitting(true);
    try {
      const created = await blogService.createComment(blogId, value);
      setComments((current) => [created, ...current]);
      setDraft("");
      onCountChange(1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (parentId: string, content: string) => {
    if (!hasAuthToken()) {
      redirectToMainLogin();
      return;
    }
    try {
      const created = await blogService.createComment(blogId, content, parentId);
      const topLevelId = created.parentId || parentId;
      setComments((current) =>
        patchComment(current, topLevelId, (comment) => ({
          ...comment,
          replies: [...(comment.replies || []), created],
        }))
      );
      onCountChange(1);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to post reply");
    }
  };

  const handleToggleLike = async (comment: BlogComment) => {
    if (!hasAuthToken()) {
      redirectToMainLogin();
      return;
    }
    const optimisticLiked = !comment.likedByMe;
    setComments((current) =>
      patchComment(current, comment.id, (item) => ({
        ...item,
        likedByMe: optimisticLiked,
        likeCount: Math.max(0, item.likeCount + (optimisticLiked ? 1 : -1)),
      }))
    );
    try {
      const result = await blogService.toggleLike("COMMENT", comment.id);
      setComments((current) =>
        patchComment(current, comment.id, (item) => ({
          ...item,
          likedByMe: result.liked,
          likeCount: result.likeCount,
        }))
      );
    } catch (error) {
      setComments((current) =>
        patchComment(current, comment.id, (item) => ({
          ...item,
          likedByMe: comment.likedByMe,
          likeCount: comment.likeCount,
        }))
      );
      toast.error(error instanceof Error ? error.message : "Failed to react");
    }
  };

  const handleDelete = async (comment: BlogComment) => {
    try {
      await blogService.deleteComment(comment.id);
      // Remove the comment (and detach if it's a reply).
      setComments((current) => {
        const withoutTop = current.filter((item) => item.id !== comment.id);
        return withoutTop.map((item) => ({
          ...item,
          replies: (item.replies || []).filter((reply) => reply.id !== comment.id),
        }));
      });
      onCountChange(-1);
      toast.success("Comment deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete comment");
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="bg-ink/30 fixed inset-0 z-[300]"
            aria-hidden="true"
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="blog-comments-title"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="bg-paper fixed right-0 top-0 z-[301] flex h-dvh w-full max-w-md flex-col"
          >
            <div className="border-hairline flex items-start justify-between gap-3 border-b px-6 py-5">
              <div className="min-w-0">
                <h2
                  id="blog-comments-title"
                  className="font-editorial text-ink text-3xl font-light"
                >
                  Comments
                </h2>
                <p className="text-ink-muted mt-1 line-clamp-1 text-sm">{blogTitle}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close comments"
                className="text-ink-body hover:bg-paper-deep hover:text-ink -mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-md transition-colors duration-200"
              >
                <X size={20} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>

            <div className="border-hairline border-b px-6 py-4">
              <label htmlFor="blog-comment-draft" className="sr-only">
                Leave a comment
              </label>
              <div className="focus-within:border-ink hover:border-ink/45 rounded-md border border-[#d9d3c8] bg-white transition-colors duration-200">
                <textarea
                  id="blog-comment-draft"
                  ref={textareaRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={3}
                  placeholder="Leave a comment"
                  className="text-ink placeholder:text-ink-muted w-full resize-none bg-transparent px-4 pt-3 text-base outline-none"
                />
                <div className="flex items-center justify-between px-2 pb-2">
                  <EmojiPicker onSelect={(emoji) => setDraft((prev) => prev + emoji)} />
                  <button
                    type="button"
                    onClick={() => void submitComment()}
                    disabled={submitting || !draft.trim()}
                    className="btn-motion bg-power-orange-solid inline-flex min-h-10 items-center rounded-md px-5 text-base font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {submitting ? "Posting" : "Comment"}
                  </button>
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              {isLoading ? (
                <div aria-busy="true" aria-label="Loading comments" className="space-y-6">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex gap-3">
                      <div className="bg-ink/10 h-9 w-9 shrink-0 animate-pulse rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="bg-ink/10 h-4 w-32 animate-pulse rounded-sm" />
                        <div className="bg-ink/10 h-4 w-full animate-pulse rounded-sm" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : comments.length === 0 ? (
                <div className="py-10">
                  <p className="font-editorial text-ink text-2xl font-normal">No comments yet.</p>
                  <p className="text-ink-body mt-2 text-base leading-relaxed">
                    Add what you would want another parent to know.
                  </p>
                </div>
              ) : (
                <div>
                  {comments.map((comment) => (
                    <CommentItem
                      key={comment.id}
                      comment={comment}
                      onToggleLike={handleToggleLike}
                      onReply={handleReply}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
