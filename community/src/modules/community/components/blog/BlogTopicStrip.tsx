"use client";

import { motion } from "framer-motion";
import { LayoutGrid } from "lucide-react";
import { BLOG_TOPICS } from "@/modules/community/constants/blogTopics";

interface BlogTopicStripProps {
  activeTopic: string;
  onSelect: (topic: string) => void;
}

export default function BlogTopicStrip({
  activeTopic,
  onSelect,
}: BlogTopicStripProps) {
  const isAll = !activeTopic || activeTopic.toLowerCase() === "all";

  return (
    <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <button
        onClick={() => onSelect("")}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-2xl border px-3.5 py-2 text-sm font-semibold transition ${
          isAll
            ? "border-slate-900 bg-slate-900 text-white shadow-sm"
            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
        }`}
      >
        <LayoutGrid size={15} />
        All
      </button>
      {BLOG_TOPICS.map((topic) => {
        const active = activeTopic.toLowerCase() === topic.slug.toLowerCase();
        return (
          <motion.button
            key={topic.slug}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(active ? "" : topic.slug)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-2xl border px-3.5 py-2 text-sm font-semibold transition ${
              active
                ? "border-power-orange/40 bg-power-orange/10 text-power-orange shadow-sm"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
            }`}
          >
            <topic.Icon size={15} />
            {topic.label}
          </motion.button>
        );
      })}
    </div>
  );
}
