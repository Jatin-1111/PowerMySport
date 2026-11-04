"use client";

import { useState } from "react";
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
      <aside className="bg-wash mt-12 rounded-3xl p-6 sm:p-8">
        <p className="text-ink-body text-sm font-medium">
          Response from {blog.subject?.name || "the person named above"}
        </p>
        <blockquote className="border-ink mt-4 border-l-2 pl-5">
          <p className="font-editorial text-ink whitespace-pre-wrap text-xl font-light italic leading-relaxed">
            {blog.subjectReply.content}
          </p>
        </blockquote>
        <p className="text-ink-body mt-4 text-sm">
          {blog.subjectReply.authorName ? `${blog.subjectReply.authorName} · ` : ""}
          {formatBlogDate(blog.subjectReply.createdAt)}
        </p>
      </aside>
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
      toast.error(error instanceof Error ? error.message : "We could not post your reply");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <aside className="bg-wash mt-12 rounded-3xl p-6 sm:p-8">
      <h2 className="font-editorial text-ink text-2xl font-normal">This is about you</h2>
      <p className="text-ink-body mt-2 max-w-[56ch] text-base leading-relaxed">
        You can post one reply. It is shown next to the experience and cannot be edited later.
      </p>
      <label htmlFor="subject-reply" className="sr-only">
        Your reply
      </label>
      <textarea
        id="subject-reply"
        value={content}
        onChange={(event) => setContent(event.target.value)}
        maxLength={REPLY_MAX_LENGTH}
        rows={4}
        placeholder="Share your side"
        className="text-ink placeholder:text-ink-muted hover:border-ink/45 focus:border-ink mt-5 w-full resize-none rounded-md border border-[#d9d3c8] bg-white px-4 py-3 text-base leading-relaxed transition-colors duration-200 focus:outline-none"
      />
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
        <button
          type="button"
          onClick={() => void submit()}
          disabled={isSubmitting || !content.trim()}
          className="btn-motion bg-ink hover:bg-ink-hover inline-flex min-h-11 items-center rounded-md px-6 text-base font-semibold text-white disabled:opacity-50"
        >
          {isSubmitting ? "Posting" : "Post reply"}
        </button>
        <span className="text-ink-body text-sm tabular-nums">
          {content.length} of {REPLY_MAX_LENGTH}
        </span>
      </div>
    </aside>
  );
}
