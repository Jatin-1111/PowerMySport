/**
 * Minimal HTML sanitizer for user-authored blog rich text. Only inline
 * formatting tags produced by the editor toolbar survive; everything else is
 * unwrapped (kept as text) or dropped, and all attributes are stripped except
 * a safe `background-color` on <span>/<mark> (used by the highlight action).
 *
 * This is the security boundary: it runs wherever another user's content is
 * rendered (blog detail + preview).
 */
const ALLOWED_TAGS = new Set([
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "S",
  "STRIKE",
  "DEL",
  "MARK",
  "SPAN",
  "BR",
  "P",
  "DIV",
]);

const sanitizeStyle = (style: string | null): string => {
  if (!style) return "";
  const match = /background-color:\s*(#[0-9a-fA-F]{3,8}|rgb\([^)]*\)|[a-z]+)/i.exec(
    style,
  );
  return match ? `background-color:${match[1]}` : "";
};

export const sanitizeRichHtml = (html: string): string => {
  if (!html) return "";
  // SSR / non-DOM fallback: strip all tags.
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return html.replace(/<[^>]*>/g, "");
  }

  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstChild as HTMLElement | null;
  if (!root) return "";

  const clean = (node: Node) => {
    // Snapshot children first — the list mutates as we unwrap/remove.
    for (const child of Array.from(node.childNodes)) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const el = child as HTMLElement;
        if (!ALLOWED_TAGS.has(el.tagName)) {
          // Unwrap: keep text content, drop the (possibly dangerous) element.
          const parent = el.parentNode;
          if (parent) {
            while (el.firstChild) parent.insertBefore(el.firstChild, el);
            parent.removeChild(el);
          }
          continue;
        }
        const keepStyle =
          el.tagName === "SPAN" || el.tagName === "MARK"
            ? sanitizeStyle(el.getAttribute("style"))
            : "";
        for (const attr of Array.from(el.attributes)) {
          el.removeAttribute(attr.name);
        }
        if (keepStyle) el.setAttribute("style", keepStyle);
        clean(el);
      } else if (child.nodeType !== Node.TEXT_NODE) {
        node.removeChild(child);
      }
    }
  };

  clean(root);
  return root.innerHTML;
};

/** Plain-text projection of rich HTML (for excerpts / emptiness checks). */
export const htmlToText = (html: string): string =>
  (html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .trim();
