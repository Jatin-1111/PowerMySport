"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { CornerDownRight, Heart, Loader2, Trash2 } from "lucide-react";
import { BlogComment } from "@/modules/community/types";
import {
  toRelativeTime,
  formatCount,
} from "@/modules/community/utils/blogFormat";
import AuthorAvatar from "./AuthorAvatar";

interface CommentItemProps {
  comment: BlogComment;
  onToggleLike: (comment: BlogComment) => void;
  onReply: (parentId: string, content: string) => Promise<void>;
  onDelete: (comment: BlogComment) => void;
  isReply?: boolean;
}

const authorHref = (author: BlogComment["author"]) =>
  author.username
    ? `/blog/writer/${author.username}`
    : `/blog/writer/${author.id}`;

const MENTION_RE = /@([a-zA-Z0-9_]{2,30})/g;

/** Render comment text with @mentions linked to the tagged writer's page. */
const renderContent = (text: string) => {
  const nodes: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  MENTION_RE.lastIndex = 0;
  while ((match = MENTION_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        <Fragment key={key++}>{text.slice(lastIndex, match.index)}</Fragment>,
      );
    }
    const username = match[1];
    nodes.push(
      <Link
        key={key++}
        href={`/blog/writer/${username}`}
        className="font-semibold text-power-orange hover:underline"
      >
        @{username}
      </Link>,
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    nodes.push(<Fragment key={key++}>{text.slice(lastIndex)}</Fragment>);
  }
  return nodes;
};

export default function CommentItem({
  comment,
  onToggleLike,
  onReply,
  onDelete,
  isReply = false,
}: CommentItemProps) {
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const replyRef = useRef<HTMLTextAreaElement>(null);

  const mentionHandle = comment.author.username || comment.author.name;

  const toggleReply = () => {
    setShowReply((prev) => {
      const next = !prev;
      // Pre-fill with the commenter's @handle when opening a fresh reply.
      if (next && !replyText.trim()) {
        setReplyText(`@${mentionHandle} `);
      }
      return next;
    });
  };

  // Focus the reply box and drop the caret after the prefilled mention.
  useEffect(() => {
    if (!showReply) return;
    const el = replyRef.current;
    if (el) {
      el.focus();
      const end = el.value.length;
      el.setSelectionRange(end, end);
    }
  }, [showReply]);

  const submitReply = async () => {
    const value = replyText.trim();
    if (!value) return;
    setSubmitting(true);
    try {
      await onReply(comment.id, value);
      setReplyText("");
      setShowReply(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={isReply ? "" : "border-b border-slate-100 pb-4"}
    >
      <div className="flex gap-3">
        <Link href={authorHref(comment.author)} className="shrink-0">
          <AuthorAvatar
            name={comment.author.name}
            photoUrl={comment.author.photoUrl}
            size={isReply ? 30 : 36}
          />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <Link
              href={authorHref(comment.author)}
              className="text-sm font-semibold text-slate-900 hover:text-power-orange"
            >
              {comment.author.name}
            </Link>
            {comment.author.username ? (
              <span className="text-xs text-slate-400">
                @{comment.author.username}
              </span>
            ) : null}
            <span className="text-xs text-slate-400">
              · {toRelativeTime(comment.createdAt)}
            </span>
          </div>

          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700">
            {renderContent(comment.content)}
          </p>

          <div className="mt-1.5 flex items-center gap-3">
            <button
              type="button"
              onClick={() => onToggleLike(comment)}
              className={`inline-flex items-center gap-1 text-xs font-semibold transition ${
                comment.likedByMe
                  ? "text-rose-600"
                  : "text-slate-400 hover:text-rose-500"
              }`}
            >
              <Heart
                size={13}
                className={
                  comment.likedByMe ? "fill-rose-500 text-rose-500" : ""
                }
              />
              {comment.likeCount > 0 ? formatCount(comment.likeCount) : "Like"}
            </button>
            <button
              type="button"
              onClick={toggleReply}
              className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 transition hover:text-slate-700"
            >
              <CornerDownRight size={13} />
              Reply
            </button>
            {comment.isMine ? (
              <button
                type="button"
                onClick={() => onDelete(comment)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-slate-400 transition hover:text-rose-600"
              >
                <Trash2 size={13} />
              </button>
            ) : null}
          </div>

          {showReply ? (
            <div className="mt-2 flex items-end gap-2">
              <textarea
                ref={replyRef}
                value={replyText}
                onChange={(event) => setReplyText(event.target.value)}
                rows={2}
                placeholder={`Reply to ${comment.author.name}...`}
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-power-orange focus:outline-none focus:ring-1 focus:ring-power-orange"
              />
              <button
                type="button"
                onClick={() => void submitReply()}
                disabled={submitting || !replyText.trim()}
                className="inline-flex h-9 shrink-0 items-center gap-1 rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  "Send"
                )}
              </button>
            </div>
          ) : null}

          {/* One-level replies */}
          {comment.replies && comment.replies.length > 0 ? (
            <div className="mt-3 space-y-3 border-l-2 border-slate-100 pl-3">
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  onToggleLike={onToggleLike}
                  onReply={onReply}
                  onDelete={onDelete}
                  isReply
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
