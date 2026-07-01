"use client";

import { getBlogTopic } from "@/modules/community/constants/blogTopics";

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
  const { label, Icon } = getBlogTopic(topic);

  return (
    <div
      className={`relative flex h-full w-full items-center justify-center overflow-hidden bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_55%,#334155_100%)] ${className}`}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full bg-power-orange/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-10 -left-6 h-40 w-40 rounded-full bg-sky-400/20 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-size-[26px_26px]" />
      <div className="relative flex flex-col items-center gap-2 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white/90 backdrop-blur-sm">
          <Icon size={26} />
        </span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/60">
          {label}
        </span>
        <span className="font-title text-sm font-bold tracking-tight text-white/90">
          <span className="text-power-orange">Power</span>MySport
        </span>
      </div>
    </div>
  );
}
