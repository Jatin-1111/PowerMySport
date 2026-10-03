"use client";

import { Loader2, LogIn, MessageCircle, Plus, Send, Trash2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useCallback, useId, useRef, useState } from "react";

import { ASK_SUGGESTED_QUESTIONS, askHref } from "../../config/askQuestions";
import { timeAgo } from "../../utils/timeAgo";
import type { SessionSummary } from "../chat/ChatDrawer";

// Presentational pieces of the /ask workspace. State lives in AskWorkspace.

// ─── History list ─────────────────────────────────────────────────────────────

/** One past chat: open it, or delete it after an inline "are you sure". */
function HistoryRow({
  session,
  active,
  busy,
  onSelect,
  onDelete,
}: {
  session: SessionSummary;
  active: boolean;
  /** A reply is streaming, so nothing may be deleted right now. */
  busy: boolean;
  onSelect: (sessionId: string) => void;
  onDelete: (sessionId: string) => Promise<boolean>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const title = session.title ?? "New conversation";

  if (confirming) {
    return (
      <div
        role="alertdialog"
        aria-label={`Delete chat: ${title}`}
        className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2.5"
      >
        <p className="text-sm font-medium text-rose-900">Delete this chat?</p>
        <p className="mt-0.5 truncate text-xs text-rose-800">{title}</p>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={deleting}
            onClick={async () => {
              setDeleting(true);
              const removed = await onDelete(session._id);
              // On success the row is gone; on failure it stays, with the error shown above.
              if (!removed) {
                setDeleting(false);
                setConfirming(false);
              }
            }}
            className="btn-motion inline-flex items-center gap-1.5 rounded-md bg-red-700 px-3 py-1.5 text-sm font-semibold text-white hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {deleting && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            Delete
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={() => setConfirming(false)}
            className="btn-motion rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
          >
            Keep it
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => onSelect(session._id)}
        aria-current={active ? "true" : undefined}
        className={`focus-visible:ring-power-orange-solid w-full rounded-md border py-2 pl-3 pr-10 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 ${
          active ? "border-orange-200 bg-orange-50" : "border-transparent hover:bg-slate-50"
        }`}
      >
        <span
          className={`block truncate text-sm font-medium ${active ? "text-power-orange-solid" : "text-slate-800"}`}
        >
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-slate-500">
          {session.totalMessageCount} {session.totalMessageCount === 1 ? "message" : "messages"} ·{" "}
          {timeAgo(session.updatedAt)}
        </span>
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => setConfirming(true)}
        aria-label={`Delete chat: ${title}`}
        className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-700 focus-visible:bg-rose-50 focus-visible:text-rose-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-600 disabled:opacity-40 lg:opacity-0 lg:focus-visible:opacity-100 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100"
      >
        <Trash2 className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

export function AskHistory({
  sessions,
  isLoading,
  currentSessionId,
  busy,
  onNewChat,
  onSelect,
  onDelete,
}: {
  sessions: SessionSummary[];
  isLoading: boolean;
  currentSessionId: string | null;
  busy: boolean;
  onNewChat: () => void;
  onSelect: (sessionId: string) => void;
  onDelete: (sessionId: string) => Promise<boolean>;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-slate-200 p-3">
        <button
          type="button"
          onClick={onNewChat}
          className="btn-motion text-power-orange-solid focus-visible:ring-power-orange-solid flex w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2"
        >
          <Plus className="h-4 w-4" aria-hidden />
          New chat
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-hidden />
            <span className="sr-only">Loading past chats</span>
          </div>
        ) : sessions.length === 0 ? (
          <p className="px-1 py-6 text-center text-sm text-slate-500">No past chats yet.</p>
        ) : (
          sessions.map((session) => (
            <HistoryRow
              key={session._id}
              session={session}
              active={session._id === currentSessionId}
              busy={busy}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Starter questions ────────────────────────────────────────────────────────

export function AskStarters({
  onPick,
  disabled,
}: {
  onPick: (question: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Try asking</p>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2">
        {ASK_SUGGESTED_QUESTIONS.map((question) => (
          <li key={question}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(question)}
              className="btn-motion focus-visible:ring-power-orange-solid hover:border-power-orange-solid/40 w-full rounded-md border border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50"
            >
              {question}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Composer ─────────────────────────────────────────────────────────────────

export function AskComposer({
  onSend,
  isStreaming,
}: {
  onSend: (text: string) => void;
  isStreaming: boolean;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const hintId = useId();

  const send = useCallback(() => {
    const text = value.trim();
    if (!text || isStreaming) return;
    setValue("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    onSend(text);
  }, [value, isStreaming, onSend]);

  return (
    <div className="border-t border-slate-200 bg-white p-4">
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
          }}
          rows={1}
          maxLength={2000}
          placeholder="Ask a question"
          aria-label="Your question"
          aria-describedby={hintId}
          className="focus-visible:border-power-orange-solid focus-visible:ring-power-orange-solid/30 min-h-[44px] flex-1 resize-none rounded-md border border-slate-300 bg-white px-3.5 py-2.5 text-base leading-relaxed text-slate-900 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2"
        />
        <button
          type="button"
          onClick={send}
          disabled={!value.trim() || isStreaming}
          aria-label="Send question"
          className="btn-motion bg-power-orange-solid focus-visible:ring-power-orange-solid flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-white hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50"
        >
          {isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Send className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
      <p id={hintId} className="mt-2 text-xs text-slate-500">
        Enter to send, Shift+Enter for a new line. AI can make mistakes; check dates and eligibility
        with the federation before you act.
      </p>
    </div>
  );
}

// ─── Signed-out view ──────────────────────────────────────────────────────────

/**
 * What a guest sees instead of a chat: what the assistant can do, the same
 * starter questions (each one carries through login and is asked on return),
 * and the sign-in actions. No popup, and nothing typed is lost.
 */
export function AskSignedOut({ question }: { question?: string }) {
  const back = askHref(question);
  const loginHref = `/login?redirect=${encodeURIComponent(back)}`;
  const registerHref = `/register?redirect=${encodeURIComponent(back)}`;

  return (
    <div className="flex flex-1 flex-col overflow-y-auto p-5 sm:p-8">
      <div className="mx-auto w-full max-w-xl">
        <span className="flex h-11 w-11 items-center justify-center rounded-md bg-orange-50">
          <MessageCircle className="text-power-orange h-5 w-5" aria-hidden />
        </span>
        <h1 className="font-title mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">
          Ask PowerMySport AI
        </h1>
        <p className="mt-3 text-base leading-relaxed text-slate-600">
          Ask about a sport, a pathway stage or an upcoming tournament, and get answers from the
          guides and listings on this site. It needs a free account to chat.
        </p>
        {question && (
          <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700">
            <span className="font-semibold">Your question: </span>
            {question}
            <span className="mt-1 block text-xs text-slate-500">
              It will be asked as soon as you are signed in.
            </span>
          </p>
        )}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href={loginHref}
            className="btn-motion bg-power-orange-solid focus-visible:ring-power-orange-solid inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-base font-semibold text-white hover:bg-orange-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <LogIn className="h-4 w-4" aria-hidden />
            Log in
          </Link>
          <Link
            href={registerHref}
            className="btn-motion text-power-orange-solid border-power-orange-solid focus-visible:ring-power-orange-solid inline-flex items-center justify-center gap-2 rounded-md border bg-white px-5 py-2.5 text-base font-semibold hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            <UserPlus className="h-4 w-4" aria-hidden />
            Create a free account
          </Link>
        </div>
        <p className="mt-8 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Try asking
        </p>
        <ul className="mt-2 flex flex-col gap-2">
          {ASK_SUGGESTED_QUESTIONS.map((suggestion) => (
            <li key={suggestion}>
              <Link
                href={askHref(suggestion)}
                className="btn-motion focus-visible:ring-power-orange-solid hover:border-power-orange-solid/40 block rounded-md border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-2"
              >
                {suggestion}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
