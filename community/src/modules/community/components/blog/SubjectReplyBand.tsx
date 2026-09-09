"use client";

import { useState } from "react";
import { MessageSquareQuote, Send } from "lucide-react";
import { blogService } from "@/modules/community/services/blog";
import { BlogDetail } from "@/modules/community/types";
import { toast } from "@/lib/toast";
import { formatBlogDate } from "@/modules/community/utils/blogFormat";

interface SubjectReplyBandProps {
  blog: BlogDetail;
  onReplyPosted: (reply: NonNullable<BlogDetail["subjectReply"]>) => void;
}

const REPLY_MAX_LENGTH = 2000;

/**
 * The named coach or expert's one right of reply to what a parent wrote about
 * them. Renders one of three things: the reply itself if it exists, a
 * composer if the current viewer is verified server-side as that specific
 * person (`canReply`) and no reply exists yet, or nothing at all otherwise —
 * this band is invisible to every other viewer, on purpose.
 */
export default function SubjectReplyBand({ blog, onReplyPosted }: SubjectReplyBandProps) {
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (blog.subjectReply) {
    return (
      <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <MessageSquareQuote size={14} />
          Response from {blog.subject?.name || "the person named above"}
        </div>
        <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
          {blog.subjectReply.content}
        </p>
        <p className="mt-2 text-xs text-slate-400">
          {blog.subjectReply.authorName ? `${blog.subjectReply.authorName} · ` : ""}
          {formatBlogDate(blog.subjectReply.createdAt)}
        </p>
      </div>
    );
  }

  if (!blog.canReply) {
    return null;
  }

  const submit = async () => {
    const trimmed = content.trim();
    if (!trimmed) {
      toast.error("Write something before posting your reply");
      return;
    }
    setIsSubmitting(true);
    try {
      const updated = await blogService.postSubjectReply(blog.id, trimmed);
      if (updated.subjectReply) {
        onReplyPosted(updated.subjectReply);
      }
      toast.success("Your reply is posted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to post your reply");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
        <MessageSquareQuote size={14} />
        This is about you — you can post one reply
      </div>
      <textarea
        value={content}
        onChange={(event) => setContent(event.target.value)}
        maxLength={REPLY_MAX_LENGTH}
        rows={3}
        placeholder="Share your side — this is shown alongside the experience, and can only be posted once."
        className="mt-2 w-full resize-none rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-amber-400"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-amber-700">
          {content.length}/{REPLY_MAX_LENGTH}
        </span>
        <button
          onClick={() => void submit()}
          disabled={isSubmitting || !content.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
        >
          <Send size={13} />
          Post reply
        </button>
      </div>
    </div>
  );
}
