"use client";

import { useState, useCallback, useRef } from "react";
import type { ChatMessage } from "@/modules/guidance/hooks/useGuidanceChat";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

interface ChatSessionMeta {
  dailyRemaining: number;
  lifetimeRemaining: number;
  dailyMessageCount: number;
  totalMessageCount: number;
}

interface UseRoadmapChatOptions {
  sportSlug: string;
  /** Current pathway level (1-5) the parent is viewing — sent with each message for context */
  level?: number;
}

export function useRoadmapChat({ sportSlug, level }: UseRoadmapChatOptions) {
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
  const levelRef = useRef(level);
  levelRef.current = level;

  const initialize = useCallback(async () => {
    if (!sportSlug) return;
    setIsInitializing(true);
    setError(null);
    try {
      const token =
        typeof window !== "undefined" ? localStorage.getItem("token") : null;
      const res = await fetch(
        `${API_BASE_URL}/roadmap-chat/${encodeURIComponent(sportSlug)}`,
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: "include",
        },
      );
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
  }, [sportSlug]);

  const sendMessage = useCallback(
    async (userContent: string) => {
      if (!userContent.trim() || isStreaming) return;

      const userMessage: ChatMessage = {
        role: "user",
        content: userContent.trim(),
        createdAt: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsStreaming(true);
      setIsLoading(true);
      setError(null);

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
          `${API_BASE_URL}/roadmap-chat/${encodeURIComponent(sportSlug)}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            credentials: "include",
            body: JSON.stringify({
              message: userContent.trim(),
              level: levelRef.current,
            }),
            signal: abortRef.current.signal,
          },
        );

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const errMsg =
            errData.message || `Chat request failed (${res.status})`;
          setMessages((prev) => prev.slice(0, -1));
          setError(errMsg);
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
        setMessages((prev) => prev.slice(0, -1));
        setError("Connection error. Please try again.");
      } finally {
        setIsStreaming(false);
        setIsLoading(false);
      }
    },
    [sportSlug, isStreaming],
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
