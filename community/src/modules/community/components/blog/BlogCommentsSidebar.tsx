"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, MessageCircle, Send, X } from "lucide-react";
import { blogService } from "@/modules/community/services/blog";
import { BlogComment } from "@/modules/community/types";
import { toast } from "@/lib/toast";
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
  patch: (comment: BlogComment) => BlogComment,
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
      toast.error(
        error instanceof Error ? error.message : "Failed to load comments",
      );
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
    setSubmitting(true);
    try {
      const created = await blogService.createComment(blogId, value);
      setComments((current) => [created, ...current]);
      setDraft("");
      onCountChange(1);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to post comment",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = async (parentId: string, content: string) => {
    try {
      const created = await blogService.createComment(blogId, content, parentId);
      const topLevelId = created.parentId || parentId;
      setComments((current) =>
        patchComment(current, topLevelId, (comment) => ({
          ...comment,
          replies: [...(comment.replies || []), created],
        })),
      );
      onCountChange(1);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to post reply",
      );
    }
  };

  const handleToggleLike = async (comment: BlogComment) => {
    const optimisticLiked = !comment.likedByMe;
    setComments((current) =>
      patchComment(current, comment.id, (item) => ({
        ...item,
        likedByMe: optimisticLiked,
        likeCount: Math.max(0, item.likeCount + (optimisticLiked ? 1 : -1)),
      })),
    );
    try {
      const result = await blogService.toggleLike("COMMENT", comment.id);
      setComments((current) =>
        patchComment(current, comment.id, (item) => ({
          ...item,
          likedByMe: result.liked,
          likeCount: result.likeCount,
        })),
      );
    } catch (error) {
      setComments((current) =>
        patchComment(current, comment.id, (item) => ({
          ...item,
          likedByMe: comment.likedByMe,
          likeCount: comment.likeCount,
        })),
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
      toast.error(
        error instanceof Error ? error.message : "Failed to delete comment",
      );
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <>
          <div
            onClick={onClose}
            className="fixed inset-0 z-[300]"
            aria-hidden="true"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 z-[301] flex h-dvh w-full max-w-md flex-col bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <h2 className="font-title text-lg font-bold text-slate-900">
                  Comments
                </h2>
                <p className="mt-0.5 line-clamp-1 text-sm text-slate-500">
                  {blogTitle}
                </p>
              </div>
              <button
                onClick={onClose}
                aria-label="Close comments"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {/* Composer */}
            <div className="border-b border-slate-100 px-5 py-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 focus-within:border-power-orange/50 focus-within:bg-white">
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={2}
                  placeholder="Leave a comment..."
                  className="w-full resize-none bg-transparent px-3 pt-2.5 text-sm text-slate-800 placeholder:text-slate-400 outline-none"
                />
                <div className="flex items-center justify-between px-1.5 pb-1.5">
                  <EmojiPicker
                    onSelect={(emoji) => setDraft((prev) => prev + emoji)}
                  />
                  <button
                    onClick={() => void submitComment()}
                    disabled={submitting || !draft.trim()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-power-orange px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#d96610] disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Send size={15} />
                    )}
                    Comment
                  </button>
                </div>
              </div>
            </div>

            {/* List */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {isLoading ? (
                <div className="flex justify-center py-10 text-slate-400">
                  <Loader2 size={22} className="animate-spin" />
                </div>
              ) : comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <MessageCircle size={22} />
                  </span>
                  <p className="mt-3 font-semibold text-slate-700">
                    No comments yet
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Be the first to share your thoughts.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <AnimatePresence initial={false}>
                    {comments.map((comment) => (
                      <CommentItem
                        key={comment.id}
                        comment={comment}
                        onToggleLike={handleToggleLike}
                        onReply={handleReply}
                        onDelete={handleDelete}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
