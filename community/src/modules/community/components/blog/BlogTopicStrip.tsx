"use client";

import { LayoutGrid } from "lucide-react";
import { ALL_TOPICS } from "@/modules/community/constants/experienceTaxonomy";

interface BlogTopicStripProps {
  activeTopic: string;
  onSelect: (topic: string) => void;
}

const chip =
  "btn-motion inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md border px-4 text-base font-medium";
const idle = "border-hairline text-ink-body hover:border-ink/45 hover:text-ink bg-transparent";
const on = "border-ink bg-ink text-white";

/** Topic filter: hairline chips, the active one filled with ink. */
export default function BlogTopicStrip({ activeTopic, onSelect }: BlogTopicStripProps) {
  const isAll = !activeTopic || activeTopic.toLowerCase() === "all";

  return (
    <div
      role="group"
      aria-label="Filter by topic"
      className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
    >
      <button
        type="button"
        aria-pressed={isAll}
        onClick={() => onSelect("")}
        className={`${chip} ${isAll ? on : idle}`}
      >
        <LayoutGrid size={16} strokeWidth={1.5} aria-hidden="true" />
        All
      </button>
      {ALL_TOPICS.map((topic) => {
        const active = activeTopic.toLowerCase() === topic.slug.toLowerCase();
        return (
          <button
            key={topic.slug}
            type="button"
            aria-pressed={active}
            onClick={() => onSelect(active ? "" : topic.slug)}
            className={`${chip} ${active ? on : idle}`}
          >
            <topic.Icon size={16} strokeWidth={1.5} aria-hidden="true" />
            {topic.label}
          </button>
        );
      })}
    </div>
  );
}
