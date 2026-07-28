"use client";

import { useCallback, useState } from "react";
import { authHeaders, useChatCore } from "./useChatCore";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

interface ChatSessionMeta {
  dailyRemaining: number;
  lifetimeRemaining: number;
  dailyMessageCount: number;
  totalMessageCount: number;
}

interface UseGuidanceChatOptions {
  submissionId: string;
}

export function useGuidanceChat({ submissionId }: UseGuidanceChatOptions) {
  const {
    messages,
    setMessages,
    isStreaming,
    error,
    setError,
    sendMessage: sendCore,
    clearError,
  } = useChatCore();

  const [isInitializing, setIsInitializing] = useState(false);
  const [meta, setMeta] = useState<ChatSessionMeta>({
    dailyRemaining: 30,
    lifetimeRemaining: 150,
    dailyMessageCount: 0,
    totalMessageCount: 0,
  });

  /**
   * Loads or initializes the chat session from the server.
   * Call on drawer open.
   */
  const initialize = useCallback(async () => {
    if (!submissionId) return;
    setIsInitializing(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/guidance/${submissionId}/chat`, {
        headers: authHeaders(),
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setMessages(data.data.messages);
        setMeta({
          dailyRemaining: data.data.dailyRemaining,
          lifetimeRemaining: data.data.lifetimeRemaining,
          dailyMessageCount: data.data.dailyMessageCount,
          totalMessageCount: data.data.totalMessageCount,
        });
      } else {
        setError(data.message || "Failed to load chat session");
      }
    } catch {
      setError("Failed to connect to chat service");
    } finally {
      setIsInitializing(false);
    }
  }, [submissionId, setMessages, setError]);

  /**
   * Sends a user message and streams the assistant response.
   */
  const sendMessage = useCallback(
    async (userContent: string) => {
      const result = await sendCore(userContent, {
        endpoint: `${API_BASE_URL}/guidance/${submissionId}/chat`,
        body: { message: userContent.trim() },
        onDone: () => {
          setMeta((m) => ({
            ...m,
            dailyMessageCount: m.dailyMessageCount + 1,
            totalMessageCount: m.totalMessageCount + 1,
            dailyRemaining: Math.max(0, m.dailyRemaining - 1),
            lifetimeRemaining: Math.max(0, m.lifetimeRemaining - 1),
          }));
        },
      });
      if (result?.rateLimitHit) {
        setMeta((m) => ({ ...m, dailyRemaining: 0 }));
      }
    },
    [sendCore, submissionId],
  );

  return {
    messages,
    isInitializing,
    isStreaming,
    meta,
    error,
    initialize,
    sendMessage,
    clearError,
  };
}
