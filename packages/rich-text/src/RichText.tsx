import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

import { normalizeRichText, remarkKeepLineBreaks } from "./normalize";

// ─── Formatted text for pathway answers and detail ──────────────────────────
//
// Paragraphs, lists, bold, headings and tables, drawn from the Markdown stored
// in a text field (see utils/richText.ts for why Markdown).
//
// ── Why this cannot be abused ──
// It renders React elements, never HTML strings, so there is no sanitiser to
// disagree between the server and the browser (the way a server/client
// difference inside dangerouslySetInnerHTML once broke every directly opened
// Experience post). On top of that, raw HTML in the text is dropped
// (`skipHtml`), only the elements below are drawn, anything else is shown as
// its text, and links go through react-markdown's default URL filter, which
// refuses `javascript:` and its relatives.

const ALLOWED_ELEMENTS = [
  "p",
  "br",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "a",
  "blockquote",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
];

/**
 * Every heading level is drawn as the same small heading, and as an h4: this
 * text always sits under a section heading already, so an author typing "#"
 * must not be able to put an h1 in the middle of a page, or skip a level.
 */
const Heading: Components["h1"] = ({ children }) => (
  <h4 className="mt-3.5 text-[14px] font-bold leading-snug text-slate-800 first:mt-0">
    {children}
  </h4>
);

const components: Components = {
  p: ({ children }) => <p className="mt-2 first:mt-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-slate-800">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => (
    <ul className="mt-2 list-disc space-y-1 pl-5 marker:text-slate-400 first:mt-0">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-2 list-decimal space-y-1.5 pl-5 marker:font-semibold marker:text-slate-500 first:mt-0">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="pl-0.5">{children}</li>,
  h1: Heading,
  h2: Heading,
  h3: Heading,
  h4: Heading,
  h5: Heading,
  h6: Heading,
  blockquote: ({ children }) => (
    <blockquote className="mt-2 border-l-2 border-orange-300 pl-3 first:mt-0">
      {children}
    </blockquote>
  ),
  a: ({ href, children }) => {
    const external = Boolean(href && /^https?:\/\//i.test(href));
    return (
      <a
        href={href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="font-medium text-orange-700 underline underline-offset-2 hover:text-orange-800"
      >
        {children}
      </a>
    );
  },
  // A table scrolls sideways inside its own box on a narrow screen instead of
  // pushing the page wider. Focusable so it can be scrolled from the keyboard.
  table: ({ children }) => (
    <div
      role="region"
      tabIndex={0}
      aria-label="Table, scrolls sideways"
      className="mt-3 overflow-x-auto rounded-lg border border-slate-200 first:mt-0"
    >
      <table className="w-full min-w-[420px] border-collapse text-left text-[13px] leading-snug">
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th className="whitespace-nowrap border-b border-slate-200 bg-slate-50 px-3 py-2 font-semibold text-slate-700">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-slate-100 px-3 py-2 align-top text-slate-700">{children}</td>
  ),
};

const SIZE = {
  /** A stage's overview: the paragraph a parent reads first. */
  body: "text-[15.5px] leading-relaxed text-slate-700",
  /** An answer or a detail under a heading. */
  detail: "text-[14px] leading-relaxed text-slate-600",
} as const;

export function RichText({
  children,
  size = "detail",
  className,
}: {
  /** The stored text. Nothing is drawn when it is empty. */
  children: string | null | undefined;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  const text = normalizeRichText(children ?? "");
  if (!text) return null;

  return (
    <div className={className ? `${SIZE[size]} ${className}` : SIZE[size]}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkKeepLineBreaks]}
        allowedElements={ALLOWED_ELEMENTS}
        unwrapDisallowed
        skipHtml
        components={components}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
