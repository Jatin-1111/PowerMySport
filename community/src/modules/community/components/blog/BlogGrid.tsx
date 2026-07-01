"use client";

import { AnimatePresence } from "framer-motion";
import { LoaderCircle, Newspaper } from "lucide-react";
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
    <div className="flex flex-col overflow-hidden rounded-3xl border border-white/70 bg-white/80 shadow-sm">
      <div className="aspect-[16/10] animate-pulse bg-slate-200/70" />
      <div className="space-y-3 p-5">
        <div className="h-4 w-3/4 animate-pulse rounded-full bg-slate-200" />
        <div className="h-3 w-full animate-pulse rounded-full bg-slate-100" />
        <div className="h-3 w-2/3 animate-pulse rounded-full bg-slate-100" />
        <div className="flex items-center gap-2 pt-2">
          <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200" />
          <div className="h-3 w-24 animate-pulse rounded-full bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

export default function BlogGrid({
  blogs,
  isLoading,
  onToggleLike,
  likePendingId,
  emptyMessage = "No stories here yet. Be the first to publish one.",
}: BlogGridProps) {
  if (isLoading && blogs.length === 0) {
    return (
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <CardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (!isLoading && blogs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-white/70 px-6 py-16 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
          <Newspaper size={26} />
        </span>
        <p className="mt-4 font-semibold text-slate-700">Nothing here yet</p>
        <p className="mt-1 max-w-sm text-sm text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
        <div className="col-span-full flex justify-center py-6 text-slate-400">
          <LoaderCircle size={20} className="animate-spin" />
        </div>
      ) : null}
    </div>
  );
}
