"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
    AlertCircle,
    ChevronLeft,
    Clock,
    Loader2,
    MessageCircle,
    Plus,
    Send,
    X,
    Zap,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "../../hooks/useGuidanceChat";

// ─── Markdown renderer for assistant messages ────────────────────────────────

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        // Headings
        h1: ({ children }) => (
          <h1 className="text-sm font-bold text-slate-900 mt-3 mb-1.5 first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-sm font-bold text-slate-900 mt-3 mb-1 first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-[13px] font-semibold text-slate-800 mt-2.5 mb-1 first:mt-0">
            {children}
          </h3>
        ),
        h4: ({ children }) => (
          <h4 className="text-[13px] font-semibold text-slate-700 mt-2 mb-0.5 first:mt-0">
            {children}
          </h4>
        ),
        // Paragraphs
        p: ({ children }) => (
          <p className="text-sm text-slate-800 leading-relaxed mb-2 last:mb-0">
            {children}
          </p>
        ),
        // Bold / Italic
        strong: ({ children }) => (
          <strong className="font-semibold text-slate-900">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic text-slate-700">{children}</em>
        ),
        // Unordered list
        ul: ({ children }) => (
          <ul className="my-1.5 space-y-1 pl-4">{children}</ul>
        ),
        // Ordered list
        ol: ({ children }) => (
          <ol className="my-1.5 space-y-1 pl-5 list-decimal">{children}</ol>
        ),
        // List items
        li: ({ children }) => (
          <li className="text-sm text-slate-800 leading-relaxed flex gap-2 items-start">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-power-orange" />
            <span className="flex-1">{children}</span>
          </li>
        ),
        // Inline code
        code: ({ children, className }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return (
              <code className="block w-full overflow-x-auto rounded-lg bg-slate-100 p-3 text-[12px] font-mono text-slate-700 leading-relaxed">
                {children}
              </code>
            );
          }
          return (
            <code className="rounded bg-orange-50 px-1 py-0.5 text-[12px] font-mono text-orange-700">
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
            className="font-medium text-power-orange underline underline-offset-2 hover:text-orange-600"
          >
            {children}
          </a>
        ),
        // Tables (remark-gfm)
        table: ({ children }) => (
          <div className="my-2 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-[12px] text-slate-700">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-slate-50 font-semibold text-slate-600">
            {children}
          </thead>
        ),
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => (
          <tr className="border-t border-slate-100">{children}</tr>
        ),
        th: ({ children }) => (
          <th className="px-3 py-1.5 text-left font-semibold">{children}</th>
        ),
        td: ({ children }) => <td className="px-3 py-1.5">{children}</td>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  role,
  content,
  isStreaming,
}: {
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
}) {
  const isUser = role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
    >
      {!isUser && (
        <div className="mr-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-100 ring-1 ring-orange-200">
          <Zap className="h-3.5 w-3.5 text-power-orange" />
        </div>
      )}
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm ${
          isUser
            ? "rounded-tr-sm bg-power-orange text-white"
            : "rounded-tl-sm border border-slate-200/80 bg-white text-slate-800 shadow-sm"
        }`}
      >
        {isUser ? (
          /* User messages: plain text */
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-white">
            {content}
          </p>
        ) : content ? (
          /* Assistant messages: rendered markdown */
          <div className="prose-chat">
            <MarkdownContent content={content} />
            {isStreaming && (
              <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse rounded-full bg-slate-400 align-text-bottom" />
            )}
          </div>
        ) : isStreaming ? (
          /* Empty placeholder while first tokens arrive */
          <span className="flex items-center gap-1.5 text-slate-400 py-0.5">
            <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:0ms]" />
            <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:150ms]" />
            <span className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-300 [animation-delay:300ms]" />
          </span>
        ) : null}
      </div>
    </motion.div>
  );
}

// ─── Generic chat drawer shell ────────────────────────────────────────────────
// Presentational component shared by every AI chat entry point (guidance chat,
// roadmap chat, ...). Each caller supplies its own hook state + header copy.

export interface SessionSummary {
  _id: string;
  sportSlug: string;
  title: string | null;
  totalMessageCount: number;
  updatedAt: string;
  createdAt: string;
}

export interface ChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  messages: ChatMessage[];
  isInitializing: boolean;
  isStreaming: boolean;
  meta: { dailyRemaining: number; lifetimeRemaining: number };
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
  clearError: () => void;
  quickReplies?: string[];
  children?: React.ReactNode;
  // Session history (optional — only wired up for roadmap chat)
  sessions?: SessionSummary[];
  isLoadingSessions?: boolean;
  currentSessionId?: string | null;
  onNewChat?: () => void;
  onSelectSession?: (sessionId: string) => void;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function ChatDrawer({
  isOpen,
  onClose,
  title,
  subtitle,
  messages,
  isInitializing,
  isStreaming,
  meta,
  error,
  sendMessage,
  clearError,
  quickReplies = [],
  children,
  sessions,
  isLoadingSessions,
  currentSessionId,
  onNewChat,
  onSelectSession,
}: ChatDrawerProps) {
  const [inputValue, setInputValue] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hasHistory = !!sessions;

  // Notify the rest of the app (e.g. WhatsApp button) when the drawer opens/closes
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("chat-drawer-change", { detail: { isOpen } }));
  }, [isOpen]);

  // Scroll to bottom on new messages / stream updates
  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isStreaming) return;
    setInputValue("");
    await sendMessage(text);
  }, [inputValue, isStreaming, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleQuickReply = useCallback(
    (text: string) => {
      if (isStreaming) return;
      sendMessage(text);
    },
    [isStreaming, sendMessage],
  );

  const rateLimitHit =
    meta.dailyRemaining === 0 || meta.lifetimeRemaining === 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop (mobile only) */}
          <motion.div
            key="chat-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px] lg:hidden"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Drawer */}
          <motion.aside
            key="chat-drawer"
            role="complementary"
            aria-label="Coach chat"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 280 }}
            className="fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-slate-200/80 bg-white shadow-[−8px_0_30px_-10px_rgba(15,23,42,0.15)] sm:max-w-[560px]"
          >
            {/* ── Header ── */}
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3.5">
              {showHistory ? (
                <button
                  onClick={() => setShowHistory(false)}
                  aria-label="Back to chat"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-50 ring-1 ring-orange-100">
                  <MessageCircle className="h-[18px] w-[18px] text-power-orange" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-slate-900 leading-tight truncate">
                  {showHistory ? "Chat History" : title}
                </p>
                <p className="text-[11px] text-slate-400 truncate">
                  {showHistory ? "All your past conversations" : subtitle}
                </p>
              </div>
              {!showHistory && (
                <span className="shrink-0 text-[11px] text-slate-400 tabular-nums">
                  {meta.dailyRemaining}/30 today
                </span>
              )}
              {hasHistory && !showHistory && (
                <button
                  onClick={() => setShowHistory(true)}
                  aria-label="Chat history"
                  title="History"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <Clock className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={onClose}
                id="chat-drawer-close"
                aria-label="Close chat"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Header addon area for disclaimers/badges (hidden in history view) */}
            {children && !showHistory && (
              <div className="bg-slate-50 border-b border-slate-100 px-4 py-2">
                {children}
              </div>
            )}

            {/* ── History panel ── */}
            {showHistory && (
              <div className="flex flex-1 flex-col overflow-hidden">
                {/* New chat button */}
                <div className="border-b border-slate-100 p-3">
                  <button
                    onClick={() => {
                      onNewChat?.();
                      setShowHistory(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-semibold text-power-orange transition hover:bg-orange-100 cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    New Chat
                  </button>
                </div>

                {/* Session list */}
                <div className="flex-1 overflow-y-auto p-3 space-y-1">
                  {isLoadingSessions ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
                    </div>
                  ) : !sessions || sessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                      <MessageCircle className="h-8 w-8 text-slate-200" />
                      <p className="text-sm text-slate-400">No past conversations yet</p>
                    </div>
                  ) : (
                    sessions.map((s) => {
                      const isActive = s._id === currentSessionId;
                      return (
                        <button
                          key={s._id}
                          onClick={() => {
                            onSelectSession?.(s._id);
                            setShowHistory(false);
                          }}
                          className={`w-full rounded-xl px-3 py-2.5 text-left transition cursor-pointer ${
                            isActive
                              ? "bg-orange-50 border border-orange-200"
                              : "hover:bg-slate-50 border border-transparent"
                          }`}
                        >
                          <p className={`text-sm font-medium leading-snug truncate ${isActive ? "text-power-orange" : "text-slate-800"}`}>
                            {s.title ?? "New conversation"}
                          </p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {s.totalMessageCount} {s.totalMessageCount === 1 ? "message" : "messages"} · {timeAgo(s.updatedAt)}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* ── Messages area ── */}
            {!showHistory && <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
              {isInitializing ? (
                <div className="flex h-full items-center justify-center">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-power-orange" />
                    <p className="text-sm text-slate-500">
                      Loading your conversation…
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <AnimatePresence initial={false}>
                    {messages.map((msg, idx) => {
                      const isLastAssistant =
                        msg.role === "assistant" && idx === messages.length - 1;
                      return (
                        <MessageBubble
                          key={idx}
                          role={msg.role}
                          content={msg.content}
                          isStreaming={isLastAssistant && isStreaming}
                        />
                      );
                    })}
                  </AnimatePresence>

                  {/* Error banner */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span className="flex-1 leading-snug">{error}</span>
                      <button
                        onClick={clearError}
                        aria-label="Dismiss error"
                        className="shrink-0 text-rose-400 hover:text-rose-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </motion.div>
                  )}

                  <div ref={bottomRef} />
                </div>
              )}
            </div>}

            {/* ── Quick reply chips (shown before first user turn) ── */}
            {!showHistory &&
              !isInitializing &&
              quickReplies.length > 0 &&
              messages.filter((m) => m.role === "user").length === 0 &&
              !rateLimitHit && (
                <div className="border-t border-slate-100 px-4 py-3">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Quick questions
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {quickReplies.map((chip) => (
                      <button
                        key={chip}
                        onClick={() => handleQuickReply(chip)}
                        disabled={isStreaming}
                        className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-[11px] font-medium text-orange-700 transition hover:bg-orange-100 disabled:opacity-40"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            {/* ── Rate limit message ── */}
            {!showHistory && rateLimitHit && !isInitializing && (
              <div className="border-t border-amber-100 bg-amber-50 px-4 py-3">
                <p className="text-xs text-amber-700 text-center leading-snug">
                  {meta.lifetimeRemaining === 0
                    ? "You've explored this thoroughly! Come back with a fresh question soon."
                    : "Daily message limit reached — come back tomorrow to continue the conversation."}
                </p>
              </div>
            )}

            {/* ── Input area ── */}
            {!showHistory && !rateLimitHit && !isInitializing && (
              <div className="border-t border-slate-100 bg-white p-4">
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    id="chat-input"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask your coach anything…"
                    rows={1}
                    disabled={isStreaming}
                    aria-label="Chat message input"
                    className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-200/60 disabled:opacity-50 leading-relaxed"
                    style={{ minHeight: "42px", maxHeight: "120px" }}
                    onInput={(e) => {
                      const el = e.currentTarget;
                      el.style.height = "auto";
                      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                    }}
                  />
                  <button
                    onClick={handleSend}
                    id="chat-send-btn"
                    disabled={!inputValue.trim() || isStreaming}
                    aria-label="Send message"
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-power-orange text-white shadow-[0_4px_14px_-4px_rgba(233,115,22,0.5)] transition hover:bg-orange-600 active:scale-95 disabled:opacity-40 disabled:shadow-none"
                  >
                    {isStreaming ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="mt-1.5 text-center text-[10px] text-slate-400">
                  Enter to send · Shift+Enter for new line
                </p>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
