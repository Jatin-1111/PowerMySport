"use client";

import { BlogBlock } from "@/modules/community/types";
import { sanitizeRichHtml } from "@/modules/community/utils/sanitizeHtml";

/**
 * Read-only renderer for a blog's block array. Shared by the detail page and
 * the write-page preview modal so what you preview is what you publish.
 */
export default function BlogContentRenderer({
  blocks,
}: {
  blocks: BlogBlock[];
}) {
  if (!blocks || blocks.length === 0) {
    return null;
  }

  return (
    <div className="space-y-5">
      {blocks.map((block) => {
        switch (block.type) {
          case "heading": {
            const level = block.level || 2;
            const cls =
              level === 1
                ? "text-2xl sm:text-3xl"
                : level === 3
                  ? "text-lg sm:text-xl"
                  : "text-xl sm:text-2xl";
            return (
              <h2
                key={block.id}
                className={`font-title font-bold leading-tight text-slate-900 ${cls}`}
                dangerouslySetInnerHTML={{
                  __html: sanitizeRichHtml(block.text || ""),
                }}
              />
            );
          }

          case "quote":
            return (
              <blockquote
                key={block.id}
                className="border-l-4 border-power-orange/60 bg-power-orange/5 px-5 py-3 text-base italic leading-relaxed text-slate-700 sm:text-lg"
                dangerouslySetInnerHTML={{
                  __html: sanitizeRichHtml(block.text || ""),
                }}
              />
            );

          case "list":
            return block.ordered ? (
              <ol
                key={block.id}
                className="list-decimal space-y-1.5 pl-6 text-base leading-relaxed text-slate-700"
              >
                {(block.items || []).map((item, index) => (
                  <li key={`${block.id}-${index}`}>{item}</li>
                ))}
              </ol>
            ) : (
              <ul
                key={block.id}
                className="list-disc space-y-1.5 pl-6 text-base leading-relaxed text-slate-700"
              >
                {(block.items || []).map((item, index) => (
                  <li key={`${block.id}-${index}`}>{item}</li>
                ))}
              </ul>
            );

          case "image": {
            const url = block.imageUrl || "";
            if (!url) return null;
            return (
              <figure key={block.id} className="space-y-2">
                <img
                  src={url}
                  alt={block.caption || "Blog image"}
                  className="w-full rounded-2xl border border-slate-200 object-cover"
                />
                {block.caption ? (
                  <figcaption className="text-center text-xs text-slate-500">
                    {block.caption}
                  </figcaption>
                ) : null}
              </figure>
            );
          }

          case "text":
          default:
            return (
              <p
                key={block.id}
                className="whitespace-pre-wrap text-base leading-relaxed text-slate-700 sm:text-[17px]"
                dangerouslySetInnerHTML={{
                  __html: sanitizeRichHtml(block.text || ""),
                }}
              />
            );
        }
      })}
    </div>
  );
}
