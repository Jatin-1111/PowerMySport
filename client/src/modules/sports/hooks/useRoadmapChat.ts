"use client";

import type { ChatMessage } from "@/modules/guidance/hooks/useGuidanceChat";
import { useCallback, useRef, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

interface ChatSessionMeta {
  dailyRemaining: number;
  lifetimeRemaining: number;
  dailyMessageCount: number;
  totalMessageCount: number;
}

export interface RoadmapSessionSummary {
  _id: string;
  sportSlug: string;
  title: string | null;
  totalMessageCount: number;
  updatedAt: string;
  createdAt: string;
}

interface UseRoadmapChatOptions {
  sportSlug: string;
  level?: number;
}

function authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function useRoadmapChat({ sportSlug, level }: UseRoadmapChatOptions) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<RoadmapSessionSummary[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
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

  // ── Load session list ──────────────────────────────────────────────────────

  const loadSessions = useCallback(async () => {
    setIsLoadingSessions(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/roadmap-chat/sessions?sportSlug=${encodeURIComponent(sportSlug)}`,
        { headers: authHeaders(), credentials: "include" },
      );
      const data = await res.json();
      if (data.success) setSessions(data.data);
    } catch {
      // silently ignore — history panel just shows empty
    } finally {
      setIsLoadingSessions(false);
    }
  }, [sportSlug]);

  // ── Initialize (load latest session or create one) ────────────────────────

  const initialize = useCallback(async () => {
    if (!sportSlug) return;
    setIsInitializing(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE_URL}/roadmap-chat/${encodeURIComponent(sportSlug)}`,
        { headers: authHeaders(), credentials: "include" },
      );
      const data = await res.json();
      if (data.success) {
        setMessages(data.data.messages);
        setCurrentSessionId(data.data.sessionId ?? null);
        setMeta({
          dailyRemaining: data.data.dailyRemaining,
          lifetimeRemaining: data.data.lifetimeRemaining,
          dailyMessageCount: data.data.dailyMessageCount ?? 0,
          totalMessageCount: data.data.totalMessageCount,
        });
        loadSessions();
      } else {
        setError(data.message || "Failed to load chat session");
      }
    } catch {
      setError("Failed to connect to chat service");
    } finally {
      setIsInitializing(false);
    }
  }, [sportSlug, loadSessions]);

  // ── Create a brand-new session ─────────────────────────────────────────────

  const createNewSession = useCallback(async () => {
    setIsInitializing(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/roadmap-chat/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({ sportSlug }),
      });
      const data = await res.json();
      if (data.success) {
        setMessages(data.data.messages);
        setCurrentSessionId(data.data.sessionId ?? null);
        setMeta({
          dailyRemaining: data.data.dailyRemaining,
          lifetimeRemaining: data.data.lifetimeRemaining,
          dailyMessageCount: data.data.dailyMessageCount ?? 0,
          totalMessageCount: data.data.totalMessageCount,
        });
        // Prepend to local session list
        setSessions((prev) => [
          {
            _id: data.data.sessionId,
            sportSlug,
            title: null,
            totalMessageCount: 0,
            updatedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      } else {
        setError(data.message || "Failed to create session");
      }
    } catch {
      setError("Failed to connect to chat service");
    } finally {
      setIsInitializing(false);
    }
  }, [sportSlug]);

  // ── Switch to an existing session ─────────────────────────────────────────

  const switchToSession = useCallback(async (sessionId: string) => {
    if (sessionId === currentSessionId) return;
    setIsInitializing(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE_URL}/roadmap-chat/sessions/${sessionId}`,
        { headers: authHeaders(), credentials: "include" },
      );
      const data = await res.json();
      if (data.success) {
        setMessages(data.data.messages);
        setCurrentSessionId(sessionId);
        setMeta({
          dailyRemaining: data.data.dailyRemaining,
          lifetimeRemaining: data.data.lifetimeRemaining,
          dailyMessageCount: data.data.dailyMessageCount ?? 0,
          totalMessageCount: data.data.totalMessageCount,
        });
      } else {
        setError(data.message || "Failed to load session");
      }
    } catch {
      setError("Failed to connect to chat service");
    } finally {
      setIsInitializing(false);
    }
  }, [currentSessionId]);

  // ── Send a message ────────────────────────────────────────────────────────

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

      // Determine endpoint: prefer session-specific, fall back to sport slug
      const endpoint = currentSessionId
        ? `${API_BASE_URL}/roadmap-chat/sessions/${currentSessionId}`
        : `${API_BASE_URL}/roadmap-chat/${encodeURIComponent(sportSlug)}`;

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          credentials: "include",
          body: JSON.stringify({ message: userContent.trim(), level: levelRef.current }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData.message || `Chat request failed (${res.status})`;
          setMessages((prev) => prev.slice(0, -1));
          setError(errMsg);
          if (res.status === 429) setMeta((m) => ({ ...m, dailyRemaining: 0 }));
          return;
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) { setError("No response stream available"); return; }

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
                  if (last?.role === "assistant") {
                    updated[updated.length - 1] = { ...last, content: fullContent };
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
                // Update title in sessions list if this was the first user message
                if (currentSessionId) {
                  setSessions((prev) =>
                    prev.map((s) =>
                      s._id === currentSessionId
                        ? {
                            ...s,
                            title: s.title ?? (userContent.trim().slice(0, 60) + (userContent.trim().length > 60 ? "…" : "")),
                            updatedAt: new Date().toISOString(),
                          }
                        : s,
                    ),
                  );
                }
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
    [sportSlug, isStreaming, currentSessionId],
  );

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setIsLoading(false);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return {
    messages,
    currentSessionId,
    sessions,
    isLoadingSessions,
    isLoading,
    isInitializing,
    isStreaming,
    meta,
    error,
    initialize,
    loadSessions,
    createNewSession,
    switchToSession,
    sendMessage,
    cancelStream,
    clearError,
  };
}
