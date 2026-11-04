"use client";

import { AnimatePresence } from "framer-motion";
import { BlogListItem } from "@/modules/community/types";
import BlogCard from "./BlogCard";

interface BlogGridProps {
  blogs: BlogListItem[];
  isLoading: boolean;
  onToggleLike: (blog: BlogListItem) => void;
  likePendingId?: string | null;
  emptyMessage?: string;
}

function CardSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="bg-ink/10 aspect-[16/10] animate-pulse rounded-2xl" />
      <div className="bg-ink/10 mt-5 h-3 w-20 animate-pulse rounded-sm" />
      <div className="bg-ink/10 mt-3 h-6 w-3/4 animate-pulse rounded-sm" />
      <div className="bg-ink/10 mt-3 h-4 w-full animate-pulse rounded-sm" />
    </div>
  );
}

export default function BlogGrid({
  blogs,
  isLoading,
  onToggleLike,
  likePendingId,
  emptyMessage = "Be the first parent to share this.",
}: BlogGridProps) {
  if (isLoading && blogs.length === 0) {
    return (
      <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (!isLoading && blogs.length === 0) {
    return (
      <div className="bg-paper-deep rounded-2xl px-6 py-16 text-center">
        <p className="font-editorial text-ink text-3xl font-light">Nothing here yet.</p>
        <p className="text-ink-body mx-auto mt-3 max-w-[44ch] text-base leading-relaxed">
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
      <AnimatePresence mode="popLayout">
        {blogs.map((blog) => (
          <BlogCard
            key={blog.id}
            blog={blog}
            onToggleLike={onToggleLike}
            likePending={likePendingId === blog.id}
          />
        ))}
      </AnimatePresence>
      {isLoading ? (
        <p role="status" className="text-ink-muted col-span-full py-4 text-center text-sm">
          Updating
        </p>
      ) : null}
    </div>
  );
}
