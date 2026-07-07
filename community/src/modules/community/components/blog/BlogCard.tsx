"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { BlogListItem } from "@/modules/community/types";
import { getBlogTopic } from "@/modules/community/constants/blogTopics";
import { toRelativeTime } from "@/modules/community/utils/blogFormat";
import BlogCoverFallback from "./BlogCoverFallback";
import AuthorAvatar from "./AuthorAvatar";
import LikeButton from "./LikeButton";

interface BlogCardProps {
  blog: BlogListItem;
  onToggleLike: (blog: BlogListItem) => void;
  likePending?: boolean;
}

export default function BlogCard({
  blog,
  onToggleLike,
  likePending,
}: BlogCardProps) {
  const topic = getBlogTopic(blog.topic);
  const coverUrl = blog.coverImageUrl || "";

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      whileHover={{ y: -4 }}
      className="group flex h-full flex-col overflow-hidden rounded-3xl border border-white/70 bg-white/90 shadow-sm backdrop-blur-sm transition hover:border-power-orange/30 hover:shadow-xl hover:shadow-slate-900/5"
    >
      {/* Cover */}
      <Link
        href={`/blog/${blog.id}`}
        className="relative block aspect-[16/10] overflow-hidden"
      >
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={blog.title}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <BlogCoverFallback topic={blog.topic} />
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur-sm ${topic.accent}`}
          >
            <topic.Icon size={12} />
            {topic.label}
          </span>
        </div>
      </Link>

      {/* Body */}
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <Link href={`/blog/${blog.id}`} className="block">
          <h3 className="font-title text-lg font-bold leading-snug text-slate-900 transition-colors line-clamp-2 group-hover:text-power-orange">
            {blog.title}
          </h3>
        </Link>
        {blog.excerpt ? (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-500">
            {blog.excerpt}
          </p>
        ) : null}

        {blog.tags.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {blog.tags.slice(0, 3).map((tag) => (
              <span
                key={`${blog.id}-${tag}`}
                className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500"
              >
                #{tag}
              </span>
            ))}
          </div>
        ) : null}

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
          <Link
            href={
              blog.author.username
                ? `/blog/writer/${blog.author.username}`
                : `/blog/writer/${blog.author.id}`
            }
            className="flex min-w-0 items-center gap-2"
          >
            <AuthorAvatar
              name={blog.author.name}
              photoUrl={blog.author.photoUrl}
              size={34}
            />
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-slate-800">
                {blog.author.name}
              </span>
              <span className="block truncate text-[11px] text-slate-400">
                {blog.author.username ? `@${blog.author.username}` : ""}
                {blog.author.username ? " · " : ""}
                {toRelativeTime(blog.createdAt)}
              </span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-500">
              <MessageCircle size={13} />
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
    </motion.article>
  );
}
