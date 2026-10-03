"use client";

import { AIDisclaimer } from "../../../shared/components/AIDisclaimer";
import { useEffect, useRef } from "react";
import { useAssistantChat } from "../../hooks/useAssistantChat";
import { ChatDrawer } from "./ChatDrawer";

const QUICK_REPLIES = [
  "How does PowerMySport work?",
  "Help me pick a sport for my child",
  "What does the guidance plan include?",
  "How do I find a coach or academy?",
  "Is this free?",
];

interface AssistantChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Sent as the first message once the new session is ready (e.g. a suggested question). */
  initialQuestion?: string | null;
  onInitialQuestionSent?: () => void;
}

export function AssistantChatDrawer({
  isOpen,
  onClose,
  initialQuestion,
  onInitialQuestionSent,
}: AssistantChatDrawerProps) {
  const {
    messages,
    currentSessionId,
    sessions,
    isLoadingSessions,
    isInitializing,
    isStreaming,
    meta,
    error,
    initialize,
    createNewSession,
    switchToSession,
    sendMessage,
    clearError,
  } = useAssistantChat();

  // A ref (not state) so the guard is synchronous within the effect body —
  // immune to React Strict Mode's dev-only double-invocation of effects,
  // which would otherwise create two sessions for a single open.
  const hasInitializedRef = useRef(false);

  // Starts a brand-new session every time the drawer opens (re-armed on
  // close), matching the "always a new chat" behavior of ChatGPT/Claude/
  // Gemini — history is reachable separately via the history panel.
  useEffect(() => {
    if (isOpen && !hasInitializedRef.current) {
      hasInitializedRef.current = true;
      initialize();
    } else if (!isOpen) {
      hasInitializedRef.current = false;
    }
  }, [isOpen, initialize]);

  // A question handed in from outside is sent once, as soon as the fresh
  // session exists. The ref keeps Strict Mode and re-renders from sending it
  // twice; the parent clears it through the callback.
  const sentQuestionRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isOpen || !initialQuestion) return;
    if (isInitializing || isStreaming || !currentSessionId) return;
    if (sentQuestionRef.current === initialQuestion) return;
    sentQuestionRef.current = initialQuestion;
    void sendMessage(initialQuestion);
    onInitialQuestionSent?.();
  }, [
    isOpen,
    initialQuestion,
    isInitializing,
    isStreaming,
    currentSessionId,
    sendMessage,
    onInitialQuestionSent,
  ]);
  useEffect(() => {
    if (!isOpen) sentQuestionRef.current = null;
  }, [isOpen]);

  return (
    <ChatDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="PowerMySport AI"
      subtitle="Ask me anything about the platform"
      messages={messages}
      isInitializing={isInitializing}
      isStreaming={isStreaming}
      meta={meta}
      error={error}
      sendMessage={sendMessage}
      clearError={clearError}
      quickReplies={QUICK_REPLIES}
      sessions={sessions}
      isLoadingSessions={isLoadingSessions}
      currentSessionId={currentSessionId}
      onNewChat={createNewSession}
      onSelectSession={switchToSession}
    >
      <AIDisclaimer variant="chat" />
    </ChatDrawer>
  );
}
