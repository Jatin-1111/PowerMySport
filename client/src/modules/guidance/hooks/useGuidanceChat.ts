"use client";

import { useState, useCallback, useRef } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [meta, setMeta] = useState<ChatSessionMeta>({
    dailyRemaining: 30,
    lifetimeRemaining: 150,
    dailyMessageCount: 0,
    totalMessageCount: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /**
   * Loads or initializes the chat session from the server.
   * Call on drawer open.
   */
  const initialize = useCallback(async () => {
    if (!submissionId) return;
    setIsInitializing(true);
    setError(null);
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch(`${API_BASE_URL}/guidance/${submissionId}/chat`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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
    } catch (err) {
      setError("Failed to connect to chat service");
    } finally {
      setIsInitializing(false);
    }
  }, [submissionId]);

  /**
   * Sends a user message and streams the assistant response.
   */
  const sendMessage = useCallback(
    async (userContent: string) => {
      if (!userContent.trim() || isStreaming) return;

      const userMessage: ChatMessage = {
        role: "user",
        content: userContent.trim(),
        createdAt: new Date().toISOString(),
      };

      // Optimistically add user message
      setMessages((prev) => [...prev, userMessage]);
      setIsStreaming(true);
      setIsLoading(true);
      setError(null);

      // Prepare a placeholder for the streaming assistant response
      const assistantPlaceholder: ChatMessage = {
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantPlaceholder]);

      abortRef.current = new AbortController();

      try {
        const token =
          typeof window !== "undefined" ? localStorage.getItem("token") : null;

        const res = await fetch(
          `${API_BASE_URL}/guidance/${submissionId}/chat`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            credentials: "include",
            body: JSON.stringify({ message: userContent.trim() }),
            signal: abortRef.current.signal,
          },
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const errMsg =
            errData.message || `Chat request failed (${res.status})`;
          // Remove the placeholder assistant message
          setMessages((prev) => prev.slice(0, -1));
          setError(errMsg);
          // If rate limit, also update meta
          if (res.status === 429) {
            setMeta((m) => ({ ...m, dailyRemaining: 0 }));
          }
          return;
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          setError("No response stream available");
          return;
        }

        let buffer = "";
        let fullContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;

            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.chunk) {
                fullContent += parsed.chunk;
                // Update the last message (assistant placeholder) with accumulated content
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last && last.role === "assistant") {
                    updated[updated.length - 1] = {
                      ...last,
                      content: fullContent,
                    };
                  }
                  return updated;
                });
              } else if (parsed.done) {
                // Stream complete — update meta counters
                setMeta((m) => ({
                  ...m,
                  dailyMessageCount: m.dailyMessageCount + 1,
                  totalMessageCount: m.totalMessageCount + 1,
                  dailyRemaining: Math.max(0, m.dailyRemaining - 1),
                  lifetimeRemaining: Math.max(0, m.lifetimeRemaining - 1),
                }));
              } else if (parsed.error) {
                setError(parsed.error);
              }
            } catch {
              // Malformed SSE line — ignore
            }
          }
        }
      } catch (err: unknown) {
        if ((err as Error)?.name === "AbortError") return;
        setMessages((prev) => prev.slice(0, -1)); // Remove placeholder
        setError("Connection error. Please try again.");
      } finally {
        setIsStreaming(false);
        setIsLoading(false);
      }
    },
    [submissionId, isStreaming],
  );

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setIsLoading(false);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    messages,
    isLoading,
    isInitializing,
    isStreaming,
    meta,
    error,
    initialize,
    sendMessage,
    cancelStream,
    clearError,
  };
}
