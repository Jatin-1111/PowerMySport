import { FilterXSS, cssFilter, escapeAttrValue, safeAttrValue } from "xss";

/**
 * Sanitizer for user-authored blog rich text (Tiptap HTML output). This is
 * the security boundary: it runs wherever another user's content is
 * rendered (blog detail + preview) via dangerouslySetInnerHTML.
 *
 * It must run identically on the server and in the browser. The detail page
 * server-renders the story, and React never reconciles the children of a
 * dangerouslySetInnerHTML node during hydration, so whatever the server puts
 * in that div is what the reader keeps. A server fallback that differed from
 * the browser output (this used to strip every tag) shipped an unformatted
 * wall of text to anyone opening a post by direct link or refresh, and to
 * every crawler.
 *
 * It must also not need a DOM. This used to be `isomorphic-dompurify`, which
 * loads jsdom on the server. In production that import threw
 * ERR_REQUIRE_ESM (jsdom -> html-encoding-sniffer -> an ESM-only package), so
 * every Experience article answered 500 and was unreadable to Google. `xss`
 * is a plain tokenizer with no dependencies that need a DOM, so there is one
 * implementation for both sides and nothing to fail at module load.
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

/** Attributes per tag. Every tag may carry a (filtered) style; only links and images take more. */
const TAG_ATTRIBUTES: Record<string, string[]> = {
  a: ["href", "style"],
  img: ["src", "alt", "style"],
};

/**
 * Tags removed together with everything inside them. `xss` would strip the tag
 * and leave a script's source as visible text, and its own body-stripping prints
 * a literal "[removed]" for nested or unclosed ones. A pass over the raw HTML
 * first keeps the output clean. It is cosmetic, not the security boundary: the
 * tokenizer below still allowlists every tag and attribute that remains, so a
 * leftover fragment can only ever come out as escaped text.
 */
const DROP_WITH_CONTENT_RE =
  /<(script|style|svg|math|iframe|object|embed|noscript|template|textarea|title|xmp|noembed|noframes)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

const WHITE_LIST = Object.fromEntries(
  ALLOWED_TAGS.map((tag) => [tag, TAG_ATTRIBUTES[tag] ?? ["style"]])
);

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

const filter = new FilterXSS({
  whiteList: WHITE_LIST,
  // Unknown tags lose the tag and keep their text. Comments are never allowed
  // (the default).
  stripIgnoreTag: true,
  onTagAttr(tag, name, value, isWhiteAttr): string | undefined {
    if (!isWhiteAttr) return undefined;
    // An empty string is how `xss` drops an attribute; left alone it would
    // print a bare `href` or `src` for a rejected URL.
    if (name === "style") {
      const cleaned = sanitizeStyle(value);
      return cleaned ? `style="${escapeAttrValue(cleaned)}"` : "";
    }
    // href/src must be http(s), mailto, tel, a path or a fragment, so
    // `javascript:` and friends are removed.
    if (name === "href" || name === "src") {
      return safeAttrValue(tag, name, value, cssFilter) ? undefined : "";
    }
    return undefined;
  },
});

/** Opening `<a ...>` tags in already-sanitized output. Text `<` is escaped, so this cannot match user text. */
const OPENING_ANCHOR_RE = /<a(?=[\s>])/g;

export const sanitizeRichHtml = (html: string): string => {
  if (!html) return "";

  // Force-safe link attributes regardless of what the editor/paste produced.
  // `target` and `rel` are not whitelisted, so any the author supplied are
  // already gone and these are the only ones present.
  return filter
    .process(html.replace(DROP_WITH_CONTENT_RE, ""))
    .replace(OPENING_ANCHOR_RE, '<a target="_blank" rel="noopener noreferrer"');
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
