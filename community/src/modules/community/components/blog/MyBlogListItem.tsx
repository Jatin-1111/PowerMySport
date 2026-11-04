"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { BlogListItem } from "@/modules/community/types";
import { getTopicMeta } from "@/modules/community/constants/experienceTaxonomy";
import { formatBlogDate, formatCount } from "@/modules/community/utils/blogFormat";
import BlogCoverFallback from "./BlogCoverFallback";

interface MyBlogListItemProps {
  blog: BlogListItem;
  owner?: boolean;
  onDelete?: (blog: BlogListItem) => void;
}

/** A writer's post as a ruled row: small photo, serif title, one meta line.
 *  Owner actions are text links under the row. */
export default function MyBlogListItem({ blog, owner, onDelete }: MyBlogListItemProps) {
  const topic = getTopicMeta(blog.topic);
  const coverUrl = blog.coverImageUrl || "";

  return (
    <li className="border-hairline group flex gap-4 border-b py-6 sm:gap-6">
      <Link
        href={`/experiences/${blog.id}`}
        aria-label={blog.title}
        tabIndex={-1}
        className="bg-paper-deep relative h-24 w-28 shrink-0 overflow-hidden rounded-xl sm:h-28 sm:w-44"
      >
        {coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            className="h-full w-full object-cover saturate-[0.85] transition-transform duration-700 ease-out group-hover:scale-[1.04]"
          />
        ) : (
          <BlogCoverFallback topic={blog.topic} />
        )}
      </Link>

      <div className="flex min-w-0 flex-1 flex-col">
        <p className="text-ink-muted inline-flex items-center gap-1.5 text-sm">
          <topic.Icon size={13} strokeWidth={1.5} aria-hidden="true" />
          {topic.label}
          {blog.status === "DRAFT" ? <span className="text-ink font-semibold">· Draft</span> : null}
        </p>
        <Link href={`/experiences/${blog.id}`} className="mt-1 min-w-0">
          <h3 className="font-editorial text-ink decoration-ink/30 line-clamp-2 text-xl font-normal leading-tight underline-offset-4 group-hover:underline sm:text-2xl">
            {blog.title}
          </h3>
        </Link>
        {blog.excerpt && blog.excerpt.trim() !== blog.title.trim() ? (
          <p className="text-ink-body mt-2 line-clamp-2 text-base leading-relaxed max-sm:hidden">
            {blog.excerpt}
          </p>
        ) : null}

        <div className="text-ink-muted mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-3 text-sm tabular-nums">
          <span>{formatBlogDate(blog.createdAt)}</span>
          <span>
            {formatCount(blog.likeCount)} {blog.likeCount === 1 ? "like" : "likes"}
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageCircle size={14} strokeWidth={1.5} aria-hidden="true" />
            {blog.commentCount}
          </span>
        </div>

        {owner ? (
          <div className="mt-3 flex items-center gap-5 text-sm font-semibold">
            <Link
              href={`/experiences/${blog.id}/edit`}
              className="text-ink decoration-ink/30 hover:decoration-ink underline underline-offset-4 transition-colors duration-200"
            >
              Edit
            </Link>
            <button
              type="button"
              onClick={() => onDelete?.(blog)}
              className="text-red-700 underline decoration-red-700/30 underline-offset-4 transition-colors duration-200 hover:decoration-red-700"
            >
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </li>
  );
}
