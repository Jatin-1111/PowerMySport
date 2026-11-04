import type { JsonLdObject } from "@/lib/seo";

/**
 * Serialise a schema block for embedding in a `<script>` tag.
 *
 * `JSON.stringify` alone is not safe here. Several of these blocks carry
 * user-authored or federation-scraped strings (product names, expert bios,
 * tournament names), and a literal `</script>` inside one of them would close
 * the tag early and let the rest be parsed as HTML. Escaping `<` to its unicode
 * form keeps the JSON identical to a parser while making that impossible.
 */
function serialize(data: JsonLdObject): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

/**
 * Renders one or more JSON-LD structured-data blocks.
 *
 * A server component, so the schema lands in the initial HTML where crawlers
 * will see it — several pages on this site are `"use client"` and render their
 * schema from a sibling server `layout.tsx` for exactly that reason.
 */
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  const blocks = Array.isArray(data) ? data : [data];
  return (
    <>
      {blocks.map((block, index) => (
        <script
          // Structured-data blocks are static and never reordered.
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serialize(block) }}
        />
      ))}
    </>
  );
}
