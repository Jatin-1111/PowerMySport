"use client";

import { getTopicMeta } from "@/modules/community/constants/experienceTaxonomy";

/**
 * Cover shown when a post has no uploaded image: a deeper-paper block with the
 * topic icon and name, quiet enough that real photographs still lead.
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
      className={`bg-paper-deep text-ink/40 flex h-full w-full flex-col items-center justify-center gap-3 ${className}`}
    >
      <Icon size={40} strokeWidth={1} aria-hidden="true" />
      <span className="font-editorial text-xl font-light">{label}</span>
    </div>
  );
}
