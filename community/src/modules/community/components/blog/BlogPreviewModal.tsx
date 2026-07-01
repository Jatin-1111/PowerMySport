"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { BlogBlock } from "@/modules/community/types";
import { getBlogTopic } from "@/modules/community/constants/blogTopics";
import { formatBlogDate } from "@/modules/community/utils/blogFormat";
import BlogContentRenderer from "./BlogContentRenderer";
import BlogCoverFallback from "./BlogCoverFallback";
import AuthorAvatar from "./AuthorAvatar";

interface BlogPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  topic: string;
  coverImageUrl?: string | null;
  blocks: BlogBlock[];
  authorName: string;
  authorUsername: string;
  authorPhotoUrl?: string | null;
}

export default function BlogPreviewModal({
  isOpen,
  onClose,
  title,
  topic,
  coverImageUrl,
  blocks,
  authorName,
  authorUsername,
  authorPhotoUrl,
}: BlogPreviewModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const topicMeta = getBlogTopic(topic);
  const coverUrl = coverImageUrl || "";

  return createPortal(
    <AnimatePresence>
      {isOpen ? (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[400] bg-slate-900/50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 20 }}
            transition={{ type: "spring", damping: 26, stiffness: 300 }}
            className="fixed inset-0 z-[401] flex items-center justify-center p-3 sm:p-6"
          >
            <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-slate-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                    Preview
                  </span>
                  <span className="text-sm text-slate-500">
                    How your story will look
                  </span>
                </div>
                <button
                  onClick={onClose}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="overflow-y-auto px-5 py-6 sm:px-8">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${topicMeta.accent}`}
                >
                  <topicMeta.Icon size={13} />
                  {topicMeta.label}
                </span>

                <div className="mt-4 aspect-[16/9] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                  {coverUrl ? (
                    <img src={coverUrl} alt={title} className="h-full w-full object-cover" />
                  ) : (
                    <BlogCoverFallback topic={topic} />
                  )}
                </div>

                <h1 className="font-title mt-5 text-3xl font-bold leading-tight tracking-tight text-slate-900">
                  {title || "Untitled story"}
                </h1>

                <div className="mt-3 flex items-center gap-3 border-b border-slate-100 pb-5">
                  <AuthorAvatar name={authorName} photoUrl={authorPhotoUrl} size={40} />
                  <span>
                    <span className="block text-sm font-semibold text-slate-900">
                      {authorName}
                    </span>
                    <span className="block text-xs text-slate-400">
                      {authorUsername ? `@${authorUsername} · ` : ""}
                      Published on {formatBlogDate(new Date().toISOString())}
                    </span>
                  </span>
                </div>

                <div className="mt-6">
                  <BlogContentRenderer blocks={blocks} />
                </div>
              </div>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}
