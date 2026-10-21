"use client";

import { getTopicMeta } from "@/modules/community/constants/experienceTaxonomy";

/**
 * Default cover shown when a blog has no uploaded image. Renders a topic-tinted
 * gradient with the topic icon and the PowerMySport blog wordmark.
 */
export default function BlogCoverFallback({
  topic,
  className = "",
}: {
  topic?: string | null;
  className?: string;
}) {
  const { label, Icon } = getTopicMeta(topic);

  return (
    <div
      className={`bg-ink relative flex h-full w-full items-center justify-center overflow-hidden ${className}`}
    >
      <div className="relative flex flex-col items-center gap-2 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white/90">
          <Icon size={26} />
        </span>
        <span className="text-xs font-semibold tracking-[0.28em] text-white/60">{label}</span>
        <span className="font-title text-sm font-semibold tracking-tight text-white/90">
          <span className="text-power-orange">Power</span>MySport
        </span>
      </div>
    </div>
  );
}
