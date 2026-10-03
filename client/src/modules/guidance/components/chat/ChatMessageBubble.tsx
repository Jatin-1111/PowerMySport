"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Shared by every chat surface: the side drawer and the full-page /ask workspace.

// ─── Markdown renderer for assistant messages ────────────────────────────────

export function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Headings
        h1: ({ children }) => (
          <h1 className="mb-1.5 mt-3 text-sm font-bold text-slate-900 first:mt-0">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="mb-1 mt-3 text-sm font-bold text-slate-900 first:mt-0">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="mb-1 mt-2.5 text-[13px] font-semibold text-slate-800 first:mt-0">
            {children}
          </h3>
        ),
        h4: ({ children }) => (
          <h4 className="mb-0.5 mt-2 text-[13px] font-semibold text-slate-700 first:mt-0">
            {children}
          </h4>
        ),
        // Paragraphs
        p: ({ children }) => (
          <p className="mb-2 text-sm leading-relaxed text-slate-800 last:mb-0">{children}</p>
        ),
        // Bold / Italic
        strong: ({ children }) => (
          <strong className="font-semibold text-slate-900">{children}</strong>
        ),
        em: ({ children }) => <em className="italic text-slate-700">{children}</em>,
        // Unordered list
        ul: ({ children }) => <ul className="my-1.5 space-y-1 pl-4">{children}</ul>,
        // Ordered list
        ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-1 pl-5">{children}</ol>,
        // List items
        li: ({ children }) => (
          <li className="flex items-start gap-2 text-sm leading-relaxed text-slate-800">
            <span className="bg-power-orange mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" />
            <span className="flex-1">{children}</span>
          </li>
        ),
        // Inline code
        code: ({ children, className }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return (
              <code className="block w-full overflow-x-auto rounded-lg bg-slate-100 p-3 font-mono text-[12px] leading-relaxed text-slate-700">
                {children}
              </code>
            );
          }
          return (
            <code className="rounded bg-orange-50 px-1 py-0.5 font-mono text-[12px] text-orange-700">
              {children}
            </code>
          );
        },
        // Block quote
        blockquote: ({ children }) => (
          <blockquote className="my-2 border-l-2 border-orange-300 pl-3 text-sm italic text-slate-600">
            {children}
          </blockquote>
        ),
        // Horizontal rule
        hr: () => <hr className="my-3 border-slate-200" />,
        // Links — open in new tab, never navigate away
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-power-orange font-medium underline underline-offset-2 hover:text-orange-600"
          >
            {children}
          </a>
        ),
        // Tables (remark-gfm)
        table: ({ children }) => (
          <div className="my-2 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-[12px] text-slate-700">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-slate-50 font-semibold text-slate-600">{children}</thead>
        ),
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => <tr className="border-t border-slate-100">{children}</tr>,
        th: ({ children }) => <th className="px-3 py-1.5 text-left font-semibold">{children}</th>,
        td: ({ children }) => <td className="px-3 py-1.5">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

export function MessageBubble({
  role,
  content,
  isStreaming,
}: {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}) {
  const isUser = role === "user";
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <div className="mr-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100 ring-1 ring-orange-200">
          <Zap className="text-power-orange h-3.5 w-3.5" aria-hidden="true" />
        </div>
      )}
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm ${
          isUser
            ? "bg-power-orange-solid rounded-tr-sm text-white"
            : "rounded-tl-sm border border-slate-200/80 bg-white text-slate-800 shadow-sm"
        }`}
      >
        {isUser ? (
          /* User messages: plain text */
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-white">{content}</p>
        ) : content ? (
          /* Assistant messages: rendered markdown */
          <div className="prose-chat">
            <MarkdownContent content={content} />
            {isStreaming && (
              <span
                aria-hidden="true"
                className="ml-0.5 inline-block h-4 w-0.5 animate-pulse rounded-full bg-slate-400 align-text-bottom motion-reduce:animate-none"
              />
            )}
          </div>
        ) : isStreaming ? (
          /* Empty placeholder while first tokens arrive */
          <span aria-hidden="true" className="flex items-center gap-1.5 py-0.5 text-slate-400">
            <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:0ms] motion-reduce:animate-none" />
            <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:150ms] motion-reduce:animate-none" />
            <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:300ms] motion-reduce:animate-none" />
          </span>
        ) : null}
      </div>
    </motion.div>
  );
}
