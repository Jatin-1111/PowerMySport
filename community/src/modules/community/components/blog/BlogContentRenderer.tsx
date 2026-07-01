"use client";

import { sanitizeRichHtml } from "@/modules/community/utils/sanitizeHtml";

/**
 * Read-only renderer for a blog's rich-text HTML body. Shared by the detail
 * page and the write-page preview modal so what you preview is what you
 * publish.
 */
export default function BlogContentRenderer({ content }: { content: string }) {
  if (!content) return null;

  return (
    <div
      className="blog-prose"
      dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(content) }}
    />
  );
}
