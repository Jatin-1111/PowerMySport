"use client";

import { AIDisclaimer } from "@/components/shared/AIDisclaimer";
import { ChatDrawer } from "@/modules/guidance/components/chat/ChatDrawer";
import { useEffect, useState } from "react";
import { useRoadmapChat } from "../hooks/useRoadmapChat";

const QUICK_REPLIES = [
  "Explain this level in simple terms",
  "What should we do this week?",
  "How much will this cost?",
  "Where do I find a coach?",
  "What gear do we need?",
  "Is my child ready for this level?",
];

interface RoadmapChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  sportSlug: string;
  sportName: string;
  level?: number;
  levelLabel?: string;
}

export function RoadmapChatDrawer({
  isOpen,
  onClose,
  sportSlug,
  sportName,
  level,
  levelLabel,
}: RoadmapChatDrawerProps) {
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
  } = useRoadmapChat({ sportSlug, level });

  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    if (isOpen && !hasInitialized) {
      setHasInitialized(true);
      initialize();
    }
  }, [isOpen, hasInitialized, initialize]);

  return (
    <ChatDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="PowerMySport AI"
      subtitle={levelLabel ? `${sportName} · ${levelLabel} level` : sportName}
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
