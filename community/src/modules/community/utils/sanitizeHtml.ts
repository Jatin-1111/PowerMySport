import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitizer for user-authored blog rich text (Tiptap HTML output). This is
 * the security boundary: it runs wherever another user's content is
 * rendered (blog detail + preview) via dangerouslySetInnerHTML.
 *
 * It must be isomorphic. The detail page server-renders the story, and React
 * never reconciles the children of a dangerouslySetInnerHTML node during
 * hydration, so whatever the server puts in that div is what the reader
 * keeps. A server fallback that differed from the browser output (this used
 * to strip every tag) shipped an unformatted wall of text to anyone opening
 * a post by direct link or refresh, and to every crawler.
 */
const ALLOWED_TAGS = [
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "strike",
  "del",
  "mark",
  "span",
  "br",
  "p",
  "div",
  "h1",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "blockquote",
  "a",
  "img",
  "hr",
  "code",
  "pre",
];

const ALLOWED_ATTR = ["href", "src", "alt", "style"];

const STYLE_PROPERTY_RE =
  /(background-color|text-align)\s*:\s*(#[0-9a-fA-F]{3,8}|rgb\([^)]*\)|left|center|right|justify|[a-z]+)/gi;

/** Keep only a small allowlist of CSS properties/values from a style attribute. */
const sanitizeStyle = (style: string): string => {
  const kept: string[] = [];
  STYLE_PROPERTY_RE.lastIndex = 0;
  let match = STYLE_PROPERTY_RE.exec(style);
  while (match) {
    kept.push(`${match[1].toLowerCase()}:${match[2]}`);
    match = STYLE_PROPERTY_RE.exec(style);
  }
  return kept.join(";");
};

let hooksRegistered = false;
const registerHooks = () => {
  if (hooksRegistered) return;
  hooksRegistered = true;

  // Force-safe link attributes regardless of what the editor/paste produced.
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
    if (node.hasAttribute("style")) {
      const cleaned = sanitizeStyle(node.getAttribute("style") || "");
      if (cleaned) node.setAttribute("style", cleaned);
      else node.removeAttribute("style");
    }
  });
};

export const sanitizeRichHtml = (html: string): string => {
  if (!html) return "";

  registerHooks();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
};

/** Plain-text projection of rich HTML (for excerpts / emptiness checks). */
export const htmlToText = (html: string): string =>
  (html || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h1|h2|h3|li)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n{2,}/g, "\n")
    .trim();
