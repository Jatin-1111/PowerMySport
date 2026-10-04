"use client";

import { useAuthStore } from "@/modules/auth/store/authStore";
import { AlertCircle, Clock, Loader2, MessageCircle, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { useAssistantChat } from "../../hooks/useAssistantChat";
import { finishAskTransition } from "../../utils/askTransition";
import { MessageBubble } from "../chat/ChatMessageBubble";
import { AskComposer, AskHistory, AskSignedOut, AskStarters } from "./AskParts";

const MAX_QUESTION_LENGTH = 500;

/**
 * The full-page assistant. It is the same assistant the floating button used
 * to open as a drawer, with the same API, limits and history, in a page with
 * room for the answers.
 *
 * Two URL parameters, both optional:
 *  - `?q=` is a question to ask once the chat is ready (the homepage card and
 *    its starter questions link here). It is removed from the address after it
 *    is read, so a refresh does not ask it again.
 *  - `?s=` is a conversation to reopen. It is kept in sync with the open
 *    conversation, so a chat has an address you can come back to.
 *
 * Arriving from the homepage card, a copy of that card has grown to this
 * panel's exact box (see utils/askTransition). Once the chat is ready this
 * hands over to it, so the page does not start covered by anything it is still
 * waiting to show.
 */
export function AskWorkspace() {
  const { user, hydrated } = useAuthStore();
  const chat = useAssistantChat();
  const {
    messages,
    sessions,
    currentSessionId,
    isInitializing,
    isLoadingSessions,
    isStreaming,
    meta,
    error,
    initialize,
    switchToSession,
    loadSessions,
    deleteSession,
    sendMessage,
    clearError,
  } = chat;

  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [guestQuestion, setGuestQuestion] = useState<string | undefined>(undefined);
  const [historyOpen, setHistoryOpen] = useState(false);
  const startedRef = useRef(false);
  const sentRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Read the address once on arrival; take `?q=` out so a reload does not repeat it.
  useEffect(() => {
    if (!hydrated || startedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const question = params.get("q")?.trim().slice(0, MAX_QUESTION_LENGTH) || undefined;
    const resume = params.get("s");

    if (!user) {
      // A signed-out visitor keeps their question through login (see AskSignedOut).
      const timer = window.setTimeout(() => setGuestQuestion(question), 0);
      return () => window.clearTimeout(timer);
    }

    startedRef.current = true;
    if (question) {
      params.delete("q");
      const rest = params.toString();
      window.history.replaceState(null, "", `/ask${rest ? `?${rest}` : ""}`);
    }

    void (async () => {
      // A question starts a fresh conversation; otherwise reopen `?s=` if it loads.
      const resumed = resume && !question ? await switchToSession(resume) : false;
      // Starting a chat loads the history list as part of it; reopening one does not.
      if (resumed) void loadSessions();
      else await initialize();
      if (question) setPendingQuestion(question);
    })();
  }, [hydrated, user, initialize, switchToSession, loadSessions]);

  // Keep the address pointing at the open conversation.
  useEffect(() => {
    if (!currentSessionId || !user) return;
    window.history.replaceState(null, "", `/ask?s=${encodeURIComponent(currentSessionId)}`);
  }, [currentSessionId, user]);

  // Ask the question that arrived in the address, once, as soon as the chat is ready.
  useEffect(() => {
    if (!pendingQuestion || isInitializing || isStreaming || !currentSessionId) return;
    if (sentRef.current === pendingQuestion) return;
    sentRef.current = pendingQuestion;
    void sendMessage(pendingQuestion);
    const timer = window.setTimeout(() => setPendingQuestion(null), 0);
    return () => window.clearTimeout(timer);
  }, [pendingQuestion, isInitializing, isStreaming, currentSessionId, sendMessage]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const newChat = useCallback(() => {
    setHistoryOpen(false);
    void initialize();
  }, [initialize]);

  const openSession = useCallback(
    (sessionId: string) => {
      setHistoryOpen(false);
      void switchToSession(sessionId);
    },
    [switchToSession]
  );

  const signedOut = hydrated && !user;

  // Deleting the chat that is open leaves nothing to look at, so start a fresh one.
  const deleteChat = useCallback(
    async (sessionId: string) => {
      const removed = await deleteSession(sessionId);
      if (removed && sessionId === currentSessionId) await initialize();
      return removed;
    },
    [deleteSession, currentSessionId, initialize]
  );

  // The workspace has something to show (a chat, a sign-in view, or an error):
  // let the card that grew into it fade away.
  const ready = signedOut || Boolean(currentSessionId) || Boolean(error);
  useEffect(() => {
    if (ready) finishAskTransition();
  }, [ready]);
  useEffect(() => () => finishAskTransition(), []);
  const rateLimitHit = meta.dailyRemaining === 0 || meta.lifetimeRemaining === 0;
  const hasAsked = messages.some((message) => message.role === "user");

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">
      <div
        data-ask-panel
        className="flex h-[calc(100dvh-8.5rem)] min-h-[520px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-opacity duration-[420ms] ease-[cubic-bezier(0.65,0,0.35,1)]"
      >
        {!signedOut && (
          <aside
            aria-label="Past chats"
            className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-slate-50 lg:flex"
          >
            <AskHistory
              sessions={sessions}
              isLoading={isLoadingSessions}
              currentSessionId={currentSessionId}
              busy={isStreaming}
              onNewChat={newChat}
              onSelect={openSession}
              onDelete={deleteChat}
            />
          </aside>
        )}

        <section className="flex min-w-0 flex-1 flex-col" aria-label="Conversation">
          {signedOut ? (
            <AskSignedOut question={guestQuestion} />
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-slate-200 px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-orange-50">
                  <MessageCircle className="text-power-orange h-[18px] w-[18px]" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-base font-bold leading-tight text-slate-900">
                    PowerMySport AI
                  </h1>
                  <p className="truncate text-xs text-slate-500">
                    <span className="sm:hidden">{meta.dailyRemaining}/30 today</span>
                    <span className="hidden sm:inline">Pathways, tournaments and experts</span>
                  </p>
                </div>
                <span className="hidden shrink-0 text-xs tabular-nums text-slate-500 sm:inline">
                  {meta.dailyRemaining}/30 today
                </span>
                <button
                  type="button"
                  onClick={() => setHistoryOpen((open) => !open)}
                  aria-expanded={historyOpen}
                  className="btn-motion focus-visible:ring-power-orange-solid flex h-9 items-center gap-1.5 rounded-md border border-slate-200 px-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 lg:hidden"
                >
                  <Clock className="h-4 w-4" aria-hidden />
                  History
                </button>
              </header>

              {historyOpen && (
                <div className="flex max-h-72 flex-col border-b border-slate-200 bg-slate-50 lg:hidden">
                  <AskHistory
                    sessions={sessions}
                    isLoading={isLoadingSessions}
                    currentSessionId={currentSessionId}
                    busy={isStreaming}
                    onNewChat={newChat}
                    onSelect={openSession}
                    onDelete={deleteChat}
                  />
                </div>
              )}

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
                {!hydrated || isInitializing ? (
                  <div className="flex h-full items-center justify-center">
                    <p className="flex items-center gap-2.5 text-sm text-slate-500" role="status">
                      <Loader2 className="text-power-orange h-5 w-5 animate-spin" aria-hidden />
                      Loading your conversation…
                    </p>
                  </div>
                ) : (
                  <div className="mx-auto flex max-w-3xl flex-col gap-4">
                    {messages.map((message, index) => (
                      <MessageBubble
                        key={index}
                        role={message.role}
                        content={message.content}
                        isStreaming={
                          isStreaming &&
                          message.role === "assistant" &&
                          index === messages.length - 1
                        }
                      />
                    ))}

                    {!hasAsked && !rateLimitHit && !pendingQuestion && (
                      <div className="pt-2">
                        <AskStarters onPick={sendMessage} disabled={isStreaming} />
                      </div>
                    )}

                    {error && (
                      <div
                        role="alert"
                        className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800"
                      >
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                        <span className="flex-1 leading-snug">{error}</span>
                        <button
                          type="button"
                          onClick={clearError}
                          aria-label="Dismiss error"
                          className="shrink-0 text-rose-600 hover:text-rose-800"
                        >
                          <X className="h-4 w-4" aria-hidden />
                        </button>
                      </div>
                    )}
                    <div ref={bottomRef} />
                  </div>
                )}
              </div>

              {rateLimitHit && !isInitializing ? (
                <div className="border-t border-amber-200 bg-amber-50 px-4 py-3" role="status">
                  <p className="text-center text-sm text-amber-800">
                    {meta.lifetimeRemaining === 0
                      ? "You have used all your questions for now. Come back with a fresh one soon."
                      : "You have reached today's limit. Come back tomorrow to continue."}
                  </p>
                </div>
              ) : (
                hydrated &&
                !isInitializing && (
                  <div>
                    <AskComposer onSend={sendMessage} isStreaming={isStreaming} />
                  </div>
                )
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
