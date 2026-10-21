"use client";

import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { Heart } from "lucide-react";
import { BlogComment } from "@/modules/community/types";
import { toRelativeTime, formatCount } from "@/modules/community/utils/blogFormat";
import AuthorAvatar from "./AuthorAvatar";

interface CommentItemProps {
  comment: BlogComment;
  onToggleLike: (comment: BlogComment) => void;
  onReply: (parentId: string, content: string) => Promise<void>;
  onDelete: (comment: BlogComment) => void;
  isReply?: boolean;
}

const authorHref = (author: BlogComment["author"]) =>
  author.username ? `/experiences/by/${author.username}` : `/experiences/by/${author.id}`;

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
      nodes.push(<Fragment key={key++}>{text.slice(lastIndex, match.index)}</Fragment>);
    }
    const username = match[1];
    nodes.push(
      <Link
        key={key++}
        href={`/experiences/by/${username}`}
        className="text-power-orange-solid font-semibold hover:underline"
      >
        @{username}
      </Link>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    nodes.push(<Fragment key={key++}>{text.slice(lastIndex)}</Fragment>);
  }
  return nodes;
};

const action =
  "text-ink-muted hover:text-ink inline-flex min-h-9 items-center gap-1.5 text-sm font-medium transition-colors duration-200";

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
    <div className={isReply ? "" : "border-hairline border-b py-5 first:pt-0"}>
      <div className="flex gap-3">
        <Link href={authorHref(comment.author)} className="shrink-0" tabIndex={-1} aria-hidden>
          <AuthorAvatar
            name={comment.author.name}
            photoUrl={comment.author.photoUrl}
            size={isReply ? 28 : 34}
          />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <Link
              href={authorHref(comment.author)}
              className="text-ink text-base font-semibold hover:underline"
            >
              {comment.author.name}
            </Link>
            <span className="text-ink-muted">
              {comment.author.username ? `@${comment.author.username} · ` : ""}
              {toRelativeTime(comment.createdAt)}
            </span>
          </p>

          <p className="text-ink-body mt-1 whitespace-pre-wrap break-words text-base leading-relaxed">
            {renderContent(comment.content)}
          </p>

          <div className="mt-1 flex items-center gap-4">
            <button
              type="button"
              onClick={() => onToggleLike(comment)}
              aria-pressed={comment.likedByMe}
              aria-label={comment.likedByMe ? "Remove like" : "Like comment"}
              className={`${action} ${comment.likedByMe ? "text-indigo-700" : ""}`}
            >
              <Heart
                size={15}
                strokeWidth={1.5}
                className={comment.likedByMe ? "fill-power-orange text-power-orange-solid" : ""}
                aria-hidden="true"
              />
              {comment.likeCount > 0 ? formatCount(comment.likeCount) : "Like"}
            </button>
            <button
              type="button"
              onClick={toggleReply}
              aria-expanded={showReply}
              className={action}
            >
              Reply
            </button>
            {comment.isMine ? (
              <button
                type="button"
                onClick={() => onDelete(comment)}
                className={`${action} hover:text-red-700`}
              >
                Delete
              </button>
            ) : null}
          </div>

          {showReply ? (
            <div className="mt-2 flex flex-col gap-3">
              <textarea
                ref={replyRef}
                value={replyText}
                onChange={(event) => setReplyText(event.target.value)}
                aria-label={`Reply to ${comment.author.name}`}
                rows={2}
                placeholder={`Reply to ${comment.author.name}`}
                className="text-ink placeholder:text-ink-muted hover:border-ink/45 focus:border-ink w-full resize-none rounded-md border border-[#d9d3c8] bg-white px-3 py-2.5 text-base transition-colors duration-200 focus:outline-none"
              />
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => void submitReply()}
                  disabled={submitting || !replyText.trim()}
                  className="btn-motion bg-ink hover:bg-ink-hover inline-flex min-h-10 items-center rounded-md px-5 text-base font-semibold text-white disabled:opacity-50"
                >
                  {submitting ? "Sending" : "Send reply"}
                </button>
                <button type="button" onClick={() => setShowReply(false)} className={action}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {comment.replies && comment.replies.length > 0 ? (
            <div className="border-ink/20 mt-4 space-y-4 border-l-2 pl-4">
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
    </div>
  );
}
