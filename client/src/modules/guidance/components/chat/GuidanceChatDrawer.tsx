"use client";

import { AIDisclaimer } from "@/components/shared/AIDisclaimer";
import { useEffect, useState } from "react";
import { useGuidanceChat } from "../../hooks/useGuidanceChat";
import type { GuidanceSubmission } from "../../types";
import { ChatDrawer } from "./ChatDrawer";

// ─── Quick-reply chips ────────────────────────────────────────────────────────

const QUICK_REPLIES = [
  "Explain this phase in detail",
  "Suggest specific drills",
  "Where do I find a coach?",
  "How do I adjust the schedule?",
  "What equipment do we need?",
  "Tips for mental resilience",
];

// ─── Guidance-specific chat drawer ────────────────────────────────────────────

interface GuidanceChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  submission: GuidanceSubmission;
}

export function GuidanceChatDrawer({
  isOpen,
  onClose,
  submission,
}: GuidanceChatDrawerProps) {
  const { submissionId, query } = {
    submissionId: submission.id,
    query: submission.query,
  };
  const {
    messages,
    isInitializing,
    isStreaming,
    meta,
    error,
    initialize,
    sendMessage,
    clearError,
  } = useGuidanceChat({ submissionId });

  const [hasInitialized, setHasInitialized] = useState(false);

  // Initialize chat on first open
  useEffect(() => {
    if (isOpen && !hasInitialized) {
      setHasInitialized(true);
      initialize();
    }
  }, [isOpen, hasInitialized, initialize]);

  const sport = query.sport || "sport";

  return (
    <ChatDrawer
      isOpen={isOpen}
      onClose={onClose}
      title="Sports Coach"
      subtitle={`${sport} guidance · personalized for you`}
      messages={messages}
      isInitializing={isInitializing}
      isStreaming={isStreaming}
      meta={meta}
      error={error}
      sendMessage={sendMessage}
      clearError={clearError}
      quickReplies={QUICK_REPLIES}
    >
      <AIDisclaimer variant="chat" />
    </ChatDrawer>
  );
}
