"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { BlogListItem } from "@/modules/community/types";
import { getTopicMeta } from "@/modules/community/constants/experienceTaxonomy";
import { toRelativeTime } from "@/modules/community/utils/blogFormat";
import BlogCoverFallback from "./BlogCoverFallback";
import AuthorAvatar from "./AuthorAvatar";
import LikeButton from "./LikeButton";

interface BlogCardProps {
  blog: BlogListItem;
  onToggleLike: (blog: BlogListItem) => void;
  likePending?: boolean;
}

/** An editorial tile, not a boxed card: photograph, a plain topic label, a
 *  serif headline, one meta line. Hover zooms the photo and underlines the
 *  headline; nothing lifts or casts a shadow. */
export default function BlogCard({ blog, onToggleLike, likePending }: BlogCardProps) {
  const topic = getTopicMeta(blog.topic);
  const coverUrl = blog.coverImageUrl || "";
  const authorHref = `/experiences/by/${blog.author.username || blog.author.id}`;

  return (
    <article className="group flex h-full flex-col">
      <Link
        href={`/experiences/${blog.id}`}
        aria-label={blog.title}
        tabIndex={-1}
        className="bg-paper-deep relative block aspect-[16/10] overflow-hidden rounded-2xl"
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

      <div className="mt-5 flex flex-1 flex-col">
        <p className="text-ink-muted inline-flex items-center gap-1.5 text-sm font-medium">
          <topic.Icon size={14} strokeWidth={1.5} aria-hidden="true" />
          {topic.label}
        </p>
        <Link href={`/experiences/${blog.id}`} className="mt-2 block">
          <h3 className="font-editorial text-ink decoration-ink/30 line-clamp-2 text-balance text-2xl font-normal leading-tight underline-offset-4 group-hover:underline">
            {blog.title}
          </h3>
        </Link>
        {blog.excerpt && blog.excerpt.trim() !== blog.title.trim() ? (
          <p className="text-ink-body mt-3 line-clamp-2 text-base leading-relaxed">
            {blog.excerpt}
          </p>
        ) : null}

        {/* mt-auto keeps the byline on one line across a row of tiles. */}
        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <Link href={authorHref} className="flex min-w-0 items-center gap-2.5">
            <AuthorAvatar name={blog.author.name} photoUrl={blog.author.photoUrl} size={32} />
            <span className="min-w-0">
              <span className="text-ink block truncate text-sm font-semibold">
                {blog.author.name}
              </span>
              <span className="text-ink-muted block truncate text-sm">
                {toRelativeTime(blog.createdAt)}
              </span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-1">
            <span
              className="text-ink-muted inline-flex items-center gap-1 px-2 text-sm tabular-nums"
              title={`${blog.commentCount} comments`}
            >
              <MessageCircle size={15} strokeWidth={1.5} aria-hidden="true" />
              {blog.commentCount}
            </span>
            <LikeButton
              liked={blog.likedByMe}
              count={blog.likeCount}
              onToggle={() => onToggleLike(blog)}
              disabled={likePending}
              size="sm"
            />
          </div>
        </div>
      </div>
    </article>
  );
}
