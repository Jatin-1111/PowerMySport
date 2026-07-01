"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Heart, MessageCircle, Pencil, Trash2 } from "lucide-react";
import { BlogListItem } from "@/modules/community/types";
import { getBlogTopic } from "@/modules/community/constants/blogTopics";
import { formatBlogDate, formatCount } from "@/modules/community/utils/blogFormat";
import BlogCoverFallback from "./BlogCoverFallback";

interface MyBlogListItemProps {
  blog: BlogListItem;
  owner?: boolean;
  onDelete?: (blog: BlogListItem) => void;
}

export default function MyBlogListItem({
  blog,
  owner,
  onDelete,
}: MyBlogListItemProps) {
  const topic = getBlogTopic(blog.topic);
  const coverUrl = blog.coverImageUrl || "";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="group flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 transition hover:border-power-orange/30 hover:shadow-md sm:gap-4 sm:p-4"
    >
      {/* Banner */}
      <Link
        href={`/blog/${blog.id}`}
        className="relative h-24 w-28 shrink-0 overflow-hidden rounded-xl sm:h-28 sm:w-40"
      >
        {coverUrl ? (
          <img src={coverUrl} alt={blog.title} className="h-full w-full object-cover" />
        ) : (
          <BlogCoverFallback topic={blog.topic} />
        )}
      </Link>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <Link href={`/blog/${blog.id}`} className="min-w-0">
          <h3 className="font-title truncate text-base font-bold text-slate-900 transition group-hover:text-power-orange sm:text-lg">
            {blog.title}
          </h3>
        </Link>
        {blog.excerpt ? (
          <p className="mt-1 line-clamp-2 text-sm text-slate-500">{blog.excerpt}</p>
        ) : null}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${topic.accent}`}
          >
            <topic.Icon size={12} />
            {topic.label}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-600">
            <Heart size={12} className="fill-rose-500 text-rose-500" />
            {formatCount(blog.likeCount)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
            <MessageCircle size={12} />
            {blog.commentCount}
          </span>
          <span className="ml-auto hidden text-[11px] text-slate-400 sm:block">
            {formatBlogDate(blog.createdAt)}
          </span>
        </div>

        {owner ? (
          <div className="mt-2 flex items-center gap-2">
            <Link
              href={`/blog/edit/${blog.id}`}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
            >
              <Pencil size={12} />
              Edit
            </Link>
            <button
              type="button"
              onClick={() => onDelete?.(blog)}
              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-100"
            >
              <Trash2 size={12} />
              Delete
            </button>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
