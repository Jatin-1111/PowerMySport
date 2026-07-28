"use client";

import { AIDisclaimer } from "@/components/shared/AIDisclaimer";
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
}

export function AssistantChatDrawer({ isOpen, onClose }: AssistantChatDrawerProps) {
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
